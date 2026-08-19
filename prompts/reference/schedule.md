# Schedule residual — the same instructions, emitted in a different order

The owning pass is sched1 when the block's allocation also differs, and
sched2 when it does not — local-alloc runs between them and cannot observe
sched2. Confirm which before choosing a lever: a sched2 movement is a
*consequence* of an allocation difference, and statement order will not
reach it.

The levers that reach sched1 are RTL birth order, the number of times a
value is assigned, and added dependences.

Loaded on demand by `psx_reference`. Read the sheet for the pass the
pipeline reversal named, and only that one.

---

### When source-order changes do nothing

If both orders of a commutative source expression compile identically, a
compiler pass is discarding source order. Find the first dump where the target
shape is lost by comparing `.rtl`, `.jump`, `.cse`, `.combine`, `.regmove`,
`.lreg`, and scheduler dumps. Read that exact rule in the vendored GCC sources
before designing another shape.

A known address case occurs in CSE: a commutative operand whose pseudo has a
recorded constant-equivalent value, such as a symbol's `lo_sum` address, is
placed second. Reassigning a base variable and then adding an offset is exactly
the shape that triggers it. Defeat it with a fresh compiler address web inside
a natural array or struct-field expression—not by swapping source operands
again.

If `explainDiff.ts` cannot find archived assembly, continue with the exact diff
oracle. A diagnostic setup failure is not a source mismatch.

### Loop preheader order is decided before the scheduler

When a preheader's instructions come out in the wrong order and
`schedulerTrace` shows them **tied on priority**, the scheduler is not the
actor and no amount of source-statement reordering inside the loop body will
help. A tied block reproduces its incoming order exactly (the ready list sorts
by descending LUID and the block fills bottom-up), so the order was fixed
earlier. Trace it backwards through these three facts, in order:

- **Preheader order is the movable-list order**, and the movable list is built
  in insn-stream order as the loop body is scanned. The `.loop` dump prints the
  list with each entry's `moved to <uid>`; read it rather than guessing.
- **A hoist can be deferred to the second loop pass.** The desirability test is
  `threshold * savings * lifetime >= insn_count` (doubled if the register was
  already moved once), so a value whose only in-loop use is the very next insn
  can miss in pass one and move in pass two — which puts it *after* everything
  pass one emitted. Two hoists of the same expression in different passes are
  how a `lui`/`move` pair appears.
- **gcse-PRE inserts at the END of a block**, before its closing jump, so any
  original instruction in that block precedes the insertion. When PRE puts
  *several* values into one block they are emitted in ascending
  expression-hash-table index, not source order. This is why two loops with the
  same source shape can hoist the same pair of values in opposite orders.

The practical consequence: to place a computation *after* a PRE insertion in a
preheader, it must itself be PRE-relocated into that block, or live in a later
block that the loop scan reaches afterwards. Writing it later in the same block
does nothing.

### Hoisting out of a conditionally-executed block has a hard gate

`scan_loop` refuses to list a set as movable when the register is used outside
the set's basic block **and** the set is not guaranteed to run every iteration.
`maybe_never` becomes true at the first label or jump inside the loop and is
reset only by a virtual-top note at the outermost scan depth, so in practice
every block after the loop's first conditional is affected. The escape hatch is
that the register's **last use is in the same basic block as its set** — which
a flag computed at one point and tested at a later join does not satisfy.

So a loop-invariant value that must reach the preheader has to be either
computed in the loop's first block, or relocated there by PRE. If neither is
available, the value cannot be hoisted, and a variant that tries will lose the
recomputation cost every iteration.

### Lazy code motion places at the last block of a delay chain

PRE's placement is computed from transparency and anticipatability only — the
locally-available bitmap is not passed — and the "latest" set degenerates to
the delayed set. Read it as: the computation slides forward from the earliest
anticipated point until it reaches a block that computes it, or a join whose
other predecessor did not carry the delay (a loop head always stops it).
**Every block where the slide stops gets an insertion.**

That is the trap: a single-predecessor block between the loop top and the first
inner loop is a second stopping point, so the value is inserted twice, its
in-loop set count is no longer one, and the hoist that the whole shape was for
does not happen. When a PRE relocation "almost" works, count the insertions in
the `.gcse` dump (`PRE/HOIST: end of bb N`) before changing anything else — and
look for a one-instruction block to eliminate or to give its own occurrence.

### The movable list is not always in stream order

If a loop's first in-range instruction is an unconditional jump to a label
inside the loop, the scan starts at that label and wraps around to the loop top
afterwards, so the movable list — and hence the preheader — comes out in a
rotated order. This is the only source-reachable control over preheader order
that does not go through PRE. It requires the loop to be genuinely entered near
the bottom; the scan also rejects the loop outright unless its start is a real
label from before the pass.

### A stuck loop-adjacent residual: rewrite the loop idiom before modelling passes

When instruction count, opcode multiset, inventory, and web parity are exact
but residual words sit in or around a loop (preheader order, loop-bottom
order, an allocation swap whose pseudos live across the loop), run this
bounded batch BEFORE any scheduler-state search, allocator arithmetic, or
compiler-source reading — and immediately AFTER any such analysis that ends
in "the CFG must differ from this reconstruction". Each variant is one
compile; measure each with the strict index-by-index count.

For every loop overlapping the residual:

1. **Loop spelling**: guarded do-while ↔ `while` ↔ `for`. These are different
   pass-time experiments even when they emit byte-identical bodies — the
   while/for conversion adds the VTOP note, creates inits during loop pass 1,
   and changes which blocks exist at gcse time, which moves PRE insertion
   sites and live lengths.
2. **Direction**: if the target loop counts down, write count-up and let
   check_dbra_loop reverse it (see the period-priors section for the gates:
   signed `LT` exit test, non-negative bound for a `beqz` guard).
3. **Increment position**: `for (;;i++)` versus `while` with an explicit
   `i++` placed before/after the other trailing statements — this chooses the
   emitted slot of the (possibly reversed) step instruction.
4. **Bound type**: signed versus unsigned bound flips the exit-test relation
   (`LT`/`LTU`) and with it the reversal gate and the guard shape.
5. **Invariant site**: each loop-invariant flag or address computed at its
   use site ↔ at the loop top ↔ before the loop. Use-site placement is the
   only one PRE can relocate into the preheader, and PRE emits multiple
   insertions into one block in expression-hash order, not source order.

The whole lattice for one loop is a dozen compiles. A pass-modelling session
that skips it can prove a form unreachable inside the wrong frame — the proof
will be internally correct and aimed at source the original never contained.

### Array index the table read when a store-block load must drift to the top

Concrete version of the loop-idiom rewrite above, from func_8001A19C: an
order-only sched residual where a single-set (birth-boosted) load in a drain
loop's store block settles mid-block instead of at the top next to the call's
argument load. Identical instruction sets, only the load's slot differs, and
statement order inside the store block is provably inert — the scheduler picks
those stores by LUID and the block fills bottom-up, so rearranging the stores
is the same experiment every time.

  - Try **array indexing** (`D_80049070[i]`) before explicit walking pointers
    (`*tab` with `tab++` in the latch). Loop strength reduction births the
    indexed load at the induction top-of-block, which changes its scheduler
    ready/issue state exactly the way a late-born pointer deref cannot.
    This was the single load-bearing spelling; it went from 3 residual words
    to byte-exact with no other change.
  - **Read-through-global pins store-before-load and still folds to the direct
    offset.** `if (*D_8005E4A8 == 0xFFFE)` after `D_8005E4A8 = v + 1` emits
    `sw v0,E4A8` then `lhu v1,2(a0)` (the target order) while CSE collapses the
    global read back to `2(a0)` — no extra instruction. The bare `v[1]
    spelling alone lets sched2 hoist the load above the store. A matched
    sibling (func_8001A11C) reads through the global too.
  - **Web rewrites that do NOT work here** (all measured): a cross-block 2-set
    web de-boosts the load and fixes the block, but inherits an argument
    register at its birth and rotates the block's `$v0/$v1`; same-block web
    reuse is split into separate quantities by GCC and never drops the boost;
    a scheduler-state search cannot derive the order because it is a
    memory-unit issue-window property, not a priority/LUID ranking.

The absolute-addressed table read this idiom assumes is reproduced by
`extern u16 D_80049068[];` (incomplete-array) in the override header — unknown
size keeps `SYMBOL_REF_FLAG` clear so cc1 emits the split `lui/addiu` form; see
the declarations sheet. Case write-up: notes/retros/2026-08-19-func_8001A19C-retro.md.

### Observe the scheduler; do not model it

Every mechanism in the table above is *observable*. The legacy scheduler writes
its own per-cycle record — each insn's priority at the moment it competed, the
ready list it was chosen from, and the tie or hazard that decided it — into the
ordinary RTL dumps, with no extra flag. `psx_scheduler_trace` reads it. Run it
the moment a residual is classified as scheduling, before authoring variants.
`psx_reverse_pipeline` is what classifies it: run that first, so the trace is
read for a block the residual actually lives in.

Two facts that cost real time when assumed instead of checked:

- These projects schedule with the **legacy** `gcc/sched.c`, not
  `haifa-sched.c`. Both files define a `rank_for_schedule`, and the two are
  different functions with different tie-breaks. `sched.c` also schedules a
  block **bottom-up**: an insn that keeps losing priority contests drifts to
  the *top* of the block. Confirm which pass is live from the dump's own
  format before reading any compiler source; the option that configures the
  other scheduler's verbosity is rejected outright by this compiler, which is
  itself the confirmation.
- Source spellings that compile to the same RTL are the same experiment. A
  sweep over pointer, array, offset-local and cast address families is one
  data point, not four, whenever the families collapse to identical RTL —
  compare the pass dumps before concluding a hypothesis is exhausted.

When a model of the scheduler and the observed order disagree, the model is
wrong and the disagreement is the finding. Re-check which pass is running
before adding a correction to the model.

## 6. Scheduling barriers are a governed last resort

First exhaust statement order, operand order, natural expression structure,
expression birth sites, and allocation diagnosis. For a proven order-only
mismatch of independent instructions, project policy may permit a
zero-instruction barrier:

```c
__asm__ volatile("" : "=r"(value) : "0"(value));
```

It emits no target instruction but creates a dependency. Every barrier must
carry a comment stating the exact target-versus-compiler order it fixes and is
tracked debt.

For two absolute pointer loads where GCC interleaves `lui` pairs but the target
completes one `lui/lw` pair before starting the next:

```c
a = GLOBAL_A[0];
__asm__ volatile("" : "=r"(a) : "0"(a)); /* Complete A before loading B. */
b = GLOBAL_B[0];
```

For a prologue memory store stolen into a branch delay slot, a narrower memory
barrier may be appropriate after the mismatch has been proven:

```c
__asm__ volatile("" ::: "memory");
```

A barrier does not prevent CSE and is never a substitute for fixing types,
allocation, or an address web.

