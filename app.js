import { initStarPage } from "./ui/starPage.js";
import { initSystemPage } from "./ui/systemPage.js";
import { initOuterObjectsPage } from "./ui/outerObjectsPage.js";
import { initPlanetPage } from "./ui/planetPage.js";
import { initMoonPage } from "./ui/moonPage.js";
import { initVisualiserPage } from "./ui/visualizerPage.js";
import { initLocalClusterPage } from "./ui/localClusterPage.js";
// localClusterVisualizerPage removed — unified into visualizerPage
import { initImportExportPage } from "./ui/importExportPage.js";
import { initAboutPage } from "./ui/aboutPage.js";
import { initApparentPage } from "./ui/apparentPage.js";
import { initCalendarPage } from "./ui/calendarPage.js";
import { initSciencePage } from "./ui/sciencePage.js";
import { initTectonicsPage } from "./ui/tectonicsPage.js";
import { initClimatePage } from "./ui/climatePage.js";
import { initPopulationPage } from "./ui/populationPage.js";
import { initLessonsPage } from "./ui/lessonsPage.js";
import { initScienceVisualiserPage } from "./ui/scienceVisualiserPage.js";
import * as store from "./ui/store.js";
import { createSolPresetEnvelope } from "./ui/solPreset.js";
import { showSplashOverlay } from "./ui/splashOverlay.js";
import { escapeHtml } from "./ui/uiHelpers.js";

const appEl = document.getElementById("app");
let startupSolPromptHandled = false;

/* ── Theme (light / dark) ─────────────────────────────── */
const THEME_KEY = "worldsmith.theme";
const SPLASH_ENABLED_KEY = "worldsmith.splash.enabled";

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
  // else leave default (dark — no attribute needed)

  const btn = document.getElementById("themeToggle");
  if (btn) {
    btn.addEventListener("click", () => {
      const current = document.documentElement.getAttribute("data-theme");
      const next = current === "light" ? "dark" : "light";
      applyTheme(next);
      localStorage.setItem(THEME_KEY, next);
    });
  }

  // Follow OS changes when user hasn't set a manual preference
  window.matchMedia("(prefers-color-scheme: light)").addEventListener("change", (e) => {
    if (!localStorage.getItem(THEME_KEY)) {
      applyTheme(e.matches ? "light" : "dark");
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

const PAGE_MAP = {
  star: initStarPage,
  system: initSystemPage,
  outer: initOuterObjectsPage,
  planet: initPlanetPage,
  moon: initMoonPage,
  viz: initVisualiserPage,
  cluster: initLocalClusterPage,
  galaxy: initLocalClusterPage,
  "cluster-viz": (el) => initVisualiserPage(el, { startMode: "cluster" }),
  io: initImportExportPage,
  apparent: initApparentPage,
  calendar: initCalendarPage,
  about: initAboutPage,
  science: initSciencePage,
  tectonics: initTectonicsPage,
  climate: initClimatePage,
  population: initPopulationPage,
  lessons: initLessonsPage,
  "science-viz": initScienceVisualiserPage,
};

function route() {
  const hash = location.hash || "#/star";
  const [_, path] = hash.split("#/");
  const key = (path || "star").split("?")[0];

  // highlight nav
  const navKey = key === "cluster-viz" ? "viz" : key;
  document.querySelectorAll(".side-nav__item").forEach((a) => {
    if (!a.getAttribute("href")) return;
    a.classList.toggle("is-active", a.getAttribute("href") === `#/${navKey}`);
  });

  appEl.innerHTML = "";

  const initFn = PAGE_MAP[key];
  if (initFn) {
    try {
      initFn(appEl);
    } catch (err) {
      console.error(`[WorldSmith] Failed to load page "${key}":`, err);
      appEl.innerHTML = `
        <div class="panel">
          <div class="panel__header"><h1 class="panel__title">Page Error</h1></div>
          <div class="panel__body">
            <p>Something went wrong loading the <b>${key}</b> page.</p>
            <pre style="white-space:pre-wrap;color:var(--bad)">${escapeHtml(String(err))}</pre>
            <p class="hint">Try refreshing, or choose another page from the navigation menu.</p>
          </div>
        </div>`;
    }
    return;
  }

  const safeKey = escapeHtml(key);
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
    route();
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
  if (hasSavedWorldData()) return;
  showStartupSolPresetPrompt();
}

window.addEventListener("hashchange", route);

/* ── Collapsible sidebar / mobile drawer ─────────────── */

function initNav() {
  const sideNav = document.querySelector(".side-nav");
  const hamburger = document.getElementById("navHamburger");
  const backdrop = document.getElementById("navBackdrop");

  // Always start collapsed
  sideNav?.classList.add("is-collapsed");

  // Click the collapsed rail to expand
  sideNav?.addEventListener("click", (e) => {
    if (!sideNav.classList.contains("is-collapsed")) return;
    // Don't expand if user clicked a nav link (let navigation happen)
    if (e.target.closest(".side-nav__item")) return;
    sideNav.classList.remove("is-collapsed");
  });

  // Click outside the expanded sidebar to collapse
  document.addEventListener("click", (e) => {
    if (!sideNav || sideNav.classList.contains("is-collapsed")) return;
    if (sideNav.contains(e.target)) return;
    sideNav.classList.add("is-collapsed");
  });

  // Collapse after clicking a nav link
  sideNav?.addEventListener("click", (e) => {
    if (e.target.closest(".side-nav__item")) {
      sideNav.classList.add("is-collapsed");
    }
  });

  // Escape key collapses sidebar
  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      sideNav?.classList.add("is-collapsed");
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

  backdrop?.addEventListener("click", closeMobileNav);
  window.addEventListener("hashchange", closeMobileNav);
}

function startApp() {
  initNav();
  route();
  maybeShowStartupSolPresetPrompt();
}

if (splashEnabled) {
  showSplashOverlay()
    .then(startApp)
    .catch((err) => {
      console.error("[WorldSmith] Splash overlay failed:", err);
      startApp();
    });
} else {
  startApp();
}
