// SPDX-License-Identifier: MPL-2.0
// ──────────────────────────────────────────────────
// Realmspace preset — Forgotten Realms / Spelljammer
// ──────────────────────────────────────────────────
// Sources: SJR2 Realmspace, Forgotten Realms Wiki.
// Orbital distances normalised so Toril ≈ 1 AU.
// Many values are best-fit estimates for a fantasy system.

const HARPTOS_DAY_NAMES = [
  "First-day",
  "Second-day",
  "Third-day",
  "Fourth-day",
  "Fifth-day",
  "Sixth-day",
  "Seventh-day",
  "Eighth-day",
  "Ninth-day",
  "Tenth-day",
];

const HARPTOS_MONTH_NAMES = [
  "Hammer",
  "Alturiak",
  "Ches",
  "Tarsakh",
  "Mirtul",
  "Kythorn",
  "Flamerule",
  "Eleasis",
  "Eleint",
  "Marpenoth",
  "Uktar",
  "Nightal",
];

// Calendar of Harptos: 12 × 30 = 360 base days.
// The engine gives 365/12 ≈ 30.42 days per month by default,
// so each month needs a −0 or −1 shape rule to land on exactly 30,
// then the five intercalary festival days are added back via leap rules.
// With 12 months × 30.42 ≈ 365.0 base days, we subtract ~5 total
// and re-add them as the five annual festival days.
//
// Strategy: trim the fractional day from each month (−1 day to 5 months
// to bring total from ~365 to 360), then add +1 day to 5 specific months
// for the intercalary festivals that sit between those months:
//   Midwinter        → end of Hammer   (month 0, +1)
//   Greengrass       → end of Tarsakh  (month 3, +1)
//   Midsummer        → end of Flamerule(month 6, +1)
//   Highharvestide   → end of Eleint   (month 8, +1)
//   Feast of the Moon→ end of Uktar    (month 10, +1)
//
// Shieldmeet: every 4 years, +1 day after Midsummer (month 6).

const HARPTOS_LEAP_RULES = [
  // --- Month-shape rules: bring 30.42-day months down to 30 ---
  // Months 1,2,4,5,7,9,11 each lose a fraction; net effect ≈ −5 days
  {
    id: "leap-harptos-shape-alt",
    name: "Harptos shape: Alturiak (30 days)",
    cycleYears: 1,
    offsetYear: 1,
    monthIndex: 1,
    dayDelta: -1,
  },
  {
    id: "leap-harptos-shape-ches",
    name: "Harptos shape: Ches (30 days)",
    cycleYears: 1,
    offsetYear: 1,
    monthIndex: 2,
    dayDelta: -1,
  },
  {
    id: "leap-harptos-shape-mir",
    name: "Harptos shape: Mirtul (30 days)",
    cycleYears: 1,
    offsetYear: 1,
    monthIndex: 4,
    dayDelta: -1,
  },
  {
    id: "leap-harptos-shape-kyth",
    name: "Harptos shape: Kythorn (30 days)",
    cycleYears: 1,
    offsetYear: 1,
    monthIndex: 5,
    dayDelta: -1,
  },
  {
    id: "leap-harptos-shape-ele",
    name: "Harptos shape: Eleasis (30 days)",
    cycleYears: 1,
    offsetYear: 1,
    monthIndex: 7,
    dayDelta: -1,
  },
  {
    id: "leap-harptos-shape-marp",
    name: "Harptos shape: Marpenoth (30 days)",
    cycleYears: 1,
    offsetYear: 1,
    monthIndex: 9,
    dayDelta: -1,
  },
  {
    id: "leap-harptos-shape-nig",
    name: "Harptos shape: Nightal (30 days)",
    cycleYears: 1,
    offsetYear: 1,
    monthIndex: 11,
    dayDelta: -1,
  },

  // --- Intercalary festival days (+1 each to 5 months) ---
  {
    id: "leap-harptos-midwinter",
    name: "Midwinter (festival after Hammer)",
    cycleYears: 1,
    offsetYear: 1,
    monthIndex: 0,
    dayDelta: 1,
  },
  {
    id: "leap-harptos-greengrass",
    name: "Greengrass (festival after Tarsakh)",
    cycleYears: 1,
    offsetYear: 1,
    monthIndex: 3,
    dayDelta: 1,
  },
  {
    id: "leap-harptos-midsummer",
    name: "Midsummer (festival after Flamerule)",
    cycleYears: 1,
    offsetYear: 1,
    monthIndex: 6,
    dayDelta: 1,
  },
  {
    id: "leap-harptos-highharvestide",
    name: "Highharvestide (festival after Eleint)",
    cycleYears: 1,
    offsetYear: 1,
    monthIndex: 8,
    dayDelta: 1,
  },
  {
    id: "leap-harptos-feastmoon",
    name: "Feast of the Moon (festival after Uktar)",
    cycleYears: 1,
    offsetYear: 1,
    monthIndex: 10,
    dayDelta: 1,
  },

  // --- Shieldmeet: +1 day every 4 years (after Midsummer) ---
  {
    id: "leap-harptos-shieldmeet",
    name: "Shieldmeet (leap day every 4 years after Midsummer)",
    cycleYears: 4,
    offsetYear: 4,
    monthIndex: 6,
    dayDelta: 1,
  },
];

const NO_OBSERVANCE = {
  weekendRule: "none",
  holidayConflictRule: "merge",
  maxShiftDays: 0,
  stayInMonth: false,
};

const CONFLICT_ALL = {
  appliesAgainst: "all",
  categories: [],
  holidayIds: [],
};

const HARPTOS_HOLIDAYS = [
  {
    id: "holiday-midwinter",
    name: "Midwinter",
    category: "religious",
    colorTag: "azure",
    recurrence: "yearly",
    startMonth: 0,
    year: 1,
    attrs: { useDate: true, useWeekday: false, useMoonPhase: false },
    anchor: {
      type: "fixed-date",
      algorithmKey: "none",
      moonSlot: 0,
      moonId: "",
      moonPhase: "F",
      markerKey: "",
      holidayId: "",
    },
    offsetDays: 0,
    observance: NO_OBSERVANCE,
    conflictScope: CONFLICT_ALL,
    dayOfMonth: 31,
    durationDays: 1,
    priority: 7,
    mergeMode: "merge",
  },
  {
    id: "holiday-greengrass",
    name: "Greengrass",
    category: "religious",
    colorTag: "emerald",
    recurrence: "yearly",
    startMonth: 3,
    year: 1,
    attrs: { useDate: true, useWeekday: false, useMoonPhase: false },
    anchor: {
      type: "fixed-date",
      algorithmKey: "none",
      moonSlot: 0,
      moonId: "",
      moonPhase: "F",
      markerKey: "",
      holidayId: "",
    },
    offsetDays: 0,
    observance: NO_OBSERVANCE,
    conflictScope: CONFLICT_ALL,
    dayOfMonth: 31,
    durationDays: 1,
    priority: 7,
    mergeMode: "merge",
  },
  {
    id: "holiday-midsummer",
    name: "Midsummer",
    category: "religious",
    colorTag: "gold",
    recurrence: "yearly",
    startMonth: 6,
    year: 1,
    attrs: { useDate: true, useWeekday: false, useMoonPhase: false },
    anchor: {
      type: "fixed-date",
      algorithmKey: "none",
      moonSlot: 0,
      moonId: "",
      moonPhase: "F",
      markerKey: "",
      holidayId: "",
    },
    offsetDays: 0,
    observance: NO_OBSERVANCE,
    conflictScope: CONFLICT_ALL,
    dayOfMonth: 31,
    durationDays: 1,
    priority: 7,
    mergeMode: "merge",
  },
  {
    id: "holiday-shieldmeet",
    name: "Shieldmeet",
    category: "civic",
    colorTag: "gold",
    recurrence: "yearly",
    startMonth: 6,
    year: 4,
    attrs: { useDate: true, useWeekday: false, useMoonPhase: false },
    anchor: {
      type: "fixed-date",
      algorithmKey: "none",
      moonSlot: 0,
      moonId: "",
      moonPhase: "F",
      markerKey: "",
      holidayId: "",
    },
    offsetDays: 0,
    observance: NO_OBSERVANCE,
    conflictScope: CONFLICT_ALL,
    dayOfMonth: 32,
    durationDays: 1,
    priority: 8,
    mergeMode: "merge",
  },
  {
    id: "holiday-highharvestide",
    name: "Highharvestide",
    category: "civic",
    colorTag: "amber",
    recurrence: "yearly",
    startMonth: 8,
    year: 1,
    attrs: { useDate: true, useWeekday: false, useMoonPhase: false },
    anchor: {
      type: "fixed-date",
      algorithmKey: "none",
      moonSlot: 0,
      moonId: "",
      moonPhase: "F",
      markerKey: "",
      holidayId: "",
    },
    offsetDays: 0,
    observance: NO_OBSERVANCE,
    conflictScope: CONFLICT_ALL,
    dayOfMonth: 31,
    durationDays: 1,
    priority: 7,
    mergeMode: "merge",
  },
  {
    id: "holiday-feastmoon",
    name: "Feast of the Moon",
    category: "religious",
    colorTag: "violet",
    recurrence: "yearly",
    startMonth: 10,
    year: 1,
    attrs: { useDate: true, useWeekday: false, useMoonPhase: false },
    anchor: {
      type: "fixed-date",
      algorithmKey: "none",
      moonSlot: 0,
      moonId: "",
      moonPhase: "F",
      markerKey: "",
      holidayId: "",
    },
    offsetDays: 0,
    observance: NO_OBSERVANCE,
    conflictScope: CONFLICT_ALL,
    dayOfMonth: 31,
    durationDays: 1,
    priority: 7,
    mergeMode: "merge",
  },
];

// ─── World data ──────────────────────────────────
// Distances normalised: Toril's canon 200 M miles → 1.0 AU.
// Star assumed ≈ 1 Msol (Toril's 365-day year at 1 AU).

const REALMSPACE_PRESET_WORLD = {
  version: 51,
  selectedBodyType: "planet",
  star: {
    name: "The Sun",
    massMsol: 1.0,
    ageGyr: 5.0,
    radiusRsolOverride: null,
    luminosityLsolOverride: null,
    tempKOverride: null,
    metallicityFeH: 0.0,
    physicsMode: "simple",
    advancedDerivationMode: "rl",
    evolutionMode: "zams",
    activityModelVersion: "v2",
  },
  system: {
    spacingFactor: 0.3,
    orbit1Au: 0.25,
    gasGiants: {
      selectedId: "gg_coliar",
      order: ["gg_coliar"],
      byId: {
        gg_coliar: {
          id: "gg_coliar",
          name: "Coliar",
          au: 0.5,
          slotIndex: 2,
          style: "jupiter",
          rings: false,
          radiusRj: 0.68,
          massMjup: null,
          rotationPeriodHours: null,
          metallicity: null,
        },
      },
    },
    debrisDisks: {
      order: ["dd_tears"],
      byId: {
        dd_tears: {
          id: "dd_tears",
          name: "Tears of Selune",
          innerAu: 0.98,
          outerAu: 1.02,
          suggested: false,
          eccentricity: null,
          inclination: null,
          totalMassMearth: null,
        },
      },
    },
  },
  planets: {
    selectedId: "p_toril",
    order: ["p_anadia", "p_toril", "p_karpri", "p_chandos", "p_glyth"],
    byId: {
      p_anadia: {
        id: "p_anadia",
        name: "Anadia",
        slotIndex: 1,
        locked: false,
        inputs: {
          name: "Anadia",
          semiMajorAxisAu: 0.25,
          eccentricity: 0.04,
          inclinationDeg: 2.0,
          longitudeOfPeriapsisDeg: 45.0,
          subsolarLongitudeDeg: 0.0,
          rotationPeriodHours: 12.0,
          axialTiltDeg: 5.0,
          massEarth: 0.06,
          cmfPct: 18.0, // Mars-like → amber/orange surface palette
          wmfPct: 0.015, // Polar freshwater seas → Shallow oceans
          albedoBond: 0.15,
          greenhouseEffect: 0.0,
          greenhouseMode: "core",
          observerHeightM: 1.0, // Halfling inhabitants
          pressureAtm: 0.1, // Thin but breathable
          o2Pct: 10.0,
          co2Pct: 1.0,
          h2oPct: 0.1,
          ch4Pct: 0,
          h2Pct: 0,
          hePct: 0,
          so2Pct: 0,
          nh3Pct: 0,
          arPct: 1.0,
          tectonicRegime: "stagnant", // Small, geologically dead
          mantleOxidation: "earth",
          vegOverride: true, // Polar vegetation (trees, pastoral fields)
          vegPaleHexOverride: "#5a8a40",
          vegDeepHexOverride: "#2a5a15",
        },
      },
      p_toril: {
        id: "p_toril",
        name: "Toril",
        slotIndex: 3,
        locked: false,
        inputs: {
          name: "Toril",
          semiMajorAxisAu: 1.0,
          eccentricity: 0.017,
          inclinationDeg: 0.0,
          longitudeOfPeriapsisDeg: 100.0,
          subsolarLongitudeDeg: 0.0,
          rotationPeriodHours: 24.0,
          axialTiltDeg: 23.5,
          massEarth: 1.0,
          cmfPct: 33.0,
          wmfPct: 0.5, // ~60% ocean → Extensive oceans
          albedoBond: 0.3,
          greenhouseEffect: 1.65,
          greenhouseMode: "core",
          observerHeightM: 1.75,
          pressureAtm: 1.0,
          o2Pct: 21.0,
          co2Pct: 0.04,
          h2oPct: 0.4,
          ch4Pct: 0,
          h2Pct: 0,
          hePct: 0,
          so2Pct: 0,
          nh3Pct: 0,
          arPct: 0.93,
          tectonicRegime: "auto",
          mantleOxidation: "earth",
        },
      },
      p_karpri: {
        id: "p_karpri",
        name: "Karpri",
        slotIndex: 4,
        locked: false,
        inputs: {
          name: "Karpri",
          semiMajorAxisAu: 1.5,
          eccentricity: 0.03,
          inclinationDeg: 3.0,
          longitudeOfPeriapsisDeg: 200.0,
          subsolarLongitudeDeg: 0.0,
          rotationPeriodHours: 1.2, // Canon: 1h12m, extreme Coriolis effects
          axialTiltDeg: 10.0,
          massEarth: 1.1,
          cmfPct: 20.0,
          wmfPct: 5, // 100% water surface → Global ocean
          albedoBond: 0.4, // Ocean + polar ice mix
          greenhouseEffect: 4, // Equatorial liquid water, polar ice caps
          greenhouseMode: "core",
          observerHeightM: 1.75,
          pressureAtm: 1.0, // "Remarkably clean" breathable atmosphere
          o2Pct: 21.0, // Fresh/Type A atmosphere
          co2Pct: 0.3,
          h2oPct: 3, // Very humid, water world
          ch4Pct: 0,
          h2Pct: 0,
          hePct: 0,
          so2Pct: 0,
          nh3Pct: 0,
          arPct: 0.93,
          tectonicRegime: "stagnant", // No visible land tectonics
          mantleOxidation: "earth",
        },
      },
      p_chandos: {
        id: "p_chandos",
        name: "Chandos",
        slotIndex: 5,
        locked: false,
        inputs: {
          name: "Chandos",
          semiMajorAxisAu: 2.0,
          eccentricity: 0.05,
          inclinationDeg: 4.0,
          longitudeOfPeriapsisDeg: 310.0,
          subsolarLongitudeDeg: 0.0,
          rotationPeriodHours: 48.0,
          axialTiltDeg: 15.0,
          massEarth: 2.5,
          cmfPct: 25.0,
          wmfPct: 2, // Predominantly water + floating rock islands → Global ocean
          albedoBond: 0.35,
          greenhouseEffect: 9, // Liquid water at 2 AU (~271 K average)
          greenhouseMode: "core",
          observerHeightM: 1.75,
          pressureAtm: 1.2, // Breathable (Type B), supports greenhouse
          o2Pct: 18.0, // Breathable but lacks ozone layer
          co2Pct: 2.0,
          h2oPct: 4, // Very humid, ocean world
          ch4Pct: 0,
          h2Pct: 0,
          hePct: 0,
          so2Pct: 0,
          nh3Pct: 0,
          arPct: 1.0,
          tectonicRegime: "episodic", // Constant instability, islands rise/sink
          mantleOxidation: "earth",
        },
      },
      // Glyth: canonically a Size E Earth Body (SJR2), not a gas giant.
      // 80% land, 20% gelatinous "water". Toxic atmosphere from illithid
      // forest-burning. Four concentric ring systems (not modelled here).
      p_glyth: {
        id: "p_glyth",
        name: "Glyth",
        slotIndex: 7,
        locked: false,
        inputs: {
          name: "Glyth",
          semiMajorAxisAu: 5.0,
          eccentricity: 0.02,
          inclinationDeg: 1.0,
          longitudeOfPeriapsisDeg: 60.0,
          subsolarLongitudeDeg: 0.0,
          rotationPeriodHours: 30.5, // Canon: 30h30m
          axialTiltDeg: 10.0,
          massEarth: 1.5, // Size E, similar to Toril
          cmfPct: 33.0,
          wmfPct: 0.015, // 20% gelatinous "water" → Shallow oceans
          albedoBond: 0.2, // Dull gray appearance
          greenhouseEffect: 60, // Thick smoky atmosphere warms surface at 5 AU
          greenhouseMode: "core",
          observerHeightM: 1.75,
          pressureAtm: 1.5, // Thick, fouled atmosphere
          o2Pct: 8.0, // Depleted by controlled burns
          co2Pct: 10.0, // High CO₂ from forest fires
          h2oPct: 0.5,
          ch4Pct: 0,
          h2Pct: 0,
          hePct: 0,
          so2Pct: 2, // Acidic rain, pollution from burning
          nh3Pct: 0,
          arPct: 1.0,
          tectonicRegime: "stagnant",
          mantleOxidation: "earth",
        },
      },
    },
  },
  moons: {
    selectedId: "m_selune",
    order: ["m_selune"],
    byId: {
      m_selune: {
        id: "m_selune",
        name: "Selune",
        planetId: "p_toril",
        locked: false,
        inputs: {
          name: "Selune",
          semiMajorAxisKm: 295000,
          eccentricity: 0.04,
          inclinationDeg: 5.0,
          massMoon: 0.72, // ~93% Luna radius, density 3.0 → 72% Luna mass
          densityGcm3: 3.0,
          albedo: 0.12,
          compositionOverride: null,
        },
      },
    },
  },
  calendar: {
    activeProfileId: "cal-harptos",
    profiles: [
      {
        id: "cal-harptos",
        name: "Calendar of Harptos",
        inputs: {
          sourcePlanetId: "p_toril",
          primaryMoonId: "m_selune",
          extraMoonIds: ["", "", ""],
          monthsPerYear: 12,
          daysPerMonth: 30,
          daysPerWeek: 10,
        },
        ui: {
          calendarName: "Calendar of Harptos",
          basis: "solar",
          year: 1372,
          monthIndex: 0,
          selectedDay: 1,
          startDayOfYear: 0,
          weekStartsOn: 0,
          moonEpochOffsetDays: 0,
          dayNames: HARPTOS_DAY_NAMES,
          weekNames: [],
          monthNames: HARPTOS_MONTH_NAMES,
          yearDisplayMode: "pre-calendar",
          yearOffset: 0,
          yearPrefix: "",
          yearSuffix: " DR",
          preCalendarStartYear: 1,
          postEraLabel: "DR",
          preEraLabel: "BDR",
          preCalendarUseYearZero: false,
          eras: [],
          astronomy: {
            enabled: false,
            seasons: true,
            seasonBands: true,
            eclipses: true,
          },
          exportAnchorDate: "2026-01-01",
          icsIncludes: {
            holidays: true,
            festivals: true,
            markers: true,
          },
          leapRules: HARPTOS_LEAP_RULES,
          holidays: HARPTOS_HOLIDAYS,
          festivalRules: [],
          holidayCategoryFilters: {
            civic: true,
            religious: true,
            regional: true,
            market: true,
            observance: true,
            custom: true,
          },
          workCycles: [],
          jumpAbsoluteDay: 0,
          jumpYear: 1372,
          jumpMonthIndex: 0,
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
        },
      },
    ],
  },
  cluster: {
    galacticRadiusLy: 50000,
    locationLy: 25800,
    neighbourhoodRadiusLy: 10,
    stellarDensityPerLy3: 0.004,
    randomSeed: 1,
  },
  clusterSystemNames: {},
  clusterAdjustments: {
    addedSystems: [],
    removedSystemIds: [],
    componentOverrides: {},
  },
};

function deepClone(value) {
  return JSON.parse(JSON.stringify(value));
}

export function createRealmspacePresetEnvelope() {
  return { world: deepClone(REALMSPACE_PRESET_WORLD) };
}
