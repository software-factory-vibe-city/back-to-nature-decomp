# Parameter-residence playbook — what to do when `param-residence` fires

Triage's `param-residence` detector routes here. It fires on two byte-level
fingerprints in the target:

- **REREAD-SLOT** — an incoming stack-argument slot loaded more than once
  (a register-resident parameter is copied out exactly once near entry);
- **HOMED-ARG** — `$a0`–`$a3` stored to its own incoming home slot
  (`framesize + 4n`) and loaded back later.

Both mean a parameter's value LIVED in its stack slot. The class was
diagnosed and closed on func_80014CBC (matched 117/117 after three failed
campaigns); the full mechanism inventory is
`notes/retros/2026-08-14-func_80014CBC-retro.md`. This note is the recipe.

## Why it matters before any other work

Residence is decided by `assign_parms` at the opening brace, from the
declaration alone. The wrong residence in a reconstruction plants
entry-copy/load insns in block 0's RTL that the original never had. Their
stream positions and dependences feed every scheduler release and every
allocno statistic in the entry block, so the failure mode is deceptive:
count, inventory, and web parity can all be exact while the entry weave and
the home-store slot are unreachable by ANY statement-level edit. All three
of func_80014CBC's campaign-ending "impossibility proofs" were artifacts of
wrong residence. Fix residence FIRST, before allocation or scheduling work,
and certainly before scheduler forensics.

## Step 0 — rule out varargs

If ALL live argument registers are homed consecutively (`sw a0..a3` to
`framesize+0..0xC` near entry) the function is almost certainly varargs:
declare `...` with stdarg and stop — that is ordinary period C, not this
class. The class fingerprint is a PARTIAL homing (one or two registers) or
per-use stack-slot re-reads.

## Step 1 — declare the residence

The one C-level lever over `assign_parms` (measured; nothing else reaches
it):

```c
/* 4 bytes with alignment 1 stays BLKmode on strict-alignment MIPS, and a
 * BLKmode parameter is left memory-resident. */
typedef struct {
    u_char b[4];
} SomeName;        /* file-local; name freely */
```

- **Stack parameter (REREAD-SLOT)** → declare it `SomeName`. assign_parms
  leaves it in its incoming slot with NO entry copy; each C use
  `*(s32 *)&argN` compiles to a fresh load from the slot — the target's
  lazy per-use `lw` pattern for free.
- **Register parameter (HOMED-ARG)** → declaring it `SomeName` makes
  assign_parms emit the real home store (`sw aN,home`) at the TOP of the
  RTL stream, as a real store-class insn. The alternative reading is a
  reload spill of a call-crossing argument (a plain declaration can also
  byte-match, as func_80014CBC's 116/117 frame proved) — but the spill is
  reload-born, invisible to sched1, and its slot is then hostage to
  release dynamics. If the store's position is wrong under the plain
  declaration, switch to the BLK reading.

Dead ends already measured — do not respend them:

- `&argN` on a REGISTER parameter does NOT make it memory-resident (the C
  front end expands statements as it parses; `TREE_ADDRESSABLE` is set too
  late for assign_parms) and `put_var_into_stack` then allocates a NEW
  frame slot — wrong frame size.
- `volatile` homes the parameter but forbids CSE store-forwarding, adding
  a byte-visible load at the first use.

## Step 2 — spell the uses

- Word reads: `*(s32 *)&argN`. CSE forwards a read that immediately
  follows the home store back to the register, so `pos += *(s32 *)&arg1`
  still emits `addu ...,aN` with no extra load.
- A single register-resident load of a memory-resident parameter (the
  target loads the slot ONCE into a callee-saved register) is an ordinary
  C statement: `s32 x = *(s32 *)&argN;` — and its STATEMENT POSITION is a
  real scheduling lever, because the load is stream-born where the
  statement sits. Place it per the target's schedule slot.
- Calls: other TUs are unaffected (a 4-byte struct has identical ABI
  placement to `s32`). TU-INTERNAL calls (recursion) see the prototype, so
  pass the words through a cast function pointer:
  `((ret (*)(s32, ...))func)(...)`.
- A re-read of a DIFFERENT home slot can be spelled as plain C relative to
  a stack parameter's address (`*(s32 *)((char *)&argSTACK - k)`), giving
  the scheduler an ordinary load exactly like the original's reload-born
  one. func_80014CBC's recursion reload is the worked example.

## Step 3 — re-measure from scratch

The residence change deletes/creates block-0 insns, so every prior
measurement is stale: re-run triage, `psx_explain_diff`, and re-derive the
allocno table from fresh `.lreg`/`.greg` dumps before any margin tuning.
Expect the usual convergence loop (ref/length arithmetic against the
priority formula). The quick reference:

- priority = `floor_log2(refs) * refs * 10000 / live_length`, ties to the
  lower allocno; the floor_log2 boundaries (4→8→16 refs) are step changes;
- duplicate same-register inputs within ONE asm are not ref-counted;
  inputs on different insns each count;
- live length is rewritten by sched1 from its own schedule: only real
  insns inside the web's live window move it, and they stretch every other
  web live in that window — pick windows where the collateral webs are
  dead (func_80014CBC used the then-arm and block-boundary positions).

## Step 4 — escalation order if the schedule still resists

1. Statement order of the residence loads and any split-web copies
   (`len = argN;` routes a web's surviving copy insn to a late stream
   position — a parameter copy's own RTL slot is immovable).
2. The retro's measured scheduler facts (release = successors placed;
   late ties = descending sched1 position; loads launch at
   consumer + latency; a lone-ready insn is FORCED into a stall gap).
   Read the sched2 dump's per-cycle record before authoring variants.
3. Hybrid asm (dependence-gating dummy operands, literal-template
   carriers) is LAST, needs explicit user authorization plus the
   `embedded-asm` allowlist entry, and every operand must pin one named,
   measured decision. `src/func_80014CBC.c` is the worked example and the
   retro maps each construct to the mechanism it pins. Exception history
   for this class so far: one function in one occurrence, and that one
   predates this recipe — a scrub of the other 16 allowlisted functions
   found NO residence fingerprints, so do not expect an exception; earn it.

## Census of the remaining work (scrubbed 2026-08-14, 215 stubs)

Fingerprint carriers — run this playbook when starting them:

| function | insns | s-saves | notes |
|---|---|---|---|
| func_80018B98 | 294 | 9 | REREAD + HOMED + self-recursive — the full func_80014CBC profile, highest risk |
| func_800183E0 | 491 | 9 | HOMED |
| func_80017F88 | 268 | 9 | HOMED |
| func_800136D4 | 202 | 9 | HOMED — MATCHED 2026-08-15 as the **reload-spill** reading (plain `u32 *` declaration, Step 1's alternative): the BLK declaration byte-matched nothing here because its 14 assign_parms-visible home loads sat in block-0 RTL, inflating every call-crossing qty span at lreg time and busying the sched1 ready lists; under the plain declaration those loads are reload-born and invisible to sched1/lreg, which flipped the whole s4–s8 assignment cascade. See `notes/retros/2026-08-15-func_800136D4-retro.md` |
| func_80020B80 | 174 | 9 | HOMED |
| func_80019610 | 123 | 9 | HOMED — size-twin of func_80019AD0; varargs (printf-family) suspected: check Step 0 first |
| func_80019AD0 | 123 | 9 | HOMED — see above |
| func_8002066C | 63 | 6 | REREAD + HOMED — small, has allocation slack |

Full s-register pressure without the fingerprint (margin work likely, this
playbook not implicated): func_8001231C, func_8001E4C0, func_8001F664,
func_800212A8, func_8002206C. Other self-recursive stubs: func_8001929C,
func_8001945C.
