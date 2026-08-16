# Static recompilation: this binary, then any binary

Captured 2026-08-16. **This is a brainstorm, not a plan.** No phases are
committed, no acceptance gates are defined, and several load-bearing facts
below are marked unverified. It records the shape of a direction and the
questions that would have to be answered before any of it becomes work.

Successor in ambition to `notes/decompiling-any-psx-game.md`, which
generalizes the *decompilation* harness. This generalizes the other
direction: running the original code without decompiling it.

Related and deliberately not duplicated here:
`notes/target-host-compilation.md` covers compiling *matched C* for the host
against a PSY-Q compatibility layer. That is a different deliverable — it
needs a finished decomp and produces a source port. This note is about
translating machine code.

## Why both phases exist

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

Run both from an identical entry state; diff the register file, the memory
write set, and the outgoing call sequence. Any disagreement is a
**recompiler defect localized to one function**, with known-correct source
sitting next to it to read.

We are not aware of another static-recompilation effort that has this. It is
the strongest argument for doing Phase A on this game rather than starting
straight at Phase B.

The harness runs in the other direction too: a function that does *not* yet
byte-match can still be checked for semantic equivalence against the
recompiled original. That is a verification layer the byte oracle structurally
cannot provide, and it applies to the decomp's remaining tail.

**Unresolved:** where entry states come from. Hand-authored states will not
exercise realistic input for anything non-leaf. Captured states from an
instrumented run are the obvious source but add an emulator dependency.
Undecided, and it gates the whole idea.

## Phase A — translating SLUS-01115

### Translation model

Per-function C emission, following N64Recomp's model. Each MIPS function
becomes a C function over an explicit register-file struct and a flat memory
array; branches become `goto`; the host compiler's mem2reg/SROA passes turn
the register file back into machine registers. Ugly, debuggable, portable,
and the optimization burden falls on clang rather than on us.

LLVM IR emission is the fallback if the C route proves too slow to build or
too slow to run. No reason to start there.

Branch delay slots: emit the slot instruction before the branch, using a
temporary when the slot writes a register the branch reads. Standard, solved.

Load delay slots are less standard. R3000 has no load interlock. Most
compiled code carries the assembler-inserted nop, but hand-written assembly
need not, and ASPSX's scheduling behavior is precisely the domain this
project already understands better than most (`notes/maspsx-issue*.md`). A
conservative model shadows the loaded register for one instruction; an
optimistic model assumes interlock and relies on the differential harness to
catch violations. Undecided.

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
nearest preceding symbol in `configs/symbol_addrs.txt`). They split:

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
- **Make GTE the first differential test.** 58 compute instructions across 13
  functions is small enough to exercise exhaustively, and it is simultaneously
  the highest-risk component and the one with the tightest available
  validation loop. Proving the differential harness here, on a bounded
  surface, is cheaper than proving it across 250 functions.

### The rest of the hard list

- **Indirect control flow.** `jr $ra` is trivial. Function pointers need an
  address-to-function table — `configs/symbol_addrs.txt` and
  `tools/agent/callGraph.ts` already supply it. Intra-function jump tables
  need rodata table recovery, and `tools/build/deriveRodataSplits.ts` already
  knows where the rodata blocks are. **A cold-start recompiler has to recover
  all of this; Phase A gets it handed over.** That asymmetry is worth
  remembering when Phase B turns out harder than Phase A felt.
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

- Whether the deliverable of Phase A is a playable artifact or only a
  validated recompiler. These imply very different amounts of work in
  audio, CD streaming, and input.
- Where differential entry states come from, and whether that forces an
  emulator dependency.
- Conservative versus optimistic load-delay modelling.
- ~~Whether `a_file.bin` contains any code.~~ **Answered 2026-08-16: it does.**
  `a_file.hdt` is a 33-entry sector-aligned offset table over 32 members, 13 of
  which hold MIPS code. The no-overlays assumption was false. See
  `plans/overlay-decompilation-enablement.md`.
- How much of this binary bypasses the SDK to touch hardware registers
  directly.
- Whether Phase B is a separate repository. The legal posture and the
  game-agnostic goal both argue yes; the shared tooling argues no.
