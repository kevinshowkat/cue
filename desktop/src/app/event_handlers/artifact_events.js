export function registerArtifactEventHandlers(map, types, handler) {
  map.set(types.ARTIFACT_CREATED, handler);
  map.set(types.GENERATION_FAILED, handler);
}

export function createArtifactEventHandler(deps = {}) {
  const {
    types,
    state,
    MOTHER_IDLE_STATES,
    MOTHER_V2_SINGLE_RESULT_GUARD_WINDOW_MS,
    topMetricIngestRenderDuration,
    ingestTopMetricsFromReceiptPath,
    renderSessionApiCallsReadout,
    handleCreateLayersArtifact,
    finishCreateLayersFailure,
    maybeEmitFirstAbilitySuccess,
    appendMotherTraceLog,
    removeFile,
    motherEventVersionId,
    promptBenchmarkMarkSuccessFromArtifactEvent,
    motherV2DispatchInFlight,
    motherIdleDispatchVersionMatches,
    motherIdleRememberIgnoredVersion,
    appendMotherSuggestionLog,
    motherIdleHandleSuggestionArtifact,
    restoreEngineImageModelIfNeeded,
    setStatus,
    updatePortraitIdle,
    setImageFxActive,
    renderMotherReadout,
    renderQuickActions,
    renderHudReadout,
    processActionQueue,
    motherIdleIsIgnoredVersion,
    getActiveImage,
    setTip,
    showToast,
    clearPendingReplace,
    compositeAnnotateBoxEdit,
    replaceImageInPlace,
    recordTimelineNode,
    basename,
    consumeEffectToken,
    clearEffectTokenForImageId,
    removeImageFromCanvas,
    requestRender,
    recoverEffectTokenApply,
    seedPromptGeneratePlacementRectCss,
    addImage,
    promptBenchmarkMarkFailureFromGenerationFailedEvent,
    motherIdleHandleGenerationFailed,
    clearMotherIdleDispatchTimeout,
    motherIdlePickRetryModel,
    motherPreferredGenerationModel,
    motherIdleResetDispatchCorrelation,
    motherIdleDispatchGeneration,
    maybeEmitFirstAbilityFail,
    telemetryClassifyErrorCode,
    resetActionQueue,
    chooseSpawnNodes,
  } = deps;

  return async function handleArtifactEvent(event) {
    const eventType = String(event?.type || "");
    if (eventType === types.ARTIFACT_CREATED) {
      const id = event.artifact_id;
      const path = event.image_path;
      if (!id || !path) return;
      const eventMetrics = event.metrics && typeof event.metrics === "object" ? event.metrics : null;
      if (eventMetrics) {
        topMetricIngestRenderDuration(eventMetrics.latency_per_image_s);
      }
      if (event.receipt_path) {
        ingestTopMetricsFromReceiptPath(event.receipt_path, {
          allowCostFallback: false,
          allowLatencyFallback: !eventMetrics,
        }).catch(() => {});
      }
      renderSessionApiCallsReadout();
      if (state.pendingCreateLayers) {
        const handledCreateLayers = await handleCreateLayersArtifact(event).catch((err) => {
          console.error(err);
          finishCreateLayersFailure(`Create Layers failed (${err?.message || err}).`);
          return true;
        });
        if (handledCreateLayers) {
          maybeEmitFirstAbilitySuccess({
            source: "artifact_created",
            route: "create_layers",
            action: String(state.lastAction || "unknown"),
          });
          return;
        }
      }
      const idleForCancel = state.motherIdle;
      const noForegroundPendingForCancel =
        !state.pendingReplace &&
        !state.pendingBlend &&
        !state.pendingSwapDna &&
        !state.pendingBridge &&
        !state.pendingCreateLayers &&
        !state.pendingExtractDna &&
        !state.pendingSoulLeech &&
        !state.pendingExtractRule &&
        !state.pendingOddOneOut &&
        !state.pendingTriforce &&
        !state.pendingRecast &&
        !state.pendingPromptGenerate &&
        !state.pendingRecreate;
      if (
        idleForCancel &&
        Date.now() < (Number(idleForCancel.cancelArtifactUntil) || 0) &&
        noForegroundPendingForCancel &&
        String(state.lastAction || "") === "Mother Suggestion"
      ) {
        appendMotherTraceLog({
          kind: "discard_artifact_after_cancel",
          traceId: idleForCancel.telemetry?.traceId || null,
          actionVersion: Number(idleForCancel.actionVersion) || 0,
          image_id: String(id),
          image_path: String(path),
          reason: idleForCancel.cancelArtifactReason || "cancel",
        }).catch(() => {});
        removeFile(path).catch(() => {});
        if (event.receipt_path) removeFile(event.receipt_path).catch(() => {});
        return;
      }
      const eventVersionId = motherEventVersionId(event);
      if (eventVersionId) {
        promptBenchmarkMarkSuccessFromArtifactEvent(event);
      }
      const motherDispatchInFlight =
        motherV2DispatchInFlight(state.motherIdle) &&
        !state.pendingReplace &&
        !state.pendingBlend &&
        !state.pendingSwapDna &&
        !state.pendingBridge &&
        !state.pendingCreateLayers &&
        !state.pendingExtractDna &&
        !state.pendingSoulLeech &&
        !state.pendingExtractRule &&
        !state.pendingOddOneOut &&
        !state.pendingTriforce &&
        !state.pendingRecast &&
        !state.pendingPromptGenerate &&
        !state.pendingRecreate;
      if (motherDispatchInFlight && !motherIdleDispatchVersionMatches(eventVersionId)) {
        if (eventVersionId) motherIdleRememberIgnoredVersion(eventVersionId);
        appendMotherSuggestionLog({
          stage: "out_of_band_result_ignored",
          request_id: state.motherIdle?.pendingSuggestionLog?.request_id || null,
          expected_version_id: state.motherIdle?.pendingVersionId || null,
          ignored_version_id: eventVersionId,
          ignored_image_id: String(id),
          ignored_image_path: String(path),
          ignored_receipt_path: event.receipt_path ? String(event.receipt_path) : null,
        }).catch(() => {});
        console.warn("[mother_suggestion] ignored out-of-band artifact during active dispatch", {
          expected_version_id: state.motherIdle?.pendingVersionId || null,
          ignored_version_id: eventVersionId,
          ignored_image_id: String(id),
        });
        removeFile(path).catch(() => {});
        if (event.receipt_path) removeFile(event.receipt_path).catch(() => {});
        return;
      }
      if (motherDispatchInFlight) {
        const handled = await motherIdleHandleSuggestionArtifact({
          id,
          path,
          receiptPath: event.receipt_path || null,
          versionId: eventVersionId,
        }).catch((err) => {
          console.error(err);
          return false;
        });
        if (handled) {
          maybeEmitFirstAbilitySuccess({
            source: "artifact_created",
            route: "mother_suggestion",
            action: String(state.lastAction || "Mother Suggestion"),
          });
          state.expectingArtifacts = false;
          restoreEngineImageModelIfNeeded();
          setStatus("Engine: ready");
          updatePortraitIdle();
          setImageFxActive(false);
          renderMotherReadout();
          renderQuickActions();
          renderHudReadout();
          processActionQueue().catch(() => {});
          return;
        }
      }
      if (eventVersionId && motherIdleIsIgnoredVersion(eventVersionId)) {
        appendMotherSuggestionLog({
          stage: "late_result_ignored",
          ignored_version_id: eventVersionId,
          ignored_image_id: String(id),
          ignored_image_path: String(path),
          ignored_receipt_path: event.receipt_path ? String(event.receipt_path) : null,
        }).catch(() => {});
        console.warn("[mother_suggestion] ignored late artifact from blocked version", {
          ignored_version_id: eventVersionId,
          ignored_image_id: String(id),
        });
        removeFile(path).catch(() => {});
        if (event.receipt_path) removeFile(event.receipt_path).catch(() => {});
        return;
      }
      const motherIdle = state.motherIdle || null;
      const noForegroundPending =
        !state.pendingReplace &&
        !state.pendingBlend &&
        !state.pendingSwapDna &&
        !state.pendingBridge &&
        !state.pendingCreateLayers &&
        !state.pendingExtractDna &&
        !state.pendingSoulLeech &&
        !state.pendingExtractRule &&
        !state.pendingOddOneOut &&
        !state.pendingTriforce &&
        !state.pendingRecast &&
        !state.pendingPromptGenerate &&
        !state.pendingRecreate;
      const motherSingleSuggestionGuard =
        !motherDispatchInFlight &&
        motherIdle?.phase === MOTHER_IDLE_STATES.WAITING_FOR_USER &&
        Boolean(motherIdle?.generatedImageId) &&
        Boolean(motherIdle?.hasGeneratedSinceInteraction) &&
        noForegroundPending &&
        String(state.lastAction || "") === "Mother Suggestion" &&
        Date.now() <= (Number(motherIdle?.lastSuggestionAt) || 0) + MOTHER_V2_SINGLE_RESULT_GUARD_WINDOW_MS;
      if (motherSingleSuggestionGuard && String(id) !== String(motherIdle.generatedImageId)) {
        appendMotherSuggestionLog({
          stage: "extra_result_ignored",
          retained_image_id: String(motherIdle.generatedImageId || ""),
          ignored_image_id: String(id),
          ignored_image_path: String(path),
          ignored_receipt_path: event.receipt_path ? String(event.receipt_path) : null,
        }).catch(() => {});
        console.info("[mother_suggestion] ignored extra artifact", {
          retained_image_id: String(motherIdle.generatedImageId || ""),
          ignored_image_id: String(id),
        });
        removeFile(path).catch(() => {});
        if (event.receipt_path) removeFile(event.receipt_path).catch(() => {});
        state.expectingArtifacts = false;
        restoreEngineImageModelIfNeeded();
        setStatus("Engine: ready");
        updatePortraitIdle();
        setImageFxActive(false);
        renderQuickActions();
        renderHudReadout();
        processActionQueue().catch(() => {});
        return;
      }
      const blend = state.pendingBlend;
      const swapDna = state.pendingSwapDna;
      const bridge = state.pendingBridge;
      const triforce = state.pendingTriforce;
      const recast = state.pendingRecast;
      const promptGenerate = state.pendingPromptGenerate;
      const recreate = state.pendingRecreate;
      const pending = state.pendingReplace;

      const wasBlend = Boolean(blend);
      const wasSwapDna = Boolean(swapDna);
      const wasBridge = Boolean(bridge);
      const wasTriforce = Boolean(triforce);
      const wasRecast = Boolean(recast);
      const wasPromptGenerate = Boolean(promptGenerate);
      const wasRecreate = Boolean(recreate);
      const wasMultiGenAction = wasBlend || wasSwapDna || wasBridge || wasTriforce;

      let timelineAction = state.lastAction || null;
      let timelineParents = [];
      if (blend?.sourceIds?.length) {
        timelineAction = "Combine";
        timelineParents = blend.sourceIds.map((src) => state.imagesById.get(src)?.timelineNodeId).filter(Boolean);
      } else if (swapDna?.structureId && swapDna?.surfaceId) {
        timelineAction = "Swap DNA";
        timelineParents = [swapDna.structureId, swapDna.surfaceId]
          .map((src) => state.imagesById.get(src)?.timelineNodeId)
          .filter(Boolean);
      } else if (bridge?.sourceIds?.length) {
        timelineAction = "Bridge";
        timelineParents = bridge.sourceIds.map((src) => state.imagesById.get(src)?.timelineNodeId).filter(Boolean);
      } else if (triforce?.sourceIds?.length) {
        timelineAction = "Triforce";
        timelineParents = triforce.sourceIds.map((src) => state.imagesById.get(src)?.timelineNodeId).filter(Boolean);
      } else if (recast?.sourceId) {
        timelineAction = "Recast";
        const parent = state.imagesById.get(recast.sourceId)?.timelineNodeId || null;
        timelineParents = parent ? [parent] : [];
      } else if (wasPromptGenerate) {
        timelineAction = "Prompt Generate";
        timelineParents = [];
      } else {
        const activeParent = getActiveImage()?.timelineNodeId || null;
        timelineParents = activeParent ? [activeParent] : [];
      }
      if (wasBlend) {
        state.pendingBlend = null;
        setTip("Combine complete. Output selected.");
        showToast("Combine complete.", "tip", 2400);
      }
      if (wasSwapDna) {
        state.pendingSwapDna = null;
        setTip("Swap DNA complete. Output selected.");
        showToast("Swap DNA complete.", "tip", 2400);
      }
      if (wasBridge) {
        state.pendingBridge = null;
        setTip("Bridge complete. Output selected.");
        showToast("Bridge complete.", "tip", 2400);
      }
      if (wasTriforce) {
        state.pendingTriforce = null;
        setTip("Triforce complete. Output selected.");
        showToast("Triforce complete.", "tip", 2400);
      }
      if (wasRecast) {
        state.pendingRecast = null;
        setTip("Recast complete. Output selected.");
        showToast("Recast complete.", "tip", 2400);
      }
      if (wasPromptGenerate) {
        state.pendingPromptGenerate = null;
        setTip("Prompt Generate complete. Output selected.");
        showToast("Prompt Generate complete.", "tip", 2400);
      }
      if (pending?.targetId) {
        const targetId = pending.targetId;
        const mode = pending.mode ? String(pending.mode) : "";
        const box = pending.box || null;
        const instruction = pending.instruction || null;
        const actionLabel = pending.label || timelineAction || "Edit";
        const parentNodeId = state.imagesById.get(targetId)?.timelineNodeId || null;
        const effectTokenId = mode === "effect_token_apply" ? String(pending.effect_token_id || "").trim() : "";
        clearPendingReplace();
        if (mode === "annotate_box") {
          const cropPath = pending.cropPath || null;
          const ok = await compositeAnnotateBoxEdit(targetId, path, { box, instruction }).catch((err) => {
            console.error(err);
            return false;
          });
          if (cropPath) {
            removeFile(cropPath).catch(() => {});
          }
          if (ok) {
            removeFile(path).catch(() => {});
            if (event.receipt_path) removeFile(event.receipt_path).catch(() => {});
          }
          if (!ok) {
            showToast("Annotate failed to apply the box edit.", "error", 3600);
          }
        } else {
          const ok = await replaceImageInPlace(targetId, {
            path,
            receiptPath: event.receipt_path || null,
            kind: "engine",
          }).catch((err) => {
            console.error(err);
            return false;
          });
          if (ok) {
            const nodeId = recordTimelineNode({
              imageId: targetId,
              path,
              receiptPath: event.receipt_path || null,
              label: basename(path),
              action: actionLabel,
              kind: "image_result",
              visualMode: "thumbnail",
              parents: parentNodeId ? [parentNodeId] : [],
              previewImageId: targetId,
              previewPath: path,
              receiptPaths: event.receipt_path ? [event.receipt_path] : [],
            });
            const item = state.imagesById.get(targetId) || null;
            if (item && nodeId) item.timelineNodeId = nodeId;
            if (effectTokenId) {
              const token = state.effectTokensById.get(effectTokenId) || null;
              const sourceImageId = String(token?.sourceImageId || pending.source_image_id || "").trim();
              if (token) {
                consumeEffectToken(token);
                clearEffectTokenForImageId(sourceImageId);
              } else if (sourceImageId) {
                clearEffectTokenForImageId(sourceImageId);
              }
              if (sourceImageId && sourceImageId !== targetId) {
                await removeImageFromCanvas(sourceImageId).catch(() => {});
              }
              state.effectTokenApplyLocks.delete(effectTokenId);
              showToast("Effect consumed.", "tip", 1800);
              requestRender();
            }
          } else if (effectTokenId) {
            const token = state.effectTokensById.get(effectTokenId) || null;
            state.effectTokenApplyLocks.delete(effectTokenId);
            if (token) recoverEffectTokenApply(token);
            requestRender();
          }
        }
      } else {
        if (wasPromptGenerate) {
          seedPromptGeneratePlacementRectCss(id, promptGenerate);
        }
        addImage(
          {
            id,
            kind: "engine",
            path,
            receiptPath: event.receipt_path || null,
            label: basename(path),
            timelineAction,
            timelineParents,
          },
          { select: state.expectingArtifacts || !state.activeId }
        );
      }

      if (wasMultiGenAction) {
        const sourceIds = [];
        if (blend?.sourceIds?.length) sourceIds.push(...blend.sourceIds);
        if (swapDna?.structureId) sourceIds.push(swapDna.structureId);
        if (swapDna?.surfaceId) sourceIds.push(swapDna.surfaceId);
        if (bridge?.sourceIds?.length) sourceIds.push(...bridge.sourceIds);
        if (triforce?.sourceIds?.length) sourceIds.push(...triforce.sourceIds);

        const outputId = String(id);
        for (const srcId of Array.from(new Set(sourceIds.map((value) => String(value || "").trim())))) {
          if (!srcId || srcId === outputId) continue;
          await removeImageFromCanvas(srcId).catch(() => {});
        }
      }

      if (wasRecast) {
        const outputId = String(id);
        const removeIds = Array.from(new Set((state.images || []).map((item) => String(item?.id || "")).filter(Boolean)))
          .filter((imageId) => imageId !== outputId);
        for (const imageId of removeIds) {
          await removeImageFromCanvas(imageId).catch(() => {});
        }
      }

      if (wasRecreate) {
        const outputId = String(id);
        const removeIds = Array.from(new Set((state.images || []).map((item) => String(item?.id || "")).filter(Boolean)))
          .filter((imageId) => imageId !== outputId);
        for (const imageId of removeIds) {
          await removeImageFromCanvas(imageId).catch(() => {});
        }
      }
      maybeEmitFirstAbilitySuccess({
        source: "artifact_created",
        route: pending?.targetId ? "replace" : "add_image",
        action: String(timelineAction || state.lastAction || "unknown"),
      });
      state.expectingArtifacts = false;
      restoreEngineImageModelIfNeeded();
      setStatus("Engine: ready");
      updatePortraitIdle();
      setImageFxActive(false);
      renderQuickActions();
      renderHudReadout();
      processActionQueue().catch(() => {});
      return;
    }

    if (eventType === types.GENERATION_FAILED) {
      promptBenchmarkMarkFailureFromGenerationFailedEvent(event);
      const idleDrafting = state.motherIdle?.phase === MOTHER_IDLE_STATES.DRAFTING;
      const idleDispatching = motherV2DispatchInFlight(state.motherIdle);
      if (idleDrafting && idleDispatching) {
        const msg = event.error ? `Mother draft failed: ${event.error}` : "Mother draft failed.";
        setStatus(`Engine: ${msg}`, true);
        motherIdleHandleGenerationFailed(msg);
        renderQuickActions();
        renderHudReadout();
        processActionQueue().catch(() => {});
        return;
      }
      const eventVersionId = motherEventVersionId(event);
      const wasMotherDispatch = motherV2DispatchInFlight(state.motherIdle);
      const hiddenSpeculativeDispatch = Boolean(
        wasMotherDispatch &&
          state.motherIdle?.phase === MOTHER_IDLE_STATES.INTENT_HYPOTHESIZING &&
          state.motherIdle?.pendingDispatchSpeculative
      );
      if (wasMotherDispatch) {
        if (!motherIdleDispatchVersionMatches(eventVersionId)) {
          if (eventVersionId) motherIdleRememberIgnoredVersion(eventVersionId);
          appendMotherSuggestionLog({
            stage: "out_of_band_failed_ignored",
            request_id: state.motherIdle?.pendingSuggestionLog?.request_id || null,
            expected_version_id: state.motherIdle?.pendingVersionId || null,
            ignored_version_id: eventVersionId,
            error: event.error ? String(event.error) : null,
          }).catch(() => {});
          console.warn("[mother_suggestion] ignored out-of-band failure during active dispatch", {
            expected_version_id: state.motherIdle?.pendingVersionId || null,
            ignored_version_id: eventVersionId,
            error: event.error ? String(event.error) : null,
          });
          return;
        }
        if (hiddenSpeculativeDispatch) {
          const msg = event.error
            ? `Mother speculative prefetch failed: ${event.error}`
            : "Mother speculative prefetch failed.";
          motherIdleHandleGenerationFailed(msg, { speculative: true });
          renderMotherReadout();
          requestRender();
          return;
        }
        clearMotherIdleDispatchTimeout();
        const idle = state.motherIdle;
        const retryModel =
          idle && !idle.retryAttempted
            ? motherIdlePickRetryModel(
                idle.lastDispatchModel || idle.pendingSuggestionLog?.model || motherPreferredGenerationModel()
              )
            : null;
        if (idle && retryModel) {
          const failedVersionId = idle.pendingVersionId || eventVersionId || null;
          idle.retryAttempted = true;
          idle.pendingDispatchToken = 0;
          idle.pendingDispatchSpeculative = false;
          idle.pendingDispatchProposalMode = null;
          idle.pendingPromptCompileSpeculative = false;
          idle.dispatchTimeoutExtensions = 0;
          motherIdleResetDispatchCorrelation({ rememberPendingVersion: true });
          state.expectingArtifacts = false;
          restoreEngineImageModelIfNeeded();
          appendMotherSuggestionLog({
            stage: "retry_scheduled",
            request_id: idle.pendingSuggestionLog?.request_id || null,
            from_model: idle.lastDispatchModel || idle.pendingSuggestionLog?.model || null,
            to_model: retryModel,
            version_id: failedVersionId,
            error: event.error ? String(event.error) : null,
          }).catch(() => {});
          setStatus(`Engine: Mother retrying with ${retryModel}…`);
          const retried = await motherIdleDispatchGeneration().catch(() => false);
          if (retried) {
            renderQuickActions();
            renderHudReadout();
            processActionQueue().catch(() => {});
            return;
          }
        }
        const msg = event.error ? `Mother suggestion failed: ${event.error}` : "Mother suggestion failed.";
        maybeEmitFirstAbilityFail({
          source: "generation_failed",
          route: "mother_suggestion",
          error_code: telemetryClassifyErrorCode(event.error || msg),
        });
        setStatus(`Engine: ${msg}`, true);
        state.expectingArtifacts = false;
        restoreEngineImageModelIfNeeded();
        updatePortraitIdle();
        setImageFxActive(false);
        motherIdleHandleGenerationFailed(msg);
        renderQuickActions();
        renderHudReadout();
        processActionQueue().catch(() => {});
        return;
      }
      const motherIdle = state.motherIdle || null;
      if (eventVersionId && motherIdleIsIgnoredVersion(eventVersionId)) {
        appendMotherSuggestionLog({
          stage: "late_failed_ignored",
          ignored_version_id: eventVersionId,
          error: event.error ? String(event.error) : null,
          phase: motherIdle?.phase || null,
        }).catch(() => {});
        console.warn("[mother_suggestion] ignored late failure from blocked version", {
          ignored_version_id: eventVersionId,
          phase: motherIdle?.phase || null,
          error: event.error ? String(event.error) : null,
        });
        return;
      }
      if (state.pendingCreateLayers) {
        const pending = state.pendingCreateLayers;
        const idx = Math.max(0, Number(pending?.nextIndex) || 0);
        const specs = Array.isArray(pending?.layerSpecs) ? pending.layerSpecs : [];
        const spec = specs[idx] || null;
        const stageLabel = spec?.summary ? String(spec.summary) : `layer ${idx + 1}`;
        const msg = event.error
          ? `Create Layers failed while generating ${stageLabel}: ${event.error}`
          : `Create Layers failed while generating ${stageLabel}.`;
        maybeEmitFirstAbilityFail({
          source: "generation_failed",
          route: "create_layers",
          error_code: telemetryClassifyErrorCode(event.error || msg),
        });
        finishCreateLayersFailure(msg);
        return;
      }
      const errText = String(event.error || "").trim();
      const errLower = errText.toLowerCase();
      const anyForegroundPending =
        Boolean(state.pendingReplace) ||
        Boolean(state.pendingBlend) ||
        Boolean(state.pendingSwapDna) ||
        Boolean(state.pendingBridge) ||
        Boolean(state.pendingCreateLayers) ||
        Boolean(state.pendingExtractDna) ||
        Boolean(state.pendingSoulLeech) ||
        Boolean(state.pendingTriforce) ||
        Boolean(state.pendingRecast) ||
        Boolean(state.pendingExtractRule) ||
        Boolean(state.pendingOddOneOut) ||
        Boolean(state.pendingRecreate) ||
        Boolean(state.pendingPromptGenerate) ||
        Boolean(state.pendingGeneration?.remaining);
      const motherRecentSuccess =
        !wasMotherDispatch &&
        Boolean(motherIdle?.generatedImageId) &&
        !state.expectingArtifacts &&
        !anyForegroundPending &&
        String(state.lastAction || "") === "Mother Suggestion" &&
        Date.now() <= (Number(motherIdle?.suppressFailureUntil) || 0);
      const looksLikeNoImageError = /no images?|failed to return|no artifacts?|no output/i.test(errLower);
      if (motherRecentSuccess && looksLikeNoImageError) {
        appendMotherSuggestionLog({
          stage: "spurious_failed_after_success",
          image_id: String(motherIdle.generatedImageId || ""),
          error: errText || null,
          phase: motherIdle?.phase || null,
          last_action: state.lastAction || null,
        }).catch(() => {});
        console.warn("[mother_suggestion] ignored spurious failure after successful artifact", {
          image_id: String(motherIdle.generatedImageId || ""),
          phase: motherIdle?.phase || null,
          error: errText || null,
        });
        state.expectingArtifacts = false;
        restoreEngineImageModelIfNeeded();
        setStatus("Engine: ready");
        updatePortraitIdle();
        setImageFxActive(false);
        renderQuickActions();
        renderHudReadout();
        processActionQueue().catch(() => {});
        return;
      }
      const msg = event.error ? `Generation failed: ${event.error}` : "Generation failed.";
      maybeEmitFirstAbilityFail({
        source: "generation_failed",
        route: "general",
        error_code: telemetryClassifyErrorCode(event.error || msg),
      });
      setStatus(`Engine: ${msg}`, true);
      showToast(msg, "error", 3200);
      state.expectingArtifacts = false;
      state.pendingRecreate = null;
      state.pendingBlend = null;
      state.pendingSwapDna = null;
      state.pendingBridge = null;
      state.pendingExtractDna = null;
      state.pendingSoulLeech = null;
      state.pendingTriforce = null;
      state.pendingRecast = null;
      state.pendingCreateLayers = null;
      state.pendingPromptGenerate = null;
      state.pendingExtractRule = null;
      state.pendingOddOneOut = null;
      state.tripletRuleAnnotations.clear();
      state.tripletOddOneOutId = null;
      resetActionQueue();
      clearPendingReplace();
      for (const [tokenId] of state.effectTokenApplyLocks.entries()) {
        const token = state.effectTokensById.get(tokenId) || null;
        if (token) recoverEffectTokenApply(token);
      }
      state.effectTokenApplyLocks.clear();
      restoreEngineImageModelIfNeeded();
      updatePortraitIdle();
      setImageFxActive(false);
      renderQuickActions();
      renderHudReadout();
      chooseSpawnNodes();
      requestRender();
      processActionQueue().catch(() => {});
    }
  };
}
