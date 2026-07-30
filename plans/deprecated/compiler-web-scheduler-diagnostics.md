# Plan: explain GCC pseudo webs and scheduling/allocation feedback

**Status: implemented.** The implementation is split under
`tools/agent/compiler-trace/`, emits schema-versioned `report.json`, supports
focused pseudo/scheduler CLI and Pi-tool arguments, and has synthetic
before/after allocation-hazard and target-recurrence regressions. Stock GCC
`-da` does not print its private doubled quantity indices, so those IDs and
endpoints are explicitly labeled reconstructed rather than exact; observed
SET/use/death UIDs and assignments remain exact.

## Purpose

Extend `tools/agent/compilerTrace.ts` so a difficult register or scheduling
mismatch can be explained as a source-to-pseudo-to-hard-register chain instead
of reconstructed manually from several GCC `-da` dumps.

The design must remain compiler-observability only. It must never patch GCC,
assign hard registers, or recommend forbidden source workarounds.

## Motivating case

`func_800154CC` looked like a four-instruction scheduling mismatch. The real
chain crossed three stages:

1. sched1 separated two independent sums;
2. local allocation assigned both disjoint values to `$v0`;
3. the resulting hard `$v0` WAR hazard prevented sched2 from moving the second
   sum above stores that read `$v0`.

The clean solution reused the x-sum C variable for a later tag result. That
created a two-set, two-death global pseudo assigned to `$v1`; the y sum remained
local in `$v0`, and sched2 could then repair the order. Existing trace output
contained the evidence, but did not connect the source variable, pseudo IDs,
pass transitions, or sched2 hazard.

## Deliverables

### 1. Pseudo provenance table

For every pseudo seen from `.rtl` through `.greg`, report:

- pseudo number, mode, user-variable flag, pointer flag, and source expression
  when recoverable;
- set/use/death instruction UIDs and basic blocks;
- first and last pass where it exists;
- substitutions, merges, deleted sets, and renumbering relationships inferred
  between adjacent dumps;
- local quantity membership and exact birth/death indices from `.lreg`;
- local/global/reload assignment and hard-register suggestion evidence;
- all conflicts, including fake-lifetime-only conflicts.

Keep uncertain mappings explicitly marked as inferred. Do not present heuristic
name recovery as fact.

### 2. Scheduler decision model

Parse the sched1 and sched2 ready-list traces into a structured DAG containing:

- dependency kind: true, anti, output, memory/alias, control, or scheduling
  group;
- edge cost and target-specific cost adjustment;
- forward source order and GCC's backward scheduling order;
- base priority, birth-priority adjustment, ready-list rank, LUID tie break,
  functional-unit hazard, and selected instruction for each cycle;
- live ranges shortened or extended by the chosen order.

Generate both a bounded text summary and a machine-readable JSON artifact under
`build/compilerTrace/<func>/`.

### 3. Allocation-to-sched2 feedback detector

Compare `.sched`, `.lreg`, and `.sched2` and emit findings such as:

```text
sched1 placed y_sum after x stores.
x_sum and y_sum were both assigned v0 because their lifetimes are disjoint.
sched2 cannot move y_sum above stores 107/110: stores read v0 and y_sum writes v0 (WAR).
A source shape that gives x_sum a distinct register may remove the scheduling block.
```

This detector should distinguish:

- an order fixed by sched2;
- an order blocked only by hard-register allocation;
- an order already fixed in sched1;
- a true memory/control dependency that source web changes cannot remove.

### 4. Target register-recurrence hints

Given the archived target and candidate live ranges, identify non-overlapping
semantic roles that use the same target hard register but separate candidate
pseudos. Report them as experiments, not conclusions:

```text
Target v1 is used by x_sum and later first_tag_or.
Candidate uses pseudo 105 for x_sum and pseudo 117 for first_tag_or.
Consider testing one shared C variable if the values do not overlap.
```

This is the main reusable insight from `func_800154CC`.

## Suggested implementation

Keep `compilerTrace.ts` as the CLI/orchestrator and split parsing into focused
TypeScript modules under `tools/agent/compiler-trace/`:

```text
tools/agent/compiler-trace/
├── rtl-parser.ts
├── pseudo-provenance.ts
├── local-allocation.ts
├── scheduler-dag.ts
├── hard-register-hazards.ts
├── target-recurrence.ts
├── render-text.ts
└── types.ts
```

Add `--json` and optional focused flags:

```bash
npx tsx tools/agent/compilerTrace.ts <func> --json
npx tsx tools/agent/compilerTrace.ts <func> --pseudo 106
npx tsx tools/agent/compilerTrace.ts <func> --scheduler-window 24:32
```

The existing Pi wrapper should return the bounded summary and artifact paths,
not the complete dumps.

## Test plan

Use committed text fixtures derived from small synthetic GCC dumps rather than
committing generated objects or binaries.

Cover:

1. one-set local pseudo assigned `$v0`;
2. multi-set/multi-death global pseudo assigned `$v1`;
3. sched1 separation followed by same-register allocation and sched2 WAR;
4. distinct-register allocation allowing sched2 movement;
5. birth-priority adjustment (`REG_N_SETS == 1`);
6. memory-unit hazard tie breaking;
7. ambiguous pseudo mapping reported as uncertain;
8. truncated or changed dump format failing with a useful diagnostic.

Add an integration fixture for the before/after `func_800154CC` traces and
assert the tool identifies the `$v0` WAR in the old candidate and its absence
in the matched candidate.

## Acceptance criteria

- The tool explains the old `func_800154CC` 46/50 mismatch without manually
  reading raw dumps.
- Exact local quantity birth/death information replaces the current approximate
  priority-only account where GCC exposes enough data.
- JSON output is stable and typed.
- Human output remains below the Pi tool output limit.
- No compiler, assembler, source, or build flags are changed.
