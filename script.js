(() => {
  "use strict";

  const speciesData = {
    "fringed-iris": {
      en: "Fringed Iris",
      jp: "シャガ",
      count: "1 registered location",
      locations: [
        { code: "PL-A1", island: "Island 01", map: "./?view=map&open=a1#map", d3: "./3d/?dataset=PL-A1&embed=1" }
      ]
    },
    "haircap-moss": {
      en: "Haircap Moss",
      jp: "スギゴケ",
      count: "4 registered locations",
      locations: [
        { code: "PL-A3", map: "./?view=map&open=a3#map" },
        { code: "PL-A4", map: "./?view=map&open=a4#map" },
        { code: "PL-B1", map: "./?view=map&open=b1#map" },
        { code: "PL-B2", map: "./?view=map&open=b2#map" }
      ]
    },
    "spiraea-thunbergii": {
      en: "Spiraea Thunbergii",
      jp: "ユキヤナギ",
      count: "1 registered location",
      locations: [
        { code: "PL-A5", island: "Island 02", map: "./?view=map&open=a5#map" }
      ]
    },
    "autumn-fern": {
      en: "Autumn Fern",
      jp: "ベニシダ",
      count: "2 registered locations",
      locations: [
        { code: "PL-B3", island: "Island 03", map: "./?view=map&open=b3#map" },
        { code: "PL-B6", island: "Island 03", map: "./?view=map&open=b6#map", d3: "./3d/?dataset=PL-B6&embed=1" }
      ]
    }
  };
  const speciesDetails = {
    "fringed-iris": {
      identity: {
        body: "An evergreen perennial that spreads by rhizomes. It produces pale flowers with violet and orange markings in spring.",
        facts: ["Evergreen perennial", "Height 25–45 cm", "Flowers Apr–May"]
      },
      conditions: {
        body: "Partial to bright shade, with moist, humus-rich soil that drains well. Avoid prolonged dryness and standing water.",
        facts: ["Light — Partial shade", "Moisture — Moist", "Drainage — Well drained"]
      },
      watch: "Check for prolonged dryness or waterlogging, yellowing or dead leaves, old flower stems, slug damage, and growth beyond the intended area.",
      care: [
        ["Watering", "Water slowly at the base when the soil remains dry. Do not add water when the soil is already saturated."],
        ["Remove dead leaves", "Remove only fully dead leaves near the base. Do not cut healthy green leaves or new shoots."],
        ["Remove flower stems", "After flowering, cut old flower stems near the base without damaging the surrounding leaves."]
      ],
      tools: ["Watering can", "Gloves", "Clean garden shears"],
      showCodes: false
    },
    "haircap-moss": {
      identity: {
        body: "A tuft-forming moss recorded here under the general name Haircap Moss. It forms dense green patches, but the exact species has not yet been confirmed.",
        facts: ["Moss", "Dense tufts", "Exact species unconfirmed"]
      },
      conditions: {
        body: "Moist, slightly acidic ground with limited disturbance. Avoid prolonged drying, standing water, and heavy foot traffic.",
        facts: ["Light — Partial shade", "Moisture — Consistently moist", "Ground — Slightly acidic"]
      },
      watch: "Check for prolonged drying, dark or soft patches, fallen leaves covering the surface, loose soil, and damage from trampling.",
      care: [
        ["Watering", "Water or mist gently when the moss and upper soil remain dry. Do not flood the surface or use a strong jet."],
        ["Remove debris", "Lift fallen leaves and twigs carefully by hand or with soft tweezers. Do not pull the moss from the soil."],
        ["Protect the surface", "Keep feet and tools off the moss. Do not rake or loosen the surface."]
      ],
      tools: ["Watering can with a fine rose", "Gloves", "Soft tweezers"],
      showCodes: true
    },
    "spiraea-thunbergii": {
      identity: {
        body: "A deciduous shrub with slender, arching branches and many small white flowers in early spring.",
        facts: ["Deciduous shrub", "Height up to about 1.5 m", "Flowers in early spring"]
      },
      conditions: {
        body: "Full sun to light shade, in moderately moist soil that drains well. Avoid persistently wet ground.",
        facts: ["Light — Sun to partial shade", "Moisture — Moderate", "Drainage — Well drained"]
      },
      watch: "Check for prolonged dryness, waterlogged soil, dead or crossing branches, damaged shoots, and reduced flowering.",
      care: [
        ["Watering", "Water slowly at the base during prolonged dry periods. Do not add water when the soil remains wet."],
        ["Remove dead branches", "Remove dead or damaged branches cleanly at their point of origin."],
        ["Pruning", "Prune only as needed immediately after flowering. Avoid heavy pruning later in the year, when next season’s flowering growth may be removed."]
      ],
      tools: ["Watering can", "Gloves", "Clean pruning shears"],
      showCodes: false
    },
    "autumn-fern": {
      identity: {
        body: "A semi-evergreen fern that forms compact clumps. New fronds emerge coppery pink and mature to glossy green.",
        facts: ["Semi-evergreen fern", "Height up to about 75 cm", "Copper-coloured new fronds"]
      },
      conditions: {
        body: "Cool, moist, lightly shaded conditions. It can tolerate more sun when the soil remains moist. Avoid prolonged drying and standing water.",
        facts: ["Light — Partial to full shade", "Moisture — Moist", "Drainage — Well drained"]
      },
      watch: "Check for dry or scorched fronds, damaged new growth, old fronds crowding the centre, and soil that remains waterlogged.",
      care: [
        ["Watering", "Water slowly at the base when the soil remains dry. Do not add water when the soil is already saturated."],
        ["Remove old fronds", "Remove fully dead or damaged fronds before new growth develops. Cut close to the base without damaging emerging fronds."],
        ["Divide the clump", "Divide only when the clump becomes crowded and the garden plan requires it. Carry this out in spring."]
      ],
      tools: ["Watering can", "Gloves", "Clean garden shears"],
      showCodes: true
    }
  };
  const speciesCells = [...document.querySelectorAll(".species-cell[data-species]")];
  const speciesDetail = document.getElementById("species-detail");
  const speciesDetailTitle = document.getElementById("species-detail-title");
  const speciesDetailLocations = speciesDetail?.querySelector("[data-detail-locations]");
  const speciesDetailSummary = speciesDetail?.querySelector("[data-detail-summary]");
  const speciesDetailSections = speciesDetail?.querySelector("[data-detail-sections]");
  const speciesDetailQuick = speciesDetail?.querySelector("[data-detail-quick]");
  const speciesLocations = speciesDetail?.querySelector(".species-locations");
  const maintenanceLinks = [...document.querySelectorAll(
    '.primary-nav [data-route="maintenance"], .site-footer a[href="#maintenance"]'
  )];
  let openSpecies = "";

  function createLocationRow(location, options = {}) {
    const { showCode = true, showIsland = true } = options;
    const row = document.createElement("div");
    row.className = "location-row";

    const identity = document.createElement("div");
    if (showCode) {
      const code = document.createElement("strong");
      code.textContent = location.code;
      identity.append(code);
    }
    if (showIsland && location.island) {
      const island = document.createElement("span");
      island.textContent = location.island;
      identity.append(island);
    }

    const actions = document.createElement("div");
    actions.className = "location-actions";
    const mapLink = document.createElement("a");
    mapLink.href = location.map;
    mapLink.textContent = "View on Map →";
    actions.append(mapLink);
    if (location.d3) {
      const d3Link = document.createElement("a");
      d3Link.className = "link-3d";
      d3Link.href = location.d3;
      d3Link.textContent = "Open in 3D →";
      actions.append(d3Link);
    }

    if (showCode || (showIsland && location.island)) row.append(identity);
    row.append(actions);
    return row;
  }

  function createDetailSection(title, body, facts = []) {
    const section = document.createElement("section");
    section.className = "species-detail-section";
    const heading = document.createElement("h4");
    heading.textContent = title;
    const paragraph = document.createElement("p");
    paragraph.textContent = body;
    section.append(heading, paragraph);
    if (facts.length) {
      const list = document.createElement("ul");
      list.className = "species-detail-facts";
      facts.forEach((fact) => {
        const item = document.createElement("li");
        item.textContent = fact;
        list.append(item);
      });
      section.append(list);
    }
    return section;
  }

  function renderDetailSections(detail) {
    if (!speciesDetailSections) return;
    const identity = createDetailSection("What is it?", detail.identity.body, detail.identity.facts);
    const conditions = createDetailSection(
      "What conditions does it prefer?",
      detail.conditions.body,
      detail.conditions.facts
    );
    const watch = createDetailSection("What should you look for?", detail.watch);
    const care = document.createElement("section");
    care.className = "species-detail-section";
    const careHeading = document.createElement("h4");
    careHeading.textContent = "When and how should you care for it?";
    const tasks = document.createElement("div");
    tasks.className = "species-care-tasks";
    detail.care.forEach(([title, body]) => {
      const task = document.createElement("div");
      const heading = document.createElement("h5");
      heading.textContent = title;
      const paragraph = document.createElement("p");
      paragraph.textContent = body;
      task.append(heading, paragraph);
      tasks.append(task);
    });
    const toolsHeading = document.createElement("h5");
    toolsHeading.className = "species-tools-title";
    toolsHeading.textContent = "Tools";
    const tools = document.createElement("ul");
    tools.className = "species-tools";
    detail.tools.forEach((tool) => {
      const item = document.createElement("li");
      item.textContent = tool;
      tools.append(item);
    });
    care.append(careHeading, tasks, toolsHeading, tools);
    speciesDetailSections.replaceChildren(identity, conditions, watch, care);
  }

  function renderSpecies(key) {
    openSpecies = speciesData[key] ? key : "";

    speciesCells.forEach((item) => {
      const selected = item.dataset.species === openSpecies;
      item.classList.toggle("is-selected", selected);
      item.setAttribute("aria-expanded", String(selected));
      const toggle = item.querySelector("[data-species-toggle]");
      if (toggle) toggle.textContent = selected ? "Close ↑" : "Explore ↓";
    });

    if (!speciesDetail || !speciesDetailTitle || !speciesDetailLocations || !speciesDetailSummary) return;
    speciesDetail.hidden = !openSpecies;
    if (!openSpecies) return;

    const species = speciesData[openSpecies];
    const detail = speciesDetails[openSpecies];
    const hasMultipleLocations = species.locations.length > 1;
    if (speciesDetailQuick) {
      speciesDetailQuick.hidden = false;
      speciesDetailQuick.replaceChildren();
      speciesDetailQuick.classList.toggle("has-multiple", hasMultipleLocations);
      species.locations.forEach((location) => {
        speciesDetailQuick.append(createLocationRow(location, {
          showCode: detail.showCodes,
          showIsland: false
        }));
      });
    }
    if (speciesLocations) speciesLocations.hidden = true;
    speciesDetailTitle.textContent = species.en;
    renderDetailSections(detail);
    const japaneseName = document.createElement("span");
    japaneseName.className = "font-ja";
    japaneseName.lang = "ja";
    japaneseName.textContent = species.jp;
    speciesDetailSummary.replaceChildren(japaneseName, document.createTextNode(" "));
    const count = document.createElement("span");
    count.textContent = species.count;
    speciesDetailSummary.append(count);
    speciesDetailLocations.querySelectorAll(".location-row").forEach((row) => row.remove());
    species.locations.forEach((location) => speciesDetailLocations.append(createLocationRow(location)));
  }

  function updateSpeciesUrl(key) {
    const url = new URL(location.href);
    if (key) url.searchParams.set("species", key);
    else url.searchParams.delete("species");
    url.hash = "maintenance";
    history.pushState(history.state, "", url);
  }

  function toggleSpecies(cell) {
    const key = cell.dataset.species;
    const nextSpecies = openSpecies === key ? "" : key;
    renderSpecies(nextSpecies);
    updateSpeciesUrl(nextSpecies);
  }

  function restoreSpeciesFromUrl() {
    const key = new URLSearchParams(location.search).get("species") || "";
    renderSpecies(key);
  }

  speciesCells.forEach((cell) => {
    cell.addEventListener("click", () => toggleSpecies(cell));
    cell.addEventListener("keydown", (event) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      event.preventDefault();
      toggleSpecies(cell);
    });
  });
  maintenanceLinks.forEach((link) => {
    link.addEventListener("click", (event) => {
      event.preventDefault();
      renderSpecies("");
      const url = new URL(location.href);
      url.searchParams.delete("species");
      url.hash = "maintenance";
      history.pushState(history.state, "", url);
      window.dispatchEvent(new HashChangeEvent("hashchange"));
    });
  });
  window.addEventListener("popstate", restoreSpeciesFromUrl);
  restoreSpeciesFromUrl();

  const archiveTriggers = [...document.querySelectorAll(".archive-trigger[aria-controls]")];
  archiveTriggers.forEach((trigger) => {
    const panel = document.getElementById(trigger.getAttribute("aria-controls"));
    if (!panel) return;
    trigger.addEventListener("pointerup", () => trigger.blur());
    trigger.addEventListener("click", () => {
      const willOpen = trigger.getAttribute("aria-expanded") !== "true";
      trigger.setAttribute("aria-expanded", String(willOpen));
      panel.setAttribute("aria-hidden", String(!willOpen));
    });
  });

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
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
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
    requestCloudDraw();
  }

  function updateTarget() {
    target = Math.max(0, Math.min(1, (window.scrollY || 0) / (window.innerHeight * 0.9)));
    if (reducedMotion.matches) current = target;
    needsDraw = true;
    requestCloudDraw();
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
    needsDraw = false;
  }

  function requestCloudDraw() {
    if (!raf) raf = requestAnimationFrame(loop);
  }

  function loop() {
    raf = 0;
    if (reducedMotion.matches) current = target;
    else current += (target - current) * 0.1;
    const settling = Math.abs(target - current) > 0.001;
    if (needsDraw || settling) {
      drawCloud(current);
      if (!settling) needsDraw = false;
    }
    if (needsDraw || settling) requestCloudDraw();
  }

  window.addEventListener("hashchange", () => {
    if ((location.hash.slice(1) || "home").toLowerCase() === "home") requestAnimationFrame(drawCloudNow);
  });
  window.addEventListener("resize", resizeCloud);
  window.addEventListener("scroll", updateTarget, { passive: true });
  reducedMotion.addEventListener("change", () => {
    current = target;
    needsDraw = true;
    requestCloudDraw();
  });
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) {
      needsDraw = true;
      requestCloudDraw();
    }
  });
  resizeCloud();
  updateTarget();
  requestCloudDraw();
  window.addEventListener("pagehide", () => {
    cancelAnimationFrame(raf);
    raf = 0;
  }, { once: true });
})();
