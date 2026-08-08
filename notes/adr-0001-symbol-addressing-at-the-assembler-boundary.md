# ADR-0001: Symbol addressing is an assembler-boundary fact

**Date:** 2026-08-08
**Status:** Accepted and implemented, but **the implementation is interim.**
`plans/toolchain-native-small-data-addressing.md` shows the same behaviour is
obtainable from maspsx directly (keep its `--force-G0` default; define
TU-owned globals in their owning TU), which deletes both
`tools/build/fixSmallDataExterns.ts` and `configs/tu_externs.txt`. The root
cause is this project passing `--dont-force-G0`, which re-enables a GNU `as`
small-data rule that ASPSX does not have. Sections 3.1-3.3 (the delay-slot
falsification test, the per-TU addressing evidence, and what was deleted)
stand regardless of implementation. Amend this ADR per that plan's §7 once it
lands.

**Original status:** Accepted and implemented. `make check` passes with the changes in
place; the project now carries **zero per-file compiler flag overrides**.
**Supersedes:** the `-mno-split-addresses` conclusions in
`notes/research/func_80016C08-tu-owned-globals-and-gp-relative-addressing.md`
(sections 12, 15, 19) and the two legacy `-fno-schedule-insns` entries that
used to live in `configs/flag_overrides.mk`.

This is a pipeline ADR, not a function write-up. It records how this project
decides *how a global is addressed*, why that decision does not belong in C
declarations or compiler flags, and what generalises to the next game.

---

## 0. State as of 2026-08-08 (read first)

**All of this work is uncommitted.** A fresh clone does not have it; a fresh
agent in this working tree is looking at a dirty state that is nonetheless
green.

- `make check` **passes** — `build/slus_011.bin` matches the original payload.
- New, untracked: `tools/build/fixSmallDataExterns.ts`,
  `configs/tu_externs.txt`, this ADR, and the two plans in `plans/`.
- Modified by this work: `Makefile` (one pipeline step),
  `configs/flag_overrides.mk` (now defines nothing), `.pi/autodecomp.json`
  (allowlist 7 -> 4), `.gitignore`, `src/func_80011370.c`, `src/SetGfxClip.c`,
  `src/SetGfxOffset.c`, `tools/agent/decompToolchain.ts`,
  `tools/agent/diffFunc.ts`, `notes/file-groupings.md`, and the superseding
  banner on `notes/research/func_80016C08-...md`.
- Modified by an earlier session, not by this work: `configs/splat.yaml`,
  `include/functions.h`, `include/functions.h.m2c`,
  `include/globals_override.h`.

**Expect `diffFunc func_80011370` to report 551/557 (98.9%).** That function is
byte-exact; the six reported differences are artifacts of the oracle, not of
the code. Do not "fix" them — see
`plans/oracle-and-pipeline-integrity.md` §1. The same caveat is recorded in the
header comment of `src/func_80011370.c`.

Two follow-on plans exist:

- `plans/toolchain-native-small-data-addressing.md` — removes the interim
  mechanism this ADR introduced, and amends this ADR (its §7).
- `plans/oracle-and-pipeline-integrity.md` — rebuilds the per-function diff and
  fixes the pipeline-integrity gaps found alongside this work.

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

---

## 2. Decision

**Addressing mode is decided at the assembler boundary, from project facts,
not by bending the C or the compiler invocation.**

Concretely, three rules.

### 2.1 Correct the assembler's small-data decision in the pipeline

`tools/build/fixSmallDataExterns.ts` runs between cc1 and maspsx. For each
`.extern SYM, <size>` small enough to trigger GNU as's small-data path, it
widens the recorded size past the threshold when the symbol **cannot be
GP-addressed** — i.e. its address lies outside `[$gp - 0x8000, $gp + 0x8000)`.
cc1 has already made its own decision by then, so the macro form survives and
the assembler expands it absolutely.

Every input is read from project configuration:

| Input | Source |
|---|---|
| `$gp` | `gp_value` in `configs/splat.yaml` |
| `-G` threshold | `-G<n>` parsed from `ASFLAGS` in the `Makefile` |
| symbol addresses | `configs/symbol_addrs.txt`, falling back to the address encoded in generated `D_xxxxxxxx` / `jtbl_xxxxxxxx` names |

Nothing about this game is hardcoded. The pass is **conservative**: a symbol
whose address cannot be established is left untouched, per the project's
"report only what you prove" rule.

### 2.2 Record per-TU symbol ownership declaratively

Being inside the `$gp` window is necessary but not sufficient. `configs/tu_externs.txt`
records, per source stem, the in-window symbols that stem does **not** own:

```
SetGfxClip   = D_8005E3A8 D_8005E3AC
SetGfxOffset = D_8005E3A8 D_8005E3AC
func_800165D8 = D_8005E3C0
func_80016C08 = D_8005E3C0
```

Those symbols get the same `.extern` widening, so they are addressed
absolutely in those files and GP-relative in the file that owns them. Each
entry carries its evidence in a comment.

This is the general shape of a recurring problem: **facts about the original
translation-unit boundaries that a single shared header cannot express.** A
declarative table is the right home for them because it is data, it is
reviewable, it carries its own evidence, and it starts empty on a new project.

### 2.3 Treat "the compiler was invoked differently" as a last resort

A per-file compiler flag encodes an unfalsifiable-ish claim about the original
build and does not generalise. Before accepting one, rule out the assembler
boundary. The withdrawal of all four overrides (§3.3) is the precedent.

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

---

## 4. Alternatives rejected

**Global `-G0` for the assembler.** Fixes the out-of-window symbols but breaks
every legitimate GP-relative access, because the correct answer is per-symbol
and per-TU, not global.

**Over-declaring globals as arrays.** The status quo. It links, but it forces
the two-register split form, which is not what the target uses, and it lies
about the type in a shared header — which is what broke `SetGfxClip` and
`SetGfxOffset` when the declaration was later corrected for `func_80011370`.

**Source-level web shaping to recover the self-clobber pair.** Proven
unreachable, not merely difficult. `local-alloc.c`'s `combine_regs()` records a
register suggestion only for register-to-register copies; the load is
`(set (reg a2) (mem (lo_sum (reg 117) sym)))`, so the HIGH temp can never be
suggested `$a2`, and `REG_ALLOC_ORDER` is plain ascending so it takes `$v0`. A
named-temp variant was tried and changed nothing. *Read the pass that decides
the thing before designing another source shape.*

**Patching vendored maspsx.** Rejected: the correction is expressible as a
pre-pass, and project policy keeps tooling in TypeScript.

---

## 5. Consequences

**Good.** Addressing decisions are now data, in two config files, each entry
carrying its evidence. The workaround classes that do not transfer between
games (flags, pins, distorted declarations) are gone. A genuine build defect
(unlinkable `R_MIPS_GPREL16`) is fixed rather than routed around.

**Cost.** Two new pipeline inputs to keep correct, and `tu_externs.txt` needs
an entry for every not-yet-decompiled function that addresses an in-window
symbol it does not own. From §3.2 that is 40+ functions — see
`plans/oracle-and-pipeline-integrity.md` §5 for auto-deriving these from the
disassembly instead of by hand.

**Risk.** The pass must run identically in the build and in every diagnostic
tool, or measurements stop describing the build. It is wired into the Makefile
and into `decompToolchain`/`diffFunc`; **`flagProbe` still has its own cc1
pipeline and was not updated** (plan §2).

---

## 6. Portability checklist for the next game

The mechanism ports; the data does not. On a new project:

1. `fixSmallDataExterns.ts` works unchanged once `splat.yaml` has `gp_value`,
   `ASFLAGS` has `-G<n>`, and `symbol_addrs.txt` exists.
2. `configs/tu_externs.txt` starts **empty**. Populate it from the target's
   own addressing (§3.2 method: survey `%hi(SYM)` vs `%gp_rel(SYM)` across the
   archived assembly; symbols appearing both ways are TU-owned).
3. Expect the same three temptations — array over-declaration, per-file flags,
   register pins — and check the assembler boundary first.
4. Keep the delay-slot test (§3.1) in reach: it falsifies unsplit-macro
   hypotheses in one step.
