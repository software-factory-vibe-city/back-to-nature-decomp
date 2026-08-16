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
| sched2 / sched1 | fiber = dep-legal orders the documented comparator re-sorts to the observed order; constraint-characterizable. The sched1 model must include three measured facts (func_800136D4): `adjust_priority`'s birthing boost applies only to single-set destinations, and split large constants are 2-set — so a call-crossing constant web ALWAYS drifts to block top; an insn setting a REG_N_CALLS_CROSSED==0 pseudo is anti-dep-pinned below the last call, one crossing calls floats free; injected dependencies do not recompute priorities (oracle edges distort — a legality probe, not a counterfactual) | analyzeTargetSchedule, searchSchedulerState |
| jump2 (cross-jump, threading, tensioning) | few rewrite rules, all leaving syntactic witnesses (mid-block labels, orphaned HIGHs, inverted branches); small enumerable fibers | notes/research/func_8001A284-crossjump-equiv-orphan.md; plans item 4 (inverse jump-optimizer) |
| alloc / reload | hard regs → webs is deterministic dataflow; residual ambiguity (which webs were one variable) constrained by the known allocator arithmetic — verified exactly reproducible on func_800136D4: hand-computed qty merges and `qty_compare` priorities matched the instrumented oracle's event stream rank-for-rank, and local-alloc's fp-exclusion turns "which webs failed local allocation" into a hard byte-level deduction ($fp assignment ⇒ global allocno) | webAnalysis, solveLocalAllocationState, allocno formula in the style guide |
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
  order; declaration order → allocno ties; func_800136D4's parameter
  residence: one expand-stage declaration choice decides whether the spill
  loads exist as block-0 RTL at sched1/lreg or are reload-born, shifting
  every quantity span downstream — a 2-member fiber, resolved by one
  forward replay per member). These are today's hard 20%. Deterministic
  reversal converts them from "search all source space" to "jointly
  resolve an enumerated fiber-choice set at named sites" — a SAT-shaped
  problem over a small domain.

## Why this fits the arbitrary-binaries goal

- No data requirement; the compiler source is the spec.
- Per-family investment: the g_k set covers all GCC 2.x targets; other
  compiler families (IDO, Metrowerks) are new plugin sets behind the same
  waypoint interface.
- Failures are diagnoses with enumerated alternatives — exactly the
  interface a small orchestrating model can drive.

## Status — first implementation, 2026-08-15

Built: `tools/agent/pipeline-reversal/` and the `reversePipeline.ts` CLI.
Items 1, 2 (assembler + reorg), and 7 are done; item 4's allocation half is
done as CFG web recovery; items 3, 5, 6 and jump2's inverse are not started.
`tools/agent/pipeline-reversal/README.md` documents what each inverse does and
where it stops.

Measured on this repository:

- round trip against the compiler's own `.mach` dumps, over the 261 matching
  non-`INCLUDE_ASM` functions: 144 exact, 104 with a small residual (usually
  one to five instructions, from the delay-slot fiber), 13 not checkable
  because the function contains inline assembly;
- perturbation backtest over 12 already-decompiled functions: 9 confirmed,
  0 wrong-stage. A statement swap is always attributed to allocation or
  scheduling and never to the source; a changed constant always to the source;
- on a matching function the chain reports zero decisions, so a non-empty
  report always means work.

Four facts the writing above had wrong or did not have, all from the vendored
source and confirmed by the round trip:

1. **`jump2` runs after `sched2`**, not before it. The tail order is
   greg → flow2 → sched2 → jump2 → mach → dbr.
2. **The forward phase of `fill_simple_delay_slots` can only fill a call's
   slot.** Its eligibility test is guarded by `target == 0`, and `target` is
   set to `JUMP_LABEL (insn)` for every jump. Modeling it as available to
   branches silently steals every eager thread fill.
3. **A call does not reference memory** with delayed effects off — `case CALL:`
   in `resource.c` says the first operand "doesn't really reference memory" —
   which is why a store lands in a call's delay slot.
4. **Only length-1 instructions enter a delay slot.** cc1 declares length 2 for
   a bare-symbol memory reference, so a gp-relative access is never a slot
   candidate however conflict-free it looks.

Two defects found and fixed in existing tools while building this:
`classifyRtlEmission` counted every call and the `(return)` as zero-width
(no `(set `, a `(clobber)` present), which shifted `emission-alignment`'s
fallback; and the shared register table spells hard register 30 `fp` while
objdump spells it `s8`, so a frame pointer's definitions and uses were
invisible to every web analysis that read a disassembly.

The interesting negative result: reordering two uninitialized local
declarations never changed a byte in any function tried. GCC 2.95 numbers
pseudos by first use in the RTL, not by declaration order, so the
declaration-order lattice is not a lever on its own.

## Status — the iteration metric, 2026-08-15

Second change, same day: the byte score is no longer what an iteration
hill-climbs on. `tools/agent/pipeline-reversal/objective.ts` derives a staged,
per-block residual from the waypoint comparison, and
`tools/agent/residualObjective.ts` scores and ranks candidate sources on it.

```
key = [control-flow, population, schedule, allocation]   lexicographic, lower better
```

Wired into every place that ranked variants: the variant laboratory, the shape
searcher, and the autonomous loop's per-turn report. `diffFunc` keeps the
terminal MATCH verdict and loses the ranking job.

Demonstrated on func_80020E58: a variant that hoists the length computation
into a local scores 222/260 matching words against the baseline's 220/263 — two
words better — while moving from `sched 10 alloc 35` to `sched 12 alloc 32`,
which is further from the target on the causally prior term. A byte-score loop
accepts it and locks in a worse schedule. The objective calls it `traded` and
keeps it as a branch rather than the new baseline.

Three verdicts exist for reasons worth keeping: `traded` because the staged
ordering is a claim about causality, not a certainty, so a caller sees the
exchange rate instead of a flat "worse"; `identical` because CSE collapses most
re-spellings of a value and a loop that counts them as experiments never
terminates (the experiment-ledger item of the gaps plan, now enforced); and
`degraded` because a control-flow difference means "block 6" does not name the
same code on both sides.

`diffFunc` is no longer a registered tool. Its two jobs now belong to tools
that do each of them better: `psx_residual_objective` for the per-edit
measurement, `psx_finalize_function` for the terminal gate. The CLI remains and
the build, gates and loop still shell out to it; the exclusion and its reason
live in `UNEXPOSED_CLIS`, and a test asserts that every unexposed CLI exists,
is not also registered, and carries a real reason. Losing the tool would have
lost two signals, so both were added first: undetermined words now have their
own column and a loud line in the reversal report, and `reversePipeline --block
N` prints a block target-beside-candidate for when the decisions are not enough
or the chain reports itself degraded.

`rankBlocks` automates the attack order a human would pick: population first,
then payoff over difficulty, where payoff counts every block sharing the same
residual signature. On func_80020E58 it independently reproduces the order a
hand analysis chose — block 6 first because block 8 is the same problem, then
block 3, then the 72-instruction block 2 last.

One more defect found and fixed while measuring: dropped call-clobber webs kept
their pre-filter ids, which aliased live webs and mis-attributed allocation
differences across blocks. The reported allocation residual for func_80020E58
moved from 32 to 34 once the aliasing was gone.

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
