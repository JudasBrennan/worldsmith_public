// SPDX-License-Identifier: MPL-2.0
import { calcMoon } from "../../engine/moon.js";
import { calcPlanetExact } from "../../engine/planet.js";
import {
  ASTRO_ICON_CLASS_BY_KEY,
  CALENDAR_PHASES as PHASES,
  HOLIDAY_ALGORITHMS,
  HOLIDAY_ANCHOR_TYPES,
  HOLIDAY_CATEGORIES,
  HOLIDAY_CATEGORY_LABELS,
  HOLIDAY_CATEGORY_SET,
  HOLIDAY_COLOR_TAGS,
  HOLIDAY_COLOR_TAG_SET,
  HOLIDAY_CONFLICT_RULES,
  HOLIDAY_CONFLICT_SCOPES,
  HOLIDAY_RELATIVE_MARKERS,
  HOLIDAY_RELATIVE_TYPES,
  HOLIDAY_RESOLVE_MODES,
  HOLIDAY_WEEKEND_RULES,
  MOON_COLORS,
  OCCURRENCES,
  RECUR_MONTHS,
  RECURRENCES,
  WORK_CYCLE_MODES,
} from "./constants.js";

const hasOwn = (obj, key) => Object.prototype.hasOwnProperty.call(obj, key);

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

export function splitNames(raw) {
  if (Array.isArray(raw)) return raw;
  if (typeof raw !== "string") return [];
  return raw
    .split(/\r?\n/g)
    .map((x) => x.trim())
    .filter(Boolean);
}

export function namesText(arr) {
  return (Array.isArray(arr) ? arr : [])
    .map((x) => String(x || "").trim())
    .filter(Boolean)
    .join("\n");
}

export function splitMonthLengths(raw) {
  if (Array.isArray(raw)) return raw;
  if (typeof raw !== "string") return [];
  return raw.split(/\r?\n/g).map((x) => {
    const trimmed = x.trim();
    if (!trimmed) return null;
    const n = Number(trimmed);
    return Number.isFinite(n) ? n : null;
  });
}

export function monthLengthOverridesText(arr) {
  if (!Array.isArray(arr) || !arr.length) return "";
  return arr
    .map((v) =>
      v != null && Number.isFinite(Number(v)) && Number(v) >= 1
        ? String(Math.round(Number(v)))
        : "",
    )
    .join("\n");
}

export function clonePlain(v) {
  return JSON.parse(JSON.stringify(v));
}

export function todayIsoDate() {
  return new Date().toISOString().slice(0, 10);
}

export function normalizeIsoDate(raw) {
  const txt = String(raw || "").trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(txt)) return txt;
  return todayIsoDate();
}

export function normalizeAstronomySettings(raw) {
  const r = raw && typeof raw === "object" ? raw : {};
  return {
    enabled: !!r.enabled,
    seasons: hasOwn(r, "seasons") ? !!r.seasons : true,
    seasonBands: hasOwn(r, "seasonBands") ? !!r.seasonBands : true,
    eclipses: hasOwn(r, "eclipses") ? !!r.eclipses : true,
  };
}

export function normalizeIcsIncludes(raw) {
  const r = raw && typeof raw === "object" ? raw : {};
  return {
    holidays: hasOwn(r, "holidays") ? !!r.holidays : true,
    festivals: hasOwn(r, "festivals") ? !!r.festivals : true,
    markers: hasOwn(r, "markers") ? !!r.markers : true,
  };
}

export function normalizeWeekendRule(raw) {
  const value = String(raw || "").trim();
  return HOLIDAY_WEEKEND_RULES.some(([v]) => v === value) ? value : "none";
}

export function parseIntList(raw, min = 1, max = 1000000) {
  if (Array.isArray(raw)) {
    const seen = new Set();
    const out = [];
    for (const v of raw) {
      const n = clampI(v, min, max);
      if (!Number.isFinite(n)) continue;
      if (seen.has(n)) continue;
      seen.add(n);
      out.push(n);
    }
    return out.sort((a, b) => a - b);
  }
  const txt = String(raw || "").trim();
  if (!txt) return [];
  const seen = new Set();
  const out = [];
  for (const tok of txt.split(/[\s,;|]+/g)) {
    if (!tok) continue;
    const n = Number(tok);
    if (!Number.isFinite(n)) continue;
    const v = clampI(n, min, max);
    if (seen.has(v)) continue;
    seen.add(v);
    out.push(v);
  }
  return out.sort((a, b) => a - b);
}

export function normalizeWeekendDayIndexes(raw, daysPerWeek = 7) {
  const safeDaysPerWeek = Math.max(1, I(daysPerWeek, 7));
  const parsed = parseIntList(raw ?? [], 0, Math.max(0, safeDaysPerWeek - 1))
    .filter((idx) => idx >= 0 && idx < safeDaysPerWeek)
    .sort((a, b) => a - b);
  if (parsed.length) return parsed;
  if (safeDaysPerWeek === 1) return [0];
  if (safeDaysPerWeek === 2) return [1];
  return [Math.max(0, safeDaysPerWeek - 2), safeDaysPerWeek - 1];
}

export function intListText(arr) {
  return (Array.isArray(arr) ? arr : [])
    .map((n) => String(I(n, 0)))
    .filter(Boolean)
    .join(", ");
}

export function parseStringList(raw, { maxItems = 50 } = {}) {
  if (Array.isArray(raw)) {
    const out = [];
    const seen = new Set();
    for (const value of raw) {
      const txt = String(value || "").trim();
      if (!txt || seen.has(txt)) continue;
      seen.add(txt);
      out.push(txt);
      if (out.length >= maxItems) break;
    }
    return out;
  }
  const txt = String(raw || "").trim();
  if (!txt) return [];
  const out = [];
  const seen = new Set();
  for (const token of txt.split(/[\s,;|]+/g)) {
    const value = String(token || "").trim();
    if (!value || seen.has(value)) continue;
    seen.add(value);
    out.push(value);
    if (out.length >= maxItems) break;
  }
  return out;
}

export function normalizeHolidayCategory(value) {
  const key = String(value || "")
    .trim()
    .toLowerCase();
  return HOLIDAY_CATEGORY_SET.has(key) ? key : "civic";
}

export function normalizeHolidayColorTag(value) {
  const key = String(value || "")
    .trim()
    .toLowerCase();
  return HOLIDAY_COLOR_TAG_SET.has(key) ? key : "gold";
}

export function normalizeHolidayCategoryFilters(raw) {
  const source = raw && typeof raw === "object" ? raw : {};
  const out = {};
  for (const [value] of HOLIDAY_CATEGORIES) {
    out[value] = hasOwn(source, value) ? !!source[value] : true;
  }
  return out;
}

export function holidayCategoryLabel(value) {
  return HOLIDAY_CATEGORY_LABELS[normalizeHolidayCategory(value)] || "Civic";
}

export function holidayColorClass(value) {
  return `holiday-tag-${normalizeHolidayColorTag(value)}`;
}

export function holidayCategoryOptionsHtml() {
  return HOLIDAY_CATEGORIES.map(
    ([value, label]) => `<option value="${esc(value)}">${esc(label)}</option>`,
  ).join("");
}

export function holidayColorOptionsHtml() {
  return HOLIDAY_COLOR_TAGS.map(
    ([value, label]) => `<option value="${esc(value)}">${esc(label)}</option>`,
  ).join("");
}

export function holidayFilterControlsHtml() {
  return HOLIDAY_CATEGORIES.map(
    ([value, label]) =>
      `<label class="calendar-holiday-filter"><input type="checkbox" data-cal-holiday-filter="${esc(value)}" />${esc(label)}</label>`,
  ).join("");
}

export function normEraRules(rawList) {
  const list = Array.isArray(rawList) ? rawList : [];
  const out = list
    .map((raw, idx) => {
      const e = raw && typeof raw === "object" ? raw : {};
      return {
        id: String(e.id || `era-${idx + 1}`),
        name: String(e.name || "").trim(),
        startYear: Math.max(1, I(e.startYear ?? e.year ?? 1, 1)),
      };
    })
    .filter((e) => e.name)
    .sort((a, b) => a.startYear - b.startYear || a.name.localeCompare(b.name));
  return out;
}

export function formatPreCalendarYear(year, ui) {
  const safeYear = Math.max(1, I(year, 1));
  const startYear = Math.max(1, I(ui?.preCalendarStartYear ?? 1, 1));
  const postLabel = String(ui?.postEraLabel || "CE").trim() || "CE";
  const preLabel = String(ui?.preEraLabel || "BCE").trim() || "BCE";
  const useYearZero = !!ui?.preCalendarUseYearZero;
  const adjustedYear = safeYear + I(ui?.yearOffset ?? 0, 0);

  const delta = adjustedYear - startYear;
  if (delta >= 0) return `${delta + (useYearZero ? 0 : 1)} ${postLabel}`;
  return `${Math.abs(delta)} ${preLabel}`;
}

export function formatDisplayedYear(year, ui) {
  const safeYear = Math.max(1, I(year, 1));
  const displayYear = safeYear + I(ui?.yearOffset ?? 0, 0);
  const prefix = String(ui?.yearPrefix || "").trim();
  const suffix = String(ui?.yearSuffix || "").trim();
  const baseLabelCore = `${displayYear}`;
  const baseLabel =
    `${prefix ? `${prefix} ` : ""}${baseLabelCore}${suffix ? ` ${suffix}` : ""}`.trim();

  if (String(ui?.yearDisplayMode || "numeric") === "pre-calendar") {
    return formatPreCalendarYear(safeYear, ui);
  }

  if (String(ui?.yearDisplayMode || "numeric") !== "era") return baseLabel;
  const eras = normEraRules(ui?.eras);
  const matching = eras.filter((e) => e.startYear <= safeYear);
  const active = matching[matching.length - 1];
  if (!active) return baseLabel;
  const eraYear = safeYear - active.startYear + 1;
  if (!prefix && !suffix && I(ui?.yearOffset ?? 0, 0) === 0) {
    return `${active.name} ${eraYear}`;
  }
  return `${active.name} ${eraYear} (${baseLabel})`;
}

export function phaseClass(short) {
  return `phase-${String(short || "n").toLowerCase()}`;
}

export function moonColorClass(idx) {
  return MOON_COLORS[clampI(idx, 0, MOON_COLORS.length - 1)] || MOON_COLORS[0];
}

export function moonIcon(moonState, idx) {
  return `<span class="calendar-moon-icon ${phaseClass(moonState?.phase?.phaseShort)} ${moonColorClass(idx)}" aria-hidden="true"></span>`;
}

export function astroIconClass(markerKey) {
  return ASTRO_ICON_CLASS_BY_KEY[String(markerKey || "")] || "calendar-astro-icon--generic";
}

export function astroIcon(marker) {
  const moonSourceIndex = Number.isFinite(Number(marker?.sourceMoonIndex))
    ? clampI(Number(marker.sourceMoonIndex), 0, MOON_COLORS.length - 1)
    : null;
  const moonSourceDot =
    moonSourceIndex == null
      ? ""
      : `<span class="calendar-astro-source ${moonColorClass(moonSourceIndex)}" aria-hidden="true"></span>`;
  return `<span class="calendar-astro-marker" aria-hidden="true"><span class="calendar-astro-icon ${astroIconClass(marker?.key)}"></span>${moonSourceDot}</span>`;
}

export function astronomyMarkerAggregateKey(marker) {
  const key = String(marker?.key || "marker");
  const moonId = String(marker?.sourceMoonId || "").trim();
  return moonId ? `${key}::${moonId}` : key;
}

export function astronomyMarkerLabel(marker) {
  const base = String(marker?.name || "").trim() || "Astronomy marker";
  const moonName = String(marker?.sourceMoonName || marker?.sourceLabel || "").trim();
  if (moonName) return `${base} (${moonName})`;
  return base;
}

export function findById(list, id) {
  return (list || []).find((x) => String(x?.id) === String(id || "")) || null;
}

export function moonsForPlanet(moons, planetId) {
  return (moons || [])
    .filter((m) => String(m?.planetId || "") === String(planetId || ""))
    .sort(
      (a, b) => N(a?.inputs?.semiMajorAxisKm, Infinity) - N(b?.inputs?.semiMajorAxisKm, Infinity),
    );
}

export function uniqIds(arr) {
  const seen = new Set();
  const out = [];
  for (const v of arr || []) {
    const id = String(v || "").trim();
    if (!id || seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out;
}

export function normHolidayRule(raw, idx, monthsPerYear) {
  const h = raw && typeof raw === "object" ? raw : {};
  let attrs = { useDate: true, useWeekday: false, useMoonPhase: false };
  if (h.type === "nth_weekday") attrs = { useDate: false, useWeekday: true, useMoonPhase: false };
  if (h.type === "moon_phase") attrs = { useDate: false, useWeekday: false, useMoonPhase: true };
  if (h.attrs && typeof h.attrs === "object") {
    attrs = {
      useDate: !!h.attrs.useDate,
      useWeekday: !!h.attrs.useWeekday,
      useMoonPhase: !!h.attrs.useMoonPhase,
    };
  }
  const maxMonth = Math.max(0, I(monthsPerYear, 12) - 1);
  const relativeRaw = h.relative && typeof h.relative === "object" ? h.relative : {};
  const relativeType = HOLIDAY_RELATIVE_TYPES.some(
    ([value]) => value === String(relativeRaw.type || ""),
  )
    ? String(relativeRaw.type)
    : "none";
  const relativeEnabled = !!relativeRaw.enabled && relativeType !== "none";
  const relativeMoonPhase = PHASES.some(([value]) => value === String(relativeRaw.moonPhase || ""))
    ? String(relativeRaw.moonPhase)
    : "F";
  const relative = {
    enabled: relativeEnabled,
    type: relativeType,
    offsetDays: clampI(relativeRaw.offsetDays ?? relativeRaw.daysOffset ?? 0, -2000, 2000),
    moonSlot: clampI(relativeRaw.moonSlot ?? 0, 0, 3),
    moonId: String(relativeRaw.moonId || ""),
    moonPhase: relativeMoonPhase,
    markerKey: String(relativeRaw.markerKey || "").trim(),
    holidayId: String(relativeRaw.holidayId || "").trim(),
  };
  const fallbackAnchorType = relativeEnabled
    ? relativeType === "moon-phase"
      ? "moon-phase"
      : relativeType === "astronomy-marker"
        ? "astronomy-marker"
        : relativeType === "holiday"
          ? "holiday"
          : "fixed-date"
    : attrs.useWeekday && !attrs.useDate && !attrs.useMoonPhase
      ? "nth-weekday"
      : attrs.useMoonPhase && !attrs.useDate && !attrs.useWeekday
        ? "moon-phase"
        : "fixed-date";
  const anchorRaw = h.anchor && typeof h.anchor === "object" ? h.anchor : {};
  const anchorType = HOLIDAY_ANCHOR_TYPES.some(([value]) => value === String(anchorRaw.type || ""))
    ? String(anchorRaw.type)
    : fallbackAnchorType;
  const anchor = {
    type: anchorType,
    algorithmKey: HOLIDAY_ALGORITHMS.some(
      ([value]) => value === String(anchorRaw.algorithmKey || ""),
    )
      ? String(anchorRaw.algorithmKey)
      : "none",
    moonSlot: clampI(anchorRaw.moonSlot ?? h.moonSlot ?? relative.moonSlot ?? 0, 0, 3),
    moonId: String(anchorRaw.moonId ?? h.moonId ?? relative.moonId ?? ""),
    moonPhase: PHASES.some(([value]) => value === String(anchorRaw.moonPhase || ""))
      ? String(anchorRaw.moonPhase)
      : PHASES.some(([value]) => value === String(h.moonPhase || ""))
        ? String(h.moonPhase)
        : relativeMoonPhase,
    markerKey: String(anchorRaw.markerKey ?? relative.markerKey ?? "").trim(),
    holidayId: String(anchorRaw.holidayId ?? relative.holidayId ?? "").trim(),
  };
  const observanceRaw = h.observance && typeof h.observance === "object" ? h.observance : {};
  const observance = {
    weekendRule: HOLIDAY_WEEKEND_RULES.some(
      ([value]) => value === String(observanceRaw.weekendRule || ""),
    )
      ? String(observanceRaw.weekendRule)
      : "none",
    holidayConflictRule: HOLIDAY_CONFLICT_RULES.some(
      ([value]) => value === String(observanceRaw.holidayConflictRule || ""),
    )
      ? String(observanceRaw.holidayConflictRule)
      : String(h.mergeMode || "") === "override"
        ? "override"
        : "merge",
    maxShiftDays: clampI(observanceRaw.maxShiftDays ?? 7, 0, 180),
    stayInMonth: !!observanceRaw.stayInMonth,
  };
  const conflictScopeRaw =
    h.conflictScope && typeof h.conflictScope === "object" ? h.conflictScope : {};
  const conflictScope = {
    appliesAgainst: HOLIDAY_CONFLICT_SCOPES.some(
      ([value]) => value === String(conflictScopeRaw.appliesAgainst || ""),
    )
      ? String(conflictScopeRaw.appliesAgainst)
      : "all",
    categories: parseStringList(conflictScopeRaw.categories ?? []),
    holidayIds: parseStringList(conflictScopeRaw.holidayIds ?? []),
  };
  const offsetDays = clampI(h.offsetDays ?? relative.offsetDays ?? 0, -2000, 2000);
  if (!relative.enabled && !attrs.useDate && !attrs.useWeekday && !attrs.useMoonPhase) {
    attrs.useDate = true;
  }
  return {
    id: String(h.id || `holiday-${idx + 1}`),
    name: String(h.name || "").trim(),
    category: normalizeHolidayCategory(h.category || h.typeCategory || h.group),
    colorTag: normalizeHolidayColorTag(h.colorTag || h.colourTag || h.color || h.colour),
    recurrence: RECURRENCES.some(([v]) => v === h.recurrence) ? h.recurrence : "yearly",
    startMonth: clampI(h.startMonth ?? h.monthIndex ?? 0, 0, maxMonth),
    year: Math.max(1, I(h.year ?? h.startYear ?? 1, 1)),
    attrs,
    dayOfMonth: clampI(h.dayOfMonth ?? h.day ?? 1, 1, 400),
    durationDays: Math.max(1, I(h.durationDays ?? h.lengthDays ?? 1, 1)),
    priority: I(h.priority ?? 0, 0),
    mergeMode: HOLIDAY_RESOLVE_MODES.some(([v]) => v === String(h.mergeMode || ""))
      ? String(h.mergeMode)
      : "merge",
    exceptYears: parseIntList(h.exceptYears ?? h.skipYears ?? [], 1, 1000000),
    exceptMonths: parseIntList(h.exceptMonths ?? h.skipMonths ?? [], 1, 240),
    exceptDays: parseIntList(h.exceptDays ?? h.skipDays ?? [], 1, 500),
    weekday: clampI(h.weekday ?? h.dayOfWeek ?? 0, 0, 30),
    occurrence: OCCURRENCES.some(([v]) => v === String(h.occurrence))
      ? String(h.occurrence)
      : h.type === "nth_weekday"
        ? String(Math.max(1, Math.min(4, I(h.weekIndex, 0) + 1)))
        : "any",
    moonSlot: clampI(h.moonSlot ?? 0, 0, 3),
    moonId: String(h.moonId || ""),
    moonPhase: PHASES.some(([v]) => v === h.moonPhase) ? h.moonPhase : h.phase || "F",
    relative,
    anchor,
    offsetDays,
    observance,
    conflictScope,
  };
}

export function normHolidayRules(list, monthsPerYear) {
  return (Array.isArray(list) ? list : [])
    .map((h, idx) => normHolidayRule(h, idx, monthsPerYear))
    .filter((h) => h.name);
}

export function inferWeekendRuleFromHolidays(rawHolidays, monthsPerYear = 12) {
  const holidays = normHolidayRules(rawHolidays, Math.max(1, I(monthsPerYear, 12)));
  const hit = holidays.find(
    (holiday) => normalizeWeekendRule(holiday?.observance?.weekendRule) !== "none",
  );
  return normalizeWeekendRule(hit?.observance?.weekendRule);
}

export function normFestivalRule(raw, idx, monthsPerYear) {
  const f = raw && typeof raw === "object" ? raw : {};
  const maxMonth = Math.max(0, I(monthsPerYear, 12) - 1);
  return {
    id: String(f.id || `festival-${idx + 1}`),
    name: String(f.name || "").trim(),
    category: normalizeHolidayCategory(f.category || f.typeCategory || f.group),
    colorTag: normalizeHolidayColorTag(f.colorTag || f.colourTag || f.color || f.colour),
    recurrence: RECURRENCES.some(([v]) => v === f.recurrence) ? f.recurrence : "yearly",
    startMonth: clampI(f.startMonth ?? f.monthIndex ?? 0, 0, maxMonth),
    year: Math.max(1, I(f.year ?? f.startYear ?? 1, 1)),
    afterDay: clampI(f.afterDay ?? f.dayOfMonth ?? f.day ?? 0, 0, 500),
    durationDays: Math.max(1, I(f.durationDays ?? f.lengthDays ?? 1, 1)),
    outsideWeekFlow: !!(f.outsideWeekFlow ?? f.outsideWeek ?? f.intercalary),
    exceptYears: parseIntList(f.exceptYears ?? f.skipYears ?? [], 1, 1000000),
    exceptMonths: parseIntList(f.exceptMonths ?? f.skipMonths ?? [], 1, 240),
    exceptDays: parseIntList(f.exceptDays ?? f.skipDays ?? [], 1, 500),
  };
}

export function normFestivalRules(list, monthsPerYear) {
  return (Array.isArray(list) ? list : [])
    .map((f, idx) => normFestivalRule(f, idx, monthsPerYear))
    .filter((f) => f.name);
}

export function sanitizeCycleShort(value, fallback) {
  const raw = String(value ?? "")
    .trim()
    .toUpperCase();
  if (!raw) return fallback;
  return raw.slice(0, 3);
}

export function normWorkCycleRule(raw, idx) {
  const rule = raw && typeof raw === "object" ? raw : {};
  const mode = WORK_CYCLE_MODES.some(([value]) => value === String(rule.mode || ""))
    ? String(rule.mode)
    : "duty";
  const onDays = clampI(rule.onDays ?? 6, 1, 3650);
  const offDays = clampI(rule.offDays ?? 1, 1, 3650);
  const intervalDays = clampI(rule.intervalDays ?? 5, 1, 3650);
  return {
    id: String(rule.id || `cycle-${idx + 1}`),
    name: String(rule.name || "").trim(),
    mode,
    startAbsoluteDay: Math.max(0, I(rule.startAbsoluteDay ?? 0, 0)),
    onDays,
    offDays,
    intervalDays,
    activeLabel: String(rule.activeLabel || "Work").trim() || "Work",
    restLabel: String(rule.restLabel || "Rest").trim() || "Rest",
    intervalLabel: String(rule.intervalLabel || "Marker").trim() || "Marker",
    activeShort: sanitizeCycleShort(rule.activeShort, "W"),
    restShort: sanitizeCycleShort(rule.restShort, "R"),
    intervalShort: sanitizeCycleShort(rule.intervalShort, "M"),
  };
}

export function normWorkCycleRules(list) {
  return (Array.isArray(list) ? list : [])
    .map((rule, idx) => normWorkCycleRule(rule, idx))
    .filter((rule) => rule.name);
}

export function cycleRuleSummary(rule) {
  if (!rule) return "";
  if (rule.mode === "interval") {
    return `Every ${rule.intervalDays} day(s) from day ${rule.startAbsoluteDay} | ${rule.intervalLabel} (${rule.intervalShort})`;
  }
  return `${rule.onDays} on / ${rule.offDays} off from day ${rule.startAbsoluteDay} | ${rule.activeLabel} (${rule.activeShort}) / ${rule.restLabel} (${rule.restShort})`;
}

export function cycleKindClass(cycle) {
  if (!cycle) return "calendar-cycle-marker--interval";
  if (cycle.kind === "active") return "calendar-cycle-marker--active";
  if (cycle.kind === "rest") return "calendar-cycle-marker--rest";
  return "calendar-cycle-marker--interval";
}

export function cycleMarkerTip(cycle) {
  if (!cycle) return "Cycle marker";
  if (cycle.kind === "interval") {
    return `${cycle.ruleName}: ${cycle.label} (every ${cycle.intervalDays} days)`;
  }
  const dayInCycle = Math.max(1, I(cycle.dayInCycle, 1));
  const cycleLength = Math.max(1, I(cycle.cycleLength, 1));
  return `${cycle.ruleName}: ${cycle.label} (${dayInCycle}/${cycleLength})`;
}

export function cycleIcon(cycle) {
  const short = esc(
    String(cycle?.short || "C")
      .toUpperCase()
      .slice(0, 3),
  );
  return `<span class="calendar-cycle-marker ${cycleKindClass(cycle)}" data-tip="${esc(
    cycleMarkerTip(cycle),
  )}" aria-hidden="true">${short}</span>`;
}

export function evaluateWorkCyclesForDay(workCycles, absoluteDay) {
  const rules = Array.isArray(workCycles) ? workCycles : [];
  const safeDay = Math.max(0, I(absoluteDay, 0));
  const out = [];
  for (let index = 0; index < rules.length; index++) {
    const rule = rules[index];
    if (!rule?.name) continue;
    const startAbsoluteDay = Math.max(0, I(rule.startAbsoluteDay, 0));
    const dayOffset = safeDay - startAbsoluteDay;
    if (dayOffset < 0) continue;
    if (rule.mode === "interval") {
      const intervalDays = Math.max(1, I(rule.intervalDays, 1));
      if (mod(dayOffset, intervalDays) !== 0) continue;
      out.push({
        ruleId: String(rule.id || ""),
        ruleName: String(rule.name || ""),
        ruleIndex: index,
        kind: "interval",
        label: String(rule.intervalLabel || "Marker"),
        short: sanitizeCycleShort(rule.intervalShort, "M"),
        intervalDays,
      });
      continue;
    }
    const onDays = Math.max(1, I(rule.onDays, 1));
    const offDays = Math.max(1, I(rule.offDays, 1));
    const span = onDays + offDays;
    const cyclePosition = mod(dayOffset, span);
    const isActive = cyclePosition < onDays;
    out.push({
      ruleId: String(rule.id || ""),
      ruleName: String(rule.name || ""),
      ruleIndex: index,
      kind: isActive ? "active" : "rest",
      label: isActive ? String(rule.activeLabel || "Work") : String(rule.restLabel || "Rest"),
      short: isActive
        ? sanitizeCycleShort(rule.activeShort, "W")
        : sanitizeCycleShort(rule.restShort, "R"),
      dayInCycle: cyclePosition + 1,
      cycleLength: span,
    });
  }
  return out;
}

export function recursInMonth(holiday, year, monthIndex, monthsPerYear) {
  if (holiday.recurrence === "one-off") {
    return (
      Math.max(1, I(year, 1)) === Math.max(1, I(holiday.year, 1)) &&
      clampI(monthIndex, 0, monthsPerYear - 1) === clampI(holiday.startMonth, 0, monthsPerYear - 1)
    );
  }
  const now =
    (Math.max(1, I(year, 1)) - 1) * monthsPerYear + clampI(monthIndex, 0, monthsPerYear - 1);
  const start = clampI(holiday.startMonth, 0, monthsPerYear - 1);
  if (now < start) return false;
  if (holiday.recurrence === "weekly") return true;
  const interval = RECUR_MONTHS[holiday.recurrence] || 12;
  return mod(now - start, interval) === 0;
}

export function weekdayOccurrence(
  dayNumber,
  monthLength,
  monthStartWeekday,
  targetWeekday,
  daysPerWeek,
) {
  let nth = 0;
  for (let d = 1; d <= dayNumber; d++) {
    if (mod(monthStartWeekday + d - 1, daysPerWeek) === targetWeekday) nth += 1;
  }
  let isLast = true;
  for (let d = dayNumber + 1; d <= monthLength; d++) {
    if (mod(monthStartWeekday + d - 1, daysPerWeek) === targetWeekday) {
      isLast = false;
      break;
    }
  }
  return { nth, isLast };
}

export function toLinearMonthOrdinal(year, monthIndex, monthsPerYear) {
  const y = Math.max(1, I(year, 1));
  const m = clampI(monthIndex, 0, Math.max(0, I(monthsPerYear, 12) - 1));
  return (y - 1) * Math.max(1, I(monthsPerYear, 12)) + m;
}

export function fromLinearMonthOrdinal(linearMonth, monthsPerYear) {
  const mpy = Math.max(1, I(monthsPerYear, 12));
  const value = Math.max(0, I(linearMonth, 0));
  return {
    year: Math.floor(value / mpy) + 1,
    monthIndex: mod(value, mpy),
  };
}

export function uniqueSortedNumbers(values) {
  const out = [];
  const seen = new Set();
  for (const value of values || []) {
    const n = I(value, Number.NaN);
    if (!Number.isFinite(n)) continue;
    if (seen.has(n)) continue;
    seen.add(n);
    out.push(n);
  }
  return out.sort((a, b) => a - b);
}

export function pickMoonStateForHoliday(holiday, moonStates, { relative = false } = {}) {
  const states = Array.isArray(moonStates) ? moonStates : [];
  if (!states.length) return null;
  if (relative) {
    const rel = holiday?.relative && typeof holiday.relative === "object" ? holiday.relative : null;
    if (rel?.moonId) {
      const found = states.find((moonState) => String(moonState?.id || "") === String(rel.moonId));
      if (found) return found;
    }
    return states[clampI(rel?.moonSlot ?? 0, 0, states.length - 1)] || null;
  }
  if (holiday?.moonId) {
    const found = states.find(
      (moonState) => String(moonState?.id || "") === String(holiday.moonId),
    );
    if (found) return found;
  }
  return states[clampI(holiday?.moonSlot ?? 0, 0, states.length - 1)] || null;
}

export function holidayRelativeKeyLabel(relative) {
  const rel = relative && typeof relative === "object" ? relative : {};
  if (!rel.enabled || rel.type === "none") return "";
  if (rel.type === "moon-phase") return "moon phase";
  if (rel.type === "astronomy-marker") {
    return (
      HOLIDAY_RELATIVE_MARKERS.find(([value]) => value === String(rel.markerKey || ""))?.[1] ||
      "astronomy marker"
    );
  }
  if (rel.type === "holiday") return "another holiday";
  return "relative trigger";
}

export function analyzeHolidayRelativeIssues(holidays) {
  const byId = new Map((holidays || []).map((holiday) => [String(holiday.id), holiday]));
  const issueById = new Map();
  const edges = new Map();

  for (const holiday of holidays || []) {
    const id = String(holiday.id || "");
    if (!id) continue;

    const anchor = holiday?.anchor && typeof holiday.anchor === "object" ? holiday.anchor : null;
    const anchorType = String(anchor?.type || "");
    if (anchorType && !HOLIDAY_ANCHOR_TYPES.some(([value]) => value === anchorType)) {
      issueById.set(id, "Invalid holiday anchor type.");
      continue;
    }

    if (anchorType === "moon-phase") {
      if (!PHASES.some(([value]) => value === String(anchor?.moonPhase || ""))) {
        issueById.set(id, "Anchor moon-phase is missing a valid phase.");
      }
    } else if (anchorType === "astronomy-marker") {
      if (!HOLIDAY_RELATIVE_MARKERS.some(([value]) => value === String(anchor?.markerKey || ""))) {
        issueById.set(id, "Anchor astronomy marker is missing or invalid.");
      }
    } else if (anchorType === "algorithmic") {
      const algorithmKey = String(anchor?.algorithmKey || "");
      if (
        algorithmKey === "none" ||
        !HOLIDAY_ALGORITHMS.some(([value]) => value === algorithmKey)
      ) {
        issueById.set(id, "Algorithmic anchor is missing a valid algorithm.");
      }
    } else if (anchorType === "holiday") {
      const depId = String(anchor?.holidayId || "").trim();
      if (!depId) {
        issueById.set(id, "Anchor holiday is missing a linked holiday.");
      } else if (depId === id) {
        issueById.set(id, "Anchor holiday cannot reference itself.");
      } else if (!byId.has(depId)) {
        issueById.set(id, "Anchor holiday references a missing holiday.");
      } else {
        if (!edges.has(id)) edges.set(id, []);
        edges.get(id).push(depId);
      }
    }

    const rel = holiday?.relative && typeof holiday.relative === "object" ? holiday.relative : null;
    if (!rel?.enabled || rel.type === "none") continue;
    if (!HOLIDAY_RELATIVE_TYPES.some(([value]) => value === String(rel.type || ""))) {
      issueById.set(id, "Invalid relative trigger type.");
      continue;
    }
    if (rel.type === "moon-phase") {
      if (!PHASES.some(([value]) => value === String(rel.moonPhase || ""))) {
        issueById.set(id, "Relative moon-phase trigger is missing a valid phase.");
      }
      continue;
    }
    if (rel.type === "astronomy-marker") {
      if (!HOLIDAY_RELATIVE_MARKERS.some(([value]) => value === String(rel.markerKey || ""))) {
        issueById.set(id, "Relative astronomy trigger is missing a valid marker.");
      }
      continue;
    }
    if (rel.type === "holiday") {
      const depId = String(rel.holidayId || "").trim();
      if (!depId) {
        issueById.set(id, "Relative holiday trigger is missing a linked holiday.");
        continue;
      }
      if (depId === id) {
        issueById.set(id, "Relative holiday trigger cannot reference itself.");
        continue;
      }
      if (!byId.has(depId)) {
        issueById.set(id, "Relative holiday trigger references a missing holiday.");
        continue;
      }
      if (!edges.has(id)) edges.set(id, []);
      edges.get(id).push(depId);
    }
  }

  const visitState = new Map();
  const path = [];
  const markCycle = (startId) => {
    const startIndex = path.indexOf(startId);
    const cycleIds = startIndex >= 0 ? path.slice(startIndex) : [startId];
    for (const id of cycleIds) {
      issueById.set(id, "Circular relative/anchor dependency detected.");
    }
  };

  const dfs = (id) => {
    const state = visitState.get(id) || 0;
    if (state === 1) {
      markCycle(id);
      return;
    }
    if (state === 2) return;
    visitState.set(id, 1);
    path.push(id);
    for (const depId of edges.get(id) || []) {
      dfs(depId);
    }
    path.pop();
    visitState.set(id, 2);
  };

  for (const id of edges.keys()) {
    dfs(id);
  }

  return issueById;
}

export function createCalendarStateStoreBindings({
  getSelectedMoon = () => null,
  getSelectedPlanet = () => null,
  getStarOverrides = () => ({}),
  listMoons = () => [],
  listPlanets = () => [],
  updateWorld = () => {},
} = {}) {
  function derivePlanetPeriodDays(world, planet) {
    if (!planet?.inputs) return 365.2422;
    const sov = getStarOverrides(world?.star);
    const m = calcPlanetExact({
      starMassMsol: N(world?.star?.massMsol, 1),
      starAgeGyr: N(world?.star?.ageGyr, 4.5),
      starRadiusRsolOverride: sov.r,
      starLuminosityLsolOverride: sov.l,
      starTempKOverride: sov.t,
      starEvolutionMode: sov.ev,
      planet: planet.inputs,
    });
    return Math.max(0.1, N(m?.derived?.orbitalPeriodEarthDays, 365.2422));
  }

  function deriveMoonSynodicDays(world, planet, moon) {
    if (!planet?.inputs || !moon?.inputs) return 29.5306;
    const sovM = getStarOverrides(world?.star);
    const m = calcMoon({
      starMassMsol: N(world?.star?.massMsol, 1),
      starAgeGyr: N(world?.star?.ageGyr, 4.5),
      starRadiusRsolOverride: sovM.r,
      starLuminosityLsolOverride: sovM.l,
      starTempKOverride: sovM.t,
      starEvolutionMode: sovM.ev,
      planet: planet.inputs,
      moon: moon.inputs,
    });
    return Math.max(0.1, N(m?.orbit?.orbitalPeriodSynodicDays, 29.5306));
  }

  function defaultState(world) {
    const planets = listPlanets(world);
    const moons = listMoons(world);
    const p = getSelectedPlanet(world) || planets[0] || null;
    const pm = moonsForPlanet(moons, p?.id);
    const selMoon = getSelectedMoon(world);
    const primaryMoonId = pm.find((m) => m.id === selMoon?.id)?.id || pm[0]?.id || "";
    return {
      inputs: {
        sourcePlanetId: p?.id || "",
        primaryMoonId,
        extraMoonIds: ["", "", ""],
        monthsPerYear: null,
        daysPerMonth: null,
        daysPerWeek: null,
      },
      ui: {
        calendarName: "Calendar",
        basis: "lunisolar",
        year: 1,
        monthIndex: 0,
        selectedDay: 1,
        startDayOfYear: 0,
        weekStartsOn: 0,
        moonEpochOffsetDays: 0,
        dayNames: [],
        weekNames: [],
        monthNames: [],
        monthLengthOverridesEnabled: false,
        monthLengthOverrides: [],
        yearDisplayMode: "numeric",
        yearOffset: 0,
        yearPrefix: "",
        yearSuffix: "",
        preCalendarStartYear: 1,
        postEraLabel: "CE",
        preEraLabel: "BCE",
        preCalendarUseYearZero: false,
        eras: [],
        astronomy: {
          enabled: false,
          seasons: true,
          seasonBands: true,
          eclipses: true,
        },
        exportAnchorDate: todayIsoDate(),
        icsIncludes: {
          holidays: true,
          festivals: true,
          markers: true,
        },
        leapRules: [],
        holidays: [],
        holidayAdvanced: false,
        festivalRules: [],
        holidayCategoryFilters: normalizeHolidayCategoryFilters({}),
        workWeekendRule: "none",
        weekendDayIndexes: [5, 6],
        workCycles: [],
        jumpAbsoluteDay: 0,
        jumpYear: 1,
        jumpMonthIndex: 0,
        derivedRoundEnabled: false,
        derivedDecimalPlaces: 6,
        jumpDayOfMonth: 1,
        collapsedSections: {
          designer: true,
          data: true,
          output: true,
          special: true,
          festival: true,
          leap: true,
          cycles: true,
        },
        drawerOpen: true,
        drawerSection: "structure",
        rulesTab: "holidays",
      },
    };
  }

  function normalizeSingleProfile(world, rawProfile) {
    const d = defaultState(world);
    const raw = rawProfile && typeof rawProfile === "object" ? rawProfile : {};
    const ri = raw.inputs && typeof raw.inputs === "object" ? raw.inputs : raw;
    const ru = raw.ui && typeof raw.ui === "object" ? raw.ui : raw;
    const profile = {
      inputs: {
        ...d.inputs,
        sourcePlanetId: String(ri.sourcePlanetId || d.inputs.sourcePlanetId || ""),
        primaryMoonId: String(ri.primaryMoonId || ri.sourceMoonId || d.inputs.primaryMoonId || ""),
        extraMoonIds: uniqIds(
          ri.extraMoonIds || ri.additionalMoonIds || d.inputs.extraMoonIds,
        ).slice(0, 3),
        monthsPerYear: ri.monthsPerYear == null ? null : clampI(ri.monthsPerYear, 1, 240),
        daysPerMonth: ri.daysPerMonth == null ? null : clampI(ri.daysPerMonth, 1, 500),
        daysPerWeek: ri.daysPerWeek == null ? null : clampI(ri.daysPerWeek, 1, 30),
      },
      ui: {
        ...d.ui,
        calendarName: String(ru.calendarName || d.ui.calendarName),
        basis: ["solar", "lunar", "lunisolar"].includes(ru.basis) ? ru.basis : d.ui.basis,
        year: Math.max(1, clampI(ru.year ?? 1, 1, 1000000)),
        monthIndex: Math.max(0, clampI(ru.monthIndex ?? 0, 0, 1000)),
        selectedDay: Math.max(1, clampI(ru.selectedDay ?? 1, 1, 1000)),
        startDayOfYear: Math.max(0, clampI(ru.startDayOfYear ?? 0, 0, 1000)),
        weekStartsOn: Math.max(0, clampI(ru.weekStartsOn ?? 0, 0, 1000)),
        moonEpochOffsetDays: N(ru.moonEpochOffsetDays, 0),
        dayNames: splitNames(ru.dayNames),
        weekNames: splitNames(ru.weekNames),
        monthNames: splitNames(ru.monthNames),
        monthLengthOverridesEnabled: !!(
          ru.monthLengthOverridesEnabled ?? d.ui.monthLengthOverridesEnabled
        ),
        monthLengthOverrides: splitMonthLengths(ru.monthLengthOverrides),
        yearDisplayMode: ["numeric", "era", "pre-calendar"].includes(
          String(ru.yearDisplayMode || ""),
        )
          ? String(ru.yearDisplayMode)
          : d.ui.yearDisplayMode,
        yearOffset: I(ru.yearOffset ?? d.ui.yearOffset, 0),
        yearPrefix: String((ru.yearPrefix ?? d.ui.yearPrefix) || ""),
        yearSuffix: String((ru.yearSuffix ?? d.ui.yearSuffix) || ""),
        preCalendarStartYear: Math.max(
          1,
          I(ru.preCalendarStartYear ?? d.ui.preCalendarStartYear, 1),
        ),
        postEraLabel: String((ru.postEraLabel ?? d.ui.postEraLabel) || "CE"),
        preEraLabel: String((ru.preEraLabel ?? d.ui.preEraLabel) || "BCE"),
        preCalendarUseYearZero: !!(ru.preCalendarUseYearZero ?? d.ui.preCalendarUseYearZero),
        eras: normEraRules(ru.eras),
        astronomy: normalizeAstronomySettings(ru.astronomy),
        exportAnchorDate: normalizeIsoDate(ru.exportAnchorDate),
        icsIncludes: normalizeIcsIncludes(ru.icsIncludes),
        leapRules: Array.isArray(ru.leapRules) ? ru.leapRules : [],
        holidays: Array.isArray(ru.holidays)
          ? ru.holidays
          : Array.isArray(ru.specialDays)
            ? ru.specialDays
            : [],
        holidayAdvanced: !!(ru.holidayAdvanced ?? d.ui.holidayAdvanced),
        festivalRules: Array.isArray(ru.festivalRules)
          ? ru.festivalRules
          : Array.isArray(ru.intercalaryDays)
            ? ru.intercalaryDays
            : [],
        workWeekendRule: normalizeWeekendRule(
          ru.workWeekendRule ??
            inferWeekendRuleFromHolidays(
              Array.isArray(ru.holidays)
                ? ru.holidays
                : Array.isArray(ru.specialDays)
                  ? ru.specialDays
                  : [],
              ri.monthsPerYear ?? d.inputs.monthsPerYear ?? 12,
            ),
        ),
        weekendDayIndexes: normalizeWeekendDayIndexes(
          ru.weekendDayIndexes ?? ru.weekendDays ?? d.ui.weekendDayIndexes,
          7,
        ),
        workCycles: Array.isArray(ru.workCycles) ? ru.workCycles : [],
        holidayCategoryFilters: normalizeHolidayCategoryFilters(ru.holidayCategoryFilters),
        jumpAbsoluteDay: Math.max(0, I(ru.jumpAbsoluteDay ?? 0, 0)),
        jumpYear: Math.max(1, I(ru.jumpYear ?? 1, 1)),
        jumpMonthIndex: Math.max(0, I(ru.jumpMonthIndex ?? 0, 0)),
        derivedRoundEnabled: !!(ru.derivedRoundEnabled ?? d.ui.derivedRoundEnabled),
        derivedDecimalPlaces: clampI(ru.derivedDecimalPlaces ?? d.ui.derivedDecimalPlaces, 0, 6),
        jumpDayOfMonth: Math.max(1, I(ru.jumpDayOfMonth ?? 1, 1)),
        collapsedSections: {
          designer:
            ru?.collapsedSections && hasOwn(ru.collapsedSections, "designer")
              ? !!ru.collapsedSections.designer
              : true,
          data:
            ru?.collapsedSections && hasOwn(ru.collapsedSections, "data")
              ? !!ru.collapsedSections.data
              : true,
          output:
            ru?.collapsedSections && hasOwn(ru.collapsedSections, "output")
              ? !!ru.collapsedSections.output
              : true,
          special:
            ru?.collapsedSections && hasOwn(ru.collapsedSections, "special")
              ? !!ru.collapsedSections.special
              : true,
          festival:
            ru?.collapsedSections && hasOwn(ru.collapsedSections, "festival")
              ? !!ru.collapsedSections.festival
              : true,
          leap:
            ru?.collapsedSections && hasOwn(ru.collapsedSections, "leap")
              ? !!ru.collapsedSections.leap
              : true,
          cycles:
            ru?.collapsedSections && hasOwn(ru.collapsedSections, "cycles")
              ? !!ru.collapsedSections.cycles
              : true,
        },
        drawerOpen: !!(ru.drawerOpen ?? d.ui.drawerOpen),
        drawerSection: ["structure", "identity", "rules", "output"].includes(ru.drawerSection)
          ? ru.drawerSection
          : d.ui.drawerSection,
        rulesTab: ["holidays", "festivals", "leap", "cycles"].includes(ru.rulesTab)
          ? ru.rulesTab
          : d.ui.rulesTab,
      },
    };
    while (profile.inputs.extraMoonIds.length < 3) profile.inputs.extraMoonIds.push("");
    return profile;
  }

  function readState(world) {
    const raw = world?.calendar && typeof world.calendar === "object" ? world.calendar : {};
    const rawProfiles = Array.isArray(raw.profiles) ? raw.profiles : [];

    if (rawProfiles.length) {
      const ids = new Set();
      const profiles = rawProfiles
        .map((entry, idx) => {
          const normalized = normalizeSingleProfile(world, entry);
          let id = String(entry?.id || `cal-${idx + 1}`).trim() || `cal-${idx + 1}`;
          while (ids.has(id)) id = `${id}-${idx + 1}`;
          ids.add(id);
          const name =
            String(entry?.name || normalized.ui.calendarName || `Calendar ${idx + 1}`).trim() ||
            `Calendar ${idx + 1}`;
          normalized.ui.calendarName = String(normalized.ui.calendarName || name);
          return { id, name, ...normalized };
        })
        .filter((p) => p.id);
      if (!profiles.length) {
        const fallback = normalizeSingleProfile(world, {});
        fallback.ui.calendarName = "Civil Calendar";
        return {
          ...fallback,
          profileId: "cal-1",
          profileName: "Civil Calendar",
          profiles: [{ id: "cal-1", name: "Civil Calendar" }],
          _allProfiles: [{ id: "cal-1", name: "Civil Calendar", ...fallback }],
        };
      }
      const activeId = String(raw.activeProfileId || profiles[0].id);
      const active = profiles.find((p) => p.id === activeId) || profiles[0];
      return {
        ...active,
        profileId: active.id,
        profileName: active.name,
        profiles: profiles.map((p) => ({ id: p.id, name: p.name })),
        _allProfiles: profiles,
      };
    }

    const legacy = normalizeSingleProfile(world, raw);
    const legacyId = "cal-1";
    const legacyName =
      String(legacy.ui.calendarName || "Civil Calendar").trim() || "Civil Calendar";
    legacy.ui.calendarName = legacyName;
    return {
      ...legacy,
      profileId: legacyId,
      profileName: legacyName,
      profiles: [{ id: legacyId, name: legacyName }],
      _allProfiles: [{ id: legacyId, name: legacyName, ...legacy }],
    };
  }

  function persistState(state) {
    if (Array.isArray(state?._allProfiles) && state._allProfiles.length) {
      const activeId = String(state.profileId || state._allProfiles[0]?.id || "cal-1");
      const activeName =
        String(state.ui?.calendarName || state.profileName || "Calendar").trim() || "Calendar";
      const snapshot = {
        id: activeId,
        name: activeName,
        inputs: clonePlain(state.inputs),
        ui: clonePlain(state.ui),
      };
      const profiles = (state._allProfiles || [])
        .map((p, idx) => {
          const id = String(p?.id || `cal-${idx + 1}`).trim() || `cal-${idx + 1}`;
          const name =
            String(p?.name || p?.ui?.calendarName || `Calendar ${idx + 1}`).trim() ||
            `Calendar ${idx + 1}`;
          return {
            id,
            name,
            inputs: clonePlain(p?.inputs || {}),
            ui: clonePlain(p?.ui || {}),
          };
        })
        .filter((p) => p.id);
      const idx = profiles.findIndex((p) => p.id === activeId);
      if (idx >= 0) profiles[idx] = snapshot;
      else profiles.push(snapshot);
      state._allProfiles = profiles;
      state.profiles = profiles.map((p) => ({ id: p.id, name: p.name }));
      state.profileName = activeName;
      updateWorld({ calendar: { activeProfileId: activeId, profiles } });
      return;
    }
    updateWorld({ calendar: { inputs: { ...state.inputs }, ui: { ...state.ui } } });
  }

  return {
    defaultState,
    deriveMoonSynodicDays,
    derivePlanetPeriodDays,
    normalizeSingleProfile,
    persistState,
    readState,
  };
}
