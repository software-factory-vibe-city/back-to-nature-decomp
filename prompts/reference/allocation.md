# Allocation residual — the same instructions, in different registers

The owning passes are local-alloc and global-alloc. Allocation runs over
the sched1 order, so one value scheduled late displaces every quantity
after it: read the schedule term first and only treat allocation as the
cause once the order agrees.

A coalesced copy is an allocation decision, not a count delta.

Loaded on demand by `psx_reference`. Read the sheet for the pass the
pipeline reversal named, and only that one.

---

### Rapid path for an exact instruction set with a residual register rotation

When instruction count, opcode multiset, inventory, and web parity are all
exact, stop changing semantics. Census the target's simultaneous hard-register
roles, then preserve each independently demonstrated allocation gain even when
its raw match score is lower. A source family that fixes `$a2/$a3` while
rotating `$v0/$v1` has proved one required lifetime/occupancy relation; it is
not a failed experiment to discard. `psx_residual_objective` names this case
`traded` and reports the per-block exchange, so the gain is legible instead of
being argued for against a falling score.

The highest-yield clean-C axes at this stage are:

- a top-of-block declaration initializer versus a later assignment (the
  initializer is an executable birth site and is valid C89);
- one local reused for sequential roles versus two fresh locals;
- the birth order of independent bases, offsets, and pointer results; and
- a named constant assigned immediately before the independent copy/load it
  must precede.

Test these as interactions, not only one axis at a time. func_8001A574 required
all four: a declaration-born quotient, a product local overwritten with the
remainder, coordinated base/offset/pointer births, and a loop sentinel born
before the scan-pointer copy.

## 5. Allocation and scheduling mechanisms

Use these mechanisms to design source, not as reasons to hand-assign registers.
They were confirmed against the compiler sources used by the projects from
which these matching lessons were distilled.

| Mechanism | Source consequence |
|---|---|
| Local allocation requires one death | A local reassigned to independent values becomes a multi-death global web; fresh single-set values stay locally allocatable |
| Dying-input tie | A fresh output can share the register of an input that dies in the same instruction |
| Hard-register suggestion | A pseudo born where an argument hard register dies can inherit `$a0`–`$a3` |
| Priority uses references and lifetime; ties use birth order | Statement and expression birth order can change allocation |
| Global-allocno priority is computable by hand | It is `floor_log2(n_refs) * n_refs / live_length * 10000 * size`, truncated to int, ranked descending with the lower allocno number breaking exact ties. `n_refs` is the **sum of loop depths over the references**, function body 1 and each nesting +1 — so moving one reference in or out of a loop is worth a whole depth, and a two-way register swap is often a difference of one reference or a handful of live-length units. Compute both sides from the `.lreg` dump before hunting a source shape: it tells you exactly how much you need to move and which of the two pseudos is cheaper to move |
| Live length is overwritten by sched1 from the scheduled order | `schedule_insns` accumulates +1 per scheduled insn while a reg is live and writes it back to `REG_LIVE_LENGTH`, so with the emission fixed, a pseudo's live length is **pinned** — no source spelling with identical output moves it. When an allocno_compare inequality must flip, the lever is the competitor's stats (refs kept by flow for insns later passes delete, or a pass-time geometry change such as a converted loop), never the losing pseudo's own live length |
| Declaration initializers are executable births | `s32 q = x / 3;` at the top of a C89 block is not allocator-equivalent to declaring `q` and assigning it after the first statement |
| Sequential local reuse changes web population | Writing `tmp = q * 3; ...; tmp = arg - tmp;` can reproduce one recurring target hard-register role that separate product/remainder locals cannot |
| Fake lifetime extension with post-allocation scheduling | Moving a birth by one statement can create or remove a pseudo-conflict |
| Locality test: one block, one death | A variable set in two blocks is a global allocno; its register is chosen by conflicts with overlapping locals' hard registers (via `reg_renumber`), not by the local priority tie |
| Pre-allocation scheduler works backward | Independent source statements do not necessarily retain source order |
| Legacy scheduler ties use priority, last-scheduled dependency class, then LUID | Separate birth-priority changes from block-local source/RTL birth-order changes |
| A newly-ready insn is boosted only when its destination is assigned exactly once function-wide | Reusing one variable for two unrelated values silently removes that boost and reorders independent statements. When two independent initializers come out in the wrong order and their computed priorities tie, split the reused variable before touching statement order |
| A register copy is rewritten and eliminated when the immediately preceding insn defines its source | A copy the target keeps must not directly follow the statement that produced its source; an intervening statement is load-bearing |
| Distinct symbol bases may not alias | Stores through independently proven bases can reorder freely |
| Post-allocation scheduling sees hard-register hazards | A scheduling mismatch can be downstream of the wrong register allocation |
| CSE commutative constant-second rule | Source operand swaps can be no-ops; change the web/address family |

### Argument reassignment

Do not reassign an argument when the target keeps it in its incoming hard
register. A statement such as `arg0 <<= 1` forces an entry copy and reshapes
the scheduler ready list and allocator suggestion table. Compute the derived
value in a fresh temporary or inline at the first consumer:

```c
p16 = (s16 *)((char *)&D_HALFWORD_BASE + (arg0 << 1));
```

An inline repeated expression may be CSE'd into one value born at the first
consumer. Hoisting it to a standalone statement births it earlier. Match the
birth site shown by the target.

The reciprocal case is equally real, and the target's entry copies decide which
rule applies. A derived value in a **fresh local** is a new allocno that
inherits the argument hard registers as preferences (visible directly as
`;; NN preferences: 5 7` in `.greg`); if one of those registers is already
taken, the value lands elsewhere and the target's entry copy never happens.
Assigning back into the parameter keeps the value on the argument's own web,
whose only preference is its incoming register.

| Target shows | Source shape |
|---|---|
| the argument stays in `$a0`–`$a3`, derived value in a scratch register | fresh temporary, or inline at the first consumer |
| an entry `move` of the argument, then an in-place op on that copy | assign back into the parameter |

Reusing a parameter is not a hack; it is a statement about which web the value
lives on. When a residual is one or two argument copies plus a register
rotation, test it before reaching for allocator tooling — it is a
one-statement experiment.

### Allocation before scheduling

If an instruction moves only in post-allocation scheduling, first ask whether
the candidate has the wrong register web. Target hard-register read/write
hazards can pin an order that the candidate's allocation leaves independent.
Fixing allocation can fix scheduling without any source-order workaround.

The dependency runs the other way for the pre-reload pass, and mixing them up
costs sessions. Allocation runs *over* the sched1 order, so a block whose
instruction order and register assignment both differ is a sched1 problem with
an allocation consequence, and chasing the registers there is chasing a
symptom. `psx_reverse_pipeline` separates the two mechanically: a block with a
reordering and an allocation difference is attributed to `sched`, and a block
with an allocation difference and no reordering to `lreg`, where the lever is
the quantity's own priority — its reference count and live range.

### Operand and field order

Old GCC expansion follows expression-tree and statement structure closely
enough that source order is a useful first lever:

```c
result = a + b;  /* tends to load/expand a before b */
result = b + a;  /* tests the reverse birth order */
```

Likewise, read struct fields in the order the target loads them. If source
swaps have no effect, stop and attribute the canonicalizing pass rather than
continuing permutations.

