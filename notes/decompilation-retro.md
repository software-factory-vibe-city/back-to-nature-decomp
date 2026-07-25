# Decompilation Retro: Buckets C and D

Companion to `notes/next-steps-for-revisiting-the-project.md`. Documents the
2026-07-25 de-superstition sweep (15 of 18 register-pinned files stripped
clean, binary verified byte-identical by `make check`) and analyzes the two
buckets that were deliberately **not** distilled into prompts yet:

- **Bucket C** — real search problems mislabeled "impossible": agents wrote
  "register asm required" comments while a clean-C lever existed but wasn't
  found within their search budget.
- **Bucket D** — genuine tool gaps: divergences at the cc1 → maspsx boundary
  that no C input can fix.

Buckets A (pure residue — pins with zero effect on output) and B (hand-written
asm for idioms GCC generates natively) were distilled into
`prompts/c-style-guide.md` ("Legacy hacks: strip first, decode the idiom") in
the same session and are not repeated here.

Sweep scoreboard: 15 stripped clean, 3 parked with candidates
(`notes/scratch/func_8001B4E4-candidate.c`, `func_8001E7DC-candidate.c`,
`func_8001AF44-candidate.c`), 2 confirmed genuine (SetGfxClip, SetGfxOffset),
1 excluded (`func_80021820`, known broken — needs full re-decomp, not a sweep
candidate).

---

## Bucket C — real search problems mislabeled "impossible"

### Thesis

The compiler is proven byte-identical to the original CC1PSX.EXE, so "GCC
won't pick these registers" is never a statement about the compiler — it is a
statement about the *source's temporary-variable structure*. Bucket C cases
are ones where that structure was findable, but the mechanism connecting
source shape to allocator/scheduler behavior was obscure enough that the
agent folded first. Every Bucket C file carried a comment asserting
necessity; every solved one proved the comment wrong.

The value of this bucket is the **mechanism catalog**: each case isolates one
lever by which source shape drives the compiler's decisions. These levers are
real but currently rest on one data point each — they need validation before
becoming prompt doctrine (see "Open questions").

### Case C1 — func_80024578: fresh temp vs. reuse for commutative results (SOLVED)

**The hack** (commit `9d010e1`, 2026-03-18):

```c
/* register __asm__ required: compiler uses a2 for mflo, target uses v0 */
register s32 var_v0 __asm__("v0");
...
var_v0 = arg1 * var_v0;
```

**The diff without the pin** — one instruction, commutative operand order:

```
-mult	a1,v0      (target)
+mult	v0,a1      (ours, pin stripped, both source operand orders tried)
```

**The fix** (`src/func_80024578.c`, current): introduce a fresh temp for the
product —

```c
prod = arg1 * var_v0;
return (var_v1 + (prod + var_a0)) & 0xFFFF;
```

→ 20/20, 100%.

**Mechanism**: for commutative ops, GCC 2.95 canonicalizes RTL operand order
internally, so swapping source operands does nothing (verified: both
`arg1 * var_v0` and `var_v0 * arg1` produced identical `mult v0,a1`). What
changes the emitted order is the *web structure*: when the result reuses an
input's variable (`var_v0 = arg1 * var_v0`), the dest==input overlap biases
both canonicalization and allocation; a fresh temp (`prod`) removes the
overlap and the canonical order flips to match the target.

**Lever**: *when one commutative instruction has operands swapped vs. target,
change whether the result variable is fresh or reuses an input.*

### Case C2 — func_800244FC: statement birth order drives allocation (SOLVED)

**The hack** (commit `e338cf8`, 2026-03-21): a ~15-line `__asm__ volatile`
block hand-forging the magic-multiply division, the `D_800559CC[arg1]` array
indexing, and the `mfhi` — justified by "Inline asm to force multu/mfhi
pattern" — plus a memory barrier "forces compiler to emit sw $ra earlier".
(The division idiom half of this is Bucket B: `temp / 14` and `temp % 14`
produce the magic sequence natively.)

**What remained after de-idioming** (74.2%): three allocation/scheduling
diffs — arg1's copy in `a3` vs target `v1`, magic constant in `v1` vs target
`v0`, `sw ra` stolen into the `beqz` delay slot vs. emitted right after
`addiu sp`.

**The fix** (`src/func_800244FC.c`, current): purely *statement order* —

```c
temp = arg0;
quot = temp / 14;
rem = temp % 14;
fn = (FuncType)D_800559CC[arg1];   /* moved AFTER the division */
return fn(rem, quot, temp);
```

Moving the fn-pointer load after the division changed pseudo birth order,
which changed allocation priority: the arg1 copy landed in `v1`, the magic in
`v0` — 87.1% with zero other changes. The `sw ra` placement was the only
remaining diff, fixed by retaining the hacked file's one legitimate
ingredient — a memory barrier with a justification comment:

```c
/* Keep the prologue's sw ra ahead of the branch: without the barrier the
   post-reload scheduler moves it into the beqz delay slot. */
__asm__ volatile("" ::: "memory");
```

→ 31/31, 100%.

**Mechanisms**: (1) allocation priority in GCC 2.95 `local-alloc` is sensitive
to pseudo birth order, which is expand order, which is source statement order
— *reordering independent statements is a zero-cost allocation lever*.
(2) The post-reload scheduler fills branch delay slots by stealing eligible
earlier instructions (here the prologue's `sw ra`); a `::: "memory"` barrier
pins memory ops without constraining any register — a strictly weaker tool
than the `"=r"` operand barrier, and the sanctioned fix for this diff class.

### Case C3 — func_80020174: aggregate form + expression birth site (SOLVED)

**The hack** (commit `1e997f8`): pin `v1`, an operand barrier, and a forged
`__asm__("addiu %0,%1,1")` for `idx + 1`.

**The fix** (`src/func_80020174.c`, current): write the function as the
plain array stores it obviously always was —

```c
idx = D_8005E550;
_D_8006BF48[idx] = arg0 * 2;
_D_8006BF68[idx] = 1;
_D_8006BF88[idx] = arg1;
D_8005E550 = idx + 1;
```

The pointer-temp version matched 20%; the array form jumped to 85%; fusing
`arg0 * 2` into the first store (instead of a standalone statement) moved the
`sll`'s RTL birth site and fixed the last scheduling tie — 100%.

**Mechanism**: where an expression is *born* in RTL (which statement expands
it) determines its position for scheduler tie-breaking. Standalone
assignments birth expressions early; fusing into the consuming statement
births them at the use site. (Style note: the `_D_8006BF48` spelling is used
because `globals.h` declares these as pointer-deref macros, making
`D_8006BF48[idx]` ill-typed. This violates the "NEVER use `_D_`" rule and is
follow-up debt — the correct fix is declaring proper arrays in
`globals_override.h` so the source can use the sanctioned form.)

### Case C4 — func_8001B4E4: variable reuse as a scheduler pin (PARKED)

**The hack** (commit `1e997f8`): six pins (all forcing `v0`/`v1`/`a0`), three
barriers, comment: "register __asm__ required: v0 must be used for both
struct ptr and sll result".

**The comment was half-right, and that's what makes this case interesting.**
The target really does carry one register through a chain of independent
values:

```
lui   v0,0x8006
addiu v0,v0,-6032      # struct ptr
sb    zero,54(v0)
sb    zero,55(v0)
sll   v0,a0,0x2        # SAME reg: shift result
addiu v1,gp,596
addu  v0,v0,v1         # SAME reg: s32 array address
```

**Mechanism discovered**: in pre-SSA GCC, a local variable (whose address is
never taken) gets *one* pseudo register; reusing the variable creates
WAR/WAW data dependencies that the instruction scheduler cannot cross. The
target's `sll v0` *after* the `sb`s is only explainable by such a dependency:
the original source reused one pointer variable, and the shift wrote that
variable's pseudo. The pins in the hacked file were forcing by hand what the
original got for free from variable reuse.

The candidate (`notes/scratch/func_8001B4E4-candidate.c`) exploits this:

```c
sp = &D_8005E870;
sp->field_36 = 0;
sp->field_37 = 0;
sp = (struct_8005E870 *)(arg0 << 2);                          /* WAR-pins sll below the sb's */
sp = (struct_8005E870 *)((char *)&D_8005E4C8 + (s32)sp);
```

→ instruction *order* matches the target 100%. What remains is a single
allocation tie-break: our `sp` web gets `v1`, target gets `v0` (with the
`addrD0` web swapped correspondingly). Six perturbation variants failed to
flip it — allocation priority among conflicting webs is the one mechanism
this sweep did not crack (see Open questions).

**Lever**: *when the target shows one register carrying a chain of
independent values, the original source reused one variable — reproduce the
reuse; do not pin.*

### Case C5 — func_8001E7DC: allocation preference determines whole-function shape (PARKED)

**The hack** (commit `da22173`): pins `a2`/`a0`, four barriers, two
label-forging asm lines, comment: "compiler uses t0 for arg0 copy, target
uses a2; uses t1 for loaded temp, target uses a0".

**Mechanism discovered**: the target's entire shape —

```
move  a2,a0        # pointer copy exists because...
lw    a0,0(a1)     # ...the loaded value lives in $a0, clobbering arg0
addiu a1,a1,4
lw    v1,0(a2)
```

— follows from one allocation decision: the load-result pseudo occupies
`$a0`. That clobbers `arg0`'s register, which *forces* the `move a2,a0` copy
and the per-load pointer increments. Without pins, GCC copy-propagates the
`a2 = arg0` assignment away entirely and emits indexed loads (`lw v1,4(a0)`)
— semantically identical, structurally different. No source statement order
tried made the load-result pseudo *prefer* `$a0`.

**Side discovery (tooling caveat)**: this function's diffFunc output showed
`lw v0,672(gp)` vs. target `lw v0,684(gp)` for the *same* source expression
on the *same* symbol. That is a link-level artifact: diffFunc compares
against a fully-linked binary, and an unmatched function shifts `_gp`
-relative offsets of unrelated code. gp-offset diffs in diffFunc output are
not source bugs — chase them last, if at all.

### Case C6 — func_8001AF44: commutative operand canonicalization in address arithmetic (PARKED)

**The hack** (commit `fb58365`): two pins plus a mid-function
`__asm__("addu %0, %0, %1")` — asm wearing a C costume — comment: "compiler
assigns v1 to index and v0 to ptr, target uses v0 for index and v1 for ptr".

**Remaining diff after stripping** (90.9%): exactly one instruction,
commutative operand order —

```
-addu	v1,v1,v0   (target: base first)
+addu	v1,v0,v1   (ours: offset first)
```

Seven variants were tried: swapping source operands (canonicalized away —
same finding as C1), base-first statement order, fresh temp for the sum,
constant-fused base, pointer-index arithmetic (`temp_v1 += temp_v0`), and
index-offset form (`[idx + 14]`). Each variant that fixed the operand order
broke the schedule or allocation elsewhere, and vice versa — the two are
coupled through pseudo numbering in a way not yet understood. Unlike C1, the
fresh-temp lever did *not* resolve it, suggesting address-arithmetic
canonicalization follows different rules than ALU-op canonicalization (the
`addu` feeds a memory address, and MIPS address legitimation has its own
operand-order preferences).

### Bucket C synthesis — the lever catalog (provisional)

| Lever | Diff class it addresses | Evidence | Confidence |
|---|---|---|---|
| Fresh temp vs. input-reuse for commutative results | One `mult`/ALU op with swapped operands | C1 (solved); C6 (failed) | Medium — works for ALU ops, not address arithmetic |
| Statement reorder (birth order → allocation priority) | Wrong registers, no wrong instructions | C2 (solved) | Medium |
| Expression birth site (fuse into consumer) | One instruction scheduled to wrong slot | C3 (solved) | Medium |
| Variable reuse → WAR/WAW scheduler pin | Target keeps RTL order; our scheduler hoists | C4 (order solved, allocation not) | High for scheduling; mechanism proven |
| `::: "memory"` barrier for prologue-store/delay-slot placement | `sw ra` stolen into branch delay slot | C2 (solved) | High for this narrow class |
| Allocation preference shaping (C5) | Whole-function shape from one reg choice | unsolved | — |
| Address-arithmetic canonicalization (C6) | `addu` operand order in address chains | unsolved | — |

### Bucket C open questions (why this isn't prompt doctrine yet)

1. **The local-alloc priority model is unknown.** C4 failed *only* on which
   of two webs gets `v0`. We need the actual GCC 2.95 `local-alloc.c`
   quantity-ordering rule (birth order vs. live-range size vs. use density)
   determined — either by reading the source in `tools/vendor/old-gcc/` or
   by a controlled experiment harness (minimal functions with two competing
   webs, varied systematically). This is the single highest-value
   investigation here: it would convert three parked functions and an unknown
   number of future ones from "thrash" to "deterministic fix".
2. **Does C1's fresh-temp lever generalize?** It worked on `mult` and failed
   on address `addu`. Needs 2–3 more instances before prompt inclusion.
3. **C5 has no lever at all** — "make a load-result pseudo prefer `$a0`" may
   require understanding the same priority model as question 1.
4. The three parked candidates (`notes/scratch/`) are packaged starting
   points for the diff classifier + `STRONGER_AGENT` escalation proposed in
   the next-steps note — each has a classified diff signature recorded in its
   header comment.

---

## Bucket D — genuine tool gaps (the maspsx boundary)

### Thesis

cc1 is proven byte-identical to CC1PSX.EXE; **maspsx (the ASPSX 2.77
emulation) is not**. Divergences that happen at assembler macro-expansion
time cannot be fixed by any C input, because the C compiler's output is
already correct and the bytes diverge afterwards. An agent fighting one of
these can never win with C and will rationally fold — unless it can recognize
the signature and stop. Bucket D is about learning the signature *without*
creating a new superstition (see "Why this section is dangerous").

### Case D1 — SetGfxClip / SetGfxOffset: self-clobbering `lui`/`lw` pairs

Both functions are four stores to two double-buffered `GfxObj` pointers
(`src/SetGfxClip.c`, `src/SetGfxOffset.c`; flag overrides in
`configs/flag_overrides.mk`).

**The target pattern** (SetGfxClip):

```
lui	v0,0x8006
lw	v0,-7252(v0)     # base reg == dest reg: "self-clobbering" load
lui	v1,0x8006
lw	v1,-7256(v1)
sw	a0,44(v0)
...
```

**What our cc1 emits** (pins stripped; `build/diffFunc/SetGfxClip.s`):

```
lui	$2,%hi(D_8005E3AC)
lui	$3,%hi(D_8005E3A8)
lw	$6,%lo(D_8005E3AC)($2)
lw	$7,%lo(D_8005E3A8)($3)
```

Split address form, both `lui`s grouped, pointers allocated to `$6`/`$7`.

**Interpretation**: the target's shape is what real ASPSX produces when it
expands the macro instruction `lw $v0, D_8005E3AC` *in place*: it reuses the
destination register as the temporary base, yielding
`lui $v0,%hi; lw $v0,%lo($v0)` — sequential, self-clobbering pairs. Our cc1
pre-splits the address load (allocating the pointer to a different register
than the `lui` temp), and no downstream tool re-joins it. This is the same
layer as `notes/maspsx-issue2.md` (the `la`-before-`sll` ordering class):
"the divergence happens at macro-expansion time in the assembler."

**Experimental evidence from the sweep** (all via `diffFunc`, function-local):

| Configuration | Match | Conclusion |
|---|---|---|
| Original: pins + `-fno-schedule-insns{,2}` | 100% | the workaround works |
| Pins stripped, override active | 22.2% | pins are load-bearing (force pointer into `$2`/`$3`, making the split pair coincide into self-clobbering form) |
| Pins kept, override removed | 55.6% | override is load-bearing (keeps pairs sequential; otherwise scheduler interleaves) |
| Both removed | 22.2% | no free lunch |

Contrast with every other pinned file in the sweep, where stripping the pin
changed *nothing* about the output. **That contrast is the point**: genuine
workarounds are load-bearing under ablation; superstitions are not.
Ablation (strip-and-test) is the general-purpose discriminator.

**Why the workaround is legitimate (for now)**: the pins + override don't
fake the computation — they steer cc1's own output into the exact form real
ASPSX would have produced from the original macro-form input. But they are a
tool-gap patch, not a decompilation result, and they are counted as such in
`AGENTS.md`. They should be retired if maspsx learns to re-join split address
loads (or the Wine differential shows the divergence is something else
entirely).

### The maspsx layer is known-unstable

- `notes/maspsx-issue.md`, `notes/maspsx-issue2.md` document the
  `la`-before-`sll` ordering class — same boundary, different pattern.
- The vendored submodule carries an **uncommitted experimental patch**
  (`tools/vendor/maspsx`, `maspsx/__init__.py`: delay-slot filling for
  `lui`-only `li` after branches/jumps). It is currently harmless (`make
  check` passes with it) but means the assembler's behavior is a moving
  target and its provenance is untracked. Decide whether it gets committed,
  upstreamed, or dropped.
- Related build-system hazard found during the sweep: `configs/flag_overrides.mk`
  is **not a dependency** of the `.o` files (`Makefile` recipe at
  `$(BUILD_DIR)/src/%.c.o`). Editing it and rebuilding silently reuses stale
  objects; per-function diff results then disagree with `make check` in
  confusing ways. After touching `flag_overrides.mk`, `touch` the affected
  sources. (Noted in `AGENTS.md`; a proper fix adds the file as an order-only
  prerequisite.)

### Draft diagnostic signature (NOT yet prompt doctrine)

A mismatch is a *candidate* maspsx-gap when **all** of these hold:

1. Target shows a global load whose base register equals its destination
   (`lw $vX, off($vX)` where `$vX` was just `lui`'d), i.e. self-clobbering;
2. our cc1 `.s` already contains the correct instructions in split form with
   the *same* registers as the target apart from the self-clobber pairing;
3. the diff survives source restructuring (it's not a temp-structure
   problem);
4. stripping any present hack drops the match sharply (ablation proves the
   hack load-bearing).

Conditions 2–4 are the anti-superstition guards: without them, "tool gap"
becomes the new fold excuse. The definitive test remains the Wine
differential (next-steps step 4): assemble the proven-correct cc1 output
through real ASPSX 2.77 under Wine vs. maspsx and compare. If they differ,
it's a maspsx bug — fix the tool and mark the function unmatchable-by-C so no
agent burns hours on it again.

### Bucket D open questions

1. **Run the Wine differential** on SetGfxClip/SetGfxOffset (and any function
   where cc1's `.s` matches the target disassembly but final bytes differ).
   This is the only way to convert "draft diagnostic" into a stop-rule we can
   teach.
2. **Can maspsx re-join split address loads?** If cc1's split form (`lui $2 /
   lw $6,%lo($2)`) is provably equivalent to the macro form when the base
   temp dies at the load, maspsx could legitimately re-pair them — that would
   retire both flag overrides and is likely less work than it looks given the
   existing maspsx patch culture.
3. How many other currently-matched functions sit on this boundary? The two
   flag-override files are the known set; a scan for self-clobbering loads in
   the target binary vs. split form in our objects would bound it.

---

## Appendix A — the "required" comment wall of shame

Every one of these HEAD-side comments was investigated during the sweep.
Verdicts: wrong = hack unnecessary, removed; half-right = mechanism real,
hack wrong; genuine = load-bearing tool-gap workaround.

| File | Comment (verbatim, HEAD) | Verdict |
|---|---|---|
| `func_80024578.c:5` | "register __asm__ required: compiler uses a2 for mflo, target uses v0" | **Wrong** — fixed by fresh temp (C1) |
| `func_8001FCE4.c:5` | "register __asm__ required: compiler uses v1 for 0x7F0000, target uses a0" | **Wrong** — stripped clean |
| `func_80021FE4.c:5` | "register __asm__ required: compiles to different instructions without it" | **Wrong** — stripped clean |
| `func_8001FE00.c:11` | "Division with zero-check - GCC doesn't generate this automatically" | **Wrong** — GCC emits it; stripped clean |
| `func_800226B0.c:4` | "register hints required: target uses $v1 for loaded value, $a0 for result" | **Wrong** — stripped clean |
| `func_8001B4E4.c:5` | "register __asm__ required: v0 must be used for both struct ptr and sll result" | **Half-right** — register reuse is real, but it's *variable* reuse in the original source (C4, parked) |
| `func_8001E7DC.c:6` | "compiler uses t0 for arg0 copy, target uses a2; uses t1 for loaded temp, target uses a0" | **Half-right** — the shape is real; it's an allocation-preference consequence (C5, parked) |
| `func_8001AF44.c:4` | "compiler assigns v1 to index and v0 to ptr, target uses v0 for index and v1 for ptr" | **Wrong** mechanism — one commutative operand order away (C6, parked) |
| `func_800244FC.c` | "Inline asm to force multu/mfhi pattern" | **Wrong** — `/14` and `%14` produce it natively (C2) |
| `SetGfxClip.c`, `SetGfxOffset.c` | "Requires -fno-schedule-insns -fno-schedule-insns2 ... self-clobbering lui/lw pattern" | **Genuine** — ablation-proven maspsx gap (D1) |

## Appendix B — sweep scoreboard (2026-07-25)

- **Stripped clean (15)**: CopyVec3, func_8001ACA0, func_80021FE4,
  func_80022AF0, func_800245C8, func_8001FCE4, func_80024578, func_800132B8,
  func_80019E50, func_8001FE00, func_80020174, func_800226B0, func_8001B4D0,
  func_800217B0, func_800244FC.
- **Parked with classified candidates (3)**: func_8001B4E4 (C4),
  func_8001E7DC (C5), func_8001AF44 (C6) — see `notes/scratch/`.
- **Genuine, kept (2)**: SetGfxClip, SetGfxOffset (D1) + their flag overrides.
- **Excluded (1)**: func_80021820 (known broken for 2.95.2 — full re-decomp,
  see next-steps step 6).
- **Verification**: `make check` byte-identical after the sweep.

## References

- `notes/next-steps-for-revisiting-the-project.md` — the parent analysis
  (root causes, six proposed steps; this sweep was step 2).
- `notes/maspsx-issue.md`, `notes/maspsx-issue2.md` — the `la`-before-`sll`
  assembler-divergence class.
- `prompts/c-style-guide.md` — "Legacy hacks: strip first, decode the idiom"
  (Buckets A and B, distilled).
- `notes/scratch/func_8001B4E4-candidate.c`, `func_8001E7DC-candidate.c`,
  `func_8001AF44-candidate.c` — parked candidates with diff signatures.
- Hack-introduction commits: `9d010e1` (func_80024578), `1e997f8`
  (func_80020174, func_8001B4E4), `e338cf8` (func_800244FC), `da22173`
  (func_8001E7DC), `fb58365` (func_8001AF44), `78a125f` (SetGfxClip).
