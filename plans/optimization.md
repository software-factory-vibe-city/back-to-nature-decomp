# Finalization and preparation performance optimization

## Status and scope

**Implemented and validated.** Changes are limited to build/agent tooling, its tests, and this plan. No game-function sources, compiler headers, or project configuration have changed.

Sections 1–4 preserve the original investigation and design rationale. Their timings are historical baselines or subsystem experiments, not measurements of the implementation. Section 5 records the implementation, integrated measurements, safety tests, and remaining limitations.

The objective is to remove redundant work without weakening byte identity, source policy, modification scope, declaration provenance, or preparation freshness. Do not substitute a per-function match for linked-image verification, trust generated prototypes as independent evidence, or reduce inference coverage merely to improve timings.

## 1. Finalization

### Observed costs

| Operation | Observed time |
|---|---:|
| Earlier successful finalizations, 302 sampled calls | 15.6 s median |
| Two recent successful finalizations | 32.5 s / 34.8 s |
| Function diff | Approximately 0.35–0.40 s |
| SDK-version rediscovery | 5.96 s |
| All-container rodata validation | 2.85 s; 1,262 subprocesses |
| Context type-catalog construction | 2.60 s; 263 preprocessor subprocesses |
| SHA-256 comparisons of all 14 built images | 2.45 ms |

The recent finalization sample is small: two successful calls. The component measurements and implementation trace independently explain the increase.

### Repeated verification

`.pi/extensions/psx-decomp/tools/finalization.ts` performs:

```text
policy → function diff → make check-all
context export
policy → function diff → make check-all
```

Commit `0608df52` introduced this shared two-gate route, explaining the recent doubling.

After an agent returns, `.pi/extensions/psx-decomp/autoloop/loop.ts` independently runs another function diff and another complete finalization, including when the agent's `psx_finalize_function` call just passed.

The common agent-success path therefore performs **four full build checks and two context exports**. A recent session showed a 34.8-second finalizer call followed by another 33.3-second gap before documentation, consistent with the loop's duplicate finalization: approximately 68 seconds of acceptance overhead.

#### Proposed change

Return an input/output-fingerprinted verification receipt from finalization and let the autoloop consume it when the workspace still agrees. Never accept an agent's textual claim as a receipt.

Inside finalization, avoid repeating compilation/build checks when publication changed only m2c context, not compiler inputs. Still validate the published context and final modification scope. Invalidate the receipt on relevant source, dependency, configuration, policy, toolchain or output changes.

Worktree-to-trunk integration remains a separate verification boundary.

### SDK rediscovery on every check

The Makefile regenerates `configs/project-profile.md` on every executable check. `tools/build/genProjectProfile.ts` consequently runs `tools/diagnostics/matchSignatures.ts` across all 16 SDK versions again.

This takes approximately six seconds despite the original binary and signature database usually being unchanged.

#### Proposed change

Cache SDK detection against the original binary, section layout, signature database and scanner implementation. Regenerate the profile only when relevant inputs change, and preserve the file when its content is identical. Do not blindly trust the existing report without a freshness identity.

### Per-object rodata subprocesses

`tools/build/deriveRodataSplits.ts` launches `objdump -h` separately for every compiled function. This cost grows with decompilation progress. `check-all` also launches the validator separately for each of the 14 containers.

An in-memory experiment replaced section-size subprocesses with direct ELF32 section-table reads:

| Implementation | Time |
|---|---:|
| Existing subprocess implementation | 2,851 ms |
| Direct ELF reading | 57 ms |

All 1,262 section-size readings agreed, and every container derivation was identical.

#### Proposed change

Use a validated ELF section reader, or initially batch `objdump` calls. Batch all-container validation into one process; the validator already supports `--all`.

Keep checking every container. Hashing all images is practically free. The old comment in `autonomous/gates.ts` that overlay checks add only 0.2 seconds is no longer representative.

### Context export

`tools/agent/scopedTypes.ts` scans the complete source/header population for a single signature export. The catalog took 2.60 seconds; the separate m2c context parse check took only approximately 0.2–0.3 seconds.

#### Proposed change

Cache per-file AST/type results with include-dependency invalidation, avoid rewriting identical generated headers, and retain the inexpensive m2c parse check.

### Failure handling and observability

`runGate()` currently performs full build verification even after a policy or function-diff failure. Fail fast by default, retaining an explicit comprehensive-diagnostics mode if useful.

Record both gates, export, snapshots and total duration. Currently the second gate replaces the first result, hiding much of the elapsed time.

### Safety prerequisite

The C object rule in the Makefile tracks C files and included assembly, but not C-header dependencies or compiler/flag changes. Correct dependency tracking before relying more heavily on incremental-build receipts; otherwise caches can preserve stale objects.

The investigation's 3–6-second warm-finalization target was an estimate. Measured implementation results are recorded in section 5.

## 2. Function preparation

### Observed slow preparation

For `ovl_11_func_800E4BA4`, saved artifact timestamps show approximately:

| Stage | Time |
|---|---:|
| Dependency analysis and context preparation | 30.6 s |
| m2c | 0.8 s |
| Residual diagnostic | 0.6 s |
| Triage | 34.3 s |
| Total, including remaining overhead | 67 s |

These stage windows were reconstructed from artifacts, not explicit process-duration records. The preparation verified 119 callee definitions and processed 120 declaration contexts.

Evidence is preserved under:

```text
build/preparation/ovl_11_func_800E4BA4/
  0ea301a626e2cb928aa224d2709df59cb3ceb0fa82497f1f5e50c69495300bb9/
```

### Whole-corpus invalidation in triage

The preserved `125-triage.stderr` explicitly reports:

```text
deriving idiom corpus (tier 0) (2566 functions to lift)
— src/overlays/ovl_11/ovl_11_func_800C056C.c,
  src/overlays/ovl_25/ovl_25_func_800B7EB4.c changed
```

`tools/agent/idiom-corpus/corpus.ts` fingerprints one whole-project artifact against every candidate's source. Changing one function invalidates the complete corpus, even though the expensive instruction shapes come from original bytes rather than changing C.

Reading the existing corpus took 18 ms; constructing its search index took 44 ms. These measurements exclude query execution and the rest of triage, but demonstrate that rebuilding the corpus is a different cost from using it.

#### Proposed change

Cache each function's original-code regions separately. Update source eligibility and changed entries incrementally, with original bytes, spans, lifting implementation and normalization in the relevant identities. Preserve the useful precedent search instead of disabling it.

### Repeated symbol/configuration parsing

`tools/lib/symbolIndex.ts` repeatedly reparses configuration and recursively scans assembly files. Dependency analysis invokes these loaders many times.

An in-memory experiment cached symbol metadata for one unchanged input snapshot:

| Operation | Current | Shared metadata |
|---|---:|---:|
| Static discovery | 4,282 ms | 45 ms |
| Evidence-graph construction using recorded seed contracts | 2,632 ms | 1,590 ms |

The graph and discovery results were identical to the recorded results. The graph timing deliberately reused recorded seed contracts, so it does not include their compilation/verification cost.

#### Proposed change

Share container-scoped symbol indexes, subsegments and function-location indexes within a preparation. Persistent reuse must validate all underlying symbol/configuration/assembly inputs and directory membership. Preserve ambiguity detection between containers.

### Repeated declaration indexing

Every callee context brings shared public headers through declaration indexing again. Replaying the 120 saved contexts produced:

| Measurement | Current | Deduplicated |
|---|---:|---:|
| Declaration-indexing calls | 54,421 | 1,649 |
| Time | 3,673 ms | 457 ms |

The resulting declaration index was identical. This was a read-only replay of the declaration-indexing substep, not an integrated preparation benchmark.

#### Proposed change

Cache parsed declarations and normalized forms by content and scope. Index unchanged public declarations once. Preserve source-local identities, conflicts, forward-declaration handling and conditional preprocessing semantics.

### Repeated verification of callee contracts

`tools/agent/type-propagation/seeds.ts` memoizes only within one preparation. Another target recompiles and rechecks the same callees. Two recent preparations independently verified 26 overlapping callees.

Within one request, a verified callee can also be preprocessed separately for:

1. Definition discovery.
2. Compilation.
3. Type and parameter inspection.
4. Context projection.

#### Proposed change

Return and reuse one verified bundle containing the preprocessed source, declaration model and relocated-byte verification receipt. Persist it with source/include, compiler/assembler, flags, target and symbol-resolution dependencies.

Keep independent verification. Generated function headers are not witnesses. Apply held-out/permitted-seed rules on reuse, and do not share mutable seeded summaries between inference views.

### Broad and self-invalidating preparation keys

`tools/agent/prepareFunction.ts` fingerprints all of `src/`, `include/`, configs and much of the tooling. The sampled packet tracked 3,537 files. Reading and hashing those inputs took 168 ms; the larger issue is unnecessary invalidation of expensive downstream work.

The fingerprint also includes the experiment ledger. Residual analysis appends to that ledger after the fingerprint is computed. A mismatching preparation can therefore change its own cache input and miss the previous artifact directory on the next request.

#### Proposed change

Separate freshness domains for:

- Original-code analysis.
- Independently verified declarations.
- Generated draft and compilation.
- Ledger-dependent diagnostics and handoff text.

Ledger changes should refresh the diagnostics that consume them without forcing unrelated inference or generation. Track missing/rejected dependencies and discovery membership so newly available evidence invalidates the correct entries. Preserve edited drafts rather than overwriting them during cache repair.

### Existing-source resume and repeated diagnostics

Preparation recognizes existing C early, but still performs extensive inference/context work before measuring it. Only m2c generation is skipped.

#### Proposed change

Measure the preserved candidate first, reuse prior analysis, and perform additional dependency investigation when needed. Pass existing compilation and residual artifacts into triage rather than rebuilding equivalent artifacts. Mandatory policy/interface checks and applicable blockers must remain enforced.

## 3. Recommended implementation order

1. Instrument explicit phase timings, total elapsed time and cache hit/miss reasons.
2. Eliminate duplicate same-workspace finalization with validated receipts.
3. Remove repeated SDK rediscovery; batch rodata checks and replace per-object subprocesses.
4. Make the idiom corpus incremental.
5. Share symbol metadata and deduplicate declaration indexing.
6. Persist verified callee bundles and split preparation freshness domains.
7. Add a measurement-first existing-source resume path and reuse diagnostic artifacts.

Do not start by lowering the 96-function inference bound, reducing m2c passes or dropping multi-hop evidence. The demonstrated redundant work provides substantial opportunities without those trade-offs.

## 4. Acceptance criteria

- Preserve exact linked-image verification across every container, source policy and scope enforcement.
- Invalidate receipts on relevant input/output changes, including header and flag changes.
- Preserve declaration provenance, source-local scope, held-out isolation and open-callback uncertainty.
- Compare old/new graph, discovery, declaration and corpus results on frozen inputs; retain explicit frontier and unsupported findings.
- Test unchanged requests, unrelated edits, relevant callee/header edits, newly available definitions, ledger-only changes, cancellation and interrupted artifacts.
- Preserve user-edited drafts and separately verify trunk integration.
- Benchmark cold preparation, unchanged warm preparation, next-function preparation after one match, existing-source resume and successful finalization.
- Report end-to-end measurements separately from subsystem experiments. Do not add the demonstrated savings together as if they were an integrated benchmark.

## 5. Implementation and validation

### Changeset boundaries

The work removes redundant operations at their existing owners rather than changing game code or replacing the evidence pipeline:

| Boundary | Implementation |
|---|---|
| Build freshness and rodata | `Makefile`, `tools/build/buildInputs.ts`, `deriveRodataSplits.ts`, and `tools/lib/elfSections.ts`: real cpp depfiles, tool/flag content stamp, direct ELF section reads, one all-container rodata check. |
| Finalization | Existing finalizer/gates/autoloop plus `verification-receipt.ts`: process-owned, workspace/input/output/config-fingerprinted receipts; policy and scope always rerun; trunk remains a separate gate. Both gates and total work are timed. |
| SDK/profile and context | Existing profile/export/scoped-type modules: input-validated SDK detection and per-file type facts, unchanged-content publication, retained m2c parse check. |
| Original-code precedent search | Existing corpus and symbol-index modules: per-function original-region caches and request-scoped metadata. Source eligibility and toolchain fingerprints remain current. |
| Independent declaration evidence | Existing callee/declaration/seed modules plus `preprocessedCache.ts`: actual cpp dependencies/search membership, scoped declaration deduplication, relocated-byte-verified callee bundles, held-out/permitted-view isolation. |
| Preparation | Existing preparer/packet/triage: measure preserved C first, reuse independent analysis and generation, separate ledger diagnostics, reuse fresh compiled artifacts, preserve edited drafts during repeated repairs. |

Five new implementation helpers total 343 lines; the other new tooling files are regression tests. `.gitignore` permits the build helper in the established directory, and `package.json` includes corpus tests in the existing test command. No additional workflow or inference capability was introduced. Inference bounds, multi-hop coverage, m2c passes, byte verification, and mandatory diagnostics were not reduced.

### Integrated timings

Single-run measurements on this working tree; cache state is explicit. These are not additive savings or a statistically controlled comparison with the historical samples.

| Request | Elapsed |
|---|---:|
| Successful production finalization of `CopyVec3`, incremental build already warm, no prior process receipt | 5.85 s |
| Same-workspace finalization with validated process receipt | 0.73 s |
| `ovl_11_func_800E4BA4`, existing C, analysis/generation/verified-seed caches cleared | 38.02 s |
| Same preparation, unchanged warm request | 0.62 s |
| Next target, `CopyVec3`, sharing independently verified caches | 3.70 s |
| Existing-source resume of `CopyVec3` | 0.50 s |
| `func_80017EA0`, cold draft generation | 4.69 s |
| Same draft, unchanged warm request | 0.50 s |
| Caller preparation after a clean matched callee definition becomes available, isolated workspace | 4.07 s |

The last row restores and independently verifies an existing matched definition in a sandbox; it does not claim to benchmark discovering a new match. The stub draft remains mismatching, just as its byte oracle reports. Cold preparation still spends 30.76 s in dependency analysis; that evidence has not been skipped. Production finalization used a function whose private types prevent public signature export; actual context-only publication and compiler-dependent publication were exercised separately by orchestration tests.

Measurement artifacts and scripts are ignored under `build/optimization-evidence/`, notably `preparation-benchmark.json`, `finalization-benchmark.json`, and `elf-equivalence.json`.

### Safety and equivalence

- Receipt tests cover changed sources, headers, flags, newly available headers, actual linked images, diff objects, assembly, recursive linker inputs, library objects, workspace/config isolation, and mutable returned copies. Missing depfiles or compiler-dependent context force the second machine gate. Cancellation is tested at each finalization command boundary.
- The isolated full-preparation test covers unchanged and unrelated edits; relevant callee/header/shared-helper changes; newly available verified definitions; ledger-only diagnostic refresh; repeated edited-draft preservation; corrupt packets; interrupted mandatory preflight; cancellation and retry. It writes no live sources.
- Frozen baseline graph/discovery findings agree, excluding only the intentionally expanded freshness-input list. Full corpus contents agree: 1,188 functions and 12,716 regions. Scope-aware type catalog contents agree: 579 definitions and 1,263 function entries.
- Direct ELF reads agree with `objdump` on all 2,679 built C objects and 18,950 reported sections. All 14 container rodata derivations also agree with the old implementation.
- Final `make -j8 check-all`: all 14 containers match, 2.13 s on a warm build. `git diff --check` passes; `src/`, `include/`, and `configs/` have no tracked changes.
- The repo-wide source-policy sweep reports 77 existing findings. Its audit implementation is unchanged, and a frozen `HEAD` audit produces identical findings. Target finalization still enforces policy; no exceptions or game-source repairs were added.
- Full test suite: 1,117 passed, one pre-existing failure. `contextExport.test.ts` reports 11 unresolved published M2C types. The frozen baseline produces the same definitions and unresolved set; this optimization does not repair or hide that separate problem.
- Repository-wide `tsc --noEmit` already fails. Compared with archived `HEAD`, normalized diagnostics introduce no new errors (1,344 baseline versus 1,343 here).

### Deliberate limits

The outer preparation packet still conservatively fingerprints the source/header population. Expensive analysis, independent seed verification, and draft generation have their own narrower freshness domains, so an unrelated edit need not redo them. Request-scoped metadata is not shared indefinitely, and persistent cache corruption is a miss. Receipts do not cross processes or worktree/trunk boundaries. No game source, generated headers, inference-policy changes, or unrelated baseline repairs are part of this changeset.
