import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { JUGGERNAUT_RAIL_ICON_REGISTRY } from "../src/juggernaut_shell/generated/rail_icon_registry.js";

const here = dirname(fileURLToPath(import.meta.url));
const manifest = JSON.parse(
  readFileSync(join(here, "..", "src", "assets", "juggernaut-rail-icons", "manifest.json"), "utf8")
);
const railSource = readFileSync(join(here, "..", "src", "juggernaut_shell", "rail.js"), "utf8");

test("Juggernaut rail iconography: manifest covers the shared generated glyph set", () => {
  const actualIds = manifest.icons.map((icon) => icon.tool_id).sort();
  const expectedIds = [
    "background_swap",
    "cleanup",
    "create_tool",
    "export_psd",
    "make_space",
    "move",
    "polish",
    "protect",
    "relight",
    "remove_people",
    "select_subject",
    "upload",
    "variations",
  ].sort();
  assert.deepEqual(actualIds, expectedIds);
  assert.equal(manifest.style.id, "juggernaut.rail_iconography.v1");
});

test("Juggernaut rail iconography: generated registry exports custom SVG glyphs", () => {
  assert.equal(typeof JUGGERNAUT_RAIL_ICON_REGISTRY.upload, "string");
  assert.match(JUGGERNAUT_RAIL_ICON_REGISTRY.select_subject, /tool-icon-select-subject/);
  assert.match(JUGGERNAUT_RAIL_ICON_REGISTRY.background_swap, /fill-opacity=/);
  assert.match(JUGGERNAUT_RAIL_ICON_REGISTRY.protect, /tool-icon-protect/);
  assert.match(JUGGERNAUT_RAIL_ICON_REGISTRY.make_space, /tool-icon-make-space/);
  assert.match(JUGGERNAUT_RAIL_ICON_REGISTRY.remove_people, /tool-icon-remove-people/);
  assert.match(JUGGERNAUT_RAIL_ICON_REGISTRY.polish, /tool-icon-polish/);
  assert.match(JUGGERNAUT_RAIL_ICON_REGISTRY.relight, /tool-icon-relight/);
});

test("Juggernaut rail iconography: rail rendering consumes generated registry and uses keyed slots", () => {
  assert.match(railSource, /getJuggernautRailIconSvg/);
  assert.match(railSource, /toolEl\.dataset\.toolKey/);
  assert.match(railSource, /className = "tool juggernaut-tool juggernaut-rail-button"/);
  assert.match(railSource, /toolEl\.addEventListener\("pointerdown"/);
  assert.match(railSource, /toolEl\.classList\.add\("is-pressing"\)/);
  assert.match(railSource, /scheduleRailPressRelease\(160\)/);
  assert.match(railSource, /toolEl\.dataset\.slotKey/);
  assert.match(railSource, /root\.insertBefore\(toolEl,\s*cursor \|\| null\)/);
  assert.doesNotMatch(railSource, /root\.innerHTML = "";/);
});
