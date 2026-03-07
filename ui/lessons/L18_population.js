// SPDX-License-Identifier: MPL-2.0
/**
 * Lesson 18 — Population & Civilisation
 *
 * Covers carrying capacity, the land-use cascade, technology eras and
 * density, and logistic population growth.  No interactive calculator.
 */

import { concept, analogy, keyIdea, eq, iq, vars, cite, dataTable } from "./helpers.js";

/* ── build ─────────────────────────────────────────────────────────── */

export function buildLesson18(mode) {
  return [
    /* 1 ── Carrying Capacity ───────────────────────────────────────── */
    concept(
      "Carrying Capacity",
      /* basic */
      `<p>Every world has a limit to how many people it can support. That
        limit is called the <strong>carrying capacity</strong>, and it
        depends on how much productive land is available and how efficiently
        the civilisation uses it.</p>
      <p>A small, arid world with thin soil will support far fewer people
        than a large, fertile world with abundant water. Technology matters
        too -- the same land can feed many more people with irrigation and
        crop rotation than with basic foraging.</p>
      ${analogy("Think of a farm. It can only feed so many people, no matter how hungry they are. Add better tools or fertiliser and the farm feeds more, but there is always an upper bound set by the land itself.")}
      ${keyIdea("Carrying capacity is the maximum population the land can support. It depends on the amount of productive land and the technology level of the civilisation.")}`,

      /* advanced */
      `<p>Carrying capacity ${iq("K")} is modelled as the product of
        productive land area and sustainable population density:</p>
      ${eq("K = A_{\\text{prod}} \\times \\rho_{\\text{era}}")}
      ${vars([
        ["K", "carrying capacity (total population)"],
        ["A_{\\text{prod}}", "productive land area (km^2)"],
        [
          "\\rho_{\\text{era}}",
          "sustainable population density for the technology era (people/km^2)",
        ],
      ])}
      <p>The productive area is derived through the <strong>land-use
        cascade</strong> (see next section), which progressively filters
        the total planetary surface down to the fraction that can actually
        grow food or support habitation.</p>
      <p>Different technology levels support vastly different densities on
        the same land, from hunter-gatherer bands at ~0.05/km${iq("^2")}
        to high-tech civilisations at 500--1000/km${iq("^2")} or more.</p>
      ${cite("Cohen (1995), How Many People Can the Earth Support?, Norton; Boserup (1965), The Conditions of Agricultural Growth")}`,
      mode,
    ),

    /* 2 ── Land Use Cascade ────────────────────────────────────────── */
    concept(
      "Land Use Cascade",
      /* basic */
      `<p>Not all of a planet's surface is useful. To figure out how much
        land is actually productive, you subtract all the areas that cannot
        support agriculture or habitation:</p>
      <ul>
        <li><strong>Oceans:</strong> Most of the surface may be water. On
            Earth, about 71% is ocean.</li>
        <li><strong>Deserts and ice:</strong> Extreme arid zones and polar
            ice caps are too harsh for farming.</li>
        <li><strong>Mountains and badlands:</strong> Steep, rocky terrain
            is difficult to cultivate.</li>
        <li><strong>Forests and wetlands:</strong> Some of these can be
            converted, but at ecological cost.</li>
      </ul>
      <p>What remains is the productive land. On Earth, roughly 10--12% of
        the total surface is arable farmland. A civilisation that develops
        crops (rather than relying on hunting and gathering) can feed about
        four times more people per unit area.</p>
      ${analogy("Imagine pouring water through a series of sieves, each with a finer mesh. You start with the total surface area and each sieve removes another category of unusable land. What drips through at the end is the productive land.")}
      ${keyIdea("The land-use cascade filters total surface through ocean fraction, climate habitability, terrain, and aridity to arrive at the productive land area.")}`,

      /* advanced */
      `<p>The cascade multiplies successive reduction fractions:</p>
      ${eq("A_{\\text{prod}} = A_{\\text{total}} \\times (1 - f_w) \\times f_{\\text{hab}} \\times f_{\\text{arable}} \\times f_{\\text{crop}}")}
      ${vars([
        ["A_{\\text{total}}", "total planetary surface area"],
        ["f_w", "ocean/water fraction"],
        [
          "f_{\\text{hab}}",
          "fraction of land in habitable climate zones (exclude K\u00f6ppen E and X)",
        ],
        [
          "f_{\\text{arable}}",
          "fraction of habitable land that is arable (from aridity index, terrain)",
        ],
        [
          "f_{\\text{crop}}",
          "crop efficiency multiplier (~4 for agricultural vs pastoral land use)",
        ],
      ])}
      <p>Typical Earth values for reference:</p>
      ${dataTable(
        ["Stage", "Fraction", "Remaining area"],
        [
          ["Total surface", "1.00", "510 M km\\(^2\\)"],
          ["Subtract oceans (71%)", "0.29", "149 M km\\(^2\\)"],
          ["Habitable zones (~75% of land)", "0.22", "112 M km\\(^2\\)"],
          ["Arable fraction (~35% of habitable)", "0.076", "39 M km\\(^2\\)"],
          [
            "Crop efficiency (\\times 4)",
            "0.076 (effective \\times 4)",
            "~156 M km\\(^2\\) effective",
          ],
        ],
      )}
      <p>The water fraction ${iq("f_w")} is derived from the planet's
        water regime. Habitability is determined by climate zone
        modelling. The aridity filter uses the moisture index
        ${iq("MI = P / PET")} to exclude land where precipitation is
        insufficient for agriculture.</p>
      ${cite("Ramankutty et al. (2008, Global Biogeochem. Cycles 22, GB1003); FAO (2011), State of the World's Land and Water Resources")}`,
      mode,
    ),

    /* 3 ── Technology Eras ─────────────────────────────────────────── */
    concept(
      "Technology Eras",
      /* basic */
      `<p>How many people can live on a given piece of land depends
        enormously on technology. A hunter-gatherer band needs a vast
        territory -- perhaps 20 square kilometres per person. An
        industrial city packs thousands of people into a single square
        kilometre.</p>
      <p>As civilisations advance, they unlock new ways to extract more
        food and resources from the same land: agriculture, irrigation,
        fertilisers, mechanised farming, and eventually synthetic food
        production.</p>
      ${keyIdea("Technology eras dramatically change population density. Hunter-gatherers need huge territories; industrial and high-tech civilisations support vastly denser populations.")}`,

      /* advanced */
      `<p>Population density and intrinsic growth rate vary by technology
        era:</p>
      ${dataTable(
        ["Era", "Density (people/km\\(^2\\))", "Growth rate \\(r\\) (per year)", "Notes"],
        [
          ["Hunter-gatherer", "0.05", "0.0005", "Nomadic, low surplus"],
          ["Early agricultural", "5", "0.002", "Settled farming, animal husbandry"],
          ["Advanced agricultural", "30", "0.005", "Irrigation, crop rotation"],
          ["Early industrial", "100", "0.01", "Mechanised farming, urbanisation"],
          ["Industrial", "300", "0.015", "Fertiliser, transport networks"],
          ["Post-industrial", "500", "0.005", "Demographic transition, declining birth rates"],
          ["Sci-fi high", "1000", "0.001", "Arcologies, synthetic food, vertical farming"],
        ],
      )}
      <p>The growth rate ${iq("r")} represents the intrinsic rate of
        natural increase (births minus deaths) at low population density.
        It rises through the industrial era as sanitation and medicine
        improve, then falls during the demographic transition as birth
        rates decline.</p>
      <p>The density values represent sustainable maxima -- the effective
        ${iq("\\rho_{\\text{era}}")} used in the carrying capacity
        formula. Actual settled density in cities can be much higher, but
        agricultural hinterland must be included in the average.</p>
      ${cite("Boserup (1965), The Conditions of Agricultural Growth; Kremer (1993, QJE 108, 681)")}`,
      mode,
    ),

    /* 4 ── Logistic Growth ─────────────────────────────────────────── */
    concept(
      "Logistic Growth",
      /* basic */
      `<p>When a population has plenty of resources, it grows exponentially
        -- each generation is larger than the last. But as the population
        approaches the carrying capacity, resources become scarce, growth
        slows, and eventually the population levels off.</p>
      <p>This produces an <strong>S-shaped curve</strong>: slow growth at
        first (when the population is small), then rapid growth in the
        middle, then a plateau near the carrying capacity.</p>
      <p>Plagues, famines, and wars can temporarily push the population
        below carrying capacity, after which it recovers. A technology
        leap raises the carrying capacity itself, allowing a new phase of
        growth until the new limit is reached.</p>
      ${analogy("Growth is like filling a room with people. At first there is plenty of space and people enter freely. As the room fills, it gets harder to find space, and eventually no more can fit. The room's size is the carrying capacity.")}
      ${keyIdea("Population growth follows an S-curve: exponential at first, then slowing as it approaches the carrying capacity. Technology shifts raise the ceiling, allowing new growth.")}`,

      /* advanced */
      `<p>The <strong>Verhulst logistic equation</strong> (1838) models
        population growth with a carrying capacity constraint:</p>
      ${eq("\\frac{dP}{dt} = r\\,P\\left(1 - \\frac{P}{K}\\right)")}
      <p>The analytical solution is:</p>
      ${eq("P(t) = \\frac{K}{1 + \\left(\\frac{K - P_0}{P_0}\\right) e^{-r t}}")}
      ${vars([
        ["P(t)", "population at time t"],
        ["P_0", "initial population"],
        ["K", "carrying capacity"],
        ["r", "intrinsic growth rate (per unit time)"],
        ["t", "time"],
      ])}
      <p>Key properties of the logistic curve:</p>
      <ul>
        <li>Inflection point at ${iq("P = K/2")}, where growth rate is
            maximum.</li>
        <li>Time to reach half carrying capacity:
            ${iq("t_{1/2} = \\frac{1}{r}\\ln\\!\\left(\\frac{K - P_0}{P_0}\\right)")}.</li>
        <li>The curve is symmetric about the inflection point on a log
            scale.</li>
      </ul>
      <p>In practice, civilisations transition through technology eras,
        each with its own ${iq("K")} and ${iq("r")}. The population
        history is a sequence of logistic segments stitched together at
        transition points.</p>
      ${cite("Verhulst (1838, Corresp. Math. Phys. 10, 113); Gotelli (2008), A Primer of Ecology, 4th ed., Sinauer")}`,
      mode,
    ),
  ].join("");
}
