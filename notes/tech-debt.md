# Tech debt: functions that are assembly, not C

**Re-measured 2026-08-08** against the tree at that date, after retiring
`func_8001205C`. Regenerate the inventory before acting on it — the counts
below are a snapshot, and every hand-maintained version of them has gone stale
(see "Corrections" at the end). The previous "19 whole-body / 15 debt" figures
had already drifted by five retirements when this measurement was taken.

This note covers **functions whose body is a raw `__asm__` block**. It does not
cover `INCLUDE_ASM` stubs, which are honest not-yet-decompiled work and are
tracked by `make progress`. Register pinning, scheduling barriers and flag
overrides are a different debt class and are tracked in
`notes/next-steps-for-revisiting-the-project.md`; this note points at that
rather than restating it.

## Why this is debt and not a solution

The project's clean-source policy says it directly: for an ordinary compiled
function, embedded assembly is not a valid decompilation solution. These files
predate the gate that enforces it.
`notes/next-steps-for-revisiting-the-project.md` diagnoses the cause and it is
worth repeating once, because it explains the *shape* of the debt rather than
blaming the functions: the retired orchestrator's success check was byte-only,
so a raw `__asm__` block passed trivially. "The prompt forbade asm while the
gate permitted it, so under turn pressure agents did what the gate rewarded."

The bytes were never at risk — an asm block reproduces the target by
construction. What it costs is real anyway:

- **the progress metric counts them as decompiled**, which they are not;
- **`contextExport` feeds them to the next agent** as examples of what a
  finished function looks like;
- **they cannot be reasoned about.** Every downstream tool in `tools/agent/`
  — the compiler oracle, the allocator counterfactual, the scheduler probes —
  works on cc1's output. A function with no C has no cc1 output, so it is
  invisible to all of it.

There is also a **specific reason to re-open these now**: the compiler changed
under them. `notes/toolchain-version-detection.md` attributes the whole class to
a belief that has since been disproved — "24 pure-asm functions — written as
`__asm__` blocks because no C matched 2.8.1. With 2.95.2, some may be
expressible as clean C" — and two functions have now proved the point:
`func_8001A8D0` (a switch statement, matched as clean C once the compiler was
corrected) and `func_80017EE4` (see below).

## Check the symbol boundary before concluding "inexpressible"

`func_80017EE4` was the first entry retired from this table, and it was never a
codegen problem at all. **The symbol map was wrong.** `0x80017EE4..0x80017F30`
is one function that appeared as three: a 2-instruction "function", a
1-instruction "function", and the body. A 2-instruction symbol is not a
function, so of course no C produced it — and the note you are reading asserted
the opposite, calling it "a tail call, not a body… may be genuinely
inexpressible in C". That claim was wrong and it cost a later agent a full
session, which reached the same conclusion and wrote an `embedded-asm` block
plus an allowlist entry to record it.

**The general rule: a symbol that is not a function cannot be decompiled as
one, and the failure looks exactly like a codegen impossibility.** Before
concluding that a function resists C, prove the boundary. Decisive evidence,
cheapest first:

- **No `jr $ra` anywhere in the body.** The symbol does not return; it falls
  through into the next one.
- **A conditional branch crosses the symbol boundary**, in *either* direction.
  A MIPS conditional branch can never be a call, so this proves the two symbols
  are one function. A *backward* branch from a later symbol into an earlier one
  is a rotated loop's back-edge, not a call.
- **The entry is a `j`, not a prologue.** GCC 2.95 emits no tail calls, so a
  `j` to an address that has no `jal`, no data pointer and no address-taken
  `lui`/`addiu` anywhere in the binary is intra-function control flow.
- **A register is read before any definition** on some path — e.g. the body
  depends on `$a3` set only by the preceding symbol. `scanReadBeforeDef.ts`
  reports this.
- **Zero callers.** Scan for `jal`, stored pointers and `lui`/`addiu` pairs
  across the whole payload, not just the call graph.

`tools/build/mergeFragments.ts` now detects this class and `make split` applies
it; the three defects that let `func_80017EE4` through were a `j` counted as a
tail call, a `j` counted as an external entry point, and a pass that only
looked for *forward* cross-boundary branches. All three are fixed. Re-running
`make split` is therefore the first thing to try on a stuck tiny function, and
a boundary that survives it is evidence, not an assumption.

Once merged, `func_80017EE4` matched as ordinary C89 on the first shape that
respected GCC 2.95's `expand_end_loop` rotation — no asm, no flag override, no
register pinning. The source comment records which shape and why.

## Check the declaration before concluding "the allocator won't do it"

`func_8001205C` was the second entry retired for a reason that was not codegen,
and it cost a capable agent a whole session of doc-reading. Its residual was one
word: the target reads `D_8005E328` with the single-register self-clobber pair
`lui $a1,%hi(sym)` / `lw $a1,%lo(sym)($a1)`, the candidate emitted the split
two-register form. ADR-0001 §4 says recovering that pair by reshaping the C is
*proven unreachable*, so the obstacle read as a wall.

It was not. The pair was unreachable **because the declaration was wrong**.
`D_8005E328` had been over-declared as `s32 [3]` to "force absolute addressing
under -G8" — reasoning that was correct before ADR-0001 §2.4 and is backwards
after it. Since §2.4 the two decisions are independent:

| Question | Decided by |
|---|---|
| GP-relative or absolute? | whether **this TU defines** the symbol — size is irrelevant |
| unsplit macro (self-clobber) or split pair? | the **declared size** against `-G8` |

Widening bought nothing, because absolute addressing never depended on size,
and cost the match, because cc1 then split the address. A scalar declaration
fixed it with no change to the C at all.

**The general rule: when the target uses a form the allocator "cannot"
produce, check what the symbol is declared as before believing the
impossibility result.** Same shape as the boundary case above — a fact outside
the function makes the function look inexpressible. Two cheap checks:

- **Does the same file already contradict you?** `func_8001205C` reads
  `D_8001009C` (scalar) as the matching self-clobber pair and `D_8007AFF4`
  (genuinely 12 bytes) as a genuine split, three lines apart.
- **Is the declaration's comment older than 2026-08-08?** Comments claiming a
  size controls the addressing mode predate §2.4 and are now false. ADR-0001
  §4.1 states the current rule.

## Inventory

Measured by classifying every `src/*.c` containing `__asm__`. The distinction
matters and earlier counts blurred it:

| Class | Files | Debt? |
|---|---:|---|
| Whole-body raw `__asm__` (no C body for the symbol) | 16 | 14 — see below |
| Emitted asm inside an otherwise-C body | 1 | allowlisted |
| Non-emitting `__asm__` (symbol aliases only) | 1 | no |
| Register pins / scheduling barriers | 3 | other note |

- **Emitted asm inside a C body:** `func_80016280` — heavy register pinning
  plus asm blocks, allowlisted as `register-asm`/`embedded-asm`.
- **Non-emitting:** `func_8002437C` — its trailing block only defines symbol
  aliases (`_800243A4 = func_8002437C + 0x28`). It emits no instructions and is
  not asm-body debt. It *is* a boundary artifact: internal labels promoted to
  global symbols.
- **Register pins / barriers:** `func_80019070` (pinned, allowlisted),
  `func_80021820` (`register s32 i __asm__("a3")`, **not** allowlisted),
  `func_800244FC` (`__asm__ volatile("" ::: "memory")` scheduling barrier,
  **not** allowlisted). Tracked in
  `notes/next-steps-for-revisiting-the-project.md`.

### Legitimate — GTE code, keep as assembly

These issue coprocessor-2 instructions (`rtps`, `mvmva`, `lwc2`, `cfc2`, …).
They were handwritten assembly in the original game; they never were C.

| Function | Instrs | GTE ops |
|---|---:|---:|
| `func_8001DFD4` | 30 | 6 |
| `func_80038674` | 20 | 15 |

### Debt — no reason recorded, or a reason that no longer holds

`owns` lists the globals whose GP-relative addressing this translation unit is
responsible for (derived by `tools/build/deriveTuOwnedGlobals.ts`). A
re-decompilation must carry them over as tentative definitions in C, or the
function will silently switch to absolute addressing — see ADR-0001 §2.4.

| Function | Instrs | Owns | Stated reason |
|---|---:|---|---|
| `func_80024408` | 16 | — | none |
| `func_8001E78C` | 20 | `D_8005E520` | none |
| `func_80022014` | 22 | — | none |
| `func_80021604` | 25 | — | none |
| `func_80013394` | 27 | `D_8005E294` `D_8005E3CC` `D_8005E3CE` | none |
| `func_80017E34` | 27 | — | none |
| `func_8001AF70` | 28 | — | none |
| `func_8001D2D8` | 28 | — | "Force two separate return blocks with inline assembly labels" |
| `func_8001F278` | 29 | — | none |
| `func_80015AAC` | 30 | — | none |
| `func_8001526C` | 40 | — | none |
| `func_8001530C` | 44 | — | none (comment: "Bytes reversed for big-endian output") |
| `func_80015594` | 44 | — | none |

**None of the 13 has an allowlist entry** in `.pi/autodecomp.json`. They are
inherited from before that gate existed, not policy-blessed exceptions — so
nothing today asserts they are supposed to be assembly.

### Retired

| Function | Retired | Result |
|---|---|---|
| `func_80017EE4` | 2026-08-08 | Symbol boundary was wrong; three symbols merged into one 0x4C function, then matched as clean C89. `make check` passes. |
| `func_80021D64` | 2026-08-09 | 3-instruction stub allocating 16-byte frame and returning. Matched as `char pad[16]` local — a placeholder/stub body from the original source. `make check` passes. |
| `func_8001FD74` | 2026-08-10 | 4-instruction Boolean getter: `return D_80061F1C != 0;`. Matched as clean C89 on first shape. `make check` passes. |
| `func_80017AA0` | 2026-08-13 | 11-instruction mode encoder: loads `D_8005E44C` as `s16`, returns 0/2/1 depending on value. Matched as clean C89 on first shape. Required changing `D_8005E44C` from `u16` to `s16` in `globals_override.h` to emit `lh` instead of `lhu`. `make check` passes. |
| `func_8001205C` | 2026-08-08 | 15-instruction arithmetic expression over four globals. Not a codegen problem: `D_8005E328` had been over-declared as `s32 [3]` in `globals_override.h`, which forces the split two-register address where the target uses the unsplit self-clobber pair. Declaring it as a scalar took it from 12/15 to 15/15 on the existing C. `make check` passes. |
| `func_80017A70` | 2026-08-16 | 12-instruction table lookup with clamp: `if (arg0 >= 3) arg0 = 1; D_8005E44C = D_80049050[arg0];`. Matched as clean C89 on first shape. Owns `D_8005E44C` (tentative definition for GP-relative store). `make check` passes. |
| `func_80019030` | 2026-08-19 | 16-instruction conditional arithmetic: loads `D_8005E47A` as `s16`, checks `D_8005E4A8[D_8005E444 - 1] == 0xFFFE`, and if so returns `(s16)(result - 12 - D_8005E2BA)`. Stale obstacle claimed GCC 2.8.1 couldn't emit `lh` vs `lhu`; under 2.95.2 the real issue was front-end reassociation of `result - 12 - D_8005E2BA` into `result - (D_8005E2BA + 12)`. Solved by splitting into two statements with an `s32` intermediate to prevent premature sign-extension. Added `D_8005E444` (u16), `D_8005E4A8` (u16*), and simplified `D_8005E47A` (s16) in `globals_override.h`. `make check` passes. |

## What research each group needs

**The smallest ones with a known shape first** — `func_80024408` (16),
`func_8001E78C` (20).

`func_8001D2D8` is the one entry whose stated reason is a *layout* claim
("force two separate return blocks"), which is the same family of problem as
`func_80017EE4`: block layout dictated by the compiler's own loop and jump
handling rather than by the source statement order. Read
`expand_end_loop` and the jump-threading passes before assuming asm is needed.

**Then the rest** (22–44 instructions), ordinary decompilation work.

**Carry the GP-relative facts across.** Three of the fourteen own globals
(`func_80019030`, `func_80013394`, `func_8001E78C`). In C
that is a tentative definition; in a remaining asm block it is `.comm SYM,n`
(never `.extern`, which means absolute). `deriveTuOwnedGlobals.ts --check`
reports any file that reaches a global through `$gp` but addresses it
absolutely, which is the failure mode to watch for during a rewrite.

**Acceptance for retiring an entry:** the function is C89 with no embedded
assembly, `diffFunc <name> --bytes` reports VERIFIED, `make check` passes, and
the row moves from the debt table to "Retired". `diffFunc` alone is not
sufficient — it compares pre-link encodings and can both false-pass and
false-fail; `make check` is the verdict. A function that resists should move to
`INCLUDE_ASM` in `nonmatchings/` with its diff signature recorded — quarantine
is honest, an asm block that claims to be a decompilation is not.

**Do not record an exemption for a function you could not match.** An
`embedded-asm` entry in `.pi/autodecomp.json` asserts that assembly is the
correct answer for that function, permanently and for every later agent. Being
stuck is not that assertion. File the obstacle here instead.

## Smaller items found alongside

**Two idioms for the same fact.** A pure-asm file that owns a global states it
either with `.comm SYM,n` inside the block or with a C tentative definition
above it, depending on whether the block uses the assembler macro form or
writes `%gp_rel(...)` explicitly. Both are correct and the build does not care.
`func_80017A70` used to carry both belts — an explicit `%gp_rel` store *and*
a C definition — which is redundant but true. Worth unifying only when these
files are rewritten anyway.

**Stale allowlist entries.** `.pi/autodecomp.json` grants `embedded-asm` to
`func_80016054` and `func_80015704`; neither file contains any assembly. The
permission outlived what it was granted for. `func_80019070` and
`func_80016280` do still carry register pins and are correctly listed.
`func_80021820` and `func_800244FC` carry a register pin and a scheduling
barrier respectively and are *not* listed — the allowlist under-describes the
tree in both directions.

**The linker script can go stale silently, and it looks like a source bug.**
`Makefile:106` lists `$(LD_SCRIPT)` as a link prerequisite but **nothing has a
rule to build it** — only `make split` produces it, and the four symbol
`INCLUDE` lines are appended by shell *after* splat runs:

```make
@printf 'INCLUDE "build/undefined_funcs_auto.txt"\nINCLUDE "build/undefined_syms_auto.txt"\n' >> $(LD_SCRIPT)
```

So a bare `splat split`, or a `make split` interrupted in its last few lines,
leaves a linker script missing 146 undefined-symbol definitions plus the lib
bss set. Every `.bss` symbol at or above `0x8005E850` then goes undefined —
984 errors that name `func_80011370` and read as a decompilation defect, hours
after the actual event. This happened on 2026-08-08 and cost a full
investigation. **Symptom to recognise:** mass `undefined reference to D_…` for
bss addresses, while `build/undefined_syms_auto.txt` still contains them —
check `tail -4 build/slus_011.ld` for the `INCLUDE` lines, and re-run
`make split`. Two fixes, neither applied yet: a fast guard in `make check`
that fails with "run make split" when the includes are absent, or a real Make
rule for `$(LD_SCRIPT)` so an incomplete script cannot survive.

**Boundary artifacts beyond the merged case.** A binary-wide scan found nine
symbol pairs with a conditional branch crossing between them and three symbols
with no terminator. Most resolve to the two merge groups `make split` now
applies; the pairs involving `func_8004815C` (a 0x166A4-byte symbol) look like
a splat coverage problem rather than real merges and need separate triage —
do not feed them to `mergeFragments` expectations.

## Corrections to earlier notes

`notes/next-steps-for-revisiting-the-project.md` lists "Raw `__asm__` embeds
(bad) | 5" naming `func_8001205C`, `func_80015AAC`, `func_80017E34`,
`func_80021604`, `func_80022014`. Four of the five are real and are in the
table above; `func_8001205C` has since been retired. The count is not 5.

This note's own previous count — "20 files, 18 debt" — was also wrong, in the
other direction: it missed `func_8001D2D8` and `func_8001F278` (both
whole-body asm) and did not distinguish emitted asm from non-emitting symbol
aliases or register pins. The current figures come from a scan that separates
those classes; re-run it rather than trusting any of them after a batch of
decompilation work.

This note previously asserted that `func_80017EE4` was a tail call that "may be
genuinely inexpressible in C with this compiler". That was wrong on both
counts, and it was believed and acted on. When a claim here is a *hypothesis*
about codegen rather than a measurement, say so.
