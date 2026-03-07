// SPDX-License-Identifier: MPL-2.0
import { importXlsxModule } from "./runtimeDeps.js";
import { assertImportFileWithinLimit, nextImportTurn } from "./importSafety.js";

let xlsxModulePromise = null;

const DEFAULT_STAR = {
  name: "Star",
  massMsol: 1.0,
  ageGyr: 4.6,
};

const DEFAULT_SYSTEM = {
  spacingFactor: 0.33,
  orbit1Au: 1.0,
};

const DEFAULT_PLANET_INPUTS = {
  name: "New Planet",
  semiMajorAxisAu: 1.0,
  eccentricity: 0.0167,
  inclinationDeg: 0.0,
  longitudeOfPeriapsisDeg: 283.0,
  subsolarLongitudeDeg: 0.0,
  rotationPeriodHours: 24.0,
  axialTiltDeg: 23.44,
  massEarth: 1.0,
  cmfPct: 32.0,
  albedoBond: 0.3,
  greenhouseEffect: 1.65,
  observerHeightM: 1.75,
  pressureAtm: 1.0,
  o2Pct: 20.95,
  co2Pct: 0.04,
  arPct: 0.93,
};

const DEFAULT_MOON_INPUTS = {
  name: "Luna",
  semiMajorAxisKm: 384748,
  eccentricity: 0.055,
  inclinationDeg: 5.15,
  massMoon: 1.0,
  densityGcm3: 3.34,
  albedo: 0.11,
};

const STAR_MAP = {
  massMsol: "C6",
  ageGyr: "C7",
};

const SYSTEM_MAP = {
  spacingFactor: "C13",
  orbit1Au: "C16",
};

const OUTER_GAS_GIANT_CELL = "C37";

const PLANET_MAP = {
  massEarth: "C11",
  cmfPct: "C12",
  axialTiltDeg: "C17",
  albedoBond: "C21",
  greenhouseEffect: "C22",
  observerHeightM: "C26",
  rotationPeriodHours: "C31",
  semiMajorAxisAu: "C32",
  eccentricity: "C33",
  inclinationDeg: "C38",
  longitudeOfPeriapsisDeg: "C40",
  subsolarLongitudeDeg: "C41",
  pressureAtm: "C48",
  o2Pct: "C51",
  co2Pct: "C52",
  arPct: "C53",
};

const MOON_MAP = {
  massMoon: "C21",
  densityGcm3: "C22",
  albedo: "C26",
  semiMajorAxisKm: "C32",
  eccentricity: "C33",
  inclinationDeg: "C36",
};

const SIGNATURES = {
  star: [
    ["B3", ["main", "sequence", "star"]],
    ["B6", ["mass"]],
    ["B7", ["current", "age"]],
  ],
  system: [
    ["B3", ["classical", "planetary", "system"]],
    ["B13", ["spacing", "factor"]],
    ["B16", ["orbit", "1"]],
    ["B37", ["outermost", "gas", "giant"]],
  ],
  planet: [
    ["B9", ["terrestrial", "planet", "physical", "characteristics"]],
    ["B11", ["mass"]],
    ["B12", ["cmf"]],
    ["B32", ["semi", "major", "axis"]],
    ["B48", ["atmospheric", "pressure"]],
    ["B51", ["oxygen"]],
  ],
  moon: [
    ["B19", ["major", "moon", "physical", "characteristics"]],
    ["B21", ["mass"]],
    ["B22", ["density"]],
    ["B26", ["albedo"]],
    ["B32", ["semi", "major", "axis"]],
    ["B36", ["inclination"]],
  ],
};

const TYPE_THRESHOLD = {
  star: 2,
  system: 3,
  planet: 4,
  moon: 4,
};

function normalizeText(value) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function hasTokens(text, tokens) {
  return tokens.every((token) => text.includes(token));
}

function readCellText(ws, addr) {
  const cell = ws?.[String(addr || "").toUpperCase()];
  if (!cell) return "";
  if (typeof cell.w === "string" && cell.w.trim()) return cell.w;
  if (cell.v == null) return "";
  return String(cell.v);
}

function readCellNumber(ws, addr, fallback) {
  const cell = ws?.[String(addr || "").toUpperCase()];
  if (!cell) return fallback;
  if (typeof cell.v === "number" && Number.isFinite(cell.v)) return cell.v;
  const raw = String(cell.v ?? cell.w ?? "")
    .replace(/,/g, "")
    .trim();
  const n = Number(raw);
  return Number.isFinite(n) ? n : fallback;
}

function readMappedNumbers(ws, map, defaults) {
  const out = { ...defaults };
  for (const [key, addr] of Object.entries(map)) {
    out[key] = readCellNumber(ws, addr, defaults[key]);
  }
  return out;
}

function parseNumericTokens(value) {
  const text = String(value ?? "");
  const matches = text.match(/[-+]?\d*\.?\d+(?:[eE][-+]?\d+)?/g) || [];
  return matches.map((m) => Number(m)).filter((n) => Number.isFinite(n));
}

function parseDebrisRangeFromCell(ws) {
  const rawText = readCellText(ws, "C38");
  const nums = parseNumericTokens(rawText);
  if (nums.length >= 2) {
    const lo = Math.min(nums[0], nums[1]);
    const hi = Math.max(nums[0], nums[1]);
    if (hi > 0) return { innerAu: Math.max(0, lo), outerAu: Math.max(0, hi) };
  }
  return null;
}

function readOutermostGasGiantAu(systemWs) {
  if (!systemWs) return 0;
  const v = Number(readCellText(systemWs, OUTER_GAS_GIANT_CELL));
  return Number.isFinite(v) && v > 0 ? v : 0;
}

function scoreSheet(ws, type) {
  const sig = SIGNATURES[type] || [];
  let score = 0;
  for (const [addr, tokens] of sig) {
    const text = normalizeText(readCellText(ws, addr));
    if (text && hasTokens(text, tokens)) score += 1;
  }
  return score;
}

function classifyWorkbook(workbook) {
  const out = { star: [], system: [], planet: [], moon: [] };
  const types = Object.keys(out);
  const sheetNames = Array.isArray(workbook?.SheetNames) ? workbook.SheetNames : [];

  for (let i = 0; i < sheetNames.length; i++) {
    const name = sheetNames[i];
    const ws = workbook.Sheets?.[name];
    if (!ws || typeof ws !== "object") continue;

    const scored = types
      .map((type) => ({ type, score: scoreSheet(ws, type) }))
      .sort((a, b) => b.score - a.score);

    const best = scored[0];
    const second = scored[1];
    if (!best || best.score < TYPE_THRESHOLD[best.type]) continue;
    if (second && second.score === best.score) continue;

    out[best.type].push({
      name,
      index: i,
      score: best.score,
      ws,
    });
  }

  for (const type of types) {
    out[type].sort((a, b) => a.index - b.index);
  }
  return out;
}

function buildPlanets(planetSheets) {
  const order = [];
  const byId = {};
  for (let i = 0; i < planetSheets.length; i++) {
    const id = `p${i + 1}`;
    const name = `Planet ${i + 1}`;
    const ws = planetSheets[i].ws;
    const inputs = readMappedNumbers(ws, PLANET_MAP, DEFAULT_PLANET_INPUTS);
    inputs.name = name;
    byId[id] = {
      id,
      name,
      slotIndex: null,
      locked: false,
      inputs,
    };
    order.push(id);
  }
  return {
    selectedId: order[0] || null,
    order,
    byId,
  };
}

function buildMoons(moonSheets, planetOrder) {
  const order = [];
  const byId = {};
  for (let i = 0; i < moonSheets.length; i++) {
    const id = `m${i + 1}`;
    const name = `Moon ${i + 1}`;
    const ws = moonSheets[i].ws;
    const inputs = readMappedNumbers(ws, MOON_MAP, DEFAULT_MOON_INPUTS);
    inputs.name = name;
    const planetId = planetOrder[i] || planetOrder[0] || null;
    byId[id] = {
      id,
      name,
      planetId,
      locked: false,
      inputs,
    };
    order.push(id);
  }
  return {
    selectedId: order[0] || null,
    order,
    byId,
  };
}

async function loadXlsxModule() {
  if (!xlsxModulePromise) {
    xlsxModulePromise = importXlsxModule().catch((err) => {
      xlsxModulePromise = null;
      throw err;
    });
  }
  return xlsxModulePromise;
}

export function isXlsxFile(file) {
  const name = String(file?.name || "").toLowerCase();
  const type = String(file?.type || "").toLowerCase();
  return name.endsWith(".xlsx") || type.includes("spreadsheetml") || type.includes("vnd.ms-excel");
}

export async function importLegacyWorldsmithWorkbook(file) {
  if (!file) throw new Error("No file selected.");
  assertImportFileWithinLimit(file, "xlsx");
  const { read } = await loadXlsxModule().catch((err) => {
    throw new Error(`Could not load XLSX reader: ${err?.message || err}`);
  });

  let workbook;
  try {
    await nextImportTurn();
    const buffer = await file.arrayBuffer();
    workbook = read(buffer, {
      type: "array",
      cellFormula: false,
      cellStyles: false,
      cellDates: false,
      dense: false,
    });
  } catch (err) {
    throw new Error(`Could not parse XLSX file: ${err?.message || err}`);
  }

  const classified = classifyWorkbook(workbook);
  const errors = [];
  if (!classified.star.length) errors.push("No STAR-like sheet detected.");
  if (!classified.system.length) errors.push("No PLANETARY SYSTEM-like sheet detected.");
  if (!classified.planet.length) errors.push("No PLANET-like sheet detected.");
  if (!classified.moon.length) errors.push("No MOON-like sheet detected.");

  if (errors.length) {
    throw new Error(
      `Workbook is not recognised as WorldSmith 8.x format.\n${errors.join("\n")}\nDetected sheets: star=${classified.star.length}, system=${classified.system.length}, planet=${classified.planet.length}, moon=${classified.moon.length}`,
    );
  }

  const starWs = classified.star[0].ws;
  const systemWs = classified.system[0].ws;

  const star = readMappedNumbers(starWs, STAR_MAP, DEFAULT_STAR);
  star.name = DEFAULT_STAR.name;

  const systemInputs = readMappedNumbers(systemWs, SYSTEM_MAP, DEFAULT_SYSTEM);
  const planets = buildPlanets(classified.planet);
  const moons = buildMoons(classified.moon, planets.order);

  const outermostGas = readOutermostGasGiantAu(systemWs);
  const debrisRange = parseDebrisRangeFromCell(systemWs) || { innerAu: 0, outerAu: 0 };

  // Build gas giants collection from legacy C37 cell
  const gasGiants = { order: [], byId: {} };
  if (outermostGas > 0) {
    gasGiants.order.push("gg1");
    gasGiants.byId.gg1 = {
      id: "gg1",
      name: "Outermost gas giant",
      au: outermostGas,
      style: "jupiter",
    };
  }

  // Build debris disks — from explicit cell range or empty
  const debrisDisks = { order: [], byId: {} };
  if (debrisRange.innerAu > 0 || debrisRange.outerAu > 0) {
    debrisDisks.order.push("dd1");
    debrisDisks.byId.dd1 = {
      id: "dd1",
      name: "Debris disk",
      innerAu: debrisRange.innerAu,
      outerAu: debrisRange.outerAu,
    };
  }

  const world = {
    version: 1,
    star: {
      name: star.name,
      massMsol: star.massMsol,
      ageGyr: star.ageGyr,
    },
    system: {
      spacingFactor: systemInputs.spacingFactor,
      orbit1Au: systemInputs.orbit1Au,
      gasGiants,
      debrisDisks,
    },
    planets,
    moons,
  };

  return {
    world,
    summary: {
      starSheet: classified.star[0]?.name || null,
      systemSheet: classified.system[0]?.name || null,
      planetSheetsImported: classified.planet.length,
      moonSheetsImported: classified.moon.length,
      planetSheetNames: classified.planet.map((s) => s.name),
      moonSheetNames: classified.moon.map((s) => s.name),
    },
  };
}
