# Deterministic pipeline reversal

Answers one question: **which compiler pass owns this residual?**

The forward compiler is a composition of deterministic passes. Each one has a
preimage *set*, not a point, so this module runs a chain of canonical preimage
functions backward from the bytes, and represents the places where the preimage
is not a function as enumerated fiber sites.

The same chain runs over the original bytes and over the candidate object. A
difference between two waypoints therefore cannot come from the two sides having
been read differently, and the oldest waypoint at which they still differ names
the pass that introduced the residual.

```bash
npx tsx tools/agent/reversePipeline.ts <function>
npx tsx tools/agent/reversePipeline.ts <function> --source <path>   # compile and use that source
npx tsx tools/agent/reversePipeline.ts <fn...> --backtest           # perturb and check the verdict
```

Output goes to `build/pipelineReversal/<function>/{report.json,report.txt}`.

## The waypoint ladder

GCC 2.95.2's tail order, from the vendored `toplev.c`, is

```
sched1 → lreg → greg (reload) → flow2 → sched2 → jump2 → mach → dbr → final
```

Note that `jump2` runs **after** `sched2`, not before it.

| Waypoint | What is compared | What a difference means |
|---|---|---|
| `machine` | bytes | anything |
| `dbr` | instruction sequence with assembler-inserted words removed | anything |
| `mach` | instruction sequence with delay slots un-filled | scheduling or earlier |
| `greg` | value webs and the hard register each received | allocation or earlier |
| `lreg` | instruction population under register masking | the source computes something different |

## The inverses

**`g_assembler`** (`inverse-assembler.ts`) removes the words no RTL instruction
owns: `nop`s the MIPS-1 load delay forces, `nop`s filling a slot the compiler
left empty, and the second half of an assembler macro. It folds
`lui $d,%hi(S)` + `lw $d,%lo(S)($d)` — gas reuses the destination as its scratch
for a load macro and `$at` for a store macro — but never `-msplit-addresses`'s
`HIGH`/`LO_SUM` pair, where the two halves are real RTL instructions the
scheduler may separate. The register identity is what separates the two.

**`g_dbr`** (`inverse-dbr.ts`) un-fills delay slots against the real resource
model from `resource.c`: hard registers plus one memory flag, where a read is
only ever marked on the "referenced" side and a write only on the "set" side.
Four origins, each with its own witness:

- *own block* — `fill_simple_delay_slots` scans backward and takes the first
  conflict-free candidate, so the preimage is the earliest position at which the
  instruction is conflict-free and nothing after it is;
- *forward scan* — only ever for a `CALL_INSN`: the forward phase's eligibility
  test is guarded by `target == 0`, and `target` is set to `JUMP_LABEL (insn)`
  for every jump;
- *copied from a thread* — the slot duplicates an instruction that is still
  present, either at a label the branch was redirected one past, or just before
  the branch target;
- *moved from a thread* — nothing local explains the slot, so it came out of the
  successor that reads what it writes.

Two rules that are easy to miss and change everything: the machine description
admits only length-1 instructions into a delay slot, so a gp-relative access is
never a candidate; and a call does *not* reference memory with delayed effects
off — `case CALL:` in `resource.c` says so — which is why a store can and does
land in a call's delay slot.

**`g_alloc`** (`inverse-alloc.ts`) recovers value webs by reaching definitions
over the CFG. A call defines every caller-saved register, so no web crosses one;
arms of an indirect dispatch have no edge between them. Each web is one
pre-allocation pseudo, which is what lets the comparison say "same value,
different register" instead of "different register name".

## What the report says

`decisions` is the headline: the independent choices that account for the whole
residual, each with the source lever that moves it. Thirty webs in the wrong
register is usually one scheduling decision and twenty-nine consequences —
allocation runs over the sched1 order, so one value scheduled late displaces
every quantity after it, and `decisions.ts` folds the consequences under the
cause rather than reporting them as separate work.

A register-to-register copy that one side has and the other does not is reported
as a **coalescing** decision, not as a count delta: `jump_optimize` deletes the
no-op move that coalescing leaves behind, so the copy vanishes from the bytes
entirely. Reading it as an instruction-population difference would file an
allocation problem under source semantics.

`ambiguities` are the chain's own unresolved fibers. They are applied
identically to both sides, so they cancel in the comparison and are **not**
search space — acting on one would not change a byte.

## The objective

`objective.ts` turns the comparison into the number an iteration should
descend. `residualObjective.ts` is its CLI.

```
key = [control-flow, population, schedule, allocation]   lower is better
```

Compared lexicographically, in the order the passes run. Three properties the
byte score does not have:

- **decomposable** — every term belongs to a block, so a search can work one
  block and ignore the rest of the function;
- **staged** — allocation is last on purpose. It is downstream of the sched1
  order, so a variant that removes a transposition is making progress even
  while the registers are still wrong, and ranking allocation higher would
  reward freezing a wrong schedule into a lucky assignment;
- **zero exactly at a match** — every term is zero if and only if the two
  programs agree at every waypoint.

Excluded on purpose: transpositions the delay-slot inverse could have produced
on its own. A search that descends a number its own instrument invents will
chase noise, and this noise is systematic — every call whose slot origin is
ambiguous would contribute a spurious position.

`rankBlocks` gives the work order: population first, because nothing below it
can be read while the two programs contain different instructions; then by
payoff over difficulty, where payoff counts every block sharing the same
residual signature. A small block whose fix generalizes outranks a slightly
smaller one that stands alone.

Two verdicts exist because the ordering is a claim about causality rather than
a certainty. `traded` means a variant lost an earlier term and won a later one:
it is reported as a trade so a caller can keep it as a branch and see the
exchange rate, instead of having it folded into `worse`. `identical` means the
variant produced the same relocated words as the baseline — CSE collapses most
re-spellings of a value — so it is not a new experiment and a loop that counts
it as one never terminates.

## Validation

Two independent checks, because they answer different questions.

**Round trip** (`replay.ts`): run the chain over the candidate, whose true
waypoints the `-da` dumps record, and check the reconstruction is that waypoint.
Every reconstructed instruction must appear in the `.mach` RTL chain in order.
An RTL instruction with no counterpart is not a failure — `dbr_schedule` deletes
redundant instructions after the dump, and nothing in the bytes records an
instruction that was removed — but a reconstructed instruction with no place in
the chain is an inverse defect and is reported as one.

**Backtest** (`backtest.ts`): perturb a source that already matches in a way
whose stage is known in advance, and check the chain names it. Swapping two
independent assignments cannot change which values the program computes, so the
residual must be scheduling or allocation; changing a stored constant must be
the source. A perturbation that leaves the bytes identical is reported as
"no-effect" rather than counted as a pass.

## Limits

- A function containing inline assembly has no derivable emitted word count, so
  the round trip reports `unavailable` rather than a divergence it cannot
  substantiate.
- The `mach` waypoint conflates sched1 and sched2. When a block's allocation
  also differs, the reordering is present at sched1 — local-alloc runs before
  sched2 and could not otherwise see it — and the report says so; when it does
  not, sched2 alone is possible.
- The delay-slot origin is genuinely ambiguous at some sites. The chain records
  the fiber and annotates any scheduling difference small enough to be its own
  choice.
