// SPDX-License-Identifier: MPL-2.0
import { clamp, fmt, toFinite } from "./utils.js";
import { compositionFromClass, compositionFromDensity } from "./moon/composition.js";
import { computeMoonOrbit } from "./moon/orbit.js";
import {
  analyseMoonVolatiles,
  computeMagnetosphericRadiation,
  radiationLabel,
} from "./moon/retention.js";
import { computeMoonTemperature } from "./moon/temperature.js";
import { computeMoonTidalState, formatOrbitalFate, formatRecession } from "./moon/tides.js";
import { calcPlanetExact } from "./planet.js";
import { massToLuminosity, massToRadius } from "./star.js";

export { compositionFromDensity } from "./moon/composition.js";

function buildMoonSummaryResult({
  mStarMsol,
  rStarRsol,
  lStarLsol,
  ageGyr,
  mPlanetME,
  rhoPlanetGcm3,
  rPlanetRE,
  aPlanetAU,
  ePlanet,
  rotPlanetHours,
  mMoonMM,
  rhoMoonGcm3,
  albedo,
  aMoonKmInput,
  eMoon,
  inc,
  initialRotHours,
  rMoonRM,
  gMoonG,
  vEscKmS,
  orbit,
  temperature,
}) {
  return {
    star: { massMsol: mStarMsol, radiusRsol: rStarRsol, luminosityLsol: lStarLsol, ageGyr },
    planet: {
      massEarth: mPlanetME,
      densityGcm3: rhoPlanetGcm3,
      radiusEarth: rPlanetRE,
      semiMajorAxisAu: aPlanetAU,
      eccentricity: ePlanet,
      rotationPeriodHours: rotPlanetHours,
    },
    inputs: {
      massMoon: mMoonMM,
      densityGcm3: rhoMoonGcm3,
      albedo,
      semiMajorAxisKmInput: aMoonKmInput,
      semiMajorAxisKm: orbit.semiMajorAxisKm,
      eccentricity: eMoon,
      inclinationDeg: inc,
      initialRotationPeriodHours: initialRotHours,
    },
    physical: {
      radiusMoon: rMoonRM,
      gravityG: gMoonG,
      escapeVelocityKmS: vEscKmS,
    },
    orbit: {
      moonZoneInnerKm: orbit.zoneInnerKm,
      moonZoneOuterKm: orbit.zoneOuterKm,
      semiMajorAxisGuard: orbit.semiMajorAxisGuard,
      orbitalDirection: orbit.orbitalDirection,
      orbitalPeriodSiderealDays: orbit.orbitalPeriodSiderealDays,
      orbitalPeriodSynodicDays: orbit.orbitalPeriodSynodicDays,
    },
    temperature: {
      equilibriumK: Math.round(temperature.equilibriumK),
      surfaceK: temperature.surfaceK,
      surfaceC: temperature.surfaceC,
      radiogenicWm2: temperature.radiogenicWm2,
    },
  };
}

export function calcMoonExact({
  starMassMsol,
  starAgeGyr,
  starRadiusRsolOverride,
  starLuminosityLsolOverride,
  starTempKOverride,
  starEvolutionMode,
  planet,
  moon,
  parentOverride,
  detailLevel = "full",
}) {
  const parent =
    parentOverride ||
    calcPlanetExact({
      starMassMsol,
      starAgeGyr,
      starRadiusRsolOverride,
      starLuminosityLsolOverride,
      starTempKOverride,
      starEvolutionMode,
      planet,
      detailLevel: detailLevel === "summary" ? "summary" : "full",
    });

  const mStarMsol = clamp(starMassMsol, 0.01, 100);
  const ageGyr = clamp(starAgeGyr, 0, 20);

  const mPlanetME = clamp(parent.inputs.massEarth, 0.001, 10000);
  const rhoPlanetGcm3 = clamp(parent.derived.densityGcm3, 0.1, 100);
  const rPlanetRE = clamp(parent.derived.radiusEarth, 0.01, 1000);
  const aPlanetAU = clamp(parent.inputs.semiMajorAxisAu, 0.001, 1e6);
  const ePlanet = clamp(parent.inputs.eccentricity, 0, 0.99);
  const rotPlanetHours = clamp(parent.inputs.rotationPeriodHours, 0.1, 1e6);
  const surfaceFieldEarths = clamp(parent.derived?.surfaceFieldEarths ?? 0, 0, 1000);
  const radioisotopeAbundance = clamp(parent.derived?.radioisotopeAbundance ?? 1, 0.01, 5);

  const mMoonMM = clamp(moon.massMoon ?? 1.0, 0.001, 10000);
  const rhoMoonGcm3 = clamp(moon.densityGcm3 ?? 3.34, 0.1, 100);
  const albedo = clamp(moon.albedo ?? 0.11, 0, 0.95);
  const aMoonKmInput = clamp(moon.semiMajorAxisKm ?? 384748, 10, 1e9);
  const eMoon = clamp(moon.eccentricity ?? 0.055, 0, 0.99);
  const inc = clamp(moon.inclinationDeg ?? 5.15, 0, 180);
  const initialRotHours = moon.initialRotationPeriodHours
    ? toFinite(moon.initialRotationPeriodHours, 12)
    : 12;

  const rStarRsol = massToRadius(mStarMsol);
  const lStarLsol = massToLuminosity(mStarMsol);

  const rMoonRM = (mMoonMM / (rhoMoonGcm3 / 3.34)) ** (1 / 3);
  const gMoonG = (mMoonMM / rMoonRM ** 2) * 0.1654;
  const vEscKmS = Math.sqrt(mMoonMM / rMoonRM) * 2.38;

  const orbit = computeMoonOrbit({
    starMassMsol: mStarMsol,
    planetMassEarth: mPlanetME,
    planetDensityGcm3: rhoPlanetGcm3,
    planetRadiusEarth: rPlanetRE,
    planetSemiMajorAxisAu: aPlanetAU,
    planetEccentricity: ePlanet,
    moonMassMoon: mMoonMM,
    moonDensityGcm3: rhoMoonGcm3,
    moonSemiMajorAxisKmInput: aMoonKmInput,
    moonEccentricity: eMoon,
    moonInclinationDeg: inc,
  });

  const moonComposition =
    (moon.compositionOverride && compositionFromClass(moon.compositionOverride)) ||
    compositionFromDensity(rhoMoonGcm3);

  const tides = computeMoonTidalState({
    systemAgeGyr: ageGyr,
    starMassMsol: mStarMsol,
    planetMassEarth: mPlanetME,
    planetDensityGcm3: rhoPlanetGcm3,
    planetRadiusEarth: rPlanetRE,
    planetSemiMajorAxisAu: aPlanetAU,
    planetRotationHours: rotPlanetHours,
    moonMassMoon: mMoonMM,
    moonDensityGcm3: rhoMoonGcm3,
    moonRadiusMoon: rMoonRM,
    moonGravityG: gMoonG,
    moonSemiMajorAxisKm: orbit.semiMajorAxisKm,
    moonEccentricity: eMoon,
    initialRotationPeriodHours: initialRotHours,
    zoneInnerKm: orbit.zoneInnerKm,
    zoneOuterKm: orbit.zoneOuterKm,
    orbitalPeriodSiderealDays: orbit.orbitalPeriodSiderealDays,
    orbitalPeriodSynodicDays: orbit.orbitalPeriodSynodicDays,
    composition: moonComposition,
    hasCompositionOverride: Boolean(moon.compositionOverride),
  });

  const temperature = computeMoonTemperature({
    albedo,
    planetSemiMajorAxisAu: aPlanetAU,
    starLuminosityLsol: lStarLsol,
    surfaceAreaM2: tides.surfaceAreaM2,
    moonMassKg: tides.moonMassKg,
    radioisotopeAbundance,
    tidalHeatingWm2: tides.tidalHeatingWm2,
  });

  if (detailLevel === "summary") {
    return buildMoonSummaryResult({
      mStarMsol,
      rStarRsol,
      lStarLsol,
      ageGyr,
      mPlanetME,
      rhoPlanetGcm3,
      rPlanetRE,
      aPlanetAU,
      ePlanet,
      rotPlanetHours,
      mMoonMM,
      rhoMoonGcm3,
      albedo,
      aMoonKmInput,
      eMoon,
      inc,
      initialRotHours,
      rMoonRM,
      gMoonG,
      vEscKmS,
      orbit,
      temperature,
    });
  }

  const volatileResults = analyseMoonVolatiles(
    rhoMoonGcm3,
    temperature.surfaceK,
    vEscKmS,
    tides.moonGravityMs2,
    ageGyr,
    tides.tidalFeedbackActive,
  );
  const retainedVolatiles = volatileResults.filter(
    (volatile) => volatile.status === "Thin atmosphere",
  );
  const primaryAtmosphere =
    retainedVolatiles.length > 0
      ? retainedVolatiles.reduce((left, right) =>
          left.pressurePa > right.pressurePa ? left : right,
        )
      : null;
  const stableIces = volatileResults.filter((volatile) => volatile.status === "Stable ice");

  const radiation = computeMagnetosphericRadiation({
    surfaceFieldEarths,
    magnetopauseRp: parent.derived?.magnetopauseRp,
    planetSemiMajorAxisAu: aPlanetAU,
    planetRadiusEarth: rPlanetRE,
    moonSemiMajorAxisKm: orbit.semiMajorAxisKm,
  });

  return {
    star: { massMsol: mStarMsol, radiusRsol: rStarRsol, luminosityLsol: lStarLsol, ageGyr },
    planet: {
      massEarth: mPlanetME,
      cmfPct: parent.inputs.cmfPct,
      densityGcm3: rhoPlanetGcm3,
      radiusEarth: rPlanetRE,
      gravityG: parent.derived.gravityG,
      semiMajorAxisAu: aPlanetAU,
      eccentricity: ePlanet,
      periapsisAu: orbit.periPlanetAu,
      orbitalPeriodDays: orbit.periodPlanetDays,
      rotationPeriodHours: rotPlanetHours,
    },

    inputs: {
      massMoon: mMoonMM,
      densityGcm3: rhoMoonGcm3,
      albedo,
      semiMajorAxisKmInput: aMoonKmInput,
      semiMajorAxisKm: orbit.semiMajorAxisKm,
      eccentricity: eMoon,
      inclinationDeg: inc,
      initialRotationPeriodHours: initialRotHours,
    },

    physical: {
      radiusMoon: rMoonRM,
      gravityG: gMoonG,
      escapeVelocityKmS: vEscKmS,
    },

    orbit: {
      moonZoneInnerKm: orbit.zoneInnerKm,
      moonZoneOuterKm: orbit.zoneOuterKm,
      semiMajorAxisAllowedMinKm: orbit.minAMoonKm,
      semiMajorAxisAllowedMaxKm: orbit.maxAMoonKm,
      semiMajorAxisGuard: orbit.semiMajorAxisGuard,
      periapsisKm: orbit.periapsisKm,
      apoapsisKm: orbit.apoapsisKm,
      orbitalDirection: orbit.orbitalDirection,
      orbitalPeriodSiderealDays: orbit.orbitalPeriodSiderealDays,
      orbitalPeriodSynodicDays: orbit.orbitalPeriodSynodicDays,
      rotationPeriodDays: tides.rotationPeriodDays,
    },

    temperature: {
      equilibriumK: Math.round(temperature.equilibriumK),
      surfaceK: temperature.surfaceK,
      surfaceC: temperature.surfaceC,
      radiogenicWm2: temperature.radiogenicWm2,
    },

    volatiles: {
      inventory: volatileResults,
      primaryAtmosphere: primaryAtmosphere ? primaryAtmosphere.species : null,
      surfacePressurePa: primaryAtmosphere ? primaryAtmosphere.pressurePa : 0,
      hasVolatileAtmosphere: retainedVolatiles.length > 0,
    },

    radiation: {
      magnetosphericRadRemDay: radiation.magnetosphericRadRemDay,
      magnetosphericLabel: radiationLabel(radiation.magnetosphericRadRemDay),
      magnetopauseLShell: radiation.magnetopauseLShell,
      bAtMoonGauss: radiation.bAtMoonGauss,
      lShell: radiation.lShell,
      insideMagnetosphere: radiation.insideMagnetosphere,
    },

    tides: {
      totalEarthTides: tides.totalEarthTides,
      moonContributionPct: tides.moonContributionPct,
      starContributionPct: tides.starContributionPct,
      tidalHeatingW: tides.tidalHeatingW,
      tidalHeatingWm2: tides.tidalHeatingWm2,
      tidalHeatingEarth: tides.tidalHeatingEarth,
      compositionClass: tides.compositionClass,
      k2Moon: tides.k2Moon,
      qMoon: tides.qMoon,
      rigidityMoonGPa: tides.rigidityMoonGPa,
      compositionOverride: moon.compositionOverride || null,
      tidalFeedbackActive: tides.tidalFeedbackActive,
      meltFraction: tides.meltFraction,
      qEffective: tides.qEffective,
      rigidityEffectiveGPa: tides.rigidityEffectiveGPa,
      recessionCmYr: tides.recessionCmYr,
      timeToRocheGyr: tides.timeToRocheGyr,
      timeToEscapeGyr: tides.timeToEscapeGyr,
      moonLockedToPlanet: tides.moonLockedToPlanet,
      planetLockedToMoon: tides.planetLockedToMoon,
      planetLockedToStar: tides.planetLockedToStar,
      lockingTimesGyr: tides.lockingTimesGyr,
    },

    display: {
      radius: `${fmt(rMoonRM, 3)} R☾`,
      gravity: `${fmt(gMoonG, 3)} g`,
      esc: `${fmt(vEscKmS, 2)} km/s`,
      equilibriumTemp: `${Math.round(temperature.equilibriumK)} K`,
      surfaceTemp: `${temperature.surfaceK} K (${temperature.surfaceC} °C)`,
      zoneInner: `${fmt(orbit.zoneInnerKm, 0)} km`,
      zoneOuter: `${fmt(orbit.zoneOuterKm, 0)} km`,
      peri: `${fmt(orbit.periapsisKm, 0)} km`,
      apo: `${fmt(orbit.apoapsisKm, 0)} km`,
      sidereal: `${fmt(orbit.orbitalPeriodSiderealDays, 3)} days`,
      synodic: `${fmt(orbit.orbitalPeriodSynodicDays, 3)} days`,
      rot:
        tides.rotationPeriodDays === null
          ? "Not tidally locked"
          : tides.moonLockedToPlanet === "Yes"
            ? `${fmt(tides.rotationPeriodDays, 3)} days (locked)`
            : `${fmt(tides.rotationPeriodDays, 3)} days (est.)`,
      initialRot: `${fmt(initialRotHours, 2)} hours`,
      tides: `${fmt(tides.totalEarthTides, 3)} Earth tides`,
      moonPct: `${fmt(tides.moonContributionPct, 1)} %`,
      starPct: `${fmt(tides.starContributionPct, 1)} %`,
      compositionClass: tides.tidalFeedbackActive
        ? `${tides.compositionClass} (partially molten)`
        : tides.compositionClass,
      tidalHeating:
        tides.tidalHeatingWm2 < 1e-6
          ? "Negligible"
          : tides.tidalHeatingWm2 < 0.001
            ? `${tides.tidalHeatingWm2.toExponential(2)} W/m²`
            : `${fmt(tides.tidalHeatingWm2, 4)} W/m²`,
      tidalHeatingTotal:
        tides.tidalHeatingW < 1
          ? "Negligible"
          : tides.tidalHeatingW < 1e6
            ? `${fmt(tides.tidalHeatingW, 0)} W`
            : `${tides.tidalHeatingW.toExponential(2)} W`,
      tidalHeatingXEarth:
        tides.tidalHeatingEarth < 1e-4 ? "Negligible" : `${fmt(tides.tidalHeatingEarth, 2)}× Earth`,
      radiogenicHeating:
        temperature.radiogenicWm2 < 1e-6
          ? "Negligible"
          : temperature.radiogenicWm2 < 0.001
            ? `${temperature.radiogenicWm2.toExponential(2)} W/m²`
            : `${fmt(temperature.radiogenicWm2, 4)} W/m²`,
      magnetosphericRad:
        radiation.magnetosphericRadRemDay < 0.001
          ? "Negligible"
          : radiation.magnetosphericRadRemDay < 1
            ? `${fmt(radiation.magnetosphericRadRemDay, 3)} rem/day`
            : radiation.magnetosphericRadRemDay < 1000
              ? `${fmt(radiation.magnetosphericRadRemDay, 1)} rem/day`
              : `${radiation.magnetosphericRadRemDay.toExponential(2)} rem/day`,
      magnetosphericLabel: radiationLabel(radiation.magnetosphericRadRemDay),
      recession: formatRecession(tides.recessionCmYr),
      orbitalFate: formatOrbitalFate(tides.dadtTotal, tides.timeToRocheGyr, tides.timeToEscapeGyr),
      moonLocked: tides.moonLockedToPlanet,
      planetLockedMoon: tides.planetLockedToMoon || "—",
      planetLockedStar: tides.planetLockedToStar,
      surfaceIces: stableIces.map((volatile) => volatile.species).join(", ") || "None",
      volatileAtmosphere: primaryAtmosphere
        ? primaryAtmosphere.pressurePa >= 1
          ? `${primaryAtmosphere.species} (~${fmt(primaryAtmosphere.pressurePa, 0)} Pa)`
          : `${primaryAtmosphere.species} (~${primaryAtmosphere.pressurePa.toExponential(1)} Pa)`
        : "None",
      tMoonLock: `${fmt(tides.lockingTimesGyr.moonToPlanet, 6)} Gyr`,
      tPlanetMoon: `${fmt(tides.lockingTimesGyr.planetToMoon, 6)} Gyr`,
      tPlanetStar: `${fmt(tides.lockingTimesGyr.planetToStar, 6)} Gyr`,
    },
  };
}

export const calcMoon = calcMoonExact;
