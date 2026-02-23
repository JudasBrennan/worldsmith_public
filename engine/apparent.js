// Apparent magnitude and sky-visibility engine
//
// Computes how stars, planets, and moons appear from a home world:
// absolute and apparent magnitudes, phase effects, elongation,
// naked-eye visibility, and eclipse geometry.
//
// Methodology:
//   Stars  — standard distance-modulus formula (absolute mag + 5·log₁₀(d/pc) − 5)
//   Bodies — H–G asteroid photometry (Bowell 1989) for airless/tiny bodies,
//            empirical polynomial fits for atmosphered rocky worlds and gas giants,
//            with a luminosity correction for non-solar host stars
//   Moons  — Bowell H–G phase function with distance factor from the home orbit
//
// Inputs:  star mass, home orbit, body radii/albedos/orbits, moon parameters
// Outputs: absolute & apparent magnitudes, visibility classifications,
//          eclipse types, brightness ratios, angular sizes

import { clamp, toFinite } from "./utils.js";
import { calcStar } from "./star.js";

const PI = Math.PI;
const AU_IN_KM = 149597870;
const ARCSEC_PER_RAD = 206264.806;
const EARTH_SUN_APP_MAG = -26.762;
const FULL_MOON_APP_MAG = -12.74;
const JUPITER_RADIUS_KM = 69911;
const EARTH_RADIUS_KM = 6371;
const SUN_RADIUS_KM = 695700;

function clampCos(value) {
  if (!Number.isFinite(value)) return NaN;
  return Math.max(-1, Math.min(1, value));
}

function angleFromCos(cosValue) {
  const c = clampCos(cosValue);
  if (!Number.isFinite(c)) return NaN;
  return (Math.acos(c) * 180) / PI;
}

/* ── Angular size helpers ───────────────────────────────────── */

function angularDiameter(radiusKm, distanceKm) {
  const diamRad = (2 * radiusKm) / distanceKm;
  const arcsec = diamRad * ARCSEC_PER_RAD;
  const arcmin = arcsec / 60;
  const degrees = arcmin / 60;
  return { radians: diamRad, arcsec, arcmin, degrees };
}

function formatAngularLabel(ang) {
  if (!Number.isFinite(ang.arcsec)) return "NA";
  if (ang.degrees >= 1) return `${ang.degrees.toFixed(2)}\u00b0`;
  if (ang.arcmin >= 1) return `${ang.arcmin.toFixed(2)}\u2032`;
  return `${ang.arcsec.toFixed(2)}\u2033`;
}

/* ── Body type classification (matches WS8 types 1-4) ────────── */

function classifyBodyType(radiusKm, hasAtmosphere) {
  const radiusEarth = radiusKm / EARTH_RADIUS_KM;
  if (!hasAtmosphere && radiusEarth < 0.1) return 4;
  if (!hasAtmosphere) return 1;
  if (radiusEarth < 1.5) return 2;
  return 3;
}

const BODY_TYPE_LABEL = {
  1: "Rocky (airless)",
  2: "Rocky (atmosphere)",
  3: "Gas giant",
  4: "Tiny body",
};

/* ── Phase functions by body type (Bowell 1989 + WS8 empirical) ── */

function bowellHG(alphaDeg, G) {
  const alpha = clamp(toFinite(alphaDeg, 0), 0, 180);
  if (alpha >= 180) return NaN;
  const tanHalf = Math.tan(((alpha / 2) * PI) / 180);
  const phi = (1 - G) * Math.exp(-3.33 * tanHalf ** 0.63) + G * Math.exp(-1.87 * tanHalf ** 1.22);
  return phi > 0 ? -2.5 * Math.log10(phi) : NaN;
}

function atmosphereRockyPhase(alphaDeg) {
  const alpha = clamp(toFinite(alphaDeg, 0), 0, 180);
  return -0.00106 * alpha + 0.0002054 * alpha ** 2;
}

function gasGiantPhase(alphaDeg) {
  const alpha = clamp(toFinite(alphaDeg, 0), 0, 180);
  if (alpha <= 12) {
    return -0.00037 * alpha + 0.000616 * alpha ** 2;
  }
  const x = alpha / 180;
  const poly = 1 - 1.507 * x - 0.363 * x ** 2 - 0.062 * x ** 3 + 2.809 * x ** 4 - 1.876 * x ** 5;
  return poly > 0 ? -0.033 - 2.5 * Math.log10(poly) : NaN;
}

function phaseMagnitudeTerm(phaseAngleDeg, bodyType) {
  switch (bodyType) {
    case 2:
      return atmosphereRockyPhase(phaseAngleDeg);
    case 3:
      return gasGiantPhase(phaseAngleDeg);
    case 4:
      return bowellHG(phaseAngleDeg, 0.15);
    default:
      return bowellHG(phaseAngleDeg, 0.28);
  }
}

/* ── Bond → geometric albedo conversion ──────────────────────── */

const PHASE_INTEGRAL = { 1: 0.48, 2: 0.9, 3: 0.94, 4: 0.39 };

function defaultCurrentDistanceAu(orbitAu, homeAu) {
  const min = Math.abs(orbitAu - homeAu);
  const max = orbitAu + homeAu;
  return min + (max - min) * 0.5;
}

function classifyObservable({
  orbitAu,
  homeAu,
  currentDistanceAu,
  phaseAngleDeg,
  elongationDeg,
  apparentMagnitude,
}) {
  const isInner = orbitAu < homeAu;
  const nearInferiorConjunction =
    isInner && currentDistanceAu <= Math.max(0.000001, homeAu - orbitAu + 0.01);
  const nearTransitPhase = Number.isFinite(phaseAngleDeg) && phaseAngleDeg >= 177;

  if (nearInferiorConjunction && nearTransitPhase) {
    return "Transit";
  }
  if (
    Number.isFinite(apparentMagnitude) &&
    apparentMagnitude < -6 &&
    Number.isFinite(elongationDeg) &&
    elongationDeg > 20
  ) {
    return "Day and night";
  }
  if (Number.isFinite(elongationDeg) && elongationDeg < 20) {
    return "Too close to star";
  }
  if (Number.isFinite(elongationDeg) && elongationDeg < 50) {
    return "In twilight";
  }
  return "At night";
}

function classifyVisibility(apparentMagnitude, observableState) {
  if (!Number.isFinite(apparentMagnitude)) return "NA";
  if (observableState === "Too close to star") return "NA";
  if (observableState === "Transit") return "Transit";
  if (observableState === "Day and night") return "Day and night";

  if (apparentMagnitude < 0) return "Naked eye (very bright)";
  if (apparentMagnitude <= 5) return "Naked eye (bright)";
  if (apparentMagnitude < 7) return "Possibly with naked eye";
  if (apparentMagnitude < 24) return "With telescope";
  if (apparentMagnitude < 30) return "With space telescope";
  return "Too faint";
}

function classifyNakedEye(apparentMagnitude) {
  if (!Number.isFinite(apparentMagnitude)) return "No";
  if (apparentMagnitude <= 5) return "Yes";
  if (apparentMagnitude < 7) return "Maybe";
  return "No";
}

/**
 * Absolute visual magnitude of a star from its luminosity.
 *
 * @param {number} luminosityLsol  Stellar luminosity in solar units (L☉)
 * @returns {number} Absolute magnitude (Mv)
 */
export function calcStarAbsoluteMagnitude(luminosityLsol) {
  const l = Math.max(0.0000001, toFinite(luminosityLsol, 1));
  return 4.81013 - 2.5 * Math.log10(l);
}

/**
 * Apparent magnitude and relative brightness/size of the host star as
 * seen from a given orbital distance.
 *
 * @param {object} params
 * @param {number} params.starAbsoluteMagnitude  Star's absolute magnitude
 * @param {number} params.starRadiusRsol         Star's radius in solar radii
 * @param {number} params.orbitAu                Observer's orbital distance (AU)
 * @returns {{orbitAu: number, magnitude: number,
 *            brightnessRelativeToEarthSun: number,
 *            apparentSizeRelativeToEarthSun: number}}
 */
export function calcStarApparentAtOrbit({ starAbsoluteMagnitude, starRadiusRsol, orbitAu }) {
  const orbit = Math.max(0.000001, toFinite(orbitAu, 1));
  const magnitude = starAbsoluteMagnitude + 5 * Math.log10(orbit / ARCSEC_PER_RAD) - 5;
  const brightnessRelativeToEarthSun = 2.512 ** (EARTH_SUN_APP_MAG - magnitude);
  const apparentSizeRelativeToEarthSun = toFinite(starRadiusRsol, 1) / orbit;
  const starAngSize = angularDiameter(
    toFinite(starRadiusRsol, 1) * SUN_RADIUS_KM,
    orbit * AU_IN_KM,
  );

  return {
    orbitAu: orbit,
    magnitude,
    brightnessRelativeToEarthSun,
    apparentSizeRelativeToEarthSun,
    angularDiameterArcsec: starAngSize.arcsec,
    angularDiameterLabel: formatAngularLabel(starAngSize),
  };
}

/**
 * Absolute magnitude (H) of a solar-system body from its size and albedo.
 *
 * @param {object} params
 * @param {number} params.radiusKm         Body radius (km)
 * @param {number} params.geometricAlbedo  Geometric albedo (0–1)
 * @returns {number} Absolute magnitude H
 */
export function calcBodyAbsoluteMagnitude({ radiusKm, geometricAlbedo }) {
  const radius = Math.max(0.000001, toFinite(radiusKm, 1));
  const albedo = clamp(toFinite(geometricAlbedo, 0.1), 0.000001, 1);
  const diameterKm = radius * 2;
  return 5 * Math.log10(1329 / (diameterKm * Math.sqrt(albedo)));
}

/**
 * Apparent magnitude and visibility of a planet/body as seen from the
 * home world, accounting for phase angle, elongation, and host-star
 * luminosity.
 *
 * @param {object} params
 * @param {number} params.homeOrbitAu          Home world orbital distance (AU)
 * @param {number} params.orbitAu              Target body orbital distance (AU)
 * @param {number} params.radiusKm             Target body radius (km)
 * @param {number} params.geometricAlbedo      Geometric albedo (0–1)
 * @param {boolean} params.hasAtmosphere       Whether the body has an atmosphere
 * @param {number} [params.currentDistanceAu]  Current home-to-body distance (AU)
 * @param {number} [params.phaseAngleDeg]      Phase angle override (degrees)
 * @param {number} params.starLuminosityLsol   Host star luminosity (L☉)
 * @returns {{absoluteMagnitude: number, apparentMagnitude: number,
 *            orbitAu: number, minDistanceAu: number, maxDistanceAu: number,
 *            currentDistanceAu: number, phaseAngleDeg: number,
 *            elongationDeg: number, bodyType: number, bodyTypeLabel: string,
 *            nakedEye: string, observable: string, visibility: string}}
 */
export function calcBodyApparentFromHome({
  homeOrbitAu,
  orbitAu,
  radiusKm,
  geometricAlbedo,
  hasAtmosphere,
  currentDistanceAu,
  phaseAngleDeg,
  starLuminosityLsol,
}) {
  const home = Math.max(0.000001, toFinite(homeOrbitAu, 1));
  const orbit = Math.max(0.000001, toFinite(orbitAu, 1));
  const radius = Math.max(0.000001, toFinite(radiusKm, EARTH_RADIUS_KM));
  const starLum = Math.max(0.000001, toFinite(starLuminosityLsol, 1));

  const minDistanceAu = Math.abs(orbit - home);
  const maxDistanceAu = orbit + home;

  const rawCurrentDistance = toFinite(currentDistanceAu, defaultCurrentDistanceAu(orbit, home));
  const distanceAu = clamp(rawCurrentDistance, minDistanceAu, maxDistanceAu);

  const defaultPhaseCos = (orbit ** 2 + distanceAu ** 2 - home ** 2) / (2 * orbit * distanceAu);
  const derivedPhaseDeg = angleFromCos(defaultPhaseCos);
  const phaseDeg = Number.isFinite(phaseAngleDeg)
    ? clamp(phaseAngleDeg, 0, 180)
    : Number.isFinite(derivedPhaseDeg)
      ? derivedPhaseDeg
      : 0;

  const elongationCos = (home ** 2 + distanceAu ** 2 - orbit ** 2) / (2 * home * distanceAu);
  const elongationDeg = angleFromCos(elongationCos);

  const bodyType = classifyBodyType(radius, hasAtmosphere);
  const absoluteMagnitude = calcBodyAbsoluteMagnitude({ radiusKm: radius, geometricAlbedo });
  const luminosityCorrection = -2.5 * Math.log10(starLum);
  const phaseTerm = phaseMagnitudeTerm(phaseDeg, bodyType);

  let apparentMagnitude = NaN;
  if (Number.isFinite(absoluteMagnitude) && Number.isFinite(phaseTerm) && phaseDeg <= 160) {
    apparentMagnitude =
      absoluteMagnitude + 5 * Math.log10(orbit * distanceAu) + phaseTerm + luminosityCorrection;
  }

  const observable = classifyObservable({
    orbitAu: orbit,
    homeAu: home,
    currentDistanceAu: distanceAu,
    phaseAngleDeg: phaseDeg,
    elongationDeg,
    apparentMagnitude,
  });

  const bodyAngSize = angularDiameter(radius, distanceAu * AU_IN_KM);

  return {
    absoluteMagnitude,
    apparentMagnitude,
    orbitAu: orbit,
    minDistanceAu,
    maxDistanceAu,
    currentDistanceAu: distanceAu,
    phaseAngleDeg: phaseDeg,
    elongationDeg,
    bodyType,
    bodyTypeLabel: BODY_TYPE_LABEL[bodyType] || "Unknown",
    nakedEye: classifyNakedEye(apparentMagnitude),
    observable,
    visibility: classifyVisibility(apparentMagnitude, observable),
    angularDiameterArcsec: bodyAngSize.arcsec,
    angularDiameterLabel: formatAngularLabel(bodyAngSize),
  };
}

function normalizeOrbitSample(item, index) {
  const orbitAu = Math.max(0.000001, toFinite(item?.orbitAu, 1));
  return {
    id: String(item?.id || `orbit-${index + 1}`),
    name: String(item?.name || `Body ${index + 1}`),
    orbitAu,
  };
}

function normalizeBodySample(item, index) {
  const radiusKm = Math.max(0.000001, toFinite(item?.radiusKm, EARTH_RADIUS_KM));
  const geometricAlbedo = clamp(toFinite(item?.geometricAlbedo, 0.3), 0.000001, 1);
  return {
    id: String(item?.id || `body-${index + 1}`),
    name: String(item?.name || `Body ${index + 1}`),
    classLabel: String(item?.classLabel || "-").trim() || "-",
    orbitAu: Math.max(0.000001, toFinite(item?.orbitAu, 1)),
    radiusKm,
    geometricAlbedo,
    hasAtmosphere: Boolean(item?.hasAtmosphere),
    currentDistanceAu: Number.isFinite(Number(item?.currentDistanceAu))
      ? Number(item.currentDistanceAu)
      : undefined,
    phaseAngleDeg: Number.isFinite(Number(item?.phaseAngleDeg))
      ? Number(item.phaseAngleDeg)
      : undefined,
  };
}

function normalizeMoonSample(item) {
  const radiusMoon = Math.max(0.000001, toFinite(item?.radiusMoon, 1));
  const semiMajorAxisKm = Math.max(1, toFinite(item?.semiMajorAxisKm, 384748));
  const geometricAlbedo = clamp(toFinite(item?.geometricAlbedo, 0.12), 0.000001, 1);
  const phaseDeg = clamp(toFinite(item?.phaseDeg, 0), 0, 180);
  return {
    name: String(item?.name || "Moon"),
    radiusMoon,
    semiMajorAxisKm,
    geometricAlbedo,
    phaseDeg,
  };
}

function moonRadiusToKm(radiusMoon) {
  return radiusMoon * 1738.1;
}

function normalizeGasGiantRadiusKm(radiusRj) {
  const rj = Math.max(0.0001, toFinite(radiusRj, 1));
  return rj * JUPITER_RADIUS_KM;
}

/**
 * Apparent magnitude, brightness ratio, angular size, and eclipse type
 * for a moon as seen from the surface of its parent world.
 *
 * @param {object} params
 * @param {number} params.starLuminosityLsol  Host star luminosity (L☉)
 * @param {number} params.homeOrbitAu         Parent body orbital distance (AU)
 * @param {number} params.starRadiusRsol      Host star radius (R☉)
 * @param {object} params.moonSample          Moon parameters (radiusMoon, semiMajorAxisKm, geometricAlbedo, phaseDeg)
 * @returns {{absoluteMagnitude: number, apparentMagnitude: number,
 *            brightnessRelativeToFullMoon: number,
 *            apparentSizeRelativeToReference: number,
 *            starApparentSizeRelativeToReference: number,
 *            eclipseType: string}}
 */
export function calcMoonApparentFromHome({
  starLuminosityLsol,
  homeOrbitAu,
  starRadiusRsol,
  moonSample,
}) {
  const home = Math.max(0.000001, toFinite(homeOrbitAu, 1));
  const starLuminosity = Math.max(0.000001, toFinite(starLuminosityLsol, 1));
  const starRadius = Math.max(0.000001, toFinite(starRadiusRsol, 1));
  const moon = normalizeMoonSample(moonSample);

  const diameterKm = moonRadiusToKm(moon.radiusMoon) * 2;
  // Deviation from WorldSmith 8.0 spreadsheet: the spreadsheet has no apparent-
  // magnitude page for moons. This luminosity correction (dividing by √L) scales the
  // moon's absolute magnitude for the host star's brightness. The correct photometric
  // correction is −2.5·log₁₀(L), implemented here as dividing by √(L) inside the
  // log₁₀ argument (since log₁₀(√L) = 0.5·log₁₀(L) and 5·0.5 = 2.5).
  const absoluteMagnitude =
    5 *
    Math.log10(1329 / Math.sqrt(starLuminosity) / (diameterKm * Math.sqrt(moon.geometricAlbedo)));

  const phaseTerm = bowellHG(moon.phaseDeg, 0.28);

  const distanceFactor = home * (moon.semiMajorAxisKm / AU_IN_KM);

  const apparentMagnitude = !Number.isFinite(phaseTerm)
    ? NaN
    : absoluteMagnitude + 5 * Math.log10(distanceFactor) + phaseTerm;

  const brightnessRelativeToFullMoon = Number.isFinite(apparentMagnitude)
    ? 10 ** ((FULL_MOON_APP_MAG - apparentMagnitude) / 2.5)
    : NaN;

  const apparentSizeRelativeToReference = (moon.radiusMoon / moon.semiMajorAxisKm) * 384748;
  const starApparentSizeRelativeToReference = starRadius / home;

  const moonRadiusKm = moonRadiusToKm(moon.radiusMoon);
  const moonAngularRadiusRad = moonRadiusKm / moon.semiMajorAxisKm;
  const starAngularRadiusRad = (starRadius * SUN_RADIUS_KM) / (home * AU_IN_KM);
  const eclipseType =
    moonAngularRadiusRad >= starAngularRadiusRad
      ? "Total Eclipses Possible"
      : "Annular Eclipses Only";

  const moonAngSize = angularDiameter(moonRadiusKm, moon.semiMajorAxisKm);

  return {
    ...moon,
    absoluteMagnitude,
    apparentMagnitude,
    brightnessRelativeToFullMoon,
    apparentSizeRelativeToReference,
    starApparentSizeRelativeToReference,
    eclipseType,
    angularDiameterArcsec: moonAngSize.arcsec,
    angularDiameterLabel: formatAngularLabel(moonAngSize),
  };
}

/**
 * Top-level apparent-magnitude model. Derives the host star, computes
 * apparent magnitudes for the star at each orbit, for each body as seen
 * from the home world, and for a moon on the home world.
 *
 * @param {object} params
 * @param {number} params.starMassMsol    Host star mass (M☉)
 * @param {number} params.homeOrbitAu     Home world orbital distance (AU)
 * @param {Array}  [params.orbitSamples]  Additional orbits for star-appearance table
 * @param {Array}  [params.bodySamples]   Bodies to compute apparent magnitudes for
 * @param {object} [params.moonSample]    Moon of the home world (null if none)
 * @returns {{inputs: object, star: object, starByOrbit: Array,
 *            bodiesFromHome: Array, moon: object}}
 */
export function calcApparentModel({
  starMassMsol,
  homeOrbitAu,
  orbitSamples = [],
  bodySamples = [],
  moonSample = null,
  moonSamples = [],
}) {
  const star = calcStar({ massMsol: toFinite(starMassMsol, 1), ageGyr: 4.5 });
  const homeOrbit = Math.max(0.000001, toFinite(homeOrbitAu, 1));

  const starAbsoluteMagnitude = calcStarAbsoluteMagnitude(star.luminosityLsol);
  const homeStar = calcStarApparentAtOrbit({
    starAbsoluteMagnitude,
    starRadiusRsol: star.radiusRsol,
    orbitAu: homeOrbit,
  });

  const normalizedOrbits = (orbitSamples || []).map(normalizeOrbitSample);
  const starByOrbit = [
    {
      id: "home",
      name: "HOME",
      ...homeStar,
    },
    ...normalizedOrbits.map((sample) => ({
      ...sample,
      ...calcStarApparentAtOrbit({
        starAbsoluteMagnitude,
        starRadiusRsol: star.radiusRsol,
        orbitAu: sample.orbitAu,
      }),
    })),
  ];

  const normalizedBodies = (bodySamples || []).map(normalizeBodySample);
  const bodiesFromHome = normalizedBodies.map((body) => ({
    ...body,
    ...calcBodyApparentFromHome({
      homeOrbitAu: homeOrbit,
      orbitAu: body.orbitAu,
      radiusKm: body.radiusKm,
      geometricAlbedo: body.geometricAlbedo,
      hasAtmosphere: body.hasAtmosphere,
      currentDistanceAu: body.currentDistanceAu,
      phaseAngleDeg: body.phaseAngleDeg,
      starLuminosityLsol: star.luminosityLsol,
    }),
  }));

  const allMoonSamples = moonSamples.length > 0 ? moonSamples : moonSample ? [moonSample] : [];

  const moons = allMoonSamples.map((sample) =>
    calcMoonApparentFromHome({
      starLuminosityLsol: star.luminosityLsol,
      homeOrbitAu: homeOrbit,
      starRadiusRsol: star.radiusRsol,
      moonSample: sample,
    }),
  );

  const moon =
    moons[0] ||
    calcMoonApparentFromHome({
      starLuminosityLsol: star.luminosityLsol,
      homeOrbitAu: homeOrbit,
      starRadiusRsol: star.radiusRsol,
      moonSample: null,
    });

  return {
    inputs: {
      starMassMsol: toFinite(starMassMsol, 1),
      homeOrbitAu: homeOrbit,
    },
    star: {
      luminosityLsol: star.luminosityLsol,
      radiusRsol: star.radiusRsol,
      absoluteMagnitude: starAbsoluteMagnitude,
    },
    starByOrbit,
    bodiesFromHome,
    moon,
    moons,
  };
}

/**
 * Sol system reference values for familiar comparison.
 * All values are as seen from Earth.
 */
export const SOL_REFERENCES = [
  { name: "Sun", appMag: -26.74, angDiamArcmin: 31.6, angDiamArcsec: 1896, note: "from Earth" },
  {
    name: "Full Moon",
    appMag: -12.74,
    angDiamArcmin: 31.1,
    angDiamArcsec: 1866,
    note: "from Earth",
  },
  {
    name: "Venus (brightest)",
    appMag: -4.6,
    angDiamArcmin: null,
    angDiamArcsec: 64,
    note: "inferior conjunction",
  },
  {
    name: "Jupiter (opposition)",
    appMag: -2.7,
    angDiamArcmin: null,
    angDiamArcsec: 50,
    note: "at opposition",
  },
  {
    name: "Mars (closest)",
    appMag: -2.9,
    angDiamArcmin: null,
    angDiamArcsec: 25,
    note: "at closest approach",
  },
  {
    name: "Sirius",
    appMag: -1.46,
    angDiamArcmin: null,
    angDiamArcsec: null,
    note: "brightest star",
  },
];

export function convertPlanetRadiusEarthToKm(radiusEarth) {
  return Math.max(0.000001, toFinite(radiusEarth, 1)) * EARTH_RADIUS_KM;
}

export function convertGasGiantRadiusRjToKm(radiusRj) {
  return normalizeGasGiantRadiusKm(radiusRj);
}

/**
 * Convert Bond albedo to geometric albedo using the phase integral
 * for the given body type.
 *
 * @param {number} bondAlbedo  Bond (spherical) albedo
 * @param {number} bodyType    Body type code (1–4)
 * @returns {number} Geometric albedo
 */
export function bondToGeometricAlbedo(bondAlbedo, bodyType) {
  const q = PHASE_INTEGRAL[bodyType] || 0.48;
  const bond = clamp(toFinite(bondAlbedo, 0.3), 0.000001, 1);
  return bond / q;
}

export { classifyBodyType, BODY_TYPE_LABEL, formatAngularLabel };
