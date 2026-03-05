// ─── Arrakis (Dune) system preset ──────────────────────────────────
//
// Star "Canopus" is modelled as a 1.15 Msol F-type main-sequence star
// (the real Canopus is a supergiant — far too luminous for a habitable
// planet). This gives ~1.7 Lsol and ~6200 K, placing the habitable
// zone around 1.1–1.7 AU. Arrakis orbits at ~1.02 AU (inner HZ edge),
// yielding a ~353-day year consistent with the Dune Encyclopedia.
//
// Physical data drawn from:
//   - Frank Herbert's novels (1965–1985)
//   - The Dune Encyclopedia (1984, ed. Willis McNelly)
//   - Bristol University climate model of Arrakis (2021)
//   - Scientific estimates where canon is silent
//
// The Canopus system contains six worlds (DE): Seban, Menaris, Arrakis,
// Ven (rocky), plus gas giants Extaris and Revona.

const ARRAKIS_PRESET_WORLD = {
  version: 51,
  selectedBodyType: "planet",

  // ── Star: Canopus ──────────────────────────────────────────────────
  star: {
    name: "Canopus",
    massMsol: 1.15,
    ageGyr: 4.5,
    radiusRsolOverride: null,
    luminosityLsolOverride: null,
    tempKOverride: null,
    metallicityFeH: -0.05,
    physicsMode: "simple",
    advancedDerivationMode: "rl",
    evolutionMode: "zams",
    activityModelVersion: "v2",
  },

  // ── Planetary system ───────────────────────────────────────────────
  system: {
    spacingFactor: 0.3,
    orbit1Au: 0.35,

    gasGiants: {
      selectedId: "gg_extaris",
      order: ["gg_extaris", "gg_revona"],
      byId: {
        gg_extaris: {
          id: "gg_extaris",
          name: "Extaris",
          au: 5.8,
          slotIndex: 6,
          style: "jupiter",
          rings: false,
          radiusRj: 0.75,
          massMjup: 0.6,
          rotationPeriodHours: 11.0,
          metallicity: 5,
        },
        gg_revona: {
          id: "gg_revona",
          name: "Revona",
          au: 13.5,
          slotIndex: 8,
          style: "neptune",
          rings: false,
          radiusRj: 0.38,
          massMjup: 0.06,
          rotationPeriodHours: 14.0,
          metallicity: 60,
        },
      },
    },

    debrisDisks: {
      order: ["dd_canopus_belt"],
      byId: {
        dd_canopus_belt: {
          id: "dd_canopus_belt",
          name: "Canopus dust belt",
          innerAu: 2.8,
          outerAu: 4.2,
          suggested: false,
          eccentricity: null,
          inclination: null,
          totalMassMearth: null,
        },
      },
    },
  },

  // ── Rocky planets ──────────────────────────────────────────────────
  planets: {
    selectedId: "p_arrakis",
    order: ["p_seban", "p_menaris", "p_arrakis", "p_ven"],
    byId: {
      /* ── Seban (Canopus I) — Mercury analogue ──────────── */
      p_seban: {
        id: "p_seban",
        name: "Seban",
        slotIndex: 1,
        locked: false,
        inputs: {
          name: "Seban",
          semiMajorAxisAu: 0.35,
          eccentricity: 0.18,
          inclinationDeg: 5.2,
          longitudeOfPeriapsisDeg: 45.0,
          subsolarLongitudeDeg: 0.0,
          rotationPeriodHours: 1200.0,
          axialTiltDeg: 0.5,
          massEarth: 0.06,
          cmfPct: 65.0,
          wmfPct: 0,
          albedoBond: 0.07,
          greenhouseEffect: 0.0,
          greenhouseMode: "core",
          observerHeightM: 1.75,
          pressureAtm: 0.0,
          o2Pct: 0.0,
          co2Pct: 0.0,
          arPct: 0.0,
          h2oPct: 0,
          ch4Pct: 0,
          h2Pct: 0,
          hePct: 0,
          so2Pct: 0,
          nh3Pct: 0,
          tectonicRegime: "stagnant",
          mantleOxidation: "earth",
        },
      },

      /* ── Menaris (Canopus II) — Venus analogue ─────────── */
      p_menaris: {
        id: "p_menaris",
        name: "Menaris",
        slotIndex: 2,
        locked: false,
        inputs: {
          name: "Menaris",
          semiMajorAxisAu: 0.68,
          eccentricity: 0.01,
          inclinationDeg: 2.1,
          longitudeOfPeriapsisDeg: 120.0,
          subsolarLongitudeDeg: 0.0,
          rotationPeriodHours: 4800.0,
          axialTiltDeg: 175.0,
          massEarth: 0.72,
          cmfPct: 30.0,
          wmfPct: 0,
          albedoBond: 0.72,
          greenhouseEffect: 180.0,
          greenhouseMode: "core",
          observerHeightM: 1.75,
          pressureAtm: 78.0,
          o2Pct: 0.0,
          co2Pct: 95.0,
          arPct: 0.01,
          h2oPct: 0.005,
          ch4Pct: 0,
          h2Pct: 0,
          hePct: 0.001,
          so2Pct: 0.02,
          nh3Pct: 0,
          tectonicRegime: "stagnant",
          mantleOxidation: "earth",
        },
      },

      /* ── Arrakis (Canopus III) — the desert planet ─────── */
      p_arrakis: {
        id: "p_arrakis",
        name: "Arrakis",
        slotIndex: 3,
        locked: false,
        inputs: {
          name: "Arrakis",
          semiMajorAxisAu: 1.02,
          eccentricity: 0.034,
          inclinationDeg: 0.8,
          longitudeOfPeriapsisDeg: 85.0,
          subsolarLongitudeDeg: 0.0,
          rotationPeriodHours: 22.4, // Dune Encyclopedia
          axialTiltDeg: 5.0, // near-zero; minimal seasons
          massEarth: 0.8, // DE: density 4.95 g/cm³, r = 0.962 Re
          cmfPct: 25.0, // DE: 21.4% metallics + sulfides
          wmfPct: 0, // desert world, negligible surface water
          albedoBond: 0.3, // desert sand + dark rock
          greenhouseEffect: 0.25, // very dry; ozone-dominated, weak
          greenhouseMode: "core",
          observerHeightM: 1.75,
          // Atmosphere (Dune Encyclopedia)
          pressureAtm: 1.0,
          o2Pct: 23.58,
          co2Pct: 0.035,
          arPct: 1.01,
          h2oPct: 0.1, // extremely dry (<0.5% per DE)
          ch4Pct: 0,
          h2Pct: 0,
          hePct: 0,
          so2Pct: 0,
          nh3Pct: 0,
          tectonicRegime: "auto",
          mantleOxidation: "earth",
        },
      },

      /* ── Ven (Canopus IV) — Mars analogue ──────────────── */
      p_ven: {
        id: "p_ven",
        name: "Ven",
        slotIndex: 4,
        locked: false,
        inputs: {
          name: "Ven",
          semiMajorAxisAu: 1.58,
          eccentricity: 0.07,
          inclinationDeg: 1.5,
          longitudeOfPeriapsisDeg: 290.0,
          subsolarLongitudeDeg: 0.0,
          rotationPeriodHours: 25.8,
          axialTiltDeg: 22.0,
          massEarth: 0.12,
          cmfPct: 22.0,
          wmfPct: 0,
          albedoBond: 0.22,
          greenhouseEffect: 0.04,
          greenhouseMode: "core",
          observerHeightM: 1.75,
          pressureAtm: 0.008,
          o2Pct: 0.1,
          co2Pct: 94.0,
          arPct: 2.0,
          h2oPct: 0.02,
          ch4Pct: 0,
          h2Pct: 0,
          hePct: 0,
          so2Pct: 0,
          nh3Pct: 0,
          tectonicRegime: "stagnant",
          mantleOxidation: "earth",
        },
      },
    },
  },

  // ── Moons ──────────────────────────────────────────────────────────
  moons: {
    selectedId: "m_krelln",
    order: ["m_krelln", "m_arvon", "m_aja", "m_tarim", "m_koris", "m_bela", "m_halleck", "m_laran"],
    byId: {
      /* ── Arrakis — two moons ────────────────────────────── */
      // Krelln ("First Moon" / "Hand of God") — outer, dense silicates
      m_krelln: {
        id: "m_krelln",
        name: "Krelln",
        planetId: "p_arrakis",
        locked: false,
        inputs: {
          name: "Krelln",
          semiMajorAxisKm: 324077, // DE
          eccentricity: 0.005,
          inclinationDeg: 2.3,
          massMoon: 0.0263, // r=488 km, ρ=3.97 g/cm³
          densityGcm3: 3.97, // titanium-rich silicates (DE)
          albedo: 0.1, // dark rocky surface
          compositionOverride: null,
        },
      },
      // Arvon ("Second Moon" / "Muad'Dib") — inner, icy
      m_arvon: {
        id: "m_arvon",
        name: "Arvon",
        planetId: "p_arrakis",
        locked: false,
        inputs: {
          name: "Arvon",
          semiMajorAxisKm: 103000, // DE: perigee
          eccentricity: 0.01,
          inclinationDeg: 1.1,
          massMoon: 0.00094, // r=201 km, ρ=2.02 g/cm³
          densityGcm3: 2.02, // water ice + frozen CO₂ (DE)
          albedo: 0.4, // bright icy surface
          compositionOverride: null,
        },
      },

      /* ── Extaris — five moons ───────────────────────────── */
      // Aja (named in DE)
      m_aja: {
        id: "m_aja",
        name: "Aja",
        planetId: "gg_extaris",
        locked: false,
        inputs: {
          name: "Aja",
          semiMajorAxisKm: 420000,
          eccentricity: 0.004,
          inclinationDeg: 0.05,
          massMoon: 1.1,
          densityGcm3: 3.4,
          albedo: 0.55,
          compositionOverride: null,
        },
      },
      m_tarim: {
        id: "m_tarim",
        name: "Tarim",
        planetId: "gg_extaris",
        locked: false,
        inputs: {
          name: "Tarim",
          semiMajorAxisKm: 680000,
          eccentricity: 0.009,
          inclinationDeg: 0.4,
          massMoon: 0.58,
          densityGcm3: 2.9,
          albedo: 0.6,
          compositionOverride: null,
        },
      },
      m_koris: {
        id: "m_koris",
        name: "Koris",
        planetId: "gg_extaris",
        locked: false,
        inputs: {
          name: "Koris",
          semiMajorAxisKm: 1050000,
          eccentricity: 0.001,
          inclinationDeg: 0.2,
          massMoon: 1.8,
          densityGcm3: 1.95,
          albedo: 0.38,
          compositionOverride: null,
        },
      },
      m_bela: {
        id: "m_bela",
        name: "Bela",
        planetId: "gg_extaris",
        locked: false,
        inputs: {
          name: "Bela",
          semiMajorAxisKm: 1850000,
          eccentricity: 0.007,
          inclinationDeg: 0.3,
          massMoon: 1.3,
          densityGcm3: 1.85,
          albedo: 0.15,
          compositionOverride: null,
        },
      },
      m_halleck: {
        id: "m_halleck",
        name: "Halleck",
        planetId: "gg_extaris",
        locked: false,
        inputs: {
          name: "Halleck",
          semiMajorAxisKm: 260000,
          eccentricity: 0.003,
          inclinationDeg: 0.1,
          massMoon: 0.0005,
          densityGcm3: 1.2,
          albedo: 0.85,
          compositionOverride: null,
        },
      },

      /* ── Revona — one moon ──────────────────────────────── */
      m_laran: {
        id: "m_laran",
        name: "Laran",
        planetId: "gg_revona",
        locked: false,
        inputs: {
          name: "Laran",
          semiMajorAxisKm: 350000,
          eccentricity: 0.0002,
          inclinationDeg: 155.0, // retrograde capture (Triton-like)
          massMoon: 0.25,
          densityGcm3: 2.1,
          albedo: 0.65,
          compositionOverride: null,
        },
      },
    },
  },

  // ── Calendar (Imperial Standard / AG dating) ───────────────────────
  calendar: {
    activeProfileId: "cal-arrakis-imperial",
    profiles: [
      {
        id: "cal-arrakis-imperial",
        name: "Imperial Standard",
        inputs: {
          sourcePlanetId: "p_arrakis",
          primaryMoonId: "m_krelln",
          extraMoonIds: ["m_arvon", "", ""],
          monthsPerYear: 12,
          daysPerMonth: null,
          daysPerWeek: null,
        },
        ui: {
          calendarName: "Imperial Standard",
          basis: "solar",
          year: 10191,
          monthIndex: 0,
          selectedDay: 1,
          startDayOfYear: 0,
          weekStartsOn: 0,
          moonEpochOffsetDays: 0,
          dayNames: [
            "Primaday",
            "Secunday",
            "Tertiaday",
            "Quartaday",
            "Quintaday",
            "Sextaday",
            "Septiday",
          ],
          weekNames: [],
          monthNames: [
            "Primus",
            "Secundus",
            "Tertius",
            "Quartus",
            "Quintus",
            "Sextus",
            "Septimus",
            "Octavus",
            "Nonus",
            "Decimus",
            "Undecimus",
            "Duodecimus",
          ],
          yearDisplayMode: "pre-calendar",
          yearOffset: 0,
          yearPrefix: "",
          yearSuffix: " AG",
          preCalendarStartYear: 1,
          postEraLabel: "AG",
          preEraLabel: "BG",
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
          leapRules: [],
          holidays: [],
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
          jumpYear: 10191,
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

  // ── Local cluster ──────────────────────────────────────────────────
  cluster: {
    galacticRadiusLy: 50000,
    locationLy: 25800,
    neighbourhoodRadiusLy: 10,
    stellarDensityPerLy3: 0.004,
    randomSeed: 42,
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

export function createArrakisPresetEnvelope() {
  return { world: deepClone(ARRAKIS_PRESET_WORLD) };
}
