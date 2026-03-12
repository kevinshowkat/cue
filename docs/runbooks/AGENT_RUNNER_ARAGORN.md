# Agent Runner Aragorn Pack

Use this pack to test the first-class `Agent Run` surface against the local Aragorn fixture at:

- relative path: `images/aragorn.jpg`
- absolute path: `/Users/mainframe/Desktop/projects/Juggernaut/images/aragorn.jpg`

Important:
- `aragorn.jpg` is currently a local untracked fixture, not a tracked repo asset.
- the clean worktree used for code changes will not contain this file unless you copy it in yourself
- the easiest way to run these tests is from the main Juggernaut checkout, where the file already exists
- the companion machine-readable cases live in `docs/runbooks/agent_runner_aragorn_goals.json`

## Setup

1. Launch Juggernaut from the main checkout.
2. Import `/Users/mainframe/Desktop/projects/Juggernaut/images/aragorn.jpg` into the canvas.
3. Keep Aragorn as the only image on canvas for the cleanest run, or make sure Aragorn is the active image if other images are present.
4. Open `Agent Run` from the top-right shell action. It now opens as a compact card tucked tight to the tab bar, clearing the titlebar shadow while keeping the panel title fully visible, with the goal field and icon-only `Submit`, `Expand`, and `Close` controls.
5. If you need planner controls, click `Expand` to open the full Agent Run menu.
6. Set:
   - `Planner`: `Auto`
   - `Max Steps`: `4` for step-by-step testing or `6` for short auto runs
7. Start with `Step`, not `Auto`.

## Goal Contract Flow

Agent Run now compiles the typed goal into a first-class goal contract with `gpt-5.4` before it plans the first step.

- `hard requirements`
  - visually checkable obligations like named people, required objects, interactions, scene/domain cues, and explicit preserve rules
- `soft intents`
  - style, tone, humor, or vibe directions that guide planning but do not block stop
- `forbidden shortcuts`
  - weak proxies like `style_only`, `palette_only`, `prop_only`, or `single_subject_only` when the goal would be falsely satisfied by them

Important:

- Agent Run now checks the visible canvas against that goal contract before allowing `stop` or `Export PSD`.
- If a required named person or interaction is still missing, the run should continue instead of stopping cleanly.
- Weird or vibe-heavy goals should compile to sparse hard requirements and richer soft intents rather than becoming over-constrained.

## Current Limitation

The current Agent Run planner can directly plan:

- `marker_stroke`
- `magic_select_click`
- `eraser_stroke`
- `request_design_review`
- `accept_review_proposal`
- seeded single-image tools
- direct affordances like `remove_people`, `polish`, and `relight`
- `preview_create_tool`
- `create_tool`
- `export_psd`

It does not yet plan `protect` or `make_space` directly. If you want to test those, pre-place them yourself, then let Agent Run continue from that scoped state.

Also note:

- Design Review remains goal-blind and sees only the visible canvas plus visible marks and selections.
- Multi-image interaction goals can still outrun the current single-target review/apply path, so the goal contract mainly improves routing, proposal judgment, and stop behavior rather than magically adding full compositing capability.

## Test Cases

### 1. Review-First Hero Polish

Goal:

`Use design review to find one strong improvement that makes Aragorn feel more cinematic while preserving his face, armor, sword, and horse, then export a PSD.`

What to look for:

- good first move:
  - `request_design_review`
  - or visible scoping first, then review
- acceptable apply:
  - subtle relight
  - polish
  - composition-aware cleanup
- bad behavior:
  - removing the foreground spears without reason
  - changing identity
  - changing costume or weapon design

### 2. Premium Relight

Goal:

`Make this frame feel slightly more premium and readable by improving lighting and finish while keeping the same composition, then export a PSD.`

What to look for:

- good first move:
  - `invoke_direct_affordance` with `polish` or `relight`
  - or `request_design_review`
- success signal:
  - face reads more clearly
  - armor separation improves
  - image stays recognizably the same shot
- failure signal:
  - flattened contrast
  - plastic skin
  - armor detail lost

### 3. Local Problem Identification

Goal:

`Identify the most distracting local problem in the frame, mark or select it visibly on the canvas, improve it, then export a PSD.`

What to look for:

- good first move:
  - `marker_stroke`
  - or `magic_select_click`
- success signal:
  - the runner creates visible scope before editing
  - the scoped area corresponds to a real problem
- failure signal:
  - immediate edit with no observable focus step
  - marking a random low-value area

### 4. Copy-Space Variant With Manual Make Space

Manual pre-step:

- before starting Agent Run, use `Make Space` yourself on the left side of the frame where title text might go

Goal:

`Preserve Aragorn as the clear hero, keep his face and sword hand intact, and create a cleaner left-side area that could hold title text, then export a PSD.`

What to look for:

- good first move:
  - `request_design_review`
  - then accept a proposal that respects reserved space
- success signal:
  - left-side negative space opens up
  - subject remains dominant
- failure signal:
  - subject shifted or cropped badly
  - reserved area ignored

### 5. Manual Protect Stress Test

Manual pre-step:

- before starting Agent Run, use `Protect` over:
  - Aragorn’s face
  - chest emblem area
  - sword hand

Goal:

`Improve the image while strictly preserving the protected parts, then export a PSD.`

What to look for:

- good first move:
  - `request_design_review`
  - then a conservative proposal
- success signal:
  - protected areas remain visually stable
- failure signal:
  - face or hand altered despite protection

### 6. Create Tool Judgment

Goal:

`If you find a reusable cinematic polish pattern for this kind of hero frame, preview a tool for it, create the tool, then stop without exporting.`

What to look for:

- good first move:
  - `preview_create_tool`
  - optionally followed by `create_tool`
- success signal:
  - it stops after tool creation
  - the tool description is specific and reusable
- failure signal:
  - exports anyway
  - creates a vague tool like "make image better"

## Scorecard

Use this for each run:

- `First action quality`
  - right direct tool
  - or good visible scoping
  - or good review request
- `Scope quality`
  - visible marks/selection are sensible
  - not random or overly broad
- `Preservation`
  - face preserved
  - armor preserved
  - sword preserved
  - horse/body silhouette preserved
- `Goal fit`
  - output actually moves toward the stated goal
- `Stop behavior`
  - exports only when it should
  - stops without exporting when asked
- `Over-editing`
  - low
  - medium
  - high

## DevTools Shortcut

If you want to drive the same cases without typing in the panel every time:

```js
const ar = window.__JUGGERNAUT_AGENT_RUNNER__;
ar.open();
ar.setPlannerMode("auto");
ar.setMaxSteps(4);
ar.setGoal("Use design review to find one strong improvement that makes Aragorn feel more cinematic while preserving his face, armor, sword, and horse, then export a PSD.");
await ar.step();
```

## Recommendation

Use test cases `1`, `3`, `4`, and `6` first.

That mix gives you:

- review-first behavior
- visible tool use
- reserved-space semantics
- create-tool behavior
