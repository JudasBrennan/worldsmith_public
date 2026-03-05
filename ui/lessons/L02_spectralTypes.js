/**
 * Lesson 02 — Classifying Stars
 *
 * Covers stellar colours and temperature, the OBAFGKM spectral sequence,
 * the Hertzsprung-Russell diagram, and the MK spectral/luminosity
 * classification system.  No interactive calculator.
 */

import { concept, analogy, keyIdea, eq, iq, vars, cite, dataTable } from "./helpers.js";

/* ── build ─────────────────────────────────────────────────────────── */

export function buildLesson02(mode) {
  return [
    /* 1 ── The Rainbow of Stars ──────────────────────────────────── */
    concept(
      "The Rainbow of Stars",
      /* basic */
      `<p>Stars are not all the same colour. Some blaze blue-white, others
        glow yellow like our Sun, and many smoulder a deep orange-red. The
        colour of a star tells you its surface temperature: blue stars are
        the hottest, red stars the coolest.</p>
      <p>Astronomers sort stars into a sequence of <strong>spectral
        classes</strong> labelled with letters: O, B, A, F, G, K, M — from
        hottest to coolest. A common mnemonic is <em>"Oh Be A Fine Girl/Guy,
        Kiss Me."</em></p>
      ${analogy("A heating element on a stove follows the same pattern: it first glows dull red, then orange, then bright white as it gets hotter. Stars work the same way — colour reveals temperature.")}
      ${keyIdea("A star's colour is set by its surface temperature. The spectral sequence OBAFGKM runs from the hottest blue O-type stars (~40,000 K) down to cool red M-type stars (~3,000 K). Our Sun is a yellow-white G-type star.")}`,

      /* advanced */
      `<p>A star radiates approximately as a blackbody. The peak wavelength of
        its emission is governed by Wien's displacement law:</p>
      ${eq("\\lambda_{\\text{max}} = \\frac{b}{T}")}
      ${vars([
        ["\\lambda_{\\text{max}}", "peak emission wavelength (m)"],
        ["b", "Wien displacement constant (2.898 \\times 10^{-3}\\;\\text{m\\,K})"],
        ["T", "surface effective temperature (K)"],
      ])}
      <p>The overall spectral energy distribution follows the Planck function:</p>
      ${eq("B_\\lambda(T) = \\frac{2hc^2}{\\lambda^5}\\;\\frac{1}{e^{hc/(\\lambda k_B T)} - 1}")}
      <p>Hotter stars peak at shorter (bluer) wavelengths; cooler stars peak
        at longer (redder) wavelengths. The OBAFGKM sequence was established
        at Harvard in the early 20th century by classifying stellar absorption
        spectra and later reordered by decreasing temperature.</p>
      ${cite("Gray & Corbally (2009), Stellar Spectral Classification, Ch. 1-3")}`,
      mode,
    ),

    /* 2 ── Spectral Classes ──────────────────────────────────────── */
    concept(
      "Spectral Classes",
      /* basic */
      `<p>Each spectral class covers a range of temperatures. Here is a
        summary of the main types:</p>
      ${dataTable(
        ["Class", "Temperature (K)", "Colour", "Example"],
        [
          ["O", "30,000 -- 50,000+", "Blue", "Naos (Zeta Puppis)"],
          ["B", "10,000 -- 30,000", "Blue-white", "Rigel"],
          ["A", "7,500 -- 10,000", "White", "Sirius"],
          ["F", "6,000 -- 7,500", "Yellow-white", "Procyon"],
          ["G", "5,200 -- 6,000", "Yellow", "Sun"],
          ["K", "3,700 -- 5,200", "Orange", "Arcturus"],
          ["M", "2,400 -- 3,700", "Red", "Betelgeuse"],
        ],
      )}
      ${keyIdea("The spectral sequence OBAFGKM is a temperature sequence. Each class has distinctive absorption lines caused by elements in the star's atmosphere at that temperature.")}`,

      /* advanced */
      `<p>Spectral classification depends on the strengths of absorption lines
        in a star's spectrum, which are controlled by surface temperature
        (and, secondarily, pressure). Key diagnostics:</p>
      <ul>
        <li><strong>O</strong> — He II (ionised helium) lines; very weak
            hydrogen.</li>
        <li><strong>B</strong> — He I lines peak at B2; hydrogen lines
            strengthening.</li>
        <li><strong>A</strong> — Hydrogen Balmer lines at maximum
            strength (A0).</li>
        <li><strong>F</strong> — Ca II H &amp; K lines appear; hydrogen
            weakening.</li>
        <li><strong>G</strong> — Ca II dominant; Fe I and other metals
            prominent. The Sun is G2V.</li>
        <li><strong>K</strong> — Molecular bands begin (TiO very weak);
            strong metal lines.</li>
        <li><strong>M</strong> — TiO molecular bands dominate; very cool
            photospheres.</li>
      </ul>
      ${dataTable(
        ["Class", "T<sub>eff</sub> (K)", "Colour", "Example", "Key lines"],
        [
          ["O", "30,000 -- 50,000+", "Blue", "Naos", "He II, N III, C III"],
          ["B", "10,000 -- 30,000", "Blue-white", "Rigel", "He I, H (moderate)"],
          ["A", "7,500 -- 10,000", "White", "Sirius", "H Balmer (max), Mg II"],
          ["F", "6,000 -- 7,500", "Yellow-white", "Procyon", "Ca II, Fe I, H (weaker)"],
          ["G", "5,200 -- 6,000", "Yellow", "Sun", "Ca II (strong), Fe I, CH"],
          ["K", "3,700 -- 5,200", "Orange", "Arcturus", "Ca I, Fe I, MgH"],
          ["M", "2,400 -- 3,700", "Red", "Betelgeuse", "TiO, VO, CaOH"],
        ],
      )}
      <p>Line strengths follow the Saha and Boltzmann equations, which
        describe the ionisation and excitation state of atoms as functions of
        temperature and electron pressure.</p>
      ${cite("Gray & Corbally (2009), Stellar Spectral Classification; Carroll & Ostlie (2017), Ch. 8")}`,
      mode,
    ),

    /* 3 ── The HR Diagram ────────────────────────────────────────── */
    concept(
      "The HR Diagram",
      /* basic */
      `<p>If you plot every star on a chart with temperature on the horizontal
        axis (hot on the left, cool on the right) and luminosity on the
        vertical axis (bright at the top, dim at the bottom), most stars
        fall along a curved band called the <strong>main sequence</strong>.</p>
      <p>This chart is called the <strong>Hertzsprung-Russell (HR)
        diagram</strong>, and it is one of the most important tools in
        astrophysics. It is essentially a map of all stars, revealing three
        main populations:</p>
      <ul>
        <li><strong>Main sequence</strong> — the diagonal band where stars
            spend most of their lives fusing hydrogen.</li>
        <li><strong>Giants and supergiants</strong> — bright but cool stars
            in the upper right, which have swelled after exhausting core
            hydrogen.</li>
        <li><strong>White dwarfs</strong> — dim but hot stellar remnants in
            the lower left.</li>
      </ul>
      ${analogy("Think of the HR diagram as a census map: it does not show where stars are in space, but where they are in their lives. Most are on the main sequence; the others have moved on to later stages.")}
      ${keyIdea("The HR diagram plots temperature against luminosity. Most stars lie on the main sequence. Giants sit above it and white dwarfs below it.")}`,

      /* advanced */
      `<p>The Hertzsprung-Russell diagram is the fundamental observational
        tool for stellar astrophysics. The observational version plots
        colour index (${iq("B-V")}) or spectral type against absolute
        magnitude ${iq("M_V")}; the theoretical version plots
        ${iq("\\log T_{\\text{eff}}")} against ${iq("\\log(L/L_\\odot)")}.</p>
      <p>Key features:</p>
      <ul>
        <li><strong>Main sequence</strong> — a narrow band from upper-left
            (hot, luminous O stars) to lower-right (cool, faint M dwarfs).
            Width arises from age spread and metallicity variation.</li>
        <li><strong>Red giant branch (RGB)</strong> — stars evolving off the
            main sequence ascend this branch as hydrogen shell burning
            drives envelope expansion.</li>
        <li><strong>Horizontal branch / red clump</strong> — core-helium
            burning phase.</li>
        <li><strong>Instability strip</strong> — region crossed by Cepheids
            and RR Lyrae variables (pulsationally unstable).</li>
        <li><strong>White dwarf sequence</strong> — degenerate remnants
            cooling along lines of constant radius.</li>
      </ul>
      <p>Evolutionary tracks show how a star of a given mass moves across the
        HR diagram over time. A 1 ${iq("M_\\odot")} star spends ~10 Gyr on
        the main sequence, then crosses the Hertzsprung gap in ~1 Gyr to
        ascend the RGB.</p>
      ${cite("Kippenhahn, Weigert & Weiss (2012), Ch. 26; Hurley, Pols & Tout (2000, MNRAS 315, 543)")}`,
      mode,
    ),

    /* 4 ── Subtypes and Luminosity Classes ───────────────────────── */
    concept(
      "Subtypes and Luminosity Classes",
      /* basic */
      `<p>Each spectral letter is divided into numbered subtypes from 0
        (hottest within the class) to 9 (coolest). The Sun, for instance,
        is classified as <strong>G2</strong> — a G-type star on the hotter
        end of the G range.</p>
      <p>A Roman numeral is appended to indicate the star's size category
        (luminosity class):</p>
      <ul>
        <li><strong>I</strong> — Supergiant</li>
        <li><strong>II</strong> — Bright giant</li>
        <li><strong>III</strong> — Giant</li>
        <li><strong>IV</strong> — Subgiant</li>
        <li><strong>V</strong> — Dwarf (main-sequence star)</li>
      </ul>
      <p>So the Sun's full spectral classification is <strong>G2V</strong> — a
        G-type star, subtype 2, main-sequence dwarf.</p>
      ${keyIdea("Spectral subtypes (0--9) refine the temperature within each class. Luminosity classes (I--V) distinguish supergiants from dwarfs. The Sun is G2V.")}`,

      /* advanced */
      `<p>The <strong>Morgan-Keenan (MK) classification system</strong>
        (Morgan, Keenan & Kellman, 1943) is a two-dimensional scheme that
        encodes both temperature (spectral type + subtype) and luminosity
        (Roman numeral class):</p>
      ${dataTable(
        ["Luminosity class", "Category", "Typical log g"],
        [
          ["Ia / Ib", "Supergiant", "0.0 -- 1.5"],
          ["II", "Bright giant", "1.5 -- 2.5"],
          ["III", "Giant", "2.5 -- 3.5"],
          ["IV", "Subgiant", "3.5 -- 4.0"],
          ["V", "Dwarf (main sequence)", "4.0 -- 4.5"],
        ],
      )}
      <p>Luminosity classes are distinguished spectroscopically by
        pressure-sensitive features. At lower surface gravity (giants,
        supergiants) spectral lines are narrower because of reduced
        collisional (Stark) broadening, and certain ionisation ratios shift.
        The MK system is defined by a set of standard stars rather than by
        physical parameters, making it an empirical anchor for stellar
        astrophysics.</p>
      ${cite("Morgan, Keenan & Kellman (1943), An Atlas of Stellar Spectra; Gray & Corbally (2009), Ch. 5")}`,
      mode,
    ),
  ].join("");
}
