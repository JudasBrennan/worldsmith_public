// SPDX-License-Identifier: MPL-2.0
import { clamp, fmt, round, toFinite } from "./utils.js";
import { findNearestResonance } from "./debrisDisk.js";
import { calcDynamics, calcOblateness } from "./gasGiant/dynamics.js";
import {
  calcMassLoss,
  computeGasGiantExobaseTemp,
  computeGasGiantJeansEscape,
} from "./gasGiant/escape.js";
import { calcMagnetic } from "./gasGiant/magnetism.js";
import { gasGiantK2, gasGiantTidalQ, totalGasGiantTidalHeating } from "./gasGiant/moonEffects.js";
import { calcRingProperties } from "./gasGiant/rings.js";
import {
  calcAgeRadiusCorrection,
  calcInterior,
  estimateMetallicity,
  getAtmosphere,
  massToRadiusRj,
  radiusToMassMjup,
  stellarMetallicityScaleFromFeH,
} from "./gasGiant/structure.js";
import { computeThermalProfile, getClouds } from "./gasGiant/temperature.js";
import { calcTidalEffects } from "./gasGiant/tides.js";
import {
  auToKilometers,
  calcOrbitalPeriodDaysKepler,
  calcOrbitalPeriodYearsKepler,
  orbitalDirectionFromInclination,
} from "./physics/orbital.js";
import { selectSpinOrbitResonance } from "./physics/rotation.js";

export { estimateMetallicity, massToRadiusRj, radiusToMassMjup } from "./gasGiant/structure.js";

const G = 6.674e-11;
const JUPITER_MASS_KG = 1.8982e27;
const JUPITER_RADIUS_KM = 69911;
const EARTH_RADIUS_KM = 6371;
const EARTH_MASS_PER_MJUP = 317.83;
const MSOL_PER_MJUP = 1047.35;
const EARTH_GRAVITY_MS2 = 9.80665;
const ICE_GIANT_MASS_MJUP = 0.15;

function buildGasGiantSummaryResult({
  massMjup,
  radiusRj,
  orbitAu,
  eccentricity,
  inclinationDeg,
  axialTiltDeg,
  rotationPeriodHours,
  massSource,
  radiusSource,
  metallicitySource,
  massEarth,
  massKg,
  radiusKm,
  radiusEarth,
  densityGcm3,
  gravityMs2,
  gravityG,
  escapeVelocityKms,
  effectiveTempK,
  equilibriumTempK,
  ringType,
  orbitalPeriodYears,
  orbitalPeriodDays,
}) {
  return {
    inputs: {
      massMjup,
      radiusRj,
      orbitAu,
      eccentricity,
      inclinationDeg,
      axialTiltDeg,
      rotationPeriodHours,
      massSource,
      radiusSource,
      metallicitySource,
    },
    physical: {
      massEarth: round(massEarth, 2),
      massMjup: round(massMjup, 4),
      massKg,
      radiusKm: round(radiusKm, 0),
      radiusEarth: round(radiusEarth, 3),
      radiusRj: round(radiusRj, 3),
      densityGcm3: round(densityGcm3, 4),
      gravityMs2: round(gravityMs2, 2),
      gravityG: round(gravityG, 3),
      escapeVelocityKms: round(escapeVelocityKms, 2),
    },
    thermal: {
      equilibriumTempK: round(equilibriumTempK, 1),
      effectiveTempK: round(effectiveTempK, 1),
    },
    ringProperties: {
      ringType,
    },
    orbital: {
      orbitalPeriodYears: round(orbitalPeriodYears, 4),
      orbitalPeriodDays: round(orbitalPeriodDays, 2),
    },
  };
}

export function calcGasGiant({
  massMjup: rawMass,
  radiusRj: rawRadius,
  orbitAu,
  eccentricity: rawEcc,
  inclinationDeg: rawIncl,
  axialTiltDeg: rawTilt,
  rotationPeriodHours,
  metallicity: rawMetallicity,
  starMassMsol,
  starLuminosityLsol,
  starAgeGyr,
  starRadiusRsol,
  stellarMetallicityFeH,
  otherGiants,
  moons,
  detailLevel = "full",
}) {
  const orbit = clamp(toFinite(orbitAu, 5.2), 0.01, 1e6);
  const eccentricity = clamp(toFinite(rawEcc, 0), 0, 0.99);
  const inclinationDeg = clamp(toFinite(rawIncl, 0), 0, 180);
  const axialTiltDeg = clamp(toFinite(rawTilt, 0), 0, 180);
  const rot = clamp(toFinite(rotationPeriodHours, 10), 1, 100);
  const sMass = clamp(toFinite(starMassMsol, 1), 0.075, 100);
  const sLum = Math.max(0.0001, toFinite(starLuminosityLsol, 1));
  const sAge = clamp(toFinite(starAgeGyr, 4.6), 0.01, 15);
  const giantMoons = Array.isArray(moons) ? moons : [];
  void starRadiusRsol;

  let massMjup;
  let radiusRj;
  let massSource;
  let radiusSource;

  const hasMass = rawMass != null && Number.isFinite(Number(rawMass)) && Number(rawMass) > 0;
  const hasRadius =
    rawRadius != null && Number.isFinite(Number(rawRadius)) && Number(rawRadius) > 0;

  if (hasMass && hasRadius) {
    massMjup = clamp(Number(rawMass), 0.01, 13);
    radiusRj = clamp(Number(rawRadius), 0.15, 2.5);
    massSource = "user";
    radiusSource = "user";
  } else if (hasMass) {
    massMjup = clamp(Number(rawMass), 0.01, 13);
    radiusRj = clamp(massToRadiusRj(massMjup), 0.15, 2.5);
    massSource = "user";
    radiusSource = "derived";
  } else if (hasRadius) {
    radiusRj = clamp(Number(rawRadius), 0.15, 2.5);
    massMjup = clamp(radiusToMassMjup(radiusRj), 0.01, 13);
    massSource = "derived";
    radiusSource = "user";
  } else {
    massMjup = 1;
    radiusRj = 1;
    massSource = "default";
    radiusSource = "default";
  }

  const massEarth = massMjup * EARTH_MASS_PER_MJUP;
  const massKg = massMjup * JUPITER_MASS_KG;
  const radiusKm = radiusRj * JUPITER_RADIUS_KM;
  const radiusEarth = radiusKm / EARTH_RADIUS_KM;
  const radiusM = radiusKm * 1000;
  const volumeM3 = (4 / 3) * Math.PI * radiusM ** 3;
  const densityKgM3 = massKg / volumeM3;
  const densityGcm3 = densityKgM3 / 1000;
  const gravityMs2 = (G * massKg) / radiusM ** 2;
  const gravityG = gravityMs2 / EARTH_GRAVITY_MS2;
  const escapeVelocityMs = Math.sqrt((2 * G * massKg) / radiusM);
  const escapeVelocityKms = escapeVelocityMs / 1000;

  const thermal = computeThermalProfile({
    massMjup,
    orbitAu: orbit,
    starLuminosityLsol: sLum,
    eccentricity,
  });
  const sudarsky = thermal.sudarsky;
  const teqK = thermal.equilibriumTempK;
  const ihRatio = thermal.internalHeatRatio;
  const tEffK = thermal.effectiveTempK;
  const internalFlux = thermal.internalFluxWm2;

  const surfaceAreaM2 = 4 * Math.PI * radiusM ** 2;
  const ggK2 = gasGiantK2(massMjup);
  const ggQ = gasGiantTidalQ(massMjup);
  const moonTidalHeatingW = totalGasGiantTidalHeating(giantMoons, ggK2, ggQ, massKg, radiusM);
  const moonTidalHeatingWm2 = surfaceAreaM2 > 0 ? moonTidalHeatingW / surfaceAreaM2 : 0;
  const moonTidalFraction = internalFlux > 0 ? moonTidalHeatingWm2 / internalFlux : 0;

  const periapsisAu = thermal.periapsisAu;
  const apoapsisAu = thermal.apoapsisAu;
  const teqPeriK = thermal.equilibriumTempPeriK;
  const teqApoK = thermal.equilibriumTempApoK;
  const tEffPeriK = thermal.effectiveTempPeriK;
  const tEffApoK = thermal.effectiveTempApoK;
  const insolationEarth = thermal.insolationEarth;
  const isIceGiant = massMjup < ICE_GIANT_MASS_MJUP;

  const hasMetallicity =
    rawMetallicity != null && Number.isFinite(Number(rawMetallicity)) && Number(rawMetallicity) > 0;
  const metallicitySource = hasMetallicity ? "user" : "derived";
  const stellarFeH = clamp(toFinite(stellarMetallicityFeH, 0), -3, 1);
  const stellarMetallicityScale = stellarMetallicityScaleFromFeH(stellarFeH);
  const resolvedMetallicity = hasMetallicity
    ? clamp(Number(rawMetallicity), 0.1, 200)
    : clamp(estimateMetallicity(massMjup) * stellarMetallicityScale, 0.1, 200);

  const massRatio = massMjup / (sMass * MSOL_PER_MJUP);
  const hillSphereAu = orbit * (massRatio / 3) ** (1 / 3);
  const hillSphereKm = auToKilometers(hillSphereAu);
  const rocheLimitIceKm = 2.44 * radiusKm * (densityGcm3 / 0.9) ** (1 / 3);
  const rocheLimitRockKm = 2.44 * radiusKm * (densityGcm3 / 3.0) ** (1 / 3);
  const chaoticZoneHalfAu = orbit * 1.3 * massRatio ** (2 / 7);
  const ringProperties = calcRingProperties(massMjup, teqK, rocheLimitRockKm, rocheLimitIceKm);
  const orbitalPeriodYears = calcOrbitalPeriodYearsKepler({
    semiMajorAxisAu: orbit,
    centralMassMsol: sMass,
  });
  const orbitalPeriodDays = calcOrbitalPeriodDaysKepler({
    semiMajorAxisAu: orbit,
    centralMassMsol: sMass,
    daysPerYear: 365.25,
  });

  if (detailLevel === "summary") {
    return buildGasGiantSummaryResult({
      massMjup,
      radiusRj,
      orbitAu: orbit,
      eccentricity,
      inclinationDeg,
      axialTiltDeg,
      rotationPeriodHours: rot,
      massSource,
      radiusSource,
      metallicitySource,
      massEarth,
      massKg,
      radiusKm,
      radiusEarth,
      densityGcm3,
      gravityMs2,
      gravityG,
      escapeVelocityKms,
      effectiveTempK: tEffK,
      equilibriumTempK: teqK,
      ringType: ringProperties.ringType,
      orbitalPeriodYears,
      orbitalPeriodDays,
    });
  }

  const atmosphere = getAtmosphere(massMjup, tEffK, resolvedMetallicity);
  const clouds = getClouds(tEffK, isIceGiant);
  const magnetic = calcMagnetic({
    massMjup,
    radiusKm,
    densityGcm3,
    internalFluxWm2: internalFlux,
    moonTidalFluxWm2: moonTidalHeatingWm2,
    isIceGiant,
    orbitAu: orbit,
    moons: giantMoons,
    starLuminosityLsol: sLum,
    ageGyr: sAge,
  });

  const dynamics = calcDynamics(massMjup, radiusKm, rot, tEffK);
  const oblateness = calcOblateness(massMjup, radiusKm, rot, densityGcm3);
  const interior = calcInterior(massMjup);
  const massLoss = calcMassLoss(massMjup, radiusKm, orbit, sMass, sLum, sAge);
  const ggExobaseTempK = computeGasGiantExobaseTemp(tEffK, massLoss.xuvFluxRatioEarth);
  const ggJeansSpecies = computeGasGiantJeansEscape(escapeVelocityKms, ggExobaseTempK);
  const tidal = calcTidalEffects(massMjup, radiusKm, orbit, eccentricity, sMass, sAge);
  const ageRadius = calcAgeRadiusCorrection(massMjup, radiusRj, sAge, teqK);

  const eqRadiusM = oblateness.equatorialRadiusKm * 1000;
  const equatorialGravityMs2 = (G * massKg) / eqRadiusM ** 2;
  const equatorialGravityG = equatorialGravityMs2 / EARTH_GRAVITY_MS2;

  const orbitalVelocityKms = (2 * Math.PI * auToKilometers(orbit)) / (orbitalPeriodDays * 86400);
  const orbitalDirection = orbitalDirectionFromInclination(inclinationDeg);
  const localDaysPerYear = (orbitalPeriodDays * 24) / rot;
  const tidallyEvolved = tidal.isTidallyLocked;
  const resonance = tidallyEvolved ? selectSpinOrbitResonance({ eccentricity }) : null;
  const resonanceRotationHours = resonance ? (orbitalPeriodDays * 24) / resonance.p : null;
  const nearestResonance = findNearestResonance(
    orbit,
    Array.isArray(otherGiants) ? otherGiants : [],
  );

  let jeansDisplay = `Atmospheric escape (T_exo ${fmt(round(ggExobaseTempK, 0), 0)} K, XUV ${fmt(round(massLoss.xuvFluxRatioEarth, 2), 2)}× Earth):`;
  for (const species of Object.values(ggJeansSpecies)) {
    const nonThermalTag = species.nonThermal ? " (non-thermal)" : "";
    jeansDisplay += `\n  ${species.label}: λ=${fmt(species.lambda, 1)} — ${species.status}${nonThermalTag}`;
  }

  return {
    inputs: {
      massMjup,
      radiusRj,
      orbitAu: orbit,
      eccentricity,
      inclinationDeg,
      axialTiltDeg,
      rotationPeriodHours: rot,
      metallicitySolar: atmosphere.metallicitySolar,
      stellarMetallicityFeH: round(stellarFeH, 2),
      massSource,
      radiusSource,
      metallicitySource,
    },

    classification: {
      sudarsky: sudarsky.cls,
      label: sudarsky.label,
      subtype: sudarsky.subtype,
      cloudType: sudarsky.cloud,
    },

    physical: {
      massEarth: round(massEarth, 2),
      massMjup: round(massMjup, 4),
      massKg,
      radiusKm: round(radiusKm, 0),
      radiusEarth: round(radiusEarth, 3),
      radiusRj: round(radiusRj, 3),
      densityGcm3: round(densityGcm3, 4),
      gravityMs2: round(gravityMs2, 2),
      gravityG: round(gravityG, 3),
      equatorialGravityMs2: round(equatorialGravityMs2, 2),
      equatorialGravityG: round(equatorialGravityG, 3),
      escapeVelocityKms: round(escapeVelocityKms, 2),
      suggestedRadiusRj: ageRadius.suggestedRadiusRj,
      radiusInflationFactor: ageRadius.radiusInflationFactor,
      proximityInflationRj: ageRadius.proximityInflationRj,
      radiusAgeNote: ageRadius.radiusAgeNote,
    },

    thermal: {
      equilibriumTempK: round(teqK, 1),
      effectiveTempK: round(tEffK, 1),
      teqPeriK: round(teqPeriK, 1),
      teqApoK: round(teqApoK, 1),
      tEffPeriK: round(tEffPeriK, 1),
      tEffApoK: round(tEffApoK, 1),
      internalHeatRatio: round(ihRatio, 2),
      internalFluxWm2: round(internalFlux, 3),
      bondAlbedo: round(sudarsky.bondAlbedo, 3),
      insolationEarth: round(insolationEarth, 4),
      moonTidalHeatingW: round(moonTidalHeatingW, 0),
      moonTidalHeatingWm2: round(moonTidalHeatingWm2, 6),
      moonTidalFraction: round(moonTidalFraction, 4),
      k2: round(ggK2, 3),
      tidalQ: Math.round(ggQ),
    },

    atmosphere,
    clouds,
    magnetic,

    gravity: {
      hillSphereAu: round(hillSphereAu, 4),
      hillSphereKm: round(hillSphereKm, 0),
      rocheLimit_iceKm: round(rocheLimitIceKm, 0),
      rocheLimit_rockKm: round(rocheLimitRockKm, 0),
      chaoticZoneAu: round(chaoticZoneHalfAu, 4),
      ringZoneInnerKm: round(rocheLimitRockKm, 0),
      ringZoneOuterKm: round(rocheLimitIceKm, 0),
    },

    dynamics,
    oblateness,
    interior,
    massLoss,
    jeansEscape: {
      exobaseTempK: round(ggExobaseTempK, 0),
      xuvFluxRatio: round(massLoss.xuvFluxRatioEarth, 4),
      species: ggJeansSpecies,
    },
    tidal: {
      ...tidal,
      spinOrbitResonance: resonance ? resonance.ratio : null,
      resonanceRotationHours: resonanceRotationHours ? round(resonanceRotationHours, 2) : null,
    },
    ringProperties,

    orbital: {
      periapsisAu: round(periapsisAu, 4),
      apoapsisAu: round(apoapsisAu, 4),
      orbitalPeriodYears: round(orbitalPeriodYears, 4),
      orbitalPeriodDays: round(orbitalPeriodDays, 2),
      orbitalVelocityKms: round(orbitalVelocityKms, 2),
      orbitalDirection,
      localDaysPerYear: round(localDaysPerYear, 2),
      insolationEarth: round(insolationEarth, 4),
      nearestResonance,
    },

    appearance: {
      colourHex: sudarsky.hex,
      colourLabel: sudarsky.label,
    },

    display: {
      mass: `${fmt(massMjup, 3)} Mj (${fmt(massEarth, 1)} M⊕)`,
      radius: `${fmt(radiusRj, 3)} Rj (${fmt(radiusKm, 0)} km)`,
      density: `${fmt(densityGcm3, 3)} g/cm³`,
      gravity: `${fmt(equatorialGravityG, 2)} g (${fmt(equatorialGravityMs2, 1)} m/s²)`,
      escapeVelocity: `${fmt(escapeVelocityKms, 1)} km/s`,
      equilibriumTemp: `${fmt(teqK, 0)} K`,
      effectiveTemp: `${fmt(tEffK, 0)} K`,
      classification: sudarsky.label,
      hillSphere: `${fmt(hillSphereAu, 3)} AU (${fmt(hillSphereKm, 0)} km)`,
      rocheLimit: `${fmt(rocheLimitIceKm, 0)} km (ice) / ${fmt(rocheLimitRockKm, 0)} km (rock)`,
      magneticField: `${fmt(magnetic.surfaceFieldGauss, 2)} G (${magnetic.fieldLabel})`,
      magneticMorphology:
        magnetic.fieldMorphology.charAt(0).toUpperCase() + magnetic.fieldMorphology.slice(1),
      magnetosphere: `${fmt(magnetic.magnetopauseRp, 0)} Rp (${fmt(magnetic.magnetopauseKm, 0)} km)`,
      moonTidalHeating:
        moonTidalHeatingW > 0
          ? `${moonTidalHeatingW.toExponential(2)} W (${fmt(moonTidalFraction * 100, 2)}% of internal heat)`
          : "No moons assigned",
      sputteringPlasma:
        magnetic.sputteringPlasmaW > 0
          ? `${magnetic.sputteringPlasmaW.toExponential(2)} W equiv. (atmospheric sputtering)`
          : "None",
      bands: `${dynamics.bandCount} bands, ${dynamics.windDirection} winds`,
      windSpeed: `${fmt(dynamics.equatorialWindMs, 0)} m/s`,
      orbitalPeriod: `${fmt(orbitalPeriodYears, 2)} yr (${fmt(orbitalPeriodDays, 1)} days)`,
      orbitalVelocity: `${fmt(orbitalVelocityKms, 1)} km/s`,
      insolation: `${fmt(insolationEarth, 3)}× Earth`,
      peri: eccentricity > 0.005 ? `${fmt(periapsisAu, 4)} AU` : null,
      apo: eccentricity > 0.005 ? `${fmt(apoapsisAu, 4)} AU` : null,
      tempPeri:
        eccentricity > 0.005
          ? `T_eq ${fmt(Math.round(teqPeriK), 0)} K, T_eff ${fmt(Math.round(tEffPeriK), 0)} K`
          : null,
      tempApo:
        eccentricity > 0.005
          ? `T_eq ${fmt(Math.round(teqApoK), 0)} K, T_eff ${fmt(Math.round(tEffApoK), 0)} K`
          : null,
      orbitalDirection,
      localDaysPerYear: `${fmt(localDaysPerYear, 2)} local days`,
      resonance: nearestResonance
        ? `${nearestResonance.label} (${fmt(nearestResonance.resonanceAu, 3)} AU, ${fmt(nearestResonance.deltaPct * 100, 1)}% off)`
        : "No nearby resonance",
      chaoticZone: `±${fmt(chaoticZoneHalfAu, 3)} AU`,
      metallicity: `${fmt(atmosphere.metallicitySolar, 1)}× solar`,
      oblateness: `f = ${fmt(oblateness.flattening, 4)} (J₂ = ${fmt(oblateness.j2, 5)})`,
      equatorialRadius: `${fmt(oblateness.equatorialRadiusKm, 0)} km eq / ${fmt(oblateness.polarRadiusKm, 0)} km pol`,
      heavyElements: `${fmt(interior.totalHeavyElementsMearth, 1)} M⊕ total (core ≈ ${fmt(interior.estimatedCoreMassMearth, 1)} M⊕)`,
      bulkMetallicity: `Z = ${fmt(interior.bulkMetallicityFraction, 3)}`,
      massLossRate: `${massLoss.massLossRateKgS.toExponential(2)} kg/s`,
      evaporationTimescale:
        massLoss.evaporationTimescaleGyr >= 1e10
          ? "≫ Hubble time"
          : `${fmt(massLoss.evaporationTimescaleGyr, 2)} Gyr`,
      rocheLobeRadius: `${fmt(massLoss.rocheLobeRadiusKm, 0)} km${massLoss.rocheLobeOverflow ? " (OVERFLOW)" : ""}`,
      jeansEscape: jeansDisplay,
      suggestedRadius: `${fmt(ageRadius.suggestedRadiusRj, 3)} Rj at ${fmt(sAge, 1)} Gyr`,
      radiusAgeNote: ageRadius.radiusAgeNote,
      ringType: `${ringProperties.ringType} — ${ringProperties.ringComposition}`,
      ringDetails: `τ ≈ ${fmt(ringProperties.opticalDepth, 2)} (${ringProperties.opticalDepthClass}), ${ringProperties.estimatedMassKg.toExponential(2)} kg`,
      tidalLocking: `τ_lock = ${
        tidal.lockingTimescaleGyr >= 1e6 ? "≫ age" : `${fmt(tidal.lockingTimescaleGyr, 2)} Gyr`
      }${
        tidal.isTidallyLocked
          ? resonance && resonance.ratio !== "1:1"
            ? ` — Spin-orbit resonance (${resonance.ratio})`
            : " — Synchronous (1:1)"
          : ""
      }`,
      circularisation: `τ_circ = ${
        tidal.circularisationTimescaleGyr >= 1e6
          ? "≫ age"
          : `${fmt(tidal.circularisationTimescaleGyr, 2)} Gyr`
      }${tidal.isCircularised ? " — Circularised" : ""}`,
    },
  };
}
