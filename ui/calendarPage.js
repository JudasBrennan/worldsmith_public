import { calcCalendarModel } from "../engine/calendar.js";
import { fmt } from "../engine/utils.js";
import {
  describeMoonPhase,
  getCalendarBasisMetrics,
  getMonthLengthsForYear,
  getYearStartDayIndex,
  normalizeLeapRules,
  normalizeMonthLengthOverrides,
  normalizeNameList,
} from "../engine/usableCalendar.js";
import { bindNumberAndSlider } from "./bind.js";
import {
  CALENDAR_COLLAPSIBLE_PANELS,
  CALENDAR_PHASES as PHASES,
  CALENDAR_TUTORIAL_STEPS as TUTORIAL_STEPS,
  HOLIDAY_ALGORITHMS,
  HOLIDAY_ANCHOR_TYPES,
  HOLIDAY_CATEGORIES,
  HOLIDAY_CATEGORY_SET,
  HOLIDAY_CONFLICT_RULES,
  HOLIDAY_CONFLICT_SCOPES,
  HOLIDAY_RELATIVE_MARKERS,
  HOLIDAY_RELATIVE_TYPES,
  HOLIDAY_RESOLVE_MODES,
  HOLIDAY_SCAN_MONTH_RADIUS,
  HOLIDAY_WEEKEND_RULES,
  MOON_COLORS,
  OCCURRENCES,
  RECURRENCES,
  SEASON_MARKER_DEFS,
  WORK_CYCLE_MODES,
} from "./calendar/constants.js";
import {
  copyTextToClipboard,
  createCalendarExportEnvelope,
  downloadJsonFile,
  readCalendarCandidate,
  utcStampCompact,
} from "./calendar/calendarIo.js";
import {
  analyzeHolidayRelativeIssues,
  astronomyMarkerAggregateKey,
  astronomyMarkerLabel,
  astroIconClass,
  clonePlain,
  createCalendarStateStoreBindings,
  cycleKindClass,
  cycleMarkerTip,
  cycleRuleSummary,
  evaluateWorkCyclesForDay,
  findById,
  formatDisplayedYear,
  fromLinearMonthOrdinal,
  holidayCategoryLabel,
  holidayCategoryOptionsHtml,
  holidayColorClass,
  holidayColorOptionsHtml,
  holidayFilterControlsHtml,
  holidayRelativeKeyLabel,
  intListText,
  moonsForPlanet,
  monthLengthOverridesText,
  namesText,
  normEraRules,
  normFestivalRule,
  normFestivalRules,
  normHolidayRule,
  normHolidayRules,
  normalizeAstronomySettings,
  normalizeHolidayCategory,
  normalizeHolidayCategoryFilters,
  normalizeHolidayColorTag,
  normalizeIcsIncludes,
  normalizeIsoDate,
  normalizeWeekendDayIndexes,
  normalizeWeekendRule,
  normWorkCycleRule,
  normWorkCycleRules,
  moonColorClass,
  parseIntList,
  parseStringList,
  phaseClass,
  pickMoonStateForHoliday,
  recursInMonth,
  sanitizeCycleShort,
  splitMonthLengths,
  splitNames,
  toLinearMonthOrdinal,
  uniqueSortedNumbers,
  uniqIds,
  weekdayOccurrence,
} from "./calendar/stateModel.js";
import { createElement, replaceChildren, replaceSelectOptions } from "./domHelpers.js";
import { createTutorial } from "./tutorial.js";
import { attachTooltips, tipIcon } from "./tooltip.js";
import {
  getSelectedMoon,
  getSelectedPlanet,
  getStarOverrides,
  listMoons,
  listPlanets,
  loadWorld,
  updateWorld,
} from "./store.js";

const TIPS = {
  "Calendar name": "Name shown on this calendar and carried in calendar-only export/import.",
  "Calendar profile":
    "Switch between multiple calendar systems in this world (for example: civil, religious, or regional).",
  "New profile": "Create a new calendar profile.",
  "Duplicate profile": "Create a copy of the current calendar profile.",
  "Delete profile": "Delete the current calendar profile.",
  "Source planet": "Planet used to derive orbital year length and day-length context.",
  "Primary moon": "Main moon used for lunar cycle calculations and full/new moon summaries.",
  "Extra moon":
    "Additional moon shown in day and detailed views; does not replace the primary moon.",
  "Planet orbital period": "Derived from the selected planet and star. Read-only.",
  "Moon orbital period": "Primary moon synodic period (new moon to new moon). Read-only.",
  "Planet rotation": "Length of one planetary day. Derived from the selected planet and read-only.",
  "Decimal places":
    "When enabled, rounds derived orbital data (planet period, moon period, rotation)" +
    " to the selected number of decimal places before feeding into the calendar model." +
    " This affects month lengths and leap cycles." +
    " 6 = full engine precision; 0 = whole numbers only." +
    " When disabled, raw engine values pass through unmodified.",
  "Months per year":
    "How many months the calendar splits the year into. Defaults to lunar-cycle-based value.",
  "Days per month":
    "How many days each month contains. Defaults to the orbital-derived value for the active basis.",
  "Days per week": "How many days each week contains. Defaults to one quarter of days per month.",
  Basis: "Select which model drives month/week partitioning.",
  Year: "Calendar year shown in Month View.",
  Month: "Month shown in Month View.",
  "Start day of year": "Weekday assigned to day 1 of year 1.",
  "Week starts on": "Controls which weekday is shown as the first column.",
  "Moon epoch offset": "Phase timeline offset in days. Use to align moon phases with your setting.",
  "Day names": "Custom day names, one per line. Missing entries are auto-filled.",
  "Week names": "Custom week labels, one per line. Missing entries are auto-filled.",
  "Month names": "Custom month names, one per line. Missing entries are auto-filled.",
  "Month lengths":
    "Enable this to set a custom day count for each month, one per line. " +
    "Blank or missing lines fall back to the base Days per month value. " +
    "Leap rules still add or remove days on top of these overrides. " +
    "Uncheck to revert to uniform month lengths without losing your entries.",
  "Year display mode":
    "Choose how years are shown: custom number, named eras, or pre/post calendar eras (for example BCE/CE).",
  "Pre-calendar schema":
    "Pre/Post era formatting (for example BCE/CE). Traditional BCE/CE has no year zero.",
  "Year offset":
    "Added to displayed year number. Example: offset +999 makes Year 1 display as Year 1000.",
  "Year prefix":
    "Optional text prepended to displayed year (for example: CY, AG, or Imperial Year).",
  "Year suffix": "Optional text appended to displayed year (for example: DR, AE, or CE).",
  "Post-calendar start year":
    "Calendar year where the post-era label begins. Years before this are shown as pre-era years.",
  "Post-era label":
    "Suffix for years at/after the post-calendar start year (for example CE, AD, AE).",
  "Pre-era label":
    "Suffix for years before the post-calendar start year (for example BCE, BC, BAE).",
  "Use year zero":
    "When enabled, the boundary year is shown as year 0 of the post era (astronomical numbering).",
  "Era label": "Name of an era (for example: First Age).",
  "Era start year": "Base calendar year where this era begins.",
  "Era list": "Configured era labels, applied by highest start year <= current year.",
  "Add era": "Add this era rule to the era list.",
  "Holiday name": "Display name shown on calendar days and event lists.",
  Recurrence: "How often this holiday repeats over time.",
  Attributes:
    "Choose matching rules for this holiday. Multiple checks mean all selected rules must match the same date.",
  "Start month": "First month where this holiday can occur.",
  "Day of month": "Matches a specific calendar day number in the month.",
  "Use relative trigger":
    "Enable rule anchoring relative to moon phases, astronomy markers, or another holiday.",
  "Relative trigger type": "Choose what this holiday is relative to.",
  "Relative offset days":
    "Negative values place the holiday before the trigger; positive values place it after.",
  "Relative marker": "Astronomy marker to anchor this holiday rule.",
  "Relative holiday": "Holiday used as the anchor for this holiday rule.",
  "Relative moon slot": "Moon used for moon-phase relative triggers.",
  "Relative moon phase": "Moon phase used for moon-phase relative triggers.",
  "Weekday rule": "Matches by weekday position (for example: first Day 2, or last Day 5).",
  Occurrence: "Used with Weekday rule to choose any/1st/2nd/3rd/4th/last weekday occurrence.",
  "Moon slot": "Select which displayed moon to test when Moon phase matching is enabled.",
  "Moon phase": "Required moon phase when Moon phase matching is enabled.",
  Holidays: "Configured holiday rules. Edit or delete existing entries here.",
  "Leap rules": "Rules that add or remove days from a target month on repeating year cycles.",
  "Leap rule name": "Label for this leap rule.",
  "Leap cycle": "Repeat interval in years.",
  "Leap start year": "First year where this leap rule applies.",
  "Leap month": "Month affected by this leap rule.",
  "Leap day delta": "Days added (+) or removed (-) when the rule applies.",
  "Leap list": "Configured leap rules. Delete to remove a rule.",
  "Suggest leap rule":
    "Calculate a recommended ±1-day leap cycle from the source planet orbital year and add it automatically.",
  "Apply inputs": "Apply current input selections and regenerate the calendar context.",
  "Use selected objects":
    "Pull currently selected planet/moon from other pages into this calendar setup.",
  "Apply names": "Apply custom day/week/month naming lists to the calendar.",
  "Reset names": "Clear custom naming lists and restore automatic default names.",
  "Add holiday": "Create a new holiday rule, or save changes while editing.",
  "Cancel holiday edit": "Exit holiday edit mode without keeping form changes.",
  "Add leap rule": "Add this leap-rule row to the active leap rules list.",
  "Previous month": "Move to the previous month (crosses year boundary when needed).",
  "Next month": "Move to the next month (crosses year boundary when needed).",
  Tutorials: "Step-by-step guide to setting up your calendar.",
  "Open detailed view": "Open the full detailed calendar view with moon markers.",
  "Close detailed view": "Close the detailed calendar overlay.",
  "Month summary": "Current month, year, and month length.",
  "Moon summary chips": "Quick list of primary moon full/new moon days and active moon context.",
  "Simple calendar": "Compact month grid. Click a day to inspect details.",
  "Selected day": "Detailed breakdown for the currently selected day.",
  "Moon key": "Color key for moons shown in this calendar.",
  "Compact stats": "Quick month statistics.",
  "Month events": "Holiday occurrences detected in this month.",
  "Detailed calendar": "Full calendar grid with week rows, moon markers, and holiday markers.",
  "Holiday year": "Used by One-off holidays. Ignored for repeating recurrences.",
  "Holiday duration":
    "Number of consecutive days this holiday lasts from its start day (within the month).",
  "Holiday priority":
    "Higher priority wins when an override rule is present. Sort order is priority, then name, then id.",
  "Holiday merge mode":
    "Merge keeps this holiday alongside others. Override suppresses lower-priority matches on the same day.",
  "Holiday advanced toggle":
    "Show advanced holiday rule options including anchor type, algorithmic anchors, observance shifts, and conflict scope.",
  "Holiday anchor type":
    "Primary date anchor for this holiday rule (fixed date, weekday pattern, moon phase, marker, linked holiday, or algorithmic).",
  "Holiday algorithm": "Algorithmic anchor. Use this for movable feasts such as Gregorian Easter.",
  "Holiday anchor offset":
    "Shift from the selected anchor in days. Negative values are before, positive values are after.",
  "Holiday weekend rule":
    "Legacy per-holiday weekend rule. Weekend handling is now configured in Work/Rest Cycles.",
  "Holiday conflict rule": "How to resolve collisions with other holidays on the same day.",
  "Holiday max shift":
    "Maximum number of days this rule can shift when conflict or weekend adjustments apply.",
  "Holiday stay in month":
    "When enabled, observance shifts are constrained to stay inside the same month.",
  "Holiday conflict scope": "Choose which holidays are considered when applying conflict handling.",
  "Holiday conflict categories":
    "Comma-separated categories used when conflict scope is set to same category.",
  "Holiday conflict ids":
    "Comma-separated holiday IDs used when conflict scope is set to specific holidays.",
  "Holiday exception years":
    "Comma-separated years where this holiday is skipped (for example: 2, 5, 19).",
  "Holiday exception months":
    "Comma-separated month numbers where this holiday is skipped (1-based month numbers).",
  "Holiday exception days": "Comma-separated day-of-month values where this holiday is skipped.",
  "Holiday category": "Classify this holiday so users can filter by category in month views.",
  "Holiday colour": "Visual colour tag used for this holiday marker in calendar views.",
  "Holiday filters": "Show or hide holiday categories in month and detailed calendar displays.",
  "Holiday continuation":
    "Shows whether a holiday segment continues from the previous day and/or into the next day.",
  "Special Days section":
    "Holidays are recurring or one-off observances tied to calendar dates, weekdays, moon phases, or combinations of those rules.",
  "Calendar Designer section":
    "Define the core structure and naming of the calendar: basis, current year/month, weekday flow, naming lists, and era formatting.",
  "Calendar Data section":
    "Import/export calendar settings only. Use this to move calendar rules between worlds without changing star/system/planet/moon data.",
  "Output & Utility section":
    "Generate printable outputs, export ICS files for external apps, and control optional astronomy markers shown on the calendar.",
  "Astronomy markers": "Enable optional astronomy markers in month views and exports.",
  "Season markers":
    "Mark quarter-year seasonal anchors: vernal equinox, summer solstice, autumn equinox, winter solstice.",
  "Season bands":
    "Show a seasonal band overlay in month headers that marks where the current month falls in the orbital year.",
  "Eclipse markers":
    "Approximate eclipse windows based on eclipse-season cadence and the phases of selected moons.",
  "PDF month export":
    "Open a clean printable current-month layout. Use browser print to save as PDF.",
  "PDF year export": "Open a clean printable full-year layout. Use browser print to save as PDF.",
  "ICS anchor date": "Gregorian anchor date for Year 1, Month 1, Day 1 when exporting ICS events.",
  "ICS include holidays": "Include holiday events in ICS export.",
  "ICS include festivals": "Include festival/intercalary events in ICS export.",
  "ICS include markers": "Include astronomy marker events in ICS export.",
  "ICS month export":
    "Export an ICS file for the currently shown month using the configured Gregorian anchor date.",
  "ICS year export":
    "Export an ICS file for the currently shown year using the configured Gregorian anchor date.",
  "Festival Days section":
    "Festival/intercalary rules add extra named days. They can either participate in weekday flow or sit outside weekday flow.",
  "Leap Years section":
    "Leap rules add or remove days in specific months on repeating year cycles to keep your calendar aligned.",
  "Work/Rest Cycles section":
    "Define repeating schedules such as work/rest rotations and interval markers (for example: market every 5 days), and set global weekend handling for holidays.",
  "Weekend handling":
    "Global weekend observance shift used by holiday rules. Configure once here to apply weekend policy across all holidays.",
  "Weekend days": "Choose which weekdays are treated as weekend days for weekend handling rules.",
  "Cycle rule name": "Display name for this cycle rule.",
  "Cycle rule mode": "Choose between a duty on/off rotation or a fixed interval marker.",
  "Cycle start day":
    "Absolute day index where this rule starts counting (0 = Year 1, Month 1, Day 1).",
  "Cycle on days": "Number of consecutive active days in a duty cycle.",
  "Cycle off days": "Number of consecutive rest days in a duty cycle.",
  "Cycle interval days": "Trigger marker every N days.",
  "Cycle active label": "Text used for active duty days.",
  "Cycle rest label": "Text used for rest days.",
  "Cycle marker label": "Text used when an interval marker triggers.",
  "Cycle active short": "Short marker (1-3 chars) for active duty days.",
  "Cycle rest short": "Short marker (1-3 chars) for rest days.",
  "Cycle marker short": "Short marker (1-3 chars) for interval trigger days.",
  "Add cycle rule": "Create a new cycle rule, or save changes while editing.",
  "Cancel cycle edit": "Exit cycle edit mode without keeping form changes.",
  "Cycle list": "Configured work/rest cycle rules.",
  "Festival days":
    "Intercalary/festival days can be added as in-week-flow days or outside weekday flow.",
  "Festival name": "Display name for this festival/intercalary day rule.",
  "Festival recurrence": "How often this festival repeats over time.",
  "Festival start month": "First month where this festival can occur.",
  "Festival year": "Used by One-off festival rules. Ignored for repeating recurrences.",
  "Festival after day":
    "Insert this festival after the selected day number (0 means before Day 1).",
  "Festival duration": "Number of consecutive festival days to add.",
  "Festival outside week":
    "When enabled, festival days are listed separately and do not consume weekday slots in the grid.",
  "Add festival": "Create a new festival rule, or save changes while editing.",
  "Cancel festival edit": "Exit festival edit mode without keeping form changes.",
  "Festival list": "Configured festival/intercalary day rules.",
  "Calendar JSON":
    "Calendar-only export/import. This affects calendar settings only and does not change star/system/planet/moon data.",
  "Download calendar JSON": "Download only calendar settings as a JSON file.",
  "Copy calendar JSON": "Copy only calendar settings JSON to clipboard.",
  "Import calendar JSON file": "Import calendar settings from a JSON file.",
  "Apply pasted calendar JSON": "Validate and apply calendar JSON from the text box below.",
  "Date converter":
    "Convert between absolute day index and calendar date, then jump directly to that day.",
  "Absolute day": "Zero-based day index from the start of Year 1. Day 0 is Year 1, Month 1, Day 1.",
  "Jump absolute day": "Jump Month View to the date represented by this absolute day.",
  "Jump date": "Jump Month View to the specified year, month, and day.",
};

const {
  defaultState,
  deriveMoonSynodicDays,
  derivePlanetPeriodDays,
  normalizeSingleProfile,
  persistState,
  readState,
} = createCalendarStateStoreBindings({
  getSelectedMoon,
  getSelectedPlanet,
  getStarOverrides,
  listMoons,
  listPlanets,
  updateWorld,
});

const N = (v, f = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : f;
};
const I = (v, f = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : f;
};
const clampI = (v, min, max) => Math.max(min, Math.min(max, I(v, min)));
const mod = (v, b) => (b > 0 ? ((v % b) + b) % b : 0);
const esc = (s) =>
  String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

function tupleOptions(entries) {
  return (Array.isArray(entries) ? entries : []).map(([value, label]) => ({ value, label }));
}

function indexedLabelOptions(labels) {
  return (Array.isArray(labels) ? labels : []).map((label, index) => ({ value: index, label }));
}

function bodyOptions(items) {
  return (Array.isArray(items) ? items : []).map((item) => ({
    value: item?.id || "",
    label: item?.name || item?.inputs?.name || item?.id || "",
  }));
}

function moonSlotOptions(moons) {
  return (Array.isArray(moons) ? moons : []).map((moon, index) => ({
    value: index,
    label: moon?.name || "",
    dataset: { moonId: moon?.id || "" },
  }));
}

function holidayReferenceOptions(holidays) {
  return [
    { value: "", label: "Select holiday" },
    ...(Array.isArray(holidays) ? holidays : []).map((holiday) => ({
      value: holiday?.id || "",
      label: holiday?.name || "",
    })),
  ];
}

function replaceWeekendDayOptions(node, dayNames, selectedIndexes) {
  const selected = new Set(Array.isArray(selectedIndexes) ? selectedIndexes : []);
  return replaceChildren(
    node,
    (Array.isArray(dayNames) ? dayNames : []).map((dayName, index) =>
      createElement("label", { className: "calendar-holiday-attr" }, [
        createElement("input", {
          attrs: { type: "checkbox" },
          dataset: { calWeekendDay: index },
          checked: selected.has(index),
        }),
        dayName,
      ]),
    ),
  );
}

function tipIconNode(text) {
  if (!text) return null;
  return createElement("span", {
    className: "tip-icon",
    attrs: { tabindex: "0", role: "note", "aria-label": "Info" },
    dataset: { tip: text },
    text: "i",
  });
}

function hintNode(text) {
  return createElement("div", { className: "hint", text });
}

function interleaveNodes(items, separator = ", ") {
  const filtered = (Array.isArray(items) ? items : []).filter(Boolean);
  if (!filtered.length) return ["None"];
  return filtered.flatMap((item, index) => (index ? [separator, item] : [item]));
}

function actionButton(label, dataset, className = "small") {
  return createElement("button", { className, attrs: { type: "button" }, dataset, text: label });
}

function calendarItemRow({ nameChildren, hint, actions = [], isEditing = false }) {
  return createElement("div", { className: `calendar-item-row${isEditing ? " is-editing" : ""}` }, [
    createElement("div", { className: "calendar-item-row__main" }, [
      createElement(
        "div",
        { className: "calendar-item-row__name" },
        Array.isArray(nameChildren) ? nameChildren : [nameChildren],
      ),
      hintNode(hint),
    ]),
    createElement("div", { className: "calendar-item-row__actions" }, actions),
  ]);
}

function moonIconNode(moonState, idx) {
  return createElement("span", {
    className: `calendar-moon-icon ${phaseClass(moonState?.phase?.phaseShort)} ${moonColorClass(idx)}`,
    attrs: { "aria-hidden": "true" },
  });
}

function astroIconNode(marker) {
  const moonSourceIndex = Number.isFinite(Number(marker?.sourceMoonIndex))
    ? clampI(Number(marker.sourceMoonIndex), 0, MOON_COLORS.length - 1)
    : null;
  return createElement(
    "span",
    { className: "calendar-astro-marker", attrs: { "aria-hidden": "true" } },
    [
      createElement("span", {
        className: `calendar-astro-icon ${astroIconClass(marker?.key)}`,
        attrs: { "aria-hidden": "true" },
      }),
      moonSourceIndex == null
        ? null
        : createElement("span", {
            className: `calendar-astro-source ${moonColorClass(moonSourceIndex)}`,
            attrs: { "aria-hidden": "true" },
          }),
    ],
  );
}

function cycleIconNode(cycle) {
  const short = String(cycle?.short || "C")
    .toUpperCase()
    .slice(0, 3);
  return createElement("span", {
    className: `calendar-cycle-marker ${cycleKindClass(cycle)}`,
    attrs: { "aria-hidden": "true" },
    dataset: { tip: cycleMarkerTip(cycle) },
    text: short,
  });
}

function selectedDayLine(label, children, className = "calendar-selected-day__line") {
  return createElement("div", { className }, [
    createElement("b", { text: `${label}:` }),
    " ",
    ...(Array.isArray(children) ? children : [children]),
  ]);
}

function renderListContent(node, items, emptyText) {
  return replaceChildren(node, items.length ? items : [hintNode(emptyText)]);
}

function renderTraceTable(headings, rows) {
  return createElement("table", { className: "calendar-rule-trace__table" }, [
    createElement(
      "thead",
      {},
      createElement(
        "tr",
        {},
        headings.map((heading) => createElement("th", { text: heading })),
      ),
    ),
    createElement(
      "tbody",
      {},
      rows.map((row) =>
        createElement(
          "tr",
          { className: row.className },
          row.cells.map((cell) =>
            createElement(
              "td",
              {},
              Array.isArray(cell) ? cell : [cell == null ? "" : String(cell)],
            ),
          ),
        ),
      ),
    ),
  ]);
}

function buildTraceNode(trace) {
  if (!trace) return null;
  const r = trace.raw;
  const hs = trace.holidays;
  const fs = trace.festivals;
  const cs = trace.workCycles;
  if (!hs.length && !fs.length && !cs.length) return null;

  const rawChildren = [
    createElement("b", { text: "Absolute day:" }),
    ` ${r.absoluteDay} | `,
    createElement("b", { text: "Weekday:" }),
    ` ${r.weekdayName} (${r.weekdayIndex})${r.isWeekend ? " [weekend]" : ""}`,
  ];
  if (r.moonPhases.length) {
    rawChildren.push(
      createElement("br"),
      createElement("b", { text: "Moon:" }),
      ` ${r.moonPhases.map((m) => `${m.name} ${m.phaseShort} (${fmt(m.illumination, 1)}%)`).join("; ")}`,
    );
  }
  if (r.leapRulesActive.length) {
    rawChildren.push(
      createElement("br"),
      createElement("b", { text: "Leap rules active:" }),
      ` ${r.leapRulesActive
        .map((l) => `${l.name} (month ${l.month}, ${l.delta > 0 ? "+" : ""}${l.delta}d)`)
        .join("; ")}`,
    );
  }

  const sections = [];
  if (hs.length) {
    sections.push(
      createElement("div", { className: "calendar-rule-trace__section" }, [
        createElement("b", { text: "Holidays" }),
        ` (${hs.length} rules)`,
        renderTraceTable(
          ["", "Rule", "Anchor", "Pri", "Reason"],
          hs.map((holiday) => ({
            className: holiday.matched
              ? "calendar-rule-trace__row--matched"
              : "calendar-rule-trace__row--missed",
            cells: [
              holiday.matched ? "\u2705" : "\u2014",
              holiday.name,
              holiday.anchorType,
              String(holiday.priority),
              holiday.reason,
            ],
          })),
        ),
      ]),
    );
  }
  if (fs.length) {
    sections.push(
      createElement("div", { className: "calendar-rule-trace__section" }, [
        createElement("b", { text: "Festivals" }),
        ` (${fs.length} rules)`,
        renderTraceTable(
          ["", "Rule", "Reason"],
          fs.map((festival) => ({
            className: festival.matched
              ? "calendar-rule-trace__row--matched"
              : "calendar-rule-trace__row--missed",
            cells: [festival.matched ? "\u2705" : "\u2014", festival.name, festival.reason],
          })),
        ),
      ]),
    );
  }
  if (cs.length) {
    sections.push(
      createElement("div", { className: "calendar-rule-trace__section" }, [
        createElement("b", { text: "Work Cycles" }),
        ` (${cs.length} rules)`,
        renderTraceTable(
          ["", "Rule", "Mode", "Reason"],
          cs.map((cycle) => ({
            className: cycle.matched
              ? "calendar-rule-trace__row--matched"
              : "calendar-rule-trace__row--missed",
            cells: [cycle.matched ? "\u2705" : "\u2014", cycle.name, cycle.mode, cycle.reason],
          })),
        ),
      ]),
    );
  }

  return createElement("details", { className: "calendar-rule-trace" }, [
    createElement("summary", { text: "Rule trace" }),
    createElement("div", { className: "calendar-rule-trace__raw" }, rawChildren),
    sections,
    actionButton("Copy to clipboard", {}, "calendar-rule-trace__copy small"),
  ]);
}

function dayMatchesHolidayBaseAttrs(holiday, dayCtx) {
  const attrs =
    holiday?.attrs && typeof holiday.attrs === "object"
      ? {
          useDate: !!holiday.attrs.useDate,
          useWeekday: !!holiday.attrs.useWeekday,
          useMoonPhase: !!holiday.attrs.useMoonPhase,
        }
      : { useDate: true, useWeekday: false, useMoonPhase: false };
  if (!attrs.useDate && !attrs.useWeekday && !attrs.useMoonPhase) attrs.useDate = true;

  if (attrs.useDate) {
    const targetDay = clampI(holiday?.dayOfMonth ?? 1, 1, dayCtx.monthLength);
    if (dayCtx.dayNumber !== targetDay) return false;
  }

  if (attrs.useWeekday) {
    const weekday = clampI(holiday?.weekday ?? 0, 0, dayCtx.daysPerWeek - 1);
    if (dayCtx.weekdayIndex !== weekday) return false;
    if (holiday?.occurrence && holiday.occurrence !== "any") {
      const occ = weekdayOccurrence(
        dayCtx.dayNumber,
        dayCtx.monthLength,
        dayCtx.monthStartWeekday,
        weekday,
        dayCtx.daysPerWeek,
      );
      if (holiday.occurrence === "last") {
        if (!occ.isLast) return false;
      } else if (occ.nth !== clampI(holiday.occurrence, 1, 8)) {
        return false;
      }
    }
  }

  if (attrs.useMoonPhase) {
    const moon = pickMoonStateForHoliday(holiday, dayCtx.moonStates, { relative: false });
    if (!moon) return false;
    if ((moon.phase?.phaseShort || "") !== String(holiday?.moonPhase || "F")) return false;
  }

  return true;
}

function mergeHolidayDayMatches(matches) {
  const byHolidayId = new Map();
  for (const match of matches || []) {
    const holiday = match?.holiday;
    if (!holiday) continue;
    const key = String(holiday.id || "");
    if (!key) continue;
    const existing = byHolidayId.get(key);
    if (!existing) {
      byHolidayId.set(key, {
        holiday,
        startAbs: I(match.startAbs, 0),
        endAbs: I(match.endAbs, 0),
      });
      continue;
    }
    existing.startAbs = Math.min(existing.startAbs, I(match.startAbs, existing.startAbs));
    existing.endAbs = Math.max(existing.endAbs, I(match.endAbs, existing.endAbs));
  }
  return Array.from(byHolidayId.values());
}

function festivalAppliesInMonth(festival, year, monthIndex, monthsPerYear) {
  if (!recursInMonth(festival, year, monthIndex, monthsPerYear)) return false;
  if ((festival.exceptYears || []).includes(Math.max(1, I(year, 1)))) return false;
  if ((festival.exceptMonths || []).includes(clampI(monthIndex, 0, 1000) + 1)) return false;
  return true;
}

function buildFestivalBuckets(festivals, year, monthIndex, monthLength, monthsPerYear) {
  const inFlowByAfterDay = new Map();
  const outsideWeekFlow = [];
  const monthFestivalHits = new Map();

  for (const festival of festivals || []) {
    if (!festivalAppliesInMonth(festival, year, monthIndex, monthsPerYear)) continue;
    const startAfter = clampI(festival.afterDay, 0, monthLength);
    const duration = Math.max(1, I(festival.durationDays, 1));
    let hitCount = 0;
    for (let i = 0; i < duration; i++) {
      const rawAfter = startAfter + i;
      const afterDay = clampI(rawAfter, 0, monthLength);
      const eventDayNumber = Math.max(1, afterDay);
      if ((festival.exceptDays || []).includes(eventDayNumber)) continue;
      const entry = {
        ...festival,
        key: `${festival.id}-${i + 1}`,
        segment: i + 1,
        segmentCount: duration,
        afterDay,
      };
      if (festival.outsideWeekFlow) {
        outsideWeekFlow.push(entry);
      } else {
        if (!inFlowByAfterDay.has(afterDay)) inFlowByAfterDay.set(afterDay, []);
        inFlowByAfterDay.get(afterDay).push(entry);
      }
      hitCount += 1;
    }
    if (hitCount > 0) monthFestivalHits.set(festival.id, hitCount);
  }

  for (const [, list] of inFlowByAfterDay.entries()) {
    list.sort(
      (a, b) =>
        I(a.afterDay, 0) - I(b.afterDay, 0) ||
        String(a.name || "").localeCompare(String(b.name || "")) ||
        String(a.id || "").localeCompare(String(b.id || "")),
    );
  }
  outsideWeekFlow.sort(
    (a, b) =>
      I(a.afterDay, 0) - I(b.afterDay, 0) ||
      String(a.name || "").localeCompare(String(b.name || "")) ||
      String(a.id || "").localeCompare(String(b.id || "")),
  );

  return {
    inFlowByAfterDay,
    outsideWeekFlow,
    festivalsInMonth: Array.from(monthFestivalHits.entries()),
  };
}

function resolveHolidayMatches(matched) {
  const sorted = (Array.isArray(matched) ? matched : [])
    .slice()
    .sort(
      (a, b) =>
        I(b?.priority ?? 0, 0) - I(a?.priority ?? 0, 0) ||
        String(a?.name || "").localeCompare(String(b?.name || "")) ||
        String(a?.id || "").localeCompare(String(b?.id || "")),
    );
  const overrides = sorted.filter((h) => String(h?.mergeMode || "merge") === "override");
  if (overrides.length) return [overrides[0]];
  return sorted;
}

function buildAstronomyMarkers(ctx) {
  const settings = normalizeAstronomySettings(ctx?.settings);
  if (!settings.enabled) return [];
  const out = [];
  const yearLength = Math.max(1, I(ctx?.yearLength, 1));
  const yearDay = Math.max(1, I(ctx?.yearDay, 1));
  const moonStates = Array.isArray(ctx?.moonStates) ? ctx.moonStates : [];

  if (settings.seasons) {
    for (const s of SEASON_MARKER_DEFS) {
      const day = clampI(Math.round(yearLength * s.fraction) + 1, 1, yearLength);
      if (day === yearDay) {
        out.push({
          key: s.key,
          kind: "season",
          name: s.name,
          short: s.short,
          sourceLabel: "Planet year",
        });
      }
    }
  }

  if (settings.eclipses) {
    const cycleDays = 173.31;
    const windowDays = 17;
    const markerOffset = N(ctx?.absoluteDay, 0) + N(ctx?.moonEpochOffsetDays, 0);
    const seasonPos = mod(markerOffset, cycleDays);
    const inSeason = seasonPos <= windowDays || seasonPos >= cycleDays - windowDays;
    if (inSeason) {
      for (let idx = 0; idx < moonStates.length; idx++) {
        const moonState = moonStates[idx] || {};
        const phaseShort = String(moonState?.phase?.phaseShort || "");
        const sourceMoonName = String(moonState?.name || `Moon ${idx + 1}`).trim();
        const sourceMoonId = String(moonState?.id || "").trim();
        const sourceMoonIndex = Number.isFinite(Number(moonState?.moonIndex))
          ? clampI(Number(moonState.moonIndex), 0, MOON_COLORS.length - 1)
          : clampI(idx, 0, MOON_COLORS.length - 1);
        if (phaseShort === "N") {
          out.push({
            key: "solar-eclipse-window",
            kind: "eclipse",
            name: "Solar Eclipse Window",
            short: "SE",
            sourceMoonName,
            sourceMoonId,
            sourceMoonIndex,
          });
        }
        if (phaseShort === "F") {
          out.push({
            key: "lunar-eclipse-window",
            kind: "eclipse",
            name: "Lunar Eclipse Window",
            short: "LE",
            sourceMoonName,
            sourceMoonId,
            sourceMoonIndex,
          });
        }
      }
    }
  }

  return out;
}

function yearDaysForYear(metrics, leapRules, y, monthLengthOverrides) {
  return getMonthLengthsForYear({ metrics, year: y, leapRules, monthLengthOverrides }).reduce(
    (a, b) => a + b,
    0,
  );
}

function daysBeforeYear(metrics, leapRules, year, monthLengthOverrides) {
  let total = 0;
  const y = Math.max(1, I(year, 1));
  if (y <= 1) return 0;
  // Cap iteration to prevent UI freezes
  const cap = Math.min(y, 50001);
  for (let yy = 1; yy < cap; yy++) {
    total += yearDaysForYear(metrics, leapRules, yy, monthLengthOverrides);
  }
  if (cap < y) {
    // Estimate remaining years using last computed year length
    const avg = total / (cap - 1);
    total += Math.round(avg * (y - cap));
  }
  return total;
}

function toAbsoluteDay(metrics, leapRules, year, monthIndex, dayOfMonth, monthLengthOverrides) {
  const safeYear = Math.max(1, I(year, 1));
  const monthsPerYear = Math.max(1, I(metrics?.monthsPerYear, 12));
  const safeMonth = clampI(monthIndex, 0, monthsPerYear - 1);
  const monthLengths = getMonthLengthsForYear({
    metrics,
    year: safeYear,
    leapRules,
    monthLengthOverrides,
  });
  const safeDay = clampI(dayOfMonth, 1, monthLengths[safeMonth] || 1);
  const beforeYear = daysBeforeYear(metrics, leapRules, safeYear, monthLengthOverrides);
  const beforeMonth = monthLengths.slice(0, safeMonth).reduce((a, b) => a + b, 0);
  return beforeYear + beforeMonth + safeDay - 1;
}

function fromAbsoluteDay(metrics, leapRules, absoluteDayInput, monthLengthOverrides) {
  let absoluteDay = Math.max(0, I(absoluteDayInput, 0));

  // Estimate year using average year length to avoid O(n) iteration for large values
  const sampleYear1Days = yearDaysForYear(metrics, leapRules, 1, monthLengthOverrides);
  const avgYearDays = Math.max(1, sampleYear1Days);
  let year = Math.max(1, Math.floor(absoluteDay / avgYearDays));
  // Rewind slightly to ensure we don't overshoot
  year = Math.max(1, year - 2);

  // Subtract all days before estimated year
  if (year > 1) {
    const daysBefore = daysBeforeYear(metrics, leapRules, year, monthLengthOverrides);
    absoluteDay -= daysBefore;
    // If we overshot, go back
    while (absoluteDay < 0 && year > 1) {
      year -= 1;
      absoluteDay += yearDaysForYear(metrics, leapRules, year, monthLengthOverrides);
    }
  }

  while (true) {
    const lengths = getMonthLengthsForYear({ metrics, year, leapRules, monthLengthOverrides });
    const yearDays = lengths.reduce((a, b) => a + b, 0);
    if (absoluteDay < yearDays) {
      let monthIndex = 0;
      let dayCursor = absoluteDay;
      for (let i = 0; i < lengths.length; i++) {
        if (dayCursor < lengths[i]) {
          monthIndex = i;
          break;
        }
        dayCursor -= lengths[i];
      }
      return {
        year,
        monthIndex,
        dayOfMonth: dayCursor + 1,
        absoluteDay: Math.max(0, I(absoluteDayInput, 0)),
      };
    }
    absoluteDay -= yearDays;
    year += 1;
    if (year > 100000) {
      return {
        year: 100000,
        monthIndex: 0,
        dayOfMonth: 1,
        absoluteDay: Math.max(0, I(absoluteDayInput, 0)),
      };
    }
  }
}

function gregorianEasterWesternMonthDay(yearInput) {
  const year = Math.max(1, I(yearInput, 1));
  const a = mod(year, 19);
  const b = Math.floor(year / 100);
  const c = mod(year, 100);
  const d = Math.floor(b / 4);
  const e = mod(b, 4);
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = mod(19 * a + b - d - g + 15, 30);
  const i = Math.floor(c / 4);
  const k = mod(c, 4);
  const l = mod(32 + 2 * e + 2 * i - h - k, 7);
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31); // 3=Mar, 4=Apr
  const day = mod(h + l - 7 * m + 114, 31) + 1;
  return { monthIndex: month - 1, day };
}

function buildMonthModel(params) {
  const {
    metrics,
    year,
    monthIndex,
    firstYearStartDayIndex,
    weekStartDayIndex,
    leapRules,
    monthLengthOverrides,
    dayNames,
    weekNames,
    monthNames,
    moonDefs,
    moonEpochOffsetDays,
    holidays,
    festivals,
    astronomySettings,
    workCycles,
    weekendDayIndexes,
  } = params;
  const safeYear = Math.max(1, I(year, 1));
  const safeMonth = clampI(monthIndex, 0, metrics.monthsPerYear - 1);
  const daysPerWeek = Math.max(1, I(metrics.daysPerWeek, 7));
  const weekStart = mod(I(weekStartDayIndex, 0), daysPerWeek);
  const weekendSet = new Set(normalizeWeekendDayIndexes(weekendDayIndexes, daysPerWeek));
  const monthCoreCache = new Map();

  const getMonthCore = (targetYear, targetMonth) => {
    const yearValue = Math.max(1, I(targetYear, 1));
    const monthValue = clampI(targetMonth, 0, metrics.monthsPerYear - 1);
    const cacheKey = `${yearValue}:${monthValue}`;
    if (monthCoreCache.has(cacheKey)) return monthCoreCache.get(cacheKey);

    const monthLengths = getMonthLengthsForYear({
      metrics,
      year: yearValue,
      leapRules,
      monthLengthOverrides,
    });
    const monthLength = monthLengths[monthValue];
    const yearLength = monthLengths.reduce((sum, days) => sum + days, 0);
    const yearStart = getYearStartDayIndex({
      metrics,
      year: yearValue,
      firstYearStartDayIndex,
      leapRules,
      monthLengthOverrides,
    });
    const daysBeforeMonth = monthLengths.slice(0, monthValue).reduce((sum, days) => sum + days, 0);
    const monthStartWeekday = mod(yearStart + daysBeforeMonth, daysPerWeek);
    const absoluteMonthStart =
      daysBeforeYear(metrics, leapRules, yearValue, monthLengthOverrides) + daysBeforeMonth;
    const days = [];
    for (let dayNumber = 1; dayNumber <= monthLength; dayNumber++) {
      const absoluteDay = absoluteMonthStart + dayNumber - 1;
      const weekdayIndex = mod(monthStartWeekday + dayNumber - 1, daysPerWeek);
      const moonStates = moonDefs.map((moonDef, moonIndex) => ({
        ...moonDef,
        moonIndex,
        phase: describeMoonPhase({
          ageDays: absoluteDay + N(moonEpochOffsetDays, 0),
          synodicDays: moonDef.synodicDays,
        }),
      }));
      const yearDay = daysBeforeMonth + dayNumber;
      const markers = buildAstronomyMarkers({
        settings: astronomySettings,
        yearLength,
        yearDay,
        absoluteDay,
        moonEpochOffsetDays,
        moonStates,
      });
      days.push({
        dayNumber,
        absoluteDay,
        weekdayIndex,
        moonStates,
        markers,
      });
    }
    const core = {
      year: yearValue,
      monthIndex: monthValue,
      monthLength,
      yearLength,
      daysBeforeMonth,
      monthStartWeekday,
      absoluteMonthStart,
      days,
    };
    monthCoreCache.set(cacheKey, core);
    return core;
  };

  const currentCore = getMonthCore(safeYear, safeMonth);
  const monthLength = currentCore.monthLength;
  const monthStartWeekday = currentCore.monthStartWeekday;
  const absoluteMonthStart = currentCore.absoluteMonthStart;
  const absoluteMonthEnd = absoluteMonthStart + monthLength - 1;
  const leadingEmpty = mod(monthStartWeekday - weekStart, daysPerWeek);

  const headers = Array.from(
    { length: daysPerWeek },
    (_, i) => dayNames[mod(weekStart + i, daysPerWeek)],
  );
  const cells = [];
  for (let i = 0; i < leadingEmpty; i++) cells.push(null);

  const fullMoonDays = [];
  const newMoonDays = [];
  const holidayHits = new Map();
  const markerHits = new Map();
  const cycleHits = new Map();
  const holidaysById = new Map((holidays || []).map((holiday) => [String(holiday.id), holiday]));
  const holidayRelativeIssues = analyzeHolidayRelativeIssues(holidays);
  const startDayMemo = new Map();
  const startDayActive = new Set();

  const absoluteDayMetaCache = new Map();
  const getAbsoluteDayMeta = (absoluteDay) => {
    const safeAbsoluteDay = Math.max(0, I(absoluteDay, 0));
    if (absoluteDayMetaCache.has(safeAbsoluteDay)) return absoluteDayMetaCache.get(safeAbsoluteDay);
    const loc = fromAbsoluteDay(metrics, leapRules, safeAbsoluteDay, monthLengthOverrides);
    const core = getMonthCore(loc.year, loc.monthIndex);
    const dayNumber = clampI(loc.dayOfMonth, 1, core.monthLength);
    const dayIndex = dayNumber - 1;
    const weekdayIndex =
      core.days?.[dayIndex]?.weekdayIndex ?? mod(core.monthStartWeekday + dayIndex, daysPerWeek);
    const meta = {
      absoluteDay: safeAbsoluteDay,
      year: loc.year,
      monthIndex: loc.monthIndex,
      dayNumber,
      monthLength: core.monthLength,
      weekdayIndex,
    };
    absoluteDayMetaCache.set(safeAbsoluteDay, meta);
    return meta;
  };

  const isWeekendAbsoluteDay = (absoluteDay) =>
    weekendSet.has(getAbsoluteDayMeta(absoluteDay).weekdayIndex);

  const getRuleStartAbsoluteDays = (holidayRule, anchorYear, anchorMonth) => {
    const holidayId = String(holidayRule?.id || "");
    const yearValue = Math.max(1, I(anchorYear, 1));
    const monthValue = clampI(anchorMonth, 0, metrics.monthsPerYear - 1);
    const memoKey = `${holidayId}@${yearValue}:${monthValue}`;
    if (startDayMemo.has(memoKey)) return startDayMemo.get(memoKey);
    if (startDayActive.has(memoKey)) {
      holidayRelativeIssues.set(holidayId, "Circular relative/anchor dependency detected.");
      startDayMemo.set(memoKey, []);
      return [];
    }
    const anchorType = String(holidayRule?.anchor?.type || "fixed-date");
    const relativeCfg =
      holidayRule?.relative && typeof holidayRule.relative === "object"
        ? holidayRule.relative
        : null;
    const relativeType =
      relativeCfg?.enabled &&
      HOLIDAY_RELATIVE_TYPES.some(([value]) => value === String(relativeCfg?.type || ""))
        ? String(relativeCfg.type)
        : "none";
    const usesRelativeFallbackAnchor = anchorType === "fixed-date" && relativeType !== "none";
    const effectiveAnchorType = usesRelativeFallbackAnchor
      ? relativeType === "moon-phase"
        ? "moon-phase"
        : relativeType === "astronomy-marker"
          ? "astronomy-marker"
          : relativeType === "holiday"
            ? "holiday"
            : "fixed-date"
      : anchorType;
    const isAlgorithmicAnchor = anchorType === "algorithmic";
    if (
      !isAlgorithmicAnchor &&
      !recursInMonth(holidayRule, yearValue, monthValue, metrics.monthsPerYear)
    ) {
      startDayMemo.set(memoKey, []);
      return [];
    }
    if ((holidayRule?.exceptYears || []).includes(yearValue)) {
      startDayMemo.set(memoKey, []);
      return [];
    }
    if ((holidayRule?.exceptMonths || []).includes(monthValue + 1)) {
      startDayMemo.set(memoKey, []);
      return [];
    }
    if (holidayRelativeIssues.has(holidayId)) {
      startDayMemo.set(memoKey, []);
      return [];
    }

    startDayActive.add(memoKey);
    try {
      const monthCore = getMonthCore(yearValue, monthValue);
      const anchor =
        holidayRule?.anchor && typeof holidayRule.anchor === "object" ? holidayRule.anchor : {};
      const anchorMoonSlot = clampI(anchor.moonSlot ?? relativeCfg?.moonSlot ?? 0, 0, 3);
      const anchorMoonId = String(anchor.moonId ?? relativeCfg?.moonId ?? "");
      const anchorMoonPhase = String(anchor.moonPhase ?? relativeCfg?.moonPhase ?? "F");
      const anchorMarkerKey = String(anchor.markerKey ?? relativeCfg?.markerKey ?? "");
      const anchorHolidayId = String(anchor.holidayId ?? relativeCfg?.holidayId ?? "");
      let starts = [];
      if (effectiveAnchorType === "moon-phase") {
        starts = monthCore.days
          .filter((dayState) => {
            const moonRef = {
              moonId: anchorMoonId,
              moonSlot: clampI(
                anchorMoonSlot,
                0,
                Math.max(0, monthCore.days[0]?.moonStates?.length - 1),
              ),
            };
            const moonState = pickMoonStateForHoliday(moonRef, dayState.moonStates, {
              relative: false,
            });
            return !!moonState && (moonState.phase?.phaseShort || "") === anchorMoonPhase;
          })
          .map((dayState) => dayState.absoluteDay);
      } else if (effectiveAnchorType === "astronomy-marker") {
        starts = monthCore.days
          .filter((dayState) =>
            (dayState.markers || []).some(
              (marker) => String(marker?.key || "") === anchorMarkerKey,
            ),
          )
          .map((dayState) => dayState.absoluteDay);
      } else if (effectiveAnchorType === "holiday") {
        const depHoliday = holidaysById.get(anchorHolidayId);
        if (!depHoliday) {
          holidayRelativeIssues.set(holidayId, "Anchor holiday references a missing holiday.");
          starts = [];
        } else {
          starts = getRuleStartAbsoluteDays(depHoliday, yearValue, monthValue);
        }
      } else if (anchorType === "algorithmic") {
        if (
          holidayRule.recurrence !== "one-off" ||
          yearValue === Math.max(1, I(holidayRule.year, 1))
        ) {
          const algorithmKey = String(anchor.algorithmKey || "none");
          if (algorithmKey === "gregorian-easter-western") {
            const easter = gregorianEasterWesternMonthDay(yearValue);
            if (easter.monthIndex === monthValue && easter.monthIndex < metrics.monthsPerYear) {
              const targetDay = clampI(easter.day, 1, monthCore.monthLength);
              starts = [monthCore.absoluteMonthStart + targetDay - 1];
            }
          }
        }
      } else if (anchorType === "nth-weekday") {
        const weekday = clampI(holidayRule?.weekday ?? 0, 0, daysPerWeek - 1);
        const occurrence = String(holidayRule?.occurrence || "any");
        starts = monthCore.days
          .filter((dayState) => {
            if (dayState.weekdayIndex !== weekday) return false;
            if (occurrence === "any") return true;
            const occ = weekdayOccurrence(
              dayState.dayNumber,
              monthCore.monthLength,
              monthCore.monthStartWeekday,
              weekday,
              daysPerWeek,
            );
            if (occurrence === "last") return !!occ.isLast;
            return occ.nth === clampI(occurrence, 1, 8);
          })
          .map((dayState) => dayState.absoluteDay);
      } else {
        starts = monthCore.days
          .filter((dayState) =>
            dayMatchesHolidayBaseAttrs(holidayRule, {
              dayNumber: dayState.dayNumber,
              monthLength: monthCore.monthLength,
              monthStartWeekday: monthCore.monthStartWeekday,
              weekdayIndex: dayState.weekdayIndex,
              daysPerWeek,
              moonStates: dayState.moonStates,
            }),
          )
          .map((dayState) => dayState.absoluteDay);
      }

      const anchorOffsetDays = I(holidayRule?.offsetDays, 0);
      if (anchorOffsetDays !== 0) {
        starts = starts.map((absoluteDay) => absoluteDay + anchorOffsetDays);
      }

      const dedupedStarts = uniqueSortedNumbers(starts);
      startDayMemo.set(memoKey, dedupedStarts);
      return dedupedStarts;
    } finally {
      startDayActive.delete(memoKey);
    }
  };

  const inConflictScope = (holidayRule, otherHoliday) => {
    if (!otherHoliday) return false;
    if (String(otherHoliday.id || "") === String(holidayRule?.id || "")) return false;
    const scope = String(holidayRule?.conflictScope?.appliesAgainst || "all");
    if (scope === "all") return true;
    if (scope === "category") {
      const categories = Array.isArray(holidayRule?.conflictScope?.categories)
        ? holidayRule.conflictScope.categories
        : [];
      const otherCategory = normalizeHolidayCategory(otherHoliday?.category);
      if (categories.length) return categories.includes(otherCategory);
      return otherCategory === normalizeHolidayCategory(holidayRule?.category);
    }
    if (scope === "ids") {
      const ids = Array.isArray(holidayRule?.conflictScope?.holidayIds)
        ? holidayRule.conflictScope.holidayIds
        : [];
      return ids.includes(String(otherHoliday.id || ""));
    }
    return true;
  };

  const rangesOverlap = (startA, endA, startB, endB) => startA <= endB && endA >= startB;

  const applyWeekendObservanceStart = (startAbs, holidayRule) => {
    const weekendRule = normalizeWeekendRule(holidayRule?.observance?.weekendRule);
    if (weekendRule === "none") return startAbs;
    if (!isWeekendAbsoluteDay(startAbs)) return startAbs;
    const maxShiftDays = Math.max(0, I(holidayRule?.observance?.maxShiftDays, 7));
    if (maxShiftDays <= 0) return startAbs;
    const stayInMonth = !!holidayRule?.observance?.stayInMonth;
    const origin = getAbsoluteDayMeta(startAbs);
    const isAllowed = (candidateAbs) => {
      if (candidateAbs < 0) return false;
      if (Math.abs(candidateAbs - startAbs) > maxShiftDays) return false;
      if (!stayInMonth) return true;
      const candidate = getAbsoluteDayMeta(candidateAbs);
      return candidate.year === origin.year && candidate.monthIndex === origin.monthIndex;
    };
    const isWeekdayCandidate = (candidateAbs) =>
      isAllowed(candidateAbs) && !isWeekendAbsoluteDay(candidateAbs);

    if (weekendRule === "next-monday") {
      for (let step = 1; step <= maxShiftDays; step++) {
        const candidateAbs = startAbs + step;
        if (!isAllowed(candidateAbs)) continue;
        const weekdayIndex = getAbsoluteDayMeta(candidateAbs).weekdayIndex;
        if (weekdayIndex === 0 && !isWeekendAbsoluteDay(candidateAbs)) return candidateAbs;
      }
      return startAbs;
    }

    if (weekendRule === "nearest-weekday") {
      for (let step = 1; step <= maxShiftDays; step++) {
        const previousAbs = startAbs - step;
        const nextAbs = startAbs + step;
        const previousOk = isWeekdayCandidate(previousAbs);
        const nextOk = isWeekdayCandidate(nextAbs);
        if (previousOk && nextOk) return previousAbs;
        if (previousOk) return previousAbs;
        if (nextOk) return nextAbs;
      }
      return startAbs;
    }

    if (weekendRule === "next-weekday") {
      for (let step = 1; step <= maxShiftDays; step++) {
        const candidateAbs = startAbs + step;
        if (isWeekdayCandidate(candidateAbs)) return candidateAbs;
      }
      return startAbs;
    }

    if (weekendRule === "previous-weekday") {
      for (let step = 1; step <= maxShiftDays; step++) {
        const candidateAbs = startAbs - step;
        if (isWeekdayCandidate(candidateAbs)) return candidateAbs;
      }
      return startAbs;
    }

    return startAbs;
  };

  const hasConflictAtStart = (startAbs, durationDays, holidayRule, acceptedOccurrences) => {
    const endAbs = startAbs + durationDays - 1;
    for (const occurrence of acceptedOccurrences || []) {
      if (!occurrence?.holiday) continue;
      if (!inConflictScope(holidayRule, occurrence.holiday)) continue;
      if (rangesOverlap(startAbs, endAbs, occurrence.startAbs, occurrence.endAbs)) return true;
    }
    return false;
  };

  const applyConflictObservanceStart = (startAbs, holidayRule, acceptedOccurrences) => {
    const conflictRule = String(holidayRule?.observance?.holidayConflictRule || "merge");
    if (!["shift-forward", "shift-backward", "next-weekday"].includes(conflictRule))
      return startAbs;
    const durationDays = Math.max(1, I(holidayRule?.durationDays, 1));
    const maxShiftDays = Math.max(0, I(holidayRule?.observance?.maxShiftDays, 7));
    if (maxShiftDays <= 0) return startAbs;
    if (!hasConflictAtStart(startAbs, durationDays, holidayRule, acceptedOccurrences))
      return startAbs;
    const stayInMonth = !!holidayRule?.observance?.stayInMonth;
    const origin = getAbsoluteDayMeta(startAbs);
    const isAllowed = (candidateAbs) => {
      if (candidateAbs < 0) return false;
      if (Math.abs(candidateAbs - startAbs) > maxShiftDays) return false;
      if (!stayInMonth) return true;
      const candidate = getAbsoluteDayMeta(candidateAbs);
      return candidate.year === origin.year && candidate.monthIndex === origin.monthIndex;
    };
    for (let step = 1; step <= maxShiftDays; step++) {
      let candidateAbs = startAbs;
      if (conflictRule === "shift-forward") {
        candidateAbs = startAbs + step;
      } else if (conflictRule === "shift-backward") {
        candidateAbs = startAbs - step;
      } else if (conflictRule === "next-weekday") {
        candidateAbs = startAbs + step;
        if (isWeekendAbsoluteDay(candidateAbs)) continue;
      }
      if (!isAllowed(candidateAbs)) continue;
      const weekendAdjustedAbs = applyWeekendObservanceStart(candidateAbs, holidayRule);
      if (!isAllowed(weekendAdjustedAbs)) continue;
      if (!hasConflictAtStart(weekendAdjustedAbs, durationDays, holidayRule, acceptedOccurrences)) {
        return weekendAdjustedAbs;
      }
    }
    return startAbs;
  };

  const holidayMatchesByAbsoluteDay = new Map();
  const currentLinearMonth = toLinearMonthOrdinal(safeYear, safeMonth, metrics.monthsPerYear);
  const avgDaysPerMonth = Math.max(
    1,
    N(currentCore.yearLength, monthLength) / Math.max(1, metrics.monthsPerYear),
  );
  const maxRelativeOffsetDays = Math.max(
    0,
    ...(holidays || []).map((holidayRule) =>
      Math.abs(I(holidayRule?.relative?.enabled ? holidayRule.relative.offsetDays : 0, 0)),
    ),
  );
  const maxAnchorOffsetDays = Math.max(
    0,
    ...(holidays || []).map((holidayRule) => Math.abs(I(holidayRule?.offsetDays, 0))),
  );
  const maxObservanceShiftDays = Math.max(
    0,
    ...(holidays || []).map((holidayRule) =>
      Math.max(0, I(holidayRule?.observance?.maxShiftDays, 0)),
    ),
  );
  const maxHolidayDurationDays = Math.max(
    1,
    ...(holidays || []).map((holidayRule) => Math.max(1, I(holidayRule?.durationDays, 1))),
  );
  const dynamicScanRadius = Math.max(
    HOLIDAY_SCAN_MONTH_RADIUS,
    Math.ceil(
      (maxRelativeOffsetDays +
        maxAnchorOffsetDays +
        maxObservanceShiftDays +
        maxHolidayDurationDays) /
        avgDaysPerMonth,
    ) + 2,
  );
  const minLinearMonth = Math.max(0, currentLinearMonth - dynamicScanRadius);
  const maxLinearMonth = currentLinearMonth + dynamicScanRadius;

  const holidayOccurrencesRaw = [];
  for (const holidayRule of holidays || []) {
    const durationDays = Math.max(1, I(holidayRule?.durationDays, 1));
    for (let linearMonth = minLinearMonth; linearMonth <= maxLinearMonth; linearMonth++) {
      const { year: anchorYear, monthIndex: anchorMonth } = fromLinearMonthOrdinal(
        linearMonth,
        metrics.monthsPerYear,
      );
      const starts = getRuleStartAbsoluteDays(holidayRule, anchorYear, anchorMonth);
      for (const startAbs of starts) {
        holidayOccurrencesRaw.push({
          holiday: holidayRule,
          startAbs: I(startAbs, 0),
          endAbs: I(startAbs, 0) + durationDays - 1,
          durationDays,
        });
      }
    }
  }

  holidayOccurrencesRaw.sort(
    (a, b) =>
      I(b?.holiday?.priority ?? 0, 0) - I(a?.holiday?.priority ?? 0, 0) ||
      I(a?.startAbs ?? 0, 0) - I(b?.startAbs ?? 0, 0) ||
      String(a?.holiday?.name || "").localeCompare(String(b?.holiday?.name || "")) ||
      String(a?.holiday?.id || "").localeCompare(String(b?.holiday?.id || "")),
  );

  const holidayOccurrences = [];
  for (const occurrence of holidayOccurrencesRaw) {
    const holidayRule = occurrence.holiday;
    const durationDays = Math.max(1, I(occurrence.durationDays, 1));
    let shiftedStartAbs = applyWeekendObservanceStart(occurrence.startAbs, holidayRule);
    shiftedStartAbs = applyConflictObservanceStart(
      shiftedStartAbs,
      holidayRule,
      holidayOccurrences,
    );
    const shiftedEndAbs = shiftedStartAbs + durationDays - 1;
    const resolvedOccurrence = {
      holiday: holidayRule,
      startAbs: shiftedStartAbs,
      endAbs: shiftedEndAbs,
      durationDays,
    };
    holidayOccurrences.push(resolvedOccurrence);
    if (shiftedEndAbs < absoluteMonthStart || shiftedStartAbs > absoluteMonthEnd) continue;
    const fromAbs = Math.max(shiftedStartAbs, absoluteMonthStart);
    const toAbs = Math.min(shiftedEndAbs, absoluteMonthEnd);
    for (let absoluteDay = fromAbs; absoluteDay <= toAbs; absoluteDay++) {
      const dayNumber = absoluteDay - absoluteMonthStart + 1;
      if ((holidayRule?.exceptDays || []).includes(dayNumber)) continue;
      if (!holidayMatchesByAbsoluteDay.has(absoluteDay)) {
        holidayMatchesByAbsoluteDay.set(absoluteDay, []);
      }
      holidayMatchesByAbsoluteDay.get(absoluteDay).push({
        holiday: holidayRule,
        startAbs: shiftedStartAbs,
        endAbs: shiftedEndAbs,
      });
    }
  }

  const festivalBuckets = buildFestivalBuckets(
    festivals || [],
    safeYear,
    safeMonth,
    monthLength,
    metrics.monthsPerYear,
  );
  for (const fest of festivalBuckets.inFlowByAfterDay.get(0) || []) {
    cells.push({ kind: "festival", festival: fest });
  }

  for (const dayState of currentCore.days) {
    const dayNumber = dayState.dayNumber;
    const absoluteDay = dayState.absoluteDay;
    const weekdayIndex = dayState.weekdayIndex;
    const moonStates = dayState.moonStates;
    const markers = dayState.markers;
    const cycles = evaluateWorkCyclesForDay(workCycles, absoluteDay);

    if (moonStates[0]?.phase?.phaseShort === "F") fullMoonDays.push(dayNumber);
    if (moonStates[0]?.phase?.phaseShort === "N") newMoonDays.push(dayNumber);

    const mergedMatches = mergeHolidayDayMatches(
      holidayMatchesByAbsoluteDay.get(absoluteDay) || [],
    );
    const resolvedHolidays = resolveHolidayMatches(mergedMatches.map((match) => match.holiday));
    const resolvedIds = new Set(resolvedHolidays.map((holiday) => String(holiday.id || "")));
    const holidayDetails = mergedMatches
      .filter((match) => resolvedIds.has(String(match.holiday?.id || "")))
      .map((match) => ({
        ...match,
        startsToday: match.startAbs === absoluteDay,
        endsToday: match.endAbs === absoluteDay,
        continuesFromPrev: match.startAbs < absoluteDay,
        continuesToNext: match.endAbs > absoluteDay,
      }));

    for (const holiday of resolvedHolidays) {
      holidayHits.set(holiday.id, (holidayHits.get(holiday.id) || 0) + 1);
    }
    for (const marker of markers || []) {
      const markerKey = astronomyMarkerAggregateKey(marker);
      markerHits.set(markerKey, {
        key: marker.key,
        name: marker.name,
        short: marker.short,
        sourceLabel: marker.sourceLabel,
        sourceMoonId: marker.sourceMoonId,
        sourceMoonName: marker.sourceMoonName,
        sourceMoonIndex: marker.sourceMoonIndex,
        count: (markerHits.get(markerKey)?.count || 0) + 1,
      });
    }
    for (const cycle of cycles) {
      const cycleKey = String(cycle.ruleId || cycle.ruleName || "");
      if (!cycleKey) continue;
      const existing = cycleHits.get(cycleKey);
      cycleHits.set(cycleKey, {
        ruleId: cycle.ruleId,
        ruleName: cycle.ruleName,
        kind: cycle.kind,
        short: cycle.short,
        label: cycle.label,
        count: (existing?.count || 0) + 1,
      });
    }

    cells.push({
      dayNumber,
      absoluteDay,
      weekdayIndex,
      moonStates,
      holidays: resolvedHolidays,
      holidayDetails,
      markers,
      cycles,
    });
    for (const fest of festivalBuckets.inFlowByAfterDay.get(dayNumber) || []) {
      cells.push({ kind: "festival", festival: fest });
    }
  }

  const rows = [];
  const rowCount = Math.ceil(cells.length / daysPerWeek);
  const weekLabels = normalizeNameList(weekNames, rowCount, "Week");
  for (let row = 0; row < rowCount; row++) {
    const rowCells = cells.slice(row * daysPerWeek, row * daysPerWeek + daysPerWeek);
    while (rowCells.length < daysPerWeek) rowCells.push(null);
    rows.push({ weekName: weekLabels[row] || `Week ${row + 1}`, cells: rowCells });
  }

  return {
    year: safeYear,
    monthIndex: safeMonth,
    monthName: monthNames[safeMonth] || `Month ${safeMonth + 1}`,
    monthLength,
    yearLength: currentCore.yearLength,
    daysBeforeMonth: currentCore.daysBeforeMonth,
    absoluteMonthStart,
    monthStartWeekday,
    headers,
    rows,
    fullMoonDays,
    newMoonDays,
    holidaysInMonth: Array.from(holidayHits.entries()),
    markersInMonth: Array.from(markerHits.values()),
    cyclesInMonth: Array.from(cycleHits.values()),
    festivalsInMonth: festivalBuckets.festivalsInMonth,
    outsideWeekFlowFestivals: festivalBuckets.outsideWeekFlow,
    holidayIssueById: Object.fromEntries(holidayRelativeIssues.entries()),
  };
}

/* ── Rule Debugger: on-demand trace for a selected day ──────────── */

function traceRulesForDay({
  cell,
  model,
  holidays,
  festivals,
  workCycles,
  leapRules,
  metrics,
  dayNames,
  weekendDayIndexes,
}) {
  if (!cell || !Number.isFinite(cell.absoluteDay)) return null;

  const daysPerWeek = Math.max(1, I(metrics?.daysPerWeek, 7));
  const weekendSet = new Set(normalizeWeekendDayIndexes(weekendDayIndexes, daysPerWeek));
  const isWeekend = weekendSet.has(cell.weekdayIndex);
  const weekdayName =
    (Array.isArray(dayNames) ? dayNames : [])[cell.weekdayIndex] || `Day ${cell.weekdayIndex + 1}`;

  // Active leap rules this year
  const safeRules = normalizeLeapRules(leapRules, metrics?.monthsPerYear || 12);
  const activeLeap = safeRules.filter((rule) => {
    const cycle = Math.max(1, I(rule.cycleYears, 1));
    const offset = I(rule.offsetYear, 0);
    return mod(model.year - 1 - offset, cycle) === 0;
  });

  // Moon phases for display
  const moonPhases = (cell.moonStates || []).map((m) => ({
    name: m.name || "Moon",
    phaseShort: m.phase?.phaseShort || "?",
    phaseName: m.phase?.phaseName || "Unknown",
    illumination: m.phase?.illuminationPct ?? 0,
    ageDays: m.phase?.ageDays ?? 0,
    synodic: m.synodicDays ?? 0,
  }));

  const raw = {
    dayNumber: cell.dayNumber,
    absoluteDay: cell.absoluteDay,
    weekdayIndex: cell.weekdayIndex,
    weekdayName,
    isWeekend,
    moonPhases,
    leapRulesActive: activeLeap.map((r) => ({
      name: r.name || "Unnamed",
      month: r.monthIndex + 1,
      delta: r.dayDelta,
    })),
    festivalSlot: cell.kind === "festival",
  };

  // Trace holidays
  const issueById = model.holidayIssueById || {};
  const resolvedIds = new Set((cell.holidays || []).map((h) => String(h.id || "")));
  const detailById = new Map(
    (cell.holidayDetails || []).map((d) => [String(d.holiday?.id || ""), d]),
  );
  const allHolidays = Array.isArray(holidays) ? holidays : [];
  const monthsPerYear = Math.max(1, I(metrics?.monthsPerYear, 12));

  const holidayTraces = allHolidays.map((rule) => {
    const id = String(rule.id || "");
    const name = String(rule.name || "Unnamed");
    const category = normalizeHolidayCategory(rule.category);
    const anchorType = String(rule.anchor?.type || "fixed-date");
    const priority = I(rule.priority, 0);
    const mergeMode = String(rule.mergeMode || "merge");
    const matched = resolvedIds.has(id);
    const detail = detailById.get(id);

    // Determine reason for match / non-match
    let reason;
    if (issueById[id]) {
      reason = `Error: ${issueById[id]}`;
    } else if (!recursInMonth(rule, model.year, model.monthIndex, monthsPerYear)) {
      const recurrence = String(rule.recurrence || "yearly");
      reason = `Recurrence "${recurrence}" does not apply in month ${model.monthIndex + 1}`;
    } else if ((rule.exceptYears || []).includes(model.year)) {
      reason = `Excluded: year ${model.year} in exceptYears`;
    } else if ((rule.exceptMonths || []).includes(model.monthIndex + 1)) {
      reason = `Excluded: month ${model.monthIndex + 1} in exceptMonths`;
    } else if ((rule.exceptDays || []).includes(cell.dayNumber)) {
      reason = `Excluded: day ${cell.dayNumber} in exceptDays`;
    } else if (matched) {
      const anchorLabel = HOLIDAY_ANCHOR_TYPES.find(([v]) => v === anchorType)?.[1] || anchorType;
      if (detail) {
        const span =
          detail.startAbs === detail.endAbs
            ? `day ${detail.startAbs + 1}`
            : `days ${detail.startAbs + 1}\u2013${detail.endAbs + 1}`;
        reason = `Matched via ${anchorLabel}, covers ${span}`;
        if (detail.continuesFromPrev) reason += " (continues from previous day)";
      } else {
        reason = `Matched via ${anchorLabel}`;
      }
    } else {
      const anchorLabel = HOLIDAY_ANCHOR_TYPES.find(([v]) => v === anchorType)?.[1] || anchorType;
      reason = `Anchor "${anchorLabel}" did not produce a start covering this day`;
    }

    return {
      id,
      name,
      category,
      matched,
      reason,
      anchorType,
      priority,
      mergeMode,
      resolved: matched,
      weekendShift: detail
        ? detail.startAbs !== cell.absoluteDay && detail.startsToday
          ? "shifted"
          : null
        : null,
      conflictShift: null,
    };
  });

  // Trace festivals
  const festivalTraces = (Array.isArray(festivals) ? festivals : []).map((rule) => {
    const id = String(rule.id || "");
    const name = String(rule.name || "Unnamed");
    if (!festivalAppliesInMonth(rule, model.year, model.monthIndex, monthsPerYear)) {
      return { id, name, matched: false, reason: "Does not apply in this month" };
    }
    const afterDay = clampI(rule.afterDay, 0, model.monthLength);
    const duration = Math.max(1, I(rule.durationDays, 1));
    const startDay = afterDay + 1;
    const endDay = afterDay + duration;
    if (cell.dayNumber >= startDay && cell.dayNumber <= endDay) {
      const seg = cell.dayNumber - afterDay;
      return {
        id,
        name,
        matched: true,
        reason: `After day ${afterDay}, segment ${seg}/${duration}`,
      };
    }
    return {
      id,
      name,
      matched: false,
      reason: `Covers days ${startDay}\u2013${endDay}, this is day ${cell.dayNumber}`,
    };
  });

  // Trace work cycles
  const cycleTraces = (Array.isArray(workCycles) ? workCycles : []).map((rule) => {
    const id = String(rule.id || "");
    const name = String(rule.name || "Unnamed");
    const modeLabel = rule.mode === "interval" ? "interval" : "duty";
    const startAbsoluteDay = Math.max(0, I(rule.startAbsoluteDay, 0));
    const dayOffset = cell.absoluteDay - startAbsoluteDay;
    if (dayOffset < 0) {
      return {
        id,
        name,
        mode: modeLabel,
        matched: false,
        reason: `Cycle starts at absolute day ${startAbsoluteDay}, this is ${cell.absoluteDay} (before start)`,
      };
    }
    if (rule.mode === "interval") {
      const intervalDays = Math.max(1, I(rule.intervalDays, 1));
      const hit = mod(dayOffset, intervalDays) === 0;
      return {
        id,
        name,
        mode: modeLabel,
        matched: hit,
        reason: hit
          ? `Interval ${intervalDays}: offset ${dayOffset} is a multiple`
          : `Interval ${intervalDays}: offset ${dayOffset} remainder ${mod(dayOffset, intervalDays)}`,
      };
    }
    const onDays = Math.max(1, I(rule.onDays, 1));
    const offDays = Math.max(1, I(rule.offDays, 1));
    const span = onDays + offDays;
    const pos = mod(dayOffset, span);
    const isActive = pos < onDays;
    return {
      id,
      name,
      mode: modeLabel,
      matched: true,
      reason: `Position ${pos + 1}/${span} (${isActive ? "active" : "rest"}: ${onDays} on / ${offDays} off)`,
    };
  });

  return { raw, holidays: holidayTraces, festivals: festivalTraces, workCycles: cycleTraces };
}

function traceToPlainText(trace) {
  if (!trace) return "No trace data.";
  const lines = [];
  const r = trace.raw;
  lines.push(
    `Day ${r.dayNumber} | Absolute ${r.absoluteDay} | ${r.weekdayName} (index ${r.weekdayIndex})${r.isWeekend ? " [weekend]" : ""}`,
  );
  if (r.moonPhases.length) {
    lines.push(
      `Moons: ${r.moonPhases.map((m) => `${m.name} ${m.phaseShort} (${m.phaseName}, ${fmt(m.illumination, 1)}%)`).join("; ")}`,
    );
  }
  if (r.leapRulesActive.length) {
    lines.push(
      `Leap rules active: ${r.leapRulesActive.map((l) => `${l.name} (month ${l.month}, ${l.delta > 0 ? "+" : ""}${l.delta}d)`).join("; ")}`,
    );
  }
  if (trace.holidays.length) {
    lines.push("", "HOLIDAYS:");
    for (const h of trace.holidays) {
      const mark = h.matched ? "[MATCH]" : "[  --  ]";
      lines.push(
        `  ${mark} ${h.name} | anchor=${h.anchorType} priority=${h.priority} merge=${h.mergeMode} | ${h.reason}`,
      );
    }
  }
  if (trace.festivals.length) {
    lines.push("", "FESTIVALS:");
    for (const f of trace.festivals) {
      const mark = f.matched ? "[MATCH]" : "[  --  ]";
      lines.push(`  ${mark} ${f.name} | ${f.reason}`);
    }
  }
  if (trace.workCycles.length) {
    lines.push("", "WORK CYCLES:");
    for (const c of trace.workCycles) {
      const mark = c.matched ? "[MATCH]" : "[  --  ]";
      lines.push(`  ${mark} ${c.name} (${c.mode}) | ${c.reason}`);
    }
  }
  return lines.join("\n");
}

function buildContext(world, state) {
  const planets = listPlanets(world);
  const allMoons = listMoons(world);
  const planet =
    findById(planets, state.inputs.sourcePlanetId) ||
    getSelectedPlanet(world) ||
    planets[0] ||
    null;
  const sourcePlanetId = planet?.id || "";
  const planetMoons = moonsForPlanet(allMoons, sourcePlanetId);

  let primaryMoon = findById(planetMoons, state.inputs.primaryMoonId);
  if (!primaryMoon) primaryMoon = planetMoons[0] || null;

  const extras = uniqIds(state.inputs.extraMoonIds)
    .filter((id) => id && id !== primaryMoon?.id)
    .filter((id) => !!findById(planetMoons, id));
  const fallbackExtras = planetMoons
    .filter((m) => m.id !== primaryMoon?.id)
    .map((m) => m.id)
    .filter((id) => !extras.includes(id));
  const extraMoonIds = [...extras, ...fallbackExtras].slice(0, 3);
  while (extraMoonIds.length < 3) extraMoonIds.push("");

  state.inputs.sourcePlanetId = sourcePlanetId;
  state.inputs.primaryMoonId = primaryMoon?.id || "";
  state.inputs.extraMoonIds = extraMoonIds;

  const planetOrbitalPeriodDays = derivePlanetPeriodDays(world, planet);
  const planetRotationPeriodHours = Math.max(0.1, N(planet?.inputs?.rotationPeriodHours, 24));

  const moonDefs = [];
  if (primaryMoon) {
    moonDefs.push({
      id: primaryMoon.id,
      name: primaryMoon.name || primaryMoon.inputs?.name || "Primary moon",
      synodicDays: deriveMoonSynodicDays(world, planet, primaryMoon),
    });
  } else {
    moonDefs.push({ id: "__primary__", name: "Primary moon", synodicDays: 29.5306 });
  }

  for (const moonId of extraMoonIds) {
    if (!moonId) continue;
    const moon = findById(planetMoons, moonId);
    if (!moon) continue;
    moonDefs.push({
      id: moon.id,
      name: moon.name || moon.inputs?.name || moon.id,
      synodicDays: deriveMoonSynodicDays(world, planet, moon),
    });
    if (moonDefs.length >= 4) break;
  }

  const primaryMoonSynodicDaysRaw = Math.max(0.1, N(moonDefs[0]?.synodicDays, 29.5306));

  // Optionally round derived values before feeding into the calendar model
  let planetOrbitalPeriodDaysClamped = planetOrbitalPeriodDays;
  let primaryMoonSynodicDays = primaryMoonSynodicDaysRaw;
  let planetRotationPeriodHoursClamped = planetRotationPeriodHours;
  if (state.ui.derivedRoundEnabled) {
    const dp = clampI(state.ui.derivedDecimalPlaces ?? 6, 0, 6);
    const dpFactor = 10 ** dp;
    planetOrbitalPeriodDaysClamped = Math.round(planetOrbitalPeriodDays * dpFactor) / dpFactor;
    primaryMoonSynodicDays = Math.round(primaryMoonSynodicDaysRaw * dpFactor) / dpFactor;
    planetRotationPeriodHoursClamped = Math.round(planetRotationPeriodHours * dpFactor) / dpFactor;
  }

  const derivedMonthsPerYear = Math.max(
    1,
    Math.round(planetOrbitalPeriodDaysClamped / primaryMoonSynodicDays),
  );
  if (state.inputs.monthsPerYear == null || !Number.isFinite(Number(state.inputs.monthsPerYear))) {
    state.inputs.monthsPerYear = derivedMonthsPerYear;
  }

  // Convert sidereal rotation → solar day for calendar purposes.
  // A calendar day is noon-to-noon (solar day), not star-to-star (sidereal day).
  // For prograde rotation: solarDay = 1 / (1/sidereal - 1/orbital)
  const orbitalHours = planetOrbitalPeriodDaysClamped * 24;
  const siderealHours = planetRotationPeriodHoursClamped;
  const recipDiff = 1 / siderealHours - 1 / orbitalHours;
  const solarDayHours = recipDiff > 1e-9 ? 1 / recipDiff : siderealHours;

  const calendarModel = calcCalendarModel({
    planetOrbitalPeriodDays: planetOrbitalPeriodDaysClamped,
    moonOrbitalPeriodDays: primaryMoonSynodicDays,
    planetRotationPeriodHours: solarDayHours,
    weeksPerMonth: 4,
  });
  const base = getCalendarBasisMetrics(calendarModel, state.ui.basis);
  const overrideMonths = clampI(state.inputs.monthsPerYear, 1, 240);

  // Year length for the active basis
  const yearLen =
    base.basis === "solar"
      ? calendarModel.solar.commonYearLength
      : base.basis === "lunar"
        ? calendarModel.lunar.yearLength
        : calendarModel.lunisolar.commonYearLength;

  // Cascading overrides: months → days/month → days/week
  const autoDpm = Math.max(1, Math.floor(yearLen / overrideMonths));
  const effectiveDpm =
    state.inputs.daysPerMonth != null ? clampI(state.inputs.daysPerMonth, 1, 500) : autoDpm;

  const maxDpw = Math.min(30, effectiveDpm);
  const autoDpw = Math.max(1, Math.floor(effectiveDpm / 4));
  const effectiveDpw =
    state.inputs.daysPerWeek != null ? clampI(state.inputs.daysPerWeek, 1, maxDpw) : autoDpw;

  const weeksPerMonth = Math.max(1, Math.floor(effectiveDpm / effectiveDpw));
  const yearlyIntercalary = yearLen - overrideMonths * effectiveDpm;

  const metrics = {
    ...base,
    monthsPerYear: overrideMonths,
    daysPerMonth: effectiveDpm,
    daysPerWeek: effectiveDpw,
    weeksPerMonth,
    intercalaryDays: yearlyIntercalary,
  };
  state.ui.startDayOfYear = mod(I(state.ui.startDayOfYear, 0), metrics.daysPerWeek);
  state.ui.weekStartsOn = mod(I(state.ui.weekStartsOn, 0), metrics.daysPerWeek);
  state.ui.monthIndex = clampI(state.ui.monthIndex, 0, metrics.monthsPerYear - 1);

  const dayNames = normalizeNameList(state.ui.dayNames, metrics.daysPerWeek, "Day");
  const monthNames = normalizeNameList(state.ui.monthNames, metrics.monthsPerYear, "Month");
  const holidays = normHolidayRules(state.ui.holidays, metrics.monthsPerYear);
  const festivals = normFestivalRules(state.ui.festivalRules, metrics.monthsPerYear);
  const workCycles = normWorkCycleRules(state.ui.workCycles);
  const workWeekendRule = normalizeWeekendRule(state.ui.workWeekendRule);
  const weekendDayIndexes = normalizeWeekendDayIndexes(
    state.ui.weekendDayIndexes,
    metrics.daysPerWeek,
  );
  const astronomySettings = normalizeAstronomySettings(state.ui.astronomy);
  state.ui.astronomy = astronomySettings;
  state.ui.workCycles = workCycles;
  state.ui.workWeekendRule = workWeekendRule;
  state.ui.weekendDayIndexes = weekendDayIndexes;
  state.ui.exportAnchorDate = normalizeIsoDate(state.ui.exportAnchorDate);
  state.ui.icsIncludes = normalizeIcsIncludes(state.ui.icsIncludes);
  const leapRules = normalizeLeapRules(state.ui.leapRules, metrics.monthsPerYear);
  const monthLengthOverrides = state.ui.monthLengthOverridesEnabled
    ? normalizeMonthLengthOverrides(state.ui.monthLengthOverrides, metrics.monthsPerYear)
    : [];
  const monthModel = buildMonthModel({
    metrics,
    year: state.ui.year,
    monthIndex: state.ui.monthIndex,
    firstYearStartDayIndex: state.ui.startDayOfYear,
    weekStartDayIndex: state.ui.weekStartsOn,
    leapRules,
    monthLengthOverrides,
    dayNames,
    weekNames: state.ui.weekNames,
    monthNames,
    moonDefs,
    moonEpochOffsetDays: state.ui.moonEpochOffsetDays,
    holidays,
    festivals,
    astronomySettings,
    workCycles,
    weekendDayIndexes,
  });
  state.ui.selectedDay = clampI(state.ui.selectedDay, 1, monthModel.monthLength);

  return {
    planets,
    planetMoons,
    sourcePlanetId,
    moonDefs,
    planetOrbitalPeriodDays: planetOrbitalPeriodDaysClamped,
    planetRotationPeriodHours: planetRotationPeriodHoursClamped,
    solarDayHours,
    primaryMoonSynodicDays,
    derivedMonthsPerYear,
    metrics,
    yearLen,
    yearlyIntercalary,
    dayNames,
    monthNames,
    holidays,
    festivals,
    workCycles,
    workWeekendRule,
    weekendDayIndexes,
    astronomySettings,
    leapRules,
    monthLengthOverrides,
    monthModel,
    holidayIssueById: monthModel.holidayIssueById || {},
  };
}

function holidaySummary(holiday, ctx) {
  const monthName =
    ctx.monthNames?.[clampI(holiday.startMonth, 0, ctx.monthNames.length - 1)] ||
    `Month ${clampI(holiday.startMonth, 0, 100) + 1}`;
  const recurrence = RECURRENCES.find(([v]) => v === holiday.recurrence)?.[1] || "Yearly";
  const anchorType = String(holiday?.anchor?.type || "");
  const anchorTypeLabel = HOLIDAY_ANCHOR_TYPES.find(([value]) => value === anchorType)?.[1] || "";
  const bits =
    holiday.recurrence === "one-off"
      ? [`One-off in Year ${Math.max(1, I(holiday.year, 1))}, ${monthName}`]
      : [`${recurrence} from ${monthName}`];
  if (anchorTypeLabel) bits.push(`anchor ${anchorTypeLabel}`);
  if (anchorType === "algorithmic") {
    const algoLabel =
      HOLIDAY_ALGORITHMS.find(
        ([value]) => value === String(holiday?.anchor?.algorithmKey || ""),
      )?.[1] || "algorithm";
    bits.push(`algorithm ${algoLabel}`);
  }
  bits.push(`category ${holidayCategoryLabel(holiday.category)}`);
  const rel = holiday?.relative && typeof holiday.relative === "object" ? holiday.relative : null;
  if (rel?.enabled && rel.type !== "none") {
    const offset = I(rel.offsetDays, 0);
    const offsetLabel =
      offset === 0
        ? "same day"
        : offset < 0
          ? `${Math.abs(offset)} day(s) before`
          : `${offset} day(s) after`;
    if (rel.type === "moon-phase") {
      const phase = PHASES.find(([value]) => value === rel.moonPhase)?.[1] || "Moon phase";
      const moonName =
        ctx.moonDefs.find((moonDef) => moonDef.id === rel.moonId)?.name ||
        ctx.moonDefs[clampI(rel.moonSlot, 0, ctx.moonDefs.length - 1)]?.name ||
        "moon";
      bits.push(`relative: ${offsetLabel} ${phase} on ${moonName}`);
    } else if (rel.type === "astronomy-marker") {
      const markerName =
        HOLIDAY_RELATIVE_MARKERS.find(([value]) => value === rel.markerKey)?.[1] ||
        "astronomy marker";
      bits.push(`relative: ${offsetLabel} ${markerName}`);
    } else if (rel.type === "holiday") {
      const targetHoliday =
        (ctx.holidays || []).find(
          (existingHoliday) => String(existingHoliday.id) === String(rel.holidayId),
        ) || null;
      bits.push(`relative: ${offsetLabel} ${targetHoliday?.name || "linked holiday"}`);
    } else {
      bits.push(`relative: ${offsetLabel} ${holidayRelativeKeyLabel(rel)}`);
    }
  } else {
    if (holiday.attrs?.useDate) {
      bits.push(`day ${clampI(holiday.dayOfMonth, 1, 400)}`);
    }
    if (holiday.attrs?.useWeekday) {
      const dayName =
        ctx.dayNames?.[clampI(holiday.weekday, 0, ctx.dayNames.length - 1)] ||
        `Day ${clampI(holiday.weekday, 0, 100) + 1}`;
      const occ = OCCURRENCES.find(([v]) => v === String(holiday.occurrence))?.[1] || "Any week";
      bits.push(String(holiday.occurrence) === "any" ? `weekday ${dayName}` : `${occ} ${dayName}`);
    }
    if (holiday.attrs?.useMoonPhase) {
      const phase = PHASES.find(([v]) => v === holiday.moonPhase)?.[1] || "Moon phase";
      const moonName =
        ctx.moonDefs.find((m) => m.id === holiday.moonId)?.name ||
        ctx.moonDefs[clampI(holiday.moonSlot, 0, ctx.moonDefs.length - 1)]?.name ||
        "moon";
      bits.push(`${phase} on ${moonName}`);
    }
  }
  if (I(holiday?.offsetDays, 0) !== 0) {
    const offset = I(holiday.offsetDays, 0);
    bits.push(`offset ${offset > 0 ? `+${offset}` : offset} days`);
  }
  const weekendRule = normalizeWeekendRule(
    normalizeWeekendRule(ctx?.workWeekendRule) !== "none"
      ? ctx.workWeekendRule
      : holiday?.observance?.weekendRule,
  );
  if (weekendRule !== "none") {
    const label =
      HOLIDAY_WEEKEND_RULES.find(([value]) => value === weekendRule)?.[1] || "weekend shift";
    const weekendDays = normalizeWeekendDayIndexes(
      ctx?.weekendDayIndexes,
      Array.isArray(ctx?.dayNames) && ctx.dayNames.length ? ctx.dayNames.length : 7,
    )
      .map((idx) => String(ctx?.dayNames?.[idx] || `Day ${idx + 1}`))
      .join(", ");
    bits.push(`weekend ${label}${weekendDays ? ` (${weekendDays})` : ""}`);
  }
  if (String(holiday?.observance?.holidayConflictRule || "merge") !== "merge") {
    const label =
      HOLIDAY_CONFLICT_RULES.find(
        ([value]) => value === String(holiday?.observance?.holidayConflictRule || ""),
      )?.[1] || "conflict handling";
    bits.push(`conflict ${label}`);
  }
  if (Math.max(1, I(holiday.durationDays, 1)) > 1) {
    bits.push(`${Math.max(1, I(holiday.durationDays, 1))} days`);
  }
  bits.push(
    `priority ${I(holiday.priority, 0)} (${holiday.mergeMode === "override" ? "override" : "merge"})`,
  );
  if ((holiday.exceptYears || []).length)
    bits.push(`skip years: ${(holiday.exceptYears || []).join(", ")}`);
  if ((holiday.exceptMonths || []).length)
    bits.push(`skip months: ${(holiday.exceptMonths || []).join(", ")}`);
  if ((holiday.exceptDays || []).length)
    bits.push(`skip days: ${(holiday.exceptDays || []).join(", ")}`);
  const issue = ctx.holidayIssueById?.[holiday.id];
  if (issue) bits.push(`disabled: ${issue}`);
  return bits.join(" | ");
}

function holidayVisibleInFilter(holiday, filters) {
  const category = normalizeHolidayCategory(holiday?.category);
  return !!(filters && typeof filters === "object" ? filters[category] : true);
}

function applyHolidayFiltersToMonthModel(model, filters) {
  const rows = (model?.rows || []).map((row) => {
    const cells = (row?.cells || []).map((cell) => {
      if (!cell || cell.kind === "festival") return cell;
      const holidays = (cell.holidays || []).filter((holiday) =>
        holidayVisibleInFilter(holiday, filters),
      );
      const allowed = new Set(holidays.map((holiday) => String(holiday?.id || "")));
      const holidayDetails = (cell.holidayDetails || []).filter((detail) =>
        allowed.has(String(detail?.holiday?.id || "")),
      );
      return { ...cell, holidays, holidayDetails };
    });
    return { ...row, cells };
  });

  const holidayHits = new Map();
  for (const row of rows) {
    for (const cell of row.cells || []) {
      if (!cell || cell.kind === "festival") continue;
      for (const holiday of cell.holidays || []) {
        holidayHits.set(holiday.id, (holidayHits.get(holiday.id) || 0) + 1);
      }
    }
  }

  return {
    ...model,
    rows,
    holidaysInMonth: Array.from(holidayHits.entries()),
  };
}

function festivalSummary(festival, ctx) {
  const monthName =
    ctx.monthNames?.[clampI(festival.startMonth, 0, ctx.monthNames.length - 1)] ||
    `Month ${clampI(festival.startMonth, 0, 100) + 1}`;
  const recurrence = RECURRENCES.find(([v]) => v === festival.recurrence)?.[1] || "Yearly";
  const bits =
    festival.recurrence === "one-off"
      ? [`One-off in Year ${Math.max(1, I(festival.year, 1))}, ${monthName}`]
      : [`${recurrence} from ${monthName}`];
  bits.push(`after day ${clampI(festival.afterDay, 0, 500)}`);
  if (Math.max(1, I(festival.durationDays, 1)) > 1) {
    bits.push(`${Math.max(1, I(festival.durationDays, 1))} days`);
  }
  bits.push(`category ${holidayCategoryLabel(festival.category)}`);
  bits.push(festival.outsideWeekFlow ? "outside weekday flow" : "in weekday flow");
  return bits.join(" | ");
}

function recommendLeapRuleFromOrbit(ctx) {
  const orbitalDays = Math.max(0.000001, N(ctx?.planetOrbitalPeriodDays, 365.2422));
  const solarHours = Math.max(0.000001, N(ctx?.solarDayHours, 24));
  const localYearActual = orbitalDays / (solarHours / 24);
  const monthsPerYear = Math.max(1, I(ctx?.metrics?.monthsPerYear, 12));
  const baseYearLength = getMonthLengthsForYear({
    metrics: ctx?.metrics,
    year: 1,
    leapRules: [],
    monthLengthOverrides: ctx?.monthLengthOverrides,
  }).reduce((sum, days) => sum + days, 0);
  const delta = localYearActual - baseYearLength;
  const absDelta = Math.abs(delta);

  if (!(absDelta > 0.000001)) {
    return {
      ok: false,
      message: "No leap rule needed: baseline year already matches orbital year closely.",
    };
  }

  const maxCycleYears = 5000;
  let bestCycleYears = 1;
  let bestError = Number.POSITIVE_INFINITY;
  for (let cycleYears = 1; cycleYears <= maxCycleYears; cycleYears++) {
    const correction = cycleYears * absDelta;
    const error = Math.abs(correction - 1);
    if (
      error < bestError - 1e-12 ||
      (Math.abs(error - bestError) <= 1e-12 && cycleYears < bestCycleYears)
    ) {
      bestError = error;
      bestCycleYears = cycleYears;
    }
  }

  const dayDelta = delta >= 0 ? 1 : -1;
  const monthIndex = Math.max(0, monthsPerYear - 1);
  const driftPerCycle = bestError;
  const driftPerYear = driftPerCycle / bestCycleYears;
  const quality = driftPerCycle <= 0.02 ? "high" : driftPerCycle <= 0.08 ? "medium" : "low";
  const verb = dayDelta > 0 ? "Add" : "Subtract";
  return {
    ok: true,
    cycleYears: bestCycleYears,
    dayDelta,
    monthIndex,
    driftPerCycle,
    driftPerYear,
    quality,
    localYearActual,
    baseYearLength,
    ruleName: `${verb} 1 day every ${bestCycleYears} years`,
    message:
      `${verb} 1 day every ${bestCycleYears} years ` +
      `(drift ${fmt(driftPerCycle, 4)} d/cycle, ${fmt(driftPerYear, 6)} d/year; quality ${quality}).`,
  };
}

function detailedGrid(model, selectedDay) {
  const head = [
    createElement("th", { className: "calendar-week-col", text: "Week" }),
    ...(model.headers || []).map((header) => createElement("th", { text: header })),
  ];
  const body = (model.rows || []).map((row) =>
    createElement("tr", {}, [
      createElement("th", { className: "calendar-week-col", text: row.weekName }),
      ...(row.cells || []).map((cell) => {
        if (!cell) return createElement("td", { className: "calendar-cell--empty" });
        if (cell.kind === "festival") {
          const label = cell.festival?.name || "Festival";
          const seq =
            I(cell.festival?.segmentCount, 1) > 1
              ? ` ${I(cell.festival?.segment, 1)}/${I(cell.festival?.segmentCount, 1)}`
              : "";
          const marker = cell.festival?.outsideWeekFlow ? "Outside" : "Festival";
          return createElement("td", {}, [
            createElement(
              "div",
              {
                className: "calendar-day-btn calendar-day-btn--festival",
                dataset: { tip: `${label}${seq} (${marker})` },
              },
              [
                createElement("span", { className: "calendar-day-btn__num", text: "F" }),
                createElement("span", {
                  className: "calendar-day-btn__phase",
                  text: `${label}${seq}`,
                }),
              ],
            ),
          ]);
        }
        const classNames = ["calendar-day-btn"];
        if (cell.dayNumber === selectedDay) classNames.push("is-selected");
        if (cell.holidays.length) classNames.push("has-holiday");
        if (cell.holidays.length) classNames.push(holidayColorClass(cell.holidays[0]?.colorTag));
        if ((cell.markers || []).length) classNames.push("has-astronomy");
        if ((cell.cycles || []).length) classNames.push("has-cycle");
        if (cell.moonStates[0]?.phase?.phaseShort === "F") classNames.push("is-full-moon");
        if (cell.moonStates[0]?.phase?.phaseShort === "N") classNames.push("is-new-moon");
        const markers = Array.isArray(cell.markers) ? cell.markers : [];
        const cycles = Array.isArray(cell.cycles) ? cell.cycles : [];
        const markerNames = markers.map((marker) => astronomyMarkerLabel(marker)).join(", ");
        const cycleNames = cycles.map((cycle) => cycleMarkerTip(cycle)).join(", ");
        const holidayDetails = Array.isArray(cell.holidayDetails) ? cell.holidayDetails : [];
        const hasContinuationFromPrev = holidayDetails.some((detail) => !!detail.continuesFromPrev);
        const hasContinuationToNext = holidayDetails.some((detail) => !!detail.continuesToNext);
        const holidayMarkerText = cell.holidays.length
          ? `${hasContinuationFromPrev ? "\u2190" : ""}H${
              cell.holidays.length > 1 ? cell.holidays.length : ""
            }${hasContinuationToNext ? "\u2192" : ""}`
          : "";
        const holidayTip = cell.holidays.length
          ? `Holidays: ${holidayDetails
              .map((detail) => {
                const holiday = detail.holiday || {};
                const continuation = [
                  detail.continuesFromPrev ? "continues from previous day" : "",
                  detail.continuesToNext ? "continues to next day" : "",
                ]
                  .filter(Boolean)
                  .join(", ");
                return `${holiday.name} (${holidayCategoryLabel(holiday.category)})${
                  continuation ? ` [${continuation}]` : ""
                }`;
              })
              .join("; ")}`
          : "";
        return createElement("td", {}, [
          createElement(
            "button",
            {
              className: classNames.join(" "),
              attrs: { type: "button" },
              dataset: { calDay: cell.dayNumber },
            },
            [
              createElement("span", {
                className: "calendar-day-btn__num",
                text: String(cell.dayNumber),
              }),
              createElement("span", { className: "calendar-day-btn__moons" }, [
                ...(cell.moonStates || []).map((moonState, index) =>
                  moonIconNode(moonState, index),
                ),
                markers.length
                  ? createElement(
                      "span",
                      {
                        className: "calendar-day-btn__astro-icons",
                        dataset: { tip: `Astronomy: ${markerNames}` },
                      },
                      markers.map((marker) => astroIconNode(marker)),
                    )
                  : null,
                cycles.length
                  ? createElement(
                      "span",
                      {
                        className: "calendar-day-btn__cycle-icons",
                        dataset: { tip: `Cycles: ${cycleNames}` },
                      },
                      cycles.map((cycle) => cycleIconNode(cycle)),
                    )
                  : null,
              ]),
              cell.holidays.length
                ? createElement("span", {
                    className: "calendar-day-btn__holiday",
                    dataset: { tip: holidayTip },
                    text: holidayMarkerText,
                  })
                : createElement("span", {
                    className: "calendar-day-btn__holiday is-empty",
                    text: "\u00a0",
                  }),
            ],
          ),
        ]);
      }),
    ]),
  );
  return { head, body };
}

function miniGrid(model, selectedDay) {
  const head = (model.headers || []).map((header) => createElement("th", { text: header }));
  const body = (model.rows || []).map((row) =>
    createElement(
      "tr",
      {},
      (row.cells || []).map((cell) => {
        if (!cell) return createElement("td", { className: "calendar-mini-cell is-empty" });
        if (cell.kind === "festival") {
          const label = cell.festival?.name || "Festival";
          const seq =
            I(cell.festival?.segmentCount, 1) > 1
              ? ` ${I(cell.festival?.segment, 1)}/${I(cell.festival?.segmentCount, 1)}`
              : "";
          return createElement("td", { className: "calendar-mini-cell" }, [
            createElement(
              "div",
              {
                className: "calendar-mini-day is-festival",
                dataset: { tip: `${label}${seq}` },
              },
              [
                createElement("span", { className: "calendar-mini-day__num", text: "F" }),
                createElement("span", {
                  className: "calendar-mini-day__holiday",
                  text: label,
                }),
              ],
            ),
          ]);
        }
        const classNames = ["calendar-mini-day"];
        if (cell.dayNumber === selectedDay) classNames.push("is-selected");
        if (cell.holidays.length) classNames.push("has-holiday");
        if (cell.holidays.length) classNames.push(holidayColorClass(cell.holidays[0]?.colorTag));
        if ((cell.markers || []).length) classNames.push("has-astronomy");
        if ((cell.cycles || []).length) classNames.push("has-cycle");
        const holidayCount = cell.holidays.length;
        const markerCount = (cell.markers || []).length;
        const cycleCount = (cell.cycles || []).length;
        const holidayNames = holidayCount
          ? cell.holidays.map((holiday) => holiday.name).join(", ")
          : "";
        const markerNames = markerCount
          ? cell.markers.map((marker) => astronomyMarkerLabel(marker)).join(", ")
          : "";
        const cycleNames = cycleCount
          ? cell.cycles.map((cycle) => cycleMarkerTip(cycle)).join(", ")
          : "";
        const holidayDetails = Array.isArray(cell.holidayDetails) ? cell.holidayDetails : [];
        const hasContinuationFromPrev = holidayDetails.some((detail) => !!detail.continuesFromPrev);
        const hasContinuationToNext = holidayDetails.some((detail) => !!detail.continuesToNext);
        const holidayMarkerPrefix = hasContinuationFromPrev ? "\u2190" : "";
        const holidayMarkerSuffix = hasContinuationToNext ? "\u2192" : "";
        let holidayMark = createElement("span", {
          className: "calendar-mini-day__holiday is-empty",
          attrs: { "aria-hidden": "true" },
          text: "\u00a0",
        });
        if (holidayCount && markerCount) {
          holidayMark = createElement("span", {
            className: "calendar-mini-day__holiday",
            dataset: {
              tip: `Holidays: ${holidayNames}; Astronomy: ${markerNames}; Cycles: ${
                cycleNames || "None"
              }; ${TIPS["Holiday continuation"]}`,
            },
            text: `${holidayMarkerPrefix}H${holidayCount > 1 ? holidayCount : ""}${holidayMarkerSuffix}/A${
              markerCount > 1 ? markerCount : ""
            }${cycleCount ? `/C${cycleCount > 1 ? cycleCount : ""}` : ""}`,
          });
        } else if (holidayCount) {
          holidayMark = createElement("span", {
            className: "calendar-mini-day__holiday",
            dataset: {
              tip: `Holiday${holidayCount > 1 ? "s" : ""}: ${holidayNames}; Cycles: ${
                cycleNames || "None"
              }; ${TIPS["Holiday continuation"]}`,
            },
            text: `${holidayMarkerPrefix}H${holidayCount > 1 ? holidayCount : ""}${holidayMarkerSuffix}${
              cycleCount ? `/C${cycleCount > 1 ? cycleCount : ""}` : ""
            }`,
          });
        } else if (markerCount) {
          holidayMark = createElement("span", {
            className: "calendar-mini-day__holiday calendar-mini-day__holiday--astro",
            dataset: { tip: `Astronomy: ${markerNames}; Cycles: ${cycleNames || "None"}` },
            text: `A${markerCount > 1 ? markerCount : ""}${
              cycleCount ? `/C${cycleCount > 1 ? cycleCount : ""}` : ""
            }`,
          });
        } else if (cycleCount) {
          holidayMark = createElement("span", {
            className: "calendar-mini-day__holiday calendar-mini-day__holiday--cycle",
            dataset: { tip: `Cycles: ${cycleNames}` },
            text: `C${cycleCount > 1 ? cycleCount : ""}`,
          });
        }
        return createElement("td", { className: "calendar-mini-cell" }, [
          createElement(
            "button",
            {
              className: classNames.join(" "),
              attrs: { type: "button" },
              dataset: { calMiniDay: cell.dayNumber },
            },
            [
              createElement("span", {
                className: "calendar-mini-day__num",
                text: String(cell.dayNumber),
              }),
              holidayMark,
            ],
          ),
        ]);
      }),
    ),
  );
  return { head, body };
}

function buildSeasonRangesForYear(yearLengthInput) {
  const yearLength = Math.max(1, I(yearLengthInput, 1));
  const starts = SEASON_MARKER_DEFS.map((def, seasonIndex) => ({
    ...def,
    seasonIndex,
    startDay: clampI(Math.round(yearLength * def.fraction) + 1, 1, yearLength),
  }));
  return starts.map((entry, index) => {
    const nextStart = index < starts.length - 1 ? starts[index + 1].startDay : yearLength + 1;
    return {
      ...entry,
      endDay: Math.max(entry.startDay, nextStart - 1),
    };
  });
}

function buildSeasonBandContent(model, astronomySettings) {
  const settings = normalizeAstronomySettings(astronomySettings);
  if (!settings.enabled || !settings.seasons || !settings.seasonBands) return [];
  const monthLength = Math.max(1, I(model?.monthLength, 1));
  const yearLength = Math.max(1, I(model?.yearLength, monthLength));
  const monthStartDay = Math.max(1, I(model?.daysBeforeMonth, 0) + 1);
  const monthEndDay = Math.min(yearLength, monthStartDay + monthLength - 1);
  const ranges = buildSeasonRangesForYear(yearLength);
  const toPercent = (value) => `${Math.max(0, Math.min(100, N(value, 0))).toFixed(3)}%`;

  const segments = ranges
    .map((range) => {
      const overlapStart = Math.max(monthStartDay, range.startDay);
      const overlapEnd = Math.min(monthEndDay, range.endDay);
      if (overlapEnd < overlapStart) return null;
      const left = ((overlapStart - monthStartDay) / monthLength) * 100;
      const width = ((overlapEnd - overlapStart + 1) / monthLength) * 100;
      return createElement("span", {
        className: `calendar-season-band__segment season-${range.seasonIndex}`,
        attrs: { style: `left:${toPercent(left)};width:${toPercent(width)}` },
        dataset: { tip: `${range.name}: days ${overlapStart}-${overlapEnd} in this month` },
      });
    })
    .filter(Boolean);

  const ticks = ranges
    .filter((range) => range.startDay >= monthStartDay && range.startDay <= monthEndDay)
    .map((range) => {
      const left = ((range.startDay - monthStartDay + 0.5) / monthLength) * 100;
      return createElement(
        "span",
        {
          className: `calendar-season-band__tick season-${range.seasonIndex}`,
          attrs: { style: `left:${toPercent(left)}` },
          dataset: { tip: `${range.name} begins on day ${range.startDay} of the year` },
        },
        createElement("span", {
          className: "calendar-season-band__tick-label",
          text: range.short,
        }),
      );
    });

  return [
    createElement("div", {
      className: "calendar-season-band__meta",
      text: `Season band | Year days ${monthStartDay}-${monthEndDay} of ${yearLength}`,
    }),
    createElement("div", { className: "calendar-season-band__track" }, [...segments, ...ticks]),
  ];
}

function sliderField(id, label, unit, hint, min, max, step, tip) {
  const u = unit ? ` <span class="unit">${unit}</span>` : "";
  return `<div class="form-row"><div><div class="label">${label}${u} ${tipIcon(tip || "")}</div><div class="hint">${hint || ""}</div></div><div class="input-pair"><input id="${id}" type="number" step="${step}" aria-label="${label}" /><input id="${id}_slider" type="range" aria-label="${label} slider" /><div class="range-meta"><span id="${id}_min"></span><span id="${id}_max"></span></div></div></div>`;
}

function bindPair(root, id, min, max, step) {
  const n = root.querySelector(`#${id}`);
  const s = root.querySelector(`#${id}_slider`);
  const mn = root.querySelector(`#${id}_min`);
  const mx = root.querySelector(`#${id}_max`);
  if (!n || !s || !mn || !mx) return null;
  mn.textContent = String(min);
  mx.textContent = String(max);
  return bindNumberAndSlider({ numberEl: n, sliderEl: s, min, max, step, mode: "linear" });
}

export function initCalendarPage(mountEl) {
  const state = readState(loadWorld());
  const runtime = { editingHolidayId: null, editingFestivalId: null, editingCycleId: null };

  const wrap = document.createElement("div");
  wrap.className = "page";
  wrap.innerHTML = `
    <div class="panel"><div class="panel__header"><h1 class="panel__title"><span class="ws-icon icon--calendar" aria-hidden="true"></span><span>Calendar</span></h1><button id="calTutorials" type="button" class="ws-tutorial-trigger" data-tip="${esc(TIPS.Tutorials || "")}">Tutorials</button></div><div class="panel__body"><div class="hint">Build a usable calendar from selected planet/moons, then inspect compact and detailed views.</div></div></div>
    <div class="calendar-workspace">
      <div class="calendar-toolbar">
        <div class="calendar-toolbar__left">
          <select id="calProfileSelect" class="calendar-toolbar__profile" data-tip="${esc(TIPS["Calendar profile"] || "")}"></select>
          <button id="calProfileNew" type="button" class="small" data-tip="${esc(TIPS["New profile"] || "")}">New</button>
          <button id="calProfileDuplicate" type="button" class="small" data-tip="${esc(TIPS["Duplicate profile"] || "")}">Dup</button>
          <button id="calProfileDelete" class="small danger" type="button" data-tip="${esc(TIPS["Delete profile"] || "")}">Del</button>
        </div>
        <div class="calendar-toolbar__nav">
          <button id="calPrevMonth" type="button" class="calendar-toolbar__btn" data-tip="${esc(TIPS["Previous month"] || "")}">\u2190</button>
          <select id="calMonth" class="calendar-toolbar__select" data-tip="${esc(TIPS.Month || "")}"></select>
          <input id="calYear" type="number" min="1" step="1" class="calendar-toolbar__year" data-tip="${esc(TIPS.Year || "")}" />
          <button id="calNextMonth" type="button" class="calendar-toolbar__btn" data-tip="${esc(TIPS["Next month"] || "")}">\u2192</button>
        </div>
        <div class="calendar-toolbar__right">
          <button id="calDrawerToggle" type="button" class="calendar-toolbar__btn" data-tip="${esc(TIPS["Toggle settings"] || "")}" aria-label="Toggle settings">\u276E</button>
          <button id="calOpenDetail" type="button" class="calendar-toolbar__btn" data-tip="${esc(TIPS["Open detailed view"] || "")}">Detailed Calendar</button>
        </div>
      </div>
      <div class="calendar-drawer" id="calDrawer">
        <div class="calendar-drawer__tabs">
          <button type="button" class="calendar-drawer__tab is-active" data-drawer-tab="structure">Structure</button>
          <button type="button" class="calendar-drawer__tab" data-drawer-tab="identity">Identity</button>
          <button type="button" class="calendar-drawer__tab" data-drawer-tab="rules">Rules</button>
          <button type="button" class="calendar-drawer__tab" data-drawer-tab="output">Output</button>
        </div>
        <div class="calendar-drawer__body">
        <section data-drawer-section="structure" class="calendar-drawer__section">
        <div class="panel"><div class="panel__header"><h2>Inputs</h2></div><div class="panel__body">
          <div class="form-row"><div><div class="label">Source planet ${tipIcon(TIPS["Source planet"] || "")}</div></div><select id="calSourcePlanet"></select></div>
          <div class="form-row"><div><div class="label">Primary moon ${tipIcon(TIPS["Primary moon"] || "")}</div></div><select id="calPrimaryMoon"></select></div>
          <div class="form-row"><div><div class="label">Extra moon 1 ${tipIcon(TIPS["Extra moon"] || "")}</div></div><select id="calExtraMoon1"></select></div>
          <div class="form-row"><div><div class="label">Extra moon 2 ${tipIcon(TIPS["Extra moon"] || "")}</div></div><select id="calExtraMoon2"></select></div>
          <div class="form-row"><div><div class="label">Extra moon 3 ${tipIcon(TIPS["Extra moon"] || "")}</div></div><select id="calExtraMoon3"></select></div>
          <div class="form-row"><div><div class="label">Basis ${tipIcon(TIPS.Basis || "")}</div></div><select id="calBasis"><option value="solar">Solar</option><option value="lunar">Lunar</option><option value="lunisolar">Lunisolar</option></select></div>
          <details class="calendar-derived-details" open>
            <summary>Orbital data</summary>
            <div class="derived-readout" id="calDerivedData"></div>
            <div class="form-row"><div><div class="label">Round derived data ${tipIcon(TIPS["Decimal places"] || "")}</div></div><div class="calendar-holiday-attrs__list"><label class="calendar-holiday-attr"><input id="calDerivedRoundEnabled" type="checkbox" />Enable</label></div></div>
            ${sliderField("calDerivedDecimalPlaces", "Decimal places", "", "", 0, 6, 1, "")}
          </details>
          ${sliderField("calMonthsPerYear", "Months per year", "", "Linked to lunar cycles by default.", 1, 60, 1, TIPS["Months per year"])}
          ${sliderField("calDaysPerMonth", "Days per month", "", "Linked to orbital data by default.", 1, 120, 1, TIPS["Days per month"])}
          ${sliderField("calDaysPerWeek", "Days per week", "", "Linked to days per month by default.", 1, 30, 1, TIPS["Days per week"])}
          <div class="derived-readout" id="calStructureInfo"></div>
          <div class="button-row"><button id="calUseSelected" type="button" data-tip="${esc(TIPS["Use selected objects"] || "")}">Use selected objects</button></div>
        </div></div>
        </section>
        <section data-drawer-section="identity" class="calendar-drawer__section" hidden>
        <div class="panel"><div class="panel__header"><h2>Calendar Designer</h2><div class="calendar-section-info">${tipIcon(TIPS["Calendar Designer section"] || "")}</div></div><div class="panel__body">
          <div class="form-row"><div><div class="label">Calendar name ${tipIcon(TIPS["Calendar name"] || "")}</div></div><input id="calCalendarName" type="text" /></div>
          <div class="form-row"><div><div class="label">Start day of year ${tipIcon(TIPS["Start day of year"] || "")}</div></div><select id="calStartDay"></select></div>
          <div class="form-row"><div><div class="label">Week starts on ${tipIcon(TIPS["Week starts on"] || "")}</div></div><select id="calWeekStart"></select></div>
          <div class="form-row"><div><div class="label">Moon epoch offset <span class="unit">days</span> ${tipIcon(TIPS["Moon epoch offset"] || "")}</div></div><input id="calMoonEpoch" type="number" step="0.1" /></div>
          <div class="form-row"><div><div class="label">Year display mode ${tipIcon(TIPS["Year display mode"] || "")}</div></div><select id="calYearDisplayMode"><option value="numeric">Custom year number</option><option value="era">Era + year</option><option value="pre-calendar">Pre/Post calendar eras</option></select></div>
          <div class="form-row"><div><div class="label">Year offset ${tipIcon(TIPS["Year offset"] || "")}</div></div><input id="calYearOffset" type="number" step="1" /></div>
          <div class="form-row"><div><div class="label">Year prefix ${tipIcon(TIPS["Year prefix"] || "")}</div></div><input id="calYearPrefix" type="text" /></div>
          <div class="form-row"><div><div class="label">Year suffix ${tipIcon(TIPS["Year suffix"] || "")}</div></div><input id="calYearSuffix" type="text" /></div>
          <div class="form-row calendar-pre-era-row"><div><div class="label">Post-calendar start year ${tipIcon(TIPS["Post-calendar start year"] || "")}</div></div><input id="calPreCalendarStartYear" type="number" min="1" step="1" /></div>
          <div class="form-row calendar-pre-era-row"><div><div class="label">Post-era label ${tipIcon(TIPS["Post-era label"] || "")}</div></div><input id="calPostEraLabel" type="text" /></div>
          <div class="form-row calendar-pre-era-row"><div><div class="label">Pre-era label ${tipIcon(TIPS["Pre-era label"] || "")}</div></div><input id="calPreEraLabel" type="text" /></div>
          <div class="form-row calendar-pre-era-row"><div><div class="label">Use year zero ${tipIcon(TIPS["Use year zero"] || "")}</div></div><label class="calendar-holiday-attr"><input id="calPreCalendarUseYearZero" type="checkbox" />Astronomical numbering</label></div>
          <div class="form-row calendar-name-row"><div><div class="label">Day names ${tipIcon(TIPS["Day names"] || "")}</div><div class="hint">One per line.</div></div><textarea id="calDayNames" class="calendar-textarea"></textarea></div>
          <div class="form-row calendar-name-row"><div><div class="label">Week names ${tipIcon(TIPS["Week names"] || "")}</div><div class="hint">One per line.</div></div><textarea id="calWeekNames" class="calendar-textarea"></textarea></div>
          <div class="form-row calendar-name-row"><div><div class="label">Month names ${tipIcon(TIPS["Month names"] || "")}</div><div class="hint">One per line.</div></div><textarea id="calMonthNames" class="calendar-textarea"></textarea></div>
          <div class="form-row"><div><div class="label">Month lengths ${tipIcon(TIPS["Month lengths"] || "")}</div></div><div class="calendar-holiday-attrs__list"><label class="calendar-holiday-attr"><input id="calMonthLengthOverridesEnabled" type="checkbox" />Enable</label></div></div>
          <div class="form-row calendar-name-row" id="calMonthLengthOverridesRow"><div><div class="hint">One number per line. Blank = base.</div></div><textarea id="calMonthLengthOverrides" class="calendar-textarea" placeholder="e.g.\n31\n28\n31\n30"></textarea></div>

          <div class="label">Eras ${tipIcon(TIPS["Era list"] || "")}</div>
          <div class="form-row"><div><div class="label">Era label ${tipIcon(TIPS["Era label"] || "")}</div></div><input id="calEraName" type="text" /></div>
          <div class="form-row"><div><div class="label">Era start year ${tipIcon(TIPS["Era start year"] || "")}</div></div><input id="calEraStartYear" type="number" min="1" step="1" /></div>
          <div class="button-row"><button id="calEraAdd" type="button" data-tip="${esc(TIPS["Add era"] || "")}">Add era</button></div>
          <div id="calEraList" class="calendar-item-list" data-tip="${esc(TIPS["Era list"] || "")}"></div>

          <div class="button-row"><button id="calResetNames" type="button" data-tip="${esc(TIPS["Reset names"] || "")}">Reset names</button></div>
        </div></div>
        </section>
        <section data-drawer-section="output" class="calendar-drawer__section" hidden>
        <div class="panel"><div class="panel__header"><h2>Calendar Data</h2><div class="calendar-section-info">${tipIcon(TIPS["Calendar Data section"] || "")}</div></div><div class="panel__body">
          <div class="hint">Export or import calendar settings only (does not replace world generation data).</div>
          <div style="height:10px"></div>
          <div class="io-actions">
            <button id="calExportDownload" type="button" data-tip="${esc(TIPS["Download calendar JSON"] || "")}">Download calendar JSON</button>
            <button id="calExportCopy" type="button" data-tip="${esc(TIPS["Copy calendar JSON"] || "")}">Copy calendar JSON</button>
            <button id="calImportFileBtn" type="button" data-tip="${esc(TIPS["Import calendar JSON file"] || "")}">Import JSON file</button>
            <input id="calImportFile" type="file" accept="application/json,.json" style="display:none" />
          </div>
          <div style="height:10px"></div>
          <textarea id="calJsonText" class="io-textarea" spellcheck="false" placeholder="{ ...calendar json... }" data-tip="${esc(TIPS["Calendar JSON"] || "")}"></textarea>
          <div class="io-actions" style="margin-top:10px;">
            <button class="primary" id="calImportApply" type="button" data-tip="${esc(TIPS["Apply pasted calendar JSON"] || "")}">Apply pasted JSON</button>
            <button id="calJsonLoadCurrent" type="button" data-tip="${esc(TIPS["Calendar JSON"] || "")}">Load current</button>
          </div>
          <div id="calJsonStatus" class="io-status" data-kind="info"></div>
        </div></div>

        <div class="panel"><div class="panel__header"><h2>Output & Utility</h2><div class="calendar-section-info">${tipIcon(TIPS["Output & Utility section"] || "")}</div></div><div class="panel__body">
          <div class="label">Astronomy markers ${tipIcon(TIPS["Astronomy markers"] || "")}</div>
          <div class="calendar-holiday-form">
            <div class="form-row calendar-holiday-attrs"><div><div class="label">Show markers in calendar ${tipIcon(TIPS["Astronomy markers"] || "")}</div></div><div class="calendar-holiday-attrs__list"><label class="calendar-holiday-attr"><input id="calMarkerEnabled" type="checkbox" />Enabled</label></div></div>
            <div class="form-row calendar-holiday-attrs"><div><div class="label">Marker types</div></div><div class="calendar-holiday-attrs__list"><label class="calendar-holiday-attr"><input id="calMarkerSeasons" type="checkbox" />Seasons ${tipIcon(TIPS["Season markers"] || "")}</label><label class="calendar-holiday-attr"><input id="calMarkerSeasonBands" type="checkbox" />Season bands ${tipIcon(TIPS["Season bands"] || "")}</label><label class="calendar-holiday-attr"><input id="calMarkerEclipses" type="checkbox" />Eclipses ${tipIcon(TIPS["Eclipse markers"] || "")}</label></div></div>
          </div>

          <div style="height:10px"></div>
          <div class="label">Printable PDF</div>
          <div class="io-actions">
            <button id="calPdfMonth" type="button" data-tip="${esc(TIPS["PDF month export"] || "")}">Export month PDF</button>
            <button id="calPdfYear" type="button" data-tip="${esc(TIPS["PDF year export"] || "")}">Export year PDF</button>
          </div>

          <div style="height:10px"></div>
          <div class="label">ICS export</div>
          <div class="form-row"><div><div class="label">Anchor date ${tipIcon(TIPS["ICS anchor date"] || "")}</div><div class="hint">Maps Year 1 Month 1 Day 1 to this Gregorian date.</div></div><input id="calIcsAnchor" type="date" /></div>
          <div class="form-row calendar-holiday-attrs"><div><div class="label">Include in ICS</div></div><div class="calendar-holiday-attrs__list"><label class="calendar-holiday-attr"><input id="calIcsIncHolidays" type="checkbox" />Holidays ${tipIcon(TIPS["ICS include holidays"] || "")}</label><label class="calendar-holiday-attr"><input id="calIcsIncFestivals" type="checkbox" />Festivals ${tipIcon(TIPS["ICS include festivals"] || "")}</label><label class="calendar-holiday-attr"><input id="calIcsIncMarkers" type="checkbox" />Markers ${tipIcon(TIPS["ICS include markers"] || "")}</label></div></div>
          <div class="io-actions">
            <button id="calIcsMonth" type="button" data-tip="${esc(TIPS["ICS month export"] || "")}">Export month ICS</button>
            <button id="calIcsYear" type="button" data-tip="${esc(TIPS["ICS year export"] || "")}">Export year ICS</button>
          </div>
          <div id="calOutputStatus" class="io-status" data-kind="info"></div>
        </div></div>
        </section>
        <section data-drawer-section="rules" class="calendar-drawer__section" hidden>
        <div class="calendar-drawer__subtabs">
          <button class="calendar-drawer__subtab is-active" data-rules-tab="holidays">Holidays</button>
          <button class="calendar-drawer__subtab" data-rules-tab="festivals">Festivals</button>
          <button class="calendar-drawer__subtab" data-rules-tab="leap">Leap Years</button>
          <button class="calendar-drawer__subtab" data-rules-tab="cycles">Cycles</button>
        </div>
        <div data-rules-section="holidays">
        <div class="panel"><div class="panel__header"><h2>Special Days</h2><div class="calendar-section-info">${tipIcon(TIPS["Special Days section"] || "")}</div></div><div class="panel__body">
          <div id="calHolidayList" class="calendar-item-list" data-tip="${esc(TIPS.Holidays || "")}"></div>
          <div class="label">Holidays ${tipIcon(TIPS.Holidays || "")}</div>
          <div class="calendar-holiday-form">
            <div class="form-row"><div><div class="label">Holiday name ${tipIcon(TIPS["Holiday name"] || "")}</div></div><input id="calHolidayName" type="text" /></div>
            <div class="form-row"><div><div class="label">Holiday category ${tipIcon(TIPS["Holiday category"] || "")}</div></div><select id="calHolidayCategory">${holidayCategoryOptionsHtml()}</select></div>
            <div class="form-row"><div><div class="label">Holiday colour ${tipIcon(TIPS["Holiday colour"] || "")}</div></div><select id="calHolidayColorTag">${holidayColorOptionsHtml()}</select></div>
            <div class="form-row"><div><div class="label">Recurrence ${tipIcon(TIPS.Recurrence || "")}</div></div><select id="calHolidayRecurrence"></select></div>
            <div class="form-row calendar-holiday-attrs"><div><div class="label">Advanced options ${tipIcon(TIPS["Holiday advanced toggle"] || "")}</div></div><div class="calendar-holiday-attrs__list"><label class="calendar-holiday-attr"><input id="calHolidayAdvancedToggle" type="checkbox" />Enable advanced options</label></div></div>
            <div class="form-row"><div><div class="label">Holiday year ${tipIcon(TIPS["Holiday year"] || "")}</div><div class="hint">Used for one-off rules.</div></div><input id="calHolidayYear" type="number" min="1" step="1" /></div>
            <div class="form-row calendar-holiday-attrs"><div><div class="label">Attributes ${tipIcon(TIPS.Attributes || "")}</div></div><div class="calendar-holiday-attrs__list"><label class="calendar-holiday-attr"><input id="calHolidayUseDate" type="checkbox" checked />Date</label><label class="calendar-holiday-attr"><input id="calHolidayUseWeekday" type="checkbox" />Weekday</label><label class="calendar-holiday-attr"><input id="calHolidayUseMoon" type="checkbox" />Moon phase</label></div></div>
            <div class="form-row calendar-holiday-attrs"><div><div class="label">Relative trigger ${tipIcon(TIPS["Use relative trigger"] || "")}</div></div><div class="calendar-holiday-attrs__list"><label class="calendar-holiday-attr"><input id="calHolidayUseRelative" type="checkbox" />Use relative trigger</label></div></div>
            <div class="form-row"><div><div class="label">Relative type ${tipIcon(TIPS["Relative trigger type"] || "")}</div></div><select id="calHolidayRelativeType"></select></div>
            <div class="form-row"><div><div class="label">Relative offset <span class="unit">days</span> ${tipIcon(TIPS["Relative offset days"] || "")}</div><div class="hint">Negative = before, positive = after.</div></div><input id="calHolidayRelativeOffset" type="number" step="1" /></div>
            <div class="form-row"><div><div class="label">Relative moon ${tipIcon(TIPS["Relative moon slot"] || "")}</div></div><select id="calHolidayRelativeMoonSlot"></select></div>
            <div class="form-row"><div><div class="label">Relative moon phase ${tipIcon(TIPS["Relative moon phase"] || "")}</div></div><select id="calHolidayRelativeMoonPhase"></select></div>
            <div class="form-row"><div><div class="label">Relative marker ${tipIcon(TIPS["Relative marker"] || "")}</div></div><select id="calHolidayRelativeMarker"></select></div>
            <div class="form-row"><div><div class="label">Relative holiday ${tipIcon(TIPS["Relative holiday"] || "")}</div></div><select id="calHolidayRelativeHoliday"></select></div>
            <div class="form-row calendar-holiday-advanced"><div><div class="label">Anchor type ${tipIcon(TIPS["Holiday anchor type"] || "")}</div></div><select id="calHolidayAnchorType"></select></div>
            <div class="form-row calendar-holiday-advanced"><div><div class="label">Algorithm ${tipIcon(TIPS["Holiday algorithm"] || "")}</div></div><select id="calHolidayAlgorithm"></select></div>
            <div class="form-row calendar-holiday-advanced"><div><div class="label">Anchor moon ${tipIcon(TIPS["Relative moon slot"] || "")}</div></div><select id="calHolidayAnchorMoonSlot"></select></div>
            <div class="form-row calendar-holiday-advanced"><div><div class="label">Anchor moon phase ${tipIcon(TIPS["Relative moon phase"] || "")}</div></div><select id="calHolidayAnchorMoonPhase"></select></div>
            <div class="form-row calendar-holiday-advanced"><div><div class="label">Anchor marker ${tipIcon(TIPS["Relative marker"] || "")}</div></div><select id="calHolidayAnchorMarker"></select></div>
            <div class="form-row calendar-holiday-advanced"><div><div class="label">Anchor holiday ${tipIcon(TIPS["Relative holiday"] || "")}</div></div><select id="calHolidayAnchorHoliday"></select></div>
            <div class="form-row calendar-holiday-advanced"><div><div class="label">Anchor offset <span class="unit">days</span> ${tipIcon(TIPS["Holiday anchor offset"] || "")}</div></div><input id="calHolidayAnchorOffset" type="number" step="1" /></div>
            <div class="form-row calendar-holiday-advanced"><div><div class="label">Conflict handling ${tipIcon(TIPS["Holiday conflict rule"] || "")}</div></div><select id="calHolidayConflictRule"></select></div>
            <div class="form-row calendar-holiday-advanced"><div><div class="label">Max shift <span class="unit">days</span> ${tipIcon(TIPS["Holiday max shift"] || "")}</div></div><input id="calHolidayMaxShiftDays" type="number" min="0" step="1" /></div>
            <div class="form-row calendar-holiday-advanced calendar-holiday-attrs"><div><div class="label">Shift constraints ${tipIcon(TIPS["Holiday stay in month"] || "")}</div></div><div class="calendar-holiday-attrs__list"><label class="calendar-holiday-attr"><input id="calHolidayStayInMonth" type="checkbox" />Keep shifts in same month</label></div></div>
            <div class="form-row calendar-holiday-advanced"><div><div class="label">Conflict scope ${tipIcon(TIPS["Holiday conflict scope"] || "")}</div></div><select id="calHolidayConflictScope"></select></div>
            <div class="form-row calendar-holiday-advanced"><div><div class="label">Conflict categories ${tipIcon(TIPS["Holiday conflict categories"] || "")}</div><div class="hint">Used when scope is Same category.</div></div><input id="calHolidayConflictCategories" type="text" placeholder="civic, religious" /></div>
            <div class="form-row calendar-holiday-advanced"><div><div class="label">Conflict holiday IDs ${tipIcon(TIPS["Holiday conflict ids"] || "")}</div><div class="hint">Used when scope is Specific holidays.</div></div><input id="calHolidayConflictHolidayIds" type="text" placeholder="holiday-1, holiday-2" /></div>
            <div class="form-row"><div><div class="label">Start month ${tipIcon(TIPS["Start month"] || "")}</div></div><select id="calHolidayStartMonth"></select></div>
            <div class="form-row"><div><div class="label">Day of month ${tipIcon(TIPS["Day of month"] || "")}</div><div class="hint">Date match.</div></div><input id="calHolidayDayOfMonth" type="number" min="1" step="1" /></div>
            <div class="form-row"><div><div class="label">Duration <span class="unit">days</span> ${tipIcon(TIPS["Holiday duration"] || "")}</div><div class="hint">Consecutive days from start day.</div></div><input id="calHolidayDuration" type="number" min="1" step="1" /></div>
            <div class="form-row"><div><div class="label">Priority ${tipIcon(TIPS["Holiday priority"] || "")}</div><div class="hint">Higher priority wins when override mode applies.</div></div><input id="calHolidayPriority" type="number" step="1" /></div>
            <div class="form-row"><div><div class="label">Merge mode ${tipIcon(TIPS["Holiday merge mode"] || "")}</div></div><select id="calHolidayMergeMode"></select></div>
            <div class="form-row"><div><div class="label">Weekday rule ${tipIcon(TIPS["Weekday rule"] || "")}</div><div class="hint">Weekday match.</div></div><select id="calHolidayWeekday"></select></div>
            <div class="form-row"><div><div class="label">Occurrence ${tipIcon(TIPS.Occurrence || "")}</div></div><select id="calHolidayOccurrence"></select></div>
            <div class="form-row"><div><div class="label">Moon slot ${tipIcon(TIPS["Moon slot"] || "")}</div></div><select id="calHolidayMoonSlot"></select></div>
            <div class="form-row"><div><div class="label">Moon phase ${tipIcon(TIPS["Moon phase"] || "")}</div></div><select id="calHolidayMoonPhase"></select></div>
            <div class="form-row"><div><div class="label">Skip years ${tipIcon(TIPS["Holiday exception years"] || "")}</div><div class="hint">Comma-separated.</div></div><input id="calHolidayExceptYears" type="text" placeholder="2, 5, 19" /></div>
            <div class="form-row"><div><div class="label">Skip months ${tipIcon(TIPS["Holiday exception months"] || "")}</div><div class="hint">1-based month numbers.</div></div><input id="calHolidayExceptMonths" type="text" placeholder="1, 7" /></div>
            <div class="form-row"><div><div class="label">Skip days ${tipIcon(TIPS["Holiday exception days"] || "")}</div><div class="hint">Day numbers in month.</div></div><input id="calHolidayExceptDays" type="text" placeholder="13" /></div>
            <div class="button-row"><button class="primary" id="calHolidaySave" type="button" data-tip="${esc(TIPS["Add holiday"] || "")}">Add holiday</button><button id="calHolidayCancel" type="button" style="display:none" data-tip="${esc(TIPS["Cancel holiday edit"] || "")}">Cancel edit</button></div>
          </div>
        </div></div>
        </div>

        <div data-rules-section="festivals" hidden>
        <div class="panel"><div class="panel__header"><h2>Festival Days</h2><div class="calendar-section-info">${tipIcon(TIPS["Festival Days section"] || "")}</div></div><div class="panel__body">
          <div id="calFestivalList" class="calendar-item-list" data-tip="${esc(TIPS["Festival list"] || "")}"></div>
          <div class="label">Festival / intercalary days ${tipIcon(TIPS["Festival days"] || "")}</div>
          <div class="calendar-holiday-form">
            <div class="form-row"><div><div class="label">Festival name ${tipIcon(TIPS["Festival name"] || "")}</div></div><input id="calFestivalName" type="text" /></div>
            <div class="form-row"><div><div class="label">Recurrence ${tipIcon(TIPS["Festival recurrence"] || "")}</div></div><select id="calFestivalRecurrence"></select></div>
            <div class="form-row"><div><div class="label">Festival year ${tipIcon(TIPS["Festival year"] || "")}</div><div class="hint">Used for one-off rules.</div></div><input id="calFestivalYear" type="number" min="1" step="1" /></div>
            <div class="form-row"><div><div class="label">Start month ${tipIcon(TIPS["Festival start month"] || "")}</div></div><select id="calFestivalStartMonth"></select></div>
            <div class="form-row"><div><div class="label">After day ${tipIcon(TIPS["Festival after day"] || "")}</div><div class="hint">0 inserts before day 1.</div></div><input id="calFestivalAfterDay" type="number" min="0" step="1" /></div>
            <div class="form-row"><div><div class="label">Duration <span class="unit">days</span> ${tipIcon(TIPS["Festival duration"] || "")}</div></div><input id="calFestivalDuration" type="number" min="1" step="1" /></div>
            <div class="form-row calendar-holiday-attrs"><div><div class="label">Behaviour ${tipIcon(TIPS["Festival outside week"] || "")}</div></div><div class="calendar-holiday-attrs__list"><label class="calendar-holiday-attr"><input id="calFestivalOutsideWeek" type="checkbox" />Outside weekday flow</label></div></div>
            <div class="button-row"><button class="primary" id="calFestivalSave" type="button" data-tip="${esc(TIPS["Add festival"] || "")}">Add festival</button><button id="calFestivalCancel" type="button" style="display:none" data-tip="${esc(TIPS["Cancel festival edit"] || "")}">Cancel edit</button></div>
          </div>
        </div></div>
        </div>

        <div data-rules-section="leap" hidden>
        <div class="panel"><div class="panel__header"><h2>Leap Years</h2><div class="calendar-section-info">${tipIcon(TIPS["Leap Years section"] || "")}</div></div><div class="panel__body">
          <div class="button-row"><button id="calLeapSuggest" class="primary" type="button" data-tip="${esc(TIPS["Suggest leap rule"] || "")}">Suggest leap rule</button></div>
          <div id="calLeapStatus" class="io-status" data-kind="info"></div>
          <div id="calLeapList" class="calendar-item-list" data-tip="${esc(TIPS["Leap list"] || "")}"></div>
          <div class="label">Leap rules ${tipIcon(TIPS["Leap rules"] || "")}</div>
          <div class="calendar-holiday-form">
            <div class="form-row"><div><div class="label">Rule name ${tipIcon(TIPS["Leap rule name"] || "")}</div></div><input id="calLeapName" type="text" placeholder="Rule name" /></div>
            <div class="form-row"><div><div class="label">Cycle <span class="unit">years</span> ${tipIcon(TIPS["Leap cycle"] || "")}</div></div><input id="calLeapCycle" type="number" min="1" step="1" placeholder="4" /></div>
            <div class="form-row"><div><div class="label">Start year ${tipIcon(TIPS["Leap start year"] || "")}</div></div><input id="calLeapOffset" type="number" min="1" step="1" placeholder="1" /></div>
            <div class="form-row"><div><div class="label">Target month ${tipIcon(TIPS["Leap month"] || "")}</div></div><select id="calLeapMonth"></select></div>
            <div class="form-row"><div><div class="label">Day delta <span class="unit">days</span> ${tipIcon(TIPS["Leap day delta"] || "")}</div></div><input id="calLeapDelta" type="number" min="-30" max="30" step="1" placeholder="+/- days" /></div>
            <div class="button-row"><button id="calLeapAdd" type="button" data-tip="${esc(TIPS["Add leap rule"] || "")}">Add rule</button></div>
          </div>
        </div></div>
        </div>

        <div data-rules-section="cycles" hidden>
        <div class="panel"><div class="panel__header"><h2>Work/Rest Cycles</h2><div class="calendar-section-info">${tipIcon(TIPS["Work/Rest Cycles section"] || "")}</div></div><div class="panel__body">
          <div id="calCycleList" class="calendar-item-list" data-tip="${esc(TIPS["Cycle list"] || "")}"></div>
          <div class="label">Cycle rules ${tipIcon(TIPS["Cycle list"] || "")}</div>
          <div class="calendar-holiday-form">
            <div class="form-row"><div><div class="label">Rule name ${tipIcon(TIPS["Cycle rule name"] || "")}</div></div><input id="calCycleName" type="text" placeholder="Work cycle" /></div>
            <div class="form-row"><div><div class="label">Mode ${tipIcon(TIPS["Cycle rule mode"] || "")}</div></div><select id="calCycleMode"></select></div>
            <div class="form-row"><div><div class="label">Weekend handling ${tipIcon(TIPS["Weekend handling"] || "")}</div><div class="hint">Applies globally to holiday observance shifts.</div></div><select id="calCycleWeekendRule"></select></div>
            <div class="form-row calendar-holiday-attrs"><div><div class="label">Weekend days ${tipIcon(TIPS["Weekend days"] || "")}</div></div><div class="calendar-holiday-attrs__list" id="calWeekendDays"></div></div>
            <div class="form-row"><div><div class="label">Start absolute day ${tipIcon(TIPS["Cycle start day"] || "")}</div><div class="hint">Day 0 is Year 1, Month 1, Day 1.</div></div><input id="calCycleStartDay" type="number" min="0" step="1" /></div>
            <div class="form-row"><div><div class="label">On days ${tipIcon(TIPS["Cycle on days"] || "")}</div></div><input id="calCycleOnDays" type="number" min="1" step="1" /></div>
            <div class="form-row"><div><div class="label">Off days ${tipIcon(TIPS["Cycle off days"] || "")}</div></div><input id="calCycleOffDays" type="number" min="1" step="1" /></div>
            <div class="form-row"><div><div class="label">Interval days ${tipIcon(TIPS["Cycle interval days"] || "")}</div></div><input id="calCycleIntervalDays" type="number" min="1" step="1" /></div>
            <div class="form-row"><div><div class="label">Active label ${tipIcon(TIPS["Cycle active label"] || "")}</div></div><input id="calCycleActiveLabel" type="text" /></div>
            <div class="form-row"><div><div class="label">Rest label ${tipIcon(TIPS["Cycle rest label"] || "")}</div></div><input id="calCycleRestLabel" type="text" /></div>
            <div class="form-row"><div><div class="label">Marker label ${tipIcon(TIPS["Cycle marker label"] || "")}</div></div><input id="calCycleMarkerLabel" type="text" /></div>
            <div class="form-row"><div><div class="label">Active short ${tipIcon(TIPS["Cycle active short"] || "")}</div></div><input id="calCycleActiveShort" type="text" maxlength="3" /></div>
            <div class="form-row"><div><div class="label">Rest short ${tipIcon(TIPS["Cycle rest short"] || "")}</div></div><input id="calCycleRestShort" type="text" maxlength="3" /></div>
            <div class="form-row"><div><div class="label">Marker short ${tipIcon(TIPS["Cycle marker short"] || "")}</div></div><input id="calCycleMarkerShort" type="text" maxlength="3" /></div>
            <div class="button-row"><button class="primary" id="calCycleSave" type="button" data-tip="${esc(TIPS["Add cycle rule"] || "")}">Add cycle rule</button><button id="calCycleCancel" type="button" style="display:none" data-tip="${esc(TIPS["Cancel cycle edit"] || "")}">Cancel edit</button></div>
          </div>
        </div></div>
        </div>
        </section>
        </div>
      </div>
      <div class="calendar-drawer-backdrop is-hidden" id="calDrawerBackdrop"></div>

      <div class="panel calendar-month-panel"><div class="panel__header"><h2>Month View</h2></div><div class="panel__body"><div class="calendar-month-title" id="calMonthTitle" data-tip="${esc(TIPS["Month summary"] || "")}"></div><div class="calendar-chip-row" id="calChipRow" data-tip="${esc(TIPS["Moon summary chips"] || "")}"></div><div class="calendar-season-band" id="calSeasonBand" data-tip="${esc(TIPS["Season bands"] || "")}" hidden></div><div class="calendar-holiday-filter-bar" id="calHolidayFilters" data-tip="${esc(TIPS["Holiday filters"] || "")}">${holidayFilterControlsHtml()}</div><div class="calendar-mini-grid-wrap" data-tip="${esc(TIPS["Simple calendar"] || "")}"><table class="calendar-mini-grid"><thead><tr id="calMiniHead"></tr></thead><tbody id="calMiniBody"></tbody></table></div><div class="calendar-selected-day" id="calSelectedDay" data-tip="${esc(TIPS["Selected day"] || "")}"></div><div class="calendar-date-tools" data-tip="${esc(TIPS["Date converter"] || "")}"><div class="calendar-date-tools__title">Date Converter ${tipIcon(TIPS["Date converter"] || "")}</div><div class="calendar-date-tools__row"><label>Absolute day ${tipIcon(TIPS["Absolute day"] || "")}</label><input id="calJumpAbs" type="number" min="0" step="1" /><button id="calJumpAbsBtn" type="button" data-tip="${esc(TIPS["Jump absolute day"] || "")}">Jump</button></div><div class="calendar-date-tools__row"><label>Year</label><input id="calJumpYear" type="number" min="1" step="1" /><label>Month</label><select id="calJumpMonth"></select><label>Day</label><input id="calJumpDay" type="number" min="1" step="1" /><button id="calJumpDateBtn" type="button" data-tip="${esc(TIPS["Jump date"] || "")}">Jump</button></div></div><div class="calendar-compact-summary"><div class="calendar-moon-legend" id="calMoonLegend" data-tip="${esc(TIPS["Moon key"] || "")}"></div><div class="calendar-compact-grid" id="calCompactGrid" data-tip="${esc(TIPS["Compact stats"] || "")}"></div><div class="calendar-compact-events" id="calCompactEvents" data-tip="${esc(TIPS["Month events"] || "")}"></div></div></div></div>
    </div>

    <div class="calendar-detail-overlay is-hidden" id="calDetailOverlay"><div class="panel calendar-detail-dialog"><div class="panel__header"><h2>Detailed Calendar</h2><div class="button-row" style="margin:0"><button id="calDetailPrev" type="button" data-tip="${esc(TIPS["Previous month"] || "")}">Previous</button><button id="calDetailNext" type="button" data-tip="${esc(TIPS["Next month"] || "")}">Next</button><button id="calCloseDetail" type="button" data-tip="${esc(TIPS["Close detailed view"] || "")}">Close</button></div></div><div class="panel__body"><div class="calendar-month-title" id="calDetailMonthTitle" data-tip="${esc(TIPS["Month summary"] || "")}"></div><div class="calendar-chip-row" id="calDetailChipRow" data-tip="${esc(TIPS["Moon summary chips"] || "")}"></div><div class="calendar-season-band" id="calDetailSeasonBand" data-tip="${esc(TIPS["Season bands"] || "")}" hidden></div><div class="calendar-moon-legend" id="calDetailMoonLegend" data-tip="${esc(TIPS["Moon key"] || "")}"></div><div class="calendar-selected-day" id="calDetailSelectedDay" data-tip="${esc(TIPS["Selected day"] || "")}"></div><div class="calendar-grid-wrap calendar-grid-wrap--detail" data-tip="${esc(TIPS["Detailed calendar"] || "")}"><table class="calendar-grid-table"><thead><tr id="calDetailHead"></tr></thead><tbody id="calDetailBody"></tbody></table></div></div></div></div>

  `;
  mountEl.appendChild(wrap);
  attachTooltips(wrap);

  const $ = (sel) => wrap.querySelector(sel);
  const els = {
    drawerToggle: $("#calDrawerToggle"),
    profileSelect: $("#calProfileSelect"),
    profileNew: $("#calProfileNew"),
    profileDuplicate: $("#calProfileDuplicate"),
    profileDelete: $("#calProfileDelete"),
    sourcePlanet: $("#calSourcePlanet"),
    primaryMoon: $("#calPrimaryMoon"),
    extraMoon1: $("#calExtraMoon1"),
    extraMoon2: $("#calExtraMoon2"),
    extraMoon3: $("#calExtraMoon3"),
    derivedData: $("#calDerivedData"),
    derivedRoundEnabled: $("#calDerivedRoundEnabled"),
    derivedDecimalPlaces: $("#calDerivedDecimalPlaces"),
    monthsPerYear: $("#calMonthsPerYear"),
    daysPerMonth: $("#calDaysPerMonth"),
    daysPerWeek: $("#calDaysPerWeek"),
    structureInfo: $("#calStructureInfo"),
    useSelected: $("#calUseSelected"),
    calendarName: $("#calCalendarName"),
    basis: $("#calBasis"),
    year: $("#calYear"),
    month: $("#calMonth"),
    startDay: $("#calStartDay"),
    weekStart: $("#calWeekStart"),
    moonEpoch: $("#calMoonEpoch"),
    yearDisplayMode: $("#calYearDisplayMode"),
    yearOffset: $("#calYearOffset"),
    yearPrefix: $("#calYearPrefix"),
    yearSuffix: $("#calYearSuffix"),
    preCalendarStartYear: $("#calPreCalendarStartYear"),
    postEraLabel: $("#calPostEraLabel"),
    preEraLabel: $("#calPreEraLabel"),
    preCalendarUseYearZero: $("#calPreCalendarUseYearZero"),
    dayNames: $("#calDayNames"),
    weekNames: $("#calWeekNames"),
    monthNames: $("#calMonthNames"),
    monthLengthOverridesEnabled: $("#calMonthLengthOverridesEnabled"),
    monthLengthOverridesRow: $("#calMonthLengthOverridesRow"),
    monthLengthOverrides: $("#calMonthLengthOverrides"),
    eraName: $("#calEraName"),
    eraStartYear: $("#calEraStartYear"),
    eraAdd: $("#calEraAdd"),
    eraList: $("#calEraList"),
    jsonText: $("#calJsonText"),
    jsonStatus: $("#calJsonStatus"),
    exportDownload: $("#calExportDownload"),
    exportCopy: $("#calExportCopy"),
    importFileBtn: $("#calImportFileBtn"),
    importFile: $("#calImportFile"),
    importApply: $("#calImportApply"),
    jsonLoadCurrent: $("#calJsonLoadCurrent"),
    markerEnabled: $("#calMarkerEnabled"),
    markerSeasons: $("#calMarkerSeasons"),
    markerSeasonBands: $("#calMarkerSeasonBands"),
    markerEclipses: $("#calMarkerEclipses"),
    pdfMonth: $("#calPdfMonth"),
    pdfYear: $("#calPdfYear"),
    icsAnchor: $("#calIcsAnchor"),
    icsIncHolidays: $("#calIcsIncHolidays"),
    icsIncFestivals: $("#calIcsIncFestivals"),
    icsIncMarkers: $("#calIcsIncMarkers"),
    icsMonth: $("#calIcsMonth"),
    icsYear: $("#calIcsYear"),
    outputStatus: $("#calOutputStatus"),
    resetNames: $("#calResetNames"),
    holidayName: $("#calHolidayName"),
    holidayCategory: $("#calHolidayCategory"),
    holidayColorTag: $("#calHolidayColorTag"),
    holidayRecurrence: $("#calHolidayRecurrence"),
    holidayAdvancedToggle: $("#calHolidayAdvancedToggle"),
    holidayYear: $("#calHolidayYear"),
    holidayUseDate: $("#calHolidayUseDate"),
    holidayUseWeekday: $("#calHolidayUseWeekday"),
    holidayUseMoon: $("#calHolidayUseMoon"),
    holidayUseRelative: $("#calHolidayUseRelative"),
    holidayRelativeType: $("#calHolidayRelativeType"),
    holidayRelativeOffset: $("#calHolidayRelativeOffset"),
    holidayRelativeMoonSlot: $("#calHolidayRelativeMoonSlot"),
    holidayRelativeMoonPhase: $("#calHolidayRelativeMoonPhase"),
    holidayRelativeMarker: $("#calHolidayRelativeMarker"),
    holidayRelativeHoliday: $("#calHolidayRelativeHoliday"),
    holidayAnchorType: $("#calHolidayAnchorType"),
    holidayAlgorithm: $("#calHolidayAlgorithm"),
    holidayAnchorMoonSlot: $("#calHolidayAnchorMoonSlot"),
    holidayAnchorMoonPhase: $("#calHolidayAnchorMoonPhase"),
    holidayAnchorMarker: $("#calHolidayAnchorMarker"),
    holidayAnchorHoliday: $("#calHolidayAnchorHoliday"),
    holidayAnchorOffset: $("#calHolidayAnchorOffset"),
    holidayConflictRule: $("#calHolidayConflictRule"),
    holidayMaxShiftDays: $("#calHolidayMaxShiftDays"),
    holidayStayInMonth: $("#calHolidayStayInMonth"),
    holidayConflictScope: $("#calHolidayConflictScope"),
    holidayConflictCategories: $("#calHolidayConflictCategories"),
    holidayConflictHolidayIds: $("#calHolidayConflictHolidayIds"),
    holidayStartMonth: $("#calHolidayStartMonth"),
    holidayDayOfMonth: $("#calHolidayDayOfMonth"),
    holidayDuration: $("#calHolidayDuration"),
    holidayPriority: $("#calHolidayPriority"),
    holidayMergeMode: $("#calHolidayMergeMode"),
    holidayWeekday: $("#calHolidayWeekday"),
    holidayOccurrence: $("#calHolidayOccurrence"),
    holidayMoonSlot: $("#calHolidayMoonSlot"),
    holidayMoonPhase: $("#calHolidayMoonPhase"),
    holidayExceptYears: $("#calHolidayExceptYears"),
    holidayExceptMonths: $("#calHolidayExceptMonths"),
    holidayExceptDays: $("#calHolidayExceptDays"),
    holidaySave: $("#calHolidaySave"),
    holidayCancel: $("#calHolidayCancel"),
    holidayList: $("#calHolidayList"),
    festivalName: $("#calFestivalName"),
    festivalRecurrence: $("#calFestivalRecurrence"),
    festivalYear: $("#calFestivalYear"),
    festivalStartMonth: $("#calFestivalStartMonth"),
    festivalAfterDay: $("#calFestivalAfterDay"),
    festivalDuration: $("#calFestivalDuration"),
    festivalOutsideWeek: $("#calFestivalOutsideWeek"),
    festivalSave: $("#calFestivalSave"),
    festivalCancel: $("#calFestivalCancel"),
    festivalList: $("#calFestivalList"),
    leapName: $("#calLeapName"),
    leapCycle: $("#calLeapCycle"),
    leapOffset: $("#calLeapOffset"),
    leapMonth: $("#calLeapMonth"),
    leapDelta: $("#calLeapDelta"),
    leapAdd: $("#calLeapAdd"),
    leapSuggest: $("#calLeapSuggest"),
    leapStatus: $("#calLeapStatus"),
    leapList: $("#calLeapList"),
    cycleName: $("#calCycleName"),
    cycleMode: $("#calCycleMode"),
    cycleWeekendRule: $("#calCycleWeekendRule"),
    weekendDays: $("#calWeekendDays"),
    cycleStartDay: $("#calCycleStartDay"),
    cycleOnDays: $("#calCycleOnDays"),
    cycleOffDays: $("#calCycleOffDays"),
    cycleIntervalDays: $("#calCycleIntervalDays"),
    cycleActiveLabel: $("#calCycleActiveLabel"),
    cycleRestLabel: $("#calCycleRestLabel"),
    cycleMarkerLabel: $("#calCycleMarkerLabel"),
    cycleActiveShort: $("#calCycleActiveShort"),
    cycleRestShort: $("#calCycleRestShort"),
    cycleMarkerShort: $("#calCycleMarkerShort"),
    cycleSave: $("#calCycleSave"),
    cycleCancel: $("#calCycleCancel"),
    cycleList: $("#calCycleList"),
    prevMonth: $("#calPrevMonth"),
    nextMonth: $("#calNextMonth"),
    openDetail: $("#calOpenDetail"),
    monthTitle: $("#calMonthTitle"),
    chipRow: $("#calChipRow"),
    seasonBand: $("#calSeasonBand"),
    moonLegend: $("#calMoonLegend"),
    selectedDay: $("#calSelectedDay"),
    compactGrid: $("#calCompactGrid"),
    compactEvents: $("#calCompactEvents"),
    holidayFilters: $("#calHolidayFilters"),
    miniHead: $("#calMiniHead"),
    miniBody: $("#calMiniBody"),
    jumpAbs: $("#calJumpAbs"),
    jumpAbsBtn: $("#calJumpAbsBtn"),
    jumpYear: $("#calJumpYear"),
    jumpMonth: $("#calJumpMonth"),
    jumpDay: $("#calJumpDay"),
    jumpDateBtn: $("#calJumpDateBtn"),
    detailOverlay: $("#calDetailOverlay"),
    detailPrev: $("#calDetailPrev"),
    detailNext: $("#calDetailNext"),
    closeDetail: $("#calCloseDetail"),
    detailMonthTitle: $("#calDetailMonthTitle"),
    detailChipRow: $("#calDetailChipRow"),
    detailSeasonBand: $("#calDetailSeasonBand"),
    detailMoonLegend: $("#calDetailMoonLegend"),
    detailSelectedDay: $("#calDetailSelectedDay"),
    detailHead: $("#calDetailHead"),
    detailBody: $("#calDetailBody"),
  };

  replaceSelectOptions(els.holidayRecurrence, tupleOptions(RECURRENCES));
  replaceSelectOptions(els.festivalRecurrence, tupleOptions(RECURRENCES));
  replaceSelectOptions(els.holidayOccurrence, tupleOptions(OCCURRENCES));
  replaceSelectOptions(els.holidayMoonPhase, tupleOptions(PHASES));
  replaceSelectOptions(els.holidayRelativeType, tupleOptions(HOLIDAY_RELATIVE_TYPES));
  replaceSelectOptions(els.holidayRelativeMoonPhase, tupleOptions(PHASES));
  replaceSelectOptions(els.holidayAnchorType, tupleOptions(HOLIDAY_ANCHOR_TYPES));
  replaceSelectOptions(els.holidayAlgorithm, tupleOptions(HOLIDAY_ALGORITHMS));
  replaceSelectOptions(els.holidayAnchorMoonPhase, tupleOptions(PHASES));
  replaceSelectOptions(els.holidayRelativeMarker, tupleOptions(HOLIDAY_RELATIVE_MARKERS));
  replaceSelectOptions(els.holidayAnchorMarker, tupleOptions(HOLIDAY_RELATIVE_MARKERS));
  replaceSelectOptions(els.holidayMergeMode, tupleOptions(HOLIDAY_RESOLVE_MODES));
  replaceSelectOptions(els.cycleWeekendRule, tupleOptions(HOLIDAY_WEEKEND_RULES));
  replaceSelectOptions(els.holidayConflictRule, tupleOptions(HOLIDAY_CONFLICT_RULES));
  replaceSelectOptions(els.holidayConflictScope, tupleOptions(HOLIDAY_CONFLICT_SCOPES));
  replaceSelectOptions(els.cycleMode, tupleOptions(WORK_CYCLE_MODES));

  const binders = [
    bindPair(wrap, "calDerivedDecimalPlaces", 0, 6, 1),
    bindPair(wrap, "calMonthsPerYear", 1, 60, 1),
    bindPair(wrap, "calDaysPerMonth", 1, 120, 1),
    bindPair(wrap, "calDaysPerWeek", 1, 30, 1),
  ];
  const collapsiblePanels = {};

  for (const def of CALENDAR_COLLAPSIBLE_PANELS) {
    const titleEl = [
      ...wrap.querySelectorAll(".calendar-drawer__section .panel > .panel__header > h2"),
    ].find((h2) => h2.textContent.trim() === def.title);
    const header = titleEl?.parentElement || null;
    const panel = header?.closest(".panel") || null;
    const body = panel?.querySelector(":scope > .panel__body") || null;
    if (!header || !panel || !body) continue;

    const bodyId = `calSectionBody-${def.key}`;
    body.id = bodyId;
    header.classList.add("calendar-collapsible-header");

    const toggleBtn = document.createElement("button");
    toggleBtn.type = "button";
    toggleBtn.className = "calendar-collapse-toggle";
    toggleBtn.dataset.collapseKey = def.key;
    toggleBtn.setAttribute("aria-controls", bodyId);
    toggleBtn.innerHTML =
      '<span class="calendar-collapse-toggle__label">Collapse</span><span class="calendar-collapse-toggle__icon" aria-hidden="true"></span>';
    header.appendChild(toggleBtn);

    collapsiblePanels[def.key] = { panel, body, button: toggleBtn };
  }

  const syncSliders = () => binders.forEach((b) => b?.syncFromNumber?.());
  const closeDetail = () => els.detailOverlay.classList.add("is-hidden");
  const openDetail = () => els.detailOverlay.classList.remove("is-hidden");

  function ensureProfileStore() {
    if (!Array.isArray(state._allProfiles) || !state._allProfiles.length) {
      const id = String(state.profileId || "cal-1");
      const name =
        String(state.profileName || state.ui?.calendarName || "Calendar").trim() || "Calendar";
      const normalized = normalizeSingleProfile(loadWorld(), {
        inputs: state.inputs,
        ui: state.ui,
      });
      state._allProfiles = [{ id, name, ...normalized }];
      state.profileId = id;
      state.profileName = name;
    }
    state.profiles = state._allProfiles.map((p) => ({
      id: String(p.id),
      name: String(p.name || "Calendar"),
    }));
  }

  function saveActiveProfileSnapshot() {
    ensureProfileStore();
    const activeId = String(state.profileId || state._allProfiles[0]?.id || "cal-1");
    const activeName =
      String(state.ui?.calendarName || state.profileName || "Calendar").trim() || "Calendar";
    const normalized = normalizeSingleProfile(loadWorld(), { inputs: state.inputs, ui: state.ui });
    const snapshot = { id: activeId, name: activeName, ...normalized };
    const idx = state._allProfiles.findIndex((p) => String(p?.id) === activeId);
    if (idx >= 0) state._allProfiles[idx] = snapshot;
    else state._allProfiles.push(snapshot);
    state.profileName = activeName;
    state.profiles = state._allProfiles.map((p) => ({
      id: String(p.id),
      name: String(p.name || "Calendar"),
    }));
  }

  function activateProfile(profileId) {
    ensureProfileStore();
    saveActiveProfileSnapshot();
    const target = state._allProfiles.find((p) => String(p?.id) === String(profileId));
    if (!target) return;
    const normalized = normalizeSingleProfile(loadWorld(), target);
    state.profileId = String(target.id);
    state.profileName = String(target.name || normalized.ui.calendarName || "Calendar");
    normalized.ui.calendarName = state.profileName;
    state.inputs = clonePlain(normalized.inputs);
    state.ui = clonePlain(normalized.ui);
    runtime.editingHolidayId = null;
    runtime.editingFestivalId = null;
    runtime.editingCycleId = null;
  }

  function applyCollapsedPanels() {
    if (!state.ui.collapsedSections || typeof state.ui.collapsedSections !== "object") {
      state.ui.collapsedSections = {
        designer: true,
        data: true,
        output: true,
        special: true,
        festival: true,
        leap: true,
        cycles: true,
      };
    }
    for (const { key } of CALENDAR_COLLAPSIBLE_PANELS) {
      if (typeof state.ui.collapsedSections[key] !== "boolean") {
        state.ui.collapsedSections[key] = true;
      }
      const refs = collapsiblePanels[key];
      if (!refs) continue;
      const collapsed = !!state.ui.collapsedSections[key];
      refs.panel.classList.toggle("is-collapsed", collapsed);
      refs.body.hidden = collapsed;
      refs.button.dataset.state = collapsed ? "collapsed" : "expanded";
      refs.button.setAttribute("aria-expanded", collapsed ? "false" : "true");
      refs.button.querySelector(".calendar-collapse-toggle__label").textContent = collapsed
        ? "Expand"
        : "Collapse";
    }
  }

  const drawerEl = $("#calDrawer");
  const workspaceEl = wrap.querySelector(".calendar-workspace");

  function applyDrawerState() {
    const open = !!state.ui.drawerOpen;
    if (workspaceEl) workspaceEl.classList.toggle("drawer-open", open);
    if (drawerEl) drawerEl.classList.toggle("is-hidden", !open);
    els.drawerToggle?.classList.toggle("is-active", open);
    if (els.drawerToggle) els.drawerToggle.textContent = open ? "\u276E" : "\u276F";
    const tabs = wrap.querySelectorAll("[data-drawer-tab]");
    for (const tab of tabs) {
      tab.classList.toggle("is-active", tab.dataset.drawerTab === state.ui.drawerSection);
    }
    const sections = wrap.querySelectorAll("[data-drawer-section]");
    for (const section of sections) {
      section.hidden = section.dataset.drawerSection !== state.ui.drawerSection;
    }
    const subtabs = wrap.querySelectorAll("[data-rules-tab]");
    for (const st of subtabs) {
      st.classList.toggle("is-active", st.dataset.rulesTab === state.ui.rulesTab);
    }
    const ruleSections = wrap.querySelectorAll("[data-rules-section]");
    for (const rs of ruleSections) {
      rs.hidden = rs.dataset.rulesSection !== state.ui.rulesTab;
    }
    const backdrop = wrap.querySelector("#calDrawerBackdrop");
    const narrow = typeof window !== "undefined" && window.innerWidth <= 1200;
    if (backdrop) backdrop.classList.toggle("is-visible", open && narrow);
  }

  function setJsonStatus(msg, kind = "info") {
    if (!els.jsonStatus) return;
    els.jsonStatus.textContent = msg;
    els.jsonStatus.dataset.kind = kind === "bad" ? "error" : kind;
  }

  function setOutputStatus(msg, kind = "info") {
    if (!els.outputStatus) return;
    els.outputStatus.textContent = msg;
    els.outputStatus.dataset.kind = kind === "bad" ? "error" : kind;
  }

  function setLeapStatus(msg, kind = "info") {
    if (!els.leapStatus) return;
    els.leapStatus.textContent = msg;
    els.leapStatus.dataset.kind = kind === "bad" ? "error" : kind;
  }

  function formatIcsDate(date) {
    const yyyy = String(date.getUTCFullYear()).padStart(4, "0");
    const mm = String(date.getUTCMonth() + 1).padStart(2, "0");
    const dd = String(date.getUTCDate()).padStart(2, "0");
    return `${yyyy}${mm}${dd}`;
  }

  function parseAnchorDateUtc(anchorDate) {
    const safe = normalizeIsoDate(anchorDate);
    const parts = safe.split("-").map((v) => Number(v));
    if (parts.length !== 3 || parts.some((n) => !Number.isFinite(n))) {
      const d = new Date();
      return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
    }
    return Date.UTC(parts[0], parts[1] - 1, parts[2]);
  }

  function toGregorianDateFromAbsolute(absoluteDay, anchorDate) {
    const baseMs = parseAnchorDateUtc(anchorDate);
    return new Date(baseMs + Math.max(0, I(absoluteDay, 0)) * 86400000);
  }

  function escapeIcsText(text) {
    return String(text || "")
      .replace(/\\/g, "\\\\")
      .replace(/\n/g, "\\n")
      .replace(/;/g, "\\;")
      .replace(/,/g, "\\,");
  }

  function buildScopeMonthModels(ctx, scope) {
    const months =
      scope === "year"
        ? Array.from({ length: ctx.metrics.monthsPerYear }, (_, i) => i)
        : [ctx.monthModel.monthIndex];
    return months.map((monthIndex) =>
      buildMonthModel({
        metrics: ctx.metrics,
        year: state.ui.year,
        monthIndex,
        firstYearStartDayIndex: state.ui.startDayOfYear,
        weekStartDayIndex: state.ui.weekStartsOn,
        leapRules: ctx.leapRules,
        monthLengthOverrides: ctx.monthLengthOverrides,
        dayNames: ctx.dayNames,
        weekNames: state.ui.weekNames,
        monthNames: ctx.monthNames,
        moonDefs: ctx.moonDefs,
        moonEpochOffsetDays: state.ui.moonEpochOffsetDays,
        holidays: ctx.holidays,
        festivals: ctx.festivals,
        astronomySettings: ctx.astronomySettings,
        workCycles: ctx.workCycles,
      }),
    );
  }

  function openPrintableCalendar(scope) {
    const ctx = buildContext(loadWorld(), state);
    const models = buildScopeMonthModels(ctx, scope).map((model) =>
      applyHolidayFiltersToMonthModel(model, state.ui.holidayCategoryFilters),
    );
    const yearLabel = formatDisplayedYear(state.ui.year, state.ui);
    const moonLegendItems = ctx.moonDefs
      .map(
        (moon, idx) =>
          `<span class="ws-moon-key-item"><span class="ws-moon-dot ws-moon-c${idx}"></span>${esc(moon.name)} (${fmt(moon.synodicDays, 3)} d)</span>`,
      )
      .join("");
    const enabledCategoryLabels = HOLIDAY_CATEGORIES.filter(
      ([category]) => state.ui.holidayCategoryFilters?.[category],
    )
      .map(([, label]) => label)
      .join(", ");
    const docTitle =
      scope === "year"
        ? `${state.ui.calendarName || "Calendar"} - Year ${yearLabel}`
        : `${state.ui.calendarName || "Calendar"} - ${models[0]?.monthName || ""} ${yearLabel}`;
    const monthBlocks = models
      .map((model, idx) => {
        const head =
          `<th class="ws-week-col">Week</th>` +
          model.headers.map((h) => `<th>${esc(h)}</th>`).join("");
        const rows = model.rows
          .map((row) => {
            const tds = row.cells
              .map((cell) => {
                if (!cell) return `<td class="ws-cell-empty"></td>`;
                if (cell.kind === "festival") {
                  const seq =
                    I(cell.festival?.segmentCount, 1) > 1
                      ? ` ${I(cell.festival?.segment, 1)}/${I(cell.festival?.segmentCount, 1)}`
                      : "";
                  return `<td><div class="ws-day-card ws-festival-card"><div class="ws-day-top"><span class="ws-day-num">F</span><span class="ws-festival-title">${esc(cell.festival?.name || "Festival")}${seq}</span></div><div class="ws-day-events">${esc(cell.festival?.outsideWeekFlow ? "Outside weekday flow" : "Festival day")}</div></div></td>`;
                }
                const moons = (cell.moonStates || [])
                  .map(
                    (moonState, moonIdx) =>
                      `<span class="ws-moon-pill ws-moon-c${moonIdx}" data-moon="${esc(
                        moonState?.name || `Moon ${moonIdx + 1}`,
                      )}">${esc(String(moonState?.phase?.phaseShort || "N").toUpperCase())}</span>`,
                  )
                  .join("");
                const holidays = (cell.holidays || [])
                  .map(
                    (holiday) =>
                      `<span class="ws-event-pill ${holidayColorClass(holiday.colorTag)}">H ${esc(
                        holiday.name,
                      )} (${esc(holidayCategoryLabel(holiday.category))})</span>`,
                  )
                  .join("");
                const markers = (cell.markers || [])
                  .map(
                    (marker) =>
                      `<span class="ws-event-pill ws-marker-pill">A ${esc(
                        astronomyMarkerLabel(marker),
                      )}</span>`,
                  )
                  .join("");
                const cycles = (cell.cycles || [])
                  .map(
                    (cycle) =>
                      `<span class="ws-event-pill ws-cycle-pill">${esc(
                        String(cycle.short || "C").toUpperCase(),
                      )} ${esc(cycle.ruleName || cycle.label || "Cycle")}</span>`,
                  )
                  .join("");
                return `<td><div class="ws-day-card"><div class="ws-day-top"><span class="ws-day-num">${cell.dayNumber}</span></div><div class="ws-day-moons">${moons || `<span class="ws-muted">-</span>`}</div><div class="ws-day-events">${holidays || `<span class="ws-muted">No holidays</span>`}</div><div class="ws-day-events">${markers || `<span class="ws-muted">No astronomy</span>`}</div><div class="ws-day-events">${cycles || `<span class="ws-muted">No cycles</span>`}</div></div></td>`;
              })
              .join("");
            return `<tr><th class="ws-week-col">${esc(row.weekName || "")}</th>${tds}</tr>`;
          })
          .join("");
        const outsideFlowFestivals = (model.outsideWeekFlowFestivals || [])
          .slice(0, 10)
          .map((festival) => festival.name)
          .join(", ");
        return `<section class="ws-print-month ${scope === "year" && idx > 0 ? "ws-break" : ""}"><h2>${esc(model.monthName)} - ${esc(yearLabel)} (${model.monthLength} days)</h2><div class="ws-chip-row"><span class="ws-chip"><b>Calendar:</b> ${esc(
          String(state.ui.calendarName || "Calendar"),
        )}</span><span class="ws-chip"><b>Full Moon:</b> ${esc(
          model.fullMoonDays.length ? model.fullMoonDays.join(", ") : "None",
        )}</span><span class="ws-chip"><b>New Moon:</b> ${esc(
          model.newMoonDays.length ? model.newMoonDays.join(", ") : "None",
        )}</span><span class="ws-chip"><b>Holidays:</b> ${model.holidaysInMonth.reduce(
          (sum, [, count]) => sum + count,
          0,
        )}</span><span class="ws-chip"><b>Astronomy:</b> ${model.markersInMonth.reduce(
          (sum, marker) => sum + (marker.count || 0),
          0,
        )}</span></div><div class="ws-moon-key"><b>Moon key:</b> ${moonLegendItems}</div><div class="ws-print-grid-wrap"><table><thead><tr>${head}</tr></thead><tbody>${rows}</tbody></table></div>${
          outsideFlowFestivals
            ? `<div class="ws-foot-note"><b>Outside-week-flow festivals:</b> ${esc(outsideFlowFestivals)}</div>`
            : ""
        }</section>`;
      })
      .join("");
    const html = `<!doctype html><html><head><meta charset="utf-8"/><title>${esc(
      docTitle,
    )}</title><style>@page{size:landscape;margin:10mm;}body{font-family:Segoe UI,Arial,sans-serif;color:#0f1628;margin:0;}h1{margin:0 0 10px;font-size:22px;}h2{margin:0 0 10px;font-size:16px;}.ws-intro{margin:0 0 12px;font-size:12px;color:#304161;}.ws-print-month{margin:0 0 14px;}.ws-chip-row{display:flex;flex-wrap:wrap;gap:6px;margin:0 0 8px;}.ws-chip{display:inline-flex;align-items:center;gap:6px;padding:4px 8px;border-radius:999px;border:1px solid #d6dfef;background:#f5f8ff;color:#13203f;font-size:11px;}.ws-moon-key{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin:0 0 8px;font-size:11px;color:#2a3651;}.ws-moon-key-item{display:inline-flex;align-items:center;gap:6px;}.ws-moon-dot{width:10px;height:10px;border-radius:999px;display:inline-block;border:1px solid #96a8ca;}.ws-moon-c0{background:#86cbff;}.ws-moon-c1{background:#ffc98f;}.ws-moon-c2{background:#d5b7ff;}.ws-moon-c3{background:#9eeab8;}.ws-print-grid-wrap{overflow:hidden;border:1px solid #d6dfef;border-radius:10px;}table{width:100%;border-collapse:separate;border-spacing:0;table-layout:fixed;}thead th{background:#edf3ff;font-weight:700;color:#1f2f50;border-bottom:1px solid #d6dfef;}th,td{padding:6px;border-right:1px solid #e3e9f5;border-bottom:1px solid #e3e9f5;vertical-align:top;font-size:11px;line-height:1.25;}thead th:last-child,tbody td:last-child{border-right:0;}tbody tr:last-child td,tbody tr:last-child th{border-bottom:0;}.ws-week-col{width:92px;background:#f7faff;color:#2a3651;font-weight:700;}.ws-cell-empty{background:#fbfdff;}.ws-day-card{min-height:74px;border:1px solid #dbe4f5;border-radius:8px;background:#ffffff;padding:4px 6px;display:flex;flex-direction:column;gap:4px;}.ws-festival-card{background:#f1f6ff;border-color:#cddbf4;}.ws-day-top{display:flex;align-items:center;justify-content:space-between;gap:6px;}.ws-day-num{font-size:13px;font-weight:700;color:#13203f;}.ws-festival-title{font-size:11px;font-weight:600;color:#203359;}.ws-day-moons{display:flex;align-items:center;gap:4px;flex-wrap:wrap;}.ws-moon-pill{display:inline-flex;align-items:center;justify-content:center;min-width:22px;height:16px;padding:0 5px;border-radius:999px;border:1px solid #c4d2eb;font-size:10px;font-weight:700;color:#13203f;background:#eef4ff;}.ws-day-events{display:flex;align-items:center;gap:4px;flex-wrap:wrap;}.ws-event-pill{display:inline-flex;align-items:center;padding:1px 6px;border-radius:999px;border:1px solid #d2dcf0;background:#f7f9ff;font-size:10px;color:#13203f;}.ws-marker-pill{border-color:#bfd4f7;background:#edf4ff;color:#1c3f7a;}.ws-cycle-pill{border-color:#b8dfc8;background:#eefaf3;color:#1a5a35;}.ws-event-pill.holiday-tag-gold{background:#fff3df;border-color:#f0cf9f;}.ws-event-pill.holiday-tag-azure{background:#eaf6ff;border-color:#b9dfff;}.ws-event-pill.holiday-tag-emerald{background:#ecfdf2;border-color:#bdeccc;}.ws-event-pill.holiday-tag-violet{background:#f2ecff;border-color:#d4c2ff;}.ws-event-pill.holiday-tag-rose{background:#ffedf4;border-color:#f4bfd2;}.ws-event-pill.holiday-tag-slate{background:#edf0f7;border-color:#cad3e5;}.ws-foot-note{margin-top:8px;font-size:11px;color:#304161;}.ws-muted{color:#7385a7;}.ws-break{page-break-before:always;}@media print{body{margin:0;} .ws-print-root{margin:0;} }</style></head><body><div class="ws-print-root"><h1>${esc(
      docTitle,
    )}</h1><div class="ws-intro">Styled detailed export. Visible holiday categories: ${esc(
      enabledCategoryLabels || "None",
    )}.</div>${monthBlocks}</div></body></html>`;
    const win = window.open("", "_blank");
    if (!win) {
      const fallbackName =
        scope === "year"
          ? `worldsmith-calendar-${state.ui.year}-printable.html`
          : `worldsmith-calendar-${state.ui.year}-m${state.ui.monthIndex + 1}-printable.html`;
      downloadJsonFile(fallbackName, html, "text/html;charset=utf-8");
      setOutputStatus(
        "Popup was blocked, so a printable HTML file was downloaded instead. Open it and print to PDF.",
        "warn",
      );
      return;
    }
    try {
      win.opener = null;
    } catch {
      // no-op: some browsers block assigning opener.
    }
    win.document.open();
    win.document.write(html);
    win.document.close();
    let hasPrinted = false;
    const printView = () => {
      if (hasPrinted) return;
      hasPrinted = true;
      try {
        win.focus();
        win.print();
      } catch {
        // no-op: user can still print manually from opened view.
      }
    };
    if (typeof win.addEventListener === "function") {
      win.addEventListener("load", () => window.setTimeout(printView, 50), { once: true });
    }
    window.setTimeout(printView, 400);
    setOutputStatus("Opened printable view. Use your browser print dialog to save as PDF.", "ok");
  }

  function buildIcs(scope) {
    const ctx = buildContext(loadWorld(), state);
    const models = buildScopeMonthModels(ctx, scope);
    const include = normalizeIcsIncludes(state.ui.icsIncludes);
    const anchorDate = normalizeIsoDate(state.ui.exportAnchorDate);
    const yearLabel = formatDisplayedYear(state.ui.year, state.ui);
    const stamp = new Date();
    const dtStamp = `${formatIcsDate(stamp)}T${String(stamp.getUTCHours()).padStart(2, "0")}${String(stamp.getUTCMinutes()).padStart(2, "0")}${String(stamp.getUTCSeconds()).padStart(2, "0")}Z`;
    const events = [];

    const pushEvent = (absoluteDay, summary, description) => {
      const start = toGregorianDateFromAbsolute(absoluteDay, anchorDate);
      const end = toGregorianDateFromAbsolute(absoluteDay + 1, anchorDate);
      const uid = `${absoluteDay}-${events.length + 1}@worldsmith-web`;
      events.push(
        [
          "BEGIN:VEVENT",
          `UID:${uid}`,
          `DTSTAMP:${dtStamp}`,
          `DTSTART;VALUE=DATE:${formatIcsDate(start)}`,
          `DTEND;VALUE=DATE:${formatIcsDate(end)}`,
          `SUMMARY:${escapeIcsText(summary)}`,
          `DESCRIPTION:${escapeIcsText(description)}`,
          "END:VEVENT",
        ].join("\r\n"),
      );
    };

    for (const model of models) {
      const rows = model.rows.flatMap((r) => r.cells).filter(Boolean);
      for (const cell of rows) {
        if (cell.kind === "festival") {
          if (!include.festivals) continue;
          const dayNumber = Math.max(1, clampI(cell.festival?.afterDay, 1, model.monthLength));
          const absoluteDay = model.absoluteMonthStart + dayNumber - 1;
          pushEvent(
            absoluteDay,
            `Festival: ${cell.festival?.name || "Festival"}`,
            `${model.monthName} ${dayNumber}, ${yearLabel} (calendar ${state.ui.calendarName || "Calendar"})`,
          );
          continue;
        }

        const dayLabel = `${model.monthName} ${cell.dayNumber}, ${yearLabel}`;
        if (include.holidays) {
          for (const h of cell.holidays || []) {
            pushEvent(
              cell.absoluteDay,
              `Holiday: ${h.name}`,
              `${dayLabel} (calendar ${state.ui.calendarName || "Calendar"})`,
            );
          }
        }
        if (include.markers && normalizeAstronomySettings(state.ui.astronomy).enabled) {
          for (const marker of cell.markers || []) {
            const markerLabel = astronomyMarkerLabel(marker);
            pushEvent(
              cell.absoluteDay,
              `Astronomy: ${markerLabel}`,
              `${dayLabel} (calendar ${state.ui.calendarName || "Calendar"})`,
            );
          }
        }
      }

      if (include.festivals) {
        for (const fest of model.outsideWeekFlowFestivals || []) {
          const dayNumber = Math.max(1, clampI(fest.afterDay, 1, model.monthLength));
          const absoluteDay = model.absoluteMonthStart + dayNumber - 1;
          pushEvent(
            absoluteDay,
            `Festival: ${fest.name}`,
            `${model.monthName} ${dayNumber}, ${yearLabel} (outside weekday flow)`,
          );
        }
      }
    }

    const calName = String(state.ui.calendarName || "Calendar").trim() || "Calendar";
    const lines = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//WorldSmith Web//Calendar Export//EN",
      "CALSCALE:GREGORIAN",
      `X-WORLDSMITH-CALENDAR:${escapeIcsText(calName)}`,
      `X-WORLDSMITH-YEAR:${escapeIcsText(String(yearLabel))}`,
      ...events,
      "END:VCALENDAR",
      "",
    ];
    return { text: lines.join("\r\n"), count: events.length };
  }

  function currentCalendarJsonText() {
    return JSON.stringify(createCalendarExportEnvelope(state, clonePlain), null, 2);
  }

  function loadCurrentJsonToTextarea() {
    if (!els.jsonText) return;
    els.jsonText.value = currentCalendarJsonText();
    setJsonStatus(`Ready. ${els.jsonText.value.length.toLocaleString("en-GB")} characters.`, "ok");
  }

  function applyCalendarPayload(payload) {
    const candidate = readCalendarCandidate(payload);
    if (!candidate) throw new Error("JSON does not contain a calendar payload.");
    const next = readState({ ...loadWorld(), calendar: candidate });
    state.inputs = next.inputs;
    state.ui = next.ui;
    state.profileId = next.profileId;
    state.profileName = next.profileName;
    state.profiles = next.profiles;
    state._allProfiles = next._allProfiles;
    state.ui.monthIndex = 0;
    state.ui.selectedDay = 1;
    runtime.editingHolidayId = null;
    runtime.editingFestivalId = null;
    runtime.editingCycleId = null;
    render();
    setJsonStatus("Calendar settings imported.", "ok");
  }

  function updateHolidayEnables() {
    const oneOff = els.holidayRecurrence.value === "one-off";
    const useRelative = !!els.holidayUseRelative.checked;
    const useAdvanced = !!els.holidayAdvancedToggle.checked;
    state.ui.holidayAdvanced = useAdvanced;
    wrap.querySelectorAll(".calendar-holiday-advanced").forEach((row) => {
      row.hidden = !useAdvanced;
    });
    if (oneOff && !useRelative) {
      els.holidayUseDate.checked = true;
    }
    if (useRelative) {
      els.holidayUseDate.checked = false;
      els.holidayUseWeekday.checked = false;
      els.holidayUseMoon.checked = false;
    }
    els.holidayUseDate.disabled = oneOff || useRelative;
    els.holidayUseWeekday.disabled = useRelative;
    els.holidayUseMoon.disabled = useRelative;
    els.holidayDayOfMonth.disabled = useRelative || !els.holidayUseDate.checked;
    els.holidayDuration.disabled = false;
    els.holidayWeekday.disabled = useRelative || !els.holidayUseWeekday.checked;
    els.holidayOccurrence.disabled = useRelative || !els.holidayUseWeekday.checked;
    els.holidayMoonSlot.disabled = useRelative || !els.holidayUseMoon.checked;
    els.holidayMoonPhase.disabled = useRelative || !els.holidayUseMoon.checked;
    els.holidayRelativeType.disabled = !useRelative;
    els.holidayRelativeOffset.disabled = !useRelative;
    const relativeType = String(els.holidayRelativeType.value || "none");
    const usesMoonRelative = useRelative && relativeType === "moon-phase";
    const usesMarkerRelative = useRelative && relativeType === "astronomy-marker";
    const usesHolidayRelative = useRelative && relativeType === "holiday";
    els.holidayRelativeMoonSlot.disabled = !usesMoonRelative;
    els.holidayRelativeMoonPhase.disabled = !usesMoonRelative;
    els.holidayRelativeMarker.disabled = !usesMarkerRelative;
    els.holidayRelativeHoliday.disabled = !usesHolidayRelative;
    els.holidayYear.disabled = !oneOff;

    const anchorType = String(els.holidayAnchorType.value || "fixed-date");
    const anchorUsesMoon = useAdvanced && anchorType === "moon-phase";
    const anchorUsesMarker = useAdvanced && anchorType === "astronomy-marker";
    const anchorUsesHoliday = useAdvanced && anchorType === "holiday";
    const anchorUsesAlgorithm = useAdvanced && anchorType === "algorithmic";
    const conflictScope = String(els.holidayConflictScope.value || "all");

    els.holidayAnchorType.disabled = !useAdvanced;
    els.holidayAlgorithm.disabled = !anchorUsesAlgorithm;
    els.holidayAnchorMoonSlot.disabled = !anchorUsesMoon;
    els.holidayAnchorMoonPhase.disabled = !anchorUsesMoon;
    els.holidayAnchorMarker.disabled = !anchorUsesMarker;
    els.holidayAnchorHoliday.disabled = !anchorUsesHoliday;
    els.holidayAnchorOffset.disabled = !useAdvanced;
    els.holidayConflictRule.disabled = !useAdvanced;
    els.holidayMaxShiftDays.disabled = !useAdvanced;
    els.holidayStayInMonth.disabled = !useAdvanced;
    els.holidayConflictScope.disabled = !useAdvanced;
    els.holidayConflictCategories.disabled = !useAdvanced || conflictScope !== "category";
    els.holidayConflictHolidayIds.disabled = !useAdvanced || conflictScope !== "ids";
  }

  function resetHolidayForm() {
    runtime.editingHolidayId = null;
    els.holidayName.value = "";
    els.holidayCategory.value = "civic";
    els.holidayColorTag.value = "gold";
    els.holidayRecurrence.value = "yearly";
    els.holidayYear.value = String(Math.max(1, I(state.ui.year, 1)));
    els.holidayUseDate.checked = true;
    els.holidayUseWeekday.checked = false;
    els.holidayUseMoon.checked = false;
    els.holidayUseRelative.checked = false;
    els.holidayRelativeType.value = "none";
    els.holidayRelativeOffset.value = "0";
    els.holidayRelativeMoonSlot.value = "0";
    els.holidayRelativeMoonPhase.value = "F";
    els.holidayRelativeMarker.value = HOLIDAY_RELATIVE_MARKERS[0]?.[0] || "vernal-equinox";
    els.holidayRelativeHoliday.value = "";
    els.holidayAnchorType.value = "fixed-date";
    els.holidayAlgorithm.value = "none";
    els.holidayAnchorMoonSlot.value = "0";
    els.holidayAnchorMoonPhase.value = "F";
    els.holidayAnchorMarker.value = HOLIDAY_RELATIVE_MARKERS[0]?.[0] || "vernal-equinox";
    els.holidayAnchorHoliday.value = "";
    els.holidayAnchorOffset.value = "0";
    els.holidayConflictRule.value = "merge";
    els.holidayMaxShiftDays.value = "7";
    els.holidayStayInMonth.checked = false;
    els.holidayConflictScope.value = "all";
    els.holidayConflictCategories.value = "";
    els.holidayConflictHolidayIds.value = "";
    els.holidayDayOfMonth.value = "1";
    els.holidayDuration.value = "1";
    els.holidayPriority.value = "0";
    els.holidayMergeMode.value = "merge";
    els.holidayOccurrence.value = "any";
    els.holidayMoonPhase.value = "F";
    els.holidayExceptYears.value = "";
    els.holidayExceptMonths.value = "";
    els.holidayExceptDays.value = "";
    els.holidaySave.textContent = "Add holiday";
    els.holidayCancel.style.display = "none";
    els.holidayAdvancedToggle.checked = !!state.ui.holidayAdvanced;
    updateHolidayEnables();
  }

  function updateFestivalEnables() {
    const oneOff = els.festivalRecurrence.value === "one-off";
    els.festivalYear.disabled = !oneOff;
  }

  function resetFestivalForm() {
    runtime.editingFestivalId = null;
    els.festivalName.value = "";
    els.festivalRecurrence.value = "yearly";
    els.festivalYear.value = String(Math.max(1, I(state.ui.year, 1)));
    els.festivalStartMonth.value = String(Math.max(0, I(state.ui.monthIndex, 0)));
    els.festivalAfterDay.value = "0";
    els.festivalDuration.value = "1";
    els.festivalOutsideWeek.checked = false;
    els.festivalSave.textContent = "Add festival";
    els.festivalCancel.style.display = "none";
    updateFestivalEnables();
  }

  function updateCycleEnables() {
    const mode = String(els.cycleMode.value || "duty");
    const isDuty = mode === "duty";
    els.cycleOnDays.disabled = !isDuty;
    els.cycleOffDays.disabled = !isDuty;
    els.cycleActiveLabel.disabled = !isDuty;
    els.cycleRestLabel.disabled = !isDuty;
    els.cycleActiveShort.disabled = !isDuty;
    els.cycleRestShort.disabled = !isDuty;
    els.cycleIntervalDays.disabled = isDuty;
    els.cycleMarkerLabel.disabled = isDuty;
    els.cycleMarkerShort.disabled = isDuty;
  }

  function resetCycleForm() {
    runtime.editingCycleId = null;
    els.cycleName.value = "";
    els.cycleMode.value = "duty";
    els.cycleStartDay.value = "0";
    els.cycleOnDays.value = "6";
    els.cycleOffDays.value = "1";
    els.cycleIntervalDays.value = "5";
    els.cycleActiveLabel.value = "Work";
    els.cycleRestLabel.value = "Rest";
    els.cycleMarkerLabel.value = "Market";
    els.cycleActiveShort.value = "W";
    els.cycleRestShort.value = "R";
    els.cycleMarkerShort.value = "M";
    els.cycleSave.textContent = "Add cycle rule";
    els.cycleCancel.style.display = "none";
    updateCycleEnables();
  }

  function render() {
    ensureProfileStore();
    saveActiveProfileSnapshot();
    const ctx = buildContext(loadWorld(), state);
    runtime.lastCtx = ctx;
    state.ui.holidayCategoryFilters = normalizeHolidayCategoryFilters(
      state.ui.holidayCategoryFilters,
    );

    replaceSelectOptions(els.profileSelect, bodyOptions(state.profiles));
    els.profileSelect.value = state.profileId;
    els.profileDelete.disabled = state.profiles.length <= 1;

    replaceSelectOptions(els.sourcePlanet, bodyOptions(ctx.planets));
    els.sourcePlanet.value = ctx.sourcePlanetId;
    const moonOptions = [{ value: "", label: "None" }, ...bodyOptions(ctx.planetMoons)];
    replaceSelectOptions(els.primaryMoon, moonOptions);
    replaceSelectOptions(els.extraMoon1, moonOptions);
    replaceSelectOptions(els.extraMoon2, moonOptions);
    replaceSelectOptions(els.extraMoon3, moonOptions);
    els.primaryMoon.value = state.inputs.primaryMoonId || "";
    els.extraMoon1.value = state.inputs.extraMoonIds[0] || "";
    els.extraMoon2.value = state.inputs.extraMoonIds[1] || "";
    els.extraMoon3.value = state.inputs.extraMoonIds[2] || "";

    const roundOn = !!state.ui.derivedRoundEnabled;
    const ddp = clampI(state.ui.derivedDecimalPlaces ?? 6, 0, 6);
    const orbDp = roundOn ? ddp : 6;
    const rotDp = roundOn ? Math.min(ddp, 3) : 3;
    els.derivedData.textContent =
      `Planet orbital period: ${N(ctx.planetOrbitalPeriodDays).toFixed(orbDp)} days\n` +
      `Moon orbital period: ${N(ctx.primaryMoonSynodicDays).toFixed(orbDp)} days\n` +
      `Planet rotation: ${N(ctx.planetRotationPeriodHours).toFixed(rotDp)} hours (sidereal)\n` +
      `Solar day: ${N(ctx.solarDayHours).toFixed(rotDp)} hours`;

    els.derivedRoundEnabled.checked = roundOn;
    els.derivedDecimalPlaces.value = String(ddp);
    els.derivedDecimalPlaces.disabled = !roundOn;
    const dpSlider = els.derivedDecimalPlaces
      .closest(".form-row")
      ?.querySelector('input[type="range"]');
    if (dpSlider) dpSlider.disabled = !roundOn;
    els.monthsPerYear.value = String(ctx.metrics.monthsPerYear);
    els.daysPerMonth.value = String(ctx.metrics.daysPerMonth);
    els.daysPerWeek.value = String(ctx.metrics.daysPerWeek);
    const dpwCeiling = Math.min(30, ctx.metrics.daysPerMonth);
    const dpwSlider = wrap.querySelector("#calDaysPerWeek_slider");
    const dpwMaxLabel = wrap.querySelector("#calDaysPerWeek_max");
    if (dpwSlider) dpwSlider.max = String(dpwCeiling);
    if (dpwMaxLabel) dpwMaxLabel.textContent = String(dpwCeiling);
    syncSliders();

    // Structure readout — use getMonthLengthsForYear to account for leap rules
    const wpm = Math.floor(ctx.metrics.daysPerMonth / ctx.metrics.daysPerWeek);
    const weekRemainder = ctx.metrics.daysPerMonth - wpm * ctx.metrics.daysPerWeek;
    const actualMonthLengths = getMonthLengthsForYear({
      metrics: ctx.metrics,
      year: state.ui.year,
      leapRules: state.ui.leapRules || [],
      monthLengthOverrides: ctx.monthLengthOverrides,
    });
    const actualBaseYear = actualMonthLengths.reduce((a, b) => a + b, 0);
    const lastMonthLen = actualMonthLengths[actualMonthLengths.length - 1];
    const drift = actualBaseYear - ctx.yearLen;
    let readout =
      `Weeks per month: ${wpm}` + (weekRemainder ? ` (+${weekRemainder} remainder)` : "");
    readout += `\nCalendar year: ${actualBaseYear} days`;
    if (drift) readout += ` (${drift > 0 ? "+" : ""}${drift} vs orbital ${ctx.yearLen})`;
    if (lastMonthLen !== ctx.metrics.daysPerMonth) readout += `\nLast month: ${lastMonthLen} days`;
    const clampedRules = (state.ui.leapRules || []).filter(
      (r) => I(r?.monthIndex, 0) >= ctx.metrics.monthsPerYear,
    ).length;
    if (clampedRules > 0) {
      readout += `\n${clampedRules} leap rule(s) clamped to last month`;
    }
    els.structureInfo.textContent = readout;
    els.structureInfo.classList.toggle(
      "drift-warning",
      ctx.yearLen > 0 && Math.abs(drift / ctx.yearLen) > 0.1,
    );

    if (document.activeElement !== els.calendarName) {
      els.calendarName.value = String(state.ui.calendarName || "Calendar");
    }
    els.basis.value = state.ui.basis;
    els.year.value = String(state.ui.year);
    els.yearDisplayMode.value = ["numeric", "era", "pre-calendar"].includes(
      String(state.ui.yearDisplayMode || ""),
    )
      ? String(state.ui.yearDisplayMode)
      : "numeric";
    if (document.activeElement !== els.yearOffset)
      els.yearOffset.value = String(I(state.ui.yearOffset, 0));
    if (document.activeElement !== els.yearPrefix)
      els.yearPrefix.value = String(state.ui.yearPrefix || "");
    if (document.activeElement !== els.yearSuffix)
      els.yearSuffix.value = String(state.ui.yearSuffix || "");
    if (document.activeElement !== els.preCalendarStartYear) {
      els.preCalendarStartYear.value = String(Math.max(1, I(state.ui.preCalendarStartYear, 1)));
    }
    if (document.activeElement !== els.postEraLabel) {
      els.postEraLabel.value = String(state.ui.postEraLabel || "CE");
    }
    if (document.activeElement !== els.preEraLabel) {
      els.preEraLabel.value = String(state.ui.preEraLabel || "BCE");
    }
    els.preCalendarUseYearZero.checked = !!state.ui.preCalendarUseYearZero;
    const preCalendarMode = String(state.ui.yearDisplayMode || "numeric") === "pre-calendar";
    wrap.querySelectorAll(".calendar-pre-era-row").forEach((row) => {
      row.hidden = !preCalendarMode;
    });
    [
      els.preCalendarStartYear,
      els.postEraLabel,
      els.preEraLabel,
      els.preCalendarUseYearZero,
    ].forEach((el) => {
      if (el) el.disabled = !preCalendarMode;
    });
    els.markerEnabled.checked = !!state.ui.astronomy?.enabled;
    els.markerSeasons.checked = !!state.ui.astronomy?.seasons;
    els.markerSeasonBands.checked = !!state.ui.astronomy?.seasonBands;
    els.markerEclipses.checked = !!state.ui.astronomy?.eclipses;
    els.markerSeasons.disabled = !els.markerEnabled.checked;
    els.markerSeasonBands.disabled = !els.markerEnabled.checked || !els.markerSeasons.checked;
    els.markerEclipses.disabled = !els.markerEnabled.checked;
    if (document.activeElement !== els.icsAnchor) {
      els.icsAnchor.value = normalizeIsoDate(state.ui.exportAnchorDate);
    }
    els.icsIncHolidays.checked = !!state.ui.icsIncludes?.holidays;
    els.icsIncFestivals.checked = !!state.ui.icsIncludes?.festivals;
    els.icsIncMarkers.checked = !!state.ui.icsIncludes?.markers;
    els.icsIncMarkers.disabled = !els.markerEnabled.checked;
    for (const [category] of HOLIDAY_CATEGORIES) {
      const input = els.holidayFilters?.querySelector(`[data-cal-holiday-filter="${category}"]`);
      if (!input) continue;
      input.checked = !!state.ui.holidayCategoryFilters?.[category];
    }
    replaceSelectOptions(els.month, indexedLabelOptions(ctx.monthNames));
    els.month.value = String(state.ui.monthIndex);
    replaceSelectOptions(els.jumpMonth, indexedLabelOptions(ctx.monthNames));
    state.ui.jumpMonthIndex = clampI(state.ui.jumpMonthIndex, 0, ctx.metrics.monthsPerYear - 1);
    replaceSelectOptions(els.startDay, indexedLabelOptions(ctx.dayNames));
    replaceSelectOptions(els.weekStart, indexedLabelOptions(ctx.dayNames));
    els.startDay.value = String(state.ui.startDayOfYear);
    els.weekStart.value = String(state.ui.weekStartsOn);
    els.moonEpoch.value = String(N(state.ui.moonEpochOffsetDays, 0));
    if (document.activeElement !== els.dayNames) els.dayNames.value = namesText(state.ui.dayNames);
    if (document.activeElement !== els.weekNames)
      els.weekNames.value = namesText(state.ui.weekNames);
    if (document.activeElement !== els.monthNames)
      els.monthNames.value = namesText(state.ui.monthNames);
    const mloEnabled = !!state.ui.monthLengthOverridesEnabled;
    els.monthLengthOverridesEnabled.checked = mloEnabled;
    els.monthLengthOverrides.disabled = !mloEnabled;
    els.monthLengthOverridesRow.style.opacity = mloEnabled ? "" : "0.4";
    if (document.activeElement !== els.monthLengthOverrides)
      els.monthLengthOverrides.value = monthLengthOverridesText(state.ui.monthLengthOverrides);
    if (document.activeElement !== els.jsonText && !els.jsonText.value.trim()) {
      els.jsonText.value = currentCalendarJsonText();
    }

    state.ui.eras = normEraRules(state.ui.eras);
    renderListContent(
      els.eraList,
      state.ui.eras.map((era) =>
        calendarItemRow({
          nameChildren: era.name,
          hint: `Starts in Year ${era.startYear}`,
          actions: [actionButton("Delete", { calEraDel: era.id }, "small danger")],
        }),
      ),
      "No eras configured.",
    );

    replaceSelectOptions(els.holidayStartMonth, indexedLabelOptions(ctx.monthNames));
    replaceSelectOptions(els.festivalStartMonth, indexedLabelOptions(ctx.monthNames));
    replaceSelectOptions(els.holidayWeekday, indexedLabelOptions(ctx.dayNames));
    const moonSlotSelectOptions = moonSlotOptions(ctx.moonDefs);
    replaceSelectOptions(els.holidayMoonSlot, moonSlotSelectOptions);
    replaceSelectOptions(els.holidayRelativeMoonSlot, moonSlotSelectOptions);
    replaceSelectOptions(els.holidayAnchorMoonSlot, moonSlotSelectOptions);
    const holidaySelectOptions = holidayReferenceOptions(ctx.holidays || []);
    replaceSelectOptions(els.holidayRelativeHoliday, holidaySelectOptions);
    replaceSelectOptions(els.holidayAnchorHoliday, holidaySelectOptions);
    els.holidayAdvancedToggle.checked = !!state.ui.holidayAdvanced;

    const holidays = normHolidayRules(state.ui.holidays, ctx.metrics.monthsPerYear);
    const festivals = normFestivalRules(state.ui.festivalRules, ctx.metrics.monthsPerYear);
    renderListContent(
      els.holidayList,
      holidays.map((holiday) =>
        calendarItemRow({
          isEditing: runtime.editingHolidayId === holiday.id,
          nameChildren: [
            holiday.name,
            " ",
            createElement("span", {
              className: `calendar-holiday-chip ${holidayColorClass(holiday.colorTag)}`,
              text: holidayCategoryLabel(holiday.category),
            }),
          ],
          hint: holidaySummary(holiday, ctx),
          actions: [
            actionButton("Edit", { calHolidayEdit: holiday.id }),
            actionButton("Delete", { calHolidayDel: holiday.id }, "small danger"),
          ],
        }),
      ),
      "No holidays configured.",
    );
    renderListContent(
      els.festivalList,
      festivals.map((festival) =>
        calendarItemRow({
          isEditing: runtime.editingFestivalId === festival.id,
          nameChildren: festival.name,
          hint: festivalSummary(festival, ctx),
          actions: [
            actionButton("Edit", { calFestivalEdit: festival.id }),
            actionButton("Delete", { calFestivalDel: festival.id }, "small danger"),
          ],
        }),
      ),
      "No festival rules configured.",
    );

    replaceSelectOptions(els.leapMonth, indexedLabelOptions(ctx.monthNames));
    const leaps = normalizeLeapRules(state.ui.leapRules, ctx.metrics.monthsPerYear);
    renderListContent(
      els.leapList,
      leaps.map((rule) =>
        calendarItemRow({
          nameChildren: rule.name,
          hint: `Every ${rule.cycleYears} years from Year ${rule.offsetYear}`,
          actions: [actionButton("Delete", { calLeapDel: rule.id }, "small danger")],
        }),
      ),
      "No leap rules configured.",
    );

    const workCycles = normWorkCycleRules(state.ui.workCycles);
    state.ui.workWeekendRule = normalizeWeekendRule(state.ui.workWeekendRule);
    state.ui.weekendDayIndexes = normalizeWeekendDayIndexes(
      state.ui.weekendDayIndexes,
      ctx.metrics.daysPerWeek,
    );
    els.cycleWeekendRule.value = state.ui.workWeekendRule;
    replaceWeekendDayOptions(els.weekendDays, ctx.dayNames, state.ui.weekendDayIndexes);
    renderListContent(
      els.cycleList,
      workCycles.map((rule) =>
        calendarItemRow({
          isEditing: runtime.editingCycleId === rule.id,
          nameChildren: rule.name,
          hint: cycleRuleSummary(rule),
          actions: [
            actionButton("Edit", { calCycleEdit: rule.id }),
            actionButton("Delete", { calCycleDel: rule.id }, "small danger"),
          ],
        }),
      ),
      "No cycle rules configured.",
    );

    const model = applyHolidayFiltersToMonthModel(ctx.monthModel, state.ui.holidayCategoryFilters);
    const allDays = model.rows
      .flatMap((r) => r.cells)
      .filter((cell) => cell && Number.isFinite(Number(cell.dayNumber)));
    const selected = allDays.find((d) => d.dayNumber === state.ui.selectedDay) || allDays[0];
    if (selected) {
      state.ui.jumpAbsoluteDay = selected.absoluteDay;
      state.ui.jumpYear = model.year;
      state.ui.jumpMonthIndex = model.monthIndex;
      state.ui.jumpDayOfMonth = selected.dayNumber;
    }
    if (document.activeElement !== els.jumpAbs)
      els.jumpAbs.value = String(state.ui.jumpAbsoluteDay);
    if (document.activeElement !== els.jumpYear) els.jumpYear.value = String(state.ui.jumpYear);
    if (document.activeElement !== els.jumpMonth)
      els.jumpMonth.value = String(state.ui.jumpMonthIndex);
    if (document.activeElement !== els.jumpDay) els.jumpDay.value = String(state.ui.jumpDayOfMonth);
    const holidayDetails = Array.isArray(selected?.holidayDetails) ? selected.holidayDetails : [];
    const holidayDetailById = new Map(
      holidayDetails.map((detail) => [String(detail?.holiday?.id || ""), detail]),
    );

    const yearLabel = formatDisplayedYear(model.year, state.ui);
    const title = `${model.monthName} - ${yearLabel} (${model.monthLength} days)`;
    els.monthTitle.textContent = title;
    els.detailMonthTitle.textContent = title;

    const calendarNameLabel = String(state.ui.calendarName || "Calendar").trim() || "Calendar";
    const chipNodes = [
      {
        label: "Calendar",
        value: calendarNameLabel,
        tip: TIPS["Calendar name"] || "",
      },
      {
        label: "Full Moon",
        value: model.fullMoonDays.length ? model.fullMoonDays.join(", ") : "None",
        tip: "Primary moon full-phase days this month.",
      },
      {
        label: "New Moon",
        value: model.newMoonDays.length ? model.newMoonDays.join(", ") : "None",
        tip: "Primary moon new-phase days this month.",
      },
      {
        label: "Primary moon",
        value: ctx.moonDefs[0]?.name || "Primary moon",
        tip: "Moon used as the main lunar reference for this calendar.",
      },
      {
        label: "Moons shown",
        value: String(ctx.moonDefs.length),
        tip: "Total moons currently displayed in selected-day and detailed views.",
      },
      {
        label: "Festival days",
        value: String(model.festivalsInMonth.reduce((a, e) => a + e[1], 0)),
        tip: TIPS["Festival days"] || "",
      },
      {
        label: "Cycle markers",
        value: String(model.cyclesInMonth.reduce((a, e) => a + (e.count || 0), 0)),
        tip: TIPS["Cycle list"] || "",
      },
    ].map((chip) =>
      createElement("div", { className: "calendar-chip", dataset: { tip: chip.tip } }, [
        createElement("b", { text: `${chip.label}:` }),
        " ",
        chip.value,
      ]),
    );
    replaceChildren(els.chipRow, chipNodes);
    replaceChildren(
      els.detailChipRow,
      [
        {
          label: "Calendar",
          value: calendarNameLabel,
          tip: TIPS["Calendar name"] || "",
        },
        {
          label: "Full Moon",
          value: model.fullMoonDays.length ? model.fullMoonDays.join(", ") : "None",
          tip: "Primary moon full-phase days this month.",
        },
        {
          label: "New Moon",
          value: model.newMoonDays.length ? model.newMoonDays.join(", ") : "None",
          tip: "Primary moon new-phase days this month.",
        },
        {
          label: "Primary moon",
          value: ctx.moonDefs[0]?.name || "Primary moon",
          tip: "Moon used as the main lunar reference for this calendar.",
        },
        {
          label: "Moons shown",
          value: String(ctx.moonDefs.length),
          tip: "Total moons currently displayed in selected-day and detailed views.",
        },
        {
          label: "Festival days",
          value: String(model.festivalsInMonth.reduce((a, e) => a + e[1], 0)),
          tip: TIPS["Festival days"] || "",
        },
        {
          label: "Cycle markers",
          value: String(model.cyclesInMonth.reduce((a, e) => a + (e.count || 0), 0)),
          tip: TIPS["Cycle list"] || "",
        },
      ].map((chip) =>
        createElement("div", { className: "calendar-chip", dataset: { tip: chip.tip } }, [
          createElement("b", { text: `${chip.label}:` }),
          " ",
          chip.value,
        ]),
      ),
    );
    const seasonBandContent = buildSeasonBandContent(model, ctx.astronomySettings);
    replaceChildren(els.seasonBand, seasonBandContent);
    els.seasonBand.hidden = !seasonBandContent.length;
    replaceChildren(els.detailSeasonBand, buildSeasonBandContent(model, ctx.astronomySettings));
    els.detailSeasonBand.hidden = !seasonBandContent.length;

    const renderMoonLegend = (node) =>
      replaceChildren(node, [
        createElement("div", { className: "calendar-moon-legend__title" }, [
          "Moon key ",
          tipIconNode(TIPS["Moon key"] || ""),
        ]),
        createElement(
          "div",
          { className: "calendar-moon-legend__items" },
          ctx.moonDefs.map((moonDef, index) =>
            createElement("span", { className: "calendar-moon-legend__item" }, [
              moonIconNode({ phase: { phaseShort: "F" } }, index),
              " ",
              `${moonDef.name} (${fmt(moonDef.synodicDays, 3)} d)`,
            ]),
          ),
        ),
      ]);
    renderMoonLegend(els.moonLegend);
    renderMoonLegend(els.detailMoonLegend);

    const trace = selected
      ? traceRulesForDay({
          cell: selected,
          model,
          holidays,
          festivals,
          workCycles,
          leapRules: ctx.leapRules,
          metrics: ctx.metrics,
          dayNames: ctx.dayNames,
          weekendDayIndexes: state.ui.weekendDayIndexes,
        })
      : null;
    const renderSelectedDay = (node) => {
      if (!selected) {
        replaceChildren(
          node,
          createElement("div", {
            className: "calendar-selected-day__title",
            text: "No day selected",
          }),
        );
        return;
      }
      const holidayItems = (selected.holidays || []).map((holiday) => {
        const detail = holidayDetailById.get(String(holiday?.id || ""));
        const continuation = detail
          ? [
              detail.continuesFromPrev ? "continues from previous day" : "",
              detail.continuesToNext ? "continues to next day" : "",
            ]
              .filter(Boolean)
              .join(", ")
          : "";
        return createElement(
          "span",
          {
            className: `calendar-selected-day__holiday-item ${holidayColorClass(holiday.colorTag)}`,
          },
          [
            createElement("span", {
              className: "calendar-selected-day__holiday-mark",
              attrs: { "aria-hidden": "true" },
              text: "H",
            }),
            holiday.name,
            " ",
            createElement("span", {
              className: "calendar-selected-day__holiday-cat",
              text: `(${holidayCategoryLabel(holiday.category)}${continuation ? ` | ${continuation}` : ""})`,
            }),
          ],
        );
      });
      const markerItems = (selected.markers || []).map((marker) =>
        createElement("span", { className: "calendar-selected-day__astro-item" }, [
          astroIconNode(marker),
          " ",
          astronomyMarkerLabel(marker),
        ]),
      );
      const cycleItems = (selected.cycles || []).map((cycle) =>
        createElement(
          "span",
          { className: `calendar-selected-day__cycle-item ${cycleKindClass(cycle)}` },
          [
            cycleIconNode(cycle),
            " ",
            createElement("b", { text: cycle.ruleName || "Cycle" }),
            ": ",
            cycle.label || "Marker",
          ],
        ),
      );
      const moonLines = (selected.moonStates || []).map((moonState, index) =>
        createElement(
          "div",
          { className: "calendar-selected-day__line calendar-selected-day__line--moon" },
          [
            moonIconNode(moonState, index),
            " ",
            createElement("b", { text: moonState.name }),
            `: ${moonState.phase.phaseName} (${fmt(moonState.phase.illuminationPct, 1)}%), age ${fmt(
              moonState.phase.ageDays,
              0,
            )} / ${fmt(moonState.synodicDays, 3)} days`,
          ],
        ),
      );
      const traceNode = buildTraceNode(trace);
      replaceChildren(node, [
        createElement("div", {
          className: "calendar-selected-day__title",
          text: `Day ${selected.dayNumber}, ${model.monthName}, ${yearLabel} (Day ${selected.absoluteDay + 1})`,
        }),
        moonLines,
        selectedDayLine("Holidays", interleaveNodes(holidayItems)),
        selectedDayLine("Astronomy", interleaveNodes(markerItems)),
        selectedDayLine("Cycles", interleaveNodes(cycleItems)),
        traceNode,
      ]);
    };
    renderSelectedDay(els.selectedDay);
    renderSelectedDay(els.detailSelectedDay);

    replaceChildren(
      els.compactGrid,
      [
        { label: "Basis", tip: TIPS.Basis || "", value: state.ui.basis },
        {
          label: "Days this month",
          tip: "Number of days in the current month after leap adjustments.",
          value: model.monthLength,
        },
        {
          label: "Weeks shown",
          tip: "Rows needed to display this month in the current week layout.",
          value: model.rows.length,
        },
        {
          label: "Holidays this month",
          tip: "Total holiday matches in this month (multiple holidays can occur on one day).",
          value: model.holidaysInMonth.reduce((a, e) => a + e[1], 0),
        },
        {
          label: "Festivals this month",
          tip: TIPS["Festival days"] || "",
          value: model.festivalsInMonth.reduce((a, e) => a + e[1], 0),
        },
        {
          label: "Astronomy markers",
          tip: TIPS["Astronomy markers"] || "",
          value: model.markersInMonth.reduce((a, e) => a + (e.count || 0), 0),
        },
        {
          label: "Cycle markers",
          tip: TIPS["Cycle list"] || "",
          value: model.cyclesInMonth.reduce((a, e) => a + (e.count || 0), 0),
        },
      ].map((item) =>
        createElement("div", { className: "calendar-compact-card" }, [
          createElement("div", { className: "calendar-compact-card__label" }, [
            item.label,
            " ",
            tipIconNode(item.tip || ""),
          ]),
          createElement("div", {
            className: "calendar-compact-card__value",
            text: String(item.value),
          }),
        ]),
      ),
    );

    const holidayEvents = model.holidaysInMonth
      .slice(0, 6)
      .map(([hid, hits]) => {
        const h = holidays.find((x) => x.id === hid);
        return h ? `${h.name} [${holidayCategoryLabel(h.category)}] (${hits})` : "";
      })
      .filter(Boolean);
    const festivalEvents = model.festivalsInMonth
      .slice(0, 6)
      .map(([fid, hits]) => {
        const f = festivals.find((x) => x.id === fid);
        return f ? `${f.name} (${hits})` : "";
      })
      .filter(Boolean);
    const markerEvents = model.markersInMonth
      .slice(0, 8)
      .map((marker) => `${astronomyMarkerLabel(marker)} (${marker.count})`);
    const cycleEvents = model.cyclesInMonth
      .slice(0, 8)
      .map((cycle) => `Cycle: ${cycle.ruleName || "Rule"} (${cycle.count})`);
    const eventItems = [holidayEvents, festivalEvents, markerEvents, cycleEvents].flat();
    replaceChildren(els.compactEvents, [
      createElement("div", { className: "calendar-compact-events__label" }, [
        "Month events ",
        tipIconNode(TIPS["Month events"] || ""),
      ]),
      eventItems.length
        ? createElement(
            "ul",
            {},
            eventItems.map((item) => createElement("li", { text: item })),
          )
        : hintNode("No holiday or festival events this month."),
      model.outsideWeekFlowFestivals.length
        ? hintNode(
            `Outside-week-flow festivals: ${model.outsideWeekFlowFestivals
              .map((festival) => `${festival.name} (after day ${festival.afterDay})`)
              .slice(0, 4)
              .join(", ")}`,
          )
        : null,
    ]);

    const mini = miniGrid(model, selected?.dayNumber || state.ui.selectedDay);
    replaceChildren(els.miniHead, mini.head);
    replaceChildren(els.miniBody, mini.body);

    const detail = detailedGrid(model, selected?.dayNumber || state.ui.selectedDay);
    replaceChildren(els.detailHead, detail.head);
    replaceChildren(els.detailBody, detail.body);

    updateHolidayEnables();
    updateFestivalEnables();
    updateCycleEnables();
    applyCollapsedPanels();
    applyDrawerState();
    persistState(state);
  }

  function shiftMonth(delta) {
    const ctx = buildContext(loadWorld(), state);
    const mpy = ctx.metrics.monthsPerYear;
    let month = state.ui.monthIndex + delta;
    let year = state.ui.year;
    while (month < 0) {
      month += mpy;
      year -= 1;
    }
    while (month >= mpy) {
      month -= mpy;
      year += 1;
    }
    state.ui.year = Math.max(1, year);
    state.ui.monthIndex = clampI(month, 0, mpy - 1);
    state.ui.selectedDay = 1;
  }

  function jumpToAbsoluteDay(absDay) {
    const ctx = buildContext(loadWorld(), state);
    const converted = fromAbsoluteDay(ctx.metrics, ctx.leapRules, absDay, ctx.monthLengthOverrides);
    state.ui.jumpAbsoluteDay = converted.absoluteDay;
    state.ui.jumpYear = converted.year;
    state.ui.jumpMonthIndex = converted.monthIndex;
    state.ui.jumpDayOfMonth = converted.dayOfMonth;
    state.ui.year = converted.year;
    state.ui.monthIndex = converted.monthIndex;
    state.ui.selectedDay = converted.dayOfMonth;
  }

  function jumpToDate(year, monthIndex, dayOfMonth) {
    const ctx = buildContext(loadWorld(), state);
    const safeYear = Math.max(1, I(year, 1));
    const safeMonth = clampI(monthIndex, 0, ctx.metrics.monthsPerYear - 1);
    const lengths = getMonthLengthsForYear({
      metrics: ctx.metrics,
      year: safeYear,
      leapRules: ctx.leapRules,
      monthLengthOverrides: ctx.monthLengthOverrides,
    });
    const safeDay = clampI(dayOfMonth, 1, lengths[safeMonth] || 1);
    const abs = toAbsoluteDay(
      ctx.metrics,
      ctx.leapRules,
      safeYear,
      safeMonth,
      safeDay,
      ctx.monthLengthOverrides,
    );
    state.ui.jumpAbsoluteDay = abs;
    state.ui.jumpYear = safeYear;
    state.ui.jumpMonthIndex = safeMonth;
    state.ui.jumpDayOfMonth = safeDay;
    state.ui.year = safeYear;
    state.ui.monthIndex = safeMonth;
    state.ui.selectedDay = safeDay;
  }

  async function importCalendarJsonText(rawText, label = "JSON") {
    const text = String(rawText || "").trim();
    if (!text) {
      setJsonStatus("No JSON provided.", "warn");
      return;
    }
    try {
      const parsed = JSON.parse(text);
      applyCalendarPayload(parsed);
      setJsonStatus(`Imported calendar from ${label}.`, "ok");
    } catch (err) {
      setJsonStatus(`Import failed: ${err?.message || "Invalid JSON."}`, "error");
    }
  }

  resetHolidayForm();
  resetFestivalForm();
  resetCycleForm();
  loadCurrentJsonToTextarea();
  setOutputStatus("Ready.", "info");
  applyCollapsedPanels();
  applyDrawerState();

  els.drawerToggle.addEventListener("click", () => {
    state.ui.drawerOpen = !state.ui.drawerOpen;
    applyDrawerState();
    persistState(state);
  });
  wrap.querySelector(".calendar-drawer__tabs")?.addEventListener("click", (e) => {
    const tab = e.target.closest("[data-drawer-tab]");
    if (!tab) return;
    state.ui.drawerSection = tab.dataset.drawerTab;
    applyDrawerState();
    persistState(state);
  });
  wrap.querySelector(".calendar-drawer__subtabs")?.addEventListener("click", (e) => {
    const st = e.target.closest("[data-rules-tab]");
    if (!st) return;
    state.ui.rulesTab = st.dataset.rulesTab;
    applyDrawerState();
    persistState(state);
  });
  wrap.querySelector("#calDrawerBackdrop")?.addEventListener("click", () => {
    state.ui.drawerOpen = false;
    applyDrawerState();
    persistState(state);
  });

  // Tutorial panel
  createTutorial({
    steps: TUTORIAL_STEPS,
    storageKey: "worldsmith.cal.tutorial",
    container: wrap,
    triggerBtn: wrap.querySelector("#calTutorials"),
  });

  for (const { key } of CALENDAR_COLLAPSIBLE_PANELS) {
    const refs = collapsiblePanels[key];
    if (!refs?.button) continue;
    refs.button.addEventListener("click", () => {
      state.ui.collapsedSections[key] = !state.ui.collapsedSections[key];
      applyCollapsedPanels();
      persistState(state);
    });
  }

  const makeProfileId = () => `cal-${Math.random().toString(36).slice(2, 10)}`;

  els.profileSelect.addEventListener("change", () => {
    activateProfile(els.profileSelect.value);
    render();
  });

  els.profileNew.addEventListener("click", () => {
    saveActiveProfileSnapshot();
    const suggested = `Calendar ${Math.max(2, (state.profiles?.length || 0) + 1)}`;
    const name = String(window.prompt("Name for new calendar profile:", suggested) || "").trim();
    if (!name) return;
    const id = makeProfileId();
    const seed = normalizeSingleProfile(loadWorld(), defaultState(loadWorld()));
    seed.ui.calendarName = name;
    const profile = { id, name, ...seed };
    state._allProfiles.push(profile);
    activateProfile(id);
    render();
  });

  els.profileDuplicate.addEventListener("click", () => {
    saveActiveProfileSnapshot();
    const suggested = `${state.profileName || state.ui.calendarName || "Calendar"} copy`;
    const name = String(window.prompt("Name for duplicated profile:", suggested) || "").trim();
    if (!name) return;
    const id = makeProfileId();
    const clone = normalizeSingleProfile(loadWorld(), {
      inputs: clonePlain(state.inputs),
      ui: clonePlain(state.ui),
    });
    clone.ui.calendarName = name;
    const profile = { id, name, ...clone };
    state._allProfiles.push(profile);
    activateProfile(id);
    render();
  });

  els.profileDelete.addEventListener("click", () => {
    saveActiveProfileSnapshot();
    if ((state._allProfiles || []).length <= 1) return;
    if (!window.confirm(`Delete calendar profile "${state.profileName}"?`)) return;
    state._allProfiles = state._allProfiles.filter(
      (p) => String(p?.id) !== String(state.profileId),
    );
    const fallback = state._allProfiles[0];
    if (!fallback) return;
    activateProfile(fallback.id);
    render();
  });

  // Live-update: read inputs and re-render without resetting view position
  function applyInputsLive() {
    state.inputs.sourcePlanetId = els.sourcePlanet.value || "";
    state.inputs.primaryMoonId = els.primaryMoon.value || "";
    state.inputs.extraMoonIds = [
      els.extraMoon1.value || "",
      els.extraMoon2.value || "",
      els.extraMoon3.value || "",
    ];
    state.ui.derivedRoundEnabled = !!els.derivedRoundEnabled.checked;
    state.ui.derivedDecimalPlaces = clampI(els.derivedDecimalPlaces.value, 0, 6);
    state.inputs.monthsPerYear = clampI(els.monthsPerYear.value, 1, 240);
    state.inputs.daysPerMonth = clampI(els.daysPerMonth.value, 1, 500);
    const liveDpm = state.inputs.daysPerMonth;
    state.inputs.daysPerWeek = clampI(els.daysPerWeek.value, 1, Math.min(30, liveDpm));
    render();
  }

  // Source object selects reset calendar view position (new orbital data)
  [els.sourcePlanet, els.primaryMoon, els.extraMoon1, els.extraMoon2, els.extraMoon3].forEach(
    (el) =>
      el.addEventListener("change", () => {
        state.ui.monthIndex = 0;
        state.ui.selectedDay = 1;
        applyInputsLive();
      }),
  );

  // Number/slider inputs live-update without resetting view
  [els.monthsPerYear, els.daysPerMonth, els.daysPerWeek, els.derivedDecimalPlaces].forEach((el) =>
    el.addEventListener("input", applyInputsLive),
  );

  // Rounding toggle: enable/disable slider + live-update
  els.derivedRoundEnabled.addEventListener("change", () => {
    const on = els.derivedRoundEnabled.checked;
    els.derivedDecimalPlaces.disabled = !on;
    const dpSlider = els.derivedDecimalPlaces
      .closest(".form-row")
      ?.querySelector('input[type="range"]');
    if (dpSlider) dpSlider.disabled = !on;
    applyInputsLive();
  });

  els.useSelected.addEventListener("click", () => {
    const w = loadWorld();
    state.inputs.sourcePlanetId = getSelectedPlanet(w)?.id || "";
    state.inputs.primaryMoonId = getSelectedMoon(w)?.id || "";
    state.inputs.extraMoonIds = ["", "", ""];
    state.inputs.monthsPerYear = null;
    state.inputs.daysPerMonth = null;
    state.inputs.daysPerWeek = null;
    render();
  });

  els.exportDownload.addEventListener("click", () => {
    const text = currentCalendarJsonText();
    downloadJsonFile(`worldsmith-calendar-${utcStampCompact()}.json`, text);
    setJsonStatus("Downloaded calendar JSON.", "ok");
  });

  els.exportCopy.addEventListener("click", async () => {
    const ok = await copyTextToClipboard(currentCalendarJsonText());
    setJsonStatus(ok ? "Copied calendar JSON to clipboard." : "Copy failed.", ok ? "ok" : "error");
  });

  els.importFileBtn.addEventListener("click", () => {
    els.importFile.click();
  });

  els.importFile.addEventListener("change", async () => {
    const file = els.importFile.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      if (document.activeElement !== els.jsonText) {
        els.jsonText.value = text;
      }
      await importCalendarJsonText(text, file.name);
    } catch (err) {
      setJsonStatus(`Import failed: ${err?.message || "Could not read file."}`, "error");
    } finally {
      els.importFile.value = "";
    }
  });

  els.importApply.addEventListener("click", async () => {
    await importCalendarJsonText(els.jsonText.value, "pasted JSON");
  });

  els.jsonLoadCurrent.addEventListener("click", () => {
    loadCurrentJsonToTextarea();
  });

  els.jumpAbsBtn.addEventListener("click", () => {
    jumpToAbsoluteDay(els.jumpAbs.value);
    render();
  });

  els.jumpDateBtn.addEventListener("click", () => {
    jumpToDate(els.jumpYear.value, els.jumpMonth.value, els.jumpDay.value);
    render();
  });

  const updateYearDisplayState = () => {
    state.ui.calendarName = String(els.calendarName.value || "").trim() || "Calendar";
    state.profileName = state.ui.calendarName;
    state.ui.yearDisplayMode = ["numeric", "era", "pre-calendar"].includes(
      els.yearDisplayMode.value,
    )
      ? els.yearDisplayMode.value
      : "numeric";
    state.ui.yearOffset = I(els.yearOffset.value, 0);
    state.ui.yearPrefix = String(els.yearPrefix.value || "").trim();
    state.ui.yearSuffix = String(els.yearSuffix.value || "").trim();
    state.ui.preCalendarStartYear = Math.max(1, I(els.preCalendarStartYear.value, 1));
    state.ui.postEraLabel = String(els.postEraLabel.value || "").trim() || "CE";
    state.ui.preEraLabel = String(els.preEraLabel.value || "").trim() || "BCE";
    state.ui.preCalendarUseYearZero = !!els.preCalendarUseYearZero.checked;
  };

  const updateOutputStateFromControls = () => {
    state.ui.astronomy = {
      enabled: !!els.markerEnabled.checked,
      seasons: !!els.markerSeasons.checked,
      seasonBands: !!els.markerSeasonBands.checked,
      eclipses: !!els.markerEclipses.checked,
    };
    state.ui.exportAnchorDate = normalizeIsoDate(els.icsAnchor.value);
    state.ui.icsIncludes = {
      holidays: !!els.icsIncHolidays.checked,
      festivals: !!els.icsIncFestivals.checked,
      markers: !!els.icsIncMarkers.checked,
    };
  };
  [
    els.calendarName,
    els.yearDisplayMode,
    els.yearOffset,
    els.yearPrefix,
    els.yearSuffix,
    els.preCalendarStartYear,
    els.postEraLabel,
    els.preEraLabel,
    els.preCalendarUseYearZero,
  ].forEach((el) =>
    el.addEventListener("change", () => {
      updateYearDisplayState();
      render();
    }),
  );

  [els.markerEnabled, els.markerSeasons, els.markerSeasonBands, els.markerEclipses].forEach((el) =>
    el.addEventListener("change", () => {
      updateOutputStateFromControls();
      render();
    }),
  );
  els.holidayFilters?.addEventListener("change", (event) => {
    const input = event.target.closest("input[data-cal-holiday-filter]");
    if (!input) return;
    const category = String(input.getAttribute("data-cal-holiday-filter") || "").trim();
    if (!HOLIDAY_CATEGORY_SET.has(category)) return;
    state.ui.holidayCategoryFilters = normalizeHolidayCategoryFilters(
      state.ui.holidayCategoryFilters,
    );
    state.ui.holidayCategoryFilters[category] = !!input.checked;
    render();
  });
  [els.icsAnchor, els.icsIncHolidays, els.icsIncFestivals, els.icsIncMarkers].forEach((el) =>
    el.addEventListener("change", () => {
      updateOutputStateFromControls();
      render();
    }),
  );

  els.pdfMonth.addEventListener("click", () => {
    updateOutputStateFromControls();
    openPrintableCalendar("month");
  });
  els.pdfYear.addEventListener("click", () => {
    updateOutputStateFromControls();
    openPrintableCalendar("year");
  });
  els.icsMonth.addEventListener("click", () => {
    updateOutputStateFromControls();
    const { text, count } = buildIcs("month");
    const safeName = String(state.ui.calendarName || "calendar")
      .trim()
      .replace(/[^a-z0-9_-]+/gi, "-")
      .replace(/^-+|-+$/g, "");
    downloadJsonFile(
      `${safeName || "calendar"}-${state.ui.year}-m${state.ui.monthIndex + 1}-${utcStampCompact()}.ics`,
      text,
      "text/calendar;charset=utf-8",
    );
    setOutputStatus(`Exported month ICS with ${count} events.`, "ok");
  });
  els.icsYear.addEventListener("click", () => {
    updateOutputStateFromControls();
    const { text, count } = buildIcs("year");
    const safeName = String(state.ui.calendarName || "calendar")
      .trim()
      .replace(/[^a-z0-9_-]+/gi, "-")
      .replace(/^-+|-+$/g, "");
    downloadJsonFile(
      `${safeName || "calendar"}-${state.ui.year}-${utcStampCompact()}.ics`,
      text,
      "text/calendar;charset=utf-8",
    );
    setOutputStatus(`Exported year ICS with ${count} events.`, "ok");
  });

  els.basis.addEventListener("change", () => {
    state.ui.basis = els.basis.value;
    state.ui.monthIndex = 0;
    state.ui.selectedDay = 1;
    render();
  });
  els.year.addEventListener("change", () => {
    state.ui.year = Math.max(1, clampI(els.year.value, 1, 1000000));
    render();
  });
  els.month.addEventListener("change", () => {
    state.ui.monthIndex = Math.max(0, I(els.month.value, 0));
    state.ui.selectedDay = 1;
    render();
  });
  els.startDay.addEventListener("change", () => {
    state.ui.startDayOfYear = Math.max(0, I(els.startDay.value, 0));
    render();
  });
  els.weekStart.addEventListener("change", () => {
    state.ui.weekStartsOn = Math.max(0, I(els.weekStart.value, 0));
    render();
  });
  els.moonEpoch.addEventListener("change", () => {
    state.ui.moonEpochOffsetDays = N(els.moonEpoch.value, 0);
    render();
  });

  // Live-update: name textareas apply on every keystroke
  function applyNamesLive() {
    updateYearDisplayState();
    state.ui.dayNames = splitNames(els.dayNames.value);
    state.ui.weekNames = splitNames(els.weekNames.value);
    state.ui.monthNames = splitNames(els.monthNames.value);
    render();
  }
  [els.dayNames, els.weekNames, els.monthNames].forEach((el) =>
    el.addEventListener("input", applyNamesLive),
  );
  els.monthLengthOverridesEnabled.addEventListener("change", () => {
    state.ui.monthLengthOverridesEnabled = els.monthLengthOverridesEnabled.checked;
    render();
  });
  els.monthLengthOverrides.addEventListener("input", () => {
    state.ui.monthLengthOverrides = splitMonthLengths(els.monthLengthOverrides.value);
    render();
  });
  els.resetNames.addEventListener("click", () => {
    state.ui.calendarName = "Calendar";
    state.profileName = "Calendar";
    state.ui.dayNames = [];
    state.ui.weekNames = [];
    state.ui.monthNames = [];
    state.ui.monthLengthOverridesEnabled = false;
    state.ui.monthLengthOverrides = [];
    state.ui.yearPrefix = "";
    state.ui.yearSuffix = "";
    state.ui.yearOffset = 0;
    state.ui.yearDisplayMode = "numeric";
    state.ui.preCalendarStartYear = 1;
    state.ui.postEraLabel = "CE";
    state.ui.preEraLabel = "BCE";
    state.ui.preCalendarUseYearZero = false;
    render();
  });

  els.eraAdd.addEventListener("click", () => {
    const name = String(els.eraName.value || "").trim();
    const startYear = Math.max(1, I(els.eraStartYear.value, 1));
    if (!name) return;
    const next = normEraRules([
      ...(Array.isArray(state.ui.eras) ? state.ui.eras : []),
      { id: `era-${Math.random().toString(36).slice(2, 9)}`, name, startYear },
    ]);
    state.ui.eras = next;
    els.eraName.value = "";
    els.eraStartYear.value = "";
    render();
  });

  els.eraList.addEventListener("click", (event) => {
    const delBtn = event.target.closest("button[data-cal-era-del]");
    if (!delBtn) return;
    const id = delBtn.getAttribute("data-cal-era-del");
    state.ui.eras = normEraRules(
      (Array.isArray(state.ui.eras) ? state.ui.eras : []).filter(
        (x) => String(x?.id) !== String(id),
      ),
    );
    render();
  });

  [
    els.holidayUseDate,
    els.holidayUseWeekday,
    els.holidayUseMoon,
    els.holidayUseRelative,
    els.holidayRelativeType,
    els.holidayAdvancedToggle,
    els.holidayAnchorType,
    els.holidayConflictScope,
    els.holidayRecurrence,
  ].forEach((el) => el.addEventListener("change", updateHolidayEnables));
  els.festivalRecurrence.addEventListener("change", updateFestivalEnables);
  els.cycleMode.addEventListener("change", updateCycleEnables);
  els.cycleWeekendRule.addEventListener("change", () => {
    state.ui.workWeekendRule = normalizeWeekendRule(els.cycleWeekendRule.value);
    render();
  });
  els.weekendDays.addEventListener("change", (event) => {
    const input = event.target.closest("input[data-cal-weekend-day]");
    if (!input) return;
    const selected = [
      ...els.weekendDays.querySelectorAll("input[data-cal-weekend-day]:checked"),
    ].map((el) => I(el.getAttribute("data-cal-weekend-day"), 0));
    const daysPerWeek = Math.max(
      1,
      els.weekendDays.querySelectorAll("input[data-cal-weekend-day]").length,
    );
    state.ui.weekendDayIndexes = normalizeWeekendDayIndexes(selected, daysPerWeek);
    render();
  });

  els.holidaySave.addEventListener("click", () => {
    const ctx = buildContext(loadWorld(), state);
    const recurrence = els.holidayRecurrence.value;
    const oneOff = recurrence === "one-off";
    const useRelative = !!els.holidayUseRelative.checked;
    const relativeType = String(els.holidayRelativeType.value || "none");
    const useAdvanced = !!els.holidayAdvancedToggle.checked;
    const anchorType = String(els.holidayAnchorType.value || "fixed-date");
    const relativeAnchorType =
      !useAdvanced && useRelative && relativeType !== "none"
        ? relativeType === "moon-phase"
          ? "moon-phase"
          : relativeType === "astronomy-marker"
            ? "astronomy-marker"
            : relativeType === "holiday"
              ? "holiday"
              : "fixed-date"
        : anchorType;
    const anchorMoonSlot = Math.max(0, I(els.holidayAnchorMoonSlot.value, 0));
    const anchorMoonId = els.holidayAnchorMoonSlot.selectedOptions?.[0]?.dataset?.moonId || "";
    const anchorMoonPhase = String(els.holidayAnchorMoonPhase.value || "F");
    const anchorMarker = String(els.holidayAnchorMarker.value || "").trim();
    const anchorHoliday = String(els.holidayAnchorHoliday.value || "").trim();
    const relativeMoonSlot = Math.max(0, I(els.holidayRelativeMoonSlot.value, 0));
    const relativeMoonId = els.holidayRelativeMoonSlot.selectedOptions?.[0]?.dataset?.moonId || "";
    const relativeMoonPhase = String(els.holidayRelativeMoonPhase.value || "F");
    const relativeMarker = String(els.holidayRelativeMarker.value || "").trim();
    const relativeHoliday = String(els.holidayRelativeHoliday.value || "").trim();
    const draft = {
      id: runtime.editingHolidayId || `holiday-${Math.random().toString(36).slice(2, 9)}`,
      name: String(els.holidayName.value || "").trim(),
      category: normalizeHolidayCategory(els.holidayCategory.value),
      colorTag: normalizeHolidayColorTag(els.holidayColorTag.value),
      recurrence,
      startMonth: Math.max(0, I(els.holidayStartMonth.value, 0)),
      year: Math.max(1, I(els.holidayYear.value, state.ui.year)),
      attrs: {
        useDate: useRelative ? false : oneOff ? true : !!els.holidayUseDate.checked,
        useWeekday: useRelative ? false : !!els.holidayUseWeekday.checked,
        useMoonPhase: useRelative ? false : !!els.holidayUseMoon.checked,
      },
      dayOfMonth: Math.max(1, I(els.holidayDayOfMonth.value, 1)),
      durationDays: Math.max(1, I(els.holidayDuration.value, 1)),
      priority: I(els.holidayPriority.value, 0),
      mergeMode: els.holidayMergeMode.value,
      weekday: Math.max(0, I(els.holidayWeekday.value, 0)),
      occurrence: els.holidayOccurrence.value,
      moonSlot: Math.max(0, I(els.holidayMoonSlot.value, 0)),
      moonId: els.holidayMoonSlot.selectedOptions?.[0]?.dataset?.moonId || "",
      moonPhase: els.holidayMoonPhase.value,
      relative: {
        enabled: useRelative && relativeType !== "none",
        type: relativeType,
        offsetDays: I(els.holidayRelativeOffset.value, 0),
        moonSlot: relativeMoonSlot,
        moonId: relativeMoonId,
        moonPhase: relativeMoonPhase,
        markerKey: relativeMarker,
        holidayId: relativeHoliday,
      },
      anchor: {
        type: HOLIDAY_ANCHOR_TYPES.some(([value]) => value === relativeAnchorType)
          ? relativeAnchorType
          : "fixed-date",
        algorithmKey: String(els.holidayAlgorithm.value || "none"),
        moonSlot: !useAdvanced && useRelative ? relativeMoonSlot : anchorMoonSlot,
        moonId: !useAdvanced && useRelative ? relativeMoonId : anchorMoonId,
        moonPhase: !useAdvanced && useRelative ? relativeMoonPhase : anchorMoonPhase,
        markerKey: !useAdvanced && useRelative ? relativeMarker : anchorMarker,
        holidayId: !useAdvanced && useRelative ? relativeHoliday : anchorHoliday,
      },
      offsetDays: useAdvanced
        ? I(els.holidayAnchorOffset.value, 0)
        : useRelative && relativeType !== "none"
          ? I(els.holidayRelativeOffset.value, 0)
          : 0,
      observance: {
        weekendRule: normalizeWeekendRule(state.ui.workWeekendRule),
        holidayConflictRule: String(els.holidayConflictRule.value || "merge"),
        maxShiftDays: Math.max(0, I(els.holidayMaxShiftDays.value, 7)),
        stayInMonth: !!els.holidayStayInMonth.checked,
      },
      conflictScope: {
        appliesAgainst: String(els.holidayConflictScope.value || "all"),
        categories: parseStringList(els.holidayConflictCategories.value),
        holidayIds: parseStringList(els.holidayConflictHolidayIds.value),
      },
      exceptYears: parseIntList(els.holidayExceptYears.value, 1, 1000000),
      exceptMonths: parseIntList(els.holidayExceptMonths.value, 1, ctx.metrics.monthsPerYear),
      exceptDays: parseIntList(els.holidayExceptDays.value, 1, 500),
    };
    state.ui.holidayAdvanced = useAdvanced;
    if (
      !draft.relative.enabled &&
      !draft.attrs.useDate &&
      !draft.attrs.useWeekday &&
      !draft.attrs.useMoonPhase
    ) {
      draft.attrs.useDate = true;
    }
    if (!draft.name) return;
    const h = normHolidayRule(draft, 0, ctx.metrics.monthsPerYear);
    const list = normHolidayRules(state.ui.holidays, ctx.metrics.monthsPerYear);
    const i = list.findIndex((x) => x.id === h.id);
    if (i >= 0) list[i] = h;
    else list.push(h);
    state.ui.holidays = list;
    resetHolidayForm();
    render();
  });

  els.holidayCancel.addEventListener("click", () => {
    resetHolidayForm();
    render();
  });

  els.holidayList.addEventListener("click", (event) => {
    const editBtn = event.target.closest("button[data-cal-holiday-edit]");
    if (editBtn) {
      const id = editBtn.getAttribute("data-cal-holiday-edit");
      const ctx = buildContext(loadWorld(), state);
      const h = ctx.holidays.find((x) => x.id === id);
      if (!h) return;
      runtime.editingHolidayId = h.id;
      els.holidayName.value = h.name;
      els.holidayCategory.value = normalizeHolidayCategory(h.category);
      els.holidayColorTag.value = normalizeHolidayColorTag(h.colorTag);
      els.holidayRecurrence.value = h.recurrence;
      els.holidayStartMonth.value = String(h.startMonth);
      els.holidayYear.value = String(Math.max(1, I(h.year, 1)));
      els.holidayUseDate.checked = !!h.attrs.useDate;
      els.holidayUseWeekday.checked = !!h.attrs.useWeekday;
      els.holidayUseMoon.checked = !!h.attrs.useMoonPhase;
      els.holidayUseRelative.checked = !!h.relative?.enabled;
      els.holidayRelativeType.value = h.relative?.type || "none";
      els.holidayRelativeOffset.value = String(I(h.relative?.offsetDays, 0));
      els.holidayRelativeMoonSlot.value = String(clampI(h.relative?.moonSlot ?? 0, 0, 3));
      els.holidayRelativeMoonPhase.value = String(h.relative?.moonPhase || "F");
      els.holidayRelativeMarker.value = String(
        h.relative?.markerKey || HOLIDAY_RELATIVE_MARKERS[0]?.[0] || "vernal-equinox",
      );
      els.holidayRelativeHoliday.value = String(h.relative?.holidayId || "");
      els.holidayAnchorType.value = String(h.anchor?.type || "fixed-date");
      els.holidayAlgorithm.value = String(h.anchor?.algorithmKey || "none");
      els.holidayAnchorMoonSlot.value = String(clampI(h.anchor?.moonSlot ?? 0, 0, 3));
      els.holidayAnchorMoonPhase.value = String(h.anchor?.moonPhase || "F");
      els.holidayAnchorMarker.value = String(
        h.anchor?.markerKey || HOLIDAY_RELATIVE_MARKERS[0]?.[0] || "vernal-equinox",
      );
      els.holidayAnchorHoliday.value = String(h.anchor?.holidayId || "");
      els.holidayAnchorOffset.value = String(I(h.offsetDays, I(h.relative?.offsetDays, 0)));
      els.holidayConflictRule.value = String(
        h.observance?.holidayConflictRule ||
          (String(h.mergeMode || "") === "override" ? "override" : "merge"),
      );
      els.holidayMaxShiftDays.value = String(Math.max(0, I(h.observance?.maxShiftDays, 7)));
      els.holidayStayInMonth.checked = !!h.observance?.stayInMonth;
      els.holidayConflictScope.value = String(h.conflictScope?.appliesAgainst || "all");
      els.holidayConflictCategories.value = (h.conflictScope?.categories || []).join(", ");
      els.holidayConflictHolidayIds.value = (h.conflictScope?.holidayIds || []).join(", ");
      els.holidayDayOfMonth.value = String(h.dayOfMonth);
      els.holidayDuration.value = String(Math.max(1, I(h.durationDays, 1)));
      els.holidayPriority.value = String(I(h.priority, 0));
      els.holidayMergeMode.value = h.mergeMode || "merge";
      els.holidayWeekday.value = String(h.weekday);
      els.holidayOccurrence.value = String(h.occurrence);
      els.holidayMoonSlot.value = String(h.moonSlot);
      els.holidayMoonPhase.value = String(h.moonPhase);
      els.holidayExceptYears.value = intListText(h.exceptYears);
      els.holidayExceptMonths.value = intListText(h.exceptMonths);
      els.holidayExceptDays.value = intListText(h.exceptDays);
      els.holidaySave.textContent = "Save holiday";
      els.holidayCancel.style.display = "";
      const hasAdvancedRule =
        String(h.anchor?.type || "fixed-date") !== "fixed-date" ||
        I(h.offsetDays, 0) !== 0 ||
        String(h.observance?.holidayConflictRule || "merge") !== "merge" ||
        !!h.observance?.stayInMonth ||
        String(h.conflictScope?.appliesAgainst || "all") !== "all" ||
        (Array.isArray(h.conflictScope?.holidayIds) && h.conflictScope.holidayIds.length > 0) ||
        (Array.isArray(h.conflictScope?.categories) && h.conflictScope.categories.length > 0);
      if (hasAdvancedRule) state.ui.holidayAdvanced = true;
      els.holidayAdvancedToggle.checked = !!state.ui.holidayAdvanced;
      updateHolidayEnables();
      return;
    }
    const delBtn = event.target.closest("button[data-cal-holiday-del]");
    if (!delBtn) return;
    const id = delBtn.getAttribute("data-cal-holiday-del");
    state.ui.holidays = (Array.isArray(state.ui.holidays) ? state.ui.holidays : []).filter(
      (x) => String(x?.id) !== String(id),
    );
    if (runtime.editingHolidayId === id) resetHolidayForm();
    render();
  });

  els.festivalSave.addEventListener("click", () => {
    const ctx = buildContext(loadWorld(), state);
    const draft = {
      id: runtime.editingFestivalId || `festival-${Math.random().toString(36).slice(2, 9)}`,
      name: String(els.festivalName.value || "").trim(),
      recurrence: els.festivalRecurrence.value,
      year: Math.max(1, I(els.festivalYear.value, state.ui.year)),
      startMonth: Math.max(0, I(els.festivalStartMonth.value, 0)),
      afterDay: Math.max(0, I(els.festivalAfterDay.value, 0)),
      durationDays: Math.max(1, I(els.festivalDuration.value, 1)),
      outsideWeekFlow: !!els.festivalOutsideWeek.checked,
    };
    if (!draft.name) return;
    const f = normFestivalRule(draft, 0, ctx.metrics.monthsPerYear);
    const list = normFestivalRules(state.ui.festivalRules, ctx.metrics.monthsPerYear);
    const i = list.findIndex((x) => x.id === f.id);
    if (i >= 0) list[i] = f;
    else list.push(f);
    state.ui.festivalRules = list;
    resetFestivalForm();
    render();
  });

  els.festivalCancel.addEventListener("click", () => {
    resetFestivalForm();
    render();
  });

  els.festivalList.addEventListener("click", (event) => {
    const editBtn = event.target.closest("button[data-cal-festival-edit]");
    if (editBtn) {
      const id = editBtn.getAttribute("data-cal-festival-edit");
      const ctx = buildContext(loadWorld(), state);
      const f = ctx.festivals.find((x) => x.id === id);
      if (!f) return;
      runtime.editingFestivalId = f.id;
      els.festivalName.value = f.name;
      els.festivalRecurrence.value = f.recurrence;
      els.festivalYear.value = String(Math.max(1, I(f.year, 1)));
      els.festivalStartMonth.value = String(clampI(f.startMonth, 0, ctx.metrics.monthsPerYear - 1));
      els.festivalAfterDay.value = String(Math.max(0, I(f.afterDay, 0)));
      els.festivalDuration.value = String(Math.max(1, I(f.durationDays, 1)));
      els.festivalOutsideWeek.checked = !!f.outsideWeekFlow;
      els.festivalSave.textContent = "Save festival";
      els.festivalCancel.style.display = "";
      updateFestivalEnables();
      return;
    }
    const delBtn = event.target.closest("button[data-cal-festival-del]");
    if (!delBtn) return;
    const id = delBtn.getAttribute("data-cal-festival-del");
    state.ui.festivalRules = (
      Array.isArray(state.ui.festivalRules) ? state.ui.festivalRules : []
    ).filter((x) => String(x?.id) !== String(id));
    if (runtime.editingFestivalId === id) resetFestivalForm();
    render();
  });

  els.cycleSave.addEventListener("click", () => {
    const draft = {
      id: runtime.editingCycleId || `cycle-${Math.random().toString(36).slice(2, 9)}`,
      name: String(els.cycleName.value || "").trim(),
      mode: String(els.cycleMode.value || "duty"),
      startAbsoluteDay: Math.max(0, I(els.cycleStartDay.value, 0)),
      onDays: Math.max(1, I(els.cycleOnDays.value, 1)),
      offDays: Math.max(1, I(els.cycleOffDays.value, 1)),
      intervalDays: Math.max(1, I(els.cycleIntervalDays.value, 1)),
      activeLabel: String(els.cycleActiveLabel.value || "Work").trim() || "Work",
      restLabel: String(els.cycleRestLabel.value || "Rest").trim() || "Rest",
      intervalLabel: String(els.cycleMarkerLabel.value || "Marker").trim() || "Marker",
      activeShort: sanitizeCycleShort(els.cycleActiveShort.value, "W"),
      restShort: sanitizeCycleShort(els.cycleRestShort.value, "R"),
      intervalShort: sanitizeCycleShort(els.cycleMarkerShort.value, "M"),
    };
    if (!draft.name) return;
    const rule = normWorkCycleRule(draft, 0);
    const list = normWorkCycleRules(state.ui.workCycles);
    const idx = list.findIndex((entry) => entry.id === rule.id);
    if (idx >= 0) list[idx] = rule;
    else list.push(rule);
    state.ui.workCycles = list;
    resetCycleForm();
    render();
  });

  els.cycleCancel.addEventListener("click", () => {
    resetCycleForm();
    render();
  });

  els.cycleList.addEventListener("click", (event) => {
    const editBtn = event.target.closest("button[data-cal-cycle-edit]");
    if (editBtn) {
      const id = editBtn.getAttribute("data-cal-cycle-edit");
      const list = normWorkCycleRules(state.ui.workCycles);
      const rule = list.find((entry) => String(entry.id) === String(id));
      if (!rule) return;
      runtime.editingCycleId = rule.id;
      els.cycleName.value = String(rule.name || "");
      els.cycleMode.value = String(rule.mode || "duty");
      els.cycleStartDay.value = String(Math.max(0, I(rule.startAbsoluteDay, 0)));
      els.cycleOnDays.value = String(Math.max(1, I(rule.onDays, 1)));
      els.cycleOffDays.value = String(Math.max(1, I(rule.offDays, 1)));
      els.cycleIntervalDays.value = String(Math.max(1, I(rule.intervalDays, 1)));
      els.cycleActiveLabel.value = String(rule.activeLabel || "Work");
      els.cycleRestLabel.value = String(rule.restLabel || "Rest");
      els.cycleMarkerLabel.value = String(rule.intervalLabel || "Marker");
      els.cycleActiveShort.value = sanitizeCycleShort(rule.activeShort, "W");
      els.cycleRestShort.value = sanitizeCycleShort(rule.restShort, "R");
      els.cycleMarkerShort.value = sanitizeCycleShort(rule.intervalShort, "M");
      els.cycleSave.textContent = "Save cycle rule";
      els.cycleCancel.style.display = "";
      updateCycleEnables();
      return;
    }
    const delBtn = event.target.closest("button[data-cal-cycle-del]");
    if (!delBtn) return;
    const id = delBtn.getAttribute("data-cal-cycle-del");
    state.ui.workCycles = (Array.isArray(state.ui.workCycles) ? state.ui.workCycles : []).filter(
      (entry) => String(entry?.id) !== String(id),
    );
    if (runtime.editingCycleId === id) resetCycleForm();
    render();
  });

  els.leapAdd.addEventListener("click", () => {
    const ctx = buildContext(loadWorld(), state);
    const rule = {
      id: `leap-${Math.random().toString(36).slice(2, 9)}`,
      name: String(els.leapName.value || "").trim() || "Leap Rule",
      cycleYears: clampI(els.leapCycle.value || 4, 1, 400),
      offsetYear: clampI(els.leapOffset.value || 1, 1, 400),
      monthIndex: clampI(els.leapMonth.value || 0, 0, ctx.metrics.monthsPerYear - 1),
      dayDelta: clampI(els.leapDelta.value || 1, -30, 30),
    };
    if (rule.dayDelta === 0) return;
    state.ui.leapRules = normalizeLeapRules(
      [...(Array.isArray(state.ui.leapRules) ? state.ui.leapRules : []), rule],
      ctx.metrics.monthsPerYear,
    );
    els.leapName.value = "";
    els.leapCycle.value = "";
    els.leapOffset.value = "";
    els.leapDelta.value = "";
    setLeapStatus("Leap rule added.", "ok");
    render();
  });

  els.leapSuggest.addEventListener("click", () => {
    const ctx = buildContext(loadWorld(), state);
    const suggestion = recommendLeapRuleFromOrbit(ctx);
    if (!suggestion?.ok) {
      setLeapStatus(suggestion?.message || "Could not compute a leap rule suggestion.", "warn");
      return;
    }

    const rule = {
      id: `leap-${Math.random().toString(36).slice(2, 9)}`,
      name: suggestion.ruleName || "Recommended Leap Rule",
      cycleYears: Math.max(1, I(suggestion.cycleYears, 1)),
      offsetYear: 1,
      monthIndex: clampI(suggestion.monthIndex, 0, Math.max(0, ctx.metrics.monthsPerYear - 1)),
      dayDelta: clampI(suggestion.dayDelta, -30, 30),
    };
    if (!rule.dayDelta) {
      setLeapStatus("Suggested leap correction resolved to 0 days; no rule added.", "warn");
      return;
    }

    const existingRules = normalizeLeapRules(state.ui.leapRules, ctx.metrics.monthsPerYear);
    const duplicate = existingRules.some(
      (existingRule) =>
        existingRule.cycleYears === rule.cycleYears &&
        existingRule.offsetYear === rule.offsetYear &&
        existingRule.monthIndex === rule.monthIndex &&
        existingRule.dayDelta === rule.dayDelta,
    );
    if (duplicate) {
      setLeapStatus(
        `Recommended rule already exists: ${suggestion.message}`,
        suggestion.quality === "low" ? "warn" : "info",
      );
      return;
    }

    state.ui.leapRules = normalizeLeapRules([...existingRules, rule], ctx.metrics.monthsPerYear);
    render();
    els.leapName.value = rule.name;
    els.leapCycle.value = String(rule.cycleYears);
    els.leapOffset.value = String(rule.offsetYear);
    els.leapMonth.value = String(rule.monthIndex);
    els.leapDelta.value = String(rule.dayDelta);
    setLeapStatus(
      `Suggested and added: ${suggestion.message}`,
      suggestion.quality === "low" ? "warn" : "ok",
    );
  });

  els.leapList.addEventListener("click", (event) => {
    const delBtn = event.target.closest("button[data-cal-leap-del]");
    if (!delBtn) return;
    const id = delBtn.getAttribute("data-cal-leap-del");
    state.ui.leapRules = (Array.isArray(state.ui.leapRules) ? state.ui.leapRules : []).filter(
      (x) => String(x?.id) !== String(id),
    );
    render();
  });

  els.prevMonth.addEventListener("click", () => {
    shiftMonth(-1);
    render();
  });
  els.nextMonth.addEventListener("click", () => {
    shiftMonth(1);
    render();
  });
  els.detailPrev.addEventListener("click", () => {
    shiftMonth(-1);
    render();
  });
  els.detailNext.addEventListener("click", () => {
    shiftMonth(1);
    render();
  });

  els.openDetail.addEventListener("click", openDetail);
  els.closeDetail.addEventListener("click", closeDetail);
  els.detailOverlay.addEventListener("click", (event) => {
    if (event.target === els.detailOverlay) closeDetail();
  });

  wrap.addEventListener("click", (event) => {
    const copyBtn = event.target.closest(".calendar-rule-trace__copy");
    if (copyBtn) {
      const trace = traceRulesForDay({
        cell: (() => {
          const ctx = runtime.lastCtx;
          if (!ctx?.monthModel) return null;
          const allDays = ctx.monthModel.rows
            .flatMap((r) => r.cells)
            .filter((c) => c && Number.isFinite(Number(c.dayNumber)));
          return allDays.find((d) => d.dayNumber === state.ui.selectedDay) || allDays[0];
        })(),
        model: runtime.lastCtx?.monthModel,
        holidays: runtime.lastCtx?.holidays || [],
        festivals: runtime.lastCtx?.festivals || [],
        workCycles: runtime.lastCtx?.workCycles || [],
        leapRules: runtime.lastCtx?.leapRules || [],
        metrics: runtime.lastCtx?.metrics,
        dayNames: runtime.lastCtx?.dayNames || [],
        weekendDayIndexes: state.ui.weekendDayIndexes,
      });
      const text = traceToPlainText(trace);
      if (navigator.clipboard?.writeText) {
        navigator.clipboard.writeText(text).then(
          () => {
            copyBtn.textContent = "Copied!";
            setTimeout(() => {
              copyBtn.textContent = "Copy to clipboard";
            }, 1500);
          },
          () => {
            copyBtn.textContent = "Copy failed";
          },
        );
      }
      return;
    }
    const miniBtn = event.target.closest("button[data-cal-mini-day]");
    if (miniBtn) {
      state.ui.selectedDay = Math.max(1, I(miniBtn.getAttribute("data-cal-mini-day"), 1));
      render();
      return;
    }
    const dayBtn = event.target.closest("button[data-cal-day]");
    if (!dayBtn) return;
    state.ui.selectedDay = Math.max(1, I(dayBtn.getAttribute("data-cal-day"), 1));
    render();
  });

  const onEsc = (event) => {
    if (event.key === "Escape") {
      closeDetail();
    }
  };
  document.addEventListener("keydown", onEsc);
  const wrapObserver = new MutationObserver(() => {
    if (!wrap.isConnected) {
      document.removeEventListener("keydown", onEsc);
      wrapObserver.disconnect();
    }
  });
  if (wrap.parentNode) {
    wrapObserver.observe(wrap.parentNode, { childList: true });
  }

  render();
}
