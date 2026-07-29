# Plan: test an inline-assembly primitive-header macro for `func_80019070`

## Status

Executed — rejected as Outcome C. The bounded variants confirmed that one
multiline template becomes an opaque RTL node, but it retained the masks-first
order, delayed the header stores, and broke the solved allocation. No variant
improved the target prefix or reached Gate 2, so `src/func_80019070.c`, function
classification, and the clean-source policy remain unchanged. Results are
preserved under `build/func_80019070/inline-asm-header/`.

## Purpose

Test the hypothesis that the original source used a game-local GPU packet
macro whose extended-assembly template emitted the sprite header's two byte
stores as one opaque compiler operation:

```asm
sb <length>,3(<packet>)
sb <code>,7(<packet>)
```

Unlike the standard PsyQ `setSprt` macro, this hypothetical macro would make
`4`, `0x64`, and the packet pointer register operands of an opaque asm node.
GCC could schedule their materialization among the independent argument masks,
pointer copies, casts, and stack loads, while the asm node itself would act as
the memory boundary currently approximated by a separate empty barrier.

The experiment must answer a binary question before any policy discussion:

> Can a natural, register-agnostic primitive-header asm macro reproduce the
> target's constants-first prologue while retaining exactly the target's 81
> instructions, hard-register allocation, relocations, and instructions
> 10–80?

## Current evidence and baseline

The baseline is the current `src/func_80019070.c`:

- 81 emitted instructions;
- 72/81 exact instruction positions;
- instruction 0 and instructions 10–80 match byte-for-byte;
- the same operations, operands, and hard-register assignments exist at
  instructions 1–9, but GCC schedules them in a different legal order;
- real Sony `CC1PSX.EXE` and the reconstructed GCC 2.95.2 compiler agree;
- real ASPSX 2.77 and 2.86 preserve the candidate order and produce identical
  324-byte text from the same compiler assembly;
- ordinary `setSprt`, source ordering, type spelling, barriers, and bounded
  clean-C web shapes have not produced the target order.

Target entry order:

```text
move t0,a1
li v0,4
li v1,100
move t3,a0
andi a2,a2,0xffff
sll a3,a3,16
sra t5,a3,16
andi t6,a2,0xf
andi a2,a2,0xf0
lw a1,32(sp)
```

Current compiler order:

```text
move t0,a1
andi a2,a2,0xffff
andi t6,a2,0xf
andi a2,a2,0xf0
li v0,4
li v1,100
move t3,a0
sll a3,a3,16
lw a1,32(sp)
sra t5,a3,16
```

The hypothesis is materially different from another C statement permutation.
The current scheduler model sees two ordinary RTL stores plus a separate
zero-width memory barrier. A multiline extended-asm template would instead be
one opaque RTL node that emits two machine instructions. Its operands,
dependencies, hazard classification, and machine-to-RTL alignment would all be
different.

## Primary test macro

Use this only in complete diagnostic variants under `build/` initially:

```c
/*
 * Emit the two byte stores that initialize a GPU primitive header.
 * Arguments are evaluated once and no hard register is named.
 */
#define STORE_PRIM_HEADER_ASM(packet_, length_, code_)              \
    do {                                                            \
        void *_packet;                                              \
        u32 _length;                                                \
        u32 _code;                                                  \
                                                                    \
        _packet = (void *)(packet_);                                \
        _length = (u32)(length_);                                   \
        _code = (u32)(code_);                                       \
                                                                    \
        __asm__ volatile(                                           \
            "sb %1,3(%0)\n\t"                                      \
            "sb %2,7(%0)"                                         \
            :                                                       \
            : "r" (_packet), "r" (_length), "r" (_code)          \
            : "memory");                                           \
    } while (0)

#define SET_SPRT_HEADER_ASM(packet_) \
    STORE_PRIM_HEADER_ASM((packet_), 4, 0x64)
```

Properties that must remain invariant:

- the template contains only the two semantic `sb` operations;
- no hard register, `.word`, local label, branch, delay-slot instruction, or
  manual address is embedded;
- the packet expression is evaluated once;
- `length` and `code` are ordinary register inputs, allowing the compiler to
  choose `$v0` and `$v1` naturally;
- the `memory` clobber is the only broad compiler boundary;
- the macro is C89-compatible.

The primary call-site shape is:

```c
glyph = (u16)glyph;
texture_u = glyph & 0xF;
glyph &= 0xF0;
palette_index = palette;
sprite_x = (s16)x;

SET_SPRT_HEADER_ASM(&packet->sprite);

glyph >>= 4;
```

For this shape, remove only the ordinary `setSprt` call and the first separate
empty memory barrier. The remainder of the function must be byte-for-byte
identical at the source level to the baseline variant, apart from references
required by the call-site placement.

## Mechanism predictions

If this hypothesis is correct or close, the compiler artifacts should show:

1. `4`, `0x64`, and the packet address materialized as asm inputs.
2. One opaque asm RTL node at sched1 rather than two ordinary byte-store RTL
   nodes followed by a separate zero-width barrier.
3. Exactly two assembly lines emitted by that one node, with no inserted move,
   spill, reload, `nop`, or widened store.
4. The two `sb` instructions contiguous at target machine indices 10 and 11.
5. The palette stack load constrained to the correct side of the asm memory
   boundary.
6. A changed block-0 ready/dependency graph capable of selecting the target
   constants-first order.
7. The target hard-register state preserved at the first instruction after the
   macro, allowing instructions 12–80 to remain exact.

Because one RTL node emits two machine instructions, existing target-schedule
UID alignment must not be assumed valid automatically. Inspect raw compiler
assembly, the `.sched` node, and final object instructions together and label
the multi-emission mapping explicitly.

## Phase 0: preserve and record the baseline

Before creating variants:

1. Record the current source hash and repository status.
2. Run the exact function comparator once and preserve its 72/81 report.
3. Preserve the current compiler assembly and relevant `.rtl`, `.flow`,
   `.sched`, `.lreg`, `.greg`, `.sched2`, and `.dbr` dumps under the experiment
   directory.
4. Confirm again that the baseline has 81 instructions and instructions 10–80
   are exact.

Use:

```text
build/func_80019070/inline-asm-header/
```

No diagnostic variant may overwrite `src/func_80019070.c`.

## Phase 1: compiler and assembler viability micro-test

Before testing the full function, compile a tiny C89 fixture containing
`STORE_PRIM_HEADER_ASM` and one call.

Verify:

- Sony/reconstructed GCC 2.95.2 accepts the operand and clobber syntax;
- cc1 emits two literal `sb` lines in the requested order;
- the configured assembler accepts the template;
- no hidden instruction, move, `nop`, or stack frame is introduced around the
  macro itself;
- both stores use compiler-selected registers;
- real ASPSX 2.77 accepts the exact cc1 text.

A syntax failure should be fixed only by equivalent GCC 2.95-compatible
constraint spelling. Do not introduce fixed registers or encoded words to make
the fixture compile.

## Phase 2: bounded full-function variant matrix

Create complete C variants and an explicit `psx_fuzz_variants` manifest. Every
variant must name the same mechanism and a concrete predicted compiler effect;
do not use random permutation or hill climbing.

### Axis A: opaque grouping

1. **One multiline asm node:** both `sb` instructions in one template.
2. **Two asm nodes:** one `sb` per volatile asm statement.

This distinguishes an opaque two-instruction scheduling node from merely
making each store an asm operation.

### Axis B: memory boundary

1. A `"memory"` clobber, as in the primary hypothesis.
2. No memory clobber, while retaining `volatile`.

The no-clobber variant isolates the effect of opaque grouping from the effect
of a compiler memory boundary. If a precise memory output accepted by this GCC
can describe the two bytes without changing code, it may be tested as one
additional explicitly labelled variant; it is not required for the first
batch.

### Axis C: call-site placement

Test only these semantically equivalent placements:

1. after `sprite_x = (s16)x`, replacing both `setSprt` and the first empty
   barrier;
2. at the current `setSprt` source position, before the `sprite_x` assignment,
   with the separate barrier removed;
3. at the current `setSprt` position while retaining the existing post-`x`
   empty barrier.

### Axis D: operand birth form

1. block-local `_length` and `_code` variables as shown above;
2. direct register-constrained `4` and `0x64` operands, if accepted without
   changing semantics.

Do not compile the full Cartesian product. Bound the first batch to at most 12
complete variants:

1. multiline asm, local operands, and a memory clobber at each of the three
   call sites;
2. the same three forms without the memory clobber;
3. split asm nodes with local operands and a memory clobber at each call site;
4. direct operands at the three call sites only if the corresponding local form
   changed the prologue.

Compiler-identical variants should be reported as duplicates, not replaced by
further permutations. Test split/no-clobber interactions only in the bounded
Outcome-B follow-up when one of those axes has demonstrated the predicted
scheduler effect.

Use mechanism metadata equivalent to:

```text
mechanism: custom
expectedPass: rtl/sched
expectedEffect: replace two ordinary header stores and a synthetic boundary
                with an opaque asm node whose register operands reorder the
                block-0 ready queue while emitting the same two stores
invariants:
  - packet bytes 3 and 7 receive 4 and 0x64
  - no hard registers or raw words
  - no additional machine instruction
  - all non-header source semantics unchanged
  - target suffix and 81-instruction count preserved
```

Run full configured compilation, not cc1-only triage, for every candidate that
changes the prologue.

## Phase 3: evaluate each variant by gates

Rank mechanism evidence before match percentage.

### Gate 1: semantic emission

The variant must emit exactly:

```asm
sb <reg>,3(<packet-reg>)
sb <reg>,7(<packet-reg>)
```

Reject variants that emit extra moves, spills, reloads, widened stores, fixed
registers, reordered offsets, or additional packet writes.

### Gate 2: instruction and allocation preservation

Require:

- exactly 81 final instructions;
- the target opcode/operand/register multiset;
- stores at target indices 10 and 11;
- no relocation or delay-slot regression;
- target hard-register assignments at the asm/C boundary.

A higher positional score with a changed instruction count or broken suffix is
not progress.

### Gate 3: scheduler-mechanism confirmation

Compare the first meaningful pass divergence from baseline through `.dbr`.
Confirm that any improvement originates from the predicted opaque asm
node/dependency graph, not from an unrelated allocator accident.

Record:

- asm input pseudos and their SET/use/death UIDs;
- asm node LUID, dependency edges, priority, and selected cycle;
- whether the multiline template is treated as one scheduler node;
- palette-load readiness and memory-unit blocking;
- hard-register assignments before and after allocation;
- machine instruction indices corresponding to the asm node's two output
  lines.

### Gate 4: exact function comparison

The sole promotion threshold is an exact 81/81 match. In particular,
instructions 10–80 must remain byte-identical; no partial-prefix improvement
may be promoted over the current 72/81 source.

## Phase 4: bounded response to outcomes

### Outcome A: exact match

If a natural variant is 81/81:

1. rerun it through the full configured pipeline;
2. assemble the exact cc1 output with real ASPSX 2.77 and compare its 324-byte
   text and relocations with the target;
3. inspect preprocessing to ensure the macro expands exactly once and evaluates
   arguments once;
4. preserve a compiler trace documenting why the opaque node changes the
   prologue schedule;
5. proceed to the policy/classification gate below.

Do not continue searching for a cosmetically different asm spelling after an
exact, semantic, register-agnostic form is found.

### Outcome B: target prefix improves but allocation or suffix changes

Run one second bounded batch varying only the demonstrated causal axis:

- multiline versus split asm node;
- memory clobber versus no/precise memory output;
- the three listed call-site placements;
- local versus direct operands.

Do not add fake unused register operands, hard-register variables, arbitrary
clobbers, or unrelated C permutations. If the bounded second batch cannot
restore the exact suffix, reject this packet-header macro shape.

### Outcome C: no relevant scheduler change

If the macro emits the correct stores but retains the masks-first order, reject
the simple opaque-header hypothesis. Do not change policy and do not promote
the macro merely because it is historically plausible.

### Outcome D: only fixed registers or raw machine words can match

Reject the partial macro approach. That result belongs to an explicit
whole-function assembly/classification decision, not to this exception class.

### Outcome E: configured assembler matches but real ASPSX 2.77 differs

Treat the result as historically invalid and investigate the exact assembler
boundary before promotion. Do not use a maspsx-only inline-asm interpretation
as evidence of original source provenance.

## Phase 5: policy and source promotion gate

Only an exact Outcome A justifies proposing a policy adjustment. The exception
should be narrow and auditable rather than a general permission for inline
assembly.

Proposed exception class:

> A semantic hardware-operation macro may use register-agnostic inline
> assembly when it emits only the target operation, reproduces a documented
> original-toolchain scheduling boundary that ordinary SDK C macros cannot,
> and is explicitly classified for named functions.

Required restrictions:

1. Name the approved function and macro in the authoritative classification or
   clean-source policy source; do not hand-edit generated policy artifacts.
2. No hard-register pinning, `.word`, copied target byte arrays, local labels,
   hidden branches, flag overrides, or unrelated clobbers.
3. Every assembly instruction must correspond directly to the macro's named
   packet-header semantics.
4. Keep the macro local to `func_80019070.c` unless independent evidence shows
   that multiple functions share the same original abstraction.
5. Add a concise source comment explaining the GCC 2.95 opaque-node reason and
   reference the research note; do not claim recovered provenance as fact.
6. Update the clean-source gate to admit only the explicit classified
   exception, not arbitrary functional asm.
7. Preserve the current semantic reconstruction and experiment evidence in the
   existing research note.

After promotion:

1. run `psx_diff_function`;
2. export the matched function context if required;
3. run the function finalizer, including its modification-scope and policy
   checks;
4. run the full `make check` gate only after the function is exact;
5. report the macro as a documented compiler-boundary reconstruction, not as a
   proven copy of the original source.

## Optional provenance corroboration

An exact result would justify a read-only follow-up across nearby and related
GPU packet builders:

- look for the same contiguous `sb` offset-3 / `sb` offset-7 signature;
- check whether their surrounding schedules are better explained by one opaque
  two-instruction node than by standard PsyQ macros;
- identify module clustering that could indicate a shared game-local header.

Do not modify those functions during this test. Corroboration strengthens the
historical macro hypothesis but is not a substitute for exact verification of
`func_80019070`.

## Artifacts

Preserve diagnostic artifacts under:

```text
build/func_80019070/inline-asm-header/
├── baseline/
├── micro-test/
├── manifest.json
├── variants/
│   └── <variant-id>/
│       ├── source.c
│       ├── preprocessed.i
│       ├── compiler.s
│       ├── object.o
│       ├── comparison.json
│       └── passes/
├── aspsx-2.77/
└── summary.md
```

Do not commit proprietary tools, generated objects, extracted target bytes, or
large compiler dumps.

## Acceptance criteria

The hypothesis is accepted only when all of the following hold:

- `func_80019070` is exactly 81/81;
- final instruction count remains 81;
- hard-register assignments, relocations, and delay slots match;
- instructions outside the two semantic header stores are still generated by
  C and match the target;
- the asm template contains exactly two register-agnostic `sb` instructions;
- real ASPSX 2.77 confirms the same target text;
- the first compiler divergence validates the opaque-node mechanism;
- the scoped policy exception and clean-source gate explicitly recognize this
  one classified use;
- full project verification passes.

If no bounded natural variant satisfies these criteria, leave
`src/func_80019070.c` unchanged at its current clean-C state, record the
negative result, and reject this specific macro hypothesis without reviving
unbounded statement-order search.
