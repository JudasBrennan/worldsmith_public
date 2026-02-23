// Debris Disk physics engine
//
// Computes debris disk properties from orbital boundaries, host-star
// parameters, and gas giant positions.  Also provides resonance-based
// auto-suggestion of disk locations from gas giant positions.
//
// Key references:
//   Wyatt et al. 2007  — maximum fractional luminosity vs age
//   Dohnanyi 1969      — collisional cascade size distribution (q = 3.5)
//   Burns, Lamy & Soter 1979 — Poynting-Robertson drag
//   Kepler's 3rd law   — mean-motion resonance (MMR) positions
//
// Mean-motion resonance placement (a_res = a_planet × (p/q)^(2/3)):
//
//   Priority 1 — Primary outer belt:  outermost giant's 3:2→2:1 exterior MMR
//   Priority 2 — Primary inner belt:  innermost giant's 4:1→2:1 interior MMR
//   Priority 3 — Inter-giant gaps:    adjacent pair 2:1 ext → 2:1 int (if stable)
//   Priority 4 — Extended outer belt: outermost giant's 2:1→5:2 exterior MMR
//   Priority 5 — Warm inner belt:     innermost giant's 8:1→4:1 interior MMR
//
//   Frost-line fallback (0 giants):
//     Outer belt: 6–10 × frost line
//     Inner belt: 0.4–0.7 × frost line
//     Mid belt:   1.5–3 × frost line
//
//   Verification with Solar System:
//     Kuiper belt: Neptune @ 30.05 → 39.4–47.7 AU  ✓
//     Asteroid belt: Jupiter @ 5.2 → 2.06–3.28 AU  ✓

import { clamp, toFinite, round, fmt } from "./utils.js";

/* ── Constants ───────────────────────────────────────────────────── */

const RES_3_2 = (3 / 2) ** (2 / 3); // ~1.3104
const RES_2_1 = (2 / 1) ** (2 / 3); // ~1.5874
const RES_5_2 = (5 / 2) ** (2 / 3); // ~1.8420
const RES_1_2 = (1 / 2) ** (2 / 3); // ~0.6300
const RES_1_4 = (1 / 4) ** (2 / 3); // ~0.3969
const RES_1_8 = (1 / 8) ** (2 / 3); // ~0.2500

const SILICATE_DENSITY_KGM3 = 2500; // typical grain density

/* ── Resonance-based suggestions ─────────────────────────────────── */

/**
 * Compute auto-suggested debris disk locations from gas giant positions,
 * or from the frost line when no gas giants are present.
 *
 * Returns a priority-ranked list of all viable zones. Use the optional
 * `count` parameter to limit the number of results.
 *
 * @param {object} params
 * @param {Array<{name:string, au:number}>} params.gasGiants  Gas giant list
 * @param {number} [params.starLuminosityLsol=1]  Host star luminosity (for frost-line fallback)
 * @param {number} [params.count]  Max zones to return (omit for all)
 * @returns {Array<{innerAu, outerAu, resonanceInner, resonanceOuter,
 *                  sculptorName, sculptorAu, label, priority}>}
 */
export function calcDebrisDiskSuggestions({ gasGiants, starLuminosityLsol, count }) {
  const sLum = Math.max(0.0001, toFinite(starLuminosityLsol, 1));

  const sorted = (Array.isArray(gasGiants) ? [...gasGiants] : [])
    .filter((g) => Number.isFinite(Number(g.au)) && Number(g.au) > 0)
    .sort((a, b) => Number(a.au) - Number(b.au));

  const suggestions = [];

  if (sorted.length === 0) {
    // Frost-line fallback — no gas giants
    const frost = 4.85 * Math.sqrt(sLum);
    suggestions.push({
      innerAu: round(frost * 6, 2),
      outerAu: round(frost * 10, 2),
      resonanceInner: null,
      resonanceOuter: null,
      sculptorName: null,
      sculptorAu: null,
      label: "Outer disk",
      priority: 1,
    });
    suggestions.push({
      innerAu: round(frost * 0.4, 2),
      outerAu: round(frost * 0.7, 2),
      resonanceInner: null,
      resonanceOuter: null,
      sculptorName: null,
      sculptorAu: null,
      label: "Inner disk",
      priority: 2,
    });
    suggestions.push({
      innerAu: round(frost * 1.5, 2),
      outerAu: round(frost * 3, 2),
      resonanceInner: null,
      resonanceOuter: null,
      sculptorName: null,
      sculptorAu: null,
      label: "Mid disk",
      priority: 3,
    });
  } else {
    const outermost = sorted[sorted.length - 1];
    const innermost = sorted[0];
    const outerAu = Number(outermost.au);
    const innerAu = Number(innermost.au);

    // P1 — Primary outer belt: outermost giant's 3:2 → 2:1 exterior MMR
    suggestions.push({
      innerAu: round(outerAu * RES_3_2, 2),
      outerAu: round(outerAu * RES_2_1, 2),
      resonanceInner: "3:2",
      resonanceOuter: "2:1",
      sculptorName: outermost.name || "Outermost giant",
      sculptorAu: outerAu,
      label: "Outer disk",
      priority: 1,
    });

    // P2 — Primary inner belt: innermost giant's 4:1 → 2:1 interior MMR
    suggestions.push({
      innerAu: round(innerAu * RES_1_4, 2),
      outerAu: round(innerAu * RES_1_2, 2),
      resonanceInner: "4:1",
      resonanceOuter: "2:1",
      sculptorName: innermost.name || "Innermost giant",
      sculptorAu: innerAu,
      label: "Inner disk",
      priority: 2,
    });

    // P3 — Inter-giant gaps: for each adjacent pair, gap between
    //       inner giant's 2:1 exterior and outer giant's 2:1 interior
    for (let i = 0; i < sorted.length - 1; i++) {
      const gInner = sorted[i];
      const gOuter = sorted[i + 1];
      const gapInner = Number(gInner.au) * RES_2_1;
      const gapOuter = Number(gOuter.au) * RES_1_2;
      if (gapOuter > gapInner * 1.05) {
        // Gap is at least 5% wider than its inner edge — viable zone
        const nameA = gInner.name || `Giant ${i + 1}`;
        const nameB = gOuter.name || `Giant ${i + 2}`;
        suggestions.push({
          innerAu: round(gapInner, 2),
          outerAu: round(gapOuter, 2),
          resonanceInner: "2:1 ext",
          resonanceOuter: "2:1 int",
          sculptorName: `${nameA}–${nameB}`,
          sculptorAu: (Number(gInner.au) + Number(gOuter.au)) / 2,
          label: `Gap disk (${nameA}–${nameB})`,
          priority: 3,
        });
      }
    }

    // P4 — Extended outer belt: outermost giant's 2:1 → 5:2 exterior MMR
    suggestions.push({
      innerAu: round(outerAu * RES_2_1, 2),
      outerAu: round(outerAu * RES_5_2, 2),
      resonanceInner: "2:1",
      resonanceOuter: "5:2",
      sculptorName: outermost.name || "Outermost giant",
      sculptorAu: outerAu,
      label: "Extended outer disk",
      priority: 4,
    });

    // P5 — Warm inner belt: innermost giant's 8:1 → 4:1 interior MMR
    suggestions.push({
      innerAu: round(innerAu * RES_1_8, 2),
      outerAu: round(innerAu * RES_1_4, 2),
      resonanceInner: "8:1",
      resonanceOuter: "4:1",
      sculptorName: innermost.name || "Innermost giant",
      sculptorAu: innerAu,
      label: "Warm inner disk",
      priority: 5,
    });
  }

  suggestions.sort((a, b) => a.priority - b.priority);

  // Mark zones that overlap or touch a higher-priority (already accepted) zone
  const accepted = [];
  for (const zone of suggestions) {
    const overlaps = accepted.some((a) => zone.innerAu <= a.outerAu && a.innerAu <= zone.outerAu);
    zone.recommended = !overlaps;
    if (!overlaps) accepted.push(zone);
  }

  const n = toFinite(count, 0);
  return n > 0 ? suggestions.slice(0, n) : suggestions;
}

/* ── Composition classification ──────────────────────────────────── */

function classifyComposition(tempMidK) {
  const t = toFinite(tempMidK, 100);
  if (t > 300)
    return {
      className: "Silicate-dominated",
      dominantMaterials: ["Silicates", "Metals", "Carbon grains"],
    };
  if (t > 150)
    return {
      className: "Mixed silicate-ice",
      dominantMaterials: ["Silicates", "Water ice", "Organics"],
    };
  if (t > 40)
    return {
      className: "Ice-dominated",
      dominantMaterials: ["Water ice", "Organics", "Tholins"],
    };
  return {
    className: "Volatile-rich",
    dominantMaterials: ["Water ice", "CO ice", "N₂ ice", "CH₄ ice"],
  };
}

/* ── Debris disk classification label ────────────────────────────── */

function classifyDisk(tempMidK, midAu, frostLineAu) {
  if (midAu < 1) return { label: "Warm exozodiacal dust", description: "Hot dust near the star" };
  if (midAu < frostLineAu * 0.8)
    return {
      label: "Asteroid belt analog",
      description: "Rocky debris inside the frost line",
    };
  if (midAu < frostLineAu * 15)
    return {
      label: "Kuiper belt analog",
      description: "Icy debris beyond the frost line",
    };
  return { label: "Extended halo", description: "Distant cold debris" };
}

/* ── Main debris disk calculator ─────────────────────────────────── */

/**
 * Calculate comprehensive debris disk properties.
 *
 * @param {object} params
 * @param {number} params.innerAu       Inner edge (AU)
 * @param {number} params.outerAu       Outer edge (AU)
 * @param {number} params.starMassMsol  Host star mass (M☉)
 * @param {number} params.starLuminosityLsol  Host star luminosity (L☉)
 * @param {number} params.starAgeGyr    System age (Gyr)
 * @returns {object} Comprehensive debris disk model
 */
export function calcDebrisDisk({ innerAu, outerAu, starMassMsol, starLuminosityLsol, starAgeGyr }) {
  const rIn = clamp(toFinite(innerAu, 2), 0.01, 1e6);
  const rOut = Math.max(rIn + 0.01, clamp(toFinite(outerAu, 5), 0.01, 1e6));
  const sMass = clamp(toFinite(starMassMsol, 1), 0.075, 100);
  const sLum = Math.max(0.0001, toFinite(starLuminosityLsol, 1));
  const sAge = clamp(toFinite(starAgeGyr, 4.6), 0.001, 20);

  const midAu = (rIn + rOut) / 2;
  const widthAu = rOut - rIn;
  const drOverR = widthAu / midAu;

  /* ── Dust temperature (blackbody equilibrium) ──────────────────── */

  const tempInnerK = (279 * Math.sqrt(sLum)) / Math.sqrt(rIn);
  const tempOuterK = (279 * Math.sqrt(sLum)) / Math.sqrt(rOut);
  const tempMidK = (279 * Math.sqrt(sLum)) / Math.sqrt(midAu);

  /* ── Composition ───────────────────────────────────────────────── */

  const composition = classifyComposition(tempMidK);

  /* ── Frost line comparison ─────────────────────────────────────── */

  const frostLineAu = 4.85 * Math.sqrt(sLum);
  let relativeToFrostLine;
  if (rOut < frostLineAu) relativeToFrostLine = "Inside";
  else if (rIn > frostLineAu) relativeToFrostLine = "Outside";
  else relativeToFrostLine = "Straddles";

  /* ── Fractional luminosity (Wyatt et al. 2007 maximum) ─────────── */

  // f_max = 2.4e-8 × (r_mid/AU)^(7/3) × (dr/r) × (t_age/Gyr)^(-1)
  // Simplified form assuming D_max = 60 km, Q*_D = 300 J/kg, e = 0.1
  const fMax = 2.4e-8 * midAu ** (7 / 3) * drOverR * (1 / sAge);
  const fractionalLuminosity = Math.min(fMax, 0.01); // physical cap

  /* ── Optical depth ─────────────────────────────────────────────── */

  const tau = (2 * fractionalLuminosity) / drOverR;

  /* ── Blowout grain size (radiation pressure limit) ─────────────── */

  // s_blow = 3·L·Q_pr / (8π·G·M·c·ρ_grain)
  // Simplified: s_blow_μm ≈ 0.57 × (L/L☉) / (M/M☉) for silicates
  const blowoutSizeUm = 0.57 * (sLum / sMass);
  const typicalSizeUm = blowoutSizeUm * 10; // typical surviving grain

  /* ── Poynting-Robertson drag timescale ──────────────────────────── */

  // t_PR ≈ 700 × s_μm × R_AU² / L_☉  (years)
  const prDragYears = (700 * typicalSizeUm * midAu ** 2) / sLum;

  /* ── Collisional lifetime ──────────────────────────────────────── */

  const orbitalPeriodYears = Math.sqrt(midAu ** 3 / sMass);
  const collisionalYears = tau > 0 ? orbitalPeriodYears / (4 * Math.PI * tau) : Infinity;
  const dominantProcess =
    collisionalYears < prDragYears ? "Collision-dominated" : "PR-drag-dominated";

  /* ── Estimated mass ────────────────────────────────────────────── */

  // From optical depth and Dohnanyi (1969) collisional cascade (q = 3.5):
  //   Cross-section: σ ≈ 2πC × s_min^{-0.5}
  //   Mass:          M ≈ (8π/3) ρC × s_max^{0.5}
  // Eliminating C:  M = (4/3) × ρ × σ × √(s_max × s_min)
  //
  // s_max = 100 km (largest planetesimal in cascade)
  // s_min = blowout grain size (radiation pressure limit)
  // This gives the Wyatt (2007) steady-state maximum mass for a disk
  // of this age and location.
  const sMaxM = 1e5; // 100 km in metres
  const sMinM = Math.max(blowoutSizeUm * 1e-6, 1e-7);
  const crossSection = tau * 2 * Math.PI * midAu * 1.496e11 * widthAu * 1.496e11; // m²
  const massKg = crossSection * (4 / 3) * SILICATE_DENSITY_KGM3 * Math.sqrt(sMaxM * sMinM);
  const massEarth = massKg / 5.972e24;

  /* ── Classification ────────────────────────────────────────────── */

  const classification = classifyDisk(tempMidK, midAu, frostLineAu);

  /* ── Assemble output ───────────────────────────────────────────── */

  return {
    inputs: { innerAu: rIn, outerAu: rOut },

    placement: {
      relativeToFrostLine,
      frostLineAu: round(frostLineAu, 2),
    },

    temperature: {
      innerK: round(tempInnerK, 1),
      outerK: round(tempOuterK, 1),
      midK: round(tempMidK, 1),
    },

    composition,

    luminosity: {
      fractionalLuminosity: fractionalLuminosity,
      opticalDepth: tau,
    },

    mass: {
      estimatedMassEarth: massEarth,
      estimatedMassKg: massKg,
    },

    grains: {
      blowoutSizeUm: round(blowoutSizeUm, 3),
      typicalSizeUm: round(typicalSizeUm, 2),
    },

    timescales: {
      prDragYears: round(prDragYears, 0),
      collisionalYears: Number.isFinite(collisionalYears) ? round(collisionalYears, 0) : Infinity,
      dominantProcess,
    },

    classification,

    orbital: {
      midpointAu: round(midAu, 2),
      widthAu: round(widthAu, 2),
      orbitalPeriodYears: round(orbitalPeriodYears, 2),
    },

    display: {
      range: `${fmt(rIn, 2)}–${fmt(rOut, 2)} AU`,
      temperature: `${fmt(tempInnerK, 0)}–${fmt(tempOuterK, 0)} K`,
      composition: composition.className,
      frostLine: relativeToFrostLine,
      luminosity:
        fractionalLuminosity < 1e-4
          ? fractionalLuminosity.toExponential(2)
          : fmt(fractionalLuminosity, 6),
      opticalDepth: tau < 1e-4 ? tau.toExponential(2) : fmt(tau, 6),
      mass: massEarth < 0.001 ? massEarth.toExponential(2) : fmt(massEarth, 4),
      blowout: `${fmt(blowoutSizeUm, 2)} μm`,
      prDrag: prDragYears > 1e6 ? `${fmt(prDragYears / 1e6, 1)} Myr` : `${fmt(prDragYears, 0)} yr`,
      collisional: Number.isFinite(collisionalYears)
        ? collisionalYears > 1e6
          ? `${fmt(collisionalYears / 1e6, 1)} Myr`
          : `${fmt(collisionalYears, 0)} yr`
        : "∞",
      dominantProcess,
      classification: classification.label,
      orbitalPeriod: `${fmt(orbitalPeriodYears, 1)} yr`,
    },
  };
}
