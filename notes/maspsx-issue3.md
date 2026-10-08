# maspsx issue 3: branch delay slot not filled with lui-only `li`

## Resolution (2026-10-08): not a maspsx gap. The patch is removed.

The patch compensated for a wrong source and was never an assembler
behaviour.

- **`func_80021820`.** A natural reconstruction (nested `for` loops, no
  register pin) makes cc1 fill the delay slot itself. Its output carries
  `bne $2,$0,$L8` / `li $10,16777216` inside `.set noreorder`, so the
  `lui $t2,0x100` in the target is cc1's `dbr`. A `lui`-only constant has
  length 1 in `mips.md` (the `L` constraint), so it qualifies for a delay
  slot. `$t2` is dead at the branch target, so the steal is legal.
- **A counter-witness.** `ovl_11_func_801213D8`'s target has
  `jal func_80015A18; nop; lui a1,0x5555`, so ASPSX left a jump's slot
  unfilled when a `lui`-only `li` followed. The patch filled it, clobbering a
  call argument and making the function unmatchable from any C.
- **Real ASPSX.** `notes/retros/2026-08-09-func_800142D8-retro.md` already
  recorded that `ASPSX.EXE` 2.86 under wine does not forward-fill.

The submodule is back on upstream `0249ed2`. The local commit `adffb69` is
kept on the submodule's local `master` branch for reference only.
`tools/vendor/maspsx-delay-slot-fill.patch` is deleted. `make check-all`
passes on the upstream assembler.

The history below is kept as it was written.

> Whether this patch is CORRECT (real ASPSX behavior vs one-site hack) is
> an open research topic: see
> `notes/CALLOUT-maspsx-delay-slot-patch-correctness.md`.

## Status

APPLIED LOCALLY, UNCOMMITTED, OWNER DECISION PENDING (2026-07-31). The
patch lives only in the maspsx submodule working tree (exported to
`tools/vendor/maspsx-delay-slot-fill.patch` for reproduction: a fresh
clone must `git -C tools/vendor/maspsx apply ../maspsx-delay-slot-fill.patch`
or `make check` fails). It is load-bearing for func_80021820's current
pinned C (2.8.1-era register-hacked source, one instruction too long under
2.95.2 without the suppressed nop — see notes/jobs-to-be-done.md, "needs
full re-decomp"). Measured alternatives, both byte-green:
  A. Keep patch + pinned C (current state).
  B. Revert patch + return func_80021820 to an INCLUDE_ASM stub (tested
     2026-07-31 and rolled back pending owner decision; with the patch off
     and the pinned C kept, the 4-byte overrun shifts the whole link — 444
     mismatch regions — so B requires the stub).

OPEN QUESTION for the eventual re-decomp of func_80021820: the target
really does carry the `lui` of `li $reg, 0x1000000` in a branch delay
slot. If the correct 2.95.2 source also emits branch-then-li there, real
ASPSX's slot-filling must be reproduced and a hardened version of this
patch (or an upstream maspsx fix) becomes genuinely necessary. If the
correct source schedules differently, the question dissolves.

## The gap

In reorder mode, upstream maspsx always inserts `nop` after a branch/jump.
Real ASPSX would fill the delay slot with a following single-instruction
`li` when the value is lui-only (low 16 bits zero — one `lui`, no `ori`).

Trigger site (the only one across all 466 cc1 outputs, scan method in
notes/research/flag-sensitivity-inventory.md session): func_80021820,
`li $10, 0x1000000` (the voice-allocator min-scan sentinel) following a
branch. Target binary has the `lui` in the delay slot; upstream maspsx
emits `nop` + `lui`.

## The patch

`tools/vendor/maspsx-delay-slot-fill.patch` — suppresses the `nop` when
the next line is an `li` whose value parses as decimal and has
`(val & 0xFFFF) == 0`. Known provisional limitations: decimal-literal
parse only (hex `li` operands are not recognized), and no check that the
branch does not consume the loaded register. Adequate for the single
corpus trigger site; not upstream-quality yet.

## Resolution options (owner decision)

1. Upstream a hardened version to mkst/maspsx (best; this repo has
   engaged upstream before — see maspsx-issue.md / maspsx-issue2.md).
2. Fork maspsx, commit the patch, repoint the submodule.
3. Keep the patch file + add an apply step to setup docs/Makefile.

Until one of these lands, anyone reproducing the build from a clean clone
must `git -C tools/vendor/maspsx apply ../maspsx-delay-slot-fill.patch`.
