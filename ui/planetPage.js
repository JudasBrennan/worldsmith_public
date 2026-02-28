import { calcPlanetExact } from "../engine/planet.js";
import { calcStar } from "../engine/star.js";
import { calcSystem } from "../engine/system.js";
import { calcGasGiant } from "../engine/gasGiant.js";
import { fmt, relativeLuminance } from "../engine/utils.js";
import { bindNumberAndSlider } from "./bind.js";
import { attachTooltips, tipIcon } from "./tooltip.js";
import { escapeHtml } from "./uiHelpers.js";
import { styleLabel, suggestStyles, GAS_GIANT_RECIPES } from "./gasGiantStyles.js";
import { computeRockyVisualProfile, ROCKY_RECIPES } from "./rockyPlanetStyles.js";
import {
  createCelestialVisualPreviewController,
  renderCelestialRecipeBatch,
} from "./celestialVisualPreview.js";
import {
  GAS_GIANT_RADIUS_MAX_RJ,
  GAS_GIANT_RADIUS_MIN_RJ,
  GAS_GIANT_RADIUS_STEP_RJ,
  GAS_GIANT_MASS_MIN_MJUP,
  GAS_GIANT_MASS_MAX_MJUP,
  GAS_GIANT_MASS_STEP_MJUP,
  GAS_GIANT_METALLICITY_MIN,
  GAS_GIANT_METALLICITY_MAX,
  GAS_GIANT_METALLICITY_STEP,
  loadWorld,
  updateWorld,
  listPlanets,
  getSelectedPlanet,
  selectPlanet,
  createPlanetFromInputs,
  deletePlanet,
  updatePlanet,
  assignPlanetToSlot,
  listMoons,
  createMoonFromInputs,
  selectMoon,
  listSystemGasGiants,
  listSystemDebrisDisks,
  getSelectedGasGiant,
  selectGasGiant,
  selectBodyType,
  randomGasGiantRadiusRj,
  saveSystemGasGiants,
  saveWorld,
  getStarOverrides,
} from "./store.js";

/* â”€â”€ Tooltip dictionary (rocky planet + gas giant) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */

const TIP_LABEL = {
  // â”€â”€ Star context â”€â”€
  "Star (read-only)": "Read-only context from your currently selected star.",

  // â”€â”€ Body selector â”€â”€
  "Body selection":
    "Choose which body you are editing. Bodies are sorted by orbital distance. [R] = rocky planet, [G] = gas giant.",

  // â”€â”€ Rocky planet inputs â”€â”€
  "Orbital slot": "Assign this body to an available system slot. One body per slot.",
  Name: "Set the body's display name used across tabs and exports.",
  Physical: "Core physical inputs that control the planet's bulk properties.",
  Mass: "Input your planet's mass, in Earth masses, here. Earth = 1 MEarth = 5.972E24 kg\n\nTerrestrial planets should have masses between 0.1 and 10 Earth masses.\n\nHabitable Earth-like planets should have masses between 0.1 and 3.5 Earth masses.",
  CMF: "Core Mass Fraction\u2014the percentage of your planet's mass contained within its iron core.\n\nBy default, CMF is auto-derived from the host star's metallicity [Fe/H] (Schulze et al. 2021). Click the 'auto' button to reset to the star-derived value, or enter a manual value to override.\n\nMercury = ~70%\nVenus = ~32%\nEarth = ~32.5%\nMars = ~22%\nMoon = ~2%",
  WMF: "Water Mass Fraction\u2014the percentage of your planet's total mass that is water or ice.\n\nEarth's WMF is only ~0.02% (oceans + ice)\u2014water is a tiny fraction of planetary mass but pools into a thin surface layer covering 71% of the surface. Higher WMF means deeper oceans, less exposed land, and eventually no land at all.\n\nWMF inflates the planet's radius and reduces bulk density. Based on Zeng & Sasselov (2016, ApJ 819, 127) three-layer interior model.\n\nDry: < 0.01%\nShallow oceans: 0.01\u20130.1% (Earth ~0.02%)\nExtensive oceans: 0.1\u20131% (deeper, less land)\nGlobal ocean: 1\u201310% (no exposed land)\nDeep ocean: 10\u201330% (high-pressure ice at seafloor)\nIce world: > 30%",
  "Axial Tilt":
    "Input your planets axial tilt, in degrees, here. \n\nAxial tilt is a measure of how tilted a planet's rotational axis is with respect to the orbital plane. Values range from 0 to 180\u00b0. \n\nPlanets with axial tilts between 0 and 90\u00b0 spin in a prograde manner, i.e., in the same direction as their parent star.\n\nPlanets with axial tilts between 90 and 180\u00b0 spin in a retrograde manner, i.e., in the opposite direction to their parent star.\n\nPlanets with tilts exactly equal to 90\u00b0 are said to have undefined spins, they spin in neither a prograde nor a retrograde manner with respect to their parent star.\n\nThe higher the axial tilt, the more severe seasonality on your planet will be. Planets with axial tilts of 0\u00b0/180\u00b0 will not experience any seasons.\n\nHabitable earth-like planets should have axial tilts between 0 and 90\u00b0. Ideally, between 0 and 45\u00b0\n\nEarth = 23.5\u00b0",
  "Albedo (Bond)":
    "Input your planet's albedo here. Albedo is a measure of how reflective a planet is, on a scale of 0 to 1.\n\n0 = a perfect absorber, i.e, the planet absorbs 100% of the radiation it receives.\n\n1 = a perfect reflector, i.,e the planet reflects 100% of the radiation it receives.\n\nMercury = 0.068\nVenus = 0.77\nEarth = 0.306\nMoon = 0.11\nMars = 0.25",
  "Greenhouse Effect":
    "Manual dimensionless greenhouse multiplier (Manual mode only). 0 = no atmosphere. ~1.2 = Earth-equivalent. ~217 = Venus-equivalent.\n\nIn Core and Full modes this is computed from atmospheric gases automatically.",
  "Greenhouse Mode":
    "Core â€” greenhouse computed from COâ‚‚, Hâ‚‚O, and CHâ‚„ with pressure broadening.\n\nFull â€” adds Hâ‚‚, SOâ‚‚, and NHâ‚ƒ (expert gases) to the greenhouse model.\n\nManual â€” set the greenhouse effect directly via the slider.",
  "Water Vapor (H\u2082O)":
    "Average column water-vapor fraction. Earth averages ~0.4%. Treated as a user input rather than a feedback gas to avoid circular temperature dependence.\n\nHâ‚‚O is the strongest greenhouse gas by total contribution on Earth (~50% of the greenhouse effect).",
  "Methane (CH\u2084)":
    "Atmospheric methane fraction. Earth â‰ˆ 0.00018% (1.8 ppm). Titan â‰ˆ 5%.\n\nCHâ‚„ absorbs in the 7.7 Âµm IR band with square-root forcing (IPCC TAR).",
  "Hydrogen (H\u2082)":
    "Atmospheric hydrogen fraction (Full mode). Greenhouse effect via collision-induced absorption with Nâ‚‚ (Wordsworth & Pierrehumbert 2013). Important for reducing/primordial atmospheres and early-Earth scenarios.",
  "Helium (He)":
    "Atmospheric helium fraction (Full mode). No greenhouse effect â€” helium is IR-transparent. Affects mean molecular weight and scale height only.",
  "Sulfur Dioxide (SO\u2082)":
    "Atmospheric SOâ‚‚ fraction (Full mode). Strong 7.3 Âµm and 8.7 Âµm IR absorber. Relevant for volcanic worlds. Venus has ~150 ppm.",
  "Ammonia (NH\u2083)":
    "Atmospheric ammonia fraction (Full mode). Potent greenhouse gas absorbing at 10.5 Âµm (atmospheric window). Rapidly photodissociated by UV, so sustained levels require an active source.",
  "Height of Observer":
    "Input the height from which the horizon is to be observed, in metres, here.",
  "Orbit & Rotation":
    "Orbital and rotational inputs used for year length, seasons, and climate-related outputs.",
  "Rotation Period":
    "Input how fast your planet spins about it's axis, in Earth hours, here. Aka input your planet's day length.\n\nHabitable Earth-like planets should have days between about 6 and 48 hours.",
  "Semi-Major axis":
    "Input how far out from your star, in AU, your planet orbits. Earth = 1 AU = ~150,000,000 km\n\nHabitable Earth-like planets should orbit within the Habitable Zone, between Habitable Zone (Inner) and Habitable Zone (Outer).",
  Eccentricity:
    "Input your planet's orbital eccentricity here. This is a measure of how elliptical your planets orbit is. The scale goes from 0 to 1.\n\n0 = orbit is a perfect circle\n1 = orbit is a parabola\n\nHabitable Earth-like planets should have very low eccentricities to ensure that they orbit within the habitable zone at all times.\n\nEarth's orbital eccentricity = 0.0167",
  Inclination:
    "How inclined your planets orbit is respect to your primary habitable world's orbital plane.\n\nPrimary habitable world = 0\u00b0\nAll other worlds = 0 - 180\u00b0 (the lower the inclination value the better)",
  "Longitude of Periapsis":
    "Input your geocentric longitude of periapsis, in degrees, here. The range here is between 0 and 360 degrees.\n\nEarth = ~283\u00b0",
  "Subsolar Longitude":
    "Input your longitude of the subsolar point at the vernal equinox, in degrees, here. The range here is between 0 and 360 degrees.",
  Atmosphere:
    "Atmospheric composition and pressure inputs for derived climate and density outputs.\n\nNâ‚‚ is derived: 100% minus all other gases. If the sum exceeds 100%, Nâ‚‚ is clamped to 0%.",
  "Atmospheric Pressure":
    "Input your planets atmospheric pressure at sea level, in standard atmospheres, here. Earth = 1 atm",
  "Oxygen (O2)": "The partial pressure of Oxygen gas should be between 0.16 and 0.5 atm.",
  "Carbon Dioxide (CO2)":
    "The partial pressure of Carbon Dioxide gas should be less than 0.02 atm, though <0.005 atm is optimal.",
  "Argon (Ar)": "The partial pressure of Argon gas should be less than 1.6 atm.",
  "Vegetation override":
    "Override the auto-calculated vegetation colours with manually chosen pale and deep hex values. In Auto mode, colours are derived from the star's spectrum, atmospheric pressure, insolation, and tidal lock status.",
  Moons: "Major moons currently assigned to this body.",

  // â”€â”€ Rocky planet outputs â”€â”€
  Appearance:
    "Physics-driven visual of the planet from space. Surface colour, oceans, ice caps, clouds, and terrain are derived from composition, water regime, temperature, pressure, and tectonics.\n\nClick Recipes to browse preset input combinations for different planet types.",
  Composition:
    "Interior composition class derived from Core Mass Fraction (CMF) and Water Mass Fraction (WMF).\n\nIron world: CMF > 60% (Mercury-like interior)\nMercury-like: CMF 45\u201360%\nEarth-like: CMF 25\u201345%\nMars-like: CMF 10\u201325%\nCoreless: CMF < 10%\nOcean world: WMF 0.1\u201310%\nIce world: WMF > 10%",
  "Core Radius":
    "Core radius as a fraction of the total planetary radius. Estimated via CRF \u2248 CMF^0.5 (Zeng & Jacobsen 2017).\n\nEarth: CRF \u2248 0.55 (core radius ~3,485 km).",
  "Water Regime":
    "Surface water state derived from water mass fraction (WMF).\n\nDry: < 0.01% WMF\nShallow oceans: 0.01\u20130.1% WMF (Earth ~0.02%\u2014thin but widespread oceans)\nExtensive oceans: 0.1\u20131% WMF (deeper oceans, less exposed land)\nGlobal ocean: 1\u201310% WMF (no exposed land)\nDeep ocean: 10\u201330% WMF (high-pressure ice at seafloor)\nIce world: > 30% WMF",
  "Magnetic Field":
    "Estimated surface magnetic field strength relative to Earth (1.0\u00d7 = Earth's field).\n\nUses simplified Olson & Christensen (2006) dynamo scaling: field strength depends on core size, bulk density, heat flux, and core solidification state.\n\nTidal heating from assigned moons can extend core liquid lifetime, potentially sustaining a dynamo that would otherwise shut down. Shown as 'tidally sustained' when moon heating exceeds 10% of the planet's internal heat budget.\n\nA dipolar field (like Earth's) provides strong magnetospheric protection. Multipolar fields (slow rotators, P > ~96 h) are ~20\u00d7 weaker at the surface.\n\nStrong (> 0.5\u00d7): good protection from stellar wind\nModerate (0.1\u20130.5\u00d7): partial protection\nWeak (< 0.1\u00d7): minimal protection\nNone: no active dynamo",
  "Moon Tidal Heating":
    "Solid-body tidal heating on the planet from its assigned moons, expressed as a multiple of Earth's mean geothermal heat flux (0.087 W/m\u00b2).\n\nComputed using the Peale et al. (1979) formula with the planet's composition-dependent Love number (k\u2082) and tidal quality factor (Q). Only solid-body dissipation is modelled\u2014oceanic tidal heating is not included.\n\nA circular orbit (e = 0) produces zero tidal heating. Higher eccentricity and closer orbits dramatically increase heating.\n\n< 0.1\u00d7 Earth: negligible\n0.1\u20131\u00d7: comparable to Earth's internal heat\n1\u201310\u00d7: enhanced volcanism\n> 10\u00d7: extreme resurfacing (Io-like)",
  "Suggested CMF":
    "Core mass fraction predicted from the host star's metallicity [Fe/H], using solar abundance scaling (Schulze et al. 2021, PSJ 2, 113).\n\n~75% of observed rocky exoplanets have CMF consistent with their host star. This is a suggestion, not a constraint\u2014giant impacts or formation location can shift CMF significantly.",
  "Tectonic Regime":
    "The green-highlighted option is the recommended regime, computed from mass, age, water content, core fraction, and tidal heating. It is pre-selected by default and updates as you change inputs. Selecting a different option overrides the recommendation.\n\nStagnant lid: single rigid plate, no subduction (Venus, Mars)\nMobile lid: plate tectonics with subduction and recycling (Earth)\nEpisodic: periodic catastrophic overturn events\nPlutonic-squishy: intrusive volcanism without rigid plates\n\nThe science is genuinely unsettled (Valencia 2007 vs O'Neill 2007). The probability bar shows the engine's estimate.",
  "Mantle Oxidation":
    "Oxidation state of the mantle controls which gases are outgassed by volcanism (Ortenzi et al. 2020, Sci. Rep. 10, 10907).\n\nHighly reduced (\u0394IW \u2248 \u22124): H\u2082 + CO dominated\nModerately reduced (\u0394IW \u2248 \u22122): mixed H\u2082 + CO\u2082\nEarth-like (\u0394IW \u2248 +1): CO\u2082 + H\u2082O dominated\nOxidized (\u0394IW \u2248 +3): CO\u2082 + H\u2082O + SO\u2082\n\n\u0394IW = oxygen fugacity relative to the iron-w\u00fcstite buffer.",
  Outgassing:
    "Primary volcanic outgassed species, determined by mantle oxidation state. Oxidised mantles produce CO\u2082 + H\u2082O (denser atmospheres), while reduced mantles produce H\u2082 + CO (lighter, puffier atmospheres).",
  Density:
    "The average density of your planet. Earth = 5.51 g/cm\u00b3\n\nThe density of silicate rock is ~ 3 g/cm\u00b3 and the density of iron is ~ 8 g/cm\u00b3.",
  Radius:
    "The radius of your planet in Earth radii. Earth = 1 REarth = 6371 km.\n\nTerrestrial planets should have radii less than about 1.6 Earth radii.",
  Gravity:
    "The surface gravity at sea level on your planet. Earth = 1g = 9.8 m/s\u00b2\n\nHabitable Earth-like planets should surface gravities between 0.4 and 1.6 g.",
  "Escape Velocity":
    "How fast a spacecraft would need to travelling in order to escape the planet's gravitational pull. Earth = 1 VEarth = 11.2 km/s",
  "Surface Temperature (Avg.)":
    "The average surface temperature of your planet. Earth = ~287 K ( ~14\u00b0 C)",
  "Horizon Distance":
    "The distance to the horizon in km based on planet radius and observer height.",
  "Year length": "The orbital period shown in Earth days and local days.",
  "Star apparent size": "Apparent angular diameter of the star as seen from the planet.",
  "Sky colour (sun high)":
    "Estimated daytime sky colour near local noon based on stellar spectrum, surface pressure, gravity, temperature, and atmospheric composition.\n\nLower gravity or higher temperature increases the atmospheric column depth, shifting colours toward thicker-atmosphere entries. COâ‚‚-rich atmospheres receive a warm amber tint.",
  "Sky colour (low sun)":
    "Estimated sky colour near the horizon based on stellar spectrum, surface pressure, gravity, temperature, and atmospheric composition.\n\nThe same column-density and COâ‚‚ corrections apply as for the high-sun colour.",
  Details:
    "Detailed derived outputs and atmospheric composition values.\n\nIncludes a guardrail note when O2 + CO2 + Ar exceeds 100% and N2 is clamped to 0%.",
  Insolation:
    "Stellar energy received at the planet's orbit relative to Earth. Insolation = Lâ˜‰ / dÂ² where L is stellar luminosity and d is the semi-major axis in AU.\n\nEarth = 1.0Ã— by definition.",
  "Tidal lock":
    "Estimated tidal-evolution state of the planet's rotation.\n\nâ€¢ Synchronous (1:1) â€” rotation period equals orbital period (permanent day/night sides).\nâ€¢ Spin-orbit resonance (3:2, 2:1, â€¦) â€” higher-order lock driven by orbital eccentricity (Goldreich & Peale 1966). Mercury is a real 3:2 example.\nâ€¢ Atmosphere-stabilised â€” thick atmospheres generate thermal tides that counteract gravitational locking (Leconte+ 2015). Venus is the classic case.\nâ€¢ Otherwise shows the estimated time to despin (Love-number kâ‚‚ / quality-factor Q model).\n\nHigh eccentricity favours higher-order resonances; thick atmospheres resist all locking.",
  "In habitable zone":
    "Whether the planet's semi-major axis falls within the star's conservative habitable zone (liquid water on the surface). The HZ boundaries use temperature-dependent Seff polynomials.",
  "Liquid water":
    "Whether the average surface temperature and pressure allow liquid water to exist. Checks against the water phase diagram: pressure â‰¥ triple point (0.006 atm) and temperature between freezing (273 K) and the pressure-dependent boiling point.",
  "Vegetation colour":
    "Estimated plant/vegetation colour based on photosynthetic pigment adaptation to the host star's spectrum.\n\nHotter stars (F/A) â†’ plants absorb UV/blue and reflect yellow-orange.\nSun-like stars (G) â†’ green, like Earth.\nCool stars (K) â†’ dark green/teal, broader absorption.\nRed dwarfs (M) â†’ near-black, absorbing all available light.\n\nGradient shows low concentration (pale) â†’ high concentration (deep).\n\nReferences: Kiang (2007), Lehmer et al. (2021), Arp et al. (2020), PanoptesV.",
  "Vegetation colour (twilight)":
    "Plant colours adapted to the permanent twilight zone on tidally locked worlds. Only shown for K/M star planets that are tidally locked.\n\nOrganisms at the terminator receive only scattered and refracted starlight, so pigments are paler and more tan/brown.",
  "Atmospheric circulation": "Derived circulation-cell summary for the current planet.",

  // â”€â”€ Gas giant inputs â”€â”€
  "GG Slot":
    "Orbital slot from the system layout. Each slot has a fixed distance determined by the orbit spacing formula. Slots occupied by rocky planets are unavailable.",
  "Custom orbit":
    "Manual semi-major axis in AU. Use this when the gas giant does not sit neatly on one of the system\u2019s Titius\u2013Bode-style orbital slots.",
  "GG Size": `Gas giant radius in Jupiter radii (Rj). Constrained to ${GAS_GIANT_RADIUS_MIN_RJ.toFixed(2)}\u2013${GAS_GIANT_RADIUS_MAX_RJ.toFixed(2)} Rj. Radius and mass are related: larger giants are not always heavier due to electron degeneracy pressure compressing the core at high masses.`,
  "GG Mass":
    "Mass in Jupiter masses (M\u2081 = 1.898\u00d710\u00b2\u2077 kg). If blank, estimated from radius using Chen & Kipping 2017 power-law forecasting. Above ~3\u201310 Mj, deuterium fusion begins (brown dwarf regime).",
  "GG Rotation":
    "Sidereal rotation period in hours. Jupiter rotates in ~9.9 h, Saturn in ~10.7 h. Faster rotation strengthens the magnetic dynamo, increases the number of atmospheric jet streams (bands), and raises equatorial wind speeds.",
  "GG Metallicity":
    "Atmospheric heavy-element enrichment relative to solar (Z/Z\u2299). If blank, estimated from mass via Thorngren & Fortney 2019. Higher metallicity increases CH\u2084, NH\u2083, and H\u2082O cloud abundances. Jupiter is ~3* solar; Saturn ~10*; Uranus/Neptune ~50\u2013100*.",

  // â”€â”€ Gas giant outputs â”€â”€
  "GG Output Radius":
    "Equatorial radius in Jupiter radii. Due to degeneracy pressure, giant planets above ~4 Mj barely increase in radius with added mass.\n\n1 Rj = 71,492 km",
  "GG Density":
    "Mean bulk density (mass/volume). Jupiter is ~1.33 g/cm\u00b3; Saturn is less dense than water at ~0.69 g/cm\u00b3.",
  "GG Gravity":
    "Surface gravity at the 1-bar pressure level, in Earth g\u2019s and m/s\u00b2. Depends on both mass and radius: g = GM/R\u00b2.",
  "GG Equilibrium Temp":
    "Blackbody equilibrium temperature from stellar irradiation alone. Effective temperature (T_eff) adds internal heat from gravitational contraction (Kelvin\u2013Helmholtz mechanism).",
  "GG Orbital Period":
    "Time for one complete orbit, from Kepler\u2019s third law: P\u00b2 = a\u00b3/M\u2605. Orbital velocity is the mean speed along the orbit.",
  Sudarsky:
    "Temperature-based appearance classification (Sudarsky et al. 2000). Class I: ammonia clouds (<150 K). Class II: water clouds (150\u2013250 K). Class III: cloudless (250\u2013900 K). Class IV: alkali metals (900\u20131400 K). Class V: silicate/iron clouds (>1400 K).",
  "GG Derived":
    "Detailed atmospheric, thermal, magnetic, and gravitational properties computed from the input parameters and host-star luminosity.",
  "GG Oblateness":
    "Rotational flattening f = (R_eq \u2212 R_pol)/R_eq. Faster spin \u2192 more oblate. Gas giants use f/q \u2248 0.75; ice giants \u2248 0.9. Jupiter f = 0.065, Saturn f = 0.098. J\u2082 is the quadrupole gravity moment.",
  "GG Mass Loss":
    "Energy-limited atmospheric escape driven by stellar XUV radiation (Ribas et al. 2005). Hot Jupiters at <0.1 AU can lose >10\u2076 kg/s. Evaporation timescale \u226b Hubble time for most giants. Roche lobe overflow flags planets exceeding the Eggleton (1983) tidal radius.",
  "GG Interior":
    "Heavy-element budget from Thorngren et al. (2016): M_Z = 49.3 \u00d7 (M/Mj)^0.61 M\u2295. Core mass capped at 25 M\u2295 per Juno constraints. Bulk metallicity Z = M_Z / M_total.",
  "GG Suggested Radius":
    "Age-dependent radius from Fortney et al. (2007) cooling models. Young systems have inflated radii; old systems contract toward baseline. Hot Jupiters (T_eq > 1000 K) receive an extra proximity inflation of 0.1\u20130.3 Rj.",
  "GG Ring Properties":
    "Ring composition depends on equilibrium temperature: icy (<150 K), mixed (150\u2013300 K), or rocky (>300 K). Mass scaled from Saturn\u2019s rings. Optical depth classified as Dense (\u03c4 > 1), Moderate (0.1\u20131), or Tenuous (< 0.1).",
  "GG Tidal":
    "Tidal locking timescale \u221d a\u2076: hot Jupiters at <0.05 AU lock within ~1 Gyr. Circularisation timescale \u221d a^6.5. Both compared to the host star\u2019s age to determine current state.",
};

/* â”€â”€ Helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */

function clampGasGiantRadiusRj(value) {
  const raw = Number(value);
  if (!Number.isFinite(raw)) return GAS_GIANT_RADIUS_MIN_RJ;
  const clamped = Math.max(GAS_GIANT_RADIUS_MIN_RJ, Math.min(GAS_GIANT_RADIUS_MAX_RJ, raw));
  const inv = 1 / GAS_GIANT_RADIUS_STEP_RJ;
  return Math.round(clamped * inv) / inv;
}

function findNearestSlot(targetAu, orbitsAu, occupiedSlots) {
  let bestSlot = null;
  let bestDist = Infinity;
  for (let i = 0; i < orbitsAu.length; i++) {
    const slot = i + 1;
    if (occupiedSlots.has(slot)) continue;
    const dist = Math.abs(orbitsAu[i] - targetAu);
    if (dist < bestDist) {
      bestDist = dist;
      bestSlot = slot;
    }
  }
  return bestSlot;
}

function numWithSlider(id, label, unit, hint, min, max, step, tipKey) {
  const unitHtml = unit ? ` <span class="unit">${unit}</span>` : "";
  const hintHtml = hint ? `<div class="hint">${hint}</div>` : "";
  return `
  <div class="form-row">
    <div>
      <div class="label">${label}${unitHtml} ${tipIcon(TIP_LABEL[tipKey] || TIP_LABEL[label] || "")}</div>
      ${hintHtml}
    </div>
    <div class="input-pair">
      <input id="${id}" type="number" step="${step}" aria-label="${label}" />
      <input id="${id}_slider" type="range" aria-label="${label} slider" />
      <div class="range-meta"><span id="${id}_min">${min}</span><span id="${id}_max">${max}</span></div>
    </div>
  </div>`;
}

/* â”€â”€ Page â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */

export function initPlanetPage(mountEl) {
  // CMF auto-mode state (shared between selection handler and renderRockyOutputs)
  let cmfAutoBtn = null;
  let cmfEl = null;
  let cmfSliderEl = null;
  let cmfIsAuto = true;
  function updateCmfAutoState() {
    if (cmfAutoBtn) cmfAutoBtn.classList.toggle("active", cmfIsAuto);
    if (cmfEl) cmfEl.classList.toggle("auto-value", cmfIsAuto);
  }

  // Tectonic regime state (shared between selection handler and renderRockyOutputs)
  let tecPillsEl = null;
  function getTecPillValue() {
    if (!tecPillsEl) return null;
    const checked = tecPillsEl.querySelector('input[name="tecRegime"]:checked');
    return checked ? checked.value : null;
  }
  function setTecPillValue(val) {
    if (!tecPillsEl) return;
    const radio = tecPillsEl.querySelector(`input[name="tecRegime"][value="${val}"]`);
    if (radio) radio.checked = true;
  }
  function updateTecRecommended(recVal) {
    if (!tecPillsEl) return;
    tecPillsEl.querySelectorAll('input[name="tecRegime"]').forEach((r) => {
      r.toggleAttribute("data-recommended", r.value === recVal);
    });
    tecPillsEl.classList.toggle("tec-recommended-active", getTecPillValue() === recVal);
  }

  const celestialPreviewController = createCelestialVisualPreviewController({
    speedDaysPerSec: 0.5,
  });

  const wrap = document.createElement("div");
  wrap.className = "page";
  wrap.innerHTML = `
    <div class="panel">
      <div class="panel__header">
        <h1 class="panel__title"><span class="ws-icon icon--inner-planets" aria-hidden="true"></span><span>Planets</span></h1>
        <div class="badge">Interactive tool</div>
      </div>
      <div class="panel__body">
        <div class="hint">Create and configure rocky planets and gas giants, then assign each to a system slot for placement and visualisation.</div>
      </div>
    </div>

    <div class="grid-2">
      <div class="panel">
        <div class="panel__header"><h2>Inputs</h2></div>
        <div class="panel__body">
          <div class="label">Derived Data ${tipIcon(TIP_LABEL["Star (read-only)"])}</div>
          <div class="derived-readout" id="starInfo"></div>
          <div style="height:12px"></div>

          <div class="label">Body selection ${tipIcon(TIP_LABEL["Body selection"])}</div>
          <div class="form-row">
            <div>
              <div class="hint">Select a body to edit, or create a new one.</div>
            </div>
            <div class="select-stack">
              <select id="bodySelect"></select>
              <div class="select-actions">
                <button id="newRockyPlanet" class="small" type="button">New rocky planet</button>
                <button id="newGasGiant" class="small" type="button">New gas giant</button>
                <button id="deleteBody" class="small danger" type="button">Delete</button>
              </div>
            </div>
          </div>

          <div id="bodyInputs"></div>
          <div id="bodyMoons" style="margin-top:14px"></div>
          <div id="bodyActions" style="margin-top:10px"></div>
        </div>
      </div>

      <div class="panel">
        <div class="panel__header"><h2>Outputs</h2></div>
        <div class="panel__body" id="bodyOutputs"></div>
      </div>
    </div>
  `;
  mountEl.appendChild(wrap);

  const previewCleanupObserver = new MutationObserver(() => {
    if (wrap.isConnected) return;
    celestialPreviewController.dispose();
    previewCleanupObserver.disconnect();
  });
  previewCleanupObserver.observe(document.body, { childList: true, subtree: true });

  const starInfoEl = wrap.querySelector("#starInfo");
  const bodySel = wrap.querySelector("#bodySelect");
  const bodyInputsEl = wrap.querySelector("#bodyInputs");
  const bodyMoonsEl = wrap.querySelector("#bodyMoons");
  const bodyActionsEl = wrap.querySelector("#bodyActions");
  const bodyOutputsEl = wrap.querySelector("#bodyOutputs");

  let isRendering = false;
  let renderQueued = false;
  let pendingOutputsOnly = true;

  function scheduleRender(outputsOnly = false) {
    if (!outputsOnly) pendingOutputsOnly = false;
    if (renderQueued) return;
    renderQueued = true;
    setTimeout(() => {
      renderQueued = false;
      const oo = pendingOutputsOnly;
      pendingOutputsOnly = true;
      render(oo);
    }, 0);
  }

  /* â”€â”€ Body selector â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */

  function populateBodySelector(world) {
    const planets = listPlanets(world);
    const gasGiants = listSystemGasGiants(world);
    const bodyType = world.selectedBodyType || "planet";

    // Build entries with AU for sorting
    const entries = [];
    for (const p of planets) {
      const au = Number(p.inputs?.semiMajorAxisAu) || 0;
      entries.push({
        type: "planet",
        id: p.id,
        name: p.name || p.inputs?.name || p.id,
        au,
        value: `planet:${p.id}`,
      });
    }
    for (const g of gasGiants) {
      entries.push({
        type: "gasGiant",
        id: g.id,
        name: g.name || g.id,
        au: Number(g.au) || 0,
        value: `gasGiant:${g.id}`,
      });
    }
    entries.sort((a, b) => a.au - b.au);

    const selectedId =
      bodyType === "gasGiant" ? world.system?.gasGiants?.selectedId : world.planets?.selectedId;
    const selectedValue =
      bodyType === "gasGiant" ? `gasGiant:${selectedId}` : `planet:${selectedId}`;

    bodySel.innerHTML = entries
      .map(
        (e) =>
          `<option value="${escapeHtml(e.value)}"${e.value === selectedValue ? " selected" : ""}>[${e.type === "planet" ? "R" : "G"}] ${escapeHtml(e.name)} (${fmt(e.au, 3)} AU)</option>`,
      )
      .join("");
  }

  /* â”€â”€ Rocky planet rendering â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */

  function renderRockyInputs(world, planet, sysModel) {
    if (!planet) {
      bodyInputsEl.innerHTML =
        '<div class="hint">No planet selected. Add a planet to get started.</div>';
      return;
    }
    const p = planet.inputs || {};

    bodyInputsEl.innerHTML = `
      <div class="form-row" style="margin-top:8px">
        <div>
          <div class="label">Orbital slot ${tipIcon(TIP_LABEL["Orbital slot"])}</div>
          <div class="hint">One body per slot.</div>
        </div>
        <select id="slotSelect"></select>
      </div>

      <div style="height:10px"></div>
      <div class="form-row">
        <div>
          <div class="label">Name ${tipIcon(TIP_LABEL["Name"])}</div>
          <div class="hint">Used in exports and print view.</div>
        </div>
        <input id="planetName" type="text" value="${escapeHtml(planet.name || "New Planet")}" />
      </div>

      <div style="height:8px"></div>
      <div class="label">Physical ${tipIcon(TIP_LABEL["Physical"])}</div>
      ${numWithSlider("mass", "Mass", "MEarth", "", 0.01, 1000, 0.01, "Mass")}
      <div class="form-row">
        <div>
          <div class="label">CMF <span class="unit">%</span> ${tipIcon(TIP_LABEL["CMF"])}
            <button id="cmfAutoBtn" class="auto-btn" title="Reset to star-derived CMF">auto</button>
          </div>
        </div>
        <div class="input-pair">
          <input id="cmf" type="number" step="0.1" aria-label="CMF" />
          <input id="cmf_slider" type="range" aria-label="CMF slider" />
          <div class="range-meta"><span id="cmf_min">0</span><span id="cmf_max">100</span></div>
        </div>
      </div>
      ${numWithSlider("wmf", "WMF", "%", "", 0, 50, 0.1, "WMF")}
      ${numWithSlider("tilt", "Axial Tilt", "\u00b0", "", 0, 180, 0.1, "Axial Tilt")}
      ${numWithSlider("albedo", "Albedo (Bond)", "", "", 0, 0.95, 0.01, "Albedo (Bond)")}
      ${numWithSlider("observer", "Height of Observer", "m", "", 0, 10000, 0.05, "Height of Observer")}

      <div style="height:8px"></div>
      <div class="label">Orbit & Rotation ${tipIcon(TIP_LABEL["Orbit & Rotation"])}</div>
      ${numWithSlider("rot", "Rotation Period", "Earth hrs", "", 0.1, 1000000, 0.1, "Rotation Period")}
      ${numWithSlider("a", "Semi-Major axis", "AU", "", 0.01, 1000000, 0.01, "Semi-Major axis")}
      ${numWithSlider("e", "Eccentricity", "", "", 0, 0.99, 0.001, "Eccentricity")}
      ${numWithSlider("inc", "Inclination", "\u00b0", "", 0, 180, 0.1, "Inclination")}
      ${numWithSlider("lop", "Longitude of Periapsis", "\u00b0", "", 0, 360, 1, "Longitude of Periapsis")}
      ${numWithSlider("ssl", "Subsolar Longitude", "\u00b0", "", 0, 360, 1, "Subsolar Longitude")}

      <div style="height:8px"></div>
      <div class="label">Atmosphere ${tipIcon(TIP_LABEL["Atmosphere"])}</div>
      ${numWithSlider("patm", "Atmospheric Pressure", "atm", "", 0, 100, 0.01, "Atmospheric Pressure")}

      <div class="label" style="margin:8px 0 6px">Greenhouse Mode ${tipIcon(TIP_LABEL["Greenhouse Mode"])}</div>
      <div class="physics-trio-toggle">
        <input type="radio" name="ghMode" id="ghModeCore" value="core" ${p.greenhouseMode !== "full" && p.greenhouseMode !== "manual" ? "checked" : ""} />
        <label for="ghModeCore">Core</label>
        <input type="radio" name="ghMode" id="ghModeFull" value="full" ${p.greenhouseMode === "full" ? "checked" : ""} />
        <label for="ghModeFull">Full</label>
        <input type="radio" name="ghMode" id="ghModeManual" value="manual" ${p.greenhouseMode === "manual" ? "checked" : ""} />
        <label for="ghModeManual">Manual</label>
        <span></span>
      </div>
      <div class="hint" style="margin-top:5px" id="ghModeHint"></div>

      <div id="ghManualRow" ${p.greenhouseMode === "manual" ? "" : 'style="display:none"'}>
        ${numWithSlider("gh", "Greenhouse Effect", "", "", 0, 500, 0.1, "Greenhouse Effect")}
      </div>
      <div id="ghComputedRow" class="hint" ${p.greenhouseMode === "manual" ? 'style="display:none"' : ""}>
        Computed greenhouse effect: <b id="ghComputedValue">\u2014</b>
      </div>

      ${numWithSlider("o2", "Oxygen (O2)", "%", "", 0, 100, 0.01, "Oxygen (O2)")}
      ${numWithSlider("co2", "Carbon Dioxide (CO2)", "%", "", 0, 100, 0.01, "Carbon Dioxide (CO2)")}
      ${numWithSlider("ar", "Argon (Ar)", "%", "", 0, 100, 0.01, "Argon (Ar)")}
      ${numWithSlider("h2o", "Water Vapor (H\u2082O)", "%", "", 0, 5, 0.01, "Water Vapor (H\u2082O)")}
      ${numWithSlider("ch4", "Methane (CH\u2084)", "%", "", 0, 10, 0.001, "Methane (CH\u2084)")}

      <div id="expertGasRow" ${p.greenhouseMode === "full" ? "" : 'style="display:none"'}>
        ${numWithSlider("h2", "Hydrogen (H\u2082)", "%", "", 0, 50, 0.1, "Hydrogen (H\u2082)")}
        ${numWithSlider("he", "Helium (He)", "%", "", 0, 50, 0.1, "Helium (He)")}
        ${numWithSlider("so2", "Sulfur Dioxide (SO\u2082)", "%", "", 0, 1, 0.001, "Sulfur Dioxide (SO\u2082)")}
        ${numWithSlider("nh3", "Ammonia (NH\u2083)", "%", "", 0, 1, 0.001, "Ammonia (NH\u2083)")}
      </div>

      <div style="height:8px"></div>
      <div class="label">Vegetation ${tipIcon(TIP_LABEL["Vegetation override"])}</div>
      <div class="viz-switch" style="margin:4px 0 6px">
        <div class="viz-switch__text">Colour mode</div>
        <label class="viz-switch__control" for="vegOverride">
          <input type="checkbox" id="vegOverride" ${p.vegOverride ? "checked" : ""} />
          <span class="viz-switch__slider" aria-hidden="true"></span>
        </label>
        <span class="viz-switch__mode-label">${p.vegOverride ? "Manual" : "Auto"}</span>
      </div>
      <div id="vegManualInputs" class="veg-manual-inputs" ${p.vegOverride ? "" : 'style="display:none"'}>
        <div class="form-row">
          <span>Pale (low concentration)</span>
          <input type="color" id="vegPaleColour" value="${p.vegPaleHexOverride || "#4a7c32"}" />
        </div>
        <div class="form-row">
          <span>Deep (high concentration)</span>
          <input type="color" id="vegDeepColour" value="${p.vegDeepHexOverride || "#1a3d0c"}" />
        </div>
        <div class="veg-override-preview" id="vegOverridePreview"
          style="background:linear-gradient(to right, ${p.vegPaleHexOverride || "#4a7c32"}, ${p.vegDeepHexOverride || "#1a3d0c"})"></div>
      </div>

      <div style="height:8px"></div>
      <div class="label">Tectonic Regime ${tipIcon(TIP_LABEL["Tectonic Regime"])}</div>
      <div class="physics-quad-toggle" id="tectonicRegimePills">
        <input type="radio" name="tecRegime" id="tecStagnant" value="stagnant" ${p.tectonicRegime === "stagnant" ? "checked" : ""} />
        <label for="tecStagnant">Stagnant</label>
        <input type="radio" name="tecRegime" id="tecMobile" value="mobile" ${!p.tectonicRegime || p.tectonicRegime === "auto" || p.tectonicRegime === "mobile" ? "checked" : ""} />
        <label for="tecMobile">Mobile</label>
        <input type="radio" name="tecRegime" id="tecEpisodic" value="episodic" ${p.tectonicRegime === "episodic" ? "checked" : ""} />
        <label for="tecEpisodic">Episodic</label>
        <input type="radio" name="tecRegime" id="tecPlutonic" value="plutonic-squishy" ${p.tectonicRegime === "plutonic-squishy" ? "checked" : ""} />
        <label for="tecPlutonic">Plutonic</label>
        <span></span>
      </div>
      <div class="tec-prob-bar" id="tecProbBar"></div>
      <div class="form-row">
        <div><div class="label">Mantle Oxidation ${tipIcon(TIP_LABEL["Mantle Oxidation"])}</div></div>
        <select id="mantleOxidation">
          <option value="highly-reduced" ${p.mantleOxidation === "highly-reduced" ? "selected" : ""}>Highly reduced (H\u2082+CO)</option>
          <option value="reduced" ${p.mantleOxidation === "reduced" ? "selected" : ""}>Moderately reduced</option>
          <option value="earth" ${p.mantleOxidation === "earth" ? "selected" : ""}>Earth-like (CO\u2082+H\u2082O)</option>
          <option value="oxidized" ${p.mantleOxidation === "oxidized" ? "selected" : ""}>Oxidized (CO\u2082+H\u2082O+SO\u2082)</option>
        </select>
      </div>
    `;

    // Populate slot selector
    const slotSelectEl = bodyInputsEl.querySelector("#slotSelect");
    const planets = listPlanets(world);
    const gasGiants = listSystemGasGiants(world);
    const assigned = new Map(planets.map((pp) => [pp.slotIndex, pp]));
    const gasBySlot = new Map();
    const usedSlots = new Set();
    for (const giant of gasGiants) {
      let bestSlot = null;
      let bestDiff = Infinity;
      for (let i = 0; i < sysModel.orbitsAu.length; i++) {
        const slot = i + 1;
        if (usedSlots.has(slot)) continue;
        const d = Math.abs(sysModel.orbitsAu[i] - Number(giant.au));
        if (d < bestDiff) {
          bestDiff = d;
          bestSlot = slot;
        }
      }
      if (bestSlot != null) {
        gasBySlot.set(bestSlot, giant);
        usedSlots.add(bestSlot);
      }
    }
    const debrisDisks = listSystemDebrisDisks(world);
    const maxGasAu = gasGiants.length ? Math.max(...gasGiants.map((g) => Number(g.au) || 0)) : 0;
    const maxDebrisAu = debrisDisks.length
      ? Math.max(
          ...debrisDisks.map((d) => Math.max(Number(d.innerAu) || 0, Number(d.outerAu) || 0)),
        )
      : 0;
    const cutoffAu = Math.max(maxGasAu, maxDebrisAu, 0);
    const visible = sysModel.orbitsAu
      .map((au, idx) => ({ au, idx }))
      .filter((o) => cutoffAu <= 0 || o.au <= cutoffAu);

    slotSelectEl.innerHTML = [`<option value="">Unassigned</option>`]
      .concat(
        visible.map(({ au, idx }) => {
          const slot = idx + 1;
          const holder = assigned.get(slot);
          const giant = gasBySlot.get(slot);
          const isGas = Boolean(giant);
          const taken = holder && holder.id !== planet.id;
          const suffix = holder
            ? ` - ${escapeHtml(holder.name || holder.inputs?.name || holder.id)}`
            : "";
          const disabled = taken || isGas;
          const gasSuffix = isGas ? ` - ${escapeHtml(giant.name || "Gas giant")}` : "";
          return `<option value="${slot}" ${disabled ? "disabled" : ""}>Slot ${String(slot).padStart(2, "0")} (${fmt(au, 3)} AU)${suffix}${gasSuffix}</option>`;
        }),
      )
      .join("");
    const selSlot = planet.slotIndex ? String(planet.slotIndex) : "";
    slotSelectEl.value =
      selSlot && slotSelectEl.querySelector(`option[value="${selSlot}"]`) ? selSlot : "";

    // Set input values
    let hydrating = true;
    cmfAutoBtn = bodyInputsEl.querySelector("#cmfAutoBtn");
    cmfEl = bodyInputsEl.querySelector("#cmf");
    cmfSliderEl = bodyInputsEl.querySelector("#cmf_slider");
    cmfIsAuto = p.cmfPct < 0 || p.cmfPct == null;

    const fieldMap = {
      mass: p.massEarth,
      wmf: p.wmfPct,
      tilt: p.axialTiltDeg,
      albedo: p.albedoBond,
      gh: p.greenhouseEffect,
      observer: p.observerHeightM,
      rot: p.rotationPeriodHours,
      a: p.semiMajorAxisAu,
      e: p.eccentricity,
      inc: p.inclinationDeg,
      lop: p.longitudeOfPeriapsisDeg,
      ssl: p.subsolarLongitudeDeg,
      patm: p.pressureAtm,
      o2: p.o2Pct,
      co2: p.co2Pct,
      ar: p.arPct,
      h2o: p.h2oPct,
      ch4: p.ch4Pct,
      h2: p.h2Pct,
      he: p.hePct,
      so2: p.so2Pct,
      nh3: p.nh3Pct,
    };
    const sliderBindings = {
      mass: [0.01, 1000, 0.01],
      wmf: [0, 50, 0.1],
      tilt: [0, 180, 0.1],
      albedo: [0, 0.95, 0.01],
      gh: [0, 500, 0.1],
      observer: [0, 10000, 0.05],
      rot: [0.1, 1000000, 0.1],
      a: [0.01, 1000000, 0.01],
      e: [0, 0.99, 0.001],
      inc: [0, 180, 0.1],
      lop: [0, 360, 1],
      ssl: [0, 360, 1],
      patm: [0, 100, 0.01],
      o2: [0, 100, 0.01],
      co2: [0, 100, 0.01],
      ar: [0, 100, 0.01],
      h2o: [0, 5, 0.01],
      ch4: [0, 10, 0.001],
      h2: [0, 50, 0.1],
      he: [0, 50, 0.1],
      so2: [0, 1, 0.001],
      nh3: [0, 1, 0.001],
    };
    const inputKeyMap = {
      mass: "massEarth",
      wmf: "wmfPct",
      tilt: "axialTiltDeg",
      albedo: "albedoBond",
      gh: "greenhouseEffect",
      observer: "observerHeightM",
      rot: "rotationPeriodHours",
      a: "semiMajorAxisAu",
      e: "eccentricity",
      inc: "inclinationDeg",
      lop: "longitudeOfPeriapsisDeg",
      ssl: "subsolarLongitudeDeg",
      patm: "pressureAtm",
      o2: "o2Pct",
      co2: "co2Pct",
      ar: "arPct",
      h2o: "h2oPct",
      ch4: "ch4Pct",
      h2: "h2Pct",
      he: "hePct",
      so2: "so2Pct",
      nh3: "nh3Pct",
    };

    for (const [id, val] of Object.entries(fieldMap)) {
      const el = bodyInputsEl.querySelector(`#${id}`);
      if (el) el.value = val ?? "";
      const [min, max, step] = sliderBindings[id];
      const sliderEl = bodyInputsEl.querySelector(`#${id}_slider`);
      if (el && sliderEl) {
        bindNumberAndSlider({
          numberEl: el,
          sliderEl,
          min,
          max,
          step,
          mode: "auto",
          onChange: () => {
            if (hydrating) return;
            const w = loadWorld();
            const pid = w.planets.selectedId;
            const inputKey = inputKeyMap[id];
            updatePlanet(pid, { inputs: { [inputKey]: Number(el.value) } });
            updateWorld({ planet: { [inputKey]: Number(el.value) } });
            scheduleRender(true);
          },
        });
        el.dispatchEvent(new Event("input", { bubbles: true }));
      }
    }

    // CMF input (special: supports auto mode via cmfPct = -1)
    // Initial value: if auto, show 32 as placeholder (renderRockyOutputs will update)
    if (cmfIsAuto) {
      cmfEl.value = 32;
    } else {
      cmfEl.value = p.cmfPct ?? 32;
    }
    bindNumberAndSlider({
      numberEl: cmfEl,
      sliderEl: cmfSliderEl,
      min: 0,
      max: 100,
      step: 0.1,
      mode: "auto",
      onChange: () => {
        if (hydrating) return;
        cmfIsAuto = false;
        updateCmfAutoState();
        const w = loadWorld();
        const pid = w.planets.selectedId;
        updatePlanet(pid, { inputs: { cmfPct: Number(cmfEl.value) } });
        updateWorld({ planet: { cmfPct: Number(cmfEl.value) } });
        scheduleRender(true);
      },
    });
    cmfEl.dispatchEvent(new Event("input", { bubbles: true }));
    updateCmfAutoState();

    cmfAutoBtn.addEventListener("click", () => {
      cmfIsAuto = true;
      updateCmfAutoState();
      const w = loadWorld();
      const pid = w.planets.selectedId;
      updatePlanet(pid, { inputs: { cmfPct: -1 } });
      updateWorld({ planet: { cmfPct: -1 } });
      scheduleRender(true);
    });

    // Name change
    bodyInputsEl.querySelector("#planetName").addEventListener("change", () => {
      if (hydrating) return;
      const w = loadWorld();
      const name = bodyInputsEl.querySelector("#planetName").value || "New Planet";
      updatePlanet(w.planets.selectedId, { name, inputs: { name } });
      updateWorld({ planet: { name } });
      scheduleRender();
    });

    // Slot change
    slotSelectEl.addEventListener("change", () => {
      if (hydrating) return;
      const w = loadWorld();
      assignPlanetToSlot(
        w.planets.selectedId,
        slotSelectEl.value ? Number(slotSelectEl.value) : null,
      );
      scheduleRender();
    });

    // Vegetation override toggle + colour pickers
    const vegToggle = bodyInputsEl.querySelector("#vegOverride");
    const vegManual = bodyInputsEl.querySelector("#vegManualInputs");
    const vegModeLabel = bodyInputsEl.querySelector(".viz-switch__mode-label");
    const vegPaleEl = bodyInputsEl.querySelector("#vegPaleColour");
    const vegDeepEl = bodyInputsEl.querySelector("#vegDeepColour");
    const vegPreview = bodyInputsEl.querySelector("#vegOverridePreview");

    const updateVegPreview = () => {
      if (vegPreview) {
        vegPreview.style.background = `linear-gradient(to right, ${vegPaleEl.value}, ${vegDeepEl.value})`;
      }
    };

    vegToggle.addEventListener("change", () => {
      if (hydrating) return;
      const on = vegToggle.checked;
      vegManual.style.display = on ? "" : "none";
      if (vegModeLabel) vegModeLabel.textContent = on ? "Manual" : "Auto";
      const w = loadWorld();
      const pid = w.planets.selectedId;
      if (on) {
        // Default override colours to current auto-calculated values
        const selPlanet = getSelectedPlanet(w);
        const sov = getStarOverrides(w.star);
        const m = calcPlanetExact({
          starMassMsol: Number(w.star.massMsol),
          starAgeGyr: Number(w.star.ageGyr),
          starRadiusRsolOverride: sov.r,
          starLuminosityLsolOverride: sov.l,
          starTempKOverride: sov.t,
          starEvolutionMode: sov.ev,
          planet: { ...selPlanet.inputs, vegOverride: false },
          moons: listMoons(w)
            .filter((mm) => mm.planetId === selPlanet.id)
            .map((mm) => mm.inputs),
        });
        const pale = m.derived.vegetationPaleHex || "#4a7c32";
        const deep = m.derived.vegetationDeepHex || "#1a3d0c";
        vegPaleEl.value = pale;
        vegDeepEl.value = deep;
        updatePlanet(pid, {
          inputs: { vegOverride: true, vegPaleHexOverride: pale, vegDeepHexOverride: deep },
        });
        updateWorld({
          planet: { vegOverride: true, vegPaleHexOverride: pale, vegDeepHexOverride: deep },
        });
      } else {
        updatePlanet(pid, {
          inputs: { vegOverride: false, vegPaleHexOverride: null, vegDeepHexOverride: null },
        });
        updateWorld({
          planet: { vegOverride: false, vegPaleHexOverride: null, vegDeepHexOverride: null },
        });
      }
      updateVegPreview();
      scheduleRender(true);
    });

    vegPaleEl.addEventListener("input", () => {
      if (hydrating) return;
      const w = loadWorld();
      updatePlanet(w.planets.selectedId, { inputs: { vegPaleHexOverride: vegPaleEl.value } });
      updateWorld({ planet: { vegPaleHexOverride: vegPaleEl.value } });
      updateVegPreview();
      scheduleRender(true);
    });

    vegDeepEl.addEventListener("input", () => {
      if (hydrating) return;
      const w = loadWorld();
      updatePlanet(w.planets.selectedId, { inputs: { vegDeepHexOverride: vegDeepEl.value } });
      updateWorld({ planet: { vegDeepHexOverride: vegDeepEl.value } });
      updateVegPreview();
      scheduleRender(true);
    });

    // Greenhouse mode toggle
    const ghHintTexts = {
      core: "Greenhouse computed from CO\u2082, H\u2082O, and CH\u2084.",
      full: "Greenhouse computed from all atmospheric gases.",
      manual: "Greenhouse set manually via the slider below.",
    };
    const ghHintEl = bodyInputsEl.querySelector("#ghModeHint");
    const ghManualRow = bodyInputsEl.querySelector("#ghManualRow");
    const ghComputedRow = bodyInputsEl.querySelector("#ghComputedRow");
    const expertGasRow = bodyInputsEl.querySelector("#expertGasRow");
    const curMode = p.greenhouseMode || "core";
    if (ghHintEl) ghHintEl.textContent = ghHintTexts[curMode] || "";

    bodyInputsEl.querySelectorAll('input[name="ghMode"]').forEach((radio) => {
      radio.addEventListener("change", () => {
        if (hydrating) return;
        const mode = radio.value;
        const w = loadWorld();
        const pid = w.planets.selectedId;
        updatePlanet(pid, { inputs: { greenhouseMode: mode } });
        updateWorld({ planet: { greenhouseMode: mode } });
        if (ghHintEl) ghHintEl.textContent = ghHintTexts[mode] || "";
        if (ghManualRow) ghManualRow.style.display = mode === "manual" ? "" : "none";
        if (ghComputedRow) ghComputedRow.style.display = mode === "manual" ? "none" : "";
        if (expertGasRow) expertGasRow.style.display = mode === "full" ? "" : "none";
        scheduleRender(true);
      });
    });

    // Interior & Surface pill toggles
    tecPillsEl = bodyInputsEl.querySelector("#tectonicRegimePills");
    if (tecPillsEl) {
      tecPillsEl.addEventListener("change", () => {
        if (hydrating) return;
        const val = getTecPillValue();
        const w = loadWorld();
        const pid = w.planets.selectedId;
        updatePlanet(pid, { inputs: { tectonicRegime: val } });
        updateWorld({ planet: { tectonicRegime: val } });
        // Update recommended-active class for slider colour
        const rec = tecPillsEl.querySelector("input[data-recommended]");
        tecPillsEl.classList.toggle("tec-recommended-active", rec && rec.value === val);
        scheduleRender(true);
      });
    }

    const mantleOxEl = bodyInputsEl.querySelector("#mantleOxidation");
    if (mantleOxEl) {
      mantleOxEl.addEventListener("change", () => {
        if (hydrating) return;
        const w = loadWorld();
        const pid = w.planets.selectedId;
        updatePlanet(pid, { inputs: { mantleOxidation: mantleOxEl.value } });
        updateWorld({ planet: { mantleOxidation: mantleOxEl.value } });
        scheduleRender(true);
      });
    }

    hydrating = false;
  }

  function renderRockyOutputs(world) {
    const planet = getSelectedPlanet(world);
    if (!planet) {
      bodyOutputsEl.innerHTML = '<div class="hint">No planet selected.</div>';
      return;
    }
    const assignedMoons = listMoons(world)
      .filter((m) => m.planetId === planet.id)
      .map((m) => m.inputs);
    const sov = getStarOverrides(world.star);
    const model = calcPlanetExact({
      starMassMsol: Number(world.star.massMsol),
      starAgeGyr: Number(world.star.ageGyr),
      starRadiusRsolOverride: sov.r,
      starLuminosityLsolOverride: sov.l,
      starTempKOverride: sov.t,
      starEvolutionMode: sov.ev,
      planet: planet.inputs,
      moons: assignedMoons,
    });
    const d = model.derived;
    const p = planet.inputs || {};
    const visualProfile = computeRockyVisualProfile(d, p);

    // Update CMF input when in auto mode
    if (d.cmfIsAuto && cmfEl) {
      cmfIsAuto = true;
      const resolved = model.inputs.cmfPct;
      cmfEl.value = Math.round(resolved * 10) / 10;
      cmfSliderEl.value = resolved;
      updateCmfAutoState();
    }

    const items = [
      {
        label: "Appearance",
        value: d.compositionClass,
        meta: d.waterRegime,
        isRockyPreview: true,
      },
      {
        label: "Composition",
        value: model.display.compositionClass,
        meta: `CMF ${fmt(model.inputs.cmfPct, 1)}%${d.cmfIsAuto ? " (auto)" : ""}, WMF ${fmt(model.inputs.wmfPct, 2)}%`,
      },
      {
        label: "Core Radius",
        value: model.display.coreRadius,
      },
      {
        label: "Water Regime",
        value: model.display.waterRegime,
        meta: `~${fmt(model.inputs.wmfPct, 2)}% water by mass`,
      },
      {
        label: "Magnetic Field",
        value: model.display.magneticField,
        meta: d.dynamoActive
          ? `${model.display.fieldMorphology}, ${d.coreState}` +
            (d.planetTidalFraction > 0.1 ? " (tidally sustained)" : "")
          : d.dynamoReason,
      },
      model.display.moonTidalHeating && {
        label: "Moon Tidal Heating",
        value: model.display.moonTidalHeating,
        meta: d.planetTidalFraction >= 0.1 ? "Significant for core/dynamo" : "Negligible for core",
      },
      {
        label: "Tectonic Regime",
        value: model.display.tectonicRegime + (model.display.tectonicIsAuto ? " (auto)" : ""),
        meta:
          d.tectonicAdvisory +
          "\n\n" +
          ["stagnant", "mobile", "episodic", "plutonicSquishy"]
            .map(
              (r) =>
                `${r === "plutonicSquishy" ? "Plut.-squishy" : r.charAt(0).toUpperCase() + r.slice(1)}: ${Math.round(d.tectonicProbabilities[r] * 100)}%`,
            )
            .join(" | "),
      },
      {
        label: "Outgassing",
        value: model.display.outgassing,
        meta: d.mantleOxidation + " oxidation state",
      },
      {
        label: "Suggested CMF",
        value: model.display.suggestedCmf + (d.cmfIsAuto ? " (active)" : ""),
        meta: model.display.suggestedCmfNote,
      },
      { label: "Density", value: model.display.density },
      { label: "Radius", value: model.display.radius },
      { label: "Gravity", value: model.display.gravity },
      { label: "Escape Velocity", value: model.display.escape },
      {
        label: "Avg Surface Temp",
        tipLabel: "Surface Temperature (Avg.)",
        value: model.display.tempK,
        meta: model.display.tempC,
      },
      { label: "Horizon Distance", value: model.display.horizon },
      {
        label: "Year Length",
        tipLabel: "Year length",
        value: model.display.yearDays,
        meta: model.display.localDays,
      },
      {
        label: "Star Apparent Size",
        tipLabel: "Star apparent size",
        value: model.display.apparentStar,
      },
      {
        label: "Sky Colour (Sun High)",
        tipLabel: "Sky colour (sun high)",
        value: d.skyColourDayHex || "-",
        meta: "Hex (spectrum + pressure + gravity + COâ‚‚)",
        kpiClass: "kpi--colour",
        kpiAttrs: `data-gradient="radial" data-light="${relativeLuminance(d.skyColourDayHex) > 0.18 ? 1 : 0}"`,
        kpiStyle: `--kpi-colour: ${d.skyColourDayHex || "#93B6FF"}; --kpi-colour-center: ${d.skyColourDayHex || "#93B6FF"}; --kpi-colour-edge: ${d.skyColourDayEdgeHex || d.skyColourDayHex || "#CFE8FF"};`,
      },
      {
        label: "Sky Colour (Low Sun)",
        tipLabel: "Sky colour (low sun)",
        value: d.skyColourHorizonHex || "-",
        meta: "Hex (spectrum + pressure + gravity + COâ‚‚)",
        kpiClass: "kpi--colour",
        kpiAttrs: `data-gradient="radial" data-horizon="1" data-light="${relativeLuminance(d.skyColourHorizonHex) > 0.18 ? 1 : 0}"`,
        kpiStyle: `--kpi-colour: ${d.skyColourHorizonHex || "#0B1020"}; --kpi-colour-center: ${d.skyColourHorizonHex || "#0B1020"}; --kpi-colour-edge: ${d.skyColourHorizonEdgeHex || d.skyColourHorizonHex || "#D6B06B"};`,
      },
      {
        label: "Vegetation Colour",
        tipLabel: "Vegetation colour",
        value: `${d.vegetationPaleHex} â†’ ${d.vegetationDeepHex}`,
        meta: `${d.vegetationNote} <button type="button" class="veg-details-btn" id="btn-veg-details">Details</button>`,
        kpiClass: "kpi--colour",
        kpiAttrs: `data-gradient="linear" data-light="${relativeLuminance(d.vegetationPaleHex) > 0.18 ? 1 : 0}"`,
        kpiStyle: `background: linear-gradient(to right, ${(d.vegetationStops || [d.vegetationPaleHex, d.vegetationDeepHex]).join(", ")});`,
      },
    ];

    // Twilight vegetation KPI (only for tidally locked K/M worlds)
    if (d.vegetationTwilightPaleHex) {
      items.push({
        label: "Vegetation (Twilight)",
        tipLabel: "Vegetation colour (twilight)",
        value: `${d.vegetationTwilightPaleHex} â†’ ${d.vegetationTwilightDeepHex}`,
        meta: "Terminator-zone adapted",
        kpiClass: "kpi--colour",
        kpiAttrs: `data-gradient="linear" data-light="${relativeLuminance(d.vegetationTwilightPaleHex) > 0.18 ? 1 : 0}"`,
        kpiStyle: `background: linear-gradient(to right, ${(d.vegetationTwilightStops || [d.vegetationTwilightPaleHex, d.vegetationTwilightDeepHex]).join(", ")});`,
      });
    }

    const kpiHtml = items
      .filter(Boolean)
      .map((x) => {
        if (x.isRockyPreview) {
          return `
      <div class="kpi-wrap"><div class="kpi kpi--preview">
        <div class="kpi__label">${x.label} ${tipIcon(TIP_LABEL[x.label] || "")}
          <button type="button" class="small rp-recipe-btn">Recipes</button>
          <button type="button" class="small rp-pause-btn">Pause</button>
        </div>
        <canvas class="rocky-preview-canvas" width="180" height="180"></canvas>
        <div class="kpi__meta">${x.value} \u2014 ${x.meta || ""}</div>
      </div></div>`;
        }
        return `
      <div class="kpi-wrap">
        <div class="kpi ${x.kpiClass || ""}" ${x.kpiAttrs || ""} style="${x.kpiStyle || ""}">
          <div class="kpi__label">${x.label} ${tipIcon(TIP_LABEL[x.tipLabel] || TIP_LABEL[x.label] || "")}</div>
          <div class="kpi__value">${x.value}</div>
          <div class="kpi__meta">${x.meta || ""}</div>
        </div>
      </div>`;
      })
      .join("");

    const n2Pct = fmt(d.n2Pct, 2);
    const gasMixNote = d.gasMixClamped
      ? `\nAtmosphere note: gas inputs total ${fmt(d.gasInputTotalPct, 2)}%. N2 is clamped to 0% for derived outputs.`
      : "";

    // Update computed GHE readout in inputs panel
    const ghCompEl = bodyInputsEl.querySelector("#ghComputedValue");
    if (ghCompEl) ghCompEl.textContent = fmt(d.computedGreenhouseEffect, 3);

    // Build gas mix lines including all tracked gases
    const h2o = Number(p.h2oPct) || 0;
    const ch4 = Number(p.ch4Pct) || 0;
    const h2 = Number(p.h2Pct) || 0;
    const he = Number(p.hePct) || 0;
    const so2 = Number(p.so2Pct) || 0;
    const nh3 = Number(p.nh3Pct) || 0;
    const hasExpert = h2 > 0 || he > 0 || so2 > 0 || nh3 > 0;
    let gasMixLine = `Gas mix (%): O2 ${fmt(p.o2Pct, 2)} / CO2 ${fmt(p.co2Pct, 2)} / Ar ${fmt(p.arPct, 2)} / H2O ${fmt(h2o, 2)} / CH4 ${fmt(ch4, 3)} / N2 ${n2Pct}`;
    let ppLine = `Partial pressures (atm): O2 ${fmt(d.ppO2Atm, 4)} / CO2 ${fmt(d.ppCO2Atm, 6)} / Ar ${fmt(d.ppArAtm, 4)} / H2O ${fmt(d.ppH2OAtm, 4)} / CH4 ${fmt(d.ppCH4Atm, 6)} / N2 ${fmt(d.ppN2Atm, 4)}`;
    if (hasExpert) {
      gasMixLine += `\nExpert gases (%): H2 ${fmt(h2, 1)} / He ${fmt(he, 1)} / SO2 ${fmt(so2, 3)} / NH3 ${fmt(nh3, 3)}`;
      ppLine += `\nExpert pp (atm): H2 ${fmt(d.ppH2Atm, 4)} / He ${fmt(d.ppHeAtm, 4)} / SO2 ${fmt(d.ppSO2Atm, 6)} / NH3 ${fmt(d.ppNH3Atm, 6)}`;
    }

    const ghModeLine =
      d.greenhouseMode === "manual"
        ? `Greenhouse: manual (${fmt(d.greenhouseEffect, 3)})`
        : `Greenhouse: ${d.greenhouseMode} (computed ${fmt(d.computedGreenhouseEffect, 3)}, \u03C4 = ${fmt(d.computedGreenhouseTau, 3)})`;

    // Capture existing canvas before innerHTML wipe to preserve WebGL context
    const prevRockyCanvas = bodyOutputsEl.querySelector(".rocky-preview-canvas");

    bodyOutputsEl.innerHTML = `
      <div class="kpi-grid">${kpiHtml}</div>
      <div style="margin-top:14px">
        <div class="label">Derived details ${tipIcon(TIP_LABEL["Details"])}</div>
        <div class="derived-readout">Habitable zone: ${model.display.hz}
In habitable zone: ${d.inHabitableZone ? "Yes" : "No"}
Insolation: ${model.display.insolation}
Tidal lock: ${model.display.tidalLock}${d.planetTidalHeatingW > 0 && !model.display.moonTidalHeating ? `\nMoon tidal heating: negligible (${fmt(d.planetTidalHeatingEarth, 4)}\u00d7 Earth geothermal)` : ""}
Liquid water: ${d.liquidWaterPossible ? "Possible" : "Unlikely"}
Rotation direction: ${d.rotationDirection}
Tropics: ${d.tropics}\u00b0 N/S
Polar circles: ${d.polarCircles}\u00b0 N/S
Periapsis: ${model.display.peri}
Apoapsis: ${model.display.apo}

${ghModeLine}
Atmospheric pressure: ${model.display.pressureKpa}
${gasMixLine}
${ppLine}
Atmospheric weight: ${model.display.atmWeight}
Atmospheric density: ${model.display.atmDensity}${gasMixNote}</div>
      </div>
      <div style="margin-top:14px">
        <div class="label">Derived atmospheric circulation ${tipIcon(TIP_LABEL["Atmospheric circulation"])}</div>
        <div class="derived-readout">${`Cell count: ${d.circulationCellCount}\n${d.circulationCellRanges.length ? d.circulationCellRanges.map((c) => `${c.name}: ${c.rangeDegNS}\u00b0 N/S`).join("\n") : "-"}`}</div>
      </div>
    `;

    // Render rocky planet preview canvas (animated native celestial controller)
    let rockyCvs = bodyOutputsEl.querySelector(".rocky-preview-canvas");
    if (prevRockyCanvas && rockyCvs && prevRockyCanvas !== rockyCvs) {
      rockyCvs.replaceWith(prevRockyCanvas);
      rockyCvs = prevRockyCanvas;
    }
    if (rockyCvs && visualProfile) {
      celestialPreviewController.attach(rockyCvs, {
        bodyType: "rocky",
        name: p.name || "Rocky world",
        recipeId: String(p.appearanceRecipeId || ""),
        inputs: p,
        derived: d,
        visualProfile,
        rotationPeriodHours: Number(p.rotationPeriodHours) || 24,
        axialTiltDeg: Number(p.axialTiltDeg) || 0,
      });
    } else {
      celestialPreviewController.detach();
    }

    // Wire recipe picker button
    bodyOutputsEl.querySelector(".rp-recipe-btn")?.addEventListener("click", () => {
      openRecipePicker((recipe) => {
        const w = loadWorld();
        const pid = w.planets.selectedId;
        const nextInputs = { ...recipe.apply, appearanceRecipeId: recipe.id };
        updatePlanet(pid, { inputs: nextInputs });
        updateWorld({ planet: nextInputs });
        render();
      });
    });

    // Pause / resume rotation
    const rpPauseBtn = bodyOutputsEl.querySelector(".rp-pause-btn");
    if (rpPauseBtn) {
      rpPauseBtn.addEventListener("click", () => {
        const paused = rpPauseBtn.textContent === "Pause";
        celestialPreviewController.setPaused(paused);
        rpPauseBtn.textContent = paused ? "Play" : "Pause";
      });
    }

    // Update tectonic pills: mark recommended + auto-select if in auto mode
    if (tecPillsEl && d.tectonicSuggested) {
      const recVal =
        d.tectonicSuggested === "plutonicSquishy" ? "plutonic-squishy" : d.tectonicSuggested;
      if (d.tectonicIsAuto) setTecPillValue(recVal);
      updateTecRecommended(recVal);
    }

    // Populate tectonic probability bar in the inputs panel
    const tecBar = bodyInputsEl.querySelector("#tecProbBar");
    if (tecBar && d.tectonicProbabilities) {
      const probs = d.tectonicProbabilities;
      const REGIME_COLOURS = {
        stagnant: "#ff7c97",
        mobile: "#7cffb2",
        episodic: "#ffd37c",
        plutonicSquishy: "#a6abcc",
      };
      const REGIME_SHORT = {
        stagnant: "Stagnant",
        mobile: "Mobile",
        episodic: "Episodic",
        plutonicSquishy: "Plut.-squishy",
      };
      const keys = ["stagnant", "mobile", "episodic", "plutonicSquishy"];
      const segs = keys
        .filter((r) => probs[r] >= 0.01)
        .map(
          (r) =>
            `<div class="tec-prob-bar__seg" style="width:${probs[r] * 100}%;background:${REGIME_COLOURS[r]}" title="${REGIME_SHORT[r]}: ${Math.round(probs[r] * 100)}%"></div>`,
        )
        .join("");
      const legend = keys
        .filter((r) => probs[r] >= 0.05)
        .map(
          (r) =>
            `<span class="tec-prob-bar__label"><span class="tec-prob-bar__dot" style="background:${REGIME_COLOURS[r]}"></span>${REGIME_SHORT[r]} ${Math.round(probs[r] * 100)}%</span>`,
        )
        .join("");
      tecBar.innerHTML = `<div class="tec-prob-bar__track">${segs}</div><div class="tec-prob-bar__legend">${legend}</div>`;
    }

    const vegBtn = bodyOutputsEl.querySelector("#btn-veg-details");
    if (vegBtn) {
      vegBtn.addEventListener("click", () => {
        openVegInfoDialog({
          pressureAtm: p.pressureAtm,
          spectralKey: d.skySpectralKey,
          paleHex: d.vegetationPaleHex,
          deepHex: d.vegetationDeepHex,
          stops: d.vegetationStops,
          note: d.vegetationNote,
          insolation: d.insolationEarth,
          tidallyLocked: d.tidallyLockedToStar,
          twilightPaleHex: d.vegetationTwilightPaleHex,
          twilightDeepHex: d.vegetationTwilightDeepHex,
          twilightStops: d.vegetationTwilightStops,
        });
      });
    }
  }

  /* â”€â”€ Vegetation info dialog â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */

  const VEG_GRID_STARS = [
    { label: "A0", mass: 2.5, age: 0.5 },
    { label: "F0", mass: 1.6, age: 2.0 },
    { label: "F5", mass: 1.3, age: 3.0 },
    { label: "G0", mass: 1.05, age: 4.0 },
    { label: "G2", mass: 1.0, age: 4.6 },
    { label: "G5", mass: 0.92, age: 5.0 },
    { label: "K0", mass: 0.79, age: 6.0 },
    { label: "K5", mass: 0.67, age: 7.0 },
    { label: "M0", mass: 0.51, age: 8.0 },
    { label: "M2", mass: 0.4, age: 8.0 },
    { label: "M5", mass: 0.18, age: 8.0 },
    { label: "M8", mass: 0.1, age: 8.0 },
  ];
  const VEG_GRID_PRESSURES = [0.01, 0.1, 0.5, 1, 3, 10, 30, 100];
  const VEG_GRID_PLANET = {
    massEarth: 1,
    cmfPct: 33,
    axialTiltDeg: 23.4,
    albedoBond: 0.3,
    greenhouseEffect: 1,
    observerHeightM: 2,
    rotationPeriodHours: 24,
    semiMajorAxisAu: 1,
    eccentricity: 0.017,
    inclinationDeg: 0,
    longitudeOfPeriapsisDeg: 0,
    subsolarLongitudeDeg: 0,
    pressureAtm: 1,
    o2Pct: 21,
    co2Pct: 0.04,
    arPct: 1,
  };

  function vegGridOrbit(mass) {
    if (mass < 0.3) return 0.05;
    if (mass < 0.5) return 0.15;
    if (mass < 0.7) return 0.5;
    if (mass < 0.9) return 0.8;
    return 1.0;
  }

  function vegGridTwilightOrbit(mass) {
    if (mass < 0.3) return 0.03;
    if (mass < 0.5) return 0.08;
    return 0.15;
  }

  function buildVegGrid() {
    const pCols = VEG_GRID_PRESSURES.map((p) => {
      const tag =
        p < 1 || p > 10 ? ' <span class="veg-info-tag veg-info-tag--extrap">E</span>' : "";
      return `<th>${p} atm${tag}</th>`;
    }).join("");

    let rows = "";
    for (const star of VEG_GRID_STARS) {
      rows += `<tr><td class="veg-grid-star">${star.label}</td>`;
      for (const pAtm of VEG_GRID_PRESSURES) {
        const r = calcPlanetExact({
          starMassMsol: star.mass,
          starAgeGyr: star.age,
          planet: {
            ...VEG_GRID_PLANET,
            pressureAtm: pAtm,
            semiMajorAxisAu: vegGridOrbit(star.mass),
          },
        });
        const d = r.derived;
        const s = d.vegetationStops || [d.vegetationPaleHex, d.vegetationDeepHex];
        rows += `<td class="veg-grid-cell">
          <div class="veg-grid-swatch" style="background:linear-gradient(to right,${s.join(",")});"></div>
          <div class="veg-grid-hex">${d.vegetationPaleHex} â†’ ${d.vegetationDeepHex}</div>
        </td>`;
      }
      rows += "</tr>";
    }

    // Twilight-adapted grid for K/M stars (tidally locked close orbits)
    const twiStars = VEG_GRID_STARS.filter((s) => s.mass <= 0.79);
    let twiRows = "";
    for (const star of twiStars) {
      const orbit = vegGridTwilightOrbit(star.mass);
      const r = calcPlanetExact({
        starMassMsol: star.mass,
        starAgeGyr: star.age,
        planet: { ...VEG_GRID_PLANET, pressureAtm: 1, semiMajorAxisAu: orbit },
      });
      if (!r.derived.vegetationTwilightPaleHex) continue;
      twiRows += `<tr><td class="veg-grid-star">${star.label}</td>`;
      for (const pAtm of VEG_GRID_PRESSURES) {
        const rt = calcPlanetExact({
          starMassMsol: star.mass,
          starAgeGyr: star.age,
          planet: { ...VEG_GRID_PLANET, pressureAtm: pAtm, semiMajorAxisAu: orbit },
        });
        const d = rt.derived;
        if (d.vegetationTwilightPaleHex) {
          const s = d.vegetationTwilightStops || [
            d.vegetationTwilightPaleHex,
            d.vegetationTwilightDeepHex,
          ];
          twiRows += `<td class="veg-grid-cell">
            <div class="veg-grid-swatch" style="background:linear-gradient(to right,${s.join(",")});"></div>
            <div class="veg-grid-hex">${d.vegetationTwilightPaleHex} â†’ ${d.vegetationTwilightDeepHex}</div>
          </td>`;
        } else {
          twiRows += `<td class="veg-grid-cell"><div class="veg-grid-hex">-</div></td>`;
        }
      }
      twiRows += "</tr>";
    }

    let twiHtml = "";
    if (twiRows) {
      twiHtml = `
        <div class="veg-info-heading" style="margin-top:16px;">Twilight-adapted (tidally locked K/M worlds)</div>
        <table class="veg-grid-table">
          <thead><tr><th>Star</th>${pCols}</tr></thead>
          <tbody>${twiRows}</tbody>
        </table>`;
    }

    return `<table class="veg-grid-table">
      <thead><tr><th>Star</th>${pCols}</tr></thead>
      <tbody>${rows}</tbody>
    </table>${twiHtml}`;
  }

  function openVegInfoDialog(v) {
    const pAtm = Number(v.pressureAtm) || 1;
    const isExtrapolated = pAtm > 10 || pAtm < 1;
    const dataLabel = isExtrapolated ? "Extrapolated" : "Empirical";
    const dataClass = isExtrapolated ? "veg-info-tag--extrap" : "veg-info-tag--empirical";

    const stops = v.stops || [v.paleHex, v.deepHex];
    const grad = `linear-gradient(to right, ${stops.join(", ")})`;

    let twilightHtml = "";
    if (v.twilightPaleHex) {
      const tStops = v.twilightStops || [v.twilightPaleHex, v.twilightDeepHex];
      twilightHtml = `
        <div class="veg-info-section">
          <div class="veg-info-heading">Twilight-adapted variant</div>
          <div class="veg-info-gradient" style="background: linear-gradient(to right, ${tStops.join(", ")});"></div>
          <div class="veg-info-hex">${v.twilightPaleHex} â†’ ${v.twilightDeepHex}</div>
          <p>Organisms at the terminator of tidally locked worlds receive only scattered and refracted starlight, producing paler, more desaturated pigments.</p>
        </div>`;
    }

    const overlay = document.createElement("div");
    overlay.className = "veg-info-overlay";
    overlay.innerHTML = `
      <div class="veg-info-dialog panel">
        <div class="panel__header">
          <h2>Vegetation Colour Details</h2>
          <button type="button" class="small veg-info-close">Close</button>
        </div>
        <div class="panel__body">
          <div class="veg-info-gradient" style="background: ${grad};"></div>
          <div class="veg-info-hex">${v.paleHex} â†’ ${v.deepHex}</div>
          <div class="veg-info-note">${v.note}</div>

          <div class="veg-info-section">
            <div class="veg-info-heading">Current pressure</div>
            <p>${pAtm} atm &mdash; <span class="veg-info-tag ${dataClass}">${dataLabel}</span></p>
          </div>

          <div class="veg-info-section">
            <div class="veg-info-heading">Data source</div>
            <p>Vegetation colours are derived from the <strong>PanoptesV</strong> radiative-transfer model
            (O'Malley-James &amp; Kaltenegger, 2019), which simulates how atmospheric Rayleigh scattering
            filters starlight reaching the surface and how photosynthetic pigments would adapt.</p>
            <p>The model provides empirical colour data at three atmospheric pressures
            (<strong>1, 3, and 10 atm</strong>) across ten spectral classes (A0 through M9).
            These serve as anchor points in a 2D look-up table.</p>
          </div>

          <div class="veg-info-section">
            <div class="veg-info-heading">Interpolation <span class="veg-info-tag veg-info-tag--empirical">Empirical range</span></div>
            <p>Between the anchor points, colours are blended using <strong>bilinear OKLab interpolation</strong>:</p>
            <ol>
              <li><strong>Pressure axis</strong> &mdash; log-pressure interpolation between the 1, 3, and 10 atm anchors
              (log&#8322;0 spacing gives perceptually even steps).</li>
              <li><strong>Spectral axis</strong> &mdash; linear interpolation between the two nearest spectral-class anchors
              based on stellar effective temperature.</li>
            </ol>
            <p>OKLab colour space ensures perceptually uniform blending (no muddy mid-tones).</p>
          </div>

          <div class="veg-info-section">
            <div class="veg-info-heading">Extrapolation above 10 atm <span class="veg-info-tag veg-info-tag--extrap">Extrapolated</span></div>
            <p>PanoptesV does not provide data above 10 atm. For pressures from <strong>10 to 100 atm</strong>,
            we continue the 3&rarr;10 atm colour trend in OKLab space with <strong>50% dampening</strong>.</p>
            <p>This reflects the physical expectation that Rayleigh scattering effects saturate at extreme
            optical depths &mdash; additional atmosphere continues to shift the surface spectrum,
            but with diminishing returns.</p>
            <p>Colours in this range are plausible but speculative and should be treated as estimates.</p>
          </div>

          <div class="veg-info-section">
            <div class="veg-info-heading">Extrapolation below 1 atm <span class="veg-info-tag veg-info-tag--extrap">Extrapolated</span></div>
            <p>PanoptesV does not provide data below 1 atm. For pressures from <strong>0.01 to 1 atm</strong>,
            we reverse the 1&rarr;3 atm colour trend in OKLab space with <strong>50% dampening</strong>.</p>
            <p>The physical basis: thinner atmospheres produce less Rayleigh scattering, so more of the
            star's raw spectrum reaches the surface. Pigments adapt to this less-filtered light.
            This is supported by Kiang et al. (2007) and Lehmer et al. (2021), who identify atmospheric
            column depth as a factor in the surface photon spectrum that drives pigment evolution.</p>
            <p>However, no published model has specifically computed vegetation colours at sub-1-atm pressures.
            These values are plausible extrapolations and should be treated as estimates.</p>
          </div>

          <div class="veg-info-section">
            <div class="veg-info-heading">Additional corrections</div>
            <ul>
              <li><strong>Insolation</strong> &mdash; low-light environments darken pigments (broader absorption needed to capture scarce photons).</li>
              <li><strong>Tidal lock</strong> &mdash; tidally locked K/M worlds get a separate twilight-adapted palette for the terminator zone.</li>
            </ul>
          </div>

          ${twilightHtml}

          <div class="veg-info-section">
            <div class="veg-info-heading">
              Full reference grid
              <button type="button" class="small veg-grid-toggle" id="btn-veg-grid-toggle">Show grid</button>
            </div>
            <p>Computed colours for 12 spectral types across 8 pressures (Earth-like planet in the habitable zone).
            Columns marked <span class="veg-info-tag veg-info-tag--extrap">E</span> are extrapolated beyond the PanoptesV empirical range (1&ndash;10 atm).</p>
            <div id="veg-grid-container" class="veg-grid-container" hidden></div>
          </div>

          <div class="veg-info-section veg-info-refs">
            <div class="veg-info-heading">References</div>
            <ul>
              <li>O'Malley-James &amp; Kaltenegger (2019) &mdash; PanoptesV spectral model</li>
              <li>Kiang et al. (2007) &mdash; photosynthetic pigment adaptation</li>
              <li>Lehmer et al. (2021) &mdash; atmospheric scattering effects</li>
              <li>Arp et al. (2020) &mdash; biosignature spectral analysis</li>
            </ul>
          </div>
        </div>
      </div>`;

    document.body.appendChild(overlay);

    // Lazy-build the reference grid on first toggle
    const gridToggle = overlay.querySelector("#btn-veg-grid-toggle");
    const gridContainer = overlay.querySelector("#veg-grid-container");
    let gridBuilt = false;

    gridToggle.addEventListener("click", () => {
      const showing = !gridContainer.hidden;
      if (showing) {
        gridContainer.hidden = true;
        gridToggle.textContent = "Show grid";
        overlay.querySelector(".veg-info-dialog").style.width = "";
      } else {
        if (!gridBuilt) {
          gridContainer.innerHTML = buildVegGrid();
          gridBuilt = true;
        }
        gridContainer.hidden = false;
        gridToggle.textContent = "Hide grid";
        overlay.querySelector(".veg-info-dialog").style.width = "min(960px, calc(100vw - 36px))";
      }
    });

    function close() {
      overlay.remove();
      document.removeEventListener("keydown", onKey);
    }

    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) close();
    });
    overlay.querySelector(".veg-info-close").addEventListener("click", close);

    function onKey(e) {
      if (e.key === "Escape") close();
    }
    document.addEventListener("keydown", onKey);
  }

  /* â”€â”€ Gas giant rendering â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */

  function renderGasGiantInputs(world, giant, sysModel) {
    if (!giant) {
      bodyInputsEl.innerHTML = '<div class="hint">No gas giant selected.</div>';
      return;
    }
    const orbitsAu = sysModel.orbitsAu;
    const planets = listPlanets(world);
    const gasGiants = listSystemGasGiants(world);
    const planetSlots = new Set();
    for (const pp of planets) {
      if (pp.slotIndex != null && pp.slotIndex >= 1 && pp.slotIndex <= 20) {
        planetSlots.add(pp.slotIndex);
      }
    }
    const ggSlotMap = new Map();
    for (const g of gasGiants) {
      if (g.slotIndex != null) ggSlotMap.set(g.slotIndex, g.id);
    }

    let slotOptionsHtml = '<option value="">Custom orbit</option>';
    for (let i = 0; i < 20; i++) {
      const slot = i + 1;
      const au = orbitsAu[i];
      const occupiedByPlanet = planetSlots.has(slot);
      const occupiedByGG = ggSlotMap.has(slot) && ggSlotMap.get(slot) !== giant.id;
      const disabled = occupiedByPlanet || occupiedByGG;
      const tag = occupiedByPlanet ? " (planet)" : occupiedByGG ? " (giant)" : "";
      const selected = giant.slotIndex === slot ? "selected" : "";
      slotOptionsHtml += `<option value="${slot}" ${disabled ? "disabled" : ""} ${selected}>Slot ${slot} \u2014 ${fmt(au, 2)} AU${tag}</option>`;
    }

    bodyInputsEl.innerHTML = `
      <div class="form-row" style="margin-top:8px">
        <div>
          <div class="label">Orbital slot ${tipIcon(TIP_LABEL["GG Slot"])}</div>
          <div class="hint">${giant.slotIndex ? `Slot ${giant.slotIndex} \u2014 ${fmt(orbitsAu[giant.slotIndex - 1], 3)} AU` : `${fmt(Number(giant.au) || 0, 3)} AU (custom)`}</div>
        </div>
        <select id="ggSlot">${slotOptionsHtml}</select>
      </div>

      <div class="form-row gg-custom-au-row" id="ggCustomAuRow" style="margin-top:8px;${giant.slotIndex ? "display:none" : ""}">
        <div>
          <div class="label">Orbit <span class="unit">AU</span> ${tipIcon(TIP_LABEL["Custom orbit"])}</div>
          <div class="hint">Manual orbit distance.</div>
        </div>
        <div class="input-pair">
          <input id="ggAu" type="number" step="0.01" value="${Number(giant.au || 0)}" />
          <input id="ggAuSlider" type="range" />
          <div class="range-meta"><span>0.01</span><span>1000</span></div>
        </div>
      </div>

      <div style="height:10px"></div>
      <div class="form-row">
        <div>
          <div class="label">Name ${tipIcon(TIP_LABEL["Name"])}</div>
        </div>
        <input id="ggName" type="text" value="${escapeHtml(giant.name || "Gas giant")}" />
      </div>

      <div class="form-row" style="margin-top:8px">
        <div>
          <div class="label">Radius <span class="unit">Rj</span> ${tipIcon(TIP_LABEL["GG Size"])}</div>
          <div class="hint">1.00 Rj = Jupiter-size.</div>
        </div>
        <div class="input-pair">
          <input id="ggRadius" type="number" step="${GAS_GIANT_RADIUS_STEP_RJ}" value="${clampGasGiantRadiusRj(giant.radiusRj)}" />
          <input id="ggRadiusSlider" type="range" />
          <div class="range-meta"><span>${GAS_GIANT_RADIUS_MIN_RJ.toFixed(2)}</span><span>${GAS_GIANT_RADIUS_MAX_RJ.toFixed(2)}</span></div>
        </div>
      </div>

      <div class="form-row" style="margin-top:8px">
        <div>
          <div class="label">Mass <span class="unit">Mj</span> ${tipIcon(TIP_LABEL["GG Mass"])}</div>
          <div class="hint">Blank = derived from radius.</div>
        </div>
        <div class="input-pair">
          <input id="ggMass" type="number" step="${GAS_GIANT_MASS_STEP_MJUP}" value="${giant.massMjup != null ? giant.massMjup : ""}" placeholder="auto" />
          <input id="ggMassSlider" type="range" />
          <div class="range-meta"><span>${GAS_GIANT_MASS_MIN_MJUP}</span><span>${GAS_GIANT_MASS_MAX_MJUP}</span></div>
        </div>
      </div>

      <div class="form-row" style="margin-top:8px">
        <div>
          <div class="label">Rotation <span class="unit">hours</span> ${tipIcon(TIP_LABEL["GG Rotation"])}</div>
          <div class="hint">Blank = default 10 h.</div>
        </div>
        <div class="input-pair">
          <input id="ggRotation" type="number" step="0.1" value="${giant.rotationPeriodHours != null ? giant.rotationPeriodHours : ""}" placeholder="10" />
          <input id="ggRotationSlider" type="range" />
          <div class="range-meta"><span>1</span><span>100</span></div>
        </div>
      </div>

      <div class="form-row" style="margin-top:8px">
        <div>
          <div class="label">Metallicity <span class="unit">\u00d7 solar</span> ${tipIcon(TIP_LABEL["GG Metallicity"])}</div>
          <div class="hint">Blank = derived from mass.</div>
        </div>
        <div class="input-pair">
          <input id="ggMetallicity" type="number" step="${GAS_GIANT_METALLICITY_STEP}" value="${giant.metallicity != null ? giant.metallicity : ""}" placeholder="auto" />
          <input id="ggMetallicitySlider" type="range" />
          <div class="range-meta"><span>${GAS_GIANT_METALLICITY_MIN}</span><span>${GAS_GIANT_METALLICITY_MAX}</span></div>
        </div>
      </div>

      <!-- Appearance is data-driven; recipe picker lives in the KPI output -->
    `;

    // Bind sliders and attach events
    let hydrating = true;

    function saveGiant() {
      if (isRendering || hydrating) return;
      const w = loadWorld();
      const now = listSystemGasGiants(w);
      const g = now.find((x) => x.id === giant.id);
      if (!g) return;

      g.name = bodyInputsEl.querySelector("#ggName").value;
      const slotVal = bodyInputsEl.querySelector("#ggSlot").value;
      if (slotVal) {
        g.slotIndex = Number(slotVal);
        g.au = orbitsAu[g.slotIndex - 1];
      } else {
        g.slotIndex = null;
        const au = Number(bodyInputsEl.querySelector("#ggAu").value);
        g.au = Number.isFinite(au) && au > 0 ? au : 0.01;
      }
      g.radiusRj = clampGasGiantRadiusRj(bodyInputsEl.querySelector("#ggRadius").value);
      const massVal = bodyInputsEl.querySelector("#ggMass").value;
      g.massMjup = massVal !== "" ? Number(massVal) || null : null;
      const rotVal = bodyInputsEl.querySelector("#ggRotation").value;
      g.rotationPeriodHours = rotVal !== "" ? Number(rotVal) || null : null;
      const metVal = bodyInputsEl.querySelector("#ggMetallicity").value;
      g.metallicity = metVal !== "" ? Number(metVal) || null : null;
      // Auto-derive visual style and rings from physics
      const starData = {
        starMassMsol: Number(world.star.massMsol) || 1,
        starLuminosityLsol: sysModel.star.luminosityLsol,
        starAgeGyr: Number(world.star.ageGyr) || 4.6,
        starRadiusRsol: sysModel.star.radiusRsol,
      };
      const ggCalc = calcGasGiant({
        massMjup: g.massMjup,
        radiusRj: g.radiusRj,
        orbitAu: Number(g.au) || sysModel.frostLineAu,
        rotationPeriodHours: g.rotationPeriodHours,
        metallicity: g.metallicity,
        ...starData,
      });
      g.style = suggestStyles(ggCalc).primary;
      const depth = ggCalc.ringProperties?.opticalDepthClass;
      g.rings = depth === "Dense" || depth === "Moderate";

      saveSystemGasGiants(now);
      scheduleRender(true);
    }

    const auEl = bodyInputsEl.querySelector("#ggAu");
    const auSlider = bodyInputsEl.querySelector("#ggAuSlider");
    bindNumberAndSlider({
      numberEl: auEl,
      sliderEl: auSlider,
      min: 0.01,
      max: 1000,
      step: 0.01,
      mode: "auto",
      onChange: () => {
        if (!hydrating) saveGiant();
      },
    });

    const radiusEl = bodyInputsEl.querySelector("#ggRadius");
    const radiusSlider = bodyInputsEl.querySelector("#ggRadiusSlider");
    bindNumberAndSlider({
      numberEl: radiusEl,
      sliderEl: radiusSlider,
      min: GAS_GIANT_RADIUS_MIN_RJ,
      max: GAS_GIANT_RADIUS_MAX_RJ,
      step: GAS_GIANT_RADIUS_STEP_RJ,
      mode: "auto",
      onChange: () => {
        if (!hydrating) saveGiant();
      },
    });

    const massEl = bodyInputsEl.querySelector("#ggMass");
    const massSlider = bodyInputsEl.querySelector("#ggMassSlider");
    bindNumberAndSlider({
      numberEl: massEl,
      sliderEl: massSlider,
      min: GAS_GIANT_MASS_MIN_MJUP,
      max: GAS_GIANT_MASS_MAX_MJUP,
      step: GAS_GIANT_MASS_STEP_MJUP,
      mode: "auto",
      onChange: () => {
        if (!hydrating) saveGiant();
      },
    });

    const rotEl = bodyInputsEl.querySelector("#ggRotation");
    const rotSlider = bodyInputsEl.querySelector("#ggRotationSlider");
    bindNumberAndSlider({
      numberEl: rotEl,
      sliderEl: rotSlider,
      min: 1,
      max: 100,
      step: 0.1,
      mode: "auto",
      onChange: () => {
        if (!hydrating) saveGiant();
      },
    });

    const metEl = bodyInputsEl.querySelector("#ggMetallicity");
    const metSlider = bodyInputsEl.querySelector("#ggMetallicitySlider");
    bindNumberAndSlider({
      numberEl: metEl,
      sliderEl: metSlider,
      min: GAS_GIANT_METALLICITY_MIN,
      max: GAS_GIANT_METALLICITY_MAX,
      step: GAS_GIANT_METALLICITY_STEP,
      mode: "auto",
      onChange: () => {
        if (!hydrating) saveGiant();
      },
    });

    bodyInputsEl.querySelector("#ggSlot").addEventListener("change", () => {
      if (hydrating) return;
      bodyInputsEl.querySelector("#ggCustomAuRow").style.display = bodyInputsEl.querySelector(
        "#ggSlot",
      ).value
        ? "none"
        : "";
      saveGiant();
    });

    bodyInputsEl.querySelector("#ggName").addEventListener("change", () => {
      if (!hydrating) saveGiant();
    });

    // Fire initial slider sync
    [auEl, radiusEl, massEl, rotEl, metEl].forEach((el) => {
      el.dispatchEvent(new Event("input", { bubbles: true }));
    });

    hydrating = false;
  }

  function renderGasGiantOutputs(world, giant, sysModel) {
    if (!giant) {
      bodyOutputsEl.innerHTML = '<div class="hint">No gas giant selected.</div>';
      return;
    }
    const starData = {
      starMassMsol: Number(world.star.massMsol) || 1,
      starLuminosityLsol: sysModel.star.luminosityLsol,
      starAgeGyr: Number(world.star.ageGyr) || 4.6,
      starRadiusRsol: sysModel.star.radiusRsol,
    };
    const m = calcGasGiant({
      massMjup: giant.massMjup,
      radiusRj: giant.radiusRj,
      orbitAu: Number(giant.au) || sysModel.frostLineAu,
      rotationPeriodHours: giant.rotationPeriodHours,
      metallicity: giant.metallicity,
      ...starData,
    });
    const clouds = m.clouds.map((c) => c.name).join(", ") || "None";
    const massNote =
      m.inputs.massSource === "derived"
        ? "Derived from radius"
        : m.inputs.massSource === "default"
          ? "Default"
          : "";
    const radiusNote =
      m.inputs.radiusSource === "derived"
        ? "Derived from mass"
        : m.inputs.radiusSource === "default"
          ? "Default"
          : "";
    const metNote = m.inputs.metallicitySource === "derived" ? "Derived from mass" : "";

    // Derive style and ring display from physics (keeps stored value in sync)
    const derivedStyle = suggestStyles(m).primary;
    const depthClass = m.ringProperties?.opticalDepthClass;
    const showRings = depthClass === "Dense" || depthClass === "Moderate";
    if (giant.rings !== showRings || giant.style !== derivedStyle) {
      giant.rings = showRings;
      giant.style = derivedStyle;
      const w = loadWorld();
      const all = listSystemGasGiants(w);
      const g = all.find((x) => x.id === giant.id);
      if (g) {
        g.rings = showRings;
        g.style = derivedStyle;
        saveSystemGasGiants(all);
      }
    }

    const prevGasCanvas = bodyOutputsEl.querySelector(".gg-preview-canvas");
    bodyOutputsEl.innerHTML = `
      <div class="kpi-grid">
        <div class="kpi-wrap"><div class="kpi kpi--preview">
          <div class="kpi__label">Appearance ${tipIcon(TIP_LABEL["Sudarsky"])}
            <button type="button" class="small gg-recipe-btn">Recipes</button>
            <button type="button" class="small gg-pause-btn">Pause</button>
          </div>
          <canvas class="gg-preview-canvas" data-style="${derivedStyle}" data-rings="${showRings}" width="180" height="180"></canvas>
          <div class="kpi__meta">${styleLabel(derivedStyle)} \u2014 Class ${m.classification.sudarsky}</div>
        </div></div>
        <div class="kpi-wrap"><div class="kpi">
          <div class="kpi__label">Mass ${tipIcon(TIP_LABEL["GG Mass"])}</div>
          <div class="kpi__value">${m.display.mass}</div>
          <div class="kpi__meta">${massNote}</div>
        </div></div>
        <div class="kpi-wrap"><div class="kpi">
          <div class="kpi__label">Radius ${tipIcon(TIP_LABEL["GG Output Radius"])}</div>
          <div class="kpi__value">${m.display.radius}</div>
          <div class="kpi__meta">${radiusNote}</div>
        </div></div>
        <div class="kpi-wrap"><div class="kpi">
          <div class="kpi__label">Metallicity ${tipIcon(TIP_LABEL["GG Metallicity"])}</div>
          <div class="kpi__value">${m.display.metallicity}</div>
          <div class="kpi__meta">${metNote}</div>
        </div></div>
        <div class="kpi-wrap"><div class="kpi">
          <div class="kpi__label">Density ${tipIcon(TIP_LABEL["GG Density"])}</div>
          <div class="kpi__value">${m.display.density}</div>
        </div></div>
        <div class="kpi-wrap"><div class="kpi">
          <div class="kpi__label">Gravity ${tipIcon(TIP_LABEL["GG Gravity"])}</div>
          <div class="kpi__value">${m.display.gravity}</div>
        </div></div>
        <div class="kpi-wrap"><div class="kpi">
          <div class="kpi__label">Equilibrium Temp ${tipIcon(TIP_LABEL["GG Equilibrium Temp"])}</div>
          <div class="kpi__value">${m.display.equilibriumTemp}</div>
          <div class="kpi__meta">T_eff ${m.display.effectiveTemp}</div>
        </div></div>
        <div class="kpi-wrap"><div class="kpi">
          <div class="kpi__label">Orbital Period ${tipIcon(TIP_LABEL["GG Orbital Period"])}</div>
          <div class="kpi__value">${m.display.orbitalPeriod}</div>
          <div class="kpi__meta">${m.display.orbitalVelocity}</div>
        </div></div>
      </div>
      <div style="margin-top:14px">
        <div class="label">Derived details ${tipIcon(TIP_LABEL["GG Derived"])}</div>
        <div class="derived-readout">Atmosphere: H\u2082 ${m.atmosphere.h2Pct}%, He ${m.atmosphere.hePct}%${m.atmosphere.ch4Pct > 0 ? `, CH\u2084 ${m.atmosphere.ch4Pct}%` : ""}${m.atmosphere.coPct > 0 ? `, CO ${m.atmosphere.coPct}%` : ""}
Dominant trace: ${m.atmosphere.dominantTrace}
Cloud layers: ${clouds}
Bond albedo: ${fmt(m.thermal.bondAlbedo, 2)}
Internal heat ratio: ${fmt(m.thermal.internalHeatRatio, 2)}

Magnetic field: ${m.display.magneticField}
Magnetosphere: ${m.display.magnetosphere}

Hill sphere: ${m.display.hillSphere}
Roche limit: ${m.display.rocheLimit}
Chaotic zone: ${m.display.chaoticZone}
Ring zone: ${fmt(m.gravity.ringZoneInnerKm, 0)}\u2013${fmt(m.gravity.ringZoneOuterKm, 0)} km

Dynamics: ${m.display.bands}
Wind speed: ${m.display.windSpeed}

Oblateness: ${m.display.oblateness} ${tipIcon(TIP_LABEL["GG Oblateness"])}
Equatorial/Polar: ${m.display.equatorialRadius}

Interior: ${m.display.heavyElements} ${tipIcon(TIP_LABEL["GG Interior"])}
Bulk metallicity: ${m.display.bulkMetallicity}

Mass loss: ${m.display.massLossRate} ${tipIcon(TIP_LABEL["GG Mass Loss"])}
Evaporation: ${m.display.evaporationTimescale}
Roche lobe: ${m.display.rocheLobeRadius}

Suggested radius: ${m.display.suggestedRadius} ${tipIcon(TIP_LABEL["GG Suggested Radius"])}
${m.display.radiusAgeNote}

Rings: ${m.display.ringType} ${tipIcon(TIP_LABEL["GG Ring Properties"])}
Ring details: ${m.display.ringDetails}

Tidal locking: ${m.display.tidalLocking} ${tipIcon(TIP_LABEL["GG Tidal"])}
Circularisation: ${m.display.circularisation}</div>
      </div>
    `;

    // Render gas giant preview canvas (animated native celestial controller)
    let gasCanvas = bodyOutputsEl.querySelector(".gg-preview-canvas");
    if (prevGasCanvas && gasCanvas && prevGasCanvas !== gasCanvas) {
      prevGasCanvas.dataset.style = derivedStyle;
      prevGasCanvas.dataset.rings = String(showRings);
      gasCanvas.replaceWith(prevGasCanvas);
      gasCanvas = prevGasCanvas;
    }
    if (gasCanvas) {
      celestialPreviewController.attach(gasCanvas, {
        bodyType: "gasGiant",
        name: giant.name || "Gas giant",
        recipeId: String(giant.appearanceRecipeId || ""),
        gasCalc: m,
        styleId: derivedStyle,
        showRings,
        rotationPeriodHours: Number(m.inputs?.rotationPeriodHours) || 10,
      });
    } else {
      celestialPreviewController.detach();
    }

    // Recipe picker (in output KPI, like rocky/moon)
    bodyOutputsEl.querySelector(".gg-recipe-btn")?.addEventListener("click", () => {
      openGgRecipePicker((recipe) => {
        const w = loadWorld();
        const giants = listSystemGasGiants(w);
        const g = giants.find((x) => x.id === giant.id);
        if (!g) return;
        if (recipe.apply.massMjup !== undefined) g.massMjup = recipe.apply.massMjup;
        if (recipe.apply.radiusRj !== undefined) g.radiusRj = recipe.apply.radiusRj;
        if (recipe.apply.rotationPeriodHours !== undefined)
          g.rotationPeriodHours = recipe.apply.rotationPeriodHours;
        if (recipe.apply.metallicity !== undefined) g.metallicity = recipe.apply.metallicity;
        g.appearanceRecipeId = recipe.id;
        // Auto-derive style and rings from new physics
        const ggCalc = calcGasGiant({
          massMjup: g.massMjup,
          radiusRj: g.radiusRj,
          orbitAu: Number(g.au) || sysModel.frostLineAu,
          rotationPeriodHours: g.rotationPeriodHours,
          metallicity: g.metallicity,
          starMassMsol: Number(w.star.massMsol) || 1,
          starLuminosityLsol: sysModel.star.luminosityLsol,
          starAgeGyr: Number(w.star.ageGyr) || 4.6,
          starRadiusRsol: sysModel.star.radiusRsol,
          stellarMetallicityFeH: Number(w.star.metallicityFeH) || 0,
        });
        g.style = suggestStyles(ggCalc).primary;
        const recipeDepth = ggCalc.ringProperties?.opticalDepthClass;
        g.rings = recipeDepth === "Dense" || recipeDepth === "Moderate";
        saveSystemGasGiants(giants);
        scheduleRender(true);
      });
    });

    // Pause / resume rotation
    const ggPauseBtn = bodyOutputsEl.querySelector(".gg-pause-btn");
    if (ggPauseBtn) {
      ggPauseBtn.addEventListener("click", () => {
        const paused = ggPauseBtn.textContent === "Pause";
        celestialPreviewController.setPaused(paused);
        ggPauseBtn.textContent = paused ? "Play" : "Pause";
      });
    }
  }

  /* â”€â”€ Gas giant recipe picker modal â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */

  function openGgRecipePicker(onSelect) {
    const categories = [...new Set(GAS_GIANT_RECIPES.map((r) => r.category))];
    const overlay = document.createElement("div");
    overlay.className = "rp-picker-overlay";
    overlay.innerHTML = `
      <div class="rp-picker-dialog panel">
        <div class="panel__header">
          <h2>Gas Giant Recipes</h2>
          <button type="button" class="small rp-picker-close">Close</button>
        </div>
        <div class="rp-picker-progress"><span></span></div>
        <div class="panel__body">
          ${categories
            .map(
              (cat) => `
            <div class="rp-picker-category">${cat}</div>
            <div class="rp-picker-grid">
              ${GAS_GIANT_RECIPES.filter((r) => r.category === cat)
                .map(
                  (r) => `
                <div class="rp-picker-card" data-recipe="${r.id}">
                  <canvas width="90" height="90"></canvas>
                  <div class="rp-picker-card__label">${r.label}</div>
                  ${r.hint ? `<div class="rp-picker-card__hint">${r.hint}</div>` : ""}
                </div>`,
                )
                .join("")}
            </div>`,
            )
            .join("")}
        </div>
      </div>`;

    document.body.appendChild(overlay);

    const progressBar = overlay.querySelector(".rp-picker-progress > span");
    const progressTrack = overlay.querySelector(".rp-picker-progress");
    const items = [];
    for (const card of overlay.querySelectorAll(".rp-picker-card")) {
      const recipe = GAS_GIANT_RECIPES.find((r) => r.id === card.dataset.recipe);
      if (!recipe) continue;
      items.push({
        canvas: card.querySelector("canvas"),
        model: {
          bodyType: "gasGiant",
          name: recipe.label || "Gas giant",
          styleId: recipe.preview?.styleId || "jupiter",
          showRings: !!recipe.preview?.rings,
          rotationPeriodHours: recipe.apply?.rotationPeriodHours || 10,
        },
      });
    }
    renderCelestialRecipeBatch(items, (done, total) => {
      const pct = total ? (done / total) * 100 : 100;
      if (progressBar) progressBar.style.width = `${pct}%`;
      if (pct >= 100 && progressTrack) progressTrack.classList.add("is-done");
    });

    function close() {
      overlay.remove();
      document.removeEventListener("keydown", onKey);
    }

    for (const card of overlay.querySelectorAll(".rp-picker-card")) {
      card.addEventListener("click", () => {
        const recipe = GAS_GIANT_RECIPES.find((r) => r.id === card.dataset.recipe);
        if (recipe) onSelect(recipe);
        close();
      });
    }

    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) close();
    });
    overlay.querySelector(".rp-picker-close").addEventListener("click", close);

    function onKey(e) {
      if (e.key === "Escape") close();
    }
    document.addEventListener("keydown", onKey);
  }

  /* â”€â”€ Rocky recipe picker modal â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */

  function openRecipePicker(onSelect) {
    const categories = ["Terrestrial", "Barren", "Extreme", "Ocean"];
    const overlay = document.createElement("div");
    overlay.className = "rp-picker-overlay";
    overlay.innerHTML = `
      <div class="rp-picker-dialog panel">
        <div class="panel__header">
          <h2>Rocky Planet Recipes</h2>
          <button type="button" class="small rp-picker-close">Close</button>
        </div>
        <div class="rp-picker-progress"><span></span></div>
        <div class="panel__body">
          ${categories
            .map(
              (cat) => `
            <div class="rp-picker-category">${cat}</div>
            <div class="rp-picker-grid">
              ${ROCKY_RECIPES.filter((r) => r.category === cat)
                .map(
                  (r) => `
                <div class="rp-picker-card" data-recipe="${r.id}">
                  <canvas width="90" height="90"></canvas>
                  <div class="rp-picker-card__label">${r.label}</div>
                </div>`,
                )
                .join("")}
            </div>`,
            )
            .join("")}
        </div>
      </div>`;

    document.body.appendChild(overlay);

    const progressBar = overlay.querySelector(".rp-picker-progress > span");
    const progressTrack = overlay.querySelector(".rp-picker-progress");
    const items = [];
    for (const card of overlay.querySelectorAll(".rp-picker-card")) {
      const recipe = ROCKY_RECIPES.find((r) => r.id === card.dataset.recipe);
      if (!recipe) continue;
      items.push({
        canvas: card.querySelector("canvas"),
        model: {
          bodyType: "rocky",
          name: recipe.label || "Rocky world",
          recipeId: recipe.id,
          inputs: recipe.preview?.inputs || {},
          derived: recipe.preview?.derived || {},
        },
      });
    }
    renderCelestialRecipeBatch(items, (done, total) => {
      const pct = total ? (done / total) * 100 : 100;
      if (progressBar) progressBar.style.width = `${pct}%`;
      if (pct >= 100 && progressTrack) progressTrack.classList.add("is-done");
    });

    function close() {
      overlay.remove();
      document.removeEventListener("keydown", onKey);
    }

    for (const card of overlay.querySelectorAll(".rp-picker-card")) {
      card.addEventListener("click", () => {
        const recipe = ROCKY_RECIPES.find((r) => r.id === card.dataset.recipe);
        if (recipe) onSelect(recipe);
        close();
      });
    }

    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) close();
    });
    overlay.querySelector(".rp-picker-close").addEventListener("click", close);

    function onKey(e) {
      if (e.key === "Escape") close();
    }
    document.addEventListener("keydown", onKey);
  }

  /* â”€â”€ Moons section â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */

  function renderMoons(world, bodyType, bodyId) {
    const moons = listMoons(world)
      .filter((m) => m.planetId === bodyId)
      .sort((a, b) => {
        const aa = Number(a?.inputs?.semiMajorAxisKm);
        const bb = Number(b?.inputs?.semiMajorAxisKm);
        return (Number.isFinite(aa) ? aa : Infinity) - (Number.isFinite(bb) ? bb : Infinity);
      });

    bodyMoonsEl.innerHTML = `
      <div class="label">Moons ${tipIcon(TIP_LABEL["Moons"])}</div>
      <div class="hint">Moons belonging to this ${bodyType === "gasGiant" ? "gas giant" : "planet"}.</div>
      <div id="moonsList">
        ${
          moons.length
            ? moons
                .map(
                  (m) => `
          <div class="planet-card" style="cursor:pointer" data-moon-id="${escapeHtml(m.id)}">
            <div>
              <div><b>${escapeHtml(m.name || m.inputs?.name || m.id)}</b></div>
              <div class="planet-card__meta">Moon</div>
            </div>
            <button class="small" type="button" data-action="edit-moon" data-moon-id="${escapeHtml(m.id)}">Edit</button>
          </div>`,
                )
                .join("")
            : '<div class="hint">No moons yet.</div>'
        }
      </div>
      <div class="button-row" style="margin-top:10px">
        <button id="addMoonToBody" type="button">Add moon to this ${bodyType === "gasGiant" ? "gas giant" : "planet"}</button>
      </div>
    `;

    bodyMoonsEl.querySelector("#addMoonToBody")?.addEventListener("click", () => {
      const defaults = {
        name: "Luna",
        semiMajorAxisKm: bodyType === "gasGiant" ? 500000 : 384748,
        eccentricity: bodyType === "gasGiant" ? 0.01 : 0.055,
        inclinationDeg: bodyType === "gasGiant" ? 1 : 5.15,
        massMoon: 1.0,
        densityGcm3: bodyType === "gasGiant" ? 3.0 : 3.34,
        albedo: bodyType === "gasGiant" ? 0.2 : 0.136,
      };
      createMoonFromInputs(defaults, { name: "New Moon", planetId: bodyId });
      location.hash = "#/moon";
    });

    bodyMoonsEl.addEventListener("click", (e) => {
      const btn = e.target.closest?.("button[data-action='edit-moon']");
      if (!btn) return;
      const mid = btn.getAttribute("data-moon-id");
      if (!mid) return;
      selectMoon(mid);
      location.hash = "#/moon";
    });
  }

  /* â”€â”€ Actions (presets/reset) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */

  function renderActions(bodyType) {
    if (bodyType === "planet") {
      bodyActionsEl.innerHTML = `
        <div class="button-row">
          <button id="btn-earth">Earth-ish Preset</button>
          <button id="btn-reset">Reset to Defaults</button>
        </div>
      `;
      bodyActionsEl.querySelector("#btn-earth").addEventListener("click", () => {
        const w = loadWorld();
        const inputs = {
          name: "Earth",
          massEarth: 1.0,
          cmfPct: 32.0,
          axialTiltDeg: 23.44,
          albedoBond: 0.3,
          greenhouseEffect: 1.0,
          observerHeightM: 1.75,
          rotationPeriodHours: 24.0,
          semiMajorAxisAu: 1.0,
          eccentricity: 0.0167,
          inclinationDeg: 0.0,
          longitudeOfPeriapsisDeg: 102.937,
          subsolarLongitudeDeg: 0.0,
          pressureAtm: 1.0,
          o2Pct: 20.95,
          co2Pct: 0.04,
          arPct: 0.93,
        };
        updatePlanet(w.planets.selectedId, { name: "Earth", inputs });
        updateWorld({ planet: inputs });
        scheduleRender();
      });
      bodyActionsEl.querySelector("#btn-reset").addEventListener("click", () => {
        const w = loadWorld();
        const inputs = {
          name: "New Planet",
          massEarth: 0.52,
          cmfPct: 66.0,
          axialTiltDeg: 23.5,
          albedoBond: 0.05,
          greenhouseEffect: 1.65,
          observerHeightM: 1.75,
          rotationPeriodHours: 23.2,
          semiMajorAxisAu: 0.95,
          eccentricity: 0.0167,
          inclinationDeg: 0.0,
          longitudeOfPeriapsisDeg: 283.0,
          subsolarLongitudeDeg: 0.0,
          pressureAtm: 1.0,
          o2Pct: 20.95,
          co2Pct: 0.04,
          arPct: 0.93,
        };
        updatePlanet(w.planets.selectedId, { name: "New Planet", inputs });
        updateWorld({ planet: inputs });
        scheduleRender();
      });
    } else {
      bodyActionsEl.innerHTML = "";
    }
  }

  /* â”€â”€ Main render â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */

  function render(outputsOnly = false) {
    if (isRendering) return;
    isRendering = true;
    try {
      const world = loadWorld();
      const bodyType = world.selectedBodyType || "planet";
      const pSov = getStarOverrides(world.star);
      const pStarCalc = calcStar({
        massMsol: Number(world.star.massMsol),
        ageGyr: Number(world.star.ageGyr) || 4.6,
        radiusRsolOverride: pSov.r,
        luminosityLsolOverride: pSov.l,
        tempKOverride: pSov.t,
        evolutionMode: pSov.ev,
      });
      const sysModel = calcSystem({
        starMassMsol: Number(world.star.massMsol),
        spacingFactor: Number(world.system.spacingFactor),
        orbit1Au: Number(world.system.orbit1Au),
        luminosityLsolOverride: pStarCalc.luminosityLsol,
        radiusRsolOverride: pStarCalc.radiusRsol,
      });

      if (!outputsOnly) {
        // Star info
        starInfoEl.textContent = `Mass: ${fmt(Number(world.star.massMsol), 4)} Msol\nAge: ${fmt(Number(world.star.ageGyr), 3)} Gyr`;

        // Body selector
        populateBodySelector(world);
      }

      if (bodyType === "gasGiant") {
        const giant = getSelectedGasGiant(world);
        const bodyId = world.system?.gasGiants?.selectedId;
        if (!outputsOnly) renderGasGiantInputs(world, giant, sysModel);
        renderGasGiantOutputs(world, giant, sysModel);
        if (!outputsOnly) renderMoons(world, "gasGiant", bodyId);
      } else {
        const planet = getSelectedPlanet(world);
        const bodyId = world.planets?.selectedId;
        if (!outputsOnly) renderRockyInputs(world, planet, sysModel);
        renderRockyOutputs(world);
        if (!outputsOnly) renderMoons(world, "planet", bodyId);
      }

      if (!outputsOnly) {
        renderActions(bodyType);
        attachTooltips(wrap);
      }
    } finally {
      isRendering = false;
    }
  }

  /* â”€â”€ Body selector events â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */

  bodySel.addEventListener("change", () => {
    const val = bodySel.value;
    const [type, id] = val.split(":");
    if (type === "gasGiant") {
      selectGasGiant(id);
    } else {
      selectPlanet(id);
      selectBodyType("planet");
    }
    render();
  });

  wrap.querySelector("#newRockyPlanet").addEventListener("click", () => {
    const w = loadWorld();
    const baseInputs = getSelectedPlanet(w)?.inputs || w.planet;
    createPlanetFromInputs(baseInputs, { name: "New Planet" });
    selectBodyType("planet");
    render();
  });

  wrap.querySelector("#newGasGiant").addEventListener("click", () => {
    const w = loadWorld();
    const gasGiants = listSystemGasGiants(w);
    const ggSov = getStarOverrides(w.star);
    const ggStarCalc = calcStar({
      massMsol: Number(w.star.massMsol),
      ageGyr: Number(w.star.ageGyr) || 4.6,
      radiusRsolOverride: ggSov.r,
      luminosityLsolOverride: ggSov.l,
      tempKOverride: ggSov.t,
      evolutionMode: ggSov.ev,
    });
    const sysModel = calcSystem({
      starMassMsol: Number(w.star.massMsol),
      spacingFactor: Number(w.system.spacingFactor),
      orbit1Au: Number(w.system.orbit1Au),
      luminosityLsolOverride: ggStarCalc.luminosityLsol,
      radiusRsolOverride: ggStarCalc.radiusRsol,
    });
    const planetSlots = new Set();
    for (const p of listPlanets(w)) {
      if (p.slotIndex != null && p.slotIndex >= 1 && p.slotIndex <= 20)
        planetSlots.add(p.slotIndex);
    }
    const usedSlots = new Set([...planetSlots]);
    for (const g of gasGiants) {
      if (g.slotIndex) usedSlots.add(g.slotIndex);
    }
    const maxAu = gasGiants.length ? Math.max(...gasGiants.map((g) => Number(g.au) || 0)) : 0;
    const targetAu = maxAu > 0 ? maxAu * 1.5 : sysModel.frostLineAu * 1.1;
    const slot = findNearestSlot(targetAu, sysModel.orbitsAu, usedSlots);
    const newId = `gg${Math.random().toString(36).slice(2, 9)}`;
    const now = [...gasGiants];
    now.push({
      id: newId,
      name: `Gas giant ${gasGiants.length + 1}`,
      au: slot ? sysModel.orbitsAu[slot - 1] : Number(targetAu.toFixed(2)),
      slotIndex: slot,
      style: "jupiter",
      radiusRj: randomGasGiantRadiusRj(),
      massMjup: null,
      rotationPeriodHours: null,
    });
    saveSystemGasGiants(now);
    selectGasGiant(newId);
    render();
  });

  wrap.querySelector("#deleteBody").addEventListener("click", () => {
    const w = loadWorld();
    const bodyType = w.selectedBodyType || "planet";
    if (bodyType === "gasGiant") {
      const gid = w.system?.gasGiants?.selectedId;
      if (!gid) return;
      // Unassign moons belonging to this gas giant
      if (w.moons?.byId) {
        for (const m of Object.values(w.moons.byId)) {
          if (m.planetId === gid) {
            m.planetId = null;
            m.locked = false;
          }
        }
        saveWorld(w);
      }
      const now = listSystemGasGiants(loadWorld()).filter((g) => g.id !== gid);
      saveSystemGasGiants(now);
      // If no more gas giants, switch to planet type
      if (!now.length) selectBodyType("planet");
    } else {
      const pid = w.planets.selectedId;
      if (w.planets.order.length <= 1) return;
      deletePlanet(pid);
    }
    render();
  });

  /* â”€â”€ Init â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */

  render();
}
