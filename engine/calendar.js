// Calendar model engine
//
// Builds solar, lunar, and lunisolar calendar structures from
// a planet's orbital period, its moon's orbital period, and the
// planet's rotation period.  All durations are first converted to
// "local days" (one rotation = one local day) so calendar divisions
// are expressed in units that inhabitants would actually experience.
//
// Leap-year and leap-month cycles are derived automatically via
// continued-fraction expansion of the fractional remainder, producing
// a ranked list of rational approximants (best-fit intercalation
// frequencies) from coarse to precise.
//
// Inputs:
//   planetOrbitalPeriodDays   — planet orbital period (Earth days)
//   moonOrbitalPeriodDays     — moon orbital period (Earth days)
//   planetRotationPeriodHours — planet rotation period (hours)
//   weeksPerMonth             — desired weeks per month (all bases)
//
// Outputs:
//   inputs    — sanitised / clamped copies of every input
//   actual    — local month and year lengths in local days (fractional)
//   solar     — solar calendar (year, month, week, leap-year options)
//   lunar     — lunar calendar (month-based year, leap-month options)
//   lunisolar — lunisolar calendar (combined leap-year + leap-month)

import { clamp, toFinite } from "./utils.js";

function positive(value, fallback, min = 0.000001) {
  return Math.max(min, toFinite(value, fallback));
}

function fractionOnly(value) {
  const n = toFinite(value, 0);
  const frac = n - Math.floor(n);
  return frac > 0 ? frac : 0;
}

function roundDown(value) {
  return Math.floor(toFinite(value, 0));
}

function roundUp(value) {
  return Math.ceil(toFinite(value, 0));
}

function computeContinuedFractionCoefficients(frac, maxDepth = 5) {
  const f = fractionOnly(frac);
  if (!(f > 0)) return [];

  const coeffs = [];
  let x = f;

  for (let i = 0; i < maxDepth; i++) {
    if (!(x > 0)) break;
    const reciprocal = 1 / x;
    const ai = Math.floor(reciprocal + 1e-12);
    if (!(ai > 0)) break;
    coeffs.push(ai);
    const remainder = reciprocal - ai;
    if (remainder <= 1e-12) break;
    x = remainder;
  }

  return coeffs;
}

function evaluateZeroLeadingContinuedFraction(coeffPrefix) {
  if (!Array.isArray(coeffPrefix) || !coeffPrefix.length) return 0;
  let value = coeffPrefix[coeffPrefix.length - 1];
  for (let i = coeffPrefix.length - 2; i >= 0; i--) {
    value = coeffPrefix[i] + 1 / value;
  }
  return 1 / value;
}

/**
 * Return a list of best-rational approximants for a fractional value,
 * computed via continued-fraction expansion.  The first element is
 * always 0 (no intercalation); successive entries converge on `frac`.
 *
 * @param {number} frac      - Fractional value to approximate (only the
 *                              decimal part is used; integer part is ignored).
 * @param {number} [maxDepth=5] - Maximum depth of continued-fraction expansion.
 * @returns {number[]} Array of rational approximants in [0, 1), ordered from
 *                     coarsest to most precise.
 */
export function continuedFractionApproximants(frac, maxDepth = 5) {
  const coeffs = computeContinuedFractionCoefficients(frac, maxDepth);
  const options = [0];

  for (let i = 1; i <= coeffs.length; i++) {
    options.push(evaluateZeroLeadingContinuedFraction(coeffs.slice(0, i)));
  }

  return options;
}

function computeWeekBlock(
  totalDaysPerMonth,
  weeksPerMonth,
  { forceFloorIntercalary = false } = {},
) {
  const weeks = Math.max(1, roundDown(weeksPerMonth));
  const daysPerWeek = roundDown(totalDaysPerMonth / weeks);
  const rawIntercalary = totalDaysPerMonth - weeks * daysPerWeek;
  const intercalaryDays = forceFloorIntercalary ? roundDown(rawIntercalary) : rawIntercalary;

  return {
    weeksPerMonth: weeks,
    daysPerWeek,
    intercalaryDays,
  };
}

function computeSolarCalendar(localYearActual, localMonthActual, weeksPerMonth) {
  const commonYearLength = roundDown(localYearActual);
  const leapYearLength = roundUp(localYearActual);
  const leapYearFraction = fractionOnly(localYearActual);

  const monthsPerYear = Math.max(1, roundDown(localYearActual / localMonthActual));
  const daysPerMonth = roundDown(commonYearLength / monthsPerYear);
  const intercalaryDays = commonYearLength - daysPerMonth * monthsPerYear;

  return {
    commonYearLength,
    leapYearLength,
    leapYearOptions: continuedFractionApproximants(leapYearFraction, 5),
    monthsPerYear,
    daysPerMonth,
    intercalaryDays,
    week: computeWeekBlock(daysPerMonth, weeksPerMonth),
  };
}

function computeLunarCalendar(localYearActual, localMonthActual, weeksPerMonth) {
  const monthsPerYear = Math.max(1, roundDown(localYearActual / localMonthActual));
  const yearLength = roundDown(monthsPerYear * localMonthActual);
  const commonMonthLength = roundDown(localMonthActual);
  const leapMonthLength = roundUp(localMonthActual);

  return {
    yearLength,
    monthsPerYear,
    commonMonthLength,
    leapMonthLength,
    leapMonthOptions: continuedFractionApproximants(fractionOnly(localMonthActual), 5),
    week: computeWeekBlock(localMonthActual, weeksPerMonth, { forceFloorIntercalary: true }),
  };
}

function computeLunisolarCalendar(localYearActual, localMonthActual, weeksPerMonth) {
  const monthsPerCommonYear = Math.max(1, roundDown(localYearActual / localMonthActual));
  const monthsPerLeapYear = Math.max(1, roundUp(localYearActual / localMonthActual));

  const commonYearLength = roundDown(monthsPerCommonYear * localMonthActual);
  const leapYearLength = roundDown(monthsPerLeapYear * localMonthActual);

  const leapMonthsPerYearFraction = fractionOnly(localYearActual / localMonthActual);

  return {
    commonYearLength,
    monthsPerCommonYear,
    leapYearLength,
    monthsPerLeapYear,
    leapYearOptions: continuedFractionApproximants(leapMonthsPerYearFraction, 5),
    commonMonthLength: roundDown(localMonthActual),
    leapMonthLength: roundUp(localMonthActual),
    leapMonthOptions: continuedFractionApproximants(fractionOnly(localMonthActual), 5),
    week: computeWeekBlock(localMonthActual, weeksPerMonth, { forceFloorIntercalary: true }),
  };
}

/**
 * Compute a complete calendar model (solar, lunar, and lunisolar
 * variants) from physical orbital and rotational parameters.
 *
 * @param {object}  opts
 * @param {number}  opts.planetOrbitalPeriodDays   - Planet orbital period in Earth days.
 * @param {number}  opts.moonOrbitalPeriodDays     - Moon orbital period in Earth days.
 * @param {number}  opts.planetRotationPeriodHours - Planet rotation period in hours.
 * @param {number}  [opts.weeksPerMonth=4]           - Desired weeks per month (all bases).
 * @returns {{ inputs: object, actual: object, solar: object, lunar: object, lunisolar: object }}
 *   Full calendar model with sanitised inputs, actual local-day durations,
 *   and three calendar variants each containing year/month/week structure
 *   and leap-cycle approximant options.
 */
export function calcCalendarModel({
  planetOrbitalPeriodDays,
  moonOrbitalPeriodDays,
  planetRotationPeriodHours,
  weeksPerMonth = 4,
}) {
  const orbitalPlanet = positive(planetOrbitalPeriodDays, 365.2422);
  const orbitalMoon = positive(moonOrbitalPeriodDays, 29.5306);
  const rotationHours = positive(planetRotationPeriodHours, 24, 0.0001);

  const localDayScale = rotationHours / 24;
  const localMonthActual = orbitalMoon / localDayScale;
  const localYearActual = orbitalPlanet / localDayScale;

  const wpm = clamp(toFinite(weeksPerMonth, 4), 1, 53);
  const solar = computeSolarCalendar(localYearActual, localMonthActual, wpm);
  const lunar = computeLunarCalendar(localYearActual, localMonthActual, wpm);
  const lunisolar = computeLunisolarCalendar(localYearActual, localMonthActual, wpm);

  return {
    inputs: {
      planetOrbitalPeriodDays: orbitalPlanet,
      moonOrbitalPeriodDays: orbitalMoon,
      planetRotationPeriodHours: rotationHours,
      weeksPerMonth: wpm,
    },
    actual: {
      localMonthDays: localMonthActual,
      localYearDays: localYearActual,
    },
    solar,
    lunar,
    lunisolar,
  };
}
