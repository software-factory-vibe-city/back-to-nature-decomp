# Boundary-premise triage

**Status: implemented** as part of `plans/implemented/lib-member-name-collision-repair.md`.

Before interpreting a region as compiled game C, triage reads its original
bytes and the immediately following object from the container's generated
layout. `tools/lib/sdkProvenance.ts` supplies the pure check;
`tools/agent/triage.ts` emits `boundary-premise` before compiler-state findings.

- No return or external tail transfer within the region: **signal**. This
  alone is not proof of a bad boundary; valid noreturn code exists.
- Immediately following SDK object consists only of `jr $ra` and zero
  padding and has no relocations: **signal**. A generated symbol name is
  not independent placement evidence.
- Both together: **blocker**. Validate the extent/SDK ownership before
  reconstructing C, rather than tuning the allocator for an incomplete body.

Signature detection excludes return/padding objects from its placement
candidates, regardless of exe.txt. Dependency placement may use actual
relocations from verified SDK callers (independent evidence), but refuses a
return-only object which would split a preceding game's missing epilogue.

Regression: the original `func_80038674` layout covers ROM
`0x28E74..0x28EC4`, omits its return, and abuts the falsely placed `dmynot1`.
It fails both checks. The repaired `OuterProduct0` SDK extent
`0x28E74..0x28ED4` contains its own return and passes. The test reads the
original binary, not reconstructed C (`tools/build/sdkMembers.test.ts`).

This is a conservative extent check, not a whole-program termination proof
or a rule that every function in the SDK band is library code. Tail calls are
accepted; neither a lone signal nor a library-band address licenses deleting
source or inventing a boundary.
