# func_8001205C: the declaration decides the address form, and an ADR said "unreachable"

**Date:** 2026-08-08. **Status:** SOLVED — 15/15, `make check` passes, clean
C89, no flag override and no pin. The fix changed **no C at all**: it changed
one declaration in `include/globals_override.h`.

## 1. The apparent wall

`func_8001205C` is a 15-instruction arithmetic expression over four globals.
The residual was one word. The target reads `D_8005E328` with the
single-register self-clobber pair

```
lui $a1, %hi(D_8005E328)
lw  $a1, %lo(D_8005E328)($a1)
```

and the candidate emitted the split two-register form. `ADR-0001 §4` states
that recovering that pair by reshaping the C is **proven unreachable**, and
that result is correct. So the obstacle read as a wall, and it cost a capable
agent a session of documentation reading.

## 2. What was actually wrong

The pair was unreachable **because the declaration was wrong**. `D_8005E328`
had been over-declared as `s32 [3]` with a comment saying it was widened to
"force absolute addressing under `-G8`".

That reasoning was correct *before* ADR-0001 §2.4 and is backwards after it.
Since §2.4 the two decisions are independent:

| Question | Decided by |
|---|---|
| GP-relative or absolute? | whether **this TU defines** the symbol — size is irrelevant |
| unsplit macro load (self-clobber) or split pair? | the **declared size** against `-G8` |

Widening bought nothing, because absolute addressing never depended on size;
and it cost the match, because cc1 then split the address. Declaring the symbol
as a scalar took the function from 12/15 to 15/15 on the existing C.

`ADR-0001 §4.1` states the current rule. This note exists to record the
*diagnostic* shape of the mistake, which the ADR does not cover.

## 3. The general rule

**When the target uses a form the allocator or compiler "cannot" produce, check
what the symbols are declared as before believing the impossibility result.**

An impossibility result is conditioned on its inputs. ADR-0001 §4 says a
particular address form is unreachable by reshaping C — true, *given the
declaration in scope*. Reading it as unconditional turns a one-line fix into a
wall. This is the same shape as the symbol-boundary case
(`notes/research/symbol-boundary-verification.md`): a fact outside the function
body makes the function look inexpressible.

## 4. Two cheap checks

- **Does the same file already contradict you?** `func_8001205C` reads
  `D_8001009C` (a scalar) as the matching self-clobber pair and `D_8007AFF4`
  (genuinely 12 bytes) as a genuine split — three lines apart, in the same
  function. A same-file counter-witness settles the question in one grep.
- **Is the declaration's comment older than 2026-08-08?** Comments claiming a
  *size* controls the *addressing mode* predate ADR-0001 §2.4 and are now
  false. Treat them as suspects, not as constraints.

## 5. Where this generalizes

Any override in `include/globals_override.h` is an input to every codegen
conclusion drawn about the functions that touch that symbol. The override file
is not neutral scaffolding: a wrong width changes load width and signedness
(`lh` vs `lhu` — see `func_80017AA0`, `func_80019030`), a wrong size changes
the address form (this note), and a wrong type changes the arithmetic. Before
attributing a residual to allocation or scheduling, confirm the declarations
the function reads.

## 6. Related

- `notes/adr-0001-symbol-addressing-at-the-assembler-boundary.md` §2.4, §4.1 —
  the authoritative rule.
- `notes/research/func_80016C08-tu-owned-globals-and-gp-relative-addressing.md`
  §3 — the measured ASPSX gp-relative rule this rests on.
- `notes/retros/2026-08-09-asm-body-debt-paydown-retro.md` §2.
- `prompts/c-style-guide.md` §7 (small-data addressing) and §10 (the audit rule).
