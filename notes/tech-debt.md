# Tech debt: functions that are assembly, not C

**Measured 2026-08-08** against the tree at that date. Regenerate the inventory
before acting on it — the counts below are a snapshot, and the last note that
recorded them by hand went stale (see "Corrections" at the end).

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
expressible as clean C" — and one function has already proved the point
(`func_8001A8D0`, a switch statement, matched as clean C once the compiler was
corrected). Only one file in the table below states 2.8.1 as its reason, but
that is because most state no reason at all; the 24 in that note and the 18
here were counted at different times and neither is a live figure.

## Inventory

20 files in `src/` have a raw `__asm__` block as the function body. Two are
legitimate; **18 are debt.**

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
| `func_80017EE4` | 2 | — | none |
| `func_80021D64` | 3 | — | none |
| `func_8001FD74` | 4 | — | none |
| `func_80017AA0` | 11 | `D_8005E44C` | none (comment describes behaviour) |
| `func_80017A70` | 12 | `D_8005E44C` | none (comment describes behaviour) |
| `func_8001205C` | 15 | `D_8005E3B0` | none |
| `func_80019030` | 16 | `D_8005E2BA` `D_8005E444` `D_8005E47A` `D_8005E4A8` | **stale** — "lh vs lhu mismatch cannot be resolved via C with GCC 2.8.1 -O2" |
| `func_80024408` | 16 | — | none |
| `func_8001E78C` | 20 | `D_8005E520` | none |
| `func_80022014` | 22 | — | none |
| `func_80021604` | 25 | — | none |
| `func_80013394` | 27 | `D_8005E294` `D_8005E3CC` `D_8005E3CE` | none |
| `func_80017E34` | 27 | — | none |
| `func_8001AF70` | 28 | — | none |
| `func_80015AAC` | 30 | — | none |
| `func_8001526C` | 40 | — | none |
| `func_8001530C` | 44 | — | none (comment: "Bytes reversed for big-endian output") |
| `func_80015594` | 44 | — | none |

**None of the 18 has an allowlist entry** in `.pi/autodecomp.json`. They are
inherited from before that gate existed, not policy-blessed exceptions — so
nothing today asserts they are supposed to be assembly.

## What research each group needs

**The three tiny ones first**, because they are small enough to read whole and
they are not all the same problem:

- `func_8001FD74` (4) — `lui`/`lw` of `D_80061F1C`, then `sltu $v0,$zero,$v0`.
  That is `return D_80061F1C != 0;`. The symbol is outside the `$gp` window and
  already declared absolute in `globals.h`, so nothing about addressing is in
  play. This one should simply be written.
- `func_80021D64` (3) — `addiu $sp,$sp,-16` / `jr $ra` / `addiu $sp,$sp,16`: a
  function that allocates a 16-byte frame and does nothing with it. GCC 2.95
  gives an empty function no frame at all, and 16 bytes is exactly the o32
  minimum outgoing-argument area, so the question to answer is *what made the
  original allocate one* — a call that was compiled out, or a stubbed body.
  Do not guess; find the shape that produces the frame.
- `func_80017EE4` (2) — `j func_80017EF0` with `ori $a3,$zero,0xFFFF` in the
  delay slot: a **tail call**, not a body. GCC 2.95 has no sibling-call
  optimisation, so `return func_80017EF0(a0, a1, a2, 0xFFFF);` will emit
  `jal` plus an epilogue, not `j`. This may be genuinely inexpressible in C
  with this compiler — the research question is whether the original was a
  hand-written thunk or a second entry point into `func_80017EF0`. If it is the
  former, it belongs in the "legitimate" table above with that reason recorded,
  not in this one.

That spread is the point: "tiny" does not mean "easy", and one of the three may
be a legitimate exception that has simply never been written down.

**Then the small ones with a known shape** — `func_80017AA0`,
`func_80017A70`, `func_8001205C`, `func_80019030`, `func_8001E78C`,
`func_80024408` (11–20 instructions). Two of them — `func_80017AA0` and
`func_80017A70` — already carry a comment describing what they compute, which
is most of the decompilation work already done.

`func_80019030` is the sharpest test in the set: its recorded obstacle is a
concrete, falsifiable codegen claim (`lh` where the candidate emits `lhu`),
made against a compiler the project no longer uses. Re-run it under 2.95.2
before assuming the obstacle survived. Note it reads its globals through the
assembler macro form (`lh $5,D_8005E47A`), which is only GP-relative because
the block declares them — so any C rewrite must define those four symbols.

**Then the rest** (22–44 instructions), ordinary decompilation work.

**Carry the GP-relative facts across.** Six of the eighteen own globals. In C
that is a tentative definition; in a remaining asm block it is `.comm SYM,n`
(never `.extern`, which means absolute). `deriveTuOwnedGlobals.ts --check`
reports any file that reaches a global through `$gp` but addresses it
absolutely, which is the failure mode to watch for during a rewrite.

**Acceptance for retiring an entry:** the function is C89 with no embedded
assembly, `diffFunc <name> --bytes` reports VERIFIED, `make check` passes, and
the row is deleted from the table above. A function that resists should move to
`INCLUDE_ASM` in `nonmatchings/` with its diff signature recorded — quarantine
is honest, an asm block that claims to be a decompilation is not.

## Smaller items found alongside

**Two idioms for the same fact.** A pure-asm file that owns a global states it
either with `.comm SYM,n` inside the block or with a C tentative definition
above it, depending on whether the block uses the assembler macro form or
writes `%gp_rel(...)` explicitly. Both are correct and the build does not care.
`func_80017A70` currently carries both belts — an explicit `%gp_rel` store *and*
a C definition — which is redundant but true. Worth unifying only when these
files are rewritten anyway.

**Stale allowlist entries.** `.pi/autodecomp.json` grants `embedded-asm` to
`func_80016054` and `func_80015704`; neither file contains any assembly. The
permission outlived what it was granted for. `func_80019070` and
`func_80016280` do still carry register pins and are correctly listed.

## Corrections to earlier notes

`notes/next-steps-for-revisiting-the-project.md` lists "Raw `__asm__` embeds
(bad) | 5" naming `func_8001205C`, `func_80015AAC`, `func_80017E34`,
`func_80021604`, `func_80022014`. All five are real and are in the table above,
but the count is not 5 — it is 18 (plus the 2 legitimate GTE ones). That note's
inventory was hand-maintained; this one was measured, and should be re-measured
rather than trusted after any batch of decompilation work.
