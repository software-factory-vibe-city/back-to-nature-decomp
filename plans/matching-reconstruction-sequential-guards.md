# Fix: sequential guard statements blow up into a giant tree

**Status: proposed. This fixes the biggest problem in the general
control-flow constructor (`tools/agent/matching-reconstruction/control-structure.ts`).
Right now that constructor produces zero byte-exact matches, and this is why.
Read this whole file before touching code; it is written to be understood
without prior context.**

## The problem in one example

Take a real 56-byte function, `ovl_17_func_800B9CAC`. In the original game it
is just six independent checks, one after another:

```c
if (a->field1 < 255) a->field1 += 5;
if (a->field2 < 255) a->field2 += 5;
if (b->field3 < 255) b->field3 += 5;
if (c->field4 < 255) c->field4 += 5;
if (c->field5 < 255) c->field5 += 5;
if (c->field6 < 255) c->field6 += 5;
return c->field6 + 5;
```

Six `if` statements in a row. Nothing nested.

The constructor turns this into a **250-line nested tree with 64 branches**.
It takes the first `if`, and into *both* its "true" side and its "false" side
it copies everything that comes after. Then it does the same for the second
`if` inside each of those copies, and so on. Six `if`s copied this way is
2 × 2 × 2 × 2 × 2 × 2 = 64 copies of the tail. The output is enormous and looks
nothing like the six-line original, so the compiled bytes never match.

This shape — a straight list of "if a field passes a check, update it" — is
extremely common in this game's code. It is the single most common thing in
the ~900 functions this constructor is supposed to handle. So getting it wrong
means the constructor helps almost nothing.

## Why the constructor already has "shared" handling but it doesn't fire

The tool builds a graph of the function's branches. When two branches lead to
the same place, that shared place should be written out **once**, and both
branches point at it. The constructor already tries to detect this ("does the
true side and the false side come back together at the same point?") and, when
it does, it writes the shared part once instead of copying it.

The catch: it only treats two branches as "coming back together" when they
point at the **literally identical** graph node. In these functions they never
do. Here is why:

- On the "true" side of `if (field1 < 255) field1 += 5;`, the tool has already
  recorded a write to `field1`.
- To keep track of reads-before-a-write versus reads-after, the tool stamps a
  version number on every field access. That write bumps the version number on
  everything that follows it.
- So the check for `field2` on the "true" side carries version 1, and the check
  for `field2` on the "false" side carries version 0. Same check, same field,
  but stamped differently.

Because the stamps differ, the tool sees two *different* nodes, decides the
branches do **not** come back together, and copies everything. The two sides
are the same code; they only look different because one side did a write first.

(We confirmed this by printing the actual graph: the version stamps increase
1, 2, 3, 4, 5 down the "always true" path, and each of the 64 end-points carries
a different subset of the six writes. That is exactly the fingerprint of "six
guards in a row," not real nesting.)

## The fix, in plain terms

Teach the constructor to recognize this pattern:

> One side of an `if` does a single write and then continues **the same way**
> the other side continues.

When it sees that, it should write:

```c
if (cond) field += 5;   /* the guard, once */
... the shared continuation, once ...
```

instead of copying the continuation into both sides.

Concretely: at each branch, compare its "true" side and its "false" side while
**ignoring two things** —

1. the one extra write that the "true" side adds, and
2. the version-stamp differences that exist *only because* of that write.

If, after ignoring those two things, the two sides are the same, then this
branch is a sequential guard. Emit it flat: the guard as a single-sided `if`,
then the shared rest once. Otherwise, it is a real nested branch; leave the
current behavior alone.

That one change turns the 64-branch tree back into six flat `if` statements,
which is what the compiler was given originally — so the bytes can finally
match.

## Why this also fixes the "too large to try" refusals

The same copying explosion is why the constructor currently gives up on many
functions with "structure too large" (for example, one 144-byte function was
estimated at ~1,000 statements — all copies). Once guards are written flat
instead of copied, those functions are small again and the constructor will
attempt them instead of refusing. So this fix both (a) makes matches possible
and (b) widens how many functions the constructor even tries.

## Ground rules

- **The only proof of correctness is a byte-for-byte match.** Every candidate
  the constructor produces is compiled and compared against the original
  bytes by the existing oracle (`compareFunction`). A flat-guard rewrite that
  is subtly wrong simply will not match; it can never be mistaken for a match.
  Never mark something matched on any basis other than the oracle saying so.
- **Do not break what already works.** Run the unit test suite and
  `benchmarkReconstruction.ts --set development` after every change; both must
  stay green. No function that matches today may stop matching.
- **When unsure, leave the branch as a real nested branch.** The flat rewrite
  is an optimization for a specific, provable pattern. If the two sides are not
  provably "the same except for one write," do not flatten — fall back to the
  existing behavior. A missed flattening just means that function stays
  unmatched for now; a wrong flattening would waste compiles.
- **Same input, same output.** The rewrite must be deterministic.

## Deliverables

Do them in order. Do not start one until the previous one passes.

### Step 1 — Write down what the graph actually looks like (half a day)

Before changing the emitter, print the branch graph for **five** of these
functions (start with `ovl_17_func_800B9CAC`). Confirm in writing:

- each branch's "true" side adds exactly one write versus its "false" side, and
- the two sides are otherwise the same sequence of checks, just with different
  version stamps.

A small throwaway script that prints each node (test / branch-target / end
value + its writes) is enough; one already exists in the session scratchpad as
a starting point.

**Done when:** you have a short written note, per function, saying "yes, this is
N sequential guards" (or flagging any that are actually nested — those are out
of scope for this fix).

### Step 2 — Add the "same except for one write" comparison (1 day)

In `control-structure.ts`, add a helper that answers one question about a
branch: *is the "true" side equal to the "false" side once you ignore the one
write the true side adds and the version-stamp bump that write caused?*

- Return "yes, and here is the single write" or "no."
- Ignore only the version-stamp difference that the write itself explains.
  Any other difference between the two sides means "no."

**Done when:** unit tests in `control-structure.test.ts` cover: a genuine
sequential guard returns "yes"; a real nested branch (the two sides do
different things) returns "no"; a guard whose two sides differ by more than one
write returns "no."

### Step 3 — Emit sequential guards flat (1 day)

Change the branch-emitting code in `emitDagBody` so that when Step 2 says "yes,"
it emits:

- the guard as a one-sided `if (cond) <the one write>;`, then
- the shared continuation once (keep walking from there),

instead of writing a full `if/else` with both sides expanded.

When Step 2 says "no," keep exactly today's behavior.

**Done when:** `ovl_17_func_800B9CAC` produces six flat `if` statements instead
of a 64-branch tree, and it (or another sequential-guard function from Step 1)
**matches the original bytes** — the oracle returns a match. The development
gate stays green.

### Step 4 — Remove the duplicate-candidate waste (small, do it here)

While in the emitter: the "early-return vs else" choice currently produces two
*identical* candidates (it only changes the label, not the code — the branch
that would make them different is disabled with `&& false`). Either make it a
real difference (actually emit `if (c) return a;` then the rest, versus
`if (c) {...} else {...}`) or remove the choice so we stop compiling every
candidate twice. Prefer making it real — the early-return form is a genuine
shape the compiler sometimes used.

**Done when:** candidates are no longer generated in identical pairs, and any
new early-return form is a real alternative the oracle can pick.

### Step 5 — Measure and report (half a day)

Run the full census (`benchmarkReconstruction.ts --census`). Report, against
the census taken before this fix:

- how many functions newly **match the bytes** (the number that actually
  matters),
- how many moved out of "structure too large,"
- how many still fail, and the top reasons.

Compare function-by-function (before category → after category), the way the
last review did. Publish the real numbers, good or bad. Then add one or two of
the newly-matching functions to the development gate and re-freeze it.

**Done when:** the census shows a real, byte-verified increase in matches, the
gate is green, and `make check-all` still produces identical output.

## What this fix does NOT cover

- **The "no parameter plan" failures.** About 670 of these functions fail for a
  different reason: even when the shape is right, the part of the tool that
  names and types the fields and parameters cannot handle them yet. That is a
  separate problem and a separate piece of work. This fix does not touch it.
  It should be scoped only after someone traces a handful of those, the same
  way Step 1 traces these.
- **Branches that call other functions.** Still out of scope; these functions
  do not call anything.
- **Loops.** Handled elsewhere; a loop reaching this constructor is still
  refused, and that is correct.

## Files

- `tools/agent/matching-reconstruction/control-structure.ts` — the constructor;
  Steps 2, 3, 4 all live here.
- `tools/agent/matching-reconstruction/control-structure.test.ts` — new tests
  for Steps 2 and 3.
- `tools/diagnostics/benchmarkReconstruction.ts` — the census, for Step 5.
