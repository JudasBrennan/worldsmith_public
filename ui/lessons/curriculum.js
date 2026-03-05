/**
 * Curriculum manifest — defines the ordered lesson list and unit groupings.
 *
 * Each entry carries metadata used by the page controller to build the TOC
 * and accordion.  The `build` function is the lesson builder (mode => html).
 * The optional `wire` function binds any mini-calculators after render.
 */

import { buildLesson01, wireLesson01 } from "./L01_starBasics.js";
import { buildLesson02 } from "./L02_spectralTypes.js";
import { buildLesson03, wireLesson03 } from "./L03_luminosity.js";
import { buildLesson04 } from "./L04_stellarEvolution.js";
import { buildLesson05, wireLesson05 } from "./L05_habitableZone.js";
import { buildLesson06 } from "./L06_orbitalMechanics.js";
import { buildLesson07 } from "./L07_planetarySystems.js";
import { buildLesson08, wireLesson08 } from "./L08_rockyPlanets.js";
import { buildLesson09 } from "./L09_atmospheres.js";
import { buildLesson10, wireLesson10 } from "./L10_surfaceTemperature.js";
import { buildLesson11, wireLesson11 } from "./L11_gasGiants.js";
import { buildLesson12, wireLesson12 } from "./L12_moonsTides.js";
import { buildLesson13 } from "./L13_tectonics.js";
import { buildLesson14 } from "./L14_climateZones.js";
import { buildLesson15, wireLesson15 } from "./L15_stellarActivity.js";
import { buildLesson16, wireLesson16 } from "./L16_observing.js";
import { buildLesson17, wireLesson17 } from "./L17_calendars.js";
import { buildLesson18 } from "./L18_population.js";
import { buildLesson19 } from "./L19_localCluster.js";
import { buildLesson20 } from "./L20_debrisDisks.js";

/** @type {{ unit: string, lessons: { id: string, num: number, title: string, subtitle: string, build: (mode: string) => string, wire?: (root: Element) => void }[] }[]} */
export const CURRICULUM = [
  {
    unit: "Stars",
    lessons: [
      {
        id: "L01",
        num: 1,
        title: "What Is a Star?",
        subtitle: "Mass, luminosity, and the master variable",
        build: buildLesson01,
        wire: wireLesson01,
      },
      {
        id: "L02",
        num: 2,
        title: "Classifying Stars",
        subtitle: "Spectral types and the colour-temperature link",
        build: buildLesson02,
      },
      {
        id: "L03",
        num: 3,
        title: "Stellar Luminosity",
        subtitle: "The mass-luminosity relation",
        build: buildLesson03,
        wire: wireLesson03,
      },
      {
        id: "L04",
        num: 4,
        title: "Stellar Evolution",
        subtitle: "From birth to giant branch",
        build: buildLesson04,
      },
      {
        id: "L05",
        num: 5,
        title: "The Habitable Zone",
        subtitle: "Where liquid water can exist",
        build: buildLesson05,
        wire: wireLesson05,
      },
    ],
  },
  {
    unit: "Orbits & Systems",
    lessons: [
      {
        id: "L06",
        num: 6,
        title: "Orbital Mechanics",
        subtitle: "Kepler's laws and elliptical orbits",
        build: buildLesson06,
      },
      {
        id: "L07",
        num: 7,
        title: "Planetary Systems",
        subtitle: "Frost lines, spacing, and architecture",
        build: buildLesson07,
      },
    ],
  },
  {
    unit: "Terrestrial Worlds",
    lessons: [
      {
        id: "L08",
        num: 8,
        title: "Rocky Planets",
        subtitle: "Composition, density, and gravity",
        build: buildLesson08,
        wire: wireLesson08,
      },
      {
        id: "L09",
        num: 9,
        title: "Atmospheres",
        subtitle: "Pressure, escape, and outgassing",
        build: buildLesson09,
      },
      {
        id: "L10",
        num: 10,
        title: "Surface Temperature",
        subtitle: "Energy balance and the greenhouse effect",
        build: buildLesson10,
        wire: wireLesson10,
      },
    ],
  },
  {
    unit: "Giants & Moons",
    lessons: [
      {
        id: "L11",
        num: 11,
        title: "Gas Giants",
        subtitle: "Mass-radius relations and cloud layers",
        build: buildLesson11,
        wire: wireLesson11,
      },
      {
        id: "L12",
        num: 12,
        title: "Moons & Tides",
        subtitle: "Roche limits, Hill spheres, and tidal heating",
        build: buildLesson12,
        wire: wireLesson12,
      },
    ],
  },
  {
    unit: "Surface & Climate",
    lessons: [
      {
        id: "L13",
        num: 13,
        title: "Interiors & Tectonics",
        subtitle: "Plates, mountains, and volcanism",
        build: buildLesson13,
      },
      {
        id: "L14",
        num: 14,
        title: "Climate Zones",
        subtitle: "K\u00F6ppen classification and circulation",
        build: buildLesson14,
      },
    ],
  },
  {
    unit: "The Wider Universe",
    lessons: [
      {
        id: "L15",
        num: 15,
        title: "Stellar Activity",
        subtitle: "Flares, CMEs, and habitability",
        build: buildLesson15,
        wire: wireLesson15,
      },
      {
        id: "L16",
        num: 16,
        title: "Observing the Sky",
        subtitle: "Magnitudes, brightness, and visibility",
        build: buildLesson16,
        wire: wireLesson16,
      },
      {
        id: "L17",
        num: 17,
        title: "Calendars & Time",
        subtitle: "Days, months, years, and leap cycles",
        build: buildLesson17,
        wire: wireLesson17,
      },
      {
        id: "L18",
        num: 18,
        title: "Population & Civilisation",
        subtitle: "Carrying capacity and growth",
        build: buildLesson18,
      },
      {
        id: "L19",
        num: 19,
        title: "The Local Cluster",
        subtitle: "Stellar neighbourhoods and multiplicity",
        build: buildLesson19,
      },
      {
        id: "L20",
        num: 20,
        title: "Debris & Small Bodies",
        subtitle: "Rings, asteroids, and resonance sculpting",
        build: buildLesson20,
      },
    ],
  },
];
