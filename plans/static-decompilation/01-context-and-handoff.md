# Task 1 — faithful m2c context and a prepared first-pass handoff

Status: **implemented and ready for user testing; session backtests deferred**.
Preparation is the default in interactive commands and both controllers.
Completed checks and explicit limitations are recorded in
[the implementation report](../../notes/research/static-preparation-task1.md).
This task runs without [Task 2](02-declaration-integration.md). The full acceptance
plan, including [session backtests](03-session-backtesting.md), is not certified
complete.

## 1. Contract

For a fresh function, the controller prepares the function before asking a
thinking agent to work:

```text
resolve target and existing work
    → assemble faithful context and explicit unknowns
    → m2c
    → preserve draft; compile in the destination's real context
    → diagnostics OR staged residual and exact byte verdict
        → non-exact / unresolved: prepared thinking-agent handoff
        → exact: safe source integration → full finalization → documentation agent
```

A resumed clean-C attempt stays the primary source. Refresh its measurements and
context as needed; a newly generated m2c draft may be an explicitly requested
alternative, never an automatic replacement.

There is **no repair stage** between m2c and measurement. Errors caused by missing
context are fixed at context construction; errors in general decompilation or
emission are fixed at that layer. Remaining unknowns go to the agent, with evidence.
The controller must not replace `?` with a scalar, inject casts until a compiler
accepts the program, or silently choose a signature to eliminate an error.

## 2. Existing implementation to change

| Area | Current implementation | Planned change |
|---|---|---|
| Invocation | `tools/agent/m2cFunc.ts` | Structured preparation result; explicit context/input manifest; raw output and diagnostics preserved; safe staging rather than unconditional live writes |
| Global context | `tools/build/classifyGlobals.ts` | Stop scalarizing the typed/aliased views already present in override declarations; use one effective declaration model for compiler and decompiler views |
| Types and signatures | `tools/agent/sdkTypes.ts`, `tools/agent/contextExport.ts` | Recursive, scope-aware dependency collection; actual SDK prototypes; no fake concrete missing-type definitions |
| Independent call evidence | `tools/agent/calleeTruth.ts`, `tools/agent/matching-reconstruction/callee-signature.ts` | Reuse evidence extraction without requiring reconstruction; reconcile container paths and preserve complete types |
| Prepared packet | `tools/agent/campaign/bundle.ts` | Extract/reuse a common packet core; represent noncompiling m2c drafts without forcing them into reconstruction's compilable `partial` category |
| Interactive tools | `.pi/extensions/psx-decomp/tools/diagnostics.ts` and existing m2c wrapper | Expose the same preparation result and remove repair registration | <!-- doc-ref-ignore: extension-rooted path, not tools/diagnostics.ts -->
| Controller | `.pi/extensions/psx-decomp/autoloop/loop.ts`, `oracles.ts`, `prompts.ts`, `types.ts` | Preparation before the first solver turn; one finalization/documentation route for static and agent-produced matches |
| Instructions | `.pi/skills/psx-decompile-function/SKILL.md`, `.pi/skills/psx-post-decompile-documentation/SKILL.md` | Prepared-m2c-first startup, accurate resume behavior, explicit documentation role and commit authorization |

Implementation must inspect the current command/worker entry points as well:
interactive and autonomous entry points should consume the same preparation
library rather than independently construct context. Keep orchestration in the
existing extension and reusable analysis under the established `tools/` groups.
Read the relevant Pi extension/SDK documentation before modifying those entry
points. This plan does not prescribe a new worker framework.

## 3. Build a faithful context

### 3.1 Resolve inputs once

Resolve the function, container, original code and referenced data through the
active container/symbol model. Include jump-table data, symbol aliases, flags,
SDK selection and preprocessing definitions. A failed container lookup must not
silently select the executable's context for an overlay target.

Fingerprint the actual inputs: original bytes, assembly/data, declaration
sources, preprocessor environment, m2c revision/patches, compiler/assembler,
configuration and current source. Record commands and complete stdout/stderr.
A changed dependency invalidates the affected result; an unrelated timestamp is
not sufficient provenance in either direction.

### 3.2 One declaration model, two faithful projections

Construct a scope-aware declaration index, then project it for m2c and for the
candidate compiler. Do not independently generate two incompatible collections
of types that happen to share names.

Collect:

- Real SDK types **and function prototypes**, with pointer, return, function
  pointer, array, qualifier and variadic information preserved.
- Existing game/shared types and global overrides, including partial views,
  backing symbols, aliases and view-base offsets.
- Matched function definitions and their type dependencies, including nested
  overlay sources. Generated signature headers are an index, not an independent
  witness that overrides the defining source or SDK.
- Translation-unit ownership/tentative definitions separately from `extern`
  declarations. Addressing facts must survive the projection.

Parse C through the repository's AST infrastructure and preprocess with the
configured target environment. Reuse the build's include/define settings; do not
use host ABI layout. If m2c cannot parse an otherwise valid SDK construct, apply
a documented, tested context-language adaptation preserving its type/layout
meaning, or report that construct as unsupported. Do not silently omit it.

Type identity includes declaration scope and container, not just a typedef name.
Traverse dependency closure, resolve forward declarations and cycles, and render
in a deterministic order. Collect source-local types recursively without merging
two unrelated local typedefs of the same name. Surface conflicting definitions
with both origins; never let traversal order decide which one wins.

Use broad reusable SDK/engine/container context rather than hand-authored context
for each target. Dependency slicing may bound what is rendered, but must retain
all transitive type dependencies and report what was excluded and why.

### 3.3 Preserve globals and source visibility

The generated global context currently discards richer override views. Correct
that boundary, including macro-backed aliases: the model must distinguish the
linker symbol, its backing declaration and the C expression exposing the object.
Use the existing declaration idiom's actual semantics, not a textual macro name
or the apparent scalar classification of an address.

For every type/prototype used in the draft, record how the real translation unit
gets it: existing public header, legitimate source-local declaration, or a
required declaration publication. Supplying a type to m2c alone does not make it
visible through `common.h`.

The context/emission adapter may select existing headers and spell known symbol
views correctly. It does not automatically publish new shared/global types in
Task 1. If visibility requires such an addition, preserve the emitted declaration
and identify the required integration in the packet; the agent can perform it,
or Task 2 can automate it later. A private all-knowing scratch header must not
turn this case into a false claim that the destination source compiles.

### 3.4 Audit signatures before trusting them

Preserve full parameter and return types and incoming ABI slot positions. An
unused earlier slot cannot be removed simply because only later slots are read.
Distinguish `f(void)`, an unspecified-parameter declaration and a variadic
prototype; they are not equivalent compiler context.

Confront recovered declarations with independent SDK/callee-code evidence.
Byte-matched definitions are valuable evidence, but optimized code need not
uniquely determine every unused parameter or its source-level type. Missing
caller setup alone does not prove smaller arity; a returned register used as a
pointer conflicts with a `void` declaration and needs investigation, not a
fabricated value.

Use the existing frame/callee analyses for ABI facts instead of another local
heuristic. Correct the overlay-header lookup defect in shared lookup code if it
remains reachable; deleting repair must not leave a conflicting signature oracle
in preparation. Record disagreements as such rather than silently ranking away
one witness.

## 4. Unknown information and general static discovery

Treat unknowns as first-class data, not failed string replacements.

Each unresolved item should include:

- The affected symbol, draft span, call or field access.
- Known constraints and their original-byte/header/source evidence.
- The missing fact or conflicting interpretations.
- What inference was attempted, its bound and why it stopped.
- Relevant callers/callees or related accesses the agent can inspect next.

### Static inference slice

Implement a bounded, general evidence pass over the target and relevant original
callers/callees/shared-storage users. Reuse original-word CFG/SSA and access
analysis where possible. It should propagate:

1. Access width, signedness, offset, base provenance and observed strides.
2. Pointer flow through loads, copies, call arguments and independently witnessed
   callee contracts.
3. Parameter-slot and return-use constraints without turning ABI lower bounds
   into invented complete source signatures.
4. Compatible partial record views where storage identity is established.

Assess m2c's existing multi-function inference with small frozen fixtures and
bounded related assembly inputs; the current wrapper passes one function. Adopt
it where it demonstrably propagates justified constraints. Do not feed future
matched C into this experiment, and do not introduce a specialized constructor
for each failed function.

Separate witnessed facts, conditional hypotheses, conflicts and unsupported
operations. Unknown instruction effects break proofs through those effects.
Maximum observed offset supplies a minimum extent, not necessarily `sizeof`;
a stride is a separate observation. Pointer/integer ambiguity or overlapping
views may remain unresolved. Conditional hypotheses can inform a draft but must
retain their assumptions and cannot be exported as settled shared context.

Use fixed work/graph bounds and explicit budget outcomes. Static discovery must
terminate with a useful packet when it cannot decide. Improving its reach can
continue after Task 1 ships; complete static type recovery is not a dependency.

### General m2c defects

Add regression fixtures for the observed typed-pointer byte-offset and dropped
ABI-slot failures. First isolate context error from emitter/inference error.
If the latter remains under faithful inputs, fix the general mechanism in m2c
with upstream-style tests and a reproducible vendor revision/patch workflow.
Do not recreate the repair layer around it. Until fixed, name the limitation in
the packet and retain the original draft.

Repository tools remain TypeScript. Any necessary vendored-decompiler change
must follow the repository's vendor policy explicitly, rather than becoming a
new project-local Python repair script or an untracked vendor edit.

## 5. Draft measurement and packet

Prepare under `build/`, leaving a live source untouched until an explicit safe
handoff/integration step. Preserve raw m2c output separately from the wrapped
candidate and record any mechanical wrapper/include mapping.

The shared packet needs a versioned schema with these independent fields:

| Field | Required content |
|---|---|
| Identity | Function/container, destination source, original assembly/data paths, input hashes, tools/configuration |
| Primary source | Existing attempt or m2c draft; exact path/hash, emitted text, origin and any integration-required declarations |
| Context | Effective types/prototypes/global views, witness paths, scope identities, unresolved/conflicting facts |
| Generation | Exit status, full streams, generated/failed/unsupported distinction |
| Compilation | Not attempted / failed / succeeded; actual compile context, complete errors and warnings, preprocessed source and object hashes when available |
| Comparison | Not available / mismatching / exact / undetermined; relocated-byte verdict and staged per-block residual where supported |
| Integration | Required source/header changes, whether staged or live, freshness preconditions and blockers |
| Discovery | Unknowns, bounded inference results and relevant evidence links; applicable prior experiments with their premises |
| Finalization | Not attempted / failed at named gate / passed, with the verified input identity |

Do not drop a noncompiling draft because the existing bundle type only accepts
compilable partial candidates. Generation failure is also a legitimate packet:
include the failing context/diagnostics and original target, not invented C.
Do not fabricate a residual when compilation or relocation failed.

Give the agent a concise self-contained opening message: the actual first-pass
function when it fits, its file path, measurement status, key diagnostics or
residual, and unresolved questions. Large context/drafts get complete artifact
links and an explicit bounded preview, never silent truncation. The source it
is told to edit must be the source that was measured, not an older live file
while diagnostics refer to an unmentioned scratch repair.

Fresh preparation may stage a compilable nonmatching candidate into an unchanged
stub after AST/policy/scope checks, within the normal authorized function attempt.
A noncompiling draft stays available under `build/` with its live destination
identified, rather than unnecessarily breaking the project before the agent can
act. The handoff must make that distinction explicit. Never overwrite existing
clean C, dirty user work or another target's source to install a draft.

Fresh evidence in the packet satisfies equivalent startup checks when its complete
provenance still agrees. Update the skill so the agent does not mechanically
rerun discovery or reconstruction merely to reach material already supplied.
Reconstruction, family transfer and deeper diagnostics remain available on demand;
they are not a mandatory prerequisite to m2c.

## 6. Exact-match fast path and documentation

Add preparation before tier selection/first thinking turn in `runFunction`.
A statically exact candidate follows this route:

1. Verify a real clean-C function is present; no original-assembly stub, missing
   relocations, unresolved interface/integration conflict or outstanding mandatory
   preflight blocker may count as an eligible exact candidate.
2. Recheck source/context fingerprints and stage only the authorized candidate
   changes. Validate the integrated source, not just a scratch version.
3. Invoke the **same authoritative finalization path** as an agent-produced
   match: exact function diff, full configured build/container checks, scope and
   clean-source policy. Export context through the normal verified path.
4. On success, record a static-origin finalized outcome, then dispatch the
   documentation role with the verified source/evidence and changed-file list.
5. On failure, preserve the candidate and the precise failed gate in a thinking-
   agent handoff. Restore only preparer's own failed staging when necessary;
   never reset unrelated work or label a failed finalization as success.

The existing post-match `recordGroupingEvidence` turn is notes-only, and the
post-decompile documentation skill currently focuses on grouping evidence too.
Make this an explicit documentation-agent handoff used by **both** match routes;
there need not be a new process implementation. It records supported grouping
or research evidence and may correctly report that there is nothing to add.
Do not invent a claim that comprehensive documentation already exists.

Resolve the skill's unconditional commit instruction before enabling this route:
notes-only documentation and finalization do not authorize a commit. Preserve
any separately, explicitly authorized controller commit behavior; do not turn
it on as a side effect of preparation.

Protect verified build inputs during documentation. A source/header change
invalidates the earlier gate and requires re-verification; it must not ride
through as a documentation-only change. Handle documentation failure separately
from matching success, with a resumable pending-documentation state.

Test cancellation, model unavailability and restart at every boundary. An exact
static match should not require access to the solver model merely to reach its
final gate. Record completion identities so restart does not regenerate an
edited draft or repeatedly finalize/document the same unchanged candidate.

## 7. Remove repair, not merely its default invocation

Delete `tools/agent/repairM2c.ts` and its active exports/imports, CLI/tool
registration, schemas and execution paths. Remove `psx_repair_m2c` from active
prompts, skills, descriptions and startup fallback logic. Move useful regression
fixtures to the component that owns the defect; do not preserve the repair
implementation to satisfy old tests.

Search the repository for both names and the old repaired-m2c seed priority.
Classify remaining references as historical evidence or executable/live guidance.
Historical notes can retain what actually happened, and historical baseline
replay may use a pinned old revision in isolation. No production compatibility
shim may invoke the old repair algorithm. The tool is removed outright; do not add compatibility hooks, replacement
registrations or agent-facing retirement messages for saved calls.

The similarly named near-miss diagnostic is a different tool; do not delete
unrelated machinery just because its name contains “repair”.

## 8. Delivery slices and acceptance tests

### A. Context fidelity

- Unit fixtures cover real SDK parameter/return types; nested overlays;
  source-local name collisions; recursive types; arrays/function pointers;
  global overrides and base-biased aliases; ownership-sensitive declarations.
- Missing types produce incomplete/unknown facts, never `pad[1]` stand-ins.
- Context parses in m2c, and a destination-context compile checks emitted uses.
  Parsing context alone is not the acceptance criterion.
- Existing context-export regression tests remain valid or gain a more faithful
  replacement; generated headers remain outputs, not manually edited inputs.

### B. General inference and emission

- Original-byte fixtures exercise partial layouts, ambiguous pointer/scalar uses,
  unsupported effects and bounded cross-function propagation.
- Byte displacement is preserved under typed-pointer arithmetic.
- A function using later incoming argument slots retains earlier unused slots.
- Conflicting call signatures are exposed before they manufacture unset-register
  expressions or fabricated call operands.

### C. Packet and lifecycle

- Raw/wrapped/measured source identities agree and full errors/warnings survive.
- Noncompiling output and total m2c failure both reach useful agent handoffs.
- Stub/existing-attempt, executable/overlay, stale packet, cancellation and
  concurrent source modification cases are tested.
- Exact raw drafts reach full finalization and documentation with zero solver
  turns. Failed build, policy, scope or relocation checks never take that route.
- Documentation cannot alter verified build inputs unnoticed or implicitly commit.

### D. Retirement and measured release

- No active repair entry point or repair fallback remains.
- Task 1 passes with declaration integration absent/disabled.
- Run relevant context/tool-registration/controller tests, project TypeScript
  checks, the full test suite and configured binary verification in a clean
  integration workspace.
- Complete the Task-1-only backtest arm. Report coverage, regressions, unresolved
  cases and cost including static preparation. Evaluate the predeclared
  correctness and harness-improvement criteria, not just compile percentage on
  the repair-selected sample. Preparation is enabled by default as explicitly
  requested by the user; do not add an opt-in gate.
