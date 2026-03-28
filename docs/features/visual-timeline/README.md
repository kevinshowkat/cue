# Visual Timeline

The visual timeline is the saved history for one session tab.

## What It Does

- records committed visible changes
- lets the user jump backward or forward in that history
- survives save and reopen without rerunning earlier work

## Stored Data

- timeline state is written to `session-timeline.json`
- each node stores enough snapshot data to restore the session
- export uses the currently selected timeline head

## Main Files

- `desktop/src/session_timeline.js`
- `desktop/src/session_snapshot.js`
- `desktop/src/canvas_app.js`
- `desktop/src/index.html`
- `desktop/src/styles.css`
