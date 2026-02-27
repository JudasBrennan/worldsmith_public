function norm(value) {
  return String(value || "")
    .trim()
    .toLowerCase();
}

export function gasAssetPath(styleId) {
  const key = norm(styleId) || "jupiter";
  return `./assets/three-renders/gas/${encodeURIComponent(key)}.svg`;
}

export function rockyAssetPath(profile) {
  if (!profile) return "./assets/three-renders/rocky/default.svg";

  if (profile.special === "lava") return "./assets/three-renders/rocky/lava-world.svg";
  if (profile.special === "frozen") return "./assets/three-renders/rocky/frozen.svg";
  if ((profile.iceCaps?.north || 0) + (profile.iceCaps?.south || 0) > 0.9) {
    return "./assets/three-renders/rocky/snowball.svg";
  }
  if ((profile.ocean?.coverage || 0) > 0.9) return "./assets/three-renders/rocky/water-world.svg";
  if ((profile.ocean?.coverage || 0) > 0.65) return "./assets/three-renders/rocky/oceanic.svg";
  if ((profile.vegetation?.coverage || 0) > 0.18) {
    return "./assets/three-renders/rocky/tropical-jungle.svg";
  }
  if (profile.terrain?.type === "cratered") return "./assets/three-renders/rocky/cratered-husk.svg";
  if (profile.terrain?.type === "volcanic") return "./assets/three-renders/rocky/volcanic.svg";
  if (profile.tidallyLocked) return "./assets/three-renders/rocky/tidally-locked.svg";
  return "./assets/three-renders/rocky/default.svg";
}

export function moonAssetPath(profile) {
  if (!profile) return "./assets/three-renders/moons/default.svg";
  const klass = norm(profile.displayClass);
  if (klass.includes("very icy") || klass === "icy") return "./assets/three-renders/moons/icy.svg";
  if (klass.includes("dark")) return "./assets/three-renders/moons/dark-icy.svg";
  if (klass.includes("molten")) return "./assets/three-renders/moons/molten.svg";
  if (klass.includes("rocky")) return "./assets/three-renders/moons/rocky.svg";
  if ((profile.iceCoverage || 0) > 0.6) return "./assets/three-renders/moons/icy.svg";
  return "./assets/three-renders/moons/default.svg";
}

export function starAssetPath(tempK) {
  const t = Number(tempK) || 5778;
  if (t >= 30000) return "./assets/three-renders/stars/o.svg";
  if (t >= 10000) return "./assets/three-renders/stars/b.svg";
  if (t >= 7500) return "./assets/three-renders/stars/a.svg";
  if (t >= 6000) return "./assets/three-renders/stars/f.svg";
  if (t >= 5200) return "./assets/three-renders/stars/g.svg";
  if (t >= 3700) return "./assets/three-renders/stars/k.svg";
  return "./assets/three-renders/stars/m.svg";
}

export function debrisAssetPath(label, compositionLabel) {
  const text = `${label || ""} ${compositionLabel || ""}`.toLowerCase();
  if (text.includes("warm")) return "./assets/three-renders/debris/warm-exozodiacal-dust.svg";
  if (text.includes("rocky")) return "./assets/three-renders/debris/rocky-asteroid-belt.svg";
  if (text.includes("icy") || text.includes("kuiper")) {
    return "./assets/three-renders/debris/icy-kuiper-like-belt.svg";
  }
  if (text.includes("metal")) return "./assets/three-renders/debris/metal-rich.svg";
  if (text.includes("carbon")) return "./assets/three-renders/debris/carbon-rich.svg";
  return "./assets/three-renders/debris/extended-halo.svg";
}
