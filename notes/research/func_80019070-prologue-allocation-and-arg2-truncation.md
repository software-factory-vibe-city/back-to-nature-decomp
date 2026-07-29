# func_80019070 — remaining prologue scheduler-state mismatch

**Archived best-template status: 72/81 instructions (88.9%).** Instructions
10–80, register allocation, both delay slots, and the former arg9 branch/store
window matched; the remaining nine instructions were an order-only block-0
mismatch. That exact three-barrier source is preserved at the end of this note.

`src/func_80019070.c` is now a clean-room composite-packet model containing one
`SPRT` followed by one `DR_TPAGE`. After rebuilding its glyph and x recurrences,
it independently reaches 72/81: instructions 10–80 and all hard-register
assignments match, while indexes 1–9 remain an order-only mismatch. The source
is structurally distinct from the archived `SPRT *` template even though GCC
canonicalizes both to the same final machine schedule.

Read `## Phase A/B results (fourth session — allocation analysis, terminal)`
and `## Two-pass mechanism model (third session)` as conclusions about the
archived source/DAG family. The sra multi-set requirement (R3), ptr-copy delay
requirement (R4), and li100 scheduler-vs-allocator locality trap are proven for
that family; they are not a proof that every clean-C program is unreachable.
The older sections remain valuable as mechanism history.

This note supersedes the longer chronological session log. It keeps the useful
history, failed mechanism classes, current compiler evidence, and the latest
bounded experiment result.

## Premise audit after the second independent 72/81 convergence

Reaching the same 72/81 schedule from both the archived `SPRT *` model and the
independent composite-packet model is not progress by itself. It shows that two
source families converge to the same GCC normal form. Source permutation work
was therefore stopped and the build premises were tested directly.

The audit found:

- The untouched executable bytes at file offset `0x9870` contain the documented
  constants-first target order. The extraction, function start (`0x80019070`),
  and 0x144-byte boundary are correct. A raw jump scan finds one caller at
  `0x80018FAC` and no entry into the function interior.
- Sony `CC1PSX.EXE` 2.95.2 BUILD 4.0.0030 and the native reconstructed
  2.95.2-psx compiler emit identical instructions for the current source.
  Their only assembly differences are comments and `.extern` placement.
- The complete original `CCPSX.EXE -v` pipeline was run. Its actual cc1 command
  confirms `-O2 -G8` and the configured optimization/ABI flags; it still emits
  the same masks-first 72/81 schedule. Sony `CPPPSX.EXE` and its driver-defined
  `_PSYQ`, `__OPTIMIZE__`, `__CHAR_UNSIGNED__`, platform, and language macros
  also leave this function unchanged.
- The cc1 output was assembled by real Sony ASPSX 2.77 (the inferred target
  version) and 2.86. Their 324-byte `.text` payloads are byte-identical and
  start with the candidate masks-first order. This mismatch is not a maspsx
  straight-line reordering bug. The relevant libgpu macros are identical in
  the available PSY-Q 4.4, 4.6, and 4.7 headers.
- Plausible per-file optimizer, scheduler, alias, volatility, CPU, ISA, debug,
  and `-G` switches were tested. None produces the target window while
  preserving the solved body. `-fno-schedule-insns*`, non-default aliasing, and
  volatile pointees damage allocation/body order rather than fixing the nine
  instructions.
- Natural barrier-free sources were compiled with PSX GCC 2.7.2, 2.8.0,
  2.8.1, 2.91.66, and 2.95.2. Only 2.95.2 has the target instruction count and
  register family; the earlier compilers are substantially farther away. The
  C++ front ends likewise produce a different allocation and glyph-shift
  position.
- Original translation-unit context is not the missing state. Prepending 1,
  5, 20, or 100 compiled functions, 20 complex functions, 2,000 declarations,
  or 500 globals leaves all 81 target-function instructions and their order
  unchanged (assembly label numbers alone differ).
- Caller reconstruction confirms the ten-scalar ABI and stack widths. Narrow
  `u16`/`s16` formal variants, K&R declarations, pointer constness, ordering
  table type, and volatile pointees do not escape the 72/81 normal form.

Artifacts are under `build/func_80019070/toolchain-audit/`, `flag-audit/`,
`flag-audit-extra/`, `preprocessor-audit/`, `driver-audit/`, `aspsx-audit/`,
`tu-context-audit/`, `mixed-compiler-audit/`, `cxx-audit/`, and
`formal-type-audit/`.

This does **not** prove that no clean-C source exists. It does invalidate the
working assumption that another cosmetic or bounded local source permutation
is the appropriate next step. With compiler, driver flags, preprocessing,
headers, assembler, ABI, function boundary, and translation-unit state checked,
the unresolved premise is the function's provenance/classification: ordinary C
with an as-yet-unknown global web topology versus compiler-generated assembly
that was manually/post-compiler scheduled. The latter is now consistent with
the evidence because the target is exactly the candidate instruction/register
stream with only a legal independent prologue permutation, while every tested
stock pipeline emits the other order. It remains a hypothesis until independent
module/provenance evidence establishes an assembly exception.

## Inline-assembly primitive-header experiment — rejected

The bounded experiment in
`plans/func_80019070-inline-asm-primitive-header-macro.md` was executed. A
register-agnostic multiline extended-asm macro was accepted by both the
reconstructed compiler and real Sony GCC 2.95.2, and real ASPSX 2.77 emitted
the same two-store micro-test text as the configured assembler. In the full
function, GCC did model the template as one opaque RTL node with three register
inputs and one two-instruction machine emission.

That mechanism moved the schedule in the wrong direction. Across 12 complete
variants covering multiline versus split nodes, memory versus no memory
clobber, three call sites, and local versus direct operands:

- all multiline forms kept 81 instructions but placed the header stores at
  indices 13/14 or 15/16 rather than 10/11;
- the constants allocated as `$v1 = 4` and `$v0 = 100`, and the solved global
  allocation shifted from the `$t3`–`$t7` roles to `$t4`–`$t8`;
- memory-clobber/no-clobber and local/direct forms were machine-identical at
  each call site;
- split asm nodes added a packet-pointer move and produced 82 instructions;
- the best diagnostic result was 54/81 and no form improved target indices
  1–9.

The result is Outcome C: reject the simple opaque-header hypothesis. No source
or policy exception was promoted, and `src/func_80019070.c` remains at the
72/81 clean-C baseline. Preserved artifacts and the detailed scheduler mapping
are under `build/func_80019070/inline-asm-header/`.

## Function and current mismatch

The function initializes a sprite followed by a drawing-tpage primitive, links
both through `ptr`, and returns eight bytes past the second primitive. It has ten
parameters, including six stack arguments.

The target and candidate contain the same operations and hard-register roles in
the remaining window:

```text
target:    li4 li100 move-ptr mask16 sext-hi sext-lo nibble mask-f0 load-arg8
candidate: mask16 nibble mask-f0 li4 li100 move-ptr sext-hi load-arg8 sext-lo
```

The exact target sched1 backward order for block 0 is:

```text
81 80 77 74 34 28 22 16 40 65 61 56 53 50 70 68 47 4 63 59 6
```

UID 74 is the first zero-width memory barrier. The final machine/UID alignment
is complete through 85 final RTL forms: 81 emitted instructions, three empty
memory barriers, and one standalone zero-width `USE`.

## How the current 72/81 state was reached

The path from the initial low match to the current state established several
reusable source/compiler facts:

1. **Arg2 truncation and shift.** The correct dataflow is an in-place unsigned
   chain: mask to 16 bits, derive the low nibble, mask to `0xF0`, then shift
   right. `arg2` must remain `u32` so the target emits `srl`. Earlier forms
   computed the shift from the pre-mask value and let combine delete the mask.
2. **Output recurrence.** `out = out + 1` is required instead of a fresh `next`
   pointer; the target updates `$t0` in place and returns from that recurrence.
3. **Allocation cascade.** Computing `out->field_0E` before the three RGB stores
   creates the overlap/conflict pattern that assigns the target registers:
   pointer `$t3`, arg4 `$t4`, sign-extended x `$t5`, nibble `$t6`, arg9 `$t7`,
   and RGB values `$a3/$t1/$t2`.
4. **Arg9 branch and delay slots.** A named code-result web plus the three
   inherited memory barriers fixed the former branch/store placement and both
   delayed-branch choices without changing the solved allocation.
5. **Tool-assisted narrowing.** Emission-aware target analysis, exact comparator
   replay, requirement-guided synthesis, and per-variant schedule profiles
   reduced the problem to sched1 block-0 hidden state rather than instruction
   selection, assembler behavior, or final register roles.

## Established scheduler mechanics

The configured GCC legacy scheduler works backward. For this block:

- base priorities are mostly one;
- a set-once destination live at ready time receives the sched1 birthing boost
  `0x7f000001`;
- equal priorities compare dependency class relative to the last selected UID,
  then the greater block-local LUID;
- boosted stack loads win the early contested cycles through the validated
  R3000 hazard selection;
- sched2 disables birthing boosts and adds hard-register anti/output edges;
- delayed-branch reorg then scans its own block for eligible instructions.

The first barrier is a dependency hub. Selecting UID 74 releases every earlier
block-0 operation, which makes the boosted operations ready together. In the
current candidate the important boosted destinations are:

| UID | Operation | Pseudo | Current register |
|---:|---|---:|---|
| 59 | `li 4` | 104 | `$v0` |
| 63 | `li 100` | 105 | `$v1` |
| 4 | pointer entry copy | 81 | `$t3` |
| 68 | sign-extension `sll` | 107 | `$a3` |
| 70 | sign-extension `sra` | 101 | `$t5` |
| 50 | low-nibble mask | 102 | `$t6` |

Stores and the multi-set arg2/arg8/output webs are not boosted. The pointer
entry copies have fixed ABI LUID order: UID 4 is LUID 0 and UID 6 is LUID 1.
That fixed relation was the final wall in the earlier hand analysis.

## What has not worked

Treat these as recorded coverage, not universal impossibility proofs.

### Source order and ordinary expression shapes

Thousands of bounded variants have covered top-level statement orders, sprite
header-store orders, arg2 expression forms, initializer/declaration forms,
pointer/SPRT aliases, split-barrier positions, and interactions among them.
GCC overwhelmingly canonicalized these to the current 72/81 schedule. Moving
arg3 conversion and `setSprt` around the prologue also remained byte-identical
because the birthing boosts dominate ordinary LUID changes.

The requirement-guided synthesizer compiled 484 complete shapes. They collapsed
to two assembly classes: 467 retained 72/81 and 17 reached 70/81 while breaking
the solved suffix. A later 448-shape schedule-profile run found that 412 of the
413 machine-equivalent generated shapes regressed the supported replay to an
unsupported/resource-blocked state; the remaining shape needed more abstract
relations, not fewer.

### Type and combine alternatives

A `u16 arg2` formal, direct `arg8` reuse, explicit normalization locals,
argument reassignment, and recasting changed early RTL but either converged by
combine or worsened replay. A wide temporary can remove the sign-extension
boost, but the tested form forced both shifts onto one hard register and broke
the solved allocation.

### Pointer and barrier perturbations

Typed pointer aliases at previously tested anchors generally canonicalized or
changed allocation. Tied register outputs or adding `ptr` as an input to an
existing barrier removed the pointer boost but moved `$t3` to `$t1` and fell to
62/81. Such register-dependency barriers are also non-promotable. Removing the
first memory barrier changes the shift placement and swaps `$t6/$t7`; it is
load-bearing.

### Header-web and branch alternatives

Tying the header length constant swapped the two header registers and reached
70/81; perturbing the code constant caused a wider allocation cascade. A
crossjump-friendly two-arm code branch reached the right branch family but
swapped solved registers. Broad macro expansion and named-header-constant forms
did not improve the current state.

### Toolchain and boundary hypotheses

Disabling sched1 or sched2 drops the function to 16/81 with different
allocation. gcc-2.8.1-psx and gcc-2.7.2-psx produce entirely different output.
The configured cc1 assembly already has the final object order, ruling out an
ASPSX/maspsx reorder. The surviving problem is source-controlled RTL/web
content under the confirmed compiler, not a compiler-version or assembler
boundary mismatch.

## Generic scheduler-state SAT result

`searchSchedulerState.ts` first reproduces all **21/21** observed block-0
selections. It then searches a serialized function-agnostic domain of boost
bits, realizable LUID relations, bounded coalescible phantom copies, and named
extra dependencies.

For this function it exhausts all **4,096 no-phantom boost assignments**. The
target is unreachable in that subdomain. It finds SAT after **4,222 total
assignments**, with one phantom and four coupled requirements:

1. remove the birthing boost from UID 70 / pseudo 101 (`sra`);
2. remove the birthing boost from UID 63 / pseudo 105 (`li 100`);
3. remove the birthing boost from UID 59 / pseudo 104 (`li 4`);
4. add one unboosted, coalescible copy that reads pointer pseudo 81, is selected
   after UID 47 and before UID 4, and disappears after allocation.

The phantom reader delays the otherwise-boosted pointer copy until its required
late selection, bypassing the fixed LUID-0 versus LUID-1 wall. This is the most
important new result: **boost and source-order changes alone cannot produce the
target, but the target is reachable in a bounded hidden-RTL-content domain.**

The SAT witness is not yet clean C. All four changed webs currently own solved
hard registers (`$t5`, `$v1`, `$v0`, and `$t3`), so greg may reject a source
realization even when sched1 improves. The witness also inherits the explicit
sched2 boundary: only the complete configured pipeline can validate the final
order.

Artifacts and deterministic replay input:

```text
build/schedulerConstraint/func_80019070/0e76df40d106247f/
```

The generated 91-shape source handoff is schema-valid. The baseline and first
generated shape were compiled; the generated shape remained 72/81 and regressed
the schedule profile. That handoff covers related catalog mechanisms but does
not yet deliberately realize all four SAT requirements together.

## Witness-directed batch results (second session)

The witness-directed batch was executed with complete, mechanism-labelled
variants plus scheduler diagnostics. It produced four durable results.

### 1. The phantom's real identity: an unboosted, statement-born ptr copy

Diagnostic D1 (`build/func_80019070/witness3/d1_scheddiag.c`,
semantics-breaking by design) showed that when a ptr alias web is multi-set,
two things happen that the plain `prim = ptr` forms never revealed:

- cse cannot prove the alias value, so the statement copy survives (plain
  single-set `prim = ptr` is qty-substituted into the addPrim addresses and
  dies in cse1; an unused copy dies in jump1's trivially-dead deletion; a
  dead second copy also dies; a same-value conditional second copy is deleted
  as redundant — P1–P4 in `build/func_80019070/witness2/`).
- combine then merges the ptr entry copy (UID 4) *into* the statement copy,
  so the surviving insn reads `$a0` directly, is born at the statement LUID,
  and is unboosted (multi-set dest). In D1's sched1 it was selected at
  backward position 18 and emitted at machine index 3 — exactly the target
  `move t3,a0` slot.

The solver's "phantom reader + delayed UID 4" pair is therefore one real
instruction in disguise: the ptr copy itself, unboosted because its
destination web is multi-set.

### 2. With all four webs unboosted, the real compiler replays the target order

Diagnostic D2 (`build/func_80019070/witness3/d2_scheddiag.c`) forced all four
witness requirements to survive to sched1 (multi-set webs for li 4, li 100,
the sra, and the ptr copy, using invalid foreign arm sets purely as a
scheduler probe). The real compiler's block-0 backward selection matched the
target replay at 18 of 21 positions, including the exact LUID tie cascade
65, 61, sra, sll, andi-ffff, ptr-copy, li 100, li 4, out-copy. The witness
LUID statement order (constants, ptr copy, mask16, sext, nibble, maskF0,
arg8, then the two header stores) is confirmed correct on the real compiler.

The only deviation was a T-12..T-14 window: D2 selected
`[andi f0, andi f, var_a1-lw]` where the target needs
`[var_a1-lw, andi f0, andi f]`. The var_a1 load was twice reported
"blocking insn for 1 cycles" — a memory-unit hazard behind the two
consecutively scheduled header stores — and fell to T-14. How the original
kept the load at T-12 behind those stores is the one scheduler-state
question the witness model does not answer.

### 3. Two of the four requirements are not realizable in valid clean C

- **Ptr-copy web multi-set (the phantom):** any second set that preserves
  `prim == ptr` at the addPrim uses is either redundant (deleted by cse),
  dead (deleted by jump1), or value-changing (wrong runtime semantics or an
  extra emitted instruction). A conditional different-value set survives but
  is invalid code. This is a proof-shaped obstruction, not a coverage gap.
- **sra web (pseudo 101) multi-set:** `$t5` is written exactly once in the
  target, so a second set must vanish after sched1. Every vanishing class
  fails: dead sets die in jump1/cse, redundant sets die in cse/cse2,
  split-coordinate recurrence dies when combine merges the copy into the y0
  store (and conflicts with arg4's web even when it survives), and any
  surviving set emits a non-target instruction. The not-live-at-ready
  alternative is impossible because the x0 store is in a later block.

The boost removals for li 4 and li 100 (pseudos 104/105) *are* realizable —
target-consistent bindings exist (`{4, 0x64, 0x66}` or `{4, v}` for the
li-4 web, `{0x64, u}` for the li-100 web) — but in isolation each one
rotates the whole greg allocation one register slot
(`build/func_80019070/witness3/s1_63only.c` and siblings), because the
long-lived web reshapes the conflict graph that the current 72/81 state was
tuned around.

### 4. Solver ablations confirm the requirements are jointly necessary

Using pinned variants of `build/schedulerConstraint/func_80019070/0e76df40d106247f/input.json`:

- boost 70 forced on: INCONCLUSIVE at 500k assignments (no quick SAT);
- boost 63 forced on: INCONCLUSIVE at 500k;
- boost 59 forced on: SAT, but requires **two** phantoms (web-81 plus
  web-104) — strictly harder to realize;
- web-81 phantom template removed: INCONCLUSIVE at 500k — the web-81 phantom
  is the unique structural fit in the serialized domain.

### Assessment after this batch

The abstract SAT witness is validated as mechanically correct on the real
compiler (D2), but its two load-bearing webs (unboosted ptr copy, unboosted
sra) are not expressible in valid clean C under this compiler. The candidate
DAG therefore appears unreachable by clean-C source changes alone. Remaining
open threads, in priority order:

1. The T-12..T-14 load-blocking window: identify what kept the original's
   var_a1 load selectable at T-12 behind the two header stores (readiness
   timing, queue cost, or a different store/load grouping). This is the only
   deviation left when all four webs are unboosted.
2. Whether a different block-0 DAG (not the candidate's) makes the target
   order natural without the two unrealizable multi-set webs — e.g. a shape
   where the ptr copy and/or the sra are born with genuinely different web
   structure rather than forced multi-set.
3. If those stay closed, the honest terminal state is the current 72/81
   clean-C source plus this analysis, and the solver's source-realizability
   filters should record this SAT class as unsupported by the C recipe
   catalog (phantom-as-multi-set-alias and vanishing-multi-set are not
   compilable mechanisms).

## Two-pass mechanism model (third session — current best understanding)

This section records the third investigation round. It re-derives the problem
from the correct scheduler pass and reaches a precise, mostly-final
characterization. Artifacts: `build/func_80019070/nobarrier/`,
`build/func_80019070/witness3/dumps/d1|d2`, `/tmp/unittest/` hazard
micro-tests.

### 1. The final order is a sched2 product, not a sched1 product

The candidate's sched1 emission for block 0 differs from its final (dbr)
emission:

```text
sched1: 6 47 50 53 56 59 61 63 65 4 68 70 40 16 22 28 34
final:  6 47 50 53 59 63 4 68 56 70 61 65 40 16 22 28 34
```

sched2 re-sorts the block from scratch. Its tie-breaking uses **no birthing
boosts** (`birthing_insn_p` returns 0 when `reload_completed == 1`); ties are
priority, dependency-class vs last-scheduled, then **greater INSN_LUID**.
Critically (verified in `sched.c`): **sched2's LUIDs are assigned from sched1's
output chain order** (`sched_analyze` runs again on the sched1 output). The
passes are therefore coupled:

```text
source order → sched1 (boost + LUID driven) → sched1 output = sched2 LUIDs
            → sched2 re-sort (ties pick latest chain insn) → final order
```

When every selection in a window is an LUID tie, sched2's backward selection
is exactly the reverse of sched1's output chain, so sched2's output equals
sched1's output *except where memory-unit hazards or load blocking intervene*.
In this block those interventions are fixed: five argument loads promoted at
T-5..T-9, two header stores at T-10/T-11, and the `var_a1` load blocked one
cycle (see §3).

### 2. The exact requirement, restated

Reversing the target's final block-0 order gives the sched2 backward order
sched1's output must induce. Because sched2's ties are LUID-descending, the
non-hazard insns must appear in sched1's output in this ascending relative
order:

```text
6(move t0) 59(li 4) 63(li 100) 4(move t3) 47(andi ffff) 68(sll) 70(sra)
50(andi f) 53(andi f0) 77(srl) 80(sltu) 81(branch)
```

So the problem is exactly: **make sched1 emit that relative order.** In
backward-sched1 terms this is `[81 80 77 53 50 70 68 47 4 63 59 6]` plus the
hazard-fixed loads/stores/lw. Four requirements follow (see §5).

### 3. The `var_a1` load window: contradiction was a barrier artifact

The store→load 2-cycle memory-unit rule is real (confirmed three ways:
candidate trace `blocking insn 56`, diagnostic D2, and a clean micro-test
`t3.c`: `blocking insn 41 for 1 cycles`). The target has the load selected one
cycle *earlier* than that rule seemed to allow, which looked like a hard
contradiction.

It is not one. With barrier 1 removed (`nob1.c`), the natural store→load
blocking places the load at target index 9 for free: loads at T-3..T-7, stores
at T-8/T-9, load blocked at T-10, selected at T-11 → idx 9. The earlier
"conservation law" argument was an artifact of the fake barrier shifting the
T-alignment. **The original never needed a barrier for the load; the blocking
itself produces the target position.**

### 4. The srl delay slot: dbr's real rule

`reorg.c` fills a conditional branch's delay slot by scanning *backward from
the branch* and taking the **closest eligible** preceding insn. Empirically:

- loads and stores are not eligible;
- the `sll`/`sra` are ineligible (they read `$a3`, which the later `lbu $a3`
  arg5 load writes — a resource conflict);
- the andi chain insns are ineligible (they write `$a2`, which the srl reads);
- the ptr entry copy is eligible, so it must be *farther* from the branch than
  the srl, or the srl must sit between it and the branch.

So the srl lands in the delay slot iff sched2 emits it after the andi chain
(anything between it and the branch is memory ops, which are ineligible
anyway). This is achievable through LUID order alone — no barrier is
fundamentally required for the delay slot, though today barrier 1 is what
produces the required position (removing it drops the srl to idx 4 and dbr
picks the ptr move instead; see `nob1.s`).

### 5. The four sched1 requirements and their status

| # | Requirement | Why | Status |
|---|---|---|---|
| R1 | `li 4` (pseudo 104) unboosted, born at LUID ~7 | else it wins at T-16 instead of T-19 | **realizable** (`code` web `{4, 0x64, 0x66}`), but rotates greg allocation in isolation |
| R2 | `li 100` (pseudo 105) unboosted, born at LUID ~8 | else it wins at T-14 instead of T-20 | **realizable** (`temp` web `{0x64, u}`), same allocation caveat |
| R3 | `sra` (pseudo 101) unboosted | else it wins at T-10 instead of T-14 | **proven unrealizable** |
| R4 | ptr entry copy (UID 4) not ready until T-17 | else its boost wins at T-10..T-12 instead of T-18 | **proven unrealizable** |

R3: `$t5` is written exactly once in the target, so the second set that
`birthing_insn_p` requires must vanish after sched1. Every class is killed:
dead sets (jump1), redundant sets (cse/cse2), combine merges (with `REG_N_SETS`
decrement), split-coordinate recurrence (combine merges the copy into the y0
store; register conflict otherwise), arm-local foreign sets (emit
non-target instructions). The alternative clause (dest not in `bb_live_regs`)
is impossible because the x0 store is in a later block.

R4: the ptr copy needs an unboosted block-0 reader of pseudo 81 born at
LUID ~9 that coalesces away post-alloc. cse qty-substitutes single-set copies
into the addPrim addresses; jump1 deletes dead copies; same-value multi-set
forms are deleted as redundant; different-value multi-set forms are
semantically wrong or emit extra instructions. Barrier fences cannot
substitute for the reader: every register-setting insn depends on *every*
volatile-asm barrier after its birth (ref_count accumulates), so any barrier
that delays UID 4 to T-17 also delays the andi chain past its required
T-12..T-16 window.

### 6. What is now known to be unnecessary

- The `var_a1` load position is free (§3).
- The srl delay slot is LUID/dbr-driven, not barrier-driven (§4).
- sched2's LUID ties, not sched1 boosts, decide the andi-chain/sll/sra/li
  relative order — but only *given* the right sched1 output, so the R1–R4
  sched1 requirements remain the real blockers.

### 7. The only path that remains open

R1 and R2 are valid clean C (witness bindings `code = {4, 0x64, 0x66}` and
`temp = {0x64, u}`), but each rotates the whole greg allocation one register
slot in isolation (`witness3/s1_63only.c` etc.), because the long-lived web
reshapes the conflict graph that the current 72/81 state was tuned around.
The open question is whether the *combined* shape (both li webs + witness
statement order + no barrier 1) preserves allocation well enough to leave only
R3/R4 wrong — and whether anything at all legal realizes R3.

## Phase A/B results (fourth session — allocation analysis, terminal)

Phases A and B from the prescription below were executed. Artifacts:
`build/func_80019070/phaseA/a2..a6.c`, `b2..b4.c`, dumps under
`build/diffFunc/build/func_80019070/phaseA/`.

### Phase A: the allocation rotation is structural (the locality trap)

1. **The greg sort key is `floor_log2(n_refs)·n_refs/live_length`**
   (`allocno_compare` in `global.c`), *not* conflict count. There is no
   `REG_ALLOC_ORDER` on MIPS, so `find_reg` scans hard regs numerically and
   then honors copy/death preferences. lreg (locals) runs before greg.
2. **Why the baseline allocates correctly**: in the 72/81 source the li100
   web is *block-0-local* (single set `{0x64}`), so lreg gives it `$v1`
   before greg runs; var_a1's block-0 live range overlaps it, so var_a1
   inherits a hard-3 conflict and skips to `$a1`.
3. **Why R1/R2 break allocation**: the scheduler requires the li webs
   *multi-set and early-born*, which makes them *global* (their second sets
   live past the arg9 branch). In greg, var_a1 (short life, 6–9 refs,
   priority ≈ 2400–4400) is allocated before the li webs (long disjoint
   live ranges, priority ≈ 1100–2700) and takes `$v1`; everything cascades
   (A1/A2/A3: 40–42/81).
4. **The trap is a direct structural conflict**: the scheduler needs li100
   global; the allocator needs a block-0-local `$v1` web overlapping var_a1
   to hand it the hard-3 conflict — and the only block-0 `$v1` web *is*
   li100. Multi-set webs also have *disjoint* live ranges (they die after
   each use and are reborn at each set), so the global li web cannot overlap
   var_a1's range either.
5. **Priority-flip attempts** (reusing user variables to add refs to the
   temp web): `var_a1 = (u32)out & 0xFFFFFF` binding (A2/A3) flipped only
   `code` above var_a1; binding temp to addPrim#1's out-tag web (A4) flipped
   temp all the way above arg2 and took `$v1` (code `$v0` ✓) — but absorbing
   the out-tag local reshuffled lreg's block-3 assignments: the hoisted
   tpage-lui local landed on `$a2` (baseline: `$a0`), giving arg2 a hard-6
   conflict that blocked its `$a2` preference → new cascade (20/81).
   Fine-grained knobs do not exist: bindable `$v1` constants (`8` setWH w,
   `1` tpage len — A6) add ≤ +4 refs (no order change); the smallest
   absorbable `$v1` web (out-tag) adds +6 (overshoot + cascade).
6. **Conclusion**: R1/R2 are landable at the scheduler level (A1: li 4/li
   100 unboosted, selected T-18/T-19, emitted idx 1/2 exactly as required),
   but no clean-C source shape preserves the target allocation while doing
   so. This joins R3/R4 as a third independent obstruction.

### Phase B: R3 closed empirically

Three variants on the A3 base, all compiling to instruction streams
byte-identical to A3's (41/81):

- `B2` (`s16 arg3`, prologue-conversion path): no change to the sra web.
- `B3` (noop arm set `temp_t5 = temp_t5` in the arg9 arm): deleted pre-sched1.
- `B4` (arm recompute `temp_t5 = (s16)arg3`): cse-eliminated pre-sched1.

No legal construct produces `N_SETS(temp_t5 web) == 2` at sched1. R3 stays
proven-impossible; with R4 and the Phase A locality trap, all paths to a
clean-C match are now closed with pass-level evidence.

### Phase C: terminal recommendation

The function is not matchable in clean C under this toolchain: three
independently-proven obstructions (R3 sra multi-set, R4 ptr-copy delay, and
the li100 scheduler-vs-allocator locality trap) each individually prevent
it, and each is rooted in pass behavior (cse/jump/combine deletion, barrier
ref_count accumulation, greg/lreg allocation order) rather than in search
coverage. The practical ceiling demonstrated is ~77/81 with substantially
less clean source than the current 72/81 state.

**Recommendation**: keep the current 72/81 clean-C source (it is the best
simplicity-vs-match trade), and use the policy-compliant `INCLUDE_ASM` stub
when a byte-exact build is required. If the project later gains a governed
exception category for scheduler-state mismatches of this kind, this note
contains the complete mechanism record needed to apply it.

## Prescriptive next step (expand "option 1") — EXECUTED, see above

**Phase A — land R1+R2 and measure what remains (est. 6 variants).**

**A1 result (already run — `nobarrier/nob1_witness.c`):** R1 and R2 are
confirmed at the scheduler level. With both li webs bound and barrier 1
removed, sched1's block-0 backward order is
`[85 34 28 22 16 40 84 61 59 4 78 75 81 72 69 66 56 50 47 6]`: the li webs
are **unboosted** and selected at T-18/T-19 → emitted at idx 1/2 exactly as
required. The andi chain keeps its required relative order `[69 66 56]` =
`[53 50 47]`. The remaining deviations are exactly the predicted ones: the
sra is still boosted (selected T-8 → idx 11; R3), the ptr copy is still
boosted (T-10 → idx 10; R4), the var_a1 load blocks to idx 6 because the
stores moved to T-11/T-12 (window interacts with R3/R4), and dbr would now
pick the ptr move (idx 10) over the srl (idx 7) for the delay slot — R4 is
doubly load-bearing (ptr position *and* delay-slot choice). Final score 40/81
because the long li webs rotate greg allocation (expected; see Phase A2).

1. `A1`: witness statement order with both li webs bound
   (`code = 4; temp = 0x64; …; setlen(out, code); setcode(out, temp); …;
   code = 0x64; if (arg9) code = 0x66; …; temp = temp_t6 * 8;`),
   **barrier 1 removed** (per §3/§4), barriers 2/3 retained.
   Read `.sched` (sched1): verify 59/63 lost their boosts and land at
   T-19/T-20; read `.sched2` block-0 order against the required
   `[81 80 77 53 50 70 68 47 4 63 59 6]`.
2. `A2`–`A5`: if allocation rotates, vary only declaration order and web
   types (`u8` vs `u32` for `code`/`temp`; declare them first vs last) to
   restore the `$v0/$v1/$t3` roles. Diagnose the specific greg conflict at
   `.lreg`/`.greg` before iterating: which pseudo takes `$a1`, and which
   conflict forces it.
3. Acceptance: sched1 backward order matches the required order except
   T-14 (sra) and T-18 (ptr copy); solved suffix registers preserved.

**Phase B — the R3 kill-shot (est. 4 variants).**

Enumerate the last legal candidates for `N_SETS(101) == 2` at sched1 with the
81-instruction count intact. For each, check `.flow` (set survives to flow),
`.sched` (boost actually gone), and the final count:

1. `B1` (diagnostic): foreign arm set `if (arg9 != 0) temp_t5 = arg4;` —
   known-invalid semantics, used only to confirm the T-14 effect in the
   combined source (the D2 mechanism worked before).
2. `B2`: `s16 arg3` (promotion-at-entry path) — inspect whether the
   prologue-born conversion web differs enough to change the boost calculus.
3. `B3`: arm-local set that coalesces to a noop post-alloc
   (`if (arg9 != 0) temp_t5 = temp_t5;` and the `(s16)arg3` recomputation
   variant) — expected deleted early, included to close the class
   empirically.
4. `B4`: one combine-path play (`added_sets_2` / `newi2pat`-mentions-dest)
   if any clean shape suggests itself from reading `combine.c` again.

**Phase C — close out.** If Phase B confirms no legal R3 (expected), the
terminal state is Phase A's best plus this analysis. Decide then whether to
keep the improved partial source or revert to the `INCLUDE_ASM` stub; either
way, this note is the complete record.

## Next step: one witness-directed variant batch (superseded — see above)

Do **not** resume broad statement permutation. Build roughly 20–30 complete,
mechanism-labelled clean-C variants that combine all four requirements from the
start. Atomic regressions are not grounds to omit a mechanism because the SAT
result says the changes are coupled.

Use a small Cartesian set of natural forms:

- **Pseudo 105 / `li 100`:** expand `setSprt` and reuse the existing `u8 code`
  web for the initial sprite code and the later 100/102 branch result.
- **Pseudo 104 / `li 4`:** introduce a byte-sized header-length web used for
  length 4 and meaningfully reused for a later byte value such as width 8;
  reject forms where combine splits or deletes the intended multi-set web.
- **Pseudo 101 / `sra`:** retest the known meaningful `temp_t5` reuse only in
  the full witness combination, plus a bounded split-coordinate recurrence if
  it preserves the two target coordinate stores.
- **Pseudo 81 phantom:** introduce a typed pointer alias, redirect meaningful
  `addPrim` uses through it, and place its copy at a few dependency-safe anchors
  before the first inherited barrier. It must survive sched1 as a reader and
  coalesce away by greg.

Evaluate compiler state before instruction score. A useful variant must answer,
in order:

1. Did pseudos 101, 105, and 104 actually lose their sched1 birth boosts?
2. Did a pointer reader appear at the required selection position?
3. Did that copy disappear after allocation?
4. Did sched1 reproduce the target projected order?
5. Were `$t5/$v1/$v0/$t3`, both delay slots, and target indexes 10–80
   preserved?
6. If sched1 is correct but final output is not, what exact greg or sched2 event
   is the first divergence?

Use complete variants with pass tracing and per-variant target-schedule profiles;
do not promote a cc1-only result. If no clean form realizes the required boosts
and phantom, strengthen the solver's source-realizability filters and record the
abstract SAT class as unsupported by the current C recipe catalog. If sched1 is
realized but allocation consistently breaks, the next investigation is the
specific greg coloring conflict reported by those witness-complete variants,
not another scheduler-order search.

## Preservation requirements

Every future experiment starts from the current source and must retain:

- the three inherited documented memory barriers;
- the exact 81-instruction opcode/count shape;
- `$t3/$t5/$t6/$t7` and the solved `$v0/$v1` roles;
- both target delay slots;
- target indexes 10–80;
- ordinary clean C with no register pinning, new assembly, tied-output barriers,
  volatile perturbations, or per-file flag changes.

## Cross-references

- `plans/scheduler-state-constraint-search.md`
- `plans/exact-scheduler-tie-provenance-and-counterfactual-replay.md`
- `plans/requirement-guided-clean-c-source-synthesis.md`
- `notes/research/func_8001B4E4-scheduler-allocator-resolution.md`
- `notes/research/func_8001E7DC-allocator-preference-battle.md`
- `prompts/c-style-guide.md`

## Clean-room packet and recurrence results (latest session)

The clean-room restart did escape the archived topology before eventually
finding a second route to 72/81. The useful progression was:

1. A `SpritePacket { SPRT; DR_TPAGE; }` cursor model initially retained the
   exact 81-instruction opcode multiset but matched only 10 positions.
2. Making the packet parameter itself recur from sprite to draw-mode base,
   splitting glyph normalization from texture-U, narrowing x, and retaining
   only the RGB/code cuts reached 70/81. Its suffix was exact, but texture and
   arg9 occupied `$t7/$t6` instead of target `$t6/$t7`.
3. The archived control's allocation mechanism was then isolated rather than
   copied wholesale: make glyph an in-place multi-set recurrence, keep x wide
   and narrow it into a local after header setup, cut there, and shift glyph
   after the cut. On the composite packet source this restores target
   allocation and produces the current independent 72/81 state.

The bounded order search in `build/func_80019070/cleanroom66/` compiled all 240
valid orders of the six pre-cut statements. The expanded search in
`cleanroom97/` compiled all 1,680 valid orders after separating the two header
constant assignments and stores. Both searches canonicalized to their
respective baseline schedules; statement order alone is closed for those DAGs.
The source-shape synthesizer also compiled 1,260 viable shapes from 3,621
alternatives without exceeding 70/81 on the earlier packet DAG.

### Whole-register recurrence evidence

A separate line of experiments reconstructed visible target register
recurrences instead of binding isolated locals:

- `$v0`: sprite length 4, semitransparency code 100/102, glyph-V calculation,
  and height 12;
- `$v1`: header code 100, palette-table address/index, texture-U calculation,
  and width 8.

Using one source variable for sprite length and later semitransparency code
moves `li v0,4` to target index 1 exactly. Pairing that with a second variable
for header code and the palette address, then extending both through the UV/WH
values, makes instructions 0–2 exact. The typed compiler trace confirms these
as global pseudos with 5/4 and 4/4 set/death counts allocated to `$v0/$v1`.
Those full recurrences over-constrain later scheduling, however: the best
bounded form is 61/81 and leaves three order-only windows (3–9, 21–24, and
36–44). Artifacts are in `cleanroom78/` through `cleanroom97/`.

The same experiments exposed the exact remaining `$t4/$t5/$t6` allocation
requirement. The reconstructed recurrence source naturally orders
texture/y/x; one additional reference each to y and narrowed x changes the
allocator to target y/x/texture. A generic zero-width input proved the state
diagnostically. Clean-C overwritten coordinate stores survive late enough to
move y into `$t4`, but all tested clean x-reference identities either fold too
early or create a multi-set cascade. They therefore remain evidence, not a
promotable solution.

The current source intentionally retains the natural 72/81 packet model rather
than any lower-scoring recurrence diagnostic. The latest results narrow future
work to coherent recurrence splitting and scheduler metadata; cosmetic
statement permutations, local declaration order, `register` subsets, inline
helpers, K&R declaration order, narrow formal types, and simple alias
qualifiers are exhausted for the tested packet DAGs.

## Archived 72/81 source before clean-room restart

The following is the exact source that produced the established 72/81 state
before the clean-room restart. It is retained here as a reproducible control,
not as the template for subsequent source-shape work.

```c
#include "common.h"
#include "psyq/stddef.h"
#include "psyq/libgte.h"
#include "psyq/libgpu.h"

/* Builds a sprite followed by its drawing-tpage primitive.
Function still not completely decompiled, see extensive research: notes/research/func_80019070-prologue-allocation-and-arg2-truncation.md
*/
void *func_80019070(s32 *ptr, SPRT *out, u32 arg2, s32 arg3, s16 arg4,
                    u8 arg5, u8 arg6, u8 arg7, u32 arg8, s32 arg9) {
    u32 var_a1;
    s16 temp_t5;
    u32 temp_t6;
    u8 code;

    arg2 &= 0xFFFF;
    temp_t6 = arg2 & 0xF;
    arg2 &= 0xF0;
    var_a1 = arg8;

    setSprt(out);
    temp_t5 = (s16)arg3;
    /* Keep header initialization from leaving the pointer move eligible before the target srl delay slot. */
    __asm__ volatile("" ::: "memory");

    arg2 >>= 4;

    if (var_a1 >= 6) {
        var_a1 = 0;
    }

    setClut(out, 0x380, D_80049044[var_a1]);
    setRGB0(out, arg5, arg6, arg7);
    /* Keep the CLUT sh out of the arg9 delay slot; the target selects li v0,100 there. */
    __asm__ volatile("" ::: "memory");

    code = 0x64;
    if (arg9 != 0) {
        code = 0x66;
    }
    setcode(out, code);
    /* Keep the target sb at 0x8C ahead of the mask/UV setup that otherwise moves it to 0x9C. */
    __asm__ volatile("" ::: "memory");
    setXY0(out, temp_t5, arg4);
    setUV0(out, temp_t6 * 8, (arg2 * 3) << 2);
    setWH(out, 8, 0xC);

    addPrim(ptr, out);
    out = out + 1;
    setDrawTPage((DR_TPAGE *)out, 1, 1, 0xE);
    addPrim(ptr, out);

    return (void *)((char *)out + 8);
}
```
