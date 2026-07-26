# Plan: stop the split pipeline from resurrecting jump-table case fragments

## Problem

Every `make split` re-creates 6 fake functions as `c` segments + `src/` stubs:

```
src/func_8001A940.c … src/func_8001A968.c   (8-byte `jr $ra; addiu $v0, $zero, <const>` thunks)
configs/splat.yaml:  - [0xB140, c, func_8001A940] … - [0xB168, c, func_8001A968]
```

These are **not functions**. They are the jump-table case bodies of the `switch`
in the already-decompiled `func_8001A8D0` (the `case 23: return 99;` example in
`prompts/c-style-guide.md`). In the original disassembly
(`build/functions/func_8001A8D0.s`) they appear as `alabel func_8001A940` etc.
**inside** `func_8001A8D0`, and the linker script does not place their objects
(`build/slus_011.ld` goes straight from `func_8001A8D0.c.o(.text)` to
`func_8001A970.c.o(.text)`). They compile but are never linked — pure noise in
the function inventory, `make progress`, and the call graph worklist.

History shows the flip-flop: `da22173` added them, `78a125f` (2026-03-22)
removed them by hand, and the first `make split` after that (2026-07-25, for the
`GetPairedTpage` rename) resurrected them. `make`/`make check` never run
`make split`, so months of "running the pipeline" never exercised this path.

## Why the existing case-stub handling didn't catch them

`mergeFragments.ts` **does** account for switch case statements (Pass 3,
"jump table case targets — case handler stubs that spimdisasm split into
separate functions"). Two holes:

1. **Pass 3 deliberately leaves absorbed jtbl targets as `type:func` in
   `symbol_addrs.txt`** (so spimdisasm keeps emitting the `alabel`s that rodata
   jump tables reference — confirmed: lines 207–212 mark `func_8001A940…A968`
   `// type:func`). `patchSplatForLibs.ts`'s text-gap phase then re-adds a `c`
   segment for **every `type:func` symbol that isn't a segment start**:
   `if (existingSegRoms.has(rom)) continue;` only checks whether a segment
   *starts* at that ROM offset — never whether the address is already *covered*
   by an existing segment's span. At HEAD, `func_8001A8D0`'s span is
   `[0xB0D0, 0xB170)`, which covers all six fragments, yet each gets its own
   segment because no segment *starts* at `0xB140…0xB168`. The absorption can
   never stick: merge removes, gap-filler re-adds.

2. For this switch, Pass 3 couldn't fire anyway: it parses `jtbl_*` dlabels
   from `build/asm/data/*.s`, but `func_8001A8D0` is decompiled and its jump
   table is **compiler-emitted** into `func_8001A8D0.c.o(.rodata)` — no jtbl
   dlabel exists in the splat-disassembled data for it to parse.

## Fix

In `tools/build/patchSplatForLibs.ts`, text-gap phase ("Add c entries for
type:func symbols…"): build interval spans from the consecutive `c`/`o`
entries already in the yaml and skip any `type:func` symbol whose ROM address
falls **strictly inside** an existing span (segment start < rom < next
segment start). Same guard in the `scanFuncBoundaries` loop right below it
(it already skips `existingSegRoms` and `gapFuncEntries`; add the span check).

This is a strict narrowing: it only suppresses entries for addresses already
covered by a segment. Symbols at true gap addresses keep being added.

Deliberately **keep** the `type:func` entries in `symbol_addrs.txt` — they are
needed so spimdisasm emits the `alabel`s referenced by the archived asm and
the decompiled function's branch (`beqz $v0, func_8001A968`).

## Cleanup cascade (no manual deletion needed)

With the guard in place, the 6 yaml entries disappear on the next
`make split`. The 6 `src/func_8001A94*.c` stubs then become orphans — and the
hardened orphan phase (2026-07-25: stubs deleted, real source migrated/kept)
deletes them automatically since they are `INCLUDE_ASM` stubs.

## Test plan

1. **Unit-style scratch tests** of the guard (same approach used for the
   orphan-phase fix):
   - fake `type:func` symbol inside an existing span → no `c` entry added;
   - fake `type:func` symbol at a true gap address → entry still added;
   - symbol exactly at a segment start → unchanged behavior.
2. **Idempotence / convergence**: `make split` twice; second run must produce
   zero tracked-file changes (`make config-check` passes). Acceptance: the 6
   fragment entries + 6 stubs are gone and stay gone.
3. **Byte identity**: `make check` — payload SHA-256 must match (expected:
   fragments were never linked, so no change).
4. **Inventory**: rebuild `build/callGraph.json`; confirm function count drops
   by 6 and `make progress` no longer counts the fragments.

## Risks / notes

- The guard assumes "consecutive segment starts imply span coverage" — true
  for this project's contiguous `.text`. If a future yaml ever has an
  intentional hole inside a span, the guard would suppress a wanted entry;
  the scratch tests pin the intended semantics.
- Unrelated but observed during diagnosis: `make split` also stripped one
  orphaned `.rodata` entry (`[0xA1C, rodata]`) — legitimate convergence, keep
  an eye on it when reviewing the configs diff.
- After this lands, `make config-check` should pass on a clean tree; if it
  still flags drift, that drift predates this change and needs separate review.
