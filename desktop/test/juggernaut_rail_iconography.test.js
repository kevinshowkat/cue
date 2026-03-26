import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  DEFAULT_JUGGERNAUT_RAIL_ICON_PACK_ID,
  JUGGERNAUT_RAIL_ICON_PACK_ASSET_URLS,
  JUGGERNAUT_RAIL_ICON_ASSET_URLS,
  getJuggernautRailIconAssetUrl,
  getJuggernautRailIconMarkup,
} from "../src/juggernaut_shell/generated/rail_icon_registry.js";

const here = dirname(fileURLToPath(import.meta.url));
const manifest = JSON.parse(
  readFileSync(join(here, "..", "src", "assets", "juggernaut-rail-icons", "manifest.json"), "utf8")
);
const railSource = readFileSync(join(here, "..", "src", "juggernaut_shell", "rail.js"), "utf8");
const appSource = readFileSync(join(here, "..", "src", "canvas_app.js"), "utf8");

test("Juggernaut rail iconography: manifest covers the shared generated glyph set", () => {
  const actualIds = manifest.icons.map((icon) => icon.tool_id).sort();
  const expectedIds = [
    "agent_run",
    "cleanup",
    "create_tool",
    "design_review",
    "export",
    "fork_session",
    "history",
    "make_space",
    "move",
    "new_session",
    "protect",
    "reframe",
    "remove_people",
    "select_region",
    "select_subject",
    "upload",
    "variations",
  ].sort();
  assert.deepEqual(actualIds, expectedIds);
  assert.equal(manifest.style.id, "juggernaut.rail_iconography.v1");
  assert.equal(manifest.schema, "juggernaut.rail_icon_manifest.v3");
  assert.equal(manifest.default_pack_id, DEFAULT_JUGGERNAUT_RAIL_ICON_PACK_ID);
  assert.deepEqual(
    manifest.packs.map((pack) => pack.id),
    ["oscillo_ink", "industrial_mono", "painterly_folk", "kinetic_marker"]
  );
  for (const pack of manifest.packs) {
    assert.deepEqual(
      pack.icons.map((icon) => icon.tool_id).sort(),
      expectedIds
    );
    assert.equal(typeof pack.prompt_style, "string");
    assert.ok(pack.prompt_style.length > 20);
    assert.equal(typeof pack.icons[0]?.gemini_prompt, "string");
    assert.equal(pack.icons[0]?.asset_kind, "mask_png");
    assert.equal(typeof pack.icons[0]?.effective_prompt, "string");
  }
  assert.equal(DEFAULT_JUGGERNAUT_RAIL_ICON_PACK_ID, "oscillo_ink");
});

test("Juggernaut rail iconography: generated registry exports provider-backed asset packs", () => {
  assert.equal(typeof JUGGERNAUT_RAIL_ICON_ASSET_URLS.upload, "string");
  assert.equal(typeof JUGGERNAUT_RAIL_ICON_PACK_ASSET_URLS.oscillo_ink.upload, "string");
  assert.equal(typeof JUGGERNAUT_RAIL_ICON_PACK_ASSET_URLS.kinetic_marker.upload, "string");
  assert.match(JUGGERNAUT_RAIL_ICON_ASSET_URLS.upload, /upload\.png$/);
  assert.match(JUGGERNAUT_RAIL_ICON_PACK_ASSET_URLS.oscillo_ink.upload, /oscillo_ink\/upload\.png$/);
  assert.match(JUGGERNAUT_RAIL_ICON_PACK_ASSET_URLS.painterly_folk.upload, /painterly_folk\/upload\.png$/);
  assert.match(getJuggernautRailIconMarkup("upload", "oscillo_ink"), /tool-icon-mask/);
  assert.match(getJuggernautRailIconMarkup("upload", "oscillo_ink"), /tool-icon-pack-oscillo-ink/);
  assert.match(getJuggernautRailIconMarkup("select_region", DEFAULT_JUGGERNAUT_RAIL_ICON_PACK_ID), /tool-icon-select-region/);
  assert.match(getJuggernautRailIconMarkup("reframe", DEFAULT_JUGGERNAUT_RAIL_ICON_PACK_ID), /tool-icon-reframe/);
  assert.match(getJuggernautRailIconMarkup("protect", DEFAULT_JUGGERNAUT_RAIL_ICON_PACK_ID), /tool-icon-protect/);
  assert.match(getJuggernautRailIconMarkup("make_space", DEFAULT_JUGGERNAUT_RAIL_ICON_PACK_ID), /tool-icon-make-space/);
  assert.match(getJuggernautRailIconMarkup("remove_people", DEFAULT_JUGGERNAUT_RAIL_ICON_PACK_ID), /tool-icon-remove-people/);
  assert.match(getJuggernautRailIconMarkup("create_tool", DEFAULT_JUGGERNAUT_RAIL_ICON_PACK_ID), /tool-icon-create-tool/);
  assert.match(getJuggernautRailIconMarkup("new_session", DEFAULT_JUGGERNAUT_RAIL_ICON_PACK_ID), /tool-icon-new-session/);
  assert.match(getJuggernautRailIconMarkup("fork_session", DEFAULT_JUGGERNAUT_RAIL_ICON_PACK_ID), /tool-icon-fork-session/);
  assert.match(getJuggernautRailIconMarkup("history", DEFAULT_JUGGERNAUT_RAIL_ICON_PACK_ID), /tool-icon-history/);
  assert.match(getJuggernautRailIconMarkup("agent_run", DEFAULT_JUGGERNAUT_RAIL_ICON_PACK_ID), /tool-icon-agent-run/);
  assert.match(getJuggernautRailIconMarkup("design_review", DEFAULT_JUGGERNAUT_RAIL_ICON_PACK_ID), /tool-icon-design-review/);
  assert.match(getJuggernautRailIconMarkup("export", DEFAULT_JUGGERNAUT_RAIL_ICON_PACK_ID), /tool-icon-export/);
  assert.notEqual(
    getJuggernautRailIconAssetUrl("upload", "oscillo_ink"),
    getJuggernautRailIconAssetUrl("upload", "kinetic_marker")
  );
});

test("Juggernaut rail iconography: rail rendering consumes generated registry and tracks the active pack", () => {
  assert.match(railSource, /getJuggernautRailIconMarkup/);
  assert.match(railSource, /renderActionProvenanceBadge/);
  assert.match(railSource, /is-external-model/);
  assert.match(railSource, /toolEl\.dataset\.toolKey/);
  assert.match(railSource, /toolEl\.dataset\.provenance/);
  assert.match(railSource, /className = "tool juggernaut-tool juggernaut-rail-button"/);
  assert.match(railSource, /toolEl\.addEventListener\("pointerdown"/);
  assert.match(railSource, /toolEl\.classList\.add\("is-pressing"\)/);
  assert.match(railSource, /scheduleRailPressRelease\(160\)/);
  assert.match(railSource, /toolEl\.dataset\.slotKey/);
  assert.match(railSource, /root\.dataset\.iconPack = activeRailIconPackId/);
  assert.match(railSource, /root\.insertBefore\(toolEl,\s*cursor \|\| null\)/);
  assert.doesNotMatch(railSource, /root\.innerHTML = "";/);

  const selectAnchorStart = railSource.indexOf('toolId: "select"');
  const selectRegionIconStart = railSource.indexOf('iconMarkup: railIconMarkup("select_region")', selectAnchorStart);
  const cutOutStart = railSource.indexOf('cut_out: Object.freeze({');
  const cutOutSubjectIconStart = railSource.indexOf('iconId: "select_subject"', cutOutStart);
  const reframeStart = railSource.indexOf('reframe: Object.freeze({');
  const reframeIconStart = railSource.indexOf('iconId: "reframe"', reframeStart);

  assert.ok(selectAnchorStart >= 0);
  assert.ok(selectRegionIconStart > selectAnchorStart);
  assert.ok(cutOutStart >= 0);
  assert.ok(cutOutSubjectIconStart > cutOutStart);
  assert.ok(reframeStart >= 0);
  assert.ok(reframeIconStart > reframeStart);
  assert.match(appSource, /getJuggernautRailIconMarkup\("create_tool", settings\.railIconPack\)/);
});
