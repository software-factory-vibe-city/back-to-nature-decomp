# Plan: mechanism-aware compiler variant laboratory

**Status: implemented.** `tools/agent/variant-lab/` now validates explicit
hypotheses, preserves deterministic run artifacts, compares normalized GCC
passes from `rtl` through `dbr`, classifies mechanism verdicts before match
counts, rejects forbidden/non-C89 inputs, and supplies opt-in exact-edit
transformation families. The CLI and Pi wrapper support manifests, common CLI
hypothesis flags, pass tracing, transformation specs, and full-mode promotion
gates. Fixture regressions cover the two `func_800154CC` mechanisms.

## Purpose

Evolve `psx_fuzz_variants` from a final-assembly comparison helper into a
reproducible hypothesis laboratory that preserves variant inputs, records the
compiler mechanism each variant tests, and identifies the first pass where
variants diverge.

This must not become an unconstrained source permuter or percentage hill
climber. Every generated or supplied variant must state a mechanism and an
expected compiler effect.

## Motivating case

The final `func_800154CC` search used comparative variants to isolate two
source-level levers:

1. reuse the x-sum variable for the later first tag-link result, creating a
   two-set/two-death `$v1` web and removing a sched2 `$v0` WAR hazard;
2. materialize `0xFFFFFF` immediately after the branch join so its pseudo is
   born early enough for the target `lui/ori` schedule.

The useful progression was:

| Variant family | Result | Mechanism learned |
|---|---:|---|
| reassign `s16` arguments | 1–10/50 | narrowing assignment adds shifts |
| local compound reuse | 46/50 | combine removes the intended web change |
| reuse color temporaries | 28–39/50 | long global webs perturb prologue allocation |
| reuse x temp for first tag result | 47/50 | target `$v1` recurrence fixes allocation/sched2 |
| named mask before branch | 0/50 | birth too early perturbs the whole block |
| named mask after sums | 47/50 | no scheduling change |
| named mask at branch join | 50/50 | correct mask birth and schedule |

The current fuzz tool compared outcomes effectively, but the source variants
and pass-level causal differences had to be managed manually.

## Deliverables

### 1. Variant manifest format

Each complete C variant should have metadata:

```ts
interface VariantHypothesis {
  id: string;
  sourcePath: string;
  mechanism:
    | "fresh-vs-reused-web"
    | "single-vs-multi-set"
    | "constant-birth-site"
    | "result-vs-input-reuse"
    | "address-expression-family"
    | "alias-dependency"
    | "statement-birth-order"
    | "custom";
  expectedPass: string;
  expectedEffect: string;
  invariants: string[];
}
```

Support a JSON manifest and equivalent CLI flags. Reject generated variants
with no mechanism description.

### 2. Preserve exact inputs and results

For each run, store under `build/fuzz/<func>/<run-id>/`:

- the complete source input;
- preprocessed C;
- cc1 assembly and object;
- selected pass dumps when trace mode is enabled;
- normalized target comparison;
- manifest, tool versions, flags, and hashes;
- summary JSON and text.

Do not depend on ephemeral source files that disappear while only compiled
artifacts remain.

### 3. First-pass divergence analysis

Add a trace mode that compares variants at:

```text
rtl → jump → cse → combine → regmove → sched → lreg → greg → sched2 → dbr
```

Report the first meaningful divergence and the affected pseudos/UIDs:

```text
variant tag-reuse first differs in .rtl:
  temp_v1 has two sets instead of one
allocation consequence in .greg:
  x_sum v0 -> v1
sched2 consequence:
  y_sum moves above x stores after WAR removal
```

If a source edit has no effect, report the first pass proving equivalence and
avoid encouraging another syntax-only permutation.

### 4. Curated transformation templates

Provide opt-in templates for mechanism-backed experiments:

- fresh local versus reuse of an existing non-overlapping local;
- reuse a value at a later target-same-register operation;
- direct expression versus named temporary;
- result variable fresh versus input-reused;
- materialize a constant before, at, or after a control-flow join;
- natural array versus struct field address family;
- assignment expression/chained store variants;
- alias-preserving versus alias-separating typed access.

Templates should emit complete C89 files under `build/`. They must not generate
inline assembly, register variables, flag overrides, or generated-global
redefinitions.

### 5. Comparative scoring without hill climbing

Keep exact-match counts and first divergence, but rank results primarily by
whether the predicted mechanism occurred:

```text
hypothesis confirmed / partially confirmed / rejected / inconclusive
```

A lower-scoring variant can be the most useful result if it proves the intended
pseudo or scheduler change. The report should preserve that distinction.

## Suggested implementation

Split reusable logic from `tools/agent/fuzzVariants.ts`:

```text
tools/agent/variant-lab/
├── manifest.ts
├── compile.ts
├── pass-diff.ts
├── transformations.ts
├── classify-hypothesis.ts
├── artifacts.ts
└── types.ts
```

Keep the existing command compatible while adding:

```bash
npx tsx tools/agent/fuzzVariants.ts <func> --manifest build/hypotheses.json
npx tsx tools/agent/fuzzVariants.ts <func> --manifest ... --trace-passes
```

The Pi wrapper should display a compact table and the mechanism verdict for
each variant.

## Tests

- manifest validation and rejection of missing mechanisms;
- artifact preservation and deterministic run manifests;
- C89 template output;
- first divergence in `.rtl`, `.combine`, `.sched`, and `.lreg` fixtures;
- no-effect variants classified as equivalent rather than separately scored;
- forbidden constructs rejected before compilation;
- full-mode confirmation required before promoting a cc1-only winner;
- `func_800154CC` fixture proving tag-result reuse changes allocation and the
  branch-join mask placement changes scheduling.

## Acceptance criteria

- A future investigator can reproduce every source variant from one run.
- The tool names the first compiler mechanism changed by each variant.
- No random permutation mode is added.
- Exact matching remains the final oracle, but match percentage is not treated
  as the hypothesis verdict.
- The final `func_800154CC` two-step solution is discoverable and explainable
  from preserved variant artifacts and pass diffs.
