import { calcClimateZones } from "../engine/climate.js";
import { calcPlanetExact } from "../engine/planet.js";
import { fmt } from "../engine/utils.js";
import { attachTooltips, tipIcon } from "./tooltip.js";
import { escapeHtml } from "./uiHelpers.js";
import { bindNumberAndSlider } from "./bind.js";
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
  "Climate Zones":
    "Procedural K\u00f6ppen climate classification derived from the planet\u2019s surface " +
    "temperature, axial tilt, atmospheric circulation cells, and water budget.\n\n" +
    "Each latitude band is classified using the standard A/B/C/D/E master classes.  " +
    "Ferrel-cell (mid-latitude) bands show both warm-current coast and cold-current " +
    "coast variants.\n\n" +
    "Reference: Peel et al. (2007, Hydrol. Earth Syst. Sci.).",
  "Latitude Temperature":
    "Equator-pole temperature gradient modelled as T(lat) = T_eq \u2212 \u0394T \u00d7 sin\u00b2(lat).  " +
    "The gradient \u0394T decreases with atmospheric pressure (thicker atmospheres " +
    "redistribute heat more efficiently) and increases with lower gravity.\n\n" +
    "Seasonal amplitude scales with axial tilt and sin(latitude).",
  "Aridity Index":
    "Moisture availability index from 0 (hyperarid) to 1 (saturated).  " +
    "Driven by circulation cell dynamics: Hadley ITCZ = wet, Hadley subsidence = dry, " +
    "Ferrel = moderate, Polar = dry.  Scaled by the planet\u2019s water regime and " +
    "atmospheric H\u2082O content.\n\n" +
    "Below 0.25 = desert (BW).  Below 0.45 = steppe (BS).",
  Altitude:
    "Reference altitude above sea level.  Temperature decreases at the environmental " +
    "lapse rate (~6.5 \u00b0C/km on Earth), scaled by surface gravity.\n\n" +
    "Higher altitudes shift tropical zones to temperate, temperate to continental, " +
    "and eventually everything becomes polar.\n\n" +
    "Reference: International Standard Atmosphere (ISA).",
  "Zone Count":
    "Number of procedural latitude bands generated for this planet.\n\n" +
    "Band count scales with the number of atmospheric circulation cells " +
    "(Hadley, Ferrel, Polar) and whether mid-latitude bands are split into " +
    "warm-coast and cold-coast variants.",
  "Mean Surface Temp":
    "Global mean surface temperature derived from stellar luminosity, " +
    "orbital distance, albedo, and greenhouse effect.\n\n" +
    "This is the equatorial baseline before latitude and altitude adjustments.",
  "Dominant Class":
    "The most common Köppen master class across all latitude bands.\n\n" +
    "A = Tropical, B = Arid, C = Temperate, D = Continental, E = Polar, " +
    "X = Special (e.g., tidally locked permanent night-side).",
  "Water Regime":
    "Planet-wide water availability category from the Planets page.\n\n" +
    "Drives ocean coverage, atmospheric H₂O content, and aridity index " +
    "across all climate zones.  Ranges from Desiccated to Water World.",
  "Climate Legend":
    "Colour key for the Köppen master classes shown in the latitude band chart.\n\n" +
    "Only classes that appear in the current zone set are displayed.",
  "Zone Card":
    "Each card shows one latitude band: its Köppen code, name, temperature range, " +
    "and aridity index.\n\n" +
    "Expand a card for environment description, location context, " +
    "warmest/coldest month temperatures, and exact aridity value.",
};

// ── Master class colors ─────────────────────────────────────

const MASTER_COLORS = {
  A: "#e05555", // warm red
  B: "#d4a44a", // sandy yellow
  C: "#4caf6e", // green
  D: "#5b8fd4", // blue
  E: "#c0d0e0", // ice blue
  X: "#9b7cc4", // purple
};

// ── Planet context extraction ───────────────────────────────

function getClimateContext(world) {
  const fallback = {
    surfaceTempK: 288,
    axialTiltDeg: 23.44,
    circulationCellCount: "3",
    circulationCellRanges: [],
    h2oPct: 0,
    waterRegime: "Extensive oceans",
    pressureAtm: 1,
    tidallyLockedToStar: false,
    compositionClass: "Earth-like",
    liquidWaterPossible: true,
    insolationEarth: 1,
    gravityG: 1,
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

  return {
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
    insolationEarth: model.derived.insolationEarth || 1,
    gravityG: model.derived.gravityG || 1,
  };
}

// ── Canvas drawing ──────────────────────────────────────────

function drawLatitudeBands(canvas, zones) {
  const ctx = canvas.getContext("2d");
  const dpr = window.devicePixelRatio || 1;
  const w = canvas.clientWidth;
  const h = canvas.clientHeight;
  canvas.width = w * dpr;
  canvas.height = h * dpr;
  ctx.scale(dpr, dpr);

  const textColor = getComputedStyle(canvas).getPropertyValue("color") || "#ccc";

  ctx.clearRect(0, 0, w, h);

  if (!zones.length) return;

  const PAD = { top: 8, bottom: 24, left: 10, right: 10 };
  const barH = h - PAD.top - PAD.bottom;
  const barW = w - PAD.left - PAD.right;

  // Check if this is a tidally locked or global-zone scenario
  const isTidal = zones.some((z) =>
    ["substellar", "terminator", "antistellar"].includes(z.cellRole),
  );
  const isGlobal = zones.length === 1 && zones[0].latMin === 0 && zones[0].latMax === 90;

  if (isTidal) {
    // Equal-width segments for tidal zones
    const segW = barW / zones.length;
    zones.forEach((z, i) => {
      const x = PAD.left + i * segW;
      ctx.fillStyle = MASTER_COLORS[z.master] || "#666";
      ctx.globalAlpha = 0.5;
      ctx.fillRect(x, PAD.top, segW - 2, barH);
      ctx.globalAlpha = 1;

      // Label
      ctx.fillStyle = textColor;
      ctx.font = "10px var(--font-mono, monospace)";
      ctx.textAlign = "center";
      const label =
        z.cellRole === "substellar"
          ? "Substellar"
          : z.cellRole === "terminator"
            ? "Terminator"
            : "Antistellar";
      ctx.fillText(label, x + segW / 2, PAD.top + barH / 2 - 6);
      ctx.font = "bold 11px var(--font-mono, monospace)";
      ctx.fillText(z.code, x + segW / 2, PAD.top + barH / 2 + 8);
    });
    return;
  }

  if (isGlobal) {
    ctx.fillStyle = MASTER_COLORS[zones[0].master] || "#666";
    ctx.globalAlpha = 0.5;
    ctx.fillRect(PAD.left, PAD.top, barW, barH);
    ctx.globalAlpha = 1;
    ctx.fillStyle = textColor;
    ctx.font = "bold 12px var(--font-mono, monospace)";
    ctx.textAlign = "center";
    ctx.fillText(zones[0].code + " " + zones[0].name, PAD.left + barW / 2, PAD.top + barH / 2 + 4);
    return;
  }

  // Normal latitude-band mode: equator (0°) on left, pole (90°) on right
  const maxLat = 90;
  const xScale = barW / maxLat;

  // Draw each zone as a colored segment
  // Group overlapping latitude ranges (warm-coast / cold-coast at same lat)
  // by rendering two half-height bars
  const drawn = new Map(); // latKey → count

  for (const z of zones) {
    const x0 = PAD.left + z.latMin * xScale;
    const segW = (z.latMax - z.latMin) * xScale;
    const latKey = `${z.latMin}-${z.latMax}`;
    const count = drawn.get(latKey) || 0;
    drawn.set(latKey, count + 1);

    // Check if this lat band has multiple variants
    const siblings = zones.filter((o) => o.latMin === z.latMin && o.latMax === z.latMax);
    const halfBar = siblings.length > 1;
    const yOff = halfBar ? (count === 0 ? 0 : barH / 2) : 0;
    const segH = halfBar ? barH / 2 : barH;

    ctx.fillStyle = MASTER_COLORS[z.master] || "#666";
    ctx.globalAlpha = 0.5;
    ctx.fillRect(x0, PAD.top + yOff, Math.max(segW - 1, 1), segH);
    ctx.globalAlpha = 1;

    // Label if wide enough
    if (segW > 28) {
      ctx.fillStyle = textColor;
      ctx.font = "bold 10px var(--font-mono, monospace)";
      ctx.textAlign = "center";
      ctx.fillText(z.code, x0 + segW / 2, PAD.top + yOff + segH / 2 + 4);
    }
  }

  // Axis labels
  ctx.fillStyle = textColor;
  ctx.font = "9px var(--font-mono, monospace)";
  ctx.textAlign = "left";
  ctx.fillText("Equator", PAD.left, h - 4);
  ctx.textAlign = "right";
  ctx.fillText("Pole", PAD.left + barW, h - 4);
  // Interior tick labels only (skip 0° and 90° to avoid overlap with Equator/Pole)
  ctx.textAlign = "center";
  const step = maxLat <= 30 ? 5 : 15;
  for (let lat = step; lat < maxLat; lat += step) {
    const x = PAD.left + lat * xScale;
    ctx.fillText(`${lat}\u00b0`, x, h - 4);
  }
}

// ── Page init ───────────────────────────────────────────────

export function initClimatePage(containerEl) {
  const world = loadWorld();
  const planets = listPlanets(world);

  if (!planets.length) {
    containerEl.innerHTML = `
      <div class="page">
        <div class="panel">
          <div class="panel__header"><h1 class="panel__title">Climate Zones</h1></div>
          <div class="panel__body">
            <p class="hint">Create a planet on the <a href="#/planet">Planets</a> page first.</p>
          </div>
        </div>
      </div>`;
    return;
  }

  const clim = world.climate || {};
  const state = { altitudeM: Number(clim.altitudeM) || 0 };

  function save() {
    updateWorld({ climate: { ...state } });
  }

  // ── Helpers for dynamic content ──

  const DOMINANT_NAMES = {
    A: "Tropical",
    B: "Arid",
    C: "Temperate",
    D: "Continental",
    E: "Polar",
    X: "Special",
  };

  function dynamicHTML(model, ctx) {
    const dominantLabel =
      DOMINANT_NAMES[model.display.dominantClass] || model.display.dominantClass;

    return `
      ${model.advisory ? `<div class="clim-advisory">${escapeHtml(model.advisory)}</div>` : ""}

      <div class="kpi-grid">
        <div class="kpi-wrap"><div class="kpi">
          <div class="kpi__label">Zone Count ${tipIcon(TIP_LABEL["Zone Count"])}</div>
          <div class="kpi__value">${model.display.zoneCount}</div>
        </div></div>
        <div class="kpi-wrap"><div class="kpi">
          <div class="kpi__label">Mean Surface Temp ${tipIcon(TIP_LABEL["Mean Surface Temp"])}</div>
          <div class="kpi__value">${fmt(ctx.surfaceTempK - 273.15, 1)} \u00b0C</div>
        </div></div>
        <div class="kpi-wrap"><div class="kpi">
          <div class="kpi__label">Dominant Class ${tipIcon(TIP_LABEL["Dominant Class"])}</div>
          <div class="kpi__value">${escapeHtml(dominantLabel)}</div>
        </div></div>
        <div class="kpi-wrap"><div class="kpi">
          <div class="kpi__label">Water Regime ${tipIcon(TIP_LABEL["Water Regime"])}</div>
          <div class="kpi__value">${escapeHtml(ctx.waterRegime)}</div>
        </div></div>
      </div>

      <div class="subsection" style="margin-top:12px">
        <h3>Latitude Bands ${tipIcon(TIP_LABEL["Latitude Temperature"])}</h3>
        <canvas id="climBandCanvas" class="clim-canvas"></canvas>
        <div class="clim-legend">${tipIcon(TIP_LABEL["Climate Legend"])}
          ${Object.entries(MASTER_COLORS)
            .filter(([k]) => model.zones.some((z) => z.master === k))
            .map(
              ([k, c]) =>
                `<span class="clim-legend-item"><span class="clim-legend-swatch" style="background:${c}"></span>${
                  k === "A"
                    ? "Tropical"
                    : k === "B"
                      ? "Arid"
                      : k === "C"
                        ? "Temperate"
                        : k === "D"
                          ? "Continental"
                          : k === "E"
                            ? "Polar"
                            : "Special"
                }</span>`,
            )
            .join("")}
        </div>
      </div>

      <div class="subsection" style="margin-top:12px">
        <h3>Zone Details ${tipIcon(TIP_LABEL["Zone Card"])} ${tipIcon(TIP_LABEL["Aridity Index"])}</h3>
        <div class="clim-zone-list">
          ${model.zones
            .map(
              (z) => `
            <details class="clim-zone-card">
              <summary class="clim-zone-summary">
                <span class="clim-zone-badge" style="background:${MASTER_COLORS[z.master] || "var(--muted)"}">${escapeHtml(z.code)}</span>
                <span class="clim-zone-name">${escapeHtml(z.name)}</span>
                ${z.variant !== "general" ? `<span class="clim-zone-variant">${escapeHtml(z.variant)}</span>` : ""}
                <span class="clim-zone-range">${escapeHtml(z.rangeLabel)}</span>
                <span class="clim-zone-temp">${fmt(z.meanTempC, 1)} \u00b0C</span>
              </summary>
              <div class="clim-zone-detail">
                <p>${escapeHtml(z.description)}</p>
                ${z.environment ? `<p class="clim-detail-row"><strong>Environment:</strong> ${escapeHtml(z.environment)}</p>` : ""}
                ${z.location ? `<p class="clim-detail-row"><strong>Location:</strong> ${escapeHtml(z.location)}</p>` : ""}
                <p class="clim-detail-row">
                  <strong>Temperature:</strong>
                  warmest ${fmt(z.warmestMonthC, 1)} \u00b0C,
                  coldest ${fmt(z.coldestMonthC, 1)} \u00b0C
                </p>
                <p class="clim-detail-row">
                  <strong>Aridity index:</strong> ${fmt(z.aridity, 2)}
                </p>
              </div>
            </details>`,
            )
            .join("")}
        </div>
      </div>`;
  }

  /** Lightweight refresh — replaces only the dynamic area below the inputs. */
  function update() {
    const w = loadWorld();
    const ctx = getClimateContext(w);
    const model = calcClimateZones({ ...ctx, altitudeM: state.altitudeM });

    const dyn = containerEl.querySelector("#climDynamic");
    if (!dyn) return;
    dyn.innerHTML = dynamicHTML(model, ctx);

    attachTooltips(dyn);
    requestAnimationFrame(() => {
      const canvas = dyn.querySelector("#climBandCanvas");
      if (canvas) drawLatitudeBands(canvas, model.zones);
    });
  }

  /** Full rebuild — inputs, listeners, everything. */
  function render() {
    const w = loadWorld();
    const pList = listPlanets(w);
    const selected = getSelectedPlanet(w);
    const ctx = getClimateContext(w);
    const model = calcClimateZones({ ...ctx, altitudeM: state.altitudeM });

    // Planet selector options
    const planetOptions = pList
      .map((p) => {
        const name = escapeHtml(p.name || p.inputs?.name || p.id);
        const sel = p.id === selected?.id ? " selected" : "";
        return `<option value="${escapeHtml(p.id)}"${sel}>${name}</option>`;
      })
      .join("");

    containerEl.innerHTML = `
      <div class="page">
        <div class="panel">
          <div class="panel__header">
            <h1 class="panel__title">Climate Zones ${tipIcon(TIP_LABEL["Climate Zones"])}</h1>
          </div>
          <div class="panel__body">

            <div class="form-row">
              <label for="climPlanetSelect">Planet</label>
              <select id="climPlanetSelect">${planetOptions}</select>
            </div>

            <div class="form-row">
              <label>Altitude <span class="unit">m</span> ${tipIcon(TIP_LABEL["Altitude"])}</label>
              <div class="input-pair">
                <input id="climAltitude" type="number" step="100"
                       value="${state.altitudeM}" aria-label="Altitude" />
                <input id="climAltitudeSlider" type="range" aria-label="Altitude slider" />
                <div class="range-meta"><span>0</span><span>10,000</span></div>
              </div>
            </div>

            <div id="climDynamic">
              ${dynamicHTML(model, ctx)}
            </div>

          </div>
        </div>
      </div>`;

    attachTooltips(containerEl);

    requestAnimationFrame(() => {
      const canvas = containerEl.querySelector("#climBandCanvas");
      if (canvas) drawLatitudeBands(canvas, model.zones);
    });

    const sel = containerEl.querySelector("#climPlanetSelect");
    if (sel) {
      sel.addEventListener("change", () => {
        selectPlanet(sel.value);
        render();
      });
    }

    const altNum = containerEl.querySelector("#climAltitude");
    const altSlider = containerEl.querySelector("#climAltitudeSlider");
    if (altNum && altSlider) {
      let ready = false;
      bindNumberAndSlider({
        numberEl: altNum,
        sliderEl: altSlider,
        min: 0,
        max: 10000,
        step: 100,
        onChange(v) {
          state.altitudeM = v;
          if (!ready) return;
          save();
          update();
        },
      });
      ready = true;
    }
  }

  render();
}
