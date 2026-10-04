# Phase 2 — Architectural foundation

**Status: proposed.** Depends on the executable slice and independent
comparison harness from [Phase 1](phase-01-end-to-end-slice.md).
See the [overview](overview.md) for the semantic-layer boundary.

## Goal

Establish a precise, tested architectural foundation, including interactions
between instructions rather than only isolated opcode behavior.

## Work

1. Expand fixed-width integer semantics: arithmetic, signed/unsigned
   comparisons, shifts, multiplication/division, and HI/LO effects. Preserve
   trapping versus wrapping distinctions and define exceptional outcomes.
2. Expand memory semantics: access widths, signed loads, alignment behavior,
   byte order, unaligned accesses, and observable access ordering. Guest
   addresses remain guest-width values, not inferred native pointers.
3. Separate instruction effects from execution sequencing. Model load and
   branch delays, link-register ordering, competing register writes, and
   pending state at block boundaries explicitly.
4. Define the supported exception/control-state behavior and its limits.
   Timing and interrupt assumptions belong in the execution contract, not in
   undocumented shortcuts. Unimplemented behavior remains unsupported.
5. Add a simple evaluator of the semantic IR for diagnostics and testing C
   lowering. Do not treat agreement between two consumers of the same wrong
   semantic rule as independent ISA validation.
6. Maintain a coverage inventory that distinguishes recognized instructions,
   executable semantics, tested interactions, and unsupported cases.

The existing analytical decoder/SSA is reusable infrastructure, not the
execution authority: opaque instructions, ABI call summaries, and collapsed
architectural distinctions must not pass through unnoticed. Preserve access
to original words when lifting.

## Validation

For each semantic addition, exercise:

- Directed numeric and alignment edge cases.
- Register aliasing and writes to the zero register, without accidentally
  removing observable memory accesses or exceptions.
- Short generated instruction sequences, including delay-slot interactions.
- Pending state crossing the chosen block boundaries.
- The semantic evaluator and compiled generated C against an independent
  validated reference; hardware-backed tests where available.

C lowering must avoid undefined or host-dependent behavior in overflow,
shifts, division, casts, and memory accesses. The printer renders decisions
already made by lowering; it does not own architectural sequencing.

## Proposed completion evidence

- The declared architectural subset has executable, independently tested
  semantics and explicit unsupported boundaries.
- Interaction tests cover the sequencing rules, not just opcode examples.
- Failures distinguish a semantic-rule defect from an emission defect and
  preserve reproducible inputs.

This is a supported-subset claim, not a claim of full platform emulation.
Coprocessor and target-specific coverage continue in Phase 4.

## Handoff

[Phase 3](phase-03-connected-programs.md) composes validated transitions into
connected native execution without requiring recovered C calling conventions.
