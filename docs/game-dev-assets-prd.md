# Cue Game Dev Assets PRD

Status: draft
Last updated: 2026-04-01
Document owner: product / desktop runtime / agent runtime

## Purpose

This document defines a Cue product slice for the existing
`game_dev_assets` branch.

Cue already contains game-dev language in the current intent taxonomy:

- branch id: `game_dev_assets`
- asset types: `CONCEPT_ART`, `SPRITES`, `TEXTURES`,
  `CHARACTER_SHEETS`
- workflow icon: `ITERATION`

This PRD turns that taxonomy into a concrete product plan.

The main idea is not to make Cue a generic agent for game studios. The main
idea is to make Cue exceptionally good at repeated visual production work for
game teams: concept iteration, family consistency, batch exports, and asset QA.

## Product Summary

Cue should ship a **Game Asset Producer** surface for the `game_dev_assets`
branch.

That surface combines:

- scoped batch planning for game-art workflows
- background job execution for long-running asset work
- game-specific Cue Packs
- first-class verification for production asset constraints
- staged or forked output placement instead of silent mutation

The result should feel like a production director for game-art assets inside
Cue, not like a generic image chatbot.

## Existing Repo Alignment

This PRD is anchored in current repo language, not a new naming system.

Current source-of-truth references:

- `rust_engine/crates/brood-cli/src/main.rs`
  - `game_dev_assets` branch inference
  - `GAME_DEV_ASSETS`, `CONCEPT_ART`, `SPRITES`, `TEXTURES`,
    `CHARACTER_SHEETS`, `ITERATION` cluster
- `desktop/src/assets/intent-icons-sc/icons/intent-usecase-game-dev-assets.png`
- `desktop/test/intent_ambient_logic.test.js`

This PRD builds on the existing branch taxonomy rather than replacing it.

## Problem

Game-art work has several patterns that Cue's current one-image-at-a-time loop
does not handle well enough:

- generating many related variants from one approved direction
- maintaining style consistency across a family of assets
- exporting production-safe outputs for engine ingest
- verifying technical constraints after generation
- iterating across branches without overwriting accepted work
- running slow or many-step art production tasks without blocking live editing

For game teams, the pain is usually not one isolated edit. The pain is the
production system around the edit.

## Product Statement

Cue Game Dev Assets is an image-first production surface for game-art teams.
It helps users create, review, normalize, verify, and export asset families
such as concept art, sprites, textures, and character sheets.

Cue remains canvas-first and image-first. The game-dev slice adds structured
production workflows around that canvas.

## Users

- solo indie developers making art and game UI themselves
- small art teams producing character, environment, and UI assets
- technical artists preparing engine-ready asset sets
- art directors reviewing stylistic consistency across many outputs
- producers or founders who need faster iteration without losing control

## Top Use Cases

The first release should prioritize a narrow set of high-value use cases.

### 1. Character Exploration

Given one concept frame or reference board, generate multiple approved
directions for:

- silhouette
- costume variants
- mood and lighting passes
- role clarity and faction readability

Outputs should land as forked tabs or staged result groups rather than replace
the original working canvas.

### 2. Character Sheets

Starting from an approved character image or sequence:

- build or refine a character sheet
- normalize pose framing and visual consistency
- maintain identity across variants
- stage alternates for review

### 3. Item And UI Icon Families

Given a seed icon or a set of references:

- generate a coherent icon family
- normalize contrast, lighting, and silhouette
- verify legibility at target sizes
- export production-ready icon sets

### 4. Sprite And Animation Prep

Given an approved character or object asset:

- produce sprite-ready directional or pose variants
- keep framing and padding consistent
- verify frame size and family alignment
- export structured outputs for downstream sheet assembly

### 5. Texture And Surface Variants

Given a base surface or material reference:

- create texture variations
- keep material identity intact
- check seam safety and edge continuity where applicable
- export engine-ready output sizes

### 6. Art Direction Forking

Given one approved scene or asset set:

- branch into multiple art directions such as grimdark, whimsical,
  handheld-readable, mobile-readable, retro palette, or premium-rendered
- preserve lineage between the source and each branch
- compare branches before promotion

### 7. Asset QA And Export Verification

After generation or edit:

- verify asset constraints
- catch export mistakes before engine ingest
- produce a receipt-backed report of failures and warnings

## Killer Feature

The primary differentiator should be the **Game Asset Producer**.

This is a separate product surface that:

- accepts an explicit scoped asset set
- creates a typed batch plan
- runs background jobs with progress
- applies game-specific verification automatically
- stages results into safe output locations

The Game Asset Producer should feel like:

- "make me 12 clean item icon variants at this size"
- "run a style-consistency pass across these portraits"
- "prepare these sprites for atlas export and flag anything broken"
- "fork this character direction into three factions and keep them separate"

That is more valuable for game teams than a generic open-ended assistant.

## Product Constraints

The following rules remain locked:

- keep user-facing naming on Cue
- keep the visible editing loop image-first and direct-manipulation-first
- keep reproducibility through receipts and lineage
- keep current public platform support statements honest
- keep macOS as the verified public desktop platform
- keep Windows and Linux described as roadmap work until they are verified
- keep broad generic shell, filesystem, and web authority out of scope

## Goals

- make Cue materially better for `game_dev_assets`
- support asset-family workflows, not just single-image edits
- add background execution for slow or repeated game-art tasks
- add game-specific verification that catches production issues early
- support branch-safe iteration through staged or forked results
- support installable game-art workflow packs
- preserve current canvas, timeline, and receipt strengths

## Non-Goals

- no generic game-engine integration in v1
- no direct Unity, Unreal, or Godot plugin requirement in v1
- no arbitrary code execution inside packs
- no generic broad automation surface unrelated to game-art workflows
- no promise of perfect spritesheet authoring or timeline animation tooling in
  v1
- no replacement of the current live canvas editing loop
- no change to public platform support claims

## Product Principles

### Optimize For Families, Not Single Winners

Game production work often needs sets: icon families, sheet variants, enemy
tiers, faction skins, and export batches. The product should optimize for
families of assets.

### Keep Mutation Safe

Multi-asset operations should prefer staged outputs, result groups, or forked
tabs. Users should not feel that Cue silently rewrote accepted work.

### Verification Is Part Of Creation

For this product slice, verification is not optional cleanup. Verification is
part of the workflow.

### Reuse Should Be Structured

Common game-art workflows should be installable and repeatable through Cue
Packs, not reconstructed by hand every time.

### Keep Visual Lineage

Users should always be able to trace outputs back to:

- the source asset or tab
- the plan or pack used
- the provider or local runtime used
- the job and receipt that produced the result

## Proposed Product Surface

### 1. Game Asset Producer

This is the main new surface for the game-dev slice.

It should let users:

- choose a scope
- choose a supported workflow
- preview a typed batch plan
- launch it into jobs
- monitor progress
- review and promote outputs

#### Scope Options

- selected images
- current tab
- selected tabs
- selected timeline nodes
- selected result group

#### Supported First-Wave Workflows

- character exploration batch
- character sheet refinement batch
- icon family generation batch
- sprite prep batch
- texture variation batch
- asset verification batch
- export batch

#### Plan Requirements

Each Game Asset Producer launch must create a typed plan with:

- plan id
- workflow type
- target scope
- target output policy
- requested constraints
- approval state
- derived job list

The user should be able to see what will happen before launching.

### 2. Game Cue Packs

Cue should support installable packs specialized for game-art production.

#### First-Wave Pack Types

- `character_explorer_pack`
- `character_sheet_pack`
- `item_icons_pack`
- `sprite_prep_pack`
- `texture_variants_pack`
- `retro_palette_pack`
- `mobile_legibility_pack`

#### Pack Contributions

In v1, a game pack may contribute:

- workflow definitions
- generation presets
- verification rules
- export presets
- UI copy and onboarding
- pack-owned metadata and assets

#### Example Pack Behaviors

`item_icons_pack` might contribute:

- icon family generation workflow
- 64px and 128px readability verification rules
- contrast and silhouette checks
- export presets for transparent PNG outputs

`sprite_prep_pack` might contribute:

- directional or frame normalization workflows
- frame-size consistency checks
- padding checks
- atlas-prep export presets

### 3. Job Queue For Game Asset Work

Long-running work should run as jobs, not hidden promises.

#### Required Job Types

- generation jobs
- verification jobs
- export jobs
- pack install and validation jobs
- optional compare and summarization jobs

#### Job States

- queued
- running
- blocked
- succeeded
- failed
- canceled

#### Required Job UX

Users must be able to:

- see active jobs
- inspect progress
- inspect warnings and failures
- cancel eligible jobs
- retry eligible jobs
- open outputs directly from job completion

### 4. Verification Surface

This is the most important adaptation of the Claude Code verification mindset.

Cue should add game-specific asset QA as a first-class product feature.

#### Verification Categories

- visual consistency
- target-size readability
- framing consistency
- alpha fringe and edge cleanup
- seam safety for textures where applicable
- padding and bounds safety
- family naming and export completeness
- format and dimension correctness

#### Example Checks

For icons:

- readable at target pixel size
- strong silhouette separation
- consistent lighting direction
- transparent background integrity

For sprites:

- frame size consistency
- anchor-safe crop bounds
- padding present where required
- no obvious frame-to-frame drift in alignment

For textures:

- seam-risk heuristic
- edge continuity heuristic
- target size matches export preset

For character sheets:

- identity consistency
- framing normalization
- sheet completeness against selected workflow template

#### Verification Outputs

Verification should produce:

- pass, warning, or fail state
- a concise report
- artifact references when relevant
- receipt-backed lineage
- actionable next steps

### 5. Result Placement Model

Result placement is critical for trust.

#### Output Policies

The user should choose one of:

- fork into new tabs
- attach as staged variants under current run
- replace current active image only when explicitly requested
- export only without canvas mutation

#### Default Behavior

For most batch workflows, default to:

- forked tabs for concept and direction work
- staged variants for family generation
- export-only for production export batches

Do not default to silent overwrite across many assets.

### 6. Compare And Promote

Once multiple branches or staged families exist, Cue should support:

- side-by-side compare
- family compare
- promote selected output to canonical working asset
- archive or discard unneeded branches

This should integrate with the existing session timeline and artifact lineage
instead of creating a parallel history model.

## Functional Requirements

### Batch Planning

Cue must:

- support typed batch plans for supported game-dev workflows
- make scope explicit before launch
- make result placement explicit before launch
- preserve a stable plan id and job lineage

### Generation

Cue must:

- support repeated generation across a selected family or scope
- preserve source linkage to the originating asset or tab
- keep results grouped by plan and workflow
- surface provider and pack provenance

### Verification

Cue must:

- support verification as a standalone workflow
- support automatic verification after eligible generation or export workflows
- attach warnings and failures to result groups and jobs

### Export

Cue must:

- support export presets appropriate to game-art workflows
- retain existing receipt behavior
- add game-dev-specific export metadata where needed
- avoid claiming layered editable output that does not exist today

### Reopen And Persistence

Cue must:

- preserve current run-directory compatibility
- preserve current `cue.session.v1` and `cue.timeline.v1` compatibility
- keep result groups and job references reopen-safe where they are persisted
- keep receipts and artifacts discoverable after reopen

## Proposed Data And Contract Direction

This PRD assumes the broader platform work defined in
`docs/extensibility-and-orchestration-prd.md`.

For the game-dev slice, the following new contracts should exist:

- `cue.batch_plan.v1`
  for Game Asset Producer launches
- `cue.job.v1`
  for durable work execution
- `cue.pack.v1`
  for game workflow packs
- `cue.verification_report.v1`
  for game-art QA output

These should remain additive to:

- `cue.session.v1`
- `cue.timeline.v1`
- existing receipt lineage and export contracts

## UX Requirements

### Entry Points

The Game Asset Producer should be reachable from:

- current active image affordances when the intent branch is
  `game_dev_assets`
- selection or tab actions for scoped batch operations
- result groups that are eligible for follow-up workflows

### Required UI Surfaces

- batch launcher
- job queue
- pack library
- verification report view
- compare and promote view

### Required Labels

User-facing language should use Cue naming and simple game-art workflow names:

- Character Exploration
- Character Sheet
- Icon Family
- Sprite Prep
- Texture Variants
- Verification
- Export Batch

## Rollout Plan

### Phase 0: Vertical Slice Definition

- finalize `game_dev_assets` user-facing workflows
- define initial pack schema needs
- define verification report shape

Exit criteria:

- one clear workflow list is agreed
- first-wave verification categories are agreed

### Phase 1: Verification And Export First

- ship standalone verification jobs
- ship export presets for game-dev workflows
- keep generation flows mostly existing at first

Exit criteria:

- users can run verification on selected assets
- export presets and verification reports exist

### Phase 2: Game Asset Producer MVP

- ship typed batch plans
- ship job queue support for supported game workflows
- ship safe result placement defaults

Exit criteria:

- users can batch-launch at least three supported workflows
- outputs are staged safely and traceably

### Phase 3: Cue Packs For Game Workflows

- ship bundled game packs
- ship local pack install and enable flows
- surface pack provenance in UI and receipts

Exit criteria:

- at least two bundled game packs are usable
- one local pack install path works

### Phase 4: Compare And Promote

- ship compare and promote UX
- integrate compare decisions into lineage and timeline

Exit criteria:

- users can compare and promote staged results without losing history

### Phase 5: Remote And Heavy-Compute Extensions

- optional remote job execution for slow workflows
- optional offloaded export or generation

Exit criteria:

- only pursue if local job runtime is already reliable

## Acceptance Criteria

This product slice is successful when:

- Cue is materially better at `game_dev_assets` than at generic image editing
- users can run scoped asset-family workflows without manually repeating the
  same steps
- users can verify outputs for game production constraints before export
- outputs are staged safely and remain traceable
- packs make repeated game-art workflows reusable
- existing session, timeline, and receipt behavior remain compatible

## Risks

### Overpromising Engine Integration

Risk:
Users may assume full engine pipeline integration.

Mitigation:
Keep v1 focused on asset production, verification, and export preparation.

### Weak Verification

Risk:
If verification is vague, it becomes cosmetic rather than useful.

Mitigation:
Tie checks to concrete asset classes and explicit failure or warning reasons.

### Hidden Mutation

Risk:
Users may lose trust if multi-asset jobs silently rewrite accepted art.

Mitigation:
Default to staged or forked outputs.

### Pack Sprawl

Risk:
Too many lightly differentiated packs could fragment the product.

Mitigation:
Start with a small curated bundled set.

### Startup Regressions

Risk:
Packs, jobs, and new UI surfaces could slow startup.

Mitigation:
Lazy-load optional game-dev surfaces and keep the baseline boot path small.

## Open Questions

- should tilesets be modeled as part of `SPRITES`, `TEXTURES`, or as their own
  future asset class
- should verification be entirely heuristic in v1 or allow user-defined
  pack-level thresholds
- should promoted assets write directly into existing runs or default to forked
  runs for some workflow types
- which export presets matter most first: icons, sprite frames, portraits, or
  concept review boards
- when should Cue support direct engine metadata export

## Related Docs

- `docs/extensibility-and-orchestration-prd.md`
- `docs/desktop.md`
- `docs/agent-runtime.md`
- `docs/agent-workflow-prd.md`
- `docs/features/visual-timeline/README.md`
