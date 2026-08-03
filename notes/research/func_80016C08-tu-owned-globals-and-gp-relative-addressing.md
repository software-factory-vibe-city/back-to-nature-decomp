# func_80016C08: TU-owned globals, gp-relative addressing, and the ASPSX `.comm` rule

**Date:** 2026-08-03 (sections 1-10), extended same day (sections 11-16)
**Status:** `src/func_80016C08.c` is **reverted to `INCLUDE_ASM`**. The clean
C89 reconstruction reached **353/357 by index, 355/357 LCS-aligned**, and is
preserved verbatim under `#if 0` in that file. `make check` passes with the
function on assembly.

**Read sections 11-16 first.** They supersede the conclusions of sections 7
and 8. Sections 1-6 remain correct and are the reusable part of this note
(the ASPSX gp-relative rule and the link-map methodology).

The one remaining defect is the loop-tail materialization of `D_8005E3C0`:
the target uses one register for both halves (`lui $v1` then
`lw $v1,%lo(...)($v1)`) after two stores; our build uses two registers and
sched2 then advances the `lui`. Section 12 gives the exact allocator-level
cause; section 11 lists nine hypotheses falsified by measurement.

The larger result is institutional: this note establishes **when ASPSX emits
gp-relative addressing**, measured against the period assembler, and the
consequence that a gp-relative access in the original binary proves the
accessing translation unit *declared* that global. That fixed a build
configuration gap and closed an 8-byte layout drift affecting the entire image.

---

## 1. The function

`func_80016C08` is the sprite entry loop driver in the sprite-renderer family
(`notes/file-groupings.md`, 0x80015E3C–0x80016B7C). It walks the entry list of
one animation frame and emits a `POLY_FT4` per entry, accumulating texture
upload sizes through two `func_80016B7C` calls, and prepends each primitive to
an ordering table. Its sole known caller is `func_80015DD4`; its only direct
callee is `func_80016B7C`. The target has 11 parameters, frame 0x88, and 357
instructions. `scanReadBeforeDef` reports no undefined local reads, and the
function is classified as ordinary compiled C rather than an assembly or
compiler-override exception.

Starting state was a raw m2c transcription at **54.9%**.

---

## 2. Reconstruction: 54.9% → 94.1%

Everything in this section was driven by `triage.ts` (inventory + sdk-idiom)
and `explainDiff.ts`, in that order. Each fix was a **semantic** defect —
inventory differences are invariant to scheduling and allocation, so they must
go first.

### 2.1 The primitive is a real POLY_FT4 built with PSY-Q macros

The m2c source had a hand-rolled `OutputPoly` struct and open-coded bitfield
arithmetic. `triage.ts` named the primitive; the fix was to use the SDK:

```c
setPolyFT4(poly);
setSemiTrans(poly, (ent->unk8 >> 4) & 1);
setRGB0(poly, 0x80, 0x80, 0x80);
setShadeTex(poly, 0);
setClut(poly, tex->unk0, tex->unk2);
setTPage(poly, tp, 0, tx, ty);
setUV4(...);  setXY4(...);
```

Two macro expansions are worth recording because they are not obvious from the
assembly:

- **`setSemiTrans` collapses to two `li`s.** It is
  `(abe) ? setcode(p, getcode(p)|2) : setcode(p, getcode(p)&~2)`. CSE knows
  `code == 0x2c` from `setPolyFT4`, so both arms fold to constants and
  cross-jumping merges the store — `li 0x2e` / `li 0x2c` / one `sb`. This is
  why the target has `0x2C` twice and only one `lbu` at offset 7.
- **`setShadeTex(p, 0)`** is the source of the lone `andi 0xFE` and the
  read-modify-write at offset 7. The value is no longer CSE-known because it
  merged from two branches.

Hand-rolling either of these produces the right *values* and the wrong
*instruction multiset*. `inventory` catches it immediately.

### 2.2 Structural fixes

| symptom | cause | fix |
|---|---|---|
| `sll 1` short by one | m2c wrote `clutList[nclut * 2]` into an `s16` array, double-scaling | `clutList[nclut]` |
| entry stride | struct was 10 bytes, target steps 12 | 12-byte `SpriteEntry` with tail pad |
| `lhu` where target has `lh` | field reads narrowed independently per use | hold `tex->unk4`/`unk6` in `s16` locals so one load feeds several masks |
| extra `lbu` at 0x8 | `tp` and `rot` read `ent->unk8` across a store | compute both adjacently so CSE unifies |
| `getTPage` shape | `(y & 0x100) >> 4` emits `sll 16 / sra 20` | comes from the C front end shortening `y & 0x100` to `short`; use the macro with `short` operands |

### 2.3 Association and web shape

Three fixes came from reading operand association rather than values:

- `tex = &((SpriteTex *) texBase)[ent->unk9 - 0x80]` — the indexed form lets
  combine distribute `(x-0x80)*8` into `x*8 - 0x400`. The pointer-arithmetic
  form `(SpriteTex *)texBase + ent->unk9 - 0x80` produces
  `(base + x*8) - 0x400` instead. Distribution requires the `minus` to be
  single-use, so `key = ent->unk9 - 0x80` must be a *separate* statement and
  the `clutList[nclut++] = ent->unk9 - 0x80;` store must re-write the
  expression rather than reuse `key`.
- `ent` is an accumulator: `ent = base; ... ent += count - 1;` reproduces
  `addu s2,a0,a1` / `addu s2,s2,v0`. Writing it as one expression puts the
  partial sum in the wrong register.
- `u + (w - 1)` needs the explicit parentheses. `u + w - 1` parses as
  `(u+w)-1` and emits `addu` then `addiu`; the target has `addiu` then `addu`.

### 2.4 Things that are *not* levers here

Swapping commutative source operands changed nothing (canonicalised).
Declaration order, a named `-1` constant, and reusing `j` as the fill counter
were all neutral. Per the style guide, once source-order swaps are inert the
canonicalising pass must be identified rather than permuted around.

---

## 3. The gp-relative rule (measured against period ASPSX 2.77)

The reconstructed source stalled 2 instructions short of the target. Both
missing instructions were load-delay `nop`s before a gp-relative store to
`D_8005E438`.

`psyq4.3` (= ASPSX 2.77, the configured version) was fetched from the
mkst/esa release used by `tools/vendor/maspsx/aspsx/download.sh` and run under
wine. **ASPSX needs CRLF input and a short path.** Full matrix, both `-G`
settings, `$28` = `$gp`, `$1` = `$at`:

| declaration | `-G8` | `-G0` |
|---|---|---|
| `.comm sym,2` | **nop · `sh $4,0($gp)`** | `lui $at` · `sh $4,0($at)` |
| `.lcomm sym,2` | **nop · `sh $4,0($gp)`** | `lui $at` · `sh $4,0($at)` |
| `.sdata` definition | **nop · `sh $4,0($gp)`** | `lui $at` · `sh $4,0($at)` |
| `.extern sym,2` | `lui $at` · `sh $4,0($at)` | `lui $at` · `sh $4,0($at)` |
| `.globl sym` (no def) | `lui $at` · `sh $4,0($at)` | `lui $at` · `sh $4,0($at)` |
| undeclared | `lui $at` · `sh $4,0($at)` | `lui $at` · `sh $4,0($at)` |
| `.comm sym,12` (> `-G8`) | `lui $at` · `sh $4,0($at)` | `lui $at` · `sh $4,0($at)` |

**ASPSX emits gp-relative if and only if the symbol is declared in the file and
fits under `-G`.** Every form of external reference is absolute, under every
`-G`. The `nop` appears with the gp-relative form because that form is a single
instruction and does not cover the load delay; the `$at` form's `lui` does.

### Consequence

A gp-relative access in the original binary **proves the accessing translation
unit declared that global**. This is a TU-membership signal usable across the
whole binary, independent of any other evidence.

For this function: the target reaches `D_8005E438` gp-relatively, so the
original TU declared it. Our source declared it `extern` (via
`globals_override.h`), so cc1 emitted `.extern` and the nops never appeared.

---

## 4. Why this was *not* a maspsx bug (four wrong turns)

This took four withdrawn hypotheses. Recording them so they are not re-run:

1. **"The project's global model is broken; `.sbss` needs remodelling."**
   Wrong. See §5 — the misresolved symbol was this function's own doing.
2. **"Remove `--dont-force-G0`."** Wrong. That flag is load-bearing: it was
   introduced in `5b911e2` alongside `tools/build/classifyGlobals.ts`, whose
   header states the design — declarations are chosen so GCC picks the right
   addressing mode, keyed on distance from `$gp`. Without it, gas never emits
   gp-relative and the classifier goes inert.
3. **"Patch maspsx so small `.extern` symbols get the load-delay nop."**
   Wrong. The matrix above shows ASPSX never treats `.extern` as gp-relative,
   so the patch modelled behaviour that does not exist.
4. **"The `extern s32 D_80055994[3]` declarations are a model fabricating a
   type to force absolute addressing."** Wrong. `$gp` range is
   `0x80056284..0x80066264`; all three are outside it, so absolute is correct
   and the array sizing is `classifyGlobals`' documented mechanism.

There *is* a real latent inconsistency in maspsx: under `--dont-force-G0` it
leaves a small `.extern` store for gas (which emits gp-relative) while deciding
the load-delay nop as if an `$at` expansion would follow. It emits a
gp-relative store with no nop, matching neither ASPSX behaviour. It stops
mattering once the declaration is correct, and "fixing" it would encode
non-ASPSX behaviour — so it is documented, not patched.

---

## 5. Methodology: read the link map before blaming the project

The symptom that started hypothesis 1 was `D_8005E438` resolving to
`0x8005E430` — eight bytes low. It looked like a broken symbol model. It was
not:

```
last correctly placed function:  0x80016C08  func_80016C08   <- this one
first misplaced function:        0x80017194  func_8001719C   drift -8
drift histogram: {-8: 644}   (317 functions + 327 data symbols)
```

The linker script concatenates objects by size, so a function compiling N bytes
short shifts **everything after it**. Comparing the post-function region with an
8-byte offset collapsed the difference from 71.9% to 1.9%, proving every other
object was correctly sized.

**Rule:** before proposing any splat / linker-script / symbol-model change to
explain a misresolved symbol, parse `build/slus_011.map` and compare each
`D_`/`func_` symbol's address against the hex in its own name. A uniform
single-valued drift whose last correct symbol is the function under work means
the function is the cause. `diffFunc`'s percentage hides this completely, and
so does a bare `make check` hash.

---

## 6. The fix, and how it was verified

Two changes, no tool patch:

```c
u16 D_8005E438;    /* src/func_80016C08.c — tentative definition */
```
```make
MASPSX_FLAGS := --aspsx-version 2.77 --dont-force-G0 --use-comm-section --run-assembler
```

`--use-comm-section` is an existing maspsx flag. Without it, maspsx converts the
`.comm` into a *private* `.sbss` allocation — the symbol comes out `LOCAL` with
`R_MIPS_GPREL16` against the `.sbss` **section**, and the link fails because the
script discards it. With it, maspsx emits a real `.comm`: the symbol is
`OBJECT GLOBAL COM`, `.sbss` is size 0, relocations bind to the **symbol**, and
ld resolves it against the extracted `.sdata` definition at `0x8005E438`.

The same flag was added to `diffFunc.ts`, `flagProbe.ts` and
`decompToolchain.ts` so the per-function oracle matches the real build.

**Regression evidence.** The flag is inert on the existing tree — *zero* `.comm`
symbols across all 466 compiled sources, so it has nothing to act on but the new
definition. Verified by stubbing this function to `INCLUDE_ASM` (so it could not
poison the signal) and rebuilding all C objects both ways: `make check`
byte-identical with and without the flag.

At that checkpoint: 345/357 under the original aligned metric,
`759 symbols, 0 misplaced`, payload 35 bytes out. The later clean-C resume in
§7 improved the function again without changing this linker result.

---

## 7. Resume: 341 indexed → 353 indexed

The resumed baseline was 341/357 by strict index (the older 345 figure used an
aligned metric). `explainDiff` classified it as scheduling-and-operands: 357
instructions on both sides, exact opcode multiset, and exact web parity.
Three clean-C mechanisms closed every mismatch except the final HIGH reload.
The progress checkpoints are preserved rather than inferred from percentages:

| checkpoint | strict indexed score | source artifact | mechanism |
|---|---:|---|---|
| resume start | 341/357 | `build/func_80016C08.resume-start.c` | merged fill/main counter and old tail order |
| both recurrences in `for` update | 348/357 | `build/experiments/func_80016C08-tail-order-shapes/for_update_i_then_ent.c` | fixes tail recurrence/reload order |
| natural typed-pointer consolidation | 348/357 | `build/experiments/func_80016C08-natural-best/natural_best.c` | retains all established natural forms |
| single-set `last` born after pointer positioning | **353/357** | `build/experiments/func_80016C08-preheader-single-set-birth/start_after_pointer.c` | fixes the final preheader scheduling cluster |

The last checkpoint is the source currently promoted in
`src/func_80016C08.c`.

### 7.1 Separate counter webs and a single-set last index

The fill loop now has its own `fill` counter. The main-loop preheader uses a
single-set staging value before the mutable counter:

```c
ent += count - 1;
last = count - 1;
i = last;
```

The `last`→`i` copy coalesces to zero machine instructions. More importantly,
the surviving `addiu a3,v1,-1` has single-set birth priority in sched1, so the
legacy backward scheduler chooses it before the higher-priority address-chain
participant and emits the target forward order:

```
sll · addu · sll · addiu -12 · addiu a3,v1,-1
```

This requirement was reproduced by the target-order replay as one priority
relation. Directly assigning mutable `i = count - 1` leaves that SET at
priority 3 and emits it before the address chain.

### 7.2 Preserve the target's partial sums

Named `xbase` and `ybase` values preserve the target value provenance:

```c
xbase = ox + frame->unk2;
x0 = xbase + ent->unk4;
ybase = oy + frame->unk4;
y0 = ybase + ent->unk6;
```

This fixed both commutative `addu` operand orders. Merely swapping source
operands was inert because canonicalization had already discarded that order.

### 7.3 Put both recurrences in the `for` update

`for (; i >= 0; i--, ent--)` fixed the tail reload order while preserving the
same reverse traversal. Several equivalent `while`, guarded `do`, and
structured-break forms later canonicalized to the same final 353/357 stream;
backward-`goto` forms suppressed loop optimization but destroyed the otherwise
correct allocator state.

### 7.4 The sole remaining mismatch

```
target:    sw v1,0(s0)
           sw a0,0(a1)
           lui v1,%hi(D_8005E3C0)
           lw  v1,%lo(D_8005E3C0)(v1)

candidate: lui v0,%hi(D_8005E3C0)
           sw v1,0(s0)
           sw a0,0(a1)
           lw  v1,%lo(D_8005E3C0)(v0)
```

`explainDiff` classifies the function as **scheduling**, with 353/357 exact
indexed instructions, 355/357 LCS-aligned instructions, opcode LCS 356, and all
211 register webs matched. This is why the status can be described as both
"four indexed differences" and "the last two matches": the displaced `lui`
shifts the two stores at indices 334–336, producing four wrong indexed slots,
but after LCS alignment the stores match and only these two real operand
mismatches remain:

1. `lui v0` instead of `lui v1`;
2. `lw v1,...(v0)` instead of `lw v1,...(v1)`.

There is one value-provenance divergence: target instruction 337 reads its
address from target instruction 336's `$v1` HIGH, while candidate instruction
337 reads it from candidate instruction 334's `$v0` HIGH. Packet construction,
ordering-table linkage, loop state, global field update, opcodes, and web roles
otherwise agree.

#### Pass-by-pass provenance

The compiler dumps locate the mechanism precisely:

| pass | relevant state |
|---|---|
| `.rtl` | pseudo 431 holds `HIGH(D_8005E3C0)`; pseudo 432 loads the global pointer through a separate address pseudo |
| `.cse` | the low relocation is folded into pseudo 432's `mem(lo_sum(p431,...))`, but HIGH and load-result remain distinct pseudos |
| `.gcse` | **(corrected)** GCSE PRE — not loop-invariant motion — replaces the local HIGH with long-lived pseudo 453; dump evidence is insns 1244 and 1259 in `func_80016C08.i.gcse`, inserted alongside `poly+0x28`, `i-1`, `ent-12` and `flags & 0x18`. The original attribution to `.loop` in this table was wrong; see section 12 |
| `.sched` / `.lreg` | pseudo 453 still spans the loop and carries `REG_EQUIV HIGH(D_8005E3C0)`; pseudo 432 remains a short tail-local load result |
| `.greg` / reload | pseudo 453 receives no permanent hard register, so reload inserts UID 1378 as `lui $v0` in the desired position **after both stores**; pseudo 432 is locally allocated `$v1` |
| `.sched2` | because `$v0` is independent of both stores, UID 1378 is legally advanced above them; the final load remains `lw $v1,...($v0)` |

The decisive source-to-machine transition is therefore loop-invariant HIGH
lifetime → spill/reload scratch choice → post-allocation scheduling. It is not
the textual position of `D_8005E3C0->field_118 += 0x28`.

The target's `sw $v1` reads the packet tag before `lui $v1` overwrites that
register, creating a hard anti-dependency absent from the candidate. Reusing
`$v1` as both relocation base and load destination also gives the target the
self-clobbering recurrence that the candidate lacks. That hard-register hazard
prevents the target HIGH from floating above the packet-tag store and changes
the sched2 ready-list context.

The MIPS backend permits but does not require this overlap. GCC 2.95.2's
`movsi_internal2` gives the load destination a normal `=d` constraint; it does
not tie the destination to the register nested in the memory address. If the
address dies at the load, allocation may legally choose the same hard register,
but ordinary C has no syntax requiring that choice. The candidate's long-lived
spilled HIGH ensures reload instead chooses an independent `$v0` scratch.

**Biggest blocker:** find a natural source provenance that keeps the symbol
HIGH tail-local (or otherwise changes its conflict set) so it can share `$v1`
with pseudo 432, without changing any emitted operation or disturbing the
already-exact allocator state. Merely fixing schedule order would still leave
the two register operands wrong; merely naming or reusing a C variable does not
survive CSE/loop normalization.

### 7.5 Complete source-shape experiment inventory

Every promoted or rejected experiment remains under `build/`; no generated
candidate was copied to `src/` unless it improved the exact function score.
The final-tail studies were:

| mechanism family | named experiment directories | result |
|---|---|---|
| direct/global access and statement order | `func_80016C08-link-global-shapes`, `func_80016C08-global-container-shapes`, `func_80016C08-main-loop-control` | policy-safe forms normalize to 353/357 |
| loop-exit isolation / GCSE-PRE | `func_80016C08-gcse-isolation`, `func_80016C08-gcse-loop-exit-isolation` | duplicate occurrences still merge to the same hoisted HIGH |
| fresh versus reused state webs | `func_80016C08-tail-reused-webs`, `func_80016C08-tail-multiset-state` | RTL set counts change, final tail remains 353/357 |
| result/input and slot-address reuse | `func_80016C08-tail-result-input-reuse` | `u32`, `s32`, typed-pointer, assignment-expression, and slot-then-state forms all end at 353/357 |
| lexical scope / `register` hints | `func_80016C08-tail-register-scope` | local pseudo metadata changes, HIGH reload still uses `$v0`; 353/357 |
| reuse target `$v1` roles | `func_80016C08-tail-tag-state-recurrence` | packet tag, slot address, and state values split again before allocation; 353/357 |
| recurrence/control placement | `func_80016C08-tail-order-shapes`, `func_80016C08-main-loop-control` | several `for`, `while`, guarded-`do`, and body-tail forms canonicalize to 353/357 |
| volatile register webs | `func_80016C08-tail-volatile-register-web` | forces real live ranges and global allocation churn; approximately 293–294/357 |
| one-trip inner loops | `func_80016C08-tail-one-trip-inner-loop` | changes loop depth and allocation; approximately 322–329/357 |
| explicit backward gotos | `func_80016C08-main-goto-loop` | prevents useful loop recognition and collapses allocation parity; approximately 150–154/357 |

Additional negative findings:

- Direct access, a named state pointer, a named slot pointer, aggregate
  containers, pointer-to-pointer access, and a volatile view of the global
  container all leave HIGH invariant and movable.
- Multi-set source variables do change early pseudo set counts, but CSE/combine
  remove the copies before they can alter the final reload choice.
- Reusing the packet-tag temporary for the state address looks like the target
  `$v1` recurrence in C, but GCC splits the values into distinct pseudos and
  reallocates the same 353/357 stream.
- Narrow scopes and ordinary `register` hints can make the state result local
  `$v1`; they do not make the spilled HIGH use that same hard register.
- Volatile forms are not a zero-cost dependency. They preserve extra SETs,
  extend lifetimes, change loop allocation, and are both worse code and the
  wrong source model.
- One-trip loops and gotos can stop the unwanted motion, proving loop placement
  is causal, but the changed loop depth/recognition perturbs hundreds of
  allocation decisions. They are diagnostic interventions, not solutions.

### 7.6 Compiler, flag, and backend findings

`flagProbe` plus manual pass-isolation runs tested the configured GCC 2.95.2
baseline against `-fno-gcse`, `-fno-move-all-movables`,
`-fno-rerun-loop-opt`, and `-fno-strength-reduce`, as well as the available
alternate project compiler versions.

- The configured GCC 2.95.2 baseline is best overall.
- `-fno-strength-reduce` is the strongest diagnostic: it can leave the HIGH
  after the stores, confirming loop optimization is upstream of the mismatch,
  but uses the wrong base register (observed `$a0`) and degrades other regions.
- The other loop/GCSE flag deltas do not create the target self-clobber and
  introduce broader ordering/allocation regressions.
- Alternate compiler versions do not preserve the 353 exact instructions while
  fixing the tail.
- Disabling sched2 would address placement only, not `$v0` versus `$v1`; it is
  therefore not even a complete mechanism for the last two operand matches.

No flag combination supplies an isolated, evidence-backed fix, and a per-file
flag override would violate the clean-source goal even if it did.

Inspection of GCC's loop pass and MIPS `movsi_internal2` constraints confirms
that this is normal compiler behavior: invariant address pieces are movable,
and the move pattern leaves address-base/result overlap to allocation rather
than expressing it as a required matching constraint.

### 7.7 Automated synthesis and corpus evidence

The conservative source-shape synthesizer reported:

```
func_80016C08: no-safe-recipe-for-requirement
Generated alternatives: 0
Requirements with source-role coverage: 0/240
```

Artifacts are in
`build/sourceShapeSynthesis/func_80016C08/3f0ebe67745e93c1`. Its current grammar
models safe top-level birth/order and typed-copy recipes, not arbitrary loop-tail
lifetime transformations. This is evidence that the existing safe recipe set
has no answer, **not** proof that matching clean C is impossible.

A target-assembly scan found 90 adjacent same-register `lui`/`lw` global-load
examples. No already-matched **clean-C** sibling provided a transferable source
shape; `func_80016C08` was the only already-decompiled example in the scanned
nonmatching corpus. The narrower project's self-clobber fingerprint also
identifies the existing
hard cases (`SetGfxClip`, `SetGfxOffset`, and `func_8001205C`), but those files
currently rely on register pins, scheduling overrides, or assembly. They
confirm that this machine pattern is a hard allocation/scheduling class, not a
policy-valid template for this function.

Compiler tracing found no broader target-register recurrence hint beyond the
observed final `$v1` self-clobber. Because target RTL is unavailable, exact
source provenance cannot be recovered from the final hard register names alone.

### 7.8 Policy and source status

No inline assembly, hard-register pinning, artificial volatile barrier,
undefined aliasing trick, per-file flag, or compiler-version override was
introduced. The direct clean semantics remain:

```c
poly->tag = (*ot & 0xFFFFFF) | 0x09000000;
*ot = (s32) poly & 0xFFFFFF;
total += size;
poly++;
D_8005E3C0->field_118 += 0x28;
```

The temporary macro alias used only to let the variant harness accept the
TU-owned `D_8005E438` definition was removed; the source again contains the
direct tentative definition documented in §6. Typed `ent--` traversal is
retained rather than byte-offset pointer arithmetic.

---

## 8. Remaining work and exact acceptance criteria (SUPERSEDED by section 12)

The next useful hypothesis must alter **lifetime/provenance**, not just source
statement order. A successful pass trace should satisfy all of the following:

1. CSE still emits one global-pointer load and one field load/store sequence;
   no extra address arithmetic or memory operation may survive.
2. Loop optimization must not leave `HIGH(D_8005E3C0)` as the same long-lived,
   unallocated pseudo 453, or its replacement must have a conflict/lifetime
   shape that does not require an independent `$v0` reload.
3. After reload, the relocation HIGH and the global-pointer load result must
   both use `$v1`, with the HIGH still after the two link stores.
4. Sched2 must then retain the target order without a barrier or disabled pass.
5. The candidate must preserve exact indexed ranges 0:333 and 338:356, all 211
   machine register webs, 357 instructions, and the current semantics.

Plausible remaining research is limited to a natural source construct that
changes where the address is born relative to loop recognition, or an
otherwise-unused surrounding source provenance that changes the loop pseudo's
conflict set while optimizing to zero instructions. The experiment families in
§7.5 should not be repeated without a new pass-level prediction.

Treat the assembler-boundary/self-clobber fingerprint as diagnostic only. The
configured compiler and flags remain the project source of truth; do not
promote a compiler, flag, assembly, hard-register, or volatile-barrier exception
to solve this one site. Finite source-shape exhaustion is not proof that no
matching clean C exists, but there is currently no evidence-backed clean-C
mechanism beyond the 353/357 source.

`triage.ts` still reports target-only `0x09000000`; the source visibly contains
that literal and opcode parity is exact. This is a `lui`/constant-folding
inventory limitation, not a semantic defect. Target-schedule reconstruction is
also diagnostic: there is no target RTL dump, and the traced cc1 stream has
347 machine instructions before ASPSX/assembler expansion and delay handling
produce the 357-instruction final object. Final object comparison remains the
oracle.

---

## 9. Reusable levers

- `inventory` clean is a **precondition** for allocation work, not a nicety.
- A gp-relative access proves TU ownership of the symbol (§3).
- Read the link map before blaming project configuration (§5).
- Distinct hard registers for the same source variable across two loops means
  the original had two variables — GCC 2.95 cannot split live ranges (§7.1).
- Allocation priority ≈ `floor_log2(refs) / live_length`; to change *which* of
  two pseudos wins a register, change one of those two quantities.
- A single-set staging value copied into a mutable loop counter can coalesce to
  zero instructions while retaining the sched1 birth priority of the staging
  SET; this is a real source lever, not cosmetic naming.
- Named partial sums can preserve value provenance and commutative operand
  order even when swapping operands in one expression is canonicalized away.
- Moving multiple recurrences into a `for` update can alter reload/lifetime
  ordering while preserving a natural structured loop.
- Two LCS-aligned operand mismatches can appear as four indexed differences
  when one independent instruction moves across two otherwise-matching stores.
- Inspect `.greg` before blaming source order for a sched2 move. Here reload
  inserts HIGH in the desired position, but its `$v0` assignment removes the
  hard dependency that would have kept it there.
- Same-register `lui`/`lw` is an allocation outcome, not an instruction-selection
  requirement: `movsi_internal2` permits result/input overlap but does not tie
  the operands.
- A source `register` hint does not request a particular hard register, and
  volatile is not a zero-width allocation hint.
- Automated "no safe recipe" means only that the modeled finite grammar is
  exhausted; it does not establish clean-C impossibility.
- ASPSX runs under wine but needs **CRLF line endings and a short path**;
  `tools/vendor/maspsx/aspsx/util.py` parses the resulting PSY-Q `.obj`.
- An apparent impossibility is an audit trigger, not a conclusion. Enumerate
  the assumptions and falsify them one at a time with builds (section 11).
- The shipped `CC1PSX.EXE` is runnable (section 13) and is the definitive
  answer to "is our rebuilt cc1 faithful?". Use it before blaming the
  toolchain. It is faithful.
- A same-register `lui`/`lw` inside a loop is an **allocator** condition, not
  a scheduling flag. `HIGH(sym)` has no register operands, so GCSE PRE always
  hoists it out of a loop where the access is unconditional; once hoisted it
  is a reload rematerialization and reload never picks the load's destination
  register (section 12).
- Local-alloc priority is
  `floor_log2(refs) * refs * size / (death - birth)`. To change *which* of two
  quantities is allocated first, change one of those quantities.
- Removing an RTL insn from a function (via asm or a flag) can rotate the
  spill-frame slot assignment. Check stack displacements, not just opcodes,
  before calling such a change an improvement (section 15).
- Before proposing a per-file flag, look for a counter-witness in the same
  file group. `func_80016054` falsified `-mno-split-addresses` for this TU in
  one grep (section 11, row 7).

---

## 10. Reproduction artifacts and verification snapshot

Primary evidence:

| purpose | artifact |
|---|---|
| saved resume baseline | `build/func_80016C08.resume-start.c` |
| current compiler pass trace and typed report | `build/compilerTrace/func_80016C08/` and `report.json` |
| structural/classification report | `build/explainDiff/func_80016C08/` |
| target-order/scheduler diagnostics | `build/targetSchedule/func_80016C08/` |
| best 348/357 natural candidate | `build/experiments/func_80016C08-natural-best/natural_best.c` |
| 353/357 preheader mechanism | `build/experiments/func_80016C08-preheader-single-set-birth/start_after_pointer.c` |
| bounded tail experiments | the named `build/experiments/func_80016C08-*` directories in §7.5 |
| conservative synthesis result | `build/sourceShapeSynthesis/func_80016C08/3f0ebe67745e93c1/` |

Final checks on the promoted source:

- `scanReadBeforeDef.ts func_80016C08`: **0 findings**.
- `diffFunc`: 357 target and 357 candidate instructions; **355/357 masked,
  LCS-aligned**.
- `explainDiff`: **353/357 exact by index**, classification `scheduling`, opcode
  LCS 356, **211/211 webs matched**.
- Full `make check`: expected failure because the function is not exact; direct
  payload comparison finds **11 differing bytes**, all at payload
  `0x7140..0x714E`, corresponding only to this function's four tail words.
- Symbol placement remains correct and function size is exact, so no later
  object or global is shifted.

This was the checkpoint as of section 7. Superseded by sections 11-16.

---

## 11. Assumption audit (measured, not argued)

Sections 7-8 concluded "no evidence-backed clean-C mechanism". That framing was
wrong: an apparent impossibility means an assumption is wrong. This section is
the audit. Every row was falsified by a build, not by reasoning.

| # | Assumption | How it was tested | Verdict |
|---|---|---|---|
| 1 | The C source is wrong | Ran the shipped Sony `CC1PSX.EXE` (PSY-Q 4.6) on `src/func_80016C08.c` with the project flags | **False.** It emits the same instruction stream as our `cc1`, `lui $v0` and all |
| 2 | Our `cc1` is an unfaithful rebuild | `CC1PSX.EXE` vs `build-gcc-2.95.2-psx/cc1`, same `.i`, same flags, minimal case and the real 357-instruction function | **False.** Instruction streams identical. Only divergence: CC1PSX emits `.comm`/`.extern` at the *top* of the file, ours at the bottom. No payload effect |
| 3 | The compiler version is wrong (2.8.x) | `notes/toolchain-version-detection.md` plus the CC1PSX run above | **False.** 2.95.2 confirmed. Also: 2.8.1 has no `gcse.c` at all, so it cannot be the compiler that produced the target's four PRE hoists |
| 4 | This TU used `-fno-schedule-insns2` | Full build | **False.** 366 instructions (target 357), 293 differing lines |
| 5 | This TU used `-fno-schedule-insns` | Full build | **False.** 365 instructions, 360 differing lines |
| 6 | This TU used `-fno-gcse` | `flagProbe` matrix | **False.** 21/357 |
| 7 | This TU used `-mno-split-addresses` | See section 14 | **False**, and this is the important one — see below |
| 8 | The tail statement order is wrong | 7 orderings and field-update spellings swept | **False.** None yields the one-register form. Two (`s3`, `s4`) moved the HIGH to `$v1` but displaced the pointer to `$a1`/`$a3` |
| 9 | A small amount of inline asm closes it | Versions A-G, section 15 | **False.** The tail becomes exact and 11 spill-slot displacements appear instead |

**Row 7 deserves emphasis because it was briefly recommended and is wrong.**
`-mno-split-addresses` reproduces the target's tail exactly — verified on both
our `cc1` and the genuine `CC1PSX.EXE` — because it removes the `HIGH` insn
entirely and lets the assembler expand `lw $v1,D_8005E3C0` using the
destination register as its own temporary. It is nevertheless falsified as a
model of the original build by `func_80016054`, which is in the same file
group:

```
lui    $v0, %hi(D_8006C84C)
lw     $v1, 0x64($sp)          <- five unrelated instructions
lbu    $t1, 0x58($sp)
lh     $t2, 0x5C($sp)
lh     $t3, 0x60($sp)
lhu    $t4, 0x6C($sp)
addiu  $v0, $v0, %lo(D_8006C84C)
```

Only the compiler can separate the two halves of an address; the assembler
emits macro halves together. So that file was compiled **with** split
addresses, and our build reproduces those instructions exactly. A per-file
override would model a build configuration that cannot have existed.

`-msplit-addresses` is period-correct in any case: PSY-Q's own
`gcc/config/mips/psx.h:24` sets `TARGET_DEFAULT (MASK_GAS+MASK_SOFT_FLOAT+
MASK_SPLIT_ADDR+MASK_GPOPT)`, and `tools/vendor/old-gcc/patches/psx.patch:28`
reproduces it.

---

## 12. The corrected mechanism, pass by pass

Three separate 2.95.2 behaviours compose. Only the third is the real defect.

**(a) GCSE PRE, not loop-invariant motion.** `func_80016C08.i.gcse` shows PRE
inserting `(set (reg 453) (high (symbol_ref "*D_8005E3C0")))` at insns 1244 and
1259, in the same insertion group as `poly+0x28`, `i-1`, `ent-12` and
`flags & 0x18`. `HIGH(sym)` has no register operands, so it is transparent in
every block and available on the loop back edge; it is therefore partially
redundant at the loop head and PRE hoists it unconditionally. **No source
spelling avoids this while the access is unconditional inside a loop.**

**The target carries the same four PRE hoists.** This was never recorded before
and it matters: it proves GCSE ran on the original with the same effect.
Evidence at the loop head (`0x80016D18`):

```
0x80016D30  addiu $a3,$a3,-0x1   ; i-1            -> sw 0x50($sp)
0x80016D50  andi  $a0,$s7,0x18   ; flags & 0x18   -> sw 0x58($sp)
0x80016D5C  addiu $v0,$s0,0x28   ; poly + 0x28    -> sw 0x54($sp)
0x80016D68  addiu $v1,$s2,-0xC   ; ent - 12       -> sw 0x4C($sp)
```

and the matching reloads at the loop tail. So the target has **four** of the
five expressions hoisted, and ours has five. The symbol HIGH is the only extra.

**(b) Reload rematerializes, and never picks the load's destination.** Because
pseudo 453 spans the loop and crosses two calls, it gets no hard register.
Reload rematerializes it from its `REG_EQUIV` at the point of use — `.greg`
insn 1378 places `lui $v0` **after both link stores, exactly where the target
has it**. The position was never the problem.

**(c) sched2 then advances it.** `$v0` is independent of both stores, so the
post-reload scheduler legally lifts the `lui` above them. With `$v1` there is
an anti-dependence against `sw $v1,0($s0)` and the move is illegal. So the
displaced position is a *consequence* of the register choice, not a second
defect. Fixing the register fixes the position for free.

### The exact allocator requirement

From `local-alloc.c` (2.95.2), quantities are allocated in priority order:

```
QTY_CMP_PRI(q) = floor_log2(qty_n_refs[q]) * qty_n_refs[q] * qty_size[q]
                 / (qty_death[q] - qty_birth[q])
```

and `find_free_reg` takes the first free register in `REG_ALLOC_ORDER`, where
`$v0` precedes `$v1`. Measured quantities in a build where the HIGH stays local
(`-fno-gcse`), from `f.i.lreg`:

| pseudo | role | refs | length | priority | got |
|---|---|---:|---:|---:|---|
| 431 | `HIGH(D_8005E3C0)` | 4 | 4 | 2.00 | `$v0` |
| 432 | the loaded pointer | 6 | 6 | 2.00 | `$v1` |
| 436 | `field_118` value | 4 | 6 | 1.33 | `$v0` |

Three conditions must hold simultaneously to reproduce the target:

1. the HIGH must stay **inside the loop** so local-alloc sees it at all;
2. the field-value quantity must be allocated **before** it, so `$v0` is taken;
3. the HIGH then finds `$v0` busy over its lifetime and takes `$v1`; the
   pointer, whose true lifetime does not overlap the HIGH's, takes `$v1` too.

Condition 2 requires the HIGH's priority to fall below 1.33 — i.e. its live
range must lengthen, since its reference count is fixed at two real references.

### The scheduling-aware tie suppression (real, but not the blocker)

2.95.2's `local-alloc.c` (lines ~1413-1478) inflates each quantity's lifetime
by ±2 before allocating, "to discourage the register allocator from creating
false dependencies", gated on `flag_schedule_insns_after_reload &&
!optimize_size && !SMALL_REGISTER_CLASSES` — all true here
(`SMALL_REGISTER_CLASSES` is `(TARGET_MIPS16)` = 0). **GCC 2.8.1 has none of
this code.** It is a preference with a fallback to the true lifetime, so it
does not forbid the one-register form outright. Disabling it
(`-fno-schedule-insns2`) does **not** fix this function, because the HIGH is a
reload rematerialization, not an allocated quantity. Do not pursue it.

---

## 13. Running the genuine Sony compiler (reproducible)

`tools/vendor/psyq_sdk/psyq/bin/CC1PSX.EXE` and `ASPSX.EXE` are PE32
(32-bit Windows) binaries. They run under wine, but need a **32-bit prefix**,
and wine refuses to create a prefix under a directory it does not own (bare
`/tmp` fails):

```
export WINEPREFIX=<a directory you own>/wp32 WINEARCH=win32 WINEDEBUG=-all
wineboot -i
wine CC1PSX.EXE -quiet -O2 -G8 -mips1 -mcpu=r3000 -funsigned-char -fpeephole \
      -ffunction-cse -fpcc-struct-return -fcommon -msoft-float -mgas \
      -fgnu-linker f.i -o f.s
```

Input still wants CRLF and a short path (section 3). This is the highest-value
oracle in the project: it answers "is our rebuild faithful?" directly. It is.

---

## 14. Binary-wide address-materialization statistics

Adjacent `lui %hi(S)` followed by a load through `%lo(S)`:

| corpus | destination == base (one register) | destination != base |
|---|---:|---:|
| original binary | **94** | 19 |
| our build (466 objects) | 6 | 2 |

All six in our build come from the three files that use `register __asm__` pins
or inline asm (`SetGfxClip`, `SetGfxOffset`, `func_8001205C`). **Clean C in this
project has never produced the one-register form.**

For address materialization (`lui %hi` then `addiu %lo`) the picture is
different and healthy — original 165 one-register / 76 two-register, ours 30 /
13. So the gap is specific to *loads through* a symbol, not to addressing in
general.

Exposure is small: only **40 of 466** compiled objects emit any `%hi` at all.

### Register usage is otherwise identical

Counting every hard register in the target versus our 355/357 candidate: `a0`
69/69, `a1` 40/40, `a2` 28/28, `a3` 31/31, `s0` 80/80, `s1` 11/11, `s2` 18/18,
`s3` 5/5, `s4` 7/7, `s5` 8/8, `s6` 13/13, `s7` 6/6, `s8` 7/7, `t0` 12/12,
`t1` 10/10, `sp` 63/63, `gp` 4/4, `ra` 3/3, `zero` 4/4 — and `v0` 154/156,
`v1` 110/108. The only difference in the whole function is ±2 on `v0`/`v1`:
the two operands in dispute. **There is no register-pressure difference for a
source change to exploit.**

---

## 15. The inline-asm hybrid: measured, and why it is not the answer

The project owner authorised a policy exception for a hybrid. Seven versions
were built. All keep the C and add asm at the loop tail.

| version | asm | wrong instructions (of 357) |
|---|---|---:|
| baseline (no asm) | none | **2** |
| A | 2 instructions, `lui`/`lw`, `$v1` pinned via a local register variable | 13 |
| B | A + `volatile` + `"memory"` clobber | 24 |
| C | A + one counter shared across both loops | 18 |
| D | A + different declaration order | 13 |
| F | A + function-scope pinned pointer | 13 |
| G | A + explicit `clutList` base pointer | 87 (and 360 instructions) |

Version A produces the target's tail exactly. It then exposes a **second**
defect: removing the address computation from the C changes reload's
stack-slot assignment order, and five spill slots rotate.

| value | target slot | version A slot |
|---|---:|---:|
| address of `clutList` | 72 | 88 |
| `ent - 12` | 76 | 72 |
| `i - 1` | 80 | 76 |
| `poly + 40` | 84 | 80 |
| `flags & 0x18` | 88 | 84 |

Eleven instructions carry those displacements, plus two ordering changes. The
identical rotation appears under `-mno-split-addresses`, confirming the cause
is the missing RTL insn rather than the asm itself. A hybrid that reaches 100%
would have to pin the frame at both ends — roughly 30-40 instructions of asm at
three sites, larger than the `func_80016280` hybrid, leaving the C decorative.
Rejected in favour of section 16.

---

## 16. The witness, and the next steps

### What `func_800165D8` proves

`func_800165D8` is in the same file group, calls the same idiom, and **compiles
to the one-register form in the target**:

```
lui   $a0, %hi(D_8005E3C0)
lw    $a0, %lo(D_8005E3C0)($a0)
nop
lw    $v0, 0x118($a0)
nop
addiu $v0, $v0, 0x28
j     .L80016B34
 sw   $v0, 0x118($a0)
```

Decisively, that update sits **inside one arm of an if/else inside the loop**
(`beqz $v0, .L80016B04` at `0x80016AC0`); the other arm links its primitive
with the full PSY-Q `addPrim` expansion and never touches the global. The
expression is therefore not anticipatable on every path, PRE cannot hoist it,
and it stays a local quantity that the allocator can place — satisfying
condition 1 of section 12.

That same function also settles a separate question: it contains **both** the
hand-rolled folded tag write used in `func_80016C08` and a genuine `addPrim`
expansion (with the `0xFF000000` read-modify-write) in the other arm. So the
`poly->tag = (*ot & 0xFFFFFF) | 0x09000000; *ot = (s32) poly & 0xFFFFFF;`
spelling is period-authentic and must not be "fixed" to `addPrim`.

### The standing suspect assumption

**That this loop tail is unconditional in the original source.** It is the only
assumption from section 11 that survives, and the witness argues against it.

### Next immediate steps, in order

1. **Decompile `func_800165D8`.** It is the only example of this idiom that the
   configured compiler can reproduce, it is smaller, and it is in the same file
   group. Matching it recovers the source idiom and the true control-flow shape
   of the family's loop tail.
2. **Apply that idiom to `func_80016C08`** and restore the `#if 0` block in
   `src/func_80016C08.c`, including the `u16 D_8005E438;` tentative definition
   (section 6) which is required for the gp-relative access.
3. **If step 2 does not close it**, satisfy the section 12 requirement directly:
   lengthen the HIGH quantity's live range so the field-value quantity is
   allocated first and takes `$v0`.
4. **Do not re-run** anything in the section 11 table, nor the section 7.5
   experiment families.

### Tooling gaps found

`flagProbe.ts` **did** fire its self-clobber detector here
(`lui/lw self-clobber at words 336-337 (reg $3)`), so the fingerprint detection
works. Two gaps:

- its remedy for that fingerprint is `-fno-schedule-insns -fno-schedule-insns2`
  (the `SetGfxClip` precedent), which scores 6/357 here — the escalation bar
  correctly refused it, but the advice is misleading for the loop case;
- its flag matrix contains neither `-msplit-addresses` nor
  `-fno-schedule-insns2` **alone**. Both were measured by hand for this note
  (366 instructions / 293 differing lines for sched2-off alone).

Worth adding: when the self-clobber fingerprint fires **inside a loop**, the
remedy is not a scheduling flag — it is the section 12 allocator condition, and
the detector should say so.

### Semantics recovered

`func_80011C24` reaches `D_8005E3C0` **gp-relatively** (so that TU declares it)
and assigns it either `&D_8005E5E8` or `&D_8005E5E8 + 0x134`. `D_8005E3C0` is
therefore the **current draw-buffer pointer of a double buffer whose descriptor
is 0x134 bytes**, and `field_118` is a counter inside that descriptor advanced
by `sizeof(POLY_FT4)` for each primitive emitted. The period spelling is
`cur->prim_used += sizeof(POLY_FT4);`.
