import test from "node:test";
import assert from "node:assert/strict";
import pixelmatch from "pixelmatch";

import { installDomHarness } from "./domHarness.js";
import { assertSnapshot } from "./visualHelpers.js";
import { composeCelestialDescriptor, paintCelestialTexture } from "../ui/celestialComposer.js";

/* ───── equirectangular texture snapshots ───── */

test("paintCelestialTexture → rocky blue-marble → deterministic snapshot", () => {
  const { cleanup } = installDomHarness();
  try {
    const descriptor = composeCelestialDescriptor(
      {
        bodyType: "rocky",
        name: "VisTest",
        recipeId: "blue-marble",
        inputs: { pressureAtm: 1, h2oPct: 10, name: "VisTest" },
        derived: {
          compositionClass: "Earth-like",
          waterRegime: "Shallow oceans",
          surfaceTempK: 288,
          tectonicRegime: "mobile",
          skyColourDayHex: "#93b6ff",
        },
      },
      { lod: "low" },
    );

    const canvas = document.createElement("canvas");
    canvas.width = 128;
    canvas.height = 128;
    const ctx = canvas.getContext("2d");
    assert.ok(ctx);
    paintCelestialTexture(ctx, 128, descriptor, 0);

    assertSnapshot(ctx, 128, 128, "rocky-equirect");
  } finally {
    cleanup();
  }
});

test("paintCelestialTexture → gas giant jupiter → deterministic snapshot", () => {
  const { cleanup } = installDomHarness();
  try {
    const descriptor = composeCelestialDescriptor(
      { bodyType: "gasGiant", name: "VisGas", styleId: "jupiter", rotationPeriodHours: 10 },
      { lod: "low" },
    );

    const canvas = document.createElement("canvas");
    canvas.width = 128;
    canvas.height = 128;
    const ctx = canvas.getContext("2d");
    assert.ok(ctx);
    paintCelestialTexture(ctx, 128, descriptor, 0);

    assertSnapshot(ctx, 128, 128, "gas-jupiter-equirect");
  } finally {
    cleanup();
  }
});

test("paintCelestialTexture → moon luna → deterministic snapshot", () => {
  const { cleanup } = installDomHarness();
  try {
    const descriptor = composeCelestialDescriptor(
      { bodyType: "moon", name: "VisMoon", recipeId: "luna" },
      { lod: "low" },
    );

    const canvas = document.createElement("canvas");
    canvas.width = 128;
    canvas.height = 128;
    const ctx = canvas.getContext("2d");
    assert.ok(ctx);
    paintCelestialTexture(ctx, 128, descriptor, 0);

    assertSnapshot(ctx, 128, 128, "moon-luna-equirect");
  } finally {
    cleanup();
  }
});

/* ───── pixelmatch self-consistency ───── */

test("paintCelestialTexture → same descriptor twice → identical pixels", () => {
  const { cleanup } = installDomHarness();
  try {
    const descriptor = composeCelestialDescriptor(
      {
        bodyType: "rocky",
        name: "TwinTest",
        inputs: { pressureAtm: 1, h2oPct: 5, name: "TwinTest" },
        derived: { compositionClass: "Earth-like", waterRegime: "Dry", tectonicRegime: "stagnant" },
      },
      { lod: "low" },
    );

    const c1 = document.createElement("canvas");
    c1.width = 64;
    c1.height = 64;
    const ctx1 = c1.getContext("2d");
    paintCelestialTexture(ctx1, 64, descriptor, 0);

    const c2 = document.createElement("canvas");
    c2.width = 64;
    c2.height = 64;
    const ctx2 = c2.getContext("2d");
    paintCelestialTexture(ctx2, 64, descriptor, 0);

    const img1 = ctx1.getImageData(0, 0, 64, 64);
    const img2 = ctx2.getImageData(0, 0, 64, 64);

    const diff = pixelmatch(img1.data, img2.data, null, 64, 64, { threshold: 0 });
    assert.equal(diff, 0, "identical inputs must produce identical pixels");
  } finally {
    cleanup();
  }
});

test("paintCelestialTexture → ocean vs lava world → visually different", () => {
  const { cleanup } = installDomHarness();
  try {
    const d1 = composeCelestialDescriptor(
      {
        bodyType: "rocky",
        name: "World-A",
        inputs: { pressureAtm: 1, h2oPct: 50, name: "World-A" },
        derived: {
          compositionClass: "Ocean world",
          waterRegime: "Extensive oceans",
          surfaceTempK: 288,
          tectonicRegime: "mobile",
        },
      },
      { lod: "low" },
    );
    const d2 = composeCelestialDescriptor(
      {
        bodyType: "rocky",
        name: "World-B",
        recipeId: "lava-world",
        inputs: { pressureAtm: 0.2, name: "World-B" },
        derived: {
          compositionClass: "Earth-like",
          waterRegime: "Dry",
          surfaceTempK: 1500,
          tectonicRegime: "episodic",
        },
      },
      { lod: "low" },
    );

    const c1 = document.createElement("canvas");
    c1.width = 64;
    c1.height = 64;
    const ctx1 = c1.getContext("2d");
    paintCelestialTexture(ctx1, 64, d1, 0);

    const c2 = document.createElement("canvas");
    c2.width = 64;
    c2.height = 64;
    const ctx2 = c2.getContext("2d");
    paintCelestialTexture(ctx2, 64, d2, 0);

    const img1 = ctx1.getImageData(0, 0, 64, 64);
    const img2 = ctx2.getImageData(0, 0, 64, 64);

    const diff = pixelmatch(img1.data, img2.data, null, 64, 64, { threshold: 0.1 });
    assert.ok(
      diff > 500,
      `ocean vs lava worlds must differ significantly (got ${diff} differing pixels)`,
    );
  } finally {
    cleanup();
  }
});
