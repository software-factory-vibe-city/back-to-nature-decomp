# Plan: scripted exhaustive campaign over the probe-C source family (func_80019070)

Goal: find a byte-exact object match for `func_80019070` by exhaustively
compiling the small neighborhood of one known-good source structure
("probe C"), or prove that neighborhood insufficient. This is a scoped,
scripted, fully-recorded campaign — not ad-hoc editing.

## Context you must not re-derive

- `src/func_80019070.c` is the accepted semantic baseline: 72/81 exact,
  the 9 mismatches are a scheduling permutation of the entry block.
  **Never modify `src/` or any pipeline-critical file.** All work happens in
  the scratchpad or under `build/`.
- The automated residual search (grammar schema 4, run
  `build/residualSourceSearch/func_80019070/43f44a30139030a4`) swept the
  witness-directed sections exhaustively for their entry windows
  (archived classes: `classes-s620/`, `classes-s861/`, `classes-s862/`).
  Conclusions, already proven — do not re-test them:
  - a coalescible copy of `ordering_table` must exist and issue inside the
    entry window (it appears as the target's `move t3,a0`);
  - the `4` must flow through the `code` variable (multi-set web);
  - the `0x64` must be its own variable AND multi-set: fresh single-set
    forms schedule it late in every admissible order (166,320 tried), and
    merging it into `sprite_x` is impossible (target has `sra t5` before
    `sb v1,7(t0)` in different registers).
- Probe C (`build/residualSourceSearch/func_80019070/handprobe/probeC.c`)
  realizes all of that with one extra local, `clut_index`, born as `0x64`
  (feeds the sprite code byte) and re-set later as the CLUT byte offset:
  `clut_index = palette << 1;` used as
  `*(u16 *)((char *)D_80049044 + clut_index)`. The `<<1` must survive
  constant folding — plain `D_80049044[clut_index]` with
  `clut_index = palette` gets propagated away and reverts to the dead end.
- Probe C scores 44/81 with head `[0] [1]` exact and, for the first time,
  `li v1,100`-class code at the target's slot 2 in its own register. The
  target head (normalized) is:

  ```text
  move t0,a1 | li v0,4 | li v1,100 | move t3,a0 | andi a2,a2,65535 |
  sll a3,a3,16 | sra t5,a3,16 | andi t6,a2,15 | andi a2,a2,240 |
  lw a1,32(sp) | sb v0,3(t0) | sb v1,7(t0) | lw t7,36(sp) | lh t4,16(sp) |
  lbu a3,20(sp) | lbu t1,24(sp) | lbu t2,28(sp) | sltiu v0,a1,6 | bnez ...
  ```

  Probe C's residue: `clut_index` gets `a1` while `palette` gets `v1`
  (target wants the reverse), and the copy issues at slot ~6 in `$t2`
  (target: slot 3, `$t3`). Both are schedule/allocation reactions to
  source arrangement — the family plausibly contains the fix.
- Probe order variants already tried by hand (all collapse to two
  schedules): births-first orders (C/D/E/F, li at slot 2, clut=a1) and
  glyph-ops-first order (B, li at slot 5, clut=v1). The exhaustive order
  sweep below subsumes them.
- The automated tool OOMs on probe C (16-web universe) — that is why this
  campaign is hand-scripted with the web structure FROZEN. Do not try to
  run `searchResidualSourceSpace` on probe C.

## Hard rules

- C89 only; the two existing empty `__asm__ volatile("" ::: "memory")`
  barriers are inherited and immutable: same count, same relative
  positions among the statements they separate. No new barriers, no
  pragmas, no register hints.
- Oracle: full-object byte equality via the configured pipeline. A cc1
  81/81 stream match must still be confirmed at the object level.
- Record every distinct assembly class and its first divergence. If the
  family exhausts without an exact match, the deliverable is that honest
  record, not a weaker claim.
- Any exact candidate is promoted BY HAND through the normal
  diffFunc/export/finalization workflow afterwards; this campaign never
  edits `src/`.

## The family to enumerate

Fixed structure (identical semantics to `src/func_80019070.c`):
locals `texture_u`, `sprite_x`, `clut_index`, `code`, `prim_ot`
(`s32 *`, the copy); `palette_index` eliminated (use `palette` directly:
`if (palette >= 6) palette = 0;`); tail from `glyph >>= 4;` onward exactly
as in probe C. Enumerate only:

1. **Entry-region statement order** (primary dimension). The nine
   statements between the function's first statement and the first
   barrier:

   ```c
   glyph = (u16)glyph;            /* A: must precede B and C */
   texture_u = glyph & 0xF;       /* B: must precede C (reads pre-mask) */
   glyph &= 0xF0;                 /* C */
   code = 4;                      /* D: must precede F */
   clut_index = 0x64;             /* E: must precede G */
   prim_ot = ordering_table;      /* H: free */
   setlen((&packet->sprite), code);        /* F */
   setcode((&packet->sprite), clut_index); /* G: F and G commute */
   sprite_x = (s16)x;             /* I: free */
   ```

   Dependencies: A<B, A<C, B<C, D<F, E<G. Everything else commutes
   (F/G write distinct bytes of the header). That is 9 nodes with 5
   edges — on the order of 10^4 admissible orders; enumerate ALL of them
   (use `RegionOrderModel` from
   `tools/agent/residual-source-search/topological-orders.ts` for exact
   count/unrank, or a simple recursive generator with those edges).

2. **Cheap structural toggles** (secondary; combine each with the full
   order sweep only if the pure order sweep exhausts):
   - declaration order of the five locals (2-3 permutations, e.g.
     `clut_index` declared first/last) — declaration order can nudge
     nothing or stack/padding behavior; cheap to include;
   - declaration-initializer births for D/E/H (e.g. `u8 code = 4;` in the
     cluster, statement removed) where the initializer reads only
     parameters/constants;
   - `clut_index` declared `u32` (probe C) vs `s32`;
   - the CLUT read spelled `*(u16 *)((u8 *)D_80049044 + clut_index)`
     (cast variant only — keep the byte-offset shape).

Expect massive collapse: the scheduler normalizes most orders. Dedupe by
normalized assembly hash before any deeper work; the number of DISTINCT
schedules will likely be under a dozen.

## Mechanics (proven snippets)

Work in the scratchpad; put durable outputs under
`build/residualSourceSearch/func_80019070/handprobe-campaign/`.

One-time setup — target stream and target object come from
`establishBaseline` (compiles nothing into the project):

```ts
import { establishBaseline } from "<repo>/tools/agent/residual-source-search/source-input.js";
const baseline = establishBaseline({
  functionName: "func_80019070",
  sourcePath: "<repo>/src/func_80019070.c",
  runRoot: "<repo>/build/residualSourceSearch/func_80019070/handprobe-campaign/baseline",
});
const target = baseline.bundle!.target;          // normalized stream
const targetObject = baseline.targetObject!;     // assembled target object
```

Per candidate:

```ts
import { compileSource } from "<repo>/tools/agent/decompToolchain.js";
import { parseCc1Assembly, compareNormalized } from "<repo>/tools/agent/variant-lab/compile.js";
import { functionObjectsEqual } from "<repo>/tools/agent/source-shape-search/evaluator.js";

const artifacts = compileSource(candidatePath, workDir, "func_80019070",
  comparison.exact === comparison.total ? { assemble: true } : undefined);
const compiled = parseCc1Assembly(artifacts.assembly);
const comparison = compareNormalized(target, compiled);
// if stream-exact: functionObjectsEqual(targetObject, artifacts.object!, workDir)
```

(Compile once without assemble, and only re-compile with
`{ assemble: true }` when the stream is 81/81 — assembly is the slow
step.) Run scripts with `npx tsx`; top-level await requires a `.mts`
file. Renders are plain string templates over the fixed statement texts —
no need for the search's renderer.

For every distinct assembly class keep: one representative source, the
first divergence, the head (first 14 canonical instructions), and the
count of orders that collapsed into it. Write a `campaign.jsonl` +
`summary.md` under the campaign directory.

## Decision tree

1. Sweep all admissible orders of dimension 1 (single toggle set = probe
   C's). Dedupe. If any class is stream-exact → object-confirm → STOP,
   report the exact source and hand it over for normal promotion.
2. If not: inspect the best class heads. If some class fixes the
   clut/palette swap (`li v1,100` AND `lw a1,32(sp)`) but misplaces the
   copy, or vice versa, sweep dimension 2 toggles combined with the
   nearest-miss orders first, then the full cross product.
3. If the family exhausts with no exact: STOP. Report the distinct
   classes with their divergences and state plainly that the probe-C
   family (as bounded above) does not contain the target; the recorded
   frontier then feeds the tooling track (general expression
   materialization, domain streaming, scheduler-model tie-break fix) in
   `plans/automatic-residual-source-space-search.md`.

Do not widen the family beyond the toggles listed here without recording
the widening as a new explicit dimension — the value of this campaign is
that its coverage claim is checkable.
