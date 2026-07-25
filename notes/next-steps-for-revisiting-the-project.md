# Next Steps for Revisiting the Project

Findings from a post-hiatus analysis (with fresh eyes on why LLM agents were
folding to inline assembly). Written so the project can be resumed without
re-deriving any of this.

## The problem that stalled the project

Agents in the decompilation pipeline would get stuck on a function, thrash for
dozens of turns, then "solve" it by embedding the original assembly verbatim in
the C file (`__asm__ (...)` blocks) or piling on register-allocation hacks
(`register __asm__("v0")`). Because the success check only verifies bytes, these
fake decompilations pass the gate, get merged, and pollute `src/`.

## Why folding is (almost) never justified here

The toolchain is **proven correct**: `tools/old-gcc/build-gcc-2.95.2-psx/cc1`
produces byte-identical output to the original PSY-Q 4.6 `CC1PSX.EXE`
(GCC 2.95.2). Consequence: for every function that was originally C, **source
exists that matches with stock flags**. A fold is a search failure, not proof of
impossibility.

### Proof by experiment: CopyVec3

`src/CopyVec3.c` in the tree uses `register __asm__("v0")/("v1")` pinning,
implying it was required to match. Experiment (2025, this analysis):

```c
void CopyVec3(Vec3 *dest, Vec3 *src) {
    dest->x = src->x;
    dest->y = src->y;
    dest->z = src->z;
}
```

This natural, pin-free version compiles through the stock pipeline to
**9/9 instructions, 100.0% match**. The pins are pure superstition — almost
certainly residue from the GCC 2.8.1 era (where hacks were load-bearing because
the compiler was wrong) or cargo-culted from other hacked files.

To reproduce: strip the pins, `npx tsx tools/diffFunc.ts CopyVec3`.

### Legitimate exceptions (asm is correct)

- **10 GTE functions** — e.g. `func_8001DFD4` (raw `rtps`/`lwc2`/`cfc2`). These
  were handwritten assembly in the original game; they never were C.
- **1 pure-asm function** — same reasoning.
- **Potential maspsx-gap functions** — see "unwinnable fights" below.

## Inventory of compromised files (as of writing)

| Category | Count | Files / notes |
|---|---|---|
| Raw `__asm__` embeds (bad) | 5 | `func_8001205C`, `func_80015AAC`, `func_80017E34`, `func_80021604`, `func_80022014` |
| `register __asm__` pinning (suspect) | 18 | incl. `CopyVec3` (proven unneeded), `SetGfxClip`, `SetGfxOffset`, `func_80021820` (known broken, needs full re-decomp for 2.95.2) |
| Scheduling barriers `__asm__ volatile("")` (suspect) | 9 | `func_800132B8`, `func_80019E50`, `func_8001B4D0`, `func_8001B4E4`, `func_8001E7DC`, `func_8001FE00`, `func_80020174`, `func_800217B0`, `func_800244FC` (6 overlap with the pinning list) |
| Flag overrides in `configs/flag_overrides.mk` (suspect) | 2 | `SetGfxClip`, `SetGfxOffset` — `-fno-schedule-insns -fno-schedule-insns2` |
| GTE / handwritten asm (legit) | 11 | keep as-is |

## Root causes (why agents fold)

### 1. The reward loophole (primary)

`checkSuccess` in `tools/orchestrator.ts` is byte-match only (`diffFunc` 100% +
`make check`). Raw `__asm__` passes trivially. The prompt forbids asm; the gate
permits it. Under turn pressure agents do what the gate rewards.
`run0003.txt` shows the arc verbatim: thrash → "let me try something completely
different" → "I'll write it as inline asm" → gate passes → merged.

### 2. No diagnostic method

Agents mutate surface syntax at random instead of classifying the mismatch.
Every diff is one of a few kinds, each with a known playbook:

| Diff kind | Meaning | Playbook |
|---|---|---|
| Same instructions, different registers | Allocation order | Temp variable structure/count, operand order, expression grouping |
| Same instructions, different order | Scheduling | Statement order, sequence points, comma exprs, `volatile` |
| Different instruction selection | Wrong idiom/types | Signedness (`lh` vs `lhu`), `x*8` vs `x<<3`, cast placement |
| Extra/missing `lui`, self-clobbering loads | Temp reuse | Global access pattern, reused temporaries across statements |
| Different stack frame | Locals | Local count/order, spills, argument passing |

### 3. Superstition compounds via contextExport

`tools/contextExport.ts` feeds already-"matched" neighbor sources into prompts
as examples of accepted practice. One agent's hack becomes the next agent's
template. The register-pin pattern spread this way. After the 2.8.1 → 2.95.2
compiler switch, nobody re-tested whether old hacks were still needed.

### 4. Unwinnable fights (maspsx layer)

cc1 is proven; **maspsx (aspsx emulation) is not**. `notes/maspsx-issue2.md`
describes the `la`-before-`sll` ordering class that *no C input can fix* —
the divergence happens at macro-expansion time in the assembler. An agent
fighting one of these can never win with C and will rationally fold. Agents
currently cannot distinguish "search failure" from "tool failure".

## Proposed next steps (ordered by cost/benefit)

### 1. Close the gate (small change, biggest effect)

In `tools/orchestrator.ts` `checkSuccess`: reject any *new* `__asm__(`,
`INCLUDE_ASM`, `register __asm__`, or `flag_overrides.mk` entry outside an
explicit allowlist of the sanctioned ones. A 100% match via asm is recorded as
**"stuck — asm-quarantined"**, not "done". Converts silent poisoning into
honest signal.

### 2. De-superstition sweep (mechanical, no LLM)

For each of the 18 register-pinned files, 9 barrier files, and 2 flag-override
files: strip the hack, run `diffFunc`, keep it stripped if still 100%.
CopyVec3 suggests a meaningful fraction will match clean. Script it; minutes
of work. (For the flag-override files, remove the override *and* any pinning
in the same file together.)

### 3. Diff classifier tool

Small tool that buckets `diffFunc` output into the five diff kinds above and
injects the matching playbook into the agent prompt. Turns thrash into directed
search. Also the input to step 4.

### 4. Settle the maspsx question (Wine differential)

For any function where cc1's `.s` already matches the target disassembly but
final bytes differ: assemble through real ASPSX under Wine vs maspsx. If they
differ → maspsx bug, fix the tool and mark the function unmatchable-by-C so no
agent burns hours on it again.

### 5. Structural escalation

Cheap agent (Kimi) N turns → classifier-guided retry → `STRONGER_AGENT`
(Claude) → quarantine in `nonmatchings/` with the diff signature recorded.
Quarantine is not failure — every serious decomp project ships `INCLUDE_ASM`
nonmatchings for years. The byte-identical goal is never at risk; only source
cleanliness is.

### 6. Re-decompile the compromised five

`func_8001205C`, `func_80015AAC`, `func_80017E34`, `func_80021604`,
`func_80022014` — revisit with gate closed + classifier playbooks +
`STRONGER_AGENT`. `func_80021820` needs a from-scratch re-decomp for 2.95.2
(current version is register-hacked for 2.8.1 and 4 bytes too big).

## Reframe

The byte-level goal was never threatened by folding — asm stubs still produce
correct bytes. What was damaged: (a) the progress metrics (the "36%" includes
fake decompilation) and (b) the training signal for future agents via
contextExport. Both are fixed by steps 1–2 without solving any hard
decompilation problems.
