/**
 * Lesson 03 — Stellar Luminosity
 *
 * Covers the mass-luminosity relation (including the Eker six-piece
 * power law), the Stefan-Boltzmann law, and fusion as the energy source.
 * Includes a mini-calculator that converts mass to luminosity.
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

import { massToLuminosity } from "../../engine/star.js";
import { fmt } from "../../engine/utils.js";

/* ── build ─────────────────────────────────────────────────────────── */

export function buildLesson03(mode) {
  return [
    /* 1 ── The Mass-Luminosity Relation ──────────────────────────── */
    concept(
      "The Mass-Luminosity Relation",
      /* basic */
      `<p>The most important rule in stellar physics might be the simplest to
        state: <strong>more massive stars are dramatically more luminous</strong>.
        But the relationship is far from linear.</p>
      <p>Doubling a star's mass does not merely double its brightness. In
        fact, a star twice the mass of the Sun is roughly ten times brighter.
        A star ten times the Sun's mass can be thousands of times more
        luminous.</p>
      ${analogy("Imagine two engines: one twice the size of the other. You might expect it to produce twice the power, but stellar physics is far more extreme — the bigger engine runs so much hotter that it outputs ten times the power, not two.")}
      ${keyIdea("Luminosity scales roughly as mass to the fourth power: double the mass and you get about 10 to 16 times the luminosity. This steep relation has huge consequences for stellar lifetimes.")}`,

      /* advanced */
      `<p>The mass-luminosity relation (MLR) for main-sequence stars is
        commonly approximated as a single power law:</p>
      ${eq("L \\propto M^\\alpha")}
      <p>In reality, ${iq("\\alpha")} varies with mass. Eker et al. (2018)
        calibrated a six-piece empirical relation from 509 eclipsing binary
        components:</p>
      ${dataTable(
        ["Mass range (M<sub>&#9737;</sub>)", "\\(\\alpha\\)", "Regime"],
        [
          ["< 0.45", "2.028", "Fully convective M dwarfs"],
          ["0.45 -- 0.72", "4.572", "Late-K / early-M transition"],
          ["0.72 -- 1.05", "5.743", "Solar-type (G/K boundary)"],
          ["1.05 -- 2.40", "4.329", "F / A stars"],
          ["2.40 -- 7.0", "3.967", "B stars"],
          ["> 7.0", "2.865", "O / early-B stars"],
        ],
      )}
      <p>The exponent ${iq("\\alpha")} is steepest near 1 ${iq("M_\\odot")}
        (where opacity-driven envelope physics dominates) and flattens toward
        both extremes. The simplified ${iq("\\alpha \\approx 4")} is a useful
        approximation for back-of-the-envelope calculations in the
        1--10 ${iq("M_\\odot")} range.</p>
      ${eq("L = c \\cdot M^\\alpha \\quad (c \\text{ adjusted for continuity at each boundary})")}
      ${cite("Eker et al. (2018, MNRAS 479, 5491), Table 4")}`,
      mode,
    ),

    /* 2 ── Stefan-Boltzmann Law ──────────────────────────────────── */
    concept(
      "The Stefan-Boltzmann Law",
      /* basic */
      `<p>A star's luminosity depends on two things: how <strong>big</strong>
        it is and how <strong>hot</strong> its surface is. A larger star has
        more surface area to radiate from, and a hotter surface radiates far
        more energy per unit area.</p>
      <p>Temperature matters most. If you double the surface temperature of a
        star (keeping its size the same), its luminosity increases by a
        factor of sixteen — because luminosity goes as the <em>fourth
        power</em> of temperature.</p>
      ${analogy("Think of two metal plates heated in a forge, one twice as hot as the other. The hotter plate does not glow just twice as brightly — it radiates sixteen times more energy. That is the power of the fourth-power law.")}
      ${keyIdea("A star's luminosity equals its surface area multiplied by the energy radiated per unit area, which depends on the fourth power of temperature: L = 4 pi R squared times sigma T to the fourth.")}`,

      /* advanced */
      `<p>The Stefan-Boltzmann law relates luminosity to radius and effective
        temperature:</p>
      ${eq("L = 4\\pi R^2 \\sigma T_{\\text{eff}}^{\\,4}")}
      ${vars([
        ["L", "luminosity (W)"],
        ["R", "stellar radius (m)"],
        [
          "\\sigma",
          "Stefan-Boltzmann constant (5.670 \\times 10^{-8}\\;\\text{W m}^{-2}\\text{K}^{-4})",
        ],
        ["T_{\\text{eff}}", "effective surface temperature (K)"],
      ])}
      <p>In solar units, this simplifies to:</p>
      ${eq("\\frac{L}{L_\\odot} = \\left(\\frac{R}{R_\\odot}\\right)^{\\!2} \\left(\\frac{T_{\\text{eff}}}{T_{\\odot}}\\right)^{\\!4}")}
      <p>This is the basis for the WorldSmith engine's temperature derivation:
        given mass-derived ${iq("L")} and ${iq("R")}, the effective
        temperature is solved as
        ${iq("T_{\\text{eff}} = (L / R^2)^{0.25} \\times 5776\\;\\text{K}")}.</p>
      <p>The Stefan-Boltzmann law follows from integrating the Planck
        blackbody function over all wavelengths and over the hemisphere,
        yielding total emitted flux ${iq("F = \\sigma T^4")} per unit area.</p>
      ${cite("Carroll & Ostlie (2017), An Introduction to Modern Astrophysics, Ch. 3")}`,
      mode,
    ),

    /* 3 ── Energy Source: Fusion ──────────────────────────────────── */
    concept(
      "Energy Source: Fusion",
      /* basic */
      `<p>Stars shine because they fuse light elements into heavier ones in
        their cores. On the main sequence, the primary fuel is
        <strong>hydrogen</strong>, which is converted to helium.</p>
      <p>More massive stars have hotter, denser cores, so they burn through
        hydrogen at a ferocious rate. A star ten times the Sun's mass is
        thousands of times brighter but has only ten times the fuel — it
        runs out in a tiny fraction of the Sun's lifetime.</p>
      ${analogy("Think of fuel in a vehicle: a larger tank holds more fuel, but if the engine burns it a hundred times faster, the tank empties far sooner. Massive stars are like powerful engines with only moderately larger tanks.")}
      ${keyIdea("Stars are powered by hydrogen fusion. More massive stars fuse hydrogen faster, producing more light but exhausting their fuel supply in far less time.")}`,

      /* advanced */
      `<p>Main-sequence stars convert hydrogen to helium via two pathways:</p>
      <ul>
        <li><strong>pp chain</strong> — dominant below ~1.3 ${iq("M_\\odot")};
            reaction rate ${iq("\\propto T^4")}. Energy yield: 26.73 MeV per
            ${iq("{}^4\\!He")} nucleus (minus neutrino losses of ~2%).</li>
        <li><strong>CNO cycle</strong> — dominant above ~1.3 ${iq("M_\\odot")};
            reaction rate ${iq("\\propto T^{16}")}. Uses C, N, O as catalysts.
            Same net energy per helium nucleus, but neutrino losses are
            slightly higher (~5%).</li>
      </ul>
      ${eq("\\varepsilon_{\\text{pp}} \\propto \\rho T^4, \\quad \\varepsilon_{\\text{CNO}} \\propto \\rho T^{16}")}
      ${vars([
        ["\\varepsilon", "energy generation rate per unit mass"],
        ["\\rho", "core density"],
        ["T", "core temperature"],
      ])}
      <p>The steep temperature dependence of the CNO cycle means that even a
        modest increase in core temperature (driven by higher mass) causes a
        dramatic increase in energy output. This is the physical origin of
        the mass-luminosity relation's steep exponent near
        1 ${iq("M_\\odot")}.</p>
      <p>Main-sequence lifetime scales as available fuel divided by burn
        rate:</p>
      ${eq("t_{\\text{MS}} \\sim \\frac{E_{\\text{fuel}}}{L} \\propto \\frac{M}{L} \\propto M^{1-\\alpha}")}
      ${cite("Kippenhahn, Weigert & Weiss (2012), Ch. 18; Eker et al. (2018, MNRAS 479, 5491)")}`,
      mode,
    ),

    /* ── Mini-calculator ─────────────────────────────────────────── */
    tryIt(
      "Mass to Luminosity",
      `${tryRow(
        `<label for="les03-mass">Star mass (M<sub>&#9737;</sub>)</label>`,
        `<input id="les03-mass" type="number" min="0.08" max="100" step="0.01" value="1.0">
         <input id="les03-massSlider" type="range" min="0.08" max="100" step="0.01" value="1.0">`,
      )}
      ${tryOutput("les03-lum", "Luminosity (L<sub>&#9737;</sub>)")}`,
    ),
  ].join("");
}

/* ── wire ──────────────────────────────────────────────────────────── */

export function wireLesson03(root) {
  const inp = root.querySelector("#les03-mass");
  const slider = root.querySelector("#les03-massSlider");
  const outLum = root.querySelector("#les03-lum");
  if (!inp || !slider || !outLum) return;

  function update() {
    const mass = parseFloat(inp.value) || 1;
    slider.value = mass;
    outLum.textContent = fmt(massToLuminosity(mass), 4);
  }

  inp.addEventListener("input", update);
  slider.addEventListener("input", () => {
    inp.value = slider.value;
    update();
  });
  update();
}
