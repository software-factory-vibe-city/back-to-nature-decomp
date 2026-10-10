# BTN Decompilation

This project is a matching decompilation of *Harvest Moon: Back to Nature*
(SLUS-01115, PlayStation 1).

The goal is C source code that compiles to a byte-identical copy of the
original PS-X EXE. The build checks the result with SHA-256 each time.

### Terms

| Term | Meaning in this project |
|---|---|
| the original binary | The PS-X EXE payload in `extracted/iso/slus_011.15` |
| container | One binary the project builds: the PS-X EXE (`exe`) or one overlay member (`ovl_NN`) |
| overlay | A code member of the `a_file.bin` archive, loaded into a RAM slot at run time |
| the target | The original machine code of one function |
| the candidate | The machine code that our C source makes |
| to match | To be byte-identical to the target |
| function | One symbol in the original binary that holds code |
| live function | A function referenced from the PS-X EXE image or from any overlay member |
| dead function | A function no container references. Measured, not assumed: the unreferenced set is interleaved with live game code throughout the game region rather than clustered where statically linked library objects sit, so it is not "unused library code" |
| engine API | A PS-X EXE function that overlay code calls. 246 entry points; see `tools/diagnostics/engineApi.ts` |
| tool | One TypeScript program under `tools/` |
| report | One text or JSON output of a tool |
| the oracle | `diffFunc.ts`, which compares bytes with the original. It backs the tools rather than being one |
| stub | A `.c` file that includes the original assembly instead of C |

## Status

The numbers below come from `npx tsx tools/diagnostics/progress.ts` and from a
census of `src/`. The date of the measurement is 2026-08-21.

### Progress

Liveness is computed over every container. Before that correction the
denominator was the PS-X EXE alone, which classified 97 overlay-facing engine
functions as dead and excluded them; the percentage below is lower than the
previously published one because it is measured over the corrected denominator.

| Measurement | Value |
|---|---|
| Live functions that match | 264 of 347 (76.08%) |
| Live bytes that match | 48,704 of 62,200 (78.30%) |
| Dead functions (not counted) | 110 functions, 11,392 bytes |
| Engine API functions reached only from overlays | 94, of which 15 match |
| GTE functions (counted) | 10 |
| Pure assembly functions (not counted) | 1 |
| Files in `src/` | 464 |
| Files that are still a stub | 166 |

The PS-X EXE's game code is roughly 17% of the project's true target. The
thirteen overlay code members hold about five times as much game code again;
`plans/overlay-decompilation-enablement.md` records the measurement.

`make check` passes. The build makes a binary that matches the original
payload.

### Clean-source status

A byte match is a failure if it needs a workaround. The table shows every
workaround that the C sources still use.

| Construct | Files | Note |
|---|---|---|
| Hard-register pin | 8 | Each file has a `register-asm` entry in the allowlist |
| Empty assembly barrier | 7 | Permitted as a last resort. The configuration sets `allowEmptyMemoryBarrier`, so these files need no entry |
| Scratchpad stack switch | 1 | Assembly that does nothing but move `$sp`. No C construct can, so this is a classification rather than an exception: the configuration sets `allowStackPointerSwitch` and these files need no entry. The idiom itself is `SCRATCH_STACK_BEGIN`/`SCRATCH_STACK_END` in `include/scratchpad.h`; see `notes/research/scratchpad-stack-switch.md` |
| Assembly block with instructions | 5 | Each file has an `embedded-asm` entry |
| `CAPTURE_RA` debug hook | 2 | The hook is a target feature, not a workaround |
| Full function in assembly | 2 | The handwritten-assembly class |
| Per-file compiler flag | 1 | `func_80014494` uses `-fno-cse-skip-blocks` |

The allowlist is `.pi/autoloop.json`, key `sourcePolicy.allowlist`. Each
entry is the audit trail for one construct. The gate refuses a construct that
has no entry. Key an entry by the function's name. An address key must carry
its container, `<container>:<address>`, because overlays share RAM; the gate
honours a bare address only for the executable.

Fourteen functions are parked, each with a note in
`notes/human-needed-approvals/` saying what is known and what is left.
`run_output/autoloop/state.json` is the machine-readable list. A park is a
suspended attempt with its evidence attached, never a verdict that the function
is impossible: the two `ovl_10` parks are one instruction placement away, and
the note for each names the mechanism and what has been ruled out.

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

The SDK's converted archives lost some colliding eight-character member
names. On a cold tree, build [psyq2elf](https://gitlab.com/jype/psyq2elf) and
supply its executable when splitting:

```bash
PSYQ2ELF=/absolute/path/to/psyq2elf/psyq2elf make split
```

`splitSdkLibs.ts` recovers those members from the original SDK `.LIB` files
under `tools/vendor/psyq47/LIB/`. Recovered objects and the member/signature
map live only in `build/sdk/`; existing non-colliding `lib/` inputs stay
unchanged. Warm splits reuse the content-identified members and need no
converter. `make clean` removes them, so the next split needs the converter
again.

Put the original EXE at `extracted/iso/slus_011.15` before splitting. Git
ignores that path.

## Build commands

| Command | Result |
|---|---|
| `make` or `make check` | Builds the binary and checks the byte match. This is the default |
| `make split` | Runs the full splat pipeline. See "The `make split` pipeline" |
| `make split-sdk-libs` | Regenerates collision-safe SDK members/map under `build/sdk/`; cold recovery requires `PSYQ2ELF` |
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
.pi/                    Pi extension commands, skills, tools, and the in-session loop
notes/                  Research and write-ups. This is the project memory
prompts/                Per-pass mechanism sheets, and archived templates
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
in-code strategy selection defaults to dependency-ready/small-first: dependency
depth, instruction count, caller count, then container order. The original
container-first strategy remains available in `tools/agent/callGraphStrategies.ts`.
Eligibility and the loop's family deferrals are independent of this ranking.
The Pi extension reads the ranked graph.

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

The loop's ladder in `.pi/autoloop.json` accepts an optional `"role": "prep"`
on a tier. That tier uses the short `psx-prepare-function` skill and preparation
tools to get the m2c candidate compiling, publish types/overrides in the proper
headers, and restore supported SDK idioms. Its dedicated
`psx_loop_prep_handoff` reports the candidate, header work, compile result and
unresolved issues. The next tier receives that same refreshed packet and summary;
compilation is not a match. A prep tier must have a later matching tier. Omit
`role` to retain the existing matching behavior and matching handoff. When the
first tier is prep, the loop starts from the decompilation worklist and enters
prep before any completion/static-match shortcut; older pending documentation
remains saved but does not preempt that ladder.

### Autoloop context checkpoints

Each ladder entry accepts `"checkpointAtTokens": 350000` (the default when
omitted; `0` disables it for that agent). This replaces the removed top-level
`compactAtTokens` field. Thresholds measure current context tokens, not total
session spending, and are checked after each completed assistant/tool turn:

- At the threshold, queue one steering message asking for a checkpoint focused
  on the latest experiment, measured results, open premises and next action.
  Prefer CLM/live-context editing and evidence annotations when available. Emit
  a brief ordinary assistant summary too: native compaction reads raw history
  and resets CLM's edited projection.
- At 110% (385,000 for a 350,000 threshold), interrupt the run at that completed
  tool boundary, wait for idle, compact, and send a continuation on the same
  task and tier. Forced checkpoints do not consume the return budget or cause
  escalation. A tool batch may jump over both thresholds.
- Natural early returns retain idle compaction before the next dispatch when
  above that agent's threshold. Successful compaction or a measured context
  reduction re-arms the warning. Compaction failure/timeout stops the loop with
  work preserved rather than repeatedly interrupting an uncompacted context.

`/auto_decompilation_loop status` shows each agent's threshold. Run `/reload`
after changing the extension in an open session; configuration is read when a
loop starts.

The decompilation and resource commands never commit or merge. Commits require
a separate explicit user request.

The skills read the target and toolchain facts from
`configs/project-profile.md` and from the active configuration. They do not
hold the values of one project.

### Static preparation: original-code type propagation

Preparation recursively examines original callees, callbacks and relevant incoming
callers, with independently audited seeds and finite SCC/SSA constraint propagation.
Partial ABI-slot facts reach actual m2c inference; open dispatch targets never inherit
one member's whole callable signature. C/type inspection uses the pinned AST parser.
Raw output remains unchanged, and existing C stays primary on normal resume.

See `tools/agent/type-propagation/README.md` for bounds and limitations, and
`plans/static-decompilation/callgraph-type-propagation.md` for delivery evidence.
The bounded mechanism is implemented; the known-dependency acceptance gate is still
incomplete, including two noncompiling open-callback drafts. This is not a claim
that the reported reproduction is fixed.

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

### Branch orientation: inspect the jump pass, then measure the arms

Triage's `branch-orientation` signal locates an opposite-sense comparison with
result constants exchanged between delay slot and fallthrough, or an equivalent
Boolean store-flag in place of that branch. Register-only differences and
unknown/different comparison producers are excluded. This is a control-shape
experiment, not an allocator experiment:

```bash
npx tsx tools/agent/jumpTrace.ts <function> --source <path.c>
npx tsx tools/agent/controlShapeSweep.ts <function> --source <path.c> --max 64
```

`jumpTrace.ts` compares production expand/jump dumps. It reports structural
assignment/else hoists and Boolean folds with their exact SET/jump evidence;
unsupported pairs stay `undetermined`. It never invents an intermediate hoist
hidden by a fold. Later CSE/jump dump pairs span multiple passes and say so.
Triage binds attribution only through a survived UID's unique final comparison.

`controlShapeSweep.ts` uses tree-sitter to find a read-only decision suffix and
construct equivalent early returns, nested/short-circuit tests, duplicate return
arms at each level, result locals and a first-test switch. It preserves
short-circuit evaluation order and rejects effectful tests, escaped/qualified
result locals and macro-hidden tail changes. Complete candidates are policy
checked, compiled, jump traced and ranked with `residualObjective.ts`, located
block first. The cap reports bounded coverage explicitly. EXACT candidates and
reports stay under `build/controlShapeSweep/`; nothing is integrated into
`src/`. Pi exposes `psx_jump_trace` and `psx_control_shape_sweep`.

The residual source searcher separately prints reach caveats before its pilot:
which located blocks bind to statement/web axes, which fall outside order
regions, and which require return-arm construction its grammar cannot express.
Unknown line bindings remain undetermined; these warnings are not refusals.
Its projection uses the larger of the idle compile median and the contended
pilot cost, printing both. A worse input also names the ledger's preserved
better source/key before a long run, without assuming historical context is
still equivalent.

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

### Step 4d: watch the loop pass make its decisions

The reversal names the pass. For every pass but one, the next step is a model:
the scheduler solver, the allocator counterfactual, a source-space search.
`loop.c` is the exception — it logs its own decisions, `-dL` is in the vendored
`cc1`, and `loopTrace.ts` reads the log.

```bash
npx tsx tools/agent/loopTrace.ts <function>
npx tsx tools/agent/loopTrace.ts <function> --source <path>
npx tsx tools/agent/loopTrace.ts --threshold
```

It reports every loop-invariant candidate with its `savings`, `lifetime`, flags
and outcome; every induction variable with its combine chain and the pseudo it
became; and the preheader reassembled in emission order — movables in the order
the pass moved them, then the giv initialisations, per pass — which is the
layout a position-only preheader residual is about and which the assembly does
not show.

It also solves for `threshold`, which `loop.c` never prints. Both of the pass's
thresholds derive from one compilation-wide constant, so every decision in every
function constrains the same unknown; the running record lives in
`build/loopTrace/threshold.json`, and on this target it resolves to
`n_non_fixed_regs = 28`. Once it is a number, each decision is arithmetic: the
tool prints the `savings x lifetime` a movable needed against the one it had.

This is candidate-side. There is no loop dump for a binary nobody compiled, so
it cannot compare the two sides by itself. `analyzeTargetLoopEmission.ts` is the
other half — the requirement, derived from the target's bytes alone, so it works
on a bare `INCLUDE_ASM` stub:

```bash
npx tsx tools/agent/analyzeTargetLoopEmission.ts <function>
npx tsx tools/agent/analyzeTargetLoopEmission.ts <function> --source <candidate.c>
```

A preheader's **leaves** form a non-decreasing sequence of emission classes.
Producer groups are constrained only to be no later than their consumers, and
frame-map prologue/epilogue operations are excluded. Constants join to the trace
by value; giv inits join by affine initial value and step. The candidate's giv
assignments can condition the goals, while the source-induction alternative
stays visible with any fresh trace-verified ledger measurements. Goals are
scored MET / NOT MET / UNDETERMINED with a distance.

**Iterate on that distance, not the byte score.** On a preheader residual the
byte score is flat across the whole family of source spellings and inverted at
the top of it: the variant that puts the address on the required side of the
pass boundary can score dozens of words worse than variants that get the
mechanism wrong. `psx_reference loop` is the sheet for reading both tools.

Each goal also lists the **routes** by which the original can have reached a
pass-2 emission, with the target-side evidence that opens or closes each here.
Three exist and only two are about decisions the pass made: a value can decline
at pass 1 and be taken by pass 2, it can become a reduced giv — or it can be
hoisted out of a *nested* loop by pass 1 and re-hoisted by pass 2 of the
enclosing one. `scan_loop` cannot record a movable for an insn a loop pass
created, so that third route never faces pass 1's test at all, and a
desirability floor that closes the first says nothing about it. The trace
reports observed cascades outright, joining the pass-1 landing UID to the pass-2
movable that re-hoisted it.

Score a candidate and the two sides together can pin the answer: when exactly
one reading of the target's preheader holds every class the candidate produced,
the requirement has stopped being a range, and the report says `PINNED` and
names the routes that reading needs.

For a pass-1-decline route, both tools print the source-side inequality,
desirability slack and verified source-line window, including the movables whose
decisions must hold. Measure the access-route knobs rather than predict them:

```bash
npx tsx tools/agent/hoistKnobSweep.ts <function> --source <candidate.c> --max 64
```

`psx_hoist_knob_sweep` uses tree-sitter to enumerate reads through an invariant
single-assignment local address copy, including constant-offset expressions,
versus the global directly. Offsets retain their original casts and byte/element
units; variable offsets, pointer loads, escapes and expanded writes are refused.
It also automatically enumerates named record-array views already in the
input's preprocessed context. The production compiler measures their sizes,
field offsets and extents; only guarded, in-bounds byte-affine read equalities
license preparation. Raw/preprocessed function tokens must agree. Compatible
views become separate families, each with a fresh trace, window and site set;
the unchanged raw family is always retained. The report preserves layouts,
source ranges and affine/bounds proofs. No donor body or invented layout is used.

The combined product is measured up to the bound, otherwise reported as an
explicitly sampled fraction, globally and per family. Results rank by goals met
then staged residual. Sources, decisions and byte-oracle EXACT evidence stay
under `build/hoistKnobSweep/`; nothing edits or promotes live C. Meeting the
hoist goals is not itself EXACT.

Loop-count closures render as **OPEN PREMISE**, scoped to the measured source
hash: different pass-1 bodies can reach the same final loop. Record an alternate
measured source with `closedDirections.ts --source <path>`. Only an exhaustive,
fully measured sweep with no goal-meeting variant can retire that premise via
`--sweep-report <report.json>`, conditional on its source/context/representation
families and window/site sets; sampling, input/header drift, unknown decisions,
failed preparation and failed compiles cannot.

Two further readings come out of the same log. A loop the pass discarded prints
`Loop from A to B is phony.` and nothing else: it was never scanned, so its
silence about movables and givs is an absence rather than a decision.
`psx_triage`'s `phony-loop` detector raises it as a blocker — with the cause
read back from the dump's own RTL — when the residual is somewhere placement
decides, which is a block inside the nest or the preheader of one.

And a cluster-mate's trace is evidence about *this* function. `psx_triage`'s
`cluster-donor` detector runs the loop pass over every member of the group
`notes/file-groupings.md` records — a matched source or a preserved parked
attempt, tens of milliseconds each — against the union over this function's own
measured programs, one per distinct residual key from the ledger. It reports
where a sibling reduced a giv shape this program was refused, or reached a
pass-2 emission it has not, **and quotes the lines of C that produce it**.

Those line numbers come from a detail of `emit_note`: without `-g` it suppresses
the line note but still consumes the insn UID, so a `-g` compile numbers every
insn identically and its line notes can be read onto the ordinary compile's
UIDs. The tool compiles both and compares the instruction streams before
believing it; any difference and no line is quoted at all.

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
`.pi/extensions/psx-decomp/tools/diagnostics.ts` records the exclusion and the <!-- doc-ref-ignore: extension-rooted path -->
reason, and a test keeps it honest.

`psx_finalize_function` is the last gate. It runs the exact function diff, the
full binary check, the scope check, and the clean-source check.

### Registered tools

The extension registers one Pi tool for each CLI under `tools/agent/`. A test
fails if a CLI has no tool. Pi bounds the output of each tool before the
output enters the model context.

## Resource extraction

Known-format extraction is a deterministic build task: no model calls, agent
approval turns, run IDs or Git operations. Inputs default to `extracted/`.

```sh
npm run extract-assets
npm run extract-assets -- --input extracted/iso
npm run extract-assets -- --force            # bypass derivation caches
npm run extract-assets -- --full-verify      # additionally replay all derivations
npm run extract-assets -- --verify           # read-only full replay/publication check
npm run extract-assets -- --migrate-legacy   # explicit, ownership-checked cleanup
```

`npm run assets` is an alias. `--limits` accepts a JSON budget object;
`--schemas`/`--transforms` accept project-relative JSON files, with inline
`--schemas-json`/`--transforms-json` alternatives. `--help` lists the contracts.
Supplied archive schemas and the checked original-word byte-XOR constructor
remain conditional mechanisms, not general loader/decompressor recovery.

Browse **flat exported files** in `build/assets/extracted/images/`, `sounds/`,
`models/`, `videos/` or `data/`. Categories appear only when populated. Stable
content/interpretation identities deduplicate archive/member copies, retaining
all source occurrences and exact byte extents in `build/assets/manifest.json`.
`build/assets/index.json` is its browsable projection. Raw originals, RGBA/STP
and compressed ADPCM stay in content-addressed `build/assets/blobs/`, separate
from usable exports. Public files are copies, not hard links to backing objects.

Every successful extraction mechanically regenerates the complete, self-contained
`notes/asset-provenance.md`. It records original-input and implementation hashes,
variants, source chains, conditional assumptions and unresolved findings.
Identical warm/forced computations produce the same manifest, export names/bytes
and notes; warm cache hits skip scanning/parsing/decoding and do not rewrite
identical files. Missing/corrupt derivations are regenerated or rejected. Parser
fingerprints track actual runtime dependencies, not unrelated C edits or Git HEAD.
The catalog represents the selected scope, not a union of previous runs.
Failures before publication preserve the previous result; interrupted publication
is detectable with `--verify` and repaired by rerunning extraction. There is no
filesystem-wide atomic transaction spanning `build/` and `notes/`.

Supported formats are **TIM v1** (indexed/direct-color validation, RGBA, STP and
lossy PPM previews) and **XA revision 4** (2352-byte raw or 2336-byte stripped
sectors with surviving subheaders). XA audio exports native-rate 16-bit PCM WAV
per file/channel segment, preserving ADPCM separately. Interleave padding and
channel EOFs retain their correct behavior. All 32 streams in the four original
sector-preserving XA files match FFmpeg PCM exactly, including six silent streams.
Non-audio XA is data, not decoded STR/MDEC video. Weak stripped-sector signatures
with only one typed sector and padding remain candidate observations: no decode
or public export. Payload-only ISO extractions cannot restore lost coding/audio
bytes by guessing playback parameters or inserting zeros.
VAG/VAB, SEQ/SEP, TMD, STR/MDEC and proprietary formats remain unsupported; total
game asset count and historical semantic names are unknown.

After `/reload`, `/extract-resources` wraps the same command with **zero model
turns**. `/extract-resources --cancel` stops it. Parser development is separately
requested with `/build-resource-parser <format, original input/evidence, capability>`.
The builder skill loads once, writes only pure parser plugins/registrations/tests,
runs fixed-argv policy/typecheck/all-parser test gates and ordinary integration
extraction, then finishes at `parser-tested`. Drafts and unrelated work are never
automatically restored, reset or committed; closure does not summon another agent.
The extension owns four focused tools: `psx_resource_extract`,
`psx_resource_verify`, `psx_resource_analyze` and `psx_resource_parser`.

New formats register through `tools/agent/resource-extraction/parser-plugins.ts`;
core rewrites are unnecessary. `--migrate-legacy` archives recognized old runs,
requests and approval bookkeeping under `build/assets/cache/legacy/`, removes only
verified legacy presentation copies, and preserves edited/unknown files.
`notes/asset-identification.md` remains untouched historical material.
See `plans/deterministic-resource-extraction.md` for the implemented contract and
verification, and `plans/asset-extraction.md` for the retained broader format roadmap.

## The `make split` pipeline

Splat alone cannot process this binary. Three properties stop it: the PSY-Q
libraries, the references between files, and the BSS layout. Therefore
`make split` runs this sequence:

Before the pipeline, `splitSdkLibs.ts` prepares collision-safe SDK objects
and their signature-identity map under `build/sdk/`. `detectLibFunctions.ts`
returns a structured report, not a bare match array: matched-but-unverifiable
signatures are always visible and block generation unless explicitly
acknowledged in `configs/library-detection.json` for that exact binary,
signature, reason and hit set. Zero-relocation return/padding signatures do
not gain a placement from generated symbol names.

Audit all vendored signature versions (the unprovisioned versions are named,
not called verified):

```bash
npx tsx tools/build/detectLibFunctions.ts > build/sdk-detection.json
npx tsx tools/build/auditSdkCollisions.ts --detection build/sdk-detection.json
# Require object coverage for every version, rather than only the active SDK:
npx tsx tools/build/auditSdkCollisions.ts --require-all
```

1. `bootstrap.ts` generates the configuration files if they are absent. It
   does nothing if they exist.
2. `mergeFragments.ts`, `addLibSymbols.ts`, `patchSplatForLibs.ts`, and
   `addDepObjects.ts` fold the detected PSY-Q library objects into the splat
   configuration. After symbol integration, `disassemble.ts --container exe`
   refreshes the original-word function table so retired names/extents cannot
   survive in diagnostic censuses.
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

Overlay bootstrapping analyses `.rodata` and `.text` as separate sections.
Function-info rows can be switch fragments: the disassembler's symbol type
and owning-function metadata determine which rows are merged, and the recovered
extent is supplied to both the next disassembly pass and splat. Overlay builds
compile only configured C subsegments; retired fragment sources can remain on
disk for review without requiring nonexistent standalone assembly.

## Tools inventory

| Directory | Contents |
|---|---|
| `.pi/` | The Pi commands, the PlayStation skills, the tool wrappers, and the in-session loop |
| `tools/agent/` | The decompilation tools. See the list below |
| `tools/build/` | The `make split` pipeline |
| `tools/diagnostics/` | `progress.ts`, `diffBinary.ts`, `headerInfo.ts`, `matchSignatures.ts`, `benchmarkReconstruction.ts`, `coldContextEvaluation.ts`, `feedbackLoop.ts` |
| `tools/lib/` | `psxExeInfo.ts` (shared binary constants), `symbolIndex.ts` (address and symbol lookup), `functionOracle.ts` (the byte comparison that `diffFunc.ts` reports) |
| `tools/vendor/` | The vendored repositories |

The main tools under `tools/agent/` are:

| Tool | Role |
|---|---|
| `callGraph.ts` | Builds the worklist and ranks it |
| `m2cFunc.ts` | Prepares faithful context and original-code graph constraints, preserves the primary draft and measures it under the destination's real headers |
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
| `reconstructFunction.ts` | Reconstructs clean C from the original bytes alone — no source seed; explicit unresolved states outside its supported class |
| `familyTransfer.ts` | Finds a function's family by the shape of its original words, instantiates a matched member's C for it, and verifies every candidate through the byte oracle |
| `machineIr.ts` | The CFG / SSA / region view of the original words; its size is proportional to the graph, not to the paths through it |
| `recipeAtlas.ts` | Compiles a catalogue of small C constructions under the production flags and indexes what each emits, so a target's words can be looked up |
| `nearMissRepair.ts` | Places a residual in the target's own basic blocks and turns it into an ordered set of bounded source moves |
| `campaignRun.ts` | An unattended campaign to a fixed point; a recovery is published to the recovered-artifact overlay, requeues only its dependents, and everything unfinished gets a prepared bundle (`--overlay`, `--retract`) |
| `reversePipeline.ts` | Runs the compiler backward and names the pass that owns the residual |
| `jumpTrace.ts` | Attributes witnessed expand/jump rewrites; unsupported pairs stay undetermined |
| `controlShapeSweep.ts` | Measures bounded equivalent decision-tail forms, jump attribution and located residuals |
| `loopTrace.ts` | Reads the loop optimizer's own `-dL` log and solves for its unprinted threshold |
| `analyzeTargetLoopEmission.ts` | Derives what the original's loop pass must have done, and scores a candidate on it |
| `hoistKnobSweep.ts` | Measures invariant-base access routes against conditional hoist goals and staged residuals |
| `residualObjective.ts` | Scores and ranks candidate sources on the staged residual — the iteration metric |
| `fuzzVariants.ts` | Compares mechanism hypotheses |
| `contextExport.ts` | Exports the matched signatures |
| `fileGroupings.ts` | Reads suspected same-translation-unit membership out of the grouping ledger |
| `sourcePolicy.ts` | Audits the sources for forbidden constructs |
| `resourceExtract.ts` | Deterministic inventory/scan/decode, checked caches, flat deduplicated exports and generated provenance |
| `resourceVerify.ts` | Read-only full provenance/derivation/publication replay |
| `resourceAnalyze.ts` | Bounded original-word CFG/SSA observations and hex slices |
| `resourceParser.ts` | Parser-only baseline, pure-source/registration policy, fixed-argv typecheck/test gate; no commits |

For the full list, read `notes/tools-directory-structure.md`.

### Standalone macro-identity census

```sh
npm run macro-identity                         # every macro/COP2 detection
npm run macro-identity -- --json                # full per-function census
npm run macro-identity -- --function func_8001D6B8
npm run macro-identity -- --container ovl_11 --mine tier-b
```

`tools/diagnostics/macroIdentity.ts` mechanically extracts assembly macro
expansions from the SDK headers, `include/debughook.h` and
`include/scratchpad.h`, tiles original function bytes (including every
`INCLUDE_ASM` function), and emits operand bindings, header vintages, coverage
fractions, absorbed-nop counts and oracle-unverified candidate C call lists. Overlay scans are bounded by splat code subsegments;
SDK object-interior functions in the EXE are included. `--all` prints clean
functions too. `--headers PATH` is repeatable and replaces the default header
set. Tier-A asm recurrence mining and Tier-B instruction/effect recurrence
mining are opt-in (`--mine tier-a|tier-b|all`); bounds and incompleteness are
reported, never hidden. Identical whole-function bytes are reported separately.

The schema-v3 artifact states its scope, target-byte/source eligibility,
containers scanned, and extracted overlays skipped with their reasons. Missing
splat enablement means **unknown macro identity**, not zero macros. A separate
presence-only tier counts raw COP2/LWC2/SWC2 opcode words and clusters >=3 hits
per sliding 32-word window. Enabled containers are bounded to splat text;
unenabled extracted overlays are explicitly **unbounded** and may hit data.
`--container ovl_06` can report presence without enabling the container. Presence
hits never become function detections, tiler coverage or miner candidates.

Per-function and suspected-TU vintage findings retain ambiguity and group
alternative headers by shared macro definitions. Only different witnesses in
the same family establish mixing: `inline_c.h` plus `scratchpad.h` is normal
coexistence, not a mixed-SDK-vintage finding. The conversion queue puts existing
asm bodies first, then orders stubs by tiling fraction and
size; it is a worklist, not a claim that conversions have happened. Miner
verdicts are only `macro-candidate`, `compiler-explainable`, or `undetermined`;
Tier B's separate `claim: shared-source-shape` never promotes recurrence to
macro identity. Pattern accounting explains the first-seen/singleton bias when
the 200,000-pattern map cap is reached (separate instruction/effect maps), and
reports the independent output cap.

SDK DMPSX sentinel words are **not** final GTE encodings. The default detector
resolves command encodings through this repo's production pipeline: a real
`common.h` compile discovers the active assembler include graph, and probes
run through the configured cpp → cc1 → maspsx → GAS path. Here that graph
reaches `include/gte_macros.inc` through `include/macro.inc`. EXE and overlay
flag columns are measured separately. The report retains SDK literals and
records the local GAS definition, include hashes, flags and emitted object
bytes. No other decompilation project's replacement header is used.

Candidate C still needs SDK command `.word` placeholders replaced with the
corresponding local GAS mnemonics; including the `.inc` does not rewrite raw
`.word` literals. Diagnostic per-vintage substitution headers are emitted
under `build/macroIdentity/repo-encodings/` and listed in the report. Their
asm-block/clobber boundaries are preserved; include them after the matching
SDK vintage, with `common.h` supplying the assembler macros. They are not
integrated into live sources. `--raw-headers` explicitly disables the command
oracle for raw extraction diagnostics. The former `--encoding-header` option
has been removed.

Names without an unambiguous production GAS definition, parameterized command
expressions and non-asm computations remain explicit diagnostics. Unresolved
operands stay unresolved; stack names in candidates are symbolic, not recovered
C declarations.

The reusable API is exported without CLI side effects:

```ts
import { detectMacroIdentities, tileMacroFunction } from "./tools/diagnostics/macroIdentity.js"; // doc-ref-ignore: NodeNext resolves this to the .ts module
const report = detectMacroIdentities();
// Or inject functions: [{ name, container, vram, bytes: Buffer }], a template
// library, symbols and groups. tileMacroFunction handles one function directly.
```

Matches establish representation compatibility, not historical provenance.
Unexplained COP2 stays `undetermined`, never automatically handwritten. This
CLI does not edit source or grant asm exceptions. `callGraph.ts` and
`progress.ts` now consume the exported tiler verdict instead of assigning
`handwritten = "gte"`; COP2-bearing targets remain eligible and counted.
`triage.ts` pushes the tiling, vintage, operands and unverified candidate C
before source/allocator diagnostics, retaining encoding-toolchain provenance.
Preparation carries that result into `packet.json`, `handoff.md` and
`evidence.md`. Detected header macros (including reported compatible
alternatives) grant the agent a function-scoped exception to call them, even
when they expand to assembly—not to copy their bodies or write arbitrary asm.
No template match means no grant; calls still require full byte verification.
Independent handwritten classification still requires independent evidence.

### Same-value web-partition diagnostic

```sh
npm run web-partition -- func_80017F30 --target-only
npm run web-partition -- func_80017F30 --src build/attempt.c --json
npm run web-partition -- ovl_11_func_800BF450  # matched pins get an AST erasure probe
npm run web-partition -- ovl_11_func_8010BC54 # register-only near miss explained inline
npm run web-partition -- func_80017F30 --src build/attempt.c --probe-pins
npm run web-partition -- --audit
npm run web-partition-replay
```

The pure extractor in `tools/diagnostics/webPartition.ts` reads original words,
solves CFG reaching definitions and keeps copies as separate register webs.
Constants, high halves, addresses, loads with memory versions and call results
carry proven identities where available; joins, cycles, opaque words and load-delay
hazards remain undetermined. Candidate `.rtl`/`.lreg`/`.greg` data adds pseudo
sets, weighted references, lifetimes, assignments and UID births. Pre-reload
pseudos and final machine residences are deliberately separate layers.

Triage pushes named facts for semantically aligned allocation-majority residuals;
residual reporting shows named-fact progress after the staged key. Directives cite
mechanism sheets and distinguish clean closures from measured exception precedents.
They are hypotheses, not recovered C or automatic edits. The single-function CLI
reports the actual source's register/asm constructs and oracle verdict. A matched
pinned live source gets a separate local pin-erasure probe by default: an empty
diff of the original pinned source does not establish that the pins are needed.
`--probe-pins` explicitly requests the same probe for a `--src` candidate.
A byte-exact pin-erased candidate may still contain direct instruction asm or
file-scope bindings; the report names that debt instead of declaring clean C.
Only `build/` candidates are staged; live source and policy remain unchanged.
Probe output includes the actual differing instructions and word counts, not just
an artifact path. Correct-web/different-scratch assignments are a separate
allocator diagnostic, **not** spelling facts or progress. A unique typed memory
access can attach the candidate pseudo; reconstructed `.lreg` hard-register
intervals then expose overlaps hidden by final scheduling. For BC54, the probe
matches 35/37 words: `lhu`/`sh` use `v1` instead of `v0`; pseudo 96 overlaps the
return-zero SET at UID 75 before its store/death at UID 72. The report names this
ordering requirement and a focused local-allocation command, but does not claim
a verified clean-C spelling or a pin retirement. `REG_UNUSED` births and scratch
intervals crossing a subsequent call are excluded as unreliable evidence.
Unknown symbols receive nearby configured-name suggestions, never silent repair.
Machine weighted counts
are estimates, never `REG_N_REFS` thresholds; original reload costs cannot be
certified from bytes. The audit stages AST pin-erased candidates under
`build/webPartition/`, without integrating them or altering policy. An empty
observed diff is not a byte-match verdict or proof of pre-reload pseudo parity.

The historical replay passes the **4/5 named-first gate**, with zero unsupported
confident facts and passing negative controls. Bounded copy-contraction and
multi-SET expression-role certificates live in
`tools/diagnostics/webPartitionProof.ts`; unproved relations remain undetermined.
The original F3EF0 attempt is retained as a no-birth negative control; a separately
preserved, hash-checked cursor attempt supplies the positive birth case.
`func_8001E340` remains unaccepted without a private-weight witness. The replay
exits 2 if the count, evidence checks or controls fail.
See `plans/static-domain-detection/web-partition-fingerprinting.md` for measured
coverage and remaining limits; this is not a claim that the survey's residuals
are all diagnosed. The grandfathered `func_80020E38` bindings were independently
retired with byte-identity verification.

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

The always-applicable rules are in `AGENTS.md`. The per-pass mechanism sheets
are in `prompts/reference/`, served by `psx_reference`; the pipeline reversal
names the sheet for the pass that owns a residual.

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
