# Bootstrapping Guide

The sequence of calls to bring a new PSX game into this harness, from a disc
image to a byte-verified build.

Nothing below names this game. Where a step needs a fact about the target — its
executable, its archive, its SDK — that fact is *detected* and the tool reports
what it saw, so the same sequence runs against a different disc.

Verified end to end on 2026-08-21 in a clean worktree with no decompiled
sources, no configuration and no build directory. Where a step is known not to
complete from nothing, it says so and why.

---

## 0. Prerequisites

- The harness itself: `Makefile`, `tools/`, `include/`, `configs/`, and the
  submodules under `tools/vendor/` (`make setup`).
- The disc contents extracted anywhere under `extracted/`. The tools search that
  tree; no filename is assumed.

## 1. Seed the project configuration

One hand-written file, and it is the only one. `configs/splat/exe.yaml`:

```yaml
name: <target filename>
sha1: <sha1 of the target file>
options:
  platform: psx
  compiler: GCC
  basename: <short name for the executable>
  base_path: ../..
  build_path: build
  ld_script_path: build/<basename>.ld
  target_path: extracted/iso/<target filename>
  asm_path: build/asm
  src_path: src
  asset_path: assets
  symbol_addrs_path: configs/symbols/exe.txt
  undefined_funcs_auto_path: build/undefined_funcs_auto.txt
  undefined_syms_auto_path: build/undefined_syms_auto.txt
  find_file_boundaries: true
  disasm_unknown: true
  section_order: [".rodata", ".text", ".data", ".sdata", ".sbss", ".bss"]
  extensions_path: tools/vendor/splat_ext
  subalign: 4

segments:
  - name: header
    type: header
    start: 0x0
    align: 4
    subalign: 4
  - name: main
    type: code
    start: 0x800
    vram: <load address from the PS-X EXE header>
    align: 4
    subalign: 4
    subsegments:
```

The load address, entry point and payload size come from the header:

```
npx tsx tools/diagnostics/headerInfo.ts
```

`gp_value` is **not** needed. `tools/lib/psxExeInfo.ts` finds `$gp` by scanning
for the `lui`/`addiu` pair near the entry point; the config value is only a
fallback. `target_path` is also optional — with it absent, the executable is
found under `extracted/` by its `PS-X EXE` magic — but naming it is clearer and
avoids ambiguity when a disc carries more than one.

## 2. Identify the toolchain

```
npx tsx tools/diagnostics/toolchain.ts --deep
```

Reports the SDK and its evidence: vendor strings the SDK leaves in the image
(the Sony library banner, RCS `$Id:` lines from the library sources), the
compiler the project config names, and — with `--deep`, after step 3 has run
the signature scan — the version that most library byte patterns match.

This verdict selects which discovery strategies are allowed to run later
(`tools/lib/overlayStrategies.ts`). An `undetermined` profile is not a failure:
toolchain-specific strategies are skipped, the toolchain-independent ones still
run, and every tool says which it used.

## 3. Disassemble

```
make disassemble
```

An ordered chain, and the order is a dependency rather than a preference:

1. `disassemble.ts --container exe` — spimdisasm over the executable, twice:
   once with `--disasm-unknown` for the function list, once without for boundary
   analysis. The second pass is mandatory — with `--disasm-unknown` spimdisasm
   invents multi-kilobyte phantom functions inside data regions.
2. `bootstrap.ts --write` — classifies each entry as code or data
   (`analyzeLayout.ts`) and writes `build/sectionLayout.json`. The executable's
   `.text` is the **reference body of known code** everything after this is
   judged against.
3. `extractArchive.ts --write` — finds a paired index/data archive under
   `extracted/` by testing five index-format hypotheses against every plausible
   file pair, and publishes `configs/overlays.json`. Reports `undetermined`
   rather than guessing. `--index`/`--data` name them explicitly if several
   pairs resolve.
4. `classifyArchiveMembers.ts --write` — code or data per member, judged
   against the reference body from step 2, using the layout strategies the
   detected toolchain allows.
5. `extractArchive.ts --write --extract` — writes the code members' bytes.
6. `solveOverlayBase.ts --write` — solves each code member's load address by
   voting: every internal `jal` target is a function entry, every stack prologue
   a candidate entry, and each pair proposes a base. Issues a certificate per
   member or reports `undetermined`.
7. `overlayIdentity.ts --write` — derives semantic names, adopting one only when
   three independent sources agree.

Useful checks after this step:

```
npx tsx tools/build/extractArchive.ts --verify          # archive round trip
npx tsx tools/build/solveOverlayBase.ts --verbose       # base certificates
npx tsx tools/build/solveOverlayBase.ts --probe 0xADDR  # score an arbitrary base
npx tsx tools/diagnostics/ramMap.ts                     # regions, with nothing unclassified
```

If a member's base is `undetermined`, it is deliberately absent from every later
step. That is work to finish, not a member to drop — the data partner's pointer
table and the loader call site each encode the base independently.

## 4. Split

```
make split-all
```

`split` for the executable, then `split-<container>` for each overlay. Each
produces a splat config, a symbol table, `INCLUDE_ASM` stubs for every function
and a linker script.

For one container at a time:

```
make split                 # the executable
make split-ovl_11          # one overlay
make wipe-ovl_11           # throw one overlay's config away and start it over
```

## 5. Build and verify

```
make check-all
```

One SHA-256 comparison per container. An overlay is compared against its
extracted member bytes, which is why step 3's extraction has to be reproducible.

```
make check-exe             # the executable alone
make check-ovl_11          # one overlay alone
make config-check          # re-split everything and assert no tracked file moved
```

## What completes from nothing, and what does not

Verified from an empty tree:

| step | from nothing |
|---|---|
| toolchain detection | yes |
| disassembly and section layout | yes |
| archive detection, extraction, member classification | yes |
| overlay base solving (13/13 with certificates) | yes |
| overlay split and **byte-identical round trip, all 13** | yes |
| executable split | yes |
| executable **link** | **no** — see below |

The executable's link needs the SDK library objects placed and their symbols
resolved (`addLibSymbols.ts`, `patchSplatForLibs.ts`, `addDepObjects.ts`,
`detectLibFunctions.ts`). From a wiped configuration that step leaves symbols
like `rcossin_tbl` undefined: matching a library object to its address uses
accumulated symbol knowledge that a cold run has not built up yet. Expect to
work that chain interactively on a new game rather than in one command.

Overlay work does **not** wait for it. Overlays link no libraries, and the
engine symbol export falls back to the project's own symbol tables when no
linked ELF exists yet — weaker, because it cannot see a symbol only the link
defines, and the tool names which source it used. Once the executable links, the
linked ELF becomes a declared prerequisite of every overlay link, so renaming a
function in `src/` relinks every overlay.

## What is a living file

`configs/symbols/<container>.txt` accumulates real function names and
`type:func` annotations over time. `make wipe` discards that knowledge, so a
wipe-and-rebuild of a project that already has decompiled sources will not
reproduce it — generated declarations in `include/globals.h` can end up
conflicting with hand-written ones in `src/`. Wipe to test bootstrapping, not to
tidy up.

## Reference

- `configs/project-profile.md` — generated target and toolchain facts
- `notes/overlay-enablement.md` — the overlay pipeline's measured findings
- `notes/compiler-identification.md` — compiler version investigation
- `notes/documentation/decompilation-pipeline-and-strategies.md` — per-function workflow
- `notes/decompiling-any-psx-game.md` — applying the harness to another title
- `notes/tools-directory-structure.md` — what each tool does
