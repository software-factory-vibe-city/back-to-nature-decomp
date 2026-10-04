# Raw and repaired draft failures in the 2026-10-04 autoloop session

## Bottom line

The dominant initial-draft failure was **an incoherent type/context boundary**, not
failure to recover the function's broad algorithm. The decompiler often recovered
the branches, calls, loop bounds and arithmetic, but emitted field operations,
address arithmetic and signatures that could not be used as C in the destination
translation unit. The repair layer mostly replaced unknown type tokens and added
declarations; it did not finish that conversion. It also introduced new defects.

There are genuine decompiler/emission limitations here: byte offsets printed as
typed-pointer arithmetic, a dropped incoming argument slot, and control-flow
spellings that do not reproduce the target. Better context is necessary, but not
sufficient. A successful compile is also insufficient: one of the two compiling
repairs advances a halfword pointer twice as far as the target does.

This investigation changed no live C, headers, configuration, decompiler or
pipeline implementation. It did not run autoloop or commit anything.

## 1. Scope, evidence and reproducibility

Session:

```text
~/.pi/agent/sessions/--home-dave-Documents-code-btn-decompilation--/2026-10-04T07-32-28-677Z_01a105d4-1985-7664-8d15-efa4eed70e6f.jsonl
```

`Lnnnn` below means the **one-based JSONL line**, not a line in an extracted
transcript. Calls and their result messages are separate records. The evidence
index retains both line numbers, entry IDs, timestamps and tool-call IDs.

I examined every m2c/repair invocation in this session, recovered **all 27 raw
m2c outputs** from subsequent `read`/shell-read results, and traced their later
edits and measurements. None of the 27 m2c calls reported a generation failure:
all wrote a draft. This is an investigation of the usability of those drafts,
not a census of every function m2c could have processed.

Historical artifacts survived for all 14 repair targets:

- 14 `*.scope.i` files: preprocessed repair **inputs**, retaining the headers
  that were in scope then.
- 11 repaired `.c` files and 11 corresponding compiled-input `.i` files.
- The twelfth distinct repaired output that was actually compiled,
  `800E39B8`, is present verbatim in the session after `--write`.
- For report-only `800E4AEC`, repair said it changed nothing. For report-only
  `800C838C`, the session did not print a complete repaired output; do not
  relabel the subsequent read of the unchanged live file as that output.

I copied the surviving artifacts before experimentation and hashed them. Their
mtimes align with the historical calls. Recompiling the 14 raw `.scope.i` files
reproduced **14 compile failures**. Recompiling the 11 repaired `.i` files
reproduced **the same nine failures and the same two mismatches** as the session,
including their historical oracle counts. These replays bypass preprocessing:
today's headers were not substituted for the old ones.

The compiler executable and flags used for replay are recorded in the report.
The current Makefile SHA-256 starts `d4541127`, agreeing with the historical
measurement provenance. This is not a reconstruction of all historical m2c
context files: the raw drafts are preserved observations, and the `.i` files
freeze compiler context, not decompiler input context.

Evidence and small analysis scripts live under:

```text
build/investigation/static-drafts/
  provenance.json              session identity/hash
  calls.json                   indexed calls and results
  index.json                   per-function draft/artifact provenance
  <function>/raw-observed.c    historical m2c output, not regenerated
  <function>/timeline.json     tool chronology
  <function>/conversation.txt  historical messages with JSONL references
  <function>/preserved/        copied historical .c/.i artifacts
  historical-replay.json      full replay diagnostics, flags and hashes
  ast-evidence.json            parse evidence for malformed declarations
  repair-probes.json           isolated repair-pass reproductions
  context-probe/               controlled context-only experiment
```

Reproduce the compiler and repair-pass checks, without editing live sources:

```sh
npx tsx build/investigation/static-drafts/replay.ts
npx tsx build/investigation/static-drafts/ast-evidence.ts
npx tsx build/investigation/static-drafts/probe-repairs.ts
npx tsx build/investigation/static-drafts/context-probe.ts
```

The scripts are investigation artifacts, not a new production tool. The context
probe is explicitly a new controlled experiment, not an original-session result.

## 2. Denominators: what actually happened

| Observation | Count |
|---|---:|
| Raw m2c invocations / distinct targets | 27 / 27 |
| Raw drafts containing `?` type markers | 17 / 27 |
| Raw drafts containing `.unk...` or `->unk...` field operations | 16 / 27 |
| Raw drafts containing `M2C_ERROR` unset-register expressions | 3 / 27 |
| Repair invocations / distinct targets | 15 / 14 |
| Repair calls with `compile: true` | 11 |
| Those calls reporting compile errors | 9 |
| Those calls compiling, but mismatching | 2 |
| Additional repaired output failing a later compiler call | 1 (`800E39B8`) |
| Raw drafts observed byte-exact without a subsequent source edit | 2 |

The symptom rows overlap. The raw replay sample is the **repair-selected 14**,
not a random sample of the 170 attempted functions. There was no consistent
historical raw-compile baseline for all 27, so do not call 14/14 the overall raw
m2c failure rate.

The two untouched raw successes were `ovl_11_func_800BD538` (L3145, 26/26) and
`ovl_11_func_800F0FB0` (L11305, 34/34). Both also passed finalization. This matters:
it is incorrect to conclude that m2c never produced directly usable code.

Nine targets reached EXACT on the first residual measurement after the agent's
first explicit complete-source rewrite following m2c: `ovl_21:800B8654` and
`ovl_11:800E78E4`, `800DA49C`, `800E2BE8`, `800C141C`, `800FA31C`, `800DF6A8`,
`800C838C`, `800CFA48`. Some required preceding header work and investigation;
this is not a claim of nine trivial or single-operation fixes. It does show that
many drafts already contained enough of the function's logic to be useful.

## 3. Common raw-draft failures

### 3.1 Global declarations discard the object view the accesses require

Typical output:

```c
extern ? D_80129230;
/* ... */
ovl_11_func_800F4390(D_8006C838.unkDDD0,
                    (s32)D_8006C838.unkDDFA);
D_8006C838.unk4476 = 1;
```

This is `800E5230`, raw L2089. The project declares `D_8006C838` as an array,
not a struct exposing these members. Related failures recur in `800C141C` and
`800CFA48`. `D_8007AFF0` has the same problem in `800B8CEC`, `800DF6A8` and
`800F12D0`. Unknown overlay globals add their own missing object layouts.

The mismatch is architectural, not just a missing `extern`:

- `tools/build/classifyGlobals.ts:383`, `generateM2cContext`, emits **plain
  scalar externs for all symbols**, without carrying the overrides' object
  views. Its own comment says "no macros, no arrays".
- `tools/agent/m2cFunc.ts:103` supplies that globals context, generated types
  and signature headers to m2c.
- Its output includes only `common.h` (`m2cFunc.ts:161`). That header exposes
  `globals.h` and `globals_override.h`: a different, richer declaration model.

Consequently, a name can be a scalar in m2c's input, an array or macro in the
compiler's input, and a fictional struct in m2c's output. Adding another scalar
extern does not reconcile any of those views.

**Controlled check:** using `800B9C48`'s original assembly, minimal scalar typedef
context reproduces the historical unknown-global/field draft. Adding only
`extern s32 D_800BD848` still produces invalid member operations. Supplying a
partial view with the independently visible signed-halfword fields at +8/+A/+C
produces compilable C without changing the recovered arithmetic. This was a
local evidence experiment, not a claim of the global's complete layout or a
promoted matching candidate.

### 3.2 The decompiler's type scope is not the compiler's type scope

Three especially clear examples:

- `800F40A4`: emitted cast to `Entry_800F53BC *`, but the draft includes only
  `common.h` and does not define that type.
- `800FB218`: emitted parameters of type `SwapStruct_B45C *`. A session read
  of `sdk_types.h` shows the placeholder
  `typedef struct { unsigned long pad[1]; } SwapStruct_B45C;`; the callee's
  actual struct was local to its source. The draft even passes `*arg0` as the
  scalar argument to another callee.
- `800DF6A8`: emitted `UnkStruct800DF4F0 *`, unavailable through `common.h`.
  The then-existing shared definition, quoted in the session, was only
  `typedef struct { u16 unk0; } UnkStruct800DF4F0;`. Merely including it would
  still not supply the +0x30/+0x34 fields the caller accesses.

`contextExport.ts` deliberately emits m2c-only headers. It warns when it uses
opaque placeholders, but that warning is not carried into these individual
m2c drafts. A successfully parsed m2c context is therefore not evidence that its
types are complete, that their inferred operations are valid, or that the
emitted translation unit can see them.

This is also a **partial-view problem**: a type sufficient for one callee is
not necessarily a complete description of the object seen by its caller.

### 3.3 Byte offsets survive as incorrectly scaled C pointer arithmetic

This is the most consequential failure that compiling alone misses.

Historical repaired `80106EB0`:

```c
s16 *var_s0;
/* ... */
var_s0 += 0x2C;
```

The target advances this address by **0x2C bytes**. C advances a `s16 *` by
**0x58 bytes**. The preserved repaired `.i` compiles to `addu $16,$16,88`, while
the original at `0x80106F00` adds `0x2C`. The repair reported a superficially
close 25/28-word mismatch. One differing word changes which records are read;
it is not an allocation or scheduling difference.

Other observed examples:

- `800E5230`: `s32 *var_v0`, `&D_80129230 + 0x1C4`, and `var_v0 -= 0x30`.
  Scalarizing the unknown global makes the initial displacement and stride
  scale by four.
- `800F40A4`: two `s32 *` cursors incremented by 4 and 2, despite target
  byte strides of 4 and 2 and a halfword load through the second cursor.
- `800E2A30`: `s16 *arg0` followed by `arg0 + 0x78` where the machine adds
  0x78 bytes, not 0xF0.
- `800C141C`: table index arithmetic already contains its byte scale, but
  repair makes `&D_80122F0C` an `s32 *`, scaling it again.
- `800FA31C`: `? *var_s0; var_s0 += 4`; repair changes it to `s32 *` but
  leaves the numeric stride, while the useful view is a four-byte record.
- `ovl_21:800BA7F0` and `800B9844`: word pointers advanced by raw record-byte
  strides 0x108 and 0x4C.

A type repair must be checked against address equations and access widths, not
just declaration compatibility. The current repair explicitly declines to
rewrite pointer uses, so this entire class survives it.

### 3.4 Signature context can manufacture missing-register failures

All three raw `M2C_ERROR` cases are informative:

| Caller | Raw symptom | Historical explanation / eventual source |
|---|---|---|
| `800E2A30` | unset `$a3` passed to `func_80015704` | Generated context declares four parameters; caller target and the eventual matching caller use two. |
| `800E2BE8` | unset `$a3` passed to `800D075C` | Header/definition declares four parameters, while existing matched callers and this target use a three-argument call form. |
| `800F12D0` | unset `$v0` after `800DBC04(0)` | Generated context says the wrapper returns `void`; this caller's original words consume `$v0` as a pointer. The matching caller used a pointer-returning declaration. |

These are not evidence that the original target necessarily reads arbitrary
uninitialized registers. They are conflicts between call-site machine behavior
and the declarations supplied to m2c. Nor do the session's fixes prove the
callee's unique original C signature: a byte-matching wrapper body can leave
return-type ambiguity, and unused formal parameters need not be settled by its
own byte match. Conflicts need explicit evidence, not automatic preference for
"already matched" context.

`800E78E4` also inferred an extra argument to `func_80012A34`; the successful
source used the recognized one-argument `Rand` entry. `800E39B8` inferred
inconsistent two-/three-argument `SystemError` calls without its SDK prototype.

### 3.5 Missing incoming ABI slots and nonmatching control-flow forms

`800FB218` is a direct ABI defect:

```c
s32 ovl_11_func_800FB218(SwapStruct_B45C *arg0,
                       SwapStruct_B45C *arg2, s32 arg3)
```

The original consumes incoming `$a0`, `$a2` and `$a3`. Omitting the unused
second parameter shifts the latter two C parameters into `$a1` and `$a2`.
Naming them `arg2` and `arg3` does not preserve their ABI slots. The agent
restored a four-parameter signature.

Control-flow reconstruction was often useful even when not byte-exact:

- `800FB218`'s unusual nested `case 1` was actually worth retaining. The
  agent first rewrote it as if/else, got a CFG mismatch, then restored m2c's
  irregular-switch construction and matched (L8124–L8128).
- `ovl_31:800B8348`'s memory-card status classification was largely recovered,
  but the emitted shared-tail/goto arrangement did not match. The final
  version used separate negative/positive assignment labels.
- `ovl_15:80135AE0` recovered nested XOR/checksum loops, but getting valid
  storage views was only the start of the later compiler-form experiments.

These are reasons to give the agent the draft as evidence, not to either trust
it blindly or discard its structure wholesale.

## 4. Repair-layer defects, traced to mechanisms

### 4.1 Pass 1 cannot recognize `extern ? name;` before pass 2 fixes it

The passes run in this order: globals, unknown types, callee signatures,
geometry comments. Tree-sitter's declaration for

```c
extern ? D_80126F8C;
```

contains an error node and a missing declarator identifier. The pass's
`declaratorName` lookup does not find the global as an existing declaration.
It adds a new extern, then pass 2 repairs the original one:

```c
extern u32 D_80126F8C;  /* newly inserted from access-width evidence */
extern s32 D_80126F8C;  /* old unknown declaration defaulted afterward */
```

Exactly this failure occurs for `D_80126F8C` and `D_80137830` (L10545, L11366).
For `D_80129230`, `D_80122F0C` and `D_800BFE44`, both guesses happen to be s32,
so duplicate declarations do not themselves fail compilation, but still expose
the same defect.

The same blind spot defeats removal of a header-conflicting declaration:

- `800B9C48`: `extern ? D_800BD848` becomes an s32 redeclaration against the
  existing byte-array declaration (L2200).
- `800E78E4`: `D_80129560` is a macro expanding to a pointer expression.
  `extern s32 D_80129560;` expands into invalid syntax. Its use as
  `&D_80129560` is independently an invalid address-of operation (L6659).

The code knows about macro-backed globals; the problem is not that all macro
support is absent. It fails to connect the malformed original declaration to
that knowledge before transforming it.

### 4.2 Pass 2 replaces only the first `?` in each error node

`repairM2c.ts:350` uses `text.indexOf("?")` once per ERROR/MISSING node. Parse
error nodes are not one-token records. This leaves markers unhandled:

```c
/* Raw */
? ovl_11_func_800C7270(void *, ?, s32, ?);
/* Replaying the actual pass 2 */
s32 ovl_11_func_800C7270(void *, s32, s32, ?);
```

`SystemError(?, ?, ?)` and `MemCardSync(?, ? *, s32 *)` have the same issue;
the later signature pass happens to replace those whole prototypes. I reproduced
these transformations with an isolated copy of the existing repair code and
the historical raw inputs, without running fresh context recovery.

A syntactically damaged AST requires token/range-aware normalization and a
post-transform parse check; traversing it as if every declaration were already
well formed is not enough.

### 4.3 Pass 3 replaces one prototype once per call site, corrupting text

`800E39B8` calls `SystemError` twice. The report says twice that its prototype
was replaced. The resulting source, printed at L10235, contains:

```c
void SystemError(s32 arg0, s32 arg1);s32 arg1);
```

Mechanism: `passCalleeSignatures` iterates `context.calls` (call sites), queues
the same declaration node twice, and applies both edits using the original
node offsets. The second replacement cuts into text already changed by the
first. `calleePrototypes` deduplicates names, but the consumer's edit loop does
not deduplicate declaration ranges.

The isolated pass replay reproduces the malformed line exactly. The historical
next residual call failed on the stray `)`, the unreconciled three-argument
call, and the existing `*var_s0` where `var_s0` is an integer. This was a tenth
observed repaired compile failure, omitted by counting only `compile: true`
repair reports.

### 4.4 Overlay signature lookup uses the wrong generated-header path

In `matching-reconstruction/callee-signature.ts:179`:

```ts
const overlayId = container.id.replace(/^ovl_/, "");
const path = join(ROOT, `include/overlays/${overlayId}.h`);
```

For `ovl_11`, it looks for a file named `11.h` inside `include/overlays/`.
The exporter and m2c wrapper correctly use `include/overlays/ovl_11.h`.
The stripped-prefix filename does not exist.

Thus the repair's matched-definition tier falls through to weaker evidence even
when the corresponding overlay signature was available to m2c. The session
records examples of this mismatch: `800DF4F0` and `800D756C` appear in the actual
overlay header in contemporaneous reads, but repair reports only caller bounds.
Across the repair reports, seven distinct overlay callees get the "arity is
bounded ... not written" treatment:

```text
800F4390  800EFDA0  800C1224  800DF4F0  800D12A0  800D756C  800D3230
```

Not every one is independently proved to have had a usable signature in the
header then. The path defect is established by the implementation; the
contemporaneous examples establish that it lost real available context, not
merely hypothetical future information.

The inspected implementations are unchanged working-tree files, last committed
before the session. I did not rerun the full repair against today's recovered
context and present that as a historical baseline.

### 4.5 SDK signature recovery preserves arity but erases parameter types

The SDK has:

```c
long MemCardSync(long mode, long *cmds, long *rslt);
```

The historical repair emitted:

```c
s32 MemCardSync(s32 arg0, s32 arg1, s32 arg2);
```

`callee-signature.ts:361` returns `paramTypes: []` for SDK prototypes.
`context-product.ts:669` fills missing parameter types with s32. The report
nevertheless labels the replacement a **declared signature**. Replaying the
preserved compiler input produces pointer-to-integer warnings for arguments 2
and 3. The original repair report suppresses those successful-compile warnings.

This is not a proof that these prototype differences caused the remaining
memory-card branch mismatch; they are a separate type/evidence defect. The same
arity-only conversion prints `SystemError(s32, s32)` instead of the SDK's
`SystemError(char, long)`. The matched/recovered signature paths also collapse
non-void returns to s32; that is an additional implementation limitation, not a
separately measured cause of a failure in this sample.

### 4.6 "Repair" leaves the central field-access problem untouched

The fourth pass produces **comments only**, not usable field views or rewritten
accesses. The module explicitly declines to rewrite pointer uses. The first two
passes cannot make these operations valid just by changing `?` to s32:

```c
scalar.unk20
void_pointer->unk4
s32_pointer->unk0
```

`800E4AEC` is the clearest contract failure: repair reported **"no changes
needed"** despite `arg0->unk4` with `void *arg0`. The historical raw `.scope.i`
replay confirms it does not compile. The report means only "none of the current
passes made an edit", not "a usable seed was produced".

## 5. Complete repair-target accounting

Symbols abbreviated after their container prefix. The diagnostic column names
the first failure or major residual, not every cascading compiler message.

| Target | Repair result record | Historical result | Important cause |
|---|---:|---|---|
| `ovl_11:800E5230` | L2092 | compile error | Array/global used as struct; duplicate s32 extern; scaled pointer arithmetic survives. |
| `ovl_17:800B9C48` | L2200 | compile error | Unknown declaration becomes conflicting s32; byte-array field accesses remain invalid. |
| `ovl_11:800E4AEC` | L4644 | no changes; not compiled there | Invalid `void *` member operation untouched; frozen raw replay fails. |
| `ovl_31:800B8348` | L6431 | compiles, mismatch 21/28 | SDK pointers erased; warnings hidden; control-flow form still differs. |
| `ovl_11:800E78E4` | L6659 | written, compile error | Macro-backed global redeclaration and `&` of non-lvalue; inferred extra call argument. |
| `ovl_11:80106EB0` | L8213 | compiles, mismatch 25/28 | Wrong halfword-pointer stride, plus later preheader placement work. |
| `ovl_11:800E39B8` | L10234 | written; next residual compile fails | Double prototype replacement corrupts source; call arity and integer dereference remain. |
| `ovl_11:800C141C` | L10363 | compile error | Invalid global fields; duplicate default extern; table-byte scale becomes pointer-element scale. |
| `ovl_11:800FA31C` | L10545 | compile error | New u32/s32 conflict; unknown record pointer becomes scalar pointer. |
| `ovl_25:800B8CEC` | L10645 | compile error | Both object bases still have invalid fields; duplicate default extern. |
| `ovl_11:800DF6A8` | L10714, L10720 | report-only, then written/compile error | Type out of scope and incomplete; far-global fields unresolved. |
| `ovl_11:800C838C` | L11154 | report-only | Void-pointer fields; partial marker replacement reproduced; supplied prototype not integrated. |
| `ovl_15:80135AE0` | L11366 | compile error | New u32/s32 conflict, invalid buffer fields, address scaling. |
| `ovl_11:800CFA48` | L11996 | compile error | Global array used as struct despite type-marker repair. |

## 6. The other 13 raw drafts

| Target | Raw read call | Finding / later evidence |
|---|---:|---|
| `ovl_17:800B9158` | L1221 | Unknown work-area type with indexed field stores. Later near-match/compiler-flag dispute is separate; no model-facing finalize in this episode. |
| `ovl_21:800B8654` | L2661 | Scalar global guess conflicts with array context; agent restores declarations/widths and indexes `[0]`; first rewrite matches. |
| `ovl_11:800F4240` | L2795 | `void *` field accesses; agent supplies view and adjusts return/intermediate/control forms. |
| `ovl_11:800BD538` | L3142 | Unedited raw draft matches and finalizes. |
| `ovl_11:800F40A4` | L5062 | Missing named type; mismatched cursor widths/strides. Agent's first rewrite also mistakenly passes a table-slot address instead of its loaded pointer; second fixes that. Do not charge that new dereference error to m2c. |
| `ovl_21:800BA7F0` | L7480 | Unknown global view, word-pointer byte stride, awkward lowered short-counter representation; substantial later source-form work. |
| `ovl_11:800FB218` | L8108 | Missing/placeholder type, aggregate-vs-scalar use, dropped ABI slot. Raw irregular-switch form ultimately retained. |
| `ovl_11:800E2A30` | L8502 | Unknown global, integer dereference, byte-offset scaling, false fourth call argument. |
| `ovl_11:800DA49C` | L8684 | `void *` member accesses; witnessed field view and appropriate declarations yield a first-rewrite match. |
| `ovl_11:800E2BE8` | L8724 | `void *` member access plus false fourth argument from context; first rewrite matches. |
| `ovl_11:800F12D0` | L10449 | Void-return context hides a pointer result; unset-v0 marker and invalid member accesses. |
| `ovl_11:800F0FB0` | L11292 | Unedited raw draft matches and finalizes. |
| `ovl_21:800B9844` | L12054 | Unknown global, invalid fields and raw byte stride on a word pointer; later nested-loop/counter-form work. |

## 7. Handoff failures amplified the source failures

1. **Compiled scratch output was not necessarily the live candidate.**
   `compile: true` does not imply `write: true`. Both compiling repairs
   (`800B8348`, `80106EB0`) were scratch-only. The very next residual call
   compiled the unchanged raw source and failed on `?` (L6432, L8214).
   This is not repair success followed by compiler instability: two different
   source files were measured.
2. **Reports did not print the actual usable candidate or its path consistently.**
   The agent still needed another read or a manual rewrite. `800C838C`'s
   post-repair read was simply the unchanged raw file.
3. **`--write` happens before compile.** `800E78E4` and `800DF6A8` left failing
   repaired sources live. `800E39B8` wrote corrupted syntax with no compile
   requested. A preparation stage should keep these outcomes outside `src/`.
4. **Diagnostics are truncated too early.** `compileAndCompareRepaired` slices
   the error string to 500 characters, including long absolute paths. Several
   reports stop mid-path after the first error. Successful compiler warnings
   are discarded entirely. The preserved `.i` replays show substantially more
   actionable information.
5. **Default substitutions are honestly labelled, but easy to overread.**
   Reports do say a substitution was a default. Yet "witnessed access width"
   is a fact about one cell, not a complete object type; "declared SDK
   signature" overstates an arity-only result; "no changes needed" overstates
   a pass that does not handle the remaining invalid uses.

## 8. What to prioritize next

This evidence supports the plan's static-first direction, but identifies a more
specific order of work:

1. **Fix deterministic integration bugs first:** overlay-header path,
   malformed-extern handling/pass ordering, complete marker replacement,
   duplicate edit-range rejection and post-transform parsing. These are not
   hard reconstruction problems.
2. **Unify the context contract:** preserve actual SDK parameter and return
   types; supply types referenced by signatures; carry partial/placeholder
   status; reconcile compiler-visible globals and m2c's storage views. Do not
   treat any single array/struct view as the full object's proved layout.
3. **Validate emission at the use sites:** every load/store width, byte-address
   equation, pointer stride, call result and incoming ABI slot. A declaration
   that makes the file compile can still make it compute the wrong thing.
4. **Handle contradicted signatures before emission where possible:** give m2c
   the coherent call-site evidence rather than asking repair to undo false
   unset-register expressions later. Preserve unresolved conflicts explicitly;
   a matched callee's bytes do not always uniquely identify its signature.
5. **Produce one immutable, measured draft artifact:** exact source path/hash,
   full diagnostics including warnings, staged residual if compilable, and
   explicit defaults. The agent should never have to guess which of raw,
   repaired scratch and live source was actually measured.
6. **Only then measure the remaining general decompiler gap:** loop lowering,
   shared tails, narrowed temporaries, switch forms and expression structure.
   The irregular-switch example warns against an automatic "simplify all
   gotos/switches" cleanup rule.

A useful regression set is already present: all 27 historical raw drafts, the
14 frozen compiler contexts, all 11 frozen repaired compiler inputs, and the
specific pass-level failures above. Keep those failures in the denominator and
separate historical replay from improved-context experiments. Nothing in this
analysis estimates a guaranteed end-to-end speedup or proves that context fixes
alone would make these functions byte-exact.
