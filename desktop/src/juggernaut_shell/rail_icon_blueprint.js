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
    toolId: "upload",
    label: "Import image",
    semanticRole: "ingest",
    notes: "Upward intake arrow landing into a weighted tray.",
    parts: Object.freeze([
      fillPath("M8.4 18.2h7.2l-.92 1.58H9.32z", { "fill-opacity": "0.18" }),
      strokePath("M6.35 15.2c0 2.1 1.94 3.52 5.65 3.52s5.65-1.42 5.65-3.52"),
      strokePath("M12 4.85v7.35"),
      strokePath("M8.3 8.88L12 5.18l3.7 3.7"),
      strokePath("M7.55 12.15l1.35-.58"),
      strokePath("M16.45 12.15l-1.35-.58"),
    ]),
  }),
  Object.freeze({
    toolId: "select_subject",
    label: "Select subject",
    semanticRole: "selection",
    notes: "Broken lasso orbit around a compact focal seed.",
    parts: Object.freeze([
      fillCircle(12.1, 11.5, 1.15, { "fill-opacity": "0.2" }),
      strokePath("M8.15 8.05c1.08-1.56 2.82-2.4 4.8-2.4 3.46 0 6.25 2.52 6.25 5.62 0 1.63-.77 3.11-2.08 4.2"),
      strokePath("M8.72 15.22c.82 1.3 2.28 2.02 4.08 2.02 1.08 0 2.12-.26 3.05-.75"),
      strokePath("M8.08 16.02l-2.88 2.48 1.05-3.75"),
      strokePath("M12.1 8.85v1.08"),
      strokePath("M12.1 13.08v1.02"),
      strokePath("M9.98 11.5h1.05"),
      strokePath("M13.17 11.5h1.05"),
    ]),
  }),
  Object.freeze({
    toolId: "background_swap",
    label: "Background swap",
    semanticRole: "scene-replace",
    notes: "Landscape tile with a corner-lift exchange move.",
    parts: Object.freeze([
      fillRect(5.25, 6.35, 10.35, 8.05, 2.15, { "fill-opacity": "0.12" }),
      strokeRect(5.25, 6.35, 10.35, 8.05, 2.15),
      fillCircle(9.15, 8.95, 0.95, { "fill-opacity": "0.2" }),
      strokePath("M7.15 13.6l2.75-3.05 2.15 2.15 1.95-2.45"),
      strokePath("M16.55 6.75v4.4h4.35"),
      strokePath("M15.35 10.95l5.45-5.45"),
    ]),
  }),
  Object.freeze({
    toolId: "cleanup",
    label: "Cleanup",
    semanticRole: "remove-noise",
    notes: "Sweep arc and burnished spark to imply removal rather than destruction.",
    parts: Object.freeze([
      strokePath("M6.15 18.18c1.58-2.9 3.96-4.98 7.08-6.22"),
      strokePath("M11.82 18.18c2.58-1.55 4.66-3.98 5.95-6.92"),
      strokePath("M16.18 7.08h2.72v2.72"),
      fillCircle(8.42, 10.62, 0.74, { "fill-opacity": "0.22" }),
      fillCircle(10.28, 9.26, 0.48, { "fill-opacity": "0.16" }),
      strokePath("M9.88 12.08v1.16"),
      strokePath("M9.3 12.66h1.16"),
      strokePath("M5.18 19.12h13.64"),
    ]),
  }),
  Object.freeze({
    toolId: "variations",
    label: "Variations",
    semanticRole: "branch",
    notes: "Split prism with two resolved outputs on the lower edge.",
    parts: Object.freeze([
      fillPath("M12 5.25l4.45 2.55L12 10.35 7.55 7.8z", { "fill-opacity": "0.14" }),
      strokePath("M7.55 7.8L12 5.25l4.45 2.55L12 10.35z"),
      strokePath("M12 10.35v6.05"),
      strokePath("M7.55 7.8v7.25"),
      strokePath("M16.45 7.8v7.25"),
      strokePath("M7.55 15.05L12 17.6l4.45-2.55"),
      fillCircle(7.55, 15.05, 0.78, { "fill-opacity": "0.2" }),
      fillCircle(16.45, 15.05, 0.78, { "fill-opacity": "0.2" }),
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
