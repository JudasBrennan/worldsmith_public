/**
 * Gas Giant Visual Styles — shared module
 *
 * Centralises style definitions, labels, palettes, and canvas preview
 * rendering for gas giants across outerObjectsPage, systemPage, and
 * visualizerPage.
 */

import { seededRng } from "./renderUtils.js";

// ── Style definitions ───────────────────────────────────────────────

const STYLE_DEFS = [
  // ── Realistic (17) ──────────────────────────────────────────────
  {
    id: "jupiter",
    label: "Jupiter-like",
    category: "Realistic",
    palette: {
      size: 14,
      c1: "rgba(245, 221, 188, 0.98)",
      c2: "rgba(198, 151, 109, 0.95)",
      c3: "rgba(112, 75, 54, 0.95)",
      ring: "transparent",
    },
    bands: [
      { y: 0.18, h: 0.08, colour: "rgba(180,120,70,0.35)" },
      { y: 0.3, h: 0.06, colour: "rgba(210,160,100,0.25)" },
      { y: 0.42, h: 0.1, colour: "rgba(140,80,45,0.4)" },
      { y: 0.56, h: 0.07, colour: "rgba(210,175,130,0.2)" },
      { y: 0.66, h: 0.09, colour: "rgba(155,95,55,0.35)" },
      { y: 0.78, h: 0.06, colour: "rgba(190,140,90,0.25)" },
    ],
    spots: [{ x: 0.6, y: 0.55, rx: 0.12, ry: 0.06, colour: "rgba(180,80,40,0.55)" }],
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
      c1: "rgba(243, 214, 151, 0.98)",
      c2: "rgba(196, 151, 97, 0.95)",
      c3: "rgba(98, 73, 48, 0.95)",
      ring: "rgba(225, 204, 156, 0.45)",
    },
    bands: [
      { y: 0.2, h: 0.07, colour: "rgba(200,170,110,0.2)" },
      { y: 0.35, h: 0.05, colour: "rgba(170,130,80,0.18)" },
      { y: 0.5, h: 0.08, colour: "rgba(190,155,100,0.22)" },
      { y: 0.65, h: 0.06, colour: "rgba(160,120,70,0.2)" },
      { y: 0.8, h: 0.05, colour: "rgba(180,145,90,0.18)" },
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
      c1: "rgba(210, 225, 240, 0.98)",
      c2: "rgba(170, 200, 220, 0.95)",
      c3: "rgba(100, 140, 170, 0.95)",
      ring: "rgba(180, 210, 230, 0.15)",
    },
    bands: [
      { y: 0.22, h: 0.05, colour: "rgba(160,195,215,0.15)" },
      { y: 0.4, h: 0.06, colour: "rgba(140,180,210,0.18)" },
      { y: 0.58, h: 0.05, colour: "rgba(155,190,215,0.12)" },
      { y: 0.72, h: 0.04, colour: "rgba(145,185,210,0.14)" },
    ],
    spots: [{ x: 0.52, y: 0.44, rx: 0.08, ry: 0.04, colour: "rgba(130,170,200,0.25)" }],
    hasRing: true,
    ringStyle: { colour: "rgba(180,210,230,0.18)", gap: 0.85, width: 0.2 },
    glow: null,
    special: null,
  },
  {
    id: "neptune-classic",
    label: "Classic Neptune-like",
    category: "Realistic",
    palette: {
      size: 12,
      c1: "rgba(100, 160, 255, 0.98)",
      c2: "rgba(50, 100, 210, 0.95)",
      c3: "rgba(20, 40, 120, 0.95)",
      ring: "rgba(120, 170, 255, 0.15)",
    },
    bands: [
      { y: 0.25, h: 0.06, colour: "rgba(60,110,200,0.2)" },
      { y: 0.45, h: 0.08, colour: "rgba(40,80,180,0.25)" },
      { y: 0.65, h: 0.05, colour: "rgba(70,120,210,0.18)" },
    ],
    spots: [{ x: 0.55, y: 0.42, rx: 0.1, ry: 0.05, colour: "rgba(30,50,140,0.45)" }],
    hasRing: true,
    ringStyle: { colour: "rgba(120,170,255,0.18)", gap: 0.85, width: 0.2 },
    glow: null,
    special: null,
  },
  {
    id: "uranus",
    label: "Uranus-like",
    category: "Realistic",
    palette: {
      size: 12,
      c1: "rgba(180, 230, 230, 0.98)",
      c2: "rgba(130, 200, 210, 0.95)",
      c3: "rgba(60, 120, 130, 0.95)",
      ring: "rgba(160, 220, 230, 0.18)",
    },
    bands: [
      { y: 0.35, h: 0.04, colour: "rgba(140,210,210,0.12)" },
      { y: 0.55, h: 0.04, colour: "rgba(120,190,195,0.1)" },
    ],
    spots: [],
    hasRing: true,
    ringStyle: { colour: "rgba(160,210,220,0.22)", gap: 0.82, width: 0.25 },
    glow: null,
    special: null,
  },
  {
    id: "hot-jupiter",
    label: "Hot Jupiter",
    category: "Realistic",
    palette: {
      size: 14,
      c1: "rgba(255, 220, 148, 0.98)",
      c2: "rgba(247, 121, 66, 0.95)",
      c3: "rgba(128, 36, 24, 0.95)",
      ring: "transparent",
    },
    bands: [
      { y: 0.2, h: 0.09, colour: "rgba(255,160,60,0.3)" },
      { y: 0.4, h: 0.1, colour: "rgba(220,80,30,0.35)" },
      { y: 0.6, h: 0.08, colour: "rgba(255,140,50,0.25)" },
      { y: 0.75, h: 0.07, colour: "rgba(200,60,20,0.3)" },
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
      c1: "rgba(220, 180, 120, 0.98)",
      c2: "rgba(180, 130, 80, 0.95)",
      c3: "rgba(100, 65, 35, 0.95)",
      ring: "transparent",
    },
    bands: [
      { y: 0.22, h: 0.07, colour: "rgba(200,150,80,0.2)" },
      { y: 0.42, h: 0.08, colour: "rgba(170,110,60,0.25)" },
      { y: 0.62, h: 0.06, colour: "rgba(190,140,75,0.2)" },
      { y: 0.78, h: 0.05, colour: "rgba(160,100,50,0.18)" },
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
      c1: "rgba(100, 120, 160, 0.98)",
      c2: "rgba(60, 75, 115, 0.95)",
      c3: "rgba(30, 35, 60, 0.95)",
      ring: "transparent",
    },
    bands: [
      { y: 0.3, h: 0.05, colour: "rgba(80,95,140,0.12)" },
      { y: 0.55, h: 0.06, colour: "rgba(70,85,130,0.1)" },
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
      c1: "rgba(120, 70, 55, 0.98)",
      c2: "rgba(80, 40, 30, 0.95)",
      c3: "rgba(40, 18, 12, 0.95)",
      ring: "transparent",
    },
    bands: [
      { y: 0.25, h: 0.08, colour: "rgba(90,50,35,0.2)" },
      { y: 0.5, h: 0.1, colour: "rgba(70,35,22,0.25)" },
      { y: 0.72, h: 0.07, colour: "rgba(100,55,40,0.18)" },
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
      c1: "rgba(255, 180, 140, 0.98)",
      c2: "rgba(200, 100, 70, 0.95)",
      c3: "rgba(120, 40, 25, 0.95)",
      ring: "transparent",
    },
    bands: [
      { y: 0.2, h: 0.09, colour: "rgba(230,130,80,0.3)" },
      { y: 0.4, h: 0.07, colour: "rgba(200,90,55,0.25)" },
      { y: 0.6, h: 0.1, colour: "rgba(240,140,90,0.28)" },
      { y: 0.78, h: 0.06, colour: "rgba(180,70,40,0.22)" },
    ],
    spots: [{ x: 0.45, y: 0.35, rx: 0.08, ry: 0.04, colour: "rgba(255,200,160,0.35)" }],
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
      c1: "rgba(180, 130, 100, 0.98)",
      c2: "rgba(120, 70, 50, 0.95)",
      c3: "rgba(55, 30, 20, 0.95)",
      ring: "transparent",
    },
    bands: [
      { y: 0.14, h: 0.07, colour: "rgba(140,80,50,0.35)" },
      { y: 0.24, h: 0.06, colour: "rgba(160,100,65,0.25)" },
      { y: 0.34, h: 0.08, colour: "rgba(110,60,35,0.4)" },
      { y: 0.46, h: 0.05, colour: "rgba(150,90,60,0.2)" },
      { y: 0.56, h: 0.09, colour: "rgba(100,50,28,0.42)" },
      { y: 0.68, h: 0.06, colour: "rgba(140,85,55,0.3)" },
      { y: 0.78, h: 0.07, colour: "rgba(120,65,40,0.35)" },
      { y: 0.88, h: 0.05, colour: "rgba(130,75,48,0.25)" },
    ],
    spots: [
      { x: 0.5, y: 0.45, rx: 0.14, ry: 0.07, colour: "rgba(90,35,18,0.5)" },
      { x: 0.35, y: 0.7, rx: 0.06, ry: 0.03, colour: "rgba(100,45,25,0.35)" },
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
      c1: "rgba(160, 210, 200, 0.98)",
      c2: "rgba(110, 170, 170, 0.95)",
      c3: "rgba(50, 90, 95, 0.95)",
      ring: "transparent",
    },
    bands: [
      { y: 0.3, h: 0.05, colour: "rgba(130,190,180,0.15)" },
      { y: 0.55, h: 0.06, colour: "rgba(100,160,155,0.12)" },
    ],
    spots: [],
    hasRing: false,
    ringStyle: { colour: "rgba(140,190,185,0.25)", gap: 0.8, width: 0.25 },
    glow: null,
    special: "haze",
  },
  {
    id: "ringed-ice",
    label: "Ringed Ice Giant",
    category: "Realistic",
    palette: {
      size: 12,
      c1: "rgba(140, 210, 220, 0.98)",
      c2: "rgba(80, 160, 180, 0.95)",
      c3: "rgba(30, 70, 90, 0.95)",
      ring: "rgba(180, 230, 245, 0.4)",
    },
    bands: [
      { y: 0.25, h: 0.06, colour: "rgba(100,180,200,0.18)" },
      { y: 0.5, h: 0.07, colour: "rgba(70,150,175,0.2)" },
      { y: 0.72, h: 0.05, colour: "rgba(90,170,190,0.15)" },
    ],
    spots: [],
    hasRing: true,
    ringStyle: { colour: "rgba(180,230,245,0.45)", gap: 0.65, width: 0.4 },
    glow: null,
    special: null,
  },
  {
    id: "puffy",
    label: "Puffy Giant",
    category: "Realistic",
    palette: {
      size: 14,
      c1: "rgba(230, 210, 240, 0.95)",
      c2: "rgba(200, 175, 215, 0.9)",
      c3: "rgba(140, 115, 160, 0.88)",
      ring: "transparent",
    },
    bands: [
      { y: 0.3, h: 0.06, colour: "rgba(210,190,225,0.12)" },
      { y: 0.55, h: 0.05, colour: "rgba(195,170,210,0.1)" },
    ],
    spots: [],
    hasRing: false,
    ringStyle: { colour: "rgba(210,195,230,0.25)", gap: 0.76, width: 0.3 },
    glow: { colour: "rgba(220,200,240,0.2)", radius: 1.3 },
    special: "puffy",
  },
  {
    id: "hazy",
    label: "Hazy Giant",
    category: "Realistic",
    palette: {
      size: 13,
      c1: "rgba(210, 190, 140, 0.98)",
      c2: "rgba(170, 145, 100, 0.95)",
      c3: "rgba(100, 80, 50, 0.95)",
      ring: "transparent",
    },
    bands: [
      { y: 0.22, h: 0.06, colour: "rgba(190,165,110,0.18)" },
      { y: 0.42, h: 0.07, colour: "rgba(160,130,85,0.22)" },
      { y: 0.62, h: 0.06, colour: "rgba(180,155,105,0.16)" },
    ],
    spots: [],
    hasRing: false,
    ringStyle: { colour: "rgba(185,160,110,0.3)", gap: 0.74, width: 0.3 },
    glow: null,
    special: "haze",
  },
  {
    id: "water-cloud",
    label: "Water-Cloud Giant",
    category: "Realistic",
    palette: {
      size: 13,
      c1: "rgba(245, 245, 250, 0.98)",
      c2: "rgba(220, 225, 235, 0.95)",
      c3: "rgba(170, 180, 200, 0.95)",
      ring: "transparent",
    },
    bands: [
      { y: 0.18, h: 0.06, colour: "rgba(220,225,240,0.2)" },
      { y: 0.32, h: 0.05, colour: "rgba(200,210,230,0.18)" },
      { y: 0.48, h: 0.07, colour: "rgba(215,220,238,0.22)" },
      { y: 0.62, h: 0.05, colour: "rgba(195,205,225,0.16)" },
      { y: 0.76, h: 0.06, colour: "rgba(210,218,235,0.2)" },
    ],
    spots: [{ x: 0.45, y: 0.5, rx: 0.06, ry: 0.04, colour: "rgba(235,238,248,0.35)" }],
    hasRing: false,
    ringStyle: { colour: "rgba(210,215,230,0.28)", gap: 0.76, width: 0.3 },
    glow: null,
    special: null,
  },

  {
    id: "helium",
    label: "Helium Giant",
    category: "Realistic",
    palette: {
      size: 12,
      c1: "rgba(195, 195, 200, 0.98)",
      c2: "rgba(150, 150, 158, 0.95)",
      c3: "rgba(90, 90, 100, 0.95)",
      ring: "transparent",
    },
    bands: [
      { y: 0.2, h: 0.06, colour: "rgba(170,170,178,0.15)" },
      { y: 0.38, h: 0.05, colour: "rgba(140,140,150,0.12)" },
      { y: 0.55, h: 0.07, colour: "rgba(160,160,170,0.18)" },
      { y: 0.72, h: 0.05, colour: "rgba(130,130,142,0.14)" },
    ],
    spots: [],
    hasRing: false,
    ringStyle: { colour: "rgba(180,180,190,0.22)", gap: 0.78, width: 0.28 },
    glow: null,
    special: null,
  },

  // ── Fantastical (7) ─────────────────────────────────────────────
  {
    id: "storm",
    label: "Storm World",
    category: "Fantastical",
    palette: {
      size: 14,
      c1: "rgba(100, 130, 90, 0.98)",
      c2: "rgba(60, 80, 70, 0.95)",
      c3: "rgba(25, 30, 35, 0.95)",
      ring: "transparent",
    },
    bands: [
      { y: 0.15, h: 0.1, colour: "rgba(80,110,75,0.3)" },
      { y: 0.3, h: 0.08, colour: "rgba(50,70,60,0.35)" },
      { y: 0.45, h: 0.12, colour: "rgba(90,120,80,0.25)" },
      { y: 0.62, h: 0.09, colour: "rgba(40,60,50,0.4)" },
      { y: 0.76, h: 0.08, colour: "rgba(70,100,65,0.3)" },
    ],
    spots: [
      { x: 0.5, y: 0.4, rx: 0.15, ry: 0.08, colour: "rgba(20,35,25,0.5)" },
      { x: 0.35, y: 0.65, rx: 0.08, ry: 0.05, colour: "rgba(30,50,35,0.4)" },
    ],
    hasRing: false,
    ringStyle: { colour: "rgba(70,100,65,0.3)", gap: 0.72, width: 0.32 },
    glow: null,
    special: "lightning",
  },
  {
    id: "ember",
    label: "Ember World",
    category: "Fantastical",
    palette: {
      size: 14,
      c1: "rgba(60, 40, 35, 0.98)",
      c2: "rgba(35, 20, 18, 0.95)",
      c3: "rgba(15, 8, 6, 0.95)",
      ring: "transparent",
    },
    bands: [
      { y: 0.2, h: 0.06, colour: "rgba(45,25,20,0.15)" },
      { y: 0.5, h: 0.07, colour: "rgba(50,30,22,0.12)" },
      { y: 0.75, h: 0.05, colour: "rgba(40,22,18,0.1)" },
    ],
    spots: [],
    hasRing: false,
    ringStyle: { colour: "rgba(180,60,20,0.3)", gap: 0.7, width: 0.3 },
    glow: { colour: "rgba(255,80,20,0.15)", radius: 1.15 },
    special: "cracks",
  },
  {
    id: "crystal",
    label: "Crystal World",
    category: "Fantastical",
    palette: {
      size: 13,
      c1: "rgba(220, 240, 255, 0.98)",
      c2: "rgba(160, 200, 240, 0.95)",
      c3: "rgba(80, 110, 170, 0.95)",
      ring: "rgba(200, 230, 255, 0.35)",
    },
    bands: [
      { y: 0.25, h: 0.06, colour: "rgba(180,210,250,0.15)" },
      { y: 0.5, h: 0.07, colour: "rgba(160,195,240,0.12)" },
      { y: 0.7, h: 0.05, colour: "rgba(190,220,250,0.18)" },
    ],
    spots: [],
    hasRing: true,
    ringStyle: { colour: "rgba(200,230,255,0.4)", gap: 0.72, width: 0.35 },
    glow: null,
    special: "prismatic",
  },
  {
    id: "void",
    label: "Void World",
    category: "Fantastical",
    palette: {
      size: 14,
      c1: "rgba(20, 18, 25, 0.98)",
      c2: "rgba(10, 8, 15, 0.95)",
      c3: "rgba(2, 2, 5, 0.98)",
      ring: "transparent",
    },
    bands: [],
    spots: [],
    hasRing: false,
    ringStyle: { colour: "rgba(60,70,120,0.2)", gap: 0.78, width: 0.28 },
    glow: { colour: "rgba(100,120,180,0.12)", radius: 1.35 },
    special: "corona",
  },
  {
    id: "aurora",
    label: "Aurora World",
    category: "Fantastical",
    palette: {
      size: 13,
      c1: "rgba(30, 35, 50, 0.98)",
      c2: "rgba(20, 22, 35, 0.95)",
      c3: "rgba(8, 10, 18, 0.95)",
      ring: "transparent",
    },
    bands: [
      { y: 0.35, h: 0.05, colour: "rgba(25,28,40,0.12)" },
      { y: 0.6, h: 0.05, colour: "rgba(22,25,38,0.1)" },
    ],
    spots: [],
    hasRing: false,
    ringStyle: { colour: "rgba(0,200,160,0.25)", gap: 0.74, width: 0.3 },
    glow: null,
    special: "aurora",
  },
  {
    id: "machine",
    label: "Machine World",
    category: "Fantastical",
    palette: {
      size: 13,
      c1: "rgba(55, 58, 65, 0.98)",
      c2: "rgba(35, 38, 45, 0.95)",
      c3: "rgba(18, 20, 28, 0.95)",
      ring: "transparent",
    },
    bands: [
      { y: 0.25, h: 0.02, colour: "rgba(0,220,255,0.08)" },
      { y: 0.5, h: 0.02, colour: "rgba(0,220,255,0.08)" },
      { y: 0.75, h: 0.02, colour: "rgba(0,220,255,0.08)" },
    ],
    spots: [],
    hasRing: false,
    ringStyle: { colour: "rgba(0,180,220,0.3)", gap: 0.72, width: 0.25 },
    glow: null,
    special: "grid",
  },
  {
    id: "shattered",
    label: "Shattered Planet",
    category: "Fantastical",
    palette: {
      size: 13,
      c1: "rgba(160, 200, 190, 0.98)",
      c2: "rgba(110, 140, 130, 0.95)",
      c3: "rgba(60, 75, 70, 0.95)",
      ring: "transparent",
    },
    bands: [
      { y: 0.25, h: 0.06, colour: "rgba(130,160,150,0.2)" },
      { y: 0.55, h: 0.05, colour: "rgba(100,130,120,0.15)" },
    ],
    spots: [],
    hasRing: false,
    ringStyle: { colour: "rgba(120,70,30,0.3)", gap: 0.8, width: 0.35 },
    glow: { colour: "rgba(255,140,30,0.18)", radius: 1.2 },
    special: "shatter",
  },
];

// Legacy alias map (old id → new id)
const ALIASES = { ice: "neptune", hot: "hot-jupiter", exotic: "crystal" };

// Fast lookup
const BY_ID = Object.create(null);
for (const s of STYLE_DEFS) BY_ID[s.id] = s;
for (const [alias, target] of Object.entries(ALIASES)) BY_ID[alias] = BY_ID[target];

// ── Public API ──────────────────────────────────────────────────────

/** Ordered list of { id, label, category } for dropdown building. */
export const GAS_GIANT_STYLES = STYLE_DEFS.map(({ id, label, category }) => ({
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
 * Fantastical styles (storm, ember, crystal, void, aurora, machine,
 * shattered) are never auto-suggested.
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
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const dpr = window.devicePixelRatio || 1;
  const w = 180;
  const h = 180;
  canvas.width = w * dpr;
  canvas.height = h * dpr;
  canvas.style.width = w + "px";
  canvas.style.height = h + "px";
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  const def = getStyleById(styleId);
  const cx = w / 2;
  const cy = h / 2;
  const r = 68;
  const rng = seededRng(def.id);

  ctx.clearRect(0, 0, w, h);

  // Outer glow
  if (def.glow) {
    const gr = r * def.glow.radius;
    const gGrad = ctx.createRadialGradient(cx, cy, r * 0.9, cx, cy, gr);
    gGrad.addColorStop(0, def.glow.colour);
    gGrad.addColorStop(1, "transparent");
    ctx.fillStyle = gGrad;
    ctx.beginPath();
    ctx.arc(cx, cy, gr, 0, Math.PI * 2);
    ctx.fill();
  }

  // Back half of ring (behind planet)
  if (opts.showRings && def.ringStyle) {
    drawRingHalf(ctx, cx, cy, r, def.ringStyle, "back");
  }

  // Clip to planet sphere for bands/spots/effects
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.clip();

  // Base sphere gradient
  const baseGrad = ctx.createRadialGradient(cx - r * 0.25, cy - r * 0.2, r * 0.1, cx, cy, r);
  baseGrad.addColorStop(0, def.palette.c1);
  baseGrad.addColorStop(0.55, def.palette.c2);
  baseGrad.addColorStop(1, def.palette.c3);
  ctx.fillStyle = baseGrad;
  ctx.fillRect(0, 0, w, h);

  // Atmospheric bands
  for (const band of def.bands) {
    const by = cy - r + band.y * r * 2;
    const bh = band.h * r * 2;
    ctx.fillStyle = band.colour;
    // Curved band: elliptical arc clipped to sphere
    ctx.beginPath();
    ctx.ellipse(cx, by + bh / 2, r * 1.05, bh / 2, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // Cloud spots
  for (const spot of def.spots) {
    const sx = cx - r + spot.x * r * 2;
    const sy = cy - r + spot.y * r * 2;
    const spotGrad = ctx.createRadialGradient(sx, sy, 0, sx, sy, spot.rx * r * 2);
    spotGrad.addColorStop(0, spot.colour);
    spotGrad.addColorStop(1, "transparent");
    ctx.fillStyle = spotGrad;
    ctx.beginPath();
    ctx.ellipse(sx, sy, spot.rx * r * 2, spot.ry * r * 2, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // Special effects (within sphere clip)
  if (def.special === "lightning") {
    drawLightning(ctx, cx, cy, r, rng);
  } else if (def.special === "cracks") {
    drawCracks(ctx, cx, cy, r, rng);
  } else if (def.special === "shatter") {
    drawShatter(ctx, cx, cy, r, rng);
  } else if (def.special === "prismatic") {
    drawPrismatic(ctx, cx, cy, r, rng);
  } else if (def.special === "corona") {
    drawCorona(ctx, cx, cy, r);
  } else if (def.special === "aurora") {
    drawAurora(ctx, cx, cy, r);
  } else if (def.special === "haze") {
    drawHaze(ctx, cx, cy, r, def);
  } else if (def.special === "puffy") {
    drawPuffy(ctx, cx, cy, r);
  } else if (def.special === "grid") {
    drawGrid(ctx, cx, cy, r, rng);
  }

  // Limb darkening
  const limbGrad = ctx.createRadialGradient(cx, cy, r * 0.5, cx, cy, r);
  limbGrad.addColorStop(0, "transparent");
  limbGrad.addColorStop(0.7, "transparent");
  limbGrad.addColorStop(1, "rgba(0,0,0,0.45)");
  ctx.fillStyle = limbGrad;
  ctx.fillRect(0, 0, w, h);

  // Specular highlight
  const hlGrad = ctx.createRadialGradient(
    cx - r * 0.3,
    cy - r * 0.3,
    0,
    cx - r * 0.3,
    cy - r * 0.3,
    r * 0.35,
  );
  hlGrad.addColorStop(0, "rgba(255,255,255,0.25)");
  hlGrad.addColorStop(0.5, "rgba(255,255,255,0.06)");
  hlGrad.addColorStop(1, "transparent");
  ctx.fillStyle = hlGrad;
  ctx.fillRect(0, 0, w, h);

  ctx.restore(); // un-clip

  // Shattered debris (outside sphere clip)
  if (def.special === "shatter") {
    drawShatterDebris(ctx, cx, cy, r, seededRng(def.id + "debris"));
  }

  // Front half of ring (in front of planet)
  if (opts.showRings && def.ringStyle) {
    drawRingHalf(ctx, cx, cy, r, def.ringStyle, "front");
  }
}

// ── System visualiser renderer ──────────────────────────────────────

/**
 * Draw a gas giant node at system-visualiser scale (~8–20 px radius).
 * Includes bands, glow, spots, rings, and special effects adapted for
 * small sizes.
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} x        Centre x
 * @param {number} y        Centre y
 * @param {number} r        Pixel radius of the planet body
 * @param {string} styleId  Gas giant style id
 * @param {object} opts     { lightDx, lightDy } — unit vector toward star (for highlight)
 *                          { angle, idx } — orbit angle + index (ring tilt seed)
 */
export function drawGasGiantViz(ctx, x, y, r, styleId, opts = {}) {
  const def = getStyleById(styleId);
  const pal = def.palette;
  const lx = opts.lightDx || 0;
  const ly = opts.lightDy || 0;
  const rng = seededRng(def.id);

  // ── Outer glow (before planet body) ──
  if (def.glow) {
    const gr = r * def.glow.radius;
    const gGrad = ctx.createRadialGradient(x, y, r * 0.8, x, y, gr);
    gGrad.addColorStop(0, def.glow.colour);
    gGrad.addColorStop(1, "transparent");
    ctx.fillStyle = gGrad;
    ctx.beginPath();
    ctx.arc(x, y, gr, 0, Math.PI * 2);
    ctx.fill();
  }

  // ── Back ring half (behind planet) ──
  if (opts.showRings && def.ringStyle) {
    drawVizRingHalf(ctx, x, y, r, def.ringStyle, "back", opts);
  }

  // ── Planet body ──
  ctx.save();
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.clip();

  // Base radial gradient (lit from star direction)
  const hlOffX = lx * r * 0.4;
  const hlOffY = ly * r * 0.4;
  const baseGrad = ctx.createRadialGradient(x + hlOffX, y + hlOffY, r * 0.1, x, y, r);
  baseGrad.addColorStop(0, pal.c1);
  baseGrad.addColorStop(0.55, pal.c2);
  baseGrad.addColorStop(1, pal.c3);
  ctx.fillStyle = baseGrad;
  ctx.fill();

  // Atmospheric bands (show if planet is big enough)
  if (r >= 5 && def.bands.length > 0) {
    // At small scale, show fewer bands
    const maxBands = r >= 10 ? def.bands.length : Math.min(3, def.bands.length);
    for (let i = 0; i < maxBands; i++) {
      const band = def.bands[i];
      const by = y - r + band.y * r * 2;
      const bh = Math.max(1, band.h * r * 2);
      ctx.fillStyle = band.colour;
      ctx.beginPath();
      ctx.ellipse(x, by + bh / 2, r * 1.05, bh / 2, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Spots (only at larger sizes)
  if (r >= 8 && def.spots.length > 0) {
    const spot = def.spots[0]; // Just the primary spot at viz scale
    const sx = x - r + spot.x * r * 2;
    const sy = y - r + spot.y * r * 2;
    const sGrad = ctx.createRadialGradient(sx, sy, 0, sx, sy, spot.rx * r * 2);
    sGrad.addColorStop(0, spot.colour);
    sGrad.addColorStop(1, "transparent");
    ctx.fillStyle = sGrad;
    ctx.beginPath();
    ctx.ellipse(sx, sy, spot.rx * r * 2, spot.ry * r * 2, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // Special effects (simplified for small scale)
  if (r >= 6) {
    if (def.special === "lightning") {
      ctx.globalCompositeOperation = "screen";
      for (let i = 0; i < 3; i++) {
        const lxx = x - r * 0.5 + rng() * r;
        const lyy = y - r * 0.5 + rng() * r;
        const lG = ctx.createRadialGradient(lxx, lyy, 0, lxx, lyy, r * 0.2);
        lG.addColorStop(0, "rgba(180,255,200,0.45)");
        lG.addColorStop(1, "transparent");
        ctx.fillStyle = lG;
        ctx.beginPath();
        ctx.arc(lxx, lyy, r * 0.2, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalCompositeOperation = "source-over";
    } else if (def.special === "cracks") {
      ctx.globalCompositeOperation = "screen";
      ctx.strokeStyle = "rgba(255,100,20,0.5)";
      ctx.lineWidth = Math.max(0.5, r * 0.08);
      ctx.shadowColor = "rgba(255,60,10,0.6)";
      ctx.shadowBlur = 2;
      for (let i = 0; i < 4; i++) {
        ctx.beginPath();
        let px = x - r * 0.4 + rng() * r * 0.8;
        let py = y - r * 0.4 + rng() * r * 0.8;
        ctx.moveTo(px, py);
        for (let j = 0; j < 3; j++) {
          px += (rng() - 0.5) * r * 0.5;
          py += (rng() - 0.5) * r * 0.5;
          ctx.lineTo(px, py);
        }
        ctx.stroke();
      }
      ctx.shadowBlur = 0;
      ctx.globalCompositeOperation = "source-over";
    } else if (def.special === "shatter") {
      // Magma underglow
      ctx.globalCompositeOperation = "screen";
      const mG = ctx.createRadialGradient(x, y, r * 0.1, x, y, r * 0.85);
      mG.addColorStop(0, "rgba(255,200,60,0.6)");
      mG.addColorStop(0.5, "rgba(255,120,30,0.35)");
      mG.addColorStop(1, "rgba(120,30,5,0.1)");
      ctx.fillStyle = mG;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalCompositeOperation = "source-over";
      // Radial crack lines
      const crackN = 5;
      ctx.strokeStyle = "rgba(0,0,0,0.5)";
      ctx.lineWidth = Math.max(0.8, r * 0.07);
      ctx.lineCap = "round";
      for (let i = 0; i < crackN; i++) {
        const a = (i / crackN) * Math.PI * 2 + (rng() - 0.5) * 0.7;
        ctx.beginPath();
        ctx.moveTo(x, y);
        let cx2 = x,
          cy2 = y;
        for (let j = 0; j < 3; j++) {
          const t = (j + 1) / 3;
          const w = (rng() - 0.5) * 0.4 * t;
          cx2 = x + Math.cos(a + w) * r * 0.85 * t;
          cy2 = y + Math.sin(a + w) * r * 0.85 * t;
          ctx.lineTo(cx2, cy2);
        }
        ctx.stroke();
      }
      // Magma glow in cracks
      ctx.globalCompositeOperation = "screen";
      ctx.strokeStyle = "rgba(255,150,40,0.5)";
      ctx.lineWidth = Math.max(0.5, r * 0.04);
      ctx.shadowColor = "rgba(255,80,10,0.6)";
      ctx.shadowBlur = 2;
      const rng2 = seededRng(def.id); // re-seed for same crack positions
      for (let i = 0; i < crackN; i++) {
        const a = (i / crackN) * Math.PI * 2 + (rng2() - 0.5) * 0.7;
        ctx.beginPath();
        ctx.moveTo(x, y);
        for (let j = 0; j < 3; j++) {
          const t = (j + 1) / 3;
          const w = (rng2() - 0.5) * 0.4 * t;
          ctx.lineTo(x + Math.cos(a + w) * r * 0.85 * t, y + Math.sin(a + w) * r * 0.85 * t);
        }
        ctx.stroke();
      }
      ctx.shadowBlur = 0;
      ctx.globalCompositeOperation = "source-over";
    } else if (def.special === "prismatic") {
      ctx.globalCompositeOperation = "overlay";
      const pCols = ["rgba(255,80,80,0.1)", "rgba(80,255,120,0.08)", "rgba(80,180,255,0.1)"];
      for (let i = 0; i < pCols.length; i++) {
        const angle = (i / pCols.length) * Math.PI * 2 + rng() * 0.5;
        const dx = Math.cos(angle) * r * 0.25;
        const dy = Math.sin(angle) * r * 0.25;
        const pG = ctx.createRadialGradient(x + dx, y + dy, 0, x + dx, y + dy, r * 0.7);
        pG.addColorStop(0, pCols[i]);
        pG.addColorStop(1, "transparent");
        ctx.fillStyle = pG;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalCompositeOperation = "source-over";
    } else if (def.special === "corona") {
      ctx.globalCompositeOperation = "screen";
      const cG = ctx.createRadialGradient(x, y, r * 0.8, x, y, r);
      cG.addColorStop(0, "transparent");
      cG.addColorStop(0.5, "rgba(100,130,200,0.2)");
      cG.addColorStop(1, "rgba(60,80,150,0.08)");
      ctx.fillStyle = cG;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalCompositeOperation = "source-over";
    } else if (def.special === "aurora") {
      ctx.globalCompositeOperation = "screen";
      const aC = ["rgba(0,255,140,0.2)", "rgba(0,200,255,0.15)"];
      for (let i = 0; i < aC.length; i++) {
        const sp = 0.2 + i * 0.1;
        const nG = ctx.createRadialGradient(x, y - r * 0.65, 0, x, y - r * 0.65, r * sp);
        nG.addColorStop(0, aC[i]);
        nG.addColorStop(1, "transparent");
        ctx.fillStyle = nG;
        ctx.beginPath();
        ctx.ellipse(x, y - r * 0.65, r * sp * 1.3, r * sp * 0.5, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalCompositeOperation = "source-over";
    } else if (def.special === "haze") {
      const hG = ctx.createRadialGradient(x, y, r * 0.3, x, y, r);
      hG.addColorStop(0, "transparent");
      hG.addColorStop(0.6, pal.c2.replace(/[\d.]+\)$/, "0.12)"));
      hG.addColorStop(1, pal.c1.replace(/[\d.]+\)$/, "0.2)"));
      ctx.fillStyle = hG;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    } else if (def.special === "puffy") {
      const pG = ctx.createRadialGradient(x, y, r * 0.5, x, y, r);
      pG.addColorStop(0, "transparent");
      pG.addColorStop(0.7, "rgba(255,255,255,0.03)");
      pG.addColorStop(1, "rgba(255,255,255,0.08)");
      ctx.fillStyle = pG;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    } else if (def.special === "grid") {
      ctx.save();
      ctx.globalCompositeOperation = "screen";
      ctx.strokeStyle = "rgba(0,200,255,0.25)";
      ctx.lineWidth = Math.max(0.5, r * 0.02);
      ctx.shadowColor = "rgba(0,180,255,0.4)";
      ctx.shadowBlur = 2;
      for (let i = 0; i < 4; i++) {
        const yOff = -r * 0.6 + (r * 1.2 * (i + 0.5)) / 4;
        const halfW = Math.sqrt(Math.max(0, r * r - yOff * yOff));
        if (halfW < 1) continue;
        ctx.beginPath();
        ctx.moveTo(x - halfW, y + yOff);
        ctx.lineTo(x + halfW, y + yOff);
        ctx.stroke();
      }
      for (let i = 0; i < 3; i++) {
        const frac = (i + 1) / 4;
        const xOff = r * (frac * 2 - 1);
        const halfH = Math.sqrt(Math.max(0, r * r - xOff * xOff));
        if (halfH < 1) continue;
        ctx.beginPath();
        ctx.moveTo(x + xOff, y - halfH);
        ctx.lineTo(x + xOff, y + halfH);
        ctx.stroke();
      }
      ctx.restore();
    }
  }

  // Limb darkening
  const limbGrad = ctx.createRadialGradient(x, y, r * 0.5, x, y, r);
  limbGrad.addColorStop(0, "transparent");
  limbGrad.addColorStop(0.75, "transparent");
  limbGrad.addColorStop(1, "rgba(0,0,0,0.35)");
  ctx.fillStyle = limbGrad;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();

  // Specular highlight
  if (r >= 4) {
    const hx = x + hlOffX * 0.6;
    const hy = y + hlOffY * 0.6;
    const hlG = ctx.createRadialGradient(hx, hy, 0, hx, hy, r * 0.4);
    hlG.addColorStop(0, "rgba(255,255,255,0.2)");
    hlG.addColorStop(0.5, "rgba(255,255,255,0.04)");
    hlG.addColorStop(1, "transparent");
    ctx.fillStyle = hlG;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore(); // un-clip

  // Shattered debris (outside sphere clip)
  if (def.special === "shatter" && r >= 6) {
    drawShatterDebris(ctx, x, y, r, seededRng(def.id + "debris"));
  }

  // ── Front ring half (in front of planet) ──
  if (opts.showRings && def.ringStyle) {
    drawVizRingHalf(ctx, x, y, r, def.ringStyle, "front", opts);
  }

  // Subtle outline
  ctx.strokeStyle = "rgba(255,255,255,0.10)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.stroke();
}

/**
 * Draw half a ring (back or front) at visualiser scale.
 */
function drawVizRingHalf(ctx, cx, cy, r, rs, half, opts = {}) {
  const tilt = rs.tilt || 0.3;
  const rotAngle = (opts.angle || 0) * 0.35 + (opts.idx || 0) * 0.4;
  const innerR = r * 1.35;
  const outerR = r * (1.35 + rs.width * 1.2);

  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(rotAngle);
  ctx.scale(1, tilt);

  const grad = ctx.createRadialGradient(0, 0, innerR, 0, 0, outerR);
  grad.addColorStop(0, "transparent");
  grad.addColorStop(0.2, rs.colour);
  grad.addColorStop(
    0.5,
    rs.colour.replace(/[\d.]+\)$/, (m) => `${parseFloat(m) * 0.5})`),
  );
  grad.addColorStop(0.8, rs.colour);
  grad.addColorStop(1, "transparent");

  ctx.fillStyle = grad;
  ctx.beginPath();
  if (half === "back") {
    ctx.arc(0, 0, outerR, Math.PI, 0, false);
    ctx.arc(0, 0, innerR, 0, Math.PI, true);
  } else {
    ctx.arc(0, 0, outerR, 0, Math.PI, false);
    ctx.arc(0, 0, innerR, Math.PI, 0, true);
  }
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

// ── Ring drawing (preview) ──────────────────────────────────────────

function drawRingHalf(ctx, cx, cy, r, rs, half) {
  const tilt = rs.tilt || 0.3;
  const innerR = r * (1 + rs.gap * 0.3);
  const outerR = r * (1 + rs.gap * 0.3 + rs.width);
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(1, tilt);

  // Draw ring as stroked arcs
  const grad = ctx.createRadialGradient(0, 0, innerR, 0, 0, outerR);
  grad.addColorStop(0, "transparent");
  grad.addColorStop(0.15, rs.colour);
  grad.addColorStop(
    0.5,
    rs.colour.replace(/[\d.]+\)$/, (m) => `${parseFloat(m) * 0.6})`),
  );
  grad.addColorStop(0.85, rs.colour);
  grad.addColorStop(1, "transparent");

  ctx.fillStyle = grad;
  ctx.beginPath();
  if (half === "back") {
    // Top arc (behind planet)
    ctx.arc(0, 0, outerR, Math.PI, 0, false);
    ctx.arc(0, 0, innerR, 0, Math.PI, true);
  } else {
    // Bottom arc (in front of planet)
    ctx.arc(0, 0, outerR, 0, Math.PI, false);
    ctx.arc(0, 0, innerR, Math.PI, 0, true);
  }
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

// ── Special effects ─────────────────────────────────────────────────

function drawLightning(ctx, cx, cy, r, rng) {
  ctx.save();
  ctx.globalCompositeOperation = "screen";
  for (let i = 0; i < 5; i++) {
    const lx = cx - r * 0.6 + rng() * r * 1.2;
    const ly = cy - r * 0.6 + rng() * r * 1.2;
    const lGrad = ctx.createRadialGradient(lx, ly, 0, lx, ly, r * 0.12);
    lGrad.addColorStop(0, "rgba(180,255,200,0.6)");
    lGrad.addColorStop(0.4, "rgba(120,200,255,0.2)");
    lGrad.addColorStop(1, "transparent");
    ctx.fillStyle = lGrad;
    ctx.beginPath();
    ctx.arc(lx, ly, r * 0.12, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawCracks(ctx, cx, cy, r, rng) {
  ctx.save();
  ctx.globalCompositeOperation = "screen";
  ctx.strokeStyle = "rgba(255,100,20,0.55)";
  ctx.lineWidth = 1.5;
  ctx.shadowColor = "rgba(255,60,10,0.8)";
  ctx.shadowBlur = 4;
  for (let i = 0; i < 7; i++) {
    ctx.beginPath();
    let px = cx - r * 0.5 + rng() * r;
    let py = cy - r * 0.5 + rng() * r;
    ctx.moveTo(px, py);
    for (let j = 0; j < 4; j++) {
      px += (rng() - 0.5) * r * 0.35;
      py += (rng() - 0.5) * r * 0.35;
      ctx.lineTo(px, py);
    }
    ctx.stroke();
  }
  ctx.restore();
}

function drawPrismatic(ctx, cx, cy, r, rng) {
  ctx.save();
  ctx.globalCompositeOperation = "overlay";
  const colours = [
    "rgba(255,80,80,0.12)",
    "rgba(255,200,60,0.1)",
    "rgba(80,255,120,0.1)",
    "rgba(80,180,255,0.12)",
    "rgba(180,80,255,0.1)",
  ];
  for (let i = 0; i < colours.length; i++) {
    const angle = (i / colours.length) * Math.PI * 2 + rng() * 0.5;
    const dx = Math.cos(angle) * r * 0.3;
    const dy = Math.sin(angle) * r * 0.3;
    const pGrad = ctx.createRadialGradient(cx + dx, cy + dy, 0, cx + dx, cy + dy, r * 0.8);
    pGrad.addColorStop(0, colours[i]);
    pGrad.addColorStop(1, "transparent");
    ctx.fillStyle = pGrad;
    ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
  }
  ctx.restore();
}

function drawCorona(ctx, cx, cy, r) {
  // Faint corona glow at edge of extremely dark body
  ctx.save();
  ctx.globalCompositeOperation = "screen";
  const cGrad = ctx.createRadialGradient(cx, cy, r * 0.85, cx, cy, r * 1.05);
  cGrad.addColorStop(0, "transparent");
  cGrad.addColorStop(0.5, "rgba(100,130,200,0.15)");
  cGrad.addColorStop(1, "rgba(60,80,150,0.05)");
  ctx.fillStyle = cGrad;
  ctx.beginPath();
  ctx.arc(cx, cy, r * 1.05, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawAurora(ctx, cx, cy, r) {
  ctx.save();
  ctx.globalCompositeOperation = "screen";
  const auroraColours = ["rgba(0,255,140,0.3)", "rgba(0,200,255,0.25)", "rgba(140,0,255,0.2)"];
  // North pole auroras
  for (let i = 0; i < auroraColours.length; i++) {
    const spread = 0.3 + i * 0.12;
    const aGrad = ctx.createRadialGradient(cx, cy - r * 0.75, 0, cx, cy - r * 0.75, r * spread);
    aGrad.addColorStop(0, auroraColours[i]);
    aGrad.addColorStop(1, "transparent");
    ctx.fillStyle = aGrad;
    ctx.beginPath();
    ctx.ellipse(cx, cy - r * 0.75, r * spread * 1.5, r * spread * 0.6, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  // South pole auroras (dimmer)
  for (let i = 0; i < auroraColours.length; i++) {
    const spread = 0.25 + i * 0.1;
    const aGrad = ctx.createRadialGradient(cx, cy + r * 0.75, 0, cx, cy + r * 0.75, r * spread);
    aGrad.addColorStop(
      0,
      auroraColours[i].replace("0.3", "0.18").replace("0.25", "0.15").replace("0.2", "0.12"),
    );
    aGrad.addColorStop(1, "transparent");
    ctx.fillStyle = aGrad;
    ctx.beginPath();
    ctx.ellipse(cx, cy + r * 0.75, r * spread * 1.3, r * spread * 0.5, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawHaze(ctx, cx, cy, r, def) {
  ctx.save();
  const hazeGrad = ctx.createRadialGradient(cx, cy, r * 0.3, cx, cy, r);
  hazeGrad.addColorStop(0, "transparent");
  hazeGrad.addColorStop(0.5, def.palette.c2.replace(/[\d.]+\)$/, "0.15)"));
  hazeGrad.addColorStop(0.85, def.palette.c1.replace(/[\d.]+\)$/, "0.25)"));
  hazeGrad.addColorStop(1, "transparent");
  ctx.fillStyle = hazeGrad;
  ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
  ctx.restore();
}

function drawPuffy(ctx, cx, cy, r) {
  // Extra soft glow + transparency at limb
  ctx.save();
  const pGrad = ctx.createRadialGradient(cx, cy, r * 0.6, cx, cy, r);
  pGrad.addColorStop(0, "transparent");
  pGrad.addColorStop(0.7, "rgba(255,255,255,0.04)");
  pGrad.addColorStop(1, "rgba(255,255,255,0.1)");
  ctx.fillStyle = pGrad;
  ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
  ctx.restore();
}

function drawGrid(ctx, cx, cy, r, rng) {
  ctx.save();
  ctx.globalCompositeOperation = "screen";
  ctx.strokeStyle = "rgba(0,200,255,0.35)";
  ctx.lineWidth = 0.8;
  ctx.shadowColor = "rgba(0,180,255,0.6)";
  ctx.shadowBlur = 3;
  // Latitude lines
  for (let i = 0; i < 6; i++) {
    const yOff = -r * 0.7 + (r * 1.4 * (i + 0.5)) / 6;
    const halfW = Math.sqrt(Math.max(0, r * r - yOff * yOff));
    if (halfW < 2) continue;
    ctx.beginPath();
    ctx.moveTo(cx - halfW, cy + yOff);
    ctx.lineTo(cx + halfW, cy + yOff);
    ctx.stroke();
  }
  // Longitude lines (arcs)
  for (let i = 0; i < 5; i++) {
    const frac = (i + 1) / 6;
    const xOff = r * (frac * 2 - 1);
    const halfH = Math.sqrt(Math.max(0, r * r - xOff * xOff));
    if (halfH < 2) continue;
    ctx.beginPath();
    ctx.moveTo(cx + xOff, cy - halfH);
    ctx.quadraticCurveTo(cx + xOff + (rng() - 0.5) * r * 0.08, cy, cx + xOff, cy + halfH);
    ctx.stroke();
  }
  // Glowing nodes at intersections
  ctx.shadowBlur = 5;
  ctx.fillStyle = "rgba(0,220,255,0.5)";
  for (let i = 0; i < 8; i++) {
    const nx = cx + (rng() - 0.5) * r * 1.2;
    const ny = cy + (rng() - 0.5) * r * 1.2;
    const distSq = (nx - cx) ** 2 + (ny - cy) ** 2;
    if (distSq > r * r * 0.85) continue;
    ctx.beginPath();
    ctx.arc(nx, ny, 1.5, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

// Shattered planet: broken crust plates with glowing magma interior and debris
function drawShatter(ctx, cx, cy, r, rng) {
  ctx.save();

  // Magma underglow — bright orange-yellow core showing through gaps
  const magmaGrad = ctx.createRadialGradient(cx, cy, r * 0.1, cx, cy, r * 0.85);
  magmaGrad.addColorStop(0, "rgba(255,200,60,0.7)");
  magmaGrad.addColorStop(0.4, "rgba(255,130,30,0.5)");
  magmaGrad.addColorStop(0.7, "rgba(200,60,10,0.3)");
  magmaGrad.addColorStop(1, "rgba(120,30,5,0.15)");
  ctx.globalCompositeOperation = "screen";
  ctx.fillStyle = magmaGrad;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalCompositeOperation = "source-over";

  // Generate crack network from centre outward (jagged radial fractures)
  const crackCount = 8;
  const cracks = [];
  for (let i = 0; i < crackCount; i++) {
    const angle = (i / crackCount) * Math.PI * 2 + (rng() - 0.5) * 0.6;
    const points = [{ x: cx, y: cy }];
    const len = r * (0.7 + rng() * 0.3);
    const segs = 4 + Math.floor(rng() * 3);
    for (let j = 1; j <= segs; j++) {
      const t = j / segs;
      const wobble = (rng() - 0.5) * 0.5;
      const a = angle + wobble * t;
      const d = len * t;
      points.push({ x: cx + Math.cos(a) * d, y: cy + Math.sin(a) * d });
    }
    cracks.push(points);
  }

  // Draw wide dark gaps (the fractures between plates)
  ctx.strokeStyle = "rgba(0,0,0,0.6)";
  ctx.lineWidth = Math.max(2, r * 0.06);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  for (const pts of cracks) {
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let j = 1; j < pts.length; j++) ctx.lineTo(pts[j].x, pts[j].y);
    ctx.stroke();
  }

  // Draw glowing magma in the cracks
  ctx.globalCompositeOperation = "screen";
  ctx.strokeStyle = "rgba(255,160,40,0.6)";
  ctx.lineWidth = Math.max(1.5, r * 0.045);
  ctx.shadowColor = "rgba(255,100,10,0.8)";
  ctx.shadowBlur = 6;
  for (const pts of cracks) {
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let j = 1; j < pts.length; j++) ctx.lineTo(pts[j].x, pts[j].y);
    ctx.stroke();
  }
  ctx.shadowBlur = 0;

  // Inner glow along cracks (brighter near centre)
  ctx.strokeStyle = "rgba(255,220,100,0.4)";
  ctx.lineWidth = Math.max(1, r * 0.025);
  for (const pts of cracks) {
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    const mid = Math.min(3, pts.length);
    for (let j = 1; j < mid; j++) ctx.lineTo(pts[j].x, pts[j].y);
    ctx.stroke();
  }
  ctx.globalCompositeOperation = "source-over";
  ctx.restore();
}

// Floating continental plates around a shattered planet (drawn outside the sphere clip)
function drawShatterDebris(ctx, cx, cy, r, rng) {
  ctx.save();

  // 3–4 large plate fragments + 4–6 small rubble pieces
  const plates = 3 + Math.floor(rng() * 2);
  const rubble = 4 + Math.floor(rng() * 3);

  for (let i = 0; i < plates + rubble; i++) {
    const isPlate = i < plates;
    const angle = rng() * Math.PI * 2;
    const dist = r * (isPlate ? 1.08 + rng() * 0.18 : 1.15 + rng() * 0.3);
    const dx = cx + Math.cos(angle) * dist;
    const dy = cy + Math.sin(angle) * dist;

    // Plates are large and elongated; rubble is small
    const baseR = isPlate ? r * (0.12 + rng() * 0.1) : r * (0.025 + rng() * 0.035);
    const stretch = isPlate ? 1.4 + rng() * 0.8 : 0.8 + rng() * 0.4;
    const tilt = rng() * Math.PI;

    // Build irregular polygon
    const sides = isPlate ? 6 + Math.floor(rng() * 3) : 4 + Math.floor(rng() * 3);
    const pts = [];
    for (let s = 0; s < sides; s++) {
      const sa = (s / sides) * Math.PI * 2;
      const jag = isPlate ? 0.55 + rng() * 0.45 : 0.6 + rng() * 0.4;
      // Stretch along one axis for plate-like shape
      const rx = baseR * stretch * jag;
      const ry = baseR * jag;
      const lx = Math.cos(sa) * rx;
      const ly = Math.sin(sa) * ry;
      // Rotate by tilt
      pts.push({
        x: dx + lx * Math.cos(tilt) - ly * Math.sin(tilt),
        y: dy + lx * Math.sin(tilt) + ly * Math.cos(tilt),
      });
    }

    // Fill with crust colour (blue-green surface tones for plates, brown for rubble)
    if (isPlate) {
      const pGrad = ctx.createRadialGradient(dx, dy, 0, dx, dy, baseR * stretch);
      pGrad.addColorStop(0, "rgba(145,175,165,0.9)");
      pGrad.addColorStop(0.6, "rgba(110,140,130,0.85)");
      pGrad.addColorStop(1, "rgba(70,90,80,0.75)");
      ctx.fillStyle = pGrad;
    } else {
      ctx.fillStyle = `rgba(${100 + Math.floor(rng() * 40)},${90 + Math.floor(rng() * 30)},${70 + Math.floor(rng() * 20)},0.8)`;
    }

    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let s = 1; s < pts.length; s++) ctx.lineTo(pts[s].x, pts[s].y);
    ctx.closePath();
    ctx.fill();

    // Dark edge on plates for depth
    if (isPlate) {
      ctx.strokeStyle = "rgba(40,50,45,0.5)";
      ctx.lineWidth = Math.max(0.5, r * 0.012);
      ctx.stroke();

      // Magma-lit inner edge (facing planet)
      const toPlanetX = cx - dx;
      const toPlanetY = cy - dy;
      const tpLen = Math.hypot(toPlanetX, toPlanetY) || 1;
      const glowX = dx + (toPlanetX / tpLen) * baseR * 0.3;
      const glowY = dy + (toPlanetY / tpLen) * baseR * 0.3;
      const eGrad = ctx.createRadialGradient(glowX, glowY, 0, glowX, glowY, baseR * 0.8);
      eGrad.addColorStop(0, "rgba(255,140,40,0.3)");
      eGrad.addColorStop(1, "transparent");
      ctx.fillStyle = eGrad;
      ctx.fill();
    }
  }
  ctx.restore();
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

/**
 * Draw a 90×90 px gas giant recipe preview for the picker modal.
 *
 * @param {HTMLCanvasElement} canvas
 * @param {object} recipe - Entry from GAS_GIANT_RECIPES
 */
export function drawGgRecipePreview(canvas, recipe) {
  drawGasGiantPreview(canvas, recipe.preview.styleId, {
    showRings: recipe.preview.rings,
  });
}
