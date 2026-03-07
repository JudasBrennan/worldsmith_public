// SPDX-License-Identifier: MPL-2.0
import { concept, analogy, keyIdea, eq, iq, vars, cite, dataTable } from "./helpers.js";

/**
 * Lesson 09 — Atmospheres
 * Scale height, composition, escape, pressure, and circulation.
 */
export function buildLesson09(mode) {
  return [
    /* ── 1. What Is an Atmosphere? ── */
    concept(
      "What Is an Atmosphere?",
      `<p>An atmosphere is a layer of gas held around a planet by gravity. It is,
      in effect, an invisible ocean of air surrounding the solid or liquid
      surface below. Not every body in space has one: the planet must have
      enough gravity to hold onto gas, and the gas must not be too hot (fast)
      to escape into space.</p>
      <p>Small, hot bodies lose their atmospheres quickly. The Moon, for
      example, is too small and too exposed to the Sun's heat to retain any
      meaningful atmosphere. Earth, being larger and at a moderate temperature,
      holds onto a thick blanket of nitrogen and oxygen.</p>
      ${analogy("An atmosphere is like an invisible ocean above your head. Just as water pressure increases with depth in the sea, air pressure increases as you descend toward the surface. The planet's gravity is what keeps this ocean of gas from drifting away.")}
      ${keyIdea("A planet needs sufficient gravity and low enough temperature to hold an atmosphere. Bigger, cooler planets retain gas more easily.")}`,

      `<p>The vertical structure of an atmosphere is characterised by the
      <b>scale height</b>, the altitude over which pressure drops by a factor
      of ${iq("e \\approx 2.718")}:</p>
      ${eq("H = \\frac{k_B T}{m g}")}
      ${vars([
        ["H", "scale height (m)"],
        ["k_B", "Boltzmann constant (1.381 x 10⁻²³ J/K)"],
        ["T", "atmospheric temperature (K)"],
        ["m", "mean molecular mass of atmospheric gas (kg)"],
        ["g", "surface gravitational acceleration (m/s²)"],
      ])}
      <p>For Earth, ${iq("H \\approx 8.5")} km. A heavier mean molecular
      weight or stronger gravity compresses the atmosphere into a thinner
      layer; higher temperatures puff it up.</p>
      <p><b>Jeans escape</b> sets the thermal boundary for atmospheric
      retention. Gas molecules in the exosphere with speeds exceeding the
      escape velocity are lost to space. The <b>Jeans parameter</b> is:</p>
      ${eq("\\lambda = \\frac{G M m}{k_B T r_{\\text{exo}}}")}
      <p>When ${iq("\\lambda \\gtrsim 6")}, the species is well-retained over
      geological timescales.</p>
      ${cite("Catling, D. C. & Kasting, J. F. (2017), Atmospheric Evolution on Inhabited and Lifeless Worlds, Cambridge.")}`,
      mode,
    ),

    /* ── 2. Atmospheric Composition ── */
    concept(
      "Atmospheric Composition",
      `<p>Different planets have very different atmospheric recipes. Earth's air
      is about 78% nitrogen (N₂) and 21% oxygen (O₂), with small amounts of
      argon, carbon dioxide, and water vapour. Venus has a thick CO₂
      atmosphere. Mars has a thin CO₂ atmosphere. The gas giants are mostly
      hydrogen and helium.</p>
      <p>The mix depends on several factors: what gases were released from the
      planet's interior (outgassing), what has been lost to space over time,
      and what chemical reactions have occurred on the surface and in the
      atmosphere. Earth's oxygen, for example, is almost entirely a product
      of photosynthesis by living organisms.</p>
      ${analogy("A planet's atmosphere is like a recipe that changes over time. The original ingredients come from volcanic outgassing (like opening a shaken soda bottle). Over billions of years, some ingredients escape, some react with the surface, and life can add entirely new ones.")}
      ${keyIdea("Atmospheric composition is shaped by outgassing (volcanoes), escape to space, surface chemistry, and biology. Earth's oxygen is a biosignature.")}`,

      `<p>Primary atmospheres (captured from the nebula) are dominated by H₂
      and He. Secondary atmospheres form from outgassing during and after
      accretion. The redox state of the mantle determines the initial
      outgassing mix:</p>
      ${dataTable(
        ["Mantle redox state", "Dominant gases", "Example"],
        [
          ["Highly reduced", "H₂, CH₄, NH₃", "Early Earth (possibly)"],
          ["Moderately reduced", "CO₂, H₂O, N₂, CO", "Venus, Mars"],
          ["Oxidised", "CO₂, H₂O, N₂, SO₂", "Present-day Earth volcanoes"],
        ],
      )}
      <p>Ortenzi et al. (2020) showed that the mantle's oxygen fugacity, which
      correlates with stellar Fe/Mg ratios, controls whether outgassed
      carbon is primarily CO₂ or CO/CH₄. This has direct implications for
      greenhouse warming and spectroscopic biosignatures.</p>
      <p>Earth's present atmosphere is strongly modified by biology:</p>
      ${dataTable(
        ["Gas", "Fraction", "Source"],
        [
          ["N₂", "78.08%", "Outgassing, denitrification"],
          ["O₂", "20.95%", "Photosynthesis"],
          ["Ar", "0.93%", "⁴⁰K decay"],
          ["CO₂", "0.042%", "Volcanism, respiration"],
          ["H₂O", "0-4%", "Evaporation (variable)"],
        ],
      )}
      ${cite("Ortenzi, G. et al. (2020), Sci. Rep. 10, 10907.")}`,
      mode,
    ),

    /* ── 3. Atmospheric Escape ── */
    concept(
      "Atmospheric Escape",
      `<p>Over billions of years, planets can lose some or all of their
      atmosphere. The lightest gases (hydrogen and helium) are the first to
      go, because their molecules move the fastest at any given temperature.
      This is why Earth has almost no free hydrogen in its atmosphere, even
      though hydrogen is the most common element in the universe.</p>
      <p>There are several ways a planet loses gas:</p>
      <ul>
        <li><b>Thermal escape:</b> Hot gas molecules at the top of the atmosphere
        move fast enough to overcome gravity.</li>
        <li><b>Solar wind stripping:</b> Charged particles from the star can
        knock atmospheric molecules into space, especially if the planet
        lacks a magnetic field.</li>
        <li><b>Photodissociation:</b> Ultraviolet light from the star breaks
        molecules apart, and the lighter fragments escape.</li>
      </ul>
      ${analogy("Imagine a ball pit where the balls are constantly bouncing. The lightest, bounciest balls occasionally jump high enough to fly out of the pit entirely. Over time, only the heavier balls remain. That is thermal atmospheric escape.")}
      ${keyIdea("Light gases escape first. A planet needs strong gravity and a magnetic shield to keep its atmosphere intact over billions of years.")}`,

      `<p>Atmospheric escape operates through several mechanisms, each dominant
      under different conditions:</p>
      <p><b>Jeans (thermal) escape:</b> The high-velocity tail of the
      Maxwell-Boltzmann distribution exceeds the escape speed. Significant
      when the Jeans parameter ${iq("\\lambda < 6")} for a given species:</p>
      ${eq("\\lambda = \\frac{v_{\\text{esc}}^2}{v_{\\text{thermal}}^2} = \\frac{G M m}{k_B T r_{\\text{exo}}}")}
      <p><b>Hydrodynamic escape:</b> When the upper atmosphere is heated
      intensely (by extreme ultraviolet / XUV radiation), it can expand and
      flow outward as a bulk wind, dragging heavier species along. This is
      energy-limited rather than particle-limited:</p>
      ${eq("\\dot{M} \\approx \\frac{\\epsilon \\pi R_{\\text{XUV}}^2 F_{\\text{XUV}}}{G M / R}")}
      ${vars([
        ["\\dot{M}", "mass loss rate (kg/s)"],
        ["\\epsilon", "heating efficiency (~0.1-0.6)"],
        ["R_{\\text{XUV}}", "effective absorption radius"],
        ["F_{\\text{XUV}}", "XUV flux at the planet (W/m²)"],
      ])}
      <p><b>Ion pickup / sputtering:</b> The stellar wind interacts with the
      upper atmosphere. Without a magnetic field, ions are picked up by the
      wind and carried away. Mars loses about 100 g/s of atmosphere this way
      today.</p>
      ${dataTable(
        ["Mechanism", "Dominates when", "Key species lost"],
        [
          ["Jeans escape", "Low gravity, warm exosphere", "H, He"],
          ["Hydrodynamic", "Intense XUV, close-in orbit", "All (bulk flow)"],
          ["Ion pickup", "Weak/no magnetic field", "O⁺, CO₂⁺"],
          ["Photodissociation", "Strong UV", "H (from H₂O splitting)"],
        ],
      )}
      ${cite("Owen, J. E. (2019), Ann. Rev. Earth Planet. Sci. 47, 67.")}`,
      mode,
    ),

    /* ── 4. Atmospheric Pressure and Circulation ── */
    concept(
      "Atmospheric Pressure and Circulation",
      `<p>Surface atmospheric pressure varies enormously between planets. Mars
      has a surface pressure about 0.6% of Earth's, while Venus has roughly
      92 times Earth's pressure. Pressure affects whether liquid water can
      exist, how sound travels, and what the weather is like.</p>
      <p>Atmospheres also circulate, moving heat from warm regions (near the
      equator) to cold regions (near the poles). On Earth, this circulation
      forms three large cells in each hemisphere:</p>
      <ul>
        <li>The <b>Hadley cell</b> near the equator: warm air rises, flows
        toward the poles at altitude, then sinks at about 30 degrees
        latitude.</li>
        <li>The <b>Ferrel cell</b> at mid-latitudes: driven by the other two
        cells, it moves air in the opposite direction.</li>
        <li>The <b>polar cell</b>: cold air sinks at the pole and flows toward
        mid-latitudes at the surface.</li>
      </ul>
      ${analogy("Atmospheric circulation is like a conveyor belt system. Hot air rises at the equator, travels toward the poles at high altitude, cools and sinks, then returns along the surface. The planet's spin divides this into separate belts.")}
      ${keyIdea("Air pressure determines what can exist as liquid on the surface. Circulation cells distribute heat and create predictable wind and weather patterns.")}`,

      `<p>Surface pressure ${iq("P_s")} is determined by the total column mass
      of the atmosphere per unit area:</p>
      ${eq("P_s = \\frac{M_{\\text{atm}} \\, g}{4 \\pi R^2}")}
      ${vars([
        ["P_s", "surface pressure (Pa)"],
        ["M_{\\text{atm}}", "total atmospheric mass (kg)"],
        ["g", "surface gravity (m/s²)"],
        ["R", "planet radius (m)"],
      ])}
      <p><b>Circulation cells:</b> The number of meridional circulation cells
      depends on the planet's rotation rate. Slowly rotating planets tend to
      have a single Hadley cell extending from equator to pole in each
      hemisphere. Faster rotation breaks the circulation into multiple
      cells.</p>
      <p>An approximate scaling for the number of cells per hemisphere:</p>
      ${eq("N_{\\text{cells}} \\approx \\left(\\frac{\\Omega}{\\Omega_\\oplus}\\right)^{1/2}")}
      ${vars([
        ["N_{\\text{cells}}", "number of circulation cells per hemisphere"],
        ["\\Omega", "planetary rotation rate"],
        ["\\Omega_\\oplus", "Earth's rotation rate"],
      ])}
      ${dataTable(
        ["Planet", "P_surface", "Rotation period", "Cells/hemisphere"],
        [
          ["Venus", "92 atm", "243 days", "1 (single Hadley)"],
          ["Earth", "1 atm", "1 day", "3 (Hadley/Ferrel/polar)"],
          ["Mars", "0.006 atm", "1.03 days", "3 (similar to Earth)"],
          ["Jupiter", "---", "0.41 days", "~6-8 (many bands)"],
        ],
      )}
      <p>The Hadley cell width is approximately ${iq("\\phi_H \\sim (\\Delta_h / \\Omega^2 a)^{1/2}")}, where ${iq("\\Delta_h")} is the fractional equator-to-pole temperature contrast and ${iq("a")} is the planet radius.</p>
      ${cite("Showman, A. P., Wordsworth, R. D., Merlis, T. M., & Kaspi, Y. (2013), in Comparative Climatology of Terrestrial Planets, Univ. of Arizona Press.")}`,
      mode,
    ),
  ].join("");
}
