import { DESIGN_REVIEW_PLANNER_MODEL } from "./design_review_contract.js";
import { invokeDesignReviewProviderRequest } from "./design_review_backend.js";
import { createDesignReviewProviderRouter } from "./design_review_provider_router.js";

export const AGENT_RUNNER_PLANNER_OPTIONS = Object.freeze([
  Object.freeze({
    id: "auto",
    label: `Auto (${DESIGN_REVIEW_PLANNER_MODEL})`,
    preferredPlannerProvider: "",
  }),
  Object.freeze({
    id: "openai",
    label: `OpenAI · ${DESIGN_REVIEW_PLANNER_MODEL}`,
    preferredPlannerProvider: "openai",
  }),
  Object.freeze({
    id: "openrouter",
    label: `OpenRouter · ${DESIGN_REVIEW_PLANNER_MODEL}`,
    preferredPlannerProvider: "openrouter",
  }),
]);

export const AGENT_RUNNER_DEFAULT_MAX_STEPS = 8;
export const AGENT_RUNNER_MAX_STEPS_LIMIT = 24;

const SEEDED_TOOL_IDS = new Set(["cut_out", "remove", "new_background", "reframe", "variants"]);
const DIRECT_AFFORDANCE_IDS = new Set(["remove_people", "polish", "relight"]);
const STOPLIKE_ACTIONS = new Set(["stop", "done", "complete", "finish"]);
const REVIEW_REQUEST_ACTIONS = new Set(["design_review", "request_design_review", "review"]);
const REVIEW_ACCEPT_ACTIONS = new Set(["accept_review_proposal", "accept_review", "accept_proposal"]);
const SET_ACTIVE_IMAGE_ACTIONS = new Set(["set_active_image", "activate_image", "focus_image"]);
const SET_SELECTED_IMAGES_ACTIONS = new Set(["set_selected_images", "select_images", "select_canvas_images"]);
const CREATE_TOOL_PREVIEW_ACTIONS = new Set(["preview_create_tool", "preview_tool"]);
const CREATE_TOOL_ACTIONS = new Set(["create_tool", "make_tool"]);
const CUSTOM_TOOL_ACTIONS = new Set(["invoke_custom_tool", "run_custom_tool"]);
const EXPORT_ACTIONS = new Set(["export_psd", "export"]);
const OBSERVABLE_MARKER_ACTIONS = new Set(["marker_stroke", "marker"]);
const OBSERVABLE_MAGIC_SELECT_ACTIONS = new Set(["magic_select_click", "magic_select", "magicselect"]);
const OBSERVABLE_ERASER_ACTIONS = new Set(["eraser_stroke", "eraser"]);

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

function normalizeNumber(value, fallback = null) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function normalizePoint(point = null, label = "point") {
  const x = normalizeNumber(point?.x);
  const y = normalizeNumber(point?.y);
  if (!Number.isFinite(x) || !Number.isFinite(y)) {
    throw new Error(`${label} requires finite x and y values`);
  }
  return { x, y };
}

function normalizePointList(points = [], { minPoints = 1, label = "points" } = {}) {
  const out = [];
  for (const point of Array.isArray(points) ? points : []) {
    out.push(normalizePoint(point, label));
  }
  if (out.length < minPoints) {
    throw new Error(`${label} requires at least ${minPoints} point${minPoints === 1 ? "" : "s"}`);
  }
  return out;
}

function normalizePointPct(point = null, label = "pointPct") {
  const x = clamp01(point?.x, Number.NaN);
  const y = clamp01(point?.y, Number.NaN);
  if (!Number.isFinite(x) || !Number.isFinite(y)) {
    throw new Error(`${label} requires normalized x and y values between 0 and 1`);
  }
  return { x, y };
}

function normalizePointPctList(points = [], { minPoints = 1, label = "pointsPct" } = {}) {
  const out = [];
  for (const point of Array.isArray(points) ? points : []) {
    out.push(normalizePointPct(point, label));
  }
  if (out.length < minPoints) {
    throw new Error(`${label} requires at least ${minPoints} point${minPoints === 1 ? "" : "s"}`);
  }
  return out;
}

function normalizeImageIdList(values = [], { min = 0, max = 3, label = "imageIds" } = {}) {
  const out = [];
  for (const value of Array.isArray(values) ? values : []) {
    const imageId = readFirstString(value);
    if (!imageId || out.includes(imageId)) continue;
    out.push(imageId);
  }
  if (out.length < min) {
    throw new Error(`${label} requires at least ${min} image id${min === 1 ? "" : "s"}`);
  }
  if (out.length > max) {
    throw new Error(`${label} supports at most ${max} image ids`);
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

function _tryParseJsonLoose(raw) {
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

function extractStructuredPlanCandidate(raw = "") {
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
    const parsed = _tryParseJsonLoose(candidate);
    if (parsed && typeof parsed === "object") {
      return parsed;
    }
  }
  return null;
}

function summarizeVisibleImages(visibleImages = []) {
  return (Array.isArray(visibleImages) ? visibleImages : []).slice(0, 6).map((image) => ({
    id: readFirstString(image?.id) || null,
    label: readFirstString(image?.label) || null,
    active: Boolean(image?.active),
    selected: Boolean(image?.selected),
    rectCss: asRecord(image?.rectCss)
      ? {
          left: Math.round(Number(image.rectCss.left) || 0),
          top: Math.round(Number(image.rectCss.top) || 0),
          width: Math.round(Number(image.rectCss.width) || 0),
          height: Math.round(Number(image.rectCss.height) || 0),
          rotateDeg: Math.round(Number(image.rectCss.rotateDeg) || 0),
          skewXDeg: Math.round(Number(image.rectCss.skewXDeg) || 0),
        }
      : null,
  }));
}

function summarizeMarks(marks = []) {
  return (Array.isArray(marks) ? marks : []).slice(0, 8).map((mark) => ({
    id: readFirstString(mark?.id) || null,
    imageId: readFirstString(mark?.imageId, mark?.sourceImageId) || null,
    coordinateSpace: readFirstString(mark?.coordinateSpace) || null,
    bounds: asRecord(mark?.bounds)
      ? {
          x: Math.round(Number(mark.bounds.x) || 0),
          y: Math.round(Number(mark.bounds.y) || 0),
          width: Math.round(Number(mark.bounds.width ?? mark.bounds.w) || 0),
          height: Math.round(Number(mark.bounds.height ?? mark.bounds.h) || 0),
        }
      : null,
  }));
}

function summarizeRegionSelections(groups = []) {
  return (Array.isArray(groups) ? groups : []).slice(0, 6).map((group) => ({
    imageId: readFirstString(group?.imageId) || null,
    activeCandidateIndex: Number(group?.activeCandidateIndex) || 0,
    chosenCandidateId: readFirstString(group?.chosenCandidateId) || null,
    candidates: (Array.isArray(group?.candidates) ? group.candidates : []).slice(0, 3).map((candidate) => ({
      id: readFirstString(candidate?.id) || null,
      label: readFirstString(candidate?.label) || null,
      confidence: Number(candidate?.confidence) || 0,
      active: Boolean(candidate?.active),
      bounds: asRecord(candidate?.bounds)
        ? {
            x: Math.round(Number(candidate.bounds.x) || 0),
            y: Math.round(Number(candidate.bounds.y) || 0),
            w: Math.round(Number(candidate.bounds.w) || 0),
            h: Math.round(Number(candidate.bounds.h) || 0),
          }
        : null,
    })),
  }));
}

function summarizeSubjectSelectionState({ activeImageId = "", regionSelections = [] } = {}) {
  const imageIds = [];
  for (const group of Array.isArray(regionSelections) ? regionSelections : []) {
    const imageId = readFirstString(group?.imageId);
    if (!imageId || imageIds.includes(imageId)) continue;
    imageIds.push(imageId);
  }
  const activeId = readFirstString(activeImageId) || null;
  return {
    imageIds,
    activeImageHasRegionSelection: Boolean(activeId && imageIds.includes(activeId)),
  };
}

function summarizeReviewState(reviewState = null) {
  const record = asRecord(reviewState) || {};
  return {
    status: readFirstString(record.status) || "idle",
    requestId: readFirstString(record?.request?.requestId, record?.requestId) || null,
    activeApply: asRecord(record.activeApply)
      ? {
          status: readFirstString(record.activeApply.status) || null,
          proposalId: readFirstString(record.activeApply.proposalId) || null,
        }
      : null,
    proposals: (Array.isArray(record.proposals) ? record.proposals : [])
      .slice(0, 3)
      .map((proposal, index) => ({
        rank: index + 1,
        proposalId: readFirstString(proposal?.proposalId, proposal?.id) || null,
        label: clampText(proposal?.label, 80),
        actionType: readFirstString(proposal?.actionType, proposal?.action_type) || null,
        imageId: readFirstString(proposal?.imageId, proposal?.image_id) || null,
        why: clampText(proposal?.why, 120),
      })),
    slots: (Array.isArray(record.slots) ? record.slots : [])
      .slice(0, 3)
      .map((slot, index) => ({
        rank: Number(slot?.rank) || index + 1,
        status: readFirstString(slot?.status) || "unknown",
        proposalId: readFirstString(slot?.proposal?.proposalId, slot?.proposal?.id) || null,
        label: clampText(slot?.proposal?.label, 80),
      })),
  };
}

function summarizeRecentLog(log = []) {
  return (Array.isArray(log) ? log : []).slice(-8).map((entry) => ({
    kind: readFirstString(entry?.kind) || "info",
    message: clampText(entry?.message, 120),
    actionType: readFirstString(entry?.actionType) || null,
    ok: entry?.ok == null ? null : Boolean(entry.ok),
  }));
}

function summarizeSessionTools(sessionTools = []) {
  return (Array.isArray(sessionTools) ? sessionTools : []).slice(0, 8).map((tool) => ({
    toolId: readFirstString(tool?.toolId) || null,
    label: clampText(tool?.label, 42),
    operation: readFirstString(tool?.execution?.operation) || null,
    executionKind: readFirstString(tool?.execution?.kind) || null,
    minImages: Math.max(0, Number(tool?.inputContract?.minImages) || 0),
    maxImages: Math.max(0, Number(tool?.inputContract?.maxImages) || 0),
  }));
}

function summarizeSeededToolStates(singleImageRail = null) {
  const visibleJobs = Array.isArray(singleImageRail?.visibleJobs) ? singleImageRail.visibleJobs : [];
  const seen = new Set();
  const states = [];
  for (const job of visibleJobs) {
    const toolId = readFirstString(job?.jobId, job?.toolId);
    if (!toolId || seen.has(toolId) || !SEEDED_TOOL_IDS.has(toolId)) continue;
    seen.add(toolId);
    states.push({
      toolId,
      enabled: job?.enabled !== false,
      requiresSelection: job?.requiresSelection !== false,
      disabledReason: readFirstString(job?.disabledReason) || null,
      reasonCodes: (Array.isArray(job?.reasonCodes) ? job.reasonCodes : []).slice(0, 6).map((code) => readFirstString(code)).filter(Boolean),
    });
  }
  return states;
}

export function buildAgentRunnerContextSummary({
  goal = "",
  shellSnapshot = null,
  reviewState = null,
  sessionTools = [],
  recentLog = [],
} = {}) {
  const shell = asRecord(shellSnapshot) || {};
  const communication = asRecord(shell.communicationReview) || {};
  const communicationCanvas = asRecord(communication.canvas) || {};
  const communicationData = asRecord(communication.communication) || {};
  const selectedImageIds = Array.isArray(shell.selectedImageIds) ? shell.selectedImageIds.slice(0, 6) : [];
  const regionSelections = summarizeRegionSelections(communicationData.regionSelections);
  const seededToolStates = summarizeSeededToolStates(shell.singleImageRail);
  const availableSeededTools = seededToolStates.length
    ? seededToolStates.filter((tool) => tool.enabled).map((tool) => tool.toolId)
    : Array.from(SEEDED_TOOL_IDS);
  const subjectSelections = summarizeSubjectSelectionState({
    activeImageId: shell.activeImageId,
    regionSelections: communicationData.regionSelections,
  });
  return {
    goal: clampText(goal, 400),
    shell: {
      activeTabId: readFirstString(shell.activeTabId) || null,
      runDir: readFirstString(shell.runDir) || null,
      canvasMode: readFirstString(shell.canvasMode) || null,
      imageCount: Number(shell.imageCount) || 0,
      activeImageId: readFirstString(shell.activeImageId) || null,
      selectedImageIds,
      singleImageRail: seededToolStates.length
        ? {
            visibleJobs: seededToolStates,
          }
        : null,
    },
    canvas: {
      sizeCss: asRecord(communicationCanvas.sizeCss)
        ? {
            width: Math.round(Number(communicationCanvas.sizeCss.width) || 0),
            height: Math.round(Number(communicationCanvas.sizeCss.height) || 0),
          }
        : null,
      visibleImages: summarizeVisibleImages(communicationCanvas.visibleImages),
      marks: summarizeMarks(communicationData.marks),
      regionSelections,
      subjectSelections,
      activeTool: readFirstString(communicationData.tool) || null,
    },
    review: summarizeReviewState(reviewState),
    sessionTools: summarizeSessionTools(sessionTools),
    recentActivity: summarizeRecentLog(recentLog),
    availableActions: {
      selection: ["set_active_image", "set_selected_images"],
      observable: ["marker_stroke", "magic_select_click", "eraser_stroke"],
      review: ["request_design_review", "accept_review_proposal"],
      reviewGuidance: {
        goalAgnostic: true,
        seesVisibleCanvasOnly: true,
        usesVisibleAnnotationsOnly: true,
        preferredPrepActions: ["set_active_image", "set_selected_images", "marker_stroke", "magic_select_click"],
        markBeforeReviewFor: [
          "source_vs_target_disambiguation",
          "subject_placement",
          "interaction_or_pose",
          "destination_area",
        ],
      },
      seededTools: availableSeededTools,
      seededToolStates,
      seededToolGuidance: {
        cut_out: {
          requiresActiveImage: true,
          requiresSubjectRegion: true,
          acceptedRegionSources: ["magic_select_region", "lasso_region"],
          effect: "extract the selected subject into a reusable cutout",
          agentPreferredSetupActions: ["marker_stroke", "magic_select_click"],
          ifDisabledReasonIsSelectionRequired: "Create a subject region on the active source image first.",
        },
        remove: {
          requiresActiveImage: true,
          requiresSubjectRegion: true,
          effect: "erase the selected content from the active image",
          doNotUseFor: ["subject extraction", "preparing a source subject for compositing"],
          ifGoalNeedsReusableSubject: "Use cut_out instead of remove.",
        },
      },
      directAffordances: Array.from(DIRECT_AFFORDANCE_IDS),
      toolCreation: ["preview_create_tool", "create_tool", "invoke_custom_tool"],
      export: ["export_psd"],
      control: ["stop"],
      actionConstraints: {
        focusOnly: ["marker_stroke", "magic_select_click", "eraser_stroke"],
        singleImageTools: {
          toolActionTypes: ["invoke_seeded_tool", "invoke_direct_affordance"],
          requiresActiveImage: true,
          maxSelectedImages: 1,
        },
        multiImageSelection: {
          maxSelectedImages: 3,
        },
      },
    },
  };
}

export function buildAgentRunnerPlannerPrompt(input = {}) {
  const context = buildAgentRunnerContextSummary(input);
  return [
    "You are the planner for Juggernaut Agent Run.",
    "Choose exactly one next action that best advances the visual goal.",
    "Return JSON only. Do not include markdown fences or prose outside the JSON.",
    "The first visual input is the current rendered visible canvas view, including visible marks and overlays.",
    "Any additional visual inputs are visible source images for detail only; use the rendered canvas view to reason about the next step.",
    "",
    "Priorities:",
    "1. Make visible, reversible progress toward the goal.",
    "2. Prefer one bounded action at a time.",
    "3. Use Marker or Magic Select when scope is unclear and visible guidance would help.",
    "4. Use set_active_image or set_selected_images when source and target images must be disambiguated.",
    "5. Only choose invoke_seeded_tool when toolId is listed in availableActions.seededTools.",
    "6. For cut_out, first create a real subject region on the active source image with Magic Select or an existing lasso region; image selection alone is not enough.",
    "7. If cut_out is disabled with selection_required, do not invoke it yet. Use marker_stroke and/or magic_select_click to establish the subject first.",
    "8. remove erases the selected region from the active image. It is destructive cleanup, not subject extraction.",
    "9. Never use remove to isolate or prepare a source subject for compositing into another image. Use cut_out for that.",
    "10. Design Review is goal-agnostic. It sees only the visible canvas plus visible marks and Magic Select regions, not hidden intent.",
    "11. Before request_design_review, use marks and/or Magic Select when composition, placement, interaction, pose, or source-vs-target intent needs to be made explicit on-canvas.",
    "12. For cross-image composites, mark the source subject and the destination area before request_design_review when placement matters.",
    "13. For request_design_review summaries, do not restate the user goal, inferred scene, or hidden intent. Describe only the visible canvas state and visible prep signals.",
    "14. Use request_design_review when the goal is aesthetic, ambiguous, or multi-step and no direct single-image action can complete it.",
    "15. Use accept_review_proposal only if review status is ready and a proposal is available.",
    "16. Use create_tool only when a reusable local pattern is clearly warranted.",
    "17. Export only when the goal appears satisfied.",
    "",
    "Action schema:",
    '{',
    '  "status": "continue" | "complete" | "blocked",',
    '  "summary": "short reason",',
    '  "action": {',
    '    "type": "set_active_image" | "set_selected_images" | "marker_stroke" | "magic_select_click" | "eraser_stroke" | "request_design_review" | "accept_review_proposal" | "invoke_seeded_tool" | "invoke_direct_affordance" | "preview_create_tool" | "create_tool" | "invoke_custom_tool" | "export_psd" | "stop",',
    '    "imageId": "optional image id for single-image actions or observable actions",',
    '    "activeImageId": "for set_selected_images",',
    '    "imageIds": ["for set_selected_images"],',
    '    "points": [{"x": 120, "y": 80}],',
    '    "pointsPct": [{"x": 0.15, "y": 0.22}],',
    '    "point": {"x": 120, "y": 80},',
    '    "pointPct": {"x": 0.5, "y": 0.5},',
    '    "toolId": "for invoke_seeded_tool | invoke_direct_affordance | invoke_custom_tool",',
    '    "proposalId": "for accept_review_proposal",',
    '    "proposalRank": 1,',
    '    "name": "optional tool name",',
    '    "description": "for preview_create_tool or create_tool",',
    '    "params": {}',
    "  }",
    "}",
    "",
    "Coordinate rules:",
    "- points and point are canvas_css coordinates.",
    "- pointsPct and pointPct are normalized 0..1 coordinates inside imageId.rectCss and are preferred when image bounds are available.",
    "- marker_stroke requires at least 2 points.",
    "- eraser_stroke requires at least 1 point.",
    "- Marker, Magic Select, and Eraser are focus-setting actions; they do not change pixels.",
    "- invoke_seeded_tool and invoke_direct_affordance apply to exactly one active image.",
    "- cut_out requires a real Magic Select or lasso region on that active image before it can run.",
    "- remove deletes the selected content from that active image and must not be used to extract a reusable subject.",
    "- Disabled seeded tools appear in availableActions.seededToolStates; do not choose them.",
    "- set_selected_images supports 1..3 visible image ids.",
    "",
    "Context JSON:",
    JSON.stringify(context, null, 2),
  ].join("\n");
}

function normalizeAgentRunnerAction(rawAction = null) {
  const action = asRecord(rawAction);
  if (!action) {
    throw new Error("Planner action must be an object");
  }
  const rawType = normalizeKey(
    action.type || action.actionType || action.action || action.tool || action.operation || action.kind || action.toolId
  );
  const toolId = normalizeKey(action.toolId || action.tool_id || action.id || rawType);
  if (STOPLIKE_ACTIONS.has(rawType)) {
    return {
      type: "stop",
      message: clampText(action.message || action.reason || action.summary, 140),
    };
  }
  if (SET_ACTIVE_IMAGE_ACTIONS.has(rawType)) {
    return {
      type: "set_active_image",
      imageId: readFirstString(action.imageId, action.image_id, action.activeImageId, action.active_image_id) || null,
    };
  }
  if (SET_SELECTED_IMAGES_ACTIONS.has(rawType)) {
    return {
      type: "set_selected_images",
      imageIds: normalizeImageIdList(
        action.imageIds || action.image_ids || action.selectedImageIds || action.selected_image_ids || [],
        {
          min: 1,
          max: 3,
          label: "imageIds",
        }
      ),
      activeImageId:
        readFirstString(action.activeImageId, action.active_image_id, action.imageId, action.image_id) || null,
    };
  }
  if (OBSERVABLE_MARKER_ACTIONS.has(rawType)) {
    const pointsPct = Array.isArray(action.pointsPct || action.points_pct) ? normalizePointPctList(action.pointsPct || action.points_pct, {
      minPoints: 2,
      label: "pointsPct",
    }) : null;
    return {
      type: "marker_stroke",
      imageId: readFirstString(action.imageId, action.image_id) || null,
      points: pointsPct ? null : normalizePointList(action.points, { minPoints: 2 }),
      pointsPct,
      stepDelayMs: Math.max(0, Math.min(2000, Number(action.stepDelayMs ?? action.step_delay_ms) || 0)),
    };
  }
  if (OBSERVABLE_MAGIC_SELECT_ACTIONS.has(rawType)) {
    const pointPct = asRecord(action.pointPct || action.point_pct)
      ? normalizePointPct(action.pointPct || action.point_pct, "pointPct")
      : null;
    return {
      type: "magic_select_click",
      imageId: readFirstString(action.imageId, action.image_id) || null,
      point: pointPct ? null : normalizePoint(action.point, "point"),
      pointPct,
    };
  }
  if (OBSERVABLE_ERASER_ACTIONS.has(rawType)) {
    const pointsPct = Array.isArray(action.pointsPct || action.points_pct)
      ? normalizePointPctList(action.pointsPct || action.points_pct, {
          minPoints: 1,
          label: "pointsPct",
        })
      : null;
    return {
      type: "eraser_stroke",
      imageId: readFirstString(action.imageId, action.image_id) || null,
      points: pointsPct ? null : normalizePointList(action.points, { minPoints: 1 }),
      pointsPct,
      stepDelayMs: Math.max(0, Math.min(2000, Number(action.stepDelayMs ?? action.step_delay_ms) || 0)),
    };
  }
  if (REVIEW_REQUEST_ACTIONS.has(rawType)) {
    return { type: "request_design_review" };
  }
  if (REVIEW_ACCEPT_ACTIONS.has(rawType)) {
    return {
      type: "accept_review_proposal",
      proposalId: readFirstString(action.proposalId, action.proposal_id) || null,
      proposalRank: Math.max(1, Math.min(3, Number(action.proposalRank ?? action.proposal_rank) || 1)),
    };
  }
  if (SEEDED_TOOL_IDS.has(toolId) || SEEDED_TOOL_IDS.has(rawType)) {
    return {
      type: "invoke_seeded_tool",
      toolId: SEEDED_TOOL_IDS.has(toolId) ? toolId : rawType,
      imageId: readFirstString(action.imageId, action.image_id, action.activeImageId, action.active_image_id) || null,
    };
  }
  if (DIRECT_AFFORDANCE_IDS.has(toolId) || DIRECT_AFFORDANCE_IDS.has(rawType)) {
    return {
      type: "invoke_direct_affordance",
      toolId: DIRECT_AFFORDANCE_IDS.has(toolId) ? toolId : rawType,
      imageId: readFirstString(action.imageId, action.image_id, action.activeImageId, action.active_image_id) || null,
      params: cloneJson(asRecord(action.params) || {}),
    };
  }
  if (CREATE_TOOL_PREVIEW_ACTIONS.has(rawType)) {
    return {
      type: "preview_create_tool",
      name: readFirstString(action.name) || "",
      description: readFirstString(action.description, action.prompt) || "",
    };
  }
  if (CREATE_TOOL_ACTIONS.has(rawType)) {
    return {
      type: "create_tool",
      name: readFirstString(action.name) || "",
      description: readFirstString(action.description, action.prompt) || "",
    };
  }
  if (CUSTOM_TOOL_ACTIONS.has(rawType)) {
    return {
      type: "invoke_custom_tool",
      toolId: readFirstString(action.toolId, action.tool_id, action.id) || "",
      imageId: readFirstString(action.imageId, action.image_id, action.activeImageId, action.active_image_id) || null,
    };
  }
  if (EXPORT_ACTIONS.has(rawType)) {
    return { type: "export_psd" };
  }
  throw new Error(`Unsupported planner action: ${rawType || "(empty)"}`);
}

export function summarizeAgentRunnerAction(action = null) {
  const record = asRecord(action) || {};
  const type = readFirstString(record.type) || "unknown";
  if (type === "set_active_image") return `Set active image${record.imageId ? ` (${record.imageId})` : ""}`;
  if (type === "set_selected_images") return `Set selected images${Array.isArray(record.imageIds) && record.imageIds.length ? ` (${record.imageIds.join(", ")})` : ""}`;
  if (type === "marker_stroke") return "Marker stroke";
  if (type === "magic_select_click") return "Magic Select";
  if (type === "eraser_stroke") return "Eraser stroke";
  if (type === "request_design_review") return "Request Design Review";
  if (type === "accept_review_proposal") return `Accept Review Proposal${record.proposalId ? ` (${record.proposalId})` : ""}`;
  if (type === "invoke_seeded_tool") return `Run ${record.toolId}`;
  if (type === "invoke_direct_affordance") return `Run ${record.toolId}`;
  if (type === "preview_create_tool") return `Preview Create Tool${record.name ? ` (${record.name})` : ""}`;
  if (type === "create_tool") return `Create Tool${record.name ? ` (${record.name})` : ""}`;
  if (type === "invoke_custom_tool") return `Run custom tool ${record.toolId}`;
  if (type === "export_psd") return "Export PSD";
  if (type === "stop") return "Stop";
  return type;
}

function sanitizeAgentRunnerPlanSummary(summary = "", action = null) {
  const type = readFirstString(action?.type).toLowerCase();
  const normalized = clampText(summary, 220);
  if (type === "request_design_review") {
    return "Request design review using only the visible canvas, marks, Magic Select regions, and current selections.";
  }
  return normalized || summarizeAgentRunnerAction(action);
}

function sanitizeAgentRunnerRawPlanForDisplay(rawPlan = null, summary = "", action = null) {
  const record = asRecord(rawPlan);
  if (!record) return cloneJson(rawPlan);
  const type = readFirstString(action?.type).toLowerCase();
  if (type !== "request_design_review") return cloneJson(record);
  const next = cloneJson(record);
  next.summary = summary;
  if (Object.prototype.hasOwnProperty.call(next, "reason")) next.reason = summary;
  if (Object.prototype.hasOwnProperty.call(next, "why")) next.why = summary;
  return next;
}

export function parseAgentRunnerPlanResponse(raw = "") {
  const parsed = extractStructuredPlanCandidate(raw);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("Planner response did not contain a JSON object");
  }
  const status = normalizeKey(parsed.status || parsed.state || "continue") || "continue";
  const normalizedStatus = status === "complete" || status === "blocked" ? status : "continue";
  const requestedSummary = clampText(parsed.summary || parsed.reason || parsed.why, 220);
  let action = null;
  if (asRecord(parsed.action)) {
    action = normalizeAgentRunnerAction(parsed.action);
  } else if (normalizedStatus === "complete" || normalizedStatus === "blocked") {
    action = {
      type: "stop",
      message: requestedSummary,
    };
  } else {
    throw new Error("Planner response is missing action");
  }
  const summary = sanitizeAgentRunnerPlanSummary(requestedSummary, action);
  return {
    status: normalizedStatus,
    summary,
    action,
    raw: sanitizeAgentRunnerRawPlanForDisplay(parsed, summary, action),
  };
}

function plannerOption(value = "") {
  const key = normalizeKey(value);
  return AGENT_RUNNER_PLANNER_OPTIONS.find((option) => option.id === key) || AGENT_RUNNER_PLANNER_OPTIONS[0];
}

export function createAgentRunnerPlanner({
  requestProvider = invokeDesignReviewProviderRequest,
  getKeyStatus = null,
} = {}) {
  const routersByOptionId = new Map();

  function routerFor(optionId = "auto") {
    const option = plannerOption(optionId);
    if (!routersByOptionId.has(option.id)) {
      routersByOptionId.set(
        option.id,
        createDesignReviewProviderRouter({
          requestProvider,
          getKeyStatus,
          preferredPlannerProvider: option.preferredPlannerProvider,
        })
      );
    }
    return routersByOptionId.get(option.id);
  }

  return {
    plannerOptions: AGENT_RUNNER_PLANNER_OPTIONS.map((option) => ({ ...option })),
    async plan({
      goal = "",
      shellSnapshot = null,
      reviewState = null,
      sessionTools = [],
      recentLog = [],
      plannerMode = "auto",
      images = [],
      requestId = null,
    } = {}) {
      const prompt = buildAgentRunnerPlannerPrompt({
        goal,
        shellSnapshot,
        reviewState,
        sessionTools,
        recentLog,
      });
      const option = plannerOption(plannerMode);
      const plannerResult = await routerFor(option.id).runPlanner({
        request: { requestId: readFirstString(requestId) || null },
        prompt,
        images: Array.isArray(images) ? images : [],
      });
      const rawText = readFirstString(plannerResult?.text, plannerResult?.outputText, plannerResult?.value);
      const parsed = parseAgentRunnerPlanResponse(rawText);
      return {
        plannerMode: option.id,
        prompt,
        rawText,
        plan: parsed,
        result: plannerResult,
      };
    },
  };
}
