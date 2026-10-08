# Plan: project-wide nested-function callsite detection

**Status: proposed 2026-10-06.** Written from the asm-exception survey of the
same date. A prototype binary scan (described under "Census seed") already ran
read-only and its results are tabulated below; the plan turns it into standing
TypeScript tooling with both detector halves, pairing, and triage routing.

## Purpose

The original source used GNU C nested functions — functions defined inside a
parent, a GCC extension the verified toolchain (GCC 2.95.2-psx) supports.
Every call to a nested function passes a **static chain** (a pointer into the
parent's frame) in `$2`/`$v0` (`STATIC_CHAIN_REGNUM`, verified in the
vendored mips.h; `lookup_static_chain` passes `virtual_stack_vars_rtx`,
`$sp+16` in a 0x18-byte frame). The construct leaves unmistakable byte
fingerprints on both sides of the call, and misreading them costs real time:
the hypothesis was wrongly rejected once (2026-08-01) before being proven
(2026-08-14, `notes/research/func_8001E9F8.md` correction header), and new
callee sites still trip the policy scanner as `register-asm` and burn an
approval cycle each (`ovl_11_func_800D0600` re-derived the idiom with a bare
file-scope pin instead of the documented macro).

Goal: scan the whole target once, enumerate every caller and callee site,
pair them into families, and push the finding — with the exact reconstruction
recipe — at the agent *before* source authoring.

## The fingerprints

**Caller side.** `addiu $v0, $sp, K` placed where the value is dead at the
call boundary — `$v0` has no ABI meaning at a call (arguments travel in
`$a0–$a3`; the call clobbers `$v0`), so a set that nothing consumes before a
`jal` is chain setup. Three placements observed:

1. in the `jal` delay slot (`func_8001EAE4` before its E9F8 calls);
2. the word before a `jal`, with the delay slot not consuming `$v0`;
3. in a conditional-branch delay slot whose fall-through reaches a `jal`
   without `$v0` being read or redefined (`func_8001EAE4` before its E878
   calls).

Corroboration heuristic: observed `K = frame_size − 8` in FP-less frames
(EAE4: 0x18-byte frame, `K = 16`). Treat as supporting signal, and confirm
the exact rule against the vendored GCC's `virtual_stack_vars_rtx` layout
before relying on it to reject sites.

**Callee side.** A read of hard `$2` at entry, before any definition. Two
sub-forms with *different* reconstruction recipes:

- **Dead spill**: `sw $v0, N($sp)` to a slot never reloaded (GCC materializes
  the incoming chain into the frame whether or not the body uses it) →
  recipe: `CAPTURE_PREV_RET(name)` (`include/common.h:41`), block-scope.
- **Save/forward**: `addu $sX, $v0, $zero` at entry plus `move $v0, $sX`
  re-installs before calls to sibling functions — a nested function
  forwarding the parent's chain to a nested sibling (`func_8001E9F8`) →
  recipe: file-scope `register s32 name asm("$2")` (the common.h comment
  documents picking between the forms by fingerprint). Also marks the callee
  as itself calling nested siblings.

Allocation shadow (corroboration): `$v0` absent from the callee's scratch
webs — it is live at entry, which rotates the whole `v0/v1/a0–a3/t*`
assignment; the §9.1(b) argument in
`notes/research/func_8001E878-dead-spill-allocation.md` is why no clean-C
spelling reproduces it.

**Caller-side reconstruction** (already gate-clean): a block-scope
`auto s32 f(...) __asm__("real_symbol");` declaration — GCC's documented
nested-function forward declaration — makes cc1 emit the chain setup while
the asm label binds the call to the separately-placed symbol. It emits no
instruction and the clean-source gate already distinguishes it from embedded
asm (`ovl_11_func_800F5160` matched this way with no allowlist entry).

## What exists today

- `psx_scan_read_before_def` — the callee-side scan, run per function on
  demand (it certified EAE4 itself clean while its callees carry the read).
- The recipes: `CAPTURE_PREV_RET` (common.h:41, with form-selection
  guidance), the file-scope register-global form (`src/func_8001E9F8.c`),
  the caller `auto` declaration (`src/overlays/ovl_11/ovl_11_func_800F5160.c`,
  `src/func_8001EAE4.c`).
- No caller-side detector, no project-wide census, no pairing, no triage
  push. Each new site is rediscovered by hand.

## Design

### Phase 1 — detector tool

`tools/diagnostics/nestedFunctionScan.ts` (final location per
`notes/tools-directory-structure.md`). General-purpose: input is a binary (or
per-function disassembly) plus a function table and load address; nothing
game-specific.

Caller detector: find `addiu $2, $sp, K` (and the `addu $2, $sp, $zero`
K=0 form) and apply the call-boundary-dead rule above. Required rejection
rules, each a documented false-positive class from the prototype audit:

- the next instruction (including a `jal` delay slot) consumes `$v0` — e.g.
  `move $aN, $v0` (ordinary `&local` argument staging), `sw/sb` with base
  `$v0`, `lwc2 off($v0)` (observed in `func_8001E26C`, `func_8001DCB0`,
  `func_8001DE4C`, `func_8001C37C`, `func_80016C08`, `func_80017F88` — all
  ordinary scratch uses of `$v0`);
- `jalr $v0` is a use, not a chain;
- placement 3 requires the short CFG walk (fall-through to `jal` with no
  intervening `$v0` read/def), not a fixed window.

Callee detector: promote the `psx_scan_read_before_def` logic into the same
census pass, classifying dead-spill vs save/forward and recording the
allocation-shadow corroboration.

Pairing: join caller sites to `jal` targets. Verdict tiers, strictly:

- `confirmed-pair` — both sides fingerprint;
- `caller-candidate` / `callee-candidate` — one side only;
- `undetermined` — signals conflict (report the conflict, no default).

Overlay inputs decode from `extracted/overlays/*.bin` bounded by the splat
yaml text sections (data misdecode is a known trap —
`tools/diagnostics/overlayFlagFingerprint.ts` header).

### Phase 2 — census artifact and triage push

- Emit `build/nestedFunctionCensus.json` plus a readable report: per family,
  the parent, children, chain offsets `K`, sub-form per callee, and the
  recipe for each side.
- Triage push detector (knowledge-retrieval design: push via `triage.ts`
  symptom detectors): when the loop opens any function in the census —
  either side — surface the family, the evidence, and the recipe before
  source authoring. This is the step that stops the approval-cycle burn.
- Reference-sheet pointer: one paragraph in the declarations sheet naming
  the two callee forms and the caller declaration, linking the census.

### Phase 3 — validation campaign

Match `ovl_11_func_800D062C` — the still-unmatched parent of the matched
`800D0600`, with two chain setups in the prototype scan — using only the
census output and the documented recipes. That closes the first full
parent+child pair in ovl_11 and is the end-to-end acceptance gate.

## Census seed (prototype scan, 2026-10-06)

Method: word scan over overlay binaries for `addiu $v0,$sp,K`
(`0x27A2xxxx`) adjacent to a `jal`, or in a conditional-branch delay slot
with a `jal` within 6 words; main exe audited via `build/functions/*.s`.
Known gaps: fixed window (misses chain setups farther from the call), no
delay-slot consumption check (two candidates below may be `&local` staging),
not bounded to text sections.

Main executable:

| Site | Parent | Children | Status |
|---|---|---|---|
| 8 sites, all `$sp+0x10` | `func_8001EAE4` (frame 0x18) | `func_8001E878` (dead spill), `func_8001E9F8` (save/forward) | proven family, all three matched |

Overlays (vram assumes the splat load base; ovl_11/ovl_10/ovl_19 at
0x800B7E20 family bases):

| Hit (vram) | K | Likely parent | Likely child | Status |
|---|---|---|---|---|
| 0x800D064C, 0x800D0660 | 0x10 | `ovl_11_func_800D062C` (unmatched) | `800D0600` (matched, file-scope pin) | known family; Phase-3 target |
| 0x800D1D5C | 0x10 | caller of `800D1CD0` | `800D1CD0` (matched, CAPTURE_PREV_RET) | known family |
| 0x800F51D4 | 0x10 | `800F5160` (matched, auto-decl) | `800F5108` (matched) | fully reconstructed pair |
| 0x800CFB94 | 0x10 | near `800CFAD0` | family per notes | recorded family member |
| 0x800DD51C | 0x10 | near `800DD45C` | family per notes | recorded family member |
| 0x801079C4 | 0x10 | near `8010780C` | family per notes | recorded family member |
| 0x800EE6F8, 0x800EE71C | 0x18, 0x1C | — | — | **new candidates, unverified** (adjacent pair; may be `&local` staging — needs the delay-slot consumption check) |
| 0x8010EF80 | 0x18 | — | — | **new candidate, unverified** |
| ovl_10 0x800B8A30 | 0x18 | — | — | **new candidate, unverified** |
| ovl_19 0x800BB278, 0x800BB2C8 | 0x18 | — | — | consistent with the ovl_19 instances the notes mention; unverified |

Discrepancy to investigate: the notes list `8011D438` as a family member,
but no caller-side hit surfaced near it — either its callers are among the
unmatched stubs, the chain setup sits outside the prototype's window, or the
membership claim is wrong. The Phase-1 CFG-walk detector should settle it.

## What the original source looked like (for the record)

```c
s32 func_8001EAE4(...)                      /* parent */
{
    s32 tri_test(Vtx *a, Vtx *b, Vtx *c)    /* -> func_8001E878 */
    { /* self-contained body */ }

    s32 quad_test(s32 i0, s32 i1, s32 i2, s32 i3)   /* -> func_8001E9F8 */
    {
        if (i0 == i1 || i0 == i2) return tri_test(&V[i2], &V[i1], &V[i3]);
        ...
    }
    /* scan loop calling tri_test/quad_test */
}
```

Everything anomalous in the bytes is automatic codegen for this shape: the
parent seeds `$v0 = &frame` at each call; a sibling-calling child saves and
re-installs the chain; the spills are dead in retail because the bodies never
touch parent locals (or touched only compiled-out debug state). The pattern
recurs across the exe, ovl_11, ovl_19, and ovl_30 — a team-wide style, so
more sites will surface as overlays are worked. The per-function-file
emulations are byte-matching stand-ins imposed by the repo layout; the notes
are explicit they are not claims about the historical source.

## Policy recommendation (owner decision, filed not enforced)

The callee recipes currently classify as `register-asm` (and the scanner
counts a register declaration as both `register-asm` and `embedded-asm`),
so every new site needs an allowlist grant even though the construct is a
recovered original idiom with a documented recipe — while the caller-side
`auto` declaration already passes the gate as an asm label. Consider giving
census-confirmed nested-function sites their own classification (as
`CAPTURE_RA` sites effectively have), so grants record provenance instead of
workaround debt.

## Acceptance

1. Detector finds all proven sites (EAE4 ×8, D062C ×2, D1D5C, F51D4, CFB94,
   DD51C, 1079C4) with zero false negatives.
2. The main-exe false-positive list above is rejected by the refined rules,
   not by special-casing.
3. Each new-candidate row above gets a definitive verdict
   (`confirmed` / rejected with the consuming instruction / `undetermined`
   with the conflict named).
4. `ovl_11_func_800D062C` matches end-to-end from census output alone.
