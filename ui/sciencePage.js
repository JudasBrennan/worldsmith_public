import { fmt } from "../engine/utils.js";
import { bindNumberAndSlider } from "./bind.js";
import {
  massToLuminosity,
  calcHabitableZoneAu,
  estimateHabitableTeffKFromMass,
} from "../engine/star.js";
import { calcBodyAbsoluteMagnitude } from "../engine/apparent.js";
import { computeFlareParams } from "../engine/stellarActivity.js";
import { continuedFractionApproximants } from "../engine/calendar.js";
import { maxPeakHeight, maxShieldHeight, airyRootDepth } from "../engine/tectonics.js";
import {
  renderScienceFlareResult,
  renderScienceLeapCycles,
  renderScienceText,
} from "./science/domRender.js";
import { loadKaTeX, renderAllMath } from "./katexLoader.js";

/* ── KaTeX lazy loader ──────────────────────────────────────── */

/* ── Helpers ─────────────────────────────────────────────────── */

function eq(latex) {
  return `<span class="sci-math sci-math--block">${latex}</span>`;
}

function iq(latex) {
  return `<span class="sci-math">${latex}</span>`;
}

function vars(rows) {
  return `<table class="sci-vars"><tbody>${rows
    .map(([sym, desc]) => `<tr><td>${iq(sym)}</td><td>${desc}</td></tr>`)
    .join("")}</tbody></table>`;
}

function cite(text) {
  return `<p class="sci-cite">${text}</p>`;
}

function formula(name, body) {
  return `<div class="sci-formula"><h3 class="sci-formula__name">${name}</h3>${body}</div>`;
}

function dataTable(headers, rows) {
  return `<table class="sci-data"><thead><tr>${headers.map((h) => `<th>${h}</th>`).join("")}</tr></thead><tbody>${rows.map((r) => `<tr>${r.map((c) => `<td>${c}</td>`).join("")}</tr>`).join("")}</tbody></table>`;
}

/* ── Section builders ────────────────────────────────────────── */

function buildStellarPhysics() {
  return [
    formula(
      "Mass-Luminosity Relation",
      `<div class="sci-formula__eq">${eq("L = c \\cdot M^{\\alpha}")}</div>
      <p>Six-piece empirical power law relating stellar mass to luminosity, fitted to 509 eclipsing binary components.</p>
      ${dataTable(
        ["Mass range (M&#9737;)", "\\(\\alpha\\)", "c"],
        [
          ["M &lt; 0.45", "2.028", "0.0892"],
          ["0.45 &le; M &lt; 0.72", "4.572", "0.68"],
          ["0.72 &le; M &lt; 1.05", "5.743", "1.0"],
          ["1.05 &le; M &lt; 2.4", "4.329", "1.072"],
          ["2.4 &le; M &lt; 7.0", "3.967", "1.471"],
          ["M &ge; 7.0", "2.865", "12.55"],
        ],
      )}
      ${cite("Eker et al. (2018) MNRAS 479, 5491 &mdash; Table 4")}
      <div class="sci-try">
        <div class="sci-try__title">Try it</div>
        <div class="sci-try__row">
          <label>Mass <span class="unit">M&#9737;</span></label>
          <input id="sci-mlr-mass" type="number" value="1" min="0.075" max="100" step="0.01" />
          <input id="sci-mlr-slider" type="range" />
        </div>
        <div class="sci-try__output">
          <span class="sci-try__label">Luminosity</span>
          <span class="sci-try__value" id="sci-mlr-result">1.000 L&#9737;</span>
        </div>
      </div>`,
    ),

    formula(
      "Mass-Radius Relation",
      `<div class="sci-formula__eq">${eq("R = \\begin{cases} 0.0282 + 0.935\\,M & M \\le 0.5 \\\\ \\text{blend}(\\text{Schweitzer},\\,\\text{Eker quad}) & 0.5 < M \\le 0.7 \\\\ (0.438M^2 + 0.479M + 0.075) \\times \\text{norm} & 0.7 < M \\le 1.5 \\\\ \\sqrt{L}\\,(5776/T_{\\text{eff}})^2 \\times \\text{norm}_{\\text{SB}} & M > 1.5 \\end{cases}")}</div>
      <p>M dwarfs (M &le; 0.5): Schweitzer et al. (2019) linear relation from 55 eclipsing binaries, blended smoothly into the Eker quadratic over 0.5&ndash;0.7 M&#9737;. Mid-mass (0.7&ndash;1.5): Eker quadratic, normalised so R(1.0) = 1.0 R&#9737;. High-mass (M &gt; 1.5): Stefan-Boltzmann derivation from Eker MLR + MTR.</p>
      ${vars([
        ["R", "Stellar radius (R&#9737;)"],
        ["M", "Stellar mass (M&#9737;)"],
        ["L", "Luminosity from MLR (L&#9737;)"],
        ["T_{\\text{eff}}", "Temperature from MTR (K)"],
        ["\\text{norm}", "1 / 0.992 (solar normalisation)"],
        ["\\text{norm}_{\\text{SB}}", "Continuity factor at 1.5 M&#9737;"],
      ])}
      ${cite("Schweitzer et al. (2019, A&amp;A 625, A68); Eker et al. (2018, MNRAS 479, 5491)")}`,
    ),

    formula(
      "Mass-Temperature Relation (Eker MTR)",
      `<div class="sci-formula__eq">${eq("\\log T_{\\text{eff}} = -0.170\\,(\\log M)^2 + 0.888\\,\\log M + 3.671")}</div>
      <p>Empirical mass-temperature relation for M &gt; 1.5 M&#9737; from Eker et al. (2018, Table 5). Used with the MLR and Stefan-Boltzmann law to derive radius for high-mass stars where the quadratic MRR is not calibrated.</p>
      ${vars([
        ["T_{\\text{eff}}", "Effective temperature (K)"],
        ["M", "Stellar mass (M&#9737;)"],
      ])}
      ${cite("Eker et al. (2018, MNRAS 479, 5491)")}`,
    ),

    formula(
      "Effective Temperature (Stefan-Boltzmann)",
      `<div class="sci-formula__eq">${eq("T_{\\text{eff}} = \\left(\\frac{L}{R^2}\\right)^{1/4} \\times 5776 \\text{ K}")}</div>
      <p>Solar-normalised form of the Stefan-Boltzmann law ${iq("L = 4\\pi R^2 \\sigma T^4")}. Reference temperature 5776 K is the solar effective temperature.</p>
      ${vars([
        ["L", "Luminosity (L&#9737;)"],
        ["R", "Radius (R&#9737;)"],
      ])}`,
    ),

    formula(
      "Maximum Stellar Age",
      `<div class="sci-formula__eq">${eq("\\tau_{\\max} = \\frac{M}{L} \\times 10 \\text{ Gyr}")}</div>
      <p>Main-sequence lifetime: fuel supply (mass) divided by burn rate (luminosity). Equivalent to the classic ${iq("10 / M^{2.5}")} for ideal MS stars.</p>`,
    ),

    formula(
      "Habitable Zone (S<sub>eff</sub> Polynomials)",
      `<div class="sci-formula__eq">${eq("d = \\sqrt{\\frac{L}{S_{\\text{eff}}}}")}</div>
      <p>Inner and outer boundaries computed from 4th-order flux polynomials in ${iq("\\Delta T = T_{\\text{eff}} - 5778")}:</p>
      <div class="sci-formula__eq">${eq("S_{\\text{in}} = 1.107 + 1.332{\\times}10^{-4}\\Delta T + 1.58{\\times}10^{-8}\\Delta T^2 - 8.308{\\times}10^{-12}\\Delta T^3 - 5.073{\\times}10^{-15}\\Delta T^4")}</div>
      <div class="sci-formula__eq">${eq("S_{\\text{out}} = 0.356 + 6.171{\\times}10^{-5}\\Delta T + 1.698{\\times}10^{-9}\\Delta T^2 - 3.198{\\times}10^{-12}\\Delta T^3 - 5.575{\\times}10^{-16}\\Delta T^4")}</div>
      <p>Temperature proxy: ${iq("T_{\\text{eff}} = 5778 \\times M^{0.55}")}</p>
      ${cite("Kopparapu et al. (2013/2014) style; Chromant Desmos correction")}
      <div class="sci-try">
        <div class="sci-try__title">Try it</div>
        <div class="sci-try__row">
          <label>Mass <span class="unit">M&#9737;</span></label>
          <input id="sci-hz-mass" type="number" value="1" min="0.075" max="100" step="0.01" />
          <input id="sci-hz-slider" type="range" />
        </div>
        <div class="sci-try__output">
          <span class="sci-try__label">Habitable zone</span>
          <span class="sci-try__value" id="sci-hz-result">0.95 &ndash; 1.67 AU</span>
        </div>
      </div>`,
    ),

    formula(
      "Giant Planet Probability",
      `<div class="sci-formula__eq">${eq("P = \\text{clamp}\\left(0.07 \\times M_\\star \\times 10^{2[\\text{Fe/H}]},\\; 0,\\; 1\\right)")}</div>
      <p>Probability of hosting a giant planet (&gt;0.3 M<sub>Jup</sub>) as a function of stellar metallicity and mass.
      ~7% baseline at solar mass and metallicity ([Fe/H]&nbsp;=&nbsp;0, M&nbsp;=&nbsp;1&nbsp;M<sub>&odot;</sub>).
      The metallicity exponent is from Fischer &amp; Valenti (2005); the linear stellar mass factor
      is from Johnson et al. (2010): giant planets are ~3&times; more common around 2&nbsp;M<sub>&odot;</sub>
      A-type stars than 0.5&nbsp;M<sub>&odot;</sub> M&nbsp;dwarfs.</p>
      ${cite("Fischer &amp; Valenti (2005) ApJ 622, 1102; Johnson et al. (2010) PASP 122, 905; Petigura et al. (2018) AJ 155, 89")}`,
    ),

    formula(
      "Star Colour (Blackbody RGB)",
      `<p>Tanner Helland&rsquo;s piecewise approximation converts effective temperature to sRGB. Valid 1000&ndash;40,000 K (R&sup2; &gt; 0.987). Let ${iq("t = T/100")}:</p>
      <div class="sci-formula__eq">${eq("R = \\begin{cases} 255 & t \\le 66 \\\\ 329.70 \\cdot (t-60)^{-0.133} & t > 66 \\end{cases}")}</div>
      <div class="sci-formula__eq">${eq("G = \\begin{cases} 99.47\\ln(t) - 161.12 & t \\le 66 \\\\ 288.12 \\cdot (t-60)^{-0.076} & t > 66 \\end{cases}")}</div>
      <div class="sci-formula__eq">${eq("B = \\begin{cases} 255 & t \\ge 66 \\\\ 0 & t \\le 19 \\\\ 138.52\\ln(t-10) - 305.04 & \\text{otherwise} \\end{cases}")}</div>
      ${cite("Tanner Helland (2012) &mdash; tannerhelland.com")}`,
    ),

    formula(
      "Spectral Classification",
      `<p>Temperature mapped to spectral class via boundary lookup, then linear interpolation within the class gives subtype 0&ndash;9.9:</p>
      ${dataTable(
        ["Class", "T range (K)", "Span"],
        [
          ["O", "33,000 &ndash; 95,000", "62,000"],
          ["B", "10,000 &ndash; 33,000", "23,000"],
          ["A", "7,500 &ndash; 10,000", "2,500"],
          ["F", "6,000 &ndash; 7,500", "1,500"],
          ["G", "5,200 &ndash; 6,000", "800"],
          ["K", "3,700 &ndash; 5,200", "1,500"],
          ["M", "2,000 &ndash; 3,700", "1,700"],
        ],
      )}`,
    ),
  ].join("");
}

function buildStellarEvolution() {
  return [
    formula(
      "Metallicity Conversion",
      `<div class="sci-formula__eq">${eq("Z = Z_\\odot \\cdot 10^{[\\text{Fe/H}]}")}</div>
      <p>Converts spectroscopic iron abundance to total metal mass fraction, where ${iq("Z_\\odot = 0.02")}.</p>
      ${vars([
        ["Z", "Total metal mass fraction"],
        ["[\\text{Fe/H}]", "Iron abundance relative to Solar (dex), clamped to [&minus;3, +1]"],
      ])}`,
    ),

    formula(
      "ZAMS Luminosity",
      `<div class="sci-formula__eq">${eq("L_{\\text{ZAMS}} = \\frac{a_0 M^{5.5} + a_1 M^{11}}{a_2 + M^3 + a_3 M^5 + a_4 M^7 + a_5 M^8 + a_6 M^{9.5}}")}</div>
      <p>Rational polynomial fit to zero-age main-sequence luminosity. Each coefficient ${iq("a_i")} is itself a
      polynomial in ${iq("\\zeta = \\log_{10}(Z/0.02)")}, encoding metallicity dependence.</p>
      ${cite("Tout, Pols, Eggleton &amp; Han (1996), MNRAS 281, 257")}`,
    ),

    formula(
      "ZAMS Radius",
      `<div class="sci-formula__eq">${eq("R_{\\text{ZAMS}} = \\frac{a_0 M^{2.5} + a_1 M^{6.5} + a_2 M^{11} + a_3 M^{19} + a_4 M^{19.5}}{a_5 + a_6 M^2 + a_7 M^{8.5} + M^{18.5} + a_8 M^{19.5}}")}</div>
      <p>Matching rational polynomial for ZAMS radius, with metallicity-dependent coefficients.</p>
      ${cite("Tout et al. (1996), MNRAS 281, 257")}`,
    ),

    formula(
      "Main-Sequence Lifetime",
      `<div class="sci-formula__eq">${eq("t_{\\text{BGB}} = \\frac{a_0 + a_1 M^4 + a_2 M^{5.5} + M^7}{a_3 M^2 + a_4 M^7} \\;\\text{Myr}")}</div>
      <div class="sci-formula__eq">${eq("t_{\\text{MS}} \\approx 0.95 \\, t_{\\text{BGB}}")}</div>
      <p>Time from zero-age to the base of the giant branch. The main-sequence lifetime is
      approximately 95% of this. Coefficients are polynomials in ${iq("\\zeta")}.</p>
      ${cite("Hurley, Pols &amp; Tout (2000), MNRAS 315, 543 &mdash; eq. 4")}`,
    ),

    formula(
      "Terminal MS Luminosity",
      `<div class="sci-formula__eq">${eq("L_{\\text{TMS}} = \\frac{a_{11} M^3 + a_{12} M^4 + a_{13} M^{a_{16}+1.8}}{a_{14} + a_{15} M^5 + M^{a_{16}}}")}</div>
      <p>Luminosity at the end of the main sequence (terminal-age). Anchors the evolved luminosity track.</p>
      ${cite("Hurley et al. (2000) &mdash; eq. 8")}`,
    ),

    formula(
      "Terminal MS Radius",
      `<p>Piecewise fit: low-mass stars (${iq("M \\le a_{17}")}) and high-mass stars are computed
      with different rational polynomials, smoothly interpolated across the boundary.</p>
      ${cite("Hurley et al. (2000) &mdash; eq. 9")}`,
    ),

    formula(
      "Evolved Luminosity &amp; Radius",
      `<div class="sci-formula__eq">${eq("\\log(L/L_{\\text{ZAMS}}) = \\alpha_L \\tau + \\beta_L \\tau^\\eta + \\gamma \\tau^2")}</div>
      <div class="sci-formula__eq">${eq("\\log(R/R_{\\text{ZAMS}}) = \\alpha_R \\tau + \\gamma_R \\tau^3")}</div>
      ${vars([
        ["\\tau", "Fractional age = age / t_MS (0 at ZAMS, 1 at TMS)"],
        ["\\alpha_L,\\, \\alpha_R", "Evolution rates (Hurley eqs. 19&ndash;20)"],
        ["\\beta_L", "Curvature term; mass-dependent (eq. 20)"],
        ["\\eta", "10 (M &le; 1), 20 (M &ge; 1.1), interpolated between"],
        ["\\gamma", "Chosen so L(1) = L_TMS exactly"],
      ])}
      <p>The parametric forms reproduce full stellar-evolution tracks from ZAMS to the terminal main sequence,
      with smooth luminosity and radius growth that accelerates near turn-off.</p>
      ${cite("Hurley, Pols &amp; Tout (2000), MNRAS 315, 543")}`,
    ),
  ].join("");
}

function buildPlanetaryPhysics() {
  return [
    formula(
      "Mass&ndash;Radius Relation (Radius-First)",
      `<div class="sci-formula__eq">${eq("R_\\oplus = (1.07 - 0.21 \\cdot \\text{CMF}) \\cdot M_\\oplus^{\\,\\alpha}")}</div>
      <p>where ${iq("\\alpha(M) = \\min\\!\\left(\\tfrac{1}{3},\\; 0.257 - 0.0161 \\ln M_\\oplus\\right)")}.</p>
      <p>CMF scaling from Zeng &amp; Sasselov (2016); mass-dependent compression exponent calibrated to all four Solar System rocky planets (Mercury 0.3%, Venus 0.8%, Earth 0.2%, Mars 0.5%). Bulk density is then derived: ${iq("\\rho = 5.51 \\cdot M_\\oplus / R_\\oplus^{\\,3}")}.</p>
      ${vars([
        ["M_\\oplus", "Planet mass (Earth masses)"],
        ["\\text{CMF}", "Core-mass fraction (0&ndash;1)"],
        ["\\alpha", "Mass-dependent exponent (approaches 1/3 at low mass)"],
        ["R_\\oplus", "Planet radius (Earth radii)"],
        ["\\rho", "Bulk density (g/cm&sup3;)"],
      ])}
      <div class="sci-try">
        <div class="sci-try__title">Try it</div>
        <div class="sci-try__row">
          <label>Mass <span class="unit">M&#8853;</span></label>
          <input id="sci-dens-mass" type="number" value="1" min="0.01" max="100" step="0.01" />
          <input id="sci-dens-mass-slider" type="range" />
        </div>
        <div class="sci-try__row">
          <label>CMF <span class="unit">%</span></label>
          <input id="sci-dens-cmf" type="number" value="33" min="0" max="100" step="1" />
          <input id="sci-dens-cmf-slider" type="range" />
        </div>
        <div class="sci-try__output">
          <span class="sci-try__label">Radius &amp; Density</span>
          <span class="sci-try__value" id="sci-dens-result">1.002 R&#8853; &mdash; 5.48 g/cm&sup3;</span>
        </div>
      </div>`,
    ),

    formula(
      "Surface Gravity",
      `<div class="sci-formula__eq">${eq("g = \\frac{M_\\oplus}{R_\\oplus^{\\,2}} \\quad (\\text{in Earth } g)")}</div>
      <p>Newtonian surface gravity ${iq("g = GM/R^2")} in Earth-normalised units. SI: multiply by 9.81 m/s&sup2;.</p>`,
    ),

    formula(
      "Escape Velocity",
      `<div class="sci-formula__eq">${eq("v_{\\text{esc}} = \\sqrt{\\frac{M_\\oplus}{R_\\oplus}} \\times 11.186 \\text{ km/s}")}</div>
      <p>From ${iq("v_{\\text{esc}} = \\sqrt{2GM/R}")}, Earth&rsquo;s escape velocity is 11.186 km/s.</p>`,
    ),

    formula(
      "Insolation (Inverse Square Law)",
      `<div class="sci-formula__eq">${eq("S = \\frac{L}{d^2}")}</div>
      <p>Stellar flux at the planet relative to Earth (S&#8853; = 1). ${iq("L")} in L&#9737;, ${iq("d")} in AU.</p>`,
    ),

    formula(
      "Surface Temperature (Energy Balance)",
      `<p>Four-step chain from stellar flux to surface temperature:</p>
      <div class="sci-formula__eq">${eq("X = \\sqrt{\\frac{(1-A) \\cdot L_{\\text{erg}}}{16\\pi\\sigma}}")}</div>
      <div class="sci-formula__eq">${eq("T_{\\text{eff}} = \\frac{\\sqrt{X}}{\\sqrt{d_{\\text{cm}}}}")}</div>
      <div class="sci-formula__eq">${eq("T_{\\text{eq}}^4 = T_{\\text{eff}}^4 \\cdot \\left(1 + \\frac{3\\tau}{4}\\right)")}</div>
      <div class="sci-formula__eq">${eq("T_{\\text{surface}} = \\left(\\frac{T_{\\text{eq}}^4}{\\text{surfDiv}}\\right)^{1/4}")}</div>
      ${vars([
        ["A", "Bond albedo"],
        [
          "\\sigma",
          "Stefan-Boltzmann constant (5.670 &times; 10&supmin;&sup5; erg cm&supmin;&sup2; s&supmin;&sup1; K&supmin;&sup4;)",
        ],
        ["\\tau", "Grey IR optical depth = G<sub>h</sub> &times; 0.5841"],
        ["G_h", "Greenhouse effect (dimensionless; 1.0 &asymp; Earth)"],
        [
          "\\text{surfDiv}",
          "1 &minus; (1 &minus; 0.9) &times; min(&tau;, 1) &mdash; ramps from 1.0 (airless) to 0.9 (&tau; &ge; 1)",
        ],
      ])}
      <p>In <b>Core</b> and <b>Full</b> modes, ${iq("G_h")} is computed from atmospheric gas composition (see <em>Greenhouse Optical Depth from Gas Composition</em> in the Atmosphere &amp; Colour section). In <b>Manual</b> mode, ${iq("G_h")} is set directly by the user.</p>`,
    ),

    formula(
      "Clausius-Clapeyron Boiling Point",
      `<div class="sci-formula__eq">${eq("T_b = \\frac{1}{\\dfrac{1}{373.15} - \\dfrac{\\ln(p)}{L_v / R_g}}")}</div>
      <p>Pressure-dependent boiling point of water. ${iq("L_v/R_g = 40700/8.314 = 4894.4")} K. Calibrated: 1 atm &rarr; 373 K, 218 atm &rarr; 647 K (critical point).</p>`,
    ),

    formula(
      "Atmospheric Density (Ideal Gas Law)",
      `<div class="sci-formula__eq">${eq("\\rho = \\frac{p \\cdot M_w}{R \\cdot T}")}</div>
      ${vars([
        ["p", "Surface pressure (Pa) &mdash; 1 atm = 101,325 Pa"],
        ["M_w", "Mean molecular weight (kg/mol)"],
        ["R", "Gas constant (8.3145 J mol&supmin;&sup1; K&supmin;&sup1;)"],
        ["T", "Surface temperature (K)"],
      ])}`,
    ),

    formula(
      "Mean Molecular Weight",
      `<div class="sci-formula__eq">${eq("M_w = \\frac{\\sum_i f_i \\cdot m_i}{100} \\quad \\text{(kg/mol)}")}</div>
      ${dataTable(
        ["Gas", "Formula", "m<sub>i</sub> (kg/mol)"],
        [
          ["N&#8322;", "remainder (100 &minus; &sum; others)", "0.028"],
          ["O&#8322;", "user input", "0.032"],
          ["CO&#8322;", "user input", "0.044"],
          ["Ar", "user input", "0.040"],
          ["H&#8322;O", "user input", "0.018"],
          ["CH&#8324;", "user input", "0.016"],
          ["H&#8322;", "user input (Full mode)", "0.002"],
          ["He", "user input (Full mode)", "0.004"],
          ["SO&#8322;", "user input (Full mode)", "0.064"],
          ["NH&#8323;", "user input (Full mode)", "0.017"],
        ],
      )}
      <p>Weighted average molecular mass of the 10-gas atmosphere. N&#8322; fills the remainder so that all fractions ${iq("f_i")} sum to 100%. In Core mode the Full-mode gases default to 0; their stored values still participate in gas balance and molecular weight.</p>`,
    ),

    formula(
      "Horizon Distance",
      `<div class="sci-formula__eq">${eq("d = \\frac{\\sqrt{2Rh + h^2}}{1000} \\text{ km}")}</div>
      <p>Geometric distance to the horizon from height ${iq("h")} (metres) above a sphere of radius ${iq("R")} (metres). R = 6,371,000 &times; R&#8853;.</p>`,
    ),

    formula(
      "Orbital Period (Kepler III)",
      `<div class="sci-formula__eq">${eq("P = \\sqrt{\\frac{a^3}{M_\\star}} \\text{ years}")}</div>
      <p>Kepler&rsquo;s third law in solar units (${iq("a")} in AU, ${iq("M_\\star")} in M&#9737;). 1 year = 365.256 days.</p>`,
    ),

    formula(
      "Atmospheric Circulation Cells",
      `<p>Number of Hadley/Ferrel/polar cell pairs determined by rotation period:</p>
      ${dataTable(
        ["Rotation period", "Cells"],
        [
          ["&ge; 48 h", "1 (single Hadley)"],
          ["6 &ndash; 48 h", "3 (Earth-like)"],
          ["3 &ndash; 6 h", "7 (rapid rotator)"],
          ["&lt; 3 h", "5 (very rapid)"],
        ],
      )}`,
    ),
  ].join("");
}

function buildGasGiantPhysics() {
  return [
    formula(
      "Mass&ndash;Radius Relation",
      `<p>Two-regime power law calibrated to Solar System giants:</p>
      <div class="sci-formula__eq">${eq("R_\\oplus = \\begin{cases} 0.861\\,M_\\oplus^{\\,0.53} & M < 131.6\\,M_\\oplus \\\\ C_J\\,M_\\oplus^{\\,-0.044} & M \\ge 131.6\\,M_\\oplus \\end{cases}")}</div>
      <p>The Neptunian regime has radius growing with mass; the Jovian regime has radius
      <em>shrinking</em> due to degeneracy pressure. The boundary at 131.6 ${iq("M_\\oplus")}
      (0.414 ${iq("M_J")}) enforces continuity. ${iq("C_J")} is derived from the boundary condition.</p>
      ${cite("Chen &amp; Kipping (2017), ApJ 834, 17")}`,
    ),

    formula(
      "Sudarsky Classification",
      `<p>Temperature-based atmospheric classification with bond albedos:</p>
      ${dataTable(
        ["Class", "T<sub>eq</sub> (K)", "Cloud deck", "Albedo"],
        [
          ["I", "&le; 150", "NH&#8323; ice", "0.34"],
          ["II", "150&ndash;250", "H&#8322;O", "0.81"],
          ["III", "250&ndash;800", "Cloudless", "0.12"],
          ["IV", "800&ndash;1400", "Alkali metals", "0.10"],
          ["V", "&gt; 1400", "Silicate/iron", "0.55"],
        ],
      )}
      <p>Ice giants (${iq("M < 0.15\\,M_J")}) at ${iq("T_{\\text{eq}} < 100")} K override to methane haze (albedo 0.3).</p>
      ${cite("Sudarsky, Burrows &amp; Pinto (2000), ApJ 538, 885")}`,
    ),

    formula(
      "Cloud Condensation Layers",
      `<p>Species condense out of the atmosphere at characteristic temperatures:</p>
      ${dataTable(
        ["Species", "T<sub>cond</sub> (K)", "Pressure level"],
        [
          ["Iron (Fe)", "1800", "0.01 bar"],
          ["Silicate (MgSiO&#8323;)", "1400", "0.1 bar"],
          ["H&#8322;O", "300", "5 bar"],
          ["NH&#8324;SH", "200", "2 bar"],
          ["NH&#8323;", "150", "0.7 bar"],
          ["CH&#8324; (ice giants)", "80", "1.5 bar"],
        ],
      )}
      ${cite("Lodders &amp; Fegley (2002); Visscher, Moses &amp; Fegley (2010)")}`,
    ),

    formula(
      "Atmospheric Metallicity",
      `<div class="sci-formula__eq">${eq("\\log_{10}(Z/Z_\\odot) = 0.66 - 0.68\\,\\log_{10}(M/M_J)")}</div>
      <p>Lower-mass giants are more metal-enriched. Jupiter &asymp; 4.6&times;, Saturn &asymp; 10&times;,
      Neptune &asymp; 33&times; solar. Clamped to [1, 200] &times; solar.</p>
      ${cite("Thorngren &amp; Fortney (2019), ApJL 874, L31")}`,
    ),

    formula(
      "Internal Heat Ratio",
      `<p>Ratio of total emitted flux to absorbed flux, interpolated by mass:</p>
      ${dataTable(
        ["Mass range", "Ratio", "Analogue"],
        [
          ["&lt; 0.05 M<sub>J</sub>", "1.06", "Uranus"],
          ["0.1&ndash;0.2 M<sub>J</sub>", "2.6", "Neptune"],
          ["0.2&ndash;0.5 M<sub>J</sub>", "2.6 &rarr; 1.67", "Saturn &rarr; Jupiter"],
          ["0.5&ndash;1.5 M<sub>J</sub>", "1.67", "Jupiter"],
        ],
      )}
      <p>Effective temperature: ${iq("T_{\\text{eff}} = (T_{\\text{eq}}^4 \\cdot \\text{IHR})^{1/4}")}.</p>`,
    ),

    formula(
      "Magnetic Field (Dual-Normalised Energy-Flux Dynamo)",
      `<div class="sci-formula__eq">${eq("B_{\\text{surf}} = B_{\\text{ref}} \\cdot \\frac{\\text{raw}(\\text{planet})}{\\text{raw}(\\text{ref})}")}</div>
      <div class="sci-formula__eq">${eq("\\text{raw} = \\sqrt{\\rho} \\cdot q_{\\text{eff}}^{1/3} \\cdot \\left(\\frac{r_o}{R}\\right)^{\\!3.2}")}</div>
      <p>Christensen (2009) energy-flux dynamo scaling with dual normalisation.
        Gas giants normalise to Jupiter (${iq("B_{\\text{ref}} = 4.28")} G);
        ice giants normalise to the Uranus/Neptune geometric mean
        (${iq("B_{\\text{ref}} = \\sqrt{0.23 \\times 0.14} \\approx 0.18")} G).
        Separate references avoid cross-regime extrapolation between
        thick-shell dipolar and thin-shell multipolar dynamos.</p>
      ${vars([
        ["\\rho", "Bulk density (g/cm\\(^3\\)), proxy for dynamo-region density"],
        [
          "q_{\\text{eff}}",
          "max(internal flux + moon tidal flux, 0.4 W/m\\(^2\\)) &mdash; compositional convection floor",
        ],
        ["r_o/R", "Dynamo shell outer boundary fraction (see below)"],
      ])}
      <p><b>Dynamo shell geometry:</b></p>
      <ul style="font-size:13px;color:var(--muted);margin:4px 0 4px 18px">
        <li><b>Gas giants</b> (${iq("M \\geq 0.15\\,M_J")}): metallic H transition.
            ${iq("r_o/R = 0.40 + 0.43 \\cdot \\ln(M/0.3)/\\ln(1/0.3)")}
            &mdash; Jupiter 0.83, Saturn 0.40 (French+ 2012, Stanley &amp; Glatzmaier 2010)</li>
        <li><b>Ice giants</b> (${iq("M < 0.15\\,M_J")}): density-dependent ionic ocean.
            ${iq("r_o/R = 0.70 \\cdot (\\rho_{\\text{ref}}/\\rho)^{0.82}")}
            &mdash; less dense ice giants reach ionic dissociation at larger
            fractional radius (Stanley &amp; Bloxham 2004)</li>
      </ul>
      <p><b>Shell exponent (3.2):</b> The theoretical dipole attenuation is
        ${iq("(r_o/R)^3")}. The additional 0.2 accounts for thin-shell
        dipolarity reduction (Heimpel+ 2005) and stable-layer field filtering
        above the dynamo (Christensen &amp; Wicht 2008).</p>
      <p><b>Morphology:</b> Gas giants &rarr; dipolar (thick metallic-H shell).
        Ice giants &rarr; multipolar (thin ionic shell).</p>
      ${dataTable(
        ["Planet", "Model B (G)", "Observed B (G)", "Ratio"],
        [
          ["Jupiter", "4.28", "4.28", "1.00&times;"],
          ["Saturn", "~0.21", "0.21", "~0.99&times;"],
          ["Uranus", "~0.24", "0.23", "~1.02&times;"],
          ["Neptune", "~0.14", "0.14", "~1.00&times;"],
        ],
      )}
      <div class="sci-formula__eq">${eq("R_{\\text{CF}} = \\left(\\frac{B^2}{2\\,\\mu_0\\,P_{\\text{sw}}}\\right)^{1/6}")}</div>
      <p>Magnetopause standoff distance (Chapman&ndash;Ferraro dipole pressure balance).
      ${iq("P_{\\text{sw}} = P_{1\\text{AU}}/r^2")} is the solar wind dynamic pressure at orbit distance.</p>
      <p>Tidally heated moons drive volcanism and plasma loading that inflates the magnetosphere (e.g. Io plasma torus at Jupiter):</p>
      <div class="sci-formula__eq">${eq("R_{\\text{mp}} = R_{\\text{CF}} \\times (1 + H_{\\text{moon}}/H_{\\text{ref}})^{\\gamma}")}</div>
      <p>where ${iq("H_{\\text{moon}}")} is total tidal heating on all moons from the planet, with tidal-thermal feedback for intensely heated bodies.
      ${iq("H_{\\text{ref}} = 4 \\times 10^5")} W and ${iq("\\gamma = 0.047")} are calibrated to Jupiter (${iq("f \\approx 2.4")}) and Saturn (${iq("f \\approx 1.6")}).
      Below ${iq("10^8")} W total moon heating, no plasma inflation is applied.</p>
      ${dataTable(
        ["Planet", "Model R<sub>mp</sub>", "Observed R<sub>mp</sub>", "Error"],
        [
          ["Jupiter", "75 Rp", "75 Rp", "~0%"],
          ["Saturn", "22 Rp", "22 Rp", "~0%"],
          ["Uranus", "19 Rp", "18 Rp", "~3%"],
          ["Neptune", "18 Rp", "23 Rp", "~21%"],
        ],
      )}
      ${cite("Chapman &amp; Ferraro (1931); Peale, Cassen &amp; Reynolds (1979); Christensen+ (2009), Nature 457, 167; Stanley &amp; Bloxham (2004), Nature 428, 151")}`,
    ),

    formula(
      "Atmospheric Dynamics",
      `<div class="sci-formula__eq">${eq("L_{\\text{Rh}} = \\pi\\sqrt{U/\\beta}, \\quad \\beta = 2\\Omega/R")}</div>
      <div class="sci-formula__eq">${eq("N_{\\text{bands}} = \\pi R / L_{\\text{Rh}}")}</div>
      <p>Wind speed baseline: ${iq("U = 150\\sqrt{T_{\\text{eff}}/125}")} m/s. Band count clamped to [2, 30].
      Gas giants have prograde equatorial jets; ice giants have retrograde.</p>
      ${cite("Rhines (1975), JFM 69; Vasavada &amp; Showman (2005)")}`,
    ),

    formula(
      "Oblateness (Darwin&ndash;Radau)",
      `<div class="sci-formula__eq">${eq("f = \\frac{2.5\\,q}{1 + 6.25\\,(1 - 1.5\\xi)^2}, \\quad q = \\frac{\\omega^2 R^3}{GM}")}</div>
      ${vars([
        ["f", "Geometric flattening (equatorial bulge)"],
        ["q", "Rotation parameter"],
        ["\\xi", "Normalised moment of inertia (Saturn 0.239, Jupiter 0.269)"],
        ["J_2", "(2f &minus; q) / 3"],
      ])}
      <p>Equatorial radius: ${iq("R_{\\text{eq}} = R(1 + f/3)")}; polar: ${iq("R_{\\text{pol}} = R(1 - 2f/3)")}.</p>`,
    ),

    formula(
      "XUV-Driven Mass Loss",
      `<div class="sci-formula__eq">${eq("\\dot{M} = \\frac{\\varepsilon\\,\\pi\\,R_p^3\\,F_{\\text{XUV}}}{G\\,M_p}")}</div>
      <div class="sci-formula__eq">${eq("F_{\\text{XUV}} = F_\\odot\\,L_\\star\\,(t/t_\\odot)^{-1.23}\\,/\\,r^2")}</div>
      ${vars([
        ["\\varepsilon", "Heating efficiency = 0.15"],
        ["F_\\odot", "Solar XUV at 1 AU = 4.64 erg cm&sup2; s&sup1;"],
        ["t_\\odot", "Solar age = 4.6 Gyr"],
      ])}
      <p>Roche lobe from Eggleton (1983): ${iq("R_L = 0.462\\,a\\,(M_p/3M_\\star)^{1/3}")}.</p>
      ${cite("Ribas et al. (2005), ApJ 622; Eggleton (1983), ApJ 268")}`,
    ),

    formula(
      "Heavy Element / Core Mass",
      `<div class="sci-formula__eq">${eq("M_Z = 49.3\\,M_J^{\\,0.61}\\;M_\\oplus")}</div>
      <p>Total heavy-element content from transit + RV constraints. Estimated core mass:
      ${iq("M_{\\text{core}} = \\min(M_Z/2,\\; 25\\,M_\\oplus)")}.</p>
      ${cite("Thorngren, Fortney, Murray-Clay &amp; Lopez (2016), ApJ 831, 64")}`,
    ),

    formula(
      "Radius Inflation",
      `<div class="sci-formula__eq">${eq("R_{\\text{inflated}} = R \\cdot \\left(1 + 0.1\\,(5/t)^{0.35}\\right)")}</div>
      <p>Young giants are larger due to Kelvin-Helmholtz contraction. Hot Jupiters
      (${iq("T_{\\text{eq}} > 1000")} K) receive an additional 0.1&ndash;0.3 ${iq("R_J")}
      proximity bonus from stellar irradiation.</p>
      ${cite("Fortney, Marley &amp; Barnes (2007), ApJ 659")}`,
    ),

    formula(
      "Ring Properties",
      `<p>Ring mass model with a Gaussian enhancement peaked at Saturn&rsquo;s mass:</p>
      <div class="sci-formula__eq">${eq("M_{\\text{ring}} = 10^{12}\\sqrt{M_J} + 3{\\times}10^{19}\\,\\exp\\!\\left(-\\frac{(\\log M - \\log M_{\\text{Sat}})^2}{2\\sigma^2}\\right)\\;\\text{kg}")}</div>
      <p>Optical depth: ${iq("\\tau = \\Sigma / 67")} kg/m&sup2; (Saturn B-ring reference).
      Classification: dense (${iq("\\tau > 1")}), moderate (0.1&ndash;1), tenuous (${iq("\\tau \\le 0.1")}).
      Ring composition: icy (${iq("T < 150")} K), mixed (150&ndash;300 K), rocky (&gt; 300 K).</p>`,
    ),

    formula(
      "Moon Tidal Heating on Host",
      `<div class="sci-formula__eq">${eq("\\dot{E}_{\\text{host}} = \\frac{21}{2}\\,\\frac{k_{2}}{Q} \\, \\frac{G \\, M_m^{\\,2} \\, R_p^{\\,5} \\, n}{a^6} \\, f(e)")}</div>
      <p>Same Peale et al.&nbsp;(1979) formula as rocky planets, but gas/ice giants are fluid bodies&mdash;the rigid-body Love number from Munk &amp; MacDonald does not apply. Instead, ${iq("k_2")} and ${iq("Q")} are mass-dependent empirical fits.</p>

      <p><b>Fluid Love number</b> ${iq("k_2")} &mdash; sigmoid in log-mass space, capturing the transition from core-dominated ice giants to envelope-dominated gas giants:</p>
      <div class="sci-formula__eq">${eq("k_2(M) = k_{\\min} + \\frac{k_{\\max} - k_{\\min}}{1 + e^{\\,-s\\,(\\log_{10} M - \\log_{10} M_{\\text{mid}})}}")}</div>
      ${vars([
        ["k_{\\min}", "0.09 (heavily core-dominated sub-ice-giant)"],
        ["k_{\\max}", "0.385 (fluid-envelope-dominated gas giant)"],
        ["M_{\\text{mid}}", "0.072 M_J (core-to-envelope transition mass)"],
        ["s", "15 (transition steepness)"],
      ])}
      ${dataTable(
        ["Body", "Mass (M<sub>J</sub>)", "Model k&#8322;", "Observed k&#8322;", "Source"],
        [
          ["Jupiter", "1.0", "0.385", "0.379", "Wahl+ 2016 (Juno)"],
          ["Saturn", "0.30", "0.385", "0.390", "Lainey+ 2017 (Cassini)"],
          ["Uranus", "0.046", "0.104", "0.104", "Gavrilov &amp; Zharkov 1977"],
          ["Neptune", "0.054", "0.128", "0.127", "Gavrilov &amp; Zharkov 1977"],
        ],
      )}

      <p><b>Tidal quality factor</b> ${iq("Q")} &mdash; piecewise mass-dependent. Non-monotonic: Saturn&rsquo;s Q is anomalously low due to resonance locking (Fuller+ 2016).</p>
      ${dataTable(
        ["Regime", "Mass range", "Q", "Analogue"],
        [
          ["Ice giant", "&lt; 0.15 M<sub>J</sub>", "15,000", "Uranus, Neptune"],
          ["Saturn-like", "0.2&ndash;0.5 M<sub>J</sub>", "2,500", "Saturn (resonance locking)"],
          ["Jupiter-like", "&ge; 0.8 M<sub>J</sub>", "35,000", "Jupiter"],
        ],
      )}
      <p>Transitions between regimes use log-space interpolation.</p>

      <p><b>Physical context:</b> Moon tidal heating deposited in the <em>host planet</em> is negligible compared to Kelvin-Helmholtz contraction (${iq("\\sim 10^{-6}\\%")} of Jupiter&rsquo;s internal luminosity). The same formula applied to the <em>moon</em> (with the moon&rsquo;s k&#8322;/Q) gives the familiar Io ${iq("\\sim 10^{14}")} W.</p>
      ${cite("Peale, Cassen &amp; Reynolds (1979); Wahl et al. (2016); Lainey et al. (2009, 2017); Fuller, Luan &amp; Quataert (2016)")}`,
    ),
  ].join("");
}

function buildOrbitalMechanics() {
  return [
    formula(
      "Kepler&rsquo;s Third Law (Moon Orbit)",
      `<div class="sci-formula__eq">${eq("P = \\frac{2\\pi\\sqrt{a^3 / G(M_p + M_m)}}{86400} \\text{ days}")}</div>
      ${vars([
        ["a", "Semi-major axis (metres)"],
        ["G", "6.674 &times; 10&supmin;&sup1;&sup1; N m&sup2; kg&supmin;&sup2;"],
        ["M_p, M_m", "Planet and moon masses (kg)"],
      ])}`,
    ),

    formula(
      "Periapsis and Apoapsis",
      `<div class="sci-formula__eq">${eq("r_p = a(1-e), \\quad r_a = a(1+e)")}</div>
      <p>Orbital distance extremes from the standard Keplerian elements.</p>`,
    ),

    formula(
      "Roche Limit",
      `<div class="sci-formula__eq">${eq("d_{\\text{Roche}} = 2.44 \\, R_p \\left(\\frac{\\rho_p}{\\rho_m}\\right)^{1/3}")}</div>
      <p>Orbital distance inside which tidal forces exceed the satellite&rsquo;s self-gravity, causing disruption. The classical fluid-body result.</p>`,
    ),

    formula(
      "Hill Sphere",
      `<div class="sci-formula__eq">${eq("r_H = a_p \\left(\\frac{M_p}{3 M_\\star}\\right)^{1/3}")}</div>
      <p>Gravitational sphere of influence of the planet relative to the host star. Moons beyond ${iq("r_H")} cannot remain bound.</p>`,
    ),

    formula(
      "Love Number k<sub>2</sub>",
      `<div class="sci-formula__eq">${eq("k_2 = \\frac{1.5}{1 + \\dfrac{19\\mu}{2\\rho g R}}")}</div>
      ${vars([
        ["\\mu", "Rigidity (composition-dependent: 3.5&ndash;100 GPa)"],
        ["\\rho", "Mean density (kg/m&sup3;)"],
        ["g", "Surface gravity (m/s&sup2;)"],
        ["R", "Body radius (metres)"],
      ])}
      <p>Dimensionless measure of a body&rsquo;s tidal deformation response. Higher ${iq("k_2")} means the body deforms more easily.</p>`,
    ),

    formula(
      "Tidal Lock Timescale",
      `<div class="sci-formula__eq">${eq("\\tau = \\frac{\\omega \\, a^6 \\, I \\, Q}{3 G M_{\\text{tide}}^2 \\, k_2 \\, R^5}")}</div>
      ${vars([
        ["\\omega", "Initial spin angular velocity (rad/s)"],
        ["I", "Moment of inertia (0.4 MR&sup2; for solid sphere)"],
        ["Q", "Tidal quality factor (composition-dependent: 5&ndash;80)"],
        ["a", "Orbital semi-major axis (metres)"],
        ["M_{\\text{tide}}", "Mass of the body raising the tide (see below)"],
        ["R", "Radius of the body being locked"],
        ["k_2", "Love number of the body being locked"],
      ])}
      <p>Time for tidal dissipation to synchronise a body&rsquo;s spin with its orbit. Applied three times per system:</p>
      <ul style="font-size:13px;color:var(--muted);margin:4px 0 4px 18px">
        <li><b>Moon &rarr; planet</b>: ${iq("M_{\\text{tide}}")} = planet mass, ${iq("R, k_2")} = moon</li>
        <li><b>Planet &rarr; moon</b>: ${iq("M_{\\text{tide}}")} = moon mass, ${iq("R, k_2")} = planet</li>
        <li><b>Planet &rarr; star</b>: ${iq("M_{\\text{tide}}")} = star mass, ${iq("R, k_2")} = planet</li>
      </ul>
      ${cite("Duchene &amp; Kraus (2013); tidal dissipation model")}`,
    ),

    formula(
      "Spin-Orbit Resonance",
      `<div class="sci-formula__eq">${eq("H(p,\\,e)")}</div>
      ${vars([
        ["H(\\tfrac{3}{2},\\,e) = \\tfrac{7}{2}\\,e", "3:2 resonance (e.g. Mercury)"],
        ["H(2,\\,e) = \\tfrac{17}{2}\\,e^2", "2:1 resonance"],
        ["H(\\tfrac{5}{2},\\,e) = \\tfrac{845}{48}\\,e^3", "5:2 resonance"],
      ])}
      <p>Goldreich &amp; Peale (1966) eccentricity functions.
      During tidal despinning, the planet encounters resonances from highest to lowest.
      A resonance is &ldquo;capturable&rdquo; when its ${iq("H(p,e)")} exceeds a threshold
      (0.25 for 3:2, 0.5 for 2:1 and 5:2). Higher orbital eccentricity enables
      higher-order resonances; low eccentricity leads to synchronous 1:1 lock.</p>
      <p>The resonance rotation period is ${iq("P_{\\text{rot}} = P_{\\text{orb}} / p")} where ${iq("p")} is the spin rate in units of orbital frequency (1.5 for 3:2, etc.).</p>
      ${cite("Goldreich &amp; Peale (1966), AJ 71, 425")}`,
    ),

    formula(
      "Atmospheric Tide Resistance",
      `<div class="sci-formula__eq">${eq("b_{\\text{atm}} = C \\; \\frac{P_s \\; S}{g \\; T_{\\text{eq}}}")}</div>
      ${vars([
        ["P_s", "Surface pressure (atm)"],
        ["S = L/a^2", "Insolation relative to Earth"],
        ["g", "Surface gravity (m/s&sup2;)"],
        ["T_{\\text{eq}}", "Equilibrium temperature (K), before greenhouse"],
        ["C = 12", "Calibration constant (Venus &rarr; b &gt; 1)"],
      ])}
      <p>Ratio of atmospheric thermal-tide torque to gravitational body-tide torque.
      Stellar heating creates an asymmetric pressure bulge whose torque opposes tidal
      synchronisation.</p>
      <ul style="font-size:13px;color:var(--muted);margin:4px 0 4px 18px">
        <li>${iq("b < 1")}: body tide dominates &mdash; effective lock time = ${iq("\\tau / (1 - b)")}</li>
        <li>${iq("b \\ge 1")}: atmosphere prevents locking entirely (e.g. Venus)</li>
      </ul>
      ${cite("Leconte et al. (2015), Science 347, 632; Ingersoll &amp; Dobrovolskis (1978), Nature 275, 37")}`,
    ),

    formula(
      "Tidal Force",
      `<div class="sci-formula__eq">${eq("F_{\\text{tidal}} = \\frac{2 G M_1 M_2}{d^3}")}</div>
      <p>Differential tidal stretching force. Scales as ${iq("M/d^3")} (not ${iq("M/d^2")}). Normalised to Earth&rsquo;s combined lunar + solar tidal force (1.50 &times; 10&sup1;&sup2; N).</p>`,
    ),

    formula(
      "Synodic Period",
      `<div class="sci-formula__eq">${eq("\\frac{1}{P_{\\text{syn}}} = \\left|\\frac{1}{P_{\\text{sid}}} - \\frac{1}{P_{\\text{orb}}}\\right|")}</div>
      <p>Apparent lunar phase cycle as seen from the planet&rsquo;s surface.</p>`,
    ),

    formula(
      "Tidal Heating",
      `<div class="sci-formula__eq">${eq("\\dot{E} = \\frac{21}{2}\\,\\frac{k_2}{Q} \\, \\frac{G \\, M_p^{\\,2} \\, R_m^{\\,5} \\, n}{a^6} \\, f(e)")}</div>
      ${vars([
        ["k_2", "Love number of the moon (composition-dependent)"],
        ["Q", "Tidal quality factor of the moon"],
        ["M_p", "Parent body mass (kg)"],
        ["R_m", "Moon radius (metres)"],
        ["n", "Mean orbital motion = 2&pi;/P<sub>sid</sub> (rad/s)"],
        ["e", "Orbital eccentricity"],
        ["a", "Semi-major axis (metres)"],
        ["f(e)", "Wisdom (2008) eccentricity function (see below)"],
      ])}
      <p>The eccentricity function ${iq("f(e)")} replaces the simple ${iq("e^2")} truncation with a series valid for high eccentricities:</p>
      <div class="sci-formula__eq">${eq("f(e) = \\frac{e^2 \\cdot N_a(e)}{(1 - e^2)^{15/2}}, \\quad N_a = 1 + \\tfrac{31}{2}e^2 + \\tfrac{255}{8}e^4 + \\tfrac{185}{16}e^6 + \\tfrac{25}{64}e^8")}</div>
      <p>Note: obliquity tides (${iq("\\propto \\sin^2\\varepsilon")}) are omitted. Orbital inclination is not the same as spin-axis obliquity, and forced obliquity for tidally locked moons requires Cassini-state theory to compute.</p>
      <p>Composition determines ${iq("k_2")} and ${iq("Q")} via bulk density:</p>
      <table style="font-size:12px;color:var(--muted);margin:4px 0 4px 8px;border-collapse:collapse">
        <tr><th style="text-align:left;padding:2px 8px">Class</th><th style="padding:2px 8px">&rho; (g/cm&sup3;)</th><th style="padding:2px 8px">&mu; (GPa)</th><th style="padding:2px 8px">Q</th><th style="padding:2px 8px">Calibration</th></tr>
        <tr><td style="padding:2px 8px">Very icy</td><td style="text-align:center;padding:2px 8px">&lt; 1.0</td><td style="text-align:center;padding:2px 8px">3.5</td><td style="text-align:center;padding:2px 8px">5</td><td style="padding:2px 8px"></td></tr>
        <tr><td style="padding:2px 8px">Icy</td><td style="text-align:center;padding:2px 8px">1.0&ndash;2.0</td><td style="text-align:center;padding:2px 8px">4</td><td style="text-align:center;padding:2px 8px">10</td><td style="padding:2px 8px"></td></tr>
        <tr><td style="padding:2px 8px">Subsurface ocean</td><td style="text-align:center;padding:2px 8px">override</td><td style="text-align:center;padding:2px 8px">0.3</td><td style="text-align:center;padding:2px 8px">2</td><td style="padding:2px 8px">Enceladus</td></tr>
        <tr><td style="padding:2px 8px">Mixed rock/ice</td><td style="text-align:center;padding:2px 8px">2.0&ndash;3.2</td><td style="text-align:center;padding:2px 8px">20</td><td style="text-align:center;padding:2px 8px">15</td><td style="padding:2px 8px"></td></tr>
        <tr><td style="padding:2px 8px">Rocky</td><td style="text-align:center;padding:2px 8px">3.2&ndash;5.0</td><td style="text-align:center;padding:2px 8px">50</td><td style="text-align:center;padding:2px 8px">30</td><td style="padding:2px 8px"></td></tr>
        <tr><td style="padding:2px 8px">Partially molten</td><td style="text-align:center;padding:2px 8px">override</td><td style="text-align:center;padding:2px 8px">10</td><td style="text-align:center;padding:2px 8px">10</td><td style="padding:2px 8px">Io</td></tr>
        <tr><td style="padding:2px 8px">Iron-rich</td><td style="text-align:center;padding:2px 8px">&gt; 5.0</td><td style="text-align:center;padding:2px 8px">100</td><td style="text-align:center;padding:2px 8px">80</td><td style="padding:2px 8px"></td></tr>
      </table>
      <p><b>Why composition overrides?</b> Bulk density is a reliable proxy for cold, geologically quiet moons, but it systematically underestimates heating for bodies with extreme interiors. Io&rsquo;s rocky density (3.53 g/cm&sup3;) maps to ${iq("\\mu")} = 50 GPa and ${iq("Q")} = 30, under-predicting its observed 10&sup1;&sup4; W by ~7&times;. Enceladus&rsquo;s icy density (1.61 g/cm&sup3;) gives ${iq("\\mu")} = 4 GPa and ${iq("Q")} = 10, under-predicting its Cassini-measured 1.6 &times; 10&sup1;&deg; W by ~60&times;.</p>
      <p>The override classes address this by modelling the interior state rather than just bulk composition:</p>
      <ul style="font-size:13px;color:var(--muted);margin:4px 0 4px 18px">
        <li><b>Partially molten</b> &mdash; extreme tidal heating has melted the interior, creating a magma ocean or mushy mantle that dramatically lowers rigidity. Calibrated to Io: predicted heating matches observed power within 1%.</li>
        <li><b>Subsurface ocean</b> &mdash; a global liquid ocean beneath a thin ice shell decouples the shell from the core and amplifies dissipation. Calibrated to Enceladus: predicted heating matches Cassini observations within 10%. Less reliable for large icy moons (Titan predicted ~37&times; too high, an active area of research).</li>
      </ul>
      <p>Validation against Solar System moons: Europa 1.4&times; observed, Ganymede and Callisto within order of magnitude, Earth&rsquo;s Moon 0.9&times;. Recession rate for the Earth&ndash;Moon system predicted at 3.5 cm/yr vs. observed 3.83 cm/yr (0.9&times;).</p>
      <p>Surface flux = ${iq("\\dot{E} / 4\\pi R_m^2")}. Normalised to Earth&rsquo;s mean geothermal flux (0.09 W/m&sup2;).</p>
      ${cite("Wisdom (2004); Peale, Cassen &amp; Reynolds (1979)")}`,
    ),

    formula(
      "Moon Tidal Heating on Planet",
      `<div class="sci-formula__eq">${eq("\\dot{E}_{\\text{planet}} = \\frac{21}{2}\\,\\frac{k_{2p}}{Q_p} \\, \\frac{G \\, M_m^{\\,2} \\, R_p^{\\,5} \\, n}{a^6} \\, f(e)")}</div>
      ${vars([
        ["k_{2p}, Q_p", "Love number and quality factor of the planet"],
        ["M_m", "Moon mass (kg) &mdash; the perturber"],
        ["R_p", "Planet radius (metres) &mdash; the heated body"],
        ["n", "Moon mean orbital motion = 2&pi;/P<sub>sid</sub> (rad/s)"],
        ["a", "Moon semi-major axis (metres)"],
        ["f(e)", "Wisdom (2008) eccentricity function (same as moon heating)"],
      ])}
      <p>Reciprocal of the moon tidal heating formula: now the planet is the body being deformed.
      Rocky planets use composition-dependent ${iq("k_2")} and ${iq("Q")} (from CMF and WMF).
      Gas/ice giants use a separate fluid ${iq("k_2")} and mass-dependent ${iq("Q")} model (see Gas Giant Physics &sect; Moon Tidal Heating on Host).</p>
      <p><b>Core lifetime extension:</b> comparing total moon tidal heating to the planet&rsquo;s
      internal heat budget (${iq("\\sim 44")} TW &times; ${iq("M / M_\\oplus")} &times; ${iq("A")}), tidal heating
      extends the core solidification timescale:</p>
      <div class="sci-formula__eq">${eq("\\tau_{\\text{core}} = \\frac{\\tau_{\\text{base}}}{\\max(0.01,\\; 1 - f_{\\text{tidal}})}, \\quad f_{\\text{tidal}} = \\frac{\\dot{E}_{\\text{planet}}}{44 \\times 10^{12} \\cdot (M/M_\\oplus) \\cdot A}")}</div>
      <p>When ${iq("f_{\\text{tidal}} \\ge 1")}, tidal heating dominates and the core stays liquid indefinitely.
      This can sustain a magnetic dynamo well past the planet&rsquo;s natural core solidification age.</p>
      ${cite("Peale, Cassen &amp; Reynolds (1979); Wisdom (2008)")}`,
    ),

    formula(
      "Tidal Recession",
      `<div class="sci-formula__eq">${eq("\\frac{da}{dt} = \\underbrace{\\operatorname{sgn}(\\Omega_p - n)\\;\\frac{3\\,k_{2p}}{Q_p}\\,\\frac{m_m}{m_p}\\,\\frac{n\\,R_p^5}{a^4}}_{\\text{planet tide}} \\;-\\; \\underbrace{\\frac{21}{2}\\,\\frac{k_{2m}}{Q_m}\\,\\frac{m_p}{m_m}\\,\\frac{n\\,R_m^5\\,e^2}{a^4}}_{\\text{moon tide}}")}</div>
      ${vars([
        ["\\Omega_p", "Planet spin angular velocity (rad/s)"],
        ["n", "Moon mean orbital motion (rad/s)"],
        ["k_{2p}, Q_p", "Love number and quality factor of the planet"],
        ["k_{2m}, Q_m", "Love number and quality factor of the moon"],
        ["m_p, m_m", "Planet and moon masses (kg)"],
        ["R_p, R_m", "Planet and moon radii (metres)"],
      ])}
      <p>When the planet spins faster than the moon orbits (${iq("\\Omega_p > n")}), the planet&rsquo;s tidal bulge leads the moon and transfers angular momentum outward &mdash; the orbit expands (Earth&ndash;Moon: +3.8 cm/yr). When ${iq("\\Omega_p < n")}, angular momentum is lost and the moon spirals inward (Phobos).</p>
      ${cite("Leconte et al. (2010); constant-time-lag tidal model")}`,
    ),

    formula(
      "Tidal-Thermal Feedback",
      `<p>Intense tidal heating partially melts a rocky interior, lowering rigidity ${iq("\\mu")} and quality factor ${iq("Q")}, which further amplifies dissipation &mdash; a positive feedback loop. This is the key mechanism behind Io&rsquo;s extreme volcanism in the Laplace resonance (Io&ndash;Europa&ndash;Ganymede 1:2:4).</p>
      <p>For rocky moons (${iq("\\rho \\ge 3.2")} g/cm&sup3;) without a manual composition override, the model first computes tidal flux with cold (density-derived) material properties. A melt fraction ${iq("f")} is then derived from the ratio of flux to a critical threshold:</p>
      <div class="sci-formula__eq">${eq("f = \\frac{1}{1 + (F_{\\text{crit}} / F_0)^3}, \\quad F_{\\text{crit}} = 0.02 \\;\\text{W/m}^2")}</div>
      <p>Rigidity and Q are blended toward partially-molten values:</p>
      <div class="sci-formula__eq">${eq("\\mu_{\\text{eff}} = \\exp\\!\\left[(1 - f)\\,\\ln\\mu_{\\text{cold}} + f\\,\\ln\\mu_{\\text{melt}}\\right], \\quad Q_{\\text{eff}} = (1 - f)\\,Q_{\\text{cold}} + f\\,Q_{\\text{melt}}")}</div>
      ${vars([
        ["F_0", "Initial tidal flux from cold material properties (W/m\u00B2)"],
        ["F_{\\text{crit}}", "Critical flux for partial melting (0.02 W/m\u00B2)"],
        ["\\mu_{\\text{melt}}", "10 GPa (partially molten rigidity)"],
        ["Q_{\\text{melt}}", "10 (partially molten quality factor)"],
      ])}
      <p>Tidal heating is then recalculated with ${iq("\\mu_{\\text{eff}}")} and ${iq("Q_{\\text{eff}}")}. For Io: cold flux = 0.35 W/m&sup2; triggers full melting (${iq("f \\approx 1")}), giving ${iq("\\sim 10^{14}")} W &mdash; matching observed heating.</p>
      ${cite("Moore (2003); Segatz et al. (1988) \u2014 tidal-convective equilibrium models")}`,
    ),

    formula(
      "Moon Surface Temperature",
      `<div class="sci-formula__eq">${eq("T_{\\text{eq}} = \\left(\\frac{L_\\star\\,(1 - a)}{16\\,\\pi\\,\\sigma\\,d^2}\\right)^{1/4}")}</div>
      <p>Equilibrium temperature for an airless body (no greenhouse). The moon&rsquo;s distance from the star is approximated as the parent planet&rsquo;s semi-major axis.</p>
      <div class="sci-formula__eq">${eq("T_{\\text{surf}} = \\left(T_{\\text{eq}}^4 + \\frac{F_{\\text{tidal}}}{\\sigma} + \\frac{F_{\\text{radio}}}{\\sigma}\\right)^{1/4}")}</div>
      <p>Total surface temperature adds tidal heating flux and radiogenic heating flux as additional energy inputs. Radiogenic flux:</p>
      <div class="sci-formula__eq">${eq("F_{\\text{radio}} = \\frac{44\\;\\text{TW} \\times (M_m / M_\\oplus) \\times A}{4\\,\\pi\\,R_m^2}")}</div>
      ${vars([
        ["L_\\star", "Star luminosity (W)"],
        ["a", "Moon Bond albedo"],
        ["d", "Star\u2013planet distance (metres)"],
        [
          "\\sigma",
          "Stefan-Boltzmann constant (5.67\u00D710\u207B\u2078 W m\u207B\u00B2 K\u207B\u2074)",
        ],
        ["F_{\\text{tidal}}", "Tidal heating surface flux (W/m\u00B2)"],
        ["A", "Radioisotope abundance (\u00D7 Earth)"],
        ["M_m, R_m", "Moon mass (kg) and radius (metres)"],
      ])}
      <p>For Earth&rsquo;s Moon: ${iq("T_{\\text{eq}} \\approx 270")} K. Tidal and radiogenic contributions are negligible. For Io: tidal heating adds ~4 K to the mean surface temperature.</p>`,
    ),

    formula(
      "Magnetospheric Radiation",
      `<div class="sci-formula__eq">${eq("B(r) = B_{\\text{surf}} \\times \\left(\\frac{R_p}{r}\\right)^3")}</div>
      <p>Dipole magnetic field at the moon&rsquo;s orbital distance. The radiation dose from trapped charged particles scales as ${iq("B^3")}:</p>
      <div class="sci-formula__eq">${eq("D = 3.97 \\times 10^9 \\times B(r)^3 \\;\\text{rem/day}")}</div>
      <p>where ${iq("B")} is in Gauss. Calibrated to Jupiter&ndash;Europa: ${iq("B \\approx 5.14 \\times 10^{-3}")} G &rarr; 540 rem/day.</p>
      ${vars([
        ["B_{\\text{surf}}", "Planet surface field (Gauss)"],
        ["R_p", "Planet radius"],
        ["r", "Moon semi-major axis"],
      ])}
      <p>Magnetopause standoff (Chapman&ndash;Ferraro scaling from Earth):</p>
      <div class="sci-formula__eq">${eq("L_{\\text{mp}} = 10 \\times B_{\\oplus}^{1/3} \\times d_{\\text{AU}}^{1/3} \\;\\text{[planet radii]}")}</div>
      <p>where ${iq("B_{\\oplus}")} is the planet&rsquo;s surface field in Earth units. Moons beyond the magnetopause receive zero trapped-particle radiation.</p>
      <p>Magnetopause shadowing: energetic particle drift orbits that intersect the magnetopause are lost, depleting the outer radiation belts. Applied as a logistic attenuation factor:</p>
      <div class="sci-formula__eq">${eq("D_{\\text{eff}} = \\frac{D}{1 + e^{25(L/L_{\\text{mp}} - 0.3)}} ")}</div>
      <p>where ${iq("L/L_{\\text{mp}}")} is the moon&rsquo;s L-shell as a fraction of the magnetopause distance. The rolloff onset at 30% matches observed radiation depletion at Callisto (${iq("L/L_{\\text{mp}} \\approx 0.35")}).</p>
      ${cite("Paranicas et al. (2009); Divine & Garrett (1983) — Jupiter radiation environment")}`,
    ),

    formula(
      "Volatile Inventory &amp; Atmospheric Retention",
      `<p>Identifies surface ices and thin atmospheres on airless moons via three checks per species:</p>
      <p><b>1. Presence:</b> Species is available if the moon&rsquo;s bulk density ${iq("\\rho < \\rho_{\\text{max}}")} for that ice
      (lower density &rArr; higher ice fraction). Exception: SO&#8322; requires active tidal feedback (volcanism).</p>
      <p><b>2. Sublimation:</b> Vacuum sublimation onset when ${iq("T_{\\text{surf}} \\geq T_{\\text{sub}}")} (temperature
      at which vapor pressure &asymp; 1 Pa). These thresholds are lower than the triple-point temperatures
      used for planets because moons exist in near-vacuum.</p>
      <p><b>3. Retention (Jeans escape):</b></p>
      <div class="sci-formula__eq">${eq("\\lambda = \\frac{m_s\\, v_{\\text{esc}}^2}{2\\, k_B\\, T}")}</div>
      ${vars([
        ["m_s", "Molecular mass of species (kg)"],
        ["v_{\\text{esc}}", "Moon surface escape velocity (m/s)"],
        ["k_B", "Boltzmann constant"],
        ["T", "Surface temperature (K)"],
      ])}
      <p>${iq("\\lambda > 6")} &rArr; instantaneous retention; ${iq("\\lambda < 3")} &rArr; escaping.</p>
      <p><b>4. Geological retention (escape timescale):</b></p>
      <p>Instantaneous retention (${iq("\\lambda > 6")}) is necessary but not sufficient. The atmosphere must also persist over the system&rsquo;s age:</p>
      <div class="sci-formula__eq">${eq("\\tau_{\\text{esc}} = \\frac{P}{g \\sqrt{\\frac{m_s}{2\\pi\\, k_B T}}\\,(1 + \\lambda)\\, e^{-\\lambda}}")}</div>
      ${vars([
        ["P", "Surface vapor pressure (Pa)"],
        ["g", "Moon surface gravity (m/s&sup2;)"],
      ])}
      <p>A species sustains a thin atmosphere only if ${iq("\\tau_{\\text{esc}} > t_{\\text{age}}")}. This eliminates false positives like Titania, where ${iq("\\lambda \\approx 17")} but ${iq("\\tau_{\\text{esc}} \\approx 38")} years. SO&#8322; from active volcanism is exempt (continuous resupply).</p>
      <p><b>Vapor pressure (Clausius&ndash;Clapeyron):</b></p>
      <div class="sci-formula__eq">${eq("P = P_{\\text{tp}} \\exp\\!\\left[-\\frac{\\Delta H_{\\text{sub}}}{R}\\!\\left(\\frac{1}{T} - \\frac{1}{T_{\\text{tp}}}\\right)\\right]")}</div>
      <p>Gives approximate surface pressure for display (e.g. N&#8322; ~14 Pa for Triton).</p>
      ${dataTable(
        ["Species", "T_{sub} (K)", "\\rho_{max}", "Source"],
        [
          ["N\\u2082", "35", "2.5 g/cm\\u00B3", "Fray & Schmitt (2009)"],
          ["CO", "35", "2.5 g/cm\\u00B3", ""],
          ["CH\\u2084", "50", "2.5 g/cm\\u00B3", ""],
          ["CO\\u2082", "115", "3.2 g/cm\\u00B3", ""],
          ["NH\\u2083", "130", "2.5 g/cm\\u00B3", ""],
          ["SO\\u2082", "140", "volcanic", ""],
          ["H\\u2082O", "210", "3.2 g/cm\\u00B3", ""],
        ],
      )}
      ${cite("Fray & Schmitt (2009, PSS 57, 2053); Jeans (1916) — atmospheric escape theory; Chamberlain (1963) — hydrodynamic escape timescale")}`,
    ),
  ].join("");
}

function buildLagrangePoints() {
  return [
    formula(
      "Hill Sphere",
      `<div class="sci-formula__eq">${eq("r_H = a \\left(\\frac{m}{3M_\\star}\\right)^{1/3}")}</div>
      <p>Radius of gravitational dominance. Objects within the Hill sphere are bound to the body
      rather than the star.</p>`,
    ),

    formula(
      "L1 and L2",
      `<div class="sci-formula__eq">${eq("L_1 = a - r_H, \\quad L_2 = a + r_H")}</div>
      <p>Collinear Lagrange points on the star&ndash;body line, located at approximately one Hill radius
      sunward (L1) and anti-sunward (L2) of the body.</p>`,
    ),

    formula(
      "L3",
      `<div class="sci-formula__eq">${eq("L_3 = a\\left(1 + \\frac{5m}{12M_\\star}\\right)")}</div>
      <p>Located on the far side of the star, 180&deg; from the body. The mass-ratio correction is
      negligible for planetary masses.</p>`,
    ),

    formula(
      "L4 and L5 (Trojans)",
      `<div class="sci-formula__eq">${eq("r = a, \\quad \\theta = \\theta_{\\text{body}} \\pm 60°")}</div>
      <p>Equilateral triangle points leading (+60&deg;, L4) and trailing (&minus;60&deg;, L5) the body
      in its orbit.</p>
      <div class="sci-formula__eq">${eq("\\mu = \\frac{m}{m + M_\\star} < \\mu_{\\text{crit}} = \\frac{1 - \\sqrt{69}/9}{2} \\approx 0.0385")}</div>
      <p>Gascheau (1843) stability criterion: L4/L5 are linearly stable only when the
      secondary mass ratio &mu; is below &mu;<sub>crit</sub>. This simplifies to roughly
      ${iq("m/M_\\star < 1/25")} for planetary masses. In the visualiser, unstable Trojans
      are shown as dimmed amber diamonds.</p>`,
    ),
  ].join("");
}

function buildPhotometry() {
  return [
    formula(
      "Stellar Absolute Magnitude",
      `<div class="sci-formula__eq">${eq("M_V = 4.81 - 2.5\\log_{10}(L)")}</div>
      <p>Sun&rsquo;s absolute visual magnitude is 4.81; the factor 2.5 comes from Pogson&rsquo;s magnitude scale definition.</p>`,
    ),

    formula(
      "Distance Modulus (Apparent Magnitude)",
      `<div class="sci-formula__eq">${eq("m = M_V + 5\\log_{10}\\!\\left(\\frac{d}{1\\text{ pc}}\\right) - 5")}</div>
      <p>Converts absolute magnitude to apparent magnitude at distance ${iq("d")}. 1 pc = 206,264.806 AU.</p>`,
    ),

    formula(
      "Body Absolute Magnitude (H)",
      `<div class="sci-formula__eq">${eq("H = 5\\log_{10}\\!\\left(\\frac{1329}{D_{\\text{km}} \\sqrt{p_V}}\\right)")}</div>
      <p>IAU standard H-magnitude for solar system bodies relating size and albedo to intrinsic brightness.</p>
      ${cite("Bowell et al. (1989) H-G photometry system")}
      <div class="sci-try">
        <div class="sci-try__title">Try it</div>
        <div class="sci-try__row">
          <label>Radius <span class="unit">km</span></label>
          <input id="sci-hmag-rad" type="number" value="6371" min="1" max="100000" step="1" />
        </div>
        <div class="sci-try__row">
          <label>Albedo</label>
          <input id="sci-hmag-alb" type="number" value="0.434" min="0.01" max="1" step="0.01" />
          <input id="sci-hmag-alb-slider" type="range" />
        </div>
        <div class="sci-try__output">
          <span class="sci-try__label">H magnitude</span>
          <span class="sci-try__value" id="sci-hmag-result">&mdash;</span>
        </div>
      </div>`,
    ),

    formula(
      "Bowell H-G Phase Function",
      `<div class="sci-formula__eq">${eq("\\Phi(\\alpha) = (1-G)\\,e^{-3.33\\tan^{0.63}(\\alpha/2)} + G\\,e^{-1.87\\tan^{1.22}(\\alpha/2)}")}</div>
      ${vars([
        ["\\alpha", "Phase angle (radians)"],
        ["G", "Slope parameter (0.28 rocky, 0.15 tiny)"],
      ])}
      ${cite("Bowell et al. (1989)")}`,
    ),

    formula(
      "Phase Angle (Law of Cosines)",
      `<div class="sci-formula__eq">${eq("\\cos\\alpha = \\frac{r^2 + \\Delta^2 - d_h^2}{2\\,r\\,\\Delta}")}</div>
      ${vars([
        ["r", "Body&rsquo;s orbital distance (AU)"],
        ["\\Delta", "Body-to-observer distance (AU)"],
        ["d_h", "Observer&rsquo;s orbital distance (AU)"],
      ])}`,
    ),

    formula(
      "Elongation",
      `<div class="sci-formula__eq">${eq("\\cos(\\text{elong}) = \\frac{d_h^2 + \\Delta^2 - r^2}{2\\,d_h\\,\\Delta}")}</div>
      <p>Sun-observer-body angle determining whether the body is visible above the horizon.</p>`,
    ),

    formula(
      "Bond to Geometric Albedo",
      `<div class="sci-formula__eq">${eq("p_V = \\frac{A_B}{q}")}</div>
      <p>Phase integral ${iq("q")} by body type: rocky airless 0.48, rocky atmosphere 0.90, gas giant 0.94, tiny 0.39.</p>`,
    ),

    formula(
      "Eclipse Classification",
      `<p>Compare angular radii of moon and star as seen from the planet surface:</p>
      <div class="sci-formula__eq">${eq("\\theta_{\\text{moon}} = \\frac{R_{\\text{moon}}}{a_{\\text{moon}}}, \\quad \\theta_\\star = \\frac{R_\\star}{d_{\\text{planet}}}")}</div>
      <p>If ${iq("\\theta_{\\text{moon}} \\ge \\theta_\\star")}: total eclipses. Otherwise: annular only.</p>`,
    ),
  ].join("");
}

function buildAtmosphereColour() {
  return [
    formula(
      "Scale Height Correction",
      `<div class="sci-formula__eq">${eq("\\frac{H_{\\text{planet}}}{H_\\oplus} = \\frac{T / T_\\oplus}{g / g_\\oplus}")}</div>
      <div class="sci-formula__eq">${eq("p_{\\text{eff}} = p \\times \\frac{H_{\\text{planet}}}{H_\\oplus}")}</div>
      <p>Atmospheric column depth depends on scale height ${iq("H = kT/mg")}. Lower gravity or higher temperature increases the effective optical depth for a given surface pressure.</p>
      ${cite("PanoptesV (panoptesv.com/SciFi)")}`,
    ),

    formula(
      "OKLab Colour Space",
      `<p>Perceptually uniform colour space used for all colour interpolation. sRGB &rarr; linear &rarr; LMS (cube roots) &rarr; OKLab:</p>
      <div class="sci-formula__eq">${eq("\\begin{pmatrix} l' \\\\ m' \\\\ s' \\end{pmatrix} = \\sqrt[3]{\\begin{pmatrix} 0.412 & 0.536 & 0.051 \\\\ 0.212 & 0.681 & 0.107 \\\\ 0.088 & 0.282 & 0.630 \\end{pmatrix} \\begin{pmatrix} R \\\\ G \\\\ B \\end{pmatrix}}")}</div>
      <div class="sci-formula__eq">${eq("\\begin{pmatrix} L \\\\ a \\\\ b \\end{pmatrix} = \\begin{pmatrix} 0.210 & 0.794 & -0.004 \\\\ 1.978 & -2.429 & 0.451 \\\\ 0.026 & 0.783 & -0.809 \\end{pmatrix} \\begin{pmatrix} l' \\\\ m' \\\\ s' \\end{pmatrix}")}</div>
      ${cite("Bjorn Ottosson (2020) &mdash; OKLab perceptually uniform colour space")}`,
    ),

    formula(
      "CO&#8322; Atmospheric Tint",
      `<div class="sci-formula__eq">${eq("\\text{strength} = \\text{clamp}\\!\\left(\\sqrt{f_{\\text{CO}_2}} \\times 0.7,\\; 0,\\; 1\\right)")}</div>
      <p>Square root gives a perceptually gradual tint increase. Blended via OKLab toward an amber/brown target.</p>`,
    ),

    formula(
      "Vegetation Colours (PanoptesV)",
      `<p>2D lookup table mapping <b>spectral class &times; surface pressure</b> to pale/deep vegetation hex colours. Anchors at 1, 3, and 10 atm from PanoptesV radiative-transfer simulations across 10 spectral types (A0&ndash;M8).</p>
      <p>Interpolation uses bilinear OKLab blending in log-pressure space. Extrapolation beyond 10 atm and below 1 atm continues the nearest empirical trend with 50% dampening.</p>
      ${cite("PanoptesV (panoptesv.com/SciFi) &mdash; Kiang (2007); Lehmer et al. (2021)")}`,
    ),

    formula(
      "Insolation Darkening",
      `<div class="sci-formula__eq">${eq("f = \\text{clamp}\\!\\left(0.5 + 0.15\\log_2 S,\\; 0,\\; 1\\right)")}</div>
      <p>Low-light environments favour broader-spectrum absorption (darker pigments). Log&#8322; scaling gives smooth correction across orders of magnitude of insolation ${iq("S")}.</p>`,
    ),

    formula(
      "Effective Pressure for Sky Colour",
      `<p>The scale-height-adjusted effective pressure is used to index a sky colour lookup table derived from PanoptesV atmospheric data. This accounts for the fact that a low-gravity world with 1 atm surface pressure has a thicker optical column than Earth at 1 atm.</p>`,
    ),

    formula(
      "Greenhouse Optical Depth from Gas Composition",
      `<p>Grey IR optical depth ${iq("\\tau")} computed from gas partial pressures with Lorentz pressure broadening. Used in <b>Core</b> and <b>Full</b> modes.</p>
      <div class="sci-formula__eq">${eq("\\text{pb} = P^{0.684}")}</div>
      <div class="sci-formula__eq">${eq("\\tau_{\\text{CO}_2} = 0.503 \\cdot \\ln\\!\\left(1 + \\frac{p_{\\text{CO}_2}}{p_{\\text{ref}}}\\right) \\cdot \\text{pb}")}</div>
      <div class="sci-formula__eq">${eq("\\tau_{\\text{H}_2\\text{O}} = 0.336 \\cdot \\ln\\!\\left(1 + \\frac{p_{\\text{H}_2\\text{O}}}{p_{\\text{ref}}}\\right) \\cdot \\text{pb} \\cdot \\omega")}</div>
      <div class="sci-formula__eq">${eq("\\tau_{\\text{CH}_4} = 0.45 \\cdot \\sqrt{\\frac{p_{\\text{CH}_4}}{p_{\\text{ref}}}} \\cdot \\text{pb}")}</div>
      <div class="sci-formula__eq">${eq("\\tau = \\tau_{\\text{CO}_2} + \\tau_{\\text{H}_2\\text{O}} + \\tau_{\\text{CH}_4}")}</div>
      ${vars([
        ["P", "Total surface pressure (atm)"],
        ["p_X", "Partial pressure of gas X = P &times; X% / 100 (atm)"],
        [
          "p_{\\text{ref}}",
          "Reference partial pressure = 0.001 atm (linear&ndash;logarithmic transition scale)",
        ],
        ["\\text{pb}", "Pressure-broadening factor (Robinson &amp; Catling 2012)"],
        ["\\omega", "CO&#8322;&ndash;H&#8322;O band overlap factor (see next formula)"],
      ])}
      <p><b>Functional forms.</b> CO&#8322; and H&#8322;O use logarithmic scaling (band saturation at high concentrations; Myhre 1998, Pierrehumbert 2010 ch. 4). CH&#8324; uses square-root scaling (weaker absorber; IPCC TAR Table 6.2). The ${iq("P^{0.684}")} exponent captures Lorentz pressure broadening of molecular absorption lines.</p>
      <p><b>Calibration.</b> The numerical coefficients (0.503, 0.336, 0.45) are <em>WorldSmith-derived fits</em> calibrated against NASA Planetary Fact Sheet surface temperatures, not taken from a single published source. They reproduce:</p>
      ${dataTable(
        [
          "Body",
          "P (atm)",
          "CO&#8322; %",
          "H&#8322;O %",
          "CH&#8324; %",
          "&tau;",
          "T<sub>surf</sub> (K)",
        ],
        [
          ["Earth", "1.0", "0.04", "0.40", "0", "0.70", "288"],
          ["Venus", "92", "96.5", "0", "0", "126", "737"],
          ["Mars", "0.006", "95.3", "0", "0", "0.029", "211"],
        ],
      )}
      <p>The greenhouse effect parameter used by the energy-balance model is ${iq("G_h = \\tau / 0.5841")}.</p>
      ${cite("Robinson &amp; Catling (2012) pressure broadening; Myhre (1998) CO&#8322; band saturation; IPCC TAR (2001) CH&#8324; square-root law. Coefficients: WorldSmith calibration.")}`,
    ),

    formula(
      "CO&#8322;&ndash;H&#8322;O Band Overlap Suppression",
      `<p>CO&#8322; and H&#8322;O share absorption in the 12&ndash;18 &mu;m and 4.3 &mu;m regions. When CO&#8322; is optically thick, those bands are already saturated and additional H&#8322;O contributes little extra opacity. This is modelled by an overlap factor applied to the H&#8322;O optical depth:</p>
      <div class="sci-formula__eq">${eq("\\omega = \\frac{1}{1 + \\tau_{\\text{CO}_2} / k}")}</div>
      ${vars([
        ["\\omega", "Overlap suppression factor (0 to 1)"],
        ["\\tau_{\\text{CO}_2}", "CO&#8322; optical depth (computed above)"],
        ["k", "Half-saturation constant = 6"],
      ])}
      <p>At Earth conditions (${iq("\\tau_{\\text{CO}_2} \\approx 0.18")}), ${iq("\\omega \\approx 0.97")} &mdash; almost no suppression. At Venus conditions (${iq("\\tau_{\\text{CO}_2} \\approx 126")}), ${iq("\\omega \\approx 0.045")} &mdash; H&#8322;O contribution reduced by 95%.</p>
      <p><b>This is a WorldSmith-derived model.</b> The half-saturation form ${iq("1/(1 + x/k)")} and the value ${iq("k = 6")} were chosen to reproduce Venus&rsquo;s 737 K surface temperature when trace H&#8322;O (30 ppm) is included. The H&#8322;O coefficient was then re-fitted from 0.327 to 0.336 to recover Earth&rsquo;s 288 K. The physics justification is spectral band overlap, but the specific parameterisation is an empirical fit, not from a published radiative-transfer study.</p>`,
    ),

    formula(
      "Expert Gas Terms (Full Mode)",
      `<p>In <b>Full</b> mode, three additional absorbers are added to the core optical depth. SO&#8322; and NH&#8323; receive a core-opacity overlap factor: at high ${iq("\\tau_{\\text{core}}")}, pressure-broadened CO&#8322; wings fill the atmospheric window, reducing their marginal contribution.</p>
      <div class="sci-formula__eq">${eq("\\tau_{\\text{H}_2} = 3.0 \\cdot f_{\\text{H}_2} \\cdot f_{\\text{N}_2} \\cdot P^2")}</div>
      <div class="sci-formula__eq">${eq("\\tau_{\\text{SO}_2} = \\frac{0.15 \\cdot \\ln\\!\\left(1 + \\frac{p_{\\text{SO}_2}}{p_{\\text{ref}}}\\right) \\cdot \\text{pb}}{1 + \\tau_{\\text{core}} / 8}")}</div>
      <div class="sci-formula__eq">${eq("\\tau_{\\text{NH}_3} = \\frac{1.5 \\cdot \\sqrt{\\frac{p_{\\text{NH}_3}}{p_{\\text{ref}}}} \\cdot \\text{pb}}{1 + \\tau_{\\text{core}} / 20}")}</div>
      <div class="sci-formula__eq">${eq("\\tau_{\\text{total}} = \\tau_{\\text{core}} + \\tau_{\\text{H}_2} + \\tau_{\\text{SO}_2} + \\tau_{\\text{NH}_3}")}</div>
      ${vars([
        [
          "f_{\\text{H}_2},\\; f_{\\text{N}_2}",
          "Volume fractions (0&ndash;1) of H&#8322; and N&#8322;",
        ],
        ["P", "Total surface pressure (atm)"],
        ["\\text{pb}", "Pressure-broadening factor = P<sup>0.684</sup>"],
        [
          "\\tau_{\\text{core}}",
          "&tau;<sub>CO&#8322;</sub> + &tau;<sub>H&#8322;O</sub> + &tau;<sub>CH&#8324;</sub> (computed from core gases)",
        ],
      ])}
      <p><b>H&#8322;&ndash;N&#8322; collision-induced absorption (CIA).</b> H&#8322; is homonuclear and lacks a permanent dipole, but collisions with N&#8322; induce a transient dipole that absorbs in the thermal IR. The opacity scales with the product of both number densities and ${iq("P^2")} (collision rate). At 10% H&#8322;, 90% N&#8322;, 1 bar this gives ${iq("\\tau \\approx 0.27")} (&sim;12 K warming). H&#8322;&ndash;N&#8322; CIA is a broadband mechanism (not a line absorber) and does not receive overlap suppression.</p>
      <p><b>SO&#8322;</b> has strong absorption bands at 7.3 and 8.7 &mu;m. Logarithmic scaling (like CO&#8322;) but with a weaker coefficient reflecting its narrower band coverage. The overlap denominator (${iq("k = 8")}) suppresses SO&#8322; when the core gases are already optically thick &mdash; at Venus conditions (${iq("\\tau_{\\text{core}} \\approx 127")}), SO&#8322; retains only &sim;6% of its raw contribution.</p>
      <p><b>NH&#8323;</b> is a potent absorber at 10.5 &mu;m (within the atmospheric window). Square-root scaling (like CH&#8324;) captures its sub-linear saturation behaviour. The larger overlap constant (${iq("k = 20")}) reflects the fact that the 10.5 &mu;m window is less affected by CO&#8322; pressure broadening than the SO&#8322; bands.</p>
      <p><b>He</b> has no IR absorption and contributes ${iq("\\tau = 0")}. It only affects the mean molecular weight (0.004 kg/mol), atmospheric density, and scale height.</p>
      <p><b>Overlap constants are WorldSmith-derived.</b> The values ${iq("k_{\\text{SO}_2} = 8")} and ${iq("k_{\\text{NH}_3} = 20")} were calibrated so that Venus in Full mode (with NASA trace gases) matches the 737 K surface temperature. The physics basis is that pressure-broadened CO&#8322; wings extend beyond 15 &mu;m into the atmospheric window at high pressures, but the specific ${iq("k")} values are empirical fits.</p>
      ${cite("H&#8322;&ndash;N&#8322; CIA: Wordsworth &amp; Pierrehumbert (2013), Science 339. SO&#8322; and NH&#8323; coefficients and overlap constants: WorldSmith calibration.")}`,
    ),

    formula(
      "Jeans Escape Parameter",
      `<p>For each gas species with molar mass ${iq("M")} (kg/mol), the Jeans escape parameter ${iq("\\lambda")} determines whether the gas can be retained against thermal escape over geological time:</p>
      <div class="sci-formula__eq">${eq("\\lambda = \\frac{v_{\\text{esc}}^2 \\cdot M}{2\\,R\\,T_{\\text{exo}}}")}</div>
      ${vars([
        ["v_{\\text{esc}}", "Surface escape velocity (m/s)"],
        ["M", "Molar mass of gas species (kg/mol)"],
        ["R", "Universal gas constant = 8.3145 J/(mol&middot;K)"],
        ["T_{\\text{exo}}", "Exobase temperature (K)"],
      ])}
      ${dataTable(
        ["\\u03BB range", "Status", "Meaning"],
        [
          ["\\u2265 6", "Retained", "Firmly held over geological time (> 4.5 Gyr)"],
          ["3 &ndash; 6", "Marginal", "Slow escape; may be lost on Gyr timescales"],
          ["< 3", "Lost", "Rapid thermal escape (lost within ~100 Myr)"],
        ],
      )}
      <p>These are the base thresholds for standard Jeans thermal escape. H&#8322; and He use enhanced thresholds that account for non-thermal loss (see Non-Thermal Escape Enhancement below).</p>
      <p>When the Atmospheric Escape toggle is enabled, gases classified as &ldquo;Lost&rdquo; are zeroed before computing greenhouse effect, partial pressures, and density.</p>
      ${cite("Jeans (1925), The Dynamical Theory of Gases. Hunten (1973), J. Atmos. Sci. 30. Catling &amp; Zahnle (2009), Sci. Am. 300.")}`,
    ),

    formula(
      "Exobase Temperature",
      `<p>The exobase temperature is estimated from the equilibrium temperature (without greenhouse) plus XUV-driven thermospheric heating, countered by CO&#8322; radiative cooling and a pressure-dependent absorption term:</p>
      <div class="sci-formula__eq">${eq("T_{\\text{exo}} = \\min\\!\\left(T_{\\text{eq}} \\cdot \\left(1 + \\frac{3.0\\;\\eta_{\\text{abs}}\\,\\sqrt{F_{\\text{XUV}} / F_0}}{1 + 100\\,P\\,f_{\\text{CO}_2}}\\right),\\; 5000\\right)")}</div>
      <div class="sci-formula__eq">${eq("\\eta_{\\text{abs}} = \\frac{P}{P + P_{1/2}}")}</div>
      ${vars([
        ["T_{\\text{eq}}", "Equilibrium temperature without greenhouse (K)"],
        ["\\eta_{\\text{abs}}", "XUV absorption efficiency (Beer-Lambert saturation)"],
        ["P_{1/2}", "Half-absorption pressure = 0.06 atm"],
        ["F_{\\text{XUV}}", "XUV flux at the planet's orbit (erg cm&#8315;&#178; s&#8315;&#185;)"],
        ["F_0", "Present-day solar XUV at 1 AU = 4.64 erg cm&#8315;&#178; s&#8315;&#185;"],
        ["P", "Surface pressure (atm)"],
        ["f_{\\text{CO}_2}", "CO&#8322; volume fraction (0&ndash;1)"],
      ])}
      <p>Thin atmospheres (P &lt;&lt; 0.06 atm) lack sufficient column density to absorb the full XUV flux, so &eta;<sub>abs</sub> &rarr; 0 and the exobase stays near T<sub>eq</sub>. The 5000 K cap represents hydrodynamic blowoff.</p>
      <p><b>Calibration:</b></p>
      ${dataTable(
        [
          "Body",
          "T<sub>eq</sub> (K)",
          "F/F<sub>0</sub>",
          "P (atm)",
          "&eta;<sub>abs</sub>",
          "T<sub>exo</sub> (K)",
          "Observed",
        ],
        [
          ["Earth", "254", "1.0", "1.0", "0.94", "~944", "700&ndash;1400"],
          ["Venus", "229", "1.9", "92", "1.00", "~229", "250&ndash;300"],
          ["Mars", "210", "0.43", "0.006", "0.09", "~233", "200&ndash;350"],
          ["Pluto", "32", "0.0006", "10&#8315;&#8309;", "&lt;0.001", "~32", "~65&ndash;70"],
        ],
      )}
      <p><b>WorldSmith-derived model.</b> The coefficient 3.0 is calibrated to reproduce Earth's ~1000 K exobase temperature. The CO&#8322; cooling term captures the efficient 15 &mu;m radiative cooling that suppresses thermospheric heating on Venus. The &eta;<sub>abs</sub> term corrects for thin atmospheres (Mars, Pluto) that let most XUV pass through unabsorbed.</p>`,
    ),

    formula(
      "XUV Flux (Ribas et al. 2005)",
      `<div class="sci-formula__eq">${eq("F_{\\text{XUV}} = F_0 \\cdot L_\\star \\cdot \\left(\\frac{t}{4.6\\,\\text{Gyr}}\\right)^{-1.23} \\cdot \\frac{1}{d^2}")}</div>
      ${vars([
        ["F_0", "Present-day solar XUV at 1 AU = 4.64 erg cm&#8315;&#178; s&#8315;&#185;"],
        ["L_\\star", "Stellar luminosity (L&#9737;)"],
        ["t", "Stellar age (Gyr)"],
        ["d", "Orbital distance (AU)"],
      ])}
      <p>Young stars have stronger XUV emission, decaying as a power law with exponent &minus;1.23. This is the same formula used for gas giant atmospheric mass loss.</p>
      ${cite("Ribas et al. (2005), ApJ 622, 680 &mdash; Evolution of the Solar Activity over Time.")}`,
    ),

    formula(
      "Non-Thermal Escape Enhancement",
      `<p>Pure Jeans (thermal) escape underestimates loss of light gases from warm terrestrial planets. Charge exchange with stellar-wind protons, polar wind escape through magnetic cusps, and ion pickup by the stellar wind all strip H&#8322; and He regardless of whether the body has a magnetic field.</p>
      <p>Research shows magnetised and unmagnetised planets lose atmosphere at similar rates. These non-thermal channels effectively raise the retention threshold for the two lightest species:</p>
      ${dataTable(
        ["Gas", "Factor", "Lost", "Marginal", "Retained"],
        [
          ["H&#8322;", "&times;3.0", "&lambda; < 9", "9 &le; &lambda; < 18", "&lambda; &ge; 18"],
          ["He", "&times;5.0", "&lambda; < 15", "15 &le; &lambda; < 30", "&lambda; &ge; 30"],
          ["Others", "&times;1.0", "&lambda; < 3", "3 &le; &lambda; < 6", "&lambda; &ge; 6"],
        ],
      )}
      <p>The enhancement only applies when T<sub>exo</sub> &gt; 100 K. Beyond ~10 AU, stellar wind flux is negligible and standard Jeans thermal escape dominates.</p>
      <p><b>Calibration:</b> Earth H&#8322; (&lambda; &asymp; 16) is correctly classified as Marginal &mdash; present in trace amounts but slowly escaping via polar wind. Mars H&#8322; and He are Marginal. Mercury and Ceres lose all light gases.</p>
      ${cite("Gunell et al. (2018), A&amp;A 614, L3 &mdash; Why an intrinsic magnetic field does not protect a planet against atmospheric escape. Gronoff et al. (2020), JGR Space Physics 125 &mdash; Atmospheric Escape Processes and Planetary Atmospheric Evolution.")}`,
    ),
  ].join("");
}

function buildClimateClassification() {
  return [
    formula(
      "Temperature at Latitude",
      `<div class="sci-formula__eq">${eq("T(\\phi) = T_{\\text{eq}} - G\\,\\sin^2\\phi")}</div>
      <div class="sci-formula__eq">${eq("T_{\\text{eq}} = T_{\\text{global}} + G/3")}</div>
      ${vars([
        ["\\phi", "Latitude (radians)"],
        ["T_{\\text{eq}}", "Equatorial mean temperature"],
        ["G", "Equator-to-pole temperature gradient (K)"],
      ])}`,
    ),

    formula(
      "Equator&ndash;Pole Gradient",
      `<div class="sci-formula__eq">${eq("G = \\frac{60}{1 + 0.8\\,P/\\sqrt{g}}")}</div>
      <p>Higher surface pressure and lower gravity increase atmospheric heat redistribution,
      reducing the gradient. ${iq("P")} in atm, ${iq("g")} in m/s&sup2;. Clamped to [1, 80] K.</p>`,
    ),

    formula(
      "Seasonal Amplitude",
      `<div class="sci-formula__eq">${eq("A = \\frac{15\\,\\sin\\phi \\cdot (\\varepsilon / 23.44°)}{1 + 0.3\\,P/\\sqrt{g}}\\;°\\text{C}")}</div>
      <p>Peak-to-mean seasonal temperature swing at each latitude. Scales linearly with axial tilt
      ${iq("\\varepsilon")} relative to Earth&rsquo;s 23.44&deg;; damped by atmospheric mass.</p>`,
    ),

    formula(
      "Moisture Index",
      `<p>Zonal model based on atmospheric circulation cells:</p>
      ${dataTable(
        ["Zone", "Base moisture"],
        [
          ["Hadley equatorial (lat &lt; 0.7&times;cell)", "0.9 &minus; 0.75&times;fraction"],
          ["Hadley subsidence edge", "0.15"],
          ["Ferrel warm-coast", "0.70"],
          ["Ferrel cold-coast", "0.45"],
          ["Ferrel general", "0.55"],
          ["Polar", "0.20"],
        ],
      )}
      <p>Scaled by water regime (0.1 for dry, 1.0 for ocean worlds) and surface H&#8322;O fraction.</p>`,
    ),

    formula(
      "K&ouml;ppen Decision Tree",
      `<p>Classification from warmest-month (${iq("T_w")}), coldest-month (${iq("T_c")}), and moisture index (${iq("m")}):</p>
      ${dataTable(
        ["Class", "Condition"],
        [
          ["EF (ice cap)", "T<sub>w</sub> &lt; 0 &deg;C"],
          ["ET (tundra)", "0 &le; T<sub>w</sub> &lt; 10 &deg;C"],
          ["BW (desert)", "m &lt; 0.25"],
          ["BS (steppe)", "0.25 &le; m &lt; 0.45"],
          ["Af (tropical wet)", "T<sub>c</sub> &ge; 18 &deg;C, m &ge; 0.75"],
          ["Am (monsoon)", "T<sub>c</sub> &ge; 18 &deg;C, 0.55 &le; m &lt; 0.75"],
          ["Aw (savanna)", "T<sub>c</sub> &ge; 18 &deg;C, m &lt; 0.55"],
          ["D (continental)", "T<sub>c</sub> &lt; &minus;3 &deg;C, T<sub>w</sub> &ge; 10"],
          ["C (temperate)", "Remainder with T<sub>w</sub> &ge; 10 &deg;C"],
        ],
      )}
      <p>Temperature subtypes: a (T<sub>w</sub> &ge; 22), b (&ge; 15), c (default), d (T<sub>c</sub> &lt; &minus;38).</p>
      ${cite("Köppen (1884); Peel, Finlayson &amp; McMahon (2007)")}`,
    ),

    formula(
      "Tidally Locked Zones",
      `<p>For synchronously rotating planets, three climate zones replace latitude bands:</p>
      <div class="sci-formula__eq">${eq("T_{\\text{sub}} = T_g\\,(1 + 0.3 / (1 + 0.5P))")}</div>
      <div class="sci-formula__eq">${eq("T_{\\text{term}} = T_g\\,(0.85 + 0.15\\,\\min(P/2,\\,1))")}</div>
      <div class="sci-formula__eq">${eq("T_{\\text{anti}} = T_g\\,(0.5 + 0.3\\,\\min(P/2,\\,1))")}</div>
      <p>Higher surface pressure (${iq("P")} in atm) increases heat redistribution, warming the terminator
      and antistellar point while cooling the substellar point.</p>`,
    ),

    formula(
      "Environmental Lapse Rate",
      `<div class="sci-formula__eq">${eq("\\frac{dT}{dz} = -6.5\\;°\\text{C/km}")}</div>
      <p>ISA standard tropospheric lapse rate, applied to altitude-adjusted temperatures for
      elevated terrain. Used for all climate zone calculations.</p>`,
    ),
  ].join("");
}

function buildStellarActivity() {
  return [
    formula(
      "Power-Law Flare Rate",
      `<div class="sci-formula__eq">${eq("N(> E) = N_{32} \\left(\\frac{E}{10^{32} \\text{ erg}}\\right)^{-\\alpha}")}</div>
      <p>Cumulative flare frequency distribution: expected flares per day with energy above ${iq("E")}.</p>
      ${dataTable(
        ["Spectral bin", "T<sub>eff</sub> (K)", "Old", "Mid", "Young", "&alpha;"],
        [
          ["FGK", "&ge; 3900", "0.05", "0.25", "1.0", "1.8"],
          ["Early M", "3200&ndash;3900", "0.5", "2.0", "8.0", "2.0"],
          ["Late M", "&lt; 3200", "2.0", "8.0", "30.0", "2.2"],
        ],
      )}
      ${cite("Gunther et al. (2020) TESS superflare rates; Lacy et al. (1976) power-law")}
      <div class="sci-try">
        <div class="sci-try__title">Try it</div>
        <div class="sci-try__row">
          <label>T<sub>eff</sub> <span class="unit">K</span></label>
          <input id="sci-flare-temp" type="number" value="5776" min="2000" max="10000" step="100" />
          <input id="sci-flare-temp-slider" type="range" />
        </div>
        <div class="sci-try__row">
          <label>Age <span class="unit">Gyr</span></label>
          <input id="sci-flare-age" type="number" value="4.6" min="0.01" max="13" step="0.1" />
          <input id="sci-flare-age-slider" type="range" />
        </div>
        <div class="sci-try__output">
          <span class="sci-try__label">N<sub>32</sub> / &alpha;</span>
          <span class="sci-try__value" id="sci-flare-result">&mdash;</span>
        </div>
      </div>`,
    ),

    formula(
      "Inverse-CDF Energy Sampling",
      `<div class="sci-formula__eq">${eq("E = \\left[E_{\\min}^{-\\alpha} - u\\left(E_{\\min}^{-\\alpha} - E_{\\max}^{-\\alpha}\\right)\\right]^{-1/\\alpha}")}</div>
      <p>Inverse transform sampling of a truncated power-law distribution. ${iq("u \\in (0,1)")} uniform random. Efficiently draws random flare energies without rejection.</p>`,
    ),

    formula(
      "Poisson Waiting Time",
      `<div class="sci-formula__eq">${eq("\\Delta t = -\\frac{\\ln(1-u)}{\\lambda}")}</div>
      <p>Time until next flare event drawn from an exponential distribution. Models flares as a Poisson process with mean rate ${iq("\\lambda")} per second.</p>`,
    ),

    formula(
      "CME Association Probability",
      `<p>Energy-dependent step function based on solar flare&ndash;CME associations:</p>
      ${dataTable(
        ["Flare energy (erg)", "P(CME)"],
        [
          ["&lt; 10&sup3;&sup2;", "0.005"],
          ["10&sup3;&sup2; &ndash; 10&sup3;&sup3;", "0.12"],
          ["10&sup3;&sup3; &ndash; 10&sup3;&sup4;", "0.4"],
          ["&gt; 10&sup3;&sup4;", "0.75"],
        ],
      )}
      <p>Base probability is modulated by a soft-suppression factor at high N&#8323;&#8322; and a saturation limiter
      that prevents CME rate from exceeding the activity-cycle target.</p>
      ${cite("Yashiro et al. (2006) flare-CME association rates; probabilities WorldSmith-calibrated")}`,
    ),

    formula(
      "CME Rate from Activity Cycle",
      `<div class="sci-formula__eq">${eq("\\text{rate} = 0.5 + 5.5t \\text{ CME/day}")}</div>
      <p>Linear interpolation from solar minimum (0.5/day) to maximum (6.0/day), ${iq("t \\in [0,1]")}.</p>`,
    ),

    formula(
      "Flare Rate Reference Table (N&#8323;&#8322;)",
      `<p>Flares per day above ${iq("10^{32}")} erg, binned by spectral class and stellar age:</p>
      ${dataTable(
        ["Spectral bin", "Old", "Mid", "Young", "&alpha;"],
        [
          ["FGK (T &ge; 3900 K)", "0.05", "0.25", "1.0", "1.8"],
          ["Early M (3200&ndash;3900 K)", "0.5", "2.0", "8.0", "2.0"],
          ["Late M (&lt; 3200 K)", "2.0", "8.0", "30.0", "2.2"],
        ],
      )}
      <p>Age band boundaries differ by spectral type: FGK old &ge; 2 Gyr, early-M old &ge; 4 Gyr,
      late-M old &ge; 6 Gyr. The power-law index ${iq("\\alpha")} steepens for cooler stars,
      meaning their energy distribution is more bottom-heavy.</p>
      ${cite("Günther et al. (2020) TESS superflare rates; binning WorldSmith")}`,
    ),

    formula(
      "Flare Cycle Multiplier",
      `<p>Flare rate is modulated by an 11-year-analogue activity cycle. At cycle phase ${iq("\\phi \\in [0,1]")}:</p>
      ${dataTable(
        ["Spectral bin", "Min (&phi;=0)", "Mid (&phi;=0.5)", "Max (&phi;=1)"],
        [
          ["FGK", "0.35", "1.0", "1.65"],
          ["Early M", "0.6", "1.0", "1.4"],
          ["Late M", "0.75", "1.0", "1.25"],
        ],
      )}
      <p>Cooler stars have a smaller cycle amplitude, consistent with
      observations that M-dwarf activity varies less over magnetic cycles.</p>`,
    ),
  ].join("");
}

function buildCalendarSystems() {
  return [
    formula(
      "Local Day Scale",
      `<div class="sci-formula__eq">${eq("\\text{scale} = \\frac{P_{\\text{rot}}}{24}")}</div>
      <div class="sci-formula__eq">${eq("\\text{local year} = \\frac{P_{\\text{orb}}}{\\text{scale}} \\text{ local days}")}</div>
      <p>Converts Earth-day orbital periods into the number of planetary rotations per year.</p>`,
    ),

    formula(
      "Continued-Fraction Leap Cycles",
      `<p>A year is rarely an exact number of days. The fractional leftover must be corrected with <b>leap days</b>, or the calendar drifts out of sync with the seasons. The continued-fraction algorithm finds the best correction cycles &mdash; each one trading simplicity for accuracy.</p>
      <div class="sci-formula__eq">${eq("f = \\cfrac{1}{a_1 + \\cfrac{1}{a_2 + \\cfrac{1}{a_3 + \\cdots}}}")}</div>
      <p>Each convergent ${iq("p/q")} means: <b>add ${iq("p")} leap days every ${iq("q")} years</b>. Earlier entries are simpler but less accurate; later entries are more precise but harder to remember.</p>
      <p><b>Earth example</b> (365.2422 days, fractional part 0.2422):</p>
      <ul style="font-size:13px;color:var(--muted);margin:4px 0 8px 18px;line-height:1.6">
        <li><b>1/4</b> &mdash; 1 leap day every 4 years (Julian calendar). Simple, but drifts ~1 day per 128 years.</li>
        <li><b>8/33</b> &mdash; 8 leap days every 33 years (Iranian/Persian calendar). Much more accurate: drifts ~1 day per 4,000 years.</li>
        <li><b>97/400</b> &mdash; 97 leap days every 400 years (Gregorian calendar). The &ldquo;divisible by 4, except centuries, except 400s&rdquo; rule. Drifts ~1 day per 8,000 years.</li>
      </ul>
      <p>For alien worlds, the fractional part may be very different from Earth&rsquo;s, so the algorithm generates whichever cycles best fit that world&rsquo;s year length. A worldbuilder typically picks the simplest cycle whose drift is acceptable.</p>
      <div class="sci-try">
        <div class="sci-try__title">Try it</div>
        <div class="sci-try__row">
          <label>Year length <span class="unit">local days</span></label>
          <input id="sci-leap-len" type="number" value="365.2422" min="1" max="9999" step="0.0001" />
        </div>
        <div class="sci-try__output" id="sci-leap-output">
          <span class="sci-try__label">Leap cycles</span>
          <span class="sci-try__value" id="sci-leap-result">&mdash;</span>
        </div>
      </div>`,
    ),

    formula(
      "Leap Rule Application",
      `<div class="sci-formula__eq">${eq("\\text{active} = (y - \\text{offset}) \\bmod \\text{cycle} = 0")}</div>
      <p>A leap rule fires when the year minus its starting offset is divisible by the cycle length.</p>`,
    ),

    formula(
      "Moon Phase Illumination",
      `<div class="sci-formula__eq">${eq("I = \\frac{1}{2}\\left(1 - \\cos\\!\\left(\\frac{2\\pi \\cdot \\text{age}}{P_{\\text{syn}}}\\right)\\right)")}</div>
      <p>Fraction of the moon&rsquo;s visible disk illuminated. 0 at new moon, 1 at full moon. Divided into 8 named phases at 1/16-period boundaries.</p>`,
    ),

    formula(
      "Year Start Weekday",
      `<div class="sci-formula__eq">${eq("w_y = \\left(w_1 + \\sum_{i=1}^{y-1} L_i\\right) \\bmod D_w")}</div>
      <p>Day-of-week index for year ${iq("y")}, where ${iq("L_i")} is the length of year ${iq("i")} and ${iq("D_w")} is days per week. Computed in O(rules) time by counting leap rule firings.</p>`,
    ),
  ].join("");
}

function buildLocalCluster() {
  return [
    formula(
      "Neighbourhood Volume",
      `<div class="sci-formula__eq">${eq("V = \\frac{4}{3}\\pi R^3")}</div>
      <p>Spherical volume of radius ${iq("R")} in light-years. Total stellar objects: ${iq("N = \\rho \\cdot V")} where ${iq("\\rho")} defaults to 0.004 ly&supmin;&sup3; (HIPPARCOS solar neighbourhood).</p>`,
    ),

    formula(
      "Population Fractions",
      `<p>Stellar object composition based on the 10 pc solar-neighbourhood census:</p>
      ${dataTable(
        ["Category", "Fraction"],
        [
          ["Main-sequence stars", "72%"],
          ["White dwarfs", "6%"],
          ["Brown dwarfs", "19%"],
          ["Other (giants, subdwarfs)", "3%"],
        ],
      )}
      ${cite("Reyle et al. (2021) solar-neighbourhood census; RECONS 10 pc survey")}`,
    ),

    formula(
      "Galactic Habitable Zone (GHZ)",
      `<div class="sci-formula__eq">${eq("P = \\exp\\!\\left(-\\frac{1}{2}\\left(\\frac{r - 0.53R}{0.1R}\\right)^2\\right)")}</div>
      ${vars([
        ["r", "Distance from galactic centre (ly)"],
        ["R", "Galaxy radius (ly)"],
      ])}
      <p>Gaussian peaked at 53% of galactic radius, &sigma; = 10%. Hard band: 47%&ndash;60% of R.</p>
      ${cite("Lineweaver et al. (2004) Galactic Habitable Zone")}
      <div class="sci-try">
        <div class="sci-try__title">Try it</div>
        <div class="sci-try__row">
          <label>Galaxy radius <span class="unit">ly</span></label>
          <input id="sci-ghz-r" type="number" value="52850" min="1000" max="200000" step="100" />
        </div>
        <div class="sci-try__row">
          <label>Location <span class="unit">ly from centre</span></label>
          <input id="sci-ghz-loc" type="number" value="27000" min="0" max="200000" step="100" />
        </div>
        <div class="sci-try__output">
          <span class="sci-try__label">GHZ probability</span>
          <span class="sci-try__value" id="sci-ghz-result">&mdash;</span>
        </div>
      </div>`,
    ),

    formula(
      "Metallicity Gradient",
      `<div class="sci-formula__eq">${eq("[\\text{Fe/H}] = [\\text{Fe/H}]_\\odot + \\Delta R \\cdot g_R + |z| \\cdot g_z + \\delta_{\\text{class}} + \\mathcal{N}(0,\\,\\sigma)")}</div>
      ${vars([
        ["g_R", "Radial gradient: &minus;0.06 dex/kpc (Luck &amp; Lambert 2011)"],
        ["g_z", "Vertical gradient: &minus;0.30 dex/kpc (Schlesinger et al. 2014)"],
        ["\\delta_{\\text{class}}", "Spectral-class shift (e.g. white dwarfs &minus;0.15 dex)"],
        ["\\sigma", "Scatter &sigma; = 0.20 dex"],
      ])}
      <p>Clamped to [&minus;3.0,&thinsp;+0.5]. ${iq("\\Delta R")} is the radial offset from the solar galactocentric distance.</p>
      ${cite("Luck &amp; Lambert (2011); Schlesinger et al. (2014)")}`,
    ),

    formula(
      "Multiplicity (Stars per System)",
      `<div class="sci-formula__eq">${eq("\\bar{n} = 1 + f_b + 2f_t + 3f_q")}</div>
      <p>Average stars per system from binary (${iq("f_b")}), triple (${iq("f_t")}), and quadruple (${iq("f_q")}) fractions, weighted by spectral class.</p>
      ${dataTable(
        ["Class", "Binary", "Triple", "Quadruple"],
        [
          ["O", "0.70", "0.12", "0.05"],
          ["B", "0.50", "0.09", "0.04"],
          ["A", "0.45", "0.08", "0.03"],
          ["F", "0.46", "0.08", "0.03"],
          ["G", "0.46", "0.08", "0.03"],
          ["K", "0.35", "0.05", "0.02"],
          ["M", "0.27", "0.03", "0.01"],
          ["WD", "0.25", "0.02", "0.005"],
          ["L/T/Y", "0.15", "0.01", "0.003"],
        ],
      )}
      ${cite("Duch&ecirc;ne &amp; Kraus (2013) multiplicity survey")}`,
    ),

    formula(
      "Park-Miller PRNG",
      `<div class="sci-formula__eq">${eq("s_{n+1} = 48271 \\cdot s_n \\mod (2^{31} - 1)")}</div>
      <p>Minimal standard linear congruential generator. Modulus 2&sup3;&sup1;&minus;1 (Mersenne prime). Output: ${iq("u = s / (2^{31}-1) \\in (0,1)")}.</p>`,
    ),

    formula(
      "Disk Z-Scale",
      `<div class="sci-formula__eq">${eq("z = \\max\\!\\left(0.15,\\; 1 - \\frac{R - 50}{1000}\\right) \\quad (R > 50 \\text{ ly})")}</div>
      <p>Galactic disk flattening for large neighbourhood radii. At 50 ly the neighbourhood is spherical; at 500 ly z &asymp; 0.55; floors at 0.15.</p>`,
    ),
  ].join("");
}

function buildPopulationDynamics() {
  return [
    formula(
      "Ocean Fraction by Water Regime",
      `${dataTable(
        ["Water regime", "Ocean fraction"],
        [
          ["Dry", "0%"],
          ["Shallow oceans", "50%"],
          ["Extensive oceans", "71%"],
          ["Global ocean", "90%"],
          ["Deep ocean", "95%"],
          ["Ice world", "0%"],
        ],
      )}
      <p>Determines the land area available for settlement: ${iq("A_{\\text{land}} = 4\\pi R^2 \\cdot (1 - f_{\\text{ocean}})")}.</p>`,
    ),

    formula(
      "Habitability Fraction",
      `<p>Fraction of land area that is habitable, computed by latitude-weighted spherical area:</p>
      <div class="sci-formula__eq">${eq("f_{\\text{hab}} = \\frac{\\sum_{\\text{habitable}} |\\sin\\phi_2 - \\sin\\phi_1|}{\\sum_{\\text{all}} |\\sin\\phi_2 - \\sin\\phi_1|}")}</div>
      <p>K&ouml;ppen classes E (polar) and X (uninhabitable) are excluded.</p>`,
    ),

    formula(
      "Carrying Capacity",
      `<div class="sci-formula__eq">${eq("K = A \\cdot d \\cdot \\frac{1 + (C_e - 1)\\,f_c}{1 + (C_e - 1) \\cdot 0.77}")}</div>
      ${vars([
        ["A", "Habitable land area (km&sup2;)"],
        ["d", "Tech-era population density (people/km&sup2;)"],
        ["C_e", "Crop efficiency = 4&times; (crops feed more than livestock)"],
        ["f_c", "Crop fraction; 0.77 = Earth reference"],
      ])}
      ${dataTable(
        ["Era", "Density (km&sup2;)", "Growth (%/yr)"],
        [
          ["Hunter-Gatherer", "0.05", "0.5"],
          ["Neolithic", "2", "0.8"],
          ["Bronze Age", "8", "1.0"],
          ["Iron Age", "15", "1.0"],
          ["Medieval", "30", "1.0"],
          ["Early Industrial", "80", "1.5"],
          ["Industrial", "200", "2.0"],
          ["Post-Industrial", "400", "0.5"],
          ["Sci-Fi High", "1000", "0.3"],
        ],
      )}`,
    ),

    formula(
      "Logistic Growth (Verhulst)",
      `<div class="sci-formula__eq">${eq("P(t) = \\frac{K}{1 + \\frac{K - P_0}{P_0}\\,e^{-rt}}")}</div>
      ${vars([
        ["K", "Carrying capacity"],
        ["P_0", "Initial population"],
        ["r", "Growth rate (per year)"],
        ["t", "Time (years)"],
      ])}
      <p>Doubling time: ${iq("t_d = \\ln 2 / r")}. Saturation: ${iq("P/K \\times 100\\%")}.</p>
      ${cite("Verhulst (1838), Correspondance math&eacute;matique et physique")}`,
    ),

    formula(
      "Zipf Rank&ndash;Size Distribution",
      `<div class="sci-formula__eq">${eq("P(\\text{rank}) = \\frac{P(1)}{\\text{rank}^q}, \\quad P(1) = \\frac{P_{\\text{total}}}{H(n,q)}")}</div>
      <p>${iq("H(n,q) = \\sum_{i=1}^{n} 1/i^q")} is the generalised harmonic number. The exponent
      ${iq("q")} controls inequality: ${iq("q=1")} gives classic Zipf&rsquo;s law.</p>
      ${cite("Zipf (1949), Human Behavior and the Principle of Least Effort")}`,
    ),
  ].join("");
}

function buildInteriorComposition() {
  return [
    formula(
      "Water-Aware Radius (Zeng & Sasselov 2016)",
      `<div class="sci-formula__eq">${eq("R = R_{\\text{dry}} \\cdot \\left(1 + \\left(\\frac{R_{50}}{R_{\\text{ref}}} - 1\\right) \\cdot \\min\\!\\left(\\frac{\\text{WMF}}{0.5},\\;1\\right)\\right)")}</div>
      <p>Interpolates between a dry (Earth-like) mass-radius curve and the 50%-water curve from Zeng &amp; Sasselov (2016, ApJ 819, 127). When WMF = 0 the result equals ${iq("R_{\\text{dry}}")} exactly.</p>
      ${vars([
        ["R_{\\text{dry}}", "Radius from the CMF-based density formula (unchanged)"],
        ["R_{50} = 1.38\\,M^{0.263}", "Zeng 50%-water mass-radius curve"],
        ["R_{\\text{ref}} = 1.00\\,M^{0.270}", "Zeng Earth-like dry mass-radius curve"],
        ["\\text{WMF}", "Water mass fraction (0&ndash;0.5)"],
      ])}
      ${cite("Zeng, L. &amp; Sasselov, D. (2016), ApJ 819, 127")}`,
    ),

    formula(
      "Core Radius Fraction",
      `<div class="sci-formula__eq">${eq("\\text{CRF} = \\sqrt{\\text{CMF}}")}</div>
      <p>Empirical approximation relating the fractional core radius to the core mass fraction. Earth: CMF = 0.325 &rarr; CRF &approx; 0.57 (observed 0.545, within 5%).</p>
      ${vars([
        ["\\text{CRF}", "Core radius / total planetary radius"],
        ["\\text{CMF}", "Core mass fraction (0&ndash;1)"],
      ])}
      ${cite("Zeng, L. &amp; Jacobsen, S. (2017)")}`,
    ),

    formula(
      "Magnetic Dipole Scaling (Olson & Christensen 2006)",
      `<div class="sci-formula__eq">${eq("B_{\\text{surf}} = \\frac{\\sqrt{\\rho_c} \\cdot \\text{CRF}^3 \\cdot M^{1/3} \\cdot C_b}{B_{\\oplus}}")}</div>
      <p>Self-normalised dynamo scaling law. The same formula is evaluated for both the planet and Earth, guaranteeing Earth = 1.0&times; exactly. Fields below 0.005&times; Earth are considered too weak to sustain a measurable dynamo.</p>
      ${vars([
        [
          "\\rho_c = \\text{CMF} \\cdot \\rho / \\text{CRF}^3",
          "Core density from mass conservation (two-layer model)",
        ],
        ["\\text{CRF} = \\sqrt{\\text{CMF}}", "Core radius fraction (Zeng &amp; Jacobsen 2017)"],
        ["M^{1/3}", "Heat-flux proxy from planet mass"],
        ["C_b", "Three-phase convective boost (see below)"],
        ["B_{\\oplus}", "Earth reference: same formula with CMF=0.33, &rho;=5.514, M=1"],
      ])}
      <p><b>Convective boost ${iq("C_b(s_f)")}:</b> Three-phase function of solid fraction ${iq("s_f = t / \\tau_{\\text{core}}")}:</p>
      <ul style="font-size:13px;color:var(--muted);margin:4px 0 4px 18px">
        <li>${iq("s_f < 0.5")}: ramp ${iq("1 + 0.4\\,s_f")} &mdash; inner core forming, compositional convection building</li>
        <li>${iq("0.5 \\le s_f < 0.85")}: plateau at 1.2 &mdash; peak compositional convection from inner core growth</li>
        <li>${iq("s_f \\ge 0.85")}: decay ${iq("1.2 \\cdot e^{-2.5(s_f - 0.85)/0.15}")} &mdash; thin-shell suppression (e.g. Mercury)</li>
      </ul>
      <p><b>Rotation handling (Christensen &amp; Aubert 2006):</b> In the dipolar regime, field strength is set by the energy budget (buoyancy flux), <em>not</em> rotation rate. Rotation only controls field morphology:</p>
      <ul style="font-size:13px;color:var(--muted);margin:4px 0 4px 18px">
        <li><b>Dipolar</b> (${iq("P < P_{\\text{dip}}")}): no rotation penalty</li>
        <li><b>Multipolar</b> (${iq("P_{\\text{dip}} < P < 50\\,P_{\\text{dip}}")}): smooth sigmoid transition to 0.1&times; (10&times; dipole reduction)</li>
        <li><b>No dynamo</b> (${iq("P > 50\\,P_{\\text{dip}}")}): magnetic Reynolds number too low</li>
      </ul>
      <p>Dipolar limit: ${iq("P_{\\text{dip}} = 96 \\cdot \\sqrt{M} \\cdot \\sqrt{\\text{CMF}/0.33}")} hours.</p>
      ${cite("Olson, P. &amp; Christensen, U. (2006), EPSL 250, 561; Christensen, U. &amp; Aubert, J. (2006), GJI 166")}`,
    ),

    formula(
      "Core Solidification Timescale",
      `<div class="sci-formula__eq">${eq("\\tau = (2 + 12 \\cdot \\text{CMF} \\cdot \\sqrt{M_\\oplus}) \\;\\times\\; A \\quad \\text{(Gyr)}")}</div>
      <p>Empirical estimate of the time for a terrestrial core to fully solidify. A planet with age &gt; 1.5&tau; is assumed to have a solidified core and no active dynamo.</p>
      <p>Higher radioisotope abundance keeps the core liquid longer by increasing internal heat production.</p>
      ${vars([
        ["\\tau", "Core solidification timescale (Gyr)"],
        ["\\text{CMF}", "Core mass fraction (0&ndash;1)"],
        ["M_\\oplus", "Planet mass (Earth masses)"],
        ["A", "Radioisotope abundance (1.0 = Earth; see below)"],
      ])}`,
    ),

    formula(
      "Radioisotope Abundance",
      `<div class="sci-formula__eq">${eq("A = \\sum_i a_i \\cdot w_i")}</div>
      <p>Effective radioisotope abundance relative to Earth. In <b>Simple</b> mode, ${iq("A")} is set directly by the slider.
      In <b>Per-Isotope</b> mode, ${iq("A")} is the weighted sum of individual isotope abundances ${iq("a_i")} and their
      present-day fractional contributions ${iq("w_i")} to Earth&rsquo;s radiogenic heat budget:</p>
      ${dataTable(
        ["Isotope", "Half-life (Gyr)", "Heat fraction <i>w<sub>i</sub></i>"],
        [
          ["U-238", "4.47", "0.39"],
          ["U-235", "0.70", "0.04"],
          ["Th-232", "14.05", "0.40"],
          ["K-40", "1.25", "0.17"],
        ],
      )}
      <p>When all four abundances equal 1.0, ${iq("A = 1.0")} (Earth).
      ${iq("A")} scales the internal heat budget, volcanic decay rate, lithosphere cooling age, and core solidification timescale.</p>
      <p>Range: 0.01&ndash;5.0 (per-isotope), 0.1&ndash;3.0 (simple slider).</p>`,
    ),

    formula(
      "Stellar CMF Derivation",
      `<div class="sci-formula__eq">${eq("\\text{Fe/Mg} = 0.83 \\cdot 10^{[\\text{Fe/H}]}")}</div>
      <div class="sci-formula__eq">${eq("\\text{CMF} = \\frac{\\text{Fe/Mg} \\cdot 55.85}{\\text{Fe/Mg} \\cdot 55.85 + 172}")}</div>
      <p>Derives a suggested core mass fraction from the host star&rsquo;s metallicity [Fe/H], using solar Fe/Mg = 0.83 and a simplified mantle molecular weight of 172 g/mol. ~75% of observed rocky exoplanets match their host star&rsquo;s predicted CMF.</p>
      ${vars([
        ["[\\text{Fe/H}]", "Stellar iron-to-hydrogen ratio (dex)"],
        ["55.85", "Molar mass of iron (g/mol)"],
        ["172", "Effective molar mass of silicate mantle"],
      ])}
      ${cite("Schulze, J. et al. (2021), PSJ 2, 113")}`,
    ),

    formula(
      "Body Classification",
      `<p>Rocky bodies are classified by mass:</p>
      ${dataTable(
        ["Class", "Condition"],
        [
          ["Dwarf planet", "M &lt; 0.01 M&#8853;"],
          ["Planet", "M &ge; 0.01 M&#8853;"],
        ],
      )}
      <p>The threshold is 0.01 M&#8853;, between Mercury (0.055 M&#8853;) and
      Eris (0.0028 M&#8853;). The physics model is identical for both classes
      &mdash; mass&ndash;radius relation, composition, atmosphere, and tectonics
      all apply unchanged. This is purely a labelling convention for worldbuilding.</p>
      <p>Real examples: Ceres (0.00016 M&#8853;), Pluto (0.0022 M&#8853;), Eris (0.0028 M&#8853;).</p>`,
    ),

    formula(
      "Composition Classification",
      `<p>Planets are classified by core mass fraction (CMF) and water mass fraction (WMF):</p>
      ${dataTable(
        ["Class", "Condition"],
        [
          ["Ice world", "WMF &gt; 0.1"],
          ["Ocean world", "WMF &gt; 0.001"],
          ["Iron world", "CMF &gt; 0.6"],
          ["Mercury-like", "CMF &gt; 0.45"],
          ["Earth-like", "CMF &ge; 0.25"],
          ["Mars-like", "CMF &ge; 0.1"],
          ["Coreless", "CMF &lt; 0.1"],
        ],
      )}
      <p>Water regime labels: Dry (&lt; 0.01%), Shallow oceans (&lt; 0.1%), Extensive (&lt; 1%),
      Global ocean (&lt; 10%), Deep ocean (&lt; 30%), Ice world (&ge; 30%).</p>`,
    ),

    formula(
      "Mantle Outgassing Oxidation States",
      `<p>Volcanic gas composition depends on mantle oxygen fugacity:</p>
      ${dataTable(
        ["State", "&Delta;IW", "Primary gases"],
        [
          ["Highly reduced", "&minus;4", "H&#8322; + CO"],
          ["Moderately reduced", "&minus;2", "H&#8322; + CO&#8322; (mixed)"],
          ["Earth-like", "+1", "CO&#8322; + H&#8322;O"],
          ["Oxidised", "+3", "CO&#8322; + H&#8322;O + SO&#8322;"],
        ],
      )}
      <p>The iron-w&uuml;stite (IW) buffer sets the reference. Earth is approximately IW+1.</p>
      ${cite("Ortenzi et al. (2020), Sci. Rep. 10, 10907")}`,
    ),
  ].join("");
}

function buildTectonicsScience() {
  return [
    formula(
      "Maximum Mountain Height",
      `<div class="sci-formula__eq">${eq("H_{\\max} = \\frac{\\sigma_y}{\\rho \\cdot g} \\approx \\frac{9{,}267}{g} \\text{ m}")}</div>
      <p>Tallest mountain a planet&rsquo;s crust can support before compressive failure at the base. The yield strength of silicate rock (~100 MPa) sets an upper bound that scales inversely with surface gravity.</p>
      ${vars([
        ["\\sigma_y", "Compressive yield strength of silicate rock (~100 MPa)"],
        ["\\rho", "Crustal rock density (~2,800 kg/m&sup3;)"],
        ["g", "Surface gravity (relative to Earth, where g = 9.81 m/s&sup2;)"],
      ])}
      <p>Earth: 9,267 m (Everest 8,849 m). Mars at 0.38 g: 24,387 m (Olympus Mons 21,900 m base-to-peak).</p>
      ${cite("Weisskopf, V. F. (1975), &ldquo;Of Atoms, Mountains, and Stars&rdquo;, Science 187, 605&ndash;612")}`,
    ),

    formula(
      "Ocean Floor Subsidence (PSM Plate Model)",
      `<p>Seafloor depth increases with crustal age as the lithosphere cools after formation at a mid-ocean ridge. Two regimes:</p>
      <div class="sci-formula__eq">${eq("d = d_r + 350\\sqrt{t} \\quad (t \\le 20 \\text{ Myr}, \\; \\text{half-space})")}</div>
      <div class="sci-formula__eq">${eq("d = 6{,}400 - 3{,}073\\,e^{-t/62.8} \\quad (t > 20 \\text{ Myr}, \\; \\text{plate model})")}</div>
      ${vars([
        ["d_r", "Mid-ocean ridge depth (default 2,600 m below sea level, GDH1)"],
        ["t", "Crustal age (Myr)"],
        ["350", "Subsidence rate coefficient (m/Myr&frac12;)"],
        ["6{,}400", "Asymptotic ocean depth (m)"],
        ["3{,}073", "Intersection amplitude (WS-modified from PSM&rsquo;s 3,200 m)"],
        ["62.8", "Thermal time constant (Myr)"],
      ])}
      <p>Young crust (&lt;20 Myr) follows half-space cooling (${iq("\\sqrt{t}")} diffusion). Older crust flattens toward an asymptotic depth as basal heating from the mantle balances surface cooling.</p>
      ${cite("Parsons, B. &amp; Sclater, J. G. (1977), JGR 82, 803. Stein, C. &amp; Stein, S. (1992), Nature 359 (GDH1 model).")}`,
    ),

    formula(
      "Airy Isostatic Root Depth",
      `<div class="sci-formula__eq">${eq("d_{\\text{root}} = h \\cdot \\frac{\\rho_c}{\\rho_m - \\rho_c}")}</div>
      ${vars([
        ["h", "Mountain elevation above datum (m)"],
        ["\\rho_c", "Crustal density (2,800 kg/m&sup3;)"],
        ["\\rho_m", "Mantle density (3,300 kg/m&sup3;)"],
      ])}
      <p>Mountains float on denser mantle like icebergs in water. The Airy model keeps density constant but varies crustal thickness: higher elevations require deeper roots. For Earth, every 1 km of elevation produces a 5.6 km root.</p>
      ${cite("Turcotte, D. L. &amp; Schubert, G. (2014), Geodynamics, Ch. 2")}`,
    ),

    formula(
      "Pratt Isostatic Compensation",
      `<div class="sci-formula__eq">${eq("\\rho(h) = \\rho_0 \\cdot \\frac{D}{D + h}")}</div>
      ${vars([
        ["h", "Elevation above datum (m)"],
        ["D", "Compensation depth (default 100 km)"],
        ["\\rho_0", "Base crustal density (2,800 kg/m&sup3;)"],
      ])}
      <p>Alternative to the Airy model: crust has uniform thickness but variable density. Higher terrain is less dense. Both models satisfy the same hydrostatic equilibrium condition but imply different internal structures.</p>
      ${cite("Turcotte, D. L. &amp; Schubert, G. (2014), Geodynamics, Ch. 2")}`,
    ),

    formula(
      "Volcanic Arc Distance",
      `<div class="sci-formula__eq">${eq("d_{\\text{arc}} = \\frac{h_{\\text{slab}}}{\\tan(\\theta)}")}</div>
      ${vars([
        ["h_{\\text{slab}}", "Depth to slab top beneath volcanic front (110 km global mean)"],
        ["\\theta", "Subduction angle (10&ndash;90&deg;)"],
      ])}
      <p>The volcanic arc forms above the point where the descending slab reaches ~110 km depth, triggering partial melting due to dehydration of hydrous minerals. Shallow subduction (Laramide-style, ~15&deg;) pushes the arc hundreds of km inland; steep subduction (Andean, ~45&deg;) places it closer to the trench.</p>
      ${cite("Syracuse, E. &amp; Abers, G. (2006), G&sup3;, 7 &mdash; global mean 105&plusmn;19 km")}`,
    ),

    formula(
      "Linear Erosion",
      `<div class="sci-formula__eq">${eq("H(t) = H_0 - \\varepsilon \\cdot t")}</div>
      ${vars([
        ["H_0", "Initial mountain height (m)"],
        ["\\varepsilon", "Erosion rate (default 5 m/Myr)"],
        ["t", "Elapsed time (Myr)"],
      ])}
      <p>Simple linear denudation. The global median outcrop erosion rate from cosmogenic nuclide measurements is ~5.4 m/Myr, though individual rates span 0.1&ndash;50+ m/Myr depending on lithology, climate, and tectonic uplift.</p>
      ${cite("Cosmogenic nuclide compilation &mdash; global outcrop median 5.4 m/Myr")}`,
    ),

    formula(
      "Spreading Rate Categories",
      `<p>Seafloor spreading velocity at mid-ocean ridges, classified by tectonic regime:</p>
      ${dataTable(
        ["Regime", "Rate (mm/yr)", "Label"],
        [
          ["Mobile lid", "20&ndash;200", "Active spreading"],
          ["Episodic overturn", "5&ndash;50", "Episodic spreading"],
          ["Plutonic-squishy", "2&ndash;20", "Sluggish spreading"],
          ["Stagnant lid", "0", "No spreading"],
        ],
      )}
      <p>Earth&rsquo;s present full spreading rates range from ~10 mm/yr (ultraslow, Arctic Gakkel Ridge) to ~200 mm/yr (ultrafast, East Pacific Rise). Evidence from Dalton et al. (2022) suggests a global slowdown since 15 Ma.</p>
      ${cite("Dalton, C. A. et al. (2022), GRL &mdash; global plate speed evolution since 200 Ma")}`,
    ),

    formula(
      "Shield Volcano Height Scaling",
      `<div class="sci-formula__eq">${eq("H_{\\text{shield}} = \\frac{10{,}000}{g} \\times f_{\\text{lid}}")}</div>
      ${vars([
        ["10{,}000", "Earth reference shield height (m), Mauna Kea base-to-peak"],
        ["g", "Surface gravity (Earth = 1)"],
        ["f_{\\text{lid}}", "Stagnant-lid factor: 1.5 if stagnant lid, 1.0 otherwise"],
      ])}
      <p>Shield volcano height scales inversely with gravity: lower gravity allows magma columns to build taller before the base yields. Stagnant-lid planets lack plate recycling, allowing persistent hotspot volcanism to build larger edifices.</p>
      <p>Validation: Mars at 0.38 g with stagnant lid gives 39,474 m. Olympus Mons is 21,900 m base-to-peak (the model gives a theoretical maximum, not typical height).</p>
      ${cite("McGovern, P. J. &amp; Solomon, S. C. (1993, 1998), JGR &mdash; volcanic loading and lithospheric support")}`,
    ),

    formula(
      "Continental Margin Dimensions",
      `<p>Passive continental margins comprise four morphological zones:</p>
      ${dataTable(
        ["Zone", "Typical width", "Depth range", "Slope"],
        [
          ["Continental shelf", "80 km", "0&ndash;130 m", "~0.1&deg;"],
          ["Continental slope", "varies", "130&ndash;3,000 m", "3&ndash;4&deg;"],
          ["Continental rise", "200 km", "3,000&ndash;4,500 m", "~0.5&deg;"],
          ["Abyssal plain", "indefinite", "4,500+ m", "~0&deg;"],
        ],
      )}
      <p>The shelf break at ~130 m depth corresponds to Pleistocene sea-level lowstands, when shorelines were at the current shelf edge. Shelf width varies from &lt;10 km (active margins) to &gt;300 km (passive margins like eastern North America).</p>
      ${cite("Standard geomorphology references; shelf break 130 m from Pleistocene lowstands")}`,
    ),

    formula(
      "Tectonic Regime Probability Distribution",
      `<div class="sci-formula__eq">${eq("P_i = \\frac{w_i}{\\sum_j w_j}, \\quad w_i = f_M(i) \\cdot f_t(i) \\cdot f_W(i) \\cdot f_C(i) \\cdot f_T(i)")}</div>
      <p>Estimates the probability of each tectonic regime (stagnant lid, mobile lid, episodic overturn, plutonic-squishy lid) from five planetary parameters. Each factor is a smooth Gaussian preference curve centred on the optimal parameter range for that regime. Factors are multiplied together and normalised to sum to 1.0.</p>
      ${vars([
        ["f_M(i)", "Mass factor &mdash; log-Gaussian centred on optimal mass for regime i"],
        ["f_t(i)", "Age factor &mdash; Gaussian in t centred on optimal age for regime i"],
        ["f_W(i)", "Water factor &mdash; WMF-dependent multiplier (Korenaga 2010)"],
        ["f_C(i)", "CMF factor &mdash; penalises mobile lid for high core fraction"],
        ["f_T(i)", "Tidal heating factor &mdash; reduces stagnant lid probability"],
      ])}
      <p>Key regimes: <b>Mobile lid</b> peaks at 0.5&ndash;3 M&oplus;, 2&ndash;6 Gyr, WMF 0.001&ndash;0.1. <b>Stagnant lid</b> dominates below 0.3 M&oplus; or above 5 M&oplus; + old age. <b>Episodic</b> favours young, massive planets. <b>Plutonic-squishy</b> favours young, moderate-mass planets.</p>
      ${cite("Valencia, D. et al. (2007), ApJL 670, L45; O&rsquo;Neill, C. &amp; Lenardic, A. (2007), GRL 34; Noack, L. &amp; Breuer, D. (2014), P&amp;SS 98; Korenaga, J. (2010), ApJL 725, L43")}`,
    ),

    formula(
      "Composition-Dependent Peak Heights",
      `${dataTable(
        ["Composition class", "H<sub>max</sub> (m)"],
        [
          ["Iron world", "12,000"],
          ["Mercury-like", "11,000"],
          ["Earth-like", "9,267"],
          ["Mars-like", "8,500"],
          ["Ocean world", "7,000"],
          ["Ice world", "3,000"],
          ["Coreless", "7,000"],
        ],
      )}
      <p>Yield-stress-limited peak height divided by surface gravity. Ice worlds have much lower yield stress (10 MPa vs 300 MPa for basalt).</p>`,
    ),

    formula(
      "Elastic Lithosphere Thickness",
      `<div class="sci-formula__eq">${eq("T_e = 20\\,\\sqrt{t_{\\text{Gyr}} / A} \\cdot M_\\oplus^{0.3}\\;\\text{km}")}</div>
      <p>Thickens with age (cooling) and mass (higher pressure). Higher radioisotope abundance ${iq("A")} slows cooling, producing a thinner lithosphere at the same age. Tidal heating thins the lithosphere further:
      ${iq("T_e \\times \\max(0.2,\\; 1 - 0.3\\log_{10}(\\dot{E}_{\\text{tidal}}))")} when tidal heating &gt; 0.1&times; Earth.
      Clamped to [5, 300] km.</p>`,
    ),

    formula(
      "Volcanic Activity",
      `<div class="sci-formula__eq">${eq("a = e^{-0.15\\,t\\,/\\,A} + 0.5\\,\\min(1,\\; \\dot{E}_{\\text{tidal}}/2)")}</div>
      <p>Activity relative to Earth (1.0). Decays exponentially with planetary age as internal heat
      diminishes. Dividing by radioisotope abundance ${iq("A")} means a planet with 2&times; Earth&rsquo;s isotopes behaves as if it were half its actual thermal age. Tidal heating can sustain volcanism independently. Clamped to [0.01, 2.0].</p>`,
    ),

    formula(
      "Climate-Adjusted Erosion",
      `<div class="sci-formula__eq">${eq("\\varepsilon = 5 \\cdot \\max(0.2,\\; T/288) \\cdot \\max(0.1,\\; 1 + f_{\\text{H}_2\\text{O}})\\;\\text{m/Myr}")}</div>
      <p>Baseline 5 m/Myr (global median from cosmogenic nuclides) scaled by temperature and
      moisture. Warmer, wetter planets erode faster. Clamped to [0.5, 50] m/Myr.</p>`,
    ),

    `<div class="sci-formula">
      <h3 class="sci-formula__name">Interactive: Gravity &rarr; Mountain &amp; Volcano Heights</h3>
      <p>Adjust gravity to see the maximum mountain height (yield-strength limit) and maximum shield volcano height (1/g scaling).</p>
      <div class="sci-try">
        <div class="sci-try__title">Try it</div>
        <div class="sci-try__row">
          <label>Surface gravity <span class="unit">g</span></label>
          <input id="sci-tec-grav" type="number" value="1" min="0.05" max="5" step="0.01" />
          <input id="sci-tec-grav-slider" type="range" />
        </div>
        <div class="sci-try__output">
          <span class="sci-try__label">Max mountain</span>
          <span class="sci-try__value" id="sci-tec-mtn">&mdash;</span>
        </div>
        <div class="sci-try__output">
          <span class="sci-try__label">Max shield volcano</span>
          <span class="sci-try__value" id="sci-tec-shield">&mdash;</span>
        </div>
        <div class="sci-try__output">
          <span class="sci-try__label">Airy root (5 km peak)</span>
          <span class="sci-try__value" id="sci-tec-root">&mdash;</span>
        </div>
      </div>
    </div>`,
  ].join("");
}

function buildDebrisDisks() {
  return [
    formula(
      "Mean-Motion Resonance Positions",
      `<div class="sci-formula__eq">${eq("a_{\\text{res}} = a_p\\,(p/q)^{2/3}")}</div>
      <p>Orbital distances where a body&rsquo;s period is a rational multiple of a giant planet&rsquo;s.
      Resonances sculpt disk edges and gaps:</p>
      ${dataTable(
        ["Resonance", "(p/q)<sup>2/3</sup>"],
        [
          ["3:2 exterior", "1.310"],
          ["2:1 exterior", "1.587"],
          ["5:2 exterior", "1.842"],
          ["1:2 interior", "0.630"],
          ["1:4 interior", "0.397"],
          ["1:8 interior", "0.250"],
        ],
      )}`,
    ),

    formula(
      "Condensation Sequence",
      `<p>Species condense from a cooling solar-composition nebula at characteristic temperatures:</p>
      ${dataTable(
        ["Species", "T<sub>cond</sub> (K)", "Mass %"],
        [
          ["Corundum (Al&#8322;O&#8323;)", "1700", "0.4"],
          ["Iron-nickel", "1450", "7"],
          ["Enstatite (MgSiO&#8323;)", "1350", "12"],
          ["Forsterite (Mg&#8322;SiO&#8324;)", "1300", "14"],
          ["Feldspar", "1200", "6"],
          ["Troilite (FeS)", "700", "4"],
          ["Organics", "300", "6"],
          ["Water ice", "170", "33"],
          ["NH&#8323; hydrate", "130", "2"],
          ["CO&#8322; ice", "70", "5"],
          ["CH&#8324; ice", "31", "4"],
          ["CO ice", "25", "3"],
          ["N&#8322; ice", "22", "2"],
        ],
      )}
      ${cite("Lodders (2003), ApJ 591, 1220")}`,
    ),

    formula(
      "Dust Equilibrium Temperature",
      `<div class="sci-formula__eq">${eq("T = 279\\,\\frac{\\sqrt{L_\\star}}{\\sqrt{r_{\\text{AU}}}}\\;\\text{K}")}</div>
      <p>Blackbody equilibrium temperature for a grain at distance ${iq("r")} from a star
      of luminosity ${iq("L_\\star")} (solar units).</p>`,
    ),

    formula(
      "Fractional Luminosity",
      `<div class="sci-formula__eq">${eq("f_{\\max} = 2.4{\\times}10^{-8}\\,\\frac{r^{7/3}\\,(\\Delta r / r)}{t_{\\text{age}}}")}</div>
      <p>Maximum disk-to-star luminosity ratio from collisional steady state. Capped at 0.01
      (physical limit). ${iq("t_{\\text{age}}")} in Gyr, ${iq("r")} in AU.</p>
      ${cite("Wyatt et al. (2007), ApJ 658, 569")}`,
    ),

    formula(
      "Blowout Grain Size",
      `<div class="sci-formula__eq">${eq("s_{\\text{blow}} = 0.57\\,L_\\star / M_\\star\\;\\mu\\text{m}")}</div>
      <p>Minimum grain size that remains bound; smaller grains are ejected by radiation pressure.
      Typical surviving grains are ${iq("\\sim 10\\,s_{\\text{blow}}")}.</p>`,
    ),

    formula(
      "Poynting&ndash;Robertson Drag Timescale",
      `<div class="sci-formula__eq">${eq("t_{\\text{PR}} = 700\\,\\frac{s\\,r^2}{L_\\star}\\;\\text{yr}")}</div>
      <p>Time for a grain of size ${iq("s")} (&mu;m) at distance ${iq("r")} (AU) to spiral into the star
      due to radiation drag. If ${iq("t_{\\text{PR}} > t_{\\text{coll}}")}, collisions dominate.</p>`,
    ),

    formula(
      "Collisional Lifetime",
      `<div class="sci-formula__eq">${eq("t_{\\text{coll}} = \\frac{P_{\\text{orb}}}{4\\pi\\tau}")}</div>
      <p>Mean time between destructive collisions. ${iq("\\tau")} is the normal optical depth of the disk.
      Collision velocity: ${iq("v_{\\text{col}} = e\\,v_{\\text{Kep}}\\sqrt{2}")}; regimes: accretionary (&lt; 10 m/s),
      erosive (10&ndash;100), catastrophic (&gt; 100).</p>`,
    ),

    formula(
      "Chaotic Zone",
      `<div class="sci-formula__eq">${eq("\\delta a = 1.3\\,a\\left(\\frac{M_p}{M_\\star}\\right)^{2/7}")}</div>
      <p>Half-width of the dynamically unstable region around a giant planet. Debris within
      this zone is rapidly ejected or accreted.</p>
      ${cite("Wisdom (1980), AJ 85, 1122")}`,
    ),

    formula(
      "IR Excess at 24 &mu;m",
      `<div class="sci-formula__eq">${eq("\\text{excess} = f \\cdot \\frac{B_\\nu(T_{\\text{disk}},\\,24\\,\\mu\\text{m})}{B_\\nu(T_\\star,\\,24\\,\\mu\\text{m})}")}</div>
      <p>Ratio of disk to stellar flux at 24 &mu;m via Planck functions.
      Detectable if &gt; 0.1 (easily), marginal 0.01&ndash;0.1, undetectable &lt; 0.01.</p>`,
    ),
  ].join("");
}

function buildDivergences() {
  const item = (title, body) =>
    `<div class="sci-formula"><h3 class="sci-formula__name">${title}</h3>${body}</div>`;

  return [
    `<p class="sci-diverge-intro">WorldSmith aims to reproduce published astrophysical models wherever possible.
    In several areas, however, published models are incomplete, internally inconsistent, or
    too complex for a real-time calculator. This section documents every place where
    WorldSmith uses its own empirical fits, simplifications, or calibrations instead of
    (or in addition to) a single published formula. Items marked <b>WS-derived</b> are original
    to WorldSmith; items marked <b>Simplified</b> are reductions of published work.</p>`,

    item(
      "Greenhouse Optical Depth Coefficients (WS-derived)",
      `<p>The grey IR optical depth coefficients for CO&#8322; (0.503), H&#8322;O (0.336), and CH&#8324; (0.45) are
      <em>not</em> taken from a single published radiative-transfer study. They are WorldSmith fits
      calibrated so that the energy-balance model reproduces NASA Planetary Fact Sheet surface
      temperatures for Earth (288 K), Venus (737 K), and Mars (211 K) simultaneously.</p>
      <p><b>Why diverge?</b> Published greenhouse models (e.g. Pierrehumbert 2010, Robinson &amp; Catling 2012)
      use either line-by-line radiative transfer (too slow for real-time) or parameterisations tied
      to specific atmospheric compositions. WorldSmith needs a single grey-opacity formula that
      works from Mars (0.006 atm, 95% CO&#8322;) through Earth (1 atm, mixed) to Venus (92 atm, 96% CO&#8322;).
      No published parameterisation spans this range in a single expression.</p>
      <p><b>Functional forms</b> (logarithmic for CO&#8322;/H&#8322;O, square-root for CH&#8324;) <em>are</em>
      grounded in published physics: Myhre (1998) band saturation for CO&#8322;, IPCC TAR Table 6.2
      for CH&#8324;, Robinson &amp; Catling (2012) for pressure broadening (${iq("P^{0.684}")}).</p>
      ${cite("Coefficients: WorldSmith calibration. Functional forms: Myhre (1998), IPCC TAR (2001), Robinson &amp; Catling (2012).")}`,
    ),

    item(
      "CO&#8322;&ndash;H&#8322;O Band Overlap Suppression (WS-derived)",
      `<p>The half-saturation model ${iq("\\omega = 1/(1 + \\tau_{\\text{CO}_2}/6)")} and the constant
      ${iq("k = 6")} are WorldSmith-derived. No published radiative-transfer study provides a
      single-parameter overlap correction of this form.</p>
      <p><b>Why diverge?</b> Real spectral overlap between CO&#8322; and H&#8322;O in the 12&ndash;18 &mu;m
      and 4.3 &mu;m regions is well established in atmospheric physics, but published models handle it
      through correlated-k or line-by-line methods, not analytic expressions. The value ${iq("k = 6")}
      was chosen so Venus (96% CO&#8322; + 30 ppm H&#8322;O) gives 737 K; the H&#8322;O coefficient was then
      re-fitted from 0.327 to 0.336 to recover Earth&rsquo;s 288 K.</p>`,
    ),

    item(
      "Expert Gas Overlap Constants (WS-derived)",
      `<p>The overlap constants ${iq("k_{\\text{SO}_2} = 8")} and ${iq("k_{\\text{NH}_3} = 20")}
      and the H&#8322;&ndash;N&#8322; CIA coefficient (3.0) are WorldSmith calibrations.</p>
      <p><b>Why diverge?</b> H&#8322;&ndash;N&#8322; CIA opacity is published (Wordsworth &amp;
      Pierrehumbert 2013), but as absorption coefficients for specific P-T grids, not as a
      single scalar. The coefficient 3.0 reproduces ~12 K warming at 10% H&#8322; / 90% N&#8322; / 1 bar,
      consistent with their Figure 2. SO&#8322; and NH&#8323; overlap constants were calibrated so
      Venus in Full mode matches 737 K with NASA trace-gas values.</p>
      ${cite("H&#8322;&ndash;N&#8322; CIA: Wordsworth &amp; Pierrehumbert (2013), Science 339. SO&#8322;/NH&#8323; overlap: WorldSmith calibration.")}`,
    ),

    item(
      "Surface Temperature Divisor (WS-derived)",
      `<p>The factor ${iq("\\text{surfDiv} = 1 - 0.1 \\cdot \\min(\\tau, 1)")} that ramps from
      1.0 (airless) to 0.9 (atmosphere with ${iq("\\tau \\ge 1")}) is a WorldSmith parameterisation.</p>
      <p><b>Why diverge?</b> In real atmospheres, convective transport creates a temperature
      difference between the radiative emission level and the surface (the lapse rate). Published
      models use full convective adjustment or adiabatic profiles. The 0.9 factor is a crude
      correction that improves surface temperature accuracy for Earth-like atmospheres without
      adding a convective model. It has no published basis beyond calibration.</p>`,
    ),

    item(
      "Planet Mass&ndash;Radius Compression Exponent (WS-derived)",
      `<p>The mass-dependent exponent ${iq("\\alpha(M) = \\min(1/3,\\; 0.257 - 0.0161 \\ln M)")})
      is a WorldSmith fit. Published mass-radius relations (Zeng &amp; Sasselov 2013, Fortney 2007)
      provide specific curves for fixed compositions, not a single analytic expression with CMF
      as a continuous parameter.</p>
      <p><b>Why diverge?</b> WorldSmith needs a formula where both mass and CMF are free
      parameters. The CMF prefactor ${iq("(1.07 - 0.21 \\cdot \\text{CMF})")} comes from Zeng &amp;
      Sasselov (2016). The exponent was fitted to reproduce all four Solar System rocky planets:
      Mercury (0.3% error), Venus (0.8%), Earth (0.2%), Mars (0.5%).</p>
      ${cite("CMF scaling: Zeng &amp; Sasselov (2016). Exponent: WorldSmith fit to Solar System data.")}`,
    ),

    item(
      "Core Solidification Timescale (Simplified)",
      `<p>The formula ${iq("\\tau = 2 + 12 \\cdot \\text{CMF} \\cdot \\sqrt{M_\\oplus}")} is a WorldSmith
      approximation, not from a specific publication. Published core thermal evolution models
      (e.g. Stevenson 2003, Nimmo 2015) solve coupled energy-balance ODEs for core heat flux,
      inner-core growth rate, and mantle cooling.</p>
      <p><b>Why diverge?</b> Full thermal evolution models require ~20 free parameters
      (viscosity, thermal conductivity, heat production rates, initial conditions) and numerical
      integration. The formula captures the two key dependencies&mdash;larger cores in larger
      planets retain heat longer&mdash;and gives sensible results: Earth ~6 Gyr (partially solidified
      at 4.6 Gyr), Mars ~2.6 Gyr (fully solidified), Mercury ~6.7 Gyr (just solidified at 4.6 Gyr).</p>`,
    ),

    item(
      "Magnetic Field: Three-Phase Convective Boost (WS-derived)",
      `<p>The ${iq("C_b(s_f)")} function with its phase boundaries (0.5, 0.85) and exponential
      decay constant (&minus;2.5) is a WorldSmith parameterisation. Published inner-core dynamo models
      (Aubert 2009, Davies 2015) show the compositional convection peak but don&rsquo;t provide an
      analytic formula.</p>
      <p><b>Why diverge?</b> The three phases are physically motivated: (1) growing inner core
      drives compositional buoyancy, (2) peak convection when the inner core is large enough
      to produce significant light-element release, (3) thin-shell suppression when the liquid
      outer core narrows. The decay was calibrated so Mercury (${iq("s_f \\approx 1")})
      produces ~0.8% of Earth&rsquo;s field, matching MESSENGER observations (~1%).</p>`,
    ),

    item(
      "Magnetic Field: Dipolar Limit Scaling (Simplified)",
      `<p>The dipolar limit ${iq("P_{\\text{dip}} = 96 \\cdot \\sqrt{M} \\cdot \\sqrt{\\text{CMF}/0.33}")}
      hours is a WorldSmith proxy for the local Rossby number. Published dynamo simulations
      (Christensen &amp; Aubert 2006) define the dipolar&ndash;multipolar transition at ${iq("Ro_l \\approx 0.12")},
      which depends on convective velocity, core shell thickness, and rotation rate.</p>
      <p><b>Why diverge?</b> Computing the local Rossby number requires knowing the convective
      velocity (from buoyancy flux) and shell geometry. The mass/CMF proxy captures the key
      trend: larger, more iron-rich planets can rotate more slowly while maintaining a dipolar field.
      The 96-hour base and 50&times; Rm cutoff were calibrated so Earth (24 h) is well inside the
      dipolar regime, Mercury (1408 h, CMF 70%) keeps its weak multipolar dynamo, and Venus
      (5832 h) has no field.</p>`,
    ),

    item(
      "Magnetic Field: Multipolar Factor 0.1 (Simplified)",
      `<p>The 10&times; reduction in dipole field strength for multipolar dynamos is a literature-informed
      simplification. Published simulations show a wide range (5&ndash;20&times;) depending on the
      Ekman number and boundary conditions.</p>
      <p><b>Why diverge?</b> A factor of 10 is the central estimate from Olson &amp; Christensen (2006,
      their Figure 7). The sigmoid transition avoids the unphysical discontinuity that a step
      function would produce at the dipolar limit.</p>`,
    ),

    item(
      "Core Radius Fraction CRF = &radic;CMF (Simplified)",
      `<p>The relation ${iq("\\text{CRF} = \\sqrt{\\text{CMF}}")} is a first-order approximation.
      Zeng &amp; Jacobsen (2017) derive CRF from self-consistent interior structure models that
      account for compression, phase transitions, and the density contrast between core and
      mantle at each pressure.</p>
      <p><b>Why diverge?</b> The full Zeng &amp; Jacobsen model requires numerical integration of
      the hydrostatic equation. The square-root approximation gives Earth CRF = 0.57 vs. observed
      0.545 (5% error) and scales correctly with CMF for other planets. The error is systematic
      (slight overestimate) and consistent across the rocky-planet mass range.</p>
      ${cite("Zeng, L. &amp; Jacobsen, S. (2017). Approximation: WorldSmith simplification.")}`,
    ),

    item(
      "Water-Radius Inflation: Linear Interpolation (Simplified)",
      `<p>WorldSmith linearly interpolates between the Zeng dry curve (${iq("R = 1.00\\,M^{0.270}")})
      and the 50%-water curve (${iq("R = 1.38\\,M^{0.263}")}) using ${iq("\\text{WMF}/0.5")} as the
      blend factor. Zeng &amp; Sasselov (2016) provide discrete curves at specific water fractions,
      not a continuous interpolation scheme.</p>
      <p><b>Why diverge?</b> Publishing interior-structure curves at every possible WMF is impractical.
      Linear interpolation in the inflation factor is physically reasonable because the ice/water
      layer is less compressible than rock, making its effect on radius roughly proportional to its
      mass fraction. The error is &lt; 3% for WMF &lt; 0.3.</p>`,
    ),

    item(
      "Atmospheric Circulation Cell Count (Simplified)",
      `<p>The step function mapping rotation period to Hadley cell count (1 / 3 / 7 / 5 cells)
      is a coarse simplification. Published GCM studies (e.g. Kaspi &amp; Showman 2015, Komacek &amp;
      Abbot 2019) show a continuous relationship where cell number depends on the Rossby
      deformation radius, which involves rotation rate, planetary radius, and static stability.</p>
      <p><b>Why diverge?</b> Running a GCM is not feasible in real time. The step function captures
      the qualitative pattern: slow rotators have a single overturning cell, Earth-like rotators
      have three, and rapid rotators have more. The specific thresholds (48 h, 6 h, 3 h) are
      approximate and should not be interpreted as sharp physical transitions.</p>`,
    ),

    item(
      "Tectonic Regime Probabilities (WS-derived)",
      `<p>The entire five-factor multiplicative model for tectonic regime probabilities is a WorldSmith
      construction. No published paper provides a quantitative probability distribution over
      tectonic regimes as a function of mass, age, water, CMF, and tidal heating.</p>
      <p><b>Why diverge?</b> The science of exoplanet tectonics is genuinely unsettled.
      Valencia et al. (2007) argue that super-Earths should have plate tectonics;
      O&rsquo;Neill &amp; Lenardic (2007) argue the opposite. Noack &amp; Breuer (2014) show
      strong sensitivity to initial conditions. WorldSmith synthesises these qualitative findings
      into a quantitative prior that helps worldbuilders, but the specific Gaussian widths, peak
      positions, and multiplicative structure are heuristic.</p>
      ${cite("Qualitative basis: Valencia et al. (2007), O'Neill &amp; Lenardic (2007), Noack &amp; Breuer (2014), Korenaga (2010). Quantitative model: WorldSmith.")}`,
    ),

    item(
      "Habitable Zone: Chromant Desmos Correction (Modified)",
      `<p>The Seff polynomials and the temperature proxy ${iq("T_{\\text{eff}} = 5778 \\cdot M^{0.55}")}
      are described as &ldquo;Chromant Desmos correction&rdquo; rather than the original
      Kopparapu et al. (2013/2014) coefficients. The polynomial coefficients differ slightly
      from the published values.</p>
      <p><b>Why diverge?</b> The original Kopparapu polynomials use actual stellar effective
      temperature as input. WorldSmith derives Teff from mass, introducing a proxy step.
      The Chromant correction adjusts the polynomial coefficients to compensate for this
      proxy and improve agreement across the 0.1&ndash;2 M&#9737; range where the mass-Teff
      relation deviates from the simple power law.</p>`,
    ),

    item(
      "Atmospheric Tide Calibration Constant C = 12 (WS-derived)",
      `<p>The dimensionless constant ${iq("C = 12")} in the atmospheric tide ratio
      ${iq("b = C \\cdot P_s \\cdot S / (g \\cdot T_{\\text{eq}})")} is a WorldSmith calibration.</p>
      <p><b>Why diverge?</b> Published atmospheric tide models (Leconte et al. 2015, Ingersoll &amp;
      Dobrovolskis 1978) derive torque from thermal tide amplitude, which depends on atmospheric
      structure. The constant C = 12 is calibrated so Venus (92 atm, S &approx; 1.9, g &approx; 8.8,
      T<sub>eq</sub> &approx; 229 K) gives ${iq("b > 1")}, correctly preventing tidal lock.
      Earth (1 atm) gives ${iq("b \\ll 1")}, correctly allowing tidal evolution.</p>`,
    ),

    item(
      "Planet Composition-Dependent Rigidity and Q (WS-derived)",
      `<p>The functions for planet tidal rigidity (${iq("\\mu")}) and quality factor (${iq("Q")})
      as continuous functions of CMF and WMF are WorldSmith parameterisations. Published values
      exist only for specific bodies (Earth: ${iq("\\mu")} &approx; 80 GPa mantle + 160 GPa core averaged,
      Q &approx; 12&ndash;280 frequency-dependent).</p>
      <p><b>Why diverge?</b> WorldSmith needs a continuous function for arbitrary compositions.
      The base values (rock 30 GPa, iron boost 50 GPa above CMF 0.33, ice 3.5 GPa) are
      literature anchor points. The CMF-dependent Q (12 + 70&times;max(0, CMF&minus;0.2)) interpolates
      between low-Q rocky mantles and high-Q iron-rich interiors, consistent with the observation
      that Mercury (Q &sim; 30&ndash;70) is more dissipative than metallic cores but less than pure rock.</p>`,
    ),

    item(
      "Moon Composition Overrides: Io and Enceladus (WS-derived)",
      `<p>The &ldquo;Partially molten&rdquo; (${iq("\\mu")} = 10 GPa, Q = 10) and &ldquo;Subsurface ocean&rdquo;
      (${iq("\\mu")} = 0.3 GPa, Q = 2) composition classes are WorldSmith calibrations that override
      the density-based lookup.</p>
      <p><b>Why diverge?</b> Bulk density is a reliable proxy for cold, geologically quiet moons
      but fails dramatically for extreme interiors. Without overrides, Io&rsquo;s heating is
      underpredicted by ~7&times; and Enceladus&rsquo;s by ~60&times;. The override values were chosen
      to match observed heat outputs (Io: ~10&sup1;&sup4; W, Enceladus: ~1.6 &times; 10&sup1;&deg; W within 10%).
      This approach is limited: Titan is predicted ~37&times; too high, an active area of research.</p>`,
    ),

    item(
      "Love Number Differentiation Factor k&#8322; &times; 0.37 (WS-derived)",
      `<p>The homogeneous-body Love number formula gives k&#8322; &approx; 0.82 for Earth, but the observed
      value is 0.299 (PREM). The factor 0.37 multiplied into k&#8322; calibrates the formula to
      differentiated bodies.</p>
      <p><b>Why diverge?</b> The analytic Love number formula assumes a uniform body. Real planets
      are differentiated (dense core + less dense mantle), which reduces k&#8322;. Published corrections
      require full interior-structure integration. The 0.37 factor gives realistic Earth-Moon
      recession (3.5 cm/yr modelled vs 3.83 cm/yr observed) and consistent results across the
      Solar System.</p>`,
    ),

    item(
      "Stellar CMF from Metallicity (Simplified)",
      `<p>The formula deriving CMF from [Fe/H] via molar mass balance uses a fixed Si/Mg ratio
      and a simplified mantle molecular weight (172 g/mol). Schulze et al. (2021) use a more
      detailed mineralogical model with multiple mantle phases.</p>
      <p><b>Why diverge?</b> The full Schulze model requires a mantle mineralogy solver. The
      simplified version captures the dominant trend: higher stellar [Fe/H] &rarr; higher Fe/Mg
      &rarr; higher CMF. It reproduces the key result that ~75% of observed rocky exoplanets
      have CMFs consistent with their host star&rsquo;s metallicity.</p>
      ${cite("Schulze, J. et al. (2021), PSJ 2, 113. Simplification: WorldSmith.")}`,
    ),

    item(
      "Vegetation Colour Extrapolation (Simplified)",
      `<p>PanoptesV provides pre-computed vegetation colours at 1, 3, and 10 atm for spectral
      classes A0&ndash;M8. WorldSmith extrapolates below 1 atm and above 10 atm with 50% dampening,
      which has no published basis.</p>
      <p><b>Why diverge?</b> No published model provides vegetation colours outside the 1&ndash;10 atm
      range. The 50% dampening is a conservative choice: physically, Rayleigh scattering effects
      should diminish below 1 atm and saturate above 10 atm, but the rate of change is unknown.
      Dampening prevents unphysical extrapolation artefacts.</p>
      ${cite("LUT data: PanoptesV (panoptesv.com/SciFi). Extrapolation: WorldSmith.")}`,
    ),

    item(
      "Spin-Orbit Resonance Capture Thresholds (Simplified)",
      `<p>The thresholds for resonance capture (H &gt; 0.25 for 3:2, H &gt; 0.5 for 2:1 and 5:2)
      are WorldSmith choices. Goldreich &amp; Peale (1966) derive capture probabilities that depend
      on the tidal dissipation rate and the approach trajectory, not just the eccentricity
      function amplitude.</p>
      <p><b>Why diverge?</b> Full capture probability computation requires integrating the
      spin-down trajectory through each resonance, which depends on Q and the spin-down rate.
      The threshold approach gives the correct qualitative result: Mercury (e = 0.206) captures
      into 3:2, and higher eccentricities enable higher-order resonances. The specific threshold
      values are order-of-magnitude estimates.</p>
      ${cite("Goldreich, P. &amp; Peale, S. (1966), AJ 71, 425. Thresholds: WorldSmith simplification.")}`,
    ),

    item(
      "Flare Rate Binning (Simplified)",
      `<p>The N&#8323;&#8322; values (flares per day above 10&sup3;&sup2; erg) are discretised into three spectral
      bins (FGK / early-M / late-M) and three age bands per bin. Published data (G&uuml;nther et al. 2020)
      provide continuous distributions that vary more smoothly with Teff and age.</p>
      <p><b>Why diverge?</b> The binning provides a tractable lookup table that captures the dominant
      trends: cooler stars flare more frequently, younger stars flare more frequently. Interpolation
      within bins was considered but rejected because the published uncertainties (factors of 2&ndash;5)
      are larger than the binning error. The specific N&#8323;&#8322; values within each bin are WorldSmith
      estimates informed by the TESS statistics.</p>`,
    ),

    item(
      "Gas Giant Tidal k&#8322; &amp; Q (Empirical Fits)",
      `<p>Gas giant tidal parameters use mass-dependent empirical fits rather than first-principles
      interior models. The fluid Love number k&#8322; follows a sigmoid in log-mass space calibrated
      to Juno (Jupiter), Cassini (Saturn), and Voyager (ice giants). The tidal quality factor Q uses
      a piecewise fit: Jupiter ≈ 3.5&times;10&#8308; (Lainey+ 2009), Saturn ≈ 2,500 (resonance locking,
      Fuller+ 2016), ice giants ≈ 1.5&times;10&#8308; (Tittemore &amp; Wisdom 1990).</p>
      <p><b>Why diverge?</b> A first-principles k&#8322; requires solving the full interior structure
      equations with an H/He equation of state. Q depends on poorly understood dissipation mechanisms
      (turbulent viscosity, inertial waves, resonance locking). The empirical fits match all four
      Solar System giants&rsquo; observed k&#8322;/Q ratios within published uncertainty ranges.
      The k&#8322;/Q ratio also feeds into the dynamo model via moon tidal heating flux.</p>`,
    ),

    item(
      "Class I Bond Albedo (Chromophore-Adjusted)",
      `<p>Sudarsky (2000) Class I &ldquo;ammonia cloud&rdquo; bond albedo is lowered from 0.57
      to 0.34. The original value assumed pure NH&#8323; ice crystals; real ammonia cloud
      decks contain UV-photolysis products (chromophores) that darken the atmosphere.
      The adjusted value 0.34 matches the observed geometric mean of Jupiter (0.343) and
      Saturn (0.342).</p>
      <p><b>Why diverge?</b> The theoretical Sudarsky albedo produces T<sub>eq</sub> errors of
      ~11% for all Class I gas giants, cascading into ~30% errors in internal heat flux
      and ~4% errors in magnetic field strength. The chromophore-adjusted value brings
      Jupiter T<sub>eq</sub> from 99 K to 110 K (NASA: 110 K) and internal flux from
      3.8 to 5.5 W/m&sup2; (observed: 5.4).</p>`,
    ),

    item(
      "Gas Giant Magnetic Dynamo (Dual-Normalised Christensen Scaling)",
      `<p>The gas giant magnetic field uses Christensen (2009) energy-flux scaling with
      dual normalisation: gas giants to Jupiter (4.28 G), ice giants to the Uranus/Neptune
      geometric mean (0.18 G). A density-dependent ionic ocean shell model
      (${iq("r_o/R = 0.70 \\cdot (\\rho_{\\text{ref}}/\\rho)^{0.82}")}) captures how less dense
      ice giants have thicker conducting shells due to ionic dissociation occurring at larger
      fractional radius. A compositional convection floor (0.4 W/m&sup2;) prevents unrealistically
      weak fields for low-internal-heat planets.</p>
      <p><b>Why diverge?</b> The full Christensen scaling requires numerical dynamo simulations
      to determine the proportionality constant and shell-geometry corrections. Dual normalisation
      avoids cross-regime extrapolation between thick-shell dipolar dynamos (gas giants) and
      thin-shell multipolar dynamos (ice giants). The density-dependent shell exponent (0.82) is
      calibrated to reproduce the Uranus/Neptune field ratio. The shell power law uses exponent 3.2
      instead of the theoretical 3 to account for thin-shell dipolarity reduction and stable-layer
      attenuation (Heimpel+ 2005, Christensen &amp; Wicht 2008). All four Solar System giant fields
      match within ~2%.</p>`,
    ),

    item(
      "Magnetopause Plasma Inflation from Moon Tidal Heating and Atmospheric Sputtering",
      `<p>The magnetopause standoff uses first-principles Chapman&ndash;Ferraro dipole pressure
      balance, then inflates by a power-law factor based on total plasma loading from the planet&rsquo;s
      moons: ${iq("f = (1 + H_{\\text{total}}/H_{\\text{ref}})^\\gamma")} with ${iq("H_{\\text{ref}} = 4 \\times 10^5")} W
      and ${iq("\\gamma = 0.047")}.</p>
      <p>Two plasma sources contribute to ${iq("H_{\\text{total}}")}:</p>
      <ol>
        <li><b>Volcanic outgassing</b> (Io mechanism): tidal heating estimated via cold-body
        ${iq("k_2/Q")} with thermal feedback for intensely heated moons.</li>
        <li><b>Atmospheric sputtering</b> (Triton mechanism): moons with sublimation-driven
        volatile atmospheres (N&#x2082;, CO, CH&#x2084;) are sputtered by magnetospheric ions.
        Equivalent plasma power: ${iq("W = \\min(P, P_{\\text{sat}}) \\times \\pi R^2 / g \\times K")}
        where ${iq("P")} is the surface vapor pressure, ${iq("P_{\\text{sat}} = 10")} Pa caps
        thick-atmosphere shielding, and ${iq("K = 6.5 \\times 10^{-6}")} is the calibrated
        sputtering efficiency. SO&#x2082; is excluded (already covered by tidal heating).</li>
      </ol>
      <p>Species eligibility requires: density below max threshold, surface temperature in the
      sublimation regime (below triple point), Jeans ${iq("\\lambda > 6")}, and escape timescale
      exceeding system age.</p>
      <p><b>Why diverge?</b> The conversion from heating/sputtering to plasma loading
      involves complex intermediate steps that cannot be computed from first principles without
      detailed interior and magnetospheric models. The power-law inflation is calibrated
      to all four Solar System giants: Jupiter ~75 Rp, Saturn ~22 Rp, Uranus ~18 Rp,
      Neptune ~23 Rp (all within 3%).</p>`,
    ),

    item(
      "Maximum Stellar Age M/L &times; 10 Gyr (Simplified)",
      `<p>The main-sequence lifetime formula ${iq("\\tau_{\\max} = M/L \\times 10")} Gyr is a
      standard textbook approximation. Published stellar evolution models (e.g. MESA/MIST,
      Choi et al. 2016) compute lifetimes from full evolutionary tracks that include composition
      effects, overshooting, and mass loss.</p>
      <p><b>Why diverge?</b> Full evolutionary tracks require stellar structure codes. The M/L
      formula captures the dominant scaling: more massive stars burn fuel faster. It matches
      MIST grid lifetimes within 20% for 0.5&ndash;2 M&#9737; and is widely used in planetary science
      for order-of-magnitude lifetime estimates.</p>`,
    ),

    item(
      "Ocean Subsidence Intersection Constant (WS-modified)",
      `<p>The plate-model intersection amplitude uses 3,073 m instead of Parsons &amp; Sclater&rsquo;s
      published 3,200 m. This is a WorldSmith hybrid calibration chosen so the half-space and
      plate-model regimes intersect smoothly at 20 Myr.</p>
      <p><b>Why diverge?</b> The original PSM (1977) constants were derived independently for each
      regime. A strict join at 20 Myr with the published 3,200 m amplitude produces a ~50 m
      discontinuity. The adjusted value 3,073 eliminates this artefact while staying within
      the published uncertainty range.</p>
      ${cite("Parsons &amp; Sclater (1977), JGR 82, 803. Adjustment: WorldSmith calibration.")}`,
    ),

    item(
      "Shield Volcano 1/g Scaling (Simplified)",
      `<p>The shield volcano height formula ${iq("H = 10{,}000/g \\times f_{\\text{lid}}")} uses a
      simple inverse-gravity scaling with a single reference point (Earth, 10 km) and a 1.5&times;
      stagnant-lid multiplier. Published models (McGovern &amp; Solomon 1993, 1998) consider
      lithospheric flexure, magma supply rates, and elastic thickness.</p>
      <p><b>Why diverge?</b> Full volcanic loading models require knowledge of lithospheric
      rheology and thermal structure. The 1/g law captures the dominant physics: yield strength
      limits column height, and gravity is the primary control. The stagnant-lid factor accounts
      for the observation that plate tectonics limits volcanic edifice lifetime. Mars validates
      the approach: 0.38 g &times; 1.5 gives 39.5 km theoretical max vs. 21.9 km observed for
      Olympus Mons (the model gives an upper bound, not a typical height).</p>`,
    ),

    item(
      "Continental Margin Fixed Dimensions (Simplified)",
      `<p>The continental margin profile uses fixed default parameters (shelf 80 km &times; 130 m,
      slope 3.5&deg;, rise 200 km) that represent Earth averages. Real margins vary enormously:
      shelf width ranges from &lt;10 km (active margins) to &gt;300 km (passive margins).</p>
      <p><b>Why diverge?</b> A physics-based margin model would need sediment supply,
      subsidence history, sea-level curves, and tectonic setting. The fixed defaults provide a
      reasonable starting point for worldbuilding, with user-adjustable parameters for
      customisation. The 130 m shelf break depth is well-established from Pleistocene
      glacioeustatic lowstands.</p>`,
    ),

    item(
      "Gas Giant Internal Heat Ratio Ramps (WS-derived)",
      `<p>The mass-dependent ramp for internal heat ratio (1.0 at Uranus-mass to 1.67 at
      Jupiter-mass) is a WorldSmith interpolation. Published values exist only for individual
      Solar System giants (Jupiter 1.67, Saturn 1.78, Uranus &lt; 1.06, Neptune 2.6).</p>
      <p><b>Why diverge?</b> No published model provides a continuous function of internal heat
      ratio vs. mass for arbitrary gas giants. The ramp captures the qualitative trend that more
      massive giants retain more primordial heat. Neptune&rsquo;s anomalously high value is not
      well explained and is treated as an outlier.</p>`,
    ),

    item(
      "Gas Giant Ring Mass Gaussian Model (WS-derived)",
      `<p>The ring mass model ${iq("M_{\\text{ring}} = 3 \\times 10^{19} \\, e^{-0.5(M/M_J - 1)^2}")} kg
      with Gaussian optical depth is a WorldSmith parameterisation. Published ring models focus on
      dynamics and structure of known ring systems, not on predicting ring properties from planet mass.</p>
      <p><b>Why diverge?</b> Ring formation and evolution depend on satellite disruption history,
      meteoroid bombardment, and viscous spreading&mdash;processes too complex for a parametric model.
      The Gaussian peaked at 1 ${iq("M_J")} reflects that Saturn-mass planets have the most prominent
      rings in the Solar System.</p>`,
    ),

    item(
      "Gas Giant Oblateness MOI Interpolation (WS-derived)",
      `<p>The moment-of-inertia factor is interpolated between 0.25 (rock-like core) and 0.22
      (centrally condensed gas giant) based on mass. Published interior models compute MOI from
      self-consistent density profiles with equations of state for hydrogen and helium.</p>
      <p><b>Why diverge?</b> Full interior structure models (e.g. Hubbard &amp; Militzer 2016)
      require numerical integration of the hydrostatic equation with an H/He EOS. The interpolation
      captures the trend that more massive giants are more centrally condensed, giving reasonable
      oblateness values for the Darwin-Radau relation.</p>`,
    ),

    item(
      "Population Tech Era Density/Growth Tables (WS-derived)",
      `<p>The population density and growth rate values for each technological era (Hunter-Gatherer
      through Sci-Fi High) are WorldSmith estimates. Published historical demography provides data
      for Earth&rsquo;s specific trajectory, not generic per-era densities.</p>
      <p><b>Why diverge?</b> Earth&rsquo;s population history is a single data point shaped by
      geography, disease, and culture. The era-based table provides plausible defaults for
      worldbuilding by abstracting the dominant technological constraint on carrying capacity.
      Values are order-of-magnitude consistent with Earth history but should not be treated as
      predictions.</p>`,
    ),

    item(
      "Climate Moisture Index Zone Model (WS-derived)",
      `<p>The three-zone moisture model (tropical Hadley: 0.9, midlatitude Ferrel: 0.5, polar: 0.2)
      with transitions at 30&deg; and 60&deg; latitude is a WorldSmith simplification. Published
      climate models compute precipitation from GCM-resolved atmospheric dynamics.</p>
      <p><b>Why diverge?</b> Running a GCM is not feasible in real time. The three-zone model
      captures the first-order pattern: ITCZ convergence drives tropical rainfall, subtropical
      subsidence creates deserts, and midlatitude storm tracks provide moderate precipitation.
      The zone boundaries are approximate and shift with rotation rate and obliquity.</p>`,
    ),

    item(
      "Climate Tidally-Locked Temperature Model (WS-derived)",
      `<p>The substellar/terminator/antistellar temperature model with redistribution efficiency
      ${iq("\\varepsilon")} is a WorldSmith parameterisation. Published tidally locked climate models
      (e.g. Pierrehumbert 2011, Leconte et al. 2013) use 3D GCMs that resolve atmospheric heat
      transport.</p>
      <p><b>Why diverge?</b> The analytic model provides instant temperature estimates for the
      three characteristic zones of a tidally locked planet. The redistribution efficiency
      ${iq("\\varepsilon")} encapsulates atmospheric heat transport in a single parameter, varying
      from 0 (no atmosphere) to 1 (perfect redistribution). Real atmospheres show complex spatial
      patterns that depend on composition, pressure, and stellar spectrum.</p>`,
    ),
  ].join("");
}

function buildSystemArchitecture() {
  return [
    formula(
      "Titius-Bode Orbit Spacing",
      `<div class="sci-formula__eq">${eq("a_n = \\begin{cases} a_1 & n = 1 \\\\ a_1 + s \\cdot 2^{n-2} & n \\ge 2 \\end{cases}")}</div>
      <p>Geometric sequence of orbital slots generalising the Titius-Bode law. Spacing factor ${iq("s")} is user-adjustable.</p>`,
    ),

    formula(
      "Frost Line",
      `<div class="sci-formula__eq">${eq("d_{\\text{frost}} = 4.85 \\sqrt{L} \\text{ AU}")}</div>
      <p>Distance at which water ice is stable, derived from the equilibrium temperature condition (~170 K).</p>`,
    ),

    formula(
      "System Inner Limit (Roche)",
      `<div class="sci-formula__eq">${eq("d_{\\text{inner}} = \\frac{2.455 \\cdot R_\\star \\cdot (\\rho_\\star / 5400)^{1/3}}{1 \\text{ AU}}")}</div>
      <p>Fluid Roche limit for the closest orbit a body can occupy without tidal disruption. Reference density 5,400 kg/m&sup3;.</p>`,
    ),
  ].join("");
}

/* ── Calculator wiring ───────────────────────────────────────── */

function calcRadiusAndDensity(mass, cmfPct) {
  const cmf = cmfPct / 100;
  const lnM = Math.log(Math.max(mass, 1e-6));
  const alpha = Math.min(1 / 3, 0.257 - 0.0161 * lnM);
  const R = (1.07 - 0.21 * cmf) * Math.pow(mass, alpha);
  const rho = (mass * 5.51) / Math.pow(R, 3);
  return { R, rho };
}

function wireCalculators(root) {
  /* 1 — Mass-Luminosity */
  const mlrMass = root.querySelector("#sci-mlr-mass");
  const mlrSlider = root.querySelector("#sci-mlr-slider");
  const mlrResult = root.querySelector("#sci-mlr-result");
  if (mlrMass && mlrSlider && mlrResult) {
    const update = () => {
      const L = massToLuminosity(Number(mlrMass.value));
      mlrResult.textContent = `${fmt(L, 4)} L\u2609`;
    };
    bindNumberAndSlider({
      numberEl: mlrMass,
      sliderEl: mlrSlider,
      min: 0.075,
      max: 100,
      step: 0.01,
      mode: "log",
    });
    mlrMass.addEventListener("input", update);
    mlrSlider.addEventListener("input", () => {
      mlrMass.dispatchEvent(new Event("input"));
    });
    update();
  }

  /* 2 — Habitable Zone */
  const hzMass = root.querySelector("#sci-hz-mass");
  const hzSlider = root.querySelector("#sci-hz-slider");
  const hzResult = root.querySelector("#sci-hz-result");
  if (hzMass && hzSlider && hzResult) {
    const update = () => {
      const m = Number(hzMass.value);
      const L = massToLuminosity(m);
      const teff = estimateHabitableTeffKFromMass(m);
      const hz = calcHabitableZoneAu({ luminosityLsol: L, teffK: teff });
      renderScienceText(hzResult, `${fmt(hz.innerAu, 2)} – ${fmt(hz.outerAu, 2)} AU`);
    };
    bindNumberAndSlider({
      numberEl: hzMass,
      sliderEl: hzSlider,
      min: 0.075,
      max: 100,
      step: 0.01,
      mode: "log",
    });
    hzMass.addEventListener("input", update);
    hzSlider.addEventListener("input", () => {
      hzMass.dispatchEvent(new Event("input"));
    });
    update();
  }

  /* 3 — Planet Density */
  const densMass = root.querySelector("#sci-dens-mass");
  const densMSlider = root.querySelector("#sci-dens-mass-slider");
  const densCmf = root.querySelector("#sci-dens-cmf");
  const densCSlider = root.querySelector("#sci-dens-cmf-slider");
  const densResult = root.querySelector("#sci-dens-result");
  if (densMass && densMSlider && densCmf && densCSlider && densResult) {
    const update = () => {
      const { R, rho } = calcRadiusAndDensity(Number(densMass.value), Number(densCmf.value));
      renderScienceText(densResult, `${fmt(R, 3)} R⊕ — ${fmt(rho, 2)} g/cm³`);
    };
    bindNumberAndSlider({
      numberEl: densMass,
      sliderEl: densMSlider,
      min: 0.01,
      max: 100,
      step: 0.01,
      mode: "log",
    });
    bindNumberAndSlider({
      numberEl: densCmf,
      sliderEl: densCSlider,
      min: 0,
      max: 100,
      step: 1,
      mode: "linear",
    });
    [densMass, densMSlider, densCmf, densCSlider].forEach((el) =>
      el.addEventListener("input", update),
    );
    update();
  }

  /* 4 — Body Absolute Magnitude */
  const hmagRad = root.querySelector("#sci-hmag-rad");
  const hmagAlb = root.querySelector("#sci-hmag-alb");
  const hmagAlbSlider = root.querySelector("#sci-hmag-alb-slider");
  const hmagResult = root.querySelector("#sci-hmag-result");
  if (hmagRad && hmagAlb && hmagResult) {
    const update = () => {
      const r = Number(hmagRad.value);
      const a = Number(hmagAlb.value);
      if (r > 0 && a > 0) {
        const H = calcBodyAbsoluteMagnitude({
          radiusKm: r,
          geometricAlbedo: a,
        });
        hmagResult.textContent = `H = ${fmt(H, 2)}`;
      }
    };
    if (hmagAlbSlider) {
      bindNumberAndSlider({
        numberEl: hmagAlb,
        sliderEl: hmagAlbSlider,
        min: 0.01,
        max: 1,
        step: 0.01,
        mode: "linear",
      });
    }
    [hmagRad, hmagAlb].forEach((el) => el.addEventListener("input", update));
    if (hmagAlbSlider) hmagAlbSlider.addEventListener("input", update);
    update();
  }

  /* 5 — Flare Rate */
  const flareTemp = root.querySelector("#sci-flare-temp");
  const flareTSlider = root.querySelector("#sci-flare-temp-slider");
  const flareAge = root.querySelector("#sci-flare-age");
  const flareASlider = root.querySelector("#sci-flare-age-slider");
  const flareResult = root.querySelector("#sci-flare-result");
  if (flareTemp && flareAge && flareResult) {
    const update = () => {
      const params = computeFlareParams({
        teffK: Number(flareTemp.value),
        ageGyr: Number(flareAge.value),
      });
      renderScienceFlareResult(flareResult, {
        countLabel: "32",
        countValue: params.N32,
        alphaValue: params.alpha,
      });
    };
    if (flareTSlider)
      bindNumberAndSlider({
        numberEl: flareTemp,
        sliderEl: flareTSlider,
        min: 2000,
        max: 10000,
        step: 100,
        mode: "linear",
      });
    if (flareASlider)
      bindNumberAndSlider({
        numberEl: flareAge,
        sliderEl: flareASlider,
        min: 0.01,
        max: 13,
        step: 0.1,
        mode: "linear",
      });
    [flareTemp, flareTSlider, flareAge, flareASlider]
      .filter(Boolean)
      .forEach((el) => el.addEventListener("input", update));
    update();
  }

  /* 6 — Continued-Fraction Leap Cycles */
  const leapLen = root.querySelector("#sci-leap-len");
  const leapResult = root.querySelector("#sci-leap-result");
  if (leapLen && leapResult) {
    /* Convert a decimal ≈ p/q to the simplest fraction within 1e-9 tolerance */
    const toFraction = (x) => {
      if (x === 0) return { p: 0, q: 1 };
      let bestP = 0,
        bestQ = 1;
      for (let q = 1; q <= 10000; q++) {
        const p = Math.round(x * q);
        if (Math.abs(p / q - x) < 1e-9) {
          bestP = p;
          bestQ = q;
          break;
        }
      }
      return { p: bestP, q: bestQ };
    };
    const update = () => {
      const v = Number(leapLen.value);
      const frac = v - Math.floor(v);
      if (frac < 1e-9) {
        renderScienceLeapCycles(leapResult, [], "No leap cycle needed (integer year)");
        return;
      }
      const approx = continuedFractionApproximants(frac, 6);
      /* Skip the first entry (always 0 = no intercalation) */
      const fractions = approx
        .slice(1)
        .map(toFraction)
        .filter((f) => f.q > 0);
      if (fractions.length === 0) {
        renderScienceLeapCycles(leapResult, [], "No usable cycle found");
        return;
      }
      renderScienceLeapCycles(
        leapResult,
        fractions.map((f) => {
          const error = Math.abs(f.p / f.q - frac);
          const driftYears = error > 1e-12 ? Math.round(1 / error) : Infinity;
          const driftStr =
            driftYears === Infinity ? "exact" : `~1 day drift per ${fmt(driftYears, 0)} yr`;
          return {
            fraction: `${f.p}/${f.q}`,
            description: `${f.p} leap day${f.p !== 1 ? "s" : ""} every ${f.q} years (${driftStr})`,
          };
        }),
      );
    };
    leapLen.addEventListener("input", update);
    update();
  }

  /* 7 — GHZ Probability */
  const ghzR = root.querySelector("#sci-ghz-r");
  const ghzLoc = root.querySelector("#sci-ghz-loc");
  const ghzResult = root.querySelector("#sci-ghz-result");
  if (ghzR && ghzLoc && ghzResult) {
    const update = () => {
      const R = Number(ghzR.value);
      const r = Number(ghzLoc.value);
      const peak = 0.53 * R;
      const sigma = 0.1 * R;
      const p = Math.exp(-0.5 * Math.pow((r - peak) / sigma, 2));
      const inBand = r >= 0.47 * R && r <= 0.6 * R;
      renderScienceText(ghzResult, `${fmt(p * 100, 1)}%${inBand ? " (in hard band)" : ""}`);
    };
    [ghzR, ghzLoc].forEach((el) => el.addEventListener("input", update));
    update();
  }

  /* 8 — Tectonics: Gravity → Mountain & Volcano Heights */
  const tecGrav = root.querySelector("#sci-tec-grav");
  const tecGravSlider = root.querySelector("#sci-tec-grav-slider");
  const tecMtn = root.querySelector("#sci-tec-mtn");
  const tecShield = root.querySelector("#sci-tec-shield");
  const tecRoot = root.querySelector("#sci-tec-root");
  if (tecGrav && tecGravSlider && tecMtn && tecShield && tecRoot) {
    const update = () => {
      const g = Number(tecGrav.value);
      if (g > 0) {
        tecMtn.textContent = `${fmt(maxPeakHeight(g), 0)} m`;
        tecShield.textContent = `${fmt(maxShieldHeight(g), 0)} m`;
        tecRoot.textContent = `${fmt(airyRootDepth(5000), 0)} m`;
      }
    };
    bindNumberAndSlider({
      numberEl: tecGrav,
      sliderEl: tecGravSlider,
      min: 0.05,
      max: 5,
      step: 0.01,
      mode: "log",
    });
    tecGrav.addEventListener("input", update);
    tecGravSlider.addEventListener("input", () => {
      tecGrav.dispatchEvent(new Event("input"));
    });
    update();
  }
}

/* ── Main init ───────────────────────────────────────────────── */

const SECTIONS = [
  { id: "stellar", title: "Stellar Physics", count: 8, builder: buildStellarPhysics },
  { id: "evolution", title: "Stellar Evolution", count: 7, builder: buildStellarEvolution },
  { id: "planetary", title: "Planetary Physics", count: 11, builder: buildPlanetaryPhysics },
  { id: "gasgiant", title: "Gas Giant Physics", count: 13, builder: buildGasGiantPhysics },
  {
    id: "interior",
    title: "Interior &amp; Composition",
    count: 7,
    builder: buildInteriorComposition,
  },
  {
    id: "tectonics",
    title: "Tectonics &amp; Geodynamics",
    count: 14,
    builder: buildTectonicsScience,
  },
  { id: "orbital", title: "Orbital Mechanics", count: 13, builder: buildOrbitalMechanics },
  { id: "lagrange", title: "Lagrange Points", count: 4, builder: buildLagrangePoints },
  { id: "photometry", title: "Photometry &amp; Magnitudes", count: 8, builder: buildPhotometry },
  { id: "atmosphere", title: "Atmosphere &amp; Colour", count: 9, builder: buildAtmosphereColour },
  { id: "climate", title: "Climate Classification", count: 7, builder: buildClimateClassification },
  { id: "activity", title: "Stellar Activity", count: 7, builder: buildStellarActivity },
  { id: "calendar", title: "Calendar Systems", count: 5, builder: buildCalendarSystems },
  { id: "cluster", title: "Local Cluster", count: 7, builder: buildLocalCluster },
  { id: "population", title: "Population Dynamics", count: 5, builder: buildPopulationDynamics },
  { id: "system", title: "System Architecture", count: 3, builder: buildSystemArchitecture },
  { id: "debris", title: "Debris Disks", count: 9, builder: buildDebrisDisks },
  {
    id: "divergences",
    title: "Divergences from Published Science",
    count: 35,
    builder: buildDivergences,
  },
];

export function initSciencePage(mountEl) {
  const wrap = document.createElement("div");
  wrap.className = "page";

  const tocHtml = SECTIONS.map(
    (s) => `<a class="sci-toc__link" data-target="sci-${s.id}" href="#sci-${s.id}">${s.title}</a>`,
  ).join("");

  const sectionsHtml = SECTIONS.map(
    (s, i) =>
      `<details class="sci-section" id="sci-${s.id}"${i === 0 ? " open" : ""}>
        <summary class="sci-section__summary">
          <span class="sci-section__title">${s.title}</span>
          <span class="sci-section__count">${s.count} equations</span>
        </summary>
        <div class="sci-section__body">${s.builder()}</div>
      </details>`,
  ).join("");

  wrap.innerHTML = `
    <div class="panel">
      <div class="panel__header">
        <h1 class="panel__title">
          <span class="ws-icon icon--science" aria-hidden="true"></span>
          <span>Science &amp; Maths</span>
        </h1>
        <div class="badge">Reference</div>
      </div>
      <div class="panel__body">
        <p>Every calculation in WorldSmith is grounded in published astrophysical
        research. This page documents the formulas, models, and algorithms used
        by the engine, with citations to the original papers. The final section,
        <em>Divergences from Published Science</em>, documents every place where
        WorldSmith uses its own empirical fits or simplifications.</p>
        <div class="sci-toc">${tocHtml}</div>
      </div>
    </div>
    <div class="sci-sections">${sectionsHtml}</div>
  `;

  mountEl.innerHTML = "";
  mountEl.appendChild(wrap);

  /* Accordion: only one section open at a time */
  const allSections = wrap.querySelectorAll(".sci-section");
  allSections.forEach((det) => {
    det.addEventListener("toggle", () => {
      if (det.open) {
        allSections.forEach((other) => {
          if (other !== det) other.open = false;
        });
      }
    });
  });

  /* TOC click → open section + scroll */
  wrap.querySelectorAll(".sci-toc__link").forEach((link) => {
    link.addEventListener("click", (e) => {
      e.preventDefault();
      const id = link.dataset.target;
      const details = wrap.querySelector(`#${id}`);
      if (details) {
        allSections.forEach((other) => {
          if (other !== details) other.open = false;
        });
        details.open = true;
        details.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    });
  });

  /* Wire calculators */
  wireCalculators(wrap);

  /* Load KaTeX and render equations */
  loadKaTeX().then((katex) => renderAllMath(wrap, katex));
}
