# ovl_11_func_800D1CFC — parked by user request

Updated: 2026-10-08. **Not matched; not an impossibility claim or a request for an assembly/register-pin exception.** Work stopped at the user's request. The original `INCLUDE_ASM` remains the build implementation; the compiling C attempt is preserved verbatim under `#if 0` in `src/overlays/ovl_11/ovl_11_func_800D1CFC.c`.

## Current recovery

Target: 0x800D1CFC–0x800D1E1C, 0x120 bytes (72 words). The frame-map/triage reports a 0x30 frame. Suspected TU membership is already recorded in `notes/file-groupings.md`, the D_80123754 setter/getter run; no new grouping conclusion was established here.

The function reads four s32 object fields:

- A at +0x38, B at +0x58, C at +0x40, D at +0x60.
- dx = abs(B - A), dy = abs(D - C).
- rank1 = nested comparator(A, B).
- rank2 = 0; if dy * 3 >= dx, rank2 = comparator(C, D).
- If dx and dy are both below the signed-halfword threshold D_80123754, and either is below 50, clear object flags at +0x34 with `&= ~0x2000` and return 0.
- Otherwise return the unsigned halfword at D_80123A18[rank1 * 3 + rank2]. The byte offset is twice that element index, **not** an additional factor of two in a u16 subscript.

The second incoming argument is unused by the target; its exact source type is not established by that fact. The current parameter views are inherited reconstruction types, not newly proven original signatures.

### Settled nested-function relationship

The comparator `ovl_11_func_800D1CD0` returns 0 for equal, 1 for less, 2 for greater. It is already matched and uses `CAPTURE_PREV_RET` in `common.h`. Its incoming v0 spill is the nested-function static chain, not a third scalar argument or an application-level buffer. Both parent calls establish v0 = sp + 0x10. Census and callee-truth corroborate the pair.

With user authorization this session added the caller declaration idiom:

```c
DECLARE_NESTED_FUNCTION(s32, ovl_11_func_800D1CD0, (s32, s32));
```

It expands to a block-local `auto` declaration with an assembler symbol label, and calls use `nested_ovl_11_func_800D1CD0`. It contains no assembly instructions and lets GCC emit the static chain. Omit argument *names* in the macro's type list: named declarations inside the macro invocation caused the raw AST parser to reject otherwise compiling C. The unnamed type list parses and compiles. Formal exception tracking and agent usage rules were explicitly deferred by the user; do not infer a general permission for arbitrary asm/pins from this macro.

## Major unlock — do not regress to handwritten abs branches

The old C reproduced abs using explicit `if (difference < 0)` branches. Hundreds of spelling/allocation experiments were taken under that representation. Replacing these with:

```c
var_s1 = __builtin_abs(temp_a2 - temp_v1);
temp_a2_2 = __builtin_abs(temp_s3 - temp_s2);
```

restored the target prologue, hard-register choices, retained argument copies, both absolute-value sequences, calls and subsequent guards. GCC's native abs machine template emits the branch/copy/negate packet; ordinary C branches did not preserve that operation boundary.

The current valid residual is **[cfg 0, population 0, schedule 1, allocation 0]**. Do not restart entry-block allocator searches or the old cand27/cand34 spelling domains. Their premises predate the abs correction.

## Exact remaining mismatch

The lookup tail wants the table address's low-half instruction *after* four arithmetic instructions:

```asm
/* Original */
lui   v1,%hi(D_80123A18)
sll   v0,s5,1
addu  v0,v0,s5
addu  v0,v0,a0
sll   v0,v0,1
addiu v1,v1,%lo(D_80123A18)
addu  v0,v0,v1
lhu   a0,0(v0)
```

The candidate completes the base first:

```asm
lui   v1,%hi(D_80123A18)
addiu v1,v1,%lo(D_80123A18)
/* the same four index instructions follow */
addu  v0,v0,v1
lhu   a0,0(v0)
```

The parked primary's two-dimensional table spelling also reverses the operands of the middle commutative addition (`addu v0,a0,v0`). A scalar spelling removes that operand difference without changing the scheduling residual:

```c
var_a0 = D_80123A18[(u32)(temp_s5 * 3 + var_a0_2)];
```

That complete candidate is `build/drive_d1cfc/unsignedsum.c`. It is semantically valid and has the same staged key as the primary, but no reversed addition. `runningoffset.c`, `fixed9.c`, `unsignedindex.c`, and several other sources compile to the same output; do not treat them as separate successful interventions.

### Why 71/71 is not a match

Those counts are **aligned instruction matches**, not equality at each address. The moved addiu is counted as the same instruction while a separate scheduling term records its displacement. The comparable stream excludes an inserted nop; the target function has 72 words. The transposition changes the instructions at 0x800D1DD8, 0x800D1DDC, 0x800D1DE0, 0x800D1DE4 and 0x800D1DE8 even when every aligned instruction has identical operands.

The exact diff verdict remains `MISMATCH`. Some printed difference counts also describe aligned operand differences, not the number of changed positions. Never promote from 71/71, or from a restored assembly stub's passing build.

## Evidence and closed directions

Scratch artifacts are preserved, not committed. Durable measurements and source snapshots are in `build/experimentLedger/ovl_11_func_800D1CFC.jsonl` and its `sources/` directory. Read the ledger's conditional closures before experimenting.

- Primary snapshot: `build/drive_d1cfc/parked_primary.c`; source hash 70dad61d28422215fd03fdab0d4ad07cd6208aabbb49fc2d009e4f9a2a80378f; compiled-output hash 5597eac69a9ddef15d077de46c6d390289a2bf5555b269c91a98b3784f4b991a.
- Cleaner scalar-tail class: `unsignedsum.c`; output hash a27c27a5c50aa23da2f4b02103e39376764adb14b4587425294de31707aef4f7; residual [0,0,1,0].
- Correct byte-offset/element variants, pointer bindings, running offset, unsigned index casts, u16 versus s32 parent return, and rank/result reuse have not removed the low-half displacement. Many are identical compiled experiments.
- Declaration audit: complete 18-byte u16[9], extern versus tentative ownership, const versus mutable, and a copied two-byte aggregate entry all compile to the same scalar-tail class. At -G0 the high and low halves already are separate RTL instructions. A conditional closure was recorded for this origin/representation; **nonzero-field/container origins remain outside it**.
- Current flag matrix: baseline 67/72 masked; disabling scheduling is much worse, -mno-split-addresses is worse, and gcse/cse-follow-jumps/cse-skip-blocks/rerun-cse columns tie baseline. No dominant flag supports an override. Triage's threshold-load self-clobber warning is not sufficient evidence to override this measured matrix.
- Current residual-source grammar priced 48 candidates, sampling all 48 coordinates but not completing the full search confirmation route. Only load-order and guard-order regions vary; the lookup expression is not an effective axis. Artifact: `build/residualSourceSearch/ovl_11_func_800D1CFC/bb6f1c24c800af21`. Do not claim a general C impossibility from this grammar.
- `psx_reverse_pipeline` identifies the low-half transposition but fails its round-trip on the native abs template. Its allocation-owner headline contradicts the detailed schedule-only residual; do not use it to reopen allocation work. Read the actual dumps.
- In the builtin-abs candidate the lookup is compiler basic block **7**, not target machine block 12. A scheduler trace requested for compiler block 9 printed nothing. `psx_search_scheduler_state` for .sched block 7 failed to derive a unique target-order assertion; this is **not UNSAT**. Older target-schedule artifacts also predate the abs change.
- The instrumented allocation oracle did not reproduce production output. No allocation-solver impossibility was established. It is irrelevant to the present allocation-zero residual anyway.
- Never use old `duplicated2.c` (extra u16 scaling) or `x5.c` (passes differences instead of A/B) as bases: they are semantically wrong despite attractive scores.

## Applying the historical precedents

1. `notes/research/func_80022F1C-shift-fusion-and-address-legitimization.md`, especially §§4.1–4.3: binding a base before the access and separating the appropriate address subexpression placed an early high half and a late low half. Its actual late placement filled a **load-delay slot**; the present gap is arithmetic, so the causal mechanism must be checked rather than copied blindly. A base-before-index spelling here has already been measured and does not suffice by itself.
2. `notes/research/func_8001A808-D80049084-address-split.md`: declaration size, not scheduler spelling, unlocked split addressing. The analogous size/ownership/const checks here are now closed under the stated -G0 origin; split addressing is already present.
3. `notes/retros/2026-08-07-func_800140C8-retro.md`: an opaque aggregate-copy operation emitted its low half late; scalar reconstructions had hidden that operation boundary. A two-byte aggregate-entry copy here optimized to the same scalar output, so that particular reconstruction did not unlock it.

### Latest origin experiment — preserve as a branch

The original data listing `build/ovl_11/asm/data/69960.data.s` contains identical nine-entry rank tables at D_80123A00 and D_80123A18:

`0, 5, 7, 6, 1, 2, 8, 4, 3`.

A zero word at D_80123A14 immediately precedes the second table. This does **not** prove they were one original C object. To test the nonzero-field address-tree mechanism, `build/drive_d1cfc/container14.c` views that word plus the table as a container with `u16 entries[9]` at +4. Its residual trades to **[0,4,0,1]** (69/71 aligned): GCC folds the field displacement into the memory address rather than reproducing the target's fully materialized base. It is not an improvement or promotion candidate. No live global type was changed for this hypothesis.

## Next bounded work

1. Start from the preserved builtin-abs source, preferably the scalar-tail `unsignedsum.c` to eliminate the known operand-order noise. Compile it with production -da; inspect lookup compiler block 7 in `.rtl`, `.combine`, `.sched`, `.lreg` and `.sched2`. Record exactly where high/low were born, their dependencies, set counts and the ready-list tie which keeps low before the arithmetic. Earlier report block numbers/UIDs are not transferable.
2. The immediate **unmeasured** experiment is to bind the complete nonzero field address in `container14.c` to a `u16 *` local before the indexed dereference, instead of directly loading `container.entries[index]`. This tests whether the same memory relation can materialize the +4 in the full pointer rather than the load offset. Measure once; inspect emitted relocation addends and offsets, not just score. A result using D_80123A14 must resolve to the same original address before it is comparable. Do not turn this provisional container into a published global type on score alone.
3. If that origin branch is inert or worse, close it conditionally and switch to an independently evidenced address/operation origin, or derive an explicit LUID/dependency requirement from the production tail dumps. Do not continue permutations which compile to the existing a27c27a5 class. A solver unable to align the native abs packet is not evidence that the tail is unreachable.
4. Only after a scratch candidate is byte-exact: reconcile shared types/global declarations, remove disabled/stub scaffolding, publish the signature with the generator, and run `psx_finalize_function`. Do not add asm instructions, register pins, empty barriers, or flag overrides to force this ordinary scheduling residual.

## Workspace and parking

`include/common.h` retains the user-authorized caller macro. The D_80123754/D_80123A18 overrides were already dirty when this assistant took over and were preserved. No compiler/diagnostic tooling or flag configuration was changed by this assistant. The concurrent `.pi/autoloop.json` checkpoint limit edit was observed and left untouched. No commit was made.

Full parking verification is reported separately by the final `make check` run; it verifies the restored assembly-backed build, **not completion of the disabled C draft**.
