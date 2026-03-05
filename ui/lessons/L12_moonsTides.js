/**
 * Lesson 12 — Moons & Tides
 *
 * Covers the Roche limit, Hill sphere, tidal locking, tidal heating,
 * and orbital fate of moons.  Includes a mini-calculator that estimates
 * tidal heating power from planet mass, moon radius, orbital distance,
 * and eccentricity.
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

export function buildLesson12(mode) {
  return [
    /* 1 ── The Roche Limit ─────────────────────────────────────────── */
    concept(
      "The Roche Limit",
      /* basic */
      `<p>Every planet has an invisible danger zone close to its surface. If a
        moon wanders too close, the difference in gravitational pull between
        the near side and far side of the moon becomes stronger than the
        moon's own gravity holding it together. The moon gets stretched and
        eventually torn apart, scattering its debris into a ring.</p>
      <p>This critical distance is called the <strong>Roche limit</strong>.
        Saturn's rings are a spectacular example: they sit inside Saturn's
        Roche limit, where no large moon could survive intact.</p>
      ${analogy("Imagine pulling on both ends of a ball of clay. If you pull gently, it stays together. Pull hard enough and it tears apart. The Roche limit is the distance at which the planet's tidal pull is strong enough to tear a moon apart.")}
      ${keyIdea("The Roche limit is the closest distance a moon can orbit before tidal forces rip it apart. Inside this limit, you get rings instead of moons.")}`,

      /* advanced */
      `<p>The classical Roche limit for a fluid (self-gravitating,
        zero-rigidity) satellite is:</p>
      ${eq("d_\\text{Roche} = 2.44\\;R_p\\;\\left(\\frac{\\rho_p}{\\rho_m}\\right)^{1/3}")}
      ${vars([
        ["d_\\text{Roche}", "orbital radius at which tidal disruption occurs"],
        ["R_p", "planet radius"],
        ["\\rho_p", "mean density of the planet"],
        ["\\rho_m", "mean density of the moon"],
      ])}
      <p>For a rigid body (with internal material strength), the coefficient
        drops to ~1.26 instead of 2.44, because tensile strength helps
        resist tidal deformation. Real moons fall between these extremes
        depending on their composition and internal structure:</p>
      ${dataTable(
        ["Case", "Coefficient", "Applicable to"],
        [
          ["Fluid (Roche 1849)", "2.44", "Rubble piles, loosely bound bodies"],
          ["Rigid (Jeffreys 1947)", "1.26", "Monolithic rocky bodies"],
          ["Typical rocky moon", "~1.5 - 2.0", "Partially differentiated bodies"],
        ],
      )}
      <p>Moons discovered inside the classical fluid Roche limit (e.g. Pan
        and Atlas inside Saturn's rings) survive because they are small
        enough for material strength to dominate over self-gravity.</p>
      ${cite("Roche (1849); Murray & Dermott (1999), Solar System Dynamics, Ch. 4")}`,
      mode,
    ),

    /* 2 ── The Hill Sphere ─────────────────────────────────────────── */
    concept(
      "The Hill Sphere",
      /* basic */
      `<p>Just as there is a minimum distance (the Roche limit), there is also
        a maximum distance at which a planet can keep a moon. Beyond a
        certain point, the star's gravity dominates and the moon drifts
        away.</p>
      <p>This outer boundary is called the <strong>Hill sphere</strong>.
        Every planet has one, and its size depends on the planet's mass and
        how far it orbits from the star. A planet far from its star with a
        large mass has a big Hill sphere; a small planet close to its star
        has a tiny one.</p>
      ${analogy("Think of the Hill sphere as a planet's gravitational 'yard'. Moons can roam freely inside the yard, but if they wander past the fence, the star takes over and pulls them away.")}
      ${keyIdea("The Hill sphere marks the outer boundary of a planet's gravitational influence. Moons must orbit well within it to remain stable.")}`,

      /* advanced */
      `<p>The Hill radius is derived from the restricted three-body problem:</p>
      ${eq("r_\\text{Hill} = a\\;\\left(\\frac{M_p}{3\\,M_\\star}\\right)^{1/3}")}
      ${vars([
        ["r_\\text{Hill}", "Hill sphere radius"],
        ["a", "planet's semi-major axis around the star"],
        ["M_p", "planet mass"],
        ["M_\\star", "stellar mass"],
      ])}
      <p>In practice, moons are only stable out to roughly half the Hill
        radius for prograde orbits, and about two-thirds for retrograde
        orbits, due to perturbative effects from the star and from other
        planets. Long-term numerical integrations (Hamilton &amp; Burns 1991)
        confirm this ~0.5 ${iq("r_\\text{Hill}")} stability boundary.</p>
      ${dataTable(
        ["Body", "Hill radius (10\\(^6\\) km)", "Outermost major moon"],
        [
          ["Earth", "1.5", "Moon (0.384 million km, 0.26 r_Hill)"],
          ["Jupiter", "53", "Callisto (1.88 million km, 0.035 r_Hill)"],
          ["Neptune", "116", "Triton (0.35 million km, 0.003 r_Hill)"],
        ],
      )}
      ${cite("Hamilton & Burns (1991, Icarus 92, 118); Murray & Dermott (1999), Solar System Dynamics, Ch. 9")}`,
      mode,
    ),

    /* 3 ── Tidal Locking ───────────────────────────────────────────── */
    concept(
      "Tidal Locking",
      /* basic */
      `<p>Our Moon always shows the same face to Earth. This is not a
        coincidence — it is the result of billions of years of tidal
        friction. Early in its history the Moon rotated freely, but the
        gravitational pull of Earth created a tidal bulge in the Moon's
        rock. Friction from that bulge slowly drained the Moon's spin
        energy until its rotation period matched its orbital period
        exactly.</p>
      <p>Tidal locking is extremely common. Most large moons in the solar
        system are tidally locked to their planets. Smaller moons in close
        orbits lock fastest; distant moons may never lock at all.</p>
      ${analogy("Imagine spinning a ball on a string through thick honey. The honey's drag (tidal friction) gradually slows the spin until the ball always faces the same direction as it swings around.")}
      ${keyIdea("Tidal forces slow a moon's rotation over time until one face permanently points toward the planet. This is why we only ever see one side of our Moon.")}`,

      /* advanced */
      `<p>The timescale for a satellite to tidally lock (despinning from an
        initial spin ${iq("\\omega_0")} to synchronous rotation) is
        approximately:</p>
      ${eq("t_\\text{lock} \\approx \\frac{\\omega_0\\;a^6\\;I\\;Q}{3\\,G\\,M_p^2\\,k_2\\,R_m^5}")}
      ${vars([
        ["t_\\text{lock}", "time to reach synchronous rotation"],
        ["\\omega_0", "initial spin angular velocity"],
        ["a", "orbital semi-major axis"],
        ["I", "moment of inertia of the satellite"],
        ["Q", "tidal quality factor (dissipation efficiency; lower = more dissipative)"],
        ["G", "gravitational constant"],
        ["M_p", "planet mass"],
        ["k_2", "Love number (tidal deformability; ~0.03 for rocky moons, ~0.3 for icy moons)"],
        ["R_m", "satellite radius"],
      ])}
      <p>The strong dependence on ${iq("a^6")} means that close-in moons lock
        quickly (Io locked in ~10 Myr) while distant moons may remain
        unlocked over the age of the solar system. The ${iq("R_m^5")} term
        means larger moons are also easier to lock.</p>
      <p>Higher-order spin-orbit resonances (e.g. Mercury's 3:2 lock) can
        occur when orbital eccentricity is significant, preventing
        synchronous capture.</p>
      ${cite("Gladman et al. (1996, Icarus 122, 166); Peale (1999, ARA&A 37, 533)")}`,
      mode,
    ),

    /* 4 ── Tidal Heating ───────────────────────────────────────────── */
    concept(
      "Tidal Heating",
      /* basic */
      `<p>When a moon's orbit is not perfectly circular, its distance to the
        planet changes continuously. As the moon moves closer and farther
        away on each orbit, the planet's tidal pull strengthens and weakens,
        flexing the moon's interior like a stress ball being squeezed and
        released. That flexing generates friction, and friction produces
        heat.</p>
      <p>Jupiter's moon Io is the most volcanically active body in the
        solar system because of this process. Io's orbit is kept slightly
        elliptical by gravitational tugs from Europa and Ganymede, ensuring
        constant tidal flexing and relentless volcanism.</p>
      ${analogy("Bend a paperclip back and forth rapidly and it gets hot at the bend. Tidal heating works the same way: the planet repeatedly flexes the moon, and internal friction turns that mechanical energy into heat.")}
      ${keyIdea("Orbital eccentricity causes a moon to be tidally flexed every orbit. The resulting internal friction heats the moon, powering volcanism and potentially maintaining subsurface oceans.")}`,

      /* advanced */
      `<p>The equilibrium tidal heating rate for a synchronously rotating
        satellite on an eccentric orbit (Peale et al. 1979):</p>
      ${eq("\\dot{E} = \\frac{21}{2}\\;\\frac{k_2}{Q}\\;\\frac{G\\,M_p^2\\,R_m^5\\,n\\,e^2}{a^6}")}
      ${vars([
        ["\\dot{E}", "tidal heating power (W)"],
        ["k_2", "satellite's tidal Love number (~0.03 for Io)"],
        ["Q", "tidal quality factor (~100 for Io)"],
        ["G", "gravitational constant (6.674 \\times 10^{-11})"],
        ["M_p", "planet mass"],
        ["R_m", "satellite radius"],
        ["n", "orbital mean motion = \\sqrt{G M_p / a^3}"],
        ["e", "orbital eccentricity"],
        ["a", "orbital semi-major axis"],
      ])}
      <p>For Io (${iq("k_2 \\approx 0.03")}, ${iq("Q \\approx 100")},
        ${iq("e \\approx 0.004")}), this yields ~100 TW, consistent with
        the observed heat flux of ~2.5 W/m${iq("^2")}. The ${iq("e^2")}
        dependence means even a modest eccentricity produces substantial
        heating, while the ${iq("a^{-6}")} term makes close-in moons
        far more susceptible.</p>
      <p>Resonant orbital configurations (e.g. Io-Europa-Ganymede Laplace
        resonance) maintain forced eccentricities that prevent tidal
        circularisation, sustaining heating over geological timescales.</p>
      ${cite("Peale, Cassen & Reynolds (1979, Science 203, 892); Segatz et al. (1988, Icarus 75, 187)")}`,
      mode,
    ),

    /* 5 ── Orbital Fate ────────────────────────────────────────────── */
    concept(
      "Orbital Fate",
      /* basic */
      `<p>Tidal forces do not just heat moons — they also change their orbits
        over time. Depending on the situation, a moon can:</p>
      <ul>
        <li><strong>Spiral outward</strong> — Our Moon is slowly drifting away
            from Earth at about 3.8 cm per year. Earth's spin is faster than
            the Moon's orbital period, so tidal friction transfers energy
            from Earth's rotation to the Moon's orbit.</li>
        <li><strong>Spiral inward</strong> — Mars's moon Phobos orbits faster
            than Mars rotates, so tidal friction steals orbital energy.
            Phobos is expected to either crash into Mars or be torn apart
            into a ring in roughly 50 million years.</li>
        <li><strong>Remain stable</strong> — When a moon is tidally locked
            and its orbit is nearly circular, orbital evolution slows
            dramatically.</li>
      </ul>
      ${keyIdea("Tidal forces slowly push or pull moons, changing their orbits over billions of years. Whether a moon spirals in, spirals out, or stays put depends on the relative spin rates of the planet and moon.")}`,

      /* advanced */
      `<p>The rate of tidal orbital evolution depends on the dissipation in
        the planet. For a moon raising tides on its host planet, the
        semi-major axis evolves as:</p>
      ${eq("\\frac{da}{dt} = \\text{sgn}(\\Omega_p - n)\\;\\frac{3\\,k_{2p}}{Q_p}\\;\\frac{M_m}{M_p}\\;\\frac{R_p^5}{a^4}\\;n")}
      ${vars([
        ["da/dt", "rate of change of semi-major axis"],
        ["\\Omega_p", "planet spin angular velocity"],
        ["n", "moon's orbital mean motion"],
        ["k_{2p}", "planet's Love number"],
        ["Q_p", "planet's tidal quality factor"],
        ["M_m", "moon mass"],
        ["R_p", "planet radius"],
      ])}
      <p>When ${iq("\\Omega_p > n")} (planet spins faster than the moon
        orbits), the tidal bulge leads the moon and torques it outward
        (Earth-Moon case). When ${iq("\\Omega_p < n")}, the bulge lags
        and the moon spirals inward (Phobos).</p>
      ${dataTable(
        ["System", "da/dt", "Fate"],
        [
          ["Earth-Moon", "+3.8 cm/yr", "Outward recession; Moon reaches ~1.2 r_Hill limit"],
          ["Mars-Phobos", "-1.8 cm/yr", "Inward spiral; disruption in ~50 Myr"],
          ["Jupiter-Io", "~0 (resonance-locked)", "Stable; Laplace resonance maintains e"],
        ],
      )}
      ${cite("Goldreich & Soter (1966, Icarus 5, 375); Bills et al. (2005, J. Geophys. Res. 110, E07004)")}`,
      mode,
    ),

    /* ── Mini-calculator ─────────────────────────────────────────── */
    tryIt(
      "Tidal Heating",
      `${tryRow(
        `<label for="les12-mass">Planet mass (M<sub>&#8853;</sub>)</label>`,
        `<input id="les12-mass" type="number" min="1" max="1000" step="1" value="318">
         <input id="les12-massSlider" type="range" min="1" max="1000" step="1" value="318">`,
      )}
      ${tryRow(
        `<label for="les12-moonR">Moon radius (km)</label>`,
        `<input id="les12-moonR" type="number" min="100" max="5000" step="10" value="1822">
         <input id="les12-moonRSlider" type="range" min="100" max="5000" step="10" value="1822">`,
      )}
      ${tryRow(
        `<label for="les12-dist">Orbital distance (km)</label>`,
        `<input id="les12-dist" type="number" min="100000" max="2000000" step="1000" value="422000">
         <input id="les12-distSlider" type="range" min="100000" max="2000000" step="1000" value="422000">`,
      )}
      ${tryRow(
        `<label for="les12-ecc">Eccentricity</label>`,
        `<input id="les12-ecc" type="number" min="0" max="0.3" step="0.001" value="0.004">
         <input id="les12-eccSlider" type="range" min="0" max="0.3" step="0.001" value="0.004">`,
      )}
      ${tryOutput("les12-heat", "Tidal heating (TW): ")}`,
    ),
  ].join("");
}

/* ── wire ──────────────────────────────────────────────────────────── */

export function wireLesson12(root) {
  const inpMass = root.querySelector("#les12-mass");
  const sliderMass = root.querySelector("#les12-massSlider");
  const inpMoonR = root.querySelector("#les12-moonR");
  const sliderMoonR = root.querySelector("#les12-moonRSlider");
  const inpDist = root.querySelector("#les12-dist");
  const sliderDist = root.querySelector("#les12-distSlider");
  const inpEcc = root.querySelector("#les12-ecc");
  const sliderEcc = root.querySelector("#les12-eccSlider");
  const out = root.querySelector("#les12-heat");
  if (!inpMass || !out) return;

  function update() {
    const mass = parseFloat(inpMass.value) || 318;
    const moonRadius = parseFloat(inpMoonR.value) || 1822;
    const dist = parseFloat(inpDist.value) || 422000;
    const ecc = parseFloat(inpEcc.value) || 0.004;

    sliderMass.value = mass;
    sliderMoonR.value = moonRadius;
    sliderDist.value = dist;
    sliderEcc.value = ecc;

    /* Simplified tidal heating (Peale et al. 1979) */
    const G = 6.674e-11;
    const Mp = mass * 5.972e24; // M_Earth -> kg
    const Rm = moonRadius * 1000; // km -> m
    const a = dist * 1000; // km -> m
    const n = Math.sqrt((G * Mp) / (a * a * a));
    const k2 = 0.03; // typical rocky moon
    const Q = 100;
    const heat =
      ((21 / 2) * (k2 / Q) * G * Mp * Mp * Math.pow(Rm, 5) * n * ecc * ecc) / Math.pow(a, 6);
    const heatTW = heat / 1e12;

    out.textContent = fmt(heatTW, 4);
  }

  /* Bind all number + slider pairs */
  const pairs = [
    [inpMass, sliderMass],
    [inpMoonR, sliderMoonR],
    [inpDist, sliderDist],
    [inpEcc, sliderEcc],
  ];
  for (const [inp, slider] of pairs) {
    inp.addEventListener("input", update);
    slider.addEventListener("input", () => {
      inp.value = slider.value;
      update();
    });
  }
  update();
}
