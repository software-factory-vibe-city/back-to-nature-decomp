# `ovl_11_func_800DCF10` — an implicit-`int` callee prototype poisons local-alloc

**Status:** matched, byte-verified 2026-10-07 (`psx_finalize_function` passed).
**Function:** `ovl_11_func_800DCF10` (ovl_11), 0x800DCF10, 0xDC bytes.

## Symptom

The clean-C draft was structurally exact and stable at **49/55 words** with a
single residual class: `alloc 3`, all in block 2, at the three `arg3` field
loads.

```
target     lhu v0,0(s1)  lhu v1,2(s1)  lhu a0,4(s1)
candidate  lhu v1,0(s1)  lhu v0,2(s1)  lhu v1,4(s1)
```

`psx_reverse_pipeline` put the residual at `greg` ("local-alloc / global-alloc
— the same values, allocated to different hard registers"); the scheduler replay
(`psx_analyze_target_schedule`) was exact for both `sched` and `sched2`.
Statement reordering, grouping the three loads before the stores, local
temporaries, and the derived source-space grammar all failed to move it
(`psx_search_residual_source_space` exhausted 12/12 with no exact candidate).
The `psx_residual_objective` scratch note was explicit that moving a statement
was not enough unless it changed the pre-allocation order.

## Cause

The declaration of `func_8001BFA8` was missing, so C89 gave it an implicit
`int` return while its real definition (`src/func_8001BFA8.c`) is `void`. The
implicit-int call therefore *set* `$v0` and marked it `REG_UNUSED`. In
`local-alloc.c` `find_free_reg`, a quantity does not use only its true
`[birth, death)` range: with `flag_schedule_insns_after_reload` and not
`SMALL_REGISTER_CLASSES` it first tries an extended range

```c
fake_birth = MAX (0, qty_birth[q] - 2 + qty_birth[q] % 2);
fake_death = MIN (insn_number * 2 + 1, qty_death[q] + 2 - qty_death[q] % 2);
```

The first field load (`reg 96`, actual `born 30 / dead 32`) got `fake 28..34`.
The third `func_8001BFA8` call sat at block-2 index `28`, and its dead `$v0`
was `post_mark_life`d at exactly that index. So the load's extended range
included the call's dead `$v0`, `$v0` was excluded from its candidate set, and
local-alloc took `$v1`; the shift then propagated to `$v0` and a reused `$v1`
on the other two loads.

Instrumented evidence (`build/localAllocationOracle/.../events.jsonl`):

```
find  block 2 qty 1 members [96] born 28 dead 34 available [3,4,...]   (excludes 2)
choose block 2 qty 1 hardRegister 3
find  block 2 qty 2 members [97] born 32 dead 38 available [2,4,...]   (2 now free)
choose block 2 qty 2 hardRegister 2
find  block 2 qty 3 members [98] born 36 dead 44 available [3,4,...]
choose block 2 qty 3 hardRegister 3
```

## Fix

Declare the callee with its real prototype (and let the call return no value):

```c
void func_8001BFA8(void *arg0, void *arg1);
```

With no implicit return there is no `$v0` set at the call, index 28 no longer
marks `$v0`, and the three loads allocate `$v0/$v1/$a0` — byte-exact 55/55.
`psx_callee_truth` had flagged the declaration as `[undeclared] func_8001BFA8 —
in scope: (none — C89 implicit int)` while corroborating the real `void(void*,
void*)` definition.

## Premise / conditional scope

- The fix is about the *declaration*, not the call count or the callee's body:
  any callee whose prototype is missing and whose definition returns `void`
  will add a dead `$v0` set the same way.
- The collision needs the fake-lifetime extension to reach the call. It is
  sensitive to the `[birth, death)` index: moving the first load one instruction
  further from the call would also avoid index 28. The byte-exact explanation is
  the specific witnesses above, not a general claim that every implicit-`int`
  callee rotates registers.
- If `SMALL_REGISTER_CLASSES` were set for the target, the fake-lifetime path is
  skipped and this particular mechanism would not fire.

## Evidence

- `build/localAllocationOracle/ovl_11_func_800DCF10/variants/work_800DCF10-c460b62130e3a3b0/`
  — `events.jsonl` (find/choose), `summary.txt`, `ovl_11_func_800DCF10.i.lreg`.
- `build/experimentLedger/ovl_11_func_800DCF10.jsonl` — every measured variant,
  including the `49/55 alloc 3` baseline and the exact result.
- `tools/vendor/gcc/2.95.2/src/gcc/local-alloc.c` — `find_free_reg` (`used`
  composition) and the `fake_birth`/`fake_death` block.
