/**
 * Lesson 15 — Stellar Activity
 *
 * Covers stellar flares, coronal mass ejections, activity-age relations,
 * and habitability implications.  Includes a superflare rate calculator.
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

export function buildLesson15(mode) {
  return [
    /* 1 ── Stellar Flares ──────────────────────────────────────────── */
    concept(
      "Stellar Flares",
      /* basic */
      `<p>Stars are not perfectly steady light sources. From time to time, the
        tangled magnetic field lines on a star's surface snap and reconnect,
        releasing a sudden burst of energy called a <strong>flare</strong>.
        These events happen on all cool stars (types F, G, K, and M), but
        smaller, redder stars tend to flare more violently relative to their
        overall brightness.</p>
      <p>A single large flare can release as much energy in minutes as the
        Sun emits in hours. The biggest stellar flares observed -- called
        <strong>superflares</strong> -- can be thousands of times more
        powerful than anything recorded on our Sun.</p>
      ${analogy("Think of a flare as lightning on a star's surface. Just as lightning discharges built-up electrical tension in a storm cloud, a stellar flare discharges built-up magnetic tension in the star's outer layers -- but with enormously more energy.")}
      ${keyIdea("Stellar flares are sudden releases of magnetic energy on a star's surface. They occur on all cool stars, and red dwarfs tend to produce the most energetic flares relative to their luminosity.")}`,

      /* advanced */
      `<p>Stellar flares are impulsive energy releases driven by magnetic
        reconnection in the corona. Their frequency-energy distribution
        follows a power law:</p>
      ${eq("N(>E) \\propto E^{-\\alpha}")}
      ${vars([
        ["N(>E)", "cumulative number of flares above energy E"],
        ["E", "total flare energy (erg)"],
        ["\\alpha", "power-law index"],
      ])}
      <p>Observed power-law indices vary by spectral type:</p>
      ${dataTable(
        ["Spectral class", "\\(\\alpha\\)", "Notes"],
        [
          ["FGK", "~1.8", "Solar-type stars; Kepler sample"],
          ["Early M (M0--M3)", "~2.0", "More frequent moderate flares"],
          ["Late M (M4--M9)", "~2.2", "Steeper distribution; dominated by frequent small flares"],
        ],
      )}
      <p>A steeper index (higher ${iq("\\alpha")}) means that small flares
        dominate the total energy budget, while a shallower index gives more
        weight to rare, energetic superflares.</p>
      ${cite("Lacy, Moffett & Evans (1976, ApJS 30, 85); G\u00fcnther et al. (2020, AJ 159, 60)")}`,
      mode,
    ),

    /* 2 ── Coronal Mass Ejections ──────────────────────────────────── */
    concept(
      "Coronal Mass Ejections",
      /* basic */
      `<p>Sometimes a flare does more than just release light. It can also
        launch a massive cloud of charged particles -- protons, electrons,
        and heavier ions -- out into space at hundreds or thousands of
        kilometres per second. This is a <strong>coronal mass ejection</strong>
        (CME).</p>
      <p>If a CME hits a planet, it can compress the planet's magnetic field,
        trigger spectacular auroras, and -- in extreme cases -- damage
        unshielded electronics or erode the upper atmosphere.</p>
      ${analogy("If a flare is lightning, a CME is like the gust front of a thunderstorm -- a massive wall of charged particles blowing outward from the star. The flare announces the event; the CME delivers the punch.")}
      ${keyIdea("A coronal mass ejection (CME) is a cloud of charged particles launched by a flare. Stronger flares are more likely to produce CMEs, and the largest CMEs can strip planetary atmospheres over time.")}`,

      /* advanced */
      `<p>Not every flare produces a CME, but the association rate increases
        sharply with flare energy. Solar data yield the following
        energy-dependent CME association rates:</p>
      ${dataTable(
        ["Flare energy (erg)", "CME association rate"],
        [
          ["\\(\\leq 10^{32}\\)", "~0.5%"],
          ["\\(10^{32}\\text{--}10^{33}\\)", "~12%"],
          ["\\(10^{33}\\text{--}10^{34}\\)", "~40%"],
          ["\\(> 10^{34}\\)", "~75%"],
        ],
      )}
      <p>CME kinetic energies are typically 10--100% of the associated flare
        radiative energy. The mass of a large solar CME is of order
        ${iq("10^{15}\\text{--}10^{16}")}&thinsp;g, with velocities of
        400--2500&thinsp;km/s.</p>
      <p>For M dwarfs, observational constraints on CME rates are still
        limited, but theoretical models suggest even higher CME-to-flare
        ratios due to stronger magnetic confinement and more frequent
        energetic flares.</p>
      ${cite("Yashiro et al. (2006, ApJ 650, L143)")}`,
      mode,
    ),

    /* 3 ── Activity and Age ────────────────────────────────────────── */
    concept(
      "Activity and Age",
      /* basic */
      `<p>Young stars are restless. They spin fast, which generates strong
        magnetic fields, which in turn produce frequent and powerful flares.
        As a star ages, it gradually loses angular momentum through its
        stellar wind (a process called <strong>magnetic braking</strong>),
        spins down, and becomes calmer.</p>
      <p>A young Sun-like star might produce superflares every year or so.
        By the time it reaches the Sun's current age (about 4.6 billion
        years), superflares have become extremely rare. Red dwarfs, however,
        remain active for far longer -- some stay magnetically vigorous for
        billions of years.</p>
      ${analogy("A star is like a campfire. When freshly lit, it crackles and throws sparks. As it settles and the fuel burns down, it glows more steadily. Young stars crackle; old stars glow.")}
      ${keyIdea("Stars calm down as they age because they lose spin. Sun-like stars quiet within a few billion years, but red dwarfs can remain highly active for much longer.")}`,

      /* advanced */
      `<p>Stellar activity scales with rotation period, which itself evolves
        with age via magnetic braking. The activity-age relation is commonly
        parameterised through the Rossby number
        ${iq("Ro = P_{\\text{rot}} / \\tau_c")} (rotation period over
        convective turnover time). Stars with ${iq("Ro \\lesssim 0.1")} are
        in the saturated regime with maximum activity.</p>
      <p>Expected superflare rates (${iq("E \\geq 10^{33}")}&thinsp;erg)
        by spectral type and age category:</p>
      ${dataTable(
        ["Type", "Young (< 1 Gyr)", "Mid (1--5 Gyr)", "Old (> 5 Gyr)"],
        [
          ["FGK", "~1.0 N\\(_{33}\\)/yr", "~0.1 N\\(_{33}\\)/yr", "~0.005 N\\(_{33}\\)/yr"],
          ["Early M", "~5 N\\(_{33}\\)/yr", "~1 N\\(_{33}\\)/yr", "~0.1 N\\(_{33}\\)/yr"],
          ["Late M", "~20 N\\(_{33}\\)/yr", "~5 N\\(_{33}\\)/yr", "~1 N\\(_{33}\\)/yr"],
        ],
      )}
      <p>M dwarfs remain magnetically active far longer because their deep
        convective envelopes maintain efficient dynamo action even at slow
        rotation rates. Fully convective stars (late M) may never fully
        spin down within a Hubble time.</p>
      ${cite("Skumanich (1972, ApJ 171, 565); Wright et al. (2011, ApJ 743, 48); G\u00fcnther et al. (2020, AJ 159, 60)")}`,
      mode,
    ),

    /* 4 ── Habitability Implications ───────────────────────────────── */
    concept(
      "Habitability Implications",
      /* basic */
      `<p>All that stellar fury has real consequences for life. Intense
        flares and CMEs can:</p>
      <ul>
        <li><strong>Strip the atmosphere.</strong> Repeated CME impacts can
            gradually erode a planet's atmosphere, especially if it lacks a
            strong magnetic field. Mars may have lost much of its early
            atmosphere this way.</li>
        <li><strong>Destroy the ozone layer.</strong> Energetic particles
            from flares break apart ozone molecules, letting harmful
            ultraviolet radiation reach the surface.</li>
        <li><strong>Damage DNA.</strong> Without ozone or atmospheric
            shielding, the UV surface dose can become lethal to unprotected
            organisms.</li>
      </ul>
      <p>A planet can protect itself with a <strong>strong magnetic
        field</strong> (which deflects charged particles) and a
        <strong>thick atmosphere</strong> (which absorbs UV and replaces
        lost gas through volcanism).</p>
      ${keyIdea("Too much stellar activity can strip atmospheres, destroy ozone, and irradiate surfaces. A strong magnetic field and thick atmosphere are the best defences.")}`,

      /* advanced */
      `<p>The habitability impact of stellar activity depends on several
        coupled factors:</p>
      <ul>
        <li><strong>Atmospheric erosion:</strong> CME-driven ion pickup and
            sputtering can remove ${iq("\\sim 10^{26}\\text{--}10^{28}")}
            particles/s from an unmagnetised Earth-like atmosphere. A
            dipole moment ${iq("\\geq 0.1\\,\\mathcal{M}_\\oplus")} is
            needed to deflect most CME plasma.</li>
        <li><strong>Ozone destruction:</strong> Energetic proton events
            (${iq("E_p > 10")}&thinsp;MeV) catalyse NO${iq("_x")}
            production in the stratosphere, depleting ozone. A single
            superflare can reduce the ozone column by 10--90% depending on
            flare energy and atmospheric composition.</li>
        <li><strong>UV surface dose:</strong> With reduced ozone, the
            biologically weighted UV dose at the surface scales roughly as
            ${iq("\\text{UV}_{\\text{bio}} \\propto O_3^{-1.5}")} (the
            radiation amplification factor). Sustained ozone depletion
            below ~50% of Earth's column can be lethal to surface
            organisms.</li>
      </ul>
      ${dataTable(
        ["Shielding factor", "Minimum requirement", "Effect if absent"],
        [
          [
            "Magnetic dipole",
            "\\(\\geq 0.1\\,\\mathcal{M}_\\oplus\\)",
            "Accelerated atmospheric loss",
          ],
          ["Surface pressure", "\\(\\geq 0.5\\) bar", "Insufficient UV absorption"],
          ["Ozone column", "\\(\\geq 150\\) DU", "Lethal UV surface dose"],
        ],
      )}
      ${cite("Segura et al. (2010, Astrobiology 10, 751); Tilley et al. (2019, Astrobiology 19, 64); Airapetian et al. (2020, Int. J. Astrobiol. 19, 136)")}`,
      mode,
    ),

    /* ── Mini-calculator ───────────────────────────────────────────── */
    tryIt(
      "Superflare Rate",
      `${tryRow(
        `<label for="les15-type">Star type</label>`,
        `<select id="les15-type">
           <option value="FGK" selected>FGK (Sun-like)</option>
           <option value="earlyM">Early M (M0--M3)</option>
           <option value="lateM">Late M (M4--M9)</option>
         </select>`,
      )}
      ${tryRow(
        `<label for="les15-age">Age category</label>`,
        `<select id="les15-age">
           <option value="young">Young (< 1 Gyr)</option>
           <option value="mid" selected>Mid (1--5 Gyr)</option>
           <option value="old">Old (> 5 Gyr)</option>
         </select>`,
      )}
      ${tryOutput("les15-rate", "Superflares per year (E &ge; 10<sup>33</sup> erg): ")}`,
    ),
  ].join("");
}

/* ── wire ──────────────────────────────────────────────────────────── */

export function wireLesson15(root) {
  const typeSelect = root.querySelector("#les15-type");
  const ageSelect = root.querySelector("#les15-age");
  const out = root.querySelector("#les15-rate");
  if (!typeSelect || !ageSelect || !out) return;

  const RATES = {
    FGK: { young: 0.8, mid: 0.1, old: 0.005 },
    earlyM: { young: 20, mid: 3, old: 0.5 },
    lateM: { young: 80, mid: 15, old: 3 },
  };

  function update() {
    const type = typeSelect.value;
    const age = ageSelect.value;
    const rate = RATES[type]?.[age] ?? 0;
    out.textContent = fmt(rate, 3);
  }

  typeSelect.addEventListener("input", update);
  ageSelect.addEventListener("input", update);
  update();
}
