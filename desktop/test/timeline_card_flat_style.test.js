import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const css = readFileSync(join(here, "..", "src", "styles.css"), "utf8");

test("timeline card containers stay flat without shadows in base and shell themes", () => {
  assert.match(css, /\.timeline-card\s*\{[\s\S]*box-shadow:\s*none;/);
  assert.match(css, /\.timeline-card\.selected\s*\{[\s\S]*box-shadow:\s*none;/);
  assert.match(css, /body\.juggernaut-shell \.timeline-card\s*\{[\s\S]*box-shadow:\s*none;/);
  assert.match(css, /body\.juggernaut-shell \.timeline-card\.selected\s*\{[\s\S]*box-shadow:\s*none;/);
});

test("timeline shell chrome stays flat without shadows in the shell theme", () => {
  assert.match(css, /body\.juggernaut-shell \.timeline-shell\s*\{[\s\S]*box-shadow:\s*none;/);
  assert.match(css, /body\.juggernaut-shell \.timeline-arrow\s*\{[\s\S]*box-shadow:\s*none;/);
  assert.match(css, /body\.juggernaut-shell \.timeline-card-seq\s*\{[\s\S]*box-shadow:\s*none;/);
});
