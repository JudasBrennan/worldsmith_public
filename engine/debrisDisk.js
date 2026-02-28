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
const AU_M = 1.496e11;
const KG_PER_MEARTH = 5.972e24;
const YEAR_S = 3.1557e7;
const FEH_MIN = -3;
const FEH_MAX = 1;
const REFRACTORY_FEH_EXP = 0.25;
const VOLATILE_FEH_EXP = -0.1;

/* ── Condensation sequence (Lodders 2003, solar composition) ─────── */

const CONDENSATION_TABLE = [
  { name: "Corundum", condensK: 1700, massFraction: 0.004, ice: false },
  { name: "Iron-nickel", condensK: 1450, massFraction: 0.07, ice: false },
  { name: "Enstatite", condensK: 1350, massFraction: 0.12, ice: false },
  { name: "Forsterite", condensK: 1300, massFraction: 0.14, ice: false },
  { name: "Feldspar", condensK: 1200, massFraction: 0.06, ice: false },
  { name: "Troilite (FeS)", condensK: 700, massFraction: 0.04, ice: false },
  { name: "Organics", condensK: 300, massFraction: 0.06, ice: false },
  { name: "Water ice", condensK: 170, massFraction: 0.33, ice: true },
  { name: "NH\u2083 hydrate", condensK: 130, massFraction: 0.02, ice: true },
  { name: "CO\u2082 ice", condensK: 70, massFraction: 0.05, ice: true },
  { name: "CH\u2084 ice", condensK: 31, massFraction: 0.04, ice: true },
  { name: "CO ice", condensK: 25, massFraction: 0.03, ice: true },
  { name: "N\u2082 ice", condensK: 22, massFraction: 0.02, ice: true },
];

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
      const auInner = Number(gInner.au);
      const auOuter = Number(gOuter.au);
      const gapInner = auInner * RES_2_1;
      const gapOuter = auOuter * RES_1_2;
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
          sculptorAu: (auInner + auOuter) / 2,
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

function classifyComposition(tempInnerK, tempMidK, tempOuterK, starMetallicityFeH = 0) {
  const tIn = toFinite(tempInnerK, 300);
  const tMid = toFinite(tempMidK, 100);
  const tOut = toFinite(tempOuterK, 50);
  const feH = clamp(toFinite(starMetallicityFeH, 0), FEH_MIN, FEH_MAX);
  const refractoryScale = 10 ** (REFRACTORY_FEH_EXP * feH);
  const volatileScale = 10 ** (VOLATILE_FEH_EXP * feH);

  // Per-species presence at inner/mid/outer edges
  const species = CONDENSATION_TABLE.map((s) => ({
    name: s.name,
    condensationK: s.condensK,
    massFraction: s.massFraction,
    weightedMassFraction: s.massFraction * (s.ice ? volatileScale : refractoryScale),
    ice: s.ice,
    presentAtInner: tIn <= s.condensK,
    presentAtMid: tMid <= s.condensK,
    presentAtOuter: tOut <= s.condensK,
  }));

  // Ice-to-rock ratio and dominant species at midpoint (single pass)
  let iceSum = 0;
  let rockSum = 0;
  const presentAtMid = [];
  for (const s of species) {
    if (s.presentAtMid) {
      if (s.ice) iceSum += s.weightedMassFraction;
      else rockSum += s.weightedMassFraction;
      presentAtMid.push(s);
    }
  }
  const iceToRockRatio = rockSum > 0 ? iceSum / rockSum : iceSum > 0 ? Infinity : 0;
  const dominantByMass = presentAtMid.sort(
    (a, b) => b.weightedMassFraction - a.weightedMassFraction,
  );

  // Backward-compatible 4-class labels
  let className, dominantMaterials;
  if (tMid > 300) {
    className = "Silicate-dominated";
    dominantMaterials = dominantByMass.slice(0, 3).map((s) => s.name);
  } else if (tMid > 150) {
    className = "Mixed silicate-ice";
    dominantMaterials = dominantByMass.slice(0, 3).map((s) => s.name);
  } else if (tMid > 40) {
    className = "Ice-dominated";
    dominantMaterials = dominantByMass.slice(0, 3).map((s) => s.name);
  } else {
    className = "Volatile-rich";
    dominantMaterials = dominantByMass.slice(0, 4).map((s) => s.name);
  }

  return {
    className,
    dominantMaterials,
    species,
    iceToRockRatio,
    dominantByMass,
    metallicityFeH: round(feH, 2),
    refractoryScale: round(refractoryScale, 3),
    volatileScale: round(volatileScale, 3),
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
 * @param {number} [params.eccentricity]      Disk eccentricity (0–0.5)
 * @param {number} [params.inclination]       Disk inclination (°)
 * @param {number} [params.totalMassMearth]   Total mass override (M⊕)
 * @param {Array}  [params.gasGiants]         Gas giants [{name, au, massMjup}]
 * @param {number} [params.starTeffK]         Star effective temperature (K)
 * @param {number} [params.starMetallicityFeH] Host-star metallicity [Fe/H] (dex)
 * @returns {object} Comprehensive debris disk model
 */
export function calcDebrisDisk({
  innerAu,
  outerAu,
  starMassMsol,
  starLuminosityLsol,
  starAgeGyr,
  eccentricity,
  inclination,
  totalMassMearth,
  gasGiants,
  starTeffK,
  starMetallicityFeH,
}) {
  const rIn = clamp(toFinite(innerAu, 2), 0.01, 1e6);
  const rOut = Math.max(rIn + 0.01, clamp(toFinite(outerAu, 5), 0.01, 1e6));
  const sMass = clamp(toFinite(starMassMsol, 1), 0.075, 100);
  const sLum = Math.max(0.0001, toFinite(starLuminosityLsol, 1));
  const sAge = clamp(toFinite(starAgeGyr, 4.6), 0.001, 20);
  const ecc = clamp(toFinite(eccentricity, 0.05), 0, 0.5);
  const inc = clamp(toFinite(inclination, 0), 0, 90);
  const userMass =
    totalMassMearth != null && Number.isFinite(Number(totalMassMearth)) && totalMassMearth > 0
      ? Number(totalMassMearth)
      : null;
  const teff = toFinite(starTeffK, 0);
  const starFeH = clamp(toFinite(starMetallicityFeH, 0), FEH_MIN, FEH_MAX);
  const giants = Array.isArray(gasGiants) ? gasGiants : [];

  const midAu = (rIn + rOut) / 2;
  const widthAu = rOut - rIn;
  const drOverR = widthAu / midAu;

  /* ── Dust temperature (blackbody equilibrium) ──────────────────── */

  const sqrtLum279 = 279 * Math.sqrt(sLum);
  const tempInnerK = sqrtLum279 / Math.sqrt(rIn);
  const tempOuterK = sqrtLum279 / Math.sqrt(rOut);
  const tempMidK = sqrtLum279 / Math.sqrt(midAu);

  /* ── Pericenter / Apocenter ────────────────────────────────────── */

  const periAu = midAu * (1 - ecc);
  const apoAu = midAu * (1 + ecc);
  const tempPeriK = sqrtLum279 / Math.sqrt(periAu);
  const tempApoK = sqrtLum279 / Math.sqrt(apoAu);

  /* ── Composition (condensation sequence) ───────────────────────── */

  const composition = classifyComposition(tempInnerK, tempMidK, tempOuterK, starFeH);

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
  let fractionalLuminosity = Math.min(fMax, 0.01); // physical cap

  /* ── Optical depth ─────────────────────────────────────────────── */

  let tau = (2 * fractionalLuminosity) / drOverR;

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
  let collisionalYears = tau > 0 ? orbitalPeriodYears / (4 * Math.PI * tau) : Infinity;
  const dominantProcess =
    collisionalYears < prDragYears ? "Collision-dominated" : "PR-drag-dominated";

  /* ── Estimated mass (Dohnanyi cascade or user override) ────────── */

  const sMaxM = 1e5; // 100 km in metres
  const sMinM = Math.max(blowoutSizeUm * 1e-6, 1e-7);
  let massKg, massEarth, massSource;
  if (userMass !== null) {
    // User override: reverse-derive optical depth from mass
    massEarth = userMass;
    massKg = userMass * KG_PER_MEARTH;
    const crossSection = massKg / ((4 / 3) * SILICATE_DENSITY_KGM3 * Math.sqrt(sMaxM * sMinM));
    const diskArea = 2 * Math.PI * midAu * AU_M * widthAu * AU_M;
    tau = Math.min(crossSection / diskArea, 1);
    fractionalLuminosity = (tau * drOverR) / 2;
    collisionalYears = tau > 0 ? orbitalPeriodYears / (4 * Math.PI * tau) : Infinity;
    massSource = "User override";
  } else {
    const crossSection = tau * 2 * Math.PI * midAu * AU_M * widthAu * AU_M;
    massKg = crossSection * (4 / 3) * SILICATE_DENSITY_KGM3 * Math.sqrt(sMaxM * sMinM);
    massEarth = massKg / KG_PER_MEARTH;
    massSource = "Wyatt steady-state";
  }

  /* ── Collision velocity ────────────────────────────────────────── */

  const vKeplerKms = (29.78 * Math.sqrt(sMass)) / Math.sqrt(midAu);
  const collisionVelocityKms = ecc * vKeplerKms * Math.SQRT2;
  const collisionVelocityMs = collisionVelocityKms * 1000;
  let collisionRegime;
  if (collisionVelocityMs < 10) collisionRegime = "Gentle (accretionary)";
  else if (collisionVelocityMs < 100) collisionRegime = "Erosive";
  else collisionRegime = "Catastrophic";

  /* ── Dust production rate ──────────────────────────────────────── */

  const dustProductionKgPerYr =
    Number.isFinite(collisionalYears) && collisionalYears > 0 ? massKg / collisionalYears : 0;
  const dustProductionKgPerS = dustProductionKgPerYr / YEAR_S;

  /* ── Surface density ───────────────────────────────────────────── */

  const diskAreaM2 = Math.PI * (rOut ** 2 - rIn ** 2) * AU_M ** 2;
  const surfaceDensityGcm2 = diskAreaM2 > 0 ? (massKg * 1000) / (diskAreaM2 * 1e4) : 0;
  // MMSN comparison: Σ_MMSN ≈ 7 × (r/AU)^(-1.5)  at midpoint
  const mmsnGcm2 = 7 * midAu ** -1.5;
  const surfaceDensityRatioMMSN = mmsnGcm2 > 0 ? surfaceDensityGcm2 / mmsnGcm2 : 0;

  /* ── IR excess (detectability at 24 μm) ────────────────────────── */

  let irExcess, irExcessLabel;
  if (teff > 0) {
    // Planck function ratio at 24 μm
    const lambda = 24e-6; // metres
    const hckT_disk = 0.014388 / (lambda * tempMidK); // hc/(λkT)
    const hckT_star = 0.014388 / (lambda * teff);
    const bDisk = 1 / (Math.exp(hckT_disk) - 1);
    const bStar = 1 / (Math.exp(hckT_star) - 1);
    irExcess = fractionalLuminosity * (bDisk / bStar);
    if (irExcess > 0.1) irExcessLabel = "Easily detected";
    else if (irExcess > 0.01) irExcessLabel = "Marginal";
    else irExcessLabel = "Below threshold";
  } else {
    irExcess = null;
    irExcessLabel = "Star Teff unavailable";
  }

  /* ── Zodiacal dust delivery (PR drag inflow) ───────────────────── */

  const smallGrainFraction = Math.sqrt(sMinM / sMaxM);
  const prInflowKgPerYr = (massKg * smallGrainFraction) / prDragYears;
  let zodiacalLabel;
  if (prInflowKgPerYr > 1e8) zodiacalLabel = "Heavy";
  else if (prInflowKgPerYr > 1e5) zodiacalLabel = "Moderate";
  else if (prInflowKgPerYr > 100) zodiacalLabel = "Faint";
  else zodiacalLabel = "Negligible";

  /* ── Dynamical stability (chaotic zone check) ──────────────────── */

  const overlappingGiants = [];
  for (const g of giants) {
    const gAu = toFinite(g.au, 0);
    const gMassMjup = toFinite(g.massMjup, 1);
    if (gAu <= 0) continue;
    const massRatio = (gMassMjup * 9.547e-4) / sMass; // Mjup → Msol
    const halfWidth = 1.3 * gAu * massRatio ** (2 / 7);
    const zoneInner = gAu - halfWidth;
    const zoneOuter = gAu + halfWidth;
    if (zoneInner < rOut && zoneOuter > rIn) {
      overlappingGiants.push({
        name: g.name || "Giant",
        au: gAu,
        zoneInnerAu: round(zoneInner, 2),
        zoneOuterAu: round(zoneOuter, 2),
      });
    }
  }
  const isStable = overlappingGiants.length === 0;

  /* ── Classification ────────────────────────────────────────────── */

  const classification = classifyDisk(tempMidK, midAu, frostLineAu);

  /* ── Display helpers ───────────────────────────────────────────── */

  function fmtTime(years) {
    if (!Number.isFinite(years)) return "\u221E";
    if (years > 1e9) return `${fmt(years / 1e9, 1)} Gyr`;
    if (years > 1e6) return `${fmt(years / 1e6, 1)} Myr`;
    if (years > 1000) return `${fmt(years / 1000, 1)} kyr`;
    return `${fmt(years, 0)} yr`;
  }

  /* ── Assemble output ───────────────────────────────────────────── */

  return {
    inputs: {
      innerAu: rIn,
      outerAu: rOut,
      eccentricity: ecc,
      inclination: inc,
      totalMassMearth: userMass,
      starMetallicityFeH: round(starFeH, 2),
    },

    placement: {
      relativeToFrostLine,
      frostLineAu: round(frostLineAu, 2),
    },

    temperature: {
      innerK: round(tempInnerK, 1),
      outerK: round(tempOuterK, 1),
      midK: round(tempMidK, 1),
      periK: round(tempPeriK, 1),
      apoK: round(tempApoK, 1),
    },

    composition,

    luminosity: {
      fractionalLuminosity,
      opticalDepth: tau,
    },

    mass: {
      estimatedMassEarth: massEarth,
      estimatedMassKg: massKg,
      source: massSource,
    },

    grains: {
      blowoutSizeUm: round(blowoutSizeUm, 3),
      typicalSizeUm: round(typicalSizeUm, 2),
    },

    timescales: {
      prDragYears: round(prDragYears, 0),
      collisionalYears: Number.isFinite(collisionalYears) ? round(collisionalYears, 0) : Infinity,
      dominantProcess,
      dustProductionKgPerYr,
      dustProductionKgPerS,
    },

    collision: {
      velocityKms: round(collisionVelocityKms, 3),
      velocityMs: round(collisionVelocityMs, 1),
      regime: collisionRegime,
      keplerVelocityKms: round(vKeplerKms, 2),
    },

    surfaceDensity: {
      gcm2: surfaceDensityGcm2,
      ratioMMSN: surfaceDensityRatioMMSN,
    },

    irExcess: {
      value: irExcess,
      label: irExcessLabel,
    },

    zodiacal: {
      prInflowKgPerYr,
      smallGrainFraction,
      label: zodiacalLabel,
    },

    stability: {
      isStable,
      overlappingGiants,
    },

    classification,

    orbital: {
      midpointAu: round(midAu, 2),
      widthAu: round(widthAu, 2),
      periAu: round(periAu, 2),
      apoAu: round(apoAu, 2),
      orbitalPeriodYears: round(orbitalPeriodYears, 2),
    },

    display: {
      range: `${fmt(rIn, 2)}\u2013${fmt(rOut, 2)} AU`,
      temperature: `${fmt(tempInnerK, 0)}\u2013${fmt(tempOuterK, 0)} K`,
      composition: composition.className,
      frostLine: relativeToFrostLine,
      luminosity:
        fractionalLuminosity < 1e-4
          ? fractionalLuminosity.toExponential(2)
          : fmt(fractionalLuminosity, 6),
      opticalDepth: tau < 1e-4 ? tau.toExponential(2) : fmt(tau, 6),
      mass: massEarth < 0.001 ? massEarth.toExponential(2) : fmt(massEarth, 4),
      massSource,
      blowout: `${fmt(blowoutSizeUm, 2)} \u03BCm`,
      prDrag: fmtTime(prDragYears),
      collisional: fmtTime(collisionalYears),
      dominantProcess,
      classification: classification.label,
      orbitalPeriod: `${fmt(orbitalPeriodYears, 1)} yr`,
      collisionVelocity: `${fmt(collisionVelocityKms, 2)} km/s`,
      collisionRegime,
      surfaceDensity:
        surfaceDensityGcm2 < 1e-4
          ? surfaceDensityGcm2.toExponential(2)
          : fmt(surfaceDensityGcm2, 4),
      surfaceDensityVsMMSN: `${fmt(surfaceDensityRatioMMSN * 100, 1)}% of MMSN`,
      irExcess:
        irExcess != null ? (irExcess < 1e-4 ? irExcess.toExponential(2) : fmt(irExcess, 4)) : "N/A",
      irExcessLabel,
      dustProduction:
        fmtTime(collisionalYears) !== "\u221E"
          ? `${dustProductionKgPerYr.toExponential(2)} kg/yr`
          : "N/A",
      zodiacalLabel,
      zodiacalInflow: `${prInflowKgPerYr.toExponential(2)} kg/yr`,
      stability: isStable
        ? "Stable"
        : `Unstable (${overlappingGiants.map((g) => g.name).join(", ")})`,
      periApo: ecc > 0 ? `${fmt(periAu, 2)}\u2013${fmt(apoAu, 2)} AU` : "Circular",
      iceToRock: Number.isFinite(composition.iceToRockRatio)
        ? fmt(composition.iceToRockRatio, 2)
        : composition.iceToRockRatio === Infinity
          ? "Ice only"
          : "Rock only",
    },
  };
}
