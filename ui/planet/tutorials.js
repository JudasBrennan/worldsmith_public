// SPDX-License-Identifier: MPL-2.0
export const PLANET_TUTORIAL_STEPS = [
  {
    title: "Getting Started",
    body:
      "The Planets page configures rocky planets and gas giants. Select a body " +
      "from the dropdown at the top, or create a new one. Inputs are on the " +
      "left; derived outputs update live on the right.",
  },
  {
    title: "Creating Bodies",
    body:
      "Click New Rocky Planet or New Gas Giant. Assign each body to an orbital " +
      "slot, then give it a name. The Delete button removes the selected body.",
  },
  {
    title: "Mass and Composition",
    body:
      "For rocky planets, set Mass, Core Mass Fraction (CMF), and Water Mass " +
      "Fraction (WMF). The Auto button for CMF derives a value from stellar " +
      "metallicity. Composition class and radius are computed from these.",
  },
  {
    title: "Orbit and Rotation",
    body:
      "Set semi-major axis, eccentricity, inclination, and rotation period. " +
      "These determine year length, tidal locking, and day/night cycles. " +
      "Habitable zone status appears in outputs.",
  },
  {
    title: "Atmosphere",
    body:
      "Set atmospheric pressure and gas composition. Choose a greenhouse mode: " +
      "Core uses CO2/H2O/CH4, Full adds expert gases, Manual lets you set " +
      "the effect directly. Toggle atmospheric escape to model gas loss.",
  },
  {
    title: "Surface and Interior",
    body:
      "Choose a tectonic regime, set mantle oxidation, and configure internal " +
      "heat. Vegetation colours can be auto-derived from star type or set " +
      "manually. These shape the planet's visual appearance.",
  },
  {
    title: "Gas Giants",
    body:
      "Gas giants use radius as the primary input; mass and metallicity can be " +
      "auto-derived. Sudarsky class, ring type, and atmospheric bands are " +
      "computed from temperature and composition.",
  },
  {
    title: "Recipes",
    body:
      "Click Recipes on the appearance preview to apply preset configurations. " +
      "Recipes set multiple inputs at once for quick planet archetypes like " +
      "ocean worlds, desert planets, or ice giants.",
  },
];
