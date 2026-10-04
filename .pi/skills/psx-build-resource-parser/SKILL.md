---
name: psx-build-resource-parser
description: Investigate, implement or improve one explicitly requested pure PlayStation asset parser with evidence-backed layouts, usable exports and corresponding passing tests. Known-format extraction and provenance are deterministic; this work item never automatically commits.
---

# Build a resource parser

You are working on one explicitly requested parser capability in the active TUI,
not a child agent or an asset-approval loop. Success is an evidence-backed,
registered and tested capability. `psx_resource_parser` never commits, resets or
restores drafts. Known-format extraction and generated provenance need no model
turns; they run through `npm run extract-assets`.

## Scope

You may read repository files and original inputs. Write only:

- `tools/agent/resource-extraction/parsers/<format>.ts`
- its corresponding `<format>.test.ts`
- `tools/agent/resource-extraction/parser-plugins.ts` (imports and registrations)

Do not edit the pipeline, registry machinery, game sources, headers, build
configuration, skills or handwritten notes. There is no shell tool. Fixed-argv
typechecks/tests are performed by the gate; deterministic integration extraction
may regenerate only its own provenance document. No emulator, gameplay,
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
   Set internal `category` to images/sound/models/video/data and `rawExtension`
   to the native format's extension. Export-stage files appear flat under
   `build/assets/extracted/{images,sounds,models,videos,data}/`; raw/intermediate
   objects and manifests stay separate. Include specification references where
   available; implementation fingerprints follow actual runtime dependencies.
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
6. Exercise the registered capability with `psx_resource_extract` on the
   requested original input scope, when available. It loads new parser modules
   in a fresh deterministic process and generates the normal manifest/exports;
   no extra model session, TUI reload or asset-documentation role is needed.
7. Call `psx_resource_parser` with `action: "accept"`. It reruns checks and
   returns `parser-tested` only if the source still matches the tested inputs.
   Stop then. Source remains uncommitted; do not invoke Git or claim a commit.

If evidence is insufficient, say exactly what is missing and stop without
fabricating a parser. Failed/cancelled drafts remain in place, with test reports
under `build/assets/cache/parser-builder/`. There is no automatic restore or
repeated builder dispatch. Supported-parser closure is not all-assets-found.
