// SPDX-License-Identifier: MPL-2.0
import {
  calcEquilibriumTemperatureAtDistanceK,
  calcInsolationEarthRatio,
} from "../physics/radiative.js";

const SIGMA = 5.6704e-8;
const ICE_GIANT_MASS_MJUP = 0.15;
const ZERO_ALBEDO_EQ_COEFF = 279;

const SUDARSKY = [
  {
    cls: "I",
    maxTeq: 150,
    cloud: "Ammonia",
    bondAlbedo: 0.34,
    hex: "#C4A46C",
    label: "Class I - Ammonia clouds",
  },
  {
    cls: "II",
    maxTeq: 250,
    cloud: "Water",
    bondAlbedo: 0.81,
    hex: "#E8E4D4",
    label: "Class II - Water clouds",
  },
  {
    cls: "III",
    maxTeq: 800,
    cloud: "Cloudless",
    bondAlbedo: 0.12,
    hex: "#3B4559",
    label: "Class III - Cloudless",
  },
  {
    cls: "IV",
    maxTeq: 1400,
    cloud: "Alkali metals",
    bondAlbedo: 0.1,
    hex: "#4A3628",
    label: "Class IV - Alkali metals",
  },
  {
    cls: "V",
    maxTeq: Infinity,
    cloud: "Silicate/iron",
    bondAlbedo: 0.55,
    hex: "#D4654A",
    label: "Class V - Silicate/iron clouds",
  },
];

const CLOUD_DEFS = [
  {
    name: "Iron",
    composition: "Liquid iron droplets",
    thresholdK: 1800,
    above: true,
    pressureBar: 0.01,
    hex: "#3A3A3A",
    iceGiantOnly: false,
  },
  {
    name: "Silicate",
    composition: "MgSiO\u2083 / Mg\u2082SiO\u2084",
    thresholdK: 1400,
    above: true,
    pressureBar: 0.1,
    hex: "#C47040",
    iceGiantOnly: false,
  },
  {
    name: "H\u2082O",
    composition: "Water ice / liquid",
    thresholdK: 300,
    above: false,
    pressureBar: 5,
    hex: "#FFFFFF",
    iceGiantOnly: false,
  },
  {
    name: "NH\u2084SH",
    composition: "Ammonium hydrosulfide",
    thresholdK: 200,
    above: false,
    pressureBar: 2,
    hex: "#8B6914",
    iceGiantOnly: false,
  },
  {
    name: "NH\u2083",
    composition: "Ammonia ice",
    thresholdK: 150,
    above: false,
    pressureBar: 0.7,
    hex: "#F5E6C8",
    iceGiantOnly: false,
  },
  {
    name: "CH\u2084",
    composition: "Methane ice",
    thresholdK: 80,
    above: false,
    pressureBar: 1.5,
    hex: "#B0D8E8",
    iceGiantOnly: true,
  },
];

export function classifySudarsky(teqK, massMjup) {
  if (massMjup < ICE_GIANT_MASS_MJUP && teqK < 100) {
    return {
      cls: "I-ice",
      cloud: "Methane",
      bondAlbedo: 0.3,
      hex: "#A8D8E8",
      label: "Ice giant - Methane haze",
      subtype: "Ice giant",
    };
  }
  for (const item of SUDARSKY) {
    if (teqK <= item.maxTeq) {
      return { ...item, subtype: massMjup < ICE_GIANT_MASS_MJUP ? "Ice giant" : "Gas giant" };
    }
  }
  return { ...SUDARSKY[4], subtype: "Gas giant" };
}

export function getClouds(teqK, isIceGiant) {
  const layers = [];
  for (const cloud of CLOUD_DEFS) {
    if (cloud.iceGiantOnly && !isIceGiant) continue;
    const present = cloud.above ? teqK >= cloud.thresholdK : teqK <= cloud.thresholdK;
    if (present) {
      layers.push({
        name: cloud.name,
        composition: cloud.composition,
        tempK: cloud.thresholdK,
        pressureBar: cloud.pressureBar,
        colourHex: cloud.hex,
      });
    }
  }
  return layers;
}

export function internalHeatRatio(massMjup) {
  const mass = Math.min(Math.max(massMjup, 0.01), 100);
  if (mass <= 0.04) return 1.05;
  if (mass <= 0.06) {
    const x = (mass - 0.05) / 0.001;
    return 1.05 + 1.6 / (1 + Math.exp(-x));
  }
  if (mass <= 0.15) return 2.65;
  if (mass <= 0.3) {
    const t = (mass - 0.15) / 0.15;
    return 2.65 - t * 0.88;
  }
  if (mass <= 2.0) {
    const t = (mass - 0.3) / 1.7;
    return 1.77 - t * 0.267;
  }
  return 1.503 + Math.log10(mass / 2.0) * 0.5;
}

export function computeThermalProfile({ massMjup, orbitAu, starLuminosityLsol, eccentricity }) {
  const teqFirst = calcEquilibriumTemperatureAtDistanceK({
    starLuminosityLsol,
    albedoBond: 0,
    orbitalDistanceAu: orbitAu,
    coefficientK: ZERO_ALBEDO_EQ_COEFF,
    luminosityExponent: 0.5,
  });
  const sudarsky = classifySudarsky(teqFirst, massMjup);
  const bondAlbedo = sudarsky.bondAlbedo;
  const equilibriumTempK = calcEquilibriumTemperatureAtDistanceK({
    starLuminosityLsol,
    albedoBond: bondAlbedo,
    orbitalDistanceAu: orbitAu,
    coefficientK: ZERO_ALBEDO_EQ_COEFF,
    luminosityExponent: 0.5,
  });
  const heatRatio = internalHeatRatio(massMjup);
  const effectiveTempK = (equilibriumTempK ** 4 * heatRatio) ** 0.25;
  const internalFluxWm2 = Math.max(0, SIGMA * (effectiveTempK ** 4 - equilibriumTempK ** 4));
  const periapsisAu = orbitAu * (1 - eccentricity);
  const apoapsisAu = orbitAu * (1 + eccentricity);
  const equilibriumTempPeriK =
    periapsisAu > 0
      ? calcEquilibriumTemperatureAtDistanceK({
          starLuminosityLsol,
          albedoBond: bondAlbedo,
          orbitalDistanceAu: periapsisAu,
          coefficientK: ZERO_ALBEDO_EQ_COEFF,
          luminosityExponent: 0.5,
        })
      : equilibriumTempK;
  const equilibriumTempApoK =
    apoapsisAu > 0
      ? calcEquilibriumTemperatureAtDistanceK({
          starLuminosityLsol,
          albedoBond: bondAlbedo,
          orbitalDistanceAu: apoapsisAu,
          coefficientK: ZERO_ALBEDO_EQ_COEFF,
          luminosityExponent: 0.5,
        })
      : equilibriumTempK;
  return {
    sudarsky,
    bondAlbedo,
    equilibriumTempK,
    effectiveTempK,
    internalHeatRatio: heatRatio,
    internalFluxWm2,
    periapsisAu,
    apoapsisAu,
    equilibriumTempPeriK,
    equilibriumTempApoK,
    effectiveTempPeriK: (equilibriumTempPeriK ** 4 * heatRatio) ** 0.25,
    effectiveTempApoK: (equilibriumTempApoK ** 4 * heatRatio) ** 0.25,
    insolationEarth: calcInsolationEarthRatio({
      starLuminosityLsol,
      orbitalDistanceAu: orbitAu,
    }),
  };
}
