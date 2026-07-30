# Plan: corrected-witness source-only campaign for `func_80019070`

## Goal

Attempt one small, mechanism-directed clean-C campaign against the corrected
scheduler witness for `func_80019070`. The campaign must either:

1. find a byte-exact object match and hand-promote it through the normal
   function finalization workflow; or
2. establish that the bounded natural saved-value/reused-scratch source family
   below cannot realize the witness.

This is deliberately **not** a tooling project. Do not modify compiler,
scheduler, search, build, Pi, or policy code. Do not broaden into another
statement-order or declaration permutation search.

All experimental sources and reports belong under:

```text
build/residualSourceSearch/func_80019070/source-only-campaign/
```

Do not modify `src/func_80019070.c` unless a candidate is first confirmed
byte-exact at the object level.

## Mandatory project context

Before executing, read completely:

- `AGENTS.md`
- `.pi/skills/psx-decompile-function/SKILL.md`
- `configs/project-profile.md`
- `prompts/c-style-guide.md`
- `src/func_80019070.c`
- `build/asm/nonmatchings/func_80019070/func_80019070.s`
- `build/residualSourceSearch/func_80019070/corrected-witness/summary.md`
- this plan

The active project configuration remains authoritative for compiler flags,
assembler behavior, declarations, and verification commands.

## Established facts: do not re-derive or re-test

### Accepted source baseline

`src/func_80019070.c` is the accepted semantic baseline. It compiles to 81
instructions and matches 72/81. Target indexes 10-80 are exact; indexes 1-9
are an order-only entry-block mismatch.

The target entry head is:

```text
move t0,a1 | li v0,4 | li v1,100 | move t3,a0 |
andi a2,a2,65535 | sll a3,a3,16 | sra t5,a3,16 |
andi t6,a2,15 | andi a2,a2,240 | lw a1,32(sp) |
sb v0,3(t0) | sb v1,7(t0)
```

The accepted source must remain untouched while this campaign runs.

### Probe-C source topology

The campaign starts from:

```text
build/residualSourceSearch/func_80019070/handprobe/probeC.c
```

Probe C introduced the source topology needed to put the initial `0x64` in its
own multi-set local:

```c
clut_index = 0x64;
/* initial sprite-code use */
...
clut_index = palette << 1;
/* CLUT byte-offset use */
```

It also carries `ordering_table` through `prim_ot`. Probe C compiles to 81
instructions and 44/81 exact. Its relevant head is:

```text
move t0,a1 | li v0,4 | li a1,100 |
andi a2,a2,65535 | andi t5,a2,15 | andi a2,a2,240 |
move t2,a0 | sll a3,a3,16 | lw v1,32(sp) | sra t4,a3,16 |
sb v0,3(t0) | sb a1,7(t0)
```

The lower score is an allocation rotation, not a semantic regression. Keep
`clut_index` multi-set in every variant; returning it to a fresh single-set
`0x64` web is a proven dead end.

### Exhausted probe-C family

`plans/probec-family-hand-campaign.md` was executed completely. Its record is:

```text
build/residualSourceSearch/func_80019070/handprobe-campaign/summary.md
```

The campaign compiled all 303,840 bounded members and found 24 normalized
assembly classes, none exact. It exhausted:

- all dependency-valid orders of A/B/C/D/E/H/F/G/I;
- three declaration orders;
- every declaration-initializer subset of D/E/H;
- `u32` versus `s32` `clut_index`;
- `char *` versus `u8 *` CLUT byte-base casts.

Do not repeat or widen those dimensions here.

### Corrected scheduler model and high-bound witnesses

The scheduler comparator was corrected after the probe-C campaign. The old
schema-4 witness was based on a subtly wrong comparator and is superseded.
Both corrected searches replay their candidates exactly at 21/21.

Current 72/81 source witness:

```text
build/schedulerConstraint/func_80019070/3829d2c5cefce41c
```

- SAT after 790,563 assignments at a 10,000,000-assignment bound.
- Requires birth-boost removal for UIDs 72 and 65.
- Requires coalescible readers of UID 4 / pseudo 81 and UID 65 / pseudo 104.

Probe-C witness, which governs this campaign:

```text
build/schedulerConstraint/func_80019070/c3ce99db7e4a9a06
```

- SAT after 1,003,526 assignments at a 10,000,000-assignment bound.
- Requires birth-boost removal for UID 73 / pseudo 101, the sign-extended X
  result currently allocated to `$t4`.
- Requires a coalescible reader of UID 4 / pseudo 81, the ordering-table entry
  copy currently allocated to `$t2`.
- Requires a coalescible reader of UID 73 / pseudo 101.

The witness's complete desired block-0 LUID order is:

```text
UID 4, UID 6, UID 38, UID 40, UID 16, UID 22, UID 28, UID 34,
UID 47, UID 50, phantom81, UID 56, UID 71, UID 73,
UID 59, UID 62, phantom101, UID 65, UID 68, UID 77,
UID 80, UID 83, UID 84
```

In source-role terms, the reorderable entry statements should first be born in
this order:

```text
H, D, E, P, A, I, B, C, X, F, G, first barrier
```

where:

- H: `prim_ot = ordering_table;`
- D: `code = 4;`
- E: `clut_index = 0x64;`
- P: saved ordering-table reader, `saved_ot = prim_ot;`
- A: `glyph = (u16)glyph;`
- I: `sprite_x = (s16)x;`
- B: `texture_u = glyph & 0xF;`
- C: `glyph &= 0xF0;`
- X: saved X reader, `saved_x = sprite_x;`
- F: initial `setlen`
- G: initial `setcode`

Variant UIDs and pseudo numbers may shift. Bind roles through trace provenance
and canonical instructions; never assume variant UID 73 is still the X result.

### Previous corrected-witness source checks

The following were already tested and must not be repeated:

```text
build/residualSourceSearch/func_80019070/corrected-witness/
```

Results:

- Plain `saved_ot = prim_ot` and `saved_x = sprite_x` assignments appear in
  initial RTL but CSE removes or propagates them. By combine/sched, the result
  is the unchanged 44/81 probe-C class.
- Reusing `sprite_x` for constant width 8 or height 12 did not help. The
  sign-extension result remained a single-set, birth-boosted sched1 pseudo.
- Splitting the two `addPrim` consumers between copied and original pointers
  did not preserve the ordering-table copy.
- Pointer-walk forms forced the ordering-table carry to survive and changed
  useful allocation roles to `move t3,a0`, `sra t5`, and the target's later
  `$t6/$t7` family. They also emitted a real extra `addiu`, producing 82
  instructions, and retained the clut/palette swap.

The pointer-walk result is a positive mechanism control: a surviving reader can
produce the predicted allocation reaction. It is not a solution and must not
be promoted.

## Campaign hypothesis

A plain copy is too easy for CSE to substitute. A saved-old-value copy may
survive if the source variable is later reused for a different **existing
semantic computation**. If the reuse replaces an operation already present in
the target, the source may create a sched1-visible copy without adding a final
instruction.

The campaign tests this mechanism separately for:

1. the sign-extended X value; and
2. the ordering-table pointer.

Only individually successful source families are combined.

## Global hard rules

- C89 only: declarations at the top of the block and `/* */` comments.
- Preserve all three inherited empty memory barriers exactly. Do not add,
  remove, or move a semantic statement across one except where a variant below
  explicitly places an existing computation at its existing later use site.
- No new assembly, tied-output barriers, volatile objects, pragmas, register
  hints, flag overrides, helper calls, or source-policy exceptions.
- Keep `clut_index` as the multi-set `0x64` / CLUT-byte-offset local.
- Preserve complete function semantics for every parameter value.
- Every variant is a complete source file under `build/`.
- Do not edit `src/` during evaluation.
- Do not modify project tools to make a variant easier to generate, compile,
  trace, or accept.
- Do not rank by final instruction score before checking the intended compiler
  mechanism.
- A cc1 stream match is not sufficient; an exact candidate requires full-object
  equality through the configured pipeline.

## Fixed declarations and entry order

Use Probe C's declarations, adding only the saved local needed by a variant:

```c
u32 texture_u;
s16 sprite_x;
s16 saved_x;       /* X variants only */
u32 clut_index;
u8 code;
s32 *prim_ot;
s32 *saved_ot;     /* ordering-table variants only */
```

Do not vary declaration order or use declaration initializers.

All Stage 1 variants use the witness source order. Omit P or X only when that
copy is not part of the isolate:

```c
prim_ot = ordering_table;        /* H */
code = 4;                        /* D */
clut_index = 0x64;               /* E */
saved_ot = prim_ot;              /* P, when present */
glyph = (u16)glyph;              /* A */
sprite_x = (s16)x;               /* I */
texture_u = glyph & 0xF;         /* B */
glyph &= 0xF0;                   /* C */
saved_x = sprite_x;              /* X, when present */
setlen((&packet->sprite), code);  /* F */
setcode((&packet->sprite), clut_index); /* G */
__asm__ volatile("" ::: "memory");
```

Everything not explicitly changed below remains byte-for-byte source-equivalent
to Probe C's tail.

## Stage 0: record one control

Create `control-witness-order.c` by applying the fixed entry order above to
Probe C without adding `saved_x` or `saved_ot`.

This is a control compile, not a new search dimension. Record its normalized
assembly hash, instruction count, first divergence, and pass trace. It prevents
attributing an order-only reaction to a saved-value mechanism.

## Stage 1A: X-carry isolates

Create exactly two variants. They keep ordinary Probe-C ordering-table handling
through `prim_ot`; they do not add `saved_ot`.

Both variants add `saved_x`, execute `saved_x = sprite_x` at X before the first
barrier, and use `saved_x` for the eventual XY store:

```c
setXY0((&packet->sprite), saved_x, y);
```

### X1: reuse `sprite_x` for the CLUT byte offset

Keep the required second `clut_index` set and make it feed `sprite_x`:

```c
clut_index = palette << 1;
sprite_x = (s16)clut_index;
setClut((&packet->sprite), 0x380,
        *(u16 *)((char *)D_80049044 + sprite_x));
```

This is semantically safe after the existing `palette >= 6` correction:
`clut_index` is in 0..10 and fits `s16` exactly.

Intended mechanism:

- the original signed-X value must be saved because `sprite_x` is redefined;
- the redefinition consumes the already-required palette-offset computation;
- `clut_index` remains multi-set and semantically used;
- the saved-X copy should survive CSE to sched1, remove the sign-result birth
  boost through liveness, and disappear during coalescing/allocation.

### X2: reuse `sprite_x` for texture-U bytes

Leave CLUT setup unchanged. After the third inherited barrier and before XY/UV
setup, use the existing texture-U computation:

```c
sprite_x = (s16)(texture_u * 8);
setXY0((&packet->sprite), saved_x, y);
setUV0((&packet->sprite), sprite_x, (glyph * 3) << 2);
```

`texture_u` is in 0..15, so the assigned value is in 0..120 and fits `s16`.

Intended mechanism:

- the X value is saved across a later meaningful redefinition;
- the redefinition replaces the existing `texture_u * 8` operation rather
  than introducing new arithmetic;
- the saved-X copy should survive sched1 but coalesce out later.

## Stage 1B: ordering-table carry isolates

Create exactly two variants. They retain Probe C's `sprite_x` handling and do
not add `saved_x`.

Both add `saved_ot`, execute `saved_ot = prim_ot` at P before the first barrier,
and use `saved_ot` for both `addPrim` operations.

### O1: reuse `prim_ot` for the CLUT-table base

After palette correction and before the CLUT read:

```c
clut_index = palette << 1;
prim_ot = (s32 *)D_80049044;
setClut((&packet->sprite), 0x380,
        *(u16 *)((char *)prim_ot + clut_index));
```

Both primitive links remain:

```c
addPrim(saved_ot, (&packet->sprite));
...
addPrim(saved_ot, packet);
```

Intended mechanism:

- `saved_ot` must retain the original ordering-table pointer because `prim_ot`
  is redefined;
- the second value replaces the already-required CLUT-table base
  materialization;
- the saved ordering-table reader should survive CSE to sched1 and disappear
  after allocation, leaving target `move t3,a0` without an extra instruction.

### O2: reuse `prim_ot` for the advanced packet pointer

Use `saved_ot` for the first primitive link. Replace Probe C's packet advance:

```c
addPrim(saved_ot, (&packet->sprite));

prim_ot = (s32 *)((char *)packet + sizeof(SPRT));
packet = (SpritePacket *)prim_ot;
setDrawTPage((DR_TPAGE *)packet, 1, 1, 0xE);
addPrim(saved_ot, packet);
```

Intended mechanism:

- `saved_ot` carries the old ordering-table value across a meaningful
  redefinition of `prim_ot`;
- the redefinition represents the already-required `packet + sizeof(SPRT)`
  result;
- the final stream must still contain only the target packet `addiu`, not an
  additional pointer move or add.

## Stage 1 pass gates

Compile and trace all four isolates before combining anything.

### X isolate passes only if all are true

1. The saved-X assignment creates a distinct reg-reg copy in RTL.
2. That copy remains present in `.sched` and reads the pseudo produced by the
   signed-X `sra` role.
3. The signed-X producer is not birth-boosted when it becomes ready. In the
   trace, bind this by role; a displayed sched1 priority of `0x7f000001` still
   indicates the unwanted birth boost.
4. The copy disappears by regmove/global allocation and emits no final move.
5. Final instruction count remains 81.
6. No target semantic operation or inherited barrier is lost.

### Ordering-table isolate passes only if all are true

1. The `saved_ot` assignment creates a distinct reg-reg reader of the entry
   ordering-table pseudo in RTL.
2. That copy remains present in `.sched` before the first barrier.
3. It disappears by regmove/global allocation and emits no final move.
4. Final instruction count remains 81.
5. The final entry copy moves toward or reaches target `$t3` without rotating
   the function into a new unsolved register family.
6. No target semantic operation or inherited barrier is lost.

A variant that improves match percentage but fails its mechanism gate is
rejected. A variant that proves its mechanism but rotates allocation is kept as
evidence for Stage 2.

If neither X isolate passes, stop the X family. If neither ordering-table
isolate passes, stop the ordering-table family. Do not invent replacements in
this campaign.

## Stage 2: combine only successful isolates

If at least one X isolate and at least one ordering-table isolate pass their
Stage 1 mechanism gates, combine the passing forms as a Cartesian product,
with an absolute maximum of four combined variants.

Every combined variant uses the fixed witness entry order:

```text
H, D, E, P, A, I, B, C, X, F, G, first barrier
```

Do not combine a failed isolate merely because it had a better final score.

### Combined pass gates

Evaluate in this order:

1. Both saved-value copies survive through sched1.
2. The sign-extension producer loses its birth boost.
3. The sched1 projected real-instruction order matches the corrected witness.
4. Both copies disappear before final assembly.
5. Final instruction count remains 81.
6. Allocation reaches the target roles, especially:
   - `li v1,100` with `lw a1,32(sp)`;
   - `move t3,a0`;
   - `sra t5`;
   - nibble role `$t6` and later stack-argument role `$t7`.
7. Both sched2 and delay-slot output remain target-compatible.
8. Rank exact normalized instructions only after gates 1-7 are recorded.

If a combined candidate is 81/81 at cc1 output, immediately assemble it and
compare function objects, including relocations. Do not continue searching
until object equality is known.

## Stage 3: at most three focused birth-order variants

Run this stage only when one combined source satisfies both copy-survival gates
and the boost gate but misses the corrected witness because the two copy LUIDs
are born in the wrong relative positions.

Take the single best mechanism-complete combined source and test at most these
three explicit orders:

1. witness order (normally already tested):
   `H,D,E,P,A,I,B,C,X,F,G`;
2. producer-adjacent order:
   `H,P,D,E,A,B,C,I,X,F,G`;
3. split-adjacent order:
   `H,D,E,P,A,B,C,I,X,F,G`.

These are not permission for another topological-order sweep. If the trace does
not name a LUID-only miss, Stage 3 is forbidden.

The entire campaign therefore contains:

- one control;
- four isolates;
- at most four witness-order combinations;
- at most three focused birth-order variants;

for an absolute maximum of 12 compiled source variants including the control.

## Mechanics and recording

### Compile and compare

Use the configured helpers directly from a small scratch `.mts` runner under
the campaign build directory:

```ts
import { compileSource } from "<repo>/tools/agent/decompToolchain.js";
import {
  compareNormalized,
  parseCc1Assembly,
} from "<repo>/tools/agent/variant-lab/compile.js";
```

Compile every candidate with dumps enabled and without assembly first:

```ts
const artifacts = compileSource(candidatePath, workDir,
  "func_80019070", { dumps: true });
const compiled = parseCc1Assembly(artifacts.assembly);
const comparison = compareNormalized(target, compiled);
```

Do not change project tooling. The existing diagnostic runner can be copied or
reused as reference:

```text
build/residualSourceSearch/func_80019070/corrected-witness/evaluate-batch.mts
```

The variant laboratory currently rejects the inherited empty barriers during
source validation. Do not fix or bypass that tool as part of this source-only
campaign; use the configured compiler helpers above.

### Trace

For every isolate and combined candidate, run:

```bash
npx tsx tools/agent/compilerTrace.ts func_80019070 \
  --src <candidate.c> --scheduler-window 1:25
```

Preserve the trace output in that candidate's artifact directory. Record:

- first pass at which the candidate diverges from the control;
- whether each intended copy exists at RTL, CSE, combine, sched, regmove, and
  greg;
- the sign-extension pseudo's SET count and sched1 birth status;
- sched1 block-0 order;
- global allocation order and hard-register assignments;
- final instruction count, normalized score, first divergence, and first 14
  canonical instructions.

### Exact object confirmation

Only for an 81/81 stream candidate, recompile with assembly enabled and compare
against the target object using:

```ts
import { functionObjectsEqual } from
  "<repo>/tools/agent/source-shape-search/evaluator.js";
```

A stream-exact but object-mismatching candidate is not a solution.

### Durable reports

Write:

```text
build/residualSourceSearch/func_80019070/source-only-campaign/campaign.jsonl
build/residualSourceSearch/func_80019070/source-only-campaign/summary.md
```

For each candidate include:

- ID and complete source path;
- source roles used and entry order;
- mechanism prediction;
- mechanism verdict with pass evidence;
- copy survival/deletion stages;
- boost verdict;
- instruction count and normalized score;
- first divergence and first 14 canonical instructions;
- object equality if reached.

## Decision tree

### Outcome A: exact

If a candidate is object-exact:

1. inspect the complete source manually;
2. verify C89 and clean-source policy;
3. promote it by hand to `src/func_80019070.c`;
4. run `psx_diff_function`;
5. export context;
6. run `psx_finalize_function`;
7. continue from any concrete finalizer failure.

### Outcome B: no isolate realizes a phantom

Stop. State that the corrected abstract witness is not realized by the bounded
natural saved-old-value/reused-scratch family. Record the exact deletion pass:
usually CSE if the copy vanished early, or final instruction growth if it did
not self-delete.

Do not build new tooling and do not expand source syntax in this campaign.

### Outcome C: isolates work, combinations fail before sched1

Stop with the first coupled compiler-pass conflict. Report which individually
successful copy is deleted or reboosted when combined. Do not rank unrelated
variants.

### Outcome D: sched1 witness realized, allocation/final output fails

Stop with the exact greg or sched2 conflict. This is stronger evidence than a
match score. A later task may investigate that one coloring conflict, but this
campaign does not add another source dimension.

### Outcome E: all 12 variants exhaust without exact

Stop and preserve the best mechanism-complete source. The next project-level
decision is whether independent provenance evidence justifies classifying the
target as manually/post-compiler scheduled. Exhausting this campaign alone is
not proof of handwritten assembly and does not authorize an assembly
exception.

## Completion checklist

Before reporting:

- all tested sources are complete policy-clean C89;
- `src/func_80019070.c` is unchanged unless an object-exact candidate was
  deliberately promoted;
- all three inherited barriers are preserved;
- `clut_index` remains multi-set;
- every candidate has pass-mechanism evidence, not only a score;
- no more than 12 variants including the control were compiled;
- any exact stream was confirmed at object level;
- `campaign.jsonl` and `summary.md` honestly report exact, exhausted, or
  mechanism-blocked status.
