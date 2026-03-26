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
    notes: "Upload arrow above a compact image frame so the rail reads as image import instead of generic add-tab creation.",
    parts: Object.freeze([
      fillRect(5.15, 10.9, 13.7, 7.95, 2.05, { "fill-opacity": "0.12" }),
      strokeRect(5.15, 10.9, 13.7, 7.95, 2.05),
      fillCircle(8.95, 13.35, 0.82, { "fill-opacity": "0.18" }),
      strokePath("M7.25 17.05l2.2-2.2 1.8 1.7 2.25-2.55 2.25 3.05"),
      strokePath("M12 9.1V4.95"),
      strokePath("M9.65 7.3 12 4.95 14.35 7.3"),
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
    toolId: "select_region",
    label: "Select region",
    semanticRole: "region-selection",
    notes: "Marquee selection frame with an inset capture tile so region selection stays distinct from subject extraction.",
    parts: Object.freeze([
      strokeRect(5.05, 5.05, 13.9, 13.9, 2.15, { "stroke-dasharray": "2.25 1.75" }),
      fillRect(9.1, 9.1, 5.8, 5.8, 1.35, { "fill-opacity": "0.18" }),
      strokeRect(9.1, 9.1, 5.8, 5.8, 1.35),
      strokePath("M12 6.65V8"),
      strokePath("M12 16v1.35"),
      strokePath("M6.65 12H8"),
      strokePath("M16 12h1.35"),
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
    toolId: "protect",
    label: "Highlight",
    semanticRole: "highlight-focus",
    notes: "Angular highlighter silhouette with a marker-like pointed felt nib, flatter cap, and flat-sided barrel so review-focus reads like a real marker instead of a rounded tube.",
    parts: Object.freeze([
      fillPath("M12 2.65c.46 0 .84.2 1.12.61l1.05 1.56c.18.26.27.57.27.89v.89H9.54v-.89c0-.32.09-.63.27-.89l1.05-1.56c.28-.41.66-.61 1.14-.61Z"),
      strokePath("M12 2.65c.46 0 .84.2 1.12.61l1.05 1.56c.18.26.27.57.27.89v.89H9.54v-.89c0-.32.09-.63.27-.89l1.05-1.56c.28-.41.66-.61 1.14-.61Z"),
      strokePath("M10.75 5.95h2.5"),
      fillPath("M8.65 7.4h6.7l.85 1.2v6.95l-.85 1.2h-6.7l-.85-1.2V8.6Z", { "fill-opacity": "0.18" }),
      strokePath("M8.65 7.4h6.7l.85 1.2v6.95l-.85 1.2h-6.7l-.85-1.2V8.6Z"),
      strokePath("M10.05 9.6h4.1"),
      strokePath("M9.95 12.15c1.14-.58 1.88-.46 2.55.15.63.59 1.11.72 1.58.61"),
      strokePath("M9.7 14.5h4.7"),
      fillRect(12.1, 10.9, 2, 1.4, 0.28, { "fill-opacity": "0.14" }),
      strokeRect(12.1, 10.9, 2, 1.4, 0.28),
      strokePath("M12.6 11.6h.95", { "stroke-width": "1.45" }),
      fillPath("M8.95 17.05h6.1l.95.82v2.05l-.95.83h-6.1l-.9-.83v-2.05Z"),
      strokePath("M8.95 17.05h6.1l.95.82v2.05l-.95.83h-6.1l-.9-.83v-2.05Z"),
      strokePath("M10.1 18.7h3.8"),
    ]),
  }),
  Object.freeze({
    toolId: "make_space",
    label: "Make Space",
    semanticRole: "reserve-room",
    notes: "Centered room box with arrows pushing outward so reserve-or-create-space intent reads directly.",
    parts: Object.freeze([
      fillRect(8.4, 8.4, 7.2, 7.2, 1.8, { "fill-opacity": "0.12" }),
      strokeRect(8.4, 8.4, 7.2, 7.2, 1.8),
      strokePath("M12 4.95v2.35"),
      strokePath("M12 19.05v-2.35"),
      strokePath("M4.95 12h2.35"),
      strokePath("M19.05 12h-2.35"),
      strokePath("M10.75 7.1 12 4.95 13.25 7.1"),
      strokePath("M10.75 16.9 12 19.05 13.25 16.9"),
      strokePath("M7.1 10.75 4.95 12 7.1 13.25"),
      strokePath("M16.9 10.75 19.05 12 16.9 13.25"),
    ]),
  }),
  Object.freeze({
    toolId: "remove_people",
    label: "Remove People",
    semanticRole: "remove-people",
    notes: "Human silhouette with a clean strike so people removal stays distinct from general cleanup.",
    parts: Object.freeze([
      fillCircle(12, 8.2, 1.7, { "fill-opacity": "0.18" }),
      fillPath("M8.2 16.75c.59-2.27 1.86-3.4 3.8-3.4 1.97 0 3.25 1.13 3.85 3.4", { "fill-opacity": "0.14" }),
      strokePath("M8.5 16.4c.56-2.05 1.73-3.08 3.5-3.08 1.81 0 2.99 1.03 3.55 3.08"),
      strokePath("M6.35 6.35 17.65 17.65"),
      strokePath("M18.2 6.8v2.1"),
      strokePath("M17.15 7.85h2.1"),
    ]),
  }),
  Object.freeze({
    toolId: "polish",
    label: "Polish",
    semanticRole: "finish",
    notes: "Primary sparkle with smaller accents so finish/polish reads as a clean global refinement.",
    parts: Object.freeze([
      fillPath("M12 4.7 13.6 8.45l3.75 1.6-3.75 1.6L12 15.4l-1.6-3.75-3.75-1.6 3.75-1.6z", {
        "fill-opacity": "0.16",
      }),
      strokePath("M12 4.7 13.6 8.45l3.75 1.6-3.75 1.6L12 15.4l-1.6-3.75-3.75-1.6 3.75-1.6z"),
      strokePath("M17.55 14.6l.72 1.62 1.63.72-1.63.72-.72 1.63-.72-1.63-1.62-.72 1.62-.72z"),
      strokePath("M7.15 15.25l.52 1.18 1.18.52-1.18.52-.52 1.18-.52-1.18-1.18-.52 1.18-.52z"),
    ]),
  }),
  Object.freeze({
    toolId: "relight",
    label: "Relight",
    semanticRole: "light-balance",
    notes: "Half-lit disc with restrained rays so relighting reads as a lighting pass, not exposure only.",
    parts: Object.freeze([
      fillCircle(12, 12, 4.7, { "fill-opacity": "0.12" }),
      fillPath("M12 7.3a4.7 4.7 0 0 1 0 9.4z", { "fill-opacity": "0.18" }),
      strokeCircle(12, 12, 4.7),
      strokePath("M12 2.95v2.15"),
      strokePath("M12 18.9v2.15"),
      strokePath("M4.15 12h2.15"),
      strokePath("M17.7 12h2.15"),
      strokePath("M6.55 6.55 8.05 8.05"),
      strokePath("M15.95 15.95l1.5 1.5"),
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
    label: "Export",
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
