# func_80019070 — prologue allocation, arg2 truncation, and sched2/dbr mechanics

**Status: 72/81 (88.9%), up from 68/81 after applying the target-schedule and
finite source-shape search tools.** Instructions 10–80 now match byte-for-byte.
Allocation, both delay slots, and the former arg9 branch/store window are
solved. The only remaining mismatch is the order of nine independent prologue
instructions at indices 1–9 (0x04–0x24). The current source uses three
policy-allowed empty memory barriers, each documenting the exact scheduling
window it preserves.

## Current tool-assisted result

`analyzeTargetSchedule` first isolated two hard requirements in the 68/81
source: reverse the final `$t6`/`$t7` allocno order and put the `srl` ahead of
the pointer move in reorg's eligible delay-slot scan. Making the arg9 condition
web multi-set reversed the allocno order and reached 69/81. A named code-result
web plus three empty memory barriers then fixed the arg9 branch delay slot,
restored the code-byte store at 0x8C, and selected `srl a2,a2,4` for the clamp
branch delay slot, reaching 72/81.

The remaining target/candidate schedules are:

```text
target:    li4 li100 move-ptr mask16 sext-hi sext-lo nibble mask-f0 load-arg8
candidate: mask16 nibble mask-f0 li4 li100 move-ptr sext-hi load-arg8 sext-lo
```

The instructions and hard-register roles are identical. `explainDiff`
classifies all remaining differences as scheduling: 14 reordered independent
pairs, with no dependent or memory/control pair. GCC canonicalizes ordinary
statement permutations and equivalent arg2 expressions to the same RTL before
the scheduler. The memory-only barriers cannot directly impose dependencies
among these register-only instructions; register dependency barriers remain
forbidden by the clean-source policy.

The completed exact-tie tooling maps all 81 machine instructions through 85
final RTL instruction forms. It proves four zero-width forms: the three empty
memory barriers and the standalone return-value `USE`; an earlier parser
silently omitted `jump_insn/s`, which explained the old apparent 84-form
count. Baseline sched1 comparator replay is exact for block 0.

The counterfactual diagnostics did produce a structural improvement even
though the instruction score remains 72/81. Changing `arg3` from a narrow
formal to `s32`, applying the explicit `(s16)` conversion after `setSprt`, and
leaving the arg2 chain before the header stores relocates the arg3 conversion's
RTL birth without changing allocation or instructions 10–80. The target order
remains legal under the candidate DAG and reproducible with interventions, but
the minimum reported relation set falls from eight to seven. The current
source and `build/targetSchedule/func_80019070/` preserve this stronger state.

The suggested single-versus-multi-set experiment was also tested directly.
Argument reassignment, recasting, and dedicated normalization locals changed
early pseudo set counts but left the final sign-extension pair as fresh,
birth-boosted single-set webs. Reusing one wide temporary for both shifts did
remove the boost, but forced both instructions onto one hard register and
broke the solved allocation (`sll/sra` moved together instead of using `$a3`
then `$t5`). Thus birth-eligibility removal alone is rejected under the
preservation invariant. Moving the entire arg2 chain after `setSprt` reduced
the abstract relation count to three, but replay became `unsupported` because
three required selections were resource-blocked; per tool policy that is not
causal evidence, so the experiment was reverted.

The remaining clean-C problem is therefore the coupled priority/LUID shape in
the current seven-relation reproducible replay, not broad barrier placement or
a standalone multi-set arg3 web.

### Resume follow-up experiments

A later resume tested the remaining pointer/header suggestions directly against
the 72/81 baseline. A tied empty output on `ptr` did remove the pointer web's
single-set birth eligibility, but changed its allocation from `$t3` to `$t1`
and fell to 62/81. Adding `ptr` as an input to the existing header barrier had
the same allocation failure. Making the header length constant cross a tied
empty output swapped the two header registers (`li v1,4; li v0,100`) and fell
to 70/81; placing the code-constant tie before its store disturbed the broader
allocation and fell to 59/81. These outcomes reject register-dependency
barriers as both non-clean and unable to preserve the solved hard-register
assignment.

Two natural source alternatives were also rejected. A `u16 arg2` formal with
no explicit `& 0xFFFF`, together with direct reuse of `arg8` in the clamp,
compiled to the same 72/81 machine stream. Its different early RTL converged
by combine, and target-order replay became unsupported because the desired
normalization selection was functional-unit blocked; the seven-relation
reproducible `u32` baseline was restored. A two-arm branch that stores the code
byte in both arms crossjumped to the correct branch opcode shape, but swapped
the solved `$t6`/`$t7` assignments and reached only 69/81.

The first requirement-guided source-synthesis MVP run then derived and compiled
484 complete source classes (baseline plus 483 generated shapes) directly from
the target-schedule requirements. It covered dependency-preserving prologue
orders, declaration initializers, verified `setSprt` expansion, named header
constants, and typed pointer-copy combinations while retaining all three
barriers. GCC reduced them to only two assembly classes: 467 remained the exact
72/81 baseline class and 17 reached 70/81 while violating the preserved suffix;
none improved the function. Artifacts are under
`build/sourceShapeSynthesis/func_80019070/9e548cc09ea8139f/` and
`build/sourceShapeSearch/func_80019070/2636dabd3c3628f5/`.

### Next steps

1. **Target only a genuinely different pointer web.** UID 4 (`move t3,a0`) is a
   higher-priority competitor in most remaining relations. Fresh typed pointer
   aliases, their safe prologue placements, and combinations with header shapes
   are now automatically covered and compile back to the baseline class. A new
   hypothesis must make the pointer web genuinely multi-set or delay readiness
   through natural dataflow while preserving `$t3` and target indexes 10–80.
2. **Do not repeat ordinary header shapes.** Verified `setSprt` expansion,
   independent `setlen`/`setcode` orders, named `u8` length/code values, and
   combinations with safe initializers and pointer copies are covered by the
   synthesis run. Revisit a header constant only when trace evidence predicts a
   web or dependency relation outside those classes.
3. **Extend synthesis toward uncovered mechanisms.** The next useful catalog
   work is safe result/input reuse, non-overlapping local recurrence, and
   natural dependency/lifetime recipes tied to the seven replay relations—not
   more top-level statement orders. Per-variant schedule profiles are needed to
   select causal combinations when final assembly classes are equal.
4. **Inspect analogous sprite builders.** Search nearby functions for the same
   `setSprt`/`setClut`/`setRGB0`/`setUV0` sequence and compare signatures and
   prologue RTL. A repeated source idiom may reveal a pointer or header web
   structure outside the current synthesis catalog.
5. **Use the protected-barrier search mode.** Source-shape search now accepts the
   exact inherited empty barriers while rejecting edits that touch or add them,
   so future experiments can use the actual 72/81 baseline rather than a
   barrier-free control.

Do not resume broad statement permutations, arg2 expression searches, or a
standalone multi-set arg3 search unless new trace evidence changes the current
requirements.

Finite searches completed without improving beyond 72/81 included 210 front
statement orders, 24 primitive-store orders, 81 arg2 expression shapes, 48
initializer/declaration shapes, pointer/SPRT aliases, branch/result web forms,
840 split-barrier orders, and 1,680 additional barrier/order combinations.
Generated evidence is under `build/sourceShapeSearch/func_80019070/` and
`build/func_80019070/`.

The older sections below preserve the path from 12/81 through 59/81; their
"remaining" and "open directions" statements are historical where superseded
by this update.

## 1. The function and the target

Initializes two contiguous `Entry` structs (0x14 bytes each) and returns a
pointer 8 bytes past the second. 10 parameters (4 in registers, 6 on stack).
GPU primitive builder: `0xE100060E` is a GPU command word; the `0xFFFFFF` /
`0xFF000000` masks link the primitives through `*ptr`.

Target skeleton (81 insns) with the currently-matching regions marked:

```
 0: move t0,a1
 4: li   v0,4                 } block 0 front: MISMATCH
 8: li   v1,100               } (order only)
 c: move t3,a0
10: andi a2,a2,0xffff
14: sll  a3,a3,16
18: sra  t5,a3,16
1c: andi t6,a2,0xf
20: andi a2,a2,0xf0
24: lw   a1,32(sp)
28: sb   v0,3(t0)             } MATCHES from here
2c: sb   v1,7(t0)
30: lw   t7,36(sp)  (arg9)
34: lh   t4,16(sp)  (arg4)
38: lbu  a3,20(sp)  (arg5)
3c: lbu  t1,24(sp)  (arg6)
40: lbu  t2,28(sp)  (arg7)
44: sltiu v0,a1,6
48: bnez v0,54
4c: srl  a2,a2,4              ; delay slot: MISMATCH (we put move t3 here)
50: move a1,zero
54: lui  v0,0  / 58: addiu v0,v0,0      } MATCHES
5c: sll  v1,a1,1 / 60: addu / 64: lhu a0,0(v1)
68: sb   a3,4(t0) / 6c: sb t1,5(t0) / 70: sb t2,6(t0)
74: sll  a0,a0,6 / 78: ori a0,0x38 / 7c: sh a0,14(t0)
80: beqz t7,8c
84: li   v0,100               ; delay slot: MISMATCH (we put the sh here)
88: li   v0,102
8c: sb   v0,7(t0)             } MISMATCH (ours at 9c)
90: lui  a0,0xff / 94: ori a0,0xffff / 98: lui a3,0xe100
9c: sll  v1,t6,3
a0..140:                      } ALL MATCHES (incl. jr ra / addiu v0,t0,8)
```

## 2. Solved layer 1 — the arg2 chain (was: "combine eliminates truncation")

**Root cause of the old failure:** the previous in-place attempt computed
`temp_srl = arg2 >> 4` *before* the mask. The mask then had no consumer, so
combine correctly deleted it. The truncation/shift were never the problem —
the dependency order was.

**Target chain (exact source shape that works):**

```c
arg2 &= 0xFFFF;          /* andi a2,a2,0xffff — in place on $a2 */
temp_t5 = arg3;
temp_t6 = arg2 & 0xF;    /* andi t6,a2,0xf — reads truncated a2 */
arg2 &= 0xF0;            /* andi a2,a2,0xf0 — consumer is the shift, stays */
arg2 >>= 4;              /* srl a2,a2,4 */
```

- `arg2` must be **`u32`**, not `s32`. With `s32`, `>>=` emits `ashiftrt`
  and combine cannot flip it to `lshiftrt`, because `REGNO_NONZERO_BITS` of a
  multi-set pseudo is unknown. The target has `srl`.
- The multi-set arg pseudo gets a hard-register preference for `$a2` (its
  birth is the argument register) and greg assigns it there — confirmed by
  trace: pseudo 83 → `$a2`, sets 3, prefs [6].
- The mask is **not** redundant here: `(x & 0xF0) >> 4 ≠ x >> 4` for
  16-bit x (e.g. x=0x100), so combine must keep it. It only looked redundant
  when the shift was fed the pre-mask value.

## 3. Solved layer 2 — the allocation cascade (was: "ptr always gets $t2")

Two independent fixes, verified by `global.c`'s priority formula
(`floor_log2(refs) * refs * 10000 / live_length`, `find_reg` scans hard regs
in numeric order `$v0,$v1,$a0..$a3,$t0..$t9`):

**(a) `out = out + 1` in place instead of `Entry *next = out + 1`.**
The target has `addiu t0,t0,20` updating `$t0`, offset-0 accesses afterwards
(`lw v1,0(t0)`), and returns `addiu v0,t0,8` — not a fresh web
(`addiu a0,t0,20` / `addiu v0,t0,28`). Removing `next` also matches the
`(s32)out & 0xFFFFFF` computed into `$a1` before the increment.

**(b) `out->field_0E` statement BEFORE the three byte stores.**
This is the fix the old note declared impossible. Mechanism (confirmed by
compilerTrace report.json pseudo data):

- With byte-stores-first, sched1 places the `sb`s before the table-load
  chain, so the arg5/6/7 pseudos die *before* the local `$v1`/`$a0`
  allocations are born. No hard-reg conflicts → greg colors them `$v1`,
  `$a0`, `$a3` (numeric order) → `ptr` falls to `$t1`.
- With field_0E-first, the byte stores are scheduled after the table chain,
  so arg6/arg7's live ranges overlap the local `$v1` (index chain) and `$a0`
  (lhu result) allocations → hard conflicts block those regs → arg6→`$t1`,
  arg7→`$t2`, `ptr`→`$t3`, arg4→`$t4`, temp_t5→`$t5`, temp_t6→`$t6`,
  arg9→`$t7`, arg5→`$a3` — an exact match of the target's coloring.

The old note's claim "ptr's priority dominates regardless of pseudo count"
was true but irrelevant: the fix is not priority, it's the hard-reg conflict
set seen by `find_reg`.

## 4. Solved layer 3 — the branch shape for arg9

Target semantics: `var_v0 = 0x64; if (arg9 != 0) var_v0 = 0x66;` then store.
The delay-slot `li v0,100` executes on both paths; the `li v0,102` only on
the arg9!=0 fall-through. The if/else form compiles to the inverse
(li v0,102 default). Our source has the right shape; only the *placement* of
the `li` vs the `sh` around the branch is wrong (see §6).

## 5. Scheduler mechanics (verified against gcc-2.95.2 sources)

The vendored `gcc-2.8.1` tree is **not** the active compiler; the exact
2.95.2 sources were fetched from gcc-mirror/gcc (releases/gcc-2.95.2) and
the relevant parts are identical to 2.8.1.

**sched1 (pre-allocation):**
- Priorities are *flat*: `priority(insn) = max over predecessors of
  (priority(pred) + insn_cost - 1)`. ALU chains cost 1 → all 1. Only
  load-feeding edges give 2 (e.g. `lw a1 → sltiu`, `lhu → sll → ori → sh`).
- `LAUNCH_PRIORITY = 0x7f000001` boost: when an insn becomes ready,
  `adjust_priority` boosts it to `max_priority` if `birthing_insn_p` —
  dest REG is in `bb_live_regs` **and `REG_N_SETS == 1`**. Multi-set regs
  (arg2 ×3, var_a1 ×2, out ×2 after out++) and memory stores are never
  boosted. This fully explains every boost seen in our `.sched` dump.
- Tie-breaks (`rank_for_schedule`): priority, then class vs
  `last_scheduled_insn` (independent=3 > anti/output=2 > data=1), then
  **highest INSN_LUID** (chain order, not UID).
- `schedule_select` re-ranks equal-priority groups by R3000 FU hazards:
  loads win (`potential_hazard` scales with `unit_n_insns[memory]`), ALU
  insns use no unit and always lose. Stores have `max_blockage` 1 → no boost.
- The tool's model was validated by reproducing our exact sched1 block-0
  selection order insn-for-insn.

**sched2 (post-allocation):** `reload_completed` disables the birthing boost
entirely. The DAG gains hard-register anti/output deps (e.g. the `li v0,100`
depends on the `lui/addiu v0` table-address pair through `$v0`; the
`sll/sra a3` pair has anti-deps on `lbu a3,20(sp)`; the `sltiu` has an
OUTPUT dep on `li v0,4` and an ANTI dep on `sb v0,3(t0)` through `$v0`).
Block-0 ref counts extracted from `.sched2`:
73:7, 78:6, 6:4, 68:4, 71:3, 53:3, 12:3, 81:2, 62:2, 14:2, others 1.

**dbr (`reorg.c`):** pass order is `fill_simple_delay_slots` (own-block
backward scan) → `fill_eager_delay_slots` (target/fall-through threads).
Key eligibility facts:
- The MIPS `dslot` attribute makes **loads ineligible** for delay slots
  (type `load` ⇒ dslot=yes ⇒ fails `define_delay`'s `dslot=="no"`).
- The backward scan accumulates resources: a store is ineligible once any
  load below it has made `needed.memory` true; an insn is ineligible if it
  sets a register a below-branch insn references (e.g. `li v1,100` dies
  because `sb v1,7(t0)` below references `$v1`; the `sll/sra a3` pair is
  ineligible because `lbu a3,20(sp)` below sets `$a3`).
- Therefore the target's delay-slot `srl` simply has to be the first
  eligible insn above the branch: in the target everything below it
  (`lw a1`, the two `sb`s, the five stack-arg loads, the `sltiu`) is
  ineligible, so the scan takes the `srl` at forward position 9.
- Our output instead places `move t3,a0` (eligible) directly above the
  `sltiu`, so the scan takes it instead.

## 6. Remaining mismatches — precise statements

**(a) Block-0 front order (9 insns) + delay slot.** Target selection
(backward): `[82, 81, 40, 34, 28, 22, 46, 78, 73, 68, 65, 62, 59, 14, 12,
53, 4, 76, 71, 6]`. Ours (sched1): `[82, 40, 34, 28, 22, 46, 81, 14, 12, 4,
78, 76, 73, 71, 68, 65, 62, 59, 53, 6]`. The `srl` (65) must be selected
around T-11 (target) instead of T-16 (ours); the boosted set-once insns
(14/12/4) must *not* be picked at T-8..T-10. Sched2 then reorders again on
the hard-reg DAG (§5); the exact post-sched2 order is in
`build/compilerTrace/func_80019070/func_80019070.i.sched2`.

**(b) arg9 delay slot: `sh` vs `li v0,100`.** The `sh` (field_0E store) has
priority 2 (load-latency chain `lhu→sll→ori→sh`); the `li` has priority 1.
The `sh` is a ready sink at T-2 in block 2 (only dependent is the branch via
the init anti-dep), so it is *always* selected first and dbr's own-scan
always steals it. For the target, the `li` must be selected first (or the
`sh` delayed), which requires a DAG difference we have not found a legal
source shape for. Note the `li` additionally depends on the `lui/addiu v0`
table-address pair in sched2 (both write `$v0`), but that edge exists in the
target too.

**(c) `sb v0,7(t0)` position** (target 0x8c, ours 0x9c): a consequence of
(b)'s block-2/block-4 boundary ordering; the store ties with the
mask-constant `lui`s in block 4 and loses the hazard re-rank.

## 7. Source shapes tested this session (post-12/81)

| Shape | Score | Result |
|---|---|---|
| in-place arg2 chain (mask→shift order) + out++ | 37/81 | trunc/mask/shift all present; merge blocks fixed |
| + `u32 arg2`, `arg2 >>= 4` before the `if` | 43/81 | `srl` in delay slot (mask then landed early) |
| + `field_0E` before byte stores | **59/81** | entire allocation cascade fixed |
| `arg2 >>= 4` moved between statements (3 positions) | 59/81 | byte-identical output — block-0 order insensitive |
| `stores_first` (field_03/07 stores before arg2 chain) | 59/81 | byte-identical — LUID hypothesis dead for block 0 |
| `stores_first_srl_after` | 49/81 | worse: `move t3` still won the own-scan |
| ternary `out->field_07 = (arg9 != 0) ? 0x66 : 0x64` | 11/81 | RTL restructured (pseudo 158, setcc); ptr broke 11→10 |
| combo | 4/81 | rejected |

Fuzz artifacts: `build/fuzz/func_80019070/668d3c4b2bfc909f/` (manifest +
pass traces). Earlier runs: `255b56db857e49a2`, `cecc035a886c9119`.

## 8. Open directions (ranked)

1. **Pull the `srl` down to forward position 9 in block 0.** It is selected
   at T-16 because its LUID (12) loses ties to `sb`(17/15) and `lw a1`(13).
   Its chain position comes from the statement order, which we proved
   insensitive — so the lever is a *dependency* change: e.g. making the
   `srl` ready later/earlier via where `arg2 >>= 4` lands relative to the
   `var_a1 = arg8` load in the post-combine chain, or a source shape that
   removes the `li`/`sb` insns' readiness advantage (they are set-once and
   boosted in sched1).
2. **Delay the `sh` in block 2 or boost the `li`.** The only clean lever
   found so far would be a source shape where the field_0E value does not
   come from an in-block load chain (impossible — the lhu must be in block
   2) or where the `sh` gains a dependent (e.g. a later in-block memory op).
   Alternatively an original-source structure where the `li v0,100` is at
   the branch *target* (if/else with dbr target-thread steal) — but that
   requires dbr's own-scan to fail on the `sh`, which it never does.
3. **Re-derive 2.95.2's exact `fill_slots_from_thread` behavior** for the
   arg9 branch (`mostly_true_jump` prediction decides target-vs-fallthrough
   order); there may be a CFG shape where the thread fill wins legitimately.

## 9. Cross-references

- gcc-2.95.2 sources (fetched): `sched.c` (birthing boost, rank_for_schedule,
  schedule_select), `reorg.c` (fill_simple_delay_slots, eligible_for_delay,
  MIPS `dslot` attribute in `mips.md`).
- `notes/research/func_8001E7DC-allocator-preference-battle.md` —
  allocator preference mechanics.
- `notes/research/func_8001B4E4-scheduler-allocator-resolution.md` —
  scheduler-allocator interaction.
- `prompts/c-style-guide.md` §5 — allocation and scheduling mechanisms.
- Trace artifacts: `build/compilerTrace/func_80019070/` (report.json has
  per-pseudo uses/sets/span/lifetimes/conflicts and scheduler decisions).
