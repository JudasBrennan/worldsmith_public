/**
 * Procedural Köppen climate zone classification for terrestrial planets.
 *
 * Takes pre-computed values from calcPlanetExact() and classifies the planet's
 * latitude bands into Köppen-like climate zones.  The algorithm models the
 * equator-pole temperature gradient, seasonal amplitude from axial tilt, and
 * moisture availability from atmospheric circulation cell dynamics.
 *
 * References:
 *   - Köppen-Geiger classification: Peel et al. (2007, Hydrol. Earth Syst. Sci.)
 *   - Equator-pole gradient: North (1975, J. Atmos. Sci.)
 *   - Atmospheric heat redistribution: Pierrehumbert (2010, Principles of Planetary Climate)
 */

import { clamp, toFinite, round } from "./utils.js";

// ── Constants ───────────────────────────────────────────────

/** Max equator-pole temperature gradient (K) for an airless body. */
const BASE_GRADIENT_K = 60;

/** Atmospheric heat redistribution strength.  Higher = flatter gradient. */
const REDISTRIBUTION_COEFF = 0.8;

/** Earth-calibrated mid-latitude seasonal half-amplitude (°C). */
const SEASONAL_BASE_AMPLITUDE_C = 15;

/** Pressure damping coefficient for seasonal amplitude. */
const SEASONAL_DAMPING_COEFF = 0.3;

/** Environmental lapse rate (°C per km altitude), ISA standard. */
const ENVIRONMENTAL_LAPSE_RATE_C_KM = 6.5;

/** Moisture index below this = desert (BW). */
const DESERT_THRESHOLD = 0.25;

/** Moisture index below this = steppe (BS). */
const STEPPE_THRESHOLD = 0.45;

/** Moisture index above this in tropics = rainforest (Af). */
const TROPICAL_WET_THRESHOLD = 0.75;

/** Moisture index above this in tropics = monsoon (Am). */
const TROPICAL_MONSOON_THRESHOLD = 0.55;

/** Scaling factors for moisture index by water regime.
 *  Earth (wmf ~0.02%) maps to "Shallow oceans" but has ~70% surface coverage,
 *  so the scale must be high enough to produce tropical rainforest at the ITCZ. */
const WATER_REGIME_SCALE = {
  Dry: 0.1,
  "Shallow oceans": 0.85,
  "Extensive oceans": 1.0,
  "Global ocean": 1.0,
  "Deep ocean": 1.0,
  "Ice world": 0.2,
};

/** Cell role assignments for 5-cell circulation. */
const CELL_ROLES_5 = ["hadley", "hadley", "ferrel", "ferrel", "polar"];

/** Cell role assignments for 7-cell circulation. */
const CELL_ROLES_7 = ["hadley", "hadley", "hadley", "ferrel", "ferrel", "polar", "polar"];

const PI = Math.PI;

// ── Clausius-Clapeyron boiling point ────────────────────────

/** Water boiling point (K) at a given pressure (atm). */
function waterBoilingK(pAtm) {
  if (pAtm <= 0) return 0;
  if (pAtm >= 218) return 647;
  const LV_R = 40700 / 8.314;
  return 1 / (1 / 373.15 - Math.log(pAtm) / LV_R);
}

// ── Köppen zone reference dictionary ────────────────────────

/**
 * @typedef {object} KoppenEntry
 * @property {string} code        Köppen classification code
 * @property {string} name        Human-readable name
 * @property {string} master      Master class letter (A/B/C/D/E/X)
 * @property {string} description One-line climate summary
 * @property {string} environment Vegetation/biome description (expandable)
 * @property {string} location    Typical geographic/circulation position
 */

/** @type {Record<string, KoppenEntry>} */
const KOPPEN_ZONES = {
  // ── A: Tropical ──
  Af: {
    code: "Af",
    name: "Tropical Rainforest",
    master: "A",
    description: "Hot and wet year-round.  Every month \u2265 18 \u00b0C, no dry season.",
    environment:
      "Rainforests with evergreen hardwood trees.  Highest biodiversity on planet.  " +
      "Poor soil quality despite lush growth.",
    location: "Within the equatorward half of the tropics, at low elevations.",
  },
  Am: {
    code: "Am",
    name: "Tropical Monsoon",
    master: "A",
    description: "Hot year-round with a short dry season offset by heavy monsoon rains.",
    environment: "Monsoon forest to grassland.  Lower biodiversity than tropical rainforests.",
    location:
      "In tropics, as a transition away from tropical rainforests.  " +
      "In areas subject to monsoon circulation.",
  },
  Aw: {
    code: "Aw",
    name: "Tropical Savannah",
    master: "A",
    description: "Hot year-round with a distinct wet and dry season.",
    environment: "Scrub, forest, and grassland.  Classic wet-and-dry biome.",
    location: "In tropics, transitioning poleward from monsoon zones.  Widespread area.",
  },

  // ── B: Arid ──
  BWh: {
    code: "BWh",
    name: "Hot Desert",
    master: "B",
    description: "Very low precipitation, long very hot summers and shorter mild winters.",
    environment:
      "Limited or absent vegetation.  Sand and bare rock.  " + "Highest temperatures on planet.",
    location: "Poleward third of Hadley cell.  Rain shadows of tropical and subtropical mountains.",
  },
  BWk: {
    code: "BWk",
    name: "Cold Desert",
    master: "B",
    description: "Very low precipitation, warm/hot summers and cool/cold winters.",
    environment: "Very limited or absent vegetation.  Desolate and inhospitable.",
    location:
      "Continental interiors and rain shadows in the Ferrel cell.  " +
      "At elevation in hot desert zones.",
  },
  BSh: {
    code: "BSh",
    name: "Hot Steppe",
    master: "B",
    description: "Low precipitation, very hot summers and mild winters.",
    environment: "Limited vegetation: stunted hardy shrubs and grasses.  Marginal habitability.",
    location: "Bordering hot deserts, at the edge of the Hadley cell subsidence zone.",
  },
  BSk: {
    code: "BSk",
    name: "Cold Steppe",
    master: "B",
    description: "Low precipitation, warm/hot summers and cool/cold winters.",
    environment:
      "Scrub and hardy grasses.  Poor agricultural land; grazing livestock can be viable.",
    location:
      "Continental interiors and rain shadows in the Ferrel cell.  " +
      "Transition zone away from cold deserts.",
  },

  // ── C: Temperate ──
  Cfa: {
    code: "Cfa",
    name: "Humid Subtropical",
    master: "C",
    description: "Moderate year-round rainfall.  Hot summers, mild winters.",
    environment:
      "Mixed forest, grassland, and swamps.  Good for agriculture.  " +
      "Can support high populations.",
    location:
      "Poleward third of Hadley cell to equatorward third of Ferrel cell.  " +
      "Along warm-current coasts.",
  },
  Cfb: {
    code: "Cfb",
    name: "Oceanic",
    master: "C",
    description: "Moderate to high rainfall year-round.  Warm summers, cool winters.",
    environment: "Thick mixed woodland.  In places, temperate rainforest.  Great for agriculture.",
    location: "Poleward half of Ferrel cell, along warm-current coasts.",
  },
  Cfc: {
    code: "Cfc",
    name: "Subpolar Oceanic",
    master: "C",
    description: "Moderate to high rainfall year-round.  Cool year-round.",
    environment: "Coniferous forests.  Very stormy and overcast.",
    location:
      "Poleward half of Ferrel cell, along warm-current coasts.  " +
      "Transition poleward from oceanic or at high elevation.",
  },
  Csa: {
    code: "Csa",
    name: "Hot Mediterranean",
    master: "C",
    description: "Dry hot summers, mild wet winters.",
    environment:
      "Shrubland with scrub and hardy grasses.  Patches of bare earth.  " +
      "Grapes, olives, citrus.",
    location:
      "Equatorward half of Ferrel cell.  Poleward of hot deserts and steppes.  " +
      "Along cold-current coasts.",
  },
  Csb: {
    code: "Csb",
    name: "Warm Mediterranean",
    master: "C",
    description: "Dry warm summers, cool wet winters.",
    environment: "Coniferous and eucalyptus forests.  Stormy winters, superb summers.",
    location:
      "Equatorward half of Ferrel cell.  Poleward transition from hot Mediterranean.  " +
      "Along cold-current coasts.",
  },
  Cwa: {
    code: "Cwa",
    name: "Subtropical Monsoon",
    master: "C",
    description: "High summer rainfall, low or absent winter rainfall.  Hot to cool.",
    environment:
      "Scrub-forest and grassland.  Good for agriculture.  Can support high populations.",
    location:
      "Poleward third of Hadley cell to equatorward Ferrel cell.  " +
      "In regions affected by monsoon circulation.",
  },
  Cwb: {
    code: "Cwb",
    name: "Subtropical Highland",
    master: "C",
    description: "High summer rainfall, dry winters.  Warm year-round.",
    environment: "Forest and grassland.  An \u201ceternal spring\u201d climate at elevation.",
    location: "In tropics, usually between 1500\u20134000 m in elevation.",
  },

  // ── D: Continental ──
  Dfa: {
    code: "Dfa",
    name: "Hot Humid Continental",
    master: "D",
    description: "Fairly low year-round rainfall.  Hot summers, cold winters.",
    environment: "Prairie, steppe, deciduous and coniferous forests.  Good for agriculture.",
    location: "Poleward half of Ferrel cell, continental interiors.",
  },
  Dfb: {
    code: "Dfb",
    name: "Warm Humid Continental",
    master: "D",
    description: "Fairly low year-round rainfall.  Warm summers, cold winters.",
    environment: "Prairie, steppe, mixed woodland.  Wide seasonal temperature ranges.",
    location: "Poleward half of Ferrel cell, continental interiors.",
  },
  Dfc: {
    code: "Dfc",
    name: "Subarctic",
    master: "D",
    description: "Low year-round rainfall.  Short cool summers, long cold winters.",
    environment:
      "Boreal forest (taiga): larch, fir, pine, spruce.  Swamps, bogs, permafrost.  " +
      "Lowest biodiversity.  Little to no farming.",
    location:
      "Poleward half of Ferrel cell to equatorward half of polar cell.  " +
      "Continental interiors and isolated alpine regions.",
  },
  Dfd: {
    code: "Dfd",
    name: "Extreme Subarctic",
    master: "D",
    description: "Low year-round rainfall.  Short cool summers, very cold long winters.",
    environment:
      "Boreal forest (taiga) with permafrost.  Extremely wide seasonal temperature range.",
    location: "Deep continental interiors at high latitudes.",
  },
  Dwa: {
    code: "Dwa",
    name: "Hot Continental Monsoon",
    master: "D",
    description: "Moderate summer rainfall, light winter snow.  Hot summers, cold winters.",
    environment:
      "Prairie, steppe, deciduous and coniferous forests.  Monsoon variant of humid continental.",
    location: "Ferrel cell regions subject to monsoon circulation.",
  },
  Dwb: {
    code: "Dwb",
    name: "Continental Monsoon",
    master: "D",
    description: "Moderate summer rainfall, light winter snow.  Warm summers, cold winters.",
    environment: "Prairie, steppe, mixed woodland.  Four seasons with wet summer.",
    location: "Ferrel cell regions subject to monsoon circulation.",
  },
  Dwc: {
    code: "Dwc",
    name: "Subarctic Monsoon",
    master: "D",
    description:
      "Fairly low summer rainfall, light winter snow.  Short summers, long cold winters.",
    environment: "Boreal forest (taiga) with permafrost.  Furthest extent of monsoon circulation.",
    location:
      "Poleward half of Ferrel cell to equatorward polar cell.  " +
      "Continental interiors subject to monsoon circulation.",
  },
  Dwd: {
    code: "Dwd",
    name: "Extreme Subarctic Monsoon",
    master: "D",
    description:
      "Fairly low summer rainfall, light winter snow.  Short summers, extremely cold long winters.",
    environment: "Boreal forest (taiga) with permafrost.  Very wide temperature range.",
    location: "Deep continental interiors at high latitudes with monsoon influence.",
  },

  // ── E: Polar ──
  ET: {
    code: "ET",
    name: "Tundra",
    master: "E",
    description: "Warmest month 0\u201310 \u00b0C.  Low precipitation year-round.",
    environment:
      "Treeless: lichen, moss, and hardy grasses.  Permafrost.  " +
      "Lakes, bogs, and swamps in flat areas.  No farming.  Marginal habitability.",
    location:
      "In polar cell.  High altitude regions worldwide (alpine meadows).  " +
      "Fringing polar ice cap climates.",
  },
  EF: {
    code: "EF",
    name: "Ice Cap",
    master: "E",
    description: "Warmest month < 0 \u00b0C.  Perpetual winter.",
    environment: "No vegetation.  Ice sheets kilometres thick.  Most hostile climate zone.",
    location: "In polar cell, poleward of tundra.  Continental interiors.  High altitude regions.",
  },

  // ── X: Special (non-standard) ──
  Xss: {
    code: "Xss",
    name: "Substellar Hot Zone",
    master: "X",
    description: "Tidally locked: permanent day hemisphere centred on the substellar point.",
    environment: "Depends on temperature and moisture: may range from scorched desert to tropical.",
    location: "Centre of the permanently illuminated hemisphere.",
  },
  Xtz: {
    code: "Xtz",
    name: "Terminator Zone",
    master: "X",
    description: "Tidally locked: permanent twilight ring between day and night hemispheres.",
    environment:
      "Most habitable region on a tidally locked world.  " +
      "Persistent winds from day to night side.",
    location: "Ring at the boundary between permanent day and permanent night.",
  },
  Xas: {
    code: "Xas",
    name: "Antistellar Ice Cap",
    master: "X",
    description: "Tidally locked: permanent night hemisphere.  Extreme cold.",
    environment:
      "No illumination.  Cold trap may collect frozen volatiles.  " +
      "Potentially thick ice deposits.",
    location: "Centre of the permanently dark hemisphere.",
  },
  Xbv: {
    code: "Xbv",
    name: "Beyond Boiling",
    master: "X",
    description: "Surface temperature exceeds the boiling point of water at local pressure.",
    environment: "No liquid water.  Supercritical or vapour-phase atmosphere.",
    location: "Global or regional, depending on temperature distribution.",
  },
  Xna: {
    code: "Xna",
    name: "No Atmosphere",
    master: "X",
    description: "No significant atmosphere.  Airless body.",
    environment: "Bare regolith.  Extreme diurnal temperature swings.",
    location: "Global.",
  },
};

export { KOPPEN_ZONES };

// ── Helper functions ────────────────────────────────────────

/**
 * Equator-pole temperature and seasonal variation at a given latitude.
 *
 * Uses a sin²(lat) gradient scaled by atmospheric heat redistribution
 * and a seasonal amplitude from axial tilt.
 *
 * @param {number} latDeg          Latitude (0–90)
 * @param {number} globalMeanTempK Mean global surface temperature (K)
 * @param {number} pressureAtm     Surface pressure (atm)
 * @param {number} axialTiltDeg    Axial tilt (0–180°)
 * @param {number} gravityG        Surface gravity (g)
 * @returns {{ meanC: number, warmestC: number, coldestC: number }}
 */
export function latitudeTemperature(latDeg, globalMeanTempK, pressureAtm, axialTiltDeg, gravityG) {
  const lat = clamp(toFinite(latDeg, 0), 0, 90);
  const tempK = toFinite(globalMeanTempK, 288);
  const pAtm = Math.max(toFinite(pressureAtm, 1), 0);
  const tilt = clamp(toFinite(axialTiltDeg, 23.44), 0, 180);
  const g = Math.max(toFinite(gravityG, 1), 0.1);

  // Equator-pole gradient (K)
  const effectivePressure = pAtm / Math.sqrt(g);
  const gradientK = clamp(BASE_GRADIENT_K / (1 + REDISTRIBUTION_COEFF * effectivePressure), 1, 80);

  // Equator temperature so that the global mean is preserved:
  // For T(lat) = T_eq - G × sin²(lat), spherical mean = T_eq - G/3.
  const globalMeanC = tempK - 273.15;
  const equatorMeanC = globalMeanC + gradientK / 3;

  const latRad = (lat * PI) / 180;
  const sinLat = Math.sin(latRad);
  const meanC = equatorMeanC - gradientK * sinLat * sinLat;

  // Seasonal amplitude
  const effectiveTilt = tilt <= 90 ? tilt : 180 - tilt;
  const tiltRatio = effectiveTilt / 23.44;
  const seasonalDamping = 1 / (1 + SEASONAL_DAMPING_COEFF * effectivePressure);
  const amplitude = SEASONAL_BASE_AMPLITUDE_C * sinLat * tiltRatio * seasonalDamping;

  return {
    meanC: round(meanC, 1),
    warmestC: round(meanC + amplitude, 1),
    coldestC: round(meanC - amplitude, 1),
  };
}

/**
 * Moisture/aridity index for a latitude band.
 *
 * @param {string} cellRole      "hadley"|"ferrel"|"polar"|"single"
 * @param {number} latFraction   0–1 position within the band (0 = equatorward edge)
 * @param {string} waterRegime   Planet water regime label
 * @param {number} h2oPct        Atmospheric H₂O percentage
 * @param {string} variant       "warm-coast"|"cold-coast"|"general"
 * @returns {number} 0 (hyperarid) to 1 (saturated)
 */
export function moistureIndex(cellRole, latFraction, waterRegime, h2oPct, variant) {
  const frac = clamp(toFinite(latFraction, 0.5), 0, 1);
  const h2o = Math.max(toFinite(h2oPct, 0), 0);

  let base = 0.5;
  if (cellRole === "hadley") {
    // ITCZ (equator edge) wet → subsidence (poleward edge) dry
    base = frac > 0.7 ? 0.15 : 0.9 - 0.75 * frac;
  } else if (cellRole === "ferrel") {
    if (variant === "warm-coast") base = 0.7;
    else if (variant === "cold-coast") base = 0.45;
    else base = 0.55;
  } else if (cellRole === "polar") {
    base = 0.2;
  }

  const waterScale = WATER_REGIME_SCALE[waterRegime] ?? 0.7;
  const h2oFactor = 1 + clamp(h2o, 0, 10) * 0.1;

  return clamp(base * waterScale * h2oFactor, 0, 1);
}

/**
 * Temperature sub-type suffix for C and D classes.
 * @param {number} warmC  Warmest month mean (°C)
 * @param {number} coldC  Coldest month mean (°C)
 * @returns {string} "a"|"b"|"c"|"d"
 */
function tempSuffix(warmC, coldC) {
  if (coldC < -38) return "d";
  if (warmC >= 22) return "a";
  if (warmC >= 15) return "b";
  return "c";
}

/**
 * Köppen decision tree classification.
 *
 * @param {number} meanC    Annual mean (°C)
 * @param {number} warmC    Warmest month mean (°C)
 * @param {number} coldC    Coldest month mean (°C)
 * @param {number} moisture Moisture index 0–1
 * @param {string} cellRole "hadley"|"ferrel"|"polar"|"single"
 * @param {string} variant  "warm-coast"|"cold-coast"|"general"
 * @returns {string} Köppen code
 */
export function classifyKoppen(meanC, warmC, coldC, moisture, cellRole, variant) {
  // E: Polar
  if (warmC < 10) {
    return warmC < 0 ? "EF" : "ET";
  }

  // B: Arid
  if (moisture < DESERT_THRESHOLD) {
    return meanC >= 18 ? "BWh" : "BWk";
  }
  if (moisture < STEPPE_THRESHOLD) {
    return meanC >= 18 ? "BSh" : "BSk";
  }

  // A: Tropical
  if (coldC >= 18) {
    if (moisture >= TROPICAL_WET_THRESHOLD) return "Af";
    if (moisture >= TROPICAL_MONSOON_THRESHOLD) return "Am";
    return "Aw";
  }

  // D: Continental (coldC < -3)
  if (coldC < -3) {
    const s = tempSuffix(warmC, coldC);
    // Dry-summer (Mediterranean continental) for cold-coast Ferrel
    if (cellRole === "ferrel" && variant === "cold-coast") return "Ds" + s;
    // Dry-winter (monsoon) for moderate moisture
    if (moisture < 0.55) return "Dw" + s;
    return "Df" + s;
  }

  // C: Temperate (coldC >= -3 && coldC < 18 && warmC >= 10)
  const s = tempSuffix(warmC, coldC);
  // Dry-summer (Mediterranean) for cold-coast Ferrel
  if (cellRole === "ferrel" && variant === "cold-coast") return "Cs" + s;
  // Dry-winter (monsoon) for moderate moisture
  if (moisture < 0.55) return "Cw" + s;
  return "Cf" + s;
}

// ── Cell role classification ────────────────────────────────

/** Parse "0-30" or "56-90°" into [start, end] numbers. */
function parseRange(rangeDegNS) {
  const nums = (rangeDegNS || "0-90").replace(/[°]/g, "").split("-").map(Number);
  return [nums[0] || 0, nums[1] || 90];
}

/**
 * Assign hadley/ferrel/polar roles to circulation cells and split
 * wide Hadley cells into equatorial (wet) and subtropical (dry) sub-bands.
 */
function classifyCells(cellCount, cellRanges) {
  const result = [];

  if (cellCount === "1") {
    // Single cell: split into hadley-like 0-60 and polar-like 60-90
    result.push({ latStart: 0, latEnd: 60, role: "hadley" });
    result.push({ latStart: 60, latEnd: 90, role: "polar" });
  } else if (cellCount === "3") {
    const roles = ["hadley", "ferrel", "polar"];
    const ranges =
      cellRanges.length >= 3
        ? cellRanges
        : [{ rangeDegNS: "0-30" }, { rangeDegNS: "30-60" }, { rangeDegNS: "60-90" }];
    for (let i = 0; i < ranges.length; i++) {
      const [s, e] = parseRange(ranges[i].rangeDegNS);
      result.push({ latStart: s, latEnd: e, role: roles[i] || "ferrel" });
    }
  } else if (cellCount === "5") {
    for (let i = 0; i < cellRanges.length; i++) {
      const [s, e] = parseRange(cellRanges[i].rangeDegNS);
      result.push({ latStart: s, latEnd: e, role: CELL_ROLES_5[i] || "ferrel" });
    }
  } else if (cellCount === "7") {
    for (let i = 0; i < cellRanges.length; i++) {
      const [s, e] = parseRange(cellRanges[i].rangeDegNS);
      result.push({ latStart: s, latEnd: e, role: CELL_ROLES_7[i] || "ferrel" });
    }
  } else {
    // Fallback: single global cell
    result.push({ latStart: 0, latEnd: 90, role: "hadley" });
  }

  // Track the full Hadley extent so moisture fractions are computed
  // relative to the entire Hadley belt, not individual sub-bands.
  const hadleyMax = Math.max(...result.filter((c) => c.role === "hadley").map((c) => c.latEnd), 0);

  // Sub-band splitting: Hadley cells wider than 20° split into
  // equatorial (ITCZ, wet) and poleward (subsidence, dry) halves.
  const split = [];
  for (const cell of result) {
    const span = cell.latEnd - cell.latStart;
    if (cell.role === "hadley" && span > 20) {
      const mid = cell.latStart + Math.round(span / 2);
      split.push({ latStart: cell.latStart, latEnd: mid, role: "hadley", hadleyMax });
      split.push({ latStart: mid, latEnd: cell.latEnd, role: "hadley", hadleyMax });
    } else {
      split.push({ ...cell, hadleyMax });
    }
  }

  return split;
}

// ── Main function ───────────────────────────────────────────

/**
 * Classify a planet's latitude bands into Köppen-like climate zones.
 *
 * @param {object} opts  All values from calcPlanetExact() derived + inputs
 * @returns {{ inputs: object, zones: Array, display: object, advisory: string|null }}
 */
export function calcClimateZones({
  surfaceTempK = 288,
  axialTiltDeg = 23.44,
  circulationCellCount = "3",
  circulationCellRanges = [],
  h2oPct = 0,
  waterRegime = "Extensive oceans",
  pressureAtm = 1,
  tidallyLockedToStar = false,
  compositionClass = "Earth-like",
  liquidWaterPossible = true,
  climateState = "Stable",
  insolationEarth: _insolationEarth = 1,
  gravityG = 1,
  altitudeM = 0,
} = {}) {
  const tempK = toFinite(surfaceTempK, 288);
  const tilt = clamp(toFinite(axialTiltDeg, 23.44), 0, 180);
  const cellCount = circulationCellCount || "NA";
  const pAtm = toFinite(pressureAtm, 1);
  const h2o = Math.max(toFinite(h2oPct, 0), 0);
  const g = Math.max(toFinite(gravityG, 1), 0.1);
  const altKm = Math.max(toFinite(altitudeM, 0), 0) / 1000;
  const lapseC = altKm * ENVIRONMENTAL_LAPSE_RATE_C_KM * g;
  const locked = !!tidallyLockedToStar;
  const liqWater = !!liquidWaterPossible;

  const inputs = {
    surfaceTempK: tempK,
    axialTiltDeg: tilt,
    circulationCellCount: cellCount,
    h2oPct: h2o,
    waterRegime,
    pressureAtm: pAtm,
    tidallyLockedToStar: locked,
    compositionClass,
    liquidWaterPossible: liqWater,
    climateState,
    gravityG: g,
    altitudeM: round(altKm * 1000, 0),
  };

  // ── Short circuits ──

  // No atmosphere
  if (cellCount === "NA" || pAtm < 0.001) {
    const z = makeZone("Xna", 0, 90, "global", "general", tempK - 273.15);
    return result(inputs, [z], "No significant atmosphere.");
  }

  // Above boiling
  const boilingK = waterBoilingK(pAtm);
  if (tempK > boilingK) {
    const z = makeZone("Xbv", 0, 90, "global", "general", tempK - 273.15);
    return result(inputs, [z], "Global mean exceeds boiling point at local pressure.");
  }

  // Tidally locked
  if (locked) {
    return tidallyLockedResult(inputs, tempK, pAtm, g, liqWater, waterRegime, h2o, lapseC);
  }

  // Ice world override
  if (compositionClass === "Ice world" && tempK < 273) {
    return iceWorldResult(inputs, tempK, pAtm, tilt, g, circulationCellRanges, cellCount, lapseC);
  }

  // ── Normal latitude-band classification ──

  const cells = classifyCells(cellCount, circulationCellRanges);
  const zones = [];

  for (const cell of cells) {
    const latMid = (cell.latStart + cell.latEnd) / 2;
    const temp = latitudeTemperature(latMid, tempK, pAtm, tilt, g);
    // For Hadley cells, compute moisture fraction relative to the full Hadley
    // extent (0° to hadleyMax) so that sub-bands near the equator stay wet.
    const latFraction =
      cell.role === "hadley" && cell.hadleyMax > 0 ? latMid / cell.hadleyMax : 0.5;

    // Ferrel bands emit two entries (warm-coast + cold-coast)
    const variants = cell.role === "ferrel" ? ["warm-coast", "cold-coast"] : ["general"];

    for (const variant of variants) {
      let moisture = moistureIndex(cell.role, latFraction, waterRegime, h2o, variant);
      if (!liqWater) moisture = 0;

      const adjMeanC = round(temp.meanC - lapseC, 1);
      const adjWarmC = round(temp.warmestC - lapseC, 1);
      const adjColdC = round(temp.coldestC - lapseC, 1);

      const code = classifyKoppen(adjMeanC, adjWarmC, adjColdC, moisture, cell.role, variant);
      const entry = KOPPEN_ZONES[code];

      zones.push({
        latMin: cell.latStart,
        latMax: cell.latEnd,
        rangeLabel: `${cell.latStart}\u2013${cell.latEnd}\u00b0 N/S`,
        cellRole: cell.role,
        code,
        name: entry ? entry.name : code,
        master: entry ? entry.master : code[0],
        description: entry ? entry.description : "",
        environment: entry ? entry.environment : "",
        location: entry ? entry.location : "",
        variant,
        meanTempC: adjMeanC,
        warmestMonthC: adjWarmC,
        coldestMonthC: adjColdC,
        aridity: round(moisture, 2),
      });
    }
  }

  // Merge adjacent identical zones (same code + same variant)
  const merged = mergeZones(zones);

  const advisoryParts = [];
  if (!liqWater) advisoryParts.push("No liquid water \u2014 all zones are arid variants.");
  if (climateState === "Snowball")
    advisoryParts.push(
      "Snowball state \u2014 ice-albedo feedback likely drives global glaciation.",
    );
  else if (climateState === "Moist greenhouse")
    advisoryParts.push(
      "Moist greenhouse \u2014 stratospheric water vapour enables hydrogen escape to space.",
    );
  else if (climateState === "Runaway greenhouse")
    advisoryParts.push(
      "Runaway greenhouse \u2014 absorbed flux exceeds the radiation limit; surface water boils off.",
    );
  const advisory = advisoryParts.length > 0 ? advisoryParts.join(" ") : null;
  return result(inputs, merged, advisory);
}

// ── Internal helpers ────────────────────────────────────────

function makeZone(code, latMin, latMax, cellRole, variant, meanC) {
  const entry = KOPPEN_ZONES[code];
  return {
    latMin,
    latMax,
    rangeLabel: latMin === 0 && latMax === 90 ? "Global" : `${latMin}\u2013${latMax}\u00b0 N/S`,
    cellRole,
    code,
    name: entry ? entry.name : code,
    master: entry ? entry.master : "X",
    description: entry ? entry.description : "",
    environment: entry ? entry.environment : "",
    location: entry ? entry.location : "",
    variant,
    meanTempC: round(meanC, 1),
    warmestMonthC: round(meanC, 1),
    coldestMonthC: round(meanC, 1),
    aridity: 0,
  };
}

function result(inputs, zones, advisory) {
  const masters = {};
  for (const z of zones) masters[z.master] = (masters[z.master] || 0) + 1;
  const dominant = Object.entries(masters).sort((a, b) => b[1] - a[1])[0];

  return {
    inputs,
    zones,
    display: {
      zoneCount: String(zones.length),
      summary: zones.map((z) => `${z.rangeLabel}: ${z.code} ${z.name}`).join("\n"),
      dominantClass: dominant ? dominant[0] : "X",
    },
    advisory: advisory || null,
  };
}

function mergeZones(zones) {
  if (zones.length <= 1) return zones;
  const out = [zones[0]];
  for (let i = 1; i < zones.length; i++) {
    const prev = out[out.length - 1];
    const curr = zones[i];
    if (prev.code === curr.code && prev.variant === curr.variant && prev.latMax === curr.latMin) {
      // Merge: extend prev to cover curr
      prev.latMax = curr.latMax;
      prev.rangeLabel = `${prev.latMin}\u2013${curr.latMax}\u00b0 N/S`;
      prev.meanTempC = round((prev.meanTempC + curr.meanTempC) / 2, 1);
      prev.warmestMonthC = round((prev.warmestMonthC + curr.warmestMonthC) / 2, 1);
      prev.coldestMonthC = round((prev.coldestMonthC + curr.coldestMonthC) / 2, 1);
      prev.aridity = round((prev.aridity + curr.aridity) / 2, 2);
    } else {
      out.push(curr);
    }
  }
  return out;
}

function tidallyLockedResult(inputs, tempK, pAtm, g, liqWater, waterRegime, h2oPct, lapseC) {
  const globalC = tempK - 273.15;

  // Substellar: hotter than global mean; thick atmosphere redistributes
  const redistribution = 1 / (1 + 0.5 * pAtm);
  const substellarC = globalC + globalC * 0.3 * redistribution - lapseC;

  // Terminator: near global mean, buffered by atmospheric transport
  const terminatorC = globalC * (0.85 + 0.15 * Math.min(pAtm / 2, 1)) - lapseC;

  // Antistellar: colder; thick atmosphere keeps it warmer
  const antistellarC = globalC * (0.5 + 0.3 * Math.min(pAtm / 2, 1)) - lapseC;

  const boilingC = waterBoilingK(pAtm) - 273.15;
  const waterScale = WATER_REGIME_SCALE[waterRegime] ?? 0.7;
  const zones = [];

  // Substellar zone
  if (substellarC > boilingC) {
    zones.push(makeZone("Xbv", 0, 90, "substellar", "general", substellarC));
  } else {
    const moisture = liqWater ? clamp(0.5 * waterScale, 0, 1) : 0;
    const code = classifyKoppen(
      substellarC,
      substellarC,
      substellarC,
      moisture,
      "hadley",
      "general",
    );
    const z = makeZone(code, 0, 90, "substellar", "general", substellarC);
    z.aridity = round(moisture, 2);
    zones.push(z);
  }
  zones[0].rangeLabel = "Substellar hemisphere";

  // Terminator zone
  const termMoisture = liqWater
    ? clamp(0.7 * waterScale * (1 + clamp(h2oPct, 0, 10) * 0.1), 0, 1)
    : 0;
  const termCode = classifyKoppen(
    terminatorC,
    terminatorC,
    terminatorC,
    termMoisture,
    "ferrel",
    "general",
  );
  const termZone = makeZone(termCode, 0, 90, "terminator", "general", terminatorC);
  termZone.aridity = round(termMoisture, 2);
  termZone.rangeLabel = "Terminator ring";
  zones.push(termZone);

  // Antistellar zone
  if (antistellarC < 0) {
    const z = makeZone("EF", 0, 90, "antistellar", "general", antistellarC);
    z.rangeLabel = "Antistellar hemisphere";
    zones.push(z);
  } else if (antistellarC < 10) {
    const z = makeZone("ET", 0, 90, "antistellar", "general", antistellarC);
    z.rangeLabel = "Antistellar hemisphere";
    zones.push(z);
  } else {
    const moisture = liqWater ? clamp(0.1 * waterScale, 0, 1) : 0;
    const code = classifyKoppen(
      antistellarC,
      antistellarC,
      antistellarC,
      moisture,
      "polar",
      "general",
    );
    const z = makeZone(code, 0, 90, "antistellar", "general", antistellarC);
    z.aridity = round(moisture, 2);
    z.rangeLabel = "Antistellar hemisphere";
    zones.push(z);
  }

  return result(
    inputs,
    zones,
    "Tidally locked \u2014 substellar/terminator/antistellar geometry replaces latitude bands.",
  );
}

function iceWorldResult(inputs, tempK, pAtm, tilt, g, cellRanges, cellCount, lapseC) {
  const cells = classifyCells(cellCount, cellRanges);
  const zones = [];
  for (const cell of cells) {
    const latMid = (cell.latStart + cell.latEnd) / 2;
    const temp = latitudeTemperature(latMid, tempK, pAtm, tilt, g);
    const adjMeanC = round(temp.meanC - lapseC, 1);
    const adjWarmC = round(temp.warmestC - lapseC, 1);
    const adjColdC = round(temp.coldestC - lapseC, 1);
    const code = adjWarmC < 0 ? "EF" : "ET";
    zones.push(makeZone(code, cell.latStart, cell.latEnd, cell.role, "general", adjMeanC));
    const z = zones[zones.length - 1];
    z.warmestMonthC = adjWarmC;
    z.coldestMonthC = adjColdC;
  }
  return result(inputs, mergeZones(zones), "Ice world \u2014 all zones are polar variants.");
}
