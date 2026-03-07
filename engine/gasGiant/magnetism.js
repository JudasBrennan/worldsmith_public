import { clamp, round } from "../utils.js";
import { totalMoonSelfHeating, totalMoonSputteringPlasmaW } from "./moonEffects.js";

const JUPITER_MASS_KG = 1.8982e27;
const MU_0 = 4 * Math.PI * 1e-7;
const P_SW_1AU = 2.0e-9;

const JUPITER_SURFACE_GAUSS = 4.28;
const JUPITER_DENSITY_GCM3 = 1.326;
const Q_FLOOR_WM2 = 0.4;
const ICE_GIANT_REF_DENSITY = Math.sqrt(1.27 * 1.638);
const SHELL_EXPONENT = 3.2;
const JUPITER_INTERNAL_FLUX_WM2 = 5.53;
const ICE_GIANT_SURFACE_GAUSS = Math.sqrt(0.23 * 0.14);
const ICE_GIANT_REF_SHELL = 0.7;

const PLASMA_H_REF = 4e5;
const PLASMA_GAMMA = 0.047;
const PLASMA_H_THRESHOLD = 1e8;

export function dynamoShellRatio(massMjup, isIceGiant, densityGcm3) {
  if (isIceGiant) {
    return clamp(0.7 * (ICE_GIANT_REF_DENSITY / densityGcm3) ** 0.82, 0.5, 0.85);
  }
  const logRatio = Math.log(clamp(massMjup, 0.15, 13) / 0.3) / Math.log(1.0 / 0.3);
  return clamp(0.4 + 0.43 * logRatio, 0.3, 0.9);
}

export function rawGiantFieldStrength(densityGcm3, qEffWm2, shellRatio) {
  return Math.sqrt(densityGcm3) * Math.cbrt(qEffWm2) * shellRatio ** SHELL_EXPONENT;
}

const JUPITER_SHELL_RATIO = dynamoShellRatio(1.0, false, 0);
const JUPITER_RAW_FIELD = rawGiantFieldStrength(
  JUPITER_DENSITY_GCM3,
  Math.max(JUPITER_INTERNAL_FLUX_WM2, Q_FLOOR_WM2),
  JUPITER_SHELL_RATIO,
);

const ICE_GIANT_RAW_FIELD = rawGiantFieldStrength(
  ICE_GIANT_REF_DENSITY,
  Q_FLOOR_WM2,
  ICE_GIANT_REF_SHELL,
);

export function calcMagnetic({
  massMjup,
  radiusKm,
  densityGcm3,
  internalFluxWm2,
  moonTidalFluxWm2,
  isIceGiant,
  orbitAu,
  moons,
  starLuminosityLsol,
  ageGyr,
}) {
  const qTotal = internalFluxWm2 + moonTidalFluxWm2;
  const qEff = Math.max(qTotal, Q_FLOOR_WM2);
  const shell = dynamoShellRatio(massMjup, isIceGiant, densityGcm3);
  const rawField = rawGiantFieldStrength(densityGcm3, qEff, shell);
  const surfaceGauss = isIceGiant
    ? ICE_GIANT_SURFACE_GAUSS * (rawField / ICE_GIANT_RAW_FIELD)
    : JUPITER_SURFACE_GAUSS * (rawField / JUPITER_RAW_FIELD);
  const fieldMorphology = isIceGiant ? "multipolar" : "dipolar";

  const radiusM = radiusKm * 1000;
  const surfaceTesla = surfaceGauss * 1e-4;
  const dipoleMomentAm2 = (surfaceTesla * radiusM ** 3) / 1e-7;

  const bTesla = surfaceGauss * 1e-4;
  const pSw = P_SW_1AU / (orbitAu * orbitAu);
  const rCF = Math.pow((bTesla * bTesla) / (2 * MU_0 * pSw), 1 / 6);
  const massKg = massMjup * JUPITER_MASS_KG;
  const moonHeat = totalMoonSelfHeating(moons, massKg);
  const sputterW = totalMoonSputteringPlasmaW(moons, starLuminosityLsol, orbitAu, ageGyr);
  const totalPlasma = moonHeat + sputterW;
  const hasPlasmaSource = sputterW > 0 || moonHeat >= PLASMA_H_THRESHOLD;
  const plasmaFactor = hasPlasmaSource ? Math.pow(1 + totalPlasma / PLASMA_H_REF, PLASMA_GAMMA) : 1;
  const magnetopauseRp = rCF * plasmaFactor;

  const surfaceFieldEarths = surfaceGauss / 0.31;
  let fieldLabel;
  if (surfaceFieldEarths > 50) fieldLabel = "Extremely strong";
  else if (surfaceFieldEarths > 10) fieldLabel = "Very strong";
  else if (surfaceFieldEarths > 2) fieldLabel = "Strong";
  else if (surfaceFieldEarths > 0.3) fieldLabel = "Moderate";
  else if (surfaceFieldEarths > 0.05) fieldLabel = "Weak";
  else fieldLabel = "Very weak";

  return {
    dynamoActive: true,
    dynamoReason: isIceGiant
      ? "Active dynamo (ionic ocean convection)"
      : "Active dynamo (metallic hydrogen convection)",
    fieldMorphology,
    fieldLabel,
    surfaceFieldGauss: round(surfaceGauss, 3),
    surfaceFieldEarths: round(surfaceFieldEarths, 2),
    shellRatio: round(shell, 3),
    conductivityRegime: isIceGiant ? "ionic" : "metallic-H",
    effectiveFluxWm2: round(qEff, 3),
    dipoleMomentAm2,
    magnetopauseRp: round(magnetopauseRp, 1),
    magnetopauseKm: round(magnetopauseRp * radiusKm, 0),
    sputteringPlasmaW: round(sputterW, 0),
  };
}
