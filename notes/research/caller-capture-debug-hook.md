# Caller-Capture Debug Hook (CAPTURE_RA)

**Status:** func_80016054 matched 29/29 and func_80015704 matched 68/68,
both byte-verified in the linked binary (`make check` payload match). The
idiom is abstracted into `include/debughook.h`.
**Updated:** 2026-08-06

## What it is

A studio debug macro, left in the retail binary, that records the live return
address (`$ra`/`$31`) through a destination pointer. It is the
"who called me?" breadcrumb of 1999 PSX development: drop it at the top of a
suspect function, run until the bug, read the recorded address in the devkit
debugger or FntPrint it on screen. C cannot read `$ra`, so the capture is
necessarily embedded asm — in the original source and in ours.

The reconstructed macro (`include/debughook.h`):

```c
#define CAPTURE_RA(dst) \
    __asm__ volatile("addu $8,%0,$0" : : "r"(dst) : "$8"); \
    __asm__ volatile("sw $31,0($8)")
```

Hardcoded `$8` scratch with a clobber, address as a compiler-computed `"r"`
input. The two machine instructions must remain separate asm statements:
GCC models each statement as one RTL instruction, and combining both into one
template changes local-allocation lifetime boundaries in func_80015704. The
split form byte-matches both sites; pin/register-variable alternatives do not
(see the experiment ledger below).

## Retail sites and evidence

| Site | dst | Address materialization | Status |
|---|---|---|---|
| func_80016054 (0x006854) | `&D_8006C84C` (s32[3] global) | `lui`/`addiu` pair (12-byte object, excluded from `-G8` sdata) | matched, uses the header |
| func_80015704 (0x005F04) | stack local at `sp+0x10` | `addiu $v0,$sp,0x10` | matched, uses the header |

Both sites show the identical asm fingerprint — `addu $8,<addr>,$0` followed
by `sw $31,0($8)` — with *different* compiler-generated address computations
feeding it, which is what proves a shared macro taking a pointer argument
rather than two hand-written sequences. The shared macro is also file-grouping
evidence: both functions had access to the same debug header (same TU or a
shared studio header).

## Byte-level signatures (general knowledge)

Three distinct producers store `$ra` to memory in this binary. Distinguish
them before choosing a matching strategy:

1. **C-macro hook (this idiom).** `sw $ra, 0x0($8)` — a non-`$sp` base,
   zero offset — immediately preceded by `addu $8, <reg>, $zero`, with the
   address computed by ordinary compiler code nearby (`lui/addiu` for a
   global, `addiu $sp,N` for a local) and the whole cluster appearing
   *before the first `jal`*. Reconstruction: `CAPTURE_RA` from
   `include/debughook.h`; classification stays compiled-C with an
   `embedded-asm` allowlist entry.
2. **Assembler-macro form (handwritten asm).** `sw $ra, %lo(SYM)($at)` —
   the `$at` register means the assembler expanded a `sw $ra, SYM`
   pseudo-op, which GCC never emits. Retail sites: three around
   `T_8005E188` (0x800459E8/0x80045ADC/0x80045CB4) and two at
   `D_800B79F8`/`D_800B7A08` (0x80042E90/0x80042F08). These belong to the
   handwritten-assembly classification path, not to C reconstruction.
3. **Ordinary frame save.** `sw $ra, N($sp)` — every non-leaf function;
   carries no signal by itself. But its *position* does: see the
   scheduling section.

Related soft signature: a function whose frame `sw $ra` sits *below* the
incoming-argument loads (position 9–10 instead of 1–2) is showing natural
GCC 2.95.2 sched2 behavior around unboosted webs — not hand-tuning. If a
hybrid reconstruction has that store stuck at the top, the hybrid's own
constraints are the cause.

## Agent playbook — when and how to use CAPTURE_RA

Trigger: target function stores `$ra` through a non-`$sp` register with the
`addu $8` scratch copy (signature 1).

1. Identify `dst` from the address computation feeding the `addu`
   (global symbol or stack slot).
2. Write the function as **fully natural C** — arguments passed directly, no
   helper locals — with `CAPTURE_RA(<dst expression>)` invoked near the top,
   before the first call. The address materialization follows the
   invocation's source position (insn LUIDs); argument loads hoist above the
   volatile asm on their own because their single-set webs carry the
   scheduler's priority boost.
3. If a single instruction lands in the wrong slot, move *statements*, not
   values: e.g. func_80016054 needs `arg3 &= 0xFF;` as a standalone statement
   before the hook so the `andi` precedes the `lui` — expression-position
   (`arg3 & 0xFF` at the call) compiles the same instruction eight slots
   later. Do not add staging locals or dummy dependencies; both were tried
   and both are unnecessary (see ledger).
4. Do not wrap anything else in asm. In particular do not move the
   `lui/addiu` or `addiu $sp` address computation into the asm block — the
   compiler must own it (its multi-set web is skipped by the scheduler's
   single-set priority boost, which is exactly why it lands where it does in
   the target).
5. Add the function to `.pi/autodecomp.json` `sourcePolicy.allowlist` as
   `["embedded-asm"]`.
6. Verify with `diffFunc`, then `make check`.

Worked example: `src/func_80016054.c`.

## Scheduling lessons (transferable beyond this hook)

These generalize to any GCC 2.95.2 prologue/ordering residual and are the
reason four prior hybrid attempts plateaued at 27–28/29 on func_80016054:

- **Null-case rule.** Before building or fighting a hybrid, compile the
  function with *no asm at all* and read the natural schedule. The stuck
  28/29 was self-inflicted: the walls of the old hybrid pinned `sw $ra` at
  position 2 while the wall-free compile sank it to the target position
  unprompted.
- **Prune to natural after matching.** A first match inherits scaffolding
  from the path that found it. Re-derive from the most natural spelling and
  delete every element that is not independently load-bearing: the first
  29/29 here carried five staging locals and a slot pointer, all of which
  proved unnecessary — the natural three-line function also scores 29/29.
  "Would a programmer actually write this?" is a diagnostic, not a
  rhetorical question; when the answer is no, suspect your own search
  history before the compiler.
- **Memory clobbers and `$sp` operands are scheduling walls; plain
  volatile asm is not.** A `"memory"` clobber serializes against every
  store (including the frame `$ra` save), and a `$sp` read/write operand
  creates dependencies against all stack traffic — these pinned the old
  hybrid. But a volatile asm *without* a memory clobber does not stop
  independent boosted loads from hoisting above it; only the asm's own
  dependency cluster is anchored to its source position. Use the minimum:
  one volatile asm containing only the instructions C cannot express, no
  memory clobber unless the target's store ordering demands it.
- **Provenance partition.** For each target instruction in a mixed region
  ask "compiler-owned or asm-owned?" The `addu $8,$2,$0` copy looked like a
  quirk to force with pinned registers; it is actually the *seam* where the
  compiler-computed address enters the asm. Partitioning correctly made
  three placements fall out at once.
- **The priority boost and web set-counts.** sched1/sched2 saturate
  single-set live-dest insns to maximum priority; multi-set webs (like a
  `lui`+`addiu` address pair, or a self-masked parameter `arg &= 0xFF`) are
  skipped and naturally sink below boosted loads. Choosing *how many sets a
  web has* is a scheduling tool available in plain C.
- **Dummy asm input dependencies are a trap.** A max-priority asm chain
  hoists whatever load it depends on straight to the front (three variants
  failed this way). Do not add artificial `"r"(value)` inputs to steer
  placement.
- **Hardcoded-register clobber form beats register pins.** `register x
  asm("$N")` locals interact with coalescing (outputs merge into input webs
  and shift every later color). An asm that hardcodes its scratch and
  declares it in the clobber list has no output to coalesce and reproduces
  deterministic register choice at every site — and is closer to what 1999
  programmers actually wrote.

### Experiment ledger (func_80016054, all under baseline flags)

| Variant | Change | Result |
|---|---|---|
| old hybrid | 4 asm blocks, volatiles, `$sp` operands | 28/29; `sw $ra` pinned at idx 1 |
| builtin | `__builtin_return_address(0)` | wrong shape: GCC reloads `$ra` from the frame |
| V1 | de-volatiled dataflow asms | `sw $ra` reached target slot; andi/addiu/colors wrong |
| V2 | + `$sp` trick for andi | `sw $ra` re-pinned at idx 1 (the `$sp` wall) |
| V3/V4/V7 | dummy value deps on addiu | dep's load hoists to front; suffix breaks |
| V6 | arg locals staged before asm | load order+colors exact; addiu still early |
| V8 | address as plain C (`p = &D`), asm = addu+sw | **schedule exact**; scratch coalesced into `$2` |
| V10/V11 | pins `$2`/`$8` | 29/29 byte-verified (pin form) |
| V12 | single self-contained macro stmt after copies | address LUID too late; schedule regressed |
| V14 | clobber-form macro, no pins, staged args | 29/29 byte-verified (still carried staging locals) |
| natural | hook first, args passed directly, mask in call expr | 28/29-order: only `andi` late (idx 13 vs 2) |
| natural+mask | + `arg3 &= 0xFF;` statement before hook | **29/29 byte-verified — final form, plain C** |
| split hook | represent `addu` and `sw` as separate asm statements | **func_80016054 remains 29/29; func_80015704 reaches 68/68 without an empty barrier** |

## Open items

- Semantics of `D_8006C84C[3]`: only word 0 is written by known code; words
  1–2 may be written by unfound code or read by a display routine. Naming
  deferred until usage is known.
- If more `CAPTURE_RA` sites appear (scan:
  `grep -l 'sw.*[$]ra, 0x0(' build/functions/*.s`), the shared-header
  grouping evidence strengthens accordingly.
