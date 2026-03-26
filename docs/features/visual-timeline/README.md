# Visual Timeline

## Purpose
Juggernaut's timeline is a first-class, tab-local session history for a run. It records committed visible state changes, lets the user jump to any recorded state in either direction, and persists that state across save/reopen without re-running model work.

This replaces the earlier lineage-overlay concept that swapped image paths in place.

## UX
- The timeline is a compact horizontal dock under the tab strip.
- Nodes stay in chronological order even after the user rewinds to an older head.
- Image-result steps render thumbnail cards.
- Session-state steps render action glyphs for moves, marks, protect, magic select, erase, annotate, circle, delete, and related local mutations.
- When the tray overflows, fixed left/right arrow buttons appear at the outer edges and advance the carousel by page-sized steps.
- The current state summary is rendered under the strip instead of to its side.
- Hovering or focusing a card previews the state you would change to in the detail line under the strip.
- The selected head node is highlighted.
- Future nodes remain visible and clickable after rewind.
- Clicking the current head is a no-op.

## Persistence Contract
- Run directories persist timeline state in `session-timeline.json`.
- The file records `schemaVersion`, `runDir`, `headNodeId`, `latestNodeId`, `nextSeq`, `updatedAt`, and `nodes`.
- Each node carries chronological metadata plus the full restorable snapshot needed to rebuild the tab-local session state for that step.
- Timeline persistence is the primary open-run restore path when the file exists.
- `Save Session` writes both the session snapshot and the canonical timeline file.

Primary files:
- `desktop/src/session_timeline.js`
- `desktop/src/session_snapshot.js`
- `desktop/src/canvas_app.js`
- `desktop/src/index.html`
- `desktop/src/styles.css`

## Snapshot / Restore Model
- `captureSessionTimelineSnapshot()` captures the committed session state needed for exact replay.
- `restoreSessionTimelineSnapshot()` rebuilds the session from a recorded node snapshot.
- `jumpToTimelineNode(nodeId)` restores the chosen snapshot, updates the active tab session, rerenders dependent shell surfaces, and persists the new head pointer.
- Restore is blocked only for active unsafe mutations such as live pointer gestures or an in-flight accepted review apply.
- Timeline restore never requires a network call.

## Recording Rules
The timeline records one logical node per committed user-visible change, including:

- imports and added image artifacts
- delete image
- move, resize, rotate, and skew commits
- mark, protect, erase mark, erase region, magic select, annotate box, and circle commits
- accepted design review apply results
- prompt-generate, recast, bridge/combine-style model results, and other image-result commits
- local deterministic artifact saves that change visible canvas state

Internal cleanup that does not change visible state is not recorded as its own node.

## Export / Reopen Behavior
- Opening an existing run restores from `session-timeline.json` first, then falls back to older session/receipt recovery paths only when timeline data is absent or unreadable.
- Export uses the currently selected timeline head, not automatically the latest node.
- PSD export requests and export receipts carry the timeline schema version and current head node id.

## Testing
Regression coverage lives in:
- `desktop/test/session_timeline.test.js`
- `desktop/test/session_snapshot.test.js`
- `desktop/test/juggernaut_launch_slice_flow.test.js`
- `desktop/test/tabbed_sessions_v1_contract.test.js`
- `desktop/test/tab_spawn_engine_regression.test.js`
- `desktop/test/observable_agent_replay_flows.test.js`
- `desktop/test/communication_marker_regression.test.js`

Key scenarios covered:
- snapshot capture / restore roundtrip
- backward and forward node jumps
- restoring earlier import states and later annotation states
- session reopen from persisted timeline data
- export metadata tied to the current head
