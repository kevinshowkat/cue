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
    /class=\"brand-strip\"[^>]*role=\"toolbar\"[\s\S]*class=\"window-drag-region\"[^>]*data-tauri-drag-region[\s\S]*id=\"session-tab-strip\"[\s\S]*class=\"session-tab-run\"[\s\S]*id=\"session-tab-list\"[^>]*role=\"tablist\"[\s\S]*id=\"session-tab-new\"[\s\S]*id=\"session-tab-fork\"[\s\S]*id=\"session-tab-history\"[\s\S]*id=\"session-tab-design-review\"[\s\S]*id=\"juggernaut-export-psd\"/
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
  assert.equal(brandStripChunk.includes('id="session-tab-history"'), true);
  assert.equal(brandStripChunk.includes('id="session-tab-design-review"'), true);
  assert.equal(brandStripChunk.includes('id="session-tab-strip-shell-head-placeholder"'), false);
});

test("Session tab strip seeds a visible launch tab and exposes History plus the Design Review action", () => {
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
    /id=\"session-tab-history\"[^>]*class=\"session-tab-strip-action session-tab-runtime-action session-tab-history-action\"[^>]*aria-label=\"History\"[^>]*aria-controls=\"timeline-dock\"[^>]*aria-expanded=\"true\"[^>]*aria-pressed=\"true\"[^>]*title=\"History\"[\s\S]*<svg[\s\S]*<\/svg>/
  );
  assert.doesNotMatch(html, /id=\"session-tab-history\"[\s\S]*<span>History<\/span>/);
  assert.match(
    html,
    /id=\"session-tab-design-review\"[^>]*class=\"session-tab-strip-action session-tab-strip-review\"[^>]*aria-label=\"Design Review\"[^>]*title=\"Design Review\"[\s\S]*<svg[\s\S]*<\/svg>[\s\S]*<span>Design Review<\/span>/
  );
  assert.match(
    html,
    /id=\"juggernaut-agent-runner-open\"[^>]*class=\"session-tab-strip-action session-tab-runtime-action session-tab-runtime-icon-action\"[^>]*aria-label=\"Agent Run\"[^>]*title=\"Agent Run\"[\s\S]*<svg[\s\S]*<\/svg>/
  );
  assert.doesNotMatch(html, /id=\"juggernaut-agent-runner-open\"[\s\S]*<span>Agent Run<\/span>/);
  assert.match(
    html,
    /id=\"juggernaut-export-psd\"[^>]*class=\"session-tab-strip-action session-tab-runtime-action session-tab-action-menu-toggle\"[^>]*title=\"Export\"[\s\S]*class=\"session-tab-action-menu-caret\"/
  );
  assert.doesNotMatch(html, /id=\"juggernaut-export-psd\"[\s\S]*<span>Export<\/span>/);
  assert.match(
    html,
    /id=\"juggernaut-export-menu\"[^>]*role=\"menu\"[^>]*aria-label=\"Export formats\"[\s\S]*id=\"juggernaut-export-format-psd\"[\s\S]*<span class=\"session-tab-action-menu-item-label\">PSD<\/span>[\s\S]*id=\"juggernaut-export-format-png\"[\s\S]*<span class=\"session-tab-action-menu-item-label\">PNG<\/span>/
  );
  const brandStripStart = html.indexOf('<div class="brand-strip"');
  const mainStart = html.indexOf("<main", brandStripStart);
  const brandStripChunk = html.slice(brandStripStart, mainStart);
  assert.match(
    brandStripChunk,
    /class=\"session-tab-run\"[\s\S]*id=\"session-tab-list\"[\s\S]*id=\"session-tab-new\"[\s\S]*id=\"session-tab-fork\"[\s\S]*class=\"session-tab-strip-actions\"[\s\S]*id=\"session-tab-history\"[\s\S]*id=\"juggernaut-agent-runner-open\"[\s\S]*id=\"session-tab-design-review\"[\s\S]*id=\"juggernaut-export-psd\"/
  );
  assert.equal(brandStripChunk.includes('data-tab-id="tab-launch"'), true);
  assert.equal(brandStripChunk.includes('data-tab-id="tab-hero"'), false);
  assert.equal(brandStripChunk.includes('data-tab-id="tab-cleanup"'), false);
});

test("Session tab strip uses a simple plus glyph for the new-session action", () => {
  const newButtonStart = html.indexOf('id="session-tab-new"');
  const forkButtonStart = html.indexOf('id="session-tab-fork"', newButtonStart);
  assert.ok(newButtonStart >= 0 && forkButtonStart > newButtonStart, "expected new-session button before fork button");
  const newButtonChunk = html.slice(newButtonStart, forkButtonStart);
  assert.match(newButtonChunk, /d=\"M12 6\.25v11\.5\"/);
  assert.match(newButtonChunk, /d=\"M6\.25 12h11\.5\"/);
  assert.doesNotMatch(newButtonChunk, /A2\.25 2\.25/);
});

test("Session tab strip CSS keeps the strip compact, scrollable, and stateful", () => {
  assert.match(css, /\.session-tab-strip\s*\{[\s\S]*flex:\s*1 1 auto/);
  assert.match(css, /\.session-tab-run\s*\{/);
  assert.match(css, /\.session-tab-list\s*\{[\s\S]*flex:\s*0 1 auto[\s\S]*overflow-x:\s*auto/);
  assert.match(
    css,
    /\.session-tab-item\s*\{[\s\S]*box-sizing:\s*border-box[\s\S]*width:\s*212px[\s\S]*min-width:\s*212px[\s\S]*max-width:\s*212px/s
  );
  assert.match(
    css,
    /body\.juggernaut-shell \.brand-strip \.session-tab-list\s*\{[\s\S]*flex:\s*0 1 auto[\s\S]*max-width:\s*min\(68vw,\s*960px\)[\s\S]*border-radius:\s*14px[\s\S]*box-shadow:/s
  );
  assert.match(
    css,
    /body\.juggernaut-shell \.brand-strip \.session-tab-item\s*\{[\s\S]*box-sizing:\s*border-box[\s\S]*width:\s*216px[\s\S]*min-width:\s*216px[\s\S]*max-width:\s*216px/s
  );
  assert.match(
    css,
    /@media \(max-width:\s*720px\)\s*\{[\s\S]*body\.juggernaut-shell \.brand-strip \.session-tab-item\s*\{[\s\S]*width:\s*180px[\s\S]*min-width:\s*180px[\s\S]*max-width:\s*180px/s
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
  assert.match(css, /\.session-tab-history-action,\s*\.session-tab-runtime-action\s*\{/);
  assert.match(css, /\.session-tab-history-action\s*\{[\s\S]*width:\s*34px[\s\S]*padding:\s*0;/);
  assert.match(css, /\.session-tab-runtime-icon-action\s*\{[\s\S]*width:\s*34px[\s\S]*padding:\s*0;/);
  assert.match(css, /\.session-tab-history-action\[data-provenance="local_only"\]\[aria-pressed="true"\],/);
  assert.match(css, /\.session-tab-runtime-action\s*\{/);
  assert.match(css, /\.session-tab-runtime-action\s*\{[\s\S]*display:\s*inline-flex[\s\S]*white-space:\s*nowrap/s);
  assert.match(css, /body\.juggernaut-shell \.brand-strip \.session-tab-history-action,\s*body\.juggernaut-shell \.brand-strip \.session-tab-runtime-action\s*\{/);
  assert.match(css, /body\.juggernaut-shell \.brand-strip \.session-tab-history-action\s*\{[\s\S]*width:\s*34px[\s\S]*padding:\s*0;/);
  assert.match(css, /body\.juggernaut-shell \.brand-strip \.session-tab-runtime-icon-action\s*\{[\s\S]*width:\s*34px[\s\S]*padding:\s*0;/);
  assert.match(css, /body\.juggernaut-shell \.brand-strip \.session-tab-runtime-action\s*\{[\s\S]*display:\s*inline-flex[\s\S]*padding:\s*0 14px/s);
  assert.match(css, /\.session-tab-runtime-action\.is-ready\s*\{/);
  assert.match(css, /\.session-tab-runtime-action\[data-provenance="local_only"\],\s*\.session-tab-runtime-action\[data-provenance="local_only"\]\.is-ready\s*\{/);
  assert.match(css, /\.session-tab-runtime-action\[data-provenance="local_only"\],\s*\.session-tab-runtime-action\[data-provenance="local_only"\]\.is-ready\s*\{[\s\S]*linear-gradient\(180deg,\s*rgba\(252,\s*253,\s*254,\s*0\.99\),\s*rgba\(241,\s*244,\s*248,\s*0\.98\)\),[\s\S]*color:\s*rgba\(0,\s*0,\s*0,\s*0\.92\);/);
  assert.match(css, /\.session-tab-strip-action\[data-provenance="local_only"\]:active,\s*\.session-tab-runtime-action\[data-provenance="local_only"\]:active,\s*\.session-tab-runtime-action\[data-provenance="local_only"\]\.is-active-request\s*\{[\s\S]*linear-gradient\(180deg,\s*rgba\(233,\s*238,\s*244,\s*0\.99\),\s*rgba\(221,\s*227,\s*234,\s*0\.98\)\),[\s\S]*transform:\s*translateY\(1px\);/);
  assert.match(css, /\.session-tab-runtime-action\[data-provenance="local_only"\]:disabled\s*\{[\s\S]*linear-gradient\(180deg,\s*rgba\(249,\s*250,\s*252,\s*0\.98\),\s*rgba\(242,\s*245,\s*248,\s*0\.96\)\),[\s\S]*color:\s*rgba\(0,\s*0,\s*0,\s*0\.5\);/);
  assert.match(css, /\.session-tab-runtime-action\.has-action-provenance,\s*\.session-tab-runtime-action\.has-action-provenance\.is-ready\s*\{/);
  assert.match(css, /\.session-tab-runtime-action\.has-action-provenance,\s*\.session-tab-runtime-action\.has-action-provenance\.is-ready\s*\{[\s\S]*background:\s*rgba\(204,\s*185,\s*180,\s*0\.98\);[\s\S]*color:\s*rgba\(0,\s*0,\s*0,\s*0\.92\);/);
  assert.match(css, /\.session-tab-strip-action\.has-action-provenance:active,\s*\.session-tab-runtime-action\.has-action-provenance:active,\s*\.session-tab-runtime-action\.has-action-provenance\.is-active-request\s*\{[\s\S]*background:\s*rgba\(154,\s*132,\s*126,\s*0\.98\);[\s\S]*color:\s*rgba\(0,\s*0,\s*0,\s*0\.92\);[\s\S]*transform:\s*translateY\(1px\);/);
  assert.match(css, /\.session-tab-runtime-action\.has-action-provenance:disabled\s*\{[\s\S]*background:\s*rgba\(224,\s*214,\s*211,\s*0\.98\);[\s\S]*color:\s*rgba\(0,\s*0,\s*0,\s*0\.5\);[\s\S]*opacity:\s*1;/);
  assert.match(css, /\.session-tab-runtime-action\.is-pending-hook\s*\{/);
  assert.match(css, /\.session-tab-action-menu-toggle\s*\{[\s\S]*min-width:\s*52px[\s\S]*gap:\s*4px[\s\S]*padding:\s*0 10px;/);
  assert.match(css, /body\.juggernaut-shell \.brand-strip \.session-tab-action-menu-toggle\s*\{[\s\S]*min-width:\s*52px[\s\S]*gap:\s*4px[\s\S]*padding:\s*0 10px;/);
  assert.match(css, /\.session-tab-action-menu-panel\s*\{/);
  assert.match(css, /\.session-tab-action-menu-item\s*\{/);
  assert.match(css, /body\.juggernaut-shell \.brand-strip \.session-tab-fork-indicator\s*\{[\s\S]*background:/s);
  assert.match(css, /body\.juggernaut-shell \.brand-strip \.session-tab-fork-indicator\s*\{/);
  assert.match(css, /@keyframes\s+sessionTabBusyPulse/);
  assert.match(css, /@keyframes\s+sessionTabReviewPulse/);
  assert.match(css, /@keyframes\s+sessionTabReviewSpinner/);
});
