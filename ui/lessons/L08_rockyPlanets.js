// SPDX-License-Identifier: MPL-2.0
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
import { fmt } from "../../engine/utils.js";

/**
 * Lesson 08 — Rocky Planets
 * Composition, mass-radius, surface gravity, and composition types.
 */
export function buildLesson08(mode) {
  return [
    /* ── 1. What Makes a Rocky Planet ── */
    concept(
      "What Makes a Rocky Planet",
      `<p>Rocky (or "terrestrial") planets are built from two main ingredients:
      an iron-nickel core and a silicate (rock) mantle surrounding it. The
      proportion of iron core to total mass is called the <b>core mass
      fraction</b> (CMF), and it is one of the most important properties
      determining a rocky planet's density and internal structure.</p>
      <p>Earth's core makes up about 33% of its total mass. Mercury, by
      contrast, has an unusually large core at roughly 70% of its mass,
      making it the densest terrestrial planet relative to its size.</p>
      ${analogy("A rocky planet is like a chocolate truffle: a dense metal centre (the chocolate ganache) surrounded by a lighter rocky shell (the chocolate coating). The ratio of centre to coating determines the overall density.")}
      ${keyIdea("The core mass fraction (CMF) is the key variable for rocky planets. More iron core means a denser, more compact world.")}`,

      `<p>Terrestrial planets differentiate into a metallic core (primarily
      Fe-Ni) and a silicate mantle (Mg, Si, O compounds). The <b>core mass
      fraction</b> (CMF) is defined as:</p>
      ${eq("\\text{CMF} = \\frac{M_{\\text{core}}}{M_{\\text{planet}}}")}
      <p>CMF correlates with the host star's iron-to-silicate ratio. Schulze
      et al. (2021) showed that stellar Fe/Mg and Fe/Si abundances can predict
      planetary CMF to within roughly 10%.</p>
      ${dataTable(
        ["Body", "CMF", "Bulk density (g/cm³)"],
        [
          ["Mercury", "~0.70", "5.43"],
          ["Venus", "~0.32", "5.24"],
          ["Earth", "~0.33", "5.51"],
          ["Mars", "~0.24", "3.93"],
          ["Moon", "~0.02", "3.34"],
        ],
      )}
      <p>Higher CMF produces a smaller radius at the same mass because iron is
      denser than silicate. This is the basis of mass-radius models for
      exoplanet characterisation.</p>
      ${cite("Schulze, J. G. et al. (2021), Planet. Sci. J. 2, 113.")}`,
      mode,
    ),

    /* ── 2. Mass and Radius ── */
    concept(
      "Mass and Radius",
      `<p>A common misconception is that a planet twice as massive as Earth would
      be twice as large. In reality, the relationship between mass and radius
      is much shallower. Doubling the mass only increases the radius by about
      20%, because the added material compresses the interior under its own
      gravity.</p>
      <p>Water content also matters enormously. A planet with a thick layer of
      water or ice on top of its rocky interior will be noticeably larger than
      a dry planet of the same mass, because water is much less dense than
      rock.</p>
      ${analogy("Think of stacking pillows versus stacking bricks. Adding more bricks (dense rock and iron) to a pile does not make it much taller because the weight compresses the bottom layers. Adding pillows (water, ice) puffs up the stack without adding much weight.")}
      ${keyIdea("Mass and radius are not proportional. More mass means stronger self-compression, so bigger planets are proportionally smaller than you might expect.")}`,

      `<p>For dry rocky planets with Earth-like composition, Zeng and Sasselov
      (2013, 2016) provide a power-law approximation:</p>
      ${eq("R_{\\text{dry}} = 1.00 \\times M^{0.270} \\; R_\\oplus")}
      ${vars([
        ["R_{\\text{dry}}", "planet radius (Earth radii), dry composition"],
        ["M", "planet mass (Earth masses)"],
      ])}
      <p>The exponent 0.270 (less than 1/3) reflects gravitational
      self-compression. For comparison, a constant-density sphere would give
      ${iq("R \\propto M^{1/3}")}.</p>
      <p>Water content inflates the radius. A 50% water-mass-fraction planet is
      roughly 20-30% larger than a dry planet of the same mass. The water
      layer adds volume without proportional mass.</p>
      ${dataTable(
        ["Mass (M Earth)", "R dry (R Earth)", "R 50% water"],
        [
          ["0.5", "0.83", "~1.00"],
          ["1.0", "1.00", "~1.25"],
          ["2.0", "1.21", "~1.50"],
          ["5.0", "1.52", "~1.90"],
          ["10.0", "1.86", "~2.30"],
        ],
      )}
      ${cite("Zeng, L. & Sasselov, D. (2013), PASP 125, 227; (2016), ApJ 819, 127.")}`,
      mode,
    ),

    /* ── 3. Surface Gravity and Escape Velocity ── */
    concept(
      "Surface Gravity and Escape Velocity",
      `<p><b>Surface gravity</b> is the pull you would feel standing on the
      planet's surface. It depends on both the planet's mass and its size. A
      more massive planet has stronger gravity, but a larger planet (at the
      same mass) has weaker surface gravity because you are farther from the
      centre.</p>
      <p><b>Escape velocity</b> is the speed an object must reach to fly away
      from the planet and never fall back. It determines whether a planet can
      hold onto an atmosphere: if gas molecules move faster than the escape
      velocity, they drift off into space.</p>
      ${analogy("Surface gravity is how hard you are pulled down when standing still. Escape velocity is how fast you need to throw a ball straight up so it never comes back down. Both get stronger with more mass, but a bigger planet spreads that mass out.")}
      ${keyIdea("Surface gravity controls everyday experience (weight, atmosphere pressure). Escape velocity controls whether the planet can keep its atmosphere over billions of years.")}`,

      `<p>Surface gravity is derived from Newton's law of gravitation:</p>
      ${eq("g = \\frac{G M}{R^2} = 9.81 \\frac{M / M_\\oplus}{(R / R_\\oplus)^2} \\; \\text{m/s}^2")}
      <p>Escape velocity is the minimum speed to escape a planet's gravitational
      well from its surface:</p>
      ${eq("v_{\\text{esc}} = \\sqrt{\\frac{2 G M}{R}} = \\sqrt{2 g R}")}
      ${vars([
        ["g", "surface gravitational acceleration"],
        ["G", "gravitational constant (6.674 x 10⁻¹¹ N m² kg⁻²)"],
        ["M", "planet mass"],
        ["R", "planet radius"],
        ["v_{\\text{esc}}", "escape velocity"],
      ])}
      <p>For reference, Earth's surface gravity is 9.81 m/s² and its escape
      velocity is 11.2 km/s.</p>
      ${dataTable(
        ["Body", "g (m/s²)", "v_esc (km/s)"],
        [
          ["Moon", "1.62", "2.38"],
          ["Mars", "3.72", "5.03"],
          ["Earth", "9.81", "11.19"],
          ["Super-Earth (5 M)", "~14.5", "~16.6"],
          ["Venus", "8.87", "10.36"],
        ],
      )}`,
      mode,
    ),

    /* ── 4. Composition Types ── */
    concept(
      "Composition Types",
      `<p>Rocky planets come in a range of compositions, from iron-dominated
      worlds to water-rich ocean planets. Here are the main categories:</p>
      ${dataTable(
        ["Type", "Description", "Real example"],
        [
          ["Iron world", "Mostly metal, very small rocky mantle", "---"],
          ["Mercury-like", "Large iron core (~60-70% CMF), thin mantle", "Mercury"],
          ["Earth-like", "Moderate core (~30-35% CMF), thick mantle", "Earth, Venus"],
          ["Mars-like", "Smaller core (~20-25% CMF), thicker mantle", "Mars"],
          ["Coreless", "Almost no iron core, pure silicate", "---"],
          ["Ocean world", "Rocky interior + deep global ocean", "---"],
        ],
      )}
      ${keyIdea("The iron-to-rock ratio is set during formation and determines the planet's density, magnetic field potential, and tectonic behaviour.")}`,

      `<p>Composition categories are defined by CMF and water mass fraction
      (WMF):</p>
      ${dataTable(
        ["Type", "CMF", "WMF", "Bulk density (g/cm³)"],
        [
          ["Iron world", "> 0.60", "0", "6.5-8.0"],
          ["Mercury-like", "0.50-0.70", "0", "5.3-6.5"],
          ["Earth-like", "0.26-0.36", "0", "5.0-5.5"],
          ["Mars-like", "0.18-0.26", "0", "3.8-5.0"],
          ["Coreless", "< 0.05", "0", "3.0-3.5"],
          ["Ocean world", "0.10-0.33", "> 0.01", "2.5-4.5"],
          ["Water world", "0.10-0.33", "> 0.25", "1.5-3.0"],
        ],
      )}
      <p>CMF affects more than density. High-CMF planets are more likely to
      generate a strong magnetic dynamo (protecting the atmosphere from
      stellar wind stripping). Low-CMF planets may lack plate tectonics
      because the mantle is too thick relative to the core's heat output.</p>
      <p>Water mass fraction above ~0.01 (1%) produces observable radius
      inflation and potentially global surface oceans if the temperature
      permits liquid water.</p>
      ${cite("Zeng, L. et al. (2016), ApJ 819, 127; Schulze, J. G. et al. (2021), Planet. Sci. J. 2, 113.")}`,
      mode,
    ),

    /* ── Calculator ── */
    tryIt(
      "Planet Properties Calculator",
      tryRow(
        `<label for="l08Mass">Planet mass (M&#8853;)</label>`,
        `<input type="number" id="l08Mass" value="1.0" min="0.01" max="10" step="0.01">
         <input type="range" id="l08MassSlider" min="0.01" max="10" step="0.01" value="1.0">`,
      ) +
        tryRow(
          `<label for="l08CMF">Core mass fraction</label>`,
          `<input type="number" id="l08CMF" value="0.33" min="0" max="0.8" step="0.01">
           <input type="range" id="l08CMFSlider" min="0" max="0.8" step="0.01" value="0.33">`,
        ) +
        tryOutput("l08Radius", "Radius (R&#8853;): ") +
        tryOutput("l08Gravity", "Surface gravity (m/s²): ") +
        tryOutput("l08EscVel", "Escape velocity (km/s): "),
    ),
  ].join("");
}

/** Bind interactive calculator elements for Lesson 08. */
export function wireLesson08(root) {
  const massInp = root.querySelector("#l08Mass");
  const massSlider = root.querySelector("#l08MassSlider");
  const cmfInp = root.querySelector("#l08CMF");
  const cmfSlider = root.querySelector("#l08CMFSlider");
  const radiusOut = root.querySelector("#l08Radius");
  const gravOut = root.querySelector("#l08Gravity");
  const escOut = root.querySelector("#l08EscVel");
  if (!massInp) return;

  function update() {
    const mass = parseFloat(massInp.value) || 1;
    const cmf = parseFloat(cmfInp.value) || 0.33;
    massSlider.value = mass;
    cmfSlider.value = cmf;

    // Dry rocky planet radius approximation (Zeng & Sasselov)
    // CMF adjustment: higher CMF compresses radius
    const cmfFactor = 1 - 0.3 * (cmf - 0.33);
    const radius = Math.pow(mass, 0.27) * cmfFactor; // R_Earth
    const gravity = (9.81 * mass) / (radius * radius); // m/s²
    const escVel = Math.sqrt(2 * gravity * radius * 6371000) / 1000; // km/s

    radiusOut.textContent = fmt(radius, 3);
    gravOut.textContent = fmt(gravity, 2);
    escOut.textContent = fmt(escVel, 2);
  }

  massInp.addEventListener("input", update);
  massSlider.addEventListener("input", () => {
    massInp.value = massSlider.value;
    update();
  });
  cmfInp.addEventListener("input", update);
  cmfSlider.addEventListener("input", () => {
    cmfInp.value = cmfSlider.value;
    update();
  });
  update();
}
