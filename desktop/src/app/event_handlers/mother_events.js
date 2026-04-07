export function registerMotherEventHandlers(map, types, handler) {
  map.set(types.PLAN_PREVIEW, handler);
  map.set(types.VERSION_CREATED, handler);
  map.set(types.MOTHER_INTENT_INFERRED, handler);
  map.set(types.MOTHER_INTENT_INFER_FAILED, handler);
  map.set(types.MOTHER_PROMPT_COMPILED, handler);
  map.set(types.MOTHER_PROMPT_COMPILE_FAILED, handler);
}

export function createMotherEventHandler(deps = {}) {
  const {
    types,
    state,
    bumpSessionApiCalls,
    promptBenchmarkBindVersion,
    motherEventVersionId,
    motherIdleTrackVersionCreated,
    appendMotherTraceLog,
    motherV2MarkStale,
    motherV2DispatchCompiledPrompt,
    motherIdleHandleGenerationFailed,
    motherV2CompilePromptLocal,
    motherV2RoleMapClone,
    motherV2NormalizeTransformationMode,
    clamp,
    getVisibleActiveId,
    motherV2PromptCompileImageRows,
  } = deps;

  return async function handleMotherEvent(event) {
    const eventType = String(event?.type || "");
    if (eventType === types.PLAN_PREVIEW) {
      const cached = Boolean(event?.plan && event.plan.cached);
      if (!cached) bumpSessionApiCalls();
      return;
    }
    if (eventType === types.VERSION_CREATED) {
      promptBenchmarkBindVersion(motherEventVersionId(event));
      motherIdleTrackVersionCreated(event);
      return;
    }
    if (eventType === types.MOTHER_INTENT_INFERRED) {
      appendMotherTraceLog({
        kind: "intent_inferred_ignored",
        traceId: state.motherIdle?.telemetry?.traceId || null,
        actionVersion: Number(state.motherIdle?.actionVersion) || 0,
        reason: "heuristic_intent_disabled",
        source: event.source ? String(event.source) : null,
      }).catch(() => {});
      return;
    }
    if (eventType === types.MOTHER_INTENT_INFER_FAILED) {
      appendMotherTraceLog({
        kind: "intent_infer_failed_ignored",
        traceId: state.motherIdle?.telemetry?.traceId || null,
        actionVersion: Number(state.motherIdle?.actionVersion) || 0,
        reason: "heuristic_intent_disabled",
        source: event.source ? String(event.source) : null,
      }).catch(() => {});
      return;
    }
    if (eventType === types.MOTHER_PROMPT_COMPILED) {
      const idle = state.motherIdle;
      if (!idle) return;
      const actionVersion = Number(event.action_version) || 0;
      if (actionVersion !== (Number(idle.actionVersion) || 0)) {
        motherV2MarkStale({
          stage: "prompt_compiled",
          event_action_version: actionVersion,
        });
        return;
      }
      if (!idle.pendingPromptCompile || idle.pendingGeneration || Boolean(idle.pendingDispatchToken)) {
        let dispatchSkipReason = "unknown";
        if (!idle.pendingPromptCompile) {
          dispatchSkipReason = "pending_prompt_compile_false";
        } else if (idle.pendingGeneration) {
          dispatchSkipReason = "pending_generation_true";
        } else if (Boolean(idle.pendingDispatchToken)) {
          dispatchSkipReason = "pending_dispatch_token_active";
        }
        appendMotherTraceLog({
          kind: "prompt_compiled_dispatch_skipped",
          traceId: idle.telemetry?.traceId || null,
          actionVersion,
          reason: dispatchSkipReason,
          pending_prompt_compile: Boolean(idle.pendingPromptCompile),
          pending_generation: Boolean(idle.pendingGeneration),
          pending_dispatch_token: Number(idle.pendingDispatchToken) || 0,
        }).catch(() => {});
        return;
      }
      await motherV2DispatchCompiledPrompt(event.compiled || {}).catch((err) => {
        motherIdleHandleGenerationFailed(err?.message || "Mother prompt compile dispatch failed.");
      });
      return;
    }
    if (eventType === types.MOTHER_PROMPT_COMPILE_FAILED) {
      const idle = state.motherIdle;
      if (!idle || !idle.pendingPromptCompile) return;
      idle.pendingPromptCompile = false;
      const compileWasSpeculative = Boolean(idle.pendingPromptCompileSpeculative);
      idle.pendingPromptCompileSpeculative = false;
      idle.pendingPromptCompilePath = null;
      clearTimeout(idle.pendingPromptCompileTimeout);
      idle.pendingPromptCompileTimeout = null;
      if ((Number(idle.pendingActionVersion) || 0) !== (Number(idle.actionVersion) || 0)) {
        motherV2MarkStale({ stage: "prompt_compile_failed" });
        return;
      }
      const compiled = motherV2CompilePromptLocal({
        action_version: Number(idle.actionVersion) || 0,
        intent: idle.intent || null,
        roles: motherV2RoleMapClone(),
        transformation_mode: motherV2NormalizeTransformationMode(idle.intent?.transformation_mode),
        intensity: clamp(Number(idle.intensity) || 62, 0, 100),
        active_id: getVisibleActiveId() || null,
        images: motherV2PromptCompileImageRows(),
      });
      idle.pendingPromptCompileSpeculative = compileWasSpeculative;
      await motherV2DispatchCompiledPrompt(compiled).catch((err) => {
        motherIdleHandleGenerationFailed(err?.message || "Mother prompt compile fallback failed.");
      });
    }
  };
}
