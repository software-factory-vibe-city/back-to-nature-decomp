# Deterministic pipeline reversal

Captured 2026-08-15. Successor discussion to
`plans/hard-function-automation-gaps.md`, aimed beyond this project: apply
the approach to arbitrary period binaries. Assumes toolchain identification
(compiler / flags / assembler / SDK version) is already solved by reliable
heuristics, and deliberately avoids learned components — the spec is the
vendored compiler source, not a training corpus.

## Problem statement

Matching decompilation is: given known deterministic forward function
F = f_n ∘ … ∘ f_1 (expand, cse, gcse, loop, flow, combine, sched1,
alloc/reload, jump2, sched2, reorg, assembler) and bytes B, produce period-C
source s with F(s) = B. m2c inverts the whole composition heuristically in
one lossy jump; the loss actually accrues pass by pass, and each pass is
individually a small, local, enumerable rewrite.

## Core idea: canonical preimages with forward replay

Irreversibility means each f_k has a preimage *set* (fiber), not a point.
Two structural facts make backward chaining tractable:

1. Any fiber member whose forward image is byte-exact is a valid answer —
   we never need the true original. So per pass we want a canonical
   preimage function g_k with f_k(g_k(y)) = y whenever y ∈ image(f_k).
2. Empirically (func_8001A284 done by hand), fibers are singletons for the
   overwhelming majority of instructions; ambiguity concentrates at a few
   sites (a merged tail, a tied schedule, a coalesced web).

Algorithm: run g_1 ∘ g_2 ∘ … ∘ g_n backward, validating each stage by
replaying the real pass forward. Where f_k(g_k(y)) ≠ y, we have not failed
— we have LOCATED and ENUMERATED an ambiguity site ("stage jump2, block 7,
fiber = {duplicated-arm, goto-join}"). Output is either a byte-exact source
or a finite labeled branch set. Deterministic algorithm, localized choice
points; no open-ended source-space search.

Round-trip testability: each g_k is fuzz-testable in isolation — sample
states with the real compiler, check f_k(g_k(f_k(x))) = f_k(x). Failures
are component bugs, not mysteries.

## Per-stage inventory (GCC 2.x family), walking backward

| Stage | Fiber character | Existing embryo |
|---|---|---|
| assembler + reorg | near-bijective: macro un-expansion (self-clobber pairs → la/lw), delay-slot un-filling (stolen/duplicated slots are syntactically recognizable), un-relocation | maspsx source is the forward spec; diffFunc's reloc resolution |
| sched2 / sched1 | fiber = dep-legal orders the documented comparator re-sorts to the observed order; constraint-characterizable | analyzeTargetSchedule, searchSchedulerState |
| jump2 (cross-jump, threading, tensioning) | few rewrite rules, all leaving syntactic witnesses (mid-block labels, orphaned HIGHs, inverted branches); small enumerable fibers | notes/research/func_8001A284-crossjump-equiv-orphan.md; plans item 4 (inverse jump-optimizer) |
| alloc / reload | hard regs → webs is deterministic dataflow; residual ambiguity (which webs were one variable) constrained by the known allocator arithmetic | webAnalysis, solveLocalAllocationState, allocno formula in the style guide |
| combine | un-merging enumerable straight off the machine description; choice points are the documented idiom ambiguities (fused cast+scale vs shift) | style guide §1 idiom tables |
| cse / gcse / loop | widest fibers (rematerialize shared values, un-hoist invariants) but forward behavior already precisely characterized (PRE placement, movable-list, related-value rules) | style guide §4, loop/PRE research notes |
| expand⁻¹ (RTL₀ → C) | near-mechanical: RTL₀ is a tree-walk image; control-frame decisions (casesi / balanced tree / if-chain) are deterministic patterns | dispatch-idiom detector (plans item 2); m2c demoted to one heuristic inside g_expand |

## Key engineering unlock: single-pass harness

Stagewise validation needs "run pass k alone on a hypothesized RTL state."
Patch the vendored cc1 into a harness that injects an RTL state at stage k,
runs one pass, dumps the result. Observability-only modification
(instrumentCompilerOracle spirit — never output-fudging). Interim version
usable today with no patch: reconstruct a candidate source prefix, compile
with -da, structurally compare its stage-k dump against the hypothesized
waypoint (the manual method used throughout the func_8001A284 session).

## What stays irreducible

- Cosmetics: names, comments, dead declarations with no codegen witness.
  Irrelevant to byte-matching; separate readability pass later.
- Coupled choices: a canonical member at stage k that replays locally but
  poisons stage k-1's inversion (pseudo numbering → hash buckets → PRE
  order; declaration order → allocno ties). These are today's hard 20%.
  Deterministic reversal converts them from "search all source space" to
  "jointly resolve an enumerated fiber-choice set at named sites" — a
  SAT-shaped problem over a small domain.

## Why this fits the arbitrary-binaries goal

- No data requirement; the compiler source is the spec.
- Per-family investment: the g_k set covers all GCC 2.x targets; other
  compiler families (IDO, Metrowerks) are new plugin sets behind the same
  waypoint interface.
- Failures are diagnoses with enumerated alternatives — exactly the
  interface a small orchestrating model can drive.

## Build order

1. Lifter: bytes → dependency-annotated RTL (webs, deps, relocs, CFG) —
   unify what diffFunc / analyzeTargetSchedule / webAnalysis half-do.
2. Near-bijective inverses: assembler, reorg, jump2.
3. Single-pass cc1 harness (exact stagewise validation).
4. Constraint-based inverses: sched2/sched1, alloc/reload (mostly
   repackaging existing tools against the waypoint interface).
5. cse/gcse/loop inverses.
6. expand⁻¹ with the dispatch/loop idiom detectors; m2c as one heuristic
   proposal source inside it.
7. Branch-point protocol: standard emission format for ambiguity sites
   (stage, location, enumerated fiber, per-member evidence) consumed by the
   agentic loop.
