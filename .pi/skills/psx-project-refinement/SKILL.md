---
name: psx-project-refinement
description: Perform one conservative cleanup batch in an arbitrary PlayStation matching-decompilation project, deriving all game-specific facts from that project's configuration and preserving full binary identity.
---

# PlayStation project refinement

Perform one coherent, reviewable batch rather than an open-ended rewrite. Derive all game, binary, toolchain, SDK, layout, path, and language details from the current project's instructions and generated profile. Never import assumptions from another PlayStation game. Do not commit.

## Survey

1. Read `AGENTS.md`, `prompts/c-style-guide.md`, and `configs/project-profile.md`.
2. Call `psx_verify_build` to confirm the starting tree passes full byte-identity verification.
3. Survey matched source files, shared headers, and the call graph. Choose one high-confidence batch such as:
   - consolidating one proven shared struct across its users
   - correcting one family of generated-global/address references
   - propagating one proven caller/callee type
   - applying meaningful local names and comments to one related function cluster

Avoid speculative symbol renames. If a rename is exceptionally well supported, discover and update every source, configuration, and generated-context location required by the current project before regenerating build artifacts.

## Execute one batch

- Keep the batch small enough to review as one diff.
- Call `psx_diff_function` after every risky source or type change.
- Do not introduce register pinning, embedded assembly, assembly stubs, flag overrides, or any workaround forbidden by project policy.
- Do not hand-edit generated files.
- Follow the project's required C standard and comment style.

## Verification

Run the active project's clean regeneration commands as separate shell steps,
then call `psx_verify_build`, `psx_export_context` with no function to export
all signatures, and `psx_verify_build` again. Derive the regeneration commands
from the current project rather than assuming them in the skill.

If verification fails, repair or revert the batch before stopping. Inspect the final diff and report the evidence for each change and every verification result. Do not begin a second unrelated batch and do not commit.
