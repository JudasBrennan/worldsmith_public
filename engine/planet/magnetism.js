// SPDX-License-Identifier: MPL-2.0
import { fmt } from "../utils.js";

function rawFieldStrength(cmf, densityGcm3, radiusEarth, massEarth, convBoost) {
  const coreRadiusFraction = Math.sqrt(cmf);
  const coreDensity = (cmf * densityGcm3) / Math.max(coreRadiusFraction ** 3, 1e-12);
  const densityFactor = Math.sqrt(coreDensity);
  const geometryFactor = coreRadiusFraction ** 3;
  const heatFactor = massEarth ** (1 / 3);
  return densityFactor * geometryFactor * heatFactor * convBoost;
}

function coreConvBoost(solidFraction) {
  if (solidFraction < 0.5) return 1 + 0.4 * solidFraction;
  if (solidFraction < 0.85) return 1.2;
  const x = (solidFraction - 0.85) / 0.15;
  return 1.2 * Math.exp(-2.5 * x);
}

const EARTH_CMF = 0.33;
const EARTH_DENSITY = 5.514;
const EARTH_TAU_CORE = 2 + 12 * EARTH_CMF * Math.sqrt(1.0);
const EARTH_SOLID_FRAC = Math.max(0, Math.min(1, 4.6 / EARTH_TAU_CORE));
const EARTH_CONV_BOOST = coreConvBoost(EARTH_SOLID_FRAC);
const EARTH_RAW_FIELD = rawFieldStrength(EARTH_CMF, EARTH_DENSITY, 1.0, 1.0, EARTH_CONV_BOOST);

export function magneticFieldModel({
  cmf,
  massEarth,
  radiusEarth,
  densityGcm3,
  rotationPeriodHours,
  ageGyr,
  tidalFraction = 0,
  radioisotopeAbundance = 1,
}) {
  const none = {
    dynamoActive: false,
    dynamoReason: "",
    coreState: "solidified",
    fieldMorphology: "none",
    surfaceFieldEarths: 0,
    fieldLabel: "None",
  };

  if (cmf < 0.01) {
    return { ...none, dynamoReason: "No significant iron core (CMF < 1%)" };
  }

  const tauCoreBase = (2 + 12 * cmf * Math.sqrt(massEarth)) * Math.max(radioisotopeAbundance, 0.01);
  const tauCore = tidalFraction >= 1 ? Infinity : tauCoreBase / Math.max(0.01, 1 - tidalFraction);

  const tidallySustained = tidalFraction > 0.1;
  let coreState;
  if (ageGyr > tauCore * 1.5) {
    return {
      ...none,
      coreState: "solidified",
      dynamoReason: `Core fully solidified (~${fmt(tauCoreBase, 1)} Gyr base lifetime)`,
    };
  }
  if (ageGyr > tauCore * 0.3) {
    coreState = "partially solidified";
  } else {
    coreState = "fully liquid";
  }

  const solidFrac = Math.max(0, Math.min(1, ageGyr / tauCore));
  const convBoost = coreConvBoost(solidFrac);

  let surfaceFieldEarths = rawFieldStrength(cmf, densityGcm3, radiusEarth, massEarth, convBoost);
  surfaceFieldEarths /= EARTH_RAW_FIELD;

  const dipolarLimit = 96 * Math.sqrt(massEarth) * Math.sqrt(cmf / 0.33);
  const multipolarLimit = dipolarLimit * 50;
  const isDipolar = rotationPeriodHours <= dipolarLimit;

  if (rotationPeriodHours > multipolarLimit) {
    return {
      ...none,
      coreState,
      dynamoReason: "Rotation too slow to sustain dynamo (Rm below critical)",
    };
  }

  if (!isDipolar) {
    const x = Math.log2(rotationPeriodHours / dipolarLimit);
    const blend = 1 / (1 + Math.exp(-6 * (x - 0.5)));
    const multipolarFactor = 0.1;
    surfaceFieldEarths *= 1 - blend * (1 - multipolarFactor);
  }

  surfaceFieldEarths = Math.max(0, surfaceFieldEarths);

  if (surfaceFieldEarths < 0.005) {
    return {
      ...none,
      coreState,
      dynamoReason: "Field too weak to sustain measurable dynamo",
    };
  }

  let fieldLabel;
  if (surfaceFieldEarths > 2.0) fieldLabel = "Very strong";
  else if (surfaceFieldEarths > 0.5) fieldLabel = "Strong";
  else if (surfaceFieldEarths > 0.1) fieldLabel = "Moderate";
  else if (surfaceFieldEarths > 0.01) fieldLabel = "Weak";
  else fieldLabel = "Very weak";

  return {
    dynamoActive: true,
    dynamoReason: tidallySustained
      ? `Active dynamo (core ${coreState}, tidally sustained)`
      : `Active dynamo (core ${coreState}, ~${fmt(tauCore, 1)} Gyr lifetime)`,
    coreState,
    fieldMorphology: isDipolar ? "dipolar" : "multipolar",
    surfaceFieldEarths,
    fieldLabel,
  };
}
