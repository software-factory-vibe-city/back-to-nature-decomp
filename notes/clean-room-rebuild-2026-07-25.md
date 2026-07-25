# Clean-Room Rebuild Experiment (2026-07-25)

After the tools reorganization, we validated the entire pipeline from scratch:
moved `build/` to `build_bak`, ran `make disassemble && make split && make check`,
and asserted 1:1 parity. **The experiment initially FAILED — and uncovered a
latent pipeline regression from March.** Final result: full parity restored
and verified.

## Verdict

- `build/slus_011.bin` — **byte-identical** to the pre-experiment build (and
  to the original payload, per `make check`)
- All ~2,100 compiled object files (`.c.o`, `.s.o`) — **byte-identical**
  old vs fresh
- `include/globals.h` — identical to committed version
- `configs/splat.yaml` — stable; delta vs committed is only
  `ld_script_path` (intentional) + two correct library `.data` folds
- **Idempotency verified**: a second `make split` produces zero further
  config changes

## The regression it uncovered

Fresh `make split` (the first since ~March 14) misclassified the binary tail:
`dataStart` moved `0x39314 → 0x3EFF0` and `sdata` vanished. Cascade:
`patchSplatForLibs` rewrote segment types → `classifyGlobals` emitted ~60
spurious declarations → `src/func_80019E50.c`'s legitimate local extern
collided with a new `D_80049058` macro → build broke. (Had it linked, 6 KB of
real data — ASCII path strings like `objcg\gf.bin` — would have been
zero-filled → binary mismatch.)

### Root cause

`analyzeLayout.ts` was originally written for a spimdisasm run **without**
`--disasm-unknown` (init-era `CSV_PATH = build/without-unknown/functions.csv`).
The March `bootstrap.ts` refactor (likely agent-assisted) switched it to the
`--disasm-unknown` CSV. With that flag, spimdisasm invents **giant phantom
"functions"** inside data regions:

- `func_80048190` — 26 KB blob starting inside libpad's `pdresres.o` (whose
  `.text` is exactly `0x1E70` bytes, ending precisely at the real data
  boundary `0x39314`) and overrunning into real data
- `func_8004E840` — 38 KB blob further along

The byte-level heuristics (which operate at entry granularity) classify these
as code, pushing `dataStart` past real data. Nobody re-ran `make split` after
the refactor, so the breakage stayed latent for months. Lesson: **committed
generated configs are not proof of reproducibility — only re-derivation is.**

### Fix (restores the original design)

Two-pass disassembly in `tools/build/disassemble.sh` and
`tools/build/bootstrap.ts`:

1. With `--disasm-unknown` → `build/functions.csv` + per-function `.s`
   (for splitting and decompilation work)
2. Without `--disasm-unknown` → `build/without-unknown/functions.csv`
   (layout analysis only; no phantoms)

`bootstrap.ts`'s layout path now reads `LAYOUT_CSV`
(`build/without-unknown/functions.csv`); `analyzeLayout.ts`'s CLI already did.

## Deliberately kept changes

- `configs/splat.yaml`: two new library folds — `libmcrd/init.o` and
  `libcard/init.o` `.data` sections at `0x4E7D4`/`0x4E7E4`, previously
  unresolved and emitted as raw `sdata`. Resolved correctly this run from
  relocation data. Byte-neutral, better provenance.
- Tail retype: `[0x4E824]`/`[0x4EA74]` `sdata → data`, empty `sdata` marker
  at `0x4F000`. Byte-neutral (raw bytes either way); the March-era
  `sdataStart = 0x4E7D4` value is not reproducible by current tools and may
  itself have been a manual fix (see below).

## Postscript 2 (same day): full convergence achieved

Two follow-up changes completed the reproducibility story:

1. **Enriched disassembler symbols** — `tools/build/genDisasmSymbols.ts`
   generates `configs/disassembler_symbol_addrs.txt` from
   `configs/symbol_addrs.txt` (1,217 symbols vs the old `__start`-only file).
   spimdisasm now has entry points into indirectly-called library code:
   the split CSV grew 736 → 1,244 entries, lib regions carry real names
   (`_padSioRW`, ...), and the phantom `func_80048190` is unmasked as the
   real libpad function `_padChkRC2wait` whose *end* spimdisasm can't find.

2. **Access-driven sdata detection** — `analyzeAccess.ts` (restored, now
   `tools/diagnostics/`) infers section types from actual `%gp_rel` access
   patterns and emits `build/accessRegions.json`; `bootstrap.ts` uses its
   high-confidence `.sdata` region to set `sectionLayout.sdataStart`
   (`0x4F000` → `0x4DBD8` = VRAM `0x8005D3D8`, the documented boundary).

**Result of the second clean-room rebuild:** `.bin` byte-identical, all
object files byte-identical, `globals.h` identical, and `splat.yaml` matches
committed HEAD except the intentional `ld_script_path` line. The two lib
`.data` folds from the first rebuild turned out to be an *artifact of the
broken sdataStart*: with a correct boundary, `patchSplatForLibs` classifies
those lib sections as sdata-data entries and keeps the raw sdata dump —
exactly the March behavior. Idempotency re-verified (second split: zero
config changes).

## Residual items / open questions (superseded — see Postscript 2 above)

- **March's `sectionLayout.json` is not reproducible**: current
  `inferSectionBoundaries` derives `dataStart = 0x38990` (end of last code
  entry) and finds no sdata region, while the March cache says
  `0x39314` / `0x4E7D4`. The March values are *semantically nicer* but no
  current tool produces them — plausibly an eager manual edit from the March
  era (the very thing this project now guards against). Byte-neutral in
  practice. **Postscript:** the sdata question was later settled properly by
  the restored `tools/diagnostics/analyzeAccess.ts`, which infers section
  types from actual `%gp_rel` access patterns and finds `.sdata` at
  `0x8005D3D8`–`0x8005E800` (high confidence) — matching the documented
  boundary. See `notes/access-patterns.md`.
- **Phantom functions still exist in the with-unknown split**
  (`build/functions/func_80048190.s` etc.). They are correctly excluded from
  `callGraph.json` (filtered by .text range), so agents never see them as
  decompilation targets. Fine as-is.
- The old `build/` had been stripped of `functions.csv`/`functions/` entirely
  (2,136 files vs 2,872 fresh) — some March-era cleanup removed disassembly
  artifacts that `make split` actually needs. Fresh builds are complete again.
