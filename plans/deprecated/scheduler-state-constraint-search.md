# Plan: scheduler-state constraint search for order-only mismatches

**Status: implemented.** `tools/agent/searchSchedulerState.ts` and the reusable
`tools/agent/scheduler-constraint/` modules now provide a function-agnostic,
typed finite-domain solver, parameterized backward-scheduler model, mandatory
candidate replay gate, boost/LUID/phantom/optional-edge domains, deterministic
SAT/UNSAT/INCONCLUSIVE outcomes, reproducible artifacts, clean-C synthesis
handoff, and synthetic regression tests. No production code contains the
motivating function's name, UIDs, or target sequence.

The motivating `func_80019070` run replays all 21 block-0 selections and finds
a SAT scheduler-state witness after 4,222 assignments: remove birth boosts from
UIDs 70/63/59 and introduce one unboosted, coalescible reader of pointer pseudo
81 immediately before UID 4 becomes ready. This is a precise source/web
specification, not a matching source; the generated source-search spec and all
witness artifacts remain under `build/schedulerConstraint/`. This plan converts
the hand-derived impossibility argument in
`notes/research/func_80019070-prologue-allocation-and-arg2-truncation.md`
into a machine-checked search over compiler scheduler state.

## Purpose

Current matching tools search *source space*: they enumerate C shapes, compile
them, and compare output. For `func_80019070` that space is exhausted at the
grammar level (roughly 5,000 variants across all prior runs) because the
remaining mismatch is not driven by statement order but by hidden compiler
state: per-web set counts, live-at-ready bits, fixed entry-copy LUIDs, and
dependency edges that are invisible in the final machine code.

This plan inverts the search. It models the GCC 2.95.2 legacy sched1 block
scheduler as a finite constraint problem, asserts the target selection
sequence, and solves for the web configurations that could produce it:

- **SAT**: the solution is an exact specification of the required web
  structure (set counts, LUIDs, phantom instructions). Source search then
  targets that specification instead of the whole grammar.
- **UNSAT**: machine-checked evidence that no candidate-like block-0
  configuration produces the target order, terminating further source-shape
  investment and redirecting effort (for example to SDK/header-variant
  hypotheses or improved sched2 modeling).

## Motivating case: `func_80019070`

Established facts this work must reproduce and reason over:

1. The mismatch is exactly nine independent instructions at target indices
   1–9. Instructions 0 and 10–80 match byte-for-byte.
2. The toolchain is confirmed by falsification: disabling sched1 or sched2
   collapses the match to 16/81 with different allocation; gcc-2.8.1-psx and
   gcc-2.7.2-psx produce 0/81; cc1's raw assembly matches the final object
   order, so the assembler boundary is clean.
3. sched1's birthing boost (`birthing_insn_p`: SET dest in `bb_live_regs` at
   ready time and `REG_N_SETS == 1`) dominates every contested selection.
   Boosted insns in the candidate: `li4`, `li100`, `move t3`, `sll`, `sra`,
   `andi t6`, the five promoted stack-arg loads, and `sltiu`.
4. The first empty memory barrier (UID 74) depends on every prior block-0
   instruction, making all of them ready at T-5; the boosted instructions then
   win the selections the target gives to the un-boosted header stores.
5. The hand-derived impossibility argument identifies three walls: (A) the
   un-boosted stores cannot be selected at T-10/T-11 while boosted `sra`/
   `move t3` are ready; (B) the boosted `li100` enters ready one cycle after
   its store and wins T-11; (C) the `move t3` entry copy has fixed LUID 0 and
   cannot beat `move t0` (LUID 1) at T-18 unless boosted-but-unready, which
   requires a block-0 reader of the ptr web that cannot exist.
6. The argument is candidate-DAG-derived and the sched2 replay model is
   partial (one unreproduced cycle in the contested window). A machine-checked
   search must treat these as explicit model boundaries, not as oversights to
   silently paper over.

## Scope and non-goals

### In scope

- One basic block of one function at a time (block 0 of `func_80019070`
  first), modeled at the sched1 (pre-allocation) level with the exact legacy
  comparator.
- Free variables limited to what source structure can legitimately control:
  per-instruction boost eligibility, realizable LUID permutations, a bounded
  number of self-deleting phantom instructions, and a bounded set of extra
  dependency edges consistent with the machine semantics.
- Validation of the model against the known candidate before any target
  assertion.
- A solver backend (Z3 via Python, or a deterministic exhaustive enumerator
  over the same finite domain if it is small enough) with reproducible
  artifacts under `build/`.
- Interpretation reports: SAT as a web specification; UNSAT as an
  impossibility certificate with the exact constraint core.

### Out of scope

- Patching or parameterizing the compiler. The solver is observability only.
- Weakening the clean-source gate. A SAT result is not a solution; it only
  retargets source search. Promotion still requires a full-pipeline exact
  match from clean C.
- Register allocation modeling beyond what boost eligibility and preserved
  hard-register checks already require. SAT configurations that predict a
  different hard-register coloring are rejected by the existing exact diff,
  not by this model.
- A general superoptimizer over C expressions. The search is over scheduler
  state for one block, not over program semantics.

## Design principles

1. **Model fidelity before search.** The constraint model must replay the
   candidate's observed 72/81 selection exactly (21/21 block-0 selections)
   before any target assertion is meaningful. This gate is non-negotiable.
2. **Every free variable names a source mechanism.** Boost bits map to
   single-vs-multi-set webs; LUIDs map to statement birth order; phantom
   instructions map to self-deleting copies; extra edges map to genuine
   dataflow. No unconstrained fudge factors.
3. **Realizability filters are explicit.** LUID permutations are restricted
   to statement-order-realizable positions; phantoms must be provably
   self-deleting (coalesced reg-reg copies only); extra edges must not
   contradict the observed machine instructions.
4. **Bounded and recorded.** The full variable domain, the assertion, the
   solver version, and the outcome are written to a deterministic artifact
   directory so UNSAT/SAT claims are auditable and reproducible.
5. **Reuse the validated comparator.** The selection model must be extracted
   from the existing target-schedule analyzer's proven replay logic, not
   re-derived from memory.

## Deliverable 1: parameterized block-0 scheduler model

Extract the block-0 model from `tools/agent/analyzeTargetSchedule.ts` and its
scheduler support into a standalone, parameterized form:

- fixed instruction list with machine semantics and known dependency edges
  (arg2 chain, `sll`/`sra`, `li`/`sb` pairs, barrier links, artificial
  anti-dependencies on the trailing branch);
- parameterized inputs: boost eligibility per instruction, block-local LUID
  assignment, phantom instruction list (position, boost bit, one read
  register), optional extra edges;
- exact legacy selection semantics: backward scheduling, priority then class
  vs. last-scheduled then highest LUID, ready-list entry through ref counts
  and queue costs, birthing boost applied at ready time.

Acceptance: the module compiles under `npx tsx`, is deterministic, and
re-implements no compiler pass beyond what the analyzer already models.

## Deliverable 2: candidate replay validation gate

Configure the model with the candidate's observed web facts (from
`build/compilerTrace/func_80019070/report.json` and the `.sched` dump) and
assert the observed candidate selection sequence.

Acceptance: 21/21 block-0 selections reproduced, matching the analyzer's
existing exact replay. Failure blocks all later deliverables; a model that
cannot replay reality cannot certify impossibility.

## Deliverable 3: free-variable domain and realizability filters

Define the finite search domain with explicit bounds:

- boost bits for the nine mismatched instructions plus the stores and `move
  t0` (each mapped to a named web and its single-vs-multi-set source
  mechanism);
- LUID permutations restricted to permutations of the current block-0 chain
  positions that some top-level statement order can realize;
- 0–3 phantom instructions, each constrained to: reg-reg copy form, exactly
  one read register drawn from the webs present, a chain position, and a
  proof sketch of post-allocation self-deletion (source and destination webs
  must be coalescible onto one hard register);
- optional extra dependency edges, each requiring a named dataflow
  justification and forbidden from contradicting any observed machine
  instruction.

Acceptance: the domain is finite, serialized to JSON, and every element
carries its source-mechanism label.

## Deliverable 4: solver backend and target assertion

Encode the model and assert the target block-0 selection sequence
`[81, 80, 77, 74, 34, 28, 22, 16, 40, 65, 61, 56, 53, 50, 70, 68, 47, 4, 63,
59, 6]` (including the zero-width barrier at its fixed relative position).

Two acceptable backends, chosen by measured domain size:

1. Z3 (Python `z3-solver`) with the comparator encoded as ordering
   constraints over ready-set argmax per cycle; or
2. a deterministic exhaustive enumerator driving the Deliverable-1 model
   directly, if the filtered domain is small enough to complete in bounded
   time.

Acceptance: the backend returns SAT with a full witness assignment or UNSAT
with a recorded core; the run is reproducible from the serialized domain
artifact.

## Deliverable 5: outcome interpretation

- **SAT report**: the witness rendered as a web specification: per-web set
  counts, required LUID positions, phantom copies with their read registers
  and chain positions, and the source-mechanism labels from Deliverable 3.
  Each requirement is checked against the preserved hard-register coloring
  (`$t3`/`$t5`/`$t6`/`$t7`, `$v0`/`$v1` split) and flagged if it predicts a
  conflict the exact diff would reject.
- **UNSAT certificate**: the unsatisfiable core rendered as the minimal set
  of conflicting requirements, written into the function's research note as
  the machine-checked form of the impossibility argument.

## Deliverable 6: sched2 boundary handling

The sched2 replay model is partial (one unreproduced cycle in the contested
window). This deliverable records the boundary honestly:

- SAT witnesses are annotated with the sched2 assumption under which they
  hold (sched2 LUIDs inherit sched1 emission order; no boosts);
- any SAT-derived source specification must still pass the full configured
  pipeline and exact function diff before being called progress;
- if SAT witnesses exist but none survive full-pipeline confirmation, the
  sched2 partial model becomes the next observability target, and this plan's
  artifacts document precisely which witness class failed.

## Deliverable 7: source-specification handoff

For each SAT witness, generate a bounded source-shape search specification
(targeting only the named webs, set counts, phantom-creating copy constructs,
and statement-order ranges from the witness) consumable by the existing
`searchSourceShapes` tooling with inherited-barrier protection.

Acceptance: the generated spec compiles under the existing search tool; any
promoted candidate still passes `psx_finalize_function`.

## Deliverable 8: artifacts, schema, and tests

- Deterministic run directory under `build/schedulerConstraint/<func>/`
  containing: model JSON, domain JSON, assertion, solver log, witness or
  UNSAT core, and rendered report.
- Typed schema versioned from day one.
- Regression tests: candidate replay gate (Deliverable 2), a trivially
  satisfiable toy block, a trivially unsatisfiable toy block, and realizability
  filter unit tests.
- No edits to generated files, no new Python tooling checked in beyond the
  solver driver if Z3 is chosen (repository tooling is TypeScript via
  `npx tsx`; a Z3 driver must be justified against this rule or the
  enumerator backend used instead).

## Verification and decision points

1. Deliverable 2 gate passes before any target assertion runs.
2. After Deliverable 4: if UNSAT, update the research note with the
   certificate and stop source-shape investment for this function; if SAT,
   proceed to Deliverable 7 and test only witness-directed shapes.
3. Every claimed progress step is re-verified with the exact function diff;
   the final arbiter remains `psx_finalize_function` on clean C.

## Relationship to existing work

- Builds on `plans/exact-scheduler-tie-provenance-and-counterfactual-replay.md`
  (comparator provenance, baseline replay, bounded counterfactuals) by
  replacing hand-picked interventions with a solved configuration space.
- Consumes `plans/requirement-guided-clean-c-source-synthesis.md` for the
  Deliverable-7 handoff.
- Records its motivating analysis in
  `notes/research/func_80019070-prologue-allocation-and-arg2-truncation.md`.
