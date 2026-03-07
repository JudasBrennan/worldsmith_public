// SPDX-License-Identifier: MPL-2.0
const G = 6.67e-11;
const SECONDS_TO_GYR = 3.171e-17;

/**
 * Love number k2 for a homogeneous elastic sphere (Munk & MacDonald 1960).
 * Shared by rocky planets, moons, and tidal-heating helpers.
 */
export function calcK2LoveNumber({ densityKgM3, gravityMs2, radiusM, rigidityPa = 30e9 }) {
  return 1.5 / (1 + (19 * rigidityPa) / (2 * densityKgM3 * gravityMs2 * radiusM));
}

export function k2LoveNumber(densityKgM3, gravityMs2, radiusM, rigidity = 30e9) {
  return calcK2LoveNumber({
    densityKgM3,
    gravityMs2,
    radiusM,
    rigidityPa: rigidity,
  });
}

/**
 * Wisdom (2004/2008) eccentricity function for synchronous-rotator tidal heating.
 * Replaces the simple e^2 truncation with a higher-order series.
 */
export function calcEccentricityFactor({ eccentricity }) {
  if (eccentricity === 0) return 0;
  const e2 = eccentricity * eccentricity;
  const na = 1 + 15.5 * e2 + 31.875 * e2 ** 2 + 11.5625 * e2 ** 3 + 0.390625 * e2 ** 4;
  return (na * e2) / (1 - e2) ** 7.5;
}

/**
 * Wisdom (2004/2008) eccentricity function for synchronous-rotator tidal heating.
 * Replaces the simple e^2 truncation with a higher-order series.
 */
export function eccentricityFactor(eccentricity) {
  return calcEccentricityFactor({ eccentricity });
}

/**
 * Goldreich & Peale (1966) spin-orbit resonance selection.
 * Higher eccentricity enables higher-order resonances.
 */
export function selectSpinOrbitResonance({ eccentricity }) {
  const h52 = (845 / 48) * eccentricity ** 3;
  const h21 = (17 / 2) * eccentricity ** 2;
  const h32 = (7 / 2) * eccentricity;
  if (h52 > 0.5) return { ratio: "5:2", p: 2.5 };
  if (h21 > 0.5) return { ratio: "2:1", p: 2.0 };
  if (h32 > 0.25) return { ratio: "3:2", p: 1.5 };
  return { ratio: "1:1", p: 1.0 };
}

/**
 * Goldreich & Peale (1966) spin-orbit resonance selection.
 * Higher eccentricity enables higher-order resonances.
 */
export function spinOrbitResonance(eccentricity) {
  return selectSpinOrbitResonance({ eccentricity });
}

export function calcTidalLockTimeSeconds({
  spinRateRadPerSec,
  orbitalSeparationM,
  momentOfInertiaKgM2,
  qualityFactor,
  otherMassKg,
  loveNumberK2,
  radiusM,
}) {
  return (
    (spinRateRadPerSec * orbitalSeparationM ** 6 * momentOfInertiaKgM2 * qualityFactor) /
    (3 * G * otherMassKg ** 2 * loveNumberK2 * radiusM ** 5)
  );
}

export function tidalLockTimeSeconds(
  spinRateRadPerSec,
  orbitalSeparationM,
  momentOfInertiaKgM2,
  qualityFactor,
  otherMassKg,
  loveNumberK2,
  radiusM,
) {
  return calcTidalLockTimeSeconds({
    spinRateRadPerSec,
    orbitalSeparationM,
    momentOfInertiaKgM2,
    qualityFactor,
    otherMassKg,
    loveNumberK2,
    radiusM,
  });
}

export function calcTidalLockTimeGyr({
  spinRateRadPerSec,
  orbitalSeparationM,
  momentOfInertiaKgM2,
  qualityFactor,
  otherMassKg,
  loveNumberK2,
  radiusM,
}) {
  return (
    calcTidalLockTimeSeconds({
      spinRateRadPerSec,
      orbitalSeparationM,
      momentOfInertiaKgM2,
      qualityFactor,
      otherMassKg,
      loveNumberK2,
      radiusM,
    }) * SECONDS_TO_GYR
  );
}

export function tidalLockTimeGyr(
  spinRateRadPerSec,
  orbitalSeparationM,
  momentOfInertiaKgM2,
  qualityFactor,
  otherMassKg,
  loveNumberK2,
  radiusM,
) {
  return calcTidalLockTimeGyr({
    spinRateRadPerSec,
    orbitalSeparationM,
    momentOfInertiaKgM2,
    qualityFactor,
    otherMassKg,
    loveNumberK2,
    radiusM,
  });
}
