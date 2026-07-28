# Plan: allocator-duel diagnostics and loop-metadata discovery probes

**Status: proposed.** This is a follow-up to the implemented
`compiler-web-scheduler-diagnostics.md` and `mechanism-aware-variant-lab.md`
plans. It captures the missing observability and controlled experiment support
revealed by the clean-C match for `func_800158E4`.

## Purpose

Make pure hard-register allocation fights discoverable without manually joining
`explainDiff`, `.flow`, `.greg`, loop notes, and many complete source variants.
The tooling should explain which conflicting pseudo won a register, preserve
metadata-only compiler divergences, test a bounded family of semantics-safe
loop-scope hypotheses, and minimize a broad successful probe to the narrowest
source region that preserves the intended compiler effect.

This must remain mechanism-directed compiler observability. It must not become
a random source permuter, match-percentage hill climber, hard-register assigner,
or route around the clean-source policy.

## Motivating case

At its final clean frontier, `func_800158E4` had:

- 77 target instructions and 77 candidate instructions;
- all 77 opcodes in the same order;
- 71/77 exact instructions;
- a consistent `$t0` ↔ `$t1` renaming explaining every mismatch.

The competing semantic roles were:

| Role | Target | Candidate |
|---|---:|---:|
| carried table pointer | `$t0` | `$t1` |
| masked state flags | `$t1` | `$t0` |

The baseline trace showed the masked-flags allocno ahead of the table-pointer
allocno. Most pointer aliases and identity expressions disappeared in CSE or
combine. A live pointer increment reversed allocation but emitted an extra
pointer update. A zero-instruction asm dependency proved the diagnosis but was
forbidden.

A broad clean-C probe then wrapped the whole table comparison in
`do { ... } while (0)`. It reversed the global allocation, but changed local
`$v0`/`$v1` roles, inserted a load-delay `nop`, and produced 78 instructions.
Narrowing the loop to only the signed table load retained the global allocation
change while restoring local allocation and scheduling:

```c
do {
    temp_table_limit = temp_t0->field_0;
} while (0);
```

The result matched 77/77. The loop emitted no control instruction, but
`NOTE_INSN_LOOP_BEG` and `NOTE_INSN_LOOP_END` survived through global
allocation around the load.

The current tools preserve enough raw evidence to reconstruct this manually,
but they do not present the causal chain directly:

1. pass snapshots omit non-instruction RTL notes;
2. cross-variant assignment comparison uses raw pseudo numbers, which shift
   when a local is introduced;
3. compiler-trace output does not explain an allocation contest as a pairwise
   register duel;
4. variant expectations are free text rather than machine-checkable effects;
5. the transformation catalog has no loop-depth-weighting family;
6. there is no mechanism-preserving scope minimizer.

## Design principles

1. **Mechanism verdict before percentage.** A low-scoring variant that proves a
   target allocation can be more useful than a high-scoring no-effect variant.
2. **Semantic roles before pseudo IDs.** Pseudo numbers are candidate-local and
   cannot be compared naively after declarations or expression trees change.
3. **Metadata is compiler input.** Loop and basic-block notes must be retained
   even when they emit no machine instruction.
4. **Finite probes only.** Generate a bounded set of explicitly justified,
   semantics-safe transformations.
5. **Exact diff remains the oracle.** An allocation assertion or mechanism
   match is evidence, not promotion.
6. **Confidence labels remain mandatory.** Dumped assignments and notes are
   exact; reconstructed priority, role alignment, and counterfactual effects
   must be labeled accordingly.

## Deliverable 1: note-aware RTL pass snapshots

Extend the compiler-trace RTL parser and variant-lab pass snapshots to retain
relevant notes in addition to executable instructions.

### Notes to parse

At minimum:

- `NOTE_INSN_LOOP_BEG`;
- `NOTE_INSN_LOOP_END`;
- `NOTE_INSN_LOOP_CONT`;
- `NOTE_INSN_BASIC_BLOCK`;
- deleted instruction notes when they explain why an early effect disappears;
- source-line notes only when needed to anchor a transformation, not for pass
  equivalence by default.

### Structured output

Add types similar to:

```ts
interface RtlNote {
  uid: number;
  stage: string;
  order: number;
  kind:
    | "loop-begin"
    | "loop-end"
    | "loop-continue"
    | "basic-block"
    | "deleted"
    | "other";
  block?: number;
}

interface InstructionMetadata {
  uid: number;
  loopDepth: number;
  enclosingLoopNotes: number[];
  block?: number;
}
```

Normalize loop regions by their enclosed semantic instruction signatures, not
only note UIDs. This allows meaningful comparison when a new temporary shifts
all later pseudo and note numbers.

### Required report behavior

For the narrow-loop fixture, pass comparison should say:

```text
Metadata divergence:
  signed table-limit load entered loop depth 1
  no executable loop-control instruction was added

Allocation consequence:
  table-pointer role moved ahead of masked-flags role
```

It should not fall back to a generic message such as “instruction 1 changed
from UID 11 to UID 11.”

## Deliverable 2: semantic pseudo-role alignment

Create a cross-variant role matcher so allocation changes survive pseudo
renumbering.

### Role signature

Build a normalized signature from available evidence:

- defining RTL expression and mode;
- user-variable and pointer attributes;
- memory base/offset/width at consumers;
- target/candidate machine instruction indexes reached by the web;
- SET/use/death shape;
- basic blocks and lifetime pattern;
- assigned hard register;
- source-expression provenance when recoverable.

Suggested type:

```ts
interface PseudoRoleSignature {
  pseudo: number;
  expression?: string;
  mode: string;
  pointer: boolean;
  userVariable: boolean;
  memoryOffsets: number[];
  machineIndexes: number[];
  setCount: number;
  useCount: number;
  blockShape: number[];
}

interface RoleAlignment {
  roleId: string;
  baselinePseudo?: number;
  variantPseudo?: number;
  confidence: "exact" | "reconstructed" | "inferred";
  evidence: string[];
}
```

Prefer exact links from hard-register-renumbered instructions and stable machine
indexes. Use expression similarity only as a fallback. Report ambiguous matches
rather than silently selecting one.

### Comparative role matrix

Variant output should be able to render:

| Role | Baseline | Broad loop | Narrow loop |
|---|---|---|---|
| table pointer | `$t1` | `$t0` | `$t0` |
| masked flags | `$t0` | `$t1` | `$t1` |
| table limit | `$v1` | `$v0` | `$v1` |
| instruction count | 77 | 78 | 77 |

This replaces misleading “pseudo 108 changed” reports when pseudo 108 denotes a
different role in another variant.

## Deliverable 3: allocator-duel report

Add pairwise allocation analysis to `compilerTrace.ts`, automatically when
`explainDiff` finds a consistent hard-register swap and explicitly through a
focused option.

Suggested CLI:

```bash
npx tsx tools/agent/compilerTrace.ts <func> --allocation-duel auto
npx tsx tools/agent/compilerTrace.ts <func> --allocation-duel t0:t1
```

The Pi wrapper should expose an optional bounded argument with the same meaning.

### Data to report

For each competing role/pseudo:

- global allocno rank;
- raw references and sets;
- loop-sensitive or weighted reference evidence;
- live length and reconstructed priority components;
- mode and register-class constraints;
- pseudo and hard-register conflicts;
- full and copy preferences;
- `someone_prefers` exclusions when reconstructable;
- earlier winner updates that made a hard register unavailable;
- final hard-register assignment.

Suggested types:

```ts
interface AllocationCandidate {
  roleId: string;
  pseudo: number;
  allocnoRank?: number;
  assignedHardReg?: number;
  rawReferences?: number;
  weightedReferences?: number;
  liveLength?: number;
  reconstructedPriority?: number;
  loopDepthUses: Array<{ uid: number; depth: number }>;
  preferences: number[];
  blockedRegisters: Array<{
    hardReg: number;
    cause: string;
    confidence: TraceConfidence;
  }>;
}

interface AllocationDuel {
  left: AllocationCandidate;
  right: AllocationCandidate;
  conflict: boolean;
  winner?: number;
  decidingEvidence: string[];
  confidence: TraceConfidence;
}
```

### Human output

The 71/77 fixture should produce a compact explanation similar to:

```text
Allocation duel: table-pointer vs masked-flags
  They conflict and cannot share a hard register.
  Masked flags are allocated first and claim $t0.
  Table pointer is allocated later and receives $t1.
  This exactly explains the target/candidate $t0 <-> $t1 map.
```

The exact fixture should show the table role moving ahead and claiming `$t0`.
Do not claim a single deciding formula when the dump lacks enough information;
list observed order and reconstructed causes separately.

## Deliverable 4: structured variant expectations

Extend the variant manifest so `expectedEffect` remains useful prose but can be
supplemented by machine-checkable assertions.

Example:

```json
{
  "expectedEffect": "loop-weight the table load so its pointer receives t0",
  "expect": {
    "roles": [
      { "role": "table-pointer", "assignedRegister": "t0" },
      { "role": "masked-flags", "assignedRegister": "t1" }
    ],
    "instructionCountDelta": 0,
    "newMachineOperations": [],
    "metadata": [
      { "kind": "loop-depth", "role": "table-limit-load", "minimum": 1 }
    ]
  }
}
```

Assertions should support:

- role-to-hard-register assignment;
- allocno ordering between two roles;
- pseudo set/death count changes;
- loop depth at a role's defining or consuming instruction;
- instruction-count delta;
- presence or absence of new machine operation families;
- preservation of an opcode stream or selected target index range.

Verdict classification should distinguish:

```text
mechanism confirmed, final stream regressed
mechanism confirmed and local roles preserved
mechanism rejected
assertion ambiguous because role alignment was ambiguous
```

The broad-loop `func_800158E4` variant must be recognized as a successful global
allocation experiment despite its low exact-match count.

## Deliverable 5: loop-depth-weighting transformation family

Add a new mechanism and curated transformation template:

```text
mechanism: loop-depth-weighting
template: single-iteration-scope
```

Initial implementation should continue using explicit exact source anchors.
Do not add a general C rewriter until a reliable C89 parser is justified.

A transformation specification may identify one or more semantics-safe source
regions:

```json
{
  "schemaVersion": 1,
  "function": "func_XXXXXXXX",
  "template": "single-iteration-scope",
  "baseSourcePath": "build/candidate.c",
  "expectedPass": "greg",
  "outputs": [
    {
      "id": "loop-whole-comparison",
      "scope": { "find": "if (...) { ... }" },
      "expectedEffect": "weight all comparison webs",
      "invariants": ["the region executes exactly once"]
    },
    {
      "id": "loop-producer-only",
      "scope": { "find": "limit = table->field;" },
      "expectedEffect": "weight only the table producer",
      "invariants": ["the load executes exactly once"]
    }
  ]
}
```

Generated source shape:

```c
do {
    /* exact selected region */
} while (0);
```

### Safety checks

Reject a selected region containing an unaccounted:

- `break` or `continue`;
- label or `goto` crossing the region;
- declaration whose scope would change;
- case/default label;
- construct that is not valid C89 after wrapping.

As with all variant transformations, output belongs under `build/`, must pass
source policy, and is not promotion-eligible until full-mode exact verification.

## Deliverable 6: causal scope minimizer

Once a broad metadata probe satisfies its allocation assertions, minimize the
wrapped scope while preserving that mechanism.

### Initial bounded design

Avoid arbitrary token-level delta debugging. Require the transformation spec to
supply an ordered list of candidate statement regions or a statement partition.
Test only contiguous semantics-safe regions.

Optimization order:

1. preserve required role assignments or allocno order;
2. preserve opcode multiset and target instruction count;
3. restore local target register roles;
4. maximize exact instruction match;
5. accept only a full exact match as promotable.

Suggested command:

```bash
npx tsx tools/agent/fuzzVariants.ts <func> \
  --transform-spec build/loop-probes.json \
  --minimize-scope loop-whole-comparison \
  --trace-passes
```

The minimizer should retain every tested complete source and explain why each
scope was kept or rejected. It must never silently mutate `src/`.

### Expected motivating-case result

```text
whole comparison:
  global allocation assertion passes
  local table-limit role is wrong
  instruction count +1

nested if only:
  global allocation assertion passes
  local schedule still differs

signed table-load statement only:
  global and local role assertions pass
  instruction count delta 0
  exact 77/77
```

## Deliverable 7: allocation intervention recommender

Add a bounded recommendation layer after an allocation duel is diagnosed. It
should name mechanism families, not generate random syntax.

For a pure conflicting-register swap, consider in order:

1. fresh versus reused value web;
2. result versus dying-input reuse;
3. lifetime shortening or birth relocation;
4. target-register recurrence already visible in the target;
5. loop-depth weighting around one producer or consumer;
6. broad metadata probe followed by scope minimization;
7. diagnostic-only barrier proof, explicitly non-promotable.

Recommendations must cite evidence:

```text
Try loop-depth weighting around table-pointer use UID 117:
  table-pointer and masked-flags pseudos conflict;
  table-pointer loses the first available temporary register;
  ordinary aliases were equivalent through combine;
  the use is a single side-effect-free load suitable for a do-once probe.
```

Do not recommend loop wrapping by default when a natural fresh-expression or
lifetime fix has not been tested. The unusual metadata probe is a late-stage,
mechanism-backed experiment.

## Suggested implementation layout

Extend existing modules rather than creating parallel compiler parsers:

```text
tools/agent/compiler-trace/
├── rtl-parser.ts                 add note parsing
├── rtl-notes.ts                  loop/block reconstruction
├── pseudo-role.ts                semantic role signatures/alignment
├── local-allocation.ts           allocno order and score evidence
├── allocation-duel.ts            pairwise explanation
├── render-text.ts                bounded duel/metadata rendering
└── types.ts                      typed report additions

tools/agent/variant-lab/
├── pass-diff.ts                  note-aware, role-aware comparisons
├── classify-hypothesis.ts        structured assertion verdicts
├── transformations.ts            single-iteration-scope template
├── scope-minimizer.ts            bounded contiguous-scope search
├── manifest.ts                   expectation/schema validation
└── types.ts                      new mechanism and assertion types
```

Keep `compilerTrace.ts` and `fuzzVariants.ts` as orchestrators. Add bounded Pi
wrapper arguments only after the underlying CLI and typed reports are stable.

## Stack rank

This is the recommended implementation order, balancing reusable value,
dependency order, and risk. The first three items form the minimum useful
release.

| Rank | Deliverable | Impact | Effort | Why it belongs here |
|---:|---|---|---|---|
| **1** | Note-aware RTL pass snapshots | High | Medium | This is the clearest current observability defect: metadata that affected allocation is silently discarded. It is also a prerequisite for validating loop-depth experiments honestly. |
| **2** | Semantic pseudo-role alignment | Very high | High | Raw pseudo-number comparisons become unreliable as soon as a variant adds a local. Role alignment improves every cross-variant allocation report, not only loop cases. |
| **3** | Allocator-duel report | Very high | Medium after rank 2 | This is the highest-value operator-facing feature. It converts a pure register swap into a direct explanation of the two competing roles, but it should be built on stable role identities rather than fragile pseudo numbers. |
| **4** | Structured variant expectations | High | Medium | Machine-checkable allocator, metadata, and instruction-count assertions let the laboratory recognize causal wins that final match percentage hides. |
| **5** | Loop-depth-weighting transformation family | Medium–high | Low–medium | Once notes and assertions are observable, this adds a bounded clean-C probe for a newly proven mechanism. It should not precede the diagnostics that explain its effects. |
| **6** | Causal scope minimizer | Medium | High | Potentially saves many compilations after a broad probe succeeds, but it depends on safe scope specifications and structured assertions. It is less useful before ranks 4 and 5 exist. |
| **7** | Allocation intervention recommender | Medium | Medium | Build this last so recommendations are generated from measured duel, role, and probe data. Implementing it earlier would encode heuristics that the lower-level tools cannot yet verify. |

### Delivery cut lines

- **Minimum useful release:** ranks 1–3. This would already explain the
  `func_800158E4` allocation fight far better than the current tools.
- **Automated discovery release:** ranks 4–5. This would generate and correctly
  evaluate the narrow family of loop-metadata hypotheses.
- **Search-efficiency release:** ranks 6–7. This would narrow successful probes
  and recommend them automatically for future matching signatures.

## Phased implementation

### Phase 1: observability foundation

1. Parse and type RTL loop/basic-block notes.
2. Annotate executable instructions with loop depth.
3. Include note metadata in pass snapshots and hashes.
4. Parse global allocno order into the compiler-trace report.
5. Add synthetic parser and normalization fixtures.

### Phase 2: role alignment and allocator duel

1. Build semantic pseudo signatures.
2. Align roles across two traces with confidence labels.
3. Map consistent hard-register renames from structural diffs to role pairs.
4. Render allocation-duel reports.
5. Add JSON schema fields without breaking existing consumers.

### Phase 3: mechanism-aware probes

1. Add `loop-depth-weighting` to variant mechanisms.
2. Add the `single-iteration-scope` exact-anchor template.
3. Add structured role, metadata, and instruction-count expectations.
4. Teach hypothesis classification to separate mechanism success from final
   stream regressions.

### Phase 4: minimization and recommendations

1. Add explicit statement partitions to transform specs.
2. Implement contiguous-scope minimization.
3. Add the evidence-backed intervention recommender.
4. Expose compact results through the Pi wrappers.
5. Update README, the tools directory note, and the decompilation skill after
   behavior and tests are stable.

## Test plan

Use committed text fixtures and small synthetic dump excerpts. Do not commit
objects, binaries, or generated `build/` artifacts.

### Note parsing

- loop begin/end around one instruction;
- nested loops;
- malformed or unmatched loop notes;
- basic-block notes interleaved with deleted instructions;
- equivalent loop regions with different note UIDs.

### Role alignment

- stable pseudo number and expression;
- shifted pseudo numbers after a new local declaration;
- same expression with different use-site offsets;
- ambiguous duplicate expressions reported as ambiguous;
- hard-register-renumbered instruction providing an exact role link.

### Allocation duel

- two conflicting allocnos assigned `$t0` and `$t1` in rank order;
- preference causing the lower-ranked candidate to win a hard register;
- winner update blocking a later conflicting allocno;
- insufficient dump evidence producing a reconstructed, not exact, reason;
- no conflict, where a “duel” explanation must be rejected.

### Variant assertions

- expected role assignment confirmed;
- role assignment confirmed while instruction count regresses;
- loop note appears but target role does not change;
- pseudo renumbering does not invalidate an assertion;
- ambiguous role alignment prevents a false confirmation.

### Scope transformation and minimization

- safe one-statement wrapping;
- rejection of `break`, `continue`, labels, and declarations with changed scope;
- broad scope passes allocation assertion but fails count assertion;
- narrow scope passes both;
- deterministic run IDs and preserved complete sources;
- no mutation of `src/`.

### Motivating regression

Create text fixtures from the three relevant `func_800158E4` traces:

1. 71/77 baseline register swap;
2. broad loop with correct global allocation and 78 instructions;
3. narrow table-load loop with 77/77.

The regression must prove that the tools:

- identify the table-pointer versus masked-flags allocation duel;
- identify loop metadata as the first meaningful causal change;
- align roles despite shifted pseudo numbers;
- classify the broad loop as mechanism-confirmed but non-promotable;
- select the narrow loop as the minimum supplied scope satisfying all
  assertions.

## Acceptance criteria

- A pure consistent target/candidate register swap produces a direct pairwise
  allocation explanation without manual `.flow`/`.greg` reading.
- Loop and basic-block metadata participate in pass comparison.
- Cross-variant reports remain stable when pseudo numbers shift.
- The broad and narrow motivating variants are distinguished by mechanism,
  local-role, and instruction-count assertions rather than percentage alone.
- A bounded scope minimization run can rediscover the narrow table-load fix from
  supplied safe statement regions.
- Every uncertainty is confidence-labelled.
- Generated experiments remain C89 and pass source policy.
- No asm, hard-register pinning, flag override, compiler modification, random
  permutation, or automatic source promotion is introduced.
- Exact per-function diff and full-build verification remain the only promotion
  gates.
