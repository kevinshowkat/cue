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
    /class=\"brand-strip\"[^>]*role=\"toolbar\"[\s\S]*class=\"window-drag-region\"[^>]*data-tauri-drag-region[\s\S]*id=\"session-tab-strip\"[\s\S]*class=\"session-tab-run\"[\s\S]*id=\"session-tab-list\"[^>]*role=\"tablist\"[\s\S]*id=\"session-tab-new\"[\s\S]*id=\"session-tab-fork\"[\s\S]*id=\"session-tab-open\"[\s\S]*id=\"session-tab-design-review\"/
  );

  const brandStripStart = html.indexOf('<div class="brand-strip"');
  const mainStart = html.indexOf("<main", brandStripStart);
  assert.ok(brandStripStart >= 0 && mainStart > brandStripStart, "expected brand strip before main");
  const brandStripChunk = html.slice(brandStripStart, mainStart);
  assert.equal(brandStripChunk.includes('id="session-tab-strip"'), true);
  assert.equal(brandStripChunk.includes('class="session-tab-run"'), true);
  assert.equal(brandStripChunk.includes('id="session-tab-list"'), true);
  assert.equal(brandStripChunk.includes('id="session-tab-new"'), true);
  assert.equal(brandStripChunk.includes('id="session-tab-fork"'), true);
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
    /class=\"session-tab-run\"[^>]*aria-label=\"Open sessions, new session, and fork tab\"[\s\S]*id=\"session-tab-list\"[\s\S]*id=\"session-tab-new\"[\s\S]*id=\"session-tab-fork\"/
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
    /id=\"juggernaut-export-psd\"[^>]*class=\"session-tab-strip-action session-tab-runtime-action session-tab-action-menu-toggle\"[^>]*title=\"Export\"[\s\S]*<span>Export<\/span>/
  );
  assert.match(
    html,
    /id=\"juggernaut-export-menu\"[^>]*role=\"menu\"[^>]*aria-label=\"Export formats\"[\s\S]*id=\"juggernaut-export-format-psd\"[\s\S]*<span class=\"session-tab-action-menu-item-label\">PSD<\/span>[\s\S]*id=\"juggernaut-export-format-png\"[\s\S]*<span class=\"session-tab-action-menu-item-label\">PNG<\/span>/
  );
  const brandStripStart = html.indexOf('<div class="brand-strip"');
  const mainStart = html.indexOf("<main", brandStripStart);
  const brandStripChunk = html.slice(brandStripStart, mainStart);
  assert.match(
    brandStripChunk,
    /class=\"session-tab-run\"[\s\S]*id=\"session-tab-list\"[\s\S]*id=\"session-tab-new\"[\s\S]*id=\"session-tab-fork\"[\s\S]*class=\"session-tab-strip-actions\"[\s\S]*id=\"session-tab-open\"[\s\S]*id=\"juggernaut-agent-runner-open\"[\s\S]*id=\"juggernaut-export-psd\"[\s\S]*id=\"session-tab-design-review\"/
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
  assert.match(css, /\.session-tab-review-spinner\s*\{/);
  assert.match(css, /\.session-tab-item\.is-review-progress\s+\.session-tab-busy-indicator\s*\{/);
  assert.match(css, /\.session-tab-rename-shell\s*\{/);
  assert.match(css, /\.session-tab-title-row\s*\{/);
  assert.match(css, /\.session-tab-fork-indicator\s*\{[\s\S]*border-radius:\s*999px[\s\S]*background:/s);
  assert.match(css, /\.session-tab-fork-indicator\s*\{/);
  assert.match(css, /\.session-tab-title-input\s*\{/);
  assert.match(css, /\.session-tab-close\s*\{/);
  assert.match(css, /\.session-tab-strip-new\s*\{/);
  assert.match(css, /\.session-tab-strip-fork\s*\{/);
  assert.match(css, /\.session-tab-strip-review\s*\{/);
  assert.match(css, /\.session-tab-runtime-action\s*\{/);
  assert.match(css, /\.session-tab-runtime-action\s*\{[\s\S]*display:\s*inline-flex[\s\S]*white-space:\s*nowrap/s);
  assert.match(css, /body\.juggernaut-shell \.brand-strip \.session-tab-runtime-action\s*\{[\s\S]*display:\s*inline-flex[\s\S]*padding:\s*0 14px/s);
  assert.match(css, /\.session-tab-runtime-action\.is-ready\s*\{/);
  assert.match(css, /\.session-tab-runtime-action\[data-provenance="local_only"\],\s*\.session-tab-runtime-action\[data-provenance="local_only"\]\.is-ready\s*\{/);
  assert.match(css, /\.session-tab-runtime-action\[data-provenance="local_only"\],\s*\.session-tab-runtime-action\[data-provenance="local_only"\]\.is-ready\s*\{[\s\S]*background:\s*rgba\(235,\s*230,\s*216,\s*0\.98\);[\s\S]*color:\s*rgba\(0,\s*0,\s*0,\s*0\.92\);/);
  assert.match(css, /\.session-tab-strip-action\[data-provenance="local_only"\]:active,\s*\.session-tab-runtime-action\[data-provenance="local_only"\]:active,\s*\.session-tab-runtime-action\[data-provenance="local_only"\]\.is-active-request\s*\{[\s\S]*background:\s*rgba\(205,\s*193,\s*164,\s*0\.98\);[\s\S]*transform:\s*translateY\(1px\);/);
  assert.match(css, /\.session-tab-runtime-action\[data-provenance="local_only"\]:disabled\s*\{[\s\S]*background:\s*rgba\(242,\s*238,\s*229,\s*0\.98\);[\s\S]*color:\s*rgba\(0,\s*0,\s*0,\s*0\.5\);/);
  assert.match(css, /\.session-tab-runtime-action\.has-action-provenance,\s*\.session-tab-runtime-action\.has-action-provenance\.is-ready\s*\{/);
  assert.match(css, /\.session-tab-runtime-action\.has-action-provenance,\s*\.session-tab-runtime-action\.has-action-provenance\.is-ready\s*\{[\s\S]*background:\s*rgba\(204,\s*185,\s*180,\s*0\.98\);[\s\S]*color:\s*rgba\(0,\s*0,\s*0,\s*0\.92\);/);
  assert.match(css, /\.session-tab-strip-action\.has-action-provenance:active,\s*\.session-tab-runtime-action\.has-action-provenance:active,\s*\.session-tab-runtime-action\.has-action-provenance\.is-active-request\s*\{[\s\S]*background:\s*rgba\(154,\s*132,\s*126,\s*0\.98\);[\s\S]*color:\s*rgba\(0,\s*0,\s*0,\s*0\.92\);[\s\S]*transform:\s*translateY\(1px\);/);
  assert.match(css, /\.session-tab-runtime-action\.has-action-provenance:disabled\s*\{[\s\S]*background:\s*rgba\(224,\s*214,\s*211,\s*0\.98\);[\s\S]*color:\s*rgba\(0,\s*0,\s*0,\s*0\.5\);[\s\S]*opacity:\s*1;/);
  assert.match(css, /\.session-tab-runtime-action\.is-pending-hook\s*\{/);
  assert.match(css, /\.session-tab-action-menu-panel\s*\{/);
  assert.match(css, /\.session-tab-action-menu-item\s*\{/);
  assert.match(css, /body\.juggernaut-shell \.brand-strip \.session-tab-fork-indicator\s*\{[\s\S]*background:/s);
  assert.match(css, /body\.juggernaut-shell \.brand-strip \.session-tab-fork-indicator\s*\{/);
  assert.match(css, /@keyframes\s+sessionTabBusyPulse/);
  assert.match(css, /@keyframes\s+sessionTabReviewPulse/);
  assert.match(css, /@keyframes\s+sessionTabReviewSpinner/);
});
