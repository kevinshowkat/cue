function createFallbackFragment() {
  return {
    isFragment: true,
    children: [],
    append(...nodes) {
      for (const node of nodes) {
        if (!node) continue;
        this.children.push(node);
      }
    },
    appendChild(node) {
      if (!node) return node;
      this.children.push(node);
      return node;
    },
  };
}

function appendChildren(target, ...children) {
  if (!target || typeof target.append !== "function") return;
  target.append(...children.filter(Boolean));
}

function createSessionTabFlags(documentObj) {
  const flags = documentObj.createElement("span");
  flags.className = "session-tab-flags";
  flags.setAttribute("aria-hidden", "true");
  const busyIndicator = documentObj.createElement("span");
  busyIndicator.className = "session-tab-busy-indicator";
  flags.append(busyIndicator);
  return flags;
}

function createSessionTabForkIndicator(documentObj, renderIconSlot = null) {
  const indicator = documentObj.createElement("span");
  indicator.className = "session-tab-fork-indicator";
  indicator.setAttribute("aria-hidden", "true");
  indicator.dataset.juggernautIconSlot = "fork_session";
  if (typeof renderIconSlot === "function") {
    renderIconSlot(indicator, "fork_session");
  }
  return indicator;
}

function createSessionTabReviewIcon(documentObj, summary = {}) {
  const reviewFlowState = String(summary.reviewFlowState || "").trim();
  if (!reviewFlowState) return null;
  const icon = documentObj.createElement("span");
  icon.className = "session-tab-review-icon";
  icon.classList.add(`is-${reviewFlowState}`);
  const reviewFlowLabel = String(summary.reviewFlowLabel || "Review").trim() || "Review";
  icon.setAttribute("role", "img");
  icon.setAttribute("aria-label", reviewFlowLabel);
  icon.title = reviewFlowLabel;
  if (reviewFlowState === "planning" || reviewFlowState === "applying") {
    icon.classList.add("session-tab-review-spinner");
    return icon;
  }
  if (reviewFlowState === "ready") {
    icon.innerHTML = `
      <svg viewBox="0 0 12 12" aria-hidden="true">
        <path
          d="M2.4 6.4 4.85 8.85 9.6 3.95"
          fill="none"
          stroke="currentColor"
          stroke-width="1.6"
          stroke-linecap="round"
          stroke-linejoin="round"
        />
      </svg>
    `;
    return icon;
  }
  icon.innerHTML = `
    <svg viewBox="0 0 12 12" aria-hidden="true">
      <path
        d="M6 2.4v3.35M6 8.55h.01"
        fill="none"
        stroke="currentColor"
        stroke-width="1.65"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
      <circle cx="6" cy="6" r="4.2" fill="none" stroke="currentColor" stroke-width="1.2" opacity="0.42" />
    </svg>
  `;
  return icon;
}

function appendSessionTabTitleRowLead(documentObj, titleRow, summary = {}, renderIconSlot = null) {
  if (summary.isForked) titleRow.append(createSessionTabForkIndicator(documentObj, renderIconSlot));
  const reviewIcon = createSessionTabReviewIcon(documentObj, summary);
  if (reviewIcon) titleRow.append(reviewIcon);
}

function createSessionTabStripPlaceholderItem(documentObj, label = "No session yet") {
  const item = documentObj.createElement("div");
  item.className = "session-tab-item is-placeholder";
  item.dataset.placeholder = "true";
  item.setAttribute("aria-hidden", "true");

  const shell = documentObj.createElement("div");
  shell.className = "session-tab-placeholder-shell";

  const labels = documentObj.createElement("span");
  labels.className = "session-tab-labels";

  const title = documentObj.createElement("span");
  title.className = "session-tab-placeholder-label";
  title.textContent = label;
  labels.append(title);

  shell.append(labels);
  item.append(shell);
  return item;
}

function callMaybePromise(action, onError = null) {
  try {
    return Promise.resolve(typeof action === "function" ? action() : action).catch((error) => {
      if (typeof onError === "function") onError(error);
      return null;
    });
  } catch (error) {
    if (typeof onError === "function") onError(error);
    return Promise.resolve(null);
  }
}

export function createSessionTabStripUi({
  documentObj = typeof document !== "undefined" ? document : null,
  consoleObj = globalThis.console,
  els = null,
  listTabs = null,
  subscribeTabs = null,
  buildTabSummary = null,
  renameRuntime = null,
  renderIconSlot = null,
  normalizeTitleInput = null,
  maxTitleLength = 40,
  defaultUntitledTitle = "Untitled Canvas",
  getPlaceholderLabel = null,
  activateTab = null,
  closeTab = null,
  bumpInteraction = null,
  showToast = null,
  onTimelineToggle = null,
  onNewSession = null,
  onForkSession = null,
  onDesignReviewPointer = null,
  onDesignReviewKeyboard = null,
  onDesignReviewClick = null,
} = {}) {
  let releaseSessionTabStripSubscription = null;

  const normalizeInput =
    typeof normalizeTitleInput === "function"
      ? normalizeTitleInput
      : (value) => String(value ?? "").trim().slice(0, maxTitleLength);

  function createSessionTabStripItem(tab = null, totalTabs = 0) {
    const summary =
      typeof buildTabSummary === "function"
        ? buildTabSummary(tab, totalTabs) || {}
        : { ...(tab && typeof tab === "object" ? tab : {}) };
    const renameState = renameRuntime?.state || {};

    const item = documentObj.createElement("div");
    item.className = "session-tab-item";
    if (summary.isForked) item.classList.add("is-forked");
    if (summary.isActive) item.classList.add("is-active");
    if (summary.isBusy) item.classList.add("is-busy");
    if (summary.isDirty) item.classList.add("is-dirty");
    if (summary.reviewFlowState) item.classList.add(`is-review-${summary.reviewFlowState}`);
    if (summary.showReviewSpinner) item.classList.add("is-review-progress");
    if (summary.isRenaming) item.classList.add("is-renaming");
    item.dataset.tabId = String(summary.tabId || "");
    item.dataset.title = String(summary.title || "");
    item.dataset.runDir = String(summary.runDir || "");
    item.dataset.active = summary.isActive ? "true" : "false";
    item.dataset.busy = summary.isBusy ? "true" : "false";
    item.dataset.dirty = summary.isDirty ? "true" : "false";
    item.dataset.forked = summary.isForked ? "true" : "false";
    item.dataset.canClose = summary.canClose ? "true" : "false";
    item.dataset.reviewFlowState = String(summary.reviewFlowState || "");
    item.dataset.reviewProgress = summary.showReviewSpinner ? "true" : "false";

    if (summary.isRenaming && Number.isFinite(renameState.lockedWidth) && renameState.lockedWidth > 0) {
      const fixedWidth = `${renameState.lockedWidth}px`;
      item.style.width = fixedWidth;
      item.style.minWidth = fixedWidth;
      item.style.maxWidth = fixedWidth;
    }

    if (summary.isRenaming) {
      const renameShell = documentObj.createElement("div");
      renameShell.className = "session-tab-rename-shell";

      const labels = documentObj.createElement("span");
      labels.className = "session-tab-labels";

      const rename = documentObj.createElement("label");
      rename.className = "session-tab-rename";

      const renameRow = documentObj.createElement("span");
      renameRow.className = "session-tab-title-row";

      const input = documentObj.createElement("input");
      input.className = "session-tab-title-input";
      input.type = "text";
      input.value = String(renameState.draft || summary.title || "");
      input.maxLength = maxTitleLength;
      input.placeholder = defaultUntitledTitle;
      input.setAttribute("aria-label", "Rename tab");
      input.spellcheck = false;
      input.autocomplete = "off";
      input.addEventListener("pointerdown", (event) => {
        event.stopPropagation();
      });
      input.addEventListener("click", (event) => {
        event.stopPropagation();
      });
      input.addEventListener("input", () => {
        const next =
          typeof renameRuntime?.updateSessionTabRenameDraft === "function"
            ? renameRuntime.updateSessionTabRenameDraft(input.value)
            : normalizeInput(input.value, maxTitleLength);
        if (input.value !== next) input.value = next;
      });
      input.addEventListener("keydown", (event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          renameRuntime?.commitSessionTabRename?.(summary.tabId, input.value);
          return;
        }
        if (event.key === "Escape") {
          event.preventDefault();
          renameRuntime?.cancelSessionTabRename?.();
        }
      });
      input.addEventListener("blur", () => {
        if (String(renameRuntime?.state?.tabId || "").trim() !== String(summary.tabId || "").trim()) return;
        renameRuntime?.commitSessionTabRename?.(summary.tabId, input.value);
      });

      appendSessionTabTitleRowLead(documentObj, renameRow, summary, renderIconSlot);
      renameRow.append(input);
      rename.append(renameRow);
      labels.append(rename);
      renameShell.append(labels, createSessionTabFlags(documentObj));
      item.append(renameShell);
    } else {
      const hit = documentObj.createElement("button");
      hit.className = "session-tab-hit";
      hit.type = "button";
      hit.setAttribute("role", "tab");
      hit.setAttribute("aria-selected", summary.isActive ? "true" : "false");
      hit.tabIndex = summary.isActive ? 0 : -1;
      hit.title = summary.runDir ? `${summary.title}\n${summary.runDir}` : String(summary.title || "");

      const labels = documentObj.createElement("span");
      labels.className = "session-tab-labels";

      const titleRow = documentObj.createElement("span");
      titleRow.className = "session-tab-title-row";

      const title = documentObj.createElement("span");
      title.className = "session-tab-title";
      title.textContent = String(summary.title || "");
      appendSessionTabTitleRowLead(documentObj, titleRow, summary, renderIconSlot);
      titleRow.append(title);
      labels.append(titleRow);

      const runDir = documentObj.createElement("span");
      runDir.className = "session-tab-run-dir";
      runDir.textContent = String(summary.runDir || "");
      labels.append(runDir);

      hit.append(labels, createSessionTabFlags(documentObj));
      item.append(hit);
    }

    const close = documentObj.createElement("button");
    close.className = "session-tab-close";
    close.type = "button";
    close.setAttribute("aria-label", `Close ${summary.title}`);
    close.title = `Close ${summary.title}`;
    close.hidden = !summary.canClose;
    close.disabled = !summary.canClose;
    close.innerHTML = `
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path
          d="M7 7l10 10M17 7 7 17"
          fill="none"
          stroke="currentColor"
          stroke-width="1.8"
          stroke-linecap="round"
        />
      </svg>
    `;
    item.append(close);
    return item;
  }

  function renderSessionTabStrip(snapshot = null) {
    if (!documentObj || !els?.sessionTabList) return;
    const tabs = Array.isArray(snapshot?.tabs) ? snapshot.tabs : typeof listTabs === "function" ? listTabs() : [];
    const fragment = documentObj.createDocumentFragment ? documentObj.createDocumentFragment() : createFallbackFragment();
    if (!tabs.length) {
      const label = typeof getPlaceholderLabel === "function" ? getPlaceholderLabel() : "No session yet";
      appendChildren(fragment, createSessionTabStripPlaceholderItem(documentObj, label));
    } else {
      for (const tab of tabs) {
        appendChildren(fragment, createSessionTabStripItem(tab, tabs.length));
      }
    }
    els.sessionTabList.replaceChildren(fragment);
    renameRuntime?.focusSessionTabRenameInput?.();
  }

  function installSessionTabStripUi() {
    if (!els?.sessionTabStrip || !els?.sessionTabList) return;
    try {
      renderSessionTabStrip();
    } catch (error) {
      consoleObj?.error?.("Cue tab strip render failed during install:", error);
    }

    if (!releaseSessionTabStripSubscription && typeof subscribeTabs === "function") {
      try {
        releaseSessionTabStripSubscription = subscribeTabs((snapshot) => {
          try {
            renderSessionTabStrip(snapshot);
          } catch (error) {
            consoleObj?.error?.("Cue tab strip render failed during subscription update:", error);
          }
        });
      } catch (error) {
        consoleObj?.error?.("Cue tab strip subscription failed during install:", error);
      }
    }

    if (els.sessionTabList.dataset.bound !== "1") {
      els.sessionTabList.dataset.bound = "1";
      els.sessionTabList.addEventListener("click", (event) => {
        const target = event?.target;
        const title = target?.closest ? target.closest(".session-tab-title") : null;
        if (title && els.sessionTabList.contains(title)) {
          event.preventDefault();
          event.stopPropagation();
          const item = title.closest(".session-tab-item");
          const tabId = String(item?.dataset?.tabId || "").trim();
          if (!tabId) return;
          const isActive = String(item?.dataset?.active || "").trim() === "true";
          if (!isActive) {
            bumpInteraction?.();
            void callMaybePromise(
              () => activateTab?.(tabId),
              (error) => {
                console.error(error);
                showToast?.(error?.message || "Could not switch tabs.", "error", 2600);
              }
            );
            return;
          }
          bumpInteraction?.({ semantic: false });
          renameRuntime?.startSessionTabRename?.(tabId);
          return;
        }

        const closeButton = target?.closest ? target.closest(".session-tab-close") : null;
        if (closeButton && els.sessionTabList.contains(closeButton)) {
          event.preventDefault();
          event.stopPropagation();
          if (closeButton.disabled) return;
          const item = closeButton.closest(".session-tab-item");
          const tabId = String(item?.dataset?.tabId || "").trim();
          if (!tabId) return;
          bumpInteraction?.();
          void callMaybePromise(
            () => closeTab?.(tabId),
            (error) => {
              console.error(error);
              showToast?.(error?.message || "Could not close tab.", "error", 2600);
            }
          );
          return;
        }

        const hit = target?.closest ? target.closest(".session-tab-hit") : null;
        if (!hit || !els.sessionTabList.contains(hit)) return;
        event.preventDefault();
        const item = hit.closest(".session-tab-item");
        const tabId = String(item?.dataset?.tabId || "").trim();
        if (!tabId) return;
        bumpInteraction?.();
        void callMaybePromise(
          () => activateTab?.(tabId),
          (error) => {
            console.error(error);
            showToast?.(error?.message || "Could not switch tabs.", "error", 2600);
          }
        );
      });
    }

    if (els.timelineToggle && els.timelineToggle.dataset.bound !== "1") {
      els.timelineToggle.dataset.bound = "1";
      els.timelineToggle.addEventListener("click", () => {
        bumpInteraction?.();
        onTimelineToggle?.();
      });
    }

    if (els.sessionTabNew && els.sessionTabNew.dataset.bound !== "1") {
      els.sessionTabNew.dataset.bound = "1";
      els.sessionTabNew.addEventListener("click", () => {
        bumpInteraction?.();
        onNewSession?.();
      });
    }

    if (els.sessionTabFork && els.sessionTabFork.dataset.bound !== "1") {
      els.sessionTabFork.dataset.bound = "1";
      els.sessionTabFork.addEventListener("click", () => {
        bumpInteraction?.();
        onForkSession?.();
      });
    }

    if (els.sessionTabDesignReview && els.sessionTabDesignReview.dataset.bound !== "1") {
      els.sessionTabDesignReview.dataset.bound = "1";
      els.sessionTabDesignReview.addEventListener("pointerup", (event) => {
        if (typeof event?.button === "number" && event.button !== 0) return;
        bumpInteraction?.();
        onDesignReviewPointer?.();
      });
      els.sessionTabDesignReview.addEventListener("keydown", (event) => {
        const key = String(event?.key || "");
        if (key !== "Enter" && key !== " " && key !== "Spacebar") return;
        bumpInteraction?.();
        onDesignReviewKeyboard?.();
      });
      els.sessionTabDesignReview.addEventListener("click", () => {
        bumpInteraction?.();
        onDesignReviewClick?.();
      });
    }
  }

  return {
    createSessionTabStripItem,
    createSessionTabStripPlaceholderItem(label = "No session yet") {
      return createSessionTabStripPlaceholderItem(documentObj, label);
    },
    renderSessionTabStrip,
    installSessionTabStripUi,
  };
}
