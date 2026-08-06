# GCC 2.95.2-psx — the source of the compiler that builds this project

One directory per version under `tools/vendor/gcc/`. Which one is current is
project configuration: the Makefile's `GCC_VERSION`, the same variable the
build compiles with. Tools resolve the path from it rather than hardcoding a
version, so `GCC_VERSION := 2.8.1` reads 2.8.1's source with no tool edits.

`src/` is the exact tree `tools/vendor/old-gcc/build-gcc-2.95.2-psx/cc1` was
built from: upstream `gcc-2.95.2.tar.gz` with the old-gcc recipe's `sed` step
and three patches already applied. Provenance, hashes, and the exclusion list
are in `pin.json`.

## Why this is here

Every pass-level answer this project has ever needed came from reading these
files — `gcse.c` for PRE, `local-alloc.c` for allocation priority, `reload1.c`
for spill-slot assignment, `config/mips/mips.md` for what the backend will and
will not tie together. Before this directory existed, that source was
downloaded inside a Docker build and thrown away; sessions re-extracted partial
copies into `/tmp`, where they did not survive and could not be cited.

`.pi/skills/psx-decompile-function/SKILL.md` already tells you to "read that
exact pass in the vendored compiler source". This is that source.

Only the configured version needs to be vendored. Vendoring another (2.7.2,
2.8.1) makes cross-version questions answerable — "does 2.8.1 have `gcse.c` at
all?" was a real hypothesis in the func_80016C08 note — via `--version`.

Read it directly, or search it with `npx tsx tools/agent/compilerSource.ts`.

## What "exact" means

The tree is patched, so it is what cc1 *is*, not what upstream ships. Two
consequences worth stating:

- Cite the applied file, not a patch. `TARGET_DEFAULT` with `MASK_SPLIT_ADDR`
  lives at `src/gcc/config/mips/psx.h:24`. Research notes have cited
  `patches/psx.patch:28` for it; the 2.95.2-psx recipe applies
  `psx-2.91.patch`, and only the applied header is the thing the compiler read.
- The tree hash in `pin.json` covers every byte. `compilerSource.ts` verifies
  it before answering, and refuses rather than answering from a drifted tree.

## Scope

Complete for `cc1`. It excludes other-language front ends, the 97 non-MIPS
targets, the testsuite, and the runtime libraries — the full list is
`pin.json`'s `excluded`, and the search tool prints it with every result count
so an empty result is never mistaken for "not in GCC".

## Reproducing it

```sh
wget https://ftp.gnu.org/gnu/gcc/gcc-2.95.2.tar.gz     # sha256 in pin.json
tar xzf gcc-2.95.2.tar.gz && cd gcc-2.95.2
P=../tools/vendor/old-gcc/patches
/bin/sh -c 'sed -i -- "s/include <varargs.h>/include <stdarg.h>/g" **/*.c'
patch -u -p1 include/obstack.h        -i $P/obstack-2.95.2.h.patch
patch -u -p1 gcc/config/mips/mips.h   -i $P/mips.patch
patch -su -p1 < $P/psx-2.91.patch
```

then copy the four `included` sets from `pin.json` into
`tools/vendor/gcc/<version>/src/`. The step order is the
Dockerfile's; `mips.patch` applies with an offset of 155 lines, which is
expected.

To confirm a copy matches: `npx tsx tools/agent/compilerSource.ts verify`.
