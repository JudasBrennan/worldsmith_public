import { calcPopulation, TECH_ERAS } from "../engine/population.js";
import { calcClimateZones } from "../engine/climate.js";
import { calcPlanetExact } from "../engine/planet.js";
import { fmt } from "../engine/utils.js";
import { attachTooltips, tipIcon } from "./tooltip.js";
import { escapeHtml } from "./uiHelpers.js";
import {
  getSelectedPlanet,
  getStarOverrides,
  listPlanets,
  loadWorld,
  selectPlanet,
  updateWorld,
} from "./store.js";

// ── Tooltips ────────────────────────────────────────────────

const TIP_LABEL = {
  Population:
    "Procedural population model combining land-use analysis, " +
    "logistic (Verhulst) growth, and Zipf rank-size distribution.\n\n" +
    "Land area, habitability, and productivity are auto-derived from the " +
    "planet\u2019s water regime and climate zones; civilization parameters " +
    "(tech era, growth rate, time) are user-configurable.",
  "Technology Era":
    "Civilization technology level determining base population density " +
    "(people per km\u00b2 of productive land) and default growth rate.\n\n" +
    "Hunter-Gatherer: ~0.05/km\u00b2.  Medieval: ~30/km\u00b2.  " +
    "Industrial: ~200/km\u00b2.  Sci-Fi High: ~1,000/km\u00b2.",
  "Growth Rate":
    "Intrinsic growth rate r (per year) for the Verhulst logistic model. " +
    "This is the maximum rate when population is far below carrying capacity.\n\n" +
    "The effective rate slows automatically as P approaches K: " +
    "r_eff = r \u00d7 (1 \u2212 P/K).\n\n" +
    "Reference: Verhulst (1838, Correspondance math\u00e9matique et physique).",
  "Carrying Capacity":
    "Maximum sustainable population K = productive area \u00d7 density \u00d7 " +
    "crop-efficiency factor.\n\n" +
    "Crops feed ~4\u00d7 more people per unit area than livestock (FAO, 2020). " +
    "A 100% crop world supports ~1.3\u00d7 more than the 77/23 Earth default.",
  "Ocean Coverage":
    "Percentage of the planet\u2019s surface covered by ocean. " +
    "Auto-derived from the water regime; override to set manually.\n\n" +
    "Earth: ~71%.  Mars-like (Dry): ~0%.",
  Habitability:
    "Fraction of land area that is habitable, derived from climate zones. " +
    "K\u00f6ppen master classes E (polar) and X (special) are excluded.\n\n" +
    "Area-weighted by spherical zone geometry.",
  Productivity:
    "Fraction of habitable land that is productive (arable or grazing-suitable). " +
    "Based on aridity index: deserts ~5%, steppes ~30%, " +
    "temperate/tropical ~80\u2013100%.",
  "Crop Fraction":
    "Percentage of productive land used for crops versus livestock grazing.\n\n" +
    "Earth: ~77% crops, ~23% livestock (FAO, 2020). " +
    "Crops feed ~4\u00d7 more people per unit area.",
  "Zipf Exponent":
    "Controls how unevenly population is distributed across regions. " +
    "P(rank) = P(1) / rank^q.\n\n" +
    "q = 1.0: standard Zipf\u2019s law (2nd region = \u00bd of 1st). " +
    "q < 1.0: more even.  q > 1.0: more concentrated.\n\n" +
    "Empirical range for Earth: q \u2248 0.8\u20131.2.\n\n" +
    "Reference: Zipf (1949, Human Behavior and the Principle of Least Effort).",
  "Current Population":
    "Projected population after logistic growth from the initial population " +
    "over the elapsed time.\n\n" +
    "P(t) = K / (1 + ((K − P₀) / P₀) × e^(−r × t)).\n\n" +
    "Approaches carrying capacity K as time increases.",
  Saturation:
    "Population as a percentage of carrying capacity (P / K × 100%).\n\n" +
    "Below ~50%: growth is near-exponential.  " +
    "Above ~50%: growth decelerates as resources become scarce.",
  "Habitable Density":
    "People per km² of habitable land area.\n\n" +
    "Habitable land excludes polar (E) and special (X) climate zones.",
  "Surface Area":
    "Total surface area of the planet (4πr²).\n\n" +
    "Split into ocean and land fractions by the ocean coverage percentage.",
  "Land Area":
    "Non-ocean portion of the planet's surface.\n\n" + "Land Area = Surface Area × (1 − Ocean%).",
  "Habitable Area":
    "Portion of land area with climate zones suitable for settlement " +
    "(excludes polar and special zones).\n\n" +
    "Derived from climate zone data or the habitable % override.",
  "Productive Area":
    "Arable and grazing-suitable land within the habitable area.\n\n" +
    "Productivity fraction is driven by aridity index: " +
    "deserts ~5%, steppes ~30%, temperate/tropical ~80–100%.",
  "Doubling Time":
    "Time for the population to double at the current effective growth rate.\n\n" +
    "t₂ = ln(2) / r_eff.  Increases as population approaches " +
    "carrying capacity because r_eff slows.",
  "Overall Density":
    "People per km² of total land area (including uninhabitable land).\n\n" +
    "Compare with habitable density to gauge how much land is actually settled.",
  "Initial Population":
    "Starting population P₀ at time t = 0 for the logistic growth curve.\n\n" +
    "Smaller values produce a longer exponential phase before the S-curve inflects.",
  "Time Elapsed":
    "Number of years elapsed since the initial population.\n\n" +
    "The orange marker on the growth curve shows the current time position.",
  Continents:
    "Number of major landmasses for the Zipf rank-size distribution.\n\n" +
    "Population is divided among continents by Zipf's law, " +
    "then each continent is further subdivided into regions.",
  "Regions per Continent":
    "Number of regional subdivisions within each continent.\n\n" +
    "Regions within a continent also follow a Zipf rank-size distribution " +
    "with the same exponent q.",
  "Land Use Cascade":
    "Visual breakdown showing how the planet's surface area cascades " +
    "from total surface → land → habitable → productive.\n\n" +
    "Each bar shows the split as a percentage.",
  "Growth Curve":
    "Logistic (Verhulst) S-curve showing population over time.\n\n" +
    "The dashed line marks carrying capacity K.  " +
    "The orange marker shows the current elapsed time.",
};

// ── Planet context extraction ───────────────────────────────

function getPopulationContext(world) {
  const fallback = {
    radiusKm: 6371,
    waterRegime: "Extensive oceans",
    climateZones: [],
  };
  const planet = getSelectedPlanet(world);
  if (!planet) return fallback;

  const sov = getStarOverrides(world?.star);
  const model = calcPlanetExact({
    starMassMsol: Number(world?.star?.massMsol) || 1,
    starAgeGyr: Number(world?.star?.ageGyr) || 4.6,
    starRadiusRsolOverride: sov.r,
    starLuminosityLsolOverride: sov.l,
    starTempKOverride: sov.t,
    starEvolutionMode: sov.ev,
    planet: planet.inputs || {},
  });

  if (!model?.derived) return fallback;

  const climate = calcClimateZones({
    surfaceTempK: model.derived.surfaceTempK || 288,
    axialTiltDeg: model.inputs?.axialTiltDeg ?? 23.44,
    circulationCellCount: model.derived.circulationCellCount || "3",
    circulationCellRanges: model.derived.circulationCellRanges || [],
    h2oPct: model.inputs?.h2oPct || 0,
    waterRegime: model.derived.waterRegime || "Extensive oceans",
    pressureAtm: model.inputs?.pressureAtm ?? 1,
    tidallyLockedToStar: !!model.derived.tidallyLockedToStar,
    compositionClass: model.derived.compositionClass || "Earth-like",
    liquidWaterPossible: !!model.derived.liquidWaterPossible,
    gravityG: model.derived.gravityG || 1,
  });

  return {
    radiusKm: model.derived.radiusKm || 6371,
    waterRegime: model.derived.waterRegime || "Extensive oceans",
    climateZones: climate.zones || [],
  };
}

// ── Canvas: growth curve ────────────────────────────────────

function drawGrowthCurve(canvas, timeSeries, K, currentT) {
  const ctx = canvas.getContext("2d");
  const dpr = window.devicePixelRatio || 1;
  const w = canvas.clientWidth;
  const h = canvas.clientHeight;
  canvas.width = w * dpr;
  canvas.height = h * dpr;
  ctx.scale(dpr, dpr);

  const textColor = getComputedStyle(canvas).getPropertyValue("color") || "#ccc";
  const accentColor = "#7eb2ff";
  const mutedColor = "#a6abcc";

  const PAD = { top: 16, bottom: 28, left: 64, right: 16 };
  const plotW = w - PAD.left - PAD.right;
  const plotH = h - PAD.top - PAD.bottom;

  ctx.clearRect(0, 0, w, h);

  if (!timeSeries.length || K <= 0) return;

  const tMax = timeSeries[timeSeries.length - 1].year || 1;
  const pMax = K * 1.05;

  function xOf(t) {
    return PAD.left + (t / tMax) * plotW;
  }
  function yOf(p) {
    return PAD.top + plotH - (p / pMax) * plotH;
  }

  // Grid
  ctx.strokeStyle = "rgba(255,255,255,0.06)";
  ctx.lineWidth = 1;
  for (let i = 1; i <= 4; i++) {
    const gy = PAD.top + (plotH * i) / 5;
    ctx.beginPath();
    ctx.moveTo(PAD.left, gy);
    ctx.lineTo(PAD.left + plotW, gy);
    ctx.stroke();
  }

  // K dashed line
  ctx.strokeStyle = mutedColor;
  ctx.lineWidth = 1;
  ctx.setLineDash([6, 4]);
  const ky = yOf(K);
  ctx.beginPath();
  ctx.moveTo(PAD.left, ky);
  ctx.lineTo(PAD.left + plotW, ky);
  ctx.stroke();
  ctx.setLineDash([]);

  // K label
  ctx.fillStyle = mutedColor;
  ctx.font = "9px var(--font-mono, monospace)";
  ctx.textAlign = "left";
  ctx.fillText("K", PAD.left + 4, ky - 4);

  // S-curve
  ctx.strokeStyle = accentColor;
  ctx.lineWidth = 2;
  ctx.beginPath();
  timeSeries.forEach((pt, i) => {
    const x = xOf(pt.year);
    const y = yOf(pt.population);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.stroke();

  // Current-time marker
  if (currentT > 0 && currentT <= tMax) {
    const mx = xOf(currentT);
    ctx.strokeStyle = "#ff9966";
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    ctx.moveTo(mx, PAD.top);
    ctx.lineTo(mx, PAD.top + plotH);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.fillStyle = "#ff9966";
    ctx.font = "9px var(--font-mono, monospace)";
    ctx.textAlign = "center";
    ctx.fillText("t", mx, PAD.top - 4);
  }

  // Axes labels
  ctx.fillStyle = textColor;
  ctx.font = "9px var(--font-mono, monospace)";

  // Y-axis
  ctx.textAlign = "right";
  const ySteps = 4;
  for (let i = 0; i <= ySteps; i++) {
    const val = (K * i) / ySteps;
    const y = yOf(val);
    ctx.fillText(fmtAxisPop(val), PAD.left - 6, y + 3);
  }

  // X-axis
  ctx.textAlign = "center";
  const xSteps = 5;
  for (let i = 0; i <= xSteps; i++) {
    const val = (tMax * i) / xSteps;
    const x = xOf(val);
    ctx.fillText(fmt(val, 0), x, PAD.top + plotH + 16);
  }

  // Axis titles
  ctx.fillStyle = mutedColor;
  ctx.textAlign = "center";
  ctx.fillText("Years", PAD.left + plotW / 2, h - 2);
}

function fmtAxisPop(n) {
  if (n >= 1e12) return fmt(n / 1e12, 1) + "T";
  if (n >= 1e9) return fmt(n / 1e9, 1) + "B";
  if (n >= 1e6) return fmt(n / 1e6, 1) + "M";
  if (n >= 1e3) return fmt(n / 1e3, 0) + "K";
  return fmt(n, 0);
}

// ── Canvas: land-use cascade ────────────────────────────────

function drawLandUseCascade(canvas, model) {
  const ctx = canvas.getContext("2d");
  const dpr = window.devicePixelRatio || 1;
  const w = canvas.clientWidth;
  const h = canvas.clientHeight;
  canvas.width = w * dpr;
  canvas.height = h * dpr;
  ctx.scale(dpr, dpr);

  const textColor = getComputedStyle(canvas).getPropertyValue("color") || "#ccc";

  const PAD = { left: 80, right: 8, top: 4, bottom: 4 };
  const barW = w - PAD.left - PAD.right;
  const rowH = Math.floor((h - PAD.top - PAD.bottom) / 3);
  const gap = 3;

  const total = model.population.surfaceAreaKm2 || 1;
  const landFrac = model.population.landAreaKm2 / total;
  const habFrac =
    model.population.landAreaKm2 > 0
      ? model.population.habitableAreaKm2 / model.population.landAreaKm2
      : 0;
  const prodFrac =
    model.population.habitableAreaKm2 > 0
      ? model.population.productiveAreaKm2 / model.population.habitableAreaKm2
      : 0;

  const rows = [
    {
      label: "Surface",
      fracs: [
        { f: 1 - landFrac, c: "#3a7cc4", l: "Ocean" },
        { f: landFrac, c: "#6b8f5e", l: "Land" },
      ],
    },
    {
      label: "Land",
      fracs: [
        { f: 1 - habFrac, c: "#666", l: "Uninhabitable" },
        { f: habFrac, c: "#6b8f5e", l: "Habitable" },
      ],
    },
    {
      label: "Habitable",
      fracs: [
        { f: 1 - prodFrac, c: "#8a7a55", l: "Unproductive" },
        { f: prodFrac, c: "#6b8f5e", l: "Productive" },
      ],
    },
  ];

  rows.forEach((row, ri) => {
    const y = PAD.top + ri * (rowH + gap);

    // Row label
    ctx.fillStyle = textColor;
    ctx.font = "10px var(--font-mono, monospace)";
    ctx.textAlign = "right";
    ctx.fillText(row.label, PAD.left - 8, y + rowH / 2 + 4);

    // Segments
    let x = PAD.left;
    for (const seg of row.fracs) {
      const segW = barW * seg.f;
      if (segW < 1) continue;
      ctx.fillStyle = seg.c;
      ctx.globalAlpha = 0.5;
      ctx.fillRect(x, y, Math.max(segW - 1, 1), rowH);
      ctx.globalAlpha = 1;
      if (segW > 30) {
        ctx.fillStyle = textColor;
        ctx.font = "9px var(--font-mono, monospace)";
        ctx.textAlign = "center";
        const full = `${seg.l} ${fmt(seg.f * 100, 0)}%`;
        const short = `${fmt(seg.f * 100, 0)}%`;
        const pad = 6;
        const label = ctx.measureText(full).width + pad < segW ? full : short;
        if (ctx.measureText(label).width + pad < segW) {
          ctx.fillText(label, x + segW / 2, y + rowH / 2 + 3);
        }
      }
      x += segW;
    }
  });
}

// ── Page init ───────────────────────────────────────────────

export function initPopulationPage(containerEl) {
  const world = loadWorld();
  const planets = listPlanets(world);

  if (!planets.length) {
    containerEl.innerHTML = `
      <div class="page">
        <div class="panel">
          <div class="panel__header"><h1 class="panel__title">Population</h1></div>
          <div class="panel__body">
            <p class="hint">Create a planet on the <a href="#/planet">Planets</a> page first.</p>
          </div>
        </div>
      </div>`;
    return;
  }

  const pop = world.population || {};
  const state = {
    techEra: pop.techEra || "Medieval",
    initialPopulation: pop.initialPopulation || 1000,
    growthRate: pop.growthRate ?? null,
    timeElapsedYears: pop.timeElapsedYears ?? 500,
    continentCount: pop.continentCount || 6,
    regionCount: pop.regionCount || 10,
    zipfExponent: pop.zipfExponent ?? 1.0,
    oceanPctOverride: pop.oceanPctOverride ?? null,
    habitablePctOverride: pop.habitablePctOverride ?? null,
    productivePctOverride: pop.productivePctOverride ?? null,
    cropPctOverride: pop.cropPctOverride ?? null,
  };

  function save() {
    updateWorld({ population: { ...state } });
  }

  function render() {
    const w = loadWorld();
    const pList = listPlanets(w);
    const selected = getSelectedPlanet(w);
    const pCtx = getPopulationContext(w);
    const model = calcPopulation({ ...pCtx, ...state });

    // Planet selector
    const planetOptions = pList
      .map((p) => {
        const name = escapeHtml(p.name || p.inputs?.name || p.id);
        const sel = p.id === selected?.id ? " selected" : "";
        return `<option value="${escapeHtml(p.id)}"${sel}>${name}</option>`;
      })
      .join("");

    // Tech era options
    const eraOptions = TECH_ERAS.map(
      (e) =>
        `<option value="${escapeHtml(e)}"${e === state.techEra ? " selected" : ""}>${escapeHtml(e)}</option>`,
    ).join("");

    // Auto badges
    const autoBadge = (isAuto) => (isAuto ? '<span class="pop-auto-badge">auto</span>' : "");

    containerEl.innerHTML = `
      <div class="page">
        <div class="panel">
          <div class="panel__header">
            <h1 class="panel__title">Population ${tipIcon(TIP_LABEL["Population"])}</h1>
          </div>
          <div class="panel__body">

            <div class="form-row">
              <label for="popPlanetSelect">Planet</label>
              <select id="popPlanetSelect">${planetOptions}</select>
            </div>

            <div class="kpi-grid">
              <div class="kpi-wrap"><div class="kpi">
                <div class="kpi__label">Population ${tipIcon(TIP_LABEL["Current Population"])}</div>
                <div class="kpi__value">${escapeHtml(model.display.currentPopulation)}</div>
              </div></div>
              <div class="kpi-wrap"><div class="kpi">
                <div class="kpi__label">Carrying Capacity ${tipIcon(TIP_LABEL["Carrying Capacity"])}</div>
                <div class="kpi__value">${escapeHtml(model.display.carryingCapacity)}</div>
              </div></div>
              <div class="kpi-wrap"><div class="kpi">
                <div class="kpi__label">Saturation ${tipIcon(TIP_LABEL["Saturation"])}</div>
                <div class="kpi__value">${escapeHtml(model.display.saturation)}</div>
              </div></div>
              <div class="kpi-wrap"><div class="kpi">
                <div class="kpi__label">Habitable Density ${tipIcon(TIP_LABEL["Habitable Density"])}</div>
                <div class="kpi__value">${escapeHtml(model.display.habitableDensity)}</div>
              </div></div>
            </div>

            <div class="grid-2" style="margin-top:12px">
              <div class="subsection">
                <h3>Land Use ${tipIcon(TIP_LABEL["Land Use Cascade"])}</h3>

                <div class="form-row">
                  <label>Ocean % ${autoBadge(model.inputs.oceanIsAuto)} ${tipIcon(TIP_LABEL["Ocean Coverage"])}</label>
                  <input type="range" id="popOcean" min="0" max="99" step="1"
                    value="${model.inputs.oceanPct}">
                  <span class="derived-readout">${fmt(model.inputs.oceanPct, 0)}%</span>
                </div>

                <div class="form-row">
                  <label>Habitable % ${autoBadge(model.inputs.habitableIsAuto)} ${tipIcon(TIP_LABEL["Habitability"])}</label>
                  <input type="range" id="popHabitable" min="0" max="100" step="1"
                    value="${model.inputs.habitablePct}">
                  <span class="derived-readout">${fmt(model.inputs.habitablePct, 0)}%</span>
                </div>

                <div class="form-row">
                  <label>Productive % ${autoBadge(model.inputs.productiveIsAuto)} ${tipIcon(TIP_LABEL["Productivity"])}</label>
                  <input type="range" id="popProductive" min="0" max="100" step="1"
                    value="${model.inputs.productivePct}">
                  <span class="derived-readout">${fmt(model.inputs.productivePct, 0)}%</span>
                </div>

                <div class="form-row">
                  <label>Crop % ${tipIcon(TIP_LABEL["Crop Fraction"])}</label>
                  <input type="range" id="popCrop" min="0" max="100" step="1"
                    value="${model.inputs.cropPct}">
                  <span class="derived-readout">${fmt(model.inputs.cropPct, 0)}%</span>
                </div>

                <button id="popResetAuto" class="btn btn--sm" style="margin-top:4px">Reset to auto</button>

                <canvas id="popCascadeCanvas" class="pop-cascade-canvas"></canvas>

                <div class="kpi-grid" style="margin-top:8px">
                  <div class="kpi-wrap"><div class="kpi">
                    <div class="kpi__label">Surface Area ${tipIcon(TIP_LABEL["Surface Area"])}</div>
                    <div class="kpi__value">${escapeHtml(model.display.surfaceArea)}</div>
                  </div></div>
                  <div class="kpi-wrap"><div class="kpi">
                    <div class="kpi__label">Land Area ${tipIcon(TIP_LABEL["Land Area"])}</div>
                    <div class="kpi__value">${escapeHtml(model.display.landArea)}</div>
                  </div></div>
                  <div class="kpi-wrap"><div class="kpi">
                    <div class="kpi__label">Habitable Area ${tipIcon(TIP_LABEL["Habitable Area"])}</div>
                    <div class="kpi__value">${escapeHtml(model.display.habitableArea)}</div>
                  </div></div>
                  <div class="kpi-wrap"><div class="kpi">
                    <div class="kpi__label">Productive Area ${tipIcon(TIP_LABEL["Productive Area"])}</div>
                    <div class="kpi__value">${escapeHtml(model.display.productiveArea)}</div>
                  </div></div>
                </div>
              </div>

              <div class="subsection">
                <h3>Growth Model ${tipIcon(TIP_LABEL["Growth Curve"])}</h3>

                <div class="form-row">
                  <label for="popTechEra">Tech Era ${tipIcon(TIP_LABEL["Technology Era"])}</label>
                  <select id="popTechEra">${eraOptions}</select>
                </div>

                <div class="form-row">
                  <label>Initial Population ${tipIcon(TIP_LABEL["Initial Population"])}</label>
                  <input type="number" id="popInitPop" min="1" step="1"
                    value="${state.initialPopulation}">
                </div>

                <div class="form-row">
                  <label>Growth Rate ${tipIcon(TIP_LABEL["Growth Rate"])}</label>
                  <input type="range" id="popGrowthRate" min="0.001" max="0.05" step="0.001"
                    value="${model.inputs.growthRate}">
                  <span class="derived-readout">${escapeHtml(model.display.growthRate)}</span>
                </div>

                <div class="form-row">
                  <label>Time Elapsed (years) ${tipIcon(TIP_LABEL["Time Elapsed"])}</label>
                  <input type="number" id="popTime" min="0" step="10"
                    value="${state.timeElapsedYears}">
                </div>

                <canvas id="popGrowthCanvas" class="pop-growth-canvas"></canvas>

                <div class="kpi-grid" style="margin-top:8px">
                  <div class="kpi-wrap"><div class="kpi">
                    <div class="kpi__label">Doubling Time ${tipIcon(TIP_LABEL["Doubling Time"])}</div>
                    <div class="kpi__value">${escapeHtml(model.display.doublingTime)}</div>
                  </div></div>
                  <div class="kpi-wrap"><div class="kpi">
                    <div class="kpi__label">Overall Density ${tipIcon(TIP_LABEL["Overall Density"])}</div>
                    <div class="kpi__value">${escapeHtml(model.display.overallDensity)}</div>
                  </div></div>
                </div>
              </div>
            </div>

            <div class="subsection" style="margin-top:12px">
              <h3>Distribution ${tipIcon(TIP_LABEL["Zipf Exponent"])}</h3>

              <div class="grid-2">
                <div class="form-row">
                  <label>Continents ${tipIcon(TIP_LABEL["Continents"])}</label>
                  <input type="number" id="popContCount" min="1" max="20" step="1"
                    value="${state.continentCount}">
                </div>
                <div class="form-row">
                  <label>Regions per Continent ${tipIcon(TIP_LABEL["Regions per Continent"])}</label>
                  <input type="number" id="popRegCount" min="1" max="50" step="1"
                    value="${state.regionCount}">
                </div>
              </div>

              <div class="form-row">
                <label>Zipf Exponent (q) ${tipIcon(TIP_LABEL["Zipf Exponent"])}</label>
                <input type="range" id="popZipf" min="0.5" max="1.5" step="0.05"
                  value="${state.zipfExponent}">
                <span class="derived-readout">${fmt(state.zipfExponent, 2)}</span>
              </div>

              <div class="pop-dist-list">
                ${model.population.continents
                  .map(
                    (c) => `
                  <details class="pop-dist-card">
                    <summary class="pop-dist-summary">
                      <span class="pop-dist-rank">Continent ${c.rank}</span>
                      <span class="pop-dist-pop">${fmtAxisPop(c.population)}</span>
                      <span class="pop-dist-frac">${fmt(c.fraction * 100, 1)}%</span>
                      <span class="pop-dist-bar-wrap">
                        <span class="pop-dist-bar" style="width:${(c.fraction * 100).toFixed(1)}%"></span>
                      </span>
                    </summary>
                    <div class="pop-dist-regions">
                      <table class="pop-dist-table">
                        <thead><tr><th>Region</th><th>Population</th><th>%</th><th></th></tr></thead>
                        <tbody>
                          ${c.subregions
                            .map(
                              (sr) => `
                            <tr>
                              <td>${sr.rank}</td>
                              <td>${fmtAxisPop(sr.population)}</td>
                              <td>${fmt(sr.fraction * 100, 1)}%</td>
                              <td><span class="pop-dist-bar" style="width:${(sr.fraction * 100).toFixed(1)}%"></span></td>
                            </tr>`,
                            )
                            .join("")}
                        </tbody>
                      </table>
                    </div>
                  </details>`,
                  )
                  .join("")}
              </div>
            </div>

          </div>
        </div>
      </div>`;

    attachTooltips(containerEl);

    requestAnimationFrame(() => {
      const growthCanvas = containerEl.querySelector("#popGrowthCanvas");
      if (growthCanvas) {
        drawGrowthCurve(
          growthCanvas,
          model.population.timeSeries,
          model.population.K,
          model.inputs.timeElapsedYears,
        );
      }
      const cascadeCanvas = containerEl.querySelector("#popCascadeCanvas");
      if (cascadeCanvas) drawLandUseCascade(cascadeCanvas, model);
    });

    // ── Event listeners ──

    const planetSel = containerEl.querySelector("#popPlanetSelect");
    if (planetSel) {
      planetSel.addEventListener("change", () => {
        selectPlanet(planetSel.value);
        render();
      });
    }

    const techEra = containerEl.querySelector("#popTechEra");
    if (techEra) {
      techEra.addEventListener("change", () => {
        state.techEra = techEra.value;
        state.growthRate = null; // reset to era default
        save();
        render();
      });
    }

    const initPop = containerEl.querySelector("#popInitPop");
    if (initPop) {
      initPop.addEventListener("change", () => {
        state.initialPopulation = Math.max(1, Number(initPop.value) || 1000);
        save();
        render();
      });
    }

    const growthRate = containerEl.querySelector("#popGrowthRate");
    if (growthRate) {
      growthRate.addEventListener("input", () => {
        state.growthRate = Number(growthRate.value);
        save();
        render();
      });
    }

    const timeSel = containerEl.querySelector("#popTime");
    if (timeSel) {
      timeSel.addEventListener("change", () => {
        state.timeElapsedYears = Math.max(0, Number(timeSel.value) || 0);
        save();
        render();
      });
    }

    const oceanSl = containerEl.querySelector("#popOcean");
    if (oceanSl) {
      oceanSl.addEventListener("input", () => {
        state.oceanPctOverride = Number(oceanSl.value);
        save();
        render();
      });
    }

    const habSl = containerEl.querySelector("#popHabitable");
    if (habSl) {
      habSl.addEventListener("input", () => {
        state.habitablePctOverride = Number(habSl.value);
        save();
        render();
      });
    }

    const prodSl = containerEl.querySelector("#popProductive");
    if (prodSl) {
      prodSl.addEventListener("input", () => {
        state.productivePctOverride = Number(prodSl.value);
        save();
        render();
      });
    }

    const cropSl = containerEl.querySelector("#popCrop");
    if (cropSl) {
      cropSl.addEventListener("input", () => {
        state.cropPctOverride = Number(cropSl.value);
        save();
        render();
      });
    }

    const resetBtn = containerEl.querySelector("#popResetAuto");
    if (resetBtn) {
      resetBtn.addEventListener("click", () => {
        state.oceanPctOverride = null;
        state.habitablePctOverride = null;
        state.productivePctOverride = null;
        state.cropPctOverride = null;
        save();
        render();
      });
    }

    const contCount = containerEl.querySelector("#popContCount");
    if (contCount) {
      contCount.addEventListener("change", () => {
        state.continentCount = Math.max(1, Math.min(20, Number(contCount.value) || 6));
        save();
        render();
      });
    }

    const regCount = containerEl.querySelector("#popRegCount");
    if (regCount) {
      regCount.addEventListener("change", () => {
        state.regionCount = Math.max(1, Math.min(50, Number(regCount.value) || 10));
        save();
        render();
      });
    }

    const zipfSl = containerEl.querySelector("#popZipf");
    if (zipfSl) {
      zipfSl.addEventListener("input", () => {
        state.zipfExponent = Number(zipfSl.value);
        save();
        render();
      });
    }
  }

  render();
}
