export function renderJuggernautShellChrome(host = {}) {
  const {
    ACTION_PROVENANCE,
    actionElementProvenance,
    appendActionProvenanceDescription,
    basename,
    closeJuggernautExportMenu,
    els,
    exportFormatTitle,
    exportFormatUnavailableMessage,
    getActiveImage,
    getSelectedIds,
    isJuggernautExportMenuOpen,
    juggernautToolButtons,
    nativeRasterExportReady,
    renderAgentRunnerActivityChrome,
    resolveActionProvenance,
    state,
    syncActionProvenanceBadge,
    syncJuggernautShellIconography,
    syncRuntimeStatusAffordances,
    syncTimelineDockVisibility,
  } = host;

  const activeImage = getActiveImage();
  const selectedIds = getSelectedIds();
  const emptyCanvas = state.images.length === 0;
  syncJuggernautShellIconography();
  if (els.juggernautSelectionStatus) {
    if (emptyCanvas) {
      els.juggernautSelectionStatus.textContent = "Drop an image to begin";
    } else if (activeImage) {
      const dims =
        activeImage.width && activeImage.height ? ` · ${activeImage.width}x${activeImage.height}` : "";
      const multi = selectedIds.length > 1 ? ` · ${selectedIds.length} selected` : "";
      els.juggernautSelectionStatus.textContent = `${basename(activeImage.path) || "Image"}${dims}${multi}`;
    } else {
      els.juggernautSelectionStatus.textContent = `${state.images.length} image${state.images.length === 1 ? "" : "s"} on canvas`;
    }
  }
  syncRuntimeStatusAffordances();
  syncTimelineDockVisibility();

  const toolHookReady = typeof state.juggernautShell.toolInvoker === "function";
  const customPsdExportReady = typeof state.juggernautShell.psdExportHandler === "function";
  const nativeExportReady = nativeRasterExportReady();
  const psdExportReady = customPsdExportReady || nativeExportReady;
  const exportMenuReady = psdExportReady;
  const exportToggleReady = !emptyCanvas && exportMenuReady;
  renderAgentRunnerActivityChrome();
  if (els.juggernautExportPsd) {
    if (!exportToggleReady && isJuggernautExportMenuOpen()) {
      closeJuggernautExportMenu();
    }
    const exportTitleBase = emptyCanvas
      ? "Upload an image before exporting"
      : exportMenuReady
        ? "Export"
        : "Export is unavailable in this runtime";
    const exportTitle = appendActionProvenanceDescription(exportTitleBase, ACTION_PROVENANCE.LOCAL_ONLY);
    syncActionProvenanceBadge(els.juggernautExportPsd, ACTION_PROVENANCE.LOCAL_ONLY);
    els.juggernautExportPsd.disabled = !exportToggleReady;
    els.juggernautExportPsd.title = exportTitle;
    els.juggernautExportPsd.setAttribute("aria-label", exportTitle);
    els.juggernautExportPsd.setAttribute("aria-disabled", exportToggleReady ? "false" : "true");
    els.juggernautExportPsd.setAttribute("aria-expanded", exportToggleReady && isJuggernautExportMenuOpen() ? "true" : "false");
    els.juggernautExportPsd.classList.toggle("is-open", isJuggernautExportMenuOpen());
    els.juggernautExportPsd.classList.toggle("is-ready", exportToggleReady);
    els.juggernautExportPsd.classList.toggle("is-pending-hook", !emptyCanvas && !exportMenuReady);
  }
  if (els.juggernautExportFormatPsd) {
    const psdTitle = emptyCanvas
      ? "Upload an image before exporting PSD"
      : psdExportReady
        ? exportFormatTitle("psd")
        : exportFormatUnavailableMessage("psd");
    els.juggernautExportFormatPsd.disabled = emptyCanvas || !psdExportReady;
    els.juggernautExportFormatPsd.title = psdTitle;
    els.juggernautExportFormatPsd.setAttribute("aria-label", psdTitle);
    els.juggernautExportFormatPsd.classList.toggle("is-pending-hook", !emptyCanvas && !psdExportReady);
  }
  if (els.juggernautExportFormatPng) {
    const pngTitle = emptyCanvas
      ? "Upload an image before exporting PNG"
      : nativeExportReady
        ? exportFormatTitle("png")
        : exportFormatUnavailableMessage("png");
    els.juggernautExportFormatPng.disabled = emptyCanvas || !nativeExportReady;
    els.juggernautExportFormatPng.title = pngTitle;
    els.juggernautExportFormatPng.setAttribute("aria-label", pngTitle);
    els.juggernautExportFormatPng.classList.toggle("is-pending-hook", !emptyCanvas && !nativeExportReady);
  }
  if (els.juggernautExportFormatJpg) {
    const jpgTitle = emptyCanvas
      ? "Upload an image before exporting JPG"
      : nativeExportReady
        ? exportFormatTitle("jpg")
        : exportFormatUnavailableMessage("jpg");
    els.juggernautExportFormatJpg.disabled = emptyCanvas || !nativeExportReady;
    els.juggernautExportFormatJpg.title = jpgTitle;
    els.juggernautExportFormatJpg.setAttribute("aria-label", jpgTitle);
    els.juggernautExportFormatJpg.classList.toggle("is-pending-hook", !emptyCanvas && !nativeExportReady);
  }
  if (els.juggernautExportFormatWebp) {
    const webpTitle = emptyCanvas
      ? "Upload an image before exporting WEBP"
      : nativeExportReady
        ? exportFormatTitle("webp")
        : exportFormatUnavailableMessage("webp");
    els.juggernautExportFormatWebp.disabled = emptyCanvas || !nativeExportReady;
    els.juggernautExportFormatWebp.title = webpTitle;
    els.juggernautExportFormatWebp.setAttribute("aria-label", webpTitle);
    els.juggernautExportFormatWebp.classList.toggle("is-pending-hook", !emptyCanvas && !nativeExportReady);
  }
  if (els.juggernautExportFormatTiff) {
    const tiffTitle = emptyCanvas
      ? "Upload an image before exporting TIFF"
      : nativeExportReady
        ? exportFormatTitle("tiff")
        : exportFormatUnavailableMessage("tiff");
    els.juggernautExportFormatTiff.disabled = emptyCanvas || !nativeExportReady;
    els.juggernautExportFormatTiff.title = tiffTitle;
    els.juggernautExportFormatTiff.setAttribute("aria-label", tiffTitle);
    els.juggernautExportFormatTiff.classList.toggle("is-pending-hook", !emptyCanvas && !nativeExportReady);
  }
  if (els.sessionTabDesignReview) {
    const reviewTitle = appendActionProvenanceDescription("Design Review", ACTION_PROVENANCE.EXTERNAL_MODEL);
    syncActionProvenanceBadge(els.sessionTabDesignReview, ACTION_PROVENANCE.EXTERNAL_MODEL);
    els.sessionTabDesignReview.title = reviewTitle;
    els.sessionTabDesignReview.setAttribute("aria-label", reviewTitle);
  }

  for (const btn of juggernautToolButtons()) {
    const key = String(btn.dataset?.toolId || btn.dataset?.toolKey || "").trim();
    const disabledReason = String(btn.dataset?.disabledReason || "").trim();
    const provenance = actionElementProvenance(
      btn,
      resolveActionProvenance({
        capability: btn.dataset?.capability || "",
      })
    );
    const isLocalOnly = provenance === ACTION_PROVENANCE.LOCAL_ONLY;
    const isPending = provenance === ACTION_PROVENANCE.EXTERNAL_MODEL && disabledReason === "capability_unavailable" && !toolHookReady;
    btn.classList.toggle("is-local-utility", isLocalOnly);
    btn.classList.toggle("is-local-first", provenance === ACTION_PROVENANCE.LOCAL_FIRST);
    btn.classList.toggle("is-ai-tool", provenance === ACTION_PROVENANCE.EXTERNAL_MODEL);
    btn.classList.toggle("is-active-request", String(state.juggernautShell.lastToolKey || "") === key);
    btn.classList.toggle("is-pending-hook", isPending);
    btn.classList.toggle(
      "is-selection-empty",
      disabledReason === "selection_required" || (key === "select" && disabledReason === "unavailable_in_current_mode")
    );
  }
}

export function renderCommunicationChrome(host = {}) {
  const {
    renderCommunicationRail,
    renderCommunicationProposalTray,
    renderCommunicationStampPicker,
    syncCommunicationCanvasCursor,
    syncJuggernautShellState,
  } = host;

  renderCommunicationRail();
  renderCommunicationStampPicker();
  renderCommunicationProposalTray();
  syncCommunicationCanvasCursor();
  if (typeof window !== "undefined") {
    syncJuggernautShellState();
  }
}
