# Phase 1 — Smallest end-to-end recompiler

**Status: proposed.** See the [overview](overview.md) for architecture and
scope. This phase establishes the whole pipeline before expanding coverage.

## Goal

Execute one small original block as native host code and compare its behavior
with an independent execution reference.

```text
Original bytes
→ existing discovery adapter
→ semantic operations
→ recompiler-specific C lowering
→ existing C AST/printer
→ host compiler
→ native execution and comparison
```

## Work

1. Define the minimal discovery contract: original bytes, guest addresses,
   container identity, entry point, and explicit assumptions. Use an adapter
   over existing discovery artifacts, not a new discovery implementation.
2. Define the initial guest-state and RAM-access contracts. State the entry
   conditions, supported instructions, and execution boundaries explicitly;
   reject inputs outside this envelope rather than assuming them away.
3. Implement only the instruction semantics needed for the selected blocks.
   Preserve any architectural sequencing those blocks require.
4. Lower semantic operations into the existing `CExpr`/`CStmt` machinery in
   `tools/agent/matching-reconstruction/construct.ts`. Extend the shared AST
   and printer only where necessary; keep machine semantics out of printing.
5. Compile the generated C for the reference host and expose a harness that
   initializes state, executes the block, and captures its result and effects.
6. Integrate an independent execution reference. Select it with attention to
   architectural fidelity, instruction-boundary access, and licensing; its
   implementation is not chosen by this phase sheet.
7. Retain input words, addresses, generated source, compiler settings, entry
   state, and comparison output so every failure can be replayed.

Use tiny synthetic fixtures and at least one block supplied by the existing
binary-analysis pipeline. Neither source reconstruction nor a complete game
runtime is needed.

## Proposed completion evidence

- Actual compiled native output agrees with the independent reference on the
  selected blocks and permitted states.
- Deliberately introduced translation defects produce localized failures.
- Unsupported instructions or invalid entry assumptions produce explicit
  diagnostics instead of plausible output.
- Both fixture and repository discovery adapters exercise the same semantic
  and emission interfaces.

A successful parse or compile is not the milestone; execution agreement is.

## Not in this phase

Broad instruction coverage, SDK replacement, graphics/audio implementations,
performance tuning, and proof of arbitrary-binary discovery completeness.

## Handoff

[Phase 2](phase-02-architectural-foundation.md) expands a working semantics
and validation pipeline rather than building its interfaces in isolation.
