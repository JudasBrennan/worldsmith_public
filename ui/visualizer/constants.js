// SPDX-License-Identifier: MPL-2.0
export const VISUALIZER_TIP_LABEL = {
  Labels: "Show or hide text labels for star, planets, moons, gas giants, and debris disks.",
  "Label leader lines": "Show or hide connector lines from labels to the body they describe.",
  Moons: "Show or hide moon markers around planets and gas giants.",
  Orbits: "Show or hide orbital rings for planets, moons, gas giants, and the H2O frost line.",
  "Logarithmic scale":
    "Logarithmic AU spacing for orbital distances. When disabled, distances are shown on a linear scale.",
  "Physical size scale":
    "Representative keeps bodies easy to read. 1:1 scales body radii against the star radius while keeping the star's on-screen size fixed.",
  "Habitable zone": "Show or hide the habitable-zone band (between HZ inner and HZ outer limits).",
  "Debris disks": "Show or hide debris disk bands and asteroid field particles.",
  "Eccentric orbits":
    "When enabled, planet orbits are drawn as ellipses using each planet's saved eccentricity and longitude of periapsis. The planet also moves faster near periapsis and slower near apoapsis (Kepler's second law via the eccentric anomaly).\n\nWhen disabled (default), orbits are drawn as perfect circles - cleaner for typical near-circular worlds.",
  "Pe / Ap markers":
    "Show periapsis (closest approach) and apoapsis (farthest point) markers on eccentric orbits.",
  "Hill spheres":
    "Show the Hill sphere - the gravitational sphere of influence - around each planet and gas giant. Defines the maximum region where stable satellite orbits can exist.",
  "Lagrange points":
    "Show L1-L5 equilibrium positions for each star-body pair. L4 and L5 (leading and trailing Trojans, +/-60 deg) are shown for all bodies; stable points appear in cyan, unstable ones (body exceeds the Gascheau mass limit mu ~= 0.0385) are dimmed in amber. Click a body to reveal all five points including L1/L2 (near the body) and L3 (opposite side of star).",
  "Frost line": "Show the H2O frost line - the distance beyond which water ice can condense.",
  Distances: "Show orbital distance (AU) alongside body name labels.",
  "AU grid": "Draw faint concentric reference rings at round AU intervals for scale.",
  Rotation:
    "Show or hide spin markers on planets and moons (animated from each body's rotation period and axial tilt).",
  "Axial tilt helpers":
    "Show or hide projected spin-axis helper overlays on planets and moons (based on axial tilt).",
  "Click zoom bodies":
    "Click interaction for planets and gas giants. Single-click centres the body; double-click zooms to fit.",
  "Click zoom star":
    "Click interaction for the host star. Single-click centres; double-click zooms in.",
  Debug: "Enable console debug logging for visualiser internals.",
  Speed: "Animation speed in simulated Earth-days per second.",
  Centre: "Resets camera orientation and zoom to the default centred view.",
  Refresh: "Redraws the visualiser using the latest saved world data.",
  Play: "Toggles orbital animation on or off.",
  "Reset view": "Resets zoom and pan back to the default overview.",
  Controls: "Toggle the controls panel for display options, animation, and scale settings.",
  Fullscreen: "Enter browser fullscreen mode for an immersive view.",
  "Download image": "Save a static PNG snapshot of the current canvas view.",
  "Download GIF":
    "Save a short animated GIF from the current canvas. This is available only while animation is playing.",
  "Cluster Labels": "Show or hide name labels on plotted systems.",
  Links: "Draw guide lines from each system to its nearest point on the X/Z plane.",
  Axes: "Show X/Y/Z reference axes.",
  "Range/Bearing Grid": "Show or hide distance rings and degree bearings on the X/Z plane.",
  "Bearing Units": "Switch bearing labels between degrees (360) and mils (6400).",
  Starfield: "Show a background field of distant stars.",
  "Cluster Speed": "Auto-spin speed multiplier.",
};

export const VISUALIZER_TUTORIAL_STEPS = [
  {
    title: "Getting Started",
    body:
      "The Visualiser shows your system in interactive 3D. Left-drag to pan, " +
      "right-drag to rotate, scroll to zoom. Click a body to focus on it; " +
      "double-click to zoom in.",
  },
  {
    title: "Navigation",
    body:
      "Press Escape to release focus on a body. Press ? to see the full " +
      "control reference. The view transitions smoothly between local cluster " +
      "and system scales as you zoom.",
  },
  {
    title: "Display Options",
    body:
      "Toggle orbits, habitable zone, frost line, debris disks, Lagrange " +
      "points, and labels using the Controls panel. Switch between logarithmic " +
      "and linear distance scaling.",
  },
  {
    title: "Animation",
    body:
      "Play or pause orbital animation and adjust the speed multiplier. " +
      "Bodies move along their actual orbits with correct relative periods.",
  },
  {
    title: "Export",
    body:
      "Save a PNG snapshot of the current view, or record a GIF animation. " +
      "Use the fullscreen button for a larger viewport.",
  },
];
