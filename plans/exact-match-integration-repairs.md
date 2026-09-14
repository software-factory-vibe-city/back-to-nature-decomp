# Automate repairs between an exact candidate and project integration

## Status and scope

**Proposed; not an implementation request.** This records the concrete repairs
performed during the interrupted integration batch, so they can become bounded,
verified automation rather than another manual decompilation session.

The user requested that the work be retained and these repair classes documented.
Do not restart reconstruction, broaden a source search, or silently repair a
refused function when the user asks to run integration. A normal integration run
should apply accepted transactions and report refusals. A separately enabled
repair phase may try the finite transformations below.

This extends [the static-first plan](static-first-matching-decompilation.md),
addressing the integration failures established by
[the second review](../notes/research/static-first-second-review.md). It assumes
the configured project and production toolchain. No bootstrap, new matching
backend, speculative flag changes, or policy exceptions belong here.

## 1. Preparation checkpoint and subsequent integration

Evidence is under `build/static-first-integration/`.

- The selected pool contains **82 distinct functions**: the union of corrected
  warm/cold reconstruction results and the reviewed family-transfer results.
- One family artifact was rejected before preparation because it uses an
  unapproved hard-register capture.
- Of the other 81, **57** initially passed after basic project/prototype
  reconciliation; further repairs brought this to **72 / 5,156 bytes**.
- Those 72 passed independent production compilation, relocated-byte comparison,
  compiler-diagnostic rejection, parsing, and the current source-policy scan.
  This is a **prepared-source checkpoint**, not final project acceptance or a
  claim that every remaining type hypothesis has been proved.
- **Nine prepared candidates remain nonmatching under the reconciled interfaces.**
  Their earlier raw byte matches must not override that result.
- At the interruption, **no new function body had been copied into `src/`**.
  The follow-up integration below has now changed that.

At that pause, the retained live edits were type/declaration preparation in
`include/game_types.h` and `include/globals_override.h`, plus removal of the
now-shared `D_8012D060` declaration/type from
`src/overlays/ovl_11/ovl_11_func_80108864.c`. That existing function's body is
unchanged and remains **EXACT, 32/32 words**. The corresponding prepared reader,
`ovl_11_func_801089DC`, remains **EXACT, 18/18 words** after using the shared fields.
Generated context was refreshed through its generator, not hand-edited. That
also republishes previously missing signatures of already-compiled functions;
it is not new decompilation progress. The exporter still warns about unresolved
private overlay types, so this is not a claim of complete context acceptance.

At the pause, `make check-all` still matches the executable and every overlay.
This is an incremental build, not a new clean-rebuild claim. Before applying a
prepared batch, recheck all selected sources against the final headers, audit
newly resolved callees, and verify affected existing translation units. The
checkpoint reports are evidence of the measured source/header states, not a
perpetual approval of whichever files later occupy those paths.

### Follow-up: the accepted subset is now integrated

The existing transaction API has now applied **all 72 prepared candidates**,
without further source repairs or fallback to historical engine artifacts.
Each source was revalidated before application and again in its live location.
The full batch was then audited against the newly available callee definitions.

- **72 functions / 5,156 bytes integrated.**
- **67 live functions / 4,820 bytes** added to the progress measure; five
  integrated functions are outside the live denominator.
- Live totals: **837 / 2,559 functions (32.71%)** and
  **95,740 / 645,172 bytes (14.84%)**.
- All 14 containers match; all 72 pass the scoped source-policy gate; no callee
  contradictions or new context-type warnings were found.
- The nine interface-related nonmatches and one policy refusal remain stubs.

The repository-wide policy sweep still reports findings in 25 pre-existing
files, including parked sources with disabled attempts. Those files were
compared byte-for-byte with the pre-application snapshot and are unchanged.
This is a passing **batch** policy result, not a claim that the unrelated
repository-wide backlog was repaired.

The distinction this plan must preserve is now concrete: **apply the accepted
subset; report the rest.** Refusals must not hold the entire batch at preparation.

## 2. Repairs actually performed

### A. Select the explicitly verified artifact, not a historical winner

The existing planner can prefer an old reconstruction result over a corrected
published source. Four plans in the review thereby resurrected valued returns
from `void` functions.

For this batch, selection was explicit: the preserved sources named by the
corrected warm/cold observations and family report were independently recompiled.
No old engine manifest was allowed to substitute a different source.

**Automate:** give the integration transaction an immutable artifact identity:
producer, function/container, source hash, target hash, effective flags/toolchain,
and evidence/context revision. Preserve alternatives. A stale artifact may be
revalidated, but must never be silently preferred because of its directory.

### B. Replace standalone scaffolding with the real project context

Performed:

- remove standalone scalar typedefs in favor of `common.h`;
- use `game_types.h` and the SDK scalar header where required;
- identify declarations actually provided by the preprocessed umbrella scope;
- remove redundant global externs, including names represented by generated
  macros/assembler-name bindings;
- preserve tentative definitions that express translation-unit ownership and
  GP-relative addressing.

**Automate:** AST-based declaration reconciliation with an explicit reason for
removing, retaining, or relocating each declaration. Name presence alone does
not prove type compatibility. Do not delete every extern, enlarge a global to
steer addressing, or redeclare a generated global in the function's source.

### C. Restore independently witnessed callee signatures and pointer arguments

The cold artifacts in particular use generic integer prototypes. Replacements
were taken from SDK headers and the callees' own matched definitions—not the
generated function context header.

Examples include:

- `func_80017300`, `func_8001719C`, and `func_80017200`: byte-pointer arguments;
- `func_80015840` / `func_8001585C`: `ObjectState *` arguments;
- `ovl_19_func_800BAC40`: its shared record-pointer type;
- SDK functions such as `SquareRoot0`, `GsSetProjection`, and `ClearOTagR`:
  their actual scalar/pointer return and parameter types;
- `ovl_11_func_800D583C`: its witnessed narrow parameter and return types.

Calls were adjusted with explicit pointer conversions where the machine value
is an address. This removed several pointer/integer diagnostics while preserving
exact output. Explicit declarations were also supplied for previously implicit
calls. Where only bounded ABI evidence exists, its uncertainty remains; a
compiling declaration is not proof of a unique original signature.

**Automate:** preserve complete declarators, including pointer returns, signedness,
and aggregate parameters. Match call arguments to the witnessed declaration.
Do not erase known types, fabricate arguments, cast between incompatible function
signatures, or override a contradiction merely to regain matching bytes.

### D. Reuse existing global layouts and preserve address-versus-value meaning

Performed:

- replace invented `D_8005E3C0->unkD8` / `unk120` accesses with the existing
  `field_D8` / `field_120` layout;
- use the established graphics-object view for `D_8005E3A8`'s field at `+8`;
- retain the existing pointer declaration for the GP-relative `D_8005E340`,
  using a partial pointee view for the newly witnessed halfword store at `+4`;
- repair `D_800A0728` accesses when a standalone byte-array declaration becomes
  a project scalar-lvalue macro: the address of the object is needed, not its
  stored integer interpreted as a pointer.

**Automate:** map accesses by storage identity, base provenance, byte offset,
width, and signedness. A field-name substitution is justified only by that map.
Array decay, taking an address, dereferencing a stored pointer, and reading an
integer are separate operations; textual name replacement cannot preserve them.

### E. Publish view types and global declarations in their designated headers

The generated private types were moved out of candidate translation units:

- parameter/local views into `game_types.h`;
- global-object views and previously missing global declarations into
  `globals_override.h`;
- full container/function identity in new private view names, rather than an
  address alone, to avoid overlay collisions;
- unused invented views removed once an existing project layout replaced them;
- unknown array extents kept unsized rather than invented.

The initial publication collected 19 shared views, six global views, and 15
external globals. The subsequent `D_8012D060` reconciliation replaced one of
those private views/array declarations with a shared global record; these counts
are historical checkpoint bookkeeping, not a final schema.

**Automate:** build a declaration dependency graph, determine ownership and header
placement, check collisions, and propose a multi-file transaction. Padding in a
minimal view does not prove the full object extent. Matching field shapes alone
do not justify merging types or storage identities across overlays.

### F. Reconcile a newly shared global with an existing matched writer

`ovl_11_func_801089DC` reads four signed halfwords from `D_8012D060`.
The already-matched `ovl_11_func_80108864` writes exactly those fields, but declared
its own local `UnkStruct3` global. Adding a byte-array extern to the shared header
would conflict with that existing source.

The retained repair introduces `Ovl11D060Fields` in the override header, removes
the writer's duplicate declaration/type, and makes the prepared reader use the
shared fields directly. Both independently retain exact machine code.

**Automate:** adding a global declaration must search existing translation units
for competing declarations. Reconcile evidenced layouts transactionally and
reverify the existing users. Do not call a one-file byte check sufficient when
integration changes the context of another function.

### G. Restore function designators and indexed-table declarations

Performed:

- replace `extern u8 callback[]` declarations for actual functions with function
  declarations in three overlay-11 callback installers;
- type the receiving callback parameter from `ovl_11_func_800FD034`'s indirect
  call and the callback entry code: two halfword arguments, result ignored;
- replace scalar declarations for the indexed dispatcher tables at
  `D_800BB4E4` and `D_800C49F8` with unsized arrays, and use array decay for the base.

These changes also retained exact output.

**Automate:** distinguish code addresses from data objects using symbol/container
identity and the consumer's call behavior. A function must not be published as
an array merely because both produce the same address relocation. Table indexing
is evidence for array use, not necessarily for an exact length or callback type.

### H. Remove a source-language extension without changing the operation

The transferred `ovl_11_func_800D5ABC` used arithmetic directly on `void *`.
The preparation changed that byte offset to arithmetic on `char *` and retained
the exact match.

**Automate:** a small explicit C89 normalization rule, not a general expression
simplifier. Keep intermediate cast/width behavior and recompile the full function.

## 3. Repairs attempted but not successful — mandatory stop cases

### Aggregate call-interface mismatch: eight functions

`func_80014CBC`'s matched definition returns a pointer and takes two `ReadFlag`
aggregates. Eight cold artifacts instead declared integer arguments/results:

- `ovl_11_func_800F71DC`;
- `ovl_27_func_800BA578`;
- `ovl_27_func_800BA1CC`;
- `ovl_27_func_800BA514`;
- `ovl_27_func_800BA750`;
- `ovl_27_func_800BA5BC`;
- `ovl_28_func_800B8B0C`;
- `ovl_28_func_800B8CE4`.

The attempt preserved pointer types and constructed the flags through ordinary
union-backed aggregate values. This compiled without the original type errors,
but introduced extra memory operations, including unaligned copies, and did not
match. The pipeline reversal identifies an instruction-population difference,
not an allocator/scheduler problem.

**This one failed representation is not an impossibility proof.** It also is not
permission to restore the weaker declarations. Leave these as explicit interface
refusals unless a bounded, clean, independently verified repair succeeds.

### Consumed void result and narrow-argument mismatch: one function

The cold artifact for `ovl_19_func_800BAFAC` consumed and returned the result of
`func_800248E8`, whose matched definition is void. Removing that fictitious value
and restoring the other callee declarations left a nonmatch: the witnessed signed
byte parameter of `func_80015840` introduces sign extension where the target
zero-extends the argument.

Keep this as a caller/callee-interface research item. Do not change an already
matched callee's signature or weaken a declaration solely to improve the caller's
score. A future repair needs independent evidence and verification of both sides.

### Donor policy does not transfer: one function

The family artifact for `ovl_11_func_800D0600` contains `CAPTURE_PREV_RET`, which
expands to hard-register pinning. Its existing approval note records the missing
policy exception. No exception was granted or added in this batch.

**Automate:** inspect inherited macro behavior as well as literal source. A
source-policy exception belongs to its approved function/container, not every
member of a similar family. Report the refusal; never create an allowlist entry.

## 4. Proposed automation contract

Extend the existing transaction machinery in
`tools/agent/campaign/integration.ts` and
`tools/agent/finalizeEngineMatches.ts`; do not build a competing finalizer.
Reuse `tools/agent/calleeTruth.ts`, `tools/agent/cSourceGuard.ts`,
`tools/agent/decompToolchain.ts`, the container/symbol model, and the byte oracle.
The scripts in the evidence directory are experiment records, not production
implementations to copy wholesale.

### Default: integrate, do not decompile

1. Select an explicitly identified exact artifact.
2. Apply only established integration transformations.
3. Verify the complete transformed source and affected existing functions.
4. Apply the whole source/header/context transaction or leave the tree unchanged.
5. Report **applied / already present / refused**, with the exact reason and
   preserved candidate for every refusal.

Do not silently start structural matching, source search, or LLM work.

### Optional bounded repair phase

Each enabled rule carries:

- preconditions and independent witnesses;
- exact AST/declaration changes and affected files;
- preserved semantics and ABI assumptions;
- finite alternatives and a compile budget;
- evidence that the complete source still matches;
- a named refusal when a prerequisite, proof, or budget is missing.

Persist source/header hashes and the complete outcome. Deduplicate equivalent
outputs. SDK parsing must manage tree lifetimes and fail closed; short-lived
verification workers contained the known leak during this batch but are not a
substitute for fixing ownership.

## 5. Acceptance gates and implementation order

### First: make the existing path safe

- Explicit artifact selection/freshness; no historical-winner precedence bypass.
- Successful compiler diagnostics checked **after every rewrite and in-tree**.
- Real source-policy checking, including macros and target-specific exceptions.
- Transaction snapshots that include headers, affected source, and generated
  context; no destructive recovered-overlay reset.

### Then: automate the demonstrated low-risk rules

- Scalar scaffolding and extern reconciliation.
- Witnessed prototypes, pointer conversions, and field/address mapping.
- Container-qualified view publication and existing-global declaration repair.
- Code-versus-data and array-base corrections.

Test the real retained examples and negative neighbors. Every rule must preserve
exact output or refuse; a generic compilation-success test is insufficient.

### Release gate

On this frozen 82-function pool, report functions and bytes at each separate gate:
raw exact, repaired exact, diagnostic/policy accepted, context accepted, and
actually integrated/live-eligible. Do not require a particular accepted count by
weakening a gate. The demonstrated 72 prepared matches are a regression cohort,
not a quota or a promise of 72 live promotions.

Require:

- relocated-byte equality under production flags for the actual selected and
  transformed source;
- no newly introduced source/type/policy defect or unresolved analyzer failure;
- witnessed type publication rather than new opaque context placeholders;
- regeneration through the existing generators;
- targeted recompilation of all affected existing translation units;
- full executable/overlay identity;
- no out-of-scope edits and no live mutation on a refused transaction;
- per-container live-progress accounting, separately from dead/excluded spans.

## 6. Evidence map

All paths below are relative to `build/static-first-integration/`:

- `candidates.json`: explicit 82-function source selection.
- `implementation-before.patch`, `status-before.txt`, `live-before.tar`:
  pre-integration snapshots preserving unrelated work.
- `audit/<function>/truth.json`, `triage-before.json`: independent premises and
  preflight findings.
- `prepared/<function>/`: retained edited candidates and intermediate source
  snapshots; not promoted source.
- `checks-initial.json`, `checks-reconciled.json`, `checks.json`: successive
  independent compilation/diagnostic/policy/byte measurements.
- `prepare.ts`, `reconcile.ts`, `publish-types.ts`: the experiment's preparation
  steps; not a production repair service.
- `type-publication.json`: publication checkpoint, preceding the final
  `D_8012D060` harmonization; do not replay it blindly over the retained headers.
- `BAFAC.diff`: the remaining signed-argument population mismatch.
- `retained-build.log`, `retained-context.log`, `retained-policy.json`: checks
  after retaining the edits and completing the existing declaration move.

The original artifacts remain preserved under `build/static-first-rereview/`.
Follow-up application evidence:

- `applied.json`, `applied/<function>/transaction.json`: the 72 actual source
  transactions and their pre-/post-application checks.
- `pre-apply-live.tar`: the retained source/header state before application.
- `applied-build.log`, `applied-context.log`, `progress-after.txt`: linked
  identity, generated context, and measured live progress.
- `final-check.json`: scoped policy acceptance, post-batch callee audits, no new
  context warnings, and unchanged files underlying the pre-existing policy
  findings.

The 72 accepted bodies are now integrated. No commit was made.
