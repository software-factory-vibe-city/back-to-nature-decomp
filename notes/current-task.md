# PSY-Q Library Integration — Current Task Status

## Goal

Link pre-compiled PSY-Q library `.o` files directly instead of using INCLUDE_ASM C stubs for matched library functions. This replaces ~43% of `.text` (139KB, 341 matched objects, 525 named function labels) with the original library objects.

## What's Working

### Tools Created

| Tool | Purpose | Status |
|------|---------|--------|
| `tools/detectLibFunctions.ts` | Signature-matches PSY-Q `.o` files against the binary | Done (pre-existing) |
| `tools/addLibSymbols.ts` | Adds function labels to `configs/symbol_addrs.txt` + renames dependency func segments | Done |
| `tools/findMissingLibDeps.ts` | Resolves cross-reference symbols between matched/unmatched `.o` files via relocation decoding | Done |
| `tools/resolveLibSections.ts` | Resolves ROM offsets for `.rdata`, `.data`, `.bss` sections of matched `.o` files using MIPS relocation cross-referencing | Done |
| `tools/patchSplatForLibs.ts` | Patches `configs/splat.yaml` with multi-section `o` segments for all matched library objects | Done |
| `tools/patchLinkerBss.ts` | Patches generated linker script to add library `.bss` entries (idempotent) | Done |
| `tools/addDepObjects.ts` | Links dependency `.o` files into the build — handles text deps, overlapping deps, BSS-only deps, and byte-mismatched deps | **Done (new)** |
| `tools/splat_ext/o.py` | Splat extension enabling the `o` segment type | Done |
| `tools/diffBinary.ts` | Byte-level binary comparison with per-section diff analysis | Done |
| `tools/extractBssSymAddrs.ts` | Extract BSS symbol addresses from original binary via HI16/LO16 scanning | Done |
| `tools/patchLibBss.ts` | Patch library `.o` ELFs for GNU ld BSS compatibility (SHN_ABS conversion) | Done |

### Pipeline

`make split` runs successfully (including after `make clean`):
```
addLibSymbols.ts --write       # adds symbols + renames dependency func segments
patchSplatForLibs.ts --write   # converts c → o segments + adds rdata/data/sdata o entries
                               # scans binary for function boundaries in text gaps
                               # creates per-function c entries, source files, and symbol_addrs.txt entries
                               # removes orphaned source files (functions covered by o segments)
addDepObjects.ts --write       # links dependency .o files (text/BSS/symbol defs)
splat split                    # first pass
fixCrossFileRefs.ts --write    # fixes cross-file label visibility
                               # also adds c entries + source files for new symbols
splat split + fixCrossFileRefs # iterated up to 3x until no more cross-file refs found
patchLinkerBss.ts --write      # patches linker script with library .bss entries
patchLibBss.ts --write         # patches .o ELFs for GNU ld BSS compatibility
append INCLUDE lines           # undefined_funcs_auto.txt + undefined_syms_auto.txt + dep_syms.txt
```

Output: 420 `o` segments total (349 text + 2 dep text + 28 rdata + 41+ data) + ~564 `c` segments

### Build Status

- `make split` — **passes**
- `make` (compile + link) — **passes with 0 linker errors**
- `make check` (binary match) — **fails** (expected, binary mismatch — Task 3)

---

## Completed Tasks

### Task 1: Multi-section `o` segments — COMPLETE

**Problem**: The linker was discarding `.data`, `.bss`, and `.rdata` sections from library `.o` files because splat only generated `.text` entries. This caused ~5,900 "defined in discarded section" linker errors.

**Solution implemented**:

1. **`tools/resolveLibSections.ts`** — Resolves ROM offsets for non-text sections by:
   - Parsing each `.o`'s ELF sections, symbols, and `.rel.text` relocations via `readelf`
   - Reading resolved MIPS HI16/LO16 instruction pairs from the binary at the corresponding text offsets
   - Computing `section_base_vram = (HI16_imm << 16) + sign_extend(LO16_imm) - symbol_addend`
   - Converting to ROM: `rom = vram - 0x80010000 + 0x800`
   - Fuzzy binary matching fallback for 3 edge cases (1 succeeded, 2 unresolved)
   - Results: 29 rdata, 44 data (27 in .data region, 17 in .sdata region), 27 bss

2. **`tools/patchSplatForLibs.ts`** (rewritten) — Now handles all section types:
   - Splits monolithic `.rodata` region (0x800-0x1A70) into interleaved `rodata` + `o` entries
   - Splits monolithic `.data` region (0x38990-0x4DBD8) into interleaved `data` + `o` entries
   - Splits monolithic `.sdata` region (0x4DBD8-0x4F000) for 17 library `.data` sections that straddle the data/sdata boundary
   - Idempotent: strips previous non-text patches while preserving text `o` entries
   - Caches `libSections.json` to `build/` for `patchLinkerBss.ts`

3. **`tools/patchLinkerBss.ts`** — BSS can't go in splat YAML (virtual ROM offsets exceed file size, crashing splat). Instead patches the linker script directly, inserting `lib/xxx.o(.bss);` entries before `main_BSS_END`. Made idempotent: strips existing lib BSS entries before re-adding.

4. **Makefile** updated to run `patchLinkerBss.ts --write` after the final `splat split`.

**Result**: 0 "defined in discarded section" errors. Linker errors reduced from ~5,900 to 365 (all "undefined reference").

### Task 2: Fix 365 Undefined Reference Linker Errors — COMPLETE

**Problem**: 365 "undefined reference" linker errors tracing to 67 symbols across 24 `.o` files. Root cause: `detectLibFunctions.ts` only matches `.o` files by `.text` signature. Dependency `.o` files (referenced by matched objects but not themselves signature-matched) were never added to the build.

**Analysis**: `findMissingLibDeps.ts` resolved all 67 dependency symbols across 24 `.o` files. These fell into distinct categories requiring different handling strategies.

**Solution implemented — `tools/addDepObjects.ts`**:

This tool runs `findMissingLibDeps.ts`, categorizes each dependency `.o` file, and handles it appropriately:

#### Category 1: Text-bearing deps that can be linked as `o` segments (2 files)
Files whose `.text` bytes match the binary at the expected ROM offset, don't overlap existing `o` segments, and don't cross region boundaries:
- `lib/libsnd/ut_ron.o` (SsUtReverbOn, 32 bytes at ROM 0x1E874)
- `lib/libcd/s_004.o` (CdMode, 16 bytes at ROM 0x26FD4)

**Handling**: Inserted as `o` segments in splat.yaml with `# dep-obj` markers for idempotent re-runs. If an existing `c` segment falls within the dep's ROM range, it's removed and a gap `c` entry is added after the dep if needed.

#### Category 2: Overlapping deps — symbols in `.o` files that share ROM space with already-matched objects (10 files, 11 symbols)
These `.o` files start at the same ROM offset as an already-linked `.o` (the PSX linker merged multiple `.o` files contiguously):
- `nedf2.o` (__nedf2) overlaps `eqdf2.o`
- `s_i.o` (SpuInit) overlaps `ut_roff.o`
- `de_17.o`, `de_18.o`, `de_19.o` (_SsSetNrpnVabAttr17/18/19) overlap `de_16.o`
- `s_008.o` (CdFlush) overlaps `atoi_1.o`
- `s_013.o` (CdReady) overlaps `s_006.o`
- `s_014.o` (CdSyncCallback) overlaps `s_009.o`
- `s_015.o` (CdReadyCallback) overlaps `s_009.o`
- `s_022.o` (CdGetSector2) overlaps `bios_2.o`
- `s_024.o` (CdDataSync) overlaps `s_023.o`

**Handling**: Cannot link the `.o` file (it would conflict). Instead, all symbols (func + data) are written as absolute address definitions to `build/dep_syms.txt`, which is INCLUDEd in the linker script.

#### Category 3: Boundary-crossing dep (1 file, 25 symbols)
- `lib/libpad/pdresres.o` — 7792 bytes of `.text` at ROM 0x374A4, ending at 0x39314, which is past the data region start at 0x38990

**Handling**: Same as overlapping — all symbols (func: `_padInitSioMode`, `_padSetCmd`, `_padSendAtLoadInfo`, `_padRecvAtLoadInfo`, `_padCmdParaMode`; data: `_padFuncNextPort`, `_padRestPeriod`, `_padInfoDir`, etc.) written to `build/dep_syms.txt`.

#### Category 4: Byte-mismatched dep (1 file, 1 symbol)
- `lib/libc2/atoi_0.o` (atoi) — 236 of 304 bytes differ at ROM 0x25AC4. The binary has a different version of atoi than the libc2 `.o` file.

**Handling**: Cannot link (wrong bytes). Symbol definition (`atoi = 0x800352c4;`) written to `build/dep_syms.txt`.

#### Category 5: BSS-only deps (2 files, 20 symbols)
Objects with no `.text` (can't be signature-matched or placed in splat.yaml):
- `lib/libsnd/vm_g.o` — 0x1DC bytes BSS, 18 `_svm_*` symbols + `_SsVmMaxVoice` + `kMaxPrograms` (responsible for ~345 of the original 365 errors)
- `lib/libgs/gs_128.o` — 0x40 bytes BSS, `GsIDMATRIX` + `GsIDMATRIX2`

**Handling**: Added to `build/libSections.json` cache with computed BSS VRAM base addresses. `patchLinkerBss.ts` then inserts `lib/xxx.o(.bss);` entries into the linker script at the correct VRAM position. Note: `vm_g.o` has inconsistent layout (PSX linker reordered BSS symbols differently from the `.o` internal layout), so base VRAM is an approximation for ordering.

#### Category 6: Data-only deps (7 files, 8 symbols)
Objects that only provide `.data` symbols already handled by `addLibSymbols.ts` → `symbol_addrs.txt`:
- `s_m.o`, `s_rmp0.o`, `zerobuf.o`, `s_rmp2.o` (libspu data)
- `sincos.o`, `sqrtbl.o`, `cstbl.o` (libgte lookup tables)

**Handling**: No action needed — symbols already in `symbol_addrs.txt`.

#### Idempotency

All lines addDepObjects inserts into the YAML are tagged with `# dep-obj` marker. On re-runs, these are stripped first. Additionally, `o` entries for any dep `.o` path are stripped (handles stale entries from before the marker existed), along with adjacent gap `c` entries.

#### Makefile Integration

- `addDepObjects.ts --write` runs after `patchSplatForLibs.ts` and before the first `splat split`
- `build/dep_syms.txt` is conditionally INCLUDEd in the linker script after `undefined_funcs_auto.txt` and `undefined_syms_auto.txt`

**Result**: 0 undefined reference errors. Build links cleanly.

---

## Current State

### Build Status

- `make split` — **passes**
- `make` (compile + link) — **passes with 0 linker errors**
- `make check` (binary match) — **fails** (241 diff bytes, 0.07%)

### What Matches

- **All game code** (non-library `c` segments) — 0 diffs
- **Rodata, sdata sections** — 0 diffs
- **Data section** — 1 diff byte
- **~302 of 342 library `.o` files** — 0 diffs after linking

### What Doesn't Match: 40 Sections (241 diff bytes)

241 diff bytes across 213 blocks in 40 sections:
- **5 game code `c` segments** (func_800145F0, func_80014854, func_80014988, func_80014BCC, func_80014CBC, func_8002194C) — 7 bytes total
- **35 library `o` segments** — 234 bytes total, predominantly `libsnd` objects

All mismatched library objects are **pure relocation diffs** — the `.o` code bytes are identical when relocation fields are masked out. The v4.70 SDK is correct. Zero objects have actual code differences.

The diffs break into 3 categories:

#### 1. Function address mismatches (all 35 objects)
Every JAL (R_MIPS_26) relocation resolves to a different target. The `.o` files call the right symbol names, but those symbols land at different VRAMs because our link order differs from the original PSYLINK order.

#### 2. BSS/data symbol placement (6 symbols across ~15 objects)
Several BSS/data symbols are at slightly different addresses:
- `_svm_voice`: off by +2
- `_svm_cur`: off by +24
- `GsDRAWENV`: off by +8
- `CD_debug`: off by +8

#### 3. HI16 carry discrepancy (3 objects)
For `rsin_tbl` (geo_00.o, geo_01.o) and `_spu_RQ` (s_sav.o), the HI16 immediate differs by exactly 1 — PSYLINK and GNU ld compute the carry differently for edge-case negative addends.

### Root Cause: Link Order

PSYLINK (the original PSX linker) placed library objects in a different order than our GNU ld linker script does. Since library objects cross-reference each other, different placement → different function addresses → different resolved JAL targets.

### SDK Version: Confirmed v4.70

The `matchSignatures.ts` heuristic IS correct. The signature format wildcards all relocation bytes (HI16/LO16 immediates, JAL targets), so it correctly matches on the actual instruction opcodes/registers. All 342 library objects have code that matches the binary when relocations are excluded.

### Build Recovery (Post-Failed Session) — COMPLETE

**Problem**: A previous LLM session attempted to fix 234 diff bytes by manually editing configs and source files. This broke the build (`undefined reference to func_800471D0`) and left orphaned/duplicate source files. The manual changes were not reproducible.

**Root cause**: `patchSplatForLibs.ts` created only ONE `c` entry per text gap after `o` entries. Gaps can contain many functions (e.g., the pdresres.o gap at 0x374A4-0x38990 had 22 functions). Also, `fixCrossFileRefs.ts` only scanned `build/asm/*.s` (1 file) instead of `build/asm/nonmatchings/*/` (533+ files).

**Fixes applied**:

1. **`tools/patchSplatForLibs.ts`** — Major rework of gap-filling:
   - Builds merged `o` coverage map to find all uncovered text ranges
   - Scans binary for `jr $ra` (0x03E00008) patterns to detect function boundaries within gaps
   - Creates per-function `c` entries tagged `# text-gap` for each discovered function
   - Looks up existing symbol names from `symbol_addrs.txt`; generates `func_XXXXXXXX` for unknown addresses
   - Adds new symbols to `symbol_addrs.txt` with `type:func`; ensures existing gap symbols get `type:func`
   - Creates `src/<name>.c` stub files for new gap functions
   - Removes orphaned source files (functions covered by `o` segments) — prevents Makefile from compiling stubs with no nonmatchings
   - Also adds `c` entries for any `type:func` symbols that exist in `symbol_addrs.txt` but lack YAML entries (handles symbols between existing `c` entries)

2. **`tools/fixCrossFileRefs.ts`** — Two fixes:
   - Now scans `build/asm/nonmatchings/*/` subdirectories (was only scanning top-level `build/asm/*.s`)
   - After adding symbols to `symbol_addrs.txt`, also adds `c` entries to `splat.yaml` and creates source files

3. **`Makefile`** — fixCrossFileRefs + splat split now runs in a loop (up to 3 iterations) until no more cross-file references found, handling cascading splits

**Result**: `make clean && make split && make` passes with 0 linker errors. `make check` shows 241 diff bytes (0.07%), close to the pre-failure 234.

---

## What's Been Built for Binary Matching (Task 3)

### Modifications to Existing Tools

- **`tools/patchLinkerBss.ts`** — Now creates `.lib_bss` NOLOAD section (avoids FILL byte emission), moves sdata-region library `.data` entries to correct output section
- **`Makefile`** — Added `patchLibBss.ts --write` to split pipeline, added INCLUDE for `build/lib_bss_syms.txt`

### Key Technical Findings

- **PSYLINK vs GNU ld BSS**: PSYLINK allocates each BSS symbol independently at arbitrary addresses. GNU ld places entire `.o(.bss)` as one contiguous block. Solution: `patchLibBss.ts` converts BSS symbols to SHN_ABS in the ELF.
- **FILL(0) trap**: Putting BSS entries inside a section with `FILL(0x00000000)` causes GNU ld to emit fill bytes for VMA gaps. Solution: separate NOLOAD section.
- **Splat auto-file conflicts**: `undefined_funcs_auto.txt` symbol assignments override `.o` file definitions in GNU ld. `patchLibBss.ts` strips library-defined symbols from auto files.

---

## Remaining Tasks

ALL TASKS MUST BE COMPLETED IN A PROGRAMMATIC, REPRODUCIBLE WAY.

### Task 3: Fix remaining 241 diff bytes

The root cause is link order. To fix:
1. **Determine original link order** — extract the order PSYLINK placed library objects from the original binary (function addresses imply placement order)
2. **Reorder linker script** — place library `.o` entries in the linker script in the same order as the original
3. **Fix BSS symbol placement** — the 6 BSS/data symbols with small address offsets need exact placement
4. **HI16 carry edge cases** — may need instruction-level patching for the 3 objects where GNU ld computes carry differently
5. **Investigate 7 game code diff bytes** — 5 `c` segments + 1 data byte have small diffs (may be related to cross-file label resolution or assembly differences)

### Task 4: Cleanup

- Update `tools/progress.ts` to account for `o` segments in progress reporting

### Known minor issues

- `lib/libmcrd/init.o` and `lib/libcard/init.o` have 0x10-byte `.data` sections that couldn't be resolved
- `vm_g.o` BSS layout is inconsistent (different symbols give different computed base addresses)
- `atoi_0.o` byte mismatch suggests the game may use a different `atoi` implementation than libc2's
- `lib/libgpu/font.o` excluded (different SDK version — `.data`/`.rdata`/`.text` don't match binary)

---

## Key Design Decisions Made

1. **`o` segment type via splat extension** (not linker script post-processing): Using splat's native segment system. This is the approach used by silent-hill-decomp.

2. **`../lib/` path prefix**: Splat prepends `build/` to paths, so `o` segments use `../lib/libfoo/bar` which resolves to `build/../lib/libfoo/bar.o` = `lib/libfoo/bar.o`.

3. **BSS via linker script patching, not YAML**: BSS sections have no ROM content. Virtual ROM offsets exceed file size, crashing splat's bounds checking. `patchLinkerBss.ts` patches the linker script directly instead.

4. **Data entries split across data/sdata regions**: 17 library `.data` sections have ROM offsets >= 0x4DBD8 (sdata start). These are interleaved within the sdata region of the YAML rather than the data region.

5. **Section resolution via relocation cross-referencing**: Rather than brute-force matching data bytes, we read MIPS HI16/LO16 relocation pairs from `.o` files and the corresponding resolved instructions from the binary. This gives exact VRAM addresses for 97% of sections (72/75).

6. **Dependency func symbols get renamed**: When `addLibSymbols.ts` adds a symbol for an address that's still a `c` segment, it renames the YAML segment name and the `src/*.c` file to match.

7. **Detection labels use `type:func`; dependency labels don't**: Only symbols within matched `o` ranges get `// type:func` in `symbol_addrs.txt`.

8. **Overlapping deps use absolute symbol definitions**: When a dependency `.o` file's text overlaps with an already-linked `.o` (common in PSX static linking where the linker packed objects contiguously), we can't link both. Instead we emit `symbol = 0xADDRESS;` lines in `build/dep_syms.txt`. The parent `.o` already provides the code bytes; we just need the linker to know the symbol addresses.

9. **Boundary-crossing deps treated as overlapping**: `pdresres.o` spans from text region into data region. Splat can't handle a single `o` segment crossing region boundaries, so all its symbols are defined via `dep_syms.txt`.

10. **Byte-mismatched deps get symbol defs**: If a dep's `.text` doesn't match the binary (e.g., `atoi_0.o`), the game uses a different implementation. We define the symbol at the correct address rather than linking the wrong bytes.

11. **Idempotent dep insertion with `# dep-obj` markers**: All YAML lines inserted by `addDepObjects.ts` include a `# dep-obj` comment. On re-runs, these are stripped before re-processing, plus any stale `o` entries for dep paths are cleaned up.

## File Locations

- Splat config: `configs/splat.yaml`
- Symbol addresses: `configs/symbol_addrs.txt`
- Splat extension: `tools/splat_ext/o.py`
- Library objects: `lib/<libname>/<obj>.o`
- Library archives: `lib/<libname>.a`
- Generated linker script: `slus_011.ld`
- Dep symbol definitions: `build/dep_syms.txt`
- Build output: `build/`
- Cached section info: `build/libSections.json`

## Reference Projects

- [silent-hill-decomp](https://github.com/Vatuu/silent-hill-decomp) — uses the same `o` segment approach with multi-section entries
