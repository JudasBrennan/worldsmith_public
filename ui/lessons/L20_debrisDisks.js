// SPDX-License-Identifier: MPL-2.0
/**
 * Lesson 20 — Debris & Small Bodies
 *
 * Covers debris disks, resonance sculpting, composition and condensation
 * sequences, and collisional cascades.  No interactive calculator.
 */

import { concept, analogy, keyIdea, eq, iq, vars, cite, dataTable } from "./helpers.js";

/* ── build ─────────────────────────────────────────────────────────── */

export function buildLesson20(mode) {
  return [
    /* 1 ── What Are Debris Disks? ──────────────────────────────────── */
    concept(
      "What Are Debris Disks?",
      /* basic */
      `<p>After the planets finish forming, not all the material in a
        stellar system gets incorporated into large bodies. A vast amount
        of leftover rubble remains: <strong>asteroids</strong>,
        <strong>comets</strong>, and <strong>dust</strong>. Collectively,
        this leftover material is called a <strong>debris disk</strong>.</p>
      <p>Our own solar system has two prominent debris structures: the
        <strong>asteroid belt</strong> between Mars and Jupiter (mostly
        rocky), and the <strong>Kuiper belt</strong> beyond Neptune (mostly
        icy). Many other stars show infrared excess from warm dust --
        evidence that they, too, harbour debris disks.</p>
      ${analogy("Think of a construction site after the buildings are done. There are piles of bricks, gravel, and sawdust left over. A debris disk is the cosmic equivalent -- rubble left behind after the planets were built.")}
      ${keyIdea("Debris disks are the leftover material from planet formation: asteroids, comets, and dust. Our asteroid belt and Kuiper belt are nearby examples.")}`,

      /* advanced */
      `<p>Debris disks are detected through thermal infrared excess above
        the stellar photosphere. The key observable is the
        <strong>fractional luminosity</strong>:</p>
      ${eq("f = \\frac{L_{\\text{disk}}}{L_\\star}")}
      ${vars([
        ["f", "fractional luminosity (disk-to-star luminosity ratio)"],
        ["L_{\\text{disk}}", "total thermal emission from the dust disk"],
        ["L_\\star", "stellar luminosity"],
      ])}
      <p>Typical values range from ${iq("f \\sim 10^{-3}")} for young,
        bright disks to ${iq("f \\sim 10^{-7}")} for the solar system's
        zodiacal dust (near the detection limit of current surveys).</p>
      <p>Disk brightness declines with age as the reservoir of large bodies
        is ground down. Wyatt et al. (2007) found an empirical
        age-luminosity relation:</p>
      ${eq("f \\propto t^{-1}")}
      <p>where ${iq("t")} is stellar age. This is consistent with a
        steady-state collisional cascade in which the mass loss rate scales
        inversely with time.</p>
      ${dataTable(
        ["Age", "Typical \\(f\\)", "Example"],
        [
          ["10 Myr", "\\(10^{-3}\\)", "Beta Pictoris"],
          ["100 Myr", "\\(10^{-4}\\)", "Fomalhaut"],
          ["1 Gyr", "\\(10^{-5}\\)", "Epsilon Eridani"],
          ["4.6 Gyr", "\\(10^{-7}\\)", "Solar system (zodiacal dust)"],
        ],
      )}
      ${cite("Wyatt et al. (2007, ApJ 658, 569); Hughes, Duch\u00eane & Matthews (2018, ARA&A 56, 541)")}`,
      mode,
    ),

    /* 2 ── Resonance Sculpting ─────────────────────────────────────── */
    concept(
      "Resonance Sculpting",
      /* basic */
      `<p>Planets do not just sit passively in their orbits. Their gravity
        reaches out and shapes the debris around them, creating patterns of
        gaps and concentrations.</p>
      <p>At certain distances, a small body's orbital period forms a
        simple ratio with a planet's period (like 2:1 or 3:2). At these
        <strong>resonances</strong>, the planet's gravitational nudges
        accumulate, either ejecting debris (creating a gap) or trapping it
        (creating a concentration).</p>
      <p>Jupiter has carved several distinct gaps in the asteroid belt
        (called <strong>Kirkwood gaps</strong>) at resonance locations.
        Meanwhile, Neptune has captured a whole population of icy bodies
        (the <strong>Plutinos</strong>, including Pluto itself) in its 3:2
        resonance.</p>
      ${analogy("A planet's gravity creates invisible barriers and corrals in the debris disk, like a sheepdog herding asteroids into belts and gaps. The pattern depends on the simple number ratios between orbital periods.")}
      ${keyIdea("Planets carve gaps and concentrate material at orbital resonances. Jupiter's Kirkwood gaps and Neptune's Plutinos are textbook examples.")}`,

      /* advanced */
      `<p>Mean-motion resonances (MMR) occur where the orbital period ratio
        of a debris particle to a planet equals a ratio of small integers
        ${iq("p:q")}. The resonant semi-major axis is:</p>
      ${eq("a_{\\text{res}} = a_{\\text{planet}} \\times \\left(\\frac{p}{q}\\right)^{2/3}")}
      ${vars([
        ["a_{\\text{res}}", "semi-major axis of the resonance location"],
        ["a_{\\text{planet}}", "semi-major axis of the perturbing planet"],
        ["p:q", "integer period ratio (e.g. 2:1, 3:2, 5:3)"],
      ])}
      <p>Whether a resonance clears or traps material depends on the
        resonance order ${iq("|p - q|")} and the planet's eccentricity.
        First-order resonances (${iq("|p-q|=1")}) are generally the
        strongest.</p>
      ${dataTable(
        ["Resonance", "\\(a_{\\text{res}} / a_{\\text{planet}}\\)", "Solar system example"],
        [
          ["2:1", "1.587", "Kirkwood gap (Jupiter), Hecuba gap"],
          ["3:2", "1.310", "Plutinos (Neptune)"],
          ["3:1", "2.080", "Kirkwood gap (Jupiter)"],
          ["4:3", "1.211", "Thule group (Jupiter)"],
          ["5:2", "1.842", "Kirkwood gap (Jupiter)"],
        ],
      )}
      <p>In resolved debris disks around other stars, resonant structures
        manifest as narrow rings, clumps, and asymmetries that can be used
        to infer the presence and mass of unseen planets.</p>
      ${cite("Murray & Dermott (1999), Solar System Dynamics, Ch. 8; Wyatt (2003, ApJ 598, 1321)")}`,
      mode,
    ),

    /* 3 ── Composition and Condensation ────────────────────────────── */
    concept(
      "Composition and Condensation",
      /* basic */
      `<p>What debris is made of depends on where it formed. Close to the
        star, where temperatures are high, only tough, heat-resistant
        materials survive: <strong>metals</strong> and <strong>rocky
        minerals</strong> (silicates). Farther out, where it is cold
        enough, <strong>ices</strong> -- water ice, carbon dioxide ice,
        ammonia ice -- can also condense.</p>
      <p>The boundary where water ice first becomes stable is called the
        <strong>frost line</strong> (or snow line). Inside the frost line,
        debris is predominantly rocky. Outside it, debris can be half ice
        by mass, making it less dense and more volatile.</p>
      ${analogy("Imagine walking away from a roaring furnace. Close up, only metal survives the heat. A few steps back, rock can form. Further away, wax can solidify. Even further, ice forms. Each material has its own distance threshold -- that is the condensation sequence.")}
      ${keyIdea("Close-in debris is rocky and metallic; far-out debris is icy. The frost line marks the transition, and its location depends on the star's luminosity.")}`,

      /* advanced */
      `<p>The <strong>condensation sequence</strong> describes the
        temperature thresholds at which different materials condense from
        the protoplanetary nebula gas at a reference pressure of
        ~${iq("10^{-4}")} bar:</p>
      ${dataTable(
        ["Material", "Condensation T (K)", "Type"],
        [
          ["Corundum (Al\\(_2\\)O\\(_3\\))", "~1,700", "Refractory oxide"],
          ["Metallic iron / nickel", "~1,450", "Refractory metal"],
          ["Silicates (olivine, pyroxene)", "~1,300", "Refractory rock"],
          ["Troilite (FeS)", "~700", "Moderately volatile"],
          ["Water ice (H\\(_2\\)O)", "~170", "Volatile ice"],
          ["Ammonia ice (NH\\(_3\\))", "~130", "Volatile ice"],
          ["Methane ice (CH\\(_4\\))", "~70", "Hyper-volatile ice"],
          ["CO / N\\(_2\\) ice", "~25", "Hyper-volatile ice"],
        ],
      )}
      <p>The radial temperature profile in a protoplanetary disk falls
        roughly as:</p>
      ${eq("T(r) \\approx T_0 \\left(\\frac{r}{1\\;\\text{AU}}\\right)^{-q}")}
      <p>with ${iq("q \\approx 0.5\\text{--}0.75")} depending on the
        disk's optical depth and heating model. This maps each condensation
        temperature to a radial distance, defining the compositional
        zoning of the debris.</p>
      <p>The refractory mass fraction (metals + silicates) is about 0.4%
        of the total disk mass. Volatile ices add another ~1.5% beyond the
        frost line, meaning outer-disk planetesimals can be 4 times more
        massive per unit solid mass than inner-disk ones.</p>
      ${cite("Lodders (2003, ApJ 591, 1220); Lewis (1974, Science 186, 440)")}`,
      mode,
    ),

    /* 4 ── Collisional Cascades ────────────────────────────────────── */
    concept(
      "Collisional Cascades",
      /* basic */
      `<p>Debris disks do not stay the same forever. The asteroids and
        comets within them collide with each other, breaking into smaller
        and smaller pieces in a process called a <strong>collisional
        cascade</strong>.</p>
      <p>Large bodies smash into fragments, which smash into smaller
        fragments, which grind down to dust. The smallest dust grains
        are eventually blown out of the system by the star's radiation
        pressure or slowly spiral inward.</p>
      <p>This grinding process means that debris disks get fainter over
        time as the large bodies are consumed and the dust is removed.
        Young systems have bright, massive disks; old systems like ours
        have faint, tenuous ones.</p>
      ${analogy("Think of colliding rocks in a tumbler. Over time, the big rocks break into pebbles, the pebbles into sand, and the sand into fine powder. In space, the powder gets blown away by starlight, so the rubble pile slowly disappears.")}
      ${keyIdea("Asteroids collide and break apart in a collisional cascade, grinding down from large bodies to dust. The dust is removed by radiation pressure, so disks fade over time.")}`,

      /* advanced */
      `<p>In a steady-state collisional cascade, the size distribution of
        fragments follows the Dohnanyi (1969) power law:</p>
      ${eq("\\frac{dN}{dR} \\propto R^{-3.5}")}
      ${vars([
        ["N", "cumulative number of bodies"],
        ["R", "body radius"],
      ])}
      <p>This corresponds to equal mass per logarithmic size bin -- most of
        the mass is in the largest bodies, but most of the cross-sectional
        area (and hence observability) is in the smallest grains.</p>
      <p>The <strong>collisional lifetime</strong> of a body of radius
        ${iq("R")} in a disk of optical depth ${iq("\\tau")} and orbital
        period ${iq("P")} is approximately:</p>
      ${eq("t_{\\text{coll}} \\sim \\frac{P}{4\\pi\\,\\tau}")}
      <p>For the asteroid belt (${iq("\\tau \\sim 10^{-9}")}), a
        1 km body has a collisional lifetime of order 1 Gyr.</p>
      <p>Small grains below a critical size ${iq("R_{\\text{blow}}")} are
        removed by radiation pressure on orbital timescales. Slightly
        larger grains spiral inward via <strong>Poynting-Robertson
        drag</strong>:</p>
      ${eq("t_{\\text{PR}} = \\frac{4\\pi\\,c^2\\,\\rho\\,R\\,a^2}{3\\,L_\\star}")}
      ${vars([
        ["t_{\\text{PR}}", "Poynting-Robertson inspiral time"],
        ["c", "speed of light"],
        ["\\rho", "grain density"],
        ["R", "grain radius"],
        ["a", "orbital semi-major axis"],
        ["L_\\star", "stellar luminosity"],
      ])}
      <p>The combination of collisional grinding and radiation-driven
        removal produces the observed ${iq("f \\propto t^{-1}")} decline
        in disk brightness.</p>
      ${cite("Dohnanyi (1969, J. Geophys. Res. 74, 2531); Burns, Lamy & Soter (1979, Icarus 40, 1); Wyatt et al. (2007, ApJ 658, 569)")}`,
      mode,
    ),
  ].join("");
}
