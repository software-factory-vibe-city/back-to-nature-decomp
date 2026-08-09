# Retro: paying down the raw-`__asm__` body debt

**Closed 2026-08-09.** The class "ordinary compiled function whose C body is a
raw `__asm__` block" is **empty**. Twenty-six functions were re-decompiled to
clean C89; two remaining whole-body assembly files (`func_8001DFD4`,
`func_80038674`) are GTE coprocessor code that was handwritten in the original
game and is correctly assembly.

Verified by re-scan on the date above: the only `src/*.c` files containing
`__asm__` are the two GTE functions, one symbol-alias block (`func_8002437C`),
and four register-pin / scheduling-barrier files, which are a **different debt
class** tracked in `notes/retros/2026-08-09-asm-folding-root-cause-retro.md`.

> **Date caveat.** Several retirement dates carried in the ledger below
> ("2026-08-2x") come from the working note and disagree with this
> repository's own git timeline, which places the whole campaign in
> 2026-07-31 → 2026-08-09. The rows are reproduced as written because the
> *mechanisms* are the valuable part; do not use these dates to order events.

---

## 1. What the debt was, and what it was not

The bytes were never at risk — an `__asm__` block reproduces the target by
construction. Three things were nevertheless broken:

- **the progress metric counted them as decompiled**, which they were not;
- **`contextExport` fed them to the next agent** as examples of a finished
  function, so one agent's fold became the next agent's template;
- **they were invisible to every diagnostic.** The compiler oracle, the
  allocator counterfactual, and the scheduler probes all work on cc1 output. A
  function with no C has no cc1 output.

The cause is diagnosed in `notes/retros/2026-08-09-asm-folding-root-cause-retro.md` and
is worth one sentence here because it explains the *shape* of the debt rather
than blaming the functions: the retired orchestrator's success check was
byte-only, so a raw `__asm__` block passed trivially — "the prompt forbade asm
while the gate permitted it, so under turn pressure agents did what the gate
rewarded."

A second belief kept the class alive after the gate closed. Every entry rested
on "no C matched 2.8.1", recorded in `notes/toolchain-version-detection.md`.
The compiler was later corrected to 2.95.2 and the premise dissolved:
`func_8001A8D0` (a switch statement) matched as clean C the moment the compiler
was right, and the rest of this campaign followed.

**Lesson zero: a debt class founded on a toolchain belief must be re-opened
when the toolchain belief changes.** Nobody re-tested the class for months
after the version was corrected.

---

## 2. The dominant finding: three walls, none of them codegen

Four functions in this class were expensive. Three of them consumed a full
session each from a capable agent, and in all three **the obstacle was a fact
outside the function body**. The compiler was never the problem, and in each
case the failure was indistinguishable, from inside the function, from a
genuine codegen impossibility.

| function | apparent wall | actual cause | cost |
|---|---|---|---|
| `func_80017EE4` | "a tail call, may be genuinely inexpressible in C" | **the symbol map was wrong** — three symbols were one function | one session, plus an `embedded-asm` exemption wrongly recorded |
| `func_8001205C` | ADR-0001 §4 says the target's unsplit self-clobber load is *proven unreachable* by reshaping C | **the declaration was wrong** — an over-wide `s32 [3]` override forced the split pair | one session of doc-reading |
| `func_8001E78C` | web-parity blocker; macro expansion and hand-written asm offered as hypotheses | **the reconstruction computed the wrong function** — inverted predicate, `<=` for `<` | one session, 225-candidate residual sweep, 18 syntheses, 3 fuzz variants, a target-schedule analysis and an allocator counterfactual |

None of that downstream analysis was wrong *as analysis*. It simply could not
converge, and **nothing in its output says so** — a residual search reports the
domain it was given, not whether the domain was worth searching. An
authoritative "exhausted, no match in this domain" is a statement about the
domain.

This generalizes into the audit rule now carried in the style guide (§10): when
a form reads as unreachable, audit the facts *outside* the function before
modelling a pass — the **symbol boundary**, the **declarations in scope**, and
the **predicate**. Each is minutes to check and each has produced a full
wasted session here.

The three mechanisms are written up as reference:

- `notes/research/symbol-boundary-verification.md`
- `notes/research/func_8001205C-declaration-shape-vs-address-form.md`
- `notes/research/func_8001E78C-predicate-inversion-and-parameter-webs.md`

The fourth expensive case, `func_80017E34`, *was* a real codegen problem and
has its own retro (`2026-08-28-func_80017E34-retro.md`): a shared multi-block
user variable read as two local temporaries. Its lesson — census the target's
registers as webs before diffing against your own output — is the positive
counterpart to the three above.

---

## 3. A corollary the campaign proved twice: exemption hygiene

`func_80017EE4` cost more than a session, because the session that failed it
**recorded an `embedded-asm` allowlist entry** to close the ticket. That entry
asserts, permanently and to every later agent, that assembly is the correct
answer for that function. It was not; the symbol map was.

An exemption is a finding, not a status. Being stuck is not that finding. The
rule is now in the skill's clean-source gate: **do not record an exemption for
a function you could not match** — quarantine it as `INCLUDE_ASM` in
`nonmatchings/` with its diff signature, which is honest, and file the obstacle.

The same hygiene failure is visible in the other direction. As re-measured on
2026-08-09, `.pi/autodecomp.json` still grants `embedded-asm` to
`func_80016054` and `func_80015704`, neither of which contains any assembly,
while `func_80021820` (a register pin) and `func_800244FC` (a scheduling
barrier) carry constructs and are **not** listed. The allowlist under-describes
the tree in both directions; this is filed as open work in
`notes/retros/2026-08-09-asm-folding-root-cause-retro.md`.

---

## 4. Retirement ledger

The mechanism column is the reusable part: it is a corpus of period source
idioms confirmed against the binary, and several entries transfer directly to
their siblings.

| Function | Recorded date | Mechanism that matched it |
|---|---|---|
| `func_80017EE4` | 2026-08-08 | Symbol boundary was wrong; three symbols merged into one 0x4C function, then ordinary C89 on the first shape respecting GCC 2.95's `expand_end_loop` rotation. |
| `func_8001205C` | 2026-08-08 | Not codegen: `D_8005E328` over-declared as `s32 [3]`, forcing the split two-register address. A scalar declaration took it from 12/15 to 15/15 with no change to the C. |
| `func_8001E78C` | 2026-08-08 | Two independent faults: inverted predicate, then delta ownership — assign back into the parameters rather than into fresh locals. Owns `D_8005E520`. |
| `func_80015AAC` | 2026-08-08 | 30-instruction sprite-source table lookup. Repeating the same stable `u16` dereference on both sides of the `0xFFFE` guard lets CSE replace the fall-through read with the target's fresh copy web; delayed-branch scheduling places the copy in the delay slot. |
| `func_80015594` | 2026-08-08 | 44-instruction PSY-Q TILE initializer via `setTile`/`setRGB0`/`setXY0`/`setWH`/`addPrim`; branch-local stores share one variable so crossjump forms the target diamond, and `setXY0` after the join preserves the signed-coordinate conversions. `return p + 1` supplies the delay-slot instruction. |
| `func_80021604` | 2026-08-08 | 25-instruction transfer-progress initializer. The apparent `multu`/`mfhi` high-product sequence is GCC's native expansion of unsigned division by 184320 (pre-shift the even divisor's 12 bits, reciprocal `0x05B05B60`); `delta / 184320U` matched. |
| `func_80013394` | 2026-08-09 | 27-instruction mode-dispatch getter over `D_8005E294`/`D_8005E3CC`/`D_8005E3CE`; clean C89 first shape. Owns all three globals. |
| `func_80021D64` | 2026-08-09 | 3-instruction stub: 16-byte frame and return, matched as a `char pad[16]` local — a placeholder body in the original source. |
| `func_8001FD74` | 2026-08-10 | 4-instruction Boolean getter `return D_80061F1C != 0;`. |
| `func_80017AA0` | 2026-08-13 | 11-instruction mode encoder. Required changing `D_8005E44C` from `u16` to `s16` in `globals_override.h` to emit `lh` rather than `lhu`. |
| `func_80017A70` | 2026-08-16 | 12-instruction table lookup with clamp. Owns `D_8005E44C`. |
| `func_80019030` | 2026-08-19 | 16-instruction conditional arithmetic. Stale obstacle blamed 2.8.1's `lh`/`lhu`; under 2.95.2 the real cause was front-end reassociation of `r - 12 - D_8005E2BA` into `r - (D_8005E2BA + 12)`. Split into two statements with an `s32` intermediate to prevent premature sign extension. |
| `func_80024408` | 2026-08-20 | 16-instruction nested guards on `arg1 < 2`, `(u32)(arg0 - 10) < 3`, `arg2 == 0`; clean C89 first shape. |
| `func_80022014` | 2026-08-21 | 22-instruction nested-loop table search over a 3×6 halfword grid. `s16 arg1` produces the `sll/sra` prologue, `u32` counters emit `sltiu`, and `i = 0;` before `arg0 += 2;` sets the correct birth order. |
| `func_8001530C` | 2026-08-22 | 44-instruction LINE_F2 initializer. Color-component extraction must be **delayed until after** the cond-branch diamond; temporaries `r0/g0/b0` held across `setXY0` produce the interleaved store schedule, and a shared `code` variable in both arms lets crossjump form the uncollapsed diamond. |
| `func_8001526C` | 2026-08-23 | 40-instruction TILE_1 initializer. `setXY0` must precede `setRGB0` in source order so the coordinate stores take lower LUIDs than the color stores and the legacy scheduler emits them first. |
| `func_8001F278` | 2026-08-24 | 29-instruction 3-iteration integer lerp. The target shares `subu a0,a1,a0` across both arms by delay-slot speculation; `if (arg1 < arg0) arg0 = arg1; arg0 = arg1 - arg0;` produces the common-tail merge, and a `do-while` countdown with `i--` before `arg2++` matches the backward scheduler's LUID tiebreak. |
| `func_8001AF70` | 2026-08-27 | 28-instruction bit-flag setter/clearer. Address computation needs three statements in exact order — bare-symbol base, `scaled = word_idx << 2`, then `base += 0x38` as a separate `addiu` — so that `word_idx` overlaps `base` in `$v0` and is pushed to `$v1`. |
| `func_80017E34` | 2026-08-28 | 27-instruction u16 strcat. The pre-check re-read and the loop store value are **one** shared user variable: a multi-block web that goes to global-alloc, conflicts with `$v0`, and takes `$v1` in both blocks. Full retro and research note. |

Not in this table and **not retired**: `func_8001D2D8` left the raw-asm class on
2026-08-08 *without* reaching clean C. Its body is C with one pinned temporary
added under the owner's explicit authorization; the allowlist entry records that
authorization, not a finding that assembly is correct. 26 of its 28 words come
out of clean C and the residual is the entry-block sign extension. It is a
register-pin entry now and lives in
`notes/retros/2026-08-09-asm-folding-root-cause-retro.md`.

---

## 5. Found alongside: two tools that gave authoritative wrong answers

Both are written up in `notes/research/tooling-false-verdicts.md`. Summarized
because they cost real time in this campaign:

- **A stale linker script read as 984 decompilation errors.** `make split`
  appends four `INCLUDE` lines by shell *after* splat runs, and nothing has a
  Make rule to build the script. An interrupted split leaves every `.bss`
  symbol at or above `0x8005E850` undefined, naming `func_80011370` in the
  errors. Cost a full investigation on 2026-08-08. The guard is still not
  implemented.
- **A residual search reported `exhausted-no-exact` while holding a
  byte-exact candidate.** It clusters by canonicalized assembly text; cc1
  spells negation `subu $t0,$zero,$a1` and the disassembler prints the same
  word as `negu t0,a1`. Fixed in `tools/agent/variant-lab/compile.ts`
  (`normalizeAlias`, with a regression test).

---

## 6. Lessons

1. **A debt class founded on a toolchain belief expires with that belief.**
   Re-open the class when the toolchain is corrected; do not wait for someone
   to happen upon it.
2. **Before modelling a compiler pass, audit the facts outside the function:
   symbol boundary, declarations in scope, predicate.** Three of this
   campaign's four hard cases were one of those, and all three presented as
   codegen impossibilities.
3. **A capable, internally consistent analysis aimed at the wrong premise
   produces no signal that it is aimed wrong.** Residual sweeps, syntheses,
   and SAT searches report their domain. Check the premise before scaling the
   search.
4. **State the function's semantics in words, from the target, before any
   allocation or scheduling work** — and prefer an already-matched sibling in
   the same TU over the raw disassembly when one exists.
5. **An impossibility result is conditioned on its inputs.** ADR-0001's
   "proven unreachable" was true *given the declaration in scope*. Re-read what
   the result assumed before accepting it as a wall.
6. **Reusing a parameter is not a hack; it is a statement about which web the
   value lives on.** So is a shared multi-block variable. When a residual is
   argument copies plus a register rotation, change the web population before
   reaching for allocator tooling.
7. **An exemption is a finding, not a status.** Never record one for a function
   you could not match; quarantine instead.
8. **`diffFunc` is not the verdict — `make check` is.** It compares pre-link
   encodings and can both false-pass and false-fail.
9. **When a tool reports a negative result, spot-check its best candidate
   against the byte oracle before believing it.** Two tools in this campaign
   were confidently wrong in the direction that ends a search.
10. **Say whether a claim in a note is a measurement or a hypothesis.** This
    class's own note asserted `func_80017EE4` "may be genuinely inexpressible
    in C" as if measured. It was a guess, it was believed, and it was acted on.
