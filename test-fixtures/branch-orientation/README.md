# Branch-orientation regression evidence

These are text fixtures, not source replacements or promotion candidates.
Tests resolve all headers and compile with the active production toolchain.
No binary artifacts are tracked.

## Preserved session inputs

`parked.c`, `t1.c`, `t5.c`, `final.c` are byte-for-byte copies of the
same-named files under `build/e090_claude/`. The `.rtl` and `.jump` files are
copies of that session's corresponding `<name>.i.<stage>` dumps. Function:
`ovl_11_func_8011E090`. SHA-256 manifest: `sha256.json`.

- `t1`: flag test UID 241 has an assignment-hoist witness (`jump.c:596`).
- `t5`: UID 249 folds into a Boolean SET (`jump.c:870/:1021`). An intermediate
  assignment hoist inside the same pass is not visible and is not attributed.
- `final`: tail UIDs 232 and 240 are unchanged, including exit-label aliases.
- `parked`: fresh compilation detects an opposite-sense return branch, but
  expand/jump shows **jump-over-jump inversion**, not an assignment hoist.
  This remains `undetermined` in the supported classification, with the
  observed `jump.c:1733` shape recorded as evidence.

`address-corrected.c` preserves parked's tail and changes only the grid-address
statements: declare `idx`/`tbl`, compute the scaled offset before splitting the
base, then form the table pointer. Contrary to the proposed acceptance premise,
this source is **already byte-exact**. `address-corrected-nested.c` is generated
from it with the grammar's plain nested tail; that source genuinely mismatches.
The production sweep repairs it with `nested-duplicate-1`: the outer
`else { return 0; }`, followed by the final `return 0;`, is EXACT. The `and` and
plain nested forms show :596; early returns show a fold; OR shows the observed
inversion, not :596. An OR-inverted spelling is also EXACT.

The opposite-direction sibling test reads `ovl_11_func_800D7EF8`'s original
words directly and changes only the final branch/constant positions in a MIR
test candidate. It is a detector regression, not a compiled C reconstruction
of that sibling. `ovl_11_func_801136D0`'s matched C is a negative control.

## Historical search run

`historical-input.c`, `historical-semantic-graph.json` and
`historical-grammar.json` are snapshots from
`build/residualSourceSearch/ovl_11_func_8011E090/28ba8c82fa398cad/`.
`historical-cost.json` retains only that run's estimate (not its class table),
plus the recorded 17.6-minute observation. The 60,672-candidate, 23-job pilot
measured 330.681939 ms versus the idle median's 50.958752 ms. Repricing gives
14.5 minutes, within 25% of observed, rather than 2.2 minutes.

`historical-located.json` records the located blocks/lines reproduced from that
input with pipeline reversal and its original verified line-note/correspondence
artifacts. Block 9 has no surviving candidate UID for the target's literal
result; its lines are the conservative union of **all** source returns, not an
exact line attribution. None belongs to an order region, but `web:ptr#0`
genuinely touches the expression return. The warning therefore says outside
statement/control regions and explicitly retains the web axis: renaming that
operand is not coverage of adding a return arm. Unknown bindings elsewhere
remain undetermined. These are advisory caveats, never an impossibility proof.
