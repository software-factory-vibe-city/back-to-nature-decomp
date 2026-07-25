# Decompilation Tooling Ideas

## Goal

Bucket C is an **inverse-compilation and observability problem**, not evidence
that cc1 code generation is broken. The compiler is deterministic and trusted,
but the current instruction diff does not reveal which compiler pass first
diverged or which source property controls the result.

The tooling should explain and direct the search while preserving the exact
compiler's behavior. We should instrument or observe GCC 2.95.2, not modify its
allocator or scheduler to force matches.

## 1. Allocator observability tool

Instrument or consume GCC RTL dumps to expose, for every pseudo or allocation
quantity:

- creation order and source location;
- live range and conflicts;
- register class and preferences;
- allocation priority and cost;
- quantity merge decisions;
- chosen hard register;
- instruction order before and after scheduling.

This directly addresses `func_8001B4E4` and probably `func_8001E7DC`. Instead
of saying "these two webs got swapped," the tool should let us say something
like:

> Quantity 14 was considered before quantity 12 because of X, so it claimed
> `$v0`.

The first question is whether GCC 2.95's existing dump flags expose enough, or
whether this requires a diagnostic-only compiler build.

## 2. Structural diff explainer

Replace the index-by-index match percentage with an explanation that can
recognize:

- the same opcode sequence modulo register renaming;
- one hard-register allocation swap;
- the same dependency DAG with a different schedule;
- reversed expression or address operands;
- an instruction-selection difference;
- relocation-only or linked-layout noise;
- the first compiler-relevant divergence.

This would identify which compiler pass or source mechanism to investigate
before trying source changes.

## 3. Controlled compiler laboratory

Generate small C89 functions with systematically varied source shapes:

- declaration and statement order;
- fresh temporary versus variable reuse;
- split versus fused expressions;
- operand order;
- different live-range overlap;
- address-expression forms.

Compile every variant and correlate source properties with pseudo creation,
allocation, and scheduling behavior. This could derive GCC 2.95's rules
empirically before we completely understand its source.

## 4. Directed source-variant search

Once the relevant lever is known, automatically explore only transformations
appropriate to that diff class. Cache compilations and rank candidates
separately by:

1. instruction selection;
2. instruction count;
3. dependency and ordering match;
4. register allocation;
5. exact bytes.

This is safer than asking an agent to mutate arbitrary syntax based on one
aggregate match percentage.

## Implemented first pass

Two standalone tools now cover the foundational layer:

```bash
# GCC -da pass dumps, pseudo lifetimes/conflicts, local vs. post-local
# assignments, approximate GCC 2.95 QTY_CMP_PRI, and scheduler summaries
npx tsx tools/agent/compilerTrace.ts func_8001B4E4
npx tsx tools/agent/compilerTrace.ts func_8001B4E4 \
  --src notes/scratch/func_8001B4E4-candidate.c

# Structural object diff with relocation normalization, hard-register and
# live-range mapping, operand-order detection, and scheduling classification
npx tsx tools/agent/explainDiff.ts func_8001AF44 \
  --src notes/scratch/func_8001AF44-candidate.c
```

Both tools support `--json`; `explainDiff.ts --self-test` runs synthetic
classification checks. Raw trace and object artifacts are kept under
`build/compilerTrace/` and `build/explainDiff/`.

The matching-agent prompt and orchestrator now enforce this sequence:

1. classify with `explainDiff.ts` before editing;
2. use `compilerTrace.ts` for allocation, scheduling, and mixed cases;
3. make a source change tied to a specific reported mechanism;
4. use `diffFunc.ts` as the exact progress oracle;
5. reclassify when the signature changes and finish with `make check`.

The orchestrator's fix mode and retry messages explicitly reject register
pinning, forged/top-level asm, and new flag overrides as escalation steps.

The stock GCC dumps do not expose exact local-allocation quantity merges or
hard-register suggestions. `compilerTrace.ts` labels its priority calculation
as an estimate because it reconstructs the GCC 2.95 `QTY_CMP_PRI` inputs from
per-pseudo summary data. A diagnostic compiler build remains the path to exact
quantity-level data.

An immediate result is that the narrow `local-alloc` hypothesis was wrong for
at least part of the parked problem. In the C4 candidate, pseudo 82 has three
deaths, is not assigned in `.lreg`, and receives `$v1` only in the post-local
`.greg` state. The important C5 user pseudos are also post-local assignments.
Future allocator work must cover global allocation and reload, not just
`local-alloc.c`.

## Initial framing

The allocator trace and structural diff are foundational. Automated source
search without them risks automating the same blind thrashing seen in earlier
agent runs.

The next design choice is whether to deepen quantity-level allocator tracing
for the three parked functions or use the current reports to build the
controlled compiler laboratory.
