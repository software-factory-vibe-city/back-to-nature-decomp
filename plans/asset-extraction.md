# Plan: static-first resource extraction for arbitrary PlayStation games

**Status: historical architecture, superseded by the implemented
`plans/deterministic-resource-extraction.md`.** The asset/documentation iteration
loop, automatic commits, run/resume APIs, nine-tool surface and extraction/
documentation skills described below have been retired. These sections record
the former implementation, not current commands or authorization to commit.
Use `npm run extract-assets` or the zero-model `/extract-resources` wrapper;
explicit parser development uses `/build-resource-parser` and never commits.
Current exports are flat, content-deduplicated files under
`build/assets/extracted/{images,sounds,models,videos,data}/`, with generated
`notes/asset-provenance.md`. The broader format/static-analysis roadmap below
remains useful and incomplete. TIM is still supported; XA revision 4 retains
PCM behavior while weak stripped-sector signatures remain unpromoted candidates.

## Historical implementation snapshot: asset parsers first

Implemented asset-format parsers are **TIM v1** and **XA revision 3** for sector
streams with surviving subheaders. This is not a general audio/video/model
extractor; payload-only ISO extractions do not establish XA playback metadata.

| Capability | Former implementation | Remaining work |
|---|---|---|
| Parser/plugin contract and builder gate | Generic bounded probe/parse/variant/decode/replay registry; pure plugin admission; corresponding tests; registration preservation; fixed-argv typecheck/tests and scoped parser commit; fresh tools load new parsers without TUI reload | General dependency resolution and automatic reprobe of plugin-produced container/decoded views; admission policy is not an OS sandbox |
| TIM textures/images | Strict header/block/extent validation; indexed 4/8-bit and direct 16/24-bit images; all palette banks; RGBA pixels, separate STP mask, and PPM exports | Broader independent fixtures, additional legal-layout compatibility checks, lossless PNG export; mixed-mode TIM remains unsupported |
| XA sector audio/data | Raw 2352-byte and sync/MSF-stripped 2336-byte sector validation; correct coding fields and sound groups; independent file/channel segments; unused interleave sectors and terminal untyped EOF; retained ADPCM and native-rate 4/8-bit-to-PCM WAV in sound/; non-audio payloads in data/; all 32 real-disc streams verified against FFmpeg | Re-extract payload-only inputs that lost headers/audio bytes; nonstandard channel numbers, EDC/ECC repair, console resampling/de-emphasis and STR/MDEC decoding |
| VAG audio samples | Not implemented | Header and ADPCM-frame validation, predictor/shift handling, loop/end metadata, PCM decoding and WAV export |
| VAB sound banks | Not implemented | VH/VB and embedded variants, program/tone/sample tables, sample extents, references and playback metadata; preserve raw bank representation |
| SEQ/SEP music sequences | Not implemented | Event/timing validation, sequence enumeration, bank/program dependencies and MIDI export; MIDI is not a reconstruction of the game's audio |
| STR/MDEC video | Not implemented | Establish supplied sector/container representation; chunk/frame assembly, bitstream validation and supported decoding; do not invent absent XA/sector metadata |
| TMD models | Not implemented | Object tables, scale, vertices/normals, supported primitive layouts and indices; preserve unsupported packet types; geometry export and witnessed material/texture associations |
| Animation | Not implemented | Format-specific layouts and consumer evidence for tracks, poses, hierarchy, timing and model dependencies; no universal animation parser is assumed |
| Fonts, dialogue, scripts and other game-specific resources | Not implemented | Recover layouts/encodings/control fields from loaders and consumers, then add tested parsers; byte/string scans remain candidate discovery only |

Two implemented facilities are useful to parsers but **are not asset parsers**:

- Supplied archive schemas support offset/length fields, widths, signedness,
  endianness, scaling, relative bases, aliases, unsorted entries and padding.
  They validate extents and preserve raw members. They do **not** recover the
  schema from loader code or prove that those members have semantic meaning.
- One complete original-word byte-XOR loop constructor can be recognized and
  evaluated with an explicitly requested input extent. It can expose a TIM to
  the existing parser. It is **not** general decompression, nor proof that the
  game associated the chosen decoder and input.

### Implemented supporting pieces

- Content-hashed immutable input snapshots, resource/evidence graphs, raw blobs,
  atomic checkpoint generations, resume, bounded caches and output budgets.
- Byte-wise TIM discovery inside whole files and member/decoded views, followed
  by structural validation; a magic word alone is not accepted.
- Browsable asset copies under top-level `images/`, `sound/`, `models/`, `video/`
  and `data/` folders, routed by parser declarations. TIMs have named raw,
  palette-bank PPM/RGBA/STP files and an `asset.json` provenance sidecar.
  `build/assets/index.json` merges discovered assets across scopes. Folders are
  created only when populated; ambiguous/opaque candidates are not promoted.
  Verification checks presented-file hashes; extraction can regenerate a copy
  without changing the authoritative blob. This adds no non-TIM parser.
- Original PS-X EXE entry/direct-call CFG/SSA slices and field observations.
  Unknown calls, overlay mappings, table extents and consumer meanings remain
  explicit blockers. No matched game C or compiler identification is needed.
- Raw-byte and supported-transformation replay verification, deterministic
  catalogs, verified documentation handoffs and evidence-referenced **candidate**
  prose proposals. Reference checking is not semantic review.
- Nine `resource*.ts` CLIs, distinct `psx_resource_*` tools, `/extract-resources`,
  and extraction/documentation/parser-builder skills. The active TUI agent
  streams reasoning and tools; no child AI session or forked worker is used.
- A continuing two-outcome loop: each accepted iteration commits either verified
  extraction instructions to `notes/asset-identification.md`, or a registered,
  typechecked and tested parser. Supported-parser closure dispatches the builder
  rather than declaring that all assets were found. Failed guesses earn no commit.
- Scoped Git gates refuse unrelated staged work and preserve other agents'
  unstaged changes. Failed parser drafts/reports remain under `build/assets/`
  before restoring only the prepared parser scope; HEAD drift blocks restoration.

### Parser implementation order

1. **Expand the implemented parser/plugin contract and TIM compatibility gate.**
   The shared byte-view registry and builder/test/commit flow are implemented;
   adding a format requires a plugin, registration and corresponding tests, not
   pipeline rewrites. Add independent compatibility fixtures and lossless image
   exports. Keep PPM's transparency/STP loss explicit.
2. **VAG, then VAB.** Validate individual samples first; then recover banks and
   their sample/program/tone relationships. Retain loop, pitch and playback
   metadata separately from a flattened WAV derivative.
3. **SEQ/SEP.** Parse sequence structure and dependencies before presenting MIDI
   or claiming audible playback. Resolve bank associations only on evidence.
4. **TMD.** Start with validated geometry and supported primitive types. Treat
   material/texture attachment as a separate dependency-recovery problem.
5. **STR/MDEC.** Add input adapters and frame/chunk validation before decoding.
   Different supplied sector representations are different contracts.
6. **Title-specific layouts, animations, fonts, dialogue and scripts.** Add
   capability plugins driven by loader/consumer evidence, not title branches in
   the harness. Do not guess an encoding, skeleton or opcode language.

Each parser milestone must provide:

- A pure bounded parser over an existing byte view, with an established consumed
  extent, typed representation, dependency references and explicit limitations.
- Validation of lengths/counts, flags, indices, origins, units and referenced
  ranges before allocation or publication. Overflow and expansion limits are
  checked before producing output.
- A separate decoder/exporter where needed, including a usable native export
  for supported media (PCM WAV for audio); compressed payload copies alone are
  preservation, not completed decoding. Preserve raw bytes and machine-readable
  metadata even when a presentation export is lossy.
- Deterministic reports and hashes, versioned provenance and replay validation.
- Synthetic/specification fixtures, independently checked real compatibility
  cases kept local/uncommitted, malformed/truncated inputs, false-positive magic,
  resource-limit tests and discovery inside archive/decoded views.
- Explicit `unsupported`, `ambiguous` or `context-unresolved` results for layouts
  and dependencies outside the supported contract; no silent default reading.

No held-out title evaluation has been completed yet. The current synthetic tests
establish bounded mechanisms, not broad compatibility across games.

## 1. Goal and boundaries

Build a reusable harness that approaches an unfamiliar PlayStation game's
resources through static analysis of its original binaries and data. The game
currently being decompiled is a development fixture, not the specification.

The user-facing structure is:

1. A Pi extension providing **`/extract-resources`**, the top-level harness
   instantiation.
2. Skills for extraction, verified asset documentation, and parser building in
   the same TUI.
3. Extraction-specific tools doing as much deterministic computation as possible.

**Inputs default to `./extracted/`. All generated extraction artifacts belong
under `./build/assets/`.** The input directory already holds the unpacked
PlayStation binary and associated files; extraction must not require another
manual relocation of them.

"Arbitrary" means unfamiliar titles can enter the same workflow, with explicit
unsupported or unresolved outcomes. It does not mean every proprietary format
can be recovered automatically. New capabilities should extend schemas,
operation summaries, or format plugins, not introduce a second title-specific
harness.

### Static analysis is the discovery mechanism

Use original executable/overlay words, data accesses, loader code, and consumer
code to recover resource relationships. Do not require gameplay execution,
emulator traces, captured runtime state, matching C, or an exact original
compiler identification. SDK identification is useful evidence, not a
prerequisite or a universal assumption.

Executing a validated parser or a statically recovered transformation on asset
bytes is ordinary extraction. It is distinct from executing the game to discover
its resources. Decoder evaluation must not request an emulator, replay game
execution, or fabricate unresolved runtime state.

### Separate the deliverables

| Stage | What has actually been established |
|---|---|
| Discovery | A resource candidate, table, operation, or relationship exists |
| Extraction | Its source extents are established and its original bytes are preserved |
| Decoding | A specified transformation produces a validated decoded representation |
| Interpretation | Field meanings and relationships to other resources are supported |
| Export | A derivative such as an image, audio file, or model is produced |

An opaque extracted member is a valid intermediate result, not a decoded asset.
A decoded texture need not have a semantic name. An attractive preview does not
prove its interpretation. Original bytes and machine-readable representations
remain authoritative; presentation exports do not replace them.

Non-goals: modifying the original disc, repacking assets, finishing the game's
decompilation, building a complete emulator or recompiler, and promising that
all resources have been found.

## 2. Three-layer harness

The retired initial implementation used the following paths (not current entry points):

```text
.pi/extensions/psx-resources/
    index.ts                         /extract-resources entry point
    tools/                           bounded Pi wrappers and registration tests
    controller.ts                    same-TUI asset/parser iteration loop
.pi/skills/psx-extract-resources/
    SKILL.md                         extraction workflow and evidence rules
.pi/skills/psx-document-resources/
    SKILL.md                         verified asset-note/commit workflow
.pi/skills/psx-build-resource-parser/
    SKILL.md                         scoped pure plugin/test/registration workflow
tools/agent/
    resourceCampaign.ts              retired campaign/resume API (doc-ref-ignore: historical deletion)
    resourceInventory.ts             retired stage API (doc-ref-ignore: historical deletion)
    resourceProbe.ts                 retired stage API (doc-ref-ignore: historical deletion)
    resourceAnalyze.ts               static slices, schemas, transforms, consumers
    resourceExtract.ts               extraction, decoding, and derivative export
    resourceVerify.ts                artifact, provenance, and scope gates
    resourceDocument.ts              retired documentation API (doc-ref-ignore: historical deletion)
    resourceIteration.ts             retired acceptance/commit API (doc-ref-ignore: historical deletion)
    resourceParser.ts                prepared parser scope, tests and scoped commit
    resource-extraction/             reusable implementation, registry and tests
        parser-plugins.ts            additional parser registrations
        parsers/                     pure new plugins and corresponding tests
```

Keep tools in the repository's existing TypeScript tooling hierarchy. CLIs run
through `npx tsx`. Keep format logic out of extension handlers and skill prose.

### 2.1 Pi extension: instantiate and coordinate

`/extract-resources` should:

1. Resolve the repository, selected inputs, budgets, and output root.
2. Create or resume a fingerprinted run under `build/assets/`.
3. Advance bounded deterministic work until an asset or parser work item exists.
4. For an asset: verify/extract it, hand the current TUI agent the documentation
   skill/evidence, and gate a notes-only commit with reproducible instructions.
5. At existing-parser closure: hand the same agent the parser-builder skill,
   prepared source baseline and original-byte evidence. Gate a tested plugin,
   registration and corresponding-test commit, or stop honestly without one.
6. Load committed parser code on the next fresh deterministic tool call; restart
   the fingerprinted discovery scope, skipping already committed asset IDs.
7. Continue until the requested iteration count, budget, cancellation, drift,
   failure or unsupported builder attempt. Report accepted commits and artifacts.

Proposed command forms:

```text
/extract-resources
/extract-resources --input extracted/iso
/extract-resources --resume <run-id> --max-iterations 5
/extract-resources --status
/extract-resources --no-agents --input extracted/iso
/extract-resources --cancel
```

No arguments means the available inputs under `extracted/`, not one hardcoded
executable or archive. Selection and resume arguments are structured values,
never arbitrary shell fragments. Output containment under `build/assets/` is
not bypassed by a caller-supplied path.

Follow `.pi/extensions/psx-decomp/autoloop/`, not the deprecated autonomous
supervisor. Extraction runs **directly in the active TUI session**: the command
sends a skill prompt, tools and agent output stream normally, and the controller
waits for the queued turn to actually start and settle. No forked workers, SDK
child sessions, detached agents, worktrees, or session resets.

While the command owns a role, temporarily expose only its bounded tools and
restore the preceding tool set afterward. Startup must not change other tools.
Do not hijack an already-running agent. Support cancellation, deadlines and
noninteractive deterministic CLI operation. Documentation is a subsequent role
in the same session, with the verified snapshot as its authority.

The deterministic campaign must also be usable directly from its CLI without
an LLM. The agent is an escalation and explanation layer, not the pipeline's
acceptance oracle.

### 2.2 Extraction skill

The extraction agent reads existing evidence, selects the next bounded question,
and uses tools to test it. It must:

- Work from original input bytes and explicitly witnessed context.
- Read prior attempts and their premises before repeating a hypothesis.
- Separate measured facts, supported interpretations, and speculative labels.
- Preserve competing interpretations when the evidence does not decide them.
- Submit declarative schema/analysis hypotheses under its run directory; tools
  validate them before extracting or publishing anything.
- End a bounded work item with validated artifacts or an explicit unresolved
  result and the evidence/capability that would reopen it.

The extraction/documentation roles do not edit `src/`, headers, build
configuration, shared decompilation artifacts or core extraction tools. A
missing parser compels a dedicated builder iteration, already authorized by the
user: only pure plugins, their corresponding tests and registrations are
writable. Extending core analyzers still needs a separately scoped coding task.
Do not substitute unbounded manual byte carving for an unsupported tool.

### 2.3 Documentation skill and agent

Documentation is a subsequent role in the **same TUI session**, with narrower
tool permissions, not a forked agent or isolated worker. The extension dispatches
its skill after the extraction stop/verification gate. Its input is a verified
evidence bundle; previous agent prose remains unverified even though the
conversation is shared.

Produce:

- A resource catalog and reproducible extraction instructions.
- Archive/schema explanations with their supporting code and byte references.
- Loader and consumer roles, decoded representations, and cross-resource links.
- Known limitations, unresolved alternatives, and the next bounded work items.
- Reusable findings about a format or analysis mechanism.

Run-specific handoffs live under `build/assets/runs/<run-id>/docs/`. Every
accepted asset iteration appends reproducible source/hash/extraction evidence
to `notes/asset-identification.md` and commits only that file through the gate.
The user explicitly authorized those per-iteration commits. Generated assets
are never committed; unrelated staged work refuses the commit. Broader notes
remain separate proposals. Do not hand-edit headers/manifests, rename game code
or grant policy exceptions.

Generate factual tables and counts deterministically. The agent adds readable
explanations, with evidence references and qualifications. Documentation must
not promote a candidate interpretation to an accepted format or rename an
unknown field on intuition alone.

## 3. Inputs, output layout, and provenance

Inventory `extracted/` recursively and fingerprint the bytes actually consumed.
Discover executables by structure and boot metadata when available, not by this
game's serial or filename. Inventory multiple files, archives, executables, and
overlays; there may be more than one of each.

An unpacked filesystem may not preserve disc LBAs, sector modes, XA subheaders,
or audio tracks. Record what the input supplies. If a recovery needs absent
disc metadata, return `context-unresolved`; never infer a physical sector
location from directory order. Optional supplied disc metadata can enrich the
same input contract later.

Previously extracted overlay/member files are useful but may be derivatives of
other inputs. Establish their lineage when evidence permits, or retain them as
separate inputs with unverified lineage. Do not count them twice as independent
proof of an archive interpretation.

Generated layout (unimplemented analyzer facilities below remain proposals):

```text
build/assets/
    index.json                       browsable asset catalog across runs/scopes
    images/<asset-id>/                named TIM/PPM/RGBA/STP files and asset.json
    sound/<asset-id>/                 future supported audio/bank/sequence files
    models/<asset-id>/                future supported model files
    video/<asset-id>/                 future supported video files
    data/<asset-id>/                  other validated parser resources
    blobs/<content-hash>              preserved raw and decoded byte objects
    cache/                           provenance-keyed deterministic analysis
    runs/<run-id>/
        inputs.json                  consumed input identities and capabilities
        manifest.json                resource/evidence graph snapshot
        state.json                   stage results, dependencies, and checkpoints
        presented-assets.json        named-file hashes and backing provenance
        schemas/                     proposed and validated layout descriptions
        analysis/                    code slices and operation/transform summaries
        exports/                     derived images, audio, models, and catalogs
        unresolved/                  blockers, attempts, and bounded next actions
        docs/                        generated tables and documentation handoff
        logs/                        complete deterministic tool and TUI-role logs
        report.md                    human-readable outcome
```

The manifest is a graph, not merely a directory listing. Nodes can represent
source extents, archive members, transformed buffers, palettes, textures, sample
banks, metadata, or exports. Edges distinguish containment, references,
transformation, consumption, and naming evidence. One asset can depend on several
files; several entries can refer to the same bytes.

Top-level category folders are browsable copies, not a replacement for the
immutable blobs or run provenance. Names use stable resource IDs, not invented
historical meanings. TIM palette banks get separate files; PPM still loses
transparency/STP. Category routing is generic (`AssetParser.category` and
`rawExtension`); unspecified formats default to `data/` and `.bin`. Publishing
is idempotent, merges scopes under a lock, and never follows symlinks. It does
not claim that pending audio/model/video parsers exist.

Each accepted artifact records source hashes/extents, transformation and schema
versions, parameters, output hash, validation results, and evidence IDs. Code
evidence uses **container identity plus address**, never a bare RAM address that
could belong to several overlays. Keep disc-sector, file-byte, archive-relative,
and guest-memory coordinates typed and distinct.

Read inputs from immutable run snapshots where needed. Validate the consumed
bytes rather than trusting timestamps. Cache identity includes inputs, analyzer
versions, summaries, schemas, and applicable assumptions. Preserve completed
run snapshots; publish updates atomically and avoid shared mutable run state.
All extraction-specific temporary files, decoder artifacts, logs, and worker
outputs also stay under `build/assets/`. Do not check extracted assets into Git.

## 4. Deterministic static-analysis pipeline

### A. Inventory and validated probes

Build an input/resource inventory and run structural parsers for supported
formats. Common PlayStation resource families are useful initial plugins, not
an exhaustive list or proof that a title uses SDK-native asset formats.

A magic hit proposes a format. Validate lengths, flags, counts, referenced
ranges, and format-specific constraints before accepting it. Plugins work on
byte views inside other resources and on decoded buffers, not just whole files.
Code and assets can coexist in one container; failure to recognize code does
not prove that a region is an understood data resource.

### B. Establish resource operations and code slices

Use original-word CFG/SSA and backward/interprocedural slices to identify:

- File/path lookup and disc-read operations.
- Resource-table indexing, offset arithmetic, and length calculation.
- Allocation, copying, and transformations between a read and its consumer.
- Texture, audio, video, geometry, and overlay consumers.

Recognized SDK/BIOS operations can supply validated summaries. Unknown SDKs or
custom wrappers need lower-level analysis, including supported hardware access
patterns. A signature's identity and a summary's applicability need evidence;
an imported C prototype is not independent proof of the machine operation.

Preserve unknown calls, indirect targets, aliasing, and opaque instructions as
limits on the slice. Use joins and loop summaries rather than enumerating every
path or resource ID. No plausible call target may silently become a resolved
one because it makes extraction easier.

### C. Derive resource/container schemas

Recover symbolic relationships: table base and extent, record stride, field
width/signedness, offset origin, units, stored/decoded lengths, and index bounds.
For example, a table field multiplied by a sector unit and passed to a read
operation is stronger evidence than an aligned number in an unidentified file.

Structural hypotheses complement code evidence. Support separate or embedded
indexes, offsets or offset/length pairs, different widths, packed fields,
relative bases, padding, aliases, unsorted entries, and nested containers as
capabilities are implemented. A hypothesis's requirements apply to that
hypothesis, not to every PlayStation archive.

Specifically, the current paired-index detector's u32 layout, sector alignment,
monotonic starts, complete tiling, size filters, and single-pair discovery are
bounded existing capabilities, not universal format properties. Generalization
must expose or remove those restrictions rather than copy them into new policy.

Enumerate only established table extents. An unresolved count is not permission
to consume the rest of a file. Preserve ambiguity and record the exact finite
domain when a bounded search exhausts its alternatives.

### D. Recover and evaluate transformations

Describe a supported custom decoder from its original machine relation, then
lower it into a bounded transformation evaluator or standalone decoder. Recover
required tables and parameters through static data flow. This is semantic
recovery, not a search for byte-matching historical C.

Preserve guest-width arithmetic, load widths, signedness, control sequencing,
and ordered/overlapping memory effects. The existing analytical machine IR is
a foundation, not an automatically execution-faithful decoder specification.
Audit instruction coverage and lowering semantics before relying on it.

Only evaluate transformations whose required state and effects are accounted
for. Missing parameters, hardware dependencies, or unsupported operations block
decoding, not raw extraction. Enforce input/output bounds, expansion limits,
iteration/time budgets, and dependency isolation. Do not run arbitrary recovered
native code with repository write access.

### E. Interpret consumers and export

Use consumer access paths to recover dimensions, record fields, palette/sample
references, geometry strides, and other supported relationships. Associate
resources through witnessed references rather than adjacency alone.

Keep uncertain interpretations explicit. Image export must preserve or document
palette and transparency conventions; audio export must distinguish stored
samples from unresolved playback parameters; model export must not invent a
skeleton or animation meaning from unidentified fields.

### F. Iterate to a supported fixed point

A recovered schema can reveal metadata, a decoder, or an overlay whose code
exposes further resources. Requeue only analyses depending on the new evidence.
Persist premise-qualified failures so unchanged inputs do not repeat the same
experiment. Budget stops preserve settled artifacts and resumable work.

A supported fixed point means the current capabilities have no new actionable
facts in the selected scope. It is not a claim that every game resource was
found or understood, and is not the outer loop's completion condition: remaining
unknowns are handed to the parser-builder skill.

## 5. Tool contracts and acceptance

Each proposed CLI has one bounded Pi tool, using a distinct `psx_resource_*`
namespace. Subcommands remain parameters of that tool. Extend registration
coverage to account for ownership across both extensions; do not accidentally
register extraction CLIs twice in the existing decompilation extension.

All tools provide structured reports, explicit budgets/cancellation, preserved
full output, and bounded model-visible summaries. Expensive searches price and
state their domains first. Deterministic stage results are independent of LLM
model choice or whether a documentation worker succeeds.

Separate artifact stage from analysis outcome. Outcomes include `validated`,
`candidate`, `ambiguous`, `unsupported`, `context-unresolved`, `domain-exhausted`,
`budget-exhausted`, and `input-drift`. A validated raw extraction does not upgrade
its unresolved decoding or interpretation stages.

Acceptance checks include:

- Source extents and coordinate conversions are valid under the recorded schema.
- Extracted raw bytes equal the identified source ranges.
- Dependencies, transformations, and output hashes are reproducible.
- Parser/decoder semantics have appropriate specification, fixture, or checked
  lowering evidence; matching an expected output length alone is insufficient.
- Competing readings and unmet assumptions have not been suppressed.
- All writes obey the generated-output boundary and selected scope.

A concatenation round trip proves preservation, not that arbitrary slices are
meaningful asset boundaries. Likewise, a probe score is a ranking signal, not a
calibrated probability or a semantic proof. Report coverage against the observed
inventory and supported analysis scope, not an invented total asset count.

## 6. Reuse existing infrastructure without inheriting its scope

Useful existing foundations:

- `tools/lib/container.ts` and `tools/lib/symbolIndex.ts`: container identities,
  address mappings, and symbol evidence.
- `tools/lib/archiveIndex.ts` and `tools/build/extractArchive.ts`: paired-index
  hypotheses, extents, and preservation checks.
- `tools/lib/memberClassification.ts` and `tools/lib/overlayStrategies.ts`:
  structural measurements and prerequisite-scoped discovery strategies.
- `tools/lib/toolchainProfile.ts`: explicit detected/undetermined profiles.
- `tools/agent/machine-ir/`: original-word CFG, SSA, memory effects, and regions.
- `tools/agent/campaign/`: dependency-driven requeue and evidence-bundle patterns.
- `.pi/extensions/psx-decomp/autoloop/`: same-TUI dispatch and queue/start/settle
  gating patterns. Do not use the deprecated autonomous/forked-worker flow.

Adapt these through explicit input/evidence contracts. Do not require matched
sources, generated project headers, a successful matching build, or this
repository's current archive manifest to bootstrap an unfamiliar game. Optional
warm project context must carry its provenance; evaluate a cold-input mode with
recovered game C withheld.

Do not trigger `make split`, rebuild shared symbol exports, regenerate headers,
or mutate shared decompilation caches as a side effect of extraction. If an
adapter needs new disassembly/analysis artifacts, produce isolated ones under
`build/assets/`. This permits extraction alongside a decompiling agent.

## 7. Implementation phases and tests

| Phase | Deliverable | Exit evidence |
|---|---|---|
| 1 — implemented; focused integration gates pass | Same-TUI iteration loop, three skills/roles, inventory, graph, generic parser registry, TIM parser, raw extraction/replay, asset ledger and scoped iteration commits | Cold synthetic campaigns and fake Pi-host tests exercise real tools/Git, parser closure/build/test/hot reload/next asset, cancellation, failed gates and unrelated dirt preservation; no live authenticated model run claimed |
| 2 — slices implemented; loader-derived schema recovery pending | Static resource-operation slices and schema recovery | An unfamiliar index layout is recovered from loader code without manually supplying its member offsets or record schema |
| 3 — one checked byte-XOR constructor; generalization pending | Supported custom-transform recovery | A decoder is derived statically, its lowering is checked, and bounded evaluation reproduces independent fixtures |
| 4 — field observations only; semantic recovery pending | Consumer-derived layouts and associations | A headerless resource receives supported field metadata and dependency links, with unresolved meanings preserved |
| 5 — pending | Held-out evaluation and capability expansion | Unrelated titles use the same harness; extensions are format/analysis capabilities, not title branches |

Tests must cover:

- Commands, same-TUI skill dispatch/streaming, tool ownership, role-scoped
  permissions/restoration, cancellation, and noninteractive behavior.
- Synthetic loaders with different layouts, units, bounds, call wrappers,
  indirect dispatch, and deliberately missing evidence.
- Nested/aliased/padded archives, multiple candidate containers, ambiguous
  schemas, malformed lengths, and false-positive magic.
- Decoder arithmetic, overlapping copies, missing state, and resource limits.
- Stable IDs/hashes, input drift, cache invalidation, atomic publication, resume,
  and selective requeue.
- Path traversal/symlinks, hostile resource names, and source/output containment.
- Concurrent decompilation edits: extraction must not rewrite, restore, stash,
  or mistake another agent's changes for its own.
- Documentation claims referencing evidence; no invented counts or semantics.

Use a frozen development/challenge/held-out corpus across unrelated games and
resource layouts, with binary fixtures local and uncommitted. Report unsupported
and unresolved inputs in the denominator. Adding a plugin is legitimate;
rewriting the harness around a held-out title's filenames or addresses is not.

The first useful end-to-end slice includes all three skills and deterministic tools;
it must not stop at a slash command that only injects a prompt. Initial known
format support validates the plumbing. Static loader-derived schema recovery is
the next milestone that demonstrates the approach beyond a format scanner.

## 8. Definition of done for an extraction run

- The requested input/scope is inventoried and fingerprinted.
- Every published result has its stage, provenance, and validation evidence.
- Generated resources and supporting artifacts are under `build/assets/`.
- Unresolved items identify blockers and bounded reopening conditions.
- The selected deterministic work reached a supported fixed point or an honest
  budget stop, with resumable state.
- Every accepted iteration ended with a verified asset-note commit or a tested,
  registered parser commit; prose alone and failed experiments earned none.
- Asset notes include reproducible source extents/hashes, required schemas and
  transformation parameters. Documentation failure does not erase extraction.
- No original inputs, decompilation code, generated headers or unrelated agent
  work were modified or committed. Generated assets were never checked in.

## 9. Stop conditions and iteration acceptance

The outer loop is not completed by free-form prose or existing-parser closure.
A selected asset must reach `asset-committed`; a builder must reach
`parser-committed` after policy, registration, typecheck and tests pass. Only
those typed tool results increment the accepted iteration count. Parser source
and HEAD identities are rechecked before committing; zero/skipped test runs
cannot pass. New parser code is loaded by fresh deterministic CLI processes,
not by creating another AI session.

- Supported-parser closure with unresolved bytes **dispatches the parser-builder
  skill**. An unsupported builder attempt stops honestly without a fake commit.
- `--max-iterations N` limits successful commits, not guessed or failed attempts.
  The default continues until an explicit stop condition.
- Input/output/step budgets stop incomplete with settled artifacts/checkpoints;
  increasing them changes the recorded premise.
- Interactive input, `/extract-resources --cancel`, shutdown, deadline, repeated
  unchanged tool requests, tool/turn limits, drift and failed verification stop
  the loop. Previous accepted commits and generated blobs remain available.
- Noninteractive `--no-agents` runs only deterministic stages, with no model,
  parser-source edits or iteration commits.

The user explicitly authorized per-iteration notes/parser commits. No generated
assets, speculative semantics, game-source edits or unrelated changes enter them.

## 10. Initial implementation verification

- Initial `npm test`: **959 passed**, no failures/skips. This included 44 focused
  extraction/registration tests, synthetic TIM modes, malformed data, schemas,
  replay/corruption/drift, budgets, parser admission and scoped Git gates.
- Scoped TypeScript `--noEmit` check: passed for the extraction core, resource
  extension and tests. `make check`: the original payload still matches.
- Same-TUI integration uses a fake Pi host with **real deterministic tools and
  Git**: delayed turn start, streamed updates, role tool restoration,
  existing-parser closure, builder test/commit, fresh-code reload, subsequent
  asset discovery/commit and cancellation. A live authenticated model run has
  not been performed; it is not implied by those tests.
- A local development-archive scan found **12 structurally valid TIM images**
  and produced 48 raw/decoded/export artifacts under `build/assets/`. All were
  replay-verified; an independent direct-byte check confirmed extents,
  header/rectangle fields, palette indices/RGB scaling, transparency and STP.
  Asset names and consumer associations remain unknown. Accepted extraction
  procedures belong in `notes/asset-identification.md`, not a binary check-in.
- New plan/skill/ledger documentation references and `git diff --check` pass.
  No held-out-title evaluation has been completed.

The categorized-file follow-up passes **963 tests** (48 focused extraction/
registration tests), scoped TypeScript checking and `make check`. A fresh local
archive run populated `build/assets/images/` with the same 12 assets and 48
named raw/decoded/export files, plus provenance sidecars. Publication tests cover
idempotence, merged scopes, category routing, edited-copy/metadata detection,
regeneration, ambiguity exclusion and symlink refusal. No new audio/model/video
parser or historical asset names were introduced.

The next parser capabilities remain VAG/VAB, SEQ/SEP, TMD and STR/MDEC; generic
loader-derived schemas, dependency/consumer semantics and automatic discovery
inside new plugin-produced container/decoded outputs are also still pending.
