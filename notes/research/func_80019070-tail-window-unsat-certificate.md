# func_80019070: tail-window UNSAT certificate

Date: 2026-07-30. Companion to the prologue research in
`notes/research/func_80019070-prologue-allocation-and-arg2-truncation.md` and
the prologue boost certificate
(`build/schedulerConstraint/func_80019070/5ec55253bb442227`).

## Claim

The final link window of `func_80019070` (target forward slots 0xec-0x140:
cursor advance, tpage length byte, both OT-link second halves, and the
delay-slot return `addiu v0,t0,8`) is unreachable by GCC 2.95.2 sched1 from
any candidate whose prologue produces `li v0,4` through inline assembly. The
hybrid's asm boundary is therefore forced from both ends, not a search
failure.

## The v0 seesaw

1. Prologue: `li v0,4 / li v1,100 / move t3,a0` at forward slots 2-4 require
   those values unboosted; every clean-C spelling keeps them single-set
   (boosted) or destroys the allocation. Certificate: `5ec55253bb442227`
   (UNSAT, boosts kept, exhaustive within <=3 phantoms). Hence v0 must be
   written by asm.
2. Tail: the target's backward cycle 2 picks the return `addiu v0,t0,8`
   (priority 0x1) over the final OT store `sw` (priority 0x5). That pick is
   only possible when the addiu carries the birth boost, which requires
   `REG_N_SETS(v0) == 1` function-wide before allocation. In the clean-C
   compile the return addiu is the only pre-allocation v0 set and the dump
   shows it boosted (`260 (7f000001)`); the tail schedules exactly. Any asm
   write of $2 - operand, clobber, or template line - adds a v0 set and the
   boost is structurally off.
3. Hiding the asm's v0 write from GCC (raw template write, no operand or
   clobber) restores the boost but makes flow believe v0 is free
   mid-function; the register allocator then moves the packet-advance
   temporary into v0 and the tail registers are wrong (probe O, 61/81).

## Certificate

`build/schedulerConstraint/func_80019070/443f5c7d072a871a` - status UNSAT.

- Baseline: probe `build/shrinkProbes/probeSAT.c` (72/81; slots 1-58 and the
  branch structure exact; asm prologue + asm loads, everything from the CLUT
  lookup through the first tag-link store in C). Model replay of its sched1
  block 4 (47 selections): 47/47 exact.
- Asserted order: the target's 47-slot backward order for block 4.
- Domain: 535 LUID/realizability relations, <=3 phantom copies from 8
  templates, exhausted at 23,065 assignments / 3,098 structural alternatives.
- Core: `cycle-2-priority-240` - "UID 240 cannot outrank higher-priority
  ready UIDs at target cycle 2. Desired priority 0x1; competitors 235=0x5."
- Reduction: the input freezes the 20 boost variables at baseline
  (`tail-window-inputs/boosts-frozen.json`). Neither UID 240 nor UID 235 is
  in `variableBoostUids` (240's boost is structurally off in this candidate),
  cycle-2 readiness is dependency-DAG-fixed, and no phantom copy is
  admissible at the delay-slot position, so the frozen variables cannot mask
  a satisfying assignment for the core conflict. Unreduced bounded runs
  (`6d23f62b6767f52d` at 2M, `b12b8f24d2b58c43` at 10M) reject every explored
  assignment with the same single first-failure conflict.

## Model fixes the certificate depended on (validated)

- `spliceSplitProducts` (`tools/agent/compiler-trace/scheduler-order.ts`):
  pre-sched splitter products (fresh UIDs for lui/ori constant halves) are
  spliced into the stage-input order at their deleted origin's chain position
  so their LUIDs reconstruct; unique-origin match by destination-register
  signature, fail-closed on ambiguity. Unit-tested.
- Ready-queue timing (`tools/agent/scheduler-constraint/model.ts`): released
  predecessors mature at `clock + cost` per sched.c `queue_insn` (the old
  `clock + cost - 1` made 2-cycle load latency a no-op), and
  `solveLuidForForcedOrder` now advances its clock through empty-ready stall
  cycles. Validated by the new 47/47 block-4 replay (previously 12/47) and by
  exact reproduction of the stored artifacts `27bcae5c880cf162` (SAT, 21/21),
  `5ec55253bb442227` (UNSAT, 21/21), `78a4fff2edfe3681` (SAT, 4,124
  assignments).

## Best structures short of the hybrid (for the record)

- `build/shrinkProbes/probeI1.c` / `probeSAT.c`: 72/81. Asm: 9-insn prologue
  window, 1-insn palette load, 5-insn parameter loads. C: everything else,
  including the hand-expanded first primitive link with pinned mask locals
  (`link_mask` $4, `tpage_word` $7, `sprt_addr` $5; `tag_mask` allocates to
  a2 naturally). Residual diff: the li-1/advance transposition and the final
  link cluster - the certificate window.
- Cutting the tail into asm anywhere between the UV stores and the end
  reshuffles the still-C mid-region (boundary perturbation, measured 41-67).
  The current hybrid's boundary (whole tail block in asm) is the earliest
  clean cut.

## Empirical laws reconfirmed while probing (dump receipts)

- C-side stack-parameter loads always hoist above a volatile mega-asm, into
  whatever registers are free; declared inputs pin the argument registers but
  do not stop the hoist.
- Pinned register vars allocate correctly but their hard-reg reads/writes
  perturb sched1 ties relative to the pseudo equivalents; 2-set constants
  (lui/ori pairs) are pin-safe because they are unboosted either way,
  single-set values are not.
- GCC 2.95 asm operand grammar: matching-digit constraints only work for
  output operands 0-3; `+r` is rejected; >10 operands rejected.
