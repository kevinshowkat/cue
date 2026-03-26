import { DEFAULT_JUGGERNAUT_RAIL_ICON_PACK_ID, getJuggernautRailIconPack } from "./rail_icon_packs.js";

function freezeAttrs(base, extra = {}) {
  return Object.freeze({ ...base, ...extra });
}

function strokePath(d, extra = {}) {
  return Object.freeze({
    tag: "path",
    paint: "stroke",
    attrs: freezeAttrs({ d }, extra),
  });
}

function fillPath(d, extra = {}) {
  return Object.freeze({
    tag: "path",
    paint: "fill",
    attrs: freezeAttrs({ d }, extra),
  });
}

function strokeCircle(cx, cy, r, extra = {}) {
  return Object.freeze({
    tag: "circle",
    paint: "stroke",
    attrs: freezeAttrs({ cx, cy, r }, extra),
  });
}

function fillCircle(cx, cy, r, extra = {}) {
  return Object.freeze({
    tag: "circle",
    paint: "fill",
    attrs: freezeAttrs({ cx, cy, r }, extra),
  });
}

function strokeRect(x, y, width, height, rx, extra = {}) {
  return Object.freeze({
    tag: "rect",
    paint: "stroke",
    attrs: freezeAttrs({ x, y, width, height, rx }, extra),
  });
}

function fillRect(x, y, width, height, rx, extra = {}) {
  return Object.freeze({
    tag: "rect",
    paint: "fill",
    attrs: freezeAttrs({ x, y, width, height, rx }, extra),
  });
}

export const JUGGERNAUT_RAIL_ICON_STYLE = Object.freeze({
  id: "juggernaut.rail_iconography.v1",
  viewBox: "0 0 24 24",
  grid: 24,
  safeArea: 2.4,
  defaultPackId: DEFAULT_JUGGERNAUT_RAIL_ICON_PACK_ID,
  keywords: Object.freeze([
    "shared semantic blueprints",
    "switchable generated packs",
    "single-subject silhouettes",
    "currentColor-driven mask tinting",
    "provider-backed asset generation",
    "oscillo gemini prompt-family metadata",
  ]),
  artDirection:
    "Minimal custom glyph prompts authored from one semantic blueprint set into multiple provider-generated icon packs without a stock icon-pack dependency.",
});

export const JUGGERNAUT_MAIN_APP_ICON_BLUEPRINTS = Object.freeze([
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
    toolId: "reframe",
    label: "Reframe",
    semanticRole: "crop-or-outpaint",
    notes: "Crop frame with opposing arrows so reframing reads as reposition plus expansion, not generic selection.",
    parts: Object.freeze([
      fillRect(8.2, 7.2, 7.6, 8.6, 1.7, { "fill-opacity": "0.14" }),
      strokeRect(8.2, 7.2, 7.6, 8.6, 1.7),
      strokePath("M5.2 8.85V5.6h3.25"),
      strokePath("M18.8 8.85V5.6h-3.25"),
      strokePath("M5.2 15.15v3.25h3.25"),
      strokePath("M18.8 15.15v3.25h-3.25"),
      strokePath("M10.65 12l-1.55 1.55 1.55 1.55"),
      strokePath("M13.35 15.1l1.55-1.55L13.35 12"),
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
    toolId: "new_session",
    label: "New Session",
    semanticRole: "create-session",
    notes: "Single decisive plus glyph for starting a fresh session with no secondary marks.",
    parts: Object.freeze([
      strokePath("M12 5.2v13.6"),
      strokePath("M5.2 12h13.6"),
    ]),
  }),
  Object.freeze({
    toolId: "fork_session",
    label: "Fork Session",
    semanticRole: "branch-session",
    notes: "Compact branch icon with one origin, one continuation, and one offshoot to signal session forking at a glance.",
    parts: Object.freeze([
      strokePath("M8.2 8.6v6.1"),
      strokePath("M8.2 9.35h6.25"),
      strokePath("M8.2 14.7c0 2.35 1.95 4.25 4.3 4.25h1.2"),
      fillCircle(8.2, 6.1, 2.05, { "fill-opacity": "0.18" }),
      fillCircle(8.2, 18.95, 2.05, { "fill-opacity": "0.18" }),
      fillCircle(17.1, 9.35, 2.05, { "fill-opacity": "0.18" }),
    ]),
  }),
  Object.freeze({
    toolId: "history",
    label: "History",
    semanticRole: "timeline-history",
    notes: "Clockwise history loop with a short hand and recall arrow so timeline access reads immediately as history.",
    parts: Object.freeze([
      strokePath("M18.55 9.35a6.55 6.55 0 1 1-1.95-2.75"),
      strokePath("M15.85 4.95h3.6v3.6"),
      strokePath("M12 8.95v3.5l2.45 1.8"),
    ]),
  }),
  Object.freeze({
    toolId: "agent_run",
    label: "Agent Run",
    semanticRole: "agent-execution",
    notes: "Three task lines feeding a forward action arrow so an active agent run reads as execution rather than chat.",
    parts: Object.freeze([
      strokePath("M6.15 7.55h7.35"),
      strokePath("M6.15 12h4.45"),
      strokePath("M6.15 16.45h5.85"),
      strokePath("M13.95 7.1 19.45 12l-5.5 4.9"),
    ]),
  }),
  Object.freeze({
    toolId: "export",
    label: "Export",
    semanticRole: "deliver-export",
    notes: "Direct export arrow dropping into an open baseline so shipping work out of the app reads as general export, not a filetype badge.",
    parts: Object.freeze([
      strokePath("M12 5.1v9.2"),
      strokePath("M8.95 11.3 12 14.35l3.05-3.05"),
      strokePath("M5.65 18.45h12.7"),
    ]),
  }),
  Object.freeze({
    toolId: "design_review",
    label: "Design Review",
    semanticRole: "review-critique",
    notes: "Primary sparkle with two secondary accents so design review reads as evaluative polish and critique rather than generic favorites.",
    parts: Object.freeze([
      strokePath("M12 4.7 13.55 8.35l3.65 1.55-3.65 1.55L12 15.1l-1.55-3.65-3.65-1.55 3.65-1.55z"),
      strokePath("M18.15 4.95l.58 1.22 1.22.58-1.22.58-.58 1.22-.58-1.22-1.22-.58 1.22-.58z"),
      strokePath("M6.2 13.85l.72 1.62 1.62.72-1.62.72-.72 1.62-.72-1.62-1.62-.72 1.62-.72z"),
    ]),
  }),
]);

export const JUGGERNAUT_RAIL_ICON_BLUEPRINTS = JUGGERNAUT_MAIN_APP_ICON_BLUEPRINTS;

function formatNumber(value, fallback = 0) {
  const num = Number(value);
  const safe = Number.isFinite(num) ? num : fallback;
  if (Number.isInteger(safe)) return String(safe);
  return safe.toFixed(2).replace(/\.?0+$/, "");
}

function renderStrokeAttrs(attrs = {}, pack) {
  return {
    fill: "none",
    stroke: "currentColor",
    "stroke-width": formatNumber(pack.render.strokeWidth, 1.85),
    "stroke-linecap": pack.render.strokeLinecap,
    "stroke-linejoin": pack.render.strokeLinejoin,
    ...attrs,
  };
}

function renderFillAttrs(attrs = {}, pack) {
  const baseOpacity = Number(attrs["fill-opacity"]);
  const nextOpacity = (Number.isFinite(baseOpacity) ? baseOpacity : 0.14) * pack.render.fillOpacityMultiplier;
  const { ["fill-opacity"]: _ignoredOpacity, ...rest } = attrs;
  return {
    fill: "currentColor",
    ...rest,
    "fill-opacity": formatNumber(Math.max(0.04, Math.min(0.42, nextOpacity)), 0.14),
  };
}

function renderAttrs(attrs) {
  return Object.entries(attrs)
    .map(([key, value]) => ` ${key}="${String(value)}"`)
    .join("");
}

function renderPart(part, pack) {
  const attrs = part?.paint === "fill" ? renderFillAttrs(part.attrs, pack) : renderStrokeAttrs(part.attrs, pack);
  return `<${part.tag}${renderAttrs(attrs)} />`;
}

export function renderJuggernautRailIconSvg(blueprint, packValue = DEFAULT_JUGGERNAUT_RAIL_ICON_PACK_ID) {
  const pack = getJuggernautRailIconPack(packValue);
  const className = `tool-icon tool-icon-${String(blueprint?.toolId || "")
    .trim()
    .replace(/_/g, "-")} tool-icon-pack-${pack.id.replace(/_/g, "-")}`;
  const body = (Array.isArray(blueprint?.parts) ? blueprint.parts : []).map((part) => renderPart(part, pack)).join("\n  ");
  const wrappedBody = pack.render.svgTransform ? `<g transform="${pack.render.svgTransform}">\n  ${body}\n</g>` : body;
  return `<svg class="${className}" viewBox="${JUGGERNAUT_RAIL_ICON_STYLE.viewBox}" fill="none" aria-hidden="true">
  ${wrappedBody}
</svg>`;
}

export function juggernautRailIconBlueprintMap() {
  return new Map(JUGGERNAUT_RAIL_ICON_BLUEPRINTS.map((blueprint) => [blueprint.toolId, blueprint]));
}
