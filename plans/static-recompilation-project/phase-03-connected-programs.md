# Phase 3 — Connected programs

**Status: proposed.** Builds on the architectural state and sequencing rules
from [Phase 2](phase-02-architectural-foundation.md).
See the [overview](overview.md) for the modular pipeline.

## Goal

Execute connected blocks, substantial functions, and call chains as native
code while preserving the original machine's control-flow semantics.

## Work

1. Build guest-address-to-translated-block dispatch from the discovery
   contract. Original addresses identify guest destinations, not host pointers.
2. Support conditional branches, fallthrough, loops, direct jumps/calls, and
   discovered indirect destinations. Diagnose unresolved transfers rather
   than choosing a plausible target.
3. Carry guest registers, memory, pending loads, and other required state
   across every block boundary. Initial dispatch may be deliberately simple;
   no instruction decoding is needed during ordinary translated execution.
4. Treat calls and returns as architectural effects. A call does not imply a
   recovered C prototype or an ABI clobber summary; `jr $ra` is not inherently
   a native stack return. Preserve unusual stack/register use.
5. Use real functions and connected regions from the repository as a corpus.
   Reuse discovered CFG and reference information without requiring matching
   C or assuming function boundaries are complete.
6. Introduce explicit external-operation contracts where needed for tests.
   Controlled implementations or recorded responses must be identified as
   test fixtures, not passed off as faithful device/SDK replacements.
7. Preserve block and original-instruction provenance in execution traces.

Guest memory is shared across calls. Do not reconstruct globals as native C
objects or translate guest pointers into host pointers merely to simplify
this phase.

## Validation

- Compare complete call chains and loops against the independent reference.
- Exercise direct and indirect transfers, nested calls, shared tails, and
  architectural state that crosses transfers.
- Compare ordered effects as well as final state.
- Include tests where an unknown destination produces an explicit failure.
- Ensure execution does not depend on host call-stack behavior unless that
  optimization has separately been justified.

## Proposed completion evidence

Substantial original functions and connected call chains execute natively
with matching state and effect traces under the declared environment. The
result is a functioning recompiler with a bounded supported environment,
not yet a complete game runtime.

## Handoff

[Phase 4](phase-04-target-coverage.md) uses a measured census to identify the
remaining architectural and container features needed by this binary.
