/**
 * Gas Giant Visual Styles — shared module
 *
 * Centralises style definitions, labels, palettes, and canvas preview
 * rendering for gas giants across outerObjectsPage, systemPage, and
 * visualizerPage.
 */

import { renderGasPreviewNative } from "./threeNativePreview.js";

// ── Style definitions ───────────────────────────────────────────────

const STYLE_DEFS = [
  // ── Realistic (17) ──────────────────────────────────────────────
  {
    id: "jupiter",
    label: "Jupiter-like",
    category: "Realistic",
    palette: {
      size: 14,
      c1: "rgba(248, 218, 170, 0.98)",
      c2: "rgba(205, 148, 88, 0.96)",
      c3: "rgba(120, 68, 38, 0.96)",
      ring: "transparent",
    },
    bands: [
      { y: 0.18, h: 0.08, colour: "rgba(175,105,50,0.5)" },
      { y: 0.3, h: 0.06, colour: "rgba(220,170,100,0.35)" },
      { y: 0.42, h: 0.1, colour: "rgba(140,70,30,0.55)" },
      { y: 0.56, h: 0.07, colour: "rgba(225,180,120,0.3)" },
      { y: 0.66, h: 0.09, colour: "rgba(155,85,40,0.5)" },
      { y: 0.78, h: 0.06, colour: "rgba(200,145,80,0.35)" },
    ],
    spots: [{ x: 0.6, y: 0.55, rx: 0.12, ry: 0.06, colour: "rgba(185,70,30,0.6)" }],
    hasRing: false,
    ringStyle: { colour: "rgba(180,150,110,0.35)", gap: 0.7, width: 0.35 },
    glow: null,
    special: null,
  },
  {
    id: "saturn",
    label: "Saturn-like",
    category: "Realistic",
    palette: {
      size: 13,
      c1: "rgba(245, 225, 155, 0.98)",
      c2: "rgba(218, 178, 98, 0.96)",
      c3: "rgba(148, 108, 52, 0.96)",
      ring: "rgba(225, 204, 156, 0.45)",
    },
    bands: [
      { y: 0.2, h: 0.07, colour: "rgba(210,178,95,0.3)" },
      { y: 0.35, h: 0.05, colour: "rgba(185,145,65,0.25)" },
      { y: 0.5, h: 0.08, colour: "rgba(200,165,85,0.32)" },
      { y: 0.65, h: 0.06, colour: "rgba(175,130,55,0.28)" },
      { y: 0.8, h: 0.05, colour: "rgba(195,158,78,0.25)" },
    ],
    spots: [],
    hasRing: true,
    ringStyle: { colour: "rgba(210,190,140,0.5)", gap: 0.7, width: 0.45 },
    glow: null,
    special: null,
  },
  {
    id: "neptune",
    label: "Neptune-like",
    category: "Realistic",
    palette: {
      size: 12,
      c1: "rgba(175, 210, 240, 0.98)",
      c2: "rgba(110, 165, 218, 0.96)",
      c3: "rgba(55, 100, 160, 0.96)",
      ring: "rgba(150, 200, 240, 0.15)",
    },
    bands: [
      { y: 0.22, h: 0.05, colour: "rgba(120,170,215,0.28)" },
      { y: 0.4, h: 0.06, colour: "rgba(90,148,210,0.35)" },
      { y: 0.58, h: 0.05, colour: "rgba(110,165,218,0.25)" },
      { y: 0.72, h: 0.04, colour: "rgba(100,155,212,0.3)" },
    ],
    spots: [{ x: 0.52, y: 0.44, rx: 0.08, ry: 0.04, colour: "rgba(80,140,200,0.35)" }],
    hasRing: true,
    ringStyle: { colour: "rgba(150,200,240,0.18)", gap: 0.85, width: 0.2 },
    glow: null,
    special: null,
  },
  {
    id: "neptune-classic",
    label: "Classic Neptune-like",
    category: "Realistic",
    palette: {
      size: 12,
      c1: "rgba(85, 148, 255, 0.98)",
      c2: "rgba(38, 82, 210, 0.96)",
      c3: "rgba(12, 28, 108, 0.96)",
      ring: "rgba(100, 160, 255, 0.15)",
    },
    bands: [
      { y: 0.25, h: 0.06, colour: "rgba(50,100,210,0.35)" },
      { y: 0.45, h: 0.08, colour: "rgba(28,65,180,0.42)" },
      { y: 0.65, h: 0.05, colour: "rgba(60,110,220,0.3)" },
    ],
    spots: [{ x: 0.55, y: 0.42, rx: 0.1, ry: 0.05, colour: "rgba(20,40,140,0.55)" }],
    hasRing: true,
    ringStyle: { colour: "rgba(100,160,255,0.18)", gap: 0.85, width: 0.2 },
    glow: null,
    special: null,
  },
  {
    id: "uranus",
    label: "Uranus-like",
    category: "Realistic",
    palette: {
      size: 12,
      c1: "rgba(165, 228, 225, 0.98)",
      c2: "rgba(100, 195, 198, 0.96)",
      c3: "rgba(40, 115, 125, 0.96)",
      ring: "rgba(140, 218, 228, 0.18)",
    },
    bands: [
      { y: 0.35, h: 0.04, colour: "rgba(110,205,208,0.18)" },
      { y: 0.55, h: 0.04, colour: "rgba(85,185,192,0.15)" },
    ],
    spots: [],
    hasRing: true,
    ringStyle: { colour: "rgba(140,210,220,0.22)", gap: 0.82, width: 0.25 },
    glow: null,
    special: null,
  },
  {
    id: "hot-jupiter",
    label: "Hot Jupiter",
    category: "Realistic",
    palette: {
      size: 14,
      c1: "rgba(255, 205, 120, 0.98)",
      c2: "rgba(248, 108, 42, 0.96)",
      c3: "rgba(140, 28, 12, 0.96)",
      ring: "transparent",
    },
    bands: [
      { y: 0.2, h: 0.09, colour: "rgba(255,150,45,0.45)" },
      { y: 0.4, h: 0.1, colour: "rgba(225,70,18,0.52)" },
      { y: 0.6, h: 0.08, colour: "rgba(255,130,35,0.4)" },
      { y: 0.75, h: 0.07, colour: "rgba(210,50,10,0.48)" },
    ],
    spots: [],
    hasRing: false,
    ringStyle: { colour: "rgba(255,160,80,0.3)", gap: 0.75, width: 0.3 },
    glow: { colour: "rgba(255,120,40,0.25)", radius: 1.25 },
    special: null,
  },
  {
    id: "warm-giant",
    label: "Warm Gas Giant",
    category: "Realistic",
    palette: {
      size: 13,
      c1: "rgba(235, 198, 130, 0.98)",
      c2: "rgba(198, 148, 78, 0.96)",
      c3: "rgba(118, 72, 28, 0.96)",
      ring: "transparent",
    },
    bands: [
      { y: 0.22, h: 0.07, colour: "rgba(210,158,72,0.32)" },
      { y: 0.42, h: 0.08, colour: "rgba(178,115,48,0.38)" },
      { y: 0.62, h: 0.06, colour: "rgba(200,148,68,0.3)" },
      { y: 0.78, h: 0.05, colour: "rgba(168,105,40,0.28)" },
    ],
    spots: [],
    hasRing: false,
    ringStyle: { colour: "rgba(200,160,100,0.3)", gap: 0.72, width: 0.32 },
    glow: null,
    special: null,
  },
  {
    id: "cloudless",
    label: "Cloudless Giant",
    category: "Realistic",
    palette: {
      size: 13,
      c1: "rgba(88, 98, 148, 0.98)",
      c2: "rgba(48, 55, 108, 0.96)",
      c3: "rgba(18, 20, 52, 0.96)",
      ring: "transparent",
    },
    bands: [
      { y: 0.3, h: 0.05, colour: "rgba(68,78,135,0.18)" },
      { y: 0.55, h: 0.06, colour: "rgba(55,62,120,0.15)" },
    ],
    spots: [],
    hasRing: false,
    ringStyle: { colour: "rgba(90,110,150,0.25)", gap: 0.78, width: 0.28 },
    glow: null,
    special: null,
  },
  {
    id: "alkali",
    label: "Alkali-Metal Giant",
    category: "Realistic",
    palette: {
      size: 13,
      c1: "rgba(135, 62, 42, 0.98)",
      c2: "rgba(88, 32, 18, 0.96)",
      c3: "rgba(38, 12, 6, 0.96)",
      ring: "transparent",
    },
    bands: [
      { y: 0.25, h: 0.08, colour: "rgba(105,42,22,0.35)" },
      { y: 0.5, h: 0.1, colour: "rgba(75,25,12,0.42)" },
      { y: 0.72, h: 0.07, colour: "rgba(115,48,28,0.3)" },
    ],
    spots: [],
    hasRing: false,
    ringStyle: { colour: "rgba(100,60,45,0.3)", gap: 0.74, width: 0.3 },
    glow: null,
    special: null,
  },
  {
    id: "silicate",
    label: "Silicate-Cloud Giant",
    category: "Realistic",
    palette: {
      size: 13,
      c1: "rgba(255, 168, 138, 0.98)",
      c2: "rgba(210, 88, 62, 0.96)",
      c3: "rgba(130, 35, 22, 0.96)",
      ring: "transparent",
    },
    bands: [
      { y: 0.2, h: 0.09, colour: "rgba(235,118,68,0.42)" },
      { y: 0.4, h: 0.07, colour: "rgba(210,78,42,0.38)" },
      { y: 0.6, h: 0.1, colour: "rgba(245,128,78,0.4)" },
      { y: 0.78, h: 0.06, colour: "rgba(190,60,32,0.35)" },
    ],
    spots: [{ x: 0.45, y: 0.35, rx: 0.08, ry: 0.04, colour: "rgba(255,190,150,0.42)" }],
    hasRing: false,
    ringStyle: { colour: "rgba(230,140,90,0.3)", gap: 0.72, width: 0.3 },
    glow: { colour: "rgba(255,130,80,0.2)", radius: 1.2 },
    special: null,
  },
  {
    id: "super-jupiter",
    label: "Super-Jupiter",
    category: "Realistic",
    palette: {
      size: 15,
      c1: "rgba(178, 118, 78, 0.98)",
      c2: "rgba(118, 58, 32, 0.96)",
      c3: "rgba(48, 18, 8, 0.96)",
      ring: "transparent",
    },
    bands: [
      { y: 0.14, h: 0.07, colour: "rgba(145,72,38,0.48)" },
      { y: 0.24, h: 0.06, colour: "rgba(168,98,55,0.35)" },
      { y: 0.34, h: 0.08, colour: "rgba(110,48,22,0.55)" },
      { y: 0.46, h: 0.05, colour: "rgba(158,88,50,0.3)" },
      { y: 0.56, h: 0.09, colour: "rgba(100,38,15,0.55)" },
      { y: 0.68, h: 0.06, colour: "rgba(148,78,42,0.42)" },
      { y: 0.78, h: 0.07, colour: "rgba(120,55,28,0.48)" },
      { y: 0.88, h: 0.05, colour: "rgba(138,68,38,0.35)" },
    ],
    spots: [
      { x: 0.5, y: 0.45, rx: 0.14, ry: 0.07, colour: "rgba(85,28,10,0.58)" },
      { x: 0.35, y: 0.7, rx: 0.06, ry: 0.03, colour: "rgba(98,38,18,0.42)" },
    ],
    hasRing: false,
    ringStyle: { colour: "rgba(150,100,70,0.35)", gap: 0.68, width: 0.38 },
    glow: null,
    special: null,
  },
  {
    id: "sub-neptune",
    label: "Sub-Neptune",
    category: "Realistic",
    palette: {
      size: 11,
      c1: "rgba(138, 218, 198, 0.98)",
      c2: "rgba(78, 168, 162, 0.96)",
      c3: "rgba(28, 82, 88, 0.96)",
      ring: "transparent",
    },
    bands: [
      { y: 0.3, h: 0.05, colour: "rgba(98,195,178,0.22)" },
      { y: 0.55, h: 0.06, colour: "rgba(68,162,152,0.2)" },
    ],
    spots: [],
    hasRing: false,
    ringStyle: { colour: "rgba(120,192,185,0.25)", gap: 0.8, width: 0.25 },
    glow: null,
    special: "haze",
  },
  {
    id: "ringed-ice",
    label: "Ringed Ice Giant",
    category: "Realistic",
    palette: {
      size: 12,
      c1: "rgba(128, 212, 228, 0.98)",
      c2: "rgba(62, 155, 185, 0.96)",
      c3: "rgba(18, 62, 88, 0.96)",
      ring: "rgba(168, 228, 248, 0.4)",
    },
    bands: [
      { y: 0.25, h: 0.06, colour: "rgba(82,178,208,0.28)" },
      { y: 0.5, h: 0.07, colour: "rgba(52,148,178,0.32)" },
      { y: 0.72, h: 0.05, colour: "rgba(72,168,195,0.25)" },
    ],
    spots: [],
    hasRing: true,
    ringStyle: { colour: "rgba(168,228,248,0.45)", gap: 0.65, width: 0.4 },
    glow: null,
    special: null,
  },
  {
    id: "puffy",
    label: "Puffy Giant",
    category: "Realistic",
    palette: {
      size: 14,
      c1: "rgba(228, 198, 242, 0.95)",
      c2: "rgba(188, 148, 218, 0.92)",
      c3: "rgba(118, 78, 158, 0.9)",
      ring: "transparent",
    },
    bands: [
      { y: 0.3, h: 0.06, colour: "rgba(200,168,228,0.2)" },
      { y: 0.55, h: 0.05, colour: "rgba(178,138,215,0.18)" },
    ],
    spots: [],
    hasRing: false,
    ringStyle: { colour: "rgba(200,178,230,0.25)", gap: 0.76, width: 0.3 },
    glow: { colour: "rgba(215,185,245,0.2)", radius: 1.3 },
    special: "puffy",
  },
  {
    id: "hazy",
    label: "Hazy Giant",
    category: "Realistic",
    palette: {
      size: 13,
      c1: "rgba(208, 195, 128, 0.98)",
      c2: "rgba(165, 148, 82, 0.96)",
      c3: "rgba(92, 78, 38, 0.96)",
      ring: "transparent",
    },
    bands: [
      { y: 0.22, h: 0.06, colour: "rgba(185,168,92,0.25)" },
      { y: 0.42, h: 0.07, colour: "rgba(155,132,68,0.32)" },
      { y: 0.62, h: 0.06, colour: "rgba(175,155,88,0.22)" },
    ],
    spots: [],
    hasRing: false,
    ringStyle: { colour: "rgba(180,160,100,0.3)", gap: 0.74, width: 0.3 },
    glow: null,
    special: "haze",
  },
  {
    id: "water-cloud",
    label: "Water-Cloud Giant",
    category: "Realistic",
    palette: {
      size: 13,
      c1: "rgba(248, 248, 255, 0.98)",
      c2: "rgba(215, 222, 242, 0.96)",
      c3: "rgba(162, 175, 210, 0.96)",
      ring: "transparent",
    },
    bands: [
      { y: 0.18, h: 0.06, colour: "rgba(210,218,245,0.3)" },
      { y: 0.32, h: 0.05, colour: "rgba(188,200,235,0.28)" },
      { y: 0.48, h: 0.07, colour: "rgba(205,215,242,0.32)" },
      { y: 0.62, h: 0.05, colour: "rgba(182,195,230,0.25)" },
      { y: 0.76, h: 0.06, colour: "rgba(200,212,240,0.3)" },
    ],
    spots: [{ x: 0.45, y: 0.5, rx: 0.06, ry: 0.04, colour: "rgba(232,238,252,0.4)" }],
    hasRing: false,
    ringStyle: { colour: "rgba(200,210,235,0.28)", gap: 0.76, width: 0.3 },
    glow: null,
    special: null,
  },

  {
    id: "helium",
    label: "Helium Giant",
    category: "Realistic",
    palette: {
      size: 12,
      c1: "rgba(198, 195, 188, 0.98)",
      c2: "rgba(152, 148, 138, 0.96)",
      c3: "rgba(88, 85, 78, 0.96)",
      ring: "transparent",
    },
    bands: [
      { y: 0.2, h: 0.06, colour: "rgba(172,168,155,0.22)" },
      { y: 0.38, h: 0.05, colour: "rgba(142,138,125,0.2)" },
      { y: 0.55, h: 0.07, colour: "rgba(162,158,145,0.25)" },
      { y: 0.72, h: 0.05, colour: "rgba(132,128,118,0.2)" },
    ],
    spots: [],
    hasRing: false,
    ringStyle: { colour: "rgba(175,172,165,0.22)", gap: 0.78, width: 0.28 },
    glow: null,
    special: null,
  },
];

const GAS_STYLE_FAMILY_DEFAULTS = {
  solid: {
    hasVisibleBands: false,
    bandContrastDefault: 0.14,
    bandCountDefault: 2,
    turbulenceDefault: 0.16,
    shearDefault: 0.1,
    defaultHaze: 0.18,
    polarHaze: 0.3,
  },
  banded: {
    hasVisibleBands: true,
    bandContrastDefault: 0.58,
    bandCountDefault: 8,
    turbulenceDefault: 0.34,
    shearDefault: 0.25,
    defaultHaze: 0.08,
    polarHaze: 0.14,
  },
  patchy: {
    hasVisibleBands: true,
    bandContrastDefault: 0.42,
    bandCountDefault: 5,
    turbulenceDefault: 0.5,
    shearDefault: 0.28,
    defaultHaze: 0.12,
    polarHaze: 0.22,
  },
  hazy: {
    hasVisibleBands: false,
    bandContrastDefault: 0.2,
    bandCountDefault: 3,
    turbulenceDefault: 0.22,
    shearDefault: 0.12,
    defaultHaze: 0.3,
    polarHaze: 0.38,
  },
};

const GAS_STYLE_META_BY_ID = {
  jupiter: {
    family: "banded",
    bandContrastDefault: 0.68,
    bandCountDefault: 10,
    turbulenceDefault: 0.42,
    shearDefault: 0.3,
    polarHaze: 0.12,
  },
  "super-jupiter": {
    family: "banded",
    bandContrastDefault: 0.72,
    bandCountDefault: 12,
    turbulenceDefault: 0.48,
    shearDefault: 0.34,
    polarHaze: 0.14,
  },
  saturn: {
    family: "banded",
    bandContrastDefault: 0.38,
    bandCountDefault: 9,
    turbulenceDefault: 0.26,
    shearDefault: 0.18,
    defaultHaze: 0.11,
    polarHaze: 0.2,
  },
  "water-cloud": {
    family: "banded",
    bandContrastDefault: 0.46,
    bandCountDefault: 9,
    turbulenceDefault: 0.3,
    shearDefault: 0.2,
    defaultHaze: 0.12,
    polarHaze: 0.18,
  },
  "warm-giant": {
    family: "banded",
    bandContrastDefault: 0.44,
    bandCountDefault: 8,
    turbulenceDefault: 0.32,
    shearDefault: 0.22,
    defaultHaze: 0.1,
    polarHaze: 0.16,
  },
  neptune: {
    family: "patchy",
    bandContrastDefault: 0.46,
    bandCountDefault: 5,
    turbulenceDefault: 0.56,
    shearDefault: 0.3,
    defaultHaze: 0.14,
    polarHaze: 0.28,
  },
  "neptune-classic": {
    family: "patchy",
    bandContrastDefault: 0.52,
    bandCountDefault: 5,
    turbulenceDefault: 0.6,
    shearDefault: 0.32,
    defaultHaze: 0.14,
    polarHaze: 0.28,
  },
  uranus: {
    family: "solid",
    hasVisibleBands: false,
    bandContrastDefault: 0.1,
    bandCountDefault: 2,
    turbulenceDefault: 0.14,
    shearDefault: 0.08,
    defaultHaze: 0.22,
    polarHaze: 0.34,
  },
  helium: {
    family: "solid",
    hasVisibleBands: false,
    bandContrastDefault: 0.12,
    bandCountDefault: 2,
    turbulenceDefault: 0.14,
    shearDefault: 0.08,
    defaultHaze: 0.2,
    polarHaze: 0.3,
  },
  "sub-neptune": {
    family: "hazy",
    hasVisibleBands: false,
    bandContrastDefault: 0.18,
    bandCountDefault: 3,
    turbulenceDefault: 0.24,
    shearDefault: 0.1,
    defaultHaze: 0.28,
    polarHaze: 0.34,
  },
  hazy: {
    family: "hazy",
    hasVisibleBands: false,
    bandContrastDefault: 0.16,
    bandCountDefault: 3,
    turbulenceDefault: 0.2,
    shearDefault: 0.1,
    defaultHaze: 0.34,
    polarHaze: 0.4,
  },
  cloudless: {
    family: "solid",
    hasVisibleBands: false,
    bandContrastDefault: 0.08,
    bandCountDefault: 2,
    turbulenceDefault: 0.16,
    shearDefault: 0.08,
    defaultHaze: 0.16,
    polarHaze: 0.2,
  },
  "ringed-ice": {
    family: "patchy",
    bandContrastDefault: 0.42,
    bandCountDefault: 5,
    turbulenceDefault: 0.44,
    shearDefault: 0.24,
    defaultHaze: 0.16,
    polarHaze: 0.28,
  },
  "hot-jupiter": {
    family: "banded",
    bandContrastDefault: 0.74,
    bandCountDefault: 9,
    turbulenceDefault: 0.62,
    shearDefault: 0.36,
    defaultHaze: 0.18,
    polarHaze: 0.12,
  },
  alkali: {
    family: "hazy",
    hasVisibleBands: true,
    bandContrastDefault: 0.32,
    bandCountDefault: 6,
    turbulenceDefault: 0.46,
    shearDefault: 0.24,
    defaultHaze: 0.28,
    polarHaze: 0.18,
  },
  silicate: {
    family: "hazy",
    hasVisibleBands: true,
    bandContrastDefault: 0.4,
    bandCountDefault: 7,
    turbulenceDefault: 0.52,
    shearDefault: 0.28,
    defaultHaze: 0.24,
    polarHaze: 0.14,
  },
  puffy: {
    family: "hazy",
    hasVisibleBands: true,
    bandContrastDefault: 0.22,
    bandCountDefault: 5,
    turbulenceDefault: 0.3,
    shearDefault: 0.14,
    defaultHaze: 0.32,
    polarHaze: 0.3,
  },
};

function inferGasStyleFamily(style) {
  const explicit = String(style?.family || "")
    .trim()
    .toLowerCase();
  if (
    explicit === "solid" ||
    explicit === "banded" ||
    explicit === "patchy" ||
    explicit === "hazy"
  ) {
    return explicit;
  }
  const id = String(style?.id || "").toLowerCase();
  const special = String(style?.special || "").toLowerCase();
  if (id.includes("uranus") || id === "helium" || id === "cloudless") return "solid";
  if (id.includes("neptune") || id === "ringed-ice") {
    return "patchy";
  }
  if (id.includes("hazy") || id.includes("sub-neptune") || special === "haze" || id === "puffy") {
    return "hazy";
  }
  return "banded";
}

function enrichGasStyleDef(style) {
  const family = inferGasStyleFamily(style);
  const familyDefaults = GAS_STYLE_FAMILY_DEFAULTS[family] || GAS_STYLE_FAMILY_DEFAULTS.banded;
  const perStyle = GAS_STYLE_META_BY_ID[String(style?.id || "").toLowerCase()] || {};
  return {
    ...style,
    family,
    hasVisibleBands:
      typeof style?.hasVisibleBands === "boolean"
        ? style.hasVisibleBands
        : typeof perStyle.hasVisibleBands === "boolean"
          ? perStyle.hasVisibleBands
          : familyDefaults.hasVisibleBands,
    bandContrastDefault: Number.isFinite(style?.bandContrastDefault)
      ? style.bandContrastDefault
      : Number.isFinite(perStyle.bandContrastDefault)
        ? perStyle.bandContrastDefault
        : familyDefaults.bandContrastDefault,
    bandCountDefault: Number.isFinite(style?.bandCountDefault)
      ? style.bandCountDefault
      : Number.isFinite(perStyle.bandCountDefault)
        ? perStyle.bandCountDefault
        : familyDefaults.bandCountDefault,
    turbulenceDefault: Number.isFinite(style?.turbulenceDefault)
      ? style.turbulenceDefault
      : Number.isFinite(perStyle.turbulenceDefault)
        ? perStyle.turbulenceDefault
        : familyDefaults.turbulenceDefault,
    shearDefault: Number.isFinite(style?.shearDefault)
      ? style.shearDefault
      : Number.isFinite(perStyle.shearDefault)
        ? perStyle.shearDefault
        : familyDefaults.shearDefault,
    defaultHaze: Number.isFinite(style?.defaultHaze)
      ? style.defaultHaze
      : Number.isFinite(perStyle.defaultHaze)
        ? perStyle.defaultHaze
        : familyDefaults.defaultHaze,
    polarHaze: Number.isFinite(style?.polarHaze)
      ? style.polarHaze
      : Number.isFinite(perStyle.polarHaze)
        ? perStyle.polarHaze
        : familyDefaults.polarHaze,
  };
}

const STYLE_DEFS_ENRICHED = STYLE_DEFS.map((style) => enrichGasStyleDef(style));

// Legacy alias map (old id → new id)
const ALIASES = { ice: "neptune", hot: "hot-jupiter" };

// Fast lookup
const BY_ID = Object.create(null);
for (const s of STYLE_DEFS_ENRICHED) BY_ID[s.id] = s;
for (const [alias, target] of Object.entries(ALIASES)) BY_ID[alias] = BY_ID[target];

// ── Public API ──────────────────────────────────────────────────────

/** Ordered list of { id, label, category } for dropdown building. */
export const GAS_GIANT_STYLES = STYLE_DEFS_ENRICHED.map(({ id, label, category }) => ({
  id,
  label,
  category,
}));

/** Full style definition by id (resolves aliases, falls back to jupiter). */
export function getStyleById(id) {
  return BY_ID[String(id || "").toLowerCase()] || BY_ID.jupiter;
}

/** Human-readable label for a style id. */
export function styleLabel(id) {
  return getStyleById(id).label;
}

/**
 * Returns { size, c1, c2, c3, ring } for the system visualiser radial
 * gradient — backward-compatible with the old 5-style palette.
 */
export function gasStylePalette(id) {
  const p = getStyleById(id).palette;
  return { size: p.size, c1: p.c1, c2: p.c2, c3: p.c3, ring: p.ring };
}

/** Resolve legacy aliases to canonical ids. */
export function normalizeStyleId(id) {
  const s = String(id || "jupiter").toLowerCase();
  return ALIASES[s] || s;
}

// ── Physics-driven style suggestion ─────────────────────────────────

/**
 * Suggest visual styles based on gas giant engine properties.
 *
 * Maps Sudarsky classification, mass, temperature, atmosphere, and ring
 * properties to an ordered list of physically appropriate style candidates.
 *
 * @param {object} ggCalc - Result of calcGasGiant()
 * @returns {{ primary: string, candidates: string[] }}
 *   primary: recommended style ID
 *   candidates: all valid style IDs (2–5 entries, includes primary first)
 */
export function suggestStyles(ggCalc) {
  if (!ggCalc || !ggCalc.classification) {
    return { primary: "jupiter", candidates: ["jupiter", "saturn"] };
  }

  const cls = ggCalc.classification.sudarsky; // "I", "II", ..., "V", "I-ice"
  const mass = ggCalc.inputs?.massMjup ?? 1;
  const teq = ggCalc.thermal?.equilibriumTempK ?? 130;
  const metallicity = ggCalc.atmosphere?.metallicitySolar ?? 1;
  const ringDepth = ggCalc.ringProperties?.opticalDepthClass ?? "Tenuous";
  const prominentRings = ringDepth === "Dense" || ringDepth === "Moderate";
  const saturnMassRegime = mass >= 0.2 && mass <= 0.6;
  const actualR = ggCalc.physical?.radiusRj ?? 1;
  const suggestedR = ggCalc.physical?.suggestedRadiusRj ?? actualR;
  const candidates = [];

  if (cls === "I-ice") {
    // Ice giants — Dense/Moderate rings override to ringed-ice;
    // otherwise mass differentiates sub-types
    if (ringDepth === "Dense" || ringDepth === "Moderate") {
      candidates.push("ringed-ice", "neptune", "uranus");
    } else if (mass <= 0.035) {
      candidates.push("sub-neptune", "neptune", "uranus");
    } else if (mass <= 0.05) {
      candidates.push("uranus", "neptune", "neptune-classic");
    } else if (mass <= 0.065) {
      candidates.push("neptune", "uranus", "neptune-classic");
    } else {
      candidates.push("ringed-ice", "neptune", "uranus");
    }
  } else if (cls === "I") {
    // Class I ammonia clouds.
    // Ring-dominated Saturn-mass objects should stay in the Saturn-like visual
    // family even when atmospheric metallicity is elevated.
    if (prominentRings && saturnMassRegime) {
      candidates.push("saturn", "water-cloud", "jupiter");
      if (metallicity > 10) candidates.push("hazy");
    } else if (metallicity > 10) {
      candidates.push("hazy");
      if (mass > 1.0) candidates.push("super-jupiter", "jupiter");
      else if (mass > 0.5) candidates.push("jupiter", "saturn");
      else candidates.push("saturn", "water-cloud");
      candidates.push("sub-neptune");
    } else if (mass > 1.0) {
      candidates.push("super-jupiter", "jupiter", "hazy");
    } else if (mass > 0.5) {
      candidates.push("jupiter", "saturn", "hazy");
    } else {
      candidates.push("saturn", "water-cloud", "hazy");
    }
  } else if (cls === "II") {
    // Class II water clouds
    candidates.push("water-cloud", "warm-giant", "saturn", "hazy");
  } else if (cls === "III") {
    // Class III cloudless — primary depends on temperature
    if (teq < 500) {
      candidates.push("warm-giant", "hazy", "cloudless");
    } else {
      candidates.push("cloudless", "hazy", "warm-giant");
    }
  } else if (cls === "IV") {
    // Class IV alkali metals
    candidates.push("alkali", "hot-jupiter", "cloudless");
  } else {
    // Class V silicate/iron clouds
    if (teq > 1800) {
      candidates.push("hot-jupiter", "silicate");
    } else {
      candidates.push("silicate", "hot-jupiter");
    }
  }

  // Significantly inflated radius → puffy overrides Sudarsky-based primary
  if (suggestedR > 0 && actualR / suggestedR > 1.2) {
    candidates.unshift("puffy");
  }

  // Helium-dominated → helium giant
  const hePct = ggCalc.atmosphere?.hePct ?? 0;
  if (hePct > 50 && !candidates.includes("helium")) {
    candidates.push("helium");
  }

  // Deduplicate (in case of overlapping rules)
  const unique = [...new Set(candidates)];
  return { primary: unique[0], candidates: unique };
}

// ── Canvas preview renderer ─────────────────────────────────────────

/**
 * Draw a detailed gas giant preview onto a <canvas> element.
 *
 * @param {HTMLCanvasElement} canvas
 * @param {string} styleId
 */
export function drawGasGiantPreview(canvas, styleId, opts = {}) {
  if (!canvas) return;
  renderGasPreviewNative(canvas, styleId, opts);
}

// ── Physics-driven visual profile ───────────────────────────────────

/**
 * Compute a visual profile for a gas giant from engine properties.
 *
 * Style is always auto-derived via suggestStyles() — no manual override.
 * Matches the pattern of computeRockyVisualProfile / computeMoonVisualProfile.
 *
 * @param {object} ggCalc - Result of calcGasGiant()
 * @returns {{ bodyType: "gasGiant", styleId: string }}
 */
export function computeGasGiantVisualProfile(ggCalc) {
  const { primary } = suggestStyles(ggCalc);
  return { bodyType: "gasGiant", styleId: primary };
}

// ── Gas giant recipes ───────────────────────────────────────────────

/**
 * Input-template presets for gas giants.
 * Selecting a recipe sets the planet's physics inputs; the visual style
 * is then auto-derived from the resulting engine output.
 *
 * Structure mirrors ROCKY_RECIPES / MOON_RECIPES:
 *   preview  — data for the 90×90 picker thumbnail
 *   apply    — values written to the gas giant data on selection
 */
export const GAS_GIANT_RECIPES = [
  // ── Cold Giants (Class I) ──────────────────────────────────────────
  {
    id: "jupiter",
    label: "Jupiter",
    category: "Cold Giants",
    hint: "~5+ AU from a Sun-like star",
    preview: { styleId: "jupiter", rings: false },
    apply: {
      massMjup: 1.0,
      radiusRj: null,
      rotationPeriodHours: 9.93,
      metallicity: null,
      rings: false,
    },
  },
  {
    id: "saturn",
    label: "Saturn",
    category: "Cold Giants",
    hint: "~9+ AU from a Sun-like star",
    preview: { styleId: "saturn", rings: true },
    apply: {
      massMjup: 0.299,
      radiusRj: null,
      rotationPeriodHours: 10.66,
      metallicity: null,
      rings: true,
    },
  },
  {
    id: "super-jupiter",
    label: "Super-Jupiter",
    category: "Cold Giants",
    hint: "~5+ AU, massive gas giant",
    preview: { styleId: "super-jupiter", rings: false },
    apply: {
      massMjup: 3.0,
      radiusRj: null,
      rotationPeriodHours: 8,
      metallicity: null,
      rings: false,
    },
  },
  {
    id: "hazy-giant",
    label: "Hazy Giant",
    category: "Cold Giants",
    hint: "~5+ AU, metal-rich atmosphere",
    preview: { styleId: "hazy", rings: false },
    apply: {
      massMjup: 0.5,
      radiusRj: null,
      rotationPeriodHours: 12,
      metallicity: 15,
      rings: false,
    },
  },

  // ── Ice Giants (Class I-ice) ───────────────────────────────────────
  {
    id: "neptune",
    label: "Neptune",
    category: "Ice Giants",
    hint: "~20+ AU, methane-blue ice giant",
    preview: { styleId: "neptune", rings: false },
    apply: {
      massMjup: 0.054,
      radiusRj: null,
      rotationPeriodHours: 16.1,
      metallicity: null,
      rings: false,
    },
  },
  {
    id: "uranus",
    label: "Uranus",
    category: "Ice Giants",
    hint: "~15+ AU, faint rings",
    preview: { styleId: "uranus", rings: true },
    apply: {
      massMjup: 0.046,
      radiusRj: null,
      rotationPeriodHours: 17.2,
      metallicity: null,
      rings: true,
    },
  },
  {
    id: "sub-neptune",
    label: "Sub-Neptune",
    category: "Ice Giants",
    hint: "~10+ AU, high metallicity",
    preview: { styleId: "sub-neptune", rings: false },
    apply: {
      massMjup: 0.03,
      radiusRj: null,
      rotationPeriodHours: 20,
      metallicity: 30,
      rings: false,
    },
  },
  {
    id: "ringed-ice",
    label: "Ringed Ice Giant",
    category: "Ice Giants",
    hint: "~15+ AU, prominent ring system",
    preview: { styleId: "ringed-ice", rings: true },
    apply: {
      massMjup: 0.08,
      radiusRj: null,
      rotationPeriodHours: 15,
      metallicity: null,
      rings: true,
    },
  },

  // ── Warm Giants (Class II–III) ─────────────────────────────────────
  {
    id: "water-cloud",
    label: "Water-Cloud Giant",
    category: "Warm Giants",
    hint: "~1.5\u20133 AU, water vapour clouds",
    preview: { styleId: "water-cloud", rings: false },
    apply: {
      massMjup: 0.5,
      radiusRj: null,
      rotationPeriodHours: 12,
      metallicity: null,
      rings: false,
    },
  },
  {
    id: "warm-giant",
    label: "Warm Giant",
    category: "Warm Giants",
    hint: "~0.3\u20131.5 AU, sparse cloud cover",
    preview: { styleId: "warm-giant", rings: false },
    apply: {
      massMjup: 0.5,
      radiusRj: null,
      rotationPeriodHours: 12,
      metallicity: null,
      rings: false,
    },
  },
  {
    id: "cloudless",
    label: "Cloudless Giant",
    category: "Warm Giants",
    hint: "~0.1\u20130.3 AU, clear atmosphere",
    preview: { styleId: "cloudless", rings: false },
    apply: {
      massMjup: 0.8,
      radiusRj: null,
      rotationPeriodHours: 11,
      metallicity: null,
      rings: false,
    },
  },

  // ── Hot Giants (Class IV–V) ────────────────────────────────────────
  {
    id: "alkali",
    label: "Alkali Giant",
    category: "Hot Giants",
    hint: "~0.05\u20130.1 AU, alkali-metal haze",
    preview: { styleId: "alkali", rings: false },
    apply: {
      massMjup: 1.0,
      radiusRj: null,
      rotationPeriodHours: 15,
      metallicity: null,
      rings: false,
    },
  },
  {
    id: "hot-jupiter",
    label: "Hot Jupiter",
    category: "Hot Giants",
    hint: "< 0.05 AU, extreme irradiation",
    preview: { styleId: "hot-jupiter", rings: false },
    apply: {
      massMjup: 1.0,
      radiusRj: 1.3,
      rotationPeriodHours: 40,
      metallicity: null,
      rings: false,
    },
  },
  {
    id: "silicate-cloud",
    label: "Silicate-Cloud Giant",
    category: "Hot Giants",
    hint: "~0.02\u20130.05 AU, iron/silicate clouds",
    preview: { styleId: "silicate", rings: false },
    apply: {
      massMjup: 1.5,
      radiusRj: null,
      rotationPeriodHours: 30,
      metallicity: null,
      rings: false,
    },
  },
  {
    id: "puffy",
    label: "Puffy Giant",
    category: "Hot Giants",
    hint: "Inflated radius, low density",
    preview: { styleId: "puffy", rings: false },
    apply: {
      massMjup: 0.3,
      radiusRj: 1.5,
      rotationPeriodHours: 30,
      metallicity: null,
      rings: false,
    },
  },
];
