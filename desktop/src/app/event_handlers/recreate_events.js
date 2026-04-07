export function registerRecreateEventHandlers(map, types, handler) {
  map.set(types.RECREATE_PROMPT_INFERRED, handler);
  map.set(types.RECREATE_ITERATION_UPDATE, handler);
  map.set(types.RECREATE_DONE, handler);
}

export function createRecreateEventHandler(deps = {}) {
  const {
    types,
    state,
    setStatus,
    renderHudReadout,
    setTip,
    updatePortraitIdle,
    renderQuickActions,
    processActionQueue,
  } = deps;

  return async function handleRecreateEvent(event) {
    const eventType = String(event?.type || "");
    if (eventType === types.RECREATE_PROMPT_INFERRED) {
      const prompt = event.prompt;
      if (typeof prompt === "string") {
        state.lastRecreatePrompt = prompt;
        const ref = event.reference;
        if (typeof ref === "string" && ref) {
          for (const item of state.images) {
            if (item?.path === ref) {
              item.recreatePrompt = prompt;
              break;
            }
          }
        }
        setStatus("Engine: recreate (zero-prompt) running…");
      }
      renderHudReadout();
      return;
    }
    if (eventType === types.RECREATE_ITERATION_UPDATE) {
      const iter = event.iteration;
      const sim = event.similarity;
      if (typeof iter === "number") {
        const pct = typeof sim === "number" ? `${Math.round(sim * 100)}%` : "—";
        setStatus(`Engine: recreate iter ${iter} (best ${pct})`);
      }
      renderHudReadout();
      return;
    }
    if (eventType === types.RECREATE_DONE) {
      state.pendingRecreate = null;
      setStatus("Engine: variations ready");
      setTip("Variations complete.");
      updatePortraitIdle();
      renderQuickActions();
      renderHudReadout();
      processActionQueue().catch(() => {});
    }
  };
}
