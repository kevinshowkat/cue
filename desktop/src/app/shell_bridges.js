function cloneRailItems(items = []) {
  return Array.isArray(items) ? items.map((item) => ({ ...item })) : [];
}

function exposeLegacyCanvasAppGlobalBridges({
  windowObj = typeof window !== "undefined" ? window : null,
  state = {},
  applyJuggernautTool = null,
  exportJuggernautPsd = null,
} = {}) {
  if (!windowObj || typeof windowObj !== "object") return null;
  windowObj.applyJuggernautTool = applyJuggernautTool;
  windowObj.exportJuggernautPsd = exportJuggernautPsd;
  windowObj.__juggernautShell = {
    state: state.juggernautShell,
    applyJuggernautTool,
    exportJuggernautPsd,
  };
  if (windowObj.__JUGGERNAUT_SHELL__ && typeof windowObj.__JUGGERNAUT_SHELL__ === "object") {
    windowObj.__JUGGERNAUT_SHELL__.applyJuggernautTool = applyJuggernautTool;
    windowObj.__JUGGERNAUT_SHELL__.exportJuggernautPsd = exportJuggernautPsd;
  }
  return windowObj.__juggernautShell;
}

function registerBridgeHook(target, key, render) {
  return (fn) => {
    target[key] = typeof fn === "function" ? fn : null;
    render?.();
    return () => {
      if (target[key] === fn) {
        target[key] = null;
        render?.();
      }
    };
  };
}

export function installLegacyCanvasAppBridges({
  windowObj = typeof window !== "undefined" ? window : null,
  state = {},
  JUGGERNAUT_SHELL_BRIDGE_VERSION = "",
  JUGGERNAUT_SHELL_RAIL_CONTRACT = "",
  JUGGERNAUT_SHELL_RAIL = [],
  runtimeChromeVisibilitySnapshot = null,
  applyJuggernautTool = null,
  exportJuggernautPsd = null,
  renderQuickActions = null,
  renderJuggernautShellChrome = null,
  invokeJuggernautShellTool = null,
  requestJuggernautExport = null,
  requestJuggernautPsdExport = null,
  importPhotos = null,
  listTabs = null,
  createRun = null,
  openExistingRun = null,
  activateTab = null,
  closeTab = null,
  subscribeTabs = null,
  buildJuggernautShellContext = null,
  buildCommunicationReviewPayload = null,
  buildCommunicationBridgeSnapshot = null,
  buildAgentRunnerBridgeSnapshot = null,
  showAgentRunnerPanel = null,
  hideAgentRunnerPanel = null,
  agentRunnerActive = null,
  requestCommunicationDesignReview = null,
  setCommunicationProposalTray = null,
  hideCommunicationProposalTray = null,
  setCommunicationTool = null,
  setRuntimeChromeVisibility = null,
  AGENT_RUNNER_BRIDGE_KEY = "",
  installTabbedSessionsBridge = null,
  dispatchJuggernautShellEvent = null,
  singleImageRailRecentSuccessfulJobs = null,
} = {}) {
  if (!windowObj || typeof windowObj !== "object") return null;

  const shellBridge = {
    version: JUGGERNAUT_SHELL_BRIDGE_VERSION,
    railContract: JUGGERNAUT_SHELL_RAIL_CONTRACT,
    rail: cloneRailItems(JUGGERNAUT_SHELL_RAIL),
    singleImageRail: {
      contract: state.juggernautShell.singleImageRail.contract,
      adapter: { ...state.juggernautShell.singleImageRail.adapter },
      mock: Boolean(state.juggernautShell.singleImageRail.mock),
      recentSuccessfulJobs: singleImageRailRecentSuccessfulJobs?.() || [],
    },
    runtimeVisibility: runtimeChromeVisibilitySnapshot?.(),
    applyJuggernautTool,
    exportJuggernautPsd,
    registerToolInvoker: registerBridgeHook(state.juggernautShell, "toolInvoker", renderQuickActions),
    registerSingleImageRailRanker: registerBridgeHook(
      state.juggernautShell.singleImageRail,
      "ranker",
      renderQuickActions
    ),
    registerPsdExportHandler: registerBridgeHook(
      state.juggernautShell,
      "psdExportHandler",
      renderJuggernautShellChrome
    ),
    requestToolInvocation(toolKey, meta = {}) {
      return invokeJuggernautShellTool?.(toolKey, meta) ?? false;
    },
    requestExport(meta = {}) {
      return requestJuggernautExport?.(meta) ?? false;
    },
    requestPsdExport(meta = {}) {
      return requestJuggernautPsdExport?.(meta) ?? false;
    },
    getRuntimeVisibility() {
      return runtimeChromeVisibilitySnapshot?.() ?? null;
    },
    setRuntimeVisibility(next = {}) {
      return setRuntimeChromeVisibility?.(next, { source: "bridge" }) ?? null;
    },
    importImages() {
      return importPhotos?.() ?? false;
    },
    listTabs,
    createNewRunTab() {
      return createRun?.() ?? false;
    },
    openRunTab() {
      return openExistingRun?.() ?? false;
    },
    activateTab,
    closeTab,
    subscribeTabs,
    getCanvasSnapshot() {
      return buildJuggernautShellContext?.() ?? null;
    },
    getCommunicationReviewPayload(meta = {}) {
      return buildCommunicationReviewPayload?.(meta) ?? null;
    },
    agentRunnerBridgeKey: AGENT_RUNNER_BRIDGE_KEY,
    openAgentRunner() {
      return showAgentRunnerPanel?.({
        focusGoal: !agentRunnerActive?.(),
        expand: false,
      });
    },
    closeAgentRunner() {
      return hideAgentRunnerPanel?.() ?? false;
    },
    getAgentRunnerState() {
      return buildAgentRunnerBridgeSnapshot?.() ?? null;
    },
    requestDesignReview(meta = {}) {
      return requestCommunicationDesignReview?.(meta) ?? false;
    },
    showCommunicationProposalTray(next = {}) {
      return setCommunicationProposalTray?.(next, { source: "bridge" }) ?? false;
    },
    hideCommunicationProposalTray(meta = {}) {
      return hideCommunicationProposalTray?.({ ...meta, source: "bridge" }) ?? false;
    },
    setCommunicationTool(tool = null) {
      return setCommunicationTool?.(tool, { source: "bridge" }) ?? false;
    },
    communicationReview: {
      state: buildCommunicationBridgeSnapshot?.() ?? null,
      getState() {
        return buildCommunicationBridgeSnapshot?.() ?? null;
      },
      getPayload(meta = {}) {
        return buildCommunicationReviewPayload?.(meta) ?? null;
      },
      request(meta = {}) {
        return requestCommunicationDesignReview?.(meta) ?? false;
      },
      showTray(next = {}) {
        return setCommunicationProposalTray?.(next, { source: "bridge_nested" }) ?? false;
      },
      hideTray(meta = {}) {
        return hideCommunicationProposalTray?.({ ...meta, source: "bridge_nested" }) ?? false;
      },
      setTool(tool = null) {
        return setCommunicationTool?.(tool, { source: "bridge_nested" }) ?? false;
      },
    },
  };

  windowObj.__JUGGERNAUT_SHELL__ = shellBridge;
  installTabbedSessionsBridge?.(shellBridge);
  windowObj.__JUGGERNAUT_RUNTIME_FLAGS__ = {
    getRuntimeVisibility() {
      return runtimeChromeVisibilitySnapshot?.() ?? null;
    },
    setRuntimeVisibility(next = {}) {
      return setRuntimeChromeVisibility?.(next, { source: "bridge" }) ?? null;
    },
  };

  exposeLegacyCanvasAppGlobalBridges({
    windowObj,
    state,
    applyJuggernautTool,
    exportJuggernautPsd,
  });

  dispatchJuggernautShellEvent?.("juggernaut:shell-ready", {
    version: JUGGERNAUT_SHELL_BRIDGE_VERSION,
    railContract: JUGGERNAUT_SHELL_RAIL_CONTRACT,
    rail: cloneRailItems(JUGGERNAUT_SHELL_RAIL),
    context: buildJuggernautShellContext?.() ?? null,
  });

  return shellBridge;
}

export { exposeLegacyCanvasAppGlobalBridges };
