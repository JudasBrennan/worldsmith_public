const SKY_ANCHORS = [
  { key: "A0", t: 9500 },
  { key: "F0", t: 7300 },
  { key: "F5", t: 6500 },
  { key: "G0", t: 6000 },
  { key: "G5", t: 5600 },
  { key: "K0", t: 5200 },
  { key: "K5", t: 4400 },
  { key: "M0", t: 3800 },
  { key: "M5", t: 3200 },
  { key: "M9", t: 2600 },
];

const SKY_PRESSURES_ATM = [0.3, 1, 3, 10];

const SKY_LUT = {
  A0: {
    0.3: { high: { c: "#052e58", e: "#0f4983" }, horiz: { c: "#000530", e: "#000b45" } },
    1: { high: { c: "#145799", e: "#2e7dcb" }, horiz: { c: "#000a3b", e: "#00123e" } },
    3: { high: { c: "#3b9af7", e: "#6abaff" }, horiz: { c: "#000d3c", e: "#00092d" } },
    10: { high: { c: "#7fcfff", e: "#8fc6fb" }, horiz: { c: "#00113a", e: "#001036" } },
  },
  F0: {
    0.3: { high: { c: "#183656", e: "#2b5581" }, horiz: { c: "#002350", e: "#003570" } },
    1: { high: { c: "#346497", e: "#5590ca" }, horiz: { c: "#003c6f", e: "#5c7180" } },
    3: { high: { c: "#6ab2f6", e: "#a0daff" }, horiz: { c: "#0c3862", e: "#3a374c" } },
    10: { high: { c: "#b6efff", e: "#c4e6fb" }, horiz: { c: "#1f3d59", e: "#2c3d54" } },
  },
  F5: {
    0.3: { high: { c: "#1d3956", e: "#325881" }, horiz: { c: "#06345b", e: "#104c7f" } },
    1: { high: { c: "#3c6996", e: "#6096c9" }, horiz: { c: "#2b4d6f", e: "#9f9985" } },
    3: { high: { c: "#74b4ee", e: "#abddf8" }, horiz: { c: "#375272", e: "#6e5558" } },
    10: { high: { c: "#c7f9ff", e: "#d5f0fb" }, horiz: { c: "#415463", e: "#52555e" } },
  },
  G0: {
    0.3: { high: { c: "#223b56", e: "#395c80" }, horiz: { c: "#1b3248", e: "#2b4b67" } },
    1: { high: { c: "#446c95", e: "#6b9dc7" }, horiz: { c: "#3d4d5c", e: "#c4a974" } },
    3: { high: { c: "#7bb3e3", e: "#b4ddec" }, horiz: { c: "#525e6b", e: "#987158" } },
    10: { high: { c: "#d9ffff", e: "#e7fbfb" }, horiz: { c: "#636b6c", e: "#7c7066" } },
  },
  G5: {
    0.3: { high: { c: "#253c55", e: "#3d5e7f" }, horiz: { c: "#1e2e3c", e: "#2f4557" } },
    1: { high: { c: "#476c90", e: "#6f9cc1" }, horiz: { c: "#434d53", e: "#cdaf72" } },
    3: { high: { c: "#7eafd8", e: "#b5d8e1" }, horiz: { c: "#565b60", e: "#9d714e" } },
    10: { high: { c: "#dfffff", e: "#edfbf4" }, horiz: { c: "#686a62", e: "#83705d" } },
  },
  K0: {
    0.3: { high: { c: "#273c51", e: "#405e7a" }, horiz: { c: "#202b33", e: "#7b8f90" } },
    1: { high: { c: "#4a6b8a", e: "#739bba" }, horiz: { c: "#484c4b", e: "#d4af68" } },
    3: { high: { c: "#7faacb", e: "#b6d3d4" }, horiz: { c: "#5a5955", e: "#a07046" } },
    10: { high: { c: "#e6fffe", e: "#f3fbec" }, horiz: { c: "#6a6758", e: "#856d53" } },
  },
  K5: {
    0.3: { high: { c: "#293844", e: "#435768" }, horiz: { c: "#212727", e: "#868c7a" } },
    1: { high: { c: "#4d6375", e: "#768f9e" }, horiz: { c: "#48463b", e: "#d4a655" } },
    3: { high: { c: "#829faf", e: "#b8c6b7" }, horiz: { c: "#595143", e: "#9f6b38" } },
    10: { high: { c: "#eaf7de", e: "#f7efce" }, horiz: { c: "#675c45", e: "#816341" } },
  },
  M0: {
    0.3: { high: { c: "#2a3339", e: "#445157" }, horiz: { c: "#222420", e: "#878266" } },
    1: { high: { c: "#4e5c63", e: "#778586" }, horiz: { c: "#443d2d", e: "#c79442" } },
    3: { high: { c: "#849495", e: "#b9bb9d" }, horiz: { c: "#534633", e: "#935e2a" } },
    10: { high: { c: "#ebe8c0", e: "#f7e2b2" }, horiz: { c: "#5f5035", e: "#785732" } },
  },
  M5: {
    0.3: { high: { c: "#2b2e2e", e: "#464a47" }, horiz: { c: "#222019", e: "#847856" } },
    1: { high: { c: "#4f5451", e: "#787b70" }, horiz: { c: "#3c3220", e: "#b17e33" } },
    3: { high: { c: "#86897c", e: "#b9ae84" }, horiz: { c: "#4a3a24", e: "#85511e" } },
    10: { high: { c: "#ecd9a2", e: "#f8d496" }, horiz: { c: "#544225", e: "#6a4823" } },
  },
  M9: {
    0.3: { high: { c: "#2a2820", e: "#444034" }, horiz: { c: "#1a160c", e: "#6d5935" } },
    1: { high: { c: "#4e493b", e: "#766c53" }, horiz: { c: "#302411", e: "#93611e" } },
    3: { high: { c: "#80755b", e: "#b19762" }, horiz: { c: "#3c2a14", e: "#6d3d10" } },
    10: { high: { c: "#cdac6e", e: "#d7a966" }, horiz: { c: "#443015", e: "#563613" } },
  },
};

const EARTH_GRAVITY_MS2 = 9.81;
const EARTH_SURFACE_TEMP_K = 288;

const VEG_LUT = {
  A0: {
    1: { pale: "#955939", deep: "#300a05" },
    3: { pale: "#4c5367", deep: "#012250" },
    10: { pale: "#7b752c", deep: "#2f3300" },
  },
  F0: {
    1: { pale: "#635466", deep: "#00082b" },
    3: { pale: "#497931", deep: "#003707" },
    10: { pale: "#9d613b", deep: "#663405" },
  },
  F5: {
    1: { pale: "#526c54", deep: "#002620" },
    3: { pale: "#738323", deep: "#253c00" },
    10: { pale: "#804e4b", deep: "#220c0c" },
  },
  G0: {
    1: { pale: "#5e823d", deep: "#003d10" },
    3: { pale: "#928420", deep: "#4b4f01" },
    10: { pale: "#7c4956", deep: "#190418" },
  },
  G5: {
    1: { pale: "#7a8f2f", deep: "#0d5108" },
    3: { pale: "#a37524", deep: "#543201" },
    10: { pale: "#834a60", deep: "#2f0624" },
  },
  K0: {
    1: { pale: "#aa8825", deep: "#584901" },
    3: { pale: "#ab6631", deep: "#5c2d02" },
    10: { pale: "#9a516d", deep: "#701d37" },
  },
  K5: {
    1: { pale: "#91524e", deep: "#44080c" },
    3: { pale: "#8e5a6a", deep: "#410a31" },
    10: { pale: "#85778c", deep: "#332c6d" },
  },
  M0: {
    1: { pale: "#786573", deep: "#21113c" },
    3: { pale: "#837584", deep: "#23225f" },
    10: { pale: "#939394", deep: "#274e7a" },
  },
  M5: {
    1: { pale: "#84878a", deep: "#03396b" },
    3: { pale: "#939391", deep: "#244b75" },
    10: { pale: "#aaa897", deep: "#486c79" },
  },
  M9: {
    1: { pale: "#cbbb99", deep: "#838674" },
    3: { pale: "#d0bd99", deep: "#898872" },
    10: { pale: "#d8c199", deep: "#948a71" },
  },
};

const VEG_TWILIGHT_LUT = {
  K0: {
    1: { pale: "#a5ae99", deep: "#3f787a" },
    3: { pale: "#e4c499", deep: "#9c8669" },
    10: { pale: "#e4c499", deep: "#937e63" },
  },
  K5: {
    1: { pale: "#c8bc99", deep: "#7d8874" },
    3: { pale: "#e4c499", deep: "#937f63" },
    10: { pale: "#e4c499", deep: "#937f63" },
  },
  M0: {
    1: { pale: "#d5c099", deep: "#908b72" },
    3: { pale: "#e4c499", deep: "#937f63" },
    10: { pale: "#e4c499", deep: "#937f63" },
  },
  M5: {
    1: { pale: "#dcc299", deep: "#988c70" },
    3: { pale: "#e4c499", deep: "#937f63" },
    10: { pale: "#e4c499", deep: "#937f63" },
  },
  M9: {
    1: { pale: "#e3c499", deep: "#9e896c" },
    3: { pale: "#e4c499", deep: "#937f63" },
    10: { pale: "#e4c499", deep: "#937f63" },
  },
};

const PLANT_NOTES = [
  { tMin: 7500, note: "Orange-brown to blue \u2014 adapted to UV-rich starlight" },
  { tMin: 6000, note: "Blue-violet to green \u2014 near Earth-like" },
  { tMin: 5200, note: "Green to olive \u2014 Earth-like photosynthesis" },
  { tMin: 4400, note: "Orange to red \u2014 broad-spectrum absorption" },
  { tMin: 3700, note: "Purple to blue-gray \u2014 deep broad-spectrum absorption" },
  { tMin: 3000, note: "Gray-blue to tan \u2014 absorbs most available light" },
  { tMin: 0, note: "Tan-gray \u2014 absorbs all available light" },
];

const VEG_STOP_COUNT = 6;

function clamp01(x) {
  return Math.max(0, Math.min(1, x));
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function hexToRgb(hex) {
  const h = (hex || "").replace("#", "");
  if (h.length !== 6) return { r: 0, g: 0, b: 0 };
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  };
}

function rgbToHex(r, g, b) {
  const rr = Math.max(0, Math.min(255, Math.round(r)));
  const gg = Math.max(0, Math.min(255, Math.round(g)));
  const bb = Math.max(0, Math.min(255, Math.round(b)));
  return "#" + [rr, gg, bb].map((v) => v.toString(16).padStart(2, "0")).join("");
}

function srgbToLinear(c) {
  const v = c / 255;
  return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
}

function linearToSrgb(c) {
  const v = Math.max(0, Math.min(1, c));
  return v <= 0.0031308 ? v * 12.92 * 255 : (1.055 * v ** (1 / 2.4) - 0.055) * 255;
}

function rgbToOklab(r, g, b) {
  const lr = srgbToLinear(r);
  const lg = srgbToLinear(g);
  const lb = srgbToLinear(b);
  const l_ = Math.cbrt(0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb);
  const m_ = Math.cbrt(0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb);
  const s_ = Math.cbrt(0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb);
  return {
    L: 0.2104542553 * l_ + 0.793617785 * m_ - 0.0040720468 * s_,
    a: 1.9779984951 * l_ - 2.428592205 * m_ + 0.4505937099 * s_,
    b: 0.0259040371 * l_ + 0.7827717662 * m_ - 0.808675766 * s_,
  };
}

function oklabToRgb(L, a, b) {
  const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = L - 0.0894841775 * a - 1.291485548 * b;
  const lr = l_ * l_ * l_;
  const lg = m_ * m_ * m_;
  const lb = s_ * s_ * s_;
  const r = 4.0767416621 * lr - 3.3077115913 * lg + 0.2309699292 * lb;
  const g = -1.2684380046 * lr + 2.6097574011 * lg - 0.3413193965 * lb;
  const bl = -0.0041960863 * lr - 0.7034186147 * lg + 1.707614701 * lb;
  return { r: linearToSrgb(r), g: linearToSrgb(g), b: linearToSrgb(bl) };
}

function lerpHex(hexA, hexB, t) {
  const A = hexToRgb(hexA);
  const B = hexToRgb(hexB);
  const labA = rgbToOklab(A.r, A.g, A.b);
  const labB = rgbToOklab(B.r, B.g, B.b);
  const mixed = oklabToRgb(
    lerp(labA.L, labB.L, t),
    lerp(labA.a, labB.a, t),
    lerp(labA.b, labB.b, t),
  );
  return rgbToHex(mixed.r, mixed.g, mixed.b);
}

function spectralKeyFromTempK(tempK) {
  const t = Number(tempK);
  if (!Number.isFinite(t)) {
    return { lower: SKY_ANCHORS[4], upper: SKY_ANCHORS[4], u: 0 };
  }

  let lower = SKY_ANCHORS[SKY_ANCHORS.length - 1];
  let upper = SKY_ANCHORS[0];

  for (let i = 0; i < SKY_ANCHORS.length; i++) {
    const anchor = SKY_ANCHORS[i];
    if (t >= anchor.t) {
      upper = anchor;
      break;
    }
  }
  for (let i = SKY_ANCHORS.length - 1; i >= 0; i--) {
    const anchor = SKY_ANCHORS[i];
    if (t <= anchor.t) {
      lower = anchor;
      break;
    }
  }

  if (t >= SKY_ANCHORS[0].t) return { lower: SKY_ANCHORS[0], upper: SKY_ANCHORS[0], u: 0 };
  if (t <= SKY_ANCHORS[SKY_ANCHORS.length - 1].t) {
    return {
      lower: SKY_ANCHORS[SKY_ANCHORS.length - 1],
      upper: SKY_ANCHORS[SKY_ANCHORS.length - 1],
      u: 0,
    };
  }

  const tHot = upper.t;
  const tCool = lower.t;
  return {
    lower,
    upper,
    u: clamp01((tHot - t) / (tHot - tCool)),
  };
}

function pressureBracket(pressureAtm) {
  const p = Math.max(0.001, Number(pressureAtm) || 1);
  const logs = SKY_PRESSURES_ATM.map((x) => Math.log10(x));
  const lp = Math.log10(p);

  let i1 = 0;
  let i2 = SKY_PRESSURES_ATM.length - 1;
  for (let i = 0; i < SKY_PRESSURES_ATM.length - 1; i++) {
    if (lp >= logs[i] && lp <= logs[i + 1]) {
      i1 = i;
      i2 = i + 1;
      break;
    }
  }

  if (lp >= logs[0] && lp <= logs[logs.length - 1]) {
    const t = clamp01((lp - logs[i1]) / (logs[i2] - logs[i1]));
    return { p1: SKY_PRESSURES_ATM[i1], p2: SKY_PRESSURES_ATM[i2], t, extraLow: 0, extraHigh: 0 };
  }
  if (lp < logs[0]) {
    const fade = clamp01((logs[0] - lp) / (logs[0] - Math.log10(0.001)));
    return {
      p1: SKY_PRESSURES_ATM[0],
      p2: SKY_PRESSURES_ATM[0],
      t: 0,
      extraLow: fade,
      extraHigh: 0,
    };
  }

  const fade = clamp01((lp - logs[logs.length - 1]) / (Math.log10(200) - logs[logs.length - 1]));
  return {
    p1: SKY_PRESSURES_ATM[logs.length - 1],
    p2: SKY_PRESSURES_ATM[logs.length - 1],
    t: 0,
    extraLow: 0,
    extraHigh: fade,
  };
}

function lutSample(key, pressureAtm, state) {
  const rec = SKY_LUT[key];
  if (!rec) return null;
  const bracket = pressureBracket(pressureAtm);
  const a = rec[String(bracket.p1)]?.[state];
  const b = rec[String(bracket.p2)]?.[state];
  if (!a || !b) return null;

  let center = lerpHex(a.c, b.c, bracket.t);
  let edge = lerpHex(a.e, b.e, bracket.t);
  if (bracket.extraLow > 0) {
    const black = state === "horiz" ? "#050508" : "#0a0a10";
    center = lerpHex(center, black, bracket.extraLow);
    edge = lerpHex(edge, black, bracket.extraLow);
  }
  if (bracket.extraHigh > 0) {
    const pale = state === "horiz" ? "#8a8580" : "#f0eee8";
    center = lerpHex(center, pale, bracket.extraHigh);
    edge = lerpHex(edge, pale, bracket.extraHigh);
  }
  return { center, edge };
}

export function skyColoursFromSpectralAndPressure({
  starTempK,
  pressureAtm,
  gravityMs2,
  surfaceTempK,
  co2Fraction,
}) {
  const grav = Number.isFinite(gravityMs2) && gravityMs2 > 0 ? gravityMs2 : EARTH_GRAVITY_MS2;
  const temp =
    Number.isFinite(surfaceTempK) && surfaceTempK > 0 ? surfaceTempK : EARTH_SURFACE_TEMP_K;
  const scaleHeightRatio = (temp / EARTH_SURFACE_TEMP_K) * (EARTH_GRAVITY_MS2 / grav);
  const effectivePressure = pressureAtm * scaleHeightRatio;

  const spectral = spectralKeyFromTempK(starTempK);
  const keyHot = spectral.upper.key;
  const keyCool = spectral.lower.key;
  const mix = spectral.u;

  const hotHigh = lutSample(keyHot, effectivePressure, "high");
  const coolHigh = lutSample(keyCool, effectivePressure, "high");
  const hotHoriz = lutSample(keyHot, effectivePressure, "horiz");
  const coolHoriz = lutSample(keyCool, effectivePressure, "horiz");

  let highCenter = hotHigh && coolHigh ? lerpHex(hotHigh.center, coolHigh.center, mix) : "#6aa0d8";
  let highEdge = hotHigh && coolHigh ? lerpHex(hotHigh.edge, coolHigh.edge, mix) : "#bfe4ff";
  let horizCenter =
    hotHoriz && coolHoriz ? lerpHex(hotHoriz.center, coolHoriz.center, mix) : "#5c6a78";
  let horizEdge = hotHoriz && coolHoriz ? lerpHex(hotHoriz.edge, coolHoriz.edge, mix) : "#d6b06b";

  const co2 = Number.isFinite(co2Fraction) ? clamp01(co2Fraction) : 0;
  if (co2 > 0.005) {
    const strength = clamp01(Math.sqrt(co2) * 0.7);
    highCenter = lerpHex(highCenter, "#9a7b50", strength);
    highEdge = lerpHex(highEdge, "#c4a870", strength);
    horizCenter = lerpHex(horizCenter, "#6b4520", strength);
    horizEdge = lerpHex(horizEdge, "#8b5a28", strength);
  }

  return {
    sunHigh: { center: highCenter, edge: highEdge, hex: highCenter },
    sunHorizon: { center: horizCenter, edge: horizEdge, hex: horizCenter },
    dayHex: highCenter,
    dayEdgeHex: highEdge,
    horizonHex: horizCenter,
    horizonEdgeHex: horizEdge,
    spectralKey: mix < 0.5 ? keyHot : keyCool,
  };
}

export function buildVegetationGradient(hexA, hexB, stopCount = VEG_STOP_COUNT) {
  const stops = [];
  for (let i = 0; i < stopCount; i++) {
    stops.push(lerpHex(hexA, hexB, i / (stopCount - 1)));
  }
  return stops;
}

function vegLutSample(lut, key, pAtm) {
  const entry = lut[key];
  if (!entry) return null;

  const p = Math.max(0.01, Math.min(100, pAtm));
  const logP = Math.log10(p);

  if (logP < 0) {
    const extraT = logP * 0.5;
    return {
      pale: lerpHex(entry[1].pale, entry[3].pale, extraT),
      deep: lerpHex(entry[1].deep, entry[3].deep, extraT),
    };
  }
  if (logP === 0) return entry[1];

  const log3 = Math.log10(3);
  if (logP <= log3) {
    const t = logP / log3;
    return {
      pale: lerpHex(entry[1].pale, entry[3].pale, t),
      deep: lerpHex(entry[1].deep, entry[3].deep, t),
    };
  }
  if (logP <= 1) {
    const t = (logP - log3) / (1 - log3);
    return {
      pale: lerpHex(entry[3].pale, entry[10].pale, t),
      deep: lerpHex(entry[3].deep, entry[10].deep, t),
    };
  }

  const extraT = 1 + (logP - 1) * 0.5;
  return {
    pale: lerpHex(entry[3].pale, entry[10].pale, extraT),
    deep: lerpHex(entry[3].deep, entry[10].deep, extraT),
  };
}

export function vegetationColours({ starTempK, pressureAtm, insolationEarth, tidallyLocked }) {
  const spectral = spectralKeyFromTempK(starTempK);
  const keyHot = spectral.upper.key;
  const keyCool = spectral.lower.key;
  const mix = spectral.u;
  const effP = Number.isFinite(pressureAtm) ? pressureAtm : 1;

  const hotSample = vegLutSample(VEG_LUT, keyHot, effP) || vegLutSample(VEG_LUT, "G5", effP);
  const coolSample = vegLutSample(VEG_LUT, keyCool, effP) || vegLutSample(VEG_LUT, "G5", effP);

  let pale = lerpHex(hotSample.pale, coolSample.pale, mix);
  let deep = lerpHex(hotSample.deep, coolSample.deep, mix);

  if (Number.isFinite(insolationEarth) && insolationEarth > 0) {
    const factor = clamp01(0.5 + 0.15 * Math.log2(insolationEarth));
    if (factor < 0.45) {
      const darken = (0.45 - factor) / 0.45;
      pale = lerpHex(pale, "#1a1a18", darken * 0.4);
      deep = lerpHex(deep, "#080808", darken * 0.3);
    }
  }

  let twilightPale = null;
  let twilightDeep = null;
  if (tidallyLocked) {
    const hotTwi = vegLutSample(VEG_TWILIGHT_LUT, keyHot, effP);
    const coolTwi = vegLutSample(VEG_TWILIGHT_LUT, keyCool, effP);
    if (hotTwi && coolTwi) {
      twilightPale = lerpHex(hotTwi.pale, coolTwi.pale, mix);
      twilightDeep = lerpHex(hotTwi.deep, coolTwi.deep, mix);
    } else if (coolTwi) {
      twilightPale = coolTwi.pale;
      twilightDeep = coolTwi.deep;
    }
  }

  const temp = Number(starTempK) || 5600;
  const baseNote =
    PLANT_NOTES.find((note) => temp >= note.tMin)?.note || PLANT_NOTES[PLANT_NOTES.length - 1].note;
  const pressureNote =
    effP > 1
      ? " \u2014 colour shifted by thick atmosphere"
      : effP < 1
        ? " \u2014 less atmospheric filtering (thin atmosphere)"
        : "";
  const twilightNote = tidallyLocked
    ? " (twilight-adapted variants available \u2014 tidally locked)"
    : "";

  return {
    paleHex: pale,
    deepHex: deep,
    stops: buildVegetationGradient(pale, deep),
    twilightPaleHex: twilightPale,
    twilightDeepHex: twilightDeep,
    twilightStops:
      twilightPale && twilightDeep ? buildVegetationGradient(twilightPale, twilightDeep) : null,
    note: baseNote + pressureNote + twilightNote,
  };
}
