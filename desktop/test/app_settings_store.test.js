import { test } from "node:test";
import assert from "node:assert/strict";

import { createCanvasAppSettingsStore, loadCanvasAppSettings } from "../src/app/settings_store.js";

function createStorage(seed = {}) {
  const data = new Map(Object.entries(seed));
  return {
    getItem(key) {
      return data.has(key) ? data.get(key) : null;
    },
    setItem(key, value) {
      data.set(key, String(value));
    },
    snapshot() {
      return Object.fromEntries(data.entries());
    },
  };
}

test("settings store: initial load preserves legacy keys and migrates the old default image model", () => {
  const storage = createStorage({
    "brood.memory": "1",
    "brood.textModel": "gpt-5.4",
    "brood.imageModel": "gemini-2.5-flash-image",
    "brood.promptStrategyMode.v1": "baseline",
    "brood.promptRepeatFull.v1": "1",
    "brood.installTelemetry.optIn.v1": "1",
    "juggernaut.railIconPack.v1": "bad-pack",
  });

  const settings = loadCanvasAppSettings({
    storage,
    normalizeRailIconPackId: (value) => (value === "oscillo_ink" ? value : "default_classic"),
    defaultRailIconPackId: "default_classic",
    defaultTextModel: "gpt-5.2",
    defaultImageModel: "gemini-3-pro-image-preview",
    legacyDefaultImageModel: "gemini-2.5-flash-image",
  });

  assert.deepEqual(settings, {
    memory: true,
    alwaysOnVision: false,
    railIconPack: "default_classic",
    textModel: "gpt-5.4",
    imageModel: "gemini-3-pro-image-preview",
    promptStrategyMode: "baseline",
    promptRepeatFull: true,
    installTelemetryOptIn: true,
  });
  assert.equal(storage.getItem("brood.imageModel"), "gemini-3-pro-image-preview");
  assert.equal(storage.getItem("brood.imageModel.default.v2"), "1");
});

test("settings store: setters persist normalized values and notify subscribers", () => {
  const storage = createStorage();
  const store = createCanvasAppSettingsStore({
    storage,
    normalizeRailIconPackId: (value) => (value === "oscillo_ink" ? value : "default_classic"),
    defaultRailIconPackId: "default_classic",
  });
  const seen = [];
  store.subscribe((state) => {
    seen.push(state);
  });

  assert.equal(store.setRailIconPack("oscillo_ink"), "oscillo_ink");
  assert.equal(store.setPromptStrategyMode("not-a-real-mode"), "tail");
  assert.equal(store.setPromptRepeatFull(true), true);
  assert.equal(store.setInstallTelemetryOptIn(true), true);
  assert.equal(store.setImageModel("gpt-image-1.5"), "gpt-image-1.5");

  assert.equal(storage.getItem("juggernaut.railIconPack.v1"), "oscillo_ink");
  assert.equal(storage.getItem("brood.promptStrategyMode.v1"), "tail");
  assert.equal(storage.getItem("brood.promptRepeatFull.v1"), "1");
  assert.equal(storage.getItem("brood.installTelemetry.optIn.v1"), "1");
  assert.equal(storage.getItem("brood.imageModel"), "gpt-image-1.5");
  assert.equal(storage.getItem("brood.imageModel.default.v2"), "1");
  assert.equal(seen.at(-1)?.imageModel, "gpt-image-1.5");
});
