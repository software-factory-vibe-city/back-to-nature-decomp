# Retro: why agents folded to assembly, and what closed it

**Closed 2026-08-09.** This is the distilled postmortem of the failure mode
that stalled the project — agents "solving" a stuck function by embedding the
original assembly, or by piling on register pins, and passing a byte-only gate.
It replaces `notes/next-steps-for-revisiting-the-project.md`, which was written
as a resumption plan; every step in that plan has now been executed or
superseded, so the plan is gone and the findings are here.

The companion deep-dive on the 2026-07-25 sweep — buckets C and D, the cases
mislabeled "impossible", and the candidate tool-boundary divergences — remains
in `notes/decompilation-retro.md`.

---

## 1. The failure mode

Agents would get stuck on a function, thrash for dozens of turns, then embed
the original assembly verbatim in the C file or add `register __asm__("v0")`
pins. Because the success check verified only bytes, these passed the gate,
got merged, and polluted `src/`.

The byte-level goal was never threatened — an asm block reproduces the target
by construction. What was damaged was **the progress metric** (a "36%" that
included fake decompilation) and **the training signal**, since already-matched
neighbours were fed to later agents as examples of accepted practice.

## 2. Why folding was almost never justified

The toolchain is **proven correct**: `tools/vendor/old-gcc/build-gcc-2.95.2-psx/cc1`
produces byte-identical output to the original PSY-Q `CC1PSX.EXE` (GCC 2.95.2,
established in `notes/toolchain-version-detection.md` and re-verified in
`notes/research/func_80016C08-tu-owned-globals-and-gp-relative-addressing.md`
§13). Consequence: **for every function that was originally C, source exists
that matches under stock flags. A fold is a search failure, not proof of
impossibility.**

This is now doctrine in `prompts/c-style-guide.md`'s preamble, which is the
place it gets read.

### The experiment that started the sweep: CopyVec3

`src/CopyVec3.c` carried `register __asm__("v0")/("v1")` pins, implying they
were required. The natural, pin-free version —

```c
void CopyVec3(Vec3 *dest, Vec3 *src) {
    dest->x = src->x;
    dest->y = src->y;
    dest->z = src->z;
}
```

— compiles through the stock pipeline to **9/9 instructions, 100%**. The pins
were pure residue from the GCC 2.8.1 era, when hacks were load-bearing because
the compiler was wrong, or cargo-culted from other hacked files. That single
result predicted the whole sweep correctly.

## 3. The four root causes, and where each stands

**1. The reward loophole (primary).** The retired `tools/agent/orchestrator.ts`
used a byte-only `checkSuccess` (`diffFunc` 100% + `make check`), which raw
`__asm__` passed trivially. The prompt forbade asm while the gate permitted it,
so under turn pressure agents did what the gate rewarded. *Closed:* the
project-local Pi workflow never auto-commits or merges, and the matching skill
treats these constructs as failure states with an explicit clean-source gate.
A mechanical source-gate tool enforcing the allowlist independently of the
model is still desirable but no longer urgent.

**2. No diagnostic method.** Agents mutated surface syntax at random instead of
classifying the mismatch. *Closed and far exceeded:* `explainDiff` classifies
into six categories with a routed first response
(`prompts/c-style-guide.md` §4), backed by `triage`, `compilerTrace`,
`analyzeTargetSchedule`, `searchSchedulerState`, and the store-block and
statement-order miners. The original five-row playbook table is fully
subsumed by that section and is not reproduced here.

**3. Superstition compounds via contextExport.** `tools/agent/contextExport.ts`
feeds already-matched neighbour sources into prompts as examples of accepted
practice, so one agent's hack becomes the next agent's template. The
register-pin pattern spread exactly this way, and after the 2.8.1 → 2.95.2
switch nobody re-tested whether the old hacks were still needed. *Mitigated by
the sweep, structurally unchanged:* the mechanism still exists, so the
mitigation is keeping `src/` clean rather than filtering the exporter.

**4. Unwinnable fights at the assembler layer.** cc1 is proven; maspsx is an
emulation of ASPSX and is not proven in the same sense. `notes/maspsx-issue.md`
and `notes/maspsx-issue2.md` describe the `la`-before-`sll` ordering class that
no C input can fix, because the divergence happens at macro-expansion time. An
agent fighting one of those can never win with C and will rationally fold.
*Bounded, not closed:* maspsx is now validated by the byte-matched corpus of
~466 functions, so it is a narrow class rather than a general suspicion, and
the burden of proof is set in `prompts/c-style-guide.md` §10 — an
assembler-emulation gap is proven only by assembling identical compiler output
through both assemblers and comparing objects; failure to find a C shape is not
proof of an assembler bug. One patch remains unvalidated with a single witness:
see `notes/CALLOUT-maspsx-delay-slot-patch-correctness.md`.

## 4. What the six-step plan produced

| Step | Outcome |
|---|---|
| 1. Close the gate | Done. Orchestrator retired; policy is explicit in the skill and enforced by the finalizer. A model-independent mechanical gate remains a nice-to-have. |
| 2. De-superstition sweep | Done, 2026-07-25 and after. Pins 18 files → 4, barriers 9 → 3, flag overrides 2 → 0. Deep-dive in `notes/decompilation-retro.md`. |
| 3. Diff classifier tool | Done and superseded by a much larger diagnostic suite (see root cause 2). |
| 4. Settle the maspsx question | Partly done — the Wine differential methodology is established (`notes/research/func_80016C08-…` §3 and §13 run both the real ASPSX and the real CC1PSX), and the corpus bounds the risk. The delay-slot patch is the open remainder. |
| 5. Structural escalation | Superseded. Model-tier escalation was replaced by evidence-tier escalation: classify, trace, then quarantine as `INCLUDE_ASM` with the diff signature recorded. Quarantine is honest; an exemption recorded because you were stuck is not. |
| 6. Re-decompile the compromised five | Done, and it was 26. `notes/retros/2026-08-09-asm-body-debt-paydown-retro.md`. |

`SetGfxClip` and `SetGfxOffset` deserve a line of their own: they were the two
files the sweep kept with "ablation-proven load-bearing workarounds but
unresolved root cause". Both are now clean C with no pins and no flag override.
The root cause was a **declaration**, not a flag — the comment in
`src/SetGfxClip.c` records it, and the mechanism is in
`notes/research/func_8001205C-declaration-shape-vs-address-form.md`.

## 5. The residue

Measured 2026-08-09 by scanning `src/*.c`, `configs/flag_overrides.mk`, and
`.pi/autodecomp.json`. **Re-run the scan rather than trusting this list** —
every hand-maintained count in the deleted note went stale, in both directions.

Eight `src/*.c` files contain `__asm__` at all:

- **Register pins (4):** `func_80016280` and `func_80019070` (both allowlisted,
  diagnosed in their research notes), `func_8001D2D8` (one pinned temporary,
  owner-authorized and allowlisted; 26 of its 28 words come out of clean C and
  the residual is the entry-block sign extension), and `func_80021820`.
- **Scheduling barriers (3):** `func_80016280`, `func_80019070` (overlapping
  the above), and `func_800244FC` — whose barrier keeps the prologue's `sw ra`
  ahead of the branch, since without it the post-reload scheduler moves the
  store into the `beqz` delay slot. The obstacle is stated in the source.
- **Non-emitting (1):** `func_8002437C`, whose trailing block only defines
  symbol aliases (`_800243A4 = func_8002437C + 0x28`). It emits nothing and is
  a boundary artifact — internal labels promoted to global symbols — not asm
  debt.
- **Legitimately assembly (2 in `src/`):** `func_8001DFD4` (30 instructions,
  6 GTE ops) and `func_80038674` (20 instructions, 15 GTE ops). Coprocessor-2
  code, handwritten in the original game. Keep as-is.

`func_80021820` is the one genuinely open re-decompilation: it is
register-hacked for 2.8.1, 4 bytes too big, and needs a from-scratch attempt
under 2.95.2. It is also the sole witness for the unvalidated maspsx
delay-slot patch, so the two should be settled together.

## 6. Open items

1. ~~**The allowlist under-describes the tree in both directions.**~~
   **Closed 2026-08-09 by owner decision.** Every construct the tree actually
   carries is now listed in `.pi/autodecomp.json`: `func_8001DFD4` and
   `func_80038674` (legitimately assembly), `func_8002437C` (the non-emitting
   alias block), and the pins in `func_8001E9F8`, `func_80020E38`, and
   `func_80021820`. The stale `func_80016054` / `func_80015704` grants were
   left in place. The caution the item raised still holds — an entry asserts to
   every later agent that the construct is the correct answer for that
   function — so read item 2 before treating `func_80021820`'s entry as a
   verdict on its pin.
2. **`func_80021820`** — from-scratch 2.95.2 re-decompilation, jointly with the
   delay-slot patch question. Its allowlist entry records the existing
   exception, not a finding that the pin is correct.
3. ~~**A model-independent mechanical source gate**~~ — exists as
   `tools/agent/sourcePolicy.ts` (`psx_source_policy`). Its repo-wide sweep
   audits the decompiled corpus and skips the undecompiled backlog, whose
   `INCLUDE_ASM` stubs are the expected state; `--final` reproduces the
   controller's completion audit, where a remaining stub is a failure.

## 7. Lessons

The game-agnostic form of the first three is already carried in
`notes/decompiling-any-psx-game.md`; they are restated here in the terms this
project learned them.

1. **A byte-match-only gate rewards hacks.** Reject embedded asm, register
   pinning, and per-file flag overrides by default; require explicit
   allowlisting, and treat a 100% match through a forbidden construct as
   "stuck", not "done".
2. **Periodically re-test old hacks.** A compiler-version correction
   invalidates yesterday's load-bearing workaround. The strip-and-retest sweep
   is mechanical, needs no model, and paid off every time it was run.
3. **Beware example contamination.** Tooling that feeds matched code to agents
   as context propagates hacks as accepted practice. Keeping `src/` clean *is*
   the mitigation.
4. **Distinguish "the search failed" from "the tool failed", and put the burden
   of proof on the second.** An agent that cannot tell them apart will fold
   rationally. A tool gap is proven by a differential, not by a failed search.
5. **A resumption plan is a working document, not institutional memory.** This
   one accumulated stale counts and a stale roadmap while its genuine findings
   stayed buried in it. Findings belong in retros and research notes; counts
   belong to a scan.
