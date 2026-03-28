# Native Window Polish

Date: 2026-03-08
Branch: `feature/apple-native-window-polish`
Ownership: macOS native titlebar / window-chrome polish

## What This Polish Keeps

- Tauri can do better macOS chrome than CSS alone.
- The chosen path is still AppKit-backed window chrome: a semantic `NSVisualEffectView` behind the native titlebar region plus native `NSWindow` styling.
- The result is a calmer macOS titlebar and traffic-light gutter instead of a broad translucency demo.

## What This Intentionally Avoids

- Inner HTML chrome still depends on frontend transparency and layout decisions outside `desktop/src-tauri/*`.
- The current app body remains visually dominant, so this stays limited to native window chrome.
- Shipping full-window glass would push the shell away from the Apple polish brief and would require coordinated frontend changes anyway.

## Recommendation

Keep this as an optional macOS chrome enhancement.

- Keep: semantic titlebar material, native separator, hidden title, and compact unified toolbar styling.
- Drop for now as a broader shell strategy: full-window transparency and in-app glass should stay out of scope until the frontend is intentionally redesigned for it.
