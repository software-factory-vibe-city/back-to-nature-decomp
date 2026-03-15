# Decompilation Pipeline & Strategies

## Overview

The project uses an incremental decompilation pipeline. Every function in the binary has a dedicated `.c` file with an `INCLUDE_ASM` stub. Functions can be decompiled one at a time by replacing the stub with real C, while the build stays matching throughout.

The build system has two major subsystems:
1. **Library integration** — Automatically detects, places, and patches ~355 pre-compiled PSY-Q SDK `.o` files into the build
2. **Game code decompilation** — ~557 C functions compiled from source, initially as assembly stubs

## Build Flow

```
make split    →  library detection + splat split + linker/ELF patching
make          →  compiles all .c files (INCLUDE_ASM pulls in .s), links
make check    →  SHA-256 verify against original binary
make progress →  reports decompilation status
```

## Phase 1: Library Detection & Symbol Resolution

These steps run before splat to identify PSY-Q SDK library code in the binary and set up symbol names.

### Step 1: `addLibSymbols.ts`

Orchestrates library detection and populates `configs/symbol_addrs.txt` with function/data names so splat uses real names in disassembly.

Internally runs:
- **`detectLibFunctions.ts`** — Signature-based library function detection
- **`findMissingLibDeps.ts`** — Finds dependency `.o` files not caught by signatures
- **`resolveLibSections.ts`** — Maps library `.o` data/rdata/bss sections to ROM offsets

**detectLibFunctions.ts** is the core detection engine:

1. Loads hex byte patterns from `tools/psx_psyq_signatures/` (PSY-Q 4.7 JSON signature databases)
2. Scans the binary at 4-byte-aligned offsets for pattern matches (wildcarding relocation bytes)
3. Cross-references matches against pre-compiled `.o` files in `lib/`
4. **Dedup** — When multiple candidates match at the same address: largest `.text` wins. On ties, `verifyRelocations()` scores each candidate by checking R_MIPS_26 (JAL) and HI16/LO16 targets against known symbol addresses
5. **Pass 2a** — Relocates matched multi-match objects to better offsets if relocation scores improve
6. **Pass 2b** — Places previously-rejected multi-match candidates at alternative offsets, requiring relocation verification score > 0

Output: JSON array of `{ vramStart, vramEnd, oPath, textSize, labels[], ... }`.

**addLibSymbols.ts** also:
- Extracts global data/rdata symbols from matched `.o` files via `nm` and `resolveLibSections.ts` output
- Removes stale symbols when a function moves to a different address
- Reverts misnamed splat segments when symbols are reassigned

### Step 2: `patchSplatForLibs.ts`

Patches `configs/splat.yaml` to use `o` (object file) segments instead of `c` (C source) segments for detected library code.

For each matched `.o`, replaces the C function entries spanning its address range with a single `o` entry pointing to the library `.o` file. Also adds separate `o` entries for library `.rdata` and `.data` sections.

Removes stale `o` entries from previous runs that are no longer in the current detection results.

### Step 3: `addDepObjects.ts`

Handles dependency `.o` files — library objects needed by detected objects but not directly matched by signatures.

Three strategies depending on overlap:
- **Non-overlapping text deps** — Adds `o` segments to `splat.yaml`
- **Overlapping text deps** — Writes symbol address definitions to `build/dep_syms.txt` (linker script `PROVIDE` assignments)
- **BSS-only deps** — Records section metadata in `build/libSections.json`

Also generates **symbol overrides** (Step 5b): for matched `.o` files with global function symbols, adds explicit address definitions to `dep_syms.txt` when an overlapping dep defines the same symbol at a different address. This forces GNU ld to use the correct address.

### Step 4: `mergeFragments.ts`

Detects and merges fall-through function fragments — cases where spimdisasm incorrectly splits a single function at internal branch targets (typically loop labels).

**Detection:** For each consecutive pair of game functions (`func_XXXXXXXX`), reads the last two instructions before the next function's start address. If neither is `jr $ra` nor a tail-call `j` to another function, the function falls through — meaning spimdisasm split one function into two at an internal label.

Functions that are `jal` targets or cross-function `j` targets are never treated as fragments (they're real entry points called from elsewhere).

**Merge strategy using spimdisasm's `type:label` and `size:` attributes:**

1. **`size:` on the head function** — Tells spimdisasm the true function extent. Without this, spimdisasm ends the function at the first `jr $ra` + delay slot, even if the function continues (e.g., a conditional early return before a loop).

2. **`type:label` for unreferenced fragments** — Changes `type:func` to `type:label` in `symbol_addrs.txt`. spimdisasm's `isTrustableFunction()` returns `False` for `branchlabel` type, so it treats the address as an internal branch label rather than a function boundary. The label becomes a `.L`-prefixed local symbol.

3. **`type:func` for externally-referenced fragments** — If a fragment address is branched to from outside the merge group (detected by scanning all `j`, `jal`, `beq`, `bne`, etc. instructions in the binary), it stays as `type:func`. spimdisasm emits these as `alabel` (the `ASM_TEXT_ALT_LABEL` macro) which expands to `.globl` + `.aent`, making the label globally visible for cross-file references.

**Cleanup:** Removes splat.yaml subsegments and stale `.c` source files for absorbed fragments. Resets head function source files to `INCLUDE_ASM` stubs if they contain stale C code from before the merge.

**Pipeline position:** Runs twice — once after `bootstrap.ts` (first pass), and again after the `fixCrossFileRefs` loop (which may re-add fragment entries). A final `splat split` regenerates assembly with the merged boundaries.

## Phase 2: Splat Split

```bash
SPIMDISASM_ARCHLEVEL=1 splat split configs/splat.yaml
```

Splat reads the patched `configs/splat.yaml` and the original binary, producing:
- `build/asm/` — Disassembled `.s` files for each function (with resolved symbol names from `symbol_addrs.txt`)
- `slus_011.ld` — Initial linker script mapping sections to memory
- `build/undefined_funcs_auto.txt`, `build/undefined_syms_auto.txt` — Auto-generated symbol definitions

For `o` segments, splat copies the library `.o` file reference into the linker script directly.

### Cross-File Reference Fixing

After splat, `fixCrossFileRefs.ts` runs in a loop (up to 3 iterations):
1. Checks for cross-file symbol references between disassembled functions
2. Fixes them and re-runs splat
3. Stops when "No cross-file refs" is reported

## Phase 3: Linker Script & ELF Patching

### `patchLinkerBss.ts`

Adds library `.bss` entries to the linker script (splat can't handle BSS in YAML because BSS has virtual addresses past the file end):
- Creates a `.lib_bss` NOLOAD section with all library `.o(.bss)` entries ordered by VRAM
- Runs `extractBssSymAddrs.ts` to compute global BSS symbol addresses and writes `build/lib_bss_syms.txt`
- Moves sdata-region library `.data` entries from the data section to the sdata section

**`extractBssSymAddrs.ts`** resolves BSS symbol addresses by:
1. Collecting all BSS symbol names from library `.o` files
2. Scanning `.rel.text` HI16/LO16 relocation pairs to compute absolute VRAM for each BSS symbol
3. Using section-relative resolution within `.o` files that have both `.bss` and `.text`
4. Falling back to cross-object reference scanning for remaining unresolved symbols

### `patchLibBss.ts`

The most complex patching step. Copies all library `.o` files to `build/lib/`, applying three types of patches:

#### 1. BSS Symbol Resolution

The original PSX linker (PSYLINK) allocated each BSS symbol independently at arbitrary VRAM addresses. GNU ld places the entire `.bss` section as a contiguous block. Fix:

- Converts all BSS symbols from section-relative (`st_shndx` = `.bss` index) to `SHN_ABS` with correct absolute VRAM addresses
- Sets `.bss` section size to 0 and clears `SHF_ALLOC` flag (prevents GNU ld from allocating space)
- Address sources: `build/lib_bss_syms.txt` (global BSS symbols), HI16/LO16 pair resolution from the original binary (local BSS symbols), `bssVram` from `libSections.json` (BSS-only files)

#### 2. HI16 Carry Compensation

Sony's PSYQ assembler and GNU ld interpret HI16/LO16 instruction addends differently:

| | Formula |
|---|---|
| **PSYQ (Sony)** | `AHL = (hi << 16) \| lo` (unsigned concatenation) |
| **GNU ld** | `AHL = (hi << 16) + sign_extend(lo)` |

When `lo >= 0x8000`, GNU ld's sign extension subtracts an extra `0x10000`, causing the LUI instruction to be off by -1. Fix: increment the HI16 addend by 1 whenever the paired LO16 addend is >= `0x8000`.

#### 3. Data Byte Patching

Some library `.o` files have `.data` section bytes that don't match the original binary (e.g., initialized static variables with different default values). Fix: compare `.data` bytes against the original binary at the known ROM offset, patch non-relocated bytes that differ.

#### Why build-time patching instead of fixing the `.o` files directly?

The library `.o` files in `lib/` are produced by `psyq-obj-parser` (from the pcsx-redux project), which converts Sony's proprietary PSY-Q object format to standard ELF. The converted files are used as-is — patches are applied at build time rather than baked into `lib/`.

This is a deliberate design choice for **reusability across games**. Each PSX game links a different subset of SDK objects, and different objects trigger different edge cases:

- **BSS layout** varies per game because PSYLINK assigned BSS addresses based on the game's specific link order.
- **HI16 carry** only triggers in objects where a relocation's LO16 addend >= `0x8000`. In SDK 4.7, this affects `libspu/s_sav.o` (4 cases), `libgte/geo_00.o` (1 case), and `libgte/geo_01.o` (2 cases). A different game using different SDK objects or a different SDK version would have different affected files.
- **Data byte differences** occur when game developers modified SDK defaults before linking. For this game, `libcd/bios_1.o` has a single byte changed — the `CD_set_test_parmnum` default was changed from `1` to `0` (a CD subsystem test parameter). Other games would have their own modifications, or none at all.

The automated detection approach means the tooling handles whatever a new game throws at it without manual per-file investigation. This contrasts with projects like the Silent Hill decomp, which manually patches each `.o` file using LIEF scripts and documents each change in `lib/versions.txt` — an approach that requires re-investigation for every new game.

**psyq-obj-parser's role in the HI16 issue:** psyq-obj-parser does have some HI16 carry compensation code, but it only applies when writing `st_value` (symbol offset values extracted from PSY-Q opcodes). It does not adjust instruction-embedded addends — when the PSY-Q assembler emits `lui $reg, 0xffff` as part of a HI16 relocation, that value is copied verbatim into the ELF. This is arguably a limitation of the converter, but rather than forking psyq-obj-parser, we fix it generically at build time.

After patching, updates `slus_011.ld` to reference `build/lib/` instead of `lib/`, and strips library-defined symbols from `undefined_funcs_auto.txt` / `undefined_syms_auto.txt` to prevent address conflicts.

### Linker Script Finalization

The Makefile appends symbol definition includes to the linker script:
```
INCLUDE "build/undefined_funcs_auto.txt"
INCLUDE "build/undefined_syms_auto.txt"
INCLUDE "build/dep_syms.txt"        (if exists)
INCLUDE "build/lib_bss_syms.txt"    (if exists)
```

## Phase 4: Compilation & Linking

### C Compilation Pipeline

```
src/FUNC.c → cpp → cc1 → maspsx → as → build/src/FUNC.c.o
```

| Stage | Tool | Purpose |
|-------|------|---------|
| Preprocessor | `mips-linux-gnu-cpp` | Expands `#include`, `INCLUDE_ASM` macros |
| Compiler | `cc1` (GCC 2.8.0) | C → MIPS assembly. Flags: `-mips1 -mcpu=r3000 -O2 -G8` |
| Macro assembler | `maspsx` | PSX-specific assembly fixups |
| Assembler | `mips-linux-gnu-as` | Assembly → ELF `.o` |

GCC version 2.8.0 is used to match the original compiler's code generation. The `-G8` flag puts variables <= 8 bytes in the small data section (`sdata`/`sbss`) for GP-relative access.

### Assembly

Splat-generated `.s` files in `build/asm/` are assembled directly:
```
build/asm/SECTION.s → as → build/asm/SECTION.s.o
```

### Linking

```
mips-linux-gnu-ld -EL -T slus_011.ld → build/slus_011.elf
mips-linux-gnu-objcopy -O binary     → build/slus_011.bin
```

## Phase 5: Verification

```bash
make check
```

Extracts the payload (321,536 bytes at offset 0x800) from both the original binary and the built binary, compares SHA-256 hashes.

## Segment Configuration (`configs/splat.yaml`)

Each function is a `c` segment:
```yaml
- [0x1A78, c, __start]       # 0x80011278 __start
```

Library code uses `o` segments (inserted by `patchSplatForLibs.ts`):
```yaml
- [0x15004, o, ../lib/libcd/cdr_1]   # lib/libcd/cdr_1.o
```

When splat processes a `c` segment, it:
1. Generates per-function `.s` files at `build/asm/nonmatchings/SEGMENT/FUNC.s`
2. If `src/FUNC.c` doesn't exist, creates it with `#include "common.h"` and an `INCLUDE_ASM` stub
3. For trivial functions (`jr $ra` + `nop`), writes real C (`void func(void) {}`)

Splat will **not** overwrite an existing `.c` file.

## INCLUDE_ASM Macro (`include/include_asm.h`)

The macro inlines the assembly `.s` file into the C compilation unit:
```c
#define INCLUDE_ASM(FOLDER, NAME) \
    __asm__( \
        ".section .text\n" \
        "    .set noat\n" \
        "    .set noreorder\n" \
        "    .include \"" FOLDER "/" #NAME ".s\"\n" \
        "    .set reorder\n" \
        "    .set at\n" \
    )
```

The original assembly is compiled through the C toolchain, producing identical output until replaced with real C.

## Assembly Macros (`include/macro.inc`)

The `.s` files generated by spimdisasm (splat's disassembler) use macros like `glabel`, `endlabel`, `jlabel`, `alabel`, and `nonmatching` instead of raw asm directives. These are defined in `macro.inc`, which is included via `include_asm.h` at the assembly level.

| Macro | Expands to | Used for |
|-------|-----------|----------|
| `glabel` | `.globl` + `.type @function` + `.ent` | Function entry points |
| `alabel` | `.globl` + `.type @function` + `.aent` | Alternative entries within a function (e.g., merged fragments referenced externally) |
| `endlabel` | `.size` + `.end` | Function end |
| `jlabel` | `.globl` | Jumptable branch targets |
| `nonmatching` | `.global NAME.NON_MATCHING` | Marks unmatched functions |

The `jlabel` and `alabel` macros must use global visibility (not local) so that jumptable entries in rodata and cross-function branches can reference labels inside function code across object files. This is why the Makefile defines `-DINCLUDE_ASM_USE_MACRO_INC=1`.

spimdisasm uses `alabel` (configured as `ASM_TEXT_ALT_LABEL`) for `type:func` symbols that appear in the middle of a sized function — i.e., when a fragment stays as `type:func` because it's branched to from outside the merge group.

## Decompiling a Function

1. **Pick a function** — start with small, simple ones (few instructions, no dependencies)
2. **Read the `.s` file** in `build/asm/nonmatchings/`, not objdump output — it has resolved symbol names (e.g., `%gp_rel(D_8005E274)`) rather than unresolved relocations
3. **Run m2c** on the `.s` file for a rough C translation — usually not matching, but a solid starting point
4. **Replace** the `INCLUDE_ASM(...)` line in `src/FUNC.c` with the C code
5. **Diff** — run `npx tsx tools/diffFunc.ts src/FUNC.c build/src/FUNC.c.o` to compare the compiled C against the original. It shows a side-by-side objdump diff with a match percentage, and watches the file for changes so you get instant feedback on each save
6. **Iterate** — tweak the C until diffFunc shows 100% match. Variable ordering, struct layout, cast placement, loop structure all matter for matching GCC 2.8.0 output
7. **`make check`** — verify the full binary still matches SHA-256

## Reading Disassembly

### Variable types from instructions

The store/load instruction tells you the variable's size:

- `sb` / `lbu` / `lb` — `char` (1 byte)
- `sh` / `lhu` / `lh` — `short` (2 bytes)
- `sw` / `lw` — `int` or pointer (4 bytes)

Signed vs unsigned: `lb` (sign-extends) -> `signed char`, `lbu` (zero-extends) -> `unsigned char`. Same for `lh` vs `lhu`.

### GP-relative addressing

The `gp` register points to `0x8005E274` (set in splat.yaml). Variables in `sdata`/`sbss` sections are accessed relative to `gp`:

```
sb $a0, %gp_rel(D_8005E274)($gp)
```

The `-G8` compiler flag controls this: variables 8 bytes or smaller get gp-relative access instead of the two-instruction `lui`/`addiu` sequence.

### Memory layout

```yaml
- [0x38990, data]     # 0x80048190 – 0x8005D3D8
- [0x4DBD8, sdata]    # 0x8005D3D8 – 0x8005E800
```

If a symbol address falls in `sdata` range, it's a small global accessed via gp. If it falls in `data`, it uses `lui`/`addiu` (absolute addressing).

### Extern declarations

Any global variable a function accesses but doesn't define is `extern`. Since functions are decompiled individually, almost every global reference will be `extern`. These go in shared headers so all `.c` files can use them.

## Grouping Functions into Source Files

The per-function split is a starting point, not the end state. As decompilation progresses, functions that belonged to the same original `.c` file should be consolidated.

Signals that functions belong together:

- They share static variables
- They have `static` helper functions only called by neighboring functions
- Adjacent functions all operate on the same struct types or data
- They reference the same `.rodata` or `.data` entries

## Key Files & Artifacts

| File | Role |
|------|------|
| `configs/splat.yaml` | Binary splitter configuration (c/o/data segments) |
| `configs/symbol_addrs.txt` | Symbol name -> VRAM address mapping |
| `slus_011.ld` | Generated + patched linker script |
| `build/libSections.json` | Library .o section metadata (ROM offsets, sizes) |
| `build/dep_syms.txt` | Symbol definitions for overlapping dependency objects |
| `build/lib_bss_syms.txt` | Global BSS symbol absolute addresses |
| `build/lib/` | Patched library .o files (BSS resolved, HI16 fixed, data patched) |
| `build/asm/` | Splat-generated assembly files |
| `lib/` | Original PSY-Q SDK .o files (unmodified) |
| `tools/psx_psyq_signatures/` | PSY-Q 4.7 signature databases |

## Pipeline Dependency Graph

```
bootstrap.ts ─────────┐  (generates symbol_addrs.txt + splat.yaml from scratch)
                      │
mergeFragments.ts ────┤  (detects fall-through fragments, adds size:/type:label)
                      │
addLibSymbols.ts ─────┤  (detects libs, populates symbol_addrs.txt)
                      │
patchSplatForLibs.ts ─┤  (patches splat.yaml: c→o for lib code)
                      │
addDepObjects.ts ─────┤  (adds deps, writes dep_syms.txt + libSections.json)
                      │
                      v
              splat split ◄──── fixCrossFileRefs.ts (loop up to 3x)
                      │
mergeFragments.ts ────┤  (2nd pass: re-labelify entries added by fixCrossFileRefs)
                      │
              splat split        (re-split with final merged boundaries)
                      │
                      v
         patchLinkerBss.ts      (adds .bss to linker script, writes lib_bss_syms.txt)
                      │
          patchLibBss.ts        (patches .o files → build/lib/)
                      │
      linker script finalized   (appends symbol includes)
                      │
                      v
            compile + link + verify
```

## Tools

| Tool | Purpose |
|------|---------|
| `tools/detectLibFunctions.ts` | Signature-based PSY-Q library function detection with dedup/verification |
| `tools/addLibSymbols.ts` | Merges library labels + data symbols into symbol_addrs.txt |
| `tools/patchSplatForLibs.ts` | Patches splat.yaml to use o segments for library code |
| `tools/addDepObjects.ts` | Adds dependency objects, generates dep_syms.txt |
| `tools/resolveLibSections.ts` | Maps library .o data/rdata/bss sections to ROM offsets |
| `tools/extractBssSymAddrs.ts` | Computes absolute VRAM for BSS symbols via HI16/LO16 resolution |
| `tools/patchLinkerBss.ts` | Adds library BSS to linker script, generates lib_bss_syms.txt |
| `tools/patchLibBss.ts` | Patches library .o files (BSS, HI16 carry, data bytes) |
| `tools/findMissingLibDeps.ts` | Finds undetected dependency .o files |
| `tools/matchSignatures.ts` | SDK version identification diagnostic |
| `tools/diffBinary.ts` | Binary comparison diagnostic (per-section diff counts, gap analysis) |
| `tools/diffFunc.ts` | Per-function diff with match % and file watching |
| `tools/convertToC.ts` | Bulk-converts asm -> c segments in splat.yaml |
| `tools/splitSegments.ts` | Splits multi-function segments into one-per-function |
| `tools/progress.ts` | Reports decompilation progress (function count + bytes) |
| `tools/fixCrossFileRefs.ts` | Fixes cross-file symbol references after splitting |
| `tools/mergeFragments.ts` | Detects/merges fall-through function fragments using size: and type:label |

### Progress Tool

```
npx tsx tools/progress.ts              # summary
npx tsx tools/progress.ts --remaining  # list functions not yet decompiled
npx tsx tools/progress.ts --done       # list completed functions
npx tsx tools/progress.ts --list       # all functions with status
```

## Key Constants

| Constant | Value |
|----------|-------|
| Load address | `0x80010000` |
| Payload offset | `0x800` (PSX-EXE header size) |
| Entry point | `0x80011278` |
| Payload size | 321,536 bytes |
| GP register | `0x8005E274` |
| GCC version | 2.8.0 |
| PSY-Q SDK version | 4.7 |
