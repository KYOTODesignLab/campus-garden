(() => {
  "use strict";

  const shouldLoadLiveMapPreview = location.hostname === "kyotodesignlab.github.io";
  const previewCards = [...document.querySelectorAll("[data-live-preview]")];
  previewCards.forEach((card) => {
    if (!card.classList.contains("tool-preview-map") || shouldLoadLiveMapPreview) return;
    const frame = card.querySelector("iframe[data-preview-src]");
    frame?.removeAttribute("data-preview-src");
    card.dataset.previewResolved = "true";
    card.classList.add("has-failed");
  });
  const queuedPreviewCards = previewCards.filter((card) => card.dataset.previewResolved !== "true");
  if (queuedPreviewCards.length) {
    const waiting = [];
    let loading = false;

    const loadNextPreview = () => {
      if (loading || !waiting.length) return;
      const card = waiting.shift();
      const frame = card.querySelector("iframe[data-preview-src]");
      if (!frame || frame.src) {
        loadNextPreview();
        return;
      }
      loading = true;
      let settled = false;
      const finish = (loaded) => {
        if (settled) return;
        settled = true;
        window.clearTimeout(timeout);
        if (loaded) card.classList.add("is-loaded");
        else card.classList.add("has-failed");
        loading = false;
        window.setTimeout(loadNextPreview, 120);
      };
      const timeout = window.setTimeout(() => finish(false), 10000);
      frame.addEventListener("load", () => finish(true), { once: true });
      frame.addEventListener("error", () => finish(false), { once: true });
      frame.src = frame.dataset.previewSrc;
      frame.removeAttribute("data-preview-src");
    };

    const queuePreview = (card) => {
      if (card.dataset.previewQueued === "true") return;
      card.dataset.previewQueued = "true";
      waiting.push(card);
      loadNextPreview();
    };

    if ("IntersectionObserver" in window) {
      const observer = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          observer.unobserve(entry.target);
          queuePreview(entry.target);
        });
      }, { rootMargin: "300px 0px" });
      queuedPreviewCards.forEach((card) => observer.observe(card));
    } else {
      queuedPreviewCards.forEach(queuePreview);
    }
  }

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
    '.primary-nav [data-route="maintenance"], .site-footer a[href="#maintenance"], .maintenance-context-nav'
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
    mapLink.className = "link-map";
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
  const archiveProjectLinks = [...document.querySelectorAll(".archive-project-link, .xr-back-link")];
  const projectsTrigger = document.querySelector('[aria-controls="archive-projects-panel"]');
  let pendingArchiveReturn = false;

  const archiveCategoryFromLocation = () => {
    const hash = location.hash.slice(1).toLowerCase();
    if (hash === "archive-activities") return "log";
    if (hash === "archive-photographs") return "photography";
    if (hash === "archive") return history.state?.archiveCategory || "";
    return null;
  };

  const setArchiveCategory = (category, { focus = false, updateHistory = false } = {}) => {
    archiveTriggers.forEach((trigger) => {
      const isOpen = trigger.dataset.archiveCategory === category;
      const panel = document.getElementById(trigger.getAttribute("aria-controls"));
      trigger.setAttribute("aria-expanded", String(isOpen));
      panel?.setAttribute("aria-hidden", String(!isOpen));
    });
    if (updateHistory) {
      history.pushState({ ...history.state, archiveCategory: category }, "", location.href);
    }
    if (focus && projectsTrigger) {
      requestAnimationFrame(() => projectsTrigger.focus({ preventScroll: true }));
    }
  };

  const openArchiveProjects = () => {
    pendingArchiveReturn = true;
    setArchiveCategory("projects");
  };

  archiveTriggers.forEach((trigger) => {
    trigger.addEventListener("pointerup", () => trigger.blur());
    trigger.addEventListener("click", () => {
      const willOpen = trigger.getAttribute("aria-expanded") !== "true";
      setArchiveCategory(willOpen ? trigger.dataset.archiveCategory : "", { updateHistory: true });
    });
  });
  archiveProjectLinks.forEach((link) => {
    link.addEventListener("pointerup", () => link.blur());
  });
  document.querySelectorAll("[data-open-archive-projects]").forEach((link) => {
    link.addEventListener("click", openArchiveProjects);
  });
  window.addEventListener("popstate", () => {
    const category = archiveCategoryFromLocation();
    if (category !== null) setArchiveCategory(category);
  });
  window.addEventListener("campus:route-rendered", () => {
    if (location.hash.toLowerCase() === "#archive" && pendingArchiveReturn) {
      pendingArchiveReturn = false;
      setArchiveCategory("projects", { focus: true });
      return;
    }
    const category = archiveCategoryFromLocation();
    if (category !== null) setArchiveCategory(category);
  });
  setArchiveCategory(archiveCategoryFromLocation() || "");

  const photoButtons = [...document.querySelectorAll(".archive-photo-button")];
  const photoLightbox = document.querySelector(".photo-lightbox");
  const photoLightboxImage = photoLightbox?.querySelector(".photo-lightbox-image");
  const photoLightboxClose = photoLightbox?.querySelector(".photo-lightbox-close");
  const photoLightboxPrevious = photoLightbox?.querySelector(".photo-lightbox-previous");
  const photoLightboxNext = photoLightbox?.querySelector(".photo-lightbox-next");
  const photoLightboxControls = [photoLightboxClose, photoLightboxPrevious, photoLightboxNext].filter(Boolean);
  let activePhotoIndex = 0;
  let photoReturnFocus = null;

  function showPhoto(index) {
    if (!photoLightboxImage || !photoButtons.length) return;
    activePhotoIndex = (index + photoButtons.length) % photoButtons.length;
    const source = photoButtons[activePhotoIndex].querySelector("img");
    if (!source) return;
    photoLightboxImage.src = source.currentSrc || source.src;
    photoLightboxImage.alt = source.alt;
  }

  function openPhotoLightbox(index, trigger) {
    if (!photoLightbox || !photoLightboxClose) return;
    photoReturnFocus = trigger;
    showPhoto(index);
    photoLightbox.hidden = false;
    document.body.classList.add("has-photo-lightbox");
    photoLightboxClose.focus({ preventScroll: true });
  }

  function closePhotoLightbox() {
    if (!photoLightbox || photoLightbox.hidden) return;
    photoLightbox.hidden = true;
    document.body.classList.remove("has-photo-lightbox");
    photoReturnFocus?.focus({ preventScroll: true });
    photoReturnFocus = null;
  }

  photoButtons.forEach((button, index) => {
    button.addEventListener("click", () => openPhotoLightbox(index, button));
  });
  photoLightboxClose?.addEventListener("click", closePhotoLightbox);
  photoLightboxPrevious?.addEventListener("click", () => showPhoto(activePhotoIndex - 1));
  photoLightboxNext?.addEventListener("click", () => showPhoto(activePhotoIndex + 1));
  photoLightbox?.addEventListener("click", (event) => {
    if (event.target === photoLightbox) closePhotoLightbox();
  });
  document.addEventListener("keydown", (event) => {
    if (!photoLightbox || photoLightbox.hidden) return;
    if (event.key === "Escape") {
      event.preventDefault();
      closePhotoLightbox();
      return;
    }
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      showPhoto(activePhotoIndex - 1);
      return;
    }
    if (event.key === "ArrowRight") {
      event.preventDefault();
      showPhoto(activePhotoIndex + 1);
      return;
    }
    if (event.key !== "Tab" || !photoLightboxControls.length) return;
    const firstControl = photoLightboxControls[0];
    const lastControl = photoLightboxControls[photoLightboxControls.length - 1];
    if (event.shiftKey && document.activeElement === firstControl) {
      event.preventDefault();
      lastControl.focus();
    } else if (!event.shiftKey && document.activeElement === lastControl) {
      event.preventDefault();
      firstControl.focus();
    }
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

(() => {
  "use strict";

  const header = document.querySelector(".site-header");
  const hero = document.querySelector(".cloud-hero");
  if (!header || !hero) return;

  const downwardThreshold = 8;
  const upwardThreshold = 24;
  const jitterThreshold = 2;
  let headerHeight = 0;
  const getScrollPosition = () => {
    const maxScroll = Math.max(
      0,
      document.documentElement.scrollHeight - window.innerHeight
    );
    const rawScrollY = window.scrollY;
    const normalizedScrollY = Math.min(maxScroll, Math.max(0, rawScrollY));
    return {
      normalizedScrollY,
      isOverscrolling: rawScrollY < 0 || rawScrollY > maxScroll
    };
  };
  let lastY = getScrollPosition().normalizedScrollY;
  let direction = 0;
  let accumulated = 0;
  let ticking = false;
  let routeHold = true;
  let midPageVisible = false;

  const hasHeaderFocus = () => header.contains(document.activeElement);

  function measure() {
    headerHeight = header.getBoundingClientRect().height;
    document.documentElement.style.setProperty("--header-height", `${headerHeight}px`);
  }

  function updateHeroState() {
    const isHome = document.body.classList.contains("home-view");
    const heroActive = isHome && hero.getBoundingClientRect().bottom > headerHeight;
    document.body.classList.toggle("home-hero-active", heroActive);
  }

  function setHeaderPosition(y, mode = "hiding") {
    header.style.setProperty("--header-translate-y", `${y}px`);
    header.classList.toggle("is-scroll-linked", mode === "linked");
    header.classList.toggle("is-scroll-revealing", mode === "revealing");
  }

  function showHeader({ immediate = false } = {}) {
    midPageVisible = true;
    setHeaderPosition(0, immediate ? "linked" : "revealing");
  }

  function hideHeader({ linked = false } = {}) {
    midPageVisible = false;
    setHeaderPosition(-headerHeight, linked ? "linked" : "hiding");
  }

  function updateScrollState() {
    ticking = false;
    const { normalizedScrollY: currentY, isOverscrolling } = getScrollPosition();
    if (isOverscrolling) {
      lastY = currentY;
      accumulated = 0;
      direction = 0;
      return;
    }
    const delta = currentY - lastY;
    lastY = currentY;
    updateHeroState();

    if (currentY < headerHeight) {
      if (midPageVisible && currentY > 0) {
        setHeaderPosition(0, "revealing");
      } else {
        midPageVisible = false;
        setHeaderPosition(-currentY, "linked");
      }
      accumulated = 0;
      direction = 0;
      routeHold = false;
      return;
    }
    if (routeHold) {
      showHeader({ immediate: true });
      accumulated = 0;
      direction = 0;
      routeHold = false;
      return;
    }
    if (hasHeaderFocus()) {
      showHeader();
      accumulated = 0;
      direction = 0;
      return;
    }

    if (!midPageVisible) hideHeader({ linked: true });
    if (Math.abs(delta) < jitterThreshold) return;
    const nextDirection = delta > 0 ? 1 : -1;
    if (nextDirection !== direction) {
      direction = nextDirection;
      accumulated = 0;
    }
    accumulated += Math.abs(delta);

    if (direction > 0 && midPageVisible && accumulated >= downwardThreshold) {
      hideHeader();
      accumulated = 0;
    } else if (direction < 0 && !midPageVisible && accumulated >= upwardThreshold) {
      showHeader();
      accumulated = 0;
    }
  }

  function requestUpdate() {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(updateScrollState);
  }

  function resetForRoute() {
    routeHold = true;
    showHeader({ immediate: true });
    accumulated = 0;
    direction = 0;
    lastY = getScrollPosition().normalizedScrollY;
    requestAnimationFrame(() => {
      measure();
      lastY = getScrollPosition().normalizedScrollY;
      midPageVisible = false;
      setHeaderPosition(-Math.min(lastY, headerHeight), "linked");
      updateHeroState();
    });
  }

  header.addEventListener("focusin", () => showHeader());
  window.addEventListener("scroll", requestUpdate, { passive: true });
  window.addEventListener("resize", () => {
    measure();
    requestUpdate();
  }, { passive: true });
  window.addEventListener("orientationchange", resetForRoute);
  window.addEventListener("pageshow", resetForRoute);
  window.addEventListener("popstate", resetForRoute);
  window.addEventListener("campus:route-rendered", resetForRoute);

  measure();
  setHeaderPosition(-Math.min(lastY, headerHeight), "linked");
  updateHeroState();
})();

// Home COPC introduction. This is deliberately isolated from the full Viewer:
// one reduced cloud, one fixed camera, no controls, and the procedural canvas
// remains underneath as the no-CORS / no-WebGL fallback.
(() => {
  "use strict";

  const hero = document.querySelector(".cloud-hero");
  const target = document.getElementById("cg-real-cloud");
  const cloudStage = document.querySelector(".cloud-stage");
  if (!hero || !target || !window.WebGL2RenderingContext) return;

  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const finePointer = window.matchMedia("(pointer: fine)");
  let instance = null;
  let cloud = null;
  let camera = null;
  let initialPosition = null;
  let initialTarget = null;
  let finalPosition = null;
  let finalTarget = null;
  let cameraTarget = null;
  let basePosition = null;
  let baseTarget = null;
  let viewDirection = null;
  let cameraRight = null;
  let cameraScreenUp = null;
  let cameraWorldUp = null;
  let pointerCameraOffset = null;
  let pointerTargetOffset = null;
  let targetProgress = 0;
  let currentProgress = 0;
  let lastRenderedProgress = -1;
  let targetOpacity = 1;
  let displayedOpacity = 1;
  let lastOpacityFrame = 0;
  let scrollRaf = 0;
  let loadTimeout = 0;
  let revealed = false;
  let cloudActive = true;
  let sceneReady = false;
  let pointerTargetX = 0;
  let pointerTargetY = 0;
  let pointerCurrentX = 0;
  let pointerCurrentY = 0;
  let pointerRaf = 0;
  let lastPointerFrame = 0;

  const pointerDeadZone = 0.06;
  const pointerHorizontalAmplitude = 0.055;
  const pointerVerticalAmplitude = 0.024;
  const pointerTargetRatio = 0.3;
  const pointerDamping = 8;
  const pointerEpsilon = 0.0005;

  const clamp01 = value => Math.max(0, Math.min(1, value));
  const clampSigned = value => Math.max(-1, Math.min(1, value));
  const smoothstep = value => {
    const t = clamp01(value);
    return t * t * (3 - 2 * t);
  };
  const applyDeadZone = value => {
    const magnitude = Math.abs(clampSigned(value));
    if (magnitude <= pointerDeadZone) return 0;
    return Math.sign(value) * (magnitude - pointerDeadZone) / (1 - pointerDeadZone);
  };

  function heroIsMeaningfullyVisible() {
    const bounds = hero.getBoundingClientRect();
    return bounds.bottom > 1
      && bounds.top < window.innerHeight - 1
      && bounds.right > 1
      && bounds.left < window.innerWidth - 1;
  }

  function pointerIsEligible() {
    return Boolean(
      instance
      && camera
      && sceneReady
      && document.visibilityState === "visible"
      && document.body.classList.contains("home-view")
      && finePointer.matches
      && !reducedMotion.matches
      && heroIsMeaningfullyVisible()
    );
  }

  function stopPointerRender() {
    if (pointerRaf) cancelAnimationFrame(pointerRaf);
    pointerRaf = 0;
    lastPointerFrame = 0;
  }

  function clearPointerOffset({ render = false } = {}) {
    pointerTargetX = 0;
    pointerTargetY = 0;
    pointerCurrentX = 0;
    pointerCurrentY = 0;
    stopPointerRender();
    if (render && instance && camera) renderCamera(currentProgress, true);
  }

  function requestPointerRender() {
    if (!pointerRaf && pointerIsEligible()) {
      pointerRaf = requestAnimationFrame(pointerTick);
    }
  }

  function resetPointer({ soft = true } = {}) {
    pointerTargetX = 0;
    pointerTargetY = 0;
    if (soft && pointerIsEligible()) {
      requestPointerRender();
    } else {
      clearPointerOffset();
    }
  }

  function fail(error) {
    clearTimeout(loadTimeout);
    sceneReady = false;
    clearPointerOffset();
    hero.classList.add("cloud-load-failed");
    hero.classList.remove("has-real-cloud");
    target.replaceChildren();
    console.error(`[Home cloud] COPC unavailable; using procedural fallback. ${error?.message || error}`);
  }

  function readScrollTarget() {
    targetProgress = clamp01((window.scrollY || 0) / Math.max(hero.offsetHeight, 1));
    if (reducedMotion.matches) currentProgress = targetProgress;
    if (!pointerIsEligible()) clearPointerOffset();
    requestScrollRender();
  }

  function renderCamera(progress, force = false) {
    if (!force && Math.abs(progress - lastRenderedProgress) < 0.0005) return;
    lastRenderedProgress = progress;
    if (
      !instance
      || !camera
      || !initialPosition
      || !initialTarget
      || !finalPosition
      || !finalTarget
      || !basePosition
      || !baseTarget
    ) return;

    const motionProgress = smoothstep(clamp01(progress / 0.89));
    basePosition.lerpVectors(initialPosition, finalPosition, motionProgress);
    baseTarget.lerpVectors(initialTarget, finalTarget, motionProgress);
    camera.position.copy(basePosition);
    cameraTarget.copy(baseTarget);

    if (
      (Math.abs(pointerCurrentX) > pointerEpsilon || Math.abs(pointerCurrentY) > pointerEpsilon)
      && pointerCameraOffset
      && pointerTargetOffset
    ) {
      const pointerStrength = 1 - 0.9 * motionProgress;
      viewDirection.subVectors(baseTarget, basePosition).normalize();
      cameraRight.crossVectors(viewDirection, cameraWorldUp).normalize();
      cameraScreenUp.crossVectors(cameraRight, viewDirection).normalize();
      pointerCameraOffset
        .copy(cameraRight)
        .multiplyScalar(pointerCurrentX * pointerHorizontalAmplitude * pointerStrength)
        .addScaledVector(
          cameraScreenUp,
          -pointerCurrentY * pointerVerticalAmplitude * pointerStrength
        );
      pointerTargetOffset.copy(pointerCameraOffset).multiplyScalar(pointerTargetRatio);
      camera.position.add(pointerCameraOffset);
      cameraTarget.add(pointerTargetOffset);
    }

    camera.up.set(0, 0, 1);
    camera.lookAt(cameraTarget);
    camera.updateMatrixWorld();

    // The cloud remains present through most of the Hero, then dissolves just
    // before the concept introduction reaches the main viewport.
    instance.notifyChange(camera);
  }

  function pointerTick(now) {
    pointerRaf = 0;
    if (!pointerIsEligible()) {
      clearPointerOffset();
      return;
    }

    const elapsed = lastPointerFrame ? (now - lastPointerFrame) / 1000 : 1 / 60;
    const dt = Math.min(elapsed > 0.1 ? 1 / 60 : elapsed, 0.05);
    const response = 1 - Math.exp(-pointerDamping * dt);
    pointerCurrentX += (pointerTargetX - pointerCurrentX) * response;
    pointerCurrentY += (pointerTargetY - pointerCurrentY) * response;

    const settled = Math.abs(pointerTargetX - pointerCurrentX) < pointerEpsilon
      && Math.abs(pointerTargetY - pointerCurrentY) < pointerEpsilon;
    if (settled) {
      pointerCurrentX = pointerTargetX;
      pointerCurrentY = pointerTargetY;
      lastPointerFrame = 0;
    } else {
      lastPointerFrame = now;
    }

    renderCamera(currentProgress, true);
    if (!settled) requestPointerRender();
  }

  function handlePointerMove(event) {
    if (event.pointerType !== "mouse" || !pointerIsEligible()) return;
    const bounds = hero.getBoundingClientRect();
    if (!bounds.width || !bounds.height) return;
    pointerTargetX = applyDeadZone(((event.clientX - bounds.left) / bounds.width) * 2 - 1);
    pointerTargetY = applyDeadZone(((event.clientY - bounds.top) / bounds.height) * 2 - 1);
    requestPointerRender();
  }

  function updateDisplayedOpacity(now) {
    targetOpacity = 1 - smoothstep((targetProgress - 0.18) / 0.62);

    if (!cloudActive && targetOpacity > 0.001) {
      cloudActive = true;
      if (cloud && instance) {
        cloud.visible = true;
        instance.notifyChange(cloud);
      }
    }

    const elapsed = lastOpacityFrame ? (now - lastOpacityFrame) / 1000 : 1 / 60;
    const dt = Math.min(elapsed > 0.1 ? 1 / 60 : elapsed, 0.05);
    const damping = 8;
    displayedOpacity += (targetOpacity - displayedOpacity) * (1 - Math.exp(-damping * dt));
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
      if (cloud && instance) {
        cloud.visible = false;
        instance.notifyChange(cloud);
      }
    }

    return Math.abs(targetOpacity - displayedOpacity) >= 0.001;
  }

  function scrollTick(now) {
    scrollRaf = 0;
    currentProgress = targetProgress;
    renderCamera(currentProgress);
    if (updateDisplayedOpacity(now)) requestScrollRender();
  }

  function requestScrollRender() {
    if (!scrollRaf) scrollRaf = requestAnimationFrame(scrollTick);
  }

  async function loadHomeCloud() {
    try {
      const {
        Instance,
        PointCloud,
        COPCSource,
        setLazPerfPath,
        CoordinateSystem,
        Vector3
      } = await import("./home-cloud-runtime.js");

      setLazPerfPath(new URL("./3d/wasm/", document.baseURI).href);

      const manifestResponse = await fetch("./3d/data/manifest.json", { cache: "no-store" });
      if (!manifestResponse.ok) throw new Error("manifest request failed");
      const manifest = await manifestResponse.json();
      const dataset = manifest.datasets?.find(entry => entry.id === "after")
        || manifest.datasets?.[0];
      if (!dataset?.url) throw new Error("no Home dataset in manifest");

      const source = new COPCSource({ url: dataset.url, decimate: 5 });
      await source.initialize();
      const metadata = await source.getMetadata();
      const sceneCrs = CoordinateSystem.register(
        "campus-garden-local",
        "+proj=merc +a=6378137 +b=6378137 +lat_ts=0 +lon_0=0 +x_0=0 +y_0=0 +k=1 +units=m +nadgrids=@null +wktext +no_defs +type=crs"
      );
      // The file's CRS record is present but incomplete, so use the known
      // local-coordinate scene consistently for both the source and entity.
      metadata.crs = sceneCrs;
      source.crs = sceneCrs;
      const getMetadata = source.getMetadata.bind(source);
      source.getMetadata = async () => {
        const value = await getMetadata();
        value.crs = sceneCrs;
        return value;
      };

      instance = new Instance({
        target,
        // The scan uses local engineering coordinates and declares no EPSG
        // code, so register an explicit local scene CRS without reprojecting.
        crs: sceneCrs,
        backgroundColor: null
      });
      instance.view.minNearPlane = 0.05;
      instance.view.camera.fov = 55;
      instance.view.camera.updateProjectionMatrix();
      instance.renderingOptions.enableEDL = false;

      cloud = new PointCloud({ source, crs: sceneCrs });
      await instance.add(cloud);
      cloud.pointBudget = 400000;
      cloud.subdivisionThreshold = 5;
      cloud.pointSize = 1.75;
      const rgbAttribute = metadata.attributes.find(attribute =>
        ["color", "rgb", "rgba"].includes(attribute.name.toLowerCase())
      );
      if (!rgbAttribute) throw new Error("RGB point attribute unavailable");
      cloud.setActiveAttribute(rgbAttribute.name);
      cloud.setColoringMode("attribute");

      camera = instance.view.camera;
      camera.position.set(
        -13.043801847145266,
        6.339309754185782,
        -0.07629245343807772
      );
      camera.up.set(0, 0, 1);
      initialTarget = new Vector3(
        -2.468417405801278,
        6.744621988767941,
        0.48083420543370564
      );
      camera.lookAt(initialTarget);
      camera.updateMatrixWorld();
      initialPosition = camera.position.clone();
      cameraTarget = initialTarget.clone();
      basePosition = initialPosition.clone();
      baseTarget = initialTarget.clone();
      viewDirection = new Vector3();
      cameraRight = new Vector3();
      cameraScreenUp = new Vector3();
      cameraWorldUp = new Vector3(0, 0, 1);
      pointerCameraOffset = new Vector3();
      pointerTargetOffset = new Vector3();
      finalPosition = new Vector3(
        -10.792192829131698,
        6.402349912058451,
        0.523615343617448
      );
      finalTarget = new Vector3(
        -2.502344914170061,
        6.720066662820123,
        1.1427106608064388
      );
      sceneReady = true;

      instance.addEventListener("update-end", () => {
        if (revealed || cloud.displayedPointCount < 1) return;
        revealed = true;
        clearTimeout(loadTimeout);
        hero.classList.add("has-real-cloud");
      });
      instance.notifyChange(camera);
      loadTimeout = window.setTimeout(() => {
        if (!revealed) fail(new Error("no point data rendered"));
      }, 30000);
      readScrollTarget();
    } catch (error) {
      fail(error);
    }
  }

  hero.addEventListener("pointermove", handlePointerMove, { passive: true });
  hero.addEventListener("pointerleave", () => resetPointer({ soft: true }), { passive: true });
  window.addEventListener("scroll", readScrollTarget, { passive: true });
  window.addEventListener("resize", () => {
    if (instance) instance.notifyChange();
    if (!pointerIsEligible()) clearPointerOffset();
    readScrollTarget();
  });
  reducedMotion.addEventListener("change", () => {
    currentProgress = targetProgress;
    if (reducedMotion.matches) clearPointerOffset({ render: true });
    requestScrollRender();
  });
  finePointer.addEventListener("change", () => {
    if (!finePointer.matches) clearPointerOffset({ render: true });
  });
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState !== "visible") {
      clearPointerOffset();
    } else if (sceneReady) {
      renderCamera(currentProgress, true);
    }
  });
  window.addEventListener("blur", () => resetPointer({ soft: true }));
  window.addEventListener("campus:route-rendered", () => {
    clearPointerOffset({ render: document.body.classList.contains("home-view") });
    readScrollTarget();
  });
  window.addEventListener("pagehide", () => {
    clearTimeout(loadTimeout);
    cancelAnimationFrame(scrollRaf);
    scrollRaf = 0;
    clearPointerOffset();
  }, { once: true });

  loadHomeCloud();
})();
