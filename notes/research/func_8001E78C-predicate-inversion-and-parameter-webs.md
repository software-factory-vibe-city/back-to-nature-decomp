# func_8001E78C: a wrong predicate under a correct-looking analysis, then delta ownership

**Date:** 2026-08-08. **Status:** SOLVED — 20/20, `make check` passes, clean
C89. Two independent faults, in sequence: the reconstruction computed the
**wrong function**, and once corrected, the deltas had to live on the
**parameters' webs** rather than in fresh locals.

`func_8001E78C` is a 20-instruction 2D proximity test against
`(D_8005E520 >> 1) + 600`. It owns `D_8005E520` (tentative definition for the
GP-relative load). Its 3-component sibling `func_8001E7DC` is the same test and
was already matching the whole time.

---

## Part 1 — the predicate was inverted, and nothing said so

The target returns **1** when both deltas are strictly inside the tolerance
band. The in-progress source returned **0** when a delta was inside it —
inverted, and with `<=` where the target has `<`.

Everything downstream was then real work aimed at the wrong place: a
225-candidate residual sweep, 18 source-shape syntheses, three fuzz variants, a
target-schedule analysis and an allocator counterfactual, all converging on
"web-parity blocker" and offering macro expansion and hand-written assembly as
hypotheses.

None of that was wrong *as analysis*. It simply cannot converge, **and nothing
in the output says so.** A residual search reports the domain it was given, not
whether the domain was worth searching. An allocator counterfactual explains
the registers of a function that computes the wrong thing just as willingly as
one that computes the right thing.

### The rule

**A control-flow diff is a semantics question until proven otherwise.** The
signature is an instruction-count delta *plus* branch-sense differences. Read
the branch senses out of the target and state the predicate in words before
touching allocation or scheduling.

### Two checks that would have caught it in minutes

- **Say what the function returns, in words, from the target.** Here: `beqz` on
  `slt lower,delta` jumps to the `return 0` block, so out-of-band returns 0.
  The header comment asserted the opposite and was never re-checked against the
  assembly.
- **Does a matched neighbour in the same TU disagree with you?** Prefer a
  matched sibling over the target's raw disassembly when one exists.
  `func_8001E7DC` is the three-component form of this same test and states the
  predicate unambiguously in C.

A header comment is not evidence. This one was inherited, wrong, and load-bearing.

---

## Part 2 — check who owns the delta

With the predicate corrected the residual was a pure register permutation with
an identical schedule. The fix was not a codegen trick either.

A derived value in a **fresh local** is a new allocno, and it inherits the
argument hard registers as preferences. The `.greg` dump says so directly:

```
;; 88 preferences: 5 7        (diff1 prefers $a1 and $a3)
```

With `$a1` already held by `bound`, the delta landed on `$a3`, and the target's
entry copy of the argument never happened.

Assigning back into the parameter keeps the delta on the **argument's own web**,
whose only preference is its incoming register — which is what produces the
target's `move v1,a1` at entry and the in-place `subu v1,v1,a3`:

```c
arg0 = arg0 - arg2;
if (arg0 <= lower || arg0 >= bound) {
    return 0;
}

arg1 = arg1 - arg3;
if (arg1 <= lower || arg1 >= bound) {
    return 0;
}
```

### The rule, and how it sits with the style guide

`prompts/c-style-guide.md` §5 says: *do not* reassign an argument when the
target keeps it in its incoming hard register, because the reassignment forces
an entry copy. That is the same mechanism read from the other end, and the two
are not in conflict — **the target's entry copies decide which rule applies**:

| Target shows | Source shape |
|---|---|
| the argument stays in `$a0`–`$a3` and the derived value appears in a scratch register | compute into a fresh temporary or inline at the first consumer |
| an entry `move` of the argument followed by an in-place op on that copy | assign back into the parameter |

**Reusing a parameter is not a hack; it is a statement about which web the
value lives on.** When a residual is one or two argument copies plus a register
rotation, try it before reaching for the allocator tooling — it is a
one-statement experiment and the tooling is a session.

---

## Related

- `notes/research/func_8001E7DC-allocator-preference-battle.md` — the matched
  sibling and the preference mechanism in more depth.
- `notes/retros/2026-08-09-asm-body-debt-paydown-retro.md` §2 — this was the
  most expensive of three "the wall is outside the function" cases.
- `prompts/c-style-guide.md` §1 (decode semantics first), §5 (argument
  reassignment), §10 (the audit rule).
