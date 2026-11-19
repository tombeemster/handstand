---
name: riddance
description: Use before building or extending any software product, especially with AI assistance. Runs a five-rung check (entry, scope, residue, mechanism, placement) to decide what to build, what to cut, and what to keep. Trigger when starting a new feature or project, extending an existing one, or when an agent proposes additions or refactors.
---

# Riddance

Climb the ladder in order before writing or changing code. Each rung narrows the one above it. Push back on extras at every step, including the ones proposed by the agent or by yourself.

## 1. Entry (JTBD)

- For existing work: what is this for, today, and is that still true?
- For new work: what job is this hired to do, and for whom?
- If you cannot name the job in one sentence, stop. You are not ready to build.

## 2. Scope (Pareto → YAGNI)

Identify the 20% of the work that delivers most of the value. Build or change that first.

Then cut the remainder that nobody needs yet. Speculative features, configuration for hypothetical cases, and generalization without a second use case all go.

## 3. Residue (Cruft, Muda type 2)

Ask two questions about the current artifact:

- What in it no longer earns its place? (Cruft: dead flags, unused functions, commented-out blocks, duplicated helpers, scaffolding from an early build.)
- What steps exist only because something upstream cannot be trusted? (Muda type 2: redundant verification, manual syncs between copies, review steps that catch nothing.)

Act only on what you can point to: a flag nothing reads, a function with no callers, two copies that have diverged. If you cannot point to a signal, skip this rung.

Remove only what you can show is unused or duplicated, and state what you removed.

Run this rung only when there is something concrete to clean. It is not a standing review.

## 4. Mechanism (KISS)

Choose the simplest tool and structure that does the job. Less machinery means fewer things to break and fewer things to verify.

## 5. Placement (SSOT, DRY)

Once you know what you are storing, decide where each fact lives. One authoritative place per fact. Other places reference it rather than copy it.

## Checks for AI-generated output

- Generation is cheap; review is expensive. Judge output by what you will have to read, test and maintain, not by how quickly it arrived.
- Agents tend to add. If a session grew the codebase, run rung 3 on what it added before accepting it.
- Sole-reviewer check: for each verification step, ask whether it has caught anything real. If not, it is a candidate for removal.

## Tracking (first-tester runs)

On each run, record:

- what the ladder made you cut
- what it made you keep
- where you disagreed with it

If residue cleanups per session keep rising, the rung is becoming a ritual. Narrow its trigger.