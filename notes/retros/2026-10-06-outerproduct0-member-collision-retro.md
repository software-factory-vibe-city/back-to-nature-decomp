# Retro: func_80038674 was never a game function

**Closed 2026-10-06 (diagnosis).** Repair tracked in
`plans/implemented/lib-member-name-collision-repair.md`.

## What happened

`func_80038674` carried a full handwritten-asm body under an `embedded-asm`
policy exception since 2026-08-09, classified "handwritten GTE, correctly
assembly." During the asm-exception survey, two independent agents each
spent roughly an hour trying to re-derive it as compiled C with GTE macros.
Both produced byte-exact bodies (20/20 words) that could never finalize: the
splat segment is 0x50 bytes and a compiled function must append its own
`jr $ra`.

It cannot finalize because it is not a game function. The region is PSY-Q
4.7 libgte's **OuterProduct0** (LIB member `SMP_00_1`), a prebuilt SDK
object: 20 instructions + `j $31` + 3 pad nops = 0x60 bytes, confirmed by
locating the exact byte sequence inside the vendored `LIBGTE.LIB`. The
right end state is linking the object, not reconstructing it.

## The bug chain

1. **8-character member names collide.** The 4.7 LIBGTE signature set has
   11 colliding member names; `SMP_00_1.OBJ` names three different
   functions: `LightColor`, `OuterProduct0`, `Lzc`.
2. **The lib split is last-write-wins by member name.**
   `lib/libgte/smp_00_1.o` contains only `Lzc`; OuterProduct0's object
   never existed on disk.
3. **The detector cross-checks by the same key and drops silently.**
   `detectLibFunctions.ts:364` discards any signature larger than its
   keyed `.o`'s `.text` — verbose-only stderr. OuterProduct0's 96-byte,
   zero-wildcard signature matched the binary perfectly at 0x28E74 and was
   discarded against Lzc's 32-byte object. (Lzc's own match at 0x28ED4 is
   correct; it just wears the shared name.)
4. **Mop-up passes manufactured a coherent fiction.** The orphaned head —
   jal'd by game code — became game function `func_80038674`; the orphaned
   tail (`jr $ra` + nops at 0x28EC4) was placed as libsnd's `dmynot1`, a
   zero-relocation stub, on the strength of exe.txt's own earlier output.

Scope: `LightColor`'s fingerprint is absent from this exe and no other
colliding member is placed in the yaml, so OuterProduct0 is the only
realized casualty in SLUS-01115. The defect is latent for any binary that
links a lost collision variant.

## Why it stayed invisible

- `make check` hashes bytes; the map was wrong but byte-complete, so the
  build stayed green.
- The only witness to the contradiction (matched signature, unverifiable
  object) was a `--verbose` stderr line and a counter that never reaches
  the output. A silent drop is the opposite of the project's
  undetermined-over-default rule.
- Downstream provenance hardened the fiction: exe.txt's
  `dmy_nothing1 // type:func`, the 2026-08-09 retro's "correctly assembly"
  classification, and an allowlist entry each made the next reader more
  confident.
- Every matching instrument is function-scoped. On a region that is not a
  compiled game function, they return plausible numbers (20/20, clean
  residual axes) rather than errors, sustaining the wrong frame.

## Lessons

- A region offered for decompilation must first pass a boundary premise
  check: contains its own return; does not abut a zero-relocation lib
  placement; is not inside the lib band. This function fails all three in
  milliseconds.
- For cop2-tiled functions, search the vendored SDK LIBs for the literal
  byte sequence before any reconstruction — "this is an SDK member" is the
  cheapest closure there is.
- A tool-written name is not corroboration for a later pass of the same
  tool. Zero-relocation stubs match everywhere and need external evidence.
- When a verification step discards a perfect primary match because of a
  secondary artifact, that is a finding to surface, never a skip counter.
