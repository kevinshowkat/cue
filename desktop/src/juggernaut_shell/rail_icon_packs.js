export const DEFAULT_JUGGERNAUT_RAIL_ICON_PACK_ID = "oscillo_ink";

export const JUGGERNAUT_RAIL_ICON_PACKS = Object.freeze([
  Object.freeze({
    id: "oscillo_ink",
    label: "Oscillo / Cuphead",
    settingsLabel: "Oscillo / Cuphead",
    menuLabel: "Oscillo / Cuphead",
    description:
      "Golden-age rubber-hose iconography based on the current Oscillo bookend prompt family, with the Cuphead / Moldenhauer reference carried into simple single-subject symbols.",
    promptStyle:
      "Golden-age animation iconography in the style currently used by the Oscillo Gemini script: Cuphead-era 1930s cartoon line art by Chad and Jared Moldenhauer, with rubber-hose rhythm, bold contour, and a playful simplified silhouette.",
  }),
  Object.freeze({
    id: "industrial_mono",
    label: "Jony Ive",
    settingsLabel: "Jony Ive",
    menuLabel: "Jony Ive",
    description:
      "Quiet, reductive product-icon geometry with restrained volume and calm negative space, as if Jony Ive drafted a humane system icon set.",
    promptStyle:
      "Ultra-reductive product icon as if Jony Ive drew it. Calm geometry, humane proportion, precise edges, sparse detail, considered negative space, and a softened industrial finish.",
  }),
  Object.freeze({
    id: "painterly_folk",
    label: "Frida Kahlo",
    settingsLabel: "Frida Kahlo",
    menuLabel: "Frida Kahlo",
    description:
      "Painterly folk-art iconography with bold handcrafted contour and floral warmth, as if Frida Kahlo translated the rail into symbolic miniature emblems.",
    promptStyle:
      "Painterly folk-art icon as if Frida Kahlo drew it. Hand-painted contour, symbolic clarity, organic balance, artisanal rhythm, and vivid but disciplined shape language.",
  }),
  Object.freeze({
    id: "kinetic_marker",
    label: "Michael Jordan",
    settingsLabel: "Michael Jordan",
    menuLabel: "Michael Jordan",
    description:
      "Athletic, assertive marker iconography with speed and lift, as if Michael Jordan sketched the rail with confident directional motion.",
    promptStyle:
      "Athletic marker icon as if Michael Jordan drew it. Confident motion, crisp attack angle, bold simplified contour, fast visual energy, and unmistakable pose economy.",
  }),
]);

const PACK_BY_ID = new Map(JUGGERNAUT_RAIL_ICON_PACKS.map((pack) => [pack.id, pack]));

export function normalizeJuggernautRailIconPackId(value = "") {
  const key = String(value || "").trim();
  if (PACK_BY_ID.has(key)) return key;
  return DEFAULT_JUGGERNAUT_RAIL_ICON_PACK_ID;
}

export function getJuggernautRailIconPack(value = "") {
  return (
    PACK_BY_ID.get(normalizeJuggernautRailIconPackId(value)) ||
    PACK_BY_ID.get(DEFAULT_JUGGERNAUT_RAIL_ICON_PACK_ID) ||
    JUGGERNAUT_RAIL_ICON_PACKS[0]
  );
}

export function buildJuggernautRailIconGeminiPrompt(blueprint = {}, packValue = "") {
  const pack = getJuggernautRailIconPack(packValue);
  const label = String(blueprint?.label || blueprint?.toolId || "tool").trim() || "tool";
  const semanticRole = String(blueprint?.semanticRole || "").trim();
  const notes = String(blueprint?.notes || "").trim();
  const promptParts = [
    "Design a single desktop-tool icon.",
    pack.promptStyle,
    "Make the icon simple, clear, uncluttered, and immediately legible.",
    "Prefer bold simplified forms over decorative detail.",
    "Single centered subject on a square canvas.",
    "Render the icon large in frame so it occupies roughly sixty percent of the canvas.",
    "Use solid black or near-black icon marks only, with a flat pure white background if transparency is unavailable.",
    "No paper grain, texture, poster layout, frame, scene, card, checkerboard, gradient, or vignette.",
    "Avoid letters, words, numerals, interface frames, speech bubbles, extra props, or drop shadows.",
    "Keep the silhouette readable at 24 by 24 pixels.",
    "Use one unmistakable icon concept, not a detailed illustration.",
    semanticRole ? `Semantic role: ${semanticRole}.` : "",
    notes ? `Depict: ${notes}` : `Depict the ${label} action.`,
  ];
  return promptParts.filter(Boolean).join(" ");
}
