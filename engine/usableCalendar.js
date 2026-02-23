// Usable calendar engine
//
// Builds fully-rendered calendar months from a configurable calendar
// model, supporting solar, lunar, and lunisolar bases. Handles
// week-day layout, leap-rule intercalation, holiday overlays, and
// per-day moon-phase calculation.
//
// Inputs:  calendar model object (basis metrics, day/week/month names,
//          leap rules, holidays, moon synodic period & epoch offset),
//          target year and month index.
// Outputs: structured month grid (rows of week cells with day numbers,
//          moon phase info, holiday annotations), plus header labels,
//          month lengths, and full/new moon day lists.

import { clamp, toFinite } from "./utils.js";

const DEFAULT_BASIS = "solar";

function toInt(value, fallback) {
  const n = Number(value);
  return Number.isFinite(n) ? Math.trunc(n) : fallback;
}

function positiveInt(value, fallback, min = 1) {
  return Math.max(min, toInt(value, fallback));
}

function mod(value, base) {
  if (!Number.isFinite(value) || !Number.isFinite(base) || base <= 0) return 0;
  return ((value % base) + base) % base;
}

function splitNameInput(raw) {
  if (Array.isArray(raw)) return raw;
  if (typeof raw !== "string") return [];
  return raw
    .split(/\r?\n|,/g)
    .map((item) => item.trim())
    .filter(Boolean);
}

/**
 * Extracts normalised calendar metrics (months, days, week structure)
 * for the given basis mode (solar, lunar, or lunisolar).
 *
 * @param {object} calendarModel - Full calendar model containing solar,
 *   lunar, and lunisolar sub-objects with month/week configuration.
 * @param {string} [basis="solar"] - Calendar basis: "solar", "lunar",
 *   or "lunisolar".
 * @returns {{ basis: string, monthsPerYear: number, daysPerMonth: number,
 *   daysPerWeek: number, weeksPerMonth: number, intercalaryDays: number }}
 *   Normalised metrics for the selected basis.
 */
export function getCalendarBasisMetrics(calendarModel, basis = DEFAULT_BASIS) {
  const mode = String(basis || DEFAULT_BASIS).toLowerCase();
  if (mode === "lunar") {
    return {
      basis: "lunar",
      monthsPerYear: positiveInt(calendarModel?.lunar?.monthsPerYear, 12),
      daysPerMonth: Math.max(1, Math.round(toFinite(calendarModel?.lunar?.commonMonthLength, 30))),
      daysPerWeek: positiveInt(calendarModel?.lunar?.week?.daysPerWeek, 7),
      weeksPerMonth: positiveInt(calendarModel?.lunar?.week?.weeksPerMonth, 4),
      intercalaryDays: Math.round(toFinite(calendarModel?.lunar?.week?.intercalaryDays, 0)),
    };
  }
  if (mode === "lunisolar") {
    return {
      basis: "lunisolar",
      monthsPerYear: positiveInt(calendarModel?.lunisolar?.monthsPerCommonYear, 12),
      daysPerMonth: Math.max(
        1,
        Math.round(toFinite(calendarModel?.lunisolar?.commonMonthLength, 30)),
      ),
      daysPerWeek: positiveInt(calendarModel?.lunisolar?.week?.daysPerWeek, 7),
      weeksPerMonth: positiveInt(calendarModel?.lunisolar?.week?.weeksPerMonth, 4),
      intercalaryDays: Math.round(toFinite(calendarModel?.lunisolar?.week?.intercalaryDays, 0)),
    };
  }
  return {
    basis: "solar",
    monthsPerYear: positiveInt(calendarModel?.solar?.monthsPerYear, 12),
    daysPerMonth: Math.max(1, Math.round(toFinite(calendarModel?.solar?.daysPerMonth, 30))),
    daysPerWeek: positiveInt(calendarModel?.solar?.week?.daysPerWeek, 7),
    weeksPerMonth: positiveInt(calendarModel?.solar?.week?.weeksPerMonth, 4),
    intercalaryDays: Math.round(toFinite(calendarModel?.solar?.intercalaryDays, 0)),
  };
}

/**
 * Normalises a raw name list (string, array, or absent) into an array
 * of exactly `count` entries, filling gaps with numbered fallbacks.
 *
 * @param {string|string[]|undefined} raw - Comma- or newline-separated
 *   string, an array of names, or undefined.
 * @param {number} count - Required number of output entries.
 * @param {string} fallbackPrefix - Prefix for auto-generated names
 *   (e.g. "Day" produces "Day 1", "Day 2", ...).
 * @returns {string[]} Array of exactly `count` trimmed name strings.
 */
export function normalizeNameList(raw, count, fallbackPrefix) {
  const expected = positiveInt(count, 1);
  const source = splitNameInput(raw);
  const out = [];
  for (let i = 0; i < expected; i++) {
    const name = String(source[i] || "").trim();
    out.push(name || `${fallbackPrefix} ${i + 1}`);
  }
  return out;
}

/**
 * Validates and normalises an array of leap-year intercalation rules.
 * Each rule specifies a cycle length, offset year, target month, and
 * day delta. Rules with a zero delta are discarded.
 *
 * @param {object[]|undefined} rules - Raw leap rule objects, each with
 *   optional id, name, cycleYears, offsetYear, monthIndex, and dayDelta.
 * @param {number} monthsPerYear - Number of months in the calendar year
 *   (used to clamp monthIndex).
 * @returns {{ id: string, name: string, cycleYears: number,
 *   offsetYear: number, monthIndex: number, dayDelta: number }[]}
 *   Normalised leap rules with non-zero deltas.
 */
export function normalizeLeapRules(rules, monthsPerYear) {
  const maxMonthIndex = Math.max(0, positiveInt(monthsPerYear, 1) - 1);
  return (Array.isArray(rules) ? rules : [])
    .map((rule, idx) => {
      const id = String(rule?.id || `rule-${idx + 1}`);
      const name = String(rule?.name || "").trim() || `Leap Rule ${idx + 1}`;
      const cycleYears = positiveInt(rule?.cycleYears, 4);
      const offsetYear = Math.max(1, positiveInt(rule?.offsetYear, 1));
      const monthIndex = clamp(toInt(rule?.monthIndex, 0), 0, maxMonthIndex);
      const dayDelta = clamp(toInt(rule?.dayDelta, 1), -30, 30);
      return { id, name, cycleYears, offsetYear, monthIndex, dayDelta };
    })
    .filter((rule) => rule.dayDelta !== 0);
}

/**
 * Validates and normalises an array of holiday definitions. Entries
 * without a name are discarded.
 *
 * @param {object[]|undefined} holidays - Raw holiday objects, each with
 *   optional id, name, monthIndex, and day.
 * @param {number} monthsPerYear - Number of months in the calendar year
 *   (used to clamp monthIndex).
 * @returns {{ id: string, name: string, monthIndex: number,
 *   day: number }[]} Normalised holidays with non-empty names.
 */
export function normalizeHolidays(holidays, monthsPerYear) {
  const maxMonthIndex = Math.max(0, positiveInt(monthsPerYear, 1) - 1);
  return (Array.isArray(holidays) ? holidays : [])
    .map((holiday, idx) => {
      const id = String(holiday?.id || `holiday-${idx + 1}`);
      const name = String(holiday?.name || "").trim();
      const monthIndex = clamp(toInt(holiday?.monthIndex, 0), 0, maxMonthIndex);
      const day = positiveInt(holiday?.day, 1);
      return { id, name, monthIndex, day };
    })
    .filter((holiday) => holiday.name);
}

function isLeapRuleActive(rule, year) {
  const cycle = positiveInt(rule?.cycleYears, 1);
  const offset = Math.max(1, positiveInt(rule?.offsetYear, 1));
  return mod(year - offset, cycle) === 0;
}

/**
 * Computes the day-length of every month in a given year, applying
 * intercalary days and any active leap rules.
 *
 * @param {object} options
 * @param {object} options.metrics - Calendar basis metrics (from
 *   getCalendarBasisMetrics).
 * @param {number} [options.year=1] - Target year (1-based).
 * @param {object[]} [options.leapRules=[]] - Leap rule definitions.
 * @returns {number[]} Array of month lengths (one entry per month).
 */
export function getMonthLengthsForYear({ metrics, year = 1, leapRules = [] }) {
  const monthsPerYear = positiveInt(metrics?.monthsPerYear, 12);
  const baseDaysPerMonth = Math.max(1, positiveInt(metrics?.daysPerMonth, 30));
  const monthLengths = Array(monthsPerYear).fill(baseDaysPerMonth);
  const intercalaryDays = toInt(metrics?.intercalaryDays, 0);
  if (intercalaryDays !== 0) {
    monthLengths[monthsPerYear - 1] = Math.max(
      1,
      monthLengths[monthsPerYear - 1] + intercalaryDays,
    );
  }

  for (const rule of normalizeLeapRules(leapRules, monthsPerYear)) {
    if (!isLeapRuleActive(rule, year)) continue;
    const idx = clamp(toInt(rule.monthIndex, 0), 0, monthsPerYear - 1);
    monthLengths[idx] = Math.max(1, monthLengths[idx] + toInt(rule.dayDelta, 0));
  }

  return monthLengths;
}

function daysBeforeYear(metrics, year, leapRules) {
  const target = Math.max(1, positiveInt(year, 1));
  if (target <= 1) return 0;
  const monthsPerYear = positiveInt(metrics?.monthsPerYear, 12);
  const baseDaysPerMonth = Math.max(1, positiveInt(metrics?.daysPerMonth, 30));
  const intercalaryDays = toInt(metrics?.intercalaryDays, 0);
  const baseMonths = Array(monthsPerYear).fill(baseDaysPerMonth);
  if (intercalaryDays !== 0) {
    baseMonths[monthsPerYear - 1] = Math.max(1, baseMonths[monthsPerYear - 1] + intercalaryDays);
  }
  const baseYearLength = baseMonths.reduce((sum, d) => sum + d, 0);
  const normalized = normalizeLeapRules(leapRules, monthsPerYear);

  // Guard: negative deltas can trigger month-length clamping (min 1 day), making
  // the closed-form count unsafe. Fall back to O(year) iteration in that case.
  if (normalized.some((rule) => rule.dayDelta < 0)) {
    let total = 0;
    for (let y = 1; y < target; y++) {
      total += getMonthLengthsForYear({ metrics, year: y, leapRules }).reduce(
        (sum, d) => sum + d,
        0,
      );
    }
    return total;
  }

  // O(rules) fast path: each leap rule fires on an arithmetic sequence of years
  // (offset, offset+cycle, offset+2·cycle, …). Count firings in [1, target-1]
  // and accumulate the day delta for each.
  let total = (target - 1) * baseYearLength;
  for (const rule of normalized) {
    const cycle = positiveInt(rule.cycleYears, 1);
    const offset = Math.max(1, positiveInt(rule.offsetYear, 1));
    const delta = rule.dayDelta;
    const residue = mod(offset, cycle);
    const firstY = residue === 0 ? cycle : residue;
    if (firstY <= target - 1) {
      const count = Math.floor((target - 1 - firstY) / cycle) + 1;
      total += count * delta;
    }
  }
  return total;
}

/**
 * Determines the weekday index on which a given year begins, accounting
 * for cumulative day drift from prior years and leap rules.
 *
 * @param {object} options
 * @param {object} options.metrics - Calendar basis metrics.
 * @param {number} [options.year=1] - Target year (1-based).
 * @param {number} [options.firstYearStartDayIndex=0] - Weekday index
 *   on which year 1 begins (0-based into the day-name list).
 * @param {object[]} [options.leapRules=[]] - Leap rule definitions.
 * @returns {number} Weekday index (0-based) for the first day of the
 *   target year.
 */
export function getYearStartDayIndex({
  metrics,
  year = 1,
  firstYearStartDayIndex = 0,
  leapRules = [],
}) {
  const daysPerWeek = positiveInt(metrics?.daysPerWeek, 7);
  const startDay = mod(toInt(firstYearStartDayIndex, 0), daysPerWeek);
  const offset = daysBeforeYear(metrics, year, leapRules);
  return mod(startDay + offset, daysPerWeek);
}

/**
 * Describes the moon phase for a given age within a synodic cycle.
 * Divides the cycle into eight equal phases (new, waxing crescent,
 * first quarter, waxing gibbous, full, waning gibbous, last quarter,
 * waning crescent) and computes fractional illumination via cosine.
 *
 * @param {object} options
 * @param {number} options.ageDays - Days elapsed since the moon's
 *   reference new-moon epoch.
 * @param {number} [options.synodicDays=29.5306] - Length of the
 *   synodic period in days.
 * @returns {{ ageDays: number, fraction: number,
 *   illuminationPct: number, phaseName: string, phaseShort: string }}
 *   Phase descriptor with age, cycle fraction, illumination percentage,
 *   full phase name, and short phase code.
 */
export function describeMoonPhase({ ageDays, synodicDays }) {
  const synodic = Math.max(0.000001, toFinite(synodicDays, 29.5306));
  const age = mod(toFinite(ageDays, 0), synodic);
  const fraction = age / synodic;
  const illumination = 0.5 * (1 - Math.cos(2 * Math.PI * fraction));

  let phaseName = "New Moon";
  let phaseShort = "N";
  if (fraction >= 1 / 16 && fraction < 3 / 16) {
    phaseName = "Waxing Crescent";
    phaseShort = "WC";
  } else if (fraction >= 3 / 16 && fraction < 5 / 16) {
    phaseName = "First Quarter";
    phaseShort = "1Q";
  } else if (fraction >= 5 / 16 && fraction < 7 / 16) {
    phaseName = "Waxing Gibbous";
    phaseShort = "WG";
  } else if (fraction >= 7 / 16 && fraction < 9 / 16) {
    phaseName = "Full Moon";
    phaseShort = "F";
  } else if (fraction >= 9 / 16 && fraction < 11 / 16) {
    phaseName = "Waning Gibbous";
    phaseShort = "NG";
  } else if (fraction >= 11 / 16 && fraction < 13 / 16) {
    phaseName = "Last Quarter";
    phaseShort = "3Q";
  } else if (fraction >= 13 / 16 && fraction < 15 / 16) {
    phaseName = "Waning Crescent";
    phaseShort = "NC";
  }

  return {
    ageDays: age,
    fraction,
    illuminationPct: illumination * 100,
    phaseName,
    phaseShort,
  };
}

/**
 * Builds a fully-rendered calendar month grid suitable for display.
 * Computes week rows with leading empty cells for alignment, annotates
 * each day with moon phase and matching holidays, and collects
 * full-moon / new-moon day lists for the month.
 *
 * @param {object} options
 * @param {object} options.metrics - Calendar basis metrics (from
 *   getCalendarBasisMetrics).
 * @param {number} [options.year=1] - Target year (1-based).
 * @param {number} [options.monthIndex=0] - Zero-based month index.
 * @param {number} [options.firstYearStartDayIndex=0] - Weekday index
 *   on which year 1 begins.
 * @param {number} [options.weekStartDayIndex=0] - Weekday index that
 *   starts each displayed week row.
 * @param {object[]} [options.leapRules=[]] - Leap rule definitions.
 * @param {object[]} [options.holidays=[]] - Holiday definitions.
 * @param {string|string[]} [options.dayNames=[]] - Day-of-week names.
 * @param {string|string[]} [options.weekNames=[]] - Week-of-month names.
 * @param {number} [options.moonSynodicDays=29.5306] - Moon synodic
 *   period in days.
 * @param {number} [options.moonEpochOffsetDays=0] - Day offset from
 *   calendar day 0 to the moon's reference new-moon epoch.
 * @returns {{ year: number, monthIndex: number, monthLength: number,
 *   monthLengths: number[], monthStartWeekday: number,
 *   leadingEmptyCount: number, daysPerWeek: number, headers: string[],
 *   rows: { weekIndex: number, weekName: string, cells: (?object)[] }[],
 *   fullMoonDays: number[], newMoonDays: number[] }}
 *   Structured month data for rendering.
 */
export function buildUsableCalendarMonth({
  metrics,
  year = 1,
  monthIndex = 0,
  firstYearStartDayIndex = 0,
  weekStartDayIndex = 0,
  leapRules = [],
  holidays = [],
  dayNames = [],
  weekNames = [],
  moonSynodicDays = 29.5306,
  moonEpochOffsetDays = 0,
}) {
  const monthsPerYear = positiveInt(metrics?.monthsPerYear, 12);
  const daysPerWeek = positiveInt(metrics?.daysPerWeek, 7);
  const safeYear = Math.max(1, positiveInt(year, 1));
  const safeMonthIndex = clamp(toInt(monthIndex, 0), 0, monthsPerYear - 1);
  const safeWeekStart = mod(toInt(weekStartDayIndex, 0), daysPerWeek);
  const monthLengths = getMonthLengthsForYear({ metrics, year: safeYear, leapRules });
  const monthLength = monthLengths[safeMonthIndex];

  const normalizedDayNames = normalizeNameList(dayNames, daysPerWeek, "Day");
  const configuredWeeksPerMonth = Math.max(1, positiveInt(metrics?.weeksPerMonth, 4));
  const normalizedWeekNames = normalizeNameList(weekNames, configuredWeeksPerMonth, "Week");
  const normalizedHolidays = normalizeHolidays(holidays, monthsPerYear);

  const yearStart = getYearStartDayIndex({
    metrics,
    year: safeYear,
    firstYearStartDayIndex,
    leapRules,
  });
  const daysBeforeMonth = monthLengths.slice(0, safeMonthIndex).reduce((sum, d) => sum + d, 0);
  const monthStartWeekday = mod(yearStart + daysBeforeMonth, daysPerWeek);
  const leadingEmptyCount = mod(monthStartWeekday - safeWeekStart, daysPerWeek);

  const headers = Array.from(
    { length: daysPerWeek },
    (_, i) => normalizedDayNames[mod(safeWeekStart + i, daysPerWeek)],
  );

  const allCells = [];
  const absoluteMonthStartDay = daysBeforeYear(metrics, safeYear, leapRules) + daysBeforeMonth;

  for (let i = 0; i < leadingEmptyCount; i++) {
    allCells.push(null);
  }

  const fullMoonDays = [];
  const newMoonDays = [];

  for (let day = 1; day <= monthLength; day++) {
    const absoluteDay = absoluteMonthStartDay + day - 1;
    const moon = describeMoonPhase({
      ageDays: absoluteDay + toFinite(moonEpochOffsetDays, 0),
      synodicDays: moonSynodicDays,
    });
    if (moon.phaseShort === "F") fullMoonDays.push(day);
    if (moon.phaseShort === "N") newMoonDays.push(day);

    const holidayNames = normalizedHolidays
      .filter((holiday) => holiday.monthIndex === safeMonthIndex && holiday.day === day)
      .map((holiday) => holiday.name);

    allCells.push({
      dayNumber: day,
      absoluteDay,
      moon,
      holidayNames,
    });
  }

  const rows = [];
  const rowCount = Math.ceil(allCells.length / daysPerWeek);
  for (let row = 0; row < rowCount; row++) {
    const weekName = normalizedWeekNames[row] || `Week ${row + 1}`;
    const cells = allCells.slice(row * daysPerWeek, row * daysPerWeek + daysPerWeek);
    while (cells.length < daysPerWeek) cells.push(null);
    rows.push({ weekIndex: row, weekName, cells });
  }

  return {
    year: safeYear,
    monthIndex: safeMonthIndex,
    monthLength,
    monthLengths,
    monthStartWeekday,
    leadingEmptyCount,
    daysPerWeek,
    headers,
    rows,
    fullMoonDays,
    newMoonDays,
  };
}
