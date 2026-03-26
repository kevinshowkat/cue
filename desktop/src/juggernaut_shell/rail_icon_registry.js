import { DEFAULT_JUGGERNAUT_RAIL_ICON_PACK_ID } from "./rail_icon_packs.js";
import {
  DEFAULT_JUGGERNAUT_RAIL_ICON_PACK_ID as GENERATED_DEFAULT_JUGGERNAUT_RAIL_ICON_PACK_ID,
  JUGGERNAUT_RAIL_ICON_ASSET_URLS as GENERATED_JUGGERNAUT_RAIL_ICON_ASSET_URLS,
  JUGGERNAUT_RAIL_ICON_PACK_ASSET_URLS as GENERATED_JUGGERNAUT_RAIL_ICON_PACK_ASSET_URLS,
  getJuggernautRailIconAssetUrl as getGeneratedJuggernautRailIconAssetUrl,
  getJuggernautRailIconMarkup as getGeneratedJuggernautRailIconMarkup,
} from "./generated/rail_icon_registry.js";

function legacyInlineIconMarkup(toolId = "", body = "") {
  const className = `tool-icon tool-icon-${String(toolId || "")
    .trim()
    .replace(/_/g, "-")} tool-icon-pack-default-classic`;
  return `<svg class="${className}" viewBox="0 0 24 24" fill="none" aria-hidden="true">
  ${body}
</svg>`;
}

const LEGACY_DEFAULT_INLINE_MARKUP = Object.freeze({
  move: legacyInlineIconMarkup(
    "move",
    `<circle fill="currentColor" fill-opacity="0.18" cx="12" cy="12" r="1.55" />
  <circle fill="none" stroke="currentColor" stroke-width="1.85" stroke-linecap="round" stroke-linejoin="round" cx="12" cy="12" r="2.3" />
  <path fill="none" stroke="currentColor" stroke-width="1.85" stroke-linecap="round" stroke-linejoin="round" d="M12 4.9v5.05" />
  <path fill="none" stroke="currentColor" stroke-width="1.85" stroke-linecap="round" stroke-linejoin="round" d="M12 14.05v5.05" />
  <path fill="none" stroke="currentColor" stroke-width="1.85" stroke-linecap="round" stroke-linejoin="round" d="M4.9 12h5.05" />
  <path fill="none" stroke="currentColor" stroke-width="1.85" stroke-linecap="round" stroke-linejoin="round" d="M14.05 12h5.05" />
  <path fill="none" stroke="currentColor" stroke-width="1.85" stroke-linecap="round" stroke-linejoin="round" d="M9.95 7 12 4.9 14.05 7" />
  <path fill="none" stroke="currentColor" stroke-width="1.85" stroke-linecap="round" stroke-linejoin="round" d="M9.95 17 12 19.1 14.05 17" />
  <path fill="none" stroke="currentColor" stroke-width="1.85" stroke-linecap="round" stroke-linejoin="round" d="M7 9.95 4.9 12 7 14.05" />
  <path fill="none" stroke="currentColor" stroke-width="1.85" stroke-linecap="round" stroke-linejoin="round" d="M17 9.95 19.1 12 17 14.05" />`
  ),
  upload: legacyInlineIconMarkup(
    "upload",
    `<rect fill="currentColor" fill-opacity="0.12" x="5.15" y="10.9" width="13.7" height="7.95" rx="2.05" />
  <rect fill="none" stroke="currentColor" stroke-width="1.85" stroke-linecap="round" stroke-linejoin="round" x="5.15" y="10.9" width="13.7" height="7.95" rx="2.05" />
  <circle fill="currentColor" fill-opacity="0.18" cx="8.95" cy="13.35" r="0.82" />
  <path fill="none" stroke="currentColor" stroke-width="1.85" stroke-linecap="round" stroke-linejoin="round" d="M7.25 17.05l2.2-2.2 1.8 1.7 2.25-2.55 2.25 3.05" />
  <path fill="none" stroke="currentColor" stroke-width="1.85" stroke-linecap="round" stroke-linejoin="round" d="M12 9.1V4.95" />
  <path fill="none" stroke="currentColor" stroke-width="1.85" stroke-linecap="round" stroke-linejoin="round" d="M9.65 7.3 12 4.95 14.35 7.3" />`
  ),
  select_subject: legacyInlineIconMarkup(
    "select_subject",
    `<circle fill="currentColor" fill-opacity="0.18" cx="12" cy="8.2" r="1.7" />
  <path fill="currentColor" fill-opacity="0.14" d="M8.15 16.65c.62-2.44 2.01-3.66 4.18-3.66 2.14 0 3.48 1.22 4.02 3.66" />
  <path fill="none" stroke="currentColor" stroke-width="1.85" stroke-linecap="round" stroke-linejoin="round" d="M8.45 16.35c.58-2.12 1.87-3.18 3.88-3.18 1.99 0 3.24 1.06 3.77 3.18" />
  <path fill="none" stroke="currentColor" stroke-width="1.85" stroke-linecap="round" stroke-linejoin="round" d="M6.2 7.25V5.45h2.3" />
  <path fill="none" stroke="currentColor" stroke-width="1.85" stroke-linecap="round" stroke-linejoin="round" d="M17.8 7.25V5.45h-2.3" />
  <path fill="none" stroke="currentColor" stroke-width="1.85" stroke-linecap="round" stroke-linejoin="round" d="M6.2 14.95v1.8h2.3" />
  <path fill="none" stroke="currentColor" stroke-width="1.85" stroke-linecap="round" stroke-linejoin="round" d="M17.8 14.95v1.8h-2.3" />`
  ),
  select_region: legacyInlineIconMarkup(
    "select_region",
    `<rect fill="none" stroke="currentColor" stroke-width="1.85" stroke-linecap="round" stroke-linejoin="round" x="5.05" y="5.05" width="13.9" height="13.9" rx="2.15" stroke-dasharray="2.25 1.75" />
  <rect fill="currentColor" fill-opacity="0.18" x="9.1" y="9.1" width="5.8" height="5.8" rx="1.35" />
  <rect fill="none" stroke="currentColor" stroke-width="1.85" stroke-linecap="round" stroke-linejoin="round" x="9.1" y="9.1" width="5.8" height="5.8" rx="1.35" />
  <path fill="none" stroke="currentColor" stroke-width="1.85" stroke-linecap="round" stroke-linejoin="round" d="M12 6.65V8" />
  <path fill="none" stroke="currentColor" stroke-width="1.85" stroke-linecap="round" stroke-linejoin="round" d="M12 16v1.35" />
  <path fill="none" stroke="currentColor" stroke-width="1.85" stroke-linecap="round" stroke-linejoin="round" d="M6.65 12H8" />
  <path fill="none" stroke="currentColor" stroke-width="1.85" stroke-linecap="round" stroke-linejoin="round" d="M16 12h1.35" />`
  ),
  reframe: legacyInlineIconMarkup(
    "reframe",
    `<rect fill="currentColor" fill-opacity="0.14" x="8.2" y="7.2" width="7.6" height="8.6" rx="1.7" />
  <rect fill="none" stroke="currentColor" stroke-width="1.85" stroke-linecap="round" stroke-linejoin="round" x="8.2" y="7.2" width="7.6" height="8.6" rx="1.7" />
  <path fill="none" stroke="currentColor" stroke-width="1.85" stroke-linecap="round" stroke-linejoin="round" d="M5.2 8.85V5.6h3.25" />
  <path fill="none" stroke="currentColor" stroke-width="1.85" stroke-linecap="round" stroke-linejoin="round" d="M18.8 8.85V5.6h-3.25" />
  <path fill="none" stroke="currentColor" stroke-width="1.85" stroke-linecap="round" stroke-linejoin="round" d="M5.2 15.15v3.25h3.25" />
  <path fill="none" stroke="currentColor" stroke-width="1.85" stroke-linecap="round" stroke-linejoin="round" d="M18.8 15.15v3.25h-3.25" />
  <path fill="none" stroke="currentColor" stroke-width="1.85" stroke-linecap="round" stroke-linejoin="round" d="M10.65 12l-1.55 1.55 1.55 1.55" />
  <path fill="none" stroke="currentColor" stroke-width="1.85" stroke-linecap="round" stroke-linejoin="round" d="M13.35 15.1l1.55-1.55L13.35 12" />`
  ),
  cleanup: legacyInlineIconMarkup(
    "cleanup",
    `<path fill="currentColor" fill-opacity="0.14" d="M7.45 14.95l4.28-4.3 4.82 4.82-4.28 4.28H9.1z" />
  <path fill="none" stroke="currentColor" stroke-width="1.85" stroke-linecap="round" stroke-linejoin="round" d="M7.45 14.95l4.28-4.3 4.82 4.82-4.28 4.28H9.1z" />
  <path fill="none" stroke="currentColor" stroke-width="1.85" stroke-linecap="round" stroke-linejoin="round" d="M10.92 9.78l1.84-1.86a1.86 1.86 0 0 1 2.62 0l.58.58a1.84 1.84 0 0 1 0 2.6l-1.86 1.86" />
  <path fill="none" stroke="currentColor" stroke-width="1.85" stroke-linecap="round" stroke-linejoin="round" d="M5.95 19.1h6.45" />
  <path fill="none" stroke="currentColor" stroke-width="1.85" stroke-linecap="round" stroke-linejoin="round" d="M18.15 6.3v1.32" />
  <path fill="none" stroke="currentColor" stroke-width="1.85" stroke-linecap="round" stroke-linejoin="round" d="M17.49 6.96h1.32" />
  <path fill="none" stroke="currentColor" stroke-width="1.85" stroke-linecap="round" stroke-linejoin="round" d="M16.95 9.05h2.18" />
  <path fill="none" stroke="currentColor" stroke-width="1.85" stroke-linecap="round" stroke-linejoin="round" d="M18.04 7.96v2.18" />`
  ),
  variations: legacyInlineIconMarkup(
    "variations",
    `<rect fill="currentColor" fill-opacity="0.16" x="9" y="4.95" width="6" height="5.4" rx="1.45" />
  <rect fill="none" stroke="currentColor" stroke-width="1.85" stroke-linecap="round" stroke-linejoin="round" x="9" y="4.95" width="6" height="5.4" rx="1.45" />
  <rect fill="currentColor" fill-opacity="0.12" x="4.95" y="14" width="5.3" height="4.95" rx="1.3" />
  <rect fill="none" stroke="currentColor" stroke-width="1.85" stroke-linecap="round" stroke-linejoin="round" x="4.95" y="14" width="5.3" height="4.95" rx="1.3" />
  <rect fill="currentColor" fill-opacity="0.12" x="13.75" y="14" width="5.3" height="4.95" rx="1.3" />
  <rect fill="none" stroke="currentColor" stroke-width="1.85" stroke-linecap="round" stroke-linejoin="round" x="13.75" y="14" width="5.3" height="4.95" rx="1.3" />
  <path fill="none" stroke="currentColor" stroke-width="1.85" stroke-linecap="round" stroke-linejoin="round" d="M12 10.35v1.95" />
  <path fill="none" stroke="currentColor" stroke-width="1.85" stroke-linecap="round" stroke-linejoin="round" d="M12 12.3H7.6v1.7" />
  <path fill="none" stroke="currentColor" stroke-width="1.85" stroke-linecap="round" stroke-linejoin="round" d="M12 12.3h4.4v1.7" />`
  ),
  protect: legacyInlineIconMarkup(
    "protect",
    `<rect fill="currentColor" fill-opacity="0.12" x="4.9" y="6.1" width="7.4" height="7.7" rx="2.05" />
  <rect fill="none" stroke="currentColor" stroke-width="1.85" stroke-linecap="round" stroke-linejoin="round" x="4.9" y="6.1" width="7.4" height="7.7" rx="2.05" />
  <path fill="currentColor" fill-opacity="0.16" d="M17.05 6.25 20.2 7.55v4.2c0 2.48-1.48 4.7-3.75 5.65-2.28-.95-3.75-3.17-3.75-5.65v-4.2z" />
  <path fill="none" stroke="currentColor" stroke-width="1.85" stroke-linecap="round" stroke-linejoin="round" d="M17.05 6.25 20.2 7.55v4.2c0 2.48-1.48 4.7-3.75 5.65-2.28-.95-3.75-3.17-3.75-5.65v-4.2z" />
  <path fill="none" stroke="currentColor" stroke-width="1.85" stroke-linecap="round" stroke-linejoin="round" d="M16.2 11.05l1.1 1.1 1.85-2.05" />`
  ),
  make_space: legacyInlineIconMarkup(
    "make_space",
    `<rect fill="currentColor" fill-opacity="0.12" x="8.4" y="8.4" width="7.2" height="7.2" rx="1.8" />
  <rect fill="none" stroke="currentColor" stroke-width="1.85" stroke-linecap="round" stroke-linejoin="round" x="8.4" y="8.4" width="7.2" height="7.2" rx="1.8" />
  <path fill="none" stroke="currentColor" stroke-width="1.85" stroke-linecap="round" stroke-linejoin="round" d="M12 4.95v2.35" />
  <path fill="none" stroke="currentColor" stroke-width="1.85" stroke-linecap="round" stroke-linejoin="round" d="M12 19.05v-2.35" />
  <path fill="none" stroke="currentColor" stroke-width="1.85" stroke-linecap="round" stroke-linejoin="round" d="M4.95 12h2.35" />
  <path fill="none" stroke="currentColor" stroke-width="1.85" stroke-linecap="round" stroke-linejoin="round" d="M19.05 12h-2.35" />
  <path fill="none" stroke="currentColor" stroke-width="1.85" stroke-linecap="round" stroke-linejoin="round" d="M10.75 7.1 12 4.95 13.25 7.1" />
  <path fill="none" stroke="currentColor" stroke-width="1.85" stroke-linecap="round" stroke-linejoin="round" d="M10.75 16.9 12 19.05 13.25 16.9" />
  <path fill="none" stroke="currentColor" stroke-width="1.85" stroke-linecap="round" stroke-linejoin="round" d="M7.1 10.75 4.95 12 7.1 13.25" />
  <path fill="none" stroke="currentColor" stroke-width="1.85" stroke-linecap="round" stroke-linejoin="round" d="M16.9 10.75 19.05 12 16.9 13.25" />`
  ),
  remove_people: legacyInlineIconMarkup(
    "remove_people",
    `<circle fill="currentColor" fill-opacity="0.18" cx="12" cy="8.2" r="1.7" />
  <path fill="currentColor" fill-opacity="0.14" d="M8.2 16.75c.59-2.27 1.86-3.4 3.8-3.4 1.97 0 3.25 1.13 3.85 3.4" />
  <path fill="none" stroke="currentColor" stroke-width="1.85" stroke-linecap="round" stroke-linejoin="round" d="M8.5 16.4c.56-2.05 1.73-3.08 3.5-3.08 1.81 0 2.99 1.03 3.55 3.08" />
  <path fill="none" stroke="currentColor" stroke-width="1.85" stroke-linecap="round" stroke-linejoin="round" d="M6.35 6.35 17.65 17.65" />
  <path fill="none" stroke="currentColor" stroke-width="1.85" stroke-linecap="round" stroke-linejoin="round" d="M18.2 6.8v2.1" />
  <path fill="none" stroke="currentColor" stroke-width="1.85" stroke-linecap="round" stroke-linejoin="round" d="M17.15 7.85h2.1" />`
  ),
  create_tool: legacyInlineIconMarkup(
    "create_tool",
    `<circle fill="currentColor" fill-opacity="0.18" cx="12" cy="12.2" r="2.05" />
  <circle fill="none" stroke="currentColor" stroke-width="1.85" stroke-linecap="round" stroke-linejoin="round" cx="12" cy="12.2" r="2.9" />
  <path fill="none" stroke="currentColor" stroke-width="1.85" stroke-linecap="round" stroke-linejoin="round" d="M12 4.95v3.1" />
  <path fill="none" stroke="currentColor" stroke-width="1.85" stroke-linecap="round" stroke-linejoin="round" d="M6.18 15.55l2.72-1.55" />
  <path fill="none" stroke="currentColor" stroke-width="1.85" stroke-linecap="round" stroke-linejoin="round" d="M17.82 15.55l-2.72-1.55" />
  <path fill="none" stroke="currentColor" stroke-width="1.85" stroke-linecap="round" stroke-linejoin="round" d="M16.6 4.88v1.34" />
  <path fill="none" stroke="currentColor" stroke-width="1.85" stroke-linecap="round" stroke-linejoin="round" d="M15.93 5.55h1.34" />
  <path fill="none" stroke="currentColor" stroke-width="1.85" stroke-linecap="round" stroke-linejoin="round" d="M15.23 4.18l.67.67" />
  <path fill="none" stroke="currentColor" stroke-width="1.85" stroke-linecap="round" stroke-linejoin="round" d="M17.97 4.18l-.67.67" />`
  ),
  new_session: legacyInlineIconMarkup(
    "new_session",
    `<path d="M12 6.25v11.5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" />
  <path d="M6.25 12h11.5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" />`
  ),
  fork_session: legacyInlineIconMarkup(
    "fork_session",
    `<path d="M8 8.5v6.4" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" />
  <path d="M8 9.25h6.4" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" />
  <path d="M8 14.9c0 2.6 2.1 4.7 4.7 4.7h1.05" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" />
  <circle cx="8" cy="6" r="2.25" fill="currentColor" />
  <circle cx="8" cy="18" r="2.25" fill="currentColor" />
  <circle cx="17" cy="9.25" r="2.25" fill="currentColor" />`
  ),
  history: legacyInlineIconMarkup(
    "history",
    `<path d="M18.6 9.1a6.6 6.6 0 1 1-1.9-2.7" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" />
  <path d="M15.9 4.9h3.6v3.6M12 8.9v3.5l2.45 1.8" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" />`
  ),
  agent_run: legacyInlineIconMarkup(
    "agent_run",
    `<path d="M6 7.5h7.5M6 12h4.5M6 16.5h6" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" />
  <path d="M14 7l5.5 5-5.5 5" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" />`
  ),
  export: legacyInlineIconMarkup(
    "export",
    `<path d="M12 4v11m0 0-4-4m4 4 4-4M5 18.5h14" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" />`
  ),
  design_review: legacyInlineIconMarkup(
    "design_review",
    `<path d="M12 4.5l1.3 2.9 2.9 1.3-2.9 1.3-1.3 2.9-1.3-2.9-2.9-1.3 2.9-1.3L12 4.5Z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" />
  <path d="M18.25 4.75 18.8 6l1.25.55-1.25.55-.55 1.25-.55-1.25L16.45 6.55 17.7 6l.55-1.25ZM6.25 13.75l.75 1.75 1.75.75-1.75.75-.75 1.75-.75-1.75-1.75-.75 1.75-.75.75-1.75Z" fill="none" stroke="currentColor" stroke-width="1.55" stroke-linecap="round" stroke-linejoin="round" />`
  ),
});

export const JUGGERNAUT_RAIL_ICON_PACK_ASSET_URLS = GENERATED_JUGGERNAUT_RAIL_ICON_PACK_ASSET_URLS;
export const JUGGERNAUT_RAIL_ICON_ASSET_URLS = GENERATED_JUGGERNAUT_RAIL_ICON_ASSET_URLS;
export { GENERATED_DEFAULT_JUGGERNAUT_RAIL_ICON_PACK_ID };
export { DEFAULT_JUGGERNAUT_RAIL_ICON_PACK_ID };

export function getJuggernautRailIconAssetUrl(toolId = "", packId = DEFAULT_JUGGERNAUT_RAIL_ICON_PACK_ID) {
  const normalizedPackId = String(packId || "").trim();
  const resolvedPackId =
    normalizedPackId && normalizedPackId !== DEFAULT_JUGGERNAUT_RAIL_ICON_PACK_ID
      ? normalizedPackId
      : GENERATED_DEFAULT_JUGGERNAUT_RAIL_ICON_PACK_ID;
  return getGeneratedJuggernautRailIconAssetUrl(toolId, resolvedPackId);
}

export function getJuggernautRailIconMarkup(toolId = "", packId = DEFAULT_JUGGERNAUT_RAIL_ICON_PACK_ID) {
  const normalizedToolId = String(toolId || "").trim();
  if (!normalizedToolId) return "";
  const normalizedPackId = String(packId || "").trim() || DEFAULT_JUGGERNAUT_RAIL_ICON_PACK_ID;
  if (normalizedPackId === DEFAULT_JUGGERNAUT_RAIL_ICON_PACK_ID) {
    return LEGACY_DEFAULT_INLINE_MARKUP[normalizedToolId] || "";
  }
  return getGeneratedJuggernautRailIconMarkup(normalizedToolId, normalizedPackId);
}
