# Toolchain Version Detection

## Confirmed Toolchain for SLUS-01115

| Parameter | Value | How confirmed |
|-----------|-------|---------------|
| GCC version | **2.95.2** | Byte-identical output from `CC1PSX.EXE` (PSY-Q 4.6) and `tools/old-gcc/build-gcc-2.95.2-psx/cc1` |
| ASPSX version | **2.77** | `li` expansion pattern: 1142 `addiu` (small positives) vs 88 `ori` (values >= 0x8000) confirms >= 2.56. maspsx `--aspsx-version 2.77` produces correct encodings. |
| PSY-Q SDK | **4.7** (runtime libs) | Library signature matching against `tools/psx_psyq_signatures/470/` patterns |
| Optimization | **-O2** | Delay slot fill rate >90%, aggressive register allocation |
| -G value | **8** | GP-relative accesses present for symbols <= 8 bytes |
| Compiler binary | `tools/old-gcc/build-gcc-2.95.2-psx/cc1` | Native Linux x86 ELF, built from `gcc-2.95.2-psx.Dockerfile` |

### Key finding: GCC 2.95.2, not 2.8.1

We originally assumed GCC 2.8.1 based on epilog pattern heuristics (delay-slot SP restore). This was wrong — GCC 2.8.1 and 2.95.2 share the same epilog style and many codegen behaviors, making them indistinguishable via that signal alone.

The correct version was identified by:

1. **Switch dispatch register** — GCC 2.8.1 hardcodes `$v0` for switch table jumps (`lw $2, 0($3)` / `jr $2`). The original binary uses `$a0` (`lw $4, 0($3)` / `jr $4`). GCC 2.95.2 produces `$a0`, matching the target. This was unsolvable with 2.8.1 — no C tricks or `register __asm__` hacks could change it.

2. **CC1PSX.EXE from PSY-Q 4.6** — The binary at `tools/psyq_sdk/psyq/bin/CC1PSX.EXE` (MD5: `47c2c91ca6f5536b646483c95e8d5996`, byte-identical to the copy in `Psy-Q_46.zip` from `psx.arthus.net`) identifies as `GNU C version 2.95.2 19991024 BUILD 4.0.0030 (PSX)`. Compiling func_8001A8D0 with it produces a byte-identical match using clean C, no register hacks.

3. **Native Linux build matches CC1PSX.EXE** — `tools/old-gcc/build-gcc-2.95.2-psx/cc1`, built from `gcc-2.95.2-psx.Dockerfile` with the `psx-2.91.patch` target config, produces byte-identical output to CC1PSX.EXE. No Wine needed.

### PSY-Q compiler version history

| PSY-Q SDK | GCC Version | Source |
|-----------|-------------|--------|
| 4.3 (May 1998) | 2.8.0 | `psx/CHANGE.TXT`: "compiler\cc1psx.exe Updated GNU 2.8.0" |
| 4.4 | 2.8.1 | homebrew-psyq project (open-source reconstruction) |
| 4.6 | **2.95.2** | CC1PSX.EXE self-identification; confirmed byte-identical to Psy-Q_46.zip |

The jump from 2.8.1 to 2.95.2 between PSY-Q 4.4 and 4.6 is a significant change (the entire egcs merger happened in between). This explains why heuristics trained on 2.7.x vs 2.8.x differences couldn't distinguish 2.8.1 from 2.95.2.

## Build Pipeline

```
cpp → cc1 (GCC 2.95.2-psx) → maspsx → gas → .o
```

The compiler is `tools/old-gcc/build-gcc-2.95.2-psx/cc1`. Build it with:
```bash
cd tools/old-gcc && make VERSION=2.95.2-psx
```

Full compilation command:
```bash
mips-linux-gnu-cpp -Iinclude -Iinclude/psyq -undef -D__GNUC__=2 -lang-c INPUT.c -o OUTPUT.i
tools/old-gcc/build-gcc-2.95.2-psx/cc1 -quiet -O2 -G8 -mips1 -mcpu=r3000 \
  -funsigned-char -fpeephole -ffunction-cse -fpcc-struct-return -fcommon \
  -fverbose-asm -msoft-float -mgas -fgnu-linker OUTPUT.i -o OUTPUT.s
python3 tools/maspsx/maspsx.py --aspsx-version 2.77 --dont-force-G0 \
  --run-assembler --gnu-as-path mips-linux-gnu-as -o OUTPUT.o \
  -march=r3000 -mtune=r3000 -EL -G8 -no-pad-sections -Iinclude -Iinclude/psyq OUTPUT.s
```

### CC1PSX.EXE via Wine (alternative)

The native Linux build is preferred. If CC1PSX.EXE is needed directly:

```bash
# Input must have CRLF line endings; output will too
sed 's/$/\r/' < OUTPUT.i > OUTPUT_crlf.i
WINEPREFIX="$HOME/.wine32" wine tools/psyq_sdk/psyq/bin/CC1PSX.EXE \
  -quiet -O2 -G8 ... OUTPUT_crlf.i -o OUTPUT.s
sed -i 's/\r$//' OUTPUT.s  # strip CRLF before maspsx
```

Requires `wine32:i386` and a 32-bit wineprefix.

### maspsx compatibility

maspsx (`--aspsx-version 2.77`) is fully compatible with GCC 2.95.2 output. Tested on multiple functions — produces byte-identical objects to direct gas assembly. The `li` expansion, nop insertion, and all other ASPSX transforms work correctly.

## Implications for Decompilation

### Functions that need revisiting

With the correct compiler, several categories of existing decomps may improve:

- **17 "C with register hacks"** — `register __asm__` was used to force GCC 2.8.1's allocator. With 2.95.2's different allocator, these may match naturally without hacks.
- **24 pure-asm functions** — written as `__asm__` blocks because no C matched 2.8.1. With 2.95.2, some may be expressible as clean C. func_8001A8D0 (switch statement) already proved this.
- **2 functions that differ between compilers** (func_8001F39C, func_80017C3C) — C code was hand-tuned for 2.8.1's register allocation. Needs rewriting for 2.95.2.
- **89 functions identical between compilers** — no changes needed.

## General Detection Strategy

For detecting toolchain versions from an arbitrary PSX binary (not yet confirmed for a specific game), the following heuristics apply. Note: the epilog-based signals cannot distinguish GCC 2.8.x from 2.95.x.

### GCC Version Signals

| Signal | Distinguishes | Detectable from binary? |
|--------|--------------|------------------------|
| Epilog: SP in delay slot vs before jr | 2.7.2 vs 2.8.0+ | Yes |
| Unnecessary leaf stack frames | 2.7.2 vs 2.8.0+ | Yes |
| Switch dispatch: `$v0` vs `$a0` | 2.8.x vs 2.95.x | Yes |
| `-fregmove` effects on register allocation | 2.8.x vs 2.95.x | Subtle, requires comparison |
| `s16` store sign-extend (`sll`/`sra` before `sh`) | 2.95.2 quirk (source-dependent) | Unreliable |

The switch dispatch register is the strongest signal for distinguishing 2.8.x from 2.95.x. If the binary has any switch statements using jump tables, check the `lw`/`jr` register:
- `lw $v0` / `jr $v0` → GCC 2.8.x
- `lw $a0` / `jr $a0` → GCC 2.95.x (PSY-Q 4.6+)

### ASPSX Version Signals

| Signal | Distinguishes | Binary pattern |
|--------|--------------|----------------|
| `li` small positive → `addiu` vs `ori` | < 2.56 vs >= 2.56 | Opcode byte 0x24 vs 0x34 |
| `div` overflow → `break` vs `tge` | 2.05/2.08 vs others | Instruction near `div` |
| `sltu` via `$at` vs `sltiu` direct | < 2.70 vs >= 2.70 | `$at` usage patterns |
| Nop at `$at` expansion | < 2.30 vs >= 2.30 | Extra nops |
| `mflo`/`mfhi` gap enforcement | < 2.30 vs >= 2.30 | Nops between mul/div |

### ASPSX Decision Tree

```
Has tge near div?
  YES → 2.05/2.08
  NO →
    li small positive → ori?
      YES (0x34) → < 2.56
      NO (0x24) → >= 2.56
        sltu uses $at?
          YES → 2.56-2.69
          NO (sltiu) → >= 2.70
```

### PSY-Q SDK Version

- **`$Id` tags**: RCS dates in library code give a lower bound on SDK version
- **Library signatures**: Match `.obj` patterns from known SDK versions (see `tools/psx_psyq_signatures/`)
- **Copyright string year**: `Library Programs (c) 1993-YYYY` gives rough era

### Optimization Level

- `-O2`: delay slots aggressively filled, values kept in registers across basic blocks
- `-O1`: some scheduling, more stack spills
- `-O0`: nops after branches, everything spilled to stack

### -G Flag

Presence of `$gp`-relative loads/stores indicates `-G8` (default). Absence indicates `-G0`.
