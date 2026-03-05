/**
 * Lesson 14 — Climate Zones
 *
 * Covers the Koppen climate classification, temperature gradients,
 * atmospheric circulation cells, moisture and aridity patterns, and
 * tidally locked climates.  No interactive calculator for this lesson.
 */

import { concept, analogy, keyIdea, eq, iq, vars, cite, dataTable } from "./helpers.js";

/* ── build ─────────────────────────────────────────────────────────── */

export function buildLesson14(mode) {
  return [
    /* 1 ── The Koppen System ───────────────────────────────────────── */
    concept(
      "The K\u00f6ppen System",
      /* basic */
      `<p>Climatologists use a classification system to label the world's
        climates based on temperature and rainfall. The most widely used
        scheme, developed by Wladimir K\u00f6ppen in the early 1900s,
        sorts climates into five master classes:</p>
      ${dataTable(
        ["Letter", "Name", "Key characteristic"],
        [
          ["A", "Tropical", "Hot year-round, heavy rainfall"],
          ["B", "Arid", "Dry; evaporation exceeds precipitation"],
          ["C", "Temperate", "Mild winters, distinct seasons"],
          ["D", "Continental", "Harsh winters, wide temperature swings"],
          ["E", "Polar", "Cold year-round, little precipitation"],
        ],
      )}
      <p>Each master class is subdivided further by seasonal patterns
        (e.g. dry summer, monsoon, humid) and temperature (e.g. hot summer,
        cold summer), producing over 30 distinct climate types — from the
        sweltering rainforests of "Af" to the frozen tundra of "ET".</p>
      ${keyIdea("The K\u00f6ppen system classifies climates into five master groups (tropical, arid, temperate, continental, polar) based on temperature and precipitation thresholds.")}`,

      /* advanced */
      `<p>The K\u00f6ppen-Geiger classification uses monthly temperature
        and precipitation thresholds to assign a 2- or 3-letter code.
        The master classes and their primary criteria:</p>
      ${dataTable(
        ["Class", "Criterion"],
        [
          ["A (Tropical)", "Coldest month \\(T_{\\text{min}} \\geq 18\\)\u00b0C"],
          ["B (Arid)", "Annual precipitation below a threshold set by temperature and seasonality"],
          [
            "C (Temperate)",
            "\\(-3 < T_{\\text{min}} < 18\\)\u00b0C, warmest month \\(T_{\\text{max}} \\geq 10\\)\u00b0C",
          ],
          [
            "D (Continental)",
            "\\(T_{\\text{min}} \\leq -3\\)\u00b0C, \\(T_{\\text{max}} \\geq 10\\)\u00b0C",
          ],
          ["E (Polar)", "\\(T_{\\text{max}} < 10\\)\u00b0C"],
        ],
      )}
      <p>The aridity threshold for class B uses:</p>
      ${eq("P_\\text{thresh} = 20\\,T_\\text{ann} + 280\\;(\\text{if } \\geq 70\\%\\text{ of rain in summer})")}
      ${eq("P_\\text{thresh} = 20\\,T_\\text{ann}\\;(\\text{if } < 30\\%\\text{ of rain in summer})")}
      ${vars([
        ["P_\\text{thresh}", "aridity threshold (mm/yr)"],
        ["T_\\text{ann}", "annual mean temperature (\u00b0C)"],
      ])}
      <p>Second and third letters encode precipitation seasonality (f, s,
        w, m) and temperature severity (a, b, c, d). The classification
        has been updated multiple times; the Kottek et al. (2006) revision
        is most commonly used in modern climatology.</p>
      ${cite("K\u00f6ppen (1936), Das geographische System der Klimate; Kottek et al. (2006, Meteorol. Z. 15, 259)")}`,
      mode,
    ),

    /* 2 ── Temperature Gradients ───────────────────────────────────── */
    concept(
      "Temperature Gradients",
      /* basic */
      `<p>The equator is hotter than the poles because sunlight strikes the
        equator more directly. Near the poles, the same amount of sunlight
        is spread over a much larger area and passes through more
        atmosphere, delivering less heat per square metre.</p>
      <p>This creates a temperature gradient from equator to pole. On Earth,
        the equator averages about 27\u00b0C while the poles average around
        -30\u00b0C — a difference of roughly 60\u00b0C. The atmosphere and
        oceans work together to redistribute heat poleward, softening this
        gradient from what it would otherwise be.</p>
      ${analogy("Imagine shining a torch straight down onto a table (equator) versus at a steep angle (poles). The straight-on beam makes a small, bright spot. The angled beam makes a large, dim spot. Same torch, different heating.")}
      ${keyIdea("The equator receives more concentrated sunlight than the poles, creating a temperature gradient of about 60 K. Atmosphere and oceans redistribute heat, smoothing the gradient.")}`,

      /* advanced */
      `<p>The equator-to-pole temperature difference ${iq("\\Delta T")} on
        a planet depends on the stellar flux distribution, axial tilt,
        atmospheric mass, and rotation rate. For an Earth-like world, the
        base radiative-equilibrium gradient is approximately 60 K, reduced
        by atmospheric heat transport.</p>
      <p>A simple parameterisation uses a redistribution coefficient
        ${iq("f_\\text{red}")}:</p>
      ${eq("T(\\phi) = T_\\text{eq} - \\Delta T_\\text{base}\\;(1 - f_\\text{red})\\;\\sin^2\\!\\phi")}
      ${vars([
        ["T(\\phi)", "surface temperature at latitude \\phi"],
        ["T_\\text{eq}", "equatorial temperature"],
        ["\\Delta T_\\text{base}", "base radiative gradient (~60 K for Earth-like worlds)"],
        [
          "f_\\text{red}",
          "heat redistribution efficiency (~0.8 for Earth; higher with thicker atmosphere)",
        ],
        ["\\phi", "latitude"],
      ])}
      <p>A thicker or denser atmosphere (higher ${iq("f_\\text{red}")}
        towards 1.0) flattens the gradient, making equator and poles more
        similar in temperature — as on Venus, where the atmosphere is so
        massive that surface temperatures are nearly uniform. A thin or
        absent atmosphere (${iq("f_\\text{red} \\to 0")}) preserves the
        full radiative gradient — as on the Moon.</p>
      ${cite("North, Cahalan & Coakley (1981, Rev. Geophys. 19, 91); Williams & Kasting (1997, Icarus 129, 254)")}`,
      mode,
    ),

    /* 3 ── Atmospheric Circulation ─────────────────────────────────── */
    concept(
      "Atmospheric Circulation",
      /* basic */
      `<p>The atmosphere is a giant heat engine that carries warm air from
        the equator toward the poles. This circulation is organised into
        large-scale loops called <strong>cells</strong>:</p>
      <ul>
        <li><strong>Hadley cells</strong> (equator to ~30\u00b0 latitude) —
            hot air rises at the equator, flows poleward at altitude, cools,
            and sinks at the subtropics. The sinking air creates the dry
            belt where many of the world's great deserts lie.</li>
        <li><strong>Ferrel cells</strong> (~30\u00b0 to ~60\u00b0) — an
            indirect, weaker cell driven by eddies. Surface winds blow
            poleward and eastward (the "westerlies").</li>
        <li><strong>Polar cells</strong> (~60\u00b0 to poles) — cold air
            sinks at the poles and flows equatorward along the surface.</li>
      </ul>
      <p>Earth has three cells per hemisphere (six total). Faster-rotating
        planets would have more, narrower cells; slower-rotating ones would
        have fewer, broader cells.</p>
      ${analogy("Think of a pot of water heated from below. The warm water rises in the centre, spreads outward, cools, and sinks at the edges. Now spin the pot — the circulation breaks into smaller loops. That spinning is what rotation does to a planet's atmosphere.")}
      ${keyIdea("Global atmospheric circulation forms cells: warm air rises at the equator and sinks in the subtropics (Hadley cell), creating deserts. The number and width of cells depend on how fast the planet spins.")}`,

      /* advanced */
      `<p>On a rotating planet, the Hadley cell width is set by the balance
        between angular momentum conservation and baroclinic instability.
        The Held-Hou model gives the poleward extent of the Hadley cell:</p>
      ${eq("\\phi_H \\approx \\left(\\frac{5\\;\\Delta_h\\;g\\;H}{3\\;\\Omega^2\\;a^2}\\right)^{1/2}")}
      ${vars([
        ["\\phi_H", "latitude of the Hadley cell edge (radians)"],
        ["\\Delta_h", "fractional equator-to-pole temperature contrast"],
        ["g", "surface gravity"],
        ["H", "scale height of the troposphere"],
        ["\\Omega", "planetary rotation rate"],
        ["a", "planetary radius"],
      ])}
      <p>Faster rotation (larger ${iq("\\Omega")}) compresses the Hadley
        cells equatorward, producing more cells across the globe. Slowly
        rotating worlds (like a tidally locked planet) may have a single
        Hadley-like cell extending nearly pole-to-pole.</p>
      ${dataTable(
        ["Rotation period", "Approximate cells per hemisphere", "Character"],
        [
          ["< 8 h", "5-7", "Many narrow bands, strong zonal jets"],
          ["~24 h (Earth-like)", "3", "Hadley + Ferrel + polar"],
          ["~240 h (Venus-like)", "1", "Single hemisphere-wide cell"],
          ["Tidally locked", "1 (radial)", "Substellar upwelling, anti-stellar subsidence"],
        ],
      )}
      ${cite("Held & Hou (1980, J. Atmos. Sci. 37, 515); Kaspi & Showman (2015, ApJ 804, 60)")}`,
      mode,
    ),

    /* 4 ── Moisture and Aridity ────────────────────────────────────── */
    concept(
      "Moisture and Aridity",
      /* basic */
      `<p>Where rain falls depends on where moisture comes from and where the
        atmosphere lifts or sinks. The main patterns are:</p>
      <ul>
        <li><strong>Coastlines are wetter.</strong> Oceans are the primary
            source of atmospheric moisture. Winds blowing off the ocean pick
            up water vapour and deliver it to coastal regions as rain.</li>
        <li><strong>Continental interiors are drier.</strong> By the time air
            masses travel deep into a continent, they have lost most of their
            moisture. Central Asia and interior Australia are dry for this
            reason.</li>
        <li><strong>Subtropical deserts.</strong> Where the Hadley cell's air
            sinks (~30\u00b0 latitude), the descending air is dry and warm,
            suppressing rainfall. This produces the Sahara, Arabian, and
            Australian deserts.</li>
        <li><strong>Rain shadows.</strong> When moist air is forced over a
            mountain range, it dumps its rain on the windward side, leaving
            the leeward side dry.</li>
      </ul>
      ${keyIdea("Coastlines are wet, continental interiors are dry, and the subtropics are desert belts where sinking air suppresses rainfall. Mountains create additional dry zones on their leeward sides.")}`,

      /* advanced */
      `<p>Precipitation patterns on a terrestrial world are governed by the
        moisture budget. A simple moisture index ${iq("MI")} compares
        precipitation to potential evapotranspiration:</p>
      ${eq("MI = \\frac{P}{PET}")}
      ${vars([
        ["MI", "moisture index"],
        ["P", "annual precipitation (mm/yr)"],
        ["PET", "potential evapotranspiration (mm/yr)"],
      ])}
      <p>K\u00f6ppen class B (arid) is assigned when ${iq("MI < 1")}
        after accounting for seasonal distribution. The global moisture
        pattern depends on:</p>
      <ul>
        <li><strong>Water fraction:</strong> higher ocean coverage increases
            global mean precipitation roughly linearly up to ~80%
            ocean fraction.</li>
        <li><strong>Continental geometry:</strong> large contiguous landmasses
            create extensive rain shadows and continental interiors with
            ${iq("MI \\ll 1")}.</li>
        <li><strong>Circulation cells:</strong> subsidence zones (Hadley cell
            descending branches) create subtropical arid belts. Their
            latitude shifts with obliquity and rotation rate.</li>
      </ul>
      <p>On worlds with higher surface pressure, the water-vapour carrying
        capacity of the atmosphere increases (Clausius-Clapeyron relation:
        ~7% per K), intensifying the hydrological cycle and increasing
        both peak precipitation and drought severity.</p>
      ${cite("Peel, Finlayson & McMahon (2007, Hydrol. Earth Syst. Sci. 11, 1633); Abe et al. (2011, Astrobiology 11, 443)")}`,
      mode,
    ),

    /* 5 ── Tidally Locked Climates ─────────────────────────────────── */
    concept(
      "Tidally Locked Climates",
      /* basic */
      `<p>Some planets always show the same face to their star, just as the
        Moon always shows the same face to Earth. One hemisphere is in
        permanent daylight, the other in perpetual night.</p>
      <p>This creates extreme climate contrasts. The dayside directly
        beneath the star (the <strong>substellar point</strong>) bakes
        under relentless radiation, while the nightside can plunge far
        below freezing. Whether such a world is habitable depends on
        whether its atmosphere can transport enough heat from day to night
        to prevent the nightside from freezing out the entire atmosphere.</p>
      <p>If the atmosphere is thick enough, it acts as a conveyor belt,
        carrying heat from the bright side to the dark side. Models suggest
        this could produce a ring-shaped habitable zone around the
        terminator (the boundary between day and night), sometimes called
        an "eyeball Earth" pattern — a circular ocean of open water
        surrounded by ice.</p>
      ${analogy("Imagine holding one side of a ball against a heat lamp while the other side faces a freezer. If you wrap the ball in a thick blanket (atmosphere), the blanket can move heat around and keep both sides closer to the same temperature.")}
      ${keyIdea("Tidally locked worlds have a permanent dayside and nightside. A sufficiently thick atmosphere can redistribute heat, creating a potentially habitable ring near the terminator — the 'eyeball Earth' pattern.")}`,

      /* advanced */
      `<p>The climate of a synchronously rotating planet is dominated by
        the substellar-antistellar temperature contrast, which depends on
        atmospheric heat transport efficiency. The substellar equilibrium
        temperature is:</p>
      ${eq("T_\\text{sub} = \\left(\\frac{(1 - A_B)\\;F_\\star}{\\sigma}\\right)^{1/4}")}
      ${vars([
        ["T_\\text{sub}", "substellar point temperature"],
        ["A_B", "Bond albedo"],
        ["F_\\star", "stellar flux at the planet's orbit"],
        ["\\sigma", "Stefan-Boltzmann constant"],
      ])}
      <p>Without atmospheric heat transport, the nightside temperature
        drops to the cosmic microwave background (~2.7 K). With transport,
        the day-night contrast ${iq("\\Delta T_{\\text{dn}}")} is reduced
        approximately as:</p>
      ${eq("\\Delta T_{\\text{dn}} \\propto \\frac{1}{1 + \\alpha\\;(p_s / p_0)^{n}}")}
      ${vars([
        ["\\Delta T_{\\text{dn}}", "day-night temperature contrast"],
        ["p_s", "surface pressure"],
        ["p_0", "reference pressure (1 bar)"],
        ["\\alpha,\\;n", "empirical fit parameters from GCM studies"],
      ])}
      <p>GCM simulations (Leconte et al. 2013; Pierrehumbert 2011) show
        that even ~0.1 bar of N${iq("_2")}-CO${iq("_2")} atmosphere can
        prevent atmospheric collapse on the nightside. The "eyeball"
        pattern emerges when the substellar ocean remains ice-free while
        the nightside and high latitudes are glaciated.</p>
      <p>Slow atmospheric waves (equatorial Kelvin and Rossby waves) set
        the large-scale circulation pattern, with strong superrotation at
        the equator in many GCM solutions.</p>
      ${cite("Pierrehumbert (2011, ApJL 726, L8); Leconte et al. (2013, A&A 554, A69); Yang, Cowan & Abbot (2013, ApJL 771, L45)")}`,
      mode,
    ),
  ].join("");
}
