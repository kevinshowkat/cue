export function selectBootState(state = {}) {
  return state?.boot && typeof state.boot === "object" ? state.boot : { phase: "idle", error: null };
}

export function selectBootPhase(state = {}) {
  const boot = selectBootState(state);
  return String(boot.phase || "idle").trim() || "idle";
}

export function selectActiveTabId(state = {}) {
  return String(state?.tabs?.activeTabId || "").trim() || null;
}

export function selectActiveTab(state = {}) {
  const activeTabId = selectActiveTabId(state);
  if (!activeTabId) return null;
  const tabsById = state?.tabs?.byId;
  if (tabsById instanceof Map) return tabsById.get(activeTabId) || null;
  if (tabsById && typeof tabsById === "object") return tabsById[activeTabId] || null;
  return null;
}

export function selectRuntimeState(state = {}) {
  return state?.runtime && typeof state.runtime === "object" ? state.runtime : {};
}

export function selectRuntimeReady(state = {}) {
  return Boolean(selectRuntimeState(state).ready);
}
