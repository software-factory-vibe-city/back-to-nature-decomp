# Failed Plan: Fix Remaining 234 Binary Diff Bytes

**Date:** 2025-03-12 (2 sessions, ~3 hours total)
**Status:** FAILED — build is broken, needs full rollback
**Original goal:** Fix 234 diff bytes across 34 library objects by improving signature matching in `detectLibFunctions.ts`

## Original Plan

The plan called for modifying ONLY `tools/detectLibFunctions.ts`:

1. Replace `findPattern()` (first match) with `findAllPatterns()` (all matches)
2. Collect `CandidateMatch` objects instead of immediate placement
3. Place anchors first (unique matches)
4. Place ambiguous objects using adjacency scoring
5. Keep existing safety passes

The plan claimed this was a single-file change. This was wrong.

## What Actually Happened

### Phase 1: Detection changes (partially worked)

- Added `findAllPatterns()` to return all matching offsets — this worked fine
- Added `CandidateMatch` interface and candidate collection — worked
- Added `verifyRelocations()` with R_MIPS_26 and HI16/LO16 pair verification — code works but is fundamentally limited (see pitfall #3)
- Anchor/ambiguous separation — worked for Pass 1

### Phase 2: Cascading side effects broke everything

Pass 2 (relocation-based re-placement of mismatched objects) was implemented but caused catastrophic cascading failures:

1. **Moving objects creates unfillable gaps** — Moving `ut_roff.o` from 0x80027714 to 0x8002E054 left a gap that no other object could fill. `patchSplatForLibs.ts` creates a `c` segment for the gap, but no source file exists for it → linker error.

2. **Step 2b (placing previously-undetected objects) changed linker layout** — Adding 14 new library objects shifted everything, causing 114K diff bytes (worse than the original 234).

3. **Pass 2 was disabled entirely** with `if (false) { ... }` — all the relocation verification code is dead.

### Phase 3: Naming mismatch whack-a-mole

`addLibSymbols.ts` adds library function names to `symbol_addrs.txt` (e.g., `CdFlush = 0x80035A44`). This causes splat to use the library name instead of `func_80035A44` for nonmatchings. But the source file is still `src/func_80035A44.c` with `INCLUDE_ASM("build/asm/nonmatchings/func_80035A44", func_80035A44)` → file not found error.

**Files renamed to "fix" this (4 renames):**
- `func_80035A44.c` → `CdFlush.c`
- `func_80038FE4.c` → `GsSetProjection.c`
- `func_800396C4.c` → `GsSetNearClip.c`
- `func_800396D4.c` → `GsGetWorkBase.c`

**Files deleted as "orphaned" (covered by library .o segments) (6 deletions):**
- `vmNoiseOn.c`, `vmNoiseOff.c`
- `_SsVmSetVol.c`, `_SsVmVSetUp.c`

This was a game of whack-a-mole. Every fix revealed more broken files. At final count, **706 source files** don't match their YAML `c` entries — the build has hundreds of missing nonmatchings errors.

### Phase 4: Additional damage

- **`CdSync` removed from `symbol_addrs.txt`** — was at same address as CdFlush, caused conflict
- **`func_80046D0C` added to symbol_addrs.txt** — pre-existing issue, separate from this plan
- **splat.yaml diverged from backup** in multiple ways:
  - `font.o` rdata/data entries removed (0x1300, 0x4D8F4)
  - 5 text-gap `c` entries replaced by dep-obj `o` entries (de_17, de_18, de_19, s_013, s_015, s_022, s_024)
  - `font.o` text `o` entry replaced by 5 separate `c` entries (SetDumpFnt, FntLoad, FntOpen, FntFlush, FntPrint)
  - `func_80046D0C` text-gap entry added

## Current State of Damage

### Modified files (vs working state):

| File | Changes |
|------|---------|
| `tools/detectLibFunctions.ts` | +300 lines of dead code (`findAllPatterns`, `CandidateMatch`, `verifyRelocations`, disabled Pass 2) |
| `configs/splat.yaml` | Multiple diffs from backup (see above) |
| `configs/symbol_addrs.txt` | `CdSync` removed, `func_80046D0C` added |
| `tools/addLibSymbols.ts` | Unchanged (reverted) |
| `tools/patchSplatForLibs.ts` | Unchanged (reverted) |
| `tools/addDepObjects.ts` | Unchanged (reverted) |

### Deleted source files (need restoration):
- `src/vmNoiseOn.c`
- `src/vmNoiseOff.c`
- `src/_SsVmSetVol.c`
- `src/_SsVmVSetUp.c`

### Renamed source files (need reverting):
- `src/CdFlush.c` → should be `src/func_80035A44.c`
- `src/GsSetProjection.c` → should be `src/func_80038FE4.c`
- `src/GsSetNearClip.c` → should be `src/func_800396C4.c`
- `src/GsGetWorkBase.c` → should be `src/func_800396D4.c`

## Pitfalls and Lessons

### 1. The plan was wrong about scope
The plan said "only `detectLibFunctions.ts` needs changes." This was false. Changing detection placement cascades through:
- `addLibSymbols.ts` (symbol names change)
- `patchSplatForLibs.ts` (YAML segments change)
- `addDepObjects.ts` (dep objects change)
- `splat.yaml` (regenerated differently)
- `symbol_addrs.txt` (new/moved symbols)
- Source files (naming mismatches)
- The linker script (layout changes)

Changing where a `.o` file is placed is not a local change — it ripples through the entire build pipeline.

### 2. No baseline was established before making changes
Should have: committed the working state, created a branch, made changes, verified. Instead: no commits existed, no way to diff or rollback. Every change was permanent.

### 3. Relocation verification is fundamentally limited
`verifyRelocations()` can only verify relocations whose target symbols are already in `symbol_addrs.txt`. Many library objects reference symbols defined in OTHER library objects (e.g., `gs_101.o` references `GsCLIP3near` defined in `gs_104.o`). If the target isn't in the symbol table, verification returns "0 checked" — useless for disambiguation.

### 4. The naming mismatch problem is systemic, not per-file
When `addLibSymbols.ts` adds a real function name (e.g., `CdFlush`) to `symbol_addrs.txt`, splat uses that name for the nonmatchings directory. But the source file still uses `func_XXXXXXXX`. This affects EVERY function that gets a library name added — potentially hundreds of files. Fixing them one-by-one is not viable.

### 5. Moving objects creates gaps that break the build
PSYLINK packs objects contiguously. If you move an object to a different address, the old address becomes a gap. `patchSplatForLibs.ts` fills gaps with `c` segments, but those require source files that don't exist. The linker then fails with undefined references.

### 6. Adding new library objects changes linker layout
Even if an object is correctly detected, adding it to the build changes the linker's output layout. The game was linked with a specific set of objects; adding extras shifts addresses and breaks binary matching.

### 7. The `splat.yaml.backup` was also modified
The backup was supposed to be a reference point, but it was modified too (func_80046D0C entry added, CdFlush/GsSetProjection/GsSetNearClip/GsGetWorkBase renames applied).

## What Should Have Been Done Instead

1. **Commit the working state first** — create a known-good baseline
2. **Work on a branch** — isolatable, revertable
3. **Change ONLY `detectLibFunctions.ts`** — if the detection output changes, the downstream tools should handle it automatically without manual fixes
4. **Test incrementally** — after each change, run `make clean && make split && make` and verify the build still works
5. **Accept that some objects may not be fixable** with detection alone — the 234 diff bytes might require manual address overrides rather than algorithmic fixes

## Recovery Plan

To restore a working build:
1. Restore `splat.yaml` from a known-good source (the backup is close but also tainted)
2. Restore `symbol_addrs.txt` (re-add `CdSync`, remove `func_80046D0C` if it wasn't there before)
3. Revert renamed source files back to `func_XXXXXXXX.c` names
4. Recreate deleted source files (`vmNoiseOn.c`, `vmNoiseOff.c`, `_SsVmSetVol.c`, `_SsVmVSetUp.c`)
5. Revert `detectLibFunctions.ts` to remove dead code (or keep `findAllPatterns` but disable it)
6. Run `make clean && make split && make && make check` to verify
