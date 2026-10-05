# Callgraph-driven type propagation for static m2c preparation

Status: **bounded core implemented; acceptance incomplete; active Task 1 follow-up**.
The delivery record below distinguishes implemented mechanisms from the failed
primary acceptance gate. Nothing here grants permission to commit.

Related: [plan index](README.md), [Task 1 contract](01-context-and-handoff.md),
[current evidence](task-01-changeset-overview.md). Optional declaration publication
and historical backtests remain separate, deferred work.

## 1. Goal and the missing mechanism

For a requested function, build its relevant original-code callgraph, recover
argument/return/storage relationships, and propagate justified type constraints
through that graph before running m2c. Information should bubble up from known
SDK/verified callees through wrappers and callbacks to the target, and flow back
from witnessed callers and storage uses where that adds constraints.

The current correction identifies callback tables, inspects their immediate
entries and supplies their original assembly to m2c. Static discovery carries
some direct-call access facts once over a small selected neighbourhood. It does
not recursively expand each entry's dependencies or iterate their summaries to
convergence. Supplying several assembly files is not itself evidence that useful
multi-function type propagation happened.

Consequently, “four callback contracts remain unresolved” currently means
**the implemented analysis has not resolved them**, not that the binary lacks
sufficient evidence. A missing source declaration is a starting point for graph
analysis, not its stop condition.

Deliver a general mechanism that changes the actual m2c inputs/inference and raw
output. A better report alone does not complete this work.

## 2. Scope and implementation boundaries

Reuse the established components:

| Component | Role in this work |
|---|---|
| `tools/agent/callGraph.ts` | Existing cross-container worklist graph; reuse its symbol/container model, but do not mistake its residual-assembly direct-call edges for a complete analysis graph |
| `tools/lib/symbolIndex.ts`, `tools/lib/container.ts` | Function spans, storage/symbol identity and container resolution |
| `tools/agent/machine-ir/` | Original-word CFG/SSA, correctly placed delay slots, value and memory effects |
| `tools/agent/calleeTruth.ts` | Independent SDK/source contracts and ABI witnesses |
| `tools/agent/staticDiscovery.ts` | Target-rooted expansion, access facts and propagation integration |
| `tools/agent/declarationContext.ts` | Scope-aware type identity and dependency-complete projection |
| `tools/agent/prepareFunction.ts` | Select graph inputs, feed m2c, measure raw output and preserve freshness |
| `tools/vendor/m2c-patches/` | General inference/emission changes if native m2c cannot consume the required constraints |
| `tools/agent/campaign/packet.ts` | Concise handoff and linked evidence, not a graph dump in the prompt |

Factor reusable graph/constraint logic under the existing tools structure rather
than embedding another graph walker in each consumer. Repository tooling remains
TypeScript; vendored m2c changes use the existing reproducible patch workflow.

No controller/worker redesign, new worklist ranking, cache framework, source
repair, declaration publication or automatic signature export is included.
Keep existing preparation/resume and finalization routes.

## 3. Construct an evidence graph from original code

Start at the requested function. Include matched and unmatched functions: a
matched caller's original calls must not disappear because its nonmatching
assembly file no longer exists. Decode configured original function spans when
assembly artifacts are absent. Reuse existing original-word decoding rather than
reconstructing edges from newly compiled candidate C.

Discover these relationships, with a call-site address and witness for each:

- **Direct calls**, including SDK and cross-container engine calls.
- **Resolved indirect calls:** follow function addresses through copies, loads,
  stores and table indexing in CFG/SSA. Record each candidate target and whether
  the target set is closed or still has an unknown remainder.
- **Callback tables/registrations:** recover original data entries and code that
  publishes function pointers. A table membership edge is not automatically a
  call edge; connect it to a witnessed dispatch or registration path.
- **Tail calls:** identify transfers out of the function with the relevant ABI
  state. Do not confuse intra-function branches, switch jumps or returns with
  tail calls.
- **Incoming callers and shared storage users** needed to constrain a live
  parameter, result or loaded function pointer. Shared storage adds data-flow
  dependencies; it does not make every user a caller or establish record identity.

Expand recursively along unresolved dependencies, not just one hop. Prefer paths
that can constrain the target's open facts; reuse a graph index for incoming
edges without walking the whole project on every function. Preserve self-edges
and cycles. Do not use worklist eligibility/decompiled status to prune evidence.

Nodes are container-qualified function/storage identities, not bare RAM addresses.
An overlay and the executable may share engine symbols; unrelated overlay
lifetimes at the same address must remain distinct. If dynamic overlay resolution
or an indirect target cannot be established, keep an unresolved edge with its
remaining possibilities rather than guessing a destination.

Record graph completeness separately from propagation convergence. A fixed point
on a truncated graph is not a complete analysis.

## 4. Recover local summaries and seed known types

For each visited function, build a summary over its original CFG/SSA:

- Incoming ABI slots, including stack parameters, unread holes, wide values and
  hidden ABI parameters where applicable. Reuse existing frame/callee evidence;
  do not equate register-word counts with C parameter counts.
- Actual SSA values reaching each call's argument slots, after its delay slot;
  distinguish entry values, explicit setup, stale values and call clobbers.
- Return values reaching exit/tail paths and the caller's uses of those values.
  Respect wide/aggregate return conventions where supported; explicitly mark
  unsupported ABI forms instead of assuming every result is `$v0`.
- Dereferences, widths, signedness of operations, offsets, strides, address-taking
  and pointer copies, with memory versions and storage/base provenance.
- Relationships between formal slots, call results, storage and exits. Preserve
  value flow through forwarding wrappers and branches rather than recording
  only a bag of types or calls.

Seed these summaries with independently audited SDK prototypes, verified clean-C
contracts available at preparation time, and existing witnessed storage views.
Generated function headers are indexes, not independent truth. Retain scope,
qualifiers, function-pointer/array structure and transitive type dependencies.

Separate exact declared contracts from machine-use constraints. For example,
a dereference constrains an address and access width; it does not by itself name
a complete struct, establish `sizeof`, or uniquely recover the source typedef.
Unknown effects break proofs through affected values/memory, not unrelated facts
elsewhere in the function.

## 5. Propagate both ways to a fixed point

Use a deterministic constraint worklist and strongly connected components (SCCs).
Process dependency components bottom-up, revisiting callers when callee summaries
change. Propagate caller/storage information in the reverse direction too, so
recursion and mutually dependent wrappers converge rather than being cut at the
first already-visited node.

Transfer rules must cover:

1. **Callee to caller:** map witnessed formal-slot uses and known contracts to the
   actual SSA arguments; known result constraints follow that call's result.
2. **Caller to callee:** caller argument origins and result uses constrain the
   corresponding formal/exit values when the call relation is established.
3. **Within a function:** copies, supported expressions, phis, return forwarding
   and tail-call forwarding transport facts without merging unrelated values.
4. **Through storage:** a proven store/load relationship or existing typed view
   carries pointee/function-target constraints with base bias and lifetime intact.
5. **Through indirect calls:** retain per-target facts. Common unconditional facts
   require justification across every possible target and no unmodelled remainder;
   target-specific facts stay conditional on that target/dispatch branch.

A known pointer parameter can constrain a forwarding wrapper and eventually the
requesting function without a source declaration for every intermediate node.
But conversions, interior pointers and aliasing mean this is not blanket equality
of all source-level types along a path.

Represent partial facts explicitly and add/refine them monotonically in a bounded
domain. Deduplicate facts independently of their witness paths; cycles must not
manufacture infinitely longer evidence chains. Record incompatible facts as a
conflict with both witnesses, never a traversal-order winner. Every derived fact
needs its seed, transfer rule, intervening call/value edges and assumptions.

Never infer `void` because a dispatch ignores its result, a return type merely
because `$v0` was written, or arity from argument setup alone. Do not delete unread
slots or treat leftover register contents as proven source arguments.

Table entries remain separate contracts. One known `s32 (void)` member does not
type every unknown member. A uniform callable table type requires an independently
justified compatible contract for all possible entries. Differing contracts must
remain explicit; any adapter to a common call representation needs evidence of
the original call semantics, not an implicit cast inserted to compile.

## 6. Termination, uncertainty and provenance

Declare deterministic bounds for visited functions, original instructions,
indirect target sets, storage dependencies and propagation work. Record consumed
work, visited/excluded nodes and the next frontier; prioritize dependencies over
unrelated storage scans. Cancellation and missing inputs return preserved partial
results through the existing preparation path.

Distinguish these outcomes per open fact:

| Outcome | Meaning |
|---|---|
| Witnessed/derived | Supported fact with a replayable provenance chain |
| Fixed-point unresolved | Supported transfers stopped adding facts on the examined graph; name remaining alternatives and coverage limits |
| Conflict | Incompatible witnesses/constraints, with both origins retained |
| Unsupported | A named instruction, ABI form or memory/target relation blocks the proof |
| Budget/input incomplete | An unvisited dependency, open target set or missing original input remains |

A fixed point proves only what this analysis domain can establish. Reserve a
claim of genuine ambiguity for explicit surviving interpretations under named
premises, not simply a failure of a heuristic. Unused source parameters and dead
return temporaries may remain unrecoverable even with complete observable flow.

Fingerprint original bytes/data, seeds and their dependencies, graph/transfer
implementation, m2c patches and toolchain inputs. A changed dependent contract
must invalidate preparation even when the target's assembly is unchanged. Use
existing freshness records; full provenance stays in linked internal artifacts.

## 7. Feed the result into m2c, then measure the raw draft

Inspect m2c's native multi-function inference with a small chain fixture first.
Choose the narrowest general integration supported by that evidence:

- Supply the selected original related assembly/data and dependency-complete
  declarations where they establish complete contracts.
- Feed partial graph constraints into native inference, or extend the vendored
  inference mechanism to accept them without converting them into fake complete
  prototypes. Preserve per-entry indirect-call identity and conflicts.
- Confirm constraints reach call expressions, return inference and storage
  accesses in the emitted function. Merely printing a context comment or listing
  inspected callbacks does not satisfy this step.

Keep raw output unchanged after generation. The mechanical real-header wrapper
may expose justified declarations as before; no `?` replacement, fabricated
argument/default return type, field-layout expansion or target-specific body edit.
Conditional source interpretations, if evaluated, remain labelled hypotheses,
not exported facts. Compiling or byte-matching a representation does not prove
an otherwise unobservable original source signature.

Measure generation, destination-context compilation and relocated bytes as
separate statuses. An exact result still needs normal integrated finalization.
Keep the small handoff: source, concise status/blockers and direct context/evidence
links, not the whole graph/catalogue. Existing clean C remains primary on resume;
fresh generation for it requires the explicit alternative path.

## 8. Delivery slices and acceptance

### A. Graph and local summaries

Build a frozen reproduction graph rooted at `ovl_25_func_800B7EB4`. Trace original
`D_800BCBD8` at `build/ovl_25/asm/data/3D20.data.s:1092` to these five entries,
then recursively follow their relevant callees/callers/storage dependencies:

- `ovl_25_func_800B7F3C`
- `ovl_25_func_800B80A4`
- `ovl_25_func_800B813C`
- `ovl_25_func_800B81B4` (currently known `s32 (void)`)
- `ovl_25_func_800B81F4`

Record call-site argument/result flow and reachable SDK/verified seeds. Do not
hard-code these names/table into the implementation. Account for opaque unaligned
word effects where they actually block a relationship.

### B. Propagation and actual m2c integration

Use a small frozen chain `target → callback → wrapper → known callee` to show
that information reaches the target through multiple hops. Add narrowly targeted
coverage for reverse result-use propagation, a recursive SCC, a table with
heterogeneous entries, and an open/unsupported edge. Reuse existing fixtures
where possible; test the mechanism rather than every implementation edit.

Acceptance requires checking the actual selected inputs and raw output, not just
summaries. Changing a downstream seed must refresh the dependent preparation;
changing traversal order must not change its conclusions.

### C. Primary acceptance: known functions with dependencies

The primary acceptance cohort must be **already byte-matched functions that have
real dependencies**, not only synthetic fixtures, leaf functions or unresolved
stubs. Use this small initial cohort, confirming its original edges and baseline
byte matches before freezing the inputs:

| Known function | Dependency exercised |
|---|---|
| `func_8002238C` | Passes `func_800224F0` as a callback to `func_800223D4`; exercises a multi-hop direct/indirect chain |
| `func_800223D4` | Calls `func_80015704`, then dispatches the supplied callback with four register arguments and one stack argument |
| `ovl_25_func_800BAC28` | Calls engine function `func_8001C0D4` with `FuncC0D4Args *` and two `VECTOR *` values; exercises cross-container typed arguments |
| `ovl_25_func_800B81B4` | Calls `ovl_25_func_800B93E4`, `func_80013328` and `func_8001FE34`; exercises overlay/engine dependencies and deeper callees |

Confirm contracts against independent callee/SDK evidence before treating them
as expected facts; byte matching alone does not prove every source type uniquely.
The checked-in known C supplies the evaluator's reference behaviour/types and
baseline object, not a shortcut for the preparation being tested.

For each root:

1. Preserve its live source and run **fresh alternative m2c generation**, never
   count measurement of the existing C as inference acceptance.
2. Freeze a manifest of permitted seeds and expected dependency-derived facts.
   In an isolated analysis input view, withhold the root's known signature/body
   from inference, including generated-header/cache copies. For the multi-hop
   case also withhold the intermediate signature being tested while keeping its
   original bytes and independently known leaf contracts. Do not edit live files.
3. Check the recovered graph against the original call sites and assert specific
   argument, callback, stack-slot, return-use or storage constraints against the
   independently audited reference. Require a provenance chain through the real
   dependency; a no-unknown report or a list of visited names is insufficient.
4. Compile the raw mechanically wrapped draft against real destination headers.
   Require successful compilation and no avoidable unknown/contradictory types,
   invented fields or dropped ABI slots for this known positive cohort.
5. Record relocated-byte verdicts and staged residuals. Assert exact bytes for
   the focused forwarding fixtures; full-function mismatches remain visible and
   require inspection for type/ABI/addressing regressions rather than being
   relabelled as matches. This plan does not promise every raw m2c body is exact.
6. Run a control with the relevant leaf seed/transfer unavailable, then restore
   it: the expected constraint must disappear/become incomplete and reappear.
   This demonstrates propagation rather than accidental use of the held-out C.

Freeze the expected facts before tuning to outputs. Report failures for every
selected function; do not replace failing members with leaves or successful
examples. A stub reproduction improving does not substitute for this known-
dependency acceptance gate.

### D. Reported reproduction and collateral smoke check

Regenerate the reported target in scratch space without changing its live stub.
Compile the raw mechanically wrapped draft against real destination headers and
record the relocated-byte verdict if an object exists. Preserve the corrected
byte-offset storage accesses; no nonexistent fields may reappear.

Retain the existing four-function smoke sample as a **secondary collateral
check**, not the dependency-inference acceptance cohort: `func_80017A64`,
`ovl_25_func_800B81B4`, `func_8001202C` and the reported target, with fresh
alternatives for decompiled functions. Reuse overlapping runs when their input
identities agree. Record graph coverage, propagated facts, remaining unknowns,
generation, compile, byte verdict, handoff size and unchanged live-source hashes.
Also check normal resume keeps an existing attempt primary.

For the reported target, eliminate avoidable unknown contracts using the graph.
If any still prevent compilation, name the exact unvisited frontier, unsupported
transfer, conflict or surviving alternatives after convergence. That can be an
honest bounded-analysis result, but **not a claim that the failing reproduction
is fixed**. Do not promote a fabricated uniform signature to satisfy acceptance.

Run relevant graph/inference/preparation regressions and scoped TypeScript checks,
then required configured build verification without deleting existing artifacts.
The live build remaining byte-identical is collateral-safety evidence, not proof
that a scratch draft compiled or finalized. Report repository-wide typecheck
failures separately if still present.

## 9. Deferred work and completion report

Do not start historical backtests, optional declaration integration, new controller
lifecycle work or broad constructor expansion as part of this correction. No
end-to-end time/token savings are claimed from the small smoke check.

The completion report must identify the implemented propagation rules, graph
coverage/bounds, concrete seed-to-target chains, actual m2c input/output effect,
per-function results for the known dependency cohort and secondary smoke sample,
raw compile/byte verdicts, unresolved outcomes and verification commands. Keep
implementation, analysis coverage and successful reproduction as separate claims.


## 10. Implementation and measured delivery

Implemented under `tools/agent/type-propagation/`, integrated with static discovery,
preparation/freshness and compact campaign handoffs. The original-code graph is
independent of worklist eligibility. It preserves direct/tail/incoming edges,
resolved per-target callbacks, original table entries, cycles, dependency-selected
storage users, frontier and opaque effects. Local summaries recover actual ABI
word/value/memory relationships, including the pre-transfer delay slot and the
pre-delay-slot indirect target. The finite SCC/worklist solver transports
argument/result requirements both ways, backward phi requirements and exact-width
store/load facts; conflicts and open-target conditions retain their witnesses.
Public/private type identity and seed parameter reads use the pinned C AST.
Preparation's fixed-field layout and declaration/alias inspection also use ASTs,
not bare regex C analysis. Assembly/data/diagnostic syntax remains separate.

SDK or relocated-byte-verified clean defining C supplies independent seeds.
Unused source parameters do not establish an observable arity. Held-out roots
and intermediates are excluded from every projected signature scope. Shared
storage selection does not claim inter-function lifetime equality. Wide/hidden
ABI forms and tail result/stack forwarding are explicitly outside the word domain.
Default limits are 96 functions, 65,536 original instructions, 32 targets,
256 storage dependencies, 200,000 propagation steps and 1,000,000 indexed words.
A fixed point on an open or budget-truncated graph is not complete coverage.

Pinned m2c patch 0004 supplies related-function inference while emitting only the
selected function, dependency-rooted emission, partial ABI slots/type carriers
and open-dispatch boundaries. Constraints change actual raw calls/returns; the
forwarding fixture compiles to exact relocated original words. A regression
shows why an open callback must not inherit one member's narrow signature:
otherwise native inference manufactures caller-side sign extensions. The graph
boundary also prevents cosmetic cast unification from undoing that isolation.

### Frozen known-dependency cohort

All four checked-in reference functions byte-matched before freezing the seed,
source, original-target and expected-fact manifests. No cohort member was replaced.
Every requested expected fact and missing-leaf/restored-seed control succeeds.
Fresh alternatives—not measurement of existing C—produce these results:

| Root | Original graph / facts | Raw compile | Relocated bytes / acceptance |
|---|---|---|---|
| `func_8002238C` | 8 functions, 175 facts; leaf `func_80015EE8` through `func_800224F0` and held-out `func_800223D4` reaches the root scalar argument, condition retained | **fails** | unavailable; gate fails |
| `func_800223D4` | 8 functions, 188 facts; `func_80015704` supplies independently witnessed `SpriteSourceData *` / `SpriteDataHeader *`; indirect call retains slot 4 | **fails** | unavailable; gate fails |
| `ovl_25_func_800BAC28` | 2 functions, 45 facts; cross-container `func_8001C0D4` supplies `FuncC0D4Args *` and two `VECTOR *` requirements | succeeds | **mismatch**; inference checks pass, not finalized |
| `ovl_25_func_800B81B4` | 4 functions, 21 facts; original calls to `ovl_25_func_800B93E4`, `func_80013328`, `func_8001FE34` and controlled deeper constraints | succeeds | **mismatch**; inference checks pass, not finalized |

The first two have an open callback at **0x80022498**. Isolation removes the
erroneous narrow argument-3 and stack argument-4 representations, but the callable's
ignored result remains unresolved in this domain. A member-specific whole contract
would compile by leaking a conditional interpretation; it is not promoted to a
uniform fact. Earlier compiling/exact root drafts used that leakage and are not
the final acceptance result. No default scalar or `void` result was invented.
The next capability is justified partial callable/result representations, or a
proof of original target-set closure—not a target-specific raw-body repair.

The two compiling mismatches were inspected, not labelled scheduler-only:
`BAC28` has scalar stack pieces cast to aggregate pointers, lost original stores
and an unobservable source-result interpretation (staged key **0/25/5/0**).
`B81B4` has a return/storage representation residual (**0/5/0/0**), including
native omission of the checked-in returned increment. These are source-level
residuals; raw signatures are not exported. Private `FuncC0D4Args` dependencies
are mechanically carried into scratch compilation, with integration still blocked.

### Reported reproduction and collateral smoke

Original `D_800BCBD8` is validated against its five original entries. The
reproduction visits all five and recursively follows their real call sites,
including `B80A4`/`B813C` → `BAC28` → `func_8001C0D4`, and
`B81B4` → `B93E4` / `func_80013328` / `func_8001FE34`.
Argument/result SSA IDs, stack words, seed evidence and unsupported instructions
are preserved in the graph/report, not replaced with uniform table signatures.

The final reproduction examines **96 functions / 5,425 facts**, reaches a
propagation fixed point with **52 frontier records** and **201 unsupported effects**,
and still **does not compile**. Bounds exclude, among others, `func_80013B04`,
`func_80013CD0`, `func_80017F88`, `func_8001A018`, `func_8001B2CC`,
`func_80021FD0`, `func_80022964` and `func_800229F4`. The original table's
index range and immutability remain unproved. Opaque unaligned effects in
`func_8001B5DC` and other selected originals block affected proofs. Four entry
result contracts remain budget/input incomplete; none is called genuinely
ambiguous. **The failing reproduction is not fixed.**

| Secondary sample | Generation | Compilation | Bytes | Graph |
|---|---|---|---|---|
| `func_80017A64` | fresh alternative | succeeds | mismatch | 1 function, 1 fact |
| `ovl_25_func_800B81B4` | reused identical cohort inputs | succeeds | mismatch | 4 functions, 21 facts |
| `func_8001202C` | fresh alternative | succeeds | mismatch | 1 function, 3 facts |
| `ovl_25_func_800B7EB4` | scratch generation | fails | unavailable | bounded/open, as above |

Seven live-source hashes are unchanged. Normal resume keeps
`existing-attempt` primary and generation `not-attempted`. Handoffs remain
under 5 KB. No live source/header/flag edit, signature publication, integration,
finalization or generated tracked-file edit was performed. Version-control commits
are separately authorized by the user's explicit request.

### Verification and evidence

- Graph/inference/preparation/declaration/machine-IR regressions: **51 tests pass**,
  including the exact production-compiled forwarding fixture and open-callback
  negative control.
- Patched m2c complete vendor suite: **355 pass, 21 fail**, identical failure set
  to the pre-change three-patch baseline; **zero new failures**. Its six mechanism
  unit tests pass. The baseline failures are not hidden or called a green suite.
- Strict repository TypeScript invocation: **1,200 existing diagnostics**; **zero
  diagnostics in the changed modules**. This is a scoped check, not a claim of a
  passing repository-wide typecheck.
- `make check-all`: the executable and **all 13 overlays byte-match**.
- The global `sourcePolicy.ts` gate **exits 1** on unchanged existing source/stub,
  register-assembly and flag-override findings. No live source/header/flag file is
  changed by this implementation; this audit is not reported as a passing gate.
- `typePropagationAcceptance.ts --run`: **exits 1**, preserving both failed
  primary members and the failed reproduction, rather than weakening the gate.
- `checkDocReferences.ts` is run over the changed documentation; no stale links.

Reproduction commands and bounds are in `tools/agent/type-propagation/README.md`.
The expected-fact manifest is
`configs/static-decompilation/type-propagation-acceptance.json`.
Full frozen inputs, baselines, raw drafts, controls, coverage, ABI checks, provenance,
residuals and source hashes are linked from
`build/type-propagation/acceptance/report.json`; logs are under
`build/type-propagation/`. A version-1 historical implicit-int ABI metadata digest
is accepted only on exact unchanged signature/file identity and explicitly recorded
for three unrelated SDK declarations; expected facts and frozen files are unchanged.

**Completion boundary:** the bounded propagation and actual m2c integration are
implemented and collateral-safe. The plan's positive-cohort acceptance requirement
is **not satisfied**, and Task 1 must not be marked fully complete on this evidence.
