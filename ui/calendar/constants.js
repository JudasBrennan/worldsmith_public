// SPDX-License-Identifier: MPL-2.0
export const CALENDAR_PHASES = [
  ["N", "New Moon"],
  ["WC", "Waxing Crescent"],
  ["1Q", "First Quarter"],
  ["WG", "Waxing Gibbous"],
  ["F", "Full Moon"],
  ["NG", "Waning Gibbous"],
  ["3Q", "Last Quarter"],
  ["NC", "Waning Crescent"],
];

export const HOLIDAY_RESOLVE_MODES = [
  ["merge", "Merge"],
  ["override", "Override"],
];

export const RECURRENCES = [
  ["one-off", "One-off"],
  ["weekly", "Weekly"],
  ["monthly", "Monthly"],
  ["bi-monthly", "Bi-monthly"],
  ["quarterly", "Quarterly"],
  ["6-monthly", "6-monthly"],
  ["yearly", "Yearly"],
];

export const RECUR_MONTHS = {
  monthly: 1,
  "bi-monthly": 2,
  quarterly: 3,
  "6-monthly": 6,
  yearly: 12,
};

export const HOLIDAY_RELATIVE_TYPES = [
  ["none", "None"],
  ["moon-phase", "Moon phase"],
  ["astronomy-marker", "Astronomy marker"],
  ["holiday", "Another holiday"],
];

export const HOLIDAY_ANCHOR_TYPES = [
  ["fixed-date", "Fixed date"],
  ["nth-weekday", "Nth weekday"],
  ["moon-phase", "Moon phase"],
  ["astronomy-marker", "Astronomy marker"],
  ["holiday", "Another holiday"],
  ["algorithmic", "Algorithmic"],
];

export const HOLIDAY_ALGORITHMS = [
  ["none", "None"],
  ["gregorian-easter-western", "Gregorian Easter (Western)"],
];

export const HOLIDAY_WEEKEND_RULES = [
  ["none", "No shift"],
  ["next-monday", "Shift to next Monday"],
  ["nearest-weekday", "Shift to nearest weekday"],
  ["next-weekday", "Shift to next weekday"],
  ["previous-weekday", "Shift to previous weekday"],
];

export const HOLIDAY_CONFLICT_RULES = [
  ["merge", "Merge labels"],
  ["override", "Override lower priority"],
  ["shift-forward", "Shift forward"],
  ["shift-backward", "Shift backward"],
  ["next-weekday", "Shift to next weekday"],
];

export const HOLIDAY_CONFLICT_SCOPES = [
  ["all", "All holidays"],
  ["category", "Same category"],
  ["ids", "Specific holidays"],
];

export const WORK_CYCLE_MODES = [
  ["duty", "Duty cycle (on/off)"],
  ["interval", "Interval marker (every N days)"],
];

export const HOLIDAY_RELATIVE_MARKERS = [
  ["vernal-equinox", "Vernal Equinox"],
  ["summer-solstice", "Summer Solstice"],
  ["autumn-equinox", "Autumn Equinox"],
  ["winter-solstice", "Winter Solstice"],
  ["solar-eclipse-window", "Solar Eclipse Window"],
  ["lunar-eclipse-window", "Lunar Eclipse Window"],
];

export const SEASON_MARKER_DEFS = [
  { key: "vernal-equinox", name: "Vernal Equinox", short: "VE", fraction: 0 },
  { key: "summer-solstice", name: "Summer Solstice", short: "SS", fraction: 0.25 },
  { key: "autumn-equinox", name: "Autumn Equinox", short: "AE", fraction: 0.5 },
  { key: "winter-solstice", name: "Winter Solstice", short: "WS", fraction: 0.75 },
];

export const HOLIDAY_SCAN_MONTH_RADIUS = 24;

export const OCCURRENCES = [
  ["any", "Any week"],
  ["1", "1st"],
  ["2", "2nd"],
  ["3", "3rd"],
  ["4", "4th"],
  ["last", "Last"],
];

export const HOLIDAY_CATEGORIES = [
  ["civic", "Civic"],
  ["religious", "Religious"],
  ["regional", "Regional"],
  ["market", "Market"],
  ["observance", "Observance"],
  ["custom", "Custom"],
];

export const HOLIDAY_COLOR_TAGS = [
  ["gold", "Gold"],
  ["azure", "Azure"],
  ["emerald", "Emerald"],
  ["violet", "Violet"],
  ["rose", "Rose"],
  ["slate", "Slate"],
];

export const HOLIDAY_CATEGORY_SET = new Set(HOLIDAY_CATEGORIES.map(([value]) => value));
export const HOLIDAY_COLOR_TAG_SET = new Set(HOLIDAY_COLOR_TAGS.map(([value]) => value));
export const HOLIDAY_CATEGORY_LABELS = Object.fromEntries(HOLIDAY_CATEGORIES);
export const MOON_COLORS = ["moon-c0", "moon-c1", "moon-c2", "moon-c3"];

export const ASTRO_ICON_CLASS_BY_KEY = Object.freeze({
  "vernal-equinox": "calendar-astro-icon--vernal-equinox",
  "summer-solstice": "calendar-astro-icon--summer-solstice",
  "autumn-equinox": "calendar-astro-icon--autumn-equinox",
  "winter-solstice": "calendar-astro-icon--winter-solstice",
  "solar-eclipse-window": "calendar-astro-icon--solar-eclipse-window",
  "lunar-eclipse-window": "calendar-astro-icon--lunar-eclipse-window",
});

export const CALENDAR_COLLAPSIBLE_PANELS = [
  { key: "designer", title: "Calendar Designer" },
  { key: "data", title: "Calendar Data" },
  { key: "output", title: "Output & Utility" },
  { key: "special", title: "Special Days" },
  { key: "festival", title: "Festival Days" },
  { key: "leap", title: "Leap Years" },
  { key: "cycles", title: "Work/Rest Cycles" },
];

export const CALENDAR_TUTORIAL_STEPS = [
  {
    title: "Getting Started",
    body:
      "The Calendar page turns your planet and moon data into a working calendar. " +
      "Use the settings drawer on the left to configure structure, identity, rules, " +
      "and output. The month view on the right updates live as you make changes.",
  },
  {
    title: "Choose a Source Planet and Moon",
    body:
      "Open the Structure tab in the drawer. Select a source planet to set the " +
      "year length, then pick a primary moon to drive lunar cycles. You can add " +
      "up to three extra moons for multi-moon phase displays.",
  },
  {
    title: "Calendar Basis",
    body:
      "Choose Solar, Lunar, or Lunisolar basis in the Structure tab. Solar ties " +
      "months to the orbital year. Lunar ties them to moon cycles. Lunisolar " +
      "combines both, adjusting months to stay in sync with seasons.",
  },
  {
    title: "Month, Day, and Week Structure",
    body:
      "In the Structure tab, adjust months per year, days per month, and days per " +
      "week. By default these are derived from orbital data. Override any slider " +
      "for a custom calendar. Enable Month lengths to set irregular day counts " +
      "per month (like Earth's 31/28/31/30 pattern). The structure readout shows " +
      "the resulting year length.",
  },
  {
    title: "Naming Days, Months, and Eras",
    body:
      "Switch to the Identity tab to name your weekdays and months (one per line). " +
      "Set a year display mode: plain numeric, named eras, or pre/post-calendar " +
      "eras like BCE/CE. Add era rules to mark ages of your world's history.",
  },
  {
    title: "Leap Rules",
    body:
      "In the Rules tab, open the Leap Years section. Add rules that insert or " +
      "remove days on cycle years. Use the Suggest button to auto-generate rules " +
      "that minimize calendar drift from the true orbital year.",
  },
  {
    title: "Holidays and Festivals",
    body:
      "Still in the Rules tab, add holidays by date, weekday, or moon phase. " +
      "Holidays can recur weekly, monthly, or yearly. Festivals are multi-day " +
      "events. Use categories and colour tags to organise them on the grid.",
  },
  {
    title: "Exporting Your Calendar",
    body:
      "Open the Output tab in the drawer. Export a single month as PDF, download " +
      "an ICS file for real calendar apps, or use JSON import/export to save and " +
      "share your full calendar configuration.",
  },
];
