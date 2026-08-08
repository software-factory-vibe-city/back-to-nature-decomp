# Plan: let the toolchain decide small-data addressing, and delete the bridge

**Status: LANDED 2026-08-08.** Written and executed the same day. All seven
tasks are done, `make check` passes, and `npm test` is green (197 tests).
`notes/adr-0001-symbol-addressing-at-the-assembler-boundary.md` §2.4 is now the
description of record; this file is kept as the execution log.

Three things the plan did not anticipate, each recorded in the ADR:

1. **Scope was 83 files / 108 symbols, not 200 / 209.** The §3 count came from
   scanning compiled objects for `R_MIPS_GPREL16`, which also counts the
   relocations that `INCLUDE_ASM` stubs inherit from their `.s`. Those need
   nothing, as §3 itself says.
2. **`--aspsx-version` had to move 2.77 → 2.80.** Four functions reach a global
   through `addiu $r,$gp,...`, i.e. the assembler GP-relativised the `la` macro;
   maspsx gates that on version ≥ 2.80. It is the only behavioural difference
   between its 2.77 and 2.80 profiles, and bumping it alone rebuilt every object
   byte-identically. See ADR §3.5.
3. **Five hand-written `__asm__` files declare their own symbols.** They
   carried `.extern SYM,n` inside the asm block and relied on the same GNU `as`
   rule; they now carry `.comm SYM,n` (no space after the comma — maspsx's
   parser splits on whitespace).

One benign linker warning remains, documented in `src/func_80013B04.c`: gas
guesses 8-byte alignment for an 8-byte two-argument `.comm`, and the extracted
definition of `D_8005E2A4` is 4-aligned.

**Goal:** delete `tools/build/fixSmallDataExterns.ts` and
`configs/tu_externs.txt` entirely, and get the same result — correct
GP-relative vs absolute addressing — from maspsx operating as designed.

## Purpose

ADR-0001 added a post-cc1 pass that widens `.extern` sizes so GNU `as` stops
GP-relativising symbols it cannot reach from `$gp`, plus a hand-maintained
ownership table. Both are custom processing bolted onto a toolchain that
already models this correctly. This plan removes them.

The pipeline goal matters here: a bespoke pass and a hand-curated config are
two more things a new game has to understand and populate. Using maspsx's own
model means a new project gets correct addressing with no project-specific
machinery at all.

---

## 1. The actual root cause

The rule maspsx implements was measured directly against period ASPSX 2.77
(`-G8`): `.comm sym,2` expands GP-relative, `.extern sym,2` expands absolute,
and an undeclared symbol behaves like `.extern`. Declared size does not enter
into it. maspsx implements exactly that, in two deliberate pieces:

- **`maspsx.py:158`** — `if not args.dont_force_G0: cmd.insert(-1, "-G0")`.
  By default maspsx forces `-G0` on GNU `as`, removing `as`'s ability to make
  any small-data decision. maspsx becomes the sole authority.
- **`maspsx/__init__.py:463`** — `.extern` lines are skipped when scanning for
  small-data symbols. Only `.comm`, `.lcomm` and `.sdata`/`.sbss` *contents*
  populate `sdata_entries` / `sbss_entries`. That is exactly "GP-relative only
  for in-file declarations".

**This project passes `--dont-force-G0`** (`Makefile:26`), which hands the
decision back to GNU `as`, which then uses `.extern` sizes — the one input
maspsx deliberately refuses to trust. Everything ADR-0001 works around follows
from that single flag.

It is not a maspsx bug. We disabled its correctness mechanism and then wrote a
pass to clean up after the rule it re-enabled.

---

## 2. The replacement mechanism (already proven in-tree)

A **tentative definition in the owning translation unit** is the signal maspsx
needs. `src/func_80016C08.c:46` already does this:

```c
u16 D_8005E438;                 /* in the owning .c file    */
extern u16 D_8005E438;          /* in include/globals_override.h */
```

Under `-fcommon` (already in `CC1FLAGS`) cc1 emits `.comm D_8005E438,2`.
maspsx records it in `sbss_entries` and emits `%gp_rel(...)($gp)` itself.

**It costs nothing at link time.** `build/asm/data/4EA74.sdata.s.o` (splat's
extracted `.sdata`, `0x8005e274` + `0x58c`) already defines the symbol at its
fixed address, and a real definition overrides a COMMON. `nm` confirms the C
object carries it as `C` (common), and the map shows a single address. So:

- no splat change
- no linker-script change
- no layout change, no duplicate storage

The tentative definition is **purely a signal to maspsx**.

### Proof

Assembling `build/src/func_80016C08.s` through maspsx with the forced `-G0`
default (and `-G8` still present so maspsx parses its own `sdata_limit`):

| Symbol | In-file declaration? | Result |
|---|---|---|
| `D_8005E438` | yes (`.comm`) | `R_MIPS_GPREL16` |
| `D_8005E3C0` | no (extern only) | `R_MIPS_HI16` / `R_MIPS_LO16` |

Both are what the target does. That is the whole of ADR-0001's behaviour,
produced by the toolchain, with no pass and no ownership table.

### One constraint

`-G8` must **stay** in `ASFLAGS`. maspsx parses `-G<n>` from the assembler
arguments to set `sdata_limit` (`maspsx.py:74-86`) and then forces `-G0` on
the real `as` invocation itself. Removing `-G8` silently sets the limit to 0
and every `.comm` lands in `bss_entries` instead of `sbss_entries` — which
looks exactly like "the mechanism doesn't work". It cost me one wrong
measurement; don't repeat it.

---

## 3. Scope

Measured against the current tree:

| Quantity | Count |
|---|---|
| distinct symbols reaching `R_MIPS_GPREL16` from compiled C | 209 |
| C files with at least one such access | 200 |
| symbols already carrying a tentative definition | 1 |

Every one of those 209 currently gets GP-relative addressing from GNU `as`,
not from maspsx. After the flag flip, each needs a tentative definition in the
file(s) whose target code accesses it GP-relative, or it silently becomes
absolute and the function breaks.

Symbols referenced only from `INCLUDE_ASM` stubs need nothing — those `.s`
files carry explicit relocations already.

---

## 4. Deriving ownership (do not hand-maintain it)

Ownership is readable from the original bytes, so generate it:

For each `src/*.c`, disassemble its function's original bytes and find every
`$gp`-based load/store. Map the displacement back to a symbol via
`$gp + disp`. Any symbol reached that way is one this file's TU owns, so this
file needs a tentative definition for it.

Because our C files are one function per file, "ownership" degenerates to
per-function, and duplicate `.comm`s across files merge harmlessly under
`-fcommon` — they all resolve to splat's real definition. So the rule is
simply: **if the target reaches a symbol through `$gp` in this function, that
function's file declares it.**

This is the same evidence `configs/tu_externs.txt` encodes by hand, read from
ground truth instead. The generated form replaces that file rather than
extending it.

### Open design question: the C type

The definition must agree with the declaration already in `include/globals.h`
or `include/globals_override.h`, or cc1 errors. Two cases:

- plain `extern s32 D_XXXX;` → emit `s32 D_XXXX;`
- macro-wrapped generated globals
  (`extern s32 _D_XXXX[3] __asm__("D_XXXX"); #define D_XXXX (*((s32*)_D_XXXX))`)
  → the definition has to be of `_D_XXXX` with the matching array type, and
  the `.comm` size must match the real object size or `ld` warns.

Settle this on a handful of symbols by hand before generating 209 of them.

---

## 5. Migration order (each step keeps `make check` green)

The only irreversible moment is the flag flip, and by then everything is in
place. Adding a tentative definition while `--dont-force-G0` is still on is a
**no-op for in-window symbols** — maspsx emits `%gp_rel` where GNU `as` would
have, same result — so definitions can land in reviewable batches.

1. **Spike.** Pick one already-matching file with a GP-relative access, add
   the tentative definition by hand, `make check`. Confirms the type question
   and that nothing shifts.
2. **Generator.** Build the ownership derivation from §4. Have it emit a
   report first, and check its output against the six known-ambiguous symbols
   (`D_8005E3A4`, `D_8005E3A8`, `D_8005E3AC`, `D_8005E3B0`, `D_8005E3B4`,
   `D_8005E3C0`) and against the current `configs/tu_externs.txt` entries —
   it must independently reproduce them.
3. **Apply in batches.** `make check` after each batch. Green throughout.
4. **Flip.** Remove `--dont-force-G0` from `MASPSX_FLAGS` (`Makefile:26`),
   keeping `-G8` in `ASFLAGS`. `make check`.
5. **Delete the bridge.** Remove `tools/build/fixSmallDataExterns.ts`, its
   Makefile step, its call sites in `tools/agent/decompToolchain.ts` and
   `tools/agent/diffFunc.ts`, `configs/tu_externs.txt`, and the
   `!tools/build/fixSmallDataExterns.ts` line in `.gitignore`. `make check`.
6. **Re-verify the three functions** the bridge was built for:
   `func_80011370` (557/557), `SetGfxClip` (9/9), `SetGfxOffset` (9/9).

If step 4 fails, the failure names its own cause: any function that breaks is
one whose owned symbols were missed in step 3.

---

## 6. What this also fixes

The out-of-window case that made the build **unlinkable**
(`relocation truncated to fit: R_MIPS_GPREL16 against D_80010098`) disappears
without special handling. Under forced `-G0`, GNU `as` never GP-relativises
anything, so a far symbol simply gets absolute addressing. The address-window
test in `fixSmallDataExterns.ts` exists only because `as` was allowed to
guess; remove the guess and the test is unnecessary.

`D_80010098` and `D_8001009C` then need no entry anywhere: they are externs
this TU does not own, so they are absolute by default — which is what
`func_80011370` wants.

---

## 7. Amend ADR-0001

The ADR currently presents the post-cc1 pass as *the* decision. That
overclaims. Amend it to:

- name `--dont-force-G0` as the root cause, with the two maspsx code
  references from §1;
- reframe §2.1 (the pass) and §2.2 (`tu_externs.txt`) as an **interim bridge**
  with a defined exit, pointing at this plan;
- record the proof from §2 (the `D_8005E438` / `D_8005E3C0` table) as the
  evidence that the toolchain-native route works;
- keep §3.1 (the delay-slot falsification test), §3.2 (per-TU addressing is
  real, six symbols, GP-relative side confined to `0x80011370`–`0x800128DC`)
  and §3.3 (what was deleted) unchanged — those findings stand on their own
  and are not affected by how the addressing is implemented;
- revise §6's portability checklist: on a new game the answer is "keep
  maspsx's `--force-G0` default and define TU-owned globals in their owning
  TU", not "populate a `tu_externs.txt`".

Mark the ADR **Superseded by this plan once §5 lands**, and leave it accurate
in the meantime — it still describes the tree as it is today.

Also update `plans/oracle-and-pipeline-integrity.md` §5, which currently
proposes auto-generating `tu_externs.txt`. That task is replaced by §4 here:
same derivation, different output — tentative definitions in source instead of
entries in a config file.

---

## Risks

**Big diff.** ~200 files gain a declaration line. Mechanical and verifiable,
but it should land in batches with `make check` between them, not as one
commit.

**`.comm` size mismatches.** `ld` warns when a common's size disagrees with
the real definition. The generator must use the declared size; treat any
warning as a defect, not noise.

**Symbols owned by not-yet-decompiled TUs.** No action needed — their
accesses live in `INCLUDE_ASM` stubs with explicit relocations. But the
generator must not invent ownership for a file that does not access the
symbol, or an unrelated TU will start emitting `%gp_rel` where the target uses
absolute.

**Rollback.** Steps 1–3 are individually revertible and green. If step 4
proves intractable, the bridge still works; the cost is the batches already
landed, which are harmless on their own.
