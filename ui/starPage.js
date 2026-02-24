import { calcStar } from "../engine/star.js";
import { computeFlareParams } from "../engine/stellarActivity.js";
import { clamp, fmt, relativeLuminance } from "../engine/utils.js";
import { bindNumberAndSlider } from "./bind.js";
import { attachTooltips, tipIcon } from "./tooltip.js";
import { loadWorld, updateWorld } from "./store.js";

const TIP_LABEL = {
  Name: "Give your star a unique name for use in exports and the visualiser.",
  Class:
    'All stars are categorised by spectral type. From most to least massive & luminous the scale goes as follows: O, B, A, F, G, K, M.\n\nSpectral classes are further subdivide by a number between 0 and 9. 0 means most massive/luminous, 9 means least massive/luminous.\n\n"V" indicates that the star is on the main sequence, i.e, it\'s a sun-like star undergoing hydrogen burning in its core.',
  Mass: "Input your stars mass, in solar masses, here. Our sun = 1 Msol = \n1.989E30 kg\n\nThe approximate mass ranges for main sequence stars are as follows:\n\nO Star: ~16+ Msol\t\nB Star: ~2.19 - 16 Msol\t\nA Star: ~1.44 - 2.19 Msol\t\nF Star: ~1.06 - 1.44 Msol\t\nG Star: ~0.84 - 1.06 Msol\t\nK Star: ~0.47 - 0.84 Msol\t\nM Star: ~0.075 - 0.47 Msol\t\n\nStars between 0.5 Msol and 1.4 Msol are considered habitable, i.e, the most suitable for earth-like life.",
  "Current Age":
    "Input the age of your star, in billions of earth years, here.\n\nThe value chosen must be less than the Maximum Age shown in outputs.",
  "Maximum Age":
    "How long your star will remain on the main sequence, in billions of earth years.\n\nComputed as (M / L) \u00d7 10 Gyr \u2014 nuclear fuel supply divided by luminous burn rate.",
  Radius:
    "How big your star is in solar radii.\n\nFor M \u2264 1 Msol: Eker et al. (2018, MNRAS 479, 5491) quadratic mass\u2013radius relation from eclipsing binaries.\nFor M > 1 Msol: power-law scaling (Demircan & Kahraman 1991).\n\nOur sun = 1 Rsol = 695,700 km",
  Luminosity:
    "The amount of light your star emits in solar luminosities.\n\nZAMS mode: Eker et al. (2018, MNRAS 479, 5491) six-piece empirical relation from 509 eclipsing binaries. Replaces the classical L = M\u2074 approximation, which overestimated K-dwarf luminosities by 30\u201385%.\n\nEvolved mode: Hurley, Pols & Tout (2000) analytical stellar evolution. Radius and temperature are accurate to ~1\u20132%, but luminosity carries ~10% mean error inherent to the Tout (1996) polynomial ZAMS baseline and Hurley evolution-rate fits. This is the practical accuracy ceiling of analytical single-star evolution; sub-2% luminosity would require tabulated MESA/MIST isochrone grids.\n\nOur sun = 1 Lsol = 3.846E26 watts",
  "Radius Override":
    "Optionally override the mass-derived stellar radius in solar radii. Leave blank to use the Eker et al. (2018) scaling-law value derived from mass.\n\nUseful for modelling subgiants, evolved stars, or stars with a measured radius.\n\nOur sun = 1 Rsol = 695,700 km",
  "Luminosity Override":
    "Optionally override the mass-derived luminosity in solar luminosities. Leave blank to use the Eker et al. (2018) scaling-law value derived from mass.\n\nUseful for modelling post-main-sequence stars or stars with a measured luminosity.\n\nOur sun = 1 Lsol = 3.846E26 watts",
  "Temperature Override":
    "Optionally override the effective temperature in Kelvin. Used with one other override to resolve the third via Stefan-Boltzmann (L = R² × (T/5776)⁴).\n\nLeave blank to derive temperature from Radius and Luminosity (default).\n\nOur sun ≈ 5776 K.",
  Density: "How dense your star is. Our sun = 1 Dsol = 1.41 g/cm³.",
  Temperature: "The effective temperature of your star, in kelvin.",
  "Habitable Zone":
    "A planet orbiting within this region receives Earth-like stellar heating.\n\nWorldSmith Web uses an updated temperature-dependent habitable-zone model (S_in/S_out vary with effective temperature), based on Chromant's Desmos correction.\n\nThis intentionally deviates from the spreadsheet's fixed sqrt(L/1.1) and sqrt(L/0.53) approach, which generally places the outer edge too close in.\n\n1 AU = ~150,000,000 km.",
  "Star Colour":
    "The displayed stellar colour is derived from effective temperature using Tanner Helland's empirical blackbody approximation (valid 1000–40000 K, R² > 0.987), which produces a smooth, continuous colour gradient.\n\nThis intentionally deviates from the WS8 spreadsheet, which used 7 fixed flat colour bands from Excel conditional formatting — producing hard colour jumps between spectral classes rather than a physical gradient.\n\nThe more precise Planckian locus method (CIE chromaticity → XYZ → sRGB matrix pipeline) was considered but not used, as it adds significant complexity for negligible visual improvement in a worldbuilding context.",
  "Earth-like Life?":
    "The spreadsheet checks to see if a planet comparable to modern-day Earth can orbit your star.\n\nYes: A planet with a biosphere comparable to modern-day Earth may, if you so desire, orbit this star.\n\nNo: A planet with a biosphere comparable to modern-day Earth CANNOT orbit this star.\n\nStar Too Young: A planet comparable to pre-Cambrian Earth may, if you so desire, orbit your star.",
  "Metallicity [Fe/H]":
    "Stellar metallicity measures heavy-element abundance relative to the Sun.\n\n[Fe/H] = log\u2081\u2080(Fe/H)_star \u2212 log\u2081\u2080(Fe/H)_sun\n\nSun = 0.0 by definition. Positive = metal-rich, negative = metal-poor.\n\nTypical range:\n\u2022 Metal-rich inner disk: +0.1 to +0.5\n\u2022 Solar neighbourhood: \u22120.2 to +0.1\n\u2022 Old thin disk: \u22120.7 to \u22120.3\n\u2022 Halo / globular clusters: \u22122.5 to \u22121.0\n\nMetallicity does not modify the Eker mass\u2013luminosity or mass\u2013radius relations (their empirical scatter already includes metallicity variation). Instead it drives downstream effects like giant planet probability.",
  "Giant Planet Probability":
    "Probability that a solar-type star hosts at least one giant planet (\u22650.3 M_Jup).\n\nBased on Fischer & Valenti (2005, ApJ 622, 1102): P \u221d 10^(2*[Fe/H]).\nBaseline ~10% at solar metallicity (Cumming et al. 2008, PASP 120, 531).\n\nMetal-rich stars are dramatically more likely to host giant planets \u2014 a +0.3 dex increase in [Fe/H] roughly quadruples the probability.",
  "Stellar Population":
    "A broad classification based on metallicity.\n\nPopulation I (solar neighbourhood): [Fe/H] > \u22120.3 \u2014 young-to-middle-aged disk stars like the Sun\nIntermediate (old thin disk): \u22121.0 < [Fe/H] \u2264 \u22120.3\nPopulation II (metal-poor): [Fe/H] \u2264 \u22121.0 \u2014 old halo and thick-disk stars\nMetal-rich (inner disk): [Fe/H] > +0.15 \u2014 stars formed in the metal-enriched inner galaxy",
  "Activity Regime":
    "Activity regime is based on effective temperature and age bins used by flare-frequency studies.\n\nTemperature bins:\nFGK: T >= 3900 K\nEarly M: 3200 K \u2264 T < 3900 K\nLate M: T < 3200 K\n\nAge bands:\nFGK: young <0.5 Gyr, mid 0.5\u20132 Gyr, old >=2 Gyr\nEarly M: young <1 Gyr, mid 1\u20134 Gyr, old >=4 Gyr\nLate M: young <2 Gyr, mid 2\u20136 Gyr, old >=6 Gyr.",
  "Energetic Flare Rate (>1e32 erg)":
    "N32 is the expected rate of energetic flares above 10^32 erg.\n\nBaselines by regime:\nFGK old/mid/young: 0.05 / 0.25 / 1.0 per day\nEarly M old/mid/young: 0.5 / 2.0 / 8.0 per day\nLate M old/mid/young: 2.0 / 8.0 / 30.0 per day.",
  "Energetic Flare Recurrence":
    "Recurrence is computed from N32 as 1 / N32 days for flares above 10^32 erg.",
  "Solar CME Envelope (FGK)":
    "Solar observations show coronal mass ejection rates varying from about 0.5 to 6.0 per day across the solar cycle.\n\nThis envelope is shown only for FGK stars.",
};

export function initStarPage(mountEl) {
  const defaults = { name: "Star", massMsol: 0.8653, ageGyr: 6.254 }; // workbook defaults
  const world = loadWorld();
  const state = {
    name:
      typeof world?.star?.name === "string" && world.star.name.trim()
        ? world.star.name.trim()
        : defaults.name,
    massMsol: Number.isFinite(world?.star?.massMsol)
      ? Number(world.star.massMsol)
      : defaults.massMsol,
    ageGyr: Number.isFinite(world?.star?.ageGyr) ? Number(world.star.ageGyr) : defaults.ageGyr,
    metallicityFeH: Number.isFinite(world?.star?.metallicityFeH)
      ? Number(world.star.metallicityFeH)
      : 0.0,
    radiusRsolOverride:
      Number.isFinite(world?.star?.radiusRsolOverride) && world.star.radiusRsolOverride > 0
        ? Number(world.star.radiusRsolOverride)
        : null,
    luminosityLsolOverride:
      Number.isFinite(world?.star?.luminosityLsolOverride) && world.star.luminosityLsolOverride > 0
        ? Number(world.star.luminosityLsolOverride)
        : null,
    tempKOverride:
      Number.isFinite(world?.star?.tempKOverride) && world.star.tempKOverride > 0
        ? Number(world.star.tempKOverride)
        : null,
    physicsMode:
      world?.star?.physicsMode === "advanced" || world?.star?.physicsMode === "simple"
        ? world.star.physicsMode
        : "simple",
    advancedDerivationMode: ["rl", "rt", "lt"].includes(world?.star?.advancedDerivationMode)
      ? world.star.advancedDerivationMode
      : "rl",
    evolutionMode: world?.star?.evolutionMode === "evolved" ? "evolved" : "zams",
  };

  const wrap = document.createElement("div");
  wrap.className = "page";
  wrap.innerHTML = `
    <div class="panel">
      <div class="panel__header">
        <h1 class="panel__title"><span class="ws-icon icon--star" aria-hidden="true"></span><span>Star</span></h1>
        <div class="badge">Interactive tool</div>
      </div>
      <div class="panel__body">
        <div class="hint">Set the star name, mass, and age here. These values drive linked system, planet, and moon calculations.</div>
      </div>
    </div>

    <div class="grid-2">
      <div class="panel">
        <div class="panel__header"><h2>Inputs</h2></div>
        <div class="panel__body">
          <div class="form-row">
            <div>
              <div class="label">Name ${tipIcon(TIP_LABEL["Name"] || "")}</div>
              <div class="hint">Used across pages and in the visualiser labels.</div>
            </div>
            <div>
              <input id="starName" type="text" maxlength="80" aria-label="Star name" />
            </div>
          </div>

          <div class="form-row">
            <div>
              <div class="label">Mass <span class="unit">Msol</span> ${tipIcon(TIP_LABEL["Mass"] || "")}</div>
              <div class="hint">Valid range in sheet: 0.075 to 100.</div>
            </div>
            <div class="input-pair">
            <input id="mass" type="number" step="0.0001" min="0.075" max="100" aria-label="Mass" />
            <input id="mass_slider" type="range" aria-label="Mass slider" />
            <div class="range-meta"><span id="mass_min"></span><span id="mass_max"></span></div>
          </div>
          </div>

          <div class="form-row">
            <div>
              <div class="label">Current Age <span class="unit">Gyr</span> ${tipIcon(TIP_LABEL["Current Age"] || "")}</div>
              <div class="hint">Used to check if Earth-like life is plausible.</div>
            </div>
            <div class="input-pair">
            <input id="age" type="number" step="0.001" min="0" max="20" aria-label="Current Age" />
            <input id="age_slider" type="range" aria-label="Current Age slider" />
            <div class="range-meta"><span id="age_min"></span><span id="age_max"></span></div>
          </div>
          </div>

          <div class="viz-switch" style="margin:10px 0 6px">
            <div class="viz-switch__text">Stellar Evolution: Off / On</div>
            <label class="viz-switch__control" for="evolutionToggle">
              <input type="checkbox" id="evolutionToggle" />
              <span class="viz-switch__slider" aria-hidden="true"></span>
            </label>
          </div>
          <div class="hint" id="evolutionHint" style="margin-bottom:8px"></div>

          <div class="form-row">
            <div>
              <div class="label">Metallicity [Fe/H] <span class="unit">dex</span> ${tipIcon(TIP_LABEL["Metallicity [Fe/H]"] || "")}</div>
              <div class="hint">Sun = 0.0 · Metal-poor halo ≈ −2 · Metal-rich disk ≈ +0.3</div>
            </div>
            <div class="input-pair">
            <input id="metallicity" type="number" step="0.01" min="-3" max="1" aria-label="Metallicity [Fe/H]" />
            <input id="metallicity_slider" type="range" aria-label="Metallicity slider" />
            <div class="range-meta"><span id="metallicity_min"></span><span id="metallicity_max"></span></div>
          </div>
          </div>

          <div class="viz-switch" style="margin:10px 0 6px">
            <div class="viz-switch__text">Physics mode: Simple / Advanced</div>
            <label class="viz-switch__control" for="physicsAdvancedToggle">
              <input type="checkbox" id="physicsAdvancedToggle" />
              <span class="viz-switch__slider" aria-hidden="true"></span>
            </label>
          </div>
          <div class="hint" id="physicsModeHint" style="margin-bottom:8px"></div>

          <div id="advancedDerivRow" style="display:none;margin-bottom:8px">
            <div class="label" style="margin-bottom:6px">Derivation Mode</div>
            <div class="physics-trio-toggle">
              <input type="radio" name="physicsDerivMode" id="derivModeRl" value="rl" />
              <label for="derivModeRl">R + L → T</label>
              <input type="radio" name="physicsDerivMode" id="derivModeRt" value="rt" />
              <label for="derivModeRt">R + T → L</label>
              <input type="radio" name="physicsDerivMode" id="derivModeLt" value="lt" />
              <label for="derivModeLt">L + T → R</label>
              <span></span>
            </div>
            <div class="hint" style="margin-top:5px">R = Radius (Rsol) · L = Luminosity (Lsol) · T = Temperature (K) · Arrow = computed value</div>
          </div>

          <div class="form-row" id="radiusOverrideRow">
            <div>
              <div class="label">Radius <span class="unit">Rsol</span> ${tipIcon(TIP_LABEL["Radius Override"] || "")}</div>
              <div class="hint" id="radiusHint">Auto (mass-derived)</div>
            </div>
            <div style="display:flex;gap:6px;align-items:center">
              <input id="radiusOverride" type="number" step="0.001" min="0.001" max="1000" placeholder="Auto" aria-label="Radius override" />
              <button id="radiusClear" type="button">Auto</button>
            </div>
          </div>

          <div class="form-row" id="luminosityOverrideRow">
            <div>
              <div class="label">Luminosity <span class="unit">Lsol</span> ${tipIcon(TIP_LABEL["Luminosity Override"] || "")}</div>
              <div class="hint" id="luminosityHint">Auto (mass-derived)</div>
            </div>
            <div style="display:flex;gap:6px;align-items:center">
              <input id="luminosityOverride" type="number" step="0.001" min="0.0001" max="1000000" placeholder="Auto" aria-label="Luminosity override" />
              <button id="luminosityClear" type="button">Auto</button>
            </div>
          </div>

          <div class="form-row" id="tempOverrideRow">
            <div>
              <div class="label">Temperature <span class="unit">K</span> ${tipIcon(TIP_LABEL["Temperature Override"] || "")}</div>
              <div class="hint" id="tempHint">Auto (derived from R and L)</div>
            </div>
            <div style="display:flex;gap:6px;align-items:center">
              <input id="tempOverride" type="number" step="1" min="1" max="100000" placeholder="Auto" aria-label="Temperature override" />
              <button id="tempClear" type="button">Auto</button>
            </div>
          </div>

          <div class="hint" id="resolutionStatus" style="margin-top:4px;font-style:italic"></div>

          <div class="button-row">
            <button class="primary" id="btn-apply">Apply</button>
            <button id="btn-sol">Sol-ish Preset</button>
            <button id="btn-reset">Reset to Defaults</button>
          </div>

          <div class="hint" style="margin-top:10px">
            Autosaves locally as you apply changes.
          </div>
        </div>
      </div>

      <div class="panel">
        <div class="panel__header"><h2>Outputs</h2></div>
        <div class="panel__body">
          <div class="kpi-grid" id="kpis"></div>

          <div style="margin-top:14px; display:flex; gap:10px; flex-wrap:wrap; align-items:center">
            <span id="lifeBadge" class="badge"></span>
            <span id="classBadge" class="badge"></span>
          </div>
        </div>
      </div>
    </div>
  `;
  mountEl.appendChild(wrap);
  attachTooltips(wrap);

  const nameEl = wrap.querySelector("#starName");
  const massEl = wrap.querySelector("#mass");
  const ageEl = wrap.querySelector("#age");
  const metallicityEl = wrap.querySelector("#metallicity");
  const kpisEl = wrap.querySelector("#kpis");
  const lifeBadge = wrap.querySelector("#lifeBadge");
  const classBadge = wrap.querySelector("#classBadge");
  const physicsToggleEl = wrap.querySelector("#physicsAdvancedToggle");
  const advancedDerivRowEl = wrap.querySelector("#advancedDerivRow");
  const physicsDerivRadios = wrap.querySelectorAll('[name="physicsDerivMode"]');
  const radiusOverrideRowEl = wrap.querySelector("#radiusOverrideRow");
  const luminosityOverrideRowEl = wrap.querySelector("#luminosityOverrideRow");
  const tempOverrideRowEl = wrap.querySelector("#tempOverrideRow");
  const radiusOverrideEl = wrap.querySelector("#radiusOverride");
  const luminosityOverrideEl = wrap.querySelector("#luminosityOverride");
  const tempOverrideEl = wrap.querySelector("#tempOverride");
  const radiusHintEl = wrap.querySelector("#radiusHint");
  const luminosityHintEl = wrap.querySelector("#luminosityHint");
  const tempHintEl = wrap.querySelector("#tempHint");
  const resolutionStatusEl = wrap.querySelector("#resolutionStatus");
  const physicsModeHintEl = wrap.querySelector("#physicsModeHint");
  const evolutionToggleEl = wrap.querySelector("#evolutionToggle");
  const evolutionHintEl = wrap.querySelector("#evolutionHint");

  // Bind number inputs to sliders
  const massSlider = wrap.querySelector("#mass_slider");
  const massMin = wrap.querySelector("#mass_min");
  const massMax = wrap.querySelector("#mass_max");
  massMin.textContent = "0.075";
  massMax.textContent = "100";
  bindNumberAndSlider({
    numberEl: massEl,
    sliderEl: massSlider,
    min: 0.075,
    max: 100,
    step: 0.0001,
    mode: "auto",
  });

  const ageSlider = wrap.querySelector("#age_slider");
  const ageMin = wrap.querySelector("#age_min");
  const ageMax = wrap.querySelector("#age_max");
  ageMin.textContent = "0";
  ageMax.textContent = "20";
  bindNumberAndSlider({
    numberEl: ageEl,
    sliderEl: ageSlider,
    min: 0,
    max: 20,
    step: 0.001,
    mode: "auto",
  });

  const metallicitySlider = wrap.querySelector("#metallicity_slider");
  const metallicityMin = wrap.querySelector("#metallicity_min");
  const metallicityMax = wrap.querySelector("#metallicity_max");
  metallicityMin.textContent = "-3";
  metallicityMax.textContent = "1";
  bindNumberAndSlider({
    numberEl: metallicityEl,
    sliderEl: metallicitySlider,
    min: -3,
    max: 1,
    step: 0.01,
    mode: "linear",
  });

  function sanitiseName(raw) {
    const txt = String(raw ?? "").trim();
    return txt || defaults.name;
  }

  function getDerivMode() {
    for (const r of physicsDerivRadios) {
      if (r.checked) return r.value;
    }
    return "rl";
  }

  function setDerivMode(mode) {
    for (const r of physicsDerivRadios) {
      r.checked = r.value === mode;
    }
  }

  // Returns the override values to pass to calcStar based on current mode/state.
  // In advanced mode, the derivation dropdown controls which pair is active.
  function getEffectiveOverrides() {
    if (state.physicsMode === "advanced") {
      const m = state.advancedDerivationMode;
      const r = state.radiusRsolOverride;
      const l = state.luminosityLsolOverride;
      const t = state.tempKOverride;
      if (m === "rt") return { r, l: null, t };
      if (m === "lt") return { r: null, l, t };
      return { r, l, t: null }; // "rl" (default)
    }
    // Simple mode: all values from mass — no overrides reach the engine
    return { r: null, l: null, t: null };
  }

  function render() {
    const ov = getEffectiveOverrides();
    const model = calcStar({
      ...state,
      radiusRsolOverride: ov.r,
      luminosityLsolOverride: ov.l,
      tempKOverride: ov.t,
    });
    const activity = computeFlareParams({
      massMsun: state.massMsol,
      ageGyr: state.ageGyr,
      teffK: model.tempK,
      luminosityLsun: model.luminosityLsol,
    });
    const recurrenceDays = activity.N32 > 0 ? 1 / activity.N32 : Infinity;
    const recurrenceText = Number.isFinite(recurrenceDays)
      ? recurrenceDays >= 365
        ? `~${fmt(recurrenceDays / 365, 2)} years`
        : recurrenceDays >= 1
          ? `~${fmt(recurrenceDays, 2)} days`
          : `~${fmt(recurrenceDays * 24, 2)} hours`
      : "Rare";

    const items = [
      { label: "Maximum Age", value: fmt(model.maxAgeGyr, 3), meta: "Gyr" },
      {
        label: "Radius",
        value: fmt(model.radiusRsol, 3),
        meta:
          "Rsol | " +
          fmt(model.metric.radiusKm, 0) +
          " km" +
          (model.radiusOverridden ? " (Override)" : ""),
      },
      {
        label: "Luminosity",
        value: fmt(model.luminosityLsol, 3),
        meta:
          "Lsol | " +
          fmt(model.metric.luminosityW, 0) +
          " W" +
          (model.luminosityOverridden ? " (Override)" : ""),
      },
      { label: "Density", value: fmt(model.densityGcm3, 3), meta: "g/cm³" },
      { label: "Temperature", value: fmt(model.tempK, 0), meta: "K" },
      {
        label: "Star Colour",
        kpiClass: "kpi--colour",
        kpiAttrs: `data-light="${relativeLuminance(model.starColourHex) > 0.18 ? 1 : 0}"`,
        kpiStyle: `--kpi-colour: ${model.starColourHex};`,
        value: `${model.starColourHex}`,
        meta: "Hex (derived from temperature)",
      },
      {
        label: "Habitable Zone",
        value: model.display.hzAu,
        meta: "AU | " + model.display.hzMkm + " million km",
      },
      {
        label: "Giant Planet Probability",
        value: `${fmt(model.giantPlanetProbability * 100, 1)}%`,
        meta: "Fischer & Valenti (2005)",
      },
      {
        label: "Stellar Population",
        value: model.populationLabel,
        meta: `[Fe/H] = ${fmt(model.inputs.metallicityFeH, 2)}`,
      },
      {
        label: "Activity Regime",
        value: `${activity.teffBin}/${activity.ageBand}`,
        meta: "Teff + age bins",
      },
      {
        label: "Energetic Flare Rate (>1e32 erg)",
        value: fmt(activity.N32, 3),
        meta: "flares/day",
      },
      { label: "Energetic Flare Recurrence", value: recurrenceText, meta: "for >1e32 erg flares" },
      {
        label: "Solar CME Envelope (FGK)",
        value: activity.teffBin === "FGK" ? "0.5 to 6.0/day" : "n/a",
        meta: activity.teffBin === "FGK" ? "Solar-cycle observed range" : "FGK stars only",
      },
    ];

    kpisEl.innerHTML = items
      .map(
        (x) => `
      <div class="kpi-wrap">
        <div class="kpi ${x.kpiClass || ""}" ${x.kpiAttrs || ""} style="${x.kpiStyle || ""}">
          <div class="kpi__label">${x.label} ${tipIcon(TIP_LABEL[x.tipLabel] || TIP_LABEL[x.label] || "")}</div>
          <div class="kpi__value">${x.value}</div>
          <div class="kpi__meta">${x.meta}</div>
        </div>
      </div>
    `,
      )
      .join("");

    const life = model.earthLikeLifePossible;
    lifeBadge.textContent = `Earth-like Life? ${life}`;
    lifeBadge.classList.remove("good", "warn", "bad");
    if (life === "Yes") lifeBadge.classList.add("good");
    else if (life === "Star Too Young") lifeBadge.classList.add("warn");
    else lifeBadge.classList.add("bad");

    classBadge.textContent = `Class: ${model.spectralClass}`;
    classBadge.classList.remove("good", "warn", "bad");
    classBadge.classList.add(model.spectralClass.startsWith("G") ? "good" : "badge");

    if (model.evolutionMode === "evolved") {
      const rz = model.radiusRsolZams;
      const lz = model.luminosityLsolZams;
      radiusHintEl.textContent = `Auto (evolved): ${fmt(model.radiusRsolAuto, 3)} Rsol  (ZAMS: ${fmt(rz, 3)})`;
      luminosityHintEl.textContent = `Auto (evolved): ${fmt(model.luminosityLsolAuto, 4)} Lsol  (ZAMS: ${fmt(lz, 4)})`;
    } else {
      radiusHintEl.textContent = `Auto (mass-derived): ${fmt(model.radiusRsolAuto, 3)} Rsol`;
      luminosityHintEl.textContent = `Auto (mass-derived): ${fmt(model.luminosityLsolAuto, 4)} Lsol`;
    }
    tempHintEl.textContent = `Auto (from R and L): ${fmt(model.tempK, 0)} K`;

    evolutionHintEl.textContent =
      state.evolutionMode === "evolved"
        ? "Luminosity and radius evolve with age and metallicity (Hurley, Pols & Tout 2000)."
        : "Properties derived from mass only (static scaling laws).  Enable to model stellar ageing.";

    updatePhysicsUI(model);
  }

  // Show/hide input rows and update status based on mode and derivation choice.
  function updatePhysicsUI(model) {
    const isAdvanced = state.physicsMode === "advanced";
    advancedDerivRowEl.style.display = isAdvanced ? "" : "none";
    physicsModeHintEl.textContent = isAdvanced
      ? "Specify any two of Radius, Luminosity, and Temperature; the third is computed via Stefan-Boltzmann (L = R² × (T/5776)⁴)."
      : "All physical properties are derived from mass and age using stellar scaling laws. Toggle Advanced to override specific values.";

    if (isAdvanced) {
      const dm = state.advancedDerivationMode;
      // Show exactly the two input rows for the selected pair
      radiusOverrideRowEl.style.display = dm === "rl" || dm === "rt" ? "" : "none";
      luminosityOverrideRowEl.style.display = dm === "rl" || dm === "lt" ? "" : "none";
      tempOverrideRowEl.style.display = dm === "rt" || dm === "lt" ? "" : "none";
      resolutionStatusEl.style.display = "";

      if (dm === "rl") {
        resolutionStatusEl.textContent = `Computed: Temperature = ${fmt(model.tempK, 0)} K`;
      } else if (dm === "rt") {
        resolutionStatusEl.textContent = `Computed: Luminosity = ${fmt(model.luminosityLsol, 4)} Lsol`;
      } else if (dm === "lt") {
        resolutionStatusEl.textContent = `Computed: Radius = ${fmt(model.radiusRsol, 3)} Rsol`;
      }
    } else {
      // Simple mode: hide all override inputs
      radiusOverrideRowEl.style.display = "none";
      luminosityOverrideRowEl.style.display = "none";
      tempOverrideRowEl.style.display = "none";
      resolutionStatusEl.style.display = "none";
    }
  }

  function syncBoundInputs() {
    massEl.dispatchEvent(new Event("input", { bubbles: true }));
    ageEl.dispatchEvent(new Event("input", { bubbles: true }));
    metallicityEl.dispatchEvent(new Event("input", { bubbles: true }));
  }

  function applyFromInputs() {
    state.name = sanitiseName(nameEl.value);
    nameEl.value = state.name;
    const m = clamp(massEl.value, 0.075, 100);
    const a = clamp(ageEl.value, 0, 20);
    state.massMsol = m;
    state.ageGyr = a;
    const feH = clamp(Number(metallicityEl.value) || 0, -3, 1);
    state.metallicityFeH = feH;
    massEl.value = state.massMsol;
    ageEl.value = state.ageGyr;
    metallicityEl.value = state.metallicityFeH;

    state.physicsMode = physicsToggleEl.checked ? "advanced" : "simple";
    state.advancedDerivationMode = getDerivMode();
    state.evolutionMode = evolutionToggleEl.checked ? "evolved" : "zams";

    // Read overrides only in Advanced mode; in Simple they stay dormant in state
    // so values are preserved if the user switches back to Advanced.
    if (state.physicsMode === "advanced") {
      const rOvRaw = Number(radiusOverrideEl.value);
      state.radiusRsolOverride =
        radiusOverrideRowEl.style.display !== "none" && Number.isFinite(rOvRaw) && rOvRaw > 0
          ? rOvRaw
          : null;

      const lOvRaw = Number(luminosityOverrideEl.value);
      state.luminosityLsolOverride =
        luminosityOverrideRowEl.style.display !== "none" && Number.isFinite(lOvRaw) && lOvRaw > 0
          ? lOvRaw
          : null;

      const tOvRaw = Number(tempOverrideEl.value);
      state.tempKOverride =
        tempOverrideRowEl.style.display !== "none" && Number.isFinite(tOvRaw) && tOvRaw > 0
          ? tOvRaw
          : null;
    }

    syncBoundInputs();
    updateWorld({
      star: {
        name: state.name,
        massMsol: state.massMsol,
        ageGyr: state.ageGyr,
        metallicityFeH: state.metallicityFeH,
        radiusRsolOverride: state.radiusRsolOverride,
        luminosityLsolOverride: state.luminosityLsolOverride,
        tempKOverride: state.tempKOverride,
        physicsMode: state.physicsMode,
        advancedDerivationMode: state.advancedDerivationMode,
        evolutionMode: state.evolutionMode,
      },
    });
    render();
  }

  // Initial population
  nameEl.value = state.name;
  massEl.value = state.massMsol;
  ageEl.value = state.ageGyr;
  metallicityEl.value = state.metallicityFeH;
  physicsToggleEl.checked = state.physicsMode === "advanced";
  evolutionToggleEl.checked = state.evolutionMode === "evolved";
  setDerivMode(state.advancedDerivationMode);
  radiusOverrideEl.value = state.radiusRsolOverride != null ? state.radiusRsolOverride : "";
  luminosityOverrideEl.value =
    state.luminosityLsolOverride != null ? state.luminosityLsolOverride : "";
  tempOverrideEl.value = state.tempKOverride != null ? state.tempKOverride : "";
  syncBoundInputs();
  render();

  wrap.querySelector("#btn-apply").addEventListener("click", applyFromInputs);

  wrap.querySelector("#radiusClear").addEventListener("click", () => {
    radiusOverrideEl.value = "";
  });

  wrap.querySelector("#luminosityClear").addEventListener("click", () => {
    luminosityOverrideEl.value = "";
  });

  wrap.querySelector("#tempClear").addEventListener("click", () => {
    tempOverrideEl.value = "";
  });

  // Live-update the UI layout when the mode toggle or dropdown changes
  physicsToggleEl.addEventListener("change", () => {
    state.physicsMode = physicsToggleEl.checked ? "advanced" : "simple";
    render();
  });

  evolutionToggleEl.addEventListener("change", () => {
    state.evolutionMode = evolutionToggleEl.checked ? "evolved" : "zams";
    render();
  });

  physicsDerivRadios.forEach((r) => {
    r.addEventListener("change", () => {
      state.advancedDerivationMode = getDerivMode();
      render();
    });
  });

  wrap.querySelector("#btn-sol").addEventListener("click", () => {
    // "Sol-ish" (simple): mass 1, age ~4.6 Gyr
    state.name = sanitiseName(nameEl.value);
    nameEl.value = state.name;
    state.massMsol = 1.0;
    state.ageGyr = 4.6;
    state.metallicityFeH = 0.0;
    state.radiusRsolOverride = null;
    state.luminosityLsolOverride = null;
    state.tempKOverride = null;
    state.physicsMode = "simple";
    state.advancedDerivationMode = "rl";
    state.evolutionMode = "zams";
    massEl.value = state.massMsol;
    ageEl.value = state.ageGyr;
    metallicityEl.value = state.metallicityFeH;
    radiusOverrideEl.value = "";
    luminosityOverrideEl.value = "";
    tempOverrideEl.value = "";
    physicsToggleEl.checked = false;
    evolutionToggleEl.checked = false;
    setDerivMode("rl");
    syncBoundInputs();
    updateWorld({
      star: {
        name: state.name,
        massMsol: state.massMsol,
        ageGyr: state.ageGyr,
        metallicityFeH: 0.0,
        radiusRsolOverride: null,
        luminosityLsolOverride: null,
        tempKOverride: null,
        physicsMode: "simple",
        advancedDerivationMode: "rl",
        evolutionMode: "zams",
      },
    });
    render();
  });

  wrap.querySelector("#btn-reset").addEventListener("click", () => {
    state.name = sanitiseName(nameEl.value);
    nameEl.value = state.name;
    state.massMsol = defaults.massMsol;
    state.ageGyr = defaults.ageGyr;
    state.metallicityFeH = 0.0;
    state.radiusRsolOverride = null;
    state.luminosityLsolOverride = null;
    state.tempKOverride = null;
    state.physicsMode = "simple";
    state.advancedDerivationMode = "rl";
    state.evolutionMode = "zams";
    massEl.value = state.massMsol;
    ageEl.value = state.ageGyr;
    metallicityEl.value = state.metallicityFeH;
    radiusOverrideEl.value = "";
    luminosityOverrideEl.value = "";
    tempOverrideEl.value = "";
    physicsToggleEl.checked = false;
    evolutionToggleEl.checked = false;
    setDerivMode("rl");
    syncBoundInputs();
    updateWorld({
      star: {
        name: state.name,
        massMsol: state.massMsol,
        ageGyr: state.ageGyr,
        metallicityFeH: 0.0,
        radiusRsolOverride: null,
        luminosityLsolOverride: null,
        tempKOverride: null,
        physicsMode: "simple",
        advancedDerivationMode: "rl",
        evolutionMode: "zams",
      },
    });
    render();
  });

  // UX: Enter key applies
  [
    nameEl,
    massEl,
    ageEl,
    metallicityEl,
    radiusOverrideEl,
    luminosityOverrideEl,
    tempOverrideEl,
  ].forEach((el) => {
    el.addEventListener("keydown", (e) => {
      if (e.key === "Enter") applyFromInputs();
    });
  });
}
