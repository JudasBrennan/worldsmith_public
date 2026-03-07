import { escapeTimescaleSeconds } from "../utils.js";

const DEFAULT_EARTH_XUV_FLUX_ERG_CM2_S = 4.64;
const DEFAULT_SOLAR_AGE_GYR = 4.6;
const DEFAULT_XUV_AGE_EXPONENT = -1.23;
const DEFAULT_MIN_STELLAR_AGE_GYR = 0.1;

const DEFAULT_JEANS_RETAINED = 6;
const DEFAULT_JEANS_MARGINAL = 3;
const DEFAULT_NON_THERMAL_TEMP_FLOOR_K = 100;
const DEFAULT_NON_THERMAL_FACTORS = [
  { maxMw: 0.002, factor: 3.0 },
  { maxMw: 0.004, factor: 5.0 },
];

function roundToDigits(value, digits) {
  const scale = 10 ** digits;
  return Math.round(value * scale) / scale;
}

function nonThermalThresholdFactor(molecularWeight, nonThermalFactors) {
  for (const rule of nonThermalFactors) {
    if (molecularWeight <= rule.maxMw) return rule.factor;
  }
  return 1;
}

export function xuvFluxAtOrbitErgCm2S({
  starLuminosityLsol,
  starAgeGyr,
  orbitAu,
  earthXuvFluxErgCm2S = DEFAULT_EARTH_XUV_FLUX_ERG_CM2_S,
  solarAgeGyr = DEFAULT_SOLAR_AGE_GYR,
  ageExponent = DEFAULT_XUV_AGE_EXPONENT,
  minStellarAgeGyr = DEFAULT_MIN_STELLAR_AGE_GYR,
}) {
  if (orbitAu <= 0) return 0;
  const stellarAgeGyr = Math.max(minStellarAgeGyr, starAgeGyr);
  const fluxAt1Au =
    earthXuvFluxErgCm2S * starLuminosityLsol * (stellarAgeGyr / solarAgeGyr) ** ageExponent;
  return fluxAt1Au / orbitAu ** 2;
}

export function xuvFluxRatioEarth(options) {
  const earthXuvFluxErgCm2S = options.earthXuvFluxErgCm2S ?? DEFAULT_EARTH_XUV_FLUX_ERG_CM2_S;
  return (
    xuvFluxAtOrbitErgCm2S({
      ...options,
      earthXuvFluxErgCm2S,
    }) / earthXuvFluxErgCm2S
  );
}

export function jeansStatus(
  lambda,
  { retainedThreshold = DEFAULT_JEANS_RETAINED, marginalThreshold = DEFAULT_JEANS_MARGINAL } = {},
) {
  if (lambda >= retainedThreshold) return "Retained";
  if (lambda >= marginalThreshold) return "Marginal";
  return "Lost";
}

export function effectiveJeansStatus({
  lambda,
  molecularWeight,
  exobaseTempK,
  retainedThreshold = DEFAULT_JEANS_RETAINED,
  marginalThreshold = DEFAULT_JEANS_MARGINAL,
  nonThermalTempFloorK = DEFAULT_NON_THERMAL_TEMP_FLOOR_K,
  nonThermalFactors = DEFAULT_NON_THERMAL_FACTORS,
}) {
  const thermal = jeansStatus(lambda, {
    retainedThreshold,
    marginalThreshold,
  });
  if (exobaseTempK <= nonThermalTempFloorK) return thermal;
  const factor = nonThermalThresholdFactor(molecularWeight, nonThermalFactors);
  if (factor <= 1) return thermal;
  return jeansStatus(lambda, {
    retainedThreshold: retainedThreshold * factor,
    marginalThreshold: marginalThreshold * factor,
  });
}

export function evaluateJeansEscapeSpecies({
  escapeVelocityKms,
  exobaseTempK,
  gasSpecies,
  retainedThreshold = DEFAULT_JEANS_RETAINED,
  marginalThreshold = DEFAULT_JEANS_MARGINAL,
  nonThermalTempFloorK = DEFAULT_NON_THERMAL_TEMP_FLOOR_K,
  nonThermalFactors = DEFAULT_NON_THERMAL_FACTORS,
  lambdaDigits = null,
}) {
  const escapeVelocityMs = escapeVelocityKms * 1000;
  const escapeVelocitySquared = escapeVelocityMs * escapeVelocityMs;
  const denominator = 2 * 8.3145 * Math.max(exobaseTempK, 1);
  const species = {};

  for (const gas of gasSpecies) {
    const lambda = (escapeVelocitySquared * gas.mw) / denominator;
    const thermal = jeansStatus(lambda, {
      retainedThreshold,
      marginalThreshold,
    });
    const status = effectiveJeansStatus({
      lambda,
      molecularWeight: gas.mw,
      exobaseTempK,
      retainedThreshold,
      marginalThreshold,
      nonThermalTempFloorK,
      nonThermalFactors,
    });

    species[gas.key] = {
      lambda: Number.isInteger(lambdaDigits) ? roundToDigits(lambda, lambdaDigits) : lambda,
      thermalStatus: thermal,
      status,
      nonThermal: status !== thermal,
      label: gas.label,
    };
  }

  return species;
}

export function evaluateVolatileRetention({
  pressurePa,
  gravityMs2,
  massAmu,
  tempK,
  lambda,
  ageGyr,
  minimumLambdaExclusive = DEFAULT_JEANS_RETAINED,
}) {
  if (!(lambda > minimumLambdaExclusive)) {
    return { retained: false, escapeSeconds: 0 };
  }

  const escapeSeconds = escapeTimescaleSeconds(pressurePa, gravityMs2, massAmu, tempK, lambda);
  return {
    retained: escapeSeconds > Math.max(0, ageGyr) * 3.156e16,
    escapeSeconds,
  };
}
