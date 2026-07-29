# Plan: automatic exhaustive residual source-space search

**Status: proposed.**

## Purpose

Build a tool that starts from a semantically acceptable clean-C reconstruction,
the exact target-versus-candidate machine-code diff, and the configured
compiler's trace/scheduler/allocation artifacts, then exhaustively searches the
finite space of supported equivalent source representations that can causally
affect the residual diff.

The operator supplies a function, not a hand-authored permutation list or
per-function source-shape JSON grammar:

```text
current clean C + exact toolchain + target assembly
                         |
                         v
                 residual machine diff
                         |
                         v
           compiler/source causal closure
                         |
                         v
 automatically derived finite semantic-equivalence grammar
                         |
                         v
 deterministic exhaustive generation and exact compilation
```

This is not a search over all C programs. It is a search over all canonical
representations in a versioned, finite, automatically applicable grammar,
restricted to the semantic and compiler-causal closure of the remaining diff.
The tool must state exactly what grammar and bounds were exhausted and must
never generalize an exhausted finite domain into a proof over all clean C.

## Core formulation

Let:

```text
C0 = current semantically accepted clean-C function
F  = configured preprocessing/compiler/assembler pipeline
T  = target function machine code
D  = exact diff between F(C0) and T
S  = finite semantic representation closure derived from C0 and D
```

The search asks for a complete source `C'` such that:

```text
C' is in S
C' is semantically equivalent to C0 under the admitted rewrite proofs
F(C') is byte-identical to T
```

The search is **diff-seeded but causality-aware**. A small machine diff does not
imply a small textual source region: pseudo def/use chains, scheduler ready-list
competitors, allocation conflicts, hard-register hazards, later compatible web
uses, memory dependencies, and delay-slot candidates may expand the source
closure across a larger part of the function.

## Motivating case: `func_80019070`

The current clean source emits 81 instructions and matches target instruction 0
and instructions 10–80. The residual target/candidate difference is a legal
permutation of nine entry-block instructions. Existing diagnostics have already
recovered:

- target/candidate instruction correspondence;
- candidate RTL UIDs and pseudo SET/use/death provenance;
- sched1 birth boosts, dependencies, priorities, and LUID decisions;
- local/global allocation and the `$v0/$v1/$t3/$t5/$t6/$t7` roles;
- sched2 and delayed-branch behavior;
- abstract requirements for the header constants, pointer copy, x conversion,
  glyph masks, and palette load;
- evidence that isolated source mechanisms often improve sched1 while rotating
  allocation or regressing later windows.

What remains manual is constructing complete combinations of semantically
valid source representations. The new tool should derive that residual space
from the clean C and compiler artifacts without asking an agent to specify
forms such as "merge length with code," "move this statement first," or
"materialize this cast" in a manifest.

For this function, the first implementation should automatically discover and
search applicable forms involving:

- splitting and merging non-overlapping scalar value webs;
- all dependency-valid statement orders in the causal closure;
- declaration initializer versus first assignment;
- inline versus materialized pure expressions;
- safe cast and integer-type representations;
- exact known PsyQ macro versus expanded field operations;
- bounded administrative copies only when compiler-state analysis requires a
  coalescible copy or changed set count.

The current function is an integration fixture, not a source of hardcoded
production UIDs, registers, constants, fields, or rewrite rules.

## Relationship to existing tools

This plan fills the automatic layer above existing diagnostics and below exact
source evaluation:

| Existing component | Reused responsibility |
|---|---|
| `m2cFunc.ts` | Initial semantic reversal when no clean source exists |
| `decompToolchain.ts` | Configured preprocessing, cc1, maspsx, assembler, disassembly, and target assembly |
| `compilerTrace.ts` | Candidate pseudo provenance, cross-pass transitions, allocation, scheduler decisions, and source notes |
| `analyzeTargetSchedule.ts` | Target/candidate correspondence, replay confidence, requirements, and delay-slot/allocation constraints |
| `searchSchedulerState.ts` | Optional hidden-state requirements when ordinary target analysis is insufficient |
| `source-shape-synthesis/` | Existing conservative source model and known-macro/source-role logic to refactor and extend |
| `source-shape-search/` | Compilation/evaluation, normalized comparison, schedule profiles, checkpoints, and exact confirmation logic to reuse |
| `variant-lab/` | Pass-level mechanism classification for distinct compiler classes |
| `sourcePolicy.ts` | Forbidden-construct and inherited-barrier policy |
| `diffFunc.ts` | Exact function oracle |

The new tool must not introduce another compiler command implementation,
object comparator, scheduler parser, source promotion path, or per-function
flag mechanism. Shared logic should be extracted from current modules where
necessary.

The existing `synthesizeSourceShapes.ts` MVP derives a small, conservative
prologue grammar. This plan generalizes the future direction into an automatic,
whole-causal-closure, exhaustive representation search. It does not require an
operator-authored `searchSourceShapes` specification.

## Design principles

1. **No hand-authored per-function grammar.** The required CLI input is the
   function name. A complete project-relative source may optionally be supplied
   for diagnostics, but no transform list, permutation list, mechanism
   manifest, or arbitrary rewrite JSON is accepted.
2. **Generated JSON is evidence, not input.** The tool writes its source model,
   closure, grammar, domain, and checkpoints as versioned artifacts so the
   search is inspectable and reproducible.
3. **Semantic anchor first.** The input C is assumed semantically accepted. The
   tool changes representation, not behavior. Unsupported or ambiguous regions
   remain frozen.
4. **Diff-seeded causal closure.** Search scope follows compiler causality, not
   only source line proximity or target instruction indexes.
5. **Finite canonical grammar.** Variable names, whitespace, comments, and
   other compiler-irrelevant syntax are canonicalized rather than enumerated.
6. **Exhaustive means exhaustive within the serialized domain.** Hitting a
   budget, unsupported source construct, uncertain correspondence, or
   uncompleted shard yields `incomplete`, never `exhausted`.
7. **No score hill climbing.** Target percentage may order reports but never
   controls which semantic representations belong to the domain.
8. **No unsound staged pruning.** Source-distinct partial forms may interact
   when combined. A form may be removed before full generation only through a
   proven grammar congruence such as alpha-equivalence, not because an atomic
   compile happened to produce the same final assembly.
9. **Compiler-class deduplication after complete rendering.** Complete
   candidates may be deduplicated by source, preprocessing, RTL, assembly, and
   object hashes for evaluation/artifact retention.
10. **No target RTL invention.** Candidate compiler state is observed; target
    compiler web requirements are inferred and confidence-labelled. Exact
    output remains the oracle.
11. **Clean-source policy remains active.** The grammar never emits inline
    assembly, hard-register pinning, pragmas, volatile perturbations, flag
    changes, or assembly stubs. Existing approved zero-width barriers may be
    inherited but are fixed and cannot be added, removed, or moved.
12. **No source mutation or automatic promotion.** All generated candidates
    remain under `build/`. Exact candidates still pass the normal export and
    finalization workflow before promotion.

---

# Proposed tool

Add:

```text
tools/agent/searchResidualSourceSpace.ts

tools/agent/residual-source-search/
├── source-input.ts
├── semantic-graph.ts
├── compiler-closure.ts
├── rewrite-catalog.ts
├── web-partitions.ts
├── topological-orders.ts
├── expression-forms.ts
├── type-forms.ts
├── macro-forms.ts
├── administrative-forms.ts
├── canonicalize.ts
├── enumerate.ts
├── rank.ts
├── render.ts
├── evaluate.ts
├── checkpoint.ts
├── coverage.ts
├── artifacts.ts
├── render-text.ts
└── types.ts
```

Suggested CLI:

```bash
# Derive the residual closure and finite domain without compiling variants.
npx tsx tools/agent/searchResidualSourceSpace.ts func_80019070 --derive-only

# Run or resume the complete derived domain locally.
npx tsx tools/agent/searchResidualSourceSpace.ts func_80019070 \
  --jobs 16 --resume

# Deterministically shard a large domain across machines.
npx tsx tools/agent/searchResidualSourceSpace.ts func_80019070 \
  --jobs 16 --shard 3/16 --resume

# Diagnostic use with a preserved complete clean source under build/.
npx tsx tools/agent/searchResidualSourceSpace.ts func_80019070 \
  --source build/experiments/func_80019070/clean.c --derive-only
```

The direct CLI may accept resource controls such as jobs, shard, candidate/time
budget, artifact retention level, and resume. These controls do not change the
grammar. A bounded Pi wrapper, if later added, accepts only the function name,
project-relative complete source, derive/resume mode, jobs, and resource budget.

---

# Deliverable 1: eligibility and immutable baseline bundle

Before deriving a search, the tool must establish one reproducible baseline:

1. resolve the complete clean source;
2. run the configured preprocessor and cc1 with pass dumps;
3. assemble the candidate and target;
4. obtain exact normalized target/candidate instructions and relocations;
5. classify the mismatch;
6. obtain or refresh compiler trace and target-schedule analysis;
7. record toolchain identity, source/preprocessed/assembly/object hashes, flags,
   and source-policy status.

Initial eligibility:

- source passes normal diagnostic clean-source policy;
- target and candidate functions are available;
- mismatch is not already exact;
- semantic reconstruction is operator-accepted;
- compiler trace is parseable;
- mismatch category is instruction selection, operand order, allocation,
  scheduling, delay-slot behavior, or a supported mixture;
- source-to-operation attribution is sufficiently confident for at least one
  mismatched role.

Refusal examples:

```text
unsupported: source still contains an INCLUDE_ASM stub
unsupported: target/candidate correspondence is ambiguous for every mismatch
unsupported: semantic source contains an unknown-effect macro in the only causal region
exact: no residual source search required
```

Artifacts include the untouched input source; no baseline rewrite occurs.

# Deliverable 2: whole-function semantic graph

Extend/refactor the conservative source model into a lossless model of the
supported C89 subset across the complete function, not only the prologue.

The graph must represent:

- parameters and local declarations;
- scalar definitions and uses;
- expression results and pure subexpressions;
- basic blocks, branch predicates, joins, and dominance;
- path-sensitive value liveness sufficient to prove safe overwrites;
- fixed-field/global/array memory effects;
- address escapes and unknown memory effects;
- known macro expansion/evaluation behavior;
- exact source spans for rendering complete variants;
- inherited protected barriers as immutable nodes.

Suggested core types:

```ts
interface SemanticValue {
  id: string;
  sourceName?: string;
  type: SemanticType;
  definition: string;
  uses: string[];
  liveBlocks: number[];
  valueRange?: IntegerRange;
  addressEscapes: boolean;
  confidence: TraceConfidence;
}

interface SemanticOperation {
  id: string;
  kind: "assign" | "load" | "store" | "pure-expression" | "branch" |
        "known-macro" | "return" | "barrier" | "unknown";
  block: number;
  reads: string[];
  writes: string[];
  memoryReads: MemoryRegion[];
  memoryWrites: MemoryRegion[];
  sourceSpan: SourceSpan;
  movable: boolean;
  evidence: string[];
}
```

The implementation may remain a conservative C89 parser/token model rather
than a complete general C front end. It must freeze unsupported constructs and
report why. A guessed parse is not acceptable.

Acceptance:

- rendering the unchanged graph reproduces the input source semantics and the
  baseline preprocessing/assembly class;
- every mutable operation has exact source spans and conservative def/use and
  memory effects;
- synthetic tests cover nested blocks, if/else joins, casts, comma-expression
  macros, pointer fields, and C89 declarations;
- the `func_80019070` model recognizes its scalar operations, packet fields,
  known PsyQ macros, control flow, and protected barriers without production
  hardcoding.

# Deliverable 3: diff-seeded compiler/source causal closure

Derive search scope automatically from the residual machine diff.

## Seed set

Start with every mismatched target/candidate instruction and its available:

- candidate final UID;
- cross-pass predecessor UIDs;
- SET/use/death pseudos;
- target/candidate register roles;
- source-line notes and source-role bindings;
- relocation, memory offset, constant, and ABI role evidence.

## Closure edges

Expand until fixed point through:

1. pseudo definitions, uses, deaths, and transitions;
2. source values/statements bound to those pseudos or operations;
3. semantic producers and consumers of selected source values;
4. scheduler dependencies and ready-list competitors in target-relevant cycles;
5. birth/LUID competitors named by exact or reconstructed replay evidence;
6. allocno conflicts, preferences, order neighbors, and hard-register hazards
   capable of changing selected roles;
7. sched2 anti/output dependencies and delayed-branch candidates;
8. fixed-field or alias-related memory operations that constrain legal order;
9. later non-overlapping semantic values compatible with a required multi-set
   or target-register recurrence web;
10. controlling branch predicates and joins needed for path-safe liveness.

Every inclusion records a reason chain from one original diff seed. Optional
expansions based only on inferred recurrence or ambiguous source attribution are
separate confidence strata and are not silently treated as exact.

The closure may become whole-function. The tool reports that fact rather than
artificially preserving an exact suffix or refusing all source interactions
outside the textual mismatch.

Acceptance:

- closure derivation is deterministic;
- each included source operation/value has a machine-readable reason path;
- excluded mutable source regions are frozen in every generated candidate;
- baseline replay remains exact before target-driven requirements are used;
- `func_80019070` closure includes the header constants/stores, pointer copy,
  glyph normalization, x narrowing, palette load/index, relevant later scalar
  recurrence candidates, allocation competitors, and branch/delay-slot roles
  supported by the current artifacts.

# Deliverable 4: globally versioned semantic rewrite catalog

Define one project-generic finite catalog. Rules apply automatically when their
semantic and compiler preconditions hold; no function-specific recipe list is
accepted.

## 4.1 Web split and merge closure

Enumerate all canonical set partitions of compatible semantic values in the
closure, including splitting definitions of one current multi-set variable into
fresh variables and merging independent current variables into one multi-set
variable.

A merge is admissible only when:

- value live ranges do not overlap on any CFG path;
- every use is dominated by the corresponding new assignment;
- the shared representation type preserves all values and operations;
- neither address escapes;
- no use relies on distinct object identity;
- rendering does not alter memory effects or control flow.

Alpha-equivalent partitions are one representation. Use lazy rank/unrank
enumeration rather than materializing all set partitions.

## 4.2 Dependency-valid statement orders

For mutable operations in each supported region, derive conservative scalar,
memory, control, macro, and barrier dependencies and enumerate every
canonical topological order. Unknown-effect nodes and protected barriers form
fixed boundaries.

## 4.3 Expression materialization closure

For pure expressions and safe single-use locals, enumerate:

- inline expression versus named temporary;
- materialized common subexpression versus repeated expression;
- fresh result versus safe input/result reuse;
- supported address-expression families preserving the same location.

Do not add algebraic identities merely to create syntax volume.

## 4.4 Type and cast representations

Infer a finite type set from ABI mode, load/store widths, signed operations,
field/global declarations, and proven value ranges. Enumerate only
representation-preserving forms such as supported `u8/u16/u32/s8/s16/s32` local
modes and cast-at-definition versus cast-at-use.

Rules must account for C integer promotion and reject signed-overflow or
implementation-defined equivalences that are not proven under the configured
compiler/target.

## 4.5 Declaration and birth forms

Enumerate declaration initializer versus first assignment, and declaration
placement only when the source model and C89 block rules prove equivalent.
Variable names and whitespace are canonicalized, not searched.

## 4.6 Known macro forms

Use the configured header definition and hash to enumerate exact known macro
versus direct operation forms when argument evaluation count/order and memory
effects are equivalent. Unknown macros are never expanded by guess.

## 4.7 Bounded administrative forms

Some compiler states require a source-visible copy or multi-set value that
coalesces or disappears later. Because arbitrary redundant programs make the
space infinite, administrative forms are a globally bounded grammar stratum.
They are enabled automatically only when trace/target analysis names a
compatible requirement, such as:

- coalescible pointer/value copy;
- fresh versus reused helper result;
- one safe alias materialization;
- one safe value carry across a branch or statement boundary.

The bound and admitted forms are part of the grammar schema version, not a
per-function agent choice. No inline asm, volatile access, dead arithmetic,
undefined behavior, or hard-register construct is admitted.

Acceptance:

- every rule has typed applicability, semantic proof obligations, canonical
  rendering, and unit tests;
- applicable alternatives are derived automatically from the closure;
- the generated grammar artifact lists suppressed rules and exact reasons;
- no rule names `func_80019070` or any game-specific symbol.

# Deliverable 5: domain construction, exact counting, and feasibility report

Construct the complete finite product of applicable canonical alternatives.
Before compilation, write:

- mutable/frozen source graph;
- closure size and confidence strata;
- number of admissible web partitions;
- number of topological orders per region;
- materialization alternatives;
- type/cast alternatives;
- macro and administrative alternatives;
- exact product count when computable, otherwise a proven upper bound;
- estimated storage/process cost;
- deterministic variant-coordinate schema.

Example report shape:

```text
source operations in closure: 14
semantic values in closure: 9
canonical web partitions: 4,140
statement-order combinations: 1,680
materialization combinations: 32
type/cast combinations: 12
administrative combinations: 2
raw complete domain: 5,341,593,600
```

The tool must not silently pretend a multi-billion domain is an ordinary local
run. `derive-only` should recommend sharding and report whether configured
resource budgets can complete the domain.

Search coordinates must be rankable and regenerable without storing every
source:

```text
web-rank / order-ranks / materialization-mask / type-vector /
macro-vector / administrative-vector
```

Resource budgets affect completion, not domain membership. A stopped run is
`incomplete` and resumable.

# Deliverable 6: deterministic lazy enumerator and sharding

Implement a streaming enumerator that:

- generates complete candidates lazily from ranked coordinates;
- supports exact resume from verified checkpoints;
- supports deterministic `k/n` shards whose union equals the full domain and
  whose intersection is empty;
- does not create millions of permanent source files;
- can regenerate any candidate from run identity and coordinate;
- canonicalizes alpha-equivalent source before compilation;
- records every evaluated coordinate or compressed contiguous range.

No random order is permitted. Simpler canonical forms may be evaluated first,
but the enumeration order and full domain remain deterministic.

Acceptance tests:

- Bell-number counts for web partitions;
- known topological-order counts;
- rank/unrank round trips;
- shard union/disjointness;
- interrupted/resumed run equality with uninterrupted output;
- grammar/input/toolchain hash drift refuses resume;
- no duplicate canonical complete source in a synthetic domain.

# Deliverable 7: high-throughput exact evaluation

Reuse/refactor the existing source-shape evaluation backend for streaming
complete sources.

Evaluation stages:

1. source-policy check;
2. canonical complete-source hash;
3. configured preprocessing;
4. preprocessed hash/class;
5. cc1 compile, initially without pass dumps;
6. normalized function-assembly hash/class;
7. assemble one representative of each complete assembly class;
8. exact target comparison;
9. trace distinct compiler classes that are exact or change a closure-relevant
   compiler mechanism;
10. full configured confirmation of every exact candidate.

Deduplication reduces evaluation and artifact retention only after a complete
candidate is rendered. A source-distinct partial state must not be discarded
from future Cartesian combinations merely because an atomic experiment once
compiled equivalently.

For large runs, preserve:

- every exact candidate;
- one complete source/preprocessed/assembly/object bundle per distinct retained
  compiler class;
- compact JSONL records for all evaluated coordinates;
- deterministic recipes for regenerating non-retained sources;
- representative pass traces only where required.

Do not weaken full-mode confirmation. A cc1-only exact assembly remains
non-promotable until maspsx/assembler/object comparison succeeds.

# Deliverable 8: compiler-mechanism and target-relative reporting

For each distinct relevant compiler class, report before raw score:

- first meaningful divergence from baseline (`rtl` through `dbr`);
- pseudo set/death and local/global allocation changes for closure roles;
- sched1 birth eligibility, LUID, dependency, and selection changes;
- global allocation order, conflicts, preferences, and hard-register roles;
- sched2 and delayed-branch changes;
- target-relative exact ranges and delay slots;
- whether the change satisfies, regresses, or leaves unchanged each supported
  target-schedule requirement;
- source coordinate and canonical representation summary.

The search must not require a mechanism hypothesis to generate a candidate.
Mechanism evidence explains and groups exhaustive outcomes after compilation.

For `func_80019070`, reports should make it possible to query automatically:

```text
Which representations made li 4 multi-set and unboosted?
Which also made li 100 unboosted?
Which retained the target $v0/$v1 allocation?
Which delayed the pointer copy?
Which changed the x-conversion web?
Which preserved both delay slots?
Did any complete representation satisfy all coupled requirements?
```

# Deliverable 9: artifacts and terminal states

Write deterministic artifacts under:

```text
build/residualSourceSearch/<function>/<run-id>/
├── input.c
├── baseline.json
├── semantic-graph.json
├── causal-closure.json
├── grammar.json
├── domain.json
├── checkpoint.json
├── evaluated.jsonl
├── classes.json
├── exact-candidates.json
├── summary.json
├── summary.txt
└── classes/
    └── <class-id>/
        ├── source.c
        ├── preprocessed.i
        ├── compiler.s
        ├── object.o
        ├── comparison.json
        └── trace/              # only when retained
```

Version every schema and include source, analysis, grammar, compiler, maspsx,
assembler, and tool hashes in the run identity.

Terminal statuses:

- `exact-candidate-found` — at least one full configured object is exact;
- `exhausted-no-exact` — every coordinate in every required shard of the
  serialized domain was evaluated and no exact object exists;
- `incomplete-budget` — resource limit ended before domain completion;
- `incomplete-shards` — some deterministic shards are missing;
- `unsupported-source` — semantic model cannot safely represent a required
  region;
- `unsupported-correspondence` — causal closure cannot be derived with usable
  confidence;
- `domain-too-large` — derive-only result requires explicit resource planning;
- `baseline-drift` — source/toolchain/artifact hash changed;
- `failed` — tool or compiler failure with preserved diagnostics.

Only `exhausted-no-exact` supports a finite-grammar exhaustion claim, always
qualified by grammar schema and closure confidence.

# Deliverable 10: tests

## Unit tests

- C89 semantic graph def/use and CFG liveness;
- compatible/incompatible web merges and splits;
- path-safe overwrite checks;
- Bell partition counts and canonical alpha-renaming;
- topological-order enumeration with scalar/memory/control dependencies;
- expression materialization equivalence;
- integer promotion, range, and cast admissibility;
- known-macro definition/evaluation hashes;
- protected-barrier immutability;
- causal-closure reason paths;
- exact product counting;
- rank/unrank, sharding, checkpoints, and resume;
- terminal-state correctness.

## Synthetic compiler integration tests

Create small C fixtures where the target differs only because of:

1. fresh versus reused web;
2. initializer versus assignment birth;
3. two legal statement orders;
4. inline versus materialized expression;
5. result/input reuse;
6. safe cast placement;
7. one coalescible administrative copy.

For each fixture, the tool must derive the applicable domain without a
per-function spec, enumerate it, find the exact source representation, and
report the expected compiler mechanism.

Also include a fixture whose finite domain is exhausted without a match and a
fixture refused for unknown side effects.

## `func_80019070` integration gate

Without hardcoded rules or a hand-authored model, `derive-only` must:

- reproduce the current baseline and residual diff;
- derive a non-empty causal closure with auditable reason paths;
- identify applicable web, statement-order, expression, type/cast, known-macro,
  and compiler-required administrative strata when supported by evidence;
- produce deterministic domain counts and regenerable coordinates;
- leave `src/func_80019070.c` untouched.

A complete run need not find 81/81 to pass implementation acceptance. It must
end honestly as exact, exhausted, incomplete, or unsupported, with enough
coverage data to distinguish those outcomes.

# Deliverable 11: workflow and Pi integration

After the direct tool and tests are stable:

1. document it in `README.md` and `notes/tools-directory-structure.md`;
2. add a bounded Pi wrapper that cannot accept transforms or shell fragments;
3. update the decompilation skill to invoke it only after semantics are accepted,
   the diff is small or classifier-supported, and traced mechanism-directed
   attempts have not resolved the function;
4. require inspection of the generated closure/domain before authorizing a
   domain reported as cluster-scale;
5. never let the wrapper promote generated source automatically.

Suggested workflow:

```text
m2c semantic reversal
→ human/agent semantic and type refinement
→ ordinary evidence-driven matching
→ small stable residual diff
→ derive residual source domain
→ exhaustive/resumable search
→ inspect exact candidate or finite coverage report
→ normal exact diff/export/finalization if exact
```

---

# Implementation phases and decision gates

## Phase 1: derivation-only MVP

Implement Deliverables 1–5 for a conservative straight-line/top-level C89
subset using existing source and trace modules. Generate no variants initially.

Gate:

- source round-trip is lossless;
- causal closure is auditable;
- grammar is automatic;
- exact finite counts are correct;
- no per-function JSON is required.

## Phase 2: web and statement-order exhaustive engine

Implement web split/merge, dependency-valid order enumeration, lazy
rank/shard/resume, rendering, and high-throughput evaluation.

This is the first solution-capable milestone and the highest-priority scope for
`func_80019070`.

Gate:

- synthetic web/order fixtures find their exact source;
- large-domain checkpoint/shard tests pass;
- `func_80019070` derives and runs at least one complete deterministic shard;
- no source-policy violation or `src/` mutation occurs.

## Phase 3: expression, birth, type/cast, and macro closure

Add expression materialization, declaration birth forms, finite type/cast
representations, and exact known-macro forms.

Gate:

- each rule has semantic tests and a compiler integration fixture;
- full Cartesian combinations remain regenerable and coverage-accounted;
- no atomic-equivalence pruning makes exhaustive claims unsound.

## Phase 4: compiler-required administrative closure

Add globally bounded coalescible copy/alias/carry forms activated automatically
by supported compiler-state requirements.

Gate:

- every administrative form is ordinary policy-clean C;
- every activation cites trace/analysis evidence;
- bounds are grammar-versioned and function-independent;
- synthetic fixtures prove the intended copy/coalescing mechanism.

## Phase 5: broader CFG and expression equivalence

Only after the earlier phases are useful, extend to additional if/else,
conditional-expression, loop, and equality-saturated expression forms. Refuse
unsupported semantics rather than turning the MVP into an unsound general C
rewriter.

# Acceptance criteria

The plan is complete when:

1. `searchResidualSourceSpace.ts <function>` derives a finite residual source
   domain from current clean C, exact diff, and existing toolchain artifacts
   without an operator-authored permutation/transform manifest;
2. the source causal closure and every rewrite alternative are
   confidence-labelled and semantically justified;
3. all candidates are complete C89 sources under `build/` and pass the normal
   diagnostic source policy;
4. enumeration is deterministic, lazy, resumable, shardable, and exactly
   coverage-accounted;
5. the tool can distinguish exact, fully exhausted, incomplete, unsupported,
   and drifted outcomes;
6. complete candidates use the configured compiler and assembler pipeline, with
   exact object comparison as the oracle;
7. synthetic fixtures demonstrate automatic discovery of each supported
   compiler-sensitive representation family;
8. the `func_80019070` integration derives its residual domain automatically
   and produces an honest reproducible result without hardcoded function facts;
9. no generated candidate is promoted automatically and normal finalization
   remains mandatory for success;
10. repository tests and full verification pass for any promoted tooling
    changes.

# Non-goals

- Recovering the unique original C source.
- Enumerating all legal C programs or arbitrary algebraic/no-op identities.
- Proving that no clean-C preimage exists outside the serialized grammar.
- Patching GCC, its scheduler, assembly, objects, or linked binary.
- Using target score as a mutation or pruning oracle.
- Generating inline assembly, hard-register declarations, volatile tricks,
  pragmas, source flag overrides, or new barriers.
- Replacing human/agent semantic validation of the initial m2c reversal.
- Automatically modifying `src/`, policy classification, or project
  configuration.
