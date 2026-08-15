# Hard-function automation gaps

Captured 2026-08-15 after func_8001A284 (cross-jump orphan / nested-switch
dispatch); item 7 added the same day after func_800136D4 (wrong
parameter-residence frame). Goal: move this class of function from
"frontier model required" to "small model + tools." Sketches only — expand
when picked up.

Priority order: 7, 2, 1, 3, 5, 4 (6 built). Item 7 first because it is the
cheapest and would have collapsed the func_800136D4 session outright.

## 1. Insn-lifecycle narrator over pass dumps

Post-processor on compilerTrace's dumps: for each insn UID, diff its
presence/pattern/notes across consecutive dumps and emit a lifecycle
("born in .rtl → src rewritten add→const in .jump2 → deleted in reorg →
moved into delay slot of insn N"). Replaces hand-grepping dumps to answer
"which pass produced/killed this insn."

## 2. Dispatch-idiom detector (control-frame classifier)

Sibling of triage's loop-idiom: match the target's compare/branch trees
against expand_case's own dispatch generation (vendored stmt.c) and report
"this tree = switch over cases {0..2} (balanced, middle-first)" vs
"source-order if-chain." Wrong control frame is the top silent
session-burner; the balanced compare order was the key that cracked
func_8001A284.

## 3. Structural axes for the variant generator / searchers

Encode the style guide's prose batches as tree-sitter AST transforms so
searchers can propose structure, not just orderings: control-frame lattice
(if-chain ↔ nested switch ↔ goto-join), shared-tail lattice (single copy +
goto ↔ duplicated per arm), temp-spelling lattice (inline expr ↔ fresh ptr
temp ↔ shared value temp), constant-birth-site lattice, existing loop-idiom
lattice, and the declaration/residence lattice from item 7 (BLK ↔ plain
parameter, s16 ↔ int params, TU-ownership of globals). Compiles are
~30-50ms; candidate generation is the bottleneck, not evaluation.

## 4. Inverse jump-optimizer (searchJumpOptState)

jump2's rewrites (cross-jump incl. the REG_EQUAL equivalence rewrite,
threading, tensioning) are small deterministic graph rewrites — model them
like searchSchedulerState and answer "what pre-jump2 configuration yields
this post-jump2 block/label shape," emitting source-level requirements
(e.g. "two const-equivalent copies; deleted side's backward walk hits a
CODE_LABEL"). Most powerful, most work; 1+2 cover much of its value.

## 5. Retro→detector discipline + evidence-only parks

Make "add the triage detector" a required output of a hard solve (like the
file-groupings update). Parks must preserve measurements (diffs, dump
excerpts, table bytes), not interpretations — func_8001A284's park asserted
a wrong structure and a wrong override as fact. Second exemplar
(func_800136D4): the param-residence census's bare "HOMED" tag and a source
comment asserting the BLK reading were interpretations a later session
inherited as instructions; the plain-declaration alternative was one
compile away the whole time. Detector owed by that solve: param-residence
fingerprint + allocation-rotation classification + K byte-identical
spelling variants → compile the flipped residence reading.

## 6. Jump-table rodata attribution tool — BUILT 2026-08-15

`tools/build/deriveRodataSplits.ts` derives the whole game-rodata
subsegment block: attribution iff the owner is compiled C (no active
INCLUDE_ASM), extent = the owner's .o .rodata section size (which derives
pad residues like the 4-byte zero at 0x940 mechanically), table address
from the owner's original code (lui/addiu into the window + jr). Check
mode exits 1 on drift; --write regenerates the block. Wired into the
Makefile (2026-08-15): the link rule checks and self-heals on drift
(rederive → make split → rebuild once, with a retry guard), and `make
check` runs the check unconditionally so a stale-tree edit is caught
without a relink. The autoloop inherits both through its make calls.

## 7. Frame-fork sweep before forensics + experiment hygiene

Captured 2026-08-15 after func_800136D4 (a long, internally consistent
allocator/scheduler forensics session inside a wrong frame; the fix was a
one-compile declaration toggle sitting in the function's own `.bak`).
Three pieces, all cheap:

- **Frame-fork sweep.** Enumerate the discrete structural forks whose
  choice conditions everything downstream — residence reading (BLK ↔ plain
  parameter), s16 ↔ int params, TU-ownership of touched globals, loop
  idiom, dispatch frame — compile every combination the fingerprints make
  plausible (each is 1–3 compiles), and record the per-fork scores BEFORE
  any mechanism work. Standing rule for the loop: **no forensics while an
  unmeasured frame fork exists**; every escalation level that exhausts
  returns here first. The BLK↔plain fork is invisible to spelling-level
  search (the residual-source-space grammar cannot flip a declaration) and
  decides which insns even exist at sched1/lreg time — reload-born loads
  vs block-0 loads shifted every quantity span and flipped the whole
  s4–s8 cascade.
- **Experiment ledger.** Hash each variant's object; byte-identical
  results do not count as new experiments, and repeated re-spelling of a
  canonicalized web (CSE collapses every constant-web spelling) triggers
  the stall rule below instead of another variant. The style guide states
  this; nothing enforces it.
- **Stall trigger + resume-time artifact scoring.** K consecutive
  identical-output experiments with a frozen score ⇒ mandatory §10 frame
  audit (boundary, declarations, predicate, idiom frame) run as a TOOL,
  not prose. On resume, diff-score every preserved artifact (`.bak`,
  search-preserved candidates) as step zero — inherited source embeds the
  prior session's frame decisions invisibly.
