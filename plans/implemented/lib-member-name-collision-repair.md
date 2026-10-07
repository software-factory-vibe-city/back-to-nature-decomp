# Plan: repair PSY-Q member-name collisions in the lib split and detector

**Status: implemented.** Proposed 2026-10-06. Root cause verified; see
`notes/retros/2026-10-06-outerproduct0-member-collision-retro.md` for the
narrative. This plan fixes the mechanism and retires the one realized
casualty (`func_80038674` = libgte `OuterProduct0`).

## Purpose

PSY-Q `.LIB` archives store member names in 8 characters, and distinct
functions collide onto one name. The lib split keys extracted objects by
member name (last write wins), and `detectLibFunctions.ts` keys its
signature-to-object cross-check by the same name — so a colliding member's
signature can match the binary perfectly and still be silently discarded
because the `.o` on disk belongs to a different function. The discarded
region then gets mopped up by other passes as fake game code and fake
stub placements. Fix the keying, make the contradiction loud, re-run
detection, and delete the artifacts the bug manufactured.

## Verified evidence

- `tools/vendor/psx_psyq_signatures/470/LIBGTE.LIB.json` has 535 entries,
  505 distinct names, **11 colliding names**. `SMP_00_1.OBJ` names three
  different functions: `LightColor`, `OuterProduct0`, `Lzc`. The other ten:
  eight `PRS_*` GsPrst families (4 variants each) and `CLIP_FT_`/`CLIP_GT_`.
- `lib/libgte/smp_00_1.o` on disk contains **Lzc only** (objdump: 8 words,
  `mtc2/mfc2/jr`). `OuterProduct0`'s and `LightColor`'s objects exist nowhere
  in `lib/`. Every colliding `prs_*` object likewise holds only its family's
  last variant.
- `detectLibFunctions.ts` resolves sig→`.o` by member name
  (`sigNameToOPath`, ~line 291) and drops any candidate whose signature is
  larger than the `.o`'s `.text` at line 364 — stderr under `--verbose`
  only, counted in `skippedSizeMismatch`, absent from output.
- `OuterProduct0`'s signature is 96 bytes, zero wildcards, and matches the
  binary exactly at ROM 0x28E74 (vram 0x80038674). The cross-check loaded
  Lzc's 32-byte `.o`; 96 > 32; dropped silently.
- `Lzc`'s own signature legitimately matched at 0x28ED4 (the word
  0x4884F000 sits at 0x800386D4) — that placement is correct, it just
  carries the shared name `smp_00_1`.
- The orphaned head became game function `func_80038674` (game code jals
  it); the orphaned tail (`jr $ra` + nops at 0x28EC4) was placed as
  `../lib/libsnd/dmynot1` with `dmy_nothing1 = 0x800386C4` in
  `configs/symbols/exe.txt` — a zero-relocation stub placed on the strength
  of exe.txt's own earlier output.
- Scope check: `LightColor`'s distinctive GTE op word (0x4A4DA412) is
  absent from the exe, and no `PRS_*`/`CLIP_*` collision member is placed in
  the yaml — **OuterProduct0 is the only realized casualty in SLUS-01115.**
  The bug is latent for any other binary (tools are meant to be
  general-purpose).

## Phases

### Phase 1 — collision-aware lib split

Re-extract the colliding members so every function's object exists on disk.

- Teach the lib-split tooling to detect member-name collisions (same stored
  name, different content) and emit disambiguated filenames, e.g.
  `smp_00_1__OuterProduct0.o`, `smp_00_1__LightColor.o`,
  `smp_00_1__Lzc.o` — member name plus first defined symbol. Keep a
  machine-readable member↔symbol↔file map alongside `lib/` (this also fixes
  the discoverability problem: greps for `OuterProduct` currently find
  nothing because objects are named only by member).
- Re-split LIBGTE (and any other lib with collisions) accordingly. Existing
  non-colliding filenames stay unchanged so the yaml's current references
  don't churn.

Gate: all three `SMP_00_1` functions exist as objects whose `.text` matches
their signature lengths; the eight `PRS_*` families each have 4 objects;
`CLIP_FT_`/`CLIP_GT_` have 3 each.

### Phase 2 — detector fixes

- Resolve sig→`.o` through the Phase-1 map instead of bare member name, so
  each signature is checked against *its own* object.
- Make the contradiction loud: a signature that matches the binary but
  fails its object cross-check (missing file, size mismatch, content
  mismatch) is reported **always**, as a distinct `matched-but-unverifiable`
  category in the tool's output — never verbose-gated. The
  `skippedNoFile`/`skippedSizeMismatch` counters already exist; promote
  their detail to the result.
- Zero-relocation placement guard (already steered separately): an object
  whose `.text` is only a return plus padding (`dmynot1`-class) must not be
  placed on the strength of an exe.txt name alone, and never where it
  straddles the epilogue position of a preceding unmatched region.

Gate: unit test with a synthetic two-member collision fixture — the larger
member's signature must verify against its own object, and deleting one
object must produce a visible `matched-but-unverifiable` row, not silence.

### Phase 3 — re-run detection and retire the artifacts

Through the generators only (splat.yaml and exe.txt are tool-derived; no
hand edits):

- Re-run `detectLibFunctions` → `OuterProduct0` claims 0x28E74–0x28ED4
  (0x60: 20 instructions + `j $31` + 3 pad nops, matching the LIB's own
  member).
- Regenerate the layout; the `func_80038674` C segment and the
  `../lib/libsnd/dmynot1` placement at 0x28EC4 disappear;
  `dmy_nothing1 = 0x800386C4` leaves `configs/symbols/exe.txt`.
- Delete `src/func_80038674.c` (the allowlisted asm body) and its
  `.pi/autoloop.json` `sourcePolicy.allowlist` entry; update any callers'
  declarations to the real symbol name if the symbol map renames it.
- Full gate: `make check` SHA-256 payload match. The bytes were always
  right; this phase only corrects their provenance.

Gate: `make check` passes with `func_80038674` absent from src/ and the
allowlist, and the linked region sourced from the real SDK object.

### Phase 4 — regression coverage

- A collision audit test over every vendored signature set: list colliding
  names, assert each has a disambiguated object on disk, and fail on new
  silent drops (`matched-but-unverifiable` must be empty or explicitly
  acknowledged in the run's output).
- Cross-reference: the boundary-premise triage check proposed in
  `plans/static-domain-detection/` (a region claimed as a compiled game
  function must contain its own return and must not abut a zero-reloc lib
  placement) would have converted this from a two-agent, two-hour semantic
  dead end into an immediate map finding; implement it there, test it on
  this case.

## Implementation and verification

- `splitSdkLibs.ts` preserves LIB v1/v2 and ar member occurrences, identifies
  same-name/different-content groups, and recovers 41 LIBGTE variants under
  `build/sdk/lib/470/libgte/`. The member/symbol/signature map is
  `build/sdk/member-map-470.json`. Generated binary artifacts are never
  written to `src/` or `lib/`; existing non-colliding SDK inputs are unchanged.
  Cold recovery uses an explicitly supplied `psyq2elf` executable; warm runs
  reuse content-identified objects. SDK-version namespaces cannot overwrite
  one another.
- Detection reports include `matches`, `matchedButUnverifiable`,
  `rejectedPlacements` and `unacknowledged`. The three pre-existing missing
  CRT/C++ trampoline objects remain visible and have reviewed, exact
  binary/signature/reason/offset acknowledgements in
  `configs/library-detection.json`. New contradictions fail generation.
- Downstream symbol, dependency, layout and patched-object paths consume the
  member identities. Return/padding stubs cannot place themselves using
  exe.txt; dependency placement also guards against splitting a missing
  epilogue. Triage exposes the boundary premise; see
  `plans/static-domain-detection/boundary-premise.md`.
- Generated layout now links the complete 0x60-byte `OuterProduct0` member
  and the disambiguated `Lzc`. The false source and allowlist entry are
  removed. The caller uses the real three-argument SDK prototype and remains
  byte-identical. Generators also retire the padding label `func_800386CC`
  and the independently disproven return-stub alias `ChangeClearSIO` inside
  another verified SDK object; no unrelated source is removed.
- Regression tests cover the synthetic two-member collision, missing/wrong
  objects, complete-content/relocation checks, version isolation, stale
  symbol retirement, return-stub rejection and the original broken/repaired
  boundary. The provisioned 4.7 audit verifies 11 collision names/41 objects.
  Every other vendored signature version is enumerated as
  **not-provisioned**: those versions have no converted object maps here.
  `--require-version`/`--require-all` fail rather than claim coverage for
  unavailable SDK inputs.
- `make split` regenerates the layout, and `make check-all` passes the
  original payload and all 13 overlay byte-identity gates. All 22 focused
  SDK-member, ELF-section and macro-coverage regression tests pass. The
  caller also passes its 77/77-word relocated-byte comparison. Objects
  linked for this region come from the real SDK member, not the retired
  assembly body.

## Risks

- Renaming split objects can disturb yaml references for non-colliding
  members if done broadly — keep renames scoped to colliding names only.
- Some signature sets may collide differently across SDK versions
  (370/420/430/470 directories); the audit should run per version
  directory, not just 4.7.
- `patchSplatForLibs.ts` / `addLibSymbols.ts` downstream of the detector
  may assume unique member names; check both before Phase 3.
