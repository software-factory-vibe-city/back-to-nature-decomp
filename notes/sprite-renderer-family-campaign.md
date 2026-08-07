# Sprite-Renderer Family Campaign

**Goal:** decompile the remaining sprite-renderer family
(0x80015E3C–0x80016B7C, plus the adjacent hook-sharing func_80015704) so we
can reason about this codebase's source idioms — and use that evidence to
explain, shrink, or retire the assembly hybrid on func_80016280, the family's
big renderer.
**Started:** 2026-08-02 (after the func_80016054 breakthrough).

## Why this family, why now

func_80016280 carries the project's largest reconstruction exception: a
39-instruction asm region covering an entry/guard schedule that exhaustive
source search (~290k candidates) could not reach in clean C. In 2026-08 we
closed every toolchain-shaped explanation for that residual (compiler
versions 2.7.2–2.95.2 including a purpose-built 2.95.1, patchlevel source
diffs, strict-aliasing defaults, psx patchset, `-mcpu` scheduler models, and
byte-comparison of maspsx against real ASPSX 2.77/2.86). The residual is a
source-shape question, and the cheapest new constraints are the sibling
functions: same author, same TU or shared headers, same structs.

func_80016054 then demonstrated the value concretely: a "stuck at 28/29"
sibling turned out to be three lines of natural C plus a two-instruction
debug-hook macro — the previous hybrid's residual was caused by its own
asm constraints. See `notes/research/caller-capture-debug-hook.md` for the
recovered macro (`include/debughook.h`), the byte signatures, and the
matching doctrine (null-case rule, prune-to-natural, wall constructs).

## What the family gives us (evidence channels)

1. **Author dialect** — do the siblings need reuse-heavy idioms (like the
   `work` redefinition fingerprint in 80016280's loop) or plain C? This
   calibrates how much of 80016280's odd candidate shape is authorial style
   versus coincidental fit, and re-aims any future residual search.
2. **Shared macro layer** — CAPTURE_RA is recovered; the 0x3C0 getTPage
   x-mask (vs 0x3ff in vendored 4.7 headers) already proves this TU used a
   nonstandard/older header vintage. Sibling matches surface further shared
   expansions for free.
3. **Shared types** — `SourceData`/`Group`/`Header`/`Entry` declarations were
   inferred from one function. Siblings using the same fields can force
   corrections, and type corrections propagate into 80016280's webs and
   allocation — a live path to moving its historical 202/214 clean-C result.
4. **Prologue witnesses** — each matched sibling is certified 2.95.2 output
   from this exact file. If a 5+-arg sibling matches fully, 80016280's
   prologue anomaly is a lone island (hand-tuning plausible); if another
   sibling sticks the same way, it is a file-level phenomenon.
5. **Packet lifecycle helpers** — the setup/teardown wrappers (EE8, F80, 160C8, 161AC) call `func_80011F5C(0)` for packet init (returns s32 stored on stack) and `func_80011FD8(s32)` for teardown. Thin wrappers (5E3C, 5E78) don't. Confirmed by func_80015EE8 match.
6. **The multi-set mechanism in vivo** — func_800165D8 increments a primitive
   pointer through a parameter (naturally multi-set), which dodges the sched1
   single-set birth boost. Matching it shows the compiler producing the
   early-parameter-copy behavior 80016280's target demands, from real source.

## Member status (address order)

| Function | Status | Notes |
|---|---|---|
| func_80015704 | **matched, natural C plus CAPTURE_RA** | 68/68 byte-verified; initializes the shared source-data/animation object; split-statement hook removed the temporary empty barrier |
| func_80015E3C | matched | thin func_80016280 wrapper |
| func_80015E78 | matched | thin func_800165D8 wrapper |
| func_80015EE8 | matched | packet setup/teardown around func_80016280; uses func_80011F5C/func_80011FD8 |
| func_80015F80 | matched | packet setup/teardown around func_800165D8; argument-provenance caveat (see per-member note) |
| func_80016054 | **matched, natural C** | CAPTURE_RA hook wrapper; see research note |
| func_800160C8 | matched | packet setup/teardown around func_800165D8 (13 params) |
| func_800161AC | matched | packet setup/teardown around func_800165D8 |
| func_80016280 | matched (hybrid) | SPRT/DR_MODE renderer; 214/214; dialect re-attack executed 2026-08-07 — hybrid retained, block-0 mechanism mapped (see research note 2026-08-07 addendum) |
| func_800165D8 | **matched, clean C** | byte-verified 2026-08-06 with the TU-level `-mno-split-addresses` override; solution mechanics in notes/research/func_800165D8-code-region-fold-and-allocation.md §RESOLVED |
| func_80016B7C | **matched, natural C** | sprite data size calculator (calls 15B24 + 1782C); 5 params, `arg4` on the stack; see retros/func_80016B7C.md |
| func_80016C08 | matched | sprite entry loop driver (calls 6B7C twice); carries `-mno-split-addresses`; gp-rel TU-ownership evidence in its research note |

## Working order

1. ~~func_80015704~~ — done (68/68 byte-verified; split CAPTURE_RA macro).
2. ~~The four setup/teardown stubs~~ — done (EE8, F80, 160C8, 161AC matched).
3. ~~func_800165D8~~ — done (byte-verified 2026-08-06, TU flag).
4. ~~Revisit func_80016280~~ — dialect re-attack executed 2026-08-07. Outcome:
   hybrid retained; the block-0 residual's mechanism is now mapped
   (parameter-scratch reuse pins the copies but combine's block-local merge
   severs the anchors; see the research note's 2026-08-07 addendum before any
   further attempt). Flag probe: no fingerprint, `-mno-split-addresses`
   byte-inert for this symbol-free member.

## Per-member notes

Detail accumulated from matched members. Kept here rather than in
`notes/file-groupings.md`, which is a membership map.

- **func_800160C8** — 13 params
  (`s32,s32,s32,s32,s16,s16,s32,s32,u16,s16,s16,s16,s16`); frame 0x70, saves
  `$s0`–`$s7`+`$fp`+`$ra`+`$a0`+`$a1`; nested
  `func_80011FD8(func_800165D8(..., func_80011F5C(0), ...))`; passes arg6
  twice at `func_800165D8` positions 6–7.
- **func_80015F80** — its matched source claims to pass `(s32)arg4`/`(s32)arg5`
  at `func_800165D8` positions 6–7, but the assembly stores arg6 twice there.
  The source is semantically wrong and byte-matches anyway, presumably because
  `func_800165D8` ignores those positions. **Do not read argument semantics
  off this file** — use its assembly. The same caution applies to any wrapper
  whose "match" was reached without checking that each argument's value
  provenance is right.
- **Packet wrapper arity signal** — the setup/teardown wrappers share one
  structure (`func_80011F5C` + `func_800165D8` + `func_80011FD8`) and differ
  only in parameter count, so frame size reads out arity directly:
  func_80015F80 has 9 params/frame 0x68, func_800160C8 has 13 params/frame
  0x70, and the 0x08 delta is exactly two more saved registers. Run
  `npx tsx tools/agent/triage.ts <target>` to get this comparison
  automatically; mechanism in
  `notes/research/frame-size-arity-diagnostic.md`.
- **func_80016B7C** — matched; 5 params with `arg4` on the stack. Cost ~20
  variants to a phantom inline-asm reading of an ordinary stack-argument
  load. See `notes/retros/func_80016B7C.md`.
- **func_800165D8** — the heavyweight, decompiled to clean C (15 params,
  POLY_FT4 renderer). Decoded fully: setPolyFT4 + semi-trans ternary code
  (0x2C/0x2E) + setRGB0(0x80) + setShadeTex(0); getClut/getTPage from uv0/uv1
  with arg11/arg13 override sentinel -1; 4-way uv flip on `field_08 & 3`;
  coordinate path with fixed-point `*arg7 / 4096` scaling when
  `arg7+arg8 != 0x2000`, else plain offsets; 0x18/0x8/0x10 corner select;
  addPrim vs 0x9000000 tag-insert + `D_8005E3C0->field_118 += 0x28`.
  Source uses explicit `s32 tpageYIn = arg12; s32 clutYIn = arg14;` locals —
  the target copies arg12/arg14 into frame slots 0x0/0x4 at entry and reloads
  them in the loop. Status: opcode LCS 347/361 (instruction selection done);
  remaining diff is a whole-function register-allocation permutation plus ONE
  semantic fold: CSE forwards the setShadeTex getcode load onto the ternary
  code pseudo (REG_EQUAL 44/46), combine proves `&0xFE` identity via
  nonzero_bits, and merges the shade-store into the ternary store — the target
  keeps both stores plus the `lbu`/`andi 0xFE`. Tested: ternary vs if/else
  code forms (if/else keeps the reload but folds the redundant 0x2C store;
  ternary keeps the merge store but folds the reload — target keeps BOTH),
  switch vs if/else for the flip chain, setShadeTex-before-setRGB0 reorder,
  and the arg12/arg14 locals. None reproduces the target's coexistence of the
  merge store and the non-forwarded reload; the target's compiler simply did
  not forward that load. Believed to need exact global register pressure to
  defeat constant hoisting (target rematerializes 44/0xff00 in-loop; the
  candidate hoists them into callee-saved regs, displacing arg5-arg8).
  Work-in-progress clean-C source in `src/func_800165D8.c`; mechanism
  analysis + resume checklist in
  `notes/research/func_800165D8-code-region-fold-and-allocation.md`.
  Not byte-matching yet, so revert `src/func_800165D8.c` to an INCLUDE_ASM
  stub if a green build is needed before the allocation residue is closed.

## Method doctrine (short form; details in the debug-hook note)

- Run `npx tsx tools/agent/triage.ts <target>` first; it checks the
  arity/frame, stack-argument, CAPTURE_RA, and source-policy symptoms and
  cites the note for each hit.
- Compile the null case (no asm) before building or fighting any hybrid.
- Prune to natural after any match; every deviation from natural C must
  justify itself instruction by instruction.
- Memory clobbers and `$sp` operands are scheduling walls; plain volatile asm
  is not a load barrier.
- Move statements, not values: source-statement position (insn LUIDs) is the
  scheduling control; staging locals and dummy asm dependencies are traps.
- Check `notes/file-groupings.md` and update it with new grouping evidence.
