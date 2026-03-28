import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const rust = readFileSync(join(here, "..", "src-tauri", "src", "main.rs"), "utf8");

test("Native window polish disables whole-window background dragging", () => {
  assert.match(rust, /setMovableByWindowBackground_\(NO\);/);
});

test("Native window polish keeps explicit macOS titlebar treatment", () => {
  assert.match(rust, /setTitlebarAppearsTransparent_\(YES\);/);
  assert.match(rust, /setToolbarStyle_\(NSWindowToolbarStyle::NSWindowToolbarStyleUnifiedCompact\)/);
});
