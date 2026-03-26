import { DESIGN_REVIEW_PLANNER_MODEL } from "./design_review_contract.js";
import { invokeDesignReviewProviderRequest } from "./design_review_backend.js";
import { createDesignReviewProviderRouter } from "./design_review_provider_router.js";

export const AGENT_RUNNER_GOAL_CONTRACT_SCHEMA_VERSION = "juggernaut.agent_runner_goal_contract.v1";
export const AGENT_RUNNER_GOAL_CHECK_SCHEMA_VERSION = "juggernaut.agent_runner_goal_check.v1";
export const AGENT_RUNNER_GOAL_CONTRACT_MODEL = DESIGN_REVIEW_PLANNER_MODEL;

const GOAL_TYPES = new Set([
  "identity_transfer",
  "style_transfer",
  "co_presence",
  "competition",
  "directed_action",
  "placement",
  "object_addition",
  "background_change",
  "general_visual_transform",
]);

function asRecord(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : null;
}

function cloneJson(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

function readFirstString(...values) {
  for (const value of values) {
    const text = String(value ?? "").trim();
    if (text) return text;
  }
  return "";
}

function clampText(value, maxLen = 220) {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  if (!text) return "";
  if (text.length <= maxLen) return text;
  return `${text.slice(0, Math.max(0, maxLen - 1))}…`;
}

function normalizeKey(value = "") {
  return readFirstString(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function clamp01(value, fallback = 0) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  if (numeric <= 0) return 0;
  if (numeric >= 1) return 1;
  return numeric;
}

function uniqueStrings(values = [], { limit = 8, maxLen = 120 } = {}) {
  const out = [];
  const seen = new Set();
  for (const value of Array.isArray(values) ? values : []) {
    const text = clampText(value, maxLen);
    if (!text) continue;
    const key = normalizeKey(text);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(text);
    if (out.length >= limit) break;
  }
  return out;
}

function _stripJsonFences(raw) {
  let text = String(raw || "").trim();
  if (!text) return "";
  if (text.startsWith("```")) {
    text = text.replace(/^```(?:json)?/i, "").trim();
    text = text.replace(/```$/i, "").trim();
  }
  return text.trim();
}

function _extractFencedJsonBlocks(raw) {
  const text = String(raw || "");
  if (!text.includes("```")) return [];
  const out = [];
  const re = /```(?:json)?\s*([\s\S]*?)```/gi;
  let match = null;
  while ((match = re.exec(text)) !== null) {
    const body = String(match?.[1] || "").trim();
    if (body) out.push(body);
  }
  return out;
}

function _extractBalancedJsonBlocks(raw) {
  const text = String(raw || "");
  if (!text) return [];
  const out = [];
  const stack = [];
  let start = -1;
  let quote = "";
  let escaped = false;
  for (let index = 0; index < text.length; index += 1) {
    const ch = text[index];
    if (quote) {
      if (escaped) {
        escaped = false;
      } else if (ch === "\\") {
        escaped = true;
      } else if (ch === quote) {
        quote = "";
      }
      continue;
    }
    if (ch === "\"") {
      quote = ch;
      continue;
    }
    if (ch === "{" || ch === "[") {
      if (!stack.length) start = index;
      stack.push(ch);
      continue;
    }
    if (ch !== "}" && ch !== "]") continue;
    if (!stack.length) continue;
    const open = stack[stack.length - 1];
    const pairOk = (open === "{" && ch === "}") || (open === "[" && ch === "]");
    if (!pairOk) {
      stack.length = 0;
      start = -1;
      continue;
    }
    stack.pop();
    if (!stack.length && start >= 0) {
      const snippet = text.slice(start, index + 1).trim();
      if (snippet) out.push(snippet);
      start = -1;
    }
  }
  return out;
}

function tryParseJsonLoose(raw = "") {
  const text = String(raw || "").trim();
  if (!text) return null;
  const attempts = [text];
  const noTrailingCommas = text.replace(/,\s*([}\]])/g, "$1");
  if (noTrailingCommas !== text) attempts.push(noTrailingCommas);
  for (const attempt of attempts) {
    try {
      return JSON.parse(attempt);
    } catch {
      // try next
    }
  }
  return null;
}

function extractStructuredJsonCandidate(raw = "") {
  const candidates = [];
  const seen = new Set();
  const addCandidate = (value) => {
    const text = String(value || "").trim();
    if (!text || seen.has(text)) return;
    seen.add(text);
    candidates.push(text);
  };
  addCandidate(raw);
  addCandidate(_stripJsonFences(raw));
  for (const block of _extractFencedJsonBlocks(raw)) addCandidate(block);
  for (const block of _extractBalancedJsonBlocks(raw)) addCandidate(block);
  for (const candidate of candidates) {
    const parsed = tryParseJsonLoose(candidate);
    if (parsed && typeof parsed === "object") return parsed;
  }
  return null;
}

function summarizeVisibleImageHints(shellSnapshot = null) {
  const shell = asRecord(shellSnapshot) || {};
  const images = Array.isArray(shell.images)
    ? shell.images
    : Array.isArray(shell?.communicationReview?.canvas?.visibleImages)
      ? shell.communicationReview.canvas.visibleImages
      : [];
  return images.slice(0, 6).map((image) => ({
    imageId: readFirstString(image?.id, image?.imageId) || null,
    label: clampText(image?.label || image?.name || image?.title || image?.path, 80) || null,
    active: Boolean(image?.active),
    selected: Boolean(image?.selected),
  }));
}

function normalizeGoalType(value = "") {
  const normalized = normalizeKey(value);
  return GOAL_TYPES.has(normalized) ? normalized : "general_visual_transform";
}

function normalizeEntityList(values = []) {
  const out = [];
  const seen = new Set();
  for (const value of Array.isArray(values) ? values : []) {
    const record = asRecord(value) || {};
    const name = clampText(record.name || record.entity || record.subject, 80);
    if (!name) continue;
    const seenKey = normalizeKey(name);
    if (!seenKey || seen.has(seenKey)) continue;
    seen.add(seenKey);
    out.push({
      name,
      role: clampText(record.role || "unknown", 24) || "unknown",
      minVisibleCount: Math.max(1, Math.min(4, Number(record.minVisibleCount ?? record.min_count ?? 1) || 1)),
      requiredVisible: record.requiredVisible !== false,
    });
    if (out.length >= 6) break;
  }
  return out;
}

function normalizeObjectList(values = []) {
  const out = [];
  const seen = new Set();
  for (const value of Array.isArray(values) ? values : []) {
    const record = asRecord(value) || {};
    const name = clampText(record.name || record.object || record.label, 80);
    if (!name) continue;
    const seenKey = normalizeKey(name);
    if (!seenKey || seen.has(seenKey)) continue;
    seen.add(seenKey);
    out.push({
      name,
      minVisibleCount: Math.max(1, Math.min(8, Number(record.minVisibleCount ?? record.min_count ?? 1) || 1)),
      requiredVisible: record.requiredVisible !== false,
    });
    if (out.length >= 6) break;
  }
  return out;
}

function normalizeInteractionList(values = []) {
  const out = [];
  const seen = new Set();
  for (const value of Array.isArray(values) ? values : []) {
    const record = asRecord(value) || {};
    const description = clampText(record.description || record.summary || record.label, 160);
    const type = clampText(normalizeKey(record.type || record.kind || "interaction"), 40) || "interaction";
    const key = `${type}:${normalizeKey(description)}`;
    if (!description || seen.has(key)) continue;
    seen.add(key);
    out.push({
      type,
      description,
      participants: uniqueStrings(record.participants || record.entities || [], { limit: 4, maxLen: 80 }),
      sport: clampText(record.sport, 40) || null,
      mustBeVisible: record.mustBeVisible !== false,
    });
    if (out.length >= 4) break;
  }
  return out;
}

function buildDerivedStopRules(contract = null) {
  const record = asRecord(contract) || {};
  const hard = asRecord(record.hardRequirements) || {};
  const rules = [];
  for (const entity of normalizeEntityList(hard.entities)) {
    rules.push(`${entity.name} must be visibly present on the canvas.`);
  }
  for (const object of normalizeObjectList(hard.objects)) {
    rules.push(`${object.name} must be visibly present on the canvas.`);
  }
  for (const interaction of normalizeInteractionList(hard.interactions)) {
    rules.push(interaction.description);
  }
  for (const cue of uniqueStrings(hard.sceneCues || [], { limit: 4, maxLen: 100 })) {
    rules.push(`The scene should visibly read as ${cue}.`);
  }
  return uniqueStrings(rules, { limit: 8, maxLen: 180 });
}

export function normalizeAgentRunnerGoalContract(raw = null, { goal = "" } = {}) {
  const record = asRecord(raw) || {};
  const hardRequirements = asRecord(record.hardRequirements) || {};
  const contract = {
    schemaVersion: AGENT_RUNNER_GOAL_CONTRACT_SCHEMA_VERSION,
    goalText: clampText(goal, 400),
    goalSummary: clampText(record.goalSummary || record.summary || goal, 220),
    goalType: normalizeGoalType(record.goalType || record.goal_type || record.kind),
    hardRequirements: {
      entities: normalizeEntityList(hardRequirements.entities),
      objects: normalizeObjectList(hardRequirements.objects),
      interactions: normalizeInteractionList(hardRequirements.interactions),
      sceneCues: uniqueStrings(hardRequirements.sceneCues || hardRequirements.scene_cues || [], {
        limit: 6,
        maxLen: 100,
      }),
      preserve: uniqueStrings(hardRequirements.preserve || [], { limit: 6, maxLen: 120 }),
    },
    softIntents: uniqueStrings(record.softIntents || record.soft_intents || [], { limit: 8, maxLen: 100 }),
    forbiddenShortcuts: uniqueStrings(record.forbiddenShortcuts || record.forbidden_shortcuts || [], {
      limit: 8,
      maxLen: 64,
    }),
    unknownPhrases: uniqueStrings(record.unknownPhrases || record.unknown_phrases || [], { limit: 6, maxLen: 120 }),
    stopRules: uniqueStrings(record.stopRules || record.stop_rules || buildDerivedStopRules(record), {
      limit: 8,
      maxLen: 180,
    }),
    compileConfidence: clamp01(record.compileConfidence ?? record.confidence ?? 0.5, 0.5),
  };
  return contract;
}

export function summarizeAgentRunnerGoalContract(contract = null) {
  const record = asRecord(contract);
  if (!record) return "Goal contract unavailable.";
  const bits = [];
  const goalType = clampText(record.goalType, 32);
  if (goalType) bits.push(goalType.replace(/_/g, " "));
  const entities = normalizeEntityList(record?.hardRequirements?.entities);
  if (entities.length) bits.push(entities.map((entity) => entity.name).join(" + "));
  const interactions = normalizeInteractionList(record?.hardRequirements?.interactions);
  if (interactions.length) bits.push(interactions[0].description);
  const sceneCue = uniqueStrings(record?.hardRequirements?.sceneCues || [], { limit: 1, maxLen: 80 })[0];
  if (sceneCue) bits.push(`scene: ${sceneCue}`);
  const shortcuts = uniqueStrings(record?.forbiddenShortcuts || [], { limit: 2, maxLen: 40 });
  if (shortcuts.length) bits.push(`avoid ${shortcuts.join(", ")}`);
  return clampText(bits.join(" · ") || record.goalSummary || record.goalText || "Goal contract ready.", 240);
}

export function buildAgentRunnerGoalContractPrompt({ goal = "", shellSnapshot = null } = {}) {
  const visibleImageHints = summarizeVisibleImageHints(shellSnapshot);
  return [
    "You are compiling a user's Cue Agent Run goal into a compact visual goal contract.",
    "Return JSON only.",
    "Extract only what is useful for visual planning, routing, and visible completion checks.",
    "Hard requirements must be objectively checkable on the visible canvas.",
    "Soft intents are style, tone, humor, era, or vibe instructions that guide planning but should not block stop.",
    "Unknown or ambiguous phrases must stay in unknownPhrases instead of being overinterpreted.",
    "Do not invent named entities, objects, or scene requirements that are not grounded in the goal or the visible-image hints.",
    "If the goal implies visible competition, placement, co-presence, or directed interaction, capture that in hardRequirements.interactions.",
    "If the goal could be falsely satisfied by style cues alone, list the weak proxy in forbiddenShortcuts, such as style_only, palette_only, prop_only, uniform_only, or single_subject_only.",
    "Prefer sparse contracts. If the goal is mostly vibes, keep hardRequirements light.",
    "",
    JSON.stringify(
      {
        goal: clampText(goal, 400),
        visibleImageHints,
      },
      null,
      2
    ),
    "",
    JSON.stringify(
      {
        schemaVersion: AGENT_RUNNER_GOAL_CONTRACT_SCHEMA_VERSION,
        goalSummary: "short normalized reading of the goal",
        goalType:
          "identity_transfer | style_transfer | co_presence | competition | directed_action | placement | object_addition | background_change | general_visual_transform",
        hardRequirements: {
          entities: [
            {
              name: "named person, character, or subject",
              role: "primary | secondary | reference | unknown",
              minVisibleCount: 1,
              requiredVisible: true,
            },
          ],
          objects: [
            {
              name: "required visible object",
              minVisibleCount: 1,
              requiredVisible: true,
            },
          ],
          interactions: [
            {
              type: "short interaction key",
              description: "short visible interaction requirement",
              participants: ["entity A", "entity B"],
              sport: "optional sport or domain",
              mustBeVisible: true,
            },
          ],
          sceneCues: ["short visible scene/domain cue"],
          preserve: ["short preserve instruction when the goal explicitly asks to keep something intact"],
        },
        softIntents: ["style or vibe direction that should not block stop"],
        forbiddenShortcuts: ["style_only"],
        unknownPhrases: ["ambiguous phrase kept unresolved"],
        stopRules: ["short visible completion rule"],
        compileConfidence: 0.0,
      },
      null,
      2
    ),
  ].join("\n");
}

export function parseAgentRunnerGoalContractResponse(raw = "", { goal = "" } = {}) {
  const parsed = extractStructuredJsonCandidate(raw);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("Goal contract response did not contain a JSON object");
  }
  return normalizeAgentRunnerGoalContract(parsed, { goal });
}

export function buildAgentRunnerGoalCheckPrompt({
  goal = "",
  goalContract = null,
  lastPlan = null,
  visibleImages = [],
  recentLog = [],
} = {}) {
  const contract = normalizeAgentRunnerGoalContract(goalContract, { goal });
  const compactVisibleImages = (Array.isArray(visibleImages) ? visibleImages : []).slice(0, 6).map((image) => ({
    id: readFirstString(image?.id, image?.imageId) || null,
    label: clampText(image?.label, 80) || null,
    active: Boolean(image?.active),
    selected: Boolean(image?.selected),
  }));
  const compactRecentLog = (Array.isArray(recentLog) ? recentLog : []).slice(-6).map((entry) => ({
    kind: readFirstString(entry?.kind) || "info",
    message: clampText(entry?.message, 120),
    actionType: readFirstString(entry?.actionType) || null,
  }));
  return [
    "You are validating whether the current visible canvas satisfies a compiled Cue Agent Run goal contract.",
    "Judge only what is visibly present on the provided canvas image.",
    "Hard requirements are strict. If any hard requirement is missing, only implied, or replaced by a weaker proxy, allowStop must be false.",
    "Soft intents are non-blocking quality signals. They can improve confidence, but they must not override a missing hard requirement.",
    "Do not give credit for setup work, marks, hidden intent, likely next steps, or off-canvas assumptions.",
    "Style cues, props, palette shifts, uniforms, or single-subject restyling do not satisfy a missing named entity or missing interaction unless the contract itself says they do.",
    "Return JSON only.",
    "",
    JSON.stringify(
      {
        goal: clampText(goal, 400),
        goalContract: contract,
        lastPlanSummary: clampText(lastPlan?.summary, 160) || null,
        visibleImages: compactVisibleImages,
        recentActivity: compactRecentLog,
      },
      null,
      2
    ),
    "",
    JSON.stringify(
      {
        schemaVersion: AGENT_RUNNER_GOAL_CHECK_SCHEMA_VERSION,
        allowStop: false,
        summary: "short visible verdict",
        missingHardRequirements: ["short missing requirement"],
        satisfiedHardRequirements: ["short satisfied requirement"],
        confidence: 0.0,
      },
      null,
      2
    ),
  ].join("\n");
}

export function parseAgentRunnerGoalCheckResponse(raw = "") {
  const parsed = extractStructuredJsonCandidate(raw);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("Goal check response did not contain a JSON object");
  }
  return {
    schemaVersion: AGENT_RUNNER_GOAL_CHECK_SCHEMA_VERSION,
    allowStop: Boolean(parsed.allowStop ?? parsed.allow_stop),
    summary: clampText(parsed.summary || parsed.reason || parsed.verdict, 220) || "Goal check unavailable.",
    missingHardRequirements: uniqueStrings(parsed.missingHardRequirements || parsed.missing_hard_requirements || [], {
      limit: 8,
      maxLen: 140,
    }),
    satisfiedHardRequirements: uniqueStrings(
      parsed.satisfiedHardRequirements || parsed.satisfied_hard_requirements || [],
      {
        limit: 8,
        maxLen: 140,
      }
    ),
    confidence: clamp01(parsed.confidence ?? 0.5, 0.5),
  };
}

export function createAgentRunnerGoalContractCompiler({
  requestProvider = invokeDesignReviewProviderRequest,
  getKeyStatus = null,
} = {}) {
  const providerRouter = createDesignReviewProviderRouter({
    requestProvider,
    getKeyStatus,
  });

  return {
    async compile({ goal = "", shellSnapshot = null, requestId = null } = {}) {
      const prompt = buildAgentRunnerGoalContractPrompt({
        goal,
        shellSnapshot,
      });
      const result = await providerRouter.runGoalContract({
        request: { requestId: readFirstString(requestId) || null },
        prompt,
      });
      const rawText = readFirstString(result?.text, result?.outputText, result?.value);
      const goalContract = parseAgentRunnerGoalContractResponse(rawText, { goal });
      return {
        model: AGENT_RUNNER_GOAL_CONTRACT_MODEL,
        prompt,
        rawText,
        goalContract,
        result,
      };
    },
    async checkStop({
      goal = "",
      goalContract = null,
      lastPlan = null,
      visibleImages = [],
      recentLog = [],
      image = null,
      requestId = null,
    } = {}) {
      const prompt = buildAgentRunnerGoalCheckPrompt({
        goal,
        goalContract,
        lastPlan,
        visibleImages,
        recentLog,
      });
      const images = image ? [cloneJson(image)] : [];
      const result = await providerRouter.runGoalCheck({
        request: { requestId: readFirstString(requestId) || null },
        prompt,
        images,
      });
      const rawText = readFirstString(result?.text, result?.outputText, result?.value);
      const verdict = parseAgentRunnerGoalCheckResponse(rawText);
      return {
        model: AGENT_RUNNER_GOAL_CONTRACT_MODEL,
        prompt,
        rawText,
        verdict,
        result,
      };
    },
  };
}
