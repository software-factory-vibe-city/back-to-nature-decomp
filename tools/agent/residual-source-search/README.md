# residual-source-search

Reusable logic behind `tools/agent/searchResidualSourceSpace.ts`: an automatic
exhaustive search over the finite space of supported equivalent source
representations that can causally affect one function's residual machine diff.
The operator supplies a function name; no permutation list, transform manifest,
or per-function grammar JSON is accepted. Generated JSON is evidence, not
input.

## Pipeline

| Module | Responsibility |
|---|---|
| `source-input.ts` | Eligibility gates and the immutable baseline bundle: configured compile with pass dumps, a codegen-verified `-g` diagnostic compile for source-line notes, target/candidate normalization, mismatch classification, compiler trace, and target-schedule analysis. |
| `macro-forms.ts` | Known PSY-Q macro effect registry validated against the exact normalized definition text in the configured header; a changed header deactivates an entry instead of inheriting stale semantics. |
| `semantic-graph.ts` | Lossless conservative whole-function C89 model: blocks, statement nodes with exact spans, scalar def/use, path-aware memory-effect tokens, and frozen unsupported constructs. |
| `web-partitions.ts` | Value webs (reaching definitions + union-find), statement-level liveness, merge admissibility, and canonical restricted-growth-string partition enumeration with the baseline first. |
| `compiler-closure.ts` | Diff-seeded causal closure: seeds from mismatched instructions expand through uid correspondence, pseudo provenance, source-line and constant bindings, scheduler dependencies and ready-list competitors, allocation conflicts/order neighbors, delay-slot candidates, memory anchors, compatible webs, and controlling branches — every inclusion with a machine-readable reason path. |
| `witness.ts` | Discovery and source-level binding of SAT scheduler-constraint witnesses under `build/schedulerConstraint/<function>/`. The only binding channel is machine-derived: a phantom whose producer is the ABI argument-register entry copy binds to that parameter; everything else records an exact refusal. |
| `rewrite-catalog.ts` | Grammar schema 4: active rules `web-partition`, `statement-order`, `declaration-birth`, `known-macro-form` (composite macros split into registered component statements derived from the verified definition text), the constant subset of `expression-materialization` (literal known-macro arguments whose values appear in mismatched target instructions become assignments through synthetic webs that the partition rule may merge into compatible existing webs — the multi-set constant mechanism), and `administrative-form` (rule 4.7: a typed copy of a never-redefined parameter floated in an entry-block region, with every later read redirected to the copy; activated only by a discovered SAT witness phantom, bounded by the witness phantom count, and cited by run id in `grammar.json`). General expression and type/cast strata are recorded as suppressed with exact reasons. Records the semantic assumptions all equivalence proofs rely on. |
| `topological-orders.ts` | Web-aware conservative dependency edges and exact linear-extension counting/ranking/unranking (bitmask DP, bound `MAX_REGION_NODES`). |
| `enumerate.ts` | Exact hierarchical domain counting (partition x birth-subset x order), BigInt global ranks, deterministic lazy `candidateAt`, and disjoint `k/n` residue-class shards. |
| `render.ts` / `canonicalize.ts` | Span-replacement rendering (rank 0 reproduces the input byte-for-byte) and alpha-canonical source hashing used for proven-congruence dedup. |
| `evaluate.ts` | Staged exact evaluation: policy and barrier preservation, canonical/preprocessed/assembly dedup, configured cc1, and full maspsx/assembler object comparison for potentially exact classes; JSONL records per coordinate. |
| `checkpoint.ts` / `coverage.ts` | Resume with identity-hash drift refusal; terminal states that never confuse a budget stop with exhaustion. |
| `run.ts` | Orchestration used by the CLI and the tests. |

## Honesty rules

- `exhausted-no-exact` is a claim about grammar schema 1 plus the recorded
  assumptions in `grammar.json`, never about all clean C.
- Resource controls (`--jobs`, `--shard`, `--max-candidates`) change how much
  of the serialized domain is evaluated, never which representations are in it.
- Candidates stay under `build/residualSourceSearch/<function>/<run-id>/`;
  exact candidates still require the normal export and finalization workflow.

## Remaining plan phases

From `plans/automatic-residual-source-space-search.md`: general expression
materialization beyond diff-named literal constants (rest of 4.3), type/cast
representations (4.4), and broader CFG equivalence (Phase 5) are not
implemented; the catalog reports them as suppressed so exhaustion claims stay
correctly scoped. The bounded Pi wrapper and skill integration (Deliverable
11) are also still pending.

Empirical notes from the `func_80019070` campaigns: the entire baseline web
partition and the full entry-window sweep (orders, births, setSprt component
splits with the tail fixed) contain no exact match and are almost entirely
assembly-equivalent to the baseline — sched1 normalizes statement order until
a web-structure rule changes the priority landscape. Materializing setSprt's
length constant through the existing `code` web (schema 3's merged form)
reproduces the target's `li v0,4` first instruction exactly; the residual
front then moves to the early fresh `li v1,100` birth. Schema 4 activates on
the function's SAT witness (`78a4fff2edfe3681`), whose phantom binds to the
`ordering_table` parameter, and the copy-bearing candidates make the entry
copy `move t2,a0` survive into the scheduled block — the same instruction
class as the target's `move t3,a0`.
