# Instrumented GCC compiler oracle

The compiler oracle builds a diagnostic-only GCC 2.95.2-psx `cc1` under
`build/compilerOracle/`. It never replaces the configured production compiler,
never edits `src/`, and never promotes generated code.

The generated compiler instruments the original `sched.c` and `local-alloc.c`
to expose state unavailable from `-da`:

- backward scheduler selections and counterfactual dependency insertion;
- exact local quantity IDs, block membership, births, deaths, merges, classes,
  references, and final assignments;
- every `find_free_reg` candidate list in target `REG_ALLOC_ORDER`;
- legal diagnostic assignment requests and pseudo-local candidate exclusions.

The TypeScript builder generates instrumented C and a Dockerfile under
`build/compilerOracle/context/`; no generated compiler source is checked in or
written into the `old-gcc` submodule.

## Build and run

```bash
npx tsx tools/agent/instrumentCompilerOracle.ts --build
npx tsx tools/agent/instrumentCompilerOracle.ts func_80016280
npx tsx tools/agent/analyzeLocalAllocationOracle.ts func_80016280
npx tsx tools/agent/minimizeLocalAllocation.ts func_80016280
npx tsx tools/agent/solveLocalAllocationState.ts func_80016280
npx tsx tools/agent/inspectLocalAllocationVariant.ts func_80016280 build/hypotheses/example.c --block 1
```

`instrumentCompilerOracle.ts` derives diagnostic interventions from the current
allocator-counterfactual artifact and runs baseline, schedule-only, local-only,
combined, and leave-one-out variants. The baseline diagnostic compiler must
produce instruction-identical output to the production compiler before its
counterfactuals are trusted.

`analyzeLocalAllocationOracle.ts` replays every ordinary stock local allocation
choice from the emitted candidate lists. A verified replay means the quantity
formation, allocation visitation order, and target hard-register order are no
longer reconstructed from dump approximations.

`minimizeLocalAllocation.ts` handles requests whose desired register is already
legal. It iteratively excludes only the stock-selected earlier register,
recompiles, and then performs leave-one-out minimization. Its result states the
minimal hard-register occupancy relations that clean C must create naturally.
Pseudo-local exclusions are an oracle, not valid source constructs.

`inspectLocalAllocationVariant.ts` runs one preserved complete C hypothesis
through the diagnostic compiler and prints its exact quantities, allocation
order, lifetimes, references, candidate lists, and target-indexed score. This
is the narrow requirement gate for allocator-directed source experiments.

`solveLocalAllocationState.ts` goes one level deeper: it reconstructs static
candidate sets from the exact allocation event stream and searches a bounded
number of abstract local quantities. A SAT witness gives allocation slots,
lifetimes, selected hard registers, exact GCC priority bands, and feasible
reference counts for the missing clean-C webs. Phantoms are constraints for
source synthesis, not instructions to insert literally.

## Intervention semantics

- A schedule edge is injected into the diagnostic scheduler DAG before priority
  and reference-count calculation. It is intentionally stronger than source
  birth/LUID changes, so regressions show that a bare dependency is not the
  required source mechanism.
- A forced local assignment is accepted only when the stock allocator's complete
  fixed/call/lifetime/class/frame/size exclusion set considers it legal.
- A forbidden local candidate models occupancy by a missing source lifetime. It
  changes only one pseudo quantity's candidate set and therefore cannot be
  promoted as source.

Exact target comparison remains diagnostic. Normal `diffFunc`, clean-source
policy, finalization, and `make check` remain authoritative.
