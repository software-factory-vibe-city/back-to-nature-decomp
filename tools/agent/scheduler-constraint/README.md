# Scheduler-state constraint search

This directory implements a function-agnostic finite constraint solver for one
legacy GCC scheduler block. It consumes typed compiler-trace and target-schedule
artifacts; no production module contains function names, fixed UIDs, or a
function-specific target sequence.

## Layers

- `finite-solver.ts` — deterministic generic finite-domain satisfiability
  enumeration in minimum intervention-cost order.
- `model.ts` — parameterized backward scheduler, dependency release/queue,
  birthing boost, dependency-class/LUID comparator, the memory-unit hazard
  policy (sched.c schedule_select: the first memory-class instruction in
  rank order wins the greater-potential-hazard re-pick within the top ready
  priority group, and a load issued directly after a store queues for one
  cycle; the narrower legacy boosted-load policy is preserved for stored
  artifacts), baseline replay, and symbolic strict-LUID solving.
- `derive.ts` — generic adapter from compiler trace plus target correspondence
  into model/domain/assertion artifacts and source-mechanism-labelled phantom
  templates.
- `solver.ts` — bounded boost, optional-edge, phantom, and LUID search; emits
  SAT witnesses, exhaustive bounded UNSAT certificates, or INCONCLUSIVE.
- `handoff.ts` — filters the existing conservative clean-C synthesizer to the
  mechanisms named by a SAT witness and emits an ordinary source-shape search
  specification.
- `artifacts.ts`, `render-text.ts`, `types.ts` — deterministic schema-v1
  artifacts and bounded reporting.

## Usage

```bash
npx tsx tools/agent/searchSchedulerState.ts <function> --block 0

# Reproduce a result from its complete serialized input without compiling:
npx tsx tools/agent/searchSchedulerState.ts \
  --input build/schedulerConstraint/<function>/<run-id>/input.json
```

Useful bounds are `--max-phantoms 0..3` and `--max-assignments <n>`. The tool
refuses to search unless its parameterized model first reproduces every
observed selection in the chosen block. `UNSAT` is always scoped to the
serialized finite domain. A run that reaches its assignment bound is reported
as `INCONCLUSIVE`, never as impossibility.

Generated artifacts stay under `build/schedulerConstraint/`; the tool never
edits or promotes source.
