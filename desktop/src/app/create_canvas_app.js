import { createCanvasAppDom, validateCanvasAppBootDom } from "./dom.js";
import { createCanvasAppSettingsStore } from "./settings_store.js";
import { createCanvasAppStore } from "./store.js";

function createInitialCanvasAppState(settings = {}) {
  return {
    boot: {
      phase: "idle",
      error: null,
    },
    settings,
    tabs: {
      order: [],
      byId: new Map(),
      activeTabId: null,
    },
    input: {},
    runtime: {
      ready: false,
    },
    ui: {},
  };
}

function setBootDomState(documentObj, phase, error = null) {
  const body = documentObj?.body || null;
  if (body?.classList) {
    body.classList.toggle("boot-pending", phase === "booting");
    body.classList.toggle("boot-failed", phase === "failed");
  }
  const bootError = documentObj?.getElementById?.("boot-error") || null;
  if (bootError?.classList) {
    bootError.classList.toggle("hidden", phase !== "failed");
  }
  if (bootError && phase === "failed" && error?.message) {
    bootError.textContent = `Cue failed to initialize. ${error.message}`;
  }
}

export function createCanvasApp({
  documentObj = globalThis.document,
  storage = globalThis.localStorage,
  dom: providedDom = null,
  settingsStore: providedSettingsStore = null,
  domFactory = createCanvasAppDom,
  settingsStoreFactory = createCanvasAppSettingsStore,
  storeFactory = createCanvasAppStore,
  installBridges = [],
  onBoot = null,
  onFatalBootError = null,
  ...settingsOptions
} = {}) {
  const dom = providedDom || domFactory(documentObj);
  const settingsStore =
    providedSettingsStore ||
    settingsStoreFactory({
      storage,
      ...settingsOptions,
    });
  const store = storeFactory(createInitialCanvasAppState(settingsStore.getState()));

  if (typeof settingsStore?.subscribe === "function") {
    settingsStore.subscribe((settings) => {
      store.patchState({ settings });
    });
  }

  function setBootState(phase, error = null) {
    store.patchState({
      boot: {
        phase,
        error,
      },
    });
    setBootDomState(documentObj, phase, error);
  }

  async function boot() {
    setBootState("booting", null);
    try {
      validateCanvasAppBootDom(dom);
      for (const installBridge of Array.isArray(installBridges) ? installBridges : []) {
        if (typeof installBridge !== "function") continue;
        await installBridge({ dom, settingsStore, store });
      }
      if (typeof onBoot === "function") {
        await onBoot({ dom, settingsStore, store });
      }
      store.patchState({
        runtime: {
          ...(store.getState()?.runtime || {}),
          ready: true,
        },
      });
      setBootState("ready", null);
      return api;
    } catch (error) {
      setBootState("failed", error);
      if (typeof onFatalBootError === "function") {
        onFatalBootError({ error, dom, settingsStore, store });
      }
      throw error;
    }
  }

  const api = {
    dom,
    settingsStore,
    store,
    boot,
  };
  return api;
}
