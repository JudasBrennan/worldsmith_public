function positiveNumberOrNull(value) {
  const num = Number(value);
  return Number.isFinite(num) && num > 0 ? num : null;
}

/**
 * Resolve the effective star-override inputs for engine composition. This
 * mirrors the app's advanced star derivation rules without importing UI/store
 * helpers into the engine layer.
 *
 * @param {object} world
 * @returns {object}
 */
export function resolveWorldStarConfig(world) {
  const star = world?.star || {};
  const physicsMode = star?.physicsMode === "advanced" ? "advanced" : "simple";
  const advancedDerivationMode = ["rl", "rt", "lt"].includes(star?.advancedDerivationMode)
    ? star.advancedDerivationMode
    : "rl";

  let radiusRsolOverride = null;
  let luminosityLsolOverride = null;
  let tempKOverride = null;

  if (physicsMode === "advanced") {
    const radiusOverride = positiveNumberOrNull(star?.radiusRsolOverride);
    const luminosityOverride = positiveNumberOrNull(star?.luminosityLsolOverride);
    const tempOverride = positiveNumberOrNull(star?.tempKOverride);

    if (advancedDerivationMode === "rt") {
      radiusRsolOverride = radiusOverride;
      tempKOverride = tempOverride;
    } else if (advancedDerivationMode === "lt") {
      luminosityLsolOverride = luminosityOverride;
      tempKOverride = tempOverride;
    } else {
      radiusRsolOverride = radiusOverride;
      luminosityLsolOverride = luminosityOverride;
    }
  }

  return {
    massMsol: Number(star.massMsol ?? 1),
    ageGyr: Number(star.ageGyr ?? 4.6),
    metallicityFeH: Number(star.metallicityFeH ?? 0),
    radiusRsolOverride,
    luminosityLsolOverride,
    tempKOverride,
    evolutionMode: star.evolutionMode,
    physicsMode,
    advancedDerivationMode,
  };
}
