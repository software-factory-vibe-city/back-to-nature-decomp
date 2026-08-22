# Plan: make the loop's gradient true, durable and reusable

Written 2026-08-22 from a forensic read of the 2026-08-21/22 overnight
`/auto_decompilation_loop` run (51 functions: 42 matched, 9 parked), focused on
the four parked `ovl_10` functions.

**Two of the four parked overlay functions are now byte-exact**
(`ovl_10_func_800BB264`, `ovl_10_func_800BADA4`); `make check-all` passes 14/14
with both. A third moves from residual `[0,2,1,2]` to `[0,0,1,0]` on one edit.
The fourth cannot be built at all under the current build system. None of the
four needed a stronger model. Each was stopped by an instrument, not by the
function.

**Implemented 2026-08-22** — §0 records what landed and what the implementation
changed about the plan. The fourth function now builds, links, and reaches
477/479 words with no differing word.

---

## 0. Status — implemented 2026-08-22

Every phase below is built and in the tree; `npm test` is 569/569 and
`make check-all` passes 14/14. What each finding cost, and what it bought:

| # | landed as | note |
|---|---|---|
| F1 | `deriveRodataSplits.ts --container <id>`, called from every overlay's link rule and `check-<id>` | The jump-table finder now *verifies its candidate*: a rodata address counts only if the words there read as this function's own code labels. The old "lowest referenced constant" rule was right in the EXE by accident and picks a format string in an overlay. `bootstrapOverlay.ts` carries the derived block across a re-split, or the self-healing relink loops forever. Proof: `ovl_10_func_800BA394` links as C, and the stub round-trip removes the attribution again. |
| F2, F3 | blind blocks | A block holding an undetermined word is marked `blind`; its terms are shown with a trailing `?` and **excluded from the key**. `rankBlocks` never returns one as NEXT, and `matchReport` names the count, the blocks and the usual cause. |
| F4 | `VERDICT: STUB` | Decided from the *object*, not the source: splat's `nonmatching` macro defines `<name>.NON_MATCHING`, so a stub says so about itself. No C to parse, no tree-sitter in the oracle, and it holds for any source path. |
| F5 | `recordExperiment` refuses a stub | Same object-level test, passed through as `objectPath`. |
| F6 | ledger schema 2 + `migrateLedger.ts` | 144 zero rows marked exact on evidence, 5 retired as measurements of the assembly against itself. The parked functions' bests are honest again: `func_8001C0D4` `[0,0,0,2]`, `func_8001231C` `[0,0,2,2]`. |
| F7 | `exact` on every row; `best()` ranks exact first | |
| F8 | `residualObjective` names the differing words when the key is zero | The closest state in the search printed nothing; it now prints `target addu v0,s1,s2 / candidate addu v0,s2,s1`. |
| F9, F10, F12 | content-addressed variant store; `chooseParkAttempt`; park re-measures | Every measured source is written to `build/experimentLedger/sources/<fn>/<hash>.c`, the park preserves the best *measured* program rather than the last one on disk, and the note's report is taken from that program at park time, so the two cannot disagree. |
| F11 | `recordAndWarn` runs on the `--json` path | The loop's own end-of-turn readings were the majority of every worked function's history and none of them reached the ledger. |
| F13 | `signatures` on every row; `psx_residual_signatures` | Cross-function now. Seeded from the two functions that motivated it: the index shows both carried `addiu <reg>,<reg>,-17844@4\|addiu <reg>,<reg>,1@4` and prints the diff that closed it. `matchReport` surfaces it on the block being worked. |
| F14 | `idiom-precedent` detector in `psx_triage` | Fires on a bare stub, because the query is the target's own assembly. On `ovl_10_func_800BA394` it names `800BB264` and `800BADA4` before a line of C exists. |
| F15 | `self-similarity` detector in `psx_triage` | Aligns open blocks against closed ones through the corpus normalizer — exact shape equality misses the pairs it exists to find, because two instances of one loop differ by an offset constant. |
| F16 | `psx_record_closed` | Read above the measurements in `psx_experiment_ledger` and carried into every escalation message. |
| F17 | `singleTier` | A one-rung ladder is refused unless the config says it was meant. `.pi/autoloop.json` now says so. |
| F18 | `stop-rule.ts` | The counter is a floor; the decision is whether the ledger says the search stopped moving *and* a heavy tool has recorded an answer. A wall-clock ceiling escalates rather than parks. |
| F19 | `blocked` park reason | Parks immediately with the configuration defect named, instead of after three turns with "needs a new structural hypothesis". |
| F19 | `implicatedByPark` + `nextTarget(defer)` | A park defers its family — same residual signature or same suspected translation unit — to the back of the queue rather than working four functions with one root cause back to back. |
| F20 | `dedupeFindings` | |
| §4 | `tools/agent/idiom-corpus/` + `psx_idiom_search` | Build A, measured. 6,182 regions from 358 clean-C matched functions; 2,191 stubs, 15 embedded-asm and 5 register-asm excluded by construction; cold build 6.6 s, warm 90 ms behind the provenance layer. All three known-answer cases pass. Leave-one-out over 40 sampled functions with a recorded same-group neighbour: **recall@1 43%, recall@3 50%** at tier 0, and 20%/35% at tier 1 — the portability tier costs precision, as designed, and now with a number on it. |

### What the implementation changed about the plan

- **The jump-table finder needed a content test, not a port.** §3's Phase 0.1
  described parameterising the existing derivation. That derivation's rule —
  the lowest lui/addiu constant inside the rodata window — is only correct
  because the PS-X EXE's *game-rodata* window happens to hold nothing but jump
  tables. An overlay's window is its entire read-only section, so the same rule
  attributes twenty bytes of somebody else's strings to the function. A jump
  table is now recognised by reading it: the words at the candidate address
  must be this function's own code labels. Two functions in the EXE also needed
  `size:` honoured over the next symbol's address, because the disassembler
  named their table's targets as functions.
- **`recall@3 50%`, not obviously good or bad.** The ground truth is
  *suspected* same-file membership from a hand-maintained ledger, and a group
  can hold a five-instruction setter beside a 250-instruction renderer. The
  number is a baseline to improve against, not a verdict; the three known-answer
  cases are the ones that carry weight, and they pass.
- **A stub baseline is a row, not a failure.** §0.2's refusal made
  `psx_residual_objective --source` unusable on exactly the functions it is
  most needed for — the parked ones, whose `src/` is a stub by construction.
  The baseline row reads `STUB` and the candidates are scored against each
  other.

### The two `ovl_10` parks, after all of this

Both are **one instruction placement** from exact, and they are the *same*
placement:

| function | before | after |
|---|---|---|
| `ovl_10_func_800BA394` | unbuildable — could not be compiled as C at all | 477/479 words, **no differing word**, `[0,0,1,1]` |
| `ovl_10_func_800B95F0` | `[0,2,1,2]`, 295/302 | **301/301 words**, `[0,0,1,0]` |

In both, the target's loop preheader puts the row offset's initialisation
*between* two hoisted addresses, and every clean-C spelling tried puts it before
both. `loop_optimize` runs twice at `-O2` and emits
`[source][pass-1 movables][pass-1 giv inits][pass-2 movables]`, which forces the
payload address into pass 2 — the open question is the spelling that keeps it
out of pass 1. Each note carries the mechanism, the measured alternatives, and
what `psx_record_closed` has closed. §5.2 and §5.3 below are superseded by
those notes.

---

## 1. What the parked set actually is

All four are the same kind of code: `ovl_10`'s memory-card debug menu — a
`switch (mode)` dispatcher whose case 1 renders a byte buffer with
`FntPrint`/`sprintf` in nested loops. Their easy siblings in the same cluster
(`800BAB10`, `800BA2A0`, `800BA11C`, `800B92D0`, `800B9AA8`, `800B9D24`) all
matched in one to three minutes each on the same night. The four that stuck are
the ones with a **rendering loop over an array**.

| function | parked residual | truth |
|---|---|---|
| `ovl_10_func_800BB264` | `[0,0,2,1]`, 300/305 | **solved** — one loop-body idiom edit |
| `ovl_10_func_800BADA4` | `[0,0,3,1]`, 299/304 | **solved** — the *same* edit |
| `ovl_10_func_800B95F0` | `[0,2,1,2]`, 295/302 | one edit → `[0,0,1,0]`, 301/301; one real transposition left |
| `ovl_10_func_800BA394` | `[0,0,1,1]`, 476/479 | **unbuildable** — see F1 |

### The edit that solved two of them

```c
/* parked attempt */                        /* byte-exact */
u8 *fp = &D_800BBA4C[1];                    for (s3 = 0; s3 < 2; s3++) {
for (s3 = 0; s3 < 2; s3++) {                    s1 = 0; s2 = s3 << 4;
    s1 = 0; s2 = s3 << 4;                       while (s1 < 0x10) {
    p = s2 + fp;                                    sprintf(buf, &D_800B86C4,
    while (s1 < 0x10) {                                     D_800BBA4C[s1 + s2 + 1]);
        sprintf(buf, &D_800B86C4, *p);              ...
        ... p++;                                }
    }                                       }
}
```

Index the global directly and let GCC's loop pass build the preheader base;
write the index `s1 + s2`, not `s2 + s1`, so CSE lands the commutative `addu`
in the target's operand order.

**The answer was already in the tree.** `src/overlays/ovl_10/ovl_10_func_800B9D24.c`
— matched by the same loop three hours earlier, in the same directory — contains
`sprintf(buf, &D_800B8328, D_800BB99C[s0 + 1]);`. The idiom was proven, in the
same cluster, and nothing surfaced it. Stronger still: in `800BB264` itself,
case 1's *second* loop already used direct indexing and already matched, while
the first loop used the pointer and did not. The counter-example was eleven
lines away in the same file.

---

## 2. Findings

Severity: **B** = makes the goal unreachable; **P** = poisons the gradient;
**L** = loses work; **R** = fails to reuse what is known; **M** = loop mechanics.

### F1 (B) — overlays have no rodata attribution, so no overlay switch function can be built

`deriveRodataSplits.ts` is hard-wired to the PS-X EXE (`exeSplatYamlPath()`,
`exeSymbolAddrsPath()`), and the overlay link rule
(`$(BUILD_DIR)/$(1)/$(1).elf`) never calls it. When an overlay function that
owns a jump table is compiled as C, its table stays in the container's generic
`rodata` subsegment, which still references the function's internal labels:

```
mips-linux-gnu-ld: build/ovl_10/asm/data/0.rodata.s.o:(.rodata+0x8ac):
    undefined reference to `.L800BA530'
```

Reproduced: with the parked attempt restored, `make check-ovl_10` fails to link.
`plans/overlay-decompilation-enablement.md` listed `deriveRodataSplits.ts` as
container work and required the self-healing relink to "remain per-container";
that half did not land, and nothing caught it because the plan's proof case
(`ovl_31_func_800B82E8`) owns no jump table, and none of the 43 overlay
functions in C today does either. `ovl_10_func_800BA394` is the first one the
loop ever attempted.

**Blast radius: 131 overlay functions across 11 of the 13 containers** (ovl_11
alone: 95). These are the dispatchers — the highest-value functions in the
overlay set.

The deadlock is total: the link failure is only visible to `psx_finalize_function`,
which only runs after a byte-exact diff, which cannot happen because the same
missing attribution leaves the table's relocation undetermined.

### F2 (P) — undetermined relocations become phantom `population`, and the ranker leads with them

An unresolvable relocation lifts as `lui <undetermined>`, whose *shape* differs
from the target's, so the block's population match fails and the misalignment
cascades. For `800BA394` the real residual is one transposition and one register
at block 93; the tool reports:

```
cfg 0  pop 4  sched 1  alloc 1
NEXT: block 26 (0x800BA4F8) — population 1, schedule 0, allocation 0
      the instruction populations differ here; nothing below can be read until they agree
```

Blocks 26 and 27 are byte-identical to the target. The loop spent 46 minutes and
26 measurements being told to fix code that was already right, and told that its
schedule and allocation readings were invalid when they were the only true ones.

### F3 (P) — the loop's report drops the undetermined count entirely

`ResidualReading.objective` in `gates.ts` has no `undetermined` field, so
`matchReport` cannot print it. `residualObjective`'s own text output has an
`undet` column and a legend; the loop's message to the agent has neither. The
agent is never told that two of its words are unjudged unless it runs `diffFunc`
itself and reads past the verdict.

### F4 (P) — the oracle cannot tell C from assembly

`INCLUDE_ASM` expands to `.include` of the extracted assembly, so a stub compiles
to the original words. Measured on the parked stub:

```
$ npx tsx tools/agent/diffFunc.ts ovl_10_func_800BA394
Match: 479/479 words (100.0%)
VERDICT: MATCH — every word is byte-identical to the original after relocation.

$ npx tsx tools/agent/residualObjective.ts ovl_10_func_800BA394
  src/overlays/ovl_10/ovl_10_func_800BA394.c  EXACT  479/479  0 0 0 0
```

Only the separate source-policy scan stands between the loop and a false match.
Every diagnostic in the stack — the oracle, the residual, the reversal — is blind
to this.

### F5 (P) — those false readings are written into the experiment ledger

`recordAndWarn` appends whatever it scored. Of 25 parked-function ledgers, **13
contain a `[0,0,0,0]` row; in 12 it is the final row; in 4 it is the only row
that function ever got.** The agent's natural "measure the baseline first" move,
on a target that is still a stub, records a perfect score for the assembly.

### F6 (P) — a poisoned ledger makes `STALLED` fire from the fourth measurement forever

`stallLine()` takes `best` from the ledger. With a `[0,0,0,0]` row present, no
later measurement can improve on it, so `since` grows monotonically: three more
measurements and the retry is told *"STALLED: 3 distinct measurements since the
residual last improved on [0, 0, 0, 0]"*, followed by the full heaviest-evidence
escalation prose. The signal that is supposed to be rare and meaningful becomes
constant noise on exactly the functions that most need it.

### F7 (P) — the ledger records the residual key but not whether it was a match

`LedgerEntry` has `key` and a `verdict` field that holds `"baseline"`/`"scored"`,
never the oracle's verdict. A genuine byte match and a residual-zero-but-bytes-
differ program are the same row. Observed: `ovl_10_func_800BB264` variant A
scored `[0,0,0,0]` at 304/305 words. The objective's docstring promises "zero
exactly at a match"; it is not.

### F8 (P) — `[0,0,0,0]` with bytes differing produces no guidance at all

`rankBlocks` returns nothing when no block is open, so the closest state the
search can reach is the one state with zero information in it.

### F9 (L) — the loop has no best-so-far checkpoint

The park preserves whatever is on disk when the turn budget runs out.

- `ovl_10_func_800BA394`: best measured `[0,0,1,1]`; preserved program measures
  `[0,4,1,1]`. The better program is unrecoverable.
- `func_80017F30`: 166 measurements, 83 distinct programs, on a 22-word function.
  Ledger best is `build/scratch/f17f30/rt54/s2_y_xeq.c` — a directory the agent
  invented, untracked, unindexed, one `make clean` from gone. The preserved
  attempt is a different program.

### F10 (L) — the ledger stores source hashes, never source text

So a program named in the ledger as best cannot be reconstructed from it.

### F11 (L) — the loop's own measurements never reach the ledger

`runResidualObjective` calls `residualObjective.ts --json`, and `recordAndWarn`
only runs on the text path. Every end-of-turn reading the loop takes is invisible
to `stallLine`, which therefore counts over a partial history.

### F12 (L) — the park note's report and its preserved attempt can describe different programs

`ovl_10_func_800BA394`'s note reports `[0,0,1,1]` at 476/479 above a source that
reproduces `[0,4,1,1]` at 474/477. A human reading the note is being handed a
measurement that its own code cannot reproduce.

### F13 (R) — the per-block residual `signature` is computed and thrown away

`ovl_10_func_800BADA4` block 41 and `ovl_10_func_800BB264` block 41 carry the
**byte-identical** signature:

```
addiu <reg>,<reg>,-17844@4|addiu <reg>,<reg>,1@4
```

They were worked 30 minutes apart, for 52 and 34 minutes, by the same loop, and
closed by the same one-line edit. `rankBlocks` already groups by this key —
within one function only. It is never persisted and never compared across
functions.

### F14 (R) — nothing reads the idioms of already-matched neighbours

The doctrine tells the agent to (`SKILL.md`, "Read what the author wrote"), and
`notes/file-groupings.md` is named as the index. There is no tool. And for this
cluster the index has no entry: the only `ovl_10` group recorded is the `/15`
date-utility pair, so following the doctrine would have pointed the agent at two
arithmetic helpers instead of the six matched menu functions next to it.

### F15 (R) — nothing checks a function against itself

The strongest available signal in `800BB264` was that two structurally identical
loops in one file had different residuals. No instrument looks for that.

### F16 (R) — nothing records which heavy tools were run or what they closed

`SKILL.md` says "Record what each of these closed"; there is no mechanism, so a
retry cannot know that `psx_solve_local_allocation` already returned
`UNSAT_WITHIN_BOUNDS`.

### F17 (M) — the escalation ladder has one rung

`.pi/autoloop.json` configures a single tier (`deepseek-v4-flash`) where
`DEFAULT_LADDER` has three. Three consequences, all silent:

- no escalation ever happens;
- `captureHandoff` is dead code (it needs `tierIndex + 1 < ladder.length`);
- `adjudicate` always returns `unavailable`, so **any** forbidden construct
  becomes an immediate human park. Three of the nine parks are that.

### F18 (M) — the budget is a turn count, and it buys the wrong thing

`returnsPerTier: 3`, one tier: three agent turns, whatever they cost. Measured
over the night:

| | functions | wall clock |
|---|---|---|
| matched | 42 | ~4.4 h (median 2.5 min each) |
| parked | 9 | **9.4 h** |

**68% of the run went into the nine functions it gave up on**, and at least two
of those needed a four-line edit. `SKILL.md` says "Park a function only when a
human decision is required… never merely because it is hard"; the loop parks on a
counter. The doctrine and the harness disagree, and the harness decides.

### F19 (M) — no difficulty-aware scheduling

`nextTarget` takes the first undecompiled, non-dead, non-handwritten function in
call-graph order. Four functions of the same family, with the same root cause,
were attempted back to back for three hours.

### F20 (M) — policy findings are reported twice

`checkSourcePolicy` pushes from both `scanSourceFile` (the file) and
`scanAddedPatch` (the patch) with no dedupe, so every construct in a newly
written file appears twice in the park note.

---

## 3. Plan

Ordered by dependency. Phase 0 is not optional: every later phase measures with
the instruments Phase 0 repairs.

### Phase 0 — make the gradient true

**0.1 Generalize rodata attribution to containers.** *(fixes F1)*
Parameterize `tools/build/deriveRodataSplits.ts` by container: replace
`exeSplatYamlPath()`/`exeSymbolAddrsPath()` with the container model's
`configs/splat/<id>.yaml` and `configs/symbols/<id>.txt`, and use
`vramToRom(container, …)`. Add the self-healing rederive/re-split/relink to the
`OverlayRules` link rule with the same `DERIVE_RODATA_RETRY` guard, per
container. Acceptance: `ovl_10_func_800BA394` compiled as C links, and
`make config-check` still converges. Land `ovl_10_func_800BA394` as the proof
case — it is already at one transposition and one register.

**0.2 Refuse to score a stub.** *(fixes F4, F5)*
`tools/lib/functionOracle.ts` learns one question — does the translation unit
being compiled hand this symbol to the assembler? — answered from
`cSourceGuard.declaresIncludeAsm`, which already exists. When it does:
`diffFunc` prints `VERDICT: STUB — this source hands the function to the
assembler; there is nothing to compare`, `residualObjective` refuses to score,
and `recordExperiment` refuses to append. Nothing that reads a stub may report a
distance.

**0.3 Never let an unjudged word become a residual term.** *(fixes F2, F3)*
Undetermined words are already tracked. Three changes:
- a block that contains an undetermined word is marked `blind`, and its
  population/schedule/allocation terms are excluded from the key rather than
  counted;
- `rankBlocks` never returns a blind block as `NEXT`, and prints a separate
  line naming it and the missing configuration;
- `ResidualReading` carries `undetermined`, and `matchReport` prints it and
  suppresses the "fix the semantics first" line when the population term is
  entirely blind.

**0.4 Record the verdict alongside the key.** *(fixes F7, F8)*
Add `exact: boolean` to `LedgerEntry`, and make `best()`/`stallLine()` treat a
non-exact `[0,0,0,0]` as worse than any exact row. Where the objective is zero
and the bytes differ, `residualObjective` prints the differing words from the
oracle instead of an empty NEXT section — that state is the most informative one
in the search, and it currently prints nothing.

**0.5 Retire the poisoned rows.** One-off: drop `[0,0,0,0]` rows whose source
declares `INCLUDE_ASM` from `build/experimentLedger/*.jsonl` (13 files), and
re-derive. Cheap, and without it every retry starts stalled.

### Phase 1 — stop losing the best program

**1.1 Content-addressed variant store.** *(fixes F9, F10, F12)*
`recordExperiment` writes the scored source to
`build/experimentLedger/sources/<sourceHash>.c` and the entry keeps the path.
Every measured program becomes recoverable by hash. Replaces the ad-hoc
`build/scratch/<fn>/rtNN/` directories agents invent.

**1.2 Park the best, not the last.** *(fixes F9, F12)*
`park()` selects the source by ledger rank (exact first, then key, then word
count as a tie-break), not by what is on disk. The note reports the residual of
the source it preserved, re-measured at park time, so the two can never disagree.
If the on-disk source is not the best, say so in the note and preserve both.

**1.3 Record every reading the loop takes.** *(fixes F11)*
Move `recordAndWarn` out of the text-only branch so `--json` records too, or have
`runResidualObjective` pass a `--note "loop end-of-turn"`. The stall counter is
only as good as the history it counts.

**1.4 Close the loop on heavy tools.** *(fixes F16)*
A `psx_record_closed` tool (or a `closed` row kind in the ledger) taking
`{tool, question, verdict, evidence}`. `psx_experiment_ledger` prints them above
the measurement history, and the escalation message carries them. An `UNSAT` that
has to be rediscovered is worse than no `UNSAT`.

### Phase 2 — reuse what the project already knows

**2.1 Persist and index the residual signature.** *(fixes F13)*
Add `signatures: string[]` to `LedgerEntry` and build
`build/residualSignatures.json`: signature → the functions that carried it, and
for each closed one, the diff of the edit that closed it. Surface it in
`matchReport`:

> Block 41's residual signature `addiu <reg>,<reg>,-17844@4|…` was closed in
> `ovl_10_func_800BADA4` by *(diff)*.

This alone would have turned the second 34-minute park into a one-minute match.
Everything it needs already exists in `BlockResidual.signature`.

It is also the narrow case of §4. Signature→edit fires only once a function has
been attempted and has produced that exact residual; §4's retrieval fires on
first contact, before m2c runs. Build 2.1 first because it is a day's work and
shares the normalizer, but expect §4 to subsume it.

**2.2 Self-similarity check.** *(fixes F15)*
A `psx_self_similarity` detector in `triage.ts`: partition the candidate's basic
blocks by residual-block state (open/closed), find open blocks whose *target*
instruction shape sequence matches a closed block's, and report the source
regions that produced each. Emit as a `signal`:

> Block 41 is open; block 61 has the same target shape and is closed. The source
> spans differ: block 41 walks a pointer, block 61 indexes the array.

**2.3 Neighbour idiom sheet.** *(fixes F14)*
A `psx_neighbour_idioms <function>` tool that, from the target's container and
address neighbourhood (not only `file-groupings.md`), emits the matched
neighbours' actual C for the constructs that matter: array walks, base pointers,
loop shapes, guard spellings, local lifetimes. Include it in the opening message
for any target with a matched neighbour within N functions. The doctrine already
demands this; give it an instrument.

Address adjacency is the placeholder heuristic. §4 replaces it with retrieval on
the target's own assembly, which is both more precise and not restricted to
neighbours.

**2.4 Fix the grouping index for `ovl_10`.** *(fixes F14)*
Record the debug-menu cluster (`800B95F0`, `800B9AA8`, `800B9D24`, `800BA394`,
`800BAB10`, `800BACBC`, `800BADA4`, `800BB264`, `800BA11C`, `800BA2A0`) as one
group — nine of them share `ovl_10_func_800BB728`, the same `switch (mode)`
dispatcher shape, the same `FntPrint`/`sprintf` render idiom, and the same
`D_800BBA4C` buffer. It is the strongest grouping evidence in the container and
it is not written down.

### Phase 3 — spend the budget where it pays

**3.1 Restore a real ladder.** *(fixes F17)*
Either put the configured tiers back in `.pi/autoloop.json`, or have the loop
refuse to start on a one-rung ladder without an explicit
`"singleTier": true`. A one-rung ladder silently disables escalation, handoff and
policy adjudication; that should be a decision, not a default.

**3.2 Budget by evidence, not by turn count.** *(fixes F18)*
Replace `returnsPerTier` with a stop rule that reads the ledger:

- park only when the best key has not improved across *K* distinct measurements
  **and** at least one Phase-2 retrieval and one heavy tool have been run and
  recorded as closed;
- add a wall-clock ceiling per function (e.g. 25 min) that escalates rather than
  parks;
- when a target has a blind block or a container blocker, park **immediately**
  with that as the reason, not after three turns. `ovl_10_func_800BA394` should
  have been parked at minute one with "the container has no rodata attribution
  for this function's jump table", not at minute 46 with "needs a new structural
  hypothesis".

**3.3 A `blocked` park reason distinct from `escalation-exhausted`.**
Today both read as "the model could not do it". They are opposite problems: one
needs a build fix, the other needs a human decision. The note template and the
loop's summary should tell them apart.

**3.4 Family-aware scheduling.** *(fixes F19)*
After a park, deprioritize functions sharing the parked one's residual signature
or file group until the cause is closed — or, better, run the *cheapest* member
of a family first and let 2.1 carry the answer to the rest.

**3.5 Dedupe policy findings.** *(fixes F20)* One line in `checkSourcePolicy`.

---

## 4. The idiom corpus — target assembly in, matched C out

Phase 2 above retrieves within this project, keyed on the residual. This section
is the general form of it: a corpus that answers *"what C produces assembly that
looks like this"*, built from every byte-exact function, portable to other
PlayStation decompilation projects with a different compiler, flags or
assembler.

Origin: the two functions in §5 were both closed by an idiom that was already
proven in the tree — `ovl_10_func_800B9D24`, matched three hours earlier in the
same run, walks its array as `D_800BB99C[s0 + 1]`. Nothing could retrieve it.

### 4.1 The reframe

> **Query with the *target* assembly of an unsolved region. Return the *C source
> span* that produced near-identical assembly in a solved one.**

Not "find similar C". The thing you have on day one is the target's assembly;
the thing you lack is the C. Raw bytes are the wrong key — registers, immediates,
branch targets and relocations all vary between two instances of one idiom — but
the right key already exists: `MirProgram.insn.shape` from the pipeline
reversal, which is what `BlockResidual.signature` is built from.

Three query modes fall out of one index:

- **cold start** — the whole target function, before m2c, to seed the draft;
- **residual** — the open blocks only; this is the parked case;
- **self** — the target's own closed blocks, which is F15 for free.

### 4.2 No database, and no vectors either — yet

Corpus today: **412 clean-C matched functions, ~63,600 bytes ≈ 16,000
instructions**, ~11,700 lines of C, giving roughly 20,000 indexed regions. At
full project scope that is ~122,000 instructions.

At that size an **inverted index over rare n-grams with an LCS re-rank** beats
ANN on every axis that matters: exact, explainable, no embedding to go stale,
and it builds from the token sequences in about 100 ms at load. So:

> **Store no vectors. Store normalized token sequences and rebuild the index on
> load.**

That makes the corpus a pure text artifact — greppable, diffable, reviewable in a
PR, copyable into another project. It also removes the class of bug where the
index is stale relative to the source, which is the same disease as F5. When a
vector store is wanted later, this file is its ingest source and nothing about
the record shape changes.

**Vector search is recall plumbing and must never be the output.** The tool
reports the alignment it proved — *"14 of 17 shapes align in order with
`ovl_10_func_800B9D24` block 12–18"* — never a cosine. A similarity score is not
a finding; an alignment is one, and a reader can check it.

### 4.3 Normalization: three tiers, indexed and queried together

Report which tier produced a hit.

| tier | form | survives |
|---|---|---|
| **0 — shape** | `addiu <s>,<s>,<lo16>` | same compiler + flags + assembler |
| **1 — op class** | `ADDR_LO`, `LOAD_BYTE`, `CALL`, `BRANCH_EQ`, `SHIFT_CONST`, `COPY` | assembler macro differences — an ASPSX `la` expanding to `lui/addiu` under `-G0` versus one `addiu` under `-G8` collapses to the same class |
| **2 — structure** | CFG skeleton, loop nesting, call sites; no instruction detail | nearly everything; this is what makes the corpus useful to a different game on day one |

Three details in tier 0 decide whether any of this works:

- **Keep register *class*, not a bare `<reg>`.** The signal in
  `ovl_10_func_800BB264` was that the target held the address in `s0`
  (callee-saved, live across the `jal`) where the candidate used `v0`. Collapse
  both and that bit is gone. Use `<s>`, `<t>`, `<a>`, `<v>`, `<sp>`, `<ra>`,
  `<zero>`.
- **Bucket immediates; do not keep or drop them.** `0`, `1`, small (<16),
  power-of-two, mask-shaped (`0xFF`/`0xF0`/`0x7F`), `<hi16>`, `<lo16>`,
  `<stkoff>`, other. `addiu <s>,<s>,-17844` must match `addiu <s>,<s>,-18324` —
  same idiom, different global.
- **Weight n-grams by inverse document frequency.** Prologue and epilogue stores,
  `jal` + `addiu <a>,<hi>` pairs, `lw <ra>,<stkoff>(<sp>)` appear in nearly every
  function and carry no information. Without IDF every query returns *"your
  function has a prologue"*.

Regions at three granularities, because idioms do not respect block boundaries:
each basic block; each natural loop (preheader + body — the CFG is already in the
reversal); and sliding windows of 8 and 16 with stride 4.

### 4.4 What an observation asserts: three layers

Portability differs by layer, so the record separates them and the tool weakens
its claim rather than hiding the hit.

| layer | content | survives |
|---|---|---|
| **0 — shapes** | normalized target instruction sequence | same compiler + flags + assembler |
| **1 — source** | the C span that produced it | any GCC 2.x — but it is *this author's* idiom |
| **2 — lever** | *"a loop-invariant address lands in the preheader iff the source does not name it as a variable"* | almost everything; `loop.c` barely moved across 2.6 → 2.95 |

A query always returns layers 1 and 2. Layer 0 is returned as *proof* only when
the toolchain fingerprints are compatible.

Layer 2 is the asset that compounds. `notes/research/`, `notes/retros/` and the
`psx_reference` mechanism sheets are already a hand-written version of it;
`levers.jsonl` is those claims made machine-readable and cross-referenced to the
observations that witness them. That is a shared, evidence-backed table of
"source shape → GCC 2.x codegen consequence" for PlayStation targets, which today
exists as folklore.

### 4.5 Toolchain compatibility: degrade the claim, not the recall

The fingerprint is **per function, not per project** — which is also what makes
the flag-override functions usable (§4.6).

| fingerprint distance | what the tool may say |
|---|---|
| identical | *"14 of 17 shapes align in order"* — proof |
| same compiler, different flags | proof **per axis** — see below |
| different GCC minor (2.95.2 vs 2.91.66) | the source idiom is a hypothesis; shape alignment is not proof |
| different major (2.7.2 vs 2.95) | layers 1 and 2 only; never claim the assembly aligns |

The per-axis case is derivable from machinery that already exists — the four
residual axes and `flagProbe.ts`. A flag → owned-axis table lets a cross-flag hit
say which half of itself is still evidence:

| flag | owns |
|---|---|
| `-fno-schedule-insns`, `-fno-schedule-insns2` | schedule |
| `-fno-gcse`, `-fno-cse-skip-blocks` | population |
| `-G0` vs `-G8` | population (gp-relative addressing changes instruction counts) |
| `-funsigned-char` | population |
| `-O1` vs `-O2` | all |

So a hit from a `-fno-schedule-insns` function tells a baseline-flags target
nothing about its schedule residual and everything about its population one, and
the tool says exactly that.

### 4.6 What is excluded, and what is kept as a negative index

Machine-detectable today through `sourcePolicy.ts` and `cSourceGuard.ts`. Real
counts: 26 allowlisted functions (19 `embedded-asm`, 9 `register-asm`, 8
`flag-override`, overlapping), 11 empty memory barriers, 2 `CAPTURE_RA`, 7
per-file flag overrides. Three-way split, not two.

**Excluded outright** — `include-asm`, `embedded-asm`, `register-asm`. Their C
does not teach a C idiom; the assembly is doing the work. Indexing them would
teach the search that hard-register pinning is a normal answer, which is exactly
the belief the clean-source policy exists to prevent.

**Excluded from idiom search, kept as a negative index** — the 11 empty memory
barriers. Same reasoning, but *which residual shapes have historically needed a
barrier* is real evidence. *"This shape needed a scheduling barrier in 3 prior
cases, none of which found a clean-C alternative"* is useful, and it is honest
about being a different kind of claim.

**Included, with their own toolchain fingerprint** — the flag-override functions.
Their C is clean and idiomatic; only the build differs. They are also the only
in-project evidence about what a different flag column does to codegen, so
excluding them would discard the most interesting rows in the set.

`CAPTURE_RA` is a target feature rather than a workaround: include, but tag it,
because it is game-specific.

### 4.7 The corpus is a shipped artifact, not part of this repository

```
psx-idiom-corpus/
  manifest.json        # schema version, contributing projects, licence
  toolchains.json      # fingerprint -> {gcc, flags, assembler, sdk}
  observations.jsonl   # one region per line: tokens (3 tiers), toolchain_fp,
                       #   source_sha + span, provenance, exclusion reason
  sources/<sha>.c      # content-addressed matched sources
  levers.jsonl         # layer 2, cross-referenced to observations
  negative.jsonl       # shapes that historically needed a barrier or an override
```

`psx_idiom_search --corpus <path>...` merges any number of corpora and ranks
same-project → same-toolchain → same-compiler → other. A new game starts with
this corpus at source-only confidence and accumulates its own layer 0 as it
matches functions.

**Source attribution is the hard part, not the search.** Mapping a region back to
the C that produced it needs a line map the build does not emit. Cheapest first:
(1) return the whole matched function's C plus the region index and let the
reader find it — already transformative, ship this; (2) a second compile with
`-gstabs` into a scratch directory, accepted only if `.text` comes back
byte-identical, giving real line ranges; (3) structural attribution through the
tree-sitter AST already in `residual-source-search/tree-sitter-c.ts`. Do not let
(2) block (1).

### 4.8 The limit the tool must enforce

**Author idioms do not transfer across games.** How *this* author walked an array
is evidence about this codebase and a hypothesis anywhere else. Only layer 2
transfers with real confidence. A cross-project layer 1 hit must be labelled a
hypothesis generator, never proof — otherwise the corpus becomes a machine for
laundering one game's habits into another game's evidence, which is worse than
having no corpus.

The same rule applies within this project across containers: a group lives inside
one container, and another binary is a different build with its own flags and
possibly a different author.

### 4.9 The benchmark already exists, with known answers

Insist on it before any of this is wired into the loop.

- `ovl_10_func_800BB264` block 41 must return `ovl_10_func_800B9D24`'s loop in
  the top 3.
- `ovl_10_func_800BADA4` block 41 must return `ovl_10_func_800BB264` at rank 1 —
  the two carry a byte-identical residual signature.
- Leave-one-out across all 412 matched functions: hold each out, query with its
  target assembly, measure recall@k for retrieving a same-group neighbour.

If recall@3 on same-group neighbours is poor, the fix is in the normalization,
and finding that out costs a day instead of a week.

### 4.10 Build order

**A — prove the retrieval, no database, no vectors.** Normalizer (three tiers,
per-function toolchain fingerprint, three-way asm exclusion) + region extractor +
IDF + LCS alignment, in memory over ~20,000 regions. Run the three known-answer
cases and the leave-one-out benchmark. Self-contained under `tools/agent/`;
touches nothing in the build.

**B — the corpus artifact.** `observations.jsonl` + `sources/` + `levers.jsonl`,
the merge-many-corpora CLI, and the compatibility distance from §4.5.

**C — source attribution** at line granularity, through the verified `-gstabs`
compile.

**D — wire it in.** A `triage.ts` detector, and the neighbour sheet in
`openingMessage` for any target with a compatible hit. Phase 2's 2.2 and 2.3
become thin callers of this index.

A vector store is a later, optional D+: worthwhile when the corpus spans several
games and a *layer 2* query — *"find me anything that looks like a state
machine"* — wants fuzzy recall over a few hundred lever rows, not exact recall
over twenty thousand shape rows.

---

## 5. Immediate, already-verified deliverables

1. **Done** (`dc17fdf`, 2026-08-22). `ovl_10_func_800BB264` and
   `ovl_10_func_800BADA4` are byte-exact and unparked; approval notes deleted,
   `notes/file-groupings.md` entries moved to `(m)` with the stale
   "every clean-C suppression regresses it" claim removed and the cluster's
   array-walk idiom recorded; `run_output/autoloop/state.json` parked 16 → 14.
   `make check-all` passes 14/14.
2. `ovl_10_func_800B95F0` restructures cleanly to `[0,0,1,0]` at 301/301 words
   with one edit (`if/else if/else` on `D_800BB810[4]` instead of a
   pre-computed temp). The remaining transposition — `move s2,zero` three slots
   early in the case-3 loop preheader — survived ten distinct spellings and is a
   genuine `psx_search_scheduler_state` case.
3. `ovl_10_func_800BA394` stays parked, with the reason corrected to the F1
   container blocker.

---

## 6. What this changes about the loop's theory

The loop's doctrine is right and its instruments lag it. `SKILL.md` already says
never to steer by the word count, never to park because a function is hard, and
to read the author's idioms before modelling the compiler. What it lacks is an
oracle that can tell C from assembly, a residual that excludes what it cannot
judge, a memory of the best program it has produced, and any way to carry an
answer from one function to the next. Those four are what Phases 0–3 buy, and
they are what separates a loop that matched 42 functions from one that also
matches the nine it gave up on.

§4 is the compounding version of the fourth. Phases 0–3 make one project's loop
honest about where it stands; the corpus makes every function it matches an asset
for the next function, the next container, and eventually the next game. The
gradient tells the loop which way is downhill. The corpus tells it what downhill
looked like the last time somebody got there.
