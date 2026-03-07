// SPDX-License-Identifier: MPL-2.0
import { calcStar } from "../engine/star.js";
import { computeStellarActivityModel } from "../engine/stellarActivity.js";
import { clamp, fmt } from "../engine/utils.js";
import { bindNumberAndSlider } from "./bind.js";
import { createCelestialVisualPreviewController } from "./celestialVisualPreview.js";
import { createElement, replaceChildren } from "./domHelpers.js";
import { attachTooltips, tipIcon } from "./tooltip.js";
import { loadWorld, updateWorld } from "./store.js";
import { createTutorial } from "./tutorial.js";

const TIP_LABEL = {
  Name: "Display name used in exports, the visualiser, and linked pages.",
  Class:
    'Spectral type classification (O, B, A, F, G, K, M from most to least massive/luminous).\n\nEach class is subdivided 0\u20139 (0 = hottest within class). "V" denotes a main-sequence star undergoing core hydrogen fusion.',
  Mass: "Star mass in solar masses.\n\nApproximate main-sequence ranges:\nO: ~16+ Msol\nB: ~2.19\u201316 Msol\nA: ~1.44\u20132.19 Msol\nF: ~1.06\u20131.44 Msol\nG: ~0.84\u20131.06 Msol\nK: ~0.47\u20130.84 Msol\nM: ~0.075\u20130.47 Msol\n\nStars between 0.5 and 1.4 Msol are considered most suitable for Earth-like life.\n\nSun = 1 Msol = 1.989E30 kg",
  "Current Age":
    "Star age in billions of years (Gyr). Must be less than the Maximum Age shown in outputs.",
  "Maximum Age":
    "How long your star will remain on the main sequence, in billions of earth years.\n\nComputed as (M / L) \u00d7 10 Gyr \u2014 nuclear fuel supply divided by luminous burn rate.",
  Radius:
    "Stellar radius in solar radii.\n\nFor M \u2264 0.5 Msol: Schweitzer et al. (2019) linear relation from M-dwarf eclipsing binaries.\nFor 0.5\u20131.5 Msol: Eker et al. (2018, MNRAS 479, 5491) quadratic mass\u2013radius relation.\nFor M > 1.5 Msol: Stefan-Boltzmann derivation from Eker MLR + MTR.\n\nSun = 1 Rsol = 695,700 km",
  Luminosity:
    "Stellar luminosity in solar luminosities.\n\nZAMS mode: Eker et al. (2018, MNRAS 479, 5491) six-piece empirical relation from 509 eclipsing binaries. Replaces the classical L = M\u2074 approximation, which overestimated K-dwarf luminosities by 30\u201385%.\n\nEvolved mode: Hurley, Pols & Tout (2000) analytical stellar evolution. Radius and temperature are accurate to ~1\u20132%, but luminosity carries ~10% mean error inherent to the Tout (1996) polynomial ZAMS baseline and Hurley evolution-rate fits. This is the practical accuracy ceiling of analytical single-star evolution; sub-2% luminosity would require tabulated MESA/MIST isochrone grids.\n\nSun = 1 Lsol = 3.846E26 watts",
  "Radius Override":
    "Optionally override the mass-derived stellar radius in solar radii. Leave blank to use the Eker et al. (2018) scaling-law value derived from mass.\n\nUseful for modelling subgiants, evolved stars, or stars with a measured radius.\n\nSun = 1 Rsol = 695,700 km",
  "Luminosity Override":
    "Optionally override the mass-derived luminosity in solar luminosities. Leave blank to use the Eker et al. (2018) scaling-law value derived from mass.\n\nUseful for modelling post-main-sequence stars or stars with a measured luminosity.\n\nSun = 1 Lsol = 3.846E26 watts",
  "Temperature Override":
    "Optionally override the effective temperature in kelvin. Used with one other override to resolve the third via Stefan-Boltzmann (L = R\u00b2 \u00d7 (T/5776)\u2074).\n\nLeave blank to derive temperature from Radius and Luminosity (default).\n\nSun \u2248 5,776 K.",
  Density: "Mean stellar density in solar densities.\n\nSun = 1 Dsol = 1.41 g/cm\u00b3.",
  Temperature:
    "Effective photospheric temperature in kelvin, derived from luminosity and radius via Stefan-Boltzmann.",
  "Habitable Zone":
    "A planet orbiting within this region receives Earth-like stellar heating.\n\nUses a temperature-dependent model where the inner/outer flux thresholds (S_in/S_out) vary with stellar effective temperature, based on Chromant's Desmos correction.\n\n1 AU = ~150,000,000 km.",
  "Star Colour":
    "Stellar colour derived from effective temperature using Tanner Helland\u2019s empirical blackbody approximation (valid 1000\u201340,000 K, R\u00b2 > 0.987), producing a smooth, continuous colour gradient across spectral classes.",
  "Sun Visual":
    "Animated stellar preview using the current star colour and the active flare/CME rates.\n\nThe preview runs at 0.5 simulated days per second and renders textured photosphere detail plus flare/CME activity.",
  "Earth-like Life?":
    "Whether a planet comparable to modern-day Earth could orbit this star.\n\nYes: the star\u2019s mass and age permit an Earth-like biosphere.\nNo: conditions preclude an Earth-like biosphere.\nStar Too Young: a pre-Cambrian-level biosphere is possible, but complex life has not had time to develop.",
  "Stellar Evolution":
    "When enabled, luminosity and radius evolve with age and metallicity using analytical stellar evolution tracks (Hurley, Pols & Tout 2000).\n\nWhen off, properties are derived from mass only using static scaling laws (ZAMS).",
  "Physics Mode":
    "Simple: all physical properties (radius, luminosity, temperature) are derived from mass and age using stellar scaling laws.\n\nAdvanced: specify any two of radius, luminosity, and temperature; the third is computed via Stefan-Boltzmann (L = R\u00b2 \u00d7 (T/5776)\u2074).",
  "Metallicity [Fe/H]":
    "Stellar metallicity measures heavy-element abundance relative to the Sun.\n\n[Fe/H] = log\u2081\u2080(Fe/H)_star \u2212 log\u2081\u2080(Fe/H)_sun\n\nSun = 0.0 by definition. Positive = metal-rich, negative = metal-poor.\n\nTypical range:\n\u2022 Metal-rich inner disk: +0.1 to +0.5\n\u2022 Solar neighbourhood: \u22120.2 to +0.1\n\u2022 Old thin disk: \u22120.7 to \u22120.3\n\u2022 Halo / globular clusters: \u22122.5 to \u22121.0\n\nMetallicity does not modify the Eker mass\u2013luminosity or mass\u2013radius relations (their empirical scatter already includes metallicity variation). Instead it drives downstream effects like giant planet probability.",
  "Giant Planet Probability":
    "Probability that a star hosts at least one giant planet (\u22650.3 M_Jup).\n\nMetallicity scaling P \u221d 10^(2*[Fe/H]) from Fischer & Valenti (2005, ApJ 622, 1102). Stellar mass scaling P \u221d M from Johnson et al. (2010, PASP 122, 905).\nBaseline ~7% at solar mass and metallicity (Petigura et al. 2018, AJ 155, 89).\n\nM dwarfs host fewer giant planets; A/F stars host more. A +0.3 dex increase in [Fe/H] roughly quadruples the probability.",
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
  "Total Flare Rate (>1e30 erg)":
    "Expected flare rate above 10^30 erg, computed from the flare-frequency distribution (FFD) anchored to N32 and alpha.\n\nThis is a broader event count than the energetic >10^32 erg rate.",
  "Total Flare Recurrence":
    "Recurrence for flares above 10^30 erg, computed as 1 / rate and shown in hours or minutes when frequent.",
  "Associated CME Rate":
    "Expected CME rate linked to flare activity, using an energy-weighted flare-CME association probability and activity suppression at very high flare rates.",
  "Background CME Rate":
    "Expected CME rate not explicitly tied to an individual rendered flare. For FGK stars this fills the gap between the associated rate and the cycle envelope.",
  "Total CME Rate":
    "Total expected CME rate per day. For FGK stars, this follows the solar-cycle envelope and is split into associated and background channels.\n\nReference: Yashiro et al. (2006, JGR 111, A12S05).",
};

const TUTORIAL_STEPS = [
  {
    title: "Getting Started",
    body:
      "The Star page defines your system\u2019s central star. Inputs on the left set " +
      "mass, age, and composition; outputs on the right show derived properties " +
      "like luminosity, habitable zone, and spectral class.",
  },
  {
    title: "Mass and Age",
    body:
      "Mass is the most important input \u2014 it determines nearly everything about " +
      "your star. Age affects luminosity and activity levels. Use the Sol-ish " +
      "Preset for a Sun-like starting point.",
  },
  {
    title: "Stellar Evolution",
    body:
      "Toggle Stellar Evolution to model how your star changes over time. When " +
      "enabled, luminosity and temperature shift based on the star\u2019s age and " +
      "mass, following analytical evolution tracks.",
  },
  {
    title: "Physics Mode",
    body:
      "Simple mode derives all properties from mass alone. Switch to Advanced " +
      "to override any two of Radius, Luminosity, or Temperature \u2014 the third " +
      "is computed via the Stefan-Boltzmann law.",
  },
  {
    title: "Outputs and Life",
    body:
      "Review the outputs panel for habitable zone boundaries, flare activity, " +
      "spectral class, and the life assessment badge. These feed into planet " +
      "and moon calculations on other pages.",
  },
];

function tipIconNode(text) {
  if (!text) return null;
  return createElement("span", {
    className: "tip-icon",
    attrs: { tabindex: "0", role: "note", "aria-label": "Info" },
    dataset: { tip: text },
    text: "i",
  });
}

function renderStarKpis(container, items = []) {
  replaceChildren(
    container,
    (items || []).map((item) => {
      const tipText = TIP_LABEL[item.tipLabel] || TIP_LABEL[item.label] || "";
      if (item.kind === "sunVisual") {
        return createElement("div", { className: "kpi-wrap kpi-wrap--sun-preview" }, [
          createElement("div", { className: "kpi kpi--sun-preview" }, [
            createElement("div", { className: "kpi__label" }, [
              item.label,
              tipText ? " " : "",
              tipIconNode(tipText),
              createElement("span", {
                className: "kpi__expand-indicator",
                attrs: { "aria-hidden": "true" },
                text: "\u25be",
              }),
            ]),
            createElement("canvas", {
              className: "sun-preview-canvas",
              attrs: { width: "180", height: "180", "aria-label": "Star visual preview" },
            }),
            createElement("div", { className: "kpi__value sun-preview-value", text: item.value }),
            createElement("div", { className: "sun-preview-caption", text: item.meta }),
          ]),
        ]);
      }

      return createElement("div", { className: "kpi-wrap" }, [
        createElement(
          "div",
          {
            className: `kpi ${item.kpiClass || ""}`.trim(),
            attrs: { style: item.kpiStyle || null },
          },
          [
            createElement("div", { className: "kpi__label" }, [
              item.label,
              tipText ? " " : "",
              tipIconNode(tipText),
            ]),
            createElement("div", { className: "kpi__value", text: item.value }),
            createElement("div", { className: "kpi__meta", text: item.meta }),
          ],
        ),
      ]);
    }),
  );
  return container;
}

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
    activityModelVersion: world?.star?.activityModelVersion === "v1" ? "v1" : "v2",
  };

  const wrap = document.createElement("div");
  wrap.className = "page";
  wrap.innerHTML = `
    <div class="panel">
      <div class="panel__header">
        <h1 class="panel__title"><span class="ws-icon icon--star" aria-hidden="true"></span><span>Star</span></h1>
        <button id="starTutorials" type="button" class="ws-tutorial-trigger">Tutorials</button>
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

          <div style="height:8px"></div>
          <div class="label">Stellar Evolution ${tipIcon(TIP_LABEL["Stellar Evolution"] || "")}</div>
          <div class="physics-duo-toggle" style="margin:4px 0 6px">
            <input type="radio" name="evolutionMode" id="evolutionOff" value="zams" />
            <label for="evolutionOff">Off</label>
            <input type="radio" name="evolutionMode" id="evolutionOn" value="evolved" />
            <label for="evolutionOn">On</label>
            <span></span>
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

          <div style="height:8px"></div>
          <div class="label">Physics Mode ${tipIcon(TIP_LABEL["Physics Mode"] || "")}</div>
          <div class="physics-duo-toggle" style="margin:4px 0 6px">
            <input type="radio" name="physicsMode" id="physicsSimple" value="simple" />
            <label for="physicsSimple">Simple</label>
            <input type="radio" name="physicsMode" id="physicsAdvanced" value="advanced" />
            <label for="physicsAdvanced">Advanced</label>
            <span></span>
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
            <button id="btn-sol">Sol-ish Preset</button>
            <button id="btn-reset">Reset to Defaults</button>
          </div>

          <div class="hint" style="margin-top:10px">
            Autosaves locally as you make changes.
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
  createTutorial({
    steps: TUTORIAL_STEPS,
    storageKey: "worldsmith.star.tutorial",
    container: wrap,
    triggerBtn: wrap.querySelector("#starTutorials"),
  });

  const nameEl = wrap.querySelector("#starName");
  const massEl = wrap.querySelector("#mass");
  const ageEl = wrap.querySelector("#age");
  const metallicityEl = wrap.querySelector("#metallicity");
  const kpisEl = wrap.querySelector("#kpis");
  const lifeBadge = wrap.querySelector("#lifeBadge");
  const classBadge = wrap.querySelector("#classBadge");
  const physicsModeRadios = wrap.querySelectorAll('[name="physicsMode"]');
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
  const evolutionModeRadios = wrap.querySelectorAll('[name="evolutionMode"]');
  const evolutionHintEl = wrap.querySelector("#evolutionHint");
  const sunPreviewController = createCelestialVisualPreviewController({ speedDaysPerSec: 0.5 });

  // Dispose preview controller when page unmounts
  const _starPageObserver = new MutationObserver(() => {
    if (!document.contains(wrap)) {
      sunPreviewController.dispose();
      _starPageObserver.disconnect();
    }
  });
  _starPageObserver.observe(document.body, { childList: true, subtree: true });

  // Bind number inputs to sliders
  const massSlider = wrap.querySelector("#mass_slider");
  const massMin = wrap.querySelector("#mass_min");
  const massMax = wrap.querySelector("#mass_max");
  massMin.textContent = "0.075";
  massMax.textContent = "100";
  const massBinding = bindNumberAndSlider({
    numberEl: massEl,
    sliderEl: massSlider,
    min: 0.075,
    max: 100,
    step: 0.0001,
    mode: "auto",
    commitOnInput: false,
    onChange: () => applyFromInputs({ commit: true }),
  });

  const ageSlider = wrap.querySelector("#age_slider");
  const ageMin = wrap.querySelector("#age_min");
  const ageMax = wrap.querySelector("#age_max");
  ageMin.textContent = "0";
  ageMax.textContent = "20";
  const ageBinding = bindNumberAndSlider({
    numberEl: ageEl,
    sliderEl: ageSlider,
    min: 0,
    max: 20,
    step: 0.001,
    mode: "auto",
    commitOnInput: false,
    onChange: () => applyFromInputs({ commit: true }),
  });

  const metallicitySlider = wrap.querySelector("#metallicity_slider");
  const metallicityMin = wrap.querySelector("#metallicity_min");
  const metallicityMax = wrap.querySelector("#metallicity_max");
  metallicityMin.textContent = "-3";
  metallicityMax.textContent = "1";
  const metallicityBinding = bindNumberAndSlider({
    numberEl: metallicityEl,
    sliderEl: metallicitySlider,
    min: -3,
    max: 1,
    step: 0.01,
    mode: "linear",
    commitOnInput: false,
    onChange: () => applyFromInputs({ commit: true }),
  });

  function sanitiseName(raw) {
    const txt = String(raw ?? "").trim();
    return txt || defaults.name;
  }

  function readOptionalNumberInput(inputEl) {
    const raw = String(inputEl.value ?? "");
    if (!raw.trim()) return null;
    const asNumber = inputEl.valueAsNumber;
    if (Number.isFinite(asNumber)) return asNumber;
    const parsed = Number(raw);
    return Number.isFinite(parsed) ? parsed : null;
  }

  function readClampedNumberInput(inputEl, min, max, fallback, { commit = false } = {}) {
    const parsed = readOptionalNumberInput(inputEl);
    if (!Number.isFinite(parsed)) {
      if (commit && Number.isFinite(fallback)) inputEl.value = String(fallback);
      return fallback;
    }
    const clamped = clamp(parsed, min, max);
    if (commit) inputEl.value = String(clamped);
    return clamped;
  }

  function readPositiveOverride(inputEl, { commit = false } = {}) {
    const parsed = readOptionalNumberInput(inputEl);
    if (!(parsed > 0)) {
      if (commit) inputEl.value = "";
      return null;
    }
    return parsed;
  }

  function persistState() {
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
        activityModelVersion: state.activityModelVersion,
      },
    });
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

  function formatRecurrence(ratePerDay) {
    const rate = Number(ratePerDay);
    if (!(rate > 0)) return "Rare";
    const days = 1 / rate;
    if (days >= 365) return `~${fmt(days / 365, 2)} years`;
    if (days >= 1) return `~${fmt(days, 2)} days`;
    const hours = days * 24;
    if (hours >= 1) return `~${fmt(hours, 2)} hours`;
    return `~${fmt(hours * 60, 2)} minutes`;
  }

  function shortPopulationLabel(label) {
    const txt = String(label || "").trim();
    if (txt === "Population I (solar neighbourhood)") return "Pop I";
    if (txt === "Intermediate (old thin disk)") return "Intermediate";
    if (txt === "Population II (metal-poor)") return "Pop II";
    if (txt === "Metal-rich (inner disk)") return "Metal-rich";
    return txt;
  }

  function render() {
    const ov = getEffectiveOverrides();
    const model = calcStar({
      ...state,
      radiusRsolOverride: ov.r,
      luminosityLsolOverride: ov.l,
      tempKOverride: ov.t,
    });
    const activityModel = computeStellarActivityModel(
      {
        massMsun: state.massMsol,
        ageGyr: state.ageGyr,
        teffK: model.tempK,
        luminosityLsun: model.luminosityLsol,
      },
      { activityCycle: 0.5 },
    );
    const activity = activityModel.activity;
    const energeticRecurrenceText = formatRecurrence(activity.energeticFlareRatePerDay);
    const totalRecurrenceText = formatRecurrence(activity.totalFlareRatePerDay);
    const cmeTotalMeta =
      activity.teffBin === "FGK"
        ? "Solar-cycle envelope split into associated + background"
        : "Empirical split model outside FGK solar envelope";

    const items = [
      {
        kind: "sunVisual",
        label: "Star Visualiser",
        tipLabel: "Star Colour",
        value: `${model.starColourHex}`,
        meta: "Hex (derived from temperature) - Animated at 0.5 d/s with flares + CMEs",
      },
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
        label: "Habitable Zone",
        value: model.display.hzAu,
        meta: "AU | " + model.display.hzMkm + " million km",
      },
      {
        label: "Giant Planet Probability",
        value: `${fmt(model.giantPlanetProbability * 100, 1)}%`,
        meta: "Fischer & Valenti (2005); Johnson et al. (2010)",
      },
      {
        label: "Population",
        tipLabel: "Stellar Population",
        value: shortPopulationLabel(model.populationLabel),
        meta: `${model.populationLabel} | [Fe/H] = ${fmt(model.inputs.metallicityFeH, 2)}`,
      },
      {
        label: "Activity Regime",
        value: `${activity.teffBin}/${activity.ageBand}`,
        meta: "Teff + age bins",
      },
      {
        label: "N32 Rate",
        tipLabel: "Energetic Flare Rate (>1e32 erg)",
        value: fmt(activity.energeticFlareRatePerDay, 3),
        meta: "flares/day (>1e32 erg)",
      },
      {
        label: "Energetic Flare Recurrence",
        value: energeticRecurrenceText,
        meta: "for >1e32 erg flares",
      },
      {
        label: "Total Flare Rate (>1e30 erg)",
        value: fmt(activity.totalFlareRatePerDay, 3),
        meta: "flares/day",
      },
      {
        label: "Total Flare Recurrence",
        value: totalRecurrenceText,
        meta: "for >1e30 erg flares",
      },
      {
        label: "Associated CME Rate",
        value: fmt(activity.cmeAssociatedRatePerDay, 3),
        meta: "CME/day",
      },
      {
        label: "Background CME Rate",
        value: fmt(activity.cmeBackgroundRatePerDay, 3),
        meta: "CME/day",
      },
      {
        label: "Total CME Rate",
        value: fmt(activity.cmeTotalRatePerDay, 3),
        meta: cmeTotalMeta,
      },
      {
        label: "Solar CME Envelope (FGK)",
        value: activity.teffBin === "FGK" ? "0.5 to 6.0/day" : "n/a",
        meta: activity.teffBin === "FGK" ? "Solar-cycle observed range" : "FGK stars only",
      },
    ];

    renderStarKpis(kpisEl, items);

    sunPreviewController.attach(kpisEl.querySelector(".sun-preview-canvas"), {
      starName: state.name,
      starMassMsol: state.massMsol,
      starAgeGyr: state.ageGyr,
      starTempK: model.tempK,
      starColourHex: model.starColourHex,
      activity,
    });

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
    massBinding.syncFromNumber({ commit: false, normalize: true });
    ageBinding.syncFromNumber({ commit: false, normalize: true });
    metallicityBinding.syncFromNumber({ commit: false, normalize: true });
  }

  let hydrating = false;
  function applyFromInputs({ commit = false } = {}) {
    if (hydrating) return;
    hydrating = true;
    state.name = commit ? sanitiseName(nameEl.value) : sanitiseName(String(nameEl.value ?? ""));
    if (commit) nameEl.value = state.name;
    state.massMsol = readClampedNumberInput(massEl, 0.075, 100, state.massMsol, { commit });
    state.ageGyr = readClampedNumberInput(ageEl, 0, 20, state.ageGyr, { commit });
    state.metallicityFeH = readClampedNumberInput(metallicityEl, -3, 1, state.metallicityFeH, {
      commit,
    });

    state.physicsMode = wrap.querySelector('input[name="physicsMode"]:checked')?.value || "simple";
    state.advancedDerivationMode = getDerivMode();
    state.evolutionMode =
      wrap.querySelector('input[name="evolutionMode"]:checked')?.value || "zams";

    // Read overrides only in Advanced mode; in Simple they stay dormant in state
    // so values are preserved if the user switches back to Advanced.
    if (state.physicsMode === "advanced") {
      state.radiusRsolOverride =
        radiusOverrideRowEl.style.display !== "none"
          ? readPositiveOverride(radiusOverrideEl, { commit })
          : null;

      state.luminosityLsolOverride =
        luminosityOverrideRowEl.style.display !== "none"
          ? readPositiveOverride(luminosityOverrideEl, { commit })
          : null;

      state.tempKOverride =
        tempOverrideRowEl.style.display !== "none"
          ? readPositiveOverride(tempOverrideEl, { commit })
          : null;
    }

    if (commit) {
      syncBoundInputs();
      persistState();
    }
    render();
    hydrating = false;
  }

  // Initial population
  nameEl.value = state.name;
  massEl.value = state.massMsol;
  ageEl.value = state.ageGyr;
  metallicityEl.value = state.metallicityFeH;
  const physicsRadio = wrap.querySelector(
    `#${state.physicsMode === "advanced" ? "physicsAdvanced" : "physicsSimple"}`,
  );
  if (physicsRadio) physicsRadio.checked = true;
  const evolutionRadio = wrap.querySelector(
    `#${state.evolutionMode === "evolved" ? "evolutionOn" : "evolutionOff"}`,
  );
  if (evolutionRadio) evolutionRadio.checked = true;
  setDerivMode(state.advancedDerivationMode);
  radiusOverrideEl.value = state.radiusRsolOverride != null ? state.radiusRsolOverride : "";
  luminosityOverrideEl.value =
    state.luminosityLsolOverride != null ? state.luminosityLsolOverride : "";
  tempOverrideEl.value = state.tempKOverride != null ? state.tempKOverride : "";
  syncBoundInputs();
  render();

  // Live-update: apply on every input change
  [
    nameEl,
    massEl,
    ageEl,
    metallicityEl,
    radiusOverrideEl,
    luminosityOverrideEl,
    tempOverrideEl,
  ].forEach((el) => el.addEventListener("input", () => applyFromInputs()));
  [nameEl, radiusOverrideEl, luminosityOverrideEl, tempOverrideEl].forEach((el) =>
    el.addEventListener("change", () => applyFromInputs({ commit: true })),
  );

  wrap.querySelector("#radiusClear").addEventListener("click", () => {
    radiusOverrideEl.value = "";
    applyFromInputs({ commit: true });
  });

  wrap.querySelector("#luminosityClear").addEventListener("click", () => {
    luminosityOverrideEl.value = "";
    applyFromInputs({ commit: true });
  });

  wrap.querySelector("#tempClear").addEventListener("click", () => {
    tempOverrideEl.value = "";
    applyFromInputs({ commit: true });
  });

  // Live-update the UI layout when the mode toggle or dropdown changes
  physicsModeRadios.forEach((r) => {
    r.addEventListener("change", () => {
      state.physicsMode = r.value;
      applyFromInputs({ commit: true });
    });
  });

  evolutionModeRadios.forEach((r) => {
    r.addEventListener("change", () => {
      state.evolutionMode = r.value;
      applyFromInputs({ commit: true });
    });
  });

  physicsDerivRadios.forEach((r) => {
    r.addEventListener("change", () => {
      state.advancedDerivationMode = getDerivMode();
      applyFromInputs({ commit: true });
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
    const physSimpleR = wrap.querySelector("#physicsSimple");
    if (physSimpleR) physSimpleR.checked = true;
    const evoOffR = wrap.querySelector("#evolutionOff");
    if (evoOffR) evoOffR.checked = true;
    setDerivMode("rl");
    syncBoundInputs();
    persistState();
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
    const physSimpleR = wrap.querySelector("#physicsSimple");
    if (physSimpleR) physSimpleR.checked = true;
    const evoOffR = wrap.querySelector("#evolutionOff");
    if (evoOffR) evoOffR.checked = true;
    setDerivMode("rl");
    syncBoundInputs();
    persistState();
    render();
  });
}
