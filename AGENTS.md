# Repository Agent Guide

This is the top-level guide for any agent working in this repository. It
contains repository-wide policy and routes task-specific work to the relevant
instructions. It is not a function-decompilation prompt. Follow more specific
task instructions after this guide; when they conflict with repository-wide
policy, stop and ask rather than silently weakening the policy.

## Route by task

- Preparing m2c output to compile (autoloop `prep` role): load
  `.pi/skills/psx-prepare-function/SKILL.md`. This is preparation, not matching;
  hand the compiling candidate and context to the next tier.
- Matching or repairing one function: load
  `.pi/skills/psx-decompile-function/SKILL.md`. Check `notes/file-groupings.md`
  for the target's suspected source-file group and update it when you find
  grouping evidence.
  - `notes/file-groupings.md` runs to thousands of lines, so never read it
    whole. Search it with `grep -n` for the function's full name and for its
    address without the name prefix, then read only the section around each
    hit. Each section opens with a `## ` heading that names the container and
    the address range. To add evidence, extend the section that already lists
    the function rather than starting a new one.
  - The rules each compiler pass follows are in the mechanism sheets that
    `psx_reference` serves: `population`, `loop`, `schedule`, `allocation`,
    `declarations`, `flags`, `sdk` and `stuck`.
  - Where no sheet covers a decision, the vendored compiler source is the
    authority. `psx_compiler_source` searches the code that was actually built.
- Refining an already-matching function: load
  `.pi/skills/psx-refine-function/SKILL.md`.
- Performing a conservative cross-file cleanup batch: load
  `.pi/skills/psx-project-refinement/SKILL.md`.
- Changing Pi extensions, skills, commands, or autonomous workers: read the Pi
  documentation named in the harness instructions and inspect the relevant
  `.pi/` implementation and tests. Concrete target and toolchain facts live
  only in `configs/project-profile.md`; point guides, skills and prompts at it
  rather than restating them.
- Changing build or diagnostic tooling: read `README.md` and
  `notes/tools-directory-structure.md`, then inspect the active Make/config
  dependencies before editing.
- Changing project fundamentals: read the current roadmap and the relevant
  institutional notes before acting; do not re-derive settled facts already
  supplied by `configs/project-profile.md`.

## Declarations

- A data symbol's `extern`, its type and any struct view of it are in
  `include/globals_override.h`. Search that header for the symbol's name before
  declaring it or looking anywhere else. It is not in address order, so search
  it rather than browsing.
- Every source reaches the override header through `common.h`. The generated
  `globals.h` skips every symbol the override header declares and covers only
  part of the rest. A symbol in neither file is undeclared, and the fix is an
  entry in the override header.
- Struct types shared by parameters and locals are in `include/game_types.h`.
  A source includes it explicitly when it uses one of its types.
- Add a missing global to the override header with a one-line comment giving
  its evidence. Never declare it in a `.c` file, and never edit a generated
  header; the header table in `configs/project-profile.md` says which headers
  are generated.
- A source file must still *define* (tentatively) every global whose
  translation unit it is: that is how GP-relative addressing is expressed. A
  definition is not a redeclaration; see `psx_reference declarations`.

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
- Preserve the clean-source policy. For ordinary compiled functions, embedded
  assembly, hard-register pinning, and new assembly stubs are not valid
  decompilation solutions. Honor only exceptions established by the active
  project's classification and policy. Unless explicitly specified by the user.
- A per-file compiler flag override needs the evidence bar in
  `psx_reference flags`, and lands with its evidence comment and allowlist
  entry in the same change. Without that evidence it is forbidden. Never use a
  flag to switch off an optimization the target shows signs of using.
- Keep edits scoped to the requested task. Do not opportunistically rewrite
  unrelated files.

## Verification discipline

Use the narrowest relevant check while iterating, then run the repository's
full verification gate before reporting success. A generated binary match does
not excuse forbidden source constructs, out-of-scope edits, or hand-edited
generated files.

While iterating on one function, the narrowest check is the staged residual,
not a byte score. A byte score is not a distance — an edit that fixes the cause
of a difference rotates everything downstream of it and can match fewer words
while standing closer — so it ranks a lucky register assignment above a fixed
cause. Measure every edit, and measure it with the residual.

When a residual survives several spellings, stop writing spellings. Find the
compiler function that makes the decision, through its mechanism sheet or the
vendored source, and read it. The rule it applies names the source change;
another spelling only samples it.

When a verification step fails, continue from its concrete output or restore
the last known-good state. Do not leave unrelated source broken to preserve an
experiment.
