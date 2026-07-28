# Requirement-guided source-shape synthesis

`synthesizeSourceShapes.ts` derives a finite clean-C search grammar from the
current source and `analyzeTargetSchedule.ts` evidence. It does not replace the
analyzer or `searchSourceShapes.ts`: it translates between them.

```text
analyzeTargetSchedule.ts
        ↓ requirements and interventions
synthesizeSourceShapes.ts
        ↓ generated exact-edit search spec
searchSourceShapes.ts
        ↓ compiled candidates and exact confirmation
```

## Current supported subset

The MVP conservatively models the contiguous top-level C89 prologue before the
first control-flow, unknown-effect, or protected-barrier boundary. It can derive:

- dependency-preserving topological orders of scalar operations;
- declaration initializer versus first-assignment shapes when the initializer
  reads only unmodified parameters;
- verified `setSprt` macro versus `setlen`/`setcode` expansion;
- named sprite-header constants;
- a typed local copy of a pointer parameter used by `addPrim`.

Every generated order preserves conservative scalar and known fixed-field
memory dependencies. Unknown calls/macros and uncertain statements stop source
modeling rather than being moved.

## Usage

Derive artifacts and inspect the generated grammar without compiling:

```bash
npx tsx tools/agent/synthesizeSourceShapes.ts func_XXXXXXXX --derive-only
```

Derive and execute the bounded search:

```bash
npx tsx tools/agent/synthesizeSourceShapes.ts func_XXXXXXXX \
  --max-variants 500 --max-depth 3 --jobs 8
```

Use `--analysis <project-relative.json>` to reuse a preserved target-schedule
analysis; otherwise analysis is refreshed. `--resume` forwards to the
deterministic generated source-shape search.

Artifacts are written to:

```text
build/sourceShapeSynthesis/<function>/<run-id>/
├── source-model.json
├── synthesis-plan.json
├── search-spec.json
├── search-output.txt       # execution mode
├── summary.json
└── summary.txt
```

The generated search artifacts remain under `build/sourceShapeSearch/` and are
linked from the synthesis summary.

## Safety and limitations

- The tool never edits `src/` or promotes a candidate.
- It never generates inline asm, barriers, register pinning, volatile
  perturbations, pragmas, or flag changes.
- Existing configured empty memory barriers may be inherited through the
  generated search spec, but edits cannot touch or add them.
- Source-role bindings are confidence-labelled heuristics over target
  operations, constants, ABI roles, and source def/use; they are not claims
  about original variable names.
- The current implementation does not yet synthesize arbitrary CFG, alias,
  expression-tree, or cross-function type transformations.
- Finite exhaustion means only that the recorded generated grammar was
  exhausted. It does not prove that no matching clean C exists.
- Exact function diff, normal source policy, modification scope, and full build
  verification remain the final gates.
