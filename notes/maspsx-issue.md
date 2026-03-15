# maspsx issue: ASPSX 2.56+ expands `li` to `addiu`, not `ori`

## Summary

When `--aspsx-version` is set to 2.56 or higher, `li $reg, <small positive value>` should be expanded to `addiu $reg, $zero, value` rather than `ori $reg, $zero, value`. Currently maspsx produces `ori` in all cases, which generates the wrong opcode for games built with PSY-Q 4.0+ (ASPSX 2.56+).

## Details

ASPSX versions prior to 2.56 expand `li $v0, 23` to:
```
ori $v0, $zero, 23      # opcode 0x34020017
```

ASPSX 2.56+ expands the same instruction to:
```
addiu $v0, $zero, 23    # opcode 0x24020017
```

Both instructions produce identical results at runtime (the value 23 ends up in `$v0`), but the opcodes differ (`0x34` vs `0x24`), which breaks byte-matching decompilation.

This is already acknowledged in `maspsx/__init__.py` line 238:
```python
# ori is actually addiu on ASPSX 2.56+
```

And the Known Differences table in the README shows:
| Behavior | < 2.56 | >= 2.56 |
|---|---|---|
| li 1 expands to ori 1 | Yes | No |

## Current behavior

When `--aspsx-version >= 2.50` is passed, maspsx sets `expand_li = False`, leaving `li` for GNU `as` to handle. GNU `as` also expands `li` to `ori`, so the result is `ori` regardless of the version flag.

When no `--aspsx-version` is passed, maspsx expands `li` itself via `expand_load_immediate()`, which explicitly uses `ori` for all positive values (line 222-223).

There is no code path that produces `addiu` for small positive values.

## Expected behavior

For `--aspsx-version` 2.56 and above:
- `li $reg, value` where `0 < value < 0x8000` → `addiu $reg, $zero, value`
- `li $reg, value` where `0x8000 <= value < 0x10000` → `ori $reg, $zero, value` (sign-extension semantics differ, so `ori` is still correct here)
- Negative values already correctly use `addiu`

## Evidence

Examining a PSY-Q 4.60+ binary (SLUS-01115):
- **1,142 instances** of `addiu $reg, $zero, value` for small positive constants
- **87 instances** of `ori $reg, $zero, value` — all with values >= 0x8000 (0xFFFF, 0x8000, 0xEA5F, etc.) where sign-extension semantics require `ori`

## Proposed fix

1. Add a `li_addiu` flag to `expand_load_immediate()` and `MaspsxProcessor`
2. When `--aspsx-version >= 2.56`, set `li_addiu = True` and keep `expand_li = True` (so maspsx handles the expansion rather than GNU `as`)
3. In `expand_load_immediate()`, use `addiu` instead of `ori` for `0 < value < 0x8000` when `li_addiu` is set

## Why this hasn't surfaced before

Most actively-decomped PSX games (SotN, Crash Team Racing, Croc) used older PSY-Q SDKs (3.3-3.5, ASPSX 2.21-2.34) where `ori` is the correct expansion. Games built with PSY-Q 4.0+ are rarer in the decomp community.
