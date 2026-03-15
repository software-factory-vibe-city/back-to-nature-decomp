# Automated Decompilation Pipeline — Design Doc

## Overview

Byte-matching decompilation of SLUS-01115 (PS1, GCC 2.8.0, PSY-Q 4.60+). 463 game functions remain. The pipeline processes them bottom-up through the call graph, accumulating type context as it goes.

## Pipeline Stages

```
                    ┌─────────────────────────────────────────────┐
                    │          callGraph.ts (built)                │
                    │  Produces prioritized function ordering      │
                    └──────────────────┬──────────────────────────┘
                                       │
                    ┌──────────────────▼──────────────────────────┐
                    │            Orchestrator Loop                 │
                    │  For each function in priority order:        │
                    │                                              │
                    │  ┌────────────────────────────────────────┐  │
                    │  │ Stage 1: DECOMPILE                     │  │
                    │  │ m2c → initial C, slotted into src/*.c  │  │
                    │  └──────────────┬─────────────────────────┘  │
                    │                 │                             │
                    │  ┌──────────────▼─────────────────────────┐  │
                    │  │ Stage 2: MATCH                         │  │
                    │  │ LLM loop: compile → diff → fix → retry │  │
                    │  │ Exit: 100% byte match                  │  │
                    │  └──────────────┬─────────────────────────┘  │
                    │                 │                             │
                    │  ┌──────────────▼─────────────────────────┐  │
                    │  │ Stage 3: LOCAL CLEANUP                 │  │
                    │  │ Rename vars, add comments, constants   │  │
                    │  │ Must still byte-match after each edit  │  │
                    │  └──────────────┬─────────────────────────┘  │
                    │                 │                             │
                    │  ┌──────────────▼─────────────────────────┐  │
                    │  │ Stage 4: CONTEXT EXPORT                │  │
                    │  │ Extract signature, types, struct info  │  │
                    │  │ Feed forward to future functions       │  │
                    │  └──────────────┬─────────────────────────┘  │
                    │                 │                             │
                    └─────────────────┼───────────────────────────┘
                                      │
                    ┌─────────────────▼───────────────────────────┐
                    │ Stage 5: GLOBAL REFINEMENT (periodic)        │
                    │ Revisit solved functions when neighbors are  │
                    │ newly solved — propagate types, rename,      │
                    │ improve readability with new context          │
                    └─────────────────────────────────────────────┘
```

## Stage Details

### Stage 1: Decompile (mechanical, no LLM)

**Input:** `build/asm/nonmatchings/{name}/{name}.s` + accumulated type context
**Output:** Initial C in `src/{name}.c` replacing the `INCLUDE_ASM` stub
**Tool:** `tools/m2cFunc.ts` wrapping m2c with `--target mipsel-gcc-c`

m2c produces structurally correct but ugly C. Quality depends on available type info:
- **Early functions (Tier 1 leaves):** No callee signatures available. m2c guesses types from register usage. Output is rough.
- **Later functions (Tier 2-3):** Callee signatures known from prior work. m2c output is much better.

m2c invocation includes:
- Any known function signatures (from `include/` headers or accumulated context)
- Known global variable types
- Struct definitions inferred so far
- Auto-detected `include/functions.h` for `--context` if it exists

**This stage is deterministic and fast.** Run `npx tsx tools/m2cFunc.ts {name} --write`, done. The output does NOT include `include_asm.h` since the function is being decompiled to real C.

Handles named symbols (like `__start`) where the `.s` filename differs from the function name — resolves the actual `.s` file and passes the correct `-f` flag to m2c.

### Stage 2: Match (LLM agent loop)

**Input:** m2c output in `src/{name}.c` + original assembly + diff output
**Output:** Byte-matching C code
**Tool:** LLM agent with bash access, using `diffFunc.ts` as oracle
**Prompt:** `prompts/decompilation-cleanup-agent.md` (injected via `tools/getPrompt.ts`)

The core loop:

```
while match < 100%:
    run diffFunc.ts → get match % and assembly diff
    if match == 100%: done
    analyze diff, modify src/{name}.c
    repeat
```

**What the LLM needs to know** (all provided in the prompt):
- GCC 2.8.0 codegen quirks (register allocation from variable declaration order, loop structure differences, cast effects on signed/unsigned instructions)
- `-O2 -mips1 -G8` optimization behavior
- m2c failure patterns (`?` types, `->unkXX`, `M2C_BREAK`, `saved_reg_XX`, pointer arithmetic errors)
- MIPS R3000 assembly reading (addressing modes, delay slots, calling conventions)
- How to look up PSY-Q SDK signatures via `grep -rn` in `include/psyq/`
- The `timeout 5 npx tsx tools/diffFunc.ts {name}` command as the sole feedback loop

**What the LLM does NOT need to know:**
- What the function actually does (semantic understanding is Stage 3)
- Variable names (everything can be `temp_XX`, `var_XX` at this stage)
- `include_asm.h` or the INCLUDE_ASM mechanism (irrelevant to its task)

**The agent's only goal is 100% match.** No bail out, no "best effort." It keeps iterating.

**Failure modes:**
- LLM gets stuck in a loop making the same changes. Mitigation: track diff history, detect cycles, try fundamentally different approaches (restructure control flow, change variable types).
- m2c output is too far off. Mitigation: agent can rewrite from scratch using the assembly directly.
- Function requires specific compiler intrinsics or inline asm. Mitigation: the prompt teaches `asm()` blocks for `break` instructions and handwritten patterns.

### Stage 3: Local Cleanup (LLM agent, single pass)

**Input:** Byte-matching C code (ugly, auto-generated variable names)
**Output:** Byte-matching C code (readable, meaningful names)

**Safe transforms (no recompile needed):**
- Rename local variables and parameters to meaningful names
- Add a one-line function comment
- Replace magic numbers with `#define` constants
- Add inline comments for non-obvious logic

**Risky transforms (require recompile check):**
- Replace `while(1) { ... if(cond) break; }` with `do { ... } while(!cond);`
- Factor repeated expressions into named locals
- Change `int` to more specific types (`short`, `unsigned`)

For risky transforms, the loop is: apply transform → compile → check match → keep or revert.

**Agent interface:** Same as Stage 2, but different system prompt. The LLM here needs:
- The original assembly (for understanding what the function does)
- PSY-Q header context (to identify SDK call patterns)
- Any known struct/type context from prior functions
- Knowledge of what the game is (PS1 game, likely 3D, uses GTE/GPU/SPU)

### Stage 4: Context Export (mechanical, no LLM)

**Input:** Cleaned-up, byte-matching C code
**Output:** Updated type context for future functions

After each function is solved, extract and persist:

| Artifact | Where | Example |
|----------|-------|---------|
| Function signature | `include/functions.h` (new) | `void func_80011F08(int mode);` |
| Struct definitions | `include/game_types.h` (new) | `typedef struct { GsOT ot; ... } GameState;` |
| Global variable types | `configs/symbol_addrs.txt` | `D_8005E51C = 0x8005E51C; // type:int` |
| Function renames | `configs/symbol_addrs.txt` | `setGameMode = 0x80011F08;` |

This is mostly a bookkeeping step. Could be partially automated (extract function signature from the C file, add to header) or done by the cleanup LLM as part of Stage 3.

### Stage 5: Global Refinement (periodic LLM pass)

**Trigger:** When a function's caller or callee is newly decompiled.
**Input:** Previously solved function + new type context from neighbors
**Output:** Improved version (still byte-matching)

Examples of what this catches:
- `param1` was called `a0` in func_A. Now func_B (which calls func_A) reveals it always passes a `GsOT*` → rename to `orderingTable`
- Three functions all access fields at the same offsets from a pointer → define a shared struct
- A global `D_8005E51C` was `int` but now we see it's used as an enum flag → update type

**When to run:**
- After solving a batch of related functions (e.g., all Tier 1 leaves)
- When a high-caller-count function is solved (many dependents get new context)
- On demand for a specific cluster of functions

**This stage is lower priority.** Get matching code first (Stages 1-4), refine later. But the infrastructure should support it from the start — the call graph edges tell you exactly which functions to revisit.

## Implemented Infrastructure

| Component | Status | Location |
|-----------|--------|----------|
| Call graph + priority | **Done** | `tools/callGraph.ts` → `build/callGraph.json` |
| m2c function wrapper | **Done** | `tools/m2cFunc.ts` — runs m2c on a single function, handles named symbols, auto-detects context header |
| Orchestrator | **Done** | `tools/orchestrator.ts` — dry-run by default (`--write` to modify src/), supports `--top N`, `--func`, `--stage` filtering. Stages 2-4 stubbed. |
| Stage 2 agent prompt | **Done** | `prompts/decompilation-cleanup-agent.md` — complete prompt with m2c fix catalog, GCC quirk reference, assembly reading guide, iteration workflow |
| Stage 5 refinement prompt | **Done** | `prompts/global-refinement-agent.md` — per-function refinement with neighbor context |
| Project refinement prompt | **Done** | `prompts/project-refinement-agent.md` — holistic codebase pass: structs, renames, types |
| Prompt injection | **Done** | `tools/getPrompt.ts` — reads template, injects per-function or project-wide context at `{{CONTEXT}}` marker. Supports `--refine` and `--project` modes. |
| Agent loop | **Done** | `tools/agent-loop.ts` — generic LLM agent loop via pi-coding-agent SDK with retry + success check |
| Context export | **Done** | `tools/contextExport.ts` — extracts signatures from decompiled C into `include/functions.h` |
| Function diff oracle | **Done** | `tools/diffFunc.ts` |
| Progress tracking | **Done** | `tools/progress.ts` |
| m2c decompiler | Available | `tools/m2c/` (submodule) |
| PSY-Q headers | Available | `include/psyq/` (70+ headers) |
| GTE macros | Available | `include/gte_macros.inc` |
| Compile pipeline | **Done** | `Makefile` (cpp → cc1 → maspsx → as → ld) |
| Binary verification | **Done** | `make check` (SHA-256) |

## What Still Needs to Be Built

| Component | Description | Complexity |
|-----------|-------------|------------|
| Stage 3 cleanup prompt | System prompt for local cleanup agent (rename vars, add comments while maintaining match) | Small |
| Cycle handling | Strategy for mutually-recursive Tier 3 functions | Small |

## What's Been Built

| Component | Description | Location |
|-----------|-------------|----------|
| Agent framework integration | LLM agent loop via pi-coding-agent SDK | `tools/agent-loop.ts` |
| Stage 2 matching agent | Full prompt + orchestrator integration | `prompts/decompilation-cleanup-agent.md` |
| Stage 4 context export | Extract function signatures into `include/functions.h` | `tools/contextExport.ts` |
| Stage 5 per-function refinement | Prompt + orchestrator integration, hash-based tracking | `prompts/global-refinement-agent.md` |
| Project-wide refinement | Holistic pass: structs, renames, type consistency | `prompts/project-refinement-agent.md` |
| Prompt builder | Injects context into prompt templates | `tools/getPrompt.ts` |

## Design Decisions Made

1. **Non-destructive default:** The orchestrator runs in dry-run mode by default (outputs to `build/pipeline/`). Use `--write` to modify `src/` files. Consistent with other tools (`addLibSymbols.ts`, `patchSplatForLibs.ts`).

2. **m2c output does not include `include_asm.h`:** Once a function is decompiled, the `INCLUDE_ASM` mechanism is replaced by real C. The decompiled files only need `#include "common.h"`.

3. **Agent prompt is a static template with injection:** `prompts/decompilation-cleanup-agent.md` contains the full prompt with a `{{CONTEXT}}` marker. `tools/getPrompt.ts` reads the template and injects per-function context (assembly, m2c output, call graph entry). This keeps the prompt version-controlled and the injection logic testable.

4. **m2c target is `mipsel-gcc-c`:** Not `mips-psx-gcc` (which doesn't exist in m2c). Little-endian MIPS, GCC compiler, C language.

5. **Named symbol handling:** Functions like `__start` have a directory name matching the symbol but the `.s` file inside uses the address-based name (`func_80011278.s`). All tools (m2cFunc, orchestrator, getPrompt) resolve this by falling back to the actual `.s` file in the directory.

6. **Agent must achieve 100% match:** No bail-out, no "best effort." The matching agent's only acceptable outcome is `Match: N/N (100.0%)`.

7. **Agent uses one feedback command:** `timeout 5 npx tsx tools/diffFunc.ts {FUNC_NAME}` is the single compile+diff command. No separate make step needed since diffFunc compiles internally.

8. **callGraph.ts decompiled detection:** Fixed to check for ANY `INCLUDE_ASM(` in the file, not just `INCLUDE_ASM` containing the entry's own name. This handles named symbols whose INCLUDE_ASM references the address-based name.

## Open Questions

1. **Batching vs sequential:** Process one function at a time, or run multiple Stage 2 agents in parallel on independent functions? Parallelism is safe within a tier (no dependencies), but context accumulation is lost.

2. **GTE functions:** Functions using GTE coprocessor instructions need special handling — inline assembly macros from `gte_macros.inc`. The matching prompt teaches `asm()` blocks but GTE patterns are complex. May need a specialized prompt or manual attention.

3. **Cycle handling in Tier 3:** ~10-15 functions form call cycles. These can't be processed strictly bottom-up. Process the smallest function in the cycle first, or attempt them as a group?

## Resolved Questions

- **Agent framework:** Uses pi-coding-agent SDK via `tools/agent-loop.ts`. Configured via `AGENT` env var.
- **Stage 5 trigger policy:** Runs automatically at end of normal pipeline. Hash-based markers track which neighbor set a function was refined with — re-triggers when new neighbors are decompiled. Project-wide refinement is manual (`--project-refine`).
