# PSY-Q Library Detection & Splat Integration

## Goal

Replace disassembled `asm` segments in `configs/splat.yaml` with pre-compiled PSY-Q 4.7 `.o` files
from `lib/`, so library code is linked from the original SDK objects rather than reassembled from
disassembly. This removes ~350 library functions from the decompilation workload and ensures
byte-exact library code.

## Inputs

- **Signature matcher**: `tools/matchSignatures.ts` — scans binary against `tools/psx_psyq_signatures/470/`
  JSON patterns. For each match, returns: VRAM address, obj name (e.g. `C57.OBJ`), lib name
  (e.g. `LIBAPI.LIB`), labels (function names + offsets), and signature byte length.
- **Pre-converted .o files**: `lib/<libname>/<objname>.o` — ELF MIPS-I objects, e.g. `lib/libapi/c57.o`
- **Current splat config**: `configs/splat.yaml` — 700+ `asm` subsegments

## Mapping: Signatures → .o Files

Signature JSON entry:
```json
{ "name": "C57.OBJ", "sig": "...", "labels": [{"name": "InitHeap", "offset": 0}] }
```
From `LIBAPI.LIB.json` → lib dir is `lib/libapi/` → .o file is `lib/libapi/c57.o`

Mapping rules:
- Lib file: `LIBAPI.LIB.json` → strip `.LIB.json`, lowercase → `libapi`
- Obj name: `C57.OBJ` → strip `.OBJ`, lowercase → `c57`
- Path: `lib/libapi/c57.o`

## Plan

### Step 1: Build the address → .o mapping ✅

`tools/detectLibFunctions.ts` — completed and byte-verified.

```
npx tsx tools/detectLibFunctions.ts > build/lib_matches.json           # JSON to stdout
npx tsx tools/detectLibFunctions.ts --verbose > build/lib_matches.json  # with diagnostics on stderr
```

### Step 2: Generate splat segments

Using the mapping from Step 1, transform `configs/splat.yaml`:

1. Parse the existing subsegments list
2. For each `asm` segment, check if its VRAM address falls within a matched .o range
3. If matched: replace with an `o` segment pointing to the .o file (path relative to
   build dir, typically `../../lib/<lib>/<obj>`)
4. If multiple consecutive `asm` segments are covered by one .o file, collapse them
   into a single `o` segment
5. Non-matched `asm` and `c` segments remain unchanged
6. Write the updated splat.yaml

Splat `o` segment format:
```yaml
- [0x1A78, o, ../../lib/libapi/c57]  # InitHeap
```

### Step 3: Update symbol_addrs.txt

From the matched labels, generate/update `configs/symbol_addrs.txt` entries:
```
InitHeap = 0x80011278; // type:func
```

This tells splat the real names of library functions, which it uses for cross-references
in disassembled game code.

### Step 4: Verify

1. `make split` — splat should accept the new .o segments
2. `make` — link should succeed with .o files providing the library code
3. `make check` — binary should still match

## Checklist

### Step 1: Build the address → .o mapping
- [x] Write `tools/detectLibFunctions.ts`
- [x] Reuse signature parsing (`parseSig`, `findPattern`) from `matchSignatures.ts`
- [x] Record start VRAM, end VRAM, .o path, labels for each match
- [x] Get `.text` section size from `.o` files via `readelf` (not from sig length)
- [x] Skip matches where sig length > `.text` size (incomplete .o conversion)
- [x] Deduplicate same-address matches (keep largest `.text`)
- [x] Resolve overlapping matches (keep larger object, drop false positive)
- [x] Validate each `lib/<lib>/<obj>.o` file exists on disk
- [x] Log `.o` files with extra sections (`.data`, `.bss`, `.rdata`, `.sdata`)
- [x] Output JSON mapping to stdout
- [x] Byte-verify all 341 matches against the binary (0 mismatches)

### Step 2: Generate splat segments
- [ ] Parse existing `configs/splat.yaml` subsegments
- [ ] Replace matched `asm` segments with `o` segments (relative path `../../lib/<lib>/<obj>`)
- [ ] Collapse consecutive `asm` segments covered by one .o into a single `o` segment
- [ ] Leave non-matched `asm` and `c` segments unchanged
- [ ] Write updated `configs/splat.yaml`

### Step 3: Update symbol_addrs.txt
- [ ] Generate entries from matched labels
- [ ] Merge with existing `configs/symbol_addrs.txt` entries (don't clobber)
- [ ] Format: `InitHeap = 0x80011278; // type:func`

### Step 4: Verify (incremental — do batches, not all at once)
- [ ] `make split` — splat accepts new .o segments
- [ ] `make` — link succeeds with .o files
- [ ] `make check` — SHA-256 still matches
- [ ] If failures: check `subalign`, data/sdata/bss placement, rodata ordering

## Step 1 Results

### Summary

| Metric | Value |
|--------|-------|
| Matched objects | 341 |
| Total `.text` coverage | 139,152 bytes (0x21F90) |
| Binary `.text` section | 225,056 bytes (0x36F20) |
| Coverage of `.text` | 62% |
| Named function labels | 525 |
| Address range | `0x80024AE4` – `0x80046CA4` |
| Game code (unmatched) | `0x80011270` – `0x80024AE4` (~80KB at start) |

### By library

| Library | Objects | .text bytes |
|---------|---------|-------------|
| libsnd | 101 | 37,520 |
| libapi | 39 | 2,528 |
| libspu | 32 | 14,000 |
| libgte | 32 | 7,216 |
| libmcx | 27 | 11,680 |
| libgpu | 21 | 21,504 |
| libc | 18 | 2,624 |
| libmath | 17 | 5,776 |
| libcd | 14 | 12,720 |
| libcard | 12 | 1,120 |
| libgs | 10 | 3,936 |
| libpad | 7 | 3,968 |
| libmcrd | 6 | 11,296 |
| libetc | 5 | 3,264 |
| libc2 | 1 | 32 |

### Overlap resolution (6 false positives dropped)

All 6 were short signatures (16–48 bytes) that matched instruction patterns inside
a larger, correctly-matched object. The larger match was kept in every case.
Byte-verification confirmed the larger object's full `.text` matches the binary exactly.

| Dropped (false positive) | Size | Kept (correct) | Size |
|--------------------------|------|----------------|------|
| `libcomb/comb_3.o` | 16B | `libmath/eqdf2.o` | 80B |
| `libsnd/sssnc.o` | 48B | `libsnd/ssclose.o` | 464B |
| `libsnd/ut_ron.o` | 32B | `libsnd/ssstart.o` | 784B |
| `libgs/gs_125.o` | 16B | `libetc/vmode.o` | 48B |
| `libgs/gs_101.o` | 16B | `libcd/s_009.o` | 32B |
| `libgte/reg02_8.o` | 16B | `libgte/smp_00_1.o` | 32B |

### Skipped: sig > text (1 bad match prevented)

`SMP_00_1.OBJ` has 3 signature entries (LightColor/48B, OuterProduct0/96B, Lzc/32B)
but the converted `smp_00_1.o` only exports `Lzc` with `.text`=32B. The original OBJ
had all 3 functions; the ELF conversion lost 2. The OuterProduct0 sig (96B) matched in
the binary but would have placed 32 bytes of wrong code. Guard added: skip when
`sigLength > textSize`. The Lzc match at `0x800386d4` is byte-exact and kept.

OuterProduct0 (`0x80038674`) and LightColor (not matched) remain as `asm` segments —
they are library code with no usable `.o` representation.

### Skipped: no .o file (3)

| Signature | Why | Impact |
|-----------|-----|--------|
| `2MBYTE.OBJ` | SN Systems CRT startup (`__SN_ENTRY_POINT`). No converted `.o`. Matches at game entry point which has custom startup code. | None — not a replacement candidate. |
| `op_vnew.obj` | C++ `__builtin_vec_new` from LIBSN. 32B trampoline. `.o` not in `lib/libsn/`. | Negligible. Could extract from `lib/libsn.a` if needed. |
| `op_vdel.obj` | C++ `__builtin_vec_delete` from LIBSN. 32B. Same situation. | Negligible. |

### Objects with extra sections

73 of 341 matched `.o` files have sections beyond `.text` (`.data`, `.bss`, `.rdata`,
`.sdata`). Splat's `o` segment type should handle these automatically by placing each
section in the correct output section. Key examples:

- `lib/libgpu/sys.o`: `.bss` (6,224B), `.rdata` (544B), `.data` (416B)
- `lib/libmcrd/libmcrd.o`: `.bss`, `.rdata`, `.data`
- `lib/libcd/bios_1.o`: `.bss`, `.rdata`, `.data`
- `lib/libc/sprintf.o`: `.rdata`, `.data`

These need their data to land at the same VRAM addresses as the original binary.
If splat doesn't handle this automatically, the linker script will need manual adjustment.

## Potential Issues

- **Object file section alignment**: The pre-converted .o files may have different section
  alignment than what splat expects. May need `subalign` tuning.
- **Data sections in .o files**: 73 objects have `.data`/`.sdata`/`.bss`/`.rodata` sections.
  These need to land at correct VRAM addresses. Verify early with a small batch.
- **Gaps between matched objects**: The library code region (`0x80024AE4`–`0x80046CA4`)
  has unmatched gaps between objects. These are either game code interleaved with library
  code, or library functions whose signatures didn't match. These gaps stay as `asm`.
- **Lost functions**: OuterProduct0 and LightColor from `SMP_00_1.OBJ` have no `.o`
  representation. They stay as `asm` segments.

## Reference

- Silent Hill decomp: uses `o` segments for PSY-Q libs, `lib/versions.txt` tracks versions
- Splat docs: `o` segment type links pre-compiled object files, supports relative paths
- `matchSignatures.ts`: existing pattern matching engine (including `--symbols` flag)
- `detectLibFunctions.ts`: detection tool with byte-verification
