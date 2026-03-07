// SPDX-License-Identifier: MPL-2.0
/**
 * Lesson 05 — The Habitable Zone
 *
 * Covers the concept of the habitable zone, inner/outer edge physics,
 * how star type shifts the HZ, and the limitations of the HZ model.
 * Includes a mini-calculator that outputs inner and outer HZ distances
 * for a given stellar mass.
 */

import {
  concept,
  analogy,
  keyIdea,
  eq,
  iq,
  vars,
  cite,
  dataTable,
  tryIt,
  tryRow,
  tryOutput,
} from "./helpers.js";

import {
  massToLuminosity,
  estimateHabitableTeffKFromMass,
  calcHabitableZoneAu,
} from "../../engine/star.js";
import { fmt } from "../../engine/utils.js";

/* ── build ─────────────────────────────────────────────────────────── */

export function buildLesson05(mode) {
  return [
    /* 1 ── What Is the Habitable Zone? ───────────────────────────── */
    concept(
      "What Is the Habitable Zone?",
      /* basic */
      `<p>The <strong>habitable zone</strong> (HZ) is the range of distances
        from a star where conditions on a planet's surface could allow liquid
        water to exist. It is sometimes called the "Goldilocks zone" — not
        too hot, not too cold, but just right.</p>
      <p>Liquid water is considered essential for life as we know it, so the
        habitable zone is a key concept in the search for potentially
        Earth-like worlds.</p>
      ${analogy("Imagine sitting around a campfire on a cold night. Too close and you overheat; too far and you freeze. There is a comfortable ring around the fire where the temperature is just right. The habitable zone is that comfortable ring around a star.")}
      ${keyIdea("The habitable zone is the band of orbital distances where a planet could sustain liquid water on its surface — the key requirement for life as we know it.")}`,

      /* advanced */
      `<p>The habitable zone is defined by the range of orbital distances
        where the incident stellar flux ${iq("S")} allows a planet with
        a suitable atmosphere to maintain surface liquid water. The concept
        is formalised through the <strong>effective stellar flux</strong>
        ${iq("S_{\\text{eff}}")}:</p>
      ${eq("d = \\sqrt{\\frac{L / L_\\odot}{S_{\\text{eff}}}}\\;\\text{AU}")}
      ${vars([
        ["d", "orbital distance (AU)"],
        ["L", "stellar luminosity (L_\\odot)"],
        [
          "S_{\\text{eff}}",
          "effective stellar flux at the HZ boundary (dimensionless, relative to solar flux at 1 AU)",
        ],
      ])}
      <p>The ${iq("S_{\\text{eff}}")} values for the inner and outer edges
        are not constants — they depend on the stellar effective temperature
        because cooler stars emit a larger fraction of their light at red/IR
        wavelengths, which interact differently with atmospheric absorbers
        (H${iq("_2")}O, CO${iq("_2")}).</p>
      ${cite("Kopparapu et al. (2013, ApJ 765, 131); Kopparapu et al. (2014, ApJ 787, L29)")}`,
      mode,
    ),

    /* 2 ── Inner and Outer Edges ─────────────────────────────────── */
    concept(
      "Inner and Outer Edges",
      /* basic */
      `<p>The habitable zone has two boundaries:</p>
      <ul>
        <li><strong>Inner edge</strong> — too close to the star. Intense
            radiation causes water to evaporate into the upper atmosphere,
            where ultraviolet light splits it apart. The hydrogen escapes to
            space, and a <em>runaway greenhouse</em> effect bakes the planet.
            Venus may have suffered this fate.</li>
        <li><strong>Outer edge</strong> — too far from the star. The planet
            receives too little warmth to keep water liquid, even with a
            thick CO${iq("_2")} atmosphere. Beyond a certain distance,
            CO${iq("_2")} itself begins to condense into clouds, reducing
            the greenhouse effect and pushing temperatures even lower.</li>
      </ul>
      ${analogy("Too close to the fire: your marshmallow catches flame. Too far away: it stays cold and raw. The habitable zone is the sweet spot where it toasts evenly.")}
      ${keyIdea("The inner edge is set by the runaway greenhouse limit (all water boils away). The outer edge is set by the maximum greenhouse limit (CO2 condenses and the greenhouse effect fails).")}`,

      /* advanced */
      `<p>The inner and outer ${iq("S_{\\text{eff}}")} boundaries are
        modelled as 4th-order polynomials in
        ${iq("\\Delta T = T_{\\text{eff}} - 5780\\;\\text{K}")}:</p>
      ${eq("S_{\\text{eff}} = S_0 + a\\,\\Delta T + b\\,\\Delta T^2 + c\\,\\Delta T^3 + d\\,\\Delta T^4")}
      <p>WorldSmith uses the Chromant Desmos correction to the Kopparapu
        coefficients:</p>
      ${dataTable(
        ["Boundary", "S<sub>0</sub>", "a", "b", "c", "d"],
        [
          ["Inner (runaway GH)", "1.107", "1.332e-4", "1.58e-8", "-8.308e-12", "-5.073e-15"],
          ["Outer (max GH)", "0.356", "6.171e-5", "1.698e-9", "-3.198e-12", "-5.575e-16"],
        ],
      )}
      <p>The orbital distance at each boundary is then:</p>
      ${eq("d_{\\text{HZ}} = \\sqrt{\\frac{L}{S_{\\text{eff}}}}\\;\\text{AU}")}
      <p>The temperature correction matters significantly for M dwarfs
        (${iq("T_{\\text{eff}} \\sim 3000\\;\\text{K}")}) where the HZ
        shifts inward, and for early-type stars where it shifts outward.</p>
      ${vars([
        ["S_{\\text{eff}}", "effective flux boundary (dimensionless)"],
        ["\\Delta T", "T_{\\text{eff}} - 5780\\;\\text{K}"],
        ["L", "stellar luminosity (L_\\odot)"],
      ])}
      ${cite("Kopparapu et al. (2013, ApJ 765, 131); Chromant Desmos Star System Visualizer")}`,
      mode,
    ),

    /* 3 ── How Star Type Affects the HZ ──────────────────────────── */
    concept(
      "How Star Type Affects the HZ",
      /* basic */
      `<p>The habitable zone shifts depending on the type of star:</p>
      <ul>
        <li><strong>Hot, luminous stars</strong> (O, B, A types) push the
            habitable zone far out — planets must orbit at great distances to
            avoid being scorched.</li>
        <li><strong>Sun-like stars</strong> (F, G types) have habitable zones
            at moderate distances, roughly 0.9 to 1.7 AU for a solar twin.</li>
        <li><strong>Cool, dim stars</strong> (K, M types) pull the habitable
            zone in very close. An M dwarf's habitable zone might be only
            0.1 to 0.3 AU from the star — closer than Mercury is to our
            Sun.</li>
      </ul>
      ${analogy("A dim lamp needs you to sit close to read by its light. A powerful floodlight lets you read comfortably from across the room. Dim stars need their planets close; bright stars can warm planets from a great distance.")}
      ${keyIdea("Brighter stars have wider, more distant habitable zones. Dimmer stars have narrow habitable zones very close in. M dwarfs in particular have HZs so close that tidal locking becomes a concern.")}`,

      /* advanced */
      `<p>Since ${iq("d_{\\text{HZ}} = \\sqrt{L / S_{\\text{eff}}}")}, the
        habitable zone scales primarily with the square root of luminosity.
        Because the mass-luminosity relation is steep
        (${iq("L \\propto M^{\\sim 4}")}), even a modest change in mass
        produces a large shift in HZ distance:</p>
      ${dataTable(
        [
          "Spectral type",
          "Mass (M<sub>&#9737;</sub>)",
          "L (L<sub>&#9737;</sub>)",
          "HZ inner (AU)",
          "HZ outer (AU)",
        ],
        [
          ["M5V", "0.16", "0.003", "0.05", "0.09"],
          ["M0V", "0.50", "0.06", "0.22", "0.42"],
          ["K5V", "0.70", "0.17", "0.37", "0.70"],
          ["G2V (Sun)", "1.00", "1.00", "0.95", "1.67"],
          ["F5V", "1.40", "3.7", "1.8", "3.2"],
          ["A0V", "2.50", "28", "4.9", "8.8"],
        ],
      )}
      <p>For M dwarfs, the HZ is so close that planets are likely
        tidally locked, presenting the same face to the star permanently.
        Whether such planets can maintain habitable surface conditions
        depends on atmospheric heat transport.</p>
      ${cite("Kopparapu et al. (2013, ApJ 765, 131); Shields et al. (2016, Phys. Rep. 663, 1)")}`,
      mode,
    ),

    /* 4 ── Limitations ───────────────────────────────────────────── */
    concept(
      "Limitations",
      /* basic */
      `<p>The habitable zone is a useful guide, but it is a simplification.
        Real habitability depends on much more than distance from a star:</p>
      <ul>
        <li><strong>Atmosphere</strong> — a thick greenhouse atmosphere can
            warm a planet beyond the nominal outer edge. A thin or absent
            atmosphere leaves a planet frozen even inside the HZ.</li>
        <li><strong>Tidal heating</strong> — moons of giant planets (like
            Jupiter's Europa) can have subsurface oceans heated by tidal
            forces, far outside any star's habitable zone.</li>
        <li><strong>Planetary composition</strong> — the amount of water,
            volcanic outgassing, and plate tectonics all affect whether
            liquid water actually exists.</li>
      </ul>
      <p>Venus sits near the inner edge of the Sun's habitable zone but is a
        scorching hellscape because of its thick CO${iq("_2")} atmosphere.
        Mars sits near the outer edge but is too cold because it lost most
        of its atmosphere.</p>
      ${keyIdea("The habitable zone marks where liquid water <em>could</em> exist, not where it <em>does</em> exist. Atmosphere, geology, and other factors determine actual habitability. Planets outside the HZ (like icy moons) might still harbour life.")}`,

      /* advanced */
      `<p>The classical HZ assumes a 1-Earth-mass planet with an
        N${iq("_2")}--CO${iq("_2")}--H${iq("_2")}O atmosphere and ignores
        several factors that can shift the boundaries:</p>
      <ul>
        <li><strong>Planetary mass</strong> — more massive planets retain
            thicker atmospheres and have stronger greenhouse effects,
            potentially extending the outer edge.</li>
        <li><strong>Cloud feedback</strong> — reflective clouds near the
            inner edge can increase the planet's albedo and push the runaway
            greenhouse threshold closer to the star. Water-ice clouds at the
            outer edge can either warm (IR scattering) or cool (reflection)
            depending on altitude.</li>
        <li><strong>Tidal heating</strong> — for moons in eccentric orbits
            around giant planets, dissipation can provide surface heat
            fluxes comparable to or exceeding insolation, creating
            "habitable" conditions far outside the HZ (e.g. Europa,
            Enceladus).</li>
        <li><strong>Atmospheric escape</strong> — M-dwarf planets in close
            HZs are subject to intense XUV irradiation during the star's
            active pre-main-sequence phase, potentially stripping
            atmospheres entirely.</li>
        <li><strong>Synchronous rotation</strong> — tidally locked planets
            require atmospheric dynamics to redistribute heat. 3D GCM
            studies suggest this is feasible for Earth-like atmospheres but
            uncertain for thin-atmosphere worlds.</li>
      </ul>
      <p>Venus (${iq("S \\approx 1.91\\,S_\\oplus")}) experienced a
        runaway greenhouse despite being only slightly inside the inner
        HZ edge. Mars (${iq("S \\approx 0.43\\,S_\\oplus")}) is near the
        outer edge but lost its magnetic field and most of its atmosphere
        early, leaving it cold and dry.</p>
      ${cite("Kopparapu et al. (2013); Shields et al. (2016, Phys. Rep. 663, 1); Lammer et al. (2009, A&A Rev. 17, 181)")}`,
      mode,
    ),

    /* ── Mini-calculator ─────────────────────────────────────────── */
    tryIt(
      "Habitable Zone Calculator",
      `${tryRow(
        `<label for="les05-mass">Star mass (M<sub>&#9737;</sub>)</label>`,
        `<input id="les05-mass" type="number" min="0.08" max="5" step="0.01" value="1.0">
         <input id="les05-massSlider" type="range" min="0.08" max="5" step="0.01" value="1.0">`,
      )}
      ${tryOutput("les05-inner", "HZ inner edge (AU)")}
      ${tryOutput("les05-outer", "HZ outer edge (AU)")}`,
    ),
  ].join("");
}

/* ── wire ──────────────────────────────────────────────────────────── */

export function wireLesson05(root) {
  const inp = root.querySelector("#les05-mass");
  const slider = root.querySelector("#les05-massSlider");
  const outInner = root.querySelector("#les05-inner");
  const outOuter = root.querySelector("#les05-outer");
  if (!inp || !slider || !outInner || !outOuter) return;

  function update() {
    const mass = parseFloat(inp.value) || 1;
    slider.value = mass;
    const lum = massToLuminosity(mass);
    const teff = estimateHabitableTeffKFromMass(mass);
    const hz = calcHabitableZoneAu({ luminosityLsol: lum, teffK: teff });
    outInner.textContent = fmt(hz.innerAu, 4);
    outOuter.textContent = fmt(hz.outerAu, 4);
  }

  inp.addEventListener("input", update);
  slider.addEventListener("input", () => {
    inp.value = slider.value;
    update();
  });
  update();
}
