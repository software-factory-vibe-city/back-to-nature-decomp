# Allocator counterfactual analysis

`analyzeAllocatorCounterfactual.ts` turns target hard-register differences into
candidate-RTL lifetime and allocation requirements. It does not force registers
or modify source.

The analyzer:

- reproduces GCC 2.95.2 `global.c` allocno priorities from `.lreg` reference and
  live-length statistics and verifies them against the exact `.greg` order;
- refines target/candidate register roles to the pseudos referenced at linked
  final UIDs, retaining coalesced multi-pseudo roles;
- reconstructs incoming hard-register live ranges from `.lreg` live-at-start,
  SET, and `REG_DEAD` evidence;
- distinguishes an explicit hard-register conflict from an overlapping pseudo
  already allocated to that hard register;
- calculates bounded reference/live-length thresholds when changing global
  allocno order could remove a blocker.

Run with fresh trace and target-schedule artifacts:

```bash
npx tsx tools/agent/analyzeAllocatorCounterfactual.ts func_80016280
```

Or consume preserved artifacts without invoking the compiler:

```bash
npx tsx tools/agent/analyzeAllocatorCounterfactual.ts func_80016280 \
  --trace build/compilerTrace/func_80016280/report.json \
  --analysis build/targetSchedule/func_80016280/analysis.json
```

Artifacts are written to `build/allocatorCounterfactual/<function>/`.
Requirements are diagnostic constraints for clean-C source-shape work; exact
object comparison remains the oracle.
