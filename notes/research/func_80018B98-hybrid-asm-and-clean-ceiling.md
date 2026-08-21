# func_80018B98 — clean-C ceiling and hybrid-asm non-transferability

Status: reparked 2026-08-21. Clean-C best 257/292 (87.7%), key `[0,2,3,9]`.
Owner of the residual: greg (register allocation). Human decision pending
(see notes/human-needed-approvals/func_80018B98.md).

## Classification (this is the whole story)

Semantics are correct: 294 = 294 instructions against the target, every
premise audited (callee_truth 0 contradicted; matched wrappers; frame map +
4-byte BLKmode `TextFlag` arg8; `-fno-gcse` dominant). The residual is a
register topology, in three coupled pieces:

1. Inner-loop rotation: `tok` should live in `$a1` (via a surviving
   `move a1, tok` copy the target emits at 0x80018CFC), `masked` in `$a0`,
   `remasked` in `$v1`. The candidate emits `$v1` / `$a2` / `$a0`. `.greg`
   shows `tok` already *prefers* `$a1` (preferences 3 7) — local allocation
   state just blocks it.
2. s5/s6 swap: the `flag` web (`D_8005E446-7 < 3`) should be `$s5`; the arg5
   scale web should be `$s6`. Allocator counterfactual gives the exact bound:
   flag (refs 3, live 190, priority 157) must outrank arg5 (refs 4, live 460,
   priority 173) → flag needs refs≥4 or live≤172 — both structurally pinned
   (2 uses at loop depths 1+2; live pinned by emission).
3. Blocks 20/21 (0xFFFF→done): target keeps a shared return-set block
   (`.L80018FF4` `addu v0,s1`) that the flag-branch and the loop-exit both
   enter; the candidate's flag-branch skips it (and on that path even computes
   v0=2 instead of arg1 — harmless, all six callers discard the return).

## Why the spelling family is closed

- Two exhaustive source-space searches (`exhausted-no-exact`) from weaker
  seeds (201/271 and 207/271 class states).
- Most clean-C variations compile to identical words (CSE/scheduler fold
  guard inversions, web splits, store reorders back together) or strictly
  worse (volatile, type changes, inline-flag → pop 376).
- The current-source closure is derived at 2,727,936 candidates / 148 web
  partitions but has NOT been exhaustively evaluated (~1.8h at 23 jobs) —
  this is the one honest remaining clean-C channel.

## The hybrid-window exception was granted, then measured non-transferable

The func_80019070-style exception (`register-asm` / `embedded-asm`) was
granted (2026-08-21). Nine distinct pin/window shapes were compiled and
scored; every one regresses the baseline:

| # | shape | score |
|---|---|---|
| h1 | pin all 5 webs (flag/masked/tok/remasked + scl→s6 via copy) | 229/286 pop 375 |
| h2 | flag→$21 (s5) only | 246/290 pop 375 cfg 1 |
| h3 | masked→$4 (a0) only | 259/291: b17 alloc 4→2, b54 →6 |
| h4 | tok→$5 (a1) only | 252/292 alloc →15 |
| h5 | scale→$22 (s6) via pinned copy | 248/288 |
| h6 | masked→a0 + tok→a1 | 261/291: clears b3/11/17/42, breaks b52/54/56 |
| h7 | all 8 parameter homes | 206/268 pop 16 |
| h8 | mask+tok + split ydelta→$2 | 237/283 pop 95 cfg 2 |
| h9 | masked→a0 + split ydelta (unpinned) | 239/285 pop 95 |

Mechanism why this fails (unlike func_80019070): GCC 2.95 resolves every
fixed-register constraint (`register T v __asm__("$N")`) by global
spill/shuffle. Each pin fixes a local node and cascades into distant blocks
(a pin that clears block 17 moves the damage to the mult tail 52/54/56).
The `masked`→y-delta reuse (one variable for the inner mask AND the y
product) is load-bearing: splitting it destroys the whole func_80019070
call-arg tail (blocks 54–61), consistent with the earlier parked separate
xdelta/ydelta attempt scoring worse. func_80019070's hybrid succeeded
because its divergence was a single isolated prologue window that could be
hand-written; func_80018B98's divergence is the function's whole
register topology inside a nested loop with many calls.

## Next steps (see parking note for the decision menu)

1. Exhaust the current-source closure (148 web partitions — strictly more
   than the 26-partition closure the ancestor seeds exhausted). If it finds
   an exact candidate, the clean model beats every asm option.
2. If empty, full-asm INCLUDE_ASM body is the only guaranteed byte-exact
   route and needs an assembly-stub allowlist entry (a stronger category
   than the window hybrid granted).
3. Otherwise hold clean 257/292.

Do not re-attempt bare register-asm pins without new evidence; the nine
counterexamples are in the experiment ledger (keys v1:h1..v3:h9 under
build/experimentLedger/func_80018B98.jsonl).
