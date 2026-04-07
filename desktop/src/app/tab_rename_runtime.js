function defaultCssEscape(value = "") {
  return String(value || "").replace(/["\\]/g, "\\$&");
}

function assignRenameState(target, next = {}) {
  target.tabId = next.tabId || null;
  target.draft = String(next.draft || "");
  target.focusRequested = Boolean(next.focusRequested);
  target.lockedWidth = Number.isFinite(Number(next.lockedWidth)) ? Number(next.lockedWidth) : 0;
  return target;
}

function normalizeRenameState(state = null) {
  const target = state && typeof state === "object" ? state : {};
  return assignRenameState(target, {
    tabId: target.tabId,
    draft: target.draft,
    focusRequested: target.focusRequested,
    lockedWidth: target.lockedWidth,
  });
}

function isRenameInputElement(node, InputCtor = null) {
  if (!node) return false;
  if (typeof InputCtor === "function") return node instanceof InputCtor;
  return typeof node.focus === "function" && typeof node.select === "function";
}

export function createSessionTabRenameRuntime({
  renameState = null,
  getActiveTabId = null,
  getTabById = null,
  getDisplayLabel = null,
  defaultUntitledTitle = "Untitled Canvas",
  maxTitleLength = 40,
  normalizeTitleInput = null,
  automaticLabelForRecord = null,
  renderSessionTabStrip = null,
  updateTabMetadata = null,
  getTabListElement = null,
  cssEscape = null,
  InputCtor = typeof HTMLInputElement === "function" ? HTMLInputElement : null,
} = {}) {
  const state = normalizeRenameState(renameState);

  const normalizeInput =
    typeof normalizeTitleInput === "function"
      ? normalizeTitleInput
      : (value) => String(value ?? "").trim().slice(0, maxTitleLength);
  const escapeValue = typeof cssEscape === "function" ? cssEscape : defaultCssEscape;

  function resetSessionTabRenameState({ render = false } = {}) {
    assignRenameState(state, {
      tabId: null,
      draft: "",
      focusRequested: false,
      lockedWidth: 0,
    });
    if (render && typeof renderSessionTabStrip === "function") {
      renderSessionTabStrip();
    }
    return state;
  }

  function startSessionTabRename(tabId = "") {
    const normalizedTabId = String(tabId || "").trim();
    if (!normalizedTabId) return false;
    const activeTabId = typeof getActiveTabId === "function" ? String(getActiveTabId() || "").trim() : "";
    if (normalizedTabId !== activeTabId) return false;
    const record = typeof getTabById === "function" ? getTabById(normalizedTabId) || null : null;
    if (!record) return false;

    let lockedWidth = 0;
    const tabList = typeof getTabListElement === "function" ? getTabListElement() : null;
    if (tabList?.querySelector) {
      const item = tabList.querySelector(`.session-tab-item[data-tab-id="${escapeValue(normalizedTabId)}"]`);
      const measured = Number(item?.getBoundingClientRect?.().width) || 0;
      if (Number.isFinite(measured) && measured > 0) lockedWidth = Math.ceil(measured);
    }

    assignRenameState(state, {
      tabId: normalizedTabId,
      draft:
        (typeof getDisplayLabel === "function"
          ? getDisplayLabel(record, defaultUntitledTitle)
          : String(record?.label || defaultUntitledTitle || "")) || defaultUntitledTitle,
      focusRequested: true,
      lockedWidth,
    });
    if (typeof renderSessionTabStrip === "function") {
      renderSessionTabStrip();
    }
    return true;
  }

  function commitSessionTabRename(tabId = "", rawTitle = state.draft) {
    const normalizedTabId = String(tabId || state.tabId || "").trim();
    if (!normalizedTabId) return false;
    const record = typeof getTabById === "function" ? getTabById(normalizedTabId) || null : null;
    if (!record) {
      resetSessionTabRenameState({ render: true });
      return false;
    }

    const nextTitle = normalizeInput(rawTitle, maxTitleLength);
    if (nextTitle) {
      record.label = nextTitle;
      record.labelManual = true;
      if (record.session && typeof record.session === "object") {
        record.session.label = nextTitle;
        record.session.labelManual = true;
      }
    } else {
      record.labelManual = false;
      const automaticTitle =
        typeof automaticLabelForRecord === "function"
          ? automaticLabelForRecord(record, defaultUntitledTitle)
          : defaultUntitledTitle;
      record.label = automaticTitle;
      if (record.session && typeof record.session === "object") {
        record.session.label = automaticTitle;
        record.session.labelManual = false;
      }
    }

    resetSessionTabRenameState();
    if (typeof updateTabMetadata === "function") {
      updateTabMetadata(normalizedTabId, { updatedAt: Date.now() });
    }
    return true;
  }

  function cancelSessionTabRename() {
    if (!state.tabId) return false;
    resetSessionTabRenameState({ render: true });
    return true;
  }

  function focusSessionTabRenameInput() {
    if (!state.tabId || !state.focusRequested) return;
    const tabList = typeof getTabListElement === "function" ? getTabListElement() : null;
    if (!tabList?.querySelector) return;
    const selector = `.session-tab-item[data-tab-id="${escapeValue(state.tabId)}"] .session-tab-title-input`;
    const input = tabList.querySelector(selector);
    if (!isRenameInputElement(input, InputCtor)) return;
    state.focusRequested = false;
    input.focus();
    input.select();
  }

  function updateSessionTabRenameDraft(rawValue = "") {
    const next = normalizeInput(rawValue, maxTitleLength);
    state.draft = next;
    return next;
  }

  return {
    state,
    resetSessionTabRenameState,
    startSessionTabRename,
    commitSessionTabRename,
    cancelSessionTabRename,
    focusSessionTabRenameInput,
    updateSessionTabRenameDraft,
  };
}
