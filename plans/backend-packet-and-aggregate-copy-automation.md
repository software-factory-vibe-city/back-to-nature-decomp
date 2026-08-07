# Plan: backend packet attribution and frame decomposition repair

**Status: revised and partly delivered, 2026-08-07.** This supersedes the first
proposal, which was written before the mechanism was measured. Every claim
below was verified against the pinned compiler; the measurements are recorded
inline so the reasoning can be rechecked rather than retold.

Phases 0, 1 and 3 are delivered. Phase 2 is delivered except for its
enforcement clause. Phase 4 is designed but not built. The per-phase status
blocks below say exactly what landed, and `Next steps` collects what did not.

## Delivered

| Phase | Status |
|---|---|
| 0 — frame decomposition | done, 4 regression tests |
| 1 — `-dp` emission attribution | done, 9 tests, wired into the trace path |
| 2.1 — stop fabricating BLK canonicals | done, 1 test |
| 2.2 — `exactCount` load-bearing | done, surfaced in the report |
| 2.3 — one-to-many links | done, 2 tests, attribution is authoritative |
| 2.4 — packet members excluded from scheduling participants | **not done** — reported, not enforced |
| 3 — triage signal and testability | done, 7 tests |
| 4 — mechanism grid | **not started** |

`npm test` is 188 passing, up from 165. `make check` reports the payload
byte-identical.

## Purpose

Automate the class of decompilation failure exposed by `func_800140C8`: several
target machine instructions were emitted from one RTL instruction, so a
semantically correct scalar reconstruction could not reproduce the target and
no amount of allocator or scheduler search could close the gap.

The goal is to make the **operation boundary** mechanically visible before
source search begins, and to stop the frame detector from emitting a false
signal that sends the investigation the wrong way.

---

# What changed from the first proposal, and why

The first proposal was correct about the failure and wrong about the remedy.
Five findings moved it.

## 1. `-dp` already prints the RTL-to-machine attribution

GCC 2.95.2 has `-dp` (`toplev.c:5015`, `final.c:3334-3352`). Compiling the
motivating case with the project's exact flags:

```
	subu	$sp,$sp,32	 # 43	subsi3_internal	[length = 1]
	lui	$2,%hi(g) # high	 # 10	high	[length = 1]
	sw	$31,24($sp)	 # 45	movsi_internal2/7	[length = 1]
	addiu	$7,$2,%lo(g)	 # 16	movstrsi_internal	[length = 20]
	lb	$3,0($7)
	lb	$5,1($7)
	sb	$3,16($sp)
	sb	$5,17($sp)
	addu	$3,$sp,16	 # 13	addsi3_internal	[length = 1]
```

The annotation lands on the **first** line of each RTL instruction's emission;
following unannotated lines belong to it. That is the one-to-many mapping the
first proposal set out to reconstruct by modelling the backend. It comes from
the same hash-pinned `cc1` the build uses, for every pattern at once.

Verified end to end: **maspsx passes the annotations through unchanged** and
marks its own inserted nops with `# DEBUG:` comments, so attribution survives
to assembler input.

Consequence: the first proposal's Phase 1.3 (a TypeScript model of
`output_block_move`) and most of Phase 2.1 (a machine-pattern metadata index
built to supply widths) are deleted.

## 2. Declared `length` is neither bytes nor a width

The first proposal read `(set_attr "length" "20")` as 20 bytes and derived
emission width as `length / 4`. Both are wrong.

`length` here is in **instructions** — the default at `mips.md:70` is
`(const_int 1)`, and `-dp` reports `[length = 1]` for a single `subu`. It is
also an unrefined upper bound: `movstrsi_internal` declares 20 and emitted 5 in
the case above. Declared length cannot predict emission width and is not used
for that purpose anywhere in this plan.

## 3. Modelling `output_block_move` is ill-posed, not merely expensive

`mips.c:3234-3572` is 339 lines, and its output is not a function of
`(size, alignment, address class)`:

- the trailing `%#` nop is conditional on `set_noreorder`, a mutable file-scope
  counter that *other* patterns increment (`mips.c:4681`);
- a `safe_regs` self-recursion (`mips.c:3262-3280`) branches on which hard
  registers reload actually assigned;
- `use_lwl_lwr` is set per chunk but cleared per **batch** (`mips.c:3567`), so
  one unaligned chunk changes every chunk beside it;
- the `NOT_LAST`/`LAST` split (`mips.md:6230`) carries a scratch address
  register across two RTL instructions.

Three movstr patterns are live here, not one: `movstrsi_internal`,
`movstrsi_internal2` (NOT_LAST), `movstrsi_internal3` (LAST, declared
length 1).

## 4. The corpus does not support a block-copy-first slice

A scan of all 302 remaining non-matching functions for the load-batch/store-batch
signature finds four windows:

| function | shape | status |
|---|---|---|
| `func_800140C8` | 2x1B straight-line | already matched |
| `func_80013B04` | 2x1B straight-line | stub |
| `func_80019610` | 4x4B **loop body** | stub |
| `func_80019AD0` | 4x4B **loop body** | stub |

The last two are the same function structurally (both 123 instructions) and are
loop-form, which the first proposal explicitly deferred. So the proposed
vertical slice bought exactly one remaining function — and that function's
prefix is the same idiom against the same symbol, already solved in
`notes/research/func_800140C8-aggregate-copy.md`.

The wider class is much more common. Measured on the same corpus: 11 functions
contain the division trap packet, 30 contain `mult`. `-dp` on the project's
flags shows why that matters:

```
	div	$0,$4,$5	 # 11	divmodsi4_internal	[length = 1]
	mflo	$2	 # 28	movsi_internal2/12	[length = 1]
	bne	$5,$0,1f	 # 13	div_trap_normal	[length = 3]
	nop
	break	7
1:
```

`div_trap_normal` emits three instructions **including a label**, so any tool
that derives a control-flow graph from target assembly sees a phantom basic
block there. A general attribution mechanism covers this; a block-copy detector
does not.

## 5. There is an active misattribution bug, not just a missing feature

`emission-alignment.ts:70-140` synthesizes a canonical string for
`(set (mem:BLK ...) (mem:BLK ...))` — BLK is neither `QI` nor `HI`, so it falls
through and emits a `sw` form. If that collides with a real machine `sw`,
Tier 1 binds it as a score-100 "exact" anchor and propagates a wrong UID into
delay-slot and scheduler-constraint reasoning. The `exactCount` field that
would flag the disagreement is computed at three return sites and consumed by
nothing.

---

# Design principles

Carried forward from the first proposal, which had these right:

1. **Report compatibility, not historical proof.** A machine sequence
   compatible with a block mover does not prove the original source used
   aggregate assignment. Exact compilation settles reconstruction.
2. **Target-side before source search.** Detection must work on a bare
   `INCLUDE_ASM` stub, before m2c output anchors the search to scalar
   statements.
3. **Ask the compiler, do not model it.** Pattern names, widths, and emission
   boundaries come from running the pinned compiler, never from a
   reimplementation of its logic.
4. **Preserve packet boundaries.** Scheduler and allocator tools must not model
   instructions inside one RTL packet as separate RTL decisions.
5. **Type shape and operation shape are separate axes.** A struct with
   member-wise assignments is not an aggregate-copy experiment.
6. **Fail closed.** Where attribution is ambiguous, say so; never emit a
   confident wrong link.
7. **Generated artifacts stay under `build/`.** No automatic source or header
   promotion.
8. **No new workaround channels.** No inline asm, register pins, pragmas,
   volatility perturbations, stubs, or flag overrides.

---

# Phase 0: repair frame decomposition

**Status: done.** `frameMap.ts` now requires a word-size, four-byte-aligned
store for an outgoing argument candidate and excludes bytes covered by an
address-taken local. Regression tests are inline instruction literals in
`tools/agent/frame-map.test.ts`.

Two already-matched functions were being misread and are now correct:

```
func_800140C8  before: args 0x18 + vars 0x0, "5-6 argument slots"
               after:  args 0x10 + vars 0x8, "up to 4"
func_80012A68  before: args 0x18 + vars 0x0, "5-6 argument slots"
               after:  args 0x10 + vars 0x8, "up to 4"
```

`func_80012A68` is the independent confirmation: its source calls `ClearImage`
with four arguments and holds an 8-byte `RECT`, so both numbers are checkable
against C rather than against the assembly that produced them.

A sweep found 32 functions whose partition the rule change could move. None
produced a negative or impossible local region. Only those two had ground
truth, so the rest are unverified rather than confirmed — see `Next steps`.

## Problem

`frameMap.ts` misclassifies `func_800140C8`'s byte stores at `sp+0x10` and
`sp+0x11` as outgoing fifth/sixth argument slots. Verified by running the tool
against the now-matching function:

```
frame 0x28 = args 0x18 + vars 0x0 + saves 0xC (3 registers)
widest outgoing call: 5-6 argument slots
0x10  address taken -> array or by-reference local   [28:	addiu	v1,sp,16]
```

The report contradicts itself in adjacent lines. Truth is `args 0x10 +
vars 0x8`; the callees take one and two arguments.

The defect is narrower than the first proposal described. The scan at
`frameMap.ts:313-329` is already windowed to 12 instructions around a call and
already excludes offsets read back by this function. What it lacks is any
notion of **slot width** or of the address-taken local it already detects six
lines earlier at `frameMap.ts:272-277`, which is currently print-only.

## Change

Two rules in `analyzeFrame`:

- **Width.** An outgoing stack-argument candidate must be a word store at a
  four-byte-aligned offset. Under O32 a stack argument occupies a word slot;
  `sb`/`sh` into that region is a local.
- **Address-taken exclusion.** Compute local regions from the existing
  `addressTaken` offsets, extending each by the contiguous run of stack stores
  from that offset under their access widths. Offsets inside such a region are
  never outgoing arguments.

Where the partition stays ambiguous, report unknown rather than assigning the
whole region below the saves to outgoing arguments.

## Tests

- `func_800140C8`: 0x10 outgoing, 0x08 locals, three saves, no false arity
  signal.
- Byte local at `sp+0x10` immediately before a call: local, not outgoing.
- Aligned `sw` at `0x10(sp)` in a call delay slot with no reload: outgoing.
- Address-taken local above a real fifth argument: both classified correctly.

## Acceptance

`frameMap` on `func_800140C8` reports `args 0x10 + vars 0x8` and drops the
5-6 argument claim. No other function's classification changes without a
recorded reason.

---

# Phase 1: emission attribution from `-dp`

**Status: done.** `tools/agent/compiler-trace/emission-attribution.ts` parses
the annotations; `compileSource` takes an opt-in `emissionAttribution` flag;
`compilerTrace.ts` sets it, so every trace now carries attribution. The
production build in the `Makefile` is untouched. The annotations are comments
and every consumer strips from `#` onward, so they are transparent to
instruction parsing.

On the exact `func_800140C8` source:

```
uid 16  movstrsi_internal  -> 5 line(s), declared length 20 (upper bound, instructions)
    | addiu	$7,$2,%lo(D_8005E2AC)
    | lb	$3,0($7)   | lb	$5,1($7)
    | sb	$3,16($sp) | sb	$5,17($sp)
```

## Change

Add `-dp` to the diagnostic compile path only. The production build in the
`Makefile` is untouched.

New module `tools/agent/compiler-trace/emission-attribution.ts` parsing the
annotation format:

```
<asm text>\t # <uid>\t<pattern_name>[/<alternative>]\t[length = <n>]
```

into a packet list: for each RTL UID, the pattern name, alternative index,
declared length, and the **contiguous run of emitted assembly lines** it owns
(the annotated line plus every following unannotated line).

Rules:

- an annotated line opens a packet; unannotated lines extend the open packet;
- lines maspsx marks `# DEBUG:` are recorded as assembler insertions, not
  compiler emission;
- a label between annotations belongs to the open packet — this is what makes
  `div_trap_normal` legible;
- an assembly line before any annotation is reported as unattributed rather
  than assigned to a neighbour.

This yields exact one-to-many attribution for every pattern with no modelling.

## Tests

- `movstrsi_internal` owning five lines from one UID.
- `div_trap_normal` owning three lines including the local label.
- `mulsi3_internal` and a following `mflo` as two distinct single-line packets,
  proving the parser does not merge on adjacency alone.
- Unattributed leading lines reported, not absorbed.

## Acceptance

On the exact `func_800140C8` source, attribution maps the `addiu`/`lb`/`lb`/
`sb`/`sb` run to one UID with pattern `movstrsi_internal`.

---

# Phase 2: correct the alignment path

**Status: 2.1, 2.2 and 2.3 done; 2.4 not done.**

With attribution available, `func_800140C8` went from 21/29 machine
instructions linked with 8 ambiguous, to 29/29 with none, and the report now
names the packet:

```
- Emission links come from cc1 -dp, not from canonical matching.
- RTL insn 16 (movstrsi_internal) emitted 5 machine instructions; its members
  are one compiler decision and cannot be reordered through source statement order.
```

That statement is currently prose. Nothing enforces it — see 2.4.

## 2.1 Stop fabricating BLK canonicals

`rtlCanonical` must refuse to synthesize a machine-instruction canonical for a
BLKmode memory-to-memory set. Such an instruction is a packet whose width comes
from attribution, never from a guessed mnemonic.

## 2.2 Make `exactCount` load-bearing

`exactCount` is currently dead. Surface it: when final RTL and machine counts
disagree after proven skips, the renderer must say so, and downstream consumers
must treat inferred links as inferred.

## 2.3 One-to-many links

Represent attribution as machine index to UID (many-to-one), which fits the
existing scalar `uid` field on `MachineInstructionRef` and avoids reworking
`scheduler-constraint/derive.ts`'s reverse map. Where `-dp` attribution is
available it is authoritative and replaces canonical matching.

## 2.4 Scheduler and allocator behaviour — NOT DONE

Instructions inside one attributed packet must not create independent
scheduling participants. A request to reorder two members of one packet must be
reported as unreachable through source statement ordering.

The caveat says this; no code enforces it. `intervention-search.ts`,
`counterfactual-replay.ts`, `scheduler-replay.ts` and `scheduler-constraint/`
have no notion of a packet. The links now carry the grouping — every machine
index in a packet shares one UID — so the enforcement has the data it needs and
is a consumer change, not a new analysis.

## Acceptance — not demonstrated

`analyzeTargetSchedule` on the exact aggregate candidate reports one packet for
the copy region rather than five independent participants.

The obvious witness is unusable: `func_800140C8` is matched, so its
`Prioritized requirements` section is empty and there are no participants to
group. Demonstrating this needs a function that both generates scheduling
requirements and contains a packet. `func_80013B04` is the nearest candidate
once it has a candidate source.

---

# Phase 3: triage signal

**Status: done.** `triage.ts` exports its detectors and guards `main()`, so it
is importable by tests for the first time. `detectBackendPacket` runs
target-side on a bare stub. Seven tests, four of them negative.

On a bare `func_80013B04` stub the signal now leads the report:

```
[signal] backend-packet
  target instructions 14..17 are compatible with ONE block-move RTL instruction
  (2 bytes, 2 x 1-byte chunks), not 4 independent loads and stores. Test a
  whole-object assignment before allocator or scheduler work ...
    | compatibility only: this geometry does not prove the original source used
      an aggregate copy
```

## 3.1 Make `triage.ts` testable

The file has zero exports and an unguarded `main()` at line 695, so no detector
can be unit tested. Add `export` to the detectors and guard `main()` with the
`import.meta.url` check `frameMap.ts:733` already uses.

## 3.2 Target-side packet signal

A target-side detector for the load-batch/store-batch geometry, reported as
compatibility and never as proof, citing the aggregate-copy research. It must
carry the measured threshold, because without it the signal is noise:

- `bytes <= 32 && align == 4` is `move_by_pieces` — interleaved `lw`/`sw`, no
  packet, and member-wise scalar C compiles **byte-identically** to
  `*dst = *src`. Measured; there is nothing to detect.
- `bytes <= 32 && align < 4` is one `movstrsi_internal`.
- `bytes > 32` is a loop, with a runtime alignment test above 32 at align 1.
- non-constant size is a `memcpy`/`bcopy` call.

Since fixtures must be inline (`build/` is gitignored, so no target assembly is
committed), the detector is tested against transcribed instruction literals.

## Acceptance

Triage on a bare `func_80013B04` stub recommends the two-byte aggregate-copy
experiment before source-shape, allocator, or scheduler work.

---

# Phase 4: mechanism grid — NOT STARTED

## What it is for

Phase 1 and Phase 4 are inverses. `-dp` attribution is a **forward** map: given
source you already wrote, which RTL instruction emitted which lines. It needs a
candidate to exist. Phase 4 is the **reverse** map: given a target shape you
cannot yet produce, which source construct emits it.

The reverse map is what was missing. The 707-candidate search was an attempt to
answer it by force over a grammar that could not express the answer.

## What it unlocks

1. **Named recipes instead of hints.** The detector currently says "compatible
   with one block move, test a whole-object assignment", which still requires
   knowing what to write. A grid makes it a lookup. This matters most for
   shapes nobody has solved: `func_80019610`/`func_80019AD0` are loop-form
   copies at 36+ bytes and alignment 4, a different recipe (four-word loop body
   plus a residual tail) that no note records.
2. **Negative knowledge, the more valuable half.** At alignment 4 and 32 bytes
   or less, member-wise scalar C compiles byte-identically to `*dst = *src`, so
   an aggregate experiment there is provably wasted. Recording where an axis
   *cannot* change the output is what lets the residual search shrink. That
   matters because `MAX_DOMAIN_ENTRIES = 400_000` is already exceeded on real
   functions, and because the project already removes strata on exactly this
   evidence standard.
3. **Declaration shape read off the target.** `extern P g[]` produced
   `lui`+`addiu` with a shared base; `g[1]` and `g[4]` produced the `lb $2,g`
   macro form. Gridding declaration completeness against size and `-G8`
   generalizes past block copies to every global in the project.
4. **Coverage across the class.** Block copies are 3 remaining functions; the
   division trap packet is in 11, `mult` in 30. Switch lowering, bitfields,
   64-bit operations, soft-float and constant materialization are unmeasured.
   The grid scales to all of them because it is "compile probes, record
   shapes", with no per-pattern engineering.
5. **Honest exhaustion.** A named inventory of operation families lets a search
   report which families it covered and which it never had.

## Tooling

```text
tools/agent/mechanismGrid.ts          CLI: build | query | show
tools/agent/mechanism-grid/
├── probes.ts          axis definitions and C probe generation
├── run.ts             compile each probe, attribute it, record the result
├── shape.ts           normalize assembly to a register-independent signature
├── query.ts           match a target window against recorded cells
├── identity.ts        compiler hash + probe-set hash keying
├── types.ts           versioned schema
├── render-text.ts
└── mechanism-grid.test.ts
```

Artifacts under `build/mechanismGrid/<identity>/`, regenerated rather than
checked in — the treatment `compiler-source` already gives its index.

Probes are generated from axis tuples, not checked in as `.c` files. Axes:
construct family, size, alignment, address class, storage class. That is a few
hundred to a couple of thousand `cc1` runs at tens of milliseconds each, so a
full rebuild is a minute or two.

Reuse, not rebuild:

| Existing | Reused for |
|---|---|
| `compileSource(..., { emissionAttribution: true })` | probe compilation with `-dp` |
| `parseEmissionAttribution` | pattern names and packet spans per probe |
| `configuredToolchainIdentity()` | keying the grid to the pinned compiler |
| `parseCc1Assembly` | instruction normalization |
| `compilerSource.ts pattern <name>` | citing the `define_insn` behind a cell |

## The one hard piece, and its failure mode

`shape.ts` decides whether this works. Matching a target window against a cell
needs a register-independent signature: opcode sequence, access widths,
relative offset geometry, address class, and load-result-to-store dataflow,
with registers alpha-renamed.

The hazard is specific. A loose signature becomes a second canonical-matching
heuristic — which is exactly what produced the BLK misattribution bug fixed in
2.1, where a fabricated `sw` canonical could bind as a confident wrong anchor.
`shape.ts` must fail closed: report "no cell matches" rather than the nearest
plausible neighbour, and never label a partial match exact.

## A schema requirement that is easy to miss

Cells must record indistinguishability as a **result**, not as an absence. "At
alignment 4 and <= 32 bytes, member-wise scalar and whole-object assignment
produce identical bytes" is one cell holding two constructs. That is the
negative knowledge from unlock 2, and it only exists if the schema is a
many-to-many map between shapes and constructs rather than a lookup keyed on
shape.

## Policy obligations

- A bounded Pi wrapper, e.g. `psx_query_mechanism_grid`, taking an exact
  function name and optional instruction range. No shell fragments, no
  arbitrary compiler flags, no source-promotion controls. Registration test
  coverage per `notes/tools-directory-structure.md`.
- `package.json`'s test list is an explicit path list, not a recursive glob.
  `tools/agent/mechanism-grid/*.test.ts` must be added there or the tests
  silently never run.
- Probe generation emits clean C89 under the same source policy as everything
  else: no asm, no pragmas, no flag overrides.

Estimated 600–900 lines excluding tests, most of it `shape.ts` and `types.ts`.
An order of magnitude less than the `output_block_move` model the first
proposal wanted, and unlike that model it covers division, multiply, switch
lowering and the rest without further per-pattern work.

---

# Deferred

The first proposal's Phase 3 (aggregate-aware source synthesis, header
overlays, residual-grammar axes) is deferred, on evidence:

- `residual-source-search` is 6,180 lines and `MAX_DOMAIN_ENTRIES = 400_000` is
  already exceeded on real functions; both proposed axes are multiplicative.
- `CPP_FLAGS` is a module-level constant with no hook, and `semantic-graph.ts`
  scans the include path for type names into a **process-global cache**, so
  per-candidate overlays are a correctness hazard rather than plumbing.
- Run identity hashes the compiler and tools but not headers, so two overlays
  collide on one `runId` and checkpoint directory.
- `source-shape-synthesis` still uses a regex parser whose assignment matcher
  requires a bare identifier on the left, so it cannot see `a->x = b->x` — the
  exact shape the detection step needs.

Repeated target-idiom indexing is also deferred; with three sibling functions in
the corpus it does not yet pay for itself.

---

# Non-goals

- Proving the original typedef or field names from machine code.
- Automatically promoting generated declarations into shared headers.
- Modelling any backend output routine in TypeScript.
- Treating every load/store run as a block move.
- Adding compiler flags to the production build or source-policy exceptions.

# Next steps

Ordered by how much each one changes what an agent actually does.

1. **Route the signal through `explainDiff`.** The operation-family finding
   lives only in `triage` today. `explainDiff` is the structural classifier
   consulted mid-investigation, and it is where "do not proceed to allocator or
   scheduler work until a whole-object copy has been tested" has to outrank the
   scheduling and allocation classifications. Without this the detector is a
   capability nobody reaches for — the same failure the retro complained about.
2. **Update the decompilation skill ordering.** Put backend-packet detection
   between the triage/frame/SDK checks and structural source recovery, ahead of
   allocation and scheduler analysis.
3. **Enforce 2.4.** Make the packet grouping suppress independent scheduling
   participants rather than only describing them. The links already carry the
   grouping, so this is a consumer change in `intervention-search.ts`,
   `counterfactual-replay.ts` and `scheduler-constraint/`.
4. **Build Phase 4.** Design and obligations above.
5. **Record the Phase 0 sweep.** 32 functions can move under the new rule and
   only two had ground truth. Either check the remainder against callee arity
   or record the sweep as a note so the claim is auditable.

Two things worth attempting once 1 and 2 land, because they are the practical
test of whether any of this helps:

- `func_80013B04` — straight-line two-byte packet, same idiom and same symbol
  as the solved function. Should fall to the existing research note.
- `func_80019610`/`func_80019AD0` — loop-form copies, a recipe nothing records
  yet. These are the honest test of Phase 4's value.

# Acceptance criteria

| # | Criterion | Status |
|---|---|---|
| 1 | `frameMap` on `func_800140C8` reports the 0x10 outgoing area and 0x08 locals, with no false arity signal | met |
| 2 | `-dp` attribution maps the copy region to one UID and pattern name | met |
| 3 | Alignment no longer fabricates a canonical for a BLKmode set, and count disagreement is surfaced | met |
| 4 | Scheduler analysis treats an attributed packet as one participant | **not met** — reported, not enforced, and not demonstrated |
| 5 | Triage on a bare stub recommends the aggregate experiment for the remaining sibling | met |
| 6 | `npm test` and `make check` pass | met — 188 tests, payload byte-identical |
