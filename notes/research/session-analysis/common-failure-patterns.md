# What is actually difficult for the model?

Follow-up to the [function-shape census](README.md), using the same two logs.
This is a qualitative comparison of the long cases, not a new set of matching
experiments or an exhaustive root-cause classification of all attempts.

## Central finding

The recurring difficulty is **going from correct behavior to the particular
source construction that produces the target's compiler artifacts**.

The model can often recover a small function's broad purpose quickly. It then
struggles to explain instructions or arrangements that a simpler implementation
would not need: a redundant-looking branch, a constant with no visible reader,
a particular shared return, or an address/induction initializer in a particular
position. These are clues about *compilation history*, not necessarily additional
algorithmic behavior.

Loops amplify this because changing a counter, a pointer, or a guard can change
several optimizer decisions at once. But the same problem occurs in tiny acyclic
functions, including the longest attempt.

## 1. The 49.70-minute case: `ovl_11_func_800BF450`

### The difficult part was not the apparent algorithm

The target is **23 words, five basic blocks, one call and no loop**.
Under the session's ordinary scalar-return interpretation, its visible memory
and return behavior is approximately:

```text
p = get_pointer()
saved_pointer = p
if p is null:
    return 1
saved_bits = load_word(p) & 0xffff
return 0
```

This is an effect-level summary, not proposed matching C or a claim about the
unique original signature. The actual target also tests bit `0x2000`, has
separate zero-return paths, and on the clear-bit path executes:

```text
0x800BF494: move v0, zero
0x800BF498: ori  v1, zero, 0x8000
```

No subsequent instruction in the function reads that new `v1` value. For an
ordinary scalar return it appears unnecessary. The target also reuses `v1` for
the call-result pointer and a global-address high part earlier in the function.

Directly translating the redundant branch or adding an unused C assignment does
not reproduce these words: the candidate compiler removes or merges the
unnecessary work. The problem becomes **“what earlier source/pass state would
leave this final artifact?”**, rather than “what does this branch calculate?”

### The chronology isolates the difficulty

Elapsed times are from S1:L5904, the target assignment.

| Elapsed | Observation | Evidence |
|---:|---|---|
| 1.47 min | First complete body already contains the pointer call, null handling, load, mask and returns. | S1:L5946 |
| 1.54 min | After replacing an unavailable `NULL` spelling, a compiling candidate is measured. | S1:L5950–5953 |
| 1.93 min | Agent explicitly identifies the separate clear-bit block and dead-looking `v1 = 0x8000`. | S1:L5964 |
| 13.56 min | File-scope register-variable experiment preserves the unwanted-to-the-optimizer definition, but does not match the whole function. | S1:L6186 onward |
| 20.49 min | First stop report asserts ordinary C is impossible and requests a policy decision. | S1:L6285 |
| 20.74 min | Harness continuation asserts matching clean C exists and instructs it to continue. | S1:L6288 |
| 30.19 min | Agent recognizes a different mechanism class in existing research: a constant orphaned by a later cross-jump rewrite. | S1:L6485 |
| 34.55–37.82 min | Additional bounded grammar reports evaluate 42, 81, 21 and 493 coordinates without a match. | S1:L6568, L6572, L6586, L6598 |
| 39.16–49.40 min | More register-variable and return-layout experiments; final unresolved/park report. | S1:L6605–6687 |

The work window ends at 49.70 minutes. **The relevant behavior and anomaly were
already identified within two minutes.** Most of the session concerned reproducing
that anomaly, not understanding a large or complicated algorithm.

The search counts above are tool-reported coordinates, not a deduplicated total
of valid, semantically equivalent candidates. Earlier batches also contained
policy/hard-preservation failures. The final agent's rounded “about 680 variants”
is not needed to establish the pattern.

### Why its reasoning stalled

The investigation repeatedly returned to approximately this argument:

1. The final machine code has a definition with no apparent use.
2. Writing an unused definition in C causes an early dead-code pass to remove it.
3. Therefore ordinary C cannot produce the target, and a hard-register exception
   must be necessary.

**The inference from 2 to 3 is not licensed.** A definition can be used earlier
in compilation and become unused only when a later transformation removes or
merges its consumer. The session itself encounters that alternative at L6485.
Conversely, its existence as a general mechanism does not prove it is the answer
for this function.

A register-variable experiment is also not a complete explanation. Preserving the
constant by reserving `v1` changes allocation elsewhere, where the target wants
that same register available. It solves one symptom and manufactures another.
The final experiment still does not match.

The defensible conclusion is **an unresolved code-generation-history/origin
problem**. Neither the agent's impossibility claim nor the harness's assurance
that clean C must exist is established by these logs.

## 2. Common characteristics of the hard functions

### A. The target contains behaviorally unnecessary-looking structure

Examples include the unused-looking constant above, two return-zero paths,
preheader ordering, and apparently redundant setup around loops. The most natural
C simplification erases precisely the structure needed for byte identity.

This is why small functions can be harder than longer straightforward ones:
there may be little algorithm left to recover, but one unexplained compiler
artifact controls the remaining search.

### B. Equivalent control flow gives values different lifetimes

In the 22.74-minute `ovl_17_func_800BAEF0`, the threshold logic is simple. The
important distinction is between assigning a default and overwriting it in nested
guards, versus assigning the value in every arm of a complete decision tree.
Those can express the same mapping but produce different intermediate control
flow, register lifetimes and delay-slot opportunities.

The final batch is unusually clear evidence: K1 reproduces the old nonmatch;
K2/K3, complete `if / else if / else` forms, are exact (**S2:L533–540**).
The function has no loop. The difficulty is not the number of conditions; it is
recovering their source-level assignment/join construction.

`ovl_31_func_800B8348` is related: separate positive/negative assignment tails and
an explicit join produce the matching result (**S2:L6546–6552**).

### C. Loop counters and addresses are coupled, not independently adjustable

The expensive scans combine several representations:

- a count carried through shifts or a `0x10000` increment;
- a pointer advanced by record stride;
- entry guards and conditional updates;
- a value captured before an increment;
- sometimes an inner countdown or a following loop reusing a variable.

Changing one representation alters loop optimization and then scheduling and
allocation. This makes a final assembly difference a poor guide to a *local*
source edit.

Concrete outcomes:

- `800BA7F0`: pointer/initial-address representation and the final explicit
  shift/add form matter (**S2:L7762–7799**).
- `800B9844`: an inner countdown fixes the major structural residual, followed by
  a separate address-formation fix (**S2:L12079–12082, L12129–12138**).
- `800BA698`: body-local affine arithmetic matches where an explicitly advanced
  value did not (**S2:L4975–4983**).
- `80135AE0`: nested and subsequent checksum loops reach a preheader placement
  residual but remain unmatched (**S2:L11802, L11840**).

Thus the shared characteristic is **multiple interacting representations of
iteration and address calculation**, not simply “contains a loop.”

### D. The wrong background assumption can look like an allocator problem

`ovl_11_func_800BFE3C` spends 11.50 minutes on straight-line code. Its first main
candidate is already close. The session investigates local allocation, reads
compiler internals and gets a bounded UNSAT. Much later, changing the called
function's declaration from `s32` to `void`, while restoring essentially the
initial body, yields EXACT (**S2:L3104–3107**).

This is an important counterexample to treating a residual's diagnostic label as
its cause. An allocation mismatch describes the compiled candidate. It does not
prove the candidate's signatures, object views or variable structure are right.
Nor does the successful declaration alone uniquely establish the original ABI.

## 3. Common characteristics of the model's search behavior

These are qualitative patterns witnessed in the examples, not prevalence counts.

### Many different spellings are the same experiment

The logs explicitly report repeated identical compiled outputs—for example,
`800BA7F0` at S2:L7775/L7779/L7783 and `800BFE3C` throughout S2:L2900–3065.
Rearranging an expression's text can leave the compiler's internal program
unchanged. The model can therefore generate substantial activity without testing
a new mechanism.

### Local fixes are easier to propose than a new explanation

Making the dead constant survive, changing a register's lifetime, or moving one
initializer is concrete. Reconsidering *why the target has that artifact* is
harder. Experiments consequently tend to accumulate around the currently assumed
source construction—even when the eventual successful change is to that
construction or its declarations, rather than to the last mismatching word.

### Bounded negative results get overgeneralized

A grammar can be exhausted and an allocation model can be UNSAT while a valid
solution remains outside their assumptions. `800BAEF0` and `800BFE3C` ultimately
match after earlier negative searches. `800BF450` repeatedly turns failure of
examined representations into an assertion about all ordinary C.

This is a calibration problem: useful negative evidence becomes an unjustified
statement that the target is impossible or requires an exception.

### The harness can prolong uncertainty rather than resolve it

The 50-minute attempt consists of roughly 20.5 minutes before the first stop
report and another 29 minutes after an automatic continuation. The continuation
supplies insistence, not new evidence about the unusual instruction. The agent
does explore additional mechanisms afterward, so the whole second interval must
not be dismissed as wasted. But the total is partly a property of the
**continuation policy**, not an intrinsic 50-minute difficulty of the function.

Filesystem searches, model response latency and finalization add another layer
of cost; the main report quantifies concrete examples. Elapsed time alone cannot
distinguish prolonged reasoning from tool waiting.

## Bottom line

The strongest shared problem is **recovering the source/compiler history behind
a small residual when several plausible source forms have the same behavior**.
Models often recognize the algorithm and even name the visible anomaly early.
They are less reliable at turning that anomaly into a discriminating hypothesis,
changing the assumptions that define the search, and keeping bounded failures
from becoming claims of impossibility.

That is a more specific explanation than “control flow confuses the model,” and
it accounts for the difficult loops, the small decision trees, and the longest
loop-free case without pretending they all have the same root cause.
