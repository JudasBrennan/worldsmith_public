# Changelog

All notable changes to WorldSmith Web will be documented in this file.

## 1.9.1

### Cluster Import

**Paste-to-import for Local Cluster** (ui/localClusterPage.js)

Added an Import Cluster panel to the Local Cluster page. Users can
paste a tab-separated table of star systems (name, coordinates,
distance, constituents) to replace the generated neighbourhood with
custom data.

The parser handles:

- Tab-separated columns with optional header row
- Coordinates in `(x, y, z)` format
- Spectral types: main sequence (F9V, MV, KV), giants (MIII),
  brown dwarfs (L, T), white dwarfs (D)
- Multi-star systems via `+` separator (e.g. `MV + MV`, `L + L + T`)
- Trailing notes stripped (e.g. `MIII, originally GV`)
- Home system auto-detected from `(0, 0, 0)` coordinates
- Neighbourhood radius auto-expanded to fit farthest system
- System names preserved (including Unicode)

## 1.9.0

### Tidal Heating

**Wisdom (2008) eccentricity-accurate tidal dissipation model**
(engine/moon.js, ui/moonPage.js, ui/sciencePage.js)

Added a full tidal heating calculation for moons using the standard
Peale, Cassen & Reynolds (1979) formula with the Wisdom (2004/2008)
eccentricity function replacing the simple e² truncation:

    Ė = (21/2)(k₂/Q)(G M_p² R_m⁵ n / a⁶) · f(e)

The eccentricity function f(e) uses a polynomial series accurate to
<0.1% for e < 0.8, giving correct heating at high eccentricities
where the e² truncation underestimates by 5× at e=0.3 and 30× at
e=0.5.

Love number k₂ and quality factor Q are derived from bulk density
via a 10-point interpolation table spanning 0.5–8.0 g/cm³, with
rigidity interpolated in log-space for physical accuracy.

Outputs include total power (W), surface heat flux (W/m²), and flux
normalised to Earth's mean geothermal heat (0.09 W/m²).

### Composition Override System

**Interior-state-aware material properties** (engine/moon.js,
ui/moonPage.js, ui/store.js)

Bulk density is a reliable proxy for cold, geologically quiet moons,
but systematically underestimates heating for bodies with extreme
interiors. Two calibrated override classes address this:

| Class            | μ (GPa) | Q   | Calibration target | Accuracy |
| ---------------- | ------- | --- | ------------------ | -------- |
| Partially molten | 10      | 10  | Io (10¹⁴ W)        | ~1%      |
| Subsurface ocean | 0.3     | 2   | Enceladus (10¹⁰ W) | ~10%     |

A composition override dropdown on the Moon page allows users to
select from seven classes: Very icy, Icy, Mixed rock/ice, Rocky,
Iron-rich, Subsurface ocean, and Partially molten. "Auto (from
density)" is the default.

### Tidal Recession

**Orbital migration rate and fate** (engine/moon.js, ui/moonPage.js)

Computes da/dt from two competing tidal torques using the constant-
time-lag model (Leconte et al. 2010):

- **Planet tide** — when the planet spins faster than the moon
  orbits, angular momentum transfers outward (Earth–Moon: +3.8 cm/yr)
- **Moon tide** — eccentricity damping always drives inward migration

Linear extrapolation estimates time to Roche limit (inward) or Hill
sphere escape (outward). Output includes recession rate (cm/yr),
direction, and orbital fate.

### Solar System Validation

**NASA reference data and validation suite** (references/,
scripts/tidal-heating-validation.mjs)

Added 14 NASA factsheet reference files compiled from JPL Solar
System Dynamics and science.nasa.gov, covering the Sun, all eight
planets, Earth's Moon, the four Galilean satellites, Saturn's major
moons, and Triton.

A validation script tests WorldSmith predictions against observed
Solar System values:

| Body           | Override         | Predicted / Observed     |
| -------------- | ---------------- | ------------------------ |
| Io             | Partially molten | 1.01×                    |
| Enceladus      | Subsurface ocean | 1.11×                    |
| Europa         | —                | 1.42×                    |
| Earth's Moon   | —                | 0.91×                    |
| Moon recession | —                | 0.90× (3.5 vs 3.8 cm/yr) |

### Science Page Updates

**Two new equations** (ui/sciencePage.js)

Added Tidal Heating and Tidal Recession formulas to the Orbital
Mechanics section with full variable legends, the composition class
table, calibration rationale, and validation summary. The science
page now documents 66 equations across ten sections.

### Moon Page Enhancements

**New outputs and tooltips** (ui/moonPage.js)

- Six new KPI cards: Tidal Heating (total power, surface flux, Earth
  comparison), Orbital Recession (rate, direction), and Orbital Fate
- Expanded tooltips for Composition and Composition Override
  explaining the physical meaning of each class, when to use each
  override, calibration notes, and caveats

**Tests** (tests/moon.test.js)

- 36 moon tests total (up from 20), including:
- Io tidal heating ~10¹⁴ W order of magnitude
- Enceladus with Subsurface ocean matches ~1.6×10¹⁰ W
- Higher-order e: e=0.3 produces much more heating than e² truncation
- Earth–Moon recession ≈ 3.8 cm/yr outward
- Fast/slow planet spin → outward/inward recession
- Composition override uses correct μ/Q values
- Override null falls back to density-derived

**References**

- Peale, S. J., Cassen, P. & Reynolds, R. T. (1979), "Melting of Io
  by Tidal Dissipation", Science 203, 892–894
- Wisdom, J. (2004), "Spin-Orbit Secondary Resonance Dynamics of
  Enceladus", AJ 128, 484–491
- Wisdom, J. (2008), "Tidal dissipation at arbitrary eccentricity and
  obliquity", Icarus 193, 637–640
- Leconte, J. et al. (2010), "Tidal dissipation within hot Jupiters:
  a new appraisal", A&A 516, A64

## 1.8.1

### Atmospheric System & Greenhouse Effect Overhaul

**Three-mode greenhouse calculation** (engine/planet.js, ui/planetPage.js)

Overhauled the rocky planet atmospheric system with a new tiered
greenhouse effect model:

- **Core mode** — Derives the greenhouse optical depth (tau) from
  atmospheric composition using species-specific absorption
  coefficients for CO2, H2O, CH4, and H2-N2 collision-induced
  absorption (CIA). Includes cross-suppression logic: H2O contribution
  is reduced in CO2-dominated atmospheres (Venus-like), and SO2 is
  suppressed under high CO2 partial pressures.
- **Full mode** — Extends Core with additional trace gases (SO2, NH3,
  H2, He) for fine-grained control over exotic atmospheres.
- **Manual mode** — Bypasses all gas-based calculation and applies a
  user-specified greenhouse effect value directly.

Gas balance enforces physical consistency: the nine tracked gases
(N2, O2, CO2, Ar, H2O, CH4, SO2, NH3, He) always sum to 100%, with
N2 acting as the remainder gas.

### Sol Preset NASA Corrections

**Cross-referenced against NASA Planetary Fact Sheet**
(ui/solPreset.js, tests/importExport.test.js)

All Sol preset values audited and corrected to match the NASA
Planetary Fact Sheet:

| Body    | Field           | Old      | New       |
| ------- | --------------- | -------- | --------- |
| Mercury | Axial tilt      | 0.03°    | 0.034°    |
| Venus   | Eccentricity    | 0.0068   | 0.0067    |
| Venus   | Rotation period | 5832.0h  | 5832.5h   |
| Venus   | Argon %         | 3.5%     | 0.007%    |
| Earth   | Rotation period | 24.0h    | 23.934h   |
| Mars    | Eccentricity    | 0.0934   | 0.0935    |
| Mars    | O2 %            | 0.13%    | 0.146%    |
| Mars    | CO2 %           | 95.3%    | 95.32%    |
| Jupiter | Semi-major axis | 5.20 AU  | 5.203 AU  |
| Saturn  | Semi-major axis | 9.58 AU  | 9.583 AU  |
| Saturn  | Radius          | 0.84 Rj  | 0.843 Rj  |
| Uranus  | Semi-major axis | 19.2 AU  | 19.19 AU  |
| Uranus  | Radius          | 0.36 Rj  | 0.357 Rj  |
| Uranus  | Mass            | 0.046 Mj | 0.0457 Mj |
| Neptune | Semi-major axis | 30.05 AU | 30.07 AU  |
| Neptune | Radius          | 0.35 Rj  | 0.346 Rj  |

### Local Cluster Manual Editing

**Add/remove stars and companions** (ui/localClusterPage.js,
ui/store.js, ui/vizClusterRenderer.js, styles.css)

Added interactive editing to the Local Cluster page:

- **Random seed button** — generates a new random seed and
  regenerates the cluster in one click.
- **+/− buttons** on the Stellar Object Breakdown table — manually
  add or remove systems of any spectral class. Added systems receive
  random coordinates within the neighbourhood sphere (cube-root
  uniform-in-volume sampling with disk z-compression).
- **Right-click context menu** on the Star System Coordinates table —
  add or remove companion stars to change system multiplicity
  (single → binary → triple → quadruple, max 4 components). Users
  select the companion's spectral class from a visual menu.
- **Confirmation prompt** — Apply, Randomise, and Reset actions warn
  the user before discarding manual adjustments.
- **Visualiser sync** — manually added or modified systems appear
  correctly in the 3D cluster visualiser.

Adjustments are stored as a layered data model
(`clusterAdjustments`) on top of the engine-generated baseline and
persist across page navigation. They are cleared when Apply or Reset
regenerates the cluster from seed.

## 1.8.0

### Sky Colour Calculations

**Gravity, temperature, and CO₂ corrections** (engine/planet.js,
ui/planetPage.js)

Sky colours now account for atmospheric column density via scale height.
Lower gravity or higher surface temperature increases the column depth,
shifting colours toward thicker-atmosphere look-up table entries.
CO₂-rich atmospheres receive a warm amber tint, with strength
proportional to the square root of CO₂ fraction (perceptually gradual
curve, negligible at Earth-like 0.04%).

Effective pressure is computed as:

    P_eff = P_surface × (T / T⊕) × (g⊕ / g)

Colour interpolation uses OKLab space for perceptual uniformity. Two
KPI cards display the results: "Sky Colour (Sun High)" and "Sky Colour
(Low Sun)", each with a radial gradient swatch and hex value.

**References**

- PanoptesV radiative-transfer simulations
  (panoptesv.com/SciFi/ColorsOfAlienWorlds/AlienSkies.php)
- Bjorn Ottosson (2020), "A perceptual color space for image
  processing" (OKLab)

### Vegetation Colours (0.1–100 atm)

**Pressure-dependent plant colour range with tidally locked variants**
(engine/planet.js, ui/planetPage.js)

Plant colours now span 0.1 to 100 atm via log-pressure interpolation
across a two-dimensional look-up table keyed by spectral class (A0–M9)
and pressure (1, 3, 10 atm anchors). Below 1 atm the 1→3 atm trend is
reversed with 50% dampening; above 10 atm the 3→10 atm trend continues
with 50% dampening.

Tidally locked planets orbiting K- and M-class stars receive dedicated
twilight-adapted vegetation variants — paler, more tan/brown colours
reflecting permanent terminator-zone conditions where plants receive
only scattered and refracted starlight. An insolation-darkening factor
is applied to all variants: low-light environments favour
broader-spectrum absorption (darker pigments).

Output is a 6-stop gradient from pale to deep, with a Details button
revealing the full colour breakdown on hover.

**References**

- Kiang, N. Y. et al. (2007), "Spectral Signatures of Photosynthesis.
  II. Coevolution with Other Stars and the Atmosphere on Extrasolar
  Worlds", Astrobiology 7, 252–274
- Lehmer, O. R. et al. (2021), "Peak Absorbance Wavelength of
  Photosynthetic Pigments Around Other Stars From Spectral Optimization",
  Frontiers in Astronomy and Space Sciences 8, 689441
- Arp, T. B. et al. (2020), "Quieting a Noisy Antenna Reproduces
  Photosynthetic Light-Harvesting Spectra", Science 368, 1490–1495

### Science & Maths Reference Page

**New page** (ui/sciencePage.js)

A comprehensive reference documenting all 61 equations used across the
engine, organised into nine sections: Stellar Physics, Planetary
Physics, Orbital Mechanics, Photometry & Magnitudes, Atmosphere &
Colour, Stellar Activity, Calendar Systems, Local Cluster, and System
Architecture.

Each equation includes:

- LaTeX-rendered formula (via KaTeX, loaded on demand from CDN)
- Variable legend with units
- Plain-language explanation and calibration notes
- Citation to the originating paper or textbook

Seven interactive calculators are embedded for live exploration:
mass-to-luminosity, habitable zone, planet density, H-magnitude, flare
rate, leap cycles, and galactic habitable zone probability.

### Planet Temperature Accuracy

**Scaled surface divisor and recalibrated Sol preset**
(engine/planet.js, ui/solPreset.js)

The four-step temperature chain (Stefan-Boltzmann energy balance →
Eddington grey-atmosphere greenhouse → surface correction → fourth-root
recovery) is unchanged in structure, but the surface divisor — which
accounts for the temperature difference between the atmospheric
effective-emission level and the surface — now ramps with optical depth
instead of being a flat 0.9:

    surfDiv = 1 − (1 − 0.9) × min(τ, 1)

This gives 1.0 for airless bodies (τ = 0) and 0.9 for Earth-like or
thicker atmospheres (τ ≥ 1). The old flat divisor inflated airless-body
temperatures by ~2.7% (e.g. Mercury: +12 K, Mars: +7 K).

Sol preset values recalibrated against NASA Planetary Fact Sheet data:

| Planet  | Old GH | New GH | Model | NASA  | Error |
| ------- | ------ | ------ | ----- | ----- | ----- |
| Mercury | 0.0    | 0.0    | 440 K | 440 K | 0 K   |
| Venus   | 200.0  | 217.0  | 737 K | 737 K | 0 K   |
| Earth   | 1.65   | 1.19   | 288 K | 288 K | 0 K   |
| Mars    | 0.15   | 0.05   | 211 K | 210 K | +1 K  |

Bond albedos also updated to match NASA values (Mercury: 0.088 → 0.068,
Venus: 0.77 → 0.76).

### General UI Improvements

**Expandable KPI cards** (styles.css, all page files)

KPI output cards now expand on hover to reveal additional detail. The
card itself grows — background, borders, and gradients extend seamlessly
with the content. A `.kpi-wrap` container holds the grid slot while the
inner card lifts to `position: absolute`, overlaying neighbours without
pushing content below. A chevron indicator marks cards with hidden
detail. Closing is instant (no transition) to prevent layout shift.

**Contrast-aware text** (engine/utils.js, ui/planetPage.js,
ui/starPage.js)

Text colour on colour-swatch KPIs (sky colour, vegetation, star colour)
now automatically switches between dark and light based on WCAG 2.0
relative luminance of the background. A `data-light` attribute is
computed from `relativeLuminance(hex)` at a threshold of 0.18, and CSS
rules adjust label, value, meta, tooltip, and chevron colours
accordingly.

**Unified outputs and tooltips** (all page files)

Tooltip dictionaries expanded across all pages to cover new features
(gravity correction, CO₂ tint, twilight variants, greenhouse effect,
atmospheric composition). Engine files received JSDoc headers and
`@param`/`@returns` documentation for all exported functions.

## 1.7.0

### Unified Visualiser

The System Visualiser and Local Cluster Visualiser are now a single page.
Zoom out past the outermost system object and the view seamlessly transitions
into the 3D local stellar neighbourhood — no page navigation required. Zoom
back into the home star to return to the system view.

- **Single canvas, two modes** — the draw loop dispatches to either the system
  renderer or the cluster renderer based on the current mode. Controls in the
  dropdown swap dynamically (system toggles vs cluster toggles).
- **Zoom-based transitions** — shrink → mode switch → expand animation plays
  entirely on one canvas. A progress bar appears at the bottom as you
  approach the transition threshold.
- **First-load toast** — "Tip: Zoom out past the system to view your local
  stellar neighbourhood" appears until the user completes the transition once
  (tracked in localStorage).
- **Representative body zoom scaling** — planets, gas giants, and moons now
  grow proportionally as you zoom in on representative scale (zoom^0.4
  factor). Physical-scale mode is unchanged.
- Navigation consolidated: both top-nav and side-nav now show a single
  "Visualiser" entry instead of separate System / Cluster links.
- Cluster rendering extracted into `ui/vizClusterRenderer.js` as pure
  functions (no closure dependencies on page state).

### Stellar Metallicity [Fe/H]

**New input** (engine/star.js, ui/starPage.js)

Added stellar metallicity [Fe/H] as a worldbuilding input — a slider ranging
from −3.0 (extreme metal-poor halo) to +1.0 (super-metal-rich), defaulting to
0.0 (solar). Metallicity does not modify the Eker mass–luminosity or
mass–radius relations (their empirical scatter already includes metallicity
variation). Instead it drives two new downstream outputs:

- **Giant Planet Probability** — Fischer & Valenti (2005, ApJ 622, 1102)
  scaling: P = 10% × 10^(2·[Fe/H]). At solar metallicity the probability is
  ~10%; at [Fe/H] = +0.3 it rises to ~40%; at [Fe/H] = −0.5 it drops to ~1%.
  Baseline from Cumming et al. (2008, PASP 120, 531).
- **Stellar Population label** — Pop I (solar neighbourhood), Intermediate
  (old thin disk), Pop II (metal-poor halo/thick disk), or Metal-rich (inner
  disk).

Both appear as KPI cards in the Star page outputs panel.

**References**

- Fischer, D. A. & Valenti, J. (2005), "The Planet–Metallicity Correlation",
  ApJ 622, 1102–1117
- Cumming, A. et al. (2008), "The Keck Planet Search: Detectability and the
  Minimum Mass and Orbital Period Distribution of Extrasolar Planets", PASP
  120, 531–554

### Star Generation — Scientific Accuracy Overhaul

**Mass-Luminosity Relation** (engine/star.js)

Replaced the classical textbook three-piece approximation (L = 0.23 M^2.3 /
M^4 / 1.4 M^3.5) with the Eker et al. (2018, MNRAS 479, 5491) six-piece
empirical relation, calibrated from 509 detached eclipsing binary components.

The old formula significantly overestimated luminosity for K-dwarf and low-mass
M-dwarf stars — by 33–86% in the 0.5–0.9 Msol range — which cascaded to:

- Maximum age underestimated by 25–46% (e.g. a 0.70 Msol K5V star showed
  ~29 Gyr instead of ~46 Gyr)
- Habitable zone pushed ~25% too far out (HZ scales as sqrt(L))
- Effective temperature and spectral class off by ~1 subtype for K dwarfs

The new relation uses Eker's published exponents with coefficients adjusted to
enforce continuity at each mass boundary and to anchor L = 1.0 at M = 1.0 Msol
(all adjustments within Eker's quoted uncertainties).

| Segment                   | Mass range     | Exponent (alpha) |
| ------------------------- | -------------- | ---------------- |
| Fully convective M dwarfs | < 0.45 Msol    | 2.028            |
| Late-K / early-M          | 0.45–0.72 Msol | 4.572            |
| Solar-type (G/K)          | 0.72–1.05 Msol | 5.743            |
| F/A stars                 | 1.05–2.40 Msol | 4.329            |
| B stars                   | 2.40–7.0 Msol  | 3.967            |
| O / early-B               | > 7.0 Msol     | 2.865            |

**Mass-Radius Relation** (engine/star.js)

Replaced the simple power-law (R = M^0.8 for M < 1, R = M^0.57 for M >= 1)
with:

- M <= 1.0 Msol: Eker et al. (2018) quadratic from eclipsing binaries
  (R = 0.438 M^2 + 0.479 M + 0.075, normalised to R = 1.0 at M = 1.0)
- M > 1.0 Msol: R = M^0.57 (Demircan & Kahraman 1991), continuous at boundary

The quadratic improves radius accuracy for K dwarfs (e.g. Alpha Centauri B
error drops from +8% to +2%).

**Tooltips** (ui/starPage.js)

Updated Luminosity, Radius, Maximum Age, and override tooltips to cite the
Eker et al. (2018) source and explain the derivation method.

**Tests** (tests/star.test.js)

- Replaced old formula-branch tests with new Eker segment verification tests
- Added MLR continuity test across all 5 segment boundaries
- Added MLR monotonicity test across full mass range
- Added MRR continuity test at M = 1.0 boundary
- Added benchmark star accuracy tests: 61 Cyg A, epsilon Eridani, Alpha Cen A/B,
  Sirius A (all within 15% of observed luminosities; most within 10%)

**References**

- Eker, Z. et al. (2018), "Interrelated main-sequence mass–luminosity,
  mass–radius and mass–effective temperature relations", MNRAS 479, 5491–5511.
  arXiv:1807.02568
- Demircan, O. & Kahraman, G. (1991), "Stellar mass-luminosity and
  mass-radius relations", Ap&SS 181, 313–322
