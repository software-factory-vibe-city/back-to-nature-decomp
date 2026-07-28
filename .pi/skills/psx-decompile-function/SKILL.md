---
name: psx-decompile-function
description: Decompile or repair one function in an arbitrary PlayStation matching-decompilation project using m2c, diff classification, compiler tracing, target-schedule analysis, requirement-guided clean-C synthesis, exact function diffing, and full-build verification.
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

## Prepare the target

In fresh mode, inspect `src/<target>.c`. Call `psx_m2c` only if it is missing
or still an assembly stub. Never overwrite an existing clean-C attempt. In
resume/fix mode, preserve the source and begin from its current diff.

## Evidence-driven matching loop

1. Call `psx_explain_diff` before editing.
2. Apply only the fix class reported by the classifier and described in the
   mandatory style guide.
3. For allocation, scheduling, operand-order that survives source-order swaps,
   or mixed categories, call `psx_compiler_trace` before further perturbation.
   Tie the next edit to a pseudo birth, death, lifetime, conflict, assignment
   pass, canonicalization rule, or scheduler decision.
4. After every deliberate edit, call `psx_diff_function`. Reclassify whenever
   the mismatch signature changes or its cause becomes unclear.
5. If the classified trace shows coupled scheduler, allocator, or delay-slot
   constraints, call `psx_analyze_target_schedule` before authoring more source
   shapes. Check emission alignment first: ambiguous machine/UID links must not
   be treated as concrete scheduler evidence. Distinguish target order that is
   merely legal under the candidate DAG from a target order reproduced by the
   bounded counterfactual. Use exact baseline replay and the reported decisive
   priority, last-scheduled dependency class, or block-local LUID relation;
   observational-only or unsupported resource windows do not justify a causal
   claim. Preserve any exact suffix and solved hard-register assignments named
   by the intervention set.
6. If several mechanism-backed source shapes remain, first call
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
7. Keep changes within project policy and put shared types in the designated
   headers rather than conflicting with generated declarations.

If a source change has no effect, locate the first divergent compiler dump and
read that exact pass in the vendored compiler source before trying another
shape.

## Finish

At an exact match, call `psx_export_context` for the target and then
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

The style guide already contains the mandatory distilled findings. If the
function remains stuck after traced, mechanism-directed attempts, inspect the
titles and opening summaries under the project's research directory and select
only the case study whose documented mismatch signature matches the current
one. Do not load every research note indiscriminately. For a suspected
compiler/assembler boundary, select the project's boundary-analysis note
rather than an unrelated allocator case study.

If still stuck, leave the best clean-C state and report the category, first
remaining divergence, compiler-pass evidence, and structural hypotheses
tested. Do not commit.
