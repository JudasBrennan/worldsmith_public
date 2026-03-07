// SPDX-License-Identifier: MPL-2.0
const SUBLIMATION_TABLE = [
  { species: "N\u2082", tempK: 63, label: "nitrogen" },
  { species: "CO", tempK: 68, label: "carbon monoxide" },
  { species: "CH\u2084", tempK: 91, label: "methane" },
  { species: "H\u2082O", tempK: 170, label: "water ice" },
  { species: "CO\u2082", tempK: 195, label: "carbon dioxide" },
];

const MU_FE = 55.85;
const MU_MG = 24.31;
const MU_SI = 28.09;
const MU_O = 16.0;
const SOLAR_FE_MG = 0.83;
const SOLAR_SI_MG = 0.95;

export function compositionClass(cmf, wmf) {
  if (wmf > 0.1) return "Ice world";
  if (wmf > 0.001) return "Ocean world";
  if (cmf > 0.6) return "Iron world";
  if (cmf > 0.45) return "Mercury-like";
  if (cmf >= 0.25) return "Earth-like";
  if (cmf >= 0.1) return "Mars-like";
  return "Coreless";
}

export function waterRegime(wmf) {
  if (wmf < 0.0001) return "Dry";
  if (wmf < 0.001) return "Shallow oceans";
  if (wmf < 0.01) return "Extensive oceans";
  if (wmf < 0.1) return "Global ocean";
  if (wmf < 0.3) return "Deep ocean";
  return "Ice world";
}

export function bodyClass(massEarth) {
  return massEarth < 0.01 ? "Dwarf planet" : "Planet";
}

export function classifyClimateState(surfaceTempK, absorbedFluxWm2, hasWater) {
  if (!hasWater) return "Stable";
  if (absorbedFluxWm2 > 282) return "Runaway greenhouse";
  if (surfaceTempK > 340) return "Moist greenhouse";
  if (surfaceTempK < 240) return "Snowball";
  return "Stable";
}

export function analyseVolatiles(tEqPeriK, tEqApoK) {
  return SUBLIMATION_TABLE.map(({ species, tempK, label }) => {
    const periAbove = tEqPeriK >= tempK;
    const apoAbove = tEqApoK >= tempK;
    let note;
    if (!periAbove) {
      note = `${species} ice stable`;
    } else if (!apoAbove) {
      note = `Transient ${label} atmosphere near periapsis`;
    } else {
      note = `${label} sublimation throughout orbit`;
    }
    return {
      species,
      tempK,
      canSublimate: periAbove,
      transient: periAbove && !apoAbove,
      persistent: periAbove && apoAbove,
      note,
    };
  });
}

export function waterRadiusInflation(massEarth, wmf) {
  if (wmf <= 0) return 1.0;
  const rDryZeng = 1.0 * massEarth ** 0.27;
  const r50Zeng = 1.38 * massEarth ** 0.263;
  const inflation = (r50Zeng / rDryZeng - 1) * Math.min(wmf / 0.5, 1);
  return 1 + inflation;
}

export function suggestedCmfFromMetallicity(feH) {
  const feMg = SOLAR_FE_MG * 10 ** feH;
  const siMg = SOLAR_SI_MG;
  const muMantle = MU_MG + MU_O + siMg * (MU_SI + 2 * MU_O);
  return (feMg * MU_FE) / (feMg * MU_FE + muMantle);
}

export function waterBoilingK(pAtm) {
  if (pAtm <= 0) return 0;
  if (pAtm >= 218) return 647;
  const lvOverR = 40700 / 8.314;
  return 1 / (1 / 373.15 - Math.log(pAtm) / lvOverR);
}
