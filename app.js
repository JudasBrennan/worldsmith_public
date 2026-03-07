// SPDX-License-Identifier: MPL-2.0
import { initStarPage } from "./ui/starPage.js";
import { initSystemPage } from "./ui/systemPage.js";
import { initOuterObjectsPage } from "./ui/outerObjectsPage.js";
import { initPlanetPage } from "./ui/planetPage.js";
import { initMoonPage } from "./ui/moonPage.js";
import { initLocalClusterPage } from "./ui/localClusterPage.js";
import { initImportExportPage } from "./ui/importExportPage.js";
import { initAboutPage } from "./ui/aboutPage.js";
import { initApparentPage } from "./ui/apparentPage.js";
import { initTectonicsPage } from "./ui/tectonicsPage.js";
import { initClimatePage } from "./ui/climatePage.js";
import { initPopulationPage } from "./ui/populationPage.js";
import * as store from "./ui/store.js";
import { createSolPresetEnvelope } from "./ui/solPreset.js";
import { showSplashOverlay } from "./ui/splashOverlay.js";
import { escapeHtml } from "./ui/uiHelpers.js";

const appEl = document.getElementById("app");
const appAlertsEl = document.getElementById("appAlerts");
let startupSolPromptHandled = false;
let currentPageCleanup = null;
let activeRouteToken = 0;
let dismissedStorageErrorKey = "";
let dismissedLoadFailureOverlayKey = "";
let storageRecoveryOverlay = null;

const THEME_KEY = "worldsmith.theme";
const SPLASH_ENABLED_KEY = "worldsmith.splash.enabled";
const NAV_LOCK_KEY = "worldsmith.nav.locked";

function currentStorageError() {
  return typeof store.getLastStorageError === "function" ? store.getLastStorageError() : null;
}

function currentWorldLoadFailure() {
  return typeof store.getWorldLoadFailure === "function" ? store.getWorldLoadFailure() : null;
}

function issueKey(issue) {
  if (!issue) return "";
  return [
    issue.stage || "",
    issue.sourceKey || "",
    issue.message || "",
    issue.cause || "",
    issue.detectedAt || "",
  ].join("|");
}

function downloadTextFile(filename, text, mimeType = "application/json") {
  const blob = new Blob([String(text ?? "")], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function closeStorageRecoveryOverlay() {
  if (!storageRecoveryOverlay) return;
  storageRecoveryOverlay.remove();
  storageRecoveryOverlay = null;
}

function openImportExportRoute() {
  closeStorageRecoveryOverlay();
  if (location.hash === "#/io") {
    void route();
    return;
  }
  location.hash = "#/io";
}

function renderStorageAlerts() {
  if (!appAlertsEl) return;
  appAlertsEl.replaceChildren();

  const loadFailure = currentWorldLoadFailure();
  if (loadFailure) {
    const backups = typeof store.listBackups === "function" ? store.listBackups().length : 0;
    const card = document.createElement("div");
    card.className = "app-alert app-alert--bad";
    card.id = "app-storage-load-alert";
    card.setAttribute("role", "alert");

    const content = document.createElement("div");
    content.className = "app-alert__content";

    const title = document.createElement("div");
    title.className = "app-alert__title";
    title.textContent = "Saved world could not be read";
    content.appendChild(title);

    const text = document.createElement("div");
    text.className = "app-alert__text";
    text.textContent =
      backups > 0
        ? `The current saved world is unreadable. ${backups} backup${backups === 1 ? "" : "s"} remain available in Import/Export.`
        : "The current saved world is unreadable. You can download the raw data, reset the broken save, or import a replacement world.";
    content.appendChild(text);

    if (loadFailure.cause) {
      const detail = document.createElement("div");
      detail.className = "app-alert__detail";
      detail.textContent = `Details: ${loadFailure.cause}`;
      content.appendChild(detail);
    }

    const actions = document.createElement("div");
    actions.className = "app-alert__actions";

    const openIoBtn = document.createElement("button");
    openIoBtn.id = "app-storage-open-io";
    openIoBtn.type = "button";
    openIoBtn.textContent = "Import/Export";
    openIoBtn.addEventListener("click", openImportExportRoute);
    actions.appendChild(openIoBtn);

    const downloadBtn = document.createElement("button");
    downloadBtn.id = "app-storage-download-raw";
    downloadBtn.type = "button";
    downloadBtn.textContent = "Download raw save";
    downloadBtn.addEventListener("click", () => {
      const failure = currentWorldLoadFailure();
      if (!failure?.raw) return;
      downloadTextFile("worldsmith-unreadable-save.json", failure.raw);
    });
    actions.appendChild(downloadBtn);

    const resetBtn = document.createElement("button");
    resetBtn.id = "app-storage-reset-world";
    resetBtn.type = "button";
    resetBtn.className = "danger";
    resetBtn.textContent = "Reset unreadable save";
    resetBtn.addEventListener("click", async () => {
      if (typeof store.clearUnreadableSavedWorld !== "function") return;
      const result = await store.clearUnreadableSavedWorld();
      if (!result?.ok) {
        dismissedStorageErrorKey = "";
      }
      renderStorageAlerts();
      if (result?.ok) openImportExportRoute();
    });
    actions.appendChild(resetBtn);

    card.append(content, actions);
    appAlertsEl.appendChild(card);
    return;
  }

  const storageError = currentStorageError();
  const errorKey = issueKey(storageError);
  if (!storageError || (errorKey && errorKey === dismissedStorageErrorKey)) {
    return;
  }

  const card = document.createElement("div");
  card.className = "app-alert app-alert--warn";
  card.id = "app-storage-warning-alert";
  card.setAttribute("role", "alert");

  const content = document.createElement("div");
  content.className = "app-alert__content";

  const title = document.createElement("div");
  title.className = "app-alert__title";
  title.textContent = "Storage warning";
  content.appendChild(title);

  const text = document.createElement("div");
  text.className = "app-alert__text";
  text.textContent = storageError.message || "WorldSmith hit a browser-storage problem.";
  content.appendChild(text);

  if (storageError.cause) {
    const detail = document.createElement("div");
    detail.className = "app-alert__detail";
    detail.textContent = `Details: ${storageError.cause}`;
    content.appendChild(detail);
  }

  const actions = document.createElement("div");
  actions.className = "app-alert__actions";

  const openIoBtn = document.createElement("button");
  openIoBtn.id = "app-storage-warning-open-io";
  openIoBtn.type = "button";
  openIoBtn.textContent = "Import/Export";
  openIoBtn.addEventListener("click", openImportExportRoute);
  actions.appendChild(openIoBtn);

  const dismissBtn = document.createElement("button");
  dismissBtn.id = "app-storage-warning-dismiss";
  dismissBtn.type = "button";
  dismissBtn.className = "small";
  dismissBtn.textContent = "Dismiss";
  dismissBtn.addEventListener("click", () => {
    dismissedStorageErrorKey = errorKey;
    if (typeof store.clearLastStorageError === "function") {
      store.clearLastStorageError();
    }
    renderStorageAlerts();
  });
  actions.appendChild(dismissBtn);

  card.append(content, actions);
  appAlertsEl.appendChild(card);
}

function showStorageRecoveryOverlay(force = false) {
  const failure = currentWorldLoadFailure();
  if (!failure) {
    closeStorageRecoveryOverlay();
    return;
  }

  const failureKey = issueKey(failure);
  if (!force && failureKey && failureKey === dismissedLoadFailureOverlayKey) {
    return;
  }
  if (storageRecoveryOverlay?.dataset.failureKey === failureKey) {
    return;
  }

  closeStorageRecoveryOverlay();

  const overlay = document.createElement("div");
  overlay.className = "storage-recovery-overlay";
  overlay.id = "storage-load-failure-overlay";
  overlay.dataset.failureKey = failureKey;

  const dialog = document.createElement("div");
  dialog.className = "storage-recovery-dialog panel";
  dialog.setAttribute("role", "dialog");
  dialog.setAttribute("aria-modal", "true");
  dialog.setAttribute("aria-labelledby", "storageRecoveryTitle");

  const header = document.createElement("div");
  header.className = "panel__header";

  const title = document.createElement("h2");
  title.id = "storageRecoveryTitle";
  title.className = "panel__title";
  title.textContent = "Saved world recovery";
  header.appendChild(title);

  const badge = document.createElement("div");
  badge.className = "badge bad";
  badge.textContent = failure.stage === "parse" ? "Parse failure" : "Migration failure";
  header.appendChild(badge);

  const body = document.createElement("div");
  body.className = "panel__body";

  const lead = document.createElement("p");
  lead.textContent =
    "WorldSmith found saved world data in this browser, but it could not be read safely.";
  body.appendChild(lead);

  const backups = typeof store.listBackups === "function" ? store.listBackups().length : 0;
  const hint = document.createElement("p");
  hint.className = "hint";
  hint.textContent =
    backups > 0
      ? `${backups} backup${backups === 1 ? "" : "s"} remain available. You can reset the unreadable current save and restore a backup from Import/Export.`
      : "No automatic backups were found. Download the raw data before resetting if you may need to inspect it later.";
  body.appendChild(hint);

  if (failure.cause) {
    const detail = document.createElement("div");
    detail.className = "derived-readout storage-recovery-detail";
    detail.textContent = `Details: ${failure.cause}`;
    body.appendChild(detail);
  }

  const actions = document.createElement("div");
  actions.className = "button-row storage-recovery-actions";

  const openIoBtn = document.createElement("button");
  openIoBtn.id = "storage-recovery-open-io";
  openIoBtn.type = "button";
  openIoBtn.textContent = "Open Import/Export";
  openIoBtn.addEventListener("click", openImportExportRoute);
  actions.appendChild(openIoBtn);

  const downloadBtn = document.createElement("button");
  downloadBtn.id = "storage-recovery-download";
  downloadBtn.type = "button";
  downloadBtn.textContent = "Download raw save";
  downloadBtn.addEventListener("click", () => {
    const currentFailure = currentWorldLoadFailure();
    if (!currentFailure?.raw) return;
    downloadTextFile("worldsmith-unreadable-save.json", currentFailure.raw);
  });
  actions.appendChild(downloadBtn);

  const resetBtn = document.createElement("button");
  resetBtn.id = "storage-recovery-reset";
  resetBtn.type = "button";
  resetBtn.className = "danger";
  resetBtn.textContent = "Reset unreadable save";
  resetBtn.addEventListener("click", async () => {
    if (typeof store.clearUnreadableSavedWorld !== "function") return;
    const result = await store.clearUnreadableSavedWorld();
    if (!result?.ok) {
      dismissedStorageErrorKey = "";
      renderStorageAlerts();
      return;
    }
    openImportExportRoute();
  });
  actions.appendChild(resetBtn);

  const dismissBtn = document.createElement("button");
  dismissBtn.id = "storage-recovery-dismiss";
  dismissBtn.type = "button";
  dismissBtn.className = "small";
  dismissBtn.textContent = "Dismiss";
  dismissBtn.addEventListener("click", () => {
    dismissedLoadFailureOverlayKey = failureKey;
    closeStorageRecoveryOverlay();
  });
  actions.appendChild(dismissBtn);

  body.appendChild(actions);
  dialog.append(header, body);
  overlay.appendChild(dialog);
  overlay.addEventListener("click", (event) => {
    if (event.target !== overlay) return;
    dismissedLoadFailureOverlayKey = failureKey;
    closeStorageRecoveryOverlay();
  });

  storageRecoveryOverlay = overlay;
  document.body.appendChild(overlay);
}

function syncStorageUi() {
  renderStorageAlerts();
  showStorageRecoveryOverlay(false);
}

function applyTheme(theme) {
  document.documentElement.setAttribute("data-theme", theme);
}

function initTheme() {
  const saved = localStorage.getItem(THEME_KEY);
  if (saved) {
    applyTheme(saved);
  } else if (window.matchMedia("(prefers-color-scheme: light)").matches) {
    applyTheme("light");
  }

  const btn = document.getElementById("themeToggle");
  if (btn) {
    btn.addEventListener("click", () => {
      const current = document.documentElement.getAttribute("data-theme");
      const next = current === "light" ? "dark" : "light";
      applyTheme(next);
      localStorage.setItem(THEME_KEY, next);
    });
  }

  window.matchMedia("(prefers-color-scheme: light)").addEventListener("change", (event) => {
    if (!localStorage.getItem(THEME_KEY)) {
      applyTheme(event.matches ? "light" : "dark");
    }
  });
}

initTheme();

function isSplashEnabled() {
  try {
    const saved = localStorage.getItem(SPLASH_ENABLED_KEY);
    if (saved === "0") return false;
    if (saved === "1") return true;
  } catch {
    // Ignore storage errors and keep default behavior.
  }
  return true;
}

function setSplashEnabled(enabled) {
  try {
    localStorage.setItem(SPLASH_ENABLED_KEY, enabled ? "1" : "0");
  } catch {
    // Ignore storage errors.
  }
}

function initSplashToggle() {
  const input = document.getElementById("splashToggle");
  const enabled = isSplashEnabled();
  if (!input) return enabled;
  input.checked = enabled;
  input.addEventListener("change", () => {
    setSplashEnabled(!!input.checked);
  });
  return enabled;
}

const splashEnabled = initSplashToggle();

function hasSavedWorldData() {
  if (typeof store.hasAnySavedData === "function") {
    return store.hasAnySavedData();
  }
  if (typeof store.hasSavedWorldInLocalStorage === "function") {
    return store.hasSavedWorldInLocalStorage();
  }
  try {
    return !!(
      localStorage.getItem("worldsmith.world.v1") || localStorage.getItem("worldsmith.world")
    );
  } catch {
    return false;
  }
}

function importWorldData(world) {
  if (typeof store.importWorld === "function") {
    store.importWorld(world);
    return true;
  }
  return false;
}

function eagerPage(init, label) {
  return {
    label,
    lazy: false,
    load: async () => init,
  };
}

function lazyPage(load, label) {
  return {
    label,
    lazy: true,
    load,
  };
}

const PAGE_MAP = {
  star: eagerPage(initStarPage, "Star"),
  system: eagerPage(initSystemPage, "Planetary System"),
  outer: eagerPage(initOuterObjectsPage, "Other Objects"),
  planet: eagerPage(initPlanetPage, "Planets"),
  moon: eagerPage(initMoonPage, "Moons"),
  viz: lazyPage(async () => {
    const mod = await import("./ui/visualizerPage.js");
    return mod.initVisualiserPage;
  }, "System Visualiser"),
  cluster: eagerPage(initLocalClusterPage, "Local Cluster"),
  galaxy: eagerPage(initLocalClusterPage, "Local Cluster"),
  "cluster-viz": lazyPage(async () => {
    const mod = await import("./ui/visualizerPage.js");
    return (el) => mod.initVisualiserPage(el, { startMode: "cluster" });
  }, "Cluster Visualiser"),
  io: eagerPage(initImportExportPage, "Import/Export"),
  apparent: eagerPage(initApparentPage, "Apparent Size and Brightness"),
  calendar: lazyPage(async () => {
    const mod = await import("./ui/calendarPage.js");
    return mod.initCalendarPage;
  }, "Calendar"),
  about: eagerPage(initAboutPage, "About WorldSmith"),
  science: lazyPage(async () => {
    const mod = await import("./ui/sciencePage.js");
    return mod.initSciencePage;
  }, "Science and Maths"),
  tectonics: eagerPage(initTectonicsPage, "Tectonics"),
  climate: eagerPage(initClimatePage, "Climate Zones"),
  population: eagerPage(initPopulationPage, "Population"),
  lessons: lazyPage(async () => {
    const mod = await import("./ui/lessonsPage.js");
    return mod.initLessonsPage;
  }, "Lessons"),
  "science-viz": lazyPage(async () => {
    const mod = await import("./ui/scienceVisualiserPage.js");
    return mod.initScienceVisualiserPage;
  }, "Science Visualiser"),
};

function cleanupCurrentPage() {
  if (typeof currentPageCleanup !== "function") {
    currentPageCleanup = null;
    return;
  }
  try {
    currentPageCleanup();
  } catch (err) {
    console.error("[WorldSmith] Page cleanup failed:", err);
  } finally {
    currentPageCleanup = null;
  }
}

function renderRouteLoading(label) {
  const safeLabel = escapeHtml(label || "page");
  appEl.innerHTML = `
    <div class="panel">
      <div class="panel__header"><h1 class="panel__title">Loading</h1></div>
      <div class="panel__body">
        <p>Loading <b>${safeLabel}</b>...</p>
      </div>
    </div>
  `;
}

async function route() {
  const hash = location.hash || "#/star";
  const [_, path] = hash.split("#/");
  const key = (path || "star").split("?")[0];
  const routeToken = ++activeRouteToken;

  const navKey = key === "cluster-viz" ? "viz" : key;
  document.querySelectorAll(".side-nav__item").forEach((link) => {
    if (!link.getAttribute("href")) return;
    link.classList.toggle("is-active", link.getAttribute("href") === `#/${navKey}`);
  });

  cleanupCurrentPage();
  appEl.innerHTML = "";

  const pageSpec = PAGE_MAP[key];
  if (pageSpec) {
    if (pageSpec.lazy) {
      renderRouteLoading(pageSpec.label || key);
    }

    try {
      const initFn = await pageSpec.load();
      if (routeToken !== activeRouteToken) return;
      appEl.innerHTML = "";
      const maybeCleanup = initFn(appEl);
      currentPageCleanup = typeof maybeCleanup === "function" ? maybeCleanup : null;
    } catch (err) {
      if (routeToken !== activeRouteToken) return;
      console.error(`[WorldSmith] Failed to load page "${key}":`, err);
      currentPageCleanup = null;
      appEl.innerHTML = `
        <div class="panel">
          <div class="panel__header"><h1 class="panel__title">Page Error</h1></div>
          <div class="panel__body">
            <p>Something went wrong loading the <b>${key}</b> page.</p>
            <pre style="white-space:pre-wrap;color:var(--bad)">${escapeHtml(String(err))}</pre>
            <p class="hint">Try refreshing, or choose another page from the navigation menu.</p>
          </div>
        </div>
      `;
    }
    return;
  }

  const safeKey = escapeHtml(key);
  currentPageCleanup = null;
  appEl.innerHTML = `
    <div class="panel">
      <div class="panel__header"><h1>Coming soon</h1></div>
      <div class="panel__body">
        <div class="page-title">#/ ${safeKey}</div>
        <p class="muted">This section is not available in the current release.</p>
        <p>Please choose a tab from the navigation menu.</p>
      </div>
    </div>
  `;
}

function showStartupSolPresetPrompt() {
  const overlay = document.createElement("div");
  overlay.className = "startup-sol-overlay";
  overlay.innerHTML = `
    <div class="startup-sol-dialog panel" role="dialog" aria-modal="true" aria-labelledby="startupSolTitle">
      <div class="panel__header">
        <h2 id="startupSolTitle" class="panel__title">
          <span class="ws-icon icon--import-export" aria-hidden="true"></span>
          <span>Import Sol Preset?</span>
        </h2>
        <div class="badge">Quick start</div>
      </div>
      <div class="panel__body">
        <p>No saved world data was found in this browser.</p>
        <p class="hint">Would you like to import the built-in Sol preset now?</p>
        <div class="button-row startup-sol-actions">
          <button type="button" id="startup-sol-yes" class="primary">Yes</button>
          <button type="button" id="startup-sol-no">No</button>
        </div>
      </div>
    </div>
  `;

  function close() {
    overlay.remove();
    window.removeEventListener("keydown", onKeyDown);
  }

  function onKeyDown(event) {
    if (event.key === "Escape") close();
  }

  const btnYes = overlay.querySelector("#startup-sol-yes");
  const btnNo = overlay.querySelector("#startup-sol-no");
  btnNo?.addEventListener("click", close);
  btnYes?.addEventListener("click", () => {
    const envelope = createSolPresetEnvelope();
    importWorldData(envelope.world);
    close();
    void route();
  });

  overlay.addEventListener("click", (event) => {
    if (event.target === overlay) close();
  });
  window.addEventListener("keydown", onKeyDown);
  document.body.appendChild(overlay);
}

function maybeShowStartupSolPresetPrompt() {
  if (startupSolPromptHandled) return;
  startupSolPromptHandled = true;
  if (typeof store.hasWorldLoadFailure === "function" && store.hasWorldLoadFailure()) return;
  if (hasSavedWorldData()) return;
  showStartupSolPresetPrompt();
}

window.addEventListener("worldsmith:storageError", () => {
  dismissedStorageErrorKey = "";
  renderStorageAlerts();
});

window.addEventListener("worldsmith:worldLoadFailure", () => {
  renderStorageAlerts();
  showStorageRecoveryOverlay(true);
});

window.addEventListener("worldsmith:worldLoadRecovered", () => {
  closeStorageRecoveryOverlay();
  renderStorageAlerts();
});

window.addEventListener("hashchange", () => {
  void route();
});

function initNav() {
  const sideNav = document.querySelector(".side-nav");
  const hamburger = document.getElementById("navHamburger");
  const backdrop = document.getElementById("navBackdrop");
  const navLockToggle = document.getElementById("navLockToggle");

  function isMobileViewport() {
    return window.matchMedia("(max-width: 980px)").matches;
  }

  function readNavLocked() {
    try {
      return localStorage.getItem(NAV_LOCK_KEY) === "1";
    } catch {
      return false;
    }
  }

  function writeNavLocked(locked) {
    try {
      localStorage.setItem(NAV_LOCK_KEY, locked ? "1" : "0");
    } catch {
      // Ignore storage errors.
    }
  }

  function syncNavLockToggle() {
    if (!navLockToggle || !sideNav) return;
    const locked = sideNav.classList.contains("is-locked");
    const hidden = isMobileViewport() || sideNav.classList.contains("is-collapsed");
    navLockToggle.hidden = hidden;
    navLockToggle.setAttribute("aria-pressed", locked ? "true" : "false");
    navLockToggle.setAttribute(
      "aria-label",
      locked ? "Unlock expanded navigation" : "Lock navigation open",
    );
    navLockToggle.title = locked ? "Unlock expanded navigation" : "Lock navigation open";
  }

  function expandDesktopNav() {
    if (!sideNav || isMobileViewport()) return;
    sideNav.classList.remove("is-collapsed");
    syncNavLockToggle();
  }

  function collapseDesktopNav() {
    if (!sideNav || isMobileViewport() || sideNav.classList.contains("is-locked")) return;
    sideNav.classList.add("is-collapsed");
    syncNavLockToggle();
  }

  function setNavLocked(locked) {
    if (!sideNav) return;
    sideNav.classList.toggle("is-locked", locked);
    writeNavLocked(locked);
    if (locked) {
      sideNav.classList.remove("is-collapsed");
    }
    syncNavLockToggle();
  }

  if (sideNav) {
    if (readNavLocked()) {
      sideNav.classList.add("is-locked");
      sideNav.classList.remove("is-collapsed");
    } else {
      sideNav.classList.remove("is-locked");
      sideNav.classList.add("is-collapsed");
    }
    syncNavLockToggle();
  }

  sideNav?.addEventListener("click", (event) => {
    if (isMobileViewport()) return;
    if (!sideNav.classList.contains("is-collapsed")) return;
    if (event.target.closest(".side-nav__item")) return;
    expandDesktopNav();
  });

  document.addEventListener("click", (event) => {
    if (!sideNav || isMobileViewport() || sideNav.classList.contains("is-collapsed")) return;
    if (sideNav.contains(event.target)) return;
    collapseDesktopNav();
  });

  sideNav?.addEventListener("click", (event) => {
    if (!event.target.closest(".side-nav__item")) return;
    collapseDesktopNav();
  });

  window.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      collapseDesktopNav();
      closeMobileNav();
    }
  });

  function closeMobileNav() {
    sideNav?.classList.remove("is-open");
    backdrop?.classList.remove("is-visible");
  }

  hamburger?.addEventListener("click", () => {
    sideNav?.classList.add("is-open");
    backdrop?.classList.add("is-visible");
  });

  navLockToggle?.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    const locked = !sideNav?.classList.contains("is-locked");
    setNavLocked(locked);
  });

  backdrop?.addEventListener("click", closeMobileNav);
  window.addEventListener("hashchange", closeMobileNav);
  window.addEventListener("resize", syncNavLockToggle);
}

async function startApp() {
  initNav();
  if (typeof store.waitForStorageReady === "function") {
    try {
      await store.waitForStorageReady();
    } catch (err) {
      console.error("[WorldSmith] Storage bootstrap failed:", err);
    }
  }
  syncStorageUi();
  await route();
  syncStorageUi();
  maybeShowStartupSolPresetPrompt();
}

if (splashEnabled) {
  showSplashOverlay()
    .then(() => startApp())
    .catch((err) => {
      console.error("[WorldSmith] Splash overlay failed:", err);
      void startApp();
    });
} else {
  void startApp();
}
