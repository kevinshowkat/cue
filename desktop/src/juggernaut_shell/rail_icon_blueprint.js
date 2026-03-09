const DEFAULT_STROKE_ATTRS = Object.freeze({
  fill: "none",
  stroke: "currentColor",
  "stroke-width": "1.85",
  "stroke-linecap": "round",
  "stroke-linejoin": "round",
});

const DEFAULT_FILL_ATTRS = Object.freeze({
  fill: "currentColor",
  "fill-opacity": "0.14",
});

function freezeAttrs(base, extra = {}) {
  return Object.freeze({ ...base, ...extra });
}

function strokePath(d, extra = {}) {
  return Object.freeze({
    tag: "path",
    attrs: freezeAttrs(DEFAULT_STROKE_ATTRS, { d, ...extra }),
  });
}

function fillPath(d, extra = {}) {
  return Object.freeze({
    tag: "path",
    attrs: freezeAttrs(DEFAULT_FILL_ATTRS, { d, ...extra }),
  });
}

function strokeCircle(cx, cy, r, extra = {}) {
  return Object.freeze({
    tag: "circle",
    attrs: freezeAttrs(DEFAULT_STROKE_ATTRS, { cx, cy, r, ...extra }),
  });
}

function fillCircle(cx, cy, r, extra = {}) {
  return Object.freeze({
    tag: "circle",
    attrs: freezeAttrs(DEFAULT_FILL_ATTRS, { cx, cy, r, ...extra }),
  });
}

function strokeRect(x, y, width, height, rx, extra = {}) {
  return Object.freeze({
    tag: "rect",
    attrs: freezeAttrs(DEFAULT_STROKE_ATTRS, { x, y, width, height, rx, ...extra }),
  });
}

function fillRect(x, y, width, height, rx, extra = {}) {
  return Object.freeze({
    tag: "rect",
    attrs: freezeAttrs(DEFAULT_FILL_ATTRS, { x, y, width, height, rx, ...extra }),
  });
}

export const JUGGERNAUT_RAIL_ICON_STYLE = Object.freeze({
  id: "juggernaut.rail_iconography.v1",
  viewBox: "0 0 24 24",
  grid: 24,
  safeArea: 2.4,
  strokeWidth: 1.85,
  keywords: Object.freeze([
    "machined line art",
    "rounded joins",
    "single-subject silhouettes",
    "currentColor-driven tinting",
    "deterministic local generation",
  ]),
  artDirection:
    "Minimal forged glyphs with a machined silhouette, a restrained fill accent, and no stock icon-pack dependency.",
});

export const JUGGERNAUT_RAIL_ICON_BLUEPRINTS = Object.freeze([
  Object.freeze({
    toolId: "move",
    label: "Move image",
    semanticRole: "arrange",
    notes: "Four-way move handle with a centered pivot so canvas arrangement reads immediately as repositioning.",
    parts: Object.freeze([
      fillCircle(12, 12, 1.55, { "fill-opacity": "0.18" }),
      strokeCircle(12, 12, 2.3),
      strokePath("M12 4.9v5.05"),
      strokePath("M12 14.05v5.05"),
      strokePath("M4.9 12h5.05"),
      strokePath("M14.05 12h5.05"),
      strokePath("M9.95 7 12 4.9 14.05 7"),
      strokePath("M9.95 17 12 19.1 14.05 17"),
      strokePath("M7 9.95 4.9 12 7 14.05"),
      strokePath("M17 9.95 19.1 12 17 14.05"),
    ]),
  }),
  Object.freeze({
    toolId: "upload",
    label: "Import image",
    semanticRole: "ingest",
    notes: "Classic centered plus sign so adding/importing an image reads immediately without extra metaphor.",
    parts: Object.freeze([
      strokePath("M12 5.25v13.5", { "stroke-width": "2.1" }),
      strokePath("M5.25 12h13.5", { "stroke-width": "2.1" }),
    ]),
  }),
  Object.freeze({
    toolId: "select_subject",
    label: "Select subject",
    semanticRole: "selection",
    notes: "Subject bust framed by corner guides so the action reads as subject selection.",
    parts: Object.freeze([
      fillCircle(12, 8.2, 1.7, { "fill-opacity": "0.18" }),
      fillPath("M8.15 16.65c.62-2.44 2.01-3.66 4.18-3.66 2.14 0 3.48 1.22 4.02 3.66", { "fill-opacity": "0.14" }),
      strokePath("M8.45 16.35c.58-2.12 1.87-3.18 3.88-3.18 1.99 0 3.24 1.06 3.77 3.18"),
      strokePath("M6.2 7.25V5.45h2.3"),
      strokePath("M17.8 7.25V5.45h-2.3"),
      strokePath("M6.2 14.95v1.8h2.3"),
      strokePath("M17.8 14.95v1.8h-2.3"),
    ]),
  }),
  Object.freeze({
    toolId: "background_swap",
    label: "Background swap",
    semanticRole: "scene-replace",
    notes: "Landscape tile with a horizontal exchange arrow to make the background replacement action explicit.",
    parts: Object.freeze([
      fillRect(4.9, 6.1, 8.35, 8.05, 2.1, { "fill-opacity": "0.12" }),
      strokeRect(4.9, 6.1, 8.35, 8.05, 2.1),
      fillCircle(8.05, 8.55, 0.86, { "fill-opacity": "0.18" }),
      strokePath("M6.58 12.92l1.96-2.16 1.56 1.58 1.5-1.88"),
      strokePath("M14.85 8.4h4.25"),
      strokePath("M17.55 6.2l2.2 2.2-2.2 2.2"),
      strokePath("M19.1 15.6h-4.25"),
      strokePath("M16.4 13.4l-2.2 2.2 2.2 2.2"),
    ]),
  }),
  Object.freeze({
    toolId: "cleanup",
    label: "Cleanup",
    semanticRole: "remove-noise",
    notes: "Angled eraser with cleanup spark to make targeted removal legible at a glance.",
    parts: Object.freeze([
      fillPath("M7.45 14.95l4.28-4.3 4.82 4.82-4.28 4.28H9.1z", { "fill-opacity": "0.14" }),
      strokePath("M7.45 14.95l4.28-4.3 4.82 4.82-4.28 4.28H9.1z"),
      strokePath("M10.92 9.78l1.84-1.86a1.86 1.86 0 0 1 2.62 0l.58.58a1.84 1.84 0 0 1 0 2.6l-1.86 1.86"),
      strokePath("M5.95 19.1h6.45"),
      strokePath("M18.15 6.3v1.32"),
      strokePath("M17.49 6.96h1.32"),
      strokePath("M16.95 9.05h2.18"),
      strokePath("M18.04 7.96v2.18"),
    ]),
  }),
  Object.freeze({
    toolId: "variations",
    label: "Variations",
    semanticRole: "branch",
    notes: "Primary tile branching into two sibling tiles so variant generation reads as branching, not stacking.",
    parts: Object.freeze([
      fillRect(9, 4.95, 6, 5.4, 1.45, { "fill-opacity": "0.16" }),
      strokeRect(9, 4.95, 6, 5.4, 1.45),
      fillRect(4.95, 14, 5.3, 4.95, 1.3, { "fill-opacity": "0.12" }),
      strokeRect(4.95, 14, 5.3, 4.95, 1.3),
      fillRect(13.75, 14, 5.3, 4.95, 1.3, { "fill-opacity": "0.12" }),
      strokeRect(13.75, 14, 5.3, 4.95, 1.3),
      strokePath("M12 10.35v1.95"),
      strokePath("M12 12.3H7.6v1.7"),
      strokePath("M12 12.3h4.4v1.7"),
    ]),
  }),
  Object.freeze({
    toolId: "create_tool",
    label: "Create Tool",
    semanticRole: "forge",
    notes: "Centered core with three tabs and a small forge spark.",
    parts: Object.freeze([
      fillCircle(12, 12.2, 2.05, { "fill-opacity": "0.18" }),
      strokeCircle(12, 12.2, 2.9),
      strokePath("M12 4.95v3.1"),
      strokePath("M6.18 15.55l2.72-1.55"),
      strokePath("M17.82 15.55l-2.72-1.55"),
      strokePath("M16.6 4.88v1.34"),
      strokePath("M15.93 5.55h1.34"),
      strokePath("M15.23 4.18l.67.67"),
      strokePath("M17.97 4.18l-.67.67"),
    ]),
  }),
  Object.freeze({
    toolId: "export_psd",
    label: "Export PSD",
    semanticRole: "deliver",
    notes: "Downstream release arrow framed by a lifted shoulder and base rule.",
    parts: Object.freeze([
      fillPath("M8.15 18.2h7.7l-.95 1.55H9.1z", { "fill-opacity": "0.18" }),
      strokePath("M12 6.08v9.12"),
      strokePath("M8.95 12.3L12 15.35l3.05-3.05"),
      strokePath("M7.62 6.42h8.76"),
      strokePath("M7.62 6.42L6.35 8.12"),
      strokePath("M16.38 6.42l1.27 1.7"),
      strokePath("M5.55 18.2h12.9"),
    ]),
  }),
]);

function renderAttrs(attrs) {
  return Object.entries(attrs)
    .map(([key, value]) => ` ${key}="${String(value)}"`)
    .join("");
}

function renderPart(part) {
  return `<${part.tag}${renderAttrs(part.attrs)} />`;
}

export function renderJuggernautRailIconSvg(blueprint) {
  const className = `tool-icon tool-icon-${String(blueprint?.toolId || "")
    .trim()
    .replace(/_/g, "-")}`;
  const body = (Array.isArray(blueprint?.parts) ? blueprint.parts : []).map(renderPart).join("\n  ");
  return `<svg class="${className}" viewBox="${JUGGERNAUT_RAIL_ICON_STYLE.viewBox}" fill="none" aria-hidden="true">
  ${body}
</svg>`;
}

export function juggernautRailIconBlueprintMap() {
  return new Map(JUGGERNAUT_RAIL_ICON_BLUEPRINTS.map((blueprint) => [blueprint.toolId, blueprint]));
}
