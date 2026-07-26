# Resolving func_80022F1C: semantic decoding, combine shift-fusion placement, and MIPS address legitimization

**Date:** 2026-07-26
**Outcome:** `src/func_80022F1C.c` matches 49/49 instructions, `make check`
byte-identical, in 100% clean C89 — no register pins, no inline asm, no flag
overrides. Fresh-mode decompilation from an `INCLUDE_ASM` stub.

This note documents the full research path. Unlike the sibling case studies
(`func_8001B4E4`, `func_8001E7DC`), the hard part here was **not** the
allocator: the function's register webs fell out naturally once the source
semantics were right. The fight was (1) three independent *semantic
misreadings* of the target assembly that no amount of source-shape fuzzing
could fix, and (2) two expand-time mechanisms — combine's shift-fusion
placement and the MIPS `LEGITIMIZE_ADDRESS` constant split — that had to be
reproduced through statement structure. Every mechanism is confirmed against
the vendored GCC 2.95.2 sources (`notes/scratch/gcc-2.95.2-reference/`,
expanded in this session with `combine.c`, `expmed.c`, `explow.c`, and
`config-mips/mips.h` from gcc-mirror `releases/gcc-2.95.2`).

A session also produced a tooling fix: a path-mangling bug in the pi
extension's finalize scope gate (§8).

---

## 1. The problem

`func_80022F1C(s32 arg0)` is a 49-instruction threshold cascade: look up a
value by a 16-bit index, load a `u16` at a large computed offset, bucket it
against six thresholds, return 0–6. The original binary:

```
[0]  sll   $a0,$a0,16                sign-extension, first half (early!)
[1]  lui   $a1,%hi(D_8006C838)       base address: lui early ...
[2]  lui   $v0,%hi(D_80055988)
[3]  addiu $v0,$v0,%lo(D_80055988)
[4]  sra   $a0,$a0,15                fused sext+scaling lands HERE
[5]  addu  $a0,$a0,$v0               a0 = sext16(arg0)*2 + array base
[6]  lh    $v1,0($a0)                val = D_80055988[sext16(arg0)]
[7]  addiu $a1,$a1,%lo(D_8006C838)   ... addiu deferred into lh delay slot
[8]  sll   $v0,$v1,3                 \
[9]  subu  $v0,$v0,$v1                |
[10] sll   $v0,$v0,2                  |
[11] addu  $v0,$v0,$v1                | strength-reduction chain:
[12] sll   $v0,$v0,2                  | val * 468  (NOT val * 28)
[13] addu  $v0,$v0,$v1                |
[14] sll   $v0,$v0,2                 /
[15] addu  $v0,$v0,$a1               scaled + base
[16] ori   $v1,$zero,0x8000          \
[17] addu  $v0,$v0,$v1                | +0x99EC split at the 0x8000
[18] lhu   $a0,0x19EC($v0)           / boundary by LEGITIMIZE_ADDRESS
[19] nop
[20] sltiu $v1,$a0,0x1388            < 5000   -> return 0
[22] sltiu $v0,$a0,0x4E20            < 20000  -> return 1
[26] sltiu $v0,$a0,0x7530            < 30000  -> return 2
[30] ori $v0,$zero,0x9C3F ; sltu ; bnez     >= 40000 test (C-1 idiom)
[35] ori $v0,$zero,0xC34F ; sltu ; beqz     >= 50000 test
[40] ori $v1,$zero,0xEA5F ; sltu ; beqz     >= 60000 test
     ... returns 3 / 4 / 5 / 6 with jr/delay-slot layout
```

(instruction indices, not addresses; branch layout elided — see
`build/asm/nonmatchings/func_80022F1C/func_80022F1C.s`)

Three properties make it interesting:

- **The fused shift pair.** `sll 16` at [0] and `sra 15` at [4], separated by
  three symbol-address instructions. The `sra 15` is a *combined* instruction
  (sign-extension + ×2 element scaling) whose placement encodes the original
  statement structure.
- **A 7-instruction strength-reduction chain** that is trivially misread as
  ×28 if you stop evaluating it early.
- **A large address constant (0x99EC) split across three instructions** by
  the MIPS backend's address legitimizer — which only fires for a specific
  address-tree shape, so the source must present the sum in the right form.

## 2. Method

1. **m2c first pass** (`psx_m2c`) for the skeleton, then exact-diff oracle
   (`psx_diff_function`) and classifier (`psx_explain_diff`).
2. **Side-by-side hypothesis testing** (`psx_fuzz_variants`, full cc1→maspsx→as
   mode): 16 structural variants total, each chosen to isolate one mechanism.
   Two phases: v1–v10 against the (wrong) initial semantics; v11–v16 after
   re-decoding the assembly arithmetic.
3. **Compiler-source confirmation.** Fetched `combine.c`, `expmed.c`,
   `explow.c`, `config/mips/mips.h` from gcc-mirror `releases/gcc-2.95.2`
   (now vendored). Every claim in §3–§4 cites file:line.

## 3. Phase 1 — three semantic misreads

The first-pass reconstruction compiled to ~2–4/49 across ten variants. All
three errors were *readings of the assembly*, not shapes — so variant fuzzing
could not converge. Fixing all three in one rewrite jumped to 9/49 with the
entire comparison tail aligned.

### 3.1 `sll 16; sra 15` is `sext16(x) * 2`, not `sext16(x) >> 1`

The misread: "sign-extend, then shift right one" →
`D_80055988[(s16)arg0 >> 1]`. The arithmetic:

```
(x << 16) >>a 15  ==  sext16(x) * 2        exactly.
```

Proof: `x<<16` has its low 16 bits zero; arithmetic right-shift by 15 moves
bit 16→1, …, bit 31→16 and sign-fills above — i.e. `sext16(x) << 1`, with
bit 0 always clear. The `sra 15` is **combine.c fusing the sign-extension
(`sra 16`) with the s16-element scaling (`sll 1`)** (§4.1); the array index
in the source is just `(s16)arg0`. The phantom `>> 1` made combine produce
`sra 14` instead (`>>15` fused with `<<1`) — visible in every early variant
and initially misread as a pure scheduling problem.

**Decoding rule:** around an array access, `sll N / sra N−k` is usually the
sign-extension fused with element scaling `2^k`, not a source-level shift.
Verify with the identity `(x<<16)>>a(16−k) == sext16(x)·2^k`.

### 3.2 The multiply chain is ×468 — evaluate strength reduction to a fixed point

```
sll  v0,v1,3      8v
subu v0,v0,v1     7v      = (v<<3) - v
sll  v0,v0,2      28v
addu v0,v0,v1     29v     <- first pass stopped here and wrote val * 28
sll  v0,v0,2      116v
addu v0,v0,v1     117v
sll  v0,v0,2      468v
```

The chain is synthesized by `expmed.c:synth_mult` (line 2060) by recursive
odd/even decomposition. Tracing `synth_mult(468)`:

- **468 even** (line 2106, "group of zero bits"): `m=2`, `q=117` → synthesize
  117, then `alg_shift` by 2 → final `sll v0,v0,2`.
- **117 odd** (line 2127, "add or subtract one"): `t−1=116` even → `q=29`,
  shift 2, then `alg_add_t_m2` (+v) → `addu v0,v0,v1; sll v0,v0,2;
  addu v0,v0,v1`.
- **29 odd**: `t−1=28` → `q=7`, shift 2, +v.
- **7 odd**: `t+1=8` (three trailing ones) → shift 3, `alg_sub_t_m2` (−v) →
  `sll v0,v1,3; subu v0,v0,v1`.

Result: `sll3, subu, sll2, addu, sll2, addu, sll2` — the target's chain
exactly. (Factored paths like 468 = 4·9·13 exist in the search space but
cost more under the R3000 `shift_cost` table.)

**Decoding rule:** never transcribe a multiply chain partially. Fold each
`addu/subu` against the multiplicand register and each `sll` as a power of
two until the result feeds a non-chain consumer.

### 3.3 `sltiu` sign-extends its immediate — `ori IMM; sltu` means `IMM+1`

MIPS `sltiu` **sign-extends** its 16-bit immediate before the unsigned
compare, so it can only encode thresholds 0..32767. For `x < 40000` GCC
emits the reverse test:

```
ori  v0,zero,0x9C3F      39999 = 40000 - 1
sltu v0,v0,a0            v0 = (39999 < a0)  <=>  a0 >= 40000
bnez ...                 (skip the return-3 block)
```

The first pass transcribed the `ori` immediates literally
(`< 0x9C3F / 0xC34F / 0xEA5F`) — off-by-one on all three large thresholds
and, worse, the wrong idiom class. Source constants: **40000, 50000,
60000**. With them, GCC reproduces the whole tail: `sltiu` for the three
small constants, `ori C−1; sltu` for the three large ones, including the
`ori` hoisted into the preceding branch delay slot.

**Decoding rule:** `ori IMM; sltu r,IMM_reg,x` (+`bnez` for the else-branch)
reads as source constant `IMM + 1`.

## 4. Phase 2 — the codegen mechanisms (verified against 2.95.2 sources)

With semantics fixed, the remaining diff was the 8-instruction head and the
address-constant split. Four hypotheses (v11–v14) isolated two mechanisms;
v15 combined them for 49/49.

### 4.1 combine's merge placement: the fused shift lands at the *latest* insn

`combine.c:try_combine` builds the merged pattern **on the latest
instruction of the group**:

```c
1683:      newpat = PATTERN (i3);                 /* start from I3's pattern */
1732:      newpat = subst (PATTERN (i3), i2dest, i2src, 0, ...);
1758:      newpat = subst (newpat, i1dest, i1src, 0, 0);
```

I1/I2 are deleted as their destinations die; the combined instruction
**occupies I3's position**. For this function, I2 = `sra16` (sign-extension)
and I3 = `sll1` (the ×2 element scaling at the array-access site) fuse via
`simplify_shift_const`'s nested-shift merger (combine.c:8596, "Here we have
two nested shifts") into `(ashiftrt (ashift x 16) 15)` — placed **wherever
the scaling shift was expanded**.

Consequence for source shape: to reproduce the target layout

```
[0] sll a0,a0,16        <- sign-extension's first half, early
[4] sra a0,a0,15        <- fused result, after both symbol-address setups
```

the sign-extension must be expanded in an **earlier statement** than the
array access, so that its `sra16` can be consumed by the merge (planted at
the later access site) while `sll16` stays at the top:

```c
idx = (s16)arg0;                 /* expands sll16@0, sra16@1 */
base = (char *)&D_8006C838;      /* expands lui a1, addiu a1 */
val = D_80055988[idx];           /* expands lui v0, addiu v0, sll1;
                                    combine: sra16+sll1 -> sra15 AT the sll1 site */
```

Single-expression forms (`D_80055988[(s16)arg0]` with everything inline)
expand the sign-extension adjacent to the access, so the fused shift lands
next to `sll16` — the v11/v12 layout (`...sll@3, sra@4` after the symbol
loads) rather than the target's (`sll@0, sra@4`).

**Observed scheduler behavior** (consistent with the vendored `sched.c`
backward list scheduler and the R3000's single load-delay slot): the
post-expand order was preserved *except* that `addiu a1` moved from [2] to
[7], filling the `lh v1 → sll v0,v1,3` load-delay slot. Head-order matching
in this function was an **expand-order (statement structure) problem**, not
a scheduler-priority one — a contrast with the func_8001B4E4 case, where the
backward scheduler freely bubbled independent chains.

### 4.2 `LEGITIMIZE_ADDRESS`: the 0x8000 split fires only for `plus(REG, big const)`

The target applies `+0x99EC` as:

```
ori  v1,zero,0x8000        0x99EC & ~0x7fff
addu v0,v0,v1
lhu  a0,0x19EC(v0)         0x99EC & 0x7fff
```

This is the MIPS backend's `LEGITIMIZE_ADDRESS` macro
(`config-mips/mips.h:3018`; comment at 3006: "transform memory(X + <large
int>) into Y = <large int> & ~0x7fff; Z = X + Y; memory(Z + (<large int> &
0x7fff))"):

```c
3071:      if (code0 == REG && REG_MODE_OK_FOR_BASE_P (xplus0, MODE)	\
3072:	  && code1 == CONST_INT && !SMALL_INT (xplus1))			\
...
3078:			  GEN_INT (INTVAL (xplus1) & ~ 0x7fff));	\
3084:		       GEN_INT (INTVAL (xplus1) & 0x7fff));		\
```

The guard requires the address reaching it to be exactly
`plus(REG, CONST_INT)` with the constant out of `d16` range. Two source
shapes reach `memory_address` (explow.c:428) with different trees:

| source shape | address tree at legitimize | path taken | emitted |
|---|---|---|---|
| `*(u16*)(base + val*468 + 0x99EC)` | `plus(plus(reg,reg), 0x99EC)` | macro guard fails (op0 is PLUS, not REG) → explow.c:487 generic PLUS: `eliminate_constant_term` leaves `plus(reg,reg)`, not a valid MIPS address (mips.h:2845 has no reg+reg mode) → `force_operand` materializes **0x99EC whole** | `addu v0,v0,a1; li v1,0x99EC; addu; lhu 0(v0)` (v11/v16) |
| `ptr = base + val*468;` then `*(u16*)(ptr + 0x99EC)` | `plus(reg, 0x99EC)` | macro fires | `addu v0,v0,a1; ori v1,0x8000; addu; lhu 0x19EC(v0)` (v13/v15) ✓ |

**Lever:** when the target shows a large constant split as
`li C&~0x7fff; addu; mem [reg + C&0x7fff]`, the original attached that
constant **only at the final dereference**, with the base+scaled sum already
materialized as its own pseudo (a separate statement). Folding everything
into one address expression takes the generic `force_operand` path and
materializes the constant wholesale.

### 4.3 Why the base statement must come *first*

v13 had the correct constant split but placed `lui v1,%hi(D_8006C838)` late
(after the multiply chain), because the base symbol was expanded inside the
pointer-sum statement. The target's `lui a1` sits at [1] and its `addiu a1`
fills the `lh` delay slot at [7]. A standalone leading statement
(`base = (char *)&D_8006C838;`) emits the `lui/addiu` pair at statement
position [1–2]; the scheduler then defers the `addiu` into the delay slot —
exactly the target. (v11 proved this half; v15 = v11's head + v13's split.)

## 5. Failed strategies (16 variants, all diffFunc-verified)

| Variant | Shape | Result | Why it failed |
|---|---|---|---|
| v1–v8 | various index/offset idioms | 2/49 | **wrong semantics** (§3): `>>1` index, ×28, off-by-one thresholds — no shape can fix semantics |
| v9 | char*-cast array, explicit chain | 4/49 (cc1 triage) | right chain by accident of explicit steps; still `sra 14` fusion and wrong semantics |
| v10 | pointer arithmetic | 2/49 | same |
| v11 | base stmt first, `*(u16*)(base + val*468 + 0x99EC)` | 37/49 | head order right (base lui early, addiu in delay slot); `sra15` adjacent to `sll16`; **0x99EC materialized whole** (§4.2) |
| v12 | val first, then base stmt | 35/49 | base symbol no longer earliest → head order off |
| v13 | `ptr = sym + val*468; *(u16*)(ptr + 0x99EC)` | 25/49 | **0x8000 split right** (§4.2); base lui late (no standalone base stmt); fused shift adjacent |
| v14 | v9-style explicit s32 arithmetic, fixed index | 25/49 | explicit steps defeat the natural fusion/CSE layout |
| v16 | v15 head + folded offset | 41/49 | isolates §4.2: folded offset still materializes whole |
| **v15** | idx stmt → base stmt → access → ptr stmt → split MEM | **49/49** | — |

Phase-1 lesson restated: v1–v10 burned the majority of the session's
variants against semantics that made convergence impossible. The unlock was
putting the variants down and re-decoding the assembly arithmetic (§3).

## 6. The resolution

```c
#include "common.h"

s32 func_80022F1C(s32 arg0) {
    s32 idx;
    char *base;
    s16 val;
    char *ptr;
    u16 result;

    idx = (s16)arg0;                            /* §4.1: sll16 early, sra16 donated to the fusion */
    base = (char *)&D_8006C838;                 /* §4.3: lui a1 early, addiu a1 -> lh delay slot */
    val = D_80055988[idx];                      /* §3.1: plain index; combine fuses sext with x2 -> sra15 at [4] */
    ptr = base + val * 468;                     /* §3.2: synth_mult chain; sum materialized as own pseudo */
    result = *(u16 *)(ptr + 0x99EC);            /* §4.2: plus(REG, big const) -> 0x8000-boundary split */
    if (result < 5000)  return 0;               /* §3.3: sltiu */
    if (result < 20000) return 1;
    if (result < 30000) return 2;
    if (result < 40000) return 3;               /* §3.3: ori C-1; sltu */
    if (result < 50000) return 4;
    if (result < 60000) return 5;
    return 6;
}
```

Each statement earns its place by exactly one mechanism from §3–§4; removing
or merging any two statements re-breaks a specific instruction group (v16
demonstrates this for the last two).

## 7. Reusable levers (doctrine candidates)

1. **Decode before you fuzz.** Shift pairs, multiply chains, and
   `ori+sltu` compare idioms each have an exact decimal reading. Compute it
   by hand first; a wrong constant or index makes the inverse problem
   unsolvable no matter the shape. (Cheap checks: `(x<<16)>>a(16−k) =
   sext16(x)·2^k`; fold strength-reduction chains to a fixed point;
   `ori IMM; sltu` ⇒ constant `IMM+1`.)
2. **`sltiu` sign-extends.** Unsigned source comparisons against constants
   ≥ 0x8000 compile to `ori C−1; sltu` (reverse test). Read and write them
   accordingly.
3. **A fused shift lands at the *latest* merged insn** (combine.c:1683).
   When the target shows `sll16` early and a fused `sra(16−k)` late, split
   the sign-extension into an earlier statement so combine can consume the
   `sra16` and plant the fused shift at the scaling site.
4. **Large address constants split only at a bare-REG MEM address**
   (mips.h:3071). Give the base+scaled sum its own statement and put the
   big offset on the final dereference; a folded sum tree takes the
   `force_operand` path and materializes the constant whole.
5. **Statement order ≈ expand order ≈ emit order** for heads like this:
   the R3000 scheduler here only filled the `lh` load-delay slot. Match head
   order through statement order before blaming scheduler priorities — but
   note the contrast with func_8001B4E4, where independent chains *were*
   bubbled; the difference is dependency density, not a different scheduler.
6. **A standalone base-address statement is a scheduling primitive.**
   `base = (char *)&SYM;` as the first statement gets the `lui` emitted
   early and lets the scheduler park the `addiu` in a later load-delay slot.

## 8. Tooling appendix — finalize scope-gate path mangling

`psx_finalize_function` failed on a phantom path `nclude/functions.h`
(missing the leading `i`) reported as "outside the configured integration
roots".

**Root cause:** `.pi/extensions/psx-decomp/autonomous/workspace.ts` — the
`git()` helper returned `result.stdout.trim()`. The first
`git status --porcelain=v1` line is `" M include/functions.h"`; trimming
strips its status-column space, so the parser's `line.slice(3)` eats one
path character. The mangled `nclude/...` then fails the `allowedRoots`
check. Same latent pattern in `trackedDirtyFiles`.

**Isolation method:** two throwaway harnesses — one dumping the three
changed-file lists through the extension's own modules, one printing the
raw `runCommand` stdout as JSON (proving git's output was clean and the
corruption happened in-process).

**Fix:** `.trim()` → `.trimEnd()` (commented). **Aftermath:** the session
baseline (captured once at extension activation) predates the fix, so the
gate then fails on the fix file itself (`.pi/` is outside `allowedRoots`);
the baseline re-snapshots next session and finalization passes.
`make check` independently confirmed the payload byte-identical.

## References

- `notes/scratch/gcc-2.95.2-reference/combine.c` — try_combine merge
  placement (1683, 1732, 1758), simplify_shift_const nested-shift fusion
  (8353, 8596).
- `notes/scratch/gcc-2.95.2-reference/expmed.c` — synth_mult (2060), even
  (2106) and odd (2127) decomposition.
- `notes/scratch/gcc-2.95.2-reference/explow.c` — memory_address (428),
  LEGITIMIZE_ADDRESS call (476), generic PLUS/force_operand fallback (487).
- `notes/scratch/gcc-2.95.2-reference/config-mips/mips.h` —
  GO_IF_LEGITIMATE_ADDRESS (2845), LEGITIMIZE_ADDRESS 0x8000 split
  (3006–3086).
- `notes/scratch/gcc-2.95.2-reference/sched.c` — backward list scheduler
  (vendored by the func_8001B4E4 session; §4.1's scheduler observation).
- `notes/retros/func_80022F1C.md` — the compact session retro this note
  expands.
- `notes/research/func_8001B4E4-scheduler-allocator-resolution.md`,
  `notes/research/func_8001E7DC-allocator-preference-battle.md` — sibling
  case studies (allocator/scheduler fights; contrast §4.1).
- `prompts/c-style-guide.md` — project pattern catalog.
