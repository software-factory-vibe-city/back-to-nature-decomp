---
name: psx-refine-function
description: Improve one already byte-matching function in an arbitrary PlayStation decompilation using caller/callee evidence while preserving exact machine code.
---

# PlayStation function refinement

Refine exactly the target named in the invocation. Derive all game-specific facts, toolchain details, paths, types, and coding rules from the current project. The function must already match before any edit.

## Read context

1. Read `AGENTS.md`, `prompts/c-style-guide.md`, and `configs/project-profile.md`.
2. Read the target's call-graph entry.
3. Read the target source, original assembly, and decompiled callers/callees.
4. Check the project's generated declarations and shared type headers before defining anything new.

## Baseline gate

Call `psx_diff_function` for the target and `psx_verify_build` before editing. Stop if either baseline fails.

## Improvements

Prefer evidence-backed changes:

- meaningful local and parameter names
- brief comments in the project's required language standard
- SDK and shared parameter types proven by callers/callees
- shared structs when multiple files demonstrably use the same layout
- removal of unnecessary includes from a fully decompiled file

Use the project's designated headers for global and shared types. Never redeclare generated globals in source files.

Apply risky changes one at a time. After each type, expression, declaration, or struct change, call `psx_diff_function` and immediately revert that individual change if the match is lost. Renames and comments are safer but still require final verification.

## Finish

Call `psx_export_context` for the target, then `psx_verify_build`.

Inspect the final diff and summarize only changes supported by concrete neighbor or assembly evidence. Do not commit or introduce any workaround forbidden by project policy.
