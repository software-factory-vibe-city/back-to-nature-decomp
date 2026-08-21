# Overlay decompilation enablement — measured findings

Implementation notes for `plans/overlay-decompilation-enablement.md`,
Deliverables 1–12. Everything below is a measurement or a derivation from one,
reproducible with the tool named beside it. Where a measurement contradicts the
plan, the contradiction is recorded rather than reconciled.

## The container

`a_file.hdt` is a 33-entry little-endian u32 offset table with a trailing
sentinel, so the archive holds **32 members** that tile `a_file.bin` exactly.
The format is detected, not assumed: five hypotheses are scored against
in-range, monotonicity, sector alignment, non-emptiness, tiling and total-size
agreement, and the offset-table reading wins 1.000 against 0.745 for its nearest
rival. A corrupted index scores below the bar and is reported `undetermined`.

- `tools/build/extractArchive.ts` — manifest at `configs/overlays.json`
- Round trip: the 32 members concatenate to a file byte-identical to `a_file.bin`

## Which members hold code

Thirteen. Separation is absolute: every code member returns at least 0.95 times
per KB, every data member exactly zero.

**`ovl_08` is code, not a pointer table.** The plan expected the opposite — 2 KB,
16 engine calls, no self-calls, opening with a count-shaped word followed by
absolute pointers. It holds five real functions between two data regions; the
leading word is the overlay id (the sequence 4, 5, 6, … across code members) and
the words after it point at those functions. Verdict: code, with evidence.

- `tools/build/classifyArchiveMembers.ts`

## Load addresses

Every code member's base is solved from a vote: each internal `jal` target is a
function entry, each stack prologue is a candidate entry, and every (target,
prologue) pair proposes one base. Thirteen of thirteen resolve, with margins of
0.34–0.70 over the runner-up.

| slot | base | members |
|---|---|---|
| A | `0x800B7E20` | ovl_08 ovl_10 ovl_11 ovl_17 ovl_19 ovl_21 ovl_23 ovl_25 ovl_27 ovl_28 ovl_31 |
| B | `0x8012DDE8` | ovl_15 ovl_30 |

**The loader copies each member whole; the solved base applies at member offset
0.** The plan left this open. Eleven members of different sizes and contents
agree on the address of their *leading id word*, which is only possible if that
word is at a fixed slot address — a stripped header would place the first
instruction there instead, and the eleven would not agree.

Corroboration independent of the base: **100% of every member's external `jal`
targets (246 distinct) are addresses the project already knows as PS-X EXE
functions.** External calls do not depend on the base at all, so this checks the
decode rather than the placement.

- `tools/build/solveOverlayBase.ts` (`--probe 0xADDR` scores an arbitrary base;
  a base wrong by 0x1E0 scores 0.19–0.40 against 0.98–1.00 for the solved one)

## Overlays are not all independent

**`ovl_30` calls ten functions inside `ovl_11`.** The plan recorded that there
are no cross-overlay calls and that the thirteen overlays are mutually
independent. They are not: `ovl_30` is `Obj\GF_swind.bin` in slot B, `ovl_11` is
`Obj\GF_FARM.bin` in slot A, the slots are disjoint, and all ten targets land on
function entries in `ovl_11`. `ovl_30`'s splat config reads `ovl_11`'s symbols
and its link includes `ovl_11`'s exports; the edge is in the call graph.

Slot mates cannot call each other — one base means one RAM region and they are
never resident together — and the base solver excludes them from cross-member
resolution for exactly that reason.

## Identity

The PS-X EXE carries a 32-record table of the developer's own asset paths at
`0x80048B20`, found by its shape rather than its address: 40-byte records each
holding a Windows path, in a run whose length equals the archive's member count.

Three independent sources agree:

1. Table position *i* is member *i* — the run is exactly 32 long.
2. Every one of the 13 members the classifier called code has an `obj\` path;
   every one of the 19 it called data has an `objcg\` or `data\` path. The
   classifier reached its verdict from `jr ra` density and knows nothing about
   filenames; the odds of a chance alignment are about 1 in 347 million.
3. `func_800147BC` references both `\A_FILE.HDT;1` and `\A_FILE.BIN;1` and the
   table itself — it is the loader.

Aliases are recorded in the manifest. `ovl_11` is `Obj\GF_FARM.bin`, which is why
it is 483 KB and why `Obj\GF_swind.bin` calls into it.

- `tools/diagnostics/overlayIdentity.ts`

## Liveness was wrong, and it was inverting the work queue

`progress.ts` and `callGraph.ts` judged liveness against the PS-X EXE alone. 94
functions are referenced only from overlays, and `callGraph.ts` sorts dead
entries to the *end* of the queue — so the engine API, which no overlay
translation unit can compile without, was ranked last.

| | before | after |
|---|---|---|
| dead | 207 | 110 |
| `func_8001AC10` priority (79 overlay call sites) | 446 of 464 | 85 |
| median priority of the 97 corrected functions | 320 | 52 |

The headline moved from 98.42% to 75.79% of the PS-X EXE, and to **11.09% of the
project** once the overlays are in the denominator.

- `tools/lib/liveness.ts`, `tools/diagnostics/engineApi.ts`

## The RAM map

Every address overlay code touches is assigned to a named region; **none is
unclassified**. Boundaries come from the EXE header, the derived section layout
and the solved bases, so nothing is a constant.

| region | extent | overlay sites | EXE sites |
|---|---|---|---|
| `exe.data` + `exe.sdata` | `0x80048B14`–`0x8005E800` | 714 | 1,567 |
| `shared-bss-heap` | `0x8005E800`–`0x800B7E20` | 1,928 | 1,304 |
| `slot.0x800B7E20` | 483,328 B | 11,781 | 15 |
| `slot.0x8012DDE8` | 98,304 B | 1,337 | 4 |

The shared region's upper edge is the solved slot base, not the `0x800AFFFF` the
plan estimated. The two slots overlap by 56 bytes; `ovl_11`'s content ends at
`0x80128807` and the rest is sector padding, so nothing is actually contended.

- `tools/diagnostics/ramMap.ts`

## Overlay translation units were built `-G0`

145,741 words of overlay `.text` contain **not one** gp-relative access, against
17.99 per 1000 words in the PS-X EXE's `.text`. Measured over the derived `.text`
ranges only — over a whole member, data misdecodes as `lwc2`/`lwc3` and
manufactures apparent hits.

Under `-G8` every global a translation unit defines that is eight bytes or
smaller becomes `.comm` and is reached through `$gp`. It is also the only build
that runs: `$gp` holds the EXE's small-data base at all times, so a separately
linked overlay emitting gp-relative accesses would resolve them against the
wrong section.

Applied as a per-container fact in the Makefile (`OVERLAY_G`), not a per-file
override, because it is a property of the container and not of any one file.

- `tools/diagnostics/overlayFlagFingerprint.ts`

## Build

Fourteen containers, fourteen SHA-256 comparisons.

```
make disassemble          # archive → classify → solve bases → disassemble
make split-all            # every container's config and stubs
make check-all            # 14 comparisons
make wipe-ovl_31 && make split-ovl_31 && make check-ovl_31
```

Each overlay builds from pure `INCLUDE_ASM` stubs to a binary byte-identical to
its extracted member. That round trip is what proves the extraction, the solved
base and the derived section boundaries all at once.

Two defects surfaced along the way and are fixed:

- `detectLibFunctions.ts` read `configs/symbol_addrs.txt` by a CWD-relative
  path, and `loadSymbolAddrs` answers a missing file with an empty map. Moving
  the file exposed it: relocation verification silently lost its evidence and
  mis-assigned two library symbols instead of failing.
- An `INCLUDE_ASM` stub's object had no dependency on the assembly it includes,
  so a re-split that renamed a call target left a stale object in place. The
  compile rule now depends on the `.s` too.
