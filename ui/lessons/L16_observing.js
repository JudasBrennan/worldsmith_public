/**
 * Lesson 16 — Observing the Sky
 *
 * Covers stellar magnitudes, apparent vs absolute magnitude, phase
 * functions, angular size, and visibility thresholds.  Includes an
 * apparent-magnitude calculator.
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

export function buildLesson16(mode) {
  return [
    /* 1 ── Stellar Magnitudes ──────────────────────────────────────── */
    concept(
      "Stellar Magnitudes",
      /* basic */
      `<p>Astronomers measure the brightness of stars on a scale called
        <strong>magnitude</strong>. It is one of the oldest measurement
        systems in science, dating back over two thousand years to the
        Greek astronomer Hipparchus.</p>
      <p>The magnitude scale is counterintuitive: <strong>brighter objects
        have lower (or more negative) numbers</strong>. A star of magnitude
        1 is brighter than a star of magnitude 3. The Sun, the brightest
        object in our sky, has a magnitude of about -27.</p>
      <p>The scale is also logarithmic. A difference of 5 magnitudes
        corresponds to exactly a 100-fold difference in brightness. Each
        single step in magnitude is about 2.5 times brighter or dimmer.</p>
      ${analogy("Think of magnitude like a golf score -- lower is better. And just as a few strokes can separate an amateur from a professional, a few magnitudes separate a dim star from a blazing one, because each step multiplies the brightness by 2.5.")}
      ${keyIdea("The magnitude scale runs backwards (brighter = lower number) and is logarithmic: every 5 magnitudes equals a 100-fold brightness difference.")}`,

      /* advanced */
      `<p>The modern magnitude system is defined so that a difference of
        5 magnitudes corresponds to a flux ratio of exactly 100. The
        absolute visual magnitude of the Sun is:</p>
      ${eq("M_V^\\odot = 4.81")}
      <p>Absolute magnitude ${iq("M_V")} is related to luminosity by:</p>
      ${eq("M_V = 4.81 - 2.5\\,\\log_{10}\\!\\left(\\frac{L}{L_\\odot}\\right)")}
      <p>The apparent magnitude ${iq("m")} incorporates distance through
        the <strong>distance modulus</strong>:</p>
      ${eq("m = M + 5\\,\\log_{10}\\!\\left(\\frac{d}{10\\;\\text{pc}}\\right)")}
      ${vars([
        ["M_V", "absolute visual magnitude"],
        ["m", "apparent magnitude"],
        ["L", "luminosity"],
        ["L_\\odot", "solar luminosity"],
        ["d", "distance in parsecs"],
      ])}
      <p>The zero-point of the system is historically anchored to Vega
        (${iq("m_V \\approx 0.03")}), though modern photometry uses the AB
        magnitude system with a fixed spectral flux density reference.</p>
      ${cite("Pogson (1856, MNRAS 17, 12); Bessell (2005, ARA&A 43, 293)")}`,
      mode,
    ),

    /* 2 ── Apparent vs Absolute Magnitude ──────────────────────────── */
    concept(
      "Apparent vs Absolute Magnitude",
      /* basic */
      `<p>There is a crucial difference between how bright a star
        <em>actually is</em> and how bright it <em>looks</em> from where
        you are standing.</p>
      <ul>
        <li><strong>Absolute magnitude</strong> is the star's intrinsic
            brightness -- how bright it would appear from a standard
            distance (astronomers use 10 parsecs, about 32.6 light-years).
            This is a property of the star itself.</li>
        <li><strong>Apparent magnitude</strong> is how bright it looks from
            your actual location. A nearby dim star can outshine a distant
            brilliant one.</li>
      </ul>
      ${analogy("A candle held at arm's length looks brighter than a bonfire on a distant hillside. The bonfire has a much higher intrinsic brightness (absolute magnitude), but the candle has a higher apparent brightness because it is so much closer.")}
      ${keyIdea("Absolute magnitude measures intrinsic brightness (a property of the star). Apparent magnitude measures observed brightness (which depends on distance).")}`,

      /* advanced */
      `<p>The relationship between apparent magnitude ${iq("m")}, absolute
        magnitude ${iq("M")}, and distance ${iq("d")} in parsecs is given
        by the distance modulus:</p>
      ${eq("m - M = 5\\,\\log_{10}(d) - 5")}
      <p>Equivalently, solving for distance:</p>
      ${eq("d = 10^{(m - M + 5)/5}\\;\\text{pc}")}
      <p>The flux received from a source at distance ${iq("d")} follows the
        inverse-square law:</p>
      ${eq("F = \\frac{L}{4\\pi d^2}")}
      <p>Two stars with apparent magnitudes ${iq("m_1")} and ${iq("m_2")}
        have a flux ratio of:</p>
      ${eq("\\frac{F_1}{F_2} = 10^{(m_2 - m_1)/2.5}")}
      ${vars([
        ["m - M", "distance modulus"],
        ["d", "distance (pc)"],
        ["F", "flux (W/m^2)"],
        ["L", "luminosity (W)"],
      ])}
      ${cite("Carroll & Ostlie (2017), An Introduction to Modern Astrophysics, Ch. 3")}`,
      mode,
    ),

    /* 3 ── Phase Functions ─────────────────────────────────────────── */
    concept(
      "Phase Functions",
      /* basic */
      `<p>Not every object in the sky shines with the same brightness at all
        times. Planets and moons reflect starlight, and the amount of light
        you see depends on the <strong>phase angle</strong> -- the angle
        between the star, the object, and your eye.</p>
      <p>The Moon is the most familiar example. At full Moon (phase angle
        near zero), you see the entire sunlit face and the Moon is at its
        brightest. As it moves to a crescent (large phase angle), most of
        the sunlit face is turned away from you and it appears much
        dimmer.</p>
      <p>Different kinds of surfaces reflect light differently. An airless,
        rocky body like the Moon has a strong "opposition surge" -- a spike
        in brightness right at full phase. A cloudy gas giant scatters light
        more evenly.</p>
      ${analogy("Hold a ball under a lamp. When you look at it from the same direction as the lamp, the whole lit face is visible (full phase). Move to the side and you see a crescent of light on the edge. The ball has not changed, only your viewing angle.")}
      ${keyIdea("A body's brightness depends on the phase angle. Full phase (facing the star) is brightest; crescent phase is dimmest. The exact curve depends on whether the surface is rocky, icy, or cloudy.")}`,

      /* advanced */
      `<p>The phase function ${iq("\\Phi(\\alpha)")} describes how a body's
        reflected brightness varies with phase angle ${iq("\\alpha")}
        (star-object-observer angle). It is normalised so that
        ${iq("\\Phi(0) = 1")} at opposition.</p>
      <p>For <strong>airless bodies</strong>, the IAU Bowell H-G system
        models the phase curve as:</p>
      ${eq("\\Phi(\\alpha) = (1 - G)\\,\\Phi_1(\\alpha) + G\\,\\Phi_2(\\alpha)")}
      ${vars([
        ["\\alpha", "phase angle (degrees)"],
        ["G", "slope parameter (0 = dark/rough, ~0.4 = moderate, ~0.8 = bright/icy)"],
        ["\\Phi_1,\\;\\Phi_2", "basis functions (empirical spline fits)"],
      ])}
      <p>Typical ${iq("G")} values: lunar regolith ~0.12, S-type asteroids
        ~0.23, C-type ~0.15, icy satellites ~0.7.</p>
      <p>For <strong>atmosphered bodies</strong>, Lambert sphere scattering
        provides a first approximation:</p>
      ${eq("\\Phi_\\text{Lambert}(\\alpha) = \\frac{1}{\\pi}\\left[\\sin\\alpha + (\\pi - \\alpha)\\cos\\alpha\\right]")}
      <p>Gas giants with thick cloud decks approximate Lambertian
        scattering, while rocky atmosphered worlds lie between the
        Lambertian and Bowell models depending on cloud cover.</p>
      ${cite("Bowell et al. (1989, in Asteroids II, 524); Mallama & Hilton (2018, A&A 612, A65)")}`,
      mode,
    ),

    /* 4 ── Angular Size ────────────────────────────────────────────── */
    concept(
      "Angular Size",
      /* basic */
      `<p>How big something <em>looks</em> in the sky depends on both its
        actual size and how far away it is. Astronomers call this the
        <strong>angular size</strong> (or angular diameter).</p>
      <p>A remarkable coincidence: the Moon and the Sun appear almost exactly
        the same angular size in Earth's sky (about half a degree), even
        though the Sun is roughly 400 times larger -- because it is also
        about 400 times farther away. This is why total solar eclipses are
        possible.</p>
      <p>Angular sizes are measured in degrees, arcminutes (1/60 of a
        degree), and arcseconds (1/60 of an arcminute). The full Moon spans
        about 31 arcminutes. Most stars are so far away that they appear as
        mere points -- their angular size is far too small to resolve.</p>
      ${keyIdea("Angular size depends on both physical size and distance. The Moon and Sun look the same size because their size-to-distance ratios happen to match.")}`,

      /* advanced */
      `<p>The angular diameter ${iq("\\delta")} of a body of physical
        radius ${iq("R")} at distance ${iq("d")} (where
        ${iq("R \\ll d")}) is:</p>
      ${eq("\\delta = \\frac{2R}{d}\\;\\text{rad}")}
      <p>Converting to more practical units:</p>
      ${eq("\\delta_{\\text{arcmin}} = \\frac{2R}{d} \\times \\frac{180 \\times 60}{\\pi}")}
      ${eq("\\delta_{\\text{arcsec}} = \\frac{2R}{d} \\times \\frac{180 \\times 3600}{\\pi}")}
      ${vars([
        ["\\delta", "angular diameter"],
        ["R", "physical radius of the body"],
        ["d", "distance to the body"],
      ])}
      <p>Reference angular diameters as seen from Earth:</p>
      ${dataTable(
        ["Object", "Angular diameter", "Physical diameter"],
        [
          ["Sun", "31.6--32.7 arcmin", "1.39 \\times 10^6 km"],
          ["Moon", "29.3--34.1 arcmin", "3,474 km"],
          ["Jupiter (opposition)", "~47 arcsec", "139,820 km"],
          ["Mars (opposition)", "~25 arcsec", "6,779 km"],
          ["Alpha Centauri A", "~0.007 arcsec", "1.22 R\\(_{\\odot}\\)"],
        ],
      )}
      <p>The diffraction limit of a telescope with aperture ${iq("D")} at
        wavelength ${iq("\\lambda")} is
        ${iq("\\theta \\approx 1.22\\,\\lambda / D")}, setting the minimum
        resolvable angular size.</p>
      ${cite("Carroll & Ostlie (2017), Ch. 6; Rayleigh (1879, Phil. Mag. 8, 261)")}`,
      mode,
    ),

    /* 5 ── Visibility ──────────────────────────────────────────────── */
    concept(
      "Visibility",
      /* basic */
      `<p>How bright does something need to be for you to see it? That
        depends on your equipment:</p>
      <ul>
        <li><strong>Naked eye:</strong> On a clear, dark night with no light
            pollution, the human eye can see stars down to about magnitude 6.
            That gives roughly 5,000 to 9,000 visible stars across the whole
            sky.</li>
        <li><strong>Binoculars:</strong> A good pair of binoculars pushes
            the limit to about magnitude 9 or 10, revealing tens of thousands
            more stars and some deep-sky objects.</li>
        <li><strong>Amateur telescope:</strong> A modest backyard telescope
            can reach magnitude 12 to 14, enough to see distant galaxies and
            faint nebulae.</li>
        <li><strong>Professional observatories:</strong> Ground-based
            telescopes reach magnitude 24 or deeper. Space telescopes like
            Hubble push to magnitude 30, detecting objects nearly four
            billion times fainter than the naked eye limit.</li>
      </ul>
      ${keyIdea("The naked eye can see to about magnitude 6. Each improvement in technology pushes the limit deeper, revealing exponentially more of the universe.")}`,

      /* advanced */
      `<p>Visibility thresholds can be categorised by apparent magnitude:</p>
      ${dataTable(
        ["Category", "Apparent magnitude", "Notes"],
        [
          ["Naked eye (bright)", "< 2", "Prominent stars visible even in light-polluted skies"],
          ["Naked eye (faint)", "2--5", "Visible from suburban locations"],
          ["Naked eye limit", "5--6", "Requires dark sky (Bortle 3 or better)"],
          ["Possibly visible", "6--7", "Averted vision, excellent conditions"],
          ["Binocular", "7--10", "Compact optics, ~50 mm aperture"],
          ["Small telescope", "10--14", "100--200 mm aperture"],
          ["Large telescope", "14--24", "Professional ground-based"],
          ["Space telescope", "24--30", "HST, JWST; above atmospheric seeing"],
        ],
      )}
      <p>The limiting magnitude of a telescope of aperture ${iq("D")} (mm)
        is approximately:</p>
      ${eq("m_{\\text{lim}} \\approx 2.7 + 5\\,\\log_{10}(D)")}
      <p>This assumes ideal conditions. Atmospheric seeing, sky background,
        detector quantum efficiency, and exposure time all affect the
        practical limit. The signal-to-noise ratio for point-source
        detection scales as:</p>
      ${eq("\\text{SNR} \\propto F \\cdot D^2 \\cdot \\sqrt{t}")}
      ${vars([
        ["m_{\\text{lim}}", "limiting magnitude"],
        ["D", "aperture diameter (mm)"],
        ["F", "source flux"],
        ["t", "exposure time"],
      ])}
      ${cite("Schaefer (1990, PASP 102, 212); North (2004, Observing Variable Stars, Springer)")}`,
      mode,
    ),

    /* ── Mini-calculator ───────────────────────────────────────────── */
    tryIt(
      "Apparent Magnitude",
      `${tryRow(
        `<label for="les16-absmag">Absolute magnitude (M)</label>`,
        `<input id="les16-absmag" type="number" min="-10" max="20" step="0.01" value="4.81">
         <input id="les16-absmagSlider" type="range" min="-10" max="20" step="0.01" value="4.81">`,
      )}
      ${tryRow(
        `<label for="les16-dist">Distance (parsecs)</label>`,
        `<input id="les16-dist" type="number" min="1" max="10000" step="1" value="10">
         <input id="les16-distSlider" type="range" min="1" max="10000" step="1" value="10">`,
      )}
      ${tryOutput("les16-appmag", "Apparent magnitude (m): ")}`,
    ),
  ].join("");
}

/* ── wire ──────────────────────────────────────────────────────────── */

export function wireLesson16(root) {
  const inpM = root.querySelector("#les16-absmag");
  const sliderM = root.querySelector("#les16-absmagSlider");
  const inpD = root.querySelector("#les16-dist");
  const sliderD = root.querySelector("#les16-distSlider");
  const out = root.querySelector("#les16-appmag");
  if (!inpM || !sliderM || !inpD || !sliderD || !out) return;

  function update() {
    const absMag = parseFloat(inpM.value) || 4.81;
    const dist = parseFloat(inpD.value) || 10;
    sliderM.value = absMag;
    sliderD.value = dist;
    const appMag = absMag + 5 * Math.log10(dist) - 5;
    out.textContent = fmt(appMag, 2);
  }

  inpM.addEventListener("input", update);
  sliderM.addEventListener("input", () => {
    inpM.value = sliderM.value;
    update();
  });
  inpD.addEventListener("input", update);
  sliderD.addEventListener("input", () => {
    inpD.value = sliderD.value;
    update();
  });
  update();
}
