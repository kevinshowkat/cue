export function registerIntentEventHandlers(map, types, handler) {
  map.set(types.COST_LATENCY_UPDATE, handler);
  map.set(types.CANVAS_CONTEXT, handler);
  map.set(types.CANVAS_CONTEXT_FAILED, handler);
  map.set(types.INTENT_ICONS, handler);
  map.set(types.INTENT_ICONS_FAILED, handler);
}

export function createIntentEventHandler(deps = {}) {
  const {
    types,
    state,
    MOTHER_IDLE_STATES,
    MOTHER_V2_INTENT_RT_TIMEOUT_MS,
    MOTHER_V2_INTENT_RT_TRANSPORT_RETRY_MAX,
    REALTIME_VISION_LABEL_MAX_CHARS,
    INTENT_FORCE_CHOICE_ENABLED,
    INTENT_ROUNDS_ENABLED,
    INTENT_TIMER_ENABLED,
    INTENT_DEADLINE_MS,
    promptBenchmarkAttachCostLatencyEvent,
    topMetricIngestCost,
    renderHudReadout,
    renderSessionApiCallsReadout,
    topMetricIngestRealtimeCostFromPayload,
    updateAlwaysOnVisionReadout,
    appendMotherTraceLog,
    isOpenAiRealtimeSignal,
    markOpenAiRealtimePortraitActivity,
    classifyIntentIconsRouting,
    clearAmbientIntentPending,
    motherV2ArmRealtimeIntentTimeout,
    parseIntentIconsJsonDetailed,
    intentIconsPayloadChecksum,
    intentIconsPayloadSafeSnippet,
    appendIntentTrace,
    extractIntentImageDescriptions,
    _normalizeVisionLabel,
    intentModeActive,
    scheduleVisualPromptWrite,
    getActiveImage,
    rebuildAmbientIntentSuggestions,
    motherV2IntentPayload,
    motherV2IntentFromRealtimeIcons,
    motherV2MaybeTransformationMode,
    motherIdleHandleGenerationFailed,
    motherV2ApplyIntent,
    pickSuggestedIntentBranch,
    pickDefaultIntentFocusBranchId,
    clamp,
    ensureIntentFallbackIconState,
    scheduleIntentStateWrite,
    clearIntentInferenceTimeout,
    clearIntentAmbientInferenceTimeout,
    requestRender,
    renderQuickActions,
    motherV2ClearIntentRealtimeBusy,
    nextMotherRealtimeIntentFailureAction,
    motherV2RetryRealtimeIntentTransport,
    setStatus,
    renderMotherReadout,
    applyAmbientIntentFallback,
    pickSuggestedIntentBranchId,
    intentRemainingMs,
    scheduleIntentInference,
  } = deps;

  return async function handleIntentEvent(event) {
    const eventType = String(event?.type || "");
    if (eventType === types.COST_LATENCY_UPDATE) {
      promptBenchmarkAttachCostLatencyEvent(event);
      state.lastCostLatency = {
        provider: event.provider,
        model: event.model,
        cost_total_usd: event.cost_total_usd,
        cost_per_1k_images_usd: event.cost_per_1k_images_usd,
        latency_per_image_s: event.latency_per_image_s,
        at: Date.now(),
      };
      topMetricIngestCost(event.cost_total_usd);
      renderHudReadout();
      renderSessionApiCallsReadout();
      return;
    }
    if (eventType === types.CANVAS_CONTEXT) {
      if (!event.partial) {
        topMetricIngestRealtimeCostFromPayload(event, { render: true });
      }
      return;
    }
    if (eventType === types.CANVAS_CONTEXT_FAILED) {
      updateAlwaysOnVisionReadout();
      return;
    }
    if (eventType === types.INTENT_ICONS) {
      const intent = state.intent;
      const ambient = state.intentAmbient;
      const motherIdle = state.motherIdle;
      const motherPhase = String(motherIdle?.phase || "");
      const motherActionVersion = Number(motherIdle?.actionVersion) || 0;
      const motherPendingActionVersion = Number(motherIdle?.pendingActionVersion) || 0;
      const motherVersionMatches = motherPendingActionVersion === motherActionVersion;
      const motherRealtimePath = String(motherIdle?.pendingIntentRealtimePath || "").trim();
      const motherRequestId = String(motherIdle?.pendingIntentRequestId || "").trim() || null;
      const motherHasFallbackIntent =
        String(motherIdle?.intent?._intent_source_kind || "").trim().toLowerCase() === "fallback";
      const motherLateRealtimeUpgrade = Boolean(
        !motherIdle?.pendingIntent &&
          motherHasFallbackIntent &&
          motherPhase === MOTHER_IDLE_STATES.INTENT_HYPOTHESIZING &&
          motherVersionMatches &&
          motherRealtimePath &&
          Date.now() <= (Number(motherIdle?.pendingIntentUpgradeUntil) || 0) &&
          !motherIdle?.pendingPromptCompile &&
          !motherIdle?.pendingGeneration
      );
      const motherCanAcceptRealtime = Boolean(
        (motherIdle?.pendingIntent &&
          motherPhase === MOTHER_IDLE_STATES.INTENT_HYPOTHESIZING &&
          motherVersionMatches) ||
          motherLateRealtimeUpgrade
      );
      const isPartial = Boolean(event.partial);
      const path = event.image_path ? String(event.image_path) : "";
      const eventIntentScope = String(event.intent_scope || "").trim().toLowerCase();
      const eventIsMotherScoped = !eventIntentScope || eventIntentScope === "mother";
      const eventActionVersionRaw = Number(event.action_version);
      if (!intent && !ambient && !motherCanAcceptRealtime) {
        if (!isPartial && motherIdle && eventIsMotherScoped) {
          appendMotherTraceLog({
            kind: "intent_icons_ignored",
            traceId: motherIdle.telemetry?.traceId || null,
            actionVersion: motherActionVersion,
            request_id: motherRequestId,
            reason: "no_pending_route",
            event_action_version: Number.isFinite(eventActionVersionRaw) ? eventActionVersionRaw : null,
            snapshot_path: path || null,
            intent_scope: eventIntentScope || null,
          }).catch(() => {});
        }
        return;
      }
      if (isOpenAiRealtimeSignal({ source: event.source, model: event.model })) {
        markOpenAiRealtimePortraitActivity();
      }
      if (!isPartial) {
        topMetricIngestRealtimeCostFromPayload(event, { render: true });
      }
      const text = event.text;
      if (!path) return;
      const routing = classifyIntentIconsRouting({
        path,
        intentPendingPath: intent?.pendingPath,
        ambientPendingPath: ambient?.pendingPath,
        motherCanAcceptRealtime,
        motherRealtimePath,
        motherActionVersion,
        eventActionVersion: eventActionVersionRaw,
        eventIntentScope,
      });
      const { matchAmbient, matchIntent, matchMother, ignoreReason } = routing;
      if (ignoreReason === "scope_mismatch") {
        return;
      }
      if (ignoreReason === "snapshot_path_mismatch" || ignoreReason === "path_mismatch") {
        if (!isPartial && ignoreReason === "snapshot_path_mismatch") {
          appendMotherTraceLog({
            kind: "intent_icons_ignored",
            traceId: motherIdle?.telemetry?.traceId || null,
            actionVersion: motherActionVersion,
            request_id: motherRequestId,
            reason: ignoreReason,
            expected_snapshot_path: motherRealtimePath || null,
            event_snapshot_path: path || null,
            event_action_version: Number.isFinite(eventActionVersionRaw) ? eventActionVersionRaw : null,
          }).catch(() => {});
        }
        return;
      }
      if (ignoreReason === "event_action_version_mismatch") {
        appendMotherTraceLog({
          kind: "intent_icons_ignored",
          traceId: motherIdle?.telemetry?.traceId || null,
          actionVersion: motherActionVersion,
          request_id: motherRequestId,
          reason: ignoreReason,
          event_action_version: eventActionVersionRaw,
        }).catch(() => {});
        return;
      }

      if (isPartial) {
        if (matchIntent && intent) intent.pending = true;
        if (matchAmbient && ambient) ambient.pending = true;
      } else {
        if (matchIntent && intent) {
          intent.pending = false;
          intent.pendingPath = null;
          intent.pendingAt = 0;
          intent.pendingFrameId = null;
        }
        if (matchAmbient && ambient) {
          clearAmbientIntentPending();
        }
      }

      const hasText = typeof text === "string" && text.trim();
      if (hasText) {
        if (isPartial && matchMother && motherIdle?.pendingIntent) {
          motherV2ArmRealtimeIntentTimeout({ timeoutMs: MOTHER_V2_INTENT_RT_TIMEOUT_MS });
        }
        const parsedResult = parseIntentIconsJsonDetailed(text);
        const parsed = parsedResult?.ok ? parsedResult.value : null;
        const parseStrategy = String(parsedResult?.strategy || "none");
        const parseReason = parsedResult?.reason ? String(parsedResult.reason) : null;
        const parseError = parsedResult?.error ? String(parsedResult.error) : null;
        const textLen = text.length;
        const textHash = intentIconsPayloadChecksum(text);

        if (!isPartial) {
          const snippet = parsed ? { head: "", tail: "" } : intentIconsPayloadSafeSnippet(text);
          if (matchIntent || matchAmbient) {
            appendIntentTrace({
              kind: "model_icons_payload_parse",
              parse_ok: Boolean(parsed),
              parse_strategy: parseStrategy,
              parse_reason: parseReason,
              parse_error: parseError,
              snapshot_path: path ? String(path) : null,
              request_id: matchMother ? motherRequestId : null,
              action_version: matchMother ? motherActionVersion : null,
              source: event.source || null,
              model: event.model || null,
              response_status: event.response_status ? String(event.response_status) : null,
              response_status_reason: event.response_status_reason ? String(event.response_status_reason) : null,
              text_len: textLen,
              text_hash: textHash,
              snippet_head: snippet.head || null,
              snippet_tail: snippet.tail || null,
            }).catch(() => {});
          }
          if (matchMother && motherIdle) {
            appendMotherTraceLog({
              kind: "intent_payload_parse",
              traceId: motherIdle.telemetry?.traceId || null,
              actionVersion: Number(motherIdle.actionVersion) || 0,
              request_id: motherRequestId,
              snapshot_path: path || null,
              parse_ok: Boolean(parsed),
              parse_strategy: parseStrategy,
              parse_reason: parseReason,
              parse_error: parseError,
              source: event.source || null,
              model: event.model || null,
              response_status: event.response_status ? String(event.response_status) : null,
              response_status_reason: event.response_status_reason ? String(event.response_status_reason) : null,
              text_len: textLen,
              text_hash: textHash,
              snippet_head: snippet.head || null,
              snippet_tail: snippet.tail || null,
            }).catch(() => {});
          }
        }

        if (parsed) {
          const imageDescs = !isPartial ? extractIntentImageDescriptions(parsed) : [];
          let wroteVision = false;
          if (!isPartial && imageDescs.length) {
            for (const rec of imageDescs) {
              const imageId = rec?.image_id ? String(rec.image_id) : "";
              const label = rec?.label ? String(rec.label) : "";
              if (!imageId || !label) continue;
              const imgItem = state.imagesById.get(imageId) || null;
              if (!imgItem) continue;
              const prevLabel = _normalizeVisionLabel(imgItem.visionDesc, {
                maxChars: REALTIME_VISION_LABEL_MAX_CHARS,
              });
              const prevSource = String(imgItem?.visionDescMeta?.source || "").trim();
              const keepExplicitDescribe =
                Boolean(prevLabel) &&
                (prevSource === "openai_realtime_describe" || prevSource === "openai_vision");
              if (keepExplicitDescribe) {
                continue;
              }
              if (prevLabel && prevLabel === label) continue;
              imgItem.visionDesc = label;
              imgItem.visionPending = false;
              imgItem.visionDescMeta = {
                source: event.source || null,
                model: event.model || null,
                at: Date.now(),
              };
              wroteVision = true;
              if (intentModeActive()) {
                appendIntentTrace({
                  kind: "vision_description",
                  image_id: imageId,
                  image_path: imgItem?.path ? String(imgItem.path) : null,
                  description: label,
                  source: event.source || null,
                  model: event.model || null,
                }).catch(() => {});
              }
            }
          }

          if (wroteVision) {
            scheduleVisualPromptWrite();
            if (getActiveImage()?.id) renderHudReadout();
          }

          const parsedAt = Date.now();
          if (matchIntent && intent) {
            intent.iconState = parsed;
            intent.iconStateAt = parsedAt;
            intent.rtState = "ready";
            intent.disabledReason = null;
            intent.lastError = null;
            intent.lastErrorAt = 0;
            intent.uiHideSuggestion = false;
          }
          if (matchAmbient && ambient) {
            ambient.iconState = parsed;
            ambient.iconStateAt = parsedAt;
            ambient.rtState = "ready";
            ambient.disabledReason = null;
            ambient.lastError = null;
            ambient.lastErrorAt = 0;
            if (!isPartial) rebuildAmbientIntentSuggestions(parsed, { reason: "realtime", nowMs: parsedAt });
          }
          if (matchMother && motherIdle && !isPartial) {
            const payloadForMother =
              motherIdle.pendingIntentPayload && typeof motherIdle.pendingIntentPayload === "object"
                ? motherIdle.pendingIntentPayload
                : motherV2IntentPayload();
            const realtimeIntent = motherV2IntentFromRealtimeIcons(parsed, payloadForMother);
            const hasRealtimeModeSignal = Boolean(
              motherV2MaybeTransformationMode(realtimeIntent?.transformation_mode) ||
                (Array.isArray(realtimeIntent?.transformation_mode_candidates) &&
                  realtimeIntent.transformation_mode_candidates.some((entry) =>
                    Boolean(motherV2MaybeTransformationMode(entry?.mode || entry?.transformation_mode))
                  ))
            );
            if (!hasRealtimeModeSignal) {
              const missingModeMessage = "Mother realtime intent missing transformation mode.";
              appendMotherTraceLog({
                kind: "intent_realtime_failed",
                traceId: motherIdle.telemetry?.traceId || null,
                actionVersion: Number(motherIdle.actionVersion) || 0,
                request_id: motherRequestId,
                source: event.source || "intent_rt_realtime",
                error: missingModeMessage,
              }).catch(() => {});
              motherIdleHandleGenerationFailed(missingModeMessage);
              return;
            }
            const isLateRealtimeUpgrade = !motherIdle.pendingIntent;
            if (!motherIdle.pendingIntent) {
              appendMotherTraceLog({
                kind: "intent_realtime_upgrade",
                traceId: motherIdle.telemetry?.traceId || null,
                actionVersion: Number(motherIdle.actionVersion) || 0,
                request_id: motherRequestId,
                snapshot_path: path || null,
              }).catch(() => {});
            }
            motherV2ApplyIntent(realtimeIntent, {
              source: event.source || "intent_rt_realtime",
              sourceModel: event.model || null,
              requestId: motherRequestId,
              preserveMode: isLateRealtimeUpgrade,
            });
          }
          const picked = pickSuggestedIntentBranch(parsed);
          if (matchIntent && intent) {
            intent.focusBranchId =
              (picked?.branch_id ? String(picked.branch_id) : "") || pickDefaultIntentFocusBranchId(parsed);
          }
          if (!isPartial && (matchIntent || matchAmbient)) {
            const branchIds = Array.isArray(parsed?.branches)
              ? parsed.branches.map((branch) => (branch?.branch_id ? String(branch.branch_id) : "")).filter(Boolean)
              : [];
            const branchRank = Array.isArray(parsed?.branches)
              ? parsed.branches
                  .map((branch) => ({
                    branch_id: branch?.branch_id ? String(branch.branch_id) : "",
                    confidence:
                      typeof branch?.confidence === "number" && Number.isFinite(branch.confidence)
                        ? clamp(Number(branch.confidence) || 0, 0, 1)
                        : null,
                    evidence_image_ids: Array.isArray(branch?.evidence_image_ids)
                      ? branch.evidence_image_ids
                          .map((value) => String(value || "").trim())
                          .filter(Boolean)
                          .slice(0, 3)
                      : [],
                  }))
                  .filter((branch) => Boolean(branch.branch_id))
              : [];
            appendIntentTrace({
              kind: "model_icons",
              partial: false,
              frame_id: parsed?.frame_id ? String(parsed.frame_id) : null,
              snapshot_path: path ? String(path) : null,
              branch_ids: branchIds,
              branch_rank: branchRank.length ? branchRank : null,
              focus_branch_id: intent?.focusBranchId ? String(intent.focusBranchId) : null,
              checkpoint_applies_to: parsed?.checkpoint?.applies_to
                ? String(parsed.checkpoint.applies_to)
                : null,
              checkpoint_branch_id: picked?.checkpoint_branch_id
                ? String(picked.checkpoint_branch_id)
                : null,
              ranked_branch_ids:
                Array.isArray(picked?.ranked_branch_ids) && picked.ranked_branch_ids.length
                  ? picked.ranked_branch_ids
                  : null,
              suggestion_reason: picked?.reason ? String(picked.reason) : null,
              image_descriptions: imageDescs.length ? imageDescs : null,
              text_len: textLen,
              text_hash: textHash,
              parse_strategy: parseStrategy,
            }).catch(() => {});
          }
          if (matchIntent && intent) {
            const total = Math.max(1, Number(intent.totalRounds) || 3);
            const round = Math.max(1, Number(intent.round) || 1);
            if (
              INTENT_FORCE_CHOICE_ENABLED &&
              INTENT_ROUNDS_ENABLED &&
              !isPartial &&
              round >= total &&
              !intent.forceChoice
            ) {
              intent.forceChoice = true;
              ensureIntentFallbackIconState("final_round");
              scheduleIntentStateWrite({ immediate: true });
            } else {
              if (!INTENT_FORCE_CHOICE_ENABLED) intent.forceChoice = false;
              scheduleIntentStateWrite();
            }
          }
        } else if (!isPartial) {
          const parseReasonLabel = parseReason ? parseReason.replace(/_/g, " ") : "parse failed";
          const intentParseMessage = `Intent icons parse failed (${parseReasonLabel}).`;
          const snippet = intentIconsPayloadSafeSnippet(text);
          if (matchIntent && intent) {
            intent.rtState = "failed";
            intent.disabledReason = "Intent icons parse failed.";
            intent.lastError = intent.disabledReason;
            intent.lastErrorAt = Date.now();
            intent.uiHideSuggestion = false;
            if (!INTENT_FORCE_CHOICE_ENABLED) intent.forceChoice = false;
            const icon = ensureIntentFallbackIconState("parse_failed");
            if (!intent.focusBranchId) {
              intent.focusBranchId =
                pickSuggestedIntentBranchId(icon) || pickDefaultIntentFocusBranchId(icon);
            }
          }
          if (matchAmbient && ambient) {
            applyAmbientIntentFallback("parse_failed", { message: intentParseMessage });
          }
          if (matchMother && motherIdle) {
            const fallbackMessage =
              parseReason === "truncated_json"
                ? "Mother realtime intent response was truncated."
                : "Mother realtime intent parse failed.";
            appendMotherTraceLog({
              kind: "intent_realtime_failed",
              traceId: motherIdle.telemetry?.traceId || null,
              actionVersion: Number(motherIdle.actionVersion) || 0,
              request_id: motherRequestId,
              source: "intent_rt_parse_failed",
              parse_reason: parseReason,
              parse_strategy: parseStrategy,
              parse_error: parseError,
              response_status: event.response_status ? String(event.response_status) : null,
              response_status_reason: event.response_status_reason
                ? String(event.response_status_reason)
                : null,
              snapshot_path: path || null,
              text_len: textLen,
              text_hash: textHash,
              snippet_head: snippet.head || null,
              snippet_tail: snippet.tail || null,
              error: fallbackMessage,
            }).catch(() => {});
            motherIdleHandleGenerationFailed(fallbackMessage);
          }
          if (matchIntent || matchAmbient) {
            appendIntentTrace({
              kind: "model_icons_parse_failed",
              reason: intent?.disabledReason || intentParseMessage,
              parse_reason: parseReason,
              parse_strategy: parseStrategy,
              parse_error: parseError,
              response_status: event.response_status ? String(event.response_status) : null,
              response_status_reason: event.response_status_reason
                ? String(event.response_status_reason)
                : null,
              snapshot_path: path ? String(path) : null,
              text_len: textLen,
              text_hash: textHash,
              snippet_head: snippet.head || null,
              snippet_tail: snippet.tail || null,
              rt_state: intent?.rtState || ambient?.rtState || "failed",
            }).catch(() => {});
          }
          if (matchIntent && intent) scheduleIntentStateWrite({ immediate: true });
        }
      }

      if (!isPartial) {
        if (matchIntent) {
          clearIntentInferenceTimeout();
        }
        if (matchAmbient) {
          clearIntentAmbientInferenceTimeout();
        }
      }

      requestRender();
      renderQuickActions();
      return;
    }

    if (eventType === types.INTENT_ICONS_FAILED) {
      const intent = state.intent;
      const ambient = state.intentAmbient;
      let motherIdle = state.motherIdle;
      const path = event.image_path ? String(event.image_path) : "";
      if (!path) return;
      const eventIntentScope = String(event.intent_scope || "").trim().toLowerCase();
      const eventIsMotherScoped = !eventIntentScope || eventIntentScope === "mother";
      if (eventIsMotherScoped) {
        motherV2ClearIntentRealtimeBusy({
          path,
          reason: "intent_icons_failed",
        });
      }
      const resolveActiveMotherRealtimeFailureTarget = () => {
        const motherIdleLatest = state.motherIdle;
        const matchMotherLatest = Boolean(
          eventIsMotherScoped &&
            motherIdleLatest?.pendingIntent &&
            String(motherIdleLatest?.phase || "") === MOTHER_IDLE_STATES.INTENT_HYPOTHESIZING &&
            String(motherIdleLatest?.pendingIntentRealtimePath || "") === path &&
            (Number(motherIdleLatest?.pendingActionVersion) || 0) ===
              (Number(motherIdleLatest?.actionVersion) || 0)
        );
        const motherRequestIdLatest = String(motherIdleLatest?.pendingIntentRequestId || "").trim() || null;
        return { motherIdleLatest, matchMotherLatest, motherRequestIdLatest };
      };
      const matchAmbient = Boolean(ambient?.pendingPath && String(ambient.pendingPath) === path);
      const matchIntent = Boolean(intent?.pendingPath && String(intent.pendingPath) === path);
      let {
        motherIdleLatest: resolvedMotherIdle,
        matchMotherLatest: matchMother,
        motherRequestIdLatest: motherRequestId,
      } = resolveActiveMotherRealtimeFailureTarget();
      motherIdle = resolvedMotherIdle;
      if (!matchIntent && !matchAmbient && !matchMother) return;
      if (isOpenAiRealtimeSignal({ source: event.source, model: event.model })) {
        markOpenAiRealtimePortraitActivity();
      }

      if (matchIntent && intent) {
        intent.pending = false;
        intent.pendingPath = null;
        intent.pendingAt = 0;
        intent.pendingFrameId = null;
      }
      if (matchAmbient && ambient) {
        clearAmbientIntentPending();
      }
      if (matchIntent) {
        clearIntentInferenceTimeout();
      }
      if (matchAmbient) {
        clearIntentAmbientInferenceTimeout();
      }

      const errRaw = typeof event.error === "string" ? event.error.trim() : "";
      const msg = errRaw ? `Intent inference failed: ${errRaw}` : "Intent inference failed.";
      const retryDecision = nextMotherRealtimeIntentFailureAction({
        event,
        matchMother,
        pendingIntent: Boolean(motherIdle?.pendingIntent),
        phase: motherIdle?.phase || "",
        actionVersion: Number(motherIdle?.actionVersion) || 0,
        pendingActionVersion: Number(motherIdle?.pendingActionVersion) || 0,
        retryCount: Number(motherIdle?.pendingIntentTransportRetryCount) || 0,
        maxRetries: MOTHER_V2_INTENT_RT_TRANSPORT_RETRY_MAX,
      });
      if (retryDecision.action === "retry") {
        const retried = await motherV2RetryRealtimeIntentTransport({
          path,
          errorMessage: msg,
        });
        if (retried) {
          setStatus("Mother: retrying realtime intent…");
          renderMotherReadout();
          requestRender();
          return;
        }
        ({
          motherIdleLatest: motherIdle,
          matchMotherLatest: matchMother,
          motherRequestIdLatest: motherRequestId,
        } = resolveActiveMotherRealtimeFailureTarget());
        if (!matchIntent && !matchAmbient && !matchMother) return;
      }
      if (retryDecision.retryable && retryDecision.action === "fail") {
        appendMotherTraceLog({
          kind: "intent_realtime_retry_exhausted",
          traceId: motherIdle?.telemetry?.traceId || null,
          actionVersion: Number(motherIdle?.actionVersion) || 0,
          request_id: motherRequestId,
          retry_count: Number(motherIdle?.pendingIntentTransportRetryCount) || 0,
          max_retries: MOTHER_V2_INTENT_RT_TRANSPORT_RETRY_MAX,
          reason: retryDecision.reason || null,
          error: msg,
        }).catch(() => {});
      }
      if (matchIntent && intent) {
        intent.rtState = "failed";
        intent.lastError = msg;
        intent.lastErrorAt = Date.now();
        intent.uiHideSuggestion = false;
      }
      if (matchIntent || matchAmbient) {
        appendIntentTrace({
          kind: "model_icons_failed",
          reason: msg,
          snapshot_path: path ? String(path) : null,
          rt_state: intent?.rtState || ambient?.rtState || "failed",
        }).catch(() => {});
      }

      const errLower = errRaw.toLowerCase();
      const hardDisable = Boolean(
        errLower.includes("missing openai_api_key") ||
          errLower.includes("missing gemini_api_key") ||
          errLower.includes("missing google_api_key") ||
          errLower.includes("gemini_api_key (or google_api_key)") ||
          errLower.includes("realtime provider 'openai_realtime'") ||
          errLower.includes("realtime provider 'gemini_flash'") ||
          errLower.includes("openrouter_api_key alone is insufficient") ||
          errLower.includes("missing dependency") ||
          errLower.includes("disabled (brood_intent_realtime_disabled=1") ||
          errLower.includes("realtime intent inference is disabled")
      );
      if (matchIntent && intent) intent.disabledReason = hardDisable ? msg : null;

      if (matchIntent && intent) {
        ensureIntentFallbackIconState("failed");
        if (!intent.focusBranchId) {
          intent.focusBranchId =
            pickSuggestedIntentBranchId(intent.iconState) || pickDefaultIntentFocusBranchId();
        }
      }
      if (matchAmbient && ambient) {
        applyAmbientIntentFallback("failed", { message: msg, hardDisable });
      }
      if (matchMother && motherIdle) {
        appendMotherTraceLog({
          kind: "intent_realtime_failed",
          traceId: motherIdle.telemetry?.traceId || null,
          actionVersion: Number(motherIdle.actionVersion) || 0,
          request_id: motherRequestId,
          source: "intent_rt_failed",
          error: msg,
        }).catch(() => {});
        motherIdleHandleGenerationFailed(`Mother realtime intent failed. ${msg}`);
      }

      if (matchIntent && intent && !INTENT_FORCE_CHOICE_ENABLED) {
        intent.forceChoice = false;
      } else if (matchIntent && intent) {
        const total = Math.max(1, Number(intent.totalRounds) || 3);
        const round = Math.max(1, Number(intent.round) || 1);
        const remainingMs = intent.startedAt ? intentRemainingMs(Date.now()) : INTENT_DEADLINE_MS;
        const gateByTimer = Boolean(INTENT_TIMER_ENABLED) && remainingMs <= 0;
        const gateByRounds = Boolean(INTENT_ROUNDS_ENABLED) && round >= total;
        if (gateByTimer || gateByRounds) {
          intent.forceChoice = true;
        }
      }

      if (matchIntent && intent) scheduleIntentStateWrite({ immediate: true });
      if (matchIntent || matchAmbient) setStatus(`Engine: ${msg}`, true);
      requestRender();
      renderQuickActions();

      if (!hardDisable && matchIntent && intentModeActive() && intent && !intent.forceChoice) {
        scheduleIntentInference({ immediate: false, reason: "retry" });
      }
    }
  };
}
