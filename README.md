# BTN Decompilation

This project is a matching decompilation of *Harvest Moon: Back to Nature*
(SLUS-01115, PlayStation 1).

The goal is C source code that compiles to a byte-identical copy of the
original PS-X EXE. The build checks the result with SHA-256 each time.

### Terms

| Term | Meaning in this project |
|---|---|
| the original binary | The PS-X EXE payload in `extracted/iso/slus_011.15` |
| the target | The original machine code of one function |
| the candidate | The machine code that our C source makes |
| to match | To be byte-identical to the target |
| function | One symbol in the original binary that holds code |
| live function | A function that the game uses |
| dead function | Unused code from the PSY-Q libraries |
| tool | One TypeScript program under `tools/` |
| report | One text or JSON output of a tool |
| the oracle | `diffFunc.ts`, which compares bytes with the original. It backs the tools rather than being one |
| stub | A `.c` file that includes the original assembly instead of C |

## Status

The numbers below come from `npx tsx tools/diagnostics/progress.ts` and from a
census of `src/`. The date of the measurement is 2026-08-13.

### Progress

| Measurement | Value |
|---|---|
| Live functions that match | 198 of 257 (77.04%) |
| Live bytes that match | 31,884 of 57,804 (55.16%) |
| Dead functions (not counted) | 206 functions, 22,256 bytes |
| GTE functions (counted) | 10 |
| Pure assembly functions (not counted) | 1 |
| Files in `src/` | 464 |
| Files that are still a stub | 217 |

`make check` passes. The build makes a binary that matches the original
payload.

### Clean-source status

A byte match is a failure if it needs a workaround. The table shows every
workaround that the C sources still use.

| Construct | Files | Note |
|---|---|---|
| Hard-register pin | 8 | Each file has a `register-asm` entry in the allowlist |
| Empty assembly barrier | 7 | The style guide permits this as a last resort. The configuration sets `allowEmptyMemoryBarrier`, so these files need no entry |
| Assembly block with instructions | 5 | Each file has an `embedded-asm` entry |
| `CAPTURE_RA` debug hook | 2 | The hook is a target feature, not a workaround |
| Full function in assembly | 2 | The handwritten-assembly class |
| Per-file compiler flag | 1 | `func_80014494` uses `-fno-cse-skip-blocks` |

The allowlist is `.pi/autodecomp.json`, key `sourcePolicy.allowlist`. Each
entry is the audit trail for one construct. The gate refuses a construct that
has no entry.

One function is parked: `func_8001A870`. Three functions wait for a human
decision. The notes are in `notes/human-needed-approvals/`.

Read `notes/retros/2026-08-09-asm-folding-root-cause-retro.md` first if you
continue this work. It explains why the project stopped, what restarted it,
and what remains.

## The original binary

| Field | Value |
|---|---|
| File | `extracted/iso/slus_011.15` (PS-X EXE, 323,584 bytes) |
| Load address | `0x80010000` |
| Entry point | `0x80011278` |
| Payload | 321,536 bytes at file offset `0x800` |
| GP value | `0x8005E274` (found in the code; the header field is zero) |
| Stack base | `0x801FFFF0` |

The sections are contiguous. No section interleaves with another section.

```
0x80010000 – 0x80011270  .rodata  (4,720 bytes)
0x80011270 – 0x80048190  .text    (225,056 bytes)
0x80048190 – 0x8005D3D8  .data    (86,600 bytes)
0x8005D3D8 – 0x8005E800  .sdata   (5,160 bytes, GP-relative)
```

## The toolchain

Every other result depends on these four facts. For the full evidence, read
`notes/compiler-identification.md` and `notes/toolchain-version-detection.md`.

| Parameter | Value | Proof |
|---|---|---|
| Compiler | GCC 2.95.2-psx (PSY-Q 4.6 `CC1PSX.EXE`) | Our `cc1` from Docker makes byte-identical output to the original `CC1PSX.EXE` |
| Assembler | ASPSX 2.80 or later (maspsx emulates it) | The `li` patterns (1,142 `addiu` against 88 `ori`) prove 2.56 or later. A direct `sltu` proves 2.70 or later. An `addiu $r,$gp,…` from a `la` macro proves 2.80 or later |
| Runtime libraries | PSY-Q SDK 4.7 | Signature match against `tools/vendor/psx_psyq_signatures/470/` |
| Optimization | `-O2 -G8` | The delay-slot fill rate, and GP-relative access for symbols of 8 bytes maximum |

The compiler is 2.95.2, not 2.8.1. The proof is the register that the switch
dispatch uses. The target uses `$a0`. Version 2.8.1 always uses `$v0`. Doubt
each register workaround from the 2.8.1 period. Many of them are now
unnecessary.

### The compilation pipeline

```
C source → mips-linux-gnu-cpp → cc1 (GCC 2.95.2-psx, built with Docker)
         → maspsx (emulates the ASPSX 2.80 behavior) → mips-linux-gnu-as → .o
Assembly (splat) → mips-linux-gnu-as → .o
All .o → mips-linux-gnu-ld (slus_011.ld) → ELF → objcopy → raw binary
       → SHA-256 comparison against the original payload
```

Per-file compiler flags live in `configs/flag_overrides.mk`. The file has one
active entry. Each entry carries a comment that states its evidence.

### How the code addresses a global

The address form of a global is a fact of one translation unit. The C source
states that fact:

- The file that owns the global defines it tentatively.
- Every other file declares it `extern`.

maspsx forces `-G0` on GNU `as`. Therefore the C source is the only input that
makes this decision. For the rules, read
`notes/adr-0001-symbol-addressing-at-the-assembler-boundary.md`, section 2.4.
To find the owner of a global from the target, use
`tools/build/deriveTuOwnedGlobals.ts`.

## Setup

Do these steps in this order.

```bash
sudo apt install binutils-mips-linux-gnu
pipx install splat64[mips]
git clone --recursive <repo-url> && cd btn-decompilation
npm install
```

Then build the PlayStation GCC 2.95.2 cross-compiler. This step needs Docker.

```bash
cd tools/vendor/old-gcc && make VERSION=2.95.2-psx && cd ../..
```

Last, put the original EXE at `extracted/iso/slus_011.15`. Git ignores that
path.

## Build commands

| Command | Result |
|---|---|
| `make` or `make check` | Builds the binary and checks the byte match. This is the default |
| `make split` | Runs the full splat pipeline. See "The `make split` pipeline" |
| `make progress` | Shows a summary of the decompilation progress |
| `make disassemble` | Runs the spimdisasm bootstrap and writes `functions.csv` and one `.s` file for each function |
| `make config-check` | Runs `make split` again and fails if a tracked file changes |
| `make setup` | Initializes the git submodules |
| `make clean` | Removes the build artifacts |
| `make wipe` | Removes the generated configuration files. Use this to bootstrap again |

## Directory structure

```
src/                    One C file for each function (464 files)
include/
  common.h              PSX scalar types (u8, s32, and others); includes globals.h
  globals.h             Generated externs for D_XXXXXXXX (classifyGlobals.ts)
  globals_override.h    Hand-written struct types for specific globals
  functions.h           Generated signatures of matched functions (contextExport.ts)
  sdk_types.h           Generated type context for m2c (contextExport.ts)
  game_types.h          Shared struct definitions (Vec3, GfxObj, and others)
  variables.h           Shared variable declarations
  debughook.h           The CAPTURE_RA macro
  include_asm.h         The INCLUDE_ASM macro for stubs
  psyq/                 PSY-Q SDK headers
configs/
  splat.yaml            Splat configuration (bootstrap.ts generates part of it)
  symbol_addrs.txt      Hand-written function and data symbols
  flag_overrides.mk     Per-file cc1 flags
  checksum.sha256       The SHA-256 of the original payload
  project-info.json     Facts that a human supplies (game title, evidence note)
  project-profile.md    Generated target and toolchain facts (genProjectProfile.ts).
                        The skills read this file. Do not edit it by hand
lib/                    PSY-Q 4.7 static libraries. The tools use them to detect
                        signatures and to classify dead code
tools/                  TypeScript tools that run with npx tsx
  agent/                Decompilation diagnostics and context tools
  build/                The make split pipeline
  diagnostics/          Progress, diff, and one-shot analysis tools
  lib/                  Shared modules (psxExeInfo.ts, symbolIndex.ts, functionOracle.ts)
  vendor/               Vendored repositories
.pi/                    Pi extension commands, skills, tools, and the supervisor
notes/                  Research and write-ups. This is the project memory
prompts/                The matching guide, and archived templates
plans/                  Plans for tool and workflow work, with their status
build/                  All generated artifacts. Git ignores this directory
extracted/iso/          The original game files. Git ignores this directory
```

For the full tool list, read `notes/tools-directory-structure.md`.

## The Pi workflow

Pi supplies the model, the authentication, the session loop, and the standard
coding tools. This project supplies the PlayStation decompilation policy and
the workflow. The resources are in `.pi/`.

`tools/agent/callGraph.ts` builds the worklist and ranks it by priority. The
Pi extension reads that graph.

Start `pi` from the repository root. Then use a command. Run `/reload` after
you edit a `.pi` resource in an open session.

### Commands

```text
/decompile [function]       Start a new function, or select the next target
/fix-decomp <function>      Continue an existing clean-source attempt
/refine-decomp [function]   Refine a function that already matches
/project-refine             Do one careful cleanup batch across files
/decomp-status              Show the worklist counts and the next target
/auto_decompilation_loop    Run the tiered escalation loop in this session
```

The commands dispatch three skills. The skills are game-agnostic:

- `psx-decompile-function` — m2c, then classify, then trace, then diff, then
  the full check.
- `psx-refine-function` — cleanup from the callers and the callees. The match
  stays.
- `psx-project-refinement` — one small batch across files. The gate checks all
  of it.

An interactive workflow never commits and never merges.

The skills read the target and toolchain facts from
`configs/project-profile.md` and from the active configuration. They do not
hold the values of one project.

### Step 1: triage before you write source

`triage.ts` and `sdkIdioms.ts` answer a cheap question first. Does the target
build a PSY-Q packet that the SDK has a type and macros for?

```bash
npx tsx tools/agent/triage.ts <function>
npx tsx tools/agent/sdkIdioms.ts <function> [--json]
npx tsx tools/agent/flagProbe.ts <function> [--json]
```

`sdkIdioms.ts` reads `include/psyq/libgpu.h` each time it runs. It takes these
facts from the header, and holds none of them in its own code:

- the size of each packet;
- the offset of each field;
- the value of each command;
- the mask of each attribute macro;
- the expansion of each macro;
- the struct that each command macro builds.

The tool reports every packet that it recognizes. It groups the packets by the
base register web that addresses them. Therefore one function can hold several
packets.

Three recognition rules make the difference:

- The tool removes the attribute masks of the header from the observed code
  byte. Therefore it recognizes `setPolyF4` in composition with
  `setSemiTrans`. An earlier version saw nothing at all.
- The tool inverts a command word back to the arguments that the target
  establishes.
- The tool checks both halves of a tag link before it calls the link
  complete.

Hand-written field stores are a defect if the SDK has a macro for them. The
same is true of hand-written tag arithmetic. Therefore:

- `triage.ts` shows this finding before the inventory and allocation findings.
- `explainDiff.ts` prints an `SDK OPERATION-BOUNDARY CANDIDATE` section above
  its classification.

Treat each classification below that section as provisional. Restore the
operation boundary first. A reading of allocation or scheduling from a
hand-expanded packet describes a program that the original build never
compiled.

### Step 2: check the flag hypothesis early

`flagProbe.ts` writes `build/flagProbe/<function>/report.json` next to its
text output. The report holds:

- the structural fingerprints from the original bytes;
- the flag matrix over the current source;
- a conclusion of `supported`, `not-supported-current-source`, or
  `inconclusive`;
- the hashes of the source, the target, and the toolchain.

`triage.ts` reads the report only when all four identities agree. A measured
tie makes the flag signal an info finding. The target fingerprint stays as
evidence. An edit to the source cancels the conclusion.

The wording stays inside the measurement. A tie proves that the flag is not
the remedy for the source as written. It does not prove that the flag is
useless for every source shape.

### Step 3: get compiler evidence

`compilerTrace.ts` writes the raw `-da` dumps. It also writes a typed report
to `build/compilerTrace/<function>/report.json`.

```bash
npx tsx tools/agent/compilerTrace.ts <function> --pseudo 106
npx tsx tools/agent/compilerTrace.ts <function> --scheduler-window 24:32
npx tsx tools/agent/compilerTrace.ts <function> --json
```

The pass summaries keep the loop notes, the basic-block notes, and the notes
for deleted instructions. The tool adds the loop depth to each instruction. It
normalizes each loop region by the semantic instructions inside it.

The text report connects these items:

- where a pseudo is set, used, and dies;
- the endpoints of each lifetime;
- the local allocation and the global allocation;
- the ready-list decisions of sched1 and sched2;
- the hard-register hazards that allocation makes;
- the experiments on target-register recurrence.

`analyzeAllocatorCounterfactual.ts` then refines the hard-register roles of
the target to pseudos before allocation. It checks the allocno priorities of
GCC 2.95.2. It writes three kinds of requirement: explicit hard lifetimes,
overlapping local pseudos, and global order.

The `-da` dumps cannot show the private state of local allocation. For that
state, the diagnostic oracle builds a separate instrumented `cc1` under
`build/compilerOracle/`. The oracle then:

1. checks that its baseline output equals the output of the production
   compiler;
2. records the exact local quantities and the candidate order of
   `find_free_reg`;
3. runs legal counterfactuals for forced assignment and for dependency.

The local minimizer reduces the target assignments to hard-register occupancy
requirements.

```bash
npx tsx tools/agent/analyzeTargetSchedule.ts <function> [--block 0]
npx tsx tools/agent/analyzeAllocatorCounterfactual.ts <function>
npx tsx tools/agent/instrumentCompilerOracle.ts <function>
npx tsx tools/agent/analyzeLocalAllocationOracle.ts <function>
npx tsx tools/agent/minimizeLocalAllocation.ts <function>
npx tsx tools/agent/solveLocalAllocationState.ts <function>
npx tsx tools/agent/inspectLocalAllocationVariant.ts <function> <variant.c> [--block N]
```

`analyzeTargetSchedule.ts` aligns the target instructions with the candidate
instructions. It keeps the proven zero-width RTL barriers. It then:

- rebuilds the comparator of the legacy scheduler;
- checks the replay of the baseline ready list;
- checks the target order against the candidate dependency graph;
- replays a bounded counterfactual for the participant order.

The tool can read preserved compiler-trace artifacts. Then it does not run
`cc1` again. It writes the emission links, the scheduling relations, the
allocation order, and the delay-slot requirements to
`build/targetSchedule/<function>/analysis.json`. Each emission link carries a
confidence label.

### Step 4: search the source space

`searchSchedulerState.ts` turns one checked scheduler block into a finite
constraint problem. The problem is typed and function-agnostic. It covers
birth boosts, LUID relations, bounded phantom copies, and extra dependencies.
Each extra dependency needs a stated reason.

The tool refuses to search until the model replays the candidate block
exactly. It then writes SAT, bounded exhaustive UNSAT, or INCONCLUSIVE.

```bash
npx tsx tools/agent/searchSchedulerState.ts <function> --block 0
npx tsx tools/agent/searchSchedulerState.ts \
  --input build/schedulerConstraint/<function>/<run-id>/input.json
```

`searchSourceShapes.ts` reads that analysis and an explicit finite grammar of
exact edits. Each rule of the grammar carries its mechanism label. The tool
writes only complete policy-clean C under `build/sourceShapeSearch/`. It never
changes `src/`.

```bash
npx tsx tools/agent/searchSourceShapes.ts <function> \
  --analysis build/targetSchedule/<function>/analysis.json \
  --spec build/search/<function>.json --jobs 8 [--resume]
```

A schema-v2 search can trace each distinct preprocessed class. It can also
write schedule profiles that compare with the target. Therefore identical
final assembly cannot hide a regression in replay, in allocation, or in the
delay slots.

`synthesizeSourceShapes.ts` sits between the target analysis and the finite
search. Its model covers the top-level C89 prologue only. It binds the source
statements to the target roles. It then derives recipes that keep the
dependencies, and writes a schema-v2 specification that you can read.

```bash
npx tsx tools/agent/synthesizeSourceShapes.ts <function> --derive-only
npx tsx tools/agent/synthesizeSourceShapes.ts <function> \
  --max-variants 500 --max-depth 3 --jobs 8 [--resume]
```

`searchResidualSourceSpace.ts` is the automatic layer above the other search
tools. It needs one function name. From that name it:

1. establishes an immutable baseline bundle;
2. builds a whole-function C89 semantic graph with no loss;
3. derives a causal closure from the instructions that differ, with a
   machine-readable reason for each item;
4. writes a finite versioned grammar of rewrite rules.

The grammar has these active rules:

- partitions that split or merge value webs;
- statement orders that the dependencies permit;
- declaration-birth forms;
- component splits of verified SDK macros;
- materialization of constants that the diff names;
- SDK-call order across adjacent verified macro calls.

The expression rules and the type-and-cast rules stay suppressed. The grammar
records each suppressed rule with its reason.

A packet that the code hands to a display list is a publication barrier.
Nothing that touches that packet may cross the barrier. `grammar.json` records
each SDK-call run with:

- the calls, in source order;
- the dependency edges, and the reason for each edge;
- the count of admitted orders and the count of suppressed orders;
- the hash of the SDK header that identified the calls.

The tool counts the domain exactly. It enumerates the domain in a
deterministic order, and it can shard the domain into disjoint `k/n` classes.
It checkpoints its progress. It compares each candidate object with the target
bytes.

```bash
npx tsx tools/agent/searchResidualSourceSpace.ts <function> --derive-only
npx tsx tools/agent/searchResidualSourceSpace.ts <function> --jobs 16 [--resume]
npx tsx tools/agent/searchResidualSourceSpace.ts <function> \
  --jobs 16 --shard 3/16 --max-candidates 100000 [--resume]
```

Each terminal state means one thing:

| State | Meaning |
|---|---|
| `exact-candidate-found` | The run found a byte-identical candidate |
| `exhausted-no-exact` | The run evaluated the whole domain and found none |
| `incomplete-budget` | The run stopped early. The next run resumes it |
| `incomplete-shards` | Some shards of the domain did not finish |
| `unsupported-source` | The tool cannot model the source |
| `unsupported-correspondence` | The tool cannot align the target with the candidate |
| `domain-too-large` | The domain is beyond the exact bound |
| `baseline-drift` | The inputs changed after the checkpoint |
| `derived` | `--derive-only` finished. The run priced the domain |

A run that stops early never reports `exhausted-no-exact`. The tool never
copies a candidate into `src/`.

### Step 4b: name the pass that owns the residual

`reversePipeline.ts` runs the compiler backward. It lifts the original bytes and
the candidate object through the same chain of inverse passes — assembler,
delay-slot filling, register allocation — and compares the two at each waypoint.
The oldest waypoint at which they differ names the pass that introduced the
residual.

```bash
npx tsx tools/agent/reversePipeline.ts <function>
npx tsx tools/agent/reversePipeline.ts <function> --source <path>
npx tsx tools/agent/reversePipeline.ts <function...> --backtest
```

Read it before any allocator or scheduler forensics. It separates "the source
computes something different" from "the same program, allocated differently",
and it recognizes a copy one side coalesced away as an allocation decision
rather than an instruction-count delta — a count delta that is really an
allocation choice sends a session to the wrong end of the pipeline.

The report has three parts:

- the waypoint ladder, with the pass that owns the residual named;
- the round-trip checks, which replay each inverse against the compiler's own
  `-da` dumps and say how much the ladder can be trusted;
- the decisions: the independent choices that account for the whole residual,
  each with its source lever. Consequences are folded under their cause, so
  thirty webs in the wrong register read as the one scheduling decision that
  displaced them.

`--backtest` perturbs a matching source in ways whose stage is known in advance
and checks the chain names the right one. `tools/agent/pipeline-reversal/README.md`
documents the inverses and their limits.

### Step 4c: iterate on the residual, not the byte score

`diffFunc` answers the terminal question — are the bytes identical — and it
keeps answering it. It is not what an iteration should hill-climb on. The byte
score is not a distance: an edit that fixes the cause of a residual rotates the
register assignment downstream of it and scores *worse* than one that froze a
wrong schedule into a lucky assignment, so a greedy loop keeps the wrong one.
It is also global, one number for the whole function, so nothing can tell that
a variant fixed one block and disturbed another.

`residualObjective.ts` scores candidates on the staged, per-block residual
instead:

```bash
npx tsx tools/agent/residualObjective.ts <function>
npx tsx tools/agent/residualObjective.ts <function> --dir build/variants --block 6
```

```
  variant              verdict    words    cfg  pop  sched  alloc  b2      b3     b6     b8
  baseline             baseline   220/263  0    0    10     35     0/5/19  0/1/2  0/2/4  0/2/10
  v1:v1-hoist-len.c    traded     222/260  0    0    12     32     0/5/19  0/1/2  0/3/4  0/3/7
  v2:v2-hoist-first.c  identical  220/263  0    0    10     35     0/5/19  0/1/2  0/2/4  0/2/10

NEXT: block 6 (0x80021128) — population 0, schedule 2, allocation 4
      same residual shape as block 8 — one source fix should close all of them
```

The v1 row is the whole argument: two more matching words, and further from
the target. The terms are compared lexicographically in the order the passes
run — control flow, then instruction population, then schedule, then
allocation — because allocation is downstream of the sched1 order and any
agreement bought by a worse schedule is coincidental.

Six verdicts, each a distinct instruction to a caller:

| Verdict | Meaning |
|---|---|
| `EXACT` | the bytes match; confirm with `diffFunc` and finalize |
| `better` | strictly closer on the staged key |
| `traded` | lost an earlier term, won a later one — keep it as a branch, do not discard |
| `same` | different code, same residual |
| `identical` | byte-identical output; not a new experiment, so do not count it as one |
| `worse` | strictly further |

`NEXT` names the block to work and which other blocks the same fix should
close. Blocks whose residual has the same shape are one work item: cases of a
switch that differ only in a constant produce the same difference twice.

The variant laboratory and the shape searcher rank on the same key, and the
autonomous loop reports it to each turn in place of the word count.

### Step 5: compare a small set of hypotheses

`fuzzVariants.ts` is a variant laboratory. It is not a source permuter. A JSON
manifest records each complete C variant. Each record holds the mechanism, the
expected pass, the expected effect, and the invariants.

```bash
npx tsx tools/agent/fuzzVariants.ts <function> --manifest build/hypotheses.json --trace-passes
```

`--trace-passes` compares the passes from `rtl` through `dbr`. The run
directory keeps:

- the exact sources;
- the preprocessed files;
- the `cc1` output and the object files;
- the flags and the hashes;
- the normalized comparisons and the verdicts.

The verdicts rank causal evidence above instruction counts. The pass diffs
report a change of loop depth that touches metadata only. They also report
whether the change added executable loop control. A cc1-only result is never
eligible for promotion. Repeat the same hypothesis in full mode first.

The run reports byte exactness apart from the verdict. The two answer
different questions:

- The verdict says whether the stated mechanism happened.
- `exactCandidate` says whether the code came out the same.

A run starts with a `BYTE-EXACT CANDIDATE FOUND` banner if any candidate is
exact. The banner names each exact result, its preserved source, and the next
command. The banner appears even when the verdict beside it reads
`inconclusive`. That verdict is normal when pass tracing is off.

An exact score with an unresolved relocation is not exact. Two calls to
different symbols look the same before the link step. Only the relocation
record separates them.

The `sdk-call-order` template covers one axis. A general search prices that
axis at a high cost. A bounded batch settles it at once. The axis is the birth
order of adjacent PSY-Q macro calls.

- The specification names the region.
- The header supplies the admissible orders, through its verified field
  effects.
- Each macro call moves as one unit. The stores inside one expansion belong to
  the macro, not to a statement list.

### Step 6: accept the result

The oracle is `diffFunc.ts`. It compiles one function, relocates the object to
the original addresses, and compares it with the original bytes. It reports
MATCH, MISMATCH, or UNDETERMINED.

It is no longer a registered tool. Two things replaced it, and each is better
at one half of its old job: `residualObjective.ts` reports the same verdict
from the same oracle at the same cost, plus a residual that is a distance,
which its score was not; and `psx_finalize_function` is the terminal gate — the
exact diff plus the linked build, the scope check, and the clean-source check.
A pre-link byte comparison is not a finish line, and a score that rewards a
lucky register assignment over a fixed cause is not a gradient. The CLI stays,
and the build, the gates, and the autonomous loop still call it;
`.pi/extensions/psx-decomp/tools/diagnostics.ts` records the exclusion and the
reason, and a test keeps it honest.

`psx_finalize_function` is the last gate. It runs the exact function diff, the
full binary check, the scope check, and the clean-source check.

### Registered tools

The extension registers one Pi tool for each CLI under `tools/agent/`. A test
fails if a CLI has no tool. Pi bounds the output of each tool before the
output enters the model context.

## The autonomous loop

The supervisor is in `.pi/extensions/psx-decomp/autonomous/`. It is
deterministic. It runs short-lived Pi workers in isolation, gates their
patches, and schedules the work.

Control it from Pi:

```text
/autodecomp start
/autodecomp status
/autodecomp pause
/autodecomp resume
/autodecomp stop
/autodecomp retry <function-or-vram>
/autodecomp skip <function-or-vram>
/autodecomp unblock <function-or-vram>
/autodecomp logs
```

Or run it from a shell:

```bash
npm run autodecomp -- start
npm run autodecomp -- start --dry-run
npm run autodecomp -- start --once
npm run autodecomp -- status
```

The configuration is `.pi/autodecomp.json`. The supervisor writes its state,
its Pi sessions, its patches, and its reports to `run_output/autodecomp/`. Git
ignores that directory.

Make the tracked tree clean before the first start. The supervisor uses
sequential detached git worktrees. It applies an accepted patch to the main
checkout as one transaction, and then checks the patch again. It never commits
a patch. A failed patch stays in the runtime directory. A failed patch cannot
make the main checkout dirty.

A detached run mirrors three streams into one append-only file: the Pi worker
JSON, the worker stderr, and the controller events. Follow the file:

```bash
tail -F run_output/autodecomp/controller.log
```

To detach and attach a terminal, run the foreground controller inside `tmux`:

```bash
tmux new-session -s autodecomp 'npm run autodecomp -- start'
tmux attach-session -t autodecomp
```

The foreground controller mirrors each worker stream to that terminal.

**Warning:** a gate that checks bytes only rewards embedded assembly, register
pins, and flag overrides. The skills refuse those results. They ask for a
classified report of the obstacle instead. Read
`notes/retros/2026-08-09-asm-folding-root-cause-retro.md` before you match
more functions.

## The `make split` pipeline

Splat alone cannot process this binary. Three properties stop it: the PSY-Q
libraries, the references between files, and the BSS layout. Therefore
`make split` runs this sequence:

1. `bootstrap.ts` generates the configuration files if they are absent. It
   does nothing if they exist.
2. `mergeFragments.ts`, `addLibSymbols.ts`, `patchSplatForLibs.ts`, and
   `addDepObjects.ts` fold the detected PSY-Q library objects into the splat
   configuration.
3. `splat split` runs with `SPIMDISASM_ARCHLEVEL=1`.
4. `fixCrossFileRefs.ts` resolves the symbols that span fragments. The split
   repeats up to three times.
5. `patchLinkerBss.ts` and `patchLibBss.ts` reproduce the BSS allocation of
   PSYLINK. PSYLINK allocates each symbol independently.
6. The pipeline appends the generated `undefined_funcs` and `syms` includes to
   `slus_011.ld`.
7. `classifyGlobals.ts` classifies each global as GP-relative or absolute, and
   writes `globals.h`.
8. `contextExport.ts --all` refreshes `functions.h`.

## Tools inventory

| Directory | Contents |
|---|---|
| `.pi/` | The Pi commands, the PlayStation skills, the tool wrappers, and the autonomous supervisor |
| `tools/agent/` | The decompilation tools. See the list below |
| `tools/build/` | The `make split` pipeline |
| `tools/diagnostics/` | `progress.ts`, `diffBinary.ts`, `headerInfo.ts`, `matchSignatures.ts` |
| `tools/lib/` | `psxExeInfo.ts` (shared binary constants), `symbolIndex.ts` (address and symbol lookup), `functionOracle.ts` (the byte comparison that `diffFunc.ts` reports) |
| `tools/vendor/` | The vendored repositories |

The main tools under `tools/agent/` are:

| Tool | Role |
|---|---|
| `callGraph.ts` | Builds the worklist and ranks it |
| `m2cFunc.ts` | Runs m2c on one function |
| `triage.ts` | Runs the pre-flight detectors |
| `sdkIdioms.ts` | Recognizes the PSY-Q packets in the target |
| `flagProbe.ts` | Checks the per-file flag hypothesis |
| `diffFunc.ts` | The oracle |
| `explainDiff.ts` | Classifies a structural mismatch |
| `compilerTrace.ts` | Shows the internal state of GCC |
| `analyzeTargetSchedule.ts` | Derives the scheduling requirements |
| `analyzeAllocatorCounterfactual.ts` | Derives the allocation requirements |
| `instrumentCompilerOracle.ts` | Builds the instrumented `cc1` |
| `searchSchedulerState.ts` | Searches the scheduler state |
| `searchSourceShapes.ts` | Searches an explicit finite grammar |
| `synthesizeSourceShapes.ts` | Derives a grammar from the requirements |
| `searchResidualSourceSpace.ts` | Searches the residual source space automatically |
| `reversePipeline.ts` | Runs the compiler backward and names the pass that owns the residual |
| `residualObjective.ts` | Scores and ranks candidate sources on the staged residual — the iteration metric |
| `fuzzVariants.ts` | Compares mechanism hypotheses |
| `contextExport.ts` | Exports the matched signatures |
| `sourcePolicy.ts` | Audits the sources for forbidden constructs |

For the full list, read `notes/tools-directory-structure.md`.

### Git submodules

| Path | Repository | Purpose |
|---|---|---|
| `tools/vendor/old-gcc` | decompals/old-gcc | GCC builds with Docker |
| `tools/vendor/maspsx` | mkst/maspsx | The ASPSX emulator |
| `tools/vendor/m2c` | matt-kempster/m2c | The MIPS-to-C decompiler |
| `tools/vendor/psx_psyq_signatures` | lab313ru | SDK byte signatures |

These directories are vendored but are not submodules: `tools/vendor/psyq47`,
`tools/vendor/psyq_sdk` (holds the original `CC1PSX.EXE`),
`tools/vendor/homebrew-psyq`, `tools/vendor/silent-hill-decomp` (a reference
project), and `tools/vendor/splat_ext`.

## Notes index

Read the relevant note before you change anything fundamental.

| Note | Subject |
|---|---|
| `compiler-identification.md` | How the strings and patterns identified PSY-Q |
| `toolchain-version-detection.md` | The proof of version 2.95.2 |
| `bootstrapping.md` | How the project started (GP discovery, sections) |
| `adr-0001-symbol-addressing-at-the-assembler-boundary.md` | How the code addresses a global |
| `research/symbol-boundary-verification.md` | How to prove that a symbol is a function |
| `maspsx-issue.md`, `maspsx-issue2.md` | Known differences in the ASPSX emulation |
| `scheduling-breakage.md` | The effect of `-fno-schedule-insns` (134 functions regress) |
| `psyq-detection.md`, `rom_info/` | How the tools detect the SDK and its libraries |
| `file-groupings.md` | Which functions share a translation unit |
| `tools-directory-structure.md` | The full tool list |
| `retros/` | One write-up for each solved problem |
| `human-needed-approvals/` | Decisions that wait for a human |
| `thoughts-on-automated-decomp.md` | The design of the agent pipeline |
| `decompilation-tooling-ideas.md` | Observability tools, their use, and their limits |

`prompts/c-style-guide.md` holds the always-applicable matching rules; the
per-pass mechanism sheets are in `prompts/reference/`, served by `psx_reference`
when the pipeline reversal names the owning pass. Read the guide before you write
C for this project.

## Rules

- Do not commit `extracted/` or `build/`.
- Write tools in TypeScript, and run them with `npx tsx`. Do not commit Python
  scripts.
- Write C89 only. Put the declarations at the top of a block. Use `/* */`
  comments.
- Do not declare a `D_XXXXXXXX` global again in a `.c` file. The declarations
  come from `globals.h`. Put a struct type for a global in
  `globals_override.h`.
- Do not edit a generated file. Change its source configuration, then generate
  the file again.
- Commit only when the user asks for a commit.
