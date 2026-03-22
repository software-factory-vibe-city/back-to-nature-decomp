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

# Build the PSX GCC 2.95.2 cross-compiler (requires Docker)
cd tools/old-gcc
make VERSION=2.95.2-psx
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
  functions.h           Auto-generated function signatures (by contextExport.ts)
  game_types.h          Shared struct definitions (created by refinement agents)
  psyq/                 PSY-Q SDK headers
configs/
  splat.yaml            Splat configuration (manually maintained)
  symbol_addrs.txt      Function/data symbols (manually maintained)
prompts/
  decompilation-cleanup-agent.md   Stage 2 matching agent prompt
  global-refinement-agent.md       Stage 5 per-function refinement prompt
  project-refinement-agent.md      Project-wide refinement prompt
tools/
  old-gcc/              PSX-era GCC cross-compiler (git submodule)
  maspsx/               MIPS assembler wrapper for PSY-Q compatibility (git submodule)
  asm-differ/           Assembly diff tool (git submodule)
  m2c/                  MIPS-to-C decompiler (git submodule)
  disassemble.sh        spimdisasm invocation (bootstrap only)
  headerInfo.ts         PS-X EXE header parser
  analyzeLayout.ts      Section layout classifier
  analyzeAccess.ts      Data access pattern analyzer
  callGraph.ts          Build call graph + priority ranking
  m2cFunc.ts            Run m2c decompiler on a single function
  orchestrator.ts       Drive the decompilation pipeline
  agent-loop.ts         Generic LLM agent loop (pi-coding-agent SDK)
  getPrompt.ts          Build agent prompts with injected context
  contextExport.ts      Extract function signatures into include/functions.h
  diffFunc.ts           Compile a .c file and diff against original .o
  progress.ts           Decompilation progress tracker
extracted/iso/          ISO contents including the EXE (gitignored)
build/                  All generated artifacts (gitignored)
  asm/                  Splat-generated assembly
    data/               Data/rodata/sdata segment .s files
    *.s                 Code segment .s files
  callGraph.json        Call graph + priority ranking
  pipeline/             Per-function pipeline artifacts + refinement markers
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
C source → cpp (preprocessor) → cc1 (PSX GCC 2.95.2) → maspsx (assembler wrapper) → .o
Assembly → mips-linux-gnu-as → .o
All .o → mips-linux-gnu-ld → ELF → objcopy → raw binary → verify against original
```

## Tools

### `callGraph.ts` — Build call graph

Analyzes all disassembled functions, builds a call graph, and outputs a priority-ranked JSON file for the decompilation pipeline.

```bash
npx tsx tools/callGraph.ts              # build graph + summary
npx tsx tools/callGraph.ts --top 20     # also print top 20 priority functions
```

Output: `build/callGraph.json`

### `m2cFunc.ts` — Run m2c on a single function

Runs the m2c decompiler on a function's `.s` file and produces initial C output wrapped in standard `#include` headers.

```bash
npx tsx tools/m2cFunc.ts func_80011F08              # print C to stdout
npx tsx tools/m2cFunc.ts func_80011F08 --write      # write to src/func_80011F08.c
npx tsx tools/m2cFunc.ts func_80011F08 --context include/functions.h
```

Auto-detects `include/functions.h` for `--context` if it exists. Handles named symbols (like `__start`) whose `.s` files use address-based names.

### `orchestrator.ts` — Decompilation pipeline driver

Reads `callGraph.json` and processes functions in priority order through a multi-stage pipeline:

1. **Stage 1: m2c** — Mechanical decompilation via m2c
2. **Stage 2: Match** — LLM agent iterates until 100% byte match
3. **Stage 3: Cleanup** — LLM agent renames variables, adds comments (stubbed)
4. **Stage 4: Context export** — Extract signatures to `include/functions.h`
5. **Stage 5: Global refinement** — Revisit already-decompiled functions when neighbors are newly decompiled (runs automatically at end of pipeline)

```bash
# Normal pipeline (stages 1-5)
npx tsx --env-file=.env tools/orchestrator.ts                        # dry-run
npx tsx --env-file=.env tools/orchestrator.ts --write                # actually modify src/
npx tsx --env-file=.env tools/orchestrator.ts --top 5                # top 5 functions
npx tsx --env-file=.env tools/orchestrator.ts --func func_80011F08   # specific function
npx tsx --env-file=.env tools/orchestrator.ts --stage 1              # only stage 1

# Per-function refinement (stage 5 only)
npx tsx --env-file=.env tools/orchestrator.ts --refine               # all candidates
npx tsx --env-file=.env tools/orchestrator.ts --refine --func X      # specific function

# Project-wide refinement (holistic pass across all decompiled code)
npx tsx --env-file=.env tools/orchestrator.ts --project-refine
```

**Dry-run (default):** Outputs go to `build/pipeline/{funcName}/` only. `src/` files are never touched.

**Write mode (`--write`):** Same as dry-run, but also writes the final result to `src/{name}.c`.

**Refinement tracking:** After a function is refined, a marker file is written to `build/pipeline/{funcName}/refined_{hash}.marker`. The hash is derived from the function's decompiled neighbor set — when a new neighbor is decompiled, the hash changes and the function becomes a refinement candidate again.

**Project refinement (`--project-refine`):** Runs a holistic pass across the entire decompiled codebase — defines shared structs, renames globals and functions, replaces pointer arithmetic with struct access, and improves type consistency. Run this periodically as more functions are decompiled.

Requires `AGENT` env var (see `.env`). `build/pipeline/` always contains the full audit trail regardless of mode.

### `getPrompt.ts` — Build agent prompts

Reads a prompt template and injects per-function or project-wide context (assembly, source, call graph, neighbor sources).

```bash
npx tsx tools/getPrompt.ts func_80011F08            # matching agent prompt
npx tsx tools/getPrompt.ts --refine func_80011F08   # per-function refinement prompt
npx tsx tools/getPrompt.ts --project                # project-wide refinement prompt
```

### `contextExport.ts` — Export function signatures

Extracts function signatures from decompiled C files into `include/functions.h` for use by m2c and LLM agents.

```bash
npx tsx tools/contextExport.ts func_80011F08        # single function
npx tsx tools/contextExport.ts --all                # all decompiled functions
```

### `diffFunc.ts` — Diff compiled output against original

Compiles a `.c` file through the full PSX GCC pipeline and diffs the resulting object code against the original, showing a match percentage.

```bash
npx tsx tools/diffFunc.ts func_80011F08
```

Watches the source file for changes and re-diffs automatically.

## Binary Details

| Field | Value |
|-------|-------|
| File | `SLUS_011.15` |
| Format | PS-X EXE |
| Load address | `0x80010000` |
| Entry point | `0x80011278` |
| Payload size | 321,536 bytes (`0x4E800`) |
| Payload offset | `0x800` |
| Compiler | GCC 2.95.2 (PSY-Q 4.6 CC1PSX) |
