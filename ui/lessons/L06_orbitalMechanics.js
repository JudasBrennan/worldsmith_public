import { concept, analogy, keyIdea, eq, iq, vars, cite, dataTable } from "./helpers.js";

/**
 * Lesson 06 — Orbital Mechanics
 * Kepler's laws, eccentricity, orbital period, and resonances.
 */
export function buildLesson06(mode) {
  return [
    /* ── 1. Kepler's Laws ── */
    concept(
      "Kepler's Laws",
      `<p>In the early 1600s, Johannes Kepler discovered three rules that describe
      how planets move around their stars. These laws apply to every orbiting
      body in the universe, from moons to comets.</p>
      <p><b>First Law:</b> Every orbit is an ellipse (an oval shape) with the
      star sitting at one of two special points called <em>foci</em>. A circle
      is just a special case of an ellipse where both foci overlap.</p>
      <p><b>Second Law:</b> A planet moves faster when it is closer to its star
      and slower when it is farther away. Specifically, a line drawn from the
      star to the planet sweeps out equal areas in equal amounts of time.</p>
      <p><b>Third Law:</b> The farther a planet is from its star, the longer its
      year, and the relationship is surprisingly steep. Double the distance and
      the year becomes almost three times longer.</p>
      ${analogy("Think of a runner on an oval track who must speed up on the short end and slow down on the long end, always covering the same ground area per lap segment.")}
      ${keyIdea("Kepler's Third Law means distance controls time: farther planets have much longer years.")}`,

      `<p>Kepler's three laws of planetary motion, published in 1609 and 1619,
      are consequences of Newtonian gravity and conservation of angular
      momentum.</p>
      <p><b>First Law (Law of Ellipses):</b> Each planet's orbit is an ellipse
      with the star at one focus. The semi-major axis ${iq("a")} defines
      the orbit's size.</p>
      <p><b>Second Law (Law of Equal Areas):</b> The radius vector from star to
      planet sweeps out equal areas in equal times. This is a direct result of
      conservation of angular momentum ${iq("L = m r v_{\\perp}")}.</p>
      <p><b>Third Law (Harmonic Law):</b> The square of the orbital period is
      proportional to the cube of the semi-major axis, scaled by the star's
      mass:</p>
      ${eq("P^2 = \\frac{a^3}{M_\\star}")}
      ${vars([
        ["P", "orbital period (years)"],
        ["a", "semi-major axis (AU)"],
        ["M_\\star", "stellar mass (solar masses)"],
      ])}
      <p>In SI units the full form is:</p>
      ${eq("P^2 = \\frac{4\\pi^2}{G(M_\\star + m)} a^3")}
      <p>For planetary masses much smaller than the star,
      ${iq("m \\ll M_\\star")}, the planet's mass can be neglected.</p>
      ${cite("Kepler, J. (1609), Astronomia Nova; (1619), Harmonices Mundi.")}`,
      mode,
    ),

    /* ── 2. Eccentricity ── */
    concept(
      "Eccentricity",
      `<p>Eccentricity describes how elongated an orbit is. A perfectly circular
      orbit has an eccentricity of 0. As the number approaches 1, the orbit
      becomes a long, stretched-out oval.</p>
      <p>Earth's orbit is nearly circular (eccentricity about 0.017). Mercury
      has a more elongated orbit (about 0.206), meaning it gets significantly
      closer to and farther from the Sun at different points in its year.</p>
      ${analogy("Imagine stretching a rubber band around two pins on a board. The closer the pins are together, the more circular the shape. Spread them apart and the shape becomes a longer oval. The pins are the foci, and how far apart they are determines eccentricity.")}
      ${keyIdea("Eccentricity = 0 means a perfect circle. Closer to 1 means a very elongated ellipse. Most stable planetary orbits have low eccentricity.")}`,

      `<p>Eccentricity ${iq("e")} is defined as the ratio of the distance
      between the foci to the length of the major axis. For an ellipse,
      ${iq("0 \\le e < 1")}.</p>
      <p>The closest approach (periapsis) and farthest distance (apoapsis) are
      given by:</p>
      ${eq("r_p = a(1 - e)")}
      ${eq("r_a = a(1 + e)")}
      ${vars([
        ["r_p", "periapsis distance"],
        ["r_a", "apoapsis distance"],
        ["a", "semi-major axis"],
        ["e", "eccentricity"],
      ])}
      <p>The orbital velocity at periapsis and apoapsis can be derived from the
      vis-viva equation:</p>
      ${eq("v^2 = G M_\\star \\left(\\frac{2}{r} - \\frac{1}{a}\\right)")}
      ${dataTable(
        ["Body", "Eccentricity"],
        [
          ["Venus", "0.007"],
          ["Earth", "0.017"],
          ["Mars", "0.093"],
          ["Mercury", "0.206"],
          ["Pluto", "0.249"],
          ["Halley's Comet", "0.967"],
        ],
      )}`,
      mode,
    ),

    /* ── 3. Orbital Period and Distance ── */
    concept(
      "Orbital Period and Distance",
      `<p>A planet's "year" (its orbital period) depends on how far it orbits
      from its star. The farther out a planet is, the longer it takes to
      complete one orbit, and the increase is steep.</p>
      <p>Mars, at 1.52 times Earth's distance from the Sun, takes about 1.88
      Earth years per orbit. Jupiter, at 5.2 times Earth's distance, takes
      nearly 12 years. Neptune, at 30 times the distance, takes 165 years.</p>
      ${analogy("Imagine runners on tracks of different sizes. The outer lanes are longer, but the runners also move more slowly. The combination means the outermost runner takes far longer to finish a lap.")}
      ${keyIdea("Doubling the orbital distance makes the year about 2.8 times longer. This cubic relationship means outer planets have enormously long years.")}`,

      `<p>Kepler's Third Law provides the quantitative link between orbital
      distance and period. For a star of mass ${iq("M_\\star")} in solar
      masses:</p>
      ${eq("P = \\frac{a^{3/2}}{\\sqrt{M_\\star}}")}
      <p>where ${iq("P")} is in years and ${iq("a")} in AU.</p>
      <p>For observations from a planet's surface, the <b>synodic period</b>
      (time between successive alignments of two bodies as seen from one of
      them) is:</p>
      ${eq("\\frac{1}{P_{\\text{syn}}} = \\left| \\frac{1}{P_1} - \\frac{1}{P_2} \\right|")}
      ${vars([
        ["P_{\\text{syn}}", "synodic period"],
        ["P_1", "orbital period of the inner body"],
        ["P_2", "orbital period of the outer body"],
      ])}
      <p>The synodic period determines how often conjunctions and oppositions
      recur, which is important for calendar-making and observational
      astronomy.</p>
      ${dataTable(
        ["Planet", "Distance (AU)", "Period (yr)"],
        [
          ["Mercury", "0.387", "0.241"],
          ["Venus", "0.723", "0.615"],
          ["Earth", "1.000", "1.000"],
          ["Mars", "1.524", "1.881"],
          ["Jupiter", "5.203", "11.86"],
          ["Saturn", "9.537", "29.46"],
        ],
      )}`,
      mode,
    ),

    /* ── 4. Orbital Resonances ── */
    concept(
      "Orbital Resonances",
      `<p>An orbital resonance occurs when two orbiting bodies exert a regular,
      periodic gravitational influence on each other because their orbital
      periods form a simple ratio, like 2:1 or 3:2.</p>
      <p>For example, if one planet completes exactly two orbits for every one
      orbit of the planet outside it, they are in a 2:1 resonance. Each time
      they line up, they give each other a small gravitational tug in the same
      direction, which can either stabilize or destabilize their orbits over
      long timescales.</p>
      <p>Neptune and Pluto are in a 3:2 resonance: Neptune orbits three times
      for every two orbits of Pluto. This keeps them from ever colliding
      despite their orbits crossing.</p>
      ${analogy("Think of pushing a child on a swing. If you push at the right moment every time (in sync with the swing's natural rhythm), the pushes add up. That is a resonance. Push at random times and nothing special happens.")}
      ${keyIdea("Resonances can lock planets into stable patterns or clear out gaps (like in Saturn's rings). Simple ratios (2:1, 3:2) are the most powerful.")}`,

      `<p>Mean-motion resonances (MMR) occur when the ratio of two orbital
      periods ${iq("P_1 / P_2")} is close to a ratio of small integers
      ${iq("p:q")}. The corresponding semi-major axis ratio is:</p>
      ${eq("\\frac{a_1}{a_2} = \\left(\\frac{p}{q}\\right)^{2/3}")}
      <p>The resonant semi-major axis for a body in ${iq("p:q")} resonance
      with a planet at ${iq("a_{\\text{planet}}")} is:</p>
      ${eq("a_{\\text{res}} = a_{\\text{planet}} \\times \\left(\\frac{p}{q}\\right)^{2/3}")}
      <p>Common resonances and their semi-major axis ratios:</p>
      ${dataTable(
        ["Resonance", "a ratio", "Example"],
        [
          ["2:1", "1.587", "Kirkwood gap, Io-Europa"],
          ["3:2", "1.310", "Neptune-Pluto"],
          ["4:3", "1.211", "Asteroid belt"],
          ["5:3", "1.406", "Asteroid belt"],
          ["3:1", "2.080", "Kirkwood gap"],
        ],
      )}
      <p>The <b>Laplace resonance</b> of Jupiter's moons Io, Europa, and
      Ganymede is a celebrated three-body case: their periods stand in the
      ratio 1:2:4. The resonant condition is:</p>
      ${eq("n_1 - 3n_2 + 2n_3 = 0")}
      ${vars([["n_1, n_2, n_3", "mean motions (angular velocities) of Io, Europa, Ganymede"]])}
      <p>This resonance drives tidal heating in Io by pumping its eccentricity,
      making Io the most volcanically active body in the Solar System.</p>
      ${cite("Murray, C. D. & Dermott, S. F. (1999), Solar System Dynamics, Cambridge Univ. Press.")}`,
      mode,
    ),
  ].join("");
}
