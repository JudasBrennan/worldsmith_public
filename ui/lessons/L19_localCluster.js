// SPDX-License-Identifier: MPL-2.0
/**
 * Lesson 19 — The Local Cluster
 *
 * Covers stellar neighbourhoods, binary and multiple stars, metallicity
 * distribution, and the galactic habitable zone.  No interactive calculator.
 */

import { concept, analogy, keyIdea, eq, iq, vars, cite, dataTable } from "./helpers.js";

/* ── build ─────────────────────────────────────────────────────────── */

export function buildLesson19(mode) {
  return [
    /* 1 ── Stellar Neighbourhoods ──────────────────────────────────── */
    concept(
      "Stellar Neighbourhoods",
      /* basic */
      `<p>If you could look at the stars near our Sun -- say, within about
        30 light-years -- you might be surprised by what you find. The
        neighbourhood is not filled with bright, Sun-like stars. Instead,
        the overwhelming majority are faint <strong>red dwarfs</strong>,
        far too dim to see with the naked eye.</p>
      <p>About three quarters of all stars in the solar neighbourhood are
        red dwarfs (spectral class M). Sun-like stars (class G) make up
        only a few percent. There are also a number of
        <strong>white dwarfs</strong> (the dead cores of former stars) and
        <strong>brown dwarfs</strong> (objects too small to sustain hydrogen
        fusion, sometimes called failed stars).</p>
      ${analogy("Imagine a town where most residents are quiet, unassuming folk who stay indoors (red dwarfs). A few are loud and visible from a distance (bright stars). And there are some retired residents (white dwarfs) and a surprising number of teenagers who never quite grew up (brown dwarfs).")}
      ${keyIdea("The solar neighbourhood is dominated by faint red dwarfs (~76% of all stars). Bright Sun-like stars are a small minority.")}`,

      /* advanced */
      `<p>Volume-limited surveys of the solar neighbourhood (typically
        within 10 pc) provide the most unbiased census of stellar
        populations. The Reyl\u00e9 et al. (2021) 10 pc sample gives:</p>
      ${dataTable(
        ["Category", "Fraction", "Count (within 10 pc)"],
        [
          ["Main-sequence stars", "72%", "~290"],
          ["White dwarfs", "6%", "~25"],
          ["Brown dwarfs (T and Y)", "19%", "~78"],
          ["Sub-brown dwarfs / planetary-mass", "3%", "~12"],
        ],
      )}
      <p>Among main-sequence stars, the spectral-class breakdown is heavily
        bottom-weighted:</p>
      ${dataTable(
        ["Spectral class", "Fraction of MS stars", "Notes"],
        [
          ["M (red dwarf)", "~76%", "Dominant population by number"],
          ["K (orange dwarf)", "~13%", "Longer-lived than G stars"],
          ["G (Sun-like)", "~6%", "Includes the Sun"],
          ["F", "~3%", "Brighter, shorter-lived"],
          ["A, B, O", "< 2%", "Rare, luminous, short-lived"],
        ],
      )}
      <p>The mass function ${iq("\\xi(M)")} (initial mass function, IMF)
        is well described by Kroupa (2001):</p>
      ${eq("\\xi(M) \\propto M^{-\\alpha}, \\quad \\alpha = \\begin{cases} 0.3 & M < 0.08 \\\\ 1.3 & 0.08 \\leq M < 0.5 \\\\ 2.3 & M \\geq 0.5 \\end{cases}")}
      <p>The steep slope above 0.5 ${iq("M_\\odot")} explains the rarity
        of massive stars.</p>
      ${cite("Reyl\u00e9 et al. (2021, A&A 650, A201); Kroupa (2001, MNRAS 322, 231)")}`,
      mode,
    ),

    /* 2 ── Binary and Multiple Stars ───────────────────────────────── */
    concept(
      "Binary and Multiple Stars",
      /* basic */
      `<p>Many stars do not travel alone. A large fraction come in pairs
        (<strong>binaries</strong>) or even triples and quadruples. The two
        stars in a binary system orbit their common centre of mass, bound
        together by gravity.</p>
      <p>Binary companions can be close (orbiting in days) or distant
        (orbiting over thousands of years). Some are so close they exchange
        material. Others are far enough apart that each could host its own
        planetary system.</p>
      <p>The fraction of stars with companions varies by type: massive,
        hot stars almost always have companions, while small red dwarfs are
        more often single.</p>
      ${analogy("Stars are like people at a dance. The brightest, most energetic dancers almost always pair up. The quieter ones (red dwarfs) are more likely to be found dancing alone.")}
      ${keyIdea("Many stars are binaries or multiples. Massive stars are almost always paired, while red dwarfs are mostly single.")}`,

      /* advanced */
      `<p>The <strong>multiplicity fraction</strong> (MF) -- the fraction
        of primary stars with at least one companion -- varies strongly
        with spectral type. The Duch\u00eane & Kraus (2013) compilation
        gives:</p>
      ${dataTable(
        ["Spectral type", "Multiplicity fraction", "Median period"],
        [
          ["O", "~70%", "~10 d"],
          ["B", "~50%", "~100 d"],
          ["A", "~48%", "~300 d"],
          ["FGK", "~46%", "~10\\(^{4.5}\\) d (~80 yr)"],
          ["M", "~27%", "~10\\(^{5}\\) d (~300 yr)"],
          ["Brown dwarfs", "~15%", "~10\\(^{1.5}\\) d (~30 d)"],
        ],
      )}
      <p>The period distribution is approximately log-normal, with the
        peak shifting to shorter periods for lower-mass primaries. The
        mass-ratio distribution ${iq("q = M_2 / M_1")} is roughly flat
        for solar-type stars but shows a preference for near-equal masses
        (${iq("q \\to 1")}) among M dwarfs.</p>
      <p>For worldbuilding, the key implication is that a randomly selected
        FGK star has roughly a 50-50 chance of having a stellar companion.
        Wide binaries (separation > 100 AU) can host S-type planets
        (orbiting one star), while close binaries may host P-type planets
        (circumbinary orbits).</p>
      ${eq("a_{\\text{stable}} \\gtrsim 3\\text{--}5 \\times a_{\\text{binary}} \\quad (\\text{P-type})")}
      ${eq("a_{\\text{stable}} \\lesssim 0.2\\text{--}0.3 \\times a_{\\text{binary}} \\quad (\\text{S-type})")}
      ${cite("Duch\u00eane & Kraus (2013, ARA&A 51, 269); Holman & Wiegert (1999, AJ 117, 621)")}`,
      mode,
    ),

    /* 3 ── Metallicity Distribution ────────────────────────────────── */
    concept(
      "Metallicity Distribution",
      /* basic */
      `<p>In astronomy, any element heavier than helium is called a
        "metal" (even carbon and oxygen). Stars formed from gas that has
        been enriched by previous generations of supernova explosions
        contain more metals. Stars formed from more pristine gas contain
        fewer.</p>
      <p>A star's <strong>metallicity</strong> is usually expressed
        relative to the Sun. A star with twice the Sun's iron content has a
        metallicity of about +0.3; one with half the Sun's iron is about
        -0.3. Most stars in the solar neighbourhood cluster near zero, with
        a spread of about 0.2 in each direction.</p>
      <p>Metallicity matters for planets because heavy elements are the raw
        materials for rocky planets, moons, and asteroids. Stars with
        higher metallicity tend to host more giant planets.</p>
      ${keyIdea("Metallicity measures a star's heavy-element content relative to the Sun. Higher metallicity means more raw material for building planets.")}`,

      /* advanced */
      `<p>Metallicity is conventionally expressed as ${iq("[\\text{Fe/H}]")}
        -- the logarithmic iron-to-hydrogen ratio relative to the Sun:</p>
      ${eq("[\\text{Fe/H}] = \\log_{10}\\!\\left(\\frac{N_{\\text{Fe}}}{N_{\\text{H}}}\\right)_\\star - \\log_{10}\\!\\left(\\frac{N_{\\text{Fe}}}{N_{\\text{H}}}\\right)_\\odot")}
      <p>The solar neighbourhood metallicity distribution is approximately
        Gaussian:</p>
      ${dataTable(
        ["Parameter", "Value", "Source"],
        [
          ["Mean [Fe/H]", "-0.05 dex", "Nordstr\u00f6m et al. (2004)"],
          ["Dispersion \\(\\sigma\\)", "\\(\\pm\\)0.20 dex", "Thin disk population"],
          ["Radial gradient", "-0.06 dex/kpc", "Galactocentric radius"],
          ["Vertical gradient", "-0.30 dex/kpc", "Distance from Galactic plane"],
        ],
      )}
      <p>The radial gradient reflects the inside-out formation of the
        Galactic disk: the inner Galaxy has experienced more generations of
        star formation and chemical enrichment. The vertical gradient
        reflects the age-metallicity relation -- older, metal-poorer stars
        have had more time to migrate away from the disk midplane.</p>
      <p>Planet formation correlates with metallicity: the probability of
        hosting a gas giant scales as approximately
        ${iq("P \\propto 10^{2[\\text{Fe/H}]}")} (Fischer & Valenti 2005),
        with a baseline near 7% at solar metallicity, while rocky planet
        occurrence is less metallicity-dependent.</p>
      ${cite("Nordstr\u00f6m et al. (2004, A&A 418, 989); Fischer & Valenti (2005, ApJ 622, 1102); Johnson et al. (2010, PASP 122, 905)")}`,
      mode,
    ),

    /* 4 ── The Galactic Habitable Zone ─────────────────────────────── */
    concept(
      "The Galactic Habitable Zone",
      /* basic */
      `<p>Just as there is a habitable zone around a star (where liquid
        water can exist), there may be a <strong>galactic habitable
        zone</strong> -- a ring-shaped region within the galaxy where
        conditions are most favourable for life.</p>
      <ul>
        <li><strong>Too close to the galactic centre:</strong> The stellar
            density is high, supernovae are frequent, and intense radiation
            could sterilise planets.</li>
        <li><strong>Too far from the centre:</strong> There are too few
            heavy elements (metals) to build rocky planets and the
            biochemical building blocks of life.</li>
        <li><strong>Just right:</strong> In between, there is enough metal
            for planet formation, enough time for evolution, and a low
            enough supernova rate to avoid frequent sterilisation.</li>
      </ul>
      <p>The Sun sits comfortably within this zone, at about 8 kiloparsecs
        from the galactic centre.</p>
      ${analogy("The galaxy is like a city. The dense downtown (galactic centre) is too noisy and hazardous. The far suburbs (outer galaxy) lack the resources. The best neighbourhoods are the quiet middle rings -- close enough to have good infrastructure, far enough to be safe.")}
      ${keyIdea("The galactic habitable zone is a ring where metallicity is high enough for rocky planets but supernova rates are low enough for life to survive long term.")}`,

      /* advanced */
      `<p>The concept of a Galactic Habitable Zone (GHZ) was formalised by
        Gonzalez, Brownlee & Ward (2001) and quantified by Lineweaver,
        Fenner & Gibson (2004). The key criteria are:</p>
      <ul>
        <li><strong>Sufficient metallicity</strong> for terrestrial planet
            formation: ${iq("[\\text{Fe/H}] \\gtrsim -0.5")} is typically
            required for efficient rocky-planet assembly.</li>
        <li><strong>Low supernova rate:</strong> The local SN rate must be
            low enough that the mean interval between nearby events
            (within ~10 pc) is long compared to biological recovery times
            (~10 Myr).</li>
        <li><strong>Sufficient time:</strong> The star and its planets
            must have existed long enough for complex life to evolve
            (~4 Gyr as an Earth-calibrated benchmark).</li>
      </ul>
      <p>Lineweaver et al. (2004) estimated the GHZ probability as a
        function of Galactocentric radius ${iq("R_{\\text{GC}}")} and
        time:</p>
      ${eq("P_{\\text{GHZ}}(R,\\,t) \\propto P_{\\text{metal}}(R,\\,t) \\times P_{\\text{SN}}(R,\\,t) \\times \\Theta(t - t_{\\text{evol}})")}
      ${vars([
        ["P_{\\text{metal}}", "probability of sufficient metallicity for planet formation"],
        ["P_{\\text{SN}}", "probability of avoiding sterilising supernovae"],
        ["\\Theta", "Heaviside step function; zero before minimum evolution time"],
        ["t_{\\text{evol}}", "minimum time for complex life (~4 Gyr)"],
      ])}
      <p>The GHZ peaks at approximately 7--9 kpc from the Galactic centre
        for the present epoch, with the zone expanding outward over time as
        the outer disk becomes progressively enriched.</p>
      ${dataTable(
        ["Radius (kpc)", "Metallicity", "SN rate", "GHZ probability"],
        [
          ["3--5", "High", "High", "Low (too hazardous)"],
          ["7--9", "Solar-like", "Moderate", "Highest"],
          ["10--12", "Sub-solar", "Low", "Moderate"],
          ["> 15", "Low", "Very low", "Low (insufficient metals)"],
        ],
      )}
      ${cite("Gonzalez, Brownlee & Ward (2001, Icarus 152, 185); Lineweaver, Fenner & Gibson (2004, Science 303, 59)")}`,
      mode,
    ),
  ].join("");
}
