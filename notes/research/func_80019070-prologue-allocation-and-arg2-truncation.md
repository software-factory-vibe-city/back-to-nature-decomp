# func_80019070 — remaining prologue scheduler-state mismatch

**Current status: 72/81 instructions (88.9%).** Instructions 10–80, register
allocation, both delay slots, and the former arg9 branch/store window match.
The only remaining differences are nine independent block-0 instructions at
indexes 1–9. The source comment in `src/func_80019070.c` links here, and the
current source retains three documented, policy-approved empty memory barriers
that preserve solved scheduling windows.

This note supersedes the longer chronological session log. It keeps the useful
history, failed mechanism classes, current compiler evidence, and the next
bounded experiment.

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

## Next step: one witness-directed variant batch

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
