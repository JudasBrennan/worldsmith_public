import {
  GAS_GIANT_RADIUS_MAX_RJ,
  GAS_GIANT_RADIUS_MIN_RJ,
  loadWorld,
  listPlanets,
  listMoons,
  listSystemGasGiants,
  listSystemDebrisDisks,
  getStarOverrides,
} from "./store.js";
import { calcSystem } from "../engine/system.js";
import { calcStar, starColourHexFromTempK } from "../engine/star.js";
import { calcPlanetExact } from "../engine/planet.js";
import { calcMoonExact } from "../engine/moon.js";
import { calcGasGiant } from "../engine/gasGiant.js";
import {
  FLARE_E0_ERG,
  computeStellarActivityModel,
  scheduleNextFlare,
  scheduleNextCme,
  maybeSpawnCME,
  flareClassFromEnergy,
  createSeededRng,
} from "../engine/stellarActivity.js";
import { calcLagrangePoints } from "../engine/lagrange.js";
import { attachTooltips, tipIcon } from "./tooltip.js";
import { captureCanvasGif, downloadCanvasPng, makeTimestampToken } from "./canvasExport.js";
import { gasStylePalette } from "./gasGiantStyles.js";
import { computeRockyVisualProfile } from "./rockyPlanetStyles.js";
import { computeMoonVisualProfile } from "./moonStyles.js";
import { buildClusterSnapshot } from "./vizClusterRenderer.js";
import { loadThreeCore } from "./threeBridge2d.js";
import { gasAssetPath, moonAssetPath, rockyAssetPath } from "./threeRenderAssetMap.js";

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

function representativePlanetBaseRadiusPx(node, bodyZoom = 1) {
  const radiusEarth =
    Number.isFinite(node?.radiusEarth) && node.radiusEarth > 0
      ? node.radiusEarth
      : Number.isFinite(node?.radiusKm) && node.radiusKm > 0
        ? node.radiusKm / EARTH_RADIUS_KM
        : 1;
  return planetRadiusToPx(radiusEarth) * Math.max(0, Number(bodyZoom) || 1);
}

function representativeGasBaseRadiusPx(node, bodyZoom = 1) {
  return gasGiantRadiusToPx(node?.radiusRj, node?.style) * Math.max(0, Number(bodyZoom) || 1);
}

function applyRepresentativeBodyRadiusConstraints(rawRadiusPx, metrics) {
  const raw = Number(rawRadiusPx);
  if (!Number.isFinite(raw) || raw <= 0) return 0;
  const scale = Number(metrics?.repBodyScale);
  const minVisiblePx = Number(metrics?.repBodyMinPx);
  const starCapPx = Number(metrics?.starR);
  let r = raw * (Number.isFinite(scale) && scale > 0 ? scale : 1);
  if (Number.isFinite(minVisiblePx) && minVisiblePx > 0) r = Math.max(minVisiblePx, r);
  if (Number.isFinite(starCapPx) && starCapPx > 0) r = Math.min(starCapPx, r);
  return r;
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
// Moon labels create heavy clutter in wide system overviews; hide them until users zoom in.
const MOON_LABEL_MIN_ZOOM = 2.5;
const DEBRIS_PARTICLE_DENSITY = 0.007;
const DEBRIS_PARTICLE_MIN = 180;
const DEBRIS_PARTICLE_MAX = 900;

function computeDebrisParticleTarget(innerPx, outerPx, innerAu, outerAu) {
  const rIn = Math.max(0, Number(innerPx) || 0);
  const rOut = Math.max(rIn + 0.001, Number(outerPx) || rIn + 0.001);
  const areaPx2 = Math.PI * Math.max(0, rOut * rOut - rIn * rIn);
  const widthAu = Math.max(0, (Number(outerAu) || 0) - (Number(innerAu) || 0));
  const target = Math.round(areaPx2 * DEBRIS_PARTICLE_DENSITY + widthAu * 10 + 50);
  return clamp(target, DEBRIS_PARTICLE_MIN, DEBRIS_PARTICLE_MAX);
}

function sampleDebrisRadiusPx(innerPx, outerPx, seedBase) {
  const rIn = Number(innerPx) || 0;
  const rOut = Number(outerPx) || rIn;
  const width = Math.max(0.001, rOut - rIn);
  // Triangular distribution gives a denser core and softer belt edges.
  const tCore = (hashUnit(`${seedBase}:r1`) + hashUnit(`${seedBase}:r2`)) * 0.5;
  const radialJitter = (hashUnit(`${seedBase}:rj`) - 0.5) * Math.max(2.2, width * 0.08);
  return clamp(rIn + width * tCore + radialJitter, rIn, rOut);
}

function debrisKeepChance(angleRad, seedBase) {
  const phaseA = hashUnit(`${seedBase}:phaseA`) * Math.PI * 2;
  const phaseB = hashUnit(`${seedBase}:phaseB`) * Math.PI * 2;
  const clumpA = 0.58 + 0.26 * Math.sin(angleRad * 5.2 + phaseA);
  const clumpB = 0.18 + 0.18 * Math.sin(angleRad * 11.4 + phaseB);
  return clamp(clumpA + clumpB, 0.22, 0.98);
}
const TIP_LABEL = {
  Labels: "Show or hide text labels for star, planets, moons, gas giants, and debris disks.",
  "Label leader lines": "Show or hide connector lines from labels to the body they describe.",
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
  "Lagrange points":
    "Show L1\u2013L5 equilibrium positions for each star\u2013body pair. L4 and L5 (leading and trailing Trojans, \u00b160\u00b0) are stable and shown for all bodies. Click a body to reveal all five points including L1/L2 (near the body) and L3 (opposite side of star).",
  "Frost line":
    "Show the H\u2082O frost line \u2014 the distance beyond which water ice can condense.",
  Distances: "Show orbital distance (AU) alongside body name labels.",
  "AU grid": "Draw faint concentric reference rings at round AU intervals for scale.",
  Rotation:
    "Show or hide spin markers on planets and moons (animated from each body's rotation period and axial tilt).",
  "Axial tilt helpers":
    "Show or hide projected spin-axis helper overlays on planets and moons (based on axial tilt).",
  "Click zoom bodies": "Enable click-to-focus zoom for planets and gas giants.",
  "Click zoom star": "Enable click-to-focus zoom when clicking the system's star.",
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
              <label class="viz-check"><input id="chk-label-leaders" type="checkbox" checked /><span>Leader lines ${tipIcon(TIP_LABEL["Label leader lines"] || "")}</span></label>
              <label class="viz-check"><input id="chk-moons" type="checkbox" checked /><span>Moons ${tipIcon(TIP_LABEL["Moons"] || "")}</span></label>
              <label class="viz-check"><input id="chk-orbits" type="checkbox" checked /><span>Orbits ${tipIcon(TIP_LABEL["Orbits"] || "")}</span></label>
              <label class="viz-check"><input id="chk-hz" type="checkbox" checked /><span>Habitable zone ${tipIcon(TIP_LABEL["Habitable zone"] || "")}</span></label>
              <label class="viz-check"><input id="chk-debris" type="checkbox" checked /><span>Debris disks ${tipIcon(TIP_LABEL["Debris disks"] || "")}</span></label>
              <label class="viz-check"><input id="chk-eccentric" type="checkbox" /><span>Eccentric orbits ${tipIcon(TIP_LABEL["Eccentric orbits"] || "")}</span></label>
              <label class="viz-check"><input id="chk-pe-ap" type="checkbox" /><span>Pe / Ap markers ${tipIcon(TIP_LABEL["Pe / Ap markers"] || "")}</span></label>
              <label class="viz-check"><input id="chk-hill" type="checkbox" /><span>Hill spheres ${tipIcon(TIP_LABEL["Hill spheres"] || "")}</span></label>
              <label class="viz-check"><input id="chk-lagrange" type="checkbox" /><span>Lagrange points ${tipIcon(TIP_LABEL["Lagrange points"] || "")}</span></label>
              <label class="viz-check"><input id="chk-frost" type="checkbox" checked /><span>Frost line ${tipIcon(TIP_LABEL["Frost line"] || "")}</span></label>
              <label class="viz-check"><input id="chk-distances" type="checkbox" checked /><span>Distances ${tipIcon(TIP_LABEL["Distances"] || "")}</span></label>
              <label class="viz-check"><input id="chk-grid" type="checkbox" /><span>AU grid ${tipIcon(TIP_LABEL["AU grid"] || "")}</span></label>
              <label class="viz-check"><input id="chk-rotation" type="checkbox" checked /><span>Rotation ${tipIcon(TIP_LABEL["Rotation"] || "")}</span></label>
              <label class="viz-check"><input id="chk-axial-tilt" type="checkbox" checked /><span>Axial tilt helpers ${tipIcon(TIP_LABEL["Axial tilt helpers"] || "")}</span></label>
              <label class="viz-check"><input id="chk-click-focus-bodies" type="checkbox" checked /><span>Click zoom bodies ${tipIcon(TIP_LABEL["Click zoom bodies"] || "")}</span></label>
              <label class="viz-check"><input id="chk-click-focus-star" type="checkbox" checked /><span>Click zoom star ${tipIcon(TIP_LABEL["Click zoom star"] || "")}</span></label>
              <label class="viz-check"><input id="chk-debug" type="checkbox" /><span>Debug ${tipIcon(TIP_LABEL["Debug"] || "")}</span></label>
            </div>

            <div class="viz-controls-dropdown__row">
              <div class="hint">Left-drag to pan, right-drag to rotate, mouse wheel to zoom, click bodies or the star to focus-follow (if enabled), and drag labels to reposition them.</div>
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

          <div id="viz-native-transition" class="viz-native-transition" aria-hidden="true" style="display:none">
            <div id="viz-native-transition-label" class="viz-native-transition__label"></div>
            <div class="viz-native-transition__track">
              <div id="viz-native-transition-fill" class="viz-native-transition__fill"></div>
            </div>
          </div>

          <div id="viz-offscale-note" class="viz-offscale-note" style="display:none" aria-hidden="true" aria-live="polite"></div>

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
  let nativeThree = null;
  const nativeTextures = new Map();
  const nativeTextTextures = new Map();
  const nativeProceduralTextures = new Map();
  const canvasStarSurfaceTextures = new Map();
  const chkLabels = root.querySelector("#chk-labels");
  const chkLabelLeaders = root.querySelector("#chk-label-leaders");
  const chkMoons = root.querySelector("#chk-moons");
  const chkOrbits = root.querySelector("#chk-orbits");
  const vizDistLog = root.querySelector("#vizDistLog");
  const vizSizePhysical = root.querySelector("#vizSizePhysical");
  const chkHz = root.querySelector("#chk-hz");
  const chkDebris = root.querySelector("#chk-debris");
  const chkEccentric = root.querySelector("#chk-eccentric");
  const chkPeAp = root.querySelector("#chk-pe-ap");
  const chkHill = root.querySelector("#chk-hill");
  const chkLagrange = root.querySelector("#chk-lagrange");
  const chkFrost = root.querySelector("#chk-frost");
  const chkDistances = root.querySelector("#chk-distances");
  const chkGrid = root.querySelector("#chk-grid");
  const chkRotation = root.querySelector("#chk-rotation");
  const chkAxialTilt = root.querySelector("#chk-axial-tilt");
  const chkClickFocusBodies = root.querySelector("#chk-click-focus-bodies");
  const chkClickFocusStar = root.querySelector("#chk-click-focus-star");
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
  const nativeTransitionEl = root.querySelector("#viz-native-transition");
  const nativeTransitionLabelEl = root.querySelector("#viz-native-transition-label");
  const nativeTransitionFillEl = root.querySelector("#viz-native-transition-fill");
  const offscaleNoteEl = root.querySelector("#viz-offscale-note");

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
  const STAR_CME_RENDER_SCALE = 0.099;
  const MAX_FLARES_PER_TICK = 48;
  const MAX_CMES_PER_TICK = 48;
  const MAX_SURFACE_FLARES_PER_TICK = 96;
  const MAX_STAR_BURSTS = 48;
  const STAR_BURST_INITIAL_AGE_SEC = 0.08;
  const SURFACE_FLARE_EMIN_ERG = 1e30;
  const SURFACE_FLARE_EMAX_ERG = FLARE_E0_ERG * 0.999;
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
  const OFFSCALE_ZONE_RATIO = 20;
  const OFFSCALE_ZONE_MIN_AU = 200;
  const OFFSCALE_ZONE_RANGE_RATIO = 1.3;

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
      surfaceParams: null,
      seeded: false,
      rng: Math.random,
      loopToggle: true,
      nextFlareTimeSec: Infinity,
      nextFlareEnergyErg: null,
      nextSurfaceFlareTimeSec: Infinity,
      nextSurfaceFlareEnergyErg: null,
      nextAssociatedCmeTimeSec: Infinity,
      nextBackgroundCmeTimeSec: Infinity,
      cyclePhase: 0,
      cyclePeriodSec: 11 * 365.25 * 86400,
      cmeTimes24hSec: [],
    },
    snapshotCache: null,
    focusTargetKind: null,
    focusTargetId: null,
    focusZoomTarget: null,
    canvasDpr: 1,
    bodyHitRegions: [],
    labelHitRegions: [],
    labelAutoPins: new Map(),
    labelOverrides: new Map(),
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
    disposeNativeThree();
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
    canvasStarSurfaceTextures.clear();
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
      hideOffscaleZoneNotice();
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

  function hideNativeTransitionOverlay() {
    if (!nativeTransitionEl) return;
    nativeTransitionEl.style.display = "none";
    nativeTransitionEl.setAttribute("aria-hidden", "true");
    if (nativeTransitionFillEl) nativeTransitionFillEl.style.width = "0%";
  }

  function showNativeTransitionOverlay(progress, label) {
    if (!nativeTransitionEl) return;
    const t = clamp(Number(progress) || 0, 0, 1);
    if (t <= 0) {
      hideNativeTransitionOverlay();
      return;
    }
    nativeTransitionEl.style.display = "";
    nativeTransitionEl.setAttribute("aria-hidden", "false");
    if (nativeTransitionLabelEl) nativeTransitionLabelEl.textContent = String(label || "");
    if (nativeTransitionFillEl) nativeTransitionFillEl.style.width = `${(t * 100).toFixed(1)}%`;
  }

  function formatAuLabel(au) {
    const num = Number(au);
    if (!Number.isFinite(num)) return "n/a";
    return num.toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }

  function formatAuRangeLabel(innerAu, outerAu) {
    const inner = Number(innerAu);
    const outer = Number(outerAu);
    if (!Number.isFinite(inner) || !Number.isFinite(outer)) return "n/a";
    return `${formatAuLabel(inner)}-${formatAuLabel(outer)}`;
  }

  function buildOffscaleZoneInfo(snapshot, coreMaxAu) {
    const info = {
      hideHz: false,
      hideFrost: false,
      lines: [],
    };
    if (isLogScale()) return info;
    if (!(Number.isFinite(coreMaxAu) && coreMaxAu > 0)) return info;
    const thresholdAu = Math.max(OFFSCALE_ZONE_MIN_AU, coreMaxAu * OFFSCALE_ZONE_RATIO);

    const hzInnerRaw = Number(snapshot?.sys?.habitableZoneAu?.inner);
    const hzOuterRaw = Number(snapshot?.sys?.habitableZoneAu?.outer);
    if (
      chkHz?.checked &&
      Number.isFinite(hzInnerRaw) &&
      Number.isFinite(hzOuterRaw) &&
      hzOuterRaw > 0
    ) {
      const hzi = Math.max(0.000001, Math.min(hzInnerRaw, hzOuterRaw));
      const hzo = Math.max(hzi, Math.max(hzInnerRaw, hzOuterRaw));
      if (hzi > thresholdAu || hzo > thresholdAu * OFFSCALE_ZONE_RANGE_RATIO) {
        info.hideHz = true;
        info.lines.push(`Habitable zone: ${formatAuRangeLabel(hzi, hzo)} AU`);
      }
    }

    const frostAu = Number(snapshot?.sys?.frostLineAu);
    if (chkFrost?.checked && Number.isFinite(frostAu) && frostAu > thresholdAu) {
      info.hideFrost = true;
      info.lines.push(`H2O frost line: ${formatAuLabel(frostAu)} AU`);
    }

    return info;
  }

  function hideOffscaleZoneNotice() {
    if (!offscaleNoteEl) return;
    offscaleNoteEl.style.display = "none";
    offscaleNoteEl.setAttribute("aria-hidden", "true");
    offscaleNoteEl.textContent = "";
  }

  function getOffscaleNoticeTopPx() {
    const controlsOpen = vizDropdown?.style.display !== "none";
    const controlsHeight = controlsOpen ? vizDropdown?.getBoundingClientRect?.().height || 0 : 0;
    return Math.round(12 + controlsHeight);
  }

  function updateOffscaleZoneNotice(info) {
    if (!offscaleNoteEl) return;
    const lines = Array.isArray(info?.lines) ? info.lines.filter(Boolean) : [];
    if (state.mode !== "system" || !lines.length) {
      hideOffscaleZoneNotice();
      return;
    }
    const topPx = getOffscaleNoticeTopPx();
    offscaleNoteEl.style.top = `${topPx}px`;
    offscaleNoteEl.textContent = [
      "Extreme-distance zones not rendered",
      ...lines,
      "Arrow indicates off-canvas direction.",
    ].join("\n");
    offscaleNoteEl.style.display = "";
    offscaleNoteEl.setAttribute("aria-hidden", "false");
  }

  function resizeCanvas(force = false) {
    if (!vizWrap) return;
    /* Clear inline size so CSS width:100%/height:100% governs display —
       prevents the canvas from blocking layout shrink after fullscreen. */
    canvas.style.width = "";
    canvas.style.height = "";
    const rect = vizWrap.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    state.canvasDpr = dpr;
    const newW = Math.max(1, Math.ceil(rect.width * dpr));
    const newH = Math.max(1, Math.ceil(rect.height * dpr));
    if (!force && newW === canvas.width && newH === canvas.height) return;
    canvas.width = newW;
    canvas.height = newH;
  }

  function disposeNativeThree() {
    if (!nativeThree) return;
    try {
      nativeThree.systemGroup?.traverse?.((obj) => {
        try {
          obj.geometry?.dispose?.();
        } catch {}
        try {
          obj.material?.dispose?.();
        } catch {}
      });
      nativeThree.clusterGroup?.traverse?.((obj) => {
        try {
          obj.geometry?.dispose?.();
        } catch {}
        try {
          obj.material?.dispose?.();
        } catch {}
      });
      nativeThree.renderer?.dispose?.();
    } catch {}
    nativeThree = null;
    nativeTextures.clear();
    nativeTextTextures.clear();
    nativeProceduralTextures.clear();
    hideNativeTransitionOverlay();
  }

  function clearThreeGroup(group) {
    if (!group) return;
    while (group.children.length) {
      const child = group.children.pop();
      try {
        group.remove(child);
      } catch {}
      try {
        child.geometry?.dispose?.();
      } catch {}
      try {
        child.material?.dispose?.();
      } catch {}
    }
  }

  function toThreeXY(metrics, sx, sy) {
    const x = sx - metrics.W / 2;
    const y = metrics.H / 2 - sy;
    return { x, y };
  }

  function getNativeTexture(relPath) {
    if (!nativeThree) return null;
    const key = String(relPath || "");
    if (!key) return null;
    const cached = nativeTextures.get(key);
    if (cached) return cached;
    const tex = nativeThree.loader.load(key);
    tex.minFilter = nativeThree.THREE.LinearFilter;
    tex.magFilter = nativeThree.THREE.LinearFilter;
    tex.generateMipmaps = false;
    if (nativeThree.THREE.SRGBColorSpace) tex.colorSpace = nativeThree.THREE.SRGBColorSpace;
    nativeTextures.set(key, tex);
    return tex;
  }

  function getNativeProceduralTexture(cacheKey, drawFn, size = 256) {
    if (!nativeThree || typeof drawFn !== "function") return null;
    const key = `${cacheKey}:${size}`;
    const cached = nativeProceduralTextures.get(key);
    if (cached) return cached;

    const c = document.createElement("canvas");
    c.width = size;
    c.height = size;
    const cctx = c.getContext("2d");
    if (!cctx) return null;
    drawFn(cctx, size);

    const tex = new nativeThree.THREE.CanvasTexture(c);
    tex.minFilter = nativeThree.THREE.LinearFilter;
    tex.magFilter = nativeThree.THREE.LinearFilter;
    tex.generateMipmaps = false;
    if (nativeThree.THREE.SRGBColorSpace) tex.colorSpace = nativeThree.THREE.SRGBColorSpace;
    tex.needsUpdate = true;
    nativeProceduralTextures.set(key, tex);
    return tex;
  }

  function parseHexColorNumber(hex, fallback = 0xfff4dc) {
    const raw = String(hex || "")
      .trim()
      .replace("#", "");
    if (!/^[0-9a-fA-F]{6}$/.test(raw)) return fallback;
    return Number.parseInt(raw, 16);
  }

  function threeCircle(radius, color, opacity = 1, segments = 128) {
    const THREE = nativeThree.THREE;
    const pts = [];
    for (let i = 0; i <= segments; i++) {
      const a = (i / segments) * Math.PI * 2;
      pts.push(new THREE.Vector3(Math.cos(a) * radius, Math.sin(a) * radius, 0));
    }
    const g = new THREE.BufferGeometry().setFromPoints(pts);
    const m = new THREE.LineBasicMaterial({
      color,
      transparent: opacity < 1,
      opacity,
      depthWrite: false,
    });
    return new THREE.LineLoop(g, m);
  }

  function threeSprite(texturePath, sizePx, sx, sy, z = 0, tint = 0xffffff, opacity = 1) {
    if (!nativeThree) return null;
    const THREE = nativeThree.THREE;
    const tex = texturePath ? getNativeTexture(texturePath) : null;
    const mat = new THREE.SpriteMaterial({
      map: tex || null,
      color: tint,
      transparent: true,
      opacity,
      depthWrite: false,
    });
    const spr = new THREE.Sprite(mat);
    spr.position.set(sx, sy, z);
    spr.scale.set(sizePx, sizePx, 1);
    return spr;
  }

  function threeLine(x1, y1, x2, y2, color, opacity = 1, z = 0) {
    const THREE = nativeThree.THREE;
    const g = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(x1, y1, z),
      new THREE.Vector3(x2, y2, z),
    ]);
    const m = new THREE.LineBasicMaterial({
      color,
      transparent: opacity < 1,
      opacity,
      depthWrite: false,
    });
    return new THREE.Line(g, m);
  }

  function getNativeTextTexture(text, opts = {}) {
    if (!nativeThree) return null;
    const label = String(text ?? "");
    if (!label) return null;
    const font = String(opts.font || "11px system-ui, sans-serif");
    const color = String(opts.color || "rgba(230,235,248,0.9)");
    const key = `${font}|${color}|${label}`;
    const cached = nativeTextTextures.get(key);
    if (cached) return cached;
    const c = document.createElement("canvas");
    const cctx = c.getContext("2d");
    if (!cctx) return null;
    cctx.font = font;
    const fontMatch = /([0-9]+(?:\.[0-9]+)?)px/.exec(font);
    const fontPx = fontMatch ? Number(fontMatch[1]) : 12;
    const tw = Math.max(1, Math.ceil(cctx.measureText(label).width + 8));
    const th = Math.max(1, Math.ceil(fontPx + 8));
    c.width = tw;
    c.height = th;
    cctx.font = font;
    cctx.textAlign = "center";
    cctx.textBaseline = "middle";
    cctx.fillStyle = color;
    cctx.shadowColor = "rgba(0,0,0,0.5)";
    cctx.shadowBlur = 3;
    cctx.fillText(label, tw / 2, th / 2 + 0.5);
    const tex = new nativeThree.THREE.CanvasTexture(c);
    tex.minFilter = nativeThree.THREE.LinearFilter;
    tex.magFilter = nativeThree.THREE.LinearFilter;
    tex.generateMipmaps = false;
    if (nativeThree.THREE.SRGBColorSpace) tex.colorSpace = nativeThree.THREE.SRGBColorSpace;
    nativeTextTextures.set(key, tex);
    return tex;
  }

  function threeText(text, sx, sy, z = 10, opts = {}) {
    if (!nativeThree) return null;
    const tex = getNativeTextTexture(text, opts);
    if (!tex) return null;
    const img = tex.image;
    const THREE = nativeThree.THREE;
    const mat = new THREE.SpriteMaterial({
      map: tex,
      color: 0xffffff,
      transparent: true,
      opacity: Number.isFinite(opts.opacity) ? opts.opacity : 1,
      depthWrite: false,
    });
    const spr = new THREE.Sprite(mat);
    spr.position.set(sx, sy, z);
    spr.scale.set(Math.max(1, Number(img?.width) || 16), Math.max(1, Number(img?.height) || 10), 1);
    return spr;
  }

  function nativePlanetRadiusPx(node, metrics) {
    if (!node) return 4;
    if (isPhysicalScale()) {
      return physicalRadiusToPx(node.radiusKm, metrics.starR, metrics.starRadiusKm, 1, 40);
    }
    return applyRepresentativeBodyRadiusConstraints(
      representativePlanetBaseRadiusPx(node, metrics?.bodyZoom || 1),
      metrics,
    );
  }

  function nativeGasRadiusPx(node, metrics) {
    if (!node) return 6;
    if (isPhysicalScale()) {
      return physicalRadiusToPx(node.radiusKm, metrics.starR, metrics.starRadiusKm, 1, 48);
    }
    return applyRepresentativeBodyRadiusConstraints(
      representativeGasBaseRadiusPx(node, metrics?.bodyZoom || 1),
      metrics,
    );
  }

  function drawNativeSystemMode(snapshotArg) {
    if (!nativeThree) return false;
    nativeThree.systemGroup.visible = true;
    nativeThree.clusterGroup.visible = false;
    const snapshot =
      snapshotArg &&
      typeof snapshotArg === "object" &&
      snapshotArg.sys &&
      Array.isArray(snapshotArg.planetNodes)
        ? snapshotArg
        : getSnapshot();
    const { sys, planetNodes, debrisDisks, gasGiants } = snapshot;
    const debugOn = flareDebugEnabled();
    const metrics = getFrameMetrics(snapshot);
    const { W, H, baseCx, baseCy, minAu, maxAu, maxR } = metrics;
    const offscaleZones = metrics.offscaleZones || { hideHz: false, hideFrost: false, lines: [] };
    if (maxR < 1 || W < 1 || H < 1) return false;
    const usePhysicalSize = isPhysicalScale();
    const showMoonLabels = !!chkLabels?.checked && state.zoom >= MOON_LABEL_MIN_ZOOM;
    updateOffscaleZoneNotice(offscaleZones);

    const dpr = state.canvasDpr || window.devicePixelRatio || 1;
    nativeThree.renderer.setSize(
      Math.max(1, Math.round(W * dpr)),
      Math.max(1, Math.round(H * dpr)),
      false,
    );
    nativeThree.renderer.setPixelRatio(1);
    nativeThree.cameraSystem.left = -W / 2;
    nativeThree.cameraSystem.right = W / 2;
    nativeThree.cameraSystem.top = H / 2;
    nativeThree.cameraSystem.bottom = -H / 2;
    nativeThree.cameraSystem.updateProjectionMatrix();

    clearThreeGroup(nativeThree.systemGroup);
    state.bodyHitRegions = [];
    state.labelHitRegions = [];

    const cx = baseCx + state.panX;
    const cy = baseCy + state.panY;
    const center = toThreeXY(metrics, cx, cy);
    const starR = metrics.starR;
    const THREE = nativeThree.THREE;
    const placedLabelRects = [];
    const screenToThree = (sx, sy, z = 0) => {
      const tp = toThreeXY(metrics, sx, sy);
      return new THREE.Vector3(tp.x, tp.y, z);
    };
    const addScreenLine = (x1, y1, x2, y2, color, opacity = 1, z = 8) => {
      const g = new THREE.BufferGeometry().setFromPoints([
        screenToThree(x1, y1, z),
        screenToThree(x2, y2, z),
      ]);
      const m = new THREE.LineBasicMaterial({
        color,
        transparent: opacity < 1,
        opacity,
        depthWrite: false,
      });
      nativeThree.systemGroup.add(new THREE.Line(g, m));
    };
    const addPositionIndicatorNative = (sx, sy, color = 0x9ec4ff, z = 3.8) => {
      const arm = 4;
      addScreenLine(sx - arm, sy, sx + arm, sy, color, 0.82, z);
      addScreenLine(sx, sy - arm, sx, sy + arm, color, 0.82, z);
      const cGeom = new THREE.CircleGeometry(1.2, 16);
      const cMat = new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: 0.88,
        depthWrite: false,
      });
      const c = new THREE.Mesh(cGeom, cMat);
      const tp = toThreeXY(metrics, sx, sy);
      c.position.set(tp.x, tp.y, z + 0.01);
      nativeThree.systemGroup.add(c);
    };
    const addAxialTiltOverlayNative = (sx, sy, r, bodyId, axialTiltDeg, z = 4.6) => {
      if (!(Number.isFinite(r) && r >= 3.5)) return;
      const axis = computeAxisDirection(bodyId, axialTiltDeg);
      if (!axis) return;
      const axisHalf = r * 0.95;
      const poleOffset = r * 0.72;
      const poleR = Math.max(0.75, r * 0.09);
      const tint = axis.retrograde ? 0xffaa82 : 0xa0dcff;
      addScreenLine(
        sx - axis.dx * axisHalf,
        sy - axis.dy * axisHalf,
        sx + axis.dx * axisHalf,
        sy + axis.dy * axisHalf,
        tint,
        0.55,
        z,
      );
      const frontGeom = new THREE.CircleGeometry(poleR, 16);
      const frontMat = new THREE.MeshBasicMaterial({
        color: tint,
        transparent: true,
        opacity: 0.8,
        depthWrite: false,
      });
      const front = new THREE.Mesh(frontGeom, frontMat);
      const frontPos = toThreeXY(metrics, sx + axis.dx * poleOffset, sy + axis.dy * poleOffset);
      front.position.set(frontPos.x, frontPos.y, z + 0.02);
      nativeThree.systemGroup.add(front);
      const backGeom = new THREE.CircleGeometry(poleR * 0.85, 16);
      const backMat = new THREE.MeshBasicMaterial({
        color: tint,
        transparent: true,
        opacity: 0.5,
        depthWrite: false,
      });
      const back = new THREE.Mesh(backGeom, backMat);
      const backPos = toThreeXY(metrics, sx - axis.dx * poleOffset, sy - axis.dy * poleOffset);
      back.position.set(backPos.x, backPos.y, z + 0.01);
      nativeThree.systemGroup.add(back);
    };
    const addRotationOverlayNative = (sx, sy, r, bodyId, axialTiltDeg, spinAngleRad, z = 4.7) => {
      if (!(Number.isFinite(r) && r >= 4.5)) return;
      const axis = computeAxisDirection(bodyId, axialTiltDeg);
      if (!axis) return;
      const a = normalizeVec3({ x: axis.vx, y: axis.vy, z: axis.vz });
      if (!a) return;
      const refUp = Math.abs(a.y) < 0.92 ? { x: 0, y: 1, z: 0 } : { x: 1, y: 0, z: 0 };
      const u = normalizeVec3(crossVec3(a, refUp));
      if (!u) return;
      const v = normalizeVec3(crossVec3(a, u));
      if (!v) return;
      const tint = axis.retrograde ? 0xffaa82 : 0xa0dcff;
      const markerCount = 3;
      for (let i = 0; i < markerCount; i += 1) {
        const t = spinAngleRad + (i / markerCount) * Math.PI * 2;
        const px3 = {
          x: u.x * Math.cos(t) + v.x * Math.sin(t),
          y: u.y * Math.cos(t) + v.y * Math.sin(t),
          z: u.z * Math.cos(t) + v.z * Math.sin(t),
        };
        const proj = projectDirectionToScreen(px3.x, px3.z, px3.y);
        const alpha = clamp(0.2 + 0.32 * (proj.depth + 1) * 0.5, 0.14, 0.58);
        const mr = Math.max(0.75, r * (0.07 + 0.01 * i));
        const marker = new THREE.Mesh(
          new THREE.CircleGeometry(mr, 16),
          new THREE.MeshBasicMaterial({
            color: tint,
            transparent: true,
            opacity: alpha,
            depthWrite: false,
          }),
        );
        const mpos = toThreeXY(metrics, sx + proj.x * r * 0.82, sy - proj.y * r * 0.82);
        marker.position.set(mpos.x, mpos.y, z + 0.01 * i);
        nativeThree.systemGroup.add(marker);
      }
    };
    const addDraggableLabelNative = ({
      key = null,
      line1 = "",
      line2 = "",
      anchorX = null,
      anchorY = null,
      defaultX = 0,
      defaultY = 0,
      z = 9,
      leaderRadius = 0,
      font1 = "12px system-ui, sans-serif",
      color1 = "rgba(255,255,255,0.82)",
      font2 = "11px system-ui, sans-serif",
      color2 = "rgba(255,255,255,0.58)",
    } = {}) => {
      if (!chkLabels?.checked) return null;
      const text1 = String(line1 || "").trim();
      const text2 = String(line2 || "").trim();
      if (!text1) return null;

      const tex1 = getNativeTextTexture(text1, { font: font1, color: color1 });
      if (!tex1?.image) return null;
      const w1 = Math.max(8, Number(tex1.image.width) || 8);
      const h1 = Math.max(8, Number(tex1.image.height) || 8);
      let w2 = 0;
      let h2 = 0;
      if (text2) {
        const tex2 = getNativeTextTexture(text2, { font: font2, color: color2 });
        w2 = Math.max(8, Number(tex2?.image?.width) || 8);
        h2 = Math.max(8, Number(tex2?.image?.height) || 8);
      }
      const showDist = !!text2;
      const boxW = (showDist ? Math.max(w1, w2) : w1) + 14;
      const boxH = showDist ? 34 : 22;
      const userOffset = key ? state.labelOverrides.get(key) : null;
      const autoPin = key ? state.labelAutoPins.get(key) : null;
      let rect;
      let movedByUser = false;
      if (userOffset && Number.isFinite(userOffset.x) && Number.isFinite(userOffset.y)) {
        rect = { x: userOffset.x, y: userOffset.y, w: boxW, h: boxH };
        placedLabelRects.push(rect);
        movedByUser = true;
      } else if (userOffset && Number.isFinite(userOffset.dx) && Number.isFinite(userOffset.dy)) {
        // Backward compatibility with older in-memory relative offsets.
        rect = { x: defaultX + userOffset.dx, y: defaultY + userOffset.dy, w: boxW, h: boxH };
        placedLabelRects.push(rect);
        movedByUser = true;
      } else if (
        state.isPlaying &&
        autoPin &&
        Number.isFinite(autoPin.x) &&
        Number.isFinite(autoPin.y)
      ) {
        rect = { x: autoPin.x, y: autoPin.y, w: boxW, h: boxH };
        placedLabelRects.push(rect);
      } else {
        rect = placeLabel(null, placedLabelRects, defaultX, defaultY, boxW, boxH);
      }

      if (key) {
        if (!movedByUser) {
          if (state.isPlaying) state.labelAutoPins.set(key, { x: rect.x, y: rect.y });
          else state.labelAutoPins.delete(key);
        }
        state.labelHitRegions.push({
          kind: "label",
          key,
          x: rect.x,
          y: rect.y,
          w: rect.w,
          h: rect.h,
          bodyX: Number.isFinite(anchorX) ? anchorX : null,
          bodyY: Number.isFinite(anchorY) ? anchorY : null,
        });
      }

      if (chkLabelLeaders?.checked && Number.isFinite(anchorX) && Number.isFinite(anchorY)) {
        const pinX = clamp(anchorX, rect.x, rect.x + rect.w);
        const pinY = clamp(anchorY, rect.y, rect.y + rect.h);
        const vx = pinX - anchorX;
        const vy = pinY - anchorY;
        const vlen = Math.hypot(vx, vy) || 1;
        const ux = vx / vlen;
        const uy = vy / vlen;
        const lineStartX = anchorX + ux * Math.max(2, Number(leaderRadius) * 0.75);
        const lineStartY = anchorY + uy * Math.max(2, Number(leaderRadius) * 0.75);
        const lineEndX = pinX - ux * 1.5;
        const lineEndY = pinY - uy * 1.5;
        if (Math.hypot(lineEndX - lineStartX, lineEndY - lineStartY) > 3) {
          addScreenLine(lineStartX, lineStartY, lineEndX, lineEndY, 0xb9c5df, 0.42, z - 0.04);
        }
      }

      const lbl1 = threeText(
        text1,
        toThreeXY(metrics, rect.x + 8 + w1 * 0.5, rect.y + (showDist ? 6 : 4) + h1 * 0.5).x,
        toThreeXY(metrics, rect.x + 8 + w1 * 0.5, rect.y + (showDist ? 6 : 4) + h1 * 0.5).y,
        z,
        { font: font1, color: color1 },
      );
      if (lbl1) nativeThree.systemGroup.add(lbl1);

      if (showDist) {
        const lbl2 = threeText(
          text2,
          toThreeXY(metrics, rect.x + 8 + w2 * 0.5, rect.y + 18 + h2 * 0.5).x,
          toThreeXY(metrics, rect.x + 8 + w2 * 0.5, rect.y + 18 + h2 * 0.5).y,
          z,
          { font: font2, color: color2 },
        );
        if (lbl2) nativeThree.systemGroup.add(lbl2);
      }

      if (movedByUser && key) {
        const resetW = 12;
        const resetH = 12;
        const resetX = rect.x + rect.w + 2;
        const resetY = rect.y - 8;
        const resetLabel = threeText(
          "x",
          toThreeXY(metrics, resetX + resetW * 0.5, resetY + resetH * 0.5).x,
          toThreeXY(metrics, resetX + resetW * 0.5, resetY + resetH * 0.5).y,
          z + 0.03,
          {
            font: "bold 12px system-ui, sans-serif",
            color: "rgba(255,170,170,0.95)",
          },
        );
        if (resetLabel) nativeThree.systemGroup.add(resetLabel);
        state.labelHitRegions.push({
          kind: "label-reset",
          key,
          x: resetX,
          y: resetY,
          w: resetW,
          h: resetH,
        });
      }
      return rect;
    };

    const addBodyLabelNative = (name, distText, sx, sy, bodyR, z = 9.0, labelKey = null) =>
      addDraggableLabelNative({
        key: labelKey,
        line1: String(name || "Body"),
        line2: chkDistances?.checked && distText ? String(distText) : "",
        anchorX: sx,
        anchorY: sy,
        defaultX: sx + bodyR + 10 - 6,
        defaultY: sy - bodyR - 22 - 10,
        z,
        leaderRadius: Math.max(2, bodyR),
      });
    const projectedOrbitLine = (
      radiusPx,
      color,
      opacity = 1,
      segments = 220,
      inclinationDeg = 0,
      z = -6,
      centerScreenX = cx,
      centerScreenY = cy,
    ) => {
      const pts = [];
      const incRad = (Number(inclinationDeg) * Math.PI) / 180;
      const cosI = Math.cos(incRad);
      const sinI = Math.sin(incRad);
      for (let i = 0; i <= segments; i += 1) {
        const a = (i / segments) * Math.PI * 2;
        const ox = Math.cos(a) * radiusPx;
        const oy = Math.sin(a) * radiusPx;
        const proj = orbitOffsetToScreen(ox, oy * cosI, centerScreenX, centerScreenY, oy * sinI);
        const tp = toThreeXY(metrics, proj.x, proj.y);
        pts.push(new THREE.Vector3(tp.x, tp.y, z));
      }
      const g = new THREE.BufferGeometry().setFromPoints(pts);
      const m = new THREE.LineBasicMaterial({
        color,
        transparent: opacity < 1,
        opacity,
        depthWrite: false,
      });
      return new THREE.Line(g, m);
    };
    const projectedDashedOrbitLine = (
      radiusPx,
      color,
      opacity = 1,
      segments = 240,
      inclinationDeg = 0,
      z = -6,
      dashSteps = 6,
      gapSteps = 6,
      centerScreenX = cx,
      centerScreenY = cy,
    ) => {
      const pts = [];
      const incRad = (Number(inclinationDeg) * Math.PI) / 180;
      const cosI = Math.cos(incRad);
      const sinI = Math.sin(incRad);
      const cycle = Math.max(1, dashSteps + gapSteps);
      for (let i = 0; i < segments; i += 1) {
        if (i % cycle >= dashSteps) continue;
        const a0 = (i / segments) * Math.PI * 2;
        const a1 = ((i + 1) / segments) * Math.PI * 2;
        const p0 = orbitOffsetToScreen(
          Math.cos(a0) * radiusPx,
          Math.sin(a0) * radiusPx * cosI,
          centerScreenX,
          centerScreenY,
          Math.sin(a0) * radiusPx * sinI,
        );
        const p1 = orbitOffsetToScreen(
          Math.cos(a1) * radiusPx,
          Math.sin(a1) * radiusPx * cosI,
          centerScreenX,
          centerScreenY,
          Math.sin(a1) * radiusPx * sinI,
        );
        const t0 = toThreeXY(metrics, p0.x, p0.y);
        const t1 = toThreeXY(metrics, p1.x, p1.y);
        pts.push(new THREE.Vector3(t0.x, t0.y, z), new THREE.Vector3(t1.x, t1.y, z));
      }
      if (!pts.length) return null;
      const g = new THREE.BufferGeometry().setFromPoints(pts);
      const m = new THREE.LineBasicMaterial({
        color,
        transparent: opacity < 1,
        opacity,
        depthWrite: false,
      });
      return new THREE.LineSegments(g, m);
    };
    const projectedEllipseOrbitLine = (
      semiMajorPx,
      eccentricity,
      argPeriapsisDeg,
      inclinationDeg = 0,
      color = 0x5f6c8a,
      opacity = 0.34,
      segments = 220,
      z = -6,
      centerScreenX = cx,
      centerScreenY = cy,
    ) => {
      const e = clamp(eccentricity, 0, 0.99);
      const a = semiMajorPx;
      const b = a * Math.sqrt(1 - e * e);
      const cFocus = a * e;
      const omega = ((argPeriapsisDeg || 0) * Math.PI) / 180;
      const cosW = Math.cos(omega);
      const sinW = Math.sin(omega);
      const incRad = (Number(inclinationDeg) * Math.PI) / 180;
      const cosI = Math.cos(incRad);
      const sinI = Math.sin(incRad);
      const pts = [];
      for (let i = 0; i <= segments; i += 1) {
        const E = (i / segments) * Math.PI * 2;
        const xf = a * Math.cos(E) - cFocus;
        const zf = b * Math.sin(E);
        const xr = xf * cosW - zf * sinW;
        const zr = xf * sinW + zf * cosW;
        const pt = orbitOffsetToScreen(xr, zr * cosI, centerScreenX, centerScreenY, zr * sinI);
        const tp = toThreeXY(metrics, pt.x, pt.y);
        pts.push(new THREE.Vector3(tp.x, tp.y, z));
      }
      const g = new THREE.BufferGeometry().setFromPoints(pts);
      const m = new THREE.LineBasicMaterial({
        color,
        transparent: opacity < 1,
        opacity,
        depthWrite: false,
      });
      return new THREE.Line(g, m);
    };
    const addApsisMarkersNative = (
      semiMajorPx,
      eccentricity,
      argPeriapsisDeg,
      inclinationDeg,
      showLabels,
      centerScreenX = cx,
      centerScreenY = cy,
    ) => {
      const e = clamp(eccentricity, 0, 0.99);
      if (e < 0.01) return;
      const pePt = orbitPointToScreen(
        centerScreenX,
        centerScreenY,
        semiMajorPx,
        e,
        argPeriapsisDeg,
        inclinationDeg,
        0,
      );
      const apPt = orbitPointToScreen(
        centerScreenX,
        centerScreenY,
        semiMajorPx,
        e,
        argPeriapsisDeg,
        inclinationDeg,
        Math.PI,
      );
      const markers = [
        { pt: pePt, label: "Pe", color: 0xffb43c },
        { pt: apPt, label: "Ap", color: 0x64b4ff },
      ];
      for (const mk of markers) {
        const stemH = 18;
        const triW = 7;
        const triH = 5;
        const topY = mk.pt.y - stemH;
        addScreenLine(mk.pt.x, mk.pt.y, mk.pt.x, topY + triH, mk.color, 0.6, 9);
        const tri = new THREE.BufferGeometry().setFromPoints([
          screenToThree(mk.pt.x, topY + triH, 9.2),
          screenToThree(mk.pt.x - triW / 2, topY, 9.2),
          screenToThree(mk.pt.x + triW / 2, topY, 9.2),
          screenToThree(mk.pt.x, topY + triH, 9.2),
        ]);
        const triMat = new THREE.LineBasicMaterial({
          color: mk.color,
          transparent: true,
          opacity: 0.9,
          depthWrite: false,
        });
        nativeThree.systemGroup.add(new THREE.Line(tri, triMat));
        if (showLabels) {
          const lbl = threeText(
            mk.label,
            screenToThree(mk.pt.x, topY - 5).x,
            screenToThree(mk.pt.x, topY - 5).y,
            10,
            {
              font: "bold 10px system-ui, sans-serif",
              color: mk.color === 0xffb43c ? "rgba(255,180,60,0.95)" : "rgba(100,180,255,0.95)",
            },
          );
          if (lbl) nativeThree.systemGroup.add(lbl);
        }
      }
    };
    const addHillSphereMarkerNative = (sx, sy, hillPx, showLabels, showDistances, hillAu) => {
      const r = Math.max(6, hillPx);
      const ring = threeCircle(r, 0xb48cff, 0.35, 120);
      const p = toThreeXY(metrics, sx, sy);
      ring.position.set(p.x, p.y, 8);
      nativeThree.systemGroup.add(ring);
      if (showLabels) {
        const hLbl = threeText("Hill", p.x, p.y - r - 18, 10, {
          font: "bold 10px system-ui, sans-serif",
          color: "rgba(180,140,255,0.9)",
        });
        if (hLbl) nativeThree.systemGroup.add(hLbl);
        if (showDistances && Number.isFinite(hillAu)) {
          const dLbl = threeText(`${hillAu.toFixed(3)} AU`, p.x, p.y - r - 30, 10, {
            font: "9px system-ui, sans-serif",
            color: "rgba(180,140,255,0.72)",
          });
          if (dLbl) nativeThree.systemGroup.add(dLbl);
        }
      }
    };
    const addLagrangeMarkerNative = (screenX, screenY, label, mode) => {
      const p = toThreeXY(metrics, screenX, screenY);
      if (mode === "trojan") {
        const s = 4;
        const geom = new THREE.BufferGeometry().setFromPoints([
          new THREE.Vector3(p.x, p.y - s, 9.5),
          new THREE.Vector3(p.x + s, p.y, 9.5),
          new THREE.Vector3(p.x, p.y + s, 9.5),
          new THREE.Vector3(p.x - s, p.y, 9.5),
          new THREE.Vector3(p.x, p.y - s, 9.5),
        ]);
        const mat = new THREE.LineBasicMaterial({
          color: 0x50c8c8,
          transparent: true,
          opacity: 0.72,
          depthWrite: false,
        });
        nativeThree.systemGroup.add(new THREE.Line(geom, mat));
        return;
      }
      const s = 6;
      addScreenLine(screenX - s, screenY, screenX + s, screenY, 0x50c8c8, 0.75, 9.5);
      addScreenLine(screenX, screenY - s, screenX, screenY + s, 0x50c8c8, 0.75, 9.5);
      const dotGeom = new THREE.CircleGeometry(1.8, 20);
      const dotMat = new THREE.MeshBasicMaterial({
        color: 0x50c8c8,
        transparent: true,
        opacity: 0.9,
        depthWrite: false,
      });
      const dot = new THREE.Mesh(dotGeom, dotMat);
      dot.position.set(p.x, p.y, 9.6);
      nativeThree.systemGroup.add(dot);
      if (chkLabels?.checked) {
        const lbl = threeText(label, p.x + 10, p.y - 6, 10, {
          font: "bold 10px system-ui, sans-serif",
          color: "rgba(80,200,200,0.92)",
        });
        if (lbl) nativeThree.systemGroup.add(lbl);
      }
    };
    const projectedOrbitBand = (
      innerPx,
      outerPx,
      color,
      opacity = 0.12,
      segments = 220,
      inclinationDeg = 0,
      z = -8,
    ) => {
      const THREE = nativeThree.THREE;
      const incRad = (Number(inclinationDeg) * Math.PI) / 180;
      const cosI = Math.cos(incRad);
      const sinI = Math.sin(incRad);
      const vCount = (segments + 1) * 2;
      const positions = new Float32Array(vCount * 3);
      const indices = [];
      for (let i = 0; i <= segments; i += 1) {
        const a = (i / segments) * Math.PI * 2;
        const c = Math.cos(a);
        const s = Math.sin(a);

        const outerProj = orbitOffsetToScreen(
          c * outerPx,
          s * outerPx * cosI,
          cx,
          cy,
          s * outerPx * sinI,
        );
        const innerProj = orbitOffsetToScreen(
          c * innerPx,
          s * innerPx * cosI,
          cx,
          cy,
          s * innerPx * sinI,
        );
        const outerTp = toThreeXY(metrics, outerProj.x, outerProj.y);
        const innerTp = toThreeXY(metrics, innerProj.x, innerProj.y);

        const base = i * 2;
        positions[(base + 0) * 3 + 0] = outerTp.x;
        positions[(base + 0) * 3 + 1] = outerTp.y;
        positions[(base + 0) * 3 + 2] = z;
        positions[(base + 1) * 3 + 0] = innerTp.x;
        positions[(base + 1) * 3 + 1] = innerTp.y;
        positions[(base + 1) * 3 + 2] = z;

        if (i < segments) {
          const next = base + 2;
          indices.push(base, base + 1, next);
          indices.push(base + 1, next + 1, next);
        }
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute("position", new THREE.BufferAttribute(positions, 3));
      g.setIndex(indices);
      const m = new THREE.MeshBasicMaterial({
        color,
        transparent: opacity < 1,
        opacity,
        side: THREE.DoubleSide,
        depthWrite: false,
      });
      return new THREE.Mesh(g, m);
    };

    if (chkGrid?.checked) {
      const niceSteps = [0.1, 0.2, 0.5, 1, 2, 5, 10, 20, 50, 100, 200, 500, 1000];
      const range = maxAu - Math.max(minAu, 0);
      const targetRings = 8;
      const rawStep = range / Math.max(1, targetRings);
      let step = niceSteps[niceSteps.length - 1];
      for (const s of niceSteps) {
        if (s >= rawStep) {
          step = s;
          break;
        }
      }
      const startAu = Math.ceil(Math.max(minAu, 0) / step) * step;
      for (let au = startAu; au <= maxAu; au += step) {
        if (au <= 0) continue;
        const r = mapAuToPx(au, minAu, maxAu, maxR);
        if (r < 2 || r > maxR * 1.05) continue;
        nativeThree.systemGroup.add(projectedOrbitLine(r, 0xffffff, 0.08, 220, 0, -24));
        const labelAngle = -Math.PI * 0.28;
        const lp = orbitOffsetToScreen(Math.cos(labelAngle) * r, Math.sin(labelAngle) * r, cx, cy);
        const text = step >= 1 ? `${au} AU` : `${au.toFixed(1)} AU`;
        const lbl = threeText(
          text,
          toThreeXY(metrics, lp.x + 4, lp.y).x,
          toThreeXY(metrics, lp.x + 4, lp.y).y,
          -23.8,
          {
            font: "10px system-ui, sans-serif",
            color: "rgba(255,255,255,0.25)",
          },
        );
        if (lbl) nativeThree.systemGroup.add(lbl);
      }
    }

    if (chkHz?.checked && sys?.habitableZoneAu && !offscaleZones.hideHz) {
      const hzi = Math.max(
        0.000001,
        Math.min(Number(sys.habitableZoneAu.inner), Number(sys.habitableZoneAu.outer)),
      );
      const hzo = Math.max(
        hzi,
        Math.max(Number(sys.habitableZoneAu.inner), Number(sys.habitableZoneAu.outer)),
      );
      const r1 = mapAuToPx(hzi, minAu, maxAu, maxR);
      const r2 = mapAuToPx(hzo, minAu, maxAu, maxR);
      const mesh = projectedOrbitBand(
        Math.max(1, Math.min(r1, r2)),
        Math.max(Math.min(r1, r2) + 1, Math.max(r1, r2)),
        0x4ac575,
        0.1,
        220,
        0,
        -20,
      );
      nativeThree.systemGroup.add(mesh);
      const hzInnerRing = projectedOrbitLine(
        Math.max(1, Math.min(r1, r2)),
        0x64e682,
        0.42,
        220,
        0,
        -19.8,
      );
      const hzOuterRing = projectedOrbitLine(
        Math.max(Math.min(r1, r2) + 1, Math.max(r1, r2)),
        0x64e682,
        0.42,
        220,
        0,
        -19.8,
      );
      if (hzInnerRing) nativeThree.systemGroup.add(hzInnerRing);
      if (hzOuterRing) nativeThree.systemGroup.add(hzOuterRing);
      if (chkLabels?.checked) {
        const rMid =
          (Math.max(1, Math.min(r1, r2)) + Math.max(Math.min(r1, r2) + 1, Math.max(r1, r2))) * 0.5;
        const p = orbitOffsetToScreen(
          Math.cos(0.12 * Math.PI * 2) * rMid,
          Math.sin(0.12 * Math.PI * 2) * rMid,
          cx,
          cy,
        );
        addDraggableLabelNative({
          key: "zone:hz",
          line1: "Habitable zone",
          line2: chkDistances?.checked
            ? `${Number(sys.habitableZoneAu.inner).toFixed(2)}-${Number(sys.habitableZoneAu.outer).toFixed(2)} AU`
            : "",
          anchorX: p.x,
          anchorY: p.y,
          defaultX: p.x + 8 - 6,
          defaultY: p.y - 2 - 10,
          z: -19.5,
          leaderRadius: 0,
          color1: "rgba(170,255,190,0.86)",
          color2: "rgba(170,255,190,0.65)",
        });
      }
    }

    if (
      chkFrost?.checked &&
      Number.isFinite(sys?.frostLineAu) &&
      sys.frostLineAu > 0 &&
      !offscaleZones.hideFrost
    ) {
      const rf = mapAuToPx(sys.frostLineAu, minAu, maxAu, maxR);
      const dashed = projectedDashedOrbitLine(rf, 0x8caac8, 0.36, 240, 0, -10, 6, 6);
      if (dashed) nativeThree.systemGroup.add(dashed);
      if (chkLabels?.checked) {
        const p = orbitOffsetToScreen(
          Math.cos(0.62 * Math.PI * 2) * rf,
          Math.sin(0.62 * Math.PI * 2) * rf,
          cx,
          cy,
        );
        addDraggableLabelNative({
          key: "zone:frost",
          line1: "H2O Frost Line",
          line2: chkDistances?.checked ? `${Number(sys.frostLineAu).toFixed(2)} AU` : "",
          anchorX: p.x,
          anchorY: p.y,
          defaultX: p.x + 10 - 6,
          defaultY: p.y - 2 - 10,
          z: -9.5,
          leaderRadius: 0,
          color1: "rgba(255,255,255,0.78)",
          color2: "rgba(255,255,255,0.55)",
        });
      }
    }

    if (chkDebris?.checked && Array.isArray(debrisDisks)) {
      for (let di = 0; di < debrisDisks.length; di += 1) {
        const d = debrisDisks[di];
        const inner = mapAuToPx(d.inner, minAu, maxAu, maxR);
        const outer = mapAuToPx(d.outer, minAu, maxAu, maxR);
        if (!(outer > inner && outer > 0)) continue;
        const THREE = nativeThree.THREE;
        const bandTint = di === 0 ? 0xc8c8dc : 0xb4d7be;
        const mesh = projectedOrbitBand(Math.max(1, inner), outer, bandTint, 0.045, 220, 0, -8);
        nativeThree.systemGroup.add(mesh);
        nativeThree.systemGroup.add(
          projectedOrbitLine(Math.max(1, inner), bandTint, 0.16, 220, 0, -7.9),
        );
        nativeThree.systemGroup.add(
          projectedOrbitLine(Math.max(1, outer), bandTint, 0.11, 220, 0, -7.9),
        );

        // Dense, clumped asteroid structure so belts read clearly in wide views.
        const particleCount = computeDebrisParticleTarget(inner, outer, d.inner, d.outer);
        const bucketPositions = [[], [], []];
        const bucketColors = [[], [], []];
        const diskSeed = `native:debris:${di}`;
        const maxAttempts = particleCount * 3;
        let placed = 0;
        for (let i = 0; i < maxAttempts && placed < particleCount; i += 1) {
          const seed = `${diskSeed}:${i}`;
          const ang = hashUnit(`${seed}:a`) * Math.PI * 2;
          if (hashUnit(`${seed}:keep`) > debrisKeepChance(ang, diskSeed)) continue;
          const rPx = sampleDebrisRadiusPx(inner, outer, seed);
          const tangentJitter =
            (hashUnit(`${seed}:tj`) - 0.5) * Math.max(3.8, (outer - inner) * 0.2);
          const ox = Math.cos(ang) * rPx + -Math.sin(ang) * tangentJitter;
          const oy = Math.sin(ang) * rPx + Math.cos(ang) * tangentJitter;
          const p = orbitOffsetToScreen(ox, oy, cx, cy);
          const tp = toThreeXY(metrics, p.x, p.y);
          const sizeRoll = hashUnit(`${seed}:s`);
          const sizeBucket = sizeRoll > 0.94 ? 3 : sizeRoll > 0.72 ? 2 : 1;
          const tone = 148 + Math.floor(hashUnit(`${seed}:tone`) * 72);
          const warmth = hashUnit(`${seed}:warm`);
          const rCol = clamp(tone + 8 + warmth * 12, 0, 255) / 255;
          const gCol = clamp(tone - 10 + warmth * 7, 0, 255) / 255;
          const bCol = clamp(tone - 30 - warmth * 5, 0, 255) / 255;
          const bi = clamp(sizeBucket - 1, 0, 2);
          bucketPositions[bi].push(tp.x, tp.y, -7.6 + bi * 0.01);
          bucketColors[bi].push(rCol, gCol, bCol);
          placed += 1;
        }
        const sizes = [1.0, 1.75, 2.6];
        const opacities = [0.26, 0.38, 0.52];
        for (let bi = 0; bi < 3; bi += 1) {
          if (!bucketPositions[bi].length) continue;
          const pg = new THREE.BufferGeometry();
          pg.setAttribute("position", new THREE.Float32BufferAttribute(bucketPositions[bi], 3));
          pg.setAttribute("color", new THREE.Float32BufferAttribute(bucketColors[bi], 3));
          const pm = new THREE.PointsMaterial({
            size: sizes[bi],
            sizeAttenuation: false,
            vertexColors: true,
            transparent: true,
            opacity: opacities[bi],
            depthWrite: false,
          });
          nativeThree.systemGroup.add(new THREE.Points(pg, pm));
        }

        if (chkLabels?.checked) {
          const midAu = (Number(d.inner) + Number(d.outer)) * 0.5;
          const rr = mapAuToPx(midAu, minAu, maxAu, maxR);
          const la = (-0.35 + di * 0.14) * Math.PI * 2;
          const labelPos = orbitOffsetToScreen(Math.cos(la) * rr, Math.sin(la) * rr, cx, cy);
          addDraggableLabelNative({
            key: `debris:${di}`,
            line1: d.name || "Debris disk",
            line2: chkDistances?.checked
              ? `${Number(d.inner).toFixed(2)}-${Number(d.outer).toFixed(2)} AU`
              : "",
            anchorX: labelPos.x,
            anchorY: labelPos.y,
            defaultX: labelPos.x + 8 - 6,
            defaultY: labelPos.y - 10,
            z: 9,
            leaderRadius: 0,
            color1: "rgba(255,255,255,0.70)",
            color2: "rgba(255,255,255,0.45)",
          });
        }
      }
    }

    if (chkOrbits?.checked) {
      const useEccentricRings = chkEccentric?.checked === true;
      for (const p of planetNodes || []) {
        if (!(p?.au > 0)) continue;
        const rPx = mapAuToPx(p.au, minAu, maxAu, maxR);
        const incDeg = useEccentricRings ? Number(p.inclinationDeg) || 0 : 0;
        const ecc = Number.isFinite(p.eccentricity) ? clamp(p.eccentricity, 0, 0.99) : 0;
        const ring =
          useEccentricRings && ecc > 0
            ? projectedEllipseOrbitLine(
                rPx,
                ecc,
                Number(p.longitudeOfPeriapsisDeg) || 0,
                incDeg,
                0x5f6c8a,
                0.34,
                220,
                -6,
              )
            : projectedOrbitLine(rPx, 0x5f6c8a, 0.34, 220, incDeg, -6);
        nativeThree.systemGroup.add(ring);
        if (chkPeAp?.checked && useEccentricRings && ecc > 0.01) {
          addApsisMarkersNative(
            rPx,
            ecc,
            Number(p.longitudeOfPeriapsisDeg) || 0,
            incDeg,
            chkLabels?.checked,
          );
        }
      }
      for (const g of gasGiants || []) {
        if (!(g?.au > 0)) continue;
        const rPx = mapAuToPx(g.au, minAu, maxAu, maxR);
        const ecc = Number.isFinite(g.eccentricity) ? clamp(g.eccentricity, 0, 0.99) : 0;
        const ring =
          useEccentricRings && ecc > 0
            ? projectedEllipseOrbitLine(
                rPx,
                ecc,
                Number(g.longitudeOfPeriapsisDeg) || 0,
                Number(g.inclinationDeg) || 0,
                0x6f7b98,
                0.32,
                220,
                -6,
              )
            : projectedOrbitLine(rPx, 0x6f7b98, 0.32, 220, 0, -6);
        nativeThree.systemGroup.add(ring);
        if (chkPeAp?.checked && useEccentricRings && ecc > 0.01) {
          addApsisMarkersNative(
            rPx,
            ecc,
            Number(g.longitudeOfPeriapsisDeg) || 0,
            Number(g.inclinationDeg) || 0,
            chkLabels?.checked,
          );
        }
      }
    }

    const starTint = parseHexColorNumber(snapshot.starColourHex, 0xfff4dc);
    const starCoreHex = mixHex(snapshot.starColourHex, "#ffffff", 0.34);
    const starCoreTint = parseHexColorNumber(starCoreHex, starTint);
    const starRimTint = parseHexColorNumber(
      mixHex(snapshot.starColourHex, "#ffd9ad", 0.46),
      starTint,
    );
    const flareRimTint = parseHexColorNumber(
      mixHex(snapshot.starColourHex, "#ffd7ab", 0.45),
      starTint,
    );
    const flareBeadTint = parseHexColorNumber(
      mixHex(snapshot.starColourHex, "#fff3dc", 0.55),
      starTint,
    );
    const flareLoopTint = parseHexColorNumber(
      mixHex(snapshot.starColourHex, "#ffaf7d", 0.7),
      starTint,
    );
    const flareLoopCoreTint = parseHexColorNumber(
      mixHex(snapshot.starColourHex, "#fff7e7", 0.62),
      flareBeadTint,
    );
    const cmeCloudTint = parseHexColorNumber(
      mixHex(snapshot.starColourHex, "#ffc18e", 0.68),
      flareLoopTint,
    );
    const starSurfaceSeed = getStarSurfaceSeed(snapshot);
    const starActivity = clamp(Number(snapshot.starActivityLevel), 0, 1);
    const glowPulse =
      0.55 + 0.45 * Math.sin(state.simTime * 0.08 + Number(snapshot.starMassMsol || 1) * 0.45);
    const starSurfaceRotation =
      state.simTime * 0.004 + hashUnit(`${starSurfaceSeed}:surface-rotation`) * Math.PI * 2;

    const starGlowTex = getNativeProceduralTexture(
      "star-glow:v2",
      (cctx, size) => {
        const c = size * 0.5;
        const g = cctx.createRadialGradient(c, c, size * 0.03, c, c, c);
        g.addColorStop(0.0, "rgba(255,255,255,0.95)");
        g.addColorStop(0.2, "rgba(255,255,255,0.55)");
        g.addColorStop(0.45, "rgba(255,255,255,0.2)");
        g.addColorStop(0.72, "rgba(255,255,255,0.06)");
        g.addColorStop(1.0, "rgba(255,255,255,0)");
        cctx.clearRect(0, 0, size, size);
        cctx.fillStyle = g;
        cctx.fillRect(0, 0, size, size);
      },
      384,
    );
    const starSurfaceTex = getNativeProceduralTexture(
      `star-surface:v3:${snapshot.starColourHex}:${starSurfaceSeed}:${Math.round(Number(snapshot.starTempK) || 5776)}:${Math.round(starActivity * 100)}`,
      (cctx, size) => {
        paintStarSurfaceTexture(cctx, size, {
          baseHex: snapshot.starColourHex,
          seed: starSurfaceSeed,
          tempK: snapshot.starTempK,
          activity: starActivity,
        });
      },
      512,
    );
    const flarePlumeTex = getNativeProceduralTexture(
      "flare-plume:v3",
      (cctx, size) => {
        cctx.clearRect(0, 0, size, size);
        const cxp = size * 0.5;
        const cyp = size * 0.5;
        cctx.save();
        cctx.translate(cxp, cyp);
        cctx.scale(1.85, 0.82);
        const g = cctx.createRadialGradient(0, 0, size * 0.04, 0, 0, size * 0.32);
        g.addColorStop(0.0, "rgba(255,255,255,0.96)");
        g.addColorStop(0.25, "rgba(255,220,170,0.75)");
        g.addColorStop(0.58, "rgba(255,160,112,0.34)");
        g.addColorStop(1.0, "rgba(255,140,96,0)");
        cctx.fillStyle = g;
        cctx.beginPath();
        cctx.arc(0, 0, size * 0.34, 0, Math.PI * 2);
        cctx.fill();
        cctx.restore();
      },
      256,
    );
    const flareKnotTex = getNativeProceduralTexture(
      "flare-knot:v2",
      (cctx, size) => {
        cctx.clearRect(0, 0, size, size);
        const cxp = size * 0.5;
        const cyp = size * 0.5;
        const g = cctx.createRadialGradient(cxp, cyp, size * 0.05, cxp, cyp, size * 0.48);
        g.addColorStop(0, "rgba(255,255,255,1)");
        g.addColorStop(0.32, "rgba(255,234,190,0.92)");
        g.addColorStop(0.72, "rgba(255,164,112,0.42)");
        g.addColorStop(1, "rgba(255,120,86,0)");
        cctx.fillStyle = g;
        cctx.beginPath();
        cctx.arc(cxp, cyp, size * 0.48, 0, Math.PI * 2);
        cctx.fill();
      },
      192,
    );
    const cmeCloudTex = getNativeProceduralTexture(
      "cme-cloud:v1",
      (cctx, size) => {
        cctx.clearRect(0, 0, size, size);
        const cxp = size * 0.5;
        const cyp = size * 0.5;
        cctx.save();
        cctx.translate(cxp, cyp);
        cctx.scale(1.45, 0.82);
        const g = cctx.createRadialGradient(0, 0, size * 0.05, 0, 0, size * 0.48);
        g.addColorStop(0.0, "rgba(255,255,255,0.95)");
        g.addColorStop(0.24, "rgba(255,230,186,0.72)");
        g.addColorStop(0.56, "rgba(255,166,112,0.3)");
        g.addColorStop(1.0, "rgba(255,140,98,0)");
        cctx.fillStyle = g;
        cctx.beginPath();
        cctx.arc(0, 0, size * 0.48, 0, Math.PI * 2);
        cctx.fill();
        cctx.restore();

        cctx.save();
        cctx.translate(cxp, cyp);
        cctx.rotate(Math.PI * 0.24);
        cctx.scale(1.15, 0.6);
        const g2 = cctx.createRadialGradient(0, 0, size * 0.04, 0, 0, size * 0.36);
        g2.addColorStop(0.0, "rgba(255,250,242,0.55)");
        g2.addColorStop(0.7, "rgba(255,182,128,0.2)");
        g2.addColorStop(1.0, "rgba(255,150,110,0)");
        cctx.fillStyle = g2;
        cctx.beginPath();
        cctx.arc(0, 0, size * 0.32, 0, Math.PI * 2);
        cctx.fill();
        cctx.restore();
      },
      256,
    );
    const addStarSprite = ({
      tex,
      radius,
      opacity,
      z,
      color = 0xffffff,
      blending = THREE.NormalBlending,
      rotation = 0,
    }) => {
      if (!tex) return;
      const mat = new THREE.SpriteMaterial({
        map: tex,
        color,
        transparent: true,
        opacity,
        depthWrite: false,
        depthTest: false,
        blending,
      });
      mat.rotation = rotation;
      const sprite = new THREE.Sprite(mat);
      const rr = Math.max(1, radius);
      sprite.position.set(center.x, center.y, z);
      sprite.scale.set(rr * 2, rr * 2, 1);
      nativeThree.systemGroup.add(sprite);
    };
    const addBurstLoopArcNative = (
      sx,
      sy,
      mx,
      my,
      ex,
      ey,
      haloOpacity,
      coreOpacity,
      zBase = -0.845,
      pointSize = 1.4,
    ) => {
      const segments = 26;
      const pts = [];
      const knotPts = [];
      for (let si = 0; si <= segments; si += 1) {
        const u = si / segments;
        const inv = 1 - u;
        const px = inv * inv * sx + 2 * inv * u * mx + u * u * ex;
        const py = inv * inv * sy + 2 * inv * u * my + u * u * ey;
        const tp = toThreeXY(metrics, px, py);
        pts.push(new THREE.Vector3(tp.x, tp.y, zBase));
        if (si > 0 && si < segments) knotPts.push(tp.x, tp.y, zBase + 0.0006);
      }
      const haloGeom = new THREE.BufferGeometry().setFromPoints(pts);
      const haloMat = new THREE.LineBasicMaterial({
        color: flareLoopTint,
        transparent: true,
        opacity: Math.min(0.9, haloOpacity * 1.45),
        depthWrite: false,
        depthTest: false,
        blending: THREE.AdditiveBlending,
      });
      nativeThree.systemGroup.add(new THREE.Line(haloGeom, haloMat));
      const coreGeom = new THREE.BufferGeometry().setFromPoints(pts);
      const coreMat = new THREE.LineBasicMaterial({
        color: flareLoopCoreTint,
        transparent: true,
        opacity: Math.min(1, coreOpacity * 1.55),
        depthWrite: false,
        depthTest: false,
        blending: THREE.AdditiveBlending,
      });
      nativeThree.systemGroup.add(new THREE.Line(coreGeom, coreMat));
      if (flareKnotTex && knotPts.length) {
        const knotGeom = new THREE.BufferGeometry();
        knotGeom.setAttribute("position", new THREE.Float32BufferAttribute(knotPts, 3));
        const knotMat = new THREE.PointsMaterial({
          map: flareKnotTex,
          color: flareLoopCoreTint,
          size: Math.max(0.9, pointSize),
          sizeAttenuation: false,
          transparent: true,
          opacity: Math.min(0.96, coreOpacity * 1.75),
          alphaTest: 0.02,
          depthWrite: false,
          depthTest: false,
          blending: THREE.AdditiveBlending,
        });
        nativeThree.systemGroup.add(new THREE.Points(knotGeom, knotMat));
      }
    };
    const addCmePlasmaTrailNative = ({
      sx,
      sy,
      mx,
      my,
      ex,
      ey,
      opacity = 0.2,
      plumeSize = 2,
      jitterPhase = 0,
      jitterAmp = 0.6,
      zBase = -0.844,
      color = cmeCloudTint,
      lineColor = flareLoopTint,
    }) => {
      const segments = 8;
      const linePts = [];
      for (let si = 0; si <= segments; si += 1) {
        const u = si / segments;
        const inv = 1 - u;
        const qx = inv * inv * sx + 2 * inv * u * mx + u * u * ex;
        const qy = inv * inv * sy + 2 * inv * u * my + u * u * ey;
        const wobbleA = jitterPhase + u * 7.1;
        const wobbleR = jitterAmp * (0.35 + 0.65 * (1 - u));
        const px = qx + Math.cos(wobbleA) * wobbleR;
        const py = qy + Math.sin(wobbleA * 1.12) * wobbleR;
        const tp = toThreeXY(metrics, px, py);
        linePts.push(new THREE.Vector3(tp.x, tp.y, zBase + si * 0.00012));

        const puff = new THREE.Sprite(
          new THREE.SpriteMaterial({
            map: cmeCloudTex || flarePlumeTex || null,
            color,
            transparent: true,
            opacity: Math.max(0.02, opacity * (0.92 - u * 0.56)),
            depthWrite: false,
            depthTest: false,
            blending: THREE.AdditiveBlending,
          }),
        );
        const puffSize = Math.max(0.75, plumeSize * (1.08 - u * 0.42));
        puff.position.set(tp.x, tp.y, zBase + 0.00045 + si * 0.0001);
        puff.scale.set(puffSize * (1.2 - u * 0.25), puffSize, 1);
        puff.material.rotation = -Math.atan2(ey - sy, ex - sx) + Math.PI * 0.5;
        nativeThree.systemGroup.add(puff);
      }
      if (linePts.length >= 2) {
        const spineGeom = new THREE.BufferGeometry().setFromPoints(linePts);
        const spineMat = new THREE.LineBasicMaterial({
          color: lineColor,
          transparent: true,
          opacity: Math.max(0.02, opacity * 0.16),
          depthWrite: false,
          depthTest: false,
          blending: THREE.AdditiveBlending,
        });
        nativeThree.systemGroup.add(new THREE.Line(spineGeom, spineMat));
      }
    };
    addStarSprite({
      tex: starGlowTex,
      radius: Math.max(10, starR * (3.45 + 0.22 * glowPulse)),
      opacity: 0.19,
      z: -1.35,
      color: starTint,
      blending: THREE.AdditiveBlending,
    });
    addStarSprite({
      tex: starGlowTex,
      radius: Math.max(7, starR * (2.25 + 0.14 * glowPulse)),
      opacity: 0.28,
      z: -1.18,
      color: starTint,
      blending: THREE.AdditiveBlending,
    });
    addStarSprite({
      tex: starSurfaceTex,
      radius: Math.max(2, starR * 1.03),
      opacity: 0.99,
      z: -0.98,
      color: 0xffffff,
      blending: THREE.NormalBlending,
      rotation: starSurfaceRotation,
    });
    addStarSprite({
      tex: starGlowTex,
      radius: Math.max(2.5, starR * 1.1),
      opacity: 0.35,
      z: -0.94,
      color: starRimTint,
      blending: THREE.AdditiveBlending,
    });
    addStarSprite({
      tex: starGlowTex,
      radius: Math.max(1.2, starR * 0.55),
      opacity: 0.42,
      z: -0.91,
      color: starCoreTint,
      blending: THREE.AdditiveBlending,
    });
    registerHit("star", "home", cx, cy, Math.max(14, starR * 1.08));
    const canRenderBursts = state.isPlaying || state.exportingGif;
    const activeBurstCount = Array.isArray(state.starBursts) ? state.starBursts.length : 0;
    let nativeVisibleBurstCount = 0;
    let nativeVisibleCmeCount = 0;
    let nativeVisibleLoopBurstCount = 0;
    let nativeVisibleSurfaceBurstCount = 0;
    if (canRenderBursts && activeBurstCount) {
      for (const burst of state.starBursts) {
        const ttl = Number.isFinite(burst?.ttl) && burst.ttl > 0 ? burst.ttl : 1;
        const t = clamp((Number(burst?.age) || 0) / ttl, 0, 1);
        const fade = Math.sin(Math.PI * t) * Math.max(0.02, Number(burst?.intensity) || 0.1);
        if (!(fade > 0.001)) continue;
        nativeVisibleBurstCount += 1;
        if (burst?.hasLoops !== false) nativeVisibleLoopBurstCount += 1;
        if (burst?.type === "cme") nativeVisibleCmeCount += 1;
        if (burst?.type === "surface") nativeVisibleSurfaceBurstCount += 1;
        const burstAngle = Number(burst?.angle) || 0;
        const burstReach = Number.isFinite(burst?.reach) ? burst.reach : 0.7;
        const burstSpread = Number.isFinite(burst?.spread) ? burst.spread : 0.08;
        const energyNorm = clamp(
          Number(burst?.energyNorm) || flareEnergyNorm(burst?.energyErg),
          0,
          1,
        );
        const activityNorm = clamp(Number(burst?.activityNorm) || 0, 0, 1);
        const hasLoops = burst?.hasLoops !== false;
        const loopRise = clamp(Number(burst?.loopRise) || 0.7, 0.45, 1.35);
        const loopCount = clamp(
          Number.isFinite(Number(burst?.loops))
            ? Number(burst.loops)
            : burst?.type === "cme"
              ? 3
              : 2,
          1,
          burst?.type === "cme" ? 8 : 6,
        );
        const isCme = burst?.type === "cme";
        const isSurface = burst?.type === "surface";
        const rInner = starR * 1.03;
        const rSpan = starR * burstReach * STAR_BURST_SIZE_SCALE;
        const radialStartNorm = clamp(
          Number(burst?.radialStartNorm) || (isCme ? 0.32 : 0.1),
          0.04,
          3,
        );
        const radialEndNormRaw = Number(burst?.radialEndNorm);
        const radialEndNorm = Math.max(
          radialStartNorm + 0.05,
          Number.isFinite(radialEndNormRaw) ? radialEndNormRaw : isCme ? 1.5 : 0.75,
        );
        const radialNorm = radialStartNorm + (radialEndNorm - radialStartNorm) * t;
        const spreadBase = burstSpread * STAR_BURST_SIZE_SCALE;
        const spread = spreadBase * (isCme ? 1.22 - 0.28 * t : 1 - 0.25 * t);
        const dirX = Math.cos(burstAngle);
        const dirY = Math.sin(burstAngle);
        const plumeStretch = clamp(Number(burst?.plumeStretch) || 1, 0.6, 2.8);

        if (isSurface) {
          const surfaceRadiusNorm = clamp(Number(burst?.surfaceRadiusNorm) || 0.5, 0.02, 0.92);
          const surfaceSpotScale = clamp(Number(burst?.surfaceSpotScale) || 1, 0.5, 1.8);
          const px = cx + dirX * (starR * surfaceRadiusNorm);
          const py = cy + dirY * (starR * surfaceRadiusNorm);
          const spotPos = toThreeXY(metrics, px, py);
          const tangentialRotation = -burstAngle + Math.PI * 0.5;
          const spotSize = Math.max(0.85, starR * (0.018 + 0.02 * energyNorm) * surfaceSpotScale);
          const halo = new THREE.Sprite(
            new THREE.SpriteMaterial({
              map: flareKnotTex || flarePlumeTex || null,
              color: flareLoopTint,
              transparent: true,
              opacity: Math.min(0.62, fade * (0.75 + energyNorm * 0.5)),
              depthWrite: false,
              depthTest: false,
              blending: THREE.AdditiveBlending,
            }),
          );
          halo.position.set(spotPos.x, spotPos.y, -0.83);
          halo.scale.set(spotSize * 2.1, spotSize * 1.3, 1);
          halo.material.rotation = tangentialRotation;
          nativeThree.systemGroup.add(halo);

          const core = new THREE.Sprite(
            new THREE.SpriteMaterial({
              map: flareKnotTex || null,
              color: flareLoopCoreTint,
              transparent: true,
              opacity: Math.min(0.95, fade * 1.35),
              depthWrite: false,
              depthTest: false,
              blending: THREE.AdditiveBlending,
            }),
          );
          core.position.set(spotPos.x, spotPos.y, -0.8295);
          core.scale.set(spotSize * 0.9, spotSize * 0.9, 1);
          nativeThree.systemGroup.add(core);
          continue;
        }

        if (isCme) {
          const cmeScale = STAR_CME_RENDER_SCALE;
          const cmeSpread = spread * (1.15 + 0.24 * energyNorm) * cmeScale;
          const rOuter = rInner + rSpan * radialNorm * cmeScale * (1.05 + 0.2 * energyNorm);
          const midR = rInner + (rOuter - rInner) * (0.58 + 0.08 * Math.sin(t * Math.PI));
          const plumePos = toThreeXY(metrics, cx + dirX * midR, cy + dirY * midR);

          const plume = new THREE.Sprite(
            new THREE.SpriteMaterial({
              map: flarePlumeTex || cmeCloudTex || null,
              color: flareLoopTint,
              transparent: true,
              opacity: Math.min(0.5, fade * (0.95 + 0.22 * energyNorm)),
              depthWrite: false,
              depthTest: false,
              blending: THREE.AdditiveBlending,
            }),
          );
          plume.position.set(plumePos.x, plumePos.y, -0.845);
          plume.material.rotation = -burstAngle;
          plume.scale.set(
            Math.max(3.4, (rOuter - rInner) * (1.4 + cmeSpread * 5.6) * plumeStretch),
            Math.max(2.4, (rOuter - rInner) * (0.7 + 0.25 * energyNorm)),
            1,
          );
          nativeThree.systemGroup.add(plume);

          const plumeCore = new THREE.Sprite(
            new THREE.SpriteMaterial({
              map: flareKnotTex || flarePlumeTex || null,
              color: flareLoopCoreTint,
              transparent: true,
              opacity: Math.min(0.82, fade * 1.35),
              depthWrite: false,
              depthTest: false,
              blending: THREE.AdditiveBlending,
            }),
          );
          plumeCore.position.set(plumePos.x, plumePos.y, -0.8446);
          plumeCore.material.rotation = -burstAngle;
          plumeCore.scale.set(
            Math.max(1.9, (rOuter - rInner) * (0.62 + 0.18 * energyNorm)),
            Math.max(1.6, (rOuter - rInner) * (0.36 + 0.12 * energyNorm)),
            1,
          );
          nativeThree.systemGroup.add(plumeCore);

          const cmeLoopCount = clamp(loopCount + 2, 3, 10);
          for (let li = 0; li < cmeLoopCount; li += 1) {
            const u = (li + 1) / (cmeLoopCount + 1);
            const loopCenterA =
              burstAngle +
              (u - 0.5) * cmeSpread * 1.7 +
              (Number(burst?.curl) || 0) * (0.55 - 0.2 * u) * (1 - t);
            const footDelta = Math.max(
              cmeSpread * (0.32 + (1 - u) * 0.95),
              0.05 + energyNorm * 0.05,
            );
            const leftA = loopCenterA - footDelta;
            const rightA = loopCenterA + footDelta;
            const leftR = rInner * (1 + li * 0.006);
            const rightR = rInner * (1 + li * 0.006);
            const extraLift = starR * (0.06 + energyNorm * 0.08) * (1 - u * 0.55);
            const apexR =
              rInner +
              (rOuter - rInner) * clamp((0.62 + loopRise * 0.4) * (0.74 + 0.26 * u), 0.45, 1.3) +
              extraLift;
            const apexA = loopCenterA + (Number(burst?.curl) || 0) * (0.45 + u * 0.45) * (1 - t);
            const sx = cx + Math.cos(leftA) * leftR;
            const sy = cy + Math.sin(leftA) * leftR;
            const ex = cx + Math.cos(rightA) * rightR;
            const ey = cy + Math.sin(rightA) * rightR;
            const mx = cx + Math.cos(apexA) * apexR;
            const my = cy + Math.sin(apexA) * apexR;
            addBurstLoopArcNative(
              sx,
              sy,
              mx,
              my,
              ex,
              ey,
              fade * (0.34 + 0.24 * (1 - u)) * (0.92 + activityNorm * 0.42),
              fade * (0.52 + 0.3 * (1 - u)),
              -0.852 + li * 0.00045,
              Math.max(1.15, starR * (0.015 + (1 - u) * 0.007 + energyNorm * 0.004)),
            );
          }

          const streamerCount = clamp(Math.round(2 + energyNorm * 3.2 + activityNorm * 1.6), 2, 7);
          for (let si = 0; si < streamerCount; si += 1) {
            const u = (si + 0.5) / streamerCount;
            const footA = burstAngle + (u - 0.5) * cmeSpread * 0.95;
            const headA = burstAngle + (u - 0.5) * cmeSpread * 1.35;
            const footR = rInner * (1 + u * 0.02);
            const headR = rInner + (rOuter - rInner) * (0.42 + 0.5 * u);
            const ctrlR =
              footR + (headR - footR) * (0.44 + 0.28 * u) + starR * (0.06 + 0.05 * energyNorm);
            const ctrlA =
              (footA + headA) * 0.5 + (Number(burst?.curl) || 0) * (0.52 + 0.22 * u) * (1 - t);
            const sx = cx + Math.cos(footA) * footR;
            const sy = cy + Math.sin(footA) * footR;
            const ex = cx + Math.cos(headA) * headR;
            const ey = cy + Math.sin(headA) * headR;
            const mx = cx + Math.cos(ctrlA) * ctrlR;
            const my = cy + Math.sin(ctrlA) * ctrlR;
            addCmePlasmaTrailNative({
              sx,
              sy,
              mx,
              my,
              ex,
              ey,
              opacity: fade * (0.16 + 0.14 * (1 - u)),
              plumeSize: Math.max(0.9 * cmeScale, starR * (0.028 + (1 - u) * 0.016) * cmeScale),
              jitterPhase: (Number(burst?.plumeNoise) || 0) + si * 0.77 + t * 3.4,
              jitterAmp: starR * 0.018 * (1 - u * 0.5),
              zBase: -0.846 + si * 0.0002,
              color: flareLoopTint,
              lineColor: flareLoopCoreTint,
            });
          }

          const footPos = toThreeXY(
            metrics,
            cx +
              Math.cos(burstAngle + (Number(burst?.curl) || 0) * 0.16 * (1 - t)) * (rInner + 1.5),
            cy +
              Math.sin(burstAngle + (Number(burst?.curl) || 0) * 0.16 * (1 - t)) * (rInner + 1.5),
          );
          const footGlow = new THREE.Sprite(
            new THREE.SpriteMaterial({
              map: flareKnotTex || null,
              color: flareLoopCoreTint,
              transparent: true,
              opacity: Math.min(0.78, fade * 1.6),
              depthWrite: false,
              depthTest: false,
              blending: THREE.AdditiveBlending,
            }),
          );
          const footSize = Math.max(1.4, starR * (0.044 + energyNorm * 0.016));
          footGlow.position.set(footPos.x, footPos.y, -0.842);
          footGlow.scale.set(footSize, footSize, 1);
          nativeThree.systemGroup.add(footGlow);

          const rimPos = toThreeXY(metrics, cx + dirX * rOuter, cy + dirY * rOuter);
          const rim = new THREE.Mesh(
            new THREE.CircleGeometry(Math.max(0.55, starR * 0.029), 20),
            new THREE.MeshBasicMaterial({
              color: flareRimTint,
              transparent: true,
              opacity: Math.min(0.56, fade * (0.56 + energyNorm * 0.16)),
              depthWrite: false,
              depthTest: false,
              blending: THREE.AdditiveBlending,
            }),
          );
          rim.position.set(rimPos.x, rimPos.y, -0.841);
          nativeThree.systemGroup.add(rim);
          continue;
        }

        const rOuter = rInner + rSpan * radialNorm;
        const midR = rInner + (rOuter - rInner) * 0.52;
        const flarePos = toThreeXY(metrics, cx + dirX * midR, cy + dirY * midR);
        const flareMat = new THREE.SpriteMaterial({
          map: flarePlumeTex || null,
          color: flareLoopTint,
          transparent: true,
          opacity: Math.min(0.44, fade * 0.9 + 0.03),
          depthWrite: false,
          depthTest: false,
          blending: THREE.AdditiveBlending,
        });
        flareMat.rotation = -burstAngle;
        const flare = new THREE.Sprite(flareMat);
        flare.position.set(flarePos.x, flarePos.y, -0.86);
        flare.scale.set(
          Math.max(2.6, (rOuter - rInner) * (0.95 + spread * 9.5) * plumeStretch),
          Math.max(2.1, (rOuter - rInner) * (0.45 + energyNorm * 0.18)),
          1,
        );
        nativeThree.systemGroup.add(flare);

        if (hasLoops) {
          for (let li = 0; li < loopCount; li += 1) {
            const u = (li + 1) / (loopCount + 1);
            const loopCenterA =
              burstAngle +
              (u - 0.5) * spread * 1.55 +
              (Number(burst?.curl) || 0) * (0.58 - 0.2 * u) * (1 - t);
            const minLoopHalfAngle = (0.05 + energyNorm * 0.05) * (0.85 + 0.25 * (1 - u));
            const footDelta = Math.max(spread * (0.34 + (1 - u) * 0.9), minLoopHalfAngle);
            const leftA = loopCenterA - footDelta;
            const rightA = loopCenterA + footDelta;
            const leftR = rInner * (1 + li * 0.008);
            const rightR = rInner * (1 + li * 0.008);
            const extraLift = starR * (0.035 + energyNorm * 0.055) * (1 - u * 0.6);
            const apexR =
              rInner +
              (rOuter - rInner) * clamp((0.56 + loopRise * 0.36) * (0.7 + 0.3 * u), 0.42, 1.2) +
              extraLift;
            const apexA = loopCenterA + (Number(burst?.curl) || 0) * (0.42 + u * 0.52) * (1 - t);
            const sx = cx + Math.cos(leftA) * leftR;
            const sy = cy + Math.sin(leftA) * leftR;
            const ex = cx + Math.cos(rightA) * rightR;
            const ey = cy + Math.sin(rightA) * rightR;
            const mx = cx + Math.cos(apexA) * apexR;
            const my = cy + Math.sin(apexA) * apexR;
            addBurstLoopArcNative(
              sx,
              sy,
              mx,
              my,
              ex,
              ey,
              fade * (0.34 + 0.24 * (1 - u)) * (0.85 + activityNorm * 0.5),
              fade * (0.5 + 0.3 * (1 - u)),
              -0.852 + li * 0.0005,
              Math.max(1.05, starR * (0.013 + (1 - u) * 0.006 + energyNorm * 0.004)),
            );
          }
        }

        const footPos = toThreeXY(
          metrics,
          cx + Math.cos(burstAngle + (Number(burst?.curl) || 0) * 0.16 * (1 - t)) * (rInner + 1.3),
          cy + Math.sin(burstAngle + (Number(burst?.curl) || 0) * 0.16 * (1 - t)) * (rInner + 1.3),
        );
        const footGlow = new THREE.Sprite(
          new THREE.SpriteMaterial({
            map: flareKnotTex || null,
            color: flareLoopCoreTint,
            transparent: true,
            opacity: Math.min(0.72, fade * 1.5),
            depthWrite: false,
            depthTest: false,
            blending: THREE.AdditiveBlending,
          }),
        );
        const footSizeClamped = Math.max(1.3, starR * (0.038 + energyNorm * 0.014));
        footGlow.position.set(footPos.x, footPos.y, -0.84);
        footGlow.scale.set(footSizeClamped, footSizeClamped, 1);
        nativeThree.systemGroup.add(footGlow);

        const rimPos = toThreeXY(metrics, cx + dirX * rOuter, cy + dirY * rOuter);
        const rim = new THREE.Mesh(
          new THREE.CircleGeometry(Math.max(0.45, starR * 0.026), 18),
          new THREE.MeshBasicMaterial({
            color: flareRimTint,
            transparent: true,
            opacity: Math.min(0.5, fade * (0.48 + energyNorm * 0.14)),
            depthWrite: false,
            depthTest: false,
            blending: THREE.AdditiveBlending,
          }),
        );
        rim.position.set(rimPos.x, rimPos.y, -0.84);
        nativeThree.systemGroup.add(rim);

        // CME visuals are rendered in their own branch above.
      }
    }
    if (activeBurstCount > 0 || nativeVisibleBurstCount > 0) {
      dbgThrottled(debugOn, "flare:draw:native", 800, "flare:draw:native", {
        canRenderBursts,
        isPlaying: !!state.isPlaying,
        exportingGif: !!state.exportingGif,
        activeBursts: activeBurstCount,
        visibleBursts: nativeVisibleBurstCount,
        visibleLoopBursts: nativeVisibleLoopBurstCount,
        visibleCmes: nativeVisibleCmeCount,
        visibleSurfaceBursts: nativeVisibleSurfaceBurstCount,
        starR: Number(starR.toFixed(3)),
      });
    }
    if (chkLabels?.checked) {
      addDraggableLabelNative({
        key: "star:home",
        line1: snapshot.starName || "Star",
        anchorX: cx,
        anchorY: cy,
        defaultX: cx + Math.max(16, starR * 1.35) - 6,
        defaultY: cy - 14 - 10,
        z: 8,
        leaderRadius: starR,
        color1: hexToRgba(mixHex(snapshot.starColourHex, "#fff5d7", 0.5), 0.92),
      });
    }

    function registerHit(kind, id, x, y, r, data) {
      state.bodyHitRegions.push({
        kind,
        id,
        x,
        y,
        r,
        data,
      });
    }

    const nativePlanetRenderNodes = [];
    const nativeGasRenderNodes = [];

    for (const p of planetNodes || []) {
      const placement = computePlanetPlacement(p, metrics);
      if (!placement) continue;
      const pPos = orbitOffsetToScreen(placement.ox, placement.oy, cx, cy, placement.oyVert || 0);
      if (!Number.isFinite(pPos.x) || !Number.isFinite(pPos.y)) continue;
      const pr = nativePlanetRadiusPx(p, metrics);
      const pos = toThreeXY(metrics, pPos.x, pPos.y);
      const bodyZ = pPos.depth < 0 ? -1.6 : 2.2;
      if (usePhysicalSize && pr < PHYS_VIS_THRESHOLD_PX) {
        addPositionIndicatorNative(pPos.x, pPos.y, 0x9ec4ff, bodyZ + 0.8);
      } else {
        const pTex = rockyAssetPath(computeRockyVisualProfile(p.derived || {}, p.rawInputs || {}));
        const sprite = threeSprite(pTex, Math.max(2, pr * 2.2), pos.x, pos.y, bodyZ, 0xffffff, 1);
        if (sprite) nativeThree.systemGroup.add(sprite);
        const planetRotationHours = Number(p.rotationPeriodHours);
        const planetRotationDays =
          Number.isFinite(planetRotationHours) && planetRotationHours > 0
            ? planetRotationHours / 24
            : null;
        const planetAxialTiltDeg = normalizeAxialTiltDeg(p.axialTiltDeg);
        const planetSpinAngle =
          chkRotation?.checked === false
            ? 0
            : computeSpinAngleRad(p.id, planetRotationDays, planetAxialTiltDeg);
        if (chkRotation?.checked) {
          addRotationOverlayNative(
            pPos.x,
            pPos.y,
            Math.max(pr, 0.5),
            p.id,
            planetAxialTiltDeg,
            planetSpinAngle,
            bodyZ + 0.5,
          );
        }
        if (chkAxialTilt?.checked) {
          addAxialTiltOverlayNative(
            pPos.x,
            pPos.y,
            Math.max(pr, 0.5),
            p.id,
            planetAxialTiltDeg,
            bodyZ + 0.45,
          );
        }
      }
      addBodyLabelNative(
        p.name || "Planet",
        `${Number(p.au || 0).toFixed(2)} AU`,
        pPos.x,
        pPos.y,
        Math.max(pr, 2),
        9,
        `planet:${p.id}`,
      );
      registerHit("planet", p.id, pPos.x, pPos.y, Math.max(10, pr + 3), p);

      if (chkMoons?.checked && Array.isArray(p.moons)) {
        const n = p.moons.length;
        const moonAxes = p.moons
          .map((m) => Number(m.semiMajorAxisKm))
          .filter((v) => Number.isFinite(v) && v > 0);
        const minMoonAxis = moonAxes.length ? Math.min(...moonAxes) : null;
        const maxMoonAxis = moonAxes.length ? Math.max(...moonAxes) : null;
        const moonBand = Math.max(8 * (n - 1), 8);
        const useEccentricMoons = chkEccentric?.checked === true;
        const planetKm =
          Number.isFinite(p.radiusKm) && p.radiusKm > 0
            ? Number(p.radiusKm)
            : Number.isFinite(p.radiusEarth) && p.radiusEarth > 0
              ? p.radiusEarth * EARTH_RADIUS_KM
              : EARTH_RADIUS_KM;

        for (let i = 0; i < n; i += 1) {
          const moon = p.moons[i];
          const moonAxis = Number(moon.semiMajorAxisKm);
          let orbitR = pr + 10 + i * 8;
          if (
            Number.isFinite(moonAxis) &&
            Number.isFinite(minMoonAxis) &&
            Number.isFinite(maxMoonAxis) &&
            maxMoonAxis > minMoonAxis
          ) {
            const t =
              (Math.log10(moonAxis) - Math.log10(minMoonAxis)) /
              (Math.log10(maxMoonAxis) - Math.log10(minMoonAxis));
            orbitR = pr + 10 + t * moonBand;
          }
          const mEcc = useEccentricMoons ? clamp(Number(moon.eccentricity) || 0, 0, 0.99) : 0;
          const mIncDeg = useEccentricMoons ? Number(moon.inclinationDeg) || 0 : 0;
          const mArgW = Number(moon.longitudeOfPeriapsisDeg) || 0;
          if (chkOrbits?.checked) {
            const moonRing =
              useEccentricMoons && mEcc > 0
                ? projectedEllipseOrbitLine(
                    orbitR,
                    mEcc,
                    mArgW,
                    mIncDeg,
                    0x64708a,
                    0.22,
                    120,
                    bodyZ - 0.2,
                    pPos.x,
                    pPos.y,
                  )
                : projectedOrbitLine(
                    orbitR,
                    0x64708a,
                    0.22,
                    120,
                    mIncDeg,
                    bodyZ - 0.2,
                    pPos.x,
                    pPos.y,
                  );
            nativeThree.systemGroup.add(moonRing);
            if (chkPeAp?.checked && useEccentricMoons && mEcc > 0.01) {
              addApsisMarkersNative(
                orbitR,
                mEcc,
                mArgW,
                mIncDeg,
                chkLabels?.checked,
                pPos.x,
                pPos.y,
              );
            }
          }

          const baseMa = (i / n) * Math.PI * 2 + placement.baseAngle * 0.35;
          const mp = Number(moon.periodDays);
          const omegaM =
            Number.isFinite(mp) && mp > 0 ? (2 * Math.PI) / mp : (2 * Math.PI) / (6 + i * 2.5);
          let mox;
          let moy;
          if (useEccentricMoons && mEcc > 0) {
            const M = baseMa + omegaM * state.simTime;
            const Ea = solveKeplerEquation(M, mEcc);
            const mA = orbitR;
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
            mox = Math.cos(ma) * orbitR;
            moy = Math.sin(ma) * orbitR;
          }
          const mIncRad = (mIncDeg * Math.PI) / 180;
          const moyVert = moy * Math.sin(mIncRad);
          const moyFlat = moy * Math.cos(mIncRad);
          const mProj = orbitOffsetToScreen(mox, moyFlat, pPos.x, pPos.y, moyVert);
          const mpos = toThreeXY(metrics, mProj.x, mProj.y);
          const moonR = usePhysicalSize
            ? physicalRadiusToPx(
                Number(moon.radiusKm),
                metrics.starR,
                metrics.starRadiusKm,
                0,
                Infinity,
              )
            : representativeMoonR(moon.radiusKm, planetKm, pr);
          const moonZ = mProj.depth < 0 ? bodyZ - 0.15 : bodyZ + 0.3;
          if (usePhysicalSize && moonR < PHYS_VIS_THRESHOLD_PX) {
            addPositionIndicatorNative(mProj.x, mProj.y, 0xc8c6c3, moonZ + 0.2);
          } else {
            const mTex = moonAssetPath(computeMoonVisualProfile(moon.moonCalc || moon.model || {}));
            const ms = threeSprite(
              mTex,
              Math.max(2.0, Math.max(moonR, 0.5) * 2.1),
              mpos.x,
              mpos.y,
              moonZ,
              0xffffff,
              0.97,
            );
            if (ms) nativeThree.systemGroup.add(ms);
            const moonRotationDays = Number(moon.rotationPeriodDays);
            const moonAxialTiltDeg = normalizeAxialTiltDeg(moon.axialTiltDeg);
            const moonSpinAngle =
              chkRotation?.checked === false
                ? 0
                : computeSpinAngleRad(moon.id, moonRotationDays, moonAxialTiltDeg);
            if (chkRotation?.checked) {
              addRotationOverlayNative(
                mProj.x,
                mProj.y,
                Math.max(moonR, 0.5),
                moon.id,
                moonAxialTiltDeg,
                moonSpinAngle,
                moonZ + 0.45,
              );
            }
            if (chkAxialTilt?.checked) {
              addAxialTiltOverlayNative(
                mProj.x,
                mProj.y,
                Math.max(moonR, 0.5),
                moon.id,
                moonAxialTiltDeg,
                moonZ + 0.4,
              );
            }
          }
          if (showMoonLabels && moon?.name) {
            addDraggableLabelNative({
              key: `moon:${moon.id}`,
              line1: moon.name,
              anchorX: mProj.x,
              anchorY: mProj.y,
              defaultX: mProj.x + Math.max(8, Math.max(moonR, 0.5) + 3) - 6,
              defaultY: mProj.y + 5 - 10,
              z: 9,
              leaderRadius: Math.max(1, moonR),
              font1: "10px system-ui, sans-serif",
              color1: "rgba(200,208,226,0.72)",
            });
          }
        }
      }

      nativePlanetRenderNodes.push({ p, placement, pPos, pr });
    }

    for (let gi = 0; gi < (gasGiants || []).length; gi += 1) {
      const g = gasGiants[gi];
      const placement = computeGasGiantPlacement(g, gi, metrics, snapshot.starMassMsol);
      if (!placement) continue;
      const gPos = orbitOffsetToScreen(placement.ox, placement.oy, cx, cy);
      if (!Number.isFinite(gPos.x) || !Number.isFinite(gPos.y)) continue;
      const gr = nativeGasRadiusPx(g, metrics);
      const pos = toThreeXY(metrics, gPos.x, gPos.y);
      const bodyZ = gPos.depth < 0 ? -1.55 : 2.15;
      if (usePhysicalSize && gr < PHYS_VIS_THRESHOLD_PX) {
        addPositionIndicatorNative(gPos.x, gPos.y, 0xe6bf88, bodyZ + 0.7);
      } else {
        const gs = threeSprite(
          gasAssetPath(g.style),
          Math.max(2.4, gr * 2.25),
          pos.x,
          pos.y,
          bodyZ,
          0xffffff,
          1,
        );
        if (gs) nativeThree.systemGroup.add(gs);
        if (g?.rings) {
          const ringGeom = new THREE.RingGeometry(
            Math.max(2, gr * 0.9),
            Math.max(2.2, gr * 1.45),
            70,
          );
          const ringMat = new THREE.MeshBasicMaterial({
            color: 0xd8c2a0,
            transparent: true,
            opacity: 0.4,
            side: THREE.DoubleSide,
            depthWrite: false,
          });
          const ringMesh = new THREE.Mesh(ringGeom, ringMat);
          ringMesh.position.set(pos.x, pos.y, bodyZ - 0.05);
          ringMesh.rotation.x = 0.9;
          nativeThree.systemGroup.add(ringMesh);
        }
        const gasRotationHours = Number(g.rotationPeriodHours);
        const gasRotationDays =
          Number.isFinite(gasRotationHours) && gasRotationHours > 0 ? gasRotationHours / 24 : null;
        const gasAxialTiltDeg = normalizeAxialTiltDeg(g.axialTiltDeg ?? 0);
        const gasSpinAngle =
          chkRotation?.checked === false
            ? 0
            : computeSpinAngleRad(g.id, gasRotationDays, gasAxialTiltDeg);
        if (chkRotation?.checked) {
          addRotationOverlayNative(
            gPos.x,
            gPos.y,
            Math.max(gr, 0.5),
            g.id,
            gasAxialTiltDeg,
            gasSpinAngle,
            bodyZ + 0.45,
          );
        }
        if (chkAxialTilt?.checked) {
          addAxialTiltOverlayNative(
            gPos.x,
            gPos.y,
            Math.max(gr, 0.5),
            g.id,
            gasAxialTiltDeg,
            bodyZ + 0.4,
          );
        }
      }
      addBodyLabelNative(
        g.name || "Gas giant",
        `${Number(g.au || 0).toFixed(2)} AU`,
        gPos.x,
        gPos.y,
        Math.max(gr, 2),
        9,
        `gas:${g.id}`,
      );
      if (chkMoons?.checked && Array.isArray(g.moons)) {
        const n = g.moons.length;
        const moonAxes = g.moons
          .map((m) => Number(m.semiMajorAxisKm))
          .filter((v) => Number.isFinite(v) && v > 0);
        const minMoonAxis = moonAxes.length ? Math.min(...moonAxes) : null;
        const maxMoonAxis = moonAxes.length ? Math.max(...moonAxes) : null;
        const moonBand = Math.max(8 * (n - 1), 8);
        const useEccentricMoons = chkEccentric?.checked === true;
        const gasRadiusKm =
          Number.isFinite(g.radiusKm) && g.radiusKm > 0
            ? Number(g.radiusKm)
            : Number.isFinite(g.radiusRj) && g.radiusRj > 0
              ? g.radiusRj * JUPITER_RADIUS_KM
              : JUPITER_RADIUS_KM;
        for (let i = 0; i < n; i += 1) {
          const moon = g.moons[i];
          const baseAxis = Number(moon?.semiMajorAxisKm);
          let orbitR = gr + 10 + i * 8;
          if (
            Number.isFinite(baseAxis) &&
            Number.isFinite(minMoonAxis) &&
            Number.isFinite(maxMoonAxis) &&
            maxMoonAxis > minMoonAxis
          ) {
            const t =
              (Math.log10(baseAxis) - Math.log10(minMoonAxis)) /
              (Math.log10(maxMoonAxis) - Math.log10(minMoonAxis));
            orbitR = gr + 10 + t * moonBand;
          }
          const mEcc = useEccentricMoons ? clamp(Number(moon.eccentricity) || 0, 0, 0.99) : 0;
          const mIncDeg = useEccentricMoons ? Number(moon.inclinationDeg) || 0 : 0;
          const mArgW = Number(moon.longitudeOfPeriapsisDeg) || 0;
          if (chkOrbits?.checked) {
            const moonRing =
              useEccentricMoons && mEcc > 0
                ? projectedEllipseOrbitLine(
                    orbitR,
                    mEcc,
                    mArgW,
                    mIncDeg,
                    0x6d7693,
                    0.2,
                    120,
                    bodyZ - 0.2,
                    gPos.x,
                    gPos.y,
                  )
                : projectedOrbitLine(
                    orbitR,
                    0x6d7693,
                    0.2,
                    120,
                    mIncDeg,
                    bodyZ - 0.2,
                    gPos.x,
                    gPos.y,
                  );
            nativeThree.systemGroup.add(moonRing);
            if (chkPeAp?.checked && useEccentricMoons && mEcc > 0.01) {
              addApsisMarkersNative(
                orbitR,
                mEcc,
                mArgW,
                mIncDeg,
                chkLabels?.checked,
                gPos.x,
                gPos.y,
              );
            }
          }

          const baseMa = (i / n) * Math.PI * 2 + placement.angle * 0.35;
          const mp = Number(moon.periodDays);
          const omegaM =
            Number.isFinite(mp) && mp > 0 ? (2 * Math.PI) / mp : (2 * Math.PI) / (6 + i * 2.5);
          let mox;
          let moy;
          if (useEccentricMoons && mEcc > 0) {
            const M = baseMa + omegaM * state.simTime;
            const Ea = solveKeplerEquation(M, mEcc);
            const mA = orbitR;
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
            mox = Math.cos(ma) * orbitR;
            moy = Math.sin(ma) * orbitR;
          }
          const mIncRad = (mIncDeg * Math.PI) / 180;
          const moyVert = moy * Math.sin(mIncRad);
          const moyFlat = moy * Math.cos(mIncRad);
          const mProj = orbitOffsetToScreen(mox, moyFlat, gPos.x, gPos.y, moyVert);
          const mpos = toThreeXY(metrics, mProj.x, mProj.y);
          const moonR = usePhysicalSize
            ? physicalRadiusToPx(
                Number(moon.radiusKm),
                metrics.starR,
                metrics.starRadiusKm,
                0,
                Infinity,
              )
            : representativeMoonR(moon.radiusKm, gasRadiusKm, gr);
          const moonZ = mProj.depth < 0 ? bodyZ - 0.1 : bodyZ + 0.3;
          if (usePhysicalSize && moonR < PHYS_VIS_THRESHOLD_PX) {
            addPositionIndicatorNative(mProj.x, mProj.y, 0xc8c6c3, moonZ + 0.2);
          } else {
            const mTex = moonAssetPath(computeMoonVisualProfile(moon.moonCalc || moon.model || {}));
            const ms = threeSprite(
              mTex,
              Math.max(2.0, Math.max(moonR, 0.5) * 2.1),
              mpos.x,
              mpos.y,
              moonZ,
              0xffffff,
              0.97,
            );
            if (ms) nativeThree.systemGroup.add(ms);
            const moonRotationDays = Number(moon.rotationPeriodDays);
            const moonAxialTiltDeg = normalizeAxialTiltDeg(moon.axialTiltDeg);
            const moonSpinAngle =
              chkRotation?.checked === false
                ? 0
                : computeSpinAngleRad(moon.id, moonRotationDays, moonAxialTiltDeg);
            if (chkRotation?.checked) {
              addRotationOverlayNative(
                mProj.x,
                mProj.y,
                Math.max(moonR, 0.5),
                moon.id,
                moonAxialTiltDeg,
                moonSpinAngle,
                moonZ + 0.45,
              );
            }
            if (chkAxialTilt?.checked) {
              addAxialTiltOverlayNative(
                mProj.x,
                mProj.y,
                Math.max(moonR, 0.5),
                moon.id,
                moonAxialTiltDeg,
                moonZ + 0.4,
              );
            }
          }
          if (showMoonLabels && moon?.name) {
            addDraggableLabelNative({
              key: `moon:${moon.id}`,
              line1: moon.name,
              anchorX: mProj.x,
              anchorY: mProj.y,
              defaultX: mProj.x + Math.max(8, Math.max(moonR, 0.5) + 3) - 6,
              defaultY: mProj.y + 5 - 10,
              z: 9,
              leaderRadius: Math.max(1, moonR),
              font1: "10px system-ui, sans-serif",
              color1: "rgba(200,208,226,0.72)",
            });
          }
        }
      }
      registerHit("gasGiant", g.id, gPos.x, gPos.y, Math.max(12, gr + 4), g);
      nativeGasRenderNodes.push({ g, placement, gPos, gr });
    }

    if (chkHill?.checked) {
      for (const node of nativePlanetRenderNodes) {
        const massEarth = Number(node.p.massEarth);
        if (
          !Number.isFinite(massEarth) ||
          massEarth <= 0 ||
          !Number.isFinite(node.p.au) ||
          node.p.au <= 0
        )
          continue;
        const hillAu =
          node.p.au * (massEarth / (3 * snapshot.starMassMsol * EARTH_PER_MSOL)) ** (1 / 3);
        if (!Number.isFinite(hillAu) || hillAu <= 0) continue;
        const hillPx =
          mapAuToPx(node.p.au + hillAu, minAu, maxAu, maxR) -
          mapAuToPx(node.p.au, minAu, maxAu, maxR);
        addHillSphereMarkerNative(
          node.pPos.x,
          node.pPos.y,
          hillPx,
          chkLabels?.checked,
          chkDistances?.checked,
          hillAu,
        );
      }
      for (const node of nativeGasRenderNodes) {
        const mj = Number(node.g.massMjup);
        if (!Number.isFinite(mj) || mj <= 0 || !Number.isFinite(node.g.au) || node.g.au <= 0)
          continue;
        const hillAu = node.g.au * (mj / (3 * snapshot.starMassMsol * MJUP_PER_MSOL)) ** (1 / 3);
        if (!Number.isFinite(hillAu) || hillAu <= 0) continue;
        const hillPx =
          mapAuToPx(node.g.au + hillAu, minAu, maxAu, maxR) -
          mapAuToPx(node.g.au, minAu, maxAu, maxR);
        addHillSphereMarkerNative(
          node.gPos.x,
          node.gPos.y,
          hillPx,
          chkLabels?.checked,
          chkDistances?.checked,
          hillAu,
        );
      }
    }

    if (chkLagrange?.checked) {
      for (const node of nativePlanetRenderNodes) {
        const massEarth = Number(node.p.massEarth);
        if (
          !Number.isFinite(massEarth) ||
          massEarth <= 0 ||
          !Number.isFinite(node.p.au) ||
          node.p.au <= 0
        )
          continue;
        const lp = calcLagrangePoints({
          bodyAu: node.p.au,
          bodyMass: massEarth,
          starMass: snapshot.starMassMsol * EARTH_PER_MSOL,
          bodyAngleRad: node.placement.angle,
        });
        if (!lp) continue;
        const isFocused = state.focusTargetKind === "planet" && state.focusTargetId === node.p.id;
        for (const key of ["L4", "L5"]) {
          const pt = lp.points[key];
          const pr = mapAuToPx(pt.au, minAu, maxAu, maxR);
          const sp = orbitOffsetToScreen(
            Math.cos(pt.angleRad) * pr,
            Math.sin(pt.angleRad) * pr,
            cx,
            cy,
          );
          addLagrangeMarkerNative(sp.x, sp.y, pt.label, isFocused ? "full" : "trojan");
        }
        if (isFocused) {
          for (const key of ["L1", "L2", "L3"]) {
            const pt = lp.points[key];
            const pr = mapAuToPx(pt.au, minAu, maxAu, maxR);
            const sp = orbitOffsetToScreen(
              Math.cos(pt.angleRad) * pr,
              Math.sin(pt.angleRad) * pr,
              cx,
              cy,
            );
            addLagrangeMarkerNative(sp.x, sp.y, pt.label, "full");
          }
        }
      }
      for (const node of nativeGasRenderNodes) {
        const mj = Number(node.g.massMjup);
        if (!Number.isFinite(mj) || mj <= 0 || !Number.isFinite(node.g.au) || node.g.au <= 0)
          continue;
        const lp = calcLagrangePoints({
          bodyAu: node.g.au,
          bodyMass: mj,
          starMass: snapshot.starMassMsol * MJUP_PER_MSOL,
          bodyAngleRad: node.placement.angle,
        });
        if (!lp) continue;
        const isFocused = state.focusTargetKind === "gasGiant" && state.focusTargetId === node.g.id;
        for (const key of ["L4", "L5"]) {
          const pt = lp.points[key];
          const pr = mapAuToPx(pt.au, minAu, maxAu, maxR);
          const sp = orbitOffsetToScreen(
            Math.cos(pt.angleRad) * pr,
            Math.sin(pt.angleRad) * pr,
            cx,
            cy,
          );
          addLagrangeMarkerNative(sp.x, sp.y, pt.label, isFocused ? "full" : "trojan");
        }
        if (isFocused) {
          for (const key of ["L1", "L2", "L3"]) {
            const pt = lp.points[key];
            const pr = mapAuToPx(pt.au, minAu, maxAu, maxR);
            const sp = orbitOffsetToScreen(
              Math.cos(pt.angleRad) * pr,
              Math.sin(pt.angleRad) * pr,
              cx,
              cy,
            );
            addLagrangeMarkerNative(sp.x, sp.y, pt.label, "full");
          }
        }
      }
    }

    const viewChanged =
      Math.abs(state.zoom - DEFAULT_ZOOM) > 0.01 ||
      Math.abs(state.panX) > 1 ||
      Math.abs(state.panY) > 1 ||
      Math.abs(state.yaw - DEFAULT_YAW) > 0.01 ||
      Math.abs(state.pitch - DEFAULT_PITCH) > 0.01;
    if (btnResetView) btnResetView.disabled = !viewChanged;

    if (state.zoom < TRANSITION_ZOOM_START && !state.transitioning) {
      const progress = clamp(
        (TRANSITION_ZOOM_START - state.zoom) / (TRANSITION_ZOOM_START - TRANSITION_ZOOM_END),
        0,
        1,
      );
      showNativeTransitionOverlay(progress, "Zoom out to cluster view");
      if (progress >= 1.0) triggerClusterTransition();
    } else {
      hideNativeTransitionOverlay();
    }

    nativeThree.renderer.setClearColor(0x050916, 1);
    nativeThree.renderer.render(nativeThree.scene, nativeThree.cameraSystem);
    return true;
  }

  function drawNativeClusterMode() {
    if (!nativeThree) return false;
    hideOffscaleZoneNotice();
    nativeThree.systemGroup.visible = false;
    nativeThree.clusterGroup.visible = true;
    if (!state.clusterSnapshot) refreshClusterSnapshot();
    if (!state.clusterSnapshot) return false;

    const dpr = state.canvasDpr || window.devicePixelRatio || 1;
    const W = canvas.width / dpr;
    const H = canvas.height / dpr;
    if (W < 1 || H < 1) return false;

    nativeThree.renderer.setSize(
      Math.max(1, Math.round(W * dpr)),
      Math.max(1, Math.round(H * dpr)),
      false,
    );
    nativeThree.renderer.setPixelRatio(1);
    nativeThree.cameraCluster.aspect = W / Math.max(1, H);
    nativeThree.cameraCluster.updateProjectionMatrix();
    clearThreeGroup(nativeThree.clusterGroup);

    const snapshot = state.clusterSnapshot;
    const THREE = nativeThree.THREE;
    const radiusLy = Math.max(1, Number(snapshot?.radiusLy) || 1);
    const useMils = !!clusterMilsEl?.checked;
    const yaw = state.yaw || 0;
    const pitch = state.pitch || 0;
    const zoom = clamp(state.zoom || 1, 0.3, 12);
    nativeThree.cameraCluster.position.set(
      (Math.sin(yaw) * Math.cos(pitch) * 24) / zoom,
      (Math.sin(pitch) * 20) / zoom,
      (Math.cos(yaw) * Math.cos(pitch) * 24) / zoom,
    );
    nativeThree.cameraCluster.lookAt(0, 0, 0);
    const projectToScreen = (v3) => {
      const p = v3.clone().project(nativeThree.cameraCluster);
      return {
        x: (p.x * 0.5 + 0.5) * W,
        y: (-p.y * 0.5 + 0.5) * H,
        depth: p.z,
      };
    };
    const classKeyLabel = (key) => {
      const txt = String(key || "");
      if (txt === "LTY") return "L/T/Y";
      if (txt === "OTHER") return "Other";
      return txt;
    };
    const classLabelForSystem = (sys) => {
      if (!Array.isArray(sys?.components) || sys.components.length <= 1) {
        return classKeyLabel(sys?.objectClassKey);
      }
      return sys.components.map((c) => classKeyLabel(c?.objectClassKey)).join(" + ");
    };

    if (chkClusterGrid?.checked) {
      const ringSteps = [5, 10, 15, 20];
      for (const r of ringSteps) {
        const ring = Math.min(radiusLy, r);
        if (ring <= 0) continue;
        const g = new THREE.RingGeometry(ring - 0.03, ring + 0.03, 120);
        const m = new THREE.MeshBasicMaterial({
          color: 0x5f6f8f,
          transparent: true,
          opacity: 0.2,
          side: THREE.DoubleSide,
          depthWrite: false,
        });
        const mesh = new THREE.Mesh(g, m);
        mesh.rotation.x = Math.PI / 2;
        nativeThree.clusterGroup.add(mesh);
        const rLabelPoint = new THREE.Vector3(ring, 0, 0);
        const ringLabel = threeText(
          `${ring.toFixed(ring < 10 ? 1 : 0)} ly`,
          rLabelPoint.x + 0.35,
          0,
          1,
          {
            font: "10px system-ui, sans-serif",
            color: "rgba(186,208,248,0.82)",
          },
        );
        if (ringLabel) nativeThree.clusterGroup.add(ringLabel);
      }
      const degreeMarks = [0, 45, 90, 135, 180, 225, 270, 315];
      for (const deg of degreeMarks) {
        const angle = (deg * Math.PI) / 180;
        const inner = new THREE.Vector3(
          Math.sin(angle) * radiusLy * 0.985,
          0,
          Math.cos(angle) * radiusLy * 0.985,
        );
        const outer = new THREE.Vector3(
          Math.sin(angle) * radiusLy * 1.03,
          0,
          Math.cos(angle) * radiusLy * 1.03,
        );
        const gTick = new THREE.BufferGeometry().setFromPoints([inner, outer]);
        const mTick = new THREE.LineBasicMaterial({
          color: 0xd2e2ff,
          transparent: true,
          opacity: 0.4,
          depthWrite: false,
        });
        nativeThree.clusterGroup.add(new THREE.Line(gTick, mTick));
        const labelPt = new THREE.Vector3(
          Math.sin(angle) * radiusLy * 1.09,
          0,
          Math.cos(angle) * radiusLy * 1.09,
        );
        const bearingLabel = useMils ? `${Math.round((deg / 360) * 6400)} mil` : `${deg}\u00b0`;
        const txt = threeText(bearingLabel, labelPt.x, labelPt.y, 1, {
          font: "10px system-ui, sans-serif",
          color: "rgba(205,220,248,0.80)",
        });
        if (txt) {
          txt.scale.set(txt.scale.x * 0.08, txt.scale.y * 0.08, 1);
          nativeThree.clusterGroup.add(txt);
        }
      }
    }
    if (chkClusterAxes?.checked) {
      nativeThree.clusterGroup.add(
        threeLine(-radiusLy * 1.1, 0, radiusLy * 1.1, 0, 0x7db8ff, 0.55, -0.2),
      );
      const yGeom = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(0, -radiusLy * 1.1, -0.2),
        new THREE.Vector3(0, radiusLy * 1.1, -0.2),
      ]);
      const yMat = new THREE.LineBasicMaterial({
        color: 0x80e6a0,
        transparent: true,
        opacity: 0.55,
      });
      nativeThree.clusterGroup.add(new THREE.Line(yGeom, yMat));
      const zGeom = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(0, 0, -radiusLy * 1.1),
        new THREE.Vector3(0, 0, radiusLy * 1.1),
      ]);
      const zMat = new THREE.LineBasicMaterial({
        color: 0xff9aa0,
        transparent: true,
        opacity: 0.5,
      });
      nativeThree.clusterGroup.add(new THREE.Line(zGeom, zMat));
      const xLabel = threeText("X", radiusLy * 1.15, 0.8, 1, {
        font: "10px system-ui, sans-serif",
        color: "rgba(160,210,255,0.9)",
      });
      const yLabel = threeText("Y", 0.8, radiusLy * 1.15, 1, {
        font: "10px system-ui, sans-serif",
        color: "rgba(160,240,185,0.9)",
      });
      const zLabel = threeText("Z", 0.8, 0.8, radiusLy * 1.15, {
        font: "10px system-ui, sans-serif",
        color: "rgba(255,170,170,0.9)",
      });
      if (xLabel) nativeThree.clusterGroup.add(xLabel);
      if (yLabel) nativeThree.clusterGroup.add(yLabel);
      if (zLabel) nativeThree.clusterGroup.add(zLabel);
    }
    const boundary = new THREE.RingGeometry(Math.max(0.05, radiusLy - 0.03), radiusLy + 0.03, 128);
    const boundaryMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.14,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const boundaryMesh = new THREE.Mesh(boundary, boundaryMat);
    boundaryMesh.rotation.x = Math.PI / 2;
    nativeThree.clusterGroup.add(boundaryMesh);

    const plotted = [];
    for (const sys of snapshot.systems || []) {
      const p = new THREE.Vector3(Number(sys.x) || 0, Number(sys.y) || 0, Number(sys.z) || 0);
      const isHome = !!sys.isHome;
      const camDist = nativeThree.cameraCluster.position.distanceTo(p);
      const perspective = clamp(28 / Math.max(4, camDist), 0.35, 2.3);
      const pointRadius = clamp(
        (isHome ? 0.5 : 0.25) * perspective * 1.8,
        0.12,
        isHome ? 0.55 : 0.34,
      );
      const m = new THREE.MeshBasicMaterial({
        color: isHome ? 0xf6d88f : 0x9ebde7,
        transparent: true,
        opacity: isHome ? 0.95 : 0.88,
      });
      const g = new THREE.SphereGeometry(pointRadius, 14, 10);
      const mesh = new THREE.Mesh(g, m);
      mesh.position.copy(p);
      nativeThree.clusterGroup.add(mesh);
      if (chkClusterLinks?.checked && !isHome) {
        nativeThree.clusterGroup.add(threeLine(p.x, p.y, p.x, 0, 0x5675b3, 0.33, -1));
      }
      plotted.push({ sys, p, pointRadius, perspective, isHome });
    }

    if (chkClusterLabels?.checked) {
      const maxLabels = Math.max(4, Math.round(160 / radiusLy));
      const homeEntry = plotted.find((item) => item.isHome);
      const candidates = [
        homeEntry,
        ...plotted.filter((item) => !item.isHome).sort((a, b) => b.perspective - a.perspective),
      ].filter(Boolean);
      const drawnBoxes = [];
      const labelBounds = (lx, sy, line1, line2) => {
        const w = Math.max(line1.length * 7, line2.length * 6.2) + 6;
        return { x1: lx - 2, y1: sy - 22, x2: lx + w, y2: sy + 5 };
      };
      const collides = (box) => {
        const margin = 3;
        for (const b of drawnBoxes) {
          if (
            box.x1 < b.x2 + margin &&
            box.x2 > b.x1 - margin &&
            box.y1 < b.y2 + margin &&
            box.y2 > b.y1 - margin
          ) {
            return true;
          }
        }
        return false;
      };
      let drawn = 0;
      for (const item of candidates) {
        if (!item) continue;
        if (!item.isHome && drawn >= maxLabels) break;
        const line1 = item.sys.name || "Star system";
        const line2 = `${classLabelForSystem(item.sys)} | ${Number(item.sys.distanceLy || 0).toFixed(2)} ly${
          Number.isFinite(Number(item.sys.metallicityFeH))
            ? ` | ${Number(item.sys.metallicityFeH) >= 0 ? "+" : ""}${Number(item.sys.metallicityFeH).toFixed(2)}`
            : ""
        }`;
        const companionCount = Array.isArray(item.sys.components)
          ? item.sys.components.length - 1
          : 0;
        let labelX;
        if (item.isHome) {
          labelX = item.p.x + Math.max(0.9, item.pointRadius * 2.5 + 0.4);
        } else if (companionCount > 0) {
          const cRadius = clamp(item.pointRadius * 0.55, 0.08, 0.5);
          const rightEdge =
            item.pointRadius * 1.15 + (companionCount - 1) * cRadius * 2.4 + cRadius * 2.6;
          labelX = item.p.x + rightEdge + 0.3;
        } else {
          labelX = item.p.x + 0.6;
        }
        const labelY = item.p.y + 0.62;
        const sp = projectToScreen(new THREE.Vector3(labelX, labelY, item.p.z));
        const box = labelBounds(sp.x, sp.y, line1, line2);
        if (!item.isHome && collides(box)) continue;
        drawnBoxes.push(box);
        if (!item.isHome) drawn += 1;
        const lbl = threeText(line1, labelX, labelY, item.p.z, {
          font: item.isHome ? "12px system-ui, sans-serif" : "11px system-ui, sans-serif",
          color: item.isHome ? "rgba(255,245,190,0.95)" : "rgba(220,232,255,0.85)",
        });
        const lbl2 = threeText(line2, labelX, labelY - 0.28, item.p.z, {
          font: "10px system-ui, sans-serif",
          color: item.isHome ? "rgba(245,228,172,0.88)" : "rgba(185,208,248,0.78)",
        });
        if (lbl) {
          lbl.scale.set(lbl.scale.x * 0.08, lbl.scale.y * 0.08, 1);
          nativeThree.clusterGroup.add(lbl);
        }
        if (lbl2) {
          lbl2.scale.set(lbl2.scale.x * 0.08, lbl2.scale.y * 0.08, 1);
          nativeThree.clusterGroup.add(lbl2);
        }
      }
    }

    let hoverEntry = null;
    if (state.clusterMouseX != null && state.clusterMouseY != null) {
      let closestDist = Infinity;
      for (const item of plotted) {
        const sp = projectToScreen(item.p);
        const hitR = Math.max(item.pointRadius * 22, 10);
        const d = Math.hypot(sp.x - state.clusterMouseX, sp.y - state.clusterMouseY);
        if (d < hitR && d < closestDist) {
          closestDist = d;
          hoverEntry = { ...item, screen: sp };
        }
      }
      if (hoverEntry) {
        const line1 = hoverEntry.sys.name || "Star system";
        const line2 = `${classLabelForSystem(hoverEntry.sys)} | ${Number(hoverEntry.sys.distanceLy || 0).toFixed(2)} ly${
          Number.isFinite(Number(hoverEntry.sys.metallicityFeH))
            ? ` | ${Number(hoverEntry.sys.metallicityFeH) >= 0 ? "+" : ""}${Number(hoverEntry.sys.metallicityFeH).toFixed(2)}`
            : ""
        }`;
        const hx = hoverEntry.p.x + Math.max(0.9, hoverEntry.pointRadius * 2.5 + 0.4);
        const hy = hoverEntry.p.y + 0.62;
        const h1 = threeText(line1, hx, hy, hoverEntry.p.z, {
          font: hoverEntry.sys.isHome
            ? "bold 12px system-ui, sans-serif"
            : "bold 11px system-ui, sans-serif",
          color: hoverEntry.sys.isHome ? "rgba(255,255,210,1.0)" : "rgba(245,252,255,1.0)",
        });
        const h2 = threeText(line2, hx, hy - 0.28, hoverEntry.p.z, {
          font: "10px system-ui, sans-serif",
          color: hoverEntry.sys.isHome ? "rgba(255,240,185,0.98)" : "rgba(205,225,255,0.98)",
        });
        if (h1) {
          h1.scale.set(h1.scale.x * 0.08, h1.scale.y * 0.08, 1);
          nativeThree.clusterGroup.add(h1);
        }
        if (h2) {
          h2.scale.set(h2.scale.x * 0.08, h2.scale.y * 0.08, 1);
          nativeThree.clusterGroup.add(h2);
        }
      }
    }

    const viewChanged =
      Math.abs(state.zoom - CLUSTER_DEFAULT_ZOOM) > 0.01 ||
      Math.abs(state.yaw - CLUSTER_DEFAULT_YAW) > 0.01 ||
      Math.abs(state.pitch - CLUSTER_DEFAULT_PITCH) > 0.01;
    if (btnResetView) btnResetView.disabled = !viewChanged;

    if (state.zoom > CLUSTER_TRANSITION_ZOOM_START && !state.transitioning) {
      const progress = clamp(
        (state.zoom - CLUSTER_TRANSITION_ZOOM_START) /
          (CLUSTER_TRANSITION_ZOOM_END - CLUSTER_TRANSITION_ZOOM_START),
        0,
        1,
      );
      showNativeTransitionOverlay(progress, "Zoom in to system view");
      if (progress >= 1.0) triggerSystemTransition();
    } else {
      hideNativeTransitionOverlay();
    }

    nativeThree.renderer.setClearColor(0x040916, 1);
    nativeThree.renderer.render(nativeThree.scene, nativeThree.cameraCluster);
    canvas.style.cursor = state.dragging ? "grabbing" : hoverEntry ? "pointer" : "grab";
    return true;
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
    state.labelAutoPins.clear();
  }

  function buildSnapshot(w) {
    const starName = String(w.star?.name || "").trim() || "Star";
    const starMassRaw =
      Number.isFinite(Number(w.star?.massMsol)) && Number(w.star?.massMsol) > 0
        ? Number(w.star.massMsol)
        : Number(w.system?.starMassMsol);
    const starMassMsol = Number.isFinite(starMassRaw) && starMassRaw > 0 ? starMassRaw : 0.8653;
    const starAgeRaw = Number(w.star?.ageGyr);
    const starAgeGyr = Number.isFinite(starAgeRaw) && starAgeRaw >= 0 ? starAgeRaw : 6.254;
    const starMetallicityRaw = Number(w.star?.metallicityFeH);
    const starMetallicityFeH = Number.isFinite(starMetallicityRaw) ? starMetallicityRaw : 0;
    const sov = getStarOverrides(w.star);
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
      metallicityFeH: starMetallicityFeH,
      evolutionMode: sov?.ev || w.star?.evolutionMode || "zams",
    });
    const starTempK = Number(starCalc?.tempK);
    const starLuminosityLsun = Number(starCalc?.luminosityLsol);
    const starRadiusRsol = Math.max(0.01, Number(starCalc?.radiusRsol) || 1);
    const starRadiusKmRaw = Number(starCalc?.metric?.radiusKm);
    const starRadiusKm =
      Number.isFinite(starRadiusKmRaw) && starRadiusKmRaw > 0
        ? starRadiusKmRaw
        : starRadiusRsol * SOL_RADIUS_KM;
    const starColourHex = String(starCalc?.starColourHex || starColourHexFromTempK(starTempK));
    const activityModelVersion = w.star?.activityModelVersion === "v1" ? "v1" : "v2";
    const activityModel = computeStellarActivityModel(
      {
        teffK: starTempK,
        ageGyr: starAgeGyr,
        massMsun: starMassMsol,
        luminosityLsun: starLuminosityLsun,
      },
      { activityCycle: 0.5 },
    );
    const flareParams = activityModel.activity;
    const n32 = Math.max(0, Number(flareParams?.N32) || 0);
    const starActivityLevel = clamp(Math.log10(1 + n32) / Math.log10(31), 0, 1);

    const sys = calcSystem({
      starMassMsol,
      spacingFactor: Number(w.system?.spacingFactor),
      orbit1Au: Number(w.system?.orbit1Au),
      luminosityLsolOverride: starLuminosityLsun,
      radiusRsolOverride: starRadiusRsol,
    });
    const debugOn = !!chkDebug?.checked;
    dbgThrottled(debugOn, "flare:snapshot:model", 1000, "flare:snapshot:model", {
      activityModelVersion,
      starMassMsol,
      starAgeGyr,
      starTempK,
      starLuminosityLsun,
      starMetallicityFeH,
      starEvolutionMode: sov?.ev || w.star?.evolutionMode || "zams",
      teffBin: flareParams?.teffBin,
      ageBand: flareParams?.ageBand,
      N32: Number(flareParams?.N32) || 0,
      energeticFlareRatePerDay: Number(flareParams?.energeticFlareRatePerDay) || 0,
      cmeAssociatedRatePerDay: Number(flareParams?.cmeAssociatedRatePerDay) || 0,
      cmeBackgroundRatePerDay: Number(flareParams?.cmeBackgroundRatePerDay) || 0,
      cmeTotalRatePerDay: Number(flareParams?.cmeTotalRatePerDay) || 0,
    });
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
        let visualProfile = null;
        const planetInputs = { ...p.inputs, semiMajorAxisAu: au };
        try {
          const planetCalc = calcPlanetExact({
            starMassMsol,
            starAgeGyr,
            starRadiusRsolOverride: sov.r,
            starLuminosityLsolOverride: sov.l,
            starTempKOverride: sov.t,
            starEvolutionMode: sov.ev,
            planet: planetInputs,
          });
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

          if (planetCalc?.derived) {
            visualProfile = computeRockyVisualProfile(planetCalc.derived, p.inputs);
          }
        } catch {
          periodDays = null;
          radiusEarth = null;
          skyHighHex = null;
          skyHorizonHex = null;
          visualProfile = null;
        }

        return {
          id: p.id,
          name: p.name || p.inputs?.name || p.id,
          slot,
          au,
          periodDays,
          radiusEarth,
          massEarth: Number(p.inputs?.massEarth) || null,
          rotationPeriodHours: Number(p.inputs?.rotationPeriodHours) || null,
          axialTiltDeg: clamp(Number(p.inputs?.axialTiltDeg ?? 0), 0, 180),
          skyHighHex,
          skyHorizonHex,
          visualProfile,
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
              let mRotationDays = null;
              let mCalc = null;
              try {
                mCalc = calcMoonExact({
                  starMassMsol,
                  starAgeGyr,
                  starRadiusRsolOverride: sov.r,
                  starLuminosityLsolOverride: sov.l,
                  starTempKOverride: sov.t,
                  starEvolutionMode: sov.ev,
                  planet: planetInputs,
                  moon: { ...m.inputs },
                });
                mPeriodDays = Number(mCalc?.orbit?.orbitalPeriodSiderealDays);
                if (!Number.isFinite(mPeriodDays) || mPeriodDays <= 0) mPeriodDays = null;
                mRotationDays = Number(mCalc?.orbit?.rotationPeriodDays);
                if (!Number.isFinite(mRotationDays) || mRotationDays <= 0) mRotationDays = null;
                const moonRadiusMoon = Number(mCalc?.physical?.radiusMoon);
                if (Number.isFinite(moonRadiusMoon) && moonRadiusMoon > 0) {
                  mRadiusKm = moonRadiusMoon * MOON_RADIUS_KM;
                }
              } catch {
                mPeriodDays = null;
                mRadiusKm = null;
                mRotationDays = null;
                mCalc = null;
              }
              const mRotHoursInput = Number(m.inputs?.rotationPeriodHours);
              const mRotDaysInput =
                Number.isFinite(mRotHoursInput) && mRotHoursInput > 0 ? mRotHoursInput / 24 : null;
              const mAxialTiltInput = Number(m.inputs?.axialTiltDeg);
              const mAxialTiltProxy = Number(m.inputs?.inclinationDeg);
              return {
                id: m.id,
                name: m.name || m.inputs?.name || m.id,
                semiMajorAxisKm:
                  Number.isFinite(semiMajorAxisKm) && semiMajorAxisKm > 0 ? semiMajorAxisKm : null,
                periodDays: mPeriodDays,
                rotationPeriodDays: mRotationDays ?? mRotDaysInput ?? mPeriodDays,
                axialTiltDeg: Number.isFinite(mAxialTiltInput)
                  ? clamp(mAxialTiltInput, 0, 180)
                  : Number.isFinite(mAxialTiltProxy)
                    ? clamp(mAxialTiltProxy, 0, 180)
                    : 0,
                radiusKm: mRadiusKm,
                moonCalc: mCalc,
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
            stellarMetallicityFeH: Number(w.star?.metallicityFeH) || 0,
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
            let mRotationDays = null;
            let mCalc = null;
            if (parentOverride) {
              try {
                mCalc = calcMoonExact({
                  starMassMsol,
                  starAgeGyr,
                  starRadiusRsolOverride: sov.r,
                  starLuminosityLsolOverride: sov.l,
                  starTempKOverride: sov.t,
                  starEvolutionMode: sov.ev,
                  moon: { ...m.inputs },
                  parentOverride,
                });
                mPeriodDays = Number(mCalc?.orbit?.orbitalPeriodSiderealDays);
                if (!Number.isFinite(mPeriodDays) || mPeriodDays <= 0) mPeriodDays = null;
                mRotationDays = Number(mCalc?.orbit?.rotationPeriodDays);
                if (!Number.isFinite(mRotationDays) || mRotationDays <= 0) mRotationDays = null;
                const moonRadiusMoon = Number(mCalc?.physical?.radiusMoon);
                if (Number.isFinite(moonRadiusMoon) && moonRadiusMoon > 0) {
                  mRadiusKm = moonRadiusMoon * MOON_RADIUS_KM;
                }
              } catch {
                mPeriodDays = null;
                mRadiusKm = null;
                mRotationDays = null;
                mCalc = null;
              }
            }
            const mRotHoursInput = Number(m.inputs?.rotationPeriodHours);
            const mRotDaysInput =
              Number.isFinite(mRotHoursInput) && mRotHoursInput > 0 ? mRotHoursInput / 24 : null;
            const mAxialTiltInput = Number(m.inputs?.axialTiltDeg);
            const mAxialTiltProxy = Number(m.inputs?.inclinationDeg);
            return {
              id: m.id,
              name: m.name || m.inputs?.name || m.id,
              semiMajorAxisKm:
                Number.isFinite(semiMajorAxisKm) && semiMajorAxisKm > 0 ? semiMajorAxisKm : null,
              periodDays: mPeriodDays,
              rotationPeriodDays: mRotationDays ?? mRotDaysInput ?? mPeriodDays,
              axialTiltDeg: Number.isFinite(mAxialTiltInput)
                ? clamp(mAxialTiltInput, 0, 180)
                : Number.isFinite(mAxialTiltProxy)
                  ? clamp(mAxialTiltProxy, 0, 180)
                  : 0,
              radiusKm: mRadiusKm,
              moonCalc: mCalc,
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
      starActivityLevel,
      starSeed: starSeedRaw,
      activityModelVersion,
      starActivityModel: activityModel,
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

  function hexToRgb(hex) {
    const h = String(hex || "")
      .trim()
      .replace(/^#/, "");
    const raw = h.length === 3 ? h.replace(/(.)/g, "$1$1") : h;
    if (!/^[0-9a-fA-F]{6}$/.test(raw)) return { r: 255, g: 244, b: 220 };
    return {
      r: parseInt(raw.slice(0, 2), 16),
      g: parseInt(raw.slice(2, 4), 16),
      b: parseInt(raw.slice(4, 6), 16),
    };
  }

  function mixHex(hexA, hexB, t = 0.5) {
    const a = hexToRgb(hexA);
    const b = hexToRgb(hexB);
    const u = clamp(Number(t), 0, 1);
    const r = Math.round(a.r + (b.r - a.r) * u);
    const g = Math.round(a.g + (b.g - a.g) * u);
    const bCh = Math.round(a.b + (b.b - a.b) * u);
    return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${bCh.toString(16).padStart(2, "0")}`;
  }

  function mixRgb(rgbA, rgbB, t = 0.5) {
    const u = clamp(Number(t), 0, 1);
    return {
      r: Math.round(rgbA.r + (rgbB.r - rgbA.r) * u),
      g: Math.round(rgbA.g + (rgbB.g - rgbA.g) * u),
      b: Math.round(rgbA.b + (rgbB.b - rgbA.b) * u),
    };
  }

  function rgbToCss(rgb, alpha = 1) {
    const a = clamp(Number(alpha), 0, 1);
    return `rgba(${clamp(Math.round(rgb.r), 0, 255)},${clamp(Math.round(rgb.g), 0, 255)},${clamp(Math.round(rgb.b), 0, 255)},${a})`;
  }

  function getStarSurfaceSeed(snapshot) {
    const rawSeed =
      snapshot?.starSeed ??
      `${snapshot?.starName || "Star"}:${Number(snapshot?.starTempK || 5776).toFixed(0)}:${Number(
        snapshot?.starAgeGyr || 4.6,
      ).toFixed(2)}`;
    return String(rawSeed);
  }

  function drawSoftBlob(cctx, x, y, r, rgb, alphaInner, alphaOuter = 0) {
    if (!(r > 0)) return;
    const g = cctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, rgbToCss(rgb, alphaInner));
    g.addColorStop(1, rgbToCss(rgb, alphaOuter));
    cctx.fillStyle = g;
    cctx.beginPath();
    cctx.arc(x, y, r, 0, Math.PI * 2);
    cctx.fill();
  }

  function paintStarSurfaceTexture(
    cctx,
    size,
    { baseHex = "#fff4dc", seed = "star", tempK = 5776, activity = 0.2 } = {},
  ) {
    const s = Math.max(64, Number(size) || 512);
    const cx = s * 0.5;
    const cy = s * 0.5;
    const r = s * 0.48;
    const baseRgb = hexToRgb(baseHex);
    const coreRgb = hexToRgb(mixHex(baseHex, "#fff7e6", 0.42));
    const limbRgb = hexToRgb(mixHex(baseHex, "#1d1410", 0.35));
    const brightRgb = hexToRgb(mixHex(baseHex, "#fff3dc", 0.58));
    const darkRgb = hexToRgb(mixHex(baseHex, "#130d0b", 0.62));
    const faculaRgb = hexToRgb(mixHex(baseHex, "#ffd9ad", 0.54));
    const tempNorm = clamp((Number(tempK) - 3000) / 7000, 0, 1);
    const activityNorm = clamp(Number(activity), 0, 1);
    const contrast = 1 - tempNorm * 0.28;
    const rng = createSeededRng(
      `${seed}:star-surface:${Math.round(tempK)}:${Math.round(activityNorm * 100)}`,
    );

    cctx.clearRect(0, 0, s, s);
    cctx.save();
    cctx.beginPath();
    cctx.arc(cx, cy, r, 0, Math.PI * 2);
    cctx.clip();

    // Photosphere base with limb darkening.
    const baseGrad = cctx.createRadialGradient(cx - r * 0.11, cy - r * 0.13, r * 0.04, cx, cy, r);
    baseGrad.addColorStop(0.0, rgbToCss(coreRgb, 1));
    baseGrad.addColorStop(0.56, rgbToCss(baseRgb, 1));
    baseGrad.addColorStop(0.9, rgbToCss(limbRgb, 1));
    baseGrad.addColorStop(1.0, rgbToCss(mixRgb(limbRgb, { r: 0, g: 0, b: 0 }, 0.15), 1));
    cctx.fillStyle = baseGrad;
    cctx.fillRect(0, 0, s, s);

    // Fine granulation pattern.
    const grainCount = Math.round(s * (4.2 + activityNorm * 3.4));
    for (let i = 0; i < grainCount; i += 1) {
      const rr = r * Math.sqrt(rng()) * 0.985;
      const ang = rng() * Math.PI * 2;
      const x = cx + Math.cos(ang) * rr;
      const y = cy + Math.sin(ang) * rr;
      const edge = clamp(1 - rr / r, 0, 1);
      const radius = s * (0.0028 + rng() * 0.0105) * (0.45 + edge * 0.8);
      const isBright = rng() > 0.43;
      const alpha = (0.022 + rng() * 0.085) * (0.35 + edge * 0.75) * contrast;
      const tone = isBright
        ? mixRgb(brightRgb, coreRgb, rng() * 0.4)
        : mixRgb(darkRgb, baseRgb, rng() * 0.32);
      drawSoftBlob(cctx, x, y, radius, tone, alpha, 0);
    }

    // Broader convection cells and lanes.
    const cellCount = Math.round(72 + activityNorm * 80);
    for (let i = 0; i < cellCount; i += 1) {
      const rr = r * (0.08 + rng() * 0.84);
      const ang = rng() * Math.PI * 2;
      const x = cx + Math.cos(ang) * rr;
      const y = cy + Math.sin(ang) * rr;
      const radius = s * (0.02 + rng() * 0.06);
      const brightCell = rng() > 0.55;
      const tone = brightCell
        ? mixRgb(brightRgb, faculaRgb, rng() * 0.35)
        : mixRgb(darkRgb, limbRgb, rng() * 0.25);
      const alpha = (0.025 + rng() * 0.06) * contrast;
      drawSoftBlob(cctx, x, y, radius, tone, alpha, 0);
    }

    // Starspots (umbra + penumbra), stronger on more active stars.
    const spotCount = Math.round(1 + activityNorm * 7);
    for (let i = 0; i < spotCount; i += 1) {
      const rr = r * (0.12 + rng() * 0.74);
      const ang = rng() * Math.PI * 2;
      const x = cx + Math.cos(ang) * rr;
      const y = cy + Math.sin(ang) * rr;
      const spotR = s * (0.014 + rng() * 0.042) * (0.7 + activityNorm * 0.85);
      const penumbraRgb = mixRgb(darkRgb, limbRgb, 0.18 + rng() * 0.18);
      const umbraRgb = mixRgb(darkRgb, { r: 0, g: 0, b: 0 }, 0.35 + rng() * 0.25);
      drawSoftBlob(cctx, x, y, spotR * 1.4, penumbraRgb, 0.24 + rng() * 0.16, 0);
      drawSoftBlob(cctx, x, y, spotR * (0.52 + rng() * 0.16), umbraRgb, 0.45 + rng() * 0.2, 0);
    }

    // Faculae near the limb.
    const faculaCount = Math.round(16 + activityNorm * 20);
    for (let i = 0; i < faculaCount; i += 1) {
      const rr = r * (0.72 + rng() * 0.25);
      const ang = rng() * Math.PI * 2;
      const x = cx + Math.cos(ang) * rr;
      const y = cy + Math.sin(ang) * rr;
      const facR = s * (0.005 + rng() * 0.017);
      drawSoftBlob(cctx, x, y, facR, faculaRgb, (0.08 + rng() * 0.09) * contrast, 0);
    }

    cctx.restore();

    // Bright chromosphere rim.
    const rimGrad = cctx.createRadialGradient(cx, cy, r * 0.92, cx, cy, r * 1.03);
    rimGrad.addColorStop(0, rgbToCss(faculaRgb, 0));
    rimGrad.addColorStop(0.76, rgbToCss(faculaRgb, 0.5 + activityNorm * 0.2));
    rimGrad.addColorStop(0.95, rgbToCss(mixRgb(faculaRgb, brightRgb, 0.4), 0.22));
    rimGrad.addColorStop(1, rgbToCss(faculaRgb, 0));
    cctx.fillStyle = rimGrad;
    cctx.beginPath();
    cctx.arc(cx, cy, r * 1.03, 0, Math.PI * 2);
    cctx.fill();
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
    const dpr = state.canvasDpr || window.devicePixelRatio || 1;
    const W = canvas.width / dpr;
    const H = canvas.height / dpr;
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
    if (chkDebris?.checked && snapshot.debrisDisks?.length) {
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
    // Keep representative framing anchored to actual system bodies/features.
    // For very massive/luminous stars, HZ and frost distances can explode by
    // orders of magnitude and collapse the inner-system layout.
    const coreScaleCandidates = maxAuCandidates.filter((v) => Number.isFinite(v) && v > 0);
    const hasCoreScaleFeatures = coreScaleCandidates.length > 0;
    const coreMaxAu = hasCoreScaleFeatures ? Math.max(...coreScaleCandidates) : null;
    if (!hasCoreScaleFeatures) {
      if (chkFrost?.checked) {
        minAuCandidates.push(Number(snapshot.sys?.frostLineAu));
        maxAuCandidates.push(Number(snapshot.sys?.frostLineAu));
      }
      if (chkHz?.checked) {
        minAuCandidates.push(
          Number(snapshot.sys?.habitableZoneAu?.inner),
          Number(snapshot.sys?.habitableZoneAu?.outer),
        );
        maxAuCandidates.push(
          Number(snapshot.sys?.habitableZoneAu?.inner),
          Number(snapshot.sys?.habitableZoneAu?.outer),
        );
      }
    }

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
      // Use a compressed response curve so colour-testing hotter/larger stars
      // does not overwhelm the inner-system layout in representative mode.
      const scaledRadiusFactor = Math.pow(starRadiusRsol, 0.45);
      const maxStarR = innermostOrbitPx > 0 ? innermostOrbitPx * 0.48 : maxR * 0.12;
      starR = clamp(baseStarR * scaledRadiusFactor, 4, Math.max(4, maxStarR));
    }
    const starRadiusKm = Number(snapshot?.starRadiusKm);

    // Representative mode body scale should track zoom approximately linearly
    // to preserve apparent size ratios when zooming far out/in.
    // (The previous zoom^0.4 curve caused oversized bodies at low zoom.)
    const bodyZoom = usePhysical ? 1 : clamp(state.zoom * state.bodyScale, 0.06, 2.5);
    let repBodyScale = 1;
    let repBodyMinPx = 1.2;
    if (!usePhysical) {
      const bodyRadiusCandidates = [];
      for (const p of snapshot.planetNodes || []) {
        bodyRadiusCandidates.push(representativePlanetBaseRadiusPx(p, bodyZoom));
      }
      for (const g of snapshot.gasGiants || []) {
        bodyRadiusCandidates.push(representativeGasBaseRadiusPx(g, bodyZoom));
      }
      const maxBodyRadiusPx = bodyRadiusCandidates.length ? Math.max(...bodyRadiusCandidates) : 0;
      if (maxBodyRadiusPx > 0 && Number.isFinite(starR) && starR > 0) {
        // Normalize all representative body sizes so the largest never exceeds the star.
        repBodyScale = Math.min(1, starR / maxBodyRadiusPx);
      }
      // Keep tiny rocky worlds visible after proportional downscaling.
      repBodyMinPx = clamp(starR * 0.12, 1.05, 1.8);
    }
    const offscaleZones = buildOffscaleZoneInfo(snapshot, coreMaxAu);

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
      repBodyScale,
      repBodyMinPx,
      offscaleZones,
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
      : applyRepresentativeBodyRadiusConstraints(
          representativePlanetBaseRadiusPx(planetNode, metrics.bodyZoom),
          metrics,
        );
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
    const r = (a * (1 - e * e)) / (1 + e * Math.cos(trueAnomalyRad));
    const xOrb = r * Math.cos(trueAnomalyRad);
    const zOrb = r * Math.sin(trueAnomalyRad);
    const xr = xOrb * cosW - zOrb * sinW;
    const zr = xOrb * sinW + zOrb * cosW;
    const oy = zr * sinI;
    const zTilted = zr * cosI;
    return orbitOffsetToScreen(xr, zTilted, cx, cy, oy);
  }

  function projectDirectionToScreen(vx, vz, vy = 0) {
    const cosYaw = Math.cos(state.yaw);
    const sinYaw = Math.sin(state.yaw);
    const sp = Math.sin(state.pitch);
    const cp = Math.cos(state.pitch);
    const xr = vx * cosYaw - vz * sinYaw;
    const zr = vx * sinYaw + vz * cosYaw;
    return {
      x: xr,
      y: vy - zr * sp,
      depth: zr * cp,
    };
  }

  function normalizeAxialTiltDeg(value) {
    const n = Number(value);
    if (!Number.isFinite(n)) return 0;
    return clamp(n, 0, 180);
  }

  function normalizeVec3(v) {
    const len = Math.hypot(v.x, v.y, v.z);
    if (!Number.isFinite(len) || len < 1e-9) return null;
    return { x: v.x / len, y: v.y / len, z: v.z / len };
  }

  function crossVec3(a, b) {
    return {
      x: a.y * b.z - a.z * b.y,
      y: a.z * b.x - a.x * b.z,
      z: a.x * b.y - a.y * b.x,
    };
  }

  function computeSpinAngleRad(bodyId, rotationPeriodDays, axialTiltDeg) {
    const phase = hashUnit(`${bodyId}:spin`) * Math.PI * 2;
    const period = Number(rotationPeriodDays);
    if (!Number.isFinite(period) || period <= 0) return phase;
    const dir = normalizeAxialTiltDeg(axialTiltDeg) > 90 ? -1 : 1;
    return phase + dir * state.simTime * ((2 * Math.PI) / period);
  }

  function computeAxisDirection(bodyId, axialTiltDeg) {
    const tilt = normalizeAxialTiltDeg(axialTiltDeg);
    const retrograde = tilt > 90;
    const obliquityRad = ((retrograde ? 180 - tilt : tilt) * Math.PI) / 180;
    const axisAzimuth = hashUnit(`${bodyId}:axis`) * Math.PI * 2;
    const horizontal = Math.sin(obliquityRad);
    const vx = horizontal * Math.cos(axisAzimuth);
    const vz = horizontal * Math.sin(axisAzimuth);
    const vy = Math.cos(obliquityRad) * (retrograde ? -1 : 1);
    const projected = projectDirectionToScreen(vx, vz, vy);
    const dx = projected.x;
    const dy = -projected.y;
    const len = Math.hypot(dx, dy);
    if (!Number.isFinite(len) || len < 1e-6) return null;
    return { dx: dx / len, dy: dy / len, retrograde, vx, vy, vz };
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

  function estimateMoonOrbitMaxPx(moons, parentRadiusPx) {
    const parentR = Math.max(0, Number(parentRadiusPx) || 0);
    const list = Array.isArray(moons) ? moons : [];
    if (!list.length) return parentR;

    const axes = list
      .map((m) => Number(m?.semiMajorAxisKm))
      .filter((v) => Number.isFinite(v) && v > 0);
    const minAxis = axes.length ? Math.min(...axes) : null;
    const maxAxis = axes.length ? Math.max(...axes) : null;
    const moonBand = Math.max(8 * (list.length - 1), 8);

    let maxOrbit = parentR;
    for (let i = 0; i < list.length; i += 1) {
      const axisKm = Number(list[i]?.semiMajorAxisKm);
      let orbitR = parentR + 10 + i * 8;
      if (
        Number.isFinite(axisKm) &&
        Number.isFinite(minAxis) &&
        Number.isFinite(maxAxis) &&
        maxAxis > minAxis
      ) {
        const t =
          (Math.log10(axisKm) - Math.log10(minAxis)) / (Math.log10(maxAxis) - Math.log10(minAxis));
        orbitR = parentR + 10 + t * moonBand;
      }
      if (orbitR > maxOrbit) maxOrbit = orbitR;
    }
    return maxOrbit;
  }

  function desiredFocusZoom(kind, id, snapshot) {
    const snap = snapshot || getSnapshot();
    const metrics = getFrameMetrics(snap);
    const minDim = Math.min(metrics.W, metrics.H);
    const currentZoom = Math.max(ZOOM_MIN, Number(state.zoom) || DEFAULT_ZOOM);

    let currentExtentPx = 0;
    let targetExtentPx = 0;

    if (kind === "star") {
      currentExtentPx = Math.max(1, metrics.starR);
      targetExtentPx = minDim * 0.22;
    } else if (kind === "planet") {
      const p = snap.planetNodes?.find((node) => node.id === id);
      if (!p)
        return clamp(
          Math.max(currentZoom * 1.28, FOCUS_MIN_ZOOM),
          FOCUS_MIN_ZOOM,
          getFocusMaxZoom(),
        );
      const placement = computePlanetPlacement(p, metrics);
      const planetR = Math.max(1, Number(placement?.pr) || 1);
      const moonOrbitMax = estimateMoonOrbitMaxPx(p.moons, planetR);
      currentExtentPx = Math.max(planetR, moonOrbitMax);
      // If moons exist, frame their orbit system; otherwise make planet large.
      targetExtentPx = (Array.isArray(p.moons) && p.moons.length ? 0.34 : 0.18) * minDim;
    } else if (kind === "gasGiant") {
      const gasGiants = snap.gasGiants || [];
      const idx = gasGiants.findIndex((g) => g.id === id);
      if (idx < 0)
        return clamp(
          Math.max(currentZoom * 1.28, FOCUS_MIN_ZOOM),
          FOCUS_MIN_ZOOM,
          getFocusMaxZoom(),
        );
      const g = gasGiants[idx];
      const placement = computeGasGiantPlacement(g, idx, metrics, snap.starMassMsol);
      const gasR = Math.max(
        1,
        isPhysicalScale()
          ? physicalRadiusToPx(g.radiusKm, metrics.starR, metrics.starRadiusKm, 1, 48)
          : applyRepresentativeBodyRadiusConstraints(
              representativeGasBaseRadiusPx(g, metrics.bodyZoom),
              metrics,
            ),
      );
      const moonOrbitMax = estimateMoonOrbitMaxPx(g.moons, gasR);
      currentExtentPx = Math.max(
        gasR,
        moonOrbitMax,
        Number(placement?.r) ? Math.min(placement.r, gasR * 3) : 0,
      );
      targetExtentPx = (Array.isArray(g.moons) && g.moons.length ? 0.3 : 0.2) * minDim;
    } else {
      return clamp(Math.max(currentZoom * 1.28, FOCUS_MIN_ZOOM), FOCUS_MIN_ZOOM, getFocusMaxZoom());
    }

    if (!(currentExtentPx > 0) || !(targetExtentPx > 0)) {
      return clamp(Math.max(currentZoom * 1.28, FOCUS_MIN_ZOOM), FOCUS_MIN_ZOOM, getFocusMaxZoom());
    }

    const zoomRatio = targetExtentPx / currentExtentPx;
    const desired = currentZoom * zoomRatio;
    // Click focus should zoom in, not out.
    return clamp(Math.max(desired, currentZoom), FOCUS_MIN_ZOOM, getFocusMaxZoom());
  }

  function setFocusTarget(kind, id, snapshotArg) {
    if (!id || !kind) return;
    state.focusTargetKind = kind;
    state.focusTargetId = id;
    state.focusZoomTarget = desiredFocusZoom(kind, id, snapshotArg);
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

  function hitTestLabelUi(x, y) {
    for (let i = (state.labelHitRegions?.length || 0) - 1; i >= 0; i -= 1) {
      const hit = state.labelHitRegions[i];
      if (!hit) continue;
      if (x < hit.x || x > hit.x + hit.w || y < hit.y || y > hit.y + hit.h) continue;
      return hit;
    }
    return null;
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
    } else if (state.focusTargetKind === "star") {
      targetOffsetX = 0;
      targetOffsetY = 0;
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
    const prevZoom = Math.max(1e-6, state.zoom);
    const nextZoom = state.zoom + (targetZoom - state.zoom) * zoomAlpha;
    const zoomRatio = nextZoom / prevZoom;
    state.zoom = nextZoom;

    const projectedTarget = projectOrbitOffset(targetOffsetX, targetOffsetY);
    // Orbit offsets scale linearly with zoom; preserve that coupling while
    // easing pan so focus-follow does not briefly snap toward the star.
    const targetPanX = -projectedTarget.x * zoomRatio;
    const targetPanY = projectedTarget.y * zoomRatio;
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
    const activityModelVersion = snapshot?.activityModelVersion === "v1" ? "v1" : "v2";
    return `${seedKey}|${m.toFixed(6)}|${a.toFixed(6)}|${t.toFixed(3)}|${l.toFixed(6)}|${activityModelVersion}`;
  }

  function flareDebugEnabled() {
    return !!chkDebug?.checked;
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
    const activityModelVersion = snapshot?.activityModelVersion === "v1" ? "v1" : "v2";
    const activityModel =
      snapshot?.starActivityModel && typeof snapshot.starActivityModel === "object"
        ? snapshot.starActivityModel
        : computeStellarActivityModel(
            {
              massMsun: snapshot.starMassMsol,
              ageGyr: snapshot.starAgeGyr,
              teffK: snapshot.starTempK,
              luminosityLsun: snapshot.starLuminosityLsun,
            },
            { activityCycle: 0.5 },
          );
    const activity =
      activityModel?.activity && typeof activityModel.activity === "object"
        ? activityModel.activity
        : activityModel || {};
    // Visualizer flare cadence follows the energetic (>1e32 erg) rate.
    const energeticRatePerDay = Math.max(
      0,
      Number(activity?.energeticFlareRatePerDay) || Number(activity?.N32) || 0,
    );
    const associatedCmeRatePerDay =
      activityModelVersion === "v2"
        ? Math.max(0, Number(activity?.cmeAssociatedRatePerDay) || 0)
        : 0;
    const backgroundCmeRatePerDay =
      activityModelVersion === "v2"
        ? Math.max(0, Number(activity?.cmeBackgroundRatePerDay) || 0)
        : 0;
    const params = {
      ...activity,
      lambdaFlarePerDay: energeticRatePerDay,
      EminErg: FLARE_E0_ERG,
      activityModelVersion,
      cmeAssociatedRatePerDay: associatedCmeRatePerDay,
      cmeBackgroundRatePerDay: backgroundCmeRatePerDay,
      cmeTotalRatePerDay: associatedCmeRatePerDay + backgroundCmeRatePerDay,
    };
    const totalFlareRatePerDay = Math.max(
      0,
      Number(activity?.totalFlareRatePerDay) || energeticRatePerDay,
    );
    const surfaceFlareRatePerDay = Math.max(0, totalFlareRatePerDay - energeticRatePerDay);
    const surfaceParams = {
      ...activity,
      lambdaFlarePerDay: surfaceFlareRatePerDay,
      EminErg: SURFACE_FLARE_EMIN_ERG,
      EmaxErg: SURFACE_FLARE_EMAX_ERG,
    };
    const hasSeed = snapshot.starSeed != null && String(snapshot.starSeed).trim() !== "";
    const rng = hasSeed ? createSeededRng(snapshot.starSeed) : Math.random;

    fs.signature = signature;
    fs.params = params;
    fs.surfaceParams = surfaceParams;
    fs.seeded = hasSeed;
    fs.rng = rng;
    fs.cmeTimes24hSec = [];
    fs.cyclePhase = rng() * Math.PI * 2;
    fs.cyclePeriodSec = (8 + rng() * 6) * 365.25 * 86400;
    fs.loopToggle = rng() >= 0.5;
    // Reset in-flight burst visuals when stellar inputs change so stale
    // flares/CMEs do not remain frozen on screen after edits.
    state.starBursts = [];

    const next = scheduleNextFlare(nowSimSec, params, rng);
    fs.nextFlareTimeSec = next.timeSec;
    fs.nextFlareEnergyErg = next.energyErg;
    const nextSurface = scheduleNextFlare(nowSimSec, surfaceParams, rng);
    fs.nextSurfaceFlareTimeSec = nextSurface.timeSec;
    fs.nextSurfaceFlareEnergyErg = nextSurface.energyErg;
    fs.nextAssociatedCmeTimeSec =
      activityModelVersion === "v2"
        ? scheduleNextCme(nowSimSec, params.cmeAssociatedRatePerDay, rng)
        : Infinity;
    fs.nextBackgroundCmeTimeSec =
      activityModelVersion === "v2"
        ? scheduleNextCme(nowSimSec, params.cmeBackgroundRatePerDay, rng)
        : Infinity;

    dbg(flareDebugEnabled(), "flare:model:init", {
      signature,
      activityModelVersion,
      starSeed: snapshot.starSeed ?? null,
      starMassMsol: Number(snapshot.starMassMsol) || null,
      starAgeGyr: Number(snapshot.starAgeGyr) || null,
      starTempK: Number(snapshot.starTempK) || null,
      starLuminosityLsun: Number(snapshot.starLuminosityLsun) || null,
      teffBin: params.teffBin,
      ageBand: params.ageBand,
      N32: Number(params.N32),
      lambdaFlarePerDay: Number(params.lambdaFlarePerDay),
      EminErg: Number(params.EminErg),
      totalFlareRatePerDay: Number(totalFlareRatePerDay) || 0,
      surfaceFlareRatePerDay: Number(surfaceFlareRatePerDay) || 0,
      cmeAssociatedRatePerDay: Number(params.cmeAssociatedRatePerDay) || 0,
      cmeBackgroundRatePerDay: Number(params.cmeBackgroundRatePerDay) || 0,
      cmeTotalRatePerDay: Number(params.cmeTotalRatePerDay) || 0,
      nextFlareInSec: Number.isFinite(next.timeSec)
        ? Number((next.timeSec - nowSimSec).toFixed(3))
        : Infinity,
      nextFlareEnergyErg: Number(next.energyErg) || null,
      nextSurfaceFlareInSec: Number.isFinite(fs.nextSurfaceFlareTimeSec)
        ? Number((fs.nextSurfaceFlareTimeSec - nowSimSec).toFixed(3))
        : Infinity,
      nextSurfaceFlareEnergyErg: Number(fs.nextSurfaceFlareEnergyErg) || null,
      nextAssociatedCmeInSec: Number.isFinite(fs.nextAssociatedCmeTimeSec)
        ? Number((fs.nextAssociatedCmeTimeSec - nowSimSec).toFixed(3))
        : Infinity,
      nextBackgroundCmeInSec: Number.isFinite(fs.nextBackgroundCmeTimeSec)
        ? Number((fs.nextBackgroundCmeTimeSec - nowSimSec).toFixed(3))
        : Infinity,
    });
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

  function flareEnergyNorm(energyErg) {
    const e = Math.max(1, Number(energyErg) || 1e30);
    return clamp((Math.log10(e) - 30) / 5, 0, 1);
  }

  function pushStarBurst({ type, flareClass, energyErg, angle, activityCycle = 0.5 }) {
    if (state.starBursts.length >= MAX_STAR_BURSTS) return false;

    const fs = state.flareState;
    const rng = fs.rng || Math.random;
    const base = flareVisualProfile(flareClass);
    const isCme = type === "cme";
    const isSurface = type === "surface";
    let hasLoops = false;
    if (!isCme && !isSurface) {
      hasLoops = fs.loopToggle !== false;
      fs.loopToggle = !hasLoops;
    }
    const energyNorm = flareEnergyNorm(energyErg);
    const n32 = Math.max(0, Number(fs.params?.N32) || 0);
    const activityNorm = clamp(Math.log10(1 + n32) / Math.log10(31), 0, 1);
    const cycleNorm = clamp(Number(activityCycle), 0, 1);

    const jitter = (rng() - 0.5) * 0.25;
    const spread = Math.max(
      0.03,
      base.spread *
        (isCme ? 1.45 : isSurface ? 0.65 : 1.0) *
        (1 + jitter) *
        (0.88 + energyNorm * 0.42 + activityNorm * 0.18),
    );
    const reach = Math.max(
      0.2,
      base.reach *
        (isCme ? 2.0 : isSurface ? 0.35 : 1.0) *
        (1 + jitter) *
        (0.9 + energyNorm * 0.8 + cycleNorm * 0.25),
    );
    const intensity = Math.max(
      0.06,
      base.intensity *
        (isCme ? 0.86 : isSurface ? 0.72 : 1.0) *
        (1 + jitter * 0.5) *
        (0.84 + energyNorm * 0.82 + activityNorm * 0.32),
    );
    const ttl = Math.max(
      0.2,
      base.ttl *
        (isCme ? 1.95 : isSurface ? 0.55 : 1.0) *
        (1 + jitter * 0.2) *
        (0.9 + energyNorm * 0.45),
    );
    const loopCount = clamp(
      Math.round(
        (isCme ? 2.2 : 1.2) +
          energyNorm * (isCme ? 3.0 : 2.2) +
          activityNorm * 1.4 +
          cycleNorm * 0.9 +
          (rng() - 0.5) * 1.2,
      ),
      1,
      isCme ? 7 : 5,
    );
    const radialStartNorm = isCme
      ? clamp(0.28 + rng() * 0.16 + energyNorm * 0.08, 0.22, 0.64)
      : clamp(0.07 + rng() * 0.09 + energyNorm * 0.04, 0.05, 0.26);
    const radialEndNorm = isCme
      ? clamp(
          1.15 + energyNorm * 0.9 + activityNorm * 0.25 + cycleNorm * 0.2 + rng() * 0.18,
          1.08,
          2.6,
        )
      : clamp(0.5 + energyNorm * 0.32 + cycleNorm * 0.15 + rng() * 0.08, 0.42, 1.15);
    const frontThickness = isCme
      ? clamp(0.16 + energyNorm * 0.09 + activityNorm * 0.04, 0.14, 0.42)
      : clamp(0.06 + energyNorm * 0.03, 0.05, 0.16);
    const streamers = isCme
      ? clamp(Math.round(2 + energyNorm * 2.2 + activityNorm * 1.1 + rng() * 2.1), 2, 7)
      : clamp(Math.round(1 + energyNorm * 1.8 + rng() * 1.6), 1, 4);
    const shellRipple = isCme ? clamp(0.012 + rng() * 0.03, 0.012, 0.05) : 0;
    const plumeStretch = isCme
      ? clamp(1.2 + energyNorm * 0.65 + cycleNorm * 0.25, 1.1, 2.4)
      : clamp(0.75 + energyNorm * 0.35, 0.72, 1.35);
    const cmeLobes = isCme
      ? clamp(Math.round(3 + energyNorm * 2.5 + activityNorm * 1.3 + rng() * 1.8), 3, 8)
      : 0;
    const plumeNoise = isCme ? rng() * Math.PI * 2 : 0;
    const surfaceRadiusNorm = isSurface ? Math.pow(rng(), 0.62) * 0.9 : 0;
    const surfaceSpotScale = isSurface
      ? clamp(0.65 + energyNorm * 0.9 + rng() * 0.35, 0.5, 1.7)
      : 1;

    state.starBursts.push({
      type: isCme ? "cme" : isSurface ? "surface" : "flare",
      flareClass,
      energyErg,
      angle,
      spread,
      reach,
      curl: (rng() - 0.5) * 0.45,
      intensity,
      ttl,
      // Seed with a tiny age so the burst is visible on the very frame it spawns.
      age: Math.min(STAR_BURST_INITIAL_AGE_SEC, ttl * 0.22),
      loops: loopCount,
      hasLoops,
      loopRise: clamp(0.5 + energyNorm * 0.4 + (isCme ? 0.18 : 0), 0.45, 1.25),
      energyNorm,
      activityNorm,
      cycleNorm,
      radialStartNorm,
      radialEndNorm,
      frontThickness,
      streamers,
      shellRipple,
      plumeStretch,
      cmeLobes,
      plumeNoise,
      surfaceRadiusNorm,
      surfaceSpotScale,
      beads: isCme
        ? clamp(Math.round(2 + energyNorm * 3 + activityNorm * 1.2 + rng() * 1.8), 2, 8)
        : 0,
    });
    return true;
  }

  function updateStarBursts(dtSec, snapshot, nowActivitySec) {
    const fs = state.flareState;
    const debugOn = flareDebugEnabled();
    ensureFlareModel(snapshot, nowActivitySec);
    const rng = fs.rng || Math.random;
    const activityModelVersion = fs.params?.activityModelVersion === "v1" ? "v1" : "v2";
    const useSplitCmeScheduler = activityModelVersion === "v2";

    let changed = false;
    const burstCountBefore = state.starBursts.length;
    let expiredBursts = 0;
    let spawnedFlares = 0;
    let spawnedSurfaceFlares = 0;
    let spawnedCmes = 0;
    let spawnedAssociatedCmes = 0;
    let spawnedBackgroundCmes = 0;

    if (state.starBursts.length) {
      changed = true;
      for (const burst of state.starBursts) burst.age += dtSec;
      const before = state.starBursts.length;
      state.starBursts = state.starBursts.filter((b) => b.age < b.ttl);
      expiredBursts = Math.max(0, before - state.starBursts.length);
    }

    fs.cmeTimes24hSec = fs.cmeTimes24hSec.filter((t) => t >= nowActivitySec - 86400);

    let flareCountThisTick = 0;
    let flareBacklogGuardTriggered = false;
    let surfaceFlareIterations = 0;
    let surfaceFlareBacklogGuardTriggered = false;
    while (
      Number.isFinite(fs.nextFlareTimeSec) &&
      fs.nextFlareTimeSec <= nowActivitySec &&
      flareCountThisTick < MAX_FLARES_PER_TICK &&
      state.starBursts.length < MAX_STAR_BURSTS
    ) {
      const flareEnergy = Number(fs.nextFlareEnergyErg) || 1e30;
      const flareClass = flareClassFromEnergy(flareEnergy);
      const angle = (fs.rng || Math.random)() * Math.PI * 2;
      const activityCycle = cycleValueAt(fs.nextFlareTimeSec);

      const flareAdded = pushStarBurst({
        type: "flare",
        flareClass,
        energyErg: flareEnergy,
        angle,
        activityCycle,
      });
      if (flareAdded) {
        changed = true;
        spawnedFlares += 1;
      }

      if (!useSplitCmeScheduler) {
        const recentCMECount24h = fs.cmeTimes24hSec.length;
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
        if (spawnCME && state.starBursts.length < MAX_STAR_BURSTS) {
          const cmeAdded = pushStarBurst({
            type: "cme",
            flareClass,
            energyErg: flareEnergy,
            angle: angle + (rng() - 0.5) * 0.22,
            activityCycle,
          });
          if (cmeAdded) {
            fs.cmeTimes24hSec.push(fs.nextFlareTimeSec);
            changed = true;
            spawnedCmes += 1;
          }
        }
      }

      const next = scheduleNextFlare(fs.nextFlareTimeSec, fs.params, fs.rng);
      fs.nextFlareTimeSec = next.timeSec;
      fs.nextFlareEnergyErg = next.energyErg;
      flareCountThisTick += 1;
    }

    while (
      Number.isFinite(fs.nextSurfaceFlareTimeSec) &&
      fs.nextSurfaceFlareTimeSec <= nowActivitySec &&
      surfaceFlareIterations < MAX_SURFACE_FLARES_PER_TICK &&
      state.starBursts.length < MAX_STAR_BURSTS
    ) {
      const flareEnergy = Number(fs.nextSurfaceFlareEnergyErg) || SURFACE_FLARE_EMIN_ERG;
      const flareClass = flareClassFromEnergy(flareEnergy);
      const activityCycle = cycleValueAt(fs.nextSurfaceFlareTimeSec);
      const flareAdded = pushStarBurst({
        type: "surface",
        flareClass,
        energyErg: flareEnergy,
        angle: rng() * Math.PI * 2,
        activityCycle,
      });
      if (flareAdded) {
        changed = true;
        spawnedSurfaceFlares += 1;
      }
      const nextSurface = scheduleNextFlare(
        fs.nextSurfaceFlareTimeSec,
        fs.surfaceParams || fs.params,
        fs.rng,
      );
      fs.nextSurfaceFlareTimeSec = nextSurface.timeSec;
      fs.nextSurfaceFlareEnergyErg = nextSurface.energyErg;
      surfaceFlareIterations += 1;
    }

    // Backlog guard for very active stars at high simulation speeds.
    if (
      (flareCountThisTick >= MAX_FLARES_PER_TICK || state.starBursts.length >= MAX_STAR_BURSTS) &&
      fs.nextFlareTimeSec <= nowActivitySec
    ) {
      const next = scheduleNextFlare(nowActivitySec, fs.params, fs.rng);
      fs.nextFlareTimeSec = next.timeSec;
      fs.nextFlareEnergyErg = next.energyErg;
      flareBacklogGuardTriggered = true;
    }
    if (
      (surfaceFlareIterations >= MAX_SURFACE_FLARES_PER_TICK ||
        state.starBursts.length >= MAX_STAR_BURSTS) &&
      fs.nextSurfaceFlareTimeSec <= nowActivitySec
    ) {
      const nextSurface = scheduleNextFlare(nowActivitySec, fs.surfaceParams || fs.params, fs.rng);
      fs.nextSurfaceFlareTimeSec = nextSurface.timeSec;
      fs.nextSurfaceFlareEnergyErg = nextSurface.energyErg;
      surfaceFlareBacklogGuardTriggered = true;
    }

    let associatedCmeIterations = 0;
    let backgroundCmeIterations = 0;
    let associatedCmeBacklogGuardTriggered = false;
    let backgroundCmeBacklogGuardTriggered = false;

    if (useSplitCmeScheduler) {
      const associatedRatePerDay = Math.max(0, Number(fs.params?.cmeAssociatedRatePerDay) || 0);
      const backgroundRatePerDay = Math.max(0, Number(fs.params?.cmeBackgroundRatePerDay) || 0);

      while (
        Number.isFinite(fs.nextAssociatedCmeTimeSec) &&
        fs.nextAssociatedCmeTimeSec <= nowActivitySec &&
        associatedCmeIterations < MAX_CMES_PER_TICK &&
        state.starBursts.length < MAX_STAR_BURSTS
      ) {
        const burstTime = fs.nextAssociatedCmeTimeSec;
        const activityCycle = cycleValueAt(burstTime);
        const activeFlares = state.starBursts.filter(
          (burst) => burst.type === "flare" && burst.age < burst.ttl * 0.85,
        );
        let angle = rng() * Math.PI * 2;
        let energyErg = FLARE_E0_ERG * (1 + rng() * 2.5);
        if (activeFlares.length) {
          const anchor = activeFlares[Math.floor(rng() * activeFlares.length)];
          angle = anchor.angle + (rng() - 0.5) * 0.2;
          energyErg = Math.max(FLARE_E0_ERG, Number(anchor.energyErg) || FLARE_E0_ERG);
        }
        const cmeAdded = pushStarBurst({
          type: "cme",
          flareClass: flareClassFromEnergy(energyErg),
          energyErg,
          angle,
          activityCycle,
        });
        if (cmeAdded) {
          fs.cmeTimes24hSec.push(burstTime);
          changed = true;
          spawnedCmes += 1;
          spawnedAssociatedCmes += 1;
        }
        fs.nextAssociatedCmeTimeSec = scheduleNextCme(
          fs.nextAssociatedCmeTimeSec,
          associatedRatePerDay,
          fs.rng,
        );
        associatedCmeIterations += 1;
      }

      if (
        (associatedCmeIterations >= MAX_CMES_PER_TICK ||
          state.starBursts.length >= MAX_STAR_BURSTS) &&
        fs.nextAssociatedCmeTimeSec <= nowActivitySec
      ) {
        fs.nextAssociatedCmeTimeSec = scheduleNextCme(nowActivitySec, associatedRatePerDay, fs.rng);
        associatedCmeBacklogGuardTriggered = true;
      }

      while (
        Number.isFinite(fs.nextBackgroundCmeTimeSec) &&
        fs.nextBackgroundCmeTimeSec <= nowActivitySec &&
        backgroundCmeIterations < MAX_CMES_PER_TICK &&
        state.starBursts.length < MAX_STAR_BURSTS
      ) {
        const burstTime = fs.nextBackgroundCmeTimeSec;
        const activityCycle = cycleValueAt(burstTime);
        const energyErg = FLARE_E0_ERG * (0.55 + rng() * 1.3);
        const cmeAdded = pushStarBurst({
          type: "cme",
          flareClass: flareClassFromEnergy(energyErg),
          energyErg,
          angle: rng() * Math.PI * 2,
          activityCycle,
        });
        if (cmeAdded) {
          fs.cmeTimes24hSec.push(burstTime);
          changed = true;
          spawnedCmes += 1;
          spawnedBackgroundCmes += 1;
        }
        fs.nextBackgroundCmeTimeSec = scheduleNextCme(
          fs.nextBackgroundCmeTimeSec,
          backgroundRatePerDay,
          fs.rng,
        );
        backgroundCmeIterations += 1;
      }

      if (
        (backgroundCmeIterations >= MAX_CMES_PER_TICK ||
          state.starBursts.length >= MAX_STAR_BURSTS) &&
        fs.nextBackgroundCmeTimeSec <= nowActivitySec
      ) {
        fs.nextBackgroundCmeTimeSec = scheduleNextCme(nowActivitySec, backgroundRatePerDay, fs.rng);
        backgroundCmeBacklogGuardTriggered = true;
      }
    } else {
      fs.nextAssociatedCmeTimeSec = Infinity;
      fs.nextBackgroundCmeTimeSec = Infinity;
    }

    const tickSummary = {
      dtSec: Number(dtSec.toFixed(4)),
      speedDaysPerSec: Number(state.speed),
      nowActivitySec: Number(nowActivitySec.toFixed(3)),
      isPlaying: !!state.isPlaying,
      exportingGif: !!state.exportingGif,
      activityModelVersion,
      burstCountBefore,
      burstCountAfter: state.starBursts.length,
      expiredBursts,
      spawnedFlares,
      spawnedSurfaceFlares,
      spawnedCmes,
      spawnedAssociatedCmes,
      spawnedBackgroundCmes,
      flareIterations: flareCountThisTick,
      surfaceFlareIterations,
      associatedCmeIterations,
      backgroundCmeIterations,
      flareBacklogGuardTriggered,
      surfaceFlareBacklogGuardTriggered,
      associatedCmeBacklogGuardTriggered,
      backgroundCmeBacklogGuardTriggered,
      reachedTickCap: flareCountThisTick >= MAX_FLARES_PER_TICK,
      reachedBufferCap: state.starBursts.length >= MAX_STAR_BURSTS,
      nextFlareInSec: Number.isFinite(fs.nextFlareTimeSec)
        ? Number((fs.nextFlareTimeSec - nowActivitySec).toFixed(3))
        : Infinity,
      nextFlareEnergyErg: Number(fs.nextFlareEnergyErg) || null,
      nextSurfaceFlareInSec: Number.isFinite(fs.nextSurfaceFlareTimeSec)
        ? Number((fs.nextSurfaceFlareTimeSec - nowActivitySec).toFixed(3))
        : Infinity,
      nextSurfaceFlareEnergyErg: Number(fs.nextSurfaceFlareEnergyErg) || null,
      nextAssociatedCmeInSec: Number.isFinite(fs.nextAssociatedCmeTimeSec)
        ? Number((fs.nextAssociatedCmeTimeSec - nowActivitySec).toFixed(3))
        : Infinity,
      nextBackgroundCmeInSec: Number.isFinite(fs.nextBackgroundCmeTimeSec)
        ? Number((fs.nextBackgroundCmeTimeSec - nowActivitySec).toFixed(3))
        : Infinity,
      teffBin: fs.params?.teffBin || null,
      ageBand: fs.params?.ageBand || null,
      N32: Number(fs.params?.N32) || 0,
      lambdaFlarePerDay: Number(fs.params?.lambdaFlarePerDay) || 0,
      lowEnergySurfaceRatePerDay: Number(fs.surfaceParams?.lambdaFlarePerDay) || 0,
      cmeAssociatedRatePerDay: Number(fs.params?.cmeAssociatedRatePerDay) || 0,
      cmeBackgroundRatePerDay: Number(fs.params?.cmeBackgroundRatePerDay) || 0,
      cmeTotalRatePerDay: Number(fs.params?.cmeTotalRatePerDay) || 0,
    };
    const hasTickEvent =
      spawnedFlares > 0 ||
      spawnedSurfaceFlares > 0 ||
      spawnedCmes > 0 ||
      expiredBursts > 0 ||
      flareCountThisTick > 0 ||
      surfaceFlareIterations > 0 ||
      associatedCmeIterations > 0 ||
      backgroundCmeIterations > 0 ||
      flareBacklogGuardTriggered ||
      surfaceFlareBacklogGuardTriggered ||
      associatedCmeBacklogGuardTriggered ||
      backgroundCmeBacklogGuardTriggered ||
      burstCountBefore !== state.starBursts.length;
    if (hasTickEvent) dbg(debugOn, "flare:tick:event", tickSummary);
    else dbgThrottled(debugOn, "flare:tick:idle", 2000, "flare:tick:idle", tickSummary);

    return changed;
  }

  /* ── Draw dispatcher ────────────────────────────────────────── */

  function draw(snapshotArg) {
    if (disposed || !root.isConnected || !canvas || !canvas.isConnected) return;
    if (!nativeThree) return;
    if (state.mode === "cluster") {
      drawNativeClusterMode();
    } else {
      drawNativeSystemMode(snapshotArg);
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
      draw();
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
      draw();
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
  let dragMode = null; // "pan" | "rotate" | "label" | null
  let draggedLabel = null;
  let lastX = 0,
    lastY = 0;
  let draggedDuringPointer = false;
  let suppressPlanetClickUntilMs = 0;
  addDisposableListener(canvas, "contextmenu", (e) => {
    // Keep right-drag rotation usable without the browser context menu interrupting.
    e.preventDefault();
  });
  addDisposableListener(canvas, "mousedown", (e) => {
    if (state.mode === "system" && e.button === 0) {
      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const labelHit = hitTestLabelUi(x, y);
      if (labelHit?.kind === "label-reset" && labelHit.key) {
        state.labelOverrides.delete(labelHit.key);
        state.labelAutoPins.delete(labelHit.key);
        draw();
        e.preventDefault();
        return;
      }
      if (labelHit?.kind === "label" && labelHit.key) {
        dragMode = "label";
        state.dragging = true;
        canvas.style.cursor = "grabbing";
        draggedLabel = {
          key: labelHit.key,
          pointerDx: x - labelHit.x,
          pointerDy: y - labelHit.y,
        };
        draggedDuringPointer = false;
        lastX = e.clientX;
        lastY = e.clientY;
        e.preventDefault();
        return;
      }
    }
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
    draggedLabel = null;
    state.dragging = false;
    if (state.mode === "system") canvas.style.cursor = "grab";
    if (draggedDuringPointer) suppressPlanetClickUntilMs = performance.now() + 140;
  });
  addDisposableListener(window, "mousemove", (e) => {
    if (disposed || !root.isConnected) return;
    if (!dragMode) return;
    if (dragMode === "label") {
      if (!draggedLabel?.key) return;
      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const nextRectX = x - draggedLabel.pointerDx;
      const nextRectY = y - draggedLabel.pointerDy;
      state.labelOverrides.set(draggedLabel.key, {
        x: nextRectX,
        y: nextRectY,
      });
      state.labelAutoPins.delete(draggedLabel.key);
      draggedDuringPointer = true;
      lastX = e.clientX;
      lastY = e.clientY;
      draw();
      return;
    }
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
    const labelHit = hitTestLabelUi(x, y);
    if (labelHit?.kind === "label-reset" && labelHit.key) {
      state.labelOverrides.delete(labelHit.key);
      state.labelAutoPins.delete(labelHit.key);
      draw();
      return;
    }
    if (labelHit) return;
    const hit = hitTestBody(x, y);
    if (!hit?.id || !hit?.kind) return;
    const allowBodyFocus = chkClickFocusBodies?.checked !== false;
    const allowStarFocus = chkClickFocusStar?.checked !== false;
    if (hit.kind === "star" && !allowStarFocus) return;
    if ((hit.kind === "planet" || hit.kind === "gasGiant") && !allowBodyFocus) return;
    const snapshot = getSnapshot();
    setFocusTarget(hit.kind, hit.id, snapshot);
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
      const dpr = state.canvasDpr || window.devicePixelRatio || 1;
      const cx = canvas.width / dpr / 2 + state.panX;
      const cy = canvas.height / dpr / 2 + state.panY;
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
              state.activityTime += deltaTimeSec * state.speed;
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
    if (offscaleNoteEl?.style.display !== "none") {
      offscaleNoteEl.style.top = `${getOffscaleNoticeTopPx()}px`;
    }
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
    chkLabelLeaders,
    chkMoons,
    chkOrbits,
    chkHz,
    chkDebris,
    chkEccentric,
    chkPeAp,
    chkHill,
    chkLagrange,
    chkFrost,
    chkDistances,
    chkGrid,
    chkRotation,
    chkAxialTilt,
    chkClickFocusBodies,
    chkClickFocusStar,
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
    state.activityTime += dt * state.speed;
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
  /* Initialise based on start mode */
  if (state.mode === "cluster") {
    refreshClusterSnapshot();
    state.yaw = CLUSTER_DEFAULT_YAW;
    state.pitch = CLUSTER_DEFAULT_PITCH;
    state.zoom = CLUSTER_DEFAULT_ZOOM;
  }

  async function initialiseNativeRenderer() {
    try {
      const THREE = await loadThreeCore();
      if (disposed || !root.isConnected) return false;
      const renderer = new THREE.WebGLRenderer({
        canvas,
        antialias: true,
        alpha: false,
        preserveDrawingBuffer: true,
      });
      renderer.setPixelRatio(1);
      if (THREE.SRGBColorSpace) renderer.outputColorSpace = THREE.SRGBColorSpace;
      const scene = new THREE.Scene();
      const systemGroup = new THREE.Group();
      const clusterGroup = new THREE.Group();
      scene.add(systemGroup);
      scene.add(clusterGroup);
      const cameraSystem = new THREE.OrthographicCamera(-100, 100, 100, -100, -2000, 2000);
      cameraSystem.position.set(0, 0, 40);
      cameraSystem.lookAt(0, 0, 0);
      const cameraCluster = new THREE.PerspectiveCamera(45, 1, 0.1, 5000);
      scene.add(new THREE.AmbientLight(0x7f9dce, 0.28));
      const key = new THREE.DirectionalLight(0xffffff, 0.8);
      key.position.set(-2, 1.4, 2.4);
      scene.add(key);
      nativeThree = {
        THREE,
        renderer,
        scene,
        systemGroup,
        clusterGroup,
        cameraSystem,
        cameraCluster,
        loader: new THREE.TextureLoader(),
      };
      resizeCanvas(true);
      draw();
      return true;
    } catch (err) {
      console.warn(
        "[WorldSmith] Native Three visualiser unavailable, falling back to compatibility renderer.",
        err,
      );
      return false;
    }
  }

  async function initialiseRenderer() {
    await initialiseNativeRenderer();
  }
  initialiseRenderer();
}

// EOF
