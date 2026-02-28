import test from "node:test";
import assert from "node:assert/strict";

import { initCalendarPage } from "../ui/calendarPage.js";
import { installDomHarness } from "./domHarness.js";

function createPage() {
  const mount = document.createElement("div");
  document.body.appendChild(mount);
  initCalendarPage(mount);
  return mount;
}

function click(el) {
  el.dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
}

function change(el) {
  el.dispatchEvent(new window.Event("change", { bubbles: true }));
}

function tick() {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

test("calendar JSON import apply updates live UI state", async () => {
  const harness = installDomHarness();
  localStorage.clear();
  const mount = createPage();
  try {
    const jsonText = document.querySelector("#calJsonText");
    const loadCurrent = document.querySelector("#calJsonLoadCurrent");
    const importApply = document.querySelector("#calImportApply");
    const nameInput = document.querySelector("#calCalendarName");
    const yearInput = document.querySelector("#calYear");
    const status = document.querySelector("#calJsonStatus");
    assert.ok(jsonText && loadCurrent && importApply && nameInput && yearInput && status);

    if (!String(jsonText.value || "").trim()) click(loadCurrent);
    const parsed = JSON.parse(jsonText.value);

    if (Array.isArray(parsed?.calendar?.profiles) && parsed.calendar.profiles.length) {
      const first = parsed.calendar.profiles[0];
      first.name = "Imported Profile";
      first.ui = { ...(first.ui || {}), calendarName: "Imported Calendar", year: 7, monthIndex: 2 };
      parsed.calendar.activeProfileId = first.id;
    } else {
      parsed.calendar = {
        inputs: parsed?.calendar?.inputs || parsed?.inputs || {},
        ui: {
          ...(parsed?.calendar?.ui || parsed?.ui || {}),
          calendarName: "Imported Calendar",
          year: 7,
          monthIndex: 2,
        },
      };
    }

    jsonText.value = JSON.stringify(parsed, null, 2);
    click(importApply);
    await tick();

    assert.equal(nameInput.value, "Imported Calendar");
    assert.equal(yearInput.value, "7");
    assert.match(status.textContent || "", /imported/i);
  } finally {
    mount.remove();
    harness.cleanup();
  }
});

test("calendar profile switching preserves per-profile settings", () => {
  const harness = installDomHarness();
  localStorage.clear();
  const mount = createPage();
  try {
    const profileSelect = document.querySelector("#calProfileSelect");
    const profileNew = document.querySelector("#calProfileNew");
    const calendarName = document.querySelector("#calCalendarName");
    assert.ok(profileSelect && profileNew && calendarName);

    const originalProfileId = profileSelect.value;
    const originalName = calendarName.value;

    const promptBefore = window.prompt;
    window.prompt = () => "Religious Calendar";
    click(profileNew);
    window.prompt = promptBefore;

    const newProfileId = profileSelect.value;
    assert.notEqual(newProfileId, originalProfileId);
    assert.ok([...profileSelect.options].some((option) => option.value === newProfileId));

    calendarName.value = "Religious Calendar Custom";
    change(calendarName);

    profileSelect.value = originalProfileId;
    change(profileSelect);
    assert.equal(calendarName.value, originalName);

    profileSelect.value = newProfileId;
    change(profileSelect);
    assert.equal(calendarName.value, "Religious Calendar Custom");
  } finally {
    mount.remove();
    harness.cleanup();
  }
});

test("work cycle rules are profile-scoped", () => {
  const harness = installDomHarness();
  localStorage.clear();
  const mount = createPage();
  try {
    const profileSelect = document.querySelector("#calProfileSelect");
    const profileNew = document.querySelector("#calProfileNew");
    const cycleToggle = document.querySelector(
      '.calendar-collapse-toggle[data-collapse-key="cycles"]',
    );
    const cycleName = document.querySelector("#calCycleName");
    const cycleSave = document.querySelector("#calCycleSave");
    const cycleList = document.querySelector("#calCycleList");
    assert.ok(profileSelect && profileNew && cycleToggle && cycleName && cycleSave && cycleList);

    click(cycleToggle);
    cycleName.value = "Civil cycle";
    click(cycleSave);
    assert.match(cycleList.textContent || "", /civil cycle/i);

    const baseProfileId = profileSelect.value;
    const promptBefore = window.prompt;
    window.prompt = () => "Religious Calendar";
    click(profileNew);
    window.prompt = promptBefore;

    assert.doesNotMatch(cycleList.textContent || "", /civil cycle/i);
    cycleName.value = "Religious cycle";
    click(cycleSave);
    assert.match(cycleList.textContent || "", /religious cycle/i);

    profileSelect.value = baseProfileId;
    change(profileSelect);
    assert.match(cycleList.textContent || "", /civil cycle/i);
    assert.doesNotMatch(cycleList.textContent || "", /religious cycle/i);
  } finally {
    mount.remove();
    harness.cleanup();
  }
});

test("collapsed section state persists after page re-render", () => {
  const harness = installDomHarness();
  localStorage.clear();

  let mount = createPage();
  try {
    const specialToggle = document.querySelector(
      '.calendar-collapse-toggle[data-collapse-key="special"]',
    );
    assert.ok(specialToggle);
    assert.equal(specialToggle.dataset.state, "collapsed");

    click(specialToggle);
    assert.equal(specialToggle.dataset.state, "expanded");
    assert.equal(specialToggle.getAttribute("aria-expanded"), "true");

    mount.remove();
    mount = createPage();

    const specialToggleAfter = document.querySelector(
      '.calendar-collapse-toggle[data-collapse-key="special"]',
    );
    assert.ok(specialToggleAfter);
    assert.equal(specialToggleAfter.dataset.state, "expanded");
    assert.equal(specialToggleAfter.getAttribute("aria-expanded"), "true");
  } finally {
    mount.remove();
    harness.cleanup();
  }
});

test("calendar JSON round-trip preserves work cycle rules on active profile", async () => {
  const harness = installDomHarness();
  localStorage.clear();
  const mount = createPage();
  try {
    const cycleToggle = document.querySelector(
      '.calendar-collapse-toggle[data-collapse-key="cycles"]',
    );
    const cycleName = document.querySelector("#calCycleName");
    const cycleWeekend = document.querySelector("#calCycleWeekendRule");
    const cycleSave = document.querySelector("#calCycleSave");
    const loadCurrent = document.querySelector("#calJsonLoadCurrent");
    const jsonText = document.querySelector("#calJsonText");
    const importApply = document.querySelector("#calImportApply");
    const cycleList = document.querySelector("#calCycleList");
    assert.ok(
      cycleToggle &&
        cycleName &&
        cycleWeekend &&
        cycleSave &&
        loadCurrent &&
        jsonText &&
        importApply &&
        cycleList,
    );

    click(cycleToggle);
    cycleName.value = "Work week";
    cycleWeekend.value = "next-monday";
    change(cycleWeekend);
    const weekendDayInputs = [
      ...document.querySelectorAll("#calWeekendDays input[data-cal-weekend-day]"),
    ];
    assert.ok(weekendDayInputs.length > 0);
    weekendDayInputs.forEach((input) => {
      input.checked = false;
    });
    if (weekendDayInputs[1]) {
      weekendDayInputs[1].checked = true;
      change(weekendDayInputs[1]);
    }
    click(cycleSave);
    assert.match(cycleList.textContent || "", /work week/i);

    click(loadCurrent);
    const payload = JSON.parse(jsonText.value);
    const activeId = payload?.calendar?.activeProfileId;
    const profile = Array.isArray(payload?.calendar?.profiles)
      ? payload.calendar.profiles.find((entry) => entry.id === activeId)
      : null;
    assert.ok(profile);
    assert.ok(Array.isArray(profile.ui?.workCycles));
    assert.equal(profile.ui.workCycles.length > 0, true);
    assert.equal(profile.ui.workCycles[0]?.name, "Work week");
    assert.equal(profile.ui.workWeekendRule, "next-monday");
    assert.deepEqual(profile.ui.weekendDayIndexes, [1]);

    profile.ui.workCycles.push({
      id: "cycle-imported",
      name: "Imported cycle",
      mode: "interval",
      startAbsoluteDay: 0,
      intervalDays: 7,
      intervalLabel: "Market",
      intervalShort: "M",
    });
    jsonText.value = JSON.stringify(payload, null, 2);
    click(importApply);
    await tick();

    assert.match(cycleList.textContent || "", /imported cycle/i);
  } finally {
    mount.remove();
    harness.cleanup();
  }
});

/* ── QA: Phase 9 round-trip tests ────────────────────────────────── */

test("holiday rules survive JSON round-trip with anchors and observance", async () => {
  const harness = installDomHarness();
  localStorage.clear();
  const mount = createPage();
  try {
    const specialToggle = document.querySelector(
      '.calendar-collapse-toggle[data-collapse-key="special"]',
    );
    const name = document.querySelector("#calHolidayName");
    const dayOfMonth = document.querySelector("#calHolidayDayOfMonth");
    const save = document.querySelector("#calHolidaySave");
    const advanced = document.querySelector("#calHolidayAdvancedToggle");
    const priority = document.querySelector("#calHolidayPriority");
    const duration = document.querySelector("#calHolidayDuration");
    const loadCurrent = document.querySelector("#calJsonLoadCurrent");
    const jsonText = document.querySelector("#calJsonText");
    const importApply = document.querySelector("#calImportApply");
    const list = document.querySelector("#calHolidayList");
    assert.ok(
      specialToggle &&
        name &&
        dayOfMonth &&
        save &&
        advanced &&
        priority &&
        duration &&
        loadCurrent &&
        jsonText &&
        importApply &&
        list,
    );

    click(specialToggle);
    advanced.checked = true;
    change(advanced);
    name.value = "Roundtrip Day";
    dayOfMonth.value = "12";
    priority.value = "5";
    duration.value = "3";
    click(save);

    assert.match(list.textContent || "", /roundtrip day/i);

    // Export
    click(loadCurrent);
    const payload = JSON.parse(jsonText.value);
    const activeId = payload?.calendar?.activeProfileId;
    const profile = Array.isArray(payload?.calendar?.profiles)
      ? payload.calendar.profiles.find((entry) => entry.id === activeId)
      : null;
    assert.ok(profile);
    const holidays = profile.ui?.holidays || [];
    const roundtrip = holidays.find((h) => h.name === "Roundtrip Day");
    assert.ok(roundtrip, "Holiday should exist in exported JSON");
    assert.equal(roundtrip.priority, 5);
    assert.equal(roundtrip.durationDays, 3);

    // Re-import
    jsonText.value = JSON.stringify(payload, null, 2);
    click(importApply);
    await tick();

    assert.match(list.textContent || "", /roundtrip day/i);
  } finally {
    mount.remove();
    harness.cleanup();
  }
});

test("leap rules survive JSON round-trip", async () => {
  const harness = installDomHarness();
  localStorage.clear();
  const mount = createPage();
  try {
    const leapToggle = document.querySelector(
      '.calendar-collapse-toggle[data-collapse-key="leap"]',
    );
    const leapName = document.querySelector("#calLeapName");
    const leapCycle = document.querySelector("#calLeapCycle");
    const leapDelta = document.querySelector("#calLeapDelta");
    const leapSave = document.querySelector("#calLeapAdd");
    const leapList = document.querySelector("#calLeapList");
    const loadCurrent = document.querySelector("#calJsonLoadCurrent");
    const jsonText = document.querySelector("#calJsonText");
    const importApply = document.querySelector("#calImportApply");
    assert.ok(
      leapToggle &&
        leapName &&
        leapCycle &&
        leapDelta &&
        leapSave &&
        leapList &&
        loadCurrent &&
        jsonText &&
        importApply,
    );

    click(leapToggle);
    leapName.value = "Quadrennial leap";
    leapCycle.value = "4";
    leapDelta.value = "1";
    click(leapSave);

    assert.match(leapList.textContent || "", /quadrennial leap/i);

    // Export
    click(loadCurrent);
    const payload = JSON.parse(jsonText.value);
    const activeId = payload?.calendar?.activeProfileId;
    const profile = Array.isArray(payload?.calendar?.profiles)
      ? payload.calendar.profiles.find((entry) => entry.id === activeId)
      : null;
    assert.ok(profile);
    const leapRules = profile.ui?.leapRules || [];
    const rule = leapRules.find((r) => r.name === "Quadrennial leap");
    assert.ok(rule, "Leap rule should exist in exported JSON");
    assert.equal(rule.cycleYears, 4);
    assert.equal(rule.dayDelta, 1);

    // Re-import
    jsonText.value = JSON.stringify(payload, null, 2);
    click(importApply);
    await tick();

    assert.match(leapList.textContent || "", /quadrennial leap/i);
  } finally {
    mount.remove();
    harness.cleanup();
  }
});
