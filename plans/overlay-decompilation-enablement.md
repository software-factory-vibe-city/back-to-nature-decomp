# Plan: enable overlay decompilation

**Status: proposed.** Written 2026-08-16; revised twice the same day as
measurement accumulated. Origin: a scope discovery made while scoping
`plans/static-recompilation.md` — `extracted/iso/a_file.bin` contains overlay
executables holding roughly five times as much game code as the PS-X EXE this
project has been decompiling.

Scope is the **decompilation** pipeline only. The static recompiler is a
separate direction planned in `plans/static-recompilation.md`; Deliverable 3
is shared with it and should be built once, here.

## Purpose

Make overlay code a first-class decompilation target: extractable,
addressable, buildable, and measurable by the same oracle and residual
machinery already used on the PS-X EXE.

Nothing in the *matching* pipeline needs to change — same `cc1`, same maspsx,
same flags, same `diffFunc`, same triage detectors. What is missing is
everything that assumes **one binary, one address space, one symbol map**.
That assumption is load-bearing in `tools/lib/`, `configs/symbol_addrs.txt`,
`configs/splat.yaml`, the linker script, `make check`, the fifteen-step
`make split` chain, and — as Deliverable 2 shows — in the liveness
classification that drives both the progress metric and the work queue today.

## Definition of done

The plan is complete when, from a clean checkout:

```
make setup          # submodules, unchanged
make disassemble    # EXE and all 13 code members
make split          # asm stubs for every function in every container
make                # builds every container
make check          # 14 SHA-256 comparisons, all pass
make config-check   # no tracked-file drift across any container
make progress       # per-container and total, on corrected liveness
```

and a single overlay function can be taken from stub to matching C through the
documented agent workflow without the operator needing to know which container
it is in.

Every code member is in the project's target. This plan does not decide how
much of it gets decompiled; it removes every reason that work cannot begin.

---

# Measured facts

All measured 2026-08-16 against `extracted/iso/`. Recorded so the plan is
self-contained; nothing below re-derives them.

## The container

**`a_file.hdt` is a 33-entry little-endian u32 offset table.** Every entry is
2048-byte (one CD sector) aligned and strictly monotonic; the final entry,
`0x07FBB000`, equals `a_file.bin`'s size exactly (133,935,104 B). It is a
trailing-sentinel index — `entry[i]`..`entry[i+1]` delimits member *i* —
giving **32 members**. No names, no sizes, no type field: table position is
the member ID.

**13 members contain MIPS code**, classified by `jr ra` (`08 00 e0 03`)
density. Separation is absolute — every data member scored exactly 0.000.
Members: 8, 10, 11, 15, 17, 19, 21, 23, 25, 27, 28, 30, 31.

**Member #28 is confirmed MIPS**, disassembling from a 4-byte tag prefix into
a textbook GCC 2.95.2 prologue, calling `0x80017A64` and `0x80017A48` in the
PS-X EXE and dispatching indirectly through a table (`lw v1,0(v0); jalr v1`).

**Members pair code with data.** From #14 onward the sequence alternates. Data
partners open with a count followed by absolute pointers into overlay address
space.

**The leading u32 on a code member is a sequential overlay ID.** Across the 13
code members the values are 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16 —
thirteen consecutive integers, one per member, no repeats, ascending with
member index (#8=4, #10=5, #11=6, #17=7, #19=8, #21=9, #23=10, #25=11, #27=12,
#28=13, #31=14, #30=15, #15=16). IDs 0–3 are unaccounted for. **Caveat:** six
data members also carry `0x0E`, colliding with code member #31's value, so the
field is not uniformly an ID across all member kinds. Strong evidence, not yet
a finding.

Other members' leading words identify their formats directly: #9 is
`0x56414270` = `VABp`; #0, #1 and #7 share a low half of `0x100D` with a count
in the high half (10, 2, 3 respectively); #2–#5 open `0xFFFFFFFF`.

## Code provenance — who wrote what

The executable holds only **186 strings** in 323 KB, and nearly all are PSY-Q
library diagnostics. This makes provenance unusually easy to establish.

**Sony's code**, identified by RCS `$Id:` strings naming its authors:

```
$Id: intr.c,v 1.75  1997/02/07  makoto Exp $        libapi
$Id: bios.c,v 1.86  1997/03/28  makoto Exp yos $    libcd
$Id: sys.c,v 1.140  1998/01/12  noda   Exp yos $    libgpu
Library Programs (c) 1993-1997 Sony Computer Entertainment Inc.
```

555 named symbols, 142,252 B, linked from vendored libraries and never
decompiled. Correctly out of scope.

**The developer's code**, identified by its own strings — the complete set:

```
\A_FILE.HDT;1   \A_FILE.BIN;1   \STR\01..04.XA;1   ANI INIT ERROR

objcg\gf.bin         objcg\face.bin      objcg\messege0..4.bin
data\font\Font_all.tex                   obj\DEBUG.bin
objcg\sound.stm      obj\PdaSamp.bin     obj\GF_FARM.bin
objcg\event_s.bin    objcg\evch.bin      ObjCg\Status.Bin
Obj\saveload.bin     ObjCg\Slp.Bin       ObjCg\MesEv.Bin
Obj\GF_MG1.Bin … GF_MG5.Bin  /  ObjCg\MG1.Bin … MG5.Bin
Obj\GF_TITLE.Bin     Obj\GF_STAFF.Bin
Obj\GF_swind.bin     Obj\gf_mcard.bin
```

Windows backslash paths from the build tree, with casing drifting between
`objcg\`, `ObjCg\`, and `Obj\`. `messege` is the developer's transliteration.

**These are the overlay names.** `Obj\GF_*.Bin` is code, `ObjCg\*.Bin` is the
paired graphics — which matches the code/data member pairing exactly. Roughly
thirteen `GF_` entries against thirteen code members: five mini-games, title,
staff roll, farm, saveload, status, memory card, message events, `swind`,
`PdaSamp`, and a `DEBUG` overlay. Deliverable 10 exploits this.

**What this means for the decompilation.** The PS-X EXE's game code and all
thirteen overlays are Victor Interactive's own work. What is being recovered
is GCC 2.95.2 `-O2` output, so the *shape* of that source is recoverable but
comments, macro names, variable names, and file boundaries are not —
`notes/file-groupings.md` is an ongoing reconstruction of the last of those.

## Scope — corrected

The PS-X EXE's `.text` is **63.6% PSY-Q SDK linked from vendored libraries and
never decompiled.** The decompilation target is the other portion:

| body | funcs | bytes | `jr ra` |
|---|---|---|---|
| PS-X EXE game code (the actual target) | 484 | 82,804 | 522 |
| PS-X EXE SDK (linked, not decompiled) | 555 | 142,252 | 610 |
| Overlay code members | ? | 868,352 | 2,569 |

**Overlay:EXE-game ratio is 4.9× by return count, 10.5× by bytes.** Trust the
return count: overlay members carry embedded data (3.0 returns/KB against 6.3
for EXE game code), so roughly half that 868 KB is not code, which reconciles
the two figures at about 5×. The PS-X EXE's game code is therefore **~17% of
the project's true target**, and a headline figure that omits overlays
overstates completion by roughly a factor of six.

**Overlay code shares nothing with the EXE.** Over 64-byte non-padding blocks:
0.2% are shared between overlay members, and **0 of 10,748** appear anywhere in
the PS-X EXE `.text`. No deduplication discount, and no SDK code in the
overlays — they call the EXE's copy.

## Liveness is misclassified today

`tools/diagnostics/progress.ts:157` computes `dead` as *not referenced from any
address within the PS-X EXE*. It has no visibility into overlays.

| PS-X EXE game functions | count |
|---|---|
| referenced within the EXE | 267 |
| unreferenced within the EXE | 217 |
| → **of those, called by overlays** | **93** |
| → genuinely unreferenced anywhere | 124 |

**93 functions classified as dead are the overlay-facing engine API**, and are
excluded from the progress denominator. `GetVal8005E5B4` takes 123 overlay
calls; `func_8001AC10` 79; `func_80015BF0` 35; `func_800132F0` 34;
`func_80011EF0` 33 — most of the top of that list are stubs.

Two independent problems follow. The metric is computed over a denominator
missing 93 live functions. And those functions are invisible to prioritization
while being exactly the ones overlay translation units cannot compile without.

The unreferenced-within-EXE set is also **interleaved with live code
throughout the game region** (61 / 95 / 51 across the first three 32 KB
buckets), not clustered where statically-linked library objects would sit —
so `README.md`'s characterization of dead functions as "unused code from the
PSY-Q libraries" does not survive the measurement either.

## The two bodies are different in kind

Instruction mix, sampled identically for both (256 B before each `jr ra`,
trailing return excluded):

| class | EXE game | EXE SDK | Overlays |
|---|---|---|---|
| **COP2 / GTE** | **0.89%** | 0.93% | **0.03%** |
| store | **15.51%** | 12.13% | 10.15% |
| branch | 5.25% | 5.56% | **8.10%** |
| `j` | 1.25% | 2.05% | **2.76%** |
| alu-imm | 19.05% | 16.30% | **23.81%** |
| jal | 4.75% | 3.90% | **5.58%** |
| shift | **6.55%** | 5.30% | 5.04% |
| muldiv | **0.50%** | 0.34% | 0.20% |
| lui | 2.79% | **10.19%** | 4.77% |
| load | 17.70% | 16.92% | 16.69% |

**EXE game code is throughput code**: 30× the GTE work, 50% more stores, more
shifts and multiplies. Vertex projection, GPU packet building, ordering table
insertion, fixed-point scaling — a loop producing bytes for hardware.

**Overlay code is decision code**: 54% more branches, 2.2× the unconditional
jumps, 25% more immediate manipulation, more calls, and effectively no
arithmetic. Read state, compare against an ID table, branch, call the engine.

**No overlay does 3D math.** 0.03% is not "less" — it is none. Every geometry
operation happens in permanently resident code.

**Consequence for the work.** The difficulty profile inverts. Arithmetic- and
store-dense code with high register pressure is what produces allocator swaps,
web-parity failures, and scheduler variance — the content of thirty files in
`notes/research/`. Branch-and-call code has far fewer codegen degrees of
freedom; m2c reconstructs control flow well and `jump2` rewrites leave
syntactic witnesses. Per function, overlay code should be materially easier.
The bottleneck shifts from allocator research to **type and struct recovery** —
item IDs, event enums, NPC records, save-state layouts — where volume helps,
because the same structures recur across every overlay.

## The engine API

Union of PS-X EXE entry points called from overlays: **246**. Called by 8 or
more of the 13 members: **22**. Per member:

| member | size | EXE targets | EXE call sites | self-call buckets |
|---|---|---|---|---|
| 11 | 483,328 | 178 | 2,189 | `0x800C`–`0x8011` |
| 15 | 98,304 | 54 | 283 | `0x8012`, `0x8013` |
| 27 | 57,344 | 48 | 177 | `0x800B` |
| 21 | 36,864 | 56 | 183 | `0x800B` |
| 25 | 34,816 | 58 | 163 | `0x800B` |
| 23 | 34,816 | 42 | 128 | `0x800B` |
| 19 | 32,768 | 59 | 171 | `0x800B` |
| 30 | 28,672 | 34 | 123 | `0x8012`, `0x8013` |
| 17 | 26,624 | 44 | 147 | `0x800B` |
| 10 | 16,384 | 33 | 144 | `0x800B` |
| 28 | 12,288 | 35 | 58 | `0x800B` |
| 31 | 4,096 | 11 | 43 | `0x800B` |
| 8 | 2,048 | 12 | 16 | none |

Hottest entry points, with current status:

| address | symbol | call sites | members | status |
|---|---|---|---|---|
| `0x8001FABC` | `func_8001FABC` | 274 | 9/13 | C |
| `0x8002261C` | `func_8002261C` | 234 | 7/13 | C |
| `0x8001AF44` | `func_8001AF44` | 219 | 2/13 | C |
| `0x8001AF70` | `func_8001AF70` | 186 | 2/13 | C |
| `0x80012A34` | `Rand` | 164 | 10/13 | C |
| `0x80039D9C` | `FntPrint` | 150 | 5/13 | SDK |
| `0x80022738` | `func_80022738` | 141 | 6/13 | C |
| `0x80015840` | `func_80015840` | 128 | 8/13 | C |
| `0x800226A4` | `GetVal8005E5B4` | 123 | 7/13 | C *(classified dead)* |
| **`0x80017B3C`** | `func_80017B3C` | **102** | 5/13 | **STUB** |
| `0x80013394` | `func_80013394` | 85 | 11/13 | C |
| `0x80015EE8` | `func_80015EE8` | 85 | 9/13 | C |
| **`0x8001AC10`** | `func_8001AC10` | **79** | 4/13 | **STUB** *(classified dead)* |
| `0x80015704` | `func_80015704` | 70 | 9/13 | C |

Thirteen of the top fifteen are matched. The two stubs — `func_80017B3C` and
`func_8001AC10` — outrank most of the remaining PS-X EXE tail on downstream
leverage, because overlay translation units cannot be compiled without correct
declarations for what they call, and
`project_undeclared_callee_v0_poisoning` records the cost of getting a callee
declaration wrong. `func_8001AC10` is currently invisible to prioritization
because it is classified dead.

## Slot evidence

Bucketing out-of-EXE `jal` targets by 64 KB:

```
0x800B0000  963   <- members 10,17,19,21,23,25,27,28,31 (the small overlays)
0x800C0000  628 \
0x800D0000  905  |
0x800E0000  478  |- member 11 only, contiguous ~384 KB span
0x800F0000  616  |
0x80100000  343  |
0x80110000  603 /
0x80120000   72 \_ members 15, 30
0x80130000  240 /
```

**Member #11 is one very large overlay, not several** — its self-references
form a single contiguous range consistent with its 483 KB size. Nine small
members (4–57 KB) share a slot near `0x800B0000`. Members #15 and #30 target a
distinct region near `0x8012`–`0x8013`.

Working hypothesis: **two slots** — a large one holding either #11 or one small
overlay, and a smaller one above it holding #15 or #30. Evidence, not a
finding. Deliverable 3 settles it.

## The RAM map, and what both containers share

Reconstructing `lui`+immediate pairs and bucketing the resolved addresses by
64 KB gives the runtime memory picture. **This is the largest gap the earlier
revisions of this plan missed.**

| region | EXE sites | overlay sites | reading |
|---|---|---|---|
| `0x80010000`–`0x8005E7FF` | 3,898 | 1,725 | the PS-X EXE image itself |
| **`0x8005E800`–`0x800AFFFF`** | **5,760** | **10,879** | **shared BSS / heap** |
| `0x800B0000`–`0x8013FFFF` | 1,321 | 15,190 | overlay slots |
| `0x801B0000` | 192 | — | high buffer, below the `0x801FFFF0` stack |

Three consequences, none of them previously in this plan:

**A shared mutable state region exists that neither container owns in any
file.** `0x8005E800`–`0x800AFFFF` sits past the end of the PS-X EXE's loaded
image and below the overlay slots. Both bodies hammer it — 16,639 reference
sites combined, more than either container's references to its own image. This
is the game's global state: object pools, NPC records, save data, flags. It is
where overlay type recovery will actually live, and it belongs to no single
translation unit.

**The coupling is bidirectional at the data level, not just through calls.**
The EXE resolves 1,321 addresses into overlay slot space. It does not merely
`jalr` into overlays — it reads and writes their memory, which implies a shared
structure at a known offset in the slot that both sides agree on.

**Overlays reference 251 distinct PS-X EXE `.data`/`.sdata` globals** across
1,725 sites (and only 5 `.text` addresses outside `jal`, which is negligible).
Every one of those globals needs a correct type visible to overlay translation
units, so `globals_override.h` becomes shared context rather than EXE-local.

## Scheduling structure

**There are no cross-overlay calls.** Each member's out-of-EXE `jal` targets
land only in its own slot, and slot-mates are mutually exclusive in RAM by
definition, so those targets must be self-calls. Combined with the 0.2%
inter-member block sharing, this means **the thirteen overlays are mutually
independent**: once the engine API is matched, they can be worked in any order,
by any number of workers, with no dependency graph between them.

The dependency structure of the whole project is therefore two-phase, not flat:

1. **The engine API is the frontier.** No overlay translation unit compiles
   without correct declarations for the 246 entry points, and
   `project_undeclared_callee_v0_poisoning` records the cost of a wrong callee
   declaration. This surface must be finished first.
2. **Then thirteen independent bodies of work**, each internally ordered by the
   existing bottom-up tier/depth strategy.

This is a materially better parallelism story than the PS-X EXE ever offered,
and it argues for a container-scoping filter in the scheduler rather than a
global interleave across containers.

## Function count

**1,686 stack-frame prologues** (`addiu sp,sp,-N`) across the overlay code
members, against 2,569 `jr ra`. Leaf functions with no frame have no prologue,
so the true function count sits between those bounds. The 4.9× scope ratio
above is computed from `jr ra` on both sides and is unaffected.

## Two scan defects to design around

**The `jal` scan has a false-positive floor.** 40 call sites target
`0x8FF4xxxx`, and others `0x8C1D`, `0x8D3F`, `0x8EC0`, `0x8F58`, `0x8F6C` —
none valid PS1 RAM (`0x80000000`–`0x80200000`). Embedded data words whose top
six bits happen to be opcode 3. Roughly 1% globally, concentrated in the small
members. Any tool consuming `jal` targets must range-check first.

**Member #8 is probably misclassified.** 2,048 B, 16 EXE calls, zero
self-calls, opening with a count then absolute pointers (`04 00 00 00`, then
`0x800B8054`, `0x800B80FC`, `0x800B8134`). That is a function-pointer table,
not a code overlay. Deliverable 5 must be able to reach that verdict.

## Not measured — do not assume

- **Load addresses.** The slot buckets are evidence, not answers. A trial
  disassembly of member #11 based at `0x800B0000` produced a `lui` histogram
  dominated by `0x8012`/`0x8013`, which that base does not explain.
- Whether the slot model is two slots, three, or dynamic.
- The code/data boundary *within* a member.
- Whether the leading u32 is uniformly an overlay ID, given the `0x0E`
  collision between code member #31 and six data members; and what IDs 0–3 are.
- Whether the loader strips the leading u32 or loads the member whole — this
  decides whether the solved base applies at member offset 0 or 4, and every
  round trip depends on getting it right.
- Which asset-path string corresponds to which member index. The names exist;
  the mapping does not yet.
- Whether any "data" member is compressed or is itself a nested archive.
  Members #0 (61 MB, magic `0x100d`), #2–#5 (~48 MB, `FFFFFFFF`-prefixed) and
  #12 (10 MB) are the candidates.
- Whether overlay TUs were built `-G0` or `-G8`. They contain no gp-relative
  addressing — member #11 has zero genuine `$gp` accesses, the three apparent
  hits being data misdecoding as `lwc2`/`lwc3` — so the `-G8` small-data and
  TU-ownership machinery (`adr-0001`, `deriveTuOwnedGlobals.ts`) does not apply
  to overlay code. Deliverable 12 confirms this before anyone relies on it.

---

# Deliverable 1: archive extraction and member manifest

Decode `a_file.hdt`, split `a_file.bin`, publish a manifest every later tool
reads instead of re-parsing the container.

Write the index reader as a **detector, not a decoder**. Given a candidate
index and data file, test a small hypothesis set — u32 offset table with
sentinel, u32 sector table, `(offset,size)` pairs, `(sector,size)` pairs — and
score each against monotonicity, alignment, and total-size agreement. Those
three invariants identified this format in minutes, and the trailing-sentinel
offset table is a common PSX archive idiom, so the detector generalizes where a
hardcoded parser would not.

Manifest per member: index, byte range, sector range, size, 4-byte tag,
SHA-256, and the Deliverable 5 classification once it exists. Written to
`configs/overlays.json`.

**Acceptance.** `tools/build/extractArchive.ts` reproduces 32 members whose
concatenation is byte-identical to `a_file.bin`; the detector reports the
format with its evidence and reports `undetermined` for a deliberately
corrupted index rather than guessing; outputs land under `extracted/` and are
not committed.

---

# Deliverable 2: liveness correction and engine API report

**Depends only on Deliverable 1, and fixes a defect that is wrong today.**
`jal` targets are absolute, so the overlay-to-EXE call scan needs no load
address — this lands before the base solver and is the chain's first payoff.

`progress.ts:157` classifies a PS-X EXE function as dead when nothing inside
the EXE references it. 93 functions so classified are called from overlays,
including `GetVal8005E5B4` (123 call sites) and the stub `func_8001AC10` (79).
They are excluded from the progress denominator and invisible to
prioritization.

**The same defect exists in `callGraph.ts:200`**, and there it is worse than a
metric error. `detectDeadCode()` computes `dead = !hasCallers && !hasPtrRef`
over the PS-X EXE alone, and the priority sort then pushes `dead` entries to the
**end of the queue**. So the 93 overlay-facing engine functions are currently
ranked last. `func_8001AC10` — a stub with 79 overlay call sites that no overlay
translation unit can compile without — sits at the bottom of the work queue
today. The liveness defect is not just mismeasuring progress; it is actively
deprioritizing the highest-leverage functions in the project.

Three outputs:

1. **Corrected liveness.** A function is live if referenced from the PS-X EXE
   *or from any overlay member*. Both `progress.ts` and `callGraph.ts` consume
   it. Expect the denominator to grow by ~93 and the headline percentage to
   fall — that is the correction working, not a regression.
2. **Corrected priority.** With liveness fixed, the 93 stop being sorted last.
   Verify that the engine API stubs rise to where their call-site counts say
   they belong.
3. **The engine API report.** Every PS-X EXE entry point called from overlays,
   with call-site counts, calling-member counts, and current match status.
   This is the prioritization input for the remaining PS-X EXE tail.

Range-check every `jal` target against valid PS1 RAM before counting it; the
measured false-positive floor is roughly 1%.

`README.md`'s description of dead functions as "unused code from the PSY-Q
libraries" should be corrected in the same change — the unreferenced set is
interleaved with live game code, not clustered in a library region.

**Acceptance.** `progress.ts` reports the corrected denominator and states the
liveness basis. `callGraph.ts` no longer sorts overlay-called functions to the
end, and `func_8001AC10` and `func_80017B3C` rank consistently with their
call-site counts. The engine API report reproduces the 246-entry-point union and
the per-member counts recorded above. No function that receives an overlay call
is reported dead by either tool.

---

# Deliverable 3: overlay base-address solver

**The linchpin. Nothing after this is meaningful without it, and it is the one
genuine derivation in this plan.** Also required by
`plans/static-recompilation.md` Phase B — build it once, here.

An overlay carries no header and no relocation table. Branch targets are
PC-relative and survive any base; `lui`/`addiu` pairs, jump tables, and the
data partner's pointer tables are absolute and are noise at the wrong base.

Constraints available, all mutually redundant:

- internal `jal` targets must land inside the member, on instruction
  boundaries, at plausible function prologues
- `lui`+`addiu` and `lui`+`lw`/`sw` pairs must resolve into the member, into
  PS-X EXE data, or into a plausible BSS region
- `jal` targets outside the member must hit known PS-X EXE function addresses
- the paired data member's pointer table encodes the base directly
- members sharing a slot must share a base
- every candidate target must be valid PS1 RAM, which alone rejects the
  `0x8FF4xxxx`-class false positives

Emit a **certificate**: the base, constraints satisfied, margin over the
runner-up, and residual violations. Report `undetermined` when the constraints
do not pin a unique base — a plausible default here silently corrupts every
downstream artifact.

**Acceptance.** Every code member resolves to a base with a certificate, or is
explicitly `undetermined`. For each resolved member: ≥99% of internal `jal`
targets land on prologue-shaped boundaries and 100% of external `jal` targets
match a known PS-X EXE function address, after discarding words failing the
RAM-range check. The base agrees with the data partner's pointer table where
one exists, and with other members assigned the same slot. A deliberately wrong
base is rejected by the same criteria.

---

# Deliverable 4: container model

`tools/lib/psxExeInfo.ts` assumes the binary is a PS-X EXE with a parseable
header supplying load address and section layout. An overlay is a raw sector
blob: no header, base supplied externally by Deliverable 3, code/data boundary
derived.

Introduce a `Container` abstraction — `{ id, kind: "exe" | "overlay", base,
sections, bytes }` — and route `functionOracle.ts`, `symbolIndex.ts`, and
`textSegmentSpans.ts` through it. The PS-X EXE becomes container `exe`;
nothing about its behavior changes.

Most invasive change in the plan. Land it as a pure refactor with the existing
suite green **before** any overlay container exists, so a regression is
attributable.

**Acceptance.** `tools/lib/*.test.ts` passes unchanged; `make check` passes;
`diffFunc` reports MATCH for every function that reported MATCH beforehand,
with identical output. Only then is a second container introduced.

---

# Deliverable 5: container-scoped symbols and member classification

**Symbols.** `configs/symbol_addrs.txt` maps `name = 0xADDR` globally. Two
overlays sharing a slot put two different functions at one address, so the key
becomes `(container, address)`. Readers to update: `symbolIndex.ts`,
`genDisasmSymbols.ts`, `contextExport.ts`, and the splat configs.

Highest-risk item by blast radius. Keep the existing flat file as the `exe`
container's input so its format and contents are untouched; add per-overlay
symbol files under `configs/symbols/`.

**Classification.** Promote the throwaway `jr ra` density scan into
`classifyArchiveMembers.ts`: code-vs-data by MIPS decode validity and prologue
density, plus magic detection for VAB (`VABp` — member #9 is one, version 7),
TIM, TMD, SEQ, VAG, and MDEC bitstream frames. Must also recognize a
**count-prefixed pointer table** so member #8 is classified as data rather than
code. Report a verdict with its evidence, and `undetermined` where the evidence
does not support one.

**Acceptance.** Symbol lookup is unambiguous for a synthetic
two-overlays-one-address case; the `exe` container resolves byte-identically to
today; the classifier reproduces the code/data split with a documented verdict
for member #8, and no member changes class between runs.

---

# Deliverable 6: per-container disassembly and split pipeline

**This is the deliverable that produces the stated outcome, and the earlier
revisions of this plan covered it in three lines.** `make disassemble` and
`make split` are not thin wrappers around splat — they are a fifteen-step chain
in which **eleven of the seventeen tools under `tools/build/` hardcode the
target binary or `configs/splat.yaml`**.

## Disassembly

`tools/build/disassemble.sh` hardcodes `extracted/iso/slus_011.15`,
`--start 0x800`, `--vram 0x80010000`, `--gp 0x8005E274`, and the
`slus_011_*` output prefix. Per container it needs the member path, the solved
base from Deliverable 3, no `--gp` at all, and a container-scoped output tree.

It also runs spimdisasm **twice** — once with `--disasm-unknown` for stubs and
once without, for section-layout analysis, because `--disasm-unknown` invents
multi-kilobyte phantom functions inside data regions and breaks boundary
inference. Overlay members carry roughly half data by volume, so **that failure
mode will be worse here than it is in the EXE**, and the two-pass structure is
mandatory rather than incidental.

## The split chain, tool by tool

| step | container-aware? |
|---|---|
| `bootstrap.ts` | **yes** — per-container section layout from `analyzeLayout.ts` |
| `mergeFragments.ts` | **yes** — runs twice in the chain |
| `addLibSymbols.ts` | **no** — overlays link no libraries |
| `patchSplatForLibs.ts` | **no** — same |
| `addDepObjects.ts` | **no** — replaced by Deliverable 8's engine export |
| `splat split` | **yes** — per-container config |
| `fixCrossFileRefs.ts` | **yes** — plus a new cross-*container* case |
| `patchLinkerBss.ts` | **yes** |
| `patchLibBss.ts` | **no** — no library BSS in an overlay |
| `deriveRodataSplits.ts` | **yes** — and see the self-healing loop below |
| `classifyGlobals.ts` | **yes** — Deliverable 12 |
| `contextExport.ts` | **yes** — Deliverable 7 splits its output |
| `genProjectProfile.ts` | **yes** — the profile must describe every container |

The three `no` rows are the good news: overlays call the EXE rather than
linking the SDK, so a third of the chain simply does not apply. What replaces
it is Deliverable 8.

## Two chain behaviors that must survive

**The rodata self-healing relink.** `$(BUILT_ELF)` runs
`deriveRodataSplits.ts`, and on drift rederives, re-splits, and rebuilds once,
guarded by `DERIVE_RODATA_RETRY`. Thirteen more containers means thirteen more
places this can trigger. It must remain per-container — a drift in one overlay
must not force a full re-split of everything.

**`make config-check` must still converge.** It asserts that `make split`
produces no tracked-file changes. With fourteen containers the fixpoint is
correspondingly harder to reach, and a chain that oscillates in one container
fails the guard for the whole project. Convergence is an acceptance criterion,
not an afterthought.

**`make wipe`** strips subsegments from `configs/splat.yaml` for bootstrap
testing. It needs a per-container form so a single overlay can be rebuilt from
scratch without wiping the EXE.

**Acceptance.** `make disassemble` emits a function list and stub tree for
every code member. `make split` runs the chain across all fourteen containers
and produces `INCLUDE_ASM` stubs for every function in every one. `make
config-check` converges — a second consecutive `make split` changes no tracked
file in any container. `make wipe-ovl_11 && make split-ovl_11` rebuilds one
overlay's config from nothing without touching the EXE's.

---

# Deliverable 7: repository and build layout

Splat is one config per binary — `target_path`, `sha1`, `basename`, and
`gp_value` are top-level. An overlay is a different file with a different hash,
so overlays get their own splat configs, linker scripts, and ELFs. No
alternative exists.

```
configs/
  splat/exe.yaml            <- today's splat.yaml, moved
  splat/ovl_11.yaml
  symbols/exe.txt           <- today's symbol_addrs.txt, moved
  symbols/ovl_11.txt
  overlays.json             <- Deliverable 1's manifest
src/
  *.c                       <- EXE sources stay exactly where they are
  overlays/ovl_11/func_800B1234.c
include/
  functions.h               <- engine API only
  overlays/ovl_11.h         <- that overlay's own functions
```

**Do not move the existing `src/*.c`.** The churn touches 464 files and risks
every matching function for a cosmetic gain.

**Naming.** Use the member index (`ovl_11`) as the durable identifier — derived
from the manifest and therefore never wrong. Semantic names are available
earlier than previously planned: the EXE string table carries the developer's
own asset paths (`Obj\GF_MG1.Bin`, `Obj\GF_TITLE.Bin`, `Obj\saveload.bin`, …),
roughly thirteen `GF_` entries against thirteen code members. Adopt a semantic
name only once Deliverable 10 binds a string to a member index with evidence;
until then the index stands alone. A directory alias is cheap; a wrong name
propagates into hundreds of filenames and notes.

**Makefile landmine.** `C_SRCS := $(wildcard src/*.c src/**/*.c)` — GNU make's
`**` is not recursive; it expands to `src/*/*.c`. It would pick up
`src/overlays/*.c` but not `src/overlays/ovl_11/*.c`, and if it ever did,
overlay objects would silently link into the EXE. Object collection must become
per-container and explicit, not a glob.

**Section split within a member.** An overlay has its own `.rodata` — jump
tables and constants — with no header to declare where. The boundary must be
derived (last decodable function, jump-table targets recovered during
Deliverable 3, cross-check against the data partner) and it is the most likely
cause of a failed round trip.

**Per-container settings.** `gp_value` is meaningless for overlays, and
`ASFLAGS` hardcodes `-G8` where overlays likely want `-G0` (Deliverable 11
settles it). Overlay BSS lives above the member's own extent and is not in the
member file; the overlay linker script must place those regions explicitly.

**Targets.** `make split[-<container>]`, `make check[-<container>]`,
`make progress`. `make check` becomes N+1 SHA-256 comparisons and fails if any
container fails. An overlay's check compares against its **extracted member
bytes**, which is why Deliverable 1's acceptance requires reproducible
extraction.

**Prior art.** The Symphony of the Night decompilation is a PSX game with many
overlays and a mature build using per-overlay source directories, splat
configs, and symbol files — this shape. Read it before committing to the layout.

**Acceptance.** `make check-exe` is byte-identical to today's `make check` and
the EXE build is unchanged in every respect. Each overlay builds from pure
`INCLUDE_ASM` stubs to a binary byte-identical to its extracted member. **That
full-stub round trip is the gate**: until an overlay reassembles bit-for-bit,
no C written against it can be trusted.

---

# Deliverable 8: engine symbol export

Split out of Deliverable 7 because it is a distinct mechanism with its own
failure mode.

When an overlay ELF links, its calls to `0x8001FABC` must resolve — but the
EXE is not in that link. Engine symbols must enter the overlay link as
**absolute address definitions**, as splat's `undefined_syms_auto.txt`
mechanism does, populated from the EXE's symbol table.

**Data symbols are required, not optional.** Overlays resolve 251 distinct PS-X
EXE `.data`/`.sdata` addresses across 1,725 sites. An export list carrying only
functions links cleanly and leaves every global reference wrong.

Two consequences. The export list must be **generated, never hand-maintained**
— the 246 measured function entry points and 251 data globals are floors, not
ceilings, so export the whole EXE symbol table rather than a curated subset. And **the EXE's symbol table
becomes a build input to every overlay**: renaming a function in `src/` changes
every overlay's link.

The failure mode is quiet. A stale export list produces an overlay that links
cleanly and calls the wrong function.

**Acceptance.** The export list is generated from the EXE build and is a
declared dependency of every overlay link, so a renamed EXE symbol forces an
overlay relink. A deliberately stale export list fails the build rather than
producing a mislinked binary.

---

# Deliverable 9: container-aware oracle and progress

`diffFunc` must resolve a function to its container and compare against that
container's bytes. Without it there is no per-function residual for overlay
code — and by this repository's verification discipline the residual is the
working measurement, not a byte score and not `make check`.

`progress.ts` reports per container and in total, on top of Deliverable 2's
corrected liveness.

**Acceptance.** `diffFunc` returns MATCH for an overlay function whose stub
assembles from original bytes, and a correct residual for a deliberately
perturbed one. `progress.ts` distinguishes containers, and its PS-X EXE figures
match Deliverable 2's corrected numbers.

---

# Deliverable 10: overlay identity and cross-container call graph

Extend `callGraph.ts` across containers. Resolve PS-X EXE indirect dispatches
into overlay space where the dispatch table is recoverable.

**Tiering and depth must span the boundary.** The existing model — tier 1 leaf,
tier 2 calls SDK only, tier 3 calls game functions, tier 3 depth = max callee
depth + 1 — has no way to express a cross-container dependency. Two changes:

- A *matched* engine callee behaves like tier 2 from an overlay's perspective:
  signature known and stable, no further work behind it. An *unmatched* engine
  callee is a real dependency the overlay function must wait behind. The tier
  model needs a resolved-dependency notion rather than a call-target category.
- Depth BFS must traverse cross-container edges. Without them an overlay
  function calling twenty engine functions computes as depth 1, and the
  bottom-up ordering that makes the whole strategy work silently stops working.

`matchedNeighborHash` likewise needs cross-container neighbors, or context
propagation stops at exactly the seam where it matters most.

**Bind names to members.** Three independent sources should agree: the EXE
string table's asset paths (`Obj\GF_*.Bin` for code, `ObjCg\*.Bin` for the
paired graphics — matching the observed code/data member pairing); the loader
call sites that read `a_file.hdt` and issue `CdlSetloc`/`CdRead`, reachable via
`matchSignatures.ts` plus the `a_file` filename references; and the member index
each load site requests. Agreement across all three is the evidence bar for
adopting a semantic name in Deliverable 7.

The loader's output is also the mapping from member index to load address to
game state — the dispatch model, and an independent check on Deliverable 3's
solved bases.

**Acceptance.** `contextExport.ts` emits declarations for an overlay TU that
compile clean. Every member is mapped to a load address and, where the three
sources agree, to a semantic name with its evidence recorded. Disagreement is
reported, not resolved by preference.

---

# Deliverable 11: overlay global classification

Three distinct region classes, per the RAM map:

1. **Shared BSS / heap, `0x8005E800`–`0x800AFFFF`** — 16,639 combined reference
   sites, the busiest region in the game and owned by no container. This is the
   priority: it holds the global state both bodies mutate.
2. **PS-X EXE `.data`/`.sdata`** — 251 distinct globals reached from overlays.
   `globals_override.h` types for these become shared context, not EXE-local,
   so the override header needs a scope model rather than a container copy.
3. **Overlay slot space, `0x800B0000`–`0x8013FFFF`** — overlay-local BSS,
   another overlay's slot, and the structure the EXE itself reaches into 1,321
   times.

`classifyGlobals.ts` needs per-region, per-container classification able to tell
these apart.

Given the code-character finding — overlay work is type-bound rather than
allocator-bound — this matters more than its position suggests, and its output
is the substrate for the struct recovery overlay decompilation will live on.

**Acceptance.** Every out-of-EXE address referenced by overlay code is assigned
to a named region with evidence, or reported unclassified. No address is
silently defaulted.

---

# Deliverable 12: overlay flag fingerprint

Confirm compiler flags for overlay TUs before writing C against them. The
absence of `$gp` implies `-G0`, or `-G8` with no small globals defined in any
overlay TU — different facts with different consequences for how declarations
must be written.

Run `flagProbe.ts` against a decompiled overlay function once one exists. Per
repository policy this requires a target fingerprint, a dominant flag column,
and no contrary regional witness — not flag-shopping.

**Acceptance.** A recorded fingerprint with evidence, and either a
`configs/flag_overrides.mk` entry with its allowlist entry, or a documented
finding that baseline flags apply unchanged.

---

# Deliverable 13: agent workflow and knowledge base

Everything above makes overlay code *buildable*. This makes it *workable* —
the per-function agent loop assumes a single container in several places, and
each is a silent wrong-answer generator rather than a build failure.

**The hard break: `vram` is the identity key.** `scheduler.ts` addresses work by
`WorkItem.functionVram`, and the controller's `state.functions` is keyed by
vram. Two overlays sharing slot `0x800B0000` hold two different functions at one
address, so the state would carry **one entry for two functions** and the
scheduler would hand the agent the wrong target. That is a wrong answer, not a
wrong ordering. Identity must become `(container, vram)` throughout the
autonomous state — and that state is persistent, so the change needs a
migration, not just a type edit.

| surface | what breaks |
|---|---|
| `.pi/…/autonomous/scheduler.ts` | sorts on `a.priority - b.priority \|\| a.vram.localeCompare(b.vram)`; both the identity and the tiebreak assume a single address space. Needs container-scoped selection so a run can be pinned to one overlay |
| `.pi/…/autonomous/state.ts` | `state.functions` keyed by vram — collides across slot-sharing overlays; persistent, so it needs a migration |
| `tools/agent/callGraph.ts` | single hardcoded `configs/splat.yaml`; EXE-only dead detection (Deliverable 2); no cross-container tiering or depth (Deliverable 10) |
| `.pi/skills/psx-decompile-function/` | the mandatory matching guide addresses one binary, one symbol map, one set of build commands |
| `tools/agent/m2cFunc.ts` | resolves a function to its `.s` under `build/asm/`; needs per-container resolution |
| `tools/agent/triage.ts` | symptom detectors encode PS-X EXE assumptions — notably the `-G8` small-data patterns that do not apply to overlay TUs at all |
| `.pi/autodecomp.json` `sourcePolicy.allowlist` | keys are bare filenames; two overlays can hold the same function name at the same address |
| `notes/file-groupings.md` | the grouping ledger is EXE-scoped with no container column |
| `tools/agent/contextExport.ts` | generates one `functions.h`; Deliverable 7 splits it into engine plus per-overlay |

**Scheduling policy.** Per the scheduling-structure finding, the engine API is
the dependency frontier and the thirteen overlays are mutually independent
behind it. The scheduler should gain a container filter — pin a run to one
container — rather than interleaving globally. Once the engine API is matched,
thirteen workers can run against thirteen overlays with no shared dependency
graph and no coordination beyond the shared engine symbol export.

Also worth deciding here rather than discovering later: **build cost.** Thirteen
additional splat runs, link steps, and SHA-256 comparisons on every `make
check`. If that makes the full gate too slow to run per edit, the per-container
targets from Deliverable 7 become the working loop and the full gate moves to a
pre-commit check — a workflow decision, not a tooling one.

**Testing.** Every tool in this plan follows the existing convention of a
colocated `*.test.ts`. Deliverables 1, 3 and 5 additionally need negative tests
— a corrupted index, a deliberately wrong base, a member whose class is
ambiguous — because each has `undetermined` as a required verdict and an
untested `undetermined` path will silently become a default.

**Acceptance.** Controller state is keyed by `(container, vram)` and an existing
state file migrates without loss. A synthetic two-overlays-one-address case
selects the correct target. A single overlay function can be taken end to end —
stub to matching C — through the documented agent workflow, with `diffFunc`,
`triage.ts`, and the allowlist behaving correctly for its container, and with no
step requiring the operator to know it is working on an overlay rather than the
PS-X EXE.

---

## Ordering and risk

```
1  extract ────┬── 2  liveness + engine API report   (lands immediately)
               │
               └── 3  base solver ── 4  container model ── 5  symbols + classify
                                                                │
                                          6  disassembly + split chain
                                                                │
                                    ┌───────────┴───────────┐
                                    7  repo/build layout    8  engine export
                                                │
                       ┌────────────┬───────────┴──────┬────────────┐
                       9  oracle   10  identity/graph  11 globals  12 flags
                                                │
                                   13  agent workflow  (gates "startable")
```

**Deliverable 2 depends only on 1 and should land first.** It fixes a defect
that is wrong today: 93 functions are misclassified dead, which both understates
progress and sorts the highest-leverage engine functions to the bottom of the
work queue. It needs no load address, because `jal` targets are absolute.

**1→3→4→5→6 is the hard chain**, and 6 is where the stated outcome is produced.
7 and 8 depend on 6 and on each other. 9 through 12 follow once 7 and 8 land.
13 is last and gates the claim that overlay work is actually startable.

Nothing after 3 is worth starting until 3 resolves; an `undetermined` member is
work to finish, not a member to drop.

**Two independent tracks.** Deliverable 2 and the two hot engine stubs
(`func_80017B3C`, `func_8001AC10`) can proceed in parallel with the whole
tooling chain — they are ordinary PS-X EXE decompilation work, unblocked by
anything here, and they are on the critical path for overlay work regardless of
when the tooling lands.

| Risk | Mitigation |
|---|---|
| Base solver cannot pin a unique base | Deliverable 3 fails loudly rather than defaulting. `undetermined` members escalate to hand analysis — the data partner's pointer table and the loader call site (Deliverable 10) each encode the base independently of the solver |
| `jal`-shaped data words corrupt a scan | RAM-range validity check rejects the measured `0x8FF4xxxx`-class false positives before any constraint or count uses them. Applies to Deliverables 2, 3 and 10 |
| `--disasm-unknown` invents phantom functions in overlay data | The EXE already needs a two-pass disassembly for this reason; overlay members are roughly half data, so the failure is worse. Deliverable 6 keeps both passes and treats the second as mandatory |
| The split chain fails to converge across 14 containers | `make config-check` is an acceptance criterion of Deliverable 6, not a later concern. A chain that oscillates in one container fails the guard for the whole project |
| Symbol-map refactor regresses the PS-X EXE | Deliverable 4 lands as a pure refactor behind a green gate before any overlay container exists |
| An overlay does not round-trip from stubs | Deliverable 7's gate catches it before any C is written; likely causes are a wrong code/data boundary or an unrecognized alignment rule |
| Stale engine export list mislinks an overlay silently | Deliverable 8 makes the export a declared build dependency; a stale list must fail the build, not produce a wrong binary |
| A semantic overlay name is adopted on weak evidence | Deliverable 10 requires three independent sources to agree; the member index remains the durable identifier regardless |
| A member resists classification or round trip | Every code member is in scope, so an unresolved member is a blocker to solve, not a member to drop. Escalate to hand analysis rather than narrowing the target |
| The base is off by the 4-byte leading word | Whether the loader strips it or loads the member whole is unmeasured. Deliverable 3 must solve for both hypotheses and report which one the constraints support, not assume either |
| Shared BSS types diverge between containers | `0x8005E800`–`0x800AFFFF` is mutated by both bodies. Deliverable 11 must give it one owner and one set of declarations, or the same struct gets two incompatible definitions |
| Full `make check` becomes too slow to run per edit | Per-container targets from Deliverable 7 are the working loop; Deliverable 13 decides where the full gate runs |
| Autonomous state collides two functions at one vram | Deliverable 13 rekeys controller state to `(container, vram)` with a migration. Until then no overlay may be added to the autonomous queue — a collision hands the agent the wrong target and the failure looks like a bad match, not a bad address |
| Corrected liveness silently reorders the queue mid-run | Deliverable 2 changes priority for ~93 functions. Land it between epochs, not during one, and record the before/after ranking of the engine API stubs |

## Non-goals

- Decompiling any overlay function. This plan ends when one can be attempted.
  Every code member is in the project's target; this plan only makes them
  reachable.
- The static recompiler; see `plans/static-recompilation.md`.
- The nested container formats in members #0, #2–#5, and #12 — **conditional on
  Deliverable 5 confirming they hold no code.** They classify as data today on a
  `jr ra` density scan, which would miss code that is compressed or nested one
  level down. If any contains code it enters scope and this plan grows a
  deliverable.
- Changing how the PS-X EXE is built or matched. Deliverable 7's acceptance
  requires the EXE build be bit-identical and behaviorally unchanged.
  Deliverable 2 does change how it is *measured*, deliberately.
