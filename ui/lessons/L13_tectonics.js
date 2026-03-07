// SPDX-License-Identifier: MPL-2.0
/**
 * Lesson 13 — Interiors & Tectonics
 *
 * Covers plate tectonics and tectonic regimes, mountain building,
 * volcanism, lithosphere thickness, and radiogenic heating.
 * No interactive calculator for this lesson.
 */

import { concept, analogy, keyIdea, eq, iq, vars, cite, dataTable } from "./helpers.js";

/* ── build ─────────────────────────────────────────────────────────── */

export function buildLesson13(mode) {
  return [
    /* 1 ── Plate Tectonics ─────────────────────────────────────────── */
    concept(
      "Plate Tectonics",
      /* basic */
      `<p>The ground beneath your feet is not as solid as it seems. Earth's
        outer shell is cracked into enormous slabs called <strong>tectonic
        plates</strong> that drift slowly over the hotter, softer rock
        below. These plates move only a few centimetres per year, but over
        millions of years they rearrange continents, open and close oceans,
        and build mountain ranges.</p>
      <p>Not all rocky planets have plate tectonics. Mars and the Moon have
        a single, unbroken shell. Venus may have had active plates in the
        past but appears locked today. Earth is the only world in our solar
        system with confirmed, ongoing plate tectonics.</p>
      ${analogy("Imagine a cracked eggshell floating on a soft-boiled interior. The shell pieces slide around, bump into each other, and sometimes one piece dives under another. That is plate tectonics in miniature.")}
      ${keyIdea("Earth's surface is broken into moving plates that drift, collide, and dive beneath one another. This process shapes continents, drives earthquakes, and recycles the crust.")}`,

      /* advanced */
      `<p>Plate tectonics (mobile-lid convection) requires a specific balance
        between mantle viscosity, lithospheric yield stress, and internal
        heat flow. Whether a rocky planet develops mobile-lid tectonics
        depends on several factors:</p>
      <ul>
        <li><strong>Mass:</strong> Super-Earths (1-5 ${iq("M_\\oplus")}) may
            favour stagnant-lid behaviour due to higher lithospheric
            pressure, though the issue remains debated.</li>
        <li><strong>Surface temperature:</strong> Water weakens silicates and
            lubricates subduction zones, making plate tectonics more likely
            on worlds with surface liquid water.</li>
        <li><strong>Internal heating:</strong> Sufficient radiogenic and
            primordial heat must drive convective vigour above the critical
            threshold for plate failure.</li>
      </ul>
      <p>Three tectonic regimes are recognised in mantle convection models:</p>
      ${dataTable(
        ["Regime", "Description", "Examples"],
        [
          ["Mobile lid", "Plates form, subduct, and recycle", "Earth"],
          ["Stagnant lid", "Single rigid shell; heat escapes via volcanism", "Mars, Moon, Mercury"],
          [
            "Episodic",
            "Long stagnant phases punctuated by catastrophic resurfacing",
            "Venus (hypothesised)",
          ],
        ],
      )}
      ${cite("O'Neill & Lenardic (2007, GRL 34, L19204); Valencia, O'Connell & Sasselov (2007, ApJL 670, L45)")}`,
      mode,
    ),

    /* 2 ── Tectonic Regimes ────────────────────────────────────────── */
    concept(
      "Tectonic Regimes",
      /* basic */
      `<p>Rocky worlds come in three flavours depending on how their outer
        shells behave:</p>
      <ul>
        <li><strong>Mobile lid</strong> (like Earth) — the crust is broken
            into plates that move, collide, and recycle back into the
            interior. This drives mountain building, volcanism, and the
            carbon cycle.</li>
        <li><strong>Stagnant lid</strong> (like Mars) — the crust is a
            single solid shell that does not move. Heat escapes through
            volcanic hot spots and conduction, but there is no plate
            recycling. Volcanoes can grow enormous because the crust never
            moves off the hot spot.</li>
        <li><strong>Episodic</strong> (possibly Venus) — the crust stays
            frozen for long stretches, then suddenly overturns in a
            catastrophic resurfacing event before freezing again.</li>
      </ul>
      ${keyIdea("A planet's tectonic regime determines whether it has earthquakes and moving continents (mobile lid), a single unmoving shell (stagnant lid), or dramatic periodic overturn events (episodic).")}`,

      /* advanced */
      `<p>The transition between regimes is controlled by the effective
        Rayleigh number and the ratio of lithospheric yield stress to
        convective stress. Numerical models (Moresi &amp; Solomatov 1998)
        identify the critical parameters:</p>
      ${eq("Ra_\\text{eff} = \\frac{\\rho\\,g\\,\\alpha\\,\\Delta T\\,d^3}{\\kappa\\,\\eta_\\text{ref}}")}
      ${vars([
        ["Ra_\\text{eff}", "effective Rayleigh number"],
        ["\\rho", "mantle density"],
        ["g", "surface gravity"],
        ["\\alpha", "thermal expansivity"],
        ["\\Delta T", "temperature contrast across the mantle"],
        ["d", "mantle thickness"],
        ["\\kappa", "thermal diffusivity"],
        ["\\eta_\\text{ref}", "reference viscosity"],
      ])}
      <p>Mobile-lid convection requires that convective stresses exceed the
        lithospheric yield stress. Factors favouring mobile lid include:</p>
      <ul>
        <li>Moderate planet mass (0.5-2 ${iq("M_\\oplus")}) — high enough
            for vigorous convection, low enough for plate failure.</li>
        <li>Surface water — reduces silicate yield stress by an order
            of magnitude.</li>
        <li>Young age — higher radiogenic heating drives stronger
            convection.</li>
      </ul>
      <p>Episodic behaviour arises near the mobile-to-stagnant transition:
        the lid thickens until the underlying mantle becomes hot enough to
        trigger sudden overturn. Venus's relatively uniform crater
        distribution (~500 Myr mean surface age) is consistent with episodic
        resurfacing.</p>
      ${cite("Moresi & Solomatov (1998, GJI 133, 669); Lenardic et al. (2008, EPSL 271, 34)")}`,
      mode,
    ),

    /* 3 ── Mountain Building ───────────────────────────────────────── */
    concept(
      "Mountain Building",
      /* basic */
      `<p>When tectonic plates collide, rock crumples upward to form
        mountains. The type of collision determines the kind of mountains
        that result:</p>
      <ul>
        <li><strong>Ocean-continent collision</strong> (Andean type) — oceanic
            crust dives under continental crust, pushing up a volcanic
            mountain chain like the Andes.</li>
        <li><strong>Continent-continent collision</strong> (Himalayan type) —
            two continents collide head-on, crumpling and folding enormous
            mountain ranges like the Himalayas.</li>
        <li><strong>Ancient suture zones</strong> (Ural type) — old collision
            boundaries that have been eroded down to modest elevations.</li>
        <li><strong>Flat-slab subduction</strong> (Laramide type) — the
            diving plate slides at a shallow angle, transmitting stress
            far inland and raising mountains well away from the plate
            boundary, like the Rocky Mountains.</li>
      </ul>
      ${analogy("Push two towels together across a table. They bunch up and fold where they meet — that folding is how continental collisions build mountains.")}
      ${keyIdea("Mountains form where plates collide. The collision style (oceanic vs continental, steep vs shallow) determines the mountain range's character.")}`,

      /* advanced */
      `<p>Peak mountain height on a rocky world is ultimately limited by
        gravity. The maximum elevation ${iq("h_\\text{max}")} a mountain
        can sustain before the rock at its base reaches the compressive
        yield strength ${iq("\\sigma_y")} is:</p>
      ${eq("h_\\text{max} \\approx \\frac{\\sigma_y}{\\rho\\,g}")}
      ${vars([
        ["h_\\text{max}", "maximum sustainable peak height"],
        ["\\sigma_y", "compressive yield strength of crustal rock (~100-300 MPa for granite)"],
        ["\\rho", "crustal density (~2700 kg/m^3)"],
        ["g", "surface gravity"],
      ])}
      <p>For Earth (${iq("g = 9.8")} m/s${iq("^2")}), this gives
        ${iq("h_\\text{max} \\approx")} 10-15 km, consistent with the
        Himalayan peaks (~8.8 km, limited by erosion). For Mars
        (${iq("g = 3.7")} m/s${iq("^2")}), the limit rises to ~25 km,
        supporting Olympus Mons (21.9 km).</p>
      ${dataTable(
        ["Archetype", "Mechanism", "Example", "Typical peak (km)"],
        [
          ["Andean", "Oceanic-continental subduction", "Andes", "6-7"],
          ["Himalayan", "Continental collision", "Himalayas", "8-9"],
          ["Laramide", "Flat-slab subduction", "Rockies", "4-5"],
          ["Ural", "Ancient suture erosion", "Urals", "1-2"],
        ],
      )}
      ${cite("Weissel & Karner (1989, JGR 94, 13919); Koons (1989, Geology 17, 78)")}`,
      mode,
    ),

    /* 4 ── Volcanism ───────────────────────────────────────────────── */
    concept(
      "Volcanism",
      /* basic */
      `<p>Volcanoes form where magma from the planet's interior reaches the
        surface. On Earth, most volcanoes are found at plate boundaries
        (especially subduction zones) and over hot spots — plumes of
        especially hot mantle material.</p>
      <p>Volcano shape depends on the type of eruption:</p>
      <ul>
        <li><strong>Shield volcanoes</strong> are broad and gently sloped,
            built by fluid lava flows (like Hawaii's Mauna Loa).</li>
        <li><strong>Stratovolcanoes</strong> are steep and cone-shaped,
            built by alternating layers of lava and ash from explosive
            eruptions (like Mount Fuji).</li>
      </ul>
      <p>Volcanoes can grow taller on worlds with weaker gravity. Mars has
        Olympus Mons, the tallest volcano in the solar system at nearly
        22 km, partly because Mars's lower gravity allows taller
        structures and partly because the stagnant lid keeps the crust
        stationary over the hot spot.</p>
      ${keyIdea("Volcanoes are taller on smaller worlds with weaker gravity. A stagnant-lid planet allows volcanoes to grow even larger because the crust stays fixed above the magma source.")}`,

      /* advanced */
      `<p>Maximum volcanic edifice height is governed by two limiting
        mechanisms:</p>
      <ul>
        <li><strong>Flexural limit:</strong> the weight of the volcano
            deflects the lithosphere downward. A thicker, stronger
            lithosphere supports taller structures.</li>
        <li><strong>Basal spreading:</strong> the gravitational load
            causes the volcano's base to spread laterally, like a pile
            of wet sand. Height is limited when the basal stress exceeds
            the rock's yield strength.</li>
      </ul>
      ${eq("h_\\text{flex} \\propto \\frac{T_e^{3/4}}{(\\rho\\,g)^{1/4}}")}
      ${eq("h_\\text{spread} \\approx \\frac{\\sigma_y}{\\rho\\,g}")}
      ${vars([
        ["h_\\text{flex}", "flexural height limit"],
        ["T_e", "effective elastic lithosphere thickness"],
        ["h_\\text{spread}", "basal spreading height limit"],
        ["\\sigma_y", "basal rock yield strength"],
      ])}
      <p>On stagnant-lid worlds the plate stays fixed over the magma source,
        allowing a single edifice to accumulate material over hundreds of
        millions of years (cf. Olympus Mons). On mobile-lid worlds the
        plate moves off the hot spot, creating chains of smaller volcanoes
        (cf. the Hawaiian-Emperor chain).</p>
      ${cite("McGovern & Solomon (1993, JGR 98, 23553); Pavri et al. (1992, JGR 97, 13445)")}`,
      mode,
    ),

    /* 5 ── The Lithosphere ─────────────────────────────────────────── */
    concept(
      "The Lithosphere",
      /* basic */
      `<p>The <strong>lithosphere</strong> is the rigid outer shell of a
        rocky planet — the part that behaves like a solid, as opposed to
        the hotter, softer mantle beneath. It includes the crust and the
        uppermost part of the mantle.</p>
      <p>A planet's lithosphere starts thin when the world is young and hot,
        then thickens over billions of years as the planet cools. A thicker
        lithosphere means the planet is less geologically active — fewer
        volcanoes, less tectonic motion. Tidal heating from a nearby large
        body can keep the lithosphere thin by pumping heat into the
        interior.</p>
      ${analogy("Think of the lithosphere as the skin on a pudding. When the pudding is freshly cooked, the skin is thin. As it cools, the skin thickens. A planet's 'skin' works the same way.")}
      ${keyIdea("The lithosphere is the planet's rigid outer shell. It thickens as the planet cools with age and thins where internal or tidal heat keeps the interior warm.")}`,

      /* advanced */
      `<p>The effective elastic lithosphere thickness ${iq("T_e")} controls
        the planet's ability to support topographic loads and determines
        the style of surface deformation. A simplified scaling (calibrated
        to solar-system bodies) is:</p>
      ${eq("T_e \\approx 20\\;\\sqrt{\\frac{t}{H_r}}\\;M^{0.3}\\;\\text{km}")}
      ${vars([
        ["T_e", "effective elastic lithosphere thickness (km)"],
        ["t", "planet age (Gyr)"],
        ["H_r", "radiogenic heat abundance relative to Earth (1.0 = Earth-like)"],
        ["M", "planet mass (M_\\oplus)"],
      ])}
      <p>This scaling captures the first-order behaviour: older planets have
        thicker lithospheres (cooled more), higher internal heating thins
        the lithosphere (more vigorous convection), and more massive planets
        have slightly thicker lithospheres (higher pressure at the
        base).</p>
      <p>Tidal heating from a host planet can reduce ${iq("T_e")}
        substantially. For a tidally heated moon, the effective lithosphere
        thickness is reduced by a factor that depends on the ratio of tidal
        to radiogenic heat flux, potentially keeping the body geologically
        active long after its radiogenic heat alone would have allowed the
        lithosphere to thicken.</p>
      ${cite("Watts (2001), Isostasy and Flexure of the Lithosphere, Ch. 6; Turcotte & Schubert (2014), Geodynamics, Ch. 7")}`,
      mode,
    ),

    /* 6 ── Radiogenic Heating ──────────────────────────────────────── */
    concept(
      "Radiogenic Heating",
      /* basic */
      `<p>A rocky planet has its own internal furnace. Deep inside, naturally
        occurring radioactive elements break down over time in a process
        called <strong>radioactive decay</strong>. Each decay event releases
        a tiny amount of heat. Multiplied by the trillions of atoms decaying
        every second, this adds up to an enormous total.</p>
      <p>Earth's interior radiogenic heat is about 20 terawatts — roughly
        half of the total heat flowing out of the planet. The main
        contributors are uranium-238, thorium-232, and potassium-40. Over
        time, these isotopes run down and the planet cools, but the process
        takes billions of years.</p>
      ${analogy("Imagine billions of tiny hand-warmers embedded throughout the planet's interior, each releasing a small amount of heat as it slowly runs out. Together they keep the planet warm from the inside.")}
      ${keyIdea("Radioactive decay of uranium, thorium, and potassium heats a planet's interior for billions of years. As these isotopes run down, the planet gradually cools.")}`,

      /* advanced */
      `<p>The principal heat-producing isotopes in silicate mantles are:</p>
      ${dataTable(
        [
          "Isotope",
          "Half-life (Gyr)",
          "Heat production (W/kg)",
          "Fraction of Earth's radiogenic heat",
        ],
        [
          ["\\(^{238}\\)U", "4.47", "9.46 \\(\\times 10^{-5}\\)", "~39%"],
          ["\\(^{232}\\)Th", "14.0", "2.64 \\(\\times 10^{-5}\\)", "~40%"],
          ["\\(^{40}\\)K", "1.25", "2.92 \\(\\times 10^{-5}\\)", "~21%"],
          ["\\(^{235}\\)U", "0.704", "5.69 \\(\\times 10^{-4}\\)", "< 1% today"],
        ],
      )}
      <p>Earth's total radiogenic heat production is estimated at ~20 TW
        (Jaupart &amp; Mareschal 2011), with an additional ~24 TW from
        primordial (secular) cooling, giving a total surface heat flux of
        ~44 TW. The radiogenic contribution decays exponentially:</p>
      ${eq("H(t) = \\sum_i c_i\\,h_i\\,\\exp\\!\\left(-\\frac{\\ln 2}{\\tau_i}\\,t\\right)")}
      ${vars([
        ["H(t)", "volumetric heat production at time t"],
        ["c_i", "concentration of isotope i (kg/kg)"],
        ["h_i", "specific heat production of isotope i (W/kg)"],
        ["\\tau_i", "half-life of isotope i"],
      ])}
      <p>Early in Earth's history, short-lived ${iq("^{26}")}Al and
        ${iq("^{60}")}Fe also contributed significantly, and
        ${iq("^{40}")}K (with its 1.25 Gyr half-life) was far more
        abundant. At 4.5 Gyr ago, total radiogenic output was roughly
        3-4 times higher than today.</p>
      ${cite("Jaupart & Mareschal (2011), Heat Generation and Transport in the Earth, Ch. 7; Turcotte & Schubert (2014), Geodynamics, Ch. 4")}`,
      mode,
    ),
  ].join("");
}
