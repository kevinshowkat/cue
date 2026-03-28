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

test("settleAutoAspectRectCss keeps tall imports inside their original placeholder tile", () => {
  const clampFreeformRectCss = instantiateFunction("clampFreeformRectCss", {
    clamp: (value, min, max) => Math.max(min, Math.min(max, value)),
    normalizeFreeformRotateDeg: (value) => Number(value) || 0,
    normalizeFreeformSkewDeg: (value) => Number(value) || 0,
    Math,
    Number,
    Boolean,
  });
  const settleAutoAspectRectCss = instantiateFunction("settleAutoAspectRectCss", {
    clampFreeformRectCss,
    Math,
    Number,
  });

  const settled = settleAutoAspectRectCss(
    { x: 100, y: 120, w: 280, h: 280, autoAspect: true },
    { width: 200, height: 2000 },
    { canvasCssW: 1200, canvasCssH: 900, clampOptions: { margin: -2000, minSize: 44 } }
  );

  assert.equal(settled.h <= 280, true);
  assert.equal(settled.w <= 280, true);
  assert.equal(settled.h >= settled.w, true);
  assert.equal(settled.autoAspect, false);
});

test("settleAutoAspectRectCss keeps wide imports inside their original placeholder tile", () => {
  const clampFreeformRectCss = instantiateFunction("clampFreeformRectCss", {
    clamp: (value, min, max) => Math.max(min, Math.min(max, value)),
    normalizeFreeformRotateDeg: (value) => Number(value) || 0,
    normalizeFreeformSkewDeg: (value) => Number(value) || 0,
    Math,
    Number,
    Boolean,
  });
  const settleAutoAspectRectCss = instantiateFunction("settleAutoAspectRectCss", {
    clampFreeformRectCss,
    Math,
    Number,
  });

  const settled = settleAutoAspectRectCss(
    { x: 100, y: 120, w: 280, h: 280, autoAspect: true },
    { width: 3200, height: 240 },
    { canvasCssW: 1200, canvasCssH: 900, clampOptions: { margin: -2000, minSize: 44 } }
  );

  assert.equal(settled.w <= 280, true);
  assert.equal(settled.h <= 280, true);
  assert.equal(settled.w >= settled.h, true);
  assert.equal(settled.autoAspect, false);
});
