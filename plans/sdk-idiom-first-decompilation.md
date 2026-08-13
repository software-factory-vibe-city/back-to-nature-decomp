# Plan: make SDK-idiom reconstruction the default before allocator tuning

**Status: proposed.**

## Purpose

Make future agents reproduce the strategy that matched `func_800134C4`:
recognize the original PSY-Q packet abstractions, replace hand-transcribed
field stores and tag arithmetic with SDK types/macros, and only then search a
small bounded statement-order space.

The motivating function initially looked like an instruction-selection,
allocation, and scheduling problem. Its source manually represented:

- a 24-byte `POLY_F4` packet;
- a 12-byte `DR_MODE` packet;
- two 24-bit ordering-table tag merges.

Reconstructing those operations as `setPolyF4`, `setRGB0`, `setXYWH`,
`setSemiTrans`, `setDrawMode`, and two `addPrim` calls changed the candidate
from 106 instructions to the target's 105 and removed the broad register
rotation. Exhaustively testing the 24 orders of the four independent primitive
initializer calls then found the exact natural order:

```c
setPolyF4(poly);
setRGB0(poly, color, color, color);
setXYWH(poly, 0, 0, 0x280, 0x1E0);
setSemiTrans(poly, 1);
```

The current workflow does not reliably lead a smaller agent there:

1. `sdkIdioms.ts` requires an exact `(len, code)` pair. The target stores code
   `0x2A`, while `setPolyF4`'s base code is `0x28`; bit 1 was added by
   `setSemiTrans`, so detection returns no primitive.
2. The SDK layout parser rejects fixed arrays, so it cannot model
   `DR_MODE.code[2]`.
3. The residual source search does not treat adjacent SDK macro calls as a
   bounded statement-order region.
4. `fuzzVariants.ts` can print a full-mode `105/105` variant below an
   `inconclusive` mechanism verdict without a prominent instruction to run the
   exact relocated oracle. The candidate is present, but easy to overlook.
5. Triage continues to print a flag signal after `flagProbe` has shown the
   relevant flag column tied with baseline for the current source.

The plan fixes those workflow gaps without weakening byte verification,
clean-source policy, or the requirement that generated candidates be promoted
manually.

---

## Design principles

1. **Recover operation boundaries before compiler-state tuning.** A recognized
   SDK packet is a source-semantics finding, not a style suggestion.
2. **Parse the configured SDK headers.** Do not duplicate packet sizes, field
   offsets, command values, or macro expansions in TypeScript.
3. **Attribute compatibility, not provenance.** A matching packet shape means
   “test this SDK representation,” not “the historical names are proved.”
4. **Recognize composed macros.** Attribute bits applied after a base
   initializer must not hide the primitive type.
5. **Search only complete, dependency-valid macro calls.** Never permute the
   stores inside one SDK macro expansion.
6. **Exact candidates outrank diagnostic verdict wording.** Mechanism evidence
   still determines diagnosis, but a byte-exact candidate must be impossible
   to miss.
7. **Fail closed.** Ambiguous base-register grouping or command decoding yields
   an explicit ambiguous finding, never a confident SDK type.
8. **No automatic promotion.** Candidates stay under `build/` until confirmed
   by `diffFunc`, copied deliberately, and finalized normally.

---

# Phase 0: add a regression fixture for the motivating shape

## Change

Add target-instruction fixtures to a new `tools/agent/sdkIdioms.test.ts`.
Transcribe only the relevant target windows rather than depending on ignored
`build/` artifacts:

- `sb 5, 3(base)` and `sb 0x2A, 7(base)`;
- RGB stores at `+4..+6`;
- four XY halfword pairs through `+8..+0x16`;
- a second base with `sb 2, 3(base)`, `sw 0xE1000740, 4(base)`, and
  `sw 0, 8(base)`;
- the two `0xFFFFFF` tag-link sequences.

Add focused negative fixtures:

- a code byte whose bits above the SDK attribute mask differ from every base
  primitive code;
- len and code stores through different bases;
- an unrelated 24-byte struct that happens to write offsets `+3` and `+7` but
  lacks the complete field/constant geometry;
- an E1 command without the `DR_MODE` length and trailing word stores;
- a tag mask sequence whose stores do not connect the packet and ordering-table
  pointers.

Export the small pure recognition helpers needed by tests. Keep target assembly
construction outside the unit tests.

## Acceptance

The current detector fails the composed-code fixture for the documented reason,
and the test becomes green only after Phase 1. Negative fixtures produce no
confident type.

---

# Phase 1: recognize composed primitive initializers

## Problem

`findPrimitive` currently requires:

```ts
p.len === observedLen && p.code === observedCode
```

That rejects ordinary SDK composition such as:

```c
setPolyF4(p);       /* code 0x28 */
setSemiTrans(p, 1); /* code 0x2A */
```

The low code bits are documented attributes:

- bit 1: `setSemiTrans`;
- bit 0: `setShadeTex`.

## Change

In `tools/agent/sdkIdioms.ts`:

1. Parse the `setSemiTrans` and `setShadeTex` definitions from
   `include/psyq/libgpu.h` to derive their masks instead of hardcoding `0x02`
   and `0x01`.
2. Match a primitive when:
   - length is exact;
   - the observed code with parsed attribute bits removed equals the parsed
     initializer's base code; and
   - the remaining target field geometry is compatible with that primitive.
3. Record the composition explicitly:

```text
POLY_F4 via setPolyF4(p) + setSemiTrans(p, 1)
observed code 0x2A = base 0x28 | semitrans bit 0x02
```

4. If an observed low bit corresponds to `setShadeTex`, emit that macro advice
   too. Do not infer the Boolean source expression, only the resulting enabled
   or disabled state.
5. Change the report schema from one opaque match to an evidence-bearing match:

```ts
interface PrimitiveMatch {
  type: PrimitiveType;
  base: string;
  observedLen: number;
  observedCode: number;
  baseCode: number;
  attributes: Array<{ macro: string; mask: number; enabled: boolean }>;
  confidence: "exact-composite" | "ambiguous";
  evidence: string[];
}
```

The CLI can preserve its existing `primitive`, `base`, and `written` fields for
one compatibility release, while adding `objects` in Phase 2.

## Soundness rules

- Attribute stripping is allowed only for masks parsed from the active SDK
  header.
- Length remains exact.
- If two primitive definitions remain compatible after attribute stripping,
  report both as ambiguous and do not recommend a concrete type.
- A code byte with any unexplained differing bit is not a match.

## Acceptance

`psx_sdk_idioms func_800134C4` names `POLY_F4`, `setPolyF4`, and
`setSemiTrans`, and prints the full field map. Existing exact-code primitive
fixtures remain unchanged.

---

# Phase 2: recognize command packets and chained `addPrim` operations

## 2.1 Parse fixed arrays in SDK structs

Extend `layoutStruct` to support fixed-size arrays whose element type is known:

```c
u_long code[2];
```

Represent both the aggregate field and addressable elements, for example:

```text
0x4 code[0]
0x8 code[1]
```

Continue to reject flexible arrays, unknown dimensions, nested anonymous
aggregates, and bitfields the parser cannot lay out exactly.

This makes the parsed `DR_MODE` layout 12 bytes without duplicating that fact.

## 2.2 Index command-packet macros from the header

Parse macros with a `setlen` plus fixed word stores, starting with the family
that includes `setDrawMode`, `setDrawTPage`, `setTexWindow`, and `setDrawStp`.
Store normalized recipes:

```ts
interface SdkPacketRecipe {
  macro: string;
  type: string;
  size: number;
  len: number;
  writes: Array<{
    offset: number;
    width: number;
    expression: string;
    constantMask?: number;
    constantValue?: number;
  }>;
}
```

Use parsed helper macro expressions such as `_get_mode` and `_get_tw` where
they reduce to constants in the target. If an expression cannot be evaluated
from observed constants, report the packet family without inventing arguments.

For the motivating shape, emit:

```text
DR_MODE via setDrawMode(p, dfe, dtd, tpage, tw)
len 2 at +3; E1 mode command at +4; zero texture-window word at +8
observed command 0xE1000740
```

Argument recovery is optional advice and must be confidence-labelled. The
packet type and macro family are the required output.

## 2.3 Support multiple SDK objects per function

Replace the singular report as the primary representation:

```ts
interface IdiomReport {
  objects: SdkObjectMatch[];
  links: SdkLinkMatch[];
  findings: IdiomFinding[];
  /* deprecated compatibility projection for one release */
  primitive: PrimitiveType | null;
  base: string | null;
  written: PrimitiveField[];
}
```

Group accesses by traced base-register web, not register spelling alone. A hard
register reused later for another pointer must not merge two objects.

## 2.4 Recognize the complete `addPrim` dataflow

Upgrade the current “mask present plus tag store” hint to verify both halves of
`addPrim(ot, p)`:

1. preserve the packet's top tag byte and take the ordering-table entry's low
   24 bits;
2. store the merged word to the packet tag;
3. preserve the ordering-table entry's top byte and take the packet pointer's
   low 24 bits;
4. store the merged word to the ordering-table entry.

Link the identified SDK object base to the ordering-table pointer base. Detect
sequential chains such as:

```c
addPrim(ot, poly);
addPrim(ot, drawMode);
```

Do not call a partial mask/store sequence exact `addPrim`; report it as
compatible/partial.

## Acceptance

The target report for `func_800134C4` contains two objects (`POLY_F4` and
`DR_MODE`) and two complete `addPrim` links sharing one ordering-table pointer.
The report supplies enough source-level operations to replace all hand-written
packet stores and tag merges.

---

# Phase 3: make SDK reconstruction a workflow gate

## 3.1 Triage severity and wording

Update `detectSdkIdioms` in `tools/agent/triage.ts`:

- If the target recognizes an SDK object but the current source does not use
  its type or equivalent SDK macros, emit a **signal** before inventory and
  allocation/scheduling findings.
- If the source uses the type but still manually expands recognized packet or
  link operations, retain a signal naming the missing macros.
- Once the source uses the recognized type and macro families, downgrade to a
  one-line info confirmation.

The signal must say:

> Restore the SDK operation boundary before allocator or scheduler work.
> Hand-written field stores and 24-bit tag arithmetic are a reconstruction
> defect when the configured SDK provides these macros.

## 3.2 Structural classifier routing

Teach `explainDiff.ts` to consume the SDK report when instruction selection,
web parity, or inventory differences overlap a recognized packet region. Add a
higher-priority explanation section:

```text
SDK OPERATION-BOUNDARY CANDIDATE
Target region is compatible with POLY_F4/DR_MODE/addPrim operations, while the
source expands them manually. Test the named SDK representation before acting
on allocation or scheduling classifications below.
```

This is advisory compatibility unless the source already uses the macros and
compiler attribution confirms their emitted region.

## 3.3 Skill and style-guide updates

Update `.pi/skills/psx-decompile-function/SKILL.md` and
`prompts/c-style-guide.md` with this order:

1. run triage/SDK detection;
2. reconstruct all named SDK types and macro operation boundaries;
3. re-run triage, inventory, exact diff, and classification;
4. only then trace allocation or scheduling;
5. if the remaining residual is order-only among adjacent independent SDK
   calls, run the bounded SDK statement-order batch.

Add the motivating case as a compact example. Do not copy project-specific
addresses or constants into reusable policy beyond the cited retrospective.

## Acceptance

On the pre-fix clean-C attempt for `func_800134C4`, triage and explainDiff both
direct an agent to `POLY_F4`, `DR_MODE`, and `addPrim` before compiler tracing.
On the matched source they emit only confirmation.

---

# Phase 4: add bounded SDK-call statement-order search

## Problem

After operation recovery, the only residual in the motivating function was the
birth/emission order of four complete SDK initializer calls. The general
residual grammar did not expose this axis, while a manual 24-permutation batch
found an exact candidate immediately.

## Change

Extend `tools/agent/residual-source-search/` with an SDK-call order stratum.

### Eligibility

A region is eligible only when all of the following hold:

- it contains 2–6 adjacent complete expression statements;
- each statement is a macro/function call recognized from the configured SDK
  header;
- all calls operate on the same packet pointer or on independently proven
  packet pointers;
- dataflow analysis proves there is no C dependency requiring one order;
- reordering does not cross control flow, declarations, labels, volatile
  accesses, calls with unknown effects, or an `addPrim` publication point;
- the current machine residual overlaps the region's emitted instructions.

Treat each macro call atomically. Never split or permute assignments inside a
macro expansion.

### Domain

For `N` eligible calls, enumerate at most `N!` dependency-valid orders. Include
the current order and deduplicate preprocessed and assembly classes using the
existing search pipeline. If the factorial exceeds the existing bounded-domain
policy, suppress the stratum and report the exact reason.

`addPrim` calls are publication barriers by default: initializer calls may move
before them but never after them. Preserve order between two `addPrim` calls
unless alias/dataflow analysis proves the order irrelevant and the target
residual specifically implicates it.

### Artifacts

Record in `grammar.json`:

- source ranges and call names;
- dependency edges;
- admitted permutations;
- suppressed permutations and reasons;
- SDK header hash used to identify the calls.

### Fallback

Expose the same finite transformation through a curated
`fuzzVariants.ts` transform template named `sdk-call-order`, so an agent can run
it explicitly when the automatic closure does not reach the region.

## Tests

- Four independent packet initializers produce 24 coordinates.
- A write/read dependency reduces the domain to the valid topological orders.
- `addPrim` prevents later initialization.
- Calls on an unknown pointer or through an unknown macro are suppressed.
- A generated exact candidate remains under `build/` and is never promoted.

## Acceptance

Starting from the SDK-based but nonmatching `func_800134C4` source, the residual
search includes the exact four-call ordering and reports an exact full-pipeline
candidate.

---

# Phase 5: make exact variant candidates impossible to overlook

## Problem

`fuzzVariants.ts` correctly separates mechanism confirmation from byte score,
but a full-mode exact candidate can still be labelled `inconclusive` when pass
tracing is disabled. In the motivating run, `p03` appeared as `105/105` among
24 rows with no prominent exact-candidate banner.

## Change

In `tools/agent/fuzzVariants.ts` and `tools/agent/variant-lab/types.ts`:

1. Keep `verdict` and `promotionEligible` semantics unchanged.
2. Add an orthogonal field:

```ts
exactCandidate: boolean;
exactCandidateBasis: "full-object" | "cc1-only" | null;
```

3. Render a banner before the ranked table whenever any candidate is exact:

```text
BYTE-EXACT CANDIDATE FOUND: p03
Preserved source: build/fuzz/.../variants/p03/source.c
Mechanism verdict is inconclusive because pass tracing was disabled.
Run the exact relocated function oracle before promotion.
```

4. For full-mode exact candidates, print the precise next command/tool action:
   copy deliberately, run `psx_diff_function`, then finalize normally.
5. For cc1-only exact candidates, state prominently that they are not
   promotion-eligible and must be rerun in full mode.
6. Rank exact candidates at the top of the rendered table **without changing
   mechanism verdicts**. The banner is an oracle result, not a causal claim.
7. Return a distinct successful process status only if the current CLI contract
   permits it without breaking callers; otherwise keep exit status stable and
   rely on structured JSON plus the banner.

## Tests

Extend `tools/agent/variant-lab/variant-lab.test.ts`:

- full-mode exact + tracing disabled: banner present, verdict may remain
  inconclusive, exact candidate is still named;
- cc1-only exact: banner says full confirmation required;
- full-mode exact + confirmed mechanism: remains promotion eligible;
- a normalized score equal to the target count but an unresolved relocation is
  not called byte-exact.

## Acceptance

The motivating 24-variant run leads with `BYTE-EXACT CANDIDATE FOUND: p03` and
cannot be reasonably mistaken for an exhausted or inconclusive search.

---

# Phase 6: carry flag-probe conclusions back into triage

## Problem

A target fingerprint should trigger an early probe, but once the probe shows
baseline tied with the proposed flag for the current source, repeatedly
printing the original signal distracts from source reconstruction. Triage and
flagProbe currently share no structured, freshness-checked state.

## Change

Refactor `tools/agent/flagProbe.ts` into importable analysis plus rendering:

```ts
interface FlagProbeReport {
  schemaVersion: 1;
  function: string;
  sourceHash: string | null;
  targetHash: string;
  toolchainHash: string;
  fingerprints: Fingerprint[];
  matrix: FlagMatrixRow[];
  conclusion: "supported" | "not-supported-current-source" | "inconclusive";
  dominantRows: string[];
  reasons: string[];
}
```

Write the report to `build/flagProbe/<function>/report.json`. Add `--json` and
unit-test the pure matrix conclusion logic.

Conclusion rules:

- `supported`: the candidate flag strictly improves the relevant measured
  column and the full escalation bar remains satisfiable;
- `not-supported-current-source`: baseline ties or beats the candidate flag on
  exact instruction count and masked score for this source hash;
- `inconclusive`: compile failure, incomparable structural result, missing
  source, or another source shape may still be required.

Update `triage.ts` to consume the report only when function, source hash,
target hash, and toolchain hash all match. Then:

- fresh `supported` report: retain the signal and cite the measured dominant
  row;
- fresh `not-supported-current-source`: downgrade to info and say “the current
  source does not support this flag hypothesis; continue source-shape/SDK
  reconstruction”;
- stale or absent report: retain the existing request to run flagProbe;
- never suppress the underlying target fingerprint from JSON evidence.

This does not prove a flag irrelevant for every source shape. Wording must stay
scoped to the current source.

## Acceptance

After probing the pre-fix or matched `func_800134C4` source, a second triage run
keeps the fingerprint as evidence but no longer directs the agent toward
`-mno-split-addresses` as the active remedy when its matrix ties baseline.
Changing the source invalidates the cached conclusion automatically.

---

# Phase 7: documentation and retrospective

## Change

1. Add `notes/retros/<date>-func_800134C4-retro.md` containing:
   - initial 106-vs-105 structural diff;
   - the missed `0x2A = 0x28 | 0x02` primitive signature;
   - `POLY_F4`, `DR_MODE`, and chained `addPrim` reconstruction;
   - the 24-call-order batch and exact order;
   - rejected constant-local and flag hypotheses;
   - exact diff and finalizer evidence.
2. Link the retro from the SDK section of `prompts/c-style-guide.md` and the
   relevant entry in `notes/file-groupings.md`.
3. Update `README.md` and `notes/tools-directory-structure.md` for:
   - multi-object SDK reports;
   - SDK-call-order residual search;
   - exact-candidate variant banners;
   - structured flag-probe artifacts.
4. Keep concrete target/toolchain facts in `configs/project-profile.md`; the
   retro may cite this project, while reusable guides remain project-agnostic.

## Acceptance

A future agent searching notes for “code 0x2A,” “manual addPrim tag merge,” or
“SDK macro statement order” reaches the retrospective and the automated tools.

---

# Delivery order

Implement in this order because each increment changes agent behavior on its
own:

1. Phase 0 — regression fixture.
2. Phase 1 — composed primitive detection.
3. Phase 2 — `DR_MODE`, multiple objects, and complete `addPrim` links.
4. Phase 3 — triage/classifier/skill routing.
5. Phase 5 — exact-candidate banner (small and independently valuable).
6. Phase 4 — bounded SDK-call-order grammar.
7. Phase 6 — freshness-checked flag-probe feedback.
8. Phase 7 — retrospective and documentation.

Do not wait for Phase 4 before shipping Phases 1–3. Naming the correct SDK
operations is the largest gain; an agent can already use `fuzzVariants` for the
small explicit order batch once the operations are visible.

---

# Verification

Use the narrowest tests while implementing, then the full gates:

```bash
npx tsx --test tools/agent/sdkIdioms.test.ts tools/agent/triage.test.ts
npx tsx --test tools/agent/variant-lab/*.test.ts
npx tsx --test tools/agent/residual-source-search/*.test.ts
npm test
make check
```

For the integration witness:

```text
psx_sdk_idioms func_800134C4
psx_triage func_800134C4
psx_diff_function func_800134C4
psx_finalize_function func_800134C4
```

The matched function must remain byte-identical throughout. Diagnostic tools
must not edit source, generated headers, compiler flags, or policy allowlists.

---

# Non-goals

- Proving historical typedef or variable names from machine code.
- Recovering arbitrary macro arguments when the target does not establish
  them.
- Treating every store at primitive-like offsets as an SDK object.
- Permuting stores inside an SDK macro expansion.
- Automatically copying a generated candidate into `src/`.
- Weakening the exact relocated-function oracle or full-build finalizer.
- Adding flag overrides, inline assembly, register pinning, or scheduling
  barriers.

---

# Completion criteria

The plan is complete when all of the following hold:

1. `sdkIdioms` recognizes primitive base codes with parsed SDK attribute bits.
2. It reports both `POLY_F4` and `DR_MODE` in the motivating function.
3. It verifies and reports both chained `addPrim` operations.
4. Triage and explainDiff route manual SDK packet reconstruction ahead of
   allocator and scheduler work.
5. Residual search can enumerate the bounded dependency-valid order of adjacent
   SDK initializer calls atomically.
6. `fuzzVariants` prominently names every full-mode exact candidate regardless
   of whether pass tracing confirmed the stated mechanism.
7. Fresh flag-probe evidence downgrades a tied current-source flag hypothesis
   without erasing the target fingerprint.
8. Unit tests, `npm test`, `make check`, and the exact function finalizer pass.
