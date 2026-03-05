import { calcGasGiant } from "../engine/gasGiant.js";
import { calcPlanetExact } from "../engine/planet.js";
import { calcStar } from "../engine/star.js";
import { calcSystem } from "../engine/system.js";
import { fmt } from "../engine/utils.js";
import { bindNumberAndSlider } from "./bind.js";
import { downloadCanvasPng, makeTimestampToken } from "./canvasExport.js";
import { styleLabel } from "./gasGiantStyles.js";
import { computeRockyVisualProfile } from "./rockyPlanetStyles.js";
import { calcMoonExact } from "../engine/moon.js";
import { attachTooltips, tipIcon } from "./tooltip.js";
import { escapeHtml } from "./uiHelpers.js";
import { drawSystemPosterNative, disposeSystemPosterNative } from "./systemPosterNativeThree.js";
import {
  loadWorld,
  updateWorld,
  listPlanets,
  listMoons,
  getStarOverrides,
  assignPlanetToSlot,
  assignMoonToPlanet,
  selectPlanet,
  selectMoon,
  togglePlanetLock,
  toggleMoonLock,
  listSystemGasGiants,
  listSystemDebrisDisks,
  setOrbitMode,
} from "./store.js";
import { createTutorial } from "./tutorial.js";

const TIP_LABEL = {
  "Orbit Placement Mode":
    "Guided mode generates logarithmically-spaced orbit slots from Spacing Factor and Orbit 1; planets are assigned to slots via drag-and-drop.\n\n" +
    "Manual mode disables the slot system\u2014each planet\u2019s semi-major axis is set directly on the Planets page.\n\n" +
    "Switching from Guided to Manual copies each planet\u2019s slot distance into its semi-major axis input.",
  "Star Mass": "Star mass in solar masses (read-only; set on the Star page).\n\nSun = 1 Msol.",
  "Habitable Zone":
    "A planet orbiting within this region receives Earth-like stellar heating.\n\nUses a temperature-dependent model where the inner/outer flux thresholds (S_in/S_out) vary with stellar effective temperature, based on Chromant\u2019s Desmos correction.",
  "Star Luminosity": "Stellar luminosity in solar luminosities.\n\nSun = 1 Lsol.",
  "Star Radius": "Stellar radius in solar radii.\n\nSun = 1 Rsol.",
  "Star Density": "Mean stellar density in solar densities.\n\nSun = 1 Dsol.",
  "Habitable Zone (Inner)":
    "Inner boundary of the habitable zone in AU, from the temperature-dependent HZ model.\n\n1 AU = ~150,000,000 km.",
  "Habitable Zone (Outer)":
    "Outer boundary of the habitable zone in AU, from the temperature-dependent HZ model.\n\n1 AU = ~150,000,000 km.",
  "H2O Frost Line":
    "Distance from the star beyond which volatile compounds (water, ammonia, methane, CO\u2082) can exist as ices.\n\nGas giants may only be placed beyond the frost line.",
  "Spacing Factor":
    "Logarithmic spacing factor for Bode\u2019s-law orbit generation. Higher values spread orbits farther apart.\n\nSolar System value: 0.3.",
  "System Inner Limit":
    "Inner limit of the planetary system, set by the Roche limit. No planet can orbit closer than this distance.",
  "Orbit 1":
    "Semi-major axis of the first (innermost) orbit slot in AU. Must be beyond the System Inner Limit.",
  "Orbit 2":
    "Additional stable orbit slots generated from the Bode\u2019s-law spacing.\n\nGreen slots fall within the habitable zone and suit Earth-like planets. Grey slots lie beyond the H\u2082O frost line and suit gas giants. The first grey orbit is typically the primary gas giant\u2019s slot.\n\nSlots within 0.15 AU of an adjacent orbit are too close for a stable planet. All other slots may be filled or left empty.",
  "Debris Disk": "Debris disk regions in your system. Managed on the Other Objects tab.",
  "Planets in system":
    "Assign created inner planets to valid orbital slots. Each slot can hold at most one planet.",
  "Orbit slots":
    "These are the currently available orbital slots for inner planets after gas giant and debris constraints are applied.",
  "Orbit Slots (AU)": "List of generated orbit distances in astronomical units.",
  Name: "Name used in system lists, visualiser labels, and exports.",
  Orbit: "Orbital distance from the star in astronomical units (AU).",
  "Visual style": "Visualiser-only appearance preset for gas giant markers.",
  "Outer debris disk name": "Name used for the computed outer debris disk.",
  "Inner debris disk name": "Name used for the optional inner debris disk.",
  "Inner edge": "Inner boundary of the debris disk in astronomical units (AU).",
  "Outer edge": "Outer boundary of the debris disk in astronomical units (AU).",
  "System poster":
    "Visual lineup of all bodies in the system, arranged left-to-right by orbital distance. " +
    "Body sizes use a power-law scale so rocky planets remain visible next to gas giants. " +
    "The green band marks the habitable zone; the dashed line marks the H\u2082O frost line.",
};

/* ── System Poster ────────────────────────────────────── */

const EARTH_R_KM = 6371;
const MOON_R_KM = 1737.4;

function drawSystemPoster(canvas, data, opts = {}) {
  if (!canvas) return;
  drawSystemPosterNative(
    canvas,
    data,
    opts,
    typeof opts.onReady === "function" ? opts.onReady : null,
  );
}

function orbitSlotToleranceAu(slotAu) {
  return Math.max(0.05, slotAu * 0.02);
}

const TUTORIAL_STEPS = [
  {
    title: "Getting Started",
    body:
      "The System page arranges planets and moons into orbital slots around " +
      "your star. Use the system poster at the top for a visual overview, and " +
      "the panels below to configure placement.",
  },
  {
    title: "Orbit Spacing",
    body:
      "In Guided mode, Spacing Factor and Orbit 1 control logarithmic orbit " +
      "slot placement. Adjust them to space out your planets realistically. " +
      "The slot list shows generated positions in AU.",
  },
  {
    title: "Assigning Bodies",
    body:
      "Drag planets from the Unassigned list into orbit slots. Green slots " +
      "are in the habitable zone; grey slots lie beyond the frost line. Each " +
      "slot holds one body.",
  },
  {
    title: "Moons and Locking",
    body:
      "Drag moons onto planets to assign them. Lock bodies with the lock " +
      "icon to prevent accidental reassignment. Edit buttons jump to the " +
      "Planet or Moon detail page.",
  },
  {
    title: "System Poster",
    body:
      "The poster visualises your full system. Toggle labels, moons, " +
      "habitable zone, frost line, debris disks, and guides. Switch between " +
      "logarithmic and linear scale. Export as PNG.",
  },
];

export function initSystemPage(mountEl) {
  const defaults = {
    spacingFactor: 0.33,
    orbit1Au: 0.62,
  };

  const world = loadWorld();
  const state = {
    starMassMsol: Number(world.star.massMsol),
    spacingFactor: Number.isFinite(world.system.spacingFactor)
      ? Number(world.system.spacingFactor)
      : defaults.spacingFactor,
    orbit1Au: Number.isFinite(world.system.orbit1Au)
      ? Number(world.system.orbit1Au)
      : defaults.orbit1Au,
  };

  const wrap = document.createElement("div");
  wrap.className = "page";
  wrap.innerHTML = `
    <div class="panel">
      <div class="panel__header">
        <h1 class="panel__title"><span class="ws-icon icon--system" aria-hidden="true"></span><span>Planetary System</span></h1>
        <button id="sysTutorials" type="button" class="ws-tutorial-trigger">Tutorials</button>
      </div>
      <div class="panel__body">
        <div class="hint">Tune Spacing Factor and Orbit 1 to generate slot spacing, then assign inner planets to available orbit slots.</div>
      </div>
    </div>

    <div class="panel" id="posterPanel">
      <div class="panel__header" style="cursor:pointer" id="posterToggleHeader">
        <h2>System Poster ${tipIcon(TIP_LABEL["System poster"])}</h2>
        <div style="margin-left:auto;display:flex;gap:6px;align-items:center">
          <button class="small" type="button" id="btn-poster-export" title="Export PNG">Export PNG</button>
          <button class="small" type="button" id="btn-poster-fs" title="Fullscreen">Fullscreen</button>
          <button class="small" type="button" id="btn-poster-collapse" title="Toggle poster">&#x25B2;</button>
        </div>
      </div>
      <div class="panel__body" id="posterBody">
        <div class="poster-controls" id="posterControls">
          <div class="poster-controls__row poster-controls__checks">
            <label class="viz-check"><input id="pchk-labels" type="checkbox" checked /><span>Labels</span></label>
            <label class="viz-check"><input id="pchk-moons" type="checkbox" checked /><span>Moons</span></label>
            <label class="viz-check"><input id="pchk-hz" type="checkbox" checked /><span>Habitable zone</span></label>
            <label class="viz-check"><input id="pchk-frost" type="checkbox" checked /><span>Frost line</span></label>
            <label class="viz-check"><input id="pchk-debris" type="checkbox" checked /><span>Debris disks</span></label>
            <label class="viz-check"><input id="pchk-guides" type="checkbox" checked /><span>Orbital guides</span></label>
            <label class="viz-check"><input id="pchk-starfield" type="checkbox" checked /><span>Starfield</span></label>
          </div>
          <div class="poster-controls__row">
            <div class="pill-toggle-wrap" style="min-width:260px">
              <div class="physics-duo-toggle" data-toggle="posterScale">
                <input type="radio" name="posterScale" id="pscale-log" value="log" checked />
                <label for="pscale-log">Logarithmic</label>
                <input type="radio" name="posterScale" id="pscale-lin" value="linear" />
                <label for="pscale-lin">Linear</label>
                <span></span>
              </div>
            </div>
          </div>
        </div>
        <div class="system-poster-wrap" id="posterWrap">
          <canvas id="systemPoster"></canvas>
        </div>
      </div>
    </div>

    <div class="grid-2">
      <div class="panel">
        <div class="panel__header"><h2>Inputs</h2></div>
        <div class="panel__body">

          <div class="label">Orbit Placement ${tipIcon(TIP_LABEL["Orbit Placement Mode"] || "")}</div>
          <div class="hint">Guided uses generated orbit slots. Manual sets orbit per-planet.</div>
          <div class="pill-toggle-wrap" style="min-width:260px">
            <div class="physics-duo-toggle" data-toggle="orbitMode">
              <input type="radio" name="orbitMode" id="omode-guided" value="guided" checked />
              <label for="omode-guided">Guided</label>
              <input type="radio" name="orbitMode" id="omode-manual" value="manual" />
              <label for="omode-manual">Manual</label>
              <span></span>
            </div>
          </div>

          <div style="height:10px"></div>

          <div class="label">Derived Data ${tipIcon(TIP_LABEL["Star Mass"] || "")}</div>
          <div class="hint">Read-only. Change it on the Star tab.</div>
          <div class="derived-readout" id="massDisplay"></div>

          <div id="guidedInputs">
            <div style="height:8px"></div>

            ${numWithSlider("spacing", "Spacing Factor", "", "Controls orbit slot spacing.", 0, 10, 0.01)}
            ${numWithSlider("orbit1", "Orbit 1", "AU", "First orbit slot.", 0.0001, 1000000, 0.01)}

            <div style="height:10px"></div>
            <div class="hint">Gas giants are managed on the <a href="#/planet">Planets</a> tab. Debris disks are managed on the <a href="#/outer">Other Objects</a> tab.</div>

            <div class="button-row">
              <button id="btn-sol">Sol-ish Preset</button>
              <button id="btn-reset">Reset to Defaults</button>
            </div>

            <div class="hint" style="margin-top:10px">
              Tip: adjust Orbit 1 and Spacing to get a nice distribution of orbit slots around the habitable zone.
            </div>
          </div>
        </div>
      </div>

      <div class="panel">
        <div class="panel__header"><h2>Outputs</h2></div>
        <div class="panel__body">
          <div class="kpi-grid" id="kpis"></div>

          <div style="margin-top:14px">
            <div id="guidedOutputs">
              <div class="label">Planets in system ${tipIcon(TIP_LABEL["Planets in system"] || "")}</div>
              <div class="hint">Drag planets into orbit slots. One planet per slot.</div>
              <div class="dropzone" id="unassignedZone">
                <div class="dropzone-title">Unassigned planets</div>
                <div id="unassignedPlanets"></div>
              </div>

              <div style="height:10px"></div>
              <div class="dropzone" id="unassignedMoonsZone">
                <div class="dropzone-title">Unassigned moons</div>
                <div id="unassignedMoons"></div>
              </div>

              <div style="height:14px"></div>
              <div class="label">Orbit slots ${tipIcon(TIP_LABEL["Orbit slots"] || "")}</div>
              <div class="hint">One planet per slot. Manage planets on the Planets tab.</div>
              <div id="slotsUi" style="margin-top:10px"></div>

              <div style="height:10px"></div>
              <div class="label">Derived orbit slots (AU) ${tipIcon(TIP_LABEL["Orbit Slots (AU)"] || "")}</div>
              <div class="hint">Generated orbit positions (1-20).</div>
              <div class="derived-readout" id="orbits"></div>
            </div>

            <div id="manualOutputs" style="display:none">
              <div class="label">Bodies by orbit</div>
              <div class="hint">Sorted by semi-major axis. Edit orbits on the Planets tab.</div>
              <div id="manualBodyList" style="margin-top:10px"></div>
            </div>
          </div>
        </div>
      </div>
    </div>

  `;
  mountEl.appendChild(wrap);
  attachTooltips(wrap);
  createTutorial({
    steps: TUTORIAL_STEPS,
    storageKey: "worldsmith.system.tutorial",
    container: wrap,
    triggerBtn: wrap.querySelector("#sysTutorials"),
  });

  const massDisplay = wrap.querySelector("#massDisplay");

  const spacingEl = wrap.querySelector("#spacing");
  const orbit1El = wrap.querySelector("#orbit1");

  const kpisEl = wrap.querySelector("#kpis");
  const unassignedEl = wrap.querySelector("#unassignedPlanets");
  const unassignedMoonsEl = wrap.querySelector("#unassignedMoons");
  const slotsUiEl = wrap.querySelector("#slotsUi");
  const orbitsEl = wrap.querySelector("#orbits");
  const guidedInputsEl = wrap.querySelector("#guidedInputs");
  const guidedOutputsEl = wrap.querySelector("#guidedOutputs");
  const manualOutputsEl = wrap.querySelector("#manualOutputs");
  const manualBodyListEl = wrap.querySelector("#manualBodyList");
  const posterCanvas = wrap.querySelector("#systemPoster");
  const posterWrap = wrap.querySelector("#posterWrap");
  const posterBody = wrap.querySelector("#posterBody");
  const posterPanel = wrap.querySelector("#posterPanel");
  let posterRendererReady = false;

  const posterUnmountObserver = new MutationObserver(() => {
    if (wrap.isConnected) return;
    disposeSystemPosterNative(posterCanvas);
    try {
      posterUnmountObserver.disconnect();
    } catch {}
  });
  posterUnmountObserver.observe(document.body, { childList: true, subtree: true });

  // Poster display state
  const posterState = {
    labels: true,
    moons: true,
    hz: true,
    frost: true,
    debris: true,
    guides: true,
    starfield: true,
    scale: "log", // "log" or "linear"
    collapsed: false,
  };

  // Collapse toggle
  const collapseBtn = wrap.querySelector("#btn-poster-collapse");
  const collapseBtnDefaultTitle = collapseBtn?.getAttribute("title") || "Toggle poster";
  wrap.querySelector("#posterToggleHeader").addEventListener("click", (e) => {
    if (collapseBtn?.disabled) return;
    if (e.target.closest("button") && e.target.closest("button") !== collapseBtn) return;
    posterState.collapsed = !posterState.collapsed;
    posterBody.style.display = posterState.collapsed ? "none" : "";
    collapseBtn.innerHTML = posterState.collapsed ? "&#x25BC;" : "&#x25B2;";
  });

  // Export PNG
  wrap.querySelector("#btn-poster-export").addEventListener("click", async (e) => {
    e.stopPropagation();
    const fn = `worldsmith-system-poster-${makeTimestampToken()}.png`;
    await downloadCanvasPng(posterCanvas, fn);
  });

  // Fullscreen
  const btnPosterFs = wrap.querySelector("#btn-poster-fs");
  function isPosterFullscreen() {
    const fsEl = document.fullscreenElement || document.webkitFullscreenElement;
    return fsEl === posterPanel;
  }
  btnPosterFs.addEventListener("click", (e) => {
    e.stopPropagation();
    if (isPosterFullscreen()) {
      if (document.exitFullscreen) document.exitFullscreen();
      else if (document.webkitExitFullscreen) document.webkitExitFullscreen();
    } else if (posterPanel.requestFullscreen) {
      posterPanel.requestFullscreen();
    } else if (posterPanel.webkitRequestFullscreen) {
      posterPanel.webkitRequestFullscreen();
    }
  });
  function onPosterFullscreenChange() {
    const isFs = isPosterFullscreen();
    btnPosterFs.textContent = isFs ? "Exit" : "Fullscreen";
    if (collapseBtn) {
      collapseBtn.disabled = isFs;
      collapseBtn.title = isFs ? "Hide/show disabled in fullscreen" : collapseBtnDefaultTitle;
    }
    posterCanvas.style.width = "";
    posterCanvas.style.height = "";
    requestAnimationFrame(() => drawPoster());
  }
  document.addEventListener("fullscreenchange", onPosterFullscreenChange);
  document.addEventListener("webkitfullscreenchange", onPosterFullscreenChange);
  onPosterFullscreenChange();

  // Checkbox toggles
  const posterChecks = {
    labels: wrap.querySelector("#pchk-labels"),
    moons: wrap.querySelector("#pchk-moons"),
    hz: wrap.querySelector("#pchk-hz"),
    frost: wrap.querySelector("#pchk-frost"),
    debris: wrap.querySelector("#pchk-debris"),
    guides: wrap.querySelector("#pchk-guides"),
    starfield: wrap.querySelector("#pchk-starfield"),
  };
  for (const [key, el] of Object.entries(posterChecks)) {
    el.addEventListener("change", () => {
      posterState[key] = el.checked;
      drawPoster();
    });
  }

  // Scale toggle
  wrap.querySelector('[data-toggle="posterScale"]').addEventListener("change", (e) => {
    posterState.scale = e.target.value;
    drawPoster();
  });

  // Cached poster data for redraws from controls
  let cachedPosterData = null;
  function drawPoster() {
    if (!posterRendererReady || !cachedPosterData) return;
    drawSystemPoster(posterCanvas, cachedPosterData, { ...posterState });
  }

  function initPosterRenderer() {
    posterRendererReady = true;
    drawPoster();
  }

  // Bind sliders
  bindPair("spacing", spacingEl, 0, 10, 0.01, "auto");
  bindPair("orbit1", orbit1El, 0.0001, 1000000, 0.01, "auto");

  function bindPair(id, numberEl, min, max, step, mode) {
    const sliderEl = wrap.querySelector(`#${id}_slider`);
    const minEl = wrap.querySelector(`#${id}_min`);
    const maxEl = wrap.querySelector(`#${id}_max`);
    minEl.textContent = String(min);
    maxEl.textContent = String(max);
    bindNumberAndSlider({ numberEl, sliderEl, min, max, step, mode });
  }

  let isRendering = false;

  function getGasGiants(w) {
    return listSystemGasGiants(w).sort((a, b) => a.au - b.au);
  }

  function getDebrisDisks(w) {
    return listSystemDebrisDisks(w);
  }

  function mapGasGiantsToSlots(orbitsAu, gasGiants) {
    const bySlot = new Map();
    const usedSlots = new Set();
    const sorted = [...gasGiants].sort((a, b) => a.au - b.au);
    for (const giant of sorted) {
      let bestSlot = null;
      let bestDiff = Infinity;
      for (let i = 0; i < orbitsAu.length; i++) {
        const slot = i + 1;
        if (usedSlots.has(slot)) continue;
        const diff = Math.abs(orbitsAu[i] - giant.au);
        if (diff < bestDiff) {
          bestDiff = diff;
          bestSlot = slot;
        }
      }
      if (bestSlot == null) continue;
      const slotAu = orbitsAu[bestSlot - 1];
      const tol = orbitSlotToleranceAu(slotAu);
      if (bestDiff <= tol || !Number.isFinite(tol)) {
        bySlot.set(bestSlot, giant);
        usedSlots.add(bestSlot);
        continue;
      }
      // If no slot is close enough, still map to nearest slot so the giant replaces one row.
      bySlot.set(bestSlot, giant);
      usedSlots.add(bestSlot);
    }
    return bySlot;
  }

  function syncFromWorld() {
    const w = loadWorld();
    state.starMassMsol = Number(w.star.massMsol);
    massDisplay.textContent = `Star Mass: ${fmt(state.starMassMsol, 4)} Msol`;
  }

  function render() {
    if (isRendering) return;
    isRendering = true;
    try {
      syncFromWorld();

      const w0 = loadWorld();

      const sov = getStarOverrides(w0.star);
      const starModel = calcStar({
        massMsol: state.starMassMsol,
        ageGyr: Number(w0.star.ageGyr) || 4.6,
        metallicityFeH: Number(w0.star.metallicityFeH) || 0,
        radiusRsolOverride: sov.r,
        luminosityLsolOverride: sov.l,
        tempKOverride: sov.t,
        evolutionMode: sov.ev,
      });

      const model = calcSystem({
        starMassMsol: state.starMassMsol,
        spacingFactor: state.spacingFactor,
        orbit1Au: state.orbit1Au,
        luminosityLsolOverride: starModel.luminosityLsol,
        radiusRsolOverride: starModel.radiusRsol,
      });

      const items = [
        { label: "Habitable Zone", value: model.display.hzAu, meta: "AU" },
        { label: "H2O Frost Line", value: model.display.frostAu, meta: "AU" },
        { label: "System Inner Limit", value: model.display.innerLimitAu, meta: "AU" },
        { label: "Star Luminosity", value: fmt(model.star.luminosityLsol, 3), meta: "Lsol" },
        { label: "Star Radius", value: fmt(model.star.radiusRsol, 3), meta: "Rsol" },
      ];

      kpisEl.innerHTML = items
        .map(
          (x) => `
      <div class="kpi-wrap">
        <div class="kpi">
          <div class="kpi__label">${x.label} ${tipIcon(TIP_LABEL[x.tipLabel] || TIP_LABEL[x.label] || "")}</div>
          <div class="kpi__value">${x.value}</div>
          <div class="kpi__meta">${x.meta}</div>
        </div>
      </div>
    `,
        )
        .join("");

      // ── Orbit mode UI toggle ──
      const orbitMode = w0.system.orbitMode || "guided";
      const isManual = orbitMode === "manual";
      const guidedRadio = wrap.querySelector("#omode-guided");
      const manualRadio = wrap.querySelector("#omode-manual");
      if (guidedRadio) guidedRadio.checked = !isManual;
      if (manualRadio) manualRadio.checked = isManual;
      guidedInputsEl.style.display = isManual ? "none" : "";
      guidedOutputsEl.style.display = isManual ? "none" : "";
      manualOutputsEl.style.display = isManual ? "" : "none";

      // Planet assignment UI
      const w = w0;
      const planets = listPlanets(w);

      // Build ordered orbit items with slot replacement by gas giants.
      const gasGiants = getGasGiants(w0);
      const gasBySlot = mapGasGiantsToSlots(model.orbitsAu, gasGiants);
      const debrisRows = getDebrisDisks(w0)
        .filter((d) => d.innerAu > 0 && d.outerAu > 0)
        .map((d) => ({
          id: d.id,
          name: d.name,
          inner: Math.min(d.innerAu, d.outerAu),
          outer: Math.max(d.innerAu, d.outerAu),
        }));

      const maxGasAu = gasGiants.length ? Math.max(...gasGiants.map((g) => Number(g.au) || 0)) : 0;
      const maxDebrisAu = debrisRows.length
        ? Math.max(...debrisRows.map((d) => Number(d.outer) || 0))
        : 0;
      const cutoffAu = Math.max(maxGasAu, maxDebrisAu, 0);

      const orbitItems = [];
      for (let i = 0; i < model.orbitsAu.length; i++) {
        const slotAu = model.orbitsAu[i];
        const slot = i + 1;
        if (cutoffAu > 0 && slotAu > cutoffAu) continue;
        const giant = gasBySlot.get(slot);
        if (giant) {
          orbitItems.push({ type: "gas", slot, au: Number(giant.au) || slotAu, giant });
        } else {
          orbitItems.push({ type: "slot", slot, au: slotAu });
        }
      }
      for (const disk of debrisRows) {
        const mid = (disk.inner + disk.outer) / 2;
        orbitItems.push({ type: "debris", au: mid, ...disk });
      }
      orbitItems.sort((a, b) => a.au - b.au);

      // Keep persisted assignments valid when slots get replaced/cut off.
      const validSlots = new Set(
        orbitItems.filter((it) => it.type === "slot").map((it) => it.slot),
      );
      const invalidAssignments = planets.filter(
        (p) => p.slotIndex != null && !validSlots.has(p.slotIndex),
      );
      if (invalidAssignments.length) {
        for (const p of invalidAssignments) assignPlanetToSlot(p.id, null);
      }
      let worldForUi = w;
      let planetsForUi = planets;
      if (invalidAssignments.length) {
        worldForUi = loadWorld();
        planetsForUi = listPlanets(worldForUi);
      }
      const moonsForUi = listMoons(worldForUi);
      const planetsById = worldForUi?.planets?.byId || {};
      const moonsByPlanet = new Map();
      for (const moon of moonsForUi) {
        const pid = moon?.planetId;
        if (!pid) continue;
        if (!moonsByPlanet.has(pid)) moonsByPlanet.set(pid, []);
        moonsByPlanet.get(pid).push(moon);
      }
      for (const list of moonsByPlanet.values()) list.sort(sortMoonsByOrbitKm);
      const moonCountByPlanet = new Map();
      for (const [pid, list] of moonsByPlanet.entries()) {
        moonCountByPlanet.set(pid, list.length);
      }
      const renderCtx = { planetsById, moonsByPlanet, moonCountByPlanet };

      // Unassigned list
      unassignedEl.innerHTML = "";
      const unassigned = planetsForUi.filter((p) => p.slotIndex == null);
      if (!unassigned.length) {
        unassignedEl.innerHTML = `<div class="hint">No unassigned planets.</div>`;
      } else {
        unassignedEl.innerHTML = unassigned
          .map((p) => planetCardHtml(p, model, { moonCountByPlanet }))
          .join("");
      }

      unassignedMoonsEl.innerHTML = "";
      const unassignedMoons = moonsForUi.filter((m) => m.planetId == null).sort(sortMoonsByOrbitKm);
      if (!unassignedMoons.length) {
        unassignedMoonsEl.innerHTML = `<div class="hint">No unassigned moons.</div>`;
      } else {
        unassignedMoonsEl.innerHTML = `<div class="moon-list moon-list--unassigned">${unassignedMoons.map((m) => moonCardHtml(m, { showParent: false, planetsById })).join("")}</div>`;
      }

      const starRow = `
      <div class="slot-row">
        <div class="slot-title">Star</div>
        <div class="dropzone" style="cursor:default">
          <div class="hint">${fmt(state.starMassMsol, 4)} Msol primary</div>
        </div>
      </div>
    `;
      const orbitRows = orbitItems
        .map((it) => {
          if (it.type === "slot") {
            const slot = it.slot;
            const au = it.au;
            const occupant = planetsForUi.find((p) => p.slotIndex === slot);
            const title = `Slot ${String(slot).padStart(2, "0")} (${fmt(au, 3)} AU)`;
            return `
          <div class="slot-row">
            <div class="slot-title">${title}</div>
            <div class="dropzone slot-drop" data-slot="${slot}">
              ${occupant ? slotPlanetWithMoonsHtml(occupant, model, renderCtx) : `<div class="hint">Drop a planet here.</div>`}
            </div>
          </div>
        `;
          }

          if (it.type === "gas") {
            const g = it.giant;
            const title = `${escapeHtml(g.name || "Gas giant")} (Slot ${String(it.slot).padStart(2, "0")} - ${fmt(Number(g.au) || it.au, 3)} AU)`;
            return `
          <div class="slot-row">
            <div class="slot-title">${title}</div>
            <div class="dropzone" style="cursor:default">
              <div class="hint">Gas giant marker (${escapeHtml(styleLabel(g.style || "jupiter"))}).</div>
            </div>
          </div>
        `;
          }

          const title = `${escapeHtml(it.name || "Debris disk")} (${fmt(it.inner, 2)} - ${fmt(it.outer, 2)} AU)`;
          return `
        <div class="slot-row">
          <div class="slot-title">${title}</div>
          <div class="dropzone" style="cursor:default">
            <div class="hint">Asteroid belt / debris disk region.</div>
          </div>
        </div>
      `;
        })
        .join("");
      slotsUiEl.innerHTML = starRow + orbitRows;
      // Attach DnD handlers
      setupDnD();

      orbitsEl.textContent = model.orbitsAu
        .map((v, i) => `Orbit ${String(i + 1).padStart(2, "0")}: ${fmt(v, 3)} AU`)
        .join("\n");

      // ── Manual mode: sorted body list ──
      if (isManual) {
        const allBodies = [];
        for (const p of planetsForUi) {
          const au = Number(p.inputs?.semiMajorAxisAu) || 0;
          allBodies.push({
            kind: "Rocky planet",
            name: p.name || p.id,
            au,
            auLabel: `${fmt(au, 3)} AU`,
          });
        }
        for (const g of gasGiants) {
          const au = Number(g.au) || 0;
          allBodies.push({
            kind: "Gas giant",
            name: g.name || g.id,
            au,
            auLabel: `${fmt(au, 3)} AU`,
          });
        }
        for (const d of debrisRows) {
          const mid = (d.inner + d.outer) / 2;
          allBodies.push({
            kind: "Debris disk",
            name: d.name || "Debris disk",
            au: mid,
            auLabel: `${fmt(d.inner, 2)}\u2013${fmt(d.outer, 2)} AU`,
          });
        }
        allBodies.sort((a, b) => a.au - b.au);
        manualBodyListEl.innerHTML = allBodies.length
          ? allBodies
              .map(
                (b) => `
            <div class="slot-row">
              <div class="slot-title">${escapeHtml(b.name)} (${escapeHtml(b.auLabel)})</div>
              <div class="dropzone" style="cursor:default">
                <div class="hint">${escapeHtml(b.kind)}</div>
              </div>
            </div>`,
              )
              .join("")
          : `<div class="hint">No bodies created yet.</div>`;
      }

      // ── System Poster ──────────────────────────────
      const posterPlanets = planetsForUi
        .filter((p) => (isManual ? true : p.slotIndex != null))
        .map((p) => {
          const au = isManual
            ? Number(p.inputs?.semiMajorAxisAu) || 0
            : model.orbitsAu[p.slotIndex - 1];
          let dayHex = "#9bbbe0";
          let horizonHex = "#6a6a6a";
          let radiusKm = EARTH_R_KM;
          let visualProfile = null;
          try {
            const planetInputs = isManual ? p.inputs : { ...p.inputs, semiMajorAxisAu: au };
            const pm = calcPlanetExact({
              starMassMsol: state.starMassMsol,
              starAgeGyr: Number(w.star.ageGyr) || 4.6,
              starRadiusRsolOverride: sov.r,
              starLuminosityLsolOverride: sov.l,
              starTempKOverride: sov.t,
              starEvolutionMode: sov.ev,
              planet: planetInputs,
            });
            dayHex = pm.derived.skyColourDayHex || dayHex;
            horizonHex = pm.derived.skyColourHorizonHex || horizonHex;
            radiusKm = pm.derived.radiusKm || radiusKm;
            visualProfile = computeRockyVisualProfile(pm.derived, p.inputs);
          } catch {
            /* use defaults */
          }
          return {
            id: p.id,
            name: p.name,
            au,
            radiusKm,
            dayHex,
            horizonHex,
            visualProfile,
          };
        });

      const posterGiants = gasGiants.map((g) => {
        let radiusKm = (g.radiusRj || 1) * 69911;
        let gasCalc = null;
        try {
          gasCalc = calcGasGiant({
            massMjup: g.massMjup,
            radiusRj: g.radiusRj,
            orbitAu: g.au,
            rotationPeriodHours: g.rotationPeriodHours || 10,
            metallicity: g.metallicity,
            starMassMsol: state.starMassMsol,
            starLuminosityLsol: starModel.luminosityLsol,
            starAgeGyr: Number(w.star.ageGyr) || 4.6,
            starRadiusRsol: starModel.radiusRsol,
            stellarMetallicityFeH: Number(w.star.metallicityFeH) || 0,
          });
          radiusKm = gasCalc.physical.radiusKm || radiusKm;
        } catch {
          /* use default */
        }
        return {
          id: g.id,
          name: g.name,
          au: g.au,
          radiusKm,
          style: g.style,
          rings: g.rings,
          gasCalc,
        };
      });

      const posterStarAge = Number(w.star.ageGyr) || 4.6;
      const gasGiantsById = new Map(gasGiants.map((g) => [g.id, g]));
      const correctedInputsByPlanetId = new Map();
      if (!isManual) {
        for (const p of planetsForUi) {
          if (p.slotIndex != null) {
            const slotAu = model.orbitsAu[p.slotIndex - 1];
            correctedInputsByPlanetId.set(p.id, { ...p.inputs, semiMajorAxisAu: slotAu });
          }
        }
      }
      const posterMoons = moonsForUi
        .filter((m) => m.planetId)
        .map((m) => {
          let radiusMoon = 0.1;
          const densG = Number(m.inputs?.densityGcm3);
          const massM = Number(m.inputs?.massMoon);
          if (densG > 0 && massM > 0) {
            const earthMoonMassKg = 7.342e22;
            const massKg = massM * earthMoonMassKg;
            radiusMoon = Math.cbrt((3 * massKg) / (4 * Math.PI * densG * 1000)) / MOON_R_KM;
          }
          let moonCalc = null;
          try {
            const parentPlanetInputs =
              correctedInputsByPlanetId.get(m.planetId) || planetsById[m.planetId]?.inputs;
            const parentGg = gasGiantsById.get(m.planetId);
            if (parentPlanetInputs) {
              moonCalc = calcMoonExact({
                starMassMsol: state.starMassMsol,
                starAgeGyr: posterStarAge,
                starRadiusRsolOverride: sov.r,
                starLuminosityLsolOverride: sov.l,
                starTempKOverride: sov.t,
                starEvolutionMode: sov.ev,
                planet: parentPlanetInputs,
                moon: { ...m.inputs },
              });
            } else if (parentGg) {
              const gm = calcGasGiant({
                massMjup: parentGg.massMjup,
                radiusRj: parentGg.radiusRj,
                orbitAu: parentGg.au,
                rotationPeriodHours: parentGg.rotationPeriodHours || 10,
                metallicity: parentGg.metallicity,
                starMassMsol: state.starMassMsol,
                starLuminosityLsol: starModel.luminosityLsol,
                starAgeGyr: Number(w.star.ageGyr) || 4.6,
                starRadiusRsol: starModel.radiusRsol,
                stellarMetallicityFeH: Number(w.star.metallicityFeH) || 0,
              });
              moonCalc = calcMoonExact({
                starMassMsol: state.starMassMsol,
                starAgeGyr: posterStarAge,
                starRadiusRsolOverride: sov.r,
                starLuminosityLsolOverride: sov.l,
                starTempKOverride: sov.t,
                starEvolutionMode: sov.ev,
                moon: { ...m.inputs },
                parentOverride: {
                  inputs: {
                    massEarth: gm.physical.massEarth,
                    semiMajorAxisAu: gm.inputs.orbitAu,
                    eccentricity: 0,
                    rotationPeriodHours: gm.inputs.rotationPeriodHours,
                    cmfPct: 0,
                  },
                  derived: {
                    densityGcm3: gm.physical.densityGcm3,
                    radiusEarth: gm.physical.radiusEarth,
                    gravityG: gm.physical.gravityG,
                  },
                },
              });
            }
          } catch {
            moonCalc = null;
          }
          if (moonCalc) {
            const calcR = Number(moonCalc.physical?.radiusMoon);
            if (Number.isFinite(calcR) && calcR > 0) radiusMoon = calcR;
          }
          return {
            parentId: m.planetId,
            name: m.name || m.inputs?.name || "",
            radiusMoon,
            moonCalc,
          };
        });

      const posterDebris = debrisRows.map((d) => ({
        innerAu: d.inner,
        outerAu: d.outer,
        name: d.name,
      }));

      cachedPosterData = {
        star: starModel,
        system: model,
        planets: posterPlanets,
        gasGiants: posterGiants,
        moons: posterMoons,
        debrisDisks: posterDebris,
      };
      drawPoster();
    } finally {
      isRendering = false;
    }
  }

  function loadIntoInputs() {
    syncFromWorld();
    spacingEl.value = state.spacingFactor;
    orbit1El.value = state.orbit1Au;

    ["spacing", "orbit1"].forEach((id) => {
      const numberEl = wrap.querySelector(`#${id}`);
      numberEl.dispatchEvent(new Event("input", { bubbles: true }));
    });
  }

  function applyFromInputs() {
    state.spacingFactor = Number(spacingEl.value);
    state.orbit1Au = Number(orbit1El.value);

    updateWorld({
      system: {
        spacingFactor: state.spacingFactor,
        orbit1Au: state.orbit1Au,
      },
    });

    render();
  }

  // Live-update: apply on every input change
  [spacingEl, orbit1El].forEach((el) => el.addEventListener("input", applyFromInputs));

  wrap.querySelector("#btn-sol").addEventListener("click", () => {
    state.spacingFactor = 0.35;
    state.orbit1Au = 0.4;
    updateWorld({
      system: {
        spacingFactor: state.spacingFactor,
        orbit1Au: state.orbit1Au,
      },
    });
    loadIntoInputs();
    render();
  });

  wrap.querySelector("#btn-reset").addEventListener("click", () => {
    Object.assign(state, defaults);
    updateWorld({
      system: {
        spacingFactor: state.spacingFactor,
        orbit1Au: state.orbit1Au,
      },
    });
    loadIntoInputs();
    render();
  });

  // ── Orbit placement mode toggle ──
  wrap.querySelector('[data-toggle="orbitMode"]').addEventListener("change", (e) => {
    const mode = e.target.value;
    const w = loadWorld();
    const sov = getStarOverrides(w.star);
    const starModel = calcStar({
      massMsol: Number(w.star.massMsol),
      ageGyr: Number(w.star.ageGyr) || 4.6,
      metallicityFeH: Number(w.star.metallicityFeH) || 0,
      radiusRsolOverride: sov.r,
      luminosityLsolOverride: sov.l,
      tempKOverride: sov.t,
      evolutionMode: sov.ev,
    });
    const sysModel = calcSystem({
      starMassMsol: state.starMassMsol,
      spacingFactor: state.spacingFactor,
      orbit1Au: state.orbit1Au,
      luminosityLsolOverride: starModel.luminosityLsol,
      radiusRsolOverride: starModel.radiusRsol,
    });
    setOrbitMode(mode, sysModel.orbitsAu);
    render();
  });

  function sortMoonsByOrbitKm(a, b) {
    const aa = Number(a?.inputs?.semiMajorAxisKm);
    const bb = Number(b?.inputs?.semiMajorAxisKm);
    const av = Number.isFinite(aa) && aa > 0 ? aa : Infinity;
    const bv = Number.isFinite(bb) && bb > 0 ? bb : Infinity;
    return av - bv;
  }

  function moonCardHtml(m, { showParent = false, planetsById = null } = {}) {
    const moonName = escapeHtml(m.name || m.inputs?.name || m.id);
    const orbitKm = Number(m?.inputs?.semiMajorAxisKm);
    const orbitText =
      Number.isFinite(orbitKm) && orbitKm > 0 ? `${fmt(orbitKm, 0)} km` : "Orbit unknown";
    const parent = m.planetId ? planetsById?.[m.planetId] : null;
    const parentText = parent
      ? `Planet: ${parent.name || parent.inputs?.name || parent.id}`
      : "Unassigned";
    const metaText = showParent ? `${orbitText} � ${parentText}` : orbitText;
    const locked = !!m.locked;
    const canLock = m.planetId != null;

    return `
      <div class="moon-mini moon-card ${locked ? "is-locked" : ""}" draggable="${locked ? "false" : "true"}" data-moon-id="${escapeHtml(m.id)}" title="${locked ? "Locked to planet" : "Drag to reassign"}">
        <div>
          <div class="moon-mini__name">${moonName}</div>
          <div class="planet-card__meta">${escapeHtml(metaText)}</div>
        </div>
        <div class="moon-mini__actions">
          <button class="small" type="button" data-action="lock-moon" data-moon-id="${escapeHtml(m.id)}" ${canLock ? "" : "disabled"}>${locked ? "Unlock" : "Lock"}</button>
          <button class="small" type="button" data-action="edit-moon" data-moon-id="${escapeHtml(m.id)}">Edit</button>
        </div>
      </div>
    `;
  }

  function slotPlanetWithMoonsHtml(p, sysModel, renderCtx) {
    const moons = (renderCtx?.moonsByPlanet?.get(p.id) || []).slice().sort(sortMoonsByOrbitKm);
    const moonRows = moons.length
      ? moons.map((m) => moonCardHtml(m, { planetsById: renderCtx?.planetsById })).join("")
      : `<div class="hint">No moons. Drop moons here.</div>`;
    const moonHtml = `
      <div class="moon-list moon-drop-target" data-moon-drop-planet-id="${escapeHtml(p.id)}">
        ${moonRows}
      </div>
    `;

    return `
      ${planetCardHtml(p, sysModel, { showAu: false, moonCountByPlanet: renderCtx?.moonCountByPlanet })}
      ${moonHtml}
    `;
  }

  function planetCardHtml(p, sysModel, { showAu = true, moonCountByPlanet = null } = {}) {
    // find slot AU for meta
    let meta = "";
    if (showAu && p.slotIndex != null) {
      const au = sysModel.orbitsAu[p.slotIndex - 1];
      if (au != null) meta = `${fmt(au, 3)} AU`;
    }
    const moonCount = Number(moonCountByPlanet?.get(p.id) || 0);
    const slotText =
      p.slotIndex != null ? `Slot ${String(p.slotIndex).padStart(2, "0")}` : "Unassigned";
    const metaTextBase = meta ? `${slotText} � ${meta}` : slotText;
    const metaText = `${metaTextBase} � Moons: ${moonCount}`;
    const safeName = escapeHtml(p.name || p.inputs?.name || p.id);
    return `
      <div class="planet-card ${p.locked ? "is-locked" : ""} moon-drop-target" draggable="${p.locked ? "false" : "true"}" data-planet-id="${escapeHtml(p.id)}" data-moon-drop-planet-id="${escapeHtml(p.id)}" title="${p.locked ? "Locked" : "Drag to assign"}">
        <div>
          <div><b>${safeName}</b></div>
          <div class="planet-card__meta">${escapeHtml(metaText)}</div>
        </div>
        <div style="display:flex; gap:8px; align-items:center">
          <button class="small" type="button" data-action="lock" data-planet-id="${escapeHtml(p.id)}">${p.locked ? "Unlock" : "Lock"}</button>
          <button class="small" type="button" data-action="edit" data-planet-id="${escapeHtml(p.id)}">Edit</button>
        </div>
      </div>
    `;
  }
  function setupDnD() {
    // Ensure we don't double-bind
    if (wrap.__dndBound) return;
    wrap.__dndBound = true;

    let dragPayload = null;

    function getDropTarget(fromEl, payload) {
      if (!fromEl || !payload) return null;
      if (payload.type === "planet") {
        return fromEl.closest?.(".dropzone.slot-drop, #unassignedZone");
      }
      if (payload.type === "moon") {
        return fromEl.closest?.(".moon-drop-target, #unassignedMoonsZone");
      }
      return null;
    }

    function readDragPayload(e) {
      if (dragPayload?.id) return dragPayload;
      try {
        const json = e.dataTransfer.getData("application/worldsmith-drag");
        if (json) {
          const parsed = JSON.parse(json);
          if (parsed && parsed.type && parsed.id) return parsed;
        }
      } catch {}
      try {
        const id = e.dataTransfer.getData("text/plain");
        if (id) return { type: "planet", id };
      } catch {}
      return null;
    }

    wrap.addEventListener("dragstart", (e) => {
      const curWorld = loadWorld();
      if ((curWorld.system.orbitMode || "guided") === "manual") {
        e.preventDefault();
        return;
      }
      const moonCard = e.target.closest?.(".moon-card");
      if (moonCard) {
        if (moonCard.classList.contains("is-locked")) {
          e.preventDefault();
          return;
        }
        const mid = moonCard.getAttribute("data-moon-id");
        if (!mid) {
          e.preventDefault();
          return;
        }
        dragPayload = { type: "moon", id: mid };
        try {
          e.dataTransfer.setData("application/worldsmith-drag", JSON.stringify(dragPayload));
        } catch {}
        try {
          e.dataTransfer.setData("text/plain", mid);
        } catch {}
        e.dataTransfer.effectAllowed = "move";
        return;
      }

      const card = e.target.closest?.(".planet-card");
      if (!card) return;
      if (card.classList.contains("is-locked")) {
        e.preventDefault();
        return;
      }
      const pid = card.getAttribute("data-planet-id");
      if (!pid) {
        e.preventDefault();
        return;
      }
      dragPayload = { type: "planet", id: pid };
      try {
        e.dataTransfer.setData("application/worldsmith-drag", JSON.stringify(dragPayload));
      } catch {}
      try {
        e.dataTransfer.setData("text/plain", pid);
      } catch {}
      e.dataTransfer.effectAllowed = "move";
    });

    wrap.addEventListener("dragend", () => {
      dragPayload = null;
      wrap
        .querySelectorAll(
          ".dropzone.is-over, .moon-drop-target.is-over, #unassignedMoonsZone.is-over",
        )
        .forEach((el) => el.classList.remove("is-over"));
    });

    wrap.addEventListener("dragover", (e) => {
      const payload = readDragPayload(e);
      const target = getDropTarget(e.target, payload);
      if (!target) return;
      e.preventDefault();
      target.classList.add("is-over");
      e.dataTransfer.dropEffect = "move";
    });

    wrap.addEventListener("dragleave", (e) => {
      const payload = readDragPayload(e);
      const target = getDropTarget(e.target, payload);
      if (!target) return;
      if (e.relatedTarget && target.contains(e.relatedTarget)) return;
      target.classList.remove("is-over");
    });

    wrap.addEventListener("drop", (e) => {
      const payload = readDragPayload(e);
      const target = getDropTarget(e.target, payload);
      if (!target || !payload?.id) return;
      e.preventDefault();
      target.classList.remove("is-over");

      if (payload.type === "moon") {
        if (target.id === "unassignedMoonsZone") {
          assignMoonToPlanet(payload.id, null);
          render();
          return;
        }
        const targetPlanetId = target.getAttribute("data-moon-drop-planet-id");
        if (!targetPlanetId) return;
        assignMoonToPlanet(payload.id, targetPlanetId);
        render();
        return;
      }

      if (payload.type === "planet") {
        const zone = target;
        if (zone.id === "unassignedZone") {
          assignPlanetToSlot(payload.id, null);
          render();
          return;
        }

        const slotAttr = zone.getAttribute("data-slot");
        if (!slotAttr) return;
        const slot = Number(slotAttr);

        // If the slot is occupied by a locked planet, do not allow replacement
        const wNow = loadWorld();
        const planetsNow = listPlanets(wNow);
        const occ = planetsNow.find((p) => p.slotIndex === slot);
        if (occ && occ.locked && occ.id !== payload.id) {
          return;
        }

        assignPlanetToSlot(payload.id, slot);
        render();
      }
    });

    // Edit button: jump to Planet tab and select planet
    wrap.addEventListener("click", (e) => {
      const lockBtn = e.target.closest?.("button[data-action='lock']");
      if (lockBtn) {
        const pid2 = lockBtn.getAttribute("data-planet-id");
        if (pid2) {
          togglePlanetLock(pid2);
          render();
        }
        return;
      }

      const moonLockBtn = e.target.closest?.("button[data-action='lock-moon']");
      if (moonLockBtn) {
        const mid = moonLockBtn.getAttribute("data-moon-id");
        if (!mid) return;
        toggleMoonLock(mid);
        render();
        return;
      }

      const moonBtn = e.target.closest?.("button[data-action='edit-moon']");
      if (moonBtn) {
        const mid = moonBtn.getAttribute("data-moon-id");
        if (!mid) return;
        selectMoon(mid);
        location.hash = "#/moon";
        return;
      }

      const btn = e.target.closest?.("button[data-action='edit']");
      if (!btn) return;
      const pid = btn.getAttribute("data-planet-id");
      if (!pid) return;
      selectPlanet(pid);
      location.hash = "#/planet";
    });
  }

  // Init
  loadIntoInputs();
  render();
  initPosterRenderer();

  // Resize poster canvas on container resize
  if (posterWrap) {
    new ResizeObserver(() => render()).observe(posterWrap);
  }
}

function numWithSlider(id, label, unit, hint, min, max, step) {
  const unitHtml = unit ? ` <span class="unit">${unit}</span>` : "";
  return `
  <div class="form-row">
    <div>
      <div class="label">${label}${unitHtml} ${tipIcon(TIP_LABEL[label] || TIP_LABEL[id] || "")}</div>
      <div class="hint">${hint}</div>
    </div>
    <div class="input-pair">
      <input id="${id}" type="number" step="${step}" aria-label="${label}" />
      <input id="${id}_slider" type="range" aria-label="${label} slider" />
      <div class="range-meta"><span id="${id}_min"></span><span id="${id}_max"></span></div>
    </div>
  </div>`;
}
