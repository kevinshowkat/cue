export const NATIVE_SYSTEM_MENU_CONTRACT = "cue.native-system-menu.v1";
export const NATIVE_TOOLS_SLOT_COUNT = 8;
export const NATIVE_SHORTCUT_SLOT_COUNT = 9;

function normalizeMenuEntry(entry, fallbackLabel = "Menu Item", { defaultEnabled = false } = {}) {
  const label = String(entry?.label || entry?.title || "").trim() || fallbackLabel;
  return {
    label,
    enabled:
      entry?.enabled == null && entry?.isEnabled == null
        ? Boolean(defaultEnabled)
        : Boolean(entry?.enabled ?? entry?.isEnabled),
  };
}

function fillMenuSlots(entries = [], { slotCount = 0, fallbackPrefix = "Slot" } = {}) {
  const slots = [];
  for (let index = 0; index < slotCount; index += 1) {
    const entry = entries[index] || null;
    slots.push(
      normalizeMenuEntry(entry, `${fallbackPrefix} ${index + 1}`, {
        defaultEnabled: false,
      })
    );
  }
  return slots;
}

export function buildNativeSystemMenuPayload({
  file = {},
  tools = [],
  shortcuts = [],
} = {}) {
  return {
    contract: NATIVE_SYSTEM_MENU_CONTRACT,
    file: {
      canNewSession: file.canNewSession !== false,
      canOpenSession: file.canOpenSession !== false,
      canSaveSession: Boolean(file.canSaveSession),
      canCloseSession: Boolean(file.canCloseSession),
      canExportSession: Boolean(file.canExportSession),
      canImportPhotos: file.canImportPhotos !== false,
      canOpenSettings: file.canOpenSettings !== false,
    },
    tools: fillMenuSlots(tools, {
      slotCount: NATIVE_TOOLS_SLOT_COUNT,
      fallbackPrefix: "Tool Slot",
    }),
    shortcuts: fillMenuSlots(shortcuts, {
      slotCount: NATIVE_SHORTCUT_SLOT_COUNT,
      fallbackPrefix: "Shortcut Slot",
    }),
  };
}
