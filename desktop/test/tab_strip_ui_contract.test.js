import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const html = readFileSync(join(here, "..", "src", "index.html"), "utf8");
const css = readFileSync(join(here, "..", "src", "styles.css"), "utf8");

test("Session tab strip mounts inside the in-window shell head with core-owned ids", () => {
  assert.match(
    html,
    /class=\"juggernaut-shell-head\"[^>]*role=\"toolbar\"[\s\S]*id=\"session-tab-strip\"[\s\S]*id=\"session-tab-list\"[^>]*role=\"tablist\"[\s\S]*id=\"session-tab-open\"[\s\S]*id=\"session-tab-new\"/
  );

  const brandStripStart = html.indexOf('<div class="brand-strip"');
  const mainStart = html.indexOf("<main", brandStripStart);
  assert.ok(brandStripStart >= 0 && mainStart > brandStripStart, "expected brand strip before main");
  const brandStripChunk = html.slice(brandStripStart, mainStart);
  assert.equal(brandStripChunk.includes('id="session-tab-strip"'), false);
});

test("Session tab strip HTML exposes active, busy, dirty, close, and hydration data contract", () => {
  assert.match(
    html,
    /class=\"session-tab-item is-active is-dirty\"[^>]*data-tab-id=\"tab-hero\"[^>]*data-title=\"Hero Composite\"[^>]*data-run-dir=\"\/runs\/hero-composite\"[^>]*data-thumbnail-path=\"\.\/assets\/logo\.jpeg\"[^>]*data-active=\"true\"[^>]*data-busy=\"false\"[^>]*data-dirty=\"true\"[^>]*data-can-close=\"true\"/
  );
  assert.match(html, /class=\"session-tab-item is-busy\"[^>]*data-busy=\"true\"/);
  assert.match(html, /class=\"session-tab-close\"[^>]*aria-label=\"Close Hero Composite\"/);
  assert.match(html, /data-can-close=\"false\"[\s\S]*class=\"session-tab-close\"[\s\S]*hidden/);
  assert.match(html, /class=\"session-tab-thumbnail\"[\s\S]*<img src=\"\.\/assets\/logo\.jpeg\" alt=\"\"/);
});

test("Session tab strip CSS keeps the strip compact, scrollable, and stateful", () => {
  assert.match(css, /\.session-tab-strip\s*\{[\s\S]*flex:\s*1 1 auto/);
  assert.match(css, /\.session-tab-list\s*\{[\s\S]*overflow-x:\s*auto/);
  assert.match(css, /\.session-tab-item\.is-active\s*\{/);
  assert.match(css, /\.session-tab-item\.is-busy\s+\.session-tab-busy-indicator\s*\{/);
  assert.match(css, /\.session-tab-item\.is-dirty\s+\.session-tab-dirty-dot\s*\{/);
  assert.match(css, /\.session-tab-close\s*\{/);
  assert.match(css, /@keyframes\s+sessionTabBusyPulse/);
});
