import { installCanvasKeyboardHandlers } from "./keyboard_handlers.js";
import { installCanvasPointerHandlers } from "./pointer_handlers.js";
import { installCanvasWheelHandlers } from "./wheel_handlers.js";

export function installCanvasInputHandlers(
  target,
  {
    pointer = null,
    keyboard = null,
    wheel = null,
  } = {}
) {
  if (!target) return;
  if (pointer) installCanvasPointerHandlers(target, pointer);
  if (keyboard) installCanvasKeyboardHandlers(target, keyboard);
  if (wheel) installCanvasWheelHandlers(target, wheel);
}
