# func_80014CBC — allocno-priority arithmetic, structural fixes, and the one remaining inversion

**RESOLVED 2026-08-14: matched 117/117 (diffFunc MATCH, full binary OK).**
The winning frame is in `src/func_80014CBC.c`; the closing mechanism list is
`notes/retros/2026-08-14-func_80014CBC-retro.md`. The decisive levers were
outside every domain this note exhausted: BLKmode struct stack parameters
(assign_parms leaves them in memory, deleting the entry-block parameter
loads whose anti-dependences pinned the home store), a late `len = arg2`
web split, and dependence-gating dummy asm operands. The quantitative
models below are historical.

Status 2026-08-13 final (supersedes everything below): best state is
**116/117 words** — every register, value, opcode, and position exact except
ONE instruction: `sw a1,0x44(sp)` emitted at +0x5c instead of +0x54 (two
slots below its original position, after the two argument loads instead of
before them). Under user-authorized hybrid asm the source carries:

1. `__asm__ volatile("")` in the then-arm (arg2 live-length anchor, +2 units
   -> the arg5/arg0/arg2 order lands);
2. the srl/andi pair as two literal asm statements, ordered by a dummy
   sector_start input on the andi, which also armors sector_start's priority
   (4 refs) so the srl-first order cannot cost it $s0;
3. `__asm__("" : "=r"(arg3) : "0"(arg3), "r"(arg3))` — an arg3 passthrough
   whose duplicate input blocks combine from folding the parameter copy into
   the asm; the copy then survives as its own promoted insn and lands at the
   original's early position (this fixed the {move s1,a3} placement).

The last instruction's slot is measured-invariant in BOTH reachable frames:

- Jailed frame (the tree's state): the reload-born spill store is released
  exactly one pick after the pos addu (the $a1 REG_DEAD dependence — the
  addu must remain the last $a1 reader), and stores out-hazard everything
  at their release tie (measured: the store strictly beat a ready load at
  T-12), so its slot [directly above the addu] is uniquely DAG-determined.
- Jailbreak frame (sigma family, peak 111/117): replacing the spill store
  with an asm carrier (`"sw $5,68($sp)"` riding the arg3 passthrough) frees
  it from the death dependence — arg1 then dies in b0, the compiler emits
  no spill, and the recursion reloads via a claimed `"lw %0,68($sp)"` asm.
  The freed store then lands ABOVE the callee-saves: as an asm it has zero
  potential-hazard cost, so the six saves (store-class, max hazard) beat it
  at every tie, and the target position — below the saves, above the loads,
  i.e. picked in the single gap between lw36's launch and the saves'
  release — is unreachable for any zero-cost insn. This frame also trades
  new couplings (count/result priorities, the subu delay-fill blocked by
  the b0 count-anchor, the result-init drift).

Exhausted across both frames: 4 exhaustive statement-order sweeps
(192+28+112+168 coords), shim/carrier/claim position sweeps (~400 variants),
dependence rewiring on every priority-safe web, and barrier-split frames
(the volatile barrier breaks the atomically-coupled entry weave). The
conclusion stands on the machine model itself: the original's post-reload
RTL had the home store outside both release regimes — consistent with an
assign_parms-emitted store from a memory-resident arg1, which GCC 2.95's C
front-end cannot be made to produce for an incoming register parameter
(TREE_ADDRESSABLE is ignored there — measured twice). A future attempt
needs either TU-context that changes assign_parms behavior or acceptance
of the one-slot deviation.

FOURTH CAMPAIGN — THE STORE IS PLACEABLE (breakthrough, measured): the
psi8 frame achieves `sw a1,0x44(sp)` at its EXACT original position +0x54.
The construct: the table-entry address computed by a matching-constraint asm
(`"addu %0,%0,%2" : "=r"(eptr) : "0"(bp), "r"(scaled)` with bp/scaled/pos
register-pinned $3/$2/$4), the arg1 home store as an asm carrier declaring
`"=m"(*(s32 *)(eptr + 36))` — the SAME address the table load reads — which
creates the store->load dependence that releases the store into the gap
below the callee saves; arg1 dies at the b0 add (caller-saved noop copy, no
compiler spill), and the recursion reloads via a claimed `"lw %0,68($sp)"`.
The in-place load pair `pos = *(u32 *)(eptr + 36); pos += arg1;` restores
pos's two-set a0 web. Frame preserved VERBATIM as
`notes/research/func_80014CBC-psi8-resume-frame.c.txt` (measures 93/117).

What remains in psi8 is PURE ALLOCATION (17 rows, zero order defects): the
measured .greg gives [arg2 4refs/60len=1333, arg0 4/68=1176, result
5/106=943, arg5 5/110=909, count 2/22=909-tie] needing
[arg5>1176, arg0=1176, arg2<=1176-tie, count in (943,arg2), result last].
Repair arithmetic: arg5 +2 in-range refs (=1272), arg2 +8 len, count +1 ref
+4 len (=1153). Delivery constraint discovered the hard way: only
passthrough asms with LIVE outputs survive to the ref-counter — empty
volatile asms are deleted before flow (the historic then-arm "anchor" was
inert; the co-added src temp did that work), and dead-output carriers are
flow-deleted. Carrier safety (measured): src (local, free), arg3 (safe to
~12 refs under start's 7272 armor), arg5-self POISONS (demotes its own
load), result/count/start-in-b4 POISON. psi11 (arg3-carried set) = 94/117;
the remaining tuning is ±1-ref/±2-len iteration against fresh .lreg dumps
per step — the same convergence loop that carried the q-frame 97->116.

Third campaign (the alias road, all measured): 2.95's alias analysis treats
frame-slot stores as never-aliasing, so the reload spill cannot be gated
behind any load. But an asm store CAN declare `"=m"(*opaque_ptr)` where the
pointer is an asm output — the table load through that pointer then must
stay below it, which is exactly the store->load dependence the target slot
needs. The mechanism fires (measured: the load ordering obeys it), and an
in-out `"0"` matching constraint on the address add forces the dest==base
register tie structurally. What defeated the compositions is that the base
pointer as a C variable is a fresh web whose allocation rotates the entry
block on every re-roll (a0/t0/v1 across attempts); with pinning it lands but
displaces the argument copies. A future session should start HERE: the
psi3 frame (matching-constraint add + "=m"-gated carrier + the sg_sn0
antidotes) with trace-driven tuning of the bp web only — every other
mechanism in the stack is individually verified.

Validated novel levers from the second campaign (general, reusable):
- an asm input list is a free ref-count lever whose reads survive cse
  (unlike C-level copies, which copy-propagate away pre-flow);
- a duplicate `"0"/"%N"` input on a passthrough blocks combine's
  copy-into-asm merge, keeping a parameter copy as its own schedulable insn
  (this placed `move s1,a3` exactly);
- literal-asm instruction pairs ordered by dummy inputs reproduce
  order-coupled instruction pairs the scheduler otherwise inverts;
- zero-byte asms are real sched2 cycle-consumers; their pick slots follow
  the same hazard comparator as real insns (asm cost ~0, loads/stores
  higher, stores highest).

## Structural mechanisms that produced the current state (all measured)

1. **Else-arm result assignment defeats the reload-CSE fold.** The prior
   state's `move a1,fp` at 0x80014E08 (instead of the target's second
   `addu a1,s1,s2`) is reload_cse forwarding: with `result = arg3 + pos_mod`
   as a straight-line statement, its addu dominates the memmove address addu
   in the insn stream and `reload_cse_regs_1` (reload1.c:8692) rewrites the
   second one. Restructuring to
   `if (arg4 == one) { ...memmove...; result = arg3; } else { result = arg3 + pos_mod; }`
   puts the result addu *after* the memmove block in the stream (reload_cse
   scans forward and only tracks values already seen), so both addus survive.
   Reorg then steals the else-arm's lone addu into the `bne` delay slot and
   retargets the branch — reproducing the target's delay-slot occupant that
   executes redundantly on the fall-through path where $s8 is dead.

2. **`one` born inside the second disjunct.** `one = 1` before the if births
   `li` at the function top (target has it at 0x80014D4C, after the beqz).
   `(one = 1, pos = 1, arg5 == one)` births it block-locally. `one` must be a
   real variable: the constant 1 lives across `jal CdReadSync` in $s3 to the
   `arg4 == one` compare, which cross-block constant CSE cannot do.

3. **`nsectors` split from `sector_end`.** `sector_end -= sector_start`
   merges accumulator and count into one multi-set web (took $s0, wrong).
   A fresh `nsectors = sector_end - sector_start` gives the target's
   `subu s7,v1,s0` fresh-destination shape with the accumulator dying in $v1.

4. **Statement order `pos_mod` before the sector pair** (found by
   `searchResidualSourceSpace`, 1152-coordinate exhaustion): moving
   `pos_mod = pos & 0x7FF` before `sector_end = pos_end >> 11` changed
   sched1's b0 weave so start's live length went 14→13, flipping
   start(2307) above arg3(2222) — starts=$s0/arg3=$s1 both landed, and
   mod/one tie at exactly 1500/1500 where the lower-allocno tie-break
   (mod declared before one) gives mod=$s2, one=$s3. Declaration order is
   load-bearing here.

5. **Duplicated flag stores + post-reload cross-jump.** Writing
   `D_8005E410 = 0; D_8005E2B4 = 0;` into *both* arms of the arg4 if/else
   leaves the bytes unchanged (jump2's cross-jump merges the identical
   register-free tails) but the duplicate exists through flow/sched1/greg,
   stretching only `result`'s live range (everything else is dead in those
   windows): result 781→below count's 769, flipping count=$s7/result=$fp.
   This is a legitimate, byte-invisible, period-plausible source lever on
   allocno priorities. Caveat: cross-jump only merges post-reload
   register-identical tails — a duplicated *setup block* with calls did NOT
   merge (measured: 146 words), so the lever is limited to short
   register-free tails.

## The allocno arithmetic (all from `.greg`/`.lreg`, formula verified exact)

priority = floor_log2(refs) * refs * 10000 / live_length, descending,
ties to the lower allocno (= earlier declaration for locals). Current:

| web | refs | len | priority | got | need |
|---|---|---|---|---|---|
| arg2 (p83) | 4 | 66 | 1212 | s4 | s6 |
| arg5 (p86) | 5 | 84 | 1190 | s5 | s4 |
| arg0 (p81) | 4 | 68 | 1176 | s6 | s5 |

Required: arg5 > arg0 > arg2, i.e. arg2's live length 66→68 (68 ties arg0's
1176 and loses the tie to the lower pseudo, which is correct). Refs are
**fully pinned**: every ref-vanishing construct tested (death-site copies,
`x = arg;` staging, assignment-in-arg) is eliminated by cse/gcse copy
propagation *before* flow counts refs. Live lengths are sched1-rewritten, so
only real post-combine insns move them.

## Why the last two length units are hard

arg2's b0 stretch is its entry-copy slot to block end. The scheduler trace
shows the copy (UID 8) becomes ready in backward scheduling only after its
consumer (`pos_end` addu) schedules, placing it immediately above the
consumer — 13 slots from block end, dependence-forced. The target's own
allocation implies its sched1 placed that copy 2 slots higher, so the
original's b0 RTL geometry differed in a way not yet found. Adding a
stretch insn elsewhere fails on collateral: b1/b5 insertions stretch arg5
(drops below arg0); b6-head insertions unbalance the mod/one 1500-tie;
b0-tail insertions stretch mod but not one (one is b1-born).

Exhausted/rejected (all measured, one compile each unless noted):
- residual grammar schema 5 × 2 full exhaustions (1152 and 20736 coords);
- single-expression `sector_end` (breaks the srl/andi/sltu/addu bytes);
- pos web split with vanishing copy (copy materializes, spill cascade);
- duplicated setup arms for cross-jump (no merge across calls);
- pointer-temp spelling of the table access (flips addu operand order);
- `pos = arg1 + loc` operand swap (byte change);
- scheduler-state solver on block 0 (cannot derive a target-order assertion:
  entry-block emission alignment between sched1 and sched2 is ambiguous).

Next session: the missing lever is b0 entry-copy geometry. Candidates not
yet tried: TU-context changes that alter expand-time RTL around the entry
(e.g. different declared types for the stack parameters), and hunting for a
statement whose post-combine form adds one real b0-tail insn while being
placed *below* mod's birth slot but *above* the a2 copy's consumer chain.
Do not revive: flag overrides (probe found no fingerprint), barriers or
pins (policy; also cannot reorder allocno priorities).
