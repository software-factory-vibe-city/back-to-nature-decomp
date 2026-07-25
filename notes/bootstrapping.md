# Bootstrapping Guide

How this project was set up from scratch. Assumes the project structure (Makefile, tools/, configs/, include/) already exists.

## 1. Extract the binary

Extract the PS-X EXE from the game disc ISO to `extracted/iso/slus_011.15`. The EXE header gives us:
- Load address: `0x80010000`
- Entry point: `0x80011278`
- Payload: 321,536 bytes at offset `0x800`

Tool: `npx tsx tools/diagnostics/headerInfo.ts`

## 2. Find the GP value

The MIPS global pointer (`$gp`) is set once at startup. To find it, search the binary near the entry point for the `lui`/`addiu` pair that loads `$gp` (`$28`):

```
lui   $gp, 0x8006
addiu $gp, $gp, -0x1D8C    # 0x80060000 - 0x1D8C = 0x8005E274
```

Run a first-pass disassembly without `--gp` and look for instructions writing to `$28` near the entry point. For this binary: **`0x8005E274`**.

## 3. Initial disassembly with spimdisasm

Run standalone spimdisasm (`tools/build/disassemble.sh`) with the discovered GP value:
- **GP value**: `0x8005E274`
- **Compiler**: PSY-Q (Sony's modified GCC for PS1, identified via instruction patterns — see `notes/compiler-identification.md`)
- **Architecture**: MIPS1 (set via `SPIMDISASM_ARCHLEVEL=1`)
- **Function boundaries**: 674 functions exported to `build/functions.csv`

Critical flags: `--arch-level MIPS1`, `--compiler PSYQ`, `--gp 0x8005E274`, `--disasm-unknown`

## 3. Determine section layout

Built `tools/build/analyzeLayout.ts` to classify each spimdisasm entry as code or data using byte-level heuristics (prologue patterns, `jr $ra`, GP-relative accesses, branch targets). Compared with/without `--disasm-unknown`. Result: **contiguous sections, no interleaving.**

```
0x80010000 – 0x80011270  .rodata  (4,720 bytes)
0x80011270 – 0x80048190  .text    (225,056 bytes, 674 functions)
0x80048190 – 0x8005D3D8  .data    (86,600 bytes)
0x8005D3D8 – 0x8005E800  .sdata   (5,160 bytes, GP-relative)
0x8005E800+              .sbss/.bss (not in binary, TBD)
```

Full output: `notes/layout_new.md`

## 4. Configure splat

Wrote `configs/splat.yaml` with:
- Correct section boundaries as subsegments (rodata, asm, data, sdata)
- `section_order: [".rodata", ".text", ".data", ".sdata", ".sbss", ".bss"]`
- `gp_value: 0x8005E274`
- `align: 4` and `subalign: 4` on both segments plus global `subalign: 4` — splat's default 16-byte alignment added padding that shifted GP-relative offsets
- `asm_path: build/asm` so splat output goes into build/, not top-level

## 5. Per-function splitting (now automated)

Originally a manual step (`splitFunctions.ts`, since removed). Today
`tools/build/bootstrap.ts` does this automatically as the first step of
`make split` — it reads `build/functions.csv` and:
- Replaces the single `.text` subsegment in `splat.yaml` with one `asm` entry per function (674 entries)
- Initializes `configs/symbol_addrs.txt` if it doesn't exist (gives splat function names)

bootstrap.ts is a no-op when configs already exist, so `make split` is safe to re-run.

After that, `symbol_addrs.txt` is a living file — manual edits (real function names, `type:func` annotations) accumulate over time.

After splitting, cross-file label references can break the build (a branch in one function targeting a label inside another function's file). `tools/build/fixCrossFileRefs.ts` detects these by scanning all `.s` files, then adds the target symbols to `symbol_addrs.txt` with `type:func` so spimdisasm emits them with `glabel` (global visibility).

Both steps are integrated into `make split`:
1. First splat split
2. `fixCrossFileRefs.ts --write` patches symbol_addrs.txt
3. Second splat split picks up the fixes
4. Append undefined symbol includes to linker script

## 7. Build and verify

```
make split    # split → fix cross-refs → re-split → append undefined symbols
make          # assemble, link, extract binary, SHA256 verify
```

`make check` (called by default `make`) verifies the built binary is byte-identical to the original payload.



## Reference
- `notes/compiler-identification.md` — compiler version investigation
- `notes/process_for_decompilation.md` — per-function decompilation workflow
