import { evaluateVolatileRetention } from "../physics/escape.js";
import { jeansParameter, MOON_VOLATILE_TABLE, vaporPressurePa } from "../utils.js";

const EARTH_SURFACE_FIELD_GAUSS = 0.31;
const KM_PER_REARTH = 6371;
const EUROPA_K = 3.97e9;

export function analyseMoonVolatiles(
  densityGcm3,
  surfaceTempK,
  escapeVelocityKmS,
  gravityMs2,
  ageGyr,
  tidalFeedbackActive,
) {
  const vEscMs = escapeVelocityKmS * 1000;

  return MOON_VOLATILE_TABLE.map((volatile) => {
    const present =
      volatile.species === "SO\u2082" ? tidalFeedbackActive : densityGcm3 < volatile.maxRho;
    const sublimating =
      present &&
      (volatile.species === "SO\u2082" ? tidalFeedbackActive : surfaceTempK >= volatile.subK);
    const lambda = sublimating ? jeansParameter(volatile.massAmu, vEscMs, surfaceTempK) : 0;
    const pressurePa = sublimating ? vaporPressurePa(volatile, surfaceTempK) : 0;

    let retained = lambda > 6;
    if (retained && volatile.species !== "SO\u2082") {
      retained = evaluateVolatileRetention({
        pressurePa,
        gravityMs2,
        massAmu: volatile.massAmu,
        tempK: surfaceTempK,
        lambda,
        ageGyr,
      }).retained;
    }

    let status;
    if (!present) status = "Absent";
    else if (!sublimating) status = "Stable ice";
    else if (retained) status = "Thin atmosphere";
    else status = "Exosphere";

    return {
      species: volatile.species,
      label: volatile.label,
      massAmu: volatile.massAmu,
      present,
      sublimating,
      retained,
      lambda,
      pressurePa,
      status,
    };
  });
}

export function computeMagnetosphericRadiation({
  surfaceFieldEarths,
  magnetopauseRp,
  planetSemiMajorAxisAu,
  planetRadiusEarth,
  moonSemiMajorAxisKm,
}) {
  const planetRadiusKm = planetRadiusEarth * KM_PER_REARTH;
  const lShell = planetRadiusKm > 0 ? moonSemiMajorAxisKm / planetRadiusKm : Infinity;
  const surfaceFieldGauss = surfaceFieldEarths * EARTH_SURFACE_FIELD_GAUSS;
  const bAtMoonGauss = lShell > 0 ? surfaceFieldGauss / lShell ** 3 : 0;
  const magnetopauseLShell =
    magnetopauseRp ??
    (surfaceFieldEarths > 0
      ? 10 * Math.cbrt(surfaceFieldEarths) * Math.cbrt(planetSemiMajorAxisAu)
      : 0);

  let magnetosphericRadRemDay = 0;
  if (surfaceFieldEarths > 0 && lShell < magnetopauseLShell && bAtMoonGauss > 0) {
    magnetosphericRadRemDay = EUROPA_K * bAtMoonGauss ** 3;
    const lFrac = lShell / magnetopauseLShell;
    magnetosphericRadRemDay /= 1 + Math.exp(25 * (lFrac - 0.3));
  }

  return {
    magnetosphericRadRemDay,
    magnetopauseLShell,
    bAtMoonGauss,
    lShell,
    insideMagnetosphere: lShell < magnetopauseLShell && surfaceFieldEarths > 0,
  };
}

export function radiationLabel(remDay) {
  if (remDay < 0.001) return "Negligible";
  if (remDay < 0.01) return "Low";
  if (remDay < 0.1) return "Moderate";
  if (remDay < 1) return "High";
  if (remDay < 100) return "Very High";
  return "Extreme";
}
