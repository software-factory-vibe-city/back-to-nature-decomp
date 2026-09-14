# Static-first matching decompilation: from function attempts to a reconstruction system

**Status: proposal, grounded in an investigation of revision `45a023a`.**

This is an implementation strategy, not a claim that 80% automatic matching
has been demonstrated. No production C or tool implementation was changed for
this investigation. One byte-exact experimental candidate was found and left
under `build/`.

**Scope:** reconstruction within an already-configured, byte-matching project,
using its available toolchain and SDK. Project bootstrapping, toolchain/SDK
discovery and bootstrap-skill packaging are deferred. Cold-context evaluation
below means reconstruction without previously recovered game C or types—not
setting up a new project.

## Recommendation

Pursue the 80/20 ambition. The evidence does **not** show an exhausted static
reconstruction space. It shows an engine whose representation cannot yet admit
many ordinary C programs, alongside useful analyses that stop at giving advice
instead of constructing a candidate.

The next system should be a **project-wide, family-aware, compiler-guided
reconstructor**, not a larger collection of whole-function templates and not
an LLM asked to try the same templates longer.

Its two products are equally intentional:

1. **Verified source bundles:** acceptable C that the unchanged production
   toolchain compiles to the target, followed by authorized full-build
   integration.
2. **Prepared reconstruction bundles:** a compiling, target-grounded draft
   where supported, accompanied by explicit unresolved regions, alternative
   declarations/layouts, compiler evidence, and a small remaining work item.
   Unsupported machine semantics must remain explicit rather than being
   replaced with plausible code to achieve compilation.

The important unit of improvement is a **reusable missing capability**, often
covering a family of functions. The important unit of agent work is an
**unresolved representation or region**, not automatically the entire function.

## 1. What I actually examined

I read the current reconstruction implementation, its predecessor plans,
compiler-reversal documentation, build configuration, seed repair and
integration code, matched siblings, and parked attempts. I also ran a fresh
byte-level feature/family survey and bounded reconstruction probes. I did not
rerun the entire expensive compilation census.

### Baseline and scope

`tools/diagnostics/progress.ts` reports the user-supplied baseline:

- 770 / 2,559 live functions decompiled;
- 90,920 / 645,172 live bytes decompiled;
- most remaining work is in overlays, not the executable's already heavily
  decompiled game code.

The exploratory survey used **all configured function spans**, including
entries excluded from the live progress denominator. It found 1,852 source
stubs; 1,607 contain calls and 570 contain an internal backward control edge.
These are overlapping features, not mutually exclusive difficulty classes.
They must not be added to, or substituted for, the progress denominator.

Local artifacts and the small reproducible study scripts are under
`build/static-first-study/`. Its `snapshot.json` records the revision, sources,
original-instruction features, symbol-slot mappings, and family members.
These are investigative artifacts, not a new authoritative census.

### Fresh examples of ordinary code rejected before compilation

| Target | What the original code contains | Fresh engine outcome |
|---|---|---|
| `ovl_11_func_800D5D38` | A halfword lookup at a loaded base plus `40*i + 2*j + 4`, then a sentinel and flag test | Computed-address refusal; zero compiles |
| `ovl_11_func_80116878` | An indexed halfword member at object offset 0x28, with the index read at 0x5C, then a call | Rejects field offset 0x28 because it exceeds element scale 2; zero compiles |
| `ovl_11_func_800BF3D0` | Call a pointer-returning helper, load its first byte, extract the top bit | Call-result pointer base refused; zero compiles |
| `ovl_11_func_800C6E0C` | A small switch, a word store through an argument, then a byte read through that argument before a call | Mixed-width overlap refused; zero compiles |
| `ovl_11_func_800CDFAC` | A ten-iteration loop advancing two member pointers, conditionally calling a helper | Induction initialized from `arg0 + 0x3D4` refused; zero compiles |
| `ovl_11_func_80103770` | A selection followed by a strided halfword sum and zero test | Global-derived induction refused; zero compiles |
| `ovl_11_func_800E5524` | Nested run-length decoding loops | Repeated pointer increments grow into an unsupported address expression; zero compiles |
| `ovl_11_func_800D41A4` | A small state handler with stores and a five-argument call | Pointer passed as a value refused; zero compiles |
| `ovl_17_func_800B9FA8` | Initialization, polling calls and large copy regions with aligned/unaligned paths | `lwl/lwr/swl/swr` refused; zero compiles |
| `func_80013450` | Variable division with the compiler's divide-by-zero trap packet | `break` refused; zero compiles |

`func_80017F30`, a parked sentinel scan, does enter the constructor domain.
The deliberately bounded probe compiled eight of twelve candidates and reported
`budget-exhausted`. That is **not** an exhausted search or a demonstrated
impossibility.

These examples were selected to investigate mechanisms, not estimate a success
rate. They show why larger search budgets alone cannot solve the main problem:
most never reach the compiler.

### The unknown-instruction bucket is not a handwritten-assembly bucket

Of the 135 surveyed stubs with an instruction outside the reconstruction
decoder's subset:

- 90 contain `lwl/lwr`;
- 80 contain `swl/swr`;
- 37 contain SPECIAL function 13, `break`;
- 11 contain COP2 opcode 18.

The sets overlap. In 124 of those 135 functions the unknown opcodes are limited
to unaligned accesses and/or `break`, without COP2. This does not prove every
one is reconstructible, but it disproves treating that bucket as inherently
outside C. The inspected division function uses a normal compiler-generated
trap packet; the inspected copy regions have recognizable aggregate-copy
geometry. Some GTE code can also originate from SDK macros rather than from
handwritten function assembly; that requires separate classification under the
existing policy.

### A family-transfer experiment actually closed a park

`ovl_11_func_800D5ABC` had 22 recorded measurements and nine distinct outputs,
without a match. Its matched neighbors `ovl_11_func_800D5B3C` and
`ovl_11_func_800D5BBC` have the same lookup computation, with final field offsets
0xAC and 0xAE instead of 0xAA.

I parsed the first sibling's C using the existing tree-sitter frontend and made
exactly two substitutions: the function identifier and the target-witnessed
field literal, 0xAC to 0xAA. No function body was newly decompiled or tuned.

- `psx_residual_objective`: **EXACT, 32/32 words**.
- `diffFunc.ts --src build/static-first-study/donor-transfer.c`:
  **MATCH after relocation**.
- Candidate triage: no blocker.

The candidate remains at `build/static-first-study/donor-transfer.c`; it was
**not integrated**, and this is not a claim of a finalized new project match.
Header placement and the normal integration gates still apply.

The general lesson is not "copy neighboring C blindly." It is that the
repository already recognizes matching precedents but leaves a deterministic
source-instantiation step to an agent. That step can be automated.

### Repetition extends beyond that one example

A conservative survey preserving registers and literal constants, while
consistently renaming symbol references and relativizing internal labels, found
68 repeated instruction families containing 196 stubs. Only eight of those
stubs currently have a compiled sibling under this strict signature. Thus the
opportunity is mostly **solve one representative and propagate**, not 196
ready-made replacements.

Examples:

- A 31-member, 184-byte state-handler family including
  `ovl_11_func_800D41A4`, `ovl_11_func_800D46CC`, and
  `ovl_11_func_8010EA6C`.
- A four-member, 628-byte initialization/copy family across `ovl_17`, `ovl_19`,
  `ovl_21`, and `ovl_23`, including `ovl_17_func_800B9FA8`.
- The two parked executable functions `func_80019610` and `func_80019AD0`.
- Three matching-shape functions inside `ovl_15`, starting at
  `ovl_15_func_8012ED6C`, `ovl_15_func_801304BC`, and
  `ovl_15_func_80131498`.

These are **retrieval candidates**, not semantic equivalence proofs, original
TU claims, or predicted matches. A more flexible dataflow-aware index should
recover families whose field offsets, constants, or registers differ, including
the successful lookup transfer above.

## 2. Why the existing architecture reaches a ceiling early

### 2.1 Whole-path execution is being used where a graph is needed

`matching-reconstruction/exec.ts` constructs symbolic decision DAGs. Its memo
key includes cumulative effect history; leaves carry entire path effect lists.
This is useful for small read-only relations and already supports valuable
scan reconstructions.

For general code, however:

- different effect histories prevent shared continuations from merging;
- repeated guards can become a large path tree;
- calls create new values and memory epochs on each path;
- loops must be recognized before expressions and effect histories grow;
- there is no general loop-carried-value/phi representation to handle sums,
  changing pointers, nested loops, and continuation after a loop uniformly.

Adding more special cases around a whole-function executor will keep exposing
these interactions. The existing loop implementation has gained body effects,
but still rejects non-entry induction initializers and nested summarized loops.
It is not yet a general effectful-loop representation.

### 2.2 Storage is chosen too early and too narrowly

`buildStorageMap` primarily constructs one mapping. Pointer/value roles are
attached to a small argument-register plan; indexed cells, constant member
offsets, loaded bases and call-result bases do not compose generally. The
access-origin index is principally used by the successful scan route, rather
than by every constructor.

This is exactly the kind of earlier representation choice that can leave a
later candidate looking "allocation-only." A valid allocation diagnosis under
one declaration does not prove that declaration should be frozen.

### 2.3 Call handling still manufactures missing context

The executor captures four argument registers, not a complete ABI argument
list. `trimArgs` pads a longer resolved arity with zero constants. The
31-member handler family visibly passes a nonzero pointer in the fifth slot;
zero padding cannot reconstruct that call.

The signature object carries parameter types, but `resolveCallSignatures`
discards them and `calleeDeclarations` prints `s32` parameters. ABI evidence
can also be a lower bound on arity, not an exact signature. The inferred-range
code must not narrow a proven callee lower bound based on a caller's lack of
explicit setup: unchanged registers may be forwarded arguments.

These should be treated as representation defects, not reasons to search more
statement orders. A byte oracle prevents false matches, but cannot make a
wrongly manufactured draft into a useful agent handoff.

### 2.4 Several product contracts are weaker than their descriptions

Concrete implementation gaps to fix before growing automation:

- `repairM2c.ts` reads and writes `src/<function>.c`. I confirmed an overlay
  invocation reports "source not found" despite its real source existing.
- The repair implementation substitutes unknown types with `s32` and inserts
  declarations/typedefs. It does not implement general pointer-use rewriting or
  call-signature reconciliation as advertised.
- Repair obtains recovered context by parsing a winning/best-effort C string.
  When construction fails, the useful partial analysis has no independent
  context product to repair m2c with.
- `engine.ts` compares a candidate's full difference count with the previous
  candidate's `differingVram.length`, which is truncated to 16. Its selected
  "best effort" is not reliably the best by its own stated criterion, much
  less by the staged residual.
- Best-effort output is attached on `domain-exhausted`, not on the ordinary
  budget-stop path. File-existence checks can also encounter old winner/draft
  files; the current result manifest and provenance must govern consumption.
- Reconstruction compiles explicitly disable per-file overrides. Matching
  campaigns must use effective configured flags, not silently a different
  experiment from production. This is not permission to shop for flags.
- Census buckets are selected by substrings in a concatenated refusal. Of 510
  still-stub members of the old "read-only, call-free" bucket, 443 actually
  contain calls in their original words.

These findings do not call for a metrics project. They call for accurate
routing and stable machine-readable contracts so capability work reaches the
functions it was intended to help.

## 3. Proposed architecture

```text
original containers + configured production toolchain/SDK
             |
             v
project evidence graph: symbols, ABI, data use, families, build profiles
             |
             v
machine CFG + value SSA + explicit memory/call effects
             |
             v
region and operation recovery + alternative source representations
             |
             v
family transfer / typed constructors / bounded compiler-guided repair
             |
       production compile + relocated-byte oracle
          /                              \
 exact source/context bundle       prepared reconstruction bundle
          |                              |
 authorized transactional gates     focused agent intervention
          |                              |
 verified project source          new source and/or reusable recipe
                                         |
                                  replay affected families
```

### 3.1 Keep two representations, not one destructive normalization

Maintain:

- **Semantic IR:** what values, memory effects, calls, branches, and exceptional
  exits the machine performs. Normalize equivalent address arithmetic and
  integer expressions here when justified.
- **Representation alternatives:** plausible source objects, layouts,
  operation boundaries, loops, control frames, temporaries, and value sharing
  that could compile to that behavior. Preserve instruction witnesses and
  construction history separately.

The first allows equivalence and composition. The second retains distinctions
an optimizing compiler can erase semantically but still use to choose register
allocation, hoisting, and scheduling. Canonicalizing everything to one C
spelling loses the very information matching needs to explore.

This is not an attempt to recover uniquely historical source. Compilation is
many-to-one. The product is an acceptable source preimage of this toolchain.

### 3.2 Add a CFG/SSA backbone alongside the existing fast path

Build the original CFG before path exploration; recover dominators,
postdominators, strongly connected components, and natural loop regions.
Lift integer values into SSA with phi nodes and instruction provenance. Model
loads/stores/calls through explicit memory/effect tokens; joins merge memory
versions rather than duplicate complete path histories.

Required initial IR operations:

- bit-width-aware arithmetic, extensions and comparisons;
- generic byte-addressed loads/stores and address expressions;
- direct/indirect calls with ABI-lowered arguments and distinct result/clobber
  values;
- merges, conditional branches, dispatches, returns and exceptional exits;
- loop live-ins, carried values, backedge updates and exit continuations.

An unknown pointer is still a pointer-shaped value with memory effects. It must
not make the rest of the function disappear. A truly unsupported instruction
retains its location and blocks proofs across its affected region; it is not
silently omitted or turned into a dummy C helper.

**Migration:** do not replace the proven scan engine in one rewrite. Lift one
small region class into the new IR, adapt it to existing expression/storage/C
builders, and keep the old engine as a portfolio member. Use bounded symbolic
execution for local relation checking and scan recognition, not as the only
whole-program control representation.

**First vertical slice:** the 184-byte handler family. It combines branches,
shared tails, field stores, a call result, a passed pointer and a fifth
argument, without requiring a general loop solution. Follow with the
`800CDFAC` counted loop, then the sum scan and nested RLE loop.

### 3.3 Make memory and address recovery compositional

Represent addresses as an object/base hypothesis plus a byte offset expression,
not only "base + one shifted index." Normalize affine parts of expressions
while retaining sign-extension/truncation boundaries. Permit nested array and
member views:

```text
loaded_base + 40*i + 2*j + 4
    -> possible record_array[i].halfwords[j]
object + 0x28 + 2*object.index
    -> possible object.halfwords[object.index]
```

These are hypotheses with witnessed strides and offsets, not invented complete
struct definitions. Unknown extent stays a minimum extent; array bounds must
not be asserted merely because a few elements are accessed.

Use a byte-accurate memory layer for overlapping widths. On this little-endian
target, a word store followed by a byte read can be represented correctly before
choosing a union, byte view, or scalar-plus-narrowing source alternative. Do not
require a union simply because widths differ, and do not assume unrelated
pointer expressions cannot alias.

Handle unaligned operations both ways:

1. correct machine semantics for `lwl/lwr/swl/swr`;
2. recognition of complete compiler-generated aggregate operations, including
   runtime alignment tests and loop/tail copies.

The recognizer should produce whole-object assignments, aggregate parameters,
or evidenced library operations—not a hand-translated copy of the backend's
instruction expansion.

### 3.4 Recover context across the project, even before functions match

Introduce an evidence graph connecting:

- callee argument/return ports and caller uses;
- incoming stack/register slots and lowered aggregate arguments;
- pointer returns, pointee fields and indexed accesses;
- global origins, containing-object alternatives and TU ownership evidence;
- callback tables and possible callees;
- function families and compatible build profiles.

Facts need provenance and strength: SDK declaration, matched definition,
callee-machine lower bound, caller evidence, or a construction hypothesis.
Generated headers are outputs, not independent corroboration. Unknowns remain
sets of alternatives; disagreements create a recorded conflict, not an
arbitrary winner.

Solve compatible local components to a fixed point. A newly resolved
pointer-returning callee should unlock its callers without decompiling their
bodies. A newly witnessed record layout should enable all relevant users,
including currently unsupported ones. Revisit only consumers whose dependency
facts changed.

Use existing `callee-truth`, frame mapping, symbol/container identity,
TU-ownership derivation and the access index. Do not build a second competing
prototype database. Do not interpret overlapping overlay VRAM as object
identity or matching code in different overlays as one translation unit.

### 3.5 Recover operations before tuning code generation

Run SDK and compiler-operation recovery before low-level scheduling search:

- packet initialization, command/tag operations and publication boundaries;
- aggregate assignment and argument copying;
- division, remainder and compiler-inserted trap packets;
- constant-divisor arithmetic with correct signedness;
- balanced switch dispatch and shared tails;
- loop rotation, peeling, induction reduction and carried accumulators.

A `break` instruction is not automatically handwritten assembly. A guard/trap
packet can be an expansion of ordinary division. Preserve exceptional behavior
and effect ordering in the machine relation; test the corresponding division
source through the production compiler rather than emitting assembly or
ignoring the exceptional path.

Instruction/store order is evidence about emission, not a universal source
statement order. Source alternatives should preserve required data, alias,
call and publication dependencies while allowing genuinely independent
operations to be expressed in different orders.

## 4. Three engines that should cooperate

### A. Family reconstruction and transfer — implement first

Extend the existing idiom corpus from retrieval into a constructor:

1. Find related whole functions and regions using CFG, value-use, access-width
   and offset geometry—not only opcode lists.
2. Anti-unify the match into a template with constrained holes for globals,
   callees, field paths and constants. Repeated occurrences of one hole must
   remain consistent; call and data identities must stay container-aware.
3. Map the holes to the donor's C AST using machine/source provenance and
   actual declarations. Transfer a source expression or field access, not an
   arbitrary numeric literal with the same value.
4. Instantiate complete candidate C/context bundles.
5. Compile every member independently. Similarity never substitutes for the
   relocated-byte oracle or for source-policy validation.

Start with whole-function transfer and one changing field. The successful
`800D5ABC` experiment is a development case. Add different globals, constants
and callees only with corresponding constraints. For code without a matched
donor, solve one representative using a constructor or agent and automatically
replay the family.

Cross-overlay transfer is permitted as a tested source hypothesis, not as an
assumption of identical build history. Filter by effective flags and SDK/ABI
compatibility and keep the differences in the bundle.

### B. Compiler-generated recipe atlas — use the compiler as training data

The compiler source and executable are available. We should exploit both more
aggressively than using them only to reject guesses.

Generate small, natural C programs over bounded dimensions, compile them, and
index their machine and pass-level signatures alongside the C AST recipes:

- aggregate sizes/alignments, pointer and global address classes;
- member arrays versus standalone arrays versus embedded parent objects;
- argument and return widths, aggregate passing and local residence;
- early-return versus result-and-break scans;
- counted, pointer, sentinel, accumulator and nested loops;
- switch/if/shared-tail forms;
- verified SDK macro compositions;
- value materialization, reuse and statement birth order.

Parameterize these recipes from target evidence. Keep multiple recipes when
their outputs coincide; identical final words do not prove identical earlier
compiler state or identical useful extensions. Store `-dp` operation attribution
and selected `-da`/loop traces so a query returns an actual realizable source
construction, not a scheduler-state wish.

This extends the undelivered mechanism-grid direction in
`plans/backend-packet-and-aggregate-copy-automation.md`, reusing the current
idiom corpus and compiler harness. Begin with division/copy packets and the
loop/address forms seen here. Do not first grid every language construct or
write a second implementation of every GCC pass.

A richer future step is automatic recipe discovery: minimize a successful
agent edit, identify its changed source construct, parameterize it, and replay
it on related targets and compiler-generated fixtures. Promote a rule only
after those checks. One expensive solve should leave executable knowledge, not
only another narrative note.

### C. Region-level compiler-guided search — not Cartesian whole-function search

Once a candidate exists, use the reversed pipeline and staged residual to
select a causal region and the relevant source axes. Preserve alternative
origin/layout/control branches instead of freezing the first plausible draft.
Use bounded searches over interacting choices; search a small dependency
component jointly when changing one coordinate at a time cannot cross a
code-generation tradeoff.

A useful frontier holds distinct upstream hypotheses and Pareto alternatives,
not only one global byte score. Within a fixed interpretation, the existing
staged residual and target loop-emission requirements guide scheduling,
allocation and hoisting work. A replay failure or uncertain correspondence is
not a hard exclusion.

Important limits:

- Register-masked instruction agreement does not by itself prove semantic
  equivalence.
- A solved scheduler/allocator state is a requirement until complete C realizes
  it.
- Do not independently match machine blocks and concatenate them. Allocation,
  liveness and optimization cross block boundaries. Cache region alternatives
  using live-in/live-out, type and effect interfaces, then compile the complete
  function for every acceptance decision.
- Count and checkpoint the actual explored domain, including omitted axes.
  A narrowed heuristic subset cannot report exhaustive failure over the larger
  representation space.

Use content-addressed preprocessing/object/trace caches and bounded parallel
workers. Deduplicate actual experiments early. Do not pay for full compiler
forensics on every census candidate; invoke it where it distinguishes surviving
hypotheses. Keep simpler enumeration when it is cheaper.

## 5. The agent handoff should be an explicit product

Do not make the agent reconstruct the engine's reasoning from an error string
or a directory containing whichever C file happens to exist.

A prepared bundle should contain:

1. **A primary complete draft**, compiling with real context where the machine
   semantics are supported. No invented zero arguments, implicit declarations,
   register pins, assembly barriers or guessed scalar types presented as facts.
2. **Source-to-target region mapping** and the exact target/byte oracle inputs.
3. **Recovered context:** parameter/return hypotheses, fields, origin choices,
   SDK operations, call effects and their witnesses.
4. **A small alternative set:** materially different source/layout/control
   branches, not twenty spellings producing the same code.
5. **Residuals with confidence:** semantic/population uncertainty versus
   code-generation disagreement, per region; qualified pass ownership and
   relevant loop requirements where available.
6. **Closed experiments:** hashes, effective flags, scope of exclusions and
   conditions that would reopen them.
7. **The next bounded work item:** for example, choose an array-origin
   alternative, construct a loop-carried sum, or realize a specific live-value
   interface. Include matched family donors and recipes already tried.
8. **An integration plan:** shared-type/global declaration changes, affected
   callers and the required gates.

For partially supported functions, always preserve the CFG, raw target regions,
and independently derived facts. Produce an explicitly partial artifact if a
semantically faithful complete C draft is not available; do not conceal holes
behind compilable no-op placeholders. The live build continues using the
original stub until a whole function is accepted.

m2c remains useful as one structural frontend. Feed recovered context into it
**before** decompilation, and then repair the resulting AST against the same
analysis graph. Retain from-scratch constructors and family-derived candidates
in the portfolio. Choose the seed from measured quality and structural coverage,
not a universal "m2c always wins" or "engine always wins" priority.

Budget stops must return their best useful work. Workers should be resumable and
scheduled by expected information/yield, with a deterministic time/compile
budget. The current skill's unbounded "do not stop until exact" behavior is not
a suitable batch-service contract. A budgeted unresolved result is a normal
outcome, not automatically a request for a source-policy exception.

The agent can still persevere: it resumes when a genuinely new hypothesis,
context fact, recipe or capability appears, rather than buying the same evidence
again for hours.

## 6. Implementation order and concrete gates

The first tranche should deliver several useful end-to-end paths before a large
IR migration. Subsequent work should extend the common representation rather
than adding parallel ad hoc interpreters.

| Order | Deliverable | Concrete gate |
|---|---|---|
| 1 | Repair candidate/result contracts, overlay seed paths, effective flags, typed failure categories and partial-fact persistence | Overlay handoff works; budget stop retains a fresh draft; all-compile-error is not called a valid recovered seed; cache freshness tests pass |
| 2 | Whole-function donor instantiation and family replay | Reproduce the lookup transfer without hand-editing C; independently relocate/check every transferred member; reject deliberately wrong field/callee mappings |
| 3 | Complete ABI call snapshots, preserve signature types, support call-result pointers and generic member/index addresses | `800BF3D0`, `80116878` and `800D5D38` reach valid drafts; nonzero fifth/eighth argument fixtures retain the real values; the 31-member handler family no longer loses its fifth pointer |
| 4 | Correct overlapping/unaligned memory plus compiler-operation recipes | `800C6E0C` is representable; division traps are modeled; aggregate-copy regions recover a high-level construction instead of being classified as handwritten code |
| 5 | CFG/SSA region spine with shared-tail effects, then carried loops and exits | One handler representative yields a bounded structured domain; a ten-iteration call loop, accumulator loop and nested RLE fixture stay proportional to CFG size rather than iteration/path count |
| 6 | Recipe atlas and representation-aware near-miss repair | Automatic complete-source experiments realize the relevant loop/web/control alternatives; compare against the same bounded unguided domain; retain existing witnesses |
| 7 | Project fixed-point campaign, transactional integration and prepared-agent bundles | New signature/layout/recipe knowledge requeues only dependents; one end-to-end unattended campaign yields verified sources plus useful bounded residual tasks |
| 8 | Cold-context reconstruction validation | Use the configured project and toolchain, but withhold recovered game types and bodies; measure what the unattended reconstruction rounds can recover from binary and SDK evidence |

Each capability is complete only when it has all of:

- target-side applicability and an honest unsupported boundary;
- a source constructor or repair, not just a diagnostic message;
- parameterized compiler-generated regression fixtures;
- a real source-hidden reconstruction test where the class admits a witness;
- forward production compilation and independent relocated-byte verification;
- integration tests for associated data/context and full-container identity.

Do not block all later work on matching one exceptionally hard parked function.
The representation milestone and exact-matching milestone are different tests;
keep the best draft, label the remaining residual, and use additional members
of the class to determine whether a recipe is generally useful.

### Placement and reuse

Extend the existing `tools/agent/matching-reconstruction/` implementation with
separable CFG/value/effect, context-evidence, recipe, family-instantiation and
handoff modules. Keep the production compilation/oracle infrastructure shared.

Specific existing integration points:

- `tools/agent/cSourceGuard.ts` and the pinned tree-sitter frontend: AST edits
  and source eligibility;
- `tools/agent/idiom-corpus/`: family/recipe retrieval, extended to synthesis;
- `tools/agent/matching-reconstruction/access-index.ts`: origin evidence for
  all source constructors;
- `tools/agent/matching-reconstruction/callee-signature.ts`: evidence-bearing
  signatures, corrected bounds and ABI/type preservation;
- `tools/agent/matching-reconstruction/engine.ts`: candidate portfolio,
  resumable evaluation and result contracts;
- `tools/agent/repairM2c.ts`: a consumer of analysis/context, not a second type
  inference system;
- `tools/agent/pipeline-reversal/`, `tools/agent/loop-emission/`,
  `tools/agent/loop-trace/`: qualified guidance;
- `tools/agent/residual-source-search/`: finite, source-reachable repair rules;
- `tools/agent/finalizeEngineMatches.ts`: upgrade integration to structured
  context patches and transactions rather than dropping extern lines and
  hoping the replacement header happens to fit;
- `tools/diagnostics/benchmarkReconstruction.ts`: common population identity,
  target-derived feature tags and cold/warm/family-held-out evaluations.

New public entry points should follow the existing TypeScript CLI/Pi wrapper
and registration-test conventions. Reconstruction must remain independently
runnable; no new bootstrap skill is part of this plan.

## 7. What I would not build

- **A universal inverse GCC first.** Many erased states are indistinguishable;
  isolated pass witnesses may not be reachable from C. Use demand-driven inverse
  reasoning for residuals, backed by realizable source recipes.
- **A universal source permutation engine.** It magnifies domains whose missing
  representation is never expressed. Distinct spellings are not automatically
  distinct experiments.
- **A "better m2c" consisting of default casts and declarations.** Compilation
  alone is not a trustworthy semantic seed.
- **An instruction-by-instruction C interpreter as a matching solution.** That
  is a different static-recompilation product and usually destroys the compiler
  structures required for matching.
- **An unconditional greedy residual hill-climber.** The residual is useful
  within qualified correspondences; it is not a proof that upstream layout,
  signatures or control frames should never change.
- **Another report-only feature.** Existing plans already describe many useful
  detectors. New work should connect a fact to generated, compiled C.
- **An "everything is guaranteed matchable" stopping policy.** Assembly origin,
  unsupported SDK operations, boundary defects and assembler-emulation gaps
  exist. Unknown must be an actionable result, not a license for hacks or for
  an infinite worker session.

## 8. How to tell whether this is working without chasing a percentage

Use three practical questions:

1. **Does one new capability solve a real family rather than one handpicked
   spelling?** Report member-specific verification, not similarity counts.
2. **When automatic matching fails, does the agent start after semantic and
   context recovery rather than redo it?** Check compileability, preserved
   effects/types/structure, remaining uncertainty and repeated experiments.
3. **Does the campaign improve its own inputs?** A new signature, layout or
   successful recipe should cause a deterministic, bounded wave of useful
   reconstruction, without another agent per caller.

Retain function and byte coverage as guardrails so tiny wrappers do not hide
untouched large functions. Separate warm project context, cold reconstruction
context, compiler-generated tests and related-family transfer. An exact match
under a known donor is useful operational progress, not an independent
source-hidden discovery. Split held-out tests by family when testing generality.

The 80/20 ambition is best understood as a desired division of labor, not a
promised yield. The concrete evidence supports a substantially larger static
role: basic representation gaps are still blocking ordinary C, repeated
families remain unsolved as families, and one deterministic source transfer
already closed a parked residual in this investigation.

**The first implementation sprint should fix the handoff/call contracts and
ship family instantiation. The central architectural investment should then be
compositional CFG/value/effect reconstruction with alternative source origins.
That combination grows both automatic matches and the quality of everything
left for an agent.**
