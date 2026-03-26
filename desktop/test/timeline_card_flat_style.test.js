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

test("selected timeline glyphs keep semantic colors for the current state", () => {
  assert.match(
    css,
    /\.timeline-card\.selected \.timeline-card-glyph--highlight,\s*\.timeline-card\.selected \.timeline-card-glyph--protect\s*\{[\s\S]*color:\s*rgba\(214,\s*176,\s*54,\s*0\.98\);/
  );
  assert.match(
    css,
    /body\.juggernaut-shell \.timeline-card\.selected \.timeline-card-glyph--highlight,\s*body\.juggernaut-shell \.timeline-card\.selected \.timeline-card-glyph--protect\s*\{[\s\S]*color:\s*rgba\(214,\s*176,\s*54,\s*0\.98\);/
  );
  assert.match(
    css,
    /body\.juggernaut-shell \.timeline-card\.selected \.timeline-card-glyph--erase,\s*body\.juggernaut-shell \.timeline-card\.selected \.timeline-card-glyph--delete\s*\{[\s\S]*color:\s*rgba\(181,\s*96,\s*87,\s*0\.98\);/
  );
});

test("timeline card hover restores semantic color for glyphs and thumbnails", () => {
  assert.match(
    css,
    /\.timeline-card:hover \.timeline-card-glyph--highlight,\s*\.timeline-card:hover \.timeline-card-glyph--protect,\s*\.timeline-card:focus-visible \.timeline-card-glyph--highlight,\s*\.timeline-card:focus-visible \.timeline-card-glyph--protect\s*\{[\s\S]*color:\s*rgba\(214,\s*176,\s*54,\s*0\.98\);/
  );
  assert.match(
    css,
    /\.timeline-card\.is-inactive:hover img,\s*\.timeline-card\.is-inactive:focus-visible img\s*\{[\s\S]*filter:\s*grayscale\(0\) saturate\(1\.08\) contrast\(1\.04\) brightness\(1\.01\);/
  );
  assert.match(
    css,
    /body\.juggernaut-shell \.timeline-card:hover \.timeline-card-glyph--highlight,\s*body\.juggernaut-shell \.timeline-card:hover \.timeline-card-glyph--protect,\s*body\.juggernaut-shell \.timeline-card:focus-visible \.timeline-card-glyph--highlight,\s*body\.juggernaut-shell \.timeline-card:focus-visible \.timeline-card-glyph--protect\s*\{[\s\S]*color:\s*rgba\(214,\s*176,\s*54,\s*0\.98\);/
  );
  assert.match(
    css,
    /body\.juggernaut-shell \.timeline-card\.is-inactive:hover img,\s*body\.juggernaut-shell \.timeline-card\.is-inactive:focus-visible img\s*\{[\s\S]*filter:\s*grayscale\(0\) saturate\(1\.08\) contrast\(1\.04\) brightness\(1\.01\);/
  );
});
