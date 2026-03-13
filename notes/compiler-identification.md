# Compiler Identification

## Goal

Determine the exact compiler and SDK version used to build the original binary (SLUS-01115).
This is needed to correctly configure spimdisasm (`--compiler` flag) and the build toolchain.

## Step 1: Identifying the SDK — String Search

### Approach

The simplest way to identify a toolchain is to search for embedded strings in the binary.
Compilers and SDKs often embed version strings, copyright notices, or library names.

### What we searched for

```bash
# Search 1: compiler/toolchain keywords
strings extracted/iso/slus_011.15 | grep -iE \
  "gcc|gnu|psy-?q|sony|sn systems|sn64|metrowerks|green.hills|version|compiler|copyright|mips"

# Results:
#   Sony Computer Entertainment Inc. for North America area
#   Library Programs (c) 1993-1997 Sony Computer Entertainment Inc., All Rights Reserved.

# Search 2: SDK/build keywords
strings extracted/iso/slus_011.15 | grep -iE "^\(c\)|built|compiled|link|sdk|lib"

# Results:
#   libmcrd: event overflow
#   Library Programs (c) 1993-1997 Sony Computer Entertainment Inc., All Rights Reserved.

# Search 3: library names
strings extracted/iso/slus_011.15 | grep -iE "lib[a-z]{2,}"

# Results:
#   libmcrd: event overflow
#   Library Programs (c) 1993-1997 Sony Computer Entertainment Inc., All Rights Reserved.
```

### How we interpreted the results

1. **"Library Programs (c) 1993-1997 Sony Computer Entertainment Inc."** — this is the
   standard copyright string embedded in PSY-Q SDK runtime libraries. It appears in
   PSY-Q-linked binaries when SDK library code is included. This string alone strongly
   indicates PSY-Q SDK usage, as it's not present in binaries built with alternative
   toolchains (PSn00bSDK, raw GCC cross-compilers, etc.).

2. **`libmcrd`** — this is the PSY-Q memory card library (`libmcrd.lib` in the SDK).
   The error string "libmcrd: event overflow" is an internal diagnostic from this library.
   This confirms PSY-Q SDK libraries are linked into the binary.

3. **No GCC version string found** — vanilla GCC often embeds a version string, but the
   PSY-Q compiler (SN Systems' modified GCC) does not. The absence of a GCC version
   string is consistent with PSY-Q.

4. **No alternative SDK indicators** — no references to PSn00bSDK, Net Yaroze, or other
   PS1 development environments were found.

### Conclusion

The binary was built with the **PSY-Q SDK**. The PSY-Q compiler (`ccpsx`) is a modified
GCC by SN Systems — so `--compiler PSYQ` in spimdisasm is the correct setting.

### What we don't know yet

- The exact PSY-Q SDK version (affects which GCC version was used internally)
- The copyright date range "1993-1997" reflects the library code copyright, not necessarily
  the SDK release date — the game was released in 2000, so a later SDK version is possible

## Step 2: Identifying the Game

Searched for the title ID from the PSX EXE header:

- **SLUS-01115** → **Harvest Moon: Back to Nature** (Natsume, 2000 US / 1999 JP)

This is relevant because release date constrains which SDK versions were available.
PSY-Q versions up to ~4.7 were available by 2000.

## Step 3: PSY-Q Version → Compiler Version Mapping

### Research

Searched Decompedia, psxdev.net forums, and GitHub projects for PSY-Q version information.
Key sources:
- [Decompedia PSY-Q page](https://wiki.deco.mp/index.php/PSY-Q) (was down during research)
- [psxdev.net: "How to determine PsyQ Version"](https://www.psxdev.net/forum/viewtopic.php?t=4113)
- [psy-q-decomp](https://github.com/sozud/psy-q-decomp) — has prep scripts for versions 3.3, 3.5, 3.6, 4.0
- Web search results referencing Decompedia content

### Version mapping (from web search results citing Decompedia)

### About PSY-Q

The PSY-Q SDK was developed by SN Systems and distributed by Sony. It shipped a modified
GCC as its C compiler (`ccpsx` frontend, `cc1psx` backend). Different SDK versions shipped
different GCC versions:

| PSY-Q Version | GCC Version | Notes |
|---------------|-------------|-------|
| 3.5 | ? | |
| 3.6 | GCC 2.6.3 / 2.7.2 | Last DOS-compatible compiler |
| 4.0 | GCC 2.7.2.SN32.3.7 | First fully 32-bit compiler |
| 4.3 | GCC 2.8.0 | Came with "Runtime Libraries 4.3" |
| 4.4 | GCC 2.8.1 | |
| 4.6+ | ? | |

Source: Decompedia, psxdev.net forums

### Why the exact version matters

spimdisasm's `--compiler PSYQ` setting is confirmed correct — it applies SN Systems-specific
tweaks to instruction analysis. But the exact GCC version within PSY-Q still matters for:
- Choosing the right build compiler for matching decompilation
- Understanding instruction selection patterns (e.g., which GCC version produces which
  div/mod sequences, switch statement lowering, etc.)
- The Makefile currently uses vanilla GCC 2.7.2, which may not match PSY-Q's modified GCC

## Step 4: Determine Exact PSY-Q / GCC Version

The following methods were identified through web research (searching for PSY-Q version
identification techniques, FLIRT signatures, decomp.me, psxdev.net forums, Decompedia,
and the ghidra_psx_ldr and psy-q-decomp GitHub projects).

### Identification Methods

### Method 1: FLIRT Signature Matching (IDA / Ghidra)

FLIRT (Fast Library Identification and Recognition Technology) signatures match known
library function byte patterns against the binary to identify which SDK version's libraries
were linked in.

**Tools:**
- **IDA:** PSY-Q FLIRT signature sets exist for versions 3.7, 4.0, 4.2, 4.3, 4.4, 4.6
- **Ghidra:** [ghidra_psx_ldr](https://github.com/lab313ru/ghidra_psx_ldr) plugin can
  match PSY-Q library signatures

**How:** Load the binary in Ghidra with the PSX loader plugin. Apply signature sets from
different SDK versions and see which one matches the most library functions.

**Pros:** Directly identifies the SDK version, not just the compiler
**Cons:** Requires IDA or Ghidra setup with the right plugins/signatures

### Method 2: decomp.me Compiler Testing

[decomp.me](https://decomp.me) is a web tool for collaborative decompilation. It offers
multiple PSY-Q compiler versions to compile against.

**How:**
1. Pick a small, simple function from the disassembly (ideally one with common patterns
   like if/else, loops, or arithmetic — not GTE/handwritten code)
2. Write a plausible C implementation
3. Try compiling it against each available PSY-Q compiler version on decomp.me
4. The version that produces matching assembly is (likely) the correct one

**Pros:** Most practical — no special tools needed, directly tests matching
**Cons:** Requires a correct C implementation of at least one function; different compiler
flags (optimization level, -G value) also affect output

### Method 3: CRT0 Startup Code Comparison

The `__start` / CRT0 code is part of the SDK runtime, not the game code. Different PSY-Q
versions ship different CRT0 implementations.

**How:** Compare the decoded `__start` function (now properly decoded with `--disasm-unknown`)
against CRT0 source/binaries from known PSY-Q SDK versions.

**Resources:**
- [psy-q-decomp](https://github.com/sozud/psy-q-decomp) — WIP decompilation of PSY-Q SDK,
  has prep scripts for versions 3.3, 3.5, 3.6, 4.0
- PSY-Q SDK archives (various versions available online)

**Pros:** CRT0 is SDK code, not game code — no need to reverse engineer game logic
**Cons:** CRT0 may not have changed much between versions

### Method 4: Instruction Pattern Fingerprinting

Different GCC versions produce different instruction sequences for certain C constructs.
Known differentiators:

- **Division/modulus:** Different GCC versions emit different div/divu sequences
  (with or without overflow checks, different register allocation)
- **Switch statements:** Jump table vs if-else chain threshold varies
- **Struct copies:** Inline vs memcpy call threshold varies
- **Function prologue/epilogue:** Register save order, stack frame layout

**How:** Identify several of these patterns in the disassembly and compare against
reference output from different compiler versions.

**Pros:** Can work without any external tools
**Cons:** Requires expertise in compiler-specific code generation patterns

## Recommended Approach

1. **Start with Method 3 (CRT0 comparison)** — compare `__start` against known PSY-Q
   SDK CRT0 implementations. This is the most direct since CRT0 is SDK code.

2. **Use Method 2 (decomp.me) to confirm** — pick a simple function and test against
   the candidate compiler version(s).

3. **Fall back to Method 1 (FLIRT)** if the above are inconclusive — load the binary
   in Ghidra with ghidra_psx_ldr and match library signatures.

## Step 5: Library Signature Matching — Result

### Approach

Used [psx_psyq_signatures](https://github.com/lab313ru/psx_psyq_signatures) (added as
submodule at `tools/psx_psyq_signatures/`), which contains JSON byte-pattern signatures
for all PSY-Q library functions across versions 2.60–4.70.

Built `tools/matchSignatures.ts` to scan the binary's `.text` section against every
version's signatures. For each JSON signature entry, the tool parses the hex byte pattern
(with `??` wildcards), searches for it at 4-byte aligned addresses, and records matches
with function names, library origin, and version.

### Results

```
  260: 64 sigs matched,  62 unique addresses,  68 named functions
  300: 68 sigs matched,  65 unique addresses,  71 named functions
  330: 79 sigs matched,  75 unique addresses,  82 named functions
  340: 78 sigs matched,  74 unique addresses,  81 named functions
  350: 93 sigs matched,  86 unique addresses,  96 named functions
  370: 113 sigs matched, 102 unique addresses, 120 named functions
  400: 117 sigs matched, 105 unique addresses, 126 named functions
  410: 241 sigs matched, 225 unique addresses, 303 named functions
  420: 253 sigs matched, 238 unique addresses, 327 named functions
  430: 263 sigs matched, 249 unique addresses, 345 named functions
  440: 286 sigs matched, 271 unique addresses, 374 named functions
  450: 290 sigs matched, 275 unique addresses, 386 named functions
  460: 384 sigs matched, 343 unique addresses, 566 named functions
  470: 393 sigs matched, 350 unique addresses, 577 named functions
```

Match counts increase monotonically with version. This is expected: newer SDK versions
define more library functions, so they have more signatures to match against. If the
binary uses 4.7 libraries, then 4.7's signature set will match the most — older versions
simply have fewer signatures to look for, so they find fewer matches. The key insight is
that newer-version-only signatures (functions that didn't exist in earlier SDKs) are
matching real code in our binary.

### Version discrimination via diffs

Adjacent-version diffs confirm the identification:

**450 → 460 (+94 / -0):** Massive gain — LIBCD (CdControl, CdRead, CdSync, etc.),
LIBGPU (ResetGraph, DrawSync, LoadImage, etc.), LIBMCRD (MemCardStart, MemCardReadFile,
etc.) all newly matched. Zero losses. These are substantial SDK functions that wouldn't
false-positive.

**460 → 470 (+11 / -2):** Gains include `_96_remove` (LIBAPI), `puts` (LIBC),
`bcmp`/`memcmp` (LIBC/LIBC2), `FntLoad`/`FntOpen` (LIBGPU), `InitGeom` (LIBGTE),
`SpuSetReverb` (LIBSPU). The 2 losses are `__builtin_vec_new/delete` signatures that
changed between versions (matched at a different address in 470). All gained functions
are real PSX SDK functions at plausible addresses.

**470 → 3610 (-299):** Massive drop — going back to an older branch loses almost all
matches, confirming 4.x is the correct line.

### CRT0 identification

The signature matcher also identified the CRT0 startup code:
- `0x80011270` — `__main` (from `2MBYTE.OBJ`)
- `0x80011278` — `__SN_ENTRY_POINT` / `stup2` (from `2MBYTE.OBJ`)
- `0x8001129C` — `stup1`
- `0x80011318` — `stup0`

This matches across all versions (CRT0 didn't change), so it doesn't help discriminate,
but it confirms the binary uses the standard PSY-Q `2MBYTE.OBJ` startup (2MB RAM config).

### Conclusion

**PSY-Q SDK version 4.7** — confirmed by library signature matching. 393 signatures
matched across LIBAPI, LIBC, LIBCD, LIBGPU, LIBGS, LIBGTE, LIBMATH, LIBMCRD, LIBSN,
LIBSND, LIBSPU, and the CRT0 startup object.

The game (Harvest Moon: Back to Nature, released 1999 JP / 2000 US) shipped late enough
in the PS1 lifecycle that PSY-Q 4.7 (one of the final SDK releases) was available.

## Getting and Extracting PSY-Q

### Downloads

- **psx.arthus.net**: https://psx.arthus.net/sdk/Psy-Q/ — has PSY-Q 4.5, 4.6, 4.7, full SDK archive,
  and pre-converted library packages
- **Internet Archive**: https://archive.org/details/psyq-sdk — full PSYQ SDK bundle

The SDK archives contain `.LIB` files in `PSX/LIB/` (e.g., `LIBAPI.LIB`, `LIBC.LIB`, `LIBGPU.LIB`).

### Extracting .LIB → ELF .o files

PSY-Q `.LIB` files are archives of proprietary SN Systems object files. They must be converted
to standard ELF `.o` files for use with modern GNU toolchains.

**Tool: psyq-obj-parser** (recommended)
- Source: https://github.com/grumpycoders/pcsx-redux/tree/main/tools/psyq-obj-parser
- Converts PSY-Q `.obj` → ELF `.o` files compatible with `mips-linux-gnu-ld`
- Also used by decomp.me in their backend
- Usage: `psyq-obj-parser input.obj -o output.o`
- Flags: `-n` for "none" ABI (instead of Linux), `-p prefix` for local symbol prefixing

**Alternative: PSYLIB.EXE** (original Sony tool)
- Extract objects from `.LIB`: `PSYLIB.EXE /x LIBAPI.LIB` (needs Wine or DOSBox)
- Then convert each extracted `.obj` with psyq-obj-parser

### Project integration

Reference project: [silent-hill-decomp](https://github.com/Vatuu/silent-hill-decomp)

1. Place converted ELF `.o` files in `lib/<libname>/` (e.g., `lib/libapi/a36.o`)
2. Reference them in `splat.yaml` as `o` segments:
   ```yaml
   - [0x29BC, o, ../../lib/libapi/a36]  # EnterCriticalSection
   - [0x29CC, o, ../../lib/libapi/a37]  # ExitCriticalSection
   ```
3. Track which PSY-Q version each library came from (see `lib/versions.txt` in silent-hill-decomp)

Note: games sometimes used libraries from mixed PSY-Q versions. The Silent Hill decomp uses
mostly 4.3–4.4 with per-library version tracking.

### Confirmed version for BTN

**PSY-Q 4.7 libraries + GCC 2.8.0 compiler** — identified via library signature matching
(Step 5) and decomp.me testing (Step 6).

## Step 6: GCC Version — decomp.me Testing

### Approach

Tested `func_8001FE00` (a simple game function with division) on decomp.me against
available PSY-Q compiler versions. The function divides a struct field by a parameter,
stores the result, and sets a flag.

### Key finding: division sequence

The **signed division expansion** was the discriminator. The target binary emits:
```
div     zero,v0,a0
mflo    v0
bnez    a0, .Lok
nop
break   0,7
```
Only a div-by-zero check, with `mflo` before the branch. This pattern requires
**maspsx** to post-process the assembler output — vanilla GNU `as` and ASPSX expand
`div` differently.

**GCC 2.8.0 + maspsx** produced the matching div sequence. GCC 2.7.2 did not match
(different register allocation patterns). The remaining minor differences (register
choices, exact maspsx flags) are tuning issues, not compiler version issues.

### Build configuration

```
Compiler: GCC 2.8.0-psx (tools/old-gcc/build-gcc-2.8.0-psx/cc1)
Assembler wrapper: maspsx (tools/maspsx/maspsx.py)
Flags: -mips1 -mcpu=r3000 -O2 -G8
```

Built via: `cd tools/old-gcc && make VERSION=2.8.0-psx`

## Status

- [x] SDK version confirmed — **PSY-Q 4.7** (via library signature matching)
- [x] CRT0 identified — `2MBYTE.OBJ` startup, `__SN_ENTRY_POINT` at `0x80011278`
- [x] GCC version confirmed — **GCC 2.8.0** (via decomp.me testing)
- [x] Compiler built locally — `tools/old-gcc/build-gcc-2.8.0-psx/cc1`
- [x] PSY-Q 4.7 SDK downloaded and libs extracted

## Step 7: PSY-Q 4.7 Library Extraction

### Pre-converted ELF libraries

Downloaded pre-converted PSY-Q 4.7 ELF libraries from `psx.arthus.net/sdk/Psy-Q/psyq-4.7-converted-full.7z`.
These were generated using `psyq-obj-parser` and are standard ELF `.o`/`.a` files ready for use with GNU toolchains.

**Location:** `tools/psyq47/converted/lib/`

- `.a` archives (e.g., `libapi.a`, `libgpu.a`) — standard `ar` archives
- Individual `.o` files in subdirectories (e.g., `libapi/a07.o`) — ELF 32-bit MIPS-I relocatable
- PSY-Q headers at `tools/psyq47/converted/include/`

**Source:** https://psx.arthus.net/sdk/Psy-Q/ (same site already listed in the Downloads section above)
