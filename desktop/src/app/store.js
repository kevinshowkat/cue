export function createCanvasAppStore(initialState = {}) {
  let state = initialState;
  const listeners = new Set();

  function emit() {
    for (const listener of listeners) {
      listener(state);
    }
  }

  return {
    getState() {
      return state;
    },
    setState(nextState) {
      state = typeof nextState === "function" ? nextState(state) : nextState;
      emit();
      return state;
    },
    patchState(nextPatch = {}) {
      state = {
        ...(state && typeof state === "object" ? state : {}),
        ...(nextPatch && typeof nextPatch === "object" ? nextPatch : {}),
      };
      emit();
      return state;
    },
    subscribe(listener) {
      if (typeof listener !== "function") return () => {};
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}
