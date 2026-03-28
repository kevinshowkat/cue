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
    /class=\"brand-strip\"[^>]*role=\"toolbar\"[\s\S]*class=\"window-drag-region\"[^>]*data-tauri-drag-region[\s\S]*id=\"session-tab-strip\"[\s\S]*class=\"session-tab-run\"[\s\S]*id=\"session-tab-list\"[^>]*role=\"tablist\"[\s\S]*id=\"session-tab-new\"[\s\S]*id=\"session-tab-fork\"[\s\S]*id=\"session-tab-design-review\"[\s\S]*id=\"juggernaut-export-psd\"/
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
  assert.equal(brandStripChunk.includes('id="session-tab-design-review"'), true);
  assert.equal(brandStripChunk.includes('id="session-tab-strip-shell-head-placeholder"'), false);
});

test("Session tab strip seeds a visible launch tab and keeps history on a dedicated shelf below the titlebar", () => {
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
    /id=\"session-tab-design-review\"[^>]*class=\"session-tab-strip-action session-tab-strip-pill-action session-tab-strip-review\"[^>]*data-provenance=\"external_model\"[^>]*aria-label=\"Design Review\"[^>]*title=\"Design Review\"[\s\S]*data-juggernaut-icon-slot=\"design_review\"[\s\S]*<span>Design Review<\/span>/
  );
  assert.match(
    html,
    /id=\"juggernaut-agent-runner-open\"[^>]*class=\"session-tab-strip-action session-tab-strip-icon-action session-tab-runtime-action session-tab-runtime-icon-action\"[^>]*data-provenance=\"external_model\"[^>]*aria-label=\"Agent Run\"[^>]*title=\"Agent Run\"[\s\S]*data-juggernaut-icon-slot=\"agent_run\"/
  );
  assert.doesNotMatch(html, /id=\"juggernaut-agent-runner-open\"[\s\S]*<span>Agent Run<\/span>/);
  assert.match(
    html,
    /id=\"juggernaut-export-psd\"[^>]*class=\"session-tab-strip-action session-tab-strip-pill-action session-tab-runtime-action session-tab-action-menu-toggle\"[^>]*data-provenance=\"local_only\"[^>]*title=\"Export\"[\s\S]*data-juggernaut-icon-slot=\"export\"[\s\S]*<span>Export<\/span>[\s\S]*class=\"session-tab-action-menu-caret\"/
  );
  assert.match(
    html,
    /id=\"juggernaut-export-menu\"[^>]*role=\"menu\"[^>]*aria-label=\"Export formats\"[\s\S]*id=\"juggernaut-export-format-psd\"[\s\S]*<span class=\"session-tab-action-menu-item-label\">PSD<\/span>[\s\S]*id=\"juggernaut-export-format-png\"[\s\S]*<span class=\"session-tab-action-menu-item-label\">PNG<\/span>/
  );
  assert.match(
    html,
    /id=\"timeline-toggle\"[^>]*class=\"timeline-toggle\"[^>]*aria-label=\"Collapse history timeline\"[^>]*aria-controls=\"timeline-body\"[^>]*aria-expanded=\"true\"[^>]*title=\"Collapse history timeline\"[\s\S]*data-juggernaut-icon-slot=\"history\"[\s\S]*id=\"timeline-toggle-label\"[\s\S]*>History<\/span>[\s\S]*id=\"timeline-toggle-summary\"/
  );
  const brandStripStart = html.indexOf('<div class="brand-strip"');
  const mainStart = html.indexOf("<main", brandStripStart);
  const brandStripChunk = html.slice(brandStripStart, mainStart);
  assert.match(
    brandStripChunk,
    /class=\"session-tab-run\"[\s\S]*id=\"session-tab-list\"[\s\S]*id=\"session-tab-new\"[\s\S]*id=\"session-tab-fork\"[\s\S]*class=\"session-tab-strip-actions\"[\s\S]*id=\"juggernaut-agent-runner-open\"[\s\S]*id=\"session-tab-design-review\"[\s\S]*id=\"juggernaut-export-psd\"/
  );
  assert.equal(brandStripChunk.includes('data-tab-id="tab-launch"'), true);
  assert.equal(brandStripChunk.includes('data-tab-id="tab-hero"'), false);
  assert.equal(brandStripChunk.includes('data-tab-id="tab-cleanup"'), false);
});

test("Session tab strip seeds generated icon slots for new, fork, and titlebar actions", () => {
  const newButtonStart = html.indexOf('id="session-tab-new"');
  const forkButtonStart = html.indexOf('id="session-tab-fork"', newButtonStart);
  assert.ok(newButtonStart >= 0 && forkButtonStart > newButtonStart, "expected new-session button before fork button");
  const newButtonChunk = html.slice(newButtonStart, forkButtonStart);
  assert.match(newButtonChunk, /session-tab-strip-icon-action/);
  assert.match(newButtonChunk, /data-provenance=\"local_only\"/);
  assert.match(newButtonChunk, /data-juggernaut-icon-slot=\"new_session\"/);
  assert.match(newButtonChunk, /class=\"session-tab-action-icon\"/);
  assert.doesNotMatch(newButtonChunk, /<svg/);
  const forkButtonChunk = html.slice(forkButtonStart, html.indexOf('</button>', forkButtonStart));
  assert.match(forkButtonChunk, /session-tab-strip-icon-action/);
  assert.match(forkButtonChunk, /data-provenance=\"local_only\"/);
  assert.match(forkButtonChunk, /data-juggernaut-icon-slot=\"fork_session\"/);
  assert.doesNotMatch(forkButtonChunk, /<svg/);
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
  assert.match(css, /\.session-tab-review-icon\s*\{/);
  assert.match(css, /\.session-tab-review-icon svg\s*\{/);
  assert.match(css, /\.session-tab-review-spinner\s*\{/);
  assert.match(css, /\.session-tab-review-icon\.is-ready\s*\{/);
  assert.match(css, /\.session-tab-review-icon\.is-failed\s*\{/);
  assert.match(css, /\.session-tab-item\.is-review-applying\s*\{/);
  assert.match(css, /\.session-tab-item\.is-review-progress\s+\.session-tab-busy-indicator\s*\{/);
  assert.match(css, /\.session-tab-rename-shell\s*\{/);
  assert.match(css, /\.session-tab-title-row\s*\{/);
  assert.match(css, /\.session-tab-fork-indicator\s*\{[\s\S]*border-radius:\s*999px[\s\S]*background:/s);
  assert.match(css, /\.session-tab-action-icon\s*\{/);
  assert.match(css, /\.session-tab-action-icon \.tool-icon\s*\{/);
  assert.match(css, /\.session-tab-fork-indicator\s*\{/);
  assert.match(css, /\.session-tab-title-input\s*\{/);
  assert.match(css, /\.session-tab-close\s*\{/);
  assert.match(css, /\.session-tab-strip-new\s*\{/);
  assert.match(css, /\.session-tab-strip-fork\s*\{/);
  assert.match(css, /\.session-tab-strip-review\s*\{/);
  assert.match(css, /\.session-tab-runtime-action\s*\{/);
  assert.match(css, /#juggernaut-agent-runner-open \.session-tab-action-icon \.tool-icon\s*\{[\s\S]*transform:\s*translateX\(0\.75px\);/);
  assert.match(css, /Shell button chassis unification: one neutral material, provenance via badge, variance only by form factor\./);
  assert.match(css, /--jg-shell-button-border:\s*var\(--jg-pack-border\);/);
  assert.match(css, /--jg-shell-button-border-active:\s*var\(--jg-pack-border-strong\);/);
  assert.match(css, /--jg-shell-button-fill:[\s\S]*var\(--jg-pack-surface\);/);
  assert.match(css, /--jg-shell-button-fill-active:[\s\S]*var\(--jg-pack-surface-deep\);/);
  assert.match(css, /--jg-shell-button-badge:\s*var\(--jg-pack-secondary\);/);
  assert.match(
    css,
    /body\.juggernaut-shell \.tool\[data-provenance\]:not\(\.juggernaut-tool\),[\s\S]*body\.juggernaut-shell \.brand-strip \.session-tab-strip-action\.has-action-provenance,[\s\S]*background:\s*var\(--jg-shell-button-fill\);[\s\S]*color:\s*var\(--jg-shell-button-ink\);[\s\S]*box-shadow:\s*var\(--jg-shell-button-shadow\);/s
  );
  assert.match(
    css,
    /body\.juggernaut-shell \.brand-strip \.session-tab-runtime-action\[data-provenance="local_only"\]:hover:not\(:disabled\):not\(\.is-active-request\):not\(\.is-open\):not\(\[aria-pressed="true"\]\):not\(\.depressed\),[\s\S]*body\.juggernaut-shell \.brand-strip \.session-tab-strip-action\.has-action-provenance:focus-visible,[\s\S]*transform:\s*none;[\s\S]*background:\s*var\(--jg-shell-button-fill-hover\);[\s\S]*box-shadow:\s*var\(--jg-shell-button-shadow-hover\);/s
  );
  assert.match(
    css,
    /body\.juggernaut-shell \.brand-strip \.session-tab-strip-action:active,[\s\S]*body\.juggernaut-shell \.brand-strip \.session-tab-strip-action\.is-open,[\s\S]*transform:\s*translate3d\(0,\s*1px,\s*0\);[\s\S]*background:\s*var\(--jg-shell-button-fill-active\);[\s\S]*box-shadow:\s*var\(--jg-shell-button-shadow-active\);/s
  );
  assert.match(
    css,
    /body\.juggernaut-shell \.brand-strip \.session-tab-strip-action:disabled,[\s\S]*body\.juggernaut-shell \.brand-strip \.session-tab-runtime-action\.has-action-provenance:disabled\s*\{[\s\S]*background:\s*var\(--jg-shell-button-fill-disabled\);[\s\S]*color:\s*var\(--jg-shell-button-ink-muted\);[\s\S]*opacity:\s*0\.72;/s
  );
  assert.match(css, /body\.juggernaut-shell \.brand-strip \.session-tab-strip-icon-action,[\s\S]*width:\s*34px[\s\S]*min-width:\s*34px[\s\S]*padding:\s*0[\s\S]*border-radius:\s*10px;/s);
  assert.match(css, /body\.juggernaut-shell \.brand-strip \.session-tab-strip-pill-action\.has-action-provenance[\s\S]*gap:\s*7px[\s\S]*padding:\s*0 12px[\s\S]*border-radius:\s*10px;/s);
  assert.match(css, /body\.juggernaut-shell \.brand-strip \.session-tab-strip-pill-action > span:not\(\.sr-only\)\s*\{[\s\S]*font-weight:\s*600;/s);
  assert.match(css, /body\.juggernaut-shell \.brand-strip \.session-tab-action-menu-toggle\.has-action-provenance[\s\S]*gap:\s*6px[\s\S]*padding:\s*0 12px;/s);
  assert.match(css, /body\.juggernaut-shell \.session-tab-strip-action \.action-provenance-model-dot\s*\{[\s\S]*top:\s*6px[\s\S]*right:\s*6px[\s\S]*width:\s*6px[\s\S]*height:\s*6px;/s);
  assert.match(css, /body\.juggernaut-shell \.action-provenance-model-dot\s*\{[\s\S]*radial-gradient\(circle at 32% 28%,[\s\S]*var\(--jg-shell-button-badge\);/s);
  assert.doesNotMatch(css, /:root:not\(\[data-rail-icon-pack="default_classic"\]\) body\.juggernaut-shell \.brand-strip \.session-tab-strip-action\.is-external-model/);
  assert.match(css, /\.session-tab-runtime-action\.is-pending-hook\s*\{/);
  assert.match(css, /\.session-tab-action-menu-panel\s*\{/);
  assert.match(css, /\.session-tab-action-menu-item\s*\{/);
  assert.match(css, /body\.juggernaut-shell \.brand-strip \.session-tab-fork-indicator\s*\{[\s\S]*background:/s);
  assert.match(css, /body\.juggernaut-shell \.brand-strip \.session-tab-fork-indicator\s*\{/);
  assert.match(css, /body\.juggernaut-shell \.brand-strip \.session-tab-item\.is-review-applying\s*\{/);
  assert.match(css, /body\.juggernaut-shell \.brand-strip \.session-tab-review-icon\s*\{/);
  assert.match(css, /body\.juggernaut-shell \.brand-strip \.session-tab-review-icon\.is-ready\s*\{/);
  assert.match(css, /@keyframes\s+sessionTabBusyPulse/);
  assert.match(css, /@keyframes\s+sessionTabReviewPulse/);
  assert.match(css, /@keyframes\s+sessionTabReviewSpinner/);
});

test("Timeline shelf CSS keeps a visible collapsed stub with an in-dock toggle", () => {
  assert.match(css, /\.timeline-dock\s*\{[\s\S]*width:\s*min\(32vw,\s*420px\)/);
  assert.match(css, /@media\s*\(max-width:\s*980px\)\s*\{[\s\S]*\.timeline-dock\s*\{[\s\S]*width:\s*min\(48vw,\s*420px\)/);
  assert.doesNotMatch(css, /\.timeline-dock\.is-collapsed\s*\{[\s\S]*width:/);
  assert.match(css, /\.timeline-toggle\s*\{[\s\S]*min-height:\s*38px[\s\S]*grid-template-columns:\s*auto minmax\(0,\s*1fr\) auto/);
  assert.match(css, /\.timeline-toggle-summary\s*\{[\s\S]*font-family:\s*"IBM Plex Mono", monospace[\s\S]*text-overflow:\s*ellipsis/);
  assert.match(css, /\.timeline-shell:not\(\.is-collapsed\) \.timeline-toggle-chevron\s*\{[\s\S]*rotate\(180deg\)/);
  assert.match(css, /\.timeline-body\s*\{[\s\S]*display:\s*grid[\s\S]*gap:\s*6px/);
  assert.match(css, /\.timeline-shell\.is-collapsed \.timeline-body\s*\{[\s\S]*display:\s*none/);
});
