import test from "node:test";
import assert from "node:assert/strict";

import {
  buildUsableCalendarMonth,
  describeMoonPhase,
  getCalendarBasisMetrics,
  normalizeHolidays,
  normalizeLeapRules,
  getMonthLengthsForYear,
  getYearStartDayIndex,
  normalizeNameList,
} from "../engine/usableCalendar.js";

test("normalizeNameList → sparse array → fills blanks with defaults", () => {
  const names = normalizeNameList(["", "Moonday"], 4, "Day");
  assert.deepEqual(names, ["Day 1", "Moonday", "Day 3", "Day 4"]);
});

test("normalizeNameList → comma/newline text → splits and pads", () => {
  const names = normalizeNameList("Sun\nMoon, Stars", 5, "Day");
  assert.deepEqual(names, ["Sun", "Moon", "Stars", "Day 4", "Day 5"]);
});

test("getMonthLengthsForYear → leap rule on month 1 → adds days in matching year", () => {
  const metrics = {
    monthsPerYear: 3,
    daysPerMonth: 10,
    intercalaryDays: 0,
    daysPerWeek: 5,
    weeksPerMonth: 2,
  };
  const monthLengthsYear1 = getMonthLengthsForYear({
    metrics,
    year: 1,
    leapRules: [{ id: "r1", cycleYears: 2, offsetYear: 1, monthIndex: 1, dayDelta: 2 }],
  });
  const monthLengthsYear2 = getMonthLengthsForYear({
    metrics,
    year: 2,
    leapRules: [{ id: "r1", cycleYears: 2, offsetYear: 1, monthIndex: 1, dayDelta: 2 }],
  });

  assert.deepEqual(monthLengthsYear1, [10, 12, 10]);
  assert.deepEqual(monthLengthsYear2, [10, 10, 10]);
});

test("normalizeLeapRules → out-of-bound/zero-delta rules → clamps and drops", () => {
  const out = normalizeLeapRules(
    [
      { id: "A", name: "", cycleYears: 0, offsetYear: -1, monthIndex: 999, dayDelta: 40 },
      { id: "B", name: "Drop me", cycleYears: 4, offsetYear: 1, monthIndex: 0, dayDelta: 0 },
      { id: "C", name: "Neg", cycleYears: 3, offsetYear: 2, monthIndex: -2, dayDelta: -99 },
    ],
    6,
  );

  assert.equal(out.length, 2);
  assert.deepEqual(out[0], {
    id: "A",
    name: "Leap Rule 1",
    cycleYears: 1,
    offsetYear: 1,
    monthIndex: 5,
    dayDelta: 30,
  });
  assert.deepEqual(out[1], {
    id: "C",
    name: "Neg",
    cycleYears: 3,
    offsetYear: 2,
    monthIndex: 0,
    dayDelta: -30,
  });
});

test("normalizeHolidays → blank name / out-of-range → filters and clamps", () => {
  const out = normalizeHolidays(
    [
      { id: "h1", name: " Founding Day ", monthIndex: 2, day: 10 },
      { id: "h2", name: "   ", monthIndex: 1, day: 3 },
      { id: "h3", name: "Clamped", monthIndex: 999, day: -4 },
    ],
    4,
  );

  assert.deepEqual(out, [
    { id: "h1", name: "Founding Day", monthIndex: 2, day: 10 },
    { id: "h3", name: "Clamped", monthIndex: 3, day: 1 },
  ]);
});

test("getMonthLengthsForYear → negative intercalary + leap → clamps month to 1", () => {
  const metrics = {
    monthsPerYear: 3,
    daysPerMonth: 5,
    intercalaryDays: -10,
    daysPerWeek: 5,
    weeksPerMonth: 1,
  };
  const monthLengths = getMonthLengthsForYear({
    metrics,
    year: 1,
    leapRules: [{ id: "neg", cycleYears: 1, offsetYear: 1, monthIndex: 0, dayDelta: -20 }],
  });

  assert.deepEqual(monthLengths, [1, 5, 1]);
});

test("getYearStartDayIndex → year 2 → advances by year length mod week length", () => {
  const metrics = {
    monthsPerYear: 2,
    daysPerMonth: 10,
    intercalaryDays: 0,
    daysPerWeek: 7,
    weeksPerMonth: 2,
  };
  const year1 = getYearStartDayIndex({
    metrics,
    year: 1,
    firstYearStartDayIndex: 2,
  });
  const year2 = getYearStartDayIndex({
    metrics,
    year: 2,
    firstYearStartDayIndex: 2,
  });

  assert.equal(year1, 2);
  assert.equal(year2, 1); // 2 + 20 mod 7 = 1
});

test("getYearStartDayIndex → leap rules in prior years → adjusts start day", () => {
  const metrics = {
    monthsPerYear: 2,
    daysPerMonth: 10,
    intercalaryDays: 0,
    daysPerWeek: 7,
    weeksPerMonth: 2,
  };
  const leapRules = [{ id: "r1", cycleYears: 2, offsetYear: 1, monthIndex: 1, dayDelta: 2 }];
  const year3 = getYearStartDayIndex({
    metrics,
    year: 3,
    firstYearStartDayIndex: 0,
    leapRules,
  });

  // Year lengths before year 3: year1=22 (leap), year2=20 => total 42 => 42 mod 7 = 0
  assert.equal(year3, 0);
});

test("buildUsableCalendarMonth → holidays + moon → grid with markers", () => {
  const view = buildUsableCalendarMonth({
    metrics: {
      monthsPerYear: 4,
      daysPerMonth: 8,
      intercalaryDays: 0,
      daysPerWeek: 4,
      weeksPerMonth: 2,
    },
    year: 1,
    monthIndex: 1,
    firstYearStartDayIndex: 0,
    weekStartDayIndex: 0,
    dayNames: ["A", "B", "C", "D"],
    weekNames: ["W1", "W2"],
    holidays: [{ id: "h1", name: "Festival", monthIndex: 1, day: 3 }],
    moonSynodicDays: 8,
    moonEpochOffsetDays: 0,
  });

  assert.equal(view.headers.length, 4);
  assert.equal(view.monthLength, 8);
  assert.equal(view.rows.length >= 2, true);

  const day3 = view.rows.flatMap((r) => r.cells).find((c) => c && c.dayNumber === 3);
  assert.equal(day3.holidayNames.includes("Festival"), true);
  assert.equal(typeof day3.moon.phaseName, "string");
});

test("buildUsableCalendarMonth → week start offset → pads leading cells", () => {
  const view = buildUsableCalendarMonth({
    metrics: {
      monthsPerYear: 2,
      daysPerMonth: 5,
      intercalaryDays: 0,
      daysPerWeek: 4,
      weeksPerMonth: 2,
    },
    year: 1,
    monthIndex: 0,
    firstYearStartDayIndex: 2,
    weekStartDayIndex: 1,
    dayNames: ["D1", "D2", "D3", "D4"],
    weekNames: ["W1"],
    holidays: [{ id: "h", name: "Start", monthIndex: 0, day: 1 }],
    moonSynodicDays: 10,
    moonEpochOffsetDays: 0,
  });

  assert.equal(view.leadingEmptyCount, 1);
  assert.equal(view.headers.length, 4);
  assert.equal(view.headers[0], "D2");
  assert.ok(view.rows.length >= 2);
  assert.equal(view.rows[0].weekName, "W1");
  assert.equal(view.rows[1].weekName, "Week 2");
  assert.equal(view.rows[0].cells[0], null);
  assert.equal(
    view.rows.flatMap((r) => r.cells).some((c) => c?.holidayNames?.includes("Start")),
    true,
  );
});

test("buildUsableCalendarMonth → leap-adjusted prior months → correct absoluteDay", () => {
  const metrics = {
    monthsPerYear: 3,
    daysPerMonth: 10,
    intercalaryDays: 0,
    daysPerWeek: 5,
    weeksPerMonth: 2,
  };
  const leapRules = [{ id: "r1", cycleYears: 1, offsetYear: 1, monthIndex: 0, dayDelta: 2 }];
  const view = buildUsableCalendarMonth({
    metrics,
    year: 2,
    monthIndex: 1,
    firstYearStartDayIndex: 0,
    weekStartDayIndex: 0,
    leapRules,
    holidays: [],
    moonSynodicDays: 20,
    moonEpochOffsetDays: 0,
  });
  const firstDayCell = view.rows.flatMap((r) => r.cells).find((c) => c?.dayNumber === 1);

  // Year 1 length = 32 (month0 has +2). In year2, month0 length = 12, so month1 day1 absolute = 32 + 12 = 44.
  assert.equal(firstDayCell.absoluteDay, 44);
});

test("describeMoonPhase → new and full moon → correct phase markers", () => {
  const newMoon = describeMoonPhase({ ageDays: 0, synodicDays: 30 });
  const fullMoon = describeMoonPhase({ ageDays: 15, synodicDays: 30 });
  assert.equal(newMoon.phaseShort, "N");
  assert.equal(fullMoon.phaseShort, "F");
  assert.equal(newMoon.illuminationPct < fullMoon.illuminationPct, true);
});

test("describeMoonPhase → various age fractions → correct phase buckets", () => {
  const synodicDays = 16;
  const atWaxingCrescent = describeMoonPhase({ ageDays: 1, synodicDays }); // 1/16
  const atFirstQuarter = describeMoonPhase({ ageDays: 3, synodicDays }); // 3/16
  const atWaningCrescent = describeMoonPhase({ ageDays: 13, synodicDays }); // 13/16
  const atCycleWrap = describeMoonPhase({ ageDays: 15, synodicDays }); // 15/16 (falls back to New Moon bucket)

  assert.equal(atWaxingCrescent.phaseShort, "WC");
  assert.equal(atFirstQuarter.phaseShort, "1Q");
  assert.equal(atWaningCrescent.phaseShort, "NC");
  assert.equal(atCycleWrap.phaseShort, "N");
});

test("getCalendarBasisMetrics → solar/lunar/lunisolar → selects correct branch", () => {
  const calendarModel = {
    solar: {
      monthsPerYear: 12,
      daysPerMonth: 30,
      week: { daysPerWeek: 6, weeksPerMonth: 5 },
      intercalaryDays: 3,
    },
    lunar: {
      monthsPerYear: 10,
      commonMonthLength: 28,
      week: { daysPerWeek: 7, weeksPerMonth: 4, intercalaryDays: 0 },
    },
    lunisolar: {
      monthsPerCommonYear: 13,
      commonMonthLength: 27,
      week: { daysPerWeek: 9, weeksPerMonth: 3, intercalaryDays: 1 },
    },
  };
  assert.equal(getCalendarBasisMetrics(calendarModel, "solar").monthsPerYear, 12);
  assert.equal(getCalendarBasisMetrics(calendarModel, "lunar").monthsPerYear, 10);
  assert.equal(getCalendarBasisMetrics(calendarModel, "lunisolar").monthsPerYear, 13);
});

test("getCalendarBasisMetrics → unknown basis → falls back to solar", () => {
  const calendarModel = {
    solar: {
      monthsPerYear: 11,
      daysPerMonth: 28,
      week: { daysPerWeek: 5, weeksPerMonth: 6 },
      intercalaryDays: 2,
    },
  };
  const metrics = getCalendarBasisMetrics(calendarModel, "unknown-mode");

  assert.equal(metrics.basis, "solar");
  assert.equal(metrics.monthsPerYear, 11);
  assert.equal(metrics.daysPerMonth, 28);
  assert.equal(metrics.daysPerWeek, 5);
});

/* ── QA: holiday overlap ─────────────────────────────────────────── */

test("buildUsableCalendarMonth → two holidays on same day → both appear merged", () => {
  const view = buildUsableCalendarMonth({
    metrics: {
      monthsPerYear: 2,
      daysPerMonth: 10,
      intercalaryDays: 0,
      daysPerWeek: 5,
      weeksPerMonth: 2,
    },
    year: 1,
    monthIndex: 0,
    firstYearStartDayIndex: 0,
    weekStartDayIndex: 0,
    holidays: [
      { id: "h1", name: "Alpha", monthIndex: 0, day: 5 },
      { id: "h2", name: "Beta", monthIndex: 0, day: 5 },
    ],
    moonSynodicDays: 20,
    moonEpochOffsetDays: 0,
  });
  const day5 = view.rows.flatMap((r) => r.cells).find((c) => c?.dayNumber === 5);
  assert.ok(day5, "day 5 should exist");
  assert.ok(day5.holidayNames.includes("Alpha"), "Alpha should match");
  assert.ok(day5.holidayNames.includes("Beta"), "Beta should match");
});

test("getMonthLengthsForYear → two leap rules on same month → net effect applied", () => {
  const metrics = {
    monthsPerYear: 3,
    daysPerMonth: 10,
    intercalaryDays: 0,
    daysPerWeek: 5,
    weeksPerMonth: 2,
  };
  const leapRules = [
    { id: "r1", cycleYears: 1, offsetYear: 1, monthIndex: 1, dayDelta: 3 },
    { id: "r2", cycleYears: 1, offsetYear: 1, monthIndex: 1, dayDelta: -2 },
  ];
  const lengths = getMonthLengthsForYear({ metrics, year: 1, leapRules });
  // Month 1 base=10, +3 and −2 => net +1 = 11
  assert.deepEqual(lengths, [10, 11, 10]);
});

test("getMonthLengthsForYear → negative delta exceeds base → clamps to 1 day", () => {
  const metrics = {
    monthsPerYear: 2,
    daysPerMonth: 4,
    intercalaryDays: 0,
    daysPerWeek: 4,
    weeksPerMonth: 1,
  };
  const leapRules = [{ id: "r1", cycleYears: 1, offsetYear: 1, monthIndex: 0, dayDelta: -5 }];
  const lengths = getMonthLengthsForYear({ metrics, year: 1, leapRules });
  // Month 0: base 4 − 5 would be −1, clamped to 1
  assert.equal(lengths[0], 1);
  assert.equal(lengths[1], 4);
});

test("buildUsableCalendarMonth → holiday near month end → only in-range days match", () => {
  const view = buildUsableCalendarMonth({
    metrics: {
      monthsPerYear: 2,
      daysPerMonth: 10,
      intercalaryDays: 0,
      daysPerWeek: 5,
      weeksPerMonth: 2,
    },
    year: 1,
    monthIndex: 0,
    firstYearStartDayIndex: 0,
    weekStartDayIndex: 0,
    holidays: [{ id: "h1", name: "Boundary", monthIndex: 0, day: 9 }],
    moonSynodicDays: 20,
    moonEpochOffsetDays: 0,
  });
  const day9 = view.rows.flatMap((r) => r.cells).find((c) => c?.dayNumber === 9);
  const day10 = view.rows.flatMap((r) => r.cells).find((c) => c?.dayNumber === 10);
  assert.ok(day9.holidayNames.includes("Boundary"), "Day 9 should have the holiday");
  assert.ok(!day10.holidayNames.includes("Boundary"), "Day 10 should not");
});

test("describeMoonPhase → short synodic period → cycles N/F/N correctly", () => {
  const synodic = 5;
  // At day 0 = new moon (age 0)
  const newMoon = describeMoonPhase({ ageDays: 0, synodicDays: synodic });
  assert.equal(newMoon.phaseShort, "N");
  // At half synodic = full moon
  const fullMoon = describeMoonPhase({ ageDays: 2.5, synodicDays: synodic });
  assert.equal(fullMoon.phaseShort, "F");
  // Full cycle wraps back to new moon
  const wrapped = describeMoonPhase({ ageDays: 5, synodicDays: synodic });
  assert.equal(wrapped.phaseShort, "N");
});

test("describeMoonPhase → synodic period = 1 day → no error", () => {
  const phase = describeMoonPhase({ ageDays: 0.5, synodicDays: 1 });
  assert.equal(typeof phase.phaseName, "string");
  assert.ok(Number.isFinite(phase.illuminationPct));
});
