# Pass-2 hoist guard fixtures

Text-only regression inputs for `hoist-guard.test.ts` and
`tools/agent/closed-directions.test.ts`. Original machine code and the configured
production toolchain remain the integration oracle; no binary/object fixtures
are checked in.

## Provenance

- `prior-best.c`: preserved `build/9be4_claude/prior_best.c`, with the retired
  `Ovl11F9BE4View` typedef inlined so it compiles with the current headers.
- `slot-local.c`: preserved `build/9be4_claude/slot-local.c`. This applies the
  six-byte slot view and expresses each of the four reads through one invariant
  local base. Its all-local output is identical to the prior-best output.
- `prior-best.loop`: text loop log from `build/9be4_claude/base.i.loop`.
- `committed.loop`: text loop log from `build/9be4_claude/final.i.loop`.
- `all-global.loop`: text loop log from
  `build/9be4_claude/v1/slots_glob.i.loop`.
- `legacy-closure.json`: unchanged schema-2 row at
  `2026-10-09T16:03:18.149Z` in
  `build/experimentLedger/closed/ovl_11_func_800F9BE4.jsonl`.

The logs retain the emitted RTL, not just selected comparisons; only trailing
whitespace has been stripped. Standalone log
arithmetic tests use the independently established non-fixed-register count of
28 and supply call presence for the 39-insn loop. Integration tests derive call
presence and affine identities from fresh production dumps instead.

## Expected measurements

| Source | Pass-1 N | Threshold at 8 | Threshold at 17 | Decision goals |
|---|---:|---:|---:|---|
| Prior best | 34 | 55 | 52 | 8:p1 MET, 17:p2 NOT MET (short 19) |
| Committed | 44 | 52 | 43 | Both MET |
| All global | 48 | 46 | — | 8:p1 NOT MET: wrong flip |

The prepared `slot-local.c` has four licensed AST access sites, hence 16
choices. Only `m05` and `m10` are byte-exact, and both meet both goals. The
all-global `m15` violates the must-hold 8 goal. UIDs differ between fixture
spellings; joins use values/affine giv identities, never hard-coded UIDs.

**Raw-source-only acceptance:** the constant-offset grammar recognises raw
`prior-best.c`'s `tbl` initializer without changing casts or units. Its raw
family has four sites and 16 choices: two meet both goals but none is EXACT.
The sweep automatically catalogues compatible named record-array views already
in the input's preprocessed headers, production-measures their layout and
proves guarded, in-bounds byte-affine read equivalence. The discovered slot
family is re-traced and independently swept alongside the raw family: 32/32
EXHAUSTIVE choices, exactly `m05` and `m10` EXACT, both goals met. Input source
is unchanged and winners pass clean-source policy. This uses no committed
body/donor, manual slot preparation or target-specific type/offset rule.
Reports preserve layouts, source ranges, affine equalities and index bounds;
compatible alternative views stay separate. Goal matching remains distinct
from the byte oracle's EXACT verdict.

The committed mixed-route source is a third integration fixture: sampling
`m00`, `m05`, `m10`, `m15` retains both EXACT shapes, while reporting 4/16
SAMPLED coverage and no closure certificate. The prepared slot-view fixture
still provides the exhaustive 16/16, two-EXACT result. Exhaustive closure
certificates are limited to the stable source/context/representation families
and window/site sets actually searched; failed preparation prevents retirement.

`tools/agent/hoist-knob-sites.test.ts` also backtests three executable C89
fixtures (byte offset, element offset, nested subtraction) across all four
local/global combinations. Each is compared with the original program, with
checks against variable offsets, pointer loads, side effects, VLA casts,
shadowing and preprocessor-expanded pointer updates/escapes. Host execution is
an additional semantic smoke test, not the PlayStation byte oracle.

`tools/agent/hoist-record-views.test.ts` production-measures differently named
record layouts and enumerates ambiguous views. Three executable C89 fixtures
(do/for loops and an octal offset) compare all 16 normalised access routes
against the original. Negative cases cover stride/origin/bounds errors,
parenthesized counter mutations, shadowing, escapes, volatile counters,
conditional initialization, goto and preprocessor changes to guards/reads.

Integration tests skip when the original target assembly is not provisioned;
pure log/AST/closure tests still run. The executable smoke test additionally
skips without host `cc`. Nothing writes live C or promotes a winner.
