// SPDX-License-Identifier: MPL-2.0
/**
 * Lesson 11 — Gas Giants
 *
 * Covers the two families of giant planets, the mass-radius relationship,
 * atmospheric classification (Sudarsky classes), banded wind patterns,
 * and photoevaporation of close-in giants.  Includes a mini-calculator
 * that estimates giant-planet radius from mass using Chen & Kipping (2017).
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

import { fmt } from "../../engine/utils.js";

/* ── build ─────────────────────────────────────────────────────────── */

export function buildLesson11(mode) {
  return [
    /* 1 ── Two Families of Giants ──────────────────────────────────── */
    concept(
      "Two Families of Giants",
      /* basic */
      `<p>Not all giant planets are alike. There are two broad families:</p>
      <ul>
        <li><strong>Gas giants</strong> (Jupiter and Saturn) are dominated by
            hydrogen and helium. They are massive, low-density worlds with
            deep, crushing atmospheres and no solid surface.</li>
        <li><strong>Ice giants</strong> (Uranus and Neptune) are smaller and
            richer in heavier substances such as water, ammonia, and methane.
            Despite the name, these "ices" exist as hot, dense fluids deep
            inside the planet, not as solid ice.</li>
      </ul>
      ${analogy("Think of gas giants as enormous balls of the lightest gases in the universe, while ice giants are like smaller, denser slush balls wrapped in a thinner blanket of hydrogen.")}
      ${keyIdea("Jupiter and Saturn are gas-heavy giants made mostly of hydrogen and helium. Uranus and Neptune are ice-heavy giants with a much larger fraction of water, ammonia, and methane.")}`,

      /* advanced */
      `<p>The giant-planet dichotomy reflects formation history and bulk
        composition. Gas giants (Jovian worlds) accreted massive hydrogen-helium
        envelopes onto ~10 ${iq("M_\\oplus")} rock-ice cores during the
        protoplanetary disk phase, while ice giants captured much thinner
        envelopes before the disk dispersed.</p>
      <p>The empirical mass boundary between Neptunian and Jovian regimes lies
        near ${iq("\\sim 0.15\\,M_\\text{Jup}")} (about 48 ${iq("M_\\oplus")}),
        where the mass-radius power law changes slope
        (Chen &amp; Kipping 2017).</p>
      ${dataTable(
        ["Property", "Gas giant (Jovian)", "Ice giant (Neptunian)"],
        [
          ["Composition", "~90% H/He by mass", "~20% H/He, ~60-80% ices"],
          ["Core mass", "~10-20 M\\(_{\\oplus}\\)", "~10-15 M\\(_{\\oplus}\\)"],
          ["Envelope", "Deep H/He convective", "Thin H/He over ionic ocean"],
          ["Interior", "Metallic hydrogen layer", "Superionic water mantle"],
          ["Solar system examples", "Jupiter, Saturn", "Uranus, Neptune"],
        ],
      )}
      ${cite("Helled et al. (2020, Space Sci. Rev. 216, 38); Chen & Kipping (2017, ApJ 834, 17)")}`,
      mode,
    ),

    /* 2 ── The Mass-Radius Puzzle ──────────────────────────────────── */
    concept(
      "The Mass-Radius Puzzle",
      /* basic */
      `<p>You might expect that a heavier planet would always be larger, and
        for rocky and Neptune-sized worlds that is true. But for gas giants,
        something strange happens: once a planet exceeds roughly one Jupiter
        mass, adding <em>more</em> mass actually makes it <em>smaller</em>.</p>
      <p>Why? At extreme pressures the interior gas becomes so compressed that
        the planet's self-gravity wins. The extra mass squeezes the planet
        down faster than it puffs it up. Jupiter is close to the maximum
        size a cold hydrogen planet can reach.</p>
      ${analogy("Imagine stuffing more and more cotton into a bag while also squeezing it tighter. At some point the squeezing wins and the bag starts to shrink even as you add more cotton.")}
      ${keyIdea("Below about one Jupiter mass, bigger mass means bigger planet. Above that threshold, gravity compresses the interior so efficiently that the planet actually shrinks as you add mass.")}`,

      /* advanced */
      `<p>Chen &amp; Kipping (2017) fit a broken power law to the observed
        mass-radius relation across the Neptunian and Jovian regimes:</p>
      <p><strong>Neptunian regime</strong>
        (${iq("2.04 \\leq M \\leq 131.6\\,M_\\oplus")}):</p>
      ${eq("R = 0.861\\;M^{0.53}\\;R_\\oplus")}
      <p><strong>Jovian regime</strong>
        (${iq("M > 131.6\\,M_\\oplus")}):</p>
      ${eq("R \\propto M^{-0.044}")}
      <p>The transition at 131.6 ${iq("M_\\oplus")} (~0.414 ${iq("M_\\text{Jup}")})
        marks the onset of electron degeneracy pressure in the interior.
        Above this mass, the equation of state stiffens and the radius
        plateaus or decreases — the planet behaves more like a degenerate
        object than a compressible gas sphere.</p>
      ${vars([
        ["R", "planet radius"],
        ["M", "planet mass (in M_\\oplus)"],
        ["0.53", "Neptunian power-law exponent"],
        ["-0.044", "Jovian power-law exponent (near-constant radius)"],
      ])}
      ${cite("Chen & Kipping (2017, ApJ 834, 17)")}`,
      mode,
    ),

    /* 3 ── Atmospheric Classification ──────────────────────────────── */
    concept(
      "Atmospheric Classification",
      /* basic */
      `<p>The appearance of a giant planet depends mostly on its temperature,
        which is set by how close it orbits its star. Astronomers group giant
        atmospheres into five classes:</p>
      ${dataTable(
        ["Class", "Temperature", "Cloud type", "Appearance"],
        [
          ["I", "< 150 K", "Ammonia ice", "Pale, banded (like Jupiter)"],
          ["II", "150 - 250 K", "Water clouds", "Bright white, high albedo"],
          ["III", "250 - 800 K", "No deep clouds", "Blue, featureless"],
          ["IV", "800 - 1500 K", "Alkali metals, silicates", "Dark, reddish"],
          ["V", "> 1500 K", "Iron, silicate rain", "Glowing, very dark"],
        ],
      )}
      <p>Cold giants like Jupiter and Saturn belong to Class I. The hottest
        "hot Jupiters" belong to Class V, where iron condenses into droplets
        and rains down through the atmosphere.</p>
      ${keyIdea("A giant planet's cloud type and colour depend on its temperature. Cold giants have ammonia clouds; the hottest giants have iron rain.")}`,

      /* advanced */
      `<p>Sudarsky et al. (2000, 2003) proposed five equilibrium classes for
        giant-planet atmospheres based on condensation chemistry:</p>
      ${dataTable(
        ["Class", "T\\(_{\\text{eq}}\\) (K)", "Condensates", "Bond albedo"],
        [
          ["I", "< 150", "NH\\(_{3}\\) ice", "~0.57"],
          ["II", "150 - 250", "H\\(_{2}\\)O clouds", "~0.81"],
          ["III", "250 - 800", "Clear (no condensates)", "~0.12"],
          ["IV", "800 - 1500", "Na, K, FeH, silicates", "~0.03"],
          ["V", "> 1500", "Fe, Al\\(_{2}\\)O\\(_{3}\\), silicate rain", "~0.02"],
        ],
      )}
      <p>The condensation sequence follows the Lodders &amp; Fegley (2002)
        thermochemical equilibrium models. At low ${iq("T_{\\text{eq}}")},
        ammonia ice dominates the cloud deck; as temperature rises, successive
        species sublimate until only refractory silicates and metals remain.
        Class III worlds are notably cloud-free, producing strong Rayleigh
        scattering (hence blue colour).</p>
      ${vars([
        ["T_{\\text{eq}}", "equilibrium temperature"],
        ["A_B", "Bond albedo (fraction of total incident energy reflected)"],
      ])}
      ${cite("Sudarsky, Burrows & Pinto (2000, ApJ 538, 885); Lodders & Fegley (2002, Icarus 155, 393)")}`,
      mode,
    ),

    /* 4 ── Atmospheric Bands and Winds ─────────────────────────────── */
    concept(
      "Atmospheric Bands and Winds",
      /* basic */
      `<p>Jupiter's distinctive stripes are not just decoration — they reveal
        a powerful atmospheric engine. Fast rotation (a Jupiter day is under
        10 hours) stretches weather patterns into east-west bands. Light-coloured
        bands (zones) are regions of rising air; dark bands (belts) are regions
        of sinking air.</p>
      <p>Wind speeds at the boundary between bands can exceed 400 km/h. Saturn
        shows a similar pattern, while the ice giants have fewer, broader bands
        but some of the highest wind speeds in the solar system (up to 2,100 km/h
        on Neptune).</p>
      ${analogy("Imagine spinning a ball of coloured fluids very quickly on its axis. The colours would stretch into horizontal stripes — that is essentially what rapid rotation does to a giant planet's weather patterns.")}
      ${keyIdea("Giant planets spin fast, and that rotation organises their atmospheres into alternating bands of rising and sinking air with powerful east-west winds.")}`,

      /* advanced */
      `<p>Zonal wind structure in giant atmospheres is governed by the Rhines
        scale, which predicts the characteristic width of alternating
        prograde/retrograde jets:</p>
      ${eq("L_\\text{Rh} \\sim \\sqrt{\\frac{U}{\\beta}}")}
      ${vars([
        ["L_\\text{Rh}", "Rhines scale (meridional jet width)"],
        ["U", "characteristic wind speed"],
        ["\\beta", "meridional gradient of the Coriolis parameter = 2\\Omega\\cos\\phi / R_p"],
      ])}
      <p>The number of zonal bands visible on a giant planet scales roughly
        as:</p>
      ${eq("N_\\text{bands} \\sim \\frac{\\pi R_p}{L_\\text{Rh}}")}
      <p>Faster rotation (larger ${iq("\\Omega")}) increases ${iq("\\beta")},
        shrinks the Rhines scale, and produces more, narrower bands. This
        explains why Jupiter (~10 h rotation) shows many fine bands while
        slowly rotating bodies show fewer.</p>
      <p>Deep wind structure remains debated: Juno gravity data suggest
        Jupiter's zonal winds extend ~3,000 km deep, transitioning to a
        rigidly rotating interior where electrical conductivity damps
        differential flow.</p>
      ${cite("Vasavada & Showman (2005, Rep. Prog. Phys. 68, 1935); Kaspi et al. (2018, Nature 555, 223)")}`,
      mode,
    ),

    /* 5 ── Photoevaporation ────────────────────────────────────────── */
    concept(
      "Photoevaporation",
      /* basic */
      `<p>A giant planet orbiting very close to its star is bathed in intense
        radiation. Over time this radiation heats the upper atmosphere enough
        for gas to escape into space. The planet is, in effect, slowly
        boiling away.</p>
      <p>This process, called photoevaporation, is why we see a "hot Neptune
        desert" in the exoplanet population — medium-sized giants close to
        their stars are rare, because they lose their atmospheres and shrink.
        Only the most massive hot Jupiters have enough gravity to hold on to
        their envelopes.</p>
      ${analogy("Picture leaving an ice cube on a hot pavement. A large ice cube lasts longer because it has more material to lose. A small one disappears quickly. Hot Neptunes are the small ice cubes of the exoplanet world.")}
      ${keyIdea("Stars can strip away a close-in giant's atmosphere over time. Smaller giants lose gas faster, which is why medium-sized planets are rare in very tight orbits.")}`,

      /* advanced */
      `<p>Energy-limited atmospheric escape models estimate the mass-loss
        rate from XUV irradiation:</p>
      ${eq("\\dot{M} = \\frac{\\varepsilon\\;\\pi\\;R_p^3\\;F_\\text{XUV}}{G\\;M_p\\;K_\\text{tide}}")}
      ${vars([
        ["\\dot{M}", "mass-loss rate (kg/s)"],
        ["\\varepsilon", "heating efficiency (~0.10 - 0.25, typical 0.15)"],
        ["R_p", "planetary radius (at XUV photosphere)"],
        ["F_\\text{XUV}", "incident XUV flux at planet's orbit"],
        ["M_p", "planet mass"],
        ["K_\\text{tide}", "tidal correction factor (reduces effective potential)"],
      ])}
      <p>For a typical hot Jupiter at 0.05 AU receiving
        ${iq("F_\\text{XUV} \\sim 10^4")} erg/cm${iq("^2")}/s, the mass-loss
        rate is on the order of ${iq("10^{10}-10^{11}")} g/s. Over Gyr
        timescales this is negligible for Jupiter-mass planets but can strip
        the entire envelope of a Neptune-mass planet, producing the observed
        "evaporation desert" below ~0.1 ${iq("M_\\text{Jup}")} at small
        orbital distances.</p>
      ${cite("Murray-Clay, Chiang & Murray (2009, ApJ 693, 23); Owen & Wu (2017, ApJ 847, 29)")}`,
      mode,
    ),

    /* ── Mini-calculator ─────────────────────────────────────────── */
    tryIt(
      "Giant Planet Radius",
      `${tryRow(
        `<label for="les11-mass">Planet mass (M<sub>Jup</sub>)</label>`,
        `<input id="les11-mass" type="number" min="0.05" max="20" step="0.01" value="1.0">
         <input id="les11-massSlider" type="range" min="0.05" max="20" step="0.01" value="1.0">`,
      )}
      ${tryOutput("les11-radius", "Estimated radius (R<sub>Jup</sub>): ")}`,
    ),
  ].join("");
}

/* ── wire ──────────────────────────────────────────────────────────── */

export function wireLesson11(root) {
  const inp = root.querySelector("#les11-mass");
  const slider = root.querySelector("#les11-massSlider");
  const out = root.querySelector("#les11-radius");
  if (!inp || !slider || !out) return;

  function update() {
    const mass = parseFloat(inp.value) || 1.0;
    slider.value = mass;

    /* Chen & Kipping (2017) broken power law */
    const mEarth = mass * 317.8;
    let radius;
    if (mEarth <= 131.6) {
      radius = (0.861 * Math.pow(mEarth, 0.53)) / 11.21;
    } else {
      const cJ = 0.861 * Math.pow(131.6, 0.53) * Math.pow(131.6, 0.044);
      radius = (cJ * Math.pow(mEarth, -0.044)) / 11.21;
    }
    out.textContent = fmt(radius, 4);
  }

  inp.addEventListener("input", update);
  slider.addEventListener("input", () => {
    inp.value = slider.value;
    update();
  });
  update();
}
