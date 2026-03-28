# Cue Agent Runtime Guide

This document explains how an agent should use Cue as a constrained visual runtime.

Companion files:

- [agent-workflow-prd.md](agent-workflow-prd.md)
- [agent-affordances.json](agent-affordances.json)

## Core Model

Treat Cue as three cooperating surfaces:

- `observe`
- `mutate`
- `review`

Preferred loop:

1. observe
2. choose focus
3. decide direct execution vs review
4. mutate
5. observe again
6. evaluate progress

## Working Rules

- Prefer `observe` before expensive or destructive mutations.
- Treat focus tools as scoping signals, not final edits.
- Use direct affordances when the edit class is already obvious.
- Use `Design Review` when the goal is ambiguous, aesthetic, or multi-step.
- Preserve reversible boundaries before high-cost actions.

## Current Surfaces

- `Agent Run`: live in-app experimentation surface
- Direct execution affordances: single-image actions exposed in the left rail
- Focus and scoping: communication tools exposed in the right rail
- `Design Review`: proposal generation and apply
- `Create Tool`: deterministic local manifest generation for reusable tools

## Public Caveat

Some internal schema ids and module names still use legacy `brood` or `juggernaut` naming. Those internals are transitional and do not change the public Cue workflow.
