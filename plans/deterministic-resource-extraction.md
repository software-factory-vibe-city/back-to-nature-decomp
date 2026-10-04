# Plan: deterministic resource extraction, parser-only agent

**Status: implemented.** Known-format extraction, publication and provenance are
now one deterministic command; the model is used only for explicitly requested
parser development. No automatic commits remain. See §10 for the frozen contract
and verification evidence.

This plan replaces the conversational asset/documentation loop described in
`plans/asset-extraction.md`. It preserves the tested format capabilities and
static-first evidence rules, but changes how extraction, publication and
provenance documentation are performed. The older plan remains a record of the
former implementation; its broader format/static-analysis roadmap is not
claimed complete by this rework.

## 1. Decision and goal

Known-format extraction is a deterministic build task. The agent is used to
investigate and implement parsers, not to approve each asset, call predetermined
verification tools or write generated provenance.

The intended entry point is:

```sh
npm run extract-assets
npm run extract-assets -- --input extracted/iso
```

Default inputs remain `extracted/`. Generated resources and caches remain under
`build/assets/`. Each successful invocation produces a complete generated
provenance document at `notes/asset-provenance.md`. <!-- doc-ref-ignore: generated artifact -->

The extractor makes no model calls, launches no agents and performs no Git
operations. Neither extraction nor parser development automatically commits.
Committing source or generated documentation remains an explicitly requested,
separate action. Original/extracted binaries and generated assets stay ignored.

### Repeat-run contract

Given identical original inputs, parser implementations, declared layouts,
transformation parameters and export options:

- Resource identities, artifact paths/bytes, the canonical manifest and the
  provenance document are deterministic.
- Valid cache hits skip scanning/parsing/decoding work already established for
  that derivation. Reading/hashing inputs and checking output integrity is
  allowed; a warm run is not a promise of zero I/O.
- A forced clean computation produces the same published result as a cached run.
- Missing or corrupt cached results are recomputed or explicitly rejected; they
  are never silently accepted.
- A parser change invalidates its dependent results, not all other formats.
- Deleting `build/assets/` does not remove information needed to reproduce the
  documented results from the original inputs and registered capabilities.

Unknown formats, ambiguous readings and missing context are reported honestly.
A supported-format scan is not proof that every game asset has been found.

## 2. Why the current workflow is being replaced

The former controller sent both extraction/documentation skills again for each
recognized asset. The model requested an evidence bundle and then called an asset
acceptance tool whose implementation already extracted, verified, generated the
notes and committed them without model-authored documentation.

The saved logs examined during planning contain 134 such asset prompts, totaling
approximately 660 KB of repeated instructions/work items. This is an observation
about those logs, not a billing estimate or an exhaustive performance benchmark.

There is also deterministic duplication:

- Documentation, extraction and verification each replay the whole run on the
  normal asset path.
- Discovery advances one job at a time through a campaign operation which also
  verifies and publishes the accumulated run.
- Verification decodes an entire variant separately for each output artifact.
- One aggregate analyzer fingerprint invalidates unrelated parser work.
- Append-only per-asset notes and random run directories describe execution
  history rather than a canonical result.
- The current image browser contains 24 directories for only 12 distinct TIMs:
  the same bytes were found in the archive and its separately extracted member.
  Source-occurrence IDs become output directories, duplicating all presentations.

The remedy is to remove the agent from the known-parser path and simplify its
control flow, not merely shorten the skills or add another orchestration layer.

## 3. Architecture

```text
Original byte inputs + registered parsers + explicit supported assumptions
    -> deterministic discovery / bounded parsing
    -> extract / decode / export missing derivations
    -> integrity and provenance validation
    -> canonical manifest + browsable artifacts
    -> generated Markdown provenance catalog

Unsupported evidence / requested format capability
    -> one parser-development work item
    -> agent implements plugin, decoder/exporter and corresponding tests
    -> policy / typecheck / tests / compatibility checks
    -> ordinary deterministic extractor exercises the capability
```

Retain only the bookkeeping required to describe results and reuse computation:
input identities, derivation cache entries, source/dependency relationships,
output descriptors/hashes and a canonical result manifest. Do not retain
per-asset acceptance state, conversation history, commit ledgers, agent role
state or random run/checkpoint generations as extraction prerequisites.

### Boundaries

- Pure format code stays in `tools/agent/resource-extraction/`, using the existing
  registry and parser-plugin structure. TypeScript remains the tooling language.
- Extraction does not invoke the matching compiler, `make split`, header/symbol
  generation, an emulator or gameplay. Concurrent decompilation is independent.
- Structural validation remains necessary: magic words and filenames alone do
  not establish resources, layouts, audio parameters or semantic meaning.
- Supplied schemas remain explicitly conditional assumptions. The checked
  byte-XOR constructor remains conditional on its witnessed code and declared
  input association/count; it is not general decompression or loader recovery.
- General loader-derived schemas, consumer semantics, new codecs and automatic
  discovery inside arbitrary plugin-produced views are separate capabilities,
  not implicit deliverables of this refactor.

## 4. Deterministic command and publication contract

Refactor the existing resource CLI/core rather than create a parallel extraction
framework. Add `extract-assets` to `package.json`; either make `assets` a documented
alias or retire it explicitly. The production command should execute one
ordinary end-to-end extraction invocation, not simulate the old iteration loop.

Provide a small CLI surface: input selection, existing bounded resource limits,
explicit supported schemas/transforms where needed, and forced recomputation /
full verification. Exact option names should be finalized in the implementation
and covered by CLI tests. There is no resume/run-ID requirement.

The invocation inventories its declared scope, runs supported discovery, derives
outputs, validates the completed result and renders the report once. It should
not repeatedly publish or generate documentation after each individual job.
Progress output is concise; timings/cache-hit statistics belong on stdout or in
ignored diagnostics, never in the canonical artifacts/documentation.

The published manifest and report represent the requested scope, not a silent
union with previous invocations or old run directories. Narrower selections must
state their scope and must not continue advertising unrelated earlier results.

### Flat, content-deduplicated extracted assets

The public asset browser is `build/assets/extracted/`. Each classification is a
**flat directory of actual exported files**, not a collection of `node-*` or
per-asset directories. Required public categories are `images`, `sounds`,
`models`, `videos` and `data`, populated only when the corresponding supported
assets exist. Map existing internal parser categories (`sound`, `video`) to the
public plural names without requiring unrelated parser rewrites.

```text
build/assets/
    extracted/
        images/                    flat image exports: <asset-id>-bank-0.ppm, ...
        sounds/                    flat audio exports: <asset-id>-stream-0.wav, ...
        models/                    flat supported geometry exports
        videos/                    flat supported decoded/playable video exports
        data/                      flat supported data/container exports
    manifest.json                  canonical provenance data (doc-ref-ignore: generated)
    index.json                     derived browsable index (doc-ref-ignore: generated)
    provenance/                    optional per-asset/source manifests, not exports
    blobs/                         original and intermediate content-addressed bytes
    cache/                         checked reusable derivations
notes/
    asset-provenance.md             generated, self-contained readable catalog
    asset-identification.md         existing historical/interpretive ledger
```

Use stable content-based filenames plus meaningful representation/variant
suffixes. All exported assets of a classification are directly accessible in its
folder, with no source/run/archive/member nesting. Multi-file exports use shared
stable basename prefixes and valid deterministic references, not asset-specific
subdirectories. Examples above illustrate the layout, not new codec support.

Keep source-occurrence manifests, raw originals, intermediate RGBA/STP or
compressed ADPCM objects, caches and diagnostics separate from the browsable
exports. Every flat export must link through the canonical manifest to its
original byte extents and required interpretation/variant parameters. Optional
per-asset manifests may retain graph/node relationships under `provenance/`;
metadata does not require another copy of each asset in a `node-*` directory.

Publish each unique content/interpretation/variant/export result once. Multiple
source occurrences reference the same exported file while retaining all origins.
Repeated runs, archive views and separately extracted copies must not multiply
files. Equal RGB previews alone are not sufficient to discard distinct raw,
palette, transparency, STP or external decoding context.

Do not manufacture semantic filenames or classify non-audio XA payloads as
decoded video. Preserve raw bytes, TIM RGBA/STP data and native-rate XA PCM behavior
already supported by the tests, even when their authoritative representations
are stored outside `extracted/`. The normal output tree must not accumulate
per-iteration requests, transcripts, commit ledgers or redundant result copies.

Publication uses validated immutable backing objects and atomic file writes.
Incomplete computations cannot become valid cache entries or authoritative
manifests. A failed computation before publication preserves the previous result.
Because `build/` and `notes/` are separate publication targets, do not claim a
single filesystem-atomic transaction across them: embed the canonical manifest
hash in the report, detect interrupted/mismatched publication and regenerate the
report deterministically. Test interruption and recovery explicitly.

Only pipeline-owned derived files may be pruned/replaced, after a successful
result is available. Never clean inputs, unrelated files or legacy artifacts
without an explicit migration/cleanup decision. Avoid rewriting identical files
on warm runs, including the generated notes document.

## 5. Identity, caching and verification

### Stable identities and dependency keys

Document two separate identities and their serialization formats:

- **Source occurrence:** normalized original origin/extent and format contract.
  Record parent/member/transform coordinates explicitly. A changed origin/extent
  changes this identity, and every occurrence remains available in provenance.
- **Published asset/export:** original content plus the necessary validated
  interpretation/variant/export context, independent of the path through which
  those bytes were discovered. Equivalent occurrences share one flat export.

Neither identity depends on discovery ordinals, random IDs, timestamps, current
Git HEAD or agent state. Aliases describe source relationships, not independent
proof of a layout. Parser implementation fingerprints belong in derivation
provenance/cache keys; re-evaluating an unchanged result does not create another
export merely because a parser revision or source occurrence differs.

Cache stages independently:

- Discovery: byte-view hash, relevant parser dependency fingerprint and scan
  policy/options. Cache negative discovery results as well as matches.
- Parsing: byte-view/extent, parser dependency fingerprint and parse assumptions.
- Decoding/export: raw resource hash, parser/decoder/export dependency
  fingerprints and canonical variant/options.

Include actual transitive implementation dependencies and relevant execution
semantics, not only the parser's declared revision number. Adding a parser scans
for that capability; editing one does not invalidate unrelated parser results.
Shared decoder changes invalidate their actual dependents. Different archive
schema/transform premises cannot share an incompatible cached result.

### Verification without repeated whole-run replay

- On a cold derivation, validate extents and bounded metadata, compute outputs,
  establish their hashes and verify the derivation before publication.
- Decode/replay once per variant and compare all of its outputs together, not
  once for every RGBA/STP/preview or ADPCM/WAV artifact.
- On a warm derivation, validate the cache key, descriptors and backing/output
  integrity. Do not decode unchanged resources simply to reapprove them.
- Provide an explicit full replay/forced-computation path. Its result must match
  the normal cached path, without publishing different verification prose.
- Generate the final manifest/report after the selected scope is settled. Do not
  call full verification inside a one-job discovery loop.

Original input mutation, corrupt outputs and incompatible derivations must be
explicit failures or bounded regeneration paths. Input/path/symlink containment,
resource/output budgets, cancellation and concurrent publication protection remain
required. Source admission is not an OS sandbox and must not be described as one.

## 6. Documentation artifact

`notes/asset-provenance.md` is marked **generated; do not edit** and is rendered <!-- doc-ref-ignore: generated artifact -->
mechanically from the canonical verified manifest. It is a complete catalog of
the selected supported results, not a chronological diary or agent narrative.

Required sections:

1. **Reproduction and scope:** exact command/configuration, selected input scope,
   limits and capability boundaries. Counts refer to observed inputs/results,
   never an invented total game asset count.
2. **Original input table:** normalized paths, sizes and full SHA-256 values.
3. **Implementation table:** parser revisions, implementation/dependency hashes,
   relevant execution profile and specification references where available.
4. **Resource catalog:** unique published asset IDs, format, raw hashes and
   validated metadata, with all source occurrences and their exact byte extents.
   Distinguish unique-content counts from source-occurrence counts.
5. **Artifact tables:** actual flat paths under `build/assets/extracted/`,
   representations/stages, variant/options, sizes and full hashes; link retained
   originals/intermediates separately and make loss/dependency warnings explicit.
6. **Container/transform definitions:** complete layouts and parameters stored
   once, plus resource source chains terminating at hashed original inputs.
   Code evidence includes container identity, original address and code hashes.
7. **Limits/unresolved findings:** unsupported representations, ambiguity,
   conditional assumptions and missing dependencies without guessed semantics.

Use shared input/parser/schema tables and stable references to avoid copying the
same facts into every resource entry. The document must remain self-contained:
required assumptions/configuration cannot live only in an ignored old run file.
`build/assets/manifest.json` carries the same facts in machine-readable form; <!-- doc-ref-ignore: generated artifact -->
Markdown is a projection, not an independently maintained authority.

Use canonical ordering, normalized paths, consistent numeric units and stable
serialization. Exclude wall-clock timestamps, run IDs, cache statistics, timings,
absolute workstation paths, model/tool transcripts and commit history. Identical
results must render byte-identically whether cold, cached or force-recomputed.

Preserve `notes/asset-identification.md` as existing historical material. Do not
silently rewrite its accepted entries or promote their older claims into the
new catalog. Human interpretations remain separate, cite stable resource IDs and
supporting evidence, and are never synthesized by the provenance renderer.

## 7. Parser-only agent and extension

Replace the asset/documentation role cycle in `.pi/extensions/psx-resources/`
with a narrowly scoped parser-development command/workflow.

- An extraction command, if retained in Pi, is only a deterministic CLI wrapper
  with a short result summary. It injects no skills and starts no model turn.
- Parser development is explicitly requested or selected from a compact
  unsupported-capability report. Merely reaching supported-parser closure does
  not repeatedly summon an agent to guess a format.
- Load the parser-builder skill once on entry to the work item. Subsequent turns
  receive focused results or artifact pointers, not repeated skill bodies.
- The agent may investigate original bytes/specifications, implement pure plugins
  and their decoders/exporters, add corresponding tests and register them.
- Preserve the policy/typecheck/test gate, malformed/budget/replay cases and
  independent decoder/result checks for available real media inputs. A renamed
  compressed payload is not a completed media export.
- Successful development means a tested capability, not a parser commit or an
  asset-note commit. The normal deterministic extractor is its integration test.
- Preserve unrelated staged/unstaged changes and concurrent decompilation work.
  Test parser-source drift where relevant; avoid treating unrelated edits or
  commits as extraction input changes. Do not automatically reset/stash/clean or
  restore another agent's work. Failed drafts may remain for inspection.

Remove the per-asset skill dispatch, documentation approval role, automatic Git
acceptance gates and commit-history-based skipping. Update tools, action names,
skills and tests together; do not leave dangling commands or duplicate CLI
registrations. Reduce model-visible tool schemas to capabilities the builder
actually uses rather than exposing nine copies of a universal request schema.

## 8. Implementation sequence

### Phase 1 — freeze contracts and regression fixtures

- Record the deterministic result/provenance schema, resource identity and CLI
  scope contract before changing orchestration.
- Preserve existing TIM/XA/schema/byte-XOR fixtures and independent compatibility
  evidence. Establish cold and repeated-run baselines without blessing historical
  outputs merely because they were previously cataloged.
- Add tests for the new behavior, especially zero model/Git calls and byte-stable
  documentation. Test counters measure scan/parse/decode/replay work directly.

### Phase 2 — one deterministic CLI and derivation cache

- Refactor `pipeline.ts`, `storage.ts`, `registry.ts`, the resource CLI and thin
  entry points into the end-to-end command described above.
- Replace whole-analyzer cache invalidation with relevant dependency keys; cache
  complete derivations and negative probes, and validate all variant outputs in
  one pass.
- Retain existing byte/path/budget safeguards. Do not add a second campaign,
  worker scheduler or database to replace the old loop.

### Phase 3 — canonical publication and provenance renderer

- Adapt `presentation.ts` to the current selected-scope manifest rather than
  merged random runs. Publish verified, content-deduplicated flat files under
  `build/assets/extracted/{images,sounds,models,videos,data}/`.
- Separate source-occurrence records from published content identities. Preserve
  all source links without duplicating previews/media or placing manifests in
  the flat export folders.
- Add the generated Markdown projection and write-if-changed behavior.
- Add `extract-assets` to `package.json`, document invocation/verification, and
  prove forced/cached/clean computations agree.

### Phase 4 — retire conversational bookkeeping

- Remove asset/documentation iterations from `controller.ts`, role binding and
  the extraction/documentation skills. Replace their coverage with tests of
  deterministic extraction and a single parser-development work item.
- Adapt `parser-builder.ts` and its skill so test/acceptance no longer requires
  automatic commits or an outer asset loop.
- Remove or explicitly deprecate obsolete iteration/document/campaign run APIs,
  `git.ts` gates and obsolete CLI/tool entries after their references are migrated.
  Retain useful deterministic analysis/verification capabilities; audit references
  before deleting any shared helper.
- Update README, tool inventory, registration coverage and the old extraction
  plan's status to point to the implemented successor.

### Phase 5 — migration and final verification

- Start with a new explicitly versioned cache/result schema and preserve the
  historical notes ledger. Old agent approval/commit records are not new cache
  acceptance evidence. Do not silently merge legacy indexes into the new catalog.
- Include a scoped cleanup/migration of the generated `build/assets/` clutter:
  superseded category/node folders, random runs, requests, transcripts and commit
  bookkeeping are not part of the new public output contract. After verifying
  their replacements, archive/remove only proven legacy pipeline-owned files;
  preserve originals, unrelated files and any explicitly retained diagnostics.
  Planning this migration does not authorize deleting current artifacts now.
- Run local original-input extraction and independent compatibility checks with
  binaries remaining uncommitted. Record unsupported cases in the denominator.
- Confirm the new command never modifies game sources, headers, build config,
  original inputs or unrelated notes, and never touches the Git index/HEAD.
- Run focused extraction/extension tests and TypeScript checks, then repository
  verification (`npm test`, `make check`) and scoped documentation/diff checks.

## 9. Acceptance tests / definition of done

| Scenario | Required evidence |
|---|---|
| Cold extraction | Real supported artifacts, exact original extents, complete manifest and self-contained generated notes; zero model calls/Git mutations |
| Unchanged second run | Identical published bytes/paths/manifest/notes; no scan/parse/decode/replay of valid cached derivations; no identical-file rewrites |
| Forced run or deleted cache | Same authoritative result and provenance document as the cached run |
| Parser/dependency change | Only dependent computations invalidated; prior rejected matches reconsidered when the relevant parser changes |
| Missing/corrupt outputs | Detected and repaired or explicitly rejected; no false valid cache hit |
| Embedded/member/transformed view | Original source chain and coordinate units replay correctly; assumptions remain qualified |
| Flat classified exports | Actual files directly under `build/assets/extracted/{images,sounds,models,videos,data}/`; no asset/node/run subdirectories or bookkeeping files in those folders |
| Duplicate source representations | Archive/member copies publish one export per unique content/interpretation/variant, with every source occurrence retained in provenance; equal previews alone do not erase distinct originals |
| Unsupported/ambiguous data | Deterministic qualified report, no invented asset meaning or automatic parser-agent loop |
| Limits/cancellation/input mutation | Honest incomplete/failure outcome; incomplete results do not replace a complete published catalog |
| Interrupted/concurrent publication | No accepted partial derivation; manifest/report mismatch detectable and recoverable; other agents' files untouched |
| Parser-development role | One skill dispatch per work item, restricted writes, meaningful tests and no asset-documentation turns or automatic commits |
| Existing supported media | TIM palettes/transparency/STP and XA interleave/history/EOF/PCM behavior preserved; independent results agree |
| Migration | Historical notes preserved, legacy generated clutter migrated/cleaned only within proven ownership, legacy approval state unused, no duplicate tool ownership or dead references |

The finished system requires a model only to add or improve a capability. Running
known parsers, validating outputs, publishing artifacts and documenting their
provenance are entirely deterministic operations.

## 10. Implemented contract and verification

### Entry points and retained state

```sh
npm run extract-assets
npm run extract-assets -- --input extracted/xa-sectors
npm run extract-assets -- --force --full-verify
npm run extract-assets -- --verify
npm run extract-assets -- --migrate-legacy
```

`assets` is an alias, not another pipeline. `--limits` is a partial JSON object
using the budgets in `types.ts`. `--schemas` / `--transforms` read bounded
project-relative JSON arrays; `--schemas-json` / `--transforms-json` provide the
same arrays inline. The generated command embeds their complete definitions.
A schema specifies index/data paths, tableOffset/count/stride/base, position and
length fields (offset, width, endian, scale, signed), and the explicit
`supplied-hypothesis` basis. A supported transform specifies
`{kind: "byte-xor", input, code, address}`: original code establishes the key,
while input association/count remain supplied, not inferred game-call facts.
`--help` documents the exact surface. Run/resume/status/commit options are retired.

The sole result is manifest version 2, with input identities, source graph,
checked evidence/artifacts, unique assets, parser/shared implementation hashes,
execution profile, declared assumptions and unresolved findings. `index.json`
is its projection; `notes/asset-provenance.md` is mechanically rendered and
hash-linked. `cache/v2/` holds complete derivations; `blobs/` holds immutable
content-addressed bytes. One bounded publication intent supports crash recovery.
Parser baselines/tests and failure diagnostics are ignored cache records, not
extraction prerequisites or an approval/history ledger.

Pi owns four focused tools: extract, verify, analyze and parser.
`/extract-resources` runs the CLI with zero skill dispatch/model turns.
`/build-resource-parser <explicit work item>` loads the builder once and permits
only pure plugin/registration/test writes. Fixed-argv typechecks, every existing
parser suite and the core suite must actually pass; source identity is rechecked
before acceptance. Success is `parser-tested`, never committed. Drafts and
unrelated staged/unstaged work survive failure/cancellation and concurrent HEAD
changes. The old conversational stages, Git gate and two obsolete skills were
removed rather than retained as a parallel system.

### Identity and serialization

`canonical(value)` serializes compact JSON with recursively sorted object keys
(`en` ordering), preserving explicit array order. Manifest arrays are sorted by
stable ID; edges/unresolved rows and supplied assumptions use canonical order.
Files use UTF-8 canonical JSON followed by one newline. Blob names use complete
SHA-256; graph/asset IDs use a named prefix plus the first 24 hex digest digits.
The two identities are deliberately separate:

- Original input: `input-SHA256(canonical([normalizedPath, contentHash]))[:24]`.
  A source occurrence uses
  `node-SHA256(canonical([parentID, offset, length, formatOrNull, kind,
  parserIDOrRecordOrNull, schemaHashOrNull]))[:24]`. Parent links record consumed
  file/view-byte coordinates; checked transformed parents retain input/code IDs
  and the original code address, key and hash dependencies. All occurrences remain
  in the manifest even when their backing bytes are aliases.
- Unique asset: `asset-SHA256(canonical([format, rawBlob, boundedContext]))[:24]`.
  Context excludes parser revision but retains format/parser identity and all
  validated bounded metadata. Filenames add a deterministic palette bank or
  file/channel/segment (otherwise variant hash), representation and export hash.
  Original content plus interpretation/variant matters: equal rendered previews
  cannot merge distinct raw TIMs, palettes, transparency or STP. Implementation
  edits change derivation provenance, not filenames merely because a revision
  or source occurrence changed.

Scan keys include the byte-view hash, parser's actual transitive runtime
implementation hash, shared pipeline contract, execution profile and match
budget; negative scans are reusable. Bounded parse metadata/discovery outcomes
are checked and stored with the scan. Decode keys include raw bytes, the relevant
implementation/profile/contract and output budget, with the complete variant
output domain stored together. Cold/forced computation decodes and replays each
unique variant once for all its outputs; duplicate occurrences reuse it even in
forced runs. Warm hits check descriptors and backing hashes without parser work.
The Node/V8/endianness profile is an explicit reproducibility input, not hidden
workstation state. Changed parser dependencies do not invalidate unrelated
formats; unrelated C, notes or Git changes are not cache inputs.

### Verified local results

The final default scope contains **41 original input files**, **28 structurally
validated source occurrences**, **16 unique resources**, and **44 flat exports**:
12 TIM images (24 archive/separate-member occurrences) and 32 native-rate WAV
streams from four sector-preserving XA resources. Each image is published once;
every observed origin is retained. All 32 complete PCM streams match FFmpeg's
`psxstr` decoder sample-for-sample, including six silent streams. The independent
comparison uses `-map 0:a:<channel> -c:a pcm_s16le -f s16le`, compares the entire
WAV data chunk, and checks sample rate, channels and byte/sample counts.

The real archive scan exposed **315 weak stripped-XA extents** containing only
one typed sector plus padding. XA revision 4 retains these as unpromoted candidate
observations, with raw extents/evidence but **no decode or public export**. This
is not a claim that those bytes are assets or that two typed sectors establish
historical meaning. Supported-format validation and playback parameters remain
separate from semantic identification. VAG/VAB, SEQ/SEP, TMD, STR/MDEC and general
loader/consumer recovery are still outside the implemented capabilities.

Real cold, warm, forced/full-replay and read-only verification agree on manifest
SHA-256 `fd9ae108ade84c7417d2baa1f418fd6ca4a0733aac712338f407277267301921`.
The warm run performs **zero scans, parses, decodes or replays**. Manifest,
index, generated notes and all export bytes/paths/mtimes remain unchanged on
warm/forced runs. Forced recomputation performs 44 unique decodes, with 44 cold
replays plus 44 explicit full-verification replays. Original-input hashes,
handwritten notes, Git HEAD and index are unchanged.

Explicit migration archived 12 verified legacy runs plus requests/logs/loop
bookkeeping into `cache/legacy/`, and removed 892 verified old presentation files.
The flat browser now contains only `images/` and `sounds/`, with no per-node
folders or spurious data exports. Retained smoke/maintenance diagnostics and
backing bytes were not blanket-deleted. Tests cover edited/unknown legacy files
and provenance sidecars, unknown run contents and live-lock refusal.

Verification gates:

- 80 focused resource/extension/registration/lock tests pass, including cold/
  warm/forced/clean equivalence, corruption, crash recovery, scope replacement,
  symlinks, cancellation, budgets/input mutation, parser-local invalidation,
  one explicit builder dispatch, source drift and concurrent unrelated work.
- Production resource sources/extensions pass strict TypeScript checks including
  exact optional properties and unchecked indexed access; all focused tests
  also typecheck under the ordinary strict profile.
- `npm test`: 995 tests pass, no skipped/cancelled/TODO cases.
- `make check`: complete game binary identity passes.
- Scoped documentation-reference and whitespace checks pass.

Generated local comparison evidence remains ignored at
`build/assets/cache/diagnostics/real-validation/report.json`. This implementation
and its generated provenance were left uncommitted.
