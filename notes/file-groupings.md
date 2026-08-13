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
- func_8001E78C (m) — 2D proximity test; owns D_8005E520 (tolerance)
- func_8001E7DC (m) — 3D form of E78C, same D_8005E520 tolerance
- func_8001E878 (m) — point-in-triangle; CAPTURE_PREV_RET policy exception
- func_8001E9F8 (m) — point-in-quad; file-scope $2 register variable
- func_8001EAE4 (s) — polygon-list iterator, flag masks D_8005E4FC
- func_8001EFA4 (m) — no longer suspected collision.c member. See viewport.c group below.

References: notes/research/func_8001E878-dead-spill-allocation.md §9,
notes/research/func_8001E9F8.md.

## viewport/camera setup — 0x8001EFA4–0x8001F24C (confidence: high)

Viewport area and camera-rotation setup: func_8001EFA4 sets viewport dimensions
(800×600) and calls func_8001F1E0 to compute rotated camera offset vectors, then
copies the result into a Vec3 and sets status flags.

Fingerprints:
- shared gp-rel cluster D_8005E2EC–D_8005E314 (viewport dimensions, status flags,
  offsets) — func_8001EFA4 and func_8001F038 both define the overlapping subset
  D_8005E2EE, D_8005E2F8, D_8005E2FC, D_8005E300 as tentative definitions
  (GP-relative), which is the strongest same-TU signal.
- internal call graph: func_8001EFA4 → func_8001F038, func_8001F1E0
- address adjacency: all three are consecutive with no unrelated code between them.

Members (address order):
- func_8001EFA4 (m) — viewport setup driver; sets 800×600, calls F038 and F1E0,
  then copies result and sets flags (D_8005E2EC=2, D_8005E2ED=1)
- func_8001F038 (m) — viewport dimension setter; stores width/height/depth,
  sets dirty flag on change
- func_8001F1E0 (m) — rotated camera-offset vector calculator; uses rcos/rsin
  trig with yaw argument

## sprite frame setup and OT — 0x8001AFE0–0x8001B118 (confidence: medium)

Sprite data-area setup: clear the OT ring at D_8005F2E8, load sprite data,
initialize the SpriteSourceData at D_8005F2B8, and flush it via DrawOTag.
func_8001B074 is the byte-matched core.

Fingerprints:
- shared data cluster D_8005F2B8 (SpriteSourceData, GP/absolute), D_8005F2E8
  (OT ring base, cleared by func_8001AFE0 memset 0x1300), D_800605F0 (sprite
  header), and the sprite flags D_8005E2CC / D_8005E2D0 (B074 defines
  D_8005E2CC; func_8001B118 reads it and D_8005E2D0 as a render lock)
- address adjacency: AFE0-B028-B074-B118 consecutive; func_8001B118 shares
  the same split OT base materialization (lui s1/addiu D_8005F2E8) and the
  renderer framework D_8005E3A4/D_8005E3C0
- call graph: func_8001AFE0 → func_8001B074; func_8001B028 → func_8001B074;
  func_8001B074 → func_80012A14, func_8001719C (sprite data load),
  func_80015704 (sprite source init), func_80015840 (sprite reset)

Members (address order):
- func_8001AFE0 (s) — sprite reset: memsets &D_8005F2E8 0x1300 bytes, calls B074
- func_8001B028 (s) — wrapper: s16-scaled args, calls B074
- func_8001B074 (m, 2026-08) — sprite/OT init: two ClearOTagR on D_8005F2E8
  halves, initializes SpriteSourceData via func_80015704, sets D_8005E2CC = 1
- func_8001B118 (s) — sprite flush: guards D_8005E2CC/D_8005E2D0, DrawOTag
  from the D_8005F2E8 base, ClearOTagR

## pad/controller entry processing — 0x8001B2CC–0x8001B4E4 (confidence: medium)

Per-entry processing of the controller/pad state tables indexed by an id:
func_8001B3EC advances an entry pointer, func_8001B4E4 resets it.

Fingerprints:
- shared gp-rel cluster D_8005E4C0 / D_8005E4C4 / D_8005E4C8 / D_8005E4D0
  (s16/u16 count table at 0x8005E4C0, s32 pointer table at 0x8005E4C8) —
  reached gp-relatively by func_8001B2CC, func_8001B3EC, func_8001B4D0,
  func_8001B4E4
- internal call graph: func_8001B3EC → func_8001B4E4 (deactivate when
  entry byte is 0xFF)
- both B3EC and B4E4 write struct_8005E870 field_36/field_37 (offsets
  0x36/0x37)
- address adjacency: B2CC–B4E4 is consecutive with no unrelated code between

Members (address order):
- func_8001B2CC (s) — touches T_8005E4C8; likely same entry family
- func_8001B3EC (m) — entry processing: reads D_8005E4C8[arg0] pointer, bumps
  D_8005E4C0[arg0] counter, compares counter against (byte at +2) >> 1; on
  overflow advances pointer by 3 and resets counter; calls B4E4 on 0xFF byte;
  sets D_8005E870 flags from byte bits
- func_8001B4D0 (s) — touches T_8005E4C8; likely same entry family
- func_8001B4E4 (m) — deactivation: zeroes D_8005E4C8[arg0] pointer and the
  u16 entries (D_8005E4C0/C4/D0) and D_8005E870 field_36/field_37

## projected primitive clipping — 0x8001C0D4–0x8001D348 (confidence: medium)

GTE-projected triangle/quad rendering and screen-X rejection. Fingerprints:
func_8001C37C directly calls both adjacent bounds helpers four times each;
both helpers consume packed GTE SXY words loaded from primitive X/Y pairs and
test the signed low-half X coordinate against the same screen interval.
Members: func_8001C0D4 (s) — GTE camera/view driver (PushMatrix/PopMatrix),
sole caller of both func_8001C1C0 and func_8001C37C, plus func_8001D348/
func_8001D6B8; func_8001C1C0 (m) — camera-to-point direction via
VectorNormalSS tested against 4 planes, read by sole caller func_8001C0D4
(address-adjacent, shares the GTE vector idiom; owns D_80061EC8 camera +
D_80061EA8 plane coefficients); func_8001C37C (s) — projected primitive
renderer/caller; HasTriangleVertexXInBounds (m) — three-vertex X bounds
helper; func_8001D2D8 (?) — four-vertex X bounds helper. func_8001D348 is
the first following function and may mark the next TU; membership unverified.

## u16 string library — 0x80017D9C–0x80017F30 (confidence: medium)

Library TU of 0xFFFF-terminated u16 string routines; none of it is
reachable from shipped code, so the linker pulled it in wholesale.

Fingerprints:
- shared idiom: all members operate on 0xFFFF-terminated u16 buffers;
- func_80017E34 and func_80017EA0 share a byte-identical copy loop with
  the same systematic allocation (loop load $v1, compare re-read $v0),
  produced in both by one user variable shared between the pre-check
  re-read and the loop store value (multi-block web -> global allocno,
  conflicts with $v0 -> $v1);
- address adjacency with no interleaved unrelated code.

Members (address order):
- func_80017D9C (s) — wrapper, calls 80011F5C/80018B98/80011FD8
- func_80017E34 (m) — u16 strcat (append)
- func_80017EA0 (s) — u16 strcpy (copy); void return
- func_80017EE4 (m) — u16 strcmp (compare); entry is a `j` over the
  rotated loop tail (expand_end_loop rotation)

References: notes/research/func_80017E34-shared-web-global-allocno.md
(apply the shared-variable shape to func_80017EA0 when decompiling it),
notes/retros/2026-08-28-func_80017E34-retro.md.

## unknown group A — 0x8001E04C–0x8001E26C (confidence: low)

Address-adjacent block preceding collision.c; none of its functions touch
the collision cluster (checked 2026-07-31), so the file boundary likely
falls between func_8001E26C and SetVal8005E51C. No positive grouping
evidence yet — recorded to mark the boundary question.
Members: func_8001E04C (s), func_8001E088 (s), func_8001E0B8 (m),
func_8001E158 (m), func_8001E160 (m), func_8001E26C (s).

Negative membership evidence for the boot TU (2026-08-11): func_8001E160
initialises the same D_8005E5E8[2] render contexts as the boot TU's
func_80012598 — its whole body is the same source as that function's second
loop — but it reaches D_8005E3B0 *absolutely* (`lui`/`lw %lo`) where
func_80012598 reaches it GP-relatively. Under the ASPSX rule that makes them
different translation units, so this is duplicated source across files, not
shared membership. Practical value: E160 is the proven idiom (and partial
body) for anyone working func_80012598 or its neighbours.

## sprite-grid callback family — 0x8002238C–0x80022528 (confidence: medium)

Sprite-source-grid callback family in the 0x80022xxx gap between the VAB
setup group and unknown group B.

Fingerprints:
- internal call graph: func_8002238C and func_800223B0 pass the addresses of
  func_800224F0 and func_80022528 respectively to func_800223D4; both callbacks
  consume the grid driver's five-argument interface and forward into sprite
  renderers;
- all five functions are consecutive in link order, with no unrelated code
  between them.

Members (address order):
- func_8002238C (s) — wrapper pairing func_800223D4 with func_800224F0
- func_800223B0 (s) — wrapper pairing func_800223D4 with func_80022528
- func_800223D4 (m) — sprite-source grid callback driver
- func_800224F0 (s) — callback forwarding grid entries to func_80015EE8
- func_80022528 (s) — callback forwarding grid entries to func_80015E3C

## unknown group B — around 0x8002261C–0x80022F1C (confidence: low)

Game-state/flags readers over the D_8006C838 struct array.

Fingerprints:
- both members walk D_8006C838 through a `char *base = (char *)&D_8006C838`
  pointer variable (byte-verified idiom in both);
- func_80022738's target reaches D_8005E5CC and D_8005E5B4 gp-relatively,
  so the original TU declares both (ASPSX gp-rel rule — see the
  func_80016C08 entry);
- SetVal8005E2BC and SetVal8005E334 are void-returning: func_80022738
  matches only with void prototypes (an implicit-int/s32 declaration adds a
  dead `$v0` call def that blocks the target's `$v0` scratch allocation).

Members (address order):
- func_8002261C (m) — queue worker over the +0xCC state byte (0 -> 1
  handshake, then a 5/6 re-queue path guarded by C4==-1); writes D_8005E5A8/AC
  and D_8005E5C4/C8; declares D_8005E5A8/AC/B4/C4/C8
- func_80022738 (m) — flag-slot state check/advance (byte at +0xCC, 4 -> 5)
- func_80022DF8 (m) — reads the s32 flag word at D_8006C838+0xC (bit 27), OR/ANDs
  it, clears the +0xCC state byte (struct struct_8006C838_view in
  globals_override.h), then (de)queues a script/timer via func_8002261C; declares
  D_8005E5B4/BC/C0/C4/C8
- func_80022F1C (m) — u16 threshold bucketing at a large computed offset

The GetVal8005E5B4/GetVal8005E5B8 accessors are natural same-TU candidates
via the gp-rel declarations; membership unverified.

References: notes/retros/2026-08-06-func_80022738-retro.md,
notes/research/func_80022F1C-shift-fusion-and-address-legitimization.md.

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

## sprite render dispatch wrappers — 0x800245F4–0x80024AD4 (confidence: high)

14 thin wrappers plus one core dispatcher, all consecutive with no unrelated
code between them. Every wrapper has the same body shape: sign-extend incoming
`$a2`/`$a3` to s16, set `$a1` to a sprite-header id constant, and tail-call
func_80024A4C. The constants (0x7–0x2B, with 0x27 shared by four wrappers)
are sprite header identifiers, not sequential indices. The core
(func_80024A4C) caches a SpriteSourceData object at D_800A0728, reinitializes
it via func_80015704 when the header pointer (field_14) doesn't match the
requested header (D_800977F8), then dispatches through func_80015EE8 to the
sprite renderer.

Fingerprints:
- internal call graph: all 14 wrappers (func_800245F4–func_80024A10) call
  exactly one function — func_80024A4C — and nothing else;
- address adjacency: 15 functions spanning 0x800245F4–0x80024AD4 with zero
  gaps;
- structural identity: every wrapper is 0x38 or 0x3C bytes, differs only in
  the `$a1` constant and which incoming register supplies arg3.

Members (address order):
- func_800245F4–func_80024A10 (14 wrappers, 2× m + 12× s) — thin wrappers with
  sprite-header id constants (0x7–0x2B, 0x27 shared by four); all call func_80024A4C;
  func_800248B0 (m) matched (id 0xB), func_80024A10 (m) matched (id 0x2B)
- func_80024A4C (m) — core dispatcher: header-cache check + func_80015EE8 call

## pad initialization and state — 0x80013B04–0x80014554 (confidence: high)

Pad setup, per-port state polling, decoded controller input, analog-stick
normalization, and pad-helper sequence.
Fingerprints: func_80014064 initializes D_8005E9C8 through PadInitDirect;
adjacent func_8001413C reads the same buffer and calls func_80014388;
func_800140C8 is between them, calls PadGetState/PadSetActAlign, and its sole
caller func_80013B04 also calls adjacent func_80013F90 while processing pad
state. func_80013CD0 drives the other two internal chains: func_80013FC0 calls
func_8001413C, while func_80014250 calls func_800142D8 to turn byte coordinates
centered on 0x80 into a dead-zone/clamped stick magnitude. func_80013CD0 also
calls func_80014494, which shares GP-relative D_8005E3E8/D_8005E3EC with
func_80013B04/func_80014064 and writes D_8005EA18 (pad actuator buffer).
Members: func_80013B04 (m) — pad-state driver; func_80013CD0 (s) — per-pad
processing driver; func_80013F90 (m) — clears a per-port state object;
func_80013FC0 (s) — calls the decoded-input path; func_80014064 (m) —
initializes pad buffers and starts communication; func_800140C8 (m) — polls one
port and aligns its actuators; func_8001413C (m) — decodes one D_8005E9C8 port
record; func_80014250 (m) — analog-stick normalization driver, indexes the 2D byte buffer D_8005E9C8[arg0][N] in the same direct-index idiom as D_8005EA18;
func_800142D8 (m) — center/dead-zone magnitude helper, matched under an
allowlisted three-instruction embedded-asm exception for one delay-slot choice;
func_80014388 (s) — input decoder called by func_8001413C; func_80014494 (m) —
writes one port's PadSetAct actuator table, matched under an allowlisted
-fno-cse-skip-blocks override.

Per-TU flag: func_80014494 needs `-fno-cse-skip-blocks`. Expect it on the
group's other members — all six matched members (func_80013B04, func_80013F90,
func_80014064, func_800140C8, func_800142D8, func_80014554) were re-checked
with the flag applied on 2026-08-09 and still match byte-for-byte, so it is
consistent with the whole group rather than a single-file workaround.

References: notes/research/func_800140C8-aggregate-copy.md;
notes/retros/2026-08-07-func_800140C8-retro.md;
notes/retros/2026-08-09-func_800142D8-retro.md;
notes/retros/2026-08-09-func_80014494-retro.md.

## GPU primitive packet initializers — 0x8001526C–0x80015683 (confidence: high)

Adjacent helpers that initialize one PSY-Q primitive, select its opaque or
semitransparent code through the same conditional diamond, link it with
`addPrim`, and return the next packet slot. The matched func_800154CC and
func_80015594 targets share the same entry, color-extraction, branch, and tag
linking fingerprints; primitive-specific field counts explain their middle
sections.

Members (address order):
- func_8001526C (m) — TILE_1 primitive initializer, code 0x68
- func_8001530C (s) — small primitive initializer, code 0x40
- func_800153BC (m) — POLY_G4 initializer, code 0x38/0x3A
- func_800154CC (m) — POLY_F4 initializer, code 0x28/0x2A
- func_80015594 (m) — TILE initializer, code 0x60/0x62
- func_80015644 (m) — POLY_F4 wrapper with semitransparency (calls func_800154CC)

Reference: `notes/research/func_800154CC-polyf4-diamond-crossjump.md`.

## sprite data, animation, and renderers — 0x80015704–0x80016C08

Family confidence: high. Exact TU boundary confidence: medium. The current
best split is after func_800161AC: source-data initialization, animation
helpers, dispatchers, and renderer wrappers at 0x80015704–0x800161AC, then
the two renderers and entry driver at 0x80016280–0x80016C08. This supersedes
the earlier assumption that the whole family was one TU. See
`notes/sprite-renderer-family-campaign.md` for per-function detail.

Fingerprints:
- internal call graph: func_80015E3C and func_80015EE8 call func_80016280;
  func_80015E78, func_80015F80, func_80016054, func_800160C8, and
  func_800161AC call func_800165D8;
- both renderers decode the same source-data layout (`field_1C`, `field_20`,
  `field_24`, `field_28`, and `field_2C`), use the same 0xFFFE header guard,
  and walk the same 12-byte entry records;
- address adjacency and wrapper forwarding preserve the same byte/halfword
  argument roles and bracket both renderers with no unrelated function;
- func_80015704 initializes the same source-data/animation object consumed
  by the family: header-relative pointers at `field_1C`, `field_20`,
  `field_24`, `field_28`, and `field_2C`; adjacent func_800158E4 advances
  animation through `field_28`/`field_2C`, func_80015AAC maps two low-byte
  indices through `field_28`/`field_2C` and then `field_20`/`field_24` with
  the family's 0xFFFE guard, and the 0x80015BF0–0x80015D6C dispatchers call
  func_800158E4 before selecting renderer wrappers.
- func_80016054 and func_80015704 both expand the exact split-statement
  CAPTURE_RA macro (`addu $8,<addr>,$0`; `sw $31,0($8)`). This proves a
  shared studio header and strengthens their pre-render-module grouping,
  but a shared header alone is not same-TU proof — see
  `notes/research/caller-capture-debug-hook.md`.
- TU-boundary flag evidence: `-mno-split-addresses` is carried independently
  by func_800165D8 and func_80016C08. In contrast, applying it to the exact
  sources for func_80015704 and func_80016054 regresses them from 68/68 to
  16/68 and from 29/29 to 23/29. Since flags are per TU, those functions
  cannot share the renderer/driver TU. func_80016280 is byte-inert under the
  flag because it has no symbolic references; its adjacency and semantic
  twin relationship with func_800165D8 place the most likely boundary
  between func_800161AC and func_80016280.

Members (address order):
- func_80015704 (m) — validates a table header and initializes the shared
  source-data/animation object; calls adjacent func_80015880
- func_80015814–func_800158D8 (mixed) — flag/state setters and source-data
  accessors over the object initialized by func_80015704
- func_800158E4 (m) — animation-state/frame-timing update using the source
  object's `field_28` and `field_2C` tables
- func_80015A18–func_80015A94 (mixed) — source-data accessors
- func_80015AAC (m) — maps two low-byte indices through the source object's
  `field_28`/`field_2C` tables, applies the 0xFFFE guard, then resolves the
  result through `field_20`/`field_24`; sole caller is func_80017284
- func_80015B24–func_80015DD4 (mixed) — entry lookup and dispatchers;
  func_80015BF0–func_80015D6C bridge func_800158E4 to the wrappers below
- func_80015E3C (m) — thin func_80016280 wrapper (8 params: 4 register + 4 stack)
- func_80015E78 (m) — thin func_800165D8 wrapper
- func_80015EE8 (m) — packet setup/teardown around func_80016280
- func_80015F80 (m) — packet setup/teardown around func_800165D8
- func_80016054 (m) — func_800165D8 wrapper with CAPTURE_RA caller-log hook
  (include/debughook.h)
- func_800160C8 (m) — packet setup/teardown around func_800165D8 (13 params)
- func_800161AC (m) — packet setup/teardown around func_800165D8
- func_80016280 (m)(?) — SPRT/DR_MODE renderer, active C/asm hybrid; likely
  first member of the `-mno-split-addresses` renderer/driver TU, but its lack
  of symbolic references makes the flag byte-inert
  (see research/func_80016280-web-parity-and-register-recurrence.md)
- func_800165D8 (m) — larger direct-primitive renderer; shares the absolute
  (non-gp-relative) D_8005E3C0 access with func_80016C08, which is the real
  TU-level fact for this group: neither file owns that symbol. Both were
  previously matched with a -mno-split-addresses per-file flag; that flag was
  withdrawn 2026-08-08 and both match under baseline flags
  (`notes/adr-0001-symbol-addressing-at-the-assembler-boundary.md`)
- func_80016B7C (m) — sprite data size calculator; calls func_80015B24 (entry
  search/bcmp) + func_8001782C (tile load/LoadImage); sole caller is
  func_80016C08
- func_80016C08 (m) — sprite entry loop driver; calls func_80016B7C twice.
  Declares D_8005E438: the target reaches it gp-relatively, and ASPSX only
  emits gp-relative for symbols the file itself declares. That rule makes any
  gp-relative access in the original a TU-membership signal — see
  `notes/research/func_80016C08-tu-owned-globals-and-gp-relative-addressing.md`

## Sprite / tile-load wrappers — 0x80017042–0x8001782C (confidence: medium)

Sprite data decompressor and thin callers, address-adjacent to the tile
loader func_8001782C. func_80017300 is a raw-compression sprite decompressor
(poly-flag-driven byte/RLE copy into D_8005EE28 followed by LoadImage +
DrawSync); it is reached by the four thin wrappers func_8001719C,
func_800171CC, func_80017200, func_80017240, and neighbouring func_80017284
links it to the sprite family by calling func_80015AAC / func_80015B24 plus
the tile loader func_8001782C (which func_80016B7C also calls). Evidence:
address adjacency inside one gap, shared LoadImage/sprite-idrom idiom, and
the func_80017284 bridge to the sprite/animation family. TU boundary
uncertain; func_80017300 uses split addressing (lui+%lo hi kept in a saved
register), so it does not carry the renderer TUs' -mno-split-addresses flag.

Members:
- func_8001719C/800171CC/80017200/80017240 (s) — thin wrappers into func_80017300
- func_80017300 (matched 2026-08-12) — sprite data decompressor (RLE/byte)
  into D_8005EE28, LoadImage per scanline. Key shape: the row-byte loops are
  count-up loops reversed by check_dbra_loop (see
  notes/research/func_80017300-pre-placement-and-movable-order.md §11)

## Boot / main-loop TU (0x80011370 – 0x800128DC)

Confidence: **high** — shared gp-relative cluster, the strongest signal this
ledger recognises.

Evidence: these functions reach the 0x8005E27C–0x8005E3C0 small-data cluster
GP-relatively, and every other function in the binary reaches the same symbols
absolutely. Under the ASPSX rule recorded for func_80016C08 (gp-relative only
for symbols the file itself declares), that makes them one translation unit —
the one that owns the cluster. The seven symbols observed both ways are
D_8005E3A4, D_8005E3A8, D_8005E3AC, D_8005E3B0, D_8005E3B4, D_8005E3BC and D_8005E3C0;
40+ functions outside this range use the absolute form.

- func_80011370 (m) — game entry / main loop: init sequence then an infinite
  loop with a 0x15-entry switch on D_8005E39C (scene id). Owns D_8005E3A8 and
  D_8005E3AC outright (sole gp-relative accessor). Byte-verified 2026-08-08
- func_80011C24 (s) — called at the bottom of the main loop every iteration
- func_80011DB0 (s), func_80011F5C (s), func_80011FD8 (s) — share D_8005E3C0
  and D_8005E3B4
- func_8001202C (s), func_80012098 (s), func_8001231C (s) — share D_8005E3B0
- func_80012598 (m) — graphics-heap carve and double-buffer/ordering-table
  init over D_8005E5E8[2]; owns D_8005E3B0/B8/BC gp-relatively. Its second
  loop is the same source as func_8001E160 in another TU (see "unknown
  group A"). notes/research/func_80012598.md
- func_8001231C (s) — the second-configuration twin of func_80012598: same
  0x40 frame, same memset(0x801BE1B0, 0, 0x3EE50) carve, and a first loop with
  an identical 21-web store partition. Differs only in the 0x801F7000 /
  0x2EE0 constants and in calling func_8001E160 where func_80012598 inlines it.
  Parked with a ready recipe: notes/research/func_8001231C.md
- func_800120C8 (s) — touches the widest set of the cluster; called from
  func_80011370's init
- func_800121D4 (s), func_800128DC (s) — share D_8005E3C0; func_800128DC is
  called from the main loop and from several switch cases

Render-context sub-family (evidence: the pool constants, 2026-08-11).
func_80012598 and func_8001231C are the only two functions in the binary that
reference all of 0x801BE1B0 / 0x801BE440 / 0x801C2440 — the graphics heap, the
big ordering table and the VRAM staging area — so they are the two carve
routines. The already-matched relatives that consume what they build are
func_800120C8 (GsSetWorkBase over field_12C, ClearOTagR), func_800128DC (memcpy
over field_130), func_8001205C, and func_80011370 (whose SetDefDrawEnv /
SetDefDispEnv calls fix the DRAWENV/DISPENV part of the field map). Still stubs
and sharing D_8005E3B0: func_8001202C, func_80012098, func_800121D4 — the last
is 93% opcode-shingle-covered by the matched func_800120C8, so diff it first.
D_8005E3C0 (the *active* context pointer) is read by 36 functions across the
binary; that is "this function draws", not a grouping signal.

Practical consequence for anyone matching a member: a gp-relative access in
the target is a membership signal, and a member must *declare* the symbols it
reaches that way. Non-members must not. See
`plans/toolchain-native-small-data-addressing.md` for how that is expressed in
source.

Technique and per-function detail for this group live in
`notes/sprite-renderer-family-campaign.md`; the frame-size/arity diagnostic
these wrappers illustrate is in
`notes/research/frame-size-arity-diagnostic.md`.

## game-state init and query — around 0x800132B8–0x80013394 (confidence: low)

Game-state initialization and mode-dispatch query. Fingerprints:
func_800132B8 (m) defines `D_8005E294`, `D_8005E298`, `D_8005E2A0`,
`D_8005E3CC`, `D_8005E3CE`, `D_8005E3D0` as tentative definitions (GP-relative);
func_80013394 (m) defines the subset `D_8005E294`, `D_8005E3CC`, `D_8005E3CE`
and reads them GP-relatively. Shared gp-rel cluster is the same evidence
class as the boot/main-loop TU. func_80011370 calls func_800132B8,
so this is a different TU. Intermediate func_800132F0 and func_80013328
are stubs; membership unverified.

Members (address order):
- func_800132B8 (m) — game-state initializer (sets mode, counters, sizes)
- func_800132F0 (s)(?) — stub; intermediate
- func_80013328 (s)(?) — stub; intermediate
- func_80013394 (m) — mode-dispatch getter (reads D_8005E294, returns predicate on D_8005E3CC/D_8005E3CE)

## VAB transfer setup/state — around 0x80020E58–0x800218C4 (confidence: high)

Sound-bank transfer setup and progress state.
Fingerprints: func_80020E58 directly calls func_800214FC, func_800215EC,
func_80021604, and func_80021668; func_80020E58, func_800214FC, and
func_80021604 share the absolute D_80049370 table; func_800215EC,
func_80021604, and func_80021668 share the D_8006C7B8 transfer-state object;
func_80020E58 and func_800214FC share a GP-relative cluster
D_8005E538, D_8005E54C, D_8005E554, D_8005E572 (both define them tentatively
and access via %gp_rel — func_80020E38 also defines D_8005E554).
Members: func_80020E38 (m) — helper: indexed load from D_8006BF48;
func_80020E58 (s) — transfer setup/dispatcher; func_800214FC (m) —
selects a D_80049370 span and starts a CD load operation; func_800215EC (m) —
writes the first three transfer-state words; func_80021604 (m) — initializes
transfer progress from adjacent D_80049370 entries; func_80021668 (s) —
advances the partial VAB transfer; func_800218C4 (m) — searches for STR/*.XA
CD audio files via CdSearchFile (4 filename pointers in D_80049A70, CdlFILE
buffer at D_8006C7D8); called from func_8001FE7C which is called by
func_80011370 (main loop); address adjacency (0x18C4 is 0x194 past previous
boundary); func_800218C4 uses all absolute addressing (no shared gp-rel
cluster with core members — likely a different TU or the boundary member).

References: src/func_800218C4.c.

## sound init and control — around 0x8001FEA4–0x80020A94 (confidence: medium)

Sound system initialization, stereo/mono control, and score sequence opening.
Fingerprints: shared gp-rel cluster D_8005E538, D_8005E53C (init flags),
D_8005E558, D_8005E55C (stereo/mono flag) — func_8001FEA4 defines all four
as tentative definitions (GP-relative); func_80020818 defines the overlapping
subset D_8005E53C, D_8005E55C. All other functions in the binary reach these
symbols absolutely. SDK fingerprint: libsnd SsInit, SsSetTableSize,
SsSetTickMode, SsUtReverbOff, SsSeqOpen, SsStart, SsSetStereo, SsSetMono;
libspu SpuSetCommonAttr; libcd CdControl.
func_80011370 (main loop) calls func_80020818.

Members (address order):
- func_8001FEA4 (m) — sound reset: clears D_8005E538/D_8005E53C/D_8005E558,
  sets D_8005E55C=1, initializes SpuCommonAttr D_8006C368, calls SsInit /
  SsSetTableSize / SsSetTickMode / SsUtReverbOff / SpuSetCommonAttr
- func_80020818 (m) — sound init: opens sequences, calls SsStart, sets
  D_8005E53C, configures stereo/mono from D_8005E55C
- func_80020A14 (s) — mono setter: calls SsSetMono, clears D_8005E55C
- func_80020A40 (m) — stereo setter: calls SsSetStereo, sets D_8005E55C
- GetVal8005E55C (s) — getter: returns D_8005E55C
- GetVal8005E544 (s)(?) — adjacent getter; membership unverified
- GetVal8005E548 (s)(?) — adjacent getter; membership unverified
- func_80020A94 (m) — sound stop: clears D_8005E53C

## CD loading — 0x80014554–0x80014B44 (confidence: high)

CD file/disk loading helpers: search for files on disc, set location, read
sectors, and synchronize. Fingerprints: shared gp-rel cluster
D_8005E3F0–D_8005E430 (CD state, buffers, positions) — every member reaches
this cluster GP-relatively; D_8005E428 and D_8005E430 are universal across
all five members. SDK fingerprint is near-identical: CdSearchFile, CdControl,
CdRead, CdReadSync, VSync with optional ResetCallback/DrawSync/CdSync/CdIntToPos.
Internal call graph: func_800147BC calls func_80014554; func_80014B44 calls
func_80014854. func_80011370 (main loop) calls func_800145F0 and func_800147BC.

Members (address order):
- func_80014554 (m) — CD file loader: CdSearchFile loop, CdSetloc, CdRead,
  CdReadSync/VSync wait; no gp-rel globals (pure helper, stack CdlFILE only);
  sole caller is func_800147BC
- func_800145F0 (s) — CD loader with state: touches D_8005E430, D_8005E404,
  D_8005E428, D_8005E3F0 GP-relatively; called by func_80011370
- func_80014748 (s)(?) — dead; ResetCallback + DrawSync only; possible
  stub or unused variant; membership unverified
- func_800147BC (m) — CD file search wrapper: CdSearchFile + CdPosToInt,
  writes D_8005E428 and D_8005E430; calls func_80014554; called by func_80011370
- func_80014854 (m) — CD loader: TOUNES/owns the gp-rel cluster D_8005E2B0,
  D_8005E3F0/F8/FC, D_8005E400/04/08/0C, D_8005E428/30 (defines all ten); reads
  the absolute-addressed CD file table D_80048B1C (entry stride 0x28, loc at 0x24,
  owned elsewhere); called by func_80014B44
- func_80014988 (m) — general-purpose CD loader: owns the gp-rel cluster
  D_8005E3F0, D_8005E410, D_8005E414, D_8005E418, D_8005E41C, D_8005E420,
  D_8005E428, D_8005E430 (shares D_8005E428/E430 with the family); called by
  sound system (func_80020E58, func_800214FC, func_80021668)
- func_80014B44 (s) — boot CD loader: D_8005E2B0, D_8005E3F8, D_8005E3FC,
  D_8005E400, D_8005E40C; calls func_80014854; called by __start (its globals are
  a subset of func_80014854's TU-owned cluster ⇒ likely same TU)

## candidates to investigate

- func_80021DA8 (m) — buffer/address initializer: clears D_8006C838 and
  D_8007AFF0, calls func_80021E60(0), computes 2048-byte-aligned addresses
  from D_8001009C - D_80010098, stores results in D_8007AFF0[0..1].
  Evidence for func_80021E60 neighborhood: address-adjacent (func_80021DA8
  ends at 0x80021E60 where func_80021E60 begins), direct caller.
  No shared gp-rel cluster verified yet; TU membership unconfirmed.
- func_80021E60's pool-carving table neighborhood (19-entry pointer/count
  parallel arrays over 0x18-byte elements) — func_80021DA8 is a confirmed
  caller and address predecessor; shared gp-rel globals unverified.

## u16 table-insertion / D_800749F4 dispatch family — 0x8001A574–0x8001A970 (confidence: medium)

Consumable/spellbook-style u16 table insertion and its dispatcher. Fingerprints:
- shared absolute-addressed cluster: D_80049078 (3-entry fn-pointer dispatch
  table, called by func_8001A574) and its adjacent D_80049084 (u16 string at
  +0x0C, used by func_8001A808), D_800749F4 (0xB8-stride object array
  scanned by the callees), D_8005F0F8 (u16 0xFFFF sentinel — the *split*
  address form `lui r,%hi` / `op %lo(r)`, implying a >-G8 declared size in the
  original TU; both func_8001A574 and func_8001A668 targets split it),
  D_8005E444/D_8005E4A8 (u16 table length/base, GP-relative in func_8001A574's
  TU, signalled via tentative definitions).
- internal call graph: func_8001A574 → func_8001A668/8001A6FC/8001A790
  (dispatch, one s32 argument, return s32) → func_8001A808; both callees scan
  the same 0xB8-stride D_800749F4 array and return
  `(ptr - &D_8005F0F8) >> 1`.
- func_8001A668 and func_8001A6FC are near-identical except the scan's branch
  sense (bnez vs beqz) — classic source-level twin.

Members (address order):
- func_8001A574 (s) — dispatcher/insert: arg0/3 → q,r; dispatch
  `D_80049078[r](q)`; scans the gap in
  `p_table = D_8005E4A8 + D_8005E444`; memmove/memcpy shift; sentinel
  D_8005F0F8 = 0xFFFF before/after
- func_8001A668 (s) — scan member (bnez); calls func_8001A808
- func_8001A6FC (s) — scan member (beqz); calls func_8001A808
- func_8001A790 (m) — third dispatch callee
- func_8001A808 (m) — per-entry helper called by 668/6FC; flag-gated
  strcat chain appended into D_80049084
- func_8001A870 (m), func_8001A8D0 (m), func_8001A970 (m) — later members;
  A8D0/A970 are clean scalar helpers (charset / number-to-string)

References:
- notes/research/func_8001A808-D80049084-address-split.md
  (declared >-G8 so the address splits; addiu half lands in the second jal's
  delay slot)
- notes/research/func_8001205C-declaration-shape-vs-address-form.md
  (-G8 size decides split vs macro form for D_8005F0F8)
- notes/retros/2026-08-10-func_8001A574-retro.md
  (indirect-call arity, declaration birth, sequential temp reuse, and final scheduler tie)
