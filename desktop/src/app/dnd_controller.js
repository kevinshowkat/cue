export function installDnD({
  els,
  state,
  canvasScreenCssToWorldCss,
  normalizeLocalFsPath,
  isBrowserImagePath,
  importLocalPathsAtCanvasPoint,
  showToast,
  fileBrowserSetDragPath,
  fileBrowserReadInternalDragPath,
  fileBrowserClearDragPathDeferred,
  bumpInteraction,
  canvasCssPointFromEvent,
  ENABLE_DRAG_DROP_IMPORT,
  windowTarget = typeof window !== "undefined" ? window : null,
} = {}) {
  if (!els?.canvasWrap) return;

  // Even when drag/drop import is disabled, we must still prevent the WebView's
  // default file-drop navigation (which can wipe the current session/run).
  const preventNav = (event) => {
    if (!event) return;
    event.preventDefault();
  };

  const canvasWorldPointFromClient = (clientX, clientY) => {
    const wrapRect = els.canvasWrap?.getBoundingClientRect?.();
    if (!wrapRect || !Number.isFinite(clientX) || !Number.isFinite(clientY)) return null;
    if (clientX < wrapRect.left || clientX > wrapRect.right || clientY < wrapRect.top || clientY > wrapRect.bottom) {
      return null;
    }
    const overlayRect = els.overlayCanvas?.getBoundingClientRect?.() || wrapRect;
    const css = { x: clientX - overlayRect.left, y: clientY - overlayRect.top };
    return canvasScreenCssToWorldCss(css);
  };

  const tryImportInternalDragAtClient = async (clientX, clientY, { source = "browser_drag_fallback" } = {}) => {
    const path = normalizeLocalFsPath(state.fileBrowser?.draggingPath || "");
    if (!path || !isBrowserImagePath(path)) return false;
    const world = canvasWorldPointFromClient(clientX, clientY);
    if (!world) return false;
    const result = await importLocalPathsAtCanvasPoint([path], world, {
      source,
      idPrefix: "dockdrop",
      enforceIntentLimit: true,
      focusImported: true,
    });
    if (!result?.ok) {
      showToast("Could not import dropped image.", "error", 2600);
      return false;
    }
    fileBrowserSetDragPath(null);
    return true;
  };

  let lastInternalImportAt = 0;
  try {
    windowTarget?.addEventListener("dragover", preventNav, { passive: false });
    windowTarget?.addEventListener(
      "drop",
      (event) => {
        preventNav(event);
        const now = Date.now();
        if (now - lastInternalImportAt < 500) {
          fileBrowserSetDragPath(null);
          return;
        }
        const clientX = Number(event?.clientX);
        const clientY = Number(event?.clientY);
        if (!Number.isFinite(clientX) || !Number.isFinite(clientY)) {
          fileBrowserSetDragPath(null);
          return;
        }
        tryImportInternalDragAtClient(clientX, clientY, { source: "browser_drag_window" }).catch(() => {});
      },
      { passive: false }
    );
  } catch {
    // ignore
  }

  function stop(event) {
    preventNav(event);
    event?.stopPropagation?.();
  }

  let browserDragDepth = 0;
  const setBrowserDragHover = (on) => {
    els.canvasWrap.classList.toggle("is-browser-drag-over", Boolean(on));
  };
  const clearBrowserDragHover = () => {
    browserDragDepth = 0;
    setBrowserDragHover(false);
  };

  try {
    windowTarget?.addEventListener("dragend", clearBrowserDragHover, { passive: true });
    windowTarget?.addEventListener(
      "dragend",
      (event) => {
        const clientX = Number(event?.clientX);
        const clientY = Number(event?.clientY);
        if (!Number.isFinite(clientX) || !Number.isFinite(clientY)) {
          fileBrowserClearDragPathDeferred(120);
          return;
        }
        tryImportInternalDragAtClient(clientX, clientY, { source: "browser_drag_end" })
          .catch(() => {})
          .finally(() => {
            fileBrowserClearDragPathDeferred(120);
          });
      },
      { passive: true }
    );
    windowTarget?.addEventListener("drop", clearBrowserDragHover, { passive: false });
  } catch {
    // ignore
  }

  const handleDragEnter = (event) => {
    stop(event);
    const internalPath = fileBrowserReadInternalDragPath(event?.dataTransfer);
    if (internalPath) {
      browserDragDepth += 1;
      setBrowserDragHover(true);
    }
  };
  const handleDragLeave = (event) => {
    stop(event);
    const internalPath = fileBrowserReadInternalDragPath(event?.dataTransfer);
    if (!internalPath) return;
    browserDragDepth = Math.max(0, browserDragDepth - 1);
    if (!browserDragDepth) setBrowserDragHover(false);
  };
  const handleDragOver = (event) => {
    stop(event);
    const internalPath = fileBrowserReadInternalDragPath(event?.dataTransfer);
    if (internalPath) {
      if (event?.dataTransfer) event.dataTransfer.dropEffect = "copy";
      setBrowserDragHover(true);
    }
  };

  let disabledToastAt = 0;
  const handleDrop = async (event) => {
    stop(event);
    clearBrowserDragHover();
    bumpInteraction();
    const internalPath = fileBrowserReadInternalDragPath(event?.dataTransfer);
    if (internalPath) {
      const world = canvasScreenCssToWorldCss(canvasCssPointFromEvent(event));
      lastInternalImportAt = Date.now();
      const result = await importLocalPathsAtCanvasPoint([internalPath], world, {
        source: "browser_drag",
        idPrefix: "dockdrop",
        enforceIntentLimit: true,
        focusImported: true,
      });
      if (!result?.ok) {
        showToast("Could not import dropped image.", "error", 2600);
      }
      fileBrowserSetDragPath(null);
      return;
    }
    fileBrowserSetDragPath(null);
    const files = Array.from(event.dataTransfer?.files || []);
    const paths = files.map((f) => f?.path).filter(Boolean);
    if (paths.length === 0) return;
    if (!ENABLE_DRAG_DROP_IMPORT) {
      const now = Date.now();
      if (!disabledToastAt || now - disabledToastAt > 3500) {
        disabledToastAt = now;
        showToast("Drag/drop disabled. Click anywhere to add a photo.", "tip", 2400);
      }
      return;
    }
    const world = canvasScreenCssToWorldCss(canvasCssPointFromEvent(event));
    await importLocalPathsAtCanvasPoint(paths, world, {
      source: "drop",
      idPrefix: "drop",
      enforceIntentLimit: true,
    });
  };

  const dndTargets = [els.canvasWrap, els.overlayCanvas].filter(Boolean);
  for (const target of dndTargets) {
    target.addEventListener("dragenter", handleDragEnter, { passive: false });
    target.addEventListener("dragleave", handleDragLeave, { passive: false });
    target.addEventListener("dragover", handleDragOver, { passive: false });
    target.addEventListener("drop", (event) => {
      handleDrop(event).catch((err) => console.error(err));
    });
  }
}
