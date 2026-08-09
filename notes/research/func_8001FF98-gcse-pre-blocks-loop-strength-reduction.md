# func_8001FF98 — GCSE loop-PRE hoist destroys outer-loop biv, blocking loop.c strength reduction

**Status: SOLVED (2026-07-31).** 83/83 and full-payload byte identity
(`make check` green) with plain C under the STANDARD project flags - no
override, no shield. The key was a period idiom: reusing one counter across
sequential loops is a NATURAL PRE isolation shield (see session 4b). Final
source: src/func_8001FF98.c.

## Signature

Nested loops where the outer loop body spans multiple basic blocks because
it contains the inner loop, and the outer counter is incremented at the loop
bottom. Target requires loop.c strength-reduction products (walking pointer
givs whose `addiu +4` updates sit at the loop bottom, after the inner loop's
back-edge), but the outer loop gets **no** strength reduction at all.

## Mechanism chain (proven)

1. The target's outer loop is loop.c SR output: 10 array-address givs
   reduced to walking pointers (updates emitted by `strength_reduce` before
   the biv's increment insn), `row*4` reduced to an offset accumulator
   (`a3`), `row++` in place at the bottom (`addiu t0,t0,1`).
2. `strength_reduce` exits immediately when `loop_iv_list` is empty — it
   needs at least one verified basic induction variable.
3. GCC 2.95.2 pass order is: jump → cse → **gcse** → loop1 →
   delete_trivially_dead → loop2 → cse2 → …
4. GCSE's loop-PRE (`gcse.c` `pre_lcm`/`pre_insert`) sees the bottom-of-loop
   `(set row (plus row 1))`. Because the inner loop splits the outer body,
   the expression is "anticipated" at the end of the top block (bb1): every
   path from bb1-end through the inner loop reaches the bottom computation
   without setting row. PRE therefore hoists it:
   `regN = row + 1` at end of bb1 (before the inner loop), and rewrites the
   bottom insn to `row = regN`.
   Dump evidence: `.gcse` — `PRE/HOIST: end of bb 1, insn N, copying
   expression (plus row 1) to reg N` and `PRE: redundant insn <row++>
   (expression E) in bb 3, reaching reg is N`.
5. loop.c's `basic_induction_var` REG case walks backward from the bottom
   move looking for the `(plus row 1)` set of `regN`; it stops at the inner
   loop's `CODE_LABEL` (`single_set` fails on labels), so row is never
   recorded as a biv. The outer loop then has zero bivs → zero givs → no
   walking pointers, no `a3`, no in-place `t0` increment.
   gdb evidence: hardware watchpoints on the row++ insn's SET_SRC across
   loop_optimize show loop.c never rewrites it; the split already exists at
   the end of GCSE (`insn 108`-style hoisted compute appears first in the
   `.gcse` dump).

Single-block loops (the function's 24-iteration tail loop) are immune —
the bottom increment is computed in the same block where it is used, so no
inter-block redundancy exists — which is why the tail loop matches while the
outer loop does not.

## Trichotomy of counter placements (exhaustively tested, all fail)

- **Increment at bottom (bb3):** GCSE hoists it (all forms: `row++`,
  `row = row + 1`, `++row` in test, `for`-clause, countdown, `s16`,
  two counters, stores after inner loop, inner loop independent of row).
- **Increment inside the inner loop:** the biv survives (outer SR *does*
  run — experiment `w46`), but loop.c emits the giv updates before the
  increment *inside* the inner loop; the target has them after the inner
  back-edge, and the scheduler cannot move instructions across the loop
  boundary. Fatal position mismatch.
- **Increment at top (bb1):** no hoist, biv survives, but updates are
  emitted at the top — same fatal position mismatch.

## Shield attempts (set row in bb1/inner to kill anticipation)

`row += 0` and `row = row` are folded/deleted before GCSE. `next = row + 1`
adjacent to the move-back is hoisted anyway (adjacency is irrelevant to
PRE). `next = row + 1` inside the inner loop is hoisted out by GCSE
(invariant there). `row = row + 1` inside the inner loop works as a biv but
drags updates inside. Two-increment nets (`+2/-1`) break semantics and split
giv updates. Non-increment bb1 sets (`off = row*4`, `prev = row`) block the
hoist but also break biv verification (`n_times_set != biv_count`).

## Reachability evidence under `-fno-gcse`

The natural source shape (10 array-indexed stores + inner loop
`pa = &D_8006C0A8[row]; pb = &D_8006C088[row]; do { *pa++ = -1; *pb++ = -1;
col--; } while (col >= 0);`) compiled with `-O2 -fno-gcse` reproduces the
target's structure almost exactly: 8-byte frame, walking pointers with
in-place `+4` at the bottom, inner pa/pb walks, `addu pa = off + base` for
C0A8/C088. Remaining gaps even there: loop.c's benefit cutoff declines to
reduce `row*4` ("giv … not worth while"), leaving `sll`+`addu`, and global
allocation details differ. `-fgcse` is mandatory per
`configs/project-profile.md`, so this is diagnostic only.

## Implications for other functions

Any function with a bottom-incremented counter in a multi-block loop body
whose target shows loop.c strength-reduction products should be suspect for
the same blocker. Check the `.gcse` dump for `PRE/HOIST: end of bb …
expression (plus <counter> …)` before investing in loop.c-directed source
shapes.

## Tested-and-rejected source families (do not retry blindly)

m2c 11-pointer form; array indexing everywhere (current best 7/83); 13
explicit walking pointers (all to saved regs); explicit pointers + inner
walk (V2: GCSE hoists each `p++`, producing compute-early/move-late with
9 saved regs); array indexing + fresh pa/pb inner walk (V3, 2/83); counter
inside inner loop (V5/w46, 1/83); counter/offset/for/while/s16/countdown
variants; explicit `off` variable; two-variable split; `row += 0` shield;
adjacent `next = row + 1`.

---

## ADDENDUM (2026-07-30, session 2): blocker SOLVED, status now allocation-only

**Status change: the PRE hoist is defeated with clean C under the baseline
flags. 46/83 (55.4%), 83/83 instruction count, full structural
correspondence. The original "unreachable under -fgcse" conclusion is
falsified.** Remaining gap is one register-allocation cascade.

### Regression sweep (flag evidence)

Compiling all 466 src functions with `-fno-gcse`: only 4 change at all —
this function plus func_8001A8D0 (40/40 base vs 7/40 nogcse),
func_8001A970 (67/67 vs 50/67), func_80022F1C (49/49 vs 21/49). The three
witnesses require gcse to match, so **the original build had gcse on** and
a flag override is neither needed nor historically defensible.

### The A970 counterexample and the real mechanism (lcm.c)

func_8001A970's matching compile contains three bottom-of-loop updates in
a multi-block body that PRE does NOT touch (its only insertions are a
genuine two-occurrence diamond redundancy). The discriminator is not
"multi-block body" but a **nested back edge** between the loop head and
the increment. GCC 2.95.2 PRE = gcse.c local properties + lcm.c dataflow
(ANTIN → EARLYIN → DELAYIN → LATEIN → ISO → optimal/redundant):

- The kill block (the increment sets its own operand) has earlyout=1,
  which flows around the outer back edge making the expression
  anticipatable-and-earliest at the loop head; DELAYIN then propagates
  down — **except through a block with a self-edge**, because
  delayin[b] = antEarly[b] | ∩(delayout[preds]) includes the block's own
  delayout (init 0, monotone) and antEarly[b] is 0 there. The inner loop
  therefore blocks DELAY, the bottom block is never LATEIN, and
  compute_redundant deletes the increment (compute-early/move-late).
- Single-block loops are immune because the self-edge feeds their own
  earlyout=1 back into earlyin, making antEarly=1 (self-sufficient).
- Diamonds are immune because nothing blocks DELAYIN propagation.

### The isolation shield (the fix)

`redundant[b] = antloc[b] & ~(latein[b] | isoout[b])`, and
isoout[bottom] = ∩ isoin[succs]. A second occurrence of the SAME
expression in the loop-exit successor makes latein there 1, hence
isoin=1, hence **isoout[bottom]=1: the in-loop increment becomes
"isolated", is not deleted, and pre_insert inserts nothing** (it only
fires for deleted occurrences). Both `row+1` and `off+4` need shields.

Delivery matters: `delete_trivially_dead_insns` (post-cse1, pre-gcse) is
count-based and strips sets of never-used regs, so the shield must be a
dead store **to a variable used elsewhere** (`i = row + 1; val = off + 4;`
before their real inits). It survives to gcse (isolation active) and
loop.c (SR runs), then flow's liveness DCE deletes it — zero trace in the
final code. Verified: only the 14 beneficial lui hoists remain in the
.gcse dump; SR produces all 10 walking pointers, in-place row++, and the
a3 offset accumulator, under unmodified project flags.

Note: the explicit `off` byte-offset biv is required. A lone row*4 giv is
declined by loop.c's benefit test (`lifetime*threshold*benefit <
insn_count` — shift saved equals add paid), so array indexing alone never
yields the a3 accumulator (confirmed under both flag settings).

### Remaining gap: one allocation inversion

global.c priority = floor_log2(refs)·refs·10000/live_length (verified
against .lreg): off 2213→a3 ✓; walks 1296–1944→{t0–t8,v1}; row 1129
(7 refs/124) ranks last→t9. Target needs row→t0, i.e. rank between off
and the walks. row's refs are frozen (everything foldable is folded
before flow counts; every live use emits code) and its length cannot
shrink below the preheader. Shared-tail-counter overshoots (row outranks
off, takes a3; tail then matches — target tail counter t0 IS row's reg,
so sharing is probably right once off can outrank it, which needs +2
unfoldable in-loop off refs — none found). Also mapped: walk birth order
(materialization chunks) is invariant to source store order; s0/s1
assignment invariant to pa/pb line order; find_reg pass-0 skips regs
preferred by other pseudos (copy-preferences from lo_sum temps explain
v0/v1 patterns).

### Next directions

- Find a structural change giving row weighted-refs 9 at flow time
  (combine-window deletion is the only post-count eraser; 2.95 combine
  provably cannot fold (lt (plus X 1) C) — tested).
- Or make off outrank a shared row (+2 in-loop off refs).
- The generic screening advice stands, corrected: bottom increments in
  diamond-only bodies are safe; nested-loop bodies need the shield.
  The shield recipe generalizes to any function hitting this blocker.

## 2026-07-31: Whole-toolchain audit (is the toolchain wrong?)

Question raised: two hard functions in a row (func_80019070 scheduling-class,
func_8001FF98 allocation-class) — is the toolchain itself wrong? Audited every
layer; answer: no.

- Compiler identity: fed identical natural for-loop source to all built period
  compilers — gcc 2.7.2-psx (69–71 instrs), 2.8.0-psx (79), 2.8.1-psx (79),
  egcs 2.91.66-psx (81), and the real PSY-Q 4.4 cc1 (gcc-2.8.1-based, 79,
  byte-identical behavior to plain 2.8.1). None reproduces the target shape:
  they leave 3 address materializations inside the loop, count the tail loop
  up with slti/bnez, and use no saved regs. The target carries a 2.95-only
  transformation fingerprint: all 12 lui/addiu pairs hoisted to the prologue,
  tail counter reversed to li 23/bgez countdown (check_dbra_loop), giv-reduced
  walkers. Only 2.95.2-psx produces the exact 83-instruction opcode stream
  (46/83 positional, register-rank cascade only).
- Provenance: exact and register-masked (opcode+immediate, registers
  wildcarded) byte scans of lib/libsnd*, lib/libspu* for the function's
  double-walker countdown inner loop: no hits. Not SDK library code (and lib/
  is the confirmed-correct PSY-Q v4.70, so this is conclusive — earlier
  "wrong SDK version" suspicion was resolved as link-order relocation noise;
  see notes/rom_info/lib-detectoin-gaps.md). Semantics (per cross-refs
  func_80020148/174/80020E38/80021820): sound engine reset — 6-slot request
  FIFO + per-slot tables, 24-entry SPU voice-allocation table (C128 =
  0x1000000 min-scan sentinel, C0C8 = state tag scanned in 4 priority passes).
- Flags: -fno-gcse regression sweep = 462 SAME / 4 DIFF project-wide; natural
  2D forms under -fno-gcse score 9/83 at 88 instrs. Not a flag problem.
- Assembler: maspsx validated by the ~466-function byte-matched corpus;
  assembler cannot affect register allocation anyway.
- Natural-source tests under 2.95.2 baseline: flat 2D-cast indexing
  ((s32 (*)[1]) casts, for/do-while) = 1–7/83, 86–88 instrs, 4 saved regs.
  The literal 2D reading is not the original shape either.

Conclusion: toolchain validated at every layer. The residual divergences are
allocator-input (ref counts) and scheduler-input (insn order) class — i.e.
lost source shape (declarations, constants like the inner dimension N=1,
module idioms), the one input the binary does not preserve. Note the
register-__asm__ crutch concentration (~29 src files, clustered around
0x80012000–0x80024000): likely one module/idiom family; finding the idiom
once may clear several functions.

## 2026-07-31 session 3: period-idiom research and trick falsification

Three-way research sweep (period corporate style, decomp-community GCC 2.9x
tricks, period sound-driver source) plus local empirical tests of every
candidate. Full agent reports referenced key sources: PSY-Q SDK samples +
silent-hill-decomp (byte-matched 1999 Japanese code) for style; mkst/esa (the
one public GCC 2.95.2 -O2 + maspsx matching decomp); NFSHS METHODOLOGY.md;
sotn-decomp wiki; decomp-permuter pass catalog; papermario GCC 2.8.1 wiki;
sotn libsnd matched source.

Idiom validation (period style vs our reconstruction):
- Period code writes count-up indexed for loops; countdown loops in the
  binary are check_dbra_loop reversals, not source. ESA (same compiler+flags
  as us) matches multi-array fills from NAIVE INDEXED source - strength
  reduction manufactures the walkers. Our hand-written countdown/pointer
  forms are modern-isms but provably compile identically here.
- libsnd SsSetTableSize iterates a [s_max][t_max] score table with a nested
  double loop; t_max==1 for SEQ-only games. An in-house driver patterned on
  libsnd with 6 songs, SEQ-only => our exact [6][1] inner-loop shape. The
  "1-iteration inner loop" is idiomatically explained.
- Parallel-array voice/slot state, -1 sentinels, literal bounds, per-field
  constant stores: all confirmed period-normal for sound drivers.

Community tricks tested against the allocation inversion (all under 2.95.2
baseline, scored):
- do { row++; } while (0); fence (Silent Hill precedent, 2.8.1): does NOT
  block 2.95 PRE (91 instrs without shield; 30/83 with shield). 2.8.1 has no
  gcse - their fence solved a different (loop-shape) problem.
- if (row) {} / if (off) {} dead refs (permuter perm_refer_to_var, SH
  precedent): byte-identical output - deleted by jump1 before flow counts
  refs. Plain-local dead refs are a no-op in 2.95; SH's working case was a
  MEMORY reference.
- Named constant local (s32 neg1 = -1; SH bendMultiplier precedent): LIVE
  LEVER - moves the li a2,-1 birth to the target's early position (33/83,
  83 instrs; positional drop is alignment shift). Does not change row's rank.
- register keyword (all/counters/pointers), declaration order (3 perms),
  init-statement order (5 perms): all byte-identical. Not allocation inputs
  here.

Open contradiction (strongest remaining lead): if the original was a plain
count-up loop (all style evidence) and this TU had -fgcse, PRE should have
mangled the original's own bottom increment - nothing in natural source
provides an isolation shield. The three -fgcse witnesses (A8D0, A970, 22F1C)
all lie OUTSIDE the sound module. Per-TU -fno-gcse for this file is
historically plausible and governed (flag_overrides.mk precedent); prior
-fno-gcse attempts (~40/83) predate this session's idiom knowledge and the
ESA naive-indexed precedent. Next: systematic -fno-gcse sweep of
ESA-shaped naive indexed variants.

## 2026-07-31 session 4: SOLVED — plain C under per-file -fno-gcse

User authorized per-file flags. First -fno-gcse sweep of the research-mapped
naive space (56 variants) produced an immediate 83/83:
`for (row...6) { ten naive [row] stores; for (col...1) { score tables
[row][col] = -1; } }` + shared `row` as tail counter + pointer-walk tail.
Every element the research predicted: libsnd [s][t] t=1 idiom (true 2D type
via globals_override.h: s32 [6][1]), count-up for loops, no off variable, no
shield, literal -1, shared counter (target tail t0 IS row). The allocation
inversion that resisted every lever under -fgcse simply does not occur when
LICM (not GCSE PRE) does the hoisting.

Final 13 bytes: D_8006C088/D_8006C0A8 %lo addends transposed (s0/s1 base
swap). BOTH per-function tools (diffFunc, positional harness) are
reloc-masked and blind to symbol transposition; only the full-payload byte
check caught it. Fix: swap the two inner-loop store statements (original
stored C088 first in source). LESSON: after any masked-tool 100%, verify
real bytes via `make check` before declaring victory; masked comparisons
cannot distinguish same-shaped accesses to different symbols.

Epilogue: the isolation shield (sessions 2-3) remains valid knowledge for
functions that genuinely need in-place bottom increments under -fgcse (the
three witness TUs), but for this module the historically correct answer was
the flag. The register-__asm__-pinned siblings in this module
(80020E38/80021820 etc.) should be retested under -fno-gcse — if the flag
clears them too, the whole sound module was a -fno-gcse TU (strong
co-validation; potential module-wide cleanup).

## 2026-07-31 session 4b: CORRECTION — no flag override needed after all

flagProbe's matrix on the final source showed baseline == -fno-gcse (83/83
masked both). Removing the override and rebuilding: full-payload byte
identity under the STANDARD flags. The -fno-gcse hypothesis was productive
but wrong; the override has been deleted.

THE REAL MECHANISM - counter reuse is a natural isolation shield:
the final source reuses `row` as the tail loop's counter. The tail's
increment contains a post-outer-loop occurrence of (plus row 1), which sets
isoout at the outer loop's bottom block; redundant = antloc & ~(latein |
isoout), so PRE isolates (leaves alone) the outer bottom increment. This is
the natural-source shield sessions 1-3 concluded could not exist - it can,
and it is exactly the period idiom (one counter variable reused across
sequential loops, confirmed by all style corpora). Session 2's "shared tail
counter overshoots" finding applied only to the explicit-off hand-shaped
source; in the naive form (no off variable) the shared counter is precisely
what makes both the PRE behavior and the register allocation land.

Generalizable rule for the PRE-fatal fingerprint (nested loop + bottom
increment, flagProbe detects it from target bytes): before anything else,
check whether the target's LAST loop's counter register equals the earlier
loop's counter register (here both t0) - if so, write the source with ONE
reused counter variable and naive indexed bodies. The artificial dead-store
shield remains a fallback only for functions with no later loop to share.

Why the -fgcse contradiction dissolves: natural period source DOES survive
gcse - via counter reuse. No per-TU flag delta is required for this module;
the register-__asm__-pinned siblings should be retried with naive + shared
counter idioms under baseline flags.
