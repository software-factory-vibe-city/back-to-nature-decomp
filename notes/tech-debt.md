# Tech debt: functions that are assembly, not C — CLOSED

**Closed 2026-08-09.** The class this note tracked — *ordinary compiled
functions whose C body is a raw `__asm__` block* — is **empty**. Twenty-six
functions were re-decompiled to clean C89 and byte-verified. The two remaining
whole-body assembly files (`func_8001DFD4`, `func_80038674`) are GTE
coprocessor code that was handwritten in the original game and is correctly
assembly.

This file is a tombstone. Everything it accumulated has been distilled into the
places that get read during actual work; nothing below duplicates that content.

## Where the knowledge went

| What | Where |
|---|---|
| Campaign record, per-function retirement ledger with the mechanism that matched each one, and the campaign's lessons | `notes/retros/2026-08-09-asm-body-debt-paydown-retro.md` |
| Proving a symbol is a function before decompiling it (decisive evidence, detector defects, open boundary artifacts) | `notes/research/symbol-boundary-verification.md` |
| Declaration shape vs. address form, and why "proven unreachable" was conditional | `notes/research/func_8001205C-declaration-shape-vs-address-form.md` |
| Predicate re-derivation, and parameter reuse as a statement about web ownership | `notes/research/func_8001E78C-predicate-inversion-and-parameter-webs.md` |
| The stale linker script and the search that reported an empty domain while holding the answer | `notes/research/tooling-false-verdicts.md` |
| The one real codegen case in the campaign (shared multi-block web) | `notes/retros/2026-08-28-func_80017E34-retro.md` and `notes/research/func_80017E34-shared-web-global-allocno.md` |
| Doctrine that now applies to every function, not just this class | `prompts/c-style-guide.md` §1 (predicate), §4 (negative results), §5 (argument webs), §7 (declaration vs. address form), §10 (audit the facts outside the function) |
| Pre-flight boundary check, predicate-first triage, exemption hygiene | `.pi/skills/psx-decompile-function/SKILL.md` |

## What is still open, and where it is tracked

Nothing in this class. The **different** debt classes — register pins,
scheduling barriers, and the allowlist that under-describes them in both
directions — live in `notes/retros/2026-08-09-asm-folding-root-cause-retro.md`, whose
inventory was re-measured on the same date.

`func_8001D2D8` is **not** retired and never appeared in the retirement ledger.
It left the raw-asm class on 2026-08-08 without reaching clean C: its body is C
with one pinned temporary added under the owner's explicit authorization. The
allowlist entry records that authorization, not a finding that assembly is
correct for it. 26 of its 28 words come out of clean C; the residual is the
entry-block sign extension. It is a register-pin entry, tracked in the
next-steps note.

## The one rule this note earned

Re-generate an inventory before acting on it. Every hand-maintained count in
this file went stale, in both directions, and one of them ("20 files, 18 debt")
was wrong on the day it was written. Counts belong to a scan, not to a note.
