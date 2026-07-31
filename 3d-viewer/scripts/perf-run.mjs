// Loads the viewer in a real Chrome, waits until COPC streaming goes quiet,
// then dumps the ?perf=1 probe's report as JSON.
//
// Uses a throwaway profile so localStorage state from earlier sessions cannot
// change which dataset loads, and runs headed by default so the measurement
// sees a real GPU rather than SwiftShader.
//
// Usage:
//   node scripts/perf-run.mjs [--url <url>] [--headless] [--runs N] [--out file.json]

import { spawn } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const PORT = Number(process.env.CDP_PORT ?? 9333);

function arg(name, fallback = null) {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : fallback;
}
const flag = name => process.argv.includes(`--${name}`);

const baseUrl = arg('url', 'http://127.0.0.1:5173/');
const runs = Number(arg('runs', '1'));
const outFile = arg('out');

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function waitForHttp(url, timeoutMs = 20000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(url);
      if (res.ok) return res.json();
    } catch { /* not up yet */ }
    await sleep(200);
  }
  throw new Error(`timed out waiting for ${url}`);
}

class CDP {
  #ws; #id = 0; #pending = new Map(); #handlers = new Map();

  static async connect(wsUrl) {
    const cdp = new CDP();
    cdp.#ws = new WebSocket(wsUrl);
    await new Promise((resolve, reject) => {
      cdp.#ws.addEventListener('open', resolve, { once: true });
      cdp.#ws.addEventListener('error', () => reject(new Error('CDP websocket failed')), { once: true });
    });
    cdp.#ws.addEventListener('message', event => {
      const msg = JSON.parse(event.data);
      if (msg.id != null) {
        const p = cdp.#pending.get(msg.id);
        if (!p) return;
        cdp.#pending.delete(msg.id);
        msg.error ? p.reject(new Error(msg.error.message)) : p.resolve(msg.result);
      } else {
        cdp.#handlers.get(msg.method)?.forEach(h => h(msg.params));
      }
    });
    return cdp;
  }

  on(method, handler) {
    if (!this.#handlers.has(method)) this.#handlers.set(method, []);
    this.#handlers.get(method).push(handler);
  }

  send(method, params = {}) {
    const id = ++this.#id;
    return new Promise((resolve, reject) => {
      this.#pending.set(id, { resolve, reject });
      this.#ws.send(JSON.stringify({ id, method, params }));
    });
  }

  async eval(expression, { awaitPromise = false, timeoutMs = 180000 } = {}) {
    const result = await Promise.race([
      this.send('Runtime.evaluate', { expression, awaitPromise, returnByValue: true }),
      sleep(timeoutMs).then(() => { throw new Error(`Runtime.evaluate timed out: ${expression.slice(0, 60)}`); }),
    ]);
    if (result.exceptionDetails) {
      throw new Error(`page threw: ${result.exceptionDetails.exception?.description ?? result.exceptionDetails.text}`);
    }
    return result.result.value;
  }

  close() { this.#ws.close(); }
}

async function measure(url) {
  const profile = await mkdtemp(join(tmpdir(), 'perf-chrome-'));
  const chromeArgs = [
    `--remote-debugging-port=${PORT}`,
    `--user-data-dir=${profile}`,
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-extensions',
    '--disable-background-timer-throttling',
    '--disable-renderer-backgrounding',
    '--window-size=1400,900',
    'about:blank',
  ];
  if (flag('headless')) chromeArgs.unshift('--headless=new');

  const chrome = spawn(CHROME, chromeArgs, { stdio: 'ignore' });
  const errors = [];
  let cdp;
  try {
    await waitForHttp(`http://127.0.0.1:${PORT}/json/version`);
    const targets = await waitForHttp(`http://127.0.0.1:${PORT}/json/list`);
    const page = targets.find(t => t.type === 'page');
    if (!page) throw new Error('no page target');

    cdp = await CDP.connect(page.webSocketDebuggerUrl);
    await cdp.send('Runtime.enable');
    await cdp.send('Log.enable');
    await cdp.send('Page.enable');
    await cdp.send('Network.enable');
    await cdp.send('Inspector.enable');
    // Default to a genuinely cold cache: a fresh profile empties the disk cache
    // but not the in-memory one, so repeated ranges within a run would still be
    // served locally and understate real latency. --warm measures the opposite.
    await cdp.send('Network.setCacheDisabled', { cacheDisabled: !flag('warm') });

    const console_ = [];
    const badResponses = [];
    const crashes = [];
    cdp.on('Runtime.exceptionThrown', p => errors.push(p.exceptionDetails?.exception?.description ?? p.exceptionDetails?.text));
    cdp.on('Log.entryAdded', p => { if (p.entry.level === 'error') errors.push(`${p.entry.source}: ${p.entry.text} ${p.entry.url ?? ''}`.trim()); });
    cdp.on('Runtime.consoleAPICalled', p => console_.push({ level: p.type, text: p.args.map(a => a.description ?? a.value).join(' ').slice(0, 300) }));
    cdp.on('Network.responseReceived', p => { if (p.response.status >= 400) badResponses.push({ status: p.response.status, url: p.response.url }); });
    cdp.on('Network.loadingFailed', p => badResponses.push({ status: 'failed', error: p.errorText, url: p.requestId }));
    cdp.on('Inspector.targetCrashed', () => crashes.push({ at: Date.now(), kind: 'renderer crashed' }));
    cdp.on('Page.frameDetached', p => crashes.push({ kind: 'frame detached', reason: p.reason }));

    const target = new URL(url);
    target.searchParams.set('perf', '1');
    await cdp.send('Page.navigate', { url: target.toString() });

    // The probe defines window.__perf synchronously at module evaluation.
    const deadline = Date.now() + 30000;
    while (Date.now() < deadline) {
      if (await cdp.eval('typeof window.__perf === "object" && window.__perf !== null')) break;
      await sleep(200);
    }
    const idle = await cdp.eval('window.__perf.waitForIdle({ quietMs: 2000, timeoutMs: 150000 })', { awaitPromise: true });
    const report = await cdp.eval('window.__perf.report()');

    // Watch past the end of loading: a renderer that dies from WebGL context
    // loss or memory pressure does so after the data is in, not during.
    const holdSec = Number(arg('hold', '0'));
    const health = [];
    for (let elapsed = 0; elapsed < holdSec; elapsed += 2) {
      await sleep(2000);
      try {
        health.push(await cdp.eval(`(() => ({
          at: ${elapsed + 2},
          canvases: document.querySelectorAll('canvas').length,
          contextLost: [...document.querySelectorAll('canvas')].map(c => {
            const gl = c.getContext('webgl2') ?? c.getContext('webgl');
            return gl ? gl.isContextLost() : 'no-gl';
          }),
          heapMB: performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1048576) : null,
          status: document.getElementById('status')?.textContent ?? null,
          bodyClass: document.body.className,
        }))()`));
      } catch (error) {
        health.push({ at: elapsed + 2, evalFailed: String(error.message) });
      }
    }

    const status = await cdp.eval('document.getElementById("status")?.textContent ?? null').catch(e => `eval failed: ${e.message}`);
    let screenshot = null;
    try {
      const shot = await cdp.send('Page.captureScreenshot', { format: 'png' });
      screenshot = arg('shot', join(tmpdir(), `viewer-${Date.now()}.png`));
      await writeFile(screenshot, Buffer.from(shot.data, 'base64'));
    } catch (error) {
      screenshot = `capture failed: ${error.message}`;
    }
    return { ...report, idle, status, crashes, badResponses, consoleErrors: console_.filter(c => c.level === 'error' || c.level === 'warning'), errors, health, screenshot };
  } finally {
    cdp?.close();
    chrome.kill();
    await sleep(500);
    await rm(profile, { recursive: true, force: true });
  }
}

const results = [];
for (let i = 0; i < runs; i++) {
  if (runs > 1) process.stderr.write(`run ${i + 1}/${runs}\n`);
  results.push(await measure(baseUrl));
}

const output = runs === 1 ? results[0] : results;
const json = JSON.stringify(output, null, 2);
if (outFile) {
  await writeFile(outFile, json);
  process.stderr.write(`wrote ${outFile}\n`);
} else {
  console.log(json);
}
