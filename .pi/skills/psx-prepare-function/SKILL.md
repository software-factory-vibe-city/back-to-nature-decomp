---
name: psx-prepare-function
description: Prepare one function's m2c draft to compile with the project's real headers, evidence-backed declarations and SDK idioms, then hand the candidate and a concise summary to the matching tier. Compilation, not byte matching, is the goal.
---

# Prepare a function for matching

Your role is **prep**, not solver. Work only on the named function and the
headers it needs. Get the actual C candidate compiling, establish its context,
then stop. Do not tune allocation, scheduling or byte similarity. Do not load
the matching skill or its long matching guide for this task.

## Start from the supplied draft

Read the measured source, selected context and compile diagnostics named in the
prepared handoff. If no packet was supplied, call `psx_m2c` for the target.
Use the tool's source/destination paths; overlay paths must not be guessed.
Preserve raw m2c output and any existing clean-C attempt. Edit the primary draft
under `build/` when the live source is still an assembly stub; the untouched
stub compiling does **not** prove the draft compiles.

Read `configs/project-profile.md`, especially **Headers — where a declaration
or type belongs**. It supplies the current toolchain and authoritative header
roles; do not infer these from an m2c declaration.

## Repair context and compilation

- Include the project's umbrella header instead of copying its scalar typedefs.
  Reuse existing structs, declarations and SDK types before creating new ones.
- Put data-symbol aggregate types and overrides in the profile's override
  header (here, `include/globals_override.h`, not a new `global_overrides.h`).
  Follow that header's existing addressing/alias idioms. Put shared parameter
  and local types in the profile's shared-type header (`include/game_types.h`).
  Do not leave duplicate global externs or shared typedefs in the function file.
- Never hand-edit generated headers such as `include/globals.h`,
  `include/functions.h` or the generated m2c context headers. After adding a
  global override, regenerate globals through
  `npx tsx tools/build/classifyGlobals.ts --write` if required to remove its
  old generated declaration. Do not export an unmatched function as verified.
- A translation-unit-owned global's tentative **definition** belongs in its
  source file; it is not a redundant extern. Preserve ownership supported by
  the target. Do not resize globals to change addressing.
- Resolve callee signatures from SDK headers or the callee's own code.
  `psx_callee_truth` and `psx_frame_map` can answer concrete declaration/ABI
  questions. Use the draft's `src` path for audits that accept it. Do not invent
  prototypes, layouts or dummy bodies merely to silence an error.
- Read supplied SDK findings, or call `psx_sdk_idioms` when they are missing.
  Use the SDK's packet types and macros instead of m2c's hand-expanded stores
  when the evidence identifies the operation. Leave uncertain facts explicit.
- Use C89: declarations first in a block, `/* */` comments, no C99 syntax.
  No new assembly, register pinning, flag overrides or policy exemptions.

Call `psx_c_source_guard` before moving or replacing C. Refresh `psx_m2c`
after repairs: it preserves edited primary drafts and measures them with the
production headers/compiler/assembler. Fix compile errors and rejecting type
warnings, not the byte residual. Keep unrelated source buildable.

## Finish and hand off

Stop when the candidate compiles and its required declarations are in the
proper headers. Safe staging with `psx_m2c`'s `stage: true` is optional; if
staging is refused, preserve the draft and report why rather than overwriting
live work. A compiling staged draft is a valid prep output. Do not run full
matching finalization, commit, create a worktree or chase a match.

Report the candidate and packet paths, changed headers, SDK operations
restored, the actual compile result, and any unresolved types/contracts or
integration blockers. When the loop asks for `psx_loop_prep_handoff`, record
`candidatePath`, `headerChanges`, `sdkIdioms`, `compilation` and `unresolved`,
then stop. The next tier gets the same candidate and
refreshed context plus your summary. If compilation cannot be repaired from
the available evidence, identify the remaining error honestly; do not fake a
successful candidate.
