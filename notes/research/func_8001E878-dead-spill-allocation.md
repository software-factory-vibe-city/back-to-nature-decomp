# func_8001E878 — point-in-triangle allocation and dead-spill research log

**Date:** 2026-07-31  
**Status:** **SOLVED — 96/96, byte-verified in the linked binary, full
`make check` passes.** Resolved under a user-approved policy exception: the
match requires an uninitialized `register s32 phantom asm("$2")` (hard-$v0
liveness at entry), which clean C cannot express — see §9.1(b) for the
impossibility argument and §9.4 for the final source recipe.

This note consolidates the work done on `func_8001E878` before and during the
2026-07-31 repair session. It is intended to prevent future work from repeating
source-shape experiments that have already been tested. §9 records the
mechanism investigation that superseded the §8 recommendations.

## 1. Function and target behavior

The function receives three pointers to records with signed halfwords at
offsets 0, 2, and 4. It:

1. averages the three offset-2 values using signed division by three;
2. stores that average to `D_8005E514`;
3. subtracts the average from `D_8005E518->field_4` and stores the difference
   to `D_8005E514` again;
4. rejects the triangle when the absolute difference exceeds
   `D_8005E51C`;
5. computes and stores three 2D cross products; and
6. accepts either three nonnegative or three nonpositive cross products,
   stores the three input pointers, and returns zero. Mixed signs return one.

The orientation-independent sign test is important. The earlier source tested
only the all-nonnegative case and was therefore not semantically equivalent to
the target.

The target has 96 instructions. The current candidate has 95 instructions,
with 7/96 instructions equal by index and an opcode LCS of 84. The low indexed
score is dominated by an early allocation/reload divergence; the cross-product
instruction family and global accesses are otherwise substantially aligned.

## 2. The central unresolved signature

The target prologue begins with this allocation:

```asm
lui   a3,0x5555
ori   a3,a3,0x5556
move  t6,a0
move  t7,a1
move  t8,a2
lh    v1,2(t6)
lh    a0,2(t7)
lh    a1,2(t8)
addu  v1,v1,a0
addu  v1,v1,a1
mult  v1,a3
lw    t1,D_8005E518(gp)
addiu sp,sp,-8
sw    v0,0(sp)
```

The current compiler instead puts the division magic constant in `$v1`, the
sum in `$v0`, and creates no frame. The target's stack slot is never read, and
`$v0` has no target definition before the store. A diagnostic m2c run renders
it as:

```c
sp0 = M2C_ERROR(/* Read from unset register $v0 */);
```

This is the strongest evidence that `sw $v0, 0($sp)` is dead spill/reload
residue rather than a meaningful source-level store. Reproducing the source web
that makes GCC emit this 8-byte frame is the primary unsolved requirement.
The missing frame also explains why the candidate has separate early returns
while the target shares an epilogue that restores `$sp`.

The current trace's relevant assignments are:

- division magic pseudo 104: local, `$v1`;
- average pseudo 84: local, `$v1`;
- difference pseudo 85: global/reload, `$v1`;
- result pseudo 91: two sets, global/reload, `$a0`;
- argument pointer pseudos 81/82/83: `$t6`/`$t7`/`$t8`.

The target needs a coupled change: magic `$a3`, sum `$v1`, average `$a3`,
difference `$v1`, result `$v0`, and one dead stack spill.

## 3. Semantic corrections made during the repair session

These changes are retained in the current source:

- Added the missing `D_8005E514 = avg` store. The target stores both the
  average and the later difference.
- Changed the containment test from all-nonnegative only to:

  ```c
  (cross1 <= 0 && cross2 <= 0 && cross3 <= 0) ||
  (cross1 >= 0 && cross2 >= 0 && cross3 >= 0)
  ```

- Tested the sign condition through `D_8005E500`, `D_8005E504`, and
  `D_8005E508`. This makes GCC retain the target-like reloads on the second
  sign path. Testing only the named locals omits those reloads and produces a
  shorter candidate.
- Replaced the stale claim that the earlier all-nonnegative source had verified
  semantics.

The corrected global-based sign test increased the candidate from 84 to 95
instructions and the opcode LCS from 75 to 84, although the early register
cascade keeps the indexed exact score at 7/96.

## 4. Experiments completed before the 2026-07-31 repair session

The following experiments were recorded in the original source comment and in
`build/fuzz/func_8001E878/`.

| Experiment | Intended mechanism | Outcome |
|---|---|---|
| Separate named sum before `/ 3` | constant birth site / scheduler priority | No useful allocation change; still diverged at the magic constant. |
| Explicit threshold and negative-threshold locals | single- vs multi-set comparison webs | 8/96 in the archived run; did not move the magic constant to `$a3`. |
| Inline `D_8005E518` field accesses | address-expression family / CSE | No useful prologue allocation change. |
| `void *` parameters with repeated `s16 *` casts | fresh/reused address webs | Regressed to 0/96 in the archived run. |
| Minimal locals / heavily inlined cross products | fewer user pseudos | No useful prologue change. |
| Early offset-2 argument loads | argument-save birth order | Still began with the wrong magic register. |
| Target-shaped `bgtz`/`blez` sign control | control-flow and delay slots | Did not solve the initial allocation. |
| `nolocals` variant | reduce global pseudo pressure | 7/96 in the archived run; no magic-register change. |
| `sum_birth` variant | earlier sum pseudo | 7/96 in the archived run; no magic-register change. |
| `threshold_vars` variant | separate threshold pseudos | 8/96 in the archived run; no exact mechanism result. |
| `inline_bounds` variant | fresh bounds-address webs | 7/96 in the archived run. |

The archived full variant summaries are:

- `build/fuzz/func_8001E878/e4314f7dfb655ede/summary.txt`
- `build/fuzz/func_8001E878/febe736eba02fb88/summary.txt`

Those runs predate the semantic fixes above, so their scores should not be
compared directly with the current 95-instruction candidate.

## 5. Experiments completed during the 2026-07-31 repair session

All experiments below were complete clean-C variants compiled with the exact
function oracle. Temporary variants were not promoted unless they improved the
semantic baseline.

### 5.1 Store and sign-condition structure

| Experiment | Observed effect |
|---|---|
| Add the missing average store only | Restored one target operation but did not create the frame. |
| Test same-sign condition through local `cross1/2/3` | Produced 91 instructions; omitted target-like global reloads. |
| Test same-sign condition through `D_8005E500/504/508` | Produced the current 95-instruction structure and the best opcode alignment. |
| Assign cross products directly to globals instead of named locals | Compiled equivalently in the important regions; no prologue change. |
| Perform the average and difference directly through `D_8005E514` | CSE retained the same basic allocation; no frame. |
| Move the average store after computing the difference | GCC deleted the overwritten average store. The intervening pointer load in the retained source is required to prevent this dead-store elimination under aliasing. |

### 5.2 Result and control-flow families

| Experiment | Observed effect |
|---|---|
| Original `if (inside) result = 0; else result = 1; return result;` | Best overall 95-instruction semantic baseline; result allocated to `$a0`. |
| Direct `return 0` in the inside body and `return 1` afterward | Removed the named result web but produced separate return blocks and no frame. |
| Initialize `result = 1`, nest the threshold/body tests, set zero only inside | Result became long-lived and was allocated to `$t9`; candidate shortened to roughly 93 instructions. |
| Repeat `result = 1` in nested threshold blocks | Redundant definitions were optimized; still `$t9`, no frame. |
| Explicit `goto done` and one common return | Result remained in `$a0`; no spill or target prologue. |
| Combine the threshold failures with `||` before `goto done` | No useful allocation change. |
| Complex target-like positive/negative branch layout | Changed later CFG and delay slots but did not create the target frame. |

These results make the result/status web the leading remaining hypothesis, but
simple single-exit and nested forms are exhausted. A future batch must vary the
complete sign-test CFG and result lifetime together rather than retesting these
isolated forms.

### 5.3 Fresh versus reused value webs

| Experiment | Observed effect |
|---|---|
| Merge average, difference, and final result into one local | Moved the magic constant to the desired `$a3`, proving the source-web lever can reach that allocation, but forced average/difference/result into incompatible registers and still emitted no frame. |
| Reuse `avg` as the final result | Also moved the magic constant to `$a3`; sum/difference/result roles remained wrong and no frame appeared. |
| Reuse `diff` as the final result | Regressed the prologue and later allocation. |
| Reuse `max_x` as the final result | Disturbed the bounds-pointer and cross-product register assignment; no frame. |
| Reuse `avg` for the third cross product | Changed many cross-product hard registers and did not reproduce target recurrence. |
| Reuse `avg` for `p0->field_0` | Made one longer multi-set web; magic moved but the web could not use target `$a3` because its lifetimes conflict with hard-register uses. |
| Reuse `diff` for `p2->field_4` | Changed the cross-product web and shortened the candidate; no frame. |
| Reuse the final result local as each multiplication operand | Created a large multi-death global web, moved the operand role away from target `$v0`, and emitted no frame. |
| Split each fused cross product into multiply/accumulate statements | Same large-web problem; target-like fresh `$v0` operand temporaries were lost. |
| Separate named sum before division after semantic fixes | Compiled equivalently around the unresolved allocation. |

The important positive result is narrow: a multi-set average/result web can
make the magic constant use `$a3`. It is not a solution because it couples
values that the target keeps in different hard-register roles. The next source
shape needs the same allocator-pressure effect without merging those semantic
values.

### 5.4 Type and address families

| Experiment | Outcome |
|---|---|
| Typed `CoordTri *` parameters | Best current argument-copy and field-load structure. |
| `void *` plus casts | Previously regressed to 0/96. |
| Inline bounds loads instead of `max_x`/`max_y` | No prologue improvement. |
| Named versus direct global cross-product assignments | No useful prologue change. |

The callers scale records by eight bytes, so the eventual shared record type
probably needs explicit padding at offset 6. That type cleanup does not affect
this function's current fixed-offset accesses and is not expected to solve the
allocation.

## 6. Diagnostic tooling already run

### Structural classification and compiler trace

`explainDiff` classifies the current mismatch as `instruction-selection`
because the target has a frame/spill opcode sequence absent from the candidate.
The first differences are nevertheless register allocation: magic `$a3` versus
`$v1`, and sum `$v1` versus `$v0`. Full traces are under:

- `build/compilerTrace/func_8001E878/`
- `build/explainDiff/func_8001E878/`

### Target-schedule analysis

Target-schedule analysis found unique final-UID alignment for the candidate
used by that run, but baseline comparator replay was not exact in all windows.
It reported priority, LUID, birth-order, and delay-slot requirements; these are
not causal proof for the current source because the target/candidate opcode
streams and allocation still differ. Artifacts:

- `build/targetSchedule/func_8001E878/`

Scheduler work should not be the next step. The frame and allocation must be
fixed first; target hard-register hazards and the shared epilogue are expected
to change scheduling and delay-slot eligibility downstream.

### Scheduler-state constraint search

The bounded search terminated with `MODEL-REPLAY-FAILED` before evaluating a
target assertion:

```text
baseline: 14/20 selections
failure: cycle 4, modeled UID 56 won where observed order required UID 50
```

No SAT/UNSAT conclusion was obtained. Artifact:

- `build/schedulerConstraint/func_8001E878/866abf205e490c4c/summary.txt`

### Source-shape synthesis

Two synthesis attempts generated no alternatives because the conservative
model covered too little of the compound control-flow region:

- `build/sourceShapeSynthesis/func_8001E878/d2f5cf0f7780584e/`
- `build/sourceShapeSynthesis/func_8001E878/546c94374548111b/`

The `no-safe-recipe-for-requirement` result covers only those recorded MVP
grammars and is not evidence against other clean-C shapes.

### Flag probe

`flagProbe` found no target structural fingerprint and no flag column that
dominated the baseline. In particular, disabling instruction scheduling made
the stream substantially worse. There is no evidence for a per-file flag
override.

### Diagnostic m2c

A non-writing m2c run confirmed the target's orientation-independent sign flow
and rendered the stack store as a read from unset `$v0`. It also showed repeated
`var_v0 = 0/1` definitions around the sign CFG, which supports further bounded
experiments on the complete status-variable/control-flow web.

## 7. What has been ruled out

The following should not be repeated without new pass-level evidence:

- arithmetic or signedness changes to the average and cross products;
- all-nonnegative-only containment semantics;
- removing the first `D_8005E514` store;
- simple declaration reordering;
- a standalone named sum;
- standalone threshold locals;
- `void *` parameter casts;
- merely inlining or naming bounds loads;
- merely removing cross-product locals;
- direct-return, simple nested-result, or simple common-return CFGs;
- random statement permutations;
- scheduler-state search before exact baseline replay;
- per-file compiler flags.

No experiment established a need for a barrier, embedded assembly, a hard
register declaration, or an assembler stub.

## 8. Recommended next investigation

The next campaign should optimize for the orphan-spill signature, not initial
match percentage:

```asm
addiu sp,sp,-8
sw    v0,0(sp)
```

Recommended steps:

1. Preserve the current semantic baseline.
2. Build a finite complete-source manifest for distinct sign-CFG/result-web
   families: split nonpositive/nonnegative paths, shared `inside`/`done`
   labels, edge-local result definitions, and target-like repeated status
   assignments.
3. Enable pass tracing and rank candidates first by frame creation, spill hard
   register, result assignment, and magic/sum allocation.
4. Compare `.flow`, `.lreg`, and `.greg` against both the current source and a
   preserved variant where average/result reuse makes the magic constant use
   `$a3`.
5. If no bounded natural-C family emits an orphan spill, inspect the exact GCC
   local/global allocation and reload code responsible for stack homes and
   stores with no surviving reload. Use that mechanism to define the next
   finite source grammar.
6. Consider a compiler/assembler-boundary experiment only after clean-C
   allocation grammars are exhausted. Assemble identical compiler output
   through the available reference/replacement paths; failure to find a source
   shape alone is not evidence of an assembler bug.

The likely breakthrough is a control-flow/value web that gives the return
status a `$v0` preference and enough coupled pressure to spill a dead value,
while preserving fresh short-lived `$v0` multiplication operands. Once the
frame appears, the target's shared epilogue, return branches, and delay slots
may align as downstream consequences.

## 9. 2026-07-31 follow-up session: the phantom is hard `$v0`, not a pseudo

This section supersedes §8. Every claim below is backed by a preserved
artifact. The candidate advanced 7/96 → 85/96 (reloc-masked words against the
target, first 73 words byte-exact) through three coupled discoveries.

### 9.1 The three discoveries

**(a) The result web does not exist.** Every target `li v0,1` sits in a branch
delay slot and is clobbered immediately on the fallthrough path
(`lw v0,D_8005E504` directly after). The original used **direct
`return 0;` / `return 1;` at each exit**, not a named result variable.
Replacing the named-result web with direct returns: 7 → 70/96
(`build/variants/func_8001E878/direct_returns.c`).

**(b) The dead store's operand is literally hard `$v0`.** The store reads
`$v0` before the function's first definition of it (`lw v0,4(t1)` comes two
instructions later), so in RTL the store preceded any def — it stores an
uninitialized value. Compiled experiments show a *pseudo* cannot reproduce the
target allocation:

- Any read-before-set user variable is live at block entry, therefore
  `REG_BLOCK_GLOBAL`, therefore allocated by global-alloc — which runs *after*
  local-alloc has already given `$v0` to the entry block's sum chain
  (verified in `func_8001E878.i.lreg`: phantom pseudo 84 global, assigned a3).
- Local-alloc order (vendored `local-alloc.c`): pass 1 allocates only
  hard-reg-suggested qtys; pass 2 uses
  `QTY_CMP_PRI = floor_log2(refs)*refs*size/lifetime`. A 1-ref phantom has
  `floor_log2(1) = 0` → priority 0 → allocated last, unconditionally.
- The only state that precedes local-alloc is **hard-register liveness**
  (`find_free_reg` masks `regs_live_at[birth..death]`). Hard `$v0` live from
  entry to the store blocks every entry-block temp from `$v0` over [0..13],
  which single-handedly produces the full target rotation: magic → a3
  (skips arg-live a0-a2), sum chain → v1, avg → a3, diff → v1,
  bounds-field_4 temp → v0 (disjoint range), plus the 8-byte frame and shared
  epilogue.
- In compileable C, hard `$v0` is live at entry **nowhere**: args use a0-a3,
  MIPS `STRUCT_VALUE` is 0 (buffer pointer in a0), there are no calls, and no
  SDK header binds `$v0` in C (checked ASM.H/KERNEL.H/LIBSN.H/INLINE_C.H).

A diagnostic probe using `register s32 phantom asm("$2"); tmp[0] = phantom;`
(compiled manually in the session scratchpad — the variant lab correctly
refuses asm) reproduces the entire prologue and mid-function
register-for-register: **85/96**, words 0–72 byte-exact.

**(c) The tail sign-CFG delta is a `dbr`-level block choice.** The remaining
11 mismatched words are one branch polarity + block order in the mixed-sign
exit: target keeps `bgez v0,.L9D4` + inline `j .L9F0; li v0,1`; our compiles
invert to `bltz` with the ret-1 block placed after the store block. The
pre-dbr RTL layout **matches the target through cse, sched2 and jump2**
(label between the branch and its jump blocks jump.c's around-jump inversion;
verified in `probe.i.jump/.sched2/.jump2`), and the restructure appears only
in `.dbr` — GCC 2.95 `reorg.c` fills the delay slots and inverts. Upstream
state differs subtly (after cross-jump the shared ret-1 label has 4 uses in
our compile). Unresolved; irrelevant until (b)'s policy question is settled.

### 9.2 Additional falsified/confirmed shapes (do not retest)

| Shape | Result |
|---|---|
| Phantom = fresh uninit scalar into `s32 tmp[2]` | 62/96; phantom pseudo → a3, rotation absent |
| Phantom = uninitialized `result` (array or struct field) | 62/96; same |
| Phantom + direct returns | 70/96 |
| Phantom = read-before-set `bounds_y` (load kept at diff site) | 71/96; best clean-C shape |
| sum/diff merged into one variable (`n`) | 7/96; changes the instruction stream, wrong |
| `bounds_y` load hoisted above the division | deletes the first `D_8005E514` store (aliasing barrier lost), stream shifts |
| `diff = bounds_y - D_8005E514` (global readback) | **stream-equivalent to the pointer-deref form** — CSE folds the load, both stores survive; usable for source aesthetics |
| Negated condition `if (!(accept)) return 1;` | identical output to positive form (canonicalized) |
| Double-`if` + `goto inside` CFG | identical output (canonicalized) |

### 9.3 Where this leaves the function

The evidence chain says the original object was produced with `$v0` live from
function entry to the dead store — expressible only via a v0-bound register
variable (`register ... asm("$2")`-class construct), which the clean-source
policy forbids, or by an origin outside ordinary compilation (patched or
nonstandard build step). Options, in order:

1. Classify func_8001E878 as a policy exception (hard-register phantom),
   promote the probe shape, and document the mechanism evidence here.
2. Keep hunting for a natural producer of entry-live `$v0` (nothing found in
   GCC 2.95 expand semantics; §9.1(b) argues impossibility).
3. Leave `src/` at the best clean shape
   (`build/variants/func_8001E878/phantom_bounds_y.c`, 71/96 equivalent).

Artifacts: `build/variants/func_8001E878/*.c`,
`build/fuzz/func_8001E878/{9b895511f4da6914,220ee4b5244f0eb2,a3a498cad43a5bb2}/`,
`build/compilerTrace/func_8001E878/` (phantom_bounds_y trace). The probe
source and word-diff live in the session scratchpad only; its full shape is
`phantom_bounds_y.c` + `register s32 phantom asm("$2")` as the phantom +
direct returns, and the exact residual is the §9.1(c) tail arrangement.

### 9.4 Resolution (user-approved policy exception, 96/96)

The user explicitly authorized violating the clean-source policy for this
function. Final source = the §9.1 probe shape plus three tail levers found by
bisection (`src/func_8001E878.c`, `diffFunc` VERIFIED, `make check` OK):

1. **Pinned phantom**: `register s32 phantom asm("$2"); s32 tmp[2];` with
   `tmp[0] = phantom;` as the first statement — hard $v0 live [entry→store]
   produces the frame and the entire prologue allocation.
2. **`goto inside` tail**: the accept condition branches to a label past an
   inline `return 1;`, with the store body after the label. This is what
   keeps reorg's non-inverted `bgez .L9D4` + inline `j .L9F0; li v0,1` shape.
3. **Flag store first in the body**: `D_8005E528 = 1;` before the three
   pointer stores (constant birth order — the emitted store order interleaves
   it second, another instance of the store-block birth-order rule).
4. Both sign-test disjuncts read the **globals** (`D_8005E500/504/508`), not
   the cross locals — CSE folds the first disjunct back to registers and
   keeps the second disjunct's reloads (previously known, §3).

Threshold exits work as plain `return 1;` (shared-`reject:`-label spelling is
equivalent — both scored 96/96).

**Session pitfall worth remembering**: several intermediate experiments were
scored against a **stale object** — maspsx was failing silently
(`include/macro.inc` resolves against the assembler's cwd, so it must run
from the repository root, and it blocks on stdin unless `</dev/null`). Four
"no effect" conclusions in a row were artifacts of comparing the same old
binary. Always confirm the object's timestamp/rebuild before trusting a
comparison, and never suppress the assembler's stderr.
