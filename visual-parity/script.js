(() => {
  "use strict";

  const pages = [...document.querySelectorAll("[data-page]")];
  const navLinks = [...document.querySelectorAll(".primary-nav [data-route]")];
  const archiveTabs = [...document.querySelectorAll("[data-archive-tab]")];
  const archivePanels = [...document.querySelectorAll("[data-archive-panel]")];
  const mapFrame = document.getElementById("map-frame");
  const cloudFrame = document.getElementById("cloud-frame");
  const conditionsStatus = document.querySelector("[data-conditions-status]");
  const mapConditionsNote = document.querySelector("[data-map-conditions-note]");
  const conditionFields = [...document.querySelectorAll("[data-condition]")];
  const metricKeys = ["wind", "soil", "temp", "humidity", "light"];
  const sensorIds = ["s1", "s2", "s3", "s4"];
  let conditionsTimer = null;

  const routes = {
    home: { page: "home" },
    map: { page: "map" },
    "3d": { page: "3d" },
    maintenance: { page: "maintenance" },
    archive: { page: "archive", tab: "activities" },
    "archive-activities": { page: "archive", tab: "activities" },
    "archive-photographs": { page: "archive", tab: "photographs" },
    "archive-xr": { page: "archive", tab: "activities", target: "activity-xr" },
    "archive-campus": { page: "archive", tab: "activities", target: "activity-campus" },
    about: { page: "about" },
    people: { page: "people" }
  };

  function setArchiveTab(tab) {
    archiveTabs.forEach((link) => {
      const active = link.dataset.archiveTab === tab;
      link.setAttribute("aria-selected", String(active));
      link.tabIndex = active ? 0 : -1;
    });
    archivePanels.forEach((panel) => {
      panel.hidden = panel.dataset.archivePanel !== tab;
    });
  }

  function renderRoute() {
    const rawHash = location.hash.slice(1).toLowerCase() || "home";
    const route = routes[rawHash] || routes.home;

    pages.forEach((page) => {
      page.hidden = page.dataset.page !== route.page;
    });
    navLinks.forEach((link) => {
      if (link.dataset.route === route.page) {
        link.setAttribute("aria-current", "page");
      } else {
        link.removeAttribute("aria-current");
      }
    });

    if (route.page === "archive") {
      setArchiveTab(route.tab || "activities");
    }

    window.scrollTo({ top: 0, behavior: "auto" });
    if (route.target) {
      requestAnimationFrame(() => {
        const target = document.getElementById(route.target);
        if (target) target.scrollIntoView({ block: "start", behavior: "auto" });
      });
    }
  }

  function showConditionsFallback() {
    conditionsStatus.lastChild.textContent = "Current conditions · fallback values";
    mapConditionsNote.textContent = "Sensor model unavailable · showing reference values";
  }

  function updateCurrentConditions() {
    try {
      const sensorWindow = mapFrame.contentWindow;
      if (
        typeof sensorWindow.currentValue !== "function" ||
        typeof sensorWindow.fmtVal !== "function"
      ) {
        showConditionsFallback();
        return false;
      }

      metricKeys.forEach((metric) => {
        const average = sensorIds.reduce((sum, id) => {
          return sum + sensorWindow.currentValue({ id }, metric);
        }, 0) / sensorIds.length;
        const formatted = sensorWindow.fmtVal(average, metric);
        conditionFields
          .filter((field) => field.dataset.condition === metric)
          .forEach((field) => {
            field.textContent = formatted;
          });
      });

      conditionsStatus.lastChild.textContent = "Current conditions · observed now";
      mapConditionsNote.textContent = "Current modeled sensor readings · updated every 6 seconds";
      return true;
    } catch {
      showConditionsFallback();
      return false;
    }
  }

  function connectCurrentConditions() {
    window.clearInterval(conditionsTimer);
    updateCurrentConditions();
    conditionsTimer = window.setInterval(updateCurrentConditions, 6000);
  }

  function forwardPreviewState() {
    const params = new URLSearchParams(location.search);
    const stateParam = params.get("state");
    if (stateParam) cloudFrame.src = `../3d/#state=${stateParam}`;

    const openParam = params.get("open");
    const rangeParam = params.get("range");
    if (openParam || rangeParam) {
      const mapParams = new URLSearchParams();
      if (openParam) mapParams.set("open", openParam);
      if (rangeParam) mapParams.set("range", rangeParam);
      mapFrame.src = `../map-viewer/?${mapParams.toString()}`;
    }
  }

  mapFrame.addEventListener("load", connectCurrentConditions);
  window.addEventListener("hashchange", renderRoute);
  forwardPreviewState();
  showConditionsFallback();
  renderRoute();
})();
