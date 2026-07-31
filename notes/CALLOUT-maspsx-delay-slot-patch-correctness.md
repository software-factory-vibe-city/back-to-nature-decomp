# CALLOUT: is the maspsx delay-slot patch actually correct?

**Status: open research topic — needs discussion and exploration before the
patch is trusted, upstreamed, or made permanent.** Mechanics and current
state are in `notes/maspsx-issue3.md`; the patch itself is
`tools/vendor/maspsx-delay-slot-fill.patch` (applied locally, uncommitted).

## The question

The patch makes maspsx fill a branch delay slot with a following lui-only
`li` instead of emitting `nop`. It produces the right bytes for the one
site in our corpus that exercises it (func_80021820,
`li $10, 0x1000000`). That is one data point, not a model of ASPSX. We do
not currently know whether this reflects real ASPSX 2.77 behavior or is an
ad-hoc tweak that happens to fit one function.

## What "correct" would require establishing

1. **Semantic safety conditions.** Moving the `li` into the slot makes it
   execute on BOTH branch outcomes, where the original (post-branch)
   position executed it only on fall-through. Real ASPSX must have had
   rules for when this is legal (target register dead on the taken path,
   not consumed by the branch, etc.). The patch checks none of this.
2. **Fidelity evidence.** Does real ASPSX 2.77 actually do this fill, and
   under which conditions/flags? Avenues: run period ASPSX.EXE (psyq_sdk /
   homebrew-psyq vendor trees) on the exact cc1 output and diff objects —
   the project already treats assembler-emulation questions this way
   ("assemble identical compiler output through the reference and
   replacement assemblers"); check ASPSX documentation for its reorder /
   optimization options; survey other PSX binaries for more witness sites.
3. **Generality.** The current trigger test is crude (decimal-literal `li`
   parse only, lui-only values, no register-liveness check). If the
   behavior is real, the correct predicate is probably broader (other
   single-instruction fills?) and needs deriving from evidence, not from
   one site.
4. **Upstream story.** If validated, this belongs in mkst/maspsx (the
   project has upstreamed maspsx gaps before — see maspsx-issue.md /
   maspsx-issue2.md). If refuted, func_80021820's eventual clean re-decomp
   must produce the delay-slot `lui` some other way (different cc1
   scheduling from the correct source may dissolve the question entirely).

## Why it matters

func_80021820's current byte-match depends on this patch. Until the
question is settled, that match is provisional, and any future function
hitting the same branch-then-li shape will re-raise it.
