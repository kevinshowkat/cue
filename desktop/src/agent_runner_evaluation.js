const AGENT_RUNNER_EVALUATION_SCHEMA_VERSION = "agent-runner-evaluation-v2";

function readFirstString(...values) {
  for (const value of values) {
    const text = String(value ?? "").trim();
    if (text) return text;
  }
  return "";
}

function asRecord(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value;
}

function clampScore(value) {
  const score = Number(value);
  if (!Number.isFinite(score)) return null;
  return Math.max(0, Math.min(100, Math.round(score)));
}

function normalizeStringList(values = [], { limit = 3 } = {}) {
  const out = [];
  for (const value of Array.isArray(values) ? values : []) {
    const text = readFirstString(value);
    if (!text || out.includes(text)) continue;
    out.push(text);
    if (out.length >= limit) break;
  }
  return out;
}

function stripJsonFences(raw = "") {
  const text = String(raw || "").trim();
  if (!text.startsWith("```")) return text;
  return text.replace(/^```(?:json)?\s*/i, "").replace(/```$/i, "").trim();
}

function tryParseJsonLoose(raw = "") {
  const text = String(raw || "").trim();
  if (!text) return null;
  const candidates = [text, stripJsonFences(text)];
  const firstBrace = text.indexOf("{");
  const lastBrace = text.lastIndexOf("}");
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    candidates.push(text.slice(firstBrace, lastBrace + 1));
  }
  for (const candidate of candidates) {
    const normalized = String(candidate || "").trim();
    if (!normalized) continue;
    try {
      return JSON.parse(normalized);
    } catch {
      // Try the next candidate.
    }
  }
  return null;
}

function summarizeVisibleImages(visibleImages = []) {
  return (Array.isArray(visibleImages) ? visibleImages : [])
    .map((entry) => {
      const record = asRecord(entry);
      if (!record) return null;
      return {
        id: readFirstString(record.id, record.imageId, record.image_id) || null,
        label: readFirstString(record.label, record.name, record.path) || "Image",
        active: Boolean(record.active),
        selected: Boolean(record.selected),
      };
    })
    .filter(Boolean);
}

function summarizeRecentActivity(recentLog = [], { limit = 8 } = {}) {
  return (Array.isArray(recentLog) ? recentLog : [])
    .slice(-Math.max(1, limit))
    .map((entry) => {
      const record = asRecord(entry);
      if (!record) return null;
      return {
        kind: readFirstString(record.kind) || null,
        actionType: readFirstString(record.actionType, record.action_type) || null,
        message: readFirstString(record.message) || null,
        ok: record.ok == null ? null : Boolean(record.ok),
      };
    })
    .filter(Boolean);
}

export function buildAgentRunnerEvaluationPrompt({
  goal = "",
  goalContract = null,
  finishReason = "",
  stepCount = 0,
  lastPlan = null,
  visibleImages = [],
  recentLog = [],
} = {}) {
  const normalizedGoal = readFirstString(goal) || "(missing goal)";
  const normalizedFinishReason = readFirstString(finishReason) || "unknown";
  const lastPlanSummary = readFirstString(lastPlan?.summary) || null;
  return [
    "You are evaluating the final visible canvas result for Cue Agent Run.",
    "Judge only what is visibly present on the canvas image.",
    "Compare the visible result against the user goal.",
    "When a compiled goalContract is present, treat its hardRequirements as the visible completion contract.",
    "Do not give credit for setup work, hidden intent, apparent effort, or reasonable intermediate steps.",
    "If the requested interaction, composition, pose, or placement is still missing, penalize heavily.",
    "Soft intents in goalContract are non-blocking quality signals. Missing a soft intent should not outweigh a failed hard requirement.",
    "A partially prepared canvas should score low even if the intermediate work looks sensible.",
    "",
    "Score rubric:",
    "90-100: the visible result clearly achieves the goal.",
    "70-89: mostly achieved, but with visible misses.",
    "40-69: partial progress; the main goal is still incomplete.",
    "0-39: the goal is not achieved on the visible canvas.",
    "",
    "Suggestion rules:",
    "- Do not suggest direct image edits or next visual fixes.",
    "- Suggestions must be product-facing and actionable.",
    "- uxSuggestions are for clarifying the app UX, controls, feedback, or visible workflow.",
    "- agentSuggestions are for clarifying tool labels, tool descriptions, disabled reasons, planner guidance, or agent affordances.",
    "- If there is no strong suggestion for a category, return an empty array for that category.",
    "",
    "Return JSON only with this shape:",
    "{",
    '  "score": 0,',
    '  "goalAchieved": false,',
    '  "verdict": "one sentence",',
    '  "strengths": ["short visible win"],',
    '  "misses": ["short visible miss"],',
    '  "uxSuggestions": ["short app UX clarification"],',
    '  "agentSuggestions": ["short tool or agent-surface clarification"]',
    "}",
    "",
    JSON.stringify(
      {
        goal: normalizedGoal,
        goalContract: asRecord(goalContract) || null,
        finishReason: normalizedFinishReason,
        stepCount: Math.max(0, Number(stepCount) || 0),
        lastPlanSummary,
        visibleImages: summarizeVisibleImages(visibleImages),
        recentActivity: summarizeRecentActivity(recentLog),
      },
      null,
      2
    ),
  ].join("\n");
}

export function parseAgentRunnerEvaluationResponse(rawText = "", { goal = "" } = {}) {
  const parsed = tryParseJsonLoose(rawText);
  const record = asRecord(parsed);
  if (!record) {
    throw new Error("Agent Run evaluation returned invalid JSON.");
  }
  const score = clampScore(record.score ?? record.finalScore ?? record.rating);
  if (score == null) {
    throw new Error("Agent Run evaluation did not return a numeric score.");
  }
  const verdict =
    readFirstString(record.verdict, record.summary, record.rationale) ||
    (score >= 90 ? "The visible result clearly achieves the goal." : "The visible result does not fully achieve the goal.");
  const misses = normalizeStringList(record.misses || record.gaps || record.failures || record.shortcomings);
  const strengths = normalizeStringList(record.strengths || record.working || record.successes);
  const uxSuggestions = normalizeStringList(
    record.uxSuggestions || record.uiSuggestions || record.productSuggestions || record.workflowSuggestions
  );
  const agentSuggestions = normalizeStringList(
    record.agentSuggestions ||
      record.toolSuggestions ||
      record.agentToolSuggestions ||
      record.plannerSuggestions ||
      record.affordanceSuggestions
  );
  const legacySuggestions = normalizeStringList(record.suggestions || record.nextSteps || record.fixes);
  const suggestions =
    uxSuggestions.length || agentSuggestions.length
      ? normalizeStringList([...uxSuggestions, ...agentSuggestions], { limit: 6 })
      : legacySuggestions;
  const goalAchieved =
    record.goalAchieved == null
      ? score >= 90 && misses.length === 0
      : Boolean(record.goalAchieved);
  return {
    schemaVersion: AGENT_RUNNER_EVALUATION_SCHEMA_VERSION,
    goal: readFirstString(goal) || null,
    score,
    goalAchieved,
    verdict,
    strengths,
    misses,
    uxSuggestions,
    agentSuggestions,
    suggestions,
    rawText: String(rawText || "").trim() || null,
  };
}
