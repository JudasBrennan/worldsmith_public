import test from "node:test";
import assert from "node:assert/strict";

import { calcCalendarModel, continuedFractionApproximants } from "../engine/calendar.js";

function approxEqual(actual, expected, tolerance, label) {
  const msg = label
    ? `${label}: expected ${expected} +/- ${tolerance}, got ${actual}`
    : `${actual} not within ${tolerance} of ${expected}`;
  assert.ok(Math.abs(actual - expected) <= tolerance, msg);
}

test("continued fraction approximants include zero baseline and expected simple fraction", () => {
  const approximants = continuedFractionApproximants(0.25, 5);
  assert.deepEqual(approximants, [0, 0.25]);
});

test("continued fraction approximants use only fractional part and handle invalid values", () => {
  assert.deepEqual(continuedFractionApproximants(2.25, 5), [0, 0.25]);
  assert.deepEqual(continuedFractionApproximants(-3, 5), [0]);
  assert.deepEqual(continuedFractionApproximants(Number.NaN, 5), [0]);
});

test("calendar model returns expected earth-moon baseline structure", () => {
  const model = calcCalendarModel({
    planetOrbitalPeriodDays: 365.2422,
    moonOrbitalPeriodDays: 29.5306,
    planetRotationPeriodHours: 24,
    solarWeeksPerMonth: 4,
    lunarWeeksPerMonth: 4,
    lunisolarWeeksPerMonth: 4,
  });

  approxEqual(model.actual.localMonthDays, 29.5306, 1e-7);
  approxEqual(model.actual.localYearDays, 365.2422, 1e-7);

  assert.equal(model.solar.monthsPerYear, 12);
  assert.equal(model.solar.commonYearLength, 365);
  assert.equal(model.solar.leapYearLength, 366);

  assert.equal(model.lunar.monthsPerYear, 12);
  assert.equal(model.lunar.commonMonthLength, 29);
  assert.equal(model.lunar.leapMonthLength, 30);

  assert.equal(model.lunisolar.monthsPerCommonYear, 12);
  assert.equal(model.lunisolar.monthsPerLeapYear, 13);
  // Earth-Moon system should produce deterministic continued-fraction approximants
  assert.ok(
    model.lunisolar.leapYearOptions.length >= 3,
    `expected at least 3 leap year options, got ${model.lunisolar.leapYearOptions.length}`,
  );
  // Verify options are all valid numbers
  for (const opt of model.lunisolar.leapYearOptions) {
    assert.ok(Number.isFinite(opt), `leap year option ${opt} should be finite`);
  }
});

test("calendar week blocks are constrained to at least one week per month", () => {
  const model = calcCalendarModel({
    planetOrbitalPeriodDays: 20,
    moonOrbitalPeriodDays: 3,
    planetRotationPeriodHours: 40,
    solarWeeksPerMonth: 0,
    lunarWeeksPerMonth: 0,
    lunisolarWeeksPerMonth: 0,
  });

  assert.ok(model.solar.week.weeksPerMonth >= 1, "solar weeks per month >= 1");
  assert.ok(model.lunar.week.weeksPerMonth >= 1, "lunar weeks per month >= 1");
  assert.ok(model.lunisolar.week.weeksPerMonth >= 1, "lunisolar weeks per month >= 1");
});

test("calendar model sanitizes invalid orbital and rotation inputs", () => {
  const model = calcCalendarModel({
    planetOrbitalPeriodDays: -365,
    moonOrbitalPeriodDays: 0,
    planetRotationPeriodHours: 0,
    solarWeeksPerMonth: -5,
    lunarWeeksPerMonth: "bad",
    lunisolarWeeksPerMonth: undefined,
  });

  assert.ok(model.inputs.planetOrbitalPeriodDays > 0);
  assert.ok(model.inputs.moonOrbitalPeriodDays > 0);
  assert.ok(model.inputs.planetRotationPeriodHours > 0);
  assert.equal(model.inputs.solarWeeksPerMonth, 1);
  assert.equal(model.inputs.lunarWeeksPerMonth, 4);
  assert.equal(model.inputs.lunisolarWeeksPerMonth, 4);
});

test("calendar model clamps week settings to maximum supported range", () => {
  const model = calcCalendarModel({
    planetOrbitalPeriodDays: 365.2422,
    moonOrbitalPeriodDays: 29.5306,
    planetRotationPeriodHours: 24,
    solarWeeksPerMonth: 500,
    lunarWeeksPerMonth: 500,
    lunisolarWeeksPerMonth: 500,
  });

  assert.equal(model.inputs.solarWeeksPerMonth, 53);
  assert.equal(model.inputs.lunarWeeksPerMonth, 53);
  assert.equal(model.inputs.lunisolarWeeksPerMonth, 53);
});

test("rotation period rescales local month and local year durations", () => {
  const fast = calcCalendarModel({
    planetOrbitalPeriodDays: 400,
    moonOrbitalPeriodDays: 40,
    planetRotationPeriodHours: 24,
    solarWeeksPerMonth: 4,
    lunarWeeksPerMonth: 4,
    lunisolarWeeksPerMonth: 4,
  });
  const slow = calcCalendarModel({
    planetOrbitalPeriodDays: 400,
    moonOrbitalPeriodDays: 40,
    planetRotationPeriodHours: 48,
    solarWeeksPerMonth: 4,
    lunarWeeksPerMonth: 4,
    lunisolarWeeksPerMonth: 4,
  });

  approxEqual(slow.actual.localMonthDays, fast.actual.localMonthDays / 2, 1e-8);
  approxEqual(slow.actual.localYearDays, fast.actual.localYearDays / 2, 1e-8);
});

test("lunisolar month counts remain internally consistent", () => {
  const model = calcCalendarModel({
    planetOrbitalPeriodDays: 730.5,
    moonOrbitalPeriodDays: 20,
    planetRotationPeriodHours: 20,
    solarWeeksPerMonth: 5,
    lunarWeeksPerMonth: 5,
    lunisolarWeeksPerMonth: 5,
  });

  assert.ok(model.lunisolar.monthsPerCommonYear >= 1);
  assert.ok(model.lunisolar.monthsPerLeapYear >= model.lunisolar.monthsPerCommonYear);
  assert.ok(model.lunar.monthsPerYear >= 1);
  assert.ok(model.solar.monthsPerYear >= 1);
});
