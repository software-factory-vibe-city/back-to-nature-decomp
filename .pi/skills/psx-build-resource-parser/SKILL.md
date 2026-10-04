---
name: psx-build-resource-parser
description: Build and register a pure PlayStation asset parser when the in-TUI extraction loop has exhausted existing parsers. Require original-byte/specification evidence, corresponding tests, a passing parser gate and a scoped per-iteration commit.
---

# Build a resource parser

You are the parser-building role in the active TUI extraction loop, not a child
agent. The user authorized per-iteration commits: this iteration succeeds only
when a parser capability is implemented, registered, tested and committed by
`psx_resource_parser`. Unsupported guesses do not earn commits.

## Scope

You may read repository files and original inputs. Write only:

- `tools/agent/resource-extraction/parsers/<format>.ts`
- its corresponding `<format>.test.ts`
- `tools/agent/resource-extraction/parser-plugins.ts` (imports and registrations)

Do not edit the pipeline, registry machinery, game sources, headers, build
configuration, skills or tracked notes. There is no shell tool. Fixed-argv test,
typecheck and commit commands are performed by the gate. No emulator, gameplay,
other agent, worktree, git reset/clean or automatic flag changes.

## Workflow

1. Read the work item and original-byte/loader evidence. Use the existing parser
   contract in `registry.ts`; inspect `formats.ts` as a known-format example.
   Establish the layout from a specification or actual code/data relationships.
   A magic word alone, filename, guessed count or convenient output is not proof.
   Never insert title-specific filenames/addresses into the general harness.
2. Implement an exported `AssetParser` plugin. Its methods consume byte views:
   probe, parse, variants and bounded decode/export. Keep it pure: no filesystem,
   process, network, dynamic import, eval or global runtime state. Validate counts,
   flags, dimensions, indices and consumed extents before allocating output.
   Preserve raw/structured representation, references and lossy-export warnings.
   Set `category` to images/sound/models/video/data and `rawExtension` to the
   format's extension so actual files appear in browsable top-level folders.
   Unspecified categories/extensions default to data/.bin; these declarations
   must follow the established format, not guesses about consumer meaning.
3. Add positive and negative/truncated/malformed fixtures, false-positive magic,
   budget, variant and replay tests. Include independent known results where
   decoding is involved. Fixtures are source arrays or generated/local data;
   do not check in proprietary/extracted binaries. Explicitly name unsupported
   layouts, signedness, units and external dependencies.
4. Import/register the plugin in `EXTRA_PARSERS`, preserving every existing
   registration. No other plumbing change should be needed.
5. Call `psx_resource_parser` with `action: "test"`. Fix concrete policy,
   typecheck or test errors in this same TUI. A failed gate is not success.
6. Call it with `action: "accept"`. It reruns checks and commits only the scoped
   parser/test/registration files. Stop after `parser-committed`; the loop will
   reload code through fresh deterministic tool processes and resume discovery.

If evidence is insufficient, say exactly what is missing and stop without
fabricating a parser. The controller retains the failed attempt under
`build/assets/` and restores only its parser scope. A lack of supported assets
is a reason to investigate/build a capability, not an all-assets-found claim.
