# Phase 4 — This binary's difficult features

**Status: proposed.** Builds on connected execution from
[Phase 3](phase-03-connected-programs.md). Independent workstreams below can
run in parallel once their shared state/runtime contracts exist.
See the [overview](overview.md) for historical target observations.

## Goal

Close measured coverage gaps for the chosen target corpus, without confusing
successful decoding with executable support or inheriting old measurements
as claims about every container.

## Begin with a census

Use the original words and existing discovery artifacts to inventory all
required instruction classes, indirect transfers, coprocessor operations,
overlays, and memory regions across the selected containers. Report scope
and unresolved discovery explicitly. Use this inventory to order the work.
Historical GTE counts in the overview describe their measured text region,
not guaranteed coverage of the entire game including overlays.

## Workstreams

### Coprocessors and GTE

- Implement explicit semantics or runtime helpers with documented contracts.
- Validate register moves, FIFOs, flags, saturation, and supported compute
  operations—not just final projected coordinates.
- Use independent execution comparisons and hardware-backed conformance
  suites such as `psxtest_gte`, then exercise actual translated game blocks.
- State timing and interaction assumptions rather than deriving them merely
  from the fact that compiled code appears scheduled.

### Overlays

- Consume the existing archive, member, base-address, and layout recovery.
  Do not build a second overlay-discovery pipeline.
- Compile recovered code images ahead of execution.
- Select translated destinations according to the code currently resident
  at each guest address; a numeric address alone is not a permanent identity.
- Test load/unload transitions and cross-container calls.
- Report unexpected executable-memory writes or unknown images rather than
  continuing with stale translations.

### Irregular control flow and memory

- Cover remaining computed destinations and unusual entry/return behavior.
- Exercise scratchpad access, guest stack switching, and memory aliases.
- Distinguish ordinary RAM from observable external accesses through the
  memory/runtime contract.
- Record unsupported behavior by location and required capability.

## Proposed completion evidence

Every feature required by the declared corpus is either supported and tested
or identified as a precise outstanding blocker. An unmodelled operation must
not count as translated, and a matched SDK signature does not itself supply
an executable replacement.

Any blockers carried forward bound subsequent execution claims; this phase
is not declared universally complete because one workload avoids them.

## Handoff

[Phase 5](phase-05-realistic-validation.md) tests the assembled capabilities
against realistic states and longer execution, including overlay transitions.
