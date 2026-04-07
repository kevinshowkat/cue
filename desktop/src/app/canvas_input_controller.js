import { installCanvasGestureHandlers } from "../canvas_handlers/gesture_handlers.js";
import { installCanvasInputHandlers } from "../canvas_handlers/install_canvas_input_handlers.js";

export function installCanvasHandlers({
  els,
  state,
  pointer = null,
  keyboard = null,
  wheel = null,
  gestures = null,
  motherRolePreview = null,
  installCanvasInputHandlersImpl = installCanvasInputHandlers,
  installCanvasGestureHandlersImpl = installCanvasGestureHandlers,
} = {}) {
  if (!els?.overlayCanvas) return;

  const preview = els.motherRolePreview;
  if (motherRolePreview && preview && preview.dataset.liveTetherHoverBound !== "1") {
    preview.dataset.liveTetherHoverBound = "1";
    preview.addEventListener("pointermove", motherRolePreview.onPointerMove);
    preview.addEventListener("pointerleave", motherRolePreview.onPointerLeave);
    preview.addEventListener("pointerdown", motherRolePreview.onPointerDown);
  }

  if (pointer || keyboard) {
    installCanvasInputHandlersImpl(els.overlayCanvas, {
      pointer,
      keyboard,
    });
  }

  if (wheel) {
    installCanvasInputHandlersImpl(els.overlayCanvas, {
      wheel,
    });
  }

  if (!gestures) return;
  if (!state.gestureZoom) state.gestureZoom = { active: false, lastScale: 1 };
  try {
    installCanvasGestureHandlersImpl(els.overlayCanvas, gestures);
  } catch {
    // ignore
  }
}
