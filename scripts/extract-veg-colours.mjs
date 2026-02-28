/**
 * Extract pale (lightest) and deep (darkest) vegetation hex colours
 * from every PanoptesV leafcolor PNG.
 *
 * Samples non-black pixels, sorts by luminance, picks 10th/90th percentile.
 * Outputs a JSON LUT suitable for engine/planet.js PLANT_LUT_2D.
 */
import fs from "node:fs";
import path from "node:path";
import { PNG } from "pngjs";

const DIR = path.resolve("panoptesv/Colors of Alien Plants_files");

function hexFromRGB(r, g, b) {
  return (
    "#" +
    [r, g, b].map((c) => Math.round(c).toString(16).padStart(2, "0")).join("")
  );
}

function luminance(r, g, b) {
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function extractColours(filePath) {
  const data = fs.readFileSync(filePath);
  const png = PNG.sync.read(data);
  const { width, height } = png;

  // Collect all non-black pixels (ignore the black background)
  const pixels = [];
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      const r = png.data[idx];
      const g = png.data[idx + 1];
      const b = png.data[idx + 2];
      const a = png.data[idx + 3];
      // Skip black background and transparent pixels
      if (a < 128) continue;
      if (r < 8 && g < 8 && b < 8) continue;
      pixels.push({ r, g, b, lum: luminance(r, g, b) });
    }
  }

  if (pixels.length === 0) return { pale: "#000000", deep: "#000000" };

  // Sort by luminance
  pixels.sort((a, b) => a.lum - b.lum);

  // Pick 10th percentile (deep) and 90th percentile (pale)
  const deepIdx = Math.floor(pixels.length * 0.1);
  const paleIdx = Math.floor(pixels.length * 0.9);

  // Average a small window around each percentile for stability
  const windowSize = Math.max(1, Math.floor(pixels.length * 0.02));

  function avgWindow(center) {
    const lo = Math.max(0, center - windowSize);
    const hi = Math.min(pixels.length - 1, center + windowSize);
    let rSum = 0,
      gSum = 0,
      bSum = 0,
      count = 0;
    for (let i = lo; i <= hi; i++) {
      rSum += pixels[i].r;
      gSum += pixels[i].g;
      bSum += pixels[i].b;
      count++;
    }
    return hexFromRGB(rSum / count, gSum / count, bSum / count);
  }

  return {
    pale: avgWindow(paleIdx),
    deep: avgWindow(deepIdx),
  };
}

// Scan all leafcolor PNGs
const files = fs.readdirSync(DIR).filter((f) => f.startsWith("leafcolor_"));

const lut = {};

for (const file of files) {
  // Parse filename: leafcolor_G2_3.png or leafcolor_K0_1_horiz.png
  const match = file.match(/^leafcolor_([A-Z]\d)_(\d+)(_horiz)?\.png$/);
  if (!match) continue;

  const [, spec, atmStr, horiz] = match;
  const atm = Number(atmStr);
  const type = horiz ? "twilight" : "day";

  const colours = extractColours(path.join(DIR, file));

  if (!lut[spec]) lut[spec] = {};
  if (!lut[spec][atm]) lut[spec][atm] = {};
  lut[spec][atm][type] = colours;
}

// Output sorted by spectral class
const specOrder = [
  "A0", "A2", "A5",
  "F0", "F2", "F4", "F6", "F8",
  "G0", "G2", "G4", "G6", "G8",
  "K0", "K2", "K4", "K6", "K8",
  "M0", "M2", "M4", "M6", "M8",
];

console.log("// PanoptesV extracted vegetation colours");
console.log("// Format: { spectralClass: { pressure: { day/twilight: { pale, deep } } } }");
console.log("const PANOPTESV_LUT = {");
for (const spec of specOrder) {
  if (!lut[spec]) continue;
  console.log(`  ${spec}: {`);
  for (const atm of [1, 3, 10]) {
    if (!lut[spec][atm]) continue;
    const entry = lut[spec][atm];
    if (entry.day) {
      console.log(
        `    ${atm}: { pale: "${entry.day.pale}", deep: "${entry.day.deep}" },`,
      );
    }
  }
  // Twilight entries
  let hasTwi = false;
  for (const atm of [1, 3, 10]) {
    if (lut[spec]?.[atm]?.twilight) {
      if (!hasTwi) {
        console.log(`    twilight: {`);
        hasTwi = true;
      }
      const t = lut[spec][atm].twilight;
      console.log(`      ${atm}: { pale: "${t.pale}", deep: "${t.deep}" },`);
    }
  }
  if (hasTwi) console.log(`    },`);
  console.log(`  },`);
}
console.log("};");
