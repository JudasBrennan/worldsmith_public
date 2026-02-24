import { calcMoon } from "../engine/moon.js";
import { calcGasGiant } from "../engine/gasGiant.js";
import { fmt } from "../engine/utils.js";
import { bindNumberAndSlider } from "./bind.js";
import {
  loadWorld,
  updateWorld,
  listPlanets,
  listMoons,
  listSystemGasGiants,
  getSelectedMoon,
  getStarOverrides,
  selectMoon,
  createMoonFromInputs,
  deleteMoon,
  updateMoon,
  assignMoonToPlanet,
} from "./store.js";
import { attachTooltips, tipIcon } from "./tooltip.js";

const TIP_LABEL = {
  "Star Mass": "The star's mass in solar masses.\n\nSol = 1 Msol.",
  "Star Radius": "The star's radius in solar radii.\n\nSol = 1 Rsol.",
  "Star Luminosity": "The luminosity of the star in solar luminosities.\n\nSol = 1 Lsol.",
  "Star Age": "The age of the star in billions of years.",
  "Planet Mass": "The planet's mass in Earth masses.\n\nEarth = 1 MEarth.",
  "Planet CMF": "The planet's Core Mass Fraction.",
  "Planet Density": "The density of the planet in g/cm3.\n\nEarth = 5.51 g/cm3.",
  "Planet Radius": "The radius of the planet in Earth radii.\n\nEarth = 1 REarth = 6,371 km.",
  "Planet Gravity": "The surface gravity at sea level on the planet.\n\nEarth = 1 g = 9.8 m/s2.",
  "Planet Semi-Major Axis":
    "The distance from the star at which the planet orbits, in AU.\n\nEarth = 1 AU.",
  "Planet Eccentricity":
    "The planet's orbital eccentricity.\n\nEarth's orbital eccentricity = 0.0167.",
  "Planet Periapsis": "The closest the planet gets to its star during orbit.",
  "Planet Orbital Period": "The length of a year on the planet, in Earth days.",
  "Planet Rotation Period": "The length of a day on the planet in Earth hours.",
  Mass: "The moon's mass in Moon masses. Moons should be less massive than their parent planet.\n\nOur Moon = 1 MMoon = 7.342E22 kg.",
  Density:
    "The density of the moon in g/cm3. Rocky moons should have densities greater than 3 g/cm3.\n\nOur Moon = 3.34 g/cm3.",
  Radius:
    "The moon's radius in Moon radii. Major moons, like our Moon, should have radii greater than 0.173 RMoon.\n\nOur Moon = 1 RMoon = 1,736.4 km.",
  Gravity:
    "The surface gravity on the moon relative to Earth.\n\nEarth = 1 g = 9.8 m/s2.\nOur Moon = 0.17 g = 1.62 m/s2.",
  "Escape Velocity":
    "The speed required to escape the gravitational pull of the moon.\n\nOur Moon's escape velocity is about 2.38 km/s. Earth's escape velocity is 11.2 km/s.",
  Albedo:
    "The moon's bond albedo. Albedo measures how reflective a body is, on a scale of 0 to 1.\n\n0 = a perfect absorber (absorbs 100% of incoming radiation).\n1 = a perfect reflector (reflects 100% of incoming radiation).\n\nMercury = 0.068\nVenus = 0.77\nEarth = 0.306\nMoon = 0.11\nJupiter = 0.343\nSaturn = 0.342\nUranus = 0.30\nNeptune = 0.29\nPluto = 0.49",
  "Moon Zone (Inner)":
    "The closest a moon can orbit the planet. Any closer and tidal forces will tear it apart (the Roche limit).",
  "Moon Zone (Outer)":
    "The furthest a moon can orbit the planet. Beyond this distance the moon is no longer gravitationally bound.",
  "Semi-Major Axis":
    "The distance from the planet at which the moon orbits, in km.\n\nFor moons of habitable Earth-like planets, the semi-major axis should fall between Moon Zone (Inner) and half of Moon Zone (Outer). If the planet has multiple major moons, they should be spaced at least 10 planetary radii apart.\n\nWorldSmith Web guards this value on Apply to keep the orbit inside the Moon Zone. Values that are too small are raised to avoid collision/disruption, and values that are too large are lowered to avoid escape.\n\nOur Moon orbits Earth at a distance of 384,748 km.",
  Eccentricity:
    "The moon's orbital eccentricity, a measure of how elliptical the orbit is. The scale goes from 0 to 1.\n\n0 = orbit is a perfect circle.\n1 = orbit is a parabola.\n\nMajor moons should have very low eccentricities.\n\nOur Moon's orbital eccentricity = 0.055.",
  Periapsis:
    "The closest the moon gets to the planet during orbit.\n\nFor moons of habitable Earth-like planets, this distance should fall between Moon Zone (Inner) and Moon Zone (Outer).",
  Apoapsis:
    "The furthest the moon gets from the planet during orbit.\n\nFor moons of habitable Earth-like planets, this distance should fall between Moon Zone (Inner) and Moon Zone (Outer).",
  Inclination:
    "The inclination of the moon's orbit relative to the planet's orbital plane.\n\nInclinations range from 0\u2013180\u00ba. Major moons should have very low inclinations.\n\nOur Moon = 5.15\u00ba (with respect to the ecliptic).",
  "Orbital Direction":
    "Prograde = the moon orbits the planet in the same direction as the planet's spin.\n\nRetrograde = the moon orbits the planet in the opposite direction of the planet's spin.\n\nUndefined = the orbital inclination is exactly 90\u00ba, so the orbit is classed as neither prograde nor retrograde.\n\nMajor moons of habitable Earth-like planets should be on prograde orbits.",
  "Orbital Period (sidereal)":
    "The time it takes the moon to complete one orbit of the planet with respect to the background stars, in Earth days.",
  "Orbital Period (synodic)":
    "The time between successive occurrences of the same lunar phase (e.g. full moon to full moon).\n\nThis value represents a lunar month on the planet.",
  "Rotation Period":
    'The time it takes the moon to complete one full rotation about its axis.\n\nIf this shows "Not tidally locked", the moon is not tidally locked to the planet, so this model does not calculate a fixed rotation period.',
  "Total Tidal Force":
    "The total tidal force exerted on the planet by the moon and the star, relative to the tidal forces exerted on Earth.\n\n<1 = tides less extreme than Earth.\n~1 = tides comparable to Earth.\n>1 = tides more extreme than Earth.",
  "Moon Contribution":
    "The fraction of the total tidal force contributed by the moon.\n\nEarth's Moon \u2248 66%.",
  "Star Contribution":
    "The fraction of the total tidal force contributed by the star.\n\nSol \u2248 33%.",
  "Moon locked to Planet?":
    'Checks whether the moon is tidally locked to the planet.\n\nA body is tidally locked when it takes the same amount of time to spin about its axis as it does to orbit its companion. Tidally locked objects always present the same face to their companion.\n\nMajor moons should always be tidally locked to the planet, i.e., the expected output is "Yes".',
  "Planet locked to Moon?":
    "Checks whether the planet is tidally locked to the moon.\n\nThe calculations used here are rough approximations, so the output is necessarily imprecise. Outputs that display in red indicate a likely problematic configuration. Adjust the moon's semi-major axis to change the result.",
  "Planet locked to Star?":
    'Checks whether the planet is expected to be tidally locked to its star.\n\nWorldSmith Web uses a user-friendly rule: this shows "Yes" when the computed Planet\u2192Star lock time is less than or equal to the current star age.\n\nFor an Earth-like setup, this should usually remain "No".',
  "Derived Data": "Read-only star and planet context used for moon calculations.",
  "Moon selection": "Choose which saved moon you are editing.",
  "Editing moon": "Select a moon, create a new one, or delete the current one.",
  "Belongs to planet": "Set the parent planet this moon orbits, or leave it unassigned.",
  Identity: "Identity fields for the currently selected moon.",
  Name: "Set the moon's display name used across tabs and exports.",
  Orbit: "Orbital inputs that determine moon distance, periods, and lock behaviour.",
  Physical: "Physical inputs used to derive radius, gravity, and escape velocity.",
  Composition:
    "Inferred from bulk density as a proxy for rock/ice fraction. Controls the material rigidity (\u03BC) and tidal quality factor (Q) used in tidal lock and heating calculations.\n\nDensity alone is often enough for cold, geologically quiet moons. But moons with extreme internal states \u2014 active volcanism or subsurface oceans \u2014 have much softer interiors than their bulk density implies. Use the Composition Override dropdown to select a special class when your moon has one of these conditions.\n\nIron-rich (>5 g/cm\u00B3): Dense metallic core, like Mercury.\nRocky (3.2\u20135 g/cm\u00B3): Solid silicate mantle. Earth\u2019s Moon, Io (cold).\nMixed rock/ice (2\u20133.2 g/cm\u00B3): Roughly equal rock and ice. Europa.\nIcy (1\u20132 g/cm\u00B3): Mostly water ice with some rock. Ganymede, Titan.\nVery icy (<1 g/cm\u00B3): Dominated by volatile ices. Cometary bodies.\n\nSpecial overrides (see Composition Override tooltip):\nSubsurface ocean: Liquid layer decouples the ice shell (\u03BC = 0.3 GPa, Q = 2).\nPartially molten: Magma interior from extreme tidal heating (\u03BC = 10 GPa, Q = 10).",
  "Composition Override":
    "Override the density-derived composition class with a specific interior state. Density is a good proxy for cold, solid moons, but it underestimates tidal heating by 10\u2013100\u00D7 for moons with extreme interiors.\n\nAuto (from density): Default. Best for geologically quiet moons.\n\nVery icy: Cometary or outer solar system bodies dominated by volatile ices. Low density (<1 g/cm\u00B3).\n\nIcy: Mostly water ice with some rock. Ganymede, Callisto, Rhea. Density 1\u20132 g/cm\u00B3.\n\nSubsurface ocean: A global liquid ocean beneath a thin ice shell dramatically softens the body and amplifies tidal dissipation. Use for moons showing signs of geological activity despite low density (cryovolcanism, plumes, young surface). Calibrated to Enceladus: predicted heating matches Cassini observations within 10%. WARNING: over-predicts for large moons like Titan (\u223C37\u00D7 too high) \u2014 use Icy for those.\n\nMixed rock/ice: Roughly half rock, half ice. Europa\u2019s density (3.0 g/cm\u00B3) places it here. Good default for moons of giant planets with intermediate density.\n\nRocky: Solid silicate mantle, like Earth\u2019s Moon (3.34 g/cm\u00B3). Appropriate for tidally quiet rocky moons.\n\nPartially molten: Extreme tidal heating has melted the interior, creating a magma ocean or mushy mantle. This makes the body much softer than solid rock, dramatically increasing dissipation. Use for moons in strong orbital resonances with high volcanic activity. Calibrated to Io: predicted heating matches observed 10\u00B9\u2074 W within 1%.\n\nIron-rich: Dense metallic body (>5 g/cm\u00B3). Very stiff, dissipates little energy. Mercury-like composition.",
  "Tidal Heating":
    "Surface heat flux from tidal deformation of the moon by its parent body. Uses the Wisdom (2008) formula with higher-order eccentricity corrections that remain accurate up to e \u2248 0.8.\n\nHigher eccentricity and closer orbits produce more heating. Io: ~0.3\u20132 W/m\u00B2 (highest in the Solar System). Earth's geothermal flux: 0.09 W/m\u00B2.",
  "Tidal Heating (\u00D7 Earth)":
    "Tidal surface heat flux normalised to Earth's mean geothermal heat flux (0.09 W/m\u00B2).\n\n<1 = less than Earth's internal heat. >1 = more. Io \u2248 4\u00D7 Earth (equilibrium model).",
  "Orbital Recession":
    "Rate of orbital migration due to tidal dissipation. Positive = outward (planet spins faster than moon orbits, like Earth\u2013Moon at +3.8 cm/yr). Negative = inward (planet spins slower, like Phobos spiralling toward Mars).\n\nDriven by two competing effects: the planet\u2019s tidal bulge transfers angular momentum, while the moon\u2019s own dissipation damps the orbit inward.",
  "Orbital Fate":
    "Linear extrapolation of the current recession rate to estimate when the moon reaches the Roche limit (tidal disruption) or escapes the Hill sphere.\n\nThis is a rough estimate \u2014 real orbital evolution is non-linear and depends on changing tidal parameters over geological time.",
  Limits: "Derived orbital limits and lock times for the selected moon.",
};

export function initMoonPage(mountEl) {
  const world = loadWorld();

  const sov0 = getStarOverrides(world.star);
  const state = {
    starMassMsol: Number(world.star.massMsol),
    starAgeGyr: Number(world.star.ageGyr),
    starRadiusRsolOverride: sov0.r,
    starLuminosityLsolOverride: sov0.l,
    starTempKOverride: sov0.t,
    starEvolutionMode: sov0.ev,
    planet: { ...world.planet },
    moon: { ...world.moon },
  };

  const wrap = document.createElement("div");
  wrap.className = "page";
  wrap.innerHTML = `
    <div class="panel">
      <div class="panel__header">
        <h1 class="panel__title"><span class="ws-icon icon--moons" aria-hidden="true"></span><span>Moons</span></h1>
        <div class="badge">Interactive tool</div>
      </div>
      <div class="panel__body">
        <div class="hint">Create moons for selected planets and tune orbit/physical inputs. Use outputs to check periods, lock state, and tides.</div>
      </div>
    </div>

    <div class="grid-2">
      <div class="panel">
        <div class="panel__header"><h2>Inputs</h2></div>
        <div class="panel__body">

          <div class="label">Derived Data ${tipIcon(TIP_LABEL["Derived Data"] || "")}</div>
          <div class="derived-readout" id="context"></div>

          <div style="height:12px"></div>

          <div class="label">Moon selection ${tipIcon(TIP_LABEL["Moon selection"] || "")}</div>
          <div class="form-row">
            <div>
              <div class="label">Editing moon ${tipIcon(TIP_LABEL["Editing moon"] || "")}</div>
              <div class="hint">Create multiple moons and assign each to a planet.</div>
            </div>
            <div class="select-stack">
              <select id="moonSelect"></select>
              <div class="select-actions">
                <button id="moonNew" class="small" type="button">New</button>
                <button id="moonDelete" class="small danger" type="button">Delete</button>
              </div>
            </div>
          </div>

          <div class="form-row">
            <div>
              <div class="label">Belongs to planet ${tipIcon(TIP_LABEL["Belongs to planet"] || "")}</div>
              <div class="hint">Set a parent planet or leave this moon unassigned.</div>
            </div>
            <select id="moonPlanetSelect"></select>
          </div>

          <div style="height:10px"></div>

<div class="label">Identity ${tipIcon(TIP_LABEL["Identity"] || "")}</div>
          <div class="form-row">
            <div>
              <div class="label">Name ${tipIcon(TIP_LABEL["Name"] || "")}</div>
              <div class="hint">Used in exports and print view.</div>
            </div>
            <input id="name" type="text" />
          </div>

          <div style="height:8px"></div>
          <div class="label">Orbit ${tipIcon(TIP_LABEL["Orbit"] || "")}</div>

          ${numWithSlider("a", "Semi-Major Axis", "km", "", 10, 1e9, 100, "Semi-Major Axis")}
          ${numWithSlider("e", "Eccentricity", "", "", 0, 0.99, 0.001, "Eccentricity")}
          ${numWithSlider("inc", "Inclination", "°", "", 0, 180, 0.1, "Inclination")}

          <div style="height:8px"></div>
          <div class="label">Physical ${tipIcon(TIP_LABEL["Physical"] || "")}</div>

          ${numWithSlider("m", "Mass", "MMoon", "", 0.001, 1000, 0.001, "Mass")}
          ${numWithSlider("density", "Density", "g/cm³", "", 0.1, 20, 0.01, "Density")}
          ${numWithSlider("albedo", "Albedo", "", "", 0, 0.95, 0.001, "Albedo")}

          <div class="form-row">
            <div>
              <div class="label">Composition Override ${tipIcon(TIP_LABEL["Composition Override"] || "")}</div>
            </div>
            <select id="compOverride" aria-label="Composition Override">
              <option value="">Auto (from density)</option>
              <option value="Very icy">Very icy</option>
              <option value="Icy">Icy</option>
              <option value="Subsurface ocean">Subsurface ocean</option>
              <option value="Mixed rock/ice">Mixed rock/ice</option>
              <option value="Rocky">Rocky</option>
              <option value="Partially molten">Partially molten</option>
              <option value="Iron-rich">Iron-rich</option>
            </select>
          </div>

          <div class="button-row">
            <button class="primary" id="btn-apply">Apply</button>
            <button id="btn-default">Reset to Defaults</button>
          </div>

          <div class="hint" style="margin-top:10px">
            Radius, gravity, and escape velocity are derived from Mass + Density.
          </div>
        </div>
      </div>

      <div class="panel">
        <div class="panel__header"><h2>Outputs</h2></div>
        <div class="panel__body">
          <div class="kpi-grid" id="kpis"></div>

          <div style="margin-top:14px">
            <div class="label">Derived limits ${tipIcon(TIP_LABEL["Limits"] || "")}</div>
            <div class="derived-readout" id="limits"></div>
          </div>
        </div>
      </div>
    </div>
  `;
  mountEl.appendChild(wrap);
  attachTooltips(wrap);

  const moonSelectEl = wrap.querySelector("#moonSelect");
  const moonNewEl = wrap.querySelector("#moonNew");
  const moonDeleteEl = wrap.querySelector("#moonDelete");
  const moonPlanetSelectEl = wrap.querySelector("#moonPlanetSelect");

  const contextEl = wrap.querySelector("#context");
  const nameEl = wrap.querySelector("#name");

  const aEl = wrap.querySelector("#a");
  const eEl = wrap.querySelector("#e");
  const incEl = wrap.querySelector("#inc");
  const mEl = wrap.querySelector("#m");
  const densityEl = wrap.querySelector("#density");
  const albedoEl = wrap.querySelector("#albedo");
  const compOverrideEl = wrap.querySelector("#compOverride");

  const kpisEl = wrap.querySelector("#kpis");
  const limitsEl = wrap.querySelector("#limits");
  let noticeTimer = null;

  bindPair("a", aEl, 10, 1e9, 100, "auto");
  bindPair("e", eEl, 0, 0.99, 0.001, "auto");
  bindPair("inc", incEl, 0, 180, 0.1, "auto");
  bindPair("m", mEl, 0.001, 1000, 0.001, "auto");
  bindPair("density", densityEl, 0.1, 20, 0.01, "auto");
  bindPair("albedo", albedoEl, 0, 0.95, 0.001, "auto");

  function bindPair(id, numberEl, min, max, step, mode) {
    const sliderEl = wrap.querySelector(`#${id}_slider`);
    const minEl = wrap.querySelector(`#${id}_min`);
    const maxEl = wrap.querySelector(`#${id}_max`);
    minEl.textContent = String(min);
    maxEl.textContent = String(max);
    bindNumberAndSlider({ numberEl, sliderEl, min, max, step, mode });
  }

  function syncFromWorld() {
    const w = loadWorld();
    state.starMassMsol = Number(w.star.massMsol);
    state.starAgeGyr = Number(w.star.ageGyr);
    const sovW = getStarOverrides(w.star);
    state.starRadiusRsolOverride = sovW.r;
    state.starLuminosityLsolOverride = sovW.l;
    state.starTempKOverride = sovW.t;
    state.starEvolutionMode = sovW.ev;
    const selMoon = getSelectedMoon(w);
    state.moonId = selMoon?.id || w.moons?.selectedId;
    state.moon = { ...(selMoon?.inputs || w.moon) };
    state.moonName = selMoon?.name || state.moon.name || "Luna";
    state.moonPlanetId = selMoon ? (selMoon.planetId ?? null) : null;
    state.moonLocked = !!selMoon?.locked;
    const resolved = resolvePlanetInputs(w, state.moonPlanetId);
    state.parentType = resolved.type;
    if (resolved.type === "gasGiant") {
      state.gasGiant = resolved.gasGiant;
      state.planet = null;
    } else {
      state.planet = resolved.inputs;
      state.gasGiant = null;
    }
  }

  function resolvePlanetInputs(world, planetId) {
    const pid = planetId == null ? null : String(planetId);
    if (pid) {
      const parent = listPlanets(world).find((p) => String(p.id) === pid);
      if (parent?.inputs) return { type: "planet", inputs: { ...parent.inputs } };
      // Check gas giants
      const gg = listSystemGasGiants(world).find((g) => String(g.id) === pid);
      if (gg) return { type: "gasGiant", gasGiant: gg };
    }
    return { type: "planet", inputs: { ...world.planet } };
  }

  function collectDraftMoonInputs() {
    return {
      name: nameEl.value || "New Moon",
      semiMajorAxisKm: Number(aEl.value),
      eccentricity: Number(eEl.value),
      inclinationDeg: Number(incEl.value),
      massMoon: Number(mEl.value),
      densityGcm3: Number(densityEl.value),
      albedo: Number(albedoEl.value),
      compositionOverride: compOverrideEl.value || null,
    };
  }

  function showMoonNotice(message) {
    let noteEl = wrap.querySelector(".moon-float-note");
    if (!noteEl) {
      noteEl = document.createElement("div");
      noteEl.className = "moon-float-note";
      wrap.appendChild(noteEl);
    }
    noteEl.textContent = message;
    noteEl.classList.add("is-visible");
    if (noticeTimer) clearTimeout(noticeTimer);
    noticeTimer = setTimeout(() => {
      noteEl.classList.remove("is-visible");
    }, 3200);
  }

  function populatePlanetOptions() {
    const w = loadWorld();
    const planets = listPlanets(w);
    const gasGiants = listSystemGasGiants(w);
    moonPlanetSelectEl.innerHTML =
      `<option value="">Unassigned</option>` +
      `<optgroup label="Planets">` +
      planets
        .map(
          (p) =>
            `<option value="${escapeHtml(p.id)}">${escapeHtml(p.name || p.inputs?.name || p.id)}</option>`,
        )
        .join("") +
      `</optgroup>` +
      `<optgroup label="Gas Giants">` +
      gasGiants
        .map((g) => `<option value="${escapeHtml(g.id)}">${escapeHtml(g.name || g.id)}</option>`)
        .join("") +
      `</optgroup>`;
    const selectedValue = state.moonPlanetId == null ? "" : String(state.moonPlanetId);
    moonPlanetSelectEl.value = selectedValue;
    if (moonPlanetSelectEl.value !== selectedValue) moonPlanetSelectEl.value = "";
    moonPlanetSelectEl.disabled = !!state.moonLocked;
    moonPlanetSelectEl.title = state.moonLocked
      ? "This moon is locked to its current planet on the Planetary System tab."
      : "";
  }

  function populateMoonSelect() {
    const w = loadWorld();
    const moons = listMoons(w);
    moonSelectEl.innerHTML = moons
      .map(
        (m) =>
          `<option value="${escapeHtml(m.id)}">${escapeHtml(m.name || m.inputs?.name || m.id)}</option>`,
      )
      .join("");
    moonSelectEl.value = w.moons.selectedId;
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function buildParentOverride(gg) {
    const starW = loadWorld().star;
    const ggModel = calcGasGiant({
      massMjup: gg.massMjup,
      radiusRj: gg.radiusRj,
      orbitAu: Number(gg.au) || 5,
      rotationPeriodHours: gg.rotationPeriodHours,
      metallicity: gg.metallicity,
      starMassMsol: Number(starW.massMsol) || 1,
      starLuminosityLsol: Number(starW.luminosityLsol) || 1,
      starAgeGyr: Number(starW.ageGyr) || 4.6,
      starRadiusRsol: Number(starW.radiusRsol) || 1,
    });
    return {
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
  }

  function render() {
    syncFromWorld();

    let model;
    if (state.parentType === "gasGiant" && state.gasGiant) {
      const po = buildParentOverride(state.gasGiant);
      contextEl.textContent =
        `Star Mass: ${fmt(state.starMassMsol, 4)} Msol\n` +
        `Parent: ${state.gasGiant.name || state.gasGiant.id} (gas giant)\n` +
        `Parent orbit: ${fmt(po.inputs.semiMajorAxisAu, 3)} AU`;
      model = calcMoon({
        starMassMsol: state.starMassMsol,
        starAgeGyr: state.starAgeGyr,
        starRadiusRsolOverride: state.starRadiusRsolOverride,
        starLuminosityLsolOverride: state.starLuminosityLsolOverride,
        starTempKOverride: state.starTempKOverride,
        starEvolutionMode: state.starEvolutionMode,
        moon: state.moon,
        parentOverride: po,
      });
    } else {
      contextEl.textContent =
        `Star Mass: ${fmt(state.starMassMsol, 4)} Msol\n` +
        `Planet Mass: ${fmt(state.planet.massEarth, 3)} MEarth\n` +
        `Planet orbit: ${fmt(state.planet.semiMajorAxisAu, 3)} AU`;
      model = calcMoon({
        starMassMsol: state.starMassMsol,
        starAgeGyr: state.starAgeGyr,
        starRadiusRsolOverride: state.starRadiusRsolOverride,
        starLuminosityLsolOverride: state.starLuminosityLsolOverride,
        starTempKOverride: state.starTempKOverride,
        starEvolutionMode: state.starEvolutionMode,
        planet: state.planet,
        moon: state.moon,
      });
    }

    const items = [
      // MAJOR MOON PHYSICAL CHARACTERISTICS
      { label: "Radius", value: model.display.radius, meta: "derived" },
      { label: "Gravity", value: model.display.gravity, meta: "" },
      { label: "Escape Velocity", value: model.display.esc, meta: "" },
      { label: "Albedo", value: fmt(state.moon.albedo, 3), meta: "" },

      // MAJOR MOON ORBITAL CHARACTERISTICS
      { label: "Moon Zone (Inner)", value: model.display.zoneInner, meta: "" },
      { label: "Moon Zone (Outer)", value: model.display.zoneOuter, meta: "" },
      { label: "Periapsis", value: model.display.peri, meta: "" },
      { label: "Apoapsis", value: model.display.apo, meta: "" },
      { label: "Orbital Direction", value: model.orbit.orbitalDirection, meta: "" },
      { label: "Orbital Period (sidereal)", value: model.display.sidereal, meta: "" },
      { label: "Orbital Period (synodic)", value: model.display.synodic, meta: "" },
      { label: "Rotation Period", value: model.display.rot, meta: "" },

      // TIDES CALCULATOR
      { label: "Total Tidal Force", value: model.display.tides, meta: "" },
      { label: "Moon Contribution", value: model.display.moonPct, meta: "" },
      { label: "Star Contribution", value: model.display.starPct, meta: "" },
      { label: "Composition", value: model.display.compositionClass, meta: "" },
      {
        label: "Tidal Heating",
        value: model.display.tidalHeating,
        meta: model.display.tidalHeatingTotal,
      },
      { label: "Tidal Heating (\u00D7 Earth)", value: model.display.tidalHeatingXEarth, meta: "" },
      { label: "Orbital Recession", value: model.display.recession, meta: "" },
      { label: "Orbital Fate", value: model.display.orbitalFate, meta: "" },
      { label: "Moon locked to Planet?", value: model.display.moonLocked, meta: "" },
      { label: "Planet locked to Moon?", value: model.display.planetLockedMoon, meta: "" },
      { label: "Planet locked to Star?", value: model.display.planetLockedStar, meta: "" },
    ];

    kpisEl.innerHTML = items
      .map(
        (x) => `
      <div class="kpi-wrap">
        <div class="kpi">
          <div class="kpi__label">${x.label} ${tipIcon(TIP_LABEL[x.label] || "")}</div>
          <div class="kpi__value">${x.value}</div>
          <div class="kpi__meta">${x.meta}</div>
        </div>
      </div>
    `,
      )
      .join("");

    limitsEl.textContent =
      `Moon Zone (Inner): ${model.display.zoneInner}
` +
      `Moon Zone (Outer): ${model.display.zoneOuter}
` +
      `Lock time (Moon→Planet): ${model.display.tMoonLock}
` +
      `Lock time (Planet→Moon): ${model.display.tPlanetMoon}
` +
      `Lock time (Planet→Star): ${model.display.tPlanetStar}`;
  }

  function loadIntoInputs() {
    syncFromWorld();
    populateMoonSelect();
    populatePlanetOptions();

    nameEl.value = state.moonName;
    aEl.value = state.moon.semiMajorAxisKm;
    eEl.value = state.moon.eccentricity;
    incEl.value = state.moon.inclinationDeg;
    mEl.value = state.moon.massMoon;
    densityEl.value = state.moon.densityGcm3;
    albedoEl.value = state.moon.albedo;
    compOverrideEl.value = state.moon.compositionOverride || "";

    ["a", "e", "inc", "m", "density", "albedo"].forEach((id) => {
      wrap.querySelector(`#${id}`).dispatchEvent(new Event("input", { bubbles: true }));
    });
  }

  function applyFromInputs() {
    const w = loadWorld();
    const moonId = w.moons.selectedId;

    const newName = nameEl.value || "New Moon";
    const planetId = moonPlanetSelectEl.value || null;

    const draftInputs = collectDraftMoonInputs();
    const resolved = resolvePlanetInputs(w, planetId);
    let guardModel;
    if (resolved.type === "gasGiant") {
      const po = buildParentOverride(resolved.gasGiant);
      guardModel = calcMoon({
        starMassMsol: state.starMassMsol,
        starAgeGyr: state.starAgeGyr,
        starRadiusRsolOverride: state.starRadiusRsolOverride,
        starLuminosityLsolOverride: state.starLuminosityLsolOverride,
        starTempKOverride: state.starTempKOverride,
        starEvolutionMode: state.starEvolutionMode,
        moon: draftInputs,
        parentOverride: po,
      });
    } else {
      guardModel = calcMoon({
        starMassMsol: state.starMassMsol,
        starAgeGyr: state.starAgeGyr,
        starRadiusRsolOverride: state.starRadiusRsolOverride,
        starLuminosityLsolOverride: state.starLuminosityLsolOverride,
        starTempKOverride: state.starTempKOverride,
        starEvolutionMode: state.starEvolutionMode,
        planet: resolved.inputs,
        moon: draftInputs,
      });
    }
    const guardCode = String(guardModel?.orbit?.semiMajorAxisGuard || "none");
    const guardedSemiMajorAxisKm = Number(guardModel?.inputs?.semiMajorAxisKm);
    const rawSemiMajorAxisKm = Number(draftInputs.semiMajorAxisKm);
    const roundedGuardedSemiMajorAxisKm = Number.isFinite(guardedSemiMajorAxisKm)
      ? Math.round(guardedSemiMajorAxisKm)
      : rawSemiMajorAxisKm;
    const useAdjustedAxis = guardCode !== "none" && Number.isFinite(roundedGuardedSemiMajorAxisKm);
    const inputs = {
      ...draftInputs,
      semiMajorAxisKm: useAdjustedAxis ? roundedGuardedSemiMajorAxisKm : rawSemiMajorAxisKm,
    };

    updateMoon(moonId, { name: newName, inputs });
    assignMoonToPlanet(moonId, planetId);

    // Back-compat for any remaining consumers
    updateWorld({ moon: inputs });

    if (useAdjustedAxis && Math.abs(inputs.semiMajorAxisKm - rawSemiMajorAxisKm) > 1e-9) {
      showMoonNotice(
        `Semi-Major Axis adjusted to ${fmt(inputs.semiMajorAxisKm, 0)} km to keep this moon within the Moon Zone.`,
      );
    }

    loadIntoInputs();
    render();
  }

  wrap.querySelector("#btn-apply").addEventListener("click", applyFromInputs);

  moonSelectEl.addEventListener("change", () => {
    selectMoon(moonSelectEl.value);
    loadIntoInputs();
    render();
  });

  moonPlanetSelectEl.addEventListener("change", () => {
    const w = loadWorld();
    const mid = w.moons.selectedId;
    assignMoonToPlanet(mid, moonPlanetSelectEl.value || null);
    loadIntoInputs();
    render();
  });

  moonNewEl.addEventListener("click", (e) => {
    e.preventDefault();
    const w = loadWorld();
    const baseInputs = getSelectedMoon(w)?.inputs || w.moon;
    createMoonFromInputs(baseInputs, { name: "New Moon", planetId: w.planets.selectedId });
    loadIntoInputs();
    render();
  });

  moonDeleteEl.addEventListener("click", (e) => {
    e.preventDefault();
    const w = loadWorld();
    if (w.moons.order.length <= 1) return;
    deleteMoon(w.moons.selectedId);
    loadIntoInputs();
    render();
  });

  wrap.querySelector("#btn-default").addEventListener("click", () => {
    // Spreadsheet defaults
    state.moon = {
      name: "Luna",
      semiMajorAxisKm: 384748,
      eccentricity: 0.055,
      inclinationDeg: 5.15,
      massMoon: 1.0,
      densityGcm3: 3.34,
      albedo: 0.11,
    };
    const wNow = loadWorld();
    updateMoon(wNow.moons.selectedId, {
      name: state.moon.name || "Luna",
      inputs: state.moon,
    });
    loadIntoInputs();
    render();
  });

  // Init
  loadIntoInputs();
  render();
}

function numWithSlider(id, label, unit, hint, min, max, step, tipLabelKey) {
  const unitHtml = unit ? ` <span class="unit">${unit}</span>` : "";
  return `
  <div class="form-row">
    <div>
      <div class="label">${label}${unitHtml} ${tipIcon(TIP_LABEL[tipLabelKey] || TIP_LABEL[label] || "")}</div>
      <div class="hint">${hint}</div>
    </div>
    <div class="input-pair">
      <input id="${id}" type="number" step="${step}" aria-label="${label}" />
      <input id="${id}_slider" type="range" aria-label="${label} slider" />
      <div class="range-meta"><span id="${id}_min"></span><span id="${id}_max"></span></div>
    </div>
  </div>`;
}
