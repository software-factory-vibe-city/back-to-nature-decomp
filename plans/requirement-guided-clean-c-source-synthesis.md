# Plan: requirement-guided clean-C source-shape synthesis

**Status: MVP implemented.** `tools/agent/synthesizeSourceShapes.ts` and
`tools/agent/source-shape-synthesis/` now provide a conservative lossless
prologue model, confidence-labelled target/source role binding, deterministic
proof-oriented statement/initializer/known-macro/pointer-copy recipes, search
spec emission, optional bounded execution through `searchSourceShapes.ts`,
artifacts, tests, and a bounded Pi wrapper. Source-shape search can preserve the
baseline's existing empty memory barriers while rejecting edits that touch or
add them. Generated searches now trace distinct preprocessed classes and retain
per-variant target-schedule profiles and baseline deltas. The broader
CFG/expression/alias catalog, profile-driven staged causal composition,
cross-function mechanism atlas, and full semantic-obligation engine in later
phases remain future work.

## Purpose

Build a tool that actively searches for matching clean C by converting concrete
compiler-state requirements into a bounded, inspectable grammar of natural C89
source transformations.

The project already has the two halves around this missing step:

```text
analyzeTargetSchedule.ts
  target order, UIDs, pseudos, allocation, delay-slot requirements,
  and abstract interventions

searchSourceShapes.ts
  deterministic exhaustive compilation of an explicit finite exact-edit grammar
```

Today a human must translate the first tool's output into the second tool's
JSON grammar. That translation is where most new source hypotheses are
invented, and it is still manual. The proposed synthesizer fills that gap:

```text
current source + trace + target requirements
                    |
                    v
        source roles and safe rewrite sites
                    |
                    v
 abstract intervention -> natural C mechanism recipes
                    |
                    v
 deterministic finite candidate graph and search specs
                    |
                    v
 compiler-mechanism evaluation and exact object confirmation
```

Unlike the diagnostic tools in
`plans/baseline-aware-variant-schedule-comparison.md`, this tool is explicitly
solution-oriented. It should generate and combine source shapes that were not
manually supplied for the current function. It cannot guarantee a solution:
the inverse mapping from machine schedule to original C is underdetermined, and
some compiler states may have no clean source realization in the supported
grammar. When it fails, it should leave a precise coverage report rather than
only a collection of percentages.

## Motivating case: `func_80019070`

The current source matches 72/81 instructions. Instructions 10–80, hard-register
allocation, stores, branches, and delay slots are solved. The only mismatch is
the order of nine independent prologue instructions:

```text
target:    li4 li100 move-ptr mask16 sext-hi sext-lo nibble mask-f0 load-arg8
candidate: mask16 nibble mask-f0 li4 li100 move-ptr sext-hi load-arg8 sext-lo
```

Target-schedule analysis proves that the target order is legal under the
candidate DAG and reproducible with a bounded set of priority/LUID relations.
It identifies likely mechanism families such as statement birth order,
single-versus-multi-set webs, constant birth sites, natural dependencies, and
lifetime endpoints. Existing finite searches tested many manually authored
forms, but the tools cannot currently derive additional clean-C forms from
those requirements.

For this function, the synthesizer should be able to:

- bind the nine machine roles to the pointer/header/argument normalization and
  stack-argument source operations;
- derive natural source alternatives for the specific priority and LUID
  relations, rather than permuting unrelated statements;
- preserve target indexes 0 and 10–80 as hard constraints;
- retain the three existing policy-approved barriers through the protected
  baseline mode planned separately;
- test atomic mechanisms, bounded interactions, and mechanism-confirming
  combinations;
- distinguish a source shape that changes the requested scheduler relation
  from one that merely changes the final score;
- fully assemble and verify any exact candidate without modifying `src/`.

## Relationship to existing tools

This should extend, not replace, the current pipeline:

| Existing component | Reused responsibility |
|---|---|
| `compilerTrace.ts` | Pseudo provenance, source-line notes, SET/use/death data, allocation, and scheduler decisions |
| `analyzeTargetSchedule.ts` | Target/candidate/UID correspondence and abstract intervention requirements |
| `fuzzVariants.ts` | Mechanism verdicts and pass-level comparisons |
| `searchSourceShapes.ts` | Exact-edit generation, compilation, deduplication, checkpoints, ranking, and full confirmation |
| `sourcePolicy.ts` | Final construct and modification-scope policy |
| Baseline-aware variant plan | Safe inheritance of existing approved empty barriers and per-variant schedule profiles |
| `diffFunc.ts` | Exact function oracle |

The new tool should emit ordinary source-shape search specifications and call
shared search libraries directly. It must not create another compiler runner,
object comparator, scheduler parser, or source promotion path.

## Design principles

1. **Generate mechanisms, not syntax noise.** Every recipe must name the target
   requirement, intervention, expected compiler pass, and predicted effect.
2. **Finite and deterministic.** No random mutation, genetic search, beam search,
   percentage hill climbing, or unbounded feedback loop.
3. **Semantic safety is structured evidence.** A free-text invariant is not a
   proof. Every generated rewrite receives a safety class and machine-readable
   preconditions.
4. **Refuse ambiguity.** Unsupported C syntax, uncertain aliases, unclear side
   effects, or weak source-role correspondence should suppress a rewrite rather
   than silently assume it is safe.
5. **Contextual compilation.** Mechanisms must be tested in the complete current
   function because isolated snippets do not reproduce its allocation and
   scheduler interactions.
6. **Requirement feedback, not percentage feedback.** Later combinations are
   selected by confirmed compiler-state effects and compatibility, never by raw
   score alone.
7. **Preservation first.** Already-exact ranges, opcode stream, instruction
   count, hard-register roles, and configured source constructs are explicit
   hard constraints.
8. **No target RTL invention.** Target-side facts remain machine order and
   legality under candidate evidence; source recipes are hypotheses.
9. **No source mutation.** All generated sources, specs, traces, and results
   remain under `build/`.
10. **Exact output remains the oracle.** A mechanism-confirming result is useful
    but not complete; only assembled function equality followed by normal
    finalization is success.

---

# Proposed tool

Add:

```text
tools/agent/synthesizeSourceShapes.ts

tools/agent/source-shape-synthesis/
├── source-model.ts
├── source-roles.ts
├── intervention-planner.ts
├── recipe-catalog.ts
├── semantic-safety.ts
├── candidate-graph.ts
├── search-spec-emitter.ts
├── mechanism-feedback.ts
├── coverage.ts
├── artifacts.ts
├── render-text.ts
└── types.ts
```

Suggested CLI:

```bash
# Derive and inspect a finite synthesis plan without compiling variants.
npx tsx tools/agent/synthesizeSourceShapes.ts func_80019070 --derive-only

# Derive and run the bounded plan.
npx tsx tools/agent/synthesizeSourceShapes.ts func_80019070 \
  --max-variants 2000 --max-depth 3 --jobs 8

# Resume the deterministic candidate graph.
npx tsx tools/agent/synthesizeSourceShapes.ts func_80019070 --resume
```

The tool should obtain the current target-schedule analysis automatically or
accept a project-relative analysis path. CLI limits must remain bounded:

- `maxVariants`: 1..5000 per invocation;
- `maxDepth`: 1..3 initially;
- `jobs`: 1..16;
- optional basic-block focus;
- `deriveOnly` and `resume`.

Do not accept arbitrary source text, shell fragments, compiler flags, or custom
rewrite code from the CLI or Pi wrapper.

---

# Deliverable 1: conservative lossless source model

## Scope

The synthesizer needs original-source spans for exact edits, local def/use
information, and statement boundaries. Building or vendoring a complete C
front end is unnecessary for the first version. Implement a conservative,
lossless C89 function-body model that supports the forms used by ordinary
project functions and refuses unsupported constructs.

The model should tokenize while preserving byte offsets, whitespace, comments,
preprocessor lines, and macro calls. It should understand enough structure to
identify:

- function parameters and their declared types;
- top-of-block declarations and initializers;
- compound blocks;
- expression statements and assignments;
- `if`/`else`, loops, labels, `goto`, and `return` boundaries;
- identifiers, constants, casts, unary/binary operators, calls, array access,
  field access, and address-taking at a conservative level;
- known SDK macro invocations as opaque statements or expressions unless a
  registered macro rule expands them safely.

Expressions may remain token trees rather than a complete typed AST. A rewrite
must be suppressed when the model cannot prove the delimiters, declaration,
operator precedence, or source span it needs.

Suggested types:

```ts
interface SourceSpan {
  start: number;
  end: number;
  lineStart: number;
  lineEnd: number;
}

interface SourceStatement {
  id: string;
  kind:
    | "declaration"
    | "assignment"
    | "expression"
    | "if"
    | "loop"
    | "return"
    | "label"
    | "compound"
    | "unknown";
  span: SourceSpan;
  blockId: string;
  order: number;
  reads: string[];
  writes: string[];
  addressTaken: string[];
  memoryEffects: SourceMemoryEffect[];
  calls: string[];
  sideEffectConfidence: TraceConfidence;
}

interface SourceValue {
  id: string;
  name: string;
  kind: "parameter" | "local" | "constant" | "field" | "global";
  typeText: string;
  declaration: SourceSpan;
  definitions: SourceSpan[];
  uses: SourceSpan[];
  addressTaken: boolean;
}
```

## Preprocessor and macro handling

Use the unpreprocessed source for edits and the configured preprocessed source
only as evidence. Preserve `#line` mappings so compiler source notes can be
mapped back when available.

Macros are not assumed pure. The initial registry may cover exact PSY-Q helper
macros whose definitions are available in the configured headers. A macro
rewrite must record:

- the resolved header and definition hash;
- argument evaluation count and order;
- memory fields written;
- whether expansion contains a call, volatile access, or control flow;
- why direct expansion or contraction is behavior-preserving.

Unknown macros remain opaque side effects and block transformations that cross
them.

## Refusal behavior

The source model should emit explicit unsupported regions. `derive-only` output
must state, for example:

```text
statement S14 not rewriteable: unknown macro side effects
expression E7 not rewriteable: comma operator attribution ambiguous
local p not reusable: address escapes through call
```

The tool must never approximate a parse and then emit an edit against it.

---

# Deliverable 2: source-role binding

Target-schedule interventions name machine indexes, candidate UIDs, pseudos,
and hard-register roles. Recipes need source values and statement spans. Build
a confidence-labelled binding layer using independent evidence:

1. final machine instruction to RTL UID correspondence;
2. pseudo SET/use/death and transition history;
3. GCC source-line notes where present;
4. parameter ABI register/stack locations;
5. constants, modes, operations, field offsets, and relocation symbols;
6. user-variable flags and RTL names when GCC preserves them;
7. source def/use order and dominance;
8. known macro field effects.

Suggested types:

```ts
interface CompilerRole {
  id: string;
  targetIndexes: number[];
  candidateIndexes: number[];
  uids: number[];
  pseudos: number[];
  hardRegisters: string[];
  operationSignatures: string[];
  requirementIds: string[];
}

interface SourceRoleBinding {
  compilerRoleId: string;
  sourceValueIds: string[];
  statementIds: string[];
  expressionSpans: SourceSpan[];
  confidence: TraceConfidence;
  evidence: string[];
  alternatives: Array<{
    sourceValueId: string;
    confidence: TraceConfidence;
    evidence: string[];
  }>;
}
```

Rules:

- An exact source-line note plus compatible operation/def-use may be exact.
- ABI/constant/field-offset mapping with a unique source candidate is
  reconstructed.
- Expression similarity without unique attribution is inferred.
- Automatic recipe generation initially requires exact or reconstructed
  bindings. Inferred bindings appear as suggestions in the coverage report but
  are not compiled unless a future explicit operator-reviewed mode is added.
- Ambiguous bindings do not get forced to make every intervention actionable.
- Pseudo numbers are local to one compilation and never become persistent
  source-role IDs.

For `func_80019070`, the role report should distinguish at least:

- sprite header length constant;
- initial sprite code constant;
- output pointer copy;
- arg2 16-bit normalization;
- arg3 sign extension;
- arg2 low nibble;
- arg2 high-nibble mask;
- stack `arg8` load.

---

# Deliverable 3: intervention-to-recipe planner

Convert each target-schedule intervention into applicable source mechanism
families. This is a typed planning table, not free-text prompting.

Example mapping:

| Intervention | Candidate recipe families |
|---|---|
| `luid-order` / `birth-order` | move pure birth site, split/merge initializer, reorder independent statements, constant placement |
| `priority-relation` / `birth-eligibility` | single/multi-set web, fresh/reused value, parameter local copy, result/input reuse |
| `lifetime-endpoint` | move first definition, move last use, named temporary, direct expression, safe local reuse |
| `dependency-add` | expression nesting, result carry, input/result reuse, shared local web, proven alias relation |
| `dependency-remove` | fresh local, direct value, alias separation where types and semantics prove it |
| `allocation-order` | birth/use placement, non-overlapping recurrence, local type mode, statement order |
| `hard-register-assignment` | target-register recurrence and conflict/lifetime recipes; never hard-register syntax |
| `delay-candidate-order` | independent statement order, natural data dependency, lifetime endpoint, branch-shape recipe |
| `ready-insertion-order` | source definition order and CFG join placement |
| `resource-relation` | spacing/birth-site alternatives; never backend directives |

Each planned recipe records:

```ts
interface SynthesisRecipe {
  id: string;
  requirementIds: string[];
  interventionIds: string[];
  mechanism: VariantMechanism;
  expectedPass: PassStage;
  expectedEffect: string;
  sourceRoleIds: string[];
  edits: ExactSourceEdit[];
  safety: SemanticSafetyResult;
  protectedRanges: SourceSpan[];
  incompatibilities: string[];
  naturalPriority: number;
  confidence: TraceConfidence;
}
```

The planner must verify that a recipe can plausibly affect the named compiler
property. For example, moving a source statement is not emitted for an LUID
requirement when combine is already proven to canonicalize every relevant
statement-order form into one RTL order, unless the recipe also changes the
birth site or pseudo web predicted to survive combine.

Recipes that prior artifacts prove preprocessed-, RTL-, combine-, or
assembly-equivalent should be marked covered and omitted from recompilation by
hash/cache evidence. This integrates naturally with the future experiment
ledger, but the first version may consume only current standard search and
variant-lab summaries.

---

# Deliverable 4: curated clean-C rewrite catalog

The catalog should contain source-aware generators with explicit preconditions,
not static snippets. Every generator emits exact edits against the lossless
source model.

## Initial proof-oriented families

### 1. Declaration initializer versus first assignment

Generate:

```c
T value = pure_expression;
```

versus:

```c
T value;
/* same control-flow path */
value = pure_expression;
```

Preconditions:

- automatic scalar local;
- one reaching definition before every use;
- no jump bypasses the assignment;
- expression has no volatile access or unsequenced side effect;
- declaration remains C89-valid at block top.

Expected mechanisms: birth order, LUID order, lifetime start, constant birth.

### 2. Move a pure definition within its safe window

Move a local definition/assignment among statement anchors bounded by:

- operand definitions;
- first use;
- control-flow dominance;
- calls, volatile operations, and unknown memory effects;
- potentially aliasing reads/writes.

Enumerate only anchors named by the target mismatch window and intervention,
not every statement permutation in the function.

Expected mechanisms: statement birth order, ready insertion order, lifetime.

### 3. Direct expression versus named temporary

Generate a fresh local for a side-effect-free expression or inline a one-use
local back into its use.

Preconditions:

- exactly one use for inlining, or a selected expression evaluated exactly once
  for materialization;
- no evaluation-order change relative to other side effects;
- exact type and integer-promotion behavior retained;
- declaration placement remains C89-valid.

Expected mechanisms: fresh/reused web, birth site, lifetime, allocation order.

### 4. Parameter direct use versus typed local copy

Generate a local copy at selected safe anchors, or eliminate an equivalent
one-use copy.

Preconditions:

- copied type and cast behavior are explicit;
- no parameter reassignment changes later uses;
- all uses selected for replacement are dominated by the copy;
- pointer qualifier or alias behavior is not weakened.

Expected mechanisms: argument pseudo web, SET count, lifetime, hard-register
preference.

### 5. Fresh result versus non-overlapping local reuse

Reuse an existing scalar local for a later result, or split a reused web into a
fresh local.

Preconditions:

- source def/use intervals do not overlap on any CFG path;
- neither local's address is taken;
- types, modes, signedness, and promotions are compatible;
- no value is live across a call/branch where the other definition occurs;
- the rewrite does not introduce an uninitialized path.

Expected mechanisms: single/multi-set, target-register recurrence, allocation
conflicts, sched2 hazards.

### 6. In-place update versus named result

Generate carefully typed forms such as:

```c
x &= mask;
y = x >> shift;
```

versus a supplied source-model-equivalent named intermediate when dataflow
proves the same value reaches every use.

Do not perform algebraic reassociation or remove masks based only on machine
output. Signed overflow, integer promotions, and shift semantics must be
preserved explicitly.

Expected mechanisms: result/input reuse, multi-set web, combine survival.

### 7. Constant birth placement

Materialize a constant in a named local at valid anchors, keep it direct at a
use, or reuse a compatible later constant result when lifetimes do not overlap.

Preconditions:

- exact integer type and representation;
- no signedness/promotion change;
- no volatile or address-taken local;
- selected placement dominates all intended uses.

Expected mechanisms: constant birth site, priority, LUID, allocation order.

### 8. Proven-independent statement order

Generate bounded orders for two or three statements only when source analysis
proves their scalar and memory effects commute.

Preconditions include:

- no calls, volatile accesses, unknown macros, control transfer, or sequence
  dependence;
- disjoint scalar writes and no read-after-write relation;
- memory accesses either absent or proven distinct fixed fields/objects;
- no possible pointer alias between moved memory accesses;
- no crossing a declaration in a way that violates C89 scope.

Expected mechanisms: source/LUID/birth order and delay candidate order.

### 9. Known SDK macro versus verified natural expansion

Expand or contract only registered macros whose configured header definition
has a known hash and whose argument evaluation behavior is preserved.

Expected mechanisms: statement grouping, memory dependency, branch shape,
constant placement.

## Later evidence-gated families

These should not be in the MVP unless their obligations are implemented:

- parameter type narrowing/widening based on complete caller and ABI evidence;
- equivalent branch diamonds and crossjump-oriented shapes;
- array versus struct address families;
- alias-preserving typed access alternatives;
- loop/CFG reshaping;
- caller/callee signature changes.

They may be emitted as review suggestions with unmet obligations. They must not
be silently treated as semantics-preserving.

## Explicitly forbidden families

Never generate:

- inline asm or new barriers;
- hard-register declarations;
- `volatile` perturbations;
- compiler pragmas or flag overrides;
- algebraic no-ops, dummy branches, dead loops, or unused locals intended only
  to perturb GCC;
- generated-global redeclarations;
- arbitrary casts without a typed semantic proof;
- source line directives or statement-expression extensions;
- C99 constructs.

---

# Deliverable 5: semantic safety and preservation obligations

Every recipe receives a structured safety result:

```ts
type SemanticSafetyClass =
  | "proven-local"
  | "proven-known-macro"
  | "caller-bounded"
  | "review-required"
  | "rejected";

interface SemanticObligation {
  kind:
    | "def-use"
    | "dominance"
    | "type-equivalence"
    | "evaluation-count"
    | "evaluation-order"
    | "alias-separation"
    | "caller-range"
    | "macro-definition";
  status: "proved" | "unproved" | "violated";
  evidence: string[];
}

interface SemanticSafetyResult {
  class: SemanticSafetyClass;
  obligations: SemanticObligation[];
  compileEligible: boolean;
  evidence: string[];
}
```

Default automated search admits only `proven-local` and
`proven-known-macro`. `caller-bounded` is reserved for a later mode requiring a
complete direct/indirect caller audit. `review-required` recipes are preserved
in `suggestions.json` but not compiled. Any violated obligation is rejected.

This is not a general proof of C program equivalence. It is a proof that a
specific restricted rewrite satisfies its catalogued preconditions within the
modeled function. Reports must say so explicitly.

## Hard preservation constraints

Derive default constraints automatically from the current analysis:

- every current exact range outside the focused mismatch window;
- exact target register-role mappings already satisfied;
- opcode stream and instruction count when the diff is scheduling/allocation
  only;
- solved delay slots and branch/store windows;
- configured relocation family;
- approved inherited source constructs;
- no new source-policy finding.

Operators may tighten these through a persisted project-relative synthesis
spec, but may not weaken clean-source policy or final verification.

For `func_80019070`, defaults should include target indexes 0 and 10–80, exact
81-instruction count/opcode stream, solved `$t3/$t6/$t7` roles, and all current
delay slots.

---

# Deliverable 6: deterministic candidate graph

A single Cartesian product of every applicable recipe would be too large. A
percentage-guided beam would be nondeterministic and could discard causally
useful variants. Use a bounded, staged candidate graph whose expansion rules
are declared before each stage and recorded in artifacts.

## Stage 0: baseline and attribution

- compile/reuse the exact baseline;
- verify target analysis and hard constraints;
- derive source-role bindings;
- enumerate every applicable atomic recipe;
- deduplicate recipes with identical exact edits.

## Stage 1: atomic mechanism probes

Compile every eligible single recipe within the budget. Classify whether it:

- produced the predicted pass change;
- changed the named intervention relation;
- preserved hard constraints;
- converged to an already-known compiler class;
- changed an unrelated mechanism only.

Atomic probes are measurements and remain useful even when their exact score
falls.

## Stage 2: bounded interaction coverage

Generate deterministic combinations independent of percentage:

1. all compatible recipe pairs that target the same requirement;
2. all compatible pairs across requirements connected by the same scheduler
   mismatch window or allocation contest;
3. a deterministic pairwise covering set for remaining mechanism-family pairs;
4. full products only when their declared size fits the remaining budget.

Include compatible pairs even when one atomic probe regressed, because two
mechanisms may compensate. Reject overlapping exact edits and combinations
whose safety/precondition proofs invalidate one another.

## Stage 3: causal composition

Within `maxDepth` (initially at most three), combine recipes that:

- confirmed their predicted intervention or an explicitly adjacent one;
- preserved the hard source and machine constraints individually or in a Stage
  2 interaction;
- affect distinct unsatisfied relations or a declared coupled relation set;
- remain semantically compatible after edits are applied.

Selection uses structured requirement results, not exact percentage. Given the
same Stage 1/2 results and budget, Stage 3 generation must be deterministic.
The checkpoint records the exact rule inputs and generated suffix.

## Search plan type

```ts
interface SynthesisPlan {
  schemaVersion: 1;
  function: string;
  baseSourceHash: string;
  analysisHash: string;
  traceHash: string;
  sourceModelHash: string;
  hardConstraints: SourceShapeConstraints;
  roleBindings: SourceRoleBinding[];
  recipes: SynthesisRecipe[];
  stages: SynthesisStage[];
  maxVariants: number;
  maxDepth: number;
  toolchainIdentity: string;
}
```

Each stage should emit one or more ordinary `SourceShapeSearchSpec` artifacts
with exact alternatives and incompatibility constraints. The synthesizer calls
the existing search libraries directly and records the generated specs for
human inspection and replay.

No stage may mutate earlier results or replace the current baseline with the
highest-scoring variant. This is a finite causal experiment graph, not hill
climbing.

---

# Deliverable 7: mechanism-aware evaluation and feedback

For each distinct compiler class, evaluate:

1. source-policy and semantic-safety admission;
2. hard preservation constraints;
3. predicted pass effect;
4. named target-schedule requirement and intervention relation;
5. allocation and target register-role preservation;
6. delayed-branch requirements;
7. opcode stream and instruction count;
8. exact instruction count;
9. full object equality for exact candidates.

Use per-variant target-schedule profiles from
`plans/baseline-aware-variant-schedule-comparison.md` when available. Before
that prerequisite lands, an MVP may evaluate pass snapshots and final
requirements, but it must label scheduler-relation effects as incomplete and
must not perform Stage 3 causal composition from final assembly alone.

Suggested result:

```ts
interface RecipeOutcome {
  recipeIds: string[];
  variantId: string;
  safetyClass: SemanticSafetyClass;
  mechanismVerdicts: HypothesisClassification[];
  interventionResults: Array<{
    interventionId: string;
    status: "confirmed" | "regressed" | "unchanged" | "ambiguous";
    evidence: string[];
  }>;
  hardConstraintsPassed: boolean;
  scheduleDelta?: ScheduleMechanismDelta;
  exactInstructions: number;
  totalInstructions: number;
  fullObjectExact: boolean;
  artifacts: string;
}
```

## First divergence and reconvergence

The existing variant lab reports first meaningful divergence. Add enough
comparison metadata to report later convergence when relevant:

```text
source differs
rtl differs: pointer copy becomes a two-set web
combine converges: same single-set pseudo reaches sched1
result: recipe did not realize the requested priority change
```

This prevents a source-distinct recipe from being counted as a distinct
mechanism after GCC erased it.

## Exact candidates

Any exact cc1 candidate must be assembled through the configured full path.
Any exact object candidate is reported with its preserved source path and the
normal manual promotion/finalization commands. The synthesizer never copies it
to `src/`, updates context, or commits.

---

# Deliverable 8: coverage and stuck report

A failed bounded run should answer what was actually searched. Emit:

- requirements and interventions with source-role bindings;
- recipes applicable to each intervention;
- recipes suppressed by ambiguity or failed semantic obligations;
- atomic and interaction coverage;
- source/preprocessed/RTL/combine/assembly equivalence classes;
- compiler mechanisms confirmed, erased, or regressed;
- hard constraints most often broken;
- unvisited deterministic candidate suffix due to budget;
- intervention kinds with no supported clean-C recipe in the current catalog;
- suggested catalog or source-mapping improvements, not arbitrary C edits.

Suggested terminal classifications:

```text
exact-candidate-found
finite-plan-exhausted-no-exact
budget-exhausted-resumable
source-role-ambiguous
no-safe-recipe-for-requirement
analysis-or-trace-inconclusive
```

This report should be suitable for linking from the function's research note
and for preventing later sessions from repeating the same generated grammar.

---

# Artifacts

Write deterministic artifacts under:

```text
build/sourceShapeSynthesis/<function>/<run-id>/
├── manifest.json
├── source-model.json
├── source-roles.json
├── synthesis-plan.json
├── suggestions.json
├── coverage.json
├── summary.json
├── summary.txt
├── checkpoint.json
├── stages/
│   ├── 0-attribution/
│   ├── 1-atomic/
│   │   └── search-spec.json
│   ├── 2-interactions/
│   │   └── search-spec.json
│   └── 3-composition/
│       └── search-spec.json
└── variants/
    └── <variant-id>/
        ├── source.c
        ├── recipe-lineage.json
        └── ... linked/reused search and trace artifacts
```

Avoid copying duplicate compiler artifacts when an existing content-addressed
search cache can be referenced safely. Every reference must include hashes and
project-relative paths.

Run identity includes:

- base source and protected-construct manifest hashes;
- target analysis and trace hashes;
- synthesizer/source-model/recipe catalog schema versions;
- configured toolchain identity and flags;
- bounds and focused block;
- generated role bindings and safety decisions.

Resume rejects any changed identity input.

---

# Optional later extension: contextual mechanism atlas

After the synthesizer has stable recipe IDs, aggregate observed recipe outcomes
under a generated project-local atlas:

```text
build/mechanismAtlas/
├── observations.json
└── summary.json
```

An observation records:

- recipe and intervention kind;
- source-role shape;
- first divergence and reconvergence;
- pseudo SET/lifetime/allocation effect;
- scheduler relation effect;
- hard constraints preserved or broken;
- function and artifact hashes.

The atlas may prioritize natural recipes that repeatedly realize a mechanism in
similar contexts. It must not prune an otherwise applicable recipe solely
because it failed elsewhere, and it must not treat cross-function compiler
behavior as a semantic proof.

Matching functions and analogous-function retrieval can later seed additional
catalog recipes, but generated edits still require local source-role and safety
validation.

---

# Pi integration

After the CLI, schemas, and tests stabilize, add a bounded wrapper such as:

```text
psx_synthesize_source_shapes
```

Safe arguments:

- exact function name;
- optional block;
- `deriveOnly`;
- `maxVariants` up to 5000;
- `maxDepth` up to 3;
- `jobs` up to 16;
- `resume`.

The wrapper must not accept source text, arbitrary analysis outside the project,
custom edits, shell commands, compiler flags, or automatic promotion.

Update the matching skill so synthesis is used only after:

1. the diff has been classified;
2. compiler trace exists;
3. target-schedule analysis has exact or reconstructed requirements;
4. a strong current source baseline is preserved;
5. ordinary focused hypotheses have not already solved the mismatch.

Bound returned output to the terminal classification, top mechanism outcomes,
uncovered requirements, and artifact paths.

---

# Phased implementation

## Phase 0: feasibility fixtures and source subset

1. Collect compact C89 source fixtures from representative project functions,
   including `func_80019070`'s declarations, macro calls, branch, assignments,
   and barriers without committing generated binaries.
2. Define the supported source subset and explicit refusal cases.
3. Preserve normalized target-analysis and trace fixture excerpts for source
   role binding.
4. Specify recipe safety obligations before implementing generators.

**Exit criterion:** fixtures cover the syntax and source/compiler roles needed
for the motivating prologue, and unsupported syntax has explicit expected
errors.

## Phase 1: lossless source model and semantic safety

1. Implement tokenizer, balanced-delimiter model, blocks, statements,
   declarations, and conservative expression effects.
2. Build local def/use, scope, dominance, address-taking, and memory-effect
   summaries sufficient for initial recipes.
3. Add configured known-macro metadata with header hashes.
4. Implement structured safety obligations and refusal reporting.
5. Add exact-edit rendering tests that preserve unchanged source bytes.

**Exit criterion:** the tool models `func_80019070` without guessing statement
boundaries and can prove or refuse movement/reuse for every relevant local
source operation.

## Phase 2: source-role binding

1. Refactor compiler trace/source-note data into reusable binding inputs.
2. Build compiler roles from target-schedule requirements.
3. Implement ABI, constant, mode, field-offset, source-line, and def/use
   evidence matching.
4. Emit confidence-labelled unique and ambiguous bindings.
5. Add focused text rendering and stable schema artifacts.

**Exit criterion:** the eight principal prologue roles in `func_80019070` are
bound to source values/statements with exact or reconstructed evidence, or the
report states precisely which role remains ambiguous.

## Phase 3: atomic recipe catalog and derive-only plan

1. Implement the initial proof-oriented recipe families.
2. Map interventions to recipe generators.
3. Produce exact edits, safety results, expected passes/effects, and
   incompatibilities.
4. Emit a deterministic `synthesis-plan.json` and Stage 1 source-shape spec.
5. Add `--derive-only` without invoking the compiler.

**Exit criterion:** the motivating analysis automatically produces finite
pointer/header/argument birth, web, lifetime, and statement-order recipes that
were not hand-entered into JSON.

## Phase 4: atomic execution and mechanism attribution

1. Invoke existing source-shape-search libraries for atomic recipes.
2. Reuse compiler caches and pass tracing.
3. Compare predicted pass effects, first divergence, and reconvergence.
4. Evaluate hard preservation constraints before exact score.
5. Emit recipe outcomes and equivalence classes.

**Exit criterion:** known no-effect forms are proven convergent and at least one
archived mechanism-changing source shape is rediscovered and correctly
classified without a hand-authored search spec.

## Phase 5: interaction graph and causal composition

1. Implement compatibility checks after exact edits are composed.
2. Generate deterministic requirement-local pairs and cross-requirement
   pairwise coverage.
3. Add bounded Stage 3 composition from structured mechanism outcomes.
4. Implement checkpoint/resume across stages.
5. Integrate per-variant schedule profiles from the baseline-aware comparison
   plan.

**Exit criterion:** two individually distinct source mechanisms can be combined
because they satisfy connected abstract relations, while percentage-only gains
cannot drive expansion.

## Phase 6: full confirmation, coverage, and Pi integration

1. Assemble every exact candidate and compare target function objects.
2. Add terminal classifications and complete coverage/stuck reports.
3. Add bounded Pi wrapper and workflow documentation.
4. Add disk/caching summaries and cancellation-safe checkpoints.
5. Run the motivating bounded synthesis and record results in the function
   research note whether or not it finds an exact match.
6. Run all TypeScript tests, source policy, exact focused checks, and full
   project verification before reporting the implementation complete.

**Exit criterion:** one command derives, executes, resumes, and explains a
bounded source-directed search against `func_80019070` without changing `src/`.

## Phase 7: mechanism atlas and catalog growth

1. Aggregate stable recipe observations across functions.
2. Add analogous-function evidence as recipe-priority input.
3. Add later evidence-gated families one at a time with safety tests.
4. Version catalog additions so old synthesis runs remain reproducible.

**Exit criterion:** repeated successful compiler mechanisms can improve recipe
ordering and explanations without changing finite coverage or acceptance
policy.

---

# Test plan

## Source model tests

- C89 top-of-block declarations with and without initializers;
- nested compound blocks and shadowed identifiers;
- `if`/`else`, loops, labels, `goto`, and return boundaries;
- macro call treated as opaque by default;
- comments and strings containing delimiter-like text;
- casts, pointers, arrays, and struct fields;
- address-taken and escaping local detection;
- unknown/unsupported syntax produces refusal, not a partial edit;
- exact source spans survive round-trip rendering;
- no C99 source is generated.

## Source-role tests

- parameter ABI register role;
- stack parameter load role;
- unique constant definition;
- two identical constants remain ambiguous until UID/use evidence separates
  them;
- field store mapped by offset and source macro metadata;
- source-line note plus operation yields exact/reconstructed binding;
- inferred expression similarity does not become compile-eligible;
- pseudo renumbering does not change persistent role identity.

## Semantic safety tests

- split initializer with dominating first assignment;
- reject split when `goto` bypasses assignment;
- move pure assignment inside valid def/use window;
- reject crossing unknown call or volatile access;
- reorder proven-disjoint scalar statements;
- reject possible pointer-alias memory reorder;
- materialize one side-effect-free expression exactly once;
- reject expression with call, increment, or volatile read;
- reuse non-overlapping same-mode locals;
- reject overlapping liveness, address-taking, or incompatible signedness;
- known macro expansion verifies definition hash and evaluation count;
- changed macro definition invalidates cached proof.

## Recipe planner tests

- each intervention kind maps only to supported mechanism families;
- no source binding means no emitted edit;
- reconstructed binding emits recipe with evidence;
- combine-proven no-effect recipe is marked covered;
- incompatible/overlapping edits are rejected;
- natural priority is deterministic;
- no forbidden recipe family can be instantiated.

## Candidate graph tests

- deterministic atomic recipe ordering;
- all requirement-local compatible pairs covered within budget;
- cross-requirement pairwise coverage deterministic;
- compensating pair remains eligible despite one regressing atomic result;
- Stage 3 uses mechanism results, not exact percentage;
- maximum depth and variant budget enforced;
- full small product used when it fits;
- unvisited suffix checkpointed and resumed exactly;
- source/preprocessed/pass/assembly classes deduplicated without losing lineage;
- changed analysis/source/catalog/toolchain invalidates resume.

## Evaluation tests

- predicted RTL change confirmed then erased by combine;
- requested LUID relation changed while exact score stays equal;
- exact score improves but hard suffix regresses;
- allocation role changes despite desired sched1 relation;
- mechanism-confirming lower score remains useful and nonmatching;
- machine-equivalent schedule-profile regression is rejected for composition;
- untraced variant cannot claim scheduler success;
- exact cc1 result remains nonterminal until full object confirmation;
- exact object candidate is reported but never copied to `src/`.

## Motivating regressions

Use reduced fixtures to assert that the synthesizer:

1. derives hard preservation ranges 0 and 10–80 for the current mismatch;
2. binds header constants, pointer copy, arg2/arg3 normalization, nibble/mask,
   and stack arg8 roles;
3. generates finite birth/LUID/web/lifetime recipes from the current seven
   abstract relations;
4. does not generate broad unrelated statement permutations;
5. retains the three baseline-approved barriers through the separate protected
   construct mechanism;
6. identifies the known `u16`/direct-input shape as final-assembly-equivalent
   but mechanistically regressed when schedule profiles are enabled;
7. rejects tied register-output barriers and other forbidden dependency hacks;
8. preserves every source and compiler artifact under `build/`;
9. either finds an exact candidate or emits a complete finite-plan coverage
   classification without claiming success.

Also retain one historical before/after fixture where a clean source mechanism
is known to improve or solve scheduling, such as the variable-recurrence and
constant-birth mechanisms from `func_800154CC`. The synthesizer should derive
that recipe family from requirements rather than receiving the final edit in a
manual spec.

---

# Acceptance criteria

## Direct solution-seeking behavior

- The tool derives concrete clean-C exact edits from target-schedule
  interventions and current source roles.
- It can generate useful source alternatives not manually listed for the
  function's run.
- It tests bounded interactions and causal combinations, not only atomic edits.
- Search expansion is driven by requirement satisfaction and compatibility,
  never raw match percentage.
- An exact candidate is fully assembled and preserved for normal manual
  finalization.

## Safety and reproducibility

- Every compiled recipe has structured semantic obligations with all required
  preconditions proved.
- Ambiguous or unsupported source regions produce explicit refusals.
- No forbidden source construct, compiler flag, or source mutation path exists.
- Candidate generation, staging, caching, and resume are deterministic and
  schema-versioned.
- Existing compiler, trace, target-analysis, source-search, and object-diff
  implementations are reused.

## Diagnostic value when no solution is found

- The report identifies which abstract interventions received clean-C recipes,
  which recipes GCC erased, which broke solved constraints, and which
  requirements remain uncovered.
- Equivalent source/compiler classes are not repeatedly compiled.
- Budget exhaustion is resumable; finite exhaustion is distinguished from
  inconclusive mapping or lack of a safe recipe.
- The tool never turns finite search failure into a compiler/assembler claim.

## End to end

- A future investigator can invoke one bounded command after target-schedule
  analysis and obtain an inspectable, source-directed clean-C search rather
  than manually authoring every source-shape grammar dimension.
- On `func_80019070`, the tool operates against the actual strong baseline,
  preserves its solved suffix/allocation/delay slots, and either discovers an
  exact clean-C form or materially narrows the remaining source-mechanism gap.
- Exact function diff, clean-source policy, modification-scope verification,
  and full binary identity remain the final acceptance gates.

# Non-goals

- Guaranteeing that a matching clean-C source exists or can be recovered.
- General C semantic equivalence proving.
- Full C/C++ parsing or rewriting arbitrary project files in the MVP.
- Random fuzzing, genetic algorithms, beam search, or percentage hill climbing.
- Brute-force permutation of every statement, declaration, type, or expression.
- Inferring target RTL or original variable names as fact.
- Inline asm, new barriers, register pinning, volatile perturbations, no-op
  syntax, dead control flow, compiler patches, or flag overrides.
- Automatic source promotion, context export, commits, or autonomous acceptance.
- Replacing human review of inferred program semantics and final source quality.
