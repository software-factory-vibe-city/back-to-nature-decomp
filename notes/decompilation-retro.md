# Decompilation Retro: Buckets C and D

Companion to `notes/next-steps-for-revisiting-the-project.md`. Documents the
2026-07-25 de-superstition sweep (15 of 18 register-pinned files stripped
clean, binary verified byte-identical by `make check`) and analyzes the two
buckets that were deliberately **not** distilled into prompts yet:

- **Bucket C** — real inverse-compilation/search problems mislabeled
  "impossible": agents wrote "register asm required" comments while a clean-C
  lever existed but wasn't found within their search budget.
- **Bucket D** — candidate tool-boundary problems: divergences that may occur
  between cc1 output, ASPSX macro expansion, and maspsx emulation. These are
  not proven tool gaps until the same compiler assembly is run through real
  ASPSX and maspsx and produces different objects.

Buckets A (pure residue — pins with zero effect on output) and B (hand-written
asm for idioms GCC generates natively) were distilled into
`prompts/c-style-guide.md` ("Legacy hacks: strip first, decode the idiom") in
the same session and are not repeated here.

Sweep scoreboard: 15 stripped clean, 3 originally parked with candidates
(`notes/scratch/func_8001B4E4-candidate.c`, `func_8001E7DC-candidate.c`,
`func_8001AF44-candidate.c`) — **all three since solved in clean C:
func_8001B4E4 on 2026-07-25 (case C4), func_8001E7DC on 2026-07-26 (case C5),
and func_8001AF44 on 2026-07-25 (case C6)** — 2 kept
with ablation-proven load-bearing workarounds but unresolved root cause
(SetGfxClip, SetGfxOffset), 1 excluded
(`func_80021820`, known broken — needs full re-decomp, not a sweep candidate).

---

## Bucket C — real search problems mislabeled "impossible"

### Thesis

The compiler executable is proven byte-identical to the original
CC1PSX.EXE. That proves the forward compiler is deterministic and trustworthy;
it does **not** make the inverse problem easy. We see only final instructions,
not the original C, RTL pseudos, live ranges, allocation quantities, or
scheduler dependency graph. Many semantically equivalent C forms converge to
the same wrong output, while a small change in pseudo birth or lifetime can
perturb allocation and scheduling across the whole function.

Strictly, compiler identity guarantees that the original source under the
original compiler invocation produced the original cc1 output. It does not by
itself prove that every translation unit used our assumed flags. For the
Bucket C cases, however, the observed diffs and successful clean-C
perturbations point strongly to source temporary structure rather than a
compiler or assembler discrepancy. Here, "GCC won't pick these registers" is
best read as "this reconstruction has the wrong RTL web structure."

Bucket C cases are ones where that structure was partly or fully recoverable,
but the mechanism connecting source shape to pre-SSA optimization,
`local-alloc`, reload, and scheduling was obscure enough that the agent folded
first. Every solved Bucket C file carried a comment asserting necessity; every
solved one proved the comment wrong.

The value of this bucket is the **mechanism catalog**: each case isolates one
lever by which source shape drives the compiler's decisions. These levers are
real but currently rest on one data point each — they need validation and
better pass-level observability before becoming prompt doctrine (see "Open
questions").

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

### Case C4 — func_8001B4E4: variable reuse as a scheduler pin (SOLVED 2026-07-25)

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

#### C4 update (2026-07-25): the reuse hypothesis is self-defeating — refined analysis

A follow-up session fetched the GCC 2.95.2 sources (now vendored at
`notes/scratch/gcc-2.95.2-reference/local-alloc.c` and `sched.c`) and
traced the exact mechanisms. The picture changed substantially:

1. **Variable reuse *cannot* be the original shape.** `local-alloc.c:365`
   restricts local allocation to pseudos with `REG_BASIC_BLOCK >= 0 &&
   REG_N_DEATHS == 1`. A reused variable has multiple disjoint live ranges
   (the candidate's `sp` pseudo 82 dies 3 times), so it is *always* pushed
   to global-alloc, which conservatively loses `$v0` to the short-lived
   symref locals overlapping its windows — deterministically. Same RTL +
   same compiler = same output, so the original RTL provably differed from
   the candidate's. The reuse lever pins the schedule but *guarantees* the
   wrong register web.

2. **Why every fresh-pseudo variant shuffles (the missing pin is alias
   analysis, not just anti-deps).** GCC's pre-alloc scheduler is a
   *backward* list scheduler; with all insn priorities tied at 1, ordering
   is decided by ready-list dynamics plus a `potential_hazard`
   function-unit tie-break (`sched.c:2082`). Stores through provably
   *distinct* base symbols (`&D_8005E4C8+off` vs `&D_8005E4C4+off`) get
   **no memory output dependencies** — cselib base-value tracking
   disambiguates them — so every store is simultaneously ready and the
   scheduler bubbles independent chains (shifts to the top, `la`/`addu`
   above the `sb`s, `sw` pushed below the s16 address chains): 6/19 match.
   The candidate's same-pseudo stores may-alias → output deps → order
   pinned. Fresh pseudos allocate correctly but schedule chaotically.

3. **Allocation is solved on paper.** With all-single-set pseudos *and*
   the target's RTL order, the local-alloc cascade reproduces the target
   allocation exactly, including the alternating `v0`/`v1` symref pattern.
   Ingredients, all verified in source: output ties to a dying input
   (`combine_regs`), hard-register suggestions from copy insns and dying
   hard-reg inputs (allocated first, with *true* lifetimes), priority
   `floor_log2(refs)*refs*size/(death-birth)` tie-broken by qty number
   (`QTY_CMP_PRI`, `local-alloc.c:1505`), and the ±1-insn "fake lifetime"
   extension used when `-fschedule-insns2` is on (`local-alloc.c:1442`).

4. **The candidate's one order flip (`la C4` before `sw`) is a `sched2`
   artifact, not a source-order problem.** It comes from the post-alloc
   `potential_hazard` pick and disappears under the target allocation:
   with the `v0` web continuous, `la C4` writes `$v0` which the `sw`
   reads — a hard-register WAR that pins it. Fixing allocation fixes
   scheduling; the two are not independent.

5. ~~The remaining gap~~ **SOLVED.** Lead (a) from the earlier list
   cracked it: *never re-assign `arg0`*. The matching source
   (`src/func_8001B4E4.c`) writes the halfword index inline at each s16
   store — `(arg0 << 1)` inside the address expression — instead of the
   `arg0 <<= 1` statement every prior variant used:

   ```c
   ep = &D_8005E870;
   ep->field_36 = 0;
   ep->field_37 = 0;
   s4 = arg0 << 2;
   p32 = (s32 *)((char *)&D_8005E4C8 + s4);
   *p32 = 0;
   p16a = (s16 *)((char *)&D_8005E4C4 + (arg0 << 1));
   p16b = (s16 *)((char *)&D_8005E4D0 + (arg0 << 1));
   *p16a = 0;
   p16c = (s16 *)((char *)&D_8005E4C0 + (arg0 << 1));
   *p16b = 0;
   *p16c = 0;
   ```

   → **19/19, `make check` byte-identical, zero workarounds.** Why it
   works: (i) with `arg0` never assigned, it stays in hard `$4` — no
   entry copy, no `arg0 <<= 1` statement — so the shared `arg0<<1` temp
   is CSE-born inside the first s16 store and inherits `$4` via the
   dying-hard-reg suggestion; (ii) that birth site (the C3 lever, fused
   into the consumer) lands the `sll a0,a0,1` exactly between the C8
   addu and the `sw` in the backward scheduler's ready-list dynamics;
   (iii) with RTL order equal to target order, the local-alloc cascade
   (point 3) produces the target's register webs exactly. The
   `arg0 <<= 1` statement was the poison in every earlier variant: it
   forced the entry copy and an extra anti-dependency that let the
   backward scheduler bubble the shifts to the top of the block,
   shifting every pseudo birth and breaking the cascade.

6. Operand-order note: for reg+reg `plus`, emission order survives to
   final asm (no regno canonicalization observed). Both the array-index
   form `(&D_8005E4C8)[arg0]` and the pointer-arithmetic form emit the
   scaled value as the first `addu` operand, matching the target.

### Case C5 — func_8001E7DC: natural expressions dissolve a global-allocation deadlock (SOLVED 2026-07-26)

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

**Update (2026-07-25, deep allocator investigation)** — C5 half-solved:
walking `arg0` *directly* (no copy variable) fixes the CSE cascade entirely
— `make_regs_eqv` merging the copy pseudo with arg0's quantity was what made
every `a2++` constant-foldable into indexed addressing. With the walk on
arg0's own pseudo (self-referential sets are unrecordable), instruction
selection/scheduling/delay slots match the target exactly; the only
remaining diff is a 3-role register swap ($a0↔$a2 for walk/load-temp).
That residual is a *global-alloc priority deadlock*: refs and
REG_LIVE_LENGTH are invariant under statement order (flow computes them
pre-sched, but the ranges are pinned by the identical final schedule), so
the walk (8 refs/26) and the load temp (6 refs/13) tie at exactly 9230
(24/26 == 12/13), the tie-break (allocno number == pseudo creation order)
always favors arg0's pseudo, and its entry-copy $4-preference always fires.
The target needs the load temp allocated first (it then takes $4 as first
free reg, and the winner-update neutralizes the walk's $4-pref → $6).
All three structural families provably fail: FORWARD (tie always lost),
REVERSE (load temp = arg0, walk = copy — combine folds the copy chain since
arg0's entry value dies at the copy, transferring the $4 copy-pref to the
walk, which then outranks and takes $4 itself), COPY+TEMP (cse cascade).
Full historical analysis + best candidate from that stage:
`notes/scratch/func_8001E7DC-candidate.c`.

**Resolution (2026-07-26):** the persistent right-hand-side load temporary was
the false constraint. It came from translating each target instruction into a
separate C statement:

```c
a0_val = arg1[0];
arg1++;
v1 = arg0[0];
v1 -= a0_val;
arg0++;
```

Writing the operation as the natural source expression instead:

```c
delta = *arg0++ - *arg1++;
```

creates fresh, single-set operand pseudos for each component. They go through
local allocation, while the recurring `delta` web receives `$v1` and the walk
pointer receives `$a2`. GCC naturally emits the target's right-hand-side load
in `$a0`, preserves `move a2,a0`, and places the pointer increments and delay
slots correctly. The third component uses `delta = *arg0 - *arg1;`.

This clean source produces **39/39 instructions, 100%, with `make check`
byte-identical** and no pins, barriers, or assembly. The final trace has 19
pseudos versus the assembly-shaped candidate's 14: more fresh RTL temporaries
produced a simpler final allocation than one reused, multi-death user web.

The full tactics record, including the resolved frontier, is
`notes/research/func_8001E7DC-allocator-preference-battle.md`.

### Case C6 — func_8001AF44: commutative operand canonicalization in address arithmetic (SOLVED 2026-07-25)

**The hack** (commit `fb58365`): two pins plus a mid-function
`__asm__("addu %0, %0, %1")` — asm wearing a C costume — comment: "compiler
assigns v1 to index and v0 to ptr, target uses v0 for index and v1 for ptr".

**Remaining diff after stripping** (90.9%): exactly one instruction,
commutative operand order —

```
-addu	v1,v1,v0   (target: base first)
+addu	v1,v0,v1   (ours: offset first)
```

Seven variants were tried in the original sweep: swapping source operands
(canonicalized away — same finding as C1), base-first statement order, fresh
temp for the sum, constant-fused base, pointer-index arithmetic
(`temp_v1 += temp_v0`), and index-offset form (`[idx + 14]`). Each variant
that fixed the operand order broke the schedule or allocation elsewhere.

**Resolution (2026-07-25):** the diff class was misattributed. The pass dumps
show the swap appears *between* `.jump` and `.cse` — not in allocation and
not in MIPS address legitimation. Reading the vendored 2.95.2 `cse.c` pinned
the exact rule: at the end of `fold_rtx`, a commutative operation whose first
operand's register quantity has a recorded constant-equivalent value is
canonicalized *constant-second* (`cse.c:5585` — "place a constant integer as
the second operand ... Otherwise, place any constant second"). The address
base's pseudo records its symbol `lo_sum` value as a quantity constant
(`qty_const`), so cse rewrites `plus(base, offset)` to `plus(offset, base)`
regardless of source operand order. That is why every operand-order
perturbation was a no-op: cse discards the source's operand order entirely.

The escape is the C1/C5 fresh-web lever applied one level earlier: make the
addu's *destination* a fresh compiler web born inside a natural address
expression, so the scaled-index `plus` stays inside the MEM address at expand
time and the forced-out `addu` keeps expand's base-first order. A
side-by-side variant harness (cc1-only compiles of seven shapes — now
first-class tooling, `tools/agent/fuzzVariants.ts`, see below) identified the
winning family immediately:

```c
struct struct_8006C838_flags *flags;   /* { char pad[0x38]; u32 flags[0x800]; } */
u32 index;
arg0 = arg0 & 0xFFFF;
index = arg0 >> 5;                          /* srl born before the lui/addiu */
flags = (struct struct_8006C838_flags *)&D_8006C838;
return (flags->flags[index] >> (arg0 & 0x1F)) & 1;
```

→ **11/11, 100%, `make check` byte-identical, zero workarounds.** The
struct-field access (`flags->flags[index]`, field at offset 0x38) is also the
semantically honest reading: a flat u32 flag-word array at
`D_8006C838 + 0x38`, one word per 32 flag ids. Statement order (index shift
before base assignment) fixes the remaining `srl`-before-`lui` schedule. The
old candidate's reassigned base variable
(`temp_v1 = (u32 *)((char *)temp_v1 + temp_v0)`) was the poison: it made the
addu's destination reuse the base web — exactly the shape cse's
constant-second rule fires on.

**Lever**: *when one commutative address `addu` has operands swapped vs.
target and source-order swaps are canonicalized away, suspect cse's
constant-second rule on the address base's recorded `lo_sum` constant;
restructure so the sum is a fresh compiler web inside a natural address
expression (struct-field or array indexing), not a reassigned user variable.*

**Tooling fallout**: the ad-hoc variant-comparison harness that cracked this
became `tools/agent/fuzzVariants.ts` (CLI) + the `psx_fuzz_variants`
extension tool: side-by-side compile of complete variant shapes against the
archived original, reporting each variant's diff class and first divergence.
It is a hypothesis tester — the comparative divergence view is what exposed
the cse rule — not a match-% hill-climber.

### Bucket C synthesis — the lever catalog (provisional)

| Lever | Diff class it addresses | Evidence | Confidence |
|---|---|---|---|
| Fresh temp vs. input-reuse for commutative results | One `mult`/ALU op with swapped operands | C1 (solved); C6 (failed) | Medium — works for ALU ops, not address arithmetic |
| Statement reorder (birth order → allocation priority) | Wrong registers, no wrong instructions | C2 (solved) | Medium |
| Expression birth site (fuse into consumer) | One instruction scheduled to wrong slot | C3 (solved) | Medium |
| Keep an argument unassigned and fuse repeated expressions into their consuming addresses | Coupled scheduling/allocation cascade breaks when an argument copy or standalone expression is introduced | C4 (solved) | Medium |
| `::: "memory"` barrier for prologue-store/delay-slot placement | `sw ra` stolen into branch delay slot | C2 (solved) | High for this narrow class |
| Fuse a natural expression to replace a multi-death user temp with fresh local pseudos | Persistent temp and pointer fight over one hard-register preference | C5 (solved) | High for assembly-shaped reconstructions |
| cse constant-second canonicalization: fresh-destination web inside a natural address expression (struct-field/array access), not a reassigned user variable | One commutative address `addu` with swapped operands; source-order swaps canonicalized away | C6 (solved) | High for address arithmetic where the base records a `lo_sum` quantity constant |

### What Bucket C says about the toolchain

Bucket C is not evidence that cc1 code generation is broken. The missing tool
is **observability of the exact compiler**. The current oracle collapses
expansion, optimization, address legalization, allocation, reload, and
scheduling into one final instruction diff. That tells us a candidate is
wrong, but usually not which pass first diverged or which source property
controls that pass.

The safe direction is therefore to inspect and instrument the matching
compiler without changing its decisions. A custom allocator or patched
scheduler might make one function match, but it would destroy the central
invariant that the compiler behaves like CC1PSX.EXE. Bucket C needs better
explanations and directed source search, not a different code generator.

### Bucket C open questions (why this isn't prompt doctrine yet)

1. **The allocator priority model and pass attribution are unknown.** C4
   failed *only* on which of two webs gets `v0`, but the first
   `compilerTrace.ts` report corrected the initial hypothesis that this was
   necessarily `local-alloc`: the candidate's long-lived pointer pseudo 82
   has three deaths, receives no assignment in `.lreg`, and is assigned `$v1`
   only in the post-local `.greg` state. The important C5 user pseudos are
   likewise post-local assignments. The investigation must therefore include
   `global.c` and reload as well as `local-alloc.c`.

   The vendored old-gcc checkout currently contains build recipes and compiler
   binaries, not the GCC source tree, so exact quantity/allocno ordering means
   obtaining the source used by the build and/or instrumenting a matching
   diagnostic build, plus controlled experiments with minimal competing webs.
   This remains a high-value investigation for future hard allocation cases,
   even though C4 and C5 were ultimately solved by changing the reconstructed
   RTL web structure rather than by directly controlling global allocation.

   *Partially answered (2026-07-25):* the exact 2.95.2 `local-alloc.c`,
   `sched.c`, and `cse.c` are now vendored in
   `notes/scratch/gcc-2.95.2-reference/`, and
   the local-alloc eligibility rule (`REG_N_DEATHS == 1`), priority formula,
   tie/suggestion mechanics, and fake-lifetime extension are documented in
   the C4 update above. What remains unmodeled is *global*-alloc ordering
   (for genuinely multi-death webs) and a way to give `compilerTrace.ts`
   exact qty composition/suggestions instead of approximations.
2. **How broadly does the fresh-web lever generalize?** C1 solved a `mult`
   operand-order mismatch with a fresh result temp, C5 solved a larger
   allocation deadlock by letting a fused expression create fresh operand
   pseudos, and C6 solved an address `addu` operand-order mismatch by making
   the sum a fresh compiler web inside a struct-field address expression.
   The lever has now held across ALU results, expression operands, and
   address arithmetic — and C6 identified the underlying rule precisely
   (cse constant-second canonicalization, `cse.c:5585`), which retroactively
   explains C1 as well: commutative-order diffs are cse canonicalization
   artifacts, and web structure is the controllable input.
3. **C5 is resolved without a preference lever.** The matching source removes
   the reusable load-result pseudo by fusing the subtraction and pointer
   increments. The compiler's fresh operand pseudos allocate locally and
   naturally reproduce `$a0`.
4. All three candidates originally parked under `notes/scratch/` are now
   solved. C5 is evidence that a thoroughly mapped allocator frontier may
   still be the wrong problem: before escalating preference manipulation,
   test whether a natural fused expression removes the multi-death user web
   entirely. C6 adds the complementary lesson for one-instruction
   commutative-order diffs: check the pass dumps to find *which* pass
   rewrites the operand order (`.jump` → `.cse` here) and read that pass's
   canonicalization rules in the vendored sources before perturbing source —
   side-by-side variant comparison (`tools/agent/fuzzVariants.ts`) is the
   fast way to identify the surviving web-shape family.

---

## Bucket D — candidate tool gaps (the cc1/ASPSX/maspsx boundary)

### Thesis

cc1 is proven byte-identical to CC1PSX.EXE; **maspsx (the ASPSX 2.77
emulation) is not**. A real divergence at assembler macro-expansion time
cannot be fixed by changing C once the compiler assembly is fixed. But
compiler identity alone does not prove that our reconstructed C, assumed
per-file flags, or assembler-output mode produced the original compiler
assembly.

There are therefore two different claims that must not be conflated:

1. **Current workaround is load-bearing.** Ablation can prove this locally.
2. **No clean C can match because maspsx differs from ASPSX.** This requires
   assembling the *same cc1 output* through real ASPSX and maspsx and showing
   that the objects differ in exactly the target-relevant way.

Bucket D records suspicious boundary signatures and preserves working
workarounds, but it does not promote them to proven tool bugs before that
layer-by-layer differential. This distinction matters because "tool gap" can
otherwise become the next version of "register pin required."

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

**Competing interpretations**: the target shape is consistent with real
ASPSX expanding a macro instruction such as `lw $v0,D_8005E3AC` in place,
reusing the destination as its temporary base. It is also consistent with
cc1 having already emitted an explicit split pair whose pointer web naturally
received `$v0`. Our pin-stripped cc1 output does not yet distinguish those
histories.

At least four explanations remain live:

1. the original C had a different temporary web and naturally allocated the
   pointers to `$v0`/`$v1` (another Bucket C problem);
2. this translation unit used different scheduler or optimization flags;
3. the original compiler invocation/output mode emitted an atomic symbolic
   load which real ASPSX expanded, while our `-mgas` path emits explicit
   `%hi`/`%lo` split instructions;
4. real ASPSX and maspsx transform the same compiler assembly differently.

Only explanation 4 is a maspsx bug. `notes/maspsx-issue2.md` makes that layer
plausible, but does not by itself identify the cause here.

**Experimental evidence from the sweep** (all via `diffFunc`, function-local):

| Configuration | Match | Conclusion |
|---|---|---|
| Original: pins + `-fno-schedule-insns{,2}` | 100% | the workaround works |
| Pins stripped, override active | 22.2% | pins are load-bearing (force pointer into `$2`/`$3`, making the split pair coincide into self-clobbering form) |
| Pins kept, override removed | 55.6% | override is load-bearing (keeps pairs sequential; otherwise scheduler interleaves) |
| Both removed | 22.2% | no free lunch |

Contrast with every other pinned file in the sweep, where stripping the pin
changed *nothing* about the output. **That contrast is the point**: these two
workarounds are load-bearing, while the stripped pins were superstition.
Ablation is an excellent discriminator of whether a workaround affects the
current build; it is not a discriminator of *why* the workaround is needed.

**Why the workaround is retained (for now)**: the pins + override do not fake
the computation, and removing either breaks the byte match. Keeping a known,
narrow workaround is safer than replacing it with an unverified theory. It
should nevertheless be described as unresolved debt, not a proven maspsx
patch. Retirement depends on identifying which of the four explanations
above is true.

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

A self-clobbering target load (`lui $vX` followed by
`lw $vX,off($vX)`) is a useful **triage signal**, not a diagnosis. It warrants
capturing the exact cc1 `.s`, its relocations, and the final object at each
pipeline boundary. Source restructuring failure and workaround ablation add
useful evidence, but neither proves an assembler gap.

A mismatch is a **proven maspsx gap** only when:

1. the identical cc1 assembly is accepted by real ASPSX 2.77 and maspsx;
2. the resulting objects differ;
3. the ASPSX object has the target behavior while the maspsx object does not;
4. the difference is attributable to macro expansion, delay-slot handling,
   relocation, or another assembler operation—not different compiler flags
   or different assembly text.

If both assemblers produce the same mismatching object, the search returns to
source structure and compiler invocation. If they differ, fix maspsx and add
the assembly input as a regression test. Only then is an "unmatchable by C
under the current emulated pipeline" stop-rule justified.

### Bucket D open questions

1. **Run the same-input Wine differential** on representative cc1 assembly
   from SetGfxClip/SetGfxOffset. Preserve the exact text and options fed to
   each assembler; otherwise the layer being tested is ambiguous.
2. **Verify compiler invocation assumptions.** In particular, determine
   whether the original path used the same `-mgas`/assembler-output mode and
   whether these files plausibly had different scheduling flags. Exact cc1
   identity does not settle either question.
3. **Do not teach maspsx to re-join explicit split loads without proof.** If
   real ASPSX rewrites the same explicit `lui $2` / `lw $6,...($2)` input,
   maspsx should emulate it. If real ASPSX preserves those registers, rejoining
   would be a project-specific codegen patch rather than assembler emulation.
4. How many other currently-matched functions sit on this boundary? The two
   flag-override files are the known set; a scan for self-clobbering loads in
   the target binary vs. compiler/object forms would bound it.

---

## Appendix A — the "required" comment wall of shame

Every one of these HEAD-side comments was investigated during the sweep.
Verdicts: wrong = hack unnecessary, removed; half-right = mechanism real,
hack wrong; unresolved/load-bearing = ablation proves the workaround affects
output, but not whether the root cause is source, flags, compiler mode, or
assembler emulation.

| File | Comment (verbatim, HEAD) | Verdict |
|---|---|---|
| `func_80024578.c:5` | "register __asm__ required: compiler uses a2 for mflo, target uses v0" | **Wrong** — fixed by fresh temp (C1) |
| `func_8001FCE4.c:5` | "register __asm__ required: compiler uses v1 for 0x7F0000, target uses a0" | **Wrong** — stripped clean |
| `func_80021FE4.c:5` | "register __asm__ required: compiles to different instructions without it" | **Wrong** — stripped clean |
| `func_8001FE00.c:11` | "Division with zero-check - GCC doesn't generate this automatically" | **Wrong** — GCC emits it; stripped clean |
| `func_800226B0.c:4` | "register hints required: target uses $v1 for loaded value, $a0 for result" | **Wrong** — stripped clean |
| `func_8001B4E4.c:5` | "register __asm__ required: v0 must be used for both struct ptr and sll result" | **Wrong source model** — keeping `arg0` unassigned and birthing `(arg0 << 1)` inside the first consuming address produces the target allocation and schedule (C4, solved) |
| `func_8001E7DC.c:6` | "compiler uses t0 for arg0 copy, target uses a2; uses t1 for loaded temp, target uses a0" | **Wrong source model** — the target shape is real, but natural fused subtraction creates fresh local operand pseudos and matches without a reusable loaded temp (C5, solved) |
| `func_8001AF44.c:4` | "compiler assigns v1 to index and v0 to ptr, target uses v0 for index and v1 for ptr" | **Wrong** — cse constant-second canonicalization defeated by a fresh-destination struct-field address web (C6, solved) |
| `func_800244FC.c` | "Inline asm to force multu/mfhi pattern" | **Wrong** — `/14` and `%14` produce it natively (C2) |
| `SetGfxClip.c`, `SetGfxOffset.c` | "Requires -fno-schedule-insns -fno-schedule-insns2 ... self-clobbering lui/lw pattern" | **Unresolved/load-bearing** — workaround proven necessary for current source and invocation; maspsx root cause not yet proven (D1) |

## Appendix B — sweep scoreboard (2026-07-25)

- **Stripped clean (15)**: CopyVec3, func_8001ACA0, func_80021FE4,
  func_80022AF0, func_800245C8, func_8001FCE4, func_80024578, func_800132B8,
  func_80019E50, func_8001FE00, func_80020174, func_800226B0, func_8001B4D0,
  func_800217B0, func_800244FC.
- **Originally parked with classified candidates (3, all since solved)**:
  ~~func_8001B4E4 (C4)~~ — solved 2026-07-25 in clean C, see C4 update;
  ~~func_8001E7DC (C5)~~ — solved 2026-07-26 with fused post-increment
  subtraction, see C5 update; ~~func_8001AF44 (C6)~~ — solved 2026-07-25 with
  a struct-field flag-array view defeating cse constant-second
  canonicalization, see C6 update.
- **Unresolved/load-bearing, kept (2)**: SetGfxClip, SetGfxOffset (D1) + their
  flag overrides; ablation proves necessity for the current reconstruction,
  not a maspsx root cause.
- **Excluded (1)**: func_80021820 (known broken for 2.95.2 — full re-decomp,
  see next-steps step 6).
- **Verification**: `make check` byte-identical after the sweep.

## References

- `notes/next-steps-for-revisiting-the-project.md` — the parent analysis
  (root causes, six proposed steps; this sweep was step 2).
- `notes/research/func_8001B4E4-scheduler-allocator-resolution.md` — full
  research writeup of the C4 resolution (mechanism extraction from the
  2.95.2 sources, failed-strategy catalog, reusable levers).
- `notes/maspsx-issue.md`, `notes/maspsx-issue2.md` — the `la`-before-`sll`
  assembler-divergence class.
- `prompts/c-style-guide.md` — "Legacy hacks: strip first, decode the idiom"
  (Buckets A and B, distilled).
- `notes/scratch/func_8001B4E4-candidate.c`, `func_8001E7DC-candidate.c`,
  `func_8001AF44-candidate.c` — formerly parked candidates; each now records
  its resolution and mechanism.
- Hack-introduction commits: `9d010e1` (func_80024578), `1e997f8`
  (func_80020174, func_8001B4E4), `e338cf8` (func_800244FC), `da22173`
  (func_8001E7DC), `fb58365` (func_8001AF44), `78a125f` (SetGfxClip).
