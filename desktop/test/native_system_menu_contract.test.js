import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(
  new URL("../src-tauri/src/main.rs", import.meta.url),
  "utf8"
);
const appSource = readFileSync(
  new URL("../src/canvas_app.js", import.meta.url),
  "utf8"
);

test("native system menu defines file, tools, and shortcuts menus", () => {
  assert.match(source, /Submenu::new\("File", build_file_menu\(\)\)/);
  assert.match(source, /Submenu::new\("Tools", build_tools_menu\(\)\)/);
  assert.match(source, /Submenu::new\("Shortcuts", build_shortcuts_menu\(\)\)/);
  assert.match(source, /MENU_FILE_SAVE_SESSION/);
  assert.match(source, /MENU_TOOLS_SLOT_PREFIX/);
  assert.match(source, /MENU_SHORTCUTS_SLOT_PREFIX/);
});

test("native system menu exposes a sync command for dynamic slot state", () => {
  assert.match(source, /fn sync_native_menu_state\(/);
  assert.match(source, /sync_native_menu_slots\(/);
  assert.match(source, /sync_native_menu_state,/);
});

test("native tools menu mirrors communication rail tools before custom tools", () => {
  assert.match(
    appSource,
    /const NATIVE_MENU_COMMUNICATION_TOOLS = Object\.freeze\(\[[\s\S]*Marker[\s\S]*Highlight[\s\S]*Magic Select[\s\S]*Make Space[\s\S]*Eraser[\s\S]*\]\);/
  );
  assert.match(
    appSource,
    /function buildNativeToolSlots\(\) \{[\s\S]*NATIVE_MENU_COMMUNICATION_TOOLS[\s\S]*visibleCustomTools = sessionToolRegistry\.visible\(\{ limit: customToolLimit \}\)[\s\S]*kind: "communication_tool"/
  );
  assert.match(
    appSource,
    /function buildNativeToolSlots\(\) \{[\s\S]*visibleCustomTools = sessionToolRegistry\.visible\(\{ limit: customToolLimit \}\)[\s\S]*kind: "custom_tool"/
  );
  assert.match(
    appSource,
    /async function runNativeToolSlot\(index = -1\) \{[\s\S]*slot\.kind === "communication_tool"[\s\S]*setCommunicationTool\(toolId, \{ source: "native_menu" \}\)[\s\S]*invokeRegisteredTool\(toolId, \{/
  );
});
