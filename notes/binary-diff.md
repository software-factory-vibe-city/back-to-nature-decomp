# Binary Diff Analysis

**Status:** 22 / 321,536 bytes differ (0.007%)
**All diffs are in library `o` segments** — zero game code diffs.

## Diff Breakdown

### 1. libsnd JAL target swaps (3 instructions, 6 bytes)

`ut_roff.o`, `cc_121.o`, `de_1.o` — SpuSetReverb and SsUtReverbOff resolve to different addresses than original.

| File | VRAM | Original target | Built target | Symbol |
|------|------|----------------|--------------|--------|
| ut_roff | 0x8002771C | 0x80026D44 | 0x8002DF24 | SpuSetReverb |
| cc_121 | 0x800287AC | 0x8002E054 | 0x80027714 | SsUtReverbOff |
| de_1 | 0x8002892C | 0x8002E054 | 0x80027714 | SsUtReverbOff |

**Root cause:** PSYLINK vs GNU ld symbol resolution order. Both `s_ini.o` (_SpuInit) and `s_sr.o` (SpuSetReverb) are correctly matched at their positions (0 byte mismatches), but the original PSYLINK linker resolved cross-references differently. `dep_syms.txt` has `SpuInit = 0x80027714` (resolved from `ssinit_c.o`'s JAL), but in the original binary `SpuInit` is actually at 0x8002E054.

**Fix:** Override `SpuInit`, `SsUtReverbOff`, and `SpuSetReverb` in dep_syms.txt with their correct original addresses (extracted from cross-referencing JAL targets).

### 2. libcd false match + cascading diffs (5 instructions, 8 bytes)

`s_003.o` (CdStatus), `cdr_1.o` — atoi_1.o falsely matches where s_008.o (CdFlush) should be.

| File | VRAM | Original | Built | Issue |
|------|------|----------|-------|-------|
| cdr_1 | 0x800361E4 | jal 0x800367C4 | jal 0x80035A14 | CdSyncCallback wrong addr |
| cdr_1 | 0x80036290 | jal 0x80035A24 | jal 0x80035A44 | CdFlush→CdSync confusion |
| cdr_1 | 0x80036674 | jal 0x800367C4 | jal 0x80035A14 | CdSyncCallback wrong addr |
| cdr_1 | 0x80036818 | lw 0x764C | lw 0x7654 | data ref off by 8 |
| cdr_1 | 0x80036824 | sw 0x764C | sw 0x7654 | data ref off by 8 |
| s_003 | 0x80035A18 | lbu 0x7669 | lbu 0x7658 | data ref off by 17 |

**Root cause:** `atoi_1.o` and `s_008.o` (CdFlush) have identical bytecode (both are 0x20-byte wrappers: save ra, jal target, restore ra, jr ra). The signature matcher wildcards relocations, making them indistinguishable. `atoi_1.o` matches first, claiming the slot at ROM 0x26224 that should be `s_008.o`.

The actual layout at ROM 0x26224:
- 0x80035A24: **CdFlush** (s_008.o) — wrapper calling CD_flush (0x800352C4)
- 0x80035A44: **CdSync** (s_012.o) — wrapper calling CD_sync (0x800348E8)

But we have:
- 0x80035A24: atoi_1.o (atol) — wrong, calls atoi which happens to alias CD_flush's address
- 0x80035A44: CdFlush (c segment) — wrong name, should be CdSync

**Fix:** Add disambiguation to `detectLibFunctions.ts` — when multiple .o files match at the same position, verify relocation targets match expected symbols. Or manually override in symbol_addrs.txt.

### 3. libspu/s_sav HI16 boundary crossing (4 instructions, 4 bytes)

`s_sav.o` — LUI instructions have `0x800A` (original) vs `0x8009` (built).

| VRAM | Original | Built |
|------|----------|-------|
| 0x8002EC68 | lui $a0, 0x800A | lui $a0, 0x8009 |
| 0x8002ECF0 | lui $a1, 0x800A | lui $a1, 0x8009 |
| 0x8002EDAC | lui $a1, 0x800A | lui $a1, 0x8009 |
| 0x8002EE80 | lui $a0, 0x800A | lui $a0, 0x8009 |

**Root cause:** A BSS symbol referenced by s_sav.o sits at ~0x8009FFxx in our build but ~0x800A00xx in the original, crossing the 64KB boundary. This shifts the HI16 part by 1. Likely caused by slightly different BSS ordering from the remaining unresolved `_svm_vg` symbol or cumulative small offsets.

**Fix:** Resolve `_svm_vg` BSS address, or manually override the affected BSS symbol address.

### 4. libgte geo_00 + geo_01 (3 instructions, 3 bytes)

| File | VRAM | Original | Built | Diff |
|------|------|----------|-------|------|
| geo_00 | 0x800389 48 | addiu 0x4018 | addiu 0x4028 | -16 |
| geo_01 | 0x80038C88 | addiu 0x3F30 | addiu 0x3F38 | -8 |
| geo_01 | 0x80038D94 +more | various | various | -8 |

**Root cause:** Data/sdata symbol offset differences. The libgte objects reference global data that's at slightly different offsets in our build.

### 5. Data section (1 byte)

| VRAM | Original | Built |
|------|----------|-------|
| 0x800578F4 | 0x00000000 | 0x00000001 |

In the data region. Likely a flag or counter initialized differently.

## Summary by Root Cause

| Cause | Bytes | Fixable? |
|-------|-------|----------|
| PSYLINK vs GNU ld symbol resolution | 6 | Yes — manual symbol overrides |
| False signature match (identical wrappers) | 8 | Yes — disambiguation logic or manual override |
| BSS 64KB boundary crossing | 4 | Maybe — resolve _svm_vg or override |
| Data/sdata offset diffs | 3 | Investigate |
| Data section init value | 1 | Investigate |
| **Total** | **22** | |

## How to Check

```bash
# Full rebuild from scratch
make clean && make split && make

# Quick diff summary (shows per-section diffs, gap analysis, drift detection)
npx tsx ./tools/diffBinary.ts

# Just check match/mismatch
make check
```

## SDK Version

**Confirmed: PSY-Q SDK v4.70**

The `matchSignatures.ts` heuristic wildcards all relocation bytes (HI16/LO16 immediates, JAL targets), matching only on actual instruction opcodes and registers. All 342 library objects from `lib/` have code that matches the binary when relocations are excluded. This confirms the game was built with SDK v4.70 — the `.o` files are byte-identical to what's in the binary (modulo linker-resolved relocations).

The remaining 22 diff bytes are NOT from wrong SDK version. They are all in relocation-resolved fields (JAL targets, LUI immediates, load/store offsets) where GNU ld resolves symbols to different addresses than the original PSYLINK linker.

## History

| Date | Diff bytes | Change |
|------|-----------|--------|
| Pre-recovery | 234 | Baseline before broken session |
| Post-recovery | 241 | Build fixed, slight increase from tool changes |
| dep_syms filter | 235 | Filtered CdFlush override from dep_syms.txt |
| BSS addend fix | 22 | Fixed extractBssSymAddrs.ts to subtract relocation addends |

## Files Changed

- `tools/extractBssSymAddrs.ts` — Fixed HI16/LO16 addend handling: reads .o file instruction immediates and subtracts them from binary-resolved addresses to get true symbol base addresses
- `tools/addDepObjects.ts` — Added filter to skip dep_syms entries that conflict with existing c/o segments in splat.yaml
- `tools/findMissingLibDeps.ts` — Fixed HI16/LO16 addend handling (same bug as extractBssSymAddrs)
