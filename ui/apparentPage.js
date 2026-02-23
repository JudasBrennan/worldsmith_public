import {
  calcApparentModel,
  convertGasGiantRadiusRjToKm,
  convertPlanetRadiusEarthToKm,
  bondToGeometricAlbedo,
  classifyBodyType,
} from "../engine/apparent.js";
import { calcPlanetExact } from "../engine/planet.js";
import { fmt } from "../engine/utils.js";
import { bindNumberAndSlider } from "./bind.js";
import { attachTooltips, tipIcon } from "./tooltip.js";
import {
  getSelectedPlanet,
  listMoons,
  listPlanets,
  listSystemGasGiants,
  loadWorld,
} from "./store.js";

const TIP_LABEL = {
  "Home world": "Reference world used for apparent brightness and apparent size outputs.",
  "Reference moon": "Moon used for moon apparent size/brightness outputs.",
  "Moon semi-major axis": "Moon orbital semi-major axis in kilometres.",
  "Moon radius": "Moon radius in lunar radii (our Moon = 1).",
  "Moon albedo": "Moon geometric albedo used for moon apparent magnitude.",
  "Moon phase": "Moon phase angle in degrees (0 full, 180 new/invisible).",
  "Star apparent table":
    "Star apparent magnitude/brightness/size as seen from each body orbit in the current system.",
  "Body apparent table":
    "Planetary object visibility from the selected home world. Phase functions vary by body " +
    "type (WS8 types 1-4). Planet Bond albedo is auto-converted to geometric albedo via an " +
    "approximate phase integral. Star luminosity scales planet brightness via a " +
    "-2.5 log10(L) correction. Phase angles above 160\u00b0 are flagged as too " +
    "extreme to observe (WS8 convention). You can override current distance per object.",
  "Body type":
    "Phase function classification from WS8. " +
    "Type 1 (Rocky, airless): Bowell HG system, G=0.28. " +
    "Type 2 (Rocky w/ atmosphere): empirical polynomial. " +
    "Type 3 (Gas giant, R \u2265 1.5 R\u2295): piecewise polynomial with opposition surge. " +
    "Type 4 (Tiny body, R < 0.1 R\u2295): Bowell HG, G=0.15.",
  "Moon apparent table": "Moon apparent outputs from the selected home world.",
  "Moon absolute magnitude":
    "Deviation from WorldSmith 8 spreadsheet: WS8 has no moon apparent-magnitude page, so " +
    "this calculation is web-only. The host star's luminosity is included via a -2.5\u00b7log10(L) " +
    "correction (implemented as dividing by \u221aL inside the log argument). This scales the moon's " +
    "absolute magnitude for the brightness of the host star \u2014 brighter stars illuminate moons " +
    "more strongly, making them appear brighter from the home world.",
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
    case "exotic":
      return 0.35;
    default:
      return 0.45;
  }
}

function escapeHtml(text) {
  return String(text ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
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

  const planets = listPlanets(world)
    .map((planet) => {
      const model = calcPlanetExact({
        starMassMsol,
        starAgeGyr,
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

export function initApparentPage(mountEl) {
  const world = loadWorld();
  const selectedPlanet = getSelectedPlanet(world);

  const state = {
    homePlanetId: selectedPlanet?.id || listPlanets(world)[0]?.id || "",
    moonId: "",
    moonSemiMajorAxisKm: 384748,
    moonRadiusMoon: 1,
    moonAlbedo: 0.113,
    moonPhaseDeg: 0,
    distanceByBodyId: {},
  };

  const wrap = document.createElement("div");
  wrap.className = "page";
  wrap.innerHTML = `
    <div class="panel">
      <div class="panel__header">
        <h1 class="panel__title"><span class="ws-icon icon--apparent" aria-hidden="true"></span><span>Apparent Size & Brightness</span></h1>
        <div class="badge">Interactive tool</div>
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

          <div class="form-row">
            <div>
              <div class="label">Reference moon ${tipIcon(TIP_LABEL["Reference moon"])}</div>
            </div>
            <select id="apparentMoon"></select>
          </div>

          ${numWithSlider("apparentMoonAxis", "Moon semi-major axis", "km", 10, 1000000000, 10, TIP_LABEL["Moon semi-major axis"])}
          ${numWithSlider("apparentMoonRadius", "Moon radius", "Rmoon", 0.01, 20, 0.01, TIP_LABEL["Moon radius"])}
          ${numWithSlider("apparentMoonAlbedo", "Moon albedo", "", 0.01, 0.95, 0.001, TIP_LABEL["Moon albedo"])}
          ${numWithSlider("apparentMoonPhase", "Moon phase", "deg", 0, 180, 1, TIP_LABEL["Moon phase"])}

          <div class="button-row">
            <button id="apparentApply" class="primary" type="button">Apply</button>
            <button id="apparentReset" type="button">Reset to Defaults</button>
          </div>
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
        <div class="cluster-table-wrap" style="max-height:220px">
          <table class="cluster-table">
            <thead>
              <tr>
                <th>Moon</th>
                <th>Absolute Magnitude ${tipIcon(TIP_LABEL["Moon absolute magnitude"])}</th>
                <th>Apparent Magnitude</th>
                <th>Brightness (full moon = 1)</th>
                <th>Apparent Size (moon = 1)</th>
                <th>Eclipses</th>
              </tr>
            </thead>
            <tbody id="apparentMoonRows"></tbody>
          </table>
        </div>
      </div>
    </div>
  `;

  mountEl.innerHTML = "";
  mountEl.appendChild(wrap);
  attachTooltips(wrap);

  const homeSelectEl = wrap.querySelector("#apparentHomePlanet");
  const moonSelectEl = wrap.querySelector("#apparentMoon");
  const moonAxisEl = wrap.querySelector("#apparentMoonAxis");
  const moonRadiusEl = wrap.querySelector("#apparentMoonRadius");
  const moonAlbedoEl = wrap.querySelector("#apparentMoonAlbedo");
  const moonPhaseEl = wrap.querySelector("#apparentMoonPhase");

  const kpisEl = wrap.querySelector("#apparentKpis");
  const starRowsEl = wrap.querySelector("#apparentStarRows");
  const bodyRowsEl = wrap.querySelector("#apparentBodyRows");
  const moonRowsEl = wrap.querySelector("#apparentMoonRows");

  bindPair("apparentMoonAxis", moonAxisEl, 10, 1000000000, 10, "auto");
  bindPair("apparentMoonRadius", moonRadiusEl, 0.01, 20, 0.01, "auto");
  bindPair("apparentMoonAlbedo", moonAlbedoEl, 0.01, 0.95, 0.001, "auto");
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

    const moons = listMoons(latest);
    const homeMoons = moons.filter((moon) => moon.planetId === state.homePlanetId);
    const sourceMoons = homeMoons.length ? homeMoons : moons;

    if (!sourceMoons.length) {
      moonSelectEl.innerHTML = `<option value="">No moons</option>`;
      state.moonId = "";
      return;
    }

    if (!sourceMoons.some((moon) => moon.id === state.moonId)) {
      state.moonId = sourceMoons[0].id;
      syncMoonStateFromSelection(sourceMoons[0]);
    }

    moonSelectEl.innerHTML = sourceMoons
      .map((moon) => {
        const selected = moon.id === state.moonId ? " selected" : "";
        return `<option value="${escapeHtml(moon.id)}"${selected}>${escapeHtml(moon.name || moon.inputs?.name || moon.id)}</option>`;
      })
      .join("");
  }

  function syncMoonStateFromSelection(moon) {
    if (!moon) return;
    const inputs = moon.inputs || {};
    state.moonSemiMajorAxisKm = Number(inputs.semiMajorAxisKm) || 384748;
    state.moonRadiusMoon = moonRadiusFromInputs(inputs);
    state.moonAlbedo = Number(inputs.albedo) || 0.113;
    state.moonPhaseDeg = 0;
  }

  function loadMoonInputs() {
    moonAxisEl.value = String(state.moonSemiMajorAxisKm);
    moonRadiusEl.value = String(state.moonRadiusMoon);
    moonAlbedoEl.value = String(state.moonAlbedo);
    moonPhaseEl.value = String(state.moonPhaseDeg);
    moonAxisEl.dispatchEvent(new Event("input", { bubbles: true }));
    moonRadiusEl.dispatchEvent(new Event("input", { bubbles: true }));
    moonAlbedoEl.dispatchEvent(new Event("input", { bubbles: true }));
    moonPhaseEl.dispatchEvent(new Event("input", { bubbles: true }));
  }

  function readMoonInputs() {
    state.moonSemiMajorAxisKm = Number(moonAxisEl.value) || 384748;
    state.moonRadiusMoon = Number(moonRadiusEl.value) || 1;
    state.moonAlbedo = Number(moonAlbedoEl.value) || 0.113;
    state.moonPhaseDeg = Number(moonPhaseEl.value) || 0;
  }

  function render() {
    const latest = loadWorld();
    const sample = buildApparentSamples(latest, state.homePlanetId, state);

    const model = calcApparentModel({
      starMassMsol: sample.starMassMsol,
      homeOrbitAu: sample.homeOrbitAu,
      orbitSamples: sample.orbitSamples.filter((row) => row.id !== `planet:${state.homePlanetId}`),
      bodySamples: sample.bodySamples,
      moonSample: {
        name:
          listMoons(latest).find((moon) => moon.id === state.moonId)?.name ||
          listMoons(latest).find((moon) => moon.id === state.moonId)?.inputs?.name ||
          "Moon",
        semiMajorAxisKm: state.moonSemiMajorAxisKm,
        radiusMoon: state.moonRadiusMoon,
        geometricAlbedo: state.moonAlbedo,
        phaseDeg: state.moonPhaseDeg,
      },
    });

    const brightestBody = [...model.bodiesFromHome]
      .filter((body) => Number.isFinite(body.apparentMagnitude))
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
        label: "Moon apparent magnitude",
        value: Number.isFinite(model.moon.apparentMagnitude)
          ? fmt(model.moon.apparentMagnitude, 2)
          : "Invisible",
        meta: "current phase",
      },
      {
        label: "Moon eclipse type",
        value: model.moon.eclipseType,
        meta: "from home world",
      },
    ]
      .map(
        (item) => `
      <div class="kpi-wrap">
        <div class="kpi">
          <div class="kpi__label">${item.label}</div>
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
            <td>${escapeHtml(row.observable)}</td>
            <td>${escapeHtml(row.visibility)}</td>
          </tr>
        `;
      })
      .join("");

    moonRowsEl.innerHTML = `
      <tr>
        <td>${escapeHtml(model.moon.name)}</td>
        <td>${fmt(model.moon.absoluteMagnitude, 4)}</td>
        <td>${Number.isFinite(model.moon.apparentMagnitude) ? fmt(model.moon.apparentMagnitude, 2) : "Invisible"}</td>
        <td>${Number.isFinite(model.moon.brightnessRelativeToFullMoon) ? fmt(model.moon.brightnessRelativeToFullMoon, 4) : "NA"}</td>
        <td>${fmt(model.moon.apparentSizeRelativeToReference, 4)}</td>
        <td>${escapeHtml(model.moon.eclipseType)}</td>
      </tr>
    `;
  }

  wrap.querySelector("#apparentApply")?.addEventListener("click", () => {
    readMoonInputs();
    render();
  });

  wrap.querySelector("#apparentReset")?.addEventListener("click", () => {
    const latest = loadWorld();
    const moon = listMoons(latest).find((item) => item.id === state.moonId);
    if (moon) syncMoonStateFromSelection(moon);
    else {
      state.moonSemiMajorAxisKm = 384748;
      state.moonRadiusMoon = 1;
      state.moonAlbedo = 0.113;
      state.moonPhaseDeg = 0;
    }
    loadMoonInputs();
    render();
  });

  homeSelectEl?.addEventListener("change", () => {
    state.homePlanetId = String(homeSelectEl.value || "");
    refreshSelectors();
    render();
  });

  moonSelectEl?.addEventListener("change", () => {
    state.moonId = String(moonSelectEl.value || "");
    const moon = listMoons(loadWorld()).find((item) => item.id === state.moonId);
    syncMoonStateFromSelection(moon);
    loadMoonInputs();
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

  [moonAxisEl, moonRadiusEl, moonAlbedoEl, moonPhaseEl].forEach((input) => {
    input?.addEventListener("keydown", (event) => {
      if (event.key !== "Enter") return;
      readMoonInputs();
      render();
    });
  });

  refreshSelectors();
  loadMoonInputs();
  render();
}
