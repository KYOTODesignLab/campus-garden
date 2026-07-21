import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const candidates = [];

for (const pkg of ['laz-perf', '@giro3d/giro3d']) {
  try {
    const root = path.dirname(require.resolve(`${pkg}/package.json`));
    candidates.push(root);
  } catch {}
}

const outDir = path.resolve('public/wasm');
fs.mkdirSync(outDir, { recursive: true });

let copied = 0;
function walk(dir) {
  if (!fs.existsSync(dir)) return;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(p);
    else if (/laz.*perf.*\.(wasm|js)$/i.test(entry.name)) {
      fs.copyFileSync(p, path.join(outDir, entry.name));
      copied++;
    }
  }
}

for (const c of candidates) walk(c);

if (copied === 0) {
  console.warn('No laz-perf wasm/js files found. If LAZ decoding fails, copy laz-perf.wasm into public/wasm/.');
} else {
  console.log(`Copied ${copied} laz-perf asset(s) to ${outDir}`);
}
