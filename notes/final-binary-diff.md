# Plan: Fix Remaining 22 Diff Bytes

## Context

The PS1 decompilation build produces a binary that differs by 22 bytes (0.007%) from the original. All diffs are in library `o` segments — zero game code diffs. The 22 bytes trace to 5 root causes, all related to GNU ld resolving relocations differently than the original PSYLINK linker.

The build pipeline auto-generates `dep_syms.txt`, `lib_bss_syms.txt`, and patches library `.o` ELFs. All fixes must be programmatic (no manual edits to generated files).

---

## Fix 1: False Signature Match — atoi_1.o vs s_008.o (8 bytes)

**File:** `tools/detectLibFunctions.ts`

**Problem:** atoi_1.o and s_008.o are both 32-byte JAL wrappers. Signatures wildcard relocations, so they're indistinguishable. atoi_1.o matches first at ROM 0x26224, claiming CdFlush's slot. This cascades into 8 bytes of wrong JAL targets and data refs in cdr_1.o/s_003.o.

**Fix:** In the dedup step (line 428-446), when two candidates match at the same address with the same textSize, use `verifyRelocations()` to pick the correct one:

1. Change the dedup logic: instead of keeping the first seen when sizes are equal, collect all same-address candidates
2. For ties (same address, same textSize), call `verifyRelocations()` on each candidate
3. Keep the one with the highest verification score (most relocations matching known symbols)
4. Load `symbolAddrs` before the dedup step (move it out of the disabled Pass 2 block)

The relocation check will see that at ROM 0x26224, the JAL target is 0x800352C4 (`CD_flush`). s_008.o has a relocation targeting `CD_flush`, atoi_1.o targets `atoi` — s_008.o wins.

**Prerequisite:** `CD_flush` must be in `symbol_addrs.txt`. It should already be there from `addLibSymbols.ts` (it's defined in a matched .o). Verify this; if not, the tool already has the mechanism to add it.

Also enable the disabled Pass 2 (line 478 `if (false)` → remove guard) so multi-match objects also get relocated correctly.

---

## Fix 2: Symbol Resolution Overrides — SpuSetReverb/SsUtReverbOff (6 bytes)

**File:** `tools/addDepObjects.ts`

**Problem:** `dep_syms.txt` has `SpuInit = 0x80027714` (overlapping dep from s_i.o). But SpuSetReverb and SsUtReverbOff — defined by matched .o files s_sr.o and ut_roff.o — resolve to wrong addresses because GNU ld symbol resolution order differs from PSYLINK.

**Root cause:** s_i.o (SpuInit) overlaps ut_roff.o (SsUtReverbOff). The `dep_syms.txt` entry for SpuInit at 0x80027714 is correct. But SpuSetReverb (in s_sr.o) and SsUtReverbOff (in ut_roff.o) aren't in dep_syms.txt, so GNU ld resolves them from the linked .o files — which are at different addresses than the original binary had them.

**Fix:** After generating dep_syms.txt entries for overlapping deps, also scan all matched .o files for global function symbols. For each symbol, compute its correct VRAM from the matched .o's known position (textRom → VRAM + symbol offset within .text). If any dep_syms entry or other overlapping dep defines the same symbol name, add an override with the correct matched address. This ensures GNU ld uses the address from the correctly-placed .o rather than from an overlapping dep.

Specifically, need to add:
- `SpuSetReverb = <correct addr from s_sr.o's position>`
- `SsUtReverbOff = <correct addr from ut_roff.o's position>`

The addresses can be computed: each matched .o's VRAM base is known from libSections.json, and the symbol's offset within .text comes from `nm`.

---

## Fix 3: GNU ld HI16 Carry Bug — s_sav.o, geo_00.o, geo_01.o (7 bytes)

**File:** `tools/patchLibBss.ts` (extend existing .o patching)

**Problem:** GNU ld computes R_MIPS_HI16 incorrectly when .o files have large pre-existing addends that cross 64KB boundaries. s_sav.o has 4 LUI instructions off by 1 (0x8009 vs 0x800A), geo_00.o and geo_01.o have addiu offsets off by 8-16.

**Fix:** Extend the existing .o ELF patching in `patchLibBss.ts` (which already modifies `build/lib/` copies) to also fix HI16 carry issues:

1. For each matched .o in `build/lib/`, read `.rel.text` relocations
2. For HI16/LO16 pairs: read the original binary's resolved instructions at the .o's known ROM offset
3. Read the .o file's unresolved instructions (the addends)
4. Compute what GNU ld will produce vs what the original has
5. If they differ, adjust the .o file's instruction addend to compensate so GNU ld produces the correct result

This is the same approach as the existing BSS patching — modify the `build/lib/` copies before linking.

For geo_00.o/geo_01.o (data offsets), the same mechanism applies — the addiu instructions reference data symbols at slightly wrong offsets. Adjusting the .o addends compensates.

---

## Fix 4: Data Section Init Value (1 byte)

**File:** `tools/patchLibBss.ts` (extend)

**Problem:** At VRAM 0x800578F4, original has 0x00, built has 0x01. This is a static .data byte in a library .o file that doesn't match the binary.

**Fix:** Extend `patchLibBss.ts` to also verify .data section contents:

1. For each matched .o with a .data section, extract .data bytes
2. Compare against the original binary at the known dataRom offset
3. Skip bytes with .rel.data relocations (expected to differ)
4. Patch non-relocation bytes that differ in the `build/lib/` copy

---

## Implementation Order

1. **Fix 1** (8 bytes) — detectLibFunctions.ts dedup disambiguation
2. **Fix 2** (6 bytes) — addDepObjects.ts symbol overrides
3. **Fix 3** (7 bytes) — patchLibBss.ts HI16 carry compensation
4. **Fix 4** (1 byte) — patchLibBss.ts data byte patching

## Verification

After each fix:
```bash
make clean && make split && make
npx tsx tools/diffBinary.ts
make check
```

Diff should decrease: 22 → 14 → 8 → 1 → 0.

## Key Files

- `tools/detectLibFunctions.ts` — Fix 1: dedup + enable Pass 2
- `tools/addDepObjects.ts` — Fix 2: symbol override generation
- `tools/patchLibBss.ts` — Fixes 3 & 4: HI16 compensation + data patching
- `build/libSections.json` — Source of truth for .o ROM/VRAM positions
- `build/dep_syms.txt` — Generated symbol overrides
