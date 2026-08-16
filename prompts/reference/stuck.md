# When a form reads as unreachable

Before modelling a compiler pass, audit the facts the function is compiled
under. Each of the inputs below has produced a wasted session in this
project, every one presenting as a genuine codegen impossibility — because
from inside the function that is exactly what it looks like.

Loaded on demand by `psx_reference`. Read the sheet for the pass the
pipeline reversal named, and only that one.

---

## 10. Escape hatch and targeted research

### Before modelling a pass, audit the facts outside the function

When a form reads as unreachable, the wall is often not in the codegen at all.
Three inputs are taken as given by every downstream tool, and each has produced
a full wasted session in this project — each presenting as a genuine codegen
impossibility, because from inside the function that is exactly what it looks
like. Check all three before modelling a compiler pass:

1. **The symbol boundary.** A symbol that is not a function cannot be
   decompiled as one. Re-run `make split` on a stuck tiny function; a boundary
   that survives the merge detector is evidence rather than an assumption. See
   `notes/research/symbol-boundary-verification.md` for the decisive evidence
   list (no `jr $ra`; a conditional branch crossing the boundary in *either*
   direction; a `j` entry with no callers; read-before-def; zero callers).
2. **The declarations in scope.** An override's width and size change load
   width, signedness, and address form. See §7.
3. **The predicate.** See §1.
4. **The idiom frame.** A source structure transcribed from the emitted shape
   (a countdown loop, a walking pointer, a hand-rolled guard) can byte-match
   the code it was copied from while fixing the pass-time geometry —
   which blocks exist at gcse time, which notes the loop passes see, which
   births the allocator counts — in a state no statement-level edit escapes.
   When a mechanism analysis concludes "the CFG must differ from this
   reconstruction," that is the finding: run the loop-idiom batch in §4
   before reading another pass.

An impossibility result is conditioned on its inputs. "Proven unreachable" in a
note or ADR is true *given* what it assumed; re-read the assumption before
accepting the wall. A capable, internally consistent analysis aimed at the
wrong premise emits no signal that it is aimed wrong.

### Reading the compiler

When several traced, mechanism-directed source edits fail, stop permuting and
locate the active compiler's exact source in the project. Relevant passes often
include CSE, combine, arithmetic expansion, address legalization, local/global
allocation, and scheduling. This is observability only; never patch the
compiler to make reconstructed source match.

Load historical research by signature, not as a wildcard. Inspect titles and
opening summaries first, then select only the case study matching the current
problem family: allocation/scheduling dependencies, persistent operand webs,
semantic arithmetic decoding, address legalization, canonicalization, or a
compiler/assembler boundary.

An assembler-emulation gap is proven only by assembling identical compiler
output through the reference and replacement assemblers and comparing objects.
Failure to find a C shape is not proof of an assembler bug.

## 13. Resuming a stuck function: re-derive before you inherit

Re-run `psx_reverse_pipeline` first, then triage and the diff classifier, and
rebuild the causal picture from the current output before adopting any prior
session's model. The reversal is first because it is the cheapest way to
discover that an inherited story is about the wrong pass: it reads the residual
owner out of the bytes and the candidate object alone, with no dependence on
what anyone concluded earlier.

- A note's quantitative allocator model (web counts, priority thresholds,
  live-range figures) is one solution of an inequality fitted to a past
  candidate, not a measurement of the target. Verify it against the
  current `.greg` dispositions, conflicts, preferences, and allocno order
  before searching for the shape it predicts.
- At high match depth the word count is step-shaped: it can sit flat
  across several correct edits. Once the count delta is small, read
  web-population evidence instead — register dispositions and per-allocno
  conflicts/preferences in the dumps, and in the diff itself the copy
  directions, fresh-versus-reused destinations, and spill-slot owners.
- Treat a note's reachability verdicts ("this form is / is not reachable
  without X") as hypotheses. When the assembly or a pass-source proof
  contradicts a note, the note is wrong: correct it in the same session,
  dated, in place.
- Most "proven blocked" conclusions are conditional and do not say so. A form
  shown to be unreachable *given the schedule or allocation the previous
  attempt happened to produce* is not unreachable when that state is itself
  what you are changing. Before inheriting a block, ask what it was conditional
  on; if the answer is a pass state the residual owner says is still open, the
  block is not proven.
- Allocno priorities are integer quotients; a one-insn change in total
  live length can flip a rank tie through a floor boundary. Do not chase
  such a swap with source edits until the instruction count is final.
- Two phrase-level variants that produce identical `.lreg` quantity
  structure are the SAME experiment; the match score cannot distinguish
  them. When refs, lifetimes, and birth order are all pinned by the
  dependency graph, a local-alloc tie is structural: stop permuting the
  family and change the web population (a shared multi-block variable, or
  a fused temporary) instead. A scheduler-state UNSAT over a domain
  derived from the wrong model is a correct proof about an irrelevant
  space.

