---
name: psx-decompile-function
description: Decompile or repair one function in an arbitrary PlayStation matching-decompilation project using m2c, diff classification, compiler tracing, target-schedule and scheduler-state constraint analysis, requirement-guided clean-C synthesis, exact function diffing, and full-build verification.
---

# PlayStation function decompilation

Work on exactly the target named in the invocation. Derive game, compiler,
assembler, SDK, build, layout, and language facts from the current project.
Do not commit or create a worktree unless explicitly requested.

## Mandatory context

Before editing, read completely:

1. `AGENTS.md`
2. `configs/project-profile.md`
3. `prompts/c-style-guide.md` — mandatory distilled matching doctrine, not an
   optional reference
4. the target source and original assembly
5. the target call-graph entry and relevant generated/shared declarations
6. `notes/file-groupings.md` — the target's suspected source-file group, and
   any campaign or research note it points to. Same-file membership carries
   TU-level priors (shared register-variable quirks, idioms, global clusters,
   declaration-order effects). Update the ledger in the same session if you
   find grouping evidence — membership and one-line roles only; technique and
   per-function detail belong in `notes/research/` or `notes/retros/`.
7. Run `npx tsx tools/agent/scanReadBeforeDef.ts <target>` once. A finding
   means the function belongs to the register-variable / handwritten
   fingerprint class (policy-exception territory — see the research notes
   it cites); a clean scan rules that class out before you hypothesize it.
8. Run `npx tsx tools/agent/triage.ts <target>` once, before authoring or
   perturbing source, and again whenever the signature changes. It matches
   the target and your current source against symptom classes this project
   has already diagnosed — argument count versus frame and outgoing-argument
   area, incoming stack arguments, the CAPTURE_RA debug-hook signature, and
   source-policy violations — and cites the note covering each hit. Read
   those notes when it fires. A `blocker` finding means the current direction
   cannot ship regardless of its diff score: fix the premise, do not proceed
   and file paperwork later. Detectors are cheap and incomplete; silence is
   not a certificate.

## Prepare the target

In fresh mode, inspect `src/<target>.c`. Call `psx_m2c` only if it is missing
or still an assembly stub. Never overwrite an existing clean-C attempt. In
resume/fix mode, preserve the source and begin from its current diff.

## Evidence-driven matching loop

1. Call `psx_explain_diff` before editing.
2. Apply only the fix class reported by the classifier and described in the
   mandatory style guide. Treat the classifier's WEB-PARITY and PROVENANCE
   sections as gates: unmatched register webs or a value-provenance
   divergence mean the SOURCE SEMANTICS differ from the target (missing
   masks/temporaries, an operand read from the wrong value behind a
   coincidentally matching register name). Fix those before any
   allocation or scheduling interpretation — an "allocation swap" with
   failing web parity is a symptom, not a cause. Any instruction-count
   delta beyond entry moves is structural; read the reported count-delta
   decomposition instead of treating it as allocation noise.
3. For allocation, scheduling, operand-order that survives source-order swaps,
   or mixed categories, call `psx_compiler_trace` before further perturbation.
   Tie the next edit to a pseudo birth, death, lifetime, conflict, assignment
   pass, canonicalization rule, or scheduler decision. For statement-order
   questions (which global is touched first, where a pointer assignment
   sits in a branch), run
   `npx tsx tools/agent/mineStatementOrder.ts <target>` — per-block
   emission-order evidence (hi16 formation order, store order, delay-slot
   occupant) constrains source statement order directly.
4. After every deliberate edit, call `psx_diff_function`. Reclassify whenever
   the mismatch signature changes or its cause becomes unclear.
5. If the mismatch is order-only inside a block of constant/pointer stores,
   run `npx tsx tools/agent/analyzeStoreBlock.ts <target>` BEFORE any
   scheduler analysis. Mine the stored values for arithmetic structure
   (parallel arrays, pool-carving running sums, repeated constants) and check
   the constant birth-order fingerprint; statement order in natural data
   order usually resolves the block outright. Never derive statement order
   from the emitted store order (see the style guide's store-block section).
6. If the classified trace shows coupled scheduler, allocator, or delay-slot
   constraints, call `psx_analyze_target_schedule` before authoring more source
   shapes. Check emission alignment first: ambiguous machine/UID links must not
   be treated as concrete scheduler evidence. Distinguish target order that is
   merely legal under the candidate DAG from a target order reproduced by the
   bounded counterfactual. Use exact baseline replay and the reported decisive
   priority, last-scheduled dependency class, or block-local LUID relation;
   observational-only or unsupported resource windows do not justify a causal
   claim. Preserve any exact suffix and solved hard-register assignments named
   by the intervention set. If an order-only block remains stuck after bounded
   mechanism-directed shapes, or the replay requires several coupled hidden
   state changes, run
   `npx tsx tools/agent/searchSchedulerState.ts <target> --block <n>`. Require
   its candidate replay gate to be exact. Treat SAT as a web/boost/LUID/phantom
   specification for a small complete-source experiment, scoped UNSAT as a
   reason to stop only that serialized domain, and INCONCLUSIVE or
   model-replay failure as no proof. Never promote a solver witness directly.
7. If several mechanism-backed source shapes remain, first call
   `psx_synthesize_source_shapes` when the analyzer's requirements map to a
   conservative supported source region. Inspect its source-role bindings,
   recipes, generated search spec, and coverage; finite exhaustion covers only
   that recorded grammar. If synthesis refuses an ambiguous region, compare a
   small hand-authored set with `psx_fuzz_variants` or author an explicit finite
   specification for `psx_search_source_shapes`. Search only after the
   trace/analysis names concrete mechanism requirements and semantic
   invariants. Inspect preserved generated sources under `build/`; never copy a
   result automatically. For a `priority-relation`, test the reported
   single-set/birth-eligibility web before unrelated statement permutations;
   for a `luid-order`, test source birth/constant sites while preserving the
   dependency graph. Rank requirement and mechanism evidence before match
   percentage. Never promote a cc1-only result: require full configured
   assembly, then re-run the exact function diff.
8. Keep changes within project policy and put shared types in the designated
   headers rather than conflicting with generated declarations.

If a source change has no effect, locate the first divergent compiler dump and
read that exact pass in the vendored compiler source before trying another
shape.

## Finish

An exact instruction diff is provisional: it masks relocation fields and
cannot distinguish same-shaped accesses to different symbols. `diffFunc`
auto-escalates a masked 100% to a linked-binary byte comparison — only its
"VERIFIED" verdict is a match; on a reported symbol transposition, swap the
order of the corresponding accesses in the source.

At a byte-verified match, call `psx_export_context` for the target and then
`psx_finalize_function`. The finalizer independently checks the exact function,
full binary, modification scope, and clean-source policy. Continue from any
concrete finalizer failure; do not report success early.

## Clean-source gate

For an ordinary compiled function, a byte match is failure if it introduces
register pinning, embedded/top-level assembly, a new assembly stub, a flag
override, or a copied legacy workaround. Honor only handwritten-assembly
exceptions established by project classification. A zero-instruction
scheduling barrier is a documented last resort under the style guide, not a
substitute for diagnosis.

## Targeted deep research

The style guide already contains the mandatory distilled findings, and
`triage.ts` cites the note for every symptom it recognizes. Beyond those, the
project's written knowledge lives in four places, and lookup is by **symptom**,
not by title — a note named after one function routinely carries the general
mechanism that explains another:

- `notes/research/` — mechanism case studies, one per diagnosed phenomenon
- `notes/retros/` — solved-function post-mortems, including what was tried
  and rejected and why
- `notes/file-groupings.md` — TU membership and the campaign notes it links
- `prompts/c-style-guide.md` — the distilled, always-applicable doctrine

Search these by the signature you are actually looking at (frame size, an
unexpected stack load, `$ra` stored through a non-`$sp` base, a store-block
ordering gap, an allocation swap that survives source-order swaps), not by
the target's name. Grep across all four rather than browsing one directory's
titles. Select only the case study whose documented mismatch signature matches
the current one; do not load every note indiscriminately. For a suspected
compiler/assembler boundary, select the project's boundary-analysis note
rather than an unrelated allocator case study.

Do not defer this until stuck. The cheapest signals — frame size, argument
area, stack-argument offsets — are readable from the first compile, and a
wrong structural premise cannot be recovered by scheduling or allocation
work downstream.

When a note's structural claim (an arity, a register assignment, an argument
mapping) contradicts the assembly, the assembly wins. Correct the note in the
same session; a wrong note propagates into every attempt that follows.

If still stuck, leave the best clean-C state and report the category, first
remaining divergence, compiler-pass evidence, and structural hypotheses
tested. Do not commit.
