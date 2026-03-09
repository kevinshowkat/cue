import { getJuggernautRailIconSvg } from "./generated/rail_icon_registry.js";

const JUGGERNAUT_RAIL_ITEMS = Object.freeze([
  Object.freeze({
    toolId: "upload",
    actionKey: "upload",
    label: "Import image",
    hotkey: "1",
    requiresImage: false,
    title: "Import image",
  }),
  Object.freeze({
    toolId: "select_subject",
    actionKey: "lasso",
    label: "Select subject",
    hotkey: "2",
    requiresImage: true,
    title: "Select subject",
  }),
  Object.freeze({
    toolId: "background_swap",
    actionKey: "bg",
    label: "Background swap",
    hotkey: "3",
    requiresImage: true,
    title: "Background swap",
  }),
  Object.freeze({
    toolId: "cleanup",
    actionKey: "remove_people",
    label: "Cleanup",
    hotkey: "4",
    requiresImage: true,
    title: "Cleanup",
  }),
  Object.freeze({
    toolId: "variations",
    actionKey: "variations",
    label: "Variations",
    hotkey: "5",
    requiresImage: true,
    title: "Variations",
  }),
  Object.freeze({
    toolId: "create_tool",
    actionKey: "create_tool",
    label: "Create Tool",
    hotkey: "6",
    requiresImage: false,
    title: "Create Tool",
  }),
  Object.freeze({
    toolId: "export_psd",
    actionKey: "export_psd",
    label: "Export PSD",
    hotkey: "7",
    requiresImage: false,
    title: "Export PSD",
  }),
]);

function railIconSvg(toolId = "") {
  return getJuggernautRailIconSvg(toolId);
}

export function getJuggernautRailButtons({
  hasImage = false,
  activeToolId = "",
  runningToolId = "",
} = {}) {
  return JUGGERNAUT_RAIL_ITEMS.map((item) => ({
    ...item,
    disabled: Boolean(item.requiresImage && !hasImage),
    selected: item.toolId === activeToolId,
    running: item.toolId === runningToolId,
    iconSvg: railIconSvg(item.toolId),
  }));
}

export function renderJuggernautRail(root, { buttons = [], onPress } = {}) {
  if (!root) return;
  root.innerHTML = "";
  const fragment = document.createDocumentFragment();

  for (const button of buttons) {
    const toolEl = document.createElement("button");
    toolEl.type = "button";
    toolEl.className = "tool juggernaut-tool juggernaut-rail-button";
    toolEl.dataset.key = String(button.actionKey || button.toolId || "").trim();
    toolEl.dataset.toolId = String(button.toolId || "").trim();
    toolEl.dataset.toolKey = String(button.toolId || "").trim();
    toolEl.dataset.hotkey = String(button.hotkey || "").trim();
    toolEl.title = String(button.title || button.label || button.toolId || "").trim();
    toolEl.setAttribute("aria-label", String(button.label || button.toolId || "").trim());
    toolEl.innerHTML = `${button.iconSvg}<span class="tool-hint" aria-hidden="true">${button.hotkey}</span>`;

    if (button.selected) toolEl.classList.add("selected");
    if (button.running) toolEl.classList.add("depressed");
    if (button.disabled) {
      toolEl.disabled = true;
      toolEl.title = "Import an image first";
    }

    toolEl.addEventListener("click", (event) => {
      if (typeof onPress === "function") {
        onPress(button, event);
      }
    });
    fragment.appendChild(toolEl);
  }

  root.appendChild(fragment);
}
