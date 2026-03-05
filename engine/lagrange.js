// Lagrange point calculator
//
// Computes the five Lagrange points (L1–L5) for a two-body
// star–planet system.  L1/L2 use the Hill sphere approximation;
// L3 uses the restricted three-body mass-ratio correction;
// L4/L5 are the exact equilateral Trojan points at ±60°.
// L4/L5 stability: Gascheau (1843) criterion — stable only when
// μ = m/(m+M) < (1 − √69/9) / 2 ≈ 0.0385.

import { toFinite } from "./utils.js";

/** Gascheau critical mass parameter for L4/L5 stability. */
const MU_CRIT = (1 - Math.sqrt(69) / 9) / 2; // ≈ 0.03852

/**
 * @param {object} params
 * @param {number} params.bodyAu       Semi-major axis of the body (AU)
 * @param {number} params.bodyMass     Body mass (any consistent unit)
 * @param {number} params.starMass     Star mass (same unit as bodyMass)
 * @param {number} params.bodyAngleRad Current orbital angle (radians)
 */
export function calcLagrangePoints({ bodyAu, bodyMass, starMass, bodyAngleRad }) {
  const a = toFinite(bodyAu, 0);
  const mb = toFinite(bodyMass, 0);
  const ms = toFinite(starMass, 0);
  const angle = toFinite(bodyAngleRad, 0);

  if (a <= 0 || mb <= 0 || ms <= 0) return null;

  const massRatio = mb / ms;
  const hillAu = a * (massRatio / 3) ** (1 / 3);
  const mu = mb / (mb + ms);
  const l45Stable = mu < MU_CRIT;

  return {
    hill: { au: hillAu },
    stability: { mu, muCrit: MU_CRIT, l45Stable },
    points: {
      L1: { label: "L1", au: a - hillAu, angleRad: angle },
      L2: { label: "L2", au: a + hillAu, angleRad: angle },
      L3: {
        label: "L3",
        au: a * (1 + (5 / 12) * massRatio),
        angleRad: angle + Math.PI,
      },
      L4: { label: "L4", au: a, angleRad: angle + Math.PI / 3, stable: l45Stable },
      L5: { label: "L5", au: a, angleRad: angle - Math.PI / 3, stable: l45Stable },
    },
  };
}
