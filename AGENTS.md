# Repository Agent Guide

This is the top-level guide for any agent working in this repository. It
contains repository-wide policy and routes task-specific work to the relevant
instructions. It is not a function-decompilation prompt.

## Sources of truth

- `configs/project-profile.md` is the sole prompt-facing source for concrete
  target and toolchain facts. Do not duplicate those facts in guides, skills,
  or prompts.
- `README.md` documents project architecture, setup, build flow, and the tools
  inventory. Read it for project-level, build-system, or tooling work.
- The active project configuration and generated artifacts are authoritative
  for paths, symbols, sections, and build behavior.

## Route by task

- Matching or repairing one function: load
  `.pi/skills/psx-decompile-function/SKILL.md` and follow its mandatory
  matching guide. Check `notes/file-groupings.md` for the target's
  suspected source-file group and update it when you find grouping
  evidence.
- Refining an already-matching function: load
  `.pi/skills/psx-refine-function/SKILL.md`.
- Performing a conservative cross-file cleanup batch: load
  `.pi/skills/psx-project-refinement/SKILL.md`.
- Changing Pi extensions, skills, commands, or autonomous workers: read the Pi
  documentation named in the harness instructions and inspect the relevant
  `.pi/` implementation and tests.
- Changing build or diagnostic tooling: read `README.md` and
  `notes/tools-directory-structure.md`, then inspect the active Make/config
  dependencies before editing.
- Changing project fundamentals: read the current roadmap and the relevant
  institutional notes before acting; do not re-derive settled facts already
  supplied by the generated profile.

## Repository-wide rules

- Never commit unless the user explicitly asks. Never commit generated or
  extracted binary artifacts.
- Tooling is TypeScript and runs through `npx tsx`. Do not check in Python
  scripts.
- Put tools, configuration, and headers in the repository's established
  directories rather than creating parallel structures.
- C source follows C89: declarations at the top of a block, `/* */` comments,
  and no C99 features.
- Do not hand-edit generated files. Change their source configuration or
  generator and regenerate them.
- Do not redeclare generated globals in source files. Put shared parameter or
  local types in the designated shared type header and global type overrides
  in the designated override header. A source file must, however, *define*
  (tentatively) every global whose translation unit it is — that is how
  GP-relative addressing is expressed; see the style guide's small-data
  section. A definition is not a redeclaration.
- Preserve the clean-source policy. For ordinary compiled functions, embedded
  assembly, hard-register pinning, and new assembly stubs are not valid
  decompilation solutions. Honor only exceptions established by the active
  project's classification and policy. Unless explicitly specified by the user.
- Per-file compiler flag overrides are permitted when the flag-probe evidence
  bar is met (target fingerprint + dominant flag column + no contrary regional
  witness): add the override with its evidence comment and the matching
  allowlist entry in the same change. Flags are per-TU facts of the original
  build, not hacks. Speculative flag-shopping without a fingerprint remains
  forbidden. See the style guide's flag-hypothesis section.
- Keep edits scoped to the requested task. Do not opportunistically rewrite
  unrelated files.

## Verification discipline

Use the narrowest relevant check while iterating, then run the repository's
full verification gate before reporting success. A generated binary match does
not excuse forbidden source constructs, out-of-scope edits, or hand-edited
generated files.

When a verification step fails, continue from its concrete output or restore
the last known-good state. Do not leave unrelated source broken to preserve an
experiment.

## Repository layout

- `src/` — function source files
- `include/` — common, generated, shared-type, override, and SDK headers
- `configs/` — project configuration and generated profile
- `.pi/` — active Pi commands, skills, tools, and autonomous workflow
- `tools/` — build, diagnostic, matching, and shared TypeScript tooling
- `prompts/` — mandatory matching doctrine and archived standalone templates
- `notes/` — roadmap, retrospectives, research, and institutional memory
- `build/` — generated build and diagnostic artifacts
- `extracted/` — local extracted inputs

Follow more specific task instructions after this guide; when they conflict
with repository-wide policy, stop and ask rather than silently weakening the
policy.
