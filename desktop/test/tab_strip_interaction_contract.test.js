import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const appPath = join(here, "..", "src", "canvas_app.js");
const app = readFileSync(appPath, "utf8");

test("Titlebar tab strip binds live DOM ids and renders from the tab snapshot", () => {
  assert.match(app, /sessionTabStrip:\s*document\.getElementById\("session-tab-strip"\)/);
  assert.match(app, /sessionTabList:\s*document\.getElementById\("session-tab-list"\)/);
  assert.match(app, /sessionTabOpen:\s*document\.getElementById\("session-tab-open"\)/);
  assert.match(app, /sessionTabNew:\s*document\.getElementById\("session-tab-new"\)/);
  assert.match(app, /sessionTabDesignReview:\s*document\.getElementById\("session-tab-design-review"\)/);
  assert.match(app, /function renderSessionTabStrip\(/);
  assert.match(app, /function createSessionTabStripPlaceholderItem\(/);
  assert.match(app, /if \(!tabs\.length\) \{[\s\S]*createSessionTabStripPlaceholderItem\(\)/s);
  assert.match(app, /els\.sessionTabList\.replaceChildren\(fragment\)/);
  assert.match(app, /releaseSessionTabStripSubscription\s*=\s*subscribeTabs\(\(snapshot\)\s*=>\s*{\s*renderSessionTabStrip\(snapshot\);/);
  assert.match(app, /const uiMeta = normalizeTabUiMeta\(record\?\.tabUiMeta \|\| record\?\.session\?\.tabUiMeta\);/);
  assert.match(app, /const title = sessionTabDisplayLabel\(record \|\| tab,\s*DEFAULT_UNTITLED_TAB_TITLE\);/);
});

test("Titlebar tab strip routes activate, close, open, new, and design review actions", () => {
  assert.match(app, /els\.sessionTabList\.addEventListener\("click",\s*\(event\)\s*=>\s*{/);
  assert.match(app, /closest\("\.session-tab-title"\)/);
  assert.match(app, /const isActive = String\(item\?\.dataset\?\.active \|\| ""\)\.trim\(\) === "true";/);
  assert.match(
    app,
    /if \(!isActive\) \{[\s\S]*void activateTab\(tabId,\s*\{\s*spawnEngine:\s*true,\s*reason:\s*"titlebar_tab_click"\s*\}\)\.catch/s
  );
  assert.match(app, /startSessionTabRename\(tabId\);/);
  assert.match(app, /closest\("\.session-tab-close"\)/);
  assert.match(app, /void closeTab\(tabId\)\.catch/);
  assert.match(app, /closest\("\.session-tab-hit"\)/);
  assert.match(app, /void activateTab\(tabId,\s*\{\s*spawnEngine:\s*true,\s*reason:\s*"titlebar_tab_click"\s*\}\)\.catch/);
  assert.match(app, /els\.sessionTabOpen\.addEventListener\("click"/);
  assert.match(app, /runWithUserError\("Open session",\s*\(\)\s*=>\s*openExistingRun\(\)/);
  assert.match(app, /els\.sessionTabNew\.addEventListener\("click"/);
  assert.match(app, /runWithUserError\("New session",\s*\(\)\s*=>\s*createRun\(\)/);
  assert.match(app, /els\.sessionTabDesignReview\.addEventListener\("click"/);
});

test("Titlebar tab strip supports inline rename and review-state badges", () => {
  assert.match(app, /function startSessionTabRename\(tabId = ""\)/);
  assert.match(app, /if \(normalizedTabId !== String\(state\.activeTabId \|\| ""\)\.trim\(\)\) return false;/);
  assert.match(app, /lockedWidth:\s*0/);
  assert.match(app, /sessionTabRenameState\.lockedWidth/);
  assert.match(app, /function commitSessionTabRename\(tabId = "", rawTitle = sessionTabRenameState\.draft\)/);
  assert.match(app, /className = "session-tab-review-state"/);
  assert.match(app, /className = "session-tab-rename-shell"/);
  assert.match(app, /className = "session-tab-title-input"/);
  assert.match(app, /input\.maxLength = SESSION_TAB_TITLE_MAX_LENGTH;/);
  assert.match(app, /focusSessionTabRenameInput\(\);/);
  assert.equal(app.includes('dirtyDot.className = "session-tab-dirty-dot"'), false);
});
