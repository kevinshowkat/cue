export function createCanvasRenderer(options = {}) {
  const {
    state,
    els,
    documentObj = typeof document !== "undefined" ? document : null,
    requestAnimationFrameFn =
      typeof requestAnimationFrame === "function" ? requestAnimationFrame : (callback) => setTimeout(callback, 0),
    clearPendingTabSwitchFullRender = () => {},
    renderPendingTabSwitchPreview = () => false,
    syncIntentRealtimeClass = () => {},
    renderJuggernautShellChrome = () => {},
    renderCommunicationChrome = () => {},
    getActiveImage = () => null,
    renderMultiCanvas = () => {},
    canvasImageLoadingAffordance = () => null,
    readFreeformRectTransform = () => ({ rotateDeg: 0, skewXDeg: 0 }),
    ensureCanvasImageLoaded = () => {},
    readSessionRuntimeImageHandle = () => null,
    isFreeformTransformPointerDragActive = () => false,
    drawImageRectWithTransform = () => {},
    getDpr = () => 1,
    isMotherGeneratedImageItem = () => false,
    selectionChromePalette = () => ({}),
    transformedRectPolygonPoints = () => [],
    drawPolygonPath = () => false,
    intentModeActive = () => false,
    renderActiveImageTransformControls = () => {},
    singleCanvasLoadingPlaceholderPolygon = () => [],
    renderCanvasImagePlaceholder = () => {},
    syncEffectsRuntimeScene = () => {},
    updateImageFxRect = () => {},
    imageToCanvas = (point) => point,
    getCircles = () => [],
    circleImageToCanvasGeom = () => ({ cx: 0, cy: 0, r: 0 }),
    renderCanvasImageStatusPill = () => {},
    renderDesignReviewApplyShimmer = () => {},
    renderCommunicationOverlay = () => {},
    renderIntentOverlay = () => {},
    renderMotherDraftingPlaceholder = () => {},
    renderPromptGeneratePlaceholder = () => {},
    renderReelTouchIndicator = () => {},
    renderMotherRolePreview = () => {},
    finishPendingTabSwitchFullRender = () => {},
    getPendingTabSwitchFullRenderTabId = () => null,
    scheduleActiveTabPreviewCapture = () => {},
    shouldAnimateDesignReviewApplyShimmer = () => false,
    hasEffectsRuntime = () => false,
    shouldAnimateEffectVisuals = () => false,
  } = options;

  let renderScheduled = false;

  function requestRender({ allowTabSwitchPreview = false, reason = "render" } = {}) {
    if (allowTabSwitchPreview) {
      const normalizedTabId = String(state.activeTabId || "").trim();
      if (normalizedTabId) {
        clearPendingTabSwitchFullRender({ stale: true });
        state.pendingTabSwitchPreview = {
          tabId: normalizedTabId,
          reason: String(reason || "render"),
          requestedAt: Date.now(),
        };
      }
    }
    if (renderScheduled) return;
    renderScheduled = true;
    requestAnimationFrameFn(() => {
      renderScheduled = false;
      render();
    });
  }

  function render() {
    const work = els.workCanvas;
    const overlay = els.overlayCanvas;
    if (!work || !overlay) return;
    if (renderPendingTabSwitchPreview()) {
      return;
    }
    syncIntentRealtimeClass();
    renderJuggernautShellChrome();
    renderCommunicationChrome();
    const wctx = work.getContext("2d");
    const octx = overlay.getContext("2d");
    if (!wctx || !octx) return;

    wctx.clearRect(0, 0, work.width, work.height);
    octx.clearRect(0, 0, overlay.width, overlay.height);
    state.motherOverlayUiHits = [];
    state.activeImageTransformUiHits = [];

    const item = getActiveImage();
    let singleImageStatusPill = null;

    if (state.canvasMode === "multi") {
      renderMultiCanvas(wctx, octx, work.width, work.height);
    } else {
      const imageLoading = item?.path ? canvasImageLoadingAffordance(item) : null;
      const singleTransform = readFreeformRectTransform(state.freeformRects.get(String(item?.id || "")) || null);
      if (item?.path) ensureCanvasImageLoaded(item);
      const img = readSessionRuntimeImageHandle(item);
      if (img) {
        const singleW = img.naturalWidth || item?.width || 1;
        const singleH = img.naturalHeight || item?.height || 1;
        wctx.save();
        wctx.setTransform(state.view.scale, 0, 0, state.view.scale, state.view.offsetX, state.view.offsetY);
        wctx.imageSmoothingEnabled = true;
        wctx.imageSmoothingQuality = isFreeformTransformPointerDragActive() ? "medium" : "high";
        drawImageRectWithTransform(wctx, img, {
          x: 0,
          y: 0,
          w: singleW,
          h: singleH,
          rotateDeg: singleTransform.rotateDeg,
          skewXDeg: singleTransform.skewXDeg,
        });
        wctx.restore();

        const dpr = getDpr();
        const motherGenerated = isMotherGeneratedImageItem(item);
        const palette = selectionChromePalette({ motherGenerated });
        const outerStroke = palette.outerStroke;
        const mainStroke = palette.mainStroke;
        const mainShadow = palette.mainShadow;
        const innerStroke = palette.innerStroke;
        const singleDragPerfMode =
          isFreeformTransformPointerDragActive() && String(state.pointer?.imageId || "") === String(item?.id || "");
        const singleOuterLineWidth = singleDragPerfMode ? Math.max(1, Math.round(6 * dpr)) : Math.max(1, Math.round(10 * dpr));
        const singleOuterShadowBlur = singleDragPerfMode ? Math.round(20 * dpr) : Math.round(44 * dpr);
        const singleMainShadowBlur = singleDragPerfMode ? Math.round(14 * dpr) : Math.round(28 * dpr);
        const ix = state.view.offsetX;
        const iy = state.view.offsetY;
        const iw = (img.naturalWidth || item.width || 1) * state.view.scale;
        const ih = (img.naturalHeight || item.height || 1) * state.view.scale;
        const singleBorderPoints = transformedRectPolygonPoints({
          x: ix,
          y: iy,
          w: iw,
          h: ih,
          rotateDeg: singleTransform.rotateDeg,
          skewXDeg: singleTransform.skewXDeg,
        });
        if (imageLoading?.statusLabel) {
          singleImageStatusPill = {
            polygon: singleBorderPoints,
            affordance: imageLoading,
          };
        }

        octx.save();
        octx.lineJoin = "round";
        octx.strokeStyle = outerStroke;
        octx.lineWidth = singleOuterLineWidth;
        octx.shadowColor = mainShadow;
        octx.shadowBlur = singleOuterShadowBlur;
        if (drawPolygonPath(octx, singleBorderPoints)) octx.stroke();

        octx.strokeStyle = mainStroke;
        octx.lineWidth = Math.max(1, Math.round(3.4 * dpr));
        octx.shadowColor = mainShadow;
        octx.shadowBlur = singleMainShadowBlur;
        if (drawPolygonPath(octx, singleBorderPoints)) octx.stroke();

        octx.shadowBlur = 0;
        octx.strokeStyle = innerStroke;
        octx.lineWidth = Math.max(1, Math.round(1.2 * dpr));
        if (drawPolygonPath(octx, singleBorderPoints)) octx.stroke();
        octx.restore();
        if (state.tool === "pan" || intentModeActive()) {
          renderActiveImageTransformControls(octx, {
            anchorRect: { x: ix, y: iy, w: iw, h: ih },
            anchorPoints: singleBorderPoints,
            dpr,
            accent: palette.handleStroke,
            targetId: item.id,
          });
        }
      } else if (item?.path && imageLoading?.showPlaceholder) {
        const placeholderPoints = singleCanvasLoadingPlaceholderPolygon(item, work, singleTransform);
        renderCanvasImagePlaceholder(wctx, placeholderPoints);
        singleImageStatusPill = {
          polygon: placeholderPoints,
          affordance: imageLoading,
        };
      }
    }
    syncEffectsRuntimeScene();
    updateImageFxRect();

    const pts = state.selection?.points || state.lassoDraft;
    if (pts && pts.length >= 2) {
      octx.save();
      octx.lineWidth = Math.max(1, Math.round(2 * getDpr()));
      octx.strokeStyle = "rgba(255, 179, 0, 0.95)";
      octx.fillStyle = "rgba(255, 179, 0, 0.12)";
      octx.beginPath();
      const c0 = imageToCanvas(pts[0]);
      octx.moveTo(c0.x, c0.y);
      for (let index = 1; index < pts.length; index += 1) {
        const c = imageToCanvas(pts[index]);
        octx.lineTo(c.x, c.y);
      }
      if (state.selection && state.selection.closed) {
        octx.closePath();
        octx.fill();
      }
      octx.stroke();
      octx.restore();
    }

    const annotateBox = state.annotateDraft || state.annotateBox;
    if (annotateBox && item?.id && annotateBox.imageId === item.id) {
      const dpr = getDpr();
      const a = imageToCanvas({ x: Number(annotateBox.x0) || 0, y: Number(annotateBox.y0) || 0 });
      const b = imageToCanvas({ x: Number(annotateBox.x1) || 0, y: Number(annotateBox.y1) || 0 });
      const x = Math.min(a.x, b.x);
      const y = Math.min(a.y, b.y);
      const w = Math.max(1, Math.abs(a.x - b.x));
      const h = Math.max(1, Math.abs(a.y - b.y));
      octx.save();
      octx.lineWidth = Math.max(1, Math.round(2 * dpr));
      octx.strokeStyle = "rgba(82, 255, 148, 0.92)";
      octx.fillStyle = "rgba(82, 255, 148, 0.10)";
      if (state.annotateDraft) {
        octx.setLineDash([Math.round(8 * dpr), Math.round(6 * dpr)]);
      }
      octx.fillRect(x, y, w, h);
      octx.strokeRect(x, y, w, h);
      octx.setLineDash([]);
      octx.restore();
    }

    if (item?.id) {
      const dpr = getDpr();
      const circles = getCircles(item.id);
      const draft = state.circleDraft && state.circleDraft.imageId === item.id ? state.circleDraft : null;
      const activeCircleId = state.activeCircle?.imageId === item.id ? state.activeCircle.id : null;

      const drawCircle = (circle, { isDraft = false } = {}) => {
        if (!circle) return;
        const geom = circleImageToCanvasGeom(circle);
        if (!geom.r || geom.r < 1) return;
        const color = circle.color || "rgba(255, 95, 95, 0.92)";
        const fill = "rgba(255, 95, 95, 0.08)";
        const isActive = !isDraft && activeCircleId && circle.id === activeCircleId;

        octx.save();
        octx.lineWidth = Math.max(1, Math.round((isActive ? 2.8 : 2) * dpr));
        octx.strokeStyle = color;
        octx.fillStyle = fill;
        if (isActive) {
          octx.shadowColor = "rgba(255, 95, 95, 0.22)";
          octx.shadowBlur = Math.round(16 * dpr);
        }
        if (isDraft) {
          octx.setLineDash([Math.round(10 * dpr), Math.round(8 * dpr)]);
        }
        octx.beginPath();
        octx.arc(geom.cx, geom.cy, geom.r, 0, Math.PI * 2);
        octx.stroke();
        if (!isDraft) octx.fill();
        octx.setLineDash([]);

        const label = String(circle.label || "").trim();
        if (label) {
          octx.shadowBlur = 0;
          octx.font = `${Math.max(10, Math.round(11 * dpr))}px IBM Plex Mono`;
          octx.textBaseline = "middle";
          octx.fillStyle = color;
          const x = geom.cx + geom.r + Math.round(10 * dpr);
          const y = geom.cy;
          octx.globalAlpha = 0.85;
          octx.fillStyle = "rgba(0, 0, 0, 0.62)";
          octx.fillText(label, x + Math.round(1 * dpr), y + Math.round(1 * dpr));
          octx.globalAlpha = 1;
          octx.fillStyle = color;
          octx.fillText(label, x, y);
        }
        octx.restore();
      };

      for (const circle of circles.slice(-24)) {
        drawCircle(circle, { isDraft: false });
      }
      if (draft) {
        drawCircle(draft, { isDraft: true });
      }
    }

    if (singleImageStatusPill?.affordance?.statusLabel) {
      renderCanvasImageStatusPill(octx, singleImageStatusPill.polygon, singleImageStatusPill.affordance);
    }

    renderDesignReviewApplyShimmer(octx);
    renderCommunicationOverlay(octx);
    renderIntentOverlay(octx, work.width, work.height);
    renderMotherDraftingPlaceholder(octx, work.width, work.height);
    renderPromptGeneratePlaceholder(octx, work.width, work.height);
    renderReelTouchIndicator(octx, work.width, work.height);
    renderMotherRolePreview();
    finishPendingTabSwitchFullRender({
      stale:
        String(state.activeTabId || "").trim() !==
        String(getPendingTabSwitchFullRenderTabId() || "").trim(),
    });
    scheduleActiveTabPreviewCapture("render_complete");
    if (
      !documentObj?.hidden &&
      (shouldAnimateDesignReviewApplyShimmer() || (!hasEffectsRuntime() && shouldAnimateEffectVisuals()))
    ) {
      requestRender();
    }
  }

  return {
    requestRender,
    render,
  };
}
