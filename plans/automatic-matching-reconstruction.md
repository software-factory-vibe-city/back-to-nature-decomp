# Automatic matching reconstruction

## Implementation record (2026-09-09)

The engine is in the tree and in production use. What exists, mapped to the
phases below:

- **Engine** — `tools/agent/reconstructFunction.ts` (CLI, registered as the
  `psx_reconstruct_function` Pi tool) over
  `tools/agent/matching-reconstruction/`: `decode.ts` (R3000 integer-subset
  decoder over raw words), `exec.ts` (bounded symbolic executor: live-register
  state merging, delay-slot semantics, store effects with forwarding and
  conservative cross-base invalidation, hash-consed decision DAG),
  `scan-relation.ts` (scan fit verified by template-DAG identity),
  `access-index.ts` (container-wide witnessed base+offset mining, provenance
  cached), `construct.ts` / `effect-construct.ts` (typed C89 AST, storage
  mapping, parameter plans, candidate enumeration), `engine.ts` (routing,
  oracle loop, terminal states, result bundles under
  `build/matchingReconstruction/<fn>/`).
- **Supported relation classes** — (1) fixed-bound read-only record scans,
  with standalone-label, witnessed embedded-parent, and offset-start-window
  origins; (2) straight-line store/return effects, including increment idioms,
  `sltiu 1` ⇒ `== 0`, empty functions, and gp-relative tentative definitions
  derived from the access's own base register; (3) bounded guarded decision
  trees with common-effect-prefix factoring. Storage: absolute cells,
  argument-pointer cells (pointer-typed parameters), and loaded-pointer cells
  (pointer-to-view typed globals, recursive).
- **Phase A** — A1 done: `candidateObjectInputs` in
  `tools/agent/pipeline-reversal/reverse.ts` fingerprints transitive headers
  (`sourceDependencyFiles` via cpp `-MM`), `configs/flag_overrides.mk`, the
  Makefile, and effective flag sets, and verifies cached object bytes
  (`candidate-provenance.test.ts`). A2 partial: the engine records both
  symbolic origins and compares through the relocated-byte oracle; the
  inventory-report distinction is not built. A3 done as a structural guard
  (`authority.test.ts`: no diagnostic module can veto a candidate).
- **Phase B** — frozen manifest at
  `configs/reconstruction/benchmark-manifest.json` (11 development regressions
  with per-mechanism expectations, 20 challenge/parked, 94 stratified
  held-out, container image hashes with input-drift refusal);
  `tools/diagnostics/benchmarkReconstruction.ts` runs sets, the §8 census
  (`--census`), and the raw-m2c baseline (`--m2c-baseline`; 0/11 byte-exact on
  the development set). Not built: the restricted/bootstrap-context evaluation.
- **Phase C** — done; the §2 exit gate passes from source-hidden inputs
  (29/29 words, ~17 compiles, ~2.5 s) and is a gated regression test.
- **Phase D** — deliberately not built: every current domain is ≤ ~100
  candidates evaluated in seconds, so unguided enumeration wins on cost by
  this plan's own §7 exit criterion.
- **Phase E** — two census-led expansions delivered (effects, guarded trees;
  plus pointer bases and offset-start windows as origin growth). The census
  over all 1,971 unmatched functions names the remainder; see the successor
  plan below.
- **Phase F** — the standalone entry point, terminal states, budgets, and
  result bundles exist; integration remains manual-with-gates (14 engine
  winners were integrated by hand on 2026-09-09: per-function `diffFunc`
  MATCH, `make check-all` byte-identity on all 14 containers, header roles
  respected, generated headers regenerated). Automated transactional
  integration to a `verified` state is not built. The autonomous loop is
  deprecated; the engine-first flow lives in
  `.pi/skills/psx-decompile-function/SKILL.md`.
- **Results at freeze** — 14 previously-unmatched functions byte-exact and
  integrated; 66 near-misses (relation recovered, grammar lacks a witness);
  census: calls 1,697 fn / 525 KB, undecoded ops 42 fn, read-only non-scan
  33 fn, symbolic-bound 16 fn.

**The remaining machine-model coverage — mult/div, computed indexing, jump
tables, stack frames, calls, symbolic-bound loops — is specified as an
implementable sequence in `plans/matching-reconstruction-model-completion.md`.**
The sections below are the original design and remain the rationale of record.

## 1. Deliverable and boundaries

Build a tool that accepts **original function bytes, the configured toolchain,
and permitted project context**, and produces either:

- clean C89 and its required context changes, verified to reproduce the original
  bytes through the unchanged production build; or
- an explicit unresolved result identifying the unsupported feature, missing
  evidence, exhausted bounded domain, or remaining budgeted work.

No LLM authors candidates, chooses experiments, or interprets reports in the
supported path. Names and higher-level organization can be refined afterward,
while preserving the match. Automatically improving m2c output is not the
product, and an agent-facing diagnostic is not a completed reconstruction rule.

Byte identity remains mandatory. A semantic lift, runtime tests, or a static
recompiler may assist analysis; none substitutes for the byte oracle. The
reconstruction need not recover uniquely historical source. It must produce an
acceptable compiler preimage, not assembly hidden inside C.

Start with the active configured toolchain. Read concrete versions, flags,
container rules, and header roles from `configs/project-profile.md` and their
source configuration; do not introduce a second hardcoded toolchain definition.
Supporting other compiler families is later work, not an automatic consequence
of this implementation.

### Non-goals for the first implementation

- Recovering every function or proving that every binary has a clean-C preimage.
- Reconstructing a complete historical RTL trace before emitting any source.
- Building a new emulator, host port, compiler, or assembler replacement.
- Searching arbitrary flags, invented globals, inline assembly, register pins,
  or dead operations whose only purpose is manipulating compiler internals.
- Replacing existing verification, checkpointing, or compiler instrumentation.

## 2. The concrete failure the tool must remove

The investigation is recorded in
`notes/research/ovl_11_func_800F13D8-embedded-table-origin.md`.

The function scans five 12-byte records. It tests a signed halfword at offset
zero against zero, then a signed halfword at offset two against a zero-extended
16-bit argument. It returns one on the first match and zero otherwise.

The disassembler calls the table `D_800742B0`. Independent accesses elsewhere
also identify it through this relationship:

```text
D_8006C838 + 0x7A78 = D_800742B0
```

The matching reconstruction uses a partial containing-object view with an
embedded `s16 records[5][6]`, an ordinary indexed loop, and a result variable
with `break`. This changes loop optimization compared with a standalone table.
The target's separated first iteration and pointer machinery need not be
literal source constructs.

An explicit-cursor candidate reproduced the operations and ordering but left
two register-role discrepancies. Its allocation diagnosis was valid **for that
candidate**. Solving only that register contest excluded the representation
that ultimately matched all 29 instructions under normal configured flags.

Therefore the new tool must construct and retain alternatives for **object
origin, layout, and loop form together**. Merely widening statement permutations
inside an m2c draft does not address this failure.

## 3. Architecture: target facts to source-reachable alternatives

```text
original bytes + independently supported context
    -> machine semantics and address/access evidence
    -> alternative object layouts and source control structures
    -> typed clean-C constructors with compiler-mechanism requirements
    -> deterministic, bounded exploration of compatible combinations
    -> production compiler + relocated-byte oracle
    -> exact candidate bundle or explicit unresolved artifact
    -> authorized transactional integration + full verification
```

Keep three different kinds of information separate:

1. **Target facts:** decoded operations, load widths, branches, resolved
   addresses, and independently witnessed access relationships.
2. **Reconstruction hypotheses:** containing objects, aggregate layouts, source
   loop direction, temporary reuse, and other possible predecessors.
3. **Candidate observations:** the actual movables, induction reductions,
   lifetimes, and scheduling decisions of a generated source.

A candidate trace is not the original's erased trace. A residual owner is not
an unconditional instruction to freeze all earlier reconstruction choices.

### Core records

Define versioned TypeScript records for:

- **Input bundle:** target/container identity, original bytes, context snapshot,
  dependency hashes, effective compilation commands, and tool versions.
- **Access relation:** instruction witnesses, resolved storage namespace,
  address expression, induction terms, width, extension, read/write effect,
  guard, and any unresolved alias or bound.
- **Origin/layout alternative:** proposed base and offset, element layout,
  minimum witnessed extent, evidence, contradictions, and assumptions. Object
  extent and translation-unit ownership are separate properties.
- **Construction rule:** applicability conditions, typed AST constructor,
  interacting choices, expected compiler effect, and validation procedure.
- **Search branch:** chosen alternatives, remaining domains, measured artifacts,
  dependency-scoped exclusions, costs, and resumable state.
- **Result bundle:** generated source/context patch, verification evidence, or
  a precisely scoped unresolved reason.

Use the existing tree-sitter infrastructure to inspect or transform C context.
Do not introduce another regex-based source frontend. Preserve source forms
with different possible compiler histories even when their semantics agree.

## 4. Phase A — repair measurement integrity

**Purpose:** prevent stale artifacts or symbolic spelling differences from
eliminating valid reconstructions before search begins.

### A1. Make compilation provenance complete

Audit the candidate cache beginning with `ensureCandidateObject` in
`tools/agent/pipeline-reversal/reverse.ts`, using
`tools/agent/decompToolchain.ts` and `tools/agent/provenance.ts` as the shared
integration points.

Include effective preprocessing/compiler/assembler arguments, relevant
configuration, transitive header dependencies or a verified preprocessed-input
identity, and tool implementations in the appropriate cache keys. Target and
symbol/layout changes must invalidate comparisons even when an object remains
reusable. Verify cached artifact contents, not just their continued existence.

Tests must change and restore a per-function override, an included header, a
container flag, and symbol resolution without editing the C. Cached and fresh
runs must agree in every state. Do not repair this by disabling all caching.

### A2. Compare address meaning without destroying source-origin alternatives

Normalize resolved memory expressions using the existing symbol/container
infrastructure. A base plus displacement and an independently resolved label
at the same address must be comparable without forcing both to use the same C
object. Preserve both symbolic origins for reconstruction.

The namespace must distinguish overlapping overlay storage while allowing an
overlay's reference to a shared executable global. Numeric address equality
alone cannot establish identity across containers, object ownership, or alias
safety. Unresolved addresses remain unknown.

Update inventory reporting to distinguish a proven content discrepancy from
an unresolved correspondence or a different symbolic decomposition. Different
load counts or compiler-generated pointer operations are not automatically
semantic defects either.

### A3. Scope diagnostic authority

Reproduce the intermediate pipeline round-trip failure from the investigation.
Repair the reconstruction if its mechanism is supported; otherwise propagate
an explicit unsupported/provisional result. Such a result cannot create a hard
search exclusion or veto an independently byte-exact candidate.

**Exit gate:** regression tests reproduce the stale-cache and address-origin
failures before their fixes, pass afterward, and still reject a genuinely
wrong field offset, symbol, or overlay. Relevant tooling tests and `make check`
pass. No production flag change is required.

## 5. Phase B — freeze the evaluation contract

Run this alongside Phase A, before tuning constructors against more functions.

### B1. Separate development, held-out, and operational evaluations

- **Development regressions:** the embedded-table case and the count-up loop
  that the compiler reversed, documented in
  `notes/research/func_80017300-pre-placement-and-movable-order.md`.
- **Representative held-out set:** stratify eligible functions by size,
  container, calls, loops, memory patterns, and control structure. Split by
  related source/data family to reduce leakage. Freeze the manifest and hashes.
- **Challenge set:** selected historical long-running or parked cases, reported
  separately rather than presented as representative of the game.
- **Operational run:** the real current project context, explicitly allowed to
  benefit from prior matched functions and accumulated declarations.

Known matching C is evaluator-only in the held-out test. Hide target bodies,
backups, solution-specific typedefs/prototypes, notes, ledgers, and saved
variants. Rebuild a permitted context snapshot rather than merely replacing
one body with `INCLUDE_ASM`. Log the inputs the generator can read.

The embedded-table regression specifically must not read
`D8006C838RecordTableView` or its solved source. It may inspect other functions'
original machine accesses to derive the parent relationship. This is a known
mechanism development test, not a held-out success.

Also distinguish **warm-project context** from **restricted/bootstrap context**.
A tool tested only with this project's reconstructed types has not demonstrated
new-game reconstruction.

### B2. Measure three different questions

1. **Expressivity:** can the automatically derived constructor domain contain
   an exact clean-C witness, even with a generous offline budget?
2. **Search effectiveness:** how cheaply can the tool find that witness?
3. **End-to-end coverage:** how many functions succeed from the permitted
   inputs, including lifting, context preparation, and integration failures?

Compare raw m2c, the existing automatic source search where applicable, the new
constructors in deterministic unguided order, and compiler-guided exploration
of the **same domain**. Count noncompilation and unsupported inputs; do not
silently omit them from the denominator.

Report exact functions and bytes, unresolved categories, compiler calls,
distinct outputs, preprocessing/analysis cost, CPU, wall time, peak memory, and
cold/warm-cache results. Publish median and tail costs, not just best cases.
Choose and freeze operational budgets after measuring baseline costs; budget
numbers are experimental settings, not promised performance.

**Exit gate:** a reproducible evaluator can hide a solution, run each baseline,
and independently verify its result. No implementation-progress claim relies
on byte-match percentage or the already-known regression alone.

## 6. Phase C — reconstruct one supported class from bytes

**First supported class:** fixed-bound, integer-returning, read-only scans of
affine fixed-stride records, with guarded integer field tests and no calls.
Start with the widths and control patterns needed by the embedded-table case.
Detect unsupported effects explicitly. Do not require an m2c source seed.

### C1. Recover the machine-level scan relation

Reuse the existing decoder, def/use analysis, and pipeline lifting where their
contracts suffice. Model branch and load delays correctly before deriving
control or value relations. Recover:

- loop-carried affine recurrences and path-specific updates;
- the visited record range and first-iteration behavior;
- field addresses, load extensions, and comparison promotions;
- guards and short-circuit behavior;
- success and failure return values.

Recognize compiler-created first-iteration separation and compensated pointer
updates using bounded control-flow/recurrence rules. Do not require the raw CFG
to be reducible in exactly the form a source structurer expects. Each rule must
account for entry, back-edge, exit, and update paths; an unaccounted path is an
unsupported case, not permission to guess.

For the regression, derive the five-record relation, stride 12, field offsets
zero and two, signed loads, and zero-extended argument without reading its C.
Use bit-vector/integer relations that preserve the actual promotions; changing
the argument to a signed halfword is not an equivalent reconstruction.

### C2. Build a target-derived memory access index

Index affine accesses across original functions, not only nearby addresses or
already-matched sources. Record instruction witnesses and unresolved terms.
Join compatible access families by resolved storage and overlapping ranges.

Generate origin alternatives from independently witnessed bases, explicit
base-plus-offset uses, known section boundaries, and established object facts.
Do not enumerate every preceding global as a possible parent. Constant address
differences establish arithmetic, not containment by themselves.

For the regression, other searches and the record-shifting writer should
supply the parent-base relationship automatically. Their shared data use must
not manufacture a same-translation-unit claim.

### C3. Derive finite layout alternatives

From widths, offsets, stride, and bound, construct compatible representations:

- a standalone record array where context permits it;
- flat or row-structured integer storage;
- an array embedded in an independently supported containing object;
- scalar-field versus array-field record views when both fit the observations.

Unknown bytes remain explicit padding. Record only the witnessed minimum
extent; do not claim the whole containing object's size. Check alignment,
field offsets, pointer bounds, and access widths. Apply the project's actual
compiler semantics and source policy rather than silently adding aliasing or
ownership assumptions.

Emit provisional context in an isolated candidate bundle. Shared view types
and global overrides must use the header roles in the generated profile;
source-local redeclarations of generated globals are not a workaround.

### C4. Construct complete typed C witnesses

Implement natural counted loops, condition nesting, result-and-break and
compatible return forms, with bounded indexed/cursor alternatives. Layout and
loop choices must compose; an embedded origin cannot be tested only with the
same cursor source that created the allocation residual.

Each constructor consumes the recovered relation and emits a complete C AST,
necessary types/includes, and explicit invariants. Constants, record counts,
field positions, and parent offsets come from evidence, not function names.
Do not embed the solved function as a template selected by its address.

Compile through the production toolchain and compare original relocated bytes.
For promising candidates, inspect loop traces to distinguish actual base
availability and induction reduction from similar-looking final instructions.
Match semantic roles, not the example's incidental RTL UID numbers.

**Exit gate:** one unattended invocation reconstructs and verifies an exact
clean-C bundle for `ovl_11_func_800F13D8` from the source-hidden inputs, using
normal configured flags and no agent-generated variants. It also passes
parameterized synthetic scan tests varying counts, strides, offsets, guards,
signedness, and address low-half boundaries, plus unrelated real scans.
Negative cases with writes, unsupported control flow, or uncertain storage are
reported honestly. The invocation leaves live sources untouched.

This is the first product milestone. Do not build a universal inverse-RTL
framework before demonstrating this end-to-end slice.

## 7. Phase D — replace expensive enumeration with compiler-guided construction

Once the Phase C domain demonstrably contains solutions, improve its search.
Keep an unguided enumerator as a coverage and correctness control.

### D1. Make compiler mechanisms executable construction rules

For each supported mechanism, implement all four parts:

1. a target-side applicability/requirement derivation;
2. a finite set of source-reachable predecessor alternatives;
3. a typed constructor that realizes each alternative;
4. a forward compiler check that measures the predicted effect.

Start with the mechanism just demonstrated: containing-object/array
representation changes initial address expressions, which changes invariant
availability and induction-variable reduction. Use the existing loop-emission
and loop-trace machinery; add missing evidence there rather than duplicating
it in a private interpreter.

A requirement such as "two field bases available in the first loop pass" is
not a delivered feature until the tool can construct and test C that realizes
it. Likewise, a scheduler or allocator SAT witness is not promotable source.

Validate rules with compiler-generated fixtures and held-out examples. Tests
establish observed coverage; they do not prove a rule sound for every compiler
state. Hard exclusions need checked preconditions and a justified model.

### D2. Search compatible histories, not one committed draft

Maintain a dependency graph over origin, layout, control form, expression/web
form, and compiler-mechanism choices. Compile joint assignments where choices
interact. Share immutable facts and candidate artifacts between branches.

Use target requirements and replay-validated residuals to prioritize work.
Do not prune an origin because its first candidate has a worse byte score or
staged residual. Do not close earlier alternatives because one branch now has
an allocation-only mismatch. Preserve alternatives that temporarily regress
while changing a necessary upstream mechanism.

Exclusions must name the assumptions they depend on. A failure under a
standalone-array origin cannot exclude an embedded-array origin. Budget
exhaustion, model failure, and bounded UNSAT remain distinct outcomes.

### D3. Deduplicate at the right level

Reuse existing content-addressed artifacts, deterministic enumeration,
checkpoints, and bounded workers. Avoid recompiling identical preprocessed
input. Reuse a final-byte comparison for identical outputs, but do not merge
all future descendants of sources merely because they currently emit the same
bytes: their earlier RTL and available constructor extensions can differ.

Trace only where it resolves a choice or validates a construction rule. Include
trace and constraint-solving overhead when comparing guidance with enumeration.

**Exit gate:** guided exploration retains the unguided domain's known witnesses
and reduces measured total cost on the frozen evaluation slice. Replay failures
never become exclusions, and resume reproduces the same experiment identities.
If guidance costs more, retain simpler enumeration for that class rather than
calling added machinery progress.

## 8. Phase E — grow coverage by measured missing constructors

Classify unresolved functions before adding mechanisms. Prioritize by affected
function/byte count, anticipated implementation cost, and available evidence.
The following are candidate expansions, not a promise to build all of them in
this order:

| Missing source origin | Existing machinery to extend | Required construction capability |
|---|---|---|
| Count-up source behind a countdown target; nested-loop hoists | Loop emission and loop traces | Build alternative loop predecessors and validate placement/reduction |
| Switch, if-chain, shared tail, or cross-jumped control flow | Pipeline reversal and CFG analysis | Construct compatible source control frames, not freeze target gotos |
| SDK packet or aggregate operation boundary | SDK idiom detection and vendored headers | Emit the actual macro/type operation with derived arguments |
| Parameter residence, signedness, or aggregate passing | Frame map and independent callee evidence | Construct valid signatures/context alternatives and check affected callers |
| Global origin or ownership affecting addressing | Symbol/access index and ownership derivation | Emit evidenced declarations/definitions without inventing objects |
| Genuine remaining allocation or scheduling difference | Existing replay models and finite source grammars | Realize constrained webs/orderings in clean C and verify them |

Each expansion must deliver a target recognizer, an explicit unsupported
boundary, a source constructor, forward validation, and source-hidden tests.
A new report or another manually supplied variant manifest does not count.

Use the reversed-loop case as a later structural regression. Use unresolved
cases such as `func_80017F30` and `ovl_11_func_800D5D38` to discover missing
constructors, not to assume their historical allocation diagnoses are the
only possible explanation.

Only consider isolated pass replay/injection when a measured ambiguity cannot
be handled economically with whole-source compilation. Compiler pass state
includes metadata beyond printed RTL, and a locally replayable state can still
be unreachable from C. Keep such a harness diagnostic and require complete
source compilation before accepting any result.

**Exit gate per expansion:** held-out coverage improves at a reported cost,
existing exact cases do not regress, and failure states stay scoped. Revisit
the representation if the grammar lacks witnesses; tune search only when
witnesses exist but are expensive to reach.

## 9. Phase F — unattended operation and safe integration

Expose a single reconstruction entry point with deterministic budgets, resume,
JSON output, and generated artifacts under `build/`. The solver itself must
not require Pi, network access, model credentials, commits, or worktrees.

Suggested terminal states:

| State | Meaning |
|---|---|
| `exact-candidate` | Clean candidate bundle passes the relocated-byte oracle; not yet integrated |
| `verified` | Authorized integration also passes context regeneration, scope, policy, and full build |
| `unsupported-target` | A target operation/control pattern is outside the implemented class |
| `context-unresolved` | Required symbol, type, boundary, or ownership evidence is missing |
| `oracle-undetermined` | Relocation or toolchain evidence cannot establish byte identity |
| `model-inconclusive` | A diagnostic replay or correspondence cannot be trusted |
| `domain-exhausted` | All candidates in the named finite domain were evaluated without an exact result |
| `budget-exhausted` | A valid checkpoint retains unevaluated alternatives |
| `input-drift` | Resume inputs differ from the recorded bundle |
| `tool-failure` | An infrastructure failure, not a decompilation conclusion |

Reuse transactional integration and finalization where appropriate. Require
explicit authorization before applying source/context changes; never commit
or create worktrees implicitly. A failed integration must preserve unrelated
workspace changes and retain the candidate artifact.

Regenerate generated declarations through their supported generator. Recheck
all affected matched functions when shared context changes, then run the full
binary, modification-scope, and clean-source gates. Function `.text` equality
alone does not establish correct associated data or whole-project layout.

Add a thin Pi wrapper after the standalone engine works, following the existing
registration tests. Let automation call the engine before spawning an LLM;
an unresolved artifact can be a later human/agent handoff without making the
supported path depend on that handoff. Every function advertised as supported
must have an automated construction route, even if a particular run exhausts
its budget.

## 10. Implementation placement and reuse

Implement in TypeScript in the established tool directories. Proposed new
locations below do not exist yet:

- `tools/agent/reconstructFunction.ts`: standalone public entry point. <!-- doc-ref-ignore -->
- `tools/agent/matching-reconstruction/`: typed relations, constructors,
  branch engine, validation, result serialization, and colocated tests.
- `tools/diagnostics/benchmarkReconstruction.ts`: frozen-context evaluator. <!-- doc-ref-ignore -->
- `configs/reconstruction/`: versioned benchmark manifests and declared
  supported-class/budget configuration; no extracted binary artifacts.
- `build/matchingReconstruction/`: immutable inputs, candidate bundles,
  checkpoints, compiler traces, and verification reports.

Reuse these existing components rather than fork their implementations:

| Existing component | Role in the new path |
|---|---|
| `tools/lib/container.ts`, `tools/lib/symbolIndex.ts` | Container-aware identity and address resolution |
| `tools/lib/functionOracle.ts` | Original-byte comparison and relocation |
| `tools/agent/decompToolchain.ts`, `tools/agent/provenance.ts` | Configured compilation and artifact identity |
| `tools/agent/pipeline-reversal/` | Machine lifting and replay-qualified correspondence |
| `tools/agent/loop-emission/`, `tools/agent/loop-trace/` | Target requirements and candidate optimizer observations |
| `tools/agent/residual-source-search/` | C frontend, supported rewrite constructors, enumeration infrastructure |
| `tools/agent/variant-lab/` | Preserved source/compiler experiments |
| `tools/agent/experimentLedger.ts`, `tools/agent/closedDirections.ts` | Measurement history and assumption-scoped exclusions |
| `.pi/extensions/shared/` | Existing integration/policy machinery, subject to authorization |

Add shared helpers only when another consumer needs them. Extend the relevant
existing module for cache or inventory fixes. Wire new test directories into
the repository test command, and update tool documentation/registration when
entry points land.

This plan complements `plans/residual-source-search-completion.md`: that work
explores representations of an existing source; this work must construct
source origins from the target. It builds on
`plans/deterministic-pipeline-reversal.md` without assuming every pass has a
small independently invertible domain or that local inverses necessarily
compose into valid C. `plans/static-recompilation-project/overview.md`
describes a different acceptance contract and is not the implementation
route here.

## 11. Work order and decision gates

1. **Repair and test measurement identity**; freeze the evaluation inputs in
   parallel. Do not begin coverage claims on stale or solution-leaking inputs.
2. **Implement target scan relations and the access-origin index.** Demonstrate
   inferred fields, guards, bounds, and parent evidence before generating C.
3. **Implement layout/control constructors and a bounded enumerator.** Require
   the source-hidden embedded-table reconstruction end to end.
4. **Measure the grammar ceiling.** If the tool cannot express witnesses, add
   missing constructors rather than allocator diagnostics or larger budgets.
5. **Add mechanism-directed exploration.** Compare against the same unguided
   domain and keep only guidance that pays for its cost.
6. **Package safe unattended execution and authorized integration.** Require
   exact candidate bundles, reproducible unresolved results, and full gates.
7. **Expand by the measured failure census**, with one source-hidden vertical
   slice per new mechanism and periodic frozen held-out evaluation.
8. **Evaluate a second configured project/toolchain only after local coverage
   and costs are credible.** Report context acquisition and toolchain gaps
   separately from source reconstruction.

The research question is not whether the byte oracle can reject wrong C. It
already can. It is whether target-derived, source-reachable alternatives cover
a useful fraction of real functions at acceptable total cost. The first
milestone answers that question for one concrete failure class; subsequent
held-out results, not the ambition of the architecture, determine whether it
is becoming a general automatic matching decompiler.
