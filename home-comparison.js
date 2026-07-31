"use strict";

const hero = document.querySelector(".cloud-hero");
const cloudStage = document.querySelector(".cloud-stage");
const comparison = document.getElementById("cg-home-comparison");
const divider = document.querySelector(".home-comparison-divider");
const handle = document.querySelector(".home-comparison-handle");
const targets = {
  before: document.getElementById("cg-compare-before"),
  after: document.getElementById("cg-compare-after")
};

if (hero && cloudStage && comparison && divider && handle && targets.before && targets.after && window.WebGL2RenderingContext) {
  const startedAt = performance.now();
  const metrics = {
    activation: "hero=compare",
    initializationStart: null,
    manifestReady: null,
    sourceReadiness: { before: null, after: null },
    firstUsablePoints: { before: null, after: null },
    bothSidesUsable: null,
    timeToVisibleComparison: null,
    displayedPoints: { before: 0, after: 0 },
    effectiveBudgets: { before: 0, after: 0, combined: 0 },
    viewport: null,
    canvasSizes: { before: null, after: null },
    effectiveDPR: null,
    resourceTiming: { manifest: null, before: null, after: null },
    failures: []
  };
  window.__campusGardenHeroComparisonMetrics = metrics;

  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const entries = new Map();
  let initialized = false;
  let initializing = false;
  let disposed = false;
  let heroNear = false;
  let sceneReady = false;
  let revealed = false;
  let cloudActive = true;
  let targetProgress = 0;
  let currentProgress = 0;
  let lastRenderedProgress = -1;
  let targetOpacity = 1;
  let displayedOpacity = 1;
  let lastOpacityFrame = 0;
  let scrollRaf = 0;
  let loadTimeout = 0;
  let split = 50;
  let activePointer = null;
  let freezeScrollCamera = false;
  let runtime = null;
  let initialPosition = null;
  let initialTarget = null;
  let finalPosition = null;
  let finalTarget = null;
  let basePosition = null;
  let baseTarget = null;

  const clamp01 = value => Math.max(0, Math.min(1, value));
  const clampSplit = value => Math.max(5, Math.min(95, value));
  const smoothstep = value => {
    const t = clamp01(value);
    return t * t * (3 - 2 * t);
  };
  const mark = () => Math.round((performance.now() - startedAt) * 10) / 10;
  const isMobile = () => window.innerWidth <= 768;
  const requestedDpr = () => Math.min(window.devicePixelRatio || 1, isMobile() ? 1 : 1.5);
  const requestedBudget = () => isMobile() ? 150000 : 300000;
  const isActiveHome = () => document.body.classList.contains("home-view")
    && new URLSearchParams(location.search).get("hero") === "compare";
  const mayRender = () => !disposed
    && document.visibilityState === "visible"
    && isActiveHome()
    && heroNear;

  function updateSplit(value) {
    split = Math.round(clampSplit(value) * 100) / 100;
    hero.style.setProperty("--home-comparison-split", `${split}%`);
    targets.before.style.clipPath = `inset(0 ${100 - split}% 0 0)`;
    targets.after.style.clipPath = `inset(0 0 0 ${split}%)`;
    handle.setAttribute("aria-valuenow", String(split));
  }

  function resetSplit() {
    updateSplit(50);
  }

  function splitFromClientX(clientX) {
    const bounds = hero.getBoundingClientRect();
    if (!bounds.width) return split;
    return clampSplit(((clientX - bounds.left) / bounds.width) * 100);
  }

  function reconcileScrollCamera() {
    freezeScrollCamera = false;
    targetProgress = clamp01((window.scrollY || 0) / Math.max(hero.offsetHeight, 1));
    currentProgress = targetProgress;
    lastRenderedProgress = -1;
    if (mayRender()) {
      renderCamera(currentProgress, true);
      requestScrollRender();
    }
  }

  function endPointerDrag({ reconcile = true } = {}) {
    if (!activePointer) return;
    const pointer = activePointer;
    activePointer = null;
    const shouldReconcile = reconcile && pointer.type === "touch" && pointer.claimed;
    try {
      if (handle.hasPointerCapture?.(pointer.id)) handle.releasePointerCapture(pointer.id);
    } catch {}
    if (shouldReconcile) reconcileScrollCamera();
    else freezeScrollCamera = false;
  }

  function resourceMetric(url) {
    const resources = performance.getEntriesByName(url);
    if (!resources.length) return null;
    return {
      requests: resources.length,
      duration: Math.round(resources.reduce((sum, item) => sum + item.duration, 0) * 10) / 10,
      transferSize: resources.reduce((sum, item) => sum + (item.transferSize || 0), 0),
      encodedBodySize: resources.reduce((sum, item) => sum + (item.encodedBodySize || 0), 0),
      decodedBodySize: resources.reduce((sum, item) => sum + (item.decodedBodySize || 0), 0)
    };
  }

  function updateMetrics() {
    const budget = requestedBudget();
    metrics.effectiveBudgets = { before: budget, after: budget, combined: budget * 2 };
    metrics.effectiveDPR = requestedDpr();
    metrics.viewport = { width: window.innerWidth, height: window.innerHeight };
    for (const role of ["before", "after"]) {
      const entry = entries.get(role);
      metrics.displayedPoints[role] = entry?.cloud?.displayedPointCount || 0;
      const canvas = entry?.instance?.domElement;
      metrics.canvasSizes[role] = canvas ? {
        cssWidth: canvas.clientWidth,
        cssHeight: canvas.clientHeight,
        width: canvas.width,
        height: canvas.height
      } : null;
      if (entry?.url) metrics.resourceTiming[role] = resourceMetric(entry.url);
    }
    metrics.resourceTiming.manifest = resourceMetric(new URL("./3d/data/manifest.json", document.baseURI).href);
  }

  function setEntryActive(entry, active) {
    const visible = active && cloudActive;
    if (entry.cloud.visible !== visible) {
      entry.cloud.visible = visible;
      entry.instance.notifyChange(entry.cloud);
    }
  }

  function updateActivity() {
    const active = mayRender();
    for (const entry of entries.values()) setEntryActive(entry, active);
    if (active && sceneReady) {
      readScrollTarget();
      renderCamera(currentProgress, true);
    } else if (scrollRaf) {
      cancelAnimationFrame(scrollRaf);
      scrollRaf = 0;
    }
  }

  function applyResponsiveRendering() {
    const budget = requestedBudget();
    const dpr = requestedDpr();
    for (const entry of entries.values()) {
      entry.cloud.pointBudget = budget;
      if (entry.instance.renderer?.setPixelRatio) entry.instance.renderer.setPixelRatio(dpr);
      entry.instance.notifyChange();
    }
    updateMetrics();
  }

  function fail(error) {
    endPointerDrag({ reconcile: false });
    clearTimeout(loadTimeout);
    metrics.failures.push({ time: mark(), message: error?.message || String(error) });
    updateMetrics();
    hero.classList.add("cloud-load-failed");
    hero.classList.remove("has-home-comparison");
    sceneReady = false;
    for (const entry of entries.values()) {
      try { entry.instance.dispose(); } catch {}
    }
    entries.clear();
    targets.before.replaceChildren();
    targets.after.replaceChildren();
    console.error(`[Home comparison] COPC unavailable; using neutral Hero treatment. ${error?.message || error}`);
  }

  function readScrollTarget() {
    targetProgress = clamp01((window.scrollY || 0) / Math.max(hero.offsetHeight, 1));
    if (reducedMotion.matches) currentProgress = targetProgress;
    if (mayRender() && !freezeScrollCamera) requestScrollRender();
  }

  function renderCamera(progress, force = false) {
    if (!sceneReady || !mayRender()) return;
    if (!force && Math.abs(progress - lastRenderedProgress) < 0.0005) return;
    lastRenderedProgress = progress;
    const motionProgress = smoothstep(clamp01(progress / 0.89));
    basePosition.lerpVectors(initialPosition, finalPosition, motionProgress);
    baseTarget.lerpVectors(initialTarget, finalTarget, motionProgress);
    for (const entry of entries.values()) {
      const camera = entry.instance.view.camera;
      camera.position.copy(basePosition);
      camera.up.set(0, 0, 1);
      camera.lookAt(baseTarget);
      camera.updateMatrixWorld();
      entry.instance.notifyChange(camera);
    }
  }

  function updateDisplayedOpacity(now) {
    targetOpacity = 1 - smoothstep((targetProgress - 0.18) / 0.62);
    if (!cloudActive && targetOpacity > 0.001) {
      cloudActive = true;
      for (const entry of entries.values()) setEntryActive(entry, mayRender());
    }
    const elapsed = lastOpacityFrame ? (now - lastOpacityFrame) / 1000 : 1 / 60;
    const dt = Math.min(elapsed > 0.1 ? 1 / 60 : elapsed, 0.05);
    displayedOpacity += (targetOpacity - displayedOpacity) * (1 - Math.exp(-8 * dt));
    displayedOpacity = clamp01(displayedOpacity);
    if (Math.abs(targetOpacity - displayedOpacity) < 0.001) {
      displayedOpacity = targetOpacity;
      lastOpacityFrame = 0;
    } else {
      lastOpacityFrame = now;
    }
    cloudStage.style.opacity = displayedOpacity.toFixed(3);
    if (displayedOpacity <= 0.001 && targetOpacity <= 0.001 && cloudActive) {
      cloudActive = false;
      for (const entry of entries.values()) setEntryActive(entry, false);
    }
    return Math.abs(targetOpacity - displayedOpacity) >= 0.001;
  }

  function scrollTick(now) {
    scrollRaf = 0;
    if (!mayRender() || freezeScrollCamera) return;
    currentProgress = targetProgress;
    renderCamera(currentProgress);
    if (updateDisplayedOpacity(now)) requestScrollRender();
  }

  function requestScrollRender() {
    if (!scrollRaf && mayRender() && !freezeScrollCamera) scrollRaf = requestAnimationFrame(scrollTick);
  }

  function noteUsable(role) {
    const entry = entries.get(role);
    if (!entry || metrics.firstUsablePoints[role] !== null || entry.cloud.displayedPointCount < 1) return;
    metrics.firstUsablePoints[role] = mark();
    metrics.displayedPoints[role] = entry.cloud.displayedPointCount;
    if (metrics.firstUsablePoints.before === null || metrics.firstUsablePoints.after === null || revealed) return;
    revealed = true;
    metrics.bothSidesUsable = mark();
    metrics.timeToVisibleComparison = Math.round((performance.now() - metrics.initializationStartAbsolute) * 10) / 10;
    delete metrics.initializationStartAbsolute;
    clearTimeout(loadTimeout);
    hero.classList.add("has-home-comparison");
    updateMetrics();
    console.info("[Home comparison] ready", JSON.parse(JSON.stringify(metrics)));
  }

  async function createEntry(role, url, sceneCrs) {
    let instance = null;
    try {
      const source = new runtime.COPCSource({ url });
      await source.initialize();
      metrics.sourceReadiness[role] = mark();
      const metadata = await source.getMetadata();
      metadata.crs = sceneCrs;
      source.crs = sceneCrs;
      const getMetadata = source.getMetadata.bind(source);
      source.getMetadata = async () => {
        const value = await getMetadata();
        value.crs = sceneCrs;
        return value;
      };
      instance = new runtime.Instance({ target: targets[role], crs: sceneCrs, backgroundColor: null });
      instance.view.minNearPlane = 0.05;
      instance.view.camera.fov = 55;
      instance.view.camera.updateProjectionMatrix();
      instance.view.camera.position.set(5.147350556707725, 7.195839058105258, -0.13852892816472095);
      instance.view.camera.up.set(0, 0, 1);
      instance.view.camera.lookAt(new runtime.Vector3(1.4596723889404544, 7.030699040480944, -0.09094691876173076));
      instance.view.camera.updateMatrixWorld();
      instance.renderingOptions.enableEDL = false;
      instance.renderer.localClippingEnabled = true;
      instance.renderer.clippingPlanes = [{
        normal: new runtime.Vector3(0, 0, -1),
        constant: 7.319783524
      }];
      if (instance.renderer?.setPixelRatio) instance.renderer.setPixelRatio(requestedDpr());
      const cloud = new runtime.PointCloud({ source, crs: sceneCrs });
      const entry = { role, url, source, metadata, instance, cloud };
      entries.set(role, entry);
      instance.addEventListener("update-end", () => {
        metrics.displayedPoints[role] = cloud.displayedPointCount || 0;
        noteUsable(role);
        updateMetrics();
      });
      await instance.add(cloud);
      cloud.visible = mayRender();
      cloud.pointBudget = requestedBudget();
      cloud.subdivisionThreshold = 0.5;
      cloud.pointSize = 1;
      const rgb = metadata.attributes.find(attribute =>
        ["color", "rgb", "rgba"].includes(attribute.name.toLowerCase())
      );
      if (!rgb) throw new Error(`${role} RGB point attribute unavailable`);
      cloud.setActiveAttribute(rgb.name);
      cloud.setColoringMode("attribute");
      return entry;
    } catch (error) {
      if (instance) {
        try { instance.dispose(); } catch {}
      }
      entries.delete(role);
      throw error;
    }
  }

  async function initialize() {
    if (initialized || initializing || disposed || !mayRender()) return;
    initialized = true;
    initializing = true;
    metrics.initializationStart = mark();
    metrics.initializationStartAbsolute = performance.now();
    try {
      runtime = await import("./home-cloud-runtime.js");
      runtime.setLazPerfPath(new URL("./3d/wasm/", document.baseURI).href);
      const manifestUrl = new URL("./3d/data/manifest.json", document.baseURI).href;
      const response = await fetch(manifestUrl, { cache: "no-store" });
      if (!response.ok) throw new Error("comparison manifest request failed");
      const manifest = await response.json();
      metrics.manifestReady = mark();
      const before = manifest.datasets?.find(item => item.id === "before");
      const after = manifest.datasets?.find(item => item.id === "after");
      if (!before?.url || !after?.url) throw new Error("Before or After dataset missing from manifest");
      const sceneCrs = runtime.CoordinateSystem.register(
        "campus-garden-local",
        "+proj=merc +a=6378137 +b=6378137 +lat_ts=0 +lon_0=0 +x_0=0 +y_0=0 +k=1 +units=m +nadgrids=@null +wktext +no_defs +type=crs"
      );
      const settled = await Promise.allSettled([
        createEntry("before", before.url, sceneCrs),
        createEntry("after", after.url, sceneCrs)
      ]);
      const rejected = settled.find(result => result.status === "rejected");
      if (rejected) throw rejected.reason;
      initialPosition = new runtime.Vector3(5.147350556707725, 7.195839058105258, -0.13852892816472095);
      initialTarget = new runtime.Vector3(1.4596723889404544, 7.030699040480944, -0.09094691876173076);
      finalPosition = new runtime.Vector3(2.8944041258533995, 7.096017175566735, 0.5404773189529162);
      finalTarget = new runtime.Vector3(1.4681330447350907, 7.03214644048835081, 0.5591807764433797);
      basePosition = initialPosition.clone();
      baseTarget = initialTarget.clone();
      sceneReady = true;
      applyResponsiveRendering();
      readScrollTarget();
      renderCamera(currentProgress, true);
      for (const entry of entries.values()) entry.instance.notifyChange(entry.cloud);
      loadTimeout = window.setTimeout(() => {
        if (!revealed) fail(new Error("comparison did not render both datasets"));
      }, 30000);
    } catch (error) {
      fail(error);
    } finally {
      initializing = false;
    }
  }

  function resize() {
    if (!initialized || disposed) return;
    applyResponsiveRendering();
    lastRenderedProgress = -1;
    if (mayRender()) renderCamera(currentProgress, true);
  }

  function dispose() {
    if (disposed) return;
    endPointerDrag({ reconcile: false });
    disposed = true;
    clearTimeout(loadTimeout);
    if (scrollRaf) cancelAnimationFrame(scrollRaf);
    scrollRaf = 0;
    for (const entry of entries.values()) {
      try { entry.instance.dispose(); } catch {}
    }
    entries.clear();
  }

  const observer = new IntersectionObserver(records => {
    heroNear = records.some(record => record.isIntersecting);
    if (heroNear) initialize();
    updateActivity();
  }, { rootMargin: "240px 0px", threshold: 0 });
  observer.observe(hero);

  resetSplit();

  handle.addEventListener("pointerdown", event => {
    if (!revealed || activePointer || (event.pointerType === "mouse" && event.button !== 0)) return;
    activePointer = {
      id: event.pointerId,
      type: event.pointerType,
      startX: event.clientX,
      startY: event.clientY,
      classified: event.pointerType !== "touch",
      claimed: event.pointerType !== "touch"
    };
    handle.setPointerCapture?.(event.pointerId);
    if (activePointer.claimed) {
      event.preventDefault();
      updateSplit(splitFromClientX(event.clientX));
    }
  });

  handle.addEventListener("pointermove", event => {
    if (!activePointer || event.pointerId !== activePointer.id) return;
    if (!activePointer.classified) {
      const dx = event.clientX - activePointer.startX;
      const dy = event.clientY - activePointer.startY;
      if (Math.hypot(dx, dy) < 7) return;
      activePointer.classified = true;
      activePointer.claimed = Math.abs(dx) > Math.abs(dy);
      if (activePointer.claimed) freezeScrollCamera = true;
      else {
        endPointerDrag({ reconcile: false });
        return;
      }
    }
    if (!activePointer.claimed) return;
    event.preventDefault();
    updateSplit(splitFromClientX(event.clientX));
  }, { passive: false });

  handle.addEventListener("pointerup", event => {
    if (activePointer?.id === event.pointerId) endPointerDrag();
  });
  handle.addEventListener("pointercancel", event => {
    if (activePointer?.id === event.pointerId) endPointerDrag();
  });
  handle.addEventListener("lostpointercapture", event => {
    if (activePointer?.id === event.pointerId) endPointerDrag();
  });

  handle.addEventListener("keydown", event => {
    const changes = {
      ArrowLeft: split - 2,
      ArrowRight: split + 2,
      PageDown: split - 10,
      PageUp: split + 10,
      Home: 5,
      End: 95
    };
    if (!(event.key in changes)) return;
    event.preventDefault();
    updateSplit(changes[event.key]);
  });

  window.addEventListener("scroll", readScrollTarget, { passive: true });
  window.addEventListener("resize", resize, { passive: true });
  window.addEventListener("orientationchange", resize);
  window.addEventListener("campus:route-rendered", () => {
    endPointerDrag({ reconcile: false });
    resetSplit();
    if (isActiveHome() && heroNear) initialize();
    updateActivity();
  });
  reducedMotion.addEventListener("change", () => {
    currentProgress = targetProgress;
    if (mayRender()) requestScrollRender();
  });
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState !== "visible") endPointerDrag({ reconcile: false });
    if (document.visibilityState === "visible" && heroNear) initialize();
    updateActivity();
  });
  window.addEventListener("pagehide", event => {
    endPointerDrag({ reconcile: false });
    if (!event.persisted) dispose();
    else for (const entry of entries.values()) setEntryActive(entry, false);
  });
  window.addEventListener("pageshow", () => {
    resetSplit();
    updateActivity();
  });
}
