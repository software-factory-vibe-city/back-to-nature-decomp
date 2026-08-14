# Allowlist key casing — human decision needed

- **Filed:** 2026-08-14 (during the func_80014CBC finalization)
- **Reason:** latent config defect, one-character fix awaiting sign-off

## The defect

The source-policy checker
(`.pi/extensions/psx-decomp/autonomous/source-policy.ts:26`) looks up
allowlist entries by `name.toLowerCase()` (or lowercased vram), but reads
the stored keys as-is. A key containing uppercase hex letters can
therefore never match by name.

Exactly one entry in `.pi/autodecomp.json` is affected:
`func_8001FEA4` (`register-asm, embedded-asm`). Its exception is silently
non-functional and will surface as a spurious asm-policy blocker the next
time `src/func_8001FEA4.c` is touched. (Keys whose hex digits are all
numeric are case-neutral and fine; `func_80014cbc` was added lowercase
after hitting this exact mismatch.)

## The decision

Either rename the key to `func_8001fea4` (behavior-preserving, restores
the intended exception), or take the occasion to re-audit whether that
function's constructs still need the exception at all (the strip-legacy-
workarounds procedure in the style guide §9). The rename is the
one-character fix; the audit is optional hygiene.
