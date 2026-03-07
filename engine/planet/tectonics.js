// SPDX-License-Identifier: MPL-2.0
const REGIMES = ["stagnant", "mobile", "episodic", "plutonicSquishy"];

function gauss(x, mu, sigma) {
  return Math.exp(-0.5 * ((x - mu) / sigma) ** 2);
}

export function tectonicAdvisory(massEarth, ageGyr, wmf, tidalFraction = 0) {
  const tidalNote =
    tidalFraction >= 5
      ? " Extreme moon tidal heating \u2014 expect global resurfacing and intense volcanism (Io-like)."
      : tidalFraction >= 1
        ? " Strong moon tidal heating \u2014 enhanced volcanism and possible resurfacing events."
        : tidalFraction >= 0.1
          ? " Moderate moon tidal heating \u2014 elevated volcanic activity likely."
          : "";
  if (massEarth < 0.3) {
    return "Low mass \u2014 likely stagnant lid (insufficient mantle convection)." + tidalNote;
  }
  if (wmf > 0.1) {
    return (
      "Water-dominated \u2014 tectonic regime uncertain; thick ice shell may inhibit surface tectonics." +
      tidalNote
    );
  }
  if (massEarth > 5 && ageGyr > 8) {
    return (
      "Massive and old \u2014 stagnant lid likely (thick lithosphere suppresses subduction)." +
      tidalNote
    );
  }
  if (massEarth > 3 && ageGyr > 6) {
    return "Higher mass and age favour stagnant or episodic lid." + tidalNote;
  }
  if (wmf > 0.001 && massEarth >= 0.5 && massEarth <= 3) {
    return (
      "Earth-like mass range with surface water \u2014 mobile lid (plate tectonics) is plausible." +
      tidalNote
    );
  }
  if (massEarth >= 0.5 && massEarth <= 3) {
    return (
      "Earth-like mass range \u2014 plate tectonics possible if water is present to weaken the lithosphere." +
      tidalNote
    );
  }
  return "Tectonic regime depends on mantle temperature, water content, and age." + tidalNote;
}

export function tectonicProbabilities(massEarth, ageGyr, wmf, cmf, tidalFraction) {
  const lnM = Math.log(Math.max(massEarth, 0.0001));

  const massFactor = {
    stagnant: gauss(lnM, Math.log(0.15), 0.8) + (massEarth > 4 ? (0.3 * (massEarth - 4)) / 6 : 0),
    mobile: gauss(lnM, Math.log(1.5), 0.5),
    episodic: gauss(lnM, Math.log(3.0), 0.7),
    plutonicSquishy: gauss(lnM, Math.log(0.8), 0.6),
  };

  const ageFactor = {
    stagnant: 1.0 + Math.max(0, (ageGyr - 5) / 5),
    mobile: gauss(ageGyr, 4, 3),
    episodic: gauss(ageGyr, 1.5, 2),
    plutonicSquishy: gauss(ageGyr, 1, 1.5),
  };

  const hasWater = wmf > 0.001 && wmf < 0.1;
  const waterFactor = {
    stagnant: wmf < 0.0001 ? 1.3 : wmf > 0.1 ? 1.2 : 0.8,
    mobile: hasWater ? 2.0 : wmf < 0.0001 ? 0.4 : 0.6,
    episodic: 1.0,
    plutonicSquishy: wmf > 0.1 ? 0.5 : 1.0,
  };

  const cmfFactor = {
    stagnant: 1.0 + Math.max(0, cmf - 0.4) * 2,
    mobile: 1.0 - Math.max(0, cmf - 0.4) * 1.5,
    episodic: 1.0,
    plutonicSquishy: 1.0 + Math.max(0, cmf - 0.5) * 0.5,
  };

  const tf = tidalFraction || 0;
  const tidalFac = {
    stagnant: 1.0 / (1 + tf),
    mobile: 1.0 + 0.3 * Math.min(tf, 2),
    episodic: 1.0 + 0.5 * Math.min(tf, 5),
    plutonicSquishy: 1.0 + 0.2 * Math.min(tf, 2),
  };

  const raw = {};
  for (const regime of REGIMES) {
    raw[regime] = Math.max(
      0.001,
      massFactor[regime] *
        ageFactor[regime] *
        waterFactor[regime] *
        cmfFactor[regime] *
        tidalFac[regime],
    );
  }

  const total = REGIMES.reduce((sum, regime) => sum + raw[regime], 0);
  const result = {};
  for (const regime of REGIMES) {
    result[regime] = Math.round((raw[regime] / total) * 1000) / 1000;
  }
  result.suggested = REGIMES.reduce(
    (best, regime) => (result[regime] > result[best] ? regime : best),
    REGIMES[0],
  );
  return result;
}
