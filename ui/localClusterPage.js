import {
  calcLocalCluster,
  LOCAL_CLUSTER_DEFAULTS,
  normalizeLocalClusterInputs,
} from "../engine/localCluster.js";
import { giantPlanetProbability } from "../engine/star.js";
import { clamp, fmt } from "../engine/utils.js";
import { bindNumberAndSlider } from "./bind.js";
import { getClusterObjectVisual, normalizeClusterObjectKey } from "./clusterObjectVisuals.js";
import { attachTooltips, tipIcon } from "./tooltip.js";
import {
  getClusterAdjustments,
  getClusterInputs,
  getClusterSystemNames,
  loadWorld,
  updateClusterAdjustments,
  updateClusterInputs,
  updateClusterSystemNames,
} from "./store.js";

const TIP_LABEL = {
  "Galactic Radius":
    "Radius of the galaxy in light-years. The Galactic Habitable Zone scales from this value (47%–60% of radius), matching the WS8 Galaxy tab formula.",
  Location: "Your neighbourhood's galactocentric distance in light-years.",
  "Neighbourhood Radius": "Radius of the local stellar neighbourhood sphere in light-years.",
  "Stellar Density":
    "Total density of all stellar-mass objects per cubic light-year (stars + white dwarfs + brown dwarfs + other).\n\nThe default 0.004/ly^3 matches the HIPPARCOS-calibrated solar-neighbourhood stellar density (~0.14 stars/pc^3). All class fractions now sum to 100% of this value, so Total Stellar-Mass Objects ≈ raw estimate.",
  "Random Seed":
    "Integer seed for the Park-Miller PRNG used to place systems in 3-D space. The same seed always reproduces the same layout.\n\nDeviation from WS8: WS8 has no coordinate-generation algorithm. This engine places each neighbour system at a random distance (uniform-in-volume cube-root sampling) and random spherical direction derived from the seed.\n\nFor neighbourhood radii > 50 ly the z-axis is progressively compressed to approximate galactic disk geometry (thin-disk scale height ~300 pc).",
  "Galactic Habitable Zone":
    "Computed as 0.47 * galactic radius (inner) to 0.60 * galactic radius (outer), matching WS8. This is a simplified hard-boundary model retained for WS8 compatibility.\n\nThe GHZ Probability field below gives a more accurate Gaussian estimate (Lineweaver 2004).",
  "In Galactic Habitable Zone?":
    "Checks whether your selected location falls within the WS8 GHZ band (47%–60% of galactic radius). Hard boundary — see also GHZ Probability for a continuous estimate.",
  "GHZ Probability":
    "Probability-based GHZ score (0\u20131) using a Gaussian model centred at 53% of galactic radius (sigma = 10% * R), based on Lineweaver (2004).\n\nA score of 1.0 indicates optimal habitability; scores fall off smoothly toward the core (high supernova rate, tidal disruption) and outer disc (low metallicity, fewer rocky planets). This is more physically meaningful than the hard WS8 band.",
  "Neighbourhood Volume":
    "Spherical volume used for object count estimates: (4/3)*pi*r^3, matching WS8.",
  "Estimated Stellar-Mass Objects":
    "Raw estimate before class breakdown: stellar density * neighbourhood volume.\n\nClass fractions now sum to 100% of this figure (MS 72% + WD 6% + BD 19% + Other 3%), so Total Stellar-Mass Objects ≈ this value (±rounding). This corrects the WS8 140% overcounting.",
  "Main Sequence Total":
    "Rounded sum of O/B/A/F/G/K/M stars, each class computed as round(raw * 0.72 * fraction).\n\nThe 0.72 factor allocates 72% of total objects to MS stars, matching the solar-neighbourhood census (Reylé et al. 2021; RECONS within 10 pc). The relative O/B/A/F/G/K/M fractions are unchanged from WS8 (Kroupa/Chabrier IMF). The O-type fraction (3*10^-7) gives essentially 0 O stars for any neighbourhood under ~500 ly, correctly reflecting that the nearest O star is ~1,400 ly away.",
  "Total Stellar-Mass Objects":
    "Rounded sum of all stellar-mass object classes (MS + WD + BD + Other).\n\nFractions applied: MS 72%, WD 6%, BD 19%, Other 3% — these sum to 100% of the raw estimate. Sources: Reylé et al. (2021) for BD fraction; typical WD fraction ~5–8% for field stars; RECONS for class breakdown.",
  "Total Star Systems":
    "Estimated count of gravitationally bound systems derived from the stellar-mass object total using mass-weighted multiplicity fractions.\n\nMultiplicity rates are now class-dependent (Duchêne & Kraus 2013; Raghavan et al. 2010): M dwarfs (~72% of MS) have only ~27% binary fraction; FGK stars ~46%; O/B stars ~50–70%. This gives ~1.3–1.4 stars/system for a typical solar neighbourhood, compared to the WS8 FGK-only value of 1.58. Companion classes are also constrained to be no more massive than their primary.",
  "Class breakdown":
    "Class counts use the corrected population fractions (MS 72%, WD 6%, BD 19%, Other 3%). Each generated system is randomly assigned an object class from the same weighted distribution, and companion classes are drawn from a filtered set that excludes classes heavier than the primary — an addition not present in WS8.",
  "System Coordinates":
    "Home star system is fixed at (0, 0, 0). Neighbour positions are generated with a Park-Miller PRNG seeded from the Random Seed input.\n\nDeviation from WS8: WS8 has no coordinate generator. Distances use cube-root sampling (uniform in volume inside the sphere). Directions use spherical-coordinate sampling.\n\nFor radii > 50 ly, the z-axis is compressed by a disk factor (1 - (r-50)/1000, floored at 0.15) to approximate the Milky Way thin-disk geometry.",
  "System Name":
    "Editable name override for this generated star system. Leave blank to use the default generated name.",
  "[Fe/H]":
    "Iron abundance relative to the Sun on a logarithmic scale. [Fe/H] = 0 is solar; +0.3 means twice solar iron; -1.0 means one-tenth.\n\nGenerated from galactic position (radial gradient -0.06 dex/kpc, vertical gradient -0.30 dex/kpc) plus Gaussian scatter (sigma 0.20 dex). The home system uses the value set on the Star page.\n\nReferences: Nordstrom et al. (2004); Luck & Lambert (2011); Schlesinger et al. (2014).",
  "P(giant)":
    "Estimated probability of hosting at least one giant planet (> 0.3 Mjup), based on the Fischer & Valenti (2005) metallicity-planet correlation: P = 0.1 * 10^(2*[Fe/H]), clamped to 0-100%.\n\nMetal-rich stars are far more likely to host gas giants; at [Fe/H] = +0.3 the probability is ~40%.",
};

function formatLy(value, dp = 2) {
  return `${fmt(value, dp)} ly`;
}

function fmtFeH(feH) {
  const v = Number(feH);
  if (!Number.isFinite(v)) return "—";
  return (v > 0 ? "+" : "") + fmt(v, 2);
}

function toInteger(n, fallback) {
  const x = Number(n);
  return Number.isFinite(x) ? Math.round(x) : fallback;
}

function esc(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
const escapeAttr = esc;

function sanitizeSystemName(raw) {
  return String(raw ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80);
}

const MULTIPLICITY_LABELS = ["single", "binary", "triple", "quadruple"];

function multiplicityFromCount(n) {
  return MULTIPLICITY_LABELS[clamp(n, 1, 4) - 1];
}

const COMPANION_CLASSES = [
  { key: "O", label: "O-type star" },
  { key: "B", label: "B-type star" },
  { key: "A", label: "A-type star" },
  { key: "F", label: "F-type star" },
  { key: "G", label: "G-type star" },
  { key: "K", label: "K-type star" },
  { key: "M", label: "M-type star" },
  { key: "D", label: "White Dwarf" },
  { key: "LTY", label: "Brown Dwarf" },
  { key: "OTHER", label: "Other" },
];

function parseSpectralType(str) {
  const s = str.trim().toUpperCase();
  if (/^[LTY]/.test(s)) return "LTY";
  if (/^D/.test(s)) return "D";
  const m = s.match(/^([OBAFGKM])/);
  if (m) return m[1];
  return "OTHER";
}

function parseClusterTable(text) {
  const lines = text
    .trim()
    .split(/\r?\n/)
    .filter((l) => l.trim());
  if (lines.length === 0) return [];

  const startIdx = /system name|coordinates|constituents/i.test(lines[0]) ? 1 : 0;
  const systems = [];
  const ts = Date.now();

  for (let i = startIdx; i < lines.length; i++) {
    const cols = lines[i].split("\t");
    if (cols.length < 4) continue;

    const name = cols[0].trim();
    const coordMatch = cols[1].match(/\(\s*([^,]+),\s*([^,]+),\s*([^)]+)\)/);
    if (!coordMatch) continue;
    const x = parseFloat(coordMatch[1]);
    const y = parseFloat(coordMatch[2]);
    const z = parseFloat(coordMatch[3]);
    if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) continue;

    const distanceLy = Math.hypot(x, y, z);
    const isHome = x === 0 && y === 0 && z === 0;

    // Strip trailing notes like ", originally GV"
    const rawConstituents = cols[3].trim();
    const constituentPart = rawConstituents.split(/,\s*(?:originally|formerly)/i)[0].trim();
    const parts = constituentPart.split(/\s*\+\s*/);
    const components = isHome
      ? [{ objectClassKey: "HOME" }]
      : parts.map((p) => ({ objectClassKey: parseSpectralType(p) }));

    systems.push({
      id: isHome ? "home" : `imported-${ts}-${i}`,
      name: name || `Star System ${i}`,
      index: i - startIdx,
      isHome,
      objectClassKey: isHome ? "HOME" : components[0].objectClassKey,
      multiplicity: multiplicityFromCount(components.length),
      components,
      x,
      y,
      z,
      distanceLy,
    });
  }

  return systems;
}

function randomPositionInSphere(radiusLy, zScale) {
  const u = Math.random();
  const theta = Math.random() * 2 * Math.PI;
  const phi = Math.acos(2 * Math.random() - 1);
  const r = Math.cbrt(u) * radiusLy;
  const x = r * Math.sin(phi) * Math.cos(theta);
  const y = r * Math.sin(phi) * Math.sin(theta);
  const z = r * Math.cos(phi) * zScale;
  return { x, y, z, distanceLy: Math.hypot(x, y, z) };
}

function computeCountDeltas(model, adjustments) {
  const deltas = {};
  for (const sys of adjustments.addedSystems) {
    for (const comp of sys.components || []) {
      if (comp.objectClassKey === "HOME") continue;
      deltas[comp.objectClassKey] = (deltas[comp.objectClassKey] || 0) + 1;
    }
  }
  const removedSet = new Set(adjustments.removedSystemIds);
  for (const sys of model.systems) {
    if (!removedSet.has(sys.id)) continue;
    for (const comp of sys.components || []) {
      if (comp.objectClassKey === "HOME") continue;
      deltas[comp.objectClassKey] = (deltas[comp.objectClassKey] || 0) - 1;
    }
  }
  for (const [sysId, override] of Object.entries(adjustments.componentOverrides)) {
    const original = model.systems.find((s) => s.id === sysId);
    if (!original) continue;
    for (const comp of original.components || []) {
      if (comp.objectClassKey === "HOME") continue;
      deltas[comp.objectClassKey] = (deltas[comp.objectClassKey] || 0) - 1;
    }
    for (const comp of override.components || []) {
      if (comp.objectClassKey === "HOME") continue;
      deltas[comp.objectClassKey] = (deltas[comp.objectClassKey] || 0) + 1;
    }
  }
  return deltas;
}

function buildFinalSystems(model, adjustments) {
  const removedSet = new Set(adjustments.removedSystemIds);
  const systems = [];
  for (const sys of model.systems) {
    if (removedSet.has(sys.id)) continue;
    const override = adjustments.componentOverrides[sys.id];
    if (override) {
      systems.push({
        ...sys,
        components: override.components,
        multiplicity: override.multiplicity,
      });
    } else {
      systems.push(sys);
    }
  }
  for (const sys of adjustments.addedSystems) {
    systems.push(sys);
  }
  return systems;
}

// Returns a display label like "K", "K + M", or "G + K + M" for a system.
function formatSystemLabel(system) {
  if (!Array.isArray(system.components) || system.components.length <= 1) {
    const k = normalizeClusterObjectKey(system.objectClassKey, { isHome: system.isHome });
    return k === "LTY" ? "L/T/Y" : k;
  }
  return system.components
    .map((c) => {
      const k = normalizeClusterObjectKey(c.objectClassKey);
      return k === "LTY" ? "L/T/Y" : k;
    })
    .join(" + ");
}

export function initLocalClusterPage(mountEl) {
  const initial = getClusterInputs();
  const state = normalizeLocalClusterInputs(initial);
  let systemNameOverrides = getClusterSystemNames();
  let lastModel = null;
  let lastFinalSystems = [];

  const wrap = document.createElement("div");
  wrap.className = "page";
  wrap.innerHTML = `
    <div class="panel">
      <div class="panel__header">
        <h1 class="panel__title"><span class="ws-icon icon--local-cluster" aria-hidden="true"></span><span>Local Cluster</span></h1>
        <div class="badge">Interactive tool</div>
      </div>
      <div class="panel__body">
        <div class="hint">Set your galactic neighbourhood inputs and generate seeded nearby star-system coordinates from the WorldSmith Galaxy sheet logic.</div>
      </div>
    </div>

    <div class="grid-2">
      <div class="panel">
        <div class="panel__header"><h2>Inputs</h2></div>
        <div class="panel__body">
          <div class="form-row">
            <div>
              <div class="label">Galactic Radius <span class="unit">ly</span> ${tipIcon(TIP_LABEL["Galactic Radius"] || "")}</div>
              <div class="hint">Used to derive the Galactic Habitable Zone.</div>
            </div>
            <div class="input-pair">
              <input id="clusterGalacticRadius" type="number" min="1000" max="1000000" step="1" aria-label="Galactic Radius" />
              <input id="clusterGalacticRadiusSlider" type="range" aria-label="Galactic Radius slider" />
              <div class="range-meta"><span>1,000</span><span>1,000,000</span></div>
            </div>
          </div>

          <div class="form-row">
            <div>
              <div class="label">Location <span class="unit">ly</span> ${tipIcon(TIP_LABEL["Location"] || "")}</div>
              <div class="hint">Distance from galactic centre.</div>
            </div>
            <div class="input-pair">
              <input id="clusterLocation" type="number" min="0" max="1000000" step="1" aria-label="Location" />
              <input id="clusterLocationSlider" type="range" aria-label="Location slider" />
              <div class="range-meta"><span>0</span><span>1,000,000</span></div>
            </div>
          </div>

          <div class="form-row">
            <div>
              <div class="label">Neighbourhood Radius <span class="unit">ly</span> ${tipIcon(TIP_LABEL["Neighbourhood Radius"] || "")}</div>
              <div class="hint">Local sphere radius used for counts and coordinates.</div>
            </div>
            <div class="input-pair">
              <input id="clusterRadius" type="number" min="0.1" max="500" step="0.1" aria-label="Neighbourhood Radius" />
              <input id="clusterRadiusSlider" type="range" aria-label="Neighbourhood Radius slider" />
              <div class="range-meta"><span>0.1</span><span>500</span></div>
            </div>
          </div>

          <div class="form-row">
            <div>
              <div class="label">Stellar Density <span class="unit">stars/ly^3</span> ${tipIcon(TIP_LABEL["Stellar Density"] || "")}</div>
              <div class="hint">Density of stellar objects in the local neighbourhood.</div>
            </div>
            <div class="input-pair">
              <input id="clusterDensity" type="number" min="0.000001" max="1" step="0.000001" aria-label="Stellar Density" />
              <input id="clusterDensitySlider" type="range" aria-label="Stellar Density slider" />
              <div class="range-meta"><span>0.000001</span><span>1.0</span></div>
            </div>
          </div>

          <div class="form-row">
            <div>
              <div class="label">Random Seed ${tipIcon(TIP_LABEL["Random Seed"] || "")}</div>
              <div class="hint">Integer seed (Park-Miller) for deterministic coordinates.</div>
            </div>
            <div>
              <input id="clusterSeed" type="number" min="1" max="2147483646" step="1" aria-label="Random Seed" />
              <button class="small" id="btnRandomSeed" type="button" title="Generate random seed" style="margin-top:6px;width:100%">Randomise</button>
            </div>
          </div>

          <div class="button-row">
            <button class="primary" id="btnClusterApply" type="button">Apply</button>
            <button id="btnClusterReset" type="button">Reset to Defaults</button>
          </div>
        </div>
      </div>

      <div class="panel">
        <div class="panel__header"><h2>Outputs</h2></div>
        <div class="panel__body">
          <div id="clusterKpis" class="kpi-grid"></div>
        </div>
      </div>
    </div>

    <div class="panel">
      <div class="panel__header"><h2>Stellar Object Breakdown</h2></div>
      <div class="panel__body">
        <div class="hint">Class breakdown ${tipIcon(TIP_LABEL["Class breakdown"] || "")}</div>
        <div class="cluster-table-wrap">
          <table class="cluster-table">
            <thead>
              <tr>
                <th>Type</th>
                <th>Class</th>
                <th></th>
                <th>Count</th>
              </tr>
            </thead>
            <tbody id="clusterObjectsBody"></tbody>
          </table>
        </div>
      </div>
    </div>

    <div class="panel">
      <div class="panel__header"><h2>Import Cluster</h2></div>
      <div class="panel__body">
        <div class="hint">Paste a tab-separated table of star systems to replace the current cluster. The system at (0, 0, 0) is treated as the home star.</div>
        <textarea id="clusterImportText" rows="6" placeholder="System Name&#9;Coordinates (ly)&#9;Distance&#9;Constituents&#10;Home&#9;(0, 0, 0)&#9;0.00 ly&#9;GV&#10;S01&#9;(6.64, 22.03, 8.11)&#9;24.40 ly&#9;MV" style="width:100%;font-family:var(--mono);font-size:0.85rem;resize:vertical"></textarea>
        <div style="margin-top:8px">
          <button id="btnClusterImport" class="action-btn">Import</button>
        </div>
      </div>
    </div>

    <div class="panel">
      <div class="panel__header"><h2>Star System Coordinates</h2></div>
      <div class="panel__body">
        <div class="hint">System Coordinates ${tipIcon(TIP_LABEL["System Coordinates"] || "")}</div>
        <div class="cluster-table-wrap cluster-table-wrap--coords">
          <table class="cluster-table">
            <thead>
              <tr>
                <th>Object</th>
                <th>Name ${tipIcon(TIP_LABEL["System Name"] || "")}</th>
                <th>X (ly)</th>
                <th>Y (ly)</th>
                <th>Z (ly)</th>
                <th>Distance (ly)</th>
                <th>[Fe/H] ${tipIcon(TIP_LABEL["[Fe/H]"])}</th>
                <th>P(giant) ${tipIcon(TIP_LABEL["P(giant)"])}</th>
              </tr>
            </thead>
            <tbody id="clusterSystemsBody"></tbody>
          </table>
        </div>
      </div>
    </div>

    <div id="clusterContextMenu" class="cluster-context-menu" style="display:none">
      <div class="cluster-context-menu__title"></div>
      <div class="cluster-context-menu__items"></div>
    </div>
  `;

  mountEl.appendChild(wrap);
  attachTooltips(wrap);

  const galacticRadiusEl = wrap.querySelector("#clusterGalacticRadius");
  const locationEl = wrap.querySelector("#clusterLocation");
  const radiusEl = wrap.querySelector("#clusterRadius");
  const densityEl = wrap.querySelector("#clusterDensity");
  const seedEl = wrap.querySelector("#clusterSeed");

  const galacticRadiusSlider = wrap.querySelector("#clusterGalacticRadiusSlider");
  const locationSlider = wrap.querySelector("#clusterLocationSlider");
  const radiusSlider = wrap.querySelector("#clusterRadiusSlider");
  const densitySlider = wrap.querySelector("#clusterDensitySlider");

  const kpisEl = wrap.querySelector("#clusterKpis");
  const objectsBodyEl = wrap.querySelector("#clusterObjectsBody");
  const systemsBodyEl = wrap.querySelector("#clusterSystemsBody");

  function resolveSystemDisplayName(system, homeDefaultName) {
    const override = sanitizeSystemName(systemNameOverrides?.[system.id]);
    if (override) return override;
    if (system.isHome) return homeDefaultName;
    return system.name;
  }

  bindNumberAndSlider({
    numberEl: galacticRadiusEl,
    sliderEl: galacticRadiusSlider,
    min: 1000,
    max: 1000000,
    step: 1,
    mode: "auto",
  });
  bindNumberAndSlider({
    numberEl: locationEl,
    sliderEl: locationSlider,
    min: 0,
    max: 1000000,
    step: 1,
    mode: "auto",
  });
  bindNumberAndSlider({
    numberEl: radiusEl,
    sliderEl: radiusSlider,
    min: 0.1,
    max: 500,
    step: 0.1,
    mode: "auto",
  });
  bindNumberAndSlider({
    numberEl: densityEl,
    sliderEl: densitySlider,
    min: 0.000001,
    max: 1,
    step: 0.000001,
    mode: "auto",
  });

  function syncInputsFromState() {
    galacticRadiusEl.value = String(state.galacticRadiusLy);
    locationEl.value = String(state.locationLy);
    radiusEl.value = String(state.neighbourhoodRadiusLy);
    densityEl.value = String(state.stellarDensityPerLy3);
    seedEl.value = String(state.randomSeed);
    galacticRadiusEl.dispatchEvent(new Event("input", { bubbles: true }));
    locationEl.dispatchEvent(new Event("input", { bubbles: true }));
    radiusEl.dispatchEvent(new Event("input", { bubbles: true }));
    densityEl.dispatchEvent(new Event("input", { bubbles: true }));
  }

  function readStateFromInputs() {
    const galacticRadiusLy = clamp(Number(galacticRadiusEl.value), 1000, 1000000);
    const locationLy = clamp(Number(locationEl.value), 0, galacticRadiusLy);
    const neighbourhoodRadiusLy = clamp(Number(radiusEl.value), 0.1, 500);
    const stellarDensityPerLy3 = clamp(Number(densityEl.value), 0.000001, 1);
    const randomSeed = clamp(
      toInteger(seedEl.value, LOCAL_CLUSTER_DEFAULTS.randomSeed),
      1,
      2147483646,
    );

    state.galacticRadiusLy = galacticRadiusLy;
    state.locationLy = locationLy;
    state.neighbourhoodRadiusLy = neighbourhoodRadiusLy;
    state.stellarDensityPerLy3 = stellarDensityPerLy3;
    state.randomSeed = randomSeed;

    galacticRadiusEl.value = String(state.galacticRadiusLy);
    locationEl.value = String(state.locationLy);
    radiusEl.value = String(state.neighbourhoodRadiusLy);
    densityEl.value = String(state.stellarDensityPerLy3);
    seedEl.value = String(state.randomSeed);
    galacticRadiusEl.dispatchEvent(new Event("input", { bubbles: true }));
    locationEl.dispatchEvent(new Event("input", { bubbles: true }));
    radiusEl.dispatchEvent(new Event("input", { bubbles: true }));
    densityEl.dispatchEvent(new Event("input", { bubbles: true }));
  }

  function renderOutputs() {
    systemNameOverrides = getClusterSystemNames();
    const worldNow = loadWorld();
    const homeDefaultName =
      typeof worldNow?.star?.name === "string" && worldNow.star.name.trim()
        ? worldNow.star.name.trim()
        : "home star system";
    const homeFeH = worldNow?.star?.metallicityFeH ?? 0;
    const model = calcLocalCluster({ ...state, homeMetallicityFeH: homeFeH });
    const adjustments = getClusterAdjustments();
    const finalSystems = buildFinalSystems(model, adjustments);
    const countDeltas = computeCountDeltas(model, adjustments);
    lastModel = model;
    lastFinalSystems = finalSystems;
    const kpis = [
      {
        label: "Galactic Habitable Zone",
        tip: TIP_LABEL["Galactic Habitable Zone"],
        value: `${fmt(model.galacticHabitableZoneLy.inner, 0)} - ${fmt(model.galacticHabitableZoneLy.outer, 0)}`,
        meta: "ly",
      },
      {
        label: "In Galactic Habitable Zone?",
        tip: TIP_LABEL["In Galactic Habitable Zone?"],
        value: model.inHabitableZone ? "Yes" : "No",
        meta: `Location ${fmt(model.inputs.locationLy, 0)} ly`,
      },
      {
        label: "GHZ Probability",
        tip: TIP_LABEL["GHZ Probability"],
        value: `${fmt(model.ghzProbability * 100, 1)}%`,
        meta: "Lineweaver (2004) Gaussian model",
      },
      {
        label: "Neighbourhood Volume",
        tip: TIP_LABEL["Neighbourhood Volume"],
        value: fmt(model.neighbourhoodVolumeLy3, 2),
        meta: "ly^3",
      },
      {
        label: "Estimated Stellar-Mass Objects",
        tip: TIP_LABEL["Estimated Stellar-Mass Objects"],
        value: fmt(model.rawStellarMassObjects, 2),
        meta: "raw estimate",
      },
      {
        label: "Main Sequence Total",
        tip: TIP_LABEL["Main Sequence Total"],
        value: fmt(model.mainSequenceTotal, 0),
        meta: "O/B/A/F/G/K/M",
      },
      {
        label: "Total Stellar-Mass Objects",
        tip: TIP_LABEL["Total Stellar-Mass Objects"],
        value: fmt(model.totalStellarMassObjects, 0),
        meta: "rounded class sum",
      },
      {
        label: "Total Star Systems",
        tip: TIP_LABEL["Total Star Systems"],
        value: fmt(model.systemCounts.total, 0),
        meta: `${fmt(model.systemCounts.single, 0)} single | ${fmt(model.systemCounts.binary, 0)} binary | ${fmt(model.systemCounts.triple, 0)} triple | ${fmt(model.systemCounts.quadruple, 0)} quadruple`,
      },
      {
        label: "Generated Neighbours",
        tip: TIP_LABEL["System Coordinates"],
        value: fmt(model.systems.length - 1, 0),
        meta:
          model.systemsOmitted > 0
            ? `plus 1 home — ${fmt(model.systemsOmitted, 0)} systems omitted (visualiser cap: 99)`
            : "plus 1 home system",
      },
    ];

    kpisEl.innerHTML = kpis
      .map(
        (item) => `
      <div class="kpi-wrap">
        <div class="kpi">
          <div class="kpi__label">${esc(item.label)} ${tipIcon(item.tip || "")}</div>
          <div class="kpi__value">${esc(item.value)}</div>
          <div class="kpi__meta">${esc(item.meta)}</div>
        </div>
      </div>
    `,
      )
      .join("");

    objectsBodyEl.innerHTML = model.stellarRows
      .map((row) => {
        const key = normalizeClusterObjectKey(row.objectClassKey ?? row.spectralClass);
        const visual = getClusterObjectVisual(key);
        const adjustedCount = Math.max(0, row.count + (countDeltas[row.objectClassKey] || 0));
        const canRemove = adjustedCount > 0;
        return `
        <tr>
          <td>
            <span class="cluster-object-cell">
              <img class="cluster-object-icon" src="${visual.icon}" alt="" aria-hidden="true" />
              <span>${esc(row.label)}</span>
            </span>
          </td>
          <td>${esc(row.spectralClass)}</td>
          <td class="cluster-adjust-cell">
            <button class="cluster-adjust-btn" data-class="${escapeAttr(row.objectClassKey)}" data-action="add" title="Add ${esc(row.label)}">+</button>
            <button class="cluster-adjust-btn" data-class="${escapeAttr(row.objectClassKey)}" data-action="remove" title="Remove ${esc(row.label)}"${canRemove ? "" : " disabled"}>&#8722;</button>
          </td>
          <td>${fmt(adjustedCount, 0)}</td>
        </tr>
      `;
      })
      .join("");

    systemsBodyEl.innerHTML = finalSystems
      .map((system) => {
        const key = normalizeClusterObjectKey(system.objectClassKey, { isHome: system.isHome });
        const visual = getClusterObjectVisual(key, { isHome: system.isHome });
        const classLabel = formatSystemLabel(system);
        const systemName = resolveSystemDisplayName(system, homeDefaultName);
        return `
        <tr data-system-id="${escapeAttr(system.id)}">
          <td>
            <span class="cluster-object-cell">
              <img class="cluster-object-icon" src="${visual.icon}" alt="" aria-hidden="true" />
              <span class="cluster-object-tag">${esc(classLabel)}</span>
            </span>
          </td>
          <td>
            <input
              class="cluster-name-input"
              type="text"
              maxlength="80"
              data-system-id="${escapeAttr(system.id)}"
              value="${escapeAttr(systemName)}"
              placeholder="${escapeAttr(system.name || "Star System")}"
              aria-label="System name for ${escapeAttr(system.id)}"
            />
          </td>
          <td>${fmt(system.x, 2)}</td>
          <td>${fmt(system.y, 2)}</td>
          <td>${fmt(system.z, 2)}</td>
          <td>${formatLy(system.distanceLy, 2)}</td>
          <td>${fmtFeH(system.metallicityFeH)}</td>
          <td>${fmt(giantPlanetProbability(system.metallicityFeH) * 100, 1)}%</td>
        </tr>
      `;
      })
      .join("");
  }

  function hasAdjustments() {
    const adj = getClusterAdjustments();
    return (
      adj.addedSystems.length > 0 ||
      adj.removedSystemIds.length > 0 ||
      Object.keys(adj.componentOverrides).length > 0
    );
  }

  function confirmClearAdjustments() {
    if (!hasAdjustments()) return true;
    return confirm(
      "You have manually added or modified star systems. This action will discard those changes. Continue?",
    );
  }

  function clearAdjustments() {
    updateClusterAdjustments({
      addedSystems: [],
      removedSystemIds: [],
      componentOverrides: {},
    });
  }

  function applyChanges() {
    if (!confirmClearAdjustments()) return;
    readStateFromInputs();
    updateClusterInputs(state);
    clearAdjustments();
    renderOutputs();
  }

  function resetToDefaults() {
    if (!confirmClearAdjustments()) return;
    Object.assign(state, LOCAL_CLUSTER_DEFAULTS);
    syncInputsFromState();
    updateClusterInputs(state);
    clearAdjustments();
    renderOutputs();
  }

  wrap.querySelector("#btnClusterApply")?.addEventListener("click", applyChanges);
  wrap.querySelector("#btnClusterReset")?.addEventListener("click", resetToDefaults);

  // Import cluster from pasted table
  const importTextEl = wrap.querySelector("#clusterImportText");
  wrap.querySelector("#btnClusterImport")?.addEventListener("click", () => {
    const text = (importTextEl?.value || "").trim();
    if (!text) return;

    const parsed = parseClusterTable(text);
    if (parsed.length === 0) {
      alert(
        "Could not parse any systems from the pasted text. Expected tab-separated columns: System Name, Coordinates (ly), Distance, Constituents.",
      );
      return;
    }

    const homeSys = parsed.find((s) => s.isHome);
    const nonHome = parsed.filter((s) => !s.isHome);

    // Update neighbourhood radius to encompass all systems
    const maxDist = Math.max(...parsed.map((s) => s.distanceLy));
    if (maxDist > state.neighbourhoodRadiusLy) {
      state.neighbourhoodRadiusLy = Math.ceil(maxDist + 1);
      radiusEl.value = String(state.neighbourhoodRadiusLy);
      radiusEl.dispatchEvent(new Event("input", { bubbles: true }));
      updateClusterInputs(state);
    }

    // Run engine to get generated system IDs, then remove them all
    const model = calcLocalCluster(state);
    const removedSystemIds = model.systems.filter((s) => !s.isHome).map((s) => s.id);

    updateClusterAdjustments({
      addedSystems: nonHome,
      removedSystemIds,
      componentOverrides: {},
    });

    // Set system names
    const names = {};
    if (homeSys) names["home"] = homeSys.name;
    for (const sys of nonHome) names[sys.id] = sys.name;
    updateClusterSystemNames(names);

    renderOutputs();
  });

  // Random seed button
  wrap.querySelector("#btnRandomSeed")?.addEventListener("click", () => {
    if (!confirmClearAdjustments()) return;
    seedEl.value = String(1 + Math.floor(Math.random() * 2147483645));
    readStateFromInputs();
    updateClusterInputs(state);
    clearAdjustments();
    renderOutputs();
  });

  // System name editing
  systemsBodyEl?.addEventListener("change", (event) => {
    const input = event.target?.closest?.(".cluster-name-input");
    if (!input) return;
    const systemId = String(input.dataset.systemId || "").trim();
    if (!systemId) return;
    const nextName = sanitizeSystemName(input.value);
    if (nextName) systemNameOverrides[systemId] = nextName;
    else delete systemNameOverrides[systemId];
    updateClusterSystemNames(systemNameOverrides);
    input.value = nextName;
  });

  systemsBodyEl?.addEventListener("keydown", (event) => {
    const input = event.target?.closest?.(".cluster-name-input");
    if (!input) return;
    if (event.key !== "Enter") return;
    event.preventDefault();
    input.blur();
  });

  // +/- buttons on breakdown table
  objectsBodyEl?.addEventListener("click", (event) => {
    const btn = event.target?.closest?.(".cluster-adjust-btn");
    if (!btn) return;
    const classKey = btn.dataset.class;
    const action = btn.dataset.action;
    if (!classKey || !action) return;

    const adj = getClusterAdjustments();
    const zScale =
      state.neighbourhoodRadiusLy > 50
        ? Math.max(0.15, 1 - (state.neighbourhoodRadiusLy - 50) / 1000)
        : 1.0;

    if (action === "add") {
      const pos = randomPositionInSphere(state.neighbourhoodRadiusLy, zScale);
      const id = "added-" + Date.now() + "-" + Math.floor(Math.random() * 10000);
      adj.addedSystems.push({
        id,
        name: "Star System (added)",
        index: (lastFinalSystems.length || 0) + 1,
        isHome: false,
        objectClassKey: classKey,
        multiplicity: "single",
        components: [{ objectClassKey: classKey }],
        metallicityFeH: 0,
        ...pos,
      });
    } else if (action === "remove") {
      // Prefer removing from addedSystems first
      const addedIdx = findLastIndex(adj.addedSystems, (s) => s.objectClassKey === classKey);
      if (addedIdx >= 0) {
        adj.addedSystems.splice(addedIdx, 1);
      } else if (lastModel) {
        // Find an engine system to remove (not home, not already removed)
        const removedSet = new Set(adj.removedSystemIds);
        const candidates = lastModel.systems.filter(
          (s) => !s.isHome && !removedSet.has(s.id) && s.objectClassKey === classKey,
        );
        if (candidates.length > 0) {
          adj.removedSystemIds.push(candidates[candidates.length - 1].id);
        }
      }
    }

    updateClusterAdjustments(adj);
    renderOutputs();
  });

  // Context menu
  const contextMenuEl = wrap.querySelector("#clusterContextMenu");
  const contextTitleEl = contextMenuEl?.querySelector(".cluster-context-menu__title");
  const contextItemsEl = contextMenuEl?.querySelector(".cluster-context-menu__items");

  function hideContextMenu() {
    if (contextMenuEl) contextMenuEl.style.display = "none";
  }

  function showContextMenu(x, y, systemId) {
    const system = lastFinalSystems.find((s) => s.id === systemId);
    if (!system) return;

    const components = system.components || [{ objectClassKey: system.objectClassKey }];
    const count = components.length;
    const classLabel = formatSystemLabel(system);
    contextTitleEl.textContent = classLabel + " system";

    let html = "";

    // Add companion options (max 4 components = quadruple)
    if (count < 4) {
      html += '<div class="cluster-context-menu__sep"></div>';
      for (const cls of COMPANION_CLASSES) {
        const visual = getClusterObjectVisual(normalizeClusterObjectKey(cls.key));
        html += `<div class="cluster-context-menu__item" data-action="add-companion" data-system-id="${escapeAttr(systemId)}" data-class="${escapeAttr(cls.key)}">
          <img class="cluster-object-icon" src="${visual.icon}" alt="" aria-hidden="true" />
          Add ${esc(cls.label)}
        </div>`;
      }
    }

    // Remove companion options (only non-primary components)
    if (count > 1) {
      html += '<div class="cluster-context-menu__sep"></div>';
      for (let i = 1; i < components.length; i++) {
        const comp = components[i];
        const compKey = normalizeClusterObjectKey(comp.objectClassKey);
        const visual = getClusterObjectVisual(compKey);
        const label = compKey === "LTY" ? "L/T/Y" : compKey;
        html += `<div class="cluster-context-menu__item danger" data-action="remove-companion" data-system-id="${escapeAttr(systemId)}" data-comp-index="${i}">
          <img class="cluster-object-icon" src="${visual.icon}" alt="" aria-hidden="true" />
          Remove ${esc(label)} companion
        </div>`;
      }
    }

    if (!html) {
      html =
        '<div class="cluster-context-menu__item" style="opacity:0.5;cursor:default">No actions available</div>';
    }

    contextItemsEl.innerHTML = html;

    // Position clamped to viewport
    const menuW = 220;
    const menuH = contextMenuEl.offsetHeight || 200;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    contextMenuEl.style.left = Math.min(x, vw - menuW - 10) + "px";
    contextMenuEl.style.top = Math.min(y, vh - menuH - 10) + "px";
    contextMenuEl.style.display = "block";
  }

  systemsBodyEl?.addEventListener("contextmenu", (event) => {
    const tr = event.target?.closest?.("tr[data-system-id]");
    if (!tr) return;
    event.preventDefault();
    const systemId = tr.dataset.systemId;
    if (!systemId) return;
    showContextMenu(event.clientX, event.clientY, systemId);
  });

  contextMenuEl?.addEventListener("click", (event) => {
    const item = event.target?.closest?.(".cluster-context-menu__item");
    if (!item) return;
    const action = item.dataset.action;
    const systemId = item.dataset.systemId;
    if (!action || !systemId) return;

    const adj = getClusterAdjustments();

    if (action === "add-companion") {
      const classKey = item.dataset.class;
      if (!classKey) return;
      const isAdded = systemId.startsWith("added-");
      if (isAdded) {
        const sys = adj.addedSystems.find((s) => s.id === systemId);
        if (sys && (sys.components || []).length < 4) {
          sys.components.push({ objectClassKey: classKey });
          sys.multiplicity = multiplicityFromCount(sys.components.length);
        }
      } else {
        // Engine system — use componentOverrides
        const existing = adj.componentOverrides[systemId];
        const baseSys = lastModel?.systems.find((s) => s.id === systemId);
        const baseComps = existing
          ? existing.components
          : (baseSys?.components || []).map((c) => ({ ...c }));
        if (baseComps.length < 4) {
          const newComps = [...baseComps, { objectClassKey: classKey }];
          adj.componentOverrides[systemId] = {
            components: newComps,
            multiplicity: multiplicityFromCount(newComps.length),
          };
        }
      }
    } else if (action === "remove-companion") {
      const compIndex = Number(item.dataset.compIndex);
      if (!Number.isFinite(compIndex) || compIndex < 1) return;
      const isAdded = systemId.startsWith("added-");
      if (isAdded) {
        const sys = adj.addedSystems.find((s) => s.id === systemId);
        if (sys && sys.components.length > 1) {
          sys.components.splice(compIndex, 1);
          sys.multiplicity = multiplicityFromCount(sys.components.length);
        }
      } else {
        const existing = adj.componentOverrides[systemId];
        const baseSys = lastModel?.systems.find((s) => s.id === systemId);
        const baseComps = existing
          ? [...existing.components]
          : (baseSys?.components || []).map((c) => ({ ...c }));
        if (baseComps.length > 1 && compIndex < baseComps.length) {
          baseComps.splice(compIndex, 1);
          if (
            baseComps.length === (baseSys?.components || []).length &&
            baseComps.every((c, i) => c.objectClassKey === baseSys.components[i]?.objectClassKey)
          ) {
            delete adj.componentOverrides[systemId];
          } else {
            adj.componentOverrides[systemId] = {
              components: baseComps,
              multiplicity: multiplicityFromCount(baseComps.length),
            };
          }
        }
      }
    }

    updateClusterAdjustments(adj);
    hideContextMenu();
    renderOutputs();
  });

  // Dismiss context menu
  document.addEventListener("click", (event) => {
    if (contextMenuEl && !contextMenuEl.contains(event.target)) {
      hideContextMenu();
    }
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") hideContextMenu();
  });

  // Enter key on inputs
  [galacticRadiusEl, locationEl, radiusEl, densityEl, seedEl].forEach((inputEl) => {
    inputEl?.addEventListener("keydown", (event) => {
      if (event.key === "Enter") applyChanges();
    });
  });

  syncInputsFromState();
  renderOutputs();
}

function findLastIndex(arr, predicate) {
  for (let i = arr.length - 1; i >= 0; i--) {
    if (predicate(arr[i])) return i;
  }
  return -1;
}
