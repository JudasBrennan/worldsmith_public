import {
  calcApparentModel,
  convertGasGiantRadiusRjToKm,
  convertPlanetRadiusEarthToKm,
  bondToGeometricAlbedo,
  classifyBodyType,
  SOL_REFERENCES,
} from "../engine/apparent.js";
import { calcMoonExact } from "../engine/moon.js";
import { calcPlanetExact } from "../engine/planet.js";
import { calcStar } from "../engine/star.js";
import { fmt } from "../engine/utils.js";
import { bindNumberAndSlider } from "./bind.js";
import { attachTooltips, tipIcon } from "./tooltip.js";
import { escapeHtml } from "./uiHelpers.js";
import { drawSkyCanvasNative, disposeSkyCanvasNative } from "./apparentSkyNativeThree.js";
import {
  getSelectedPlanet,
  getStarOverrides,
  listMoons,
  listPlanets,
  listSystemGasGiants,
  loadWorld,
} from "./store.js";
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

function gasGiantAlbedo(style) {
  switch (String(style || "").toLowerCase()) {
    case "jupiter":
      return 0.538;
    case "saturn":
      return 0.499;
    case "ice":
      return 0.45;
    case "hot":
      return 0.4;
    default:
      return 0.45;
  }
}

function moonRadiusFromInputs(inputs) {
  const massMoon = Number(inputs?.massMoon);
  const density = Number(inputs?.densityGcm3);
  if (!Number.isFinite(massMoon) || !Number.isFinite(density) || massMoon <= 0 || density <= 0) {
    return 1;
  }
  return Math.pow(massMoon / (density / 3.34), 1 / 3);
}

function buildApparentSamples(world, homePlanetId, state) {
  const starMassMsol = Number(world?.star?.massMsol) || 1;
  const starAgeGyr = Number(world?.star?.ageGyr) || 4.6;
  const sov = getStarOverrides(world?.star);

  const planets = listPlanets(world)
    .map((planet) => {
      const model = calcPlanetExact({
        starMassMsol,
        starAgeGyr,
        starRadiusRsolOverride: sov.r,
        starLuminosityLsolOverride: sov.l,
        starTempKOverride: sov.t,
        starEvolutionMode: sov.ev,
        planet: planet.inputs || {},
      });

      const radiusKm = Number(model?.derived?.radiusKm) || convertPlanetRadiusEarthToKm(1);
      const hasAtmosphere = Number(planet.inputs?.pressureAtm) > 0.01;
      const bodyType = classifyBodyType(radiusKm, hasAtmosphere);
      const bondAlbedo = Number(planet.inputs?.albedoBond) || 0.3;

      return {
        id: `planet:${planet.id}`,
        kind: "planet",
        name: planet.name || planet.inputs?.name || planet.id,
        classLabel: "Planet",
        orbitAu: Number(planet.inputs?.semiMajorAxisAu) || 1,
        radiusKm,
        geometricAlbedo: bondToGeometricAlbedo(bondAlbedo, bodyType),
        hasAtmosphere,
        skyDayHex: model?.derived?.skyColourDayHex || null,
        skyDayEdgeHex: model?.derived?.skyColourDayEdgeHex || null,
        skyHorizonHex: model?.derived?.skyColourHorizonHex || null,
        _derived: model?.derived || null,
        _planetInputs: planet.inputs || null,
      };
    })
    .filter((item) => Number.isFinite(item.orbitAu) && item.orbitAu > 0);

  const gasGiants = listSystemGasGiants(world)
    .map((giant) => ({
      id: `gas:${giant.id}`,
      kind: "gas",
      name: giant.name || giant.id,
      classLabel: "Gas giant",
      orbitAu: Number(giant.au),
      radiusKm: convertGasGiantRadiusRjToKm(giant.radiusRj),
      geometricAlbedo: gasGiantAlbedo(giant.style),
      hasAtmosphere: true,
      _styleId: giant.style || "jupiter",
    }))
    .filter((item) => Number.isFinite(item.orbitAu) && item.orbitAu > 0);

  const allBodies = [...planets, ...gasGiants].sort((a, b) => a.orbitAu - b.orbitAu);

  const selectedHomePlanet = planets.find((body) => body.id === `planet:${homePlanetId}`) || null;
  const homeOrbitAu = selectedHomePlanet?.orbitAu || 1;

  const orbitSamples = allBodies.map((body) => ({
    id: body.id,
    name: body.name,
    orbitAu: body.orbitAu,
  }));

  const bodySamples = allBodies
    .filter((body) => body.id !== selectedHomePlanet?.id)
    .map((body) => {
      const key = body.id;
      const currentDistanceAu = Number(state.distanceByBodyId[key]);
      return {
        ...body,
        currentDistanceAu: Number.isFinite(currentDistanceAu) ? currentDistanceAu : undefined,
      };
    });

  return {
    starMassMsol,
    homeOrbitAu,
    selectedHomePlanet,
    planets,
    allBodies,
    orbitSamples,
    bodySamples,
    homeSkyDayHex: selectedHomePlanet?.skyDayHex || null,
    homeSkyDayEdgeHex: selectedHomePlanet?.skyDayEdgeHex || null,
    homeSkyHorizonHex: selectedHomePlanet?.skyHorizonHex || null,
  };
}

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
  const selectedPlanet = getSelectedPlanet(world);

  const state = {
    homePlanetId: selectedPlanet?.id || listPlanets(world)[0]?.id || "",
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
    const latest = loadWorld();
    const planets = listPlanets(latest);

    if (!planets.length) {
      homeSelectEl.innerHTML = `<option value="">No planets</option>`;
      state.homePlanetId = "";
    } else {
      if (!planets.some((planet) => planet.id === state.homePlanetId)) {
        state.homePlanetId = planets[0].id;
      }
      homeSelectEl.innerHTML = planets
        .map((planet) => {
          const selected = planet.id === state.homePlanetId ? " selected" : "";
          return `<option value="${escapeHtml(planet.id)}"${selected}>${escapeHtml(planet.name || planet.inputs?.name || planet.id)}</option>`;
        })
        .join("");
    }
  }

  function render() {
    const latest = loadWorld();
    const sample = buildApparentSamples(latest, state.homePlanetId, state);

    const allMoons = listMoons(latest);
    const homeMoons = allMoons.filter((m) => m.planetId === state.homePlanetId);

    // Moon store field is Bond albedo; apparent engine needs geometric albedo.
    // Phase integral q ≈ 0.9 for regolith-covered rocky bodies (opposition surge).
    const MOON_Q = 0.9;
    const sov = getStarOverrides(latest?.star);
    const starAgeGyr = Number(latest?.star?.ageGyr) || 4.6;
    const homePlanetInputs = latest?.planets?.byId?.[state.homePlanetId]?.inputs;
    const moonSamples = homeMoons.map((moon) => {
      let moonCalc = null;
      if (homePlanetInputs) {
        try {
          moonCalc = calcMoonExact({
            starMassMsol: sample.starMassMsol,
            starAgeGyr,
            starRadiusRsolOverride: sov.r,
            starLuminosityLsolOverride: sov.l,
            starTempKOverride: sov.t,
            starEvolutionMode: sov.ev,
            planet: homePlanetInputs,
            moon: { ...moon.inputs },
          });
        } catch {
          moonCalc = null;
        }
      }
      return {
        name: moon.name || moon.inputs?.name || moon.id,
        semiMajorAxisKm: Number(moon.inputs?.semiMajorAxisKm) || 384748,
        radiusMoon: moonRadiusFromInputs(moon.inputs),
        geometricAlbedo: (Number(moon.inputs?.albedo) || 0.11) / MOON_Q,
        phaseDeg: state.moonPhaseDeg,
        moonCalc,
      };
    });

    const model = calcApparentModel({
      starMassMsol: sample.starMassMsol,
      homeOrbitAu: sample.homeOrbitAu,
      orbitSamples: sample.orbitSamples.filter((row) => row.id !== `planet:${state.homePlanetId}`),
      bodySamples: sample.bodySamples,
      moonSamples,
    });

    // Re-attach moonCalc from original samples (stripped by engine normalizer)
    model.moons.forEach((m, i) => {
      if (moonSamples[i]?.moonCalc) m.moonCalc = moonSamples[i].moonCalc;
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

    kpisEl.innerHTML = [
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
        value: brightestBody ? escapeHtml(brightestBody.name) : "-",
        meta: brightestBody ? `${fmt(brightestBody.apparentMagnitude, 2)} mag` : "-",
      },
      {
        label: "Brightest moon",
        value: brightestMoon ? escapeHtml(brightestMoon.name) : "-",
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
    ]
      .map(
        (item) => `
      <div class="kpi-wrap">
        <div class="kpi">
          <div class="kpi__label">${item.label} ${tipIcon(TIP_LABEL[item.label] || "")}</div>
          <div class="kpi__value">${item.value}</div>
          <div class="kpi__meta">${item.meta}</div>
        </div>
      </div>
    `,
      )
      .join("");

    starRowsEl.innerHTML = model.starByOrbit
      .map(
        (row) => `
      <tr>
        <td>${escapeHtml(row.name)}</td>
        <td>${fmt(row.orbitAu, 4)}</td>
        <td>${fmt(row.magnitude, 4)}</td>
        <td>${fmt(row.brightnessRelativeToEarthSun, 6)}</td>
        <td>${fmt(row.apparentSizeRelativeToEarthSun, 6)}</td>
        <td>${row.angularDiameterLabel}</td>
      </tr>
    `,
      )
      .join("");

    bodyRowsEl.innerHTML = model.bodiesFromHome
      .map((row) => {
        state.distanceByBodyId[row.id] = row.currentDistanceAu;

        return `
          <tr>
            <td>${escapeHtml(row.name)}</td>
            <td>${escapeHtml(row.bodyTypeLabel || row.classLabel)}</td>
            <td>
              <input
                type="number"
                min="${row.minDistanceAu}"
                max="${row.maxDistanceAu}"
                step="0.001"
                value="${row.currentDistanceAu}"
                data-distance-id="${escapeHtml(row.id)}"
                class="cluster-name-input"
                title="min ${fmt(row.minDistanceAu, 3)} AU, max ${fmt(row.maxDistanceAu, 3)} AU"
              />
            </td>
            <td>${fmt(row.phaseAngleDeg, 2)}</td>
            <td>${Number.isFinite(row.apparentMagnitude) ? fmt(row.apparentMagnitude, 2) : "NA"}</td>
            <td>${row.angularDiameterLabel}</td>
            <td>${escapeHtml(row.observable)}</td>
            <td>${escapeHtml(row.visibility)}</td>
          </tr>
        `;
      })
      .join("");

    moonRowsEl.innerHTML = model.moons.length
      ? model.moons
          .map(
            (m) => `
        <tr>
          <td>${escapeHtml(m.name)}</td>
          <td>${fmt(m.absoluteMagnitude, 4)}</td>
          <td>${Number.isFinite(m.apparentMagnitude) ? fmt(m.apparentMagnitude, 2) : "Invisible"}</td>
          <td>${m.angularDiameterLabel}</td>
          <td>${Number.isFinite(m.brightnessRelativeToFullMoon) ? fmt(m.brightnessRelativeToFullMoon, 4) : "NA"}</td>
          <td>${fmt(m.apparentSizeRelativeToReference, 4)}</td>
          <td>${escapeHtml(m.eclipseType)}</td>
        </tr>
      `,
          )
          .join("")
      : `<tr><td colspan="7" style="text-align:center;color:var(--muted)">No moons assigned to home world</td></tr>`;

    solRefRowsEl.innerHTML = SOL_REFERENCES.map((ref) => {
      const angFmt =
        ref.angDiamArcmin != null
          ? `${ref.angDiamArcmin.toFixed(1)}\u2032`
          : ref.angDiamArcsec != null
            ? `${ref.angDiamArcsec}\u2033`
            : "\u2014";
      return `
        <tr>
          <td>${escapeHtml(ref.name)}</td>
          <td>${fmt(ref.appMag, 2)}</td>
          <td>${angFmt}</td>
          <td>${escapeHtml(ref.note)}</td>
        </tr>
      `;
    }).join("");

    // Sky canvas
    const starModel = calcStar({ massMsol: sample.starMassMsol, ageGyr: 4.6 });
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
        starModel.starColourHex,
        state.skyMode,
        state.moonPhaseDeg,
        skyPalette,
        { starTempK: starModel.tempK, starMassMsol: sample.starMassMsol, starAgeGyr: 4.6 },
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
