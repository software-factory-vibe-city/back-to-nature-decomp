---
name: psx-decompile-function
description: Decompile or repair one function in an arbitrary PlayStation matching-decompilation project using m2c, diff classification, compiler tracing, target-schedule and scheduler-state constraint analysis, requirement-guided clean-C synthesis, exact function diffing, and full-build verification.
---

# PlayStation function decompilation

Work on exactly the target named in the invocation. Derive game, compiler,
assembler, SDK, build, layout, and language facts from the current project.
Do not commit or create a worktree unless explicitly requested.

## Mandatory context

Before editing, read completely:

1. `AGENTS.md`
2. `configs/project-profile.md`
3. `prompts/c-style-guide.md` — mandatory distilled matching doctrine, not an
   optional reference
4. the target source and original assembly
5. the target call-graph entry and relevant generated/shared declarations.
   For an indirect call, inspect the plausible table-member callees before
   accepting a callback prototype: meaningful values left in `$a1`--`$a3` at
   `jalr` may be dead address-generation state or delay-slot inputs, not
   callback arguments. The callee family's incoming-register reads decide
   arity; a wrong prototype adds call-setup moves and poisons every later web
   and allocation analysis.
   The profile's header table says which file each kind of declaration
   belongs in and which files are generated outputs. A global that needs a
   struct or aggregate type gets that type in the project's **override**
   header — never in the generated declarations header, never in a `.c` file.
   Editing a generated header looks like it works and is erased by the next
   regeneration; the generator skips whatever the override header already
   declares, which is the mechanism that makes the override the correct
   place. If a needed declaration seems absent, check the generated headers
   before adding an extern.
6. `notes/file-groupings.md` — the target's suspected source-file group, and
   any campaign, research, or retrospective note it points to. Same-file
   membership carries TU-level priors (shared register-variable quirks, idioms, global clusters,
   declaration-order effects). Update the ledger in the same session if you
   find grouping evidence — membership and one-line roles only; technique and
   per-function detail belong in `notes/research/` or `notes/retros/`.
7. Run `psx_scan_read_before_def` once. A finding
   means the function belongs to the register-variable / handwritten
   fingerprint class (policy-exception territory — see the research notes
   it cites), **or** that the symbol boundary is wrong and the body depends
   on a register set by the preceding symbol; rule out the boundary first,
   since it is cheaper. A clean scan rules both out before you hypothesize
   them.

   Prove the boundary whenever the symbol is tiny (under ~4 instructions),
   has no `jr $ra`, is entered by a `j` rather than a prologue, or shows an
   instruction-count delta no source shape moves. `make split` runs the
   merge detector, so re-running it is the first move on a stuck tiny
   function and a boundary that survives it is evidence rather than an
   assumption. A symbol that is not a function cannot be decompiled as one,
   and the failure is indistinguishable from a codegen impossibility —
   `notes/research/symbol-boundary-verification.md`.
8. Run `psx_triage` once, before authoring or
   perturbing source, and again after every structural edit. It works on a
   bare `INCLUDE_ASM` stub, so run it before you write the first line. It
   reports:

   - `frame-map` — the exact frame decomposition (outgoing argument area,
     locals, saved registers) and the signature the ABI implies. Stack
     parameter types are read off load width and signedness and are exact;
     take them, do not re-derive them. Do not report a frame size you did
     not get from here.
   - `sdk-idiom` — the PSY-Q packet types and macro operations present in the
     target: primitive initializers (including a base code composed with
     documented attribute bits such as semi-transparency), command packets
     with their recovered arguments, and complete tag-link operations. If it
     names a type, use that type and `#include "psyq/libgpu.h"`; the field map
     it prints names every offset the function touches. Hand-rolled bitfield
     arithmetic where the SDK has a macro is a reconstruction error, not a
     style choice, and this finding sorts ahead of `inventory` and the
     allocation/scheduling classes on purpose — see "Restore SDK operation
     boundaries first" below.
   - `inventory` — memory offsets, constants, and shift amounts as multisets,
     target versus your compiled source. These are invariant to scheduling
     and register allocation, so anything marked TARGET ONLY is a **semantic**
     defect: a field you never write, a mask you never apply. Fix every one
     before any allocation or ordering work. An empty inventory is a
     precondition for that work, not a nice-to-have.
   - `arity-frame`, `arity-stack`, `capture-ra`, `asm-policy`, `asm-dead` —
     the signature, ABI, debug-hook, and source-policy symptom classes.
   - `param-residence` — memory-resident parameter fingerprints: an incoming
     stack-argument slot re-read at each use, or a register argument stored
     to its own home slot and reloaded. Both are compiler-emitted patterns
     (reload spill or assign_parms homing), not source statements; when
     entry-block allocation or scheduling will not settle around them, test
     the memory-resident declaration (the style guide's parameter-residence
     section) before scheduler forensics.
   - `undeclared-callee` — a call with no declaration in scope (C89 implicit
     int). Blocker: the call defines `$v0` and rotates post-call scratch
     allocation from outside the function body. The finding prints the
     known-good declaration when `include/functions.h` has one.
   - `loop-nesting`, `loop-idiom` — loop structure read from the target
     alone, so both fire on a bare stub. Nested back-edge ranges need nested
     source loops, and a countdown latch means count-up source that the
     compiler reverses. Take the named shape as the DEFAULT when first
     authoring, not as a repair hint after a stall: the wrong loop idiom
     reproduces loop bodies byte-for-byte while silently fixing preheader
     order, loop-bottom order, and allocation in an unreachable state.
   - `flag-fingerprint` — symbolic lui/lw self-clobber pairs in the target:
     the per-file flag class (unsplit macro load / scheduling). When it
     fires, run `psx_flag_probe` before deep source archaeology and apply
     the style guide's flag-hypothesis bar; flags are per-TU facts, so
     check the file group first.

   Each finding cites the note covering it; read those when they fire. A
   `blocker` finding means the current direction cannot ship regardless of its
   diff score: fix the premise, do not proceed and file paperwork later.
   Detectors are cheap and incomplete; silence is not a certificate.

   `psx_frame_map`, `psx_sdk_idioms`, and `psx_inventory` also run standalone
   when you want one of them in full detail without the rest.

## Restore SDK operation boundaries first

When triage or `psx_explain_diff` names an SDK packet type or macro operation,
that comes before every compiler-state question, in this order:

1. run triage and `psx_sdk_idioms`;
2. reconstruct **all** named types and macro operations — initializer,
   attribute macros, field-group macros, command packets, and links;
3. re-run triage, the inventory, the exact diff, and the classifier;
4. only then trace allocation or scheduling;
5. if the remaining residual is order-only among adjacent independent SDK
   calls, run the bounded SDK-call statement-order search
   (`psx_search_residual_source_space`, or the `sdk-call-order` transform
   template through `psx_fuzz_variants` when the closure does not reach the
   region). Never permute the stores inside one macro expansion.

`psx_explain_diff` prints `SDK OPERATION-BOUNDARY CANDIDATE` above its
classification when a residual overlaps a recognized packet the source expands
by hand. Treat everything under it as provisional until the boundary is
restored: an allocation or scheduling classification derived from a
hand-expanded packet describes a program the original build never compiled.

Compact case (`notes/retros/2026-08-13-func_800134C4-retro.md`): a 106-vs-105
`instruction-selection` residual with a broad register rotation read as an
allocation problem. The target's code byte was `0x2A` — `setPolyF4`'s `0x28`
with `setSemiTrans`'s documented bit already applied — so nothing named the
primitive. Rebuilding the function as `setPolyF4` / `setRGB0` / `setXYWH` /
`setSemiTrans` / `setDrawMode` plus two `addPrim` calls put the count at 105
and removed the rotation, leaving only the birth order of four independent
initializer calls; the 24 dependency-valid orders were then exhausted directly.

## Prepare the target

In fresh mode, inspect `src/<target>.c`. Call `psx_m2c` only if it is missing
or still an assembly stub. Never overwrite an existing clean-C attempt. In
resume/fix mode, preserve the source and begin from its current diff — but
re-derive the classification yourself (triage, then `psx_explain_diff`)
before adopting any prior session's causal model. A research note's
quantitative allocator story (web counts, priority thresholds, live-range
figures) is one solution of an inequality, not a measurement of the
original; verify it against the current dumps before searching for the
shape it predicts, and prefer the visible diff's own structure (copy
directions, fresh-vs-reused destinations, spill-slot owners) as the primary
evidence. The style guide's resume section is mandatory here.

## Evidence-driven matching loop

1. Call `psx_explain_diff` before editing.
2. Apply only the fix class reported by the classifier and described in the
   mandatory style guide. Treat the classifier's WEB-PARITY and PROVENANCE
   sections as gates: unmatched register webs or a value-provenance
   divergence mean the SOURCE SEMANTICS differ from the target (missing
   masks/temporaries, an operand read from the wrong value behind a
   coincidentally matching register name). Fix those before any
   allocation or scheduling interpretation — an "allocation swap" with
   failing web parity is a symptom, not a cause. Any instruction-count
   delta beyond entry moves is structural; read the reported count-delta
   decomposition instead of treating it as allocation noise. A count delta
   accompanied by branch-sense differences is a **semantics** question:
   state what the target computes and returns in words, read out of its own
   branches, before interpreting anything else. Inherited header comments
   are not evidence, and a matched sibling in the same TU beats the raw
   disassembly. A wrong predicate produces a diff that reads convincingly
   as a web-parity blocker, and every tool downstream will analyse the
   wrong function without complaint.

   Once count, opcode multiset, inventory, and web parity are exact, freeze
   semantics and census the target's simultaneous hard-register roles. If the
   residual sits in or around a loop — preheader order, loop-bottom order, or
   an allocation swap between pseudos that live across the loop — run the
   style guide's loop-idiom batch FIRST (spelling, direction, increment
   position, bound type, invariant site: a bounded dozen compiles per loop).
   Loop spellings that emit identical bodies are different pass-time
   experiments, and every mechanism tool downstream analyses whichever frame
   you picked without complaint. For a residual rotation after that,
   explicitly test these compiler-state axes before broad
   permutation: top-of-block declaration initializer versus later assignment,
   one local reused for sequential roles versus fresh locals, coordinated
   base/offset/result birth order, and a named constant at the scheduler's
   required birth site. Preserve a lower-scoring variant when it solves one
   independently measured allocation relation; match percentage is not a
   mechanism verdict. The compact case study is
   `notes/retros/2026-08-10-func_8001A574-retro.md`.
3. The moment the classifier reports a scheduling category, call
   `psx_scheduler_trace` — before authoring a single source variant. The
   scheduler records its own per-cycle decisions in the ordinary RTL dumps,
   so this is a measurement of the choice rather than an inference from the
   emitted code, and it costs one compile. Read its unpromoted list first:
   a non-store insn is unpromoted when its destination pseudo is assigned
   more than once, which in C is a variable written twice, and that is
   usually the only source-visible lever on the order. Authoring variants
   before this is how sessions burn: source spellings that compile to the
   same RTL are the same experiment no matter how different they look, and
   the diff cannot tell you which axis you failed to move.

   For allocation, scheduling, operand-order that survives source-order swaps,
   or mixed categories, call `psx_compiler_trace` before further perturbation.
   Tie the next edit to a pseudo birth, death, lifetime, conflict, assignment
   pass, canonicalization rule, or scheduler decision. One narrow scheduling
   signature has a cheaper bounded response: when `psx_explain_diff` prints
   `EPILOGUE RETURN/JOIN SIGNATURE` (a constant return move crosses only stack
   restores while inventory and web parity are clean), run the trace once, then
   batch the natural CFG-equivalent forms before deeper scheduler work: positive
   body plus trailing return, inverted early-return guard, and returns in both
   predecessors when the target branch senses justify them. These forms can
   change basic-block note and sched2 provenance without changing executable
   body instructions; a named constant local is a different experiment and
   often has no effect. For statement-order questions (which global is touched
   first, where a pointer assignment sits in a branch), run
   `psx_mine_statement_order` — per-block
   emission-order evidence (hi16 formation order, store order, delay-slot
   occupant) constrains source statement order directly.
4. After every deliberate edit, call `psx_diff_function`. Reclassify whenever
   the mismatch signature changes or its cause becomes unclear.
5. If the mismatch is order-only inside a block of constant/pointer stores,
   run `psx_analyze_store_block` BEFORE any
   scheduler analysis. Mine the stored values for arithmetic structure
   (parallel arrays, pool-carving running sums, repeated constants) and check
   the constant birth-order fingerprint; statement order in natural data
   order usually resolves the block outright. Never derive statement order
   from the emitted store order (see the style guide's store-block section).
6. If the classified trace shows coupled scheduler, allocator, or delay-slot
   constraints, call `psx_analyze_target_schedule` before authoring more source
   shapes. Check emission alignment first: ambiguous machine/UID links must not
   be treated as concrete scheduler evidence. Distinguish target order that is
   merely legal under the candidate DAG from a target order reproduced by the
   bounded counterfactual. Use exact baseline replay and the reported decisive
   priority, last-scheduled dependency class, or block-local LUID relation;
   observational-only or unsupported resource windows do not justify a causal
   claim. Preserve any exact suffix and solved hard-register assignments named
   by the intervention set. If an order-only block remains stuck after bounded
   mechanism-directed shapes, or the replay requires several coupled hidden
   state changes, run
   `psx_search_scheduler_state` (block <n>). Require
   its candidate replay gate to be exact. Treat SAT as a web/boost/LUID/phantom
   specification for a small complete-source experiment, scoped UNSAT as a
   reason to stop only that serialized domain, and INCONCLUSIVE or
   model-replay failure as no proof. Never promote a solver witness directly.
7. If several mechanism-backed source shapes remain, first call
   `psx_search_residual_source_space` with `deriveOnly` to price the domain.
   Read the exact size, the per-axis radix breakdown, and the projected wall
   time before launching a full run; a `domain-too-large` result names the axis
   responsible, and the only lever on it is a smaller residual, which is real
   work rather than a flag. Then run it to exhaustion. The domain is derived
   from the current source and the current machine residual, so re-derive after
   any source edit rather than trusting an earlier price. Its terminal states
   are honest and mean different things: `exact` found a byte-identical
   candidate, `exhausted-no-exact` evaluated the whole domain and is a claim
   about the recorded grammar schema and its suppression list only, and
   `unsupported-*` means the source or correspondence could not be modelled at
   all. Read the suppressed-rule list before concluding a representation does
   not exist. If the closure does not reach a hypothesis the trace names, or
   the run reports it unsupported, compare a small hand-authored set with
   `psx_fuzz_variants`, or author an explicit finite specification for
   `psx_search_source_shapes`. In that fallback, for a `priority-relation` test
   the reported single-set/birth-eligibility web before unrelated statement
   permutations, and for a `luid-order` test source birth/constant sites while
   preserving the dependency graph. Search only after the trace/analysis names
   concrete mechanism requirements and semantic invariants. Inspect preserved
   generated sources under `build/`; never copy a result automatically. A
   `deriveOnly` residual run compiles pilot coordinates to price the domain, so
   inspect the best preserved pilot class before launching exhaustion — it may
   already contain the missing declaration initializer, sequential local reuse,
   or statement interaction. Confirm it with the exact relocated function
   oracle because search alignment and byte comparison are not interchangeable.
   Rank requirement and mechanism evidence before match percentage. Never
   promote a cc1-only result: require full configured assembly, then re-run the
   exact function diff.
8. Keep changes within project policy and put shared types in the headers the
   profile designates rather than conflicting with generated declarations. A
   type fix belongs in the override or shared-type header; hand-editing a
   generated header is not a fix, and a local redeclaration that silences the
   compiler has moved the defect rather than removed it.

Do not run raw `diffFunc.ts --src` commands concurrently: alternate-source CLI
compiles can share intermediate paths and cross-contaminate variant results.
Use `psx_fuzz_variants` or the isolated source-search tools for parallel work,
or run raw alternate-source diffs sequentially.

If a source change has no effect, locate the first divergent compiler dump and
read that exact pass in the vendored compiler source before trying another
shape. `psx_compiler_source` searches the vendored source of the exact compiler
this project builds with: its `pass` command names the passes a dump's contents
came from and the flag that gates them, `def`/`body` print a function or macro with its file and
line, and `pattern` prints a machine-description pattern. The tree is
`tools/vendor/gcc/<version>`, resolved from the Makefile's `GCC_VERSION`. Prefer one read of the
pass that decides the thing over another round of source shapes; a proof that
a form is unreachable ends a search, and a failed experiment does not.

## Finish

A function is accepted on byte-level evidence: `diffFunc` must report
`VERDICT: MATCH`, and the full binary must still match. `diffFunc` resolves
relocations against the original addresses before comparing, so symbol
identity is visible in the diff itself — two same-shaped accesses to
different globals show up as differing words, and the fix is to swap the
order of the corresponding accesses in the source. `UNDETERMINED` is a third
outcome, not a near-match: a relocation the tool could not resolve, named on
its own diff line. Resolve it rather than reading past it.

At a byte-verified match, call `psx_export_context` for the target and then
`psx_finalize_function`. The finalizer independently checks the exact function,
full binary, modification scope, and clean-source policy. Continue from any
concrete finalizer failure; do not report success early.

## Clean-source gate

For an ordinary compiled function, a byte match is failure if it introduces
register pinning, embedded/top-level assembly, a new assembly stub, or a
copied legacy workaround. Honor only handwritten-assembly exceptions
established by project classification. A per-file flag override is
acceptable when the style guide's flag-hypothesis evidence bar is met
(fingerprint + dominant flag column + no contrary regional witness) and the
override ships with its evidence comment and allowlist entry in the same
change; an override without a fingerprint is still failure. A
zero-instruction scheduling barrier is a documented last resort under the
style guide, not a substitute for diagnosis.

**Do not record an exemption for a function you could not match.** An
allowlist entry asserts, permanently and to every later agent, that the
exempted construct is the correct answer for that function. Being stuck is
not that assertion, and a wrong one is expensive: an `embedded-asm` entry
recorded this way outlived a symbol-map defect and cost a later session.
File the obstacle instead.

**Leave the best attempt in place.** Do not restore the `INCLUDE_ASM` stub,
revert the file, or otherwise discard a non-matching attempt on your own
initiative. The best clean-C state and its diff signature are the next
session's starting point, and they are worth more than a tidy tree. Retiring
a function from the worklist is a separate, explicit instruction; act on it
only when you are given it.

## Targeted deep research

The style guide already contains the mandatory distilled findings, and
`triage.ts` cites the note for every symptom it recognizes. Beyond those, the
project's written knowledge lives in four places, and lookup is by **symptom**,
not by title — a note named after one function routinely carries the general
mechanism that explains another:

- `notes/research/` — mechanism case studies, one per diagnosed phenomenon
- `notes/retros/` — solved-function post-mortems, including what was tried
  and rejected and why
- `notes/file-groupings.md` — TU membership and the campaign notes it links
- `prompts/c-style-guide.md` — the distilled, always-applicable doctrine

Search these by the signature you are actually looking at (frame size, an
unexpected stack load, `$ra` stored through a non-`$sp` base, a store-block
ordering gap, an allocation swap that survives source-order swaps), not by
the target's name. Grep across all four rather than browsing one directory's
titles. Select only the case study whose documented mismatch signature matches
the current one; do not load every note indiscriminately. For a suspected
compiler/assembler boundary, select the project's boundary-analysis note
rather than an unrelated allocator case study.

Do not defer this until stuck. The cheapest signals — frame size, argument
area, stack-argument offsets — are readable from the first compile, and a
wrong structural premise cannot be recovered by scheduling or allocation
work downstream.

When a note's structural claim (an arity, a register assignment, an argument
mapping) contradicts the assembly, the assembly wins. Correct the note in the
same session; a wrong note propagates into every attempt that follows.

If still stuck, leave the best clean-C state and report the category, first
remaining divergence, compiler-pass evidence, and structural hypotheses
tested. Do not commit.

## Reporting discipline

Every claim about the target must be traceable to the assembly line it came
from or the tool that measured it. Frame sizes, instruction counts, shift
amounts, and register assignments come from the tools, not from recollection;
report each one once and consistently.

The failure this prevents is describing your own compiled output and
labelling it the target — proposing that target structure be removed because
your version came out degenerate, or citing an instruction the target does
not contain. A claim you cannot point at does not go in the report.

Two corollaries. Register allocation is not a root cause while web parity or
the inventory is failing; it is a symptom of one. And a fix C cannot express
is not a work item.
