# Hard-function automation gaps

Captured 2026-08-15 after func_8001A284 (cross-jump orphan / nested-switch
dispatch). Goal: move this class of function from "frontier model required"
to "small model + tools." Sketches only — expand when picked up.

Priority order: 2, 1, 3, 6, 5, 4.

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
lattice. Compiles are ~30-50ms; candidate generation is the bottleneck,
not evaluation.

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
a wrong structure and a wrong override as fact.

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
