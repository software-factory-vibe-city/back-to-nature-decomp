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
   **Finish the supported media decoder/exporter in this iteration:** audio must
   produce playable PCM WAV, images a normally viewable image, and video decoded
   frames or a playable export when that codec is supported. Models should have
   a usable geometry export with unresolved materials/dependencies stated.
   Copying compressed ADPCM or opaque payloads, renaming them, or merely adding
   an extension is preservation, not decoded/playable media. A container-only
   capability is legitimate, but name it as such and state the missing decoder;
   do not claim to have finished audio/video extraction.
   Set `category` to images/sound/models/video/data and `rawExtension` to the
   format's extension so actual files appear in browsable top-level folders.
   For mixed formats, `category` may be a pure function of validated parse
   metadata. Route XA audio to sound; sector/data containers are not videos
   just because their extension is XA/STR. Unspecified categories/extensions
   default to data/.bin; classification follows validated content.
3. Add positive and negative/truncated/malformed fixtures, false-positive magic,
   budget, variant and replay tests. Include independent known results where
   decoding is involved. Check native export headers, channel/sample ordering,
   predictor state, clipping, sample counts, rate/timing and the combined output
   budget (including headers and retained compressed outputs). Exercise the
   registered scan → bounded parse → variants → decode → replay path with an
   embedded/padded fixture, not just direct calls to your own functions.
   Fixtures are source arrays or generated/local data; do not check in
   proprietary/extracted binaries. When real inputs are available, verify their
   complete decoded exports against an independent decoder or known result;
   synthetic fixtures alone do not establish that the work item's files work.
   Include realistic interleave padding and channel/file termination, not only
   uninterrupted audio. Compare the actual supplied representation with the
   supported one: an ISO payload may have lost sector headers, subheaders,
   interleave, coding information or compressed audio bytes. Recover complete
   sectors from the original input when available; do not replace missing audio
   with zeros or present a shortened decode as complete. A filename or size
   divisibility cannot restore those fields. Test legal bit-field values and realistic false
   positives, not only fixtures generated from the same assumptions as the
   parser. Explicitly name unsupported layouts, signedness, units and external
   dependencies; never invent playback parameters to make an export possible.
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
