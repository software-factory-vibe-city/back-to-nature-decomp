# Static recompilation: this binary, then any binary

Initially captured 2026-08-16. **Working design and proposed build phases;
not an implementation report.** The phase sheets below record the discussed
sequence and proposed completion evidence. No work is marked complete, and
several load-bearing facts in the original brainstorm remain unverified.

Successor in ambition to `notes/decompiling-any-psx-game.md`, which
generalizes the *decompilation* harness. This generalizes the other
direction: running the original code without decompiling it.

Related and deliberately not duplicated here:
`notes/target-host-compilation.md` covers compiling *matched C* for the host
against a PSY-Q compatibility layer. That is a different deliverable — it
needs a finished decomp and produces a source port. This note is about
translating machine code.

## Goal and scope

The goal here is **PlayStation machine code → execution-faithful native host
code**, without requiring decompiled source. The current host, x86-64 Linux,
is the concrete reference target for discussion; the semantic core should
remain independent of that host. Input includes recovered overlay code as
well as the main executable. A playable native artifact additionally needs
assets and runtime services; translating instructions alone does not supply
those. Browser delivery belongs to a separate project and is outside this
note's scope.

## Proposed implementation phases

Build vertical slices of increasing executable capability, not three large
components that first meet at the end. Each phase exercises the same modular
pipeline: existing discovery → semantic recompiler → existing emission with
recompiler-specific lowering/printing. Correctness work starts in Phase 1;
Phase 5 expands it to realistic execution rather than introducing it late.

| Phase | Goal | Sheet |
|---|---|---|
| 1 | Smallest end-to-end native translation and independent comparison | [End-to-end slice](phase-01-end-to-end-slice.md) |
| 2 | Precise instruction semantics and architectural sequencing | [Architectural foundation](phase-02-architectural-foundation.md) |
| 3 | Connected blocks, loops, calls, and guest-address dispatch | [Connected programs](phase-03-connected-programs.md) |
| 4 | Measured target coverage: GTE, overlays, and irregular behavior | [Target coverage](phase-04-target-coverage.md) |
| 5 | Captured-state replay, divergence localization, and scoped proofs | [Realistic validation](phase-05-realistic-validation.md) |
| 6 | A second binary through the same pipeline without its decompiled source | [Generalization](phase-06-generalization.md) |
| 7 | Measured optimization without changing the execution contract | [Optimization](phase-07-optimization.md) |

The first milestone is one original block, through existing discovery and
emission infrastructure, executing natively and checked independently.
The phase sheets are proposals, not permission to assume their predecessors
are complete. Target-specific workstreams can run in parallel once their
shared semantic/runtime contracts exist.

The original **Phase A / Phase B** terminology below describes two ambition
levels—this binary, then arbitrary binaries—not additional implementation
steps. It is retained to keep the earlier research discussion interpretable.
Browser delivery remains a separate project.

## Why both ambition levels exist

Two things are being conflated when people say "static recompilation", and
the split matters:

- **Phase A — recompile this binary.** SLUS-01115 specifically, while its
  matching decompilation exists. The decomp is not the input; it is the
  **test oracle**. This phase produces a working recompiler and, as a side
  effect, a runnable artifact.
- **Phase B — recompile an arbitrary PSX binary.** Zero decompilation
  required. This is the reusable tool and the actual research claim.

Phase A is not a warm-up for Phase B. It is the only opportunity to build
Phase B against ground truth, and that opportunity closes if the recompiler
is built later against a game nobody has decompiled.

## The core idea: the decomp is a unit-test suite for the recompiler

Conventional static-recompiler development is: translate the binary, run it,
observe a crash somewhere in a 225 KB text section, bisect. There is no
notion of a failing unit.

With a matching decompilation in hand there is:

- **Implementation A** — the decompiled C for a function, compiled natively
  for the host.
- **Implementation B** — the same function's original MIPS bytes, put
  through the static recompiler.

Run both from corresponding entry states and compare ABI-visible results,
memory effects, and outgoing calls. The matched C is a valuable semantic
reference, but not automatically a portable host implementation: pointer
widths, data layout, and language assumptions must first be reconciled. It
also has no native equivalent of every original MIPS temporary register.
A disagreement localizes a problem to the function or its adapter; it does
not, by itself, prove the translator is at fault. Full architectural-state
comparison needs an independent machine-execution reference.

We are not aware of another static-recompilation effort that has this. It is
the strongest argument for doing Phase A on this game rather than starting
straight at Phase B.

The harness runs in the other direction too: a function that does *not* yet
byte-match can still be checked for semantic equivalence against the
recompiled original. That is a verification layer the byte oracle structurally
cannot provide, and it applies to the decomp's remaining tail.

**Unresolved:** where realistic differential entry states come from.
Hand-authored and generated states can exercise instructions and blocks;
non-leaf game functions need richer fixtures. Captured states from an
instrumented run are the obvious source but add an emulator dependency.
This gates realistic game-level coverage, not instruction-level validation.

## Favored architecture: reuse the ends, isolate the semantic middle

The discussion favors this modular boundary, not a second discovery pipeline
or a replacement for the matching-decompilation engine:

```text
Existing discovery mechanisms
        │ program image + recovered code map + explicit uncertainties
        ▼
Semantic recompiler
        │ execution-faithful semantic IR
        ▼
Existing emission mechanisms + recompiler-specific lowering/printing
        │ generated C + runtime requirements
        ▼
Host compiler → native executable
```

This records a design direction, not committed interfaces or implementation
phases. The modules should communicate through explicit, versioned data
contracts and be testable independently.

### Discovery contract and existing foundations

Discovery supplies original bytes, container identities, guest load
addresses, entry points, discovered code regions, known control-flow edges,
overlay relationships, and unresolved destinations or assumptions. Symbols
and SDK identities are optional annotations. Original words remain
**authoritative**; inferred function boundaries are not permission to assume
a conventional calling sequence.

An adapter should turn existing repository artifacts into this contract.
The semantic core should not read splat configuration, generated C headers,
or repository directory conventions directly.

| Existing machinery | Reusable contribution |
|---|---|
| `tools/lib/psxExeInfo.ts`, `tools/lib/container.ts` | Images, address mappings, container metadata. |
| `tools/build/analyzeLayout.ts`, bootstrap/disassembly pipeline | Code regions and candidate function boundaries. |
| `tools/lib/archiveIndex.ts`, `tools/lib/memberClassification.ts`, `tools/lib/overlayBase.ts`, `tools/lib/overlayStrategies.ts` | Archive interpretation, code-member classification, overlay base/layout recovery. |
| `tools/lib/symbolIndex.ts`, `tools/agent/callGraph.ts`, `tools/lib/overlayReferences.ts` | Address identities and discovered intra-/cross-container references. |
| `tools/diagnostics/matchSignatures.ts` | SDK identities and candidate replacement boundaries. |
| `tools/agent/machine-ir/` | Decoded-word CFG, SSA and region-analysis foundations. |
| `tools/agent/matching-reconstruction/construct.ts` | Existing `CExpr`/`CStmt` representations and `renderExpr`/`renderStmts` printers. |
| `tools/agent/residual-source-search/tree-sitter-c.ts` | Pinned C parser for syntax inspection and structural tooling. |

These are substantial foundations, not proof of complete arbitrary-binary
coverage. Overlay recovery has bounded hypotheses and can return
`undetermined`; jump-table recovery recognizes particular patterns; reference
scans do not establish every possible computed destination. In particular,
"unreferenced" is not sufficient evidence to remove executable code.
`tools/build/deriveRodataSplits.ts` uses compiled objects for some extents,
so it is not itself a complete cold-binary jump-table solver.

Tree-sitter's WASM component **parses C**; it does not compile C to WASM or
emit executable semantics. The reusable C printers are separate machinery.
The existing reconstruction constructors need not sit on the recompiler's
path: recovering original types, storage layouts, and structured source is
not required to execute original instructions.

### Semantic recompiler contract

This module is an executable specification of the supported guest machine:

```text
instruction + guest state + environment
        → updated guest state + ordered effects + control-flow outcome
```

It owns decoding distinctions and their architectural meaning: fixed-width
arithmetic, signedness, registers, HI/LO, memory-access effects, control
transfers, load/branch delays, and supported exception/coprocessor behavior.
It does not own C syntax, host register allocation, platform-facing APIs,
original C types, or inferred callee prototypes.

The output should express operations precisely. For example, `addiu` means
reading a register, sign-extending a 16-bit immediate, adding modulo 2³²,
and writing the destination. A trapping addition is a distinct operation.
C lowering must preserve that distinction without signed-overflow undefined
behavior, invalid shifts, or host-dependent memory accesses.

**Separate instruction effects from execution sequencing.** Arithmetic and
memory instructions describe operands, computed values, and requested
effects. Sequencing rules decide when delayed results become visible, how
control transfers and their slots execute, and how exceptions intervene.
A pending load is architectural state, including across block boundaries.
Writes to the same register and unaligned-load pairs need explicit rules;
"commit one instruction later" alone is not a complete specification.
For branches, capture the decision/destination before the slot, apply link
register effects at the correct architectural point, execute the slot, then
transfer. The printer must never invent this ordering.

At this level a call is a link-register effect and control transfer, not a
C prototype or an ABI clobber summary. `$gp` and `$sp` remain guest registers;
`jr $ra` transfers to a guest address rather than automatically returning
on the host stack. Guest pointers remain guest-width addresses.

The current analytical IR is a foundation, **not yet the execution
specification**: some instructions are opaque, unaligned accesses remain
opaque in SSA, calls use ABI summaries, and the decoder merges trapping
`add`/`sub` with nontrapping operation names. Execution-faithful lowering
must preserve distinctions from the original words rather than inherit
those abstractions silently. Unsupported behavior must remain explicit.

### Emission contract and runtime boundary

Within the emission module, keep lowering separate from printing:

```text
Semantic IR
    → recompiler-specific C lowering
    → existing C expression/statement AST
    → existing printer, extended where necessary
```

Lowering selects defined C implementations: wrapping arithmetic, guest-state
accesses, memory/helper calls, labels, and dispatch. Printing renders the
chosen syntax. Labels and `goto`s are examples of extensions to the existing
AST/printer, not reasons to create a parallel source-generation framework.
Syntax checks do not prove execution correctness.

Generated code needs a runtime for guest state, memory mapping, and supported
external/coprocessor operations. This is a shared contract, not another
discovery stage: semantics specifies what each operation means; the backend
selects or supplies implementations satisfying that contract. A helper call
must not hide unspecified behavior. Access ordering and exceptions matter;
even a load whose result is discarded can have an observable effect.
SDK/HLE replacements are separately validated implementations of boundaries,
not assumptions the instruction translator needs in order to work.

### Validation direction — not yet acceptance gates

Two claims must remain separate: **supported code is translated correctly**,
and **all executable code has been discovered**. Success at the first does
not establish the second.

- **Instruction conformance:** directed edge cases, generated sequences,
  and hardware-backed tests compared with an independent validated execution
  reference. Cover arithmetic boundaries, aliasing, delayed results,
  unaligned accesses, exceptions, and supported coprocessor behavior.
- **Block differential tests:** run original instructions and compiled
  generated C from corresponding states; compare registers, pending state,
  next address, memory changes, exceptions, and ordered observable effects.
  Final RAM contents alone are insufficient. Preserve original-address to
  generated-source mappings so a divergence can be localized.
- **Shared semantic evaluator:** useful for debugging and checking C
  lowering against the IR. Agreement is not independent ISA validation;
  evaluator and emitter may share the same wrong semantic rule.
- **Translation validation:** explore symbolic equivalence per block over
  all states permitted by its contract. A counterexample is a test case;
  `UNSAT` proves equivalence only within the stated model and assumptions.
  Unsupported cases/timeouts prove nothing. Validating IR alone does not
  validate the C emitter or host compiler. Block composition must preserve
  all boundary state, effects, and transfers.
- **Integration replay:** identical inputs and controlled external events,
  with checkpoints to find wrong overlay selection, missing destinations,
  initial-state errors, and broken runtime boundaries. The matched decomp
  adds semantic fixtures but does not replace architectural validation.

The execution model must explicitly state its timing, interrupt, exception,
and executable-memory assumptions. Unknown destinations or unexpected code
writes must be reported, not silently dispatched to stale translations.
The independent reference, proof tooling, and precise supported envelope
remain choices to make.

## Phase A — translating SLUS-01115

### Translation model

Favor C emission over explicit guest state and guest memory, with clang doing
the host optimization. LLVM IR remains an alternative backend if measurements
justify it; the semantic core should not depend on this choice.

Use basic blocks as the initial correctness unit. A simple implementation
executes a precompiled block and dispatches its next guest address to another
precompiled block; this is still static translation, not instruction decoding
at run time. Proven edges can become direct host branches, and blocks can be
grouped into regions/functions without changing their architectural meaning.
Per-function emission is a useful organization, not a prerequisite that makes
perfect function recovery or normal call/return behavior mandatory.

The favored baseline preserves load and branch delay semantics explicitly.
An interlocked-load assumption is not the default for arbitrary code.
Optimizations may remove bookkeeping only with a justified equivalence.
Register-state scalar replacement by clang is a performance opportunity to
measure, not a guaranteed consequence of emitting a register struct.

Overlay dispatch must account for the code currently resident at a guest
address, not just the numeric address. Keep original bytes/address identities
and generated-source mappings available for diagnostics and validation.

### The boundary decision: HLE at the SDK, not at the hardware

This is the most consequential design choice in the note.

The naive recompiler emulates hardware — GPU command FIFO, DMA channels,
SPU, CD controller, root counters, interrupt controller. That is writing an
emulator with a recompiler front end.

The alternative: `tools/diagnostics/matchSignatures.ts` already identifies
PSY-Q library functions **by signature, by address, in an arbitrary binary**
(394 matched in this one, per `configs/project-profile.md`). So the
recompiler need not translate `DrawSync` at all — it recognizes the address
and emits a call to a native `DrawSync` backed by PsyCross or PSn00bSDK.

We never implement a GPU. We implement libgpu — roughly a hundred functions
with published semantics, against a device with none.

The same mechanism absorbs:

- **BIOS calls** (A0/B0/C0 table jumps) → OpenBIOS-derived or directly HLE'd.
- **Interrupts and callbacks.** `VSyncCallback` under HLE is "the host frame
  loop calls the registered function." No interrupt emulation at all.

PSY-Q's ubiquity across commercial PSX titles is what makes this a
generalization mechanism rather than a Harvest Moon shortcut. The signature
database is the moat, and it already exists.

**Unresolved:** the HLE boundary is not free. Game code that reaches around
the SDK — touching hardware registers at `0x1F801xxx` directly, or hand-rolling
DMA — falls through to a hardware path that then has to exist anyway. Nobody
has measured how much of that this binary does. That measurement is cheap and
should happen before anything else in Phase A.

### GTE — measured, not estimated

Measured 2026-08-16 by disassembling the full text section
(`0x80011270`–`0x80048190`) and histogramming COP2 instructions. These
numbers are new to the repo; nothing else here depends on them being
re-derived.

**486 COP2 instructions total: 58 compute operations, 428 register moves.**

Compute operations — **9 distinct, out of the platform's ~22**:

| Op | Count | Role |
|---|---|---|
| MVMVA | 13 | Matrix x vector + translation |
| RTPT | 10 | Perspective-transform 3 vertices |
| NCLIP | 10 | Backface cull (2D cross product) |
| RTPS | 8 | Perspective-transform 1 vertex |
| AVSZ4 | 6 | Average Z of 4 verts, OT index |
| AVSZ3 | 4 | Average Z of 3 verts, OT index |
| OP | 4 | Cross product |
| SQR | 2 | Square a vector |
| GPF | 1 | Interpolate |

**Every lighting and color operation is absent** — no NCDS, NCDT, NCCS,
NCCT, CDP, CC, NCS, NCT, DPCS, DPCT, INTPL, DCPL, GPL. That is the fiddliest
third of the GTE (IR saturation feeding the RGB FIFO, colour clamping, the
depth-cue path) and this game never enters it. The workload is
transform-cull-sort, consistent with a sprite-heavy title carrying light 3D.

Register moves: `ctc2` 114, `lwc2` 88, `swc2` 74, `mfc2` 53, `mtc2` 51,
`cfc2` 48.

**Where the GTE lives.** 31 functions contain COP2 instructions (mapped by
nearest preceding executable symbol; the current symbol table is
`configs/symbols/exe.txt`). They split:

- **18 are named PSY-Q libgte functions** — `MatrixNormal`, `ApplyMatrixLV`,
  `RotTrans`, `PushMatrix`, `PopMatrix`, `InitGeom`, `SetRotMatrix`,
  `SetTransMatrix`, `SetColorMatrix`, `SetGeomOffset`, `SetGeomScreen`,
  `SetFarColor`, `SetBackColor`, `SetDQA`, `SetDQB`, `SquareRoot0`,
  `InvSquareRoot`, `Lzc`. Under SDK-boundary HLE **none of these are
  translated.** They vanish into the compatibility layer.
- **13 are game code**, and `notes/file-groupings.md:173` already describes
  the cluster as GTE-projected triangle/quad rendering:

  ```
  func_8001C37C  140   <- the main transform loop, by far the largest
  func_8001B6A0   44
  func_8001BBD8   43
  func_8001D348   26
  func_8001DCB0   20
  func_8001DE4C   20
  func_80037470   17   <- the only one outside the 0x8001B-0x8001E cluster
  func_8001B5DC   13
  func_8001D6B8   13
  func_8001BB88    8
  func_8001E26C    7
  func_8001DFD4    6
  func_8001E088    5
  ```

All 13 are still `INCLUDE_ASM` stubs. **The GTE surface and the
un-decompiled remainder are the same functions.** Decompiling them yields
exactly the semantic knowledge needed to validate a software GTE, so the two
efforts should be sequenced together rather than independently.

`func_80037470` sits outside the cluster and has no `src/` file; whether it
is game code or an unidentified library routine is **unverified**.

**What the GTE work actually is**, in rising order of risk:

1. *The 9 compute ops.* Ports from DuckStation or PCSX-Redux, fixed-point,
   documented in psx-spx. The part everyone assumes is hard and is not.
2. *The register file and its move semantics.* 428 of 486 COP2 instructions
   are moves, and the 64-register file is not flat: writes to IR0-IR3
   saturate, writing SXYP pushes a FIFO (reading cop2r15 returns SXY2),
   writing LZCS auto-computes LZCR, IRGB/ORGB convert on access. Errors here
   produce subtly wrong geometry with no crash to bisect from. **This is
   where the defects will be, by volume.**
3. *The FLAG register (cop2r63).* 19 error bits, bit 31 being the OR of bits
   30-23 and 18-13. `cfc2` appears 48 times, so the game reads it —
   plausibly for the RTPS overflow result that libgte's `RotTransPers`
   returns. It has to be exact.

Timing is a non-issue: GTE operations take 8-44 cycles with no interlock, but
ASPSX scheduled around that, so synchronous execution is correct.

Two concrete notions worth carrying forward:

- **Run Amidog's `psxtest_gte`** against whatever core is ported, before
  trusting a single rendered frame. It is the hardware-validated conformance
  suite for exactly this.
- **Make GTE an early targeted differential workload.** The measured
  instruction surface is bounded, but its possible states are not thereby
  exhaustively tested. In the numbered build sequence, Phase 1 establishes
  the harness on tiny blocks; Phase 4 extends it to GTE conformance and real
  game blocks, using the census to establish coverage across containers.

### The rest of the hard list

- **Indirect control flow.** Guest destinations need mappings to translated
  blocks, including overlay identity. `configs/symbols/exe.txt` and
  `tools/agent/callGraph.ts` supply existing address/reference knowledge;
  they do not prove all indirect destinations are known. Jump tables need
  recovery beyond what the build-oriented rodata attribution provides.
  **A cold-start recompiler must recover information Phase A can inherit.**
  That asymmetry is worth remembering when Phase B turns out harder than
  Phase A felt.
- **`lwl`/`lwr`/`swl`/`swr`.** Unaligned access; PSY-Q's memcpy uses them.
  Fiddly, bounded, well-specified.
- **Memory model.** KSEG0/KUSEG/KSEG1 mirrors reduce to masking the top bits
  and indexing a 2 MB array. The 1 KB scratchpad at `0x1F800000` needs its own
  path — games use it as fast storage for ordering tables and primitive
  building, and this one probably does. Unmeasured.

## Phase B — the generalized recompiler

The question is what a recompiler needs *per game*, and how much of it can be
derived rather than authored.

| Need | Status |
|---|---|
| Entry point, GP, section layout | Solved — `tools/lib/psxExeInfo.ts`, `tools/diagnostics/headerInfo.ts` |
| Function boundaries | Largely solved — disassembler plus splat |
| SDK function identification | Solved — `tools/diagnostics/matchSignatures.ts`. The moat |
| Jump table recovery | Mechanical, needs care |
| **Overlay layout** | **The real research problem** |

Four of five are tooling this repo already owns. The fifth is the whole
question — and as of 2026-08-16, **Phase A can teach it after all.**
SLUS-01115 was assumed to be a single executable with no overlays. It is not:
`extracted/iso/a_file.bin` holds 13 code members, ~868 KB, calling 246 distinct
PS-X EXE entry points across at least two load slots. Full measurements and the
tooling response are in `plans/overlay-decompilation-enablement.md`.

This is the single best thing that has happened to Phase B. The one problem
that would gate a generalized PSX recompiler, and that this game supposedly
could not exercise, is present in the game we know best — with a matching
decompilation, a proven toolchain, and a working oracle already pointed at the
executable those overlays call into.

### Overlays

Most commercial PSX titles stream overlay executables off disc into fixed
addresses throughout play. Static recompilation assumes a static text
section; overlays break that assumption at the root.

The plausible answer is to recompile per overlay and dispatch on which one is
resident. The interesting wrinkle: **the overlay loader is itself SDK code** —
a `CdRead` and a copy to a fixed address — and is therefore
signature-identifiable by the same mechanism that solves the HLE boundary. If
that holds, overlay discovery is an extension of existing tooling rather than
a new research programme.

That hypothesis is now testable here, not on a hypothetical second game.
`plans/overlay-decompilation-enablement.md` Deliverable 8 locates this game's
loader call sites; Deliverable 2 solves the load addresses and is explicitly
shared between the two plans. Build the base solver once, in the decompilation
plan, and Phase B inherits it.

A second game is still the generalization test — but it now validates a
mechanism rather than discovering one.

### Non-PSY-Q titles

Games built with other toolchains defeat signature matching and fall back to
hardware LLE, losing the entire advantage. The fraction of the commercial
library this represents is unmeasured, and it bounds any claim of generality.
Worth measuring early and cheaply — it is a strings-and-signatures survey over
a corpus, not a per-game effort.

## Cross-cutting

**Legal posture.** Ship the recompiler, never its output; the user supplies
their own disc. This is N64Recomp's posture. It has to shape the repository
from the first commit — retrofitting it is miserable.

**What would be novel.** Stated as claims to be checked, not facts:

- We know of no mature open PSX static recompiler. Every emulator has a
  dynarec; AOT static recompilation — the N64Recomp equivalent — appears
  absent for this platform.
- **Signature-driven HLE boundary selection** as a systematic technique.
  Emulators HLE the BIOS. Selecting the translate/replace boundary by
  signature-matching the *vendor SDK* in an arbitrary binary is, as far as we
  know, unpublished.
- **Differential validation against a matching decompilation.** Nobody has
  this because nobody has held both halves at once.

**Relationship to the decomp.** Phase A does not compete with finishing
SLUS-01115 — the 13 GTE game functions are wanted by both efforts, and the
differential harness gives the decomp's remaining tail a semantic oracle it
currently lacks. Phase B does compete, for attention, and that trade should
be made deliberately rather than drifted into.

## Explicitly not decided

- Whether Phase A delivers a native playable artifact or only a validated
  recompiler. These imply different amounts of audio, CD streaming, and
  input work.
- Where realistic differential entry states come from, and which independent
  execution reference and proof tooling to use.
- The exact supported timing/interrupt/exception model and runtime contracts.
  Explicit load-delay semantics are favored over an optimistic interlocked
  baseline; the implementation and justified optimizations remain to design.
- ~~Whether `a_file.bin` contains any code.~~ **Answered 2026-08-16: it does.**
  `a_file.hdt` is a 33-entry sector-aligned offset table over 32 members, 13 of
  which hold MIPS code. The no-overlays assumption was false. See
  `plans/overlay-decompilation-enablement.md`.
- How much of this binary bypasses the SDK to touch hardware registers
  directly.
- Whether Phase B is a separate repository. The legal posture and the
  game-agnostic goal both argue yes; the shared tooling argues no.
