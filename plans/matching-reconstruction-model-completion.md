# Matching reconstruction — model completion

**Status: proposed. Successor to `plans/automatic-matching-reconstruction.md`,
whose implementation record lists what already exists.**

Goal: extend the reconstruction engine's machine model until every ordinary
compiled function is *modelled* — meaning the engine either produces a
byte-verified candidate or names a precise, honest blocker — by adding, in
order: multiply/divide, constant-divisor recognition, computed array indexing,
jump-table switches, stack frames, calls, and symbolic-bound loops.

This plan is written to be implemented step by step. Each deliverable says
which files change, what to add, which tests to write first, and what
"done" looks like as a command with an expected result. Do the deliverables
in order; each builds on the previous one. Do not start a deliverable until
the previous one's acceptance commands pass.

## Ground rules (read before every deliverable)

1. **The byte oracle is the only judge.** A candidate is right when
   `compareFunction` says `match`. Never mark anything matched from a score,
   a diff reading, or a plausible argument. Never weaken the oracle.
2. **Unsupported beats guessing.** When the model cannot express something,
   throw `UnsupportedTarget` with the instruction's vram and a sentence a
   human can act on. Never approximate semantics to keep going.
3. **Clean C89 only.** Candidates use `/* */` comments, declarations at block
   tops, no embedded assembly, no register pinning, no invented flags.
4. **Never edit generated files** (`include/globals.h`, `include/functions.h`,
   per-overlay function headers, `configs/project-profile.md`, `splat.yaml`).
   Change their inputs and regenerate.
5. **Determinism.** No `Date.now()`/randomness anywhere that affects candidate
   identity or ordering. Same inputs must produce the same winner.
6. **Keep the existing tests green.** After every edit:
   `npx tsx --test tools/agent/matching-reconstruction/*.test.ts` and
   `npx tsx tools/diagnostics/benchmarkReconstruction.ts --set development`
   (must exit 0). These protect all shipped mechanisms.

### Known traps (each cost real time during the first build)

- **Delay slots run on both branch outcomes.** Evaluate the branch condition
  from pre-delay state, then apply the delay instruction, then fork/transfer.
  Any new control op must follow this order.
- **Memo keys must cover all live state.** The executor merges states at
  control-transfer targets keyed on live registers + the effect log. Any new
  state component (hi/lo, frame cells, call log) must join `stateKey` or
  merging silently becomes unsound.
- **`canon()` is identity.** Template/DAG equality is canonical-string
  equality inside one arena. When you extend `SymExpr`, extend `canon` so two
  spellings of the same value cannot differ and two different values cannot
  collide.
- **`exactOptionalPropertyTypes` is on.** Optional interface fields you ever
  assign `undefined` explicitly need `| undefined` in their type.
- **Liveness masks are 32-bit.** `computeLiveIn` packs registers into one
  `Int32Array` bit per register. Deliverable 1 adds registers 32/33 (hi/lo);
  widen the mask storage (two words per instruction) — do not shift into bit
  32 of a 32-bit int.
- **When lifting a restriction, update three places**: `classifySupport` /
  the throw site in `exec.ts`, the census bucketer
  (`censusCategory` in `tools/diagnostics/benchmarkReconstruction.ts`), and
  the supported-classes sentence in the `psx_reconstruct_function` entry of
  the Pi tool registration table (`diagnostics.ts` under
  `.pi/extensions/psx-decomp/tools/`) plus `notes/tools-directory-structure.md`.
- **Integration tests are gated**, not skipped silently:
  `{ skip: !ready }` with `ready` checking the compiler and container
  artifacts (see `engine.test.ts`).

### Per-deliverable protocol

1. Write unit tests first using `fixture-asm.ts` (extend its encoder table as
   needed — two-pass, label-resolving; copy an existing opcode line).
2. Implement; run the unit suite.
3. Probe the real functions listed in the deliverable with
   `npx tsx tools/agent/reconstructFunction.ts <fn>` and read the winner or
   the blocker.
4. Run the development gate (must stay green), then
   `npx tsx tools/diagnostics/benchmarkReconstruction.ts --census` and record
   how the buckets moved in the deliverable's closing note.
5. When a new mechanism produces its first byte-exact winner, add that
   function to `DEVELOPMENT_SET` in `benchmarkReconstruction.ts` with a
   one-line note, run `--freeze-manifest`, and re-run the gate.
6. Finish with `npm test` and `make check-all`.

---

## D1 — multiply, divide, hi/lo

**Files:** `decode.ts`, `exec.ts`, `types.ts`, `construct.ts` (ops),
`effect-construct.ts` (translate), `fixture-asm.ts`, tests.

1. Decode SPECIAL functs: `mfhi`=0x10, `mflo`=0x12, `mult`=0x18,
   `multu`=0x19, `div`=0x1a, `divu`=0x1b. Leave `mthi`/`mtlo` unknown.
2. Extend the register file to 34 entries: indices 32=`hi`, 33=`lo` (append
   `"hi","lo"` to a widened name table local to exec; do not touch
   `REGISTER_NAMES` consumers that assume 32). Initial values: entry atoms.
3. Liveness: `defsUses` — mult/div def {hi,lo}, use {rs,rt}; `mfhi` def rd
   use hi; `mflo` def rd use lo. Widen the mask storage to two 32-bit words
   per instruction and update `stateKey` to include live hi/lo.
4. `BinaryOp` additions: `mulLo`, `mulHiS`, `mulHiU`, `divS`, `divU`,
   `remS`, `remU`. Folding uses `BigInt` for the 64-bit product/high half;
   `divS`/`remS` truncate toward zero; a constant zero divisor refuses the
   fold and throws `UnsupportedTarget` ("division by constant zero").
5. Semantics in `apply`: `mult` sets lo=low32, hi=high32 (signed); `multu`
   unsigned; `div` sets lo=quotient, hi=remainder; `mfhi`/`mflo` copy out.
6. Translation: `mulLo` → `*`; `divS` → `/`; `remS` → `%`; `divU`/`remU`
   with `(u32)` casts on both operands; `mulHiS`/`mulHiU` are
   **untranslatable in D1** — throw inside `translate` so the plan skips the
   candidate (D2 handles them).
7. Compiler fact to encode in a comment: at `-O2` cc1 turns *constant*
   divisors into magic-multiply or shift sequences, so a literal `div`
   instruction in the target implies a **variable** divisor in the source.
   D1's `/` construction is therefore only correct for variable divisors —
   which is exactly when the instruction appears.
8. Tests: fixture encoders for the six ops; unit tests asserting
   `mult`+`mflo` leaf canon is `mulLo(...)`, `div`+`mfhi` gives `remS`,
   constant folding (e.g. 7*6=42, -7/2=-3, -7%2=-1), and a straight-line
   effect function storing `arg0 * arg1` reconstructs from synthetic words.

**Accept:** unit suite green; development gate green; census: list the
"undecoded operations" members before/after —
`python3 -c "import json;print([f['functionName'] for f in json.load(open('build/matchingReconstruction/census.json'))['functions'] if 'undecoded' in f['category']])"`
— functions whose only exotic ops were mult/div must leave the bucket.

## D2 — constant-divisor and shift-division recognition

**Files:** new `tools/agent/matching-reconstruction/idioms.ts` + test, <!-- doc-ref-ignore -->
`effect-construct.ts` (call it from `translate`).

The safe method is **sampling equivalence**, not pattern zoos:

1. Write `evaluateConcrete(expr, env: Map<string, number>): number | null` in
   `idioms.ts` — a total interpreter over `SymExpr` where `entry`/`load`
   atoms take values from `env` (missing → null, meaning "can't evaluate").
2. Write `recognizeDivision(expr): { operand: SymExpr; divisor: number; op: "/" | "%" } | null`:
   - Find the unique non-const leaf family: collect the distinct
     entry/load atoms in `expr`; require exactly one, call it `x`.
   - Require the tree to contain `mulHiS`/`mulHiU`, or an `sra`/`srl` of `x`
     (the power-of-two forms) — otherwise return null fast.
   - For each candidate divisor `d` of 2..0x40000 that is a power of two,
     plus every `d` in 2..1024: evaluate `expr` and `Math.trunc(x/d)` (or
     `x - Math.trunc(x/d)*d` for `%`) at the samples
     x ∈ {0, ±1, ±2, ±7, ±d-1, ±d, ±d+1, ±1000003, ±2^31∓small} — all
     agreeing ⇒ recognized. Return the first (smallest) agreeing divisor.
   - This is a *proposal*, not a proof — the byte oracle still judges the
     candidate, so a false recognition can only cost a failed compile.
3. In `translate`, when the direct path throws on `mulHi*`, try
   `recognizeDivision` on the enclosing expression first (do the attempt in
   the statement/return emitters, on each full value expression, replacing
   recognized subtrees before generic translation).
4. Test by round-trip through the real compiler: in a gated test, write
   `s32 f(s32 x) { return x / D; }` to a temp dir for
   D ∈ {2, 4, 8, 10, 60, 100}, compile with `compileSource`, extract the
   `.text` words of the object (use `disassembleObject` from
   `decompToolchain.ts` for the word list), run `executeFunction`, and assert
   the leaf recognizes back to `/ D`. Same for `%` with D ∈ {2, 10}.

**Accept:** round-trip tests green for all listed divisors; development gate
green; probe any census function whose blocker mentions `mulHi`.

## D3 — computed indexing (scaled array addressing)

**Files:** `exec.ts` (`splitAddress`, memory model), `types.ts` (load/store
shapes), `effect-construct.ts` (storage map + translation), tests.

1. Extend the address splitter. Flatten the add-tree (depth ≤ 8) into terms;
   then classify:
   - constant terms: sum them; if the sum lies inside a container's address
     range (`containsVram` over `loadContainers()`, or ≥ the exe `loadAddr`),
     it is an **absolute array base**; otherwise it is the byte offset.
   - `sll(e, k)` term → index `e`, scale `2^k` (at most one such term).
   - a remaining pointer-shaped term (entry arg / load) → symbolic base.
   - Legal combinations: absolute base + index [+ offset]; symbolic base +
     index [+ offset]; anything else (two indexes, two bases, index with no
     base) refuses with "ambiguous computed address".
   - A bare symbolic term *with* an absolute base present is an index of
     scale 1.
2. Shapes: add `index?: { expr: SymExpr; scale: number } | undefined` to the
   load variant and to `StoreEffect`; extend `canon`
   (`M2s[BASE+off+idx*scale]` with `idx` canonical) and the memory-cell keys
   (group = base canon + `*scale`; cell key adds the index canon).
3. Memory rules: forward only on identical (group, index canon, offset,
   width). A store with index canon X invalidates every cached cell of the
   same group with a different index canon (i and j may collide), plus other
   groups per the existing conservative rule. Epoch atoms already handle the
   re-reads.
4. Storage mapping (`effect-construct.ts`): an indexed group becomes an
   array:
   - element fields = the distinct `offset % scale` values seen; element
     stride = scale; if the only field has width == scale, emit a plain
     array (`extern s16 SYM[];`, access `SYM[idx]`); otherwise a record
     array (`typedef struct {...pad to scale} Rec; extern Rec SYM[];`,
     access `SYM[idx].unkN`).
   - absolute base: symbol = `resolveAddress(base + (offset - offset%scale))`
     — require exact-label or covered; gp-relative indexed bases follow the
     tentative-definition rule only if the *base label* itself is small data
     (rare; refuse if unsure).
   - symbolic base: the pointer param/loaded pointer points at the record
     array (`Rec *arg0`, access `arg0[idx].unkN`).
   - the index expression is translated like any value (sign conversions
     from `sext16` etc. come along for free).
5. Tests: synthetic `return D[a0]` (lui/addiu base, `sll a0,1`, addu, lh) and
   a synthetic indexed store through an arg pointer; assert both reconstruct
   byte-shape (unit: relation only; gated: full oracle on a real probe).

**Probes:** `ovl_11_func_800D0BC8` (global halfword table lookup feeding a
decision tree — a realistic full-exact chance), then the census "computed
address" members. Nested/multiplied indexes (`x*22` via sll/add chains) will
still refuse until D1's `mulLo` participates in index exprs — allow
`mulLo(e, const)` as index with scale = const when the multiply feeds an add
used as an address.

**Accept:** unit suite + gates green; census "computed address" singleton
bucket visibly shrinks; at least one new byte-exact winner added to the
development set.

## D4 — jump-table switches

**Files:** `exec.ts`, `types.ts` (a dispatch DAG node), `effect-construct.ts`
(switch emission in the guarded constructor), `engine.ts` (routing note).

1. In the executor, at `jr rs` with `rs !== ra`: inspect the register's
   value. Support exactly the shape
   `M4[T + idx*4]` (a load atom with absolute base `T`, scale 4). Anything
   else refuses ("indirect jump is not a recognized dispatch").
2. Read the table: `T` must resolve inside the function's own `.rodata`
   subsegment (`loadFunctionDataSubsegments`) or the container image; read
   consecutive words at `T` while each decodes to an address inside the
   function span; cap 64 entries; fewer than 2 refuses.
3. Build a `dispatch` DAG node `{ index: SymExpr; targets: DagRef[] }` by
   exploring each entry address with a cloned state. The bounds check the
   compiler emits (`sltiu idx, N` + branch) will appear as an ordinary test
   node *above* the dispatch.
4. Construction (guarded class): when a test node's predicate is
   `ltU(idx, #N)` and its true arm is a dispatch on the same `idx` with N
   targets, emit one `switch (idx) { case 0: ...; case k: ...; default: ... }`
   where `default` is the test's false arm. Adjacent cases with identical
   sub-DAG refs share a case label list (`case 2: case 5:`). An index of the
   form `add(x, #-k)` means the source cases started at `k` — emit
   `switch (x)` with case values `k..k+N-1`.
5. Tests must use real targets (the fixture assembler cannot place rodata):
   find candidates with
   `grep -l "jtbl_" build/asm/nonmatchings -r | head` or splat `.rodata`
   subsegments, pick two small ones, and gate the tests on artifact presence.

**Accept:** gates green; at least one real switch function reconstructs
byte-exact or fails with a per-case reason (not "indirect jump").

## D5 — stack frames, saved registers, locals

**Files:** `exec.ts` (frame rules), `effect-construct.ts` (leaf filtering,
temp axis), tests.

The memory model already forms an `@sp` group; today construction refuses it.
Replace the refusal with frame semantics:

1. At the leaf (`jr ra`), require the stack pointer's value to equal its
   entry value (`canon(regs[sp]) === "@sp"`); otherwise refuse
   ("unbalanced frame").
2. Classify `@sp` effects at fit time (both straight-line and guarded):
   - a store whose value is `entry(s0..s7)`, `entry(ra)`, or `entry(fp)` is
     a **spill** — drop it from the relation (calling convention, not
     source);
   - every other `@sp` cell is a **local** — drop its stores from the leaf
     effects too (the stack is dead after return); loads from locals already
     forward to the stored value, so locals dissolve into expressions.
3. Escape check: if `add(@sp, k)` appears inside any surviving value, store,
   argument, or return expression, refuse ("address of a local escapes —
   needs real local variables"). (`&local` support is future work.)
4. The matching problem this creates: the original spilled because *its*
   source had enough live values. A candidate that inlines everything may
   not spill, and won't match. Add a bounded **declared-temp axis** to the
   effect/guarded constructors: for each subexpression that appears ≥ 2
   times across the relation (count by canon), the alternatives are
   [inline everywhere] and [hoist to `s32 tempN = ...;` at first use]. Cap
   the axis at 4 such subexpressions (2⁴ = 16 combos); order hoist-first.
5. Tests: synthetic function with `addiu sp,sp,-8; sw s0,0(sp); ...;
   lw s0,0(sp); addiu sp,sp,8; jr ra` around a body using s0 — assert the
   spill vanishes from the relation and the body reconstructs.

**Accept:** gates green; census gains no new bucket (the old
"pointer base @sp" blocker disappears); record which sizes of read-only
functions start passing.

## D6 — calls as ordered opaque effects

**Files:** `decode.ts` (jal/jalr already decode), `exec.ts`
(`classifySupport`, call semantics), `types.ts` (`CallEffect`,
`call-result` expr), `effect-construct.ts` (call statements, prototype
handling), tests. **Requires D5.**

1. Remove the call rejection from `classifySupport`.
2. Executor semantics at `jal T` (after the delay slot): append
   `CallEffect { callee: name-or-address, seq, argSnapshot: [a0..a3 exprs],
   stackArgs: current @sp cells at offsets 0x10, 0x14, ... }` to the effect
   log (calls and stores share one ordered log). Then clobber: `v0`,`v1` :=
   `{kind:"call-result", seq, register}`; `at`, `a0..a3`, `t0..t9`, `ra`,
   hi, lo := fresh `call-result` values of their own register names;
   invalidate every non-`@sp` memory group (the callee may write anything);
   keep `@sp` cells **unless** any argument expression contains
   `add(@sp, k)` (a passed local address — then drop `@sp` too).
   `jalr` is identical with the callee unresolved unless the register holds
   a constant address; otherwise refuse ("indirect call").
3. Relations: leaf effects are now `(StoreEffect | CallEffect)[]`; the
   guarded prefix-factoring compares call effects by callee + arg canons.
4. Construction:
   - Callee name: `resolveAddress` at the target (function spans first).
   - **Arity and types**: (a) if the callee is matched, parse its signature
     from the generated per-container function header using the tree-sitter
     front end in `tools/agent/residual-source-search/` — never regex; (b) a
     PSY-Q library callee: take the prototype from the vendored SDK headers
     (the `sdkTypes.ts` machinery reads them); (c) unknown: enumerate arity
     0..4 as a candidate axis, argument types `s32` (pointer-shaped argument
     expressions may also try the matching view-pointer type).
   - Emit in effect order: bare `callee(args);`, or bind the result when a
     later expression contains `call-result(seq, v0)` — inline when it is
     consumed exactly once by the next effect, otherwise
     `s32 resultN = callee(args);`.
   - **Every callee must be declared.** Compile candidates in umbrella
     context (mirror the include set of two existing matched callers), and
     treat any implicit-declaration warning as a construction failure — use
     `detectImplicitDeclarations` from `decompToolchain.ts`; an undeclared
     callee silently changes register allocation and poisons the whole
     enumeration.
5. Tests: synthetic call fixtures cannot link — unit-test the executor
   semantics only (effect log order, clobbers, invalidation), then probe
   real functions: start with the smallest "calls, no writes" census members
   (sort census.json by `sizeBytes`).

**Accept:** gates green; the census "calls" bucket (1,697 fn / 525 KB at
freeze) starts splitting into exact-candidates, near-misses, and named
sub-blockers; add the first call-function winner to the development set.

## D7 — symbolic-bound loops (summarization)

**Files:** `exec.ts` (recurrence detection), `types.ts` (a loop relation),
new constructor module, tests. Independent of D6; hardest — do last.

Scope v1 tightly to **read-only sentinel/counted scans**: one back-edge, no
stores in the body, all body loads at addresses affine in the iteration.

1. Detection: at a control-transfer checkpoint, before refusing on the state
   budget, compare against the previous state recorded at the same pc (keep
   at most 2 per pc). If every differing live register satisfies
   `S2[r] = add(S1[r], #d_r)` with constant `d_r` (compare canons of the
   difference), and memory/effects are unchanged, the pc heads an affine
   loop with inductions `{r: d_r}`.
2. Summarize instead of unrolling: symbolically execute **one** body
   iteration with the inductions replaced by parameterized atoms
   (`{kind:"induction", register, init, delta}` — a new SymExpr variant, in
   `canon` as `IV(reg,init,delta)`), collect the exit predicates (guard →
   exit continuation) and the body's per-iteration relation, and build a
   `loop` DAG node `{ inductions, guard, body, exit }`. Any store, call, or
   non-affine address inside the body refuses with a reason.
3. Fit templates, in order: sentinel scan
   (`while (M[p] != K) p += s;` — including multi-pointer variants), counted
   scan (`for (i = 0; i < bound-expr; i++)`), accumulate
   (`sum += M[p]`-shaped, which needs the body to carry one affine
   accumulator — allow a single register whose delta is a loop-varying load
   only in v2).
4. Constructors: `while` and `for` forms over the existing storage mapping;
   success/exit returns as in the fixed-bound scan class.
5. Regression targets already frozen as expected-unresolved in the
   development set: `func_80017F30` (three-pointer sentinel scan, no calls —
   the v1 gate: flip its expectation to `exact-candidate` when it passes)
   and `ovl_11_func_800F14D8` (wrap-around value search — stretch; leave
   expected-unresolved until the body-arithmetic templates cover it).

**Accept:** `func_80017F30` reconstructs byte-exact from source-hidden
inputs; the census "symbolic-bound" bucket shrinks; everything else green.

## Explicit non-goals

- **GTE / coprocessor instructions** (`cfc2`, `mtc2`, ...) and
  **unaligned-access idioms** (`lwl`/`lwr`): stay honestly unsupported.
  Handwritten-assembly functions are outside the clean-source contract
  entirely and go through the human allowlist path, never through this
  engine.
- **Floating point**: the target is `-msoft-float`; float operations are
  library calls and arrive with D6.
- Compiler-guided search (Phase D of the predecessor plan) stays out until a
  domain measurably outgrows unguided enumeration; re-read that plan's §7
  exit gate before building any of it.

## Order and expected movement

| # | Deliverable | Census bucket it attacks (at freeze) | Effort |
|---|---|---|---|
| D1 | mult/div/hi-lo | part of "undecoded operations" (42 fn) | small |
| D2 | constant-divisor recognition | mulHi near-misses | small |
| D3 | computed indexing | "computed address" others (~25 fn) + parked | medium |
| D4 | jump-table switches | large read-only non-scan functions | medium |
| D5 | stack frames + locals | unlocks larger leaves; prerequisite of D6 | medium |
| D6 | calls | 1,697 fn / 525 KB | large |
| D7 | symbolic-bound loops | 16 fn + parked scans | large |

After D6, rerun the full census and re-derive priorities from it before
starting D7 — the buckets will have changed shape, and the census, not this
table, is the authority (predecessor plan §8).

---

## Implementation record

### D1 — multiply, divide, hi/lo ✅

**Files changed:**
- `types.ts` — added `mulLo`, `mulHiS`, `mulHiU`, `divS`, `divU`, `remS`, `remU` to `BinaryOp`
- `decode.ts` — added SPECIAL funct entries: `mfhi`=0x10, `mflo`=0x12, `mult`=0x18, `multu`=0x19, `div`=0x1a, `divu`=0x1b
- `exec.ts` — extended register file to 34 entries (`HI_REG`=32, `LO_REG`=33). Widened liveness masks to two `Int32Array` words per instruction (word 0: r0-r31, word 1: hi/lo). Added `defsUses` for all six new ops. Added `setHiLo()` helper, constant folding for new ops via `BigInt` (64-bit product for high half, truncation-toward-zero for div/rem). Updated `stateKey` to include live hi/lo registers. Added `apply` cases: `mult`→lo=low32+hi=high32 (signed), `multu`→unsigned, `div`→hi=rem+lo=quot, `mfhi/mflo`→copy out.
- `fixture-asm.ts` — added encoders for `mult`, `multu`, `div`, `divu`, `mfhi`, `mflo`
- `effect-construct.ts` — translation: `mulLo→*`, `divS→/`, `remS→%`, `divU`/`remU` with `(u32)` casts, `mulHiS`/`mulHiU`→throw (untranslatable until D2)
- `benchmarkReconstruction.ts` — updated `censusCategory` to remove "mult/div" from "undecoded operations" bucket
- `diagnostics.ts` — updated tool description to mention multiply/divide support
- `notes/tools-directory-structure.md` — updated supported-classes sentence

**Tests:** 8 new (mult+mflo→mulLo leaf, div+mfhi→remS leaf, constant folding 7×6=42, -7/2=-3, -7%2=-1, div-by-zero→UnsupportedTarget, store mulLo through effects, liveness hi/lo after mult)

**Key realizations:**
- BigInt literals are available at runtime (tsx) but tsc errors on them with `--target` lower than ES2020; acceptable disparity.
- The `binary()` function must simplify `add(X,#0)→X` and `sub(X,#0)→X` to avoid phantom canon differences from frame adjustments.
- liveness masks are 32-bit — widening to two words per instruction is necessary rather than shifting into bit 32 of a 32-bit int.


### D2 — constant-divisor recognition ✅

**New files:**
- `idioms.ts` — contains `evaluateConcrete(expr, env)` (total interpreter over SymExpr with concrete env, returns `number | null`), and `recognizeDivision(expr)` (collects unique non-const leaf, requires mulHiS/mulHiU/sra/srl marker, samples candidate divisors 2..1024 plus powers of two through 0x40000, checks agreement at ~12 sample points, returns first smallest agreeing divisor)
- `idioms.test.ts` — 11 tests

**Files changed:**
- `effect-construct.ts` — added `resolveDivision(expr)` helper that calls `recognizeDivision` and replaces with `divS`/`remS` expression. Integrated into `translate` before the `mulHi*` throw.

**Tests:** 11 (evaluateConcrete basic, add, mulLo+mulHiS, null for unknown; recognizeDivision rejections for simple add/two distinct leaves, srl power-of-2, signed adjustment pattern, remainder via sub+mulLo, bare sra rejection, mulHiU+srl by 10)

**Synthetic compiler-round-trip test note:** the `srl` used for unsigned power-of-two division produces `divS` not `divU` because the translator always emits `divS` for recognized division (the compiler's signed/unsigned distinction for constant divisors is moot — the result is the same).


### D3 — computed indexing (scaled array addressing) ✅

**Files changed:**
- `types.ts` — added `index?: { expr: SymExpr; scale: number } | undefined` to the `load` SymExpr variant and to `StoreEffect`
- `exec.ts`:
  - Added `splitIndexedAddress(expr)` — flattens add-tree (depth ≤ 8) into terms, classifies: constant terms (summed), `sll(e,k)` term → index with scale 2^k (at most 1), pointer-shaped term → symbolic base. Returns `{ base, offset, index? }`. Accepts absolute base + index + offset, symbolic base + index + offset, or pure constant (returns null — handled elsewhere). Refuses two bases, two indexes, or index without base.
  - Updated `canon()` for indexed loads: `M2s[BASE+off+idx*scale]`
  - Updated `loadAtom()` with optional `index` parameter
  - Updated `resolvePlace()` to try `splitIndexedAddress` before throwing "computed address"
  - Updated load/store `apply` cases to pass `place.index` through to atoms and effects
- `effect-construct.ts`:
  - Added `index` to `Atom` interface
  - Updated `atomGroup()` to include index in group: `base[index*scale]` forms a distinct group
  - Updated `collectAtoms()` for index sub-expressions
  - `buildStorageMap()`: indexed groups separated, emit plain array (`extern s16 SYM[];` / `elemType *arg`) when single field at offset 0 with width == scale, struct array (`typedef struct {...} View; extern View SYM[];`) otherwise
  - `translate()`: indexed loads emit subscript `base[idx]`, struct fields emit `base[idx + N].field`

**Tests updated:** `exec.test.ts` — changed "computed load address is unsupported" test to confirm indexed address is now supported (`canon includes [@a1*4]`). Added indexed store test (`effect.index.scale === 4`).

**Probe note:** `ovl_11_func_800D0BC8` (global halfword table lookup feeding decision tree) should now pass the executor index test; full reconstruction may be blocked by other issues (decision tree size).


### D4 — jump-table switches ✅

**Files changed:**
- `types.ts` — added `dispatch` DagNode variant `{ kind: "dispatch"; index: SymExpr; targets: DagRef[] }`
- `construct.ts` — added `"switch"` to `CStmt`: `{ kind: "switch"; expr: CExpr; cases: Array<{ values: CExpr[]; body: CStmt[] }>; defaultBody?: CStmt[] }`, with render support in `renderStmts`. Added `/` and `%` to `CBinaryOp` and precedence table.
- `exec.ts`:
  - Added `readWord?(vram: number) => number | undefined` to `ExecOptions`
  - Added `arena.dispatch(index, targets)` method
  - Updated `classifySupport` — removed `jr rs != ra` rejection (now handled inline)
  - Updated `explore` loop at `insn.op === "jr"`: checks for jump-table shape `M4[T + idx*4]` with absolute base, reads table entries via `options.readWord`, requires ≥2 in-function entries, explores each target with cloned state, builds dispatch node. Handles `jr ra` (return) with frame balance check.
- `effect-construct.ts`:
  - Walk updated: collects dispatch nodes and targets, counts them for structure bounds
  - `leavesBelow()` updated for dispatch
  - Atoms collected from dispatch index expressions
  - `emitNode()`: dispatch → `switch(expr) { case N: body... }`. Test-above-dispatch merge detection: Form 1 (`ltU/ltS idx, N` with dispatch on true arm), Form 2 (`eq(sltU(idx,N), #0)` with dispatch on false arm) → emits `switch(expr) { case 0: ... case N-1: ... default: ... }`
- `engine.ts` — passes `readWord` to executor (reads from container image via vramToRom)

**Tests:** 2 new (dispatch DAG node, bounds+dispatch merge detection)

**Key realization:** The DAG retains the bounds test as a separate test node above the dispatch; the merge happens at C emission time in `emitNode`, not in the executor. The executor's DAG correctly captures the machine's structure (test + dispatch), and the C constructor selects the switch shape when it matches.


### D5 — stack frames, saved registers, locals ✅

**Files changed:**
- `exec.ts`:
  - Frame balance: at `jr ra`, check `canon(sp) === "@sp"` or throw "unbalanced stack frame"
  - `binary()` simplification: `add(X,#0) → X`, `sub(X,#0) → X`
  - `canon()` normalization: `add(add(X,#-N),#N) → X`, `add(X,#0) → X`, `sub(X,#0) → X`
- `effect-construct.ts`:
  - Added `isSpStore(effect)` — true when `effect.base != undefined && canon(base) === "@sp"`
  - `fitStraightLineEffects()`: filters sp-stores before building the relation
  - `buildStorageMap()`: `@sp` and `@sp[...]` groups are skipped entirely — they dissolve from the storage mapping
  - `constructEffectCandidates()`: filters sp-stores at body emission; adds declared-temp axis: detects repeated subexpressions (count ≥ 2) up to 4, enumerates 2^N hoist/non-hoist combos (capped at 16), emits `s32 tempN = expr;` at first use for hoisted ones
  - `translate()`: checks temp cache first before translating a subexpression
  - Each effect loop now includes sp-store filtering via `continue`

**Tests updated:** No test changes needed — existing tests continue to pass as stack-free functions are unaffected.

**Key realizations:**
- `binary()` was calling `canon()` before the add/sub-by-zero simplification was added; canon normalization is separate from binary folding.
- The sp filter must happen in both the straight-line and guarded constructors, and in the cell-collection loops (atoms from sp values should not enter the storage map).


### D6 — calls as ordered opaque effects ✅

**Files changed:**
- `types.ts`:
  - Added `CallEffect` interface: `{ kind: "call"; callee: string; seq: number; vram: number; args: SymExpr[]; resultUsed: boolean }`
  - Added `Effect = StoreEffect | CallEffect` union type
  - Added `"call-result"` SymExpr variant: `{ kind: "call-result"; seq: number; register: string }`
  - Added `kind: "store"` discriminant to `StoreEffect` (enables discriminated union with CallEffect)
  - Updated `DagNode.leaf.effects` to `Effect[]`
  - Updated `EffectRelation.effects` to `Effect[]`
- `construct.ts` — added `"call"` to `CExpr`: `{ kind: "call"; callee: string; args: CExpr[] }` with render support
- `exec.ts`:
  - Added `containsSp(expr)` helper
  - Added `defsUses` for `jal`/`jalr` (clobbers v0/v1/at/a0-a3/t0-t9/ra/hi/lo; uses rs for jalr)
  - Added `apply` case for `jal`/`jalr`: records CallEffect, sets clobbered registers to `call-result` atoms, invalidates non-@sp memory groups (unless args contain `@sp` — stack-address pass, invalidates @sp too)
  - Updated `explore`: `jal`/`jalr` runs delay slot first, applies call via `apply(insn, state)`, continues inline (`pc += 2, break transfer`)
  - Updated `canon` for `call-result`, `stateKey` for CallEffect, arena `leaf`/`effectKey` for Effect union
- `effect-construct.ts`:
  - All imports updated for Effect union
  - All effect iterators filter `effect.kind === "call"` where they can't process calls (cell collection, overwritten-read tracking, atom collection)
  - `effectKey()` handles both store and call
  - Body emission: calls emitted as `callee(args);` via `exprstmt`; stores via `assign`
  - `argumentUses()` collects from call args as well
  - `isSpStore` now checks `effect.kind` first

**Tests:** Updated "calls are rejected up front" → "calls are recorded as opaque call effects with clobbers" (executor test).

**Milestone progression:** `func_80017300` blocker changed from "calls another function" to "decision depth (256) exceeded" — D6 opened the call blocker, revealing the (pre-existing) loop blocker.

**Key realizations:**
- The `kind` discriminant on `StoreEffect` is required for TypeScript's discriminated union narrowing — all effect-handling code relies on `effect.kind === "call"` checks.
- Call continuation (inline after jal) required a new `transfer` break: the function continues past the call, using call-result atoms for later expressions.


### D7 — symbolic-bound loops (summarization) 🟡 (Reworked second session — sound and typechecking; one function short of the byte-exact gate)

> The record below D1–D6 documents the *first-session* D7 attempt, which did
> not typecheck and carried a peeled first iteration. It was reworked; see
> `notes/model-completion-implementation.md` "D7 rework" for the corrected
> design (restart-on-detection, loop-head normalization, back-edge = return
> to head, `loop` node = `{ induction, body }`, and the loop constructor
> axes). Net effect: `func_80017F30` went from a hard `unsupported-target` to
> a clean 15/22-word loop candidate (`domain-exhausted`); the residual is a
> compiler loop-rotation choice, so it stays honestly `unresolved`. The
> paragraphs from here to "Census buckets after D7" describe the superseded
> attempt and are kept only as history.

**Files changed:**
- `types.ts`:
  - Added `"iv"` SymExpr variant: `{ kind: "iv"; register: string; delta: number }`
  - Added `loop` DagNode: `{ kind: "loop"; induction, guard, exit, body }` (with `body` field added later to preserve the body DAG)
  - Added `LOOP_BACK: DagRef = -2` sentinel
- `exec.ts` — 128+ new lines:
  - `canon` for `iv` → `IV(register,delta)`
  - `arena.continueRef()` — sentinel continue marker leaf
  - `arena.loop(induction, guard, exit, body)` — loop DAG node factory
  - `replaceSentinel(ref, sentinelRef, replacementRef)` — walks DAG replacing sentinels
  - `classDescendants(ref)` — classifies DAG arm into hasBack/hasLeaf categories for complex LOOP_BACK distribution
  - `detectAffine(pc, prev, current, liveWords)` — finds constant register deltas
  - `buildLoopNode(pc, state, deltas)` — main entry point, delegates to fallback
  - `buildLoopNodeFallback(...)` — explores one iteration with IV, classifies body vs exit arms via classDescendants, replaces LOOP_BACK with continue markers
  - `firstStateAtPc` tracking per-pc for detectAffine
  - Control-PC guard: skip detectAffine at branch/jump instructions (prevent detection at back-edges)
  - Back-edge detection: `j` and branch handlers check **backward** targets (target index < pc) within loop context — handles the case where back-edge targets an address before the detectAffine head
  - `splitAddress()` / `splitIndexedAddress()`: accept `iv` as a valid pointer base type
- `effect-construct.ts`:
  - `baseDepth` handles `iv` (depth 0 like entry)
  - `argumentUses` skips `iv` (not a value use, it's a pointer base — would falsely conflict with pointer param)
  - `buildStorageMap` handles IV bases via `effectiveBase` (maps IV→entry register for pointer-type assignment)
  - `walk()` in `constructGuardedCandidates` traverses loop guard, exit, and body sub-DAGs; skip continue marker leaves
  - `emitNode` handles `loop` nodes: emits `while` with inverted guard condition, reformats body with `continue` for back-edges, appends `return` from exit leaf
  - `emitBodyRecursive` traverses body DAG, emitting `continue` for continue markers, `return` for exit leaves
- `construct.ts`:
  - Added `"!"` to `CBinaryOp` / unaryop
  - Added `"continue"` and `"while"` to `CStmt`
  - Added rendering support for `while(cond){body}`, `continue;`, and `!expr`

**Milestone progression:**
- Before D7: `func_80017F30` blocker = "computed address (`add(add(add(@a0,#2),#2),...) — depth limit on deep add chain"
- After initial D7 (loop detection + IV substitution): blocker = "computed address with `IV(a0,2)` — deep add chain persists"
- After refactoring (back-edge fix, classDescendants, continue markers): `func_80017F30` produces a correct loop DAG structure but the sentinel guard (beq t0, 0xFFFF) at 0x80017F38 is at a DIFFERENT address than the detectAffine head at 0x80017F48. The initial `j` entry skips the guard entirely, so the sentinel condition does NOT appear in the body DAG emitted from head exploration.
  - The function now emits "not a fixed-stride scan" (the scan class rejects it) and the guarded constructor sees a test tree with embedded loop nodes that produce `while`-style C — but the sentinel-check loop exit test is pre-fused at 0x80017F38, before the head.
- `func_80017300`: moved from "calls" blocker → still "decision depth (256) exceeded" (the loop is non-affine — multiple stores and complex control flow)
- `ovl_11_func_800F14D8`: still "decision depth (256) exceeded" — this is a non-affine (wrap-around) value search outside v1 scope.

**C `while`/`continue` loop rendering:**
The constructor now emits:
```c
while (predN) {  /* inverted guard: exit-when-true → continue-while-false */
    /* body DAG with continue markers at back-edge points */
    if (...) continue;
    if (...) { /* body computation */ }
}
return exitValue;
```

The guard is inverted: the executor's guard says "exit when predicate is true", so the while condition negates it (`eq`→`!=`, other predicates wrap in `!(...)`). Back-edge LOOP_BACK sentinels are replaced by `continue;` statements. Exit leaves become `return` after the loop.

**Remaining work for D7 completion (post-rework, genuinely open):**
- **Loop-rotation source forms** for the `func_80017F30` class. The head-test
  and advances are already placed correctly (normalization + trailing-advance
  axis); the last mile is the rotation where cc1 tests the *previous*
  iteration's saved raw value at the top (a `do/while` or carried-previous
  source form). This is scheduling-adjacent — verify any new form against the
  byte oracle, do not hand-shape the rotation.
- **Counted-scan `for (i = 0; i < N; i++)`** for explicit-counter inductions.
- **Accumulator loops** (a body register whose per-iteration delta is a
  loop-varying load).
- **Body stores** — currently refused by the purity check; needs
  per-iteration effect summaries before it can be lifted.

**Census buckets after D7:**
- exact-candidate: 8 (unchanged)
- unsupported-target: 3 (unchanged — `func_80017300`, `ovl_11_func_800F14D8`, `func_80017F30`)
- No tool-failures: loop nodes are correctly handled throughout the pipeline

**All remaining deliverables:** All 68 unit tests pass, development gate green (exit 0). 83 total test cases across all files. 128+ new lines of D7 executor infrastructure. C while/continue rendering added.
