# ovl_11_func_800F13D8: embedded-table origin, not a hard allocation residual

## Matching source

The target is a five-record search: return 1 on the first record whose signed
halfword at +0 is zero and whose signed halfword at +2 equals the unsigned
16-bit argument; otherwise return 0. Records are 12 bytes apart.

The matching reconstruction uses an ordinary `for` loop, a zero-initialized
result, and `break` on a match. Its important declaration is a partial view of
`D_8006C838` containing `s16 records[5][6]` at offset 0x7A78, not a separate
`D_800742B0` global. The arithmetic identity is:

```
0x8006C838 + 0x7A78 = 0x800742B0
```

The view is `D8006C838RecordTableView` in `include/game_types.h`. It does not
claim to recover the full containing object or the historical field names.
The existing matched searches `ovl_11_func_800DBB94` and
`ovl_11_func_800DBF60`, and writer `ovl_11_func_800DBE9C`, independently identify
the same table through the parent base. Source-family membership is recorded
in `notes/file-groupings.md`; this is not proof that the distant functions
were in one translation unit.

## Measured distinctions

At takeover the saved ledger contained 29 measurements and 21 distinct
outputs. The live source had explicitly separated the first iteration and
was accompanied by a `-fno-rerun-cse-after-loop` override. Its saved flag
probe was inconclusive and had no target fingerprint. That override and its
allowlist entry were removed. The match uses the normal configured flags.

Controlled candidates are preserved under
`build/investigation/ovl_11_func_800F13D8/` and the experiment ledger:

- `natural-break.c`: a standalone array of scalar-field records. Its loop
  trace combines both field addresses into one induction pointer.
- `short-records.c`: a standalone two-dimensional halfword array. The first
  loop pass moves the second field's base, but the first field's low address
  only moves in pass 2; the remaining walk still contains base-plus-offset
  arithmetic. Residual `[0, 10, 0, 5]`.
- `parent-cursor-init-order.c`: explicit byte cursors reconstruct the entire
  instruction sequence, but leave a status-pointer / first-loaded-value
  register swap. Residual `[0, 0, 0, 2]`, 22/29 words. This is a useful example
  of a locally accurate allocation diagnosis under the wrong source origin.
- `embedded-record-table.c`: the embedded halfword array and natural indexed
  loop. Residual `[0, 0, 0, 0]`, byte-exact 29/29. Moving the view declaration
  to the shared header preserves the exact result.

The matching source's loop trace reports two distinct field-base movables
at UIDs 40 and 64 in pass 1, with address induction variables reduced for
both accesses. The standalone-array trace does not have that same pass-1
availability. These are observations of compiled candidates, not recovered
historical RTL. No per-file flag change or register workaround is required.

## Implication for automatic reconstruction

A disassembler's address label is not necessarily an original C object
boundary. Here, treating the label as a standalone global restricted the
candidate space before any allocation or scheduler solver ran. The same
memory accesses, expressed through the containing object, reached a different
loop-optimization history and matched.

A matching decompiler should retain containing-object/subobject alternatives,
use other functions' accesses as independent layout evidence, and test their
compiler consequences. An allocation-only search over the explicit-cursor
candidate would miss this solution. This case establishes one concrete
mechanism to support, not a general coverage claim for a future synthesizer.

## Diagnostic caveats exposed during this investigation

1. `tools/agent/pipeline-reversal/reverse.ts` caches compiled candidates with
   the source file and toolchain identity, but does not include
   `configs/flag_overrides.mk` in its declared input files. After removing the
   override, `psx_residual_objective` reused an object whose assembly header
   still listed the removed flag. Invalidating only this function's
   `candidate-object.json` records caused a real recompile and a changed
   result for `natural-break.c`. The stale assembly and stopped-agent files
   are preserved in the investigation's `stopped-agent/` directory. The
   tooling implementation itself was not changed in this task.
2. The inventory report compares symbolic displacements: the exact source
   still reports a +0x7A78 access where the target uses the subobject label.
   Relocated byte equality resolves that apparent discrepancy; the raw
   displacement inventory must not be interpreted as a semantic difference
   across these different object origins.
3. The pipeline reversal's round-trip check failed on the explicit-cursor
   candidate despite its correct final instruction-shape sequence. Its
   ordering reconstruction was therefore provisional. The final byte oracle,
   not that inferred ordering, established the match.
