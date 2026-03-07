// SPDX-License-Identifier: MPL-2.0
import { calcPlanetExact, ISOTOPE_HEAT_FRACTIONS } from "../engine/planet.js";
import { calcStar } from "../engine/star.js";
import { calcSystem } from "../engine/system.js";
import { calcGasGiant } from "../engine/gasGiant.js";
import { fmt, relativeLuminance } from "../engine/utils.js";
import { bindNumberAndSlider } from "./bind.js";
import { attachTooltips, tipIcon } from "./tooltip.js";
import { styleLabel, suggestStyles, GAS_GIANT_RECIPES } from "./gasGiantStyles.js";
import { computeRockyVisualProfile, ROCKY_RECIPES } from "./rockyPlanetStyles.js";
import {
  createCelestialVisualPreviewController,
  renderCelestialRecipeBatch,
} from "./celestialVisualPreview.js";
import { createTutorial } from "./tutorial.js";
import { buildBodySelectorEntries } from "./planet/bodySelector.js";
import {
  createRecipePickerOverlay,
  createVegetationInfoOverlay,
  renderBodyActionButtons,
  renderBodySelector,
  renderMoonSection,
  renderPlanetSlotSelector,
  renderVegetationGrid,
} from "./planet/domRender.js";
import {
  createKpiGrid,
  createReadoutSections,
  renderTectonicProbabilityBar,
} from "./planet/outputRender.js";
import { renderGasGiantInputForm, renderRockyInputForm } from "./planet/inputRender.js";
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

/* ── Tooltip dictionary (rocky planet + gas giant) ──────────────── */

const TIP_LABEL = {
  // ── Star context ──
  "Star (read-only)": "Read-only context from your currently selected star.",

  // ── Body selector ──
  "Body selection":
    "Choose which body you are editing. Bodies are sorted by orbital distance. [R] = rocky planet, [D] = dwarf planet, [G] = gas giant.",

  "Body Class":
    "Classification based on mass. Bodies below 0.1 M\u2295 (~Mars mass) are labelled as dwarf planets. The physics model is identical \u2014 this is purely a label.\n\nReal examples: Ceres (0.00016 M\u2295), Pluto (0.0022 M\u2295), Eris (0.0028 M\u2295).",

  // ── Rocky planet inputs ──
  "Orbital slot": "Assign this body to an available system slot. One body per slot.",
  Name: "Set the body's display name used across tabs and exports.",
  Physical: "Core physical inputs that control the planet's bulk properties.",
  Mass: "Planet mass in Earth masses.\n\nTerrestrial planets: 0.1\u201310 MEarth.\nHabitable Earth-like planets: 0.1\u20133.5 MEarth.\n\nEarth = 1 MEarth = 5.972E24 kg",
  CMF: "Core Mass Fraction (CMF) \u2014 percentage of planetary mass in the iron core.\n\nBy default, auto-derived from the host star\u2019s metallicity [Fe/H] (Schulze et al. 2021, PSJ 2, 113). Use the \u2018auto\u2019 button to reset, or enter a manual value.\n\nMercury \u2248 70%\nVenus \u2248 32%\nEarth \u2248 32.5%\nMars \u2248 22%\nMoon \u2248 2%",
  WMF: "Water Mass Fraction (WMF) \u2014 percentage of planetary mass that is water or ice.\n\nHigher WMF inflates the radius, reduces bulk density, and deepens oceans.\n\nDry: < 0.01%\nShallow oceans: 0.01\u20130.1% (Earth ~0.02%)\nExtensive oceans: 0.1\u20131%\nGlobal ocean: 1\u201310% (no exposed land)\nDeep ocean: 10\u201330% (high-pressure ice at seafloor)\nIce world: > 30%\n\nReference: Zeng & Sasselov (2016, ApJ 819, 127) three-layer interior model.",
  "Axial Tilt":
    "Obliquity of the planet\u2019s rotational axis relative to the orbital plane (0\u2013180\u00b0).\n\n0\u201390\u00b0 = prograde spin. 90\u2013180\u00b0 = retrograde spin. Higher tilt produces more extreme seasons; 0\u00b0/180\u00b0 = no seasons.\n\nHabitable range: 0\u201345\u00b0.\n\nEarth = 23.5\u00b0",
  "Albedo (Bond)":
    "Fraction of incident stellar energy reflected by the planet (0\u20131).\n\n0 = perfect absorber. 1 = perfect reflector.\n\nMercury = 0.068\nVenus = 0.77\nEarth = 0.306\nMoon = 0.11\nMars = 0.25",
  "Greenhouse Effect":
    "Manual dimensionless greenhouse multiplier (Manual mode only). 0 = no atmosphere. ~1.2 = Earth-equivalent. ~217 = Venus-equivalent.\n\nIn Core and Full modes this is computed from atmospheric gases automatically.",
  "Greenhouse Mode":
    "Core — greenhouse computed from CO₂, H₂O, and CH₄ with pressure broadening.\n\nFull — adds H₂, SO₂, and NH₃ (expert gases) to the greenhouse model.\n\nManual — set the greenhouse effect directly via the slider.",
  "Water Vapor (H\u2082O)":
    "Average column water-vapor fraction. Earth averages ~0.4%. Treated as a user input rather than a feedback gas to avoid circular temperature dependence.\n\nH₂O is the strongest greenhouse gas by total contribution on Earth (~50% of the greenhouse effect).",
  "Methane (CH\u2084)":
    "Atmospheric methane fraction. Earth ≈ 0.00018% (1.8 ppm). Titan ≈ 5%.\n\nCH₄ absorbs in the 7.7 µm IR band with square-root forcing (IPCC TAR).",
  "Hydrogen (H\u2082)":
    "Atmospheric hydrogen fraction (Full mode). Greenhouse effect via collision-induced absorption with N₂ (Wordsworth & Pierrehumbert 2013). Important for reducing/primordial atmospheres and early-Earth scenarios.",
  "Helium (He)":
    "Atmospheric helium fraction (Full mode). No greenhouse effect — helium is IR-transparent. Affects mean molecular weight and scale height only.",
  "Sulfur Dioxide (SO\u2082)":
    "Atmospheric SO₂ fraction (Full mode). Strong 7.3 µm and 8.7 µm IR absorber. Relevant for volcanic worlds. Venus has ~150 ppm.",
  "Ammonia (NH\u2083)":
    "Atmospheric ammonia fraction (Full mode). Potent greenhouse gas absorbing at 10.5 µm (atmospheric window). Rapidly photodissociated by UV, so sustained levels require an active source.",
  "Height of Observer":
    "Observer elevation above sea level in metres, used to compute horizon distance.",
  "Orbit & Rotation":
    "Orbital and rotational inputs used for year length, seasons, and climate-related outputs.",
  "Rotation Period":
    "Sidereal rotation period (day length) in Earth hours.\n\nHabitable range: ~6\u201348 hours.\n\nEarth = 23.93 hours.",
  "Semi-Major axis":
    "Orbital distance from the host star in AU. Habitable planets should lie within the habitable zone.\n\nEarth = 1 AU = ~150,000,000 km",
  Eccentricity:
    "Orbital eccentricity (0\u20131). 0 = circular, 1 = parabolic.\n\nLow eccentricities keep the planet within the habitable zone year-round.\n\nEarth = 0.0167",
  Inclination:
    "Orbital inclination relative to the primary habitable world\u2019s orbital plane.\n\nPrimary habitable world = 0\u00b0. Other worlds: 0\u2013180\u00b0 (lower values indicate a flatter system).",
  "Longitude of Periapsis":
    "Geocentric longitude of periapsis in degrees (0\u2013360\u00b0).\n\nEarth \u2248 283\u00b0.",
  "Subsolar Longitude":
    "Longitude of the subsolar point at the vernal equinox in degrees (0\u2013360\u00b0). Controls the phase offset of the seasonal cycle.",
  Atmosphere:
    "Atmospheric composition and pressure inputs for derived climate and density outputs.\n\nN₂ is derived: 100% minus all other gases. If the sum exceeds 100%, N₂ is clamped to 0%.",
  "Atmospheric Pressure":
    "Sea-level atmospheric pressure in standard atmospheres.\n\nEarth = 1 atm.",
  "Oxygen (O2)":
    "Oxygen partial pressure. Habitable range: 0.16\u20130.5 atm.\n\nEarth \u2248 0.21 atm.",
  "Carbon Dioxide (CO2)":
    "Carbon dioxide partial pressure. Habitable limit: < 0.02 atm (optimal < 0.005 atm).\n\nEarth \u2248 0.0004 atm (420 ppm).",
  "Argon (Ar)": "Argon partial pressure. Habitable limit: < 1.6 atm.\n\nEarth \u2248 0.0094 atm.",
  "Atmospheric Escape":
    "Atmospheric escape analysis combining Jeans thermal escape with non-thermal processes (charge exchange, polar wind, ion pickup).\n\nComputes the Jeans escape parameter \u03BB for each gas species based on escape velocity and exobase temperature. For H\u2082 and He, enhanced thresholds account for non-thermal loss channels that operate on all warm terrestrial planets (T_exo > 100 K).\n\nWhen enabled, gases classified as \u2018Lost\u2019 are automatically zeroed before computing greenhouse effect, partial pressures, and density. The original composition inputs are preserved.\n\nExobase temperature includes a pressure-dependent XUV absorption term \u2014 thin atmospheres absorb less XUV.\n\nH\u2082: Retained \u03BB \u2265 18 | Marginal 9\u201318 | Lost < 9\nHe: Retained \u03BB \u2265 30 | Marginal 15\u201330 | Lost < 15\nOthers: Retained \u03BB \u2265 6 | Marginal 3\u20136 | Lost < 3",
  "Vegetation override":
    "Override the auto-calculated vegetation colours with manually chosen pale and deep hex values. In Auto mode, colours are derived from the star's spectrum, atmospheric pressure, insolation, and tidal lock status.",
  "Internal Heat":
    "Radioisotope abundance relative to Earth. Scales four geophysics formulas: volcanic activity, elastic lithosphere thickness, internal heat budget, and core solidification timescale.\n\nHigher abundance sustains volcanism longer, thins the lithosphere, and extends dynamo lifetime. Default is 1.0\u00d7 (Earth).",
  "Radioisotope Abundance":
    "Bulk radioisotope abundance as a single multiplier of Earth\u2019s present-day radiogenic heat production (44 TW).\n\nRange: 0.1\u20133.0\u00d7 Earth.",
  "U-238":
    "Uranium-238 abundance relative to Earth. Contributes 39% of Earth\u2019s radiogenic heat.\n\nt\u00bd = 4.47 Gyr. Range: 0.0\u20135.0\u00d7.",
  "U-235":
    "Uranium-235 abundance relative to Earth. Contributes 4% of Earth\u2019s radiogenic heat.\n\nt\u00bd = 0.70 Gyr. Range: 0.0\u20135.0\u00d7.",
  "Th-232":
    "Thorium-232 abundance relative to Earth. Contributes 40% of Earth\u2019s radiogenic heat.\n\nt\u00bd = 14.05 Gyr. Range: 0.0\u20135.0\u00d7.",
  "K-40":
    "Potassium-40 abundance relative to Earth. Contributes 17% of Earth\u2019s radiogenic heat.\n\nt\u00bd = 1.25 Gyr. Range: 0.0\u20135.0\u00d7.",
  Moons: "Major moons currently assigned to this body.",

  // ── Rocky planet outputs ──
  Appearance:
    "Physics-driven visual of the planet from space. Surface colour, oceans, ice caps, clouds, and terrain are derived from composition, water regime, temperature, pressure, and tectonics.\n\nClick Recipes to browse preset input combinations for different planet types.",
  Composition:
    "Interior composition class derived from Core Mass Fraction (CMF) and Water Mass Fraction (WMF).\n\nIron world: CMF > 60% (Mercury-like interior)\nMercury-like: CMF 45\u201360%\nEarth-like: CMF 25\u201345%\nMars-like: CMF 10\u201325%\nCoreless: CMF < 10%\nOcean world: WMF 0.1\u201310%\nIce world: WMF > 10%",
  "Core Radius":
    "Core radius as a fraction of the total planetary radius. Estimated via CRF \u2248 CMF^0.5 (Zeng & Jacobsen 2017).\n\nEarth: CRF \u2248 0.55 (core radius ~3,485 km).",
  "Water Regime":
    "Surface water state derived from water mass fraction (WMF).\n\nDry: < 0.01% WMF\nShallow oceans: 0.01\u20130.1% WMF (Earth ~0.02%\u2014thin but widespread oceans)\nExtensive oceans: 0.1\u20131% WMF (deeper oceans, less exposed land)\nGlobal ocean: 1\u201310% WMF (no exposed land)\nDeep ocean: 10\u201330% WMF (high-pressure ice at seafloor)\nIce world: > 30% WMF",
  "Climate State":
    "Global climate stability classification based on surface temperature and absorbed stellar flux.\n\nStable: normal climate regime.\nSnowball: global glaciation from ice-albedo feedback (T < 240 K with surface water).\nMoist greenhouse: stratospheric water vapour enables hydrogen escape, risking long-term ocean loss (T > 340 K).\nRunaway greenhouse: absorbed flux exceeds the outgoing radiation limit; surface water boils off (flux > 282 W/m\u00b2).\n\nDry worlds are always classified as Stable.\n\nReference: Goldblatt et al. (2013); Kasting (1988); Budyko (1969).",
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
    "Estimated daytime sky colour near local noon based on stellar spectrum, surface pressure, gravity, temperature, and atmospheric composition.\n\nLower gravity or higher temperature increases the atmospheric column depth, shifting colours toward thicker-atmosphere entries. CO₂-rich atmospheres receive a warm amber tint.",
  "Sky colour (low sun)":
    "Estimated sky colour near the horizon based on stellar spectrum, surface pressure, gravity, temperature, and atmospheric composition.\n\nThe same column-density and CO₂ corrections apply as for the high-sun colour.",
  Details:
    "Detailed derived outputs and atmospheric composition values.\n\nIncludes a guardrail note when O2 + CO2 + Ar exceeds 100% and N2 is clamped to 0%.",
  Insolation:
    "Stellar energy received at the planet's orbit relative to Earth. Insolation = L☉ / d² where L is stellar luminosity and d is the semi-major axis in AU.\n\nEarth = 1.0× by definition.",
  "Tidal lock":
    "Estimated tidal-evolution state of the planet's rotation.\n\n• Synchronous (1:1) — rotation period equals orbital period (permanent day/night sides).\n• Spin-orbit resonance (3:2, 2:1, …) — higher-order lock driven by orbital eccentricity (Goldreich & Peale 1966). Mercury is a real 3:2 example.\n• Atmosphere-stabilised — thick atmospheres generate thermal tides that counteract gravitational locking (Leconte+ 2015). Venus is the classic case.\n• Otherwise shows the estimated time to despin (Love-number k₂ / quality-factor Q model).\n\nHigh eccentricity favours higher-order resonances; thick atmospheres resist all locking.",
  "In habitable zone":
    "Whether the planet's semi-major axis falls within the star's conservative habitable zone (liquid water on the surface). The HZ boundaries use temperature-dependent Seff polynomials.",
  "Liquid water":
    "Whether the average surface temperature and pressure allow liquid water to exist. Checks against the water phase diagram: pressure ≥ triple point (0.006 atm) and temperature between freezing (273 K) and the pressure-dependent boiling point.",
  "Temp at periapsis":
    "Equilibrium temperature (no greenhouse) at the closest orbital approach. Uses the same blackbody formula as average T_eq but substitutes the periapsis distance. Only shown for eccentric orbits (e > 0.005).",
  "Nearest resonance":
    "Checks whether this body\u2019s orbit lies close to a mean-motion resonance with a system gas giant. Shows the closest p:q ratio, the exact resonance distance, and how far off the planet is (%). Example: Pluto is in Neptune\u2019s 3:2 resonance.",
  "Volatile ices":
    "For dwarf planets (mass < 0.01 M\u2295), checks whether surface ices (N\u2082, CO, CH\u2084, H\u2082O, CO\u2082) can sublimate at periapsis and apoapsis temperatures. Transient atmospheres form when periapsis is warm enough to sublimate but apoapsis is not.",
  "Vegetation colour":
    "Estimated plant/vegetation colour based on photosynthetic pigment adaptation to the host star's spectrum.\n\nHotter stars (F/A) → plants absorb UV/blue and reflect yellow-orange.\nSun-like stars (G) → green, like Earth.\nCool stars (K) → dark green/teal, broader absorption.\nRed dwarfs (M) → near-black, absorbing all available light.\n\nGradient shows low concentration (pale) → high concentration (deep).\n\nReferences: Kiang (2007), Lehmer et al. (2021), Arp et al. (2020), PanoptesV.",
  "Vegetation colour (twilight)":
    "Plant colours adapted to the permanent twilight zone on tidally locked worlds. Only shown for K/M star planets that are tidally locked.\n\nOrganisms at the terminator receive only scattered and refracted starlight, so pigments are paler and more tan/brown.",
  "Atmospheric circulation": "Derived circulation-cell summary for the current planet.",
  "Derived atmosphere":
    "Atmospheric pressure, composition, partial pressures, and escape analysis.",

  // ── Gas giant inputs ──
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
  "GG Eccentricity":
    "Orbital eccentricity (0 = circular, 0.99 = nearly parabolic). Affects periapsis/apoapsis distances, equilibrium temperature variation, and tidal circularisation timescale.\n\nJupiter e = 0.048, Saturn e = 0.054, HD 80606b e = 0.93.",
  "GG Inclination":
    "Orbital inclination relative to the reference plane (0\u2013180\u00b0). Inclination > 90\u00b0 indicates a retrograde orbit.\n\nMost solar system giants have inclinations < 3\u00b0.",
  "GG Axial Tilt":
    "Obliquity \u2014 the angle between the rotation axis and the orbital normal (0\u2013180\u00b0). Affects seasonal atmospheric variation and ring illumination geometry.\n\nJupiter 3.1\u00b0, Saturn 26.7\u00b0, Uranus 97.8\u00b0, Neptune 28.3\u00b0.",
  "GG Insolation":
    "Stellar energy received relative to Earth (L\u2609 / d\u00b2). Drives cloud formation, Sudarsky classification, and weather patterns.",
  "GG Nearest Resonance":
    "Checks whether this gas giant\u2019s orbit lies close to a mean-motion resonance with another gas giant in the system. Example: Jupiter and Saturn are near a 5:2 resonance.",

  // ── Gas giant outputs ──
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
  "GG Magnetic Field":
    "Surface dipole field from Christensen (2009) energy-flux dynamo scaling, self-normalised to Jupiter (4.28 G).\n\nAccounts for: bulk density, internal heat flux (with 0.2 W/m\u00b2 compositional convection floor), dynamo shell geometry (metallic hydrogen depth for gas giants, ionic ocean for ice giants), and conductivity regime.\n\nGas giants: dipolar fields (deep metallic-H shell).\nIce giants: multipolar fields (thin ionic conducting shell).\n\nMoon tidal heating contributes to the heat flux driving the dynamo.",
  "GG Moon Tidal":
    "Tidal heating deposited on the gas giant by orbiting moons (Peale et al. 1979). Uses fluid Love number k\u2082 (Wahl+ 2016, Lainey+ 2017) and tidal quality factor Q. Jupiter Q \u2248 10\u2075, Saturn Q \u2248 3\u00d710\u00b3 (resonance locking, Fuller+ 2016). Fraction is relative to the giant's intrinsic internal heat flux.",
  "GG Mass Loss":
    "Energy-limited atmospheric escape driven by stellar XUV radiation (Ribas et al. 2005). Hot Jupiters at <0.1 AU can lose >10\u2076 kg/s. Evaporation timescale \u226b Hubble time for most giants. Roche lobe overflow flags planets exceeding the Eggleton (1983) tidal radius.",
  "GG Jeans Escape":
    "Per-species Jeans escape for the gas giant\u2019s atmosphere. The Jeans parameter \u03bb = v_esc\u00b2 \u00d7 m / (2 R T_exo) measures how firmly each species is bound at the exobase.\n\n\u03bb \u2265 6: Retained. 3 \u2264 \u03bb < 6: Marginal. \u03bb < 3: Lost.\n\nH\u2082 and He experience non-thermal escape (charge exchange, ion pickup) which raises effective retention thresholds.\n\nGas giant exobase temperature accounts for extended H\u2082/He envelope XUV absorption. Hot Jupiters can reach T_exo \u2248 10,000 K (hydrodynamic blow-off).\n\nReferences: Jeans (1925), Murray-Clay et al. (2009, ApJ 693, 23).",
  "GG Interior":
    "Heavy-element budget from Thorngren et al. (2016): M_Z = 49.3 \u00d7 (M/Mj)^0.61 M\u2295. Core mass capped at 25 M\u2295 per Juno constraints. Bulk metallicity Z = M_Z / M_total.",
  "GG Suggested Radius":
    "Age-dependent radius from Fortney et al. (2007) cooling models. Young systems have inflated radii; old systems contract toward baseline. Hot Jupiters (T_eq > 1000 K) receive an extra proximity inflation of 0.1\u20130.3 Rj.",
  "GG Ring Properties":
    "Ring composition depends on equilibrium temperature: icy (<150 K), mixed (150\u2013300 K), or rocky (>300 K). Mass scaled from Saturn\u2019s rings. Optical depth classified as Dense (\u03c4 > 1), Moderate (0.1\u20131), or Tenuous (< 0.1).",
  "GG Tidal":
    "Tidal locking timescale \u221d a\u2076: hot Jupiters at <0.05 AU lock within ~1 Gyr. Circularisation timescale \u221d a^6.5. Both compared to the host star\u2019s age to determine current state.",
};

/* ── Helpers ─────────────────────────────────────────────────────── */

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

/* ── Page ────────────────────────────────────────────────────────── */

const TUTORIAL_STEPS = [
  {
    title: "Getting Started",
    body:
      "The Planets page configures rocky planets and gas giants. Select a body " +
      "from the dropdown at the top, or create a new one. Inputs are on the " +
      "left; derived outputs update live on the right.",
  },
  {
    title: "Creating Bodies",
    body:
      "Click New Rocky Planet or New Gas Giant. Assign each body to an orbital " +
      "slot, then give it a name. The Delete button removes the selected body.",
  },
  {
    title: "Mass and Composition",
    body:
      "For rocky planets, set Mass, Core Mass Fraction (CMF), and Water Mass " +
      "Fraction (WMF). The Auto button for CMF derives a value from stellar " +
      "metallicity. Composition class and radius are computed from these.",
  },
  {
    title: "Orbit and Rotation",
    body:
      "Set semi-major axis, eccentricity, inclination, and rotation period. " +
      "These determine year length, tidal locking, and day/night cycles. " +
      "Habitable zone status appears in outputs.",
  },
  {
    title: "Atmosphere",
    body:
      "Set atmospheric pressure and gas composition. Choose a greenhouse mode: " +
      "Core uses CO\u2082/H\u2082O/CH\u2084, Full adds expert gases, Manual lets you set " +
      "the effect directly. Toggle atmospheric escape to model gas loss.",
  },
  {
    title: "Surface and Interior",
    body:
      "Choose a tectonic regime, set mantle oxidation, and configure internal " +
      "heat. Vegetation colours can be auto-derived from star type or set " +
      "manually. These shape the planet\u2019s visual appearance.",
  },
  {
    title: "Gas Giants",
    body:
      "Gas giants use radius as the primary input; mass and metallicity can be " +
      "auto-derived. Sudarsky class, ring type, and atmospheric bands are " +
      "computed from temperature and composition.",
  },
  {
    title: "Recipes",
    body:
      "Click Recipes on the appearance preview to apply preset configurations. " +
      "Recipes set multiple inputs at once for quick planet archetypes like " +
      "ocean worlds, desert planets, or ice giants.",
  },
];

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
        <button id="planetTutorials" type="button" class="ws-tutorial-trigger">Tutorials</button>
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
  createTutorial({
    steps: TUTORIAL_STEPS,
    storageKey: "worldsmith.planet.tutorial",
    container: wrap,
    triggerBtn: wrap.querySelector("#planetTutorials"),
  });

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

  bodyMoonsEl.addEventListener("click", (event) => {
    const addMoonBtn = event.target.closest?.("#addMoonToBody");
    if (addMoonBtn) {
      const bodyType = addMoonBtn.dataset.bodyType || "planet";
      const bodyId = addMoonBtn.dataset.bodyId || "";
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
      return;
    }

    const editMoonBtn = event.target.closest?.("button[data-action='edit-moon']");
    if (!editMoonBtn) return;
    const moonId = editMoonBtn.dataset.moonId || editMoonBtn.getAttribute("data-moon-id");
    if (!moonId) return;
    selectMoon(moonId);
    location.hash = "#/moon";
  });

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

  function renderHint(container, text) {
    const hint = document.createElement("div");
    hint.className = "hint";
    hint.textContent = text;
    container.replaceChildren(hint);
  }

  /* ── Body selector ──────────────────────────────────────────────── */

  function populateBodySelector(world) {
    const bodyType = world.selectedBodyType || "planet";
    const entries = buildBodySelectorEntries(listPlanets(world), listSystemGasGiants(world));

    const selectedId =
      bodyType === "gasGiant" ? world.system?.gasGiants?.selectedId : world.planets?.selectedId;
    const selectedValue =
      bodyType === "gasGiant" ? `gasGiant:${selectedId}` : `planet:${selectedId}`;

    renderBodySelector(bodySel, entries, selectedValue);
  }

  /* ── Rocky planet rendering ─────────────────────────────────────── */

  function renderRockyInputs(world, planet, sysModel) {
    if (!planet) {
      renderHint(bodyInputsEl, "No planet selected. Add a planet to get started.");
      return;
    }
    const p = planet.inputs || {};
    renderRockyInputForm(bodyInputsEl, { planet, tipLabels: TIP_LABEL });

    // Populate slot selector
    const slotSelectEl = bodyInputsEl.querySelector("#slotSelect");
    renderPlanetSlotSelector(slotSelectEl, {
      orbitsAu: sysModel.orbitsAu,
      planets: listPlanets(world),
      gasGiants: listSystemGasGiants(world),
      debrisDisks: listSystemDebrisDisks(world),
      planet,
    });

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
      isoAbundance: p.radioisotopeAbundance ?? 1,
      isoU238: p.u238Abundance ?? 1,
      isoU235: p.u235Abundance ?? 1,
      isoTh232: p.th232Abundance ?? 1,
      isoK40: p.k40Abundance ?? 1,
    };
    const sliderBindings = {
      mass: [0.0001, 1000, 0.0001],
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
      isoAbundance: [0.1, 3, 0.01],
      isoU238: [0, 5, 0.01],
      isoU235: [0, 5, 0.01],
      isoTh232: [0, 5, 0.01],
      isoK40: [0, 5, 0.01],
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
      isoAbundance: "radioisotopeAbundance",
      isoU238: "u238Abundance",
      isoU235: "u235Abundance",
      isoTh232: "th232Abundance",
      isoK40: "k40Abundance",
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
          commitOnInput: false,
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
    if (cmfEl && cmfIsAuto) {
      cmfEl.value = 32;
    } else if (cmfEl) {
      cmfEl.value = p.cmfPct ?? 32;
    }
    const cmfBinding = bindNumberAndSlider({
      numberEl: cmfEl,
      sliderEl: cmfSliderEl,
      min: 0,
      max: 100,
      step: 0.1,
      mode: "auto",
      commitOnInput: false,
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
    if (cmfEl && cmfBinding.ready) {
      cmfEl.dispatchEvent(new Event("input", { bubbles: true }));
    }
    updateCmfAutoState();

    if (cmfAutoBtn) {
      cmfAutoBtn.addEventListener("click", () => {
        cmfIsAuto = true;
        updateCmfAutoState();
        const w = loadWorld();
        const pid = w.planets.selectedId;
        updatePlanet(pid, { inputs: { cmfPct: -1 } });
        updateWorld({ planet: { cmfPct: -1 } });
        scheduleRender(true);
      });
    }

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

    // Atmospheric escape pill toggle
    const atmEscapePillsEl = bodyInputsEl.querySelector("#atmEscapePills");
    if (atmEscapePillsEl) {
      atmEscapePillsEl.addEventListener("change", () => {
        if (hydrating) return;
        const checked = atmEscapePillsEl.querySelector('input[name="atmEscape"]:checked');
        const on = checked?.value === "on";
        const w = loadWorld();
        updatePlanet(w.planets.selectedId, { inputs: { atmosphericEscape: on } });
        updateWorld({ planet: { atmosphericEscape: on } });
        scheduleRender();
      });
    }

    // Vegetation pill toggle + colour pickers
    const vegPillsEl = bodyInputsEl.querySelector("#vegModePills");
    const vegManual = bodyInputsEl.querySelector("#vegManualInputs");
    const vegPaleEl = bodyInputsEl.querySelector("#vegPaleColour");
    const vegDeepEl = bodyInputsEl.querySelector("#vegDeepColour");
    const vegPreview = bodyInputsEl.querySelector("#vegOverridePreview");

    const updateVegPreview = () => {
      if (vegPreview) {
        vegPreview.style.background = `linear-gradient(to right, ${vegPaleEl.value}, ${vegDeepEl.value})`;
      }
    };

    if (vegPillsEl) {
      vegPillsEl.addEventListener("change", () => {
        if (hydrating) return;
        const checked = vegPillsEl.querySelector('input[name="vegMode"]:checked');
        const on = checked?.value === "manual";
        if (vegManual) vegManual.style.display = on ? "" : "none";
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
    }

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

    // Internal Heat mode toggle
    const isoModePillsEl = bodyInputsEl.querySelector("#isoModePills");
    const isoSimpleEl = bodyInputsEl.querySelector("#isoSimpleInputs");
    const isoAdvancedEl = bodyInputsEl.querySelector("#isoAdvancedInputs");
    if (isoModePillsEl) {
      isoModePillsEl.addEventListener("change", () => {
        if (hydrating) return;
        const checked = isoModePillsEl.querySelector('input[name="isoMode"]:checked');
        const mode = checked ? checked.value : "simple";
        if (isoSimpleEl) isoSimpleEl.style.display = mode === "advanced" ? "none" : "";
        if (isoAdvancedEl) isoAdvancedEl.style.display = mode === "advanced" ? "" : "none";
        const w = loadWorld();
        const pid = w.planets.selectedId;
        updatePlanet(pid, { inputs: { radioisotopeMode: mode } });
        updateWorld({ planet: { radioisotopeMode: mode } });
        scheduleRender(true);
      });
    }

    // Effective abundance readout for per-isotope mode
    function updateIsoEffective() {
      const el = bodyInputsEl.querySelector("#isoEffective");
      if (!el) return;
      const u238El = bodyInputsEl.querySelector("#isoU238");
      const u235El = bodyInputsEl.querySelector("#isoU235");
      const th232El = bodyInputsEl.querySelector("#isoTh232");
      const k40El = bodyInputsEl.querySelector("#isoK40");
      const a =
        (Number(u238El?.value) || 1) * ISOTOPE_HEAT_FRACTIONS.u238 +
        (Number(u235El?.value) || 1) * ISOTOPE_HEAT_FRACTIONS.u235 +
        (Number(th232El?.value) || 1) * ISOTOPE_HEAT_FRACTIONS.th232 +
        (Number(k40El?.value) || 1) * ISOTOPE_HEAT_FRACTIONS.k40;
      el.textContent = `Effective abundance: ${fmt(Math.max(a, 0.01), 2)}\u00d7 Earth`;
    }
    // Update on any isotope slider input
    for (const id of ["isoU238", "isoU235", "isoTh232", "isoK40"]) {
      const el = bodyInputsEl.querySelector(`#${id}`);
      const slEl = bodyInputsEl.querySelector(`#${id}_slider`);
      if (el) el.addEventListener("input", updateIsoEffective);
      if (slEl) slEl.addEventListener("input", updateIsoEffective);
    }
    updateIsoEffective();

    hydrating = false;
  }

  function renderRockyOutputs(world) {
    const planet = getSelectedPlanet(world);
    if (!planet) {
      renderHint(bodyOutputsEl, "No planet selected.");
      return;
    }
    const assignedMoons = listMoons(world)
      .filter((m) => m.planetId === planet.id)
      .map((m) => m.inputs);
    const sov = getStarOverrides(world.star);
    const sysGiants = listSystemGasGiants(world).map((g) => ({
      name: g.name,
      au: g.au,
    }));
    const model = calcPlanetExact({
      starMassMsol: Number(world.star.massMsol),
      starAgeGyr: Number(world.star.ageGyr),
      starRadiusRsolOverride: sov.r,
      starLuminosityLsolOverride: sov.l,
      starTempKOverride: sov.t,
      starEvolutionMode: sov.ev,
      planet: planet.inputs,
      moons: assignedMoons,
      gasGiants: sysGiants,
    });
    const d = model.derived;
    const p = planet.inputs || {};
    const visualProfile = computeRockyVisualProfile(d, p);
    const vegDetailsBtn = document.createElement("button");
    vegDetailsBtn.type = "button";
    vegDetailsBtn.className = "veg-details-btn";
    vegDetailsBtn.id = "btn-veg-details";
    vegDetailsBtn.textContent = "Details";

    // Update CMF input when in auto mode
    if (d.cmfIsAuto) {
      cmfIsAuto = true;
      const resolved = model.inputs.cmfPct;
      if (cmfEl) cmfEl.value = Math.round(resolved * 10) / 10;
      if (cmfSliderEl) cmfSliderEl.value = resolved;
      updateCmfAutoState();
    }

    // Update effective abundance readout
    const isoEffEl = bodyInputsEl.querySelector("#isoEffective");
    if (isoEffEl) {
      const a = d.radioisotopeAbundance;
      isoEffEl.textContent = `Effective abundance: ${fmt(Math.max(a, 0.01), 2)}\u00d7 Earth`;
    }

    const items = [
      {
        label: "Appearance",
        value: d.compositionClass,
        meta: d.waterRegime,
        isRockyPreview: true,
      },
      {
        label: "Body Class",
        value: model.display.bodyClass,
        meta:
          model.display.bodyClass === "Dwarf planet"
            ? `Mass below 0.1 M\u2295 (${fmt(model.inputs.massEarth, 4)} M\u2295)`
            : "",
      },
      {
        label: "Composition",
        value: model.display.compositionClass,
        meta: `CMF ${fmt(model.inputs.cmfPct, 1)}%${d.cmfIsAuto ? " (auto)" : ""}, WMF ${fmt(model.inputs.wmfPct, 2)}%`,
      },
      { label: "Radius", value: model.display.radius },
      { label: "Density", value: model.display.density },
      { label: "Gravity", value: model.display.gravity },
      { label: "Escape Velocity", value: model.display.escape },
      {
        label: "Magnetic Field",
        value: model.display.magneticField,
        meta: d.dynamoActive
          ? `${model.display.fieldMorphology}, ${d.coreState}` +
            (d.planetTidalFraction > 0.1 ? " (tidally sustained)" : "")
          : d.dynamoReason,
      },
      {
        label: "Avg Surface Temp",
        tipLabel: "Surface Temperature (Avg.)",
        value: model.display.tempK,
        meta: model.display.tempC,
      },
      {
        label: "Climate State",
        value: model.display.climateState,
        meta: `Absorbed flux: ${model.display.absorbedFlux}`,
      },
      {
        label: "Year Length",
        tipLabel: "Year length",
        value: model.display.yearDays,
        meta: model.display.localDays,
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
      { label: "Horizon Distance", value: model.display.horizon },
      {
        label: "Star Apparent Size",
        tipLabel: "Star apparent size",
        value: model.display.apparentStar,
      },
      {
        label: "Sky Colour (Sun High)",
        tipLabel: "Sky colour (sun high)",
        value: d.skyColourDayHex || "-",
        meta: "Hex (spectrum + pressure + gravity + CO₂)",
        kpiClass: "kpi--colour",
        kpiDataset: {
          gradient: "radial",
          light: relativeLuminance(d.skyColourDayHex) > 0.18 ? "1" : "0",
        },
        kpiStyle: {
          "--kpi-colour": d.skyColourDayHex || "#93B6FF",
          "--kpi-colour-center": d.skyColourDayHex || "#93B6FF",
          "--kpi-colour-edge": d.skyColourDayEdgeHex || d.skyColourDayHex || "#CFE8FF",
        },
      },
      {
        label: "Sky Colour (Low Sun)",
        tipLabel: "Sky colour (low sun)",
        value: d.skyColourHorizonHex || "-",
        meta: "Hex (spectrum + pressure + gravity + CO₂)",
        kpiClass: "kpi--colour",
        kpiDataset: {
          gradient: "radial",
          horizon: "1",
          light: relativeLuminance(d.skyColourHorizonHex) > 0.18 ? "1" : "0",
        },
        kpiStyle: {
          "--kpi-colour": d.skyColourHorizonHex || "#0B1020",
          "--kpi-colour-center": d.skyColourHorizonHex || "#0B1020",
          "--kpi-colour-edge": d.skyColourHorizonEdgeHex || d.skyColourHorizonHex || "#D6B06B",
        },
      },
      {
        label: "Vegetation Colour",
        tipLabel: "Vegetation colour",
        value: `${d.vegetationPaleHex} → ${d.vegetationDeepHex}`,
        metaChildren: [d.vegetationNote, " ", vegDetailsBtn],
        kpiClass: "kpi--colour",
        kpiDataset: {
          gradient: "linear",
          light: relativeLuminance(d.vegetationPaleHex) > 0.18 ? "1" : "0",
        },
        kpiStyle: {
          background: `linear-gradient(to right, ${(d.vegetationStops || [d.vegetationPaleHex, d.vegetationDeepHex]).join(", ")})`,
        },
      },
    ];

    // Twilight vegetation KPI (only for tidally locked K/M worlds)
    if (d.vegetationTwilightPaleHex) {
      items.push({
        label: "Vegetation (Twilight)",
        tipLabel: "Vegetation colour (twilight)",
        value: `${d.vegetationTwilightPaleHex} → ${d.vegetationTwilightDeepHex}`,
        meta: "Terminator-zone adapted",
        kpiClass: "kpi--colour",
        kpiDataset: {
          gradient: "linear",
          light: relativeLuminance(d.vegetationTwilightPaleHex) > 0.18 ? "1" : "0",
        },
        kpiStyle: {
          background: `linear-gradient(to right, ${(d.vegetationTwilightStops || [d.vegetationTwilightPaleHex, d.vegetationTwilightDeepHex]).join(", ")})`,
        },
      });
    }

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

    // Jeans escape retention lines
    const je = d.jeansEscape;
    let jeansLines = "";
    if (je) {
      jeansLines = `\n\nAtmospheric escape (T_exo ${fmt(je.exobaseTempK, 0)} K, XUV ${fmt(je.xuvFluxRatio, 2)}\u00d7 Earth):`;
      const gasKeys = ["n2", "o2", "co2", "ar", "h2o", "ch4", "h2", "he", "so2", "nh3"];
      const gasLabels = {
        n2: "N\u2082",
        o2: "O\u2082",
        co2: "CO\u2082",
        ar: "Ar",
        h2o: "H\u2082O",
        ch4: "CH\u2084",
        h2: "H\u2082",
        he: "He",
        so2: "SO\u2082",
        nh3: "NH\u2083",
      };
      for (const key of gasKeys) {
        const sp = je.species[key];
        const pct = key === "n2" ? d.n2Pct : Number(p[key + "Pct"]) || 0;
        if (pct > 0 || (je.atmosphericEscape && je.stripped.includes(key))) {
          const ntTag = sp.nonThermal ? " (non-thermal)" : "";
          const tag =
            je.atmosphericEscape && sp.status === "Lost"
              ? " [STRIPPED]"
              : sp.status === "Marginal"
                ? " [!]"
                : "";
          jeansLines += `\n  ${gasLabels[key]}: \u03BB=${fmt(sp.lambda, 1)} \u2014 ${sp.status}${ntTag}${tag}`;
        }
      }
      if (je.stripped.length > 0) {
        jeansLines += `\nStripped gases: ${je.stripped.map((k) => gasLabels[k] || k).join(", ")}`;
      }
    }

    // Capture the existing canvas before replacing children to preserve WebGL context
    const prevRockyCanvas = bodyOutputsEl.querySelector(".rocky-preview-canvas");
    const kpiGrid = createKpiGrid(
      items.filter(Boolean).map((item) => {
        if (item.isRockyPreview) {
          return {
            kind: "preview",
            label: item.label,
            tip: TIP_LABEL[item.label] || "",
            actions: [
              { className: "small rp-recipe-btn", text: "Recipes" },
              { className: "small rp-pause-btn", text: "Pause" },
            ],
            canvasClass: "rocky-preview-canvas",
            meta: `${item.value} — ${item.meta || ""}`,
          };
        }
        return {
          label: item.label,
          tip: TIP_LABEL[item.tipLabel] || TIP_LABEL[item.label] || "",
          value: item.value,
          meta: item.meta,
          metaChildren: item.metaChildren,
          kpiClass: item.kpiClass,
          kpiDataset: item.kpiDataset,
          kpiStyle: item.kpiStyle,
        };
      }),
    );
    const readoutSections = createReadoutSections([
      {
        title: "Orbit & habitability",
        tip: TIP_LABEL["Details"],
        lines: [
          `Habitable zone: ${model.display.hz}`,
          `In habitable zone: ${d.inHabitableZone ? "Yes" : "No"}`,
          `Insolation: ${model.display.insolation}`,
          `Tidal lock: ${model.display.tidalLock}`,
          d.planetTidalHeatingW > 0 && !model.display.moonTidalHeating
            ? `Moon tidal heating: negligible (${fmt(d.planetTidalHeatingEarth, 4)}\u00d7 Earth geothermal)`
            : null,
          `Liquid water: ${d.liquidWaterPossible ? "Possible" : "Unlikely"}`,
          `Rotation direction: ${d.rotationDirection}`,
          `Tropics: ${d.tropics}\u00b0 N/S`,
          `Polar circles: ${d.polarCircles}\u00b0 N/S`,
          `Periapsis: ${model.display.peri}${model.display.tempPeri ? ` (T\u2091q ${model.display.tempPeri})` : ""}`,
          `Apoapsis: ${model.display.apo}${model.display.tempApo ? ` (T\u2091q ${model.display.tempApo})` : ""}`,
          `Nearest resonance: ${model.display.resonance}`,
          model.display.volatileSummary ? `Volatile ices: ${model.display.volatileSummary}` : null,
        ],
      },
      {
        title: "Atmosphere",
        tip: TIP_LABEL["Derived atmosphere"],
        lines: [
          ghModeLine,
          `Atmospheric pressure: ${model.display.pressureKpa}`,
          gasMixLine,
          ppLine,
          `Atmospheric weight: ${model.display.atmWeight}`,
          `Atmospheric density: ${model.display.atmDensity}${gasMixNote}`,
          jeansLines,
        ],
      },
      {
        title: "Atmospheric circulation",
        tip: TIP_LABEL["Atmospheric circulation"],
        lines: [
          `Cell count: ${d.circulationCellCount}`,
          d.circulationCellRanges.length
            ? d.circulationCellRanges.map((cell) => `${cell.name}: ${cell.rangeDegNS}\u00b0 N/S`)
            : "-",
        ],
      },
    ]);
    bodyOutputsEl.replaceChildren(kpiGrid, ...readoutSections);

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
    if (tecBar) renderTectonicProbabilityBar(tecBar, d.tectonicProbabilities);

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

  /* ── Vegetation info dialog ─────────────────────────────────────── */

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

  function buildVegGridModel() {
    const headers = VEG_GRID_PRESSURES.map((pressureAtm) => ({
      label: `${pressureAtm} atm`,
      extrapolated: pressureAtm < 1 || pressureAtm > 10,
    }));

    const rows = VEG_GRID_STARS.map((star) => ({
      starLabel: star.label,
      cells: VEG_GRID_PRESSURES.map((pressureAtm) => {
        const result = calcPlanetExact({
          starMassMsol: star.mass,
          starAgeGyr: star.age,
          planet: {
            ...VEG_GRID_PLANET,
            pressureAtm,
            semiMajorAxisAu: vegGridOrbit(star.mass),
          },
        });
        const derived = result.derived;
        return {
          stops: derived.vegetationStops || [derived.vegetationPaleHex, derived.vegetationDeepHex],
          label: `${derived.vegetationPaleHex} → ${derived.vegetationDeepHex}`,
        };
      }),
    }));

    const twilightRows = [];
    for (const star of VEG_GRID_STARS.filter((entry) => entry.mass <= 0.79)) {
      const orbit = vegGridTwilightOrbit(star.mass);
      const probe = calcPlanetExact({
        starMassMsol: star.mass,
        starAgeGyr: star.age,
        planet: { ...VEG_GRID_PLANET, pressureAtm: 1, semiMajorAxisAu: orbit },
      });
      if (!probe.derived.vegetationTwilightPaleHex) continue;

      twilightRows.push({
        starLabel: star.label,
        cells: VEG_GRID_PRESSURES.map((pressureAtm) => {
          const result = calcPlanetExact({
            starMassMsol: star.mass,
            starAgeGyr: star.age,
            planet: { ...VEG_GRID_PLANET, pressureAtm, semiMajorAxisAu: orbit },
          });
          const derived = result.derived;
          if (!derived.vegetationTwilightPaleHex) {
            return { label: "-" };
          }
          return {
            stops: derived.vegetationTwilightStops || [
              derived.vegetationTwilightPaleHex,
              derived.vegetationTwilightDeepHex,
            ],
            label: `${derived.vegetationTwilightPaleHex} → ${derived.vegetationTwilightDeepHex}`,
          };
        }),
      });
    }

    return { headers, rows, twilightRows };
  }

  function openVegInfoDialog(v) {
    const pAtm = Number(v.pressureAtm) || 1;
    const isExtrapolated = pAtm > 10 || pAtm < 1;
    const overlay = createVegetationInfoOverlay({
      paleHex: v.paleHex,
      deepHex: v.deepHex,
      note: v.note,
      pressureAtm: pAtm,
      isExtrapolated,
      stops: v.stops,
      twilight: v.twilightPaleHex
        ? {
            paleHex: v.twilightPaleHex,
            deepHex: v.twilightDeepHex,
            stops: v.twilightStops,
          }
        : null,
    });
    document.body.appendChild(overlay);

    // Lazy-build the reference grid on first toggle
    const gridToggle = overlay.querySelector("#btn-veg-grid-toggle");
    const gridContainer = overlay.querySelector("#veg-grid-container");
    const dialog = overlay.querySelector(".veg-info-dialog");
    let gridBuilt = false;

    gridToggle?.addEventListener("click", () => {
      const showing = !gridContainer.hidden;
      if (showing) {
        gridContainer.hidden = true;
        gridToggle.textContent = "Show grid";
        if (dialog) dialog.style.width = "";
      } else {
        if (!gridBuilt) {
          renderVegetationGrid(gridContainer, buildVegGridModel());
          gridBuilt = true;
        }
        gridContainer.hidden = false;
        gridToggle.textContent = "Hide grid";
        if (dialog) dialog.style.width = "min(960px, calc(100vw - 36px))";
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

  /* ── Gas giant rendering ────────────────────────────────────────── */

  function renderGasGiantInputs(world, giant, sysModel) {
    if (!giant) {
      renderHint(bodyInputsEl, "No gas giant selected.");
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

    const slotOptions = [{ value: "", label: "Custom orbit", selected: !giant.slotIndex }];
    for (let i = 0; i < 20; i++) {
      const slot = i + 1;
      const au = orbitsAu[i];
      const occupiedByPlanet = planetSlots.has(slot);
      const occupiedByGG = ggSlotMap.has(slot) && ggSlotMap.get(slot) !== giant.id;
      const disabled = occupiedByPlanet || occupiedByGG;
      const tag = occupiedByPlanet ? " (planet)" : occupiedByGG ? " (giant)" : "";
      slotOptions.push({
        value: String(slot),
        disabled,
        selected: giant.slotIndex === slot,
        label: `Slot ${slot} \u2014 ${fmt(au, 2)} AU${tag}`,
      });
    }
    renderGasGiantInputForm(bodyInputsEl, {
      giant: {
        ...giant,
        radiusRj: clampGasGiantRadiusRj(giant.radiusRj),
      },
      slotHint: giant.slotIndex
        ? `Slot ${giant.slotIndex} \u2014 ${fmt(orbitsAu[giant.slotIndex - 1], 3)} AU`
        : `${fmt(Number(giant.au) || 0, 3)} AU (custom)`,
      slotOptions,
      tipLabels: TIP_LABEL,
      ranges: {
        radius: {
          min: GAS_GIANT_RADIUS_MIN_RJ,
          max: GAS_GIANT_RADIUS_MAX_RJ,
          step: GAS_GIANT_RADIUS_STEP_RJ,
        },
        mass: {
          min: GAS_GIANT_MASS_MIN_MJUP,
          max: GAS_GIANT_MASS_MAX_MJUP,
          step: GAS_GIANT_MASS_STEP_MJUP,
        },
        metallicity: {
          min: GAS_GIANT_METALLICITY_MIN,
          max: GAS_GIANT_METALLICITY_MAX,
          step: GAS_GIANT_METALLICITY_STEP,
        },
      },
    });
    const ggCustomAuRow = bodyInputsEl.querySelector("#ggAu")?.closest(".form-row");
    if (ggCustomAuRow) ggCustomAuRow.id = "ggCustomAuRow";

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
      const eccVal = bodyInputsEl.querySelector("#ggEcc").value;
      g.eccentricity = eccVal !== "" ? Number(eccVal) || null : null;
      const incVal = bodyInputsEl.querySelector("#ggInc").value;
      g.inclinationDeg = incVal !== "" ? Number(incVal) || null : null;
      const tiltVal = bodyInputsEl.querySelector("#ggTilt").value;
      g.axialTiltDeg = tiltVal !== "" ? Number(tiltVal) || null : null;
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
        eccentricity: g.eccentricity,
        inclinationDeg: g.inclinationDeg,
        axialTiltDeg: g.axialTiltDeg,
        rotationPeriodHours: g.rotationPeriodHours,
        metallicity: g.metallicity,
        otherGiants: now.filter((x) => x.id !== g.id).map((x) => ({ name: x.name, au: x.au })),
        moons: listMoons(loadWorld())
          .filter((mm) => mm.planetId === g.id)
          .map((mm) => mm.inputs),
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
      commitOnInput: false,
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
      commitOnInput: false,
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
      commitOnInput: false,
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
      commitOnInput: false,
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
      commitOnInput: false,
      onChange: () => {
        if (!hydrating) saveGiant();
      },
    });

    const eccEl = bodyInputsEl.querySelector("#ggEcc");
    const eccSlider = bodyInputsEl.querySelector("#ggEccSlider");
    bindNumberAndSlider({
      numberEl: eccEl,
      sliderEl: eccSlider,
      min: 0,
      max: 0.99,
      step: 0.001,
      mode: "auto",
      commitOnInput: false,
      onChange: () => {
        if (!hydrating) saveGiant();
      },
    });

    const incEl = bodyInputsEl.querySelector("#ggInc");
    const incSlider = bodyInputsEl.querySelector("#ggIncSlider");
    bindNumberAndSlider({
      numberEl: incEl,
      sliderEl: incSlider,
      min: 0,
      max: 180,
      step: 0.1,
      mode: "auto",
      commitOnInput: false,
      onChange: () => {
        if (!hydrating) saveGiant();
      },
    });

    const tiltEl = bodyInputsEl.querySelector("#ggTilt");
    const tiltSlider = bodyInputsEl.querySelector("#ggTiltSlider");
    bindNumberAndSlider({
      numberEl: tiltEl,
      sliderEl: tiltSlider,
      min: 0,
      max: 180,
      step: 0.1,
      mode: "auto",
      commitOnInput: false,
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
    [auEl, radiusEl, massEl, rotEl, metEl, eccEl, incEl, tiltEl].forEach((el) => {
      el.dispatchEvent(new Event("input", { bubbles: true }));
    });

    hydrating = false;
  }

  function renderGasGiantOutputs(world, giant, sysModel) {
    if (!giant) {
      renderHint(bodyOutputsEl, "No gas giant selected.");
      return;
    }
    const starData = {
      starMassMsol: Number(world.star.massMsol) || 1,
      starLuminosityLsol: sysModel.star.luminosityLsol,
      starAgeGyr: Number(world.star.ageGyr) || 4.6,
      starRadiusRsol: sysModel.star.radiusRsol,
    };
    const allGiants = listSystemGasGiants(world);
    const m = calcGasGiant({
      massMjup: giant.massMjup,
      radiusRj: giant.radiusRj,
      orbitAu: Number(giant.au) || sysModel.frostLineAu,
      eccentricity: giant.eccentricity,
      inclinationDeg: giant.inclinationDeg,
      axialTiltDeg: giant.axialTiltDeg,
      rotationPeriodHours: giant.rotationPeriodHours,
      metallicity: giant.metallicity,
      otherGiants: allGiants
        .filter((x) => x.id !== giant.id)
        .map((x) => ({ name: x.name, au: x.au })),
      moons: listMoons(world)
        .filter((mm) => mm.planetId === giant.id)
        .map((mm) => mm.inputs),
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
    const kpiGrid = createKpiGrid([
      {
        kind: "preview",
        label: "Appearance",
        tip: TIP_LABEL["Sudarsky"] || "",
        actions: [
          { className: "small gg-recipe-btn", text: "Recipes" },
          { className: "small gg-pause-btn", text: "Pause" },
        ],
        canvasClass: "gg-preview-canvas",
        canvasDataset: {
          style: derivedStyle,
          rings: String(showRings),
        },
        meta: `${styleLabel(derivedStyle)} — Class ${m.classification.sudarsky}`,
      },
      {
        label: "Mass",
        tip: TIP_LABEL["GG Mass"] || "",
        value: m.display.mass,
        meta: massNote,
      },
      {
        label: "Metallicity",
        tip: TIP_LABEL["GG Metallicity"] || "",
        value: m.display.metallicity,
        meta: metNote,
      },
      {
        label: "Radius",
        tip: TIP_LABEL["GG Output Radius"] || "",
        value: m.display.radius,
        meta: radiusNote,
      },
      {
        label: "Density",
        tip: TIP_LABEL["GG Density"] || "",
        value: m.display.density,
      },
      {
        label: "Gravity",
        tip: TIP_LABEL["GG Gravity"] || "",
        value: m.display.gravity,
      },
      {
        label: "Escape Velocity",
        tip: TIP_LABEL["GG Escape Velocity"] || "",
        value: m.display.escapeVelocity,
      },
      {
        label: "Magnetic Field",
        tip: TIP_LABEL["GG Magnetic Field"] || "",
        value: m.display.magneticField,
        meta: `${m.display.magneticMorphology} — ${m.magnetic.dynamoReason}`,
      },
      {
        label: "Equilibrium Temp",
        tip: TIP_LABEL["GG Equilibrium Temp"] || "",
        value: m.display.equilibriumTemp,
        meta: `T_eff ${m.display.effectiveTemp}`,
      },
      {
        label: "Orbital Period",
        tip: TIP_LABEL["GG Orbital Period"] || "",
        value: m.display.orbitalPeriod,
        meta: m.display.orbitalVelocity,
      },
    ]);
    const readoutSections = createReadoutSections([
      {
        title: "Atmosphere",
        tip: TIP_LABEL["GG Derived"],
        lines: [
          `H₂ ${m.atmosphere.h2Pct}%, He ${m.atmosphere.hePct}%${m.atmosphere.ch4Pct > 0 ? `, CH₄ ${m.atmosphere.ch4Pct}%` : ""}${m.atmosphere.coPct > 0 ? `, CO ${m.atmosphere.coPct}%` : ""}`,
          `Dominant trace: ${m.atmosphere.dominantTrace}`,
          `Cloud layers: ${clouds}`,
          `Bond albedo: ${fmt(m.thermal.bondAlbedo, 2)}`,
          `Internal heat ratio: ${fmt(m.thermal.internalHeatRatio, 2)}`,
        ],
      },
      {
        title: "Orbit",
        lines: [
          `Insolation: ${m.display.insolation}`,
          m.display.peri ? `Periapsis: ${m.display.peri} (${m.display.tempPeri})` : null,
          m.display.apo ? `Apoapsis: ${m.display.apo} (${m.display.tempApo})` : null,
          `Orbital direction: ${m.display.orbitalDirection}`,
          `Local days per year: ${m.display.localDaysPerYear}`,
          `Nearest resonance: ${m.display.resonance}`,
        ],
      },
      {
        title: "Magnetism",
        tip: TIP_LABEL["GG Magnetic Field"],
        lines: [
          `Magnetosphere: ${m.display.magnetosphere}`,
          `Moon tidal heating: ${m.display.moonTidalHeating}`,
          `Atmospheric sputtering: ${m.display.sputteringPlasma}`,
        ],
      },
      {
        title: "Gravity & zones",
        lines: [
          `Hill sphere: ${m.display.hillSphere}`,
          `Roche limit: ${m.display.rocheLimit}`,
          `Chaotic zone: ${m.display.chaoticZone}`,
          `Ring zone: ${fmt(m.gravity.ringZoneInnerKm, 0)}–${fmt(m.gravity.ringZoneOuterKm, 0)} km`,
        ],
      },
      {
        title: "Dynamics",
        tip: TIP_LABEL["GG Oblateness"],
        lines: [
          `Bands: ${m.display.bands}`,
          `Wind speed: ${m.display.windSpeed}`,
          `Oblateness: ${m.display.oblateness}`,
          `Equatorial/Polar: ${m.display.equatorialRadius}`,
        ],
      },
      {
        title: "Interior",
        tip: TIP_LABEL["GG Interior"],
        lines: [
          `Heavy elements: ${m.display.heavyElements}`,
          `Bulk metallicity: ${m.display.bulkMetallicity}`,
        ],
      },
      {
        title: "Stability",
        tip: TIP_LABEL["GG Mass Loss"],
        lines: [
          `Mass loss: ${m.display.massLossRate}`,
          `Evaporation: ${m.display.evaporationTimescale}`,
          `Roche lobe: ${m.display.rocheLobeRadius}`,
          m.display.jeansEscape,
        ],
      },
      {
        title: "Suggested radius",
        tip: TIP_LABEL["GG Suggested Radius"],
        lines: [m.display.suggestedRadius, m.display.radiusAgeNote],
      },
      {
        title: "Rings",
        tip: TIP_LABEL["GG Ring Properties"],
        lines: [`Type: ${m.display.ringType}`, `Details: ${m.display.ringDetails}`],
      },
      {
        title: "Tidal evolution",
        tip: TIP_LABEL["GG Tidal"],
        lines: [
          `Tidal locking: ${m.display.tidalLocking}`,
          `Circularisation: ${m.display.circularisation}`,
        ],
      },
    ]);
    bodyOutputsEl.replaceChildren(kpiGrid, ...readoutSections);

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

  /* ── Gas giant recipe picker modal ─────────────────────────────── */

  function openGgRecipePicker(onSelect) {
    const categories = [...new Set(GAS_GIANT_RECIPES.map((r) => r.category))];
    const overlay = createRecipePickerOverlay({
      title: "Gas Giant Recipes",
      categories,
      recipes: GAS_GIANT_RECIPES,
      showHints: true,
    });
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

  /* ── Rocky recipe picker modal ─────────────────────────────────── */

  function openRecipePicker(onSelect) {
    const categories = ["Terrestrial", "Barren", "Extreme", "Ocean"];
    const overlay = createRecipePickerOverlay({
      title: "Rocky Planet Recipes",
      categories,
      recipes: ROCKY_RECIPES,
    });
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

  /* ── Moons section ──────────────────────────────────────────────── */

  function renderMoons(world, bodyType, bodyId) {
    const moons = listMoons(world)
      .filter((m) => m.planetId === bodyId)
      .sort((a, b) => {
        const aa = Number(a?.inputs?.semiMajorAxisKm);
        const bb = Number(b?.inputs?.semiMajorAxisKm);
        return (Number.isFinite(aa) ? aa : Infinity) - (Number.isFinite(bb) ? bb : Infinity);
      });
    renderMoonSection(bodyMoonsEl, {
      bodyType,
      bodyId,
      moons,
      moonsTip: TIP_LABEL["Moons"],
    });
  }

  /* ── Actions (presets/reset) ────────────────────────────────────── */

  function renderActions(bodyType) {
    if (bodyType === "planet") {
      renderBodyActionButtons(bodyActionsEl, [
        { id: "btn-earth", label: "Earth-ish Preset" },
        { id: "btn-pluto", label: "Pluto-ish Preset" },
        { id: "btn-reset", label: "Reset to Defaults" },
      ]);
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
          radioisotopeAbundance: 1.0,
          radioisotopeMode: "simple",
          u238Abundance: 1.0,
          u235Abundance: 1.0,
          th232Abundance: 1.0,
          k40Abundance: 1.0,
        };
        updatePlanet(w.planets.selectedId, { name: "Earth", inputs });
        updateWorld({ planet: inputs });
        scheduleRender();
      });
      bodyActionsEl.querySelector("#btn-pluto").addEventListener("click", () => {
        const w = loadWorld();
        const inputs = {
          name: "Pluto",
          massEarth: 0.0022,
          cmfPct: 32.0,
          wmfPct: 30.0,
          axialTiltDeg: 122.5,
          albedoBond: 0.72,
          greenhouseEffect: 0,
          observerHeightM: 1.75,
          rotationPeriodHours: 153.3,
          semiMajorAxisAu: 39.48,
          eccentricity: 0.2488,
          inclinationDeg: 17.16,
          longitudeOfPeriapsisDeg: 113.8,
          subsolarLongitudeDeg: 0.0,
          pressureAtm: 0.00001,
          o2Pct: 0,
          co2Pct: 0,
          arPct: 0,
          h2oPct: 0,
          ch4Pct: 5,
          h2Pct: 0,
          hePct: 0,
          so2Pct: 0,
          nh3Pct: 0,
          radioisotopeAbundance: null,
          radioisotopeMode: "simple",
          u238Abundance: null,
          u235Abundance: null,
          th232Abundance: null,
          k40Abundance: null,
        };
        updatePlanet(w.planets.selectedId, { name: "Pluto", inputs });
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
      renderBodyActionButtons(bodyActionsEl, []);
    }
  }

  /* ── Main render ────────────────────────────────────────────────── */

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

  /* ── Body selector events ───────────────────────────────────────── */

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

  /* ── Init ───────────────────────────────────────────────────────── */

  render();
}
