import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const appPath = join(here, "..", "src", "canvas_app.js");
const app = readFileSync(appPath, "utf8");

function extractFunctionSource(name) {
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

test("HUD UNIT typeout starts from renderHudReadout for first-time vision labels", () => {
  const fnText = extractFunctionSource("renderHudReadout");

  assert.match(fnText, /const activeImageId = String\(img\?\.id \|\| ""\)\.trim\(\);/);
  assert.match(fnText, /if \(descFromVision && !typeoutLocked && hudDescShouldStartTypeout\(activeImageId, descText\)\) \{/);
  assert.match(fnText, /startHudDescTypeout\(activeImageId, descText\);/);
});

test("setActiveImage relies on renderHudReadout for UNIT typeout (no duplicate manual trigger)", () => {
  const fnText = extractFunctionSource("setActiveImage");

  assert.doesNotMatch(fnText, /startHudDescTypeout\(/);
});
