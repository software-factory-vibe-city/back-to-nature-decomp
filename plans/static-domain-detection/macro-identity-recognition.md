# Plan: macro-identity recognition and unknown-macro mining

**Status: CLI/API, explicit coverage/presence tiers and routing implemented;
conversion acceptance gate remains open.** Originally
proposed 2026-10-06 from the asm-exception survey of the same date (all 36
allowlisted exceptions catalogued; approvals, techniques ledger, and TU
groupings cross-read).

## Delivered scope

The initial delivery was standalone CLI/API. The follow-up requested coverage,
presence and routing changes are now implemented:

- `npm run macro-identity` / `tools/diagnostics/macroIdentity.ts` scans every
  configured EXE/overlay function and prints every macro/COP2 detection.
  `--json` returns the full census; `--all` also prints no-COP2 controls.
- Exported `detectMacroIdentities(options)` accepts injected function bytes,
  templates, symbols and groups. Default headers also include this repo's
  `include/scratchpad.h`. `tileMacroFunction` handles one function;
  extraction, production-toolchain command resolution and both mining tiers
  are exported too.
- Templates come from the pinned C AST, retain exact asm literals and block
  boundaries, and report unsupported or ambiguous definitions. Header vintages
  are alternatives, not silently overwritten definitions. Nop-only templates
  are not evidence of macro origin. Tiling is conservative across compiler
  gaps, hard-register effects, control transfers and incoming branch targets.
- EXE SDK object-interior functions use the original function table bounded by
  splat text objects. Overlays use only configured c/asm subsegments. Invalid
  extents, missing inputs and unresolved member bases are findings.
  Schema v3 explicitly lists containers scanned and extracted overlays skipped,
  with scope/source eligibility and reasons. Unenabled members additionally get
  an unbounded presence-only COP2/LWC2/SWC2 word census, clustered >=3 hits per
  32-word window. Enabled presence scans use splat text bounds; data hits in the
  ovl_11 work area are negative controls. Presence is never macro identity.
- Each function carries the strict four-way verdict, explained/total/fraction,
  aggregate and per-tile absorbed nops, vintage witnesses/alternatives, source
  representation metadata and an oracle-unverified macro-call list. Vintage
  families group alternative headers by shared macro definitions; unrelated
  project headers can coexist without a false mixed-SDK-vintage finding.
  Only distinct witnesses within one family establish mixing in a function/TU.
  Source representation is metadata only, not a target-byte eligibility filter.
  A conversion queue prioritizes existing asm bodies, then stubs by coverage
  fraction and size; it does not imply those conversions have been completed.
- callGraph/progress consume the tiler verdict and retain COP2 targets as
  eligible/counted work, rather than assigning handwritten = gte. Triage pushes
  header identity and candidate C before source/allocator diagnostics; the
  population doctrine no longer treats COP2 as handwriting evidence.
- Stock SDK `.word` values such as `0x7f` are **DMPSX sentinels**, not final GTE
  words. The default oracle discovers the active assembler include graph from
  a real `common.h` compile, then measures command expansions through the
  production cpp/cc1/maspsx/GAS helpers, separately for EXE and overlay flags.
  This repo's graph reaches `include/gte_macros.inc`; the report records its
  definition lines, include hashes, flags and emitted object bytes. SDK literals
  stay intact. No synonym/argument guesses are made for absent local names.
  Per-vintage diagnostic substitution headers preserve asm-block/clobber
  boundaries, but are never integrated into live sources. This is explicit GAS
  normalization, not a claim that including the `.inc` rewrites SDK `.word`
  literals. The previous foreign replacement-header adapter was removed;
  `--encoding-header` is rejected. `--raw-headers` is a labeled diagnostic mode.
- `--mine tier-a|tier-b|all` enables bounded recurrence mining. Tier A requires
  asm-like signals; the two-site invariant-core/variant-feed exception finds
  `CAPTURE_RA`. Tier B reports shared source shapes, including a delay-slot-aware
  call/constant-store effect spine and byte-identical whole-function groups.
  Pattern/candidate limits and search incompleteness are explicit. All verdicts
  are macro-candidate/compiler-explainable/undetermined; Tier B separately
  states a shared-source-shape claim. Map accounting states singleton and
  scan-order bias. The clean-C negative sample is freshly byte-verified before
  mining; both CAPTURE_RA and number-draw golden rediscoveries remain tested.

Acceptance tests in `tools/diagnostics/macroIdentity.test.ts` pin the literal
`gte_ReadRotMatrix` expansion, both vintages, strict/gapped ordering, nop
absorption, register hazards, control boundaries, ambiguity, operand resolution,
production GTE command probes in both flag columns, generated-header
compilation, removed foreign-header input rejection and overlay data exclusion. Original-byte cases
verify D6B8's entry expansion, DFD4's inventory, both CAPTURE_RA sites and their
withheld-template rediscovery, the ovl_11 number-draw trio, and the E1770/10BC54
identical-function pair. Original-input tests explicitly skip when local
extracted inputs are unavailable; synthetic tests always run.

**Not delivered / remaining gates:** no new GTE C conversion or policy grant.
The routing/push changes are implemented, but Phase 3's parked-function
byte-match acceptance gate remains open. `func_80038674` is only 7/16 COP2
explained: the save/restore frame is not a known-header tile. Its configured
0x50-byte extent excludes its return, assigning the next 0x10 bytes to
`dmynot1.o`. The complete 0x60 bytes match the SDK signature named
`OuterProduct0` (SMP_00_1.OBJ in the signature DB; the physical lib object of
that name contains Lzc). A previous compiled candidate matches the body but
adds the omitted return. Do not hide this layout defect with a full-asm body,
new padding asm or hand-edited generated splat config. Repair the library
attribution/generator first, then decide the correct SDK-function treatment
and run the complete byte/policy gate. No parked EXE stubs were overwritten. Parametric command-word expressions, composites containing C
computations and arbitrary pointer arithmetic remain extraction diagnostics.
Operand resolution is straight-line and symbolic, not a full frame/CFG/type
reconstruction. Tier A uses finite contiguous windows rather than an unbounded
suffix-array search; the actual 80038674 save/restore-frame rediscovery gate
is not claimed. Mining's rigidity signals are observations/heuristics, not
proof that cc1 cannot generate a sequence. SDK command names absent from the
active GAS definitions remain unresolved rather than borrowing another
project's aliases.

## Purpose

Scan every function in the target — main executable and overlays — and answer
two questions statically, before any source is authored:

1. **Known-macro identity.** Which regions of this function are the expansion
   of a known macro (PSY-Q GTE inline macros, recovered studio macros such as
   `CAPTURE_RA`), which macro, with which operands — and therefore which C
   statement reproduces them?
2. **Unknown-macro candidates.** Which recurring instruction patterns across
   the binary behave like macro expansions that we have *not* identified yet,
   and what would the candidate macro's parameter list be?

The payoff is routing: functions that today park forever or exit through
full-asm policy exceptions become ordinary compiled-C targets whose asm
islands come from a header, exactly like the original source.

## Evidence this is worth building

- `include/psyq/gtemac.h`, `inline_c.h`, and `inline_o.h` are vendored and
  **no source file uses them**. Meanwhile `func_8001D6B8`'s first 16
  instructions are an instruction-for-instruction expansion of
  `gte_ReadRotMatrix(<sp-local>)` from `inline_c.h` — same `$12/$13/$14`
  scratch order, same store interleave, `%0 = $sp`. That function is compiled
  C with SDK macros, currently classified "handwritten" and parked as
  INCLUDE_ASM.
- Fourteen address-named main-exe functions contain cop2 instructions:
  `func_8001B5DC, 8001B6A0, 8001BB88, 8001BBD8, 8001C37C, 8001D348,
  8001D6B8, 8001DCB0, 8001DE4C, 8001DFD4, 8001E088, 8001E26C,
  80037494, 80038674`
  (`80037494` sits in the SDK lib region and is likely library code; the
  rest are currently treated as game code). DFD4 already uses SDK macros;
  38674 remains an asm body with the boundary defect described above. Eleven
  remain INCLUDE_ASM payloads; all eleven are included in the target-byte census.
- The classification that blocks them is explicit:
  `tools/agent/callGraph.ts:161` and `tools/diagnostics/progress.ts:88` regex
  cop2 mnemonics and set `handwritten = "gte"`, and
  `prompts/reference/population.md` (§ top-level assembly) treats
  "established GTE/cop2 routines" as legitimately assembly. Detection exists;
  it feeds the wrong conclusion.
- The `CAPTURE_RA` precedent (`notes/research/caller-capture-debug-hook.md`)
  shows both the value and the proof form: an **invariant instruction core
  with variant, compiler-generated operand feeds across sites is what proves
  a shared parameterized macro**. Recognizing it converted a stuck 28/29
  hybrid into three lines of natural C plus a header macro.
- The 2026-10-06 ovl_11 catalog surfaced compiled-idiom recurrences that smell
  like project macros: the `-1`-then-zeros slot clear (twice verbatim in
  `ovl_11_func_800F2880`, 18x in `ovl_11_func_8010476C`), the
  format-terminate-blit number trio in `ovl_11_func_800F8B4C`
  (`func_8001A970(...)` → `*(u16*)end = 0xFFFF` → `func_80017B3C(..., 0x6E)`),
  and one byte-identical function pair at two addresses
  (`ovl_11_func_800E1770` ≡ `ovl_11_func_8010BC54`).

## Goals

1. A template library generated mechanically from the vendored headers — not
   hand-transcribed — plus project-recovered macros (`CAPTURE_RA`).
2. A tiler that labels each function's asm-origin regions with macro identity,
   operands, and header vintage, and emits the candidate C statements.
3. A three-way classification replacing "cop2 ⇒ handwritten":
   `handwritten-asm` / `compiled-with-asm-macros` / `undetermined`.
4. A miner that proposes **unidentified** macro candidates with evidence, in
   two tiers: asm-origin templates and compiled-idiom recurrences.

## Non-goals

- GPU packet macros (`setPolyF4`, `setRGB0`, tag merges). Those expand to
  plain C stores and are owned by the existing SDK-idiom detector
  (`sdkIdioms.ts`, `prompts/reference/sdk.md`). This plan covers macros whose
  expansion is *assembly*.
- Editing any source. Output is a report plus candidate C; the oracle
  (`diffFunc`) remains the only authority on correctness.
- Provenance claims. Per the sdk.md doctrine, a matching expansion means
  "test this representation", never "the historical names are proved".

## Design

### Phase 1 — template extraction

Build `tools/diagnostics/macroTemplates.ts` (final location per
`notes/tools-directory-structure.md`): parse the asm strings out of a header
set and compile each macro into a match template.

- Input: a directory of headers (default `include/psyq` plus
  `include/debughook.h`). General-purpose: nothing game-specific; another
  project points it at its own header set.
- A template is an ordered list of instruction patterns:
  opcode fixed; registers fixed where the macro hardcodes them (`$12–$15`,
  `$8`), wildcard where the template has `%0`/`%1`; immediates fixed
  (including GTE op words such as `0x4A180001` RTPS, which uniquely pin the
  op macro).
- Adjacency rules reflect asm-block structure: **strict order inside one asm
  block; gap-tolerant between blocks** (the compiler may schedule its own
  instructions between successive asm statements — `inline_o.h` is one
  statement per instruction; `gtemac.h` composites are sequences of primitive
  macros).
- Hazard tolerance: ASPSX/maspsx-inserted nops (load-delay, GTE interlock)
  may appear inside or between template instructions in the target; patterns
  must skip nops explicitly and report how many were absorbed.
- The two header vintages are distinct template sets and must stay
  distinguishable: `inline_c.h` (single multi-instruction asm, `$12`-first
  scratch, direct `off(%0)` addressing) vs `inline_o.h` (`move $12,%0`
  staging, universal clobber set, per-statement blocks).

Test: template extraction over `inline_c.h` yields a `gte_ReadRotMatrix`
template whose literal expansion equals the header text; a golden test pins
a handful of extracted templates against hand-checked expansions.

### Phase 2 — census and tiling

Build `tools/diagnostics/macroTiler.ts`:

- Input: function table + bytes. Main exe: the per-function disassembly
  already in `build/functions/*.s`. Overlays: decode from
  `extracted/overlays/*.bin` bounded by the splat yaml text sections (no
  standing overlay disassembly exists; do not widen scans into data — the
  `overlayFlagFingerprint.ts` header comment documents the misdecode trap).
- Output per function:
  - cop2 inventory (count, mnemonics);
  - tiling: list of `(macro, header vintage, operand bindings, vram range,
    nops absorbed)`;
  - coverage: fraction of cop2-bearing instructions explained by templates;
  - verdict: `fully-tiled` / `partially-tiled` / `no-template-match` /
    `no-cop2`;
  - for tiled regions, the candidate C statements with operands resolved
    through the surrounding compiler code where possible
    (`gte_ReadRotMatrix(&m)` with `m` a stack local at the observed offset),
    explicitly labeled as candidates for oracle verification.
- Vintage is also reported per suspected TU: mixed vintages inside one TU is
  a finding, not an error.
- The tool reports only what it proves. A cop2 region no template explains is
  `no-template-match`, never "probably handwritten".

Tests: `func_8001D6B8` reports `gte_ReadRotMatrix` at entry
(`inline_c.h` vintage, `%0 = $sp+0`); `func_8001DFD4`'s inventory matches its
existing asm stub line-for-line; the two `CAPTURE_RA` sites
(`func_80016054`, `func_80015704`) are found by the template path, not by a
special case; a known clean-C function with no cop2 reports `no-cop2` with an
empty tiling.

### Phase 3 — classification and routing integration

- Replace the two-way `handwritten = "gte"` in `callGraph.ts` /
  `progress.ts` with the tiler's three-way verdict.
- Amend `prompts/reference/population.md`'s top-level-assembly paragraph:
  cop2 content alone does not establish handwritten origin; a fully- or
  mostly-tiled function is compiled C with header macros, and the
  reconstruction route is the tiler's emitted C.
- Add a triage push detector (per the knowledge-retrieval design: push via
  `triage.ts` symptom detectors, not search): opening a cop2-bearing function
  surfaces the tiling report and the candidate C before any source authoring.
- Policy note for the owner: a function reconstructed with vendored-header
  GTE macros should carry the same classification treatment as `CAPTURE_RA`
  sites — embedded asm that *is* the original abstraction, allowlisted as
  such — rather than being a per-function workaround grant. This is a policy
  decision; the plan only files it.

Test: end-to-end on one parked cluster member (suggest `func_8001D6B8`):
tiler output → C with `gte_*` macros → `diffFunc` VERDICT MATCH → `make
check`. That single match validates the entire route and is the acceptance
gate for the phase.

### Phase 4 — unknown-macro mining

Two miners, separate outputs, shared normalization.

**Tier A — asm-origin candidates.** Find recurring sequences that behave like
asm, not like compiled code:

- Normalize each function to `(opcode, reg-rigidity, operand-class)` tokens.
- Mine maximal repeated subsequences (suffix array or winnowed shingles) with
  support ≥ 3 sites.
- Score candidates by macro-likelihood signals, each reported separately:
  - **register rigidity**: the same hard registers at every site, in
    registers the allocator varies elsewhere (the `$12–$15` asm-scratch
    convention is a strong prior);
  - **order rigidity**: the sequence contains dependence-independent pairs
    (build the intra-sequence DAG) that never permute across sites — compiled
    code at `-O2` reorders with context; volatile asm does not;
  - **invariant core, variant feed**: identical core fed by *different*
    compiler-generated operand computations per site — the `CAPTURE_RA`
    proof form, and the direct evidence of a parameter;
  - **non-GCC idioms**: instructions cc1 never emits (e.g. `ori rX,$sp,imm`);
  - cop2 content.
- Output per candidate: the template, the wildcard slots (= proposed macro
  parameters), the occurrence table (function, vram), and a verdict of
  `macro-candidate` / `compiler-explainable` / `undetermined`. Undetermined
  stays undetermined.

**Tier B — compiled-idiom candidates (stretch).** For macros whose expansion
is ordinary compiled code, mine normalized recurrence instead:

- Abstract allocator-variable registers and stack offsets; keep opcode
  skeleton, call targets, and distinctive constants (`0xFFFF`, `-1`-then-zero
  store runs, shared magic arguments like `0x6E`).
- Report recurring shapes with ≥ 3 sites (expected rediscoveries:
  the slot-clear shape, the number-draw trio, the `+0xFFF >> 12` fixed-point
  round) and byte-identical whole-function pairs (expected:
  `800E1770` ≡ `8010BC54`), the latter as shared-header-static evidence for
  `notes/file-groupings.md`.
- Tier B proposes *shared source shapes*, not confirmed macros; its output
  feeds file-groupings and the known-solutions ledger, not the tiler.

Tests: with the GTE templates deliberately withheld, Tier A rediscovers the
`cfc2/ctc2` save-restore frame of `func_80038674`-class routines as a
candidate; Tier A rediscovers `CAPTURE_RA` from its two sites via the
invariant-core/variant-feed rule; Tier B surfaces the `800F8B4C` number trio
and the `E1770/10BC54` twin pair. A negative control: a sample of matched
clean-C functions must produce no `macro-candidate` verdicts above threshold.

## Phasing and effort

| Phase | Deliverable | Gate |
|---|---|---|
| 1 | template extraction from headers | golden expansion tests |
| 2 | census + tiler over exe and overlays | D6B8/DFD4/CAPTURE_RA tests |
| 3 | classification + triage routing | one parked GTE function matched end-to-end |
| 4A | asm-origin miner | CAPTURE_RA rediscovery + negative control |
| 4B | compiled-idiom miner | trio + twin rediscovery |

Phases 1–3 are the value path and unblock the GTE cluster; 4A/4B are
independent and can trail.

## Risks and open questions

- Operand resolution (reg → symbol/stack slot) needs the surrounding compiler
  code; keep it best-effort and clearly labeled — wrong operand guesses must
  not flow into source unverified.
- Some cop2 functions may be genuinely handwritten (`func_80038674`'s
  surroundings use assembler-style register conventions). The three-way
  verdict exists precisely so the tool never forces these into the C route.
- maspsx nop behavior differs by ASPSX version; absorb-and-report rather than
  hardcode counts.
- Miner support thresholds will need tuning against the binary's real
  recurrence floor; start conservative (support ≥ 3, all rigidity signals
  required) and loosen only with a false-positive audit.
