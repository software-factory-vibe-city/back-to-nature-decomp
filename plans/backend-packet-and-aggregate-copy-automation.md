# Plan: backend-packet recognition and aggregate-copy source recovery

**Status: proposed.**

## Purpose

Automate the class of decompilation failure exposed by `func_800140C8`: a
semantically correct scalar reconstruction cannot reproduce the target because
several target machine instructions were emitted from one aggregate/block-copy
RTL instruction.

The initial vertical slice should detect target sequences compatible with
MIPS `movstrsi_internal`, keep multi-instruction RTL packets intact in compiler
analysis, and generate whole-object clean-C experiments instead of exhausting
member-wise scalar rewrites.

The intended workflow is:

```text
target assembly
      |
      v
backend packet detector
      |
      +-- target copy geometry and declaration constraints
      +-- compatible GCC pattern and scratch requirements
      +-- confidence-labelled clean-C operation-family recipes
      |
      v
aggregate-aware source synthesis with isolated header overlays
      |
      v
exact compile + trace
      |
      v
one RTL UID <-> multi-instruction machine packet confirmation
```

This is diagnostic and synthesis support, not a source promoter. Exact function
and full-build verification remain the acceptance oracle.

## Motivating case

The target prefix of `func_800140C8` contains:

```asm
lui    v0,%hi(D_8005E2AC)
sw     ra,32(sp)
sw     s1,28(sp)
sw     s0,24(sp)
addiu  a3,v0,%lo(D_8005E2AC)
lb     v1,0(a3)
lb     a1,1(a3)
sb     v1,16(sp)
sb     a1,17(sp)
```

The plausible scalar source had the right semantics, offsets, calls, frame,
instruction count, and suffix:

```c
base = D_8005E2AC;
tmp0 = base[0];
tmp1 = base[1];
ports[0] = (s8)tmp0;
ports[1] = (s8)tmp1;
```

CSE replaced the scalar offset-zero load with a direct `lo_sum` memory
address. That changed register-web parity, allocation, and scheduling. A
707-candidate residual search exhausted scalar representation forms without
being capable of expressing the missing operation family.

The matching source was one whole-object assignment:

```c
PadPortPair ports;

ports = D_8005E2AC[0];
```

GCC retained this as one `movstrsi_internal` BLKmode instruction through
`.dbr`. Its MIPS output routine expanded the one RTL instruction into:

```asm
addiu  a3,v0,%lo(D_8005E2AC)
lb     v1,0(a3)
lb     a1,1(a3)
sb     v1,16(sp)
sb     a1,17(sp)
```

The pattern declares four early-clobber scratch registers. Allocation selected
`$v1`, `$a1`, `$a2`, and `$a3`; the two-byte emitter printed the first two as
values and the last as the `LO_SUM` source base. What appeared to be five
independently allocated and scheduled instructions was one compiler packet.

A preliminary corpus scan found similar all-loads-then-all-stores windows in at
least seven functions, including `func_80013B04`, `func_80019610`, and
`func_80019AD0`. The mechanism is therefore worth supporting as a reusable
class rather than a function-specific exception.

Full account:
`notes/retros/2026-08-07-func_800140C8-retro.md` and
`notes/research/func_800140C8-aggregate-copy.md`.

## Existing-tool relationship

This plan extends existing tools rather than introducing parallel compilers,
parsers, or search engines.

| Existing component | Reused or extended responsibility |
|---|---|
| `decompToolchain.ts` | Target assembly, configured compilation, dumps, object comparison |
| `frameMap.ts` | Correct stack-local versus outgoing-argument decomposition |
| `triage.ts` | Early target-side backend-packet signal |
| `explainDiff.ts` | Route operation-family defects before allocator/scheduler analysis |
| `compilerTrace.ts` | Preserve pattern names, UIDs, allocation, and final RTL evidence |
| `target-schedule/emission-alignment.ts` | Support one RTL UID emitting multiple machine instructions |
| `synthesizeSourceShapes.ts` | Derive aggregate-copy recipes from a scalar copy candidate |
| `searchResidualSourceSpace.ts` | Add whole-object assignment as an operation-family grammar axis |
| `source-shape-search/` | Evaluate complete source and header-overlay candidate bundles |
| `fuzzVariants.ts` | Confirm first-pass mechanism divergence and exact final candidates |
| `sourcePolicy.ts` | Keep generated and promoted forms clean; no asm/register pins/flags |
| `diffFunc.ts` | Exact linked-byte oracle |
| `compilerSource.ts` | Cite the exact vendored machine pattern and output routine |

`analyzeStoreBlock.ts` is not the right home for the core detector. It mines
store-dominated initializer blocks and deliberately excludes stack stores. The
new detector pairs loads with stores, includes stack-local destinations, and
models compiler packet boundaries.

## Design principles

1. **Report compatibility, not historical proof.** A machine sequence can be
   compatible with a block mover without proving the original source used
   aggregate assignment. Exact source compilation and trace confirmation settle
   the reconstruction.
2. **Target-side before source search.** Packet detection must work on a bare
   `INCLUDE_ASM` stub so the operation family is considered before m2c output
   anchors the search to scalar statements.
3. **Compiler-backed explanations.** Pattern names, lengths, clobbers, and
   emission rules come from the configured hash-pinned compiler tree.
4. **Preserve packet boundaries.** Scheduler and allocator tools must never
   model instructions inside a proven multi-instruction RTL packet as separate
   RTL decisions.
5. **Type shape and operation shape are separate axes.** A struct with
   member-wise assignments is not an aggregate-copy experiment.
6. **Header context is part of source.** Global declaration size/completeness
   can change `-G8` addressing and must be testable without mutating live
   headers.
7. **Generated variants remain under `build/`.** No automatic source/header
   promotion.
8. **No new workaround channels.** The system does not emit inline asm,
   register pins, pragmas, volatility perturbations, stubs, or flag overrides.
9. **Honest finite search.** Exhaustion reports name whether the aggregate and
   declaration strata were searched or suppressed.
10. **One registered CLI per tool.** Any new `tools/agent/` entry point gets a
    bounded Pi wrapper and registration test coverage.

---

# Phase 0: repair frame decomposition

## Problem

`frameMap.ts` currently misclassifies `func_800140C8`'s byte stores at
`sp+0x10` and `sp+0x11` as evidence of outgoing fifth/sixth argument slots.
That inflates the target outgoing area from the ABI minimum 0x10 to 0x18 and
reports zero locals even on the exact matching source.

The current outgoing-store scan accepts any store at or above 0x10. It then
uses the presence of offset 0x10 as the beginning of a dense four-byte argument
run, even when the actual stores are `sb` at offsets 0x10 and 0x11 and the
value is later read through an indexed pointer derived from `sp+0x10`.

## Change

Extend `frameMap.ts` so an outgoing stack-argument candidate must satisfy:

- a word-size slot under O32 unless exact callee evidence establishes a narrow
  stack parameter convention;
- four-byte alignment;
- placement immediately before a call or in its delay slot;
- dataflow consistent with call argument setup;
- no overlap with an address-taken local range.

Infer address-taken local ranges from:

- `addiu reg,sp,offset` inside the frame;
- stack stores into that region;
- later loads through the derived pointer, including indexed pointers;
- access width and maximum observed offset.

If outgoing/local partitioning remains ambiguous, report unknown components
rather than assigning the entire region below saves to outgoing arguments.

## Tests

- `func_800140C8`: 0x10 outgoing, 0x08 padded locals, three saves.
- Existing five-argument fixtures such as `func_80016B7C`: preserve 0x18
  outgoing classification.
- Byte local at `sp+0x10` immediately before a call: local, not outgoing.
- Aligned `sw ...,0x10(sp)` in a call delay slot with no local reload: outgoing.
- Address-taken local plus a real fifth argument in the same function.

## Acceptance

`psx_triage(func_800140C8)` must no longer emit the false short-callee signal.

---

# Phase 1: target-side block-copy packet detector

## New files

```text
tools/agent/analyzeBackendPackets.ts

tools/agent/backend-packets/
├── assembly.ts
├── copy-geometry.ts
├── mips-block-move.ts
├── pattern-index.ts
├── render-text.ts
├── types.ts
└── backend-packets.test.ts
```

The CLI:

```bash
npx tsx tools/agent/analyzeBackendPackets.ts <function>
npx tsx tools/agent/analyzeBackendPackets.ts <function> --json
```

Artifacts:

```text
build/backendPackets/<function>/
├── report.json
└── report.txt
```

## 1.1 Assembly dataflow and copy geometry

Parse target instructions through shared `decompToolchain` types. For bounded
windows, identify copy candidates where:

- N loads use one source base;
- N later stores use one destination base;
- each loaded register feeds the corresponding store without redefinition;
- source and destination offsets are contiguous under the access widths;
- all loads precede all stores, as `output_block_move` emits them;
- source/destination base registers are not clobbered in the window;
- optional source/destination address formation can be traced immediately
  outside the window.

Initial supported chunks:

- `lb`/`lbu` + `sb`;
- `lh`/`lhu` + `sh`;
- `lw` + `sw`;
- `lwl`/`lwr` + `swl`/`swr` grouped as one unaligned word chunk.

Start with N=2..4, matching GCC 2.95.2 MIPS's four scratch operands. Looping
block-copy packets may be reported as repeated fixed-size chunks but are not
required for the first acceptance slice.

## 1.2 Address-formation recognition

Recognize:

- `lui high,%hi(symbol)` + `addiu base,high,%lo(symbol)`;
- GP-relative source/destination bases;
- `sp+offset` locals;
- register source/destination pointers;
- symbol plus constant addends.

Record target address class and declaration implications. For example:

```text
absolute HI16/LO16 access to a two-byte logical unit under -G8
  -> a known-size two-byte extern would normally be GP-relative
  -> test an incomplete outer array or larger containing aggregate
```

These are hypothesis constraints, not declarations to promote automatically.

## 1.3 Replay `output_block_move`

Implement a small read-only model of the relevant configured MIPS backend
logic, derived from vendored `mips.c`:

- width selection from remaining bytes and alignment;
- all loads before stores for each scratch batch;
- maximum four chunks per batch;
- `LO_SUM` source/destination handling via a scratch address register;
- expected printed instruction count;
- scratch count and consumption order.

The model must cite the configured compiler version/hash and source locations
in its JSON evidence. It should not execute or patch compiler code.

Given the target window, enumerate compatible `(size, alignment, address
class)` tuples and retain only exact packet replays after alpha-renaming hard
registers.

## 1.4 Report

Example:

```text
Backend packet candidate: high confidence
  target range:       instructions 5..9
  compatible pattern: movstrsi_internal (declared length 20 bytes)
  source:             D_8005E2AC + 0
  destination:        sp + 0x10
  copy size:          2 bytes
  alignment:          1 byte
  chunks:             lb/lb -> sb/sb
  scratch operands:   4 (one consumed by LO_SUM source address)

Suggested operation families:
  1. whole assignment of a two-byte, alignment-one record
  2. fixed-size compiler-recognized block copy, if period source evidence exists

Declaration check:
  test an incomplete outer array; a fixed one-element two-byte object is
  expected to select GP-relative addressing under -G8.
```

Confidence levels:

- `exact-replay`: packet geometry and backend replay both exact;
- `compatible`: copy geometry exact but multiple backend tuples remain;
- `suggestive`: load/store geometry only;
- `none`.

No result may say the original source is proven to be a struct assignment.

## 1.5 Integration

Add the detector to `triage.ts`:

- signal on a bare stub when an exact or compatible packet is found;
- cite the aggregate-copy research and compiler pattern;
- keep output bounded to the strongest few candidates.

Add routing to `explainDiff.ts`:

When inventory is clean, web parity fails, the target has an exact copy packet,
and the candidate expresses corresponding scalar loads/stores, report:

```text
operation-family mismatch
Target is compatible with one multi-instruction block-copy RTL packet;
candidate scalarization changes CSE and web structure. Do not proceed to
allocator or scheduler work until a whole-object copy has been tested.
```

This finding should outrank scheduling/allocation classifications.

## Phase 1 tests

Positive fixtures:

- `func_800140C8`: two-byte absolute-to-stack packet.
- `func_80013B04`: same pad-record packet under different registers.
- `func_80019610` and `func_80019AD0`: repeated four-word copy candidates.
- synthetic aligned halfword and unaligned word packets.

Negative fixtures:

- adjacent loads and stores with mismatched value registers;
- a loaded value transformed before storage;
- interleaved unrelated memory operations;
- coincidental load/store run with noncontiguous offsets;
- scalar code that is packet-compatible: report `compatible`, never `proven`.

## Phase 1 acceptance

Running triage on a bare `func_800140C8` stub must recommend a two-byte
aggregate-copy experiment before source-shape, allocator, or scheduler work.

---

# Phase 2: multi-instruction RTL emission alignment

## Problem

`target-schedule/emission-alignment.ts` primarily supports zero-width or
one-machine-instruction RTL forms. It cannot represent:

```text
UID 16 movstrsi_internal
  -> addiu
  -> lb
  -> lb
  -> sb
  -> sb
```

That causes final RTL/machine count disagreement and encourages later tools to
model packet members as independent scheduler nodes.

## 2.1 Machine-pattern metadata index

Add shared metadata extraction under `backend-packets/pattern-index.ts`.
Resolve the configured vendored compiler tree and parse the relevant MIPS
machine descriptions for:

- pattern name;
- recognizer code when available in dumps;
- declared length;
- output template versus output function;
- scratch/clobber operands and constraints;
- constant or variable emission width.

The initial supported variable emitter is `movstrsi_internal`; unknown dynamic
emitters remain unknown rather than guessed.

Cache the generated index under `build/compilerPatternIndex/<compiler-hash>/`.
The checked-in code is the parser/model, not generated compiler artifacts.

## 2.2 Variable-width alignment

Change final RTL-to-machine alignment from one-to-one matching to bounded
segmentation. Each final RTL instruction gets an emission-width domain:

- proven zero-width: `{0}`;
- ordinary known pattern: `{1}`;
- constant multi-insn pattern: `{declared length / 4}`;
- modeled `movstrsi_internal`: exact width from size/alignment/address form;
- unsupported dynamic form: bounded unknown with an explicit caveat.

Use dynamic programming to align RTL packets monotonically to candidate machine
instructions. Packet scoring should consider the whole emitted subsequence, not
only the first opcode.

Represent links as one-to-many:

```text
rtl UID 16 -> candidate machine indexes [5,6,7,8,9]
```

Transfer packet grouping through target/candidate machine correspondence when
the target packet matches exactly or by a confidence-labelled compatible
alignment.

## 2.3 Scheduler and allocator behavior

- Scheduler replay treats the packet as one UID/node.
- Instructions inside the packet do not create independent priority or LUID
  requirements.
- Scratch hard registers remain operands/clobbers of the one UID.
- Allocation reports identify printed register roles such as source-base
  scratch versus value scratch.
- A target request to reorder two members inside one proven packet is reported
  as unreachable through source statement ordering; it requires a different
  backend operation family.

## Phase 2 tests

- Existing one-to-one and zero-width alignment fixtures remain unchanged.
- Synthetic one-UID/five-machine-instruction movstr fixture.
- Exact aggregate `func_800140C8` trace links target indexes 5..9 to one UID.
- Scalar candidate does not invent packet grouping merely because opcodes are
  similar.
- Unsupported dynamic output fails closed with a caveat.

## Phase 2 acceptance

On the exact aggregate candidate, `analyzeTargetSchedule` must report one
20-byte packet rather than five independent scheduling participants.

---

# Phase 3: aggregate-aware source synthesis

## 3.1 Detect scalar-copy source regions

Extend the semantic graph to recognize candidate source regions equivalent to
a bounded memory copy:

```c
t0 = source[0];
t1 = source[1];
destination[0] = t0;
destination[1] = t1;
```

Required proof conditions:

- source expressions refer to one base and contiguous offsets;
- destination expressions refer to one object and contiguous offsets;
- intermediate values are not otherwise observed;
- no volatile access;
- no aliasing write intervenes;
- copied widths and casts preserve the stored low bits;
- replacing the statements with an object copy preserves later destination
  reads.

Ambiguous regions remain frozen.

## 3.2 New operation-family recipes

Add versioned recipes distinct from type/cast forms:

1. member-wise scalar copy;
2. whole-record assignment;
3. record containing a byte array, copied as one object;
4. fixed-size block-copy idiom only when known period/compiler support and
   clean-source policy permit it.

The primary C89 recipe is:

```c
typedef struct SynthCopy2 {
    u8 byte0;
    u8 byte1;
} SynthCopy2;

SynthCopy2 destination;
destination = source[0];
```

Enumerate only layouts compatible with target copy geometry:

- exact total size;
- alignment candidates admitted by backend replay;
- field widths that cover the copied bytes;
- no gratuitous packing attributes unless target evidence requires them.

Do not infer C signedness from `lb` inside `output_block_move`; byte signedness
may be varied or left semantically unresolved.

## 3.3 Candidate bundle and header overlays

A matching operation may require a global declaration change:

```c
extern Pair D_8005E2AC[];
```

Extend source-shape evaluation from one `.c` file to a candidate bundle:

```text
build/sourceShapeSearch/<function>/<candidate>/
├── source.c
├── include-overlay/
│   └── globals_override.h
├── manifest.json
└── compiler artifacts...
```

The overlay is generated from the active header plus exact, typed replacements.
It must:

- shadow only the candidate compile's include path;
- preserve every unrelated declaration byte-for-byte;
- record exact replacement ranges and hashes;
- reject duplicate/conflicting declarations;
- never modify `include/`;
- remain diagnostic until a human translates an exact candidate into the
  designated shared header.

Candidate declaration axes:

- incomplete outer array;
- fixed-count outer array where supported by target address class;
- containing aggregate only when neighboring access evidence permits it;
- element size/alignment from packet geometry;
- `const`/`volatile` only when semantically established, never as codegen
  perturbations.

## 3.4 Residual-search coverage reporting

The residual grammar must explicitly report:

```text
aggregate operation family: searched | inapplicable | suppressed(reason)
header declaration forms:   searched | inapplicable | suppressed(reason)
```

An exhausted scalar-only domain must never be summarized as exhausting clean C
when an exact target packet makes aggregate forms applicable but unsupported.

## 3.5 Requirement-guided ranking

When Phase 1 reports an exact backend packet and the candidate has a proven
scalar-copy region, aggregate recipes rank before:

- pointer volatility;
- dead administrative references;
- allocator phantoms;
- scheduler-state searches;
- flag hypotheses.

This is deterministic mechanism ordering, not score hill climbing.

## Phase 3 tests

- End-to-end scalar-to-whole-object rewrite for `func_800140C8` under an
  isolated header overlay reaches exact output.
- The rewrite is not offered when an intermediate loaded value has another use.
- Known `Pair[1]` selects the expected small-data form; incomplete `Pair[]`
  selects the target absolute form.
- No generated candidate edits live source or headers.
- Policy rejects asm, pins, pragmas, and new flag overrides in candidate
  bundles.
- Search terminal status distinguishes scalar exhaustion from aggregate/header
  coverage.

## Phase 3 acceptance

Starting from the clean scalar `func_800140C8` candidate, automatic synthesis
must generate and exactly compile the whole-record candidate without an
operator-authored manifest.

---

# Phase 4: repeated target-idiom index

This phase is useful but not required for the first vertical slice.

Add a normalized target subsequence index that alpha-renames registers while
preserving:

- opcode sequence;
- memory widths;
- relative offset geometry;
- symbol/address class;
- load-result-to-store dataflow;
- branch/control boundaries.

Given a current residual window, report sibling target occurrences and link to
matched source where available.

Example:

```text
Equivalent copy packet also occurs in:
  func_80013B04  target-only, same D_8005E2AC source
  func_80019610  16-byte register-to-register-base copy loop
```

This can expose shared source macros, types, aggregate declarations, and TU
families before source archaeology. Repeated machine syntax alone remains
supporting evidence, not proof of shared source.

Suggested files:

```text
tools/agent/indexTargetIdioms.ts
tools/agent/target-idioms/
```

The index belongs under `build/targetIdioms/` and should be regenerated from
active target assembly.

---

# Phase 5: compiler mechanism corpus

This is the strategic generalization after the block-copy slice proves useful.

## Goal

Build a compiler-hash-pinned catalog connecting clean-C operation families to
RTL patterns and emitted machine packets.

Curated probe families:

- aggregate copies over sizes/alignment 1, 2, 4, 8, 16, and small residuals;
- aggregate return and parameter passing;
- unaligned copies;
- fixed-size clears;
- bitfields;
- division/modulo;
- switch lowering;
- initializer and compound assignment forms;
- address forms affected by `-G8` and incomplete declarations.

For each probe preserve:

```text
clean C
preprocessed input
initial RTL
first relevant pass
final pattern name/UID
scratch and clobber constraints
machine packet
flags/compiler hash
```

## Instrumentation

Prefer extending the isolated compiler oracle so each `output_asm_insn` event
is associated with:

- current RTL UID;
- recognizer/pattern code and name;
- operand hard registers;
- emitted assembly lines.

Never instrument the production compiler or modify vendored source in place.
Generated instrumented trees and corpus artifacts remain under `build/`.

## Query

A future target query can rank compatible mechanisms:

```text
window lb/lb/sb/sb
  exact corpus matches:
    two-byte aggregate assignment, align 1
  incompatible:
    two scalar assignments (offset-zero CSE form differs)
```

The corpus is a hypothesis index. Exact compilation in the real function
context remains required because surrounding register pressure and scheduling
can change final output.

---

# Pi integration

Register the Phase 1 CLI as a bounded Pi tool, for example:

```text
psx_analyze_backend_packets
```

Parameters:

- exact function name;
- optional basic-block focus;
- optional JSON output.

The wrapper must not accept shell fragments, arbitrary compiler flags, or
source promotion controls.

Update the decompilation skill ordering:

1. triage/frame/SDK/global checks;
2. backend-packet detection;
3. inventory and structural source recovery;
4. only then allocation/scheduler analysis when web parity permits it.

Registration tests must fail if the new CLI is not exposed through the Pi tool
table, following `notes/tools-directory-structure.md`.

---

# Artifacts and schemas

Use versioned typed JSON. Suggested Phase 1 shape:

```ts
interface BackendPacketCandidate {
  schemaVersion: number;
  functionName: string;
  block: number;
  targetIndexes: number[];
  mechanism: "mips-block-move";
  patternNames: string[];
  confidence: "exact-replay" | "compatible" | "suggestive";
  source: MemoryRegion;
  destination: MemoryRegion;
  sizeBytes: number;
  alignments: number[];
  chunks: CopyChunk[];
  scratchCount: number;
  addressScratchCount: number;
  declarationRequirements: DeclarationRequirement[];
  sourceRecipes: SourceRecipeHint[];
  evidence: EvidenceCitation[];
  caveats: string[];
}
```

Every result records:

- target assembly hash;
- configured compiler version and tree hash;
- detector schema version;
- exact instruction range;
- whether backend replay was exact;
- unsupported features and ambiguity.

---

# Delivery order

## Vertical slice A — immediate pain reduction

1. Fix `frameMap.ts` outgoing/local classification.
2. Implement block-copy geometry and MIPS backend replay.
3. Add `analyzeBackendPackets.ts` and Pi registration.
4. Integrate the signal into triage and diff explanation.

This slice should have redirected `func_800140C8` before scalar source search.

## Vertical slice B — correct compiler analysis

5. Build the machine-pattern metadata index.
6. Add one-to-many RTL emission alignment.
7. Keep packet members out of scheduler participant searches.

This slice makes the causal explanation mechanically visible after an
aggregate hypothesis is compiled.

## Vertical slice C — automatic clean-C recovery

8. Detect scalar-copy regions in the semantic graph.
9. Add whole-object operation-family recipes.
10. Add isolated header overlays and declaration forms.
11. Extend residual coverage and terminal reporting.

This slice should solve the motivating function automatically from its scalar
candidate.

## Later generalization

12. Add repeated target-idiom indexing.
13. Build the instrumented compiler mechanism corpus.

---

# Acceptance criteria

The first three phases are complete when all of the following hold:

1. A bare-stub triage of `func_800140C8` reports a compatible two-byte
   `movstrsi_internal` packet and recommends whole-object assignment.
2. Frame mapping reports the 0x10 ABI outgoing area and address-taken local at
   `sp+0x10`, without the false five/six-argument signal.
3. An exact aggregate candidate maps target machine indexes 5..9 to one final
   RTL UID.
4. Scheduler analysis treats that region as one packet.
5. Starting from the scalar candidate, source synthesis generates a complete
   aggregate candidate plus isolated declaration overlay.
6. Full candidate evaluation reaches the byte-identical 29/29 object without
   inline asm, register pins, flags, or source mutation.
7. Exhaustion reports state whether aggregate and header forms were actually
   covered.
8. Positive and negative tests prevent packet compatibility from being stated
   as proof of original source.
9. Every new CLI is registered and bounded for Pi.
10. `npm test`, exact function verification, and `make check` pass.

## Non-goals

- Proving the exact original typedef or field names from machine code.
- Automatically promoting generated declarations into shared headers.
- Searching arbitrary struct layouts unrelated to target geometry.
- Treating every load/store run as a block move.
- Replacing exact compilation with corpus similarity.
- Adding compiler flags or source-policy exceptions.
- General-purpose binary lifting or decompilation.
