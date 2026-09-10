# Matching reconstruction — inferred call signatures (undecompiled callees)

**Status: proposed. Successor to
`plans/matching-reconstruction-call-signatures.md` (Gap 1), which resolved
call signatures from *evidence* (matched definition, SDK prototype, ABI
witness). This plan handles the calls that plan leaves as `unknown`: a callee
that is named but not yet decompiled and not an SDK entry point, so no source
of truth for its arity or return exists. Read the Gap 1 plan and its
"Implementation record" first.**

## The problem, in one paragraph

Gap 1 taught the engine to look up a callee's signature. When it can
(`resolveSignature` returns a `CalleeSignature`), the call is trimmed to the
right arity and everything works. When it cannot, `resolveSignatures` does
`if ("unknown" in signature) continue` — the call keeps all four captured
argument registers, three of them the caller's untouched entry garbage, and
the constructor fails with `no parameter plan could express the relation's
values`. About **502 functions** are still stuck this way. Many of them call a
function that simply has not been decompiled yet (its name resolves — e.g.
`func_800XXXXX` — but its signature is unknown). The callee's own source will
never exist in time to unblock the caller if we wait for it.

The insight that unblocks them: **the engine does not need to *know* the
callee's signature — the byte oracle is the judge.** The number of arguments a
call passes is between 0 and 4, and the callee either returns a used value or
does not. That is a tiny space. The engine can *enumerate* the plausible
signatures for an unknown callee, build one candidate per hypothesis, and keep
whichever one the oracle confirms byte-for-byte. A wrong arity can only fail to
match; it can never produce a false positive. Evidence from the callee's own
machine code and the caller's own argument setup narrows the enumeration so it
stays cheap.

This is the same "propose within a bounded space, verify with the oracle"
pattern the whole engine already runs on — it is not new machinery, it is one
more construction axis.

## Ground rules

Follow the ground rules and per-deliverable protocol in
`plans/matching-reconstruction-model-completion.md` verbatim. The load-bearing
ones here:

- **The byte oracle is the only judge.** An enumerated signature is a
  hypothesis; every candidate still passes through `compareFunction`. A wrong
  arity that happens to compile is caught there. Never mark a match from
  anything but the oracle.
- **Unsupported beats guessing — but enumerating within a bounded, evidenced
  range is not guessing.** The difference: a guess emits one unverified answer;
  an enumeration emits every candidate in a finite range and lets the oracle
  choose. Keep the range finite and evidence-bounded; when it cannot be
  bounded, report honestly rather than enumerate an unbounded space.
- **Every candidate must declare its callee** with the *hypothesized*
  prototype for that candidate — an undeclared callee is C89 implicit-int and
  reshapes allocation. Reuse the `detectImplicitDeclarations` guard already in
  `engine.ts`.
- **Determinism.** The enumeration order must be fixed (ascending arity, then
  returns-value false→true). Same inputs → same winner.
- **Keep the gates green** after each change: the reconstruction unit suite and
  `benchmarkReconstruction.ts --set development` (exit 0).

### Known traps

- **"Passes its own `a1` through" and "`a1` is leftover garbage" look
  identical from the caller.** Both appear as the entry value `@a1`. Do NOT
  try to decide which deterministically — that ambiguity is *exactly why* you
  enumerate and let the oracle pick, instead of committing to one arity.
- **The caller ignoring `$v0` does not prove the callee is void.** The callee
  may return a value the caller discards. So "caller reads `$v0` after the
  call" proves returns-value; "caller ignores it" means *unknown* → enumerate
  both. Only positive evidence narrows.
- **Combinatorial blowup.** A function with three unknown calls, each with a
  5-wide arity range, is 5³ = 125 candidates before the other axes multiply in.
  Bound it: cap the per-call arity range using evidence (below), and cap the
  total candidate product; when still over budget, tighten to the single
  best-evidence hypothesis and, if that still is not enough, return
  `budget-exhausted` honestly rather than explode.
- **A named-but-unresolved callee is still a real symbol.** `func_800XXXXX`
  resolves through the symbol table even when undecompiled; it can be declared.
  An *indirect* call (no name) cannot — those stay refused (Gap 1 S1).

## Deliverables

Do them in order; do not start one until the previous one's acceptance passes.

### T0 — Reproduce and scope

1. Run `--census` and split the remaining "no parameter plan" functions into:
   (a) **has a call to a named, direct, undecompiled, non-SDK callee** — the
   target of this plan; (b) **has an indirect call** — out of scope, stays
   refused; (c) **has no call at all** — a different parameter-typing failure,
   out of scope. Write a small one-off analysis (decode each function, look for
   `CallEffect`s whose `resolveSignature` is `unknown` and whose `calleeName`
   is a real symbol) and report the three counts.
2. Pick a probe set: 3–4 of the smallest category-(a) functions. Record their
   callees.

**Accept:** the three counts, the probe set, and confirmation that each probe's
blocker is an unknown-signature call to a named callee (not indirect, not
no-call).

### T1 — Evidence for the arity range and the return

**Files:** extend `callee-signature.ts` (a new export beside `resolveSignature`).

Add `inferSignatureRange(name, address, container, callSite): { arityLo: number; arityHi: number; returns: "yes" | "no" | "unknown" }`.
Draw only on bytes — no decompilation required:

1. **Callee's own machine code** (strengthen the existing tier-3 `targetWitness`
   use): the argument registers the callee reads before writing prove a
   *lower* bound on arity (`arityLo`). Whether the callee writes `$v0` before a
   return is a returns-value signal.
2. **Caller's argument setup at the call site** (`callSite` carries the caller's
   pre-call register state, already available in the executor): the highest
   argument register index the caller wrote a *non-passthrough* value into
   gives an *upper* hint (`arityHi`); default `arityHi` to 4 when unclear.
3. **Caller's use of `$v0`**: if the caller reads the call's result (a
   `call-result` for this `seq` flows into the caller's return value or a later
   expression — detectable in the recovered relation), `returns = "yes"`. If
   the caller never reads it, `returns = "unknown"` (NOT "no").
4. Clamp `arityLo ≤ arityHi ≤ 4`. When evidence is silent, the safe default
   range is `[0, maxArgRegisterTheCallerTouched]`.

**Accept:** unit tests: a callee that reads `a0,a1` before writing yields
`arityLo >= 2`; a call whose result flows into the caller's return yields
`returns: "yes"`; a call whose result is ignored yields `returns: "unknown"`.

### T2 — The enumeration axis

**Files:** `effect-construct.ts` (the call-signature resolution and the
construction axes), `engine.ts` (pass the range inference in).

1. In `resolveCallSignatures`, when `resolveSignature` is `unknown` but the
   callee is named and direct, replace the `continue` (drop) with the range
   from T1: record `{ arityLo, arityHi, returns }` for that call instead of a
   single fixed arity.
2. Add a **signature-enumeration axis** to the constructor, exactly like the
   existing guarded axes (`exitStyle`, `pairStyle`, …): the cartesian product,
   per unknown call, of `arity ∈ [arityLo, arityHi]` and
   `returnsUsed ∈ (returns === "yes" ? {true} : returns === "no" ? {false} : {false, true})`.
   Each point fixes that call's arity (drives `trimArgs`) and whether its
   result is bound.
3. **Bound the product.** Cap the number of enumerated signature combinations
   (e.g. 24). When the product would exceed the cap, first narrow each range to
   its best single evidence hypothesis (`arityLo`, and `returns` when known);
   if still over, evaluate the capped subset and settle
   `budget-exhausted` rather than dropping candidates silently — log what was
   dropped (`no silent caps`).
4. Every enumerated candidate declares its callee with *that candidate's*
   hypothesized prototype (extend `calleeDeclarations` to take the per-candidate
   arity/returns), and the existing implicit-declaration guard in `engine.ts`
   still runs.

**Accept:** each T0 probe now reconstructs — at minimum to a compiling,
correctly-declared candidate for each hypothesis (state `domain-exhausted` or
`exact-candidate`, never "no parameter plan"). Where a hypothesis is right, the
oracle returns `match`. Dev gate green; no regression.

### T3 — Integrate, measure, freeze

1. Route T1/T2 through `engine.ts`; update `censusCategory` in
   `benchmarkReconstruction.ts` so enumerated-call outcomes are no longer
   bucketed as "no parameter plan".
2. Update the supported-classes sentence in the `psx_reconstruct_function`
   entry of the Pi tool registration table (`diagnostics.ts` under
   `.pi/extensions/psx-decomp/tools/`) and in
   `notes/tools-directory-structure.md`.
3. Run `--census`; report how many of the ~502 "no parameter plan" functions
   became `domain-exhausted` or `exact-candidate`. Publish the number
   honestly, and report the median/tail candidate count per function (the
   enumeration cost).
4. When the first inferred-signature function reconstructs byte-exact, add it to
   `DEVELOPMENT_SET`, run `--freeze-manifest`, and re-run the gate.
5. Finish with `npm test` and `make check-all`.

**Accept:** the "no parameter plan" bucket shrinks measurably beyond what Gap 1
achieved; dev gate green; `make check-all` byte-identical; no regression.

## Non-goals (do not attempt in v1)

- **Indirect calls** (`jalr` on a computed value) — still refused; there is no
  name to declare and no bounded arity range.
- **Argument *types* beyond the current default.** The enumeration is over
  *arity* and *whether the result is used*, not full parameter types — the
  argument expressions keep the caller-side typing they already have. Recovering
  a callee's precise parameter types without its source is separate, harder
  work.
- **Varargs, struct-by-value, and float/soft-float arguments** — a callee whose
  ABI evidence points to any of these stays honestly unresolved.
- **Turning every enumerated call into a byte-exact match.** Modelling the call
  (a bounded, oracle-checked set of signature hypotheses, correctly declared) is
  this plan's job. A `domain-exhausted` outcome — the right relation, the call
  enumerated, no hypothesis matching yet — is a success for this deliverable and
  a handoff to constructor refinement.

## Complementary (optional, separate from the engine work)

### T4 — Decomp-order guidance (call-graph leverage)

A diagnostic, not an engine capability: rank undecompiled callees by how many
currently-blocked callers each would unblock if it were decompiled (turning its
`unknown` signature into evidenced tier-1 truth). This turns the callee
dependency into a prioritized work order — "decompile these N helpers next and
these M callers become reconstructable." Build on the existing call graph
(`callGraph.ts`). Keep it a report; it drives human/agent scheduling, it does
not change the engine. Only build this if the T0–T3 measurement shows a long
tail of unknown callees concentrated in a few popular functions.

## Reuse map

| Existing component | Role here |
|---|---|
| `callee-signature.ts` (`resolveSignature`, `targetWitness` use) | Extend with `inferSignatureRange` (T1); the evidenced tiers stay the exact path. |
| `tools/agent/calleeTruth.ts` `targetWitness` | The callee's own read-before-write argument registers and return proof (T1 tier). |
| `effect-construct.ts` axis machinery | The enumeration axis is one more axis alongside the existing guarded ones (T2). |
| `effect-construct.ts` `trimArgs`, `calleeDeclarations` | Driven by the enumerated arity instead of a single resolved one (T2/T3). |
| `engine.ts` `detectImplicitDeclarations` guard | Unchanged — still rejects any candidate whose (hypothesized) callee declaration is missing. |
| `tools/lib/symbolIndex.ts` | Resolve the undecompiled callee's name so it can be declared (already used in Gap 1 S1). |
| `tools/agent/callGraph.ts` | The optional T4 decomp-order report. |
