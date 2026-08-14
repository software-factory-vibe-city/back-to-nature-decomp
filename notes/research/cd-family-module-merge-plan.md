# CD-family module merge — what a real TU could reveal (plan, 2026-08-14)

Deferred until full function coverage; recorded here so the reasoning is
not re-derived. Context: func_80014CBC matched (2026-08-14) under
allowlisted hybrid asm whose constructs stand in for unrecovered facts
about the original translation unit. The family per
`notes/file-groupings.md`: func_80014854, func_80014988, func_80014B44,
func_80014CBC (+ the -fcommon-merged gp-rel cluster D_8005E3F0/E410/E428/
E430/E2B4 and friends).

## What the evidence already establishes

- NOT a precompiled/vendored object: the function byte-matches under this
  project's exact cc1 and baseline flags, defines TU-owned gp-relative
  globals merged via -fcommon with the family, and sits interleaved with
  matched game code. A foreign .o could do none of that.
- Plausibly vendored SOURCE (SDK sample lineage): canonical libcd call
  sequence, retry-on-`CdReadSync == -1`, sector rounding, and old-style
  habits (no prototype for func_80021B20 — implicit int is burned into the
  allocation).
- The bytes prove declaration-level facts the per-function reconstruction
  reaches only by force: arg4/arg5 memory-resident (BLK aggregates or
  equivalent), arg1 homed to its slot, and an entry schedule consistent
  with insns the lone-function TU does not generate.

## What merging can reveal (and how)

TU context changes compilation through exactly one channel — what is in
scope when each function is parsed. Per-function pass dynamics (pseudo
numbering, UIDs, scheduling, allocation) reset per function. Therefore:

1. **The shared preamble typedef.** The strongest hypothesis for the BLK
   parameters is a file-scope 4-byte struct type declared once and used
   across the family. In a merged module, one proposed typedef is tested
   against every member simultaneously — and the already-matched members
   are free constraint oracles: any preamble hypothesis MUST keep them
   byte-identical. Wrong guesses die in one compile.
2. **The true declaration environment.** Which members see each other's
   definitions (function order in the file is checkable against address
   order), and which external callees were undeclared. The implicit-int
   set must come out consistent across the whole module.
3. **Data-layout truth.** The duplicated -fcommon tentative definitions
   collapse to the original's single set; object boundaries become real
   instead of emulated. Verify against the link map (check it BEFORE
   blaming splat — a boundary error masquerades as a codegen mismatch),
   and expect artifacts like the sdata alignment warnings in `make check`
   to dissolve if the grouping is right.

What merging cannot do by itself: move any scheduler/allocator decision.
Those change only via the declarations the merge surfaces.

## The func_80014CBC ablation checklist

Once a merged module exists, try dissolving its asm constructs one at a
time, byte-oracle-gated, in this order (each maps to the suspected
original feature; mechanism details in
`notes/retros/2026-08-14-func_80014CBC-retro.md`):

1. `ReadFlag` arg4/arg5 → the real file-scope type (or address-taken
   parameters, if the preamble hunt says so).
2. `len = arg2` split → likely a real second local (`size`-style).
3. The home-store carrier + eptr asm → plain declarations, letting reload/
   assign_parms emit the store; with the true block-0 stream the release
   dynamics may land it at +0x54 unaided.
4. The srl/andi pair, ref pumps, and volatile carriers → expected to fall
   out once 1–3 restore the original web population.

Every removal must keep `diffFunc` at MATCH and the full binary green; if
all four fall, retire the `embedded-asm` allowlist entry for
`func_80014cbc`.

## Practical notes

- Change the split through `tools/build/mergeFragments.ts`, never by
  hand-editing splat.yaml.
- Re-check the link map before and after (an in-progress function earlier
  in the image shifts every later object).
- Expectation management: the matched neighbors are small; the merge may
  confirm layout while the preamble hunt still reduces to guessing one
  typedef. Even then the problem becomes a small finite search with a
  byte-exact oracle.
