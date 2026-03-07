import { evaluateJeansEscapeSpecies, xuvFluxRatioEarth } from "../physics/escape.js";

const ATM_TO_KPA = 101.3;
const ATM_TO_PA = 101325;
const R_GAS = 8.3145;

const MW_O2 = 0.032;
const MW_CO2 = 0.044;
const MW_AR = 0.04;
const MW_N2 = 0.028;
const MW_H2O = 0.018;
const MW_CH4 = 0.016;
const MW_H2 = 0.002;
const MW_HE = 0.004;
const MW_SO2 = 0.064;
const MW_NH3 = 0.017;

const EXOBASE_XUV_COEFF = 3.0;
const EXOBASE_CO2_COEFF = 100;
const EXOBASE_MAX_K = 5000;
const P_HALF_XUV = 0.06;

const GH_CO2_COEFF = 0.503;
const GH_H2O_COEFF = 0.336;
const GH_CH4_COEFF = 0.45;
const GH_H2_CIA_COEFF = 3.0;
const GH_SO2_COEFF = 0.15;
const GH_NH3_COEFF = 1.5;
const GH_PP_REF = 0.001;
const GH_PB_EXP = 0.684;
const GH_CO2_H2O_OVERLAP_K = 6;
const GH_SO2_OVERLAP_K = 8;
const GH_NH3_OVERLAP_K = 20;

const GAS_SPECIES = [
  { key: "n2", label: "N\u2082", mw: MW_N2 },
  { key: "o2", label: "O\u2082", mw: MW_O2 },
  { key: "co2", label: "CO\u2082", mw: MW_CO2 },
  { key: "ar", label: "Ar", mw: MW_AR },
  { key: "h2o", label: "H\u2082O", mw: MW_H2O },
  { key: "ch4", label: "CH\u2084", mw: MW_CH4 },
  { key: "h2", label: "H\u2082", mw: MW_H2 },
  { key: "he", label: "He", mw: MW_HE },
  { key: "so2", label: "SO\u2082", mw: MW_SO2 },
  { key: "nh3", label: "NH\u2083", mw: MW_NH3 },
];

const GAS_PERCENT_KEYS = [
  { species: "o2", pctKey: "o2Pct", mw: MW_O2 },
  { species: "co2", pctKey: "co2Pct", mw: MW_CO2 },
  { species: "ar", pctKey: "arPct", mw: MW_AR },
  { species: "n2", pctKey: "n2Pct", mw: MW_N2 },
  { species: "h2o", pctKey: "h2oPct", mw: MW_H2O },
  { species: "ch4", pctKey: "ch4Pct", mw: MW_CH4 },
  { species: "h2", pctKey: "h2Pct", mw: MW_H2 },
  { species: "he", pctKey: "hePct", mw: MW_HE },
  { species: "so2", pctKey: "so2Pct", mw: MW_SO2 },
  { species: "nh3", pctKey: "nh3Pct", mw: MW_NH3 },
];

const ESCAPABLE_GASES = [
  { species: "o2", pctKey: "o2Pct" },
  { species: "co2", pctKey: "co2Pct" },
  { species: "ar", pctKey: "arPct" },
  { species: "h2o", pctKey: "h2oPct" },
  { species: "ch4", pctKey: "ch4Pct" },
  { species: "h2", pctKey: "h2Pct" },
  { species: "he", pctKey: "hePct" },
  { species: "so2", pctKey: "so2Pct" },
  { species: "nh3", pctKey: "nh3Pct" },
];

export function computeXuvFluxRatio(starLuminosityLsol, starAgeGyr, semiMajorAxisAu) {
  return xuvFluxRatioEarth({
    starLuminosityLsol,
    starAgeGyr,
    orbitAu: semiMajorAxisAu,
  });
}

export function computeExobaseTemp(tEqK, fXuvRatio, pressureAtm, co2Fraction) {
  if (tEqK <= 0) return 0;
  const etaAbs = pressureAtm / (pressureAtm + P_HALF_XUV);
  const boost =
    (EXOBASE_XUV_COEFF * etaAbs * Math.sqrt(Math.max(0, fXuvRatio))) /
    (1 + EXOBASE_CO2_COEFF * pressureAtm * co2Fraction);
  return Math.min(tEqK * (1 + boost), EXOBASE_MAX_K);
}

export function computeJeansEscape(escapeVelocityKms, exobaseTempK) {
  return evaluateJeansEscapeSpecies({
    escapeVelocityKms,
    exobaseTempK,
    gasSpecies: GAS_SPECIES,
  });
}

export function applyAtmosphericEscape({ atmosphericEscape, jeansSpecies, gasPercentages }) {
  const nextGasPercentages = { ...gasPercentages };
  const stripped = [];

  if (atmosphericEscape) {
    for (const gas of ESCAPABLE_GASES) {
      if (jeansSpecies[gas.species]?.status === "Lost") {
        nextGasPercentages[gas.pctKey] = 0;
        stripped.push(gas.species);
      }
    }
  }

  const gasInputTotalPct =
    nextGasPercentages.o2Pct +
    nextGasPercentages.co2Pct +
    nextGasPercentages.arPct +
    nextGasPercentages.h2oPct +
    nextGasPercentages.ch4Pct +
    nextGasPercentages.h2Pct +
    nextGasPercentages.hePct +
    nextGasPercentages.so2Pct +
    nextGasPercentages.nh3Pct;
  const n2PctRaw = 100 - gasInputTotalPct;
  const n2Pct = Math.max(0, n2PctRaw);

  return {
    gasPercentages: nextGasPercentages,
    stripped,
    gasInputTotalPct,
    n2PctRaw,
    n2Pct,
  };
}

export function computeAtmosphereProfile({ pressureAtm, temperatureK, gasPercentages }) {
  const pressureKpa = pressureAtm * ATM_TO_KPA;
  const partialPressuresAtm = {};
  const partialPressuresKpa = {};

  for (const gas of GAS_PERCENT_KEYS) {
    const pct = gasPercentages[gas.pctKey] ?? 0;
    const partialAtm = pressureAtm * (pct / 100);
    partialPressuresAtm[gas.species] = partialAtm;
    partialPressuresKpa[gas.species] = partialAtm * ATM_TO_KPA;
  }

  const atmWeightKgMol =
    GAS_PERCENT_KEYS.reduce((sum, gas) => sum + (gasPercentages[gas.pctKey] ?? 0) * gas.mw, 0) /
    100;
  const atmDensityKgM3 =
    temperatureK > 0 ? (pressureAtm * ATM_TO_PA * atmWeightKgMol) / (R_GAS * temperatureK) : 0;

  return {
    pressureKpa,
    ppO2Atm: partialPressuresAtm.o2,
    ppCO2Atm: partialPressuresAtm.co2,
    ppArAtm: partialPressuresAtm.ar,
    ppN2Atm: partialPressuresAtm.n2,
    ppH2OAtm: partialPressuresAtm.h2o,
    ppCH4Atm: partialPressuresAtm.ch4,
    ppH2Atm: partialPressuresAtm.h2,
    ppHeAtm: partialPressuresAtm.he,
    ppSO2Atm: partialPressuresAtm.so2,
    ppNH3Atm: partialPressuresAtm.nh3,
    ppO2Kpa: partialPressuresKpa.o2,
    ppCO2Kpa: partialPressuresKpa.co2,
    ppArKpa: partialPressuresKpa.ar,
    ppN2Kpa: partialPressuresKpa.n2,
    ppH2OKpa: partialPressuresKpa.h2o,
    ppCH4Kpa: partialPressuresKpa.ch4,
    ppH2Kpa: partialPressuresKpa.h2,
    ppHeKpa: partialPressuresKpa.he,
    ppSO2Kpa: partialPressuresKpa.so2,
    ppNH3Kpa: partialPressuresKpa.nh3,
    atmWeightKgMol,
    atmDensityKgM3,
  };
}

export function computeGreenhouseTau({
  pressureAtm,
  co2Pct,
  h2oPct,
  ch4Pct,
  h2Pct = 0,
  n2Pct = 0,
  so2Pct = 0,
  nh3Pct = 0,
  full = false,
}) {
  const pressure = pressureAtm;
  if (pressure <= 0) return 0;

  const pressureBroadening = pressure ** GH_PB_EXP;
  const ref = GH_PP_REF;

  const tauCO2 = GH_CO2_COEFF * Math.log(1 + (pressure * co2Pct) / 100 / ref) * pressureBroadening;
  const overlapFactor = 1 / (1 + tauCO2 / GH_CO2_H2O_OVERLAP_K);
  const tauH2O =
    GH_H2O_COEFF *
    Math.log(1 + (pressure * h2oPct) / 100 / ref) *
    pressureBroadening *
    overlapFactor;
  const tauCH4 =
    ch4Pct > 0
      ? GH_CH4_COEFF * Math.sqrt(Math.max(0, (pressure * ch4Pct) / 100 / ref)) * pressureBroadening
      : 0;

  let tau = tauCO2 + tauH2O + tauCH4;

  if (full) {
    if (h2Pct > 0 && n2Pct > 0) {
      tau += GH_H2_CIA_COEFF * (h2Pct / 100) * (n2Pct / 100) * pressure * pressure;
    }
    if (so2Pct > 0) {
      const rawSO2 =
        GH_SO2_COEFF * Math.log(1 + (pressure * so2Pct) / 100 / ref) * pressureBroadening;
      tau += rawSO2 / (1 + tau / GH_SO2_OVERLAP_K);
    }
    if (nh3Pct > 0) {
      const rawNH3 =
        GH_NH3_COEFF * Math.sqrt(Math.max(0, (pressure * nh3Pct) / 100 / ref)) * pressureBroadening;
      tau += rawNH3 / (1 + tau / GH_NH3_OVERLAP_K);
    }
  }

  return tau;
}
