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

Call `psx_residual_objective` for the target and `psx_verify_build` before editing. Stop unless the verdict is `EXACT` and the build is green — a refinement starts from a match.

## Improvements

Prefer evidence-backed changes:

- meaningful local and parameter names
- brief comments in the project's required language standard
- SDK and shared parameter types proven by callers/callees
- shared structs when multiple files demonstrably use the same layout
- removal of unnecessary includes from a fully decompiled file
- renaming the function symbol itself when its semantics are established (see below)

## Go deep before settling for cosmetic edits

A rename of one argument plus a vague comment is a weak refinement. Before
finishing, exhaust the semantic evidence:

- **Decode magic constants against the hardware.** Map immediates onto PSX
  formats: GPU command bytes (0xE1 draw-mode/tpage, 0xE2 texwindow, 0x64
  SPRT_16, ...), tpage/clut bitfields (X base bits 0-3, Y base bit 4,
  semitransparency 5-6, depth 7-8), GTE registers, pad bits, SDK flag words.
  A comment should state what the constant *is*, not just that it is used.
- **Read the callees' assembly, even when they are still INCLUDE_ASM stubs.**
  The consumption site proves semantics: a result ORed into a GPU primitive
  word, stored with `sh` into a tracked global, or compared against -1 tells
  you the type and meaning better than the function's own body does.
- **Look for inline twins.** The same arithmetic inlined in a neighboring
  function (e.g. `0xE2F - x` in an interpreter next to `0xFEF - x` in the
  target) is strong evidence for the underlying mechanism — cite it.
- **Identify the caller's role.** If a caller walks a token stream, decodes a
  script, or dispatches commands, say so; it frames what the target's inputs
  actually are.

When this evidence establishes the semantics, rename the function from its
placeholder symbol to a precise name in the active project's convention:

1. Rename in the container's symbol table (`configs/symbols/<container>.txt`) and its
   splat segment (`configs/splat/<container>.yaml`)
   list (both the entry and its trailing comment).
2. Run the active project's regeneration command. It must regenerate assembly,
   linker inputs, and caller references and migrate the old source path to the
   new symbol without deleting real source. Review the migrated file and fix
   any comment that cites the old name.
3. Re-run the exact diff, then export context (remove the stale old-name
   signature from the generated header if the exporter leaves it), then
   rebuild the call graph so tooling sees the new name.
4. If the link fails with undefined references from INCLUDE_ASM caller stubs,
   `touch` those stub `.c` files — their objects are stale against the
   regenerated asm — and re-run the full build verification.

Use the headers the generated profile designates for global and shared types. Giving a data symbol a struct or aggregate type is the most common refinement here, and it belongs in the project's **override** header — the generated declarations header is an output that skips whatever the override already declares, so editing it appears to work and is erased on the next regeneration. Never redeclare generated globals in source files.

Apply risky changes one at a time. After each type, expression, declaration, or struct change, call `psx_residual_objective` and immediately revert that individual change if the verdict is no longer `EXACT`. Renames and comments are safer but still require final verification.

## Finish

Call `psx_export_context` for the target, then `psx_finalize_function`. If finalization fails, repair or revert the refinement before stopping.

Inspect the final diff and summarize only changes supported by concrete neighbor or assembly evidence. If the function's semantics remain genuinely unknown after the deep-dive steps above, say so explicitly rather than papering over it with a speculative name or comment. Do not commit or introduce any workaround forbidden by project policy.
