# Library Detection Gap Fixes

## Problem

After cutting over to linking pre-compiled PSY-Q SDK library `.o` files, 11 `src/*.c` files remained as orphans — they were PSY-Q SDK functions being compiled from INCLUDE_ASM stubs instead of linked as library objects:

- **libgpu/font.o** (5 functions): SetDumpFnt, FntLoad, FntOpen, FntFlush, FntPrint
- **libpad/pdresres.o** (5 functions): \_padInitSioMode, \_padSetCmd, \_padSendAtLoadInfo, \_padRecvAtLoadInfo, \_padCmdParaMode
- **libsnd/dmynot1.o** (1 function): dmy\_nothing1

All three had different root causes in the detection/patching pipeline.

## Root Causes & Fixes

### 1. pdresres.o — Scan bounds excluded large signatures

**Root cause**: `findAllPatterns` in `detectLibFunctions.ts` used `i <= searchEnd - sigLen` as its loop bound. pdresres.o's signature is 7792 bytes, so the scan only checked offsets up to `0x38990 - 7792 = 0x1AB20`. The actual match is at ROM 0x374A4 — never reached.

**Fix** (`detectLibFunctions.ts` line 89): Changed scan bound to `Math.min(searchEnd, binary.length - sigLen)`. Signatures can now start within the text section even if they extend past `searchEnd` into adjacent sections. The full pattern must still match, preventing false positives.

**Cascade issue — text/data boundary**: pdresres.o's .text (7792 bytes) extends 0x384 bytes past what splat.yaml called the data section start (0x38990). Those bytes were actually code, not data.

**Fix** (`patchSplatForLibs.ts`): Added dynamic `DATA_ROM_START` computation. After loading library sections, the tool checks if any .text extends past the default boundary and pushes it forward. Replaced 5 hardcoded `0x38990` references with the dynamic value.

### 2. font.o — Hardcoded exclusion blocklist

**Root cause**: `patchSplatForLibs.ts` had a hardcoded `EXCLUDE_OFILES` set containing `lib/libgpu/font.o` with the comment "different SDK version — .data/.rdata/.text don't match binary". Investigation showed the .text matches perfectly (differences only at relocation sites), and both .rdata and .data differences are entirely at relocation sites (132/160 rdata bytes differ = exactly 33 relocations * 4 bytes; all .data differences are relocated bytes too).

**Fix** (`patchSplatForLibs.ts`): Removed the `EXCLUDE_OFILES` blocklist and all associated code (the exclusion check in o-entry handling that replaced excluded entries with c entries).

**Cascade issue — data/sdata boundary**: font.o's .data section (2960 bytes, ROM 0x4D8F4) starts in the data region but extends 0x8AC bytes past the sdata boundary (0x4DBD8) to 0x4E484. The sdata assembly file also contained those bytes, causing 0x8AC bytes of duplication in the linked binary.

**Fix** (`patchSplatForLibs.ts`): Added `effectiveSdataStart` computation. When a data-region library entry extends past SDATA_START, the sdata region start is pushed forward to avoid overlap. The `interleaveEntries` calls and `stripNonTextPatches` both use the adjusted boundary.

### 3. dmynot1.o — Trivial signature with no relocations

**Root cause**: dmynot1.o's signature is 16 bytes (`jr $ra; nop; nop; nop`) — matches 65 locations in the binary. During Pass 1 dedup, it loses to larger objects at the same addresses. Pass 2b recovery requires relocation score > 0, but dmynot1.o has zero relocations.

**Fix** (`detectLibFunctions.ts` Pass 2b): For zero-relocation multi-match candidates, added symbol address disambiguation. The tool checks if placing the object at a candidate offset aligns any of its function labels with known addresses in `symbol_addrs.txt`. dmynot1.o's `dmy_nothing1` label matches the known address 0x800386C4, resolving the correct placement.

### 4. rdata byte patching (preventive)

**Root cause**: `patchLibBss.ts` patched .data byte mismatches but not .rdata. This was the original reason font.o was excluded — though investigation showed no actual rdata patching is needed (all differences are at relocation sites).

**Fix** (`patchLibBss.ts`): Added `patchRdataBytes` function with identical logic to `patchDataBytes` — compares .rdata bytes against the original binary, skips relocated bytes, patches non-matching non-relocated bytes. Wired into the main processing loop as "Fix 5".

## Files Changed

| File | Changes |
|------|---------|
| `tools/detectLibFunctions.ts` | Scan bound fix in `findAllPatterns`; symbol-based disambiguation in Pass 2b |
| `tools/patchSplatForLibs.ts` | Removed `EXCLUDE_OFILES`; dynamic `DATA_ROM_START` and `effectiveSdataStart`; flexible regex for data/sdata lines |
| `tools/patchLibBss.ts` | Added `patchRdataBytes` function and wiring |

## Results

- Library detection: 356 -> 358 matched objects, 139,616 -> 147,392 bytes .text coverage
- 11 orphaned src files eliminated
- Game functions: 557 -> 529 (28 absorbed into library objects from text gaps, including unnamed `func_XXXX` gap functions)
- `make check` passes — binary still matches SHA-256

## Remaining

88 text-gap entries existed originally. The 11 named ones are resolved. The remaining ~60 unnamed text-gap functions (`func_XXXX`) may also be library code — worth investigating whether additional library objects can be detected with these fixes (some may now be found by the improved scan bounds and disambiguation).
