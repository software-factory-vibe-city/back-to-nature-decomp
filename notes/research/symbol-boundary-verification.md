# Symbol boundaries: proving a symbol is a function before decompiling it

**Established 2026-08-08 (`func_80017EE4`), generalized 2026-08-09.**
**Status:** mechanism understood; detector implemented in
`tools/build/mergeFragments.ts` and applied by `make split`. Open boundary
artifacts remain (§5).

## 1. The failure mode

A symbol that is not a function cannot be decompiled as one, **and the failure
looks exactly like a codegen impossibility.** Every diagnostic downstream of
the source — the diff classifier, the compiler oracle, the allocator
counterfactual, the scheduler probes — takes the symbol range as given. Feed
them two instructions that are really the tail of the previous function and
they will faithfully report that no C produces those two instructions, because
none does.

`func_80017EE4` is the worked case. `0x80017EE4..0x80017F30` is **one**
function that the symbol map presented as three: a 2-instruction "function", a
1-instruction "function", and the body. The working note of the day recorded
the conclusion "a tail call, not a body… may be genuinely inexpressible in C",
which was a guess stated as a measurement. A later session believed it, spent
a full session confirming it, and closed the ticket by writing an `embedded-asm`
block plus an allowlist entry — an assertion that assembly is the correct answer
for that function, which was false.

Once the three symbols were merged, the function matched as ordinary C89 on the
first shape that respected GCC 2.95's `expand_end_loop` rotation. No asm, no
flag override, no register pinning.

**A 2-instruction symbol is not a function.** Neither is a symbol with no
return. Prove the boundary before believing anything about the codegen inside
it.

## 1a. Second worked case: `func_8001A910`, the "tail-call dispatch table"

The same failure produced the same wrong conclusion a second time, and this one
is worth recording because the conclusion reached for was **assembly**.

`func_8001A910` was listed as one of seven jump-table functions and singled out
as a special case: its table held **function names** rather than local labels
(`.word func_8001A960`, …), which was read as a tail-call dispatch table, with
the recorded hypothesis that it "may need a top-level `__asm__` block rather
than a C switch statement."

There was no such function. `0x8001A910` is an internal label of
`func_8001A8D0`, a 0xA0-byte character-classification routine that matched as
**clean C89 with an ordinary `switch`** once the compiler was corrected to
2.95.2. `configs/symbol_addrs.txt` now types `_8001A8FC` and `_8001A910` as
`label`, and `func_8001A8D0` carries an explicit `size:0xa0` so splat keeps the
range whole. The jump table `jtbl_80010144` is attached to that function's
rodata segment, and its `.word func_8001A960` / `func_8001A968` entries are
case labels *inside* the same function.

Two things to take from it:

- **A jump table whose entries are function symbols is a boundary signal, not
  a dispatch-table signal.** Targets that land inside another function's range
  are case labels that the symbol map promoted.
- The residue is cosmetic but confusing: `func_8001A940`, `…948`, `…950`,
  `…958`, `…960`, `…968` are still typed `func` in `configs/symbol_addrs.txt`
  while lying inside `func_8001A8D0`. They are inert — the explicit size wins
  and no source files exist for them — but they will read as missing functions
  to anyone scanning the symbol list.

## 2. Decisive evidence, cheapest first

Any one of these proves the symbol is not an independent function. They are
ordered by cost, not by strength.

1. **No `jr $ra` anywhere in the body.** The symbol does not return; it falls
   through into the next one.
2. **A conditional branch crosses the symbol boundary, in *either* direction.**
   A MIPS conditional branch can never be a call, so this proves the two symbols
   are one function. A *backward* branch from a later symbol into an earlier one
   is a rotated loop's back-edge, not a call — this direction is the one most
   often missed.
3. **The entry is a `j`, not a prologue.** GCC 2.95 emits no tail calls. A `j`
   to an address with no `jal`, no stored data pointer, and no address-taken
   `lui`/`addiu` anywhere in the binary is intra-function control flow.
4. **A register is read before any definition on some path** — e.g. the body
   depends on `$a3` set only by the preceding symbol. `psx_scan_read_before_def`
   reports this. (Note the overlap with the register-variable fingerprint: a
   read-before-def finding is *either* a boundary defect *or* the handwritten /
   register-variable class. Rule out the boundary first, since it is cheaper.)
5. **Zero callers.** Scan for `jal`, stored pointers, and `lui`/`addiu` pairs
   across the whole payload — not just the call graph, which is built from the
   same possibly-wrong symbol table.

## 3. The three detector defects that let this through

`mergeFragments.ts` was already looking for this class and missed it three
ways. All three are fixed; they are recorded because they are the natural
blind spots of any re-implementation:

- a `j` was counted as a **tail call**;
- a `j` was counted as an **external entry point**;
- the cross-boundary branch pass looked only for **forward** branches.

## 4. Practical rule

**Re-running `make split` is the first thing to try on a stuck tiny function.**
The detector now runs there, so a boundary that survives it is evidence rather
than an assumption — which is exactly the property the old boundary did not
have.

Signals that should trigger the check before any source work:

- the symbol is under ~4 instructions;
- `explainDiff` reports an instruction-count delta that no source shape moves;
- the frame map implies a signature the call sites contradict;
- `scanReadBeforeDef` fires and the function is not in a known
  register-variable TU.

## 5. Open: boundary artifacts not yet resolved

A binary-wide scan (2026-08-08) found:

- **nine symbol pairs** with a conditional branch crossing between them;
- **three symbols with no terminator**.

Most resolve to the two merge groups `make split` now applies. The pairs
involving `func_8004815C` — a 0x166A4-byte symbol — look like a **splat
coverage problem**, not real merges, and need separate triage. Do not feed
them to `mergeFragments` expectations.

## 6. Related

- `notes/retros/2026-08-09-asm-body-debt-paydown-retro.md` §2 — this was one of
  three "the wall is outside the function" cases found in one campaign.
- `prompts/c-style-guide.md` §10 — the general audit rule.
- `notes/research/frame-size-arity-diagnostic.md` — the other structural
  premise that must be right before source work.
