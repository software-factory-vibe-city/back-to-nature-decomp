# ADR-0001: Symbol addressing is an assembler-boundary fact

**Date:** 2026-08-08
**Status:** Accepted. The *finding* stands; the **first implementation was
interim and has been replaced.**
`plans/toolchain-native-small-data-addressing.md` landed on 2026-08-08 and
deleted both `tools/build/fixSmallDataExterns.ts` and `configs/tu_externs.txt`. <!-- doc-ref-ignore -->
The addressing decision now comes from the toolchain's own model (§2.4), not
from a project-specific pass and table (§2.1/§2.2, kept below as history).

**Supersedes:** the `-mno-split-addresses` conclusions in
`notes/research/func_80016C08-tu-owned-globals-and-gp-relative-addressing.md`
(sections 12, 15, 19), that note's §4 hypothesis 2 ("remove `--dont-force-G0`"
— falsified, see §2.4), and the two legacy `-fno-schedule-insns` entries that
used to live in `configs/flag_overrides.mk`.

This is a pipeline ADR, not a function write-up. It records how this project
decides *how a global is addressed*, why that decision does not belong in C
declarations or compiler flags, and what generalises to the next game.

---

## 0. State as of 2026-08-08 (read first)

`make check` **passes** — `build/slus_011.bin` matches the original payload —
and the project carries **zero per-file compiler flag overrides**.

The mechanism in the tree today is §2.4: every translation unit carries a
**tentative definition** of each global its function reaches through `$gp`, and
maspsx forces `-G0` on GNU `as` so maspsx alone decides small-data addressing.
83 source files carry such definitions, covering 108 symbols; five of those
files are hand-written `__asm__` blocks and declare their symbols with `.comm`
inside the block rather than in C.

The interim mechanism (§2.1/§2.2) is **gone**: no post-cc1 pass, no ownership
table, and the diagnostic tools no longer restate maspsx flags — they read
`MASPSX_FLAGS` from the `Makefile` like every other flag set.

**Corrected 2026-08-08.** This section used to say to expect
`diffFunc func_80011370` to report 551/557 (98.9%) and not to "fix" the six
reported differences, because they were artifacts of the oracle rather than of
the code. `plans/oracle-and-pipeline-integrity.md` §1 has since landed: the
oracle resolves relocations against the original addresses before comparing, so
those six words are no longer rendered as differences and the tool reports
`VERDICT: MATCH` at 557/557. The header comment of `src/func_80011370.c` still
carries the old caveat and is stale.

The rest of `plans/oracle-and-pipeline-integrity.md` (§2–§4, §6) remains open.

---

## 1. Context

Three mechanisms independently decide whether a global is reached through
`$gp` or through an absolute `lui`/`%lo` pair. They do not agree, and the
project had been absorbing the disagreement in the wrong places.

**cc1** decides whether to *split* a symbolic address from the declared size
alone. `mips_check_split()` (`tools/vendor/gcc/2.95.2/src/gcc/config/mips/mips.c`)
returns "split" only for a `SYMBOL_REF` whose `SYMBOL_REF_FLAG` is clear —
that flag is set for declarations at or below the `-G` threshold. So:

- declared **≤ 8 bytes** → flag set → address left unsplit → cc1 emits the
  assembler macro `lw $6,SYM` plus `.extern SYM, 4`;
- declared **> 8 bytes** → flag clear → cc1 splits into two registers
  (`lui $v0,%hi(SYM)` / `lw $a2,%lo(SYM)($v0)`).

**GNU as** then makes its *own* small-data decision when expanding that macro,
using the `.extern` size and its own `-G`. If it decides small-data it emits
`R_MIPS_GPREL16`; otherwise it expands to the single-register self-clobber
pair `lui $6,%hi(SYM)` / `lw $6,%lo(SYM)($6)`.

**ASPSX**, the assembler the original was built with, does not apply GNU's
rule. This was **measured directly** against period ASPSX 2.77 (psyq4.3, run
under wine) with `-G8`:

| Declaration seen by ASPSX | Expansion |
|---|---|
| `.comm sym,2` | `nop` + `sh $r,%gp_rel(sym)($gp)` — GP-relative |
| `.extern sym,2` | `lui $at` + `sh $r,%lo(sym)($at)` — absolute |
| no declaration | identical to `.extern` |

So ASPSX uses GP-relative addressing **only for symbols the file declares**,
and the declared size is irrelevant to that choice. The binary agrees
independently: the same symbol is addressed both ways in different translation
units (§3.2). Mechanism and observation are both established.

The consequences of the mismatch were being paid in three currencies:

1. **Distorted C declarations.** Globals were declared as `[3]` arrays purely
   to push them past `-G8` and force absolute addressing, e.g.
   `extern struct GfxObj *D_8005E3A8[3];`.
2. **Per-file compiler flags.** `-mno-split-addresses` on `func_80016C08` and
   `func_800165D8`; `-fno-schedule-insns -fno-schedule-insns2` on `SetGfxClip`
   and `SetGfxOffset`.
3. **Hard-register pinning.** `register GfxObj *ptr_ac __asm__("v0");` in
   `SetGfxClip` and `SetGfxOffset`, to force the two halves of a split address
   into one register so it *looked* like the macro form.

All three are per-function, per-game, and transfer to a new project as
nothing. Worse, (2) and (3) are self-reinforcing: once the evidence bar is met
for one function, the next stuck function gets a turn.

There was also a correctness failure hiding underneath. A scalar declaration
of a symbol far from `$gp` produces a relocation the linker rejects:

```
relocation truncated to fit: R_MIPS_GPREL16 against `D_80010098'
```

`D_80010098` sits `0x4E1DC` from `$gp` (`0x8005E274`). The build could not
express the correct code at all — the array over-declaration was not a
matching choice, it was the only thing that linked.

### 1.1 The root cause: a flag that hands the decision back to GNU `as`

Everything above follows from **one project flag**. maspsx already implements
the ASPSX rule, in two deliberate pieces:

- `tools/vendor/maspsx/maspsx.py:158` — `if not args.dont_force_G0: cmd.insert(-1, "-G0")`.
  By default maspsx forces `-G0` on GNU `as`, removing `as`'s ability to make
  any small-data decision. maspsx becomes the sole authority.
- `tools/vendor/maspsx/maspsx/__init__.py:463` — `.extern` lines are skipped
  when scanning for small-data symbols. Only `.comm`, `.lcomm` and
  `.sdata`/`.sbss` *contents* populate `sdata_entries` / `sbss_entries`. That
  is exactly "GP-relative only for in-file declarations".

This project passed `--dont-force-G0`, which hands the decision back to GNU
`as`, which then uses `.extern` sizes — the one input maspsx deliberately
refuses to trust. It was not a maspsx bug: the project disabled maspsx's
correctness mechanism and then wrote a pass to clean up after the rule that
re-enabled.

---

## 2. Decision

**Addressing mode is decided at the assembler boundary, from project facts,
not by bending the C or the compiler invocation.**

Concretely, two rules: §2.3 and §2.4.

### 2.1, 2.2 — withdrawn, deleted in `e32523a`

An interim bridge — a post-cc1 pass that widened `.extern` sizes, plus a table
recording per-TU symbol ownership — stood here until §2.4 replaced it. Both the
pass and the table were deleted on 2026-08-08. **Neither exists; do not look
for them.** Read `git show e32523a` if you need what they did.

The one idea that outlived them: **translation-unit boundaries are facts a
single shared header cannot express.** The mistake was concluding they need a
config file. C states ownership directly — a definition *is* the statement
"this TU owns this object" — which is what §2.4 does.

### 2.3 Treat "the compiler was invoked differently" as a last resort

A per-file compiler flag encodes an unfalsifiable-ish claim about the original
build and does not generalise. Before accepting one, rule out the assembler
boundary. The withdrawal of all four overrides (§3.3) is the precedent.

### 2.4 (CURRENT) Let the toolchain decide, and say ownership in C

**Keep maspsx's forced `-G0` default, and give each translation unit a
tentative definition of every global its function reaches through `$gp`.**

`MASPSX_FLAGS` no longer passes `--dont-force-G0`, so GNU `as` never makes a
small-data decision and maspsx is the only authority — the design §1.1
describes. maspsx's authority comes from `.comm`, so a tentative definition in
the owning file is the whole signal:

```c
u16 D_8005E438;                 /* in the owning .c file          */
extern u16 D_8005E438;          /* in include/globals_override.h  */
```

Under `-fcommon` (already in `CC1FLAGS`) cc1 emits `.comm D_8005E438,2`;
maspsx records it in `sbss_entries` and emits `%gp_rel(...)($gp)` itself. A
file with only an `extern` gets absolute addressing, which is what a
non-owning TU wants.

**It costs nothing at link time.** splat's extracted `.sdata` already defines
the symbol at its fixed address, and a real definition overrides a COMMON. No
splat change, no linker-script change, no layout change, no duplicate storage.

Three constraints, each of which cost a measurement:

1. **`-G8` must stay in `ASFLAGS`.** maspsx parses `-G<n>` from the assembler
   arguments to set `sdata_limit` and *then* forces `-G0` on `as` itself.
   Removing `-G8` silently sets the limit to 0, every `.comm` lands in
   `bss_entries` instead of `sbss_entries`, and the mechanism looks broken.
2. **`--aspsx-version` must be ≥ 2.80.** maspsx gates GP-relative expansion of
   the `la` macro on that version, and this binary uses it (§3.5).
3. **Hand-written `__asm__` blocks declare their own symbols.** Five files
   reach globals from inline assembly; they use `.comm SYM,n` in the block
   (`.extern` there means absolute). Write it with no space after the comma —
   maspsx's parser splits on whitespace and a space makes it throw.

Ownership is **derived, not maintained**: `tools/build/deriveTuOwnedGlobals.ts`
reads every `$gp`-based load, store and address computation out of the
original bytes and reports which globals each function's TU owns. It works for
functions that are still assembly, and `--check` cross-checks it against the
compiled objects' `R_MIPS_GPREL16` relocations in both directions — a symbol
the original reaches through `$gp` but the object addresses absolutely is a
missing tentative definition, which is exactly the failure the bridge used to
mask.

---

## 3. Evidence

### 3.1 Split addresses were on — the delay-slot argument

The `-mno-split-addresses` override on `func_80011370` had been justified by a
real fingerprint: 21 `lui $a2,%hi(D_80010098)` / `lw $a2,%lo(D_80010098)($a2)`
self-clobber pairs. The fingerprint was real; the conclusion was wrong.

In the target, `lui`/`%lo` halves occupy **two different delay slots**:

| Address | Instruction |
|---|---|
| `0x8001143C` | `lui $s0,%hi(D_8005E5E8)` — delay slot of `jal func_8001FCE4` |
| `0x80011444` | `addiu $s0,$s0,%lo(D_8005E5E8)` — delay slot of `jal func_8001FEA4` |
| `0x800116B0` | `lui $v0,%hi(jtbl_80010008)` — delay slot of a `beqz` |
| `0x8001189C` | `sw $zero,%lo(D_80070CC4)($v1)` — delay slot of a `j`, its `lui` five instructions earlier |

**A single assembler macro cannot straddle a delay slot.** Those halves are
therefore separate RTL insns, so split addresses were on. Removing the
override moved exact-index matches from 63/566 to 224/557.

Generalise this: *a `lui`/`%lo` pair split across a delay slot falsifies any
"unsplit macro" hypothesis in one step.* A fingerprint tells you something
differs, not what.

### 3.2 The same symbol is addressed both ways — ownership is real

Surveying the archived target assembly for symbols accessed both
GP-relative and absolute returns six, all in one cluster:

```
D_8005E3A4  D_8005E3A8  D_8005E3AC  D_8005E3B0  D_8005E3B4  D_8005E3C0
```

The split is not random. Every GP-relative consumer lives in
`0x80011370`–`0x800128DC` (`func_80011370`, `func_80011C24`, `func_80011DB0`,
`func_80011F5C`, `func_80011FD8`, `func_8001202C`, `func_80012098`,
`func_800120C8`, `func_800121D4`, `func_8001231C`, `func_80012598`,
`func_800128DC`) — one contiguous translation unit. Every absolute consumer is
outside it. `SetGfxClip`'s target reads `D_8005E3AC` as
`lui $v0,0x8006` / `lw $v0,-7252($v0)` while `func_80011370` writes the same
symbol as `sw $v0,%gp_rel(D_8005E3A8)($gp)`.

Same symbol, two addressing modes, decided by which file you are in. That is
proof the property is per-TU, independent of any hypothesis about ASPSX.

### 3.3 What the decision let us delete

| Removed | Where |
|---|---|
| `-mno-split-addresses` × 2 | `func_80016C08`, `func_800165D8` |
| `-fno-schedule-insns -fno-schedule-insns2` × 2 | `SetGfxClip`, `SetGfxOffset` |
| `register __asm__` pins × 4 | `SetGfxClip`, `SetGfxOffset` |
| `[3]` array over-declarations | `D_8005E3A8`, `D_8005E3AC` (and `D_80010098`, `D_8001009C` never needed one) |
| allowlist entries | 7 → 4; all four survivors are asm-policy, not flags |

`configs/flag_overrides.mk` now defines nothing. `make check` passes.

The two `-mno-split-addresses` entries are the clearest case: they existed to
force the unsplit macro for `D_8005E3C0`, but that symbol is a 4-byte scalar,
so cc1 *already* left it unsplit. The pair was being broken by GNU as
resolving it GP-relatively, because the sprite-renderer TU does not own it.
The flag was compensating for the wrong stage.

### 3.4 Verification

`func_80011370` is byte-exact: 557/557 words, confirmed by `make check`
against the original payload. `SetGfxClip` and `SetGfxOffset` are 9/9 each.
All three still verify after §2.4 replaced the mechanism.

### 3.5 The toolchain-native route, measured

Two symbols from one file, assembled through maspsx with its forced `-G0`
default (and `-G8` still in `ASFLAGS`, so maspsx sets its own `sdata_limit`):

| Symbol | In-file declaration? | Result |
|---|---|---|
| `D_8005E438` | yes (`.comm`) | `R_MIPS_GPREL16` |
| `D_8005E3C0` | no (extern only) | `R_MIPS_HI16` / `R_MIPS_LO16` |

Both are what the target does. That is the whole of §2.1 and §2.2's behaviour,
produced by the toolchain, with no pass and no ownership table.

**The assembler used `$gp` for `la`.** Four compiled functions —
`func_80013B04`, `func_8001B258`, `func_8001B4D0`, `func_8001B4E4` — reach a
global through `addiu $r,$gp,<gprel>` in the original bytes. cc1 emits `la
$r,SYM` there, so the *assembler* GP-relativised an address materialisation,
not just a load or a store. maspsx models that as ASPSX ≥ 2.80 behaviour
(`gp_allow_la`), and it is the only behaviour that differs between its 2.77 and
2.80 profiles, so `MASPSX_FLAGS` now says `--aspsx-version 2.80`. Bumping the
version alone, with the old addressing still in place, rebuilt every object
byte-identically — so the bump is a refinement of the version bound, not a
change of build.

This sharpens what was known: `notes/toolchain-version-detection.md` had
pinned ASPSX only to "≥ 2.70" by the `li` and `sltu` signals and picked 2.77
inside that class. GP-for-`la` is a sharper signal from the same binary.

---

## 4. Alternatives rejected

Everything in this section is rejected. Nothing here is a fallback to reach
for when §2.4 seems not to work.

**Global `-G0` for the assembler.** Not rejected after all — §2.4 is this, and
the original rejection was wrong. It was rejected on the belief that `-G0`
breaks every legitimate GP-relative access. It does, for GNU `as`. But maspsx
forces `-G0` on `as` precisely so that maspsx, which models ASPSX's per-TU
rule, decides instead. The reusable part is the reasoning failure: *a flag was
judged by what one tool in the pipeline would do with it, without checking
which tool the pipeline had put in charge.*

**Over-declaring globals as arrays.** It links, but it forces the two-register
split form, which is not what these targets use, and it lies about the type in
a shared header. Reintroducing one is the standing way to break a function that
was matching — see §4.1.

**Source-level web shaping to recover the self-clobber pair.** Proven
unreachable, not merely difficult. `local-alloc.c`'s `combine_regs()` records a
register suggestion only for register-to-register copies; the load is
`(set (reg a2) (mem (lo_sum (reg 117) sym)))`, so the HIGH temp can never be
suggested `$a2`, and `REG_ALLOC_ORDER` is plain ascending so it takes `$v0`. A
named-temp variant was tried and changed nothing. *Read the pass that decides
the thing before designing another source shape.*

**This does not mean a missing self-clobber pair is unfixable — see §4.1.**
It means you cannot reach one by reshaping the C. Whether you need to is
decided earlier, by the declaration.

### 4.1 When the target has a self-clobber pair and you emit a split one

Check the declaration before concluding anything about allocation. Under §2.4
the two decisions are separate, and only one of them is yours:

| Question | Decided by |
|---|---|
| GP-relative or absolute? | whether **this TU defines** the symbol — size is irrelevant |
| unsplit macro (self-clobber) or split pair? | the **declared size** against `-G8` |

So a symbol declared `<= 8` bytes and *not* defined in the file gets exactly
the absolute single-register `lui $r,%hi(sym)` / `lw $r,%lo(sym)($r)` the
targets here use. Widening it past the threshold — an `[3]` array, say — buys
nothing, because absolute addressing never depended on the size, and costs the
match, because cc1 then splits the address across two registers and §4's
unreachability result applies to the result.

Pre-2026-08-08 comments claim size controls the addressing mode. It did, under
the withdrawn §2.1/§2.2 bridge. It does not now.

**Patching vendored maspsx.** Rejected, and still rejected under §2.4: maspsx
already implements the rule, so nothing needed patching once it was allowed to.

---

## 5. Consequences

**Good.** Addressing is decided by the toolchain from an ordinary C
definition. The workaround classes that do not transfer between games (flags,
pins, distorted declarations, an ownership table) are gone, along with the
custom pass. A genuine build defect (unlinkable `R_MIPS_GPREL16`) is fixed
rather than routed around: under forced `-G0`, an out-of-window symbol simply
gets absolute addressing and needs no entry anywhere.

**Cost.** 83 source files carry a small block of tentative definitions, and a
function that is decompiled later has to gain its own — silently addressing a
symbol absolutely is the failure mode. `deriveTuOwnedGlobals.ts --check`
detects exactly that, in both directions, and `make check` is the final word.

One benign linker warning remains, and it belongs to GNU `as`, not to the
declaration: cc1 emits a two-argument `.comm D_8005E2A4,8` (MIPS has no
aligned form), `as` guesses the alignment as the largest power of two dividing
the size, and 8 exceeds the 4-byte alignment of the extracted definition. ld
warns and then uses the real definition; the output is byte-identical. Recorded
in `src/func_80013B04.c`, where the definition lives.

**Risk closed.** The pipeline had to run identically in the build and in every
diagnostic tool. `decompToolchain`, `diffFunc` and `flagProbe` now read
`MASPSX_FLAGS` from the `Makefile` instead of restating it, and
`toolchain-parity.test.ts` fails if a tool spells out a maspsx flag again —
the same discipline commit `a4d6e78` established for the compiler flags.

---

## 6. Portability checklist for the next game

The mechanism ports; the data does not, and there is no data to port. On a new
project:

1. **Keep maspsx's `--force-G0` default.** Do not pass `--dont-force-G0`; keep
   `-G<n>` in `ASFLAGS` so maspsx can read its own small-data limit.
2. **Define TU-owned globals in their owning TU.** Derive which those are from
   the target with `tools/build/deriveTuOwnedGlobals.ts`, which needs only
   `splat.yaml` (`gp_value` plus function subsegments) and the extracted data
   labels. There is no config file to populate.
3. **Check `--aspsx-version` against the binary's own behaviour.** If any
   function reaches a global through `addiu $r,$gp,...`, the assembler
   GP-relativised `la` and maspsx needs a version of 2.80 or later.
4. Expect the same three temptations — array over-declaration, per-file flags,
   register pins — and check the assembler boundary first.
5. Keep the delay-slot test (§3.1) in reach: it falsifies unsplit-macro
   hypotheses in one step.
