# Flag hypothesis — probe early, apply on evidence

Per-file flag overrides are per-TU facts of the original build, not hacks.
They are permitted when the evidence bar below is met, and forbidden as
speculative flag-shopping when it is not.

Loaded on demand by `psx_reference`. Read the sheet for the pass the
pipeline reversal named, and only that one.

---

## 11. Flag hypothesis: probe early, apply on evidence

Per-file flag overrides are a legitimate, evidence-gated matching tool.
Original TUs really were compiled with per-file flags, and an override can
be the TU's true state rather than a workaround; a proven flag is a per-TU
fact — record it in the file-groupings ledger and expect it on the group's
other members. Some fingerprint classes are unreachable under baseline
flags outright (example: an adjacent symbolic lui/lw self-clobber pair with
an unfillable load-delay nop is the unsplit assembler-macro load; under
split addresses the lui is an independent insn that the post-reload
scheduler lifts whenever its destination register has no intervening
hazard, so no source shape or allocation pins it).

When a target carries a structural fingerprint that is hard or impossible to
reach from natural C under the baseline flags, run `psx_flag_probe` EARLY —
before deep source archaeology — and read its three evidence sources: target
fingerprints (decoded from original bytes, no source needed), a flag-matrix
score of the current source, and nearby overrides (flags are per-TU, so
neighbors share them). The evidence bar: a fingerprint, plus a flag column
that dominates baseline, plus no contrary witness in the same region. When
the bar is met, apply the override yourself: add the `CC1FLAGS_<stem>` entry
in `configs/flag_overrides.mk` with a comment stating the evidence, and add
the matching `flag-override` allowlist entry in the project configuration in
the same change — the allowlist entry is the audit trail the policy gate
enforces. Do not stop at "proposing" an override the evidence already
supports; do not add one without a fingerprint. A probe that shows baseline
equal to the flag delta means the flag is NOT the answer and the source shape
is (func_8001FF98: the probe's matrix exposed exactly this, killing a wrong
override within minutes).

