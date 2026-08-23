# loop-trace fixtures

`ovl_10_func_800BA394.loop` is a real `-dL` dump, not a hand-written sample. It
was produced by

    npx tsx tools/agent/loopTrace.ts ovl_10_func_800BA394 --source <the parked
      best attempt, the `#if 0` block in src/overlays/ovl_10/ovl_10_func_800BA394.c>

under the project's own overlay cc1 flags, and copied out of
`build/loopTrace/ovl_10_func_800BA394/`. It is the function the tool was built
for: 477/479 words with no differing word, the whole residual being where two
preheader instructions sit.

It exercises the parts of the grammar this codebase actually produces — two
passes over three nested loops, movables that move and one that is not
desirable, a `forces` pair, two `done ... matches` movables, three givs that
combine and reduce to one pseudo, rejected givs, and both `Loop iterations:`
and `Final biv value` lines from `unroll.c`.

`and-tail.loop` and `break-tail.loop` are the same function compiled from two
real, measured spellings of one inner-loop tail, and they are a fixture *pair*:
the only difference in what they exercise is the one the pair exists to pin.

- `and-tail.loop` — the `&&`-form tail (`while (j < 0x10 && idx < count)`). That
  lays the inner loop out with an entry jump, gcse's PRE insertions land between
  `NOTE_INSN_LOOP_BEG` and that jump, and `loop.c:740` discards the loop as
  *phony* without scanning it. Produced from
  `build/experimentLedger/sources/ovl_10_func_800BA394/0f7cc8e64767c01f.c`.
- `break-tail.loop` — the break-form tail of the byte-exact source in
  `src/overlays/ovl_10/ovl_10_func_800BA394.c`. Same loops, no phony record, and
  it carries the two-stage cascade: pass 1 hoists insn 1227/1228 out of the
  inner loop to 1641/1643, and pass 2 of the enclosing loop re-hoists 1642/1643
  into the outer preheader.

Both are trimmed rather than edited. `break-tail.loop` keeps the messages only;
`and-tail.loop` keeps the messages plus the window of post-pass RTL around the
phony loop's `NOTE_INSN_LOOP_BEG`, which is what the cause analysis reads. No
line of either was rewritten.

`sibling-parked.loop` is the cluster-mate `ovl_10_func_800B95F0`'s preserved
parked attempt, messages only, from `build/loopTrace/`. It is here as the other
half of a donor comparison: it declines the exact giv shape `break-tail.loop`
reduces, which is the difference the two functions' sessions never compared.

`synthetic.loop` covers the rest of the grammar, which no function in this
target has produced yet: ignored loops, `not safe`, `cond`/`global`/
`consec` flags, `halved since already moved`, a `print_rtl` expression that
wraps across lines, two functions in one dump, a phony loop with no RTL to
resolve its cause from, and a line the grammar does not cover. It is hand-written from the `fprintf (loop_dump_stream, ...)` calls in
`tools/vendor/gcc/2.95.2/src/gcc/loop.c`, and is labelled synthetic because
nothing measured it.
