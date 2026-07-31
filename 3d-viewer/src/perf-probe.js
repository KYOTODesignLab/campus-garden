// Temporary load-performance probe. Inert unless the page is opened with
// ?perf=1, so it costs nothing in production.
//
// Why this exists: COPC loading spans three layers we cannot see from the
// outside — HTTP range requests to R2, LAZ decoding inside laz-perf (wasm,
// running in Giro3D's worker pool), and main-thread work (buffer copies,
// BufferAttribute creation, GPU upload). "Loading is slow" is not actionable
// until those are separated, and neither the network panel nor a CPU profile
// separates them on its own: the decode happens in blob-URL workers whose
// frames are anonymous, and the wasm module is instantiated once per worker.
//
// So we measure from the only place that sees all three: the main thread.
//   - fetch is wrapped to time headers and body separately, with byte counts.
//   - Worker is wrapped to time each postMessage round trip by message id,
//     recording queue depth and point count per message.
//   - The first round trip on each worker carries that worker's wasm
//     instantiation cost, which is why we report it separately from the rest.

const params = new URLSearchParams(location.search);
export const perfEnabled = params.get('perf') === '1';

const t0 = performance.now();
const marks = [];
const spans = [];
const fetches = [];
const messages = [];
const longTasks = [];
const workerMeta = [];
let inflightFetches = 0;

function classify(url) {
  if (url.includes('laz-perf.wasm')) return 'wasm-binary';
  if (url.includes('laz-perf.js')) return 'wasm-glue';
  if (url.includes('manifest.json')) return 'manifest';
  if (/\.(copc\.)?laz(\?|$)/.test(url)) return 'copc-range';
  return 'other';
}

function payloadBytes(payload) {
  const buf = payload?.buffer;
  if (buf instanceof ArrayBuffer) return buf.byteLength;
  if (buf?.byteLength != null) return buf.byteLength;
  return 0;
}

function install() {
  const realFetch = window.fetch.bind(window);
  window.fetch = function instrumentedFetch(input, init) {
    const url = typeof input === 'string' ? input : (input?.url ?? String(input));
    const range = init?.headers?.Range ?? init?.headers?.range ?? input?.headers?.get?.('Range') ?? null;
    const rec = { url, kind: classify(url), range, start: performance.now(), headersMs: null, bodyMs: null, bytes: 0, failed: false };
    fetches.push(rec);
    inflightFetches += 1;
    let settled = false;
    const done = () => { if (!settled) { settled = true; inflightFetches -= 1; } };
    return realFetch(input, init).then(res => {
      rec.headersMs = performance.now() - rec.start;
      rec.status = res.status;
      // Timing fetch() alone would only measure time-to-headers; the body of a
      // multi-megabyte range request is the part we actually care about, and it
      // is only pulled when the caller reads it.
      for (const method of ['blob', 'arrayBuffer', 'json', 'text']) {
        const original = res[method].bind(res);
        res[method] = async (...args) => {
          try {
            const value = await original(...args);
            rec.bodyMs = performance.now() - rec.start;
            rec.bytes = value?.size ?? value?.byteLength ?? 0;
            return value;
          } finally { done(); }
        };
      }
      return res;
    }).catch(error => {
      rec.failed = true;
      rec.bodyMs = performance.now() - rec.start;
      done();
      throw error;
    });
  };

  const RealWorker = window.Worker;
  let workerSeq = 0;
  window.Worker = class InstrumentedWorker extends RealWorker {
    constructor(scriptUrl, options) {
      super(scriptUrl, options);
      this.__perfId = workerSeq++;
      this.__perfPending = new Map();
      this.__perfSeq = 0;
      workerMeta.push({ id: this.__perfId, createdAt: performance.now() - t0 });
      super.addEventListener('message', event => {
        const requestId = event.data?.requestId;
        if (requestId == null) return;
        const rec = this.__perfPending.get(requestId);
        if (!rec) return;
        this.__perfPending.delete(requestId);
        rec.ms = performance.now() - rec.start;
        rec.error = event.data != null && 'error' in event.data ? String(event.data.error) : null;
        messages.push(rec);
      });
    }

    postMessage(message, transfer) {
      // Byte sizes have to be read before the call: these buffers are
      // transferred, which detaches them.
      if (message != null && typeof message === 'object' && 'id' in message) {
        this.__perfPending.set(message.id, {
          workerId: this.__perfId,
          seq: this.__perfSeq++,
          type: message.type,
          bytes: payloadBytes(message.payload),
          points: message.payload?.metadata?.pointCount ?? null,
          queuedBehind: this.__perfPending.size,
          start: performance.now(),
          startedAt: performance.now() - t0,
          ms: null,
        });
      }
      return super.postMessage(message, transfer);
    }

    get __perfInflight() { return this.__perfPending.size; }
  };

  if (typeof PerformanceObserver === 'function') {
    try {
      new PerformanceObserver(list => {
        for (const entry of list.getEntries()) longTasks.push({ at: entry.startTime - t0, ms: entry.duration });
      }).observe({ type: 'longtask', buffered: true });
    } catch { /* longtask unsupported (Safari/Firefox) — the rest still works. */ }
  }
}

function quantile(sorted, q) {
  if (sorted.length === 0) return null;
  const i = Math.min(sorted.length - 1, Math.max(0, Math.round((sorted.length - 1) * q)));
  return sorted[i];
}

function summarize(values) {
  const sorted = [...values].sort((a, b) => a - b);
  const sum = sorted.reduce((a, b) => a + b, 0);
  return {
    count: sorted.length,
    sumMs: round(sum),
    meanMs: sorted.length ? round(sum / sorted.length) : null,
    p50Ms: round(quantile(sorted, 0.5)),
    p95Ms: round(quantile(sorted, 0.95)),
    maxMs: round(sorted[sorted.length - 1]),
  };
}

function round(v, digits = 1) {
  if (v == null || Number.isNaN(v)) return null;
  const f = 10 ** digits;
  return Math.round(v * f) / f;
}

// Wall-clock span actually occupied by a set of [start, end] intervals, i.e.
// how much of the load is genuinely serialized. Comparing this against the
// naive sum tells us how well the work is overlapping.
function busyWallMs(intervals) {
  const sorted = intervals.filter(i => i.end != null).sort((a, b) => a.start - b.start);
  let total = 0;
  let cursor = -Infinity;
  for (const { start, end } of sorted) {
    if (end <= cursor) continue;
    total += end - Math.max(start, cursor);
    cursor = Math.max(cursor, end);
  }
  return round(total);
}

function maxConcurrency(intervals) {
  const events = [];
  for (const { start, end } of intervals) {
    if (end == null) continue;
    events.push([start, 1], [end, -1]);
  }
  events.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  let current = 0;
  let peak = 0;
  for (const [, delta] of events) { current += delta; peak = Math.max(peak, current); }
  return peak;
}

function report() {
  const now = performance.now();
  const netByKind = {};
  for (const rec of fetches) {
    const bucket = (netByKind[rec.kind] ??= { count: 0, bytes: 0, durations: [] });
    bucket.count += 1;
    bucket.bytes += rec.bytes;
    if (rec.bodyMs != null) bucket.durations.push(rec.bodyMs);
  }
  const network = {};
  for (const [kind, bucket] of Object.entries(netByKind)) {
    network[kind] = { ...summarize(bucket.durations), bytes: bucket.bytes, mib: round(bucket.bytes / 1048576, 2) };
  }
  const netIntervals = fetches.filter(f => f.bodyMs != null).map(f => ({ start: f.start, end: f.start + f.bodyMs }));

  const msgByType = {};
  for (const rec of messages) {
    (msgByType[rec.type] ??= []).push(rec);
  }
  const workers = {};
  for (const [type, list] of Object.entries(msgByType)) {
    const first = list.filter(r => r.seq === 0).map(r => r.ms);
    const rest = list.filter(r => r.seq > 0).map(r => r.ms);
    const points = list.reduce((a, r) => a + (r.points ?? 0), 0);
    const bytes = list.reduce((a, r) => a + r.bytes, 0);
    const all = list.map(r => r.ms);
    workers[type] = {
      all: summarize(all),
      // First message per worker pays that worker's wasm instantiation.
      firstPerWorker: summarize(first),
      steadyState: summarize(rest),
      wasmInitEstimateMs: first.length && rest.length
        ? round(quantile([...first].sort((a, b) => a - b), 0.5) - quantile([...rest].sort((a, b) => a - b), 0.5))
        : null,
      points,
      compressedMiB: round(bytes / 1048576, 2),
      pointsPerSecPerWorker: points && rest.length
        ? Math.round(points / (all.reduce((a, b) => a + b, 0) / 1000))
        : null,
      busyWallMs: busyWallMs(list.map(r => ({ start: r.start, end: r.start + r.ms }))),
      peakConcurrency: maxConcurrency(list.map(r => ({ start: r.start, end: r.start + r.ms }))),
      maxQueuedBehind: list.reduce((a, r) => Math.max(a, r.queuedBehind), 0),
      errors: list.filter(r => r.error).length,
    };
  }

  return {
    url: location.href,
    hardwareConcurrency: navigator.hardwareConcurrency,
    elapsedMs: round(now - t0),
    marks: marks.map(m => ({ name: m.name, at: round(m.at) })),
    spans: spans.map(s => ({ name: s.name, ms: round(s.ms), at: round(s.at) })),
    network: {
      byKind: network,
      totalMiB: round(fetches.reduce((a, f) => a + f.bytes, 0) / 1048576, 2),
      requests: fetches.length,
      failed: fetches.filter(f => f.failed).length,
      sumMs: round(fetches.reduce((a, f) => a + (f.bodyMs ?? 0), 0)),
      busyWallMs: busyWallMs(netIntervals),
      peakConcurrency: maxConcurrency(netIntervals),
      slowest: [...fetches].sort((a, b) => (b.bodyMs ?? 0) - (a.bodyMs ?? 0)).slice(0, 8)
        .map(f => ({ kind: f.kind, range: f.range, ms: round(f.bodyMs), headersMs: round(f.headersMs), kib: round(f.bytes / 1024) })),
      // Full ordered timeline: the shape of the await chain is the finding here,
      // not any individual request's duration.
      timeline: fetches.filter(f => f.kind === 'copc-range')
        .map(f => ({ at: round(f.start - t0), ms: round(f.bodyMs), headersMs: round(f.headersMs), kib: round(f.bytes / 1024), range: f.range })),
    },
    workers: {
      created: workerMeta.length,
      byType: workers,
    },
    longTasks: { ...summarize(longTasks.map(l => l.ms)), worst: [...longTasks].sort((a, b) => b.ms - a.ms).slice(0, 5).map(l => ({ at: round(l.at), ms: round(l.ms) })) },
  };
}

function pendingWorkerMessages() {
  // The wrapper keeps its pending map per instance; sum what has not resolved.
  return messages.filter(m => m.ms == null).length;
}

async function waitForIdle({ quietMs = 1500, timeoutMs = 120000 } = {}) {
  const deadline = performance.now() + timeoutMs;
  let quietSince = null;
  while (performance.now() < deadline) {
    const busy = inflightFetches > 0 || pendingWorkerMessages() > 0;
    if (busy) {
      quietSince = null;
    } else {
      quietSince ??= performance.now();
      if (performance.now() - quietSince >= quietMs) return { idle: true, elapsedMs: round(performance.now() - t0) };
    }
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  return { idle: false, timedOut: true, elapsedMs: round(performance.now() - t0) };
}

export const perf = {
  enabled: perfEnabled,
  mark(name) {
    if (!perfEnabled) return;
    marks.push({ name, at: performance.now() - t0 });
    performance.mark(name);
  },
  async span(name, promise) {
    if (!perfEnabled) return promise;
    const start = performance.now();
    try {
      return await promise;
    } finally {
      spans.push({ name, at: start - t0, ms: performance.now() - start });
    }
  },
  report,
  waitForIdle,
};

if (perfEnabled) {
  install();
  window.__perf = perf;
  perf.mark('probe-installed');
}
