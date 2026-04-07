export const TIMELINE_CAROUSEL_PAGE_RATIO = 0.82;
export const TIMELINE_CAROUSEL_GESTURE_LOCK_PX = 12;
export const TIMELINE_CAROUSEL_GESTURE_THRESHOLD_PX = 38;
export const TIMELINE_CAROUSEL_WHEEL_THRESHOLD_PX = 34;
export const TIMELINE_CAROUSEL_CLICK_SUPPRESS_MS = 240;
export const TIMELINE_CAROUSEL_EDGE_EPSILON_PX = 4;

function timelinePathBaseName(path = "") {
  const normalized = String(path || "").trim();
  if (!normalized) return "";
  const segments = normalized.split(/[\\/]/).filter(Boolean);
  return segments[segments.length - 1] || "";
}

function defaultTimelineActionKey(action = null, kind = null) {
  const normalized = String(action || "").trim().toLowerCase();
  if (normalized.includes("highlight") || normalized.includes("protect")) return "highlight";
  if (normalized.includes("magic")) return "magic";
  if (normalized.includes("erase region")) return "erase";
  if (normalized.includes("erase mark")) return "erase";
  if (normalized.includes("delete")) return "delete";
  if (normalized.includes("annotate")) return "annotate";
  if (normalized.includes("circle")) return "circle";
  if (normalized.includes("resize")) return "resize";
  if (normalized.includes("rotate")) return "rotate";
  if (normalized.includes("skew")) return "skew";
  if (normalized.includes("move")) return "move";
  if (normalized.includes("mark")) return "mark";
  if (normalized.includes("import") || normalized.includes("upload") || normalized.includes("add image")) return "import";
  if (
    normalized.includes("generate") ||
    normalized.includes("recast") ||
    normalized.includes("variation") ||
    normalized.includes("review") ||
    normalized.includes("bridge") ||
    normalized.includes("combine") ||
    normalized.includes("swap dna") ||
    normalized.includes("subject isolation") ||
    normalized.includes("cut out")
  ) {
    return "result";
  }
  if (kind === "image_result") return "result";
  if (kind === "transform") return "move";
  if (kind === "annotation") return "mark";
  if (kind === "delete") return "delete";
  return "state";
}

function defaultTimelineNodeLabel(node = null) {
  if (!node) return "Timeline";
  return (
    String(node?.label || "").trim() ||
    String(node?.action || "").trim() ||
    timelinePathBaseName(node?.previewPath) ||
    "State"
  );
}

function defaultTimelineNodeSummary(node = null, labelFn = defaultTimelineNodeLabel) {
  if (!node) return "Committed session history";
  const action = String(node.action || "").trim();
  const label = typeof labelFn === "function" ? labelFn(node) : defaultTimelineNodeLabel(node);
  const imageCount = Array.isArray(node.imageIds) ? node.imageIds.length : 0;
  const countText = imageCount ? `${imageCount} image${imageCount === 1 ? "" : "s"}` : "";
  const canvasCountText = imageCount ? `${imageCount}-image` : "";
  const targetLabel =
    label && label !== action && label !== "State" && label !== "Timeline"
      ? String(label).trim()
      : "";
  const normalizedAction = action.toLowerCase();
  const singleCanvasContext = countText ? ` (${countText})` : "";
  const multiCanvasContext = imageCount > 1 ? ` in a ${canvasCountText} canvas` : "";
  const parentheticalCanvasContext = countText ? ` (${countText} on canvas)` : "";
  const targetWithContext = targetLabel ? `${targetLabel}${multiCanvasContext}` : "";
  if (normalizedAction === "import" || normalizedAction === "upload" || normalizedAction === "add image") {
    if (targetLabel) return `Imported ${targetLabel}${singleCanvasContext}`;
    if (countText) return `Imported an image${singleCanvasContext}`;
    return "Imported an image";
  }
  if (normalizedAction === "mark") {
    return targetWithContext ? `Marked ${targetWithContext}` : "Added a marker annotation";
  }
  if (normalizedAction === "highlight" || normalizedAction === "protect") {
    return targetWithContext ? `Highlighted ${targetWithContext}` : "Added a highlight annotation";
  }
  if (normalizedAction === "magic select" || normalizedAction === "select" || normalizedAction === "select region") {
    return targetWithContext ? `Selected a region on ${targetWithContext}` : "Selected a region";
  }
  if (normalizedAction === "erase") {
    return targetWithContext ? `Erased part of ${targetWithContext}` : "Erased part of the image";
  }
  if (normalizedAction === "annotate") {
    return targetWithContext ? `Annotated ${targetWithContext}` : "Added an annotation";
  }
  if (normalizedAction === "circle") {
    return targetWithContext ? `Circled ${targetWithContext}` : "Circled a region";
  }
  if (normalizedAction === "delete" || normalizedAction === "remove") {
    if (targetLabel && countText) return `Removed ${targetLabel}${parentheticalCanvasContext}`;
    if (targetLabel) return `Removed ${targetLabel}`;
    if (countText) return `Removed an image${singleCanvasContext}`;
    return "Removed an image";
  }
  if (normalizedAction === "move") {
    return targetWithContext ? `Moved ${targetWithContext}` : "Moved the selection";
  }
  if (normalizedAction === "resize") {
    return targetWithContext ? `Resized ${targetWithContext}` : "Resized the selection";
  }
  if (normalizedAction === "rotate") {
    return targetWithContext ? `Rotated ${targetWithContext}` : "Rotated the selection";
  }
  if (normalizedAction === "skew") {
    return targetWithContext ? `Skewed ${targetWithContext}` : "Skewed the selection";
  }
  if (normalizedAction === "combine") {
    return countText ? `Combined images${parentheticalCanvasContext}` : "Combined multiple images";
  }
  if (normalizedAction === "bridge") {
    return countText ? `Bridged images${parentheticalCanvasContext}` : "Bridged multiple images";
  }
  if (normalizedAction === "triforce") {
    return countText ? `Merged images${parentheticalCanvasContext}` : "Merged multiple images";
  }
  if (normalizedAction === "swap dna") {
    return targetWithContext ? `Swapped the DNA of ${targetWithContext}` : "Swapped image DNA";
  }
  if (normalizedAction === "recast") {
    return targetWithContext ? `Recast ${targetWithContext}` : "Recast the active image";
  }
  if (normalizedAction === "prompt generate") {
    if (targetLabel) return `Generated ${targetLabel}${singleCanvasContext}`;
    if (countText) return `Generated a new image${singleCanvasContext}`;
    return "Generated a new image";
  }
  if (normalizedAction === "create layers") {
    if (targetWithContext) return `Created layers for ${targetWithContext}`;
    if (countText) return `Created layers${singleCanvasContext}`;
    return "Created layers";
  }
  if (normalizedAction === "export") {
    if (targetLabel) return `Exported ${targetLabel}${singleCanvasContext}`;
    if (countText) return `Exported the canvas${singleCanvasContext}`;
    return "Exported the canvas";
  }
  if (action) {
    if (targetWithContext) return `Applied ${action} to ${targetWithContext}`;
    if (countText) return `Applied ${action}${singleCanvasContext}`;
    return `Applied ${action}`;
  }
  return targetLabel || countText || "Committed session history";
}

function defaultTimelineNodeAriaLabel(
  node = null,
  { current = false, future = false, historical = false } = {},
  summaryFn = defaultTimelineNodeSummary
) {
  const pieces = [];
  const summary = typeof summaryFn === "function" ? summaryFn(node) : defaultTimelineNodeSummary(node);
  pieces.push(summary);
  if (current) pieces.push("Current state");
  else if (historical) pieces.push("Historical state");
  else if (future) pieces.push("Future state");
  return pieces.join(". ");
}

function defaultTimelineCardStateForNode(node = null, headNode = null) {
  const headNodeId = String(headNode?.nodeId || "").trim() || null;
  const headSeq = Math.max(0, Number(headNode?.seq) || 0);
  const current = headNodeId === String(node?.nodeId || "").trim();
  const future = !current && Math.max(0, Number(node?.seq) || 0) > headSeq;
  const historical = !current && !future;
  return {
    current,
    future,
    historical,
    inactive: !current,
  };
}

function defaultTimelineNodeStructureKey(node = null) {
  return [
    node?.nodeId || "",
    node?.seq || 0,
    node?.kind || "",
    node?.action || "",
    node?.visualMode || "",
    node?.label || "",
    node?.detail || "",
    node?.previewPath || "",
    node?.previewImageId || "",
    Array.isArray(node?.parents) ? node.parents.join(",") : "",
    Array.isArray(node?.imageIds) ? node.imageIds.join(",") : "",
    Array.isArray(node?.receiptPaths) ? node.receiptPaths.join(",") : "",
    node?.createdAt || 0,
  ].join(":");
}

function defaultTimelineStructureSignature(nodes = [], nodeStructureKey = defaultTimelineNodeStructureKey) {
  const structureKeyForNode =
    typeof nodeStructureKey === "function" ? nodeStructureKey : defaultTimelineNodeStructureKey;
  return Array.from(Array.isArray(nodes) ? nodes : [])
    .map((node) => structureKeyForNode(node))
    .join("|");
}

function defaultTimelineViewSignature(headNode = null) {
  return [String(headNode?.nodeId || "").trim(), Math.max(0, Number(headNode?.seq) || 0)].join(":");
}

export {
  defaultTimelineActionKey as timelineActionKey,
  defaultTimelineNodeLabel as timelineNodeLabel,
  defaultTimelineNodeSummary as timelineNodeSummary,
  defaultTimelineNodeAriaLabel as timelineNodeAriaLabel,
  defaultTimelineCardStateForNode as timelineCardStateForNode,
  defaultTimelineNodeStructureKey as timelineNodeStructureKey,
  defaultTimelineStructureSignature as timelineStructureSignature,
  defaultTimelineViewSignature as timelineViewSignature,
};

export function createTimelineUi({
  state = {},
  els = {},
  timelineSortedNodes = () => [],
  currentTimelineHeadNode = () => null,
  syncActiveTabRecord = () => {},
  timelineNodeLabel = defaultTimelineNodeLabel,
  timelineNodeSummary = (node = null) => defaultTimelineNodeSummary(node, timelineNodeLabel),
  timelineNodeAriaLabel = (node = null, flags = {}) => defaultTimelineNodeAriaLabel(node, flags, timelineNodeSummary),
  timelineCardStateForNode = defaultTimelineCardStateForNode,
  timelineActionKey = defaultTimelineActionKey,
  timelineCardGlyphMarkup = () => "",
  timelineNodeStructureKey = defaultTimelineNodeStructureKey,
  timelineStructureSignature = (nodes = timelineSortedNodes()) =>
    defaultTimelineStructureSignature(nodes, timelineNodeStructureKey),
  timelineViewSignature = (headNode = currentTimelineHeadNode()) => defaultTimelineViewSignature(headNode),
  THUMB_PLACEHOLDER_SRC = "",
  ensureImageUrl = async () => null,
  document: documentRef = globalThis.document,
  requestAnimationFrame: requestAnimationFrameRef =
    typeof globalThis.requestAnimationFrame === "function"
      ? globalThis.requestAnimationFrame.bind(globalThis)
      : null,
  performance: performanceRef = globalThis.performance,
  Date: DateRef = Date,
  bumpInteraction = () => {},
  jumpToTimelineNode = async () => {},
} = {}) {
  function timelineShelfSummaryText(
    nodes = timelineSortedNodes(),
    headNode = currentTimelineHeadNode(),
    { timelineOpen = state.timelineOpen !== false } = {}
  ) {
    if (!Array.isArray(nodes) || !nodes.length) return "Upload an image to start your session history.";
    const count = nodes.length;
    const countLabel = `${count} state${count === 1 ? "" : "s"}`;
    if (timelineOpen) return `${countLabel} · Select a state to rewind`;
    const summary = headNode ? timelineNodeSummary(headNode) : "Committed session history";
    return `${countLabel} · ${summary}`;
  }

  function syncTimelineShelfToggle(nodes = timelineSortedNodes(), headNode = currentTimelineHeadNode()) {
    const timelineOpen = state.timelineOpen !== false;
    const actionLabel = timelineOpen ? "Collapse history timeline" : "Expand history timeline";
    const summary = timelineShelfSummaryText(nodes, headNode, { timelineOpen });
    if (els.timelineToggle) {
      els.timelineToggle.title = actionLabel;
      els.timelineToggle.setAttribute("aria-label", `${actionLabel}. ${summary}`);
      els.timelineToggle.setAttribute("aria-expanded", timelineOpen ? "true" : "false");
    }
    if (els.timelineToggleLabel) {
      els.timelineToggleLabel.textContent = "History";
    }
    if (els.timelineToggleSummary) {
      els.timelineToggleSummary.textContent = summary;
    }
    if (els.timelineDock) {
      els.timelineDock.classList.toggle("is-collapsed", !timelineOpen);
    }
    if (els.timelineShell) {
      els.timelineShell.classList.toggle("is-collapsed", !timelineOpen);
    }
    if (els.timelineBody) {
      els.timelineBody.hidden = !timelineOpen;
      els.timelineBody.setAttribute("aria-hidden", timelineOpen ? "false" : "true");
    }
    return timelineOpen;
  }

  function syncTimelineDockVisibility() {
    if (els.timelineDock) {
      els.timelineDock.classList.remove("hidden");
    }
    const nodes = timelineSortedNodes();
    const headNode = currentTimelineHeadNode();
    return syncTimelineShelfToggle(nodes, headNode);
  }

  function setTimelineOpen(open = true, { persist = false } = {}) {
    const nextOpen = open !== false;
    const changed = state.timelineOpen !== nextOpen;
    state.timelineOpen = nextOpen;
    syncTimelineDockVisibility();
    if (nextOpen) renderTimeline();
    if (changed && persist) {
      syncActiveTabRecord({ capture: true, publish: true });
    }
    return changed;
  }

  function openTimeline(options = {}) {
    return setTimelineOpen(true, options);
  }

  function closeTimeline(options = {}) {
    return setTimelineOpen(false, options);
  }

  function toggleTimeline(options = {}) {
    return setTimelineOpen(state.timelineOpen === false, options);
  }

  function timelineDetailText(headNode = currentTimelineHeadNode()) {
    const headNodeId = String(headNode?.nodeId || "").trim() || null;
    const previewNodeId = String(state.timelinePreviewNodeId || "").trim();
    const previewNode =
      previewNodeId && state.timelineNodesById instanceof Map
        ? state.timelineNodesById.get(previewNodeId) || null
        : null;
    if (!previewNode) return headNode ? timelineNodeSummary(headNode) : "";
    const previewSummary = timelineNodeSummary(previewNode);
    if (previewNodeId === headNodeId) return `Current state: ${previewSummary}`;
    return `Preview change: ${previewSummary}`;
  }

  function syncTimelineDetailText(headNode = currentTimelineHeadNode()) {
    const detail = els.timelineDetail;
    if (!detail) return false;
    if (state.timelinePreviewNodeId) {
      const previewNodeId = String(state.timelinePreviewNodeId || "").trim();
      if (!(state.timelineNodesById instanceof Map) || !state.timelineNodesById.has(previewNodeId)) {
        state.timelinePreviewNodeId = null;
      }
    }
    const nextDetail = timelineDetailText(headNode);
    if (detail.textContent === nextDetail) return false;
    detail.textContent = nextDetail;
    return true;
  }

  function timelineNowMs() {
    if (performanceRef && typeof performanceRef.now === "function") {
      return performanceRef.now();
    }
    return DateRef.now();
  }

  function timelineCarouselAnchors(strip = els.timelineStrip) {
    if (!strip?.querySelectorAll) return [];
    const maxScroll = Math.max(0, Number(strip.scrollWidth || 0) - Number(strip.clientWidth || 0));
    const anchors = new Set([0, maxScroll]);
    const cards = Array.from(strip.querySelectorAll(".timeline-card[data-node-id]"));
    for (const card of cards) {
      const left = Math.max(0, Math.round(Number(card?.offsetLeft) || 0));
      anchors.add(Math.min(maxScroll, left));
    }
    return Array.from(anchors)
      .filter((left) => Number.isFinite(left))
      .sort((a, b) => a - b);
  }

  function timelineCarouselTargetLeft(strip = els.timelineStrip, direction = 0) {
    const normalizedDirection = Number(direction) > 0 ? 1 : Number(direction) < 0 ? -1 : 0;
    if (!strip || !normalizedDirection) return 0;
    const maxScroll = Math.max(0, Number(strip.scrollWidth || 0) - Number(strip.clientWidth || 0));
    if (maxScroll <= 0) return 0;
    const currentLeft = Math.min(maxScroll, Math.max(0, Number(strip.scrollLeft) || 0));
    const anchors = timelineCarouselAnchors(strip);
    if (!anchors.length) return currentLeft;
    const pageWidth = Math.max(1, Math.round(Number(strip.clientWidth || 0) * TIMELINE_CAROUSEL_PAGE_RATIO));
    const currentIndex = anchors.reduce((best, anchor, index) => (anchor <= currentLeft + 4 ? index : best), 0);
    if (normalizedDirection > 0) {
      const desired = Math.min(maxScroll, currentLeft + pageWidth);
      let target = anchors.find((anchor) => anchor >= desired - 4);
      if (target == null || target <= currentLeft + 4) {
        target = anchors[Math.min(anchors.length - 1, currentIndex + 1)] ?? maxScroll;
      }
      return Math.min(maxScroll, Math.max(0, Number(target) || 0));
    }
    const desired = Math.max(0, currentLeft - pageWidth);
    let target = Array.from(anchors)
      .reverse()
      .find((anchor) => anchor <= desired + 4);
    if (target == null || target >= currentLeft - 4) {
      target = anchors[Math.max(0, currentIndex - 1)] ?? 0;
    }
    return Math.min(maxScroll, Math.max(0, Number(target) || 0));
  }

  function timelineCarouselDirectionState(strip = els.timelineStrip) {
    const maxScroll = Math.max(0, Number(strip?.scrollWidth || 0) - Number(strip?.clientWidth || 0));
    const currentLeft = Math.min(maxScroll, Math.max(0, Number(strip?.scrollLeft) || 0));
    const hasOverflow = Boolean(strip && maxScroll > TIMELINE_CAROUSEL_EDGE_EPSILON_PX);
    return {
      hasOverflow,
      currentLeft,
      maxScroll,
      canPageLeft: hasOverflow && currentLeft > TIMELINE_CAROUSEL_EDGE_EPSILON_PX,
      canPageRight: hasOverflow && currentLeft < maxScroll - TIMELINE_CAROUSEL_EDGE_EPSILON_PX,
    };
  }

  function syncTimelineCarouselOverflow(strip = els.timelineStrip) {
    const { hasOverflow, canPageLeft, canPageRight } = timelineCarouselDirectionState(strip);
    strip?.classList?.toggle("is-scrollable", hasOverflow);
    els.timelineShell?.classList?.toggle("is-scrollable", hasOverflow);
    if (els.timelinePrev) {
      els.timelinePrev.classList.toggle("is-hidden", !canPageLeft);
      els.timelinePrev.disabled = !canPageLeft;
      els.timelinePrev.tabIndex = canPageLeft ? 0 : -1;
    }
    if (els.timelineNext) {
      els.timelineNext.classList.toggle("is-hidden", !canPageRight);
      els.timelineNext.disabled = !canPageRight;
      els.timelineNext.tabIndex = canPageRight ? 0 : -1;
    }
    return hasOverflow;
  }

  function scheduleTimelineCarouselChromeSync() {
    if (Number(state.timelineCarouselChromeFrame) > 0) return;
    const run = () => {
      state.timelineCarouselChromeFrame = 0;
      syncTimelineCarouselOverflow();
    };
    if (typeof requestAnimationFrameRef === "function") {
      state.timelineCarouselChromeFrame = requestAnimationFrameRef(run);
      return;
    }
    run();
  }

  function centerTimelineCardInStrip(
    card = null,
    strip = els.timelineStrip,
    { behavior = "smooth", force = false } = {}
  ) {
    if (!card || !strip) return false;
    const maxScroll = Math.max(0, Number(strip.scrollWidth || 0) - Number(strip.clientWidth || 0));
    if (maxScroll <= 0) return false;
    const currentLeft = Math.min(maxScroll, Math.max(0, Number(strip.scrollLeft) || 0));
    const cardLeft = Math.max(0, Number(card.offsetLeft) || 0);
    const cardWidth = Math.max(1, Number(card.offsetWidth) || 0);
    const visibleLeft = currentLeft + 6;
    const visibleRight = currentLeft + Math.max(0, Number(strip.clientWidth || 0)) - 6;
    if (!force && cardLeft >= visibleLeft && cardLeft + cardWidth <= visibleRight) return false;
    const targetLeft = Math.min(
      maxScroll,
      Math.max(0, Math.round(cardLeft - Math.max(0, (Number(strip.clientWidth || 0) - cardWidth) / 2)))
    );
    if (Math.abs(targetLeft - currentLeft) <= 2) return false;
    if (typeof strip.scrollTo === "function") {
      strip.scrollTo({ left: targetLeft, behavior });
    } else {
      strip.scrollLeft = targetLeft;
    }
    return true;
  }

  function scrollTimelineCarousel(direction = 0, { behavior = "smooth" } = {}) {
    const strip = els.timelineStrip;
    const targetLeft = timelineCarouselTargetLeft(strip, direction);
    if (!strip) return false;
    const currentLeft = Math.max(0, Number(strip.scrollLeft) || 0);
    if (Math.abs(targetLeft - currentLeft) <= 2) return false;
    if (typeof strip.scrollTo === "function") {
      strip.scrollTo({ left: targetLeft, behavior });
    } else {
      strip.scrollLeft = targetLeft;
    }
    return true;
  }

  function suppressTimelineCardClick() {
    state.timelineSuppressClickUntil = timelineNowMs() + TIMELINE_CAROUSEL_CLICK_SUPPRESS_MS;
  }

  function shouldSuppressTimelineCardClick() {
    return timelineNowMs() < Math.max(0, Number(state.timelineSuppressClickUntil) || 0);
  }

  function resetTimelineCarouselGesture() {
    const pointerId = state.timelineCarouselGesture?.pointerId;
    if (pointerId != null && typeof els.timelineShell?.releasePointerCapture === "function") {
      try {
        els.timelineShell.releasePointerCapture(pointerId);
      } catch (_) {}
    }
    els.timelineShell?.classList?.remove("is-swiping");
    state.timelineCarouselGesture = null;
  }

  function beginTimelineCarouselGesture(event) {
    if (!els.timelineStrip || !syncTimelineCarouselOverflow()) return;
    if (event?.pointerType === "mouse" && Number(event?.button) !== 0) return;
    if (event?.target?.closest && event.target.closest(".timeline-arrow")) return;
    state.timelineCarouselGesture = {
      pointerId: event?.pointerId ?? null,
      startX: Number(event?.clientX) || 0,
      startY: Number(event?.clientY) || 0,
      dragging: false,
    };
    if (event?.pointerId != null && typeof els.timelineShell?.setPointerCapture === "function") {
      try {
        els.timelineShell.setPointerCapture(event.pointerId);
      } catch (_) {}
    }
  }

  function updateTimelineCarouselGesture(event) {
    const gesture = state.timelineCarouselGesture;
    if (!gesture) return false;
    if (gesture.pointerId != null && event?.pointerId != null && gesture.pointerId !== event.pointerId) return false;
    const dx = (Number(event?.clientX) || 0) - gesture.startX;
    const dy = (Number(event?.clientY) || 0) - gesture.startY;
    if (!gesture.dragging) {
      if (Math.abs(dx) < TIMELINE_CAROUSEL_GESTURE_LOCK_PX && Math.abs(dy) < TIMELINE_CAROUSEL_GESTURE_LOCK_PX) {
        return false;
      }
      if (Math.abs(dx) <= Math.abs(dy)) {
        resetTimelineCarouselGesture();
        return false;
      }
      gesture.dragging = true;
      els.timelineShell?.classList?.add("is-swiping");
    }
    event?.preventDefault?.();
    return true;
  }

  function finishTimelineCarouselGesture(event) {
    const gesture = state.timelineCarouselGesture;
    if (!gesture) return false;
    if (gesture.pointerId != null && event?.pointerId != null && gesture.pointerId !== event.pointerId) return false;
    const dx = (Number(event?.clientX) || 0) - gesture.startX;
    const dy = (Number(event?.clientY) || 0) - gesture.startY;
    const shouldSlide =
      gesture.dragging &&
      Math.abs(dx) >= TIMELINE_CAROUSEL_GESTURE_THRESHOLD_PX &&
      Math.abs(dx) > Math.abs(dy);
    resetTimelineCarouselGesture();
    if (!shouldSlide) return false;
    const moved = scrollTimelineCarousel(dx < 0 ? 1 : -1);
    if (moved) {
      suppressTimelineCardClick();
      event?.preventDefault?.();
    }
    return moved;
  }

  function handleTimelineCarouselWheel(event) {
    if (!els.timelineStrip || !syncTimelineCarouselOverflow()) return false;
    const deltaX = Number(event?.deltaX) || 0;
    const deltaY = Number(event?.deltaY) || 0;
    const usesHorizontalGesture = Math.abs(deltaX) > Math.abs(deltaY) ? deltaX : 0;
    const delta = usesHorizontalGesture || (event?.shiftKey ? deltaY : 0);
    if (!delta) {
      state.timelineCarouselWheel.delta = 0;
      return false;
    }
    const now = timelineNowMs();
    if (now - (Number(state.timelineCarouselWheel?.lastAt) || 0) > 220) {
      state.timelineCarouselWheel.delta = 0;
    }
    state.timelineCarouselWheel.lastAt = now;
    state.timelineCarouselWheel.delta += delta;
    if (Math.abs(state.timelineCarouselWheel.delta) < TIMELINE_CAROUSEL_WHEEL_THRESHOLD_PX) {
      return false;
    }
    const direction = state.timelineCarouselWheel.delta > 0 ? 1 : -1;
    state.timelineCarouselWheel.delta = 0;
    const moved = scrollTimelineCarousel(direction);
    if (moved) {
      suppressTimelineCardClick();
      event?.preventDefault?.();
    }
    return moved;
  }

  function buildTimelineCard(node = null, headNode = currentTimelineHeadNode()) {
    if (!node?.nodeId || !documentRef?.createElement) return null;
    const { current, future, historical, inactive } = timelineCardStateForNode(node, headNode);
    const actionKey = timelineActionKey(node.action, node.kind);
    const usesThumbnail =
      String(node.visualMode || "").trim() === "thumbnail" &&
      String(node.previewPath || "").trim();
    const card = documentRef.createElement("button");
    card.type = "button";
    card.className = `timeline-card ${usesThumbnail ? "timeline-card--thumb" : "timeline-card--icon"}${current ? " selected" : ""}${inactive ? " is-inactive" : ""}${historical ? " is-historical" : ""}${future ? " is-future" : ""}`;
    card.dataset.nodeId = node.nodeId;
    card.dataset.seq = String(Math.max(1, Number(node.seq) || 1));
    card.dataset.structureKey = timelineNodeStructureKey(node);
    card.setAttribute("aria-label", timelineNodeAriaLabel(node, { current, future, historical }));
    card.title = timelineNodeSummary(node);
    const seq = documentRef.createElement("span");
    seq.className = "timeline-card-seq";
    seq.textContent = card.dataset.seq;
    card.appendChild(seq);
    const visual = documentRef.createElement("span");
    visual.className = "timeline-card-visual";
    if (usesThumbnail) {
      const img = documentRef.createElement("img");
      img.alt = timelineNodeLabel(node);
      img.loading = "lazy";
      img.decoding = "async";
      img.src = THUMB_PLACEHOLDER_SRC;
      ensureImageUrl(node.previewPath)
        .then((url) => {
          if (url) img.src = url;
        })
        .catch(() => {});
      visual.appendChild(img);
    } else {
      const glyph = documentRef.createElement("span");
      glyph.className = `timeline-card-glyph timeline-card-glyph--${actionKey}`;
      glyph.innerHTML = timelineCardGlyphMarkup(actionKey);
      visual.appendChild(glyph);
    }
    card.appendChild(visual);
    return card;
  }

  function rebuildTimelineStrip(nodes = timelineSortedNodes(), headNode = currentTimelineHeadNode()) {
    const strip = els.timelineStrip;
    if (!strip) return false;
    els.timelineShell?.classList?.toggle("is-empty", !nodes.length);
    strip.classList?.toggle("is-empty", !nodes.length);
    if (!nodes.length) {
      const currentEmpty = strip.querySelector(".timeline-empty");
      if (
        !currentEmpty ||
        String(currentEmpty.textContent || "").trim() !==
          "Your timeline appears here after you upload your first image."
      ) {
        strip.replaceChildren();
        const empty = documentRef.createElement("div");
        empty.className = "timeline-empty muted";
        empty.textContent = "Your timeline appears here after you upload your first image.";
        strip.appendChild(empty);
      }
      state.lastTimelineCenteredNodeId = null;
      scheduleTimelineCarouselChromeSync();
      return true;
    }

    for (const empty of Array.from(strip.querySelectorAll(".timeline-empty"))) {
      empty.remove();
    }

    const desiredNodeIds = new Set();
    const existingCards = Array.from(strip.querySelectorAll(".timeline-card[data-node-id]"));
    const existingById = new Map();
    for (const card of existingCards) {
      const nodeId = String(card.dataset?.nodeId || "").trim();
      if (!nodeId) continue;
      existingById.set(nodeId, card);
    }

    for (const node of nodes) {
      const nodeId = String(node?.nodeId || "").trim();
      if (!nodeId) continue;
      desiredNodeIds.add(nodeId);
    }

    for (const card of existingCards) {
      const nodeId = String(card.dataset?.nodeId || "").trim();
      if (!nodeId || desiredNodeIds.has(nodeId)) continue;
      card.remove();
      existingById.delete(nodeId);
    }

    let referenceNode = strip.firstChild;
    for (const node of nodes) {
      const nodeId = String(node?.nodeId || "").trim();
      if (!nodeId) continue;
      const structureKey = timelineNodeStructureKey(node);
      let card = existingById.get(nodeId) || null;
      if (!card) {
        card = buildTimelineCard(node, headNode);
        if (!card) continue;
        existingById.set(nodeId, card);
      } else if (String(card.dataset?.structureKey || "") !== structureKey) {
        const replacement = buildTimelineCard(node, headNode);
        if (!replacement) continue;
        if (card.parentNode === strip) {
          strip.replaceChild(replacement, card);
          if (referenceNode === card) referenceNode = replacement;
        }
        existingById.set(nodeId, replacement);
        card = replacement;
      }
      if (card.parentNode !== strip) {
        strip.insertBefore(card, referenceNode);
      } else if (card !== referenceNode) {
        strip.insertBefore(card, referenceNode);
      } else {
        referenceNode = card.nextSibling;
        continue;
      }
      referenceNode = card.nextSibling;
    }

    syncTimelineCarouselOverflow(strip);
    return true;
  }

  function syncTimelineViewState(nodes = timelineSortedNodes(), headNode = currentTimelineHeadNode()) {
    const strip = els.timelineStrip;
    if (!strip) return false;
    const headNodeId = String(headNode?.nodeId || "").trim() || null;
    let changed = false;
    const cards = Array.from(strip.querySelectorAll(".timeline-card[data-node-id]"));
    for (const card of cards) {
      const nodeId = String(card.dataset?.nodeId || "").trim();
      if (!nodeId) continue;
      const node = state.timelineNodesById instanceof Map ? state.timelineNodesById.get(nodeId) || null : null;
      if (!node) continue;
      const { current, future, historical, inactive } = timelineCardStateForNode(node, headNode);
      if (card.classList.contains("selected") !== current) {
        card.classList.toggle("selected", current);
        changed = true;
      }
      if (card.classList.contains("is-inactive") !== inactive) {
        card.classList.toggle("is-inactive", inactive);
        changed = true;
      }
      if (card.classList.contains("is-historical") !== historical) {
        card.classList.toggle("is-historical", historical);
        changed = true;
      }
      if (card.classList.contains("is-future") !== future) {
        card.classList.toggle("is-future", future);
        changed = true;
      }
      const nextAria = timelineNodeAriaLabel(node, { current, future, historical });
      if (card.getAttribute("aria-label") !== nextAria) {
        card.setAttribute("aria-label", nextAria);
        changed = true;
      }
    }
    changed = syncTimelineDetailText(headNode) || changed;
    const selectedCard = headNodeId
      ? cards.find((card) => String(card.dataset?.nodeId || "").trim() === headNodeId) || null
      : null;
    if (selectedCard && headNodeId) {
      centerTimelineCardInStrip(selectedCard, strip, {
        behavior: state.lastTimelineCenteredNodeId === headNodeId ? "auto" : "smooth",
        force: headNodeId !== state.lastTimelineCenteredNodeId,
      });
      state.lastTimelineCenteredNodeId = headNodeId;
    } else if (!headNodeId) {
      state.lastTimelineCenteredNodeId = null;
    }
    scheduleTimelineCarouselChromeSync();
    return changed;
  }

  function renderTimeline() {
    const strip = els.timelineStrip;
    if (!strip) return false;
    const nodes = timelineSortedNodes();
    const headNode = currentTimelineHeadNode();
    syncTimelineShelfToggle(nodes, headNode);
    const structureKey = [
      state.timelineVersion,
      state.timelineLatestNodeId || "",
      state.timelineNextSeq || 1,
      timelineStructureSignature(nodes),
    ].join("||");
    const viewKey = timelineViewSignature(headNode);
    let changed = false;
    if (state.lastRenderedTimelineStructureKey !== structureKey) {
      state.lastRenderedTimelineStructureKey = structureKey;
      state.lastRenderedTimelineViewKey = "";
      rebuildTimelineStrip(nodes, headNode);
      changed = true;
    }
    if (state.lastRenderedTimelineViewKey !== viewKey) {
      state.lastRenderedTimelineViewKey = viewKey;
      syncTimelineViewState(nodes, headNode);
      changed = true;
    } else if (!changed) {
      scheduleTimelineCarouselChromeSync();
    }
    return changed;
  }

  function installTimelineUi() {
    if (els.timelineToggle && els.timelineToggle.dataset.bound !== "1") {
      els.timelineToggle.dataset.bound = "1";
      els.timelineToggle.addEventListener("click", () => {
        bumpInteraction();
        toggleTimeline({ persist: true });
      });
    }
    if (els.timelineShell) {
      els.timelineShell.addEventListener("pointerdown", (event) => {
        beginTimelineCarouselGesture(event);
      });
      els.timelineShell.addEventListener("pointermove", (event) => {
        updateTimelineCarouselGesture(event);
      });
      const finishTimelineShellGesture = (event) => {
        if (finishTimelineCarouselGesture(event)) {
          bumpInteraction();
        }
      };
      els.timelineShell.addEventListener("pointerup", finishTimelineShellGesture);
      els.timelineShell.addEventListener("pointercancel", () => {
        resetTimelineCarouselGesture();
      });
      els.timelineShell.addEventListener(
        "wheel",
        (event) => {
          if (handleTimelineCarouselWheel(event)) {
            bumpInteraction();
          }
        },
        { passive: false }
      );
    }
    if (els.timelinePrev) {
      els.timelinePrev.addEventListener("click", () => {
        if (els.timelinePrev.disabled) return;
        bumpInteraction();
        scrollTimelineCarousel(-1);
      });
    }
    if (els.timelineNext) {
      els.timelineNext.addEventListener("click", () => {
        if (els.timelineNext.disabled) return;
        bumpInteraction();
        scrollTimelineCarousel(1);
      });
    }
    if (els.timelineStrip) {
      els.timelineStrip.addEventListener("scroll", () => {
        scheduleTimelineCarouselChromeSync();
      });
      els.timelineStrip.addEventListener("pointerover", (event) => {
        const card = event?.target?.closest ? event.target.closest(".timeline-card[data-node-id]") : null;
        if (!card || !els.timelineStrip.contains(card)) return;
        const nodeId = String(card.dataset?.nodeId || "").trim();
        if (!nodeId || state.timelinePreviewNodeId === nodeId) return;
        state.timelinePreviewNodeId = nodeId;
        syncTimelineDetailText();
      });
      els.timelineStrip.addEventListener("pointerleave", () => {
        if (!state.timelinePreviewNodeId) return;
        state.timelinePreviewNodeId = null;
        syncTimelineDetailText();
      });
      els.timelineStrip.addEventListener("focusin", (event) => {
        const card = event?.target?.closest ? event.target.closest(".timeline-card[data-node-id]") : null;
        if (!card || !els.timelineStrip.contains(card)) return;
        const nodeId = String(card.dataset?.nodeId || "").trim();
        if (!nodeId || state.timelinePreviewNodeId === nodeId) return;
        state.timelinePreviewNodeId = nodeId;
        syncTimelineDetailText();
      });
      els.timelineStrip.addEventListener("focusout", (event) => {
        const related = event?.relatedTarget;
        if (related && els.timelineStrip.contains(related)) return;
        if (!state.timelinePreviewNodeId) return;
        state.timelinePreviewNodeId = null;
        syncTimelineDetailText();
      });
      els.timelineStrip.addEventListener("click", (event) => {
        if (shouldSuppressTimelineCardClick()) {
          event.preventDefault();
          return;
        }
        const card = event?.target?.closest ? event.target.closest(".timeline-card[data-node-id]") : null;
        if (!card || !els.timelineStrip.contains(card)) return;
        const nodeId = card.dataset?.nodeId;
        if (!nodeId) return;
        state.timelinePreviewNodeId = null;
        bumpInteraction();
        jumpToTimelineNode(nodeId).catch((err) => console.error(err));
      });
      els.timelineStrip.addEventListener("keydown", (event) => {
        const key = String(event?.key || "");
        if (key !== "Enter" && key !== " ") return;
        const card = event?.target?.closest ? event.target.closest(".timeline-card[data-node-id]") : null;
        if (!card || !els.timelineStrip.contains(card)) return;
        const nodeId = card.dataset?.nodeId;
        if (!nodeId) return;
        event.preventDefault();
        state.timelinePreviewNodeId = null;
        bumpInteraction();
        jumpToTimelineNode(nodeId).catch((err) => console.error(err));
      });
    }
  }

  return {
    timelineShelfSummaryText,
    syncTimelineShelfToggle,
    syncTimelineDockVisibility,
    setTimelineOpen,
    openTimeline,
    closeTimeline,
    toggleTimeline,
    timelineDetailText,
    syncTimelineDetailText,
    timelineCarouselAnchors,
    timelineCarouselTargetLeft,
    timelineCarouselDirectionState,
    syncTimelineCarouselOverflow,
    scheduleTimelineCarouselChromeSync,
    centerTimelineCardInStrip,
    scrollTimelineCarousel,
    suppressTimelineCardClick,
    shouldSuppressTimelineCardClick,
    resetTimelineCarouselGesture,
    beginTimelineCarouselGesture,
    updateTimelineCarouselGesture,
    finishTimelineCarouselGesture,
    handleTimelineCarouselWheel,
    buildTimelineCard,
    rebuildTimelineStrip,
    syncTimelineViewState,
    renderTimeline,
    installTimelineUi,
  };
}
