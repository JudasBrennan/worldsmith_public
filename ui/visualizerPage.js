import {
  GAS_GIANT_RADIUS_MAX_RJ,
  GAS_GIANT_RADIUS_MIN_RJ,
  loadWorld,
  listPlanets,
  listMoons,
  listSystemGasGiants,
  listSystemDebrisDisks,
} from "./store.js";
import { calcSystem } from "../engine/system.js";
import { calcStar, starColourHexFromTempK } from "../engine/star.js";
import { calcPlanetExact } from "../engine/planet.js";
import { calcMoonExact } from "../engine/moon.js";
import { calcGasGiant } from "../engine/gasGiant.js";
import {
  computeFlareParams,
  scheduleNextFlare,
  maybeSpawnCME,
  flareClassFromEnergy,
  createSeededRng,
} from "../engine/stellarActivity.js";
import { attachTooltips, tipIcon } from "./tooltip.js";
import { captureCanvasGif, downloadCanvasPng, makeTimestampToken } from "./canvasExport.js";
import { gasStylePalette, drawGasGiantViz } from "./gasGiantStyles.js";
import { drawTransitionBar } from "./vizTransition.js";
import { buildClusterSnapshot, drawClusterScene } from "./vizClusterRenderer.js";

function hashUnit(str) {
  // deterministic 0..1 hash
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) / 4294967295;
}

function clamp(v, a, b) {
  return Math.max(a, Math.min(b, v));
}

function dbg(enabled, ...args) {
  if (!enabled) return;
  console.log("[viz]", ...args);
}

const SOL_RADIUS_KM = 696340;
const JUPITER_RADIUS_KM = 71492;
const EARTH_RADIUS_KM = 6371;
const MOON_RADIUS_KM = 1737.4;
const EARTH_PER_MSOL = 332946; // Earth masses per solar mass
const MJUP_PER_MSOL = 1047.35; // Jupiter masses per solar mass

// gasStylePalette and getStyleById imported from ./gasGiantStyles.js

function gasGiantRadiusToPx(radiusRj, style) {
  const radius = clamp(
    Number.isFinite(radiusRj) ? radiusRj : 1,
    GAS_GIANT_RADIUS_MIN_RJ,
    GAS_GIANT_RADIUS_MAX_RJ,
  );
  const span = Math.max(0.001, GAS_GIANT_RADIUS_MAX_RJ - GAS_GIANT_RADIUS_MIN_RJ);
  const t = (radius - GAS_GIANT_RADIUS_MIN_RJ) / span;
  const baseSize = 8 + t * 12;
  const palSize = gasStylePalette(style).size;
  // Scale relative to the default palette size of 14
  return baseSize * (palSize / 14);
}

function planetRadiusToPx(radiusEarth) {
  const radius = Number.isFinite(radiusEarth) && radiusEarth > 0 ? radiusEarth : 1;
  // Keep physical-radius proportionality while preserving readability at small sizes.
  return clamp(radius * 5.5, 3.2, 16);
}

// Representative moon size: fraction of parent pixel radius, scaled by the
// compressed physical size ratio so large moons (Earth's Moon) are visible
// but tiny ones (Phobos) don't dwarf their parent.
function representativeMoonR(moonKm, parentKm, parentPr) {
  const mk = Number(moonKm);
  const pk = Number(parentKm);
  if (mk > 0 && pk > 0) {
    const ratio = Math.pow(mk / pk, 0.4);
    return Math.max(1.2, parentPr * clamp(ratio, 0.08, 0.5));
  }
  return Math.max(1.2, parentPr * 0.25);
}

function physicalRadiusToPx(bodyRadiusKm, starRadiusPx, starRadiusKm, minPx = 0.35, maxPx = 24) {
  const bodyKm = Number(bodyRadiusKm);
  const starKm = Number(starRadiusKm);
  if (
    !Number.isFinite(bodyKm) ||
    bodyKm <= 0 ||
    !Number.isFinite(starKm) ||
    starKm <= 0 ||
    !Number.isFinite(starRadiusPx) ||
    starRadiusPx <= 0
  ) {
    return minPx;
  }
  return clamp((bodyKm / starKm) * starRadiusPx, minPx, maxPx);
}

// In 1:1 physical-scale mode bodies are often sub-pixel. Anything smaller than this
// threshold is replaced by a position-indicator crosshair so the user can see WHERE
// the body is without misrepresenting its size.
const PHYS_VIS_THRESHOLD_PX = 1.5;

function drawPositionIndicator(ctx, x, y, color) {
  const ARM = 4;
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = 0.75;
  ctx.globalAlpha = 0.8;
  ctx.beginPath();
  ctx.moveTo(x - ARM, y);
  ctx.lineTo(x + ARM, y);
  ctx.moveTo(x, y - ARM);
  ctx.lineTo(x, y + ARM);
  ctx.stroke();
  ctx.fillStyle = color;
  ctx.globalAlpha = 0.9;
  ctx.beginPath();
  ctx.arc(x, y, 1.25, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

const TIP_LABEL = {
  Labels: "Show or hide text labels for star, planets, moons, gas giants, and debris disks.",
  Moons: "Show or hide moon markers around planets and gas giants.",
  Orbits: "Show or hide orbital rings for planets, moons, gas giants, and the H2O frost line.",
  "Logarithmic scale":
    "Use logarithmic AU spacing. Turn off to view orbital distances on linear scale.",
  "Physical size scale":
    "Representative keeps bodies easy to read. 1:1 scales body radii against the star radius while keeping the star's on-screen size fixed.",
  "Habitable zone": "Show or hide the habitable-zone band (between HZ inner and HZ outer limits).",
  "Debris disks": "Show or hide debris disk bands and asteroid field particles.",
  "Eccentric orbits":
    "When enabled, planet orbits are drawn as ellipses using each planet's saved eccentricity and longitude of periapsis. The planet also moves faster near periapsis and slower near apoapsis (Kepler's second law via the eccentric anomaly).\n\nWhen disabled (default), orbits are drawn as perfect circles — cleaner for typical near-circular worlds.",
  "Pe / Ap markers":
    "Show periapsis (closest approach) and apoapsis (farthest point) markers on eccentric orbits.",
  "Hill spheres":
    "Show the Hill sphere \u2014 the gravitational sphere of influence \u2014 around each planet and gas giant. Defines the maximum region where stable satellite orbits can exist.",
  "Frost line":
    "Show the H\u2082O frost line \u2014 the distance beyond which water ice can condense.",
  Distances: "Show orbital distance (AU) alongside body name labels.",
  "AU grid": "Draw faint concentric reference rings at round AU intervals for scale.",
  Debug: "Enable console debug logging for visualiser internals.",
  Speed: "Animation speed in simulated Earth-days per second.",
  Centre: "Reset camera orientation and zoom to the default centered view.",
  Refresh: "Redraw the visualiser using the latest saved world data.",
  Play: "Toggle orbital animation on or off.",
  "Reset view": "Reset zoom and pan back to the default overview.",
  Controls: "Toggle the controls panel for display options, animation, and scale settings.",
  Fullscreen: "Enter browser fullscreen mode for an immersive view.",
  "Download image": "Save a static PNG snapshot of the current canvas view.",
  "Download GIF":
    "Save a short animated GIF from the current canvas. This is available only while animation is playing.",
  /* Cluster-mode labels */
  "Cluster Labels": "Show or hide name labels on plotted systems.",
  Links: "Draw guide lines from each system to its nearest point on the X/Z plane.",
  Axes: "Show X/Y/Z reference axes.",
  "Range/Bearing Grid": "Show or hide distance rings and degree bearings on the X/Z plane.",
  "Bearing Units": "Switch bearing labels between degrees (360) and mils (6400).",
  "Cluster Speed": "Auto-spin speed multiplier.",
};

export function initVisualiserPage(root, options = {}) {
  root.innerHTML = `
    <div class="page">
      <div class="viz-layout">
        <div class="panel">
          <div class="panel__header">
            <h1 class="panel__title"><span class="ws-icon icon--visualiser" aria-hidden="true"></span><span id="viz-title">System Visualiser</span></h1>
            <div class="viz-canvas-actions">
              <button id="btn-controls" type="button" class="small">${tipIcon(TIP_LABEL["Controls"] || "")} Controls &#x25BE;</button>
              <button id="btn-reset-view" type="button" class="small" disabled>${tipIcon(TIP_LABEL["Reset view"] || "")} Reset view</button>
              <button id="btn-fullscreen" type="button" class="small">${tipIcon(TIP_LABEL["Fullscreen"] || "")} Fullscreen</button>
              <button id="btn-export-image" type="button" class="small">Download image</button>
              <button id="btn-export-gif" type="button" class="small" disabled>Download GIF</button>
            </div>
          </div>

          <div class="viz-canvas-area">
          <div id="viz-controls-dropdown" class="viz-controls-dropdown" style="display:none">
            <div id="viz-controls-system">
            <div class="viz-controls-dropdown__row">
              <button id="btn-refresh" type="button" class="small">Refresh</button>
              <button id="btn-play" type="button" class="small">Play</button>
              <div class="viz-speed">
                <span class="viz-speed__label">Speed ${tipIcon(TIP_LABEL["Speed"] || "")}</span>
                <input id="rng-speed" type="range" min="0" max="4" step="1" value="1" />
                <span id="txt-speed" class="viz-speed__value">0.5 d/s</span>
              </div>
            </div>

            <div id="body-scale-row" class="viz-controls-dropdown__row">
              <div class="viz-speed">
                <span class="viz-speed__label">Body scale</span>
                <input id="rng-body-scale" type="range" min="25" max="100" step="1" value="40" />
                <span id="txt-body-scale" class="viz-speed__value">40%</span>
              </div>
            </div>

            <div class="viz-controls-dropdown__row viz-controls-dropdown__toggles">
              <div class="pill-toggle-wrap">
                <div class="physics-duo-toggle" data-toggle="distance">
                  <input type="radio" name="vizDistanceScale" id="vizDistLinear" value="linear" checked />
                  <label for="vizDistLinear">Linear scale</label>
                  <input type="radio" name="vizDistanceScale" id="vizDistLog" value="log" />
                  <label for="vizDistLog">Logarithmic scale</label>
                  <span></span>
                </div>
                ${tipIcon(TIP_LABEL["Logarithmic scale"] || "")}
              </div>
              <div class="pill-toggle-wrap">
                <div class="physics-duo-toggle" data-toggle="size">
                  <input type="radio" name="vizSizeScale" id="vizSizeRep" value="representative" checked />
                  <label for="vizSizeRep">Representative size</label>
                  <input type="radio" name="vizSizeScale" id="vizSizePhysical" value="physical" />
                  <label for="vizSizePhysical">1:1 size</label>
                  <span></span>
                </div>
                ${tipIcon(TIP_LABEL["Physical size scale"] || "")}
              </div>
            </div>

            <div class="viz-controls-dropdown__row viz-controls-dropdown__checks">
              <label class="viz-check"><input id="chk-labels" type="checkbox" checked /><span>Labels ${tipIcon(TIP_LABEL["Labels"] || "")}</span></label>
              <label class="viz-check"><input id="chk-moons" type="checkbox" checked /><span>Moons ${tipIcon(TIP_LABEL["Moons"] || "")}</span></label>
              <label class="viz-check"><input id="chk-orbits" type="checkbox" checked /><span>Orbits ${tipIcon(TIP_LABEL["Orbits"] || "")}</span></label>
              <label class="viz-check"><input id="chk-hz" type="checkbox" checked /><span>Habitable zone ${tipIcon(TIP_LABEL["Habitable zone"] || "")}</span></label>
              <label class="viz-check"><input id="chk-debris" type="checkbox" checked /><span>Debris disks ${tipIcon(TIP_LABEL["Debris disks"] || "")}</span></label>
              <label class="viz-check"><input id="chk-eccentric" type="checkbox" /><span>Eccentric orbits ${tipIcon(TIP_LABEL["Eccentric orbits"] || "")}</span></label>
              <label class="viz-check"><input id="chk-pe-ap" type="checkbox" /><span>Pe / Ap markers ${tipIcon(TIP_LABEL["Pe / Ap markers"] || "")}</span></label>
              <label class="viz-check"><input id="chk-hill" type="checkbox" /><span>Hill spheres ${tipIcon(TIP_LABEL["Hill spheres"] || "")}</span></label>
              <label class="viz-check"><input id="chk-frost" type="checkbox" checked /><span>Frost line ${tipIcon(TIP_LABEL["Frost line"] || "")}</span></label>
              <label class="viz-check"><input id="chk-distances" type="checkbox" checked /><span>Distances ${tipIcon(TIP_LABEL["Distances"] || "")}</span></label>
              <label class="viz-check"><input id="chk-grid" type="checkbox" /><span>AU grid ${tipIcon(TIP_LABEL["AU grid"] || "")}</span></label>
              <label class="viz-check"><input id="chk-debug" type="checkbox" /><span>Debug ${tipIcon(TIP_LABEL["Debug"] || "")}</span></label>
            </div>

            <div class="viz-controls-dropdown__row">
              <div class="hint">Left-drag to pan, right-drag to rotate, mouse wheel to zoom, click a body to focus-follow.</div>
            </div>
            </div>

            <div id="viz-controls-cluster" style="display:none">
            <div class="viz-controls-dropdown__row">
              <button id="btn-cluster-refresh" type="button" class="small">Refresh</button>
              <button id="btn-cluster-play" type="button" class="small">Play</button>
              <div class="viz-speed">
                <span class="viz-speed__label">Speed ${tipIcon(TIP_LABEL["Cluster Speed"] || "")}</span>
                <input id="rng-cluster-speed" type="range" min="0" max="4" step="1" value="1" />
                <span id="txt-cluster-speed" class="viz-speed__value">0.5x</span>
              </div>
            </div>

            <div class="viz-controls-dropdown__row viz-controls-dropdown__toggles">
              <div class="pill-toggle-wrap">
                <div class="physics-duo-toggle" data-toggle="bearing">
                  <input type="radio" name="clusterBearingUnit" id="clusterVizDegrees" value="degrees" checked />
                  <label for="clusterVizDegrees">Degrees</label>
                  <input type="radio" name="clusterBearingUnit" id="clusterVizMils" value="mils" />
                  <label for="clusterVizMils">Mils</label>
                  <span></span>
                </div>
                ${tipIcon(TIP_LABEL["Bearing Units"] || "")}
              </div>
            </div>

            <div class="viz-controls-dropdown__row viz-controls-dropdown__checks">
              <label class="viz-check"><input id="chk-cluster-labels" type="checkbox" checked /><span>Labels ${tipIcon(TIP_LABEL["Cluster Labels"] || "")}</span></label>
              <label class="viz-check"><input id="chk-cluster-links" type="checkbox" checked /><span>Links ${tipIcon(TIP_LABEL["Links"] || "")}</span></label>
              <label class="viz-check"><input id="chk-cluster-axes" type="checkbox" checked /><span>Axes ${tipIcon(TIP_LABEL["Axes"] || "")}</span></label>
              <label class="viz-check"><input id="chk-cluster-grid" type="checkbox" checked /><span>Range/Bearing Grid ${tipIcon(TIP_LABEL["Range/Bearing Grid"] || "")}</span></label>
            </div>

            <div class="viz-controls-dropdown__row">
              <div class="hint">Drag to rotate, mouse wheel to zoom.</div>
            </div>
            </div>
          </div>

          <div class="viz-wrap">
            <canvas id="viz" width="1200" height="600"></canvas>
          </div>

          <div id="viz-toast" class="viz-toast" style="display:none">
            Tip: Zoom out past the system to view your local stellar neighbourhood
            <button id="viz-toast-close" class="viz-toast__close" type="button" aria-label="Dismiss">&times;</button>
          </div>
          </div>
        </div>
      </div>
    </div>
  `;
  attachTooltips(root);

  const canvas = root.querySelector("#viz");
  const ctx = canvas.getContext("2d");
  const chkLabels = root.querySelector("#chk-labels");
  const chkMoons = root.querySelector("#chk-moons");
  const chkOrbits = root.querySelector("#chk-orbits");
  const vizDistLog = root.querySelector("#vizDistLog");
  const vizSizePhysical = root.querySelector("#vizSizePhysical");
  const chkHz = root.querySelector("#chk-hz");
  const chkDebris = root.querySelector("#chk-debris");
  const chkEccentric = root.querySelector("#chk-eccentric");
  const chkPeAp = root.querySelector("#chk-pe-ap");
  const chkHill = root.querySelector("#chk-hill");
  const chkFrost = root.querySelector("#chk-frost");
  const chkDistances = root.querySelector("#chk-distances");
  const chkGrid = root.querySelector("#chk-grid");
  const chkDebug = root.querySelector("#chk-debug");
  const btnRefresh = root.querySelector("#btn-refresh");
  const btnPlay = root.querySelector("#btn-play");
  const btnResetView = root.querySelector("#btn-reset-view");
  const btnControls = root.querySelector("#btn-controls");
  const vizDropdown = root.querySelector("#viz-controls-dropdown");
  const btnFullscreen = root.querySelector("#btn-fullscreen");
  const btnExportImage = root.querySelector("#btn-export-image");
  const btnExportGif = root.querySelector("#btn-export-gif");
  const vizLayout = root.querySelector(".viz-layout");
  const rngSpeed = root.querySelector("#rng-speed");
  const txtSpeed = root.querySelector("#txt-speed");

  /* Cluster-mode DOM elements */
  const vizTitle = root.querySelector("#viz-title");
  const vizControlsSystem = root.querySelector("#viz-controls-system");
  const vizControlsCluster = root.querySelector("#viz-controls-cluster");
  const chkClusterLabels = root.querySelector("#chk-cluster-labels");
  const chkClusterLinks = root.querySelector("#chk-cluster-links");
  const chkClusterAxes = root.querySelector("#chk-cluster-axes");
  const chkClusterGrid = root.querySelector("#chk-cluster-grid");
  const clusterMilsEl = root.querySelector("#clusterVizMils");
  const btnClusterRefresh = root.querySelector("#btn-cluster-refresh");
  const btnClusterPlay = root.querySelector("#btn-cluster-play");
  const rngClusterSpeed = root.querySelector("#rng-cluster-speed");
  const txtClusterSpeed = root.querySelector("#txt-cluster-speed");
  const vizToast = root.querySelector("#viz-toast");
  const vizToastClose = root.querySelector("#viz-toast-close");

  const DEFAULT_ZOOM = 1.18;
  const ZOOM_MIN = 0.1;
  const ZOOM_MAX = 10000;
  const TRANSITION_ZOOM_START = 1.0;
  const TRANSITION_ZOOM_END = 0.15;
  const FOCUS_MIN_ZOOM = 1.55;
  const FOCUS_MAX_ZOOM = 500;
  const CAMERA_PAN_RATE = 6.0;
  const CAMERA_ZOOM_RATE = 3.8;
  const STAR_BURST_SIZE_SCALE = 0.3;
  const MAX_FLARES_PER_TICK = 48;
  const ACTIVITY_SPEED_BLEND = 0.25;
  const DEFAULT_YAW = -0.6;
  const DEFAULT_PITCH = 1.24;
  const PITCH_MIN = 0.2;
  const PITCH_MAX = 1.52;

  /* Cluster-mode constants */
  const CLUSTER_DEFAULT_YAW = -0.7;
  const CLUSTER_DEFAULT_PITCH = 0.35;
  const CLUSTER_DEFAULT_ZOOM = 1.1;
  const CLUSTER_ZOOM_MIN = 0.35;
  const CLUSTER_ZOOM_MAX = 10.0;
  const CLUSTER_TRANSITION_ZOOM_START = 3.4;
  const CLUSTER_TRANSITION_ZOOM_END = 8.0;
  const CLUSTER_SPEED_STEPS = [0.1, 0.5, 1, 5, 20];

  btnRefresh?.setAttribute("data-tip", TIP_LABEL["Refresh"] || "");
  btnPlay?.setAttribute("data-tip", TIP_LABEL["Play"] || "");
  btnExportImage?.setAttribute("data-tip", TIP_LABEL["Download image"] || "");
  btnExportGif?.setAttribute("data-tip", TIP_LABEL["Download GIF"] || "");

  function isLogScale() {
    return vizDistLog?.checked !== false;
  }
  function isPhysicalScale() {
    return vizSizePhysical?.checked === true;
  }
  function getZoomMax() {
    return ZOOM_MAX;
  }
  function getFocusMaxZoom() {
    return FOCUS_MAX_ZOOM;
  }

  const state = {
    panX: 0,
    panY: 0,
    yaw: DEFAULT_YAW,
    pitch: DEFAULT_PITCH,
    zoom: DEFAULT_ZOOM,
    isPlaying: false,
    simTime: 0, // simulated days
    activityTime: 0, // simulated days for stellar activity (partially decoupled from orbit speed)

    lastTick: 0,
    speed: 1,
    starBursts: [],
    flareState: {
      signature: "",
      params: null,
      seeded: false,
      rng: Math.random,
      nextFlareTimeSec: Infinity,
      nextFlareEnergyErg: null,
      cyclePhase: 0,
      cyclePeriodSec: 11 * 365.25 * 86400,
      cmeTimes24hSec: [],
    },
    snapshotCache: null,
    focusTargetKind: null,
    focusTargetId: null,
    focusZoomTarget: null,
    bodyHitRegions: [],
    debugLast: new Map(),
    exportingGif: false,
    transitioning: false,
    bodyScale: 0.4,

    /* Unified mode */
    mode: options.startMode === "cluster" ? "cluster" : "system",

    /* Cluster-mode state */
    clusterSnapshot: null,
    clusterMouseX: null,
    clusterMouseY: null,
    clusterSpinSpeed: 0.5,
    clusterIsPlaying: false,
    clusterLastTick: 0,
  };

  function syncExportButtons() {
    const playing = state.mode === "cluster" ? state.clusterIsPlaying : state.isPlaying;
    const canCaptureGif = playing && !state.exportingGif;
    if (btnExportGif) btnExportGif.disabled = !canCaptureGif;
    if (btnExportImage) btnExportImage.disabled = state.exportingGif;
    if (btnPlay) btnPlay.disabled = state.exportingGif;
    if (btnClusterPlay) btnClusterPlay.disabled = state.exportingGif;
  }

  function dbgThrottled(enabled, key, intervalMs, ...args) {
    if (!enabled) return;
    const now = performance.now();
    const last = state.debugLast.get(key) ?? -Infinity;
    if (now - last < intervalMs) return;
    state.debugLast.set(key, now);
    dbg(true, ...args);
  }

  let rafId = null;
  let cameraRafId = null;
  let disposed = false;
  const disposers = [];

  function addDisposableListener(target, type, handler, options) {
    if (!target?.addEventListener) return;
    target.addEventListener(type, handler, options);
    disposers.push(() => {
      try {
        target.removeEventListener(type, handler, options);
      } catch {}
    });
  }

  function dispose() {
    if (disposed) return;
    disposed = true;
    state.isPlaying = false;
    if (rafId != null) {
      try {
        cancelAnimationFrame(rafId);
      } catch {}
      rafId = null;
    }
    if (cameraRafId != null) {
      try {
        cancelAnimationFrame(cameraRafId);
      } catch {}
      cameraRafId = null;
    }
    while (disposers.length) {
      const fn = disposers.pop();
      try {
        fn?.();
      } catch {}
    }
  }

  const unmountObserver = new MutationObserver(() => {
    if (!root.isConnected) dispose();
  });
  unmountObserver.observe(document.body, { childList: true, subtree: true });
  disposers.push(() => {
    try {
      unmountObserver.disconnect();
    } catch {}
  });

  const vizWrap = root.querySelector(".viz-wrap") || canvas?.parentElement;

  /* ── Cluster helpers ───────────────────────────────────────── */

  function refreshClusterSnapshot() {
    state.clusterSnapshot = buildClusterSnapshot();
  }

  function updateClusterSpeedUI() {
    const idx = Number(rngClusterSpeed?.value || 1);
    state.clusterSpinSpeed = CLUSTER_SPEED_STEPS[idx] ?? 0.5;
    if (txtClusterSpeed) txtClusterSpeed.textContent = `${state.clusterSpinSpeed}x`;
  }
  updateClusterSpeedUI();

  /* ── Mode switching ────────────────────────────────────────── */

  function switchMode(newMode) {
    if (newMode === state.mode) return;
    state.mode = newMode;

    /* Toggle dropdown control sections */
    if (vizControlsSystem) vizControlsSystem.style.display = newMode === "system" ? "" : "none";
    if (vizControlsCluster) vizControlsCluster.style.display = newMode === "cluster" ? "" : "none";

    /* Update page title */
    if (vizTitle)
      vizTitle.textContent =
        newMode === "cluster" ? "Local Cluster Visualiser" : "System Visualiser";

    /* Ensure cluster snapshot exists when entering cluster mode */
    if (newMode === "cluster" && !state.clusterSnapshot) refreshClusterSnapshot();

    /* Track first transition for toast dismissal */
    if (newMode === "cluster") {
      try {
        localStorage.setItem("worldsmith.viz.hasTransitioned", "1");
      } catch {}
      if (vizToast) vizToast.style.display = "none";
    }

    syncExportButtons();
  }

  /* Apply initial mode (if opened via #/cluster-viz) */
  if (state.mode === "cluster") {
    if (vizControlsSystem) vizControlsSystem.style.display = "none";
    if (vizControlsCluster) vizControlsCluster.style.display = "";
    if (vizTitle) vizTitle.textContent = "Local Cluster Visualiser";
  }

  /* ── Toast (first-load hint) ───────────────────────────────── */

  let toastTimeout = null;
  function showToast() {
    if (!vizToast) return;
    vizToast.style.display = "";
    toastTimeout = setTimeout(() => {
      if (vizToast) vizToast.style.display = "none";
    }, 8000);
  }
  function hideToast() {
    if (vizToast) vizToast.style.display = "none";
    if (toastTimeout) {
      clearTimeout(toastTimeout);
      toastTimeout = null;
    }
  }
  if (state.mode === "system") {
    try {
      if (!localStorage.getItem("worldsmith.viz.hasTransitioned")) showToast();
    } catch {}
  }

  function resizeCanvas(force = false) {
    if (!vizWrap) return;
    /* Clear inline size so CSS width:100%/height:100% governs display —
       prevents the canvas from blocking layout shrink after fullscreen. */
    canvas.style.width = "";
    canvas.style.height = "";
    const rect = vizWrap.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const newW = Math.floor(rect.width * dpr);
    const newH = Math.floor(rect.height * dpr);
    if (!force && newW === canvas.width && newH === canvas.height) return;
    canvas.width = newW;
    canvas.height = newH;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  /* ResizeObserver fires whenever .viz-wrap changes size (window resize,
     fullscreen enter/exit, layout reflow) — much more reliable than
     setTimeout-based approaches. */
  const wrapResizeObserver = new ResizeObserver(() => {
    resizeCanvas(true);
    draw();
  });
  if (vizWrap) wrapResizeObserver.observe(vizWrap);
  disposers.push(() => wrapResizeObserver.disconnect());

  function rectsOverlap(a, b) {
    return !(a.x + a.w < b.x || b.x + b.w < a.x || a.y + a.h < b.y || b.y + b.h < a.y);
  }

  function placeLabel(ctx, placed, baseX, baseY, boxW, boxH) {
    // Try a set of offsets (right/top preferred), then spiral out
    const candidates = [
      { dx: 0, dy: 0 },
      { dx: 0, dy: -16 },
      { dx: 0, dy: 16 },
      { dx: 12, dy: -28 },
      { dx: 12, dy: 28 },
      { dx: -boxW - 18, dy: -16 },
      { dx: -boxW - 18, dy: 16 },
    ];
    // add a small spiral
    for (let k = 1; k <= 10; k++) {
      const s = 10 * k;
      candidates.push({ dx: 0, dy: -s });
      candidates.push({ dx: 0, dy: s });
      candidates.push({ dx: s, dy: 0 });
      candidates.push({ dx: -s, dy: 0 });
      candidates.push({ dx: s, dy: -s });
      candidates.push({ dx: s, dy: s });
      candidates.push({ dx: -s, dy: -s });
      candidates.push({ dx: -s, dy: s });
    }

    for (const c of candidates) {
      const r = { x: baseX + c.dx, y: baseY + c.dy, w: boxW, h: boxH };
      let hit = false;
      for (const p of placed) {
        if (rectsOverlap(r, p)) {
          hit = true;
          break;
        }
      }
      if (!hit) {
        placed.push(r);
        return r;
      }
    }
    // fallback: accept overlap
    const r = { x: baseX, y: baseY, w: boxW, h: boxH };
    placed.push(r);
    return r;
  }

  const SPEED_STEPS = [0.1, 0.5, 1, 5, 20];

  function updateSpeedUI() {
    const idx = Number(rngSpeed.value || 1);
    state.speed = SPEED_STEPS[idx] ?? 1;
    txtSpeed.textContent = `${state.speed} d/s`;
  }

  function exportFileName(extension) {
    const prefix =
      state.mode === "cluster" ? "worldsmith-cluster-visualiser" : "worldsmith-system-visualiser";
    return `${prefix}-${makeTimestampToken()}.${extension}`;
  }

  function invalidateSnapshot() {
    state.snapshotCache = null;
  }

  function buildSnapshot(w) {
    const starName = String(w.star?.name || "").trim() || "Star";
    const starMassMsol = Number(w.star?.massMsol ?? w.system?.starMassMsol);
    const starAgeGyr = Number(w.star?.ageGyr ?? 4.6);
    const starSeedRaw = w.star?.activitySeed ?? w.star?.seed ?? null;

    // Mirror starPage.js getEffectiveOverrides() so the visualizer uses the same
    // physics resolution as the Star page (Advanced mode R/L/T overrides).
    const starPhysicsMode = w.star?.physicsMode ?? "simple";
    const starDerivMode = w.star?.advancedDerivationMode ?? "rl";
    let starRadiusOv = null;
    let starLumOv = null;
    let starTempOv = null;
    if (starPhysicsMode === "advanced") {
      const rOv =
        Number.isFinite(Number(w.star?.radiusRsolOverride)) &&
        Number(w.star?.radiusRsolOverride) > 0
          ? Number(w.star.radiusRsolOverride)
          : null;
      const lOv =
        Number.isFinite(Number(w.star?.luminosityLsolOverride)) &&
        Number(w.star?.luminosityLsolOverride) > 0
          ? Number(w.star.luminosityLsolOverride)
          : null;
      const tOv =
        Number.isFinite(Number(w.star?.tempKOverride)) && Number(w.star?.tempKOverride) > 0
          ? Number(w.star.tempKOverride)
          : null;
      if (starDerivMode === "rt") {
        starRadiusOv = rOv;
        starTempOv = tOv;
      } else if (starDerivMode === "lt") {
        starLumOv = lOv;
        starTempOv = tOv;
      } else {
        // "rl" (default)
        starRadiusOv = rOv;
        starLumOv = lOv;
      }
    }
    const starCalc = calcStar({
      massMsol: starMassMsol,
      ageGyr: starAgeGyr,
      radiusRsolOverride: starRadiusOv,
      luminosityLsolOverride: starLumOv,
      tempKOverride: starTempOv,
    });
    const starTempK = Number(starCalc?.tempK);
    const starLuminosityLsun = Number(starCalc?.luminosityLsol);
    const starRadiusRsol = Math.max(0.01, Number(starCalc?.radiusRsol) || 1);
    const starRadiusKmRaw = Number(starCalc?.metric?.radiusKm);
    const starRadiusKm =
      Number.isFinite(starRadiusKmRaw) && starRadiusKmRaw > 0
        ? starRadiusKmRaw
        : starRadiusRsol * SOL_RADIUS_KM;
    const starColourHex = starColourHexFromTempK(starTempK);

    const sys = calcSystem({
      starMassMsol,
      spacingFactor: Number(w.system?.spacingFactor),
      orbit1Au: Number(w.system?.orbit1Au),
    });
    const debugOn = !!chkDebug?.checked;
    dbg(debugOn, "system inputs", w.system);
    dbg(debugOn, "calcSystem (inputs echoed)", sys.inputs);
    dbg(debugOn, "calcSystem.orbitsAu[0..5]", (sys.orbitsAu || []).slice(0, 6));
    const planets = listPlanets(w);
    const moons = listMoons(w);

    // Use slot AU when available
    const orbitAuBySlot = sys.orbitsAu || [];
    const planetNodes = planets
      .filter((p) => p.slotIndex != null)
      .map((p) => {
        const slot = Number(p.slotIndex);
        const slotAuRaw = orbitAuBySlot[slot - 1];
        const slotAu = Number(slotAuRaw);
        const inputAu = Number(p.inputs?.semiMajorAxisAu);
        const au =
          Number.isFinite(slotAu) && slotAu > 0
            ? slotAu
            : Number.isFinite(inputAu) && inputAu > 0
              ? inputAu
              : 1.0;

        // Compute orbital period from planet sheet logic (days)
        let periodDays = null;
        let radiusEarth = null;
        let skyHighHex = null;
        let skyHorizonHex = null;
        const planetInputs = { ...p.inputs, semiMajorAxisAu: au };
        try {
          const planetCalc = calcPlanetExact({ starMassMsol, starAgeGyr, planet: planetInputs });
          periodDays = Number(planetCalc?.derived?.orbitalPeriodEarthDays);
          if (!Number.isFinite(periodDays) || periodDays <= 0) periodDays = null;
          radiusEarth = Number(planetCalc?.derived?.radiusEarth);
          if (!Number.isFinite(radiusEarth) || radiusEarth <= 0) radiusEarth = null;

          skyHighHex = String(planetCalc?.derived?.skyColourDayHex ?? "").trim();
          skyHorizonHex = String(planetCalc?.derived?.skyColourHorizonHex ?? "").trim();
          if (!/^#?[0-9a-fA-F]{6}$/.test(skyHighHex)) skyHighHex = null;
          if (!/^#?[0-9a-fA-F]{6}$/.test(skyHorizonHex)) skyHorizonHex = null;
          if (skyHighHex && !skyHighHex.startsWith("#")) skyHighHex = "#" + skyHighHex;
          if (skyHorizonHex && !skyHorizonHex.startsWith("#")) skyHorizonHex = "#" + skyHorizonHex;
        } catch {
          periodDays = null;
          radiusEarth = null;
          skyHighHex = null;
          skyHorizonHex = null;
        }

        return {
          id: p.id,
          name: p.name || p.inputs?.name || p.id,
          slot,
          au,
          periodDays,
          radiusEarth,
          massEarth: Number(p.inputs?.massEarth) || null,
          skyHighHex,
          skyHorizonHex,
          eccentricity: clamp(Number(p.inputs?.eccentricity ?? 0), 0, 0.99),
          longitudeOfPeriapsisDeg: Number(p.inputs?.longitudeOfPeriapsisDeg ?? 0),
          inclinationDeg: clamp(Number(p.inputs?.inclinationDeg ?? 0), 0, 180),
          locked: !!p.locked,
          moons: moons
            .filter((m) => m.planetId === p.id)
            .map((m) => {
              const semiMajorAxisKm = Number(m.inputs?.semiMajorAxisKm);
              let mPeriodDays = null;
              let mRadiusKm = null;
              try {
                const moonCalc = calcMoonExact({
                  starMassMsol,
                  starAgeGyr,
                  planet: planetInputs,
                  moon: { ...m.inputs },
                });
                mPeriodDays = Number(moonCalc?.orbit?.orbitalPeriodSiderealDays);
                if (!Number.isFinite(mPeriodDays) || mPeriodDays <= 0) mPeriodDays = null;
                const moonRadiusMoon = Number(moonCalc?.physical?.radiusMoon);
                if (Number.isFinite(moonRadiusMoon) && moonRadiusMoon > 0) {
                  mRadiusKm = moonRadiusMoon * MOON_RADIUS_KM;
                }
              } catch {
                mPeriodDays = null;
                mRadiusKm = null;
              }
              return {
                id: m.id,
                name: m.name || m.inputs?.name || m.id,
                semiMajorAxisKm:
                  Number.isFinite(semiMajorAxisKm) && semiMajorAxisKm > 0 ? semiMajorAxisKm : null,
                periodDays: mPeriodDays,
                radiusKm: mRadiusKm,
                eccentricity: clamp(Number(m.inputs?.eccentricity ?? 0), 0, 0.99),
                inclinationDeg: clamp(Number(m.inputs?.inclinationDeg ?? 0), 0, 180),
                longitudeOfPeriapsisDeg: hashUnit(m.id) * 360,
              };
            })
            .sort((a, b) => {
              const aa = Number.isFinite(a.semiMajorAxisKm) ? a.semiMajorAxisKm : Infinity;
              const bb = Number.isFinite(b.semiMajorAxisKm) ? b.semiMajorAxisKm : Infinity;
              return aa - bb;
            }),
        };
      })
      .sort((a, b) => a.au - b.au);

    let gasGiants = listSystemGasGiants(w)
      .map((g, idx) => {
        const ggNode = {
          id: g.id || `gg${idx + 1}`,
          name: g.name || `Gas giant ${idx + 1}`,
          au: Number(g.au),
          radiusRj: Number.isFinite(Number(g.radiusRj))
            ? clamp(Number(g.radiusRj), GAS_GIANT_RADIUS_MIN_RJ, GAS_GIANT_RADIUS_MAX_RJ)
            : 1,
          style: g.style || "jupiter",
          rings: !!g.rings,
          massMjup: g.massMjup,
          rotationPeriodHours: g.rotationPeriodHours,
          metallicity: g.metallicity,
        };
        // Build parentOverride for moon calculations
        let parentOverride = null;
        try {
          const ggModel = calcGasGiant({
            massMjup: g.massMjup,
            radiusRj: g.radiusRj,
            orbitAu: ggNode.au || 5,
            rotationPeriodHours: g.rotationPeriodHours,
            metallicity: g.metallicity,
            starMassMsol,
            starLuminosityLsol: Number(w.star?.luminosityLsol) || 1,
            starAgeGyr,
            starRadiusRsol: Number(w.star?.radiusRsol) || 1,
          });
          parentOverride = {
            inputs: {
              massEarth: ggModel.physical.massEarth,
              semiMajorAxisAu: ggModel.inputs.orbitAu,
              eccentricity: 0,
              rotationPeriodHours: ggModel.inputs.rotationPeriodHours,
              cmfPct: 0,
            },
            derived: {
              densityGcm3: ggModel.physical.densityGcm3,
              radiusEarth: ggModel.physical.radiusEarth,
              gravityG: ggModel.physical.gravityG,
            },
          };
        } catch {
          /* ignore — moons will render without physics */
        }
        ggNode.moons = moons
          .filter((m) => m.planetId === ggNode.id)
          .map((m) => {
            const semiMajorAxisKm = Number(m.inputs?.semiMajorAxisKm);
            let mPeriodDays = null;
            let mRadiusKm = null;
            if (parentOverride) {
              try {
                const moonCalc = calcMoonExact({
                  starMassMsol,
                  starAgeGyr,
                  moon: { ...m.inputs },
                  parentOverride,
                });
                mPeriodDays = Number(moonCalc?.orbit?.orbitalPeriodSiderealDays);
                if (!Number.isFinite(mPeriodDays) || mPeriodDays <= 0) mPeriodDays = null;
                const moonRadiusMoon = Number(moonCalc?.physical?.radiusMoon);
                if (Number.isFinite(moonRadiusMoon) && moonRadiusMoon > 0) {
                  mRadiusKm = moonRadiusMoon * MOON_RADIUS_KM;
                }
              } catch {
                mPeriodDays = null;
                mRadiusKm = null;
              }
            }
            return {
              id: m.id,
              name: m.name || m.inputs?.name || m.id,
              semiMajorAxisKm:
                Number.isFinite(semiMajorAxisKm) && semiMajorAxisKm > 0 ? semiMajorAxisKm : null,
              periodDays: mPeriodDays,
              radiusKm: mRadiusKm,
              eccentricity: clamp(Number(m.inputs?.eccentricity ?? 0), 0, 0.99),
              inclinationDeg: clamp(Number(m.inputs?.inclinationDeg ?? 0), 0, 180),
              longitudeOfPeriapsisDeg: hashUnit(m.id) * 360,
            };
          })
          .sort((a, b) => {
            const aa = Number.isFinite(a.semiMajorAxisKm) ? a.semiMajorAxisKm : Infinity;
            const bb = Number.isFinite(b.semiMajorAxisKm) ? b.semiMajorAxisKm : Infinity;
            return aa - bb;
          });
        return ggNode;
      })
      .filter((g) => Number.isFinite(g.au) && g.au > 0)
      .sort((a, b) => a.au - b.au);
    const systemDisks = listSystemDebrisDisks(w);
    const debrisDisks = [];
    for (const sd of systemDisks) {
      const inner = Number(sd.innerAu);
      const outer = Number(sd.outerAu);
      if (Number.isFinite(inner) && Number.isFinite(outer) && inner > 0 && outer > 0) {
        debrisDisks.push({
          id: sd.id || `dd${debrisDisks.length + 1}`,
          name: sd.name || `Debris disk ${debrisDisks.length + 1}`,
          inner: Math.min(inner, outer),
          outer: Math.max(inner, outer),
        });
      }
    }

    dbg(debugOn, "debrisDisks", debrisDisks);
    dbg(debugOn, "gasGiants", gasGiants);
    dbg(
      debugOn,
      "planets (assigned)",
      planetNodes.map((p) => ({ name: p.name, slot: p.slot, au: p.au })),
    );
    return {
      sys,
      planetNodes,
      debrisDisks,
      gasGiants,
      starName,
      starMassMsol,
      starAgeGyr,
      starTempK,
      starLuminosityLsun,
      starRadiusRsol,
      starRadiusKm,
      starColourHex,
      starSeed: starSeedRaw,
    };
  }

  function getSnapshot({ force = false } = {}) {
    if (!force && state.snapshotCache) return state.snapshotCache;
    const snapshot = buildSnapshot(loadWorld());
    state.snapshotCache = snapshot;
    return snapshot;
  }

  function hexToRgba(hex, a = 1) {
    if (!hex) return `rgba(160,200,255,${a})`;
    const h = hex.replace("#", "").trim();
    const r = parseInt(h.slice(0, 2), 16);
    const g = parseInt(h.slice(2, 4), 16);
    const b = parseInt(h.slice(4, 6), 16);
    return `rgba(${r},${g},${b},${a})`;
  }

  function mapAuToPx(au, minAu, maxAu, maxR) {
    const maxSafe = Number.isFinite(maxAu) && maxAu > 0 ? maxAu : 1;
    const auNum = Number(au);
    const a = Number.isFinite(auNum) && auNum > 0 ? auNum : 0;
    if (!maxR) return 0;

    const useLogScale = isLogScale();
    let t = 0;

    if (useLogScale) {
      const minSafe = Number.isFinite(minAu) && minAu > 0 ? minAu : maxSafe * 0.001;
      const denom = Math.log10(maxSafe) - Math.log10(minSafe);
      t = denom > 0 ? (Math.log10(Math.max(a, minSafe)) - Math.log10(minSafe)) / denom : 0;
    } else {
      t = maxSafe > 0 ? a / maxSafe : 0;
    }

    t = clamp(t, 0, 1);
    return t * maxR;
  }

  function getFrameMetrics(snapshot) {
    const W = canvas.clientWidth;
    const H = canvas.clientHeight;
    const baseCx = W * 0.5;
    const baseCy = H * 0.5;

    const minAuCandidates = [];
    const maxAuCandidates = [];

    // Scale from actually rendered system features, not the full orbit-table tail.
    // Some worlds have very distant generated slots that can exceed 10^4 AU and
    // collapse linear rendering for inner-system objects.
    if (snapshot.planetNodes?.length) {
      const planetAus = snapshot.planetNodes
        .map((p) => Number(p.au))
        .filter((v) => Number.isFinite(v) && v > 0);
      if (planetAus.length) {
        minAuCandidates.push(Math.min(...planetAus));
        maxAuCandidates.push(Math.max(...planetAus));
      }
    }
    if (snapshot.debrisDisks?.length) {
      snapshot.debrisDisks.forEach((d) => {
        minAuCandidates.push(Number(d.inner), Number(d.outer));
        maxAuCandidates.push(Number(d.inner), Number(d.outer));
      });
    }
    if (snapshot.gasGiants?.length) {
      snapshot.gasGiants.forEach((g) => {
        minAuCandidates.push(Number(g.au));
        maxAuCandidates.push(Number(g.au));
      });
    }
    minAuCandidates.push(
      Number(snapshot.sys?.frostLineAu),
      Number(snapshot.sys?.habitableZoneAu?.inner),
      Number(snapshot.sys?.habitableZoneAu?.outer),
    );
    maxAuCandidates.push(
      Number(snapshot.sys?.frostLineAu),
      Number(snapshot.sys?.habitableZoneAu?.inner),
      Number(snapshot.sys?.habitableZoneAu?.outer),
    );

    const minFiniteCandidates = minAuCandidates.filter((v) => Number.isFinite(v) && v > 0);
    const maxFiniteCandidates = maxAuCandidates.filter((v) => Number.isFinite(v) && v > 0);

    const minSourceAu = minFiniteCandidates.length ? Math.min(...minFiniteCandidates) : 0.1;
    // minAu is only used for log-scale lower bound — no artificial floor
    const minAu = minSourceAu * 0.85;
    const maxSourceAu = maxFiniteCandidates.length ? Math.max(...maxFiniteCandidates) : 1;
    const maxAu = Math.max(maxSourceAu * 1.05, minAu * 5);

    const maxR = Math.min(W, H) * 0.45 * state.zoom;
    const usePhysical = isPhysicalScale();
    const logScale = isLogScale();
    const starRadiusRsol = Math.max(0.01, Number(snapshot?.starRadiusRsol) || 1);

    // Compute the pixel radius of the innermost orbit for star-size capping
    const innermostOrbitPx = mapAuToPx(minSourceAu, minAu, maxAu, maxR);

    let starR;
    if (usePhysical) {
      // 1:1 size — derive from true physical ratio
      const starRadiusAu = starRadiusRsol * 0.00465047;
      const pixelsPerAu = logScale
        ? (() => {
            const logDenom = Math.log10(maxAu) - Math.log10(Math.max(minAu, 1e-9));
            return logDenom > 0 ? maxR / (Math.LN10 * logDenom * Math.max(minAu, 1e-9)) : maxR;
          })()
        : maxR / Math.max(maxAu, 1e-6);
      starR = Math.max(0.5, starRadiusAu * pixelsPerAu);
    } else {
      // Representative sizing — scale with star, but shrink if it would overlap the
      // innermost orbit so orbits are always drawn at their true proportional distance.
      const baseStarR = Math.max(5, maxR * 0.03);
      const maxStarR = innermostOrbitPx > 0 ? innermostOrbitPx * 0.75 : maxR * 0.12;
      starR = clamp(baseStarR * starRadiusRsol, 4, maxStarR);
    }
    const starRadiusKm = Number(snapshot?.starRadiusKm);

    // In representative mode, scale body radii with zoom so planets grow as
    // you zoom in (orbits already scale via maxR, bodies need to follow).
    // Physical mode doesn't need this — sizes are derived from starR which
    // already incorporates zoom.
    const bodyZoom = usePhysical ? 1 : Math.pow(state.zoom, 0.4) * state.bodyScale;

    return {
      W,
      H,
      baseCx,
      baseCy,
      minAu,
      maxAu,
      maxR,
      starR,
      starRadiusKm:
        Number.isFinite(starRadiusKm) && starRadiusKm > 0 ? starRadiusKm : SOL_RADIUS_KM,
      isPhysical: usePhysical,
      bodyZoom,
    };
  }

  function computePlanetPlacement(planetNode, metrics) {
    const r = mapAuToPx(planetNode.au, metrics.minAu, metrics.maxAu, metrics.maxR);
    const baseAngle = hashUnit(planetNode.id) * Math.PI * 2;
    const auSafe = Math.max(planetNode.au, 0.05);
    const period =
      Number.isFinite(planetNode.periodDays) && planetNode.periodDays > 0
        ? planetNode.periodDays
        : null;
    const meanMotion = period
      ? (2 * Math.PI) / period
      : (2 * Math.PI) / (40 * Math.pow(auSafe, 1.35));

    const useEccentric = chkEccentric?.checked === true;
    const ecc =
      useEccentric && Number.isFinite(planetNode.eccentricity)
        ? clamp(planetNode.eccentricity, 0, 0.99)
        : 0;

    let ox, oy, angle;
    if (useEccentric && ecc > 0) {
      const M = baseAngle + meanMotion * state.simTime;
      const E = solveKeplerEquation(M, ecc);
      const a = r;
      const b = a * Math.sqrt(1 - ecc * ecc);
      const cFocus = a * ecc;
      const argW = ((Number(planetNode.longitudeOfPeriapsisDeg) || 0) * Math.PI) / 180;
      const cosW = Math.cos(argW);
      const sinW = Math.sin(argW);
      const xf = a * Math.cos(E) - cFocus;
      const zf = b * Math.sin(E);
      ox = xf * cosW - zf * sinW;
      oy = xf * sinW + zf * cosW;
      angle = Math.atan2(oy, ox);
    } else {
      angle = baseAngle + meanMotion * state.simTime;
      ox = Math.cos(angle) * r;
      oy = Math.sin(angle) * r;
    }

    // Apply inclination tilt (lifts oy component into vertical)
    const incDeg = useEccentric ? Number(planetNode.inclinationDeg) || 0 : 0;
    const incRad = (incDeg * Math.PI) / 180;
    const cosI = Math.cos(incRad);
    const sinI = Math.sin(incRad);
    const oyVert = oy * sinI; // vertical offset from inclination
    const oyFlat = oy * cosI; // remaining in-plane component

    const usePhysicalScale = isPhysicalScale();
    const planetRadiusKm =
      Number.isFinite(planetNode.radiusEarth) && planetNode.radiusEarth > 0
        ? planetNode.radiusEarth * EARTH_RADIUS_KM
        : null;
    const pr = usePhysicalScale
      ? physicalRadiusToPx(planetRadiusKm, metrics.starR, metrics.starRadiusKm, 0, Infinity)
      : planetRadiusToPx(planetNode.radiusEarth) * metrics.bodyZoom;
    return { r, baseAngle, angle, ox, oy: oyFlat, oyVert, pr };
  }

  function computeGasGiantPlacement(gasGiant, idx, metrics, starMassMsol) {
    const r = mapAuToPx(gasGiant.au, metrics.minAu, metrics.maxAu, metrics.maxR);
    const baseAngle = (0.15 + idx * 0.13) * Math.PI * 2;
    const ggPeriod =
      gasGiant.au && starMassMsol ? Math.sqrt(gasGiant.au ** 3 / starMassMsol) * 365.256 : 220;
    const omega = (2 * Math.PI) / ggPeriod;
    const angle = baseAngle + omega * state.simTime;
    const ox = Math.cos(angle) * r;
    const oy = Math.sin(angle) * r;
    return { r, baseAngle, angle, ox, oy };
  }

  // Project a 3-D orbit-plane offset (ox, oy, oz) through the camera.
  // oy is the vertical offset (from inclination tilt); defaults to 0 for flat orbits.
  function projectOrbitOffset(ox, oz, oy = 0) {
    const cosYaw = Math.cos(state.yaw);
    const sinYaw = Math.sin(state.yaw);
    const sp = Math.sin(state.pitch);
    const cp = Math.cos(state.pitch);
    const xr = ox * cosYaw - oz * sinYaw;
    const zr = ox * sinYaw + oz * cosYaw;
    return {
      x: xr,
      y: oy - zr * sp,
      depth: zr * cp,
    };
  }

  function orbitOffsetToScreen(ox, oz, cx, cy, oy = 0) {
    const p = projectOrbitOffset(ox, oz, oy);
    return {
      x: cx + p.x,
      y: cy - p.y,
      depth: p.depth,
    };
  }

  function traceProjectedOrbitRingPath(cx, cy, radiusPx, inclinationDeg = 0, segments = 128) {
    const incRad = (inclinationDeg * Math.PI) / 180;
    const cosI = Math.cos(incRad);
    const sinI = Math.sin(incRad);
    ctx.beginPath();
    for (let i = 0; i <= segments; i++) {
      const a = (i / segments) * Math.PI * 2;
      const ox = Math.cos(a) * radiusPx;
      const oz = Math.sin(a) * radiusPx;
      const oy = oz * sinI;
      const ozTilted = oz * cosI;
      const pt = orbitOffsetToScreen(ox, ozTilted, cx, cy, oy);
      if (i === 0) ctx.moveTo(pt.x, pt.y);
      else ctx.lineTo(pt.x, pt.y);
    }
    ctx.closePath();
  }

  // Solves Kepler's equation M = E - e·sin(E) for the eccentric anomaly E.
  // Uses Newton–Raphson (≤6 iterations, converges to 1e-10 for e < 0.99).
  function solveKeplerEquation(Mraw, e) {
    const M = ((Mraw % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
    let E = M;
    for (let i = 0; i < 6; i++) {
      const dE = (E - e * Math.sin(E) - M) / (1 - e * Math.cos(E));
      E -= dE;
      if (Math.abs(dE) < 1e-10) break;
    }
    return E;
  }

  // Traces an elliptical orbit path in the projected 3-D orbit plane.
  // semiMajorPx — semi-major axis in canvas pixels (= the "r" used for circular orbits)
  // eccentricity — orbital eccentricity [0, 0.99]
  // argPeriapsisDeg — longitude of periapsis in degrees (rotates the major axis)
  // inclinationDeg — orbital inclination in degrees (tilts orbit out of reference plane)
  function traceProjectedEllipseOrbitPath(
    cx,
    cy,
    semiMajorPx,
    eccentricity,
    argPeriapsisDeg,
    inclinationDeg = 0,
    segments = 128,
  ) {
    const e = clamp(eccentricity, 0, 0.99);
    const a = semiMajorPx;
    const b = a * Math.sqrt(1 - e * e);
    const cFocus = a * e;
    const omega = ((argPeriapsisDeg || 0) * Math.PI) / 180;
    const cosW = Math.cos(omega);
    const sinW = Math.sin(omega);
    const incRad = (inclinationDeg * Math.PI) / 180;
    const cosI = Math.cos(incRad);
    const sinI = Math.sin(incRad);
    ctx.beginPath();
    for (let i = 0; i <= segments; i++) {
      const E = (i / segments) * Math.PI * 2;
      // Orbit-plane coords relative to the star (focus)
      const xf = a * Math.cos(E) - cFocus;
      const zf = b * Math.sin(E);
      // Rotate by argument of periapsis
      const xr = xf * cosW - zf * sinW;
      const zr = xf * sinW + zf * cosW;
      // Tilt by inclination
      const oy = zr * sinI;
      const zTilted = zr * cosI;
      const pt = orbitOffsetToScreen(xr, zTilted, cx, cy, oy);
      if (i === 0) ctx.moveTo(pt.x, pt.y);
      else ctx.lineTo(pt.x, pt.y);
    }
    ctx.closePath();
  }

  // Compute the screen position of a point on an (optionally eccentric + inclined) orbit.
  // Returns {ox, oy, ozScreen} in orbit-plane coords ready for orbitOffsetToScreen.
  function orbitPointToScreen(
    cx,
    cy,
    semiMajorPx,
    ecc,
    argPeriapsisDeg,
    inclinationDeg,
    trueAnomalyRad,
  ) {
    const e = clamp(ecc, 0, 0.99);
    const a = semiMajorPx;
    const omega = ((argPeriapsisDeg || 0) * Math.PI) / 180;
    const cosW = Math.cos(omega);
    const sinW = Math.sin(omega);
    const incRad = (inclinationDeg * Math.PI) / 180;
    const cosI = Math.cos(incRad);
    const sinI = Math.sin(incRad);
    // Position in orbit plane from true anomaly (polar → Cartesian)
    const r = (a * (1 - e * e)) / (1 + e * Math.cos(trueAnomalyRad));
    const xOrb = r * Math.cos(trueAnomalyRad);
    const zOrb = r * Math.sin(trueAnomalyRad);
    // Rotate by argument of periapsis
    const xr = xOrb * cosW - zOrb * sinW;
    const zr = xOrb * sinW + zOrb * cosW;
    // Tilt by inclination
    const oy = zr * sinI;
    const zTilted = zr * cosI;
    return orbitOffsetToScreen(xr, zTilted, cx, cy, oy);
  }

  // Draw apoapsis (Ap) and periapsis (Pe) markers on an orbit.
  // KSP-style: downward-pointing triangle floating above the orbit with a stem.
  function drawApsisMarkers(
    cx,
    cy,
    semiMajorPx,
    eccentricity,
    argPeriapsisDeg,
    inclinationDeg,
    showLabels,
  ) {
    const e = clamp(eccentricity, 0, 0.99);
    if (e < 0.01) return; // near-circular — no meaningful apse distinction

    const pePt = orbitPointToScreen(cx, cy, semiMajorPx, e, argPeriapsisDeg, inclinationDeg, 0);
    const apPt = orbitPointToScreen(
      cx,
      cy,
      semiMajorPx,
      e,
      argPeriapsisDeg,
      inclinationDeg,
      Math.PI,
    );

    const stemH = 22; // px above orbit point
    const triW = 8; // triangle base width
    const triH = 6; // triangle height

    for (const { pt, label, col } of [
      { pt: pePt, label: "Pe", col: "rgba(255,180,60," },
      { pt: apPt, label: "Ap", col: "rgba(100,180,255," },
    ]) {
      const topY = pt.y - stemH;

      // Stem line
      ctx.strokeStyle = col + "0.5)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(pt.x, pt.y);
      ctx.lineTo(pt.x, topY + triH);
      ctx.stroke();

      // Downward-pointing triangle
      ctx.fillStyle = col + "0.85)";
      ctx.beginPath();
      ctx.moveTo(pt.x, topY + triH); // bottom tip
      ctx.lineTo(pt.x - triW / 2, topY); // top-left
      ctx.lineTo(pt.x + triW / 2, topY); // top-right
      ctx.closePath();
      ctx.fill();

      // Label above triangle
      if (showLabels) {
        ctx.font = "bold 10px system-ui, sans-serif";
        ctx.fillStyle = col + "0.9)";
        ctx.textAlign = "center";
        ctx.textBaseline = "bottom";
        ctx.fillText(label, pt.x, topY - 3);
      }
    }
  }

  // Draw a Hill sphere boundary around a body: dashed ring + KSP-style marker at top.
  function drawHillSphereMarker(bx, by, hillPx, showLabels, showDistances, hillAu) {
    const col = "rgba(180,140,255,";
    const r = Math.max(6, hillPx);

    // Dashed ring
    ctx.strokeStyle = col + "0.35)";
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.arc(bx, by, r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);

    // Marker at top of ring (12 o'clock)
    const ringTop = by - r;
    const stemH = 14;
    const triW = 8;
    const triH = 6;
    const topY = ringTop - stemH;

    // Stem
    ctx.strokeStyle = col + "0.5)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(bx, ringTop);
    ctx.lineTo(bx, topY + triH);
    ctx.stroke();

    // Downward triangle
    ctx.fillStyle = col + "0.85)";
    ctx.beginPath();
    ctx.moveTo(bx, topY + triH);
    ctx.lineTo(bx - triW / 2, topY);
    ctx.lineTo(bx + triW / 2, topY);
    ctx.closePath();
    ctx.fill();

    // Labels
    if (showLabels) {
      ctx.font = "bold 10px system-ui, sans-serif";
      ctx.fillStyle = col + "0.9)";
      ctx.textAlign = "center";
      ctx.textBaseline = "bottom";
      ctx.fillText("Hill", bx, topY - 3);
      if (showDistances && Number.isFinite(hillAu)) {
        ctx.font = "9px system-ui, sans-serif";
        ctx.fillStyle = col + "0.65)";
        ctx.fillText(hillAu.toFixed(3) + " AU", bx, topY - 15);
      }
    }
  }

  // Draw faint concentric AU reference rings at "nice" intervals.
  function drawAuGrid(cx, cy, minAu, maxAu, maxR) {
    // Choose a nice step: 0.1, 0.2, 0.5, 1, 2, 5, 10, 20, 50, 100 …
    const niceSteps = [0.1, 0.2, 0.5, 1, 2, 5, 10, 20, 50, 100, 200, 500, 1000];
    const range = maxAu - Math.max(minAu, 0);
    const targetRings = 8; // aim for roughly this many rings
    const rawStep = range / targetRings;
    let step = niceSteps[niceSteps.length - 1];
    for (const s of niceSteps) {
      if (s >= rawStep) {
        step = s;
        break;
      }
    }

    const startAu = Math.ceil(Math.max(minAu, 0) / step) * step;
    ctx.save();
    ctx.strokeStyle = "rgba(255,255,255,0.06)";
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 8]);
    ctx.font = "10px system-ui, sans-serif";
    ctx.fillStyle = "rgba(255,255,255,0.25)";
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";

    for (let au = startAu; au <= maxAu; au += step) {
      if (au <= 0) continue;
      const r = mapAuToPx(au, minAu, maxAu, maxR);
      if (r < 2 || r > maxR * 1.05) continue;

      // Ring
      traceProjectedOrbitRingPath(cx, cy, r);
      ctx.stroke();

      // Label at ~1 o'clock position
      const labelAngle = -Math.PI * 0.28;
      const lp = orbitOffsetToScreen(Math.cos(labelAngle) * r, Math.sin(labelAngle) * r, cx, cy);
      const label = step >= 1 ? `${au} AU` : `${au.toFixed(1)} AU`;
      ctx.fillText(label, lp.x + 4, lp.y);
    }

    ctx.setLineDash([]);
    ctx.restore();
  }

  function fillProjectedOrbitBand(cx, cy, innerRadiusPx, outerRadiusPx, fillStyle, segments = 128) {
    if (!(outerRadiusPx > innerRadiusPx)) return;
    ctx.beginPath();
    for (let i = 0; i <= segments; i++) {
      const a = (i / segments) * Math.PI * 2;
      const pt = orbitOffsetToScreen(
        Math.cos(a) * outerRadiusPx,
        Math.sin(a) * outerRadiusPx,
        cx,
        cy,
      );
      if (i === 0) ctx.moveTo(pt.x, pt.y);
      else ctx.lineTo(pt.x, pt.y);
    }
    for (let i = segments; i >= 0; i--) {
      const a = (i / segments) * Math.PI * 2;
      const pt = orbitOffsetToScreen(
        Math.cos(a) * innerRadiusPx,
        Math.sin(a) * innerRadiusPx,
        cx,
        cy,
      );
      ctx.lineTo(pt.x, pt.y);
    }
    ctx.closePath();
    ctx.fillStyle = fillStyle;
    ctx.fill();
  }

  function clearFocusTarget() {
    state.focusTargetKind = null;
    state.focusTargetId = null;
    state.focusZoomTarget = null;
    if (cameraRafId != null) {
      try {
        cancelAnimationFrame(cameraRafId);
      } catch {}
      cameraRafId = null;
    }
  }

  function setFocusTarget(kind, id) {
    if (!id || !kind) return;
    state.focusTargetKind = kind;
    state.focusTargetId = id;
    state.focusZoomTarget = clamp(
      Math.max(state.zoom * 1.28, FOCUS_MIN_ZOOM),
      FOCUS_MIN_ZOOM,
      getFocusMaxZoom(),
    );
  }

  function hitTestBody(x, y) {
    let best = null;
    let bestDist2 = Infinity;
    for (const hit of state.bodyHitRegions || []) {
      const dx = x - hit.x;
      const dy = y - hit.y;
      const d2 = dx * dx + dy * dy;
      if (d2 > hit.r * hit.r) continue;
      if (d2 < bestDist2) {
        bestDist2 = d2;
        best = hit;
      }
    }
    return best;
  }

  function updateFocusCamera(snapshot, dtSec = 1 / 60) {
    if (!state.focusTargetId || !state.focusTargetKind) return false;

    const metrics = getFrameMetrics(snapshot);
    let targetOffsetX = null;
    let targetOffsetY = null;

    if (state.focusTargetKind === "planet") {
      const p = snapshot.planetNodes?.find((node) => node.id === state.focusTargetId);
      if (!p) {
        clearFocusTarget();
        return false;
      }
      const placement = computePlanetPlacement(p, metrics);
      targetOffsetX = placement.ox;
      targetOffsetY = placement.oy;
    } else if (state.focusTargetKind === "gasGiant") {
      const gasGiants = snapshot.gasGiants || [];
      const idx = gasGiants.findIndex((g) => g.id === state.focusTargetId);
      if (idx < 0) {
        clearFocusTarget();
        return false;
      }
      const placement = computeGasGiantPlacement(
        gasGiants[idx],
        idx,
        metrics,
        snapshot.starMassMsol,
      );
      targetOffsetX = placement.ox;
      targetOffsetY = placement.oy;
    } else {
      clearFocusTarget();
      return false;
    }

    const dt = Math.max(1 / 240, Math.min(0.2, Number(dtSec) || 1 / 60));
    const panAlpha = 1 - Math.exp(-CAMERA_PAN_RATE * dt);
    const zoomAlpha = 1 - Math.exp(-CAMERA_ZOOM_RATE * dt);

    const targetZoom = clamp(
      Number.isFinite(state.focusZoomTarget) ? state.focusZoomTarget : state.zoom,
      ZOOM_MIN,
      getZoomMax(),
    );
    state.zoom += (targetZoom - state.zoom) * zoomAlpha;

    const projectedTarget = projectOrbitOffset(targetOffsetX, targetOffsetY);
    const targetPanX = -projectedTarget.x;
    const targetPanY = projectedTarget.y;
    state.panX += (targetPanX - state.panX) * panAlpha;
    state.panY += (targetPanY - state.panY) * panAlpha;

    const moving =
      Math.abs(targetPanX - state.panX) > 0.4 ||
      Math.abs(targetPanY - state.panY) > 0.4 ||
      Math.abs(targetZoom - state.zoom) > 0.002;
    return moving;
  }

  function startFocusCameraLoop() {
    if (state.isPlaying || !state.focusTargetId || cameraRafId != null) return;
    let lastCameraTs = 0;
    const cameraTick = (ts) => {
      if (disposed || !root.isConnected || state.isPlaying || !state.focusTargetId) {
        cameraRafId = null;
        return;
      }
      if (!lastCameraTs) lastCameraTs = ts;
      const dt = (ts - lastCameraTs) / 1000;
      lastCameraTs = ts;
      const snap = getSnapshot();
      const moving = updateFocusCamera(snap, dt);
      draw(snap);
      if (moving) cameraRafId = requestAnimationFrame(cameraTick);
      else cameraRafId = null;
    };
    cameraRafId = requestAnimationFrame(cameraTick);
  }

  function buildFlareSignature(snapshot) {
    const seedKey = snapshot.starSeed == null ? "" : String(snapshot.starSeed);
    const m = Number(snapshot.starMassMsol);
    const a = Number(snapshot.starAgeGyr);
    const t = Number(snapshot.starTempK);
    const l = Number(snapshot.starLuminosityLsun);
    return `${seedKey}|${m.toFixed(6)}|${a.toFixed(6)}|${t.toFixed(3)}|${l.toFixed(6)}`;
  }

  function cycleValueAt(simSec) {
    const fs = state.flareState;
    if (fs.params?.teffBin !== "FGK") return 0.5;
    const phase = (simSec / fs.cyclePeriodSec) * Math.PI * 2 + fs.cyclePhase;
    return 0.5 + 0.5 * Math.sin(phase);
  }

  function ensureFlareModel(snapshot, nowSimSec) {
    const fs = state.flareState;
    const signature = buildFlareSignature(snapshot);
    if (fs.signature === signature && fs.params) return;

    const params = computeFlareParams({
      massMsun: snapshot.starMassMsol,
      ageGyr: snapshot.starAgeGyr,
      teffK: snapshot.starTempK,
      luminosityLsun: snapshot.starLuminosityLsun,
    });
    const hasSeed = snapshot.starSeed != null && String(snapshot.starSeed).trim() !== "";
    const rng = hasSeed ? createSeededRng(snapshot.starSeed) : Math.random;

    fs.signature = signature;
    fs.params = params;
    fs.seeded = hasSeed;
    fs.rng = rng;
    fs.cmeTimes24hSec = [];
    fs.cyclePhase = rng() * Math.PI * 2;
    fs.cyclePeriodSec = (8 + rng() * 6) * 365.25 * 86400;

    const next = scheduleNextFlare(nowSimSec, params, rng);
    fs.nextFlareTimeSec = next.timeSec;
    fs.nextFlareEnergyErg = next.energyErg;
  }

  function flareVisualProfile(flareClass) {
    switch (flareClass) {
      case "super":
        return { spread: 0.22, reach: 1.9, intensity: 0.34, ttl: 1.45 };
      case "large":
        return { spread: 0.17, reach: 1.45, intensity: 0.27, ttl: 1.1 };
      case "medium":
        return { spread: 0.13, reach: 1.1, intensity: 0.21, ttl: 0.86 };
      case "small":
        return { spread: 0.09, reach: 0.82, intensity: 0.16, ttl: 0.62 };
      case "micro":
      default:
        return { spread: 0.06, reach: 0.58, intensity: 0.11, ttl: 0.42 };
    }
  }

  function pushStarBurst({ type, flareClass, energyErg, angle }) {
    const fs = state.flareState;
    const rng = fs.rng || Math.random;
    const base = flareVisualProfile(flareClass);
    const isCme = type === "cme";

    const jitter = (rng() - 0.5) * 0.25;
    const spread = Math.max(0.03, base.spread * (isCme ? 1.25 : 1.0) * (1 + jitter));
    const reach = Math.max(0.2, base.reach * (isCme ? 1.55 : 1.0) * (1 + jitter));
    const intensity = Math.max(0.06, base.intensity * (isCme ? 0.92 : 1.0) * (1 + jitter * 0.5));
    const ttl = Math.max(0.2, base.ttl * (isCme ? 1.5 : 1.0) * (1 + jitter * 0.2));

    state.starBursts.push({
      type: isCme ? "cme" : "flare",
      flareClass,
      energyErg,
      angle,
      spread,
      reach,
      curl: (rng() - 0.5) * 0.45,
      intensity,
      ttl,
      age: 0,
      beads: isCme ? 2 + Math.floor(rng() * 4) : 0,
    });
    if (state.starBursts.length > 48) {
      state.starBursts.splice(0, state.starBursts.length - 48);
    }
  }

  function updateStarBursts(dtSec, snapshot, nowActivitySec) {
    const fs = state.flareState;
    ensureFlareModel(snapshot, nowActivitySec);

    let changed = false;

    if (state.starBursts.length) {
      changed = true;
      for (const burst of state.starBursts) burst.age += dtSec;
      state.starBursts = state.starBursts.filter((b) => b.age < b.ttl);
    }

    fs.cmeTimes24hSec = fs.cmeTimes24hSec.filter((t) => t >= nowActivitySec - 86400);

    let flareCountThisTick = 0;
    while (
      Number.isFinite(fs.nextFlareTimeSec) &&
      fs.nextFlareTimeSec <= nowActivitySec &&
      flareCountThisTick < MAX_FLARES_PER_TICK
    ) {
      const flareEnergy = Number(fs.nextFlareEnergyErg) || 1e30;
      const flareClass = flareClassFromEnergy(flareEnergy);
      const angle = (fs.rng || Math.random)() * Math.PI * 2;

      pushStarBurst({
        type: "flare",
        flareClass,
        energyErg: flareEnergy,
        angle,
      });

      const recentCMECount24h = fs.cmeTimes24hSec.length;
      const activityCycle = cycleValueAt(fs.nextFlareTimeSec);
      const spawnCME = maybeSpawnCME(
        flareEnergy,
        fs.params,
        recentCMECount24h,
        {
          teffK: snapshot.starTempK,
          ageGyr: snapshot.starAgeGyr,
          massMsun: snapshot.starMassMsol,
          luminosityLsun: snapshot.starLuminosityLsun,
        },
        { activityCycle, rng: fs.rng },
      );
      if (spawnCME) {
        pushStarBurst({
          type: "cme",
          flareClass,
          energyErg: flareEnergy,
          angle: angle + ((fs.rng || Math.random)() - 0.5) * 0.22,
        });
        fs.cmeTimes24hSec.push(fs.nextFlareTimeSec);
      }

      const next = scheduleNextFlare(fs.nextFlareTimeSec, fs.params, fs.rng);
      fs.nextFlareTimeSec = next.timeSec;
      fs.nextFlareEnergyErg = next.energyErg;
      flareCountThisTick += 1;
      changed = true;
    }

    // Backlog guard for very active stars at high simulation speeds.
    if (flareCountThisTick >= MAX_FLARES_PER_TICK && fs.nextFlareTimeSec <= nowActivitySec) {
      const next = scheduleNextFlare(nowActivitySec, fs.params, fs.rng);
      fs.nextFlareTimeSec = next.timeSec;
      fs.nextFlareEnergyErg = next.energyErg;
    }

    return changed;
  }

  function drawStarBursts(cx, cy, starR, starColourHex) {
    if (!state.starBursts.length) return;

    ctx.save();
    ctx.globalCompositeOperation = "screen";

    for (const burst of state.starBursts) {
      const t = clamp(burst.age / burst.ttl, 0, 1);
      const fade = Math.sin(Math.PI * t) * burst.intensity;
      const rInner = starR * 1.03;
      const rOuter = starR * (1 + burst.reach * STAR_BURST_SIZE_SCALE * (0.55 + 0.45 * t));
      const spread = burst.spread * STAR_BURST_SIZE_SCALE * (1 - 0.25 * t);
      const a0 = burst.angle - spread;
      const a1 = burst.angle + spread;

      const g = ctx.createRadialGradient(cx, cy, rInner, cx, cy, rOuter);
      g.addColorStop(0, hexToRgba(starColourHex, Math.min(0.42, fade + 0.08)));
      g.addColorStop(0.55, `rgba(255,190,120,${(fade * 0.75).toFixed(3)})`);
      g.addColorStop(1, "rgba(255,130,90,0)");
      ctx.fillStyle = g;

      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(a0) * rInner, cy + Math.sin(a0) * rInner);
      ctx.arc(cx, cy, rOuter, a0, a1);
      ctx.lineTo(cx + Math.cos(a1) * rInner, cy + Math.sin(a1) * rInner);
      ctx.arc(cx, cy, rInner, a1, a0, true);
      ctx.closePath();
      ctx.fill();

      if (burst.type === "cme" && burst.beads > 0) {
        for (let i = 0; i < burst.beads; i++) {
          const u = (i + 1) / (burst.beads + 1);
          const rr = rInner + (rOuter - rInner) * (0.35 + u * 0.6);
          const aa = burst.angle + burst.curl * (0.2 + 0.8 * u) * (1 - t);
          const px = cx + Math.cos(aa) * rr;
          const py = cy + Math.sin(aa) * rr;
          const pr = Math.max(1.2, starR * (0.08 - u * 0.02));

          ctx.fillStyle = `rgba(255,220,170,${(fade * (0.55 - u * 0.08)).toFixed(3)})`;
          ctx.beginPath();
          ctx.arc(px, py, pr, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }

    ctx.restore();
  }

  /* ── Draw dispatcher ────────────────────────────────────────── */

  function draw(snapshotArg) {
    if (disposed || !root.isConnected || !canvas || !canvas.isConnected) return;
    if (state.mode === "cluster") return drawClusterMode();
    return drawSystemMode(snapshotArg);
  }

  function drawSystemMode(snapshotArg) {
    const snapshot =
      snapshotArg &&
      typeof snapshotArg === "object" &&
      snapshotArg.sys &&
      Array.isArray(snapshotArg.planetNodes)
        ? snapshotArg
        : getSnapshot();
    const { sys, planetNodes, debrisDisks, gasGiants, starName, starMassMsol, starColourHex } =
      snapshot;
    const debugOn = !!chkDebug?.checked;
    const nowActivitySec = state.activityTime * 86400;
    ensureFlareModel(snapshot, nowActivitySec);

    const metrics = getFrameMetrics(snapshot);
    const { W, H, baseCx, baseCy, minAu, maxAu, maxR, starR, isPhysical } = metrics;

    // At extreme zoom-out (transition animation) the canvas radii approach
    // zero, which can produce invalid createRadialGradient args.  Skip scene
    // rendering and just draw the transition bar.
    if (maxR < 1 || W < 1 || H < 1) {
      if (state.zoom < TRANSITION_ZOOM_START && !state.transitioning) {
        const progress = clamp(
          (TRANSITION_ZOOM_START - state.zoom) / (TRANSITION_ZOOM_START - TRANSITION_ZOOM_END),
          0,
          1,
        );
        drawTransitionBar(ctx, W || 1, H || 1, progress, "Zoom out to cluster view");
        if (progress >= 1.0) triggerClusterTransition();
      }
      return;
    }

    const scaleMode = !isLogScale() ? "linear" : "log";
    const usePhysicalSize = isPhysicalScale();

    // Default to centered star so the system starts centered in the canvas.
    const cx = baseCx + state.panX;
    const cy = baseCy + state.panY;
    dbgThrottled(debugOn, "scale", 800, "scale", { mode: scaleMode, minAu, maxAu, maxR });
    if (debugOn && !state.isPlaying) {
      const planetSamples = (planetNodes || []).slice(0, 6).map((p) => ({
        name: p.name,
        au: Number(p.au),
        rPx: Number(mapAuToPx(Number(p.au), minAu, maxAu, maxR).toFixed(2)),
      }));
      const gasSamples = (gasGiants || []).slice(0, 3).map((g) => ({
        name: g.name,
        au: Number(g.au),
        rPx: Number(mapAuToPx(Number(g.au), minAu, maxAu, maxR).toFixed(2)),
      }));
      dbgThrottled(debugOn, "scaleSnapshot", 1000, "scale snapshot", {
        mode: scaleMode,
        minAu,
        maxAu,
        planetSamples,
        gasSamples,
      });
    }

    // Opaque scene background (matches Local Cluster Visualiser and keeps PNG exports non-transparent).
    const bgGrad = ctx.createLinearGradient(0, 0, 0, H);
    bgGrad.addColorStop(0, "rgba(4, 7, 20, 1)");
    bgGrad.addColorStop(1, "rgba(2, 5, 16, 1)");
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, W, H);

    state.bodyHitRegions = [];
    const placedRects = [];

    // Background subtle vignette
    const grad = ctx.createRadialGradient(cx, cy, 10, cx, cy, maxR * 1.2);
    grad.addColorStop(0, "rgba(255,255,255,0.06)");
    grad.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);

    // AU reference grid (behind everything)
    if (chkGrid.checked) {
      drawAuGrid(cx, cy, minAu, maxAu, maxR);
    }

    // Habitable zone band
    const hzInnerAu = Number(sys?.habitableZoneAu?.inner);
    const hzOuterAu = Number(sys?.habitableZoneAu?.outer);
    if (
      chkHz?.checked &&
      Number.isFinite(hzInnerAu) &&
      Number.isFinite(hzOuterAu) &&
      hzOuterAu > 0
    ) {
      const hzi = Math.max(0.000001, Math.min(hzInnerAu, hzOuterAu));
      const hzo = Math.max(hzi, Math.max(hzInnerAu, hzOuterAu));
      const rIn = mapAuToPx(hzi, minAu, maxAu, maxR);
      const rOut = mapAuToPx(hzo, minAu, maxAu, maxR);

      if (rOut > rIn) {
        fillProjectedOrbitBand(cx, cy, rIn, rOut, "rgba(80, 210, 110, 0.10)");
        ctx.strokeStyle = "rgba(100, 230, 130, 0.42)";
        ctx.lineWidth = 1;
        traceProjectedOrbitRingPath(cx, cy, rIn);
        ctx.stroke();
        traceProjectedOrbitRingPath(cx, cy, rOut);
        ctx.stroke();

        if (chkLabels.checked) {
          const rMid = (rIn + rOut) * 0.5;
          const a = 0.12 * Math.PI * 2;
          const lp = orbitOffsetToScreen(Math.cos(a) * rMid, Math.sin(a) * rMid, cx, cy);
          const lx = lp.x;
          const ly = lp.y;
          ctx.fillStyle = "rgba(170,255,190,0.86)";
          ctx.font = "12px system-ui, sans-serif";
          ctx.fillText("Habitable zone", lx + 8, ly - 2);
          if (chkDistances.checked) {
            ctx.fillStyle = "rgba(170,255,190,0.65)";
            ctx.font = "11px system-ui, sans-serif";
            ctx.fillText(`${hzi.toFixed(2)}-${hzo.toFixed(2)} AU`, lx + 8, ly + 12);
          }
        }
      }
    }

    // Debris disk bands
    if (chkDebris.checked && debrisDisks?.length) {
      debrisDisks.forEach((debris, idx) => {
        if (!Number.isFinite(debris.inner) || !Number.isFinite(debris.outer) || debris.outer <= 0)
          return;
        const r1 = mapAuToPx(debris.inner, minAu, maxAu, maxR);
        const r2 = mapAuToPx(debris.outer, minAu, maxAu, maxR);
        dbgThrottled(debugOn, `mappedDebris:${idx}`, 1500, "mapped debris", {
          idx,
          inner: debris.inner,
          outer: debris.outer,
          r1,
          r2,
        });

        fillProjectedOrbitBand(
          cx,
          cy,
          r1,
          r2,
          idx === 0 ? "rgba(200,200,220,0.08)" : "rgba(180,215,190,0.08)",
        );

        if (chkLabels.checked) {
          const midAu = (debris.inner + debris.outer) / 2;
          const rr = mapAuToPx(midAu, minAu, maxAu, maxR);
          const la = (-0.35 + idx * 0.14) * Math.PI * 2;
          const lp = orbitOffsetToScreen(Math.cos(la) * rr, Math.sin(la) * rr, cx, cy);
          const lx = lp.x;
          const ly = lp.y;
          ctx.fillStyle = "rgba(255,255,255,0.70)";
          ctx.font = "12px system-ui, sans-serif";
          ctx.fillText(debris.name || "Debris disk", lx + 8, ly);
          if (chkDistances.checked) {
            ctx.fillStyle = "rgba(255,255,255,0.45)";
            ctx.font = "11px system-ui, sans-serif";
            ctx.fillText(
              `${debris.inner.toFixed(2)}-${debris.outer.toFixed(2)} AU`,
              lx + 8,
              ly + 14,
            );
          }
        }
      });
    }

    // Asteroid fields inside debris disks
    if (chkDebris.checked && debrisDisks?.length) {
      debrisDisks.forEach((debris, diskIndex) => {
        if (!Number.isFinite(debris.outer) || debris.outer <= 0) return;
        const widthAu = debris.outer - debris.inner;
        const asteroidCount = Math.min(300, Math.max(80, Math.round(160 + widthAu * 4)));
        for (let i = 0; i < asteroidCount; i++) {
          const seed = `ast:${diskIndex}:${i}`;
          const u = hashUnit(seed);
          const v = hashUnit(seed + ":v");
          const w = hashUnit(seed + ":w");
          const rAu = debris.inner + (debris.outer - debris.inner) * (0.1 + 0.8 * u);
          const rPx = mapAuToPx(rAu, minAu, maxAu, maxR);

          const ang = v * Math.PI * 2;
          const jitter = (w - 0.5) * 9;
          const ox = Math.cos(ang) * rPx + -Math.sin(ang) * jitter;
          const oy = Math.sin(ang) * rPx + Math.cos(ang) * jitter;
          const p = orbitOffsetToScreen(ox, oy, cx, cy);
          const x = p.x;
          const y = p.y;

          const size = 1 + Math.floor(hashUnit(seed + ":s") * 3);
          const base = 120 + Math.floor(hashUnit(seed + ":b") * 30);
          const c = base + Math.floor(hashUnit(seed + ":c") * 60);
          const a = 0.18 + hashUnit(seed + ":a") * 0.25;
          ctx.fillStyle = `rgba(${c},${c - 10},${c - 25},${a})`;

          ctx.beginPath();
          ctx.arc(x, y, size, 0, Math.PI * 2);
          ctx.fill();
        }
      });
    }

    const gasRenderNodes = [];
    if (gasGiants?.length) {
      gasGiants.forEach((gasGiant, idx) => {
        if (!Number.isFinite(gasGiant.au) || gasGiant.au <= 0) return;
        const placement = computeGasGiantPlacement(gasGiant, idx, metrics, starMassMsol);
        const gr = placement.r;
        const style = gasStylePalette(gasGiant.style);
        const gPos = orbitOffsetToScreen(placement.ox, placement.oy, cx, cy);
        gasRenderNodes.push({ gasGiant, idx, placement, gPos, style });

        if (chkOrbits.checked) {
          ctx.strokeStyle = "rgba(255,255,255,0.14)";
          ctx.lineWidth = 1;
          traceProjectedOrbitRingPath(cx, cy, gr);
          ctx.stroke();
        }
      });
    }

    // Hill sphere markers for gas giants
    if (chkHill?.checked) {
      for (const { gasGiant, gPos } of gasRenderNodes) {
        const mj = Number(gasGiant.massMjup);
        if (!Number.isFinite(mj) || mj <= 0 || !Number.isFinite(gasGiant.au) || gasGiant.au <= 0)
          continue;
        const hillAu = gasGiant.au * (mj / (3 * starMassMsol * MJUP_PER_MSOL)) ** (1 / 3);
        if (!Number.isFinite(hillAu) || hillAu <= 0) continue;
        const hillPx =
          mapAuToPx(gasGiant.au + hillAu, minAu, maxAu, maxR) -
          mapAuToPx(gasGiant.au, minAu, maxAu, maxR);
        drawHillSphereMarker(
          gPos.x,
          gPos.y,
          hillPx,
          chkLabels.checked,
          chkDistances.checked,
          hillAu,
        );
      }
    }

    // Frost line (dashed blue) — independent toggle
    if (chkFrost.checked && Number.isFinite(sys.frostLineAu) && sys.frostLineAu > 0) {
      const fr = mapAuToPx(sys.frostLineAu, minAu, maxAu, maxR);
      ctx.strokeStyle = "rgba(140,170,200,0.30)";
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 6]);
      traceProjectedOrbitRingPath(cx, cy, fr);
      ctx.stroke();
      ctx.setLineDash([]);

      if (chkLabels.checked) {
        const la = 0.62 * Math.PI * 2;
        const lp = orbitOffsetToScreen(Math.cos(la) * fr, Math.sin(la) * fr, cx, cy);
        const lx = lp.x;
        const ly = lp.y;
        ctx.fillStyle = "rgba(255,255,255,0.78)";
        ctx.font = "12px system-ui, sans-serif";
        ctx.fillText("H\u2082O Frost Line", lx + 10, ly - 2);
        if (chkDistances.checked) {
          ctx.fillStyle = "rgba(255,255,255,0.55)";
          ctx.font = "11px system-ui, sans-serif";
          ctx.fillText(`${sys.frostLineAu.toFixed(2)} AU`, lx + 10, ly + 12);
        }
      }
    }

    // Planet orbit rings
    if (chkOrbits.checked) {
      ctx.strokeStyle = "rgba(255,255,255,0.14)";
      ctx.lineWidth = 1;
      const useEccentricRings = chkEccentric?.checked === true;
      const inclinationActive = useEccentricRings;
      for (const p of planetNodes) {
        const r = mapAuToPx(p.au, minAu, maxAu, maxR);
        const incDeg = inclinationActive ? Number(p.inclinationDeg) || 0 : 0;
        if (useEccentricRings && Number.isFinite(p.eccentricity) && p.eccentricity > 0) {
          traceProjectedEllipseOrbitPath(
            cx,
            cy,
            r,
            p.eccentricity,
            p.longitudeOfPeriapsisDeg,
            incDeg,
          );
        } else {
          traceProjectedOrbitRingPath(cx, cy, r, incDeg);
        }
        ctx.stroke();

        // Apoapsis / periapsis markers (independent toggle)
        if (
          chkPeAp.checked &&
          useEccentricRings &&
          Number.isFinite(p.eccentricity) &&
          p.eccentricity > 0.01
        ) {
          drawApsisMarkers(
            cx,
            cy,
            r,
            p.eccentricity,
            p.longitudeOfPeriapsisDeg,
            incDeg,
            chkLabels.checked,
          );
        }
      }
    }

    const planetRenderNodes = planetNodes.map((p) => {
      const placement = computePlanetPlacement(p, metrics);
      const pPos = orbitOffsetToScreen(placement.ox, placement.oy, cx, cy, placement.oyVert || 0);
      return { p, placement, pPos };
    });

    // Hill sphere markers for rocky planets
    if (chkHill?.checked) {
      for (const { p, pPos } of planetRenderNodes) {
        if (!p.massEarth || !Number.isFinite(p.au) || p.au <= 0) continue;
        const hillAu = p.au * (p.massEarth / (3 * starMassMsol * EARTH_PER_MSOL)) ** (1 / 3);
        if (!Number.isFinite(hillAu) || hillAu <= 0) continue;
        const hillPx =
          mapAuToPx(p.au + hillAu, minAu, maxAu, maxR) - mapAuToPx(p.au, minAu, maxAu, maxR);
        drawHillSphereMarker(
          pPos.x,
          pPos.y,
          hillPx,
          chkLabels.checked,
          chkDistances.checked,
          hillAu,
        );
      }
    }

    function drawGasGiantNode(node) {
      const { gasGiant, idx, placement, gPos, style } = node;
      const ga = placement.angle;
      const gx = gPos.x;
      const gy = gPos.y;

      const gasRadiusKm =
        Number.isFinite(gasGiant.radiusRj) && gasGiant.radiusRj > 0
          ? gasGiant.radiusRj * JUPITER_RADIUS_KM
          : null;
      const ggr = usePhysicalSize
        ? physicalRadiusToPx(gasRadiusKm, starR, metrics.starRadiusKm, 0, Infinity)
        : gasGiantRadiusToPx(gasGiant.radiusRj, gasGiant.style) * metrics.bodyZoom;
      const gvx = cx - gx;
      const gvy = cy - gy;
      const gl = Math.hypot(gvx, gvy) || 1;
      const gux = gvx / gl;
      const guy = gvy / gl;

      if (isPhysical && ggr < PHYS_VIS_THRESHOLD_PX) {
        drawPositionIndicator(ctx, gx, gy, style.c1);
      } else {
        const visGgr = Math.max(ggr, 0.5);
        drawGasGiantViz(ctx, gx, gy, visGgr, gasGiant.style, {
          lightDx: gux,
          lightDy: guy,
          angle: ga,
          idx,
          showRings: gasGiant.rings,
        });
      }
      state.bodyHitRegions.push({
        kind: "gasGiant",
        id: gasGiant.id,
        x: gx,
        y: gy,
        r: Math.max(12, ggr + 4),
      });

      if (chkMoons.checked && gasGiant.moons?.length) {
        const n = gasGiant.moons.length;
        const moonAxes = gasGiant.moons
          .map((m) => Number(m.semiMajorAxisKm))
          .filter((v) => Number.isFinite(v) && v > 0);
        const minMoonAxis = moonAxes.length ? Math.min(...moonAxes) : null;
        const maxMoonAxis = moonAxes.length ? Math.max(...moonAxes) : null;
        const moonBand = Math.max(8 * (n - 1), 8);
        const useEccentricMoons = chkEccentric?.checked === true;

        for (let i = 0; i < n; i++) {
          const moon = gasGiant.moons[i];
          const moonAxis = Number(moon.semiMajorAxisKm);
          let mr = ggr + 10 + i * 8;
          if (
            Number.isFinite(moonAxis) &&
            Number.isFinite(minMoonAxis) &&
            Number.isFinite(maxMoonAxis) &&
            maxMoonAxis > minMoonAxis
          ) {
            const t =
              (Math.log10(moonAxis) - Math.log10(minMoonAxis)) /
              (Math.log10(maxMoonAxis) - Math.log10(minMoonAxis));
            mr = ggr + 10 + t * moonBand;
          }

          const mEcc = useEccentricMoons ? clamp(Number(moon.eccentricity) || 0, 0, 0.99) : 0;
          const mIncDeg = useEccentricMoons ? Number(moon.inclinationDeg) || 0 : 0;
          const mArgW = Number(moon.longitudeOfPeriapsisDeg) || 0;

          if (chkOrbits.checked) {
            ctx.strokeStyle = "rgba(255,255,255,0.12)";
            ctx.lineWidth = 1;
            if (useEccentricMoons && mEcc > 0) {
              traceProjectedEllipseOrbitPath(gx, gy, mr, mEcc, mArgW, mIncDeg);
            } else {
              traceProjectedOrbitRingPath(gx, gy, mr, mIncDeg);
            }
            ctx.stroke();

            if (chkPeAp.checked && useEccentricMoons && mEcc > 0.01) {
              drawApsisMarkers(gx, gy, mr, mEcc, mArgW, mIncDeg, chkLabels.checked);
            }
          }

          const baseMa = (i / n) * Math.PI * 2 + ga * 0.35;
          const mp = Number(moon.periodDays);
          const omegaM =
            Number.isFinite(mp) && mp > 0 ? (2 * Math.PI) / mp : (2 * Math.PI) / (6 + i * 2.5);

          let mox, moy, moyVert;
          if (useEccentricMoons && mEcc > 0) {
            const M = baseMa + omegaM * state.simTime;
            const Ea = solveKeplerEquation(M, mEcc);
            const mA = mr;
            const mB = mA * Math.sqrt(1 - mEcc * mEcc);
            const mCFocus = mA * mEcc;
            const argWRad = (mArgW * Math.PI) / 180;
            const cosW = Math.cos(argWRad);
            const sinW = Math.sin(argWRad);
            const xf = mA * Math.cos(Ea) - mCFocus;
            const zf = mB * Math.sin(Ea);
            mox = xf * cosW - zf * sinW;
            moy = xf * sinW + zf * cosW;
          } else {
            const ma = baseMa + omegaM * state.simTime;
            mox = Math.cos(ma) * mr;
            moy = Math.sin(ma) * mr;
          }

          const mIncRad = (mIncDeg * Math.PI) / 180;
          moyVert = moy * Math.sin(mIncRad);
          const moyFlat = moy * Math.cos(mIncRad);

          const mProj = projectOrbitOffset(mox, moyFlat, moyVert);
          const mx = gx + mProj.x;
          const my = gy - mProj.y;

          const moonR = usePhysicalSize
            ? physicalRadiusToPx(Number(moon.radiusKm), starR, metrics.starRadiusKm, 0, Infinity)
            : representativeMoonR(moon.radiusKm, gasRadiusKm, ggr);
          const mvx = cx - mx;
          const mvy = cy - my;
          const ml = Math.hypot(mvx, mvy) || 1;
          const mux = mvx / ml;
          const muy = mvy / ml;

          if (isPhysical && moonR < PHYS_VIS_THRESHOLD_PX) {
            drawPositionIndicator(ctx, mx, my, "rgba(200,198,195,0.75)");
          } else {
            const visM = Math.max(moonR, 0.5);
            const mhx = mx + mux * (visM * 0.55);
            const mhy = my + muy * (visM * 0.55);
            const mGrad = ctx.createRadialGradient(mhx, mhy, visM * 0.25, mx, my, visM * 1.2);
            mGrad.addColorStop(0, "rgba(232,230,225,0.96)");
            mGrad.addColorStop(0.55, "rgba(170,168,165,0.94)");
            mGrad.addColorStop(1, "rgba(55,58,62,0.92)");
            ctx.fillStyle = mGrad;
            ctx.beginPath();
            ctx.arc(mx, my, visM, 0, Math.PI * 2);
            ctx.fill();
          }

          if (chkLabels.checked) {
            ctx.fillStyle = "rgba(255,255,255,0.55)";
            ctx.font = "10px system-ui, sans-serif";
            ctx.fillText(moon.name, mx + 5, my + 4);
          }
        }
      }

      if (chkLabels.checked) {
        const gName = gasGiant.name || `Gas giant ${idx + 1}`;
        ctx.fillStyle = "rgba(255,255,255,0.75)";
        ctx.font = "12px system-ui, sans-serif";
        ctx.fillText(gName, gx + 18, gy - 4);
        if (chkDistances.checked) {
          ctx.fillStyle = "rgba(255,255,255,0.45)";
          ctx.font = "11px system-ui, sans-serif";
          ctx.fillText(`${gasGiant.au.toFixed(2)} AU`, gx + 18, gy + 12);
        }
      }
    }

    function drawPlanetNode(node) {
      const { p, placement, pPos } = node;
      const { baseAngle, pr } = placement;
      const px = pPos.x;
      const py = pPos.y;

      // Light/dark shading oriented toward the star:
      // - Sun-facing limb uses "sun high" sky colour
      // - Anti-sun limb uses "sun near horizon" sky colour
      const dxs = cx - px;
      const dys = cy - py;
      const dlen = Math.hypot(dxs, dys) || 1;
      const ux = dxs / dlen;
      const uy = dys / dlen;

      const high = p.skyHighHex || "#9bbbe0";
      const horiz = p.skyHorizonHex || "#6a6a6a";

      if (isPhysical && pr < PHYS_VIS_THRESHOLD_PX) {
        drawPositionIndicator(ctx, px, py, high);
      } else {
        const visPr = Math.max(pr, 0.5);
        // Place the bright focus slightly toward the sun; fade to horizon colour on the far side.
        const fx = px + ux * visPr * 0.55;
        const fy = py + uy * visPr * 0.55;
        const gradP = ctx.createRadialGradient(fx, fy, visPr * 0.15, px, py, visPr * 1.05);
        gradP.addColorStop(0.0, hexToRgba(high, 0.98));
        gradP.addColorStop(0.55, hexToRgba(high, 0.78));
        gradP.addColorStop(0.82, hexToRgba(horiz, 0.92));
        gradP.addColorStop(1.0, hexToRgba(horiz, 0.98));
        ctx.fillStyle = gradP;
        ctx.beginPath();
        ctx.arc(px, py, visPr, 0, Math.PI * 2);
        ctx.fill();
        // subtle outline
        ctx.strokeStyle = "rgba(0,0,0,0.22)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(px, py, visPr, 0, Math.PI * 2);
        ctx.stroke();
      }
      state.bodyHitRegions.push({
        kind: "planet",
        id: p.id,
        x: px,
        y: py,
        r: Math.max(10, pr + 3),
      });
      // Label (collision-aware)
      if (chkLabels.checked) {
        const nameText = p.name;
        const showDist = chkDistances.checked;
        const auText = `${p.au.toFixed(2)} AU`;

        ctx.font = "12px system-ui, sans-serif";
        const wName = ctx.measureText(nameText).width;
        ctx.font = "11px system-ui, sans-serif";
        const wAu = ctx.measureText(auText).width;

        const boxW = (showDist ? Math.max(wName, wAu) : wName) + 14;
        const boxH = showDist ? 34 : 22;

        const baseX = px + pr + 10;
        const baseY = py - pr - 22;

        const rect = placeLabel(ctx, placedRects, baseX - 6, baseY - 10, boxW, boxH);

        // backing
        ctx.fillStyle = "rgba(0,0,0,0.35)";
        ctx.beginPath();
        ctx.roundRect(rect.x, rect.y, rect.w, rect.h, 8);
        ctx.fill();

        // text
        ctx.fillStyle = "rgba(255,255,255,0.82)";
        ctx.font = "12px system-ui, sans-serif";
        ctx.fillText(nameText, rect.x + 8, rect.y + (showDist ? 16 : 14));

        if (showDist) {
          ctx.fillStyle = "rgba(255,255,255,0.58)";
          ctx.font = "11px system-ui, sans-serif";
          ctx.fillText(auText, rect.x + 8, rect.y + 30);
        }
      }

      // Moons
      if (chkMoons.checked && p.moons?.length) {
        const n = p.moons.length;
        const moonAxes = p.moons
          .map((m) => Number(m.semiMajorAxisKm))
          .filter((v) => Number.isFinite(v) && v > 0);
        const minMoonAxis = moonAxes.length ? Math.min(...moonAxes) : null;
        const maxMoonAxis = moonAxes.length ? Math.max(...moonAxes) : null;
        const moonBand = Math.max(8 * (n - 1), 8);
        const useEccentricMoons = chkEccentric?.checked === true;

        for (let i = 0; i < n; i++) {
          const moon = p.moons[i];
          const moonAxis = Number(moon.semiMajorAxisKm);
          let mr = pr + 10 + i * 8;
          if (
            Number.isFinite(moonAxis) &&
            Number.isFinite(minMoonAxis) &&
            Number.isFinite(maxMoonAxis) &&
            maxMoonAxis > minMoonAxis
          ) {
            const t =
              (Math.log10(moonAxis) - Math.log10(minMoonAxis)) /
              (Math.log10(maxMoonAxis) - Math.log10(minMoonAxis));
            mr = pr + 10 + t * moonBand;
          }

          const mEcc = useEccentricMoons ? clamp(Number(moon.eccentricity) || 0, 0, 0.99) : 0;
          const mIncDeg = useEccentricMoons ? Number(moon.inclinationDeg) || 0 : 0;
          const mArgW = Number(moon.longitudeOfPeriapsisDeg) || 0;

          // orbit ring (projected ellipse centered on planet)
          if (chkOrbits.checked) {
            ctx.strokeStyle = "rgba(255,255,255,0.12)";
            ctx.lineWidth = 1;
            if (useEccentricMoons && mEcc > 0) {
              traceProjectedEllipseOrbitPath(px, py, mr, mEcc, mArgW, mIncDeg);
            } else {
              traceProjectedOrbitRingPath(px, py, mr, mIncDeg);
            }
            ctx.stroke();

            // Moon apse markers (independent toggle)
            if (chkPeAp.checked && useEccentricMoons && mEcc > 0.01) {
              drawApsisMarkers(px, py, mr, mEcc, mArgW, mIncDeg, chkLabels.checked);
            }
          }

          // moon body position — Kepler solve when eccentric
          const baseMa = (i / n) * Math.PI * 2 + baseAngle * 0.35;
          const mp = Number(moon.periodDays);
          const omegaM =
            Number.isFinite(mp) && mp > 0 ? (2 * Math.PI) / mp : (2 * Math.PI) / (6 + i * 2.5);

          let mox, moy, moyVert;
          if (useEccentricMoons && mEcc > 0) {
            const M = baseMa + omegaM * state.simTime;
            const Ea = solveKeplerEquation(M, mEcc);
            const mA = mr;
            const mB = mA * Math.sqrt(1 - mEcc * mEcc);
            const mCFocus = mA * mEcc;
            const argWRad = (mArgW * Math.PI) / 180;
            const cosW = Math.cos(argWRad);
            const sinW = Math.sin(argWRad);
            const xf = mA * Math.cos(Ea) - mCFocus;
            const zf = mB * Math.sin(Ea);
            mox = xf * cosW - zf * sinW;
            moy = xf * sinW + zf * cosW;
          } else {
            const ma = baseMa + omegaM * state.simTime;
            mox = Math.cos(ma) * mr;
            moy = Math.sin(ma) * mr;
          }

          // Apply inclination tilt
          const mIncRad = (mIncDeg * Math.PI) / 180;
          moyVert = moy * Math.sin(mIncRad);
          const moyFlat = moy * Math.cos(mIncRad);

          // Project moon offset relative to planet screen position
          const mProj = projectOrbitOffset(mox, moyFlat, moyVert);
          const mx = px + mProj.x;
          const my = py - mProj.y;

          // Moon shading (Earth's Moon-ish): bright side towards the star.
          const planetKm =
            Number.isFinite(p.radiusEarth) && p.radiusEarth > 0
              ? p.radiusEarth * EARTH_RADIUS_KM
              : EARTH_RADIUS_KM;
          const moonR = usePhysicalSize
            ? physicalRadiusToPx(Number(moon.radiusKm), starR, metrics.starRadiusKm, 0, Infinity)
            : representativeMoonR(moon.radiusKm, planetKm, pr);
          const mvx = cx - mx;
          const mvy = cy - my;
          const ml = Math.hypot(mvx, mvy) || 1;
          const mux = mvx / ml;
          const muy = mvy / ml;

          if (isPhysical && moonR < PHYS_VIS_THRESHOLD_PX) {
            drawPositionIndicator(ctx, mx, my, "rgba(200,198,195,0.75)");
          } else {
            const visM = Math.max(moonR, 0.5);
            const mhx = mx + mux * (visM * 0.55);
            const mhy = my + muy * (visM * 0.55);
            const mGrad = ctx.createRadialGradient(mhx, mhy, visM * 0.25, mx, my, visM * 1.2);
            mGrad.addColorStop(0, "rgba(232,230,225,0.96)"); // sunlit highlands
            mGrad.addColorStop(0.55, "rgba(170,168,165,0.94)");
            mGrad.addColorStop(1, "rgba(55,58,62,0.92)"); // night side
            ctx.fillStyle = mGrad;
            ctx.beginPath();
            ctx.arc(mx, my, visM, 0, Math.PI * 2);
            ctx.fill();
          }

          if (chkLabels.checked) {
            ctx.fillStyle = "rgba(255,255,255,0.55)";
            ctx.font = "10px system-ui, sans-serif";
            ctx.fillText(moon.name, mx + 5, my + 4);
          }
        }
      }
    }

    function isBehindStar(depth) {
      return Number.isFinite(depth) && depth < 0;
    }

    // Back-half bodies render before the star so star occludes them.
    for (const node of gasRenderNodes) {
      if (isBehindStar(node.gPos.depth)) drawGasGiantNode(node);
    }
    for (const node of planetRenderNodes) {
      if (isBehindStar(node.pPos.depth)) drawPlanetNode(node);
    }

    // Star + subtle animated corona glow
    const glowPulse = 0.55 + 0.45 * Math.sin(state.simTime * 0.08 + starMassMsol * 0.45);
    const coronaOuterR = starR * (2.05 + 0.14 * glowPulse);
    const coronaGrad = ctx.createRadialGradient(cx, cy, starR * 0.55, cx, cy, coronaOuterR);
    coronaGrad.addColorStop(0, hexToRgba(starColourHex, 0.24));
    coronaGrad.addColorStop(0.45, hexToRgba(starColourHex, 0.11));
    coronaGrad.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = coronaGrad;
    ctx.beginPath();
    ctx.arc(cx, cy, coronaOuterR, 0, Math.PI * 2);
    ctx.fill();

    ctx.save();
    ctx.translate(cx, cy);
    const starGrad = ctx.createRadialGradient(0, 0, 5, 0, 0, starR * 1.4);
    starGrad.addColorStop(0, `${starColourHex}FF`);
    starGrad.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = starGrad;
    ctx.beginPath();
    ctx.arc(0, 0, starR * 1.3, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = starColourHex;
    ctx.beginPath();
    ctx.arc(0, 0, starR, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Occasional flare / CME visuals.
    drawStarBursts(cx, cy, starR, starColourHex);

    if (chkLabels.checked) {
      const maxTextWidth = Math.max(24, starR * 1.5);
      let label = starName;
      let fontSize = clamp(starR * 0.42, 10, 18);

      ctx.save();
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";

      while (fontSize > 9) {
        ctx.font = `${Math.round(fontSize)}px system-ui, sans-serif`;
        if (ctx.measureText(label).width <= maxTextWidth) break;
        fontSize -= 1;
      }

      if (ctx.measureText(label).width > maxTextWidth) {
        while (label.length > 4 && ctx.measureText(`${label}...`).width > maxTextWidth) {
          label = label.slice(0, -1);
        }
        label = label.length ? `${label}...` : "Star";
      }

      ctx.strokeStyle = "rgba(0,0,0,0.45)";
      ctx.lineWidth = 3;
      ctx.strokeText(label, cx, cy);

      ctx.fillStyle = "rgba(255,255,255,0.92)";
      ctx.fillText(label, cx, cy);
      ctx.restore();
    }

    // Front-half bodies render after star so they pass in front.
    for (const node of gasRenderNodes) {
      if (!isBehindStar(node.gPos.depth)) drawGasGiantNode(node);
    }
    for (const node of planetRenderNodes) {
      if (!isBehindStar(node.pPos.depth)) drawPlanetNode(node);
    }

    // Show/hide Reset View button when camera deviates from default
    const viewChanged =
      Math.abs(state.zoom - DEFAULT_ZOOM) > 0.01 ||
      Math.abs(state.panX) > 1 ||
      Math.abs(state.panY) > 1 ||
      Math.abs(state.yaw - DEFAULT_YAW) > 0.01 ||
      Math.abs(state.pitch - DEFAULT_PITCH) > 0.01;
    if (btnResetView) btnResetView.disabled = !viewChanged;

    // Cluster transition progress bar
    if (state.zoom < TRANSITION_ZOOM_START && !state.transitioning) {
      const progress = clamp(
        (TRANSITION_ZOOM_START - state.zoom) / (TRANSITION_ZOOM_START - TRANSITION_ZOOM_END),
        0,
        1,
      );
      drawTransitionBar(ctx, W, H, progress, "Zoom out to cluster view");
      if (progress >= 1.0) triggerClusterTransition();
    }
  }

  /* ── Cluster-mode draw ─────────────────────────────────────── */

  function drawClusterMode() {
    if (!state.clusterSnapshot) refreshClusterSnapshot();
    if (!state.clusterSnapshot) return;
    resizeCanvas(false);
    const W = canvas.clientWidth;
    const H = canvas.clientHeight;

    const result = drawClusterScene(ctx, W, H, state, state.clusterSnapshot, {
      labels: !!chkClusterLabels?.checked,
      links: !!chkClusterLinks?.checked,
      axes: !!chkClusterAxes?.checked,
      rangeGrid: !!chkClusterGrid?.checked,
      useMils: !!clusterMilsEl?.checked,
      mouseX: state.clusterMouseX,
      mouseY: state.clusterMouseY,
    });

    canvas.style.cursor = state.dragging ? "grabbing" : result?.hoverEntry ? "pointer" : "grab";

    // Show/hide Reset View button
    const viewChanged =
      Math.abs(state.zoom - CLUSTER_DEFAULT_ZOOM) > 0.01 ||
      Math.abs(state.yaw - CLUSTER_DEFAULT_YAW) > 0.01 ||
      Math.abs(state.pitch - CLUSTER_DEFAULT_PITCH) > 0.01;
    if (btnResetView) btnResetView.disabled = !viewChanged;

    // System transition progress bar (zoom-in past normal max)
    if (state.zoom > CLUSTER_TRANSITION_ZOOM_START && !state.transitioning) {
      const progress = clamp(
        (state.zoom - CLUSTER_TRANSITION_ZOOM_START) /
          (CLUSTER_TRANSITION_ZOOM_END - CLUSTER_TRANSITION_ZOOM_START),
        0,
        1,
      );
      drawTransitionBar(ctx, W, H, progress, "Zoom in to system view");
      if (progress >= 1.0) triggerSystemTransition();
    }
  }

  /* ── Transition animations (mode switch, no page navigation) ─ */

  function triggerClusterTransition() {
    if (state.transitioning) return;
    state.transitioning = true;
    hideToast();
    if (state.isPlaying) {
      state.isPlaying = false;
      if (btnPlay) btnPlay.textContent = "Play";
      if (rafId != null) {
        cancelAnimationFrame(rafId);
        rafId = null;
      }
    }

    const startZoom = state.zoom;
    const endZoom = 0.02;
    const startPanX = state.panX;
    const startPanY = state.panY;
    const duration = 400;
    const t0 = performance.now();

    function shrinkTick(now) {
      if (disposed) return;
      const elapsed = now - t0;
      const t = Math.min(1, elapsed / duration);
      const ease = t * t;
      state.zoom = startZoom + (endZoom - startZoom) * ease;
      state.panX = startPanX * (1 - ease);
      state.panY = startPanY * (1 - ease);
      drawSystemMode();
      if (t < 1) {
        requestAnimationFrame(shrinkTick);
      } else {
        /* Switch to cluster mode at high zoom (zoomed into home star) */
        switchMode("cluster");
        state.zoom = 10.0;
        state.yaw = CLUSTER_DEFAULT_YAW;
        state.pitch = CLUSTER_DEFAULT_PITCH;
        animateZoomTo(CLUSTER_DEFAULT_ZOOM, 800);
      }
    }
    requestAnimationFrame(shrinkTick);
  }

  function triggerSystemTransition() {
    if (state.transitioning) return;
    state.transitioning = true;
    if (state.clusterIsPlaying) {
      state.clusterIsPlaying = false;
      if (btnClusterPlay) btnClusterPlay.textContent = "Play";
      if (rafId != null) {
        cancelAnimationFrame(rafId);
        rafId = null;
      }
    }

    const startZoom = state.zoom;
    const endZoom = 15.0;
    const duration = 400;
    const t0 = performance.now();

    function shrinkTick(now) {
      if (disposed) return;
      const elapsed = now - t0;
      const t = Math.min(1, elapsed / duration);
      const ease = t * t;
      state.zoom = startZoom + (endZoom - startZoom) * ease;
      drawClusterMode();
      if (t < 1) {
        requestAnimationFrame(shrinkTick);
      } else {
        /* Switch to system mode at low zoom */
        switchMode("system");
        state.zoom = 0.05;
        state.panX = 0;
        state.panY = 0;
        state.yaw = DEFAULT_YAW;
        state.pitch = DEFAULT_PITCH;
        animateZoomTo(DEFAULT_ZOOM, 800);
      }
    }
    requestAnimationFrame(shrinkTick);
  }

  function animateZoomTo(target, durationMs) {
    state.transitioning = true;
    const startZoom = state.zoom;
    const startPanX = state.panX;
    const startPanY = state.panY;
    const t0 = performance.now();

    function expandTick(now) {
      if (disposed) return;
      const elapsed = now - t0;
      const t = Math.min(1, elapsed / durationMs);
      const ease = 1 - Math.pow(1 - t, 3);
      state.zoom = startZoom + (target - startZoom) * ease;
      state.panX = startPanX * (1 - ease);
      state.panY = startPanY * (1 - ease);
      draw();
      if (t < 1) {
        requestAnimationFrame(expandTick);
      } else {
        state.transitioning = false;
      }
    }
    requestAnimationFrame(expandTick);
  }

  // Camera controls:
  // - Left mouse drag pans the view.
  // - Right mouse drag rotates the view.
  let dragMode = null; // "pan" | "rotate" | null
  let lastX = 0,
    lastY = 0;
  let draggedDuringPointer = false;
  let suppressPlanetClickUntilMs = 0;
  addDisposableListener(canvas, "contextmenu", (e) => {
    // Keep right-drag rotation usable without the browser context menu interrupting.
    e.preventDefault();
  });
  addDisposableListener(canvas, "mousedown", (e) => {
    if (state.mode === "cluster") {
      /* Cluster: any button rotates */
      dragMode = "rotate";
      state.dragging = true;
    } else {
      if (e.button === 0) dragMode = "pan";
      else if (e.button === 2) dragMode = "rotate";
      else return;
    }
    if (e.button === 2) e.preventDefault();
    draggedDuringPointer = false;
    lastX = e.clientX;
    lastY = e.clientY;
  });
  addDisposableListener(window, "mouseup", () => {
    if (!dragMode) return;
    dragMode = null;
    state.dragging = false;
    if (draggedDuringPointer) suppressPlanetClickUntilMs = performance.now() + 140;
  });
  addDisposableListener(window, "mousemove", (e) => {
    if (disposed || !root.isConnected) return;
    if (!dragMode) return;
    const dx = e.clientX - lastX;
    const dy = e.clientY - lastY;
    if (!draggedDuringPointer && (Math.abs(dx) > 1 || Math.abs(dy) > 1)) {
      draggedDuringPointer = true;
      // Left-drag (pan) detaches focus but keeps current pan offset so the
      // view doesn't snap to the star.  Right-drag (rotate) keeps focus.
      if (state.mode === "system" && state.focusTargetId && dragMode === "pan") {
        clearFocusTarget();
      }
    }
    if (state.mode === "cluster") {
      /* Cluster: always rotate */
      state.yaw -= dx * 0.006;
      state.pitch = clamp(state.pitch + dy * 0.004, -1.45, 1.45);
    } else if (dragMode === "pan") {
      state.panX += dx;
      state.panY += dy;
    } else if (dragMode === "rotate") {
      state.yaw -= dx * 0.006;
      state.pitch = clamp(state.pitch + dy * 0.004, PITCH_MIN, PITCH_MAX);
      // Keep pan tracking the focused body at the new camera angle
      if (state.focusTargetId) {
        const snap = getSnapshot();
        updateFocusCamera(snap, 1 / 60);
      }
    }
    lastX = e.clientX;
    lastY = e.clientY;
    draw();
  });

  addDisposableListener(canvas, "click", (e) => {
    if (disposed || !root.isConnected) return;
    if (state.mode === "cluster") return; // no click handling in cluster mode
    if (performance.now() < suppressPlanetClickUntilMs) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const hit = hitTestBody(x, y);
    if (!hit?.id || !hit?.kind) return;
    setFocusTarget(hit.kind, hit.id);
    const snapshot = getSnapshot();
    updateFocusCamera(snapshot, 1 / 60);
    draw(snapshot);
    startFocusCameraLoop();
  });

  // zoom with wheel
  const wheelOptions = { passive: false };
  addDisposableListener(
    canvas,
    "wheel",
    (e) => {
      if (disposed || !root.isConnected || state.transitioning) return;
      e.preventDefault();
      const delta = Math.sign(e.deltaY);

      if (state.mode === "cluster") {
        /* Cluster: simple multiply zoom */
        state.zoom = clamp(
          state.zoom * (delta > 0 ? 0.92 : 1.08),
          CLUSTER_ZOOM_MIN,
          CLUSTER_ZOOM_MAX,
        );
        draw();
        return;
      }

      /* System mode */
      const oldZoom = state.zoom;
      const nextZoom = clamp(oldZoom * (delta > 0 ? 0.9 : 1.1), ZOOM_MIN, getZoomMax());

      if (state.focusTargetId) {
        // Scale pan proportionally so the focused body stays at the same
        // screen position — orbital offsets scale linearly with zoom via
        // maxR, so pan must follow the same ratio to avoid a visible jerk.
        const zoomRatio = nextZoom / oldZoom;
        state.panX *= zoomRatio;
        state.panY *= zoomRatio;
        state.zoom = nextZoom;
        state.focusZoomTarget = nextZoom;
        const snapshot = getSnapshot();
        updateFocusCamera(snapshot, 1 / 60);
        draw(snapshot);
        startFocusCameraLoop();
        return;
      }

      // Zoom toward mouse cursor: adjust pan so the point under the
      // cursor stays at the same screen position after the scale change.
      const rect = canvas.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;
      const cx = canvas.clientWidth * 0.5 + state.panX;
      const cy = canvas.clientHeight * 0.5 + state.panY;
      const factor = nextZoom / oldZoom;
      state.panX += (mouseX - cx) * (1 - factor);
      state.panY += (mouseY - cy) * (1 - factor);

      state.zoom = nextZoom;
      draw();
    },
    wheelOptions,
  );

  addDisposableListener(btnRefresh, "click", () => {
    invalidateSnapshot();
    draw();
  });

  updateSpeedUI();
  syncExportButtons();
  addDisposableListener(rngSpeed, "input", () => {
    updateSpeedUI();
    if (!state.isPlaying) draw();
  });

  const rngBodyScale = root.querySelector("#rng-body-scale");
  const txtBodyScale = root.querySelector("#txt-body-scale");
  const bodyScaleRow = root.querySelector("#body-scale-row");
  addDisposableListener(rngBodyScale, "input", () => {
    state.bodyScale = Number(rngBodyScale.value) / 100;
    txtBodyScale.textContent = `${rngBodyScale.value}%`;
    if (!state.isPlaying) draw();
  });

  addDisposableListener(btnExportImage, "click", async () => {
    if (state.exportingGif) return;
    try {
      draw();
      await downloadCanvasPng(canvas, exportFileName("png"));
    } catch (err) {
      console.error("[viz] Could not export PNG image.", err);
    }
  });

  addDisposableListener(btnExportGif, "click", async () => {
    const playing = state.mode === "cluster" ? state.clusterIsPlaying : state.isPlaying;
    if (!playing || state.exportingGif) return;
    state.exportingGif = true;
    syncExportButtons();
    const originalLabel = btnExportGif?.textContent || "Download GIF";
    if (btnExportGif) btnExportGif.textContent = "Recording GIF...";

    if (rafId != null) {
      try {
        cancelAnimationFrame(rafId);
      } catch {}
      rafId = null;
    }

    try {
      await captureCanvasGif({
        canvas,
        filename: exportFileName("gif"),
        fps: 12,
        seconds: 4,
        renderFrame: ({ frameIndex, deltaTimeSec }) => {
          if (state.mode === "cluster") {
            if (frameIndex > 0) state.yaw += deltaTimeSec * 0.2 * state.clusterSpinSpeed;
            draw();
          } else {
            if (frameIndex > 0) {
              state.simTime += deltaTimeSec * state.speed;
              const activitySpeed = 1 + (state.speed - 1) * ACTIVITY_SPEED_BLEND;
              state.activityTime += deltaTimeSec * activitySpeed;
              const snapshot = getSnapshot();
              updateStarBursts(deltaTimeSec, snapshot, state.activityTime * 86400);
            }
            const snapshot = getSnapshot();
            if (state.focusTargetId) updateFocusCamera(snapshot, deltaTimeSec);
            draw(snapshot);
          }
        },
        onStatus: (status) => {
          if (!btnExportGif) return;
          if (status === "loading") btnExportGif.textContent = "Loading encoder...";
          else if (status === "recording") btnExportGif.textContent = "Recording GIF...";
          else if (status === "encoding") btnExportGif.textContent = "Encoding GIF...";
        },
      });
    } catch (err) {
      console.error("[viz] Could not export GIF animation.", err);
    } finally {
      state.exportingGif = false;
      if (btnExportGif) btnExportGif.textContent = originalLabel;
      syncExportButtons();
      if (!disposed && root.isConnected) {
        const p = state.mode === "cluster" ? state.clusterIsPlaying : state.isPlaying;
        if (p && rafId == null) {
          if (state.mode === "cluster") state.clusterLastTick = 0;
          else state.lastTick = 0;
          rafId = requestAnimationFrame(tick);
        }
      }
      draw();
    }
  });

  addDisposableListener(btnPlay, "click", () => {
    state.isPlaying = !state.isPlaying;
    btnPlay.textContent = state.isPlaying ? "Pause" : "Play";
    state.lastTick = 0;
    if (state.isPlaying) {
      if (cameraRafId != null) {
        try {
          cancelAnimationFrame(cameraRafId);
        } catch {}
        cameraRafId = null;
      }
      rafId = requestAnimationFrame(tick);
    } else if (rafId != null) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
    syncExportButtons();
  });

  // Reset view — zoom, pan, and camera orientation back to defaults
  addDisposableListener(btnResetView, "click", () => {
    if (state.mode === "cluster") {
      state.yaw = CLUSTER_DEFAULT_YAW;
      state.pitch = CLUSTER_DEFAULT_PITCH;
      state.zoom = CLUSTER_DEFAULT_ZOOM;
    } else {
      clearFocusTarget();
      state.panX = 0;
      state.panY = 0;
      state.yaw = DEFAULT_YAW;
      state.pitch = DEFAULT_PITCH;
      state.zoom = DEFAULT_ZOOM;
    }
    draw();
  });

  // Controls dropdown toggle
  function setDropdownOpen(open) {
    if (!vizDropdown || !btnControls) return;
    vizDropdown.style.display = open ? "" : "none";
    btnControls.innerHTML =
      (tipIcon(TIP_LABEL["Controls"] || "") || "") + " Controls " + (open ? "\u25B4" : "\u25BE");
  }
  addDisposableListener(btnControls, "click", (e) => {
    e.stopPropagation();
    const isOpen = vizDropdown.style.display !== "none";
    setDropdownOpen(!isOpen);
  });
  // Click outside dropdown closes it
  addDisposableListener(document, "mousedown", (e) => {
    if (
      vizDropdown.style.display !== "none" &&
      !vizDropdown.contains(e.target) &&
      e.target !== btnControls &&
      !btnControls.contains(e.target)
    ) {
      setDropdownOpen(false);
    }
  });

  // Browser Fullscreen API
  addDisposableListener(btnFullscreen, "click", () => {
    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else if (vizLayout.requestFullscreen) {
      vizLayout.requestFullscreen();
    } else if (vizLayout.webkitRequestFullscreen) {
      vizLayout.webkitRequestFullscreen();
    }
  });
  function onFullscreenChange() {
    const isFs = !!document.fullscreenElement;
    btnFullscreen.textContent = isFs ? "Exit fullscreen" : "Fullscreen";
  }
  addDisposableListener(document, "fullscreenchange", onFullscreenChange);
  addDisposableListener(document, "webkitfullscreenchange", onFullscreenChange);

  [
    chkLabels,
    chkMoons,
    chkOrbits,
    chkHz,
    chkDebris,
    chkEccentric,
    chkPeAp,
    chkFrost,
    chkDistances,
    chkGrid,
    chkDebug,
  ].forEach((el) => {
    addDisposableListener(el, "change", draw);
  });
  root.querySelectorAll('[name="vizDistanceScale"]').forEach((el) => {
    addDisposableListener(el, "change", draw);
  });
  root.querySelectorAll('[name="vizSizeScale"]').forEach((el) => {
    addDisposableListener(el, "change", () => {
      state.zoom = clamp(state.zoom, ZOOM_MIN, getZoomMax());
      if (Number.isFinite(state.focusZoomTarget)) {
        state.focusZoomTarget = clamp(state.focusZoomTarget, ZOOM_MIN, getFocusMaxZoom());
      }
      if (bodyScaleRow) bodyScaleRow.style.display = isPhysicalScale() ? "none" : "";
      draw();
    });
  });

  /* ── Cluster-mode event listeners ──────────────────────────── */

  // Track mouse position for cluster hover labels
  addDisposableListener(canvas, "mousemove", (e) => {
    if (state.mode !== "cluster") return;
    const rect = canvas.getBoundingClientRect();
    state.clusterMouseX = e.clientX - rect.left;
    state.clusterMouseY = e.clientY - rect.top;
    if (!state.clusterIsPlaying && !state.transitioning) draw();
  });
  addDisposableListener(canvas, "mouseleave", () => {
    state.clusterMouseX = null;
    state.clusterMouseY = null;
    if (state.mode === "cluster" && !state.clusterIsPlaying && !state.transitioning) draw();
  });

  // Cluster controls
  addDisposableListener(btnClusterRefresh, "click", () => {
    refreshClusterSnapshot();
    draw();
  });
  addDisposableListener(btnClusterPlay, "click", () => {
    state.clusterIsPlaying = !state.clusterIsPlaying;
    if (btnClusterPlay) btnClusterPlay.textContent = state.clusterIsPlaying ? "Pause" : "Play";
    if (state.clusterIsPlaying) {
      state.clusterLastTick = 0;
      rafId = requestAnimationFrame(tick);
    } else if (rafId != null) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
    syncExportButtons();
  });
  addDisposableListener(rngClusterSpeed, "input", () => {
    updateClusterSpeedUI();
  });
  [chkClusterLabels, chkClusterLinks, chkClusterAxes, chkClusterGrid]
    .filter(Boolean)
    .forEach((el) => addDisposableListener(el, "change", draw));
  root.querySelectorAll('[name="clusterBearingUnit"]').forEach((el) => {
    addDisposableListener(el, "change", draw);
  });

  // Toast close
  addDisposableListener(vizToastClose, "click", hideToast);

  /* ── Tick / animation loop (both modes) ────────────────────── */

  function tick(ts) {
    if (disposed || !root.isConnected) {
      dispose();
      return;
    }

    if (state.mode === "cluster") {
      /* Cluster auto-spin */
      if (!state.clusterIsPlaying) {
        rafId = null;
        return;
      }
      if (!state.clusterLastTick) state.clusterLastTick = ts;
      const dt = (ts - state.clusterLastTick) / 1000;
      state.clusterLastTick = ts;
      state.yaw += dt * 0.2 * state.clusterSpinSpeed;
      draw();
      rafId = requestAnimationFrame(tick);
      return;
    }

    /* System orbit animation */
    if (!state.isPlaying) {
      rafId = null;
      return;
    }
    if (!state.lastTick) state.lastTick = ts;
    const dt = (ts - state.lastTick) / 1000;
    state.lastTick = ts;
    state.simTime += dt * state.speed;
    const activitySpeed = 1 + (state.speed - 1) * ACTIVITY_SPEED_BLEND;
    state.activityTime += dt * activitySpeed;
    const snapshot = getSnapshot();
    updateStarBursts(dt, snapshot, state.activityTime * 86400);
    if (state.focusTargetId) updateFocusCamera(snapshot, dt);
    draw(snapshot);
    rafId = requestAnimationFrame(tick);
  }

  // Auto-refresh when data changes in other tabs
  addDisposableListener(window, "worldsmith:worldChanged", () => {
    invalidateSnapshot();
    state.clusterSnapshot = null;
    draw();
    if (state.mode === "system") startFocusCameraLoop();
  });
  addDisposableListener(window, "storage", (e) => {
    if (e.key && e.key.includes("worldsmith")) {
      invalidateSnapshot();
      state.clusterSnapshot = null;
      draw();
      if (state.mode === "system") startFocusCameraLoop();
    }
  });

  /* Window resize is handled by the ResizeObserver on vizWrap */

  resizeCanvas(true);

  /* Initialise based on start mode */
  if (state.mode === "cluster") {
    refreshClusterSnapshot();
    state.yaw = CLUSTER_DEFAULT_YAW;
    state.pitch = CLUSTER_DEFAULT_PITCH;
    state.zoom = CLUSTER_DEFAULT_ZOOM;
  }
  draw();
}

// EOF
