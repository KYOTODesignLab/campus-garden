import './style.css';

import ColorMap from '@giro3d/giro3d/core/ColorMap.js';
import Instance from '@giro3d/giro3d/core/Instance.js';
import PointCloud from '@giro3d/giro3d/entities/PointCloud.js';
import COPCSource from '@giro3d/giro3d/sources/COPCSource.js';
import { setLazPerfPath } from '@giro3d/giro3d/sources/las/config.js';
import { Box3, Color, MathUtils, MOUSE, Plane, TOUCH, Vector3 } from 'three';
import { MapControls } from 'three/examples/jsm/controls/MapControls.js';

setLazPerfPath(`${import.meta.env.BASE_URL}wasm/`);

const SOLID_COLOR_ATTR = '__SOLID__';

const ui = {
  stage: document.getElementById('stage'),
  embedToggle: document.getElementById('embedToggle'),
  goTo3DBtn: document.getElementById('goTo3DBtn'),
  compareViews: document.getElementById('compareViews'),
  viewBefore: document.getElementById('viewBefore'),
  viewAfter: document.getElementById('viewAfter'),
  viewOverlay: document.getElementById('viewOverlay'),
  reload: document.getElementById('reload'),
  resetCamera: document.getElementById('resetCamera'),
  readout: document.getElementById('readout'),
  legend: document.getElementById('legend'),
  legendTitle: document.getElementById('legendTitle'),
  legendBar: document.getElementById('legendBar'),
  legendMin: document.getElementById('legendMin'),
  legendMid: document.getElementById('legendMid'),
  legendMax: document.getElementById('legendMax'),
  attributeQuick: document.getElementById('attributeQuick'),
  clipToggle: document.getElementById('clipToggle'),
  clipPanel: document.getElementById('clipPanel'),
  closeClipPanel: document.getElementById('closeClipPanel'),
  modeButtons: document.getElementById('modeButtons'),
  splitDivider: document.getElementById('splitDivider'),
  splitLabels: document.getElementById('splitLabels'),
  leftSelect: document.getElementById('leftSelect'),
  rightSelect: document.getElementById('rightSelect'),
  compareHint: document.getElementById('compareHint'),
  status: document.getElementById('status'),
  loadStatus: document.getElementById('loadStatus'),
  attribute: document.getElementById('attribute'),
  colorScheme: document.getElementById('colorScheme'),
  colorMin: document.getElementById('colorMin'),
  colorMax: document.getElementById('colorMax'),
  solidColorRow: document.getElementById('solidColorRow'),
  solidColorLeft: document.getElementById('solidColorLeft'),
  solidColorRight: document.getElementById('solidColorRight'),
  edl: document.getElementById('edl'),
  pointSize: document.getElementById('pointSize'),
  pointSizeLabel: document.getElementById('pointSizeLabel'),
  threshold: document.getElementById('threshold'),
  budgetLabel: document.getElementById('budgetLabel'),
  pointBudget: document.getElementById('pointBudget'),
  pointBudgetLabel: document.getElementById('pointBudgetLabel'),
  total: document.getElementById('total'),
  displayed: document.getElementById('displayed'),
  optionsToggle: document.getElementById('optionsToggle'),
  closePanel: document.getElementById('closePanel'),
  panel: document.getElementById('panel'),
  filtersEnabled: document.getElementById('filtersEnabled'),
  filterAttribute: document.getElementById('filterAttribute'),
  filterMin: document.getElementById('filterMin'),
  filterMax: document.getElementById('filterMax'),
  fullscreenToggle: document.getElementById('fullscreenToggle'),
  shareView: document.getElementById('shareView'),
  introOverlay: document.getElementById('introOverlay'),
  closeIntro: document.getElementById('closeIntro'),
  introDontShow: document.getElementById('introDontShow'),
  clipHorizontalEnabled: document.getElementById('clipHorizontalEnabled'),
  clipHorizontal: document.getElementById('clipHorizontal'),
  clipHorizontalNum: document.getElementById('clipHorizontalNum'),
  clipHorizontalFlip: document.getElementById('clipHorizontalFlip'),
  clipHorizontalValue: document.getElementById('clipHorizontalValue'),
  clipVerticalEnabled: document.getElementById('clipVerticalEnabled'),
  clipVerticalAngle: document.getElementById('clipVerticalAngle'),
  clipVerticalAngleNum: document.getElementById('clipVerticalAngleNum'),
  clipVertical: document.getElementById('clipVertical'),
  clipVerticalNum: document.getElementById('clipVerticalNum'),
  clipVerticalFlip: document.getElementById('clipVerticalFlip'),
  clipVerticalValue: document.getElementById('clipVerticalValue'),
};

const COLOR_SCHEMES = {
  bcyr: ['#313695', '#00b8ff', '#ffff00', '#d7191c'],
  grayscale: ['#000000', '#ffffff'],
};

// Two user-selectable panes (left/right) drive both view modes:
// - "split": each pane has its own Instance/canvas, cropped via CSS clip-path
//   and shown side by side (unchanged from before, just renamed).
// - "superimpose": both currently-selected datasets are loaded together into
//   ONE shared Instance/scene (state.overlay), so they share a single camera
//   and depth buffer — meaning correct 3D occlusion between the two clouds,
//   not just a 2D crossfade. It's rebuilt lazily (only when you switch into
//   this mode) to match whatever is currently picked in the left/right
//   dropdowns.
const state = {
  datasets: [],   // [{ id, label, url }] from manifest.json, user-selectable
  specimens: [],  // [{ id, label, url }] from manifest.json, loaded only via ?dataset=<id>&embed=1 — never listed for selection
  panes: {
    left: { role: 'left', target: null, datasetId: '', entry: null },
    right: { role: 'right', target: null, datasetId: '', entry: null },
  },
  overlay: {
    target: null,
    instance: null,
    leftEntry: null,
    rightEntry: null,
    leftDatasetId: '',
    rightDatasetId: '',
  },
  mode: 'split', // 'split' | 'superimpose'
  split: 50,
  draggingSplit: false,
  currentQuickAttr: 'rgb',
  attributeUserSet: false,
  pointerDown: null,
  syncing: false,
  solidColors: { left: '#e5484d', right: '#3b82f6' },
  clip: {
    horizontalEnabled: false,
    horizontal: null,
    horizontalFlip: true,
    verticalEnabled: false,
    verticalAngleDeg: 90,
    vertical: null,
    verticalCenter: null,
    verticalFlip: false,
  },
};
state.panes.left.target = ui.viewBefore;
state.panes.right.target = ui.viewAfter;
state.overlay.target = ui.viewOverlay;

function lerp(a, b, t) { return a + (b - a) * t; }
function formatScalar(v, digits = 2) { return Number.isFinite(v) ? Number(v).toLocaleString(undefined, { maximumFractionDigits: digits }) : '—'; }
function round(v, digits = 2) { const f = 10 ** digits; return Math.round(v * f) / f; }
function formatCount(v) { return Number.isFinite(v) ? new Intl.NumberFormat().format(v) : '—'; }
function setStatus(text, error = false) {
  ui.status.textContent = text;
  ui.status.classList.toggle('error', error);
  if (ui.loadStatus) {
    const idle = !text || text === 'Ready.';
    ui.loadStatus.hidden = idle;
    if (!idle) {
      ui.loadStatus.textContent = text;
      ui.loadStatus.classList.toggle('error', error);
    }
  }
}
function escapeHtml(s) { return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }

// All entries currently mounted anywhere (split panes + overlay sub-clouds).
function allLoadedEntries() {
  return [state.panes.left.entry, state.panes.right.entry, state.overlay.leftEntry, state.overlay.rightEntry].filter(Boolean);
}
// Entries relevant to the currently active mode (used for value ranges / attribute intersection).
function activeEntries() {
  if (state.mode === 'superimpose') return [state.overlay.leftEntry, state.overlay.rightEntry].filter(Boolean);
  return [state.panes.left.entry, state.panes.right.entry].filter(Boolean);
}
function interactiveEntryForEvent(event) {
  if (state.mode === 'superimpose') return state.overlay.leftEntry ?? state.overlay.rightEntry ?? null;
  const left = state.panes.left.entry;
  const right = state.panes.right.entry;
  if (left && right) {
    const rect = ui.stage.getBoundingClientRect();
    const xPct = ((event.clientX - rect.left) / rect.width) * 100;
    return xPct <= state.split ? left : right;
  }
  return left || right || null;
}

function isRgbAttribute(name) { return ['color', 'rgb', 'rgba'].includes(String(name).toLowerCase()); }
function isHeightName(name) { const l = String(name ?? '').toLowerCase(); return l === 'z' || l === 'height' || l === 'elevation'; }
function isIntensityName(name) { return String(name ?? '').toLowerCase().includes('intensity'); }
function isM3C2Name(name) {
  const l = String(name ?? '').toLowerCase().replace(/[\s-]+/g, '_');
  return ['m3c2', 'm3c2_distance', 'm3c2_dist', 'distance_m3c2', 'dist_m3c2', 'm3c2_signed_distance', 'signed_m3c2_distance', 'cloudcompare_m3c2'].includes(l)
    || (l.includes('m3c2') && (l.includes('dist') || l.includes('distance')));
}
function prettyName(name) {
  if (name === SOLID_COLOR_ATTR) return 'Solid Color';
  if (isRgbAttribute(name)) return 'RGB';
  if (isHeightName(name)) return 'HEIGHT';
  if (isM3C2Name(name)) return 'M3C2 Distance';
  return String(name ?? '').replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

function interpolateHexRamp(hexStops, samples = 128) {
  const stops = hexStops.map(c => new Color(c));
  const colors = [];
  for (let i = 0; i < samples; i += 1) {
    const x = i / (samples - 1);
    const scaled = x * (stops.length - 1);
    const idx = Math.min(stops.length - 2, Math.floor(scaled));
    const t = scaled - idx;
    const a = stops[idx], b = stops[idx + 1];
    colors.push(new Color(lerp(a.r, b.r, t), lerp(a.g, b.g, t), lerp(a.b, b.b, t)));
  }
  return colors;
}
function schemeColors(name) { return interpolateHexRamp(COLOR_SCHEMES[name] ?? COLOR_SCHEMES.bcyr); }
function schemeCssGradient(name) { return `linear-gradient(90deg, ${(COLOR_SCHEMES[name] ?? COLOR_SCHEMES.bcyr).join(', ')})`; }
function makeColorMap(scheme = 'bcyr', min = 0, max = 1) { return new ColorMap({ colors: schemeColors(scheme), min, max }); }

function cloudAttribute(entry, name) { return entry?.attributesByName.get(name) ?? entry?.attributesByName.get(String(name).toLowerCase()); }
function activeAttributeNames() {
  const names = [];
  const seen = new Set();
  for (const entry of activeEntries()) {
    for (const a of entry.metadata.attributes) {
      const key = a.name.toLowerCase();
      if (!seen.has(key)) { seen.add(key); names.push(a.name); }
    }
  }
  return names;
}
function everyActiveEntryHas(attrName) {
  const active = activeEntries();
  if (active.length === 0) return false;
  if (isHeightName(attrName) || attrName === SOLID_COLOR_ATTR) return true;
  return active.every(entry => Boolean(cloudAttribute(entry, attrName)));
}
function resolveQuickAttribute(kind) {
  const names = activeAttributeNames();
  if (kind === 'rgb') {
    const rgb = names.find(isRgbAttribute) ?? names.find(n => /red|green|blue|rgba|rgb|color/i.test(n));
    return rgb && everyActiveEntryHas(rgb) ? rgb : null;
  }
  if (kind === 'z') return 'HEIGHT';
  if (kind === 'intensity') {
    const attr = names.find(isIntensityName);
    return attr && everyActiveEntryHas(attr) ? attr : null;
  }
  if (kind === 'm3c2') {
    const attr = names.find(isM3C2Name) ?? names.find(n => n.toLowerCase().includes('m3c2'));
    return attr && everyActiveEntryHas(attr) ? attr : null;
  }
  if (kind === 'solid') return activeEntries().length > 0 ? SOLID_COLOR_ATTR : null;
  return null;
}
function currentAttributeName() { return ui.attribute.value; }
function defaultSchemeForAttribute(attr) { return isIntensityName(attr) ? 'grayscale' : 'bcyr'; }
function selectedScheme() { return ui.colorScheme?.value || defaultSchemeForAttribute(currentAttributeName()); }
function numericInputValue(input) { const value = Number(input?.value); return Number.isFinite(value) ? value : null; }
function normalizedRange(min, max) {
  if (!Number.isFinite(min) || !Number.isFinite(max)) return null;
  if (min === max) return { min: min - 0.5, max: max + 0.5 };
  return { min: Math.min(min, max), max: Math.max(min, max) };
}
function metadataRange(attr, fallbackMin = 0, fallbackMax = 1) {
  const min = Number(attr?.min ?? attr?.minimum ?? attr?.stats?.min);
  const max = Number(attr?.max ?? attr?.maximum ?? attr?.stats?.max);
  if (Number.isFinite(min) && Number.isFinite(max) && min !== max) return { min, max };
  const n = String(attr?.name ?? '').toLowerCase();
  if (n.includes('intensity')) return { min: 0, max: 65535 };
  if (n.includes('classification')) return { min: 0, max: 31 };
  if (n.includes('m3c2')) return { min: -0.5, max: 0.5 };
  return { min: fallbackMin, max: fallbackMax };
}
function rangeForEntry(entry, attrName) {
  const box = entry.cloud.getBoundingBox();
  if (isHeightName(attrName)) return { min: box.min.z, max: box.max.z };
  return metadataRange(cloudAttribute(entry, attrName), 0, 1);
}
function autoColorRange(attrName) {
  if (!attrName || isRgbAttribute(attrName) || attrName === SOLID_COLOR_ATTR) return null;
  let min = Infinity, max = -Infinity;
  for (const entry of activeEntries()) {
    if (!isHeightName(attrName) && !cloudAttribute(entry, attrName)) continue;
    const r = rangeForEntry(entry, attrName);
    min = Math.min(min, r.min);
    max = Math.max(max, r.max);
  }
  return normalizedRange(min, max);
}
function effectiveColorRange(attrName) {
  const auto = autoColorRange(attrName);
  if (!auto) return null;
  return normalizedRange(numericInputValue(ui.colorMin) ?? auto.min, numericInputValue(ui.colorMax) ?? auto.max);
}

// --- Manifest -------------------------------------------------------------
// public/data/manifest.json format:
// {
//   "datasets": [{ "id": "2024-06", "label": "June 2024", "url": "..." }, ...],
//   "specimens": [{ "id": "PL-A1", "label": "Fringed Iris", "url": "..." }, ...]
// }
// "specimens" are individually-cropped point clouds (e.g. one plant from a
// map viewer's detail panel) — loaded only via ?dataset=<id>&embed=1, never
// listed in the Split View / Superimpose dropdowns, which reflect "datasets" only.
// For backward compatibility, legacy manifests are still accepted:
// - { before, after } fields (no "datasets" array) become a two-entry list.
// - a "ground" field (from the old fixed Difference-mode dataset) is folded
//   into "datasets" as a regular, selectable entry — there's no more special
//   fixed pane; ground/M3C2 data is just another dataset now.
async function discoverManifest() {
  const res = await fetch(`${import.meta.env.BASE_URL}data/manifest.json`, { cache: 'no-store' });
  if (!res.ok) throw new Error('Could not read /data/manifest.json');
  const manifest = await res.json();
  const toUrl = file => (file?.startsWith('http') || file?.startsWith('/')) ? file : `${import.meta.env.BASE_URL}data/${file}`;

  let datasets;
  if (Array.isArray(manifest.datasets)) {
    datasets = manifest.datasets
      .filter(d => d?.url)
      .map((d, i) => ({ id: String(d.id ?? `dataset-${i}`), label: String(d.label ?? d.id ?? `Dataset ${i + 1}`), url: toUrl(d.url) }));
  } else if (manifest.before || manifest.after) {
    datasets = [];
    if (manifest.before) datasets.push({ id: 'before', label: 'Before', url: toUrl(manifest.before) });
    if (manifest.after) datasets.push({ id: 'after', label: 'After', url: toUrl(manifest.after) });
  } else {
    datasets = [];
  }

  const groundUrl = typeof manifest.ground === 'string' ? manifest.ground : manifest.ground?.url;
  if (groundUrl) {
    const url = toUrl(groundUrl);
    if (!datasets.some(d => d.url === url)) {
      datasets.push({ id: 'ground', label: manifest.ground?.label ?? 'Ground / M3C2', url });
    }
  }

  const specimens = Array.isArray(manifest.specimens)
    ? manifest.specimens
        .filter(d => d?.url)
        .map((d, i) => ({ id: String(d.id ?? `specimen-${i}`), label: String(d.label ?? d.id ?? `Specimen ${i + 1}`), url: toUrl(d.url) }))
    : [];

  return { datasets, specimens };
}

// --- Entry / instance lifecycle --------------------------------------------
// `sharedInstance`, when given, attaches the new cloud to an existing Instance
// (used by the Superimpose scene so both clouds share one camera and depth
// buffer) instead of creating a new one.
async function createEntry(role, url, target, sharedInstance = null) {
  setStatus(`Loading ${role} …`);
  const source = new COPCSource({ url });
  source.addEventListener('progress', () => setStatus(`Streaming ${role} … ${Math.round(source.progress * 100)}%`));
  await source.initialize();
  const metadata = await source.getMetadata();
  let instance = sharedInstance;
  const isNewInstance = !instance;
  if (isNewInstance) {
    instance = new Instance({ target, crs: metadata.crs, backgroundColor: 0x111111 });
    instance.renderingOptions.enableEDL = ui.edl.checked;
    instance.renderingOptions.EDLRadius = 0.6;
    instance.renderingOptions.EDLStrength = 5;
    instance.view.minNearPlane = 0.01; // Giro3D defaults to 2m, which clips too aggressively when zoomed in close.
    instance.view.camera.fov = 60; // three.js/Giro3D default to 50°, which felt tight; 70° was too wide.
    instance.view.camera.updateProjectionMatrix();
    instance.renderer.localClippingEnabled = true;
  }
  const cloud = new PointCloud({ source });
  await instance.add(cloud);
  const attributesByName = new Map();
  for (const a of metadata.attributes) {
    attributesByName.set(a.name, a);
    attributesByName.set(a.name.toLowerCase(), a);
  }
  cloud.pointSize = Number(ui.pointSize.value);
  cloud.subdivisionThreshold = Number(ui.threshold.value);
  cloud.pointBudget = Number(ui.pointBudget.value) <= 0 ? null : Number(ui.pointBudget.value);
  const entry = { role, url, target, source, metadata, instance, cloud, attributesByName };
  if (isNewInstance) {
    instance.addEventListener('update-end', () => { updateStats(); updateReadout(); });
    createControls(entry);
    applyClippingToEntry(entry);
  }
  return entry;
}

function createControls(entry) {
  const camera = entry.instance.view.camera;
  const controls = new MapControls(camera, entry.instance.domElement);
  controls.mouseButtons = { LEFT: MOUSE.ROTATE, MIDDLE: MOUSE.DOLLY, RIGHT: MOUSE.PAN };
  controls.touches = { ONE: TOUCH.ROTATE, TWO: TOUCH.DOLLY_PAN }; // one finger rotates, two fingers pan (pinch still zooms).
  controls.screenSpacePanning = true; // MapControls defaults to ground-plane-locked panning; this gives traditional screen-space pan instead.
  controls.enableDamping = true;
  controls.dampingFactor = 0.25;
  controls.addEventListener('change', () => {
    updateReadout();
    syncAllFrom(entry);
    entry.instance.notifyChange(camera);
  });
  entry.instance.view.setControls(controls);
  return controls;
}
function syncCamera(from, to) {
  if (!from || !to || from === to || state.syncing) return;
  state.syncing = true;
  const srcCam = from.instance.view.camera;
  const dstCam = to.instance.view.camera;
  dstCam.position.copy(srcCam.position);
  dstCam.quaternion.copy(srcCam.quaternion);
  dstCam.up.copy(srcCam.up);
  dstCam.near = srcCam.near;
  dstCam.far = srcCam.far;
  dstCam.fov = srcCam.fov;
  dstCam.updateProjectionMatrix();
  dstCam.updateMatrixWorld();
  const sCtr = from.instance.view.controls;
  const dCtr = to.instance.view.controls;
  if (sCtr?.target && dCtr?.target) dCtr.target.copy(sCtr.target);
  to.instance.notifyChange(dstCam);
  state.syncing = false;
}
function syncAllFrom(entry) {
  for (const other of allLoadedEntries()) if (other !== entry) syncCamera(entry, other);
}
function combinedBox(list = allLoadedEntries()) {
  const box = new Box3();
  for (const entry of list) { try { box.union(entry.cloud.getBoundingBox()); } catch {} }
  return box.isEmpty() ? null : box;
}
function fitCamera(entry, box, opts = {}) {
  const center = box.getCenter(new Vector3());
  const size = box.getSize(new Vector3());
  const camera = entry.instance.view.camera;
  if (opts.oblique) {
    // used only for the specimen embed: a flatter, more distant 3/4 view
    // rather than the near-top-down default below, which reads poorly for
    // anything with vertical form when there's no orbiting comparison going on
    const radius = Math.max(size.x / Math.max(camera.aspect, 0.01), size.y, size.z) * 0.5;
    const distance = (radius / Math.tan(MathUtils.degToRad(camera.fov) / 2)) * (opts.distanceMultiplier ?? 1.7);
    const elevation = MathUtils.degToRad(opts.elevationDeg ?? 22);
    camera.position.set(
      center.x,
      center.y - distance * Math.cos(elevation),
      center.z + distance * Math.sin(elevation) + size.z * 0.3,
    );
  } else {
    const altitude = Math.max(size.x / Math.max(camera.aspect, 0.01), size.y) / Math.tan(MathUtils.degToRad(camera.fov) / 2) * 0.6;
    camera.position.set(center.x, center.y - Math.max(size.y, 1) * 0.05, box.max.z + altitude);
  }
  camera.lookAt(center);
  entry.instance.view.controls?.target?.copy(center);
  entry.instance.view.controls?.update?.();
  updateReadout();
  entry.instance.notifyChange(camera);
}

// Gentle idle spin for embedded specimen views (a static point cloud in a
// small panel reads much better turning slowly) — stops permanently the
// instant the user drags, zooms, or pans, handing control back to them.
let embedRotateRaf = null;
function stopEmbedAutoRotate() {
  if (embedRotateRaf) cancelAnimationFrame(embedRotateRaf);
  embedRotateRaf = null;
}
function startEmbedAutoRotate() {
  const entry = state.panes.left.entry ?? state.overlay.leftEntry;
  const controls = entry?.instance?.view?.controls;
  if (!entry || !controls) return;
  stopEmbedAutoRotate();
  controls.addEventListener('start', stopEmbedAutoRotate, { once: true });
  const camera = entry.instance.view.camera;
  const speed = MathUtils.degToRad(6); // radians/sec — one full turn ≈ 60s
  let last = performance.now();
  function tick(now) {
    const dt = Math.min((now - last) / 1000, 0.1);
    last = now;
    const target = controls.target;
    const offset = camera.position.clone().sub(target);
    offset.applyAxisAngle(new Vector3(0, 0, 1), speed * dt); // Z-up, matches fitCamera's convention
    camera.position.copy(target).add(offset);
    camera.lookAt(target);
    controls.update();
    entry.instance.notifyChange(camera);
    embedRotateRaf = requestAnimationFrame(tick);
  }
  embedRotateRaf = requestAnimationFrame(tick);
}

// The Specimen/Site toggle always swaps to this one fixed dataset — the
// latest full-resolution site scan — regardless of which specimen is open.
const ENV_DATASET_ID = 'after_FullRes';
let embedViewMode = 'specimen'; // 'specimen' | 'site'

function updateEmbedToggleUI() {
  if (!ui.embedToggle) return;
  ui.embedToggle.querySelectorAll('button').forEach(btn => {
    btn.setAttribute('aria-pressed', String(btn.dataset.view === embedViewMode));
  });
  if (ui.goTo3DBtn) ui.goTo3DBtn.hidden = embedViewMode !== 'site';
}

// Shared by both the initial specimen load and the Specimen/Site toggle —
// loads one dataset into the embed's single pane, forces true RGB coloring
// (superimpose mode otherwise defaults to a red/blue split meant for two
// datasets), positions the camera, and restarts the idle auto-rotate.
// keepCamera reuses the exact camera position/target from whatever was
// showing before the switch (both datasets share the same real-world
// coordinates, so this keeps the specimen framed the same way inside the
// full scan as it was in isolation) instead of re-fitting to the new
// dataset's own bounding box.
async function loadEmbedPane(datasetId, { oblique = false, keepCamera = false } = {}) {
  const prevEntry = state.overlay.leftEntry ?? state.overlay.rightEntry ?? state.panes.left.entry;
  const snapshot = keepCamera ? captureCameraSnapshot(prevEntry) : null;
  document.body.classList.remove('embed-loaded');
  await selectPane('left', datasetId);
  document.body.classList.add('embed-loaded');
  await applyMode('superimpose');
  state.attributeUserSet = true;
  const rgb = resolveQuickAttribute('rgb');
  if (rgb) { ui.attribute.value = rgb; updateAttribute(); }
  const overlayEntry = state.overlay.leftEntry ?? state.overlay.rightEntry;
  if (overlayEntry) {
    if (snapshot) applyCameraSnapshot(overlayEntry, snapshot);
    else fitCamera(overlayEntry, overlayEntry.cloud.getBoundingBox(), { oblique });
  }
  startEmbedAutoRotate();
  updateEmbedToggleUI();
}

function captureCameraSnapshot(entry) {
  if (!entry) return null;
  const camera = entry.instance.view.camera;
  const target = entry.instance.view.controls?.target;
  return {
    position: camera.position.clone(),
    quaternion: camera.quaternion.clone(),
    up: camera.up.clone(),
    near: camera.near,
    far: camera.far,
    fov: camera.fov,
    target: target ? target.clone() : null,
  };
}
function applyCameraSnapshot(entry, snapshot) {
  if (!entry || !snapshot) return;
  const camera = entry.instance.view.camera;
  camera.position.copy(snapshot.position);
  camera.quaternion.copy(snapshot.quaternion);
  camera.up.copy(snapshot.up);
  if (snapshot.near != null) camera.near = snapshot.near;
  if (snapshot.far != null) camera.far = snapshot.far;
  if (snapshot.fov != null) camera.fov = snapshot.fov;
  camera.updateProjectionMatrix();
  camera.updateMatrixWorld();
  if (snapshot.target && entry.instance.view.controls?.target) {
    entry.instance.view.controls.target.copy(snapshot.target);
    entry.instance.view.controls.update?.();
  }
  updateReadout();
  entry.instance.notifyChange(camera);
}
function resetAll() {
  try { localStorage.removeItem(STORAGE_KEY); } catch { /* not critical */ }
  location.reload();
}
let orbitTargetAnimation = null;
function setOrbitTargetOn(entry, point, duration = 420) {
  if (!entry || !point) return;
  const camera = entry.instance.view.camera;
  const controls = entry.instance.view.controls;
  if (!controls?.target) return;
  if (orbitTargetAnimation) cancelAnimationFrame(orbitTargetAnimation.raf);
  const startTarget = controls.target.clone();
  const startPos = camera.position.clone();
  const delta = point.clone().sub(startTarget);
  const endTarget = point.clone();
  const endPos = startPos.clone().add(delta);
  const startTime = performance.now();
  const easeInOutQuad = t => (t < 0.5 ? 2 * t * t : 1 - ((-2 * t + 2) ** 2) / 2);
  const anim = { raf: null };
  orbitTargetAnimation = anim;
  const tick = now => {
    const t = Math.min((now - startTime) / duration, 1);
    const e = easeInOutQuad(t);
    camera.position.lerpVectors(startPos, endPos, e);
    controls.target.lerpVectors(startTarget, endTarget, e);
    controls.update?.();
    syncAllFrom(entry);
    updateReadout();
    entry.instance.notifyChange(camera);
    if (t < 1) anim.raf = requestAnimationFrame(tick);
    else if (orbitTargetAnimation === anim) orbitTargetAnimation = null;
  };
  anim.raf = requestAnimationFrame(tick);
}

// --- Dataset selection (left/right panes, shared by both modes) ------------
function populateDatasetSelects() {
  const optionsHtml = `<option value="">None</option>` + state.datasets.map(d => `<option value="${escapeHtml(d.id)}">${escapeHtml(d.label)}</option>`).join('');
  ui.leftSelect.innerHTML = optionsHtml;
  ui.rightSelect.innerHTML = optionsHtml;
  ui.leftSelect.value = state.panes.left.datasetId;
  ui.rightSelect.value = state.panes.right.datasetId;
  syncSelectDisabledOptions();
}
function syncSelectDisabledOptions() {
  for (const opt of ui.leftSelect.options) opt.disabled = Boolean(opt.value) && opt.value === state.panes.right.datasetId;
  for (const opt of ui.rightSelect.options) opt.disabled = Boolean(opt.value) && opt.value === state.panes.left.datasetId;
}

async function selectPane(role, datasetId) {
  const pane = state.panes[role];
  if (pane.datasetId === datasetId) return;
  const select = role === 'left' ? ui.leftSelect : role === 'right' ? ui.rightSelect : null;
  const cameraSnapshot = captureCameraSnapshot(pane.entry);
  if (pane.entry) {
    pane.entry.instance.dispose();
    pane.target.innerHTML = '';
    pane.entry = null;
  }
  pane.datasetId = datasetId;
  if (select) select.value = datasetId;
  syncSelectDisabledOptions();
  if (datasetId) {
    const ds = state.datasets.find(d => d.id === datasetId);
    if (ds) {
      try {
        const entry = await createEntry(role, ds.url, pane.target);
        if (state.panes[role].datasetId !== datasetId) {
          // Selection changed again while this cloud was still loading.
          entry.instance.dispose();
        } else {
          pane.entry = entry;
          const others = [state.panes.left.entry, state.panes.right.entry].filter(e => e && e !== entry);
          if (others.length > 0) syncCamera(others[0], entry);
          else if (cameraSnapshot) applyCameraSnapshot(entry, cameraSnapshot);
          else fitCamera(entry, entry.cloud.getBoundingBox());
          setStatus(`Loaded ${ds.label}.`);
        }
      } catch (error) {
        console.error(error);
        setStatus(error?.message ?? String(error), true);
      }
    }
  }
  await afterPaneChange();
}
function applyDefaultAttributeIfNeeded() {
  if (state.attributeUserSet) return;
  if (state.mode === 'superimpose') {
    const solid = resolveQuickAttribute('solid');
    if (solid) { ui.attribute.value = solid; return; }
  }
  const rgb = resolveQuickAttribute('rgb');
  if (rgb) ui.attribute.value = rgb;
}
async function afterPaneChange() {
  if (state.mode === 'superimpose') await ensureOverlaySynced();
  rebuildAttributeOptions(true);
  applyDefaultAttributeIfNeeded();
  updateSplitUI();
  updateAttribute();
  updateLegend();
  updateFilter();
  updateStats();
  updateClipRangeUI();
  saveState();
}

// --- Superimpose scene (both selected datasets sharing one 3D scene) -------
async function ensureOverlaySynced() {
  const wantLeft = state.panes.left.datasetId;
  const wantRight = state.panes.right.datasetId;
  if (state.overlay.leftDatasetId === wantLeft && state.overlay.rightDatasetId === wantRight) return;

  const cameraSnapshot = captureCameraSnapshot(
    state.overlay.leftEntry ?? state.overlay.rightEntry ?? state.panes.left.entry ?? state.panes.right.entry,
  );

  if (state.overlay.instance) {
    state.overlay.instance.dispose();
    state.overlay.target.innerHTML = '';
  }
  state.overlay.instance = null;
  state.overlay.leftEntry = null;
  state.overlay.rightEntry = null;
  state.overlay.leftDatasetId = wantLeft;
  state.overlay.rightDatasetId = wantRight;

  const leftDs = state.datasets.find(d => d.id === wantLeft);
  const rightDs = state.datasets.find(d => d.id === wantRight);
  if (!leftDs && !rightDs) return;

  try {
    setStatus('Loading superimpose view …');
    if (leftDs) {
      const entry = await createEntry('left', leftDs.url, state.overlay.target);
      state.overlay.instance = entry.instance;
      state.overlay.leftEntry = entry;
    }
    if (rightDs) {
      const entry = await createEntry('right', rightDs.url, state.overlay.target, state.overlay.instance);
      state.overlay.instance = entry.instance;
      state.overlay.rightEntry = entry;
    }
    const primary = state.overlay.leftEntry ?? state.overlay.rightEntry;
    if (cameraSnapshot && primary) {
      applyCameraSnapshot(primary, cameraSnapshot);
    } else {
      const box = combinedBox([state.overlay.leftEntry, state.overlay.rightEntry].filter(Boolean));
      if (box && primary) fitCamera(primary, box);
    }
    setStatus('Loaded superimpose view.');
  } catch (error) {
    console.error(error);
    setStatus(error?.message ?? String(error), true);
  }
  updateStats();
  updateClipRangeUI();
}

function rebuildAttributeOptions(preserve = true) {
  const previous = (preserve && state.attributeUserSet) ? currentAttributeName() : null;
  const names = activeAttributeNames();
  const ordered = [];
  const push = v => { if (v && !ordered.includes(v) && (isHeightName(v) || everyActiveEntryHas(v))) ordered.push(v); };
  push(resolveQuickAttribute('rgb'));
  push(resolveQuickAttribute('solid'));
  push('HEIGHT');
  push(resolveQuickAttribute('intensity'));
  push(resolveQuickAttribute('m3c2'));
  names.forEach(push);
  ui.attribute.innerHTML = ordered.map(n => `<option value="${n}">${prettyName(n)}</option>`).join('');
  if (previous && ordered.includes(previous)) ui.attribute.value = previous;
  else ui.attribute.value = resolveQuickAttribute('rgb') ?? 'HEIGHT';
  rebuildFilterAttributeOptions();
  ui.colorScheme.value = defaultSchemeForAttribute(currentAttributeName());
  updateQuickButtons();
}
function rebuildFilterAttributeOptions() {
  const previous = ui.filterAttribute.value;
  const opts = [
    ['HEIGHT', 'HEIGHT'],
    [resolveQuickAttribute('intensity'), 'Intensity'],
    [resolveQuickAttribute('m3c2'), 'M3C2 Distance'],
  ].filter(([v]) => Boolean(v));
  ui.filterAttribute.innerHTML = opts.map(([v, label]) => `<option value="${v}">${label}</option>`).join('');
  if (opts.some(([v]) => v === previous)) ui.filterAttribute.value = previous;
  ui.filterAttribute.disabled = opts.length === 0;
  ui.filtersEnabled.disabled = opts.length === 0;
  if (opts.length > 0) updateFilterRangePlaceholder();
}
function updateQuickButtons() {
  ui.attributeQuick.querySelectorAll('button').forEach(button => {
    const attr = resolveQuickAttribute(button.dataset.attr);
    button.disabled = !attr;
    button.title = attr ? '' : 'This attribute is not available for the active cloud(s).';
    button.setAttribute('aria-pressed', String(Boolean(attr && attr === currentAttributeName())));
  });
}

function applyColorToEntry(entry, attrName, scheme, range) {
  if (!entry) return;
  if (attrName === SOLID_COLOR_ATTR) {
    const hex = entry.role === 'right' ? state.solidColors.right : state.solidColors.left;
    entry.cloud.elevationColorMap = new ColorMap({ colors: [new Color(hex), new Color(hex)], min: 0, max: 1 });
    entry.cloud.setActiveAttributes([]);
    entry.cloud.setColoringMode('attribute');
    return;
  }
  if (isRgbAttribute(attrName)) {
    entry.cloud.setColoringMode('attribute');
    entry.cloud.setActiveAttribute(attrName);
    return;
  }
  if (isHeightName(attrName)) {
    entry.cloud.elevationColorMap = makeColorMap(scheme, range.min, range.max);
    entry.cloud.setActiveAttributes([]);
    entry.cloud.setColoringMode('attribute'); // attribute mode with no active attribute means elevation mode in Giro3D.
    return;
  }
  if (!cloudAttribute(entry, attrName)) return;
  entry.cloud.setAttributeColorMap(attrName, makeColorMap(scheme, range.min, range.max));
  entry.cloud.setColoringMode('attribute');
  entry.cloud.setActiveAttribute(attrName);
}
function updateAttribute(notify = true) {
  let attr = currentAttributeName();
  if (!attr || (!isHeightName(attr) && !isRgbAttribute(attr) && attr !== SOLID_COLOR_ATTR && !everyActiveEntryHas(attr))) {
    const fallback = resolveQuickAttribute('rgb') ?? 'HEIGHT';
    if (ui.attribute.querySelector(`option[value="${fallback}"]`)) ui.attribute.value = fallback;
    attr = currentAttributeName();
  }
  const scheme = selectedScheme();
  const range = effectiveColorRange(attr);
  for (const entry of allLoadedEntries()) {
    if (attr === SOLID_COLOR_ATTR || isRgbAttribute(attr)) applyColorToEntry(entry, attr, scheme, null);
    else if (range) applyColorToEntry(entry, attr, scheme, range);
  }
  ui.solidColorRow.hidden = attr !== SOLID_COLOR_ATTR;
  if (attr === SOLID_COLOR_ATTR) ui.edl.checked = true;
  else if (isRgbAttribute(attr)) ui.edl.checked = false;
  allLoadedEntries().forEach(e => { e.instance.renderingOptions.enableEDL = ui.edl.checked; });
  updateQuickButtons();
  updateLegend();
  if (notify) allLoadedEntries().forEach(e => e.instance.notifyChange(e.cloud));
}
function updateColorClampPlaceholders() {
  const r = autoColorRange(currentAttributeName());
  ui.colorMin.placeholder = r ? `auto ${formatScalar(r.min)}` : 'auto';
  ui.colorMax.placeholder = r ? `auto ${formatScalar(r.max)}` : 'auto';
}
function updateLegend() {
  const attr = currentAttributeName();
  updateColorClampPlaceholders();
  if (!attr || isRgbAttribute(attr) || attr === SOLID_COLOR_ATTR) { ui.legend.hidden = true; return; }
  const range = effectiveColorRange(attr);
  if (!range) { ui.legend.hidden = true; return; }
  ui.legend.hidden = false;
  ui.legendTitle.textContent = prettyName(attr);
  ui.legendBar.style.background = schemeCssGradient(selectedScheme());
  if (isHeightName(attr)) {
    ui.legendMin.textContent = `min height ${formatScalar(range.min)} m`;
    ui.legendMid.textContent = '';
    ui.legendMax.textContent = `max height ${formatScalar(range.max)} m`;
  } else {
    ui.legendMin.textContent = formatScalar(range.min);
    ui.legendMid.textContent = formatScalar((range.min + range.max) / 2);
    ui.legendMax.textContent = formatScalar(range.max);
  }
}
function updateFilter() {
  const enabled = ui.filtersEnabled.checked;
  const attr = ui.filterAttribute.value;
  const height = isHeightName(attr);
  const dimension = height ? 'Z' : attr; // 'Z' is the real LAS/COPC dimension name; HEIGHT is just our display alias for it.
  const lo = Math.min(Number(ui.filterMin.value), Number(ui.filterMax.value));
  const hi = Math.max(Number(ui.filterMin.value), Number(ui.filterMax.value));
  for (const entry of allLoadedEntries()) {
    if (!enabled || (!height && !cloudAttribute(entry, attr)) || !Number.isFinite(lo) || !Number.isFinite(hi)) {
      entry.source.filters = null;
    } else {
      entry.source.filters = [
        { dimension, operator: 'greaterequal', value: lo },
        { dimension, operator: 'lessequal', value: hi },
      ];
    }
    entry.instance.notifyChange(entry.cloud);
  }
}
function activeClipPlanes() {
  const planes = [];
  if (state.clip.horizontalEnabled && Number.isFinite(state.clip.horizontal)) {
    const keepAbove = !state.clip.horizontalFlip;
    const normal = new Vector3(0, 0, keepAbove ? 1 : -1);
    const constant = keepAbove ? -state.clip.horizontal : state.clip.horizontal;
    planes.push(new Plane(normal, constant));
  }
  if (state.clip.verticalEnabled && Number.isFinite(state.clip.vertical) && state.clip.verticalCenter) {
    const rad = MathUtils.degToRad(state.clip.verticalAngleDeg);
    const baseNormal = new Vector3(Math.cos(rad), Math.sin(rad), 0);
    const planePoint = state.clip.verticalCenter.clone().addScaledVector(baseNormal, state.clip.vertical);
    const normal = state.clip.verticalFlip ? baseNormal.clone().negate() : baseNormal;
    const constant = -normal.dot(planePoint);
    planes.push(new Plane(normal, constant));
  }
  return planes;
}
function applyClippingToEntry(entry) {
  if (!entry) return;
  entry.instance.renderer.clippingPlanes = activeClipPlanes();
  entry.instance.notifyChange(entry.cloud);
}
function applyClipping() {
  const instances = new Set(allLoadedEntries().map(e => e.instance));
  const planes = activeClipPlanes();
  instances.forEach(instance => { instance.renderer.clippingPlanes = planes; instance.notifyChange(); });
}
function updateClipRangeUI() {
  const box = combinedBox(activeEntries());
  const ready = Boolean(box);
  [ui.clipHorizontal, ui.clipHorizontalNum, ui.clipHorizontalEnabled, ui.clipHorizontalFlip, ui.clipVertical, ui.clipVerticalNum, ui.clipVerticalAngle, ui.clipVerticalAngleNum, ui.clipVerticalEnabled, ui.clipVerticalFlip].forEach(el => { el.disabled = !ready; });
  if (!ready) {
    ui.clipHorizontalValue.textContent = '—';
    ui.clipVerticalValue.textContent = '—';
    return;
  }
  const zMin = box.min.z, zMax = box.max.z;
  ui.clipHorizontal.min = zMin;
  ui.clipHorizontal.max = zMax;
  ui.clipHorizontal.step = Math.max((zMax - zMin) / 500, 0.001);
  ui.clipHorizontalNum.min = zMin;
  ui.clipHorizontalNum.max = zMax;
  if (state.clip.horizontal === null || state.clip.horizontal < zMin || state.clip.horizontal > zMax) {
    state.clip.horizontal = (zMin + zMax) / 2;
  }
  ui.clipHorizontal.value = state.clip.horizontal;
  ui.clipHorizontalNum.value = round(state.clip.horizontal, 3);
  ui.clipHorizontalValue.textContent = `height ${formatScalar(state.clip.horizontal)} m (range ${formatScalar(zMin)} – ${formatScalar(zMax)} m)`;

  state.clip.verticalCenter = box.getCenter(new Vector3());
  const halfDiagonal = Math.max(Math.hypot(box.max.x - box.min.x, box.max.y - box.min.y) / 2, 0.5);
  ui.clipVertical.min = -halfDiagonal;
  ui.clipVertical.max = halfDiagonal;
  ui.clipVertical.step = Math.max(halfDiagonal / 500, 0.001);
  ui.clipVerticalNum.min = -halfDiagonal;
  ui.clipVerticalNum.max = halfDiagonal;
  if (state.clip.vertical === null || state.clip.vertical < -halfDiagonal || state.clip.vertical > halfDiagonal) {
    state.clip.vertical = 0;
  }
  ui.clipVertical.value = state.clip.vertical;
  ui.clipVerticalNum.value = round(state.clip.vertical, 3);
  ui.clipVerticalAngle.value = state.clip.verticalAngleDeg;
  ui.clipVerticalAngleNum.value = state.clip.verticalAngleDeg;
  ui.clipVerticalValue.textContent = `${state.clip.verticalAngleDeg}° · offset ${formatScalar(state.clip.vertical)} m (± ${formatScalar(halfDiagonal)} m)`;
}
function updateFilterRangePlaceholder() {
  const attr = ui.filterAttribute.value;
  if (!attr) return;
  let min = Infinity, max = -Infinity;
  for (const entry of allLoadedEntries()) {
    if (!isHeightName(attr) && !cloudAttribute(entry, attr)) continue;
    const r = rangeForEntry(entry, attr);
    min = Math.min(min, r.min);
    max = Math.max(max, r.max);
  }
  const range = normalizedRange(min, max);
  if (!range) return;
  ui.filterMin.value = String(Math.floor(range.min));
  ui.filterMax.value = String(Math.ceil(range.max));
}
function updateStats() {
  const loaded = allLoadedEntries();
  const total = loaded.reduce((s, e) => s + (Number(e.cloud.pointCount) || 0), 0);
  const displayed = loaded.reduce((s, e) => s + (Number(e.cloud.displayedPointCount) || 0), 0);
  ui.total.textContent = formatCount(total);
  ui.displayed.textContent = formatCount(displayed);
}
function updateReadout() {
  if (ui.readout) {
    const entry = activeEntries()[0] ?? null;
    if (!entry) {
      ui.readout.textContent = 'cam —';
    } else {
      const camera = entry.instance.view.camera;
      const target = entry.instance.view.controls?.target ?? combinedBox()?.getCenter(new Vector3()) ?? new Vector3();
      const v = camera.position.clone().sub(target);
      const d = v.length();
      const az = MathUtils.radToDeg(Math.atan2(v.x, v.y));
      const el = MathUtils.radToDeg(Math.asin(v.z / Math.max(d, 1e-6)));
      ui.readout.textContent = `cam az ${az.toFixed(0)}° el ${el.toFixed(0)}° d ${d.toFixed(1)}m`;
    }
  }
  scheduleCameraSave();
}
function updateSplitUI() {
  const left = state.panes.left.entry;
  const right = state.panes.right.entry;
  const both = Boolean(left) && Boolean(right);
  ui.splitDivider.classList.toggle('active', state.mode === 'split' && both);
  ui.splitLabels.classList.add('active');
  ui.splitDivider.style.left = `${state.split}%`;
  if (both) {
    ui.viewBefore.style.clipPath = `inset(0 ${100 - state.split}% 0 0)`;
    ui.viewAfter.style.clipPath = `inset(0 0 0 ${state.split}%)`;
  } else if (left) {
    ui.viewBefore.style.clipPath = 'inset(0 0 0 0)';
    ui.viewAfter.style.clipPath = 'inset(0 0 0 100%)';
  } else if (right) {
    ui.viewAfter.style.clipPath = 'inset(0 0 0 0)';
    ui.viewBefore.style.clipPath = 'inset(0 0 0 100%)';
  } else {
    ui.viewBefore.style.clipPath = 'inset(0 0 0 100%)';
    ui.viewAfter.style.clipPath = 'inset(0 0 0 100%)';
  }
  ui.compareHint.hidden = !(state.mode === 'split' && !left && !right);
}
async function applyMode(mode) {
  state.mode = mode;
  ui.modeButtons.querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.mode === mode)));
  ui.compareViews.classList.toggle('active', mode === 'split');
  ui.viewOverlay.classList.toggle('active', mode === 'superimpose');
  updateSplitUI();
  if (mode === 'superimpose') {
    await ensureOverlaySynced();
    updateSplitUI();
    rebuildAttributeOptions(true);
    applyDefaultAttributeIfNeeded();
  } else {
    rebuildAttributeOptions(true);
  }
  updateAttribute();
  updateLegend();
  updateFilter();
  updateClipRangeUI();
  saveState();
}
// Remembers dataset selection, mode, color attribute, clip planes, and
// display/filter settings across reloads, so returning to the page doesn't
// mean re-picking everything (and re-streaming large datasets) from scratch.
const STORAGE_KEY = 'copc-viewer-state-v1';
function serializeCameraSnapshot(entry) {
  const snap = captureCameraSnapshot(entry);
  if (!snap) return null;
  return {
    position: { x: snap.position.x, y: snap.position.y, z: snap.position.z },
    quaternion: { x: snap.quaternion.x, y: snap.quaternion.y, z: snap.quaternion.z, w: snap.quaternion.w },
    up: { x: snap.up.x, y: snap.up.y, z: snap.up.z },
    target: snap.target ? { x: snap.target.x, y: snap.target.y, z: snap.target.z } : null,
  };
}
let cameraSaveTimer = null;
function scheduleCameraSave() {
  clearTimeout(cameraSaveTimer);
  cameraSaveTimer = setTimeout(saveState, 400);
}
function buildStateSnapshot() {
  return {
    left: state.panes.left.datasetId,
    right: state.panes.right.datasetId,
    mode: state.mode,
    attributeUserSet: state.attributeUserSet,
    attribute: state.attributeUserSet ? ui.attribute.value : null,
    colorScheme: ui.colorScheme.value,
    colorMin: ui.colorMin.value,
    colorMax: ui.colorMax.value,
    solidColors: state.solidColors,
    edl: ui.edl.checked,
    pointSize: ui.pointSize.value,
    threshold: ui.threshold.value,
    pointBudget: ui.pointBudget.value,
    filtersEnabled: ui.filtersEnabled.checked,
    filterAttribute: ui.filterAttribute.value,
    filterMin: ui.filterMin.value,
    filterMax: ui.filterMax.value,
    clip: {
      horizontalEnabled: state.clip.horizontalEnabled,
      horizontal: state.clip.horizontal,
      horizontalFlip: state.clip.horizontalFlip,
      verticalEnabled: state.clip.verticalEnabled,
      verticalAngleDeg: state.clip.verticalAngleDeg,
      vertical: state.clip.vertical,
      verticalFlip: state.clip.verticalFlip,
    },
    camera: serializeCameraSnapshot(activeEntries()[0] ?? allLoadedEntries()[0] ?? null),
  };
}
function saveState() {
  if (specimenParams) return; // embed sessions are ephemeral — never leak into the shared saved state
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(buildStateSnapshot()));
  } catch { /* localStorage unavailable (private browsing, quota, etc.) — not critical. */ }
}
function loadSavedState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}
// --- Shareable link (URL hash) ---------------------------------------------
// Encodes the same snapshot used for localStorage into a compact, URL-safe
// base64 string in the hash fragment (never sent to any server — this is a
// static site). A link with #state=... takes priority over localStorage for
// that one page load, then the hash is cleared so later changes don't get
// silently attributed to a stale shared link.
function toBase64Url(obj) {
  const bytes = new TextEncoder().encode(JSON.stringify(obj));
  let binary = '';
  bytes.forEach(b => { binary += String.fromCharCode(b); });
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function fromBase64Url(str) {
  const base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(base64);
  const bytes = Uint8Array.from(binary, c => c.charCodeAt(0));
  return JSON.parse(new TextDecoder().decode(bytes));
}
function buildShareUrl() {
  const encoded = toBase64Url(buildStateSnapshot());
  const url = new URL(location.href);
  url.hash = `state=${encoded}`;
  return url.toString();
}
// Only the camera position/target hands off — the full share-state snapshot
// would also carry over the specimen's specific dataset, colors, and clip
// settings, making the page load in a very particular configuration instead
// of its normal defaults. Targets the campus-garden site's own 3D tab
// (not the bare standalone viewer page) so the person keeps their bearings
// via the site's normal navigation, with the state passed through as a
// query param that the site's router forwards into this same iframe.
function buildGoTo3DPageUrl() {
  const overlayEntry = state.overlay.leftEntry ?? state.overlay.rightEntry ?? state.panes.left.entry;
  const camera = serializeCameraSnapshot(overlayEntry);
  const encoded = toBase64Url({ camera });
  const url = new URL('../index.html', location.href);
  url.searchParams.set('view', 'viewer');
  url.searchParams.set('state', encoded);
  return url.toString();
}
function readStateFromUrlHash() {
  const match = /(?:^|[#&])state=([^&]+)/.exec(location.hash);
  if (!match) return null;
  try {
    return fromBase64Url(decodeURIComponent(match[1]));
  } catch (error) {
    console.warn('Could not parse shared view link', error);
    return null;
  }
}
// Settings that affect newly-created point clouds must be restored BEFORE any
// selectPane() call, since createEntry() reads these ui values at load time.
function applySavedUiValuesBeforeLoad(saved) {
  if (!saved) return;
  if (saved.edl != null) ui.edl.checked = Boolean(saved.edl);
  if (saved.pointSize != null) {
    ui.pointSize.value = saved.pointSize;
    ui.pointSizeLabel.textContent = `Point size: ${Number(saved.pointSize) === 0 ? 'auto' : saved.pointSize}`;
  }
  if (saved.threshold != null) {
    ui.threshold.value = saved.threshold;
    ui.budgetLabel.textContent = `LOD threshold: ${Number(saved.threshold) === 0 ? '0 / maximum detail' : saved.threshold}`;
  }
  if (saved.pointBudget != null) {
    ui.pointBudget.value = saved.pointBudget;
    const budgetNum = Number(saved.pointBudget);
    ui.pointBudgetLabel.textContent = budgetNum <= 0 ? 'Point budget: unlimited' : `Point budget: ${formatCount(budgetNum)}`;
  }
  if (saved.filtersEnabled != null) ui.filtersEnabled.checked = Boolean(saved.filtersEnabled);
  if (saved.filterMin != null) ui.filterMin.value = saved.filterMin;
  if (saved.filterMax != null) ui.filterMax.value = saved.filterMax;
  if (saved.solidColors) {
    state.solidColors = {
      left: saved.solidColors.left || state.solidColors.left,
      right: saved.solidColors.right || state.solidColors.right,
    };
    ui.solidColorLeft.value = state.solidColors.left;
    ui.solidColorRight.value = state.solidColors.right;
  }
  if (saved.clip) {
    state.clip.horizontalEnabled = Boolean(saved.clip.horizontalEnabled);
    state.clip.horizontal = Number.isFinite(saved.clip.horizontal) ? saved.clip.horizontal : null;
    state.clip.horizontalFlip = saved.clip.horizontalFlip !== undefined ? Boolean(saved.clip.horizontalFlip) : true;
    state.clip.verticalEnabled = Boolean(saved.clip.verticalEnabled);
    state.clip.verticalAngleDeg = Number.isFinite(saved.clip.verticalAngleDeg) ? saved.clip.verticalAngleDeg : 90;
    state.clip.vertical = Number.isFinite(saved.clip.vertical) ? saved.clip.vertical : null;
    state.clip.verticalFlip = Boolean(saved.clip.verticalFlip);
    ui.clipHorizontalEnabled.checked = state.clip.horizontalEnabled;
    ui.clipHorizontalFlip.checked = state.clip.horizontalFlip;
    ui.clipVerticalEnabled.checked = state.clip.verticalEnabled;
    ui.clipVerticalFlip.checked = state.clip.verticalFlip;
  }
}
// Attribute/filter-attribute choices depend on dropdowns that are only
// populated once datasets are actually loaded, so these are re-applied after.
function applySavedChoicesAfterLoad(saved) {
  if (!saved) return;
  if (saved.filterAttribute && ui.filterAttribute.querySelector(`option[value="${CSS.escape(saved.filterAttribute)}"]`)) {
    ui.filterAttribute.value = saved.filterAttribute;
  }
  if (saved.attributeUserSet && saved.attribute) {
    state.attributeUserSet = true;
    if (ui.attribute.querySelector(`option[value="${CSS.escape(saved.attribute)}"]`)) {
      ui.attribute.value = saved.attribute;
    }
  }
  if (saved.colorScheme) ui.colorScheme.value = saved.colorScheme;
  if (saved.colorMin != null) ui.colorMin.value = saved.colorMin;
  if (saved.colorMax != null) ui.colorMax.value = saved.colorMax;
}

// A specimen link (?dataset=<id>&embed=1) loads exactly one point cloud from
// manifest.json's "specimens" array — used by embeds that show a single
// cropped export (e.g. a map viewer's detail panel) without that specimen
// ever appearing in the normal Split View / Superimpose dropdowns, which
// only ever reflect "datasets".
function readSpecimenParams() {
  const params = new URLSearchParams(location.search);
  const id = params.get('dataset');
  if (!id) return null;
  return { id, embed: params.get('embed') === '1' };
}
const specimenParams = readSpecimenParams();
if (specimenParams) document.body.classList.add('embed-mode');

async function init() {
  try {
    setStatus('Reading manifest …');
    const instances = new Set(allLoadedEntries().map(e => e.instance));
    instances.forEach(i => i.dispose());
    for (const pane of [state.panes.left, state.panes.right]) { pane.entry = null; pane.datasetId = ''; pane.target.innerHTML = ''; }
    state.overlay.instance = null;
    state.overlay.leftEntry = null;
    state.overlay.rightEntry = null;
    state.overlay.leftDatasetId = '';
    state.overlay.rightDatasetId = '';
    state.overlay.target.innerHTML = '';
    const manifest = await discoverManifest();
    state.datasets = manifest.datasets;
    state.specimens = manifest.specimens;
    populateDatasetSelects();

    if (specimenParams) {
      const specimen = state.specimens.find(s => s.id === specimenParams.id);
      if (!specimen) {
        document.body.classList.add('embed-loaded');
        setStatus(`Specimen "${specimenParams.id}" not found in manifest.json.`, true);
        return;
      }
      // Registered after populateDatasetSelects() so selectPane() can resolve
      // it, but it never appears as an option in the dropdowns themselves.
      state.datasets.push(specimen);
      setStatus(`Loaded ${specimen.label}.`);
      await loadEmbedPane(specimen.id, { oblique: true });

      // "Site" toggle: only offered when the fixed environment dataset (the
      // latest full-resolution scan) is actually present in this manifest.
      const hasEnv = state.datasets.some(d => d.id === ENV_DATASET_ID);
      if (hasEnv && ui.embedToggle) {
        ui.embedToggle.hidden = false;
        ui.embedToggle.querySelectorAll('button').forEach(btn => {
          btn.addEventListener('click', async () => {
            if (btn.dataset.view === embedViewMode) return;
            embedViewMode = btn.dataset.view;
            updateEmbedToggleUI();
            if (embedViewMode === 'site') {
              // both datasets share the same real-world coordinates, so keep
              // the exact camera position/target when moving out to the full
              // scan — the specimen should sit at the same spot in both
              await loadEmbedPane(ENV_DATASET_ID, { keepCamera: true });
            } else {
              // returning to the isolated specimen always resets to its
              // default framing, rather than keeping wherever the camera
              // ended up out in the site view
              await loadEmbedPane(specimen.id, { oblique: true });
            }
          });
        });
      }
      return;
    }

    const sharedState = readStateFromUrlHash();
    const saved = sharedState ?? loadSavedState();
    if (sharedState) {
      history.replaceState(null, '', location.pathname + location.search);
    }
    applySavedUiValuesBeforeLoad(saved);

    const validSaved = id => id && state.datasets.some(d => d.id === id);
    const leftId = validSaved(saved?.left) ? saved.left : state.datasets[0]?.id;
    const rightId = validSaved(saved?.right) && saved.right !== leftId ? saved.right : (state.datasets[1]?.id !== leftId ? state.datasets[1]?.id : undefined);
    if (leftId) await selectPane('left', leftId);
    if (rightId) await selectPane('right', rightId);

    await applyMode(saved?.mode === 'superimpose' ? 'superimpose' : 'split');

    applySavedChoicesAfterLoad(saved);
    updateAttribute();
    updateFilter();
    updateClipRangeUI();
    applyClipping();
    if (saved?.camera) {
      for (const entry of allLoadedEntries()) applyCameraSnapshot(entry, saved.camera);
    }

    setStatus(state.datasets.length ? 'Ready.' : 'No datasets found in manifest.json.', state.datasets.length === 0);
  } catch (error) {
    console.error(error);
    setStatus(error?.message ?? String(error), true);
  }
}

async function pickPoint(event) {
  try {
    if (state.mode === 'superimpose') {
      const entries = [state.overlay.leftEntry, state.overlay.rightEntry].filter(Boolean);
      if (entries.length === 0 || !state.overlay.instance) return;
      const results = state.overlay.instance.pickObjectsAt(event, { where: entries.map(e => e.cloud), radius: 8, limit: 1, sortByDistance: true, gpuPicking: true });
      const hit = results?.find(r => r?.point);
      if (hit?.point) setOrbitTargetOn(entries[0], hit.point);
      return;
    }
    const entry = interactiveEntryForEvent(event);
    if (!entry) return;
    const results = entry.instance.pickObjectsAt(event, { where: [entry.cloud], radius: 8, limit: 1, sortByDistance: true, gpuPicking: true });
    const hit = results?.find(r => r?.point);
    if (hit?.point) setOrbitTargetOn(entry, hit.point);
  } catch (err) { console.warn('Point picking failed', err); }
}

ui.optionsToggle.addEventListener('click', () => { ui.panel.hidden = false; });
ui.closePanel.addEventListener('click', () => { ui.panel.hidden = true; });
ui.clipToggle.addEventListener('click', () => {
  ui.clipPanel.hidden = false;
  ui.clipToggle.setAttribute('aria-expanded', 'true');
});
ui.closeClipPanel.addEventListener('click', () => {
  ui.clipPanel.hidden = true;
  ui.clipToggle.setAttribute('aria-expanded', 'false');
});
ui.reload.addEventListener('click', init);
ui.resetCamera.addEventListener('click', resetAll);
ui.modeButtons.querySelectorAll('button').forEach(b => b.addEventListener('click', () => { applyMode(b.dataset.mode).catch(console.error); }));
ui.leftSelect.addEventListener('change', () => selectPane('left', ui.leftSelect.value));
ui.rightSelect.addEventListener('change', () => selectPane('right', ui.rightSelect.value));
ui.attribute.addEventListener('change', () => {
  state.attributeUserSet = true;
  ui.colorScheme.value = defaultSchemeForAttribute(currentAttributeName());
  ui.colorMin.value = '';
  ui.colorMax.value = '';
  updateAttribute();
  saveState();
});
ui.colorScheme.addEventListener('change', () => { updateAttribute(); saveState(); });
[ui.colorMin, ui.colorMax].forEach(el => el.addEventListener('input', () => { updateAttribute(); saveState(); }));
ui.attributeQuick.querySelectorAll('button').forEach(button => {
  button.addEventListener('click', () => {
    const attr = resolveQuickAttribute(button.dataset.attr);
    if (!attr) return;
    state.attributeUserSet = true;
    ui.attribute.value = attr;
    ui.colorScheme.value = defaultSchemeForAttribute(attr);
    ui.colorMin.value = '';
    ui.colorMax.value = '';
    updateAttribute();
    saveState();
  });
});
ui.solidColorLeft.addEventListener('input', () => {
  state.solidColors.left = ui.solidColorLeft.value;
  if (currentAttributeName() === SOLID_COLOR_ATTR) updateAttribute();
  saveState();
});
ui.solidColorRight.addEventListener('input', () => {
  state.solidColors.right = ui.solidColorRight.value;
  if (currentAttributeName() === SOLID_COLOR_ATTR) updateAttribute();
  saveState();
});
ui.edl.addEventListener('change', () => { allLoadedEntries().forEach(e => { e.instance.renderingOptions.enableEDL = ui.edl.checked; e.instance.notifyChange(); }); saveState(); });
ui.pointSize.addEventListener('input', () => {
  const value = Number(ui.pointSize.value);
  ui.pointSizeLabel.textContent = `Point size: ${value === 0 ? 'auto' : value}`;
  allLoadedEntries().forEach(e => { e.cloud.pointSize = value; e.instance.notifyChange(e.cloud); });
  saveState();
});
ui.threshold.addEventListener('input', () => {
  const value = Number(ui.threshold.value);
  ui.budgetLabel.textContent = `LOD threshold: ${value === 0 ? '0 / maximum detail' : value}`;
  allLoadedEntries().forEach(e => { e.cloud.subdivisionThreshold = value; e.instance.notifyChange(e.cloud); });
  saveState();
});
ui.pointBudget.addEventListener('input', () => {
  const value = Number(ui.pointBudget.value);
  ui.pointBudgetLabel.textContent = value <= 0 ? 'Point budget: unlimited' : `Point budget: ${formatCount(value)}`;
  allLoadedEntries().forEach(e => { e.cloud.pointBudget = value <= 0 ? null : value; e.instance.notifyChange(e.cloud); });
  saveState();
});
ui.filterAttribute.addEventListener('change', () => { updateFilterRangePlaceholder(); updateFilter(); saveState(); });
[ui.filtersEnabled, ui.filterMin, ui.filterMax].forEach(el => el.addEventListener('input', () => { updateFilter(); saveState(); }));

function bindRangeAndNumber(rangeEl, numEl, onChange) {
  rangeEl.addEventListener('input', () => {
    numEl.value = round(Number(rangeEl.value), 3);
    onChange(Number(rangeEl.value));
  });
  numEl.addEventListener('input', () => {
    let v = Number(numEl.value);
    if (!Number.isFinite(v)) return;
    const min = Number(rangeEl.min), max = Number(rangeEl.max);
    if (Number.isFinite(min)) v = Math.max(min, v);
    if (Number.isFinite(max)) v = Math.min(max, v);
    rangeEl.value = v;
    onChange(v);
  });
}

ui.clipHorizontalEnabled.addEventListener('change', () => { state.clip.horizontalEnabled = ui.clipHorizontalEnabled.checked; applyClipping(); saveState(); });
ui.clipHorizontalFlip.addEventListener('change', () => { state.clip.horizontalFlip = ui.clipHorizontalFlip.checked; applyClipping(); saveState(); });
bindRangeAndNumber(ui.clipHorizontal, ui.clipHorizontalNum, v => {
  state.clip.horizontal = v;
  ui.clipHorizontalValue.textContent = `height ${formatScalar(v)} m (range ${formatScalar(Number(ui.clipHorizontal.min))} – ${formatScalar(Number(ui.clipHorizontal.max))} m)`;
  applyClipping();
  saveState();
});

ui.clipVerticalEnabled.addEventListener('change', () => { state.clip.verticalEnabled = ui.clipVerticalEnabled.checked; applyClipping(); saveState(); });
ui.clipVerticalFlip.addEventListener('change', () => { state.clip.verticalFlip = ui.clipVerticalFlip.checked; applyClipping(); saveState(); });
function updateVerticalClipValueLabel() {
  ui.clipVerticalValue.textContent = `${state.clip.verticalAngleDeg}° · offset ${formatScalar(state.clip.vertical)} m (± ${formatScalar(Number(ui.clipVertical.max))} m)`;
}
bindRangeAndNumber(ui.clipVerticalAngle, ui.clipVerticalAngleNum, v => {
  state.clip.verticalAngleDeg = v;
  updateVerticalClipValueLabel();
  applyClipping();
  saveState();
});
bindRangeAndNumber(ui.clipVertical, ui.clipVerticalNum, v => {
  state.clip.vertical = v;
  updateVerticalClipValueLabel();
  applyClipping();
  saveState();
});

// Leaves any embedding iframe (e.g. campus-garden's 3D tab) and opens this
// page directly at the top level, so it fills the whole browser window on
// its own — simpler and more reliable than trying to expand nested iframes
// via CSS/postMessage, and works the same on mobile.
function toggleFullscreen() {
  if (window.top !== window) window.top.location.href = location.href;
}
ui.fullscreenToggle.addEventListener('click', () => { toggleFullscreen(); });
ui.shareView.addEventListener('click', async () => {
  const url = buildShareUrl();
  const originalLabel = ui.shareView.textContent;
  try {
    await navigator.clipboard.writeText(url);
    ui.shareView.textContent = 'Copied!';
  } catch {
    // Clipboard API unavailable (older browser, insecure context, permissions) — fall back to a prompt.
    window.prompt('Copy this link:', url);
    ui.shareView.textContent = 'Copied!';
  }
  setTimeout(() => { ui.shareView.textContent = originalLabel; }, 1600);
});
ui.goTo3DBtn?.addEventListener('click', () => {
  const url = buildGoTo3DPageUrl();
  (window.top ?? window).location.href = url;
});

ui.splitDivider.addEventListener('pointerdown', event => { state.draggingSplit = true; ui.splitDivider.setPointerCapture?.(event.pointerId); event.preventDefault(); });
window.addEventListener('pointermove', event => {
  if (!state.draggingSplit) return;
  const rect = ui.stage.getBoundingClientRect();
  state.split = Math.max(5, Math.min(95, ((event.clientX - rect.left) / rect.width) * 100));
  updateSplitUI();
});
window.addEventListener('pointerup', () => { state.draggingSplit = false; });
ui.stage.addEventListener('pointerdown', event => { if (event.button === 0) state.pointerDown = { x: event.clientX, y: event.clientY, time: performance.now() }; });
ui.stage.addEventListener('pointerup', event => {
  if (!state.pointerDown || event.button !== 0) return;
  const dx = event.clientX - state.pointerDown.x;
  const dy = event.clientY - state.pointerDown.y;
  const dt = performance.now() - state.pointerDown.time;
  state.pointerDown = null;
  if (Math.hypot(dx, dy) <= 4 && dt < 450) pickPoint(event);
});
window.addEventListener('resize', () => allLoadedEntries().forEach(e => e.instance.notifyChange()));

// --- Cross-canvas two-finger touch (Split View only) ------------------------
// Split View renders left/right as two separate canvases, each with its own
// MapControls instance listening only to touches on its own element. If the
// two fingers of a pinch/pan gesture land on different canvases, neither one
// sees a full two-finger gesture. We intercept at the shared #stage level
// (capture phase, so it runs before either canvas's own listeners) as soon as
// 2+ touches are active anywhere in the stage, and drive zoom/pan manually on
// one reference pane — the existing camera sync mirrors it to the other side.
// One-finger touches are left completely alone.
const stageTouches = new Map(); // touchId -> {x, y}
let crossTouchGesture = null; // {entry, lastDist, lastMidX, lastMidY}

function dollyEntryCamera(entry, distanceScale) {
  const camera = entry.instance.view.camera;
  const target = entry.instance.view.controls?.target;
  if (!target) return;
  const offset = camera.position.clone().sub(target).multiplyScalar(distanceScale);
  camera.position.copy(target).add(offset);
}
function panEntryCamera(entry, deltaX, deltaY, elementHeight) {
  const camera = entry.instance.view.camera;
  const controls = entry.instance.view.controls;
  if (!controls?.target) return;
  const dist = camera.position.distanceTo(controls.target) * Math.tan(MathUtils.degToRad(camera.fov / 2));
  const panLeft = new Vector3().setFromMatrixColumn(camera.matrix, 0).multiplyScalar((-2 * deltaX * dist) / elementHeight);
  const panUp = new Vector3().setFromMatrixColumn(camera.matrix, 1).multiplyScalar((2 * deltaY * dist) / elementHeight);
  const offset = panLeft.add(panUp);
  camera.position.add(offset);
  controls.target.add(offset);
}
function stageTouchesArray() { return [...stageTouches.values()]; }
function updateCrossTouchGesture() {
  const pts = stageTouchesArray();
  if (pts.length < 2 || !crossTouchGesture) return;
  const [a, b] = pts;
  const dist = Math.hypot(a.x - b.x, a.y - b.y);
  const midX = (a.x + b.x) / 2;
  const midY = (a.y + b.y) / 2;
  const { entry } = crossTouchGesture;
  if (crossTouchGesture.lastDist > 0 && dist > 0) {
    dollyEntryCamera(entry, crossTouchGesture.lastDist / dist);
  }
  const dx = midX - crossTouchGesture.lastMidX;
  const dy = midY - crossTouchGesture.lastMidY;
  if (dx !== 0 || dy !== 0) panEntryCamera(entry, dx, dy, ui.stage.clientHeight || 1);
  crossTouchGesture.lastDist = dist;
  crossTouchGesture.lastMidX = midX;
  crossTouchGesture.lastMidY = midY;
  entry.instance.view.controls?.update?.();
  syncAllFrom(entry);
  updateReadout();
  entry.instance.notifyChange(entry.instance.view.camera);
}
function cancelNativeTouch(target, touch) {
  if (!target || !touch) return;
  try {
    const ev = new TouchEvent('touchcancel', {
      touches: [],
      targetTouches: [],
      changedTouches: [touch],
      bubbles: true,
      cancelable: true,
    });
    ev.__syntheticStageCancel = true;
    target.dispatchEvent(ev);
  } catch { /* TouchEvent constructor unsupported here; best effort only. */ }
}
ui.stage.addEventListener('touchstart', event => {
  for (const t of event.changedTouches) stageTouches.set(t.identifier, { x: t.clientX, y: t.clientY, touch: t, target: t.target });
  if (stageTouches.size >= 2 && state.mode === 'split' && !crossTouchGesture) {
    const left = state.panes.left.entry;
    const right = state.panes.right.entry;
    if (left && right) {
      event.preventDefault();
      event.stopPropagation();
      // Reset any native single-finger rotate already armed on either canvas
      // from before the second finger arrived — otherwise it keeps running
      // alongside our manual pan/zoom below.
      for (const p of stageTouches.values()) cancelNativeTouch(p.target, p.touch);
      if (left.instance.view.controls) left.instance.view.controls.enabled = false;
      if (right.instance.view.controls) right.instance.view.controls.enabled = false;
      const [a, b] = stageTouchesArray();
      crossTouchGesture = {
        entry: left,
        left,
        right,
        lastDist: Math.hypot(a.x - b.x, a.y - b.y),
        lastMidX: (a.x + b.x) / 2,
        lastMidY: (a.y + b.y) / 2,
      };
    }
  }
}, { capture: true, passive: false });
ui.stage.addEventListener('touchmove', event => {
  if (!crossTouchGesture) return;
  for (const t of event.changedTouches) if (stageTouches.has(t.identifier)) {
    const p = stageTouches.get(t.identifier);
    p.x = t.clientX;
    p.y = t.clientY;
  }
  event.preventDefault();
  event.stopPropagation();
  updateCrossTouchGesture();
}, { capture: true, passive: false });
function endStageTouches(event) {
  if (event.__syntheticStageCancel) return;
  for (const t of event.changedTouches) stageTouches.delete(t.identifier);
  if (crossTouchGesture) {
    event.stopPropagation();
    if (stageTouches.size < 2) {
      if (crossTouchGesture.left.instance.view.controls) crossTouchGesture.left.instance.view.controls.enabled = true;
      if (crossTouchGesture.right.instance.view.controls) crossTouchGesture.right.instance.view.controls.enabled = true;
      crossTouchGesture = null;
    }
  }
}
ui.stage.addEventListener('touchend', endStageTouches, { capture: true });
ui.stage.addEventListener('touchcancel', endStageTouches, { capture: true });

function syncClipPanelWidth() {
  if (!ui.clipToggle || !ui.attributeQuick) return;
  const w = ui.attributeQuick.getBoundingClientRect().width;
  if (w > 0) ui.clipToggle.style.width = `${Math.round(w)}px`;
}
syncClipPanelWidth();
window.addEventListener('resize', syncClipPanelWidth);
window.addEventListener('load', syncClipPanelWidth);

// --- WASD / arrow-key fly controls -----------------------------------------
// Holding a movement key translates the camera along its facing direction.
// While any movement key is held, mouse movement steers the look direction
// (FPS-style), on top of the normal MapControls drag/pan/zoom.
const MOVE_KEYS = new Set(['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright']);
const flight = { keys: new Set(), active: false, entry: null, yaw: 0, pitch: 0, lastTime: 0, raf: null };
let lastPointerEvent = null;
let shiftHeld = false;
const FLIGHT_SHIFT_MULTIPLIER = 3;

function isEditableTarget(el) { return Boolean(el) && ['INPUT', 'SELECT', 'TEXTAREA'].includes(el.tagName); }
function cameraForward(camera) { return new Vector3(0, 0, -1).applyQuaternion(camera.quaternion); }
function cameraRight(camera) { return new Vector3(1, 0, 0).applyQuaternion(camera.quaternion); }
function extractYawPitch(camera) {
  const f = cameraForward(camera).normalize();
  return { yaw: Math.atan2(f.x, f.y), pitch: Math.asin(MathUtils.clamp(f.z, -1, 1)) };
}
function applyLook(camera, yaw, pitch) {
  const cp = Math.cos(pitch);
  const forward = new Vector3(Math.sin(yaw) * cp, Math.cos(yaw) * cp, Math.sin(pitch));
  camera.up.set(0, 0, 1);
  camera.lookAt(camera.position.clone().add(forward));
}

function startFlight() {
  const fallback = { clientX: ui.stage.getBoundingClientRect().left + ui.stage.clientWidth / 2, clientY: 0 };
  const entry = interactiveEntryForEvent(lastPointerEvent ?? fallback);
  if (!entry) { flight.keys.clear(); return; }
  flight.entry = entry;
  flight.active = true;
  const { yaw, pitch } = extractYawPitch(entry.instance.view.camera);
  flight.yaw = yaw;
  flight.pitch = pitch;
  flight.lastTime = performance.now();
  flight.raf = requestAnimationFrame(flightTick);
}
function stopFlight() {
  flight.active = false;
  flight.entry = null;
  if (flight.raf) cancelAnimationFrame(flight.raf);
  flight.raf = null;
}
function flightTick(now) {
  if (!flight.active) return;
  const entry = flight.entry;
  const dt = Math.min((now - flight.lastTime) / 1000, 0.1);
  flight.lastTime = now;
  const camera = entry.instance.view.camera;
  let box = null;
  try { box = entry.cloud.getBoundingBox(); } catch {}
  const scale = box ? Math.max(box.getSize(new Vector3()).length() * 0.05, 1) : 10;
  const speed = scale * dt * (shiftHeld ? FLIGHT_SHIFT_MULTIPLIER : 1);
  const forward = cameraForward(camera);
  const right = cameraRight(camera);
  const move = new Vector3();
  if (flight.keys.has('w') || flight.keys.has('arrowup')) move.add(forward);
  if (flight.keys.has('s') || flight.keys.has('arrowdown')) move.sub(forward);
  if (flight.keys.has('d') || flight.keys.has('arrowright')) move.add(right);
  if (flight.keys.has('a') || flight.keys.has('arrowleft')) move.sub(right);
  if (move.lengthSq() > 0) {
    move.normalize().multiplyScalar(speed);
    camera.position.add(move);
    const controls = entry.instance.view.controls;
    if (controls?.target) controls.target.add(move);
    camera.updateMatrixWorld();
    syncAllFrom(entry);
    updateReadout();
    entry.instance.notifyChange(camera);
  }
  flight.raf = requestAnimationFrame(flightTick);
}

window.addEventListener('keydown', event => {
  if (event.key === 'Shift') shiftHeld = true;
  const key = event.key.toLowerCase();
  if (!MOVE_KEYS.has(key) || isEditableTarget(document.activeElement)) return;
  event.preventDefault();
  if (!flight.keys.has(key)) {
    flight.keys.add(key);
    if (!flight.active) startFlight();
  }
});
window.addEventListener('keyup', event => {
  if (event.key === 'Shift') shiftHeld = false;
  const key = event.key.toLowerCase();
  if (!MOVE_KEYS.has(key)) return;
  flight.keys.delete(key);
  if (flight.keys.size === 0) stopFlight();
});
window.addEventListener('blur', () => { flight.keys.clear(); shiftHeld = false; stopFlight(); });
window.addEventListener('pointermove', event => {
  lastPointerEvent = event;
  if (!flight.active || !flight.entry) return;
  const camera = flight.entry.instance.view.camera;
  const sensitivity = 0.0028;
  flight.yaw += event.movementX * sensitivity;
  flight.pitch = MathUtils.clamp(flight.pitch - event.movementY * sensitivity, -Math.PI / 2 + 0.05, Math.PI / 2 - 0.05);
  applyLook(camera, flight.yaw, flight.pitch);
  const controls = flight.entry.instance.view.controls;
  if (controls?.target) {
    const dist = camera.position.distanceTo(controls.target) || 20;
    controls.target.copy(camera.position).addScaledVector(cameraForward(camera), dist);
  }
  syncAllFrom(flight.entry);
  flight.entry.instance.notifyChange(camera);
});

const INTRO_SEEN_KEY = 'copc-viewer-intro-seen-v1';
function maybeShowIntro() {
  if (specimenParams) return;
  try {
    if (localStorage.getItem(INTRO_SEEN_KEY)) return;
  } catch { /* localStorage unavailable — just show it, no harm in repeating. */ }
  ui.introOverlay.hidden = false;
}
function dismissIntro() {
  ui.introOverlay.hidden = true;
  if (ui.introDontShow.checked) {
    try { localStorage.setItem(INTRO_SEEN_KEY, '1'); } catch { /* not critical */ }
  }
}
ui.closeIntro.addEventListener('click', dismissIntro);
ui.introOverlay.addEventListener('click', event => { if (event.target === ui.introOverlay) dismissIntro(); });
window.addEventListener('keydown', event => { if (event.key === 'Escape' && !ui.introOverlay.hidden) dismissIntro(); });
maybeShowIntro();

init().catch(console.error);
