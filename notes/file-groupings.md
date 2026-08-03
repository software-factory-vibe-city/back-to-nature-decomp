# Suspected source-file groupings (ledger)

Lightweight, hand-maintained priors about which functions belonged to the
same original translation unit. NOT authoritative — `configs/splat.yaml` is
the source of truth for actual splits; this file records *suspected*
groupings with the evidence that justifies them.

Why it matters: same-file membership has compiler-visible consequences —
shared TU-level quirks (e.g. a file-scope register variable reserving a
register for everything after its declaration point), shared idiom priors,
shared static/global data clusters, and declaration-order effects. Knowing
the group changed func_8001E9F8 from a multi-session mystery into a
15-minute solve.

Rules:
- Every entry cites its evidence class (shared gp-rel cluster, call graph,
  TU quirk, address adjacency, shared idiom). No evidence, no entry.
- Update in the same session that produces new grouping evidence (new
  shared global, new caller, confirmed/denied member). Correct entries that
  turn out wrong; do not let them linger.
- Confidence: high = multiple independent fingerprints; medium = one strong
  fingerprint; low = adjacency/negative evidence only.
- Match status notation: (m) matched in src/, (s) stub, (?) membership
  uncertain.

Scope: membership and evidence only. A member's role gets one line — what it
appears to do and how it relates to its neighbours. Matching technique,
debugging advice, and per-function solve detail belong in
`notes/research/` or `notes/retros/`; an active decompilation effort belongs
in its campaign note. Keep this file readable as a map.

---

## "collision.c" — 0x8001E334–0x8001EFA4 (confidence: high)

Floor/surface collision subsystem: walkmesh quads split into triangle
tests against a query point, hit recorded in globals.

Fingerprints:
- shared gp-rel cluster D_8005E4F0–D_8005E528 (query point, tolerances,
  cross products, hit flag, hit-triangle vertex pointers — semantic
  hypotheses annotated in include/globals_override.h);
- TU-wide quirk: a file-scope `register s32 x asm("$2")` declared between
  func_8001E878 and func_8001E9F8 — functions before it use $v0 as
  scratch, functions after have it reserved (byte-verified in both);
- internal call graph: E4C0 (driver) → E78C/EAE4/E38C/E7DC;
  EAE4 (poly iterator) → E878 ×4 + E9F8 ×4; E9F8 → E878 ×2;
  E38C → func_80038674 (external consumer).

Members (address order):
- SetVal8005E51C 0x8001E334 (m) — tolerance setter
- func_8001E340 (s)(?) — tiny; touches no cluster globals
- func_8001E38C (s) — post-hit consumer, guards on D_8005E528
- func_8001E4C0 (s) — driver: clears flags, installs query pointer
- func_8001E6FC (s) — small; query pointer + D_8005E524
- func_8001E78C (m)
- func_8001E7DC (m)
- func_8001E878 (m) — point-in-triangle; CAPTURE_PREV_RET policy exception
- func_8001E9F8 (m) — point-in-quad; file-scope $2 register variable
- func_8001EAE4 (s) — polygon-list iterator, flag masks D_8005E4FC
- func_8001EFA4 (s)(?) — touches no cluster globals; possible file tail

References: notes/research/func_8001E878-dead-spill-allocation.md §9,
notes/research/func_8001E9F8.md.

## unknown group A — 0x8001E04C–0x8001E26C (confidence: low)

Address-adjacent block preceding collision.c; none of its functions touch
the collision cluster (checked 2026-07-31), so the file boundary likely
falls between func_8001E26C and SetVal8005E51C. No positive grouping
evidence yet — recorded to mark the boundary question.
Members: func_8001E04C (s), func_8001E088 (s), func_8001E0B8 (s),
func_8001E158 (m), func_8001E160 (s), func_8001E26C (s).

## "grid-cursor.c" — around 0x80023DBC–0x800243D0 (confidence: low)

D-pad cursor movement on a 14-column grid (menu/keyboard screen?).
Fingerprints: func_800241EC (m) directly calls func_800243D0 (s) as its
default vertical-move handler (call graph + address adjacency, 0x800243D0
begins just past 0x800241EC's end); shared absolute-addressed parallel
table cluster D_80055994/D_800559BC (bounds byte-table bases) and
D_800559C4 (handler function pointers). func_80023DBC (s)(?) is the sole
caller. Handlers stored in D_800559C4 are unidentified — resolving them
would extend the group.
Members: func_80023DBC (s)(?), func_800241EC (m), func_800243D0 (s).

## sprite renderers — 0x80015E3C–0x80016B7C (confidence: high)

Two contiguous wrapper/renderer families for drawing source-data entries as
PSY-Q primitives. An active campaign is decompiling the remaining members —
see `notes/sprite-renderer-family-campaign.md` for status, working order, and
the evidence each match feeds back into the func_80016280 hybrid audit.

Fingerprints:
- internal call graph: func_80015E3C and func_80015EE8 call func_80016280;
  func_80015E78, func_80015F80, func_80016054, func_800160C8, and
  func_800161AC call func_800165D8;
- both renderers decode the same source-data layout (`field_1C`, `field_20`,
  `field_24`, `field_28`, and `field_2C`), use the same 0xFFFE header guard,
  and walk the same 12-byte entry records;
- address adjacency and wrapper forwarding preserve the same byte/halfword
  argument roles and bracket both renderers with no unrelated function;
- func_80016054 and func_80015704 (before this range) both expand the same
  CAPTURE_RA caller-log asm idiom (`addu $8,<addr>,$0; sw $31,0($8)`),
  suggesting a shared studio debug header or the same TU — see
  `notes/research/caller-capture-debug-hook.md`.

Members (address order):
- func_80015E3C (m) — thin func_80016280 wrapper (8 params: 4 register + 4 stack)
- func_80015E78 (m) — thin func_800165D8 wrapper
- func_80015EE8 (m) — packet setup/teardown around func_80016280
- func_80015F80 (m) — packet setup/teardown around func_800165D8
- func_80016054 (m) — func_800165D8 wrapper with CAPTURE_RA caller-log hook
  (include/debughook.h)
- func_800160C8 (m) — packet setup/teardown around func_800165D8 (13 params)
- func_800161AC (m) — packet setup/teardown around func_800165D8
- func_80016280 (m) — SPRT/DR_MODE renderer, active C/asm hybrid
  (see research/func_80016280-web-parity-and-register-recurrence.md)
- func_800165D8 (s) — larger direct-primitive renderer
- func_80016B7C (m) — sprite data size calculator; calls func_80015B24 (entry
  search/bcmp) + func_8001782C (tile load/LoadImage); sole caller is
  func_80016C08
- func_80016C08 (s) — sprite entry loop driver; calls func_80016B7C twice
  per iteration

Technique and per-function detail for this group live in
`notes/sprite-renderer-family-campaign.md`; the frame-size/arity diagnostic
these wrappers illustrate is in
`notes/research/frame-size-arity-diagnostic.md`.

## candidates to investigate

- func_80021E60's pool-carving table neighborhood (19-entry pointer/count
  parallel arrays over 0x18-byte elements) — likely has sibling functions
  reading the same table; no membership evidence collected yet.
