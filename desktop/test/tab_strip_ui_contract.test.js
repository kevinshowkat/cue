import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const html = readFileSync(join(here, "..", "src", "index.html"), "utf8");
const css = readFileSync(join(here, "..", "src", "styles.css"), "utf8");

test("Session tab strip mounts inside the titlebar brand strip with core-owned ids", () => {
  assert.match(
    html,
    /class=\"brand-strip\"[^>]*role=\"toolbar\"[\s\S]*class=\"window-drag-region\"[^>]*data-tauri-drag-region[\s\S]*id=\"session-tab-strip\"[\s\S]*class=\"session-tab-run\"[\s\S]*id=\"session-tab-list\"[^>]*role=\"tablist\"[\s\S]*id=\"session-tab-new\"[\s\S]*id=\"session-tab-open\"[\s\S]*id=\"session-tab-design-review\"/
  );

  const brandStripStart = html.indexOf('<div class="brand-strip"');
  const mainStart = html.indexOf("<main", brandStripStart);
  assert.ok(brandStripStart >= 0 && mainStart > brandStripStart, "expected brand strip before main");
  const brandStripChunk = html.slice(brandStripStart, mainStart);
  assert.equal(brandStripChunk.includes('id="session-tab-strip"'), true);
  assert.equal(brandStripChunk.includes('class="session-tab-run"'), true);
  assert.equal(brandStripChunk.includes('id="session-tab-list"'), true);
  assert.equal(brandStripChunk.includes('id="session-tab-new"'), true);
  assert.equal(brandStripChunk.includes('id="session-tab-open"'), true);
  assert.equal(brandStripChunk.includes('id="session-tab-design-review"'), true);
  assert.equal(brandStripChunk.includes('id="session-tab-strip-shell-head-placeholder"'), false);
});

test("Session tab strip seeds a visible launch tab and exposes the Design Review action", () => {
  assert.match(
    html,
    /id=\"session-tab-list\"[^>]*role=\"tablist\"[^>]*aria-label=\"Open sessions\">[\s\S]*data-tab-id=\"tab-launch\"[\s\S]*<span class=\"session-tab-title\">Untitled Canvas<\/span>[\s\S]*<\/div>/
  );
  assert.match(
    html,
    /class=\"session-tab-run\"[^>]*aria-label=\"Open sessions and new session\"[\s\S]*id=\"session-tab-list\"[\s\S]*id=\"session-tab-new\"/
  );
  assert.match(
    html,
    /id=\"session-tab-design-review\"[^>]*class=\"session-tab-strip-action session-tab-strip-review\"[^>]*aria-label=\"Design Review\"[^>]*title=\"Design Review\"[\s\S]*<svg[\s\S]*<\/svg>[\s\S]*<span>Design Review<\/span>/
  );
  assert.match(
    html,
    /id=\"juggernaut-agent-runner-open\"[^>]*class=\"session-tab-strip-action session-tab-runtime-action\"[^>]*title=\"Agent Run\"[\s\S]*<span>Agent Run<\/span>/
  );
  assert.match(
    html,
    /id=\"juggernaut-export-psd\"[^>]*class=\"session-tab-strip-action session-tab-runtime-action\"[^>]*title=\"Export PSD\"[\s\S]*<span>Export PSD<\/span>/
  );
  const brandStripStart = html.indexOf('<div class="brand-strip"');
  const mainStart = html.indexOf("<main", brandStripStart);
  const brandStripChunk = html.slice(brandStripStart, mainStart);
  assert.match(
    brandStripChunk,
    /class=\"session-tab-run\"[\s\S]*id=\"session-tab-list\"[\s\S]*id=\"session-tab-new\"[\s\S]*class=\"session-tab-strip-actions\"[\s\S]*id=\"session-tab-open\"[\s\S]*id=\"juggernaut-agent-runner-open\"[\s\S]*id=\"juggernaut-export-psd\"[\s\S]*id=\"session-tab-design-review\"/
  );
  assert.equal(brandStripChunk.includes('data-tab-id="tab-launch"'), true);
  assert.equal(brandStripChunk.includes('data-tab-id="tab-hero"'), false);
  assert.equal(brandStripChunk.includes('data-tab-id="tab-cleanup"'), false);
});

test("Session tab strip CSS keeps the strip compact, scrollable, and stateful", () => {
  assert.match(css, /\.session-tab-strip\s*\{[\s\S]*flex:\s*1 1 auto/);
  assert.match(css, /\.session-tab-run\s*\{/);
  assert.match(css, /\.session-tab-list\s*\{[\s\S]*flex:\s*0 1 auto[\s\S]*overflow-x:\s*auto/);
  assert.match(
    css,
    /body\.juggernaut-shell \.brand-strip \.session-tab-list\s*\{[\s\S]*flex:\s*0 1 auto[\s\S]*max-width:\s*min\(68vw,\s*960px\)[\s\S]*border-radius:\s*14px[\s\S]*box-shadow:/s
  );
  assert.match(css, /\.session-tab-item\.is-active\s*\{/);
  assert.match(css, /\.session-tab-item\.is-placeholder\s*\{/);
  assert.match(css, /\.session-tab-placeholder-shell\s*\{/);
  assert.match(css, /\.session-tab-placeholder-label::before\s*\{/);
  assert.match(css, /\.session-tab-item\.is-busy\s+\.session-tab-busy-indicator\s*\{/);
  assert.doesNotMatch(html, /session-tab-dirty-dot/);
  assert.doesNotMatch(css, /\.session-tab-dirty-dot\s*\{/);
  assert.match(css, /\.session-tab-review-state\s*\{/);
  assert.match(css, /\.session-tab-rename-shell\s*\{/);
  assert.match(css, /\.session-tab-title-input\s*\{/);
  assert.match(css, /\.session-tab-close\s*\{/);
  assert.match(css, /\.session-tab-strip-new\s*\{/);
  assert.match(css, /\.session-tab-strip-review\s*\{/);
  assert.match(css, /\.session-tab-runtime-action\s*\{/);
  assert.match(css, /\.session-tab-runtime-action\s*\{[\s\S]*display:\s*inline-flex[\s\S]*white-space:\s*nowrap/s);
  assert.match(css, /body\.juggernaut-shell \.brand-strip \.session-tab-runtime-action\s*\{[\s\S]*display:\s*inline-flex[\s\S]*padding:\s*0 14px/s);
  assert.match(css, /\.session-tab-runtime-action\.is-ready\s*\{/);
  assert.match(css, /\.session-tab-runtime-action\.is-pending-hook\s*\{/);
  assert.match(css, /@keyframes\s+sessionTabBusyPulse/);
  assert.match(css, /@keyframes\s+sessionTabReviewPulse/);
});
