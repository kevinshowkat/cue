import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const html = readFileSync(join(here, "..", "src", "index.html"), "utf8");

test("desktop boot imports design review bootstrap alongside canvas runtime", () => {
  assert.match(html, /Promise\.all\(\[import\("\.\/design_review_bootstrap\.js"\), import\("\.\/canvas_app\.js"\)\]\)/);
});
