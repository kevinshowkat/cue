import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const appPath = join(here, "..", "src", "canvas_app.js");
const app = readFileSync(appPath, "utf8");

function loadNamedFunctionSource(name) {
  const markers = [`async function ${name}(`, `function ${name}(`];
  const start = markers
    .map((marker) => app.indexOf(marker))
    .find((index) => index >= 0);
  assert.notEqual(start, undefined, `Could not find function ${name}`);
  const signatureStart = app.indexOf("(", start);
  assert.notEqual(signatureStart, -1, `Could not find signature for ${name}`);
  let parenDepth = 0;
  let bodyStart = -1;
  for (let index = signatureStart; index < app.length; index += 1) {
    const char = app[index];
    if (char === "(") parenDepth += 1;
    if (char === ")") parenDepth -= 1;
    if (parenDepth === 0 && char === "{") {
      bodyStart = index;
      break;
    }
  }
  assert.notEqual(bodyStart, -1, `Could not find body for ${name}`);
  let depth = 0;
  for (let index = bodyStart; index < app.length; index += 1) {
    const char = app[index];
    if (char === "{") depth += 1;
    if (char === "}") depth -= 1;
    if (depth === 0) {
      return app.slice(start, index + 1);
    }
  }
  throw new Error(`Could not extract function ${name}`);
}

function instantiateFunction(name, deps = {}) {
  const source = loadNamedFunctionSource(name);
  const keys = Object.keys(deps);
  const values = Object.values(deps);
  return new Function(...keys, `return (${source});`)(...values);
}

test("visibleImportWorldBoundsCss reflects the current panned multi-canvas viewport", () => {
  const state = {
    canvasMode: "multi",
  };
  const visibleImportWorldBoundsCss = instantiateFunction("visibleImportWorldBoundsCss", {
    state,
    canvasScreenCssToWorldCss: ({ x = 0, y = 0 }) => ({ x: x + 900, y: y + 520 }),
    Math,
    Number,
  });

  const bounds = visibleImportWorldBoundsCss(1280, 820);

  assert.deepEqual(bounds, {
    minX: 900,
    minY: 520,
    maxX: 2180,
    maxY: 1340,
  });
});

test("computeImportPlacementsCss clamps imports inside the visible world window instead of raw canvas css", () => {
  const computeImportPlacementsCss = instantiateFunction("_computeImportPlacementsCss", {
    clamp: (value, min, max) => Math.max(min, Math.min(max, value)),
    Math,
    Number,
  });

  const placements = computeImportPlacementsCss(
    1,
    { x: 1540, y: 930 },
    320,
    35,
    1280,
    820,
    { minX: 900, minY: 520, maxX: 2180, maxY: 1340 }
  );

  assert.equal(placements.length, 1);
  assert.equal(placements[0].x, 1380);
  assert.equal(placements[0].y, 770);
  assert.equal(placements[0].w, 320);
  assert.equal(placements[0].h, 320);
});

test("computeImportPlacementsCss still clamps back to the visible edge when the requested center is offscreen", () => {
  const computeImportPlacementsCss = instantiateFunction("_computeImportPlacementsCss", {
    clamp: (value, min, max) => Math.max(min, Math.min(max, value)),
    Math,
    Number,
  });

  const placements = computeImportPlacementsCss(
    1,
    { x: 2800, y: 1800 },
    320,
    35,
    1280,
    820,
    { minX: 900, minY: 520, maxX: 2180, maxY: 1340 }
  );

  assert.equal(placements.length, 1);
  assert.equal(placements[0].x, 1846);
  assert.equal(placements[0].y, 1006);
});
