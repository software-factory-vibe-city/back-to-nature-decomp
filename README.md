# BTN Decompilation

A matching decompilation of SLUS-01115 (PS1). The goal is to produce C source code that compiles to a byte-for-byte identical binary.

## Prerequisites

- Linux
- Docker
- Node.js + npm (for TypeScript tooling)
- Python 3
- GNU Make

### System packages

```bash
sudo apt install binutils-mips-linux-gnu
pipx install splat64[mips]
```

## Setup

```bash
git clone --recursive <repo-url>
cd btn-decompilation
npm install

# Build the PSX GCC 2.7.2 cross-compiler (requires Docker)
cd tools/old-gcc
make VERSION=2.7.2-psx
cd ../..
```

Place the original ISO contents in `extracted/iso/` (gitignored). The EXE must be at `extracted/iso/slus_011.15`.

## Building

```bash
make split         # splat: split binary into .s files + linker script
make               # assemble + link + verify match
```

`make` runs `make check` by default, which verifies the built binary is byte-identical to the original.

## How It Works

### Pipeline

1. **`make split`** — Runs splat to split the EXE into per-segment `.s` files and a linker script. Appends `INCLUDE` directives for auto-generated undefined symbol definitions.

2. **`make` / `make check`** — Assembles all `.s` files, links, extracts the raw binary, and compares the payload against the original via SHA-256.

### Section Layout

The binary has contiguous, non-interleaved sections:

```
0x80010000 – 0x80011270  .rodata  (4,720 bytes)
0x80011270 – 0x80048190  .text    (225,056 bytes)
0x80048190 – 0x8005D3D8  .data    (86,600 bytes)
0x8005D3D8 – 0x8005E800  .sdata   (5,160 bytes, GP-relative)
```

GP value: `0x8005E274`

## Project Structure

```
src/                    Decompiled C source (empty initially)
include/
  include_asm.h         INCLUDE_ASM macro for function stubs
  common.h              Basic PSX types (u8, u16, u32, s8, s16, s32)
configs/
  splat.yaml            Splat configuration (manually maintained)
  symbol_addrs.txt      Function/data symbols (manually maintained)
tools/
  old-gcc/              PSX-era GCC cross-compiler (git submodule)
  maspsx/               MIPS assembler wrapper for PSY-Q compatibility (git submodule)
  asm-differ/           Assembly diff tool (git submodule)
  m2c/                  MIPS-to-C decompiler (git submodule)
  disassemble.sh        spimdisasm invocation (bootstrap only)
  headerInfo.ts         PS-X EXE header parser
  analyzeLayout.ts      Section layout classifier
  analyzeAccess.ts      Data access pattern analyzer
extracted/iso/          ISO contents including the EXE (gitignored)
build/                  All generated artifacts (gitignored)
  asm/                  Splat-generated assembly
    data/               Data/rodata/sdata segment .s files
    *.s                 Code segment .s files
```

## Make Targets

| Target | Description |
|--------|-------------|
| `make` | Build and verify (`make check`) |
| `make split` | Run splat to split binary into .s files + linker script |
| `make check` | Compare built binary against original payload |
| `make setup` | Initialize git submodules |
| `make progress` | Show decompilation progress |
| `make clean` | Remove all generated artifacts |

## Compilation Pipeline

```
C source → cpp (preprocessor) → cc1 (PSX GCC 2.7.2) → maspsx (assembler wrapper) → .o
Assembly → mips-linux-gnu-as → .o
All .o → mips-linux-gnu-ld → ELF → objcopy → raw binary → verify against original
```

## Binary Details

| Field | Value |
|-------|-------|
| File | `SLUS_011.15` |
| Format | PS-X EXE |
| Load address | `0x80010000` |
| Entry point | `0x80011278` |
| Payload size | 321,536 bytes (`0x4E800`) |
| Payload offset | `0x800` |
| Compiler | GCC 2.7.2 |
