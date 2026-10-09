# ovl_15_func_80134770 — a struct-member store that CSE cannot rewrite

**Date:** 2026-10-08
**Outcome:** `ovl_15_func_80134770` is EXACT: 72/72 words, residual
`[0, 0, 0, 0]`. `make check-all` passes.

The previous session logged 19 ledger attempts and wrote 37 variant files.
Its honest sources stopped at 52/60 with residual `[0, 2, 10, 10]`. Thirteen
different sources compiled to that same output. The best result, 57/59,
needed a hack (`q = dst + 1; *(q - 1) = 0;`).

The residual had two parts:

1. **The data model.** The 64-byte buffer is the `Title` field of a PSX
   memory-card header. The NUL store compiles to the target's address form
   only when it is written as a member access on the global header, not
   through a `char *`.
2. **Two scheduler inputs.** One is the order in which the date fields are
   copied. The other is whether the slot table's base address is loaded
   before its index is computed.

---

## 1. Block 0: one store, two address forms

```asm
/* target */                         /* any `dst = D_80140F14; *dst = 0;` */
lui   s2,%hi(D_80140F14)             lui   s0,%hi(D_80140F14)
addiu s2,s2,%lo(D_80140F14)          addiu s2,s0,%lo(D_80140F14)
...                                  ...
sb    zero,0(s2)                     sb    zero,%lo(D_80140F14)(s0)
```

Both store the same byte. The pipeline-reversal tool sorted this correctly as
a population difference: target-only `sb <reg>,0(<reg>)`, candidate-only
`sb <reg>,3860(<reg>)`.

### Why no spelling of `*dst = 0` reaches it

- **Split addresses.** With `-msplit-addresses`, `dst = D_80140F14` expands
  to a `high` pseudo and a `lo_sum` pseudo.
- **CSE picks the `lo_sum` form.** When CSE reaches `(mem (reg dst))`,
  `find_best_addr` (`cse.c:2815`) looks up `dst`'s equivalence class and
  finds `(lo_sum (reg hi) D_80140F14)`.
  - A register and a `LO_SUM` both have address cost 1 (`mips.h:3703`,
    `mips.c:2503`).
  - On a tie, `find_best_addr` takes the candidate with the higher rtx cost,
    which is the `lo_sum`.
  - The high-part register therefore stays live until the store.
- **The barriers tried all fail.**
  - A loop note ends CSE1's basic block (`cse.c:8529`). CSE2 runs with
    `after_loop` set, ignores the note, and repeats the rewrite.
  - An unreferenced label is deleted by jump1 before CSE runs.
  - A conditional jump around the call is followed by CSE's skip-blocks path.
  - `if (dst != NULL)` does not fold, and leaves a branch.
- **Other spellings that fail.**
  - Casts, unions, `register`, and `volatile` give either the same words or
    a different program.
  - `strcpy(dst, "")` loads a byte from `$LC0`.
  - `*(char *)memset(...) = 0` stores through `$v0`. This clears the
    register-masked population check but fails allocation.

### What the original wrote

Three facts identify the buffer:

- **The strings.** They decode from Shift-JIS to "ＨＡＲＶＥＳＴ　ＭＯＯＮ　ＦＩＬＥ",
  "　Ｙｒ" and "　", followed by a season name. This is the save title.
- **The labels.** `D_80140F10` is a 4-byte data label directly before
  `D_80140F14` (`build/ovl_15/asm/data/979C.data.s`). A PSX memory-card
  header is `Magic[2]`, `Type`, `BlockEntry`, then `Title[64]` at +4.
- **Another writer.** `ovl_15_func_8012FAE0` copies a 3-byte prefix from
  `D_8012DEBC` into `D_80140F10`.

So the store is `D_80140F10.Title[0] = 0`, and it expands differently:

| pass | the store's address |
|---|---|
| expand | `(plus (reg base) 4)`, where `base` is a new `lo_sum` of `D_80140F10` |
| CSE1 / CSE2 | unchanged. CSE rewrites `base` itself as `(plus (reg title) -4)`, but the store's address is `reg+const`. The `reg+const` branch (`cse.c:2951`) only produces `(reg title)`, which is not strictly better, and it never reaches the `lo_sum` |
| combine | `(mem (reg title))`, after both CSE passes |

The address reaches its register form only after CSE can no longer rewrite
it. The agent's `*(q - 1)` hack produced the same RTL, and the residual tool
said so: `h2.c` "compiles to words already measured … from
build/exp34770/w3.c — same experiment, different spelling".

The member access has to be on the global itself. Through a pointer,
`hdr->Title[0] = 0` keeps `(plus (reg hdr) 4)` and compiles to
`sb zero,4(hdr)`.

## 2. Block 0: the schedule

With the store fixed, the residual was schedule-only: `[0, 0, 9, 10]` and
then `[0, 0, 2, 8]`. The two causes are separate.

- **Base before index.** The target computes `lui/addiu %lo(D_801376E0)`
  before `arg0 * 0x3C`.
  - `entries = D_801376E0; src = &entries[arg0].date;` emits the base
    first.
  - Every single-expression form emits the index first: `&D_801376E0[arg0]`,
    `(u8 *)D_801376E0 + arg0 * 0x3C`, `(s32)` arithmetic, and the
    `&(D_801376E0 + arg0)->date` form.
  - `entries = D_801376E0` must come after the `memset`. Before it, the
    result is 67/68.
- **Field-copy order.** Only one of the 24 orders is exact: `season`,
  `unk6`, `unk4`, `year`. Where `Title[0] = 0` sits makes no difference.
- **Not a struct copy.** `d = *src` on an 8-byte, 2-aligned struct becomes
  an `lwl`/`lwr` block move.

The order and address forms were found with three sweeps, each scored by one
`residualObjective.ts --dir` run of about a minute or less:

- a 432-variant grid (address form × field order × store position);
- an 8-form sweep of the address computation;
- a 48-variant grid of field order and store position. The generators are in `build/34770_claude/gen*.ts`.

## 3. Census

`build/34770_claude/census.ts` scans all 1,983 target functions for one
pattern: an offset-0 memory access through a register holding a global's
full `%lo` address, with no code label between the two. It found 34 accesses
in 21 functions:

- 15 are `lwl`/`lwr` unaligned block moves, one insn after CSE;
- 3 are GTE macro operands, which are inline asm;
- 1 is an aligned 3-byte block move;
- 1 is a false positive from the scan's own label regex;
- 1 is this function.

At nonzero offsets, the same pattern is what ordinary pointer-to-struct code
produces, so a census cannot separate the two. Only a target/candidate
comparison can.

## 4. Tool findings

- **Triage didn't recognise the address form.** On the stuck source it
  pushed a `memset` callee-truth signal, which was a red herring. Its only
  other output was an inventory line: "constant 0x0 target 4 yours 3".
- **The residual searcher could not run on this function.**
  - Its eligibility gate (`tools/agent/variant-lab/manifest.ts:127`) rejects
    every local `extern ... D_XXXXXXXX` as a "generated global".
  - Overlay data has no generated header, so local declarations are the
    norm. 50 of the 62 matched ovl_15 files use them.
  - `sourcePolicy.ts --final` accepts the same source.
- **The gate bypassed: field copies serialize.** With the declarations moved
  into a side header, the searcher derived only 7 candidates: the positions
  of `Title[0] = 0` around a chain of four field copies.
  - `memoryEffectsConflict` (`topological-orders.ts:74`) refuses object
    identity to a base whose web is unknown (`?:d`).
  - A struct local has no value web, so stores to its distinct fields are
    ordered.
  - The correct field order was outside the domain.
- **The address split is not materializable.** Splitting the base into its
  own statement is a general expression materialization, and that stratum is
  suppressed.

`plans/address-form-residuals-and-data-model-search.md` covers all four.

## 5. Transferable rules

1. **Treat a full-address register at the target's access as a data-model
   signal.** The pattern is a target access `k(R)`, where `R` holds the full
   `%lo` address of global `S`, and a candidate `%lo(S+k)(H)`, with no label
   between the address load and the access. Under split addresses, CSE
   rewrites every access it can see as `S`. The target's form means the
   source reached the address as `base+offset` of another object. Look for a
   data label just below `S`, declare the enclosing aggregate, and access it
   as a member of the global.
2. **Change the type, not the spelling, when spellings stop changing the
   output.** If several rewrites of one statement compile to identical
   words, the statement is not the lever; the declared type of the object
   it touches is.
3. **Sweep scheduler inputs once the population is right.** Statement order
   and whether an address is loaded as its own statement are ordinary
   scheduler inputs. Sweep them as a grid instead of guessing one at a time.

The final source keeps its types local, as its ovl_15 siblings do.
`configs/project-profile.md` says aggregate types for data symbols belong in
`include/globals_override.h`. The plan records that disagreement for the
owner to decide.
