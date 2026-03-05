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
 * Lesson 10 — Surface Temperature
 * Energy balance, albedo, greenhouse effect, and water phase boundaries.
 */
export function buildLesson10(mode) {
  return [
    /* ── 1. Energy Balance ── */
    concept(
      "Energy Balance",
      `<p>A planet's surface temperature is set by a balancing act between two
      processes: energy arriving from the star (heating) and energy radiating
      away into space (cooling). When these two are in balance, the planet
      reaches a stable temperature called the <b>equilibrium temperature</b>.</p>
      <p>The closer a planet is to its star, the more energy it receives and
      the hotter it gets. A brighter star also means more energy. Conversely,
      a planet that radiates heat efficiently (or reflects a lot of starlight)
      will be cooler.</p>
      ${analogy("Think of a balance between heating and cooling, like a pot of water on a stove. Turn the burner up (brighter star or closer orbit) and the water gets hotter. Take the lid off (less greenhouse trapping) and it cools down. The steady temperature is where heating and cooling match.")}
      ${keyIdea("A planet's temperature is determined by how much starlight it absorbs versus how much heat it radiates away. Closer to the star or brighter star means hotter.")}`,

      `<p>The equilibrium temperature is found by equating absorbed stellar
      flux with emitted thermal radiation. For a rapidly rotating planet
      (uniform dayside/nightside temperature):</p>
      ${eq("T_{\\text{eq}} = T_\\star \\sqrt{\\frac{R_\\star}{2a}} \\; (1 - A)^{1/4}")}
      <p>Or equivalently, using luminosity ${iq("L = 4\\pi R_\\star^2 \\sigma T_\\star^4")}:</p>
      ${eq("T_{\\text{eq}} = 278.5 \\; \\frac{L^{1/4}}{a^{1/2}} \\; (1 - A)^{1/4} \\; \\text{K}")}
      ${vars([
        ["T_{\\text{eq}}", "equilibrium temperature (K)"],
        ["T_\\star", "stellar effective temperature (K)"],
        ["R_\\star", "stellar radius"],
        ["a", "orbital semi-major axis (AU)"],
        ["A", "Bond albedo"],
        ["L", "stellar luminosity (solar luminosities)"],
      ])}
      <p>The factor 278.5 K is the equilibrium temperature of a zero-albedo
      planet at 1 AU from a solar-luminosity star. Earth's actual equilibrium
      temperature (with albedo 0.30) is about 255 K, well below the observed
      mean of 288 K; the 33 K difference is the greenhouse effect.</p>
      ${cite("Pierrehumbert, R. T. (2010), Principles of Planetary Climate, Cambridge Univ. Press.")}`,
      mode,
    ),

    /* ── 2. Albedo ── */
    concept(
      "Albedo",
      `<p>Albedo measures how reflective a planet is. A perfectly reflective
      surface (like a mirror) has an albedo of 1. A perfectly absorbing
      surface (like charcoal) has an albedo of 0. Real planets fall
      somewhere in between.</p>
      <p>Ice and clouds are bright and reflective, pushing the albedo up.
      Oceans and dark rock absorb more light, keeping the albedo low. This
      matters because a more reflective planet absorbs less energy from its
      star and stays cooler.</p>
      <p>Earth's average albedo is about 0.30, meaning it reflects 30% of
      incoming sunlight. Venus, covered in thick bright clouds, has an
      albedo of about 0.76. The Moon, with no atmosphere and dark basaltic
      rock, has an albedo of only 0.12.</p>
      ${analogy("Albedo is like wearing a white shirt versus a black shirt on a sunny day. The white shirt reflects sunlight and keeps you cooler; the black shirt absorbs it and heats up. Planets work the same way.")}
      ${keyIdea("High albedo (bright, reflective) means cooler. Low albedo (dark, absorbing) means warmer. Ice, clouds, and surface colour all contribute.")}`,

      `<p>Two types of albedo are used in planetary science:</p>
      <p><b>Bond albedo</b> ${iq("(A_B)")} is the fraction of total incident
      stellar energy reflected in all directions across all wavelengths. This
      is what enters the energy balance equation.</p>
      <p><b>Geometric albedo</b> ${iq("(A_g)")} is the ratio of flux
      reflected at zero phase angle (full illumination, looking straight at
      the planet) compared to a Lambertian disk of the same cross-section.
      This is what observers measure from afar.</p>
      <p>They are related by the phase integral ${iq("q")}:</p>
      ${eq("A_B = A_g \\times q")}
      <p>For a Lambertian sphere, ${iq("q = 3/2")}, so ${iq("A_B = 1.5 A_g")}.
      Real planets have ${iq("q")} values between 0.5 and 2.0 depending on
      surface and atmospheric scattering properties.</p>
      ${dataTable(
        ["Body", "Bond albedo", "Geometric albedo"],
        [
          ["Mercury", "0.07", "0.14"],
          ["Venus", "0.76", "0.67"],
          ["Earth", "0.30", "0.37"],
          ["Moon", "0.12", "0.12"],
          ["Mars", "0.25", "0.17"],
          ["Jupiter", "0.50", "0.52"],
          ["Enceladus", "0.81", "1.38"],
        ],
      )}
      <p>Note that geometric albedo can exceed 1.0 (as for Enceladus) because
      a strongly forward-scattering or specularly reflective surface can
      outperform a Lambertian reference at zero phase angle.</p>
      ${cite("Mallama, A. & Hilton, J. L. (2018), Astron. Comput. 25, 10.")}`,
      mode,
    ),

    /* ── 3. The Greenhouse Effect ── */
    concept(
      "The Greenhouse Effect",
      `<p>The greenhouse effect is the process by which certain gases in a
      planet's atmosphere trap outgoing heat, warming the surface above
      the bare equilibrium temperature. Without any greenhouse effect,
      Earth's average temperature would be about -18 degrees Celsius instead
      of the current +15 degrees Celsius.</p>
      <p>Here is how it works: sunlight passes through the atmosphere and warms
      the surface. The warm surface radiates heat back upward as infrared
      radiation. Greenhouse gases (CO₂, H₂O, CH₄) absorb some of this
      outgoing infrared and re-emit it in all directions, including back
      toward the surface. This extra downward radiation warms the surface
      further.</p>
      <p>The effect can run away. If the surface gets hot enough to evaporate
      all surface water, the water vapour itself is a powerful greenhouse gas,
      trapping even more heat. This runaway greenhouse is likely what happened
      to Venus.</p>
      ${analogy("The greenhouse effect works like a blanket on a cold night. Your body radiates heat; the blanket does not add heat, but it traps some of the heat you are already producing and sends it back to you, keeping you warmer than you would be without it.")}
      ${keyIdea("Greenhouse gases let sunlight in but trap outgoing heat, warming the surface. Too much greenhouse gas can trigger a runaway that boils away oceans.")}`,

      `<p>The greenhouse warming can be parameterised as an additive temperature
      increment ${iq("\\Delta T_g")} above the equilibrium temperature:</p>
      ${eq("T_{\\text{surf}} = T_{\\text{eq}} + \\Delta T_g")}
      <p>The optical depth ${iq("\\tau")} of the atmosphere in the infrared
      governs the greenhouse strength. For a grey atmosphere:</p>
      ${eq("T_{\\text{surf}} = T_{\\text{eq}} \\left(1 + \\frac{3\\tau}{4}\\right)^{1/4}")}
      ${vars([
        ["T_{\\text{surf}}", "actual surface temperature (K)"],
        ["T_{\\text{eq}}", "equilibrium temperature (K)"],
        ["\\tau", "infrared optical depth"],
        ["\\Delta T_g", "greenhouse temperature increment (K)"],
      ])}
      <p>For Earth, ${iq("\\tau \\approx 1.9")} and ${iq("\\Delta T_g \\approx 33")} K.</p>
      <p>A <b>runaway greenhouse</b> occurs when the outgoing longwave
      radiation reaches a maximum (the Simpson-Nakajima limit,
      ${iq("\\sim 282")} W/m² for water vapour) and the planet absorbs more
      energy than it can radiate. The surface temperature increases without
      bound until all surface water is vaporised and eventually
      photodissociated.</p>
      ${dataTable(
        ["Planet", "T_eq (K)", "T_surf (K)", "Greenhouse effect (K)"],
        [
          ["Venus", "227", "737", "+510"],
          ["Earth", "255", "288", "+33"],
          ["Mars", "210", "218", "+8"],
          ["Titan", "82", "94", "+12"],
        ],
      )}
      ${cite("Pierrehumbert, R. T. (2010), Principles of Planetary Climate, Cambridge Univ. Press; Nakajima, S. et al. (1992), J. Atmos. Sci. 49, 2256.")}`,
      mode,
    ),

    /* ── 4. Boiling Point and Water ── */
    concept(
      "Boiling Point and Water",
      `<p>Whether liquid water can exist on a planet's surface depends on both
      temperature and atmospheric pressure. Water boils when its vapour
      pressure equals the surrounding atmospheric pressure. At lower
      pressures, water boils at lower temperatures.</p>
      <p>On Earth at sea level (1 atmosphere of pressure), water boils at
      100 degrees Celsius. On top of Mount Everest, where the pressure is
      about one-third of sea level, water boils at roughly 70 degrees
      Celsius. On Mars, with its extremely thin atmosphere (0.6% of Earth's),
      liquid water would boil almost instantly at any temperature above about
      0 degrees Celsius.</p>
      <p>This means that surface pressure is just as important as temperature
      when determining whether a planet can have oceans, lakes, or rivers.</p>
      ${analogy("Think of a pressure cooker in reverse. A pressure cooker raises the pressure so water boils at a higher temperature (useful for cooking). A planet with thin atmosphere is the opposite: water boils at a lower temperature, making surface liquid harder to maintain.")}
      ${keyIdea("Liquid water requires both the right temperature AND enough atmospheric pressure. Low-pressure worlds cannot sustain surface water even at moderate temperatures.")}`,

      `<p>The boiling point of water as a function of pressure is described by
      the Clausius-Clapeyron relation. For an idealised single-component
      system:</p>
      ${eq("\\frac{1}{T_{\\text{boil}}} = \\frac{1}{373.15} - \\frac{R \\ln(P / 101325)}{L_v}")}
      ${vars([
        ["T_{\\text{boil}}", "boiling point (K)"],
        ["R", "specific gas constant for water (461.5 J kg⁻¹ K⁻¹)"],
        ["P", "surface pressure (Pa)"],
        ["L_v", "latent heat of vaporisation (2.26 x 10⁶ J/kg)"],
        ["373.15", "boiling point at 1 atm (K)"],
        ["101325", "standard atmosphere (Pa)"],
      ])}
      <p>The triple point of water (611 Pa, 273.16 K) sets the absolute minimum
      pressure for liquid water to exist. Below 611 Pa, water can only exist
      as ice or vapour.</p>
      ${dataTable(
        ["Pressure", "T_boil (C)", "Context"],
        [
          ["0.006 atm (611 Pa)", "0.01", "Triple point (Mars-like)"],
          ["0.01 atm", "7", "Very thin atmosphere"],
          ["0.1 atm", "46", "High altitude on Earth"],
          ["1.0 atm", "100", "Earth sea level"],
          ["10 atm", "180", "Venus-like pressure range"],
          ["92 atm", "~300", "Venus surface pressure"],
        ],
      )}
      <p>For worldbuilding, the phase diagram of water determines whether a
      planet can sustain surface oceans. A planet with ${iq("T_{\\text{surf}}")}
      between the freezing and boiling points at its surface pressure lies in
      the "liquid water zone" of the phase diagram.</p>
      ${cite("Clausius, R. (1850), Ann. Phys. 155, 500; Pierrehumbert, R. T. (2010), Principles of Planetary Climate.")}`,
      mode,
    ),

    /* ── Calculator ── */
    tryIt(
      "Equilibrium Temperature Calculator",
      tryRow(
        `<label for="l10Lum">Stellar luminosity (L&#9737;)</label>`,
        `<input type="number" id="l10Lum" value="1.0" min="0.001" max="100" step="0.001">
         <input type="range" id="l10LumSlider" min="0.001" max="100" step="0.001" value="1.0">`,
      ) +
        tryRow(
          `<label for="l10Dist">Orbital distance (AU)</label>`,
          `<input type="number" id="l10Dist" value="1.0" min="0.1" max="10" step="0.01">
           <input type="range" id="l10DistSlider" min="0.1" max="10" step="0.01" value="1.0">`,
        ) +
        tryRow(
          `<label for="l10Albedo">Albedo</label>`,
          `<input type="number" id="l10Albedo" value="0.3" min="0" max="0.9" step="0.01">
           <input type="range" id="l10AlbedoSlider" min="0" max="0.9" step="0.01" value="0.3">`,
        ) +
        tryOutput("l10Teq", "Equilibrium temperature (K): "),
    ),
  ].join("");
}

/** Bind interactive calculator elements for Lesson 10. */
export function wireLesson10(root) {
  const lumInp = root.querySelector("#l10Lum");
  const lumSlider = root.querySelector("#l10LumSlider");
  const distInp = root.querySelector("#l10Dist");
  const distSlider = root.querySelector("#l10DistSlider");
  const albInp = root.querySelector("#l10Albedo");
  const albSlider = root.querySelector("#l10AlbedoSlider");
  const teqOut = root.querySelector("#l10Teq");
  if (!lumInp) return;

  function update() {
    const lum = parseFloat(lumInp.value) || 1;
    const dist = parseFloat(distInp.value) || 1;
    const albedo = parseFloat(albInp.value) || 0;
    lumSlider.value = lum;
    distSlider.value = dist;
    albSlider.value = albedo;

    // T_eq = 278.5 * L^0.25 / a^0.5 * (1 - A)^0.25
    const teq = ((278.5 * Math.pow(lum, 0.25)) / Math.pow(dist, 0.5)) * Math.pow(1 - albedo, 0.25);
    teqOut.textContent = fmt(teq, 1);
  }

  lumInp.addEventListener("input", update);
  lumSlider.addEventListener("input", () => {
    lumInp.value = lumSlider.value;
    update();
  });
  distInp.addEventListener("input", update);
  distSlider.addEventListener("input", () => {
    distInp.value = distSlider.value;
    update();
  });
  albInp.addEventListener("input", update);
  albSlider.addEventListener("input", () => {
    albInp.value = albSlider.value;
    update();
  });
  update();
}
