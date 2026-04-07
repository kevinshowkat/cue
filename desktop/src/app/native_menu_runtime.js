import {
  buildNativeSystemMenuPayload,
  NATIVE_SHORTCUT_SLOT_COUNT,
  NATIVE_TOOLS_SLOT_COUNT,
} from "../system_menu_state.js";

function createNativeMenuBridgeState() {
  return {
    syncTimer: null,
    lastSignature: "",
    shortcutSlots: [],
    toolSlots: [],
  };
}

function resolveSessionToolRegistry(getSessionToolRegistry) {
  if (typeof getSessionToolRegistry === "function") {
    const registry = getSessionToolRegistry();
    if (registry && typeof registry === "object") return registry;
  }
  return null;
}

export function parseNativeSlotIndex(action = "", prefix = "") {
  const normalized = String(action || "").trim();
  if (!normalized.startsWith(prefix)) return -1;
  const index = Number(normalized.slice(prefix.length));
  if (!Number.isInteger(index) || index < 0) return -1;
  return index;
}

export function createNativeMenuRuntime({
  els = {},
  state = {},
  tabbedSessions = null,
  getSessionToolRegistry = null,
  invoke = null,
  applyJuggernautTool = null,
  invokeRegisteredTool = null,
  setCommunicationTool = null,
  currentTabSwitchBlockReason = null,
  getVisibleCanvasImages = null,
  nativeMenuCommunicationTools = [],
  setTimeoutFn = typeof setTimeout === "function" ? setTimeout : null,
  consoleObj = console,
  bridgeState = null,
} = {}) {
  const nativeMenuBridge =
    bridgeState && typeof bridgeState === "object" ? bridgeState : createNativeMenuBridgeState();

  function buildNativeMenuFileState() {
    const blockReason =
      typeof currentTabSwitchBlockReason === "function" ? currentTabSwitchBlockReason() : null;
    const hasActiveTab = Boolean(String(state.activeTabId || "").trim());
    const hasVisibleImages =
      typeof getVisibleCanvasImages === "function" ? getVisibleCanvasImages().length > 0 : false;
    return {
      canNewSession: !blockReason,
      canOpenSession: !blockReason,
      canSaveSession: hasActiveTab && !blockReason,
      canCloseSession:
        hasActiveTab &&
        Array.isArray(tabbedSessions?.tabsOrder) &&
        tabbedSessions.tabsOrder.length > 1 &&
        !blockReason,
      canExportSession: hasVisibleImages && !blockReason,
      canImportPhotos: true,
      canOpenSettings: true,
    };
  }

  function syncAppMenuState(fileState = buildNativeMenuFileState()) {
    if (els.newRun) els.newRun.disabled = !fileState.canNewSession;
    if (els.openRun) els.openRun.disabled = !fileState.canOpenSession;
    if (els.saveSession) els.saveSession.disabled = !fileState.canSaveSession;
    if (els.closeSession) els.closeSession.disabled = !fileState.canCloseSession;
    if (els.import) els.import.disabled = !fileState.canImportPhotos;
    if (els.export) els.export.disabled = !fileState.canExportSession;
    if (els.settingsToggle) els.settingsToggle.disabled = !fileState.canOpenSettings;
    return fileState;
  }

  function buildNativeShortcutSlots() {
    return nativeMenuBridge.shortcutSlots
      .slice(0, NATIVE_SHORTCUT_SLOT_COUNT)
      .map((slot) => ({
        label: String(slot?.label || "").trim() || "Shortcut",
        enabled: Boolean(slot?.enabled),
      }));
  }

  function buildNativeToolSlots() {
    const customToolLimit = Math.max(
      0,
      NATIVE_TOOLS_SLOT_COUNT - nativeMenuCommunicationTools.length
    );
    const registry = resolveSessionToolRegistry(getSessionToolRegistry);
    const visibleCustomTools =
      registry && typeof registry.visible === "function"
        ? registry.visible({ limit: customToolLimit })
        : [];
    const customToolSlots = Array.from({ length: customToolLimit }, (_, index) => {
      const tool = visibleCustomTools[index] || null;
      if (!tool) {
        return {
          kind: "custom_tool_placeholder",
          label: `Custom Tool Slot ${index + 1}`,
          enabled: false,
          toolId: null,
        };
      }
      return {
        kind: "custom_tool",
        label:
          String(tool?.label || tool?.shortLabel || tool?.toolId || "").trim() || "Custom Tool",
        enabled: Boolean(tool?.toolId),
        toolId: String(tool?.toolId || "").trim() || null,
      };
    });
    nativeMenuBridge.toolSlots = nativeMenuCommunicationTools
      .map((tool) => ({
        kind: "communication_tool",
        label: tool.label,
        enabled: true,
        toolId: tool.toolId,
      }))
      .concat(customToolSlots)
      .slice(0, NATIVE_TOOLS_SLOT_COUNT)
      .map((slot) => ({
        kind: String(slot?.kind || "").trim() || "tool",
        label: String(slot?.label || "").trim() || "Tool",
        enabled: Boolean(slot?.enabled),
        toolId: String(slot?.toolId || "").trim() || null,
      }));
    return nativeMenuBridge.toolSlots.map((slot) => ({
      label: slot.label,
      enabled: slot.enabled,
    }));
  }

  async function syncNativeSystemMenu() {
    const fileState = syncAppMenuState();
    const payload = buildNativeSystemMenuPayload({
      file: fileState,
      tools: buildNativeToolSlots(),
      shortcuts: buildNativeShortcutSlots(),
    });
    const signature = JSON.stringify(payload);
    if (nativeMenuBridge.lastSignature === signature) return;
    nativeMenuBridge.lastSignature = signature;
    if (typeof invoke !== "function") return;
    await invoke("sync_native_menu_state", { payload }).catch((error) => {
      nativeMenuBridge.lastSignature = "";
      consoleObj?.warn?.("native system menu sync failed", error);
    });
  }

  function queueNativeSystemMenuSync() {
    if (nativeMenuBridge.syncTimer) return;
    if (typeof setTimeoutFn !== "function") {
      void syncNativeSystemMenu();
      return;
    }
    nativeMenuBridge.syncTimer = setTimeoutFn(() => {
      nativeMenuBridge.syncTimer = null;
      void syncNativeSystemMenu();
    }, 0);
  }

  function cacheNativeShortcutSlots(buttons = []) {
    nativeMenuBridge.shortcutSlots = Array.isArray(buttons)
      ? buttons.slice(0, NATIVE_SHORTCUT_SLOT_COUNT).map((button) => ({
          label: String(button?.label || button?.toolId || "").trim() || "Shortcut",
          enabled: !Boolean(button?.disabled),
          toolId: String(button?.toolId || "").trim() || null,
        }))
      : [];
    queueNativeSystemMenuSync();
  }

  async function runNativeShortcutSlot(index = -1) {
    const slot = nativeMenuBridge.shortcutSlots[index] || null;
    const toolId = String(slot?.toolId || "").trim();
    if (!toolId || !slot?.enabled) return false;
    return applyJuggernautTool?.(toolId) ?? false;
  }

  async function runNativeToolSlot(index = -1) {
    const slot = nativeMenuBridge.toolSlots[index] || null;
    const toolId = String(slot?.toolId || "").trim();
    if (!toolId || !slot?.enabled) return false;
    if (slot.kind === "communication_tool") {
      return setCommunicationTool?.(toolId, { source: "native_menu" }) ?? false;
    }
    return (
      invokeRegisteredTool?.(toolId, {
        source: "native_menu",
        trigger: "menu",
      }) ?? false
    );
  }

  return {
    nativeMenuBridge,
    buildNativeMenuFileState,
    syncAppMenuState,
    buildNativeShortcutSlots,
    buildNativeToolSlots,
    syncNativeSystemMenu,
    queueNativeSystemMenuSync,
    cacheNativeShortcutSlots,
    parseNativeSlotIndex,
    runNativeShortcutSlot,
    runNativeToolSlot,
  };
}
