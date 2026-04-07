export function registerDiagnosticsEventHandlers(map, types, handler) {
  map.set(types.IMAGE_DESCRIPTION, handler);
  map.set(types.IMAGE_DNA_EXTRACTED, handler);
  map.set(types.IMAGE_DNA_EXTRACTED_FAILED, handler);
  map.set(types.IMAGE_SOUL_EXTRACTED, handler);
  map.set(types.IMAGE_SOUL_EXTRACTED_FAILED, handler);
  map.set(types.TRIPLET_RULE, handler);
  map.set(types.TRIPLET_RULE_FAILED, handler);
  map.set(types.TRIPLET_ODD_ONE_OUT, handler);
  map.set(types.TRIPLET_ODD_ONE_OUT_FAILED, handler);
}

export function createDiagnosticsEventHandler(deps = {}) {
  const {
    types,
    state,
    _normalizeVisionLabel,
    REALTIME_VISION_LABEL_MAX_CHARS,
    scheduleVisualPromptWrite,
    getActiveImage,
    renderHudReadout,
    consumePendingEffectExtraction,
    resolveExtractionEventImageIdByPath,
    requestRender,
    createOrUpdateEffectToken,
    suppressReelDnaToasts,
    showToast,
    basename,
    updatePortraitIdle,
    renderQuickActions,
    processActionQueue,
    clamp,
    clampText,
    setDirectorText,
    setStatus,
  } = deps;

  return async function handleDiagnosticsEvent(event) {
    const eventType = String(event?.type || "");
    if (eventType === types.IMAGE_DESCRIPTION) {
      const path = event.image_path;
      const desc = event.description;
      if (typeof path === "string" && typeof desc === "string" && desc.trim()) {
        const cleaned =
          _normalizeVisionLabel(desc, { maxChars: REALTIME_VISION_LABEL_MAX_CHARS }) || desc.trim();
        for (const item of state.images) {
          if (item?.path === path) {
            item.visionDesc = cleaned;
            item.visionPending = false;
            item.visionDescMeta = {
              source: event.source || null,
              model: event.model || null,
              at: Date.now(),
            };
            break;
          }
        }
        scheduleVisualPromptWrite();
        if (getActiveImage()?.path === path) renderHudReadout();
      }
      return;
    }
    if (eventType === types.IMAGE_DNA_EXTRACTED) {
      const path = typeof event.image_path === "string" ? event.image_path : "";
      const matchedImageId = consumePendingEffectExtraction("dna", path);
      const resolvedImageId = matchedImageId || resolveExtractionEventImageIdByPath(path);
      if (!resolvedImageId) {
        requestRender();
        return;
      }
      const item = state.imagesById.get(resolvedImageId) || null;
      if (item?.id) {
        const token = createOrUpdateEffectToken({
          type: "extract_dna",
          imageId: item.id,
          imagePath: path,
          palette: Array.isArray(event.palette) ? event.palette : [],
          colors: Array.isArray(event.colors) ? event.colors : [],
          materials: Array.isArray(event.materials) ? event.materials : [],
          summary: typeof event.summary === "string" ? event.summary : "",
          source: event.source || null,
          model: event.model || null,
        });
        if (token && !suppressReelDnaToasts()) {
          showToast(`DNA extracted: ${item.label || basename(item.path)}`, "tip", 1800);
        }
        requestRender();
      }
      return;
    }
    if (eventType === types.IMAGE_DNA_EXTRACTED_FAILED) {
      const path = typeof event.image_path === "string" ? event.image_path : "";
      const msg = event.error ? `Extract DNA failed: ${event.error}` : "Extract DNA failed.";
      showToast(msg, "error", 2600);
      if (path) consumePendingEffectExtraction("dna", path);
      else {
        state.pendingExtractDna = null;
        updatePortraitIdle();
        renderQuickActions();
        processActionQueue().catch(() => {});
      }
      return;
    }
    if (eventType === types.IMAGE_SOUL_EXTRACTED) {
      const path = typeof event.image_path === "string" ? event.image_path : "";
      const matchedImageId = consumePendingEffectExtraction("soul", path);
      const resolvedImageId = matchedImageId || resolveExtractionEventImageIdByPath(path);
      if (!resolvedImageId) {
        requestRender();
        return;
      }
      const item = state.imagesById.get(resolvedImageId) || null;
      if (item?.id) {
        const token = createOrUpdateEffectToken({
          type: "soul_leech",
          imageId: item.id,
          imagePath: path,
          emotion: typeof event.emotion === "string" ? event.emotion : "",
          summary: typeof event.summary === "string" ? event.summary : "",
          source: event.source || null,
          model: event.model || null,
        });
        if (token) {
          showToast(`Soul extracted: ${item.label || basename(item.path)}`, "tip", 1800);
        }
        requestRender();
      }
      return;
    }
    if (eventType === types.IMAGE_SOUL_EXTRACTED_FAILED) {
      const path = typeof event.image_path === "string" ? event.image_path : "";
      const msg = event.error ? `Soul Leech failed: ${event.error}` : "Soul Leech failed.";
      showToast(msg, "error", 2600);
      if (path) consumePendingEffectExtraction("soul", path);
      else {
        state.pendingSoulLeech = null;
        updatePortraitIdle();
        renderQuickActions();
        processActionQueue().catch(() => {});
      }
      return;
    }
    if (eventType === types.TRIPLET_RULE) {
      state.pendingExtractRule = null;
      const paths = Array.isArray(event.image_paths) ? event.image_paths : [];
      const principle = typeof event.principle === "string" ? event.principle.trim() : "";
      const evidence = Array.isArray(event.evidence) ? event.evidence : [];
      const textRaw = typeof event.text === "string" ? event.text.trim() : "";
      let text = textRaw;
      if (!text) {
        const lines = [];
        if (principle) {
          lines.push("RULE:");
          lines.push(principle);
        }
        if (evidence.length) {
          if (lines.length) lines.push("");
          lines.push("EVIDENCE:");
          for (const item of evidence.slice(0, 6)) {
            const img = item?.image ? String(item.image).trim() : "";
            const note = item?.note ? String(item.note).trim() : "";
            if (!note) continue;
            lines.push(`- ${img ? `${img}: ` : ""}${note}`);
          }
        }
        text = lines.join("\n").trim();
      }

      state.tripletRuleAnnotations.clear();
      state.tripletOddOneOutId = null;
      const annotations = Array.isArray(event.annotations) ? event.annotations : [];
      if (paths.length === 3 && annotations.length) {
        for (const ann of annotations) {
          const tag = String(ann?.image || "").trim().toUpperCase();
          const idx = tag === "A" ? 0 : tag === "B" ? 1 : tag === "C" ? 2 : -1;
          if (idx < 0) continue;
          const x = Number(ann?.x);
          const y = Number(ann?.y);
          if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
          const label = ann?.label ? String(ann.label).trim() : "";
          const targetPath = paths[idx];
          const imgItem = state.images.find((item) => item?.path === targetPath) || null;
          if (!imgItem?.id) continue;
          const points = state.tripletRuleAnnotations.get(imgItem.id) || [];
          points.push({ x: clamp(x, 0, 1), y: clamp(y, 0, 1), label: clampText(label, 64) });
          state.tripletRuleAnnotations.set(imgItem.id, points);
        }
      }

      if (text) {
        setDirectorText(text, {
          kind: "extract_rule",
          source: event.source || null,
          model: event.model || null,
          at: Date.now(),
          paths,
        });
      }
      setStatus("Director: rule ready");
      showToast("Extract the Rule ready.", "tip", 2400);
      updatePortraitIdle();
      renderQuickActions();
      requestRender();
      processActionQueue().catch(() => {});
      return;
    }
    if (eventType === types.TRIPLET_RULE_FAILED) {
      state.pendingExtractRule = null;
      const msg = event.error ? `Extract the Rule failed: ${event.error}` : "Extract the Rule failed.";
      setStatus(`Director: ${msg}`, true);
      showToast(msg, "error", 3200);
      updatePortraitIdle();
      renderQuickActions();
      processActionQueue().catch(() => {});
      return;
    }
    if (eventType === types.TRIPLET_ODD_ONE_OUT) {
      state.pendingOddOneOut = null;
      const paths = Array.isArray(event.image_paths) ? event.image_paths : [];
      const oddIndex = typeof event.odd_index === "number" ? event.odd_index : null;
      const oddTag = typeof event.odd_image === "string" ? event.odd_image.trim().toUpperCase() : "";
      let oddPath = null;
      if (oddIndex !== null && oddIndex >= 0 && oddIndex < paths.length) {
        oddPath = paths[oddIndex];
      } else if (paths.length === 3) {
        if (oddTag === "A") oddPath = paths[0];
        if (oddTag === "B") oddPath = paths[1];
        if (oddTag === "C") oddPath = paths[2];
      }
      const oddItem = oddPath ? state.images.find((item) => item?.path === oddPath) || null : null;
      state.tripletOddOneOutId = oddItem?.id || null;
      state.tripletRuleAnnotations.clear();

      const textRaw = typeof event.text === "string" ? event.text.trim() : "";
      let text = textRaw;
      if (!text) {
        const pattern = typeof event.pattern === "string" ? event.pattern.trim() : "";
        const why = typeof event.explanation === "string" ? event.explanation.trim() : "";
        const lines = [];
        if (oddTag || oddIndex !== null) lines.push(`ODD ONE OUT: ${oddTag || String(oddIndex + 1)}`);
        if (pattern) {
          if (lines.length) lines.push("");
          lines.push("THE SHARED PATTERN:");
          lines.push(pattern);
        }
        if (why) {
          if (lines.length) lines.push("");
          lines.push("WHY IT BREAKS:");
          lines.push(why);
        }
        text = lines.join("\n").trim();
      }

      if (text) {
        setDirectorText(text, {
          kind: "odd_one_out",
          source: event.source || null,
          model: event.model || null,
          at: Date.now(),
          paths,
        });
      }
      setStatus("Director: odd one out ready");
      showToast("Odd One Out ready.", "tip", 2400);
      updatePortraitIdle();
      renderQuickActions();
      requestRender();
      processActionQueue().catch(() => {});
      return;
    }
    if (eventType === types.TRIPLET_ODD_ONE_OUT_FAILED) {
      state.pendingOddOneOut = null;
      const msg = event.error ? `Odd One Out failed: ${event.error}` : "Odd One Out failed.";
      setStatus(`Director: ${msg}`, true);
      showToast(msg, "error", 3200);
      updatePortraitIdle();
      renderQuickActions();
      processActionQueue().catch(() => {});
    }
  };
}
