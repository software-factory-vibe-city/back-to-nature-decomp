---
name: psx-decompile-function
description: Decompile or repair one function in an arbitrary PlayStation matching-decompilation project using the project's m2c, diff classifier, compiler trace, exact function diff, and full-build verification tools.
---

# PlayStation function decompilation

Work on exactly the target named in the skill invocation. Derive all game, binary, compiler, assembler, SDK, build, and language details from the current project's `AGENTS.md`, generated project profile, configuration, and source. Never assume values from another game or project.

## Required reading

Before editing:

1. Read `AGENTS.md` completely.
2. Read `prompts/c-style-guide.md` completely.
3. Read `configs/project-profile.md`.
4. Read the target source and original assembly under `build/asm/nonmatchings/<target>/`.
5. Inspect the target entry in `build/callGraph.json` and relevant generated/shared declarations.

Follow the project's own file-layout and language rules. Do not commit or create a git worktree unless the user explicitly requests it.

## Prepare a fresh target

Only in fresh-decompilation mode, inspect `src/<target>.c` first. If it is missing or still an assembly stub, call `psx_m2c` with the target. This tool wraps `tools/agent/m2cFunc.ts --write`.

Do not overwrite an existing clean-source attempt. In resume/fix mode, preserve the current source and begin with its current diff.

## Matching loop

1. Establish and classify the baseline with `psx_explain_diff`.

2. Select the fix class from evidence:
   - instruction selection: types, signedness, casts, control flow, extern shape, or source idiom
   - register allocation: temporary births, reuse, lifetimes, declaration order, and expression grouping
   - operand order: fresh-result versus reused-input temporaries and natural address expressions
   - scheduling: source statement order, expression birth site, and sequence points
   - relocation/immediate: symbol declaration, small-data shape, or linked-layout noise
   - mixed allocation/scheduling: trace the compiler before perturbing source
3. For allocation, scheduling, or mixed categories, call `psx_compiler_trace`.

   Tie each edit to a specific pseudo lifetime, assignment pass, conflict, or scheduler decision. Do not random-walk source permutations.
   If a diff ignores source-level changes (classic signature: a commutative operand order identical under both source orders), find the first compiler dump in which the divergence appears (`build/compilerTrace/<target>/`) and read that pass's rule in the project's vendored compiler sources before editing again.
4. When a stubborn operand-order, allocation, or scheduling mismatch leaves several plausible web shapes, test them side by side with `psx_fuzz_variants`.

   Write each structural hypothesis as a complete variant `.c` using the project's headers and pass them all in one call. Read the report comparatively — each variant's diff class and first divergence — to identify which shape family the compiler preserves. This is hypothesis testing, not match-% hill-climbing: promote a winner only after naming the compiler mechanism it exercises, confirm it in full mode (not `--cc1-only`), copy it over `src/<target>.c`, and re-verify with `psx_diff_function`.
5. Limit edits to files allowed by the current project's instructions. Put inferred shared types in the project's designated shared headers rather than inventing local declarations that conflict with generated headers.
6. After each deliberate change, call `psx_diff_function`.

7. Re-run the classifier whenever the mismatch signature changes or the cause is unclear.
8. At an exact match, call `psx_export_context` for the target, then call `psx_finalize_function`. The finalizer independently requires the exact function diff, full build, modification-scope check, and clean-source policy gate. If finalization fails, continue from its concrete failures rather than reporting success.

## Clean-source gate

A byte match is not success if it adds a workaround forbidden by the current project. By default reject:

- hard-register pinning
- embedded or top-level assembly for a function that was originally compiled from source
- a new assembly stub
- per-file compiler-flag overrides
- copied legacy hacks from neighboring functions

Honor only handwritten-assembly exceptions already established by the project's classification and documentation. A zero-instruction scheduling barrier is a last resort only when project policy permits it and an order-only mismatch has been proven; document the exact ordering it fixes.

Inspect the final diff and ensure it complies with project policy.

## When stuck

Do deep research:

- Read `notes/decompilation-retro.md`
- Read `notes/research/*.md`

Do not commit. The user decides how to preserve or isolate the result.
