import test from "node:test";
import assert from "node:assert/strict";

import { initCalendarPage } from "../ui/calendarPage.js";
import { createSolPresetEnvelope } from "../ui/solPreset.js";
import { importWorld } from "../ui/store.js";
import { installDomHarness } from "./domHarness.js";

function setupCalendarPage() {
  const harness = installDomHarness();
  const mount = document.createElement("div");
  document.body.appendChild(mount);
  localStorage.clear();
  initCalendarPage(mount);

  const click = (el) => {
    el.dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
  };
  const change = (el) => {
    el.dispatchEvent(new window.Event("change", { bubbles: true }));
  };
  const cleanup = () => {
    mount.remove();
    harness.cleanup();
  };

  return { mount, click, change, cleanup };
}

function getSectionToggle(key) {
  return document.querySelector(`.calendar-collapse-toggle[data-collapse-key="${key}"]`);
}

function getMonthLengthFromTitle() {
  const title = document.querySelector("#calMonthTitle")?.textContent || "";
  const match = title.match(/\((\d+)\s+days\)/i);
  return match ? Number(match[1]) : 30;
}

test("calendar page renders with collapsible sections defaulted to collapsed", () => {
  const { cleanup } = setupCalendarPage();
  try {
    const title = document.querySelector(".panel__title")?.textContent || "";
    assert.ok(title.includes("Calendar"));

    const toggles = [...document.querySelectorAll(".calendar-collapse-toggle")];
    assert.ok(toggles.length >= 6);
    for (const toggle of toggles) {
      assert.equal(toggle.dataset.state, "collapsed");
      assert.equal(toggle.getAttribute("aria-expanded"), "false");
      const bodyId = toggle.getAttribute("aria-controls");
      assert.ok(bodyId);
      const body = document.getElementById(bodyId);
      assert.ok(body);
      assert.equal(body.hidden, true);
    }
  } finally {
    cleanup();
  }
});

test("calendar section toggle expands and collapses the target panel", () => {
  const { click, cleanup } = setupCalendarPage();
  try {
    const specialToggle = getSectionToggle("special");
    assert.ok(specialToggle);

    click(specialToggle);
    assert.equal(specialToggle.dataset.state, "expanded");
    assert.equal(specialToggle.getAttribute("aria-expanded"), "true");
    const body = document.getElementById(specialToggle.getAttribute("aria-controls"));
    assert.equal(body.hidden, false);

    click(specialToggle);
    assert.equal(specialToggle.dataset.state, "collapsed");
    assert.equal(specialToggle.getAttribute("aria-expanded"), "false");
    assert.equal(body.hidden, true);
  } finally {
    cleanup();
  }
});

test("relative holiday controls enable/disable correctly by trigger type", () => {
  const { click, change, cleanup } = setupCalendarPage();
  try {
    click(getSectionToggle("special"));

    const useRelative = document.querySelector("#calHolidayUseRelative");
    const relativeType = document.querySelector("#calHolidayRelativeType");
    const useDate = document.querySelector("#calHolidayUseDate");
    const useWeekday = document.querySelector("#calHolidayUseWeekday");
    const useMoon = document.querySelector("#calHolidayUseMoon");
    const relMoonSlot = document.querySelector("#calHolidayRelativeMoonSlot");
    const relMoonPhase = document.querySelector("#calHolidayRelativeMoonPhase");
    const relMarker = document.querySelector("#calHolidayRelativeMarker");
    const relHoliday = document.querySelector("#calHolidayRelativeHoliday");

    assert.ok(useRelative && relativeType && useDate && useWeekday && useMoon);
    assert.ok(relMoonSlot && relMoonPhase && relMarker && relHoliday);

    assert.equal(relativeType.disabled, true);
    useRelative.checked = true;
    change(useRelative);

    assert.equal(relativeType.disabled, false);
    assert.equal(useDate.disabled, true);
    assert.equal(useWeekday.disabled, true);
    assert.equal(useMoon.disabled, true);
    assert.equal(useDate.checked, false);
    assert.equal(useWeekday.checked, false);
    assert.equal(useMoon.checked, false);

    relativeType.value = "moon-phase";
    change(relativeType);
    assert.equal(relMoonSlot.disabled, false);
    assert.equal(relMoonPhase.disabled, false);
    assert.equal(relMarker.disabled, true);
    assert.equal(relHoliday.disabled, true);

    relativeType.value = "astronomy-marker";
    change(relativeType);
    assert.equal(relMoonSlot.disabled, true);
    assert.equal(relMoonPhase.disabled, true);
    assert.equal(relMarker.disabled, false);
    assert.equal(relHoliday.disabled, true);

    relativeType.value = "holiday";
    change(relativeType);
    assert.equal(relMoonSlot.disabled, true);
    assert.equal(relMoonPhase.disabled, true);
    assert.equal(relMarker.disabled, true);
    assert.equal(relHoliday.disabled, false);
  } finally {
    cleanup();
  }
});

test("detailed calendar overlay opens and closes via button and Escape key", () => {
  const { click, cleanup } = setupCalendarPage();
  try {
    const openDetail = document.querySelector("#calOpenDetail");
    const closeDetail = document.querySelector("#calCloseDetail");
    const overlay = document.querySelector("#calDetailOverlay");
    assert.ok(openDetail && closeDetail && overlay);
    assert.equal(overlay.classList.contains("is-hidden"), true);

    click(openDetail);
    assert.equal(overlay.classList.contains("is-hidden"), false);

    document.dispatchEvent(new window.KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    assert.equal(overlay.classList.contains("is-hidden"), true);

    click(openDetail);
    assert.equal(overlay.classList.contains("is-hidden"), false);
    click(closeDetail);
    assert.equal(overlay.classList.contains("is-hidden"), true);
  } finally {
    cleanup();
  }
});

test("multi-day holiday crossing month boundary shows continuation marker and detail text", () => {
  const { click, cleanup } = setupCalendarPage();
  try {
    click(getSectionToggle("special"));

    const holidayName = document.querySelector("#calHolidayName");
    const holidayDay = document.querySelector("#calHolidayDayOfMonth");
    const holidayDuration = document.querySelector("#calHolidayDuration");
    const holidaySave = document.querySelector("#calHolidaySave");
    assert.ok(holidayName && holidayDay && holidayDuration && holidaySave);

    const monthLength = getMonthLengthFromTitle();
    holidayName.value = "Span Fest";
    holidayDay.value = String(Math.max(1, monthLength - 1));
    holidayDuration.value = "3";
    click(holidaySave);

    const holidayMarkers = [...document.querySelectorAll(".calendar-mini-day__holiday")]
      .map((el) => (el.textContent || "").trim())
      .filter((text) => text.includes("H"));
    assert.ok(holidayMarkers.length > 0);
    assert.ok(holidayMarkers.some((text) => text.includes("←") || text.includes("→")));

    const selectDayButton = document.querySelector(`button[data-cal-mini-day="${monthLength}"]`);
    assert.ok(selectDayButton);
    click(selectDayButton);

    const selectedText = document.querySelector("#calSelectedDay")?.textContent || "";
    assert.ok(
      selectedText.includes("continues from previous day") ||
        selectedText.includes("continues to next day"),
    );
  } finally {
    cleanup();
  }
});

test("season band visibility follows astronomy controls", () => {
  const { click, change, cleanup } = setupCalendarPage();
  try {
    click(getSectionToggle("output"));

    const markerEnabled = document.querySelector("#calMarkerEnabled");
    const markerSeasons = document.querySelector("#calMarkerSeasons");
    const markerSeasonBands = document.querySelector("#calMarkerSeasonBands");
    const seasonBand = document.querySelector("#calSeasonBand");
    assert.ok(markerEnabled && markerSeasons && markerSeasonBands && seasonBand);

    assert.equal(seasonBand.hidden, true);
    assert.equal(markerSeasonBands.disabled, true);

    markerEnabled.checked = true;
    change(markerEnabled);
    assert.equal(markerSeasonBands.disabled, false);
    assert.equal(seasonBand.hidden, false);

    markerSeasonBands.checked = false;
    change(markerSeasonBands);
    assert.equal(seasonBand.hidden, true);

    markerSeasonBands.checked = true;
    change(markerSeasonBands);
    assert.equal(seasonBand.hidden, false);

    markerSeasons.checked = false;
    change(markerSeasons);
    assert.equal(markerSeasonBands.disabled, true);
    assert.equal(seasonBand.hidden, true);
  } finally {
    cleanup();
  }
});

test("selected-day astronomy detail includes source label text", () => {
  const { click, change, cleanup } = setupCalendarPage();
  try {
    click(getSectionToggle("output"));

    const markerEnabled = document.querySelector("#calMarkerEnabled");
    assert.ok(markerEnabled);
    markerEnabled.checked = true;
    change(markerEnabled);

    const selectedText = document.querySelector("#calSelectedDay")?.textContent || "";
    assert.match(selectedText, /vernal equinox/i);
    assert.match(selectedText, /\(planet year\)/i);
  } finally {
    cleanup();
  }
});

test("work/rest cycle rules render markers in simple and detailed calendar views", () => {
  const { click, change, cleanup } = setupCalendarPage();
  try {
    click(getSectionToggle("cycles"));

    const name = document.querySelector("#calCycleName");
    const mode = document.querySelector("#calCycleMode");
    const weekend = document.querySelector("#calCycleWeekendRule");
    const weekendDays = [
      ...document.querySelectorAll("#calWeekendDays input[data-cal-weekend-day]"),
    ];
    const intervalDays = document.querySelector("#calCycleIntervalDays");
    const label = document.querySelector("#calCycleMarkerLabel");
    const short = document.querySelector("#calCycleMarkerShort");
    const save = document.querySelector("#calCycleSave");
    const list = document.querySelector("#calCycleList");
    assert.ok(
      name &&
        mode &&
        weekend &&
        weekendDays.length > 0 &&
        intervalDays &&
        label &&
        short &&
        save &&
        list,
    );

    name.value = "Market cadence";
    mode.value = "interval";
    change(mode);
    weekend.value = "nearest-weekday";
    change(weekend);
    intervalDays.value = "5";
    label.value = "Market";
    short.value = "M";
    click(save);

    const listText = list.textContent || "";
    assert.match(listText, /market cadence/i);

    const selectedText = document.querySelector("#calSelectedDay")?.textContent || "";
    assert.match(selectedText, /cycles:/i);
    assert.match(selectedText, /market cadence/i);

    const detailedMarker = document.querySelector("#calDetailBody .calendar-cycle-marker");
    assert.ok(detailedMarker || document.querySelector("#calMiniBody .calendar-mini-day__holiday"));
  } finally {
    cleanup();
  }
});

test("pre-calendar year schema renders BCE/CE style labels", () => {
  const { change, cleanup } = setupCalendarPage();
  try {
    const mode = document.querySelector("#calYearDisplayMode");
    const startYear = document.querySelector("#calPreCalendarStartYear");
    const preLabel = document.querySelector("#calPreEraLabel");
    const postLabel = document.querySelector("#calPostEraLabel");
    const useYearZero = document.querySelector("#calPreCalendarUseYearZero");
    const yearOffset = document.querySelector("#calYearOffset");
    assert.ok(mode && startYear && preLabel && postLabel && useYearZero && yearOffset);

    mode.value = "pre-calendar";
    change(mode);
    startYear.value = "1";
    preLabel.value = "BCE";
    postLabel.value = "CE";
    yearOffset.value = "0";
    useYearZero.checked = false;
    change(startYear);

    let title = document.querySelector("#calMonthTitle")?.textContent || "";
    assert.match(title, /\b1 CE\b/i);

    yearOffset.value = "-1";
    change(yearOffset);
    title = document.querySelector("#calMonthTitle")?.textContent || "";
    assert.match(title, /\b1 BCE\b/i);

    yearOffset.value = "0";
    useYearZero.checked = true;
    change(useYearZero);
    title = document.querySelector("#calMonthTitle")?.textContent || "";
    assert.match(title, /\b0 CE\b/i);
  } finally {
    cleanup();
  }
});

test("relative holiday trigger resolves against another holiday with offset", () => {
  const { click, change, cleanup } = setupCalendarPage();
  try {
    click(getSectionToggle("special"));

    const name = document.querySelector("#calHolidayName");
    const dayOfMonth = document.querySelector("#calHolidayDayOfMonth");
    const save = document.querySelector("#calHolidaySave");
    const useRelative = document.querySelector("#calHolidayUseRelative");
    const relativeType = document.querySelector("#calHolidayRelativeType");
    const relativeHoliday = document.querySelector("#calHolidayRelativeHoliday");
    const relativeOffset = document.querySelector("#calHolidayRelativeOffset");
    assert.ok(
      name &&
        dayOfMonth &&
        save &&
        useRelative &&
        relativeType &&
        relativeHoliday &&
        relativeOffset,
    );

    name.value = "Anchor Day";
    dayOfMonth.value = "1";
    click(save);

    const anchorEditButton = document.querySelector(
      "#calHolidayList button[data-cal-holiday-edit]",
    );
    assert.ok(anchorEditButton);
    const anchorId = anchorEditButton.getAttribute("data-cal-holiday-edit");
    assert.ok(anchorId);

    name.value = "After Anchor";
    useRelative.checked = true;
    change(useRelative);
    relativeType.value = "holiday";
    change(relativeType);
    relativeHoliday.value = anchorId;
    change(relativeHoliday);
    relativeOffset.value = "2";
    click(save);

    const day3 = document.querySelector('button[data-cal-mini-day="3"]');
    assert.ok(day3);
    click(day3);

    const selectedText = document.querySelector("#calSelectedDay")?.textContent || "";
    assert.match(selectedText, /after anchor/i);
  } finally {
    cleanup();
  }
});

test("algorithmic holiday anchor places Gregorian Easter on correct month/day", () => {
  const { click, change, cleanup } = setupCalendarPage();
  try {
    click(getSectionToggle("special"));

    const name = document.querySelector("#calHolidayName");
    const save = document.querySelector("#calHolidaySave");
    const advanced = document.querySelector("#calHolidayAdvancedToggle");
    const anchorType = document.querySelector("#calHolidayAnchorType");
    const algorithm = document.querySelector("#calHolidayAlgorithm");
    const month = document.querySelector("#calMonth");
    const year = document.querySelector("#calYear");
    assert.ok(name && save && advanced && anchorType && algorithm && month && year);

    advanced.checked = true;
    change(advanced);
    anchorType.value = "algorithmic";
    change(anchorType);
    algorithm.value = "gregorian-easter-western";
    change(algorithm);
    name.value = "Easter";
    click(save);

    year.value = "1";
    change(year);
    month.value = "3"; // April in Gregorian-based month names.
    change(month);

    const day1 = document.querySelector('button[data-cal-mini-day="1"]');
    assert.ok(day1);
    click(day1);

    const selectedText = document.querySelector("#calSelectedDay")?.textContent || "";
    assert.match(selectedText, /easter/i);
  } finally {
    cleanup();
  }
});

test("Sol preset UK Easter holidays land on expected 2027 dates", () => {
  const harness = installDomHarness();
  localStorage.clear();
  importWorld(createSolPresetEnvelope().world);
  const mount = document.createElement("div");
  document.body.appendChild(mount);
  initCalendarPage(mount);
  try {
    const year = document.querySelector("#calYear");
    const month = document.querySelector("#calMonth");
    assert.ok(year && month);

    year.value = "2027";
    year.dispatchEvent(new window.Event("change", { bubbles: true }));
    month.value = "2"; // March
    month.dispatchEvent(new window.Event("change", { bubbles: true }));

    const clickDay = (day) => {
      const button = document.querySelector(`button[data-cal-mini-day="${day}"]`);
      assert.ok(button, `Expected day button ${day}`);
      button.dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
      return String(document.querySelector("#calSelectedDay")?.textContent || "");
    };

    const day26 = clickDay(26);
    const day28 = clickDay(28);
    const day29 = clickDay(29);
    assert.match(day26, /good friday/i);
    assert.match(day28, /easter sunday/i);
    assert.match(day29, /easter monday/i);
  } finally {
    mount.remove();
    harness.cleanup();
  }
});

/* ── QA: Phase 9 tests ──────────────────────────────────────────── */

test("festival with outsideWeekFlow renders in summary, not in grid cells", () => {
  const { click, change, cleanup } = setupCalendarPage();
  try {
    click(getSectionToggle("festival"));

    const name = document.querySelector("#calFestivalName");
    const afterDay = document.querySelector("#calFestivalAfterDay");
    const duration = document.querySelector("#calFestivalDuration");
    const outsideFlow = document.querySelector("#calFestivalOutsideWeek");
    const save = document.querySelector("#calFestivalSave");
    assert.ok(name && afterDay && duration && outsideFlow && save);

    name.value = "Ghost Day";
    afterDay.value = "5";
    duration.value = "1";
    outsideFlow.checked = true;
    change(outsideFlow);
    click(save);

    // Outside-week-flow festivals show in the compact events summary, not as grid cells
    const compactEvents = document.querySelector("#calCompactEvents")?.textContent || "";
    assert.match(compactEvents, /ghost day/i);

    // Should NOT appear as a festival-kind cell in the mini grid
    const festivalCells = [
      ...document.querySelectorAll("#calMiniBody .calendar-mini-day--festival"),
    ];
    const ghostCells = festivalCells.filter((el) =>
      (el.textContent || "").toLowerCase().includes("ghost day"),
    );
    assert.equal(ghostCells.length, 0, "Outside-week-flow festival should not appear in grid");
  } finally {
    cleanup();
  }
});

test("holiday conflict shift-forward moves second holiday to next day", () => {
  const { click, change, cleanup } = setupCalendarPage();
  try {
    click(getSectionToggle("special"));

    const name = document.querySelector("#calHolidayName");
    const dayOfMonth = document.querySelector("#calHolidayDayOfMonth");
    const save = document.querySelector("#calHolidaySave");
    const advanced = document.querySelector("#calHolidayAdvancedToggle");
    const conflictRule = document.querySelector("#calHolidayConflictRule");
    const priority = document.querySelector("#calHolidayPriority");
    assert.ok(name && dayOfMonth && save && advanced && conflictRule && priority);

    // First holiday: high priority on day 3
    name.value = "Immovable Feast";
    dayOfMonth.value = "3";
    priority.value = "10";
    click(save);

    // Second holiday: lower priority on day 3, shift-forward on conflict
    advanced.checked = true;
    change(advanced);
    name.value = "Moveable Holiday";
    dayOfMonth.value = "3";
    priority.value = "1";
    conflictRule.value = "shift-forward";
    change(conflictRule);
    click(save);

    // Day 3 should have Immovable Feast
    const day3Btn = document.querySelector('button[data-cal-mini-day="3"]');
    assert.ok(day3Btn);
    click(day3Btn);
    const day3Text = document.querySelector("#calSelectedDay")?.textContent || "";
    assert.match(day3Text, /immovable feast/i);

    // Day 4 should have Moveable Holiday (shifted forward)
    const day4Btn = document.querySelector('button[data-cal-mini-day="4"]');
    assert.ok(day4Btn);
    click(day4Btn);
    const day4Text = document.querySelector("#calSelectedDay")?.textContent || "";
    assert.match(day4Text, /moveable holiday/i);
  } finally {
    cleanup();
  }
});

test("work cycle duty mode shows correct active/rest labels on sequential days", () => {
  const { click, change, cleanup } = setupCalendarPage();
  try {
    click(getSectionToggle("cycles"));

    const name = document.querySelector("#calCycleName");
    const mode = document.querySelector("#calCycleMode");
    const onDays = document.querySelector("#calCycleOnDays");
    const offDays = document.querySelector("#calCycleOffDays");
    const activeLabel = document.querySelector("#calCycleActiveLabel");
    const restLabel = document.querySelector("#calCycleRestLabel");
    const save = document.querySelector("#calCycleSave");
    assert.ok(name && mode && onDays && offDays && activeLabel && restLabel && save);

    name.value = "Guard Duty";
    mode.value = "duty";
    change(mode);
    onDays.value = "2";
    offDays.value = "1";
    activeLabel.value = "On Duty";
    restLabel.value = "Off Duty";
    click(save);

    // Click through 3 sequential days and check labels cycle
    const labels = [];
    for (let d = 1; d <= 3; d++) {
      const btn = document.querySelector(`button[data-cal-mini-day="${d}"]`);
      assert.ok(btn, `day ${d} button`);
      click(btn);
      labels.push(document.querySelector("#calSelectedDay")?.textContent || "");
    }
    // With a 2-on/1-off cycle starting at absolute day 0, check pattern
    const hasActive = labels.some((t) => /on duty/i.test(t));
    const hasRest = labels.some((t) => /off duty/i.test(t));
    assert.ok(hasActive, "Should have at least one active day in first 3 days");
    assert.ok(hasRest, "Should have at least one rest day in first 3 days");
  } finally {
    cleanup();
  }
});

test("rule debugger trace panel renders with copy button for selected day with holiday", () => {
  const { click, cleanup } = setupCalendarPage();
  try {
    click(getSectionToggle("special"));

    const name = document.querySelector("#calHolidayName");
    const dayOfMonth = document.querySelector("#calHolidayDayOfMonth");
    const save = document.querySelector("#calHolidaySave");
    assert.ok(name && dayOfMonth && save);

    name.value = "Debug Test Day";
    dayOfMonth.value = "5";
    click(save);

    const day5 = document.querySelector('button[data-cal-mini-day="5"]');
    assert.ok(day5);
    click(day5);

    const selectedDay = document.querySelector("#calSelectedDay");
    assert.ok(selectedDay);
    const traceDetails = selectedDay.querySelector("details.calendar-rule-trace");
    assert.ok(traceDetails, "Rule trace details element should exist");

    const traceSummary = traceDetails.querySelector("summary");
    assert.ok(traceSummary);
    assert.match(traceSummary.textContent, /rule trace/i);

    // Check that the holiday appears in the trace table
    const traceText = traceDetails.textContent || "";
    assert.match(traceText, /debug test day/i);
    assert.match(traceText, /fixed-date/i);

    // Copy button
    const copyBtn = document.querySelector(".calendar-rule-trace__copy");
    assert.ok(copyBtn, "Copy to clipboard button should exist in trace");
    assert.match(copyBtn.textContent, /copy to clipboard/i);
  } finally {
    cleanup();
  }
});

test("global weekend rule and weekend day checkboxes wire up correctly", () => {
  const { click, change, cleanup } = setupCalendarPage();
  try {
    click(getSectionToggle("cycles"));

    const weekendRule = document.querySelector("#calCycleWeekendRule");
    const weekendDayContainer = document.querySelector("#calWeekendDays");
    assert.ok(weekendRule, "Global weekend rule select should exist");
    assert.ok(weekendDayContainer, "Weekend days container should exist");

    const weekendCheckboxes = [
      ...weekendDayContainer.querySelectorAll("input[data-cal-weekend-day]"),
    ];
    assert.ok(weekendCheckboxes.length > 0, "Should have weekend day checkboxes");

    // Set global weekend rule to next-monday
    weekendRule.value = "next-monday";
    change(weekendRule);

    // Enable day indexes 5 and 6 as weekend
    for (const cb of weekendCheckboxes) {
      const dayIndex = Number(cb.dataset.calWeekendDay);
      cb.checked = dayIndex === 5 || dayIndex === 6;
      change(cb);
    }

    // Create a holiday on day 1 to verify it renders (weekend shift is transparent)
    click(getSectionToggle("special"));
    const name = document.querySelector("#calHolidayName");
    const dayOfMonth = document.querySelector("#calHolidayDayOfMonth");
    const save = document.querySelector("#calHolidaySave");
    assert.ok(name && dayOfMonth && save);

    name.value = "Weekend Test";
    dayOfMonth.value = "1";
    click(save);

    // Verify the holiday appears somewhere in the calendar
    const list = document.querySelector("#calHolidayList");
    assert.match(list?.textContent || "", /weekend test/i);
  } finally {
    cleanup();
  }
});
