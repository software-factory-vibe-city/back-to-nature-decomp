# Matching reconstruction — inferred call signatures (undecompiled callees)

**Status: implemented.** Follows
`plans/matching-reconstruction-call-signatures.md` (Gap 1), which resolved
call signatures from *evidence* (matched definition, SDK prototype, ABI
witness). This plan handles the calls that plan leaves as `unknown`: a callee
that is named but not yet decompiled and not an SDK entry point, so no source
of truth for its arity or return exists.

## Implementation record

### T0 — Reproduce and scope ✅

Ran a census analysis that split the 62 remaining "no parameter plan" functions
into three categories:
- **(a) Named direct undecompiled callee** — 57 functions. The target of this plan.
- **(b) Indirect call** — 0 functions.
- **(c) No call at all** — 5 functions (a separate parameter-typing failure).

Probe set chosen: `ovl_21_func_800BA670` (40B), `ovl_11_func_800E54F8` (44B),
`ovl_11_func_8011CEE0` (48B), `ovl_11_func_8011CF10` (48B),
`ovl_19_func_800BA628` (52B).

### T1 — Evidence for the arity range and the return ✅

Added `inferSignatureRange()` in `callee-signature.ts`, drawing on three
sources of byte-level evidence:

1. **Callee's own machine code** (via `targetWitness`): read-before-write
   argument registers establish `arityLo`. Whether the callee writes `$v0`
   before return signals returns-value.
2. **Caller's argument setup at the call site**: the highest argument register
   the caller wrote a *non-passthrough* value into gives `arityHi`. When all
   args are passthrough (bare entry registers), arityHi defaults to 0.
3. **Caller's use of `$v0`**: if the call's result atom appears in a later
   expression, `returns = "yes"`. If not consumed, `returns = "unknown"`
   (never "no" — the caller may discard a returned value).

Returns `{ arityLo, arityHi, returns }` clamped to `[0, 4]`.

Also fixed **cross-container resolution**: `matchedDefinition()` previously
only searched the calling container's header. An overlay calling an exe
function got `unknown` even when the callee was matched in `include/functions.h`.
Now falls back to the exe header for non-exe containers.

**Tests:** 6 new unit tests covering non-passthrough arity hints, consumed vs.
unconsumed return signals, all-entry-args defaults, and multi-arg arityHi.
Plus one cross-container resolution test.

### T2 — The enumeration axis ✅

The core change: replace the `continue` for unknown signatures in
`resolveCallSignatures()` with recording inferred ranges, then enumerate the
cartesian product as an additional constructor axis.

**`resolveCallSignatures()`** now returns `{ resolved, unknownRanges }` instead
of a single resolved map. For each named, direct, undecompiled callee whose
signature is unknown, it records `{ arityLo, arityHi, returns }` via
`inferSignatureRange`.

**`buildInferredCombinations()`** (new) builds the cartesian product of
`arity ∈ [arityLo, arityHi]` and `returnsUsed ∈ {"yes"→[true], "no"→[false],
"unknown"→[false,true]}` per unknown call. Capped at `MAX_INFERRED_COMBOS = 24`.

- Refines returns: if a call's result is consumed and returns was "unknown",
  it is promoted to "yes" (the caller cannot read garbage).
- When the unbounded product exceeds the cap, each range is narrowed to its
  best single-evidence hypothesis (`arityLo`, and returns when known).
- Order is fixed (ascending arity, then false→true for returns).

**`constructEffectCandidates()`** now wraps its plan loop in a combo loop over
`sigCombos`. Each combo produces a merged `callCaps` (resolved + inferred
signatures). The void-wrapper check, consumed-result check, arg trimming, and
callee declaration all operate per-combo, so every candidate compiles under its
own hypothesis and the byte oracle picks the winner.

Also fixed: call argument atoms were not being collected for the storage map,
causing "no accessor" errors. Now `collectAtoms` runs on call args too.

### T3 — Integrate, measure, freeze ✅

1. Added the first inferred-signature winner to `DEVELOPMENT_SET`:
   `ovl_21_func_800BA670` (exact-candidate, callee `ovl_21_func_800BAEEC`
   resolved via ABI tier 3 with arity=1, void-wrapper detection).
2. Regenerated manifest → 17 development entries, 20 challenge, 99 held-out.
3. Updated the tool description in `.pi/extensions/psx-decomp/tools/diagnostics.ts`
   and `notes/tools-directory-structure.md`.
4. Run `npm test` — 747 tests pass. `make check-all` — all 13 overlay
   containers + PS-X EXE byte-identical.
5. Development gate: 14 exact-candidate, 1 domain-exhausted, 2
   unsupported-target. No regressions.

### Files changed

| File | Change |
|---|---|
| **`callee-signature.ts`** | Added `inferSignatureRange()` (T1); fixed cross-container resolution fallback; added `InferredSignatureRange` export |
| **`callee-signature.test.ts`** | 7 new tests: cross-container resolution, inferSignatureRange with all evidence sources |
| **`effect-construct.ts`** | `resolveCallSignatures` returns `{resolved, unknownRanges}`; added `buildInferredCombinations()` (T2); restructured `constructEffectCandidates` with combo loop; fixed call-arg atom collection |
| **`benchmarkReconstruction.ts`** | Added `ovl_21_func_800BA670` to `DEVELOPMENT_SET` |
| **`diagnostics.ts`** | Updated tool description |
| **`tools-directory-structure.md`** | Updated supported-classes sentence |
| **`benchmark-manifest.json`** | Regenerated with 17 development entries |

### Non-goals (not attempted in v1)

- **Indirect calls** — still refused; no name to declare and no bounded arity range.
- **Argument types beyond the default** — the enumeration is over arity and
  return usage only; argument types stay `s32`/pointer-derived.
- **Varargs, struct-by-value, float/soft-float** — refused by the signature
  oracle when evidence points to them; enumeration never reaches them.