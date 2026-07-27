(() => {
  "use strict";

  function seededRandom(seed = 3421) {
    let state = seed >>> 0;
    return () => {
      state = (state * 1664525 + 1013904223) >>> 0;
      return state / 4294967296;
    };
  }

  function buildGardenPoints() {
    const random = seededRandom();
    const rand = (a, b) => a + random() * (b - a);
    const points = [];
    const clusters = [[-1.15,-0.4,"p"],[0.95,0.55,"p"],[0.15,-1.2,"s"],[-1.35,0.85,"p"],[1.3,-0.75,"s"]];
    for (let i = 0; i < 2400; i += 1) {
      let x; let y; let z; let c = 0;
      if (random() < 0.58) {
        const angle = random() * Math.PI * 2;
        const radius = Math.pow(random(), 0.5) * 2.7;
        x = Math.cos(angle) * radius;
        z = Math.sin(angle) * radius;
        y = -0.03 + Math.sin(x * 1.3) * 0.025 + Math.cos(z * 1.1) * 0.025;
        c = random() < 0.12 ? 1 : 0;
      } else {
        const cluster = clusters[Math.floor(random() * clusters.length)];
        if (cluster[2] === "s") {
          const angle = random() * Math.PI * 2;
          const radius = Math.pow(random(), 0.5) * 0.32;
          x = cluster[0] + Math.cos(angle) * radius;
          z = cluster[1] + Math.sin(angle) * radius;
          y = rand(0, 0.34);
          c = random() < 0.45 ? 2 : 0;
        } else {
          const h = rand(0.15, 1.3);
          const spread = 0.22 * (1.4 - h) + 0.1;
          x = cluster[0] + rand(-spread, spread);
          z = cluster[1] + rand(-spread, spread);
          y = h;
          c = random() < 0.1 ? 1 : 0;
        }
      }
      points.push({ x, y, z, c });
    }
    return points;
  }

  const canvas = document.getElementById("cg-cloud");
  const ctx = canvas?.getContext("2d");
  const points = buildGardenPoints();
  const palette = ["234,232,223", "206,209,214", "182,193,197"];
  let width = 0;
  let height = 0;
  let target = 0;
  let current = 0;
  let needsDraw = true;
  let raf = 0;

  function resizeCloud() {
    if (!canvas || !ctx) return;
    const rect = canvas.getBoundingClientRect();
    if (rect.width < 2 || rect.height < 2) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    width = rect.width;
    height = rect.height;
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    needsDraw = true;
  }

  function updateTarget() {
    target = Math.max(0, Math.min(1, (window.scrollY || 0) / (window.innerHeight * 0.9)));
    needsDraw = true;
  }

  function drawCloud(progress) {
    if (!ctx || !width || document.querySelector('[data-page="home"]').hidden) return;
    ctx.clearRect(0, 0, width, height);
    let scene = 1 - (progress - 0.35) / 0.5;
    scene = Math.max(0, Math.min(1, scene));
    if (scene <= 0.01) return;
    const yaw = 0.62;
    const tilt = 0.3 + progress * 0.14;
    const cosY = Math.cos(yaw); const sinY = Math.sin(yaw);
    const cosT = Math.cos(tilt); const sinT = Math.sin(tilt);
    const cx = width * 0.5;
    const cy = height * (0.56 + progress * 0.14);
    const scale = Math.min(width, height) * (0.46 + progress * 0.07);
    const sizeMul = 1.1 + progress * 0.55;
    for (const point of points) {
      const rx = point.x * cosY - point.z * sinY;
      const rz = point.x * sinY + point.z * cosY;
      const ry = point.y * cosT - rz * sinT;
      const rz2 = point.y * sinT + rz * cosT;
      const denom = 4.2 + rz2;
      if (denom <= 0.25) continue;
      const perspective = 3.2 / denom;
      const px = cx + rx * perspective * scale;
      const py = cy - ry * perspective * scale;
      if (px < -20 || px > width + 20 || py < -20 || py > height + 20) continue;
      const size = Math.max(0.4, Math.min(2.6, perspective * sizeMul));
      const alpha = Math.min(0.95, (0.24 + perspective * 0.5) * scene);
      if (alpha <= 0.02) continue;
      ctx.fillStyle = `rgba(${palette[point.c]},${alpha.toFixed(3)})`;
      ctx.fillRect(px, py, size, size);
    }
  }

  function drawCloudNow() {
    resizeCloud();
    updateTarget();
    current = target;
    drawCloud(current);
  }

  function loop() {
    current += (target - current) * 0.1;
    if (needsDraw || Math.abs(target - current) > 0.001) {
      drawCloud(current);
      if (Math.abs(target - current) <= 0.001) needsDraw = false;
    }
    raf = requestAnimationFrame(loop);
  }

  window.addEventListener("hashchange", () => {
    if ((location.hash.slice(1) || "home").toLowerCase() === "home") requestAnimationFrame(drawCloudNow);
  });
  window.addEventListener("resize", resizeCloud);
  window.addEventListener("scroll", updateTarget, { passive: true });
  document.addEventListener("visibilitychange", () => { if (!document.hidden) needsDraw = true; });
  resizeCloud();
  updateTarget();
  raf = requestAnimationFrame(loop);
  window.addEventListener("pagehide", () => cancelAnimationFrame(raf), { once: true });
})();
