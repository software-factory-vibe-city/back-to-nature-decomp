# Plan: CAPTURE_PREV_RET site migration and prep-stage injection

**Status: proposed 2026-10-06.** Companion to
`nested-function-detection.md` (which owns the detectors and census; this
plan consumes them) and `macro-identity-recognition.md` (whose tiler output
feeds the same injection seam). Background:
`notes/research/func_8001EAE4-v0-channel-delay-slot-fossil.md`,
`notes/research/func_8001E9F8.md`.

## Decision

`CAPTURE_PREV_RET` (`include/common.h:41`) is the one macro for the
entry-`$2` construct, at both scopes. No new names. The expansion is
identical either way (`register s32 name asm("$2")`), and the placement
itself discriminates the two byte fingerprints:

- **block scope** at function top — the dead-spill form (value received and
  spilled to a never-read slot);
- **file scope** before the function — the save/forward form (stores kept,
  `$v0` reserved for the rest of the TU, re-installs before sibling calls).

## Purpose

The entry-`$2` construct is proven by bytes, has a fixed fingerprint and a
fixed reconstruction recipe — and still costs a park-and-approve cycle at
nearly every new site, because discovery is pull-only, the one automatic
detector's output is discarded in prep, and the policy gate recognizes only
the block-scope macro text while the file-scope form needs an individual
allowlist grant.

This plan closes the loop: migrate the two raw file-scope sites onto the
macro (verified), and add prep-stage **injection** — detect the fingerprint
statically and write the construct into the candidate before any agent
iterates.

## Current state (verified)

- 10 callee sites already use `CAPTURE_PREV_RET` (block scope): exe
  `func_8001E878`; ovl_11 `800CFAD0`, `800D1CD0`, `800DD45C`, `800F5108`,
  `8010780C`, `8011D438`; ovl_19 `800B8E88`, `800BB08C`; ovl_30
  `8012F030`. These need no source change.
- 2 callee sites spell the construct raw at file scope
  (`func_8001E9F8`, `ovl_11_func_800D0600`), each carrying an individual
  `sourcePolicy.allowlist` grant.
- 2 caller sites use the block-scope `auto` declaration + asm label
  (`func_8001EAE4`, `ovl_11_func_800F5160`); gate-clean; stays a documented
  idiom (C89 has no variadic macros, so a prototype cannot pass as one
  macro argument).
- `scanReadBeforeDef.ts` detects the callee fingerprint and carries routing
  guidance — but only in human-readable mode; prep invokes the scanner
  with `--json` (no guidance fields) and checks nothing but the exit code
  (`prepareFunction.ts:525`).
- Two family members rest on callee-side evidence alone (`8011D438`,
  `8012F030`) — no caller fingerprint found yet; the census owes them a
  verdict.

## Non-goals

- Folding families into true nested definitions in shared TUs (the stated
  end state; a later project decision — `grep -rl CAPTURE_PREV_RET src/`
  is deliberately the complete fold-in inventory).
- Injection for non-deterministic residuals (web-partition class) — no
  fixed recipe; that stays with `web-partition-fingerprinting.md`.

## The AST rule (applies to every phase that touches C)

All source analysis and rewriting goes through the codebase's established
AST layer — the tree-sitter-based `analyzeCSource` in
`tools/agent/cSourceGuard.ts` (the same parser prep's staging already
trusts), extended as needed. No regex-over-source anywhere: this plan's
edits (insert at block top, insert at file scope before a specific
function definition, recognize an existing macro invocation, verify
idempotency) are exactly the class regex gets wrong.

## Phases

### Phase 1 — migrate the two raw sites, verified

AST-driven rewrite of `func_8001E9F8.c` and `ovl_11_func_800D0600.c`: the
raw file-scope `register s32 x asm("$2");` becomes a file-scope
`CAPTURE_PREV_RET(x);`. Expansion is textually identical, so both functions
must be byte-neutral — confirm with `diffFunc` per function (VERDICT MATCH)
and the full `make check` gate, not by assumption. Delete the two
`sourcePolicy.allowlist` entries in the same change that teaches the gate
the file-scope form (Phase 4), so the tree never holds an unrecognized
construct.

Gate: 2 MATCH verdicts, `make check` green, allowlist two entries smaller.

### Phase 2 — detector completion (consumes nested-function-detection.md)

- Extend `scanReadBeforeDef.ts` to discriminate the two callee sub-forms:
  dead-spill (store to a never-reloaded slot) vs save/forward
  (`addu $sX,$v0` at entry + `move $v0,$sX` re-installs before jals), and
  emit the sub-form in both output modes.
- Land the caller-side detector and pairing census from the companion
  plan; every callee site gets a verdict: `paired` / `callee-only` /
  `undetermined`. `8011D438` and `8012F030` are the two open rulings.

Gate: census covers all 12 callees + 2 callers; zero false negatives on
the proven family; the known main-exe false positives (ordinary
`$v0 = $sp+K` scratch uses) rejected by rule, not by exception.

### Phase 3 — prep-stage injection

The seam already exists: prep runs the scanner on every function
(`prepareFunction.ts:525`) and discards the result. Replace that wire:

1. Add the sub-form and guidance fields to the scanner's `--json` output
   (today they exist only in human-readable mode) and parse the result in
   prep.
2. On a finding, transform the prep candidate **via the AST layer**:
   - dead-spill form: insert `CAPTURE_PREV_RET(phantom);` at block top
     plus the spill statement, slot derived from the target's
     `sw $v0, N($sp)`;
   - save/forward form: insert `CAPTURE_PREV_RET(phantom);` at file scope
     before the function, plus placeholder re-install statements keyed to
     the target's call sites, comment-marked for the matching tier to
     position — scaffold, not finished source;
   - caller side (census-paired only): insert the block-scope `auto`
     declaration with the asm label, prototype taken from prep's existing
     context, and rewrite the call expression to the local name.
3. Every injection carries a provenance comment naming the fingerprint,
   the byte address, and the census row.
4. Injection rules: byte-proof only, never plausibility — entry-`$2`
   liveness injects unconditionally (it is already in the "compiled C
   cannot produce this" class); sub-form and caller injections require the
   discriminating fingerprint or a census pairing; anything ambiguous
   becomes a surfaced finding, not an edit. The oracle remains the
   authority: if the injected construct does not explain the target words
   it claims, prep reports that instead of staging.
5. Idempotency: the injector recognizes (via AST) an existing
   `CAPTURE_PREV_RET` use at either scope and does not double-insert.

Gate: a prep run over the known family's stubs (as they were before
matching) injects the correct form in every case; a prep run over matched
clean functions injects nothing; end-to-end validation target
`ovl_11_func_800D062C` — census pairing → caller injection → match — the
first fully machine-routed closure of a family pair.

### Phase 4 — gate and policy wiring

- The source-policy scanner recognizes `CAPTURE_PREV_RET` invocations at
  **either scope** (AST-recognized, not text-matched) as the approved
  classification for this construct — recorded under the macro's standing
  approval rather than per-function workaround grants.
- A raw `register ... asm("$2")` declaration gets a refusal message that
  names the macro and the census, so an agent that independently derives
  the semantics is routed, not parked.
- Optional strictness (owner's call): warn when a use has no corresponding
  census row — the guard against the macro drifting into a generic
  allocation lever.

Gate: policy unit tests — macro use passes at both scopes, raw declaration
refuses with the routing message, census-less use warns.

### Phase 5 — generalization hook (brief)

The injector framework (scanner finding → AST edit → provenance comment →
oracle gate) is construct-agnostic. Next candidates, in order of recipe
determinism: `CAPTURE_RA` (the debug-hook note's playbook is already
written as an algorithm), `SCRATCH_STACK_BEGIN/END` pairs (three new
ovl_11 sites are already census-known), and the GTE tiler's emitted
statements (macro-identity plan Phase 3). Each lands as its own small
injector against the same seam; none blocks Phases 1–4.

## Risks

- **A wrong scaffold is worse than none** — the matching tier will trust
  it. The byte-proof-only rule and the oracle gate are the mitigations;
  keep them hard.
- The save/forward form's re-installs interact with body semantics;
  placeholder injection must be visibly incomplete (comment-marked) so the
  agent positions rather than assumes.
- `8011D438` / `8012F030` may turn out not to be chain sites; their
  provenance comments must say `callee-only` until the census rules, and a
  negative ruling reopens their interpretation rather than silently
  standing.
