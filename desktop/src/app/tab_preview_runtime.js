export function createCanvasAppTabPreviewRuntime({
  state,
  els,
  tabbedSessions,
  createFreshTabPreviewState,
  normalizeTabPreviewState,
  getDpr,
  hideImageFxOverlays,
  shouldAnimateEffectVisuals,
  startPerfSample,
  finishPerfSample,
  requestRender,
  tabPreviewCaptureSettleMs = 120,
  tabPreviewMaxEdgePx = 1280,
  windowObj = globalThis.window,
  documentObj = globalThis.document,
  OffscreenCanvasCtor = globalThis.OffscreenCanvas,
  createImageBitmapFn = globalThis.createImageBitmap,
} = {}) {
  let tabPreviewCaptureRaf = 0;
  let tabPreviewCaptureTimer = null;
  let pendingTabPreviewCapture = null;
  let tabSwitchFullRenderRaf = 0;
  let pendingTabSwitchFullRenderSample = null;
  const tabPreviewCache = new Map();

  function disposeTabPreviewCacheEntry(entry = null) {
    if (!entry || typeof entry !== "object") return;
    if (entry.bitmap && typeof entry.bitmap.close === "function") {
      try {
        entry.bitmap.close();
      } catch {
        // ignore
      }
    }
  }

  function tabPreviewStateForTab(tabId = state.activeTabId || null) {
    const normalizedTabId = String(tabId || "").trim();
    if (!normalizedTabId) return createFreshTabPreviewState();
    if (normalizedTabId === String(state.activeTabId || "").trim()) {
      return normalizeTabPreviewState(state.tabPreviewState);
    }
    const record = tabbedSessions.getTab(normalizedTabId);
    return normalizeTabPreviewState(record?.session?.tabPreviewState);
  }

  function writeTabPreviewStateForTab(tabId = state.activeTabId || null, preview = null) {
    const normalizedTabId = String(tabId || "").trim();
    if (!normalizedTabId) return createFreshTabPreviewState();
    const next = normalizeTabPreviewState(preview);
    if (normalizedTabId === String(state.activeTabId || "").trim()) {
      state.tabPreviewState = next;
      state.tabPreviewDirty = !next.valid;
    }
    const record = tabbedSessions.getTab(normalizedTabId);
    if (record?.session && typeof record.session === "object") {
      record.session.tabPreviewState = { ...next };
    }
    return next;
  }

  function previewViewportNumber(value, decimals = 3) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return "0";
    return numeric.toFixed(decimals);
  }

  function buildTabPreviewViewportKey() {
    if (state.canvasMode === "multi") {
      return [
        "multi",
        previewViewportNumber(state.multiView?.scale, 4),
        previewViewportNumber(state.multiView?.offsetX, 1),
        previewViewportNumber(state.multiView?.offsetY, 1),
        String(state.activeId || ""),
      ].join(":");
    }
    return [
      "single",
      previewViewportNumber(state.view?.scale, 4),
      previewViewportNumber(state.view?.offsetX, 1),
      previewViewportNumber(state.view?.offsetY, 1),
      String(state.activeId || ""),
    ].join(":");
  }

  function buildTabPreviewDescriptor(tabId = state.activeTabId || null) {
    const normalizedTabId = String(tabId || "").trim();
    const work = els.workCanvas;
    const previewState = tabPreviewStateForTab(normalizedTabId);
    return {
      tabId: normalizedTabId,
      canvasWidth: Math.max(0, Number(work?.width) || 0),
      canvasHeight: Math.max(0, Number(work?.height) || 0),
      dpr: getDpr(),
      viewportKey: buildTabPreviewViewportKey(),
      visualVersion: Math.max(0, Number(previewState.version) || 0),
    };
  }

  function canUseTabPreviewEntry(entry = null, descriptor = buildTabPreviewDescriptor()) {
    if (!entry || typeof entry !== "object") return false;
    if (!descriptor || typeof descriptor !== "object") return false;
    return (
      String(entry.tabId || "") === String(descriptor.tabId || "") &&
      Math.max(0, Number(entry.canvasWidth) || 0) === Math.max(0, Number(descriptor.canvasWidth) || 0) &&
      Math.max(0, Number(entry.canvasHeight) || 0) === Math.max(0, Number(descriptor.canvasHeight) || 0) &&
      Math.abs((Number(entry.dpr) || 0) - (Number(descriptor.dpr) || 0)) < 0.001 &&
      String(entry.viewportKey || "") === String(descriptor.viewportKey || "") &&
      Math.max(0, Number(entry.visualVersion) || 0) === Math.max(0, Number(descriptor.visualVersion) || 0) &&
      Boolean(entry.bitmap || entry.canvas)
    );
  }

  function getUsableTabPreviewEntry(tabId = state.activeTabId || null) {
    const descriptor = buildTabPreviewDescriptor(tabId);
    if (!descriptor.tabId) return null;
    const entry = tabPreviewCache.get(descriptor.tabId) || null;
    return canUseTabPreviewEntry(entry, descriptor) ? entry : null;
  }

  function syncActiveTabPreviewRuntime() {
    const normalizedTabId = String(state.activeTabId || "").trim();
    if (!normalizedTabId) {
      state.tabPreviewState = createFreshTabPreviewState();
      state.tabPreviewDirty = true;
      return state.tabPreviewState;
    }
    const next = {
      ...tabPreviewStateForTab(normalizedTabId),
      valid: Boolean(getUsableTabPreviewEntry(normalizedTabId)),
    };
    return writeTabPreviewStateForTab(normalizedTabId, next);
  }

  function clearScheduledTabPreviewCapture() {
    if (tabPreviewCaptureRaf && typeof windowObj !== "undefined" && typeof windowObj?.cancelAnimationFrame === "function") {
      windowObj.cancelAnimationFrame(tabPreviewCaptureRaf);
    }
    tabPreviewCaptureRaf = 0;
    if (tabPreviewCaptureTimer) clearTimeout(tabPreviewCaptureTimer);
    tabPreviewCaptureTimer = null;
    pendingTabPreviewCapture = null;
  }

  function finishPendingTabSwitchFullRender(detail = null) {
    if (!pendingTabSwitchFullRenderSample) return 0;
    const pending = pendingTabSwitchFullRenderSample;
    pendingTabSwitchFullRenderSample = null;
    return finishPerfSample(pending.sample, "tabFullRenderAfterPreviewMs", {
      previewHit: Boolean(pending.previewHit),
      reason: pending.reason,
      renderedTabId: state.activeTabId || null,
      tabId: pending.tabId,
      ...(detail && typeof detail === "object" ? detail : null),
    });
  }

  function clearPendingTabSwitchFullRender({ stale = false } = {}) {
    if (tabSwitchFullRenderRaf && typeof windowObj !== "undefined" && typeof windowObj?.cancelAnimationFrame === "function") {
      windowObj.cancelAnimationFrame(tabSwitchFullRenderRaf);
    }
    tabSwitchFullRenderRaf = 0;
    if (pendingTabSwitchFullRenderSample && stale) {
      finishPendingTabSwitchFullRender({ stale: true });
    } else if (!stale) {
      pendingTabSwitchFullRenderSample = null;
    }
  }

  function getPendingTabSwitchFullRenderTabId() {
    return String(pendingTabSwitchFullRenderSample?.tabId || "").trim() || null;
  }

  function currentTabPreviewCaptureBlockedReason() {
    if (!String(state.activeTabId || "").trim()) return "missing_tab";
    if (state.pendingTabSwitchPreview) return "switch_preview_pending";
    if (state.pointer?.active || state.gestureZoom?.active) return "manipulating_canvas";
    if (shouldAnimateEffectVisuals()) return "animating_effects";
    const now = Date.now();
    const visibleUntil = Number(state.reelTouch?.visibleUntil) || 0;
    const downUntil = Number(state.reelTouch?.downUntil) || 0;
    if (now < visibleUntil || now < downUntil) return "touch_feedback";
    return null;
  }

  function invalidateActiveTabPreview(reason = "visual_mutation") {
    const normalizedTabId = String(state.activeTabId || "").trim();
    if (!normalizedTabId) return null;
    clearScheduledTabPreviewCapture();
    const previous = normalizeTabPreviewState(state.tabPreviewState);
    const nextVersion = state.tabPreviewDirty
      ? Math.max(0, Number(previous.version) || 0)
      : Math.max(0, Number(previous.version) || 0) + 1;
    const next = {
      version: nextVersion,
      valid: false,
    };
    writeTabPreviewStateForTab(normalizedTabId, next);
    state.tabPreviewDirty = true;
    const existing = tabPreviewCache.get(normalizedTabId) || null;
    if (existing) {
      tabPreviewCache.delete(normalizedTabId);
      disposeTabPreviewCacheEntry(existing);
    }
    return {
      reason: String(reason || "visual_mutation"),
      tabId: normalizedTabId,
      version: next.version,
    };
  }

  function createTabPreviewCaptureSurface(width, height) {
    const w = Math.max(1, Math.round(Number(width) || 1));
    const h = Math.max(1, Math.round(Number(height) || 1));
    if (typeof OffscreenCanvasCtor === "function") {
      try {
        return new OffscreenCanvasCtor(w, h);
      } catch {
        // ignore
      }
    }
    const canvas = documentObj?.createElement?.("canvas");
    if (!canvas) return null;
    canvas.width = w;
    canvas.height = h;
    return canvas;
  }

  function buildCurrentTabPreviewSurface() {
    const work = els.workCanvas;
    const overlay = els.overlayCanvas;
    if (!work || !overlay) return null;
    const canvasWidth = Math.max(0, Number(work.width) || 0);
    const canvasHeight = Math.max(0, Number(work.height) || 0);
    if (!canvasWidth || !canvasHeight) return null;
    const scale = Math.min(1, tabPreviewMaxEdgePx / Math.max(canvasWidth, canvasHeight, 1));
    const captureWidth = Math.max(1, Math.round(canvasWidth * scale));
    const captureHeight = Math.max(1, Math.round(canvasHeight * scale));
    const surface = createTabPreviewCaptureSurface(captureWidth, captureHeight);
    const ctx = surface?.getContext?.("2d", { alpha: false, desynchronized: true });
    if (!surface || !ctx) return null;
    ctx.clearRect(0, 0, captureWidth, captureHeight);
    ctx.drawImage(work, 0, 0, captureWidth, captureHeight);
    if (els.effectsCanvas?.width && els.effectsCanvas?.height) {
      ctx.drawImage(els.effectsCanvas, 0, 0, captureWidth, captureHeight);
    }
    ctx.drawImage(overlay, 0, 0, captureWidth, captureHeight);
    return {
      surface,
      captureWidth,
      captureHeight,
      canvasWidth,
      canvasHeight,
    };
  }

  async function captureActiveTabPreview({
    tabId = state.activeTabId || null,
    reason = "stable_render",
    descriptor = buildTabPreviewDescriptor(tabId),
  } = {}) {
    const normalizedTabId = String(tabId || "").trim();
    if (!normalizedTabId || normalizedTabId !== String(state.activeTabId || "").trim()) return false;
    if (currentTabPreviewCaptureBlockedReason()) return false;
    if (!descriptor.canvasWidth || !descriptor.canvasHeight) return false;
    if (Math.max(0, Number(tabPreviewStateForTab(normalizedTabId).version) || 0) !== Math.max(0, Number(descriptor.visualVersion) || 0)) {
      return false;
    }
    const surfaceState = buildCurrentTabPreviewSurface();
    if (!surfaceState) return false;
    let nextEntry = {
      tabId: normalizedTabId,
      canvasWidth: descriptor.canvasWidth,
      canvasHeight: descriptor.canvasHeight,
      dpr: descriptor.dpr,
      viewportKey: descriptor.viewportKey,
      visualVersion: descriptor.visualVersion,
      reason: String(reason || "stable_render"),
      policy: "merged-canvas-v1",
      bitmap: null,
      canvas: surfaceState.surface,
      captureWidth: surfaceState.captureWidth,
      captureHeight: surfaceState.captureHeight,
      capturedAt: Date.now(),
      kind: "canvas",
    };
    if (typeof createImageBitmapFn === "function") {
      try {
        const bitmap = await createImageBitmapFn(surfaceState.surface);
        nextEntry = {
          ...nextEntry,
          bitmap,
          canvas: null,
          kind: "bitmap",
        };
      } catch {
        // Canvas fallback is acceptable.
      }
    }
    if (Math.max(0, Number(tabPreviewStateForTab(normalizedTabId).version) || 0) !== Math.max(0, Number(descriptor.visualVersion) || 0)) {
      disposeTabPreviewCacheEntry(nextEntry);
      return false;
    }
    const previous = tabPreviewCache.get(normalizedTabId) || null;
    if (previous) disposeTabPreviewCacheEntry(previous);
    tabPreviewCache.set(normalizedTabId, nextEntry);
    writeTabPreviewStateForTab(normalizedTabId, {
      version: descriptor.visualVersion,
      valid: true,
    });
    if (normalizedTabId === String(state.activeTabId || "").trim()) {
      state.tabPreviewDirty = false;
    }
    return true;
  }

  function scheduleActiveTabPreviewCapture(reason = "stable_render") {
    const normalizedTabId = String(state.activeTabId || "").trim();
    if (!normalizedTabId || !state.tabPreviewDirty) return;
    if (currentTabPreviewCaptureBlockedReason()) return;
    const descriptor = buildTabPreviewDescriptor(normalizedTabId);
    if (!descriptor.canvasWidth || !descriptor.canvasHeight) return;
    if (
      pendingTabPreviewCapture &&
      pendingTabPreviewCapture.tabId === normalizedTabId &&
      pendingTabPreviewCapture.descriptor?.viewportKey === descriptor.viewportKey &&
      pendingTabPreviewCapture.descriptor?.visualVersion === descriptor.visualVersion
    ) {
      return;
    }
    clearScheduledTabPreviewCapture();
    pendingTabPreviewCapture = {
      tabId: normalizedTabId,
      reason: String(reason || "stable_render"),
      descriptor,
    };
    const runCapture = () => {
      const pending = pendingTabPreviewCapture;
      pendingTabPreviewCapture = null;
      if (!pending) return;
      void captureActiveTabPreview(pending).catch(() => {});
    };
    if (typeof windowObj !== "undefined" && typeof windowObj?.requestAnimationFrame === "function") {
      tabPreviewCaptureRaf = windowObj.requestAnimationFrame(() => {
        tabPreviewCaptureRaf = 0;
        tabPreviewCaptureTimer = setTimeout(() => {
          tabPreviewCaptureTimer = null;
          runCapture();
        }, tabPreviewCaptureSettleMs);
      });
      return;
    }
    tabPreviewCaptureTimer = setTimeout(() => {
      tabPreviewCaptureTimer = null;
      runCapture();
    }, tabPreviewCaptureSettleMs);
  }

  function paintTabPreviewEntry(entry = null) {
    const work = els.workCanvas;
    const overlay = els.overlayCanvas;
    if (!work || !overlay || !entry) return false;
    const wctx = work.getContext("2d");
    const octx = overlay.getContext("2d");
    if (!wctx || !octx) return false;
    const source = entry.bitmap || entry.canvas || null;
    if (!source) return false;
    wctx.clearRect(0, 0, work.width, work.height);
    if (els.effectsCanvas) {
      const fxCtx = els.effectsCanvas.getContext("2d");
      fxCtx?.clearRect(0, 0, els.effectsCanvas.width, els.effectsCanvas.height);
    }
    octx.clearRect(0, 0, overlay.width, overlay.height);
    state.motherOverlayUiHits = [];
    state.activeImageTransformUiHits = [];
    hideImageFxOverlays();
    wctx.imageSmoothingEnabled = true;
    wctx.imageSmoothingQuality = "high";
    wctx.drawImage(source, 0, 0, work.width, work.height);
    return true;
  }

  function scheduleTabSwitchFullRender(tabId, reason, { previewHit = false } = {}) {
    const normalizedTabId = String(tabId || "").trim();
    if (!normalizedTabId) return;
    clearPendingTabSwitchFullRender({ stale: true });
    const sample = startPerfSample("tab:full-render-after-preview", {
      previewHit: Boolean(previewHit),
      reason,
      tabId: normalizedTabId,
    });
    if (previewHit && typeof windowObj !== "undefined" && typeof windowObj?.requestAnimationFrame === "function") {
      tabSwitchFullRenderRaf = windowObj.requestAnimationFrame(() => {
        tabSwitchFullRenderRaf = 0;
        pendingTabSwitchFullRenderSample = {
          sample,
          tabId: normalizedTabId,
          previewHit: Boolean(previewHit),
          reason,
        };
        requestRender();
      });
      return;
    }
    pendingTabSwitchFullRenderSample = {
      sample,
      tabId: normalizedTabId,
      previewHit: Boolean(previewHit),
      reason,
    };
  }

  function renderPendingTabSwitchPreview() {
    const pending = state.pendingTabSwitchPreview;
    if (!pending || typeof pending !== "object") return false;
    const normalizedTabId = String(pending.tabId || "").trim();
    state.pendingTabSwitchPreview = null;
    const perfSample = startPerfSample("tab:preview-paint", {
      reason: pending.reason,
      tabId: normalizedTabId,
    });
    const entry = getUsableTabPreviewEntry(normalizedTabId);
    if (!entry) {
      finishPerfSample(perfSample, "tabPreviewPaintMs", {
        cacheHit: false,
        reason: pending.reason,
        tabId: normalizedTabId,
      });
      scheduleTabSwitchFullRender(normalizedTabId, pending.reason, { previewHit: false });
      return false;
    }
    const painted = paintTabPreviewEntry(entry);
    finishPerfSample(perfSample, "tabPreviewPaintMs", {
      cacheHit: Boolean(painted),
      previewKind: entry.kind,
      reason: pending.reason,
      tabId: normalizedTabId,
    });
    if (!painted) {
      scheduleTabSwitchFullRender(normalizedTabId, pending.reason, { previewHit: false });
      return false;
    }
    scheduleTabSwitchFullRender(normalizedTabId, pending.reason, { previewHit: true });
    return true;
  }

  function disposeTabPreviewForTab(tabId = state.activeTabId || null) {
    const normalizedTabId = String(tabId || "").trim();
    if (!normalizedTabId) return false;
    if (normalizedTabId === String(state.activeTabId || "").trim()) {
      clearScheduledTabPreviewCapture();
    }
    const entry = tabPreviewCache.get(normalizedTabId) || null;
    if (!entry) return false;
    tabPreviewCache.delete(normalizedTabId);
    disposeTabPreviewCacheEntry(entry);
    return true;
  }

  return {
    disposeTabPreviewCacheEntry,
    tabPreviewStateForTab,
    writeTabPreviewStateForTab,
    buildTabPreviewViewportKey,
    buildTabPreviewDescriptor,
    canUseTabPreviewEntry,
    getUsableTabPreviewEntry,
    syncActiveTabPreviewRuntime,
    clearScheduledTabPreviewCapture,
    finishPendingTabSwitchFullRender,
    clearPendingTabSwitchFullRender,
    getPendingTabSwitchFullRenderTabId,
    currentTabPreviewCaptureBlockedReason,
    invalidateActiveTabPreview,
    createTabPreviewCaptureSurface,
    buildCurrentTabPreviewSurface,
    captureActiveTabPreview,
    scheduleActiveTabPreviewCapture,
    paintTabPreviewEntry,
    scheduleTabSwitchFullRender,
    renderPendingTabSwitchPreview,
    disposeTabPreviewForTab,
  };
}
