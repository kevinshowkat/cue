# Today Apple Polish Tasks (Cue)

Historical prompt pack for the Apple-polish wave that followed `feature/design-wave-integration`.

Update the branch names, worktree paths, and mission text before reusing these prompts.

The goal is not "more glass." The goal is a calmer, more premium macOS-first feel:
- closer to a first-party Apple creative utility than a sci-fi dashboard
- fewer visible status systems
- quieter controls
- softer surfaces
- system-native typography and spacing
- clearer hierarchy with less ornament

## Apple Feel Contract
- Visible shell should feel calm, lightweight, and deliberate.
- Replace militarized or HUD-like cues with understated utility.
- Favor system typography over branded or futuristic type.
- Remove bevel-heavy, game-like, or tactical button styling.
- Use neutral frosted materials instead of blue-gray battle-console gradients.
- Reduce visible metrics and status chips to the minimum needed.
- Keep the canvas dominant.
- The shell should feel welcome-screen premium, not operator-console premium.
- Avoid bright accent colors except for sparse state feedback.
- Design for macOS first visually, while keeping cross-platform-safe implementation.

## Coordinator
```text
You are the coordinator for Cue's Apple polish wave.

Read and follow:
1) /Users/mainframe/Desktop/projects/Juggernaut/AGENTS.md
2) /Users/mainframe/Desktop/projects/Juggernaut/PRD.md
3) /Users/mainframe/Desktop/projects/Juggernaut/docs/runbooks/TODAY_APPLE_POLISH_TASKS.md

Hard constraints:
- Work only in /Users/mainframe/Desktop/projects/juggernaut-apple-coordinator
- Branch: feature/apple-polish-coordination
- Own coordination only

Mission:
- enforce the Apple Feel Contract
- prevent overlap
- keep merge order clean:
  1. apple-chrome-structure
  2. apple-runtime-minimalism
  3. apple-surface-reset
  4. apple-rail-controls
  5. optional apple-native-window-polish
- reject any change that still reads like a HUD, RTS, or cockpit UI
- ask every worker for files changed, tests run, blockers, and visual notes
```

## Chrome Structure
```text
You are the chrome-structure agent for Cue's Apple polish wave.

Read and follow:
1) /Users/mainframe/Desktop/projects/Juggernaut/AGENTS.md
2) /Users/mainframe/Desktop/projects/Juggernaut/PRD.md
3) /Users/mainframe/Desktop/projects/Juggernaut/docs/runbooks/TODAY_APPLE_POLISH_TASKS.md

Hard constraints:
- Work only in /Users/mainframe/Desktop/projects/juggernaut-apple-chrome
- Branch: feature/apple-chrome-structure
- Own markup and visible shell structure only
- Primary file: desktop/src/index.html

Build:
- simplify the top strip and stage header
- reduce visible status affordances
- make the brand strip feel closer to a native app toolbar
- demote or remove visible metrics from the default shell
- keep accessibility metadata even when visible text is reduced
```

## Surface Reset
```text
You are the surface-reset agent for Cue's Apple polish wave.

Read and follow:
1) /Users/mainframe/Desktop/projects/Juggernaut/AGENTS.md
2) /Users/mainframe/Desktop/projects/Juggernaut/PRD.md
3) /Users/mainframe/Desktop/projects/Juggernaut/docs/runbooks/TODAY_APPLE_POLISH_TASKS.md

Hard constraints:
- Work only in /Users/mainframe/Desktop/projects/juggernaut-apple-surface
- Branch: feature/apple-surface-reset
- Own visual tokens, typography, materials, color, and spacing only
- Primary files:
  - desktop/src/juggernaut_shell/visual_system.css
  - desktop/src/styles.css

Build:
- replace the current glass treatment with a quieter Apple-like material language
- remove tactical gradients, bright steel blues, and heavy shadows
- switch shell typography toward system UI conventions
- use restrained translucency and softer borders
- make buttons and panels feel milled and native, not gamified
```

## Rail Controls
```text
You are the rail-controls agent for Cue's Apple polish wave.

Read and follow:
1) /Users/mainframe/Desktop/projects/Juggernaut/AGENTS.md
2) /Users/mainframe/Desktop/projects/Juggernaut/PRD.md
3) /Users/mainframe/Desktop/projects/Juggernaut/docs/runbooks/TODAY_APPLE_POLISH_TASKS.md

Hard constraints:
- Work only in /Users/mainframe/Desktop/projects/juggernaut-apple-rail
- Branch: feature/apple-rail-controls
- Own left-rail control feel and button presentation only
- Primary files:
  - desktop/src/juggernaut_shell/rail.js
  - desktop/src/juggernaut_shell/visual_system.css

Build:
- keep the custom icons
- make rail buttons feel softer, calmer, and more native
- reduce visual weight of idle buttons
- make active state subtle and premium, not glowing or combat-ready
```

## Runtime Minimalism
```text
You are the runtime-minimalism agent for Cue's Apple polish wave.

Read and follow:
1) /Users/mainframe/Desktop/projects/Juggernaut/AGENTS.md
2) /Users/mainframe/Desktop/projects/Juggernaut/PRD.md
3) /Users/mainframe/Desktop/projects/Juggernaut/docs/runbooks/TODAY_APPLE_POLISH_TASKS.md

Hard constraints:
- Work only in /Users/mainframe/Desktop/projects/juggernaut-apple-runtime
- Branch: feature/apple-runtime-minimalism
- Own default visibility and runtime-exposed chrome only
- Primary file: desktop/src/canvas_app.js

Build:
- further suppress metrics, engine dots, and debug-like affordances by default
- keep diagnostics reachable, but not visible on first launch
- preserve today's functional slice
- bias toward an empty, calm first impression
```

## Optional Native Window Polish
```text
You are the native-window-polish agent for Cue's Apple polish wave.

Read and follow:
1) /Users/mainframe/Desktop/projects/Juggernaut/AGENTS.md
2) /Users/mainframe/Desktop/projects/Juggernaut/PRD.md
3) /Users/mainframe/Desktop/projects/Juggernaut/docs/runbooks/TODAY_APPLE_POLISH_TASKS.md

Hard constraints:
- Work only in /Users/mainframe/Desktop/projects/juggernaut-apple-native
- Branch: feature/apple-native-window-polish
- Own only Tauri/macOS window polish
- Primary files: desktop/src-tauri/*

Build:
- refine the native glass spike only if it supports the Apple Feel Contract
- prefer subtle titlebar and window treatment over flashy transparency
- do not expand scope into frontend restyling
```
