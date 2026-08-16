# Period idiom priors

Extracted from the C style guide on 2026-08-16. These are dated observations
about what this project's original authors tended to write, validated
2026-07-31. They are priors to test, never rules to apply — which is why they
live in notes and not in the always-loaded doctrine.

---

## 12. Period idiom priors (validated 2026-07-31)

When choosing candidate source shapes, prefer what 1999 corpora actually
show (PSY-Q samples, matched Silent Hill/ESA/soul-re, Net Yaroze, libsnd):

- Count-up indexed `for` loops (`for (i = 0; i < N; i++) a[i] = x;`).
  Countdown loops in targets are check_dbra_loop reversals of count-up
  source, not source-level countdowns. A hand-written countdown do-while can
  byte-match the loop *body* while still being the wrong experiment: the
  reversal path runs through jump.c's while/for conversion (VTOP note) and
  creates the `counter = bound` init during loop pass 1, so preheader block
  contents at gcse time, PRE insertion sites, and live lengths all differ
  from the do-while spelling. Reversal facts that gate the shape:
  - it requires a **signed `LT`** exit test — an unsigned bound leaves the
    loop count-up with an `sltu` (so a countdown target with a signed outer
    compare pins the bound's type);
  - a `beqz`/`bnez` guard is still consistent with a signed count-up when the
    bound is provably non-negative (masked or narrow) — combine rewrites
    `LE/GT 0` to `EQ/NE 0` via nonzero_bits; do not read a `beqz` guard as
    proof of a source-level `!= 0` do-while guard;
  - the reversed decrement keeps the *increment's* RTL slot: `for (;;i++)`
    puts it after the whole body, `while` with an explicit trailing `i++`
    before later statements puts it earlier — the choice is visible as the
    loop-bottom instruction order.
- Naive indexed bodies; walking pointers are strength-reduction products.
  Do not hand-write the post-transformation shape.
- ONE counter variable reused across sequential loops. This is also a
  NATURAL PRE isolation shield: the later loop's `i + 1` is a post-loop
  occurrence that isolates the earlier loop's bottom increment under gcse.
  If the target's last loop's counter register equals an earlier loop
  counter's register, write one shared variable.
- True multidimensional types even when a dimension is 1 (libsnd
  `[s_max][t_max]` tables with t_max == 1 for SEQ-only sound code); put the
  type in the globals override header.
- Literal bounds or simple `#define`s; plain signed int counters; `-1`
  sentinels; "max+1" constants for minimum scans.
- Codegen no-ops on GCC 2.95 (do not waste turns): `register`,
  init-statement order, `if (var) {}` dead refs on locals. A named
  constant local (`s32 neg1 = -1;`) does shift materialization order and is
  clean C.
- Declaration order is NOT a no-op. It fixes pseudo numbers, which fix the
  gcse expression-hash bucket order, which decides which of two PRE-created
  values owns the lower caller-save or spill slot; it also feeds the allocno
  numbering that breaks `allocno_compare` ties. When a residual is a swap of
  two same-shaped stack slots or two same-priority registers, vary the *gap*
  between the declarations, not just their order — adjacent declarations can
  collide in one hash bucket and reproduce the same order.
- `register T x asm("$N")` does not reserve a hard register in this compiler.
  Local register variables are honoured only as `asm` operands; the allocator
  will still hand the register to unrelated pseudos, so the emitted code is
  wrong rather than merely differently allocated. Use a pinned-register build
  as a *diagnostic* of allocation pressure only, never as a solution.
- `do { } while (0)` is NOT an allocation no-op: loop depth scales
  register-reference weights, so a degenerate loop reorders quantity
  priorities and can rotate local and global assignments block-wide while
  leaving the instruction shape unchanged. Never write one as an
  allocation fence — it is not period-plausible as a forcing device, and
  any score it buys is an allocation coincidence layered on an undiagnosed
  cause.
- An inline constant-address access (`*(T *)((char *)&SYM + OFF)`) folds
  at the front end into a per-use address constant: offset in the reloc,
  no `addiu`, no shared base register, and the pointer web gone. If the
  target materializes a base address once (`lui`/`addiu` of the bare
  symbol) and reuses it with plain offsets, the source needs a real
  pointer variable; the two forms differ in instruction structure and web
  population, not just allocation.
- Declare every callee with its evidenced signature before any shape or
  allocation work. An undeclared callee defaults to implicit int, and its
  dead `$v0` definition at each call site excludes `$v0` from block-local
  temporaries born after the call (until the next `$v0` write) — an
  allocation rotation no source shape can undo. A target that uses `$v0`
  as scratch immediately after a call is positive evidence the callee is
  void.
- Flat-initialized lookup tables written in natural ascending offset order:
  parallel arrays (e.g. a pointer run adjacent to a u16 count run) whose
  values are arithmetically related — each pointer the running sum of the
  counts times the element size (pool carving). Stored constants are rarely
  independent; mine them for structure (`analyzeStoreBlock.ts`) before
  treating a store block as a list of unrelated literals
  (validated 92/92 on func_80021E60).
