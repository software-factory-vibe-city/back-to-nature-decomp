# C Style Guide for PSX Matching Decompilation

The always-applicable rules. Everything that belongs to one compiler pass has
moved to a reference sheet you load when the pipeline reversal names that pass —
`psx_reference population | schedule | allocation | declarations | flags | sdk |
stuck`.

That split is deliberate. This file used to carry every mechanism for every
pass, and an agent spent a large share of its context on doctrine for passes
that did not own its residual. Loading the sheet the evidence points at beats
loading all of them.

Concrete compiler flags, small-data threshold, assembler, SDK and target facts
are in `configs/project-profile.md`. Do not restate them here or reason from
memory about them.

## The policy that is not negotiable

Apply the compiler and assembler confidence statements from the generated
project profile. When the active project establishes that an ordinary function
came from a reproducible C compiler invocation, failing to find its source
shape is not permission to bypass the clean-source gate. Stop with a measured
residual rather than reaching for inline assembly, hard-register pinning, a new
assembly stub, or an unevidenced flag override.

Where a target genuinely requires one of those, it needs an allowlist entry,
and that is a human decision. File it; do not grant it.

An allowlist entry names one function, and the name is the key. Where an entry
is keyed by address instead, it must carry the container — `<container>:<address>`
— because containers share RAM and a bare address grants one function's exception
to a different function sitting at the same place in another binary. A bare
address is read as the executable's, which is the only container whose addresses
are unambiguous.

## Start from natural C

The original programmers generally wrote straightforward C. Reconstruct the
complete operation a programmer would express, then use compiler evidence to
alter its web shape deliberately.

```c
/* Natural forms to try first. */
result = table[index];
obj->flags |= 0x10;
delta = *p++ - *q++;
if (count > 0) {
    /* ... */
}
```

```c
/* Usually the wrong starting shape. */
rhs = *q;
q++;
delta = *p;
delta -= rhs;
p++;
```

A named temporary is not free in pre-SSA GCC. Reusing `rhs` for independent
loads creates one multi-death pseudo, often forcing it through global
allocation. The fused expression lets GCC create fresh, single-set, short-lived
operand pseudos while retaining only the semantically recurring `delta` web.

An instruction-by-instruction transcription of the target is not a starting
point. It byte-matches the code it was copied from while fixing the pass-time
geometry — which blocks exist at gcse time, which notes the loop passes see,
which births the allocator counts — in a state no later statement edit escapes.

## C89, and nothing newer

Declarations at the top of a block, `/* */` comments, no C99 constructs. Do not
redeclare generated globals; do define, tentatively, every global whose
translation unit this is — that is how GP-relative addressing is expressed. See
`psx_reference declarations`.

## Measurement

The staged residual is the distance: control flow, then population, then
schedule, then allocation, in the order the passes run. The byte score is not a
distance — an edit that fixes the cause of a difference rotates everything
downstream of it and can match fewer words while standing closer.

One edit, one measurement. See the skill's loop; it is the procedure, and this
file does not repeat it.

## Final checklist

Before accepting a function:

1. semantics, constants, signedness and addresses are decoded;
2. the source uses natural arrays, structs, operators and expressions;
3. every nontrivial edit followed a measurement, not a prediction;
4. no forbidden workaround, generated-global redeclaration, `_D_` symbol or
   C99 construct was introduced;
5. `psx_residual_objective` reports `EXACT` — the bytes are the original's,
   relocations included. A word count of N/N is a progress reading, not the
   verdict: undetermined words mean a relocation could not be resolved and are
   neither a match nor a mismatch, and the tool gives them their own column;
6. context export, the full binary check, modification-scope check and
   clean-source gate pass.

## Where the rest went

| Sheet | Load it when the residual owner is |
|---|---|
| `population` | expand, cse, gcse, loop, combine — the programs differ |
| `schedule` | sched1 or sched2 — same instructions, different order |
| `allocation` | local-alloc or global-alloc — same order, different registers |
| `declarations` | a load width, address form or small-data question |
| `flags` | a per-TU flag hypothesis with a target fingerprint |
| `sdk` | the function builds SDK packets |
| `stuck` | a form reads as unreachable and you are about to model a pass |

Dated observations about what this project's authors tended to write are priors
to test, not rules to apply, and live in `notes/research/period-idiom-priors.md`.
Case studies live in `notes/research/`; solved-function post-mortems, including
what was tried and did not work, live in `notes/retros/`.
