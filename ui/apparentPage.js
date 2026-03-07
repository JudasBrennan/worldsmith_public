import { calcApparentModel, SOL_REFERENCES } from "../engine/apparent.js";
import { buildApparentSnapshotInputs, SNAPSHOT_MODE_BUDGETS } from "../engine/worldAdapters.js";
import { buildWorldSnapshot } from "../engine/worldSnapshot.js";
import { fmt } from "../engine/utils.js";
import { bindNumberAndSlider } from "./bind.js";
import {
  renderApparentBodyRows,
  renderApparentHomeSelector,
  renderApparentKpis,
  renderApparentMoonRows,
  renderApparentSolRefRows,
  renderApparentStarRows,
} from "./apparent/domRender.js";
import { attachTooltips, tipIcon } from "./tooltip.js";
import { drawSkyCanvasNative, disposeSkyCanvasNative } from "./apparentSkyNativeThree.js";
import { getSelectedPlanet, loadWorld } from "./store.js";
import { createTutorial } from "./tutorial.js";

const TIP_LABEL = {
  "Home world": "Reference world used for apparent brightness and apparent size outputs.",
  "Moon phase":
    "Phase angle applied to all moons uniformly. 0\u00b0 = full (opposition), " +
    "180\u00b0 = new (conjunction, invisible).\n\n" +
    "Individual moon phases depend on orbital geometry; this slider " +
    "lets you explore the full range.",
  "Star apparent table":
    "Star apparent magnitude/brightness/size as seen from each body orbit in the current system.",
  "Body apparent table":
    "Planetary object visibility from the selected home world. Phase functions vary by body " +
    "type (types 1\u20134). Bond albedo is auto-converted to geometric albedo via an " +
    "approximate phase integral. Star luminosity scales planet brightness via a " +
    "-2.5 log10(L) correction. Phase angles above 160\u00b0 are flagged as too " +
    "extreme to observe. Distance per object can be overridden.",
  "Body type":
    "Phase function classification. " +
    "Type 1 (Rocky, airless): Bowell HG system, G=0.28. " +
    "Type 2 (Rocky w/ atmosphere): empirical polynomial. " +
    "Type 3 (Gas giant, R \u2265 1.5 R\u2295): piecewise polynomial with opposition surge. " +
    "Type 4 (Tiny body, R < 0.1 R\u2295): Bowell HG, G=0.15.",
  "Moon apparent table":
    "Moon apparent outputs from the selected home world. " +
    "All moons assigned to the home world are shown automatically.",
  "Moon absolute magnitude":
    "Moon absolute magnitude includes a -2.5\u00b7log10(L) correction for the host star\u2019s " +
    "luminosity (implemented as dividing by \u221aL inside the log argument). Brighter stars " +
    "illuminate moons more strongly, making them appear brighter from the home world.",
  "Angular diameter":
    "Apparent angular size of the object as seen from the home world. " +
    "Shown in degrees (\u00b0) for very large objects, arcminutes (\u2032) for medium, " +
    "or arcseconds (\u2033) for small.\n\n" +
    "Reference: Sun from Earth \u2248 31.6\u2032, Full Moon \u2248 31.1\u2032.",
  "Sol references":
    "Familiar Solar System objects for magnitude and angular size comparison. " +
    "All values are as seen from Earth.",
  "Sky canvas":
    "Visual comparison of angular sizes as seen from the home world. " +
    "Objects are drawn as disks at their true relative angular sizes. " +
    "Dotted outlines show familiar Solar System references (Sol, Luna, Jupiter).\n\n" +
    "When the star is much larger than other objects, a split scale is used: " +
    "the star appears at reduced scale (labelled) on the left, with moons " +
    "and planets at full scale on the right.\n\n" +
    "Very small objects are enlarged on a logarithmic scale so their " +
    "relative size differences remain visible.",
  "Star absolute magnitude":
    "Absolute visual magnitude of the host star (magnitude at 10 pc).\n\n" +
    "Lower values = brighter. The Sun is +4.83 M.",
  "Home orbit":
    "Orbital distance of the selected home world from the host star in AU.\n\n" +
    "All apparent magnitudes and angular sizes are computed from this distance.",
  "Home star magnitude":
    "Apparent visual magnitude of the host star as seen from the home world.\n\n" +
    "The Sun from Earth is \u22122.74 mag.",
  "Brightest object":
    "The planet or gas giant with the lowest (brightest) apparent magnitude " +
    "as seen from the home world at the current phase.",
  "Brightest moon":
    "The moon with the lowest (brightest) apparent magnitude as seen from " +
    "the home world at the selected moon phase angle.",
  "Moon count":
    "Total number of moons assigned to the home world.\n\n" +
    "Moons are assigned on the Moons page.",
};

function numWithSlider(id, label, unit, min, max, step, tip) {
  const unitHtml = unit ? ` <span class="unit">${unit}</span>` : "";
  return `
    <div class="form-row">
      <div>
        <div class="label">${label}${unitHtml} ${tipIcon(tip || "")}</div>
      </div>
      <div class="input-pair">
        <input id="${id}" type="number" step="${step}" aria-label="${label}" />
        <input id="${id}_slider" type="range" aria-label="${label} slider" />
        <div class="range-meta"><span id="${id}_min"></span><span id="${id}_max"></span></div>
      </div>
    </div>
  `;
}

const TUTORIAL_STEPS = [
  {
    title: "Getting Started",
    body:
      "The Apparent Size page calculates how celestial objects look from your " +
      "home world \u2014 angular diameter, apparent magnitude, and visibility " +
      "based on real optics.",
  },
  {
    title: "Sky Canvas",
    body:
      "The canvas at the top compares angular sizes at true proportions. " +
      "Tiny objects use logarithmic scaling so they remain visible. Sol " +
      "reference sizes are shown for comparison.",
  },
  {
    title: "Object Tables",
    body:
      "Tables list apparent magnitude, angular diameter, phase angle, and " +
      "illuminated fraction for every planet, gas giant, and moon in your " +
      "system.",
  },
  {
    title: "Phase Functions",
    body:
      "Four body types use different scattering models: rocky airless, rocky " +
      "with atmosphere, gas giant, and tiny body. Phase angles above 160\u00B0 " +
      "are flagged as too extreme to observe.",
  },
];

export function initApparentPage(mountEl) {
  const world = loadWorld();
  const initialSnapshot = buildWorldSnapshot(world, {
    mode: SNAPSHOT_MODE_BUDGETS.apparentSelectors,
  });
  const selectedPlanet = getSelectedPlanet(world);

  const state = {
    homePlanetId: selectedPlanet?.id || Object.keys(initialSnapshot.planetsById || {})[0] || "",
    moonPhaseDeg: 0,
    distanceByBodyId: {},
    skyMode: "night",
  };

  const wrap = document.createElement("div");
  wrap.className = "page";
  wrap.innerHTML = `
    <div class="panel">
      <div class="panel__header">
        <h1 class="panel__title"><span class="ws-icon icon--apparent" aria-hidden="true"></span><span>Apparent Size</span></h1>
        <button id="apparentTutorials" type="button" class="ws-tutorial-trigger">Tutorials</button>
      </div>
      <div class="panel__body">
        <div class="hint">Estimate star, planetary-object, and moon apparent brightness/size from a selected home world.</div>
      </div>
    </div>

    <div class="grid-2">
      <div class="panel">
        <div class="panel__header"><h2>Inputs</h2></div>
        <div class="panel__body">
          <div class="form-row">
            <div>
              <div class="label">Home world ${tipIcon(TIP_LABEL["Home world"])}</div>
            </div>
            <select id="apparentHomePlanet"></select>
          </div>

          ${numWithSlider("apparentMoonPhase", "Moon phase angle", "deg", 0, 180, 1, TIP_LABEL["Moon phase"])}
        </div>
      </div>

      <div class="panel">
        <div class="panel__header"><h2>Outputs</h2></div>
        <div class="panel__body">
          <div class="kpi-grid" id="apparentKpis"></div>
        </div>
      </div>
    </div>

    <div class="panel">
      <div class="panel__header"><h2>Angular Size Comparison ${tipIcon(TIP_LABEL["Sky canvas"])}</h2></div>
      <div class="panel__body">
        <div class="pill-toggle-wrap" style="margin-bottom:12px">
          <div class="physics-duo-toggle">
            <input type="radio" name="skyBg" id="skyNight" value="night" checked />
            <label for="skyNight">Night</label>
            <input type="radio" name="skyBg" id="skyDay" value="day" />
            <label for="skyDay">Day</label>
            <span></span>
          </div>
        </div>
        <div class="sky-canvas-wrap" id="skyCanvasWrap">
          <canvas id="skyCanvas" width="800" height="320"></canvas>
        </div>
      </div>
    </div>

    <div class="panel">
      <div class="panel__header"><h2>Star Apparent Table</h2></div>
      <div class="panel__body">
        <div class="hint">${TIP_LABEL["Star apparent table"]}</div>
        <div class="cluster-table-wrap" style="max-height:360px">
          <table class="cluster-table">
            <thead>
              <tr>
                <th>Object</th>
                <th>Orbit (AU)</th>
                <th>Star Magnitude</th>
                <th>Brightness (Earth-sun = 1)</th>
                <th>Apparent Size (Earth-sun = 1)</th>
                <th>Angular Diameter ${tipIcon(TIP_LABEL["Angular diameter"])}</th>
              </tr>
            </thead>
            <tbody id="apparentStarRows"></tbody>
          </table>
        </div>
      </div>
    </div>

    <div class="panel">
      <div class="panel__header"><h2>Body Apparent Table</h2></div>
      <div class="panel__body">
        <div class="hint">${TIP_LABEL["Body apparent table"]}</div>
        <div class="cluster-table-wrap" style="max-height:430px">
          <table class="cluster-table">
            <thead>
              <tr>
                <th>Object</th>
                <th>Type ${tipIcon(TIP_LABEL["Body type"])}</th>
                <th>Distance (AU)</th>
                <th>Phase (deg)</th>
                <th>Magnitude</th>
                <th>Angular Diameter</th>
                <th>Observable</th>
                <th>Visibility</th>
              </tr>
            </thead>
            <tbody id="apparentBodyRows"></tbody>
          </table>
        </div>
      </div>
    </div>

    <div class="panel">
      <div class="panel__header"><h2>Moon Apparent Table</h2></div>
      <div class="panel__body">
        <div class="hint">${TIP_LABEL["Moon apparent table"]}</div>
        <div class="cluster-table-wrap" style="max-height:320px">
          <table class="cluster-table">
            <thead>
              <tr>
                <th>Moon</th>
                <th>Abs Mag ${tipIcon(TIP_LABEL["Moon absolute magnitude"])}</th>
                <th>App Mag</th>
                <th>Angular Diameter</th>
                <th>Brightness (full moon = 1)</th>
                <th>Size (moon = 1)</th>
                <th>Eclipses</th>
              </tr>
            </thead>
            <tbody id="apparentMoonRows"></tbody>
          </table>
        </div>
      </div>
    </div>

    <div class="panel">
      <div class="panel__header"><h2>Sol System References ${tipIcon(TIP_LABEL["Sol references"])}</h2></div>
      <div class="panel__body">
        <div class="hint">Familiar Solar System objects for comparison.</div>
        <div class="cluster-table-wrap" style="max-height:260px">
          <table class="cluster-table">
            <thead>
              <tr>
                <th>Object</th>
                <th>Apparent Magnitude</th>
                <th>Angular Size</th>
                <th>Note</th>
              </tr>
            </thead>
            <tbody id="apparentSolRefRows"></tbody>
          </table>
        </div>
      </div>
    </div>
  `;

  mountEl.innerHTML = "";
  mountEl.appendChild(wrap);
  attachTooltips(wrap);
  createTutorial({
    steps: TUTORIAL_STEPS,
    storageKey: "worldsmith.apparent.tutorial",
    container: wrap,
    triggerBtn: wrap.querySelector("#apparentTutorials"),
  });

  const homeSelectEl = wrap.querySelector("#apparentHomePlanet");
  const moonPhaseEl = wrap.querySelector("#apparentMoonPhase");

  const kpisEl = wrap.querySelector("#apparentKpis");
  const starRowsEl = wrap.querySelector("#apparentStarRows");
  const bodyRowsEl = wrap.querySelector("#apparentBodyRows");
  const moonRowsEl = wrap.querySelector("#apparentMoonRows");
  const solRefRowsEl = wrap.querySelector("#apparentSolRefRows");

  const skyCanvasEl = wrap.querySelector("#skyCanvas");
  const skyWrapEl = wrap.querySelector("#skyCanvasWrap");
  let skyRendererReady = true;

  const skyUnmountObserver = new MutationObserver(() => {
    if (wrap.isConnected) return;
    disposeSkyCanvasNative(skyCanvasEl);
    try {
      skyUnmountObserver.disconnect();
    } catch {}
  });
  skyUnmountObserver.observe(document.body, { childList: true, subtree: true });

  const moonPhaseSliderEl = wrap.querySelector("#apparentMoonPhase_slider");
  bindPair("apparentMoonPhase", moonPhaseEl, 0, 180, 1, "auto");

  function bindPair(id, numberEl, min, max, step, mode) {
    const sliderEl = wrap.querySelector(`#${id}_slider`);
    const minEl = wrap.querySelector(`#${id}_min`);
    const maxEl = wrap.querySelector(`#${id}_max`);
    minEl.textContent = String(min);
    maxEl.textContent = String(max);
    bindNumberAndSlider({ numberEl, sliderEl, min, max, step, mode });
  }

  function refreshSelectors() {
    const snapshot = buildWorldSnapshot(loadWorld(), {
      mode: SNAPSHOT_MODE_BUDGETS.apparentSelectors,
    });
    const planets = Object.values(snapshot.planetsById || {});
    state.homePlanetId = renderApparentHomeSelector(homeSelectEl, planets, state.homePlanetId);
  }

  function render() {
    const latest = loadWorld();
    const snapshot = buildWorldSnapshot(latest, { mode: SNAPSHOT_MODE_BUDGETS.apparentPage });
    const sample = buildApparentSnapshotInputs(snapshot, {
      homePlanetId: state.homePlanetId,
      distanceByBodyId: state.distanceByBodyId,
      moonPhaseDeg: state.moonPhaseDeg,
    });

    const model = calcApparentModel({
      starMassMsol: sample.starMassMsol,
      homeOrbitAu: sample.homeOrbitAu,
      orbitSamples: sample.orbitSamples.filter((row) => row.id !== `planet:${state.homePlanetId}`),
      bodySamples: sample.bodySamples,
      moonSamples: sample.moonSamples,
    });

    // Re-attach moonCalc from original samples (stripped by engine normalizer)
    model.moons.forEach((m, i) => {
      if (sample.moonSamples[i]?.moonCalc) m.moonCalc = sample.moonSamples[i].moonCalc;
    });

    // Re-attach visual metadata stripped by engine normalizer
    const bodyLookup = new Map(sample.bodySamples.map((b) => [b.id, b]));
    model.bodiesFromHome.forEach((b) => {
      const src = bodyLookup.get(b.id);
      if (!src) return;
      if (src._derived) b._derived = src._derived;
      if (src._planetInputs) b._planetInputs = src._planetInputs;
      if (src._styleId) b._styleId = src._styleId;
      if (src.classLabel) b.classLabel = src.classLabel;
    });

    const brightestBody = [...model.bodiesFromHome]
      .filter((body) => Number.isFinite(body.apparentMagnitude))
      .sort((a, b) => a.apparentMagnitude - b.apparentMagnitude)[0];

    const brightestMoon = [...model.moons]
      .filter((m) => Number.isFinite(m.apparentMagnitude))
      .sort((a, b) => a.apparentMagnitude - b.apparentMagnitude)[0];

    renderApparentKpis(
      kpisEl,
      [
        {
          label: "Star absolute magnitude",
          value: fmt(model.star.absoluteMagnitude, 3),
          meta: "M",
        },
        {
          label: "Home orbit",
          value: fmt(sample.homeOrbitAu, 3),
          meta: "AU",
        },
        {
          label: "Home star magnitude",
          value: fmt(model.starByOrbit[0]?.magnitude, 3),
          meta: "at home",
        },
        {
          label: "Brightest object",
          value: brightestBody ? brightestBody.name : "-",
          meta: brightestBody ? `${fmt(brightestBody.apparentMagnitude, 2)} mag` : "-",
        },
        {
          label: "Brightest moon",
          value: brightestMoon ? brightestMoon.name : "-",
          meta: brightestMoon
            ? `${fmt(brightestMoon.apparentMagnitude, 2)} mag`
            : model.moons.length
              ? "All invisible at this phase"
              : "No moons",
        },
        {
          label: "Moon count",
          value: String(model.moons.length),
          meta: "assigned to home world",
        },
      ],
      TIP_LABEL,
    );

    renderApparentStarRows(starRowsEl, model.starByOrbit);

    model.bodiesFromHome.forEach((row) => {
      state.distanceByBodyId[row.id] = row.currentDistanceAu;
    });
    renderApparentBodyRows(bodyRowsEl, model.bodiesFromHome);
    renderApparentMoonRows(moonRowsEl, model.moons);
    renderApparentSolRefRows(solRefRowsEl, SOL_REFERENCES);

    // Sky canvas
    const starModel = sample.starModel;
    if (!state.homePlanetId) {
      // No home planet — show placeholder message on the canvas.
      const rect = skyWrapEl?.getBoundingClientRect?.();
      if (rect && skyCanvasEl) {
        const dpr = window.devicePixelRatio || 1;
        const w = Math.round(rect.width * dpr);
        const h = Math.round(rect.height * dpr);
        skyCanvasEl.width = w;
        skyCanvasEl.height = h;
        const ctx = skyCanvasEl.getContext("2d");
        if (ctx) {
          ctx.fillStyle = "#050818";
          ctx.fillRect(0, 0, w, h);
          ctx.font = `italic ${12 * dpr}px system-ui, sans-serif`;
          ctx.fillStyle = "rgba(160,170,200,0.5)";
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText("Add planets to populate the sky comparison", w / 2, h / 2);
        }
      }
    } else if (skyRendererReady) {
      const skyPalette = {
        dayHex: sample.homeSkyDayHex,
        dayEdgeHex: sample.homeSkyDayEdgeHex,
        horizonHex: sample.homeSkyHorizonHex,
      };
      drawSkyCanvasNative(
        skyCanvasEl,
        model,
        starModel?.starColourHex,
        state.skyMode,
        state.moonPhaseDeg,
        skyPalette,
        {
          starTempK: starModel?.tempK,
          starMassMsol: sample.starMassMsol,
          starAgeGyr: sample.starAgeGyr,
        },
      );
    }
  }

  homeSelectEl?.addEventListener("change", () => {
    state.homePlanetId = String(homeSelectEl.value || "");
    refreshSelectors();
    render();
  });

  bodyRowsEl?.addEventListener("change", (event) => {
    const input = event.target?.closest?.("input[data-distance-id]");
    if (!input) return;
    const id = String(input.dataset.distanceId || "");
    const next = Number(input.value);
    if (!id || !Number.isFinite(next)) return;
    state.distanceByBodyId[id] = next;
    render();
  });

  // Slider input: syncFromSlider sets moonPhaseEl.value but doesn't fire DOM
  // events, so listen on the slider directly for real-time updates.
  moonPhaseSliderEl?.addEventListener("input", () => {
    state.moonPhaseDeg = Number(moonPhaseEl.value) || 0;
    render();
  });

  // Number input: change fires on blur/Enter
  moonPhaseEl?.addEventListener("change", () => {
    state.moonPhaseDeg = Number(moonPhaseEl.value) || 0;
    render();
  });

  wrap.addEventListener("change", (e) => {
    if (e.target.name === "skyBg") {
      state.skyMode = e.target.value;
      render();
    }
  });

  if (skyWrapEl) {
    new ResizeObserver(() => render()).observe(skyWrapEl);
  }

  refreshSelectors();
  moonPhaseEl.value = String(state.moonPhaseDeg);
  moonPhaseEl.dispatchEvent(new Event("input", { bubbles: true }));
  render();
}
