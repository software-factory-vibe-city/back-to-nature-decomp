# Suspected source-file groupings (ledger)

Lightweight, hand-maintained priors about which functions belonged to the
same original translation unit. NOT authoritative — each container's splat
config is the source of truth for actual splits; this file records *suspected*
groupings with the evidence that justifies them.

Why it matters: same-file membership has compiler-visible consequences —
shared TU-level quirks (e.g. a file-scope register variable reserving a
register for everything after its declaration point), shared idiom priors,
shared static/global data clusters, and declaration-order effects. Knowing
the group changed func_8001E9F8 from a multi-session mystery into a
15-minute solve.

Rules:
- Every group heading names its **container**. A translation unit belongs to
  one binary, and two overlays that share a RAM slot hold different functions
  at the same address — so an address range without a container names two
  different groups. The PS-X EXE is `exe`; overlay containers are `ovl_NN`,
  and their symbols carry that id as a prefix.
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

## Containers

`npx tsx tools/agent/callGraph.ts` lists every container, its function count,
and the cross-container call edges between them. What this ledger has recorded
so far:

| container | alias | groups recorded |
|---|---|---|
| `exe` | the PS-X EXE | every group below except where a heading says otherwise |
| `ovl_31` | `Obj\gf_mcard.bin` | memory-card service group |
| `ovl_11` | `Obj\GF_FARM.bin` | farm-object clear/update run 0x80121318–0x80121500 (medium); `D_80123754` setter/getter run 0x800D12A0–0x800D2160 (medium); text/sprite table-builder run 0x80116F4C–0x80117178 (medium); `D_80127428` shared-state cluster 0x801037DC–0x801040A8 (medium); `D_8012D52C` reset-stub family 0x80114184 / 0x8011A9CC–0x8011B6C0 (medium); pointer-getter run 0x800E48CC–0x800E5078 (medium); `D_80128D78`/`D_80128D7A` s16-pair global cluster 0x800D31EC–0x800D55F8 (low); `D_8012DB10`/`D_8012DB14` s32-pair run 0x8011F0C4–0x8011F1D0 (medium); short-fold helper trio 0x800CE514–0x800CE53C (medium); `(1<<arg0)&0xFFFF` mask helper 0x80101B84, called by link-adjacent 0x80100FFC/0x80101B28 (low); `D_80071A00` byte-compare helper pool 0x800F19C8, poolmates 0x800CBDFC/0x8011D06C (low); `D_8012D0xx` tiny-global cluster/state-probe run 0x80108104–0x8010AE64 (low); `D_80129194`–`D_801291A0` mirror-pair run 0x800DD8AC–0x800DDB64 (medium) |
| `ovl_30` | `Obj\GF_swind.bin` | none yet — calls ten `ovl_11` entry points |
| `ovl_10` | `obj\PdaSamp.bin` | debug/status string-table cluster (incl. the grid-display sub-family); tail /15 date-utility pair, low confidence |

Aliases come from `npx tsx tools/diagnostics/overlayIdentity.ts`, which agrees
three independent sources before adopting one; the member index stays the
durable identifier regardless.

**Cross-container edges are ordinary call-graph evidence.** `ovl_30` calls ten
functions inside `ovl_11`, every one landing on a function entry, so the two are
resident together and a grouping argument may cite an edge between them. Every
overlay also calls the engine constantly — `ovl_11` alone has 974 edges into
`exe` — and those edges are evidence about the *engine API*, not about shared
translation units.

---

## `ovl_31` memory-card service — 0x800B7FCC–0x800B87F0 (confidence: high)

The whole container is one translation unit: six functions, one of which calls
the other five and nothing else calls it.

Fingerprints:
- **the container is the group.** `ovl_31` holds exactly six functions with no
  gaps; a container this small is one file unless something says otherwise, and
  nothing does.
- **single entry point.** `ovl_31_func_800B7FCC` calls all five siblings and has
  no caller inside the container; the five have no callee inside it. A star with
  one hub is a file with a driver and its helpers.
- **one SDK library across every member.** Every helper calls `MemCardSync`
  first and then exactly one other `libmcrd` entry point
  (`MemCardFormat`, `MemCardUnformat`, `MemCardGetDirentry`, `MemCardAccept`).
- **the container's own alias corroborates it**: `Obj\gf_mcard.bin`, adopted by
  `overlayIdentity.ts` from three agreeing sources.

Members (address order):
- ovl_31_func_800B7FCC (s) — driver; the only member with an `FntPrint` debug
  overlay and the only caller of the other five
- ovl_31_func_800B82E8 (m) — format: `MemCardSync` then `MemCardFormat`,
  mapping the card's status onto 1 / 0 / -1 (matched 2026-08-21)
- ovl_31_func_800B8348 (s) — unformat; same shape as the above
- ovl_31_func_800B83B8 (s) — directory listing; `MemCardGetDirentry` + `sprintf`
- ovl_31_func_800B8490 (s) — card probe; `MemCardAccept`, `McxCardType`, `McxSync`
- ovl_31_func_800B8600 (s) — file rename; `sprintf` + `rename`

`ovl_31_func_800B82E8` is the first overlay function decompiled through the
agent workflow. Its residual was one shape question — a nested `if` chain rather
than a `&&`, which GCC folds into a single unsigned compare — and it is a fair
prior for the rest of this group.

---

## `ovl_11` farm-object clear/update run — 0x80121318–0x80121500 (confidence: medium)

Candidate same-TU family of `ovl_11` (`Obj\GF_FARM.bin`) around the
farm-object update/clear code at the overlay's tail. Evidence is an internal
call graph plus strict link-order adjacency plus a shared field-14 clear idiom;
same-TU membership is plausible but unproven (no shared gp-rel cluster or
register quirk observed yet).

Fingerprints:
- address adjacency: `ovl_11_func_80121318` (0x44 bytes, ends 0x8012135C)
  sits immediately before `ovl_11_func_8012135C` and `ovl_11_func_801213D8`
  (0x120 bytes, exactly 0x801213D8–0x801214F8), which is followed directly
  by `ovl_11_func_801214F8` (0x801214F8–0x80121500) — the whole run
  0x80121318–0x80121500 is contiguous with no unrelated code between;
- internal call graph: the leaf `ovl_11_func_801214F8` is called by both of
  its neighbours — `ovl_11_func_80121318` (a `for` loop stepping a
  `D_8012DB90` 0x18-byte-stride struct array 0x18 times, calling it per
  entry) and `ovl_11_func_801213D8` (the farm-object update routine, which
  calls it on the `.L801214DC` no-spawn reset path to drop the entry's
  live pointer);
- shared struct + clear idiom: all three operate on the same 0x18-byte
  farm-object struct with a pointer field at +0x14; `ovl_11_func_801214F8` is
  the field-14 clear (single `sw $zero, 0x14(a0)`, leaf), the reset every
  caller uses to blank an entry.

Members (address order):
- ovl_11_func_80121318 (s) — clears the whole `D_8012DB90` 0x18-entry farm
  array by looping 0x18 times calling ovl_11_func_801214F8 on each +0x18
  entry
- ovl_11_func_8012135C (s) — role unknown; sits in the run between 80121318
  and 801213D8
- ovl_11_func_801213D8 (s) — farm-object update: guards field_14, positions
  from field_0/2/8/C via a /6 magic-reciprocal step counter, gate bit of
  `D_8006C844`, and on its no-spawn path calls
  ovl_11_func_801214F8 (field-14 clear)
- ovl_11_func_801214F8 (m, matched 2026-11 — this session) — leaf field-14
  clear: `sw $zero, 0x14(a0)`; byte-exact clean C, baseline flags (no
  override)
- ovl_11_func_80121500 (s) — immediate link-order follower, next candidate
  member

---

## `ovl_11` text/sprite table-builder run — 0x80116F4C–0x80117178 (confidence: medium)

Candidate same-TU family of `ovl_11` (`Obj\GF_FARM.bin`) around the table
setup at the overlay's 0x5F12C text region. Evidence is an internal call
graph plus strict link-order adjacency, the same fingerprint class as the
0x80121318 farm-object run; no shared gp-rel cluster observed (this
container absolute-addresses everything).

Fingerprints:
- address adjacency: `ovl_11_func_80116F4C` (0x80116F4C, 0x18C bytes) ends
  at 0x801170D8 and is followed contiguously by `ovl_11_func_801170D8`
  (0xC bytes) then `ovl_11_func_801170E4` (0x94 bytes) — one unbroken run
  0x80116F4C–0x80117178 with no unrelated code between;
- internal call graph: the head `ovl_11_func_80116F4C` calls both of its
  immediate link-order followers — `ovl_11_func_801170D8` (on the object
  struct's 2-byte field at +0x1A, result fed to `func_8001A970` as the
  text/string source) and `ovl_11_func_801170E4` (a per-cell draw loop
  stepping a coordinate by -0x800, calling `func_800245F4` per step);
- shared idiom: both leaves read/handle 2-byte object fields; the parent
  builds a 24-entry D_8012D608 halfword array with two `func_8001A970`
  field-read sites and a `func_80017B3C` / `func_80024A10` string call each.

Members (address order):
- ovl_11_func_80116F4C (s) — table builder: fills D_8012D608 (0xFFD into 24
  halfwords), then draws two 2-byte object field reads via
  ovl_11_func_801170D8 / func_8001A970, a percentage count derived from
  field +0x16 into ovl_11_func_801170E4, and two func_80017B3C /
  func_80024A10 output rows
- ovl_11_func_801170D8 (m, matched 2026-11 — this session) — leaf s16
  reader: returns `*ptr` (`lh` at +0); byte-exact clean C, baseline flags
  (no override); parent passes object + 0x1A to read that 2-byte field
- ovl_11_func_801170E4 (s) — rows/cells draw loop: for count from arg0,
  calls func_800245F4 per cell while stepping a coordinate by -0x800;
  called by the head right after the func_801170D8 field read

---

## `ovl_11` D_80128810 counter cluster — 0x800BE208–0x800BE2C4 (confidence: medium)

Candidate same-TU family of `ovl_11` (`Obj\GF_FARM.bin`) sharing a single
file-scope s32 global counter. Same shared-global-cluster fingerprint as the
documented D_80123754 / D_80070D0E runs: absolute-addressed main-RAM global
(no gp-rel in this container) threaded through a contiguous text span — here
with all three members of the run mutating the global.

Fingerprints:
- shared s32 global `D_80128810` (main RAM 0x80128810, absolute `lui`+`%lo`
  in every site): read+increment+store by `ovl_11_func_800BE208` and
  `ovl_11_func_800BE26C`, cleared to 0 by `ovl_11_func_800BE2B8`;
- zero-gap link-order contiguity (map): 0x800BE208 (0x64) → 0x800BE26C (0x4C)
  → 0x800BE2B8 (0xC), each starting exactly where the previous ends, the span
  0x800BE208–0x800BE2C4 contiguous with no unrelated code between;
- call-graph tie: both counter-increment members call the same
  `ovl_11_func_800BEB28` on their increment path — a shared sub-handler the
  three-line clear does not need.

Members (address order):
- ovl_11_func_800BE208 (s) — increments D_80128810 only while it stays < 0x32,
  then calls ovl_11_func_800BEB28; the run's guarded counter
- ovl_11_func_800BE26C (s) — unconditionally increments and stores, then calls
  ovl_11_func_800BEB28 — same counter, no guard
- ovl_11_func_800BE2B8 (m, matched this session) — leaf clear:
  `D_80128810 = 0` (single `sw $zero`, delay-slot scheduled); byte-exact clean
  C, baseline flags; the run's reset

---

## `ovl_11` D_8012D0xx tiny-global cluster / state-probe run — 0x80108104–0x8010AE64 (confidence: low)

Candidate same-TU family of `ovl_11` (`Obj\GF_FARM.bin`) sharing a compact
file-scope D_8012D0xx main-RAM global cluster (not in generated `globals.h`)
threaded through a contiguous-ish span of small leaf/setter/probe functions.
Same shared-global-cluster fingerprint as the documented D_80070D0E and
D_80128810 runs: absolute `lui`+`%lo` addressing (no gp-rel in this container),
one or two touched globals per tiny function.

Fingerprints:
- cluster members and users: `D_8012D040`/`D_8012D044` (s32, cleared by
  ovl_11_func_80108104); `D_8012D050` (buffer/array base, address-taken by
  ovl_11_func_801081A0 and ovl_11_func_801084E0); `D_8012D052` (u16 field at
  +2 of that base, read by ovl_11_func_80108214); `D_8012D060`/`D_8012D068`/
  `D_8012D06C` (ovl_11_func_80108930), `D_8012D070` (ovl_11_func_8010A47C),
  `D_8012D084` (ovl_11_func_8010AE64);
- link-order contiguity of the head run (map): 0x80108104 (0x14) → 0x80108118
  → 0x801081A0 → 0x80108214 (0x18) → 0x8010822C, each starting where the
  previous ends; the cluster users span 0x80108104–0x8010AE64.

Members (address order, matched so far):
- ovl_11_func_80108104 (m) — clears D_8012D040 and D_8012D044 to 0; cluster's
  confirmed writer at the run head
- ovl_11_func_80108214 (m, matched this session) — leaf probe reading u16
  D_8012D052, returns (D_8012D052 - 0x10) < 2; byte-exact clean C, baseline
  flags; the run's only confirmed reader of the +2 field

---

## `ovl_11` D_80128B50 / D_80128B5C input-state run — 0x800C06B0–0x800C0D9C (confidence: medium)

Candidate same-TU family of `ovl_11` (`Obj\GF_FARM.bin`) sharing two adjacent
file-scope s32 globals. Same shared-global-cluster fingerprint as the
documented D_80128810 counter cluster / D_80123754 setter-getter run:
absolute-addressed main-RAM globals (`-G0`, no gp-rel in this container)
threaded through a contiguous text span by the run's mutators.

Fingerprints:
- shared s32 global `D_80128B5C` (main RAM 0x80128B5C, absolute `lui`+`%lo`
  in every site): read by `ovl_11_func_800C06B0` (`lw` into `$v1`, then
  cleared with `sw $zero`), cleared to 0 by `ovl_11_func_800C087C` and
  `ovl_11_func_800C08E8`, written from `$a0` by `ovl_11_func_800C0A40`; the
  setter is called from `ovl_11_func_800DDDFC` (two `jal` sites) to feed the
  global the run's readers consume;
- sibling s32 global `D_80128B50` (main RAM 0x80128B50, 0xC below `D_80128B5C`,
  absolute `lui`+`%lo` in every site): read by `ovl_11_func_800C06B0` and
  `ovl_11_func_800C0A4C` (two sites), read-and-returned by
  `ovl_11_func_800C0824` (the run's getter), cleared to 0 by
  `ovl_11_func_800C090C` and `ovl_11_func_800C09D0`, written by
  `ovl_11_func_800C0D9C`; `ovl_11_func_800C06B0` touches both globals, tying
  the two half-clusters together — they are adjacent file-scope vars of one TU;
- middle s32 global `D_80128B58` (main RAM 0x80128B58, between `D_80128B50`
  and `D_80128B5C`): seen so far only written by `ovl_11_func_800C0D9C`
  (from `$a0`, a 1-arg init pair with B50 in one 0x18 leaf) — the
  B50/B58/B5C trio sits in 12 consecutive bytes of one data run;
- zero-gap link-order contiguity (map): 0x800C06B0 (0x174) → 0x800C0824
  (0x10) → 0x800C0834 (0x48) → 0x800C087C (0x6C) → 0x800C08E8 (0x24) →
  0x800C090C → 0x800C09D0 → 0x800C0A28 (0x18) → 0x800C0A40 (0xC) →
  0x800C0A4C (0x350) → 0x800C0D9C (0x18) — each starts exactly where the
  previous ends, the whole span 0x800C06B0–0x800C0D9C contiguous with no
  unrelated code between; the `D_80128B50` sites run out to the 0x800C0D9C
  writer, extending the earlier-recorded span past 0x800C0A4C.

Members (address order):
- ovl_11_func_800C06B0 (s) — reads/clears D_80128B5C and reads/clears
  D_80128B50; touches both globals
- ovl_11_func_800C0824 (m, matched this session) — leaf getter: returns
  `D_80128B50` (`lui`/`lw` + `jr $ra`); byte-exact clean C, baseline flags;
  confirmed member of the shared-global cluster (D_80128B50 reader)
- ovl_11_func_800C087C (s) — leaf clear: `D_80128B5C = 0`
- ovl_11_func_800C08E8 (s) — leaf clear: `D_80128B5C = 0`
- ovl_11_func_800C090C (s) — leaf clear: `D_80128B50 = 0`
- ovl_11_func_800C09D0 (s) — leaf clear: `D_80128B50 = 0`
- ovl_11_func_800C0A40 (m, matched earlier session) — leaf setter:
  `D_80128B5C = arg0` (single `sw $a0`, delay-slot scheduled); byte-exact
  clean C, baseline flags; confirmed member of the shared-global cluster
- ovl_11_func_800C0A4C (s) — reads D_80128B50 at two sites
- ovl_11_func_800C0D9C (m, matched this session) — leaf initializer:
  `D_80128B50 = 1; D_80128B58 = arg0;` (both stores in the delay slot,
  `lui`-addressed); byte-exact clean C, baseline flags; confirmed the
  cluster's far-end writer and the only known D_80128B58 site

---

## `ovl_11` D_80129194–D_801291A0 mirror-pair run — 0x800DD8AC–0x800DDB64 (confidence: medium)

Candidate same-TU family of `ovl_11` (`Obj\GF_FARM.bin`): six functions in
one unbroken address run, forming two structurally identical cells that each
operate on one adjacent s32-global pair and end in a `== 2` state probe.

Fingerprints:
- **unbroken contiguous run**: 0x800DD8AC (0x58) → 0x800DD904 (0xEC) →
  0x800DD9F0 (0x18) → 0x800DDA08 (0x58) → 0x800DDA60 (0xEC) → 0x800DDB4C
  (0x18), each size exactly fills to the next start (ends 0x800DDB64).
- **mirror-cell identity**: cell A {800DD8AC, 800DD904, 800DD9F0} has the
  same {0x58, 0xEC, 0x18} shape as cell B {800DDA08, 800DDA60, 800DDB4C},
  and the two cells touch adjacent s32-globals the same way: heads write the
  cross-pair (D_80129194/98 vs D_8012919C/A0), middles read+write the high
  member (D_80129198 vs D_801291A0) plus the head's low member, and the
  0x18 tails probe the high member with the identical `== 2` idiom.
- **twin `== 2` probe, proven clean C**: `ovl_11_func_800DD9F0`
  (`return D_80129198 == 2;`) and `ovl_11_func_800DDB4C`
  (`return D_801291A0 == 2;`) are both byte-exact (lui+%lo read, xori 0x2,
  sltiu 1); the shape recurs word-for-word, so the two cells are the same
  handler instantiated for two slots. Globals are extern in every site
  (absolute `lui`+`%lo`, no gp-rel) — the defining TU is elsewhere.

Members:
- ovl_11_func_800DD8AC (s) — cell A head (0x58): clears D_80129198, writes
  D_80129194
- ovl_11_func_800DD904 (s) — cell A middle (0xEC): reads D_80129194 and
  D_80129198, writes/clears D_80129198
- ovl_11_func_800DD9F0 (m, matched) — cell A tail probe: leaf
  `return D_80129198 == 2;`
- ovl_11_func_800DDA08 (s) — cell B head (0x58): mirror of 800DD8AC; clears
  D_801291A0, writes D_8012919C
- ovl_11_func_800DDA60 (s) — cell B middle (0xEC): mirror of 800DD904; reads
  D_8012919C and D_801291A0, writes/clears D_801291A0
- ovl_11_func_800DDB4C (m, matched this session) — cell B tail probe: leaf
  `return D_801291A0 == 2;`

---

## `ovl_11` D_80127428 shared-state cluster — 0x801037DC–0x801040A8 (confidence: medium)

Candidate same-TU family of `ovl_11` (`Obj\GF_FARM.bin`) threaded through a
file-scope s32 state global. Same shared-global-cluster fingerprint as the
documented D_80128810 / D_80128B50 runs: absolute-addressed main-RAM global
(`lui`+`%lo` in every site, no gp-rel in this container) touched by an unbroken
link-order span.

Fingerprints:
- shared s32 global `D_80127428` (main RAM 0x80127428, `.word`, absolute
  `lui`+`%lo` in every site): read-and-returned by `ovl_11_func_801037DC`
  (`== 0`), read by `ovl_11_func_801038E4`, `ovl_11_func_80103B24` and
  `ovl_11_func_801040A8`; cleared to 0 by `ovl_11_func_801037EC`
  (`sw $zero`, alongside sibling `D_8012742C`); set to 1 by
  `ovl_11_func_80103830`; read-and-written at 8 sites by
  `ovl_11_func_80103964` (the run's heavy mutator);
- adjacent sibling global `D_8012742C` (main RAM 0x8012742C, next `.word`
  after `D_80127428`) also cleared by `ovl_11_func_801037EC` — the two are
  adjacent file-scope vars of one TU, same pattern as D_80128B50/5C;
- zero-gap link-order contiguity: the span 0x801037DC–0x801040A8 is one
  unbroken run (each function starts exactly where the previous ends); the
  D_80127428 members are concentrated at the head — 0x801037DC (0x10) →
  0x801037EC (0x44) → 0x80103830 (0xB4) → 0x801038E4 (0x80) → 0x80103964
  (0x1C0) → 0x80103B24 (0xDC), a zero-gap sub-run of six members — with an
  isolated trailer reader at 0x801040A8;
- call-graph tie: `ovl_11_func_80103830` calls the immediate neighbour
  `ovl_11_func_801037EC` on its set path before writing `D_80127428 = 1` —
  a shared reset the setter reuses, the same tie pattern as the D_80128810
  counter cluster.

Members (address order):
- ovl_11_func_801037DC (m, matched this session) — leaf head: returns
  `D_80127428 == 0` (`lui`/`lw` + `sltiu`, delay-slot scheduled); byte-exact
  clean C, baseline flags
- ovl_11_func_801037EC (s) — clears D_80127428 and D_8012742C to 0, then its
  resident small-array clear loop; the run's reset
- ovl_11_func_80103830 (s) — calls ovl_11_func_801037EC, then sets
  `D_80127428 = 1` and calls func_8001FABC(3); the run's setter
- ovl_11_func_801038E4 (s) — leaf reader of D_80127428
- ovl_11_func_80103964 (s) — reads/writes D_80127428 at 8 sites; the run's
  mutator
- ovl_11_func_80103B24 (s) — leaf reader of D_80127428
- ovl_11_func_801040A8 (s) — trailer reader of D_80127428

---

## `ovl_11` s16-pair setter pair — 0x800D0DB0 / 0x800D0DBC (confidence: low)

Two leaf setters on the same 4-byte s16×2 struct, exact link-order
contiguity (0x800D0DB0, 0xC bytes, ends 0x800D0DBC; the second begins at
0x800D0DBC with zero gap). 0x800D0DB0 stores both fields from args,
0x800D0DBC stores -1 into both. Same zero-gap-adjacency + shared-layout
fingerprint as the documented "s16-pair state family"; both local struct
typedefs (UnkStruct800D0DB0 / UnkStruct800D0DBC) are the same layout.
Members:
- ovl_11_func_800D0DB0 (m) — sets s16 pair from args (delay-slot stored)
- ovl_11_func_800D0DBC (m, matched this session) — sets both fields to -1
  ("addiu v0, -1; sh; jr ra / sh v0,2(a0)" delay-slot pair)

---

## `ovl_11` D_80123754 setter/getter run — 0x800D12A0–0x800D2160 (confidence: medium)

Candidate same-TU family of `ovl_11` (`Obj\GF_FARM.bin`) in the middle of the
overlay, sharing a single file-scope s16 global. Evidence is a shared global
cluster plus strict link-order adjacency; same-TU membership is plausible but
unproven — this overlay is built absolute-addressing (-G0, no gp-rel anywhere
in the container), so a shared global here is a data tie, not the ASPSX
definer/declarer rule.

Fingerprints:
- shared s16 global `D_80123754` (file-scope data at 0x80123754, splat data
  `69960.data.s`, still `nonmatching`): written by `ovl_11_func_800D12B8`
  (three `sh` sites, `lui v1, %hi`) and `ovl_11_func_800D1960` (single
  `sh a0`), read by `ovl_11_func_800D1CFC` (`lh`);
- zero-gap link-order contiguity (map): 0x800D12A0 (0x18) → 0x800D12B8
  (0x6A8) → 0x800D1960 (0xC) → 0x800D196C (0x2AC) → 0x800D1C18 (0xB8) →
  0x800D1CD0 (0x2C) → 0x800D1CFC (0x120) → 0x800D1E1C (0x9C) → 0x800D1EB8
  (0x2A8) — each starts exactly where the previous ends, the whole span
  0x800D12A0–0x800D2160 contiguous with no unrelated code between;
- the two `D_80123754` writers and the reader sit at the run's nodes
  (12B8 / 1960 at the front, 1CFC later), with the untouched members
  sandwiched between them — a single global threading one contiguous file.

Members (address order):
- ovl_11_func_800D12A0 (m, matched this session) — run head; s16 setter into
  D_8006C838+0x99E6 (flags/state array) via a large-offset split (base+0x8000,
  disp 0x19E6), local-pointer materialization; baseline flags; does not touch
  D_80123754 — role confirmed, shares the run's other data-tie class
- ovl_11_func_800D12B8 (s) — writes D_80123754 at three sites
- ovl_11_func_800D1960 (m, matched this session) — leaf setter:
  `D_80123754 = arg0` (single `sh`, delay-slot scheduled); byte-exact clean C,
  baseline flags; confirmed member of the shared-global cluster
- ovl_11_func_800D196C (s) — sandwiched, does not touch the global
- ovl_11_func_800D1C18 (s) — does not touch the global
- ovl_11_func_800D1CD0 (s) — does not touch the global
- ovl_11_func_800D1CFC (s) — reads D_80123754 (`lh`), the run's getter
- ovl_11_func_800D1E1C (s) — does not touch the global
- ovl_11_func_800D1EB8 (s) — run tail, does not touch the global

---

## `ovl_11` D_80128D78 / D_80128D7A s16-pair global cluster — 0x800D31EC–0x800D55F8 (confidence: low)

Shared 4-byte s16×2 global pair (adjacent fields at main RAM 0x80128D78 and
0x80128D7A), readable/writable from three non-adjacent ovl_11 functions
(0x800D31EC, 0x800D3FEC, 0x800D55F8 — gaps of ~0xE00 and ~0x1600, so this is a
data tie, not link-order adjacency). Same shared-scalar fingerprint as the
documented D_80123754 / D_80128810 clusters; as with those in this
absolute-addressed (-G0) overlay, a shared global is a data tie rather than the
ASPSX definer/declarer rule. One member calls ovl_11_func_800D12B8, which sits
in the D_80123754 setter run. Members:
- ovl_11_func_800D31EC (m, matched this session) — writes both s16 fields from
  args (lui pair + delay-slot sh pair), the pair's main setter
- ovl_11_func_800D3FEC (s) — reads D_80128D78 (`lhu`), subtracts it from a
  struct field +0xAC and clamps non-negative
- ovl_11_func_800D55F8 (s) — reads D_80128D7A (`lhu`) into struct field +0x22;
  calls ovl_11_func_800D12B8

---

## `ovl_11` short-fold helper trio — 0x800CE514–0x800CE53C (confidence: medium)

Candidate same-TU family of `ovl_11` (`Obj\GF_FARM.bin`) — three tiny range/
fold helpers at the overlay's 0x166F4 text region. Same shared-idiom
fingerprint class as the reset-stub family: near-identical instruction
shapes differing only in a fold constant, over strict zero-gap link order.

Fingerprints:
- shared idiom: `ovl_11_func_800CE53C` is **byte-identical** to
  `ovl_11_func_800CE514` except the fold constant (`addiu -0x7D` vs `-0xED`) —
  the identical-body fingerprint proven by the D_8012D52C reset-stub family;
  `ovl_11_func_800CE528` is the same sll/sra sign-extend skeleton with an
  `addu`/`sra` fold instead of `addiu`/`sltiu`;
- zero-gap link-order contiguity (map): 0x800CE514 (0x14) → 0x800CE528
  (0x14) → 0x800CE53C (0x14), each starting exactly where the previous ends,
  the span 0x800CE514–0x800CE550 contiguous with no unrelated code between.

Members (address order, all matched, baseline flags):
- ovl_11_func_800CE514 (m) — s16 range check: `(u32)(arg0 - 0xED) < 6U`
  (`sll`/`sra`/`addiu`/`jr`/`sltiu` delay slot)
- ovl_11_func_800CE528 (m) — s16 fold: `arg0 + 0xFF90` returning s16
  (`sll`/`lui`/`addu`/`jr`/`sra` delay slot)
- ovl_11_func_800CE53C (m, matched this session) — s16 range check: byte
  twin of 0x800CE514 with constant 0x7D, `(u32)(arg0 - 0x7D) < 6U`
  (`sll`/`sra`/`addiu`/`jr`/`sltiu` delay slot)

---

## `ovl_11` 0x800E48CC–0x800E5078 pointer-getter run (confidence: medium)

Candidate same-TU family of `ovl_11` (`Obj\GF_FARM.bin`) in the lower-middle of
the overlay. Evidence is strict link-order adjacency plus an internal call graph
centred on a single shared leaf getter; no shared global — the grouping is the
code, not data.

Fingerprints:
- zero-gap link-order contiguity (map): 0x800E48CC (0xD0) → 0x800E499C
  (0x150) → 0x800E4AEC (0x6C) → 0x800E4B58 (0x14) → 0x800E4B6C (0x38) →
  0x800E4BA4 (0x8C) → 0x800E4C30 (0x54) → 0x800E4C84 (0x84) → 0x800E4D08
  (0xA4) → 0x800E4DAC (0x2CC) — each starts exactly where the previous ends,
  the whole span 0x800E48CC–0x800E5078 contiguous with no unrelated code
  between;
- internal call graph: the leaf `ovl_11_func_800E4B58` is called by three of
  its neighbours — `ovl_11_func_800E4B6C`, `ovl_11_func_800E4C30` (twice,
  subtracting two consecutive getter results), `ovl_11_func_800E4D08` — and
  `ovl_11_func_800E4C30` also calls its own neighbour `ovl_11_func_800E4C84`;
  a packed cluster whose members call each other, not the engine.

Members (address order, matched in bold):
- ovl_11_func_800E48CC (s) — run head
- ovl_11_func_800E499C (s)
- ovl_11_func_800E4AEC (s) — sibling leaf, falls through to its own `jr $ra`
- **ovl_11_func_800E4B58 (m, matched this session)** — shared getter leaf,
  byte-exact clean C: `return *(s32 *)(arg0 + arg1*4 + 0x34);` — a
  base-pointer plus 4-byte-stride index plus fixed 0x34 offset; baseline
  flags. Called by 800E4B6C / 800E4C30 / 800E4D08 (whose `sw $v0` sites and
  `subu`-of-two-calls pattern consume it)
- ovl_11_func_800E4B6C (s) — feeds the getter `base + (s16)a0[2]*4 + 0x38`
  in `$a0`, passes its own incoming index through untouched in `$a1`
- ovl_11_func_800E4BA4 (s)
- ovl_11_func_800E4C30 (s) — `getter(base, i+1) - getter(base, i)`;
  also calls 800E4C84
- ovl_11_func_800E4C84 (s)
- ovl_11_func_800E4D08 (s) — loop calling 800E4B58, storing results into
  `D_801291C0[i]`, guarded by a 0x3C00 bit in an s16 word
- ovl_11_func_800E4DAC (s) — run tail (0x2CC)

---

## `ovl_11` D_80070D0E clear/read cluster — 0x800F4CA0–0x800F62D8 (confidence: low)

Candidate same-TU family of `ovl_11` (`Obj\GF_FARM.bin`) sharing a single
file-scope u16 global. Same shared-global-cluster fingerprint as the documented
D_80123754 run: absolute-addressed main-RAM global (no gp-rel in this container)
with one writer up front and a reader later, threaded through a contiguous text
span.

Fingerprints:
- shared u16 global `D_80070D0E` (main RAM 0x80070D0E, not in the EXE's
  generated `globals.h`): cleared by `ovl_11_func_800F4CA0` (single `sh $zero`),
  read by `ovl_11_func_800F62D8` (`lhu`);
- adjacent sibling s16 `D_80070D10` (main RAM 0x80070D10, 2 bytes above
  `D_80070D0E`, not in `globals.h`): set to 3 by `ovl_11_func_80111EE0`
  (single `lui`/`sh`, leaf, matched this session) — the adjacent-file-scope
  vars fingerprint, same-family plausible though far from the run
  (0x80111EE0 vs 0x800F4CA0);
- link-order adjacency: `ovl_11_func_800F4BB4` (0x800F4BB4–0x800F4CA0, 0xec)
  ends exactly where the clear starts, zero-gap contiguity into 0x800F4CAC, and
  `ovl_11_func_800F4BB4` also calls the clear — caller + link-order agree;
- second caller `ovl_11_func_800DE2EC` (0x800DE2EC) invokes the same clear,
  same-family plausible but far from the run.

Members (address order):
- ovl_11_func_800F4BB4 (s) — link-order predecessor and caller of the clear
- ovl_11_func_800F4CA0 (m, matched this session) — leaf clear: `D_80070D0E = 0`
  (single `sh $zero`, delay-slot scheduled); byte-exact clean C, baseline flags;
  the run's only confirmed global writer
- ovl_11_func_800F62D8 (s) — reads D_80070D0E (`lhu`), the run's getter
- ovl_11_func_80111EE0 (m, matched this session) — leaf setter:
  `D_80070D10 = 3` (single `lui`/`sh`, delay-slot scheduled); byte-exact clean
  C, baseline flags; adjacent-sibling writer of the cluster's other global

---

## `ovl_11` D_80071A00 byte-compare helper pool — 0x800F19C8 (confidence: low)

Candidate same-TU family of `ovl_11` (`Obj\GF_FARM.bin`) sharing the
adjacent file-scope globals just above the D_80070D0E data region. Same
shared-global fingerprint as the documented D_80070D0E cluster: main-RAM
file-scope globals absent from the generated `globals.h`, each read by a
short leaf homogeneity/compare helper. No link-order contiguity between the
members yet (spread 0x800CBDFC / 0x800F19C8 / 0x8011D06C), so same-family is
plausible rather than established.

Fingerprints:
- s16 `D_80071A22` (main RAM, not in `globals.h`): read by
  `ovl_11_func_800F19C8` (`lh`), the run's lone writer/getter so far;
- adjacent sibling globals in the same 0x80071A00 pool, each read by one other
  matched ovl_11 leaf — s32 `D_80071A5C` (`ovl_11_func_8011D06C`, `>=`-guard)
  and s32 `D_80071A6C` (`ovl_11_func_800CBDFC`, mask-and-test);
- call/link adjacency: `ovl_11_func_800F19E0` (0x800F19E0, immediately after
  in link order) calls `ovl_11_func_800F19C8` and reads its result.

Members (address order):
- ovl_11_func_800CBDFC (m, matched earlier) — leaf: `(D_80071A6C & 0x20000000)`
  mask-and-test on the pool's upper sibling
- ovl_11_func_800F19C8 (m, matched this session) — leaf byte-compare helper:
  `return D_80071A22 == (arg0 & 0xFF);` (6 words, `andi` + `lh` + `sltu` mount,
  no branches); byte-exact clean C, baseline flags; run's only confirmed
  D_80071A22 reference; caller is link-adjacent ovl_11_func_800F19E0
- ovl_11_func_8011D06C (m, matched earlier) — leaf: `return D_80071A5C >= arg0;`
  `>=`-guard on the pool's middle sibling

---

## `ovl_11` D_801295C6 setter/getter run — 0x800E60A0–0x800EEBC8 (confidence: medium)

Candidate same-TU family of `ovl_11` (`Obj\GF_FARM.bin`) sharing a single
file-scope s16 global. Same shared-global-cluster fingerprint as the documented
D_80123754 run: absolute-addressed main-RAM global (no gp-rel in this container)
with writers up front and a reader later, threaded through a contiguous text
span.

Fingerprints:
- shared s16 global `D_801295C6` (main RAM 0x801295C6): written by
  `ovl_11_func_800E60A0` (`sh v0`), `ovl_11_func_800E880C` (`lh`/
  `sh s0`), and `ovl_11_func_800EE604` (`sh v0`), read by
  `ovl_11_func_800EEBB8` (`lh`, pure getter);
- link-order contiguity in the TL run: 0x800EE604 (0x1B8) ends exactly where
  `ovl_11_func_800EE7BC` begins, and the zero-gap chain 0x800EE7BC (0x188) →
  0x800EE944 (0x174) → 0x800EEAB8 (0x100) → 0x800EEBB8 (0x10) → 0x800EEBC8
  (0x2C) → 0x800EEBF4 (0x20) → 0x800EEC14 (0x8) → 0x800EEC1C (0x2B0) runs
  without a gap — the setter at the run head, the getter two nodes later;
- the two other `D_801295C6` sites (0x800E60A0, 0x800E880C) are far earlier
  in the overlay, same-family plausible but not link-adjacent.

Members (address order):
- ovl_11_func_800E60A0 (s) — writes D_801295C6 (`sh v0`), earlier site
- ovl_11_func_800E880C (s) — reads and writes D_801295C6, earlier site
- ovl_11_func_800EE604 (s) — run-head writer of D_801295C6 (`sh v0`)
- ovl_11_func_800EE7BC (s) — sandwiched, does not touch the global
- ovl_11_func_800EE944 (s) — sandwiched, does not touch the global
- ovl_11_func_800EEAB8 (s) — sandwiched, does not touch the global
- ovl_11_func_800EEBB8 (m, matched this session) — leaf getter:
  `return D_801295C6;` (`lui`/`lh`, delay-slot `nop`); byte-exact clean C,
  baseline flags; confirmed member of the shared-global cluster
- ovl_11_func_800EEBC8 (s) — sandwiched, does not touch the global

---

## `ovl_11` D_8012D52C reset-stub family — 0x80114184 / 0x8011A9CC–0x8011B6C0 (confidence: medium)

Candidate same-TU family of `ovl_11` (`Obj\GF_FARM.bin`) sharing one
file-scope s32 flag plus a byte-identical reset-and-return-1 stub shape. Same
shared-global + shared-idiom fingerprint class as the documented D_80128810
counter cluster / D_801295C6 run: absolute-addressed main-RAM global (no gp-rel
in this container) threaded through a wide text span.

Fingerprints:
- shared s32 global `D_8012D52C` (main RAM 0x8012D52C, absolute `lui`+`%lo` in
  every site): written to 0 from ~35 sites across 0x80113CD0–0x8011C104 — a
  container-wide busy/finished state flag, not itself a TU fingerprint;
- identical-body reset stubs: `ovl_11_func_80114184`, `ovl_11_func_8011A9CC`,
  `ovl_11_func_8011AA44`, `ovl_11_func_8011AA54` and `ovl_11_func_8011B6B4`
  are all numerically byte-identical — `lui %hi(D_8012D52C); sw $zero,
  %lo(D_8012D52C); jr $ra; addiu $v0, $zero, 1` (the classic case-handler
  "reset flag and report handled" stub), arranged as a contiguous zero-gap run
  0x8011A9CC (0x10) → 0x8011A9DC (0x40) → 0x8011AA44 (0x10) → 0x8011AA54
  (0x10) → 0x8011AA64 (0x1CC) → 0x8011AC30 (0x1C4) → 0x8011ADF4 (0x1C0) →
  0x8011AFB4 (0x25C) → 0x8011B210 (0xA0) → 0x8011B2B0 (0x404) → 0x8011B6B4
  (0x10), each function starting exactly where the previous one ends;
- our member 0x80114184 sits earlier (0x80114184) amid other D_8012D52C
  writers — `ovl_11_func_80113FF0` clears the flag via `$a0` at 0x80114178 and
  `ovl_11_func_80114194` clears it at 0x8011438C — same family, earlier text
  span; same-TU tie to the contiguous run is plausible but not proven.

Members (address order):
- ovl_11_func_80114184 (m, matched this session) — leaf reset stub:
  `D_8012D52C = 0; return 1;` (`lui`/`sw`/`jr`/`addiu`); byte-exact clean C,
  baseline flags; the 0x80114184 member of the reset-stub family
- ovl_11_func_8011A9CC (m, matched this session) — identical leaf reset stub, run head at 0x8011A9CC; byte-exact clean C `D_8012D52C = 0; return 1;` (`lui`/`sw`/`jr`/`addiu`), baseline flags, confirming the family's identical-body fingerprint against the matched `ovl_11_func_80114184`
- ovl_11_func_8011AA44 (m, matched this session) — identical leaf reset stub; byte-exact clean C `D_8012D52C = 0; return 1;` (`lui`/`sw`/`jr`/`addiu`), baseline flags, confirming the family's identical-body fingerprint
- ovl_11_func_8011AA54 (m, matched this session) — identical leaf reset stub; byte-exact clean C `D_8012D52C = 0; return 1;` (`lui`/`sw`/`jr`/`addiu`), baseline flags, confirming the family's identical-body fingerprint
- ovl_11_func_8011B6B4 (m, matched this session) — identical leaf reset stub, run tail at 0x8011B6B4; byte-exact clean C `D_8012D52C = 0; return 1;` (`lui`/`sw`/`jr`/`addiu`), baseline flags, confirming the family's identical-body fingerprint for the run-tail member

---

## `ovl_11` D_8012DB10 / D_8012DB14 s32-pair run — 0x8011F0C4–0x8011F1D0 (confidence: medium)

Candidate same-TU run of `ovl_11` (`Obj\GF_FARM.bin`) whose head resets a
file-scope s32 pair. Same shared-global + link-adjacency fingerprint class as
the documented `D_80123754` / `D_800BB7BC` runs: absolute-addressed main-RAM
globals (no gp-rel in this container), so the referencing TU only *declares* the
pair extern and the defining TU sits elsewhere in the overlay.

Fingerprints:
- shared s32 pair `D_8012DB10` / `D_8012DB14` (main RAM 0x8012DB10/0x8012DB14,
  absolute `lui`+`%lo` at every site): referenced by the three functions of the
  run head — `ovl_11_func_8011F0C4` zeroes both, `ovl_11_func_8011F0D8` reads
  `D_8012DB10` as a one-shot guard (`bnez`, sets it to 1 on first entry) then
  clamps/writes `D_8012DB14`, `func_8011F114` reads and rewrites both heavily;
- zero-gap link order: `ovl_11_func_8011F0C4` (0x14) → `ovl_11_func_8011F0D8`
  (0x3C) → `func_8011F114` (0xBC) → `func_8011F1D0` (0x324), each starting
exactly where the previous one ends; the first three share the pair, the last
(0x8011F1D0) continues the run but reads other globals (`D_8012852C`,
`D_8007AFEE`, `jtbl_800BB5E8`) — same-TU tie via run continuity, not the pair.

Members (address order):
- ovl_11_func_8011F0C4 (m, matched this session) — run head at 0x8011F0C4; resets
  both members of the pair to 0 by absolute addressing: `lui %hi(D_8012DB10); lui
  %hi(D_8012DB14); sw $zero, %lo(D_8012DB10); jr $ra; sw $zero, %lo(D_8012DB14)`
  (second store in the delay slot); byte-exact clean C, baseline flags
- ovl_11_func_8011F0D8 (s) — reads `D_8012DB10` as a first-entry guard, stores 1
  to it, and writes a clamped (0..9) value to `D_8012DB14`
- func_8011F114 (s) — heavier reader/writer of both words (0xBC bytes)

---

## `ovl_10` overlay tail — /15 date-utility pair around 0x800BB728 (confidence: low)

Candidate tail-cluster of `ovl_10` (`Obj\gf_mcard.bin`, the memory-card manager
overlay). Evidence is a single strong adjacency plus a shared idiom; same-TU
membership is unproven (the abutting global could belong to a neighbour's data
pool).

Fingerprints:
- link-order adjacency: `ovl_10_func_800BB728` is the **last** function in the
  overlay (0x800BB728, size 0x94, ends 0x800BB7BC) and its end abuts
  `D_800BB7BC` in the original bytes — a file-scope word (initialised 0)
  that `ovl_10_func_800B8A5C` reads and writes at four+ sites
  (`lw`/`sw`/`lw` %hi/%lo(D_800BB7BC)), followed by that TU's data pool
  (0xFFFFFFFF, 0, then address tables); a classic code-then-data same-TU tail
  layout. Ownership correction: the matched `800B8A5C` target uses **absolute**
  %hi/%lo addressing for `D_800BB7BC` *and* `D_800BB7C0/C4/CC/D0` — under -G8 a
  TU that tentatively defines a ≤8-byte global gets a single GP-relative access,
  so `800B8A5C`'s own TU only *declares* these words extern; the word cluster's
  defining TU is the one that owns `800BB728`, not the /15 remainder routine;
- shared idiom: both `ovl_10_func_800BB728` and `ovl_10_func_800B8A5C` are
  date/remainder utilities using the `/15` `0x88888889` magic-reciprocal
  sequence (the documented mod-N idiom of the exe frame counters);
- call graph: `ovl_10_func_800BB728` is a leaf predicate called from seven
  container sites (`800B95F0`, `800B9AA8`, `800B9D24`, `800BA394`,
  `800BAB10`, `800BADA4`, and its immediate predecessor `800BB264`), all
  testing `beqz` — a shared calendar/day-slot utility.

Members (address order):
- ovl_10_func_800B8A5C (m, matched) — /15 remainder routine (day-of-month
  wrap); reader/writer (not definer) of the `D_800BB7BC/C0/C4/CC/D0` cluster via
  absolute addressing; the matched source uses two separate `% 15` expressions
  whose magic-reciprocal mult tails are cross-jumped into one shared block, plus
  a packed 28-byte `D_800BBAFC = D_800B7E24` struct copy and a final byte store
  to `D_800BBAFC`; byte-exact clean C, baseline flags
- ovl_10_func_800BB728 (m, matched 2026-08-22) — leaf date predicate: day slot
  0–0x50 via `/40`, days at/after 0x50 via `(arg0-0x50)/15`, returning 1 iff
  the day stays before the next slot boundary; byte-exact clean C, baseline flags

---

## `ovl_10` debug/status string-table cluster — 0x800B814C–0x800B821C (confidence: low)

Candidate same-TU family of memory-card manager (`Obj\gf_mcard.bin`)
status/debug printers around 0x800B92AC–0x800BA2A0. Evidence is a contiguous
rodata string table plus address adjacency; same-TU membership is unproven
(the strings could straddle neighbouring data pools, as the tail-group note
warns for its own abutting global).

Fingerprints:
- shared string cluster: `D_800B814C`—`D_800B821C` is one contiguous block of
  debug/status format strings — "    no data disp \n", tx/rx/disable mode
  labels, sat..sun day abbreviations, "    current appli cation :%d \n",
  "    PDA appli flush access :%s \n", "SUPERIOR"/"INFERIOR",
  "    current control  sound:%s  infred:%s \n", "ENABLE" — and at least
  four adjacent functions each pull one or more strings from it;
- address adjacency: the four member functions sit together in link order
  (0x800B92AC, 0x800B92D0, 0x800B9458, 0x800BA2A0), immediately after the
  jtbl_800B811C switch table in the same rodata region;
- main-loop driver (2026-08, 800B889C matched): the overlay's first
  function (splat offset 0xA7C, immediately before 800B8A5C) is a frame
  loop that polls `D_800BB7C4` — the loop-flag word `ovl_10_func_800B8A5C`
  sets on pad bit 0x100 — inits the shared `D_800BBA4C` byte buffer the
  grid-display editors mutate, and every frame calls `func_80013B04` (pad),
  `ovl_10_func_800B8A5C`, and confirmed cluster member
  `ovl_10_func_800B8C14` between two alternating DRAWENV/DISPENV swaps — a
  call-graph + shared-global tie running through the whole 800B889C–
  800B8C14 front of the overlay;
- call graph: `ovl_10_func_800B9108` dispatches to cluster neighbours
  (`800B95A4`, `800B956C`) and `ovl_10_func_800B956C` directly calls
  `800B92AC` — mcard status/app wrappers, a call-graph adjacency
  consistent with shared-TU membership;
- shared wrapper skeleton: `ovl_10_func_800BA11C` is a byte-exact twin of
  cluster members `ovl_10_func_800BA2A0` and `ovl_10_func_800BACBC` — the
  same four-way 0/1/2/3 arg0 dispatch, the same `?:` ternary
  status-string selection (`D_800BB9A8 ? &D_800B8590 : &D_800B8594`,
  mirroring `D_800BB9B4 ? &D_800B81D8 : &D_800B81E4` and
  `D_800BB8A0 ? &D_800B8430 : &D_800B8434`), and the same case-3
  `ovl_10_func_800B92AC(); return 0` tail; its mcard status-word cluster
  `D_800BB9A8/AC/B0` abuts `D_800BB9B4` (owned by 800BA2A0) in the same
  data region, and its status strings `D_800B84DC`–`D_800B8594` abut
  `D_800B8598` (owned by 800BA2A0) in the extended string pool past the
  0x800B821C block; `ovl_10_func_800BAB10` is the immediate link-order
  predecessor of `ovl_10_func_800BACBC` (0x800BAB10's 0x1AC body ends
  exactly at 800BACBC), carries the same 0/1/2/3 twin skeleton, pulls six
  status strings `D_800B86E0`–`D_800B876C` that directly abut 800BACBC's
  `D_800B878C`/`D_800B87AC` in the same rodata pool, and drives status
  words `D_800BB890`–`D_800BB89C` that abut 800BACBC's `D_800BB8A0` in
  the same mcard-buffer data region;
- grid-display sub-family: five members (`800B95F0`, `800B9D24`, `800BA394`,
  `800BADA4`, `800BB264`) share one shape — a `switch (arg0)` editor whose
  arg0==0 arm moves a cursor from pad bits, bumps four per-bit repeat counters
  gated by `ovl_10_func_800BB728`, and nibble-mutates a global byte buffer with
  the same 0x10/0xF0/±1/±0xF arms and the same 0x81/0x90/0xF0 wrap; whose
  arg0==1 arm renders that buffer 16 bytes to a row with `sprintf`+"%02x" into
  a 16-byte stack buffer and the cluster's ternary colour-select; and whose
  arg0==2 arm is a single `Mcx*` call taking the buffer and a packed address.
  They are the four functions the 2026-08-21/22 loop parked out of nine, and
  they parked for one reason each rather than for being hard — see
  `plans/loop-gradient-precision.md`;
- extended string pool + shared global: the same rodata region holds the
  command-menu formats `D_800B7F24`–`D_800B8074` (with `D_800B80C8` "no
  parameter needed" between them and the documented block), consumed by
  `ovl_10_func_800B9060`; that menu printer reads the shared label array
  `D_800BBB3C` which dispatcher `ovl_10_func_800B8C14` fills, and
  `800B8C14` calls `800B9060` — a call-graph + shared-global adjacency
  tying this cluster to the memory-card command-dispatcher code.

Members (address order):
- ovl_10_func_800B889C (m, matched this session, baseline flags) — overlay
  main-loop driver: font/display-env setup (FntLoad/FntOpen, four
  SetDef{Draw,Disp}Env), D_800BBA4C[0..5] = {1,4,1,0,0xD,0x80} init, then
  a frame loop polling D_800BB7C4 that calls func_80013B04 (pad),
  ovl_10_func_800B8A5C, ovl_10_func_800B8C14 and flips two packed
  DRAWENV/DISPENV pairs (PutDispEnv(cur+0x5C) / PutDrawEnv(cur)); the
  leading function in link order
- ovl_10_func_800B8C14 (m, matched 2026-08-23, baseline flags) — mcard
  read-result renderer: fills the shared label array `D_800BBB3C`
  (15 entries, one re-targeted to `D_800B7E48` via `D_800BB7BC`), calls
  `ovl_10_func_800B9060`, then `McxSync`-selects one of six packed
  card-recovery records copied into the shared `D_800BBAFC` buffer (same
  packed-record idiom as `800B8A5C`/`800B9AA8`), and re-dispatches
  through `ovl_10_func_800B9108`. See notes/research/ovl_10_func_800B8C14.md
- ovl_10_func_800B9108 (m, matched this session, baseline flags) — the
  switch dispatcher: routes D_800BB7BC command id to the cluster wrappers on
  jtbl_800B80E4 (ids 1–14) and jtbl_800B811C (ids 0/4/5/6/11, reached only
  for arg0 1..3); owns the rodata block D_800B80C8 "no parameter needed" +
  the two switch tables, whose jtbl_800B811C (0x2FC) end abuts
  D_800B814C (0x32C, ovl_10_func_800B92AC's string) with zero padding — a
  same-.rdata-emission adjacency tying the dispatcher to the cluster's first
  string
- ovl_10_func_800B9060 (m, matched this session, baseline flags) — mcard
  debug command-menu printer: six `FntPrint`s from formats
  `D_800B7F24`/`D_800B7F78`/`D_800B7FCC`/`D_800B8020`/`D_800B8074`/
  `D_800B7EE8`, each 3-column row fed from shared label array
  `D_800BBB3C[0..4]`/`[5..9]`/`[10..14]`; called by dispatcher
  `ovl_10_func_800B8C14`
- ovl_10_func_800B92AC (m, matched this session) — prints the "no data
  disp" status line via `FntPrint(&D_800B814C)`; byte-exact clean C,
  baseline flags
- ovl_10_func_800B92D0 (m, matched this session) — status printer: references
  `D_800B8194`, `D_800B81B4`, `D_800B81D8`, `D_800B81E4`, `D_800B81F0`
  (current-app, PDA-flush, SUPERIOR/INFERIOR, sound/infred control lines),
  `D_800B822C` (extended pool), indexed reads of `D_800BB7C8`/`D_800BB7D8`,
  and mcard buffer `D_800BB8DC`; byte-exact twin structure of
  `ovl_10_func_800B94A4`, slot-branch on `arg0 == 2` calling
  `McxAllInfo(0, &D_800BB8DC)` (`D_800BB8DC` abuts `D_800BB8F0`/`D_800BB8FC`
  in the same data region)
- ovl_10_func_800B94A4 (m, matched this session) — slot-2 mcard-status
  wrapper dispatched by `ovl_10_func_800B9108`: if slot == 2,
  `McxGetTime(0, &D_800BB8F4)`, else prints three status lines from
  formats `D_800B8244`–`D_800B8278` (string pool extended past the
  0x800B821C block bound, same as `D_800B822C`) plus one indexed read
  of `D_800BB7F4`; byte-exact twin structure of `ovl_10_func_800B9458`
  and `ovl_10_func_800B95A4` (`D_800BB8F4` abuts their `D_800BB8F0`/
  `D_800BB8FC` mcard buffers in the same data region)
- ovl_10_func_800B9458 (s) — references `D_800B8194` ("current appli
  cation :%d")
- ovl_10_func_800B95A4 (m, matched this session) — slot-2 mcard-serial
  wrapper dispatched by `ovl_10_func_800B9108`: if slot == 2,
  `McxGetSerial(0, &D_800BB8FC)`, else `FntPrint(&D_800B822C,
  D_800BB8FC)`; byte-exact twin structure of `ovl_10_func_800B9458`
  (D_800B822C is a format string just past the string-block bound)
- ovl_10_func_800B956C (m, matched this session) — mcard hide-transition
  wrapper: if slot == 2, `McxHideTrans(0)`, else `ovl_10_func_800B92AC();
  return 0`
- shared loop-pass idiom (2026-08-23, 800B95F0 matched with 800BA394 as
  donor): the grid loop derives the row offset as an inlined `row * 0x10` at
  every consumer and lays the inner loop out as
  `if (row*0x10 < count) do { body; i++; if (i>=0x10) break; } while
  (row*0x10+i < count)`, which loop.c combines into a stepping offset
  accumulator whose init is emitted after pass-1 movables (block 49 / block
  93 preheader law). A derived-offset `for` form never reduces (the giv's
  benefit 3 minus add_cost 4 is negative); the break-form do-while does.
- ovl_10_func_800B95F0 (m, matched 2026-08-23, baseline flags) — mcard
  read-device address/length editor and the simplest member of the
  grid-display family: the cluster's 0/1/2/3 skeleton with cursor
  `D_800BB98C` over the 5-byte address/length field
  `D_800BB810[0..4]` (0x2000/0x8000 inc/dec within 0..4, 0xA000 latched into
  `D_800BB990`), per-bit repeat counters `D_800BB824`/`828`/`82C`/`830` gated
  by the /15 date-predicate `ovl_10_func_800BB728`, and the same
  0x10/0xF0/±1/±0xF nibble mutation with the 0x81/0x90/0xF0 wrap arms;
  arg0==1 prints the five `%02x` fields with the cluster's ternary
  colour-select; arg0==2 → `McxGetMem(0, D_800BB90C, packed-address,
  D_800BB810[4])`; arg0==3 draws the 16-byte-row grid of `D_800BB90C` —
  the same grid display as 800BB264 and 800BADA4 over a different buffer
- ovl_10_func_800B9AA8 (m, matched this session, baseline flags) — mcard
  data-transfer wrapper: the cluster's 0/1/2/3 twin skeleton with the
  `ovl_10_func_800B92AC(); return 0` tail; arg0==0 drives status words
  `D_800BB834`–`D_800BB840` from arg1 pad flags (0x20→1, 0x40→0, 0x10→
  increment `D_800BB83C`, 0x80→increment `D_800BB840`, each gated by the
  /15 date-predicate `ovl_10_func_800BB728` while `D_800BB834` < 0xF / >= 2
  — the counter flip of 800BAB10); arg0==1 prints four status lines and
  selects `D_800B8430`/`D_800B8434` in the cluster's ternary idiom (the
  same two strings 800BACBC's ternary selects); arg0==2 →
  `McxExecFlag(0, D_800BB834, D_800BB838)`, copying the packed 30-byte
  save struct `D_800B8438`→`D_800BBAFC` on the `MemCardSync(0)` accept
  path; link-ordered inside the cluster's 0x800B92AC–0x800BA2A0 region
- ovl_10_func_800BB264 (m, matched 2026-08-22, baseline flags) — mcard
  block/cursor display editor, the cluster's 0/1/2/3 twin skeleton with the
  `ovl_10_func_800B92AC(); return 0` tail; arg0==0 drives the cursor
  `D_800BB8B8` (0x2000/0x8000 inc/dec within 0x00..0x9F, 0x1000 -= 0x10
  with a -1 floor, 0x4000 += 0x10 with a 0xA0 ceiling from <0, 0xF000
  latched into `D_800BBA44`), then bumps per-bit repeat counters
  `D_800BB8BC`/`8C0`/`8C4`/`8C8` gated by the /15 date-predicate
  `ovl_10_func_800BB728` and nibble-mutates the buffer `D_800BBA4C`
  (0x10/0xF0/±1/±0xF); arg0==1 draws the full 16-byte-row grid of
  `D_800BBA4C[1..0x20]` then `D_800BBA4C[0x21..0xA0]` (the only complex
  grid display in the cluster, twin of 800BADA4), with the cluster's
  ternary string selects and `sprintf`+"%02x" into a 16-byte stack
  buffer; arg0==2 → `McxWriteDev(0, D_800BBA4C[0], &D_800BBA4C[1],
  &D_800BBA4C[0x21])`; arg0==3 → `ovl_10_func_800B92AC(); return 0`;
  own globals `D_800BB8B8`–`D_800BB8C8`, `D_800BBA44` added to
  globals_override.h (editor region)
- ovl_10_func_800BADA4 (m, matched 2026-08-22, baseline flags) — mcard
  slot/S/R/L button editor and the grid twin of 800BB264: same 0/1/2/3
  skeleton, same cursor/repeat-counter/nibble-mutate arg0==0 body over
  cursor `D_800BB8A4` (range 0x00..0x1F) with 0xF000 latched into
  `D_800BBA40`, same `D_800BBA4C` buffer; arg0==1 draws
  `D_800BBA4C[1..0x20]`, arg0==2 → `McxReadDev(0, D_800BBA4C[0],
  &D_800BBA4C[1], &D_800BBA4C[0x21])` after zeroing the 0x80-byte read
  region, arg0==3 draws `D_800BBA4C[0x21..0xA0]`; own globals
  `D_800BB8A4`–`D_800BB8B4`, `D_800BBA40` (editor region, contiguous with
  800BB264's)
- shared cluster idiom (both of the above, and 800B9D24): a display loop
  over a global byte array indexes the global directly —
  `D_800BB99C[s0 + 1]`, `D_800BBA4C[s1 + s2 + 1]` — rather than walking a
  hoisted base pointer, and the row/column index is spelled
  inner + outer. Both editors matched on that idiom alone.
- ovl_10_func_800B9D24 (m, matched 2026-08-22, baseline flags) — mcard
  application-number wrapper: the cluster's 0/1/2/3 twin skeleton with the
  `ovl_10_func_800B92AC(); return 0` tail; arg0==0 drives the selected
  appli index `D_800BB844` from arg1 pad flags (0x2000/0x8000 inc/dec
  within 1..3, 0x1000→0, 0x4000→1 when 0, 0xF000 latched into
  `D_800BB994`), then bumps per-bit repeat counters `D_800BB848`/`84C`/
  `850`/`854` gated by the /15 date-predicate `ovl_10_func_800BB728` and
  nibble-mutates the appli data `D_800BB99C` (BCD-ish 0x10/0xF0/±1/±0xF
  nibble ops, -1 arm, mask-off tail); arg0==1 prints the
  "application number" panel using the cluster's ternary color-select
  idiom (`D_800B8360`/`D_800B8358`) and an `%02x` `sprintf` into a local
  buffer per slot; arg0==2 → `McxExecApl(0, D_800BB99C[0], packed)`;
  own globals `D_800BB844`–`D_800BB854` words and `D_800BB994`/`D_800BB99C`
  abutting the cluster data region; link-order immediate predecessor of
  `800BA11C` (0x1F04 body ends at 0x22FC), same twin skeleton as
  `800BA11C`/`800BA2A0`/`800BACBC`, baseline flags
- ovl_10_func_800BA11C (m, matched this session, baseline flags) — mcard
  sound/infrared menu controller: arg0==0 reads the pad flags (0x10/0x80
  move the cursor word `D_800BB9AC` within 0..3, 0x90 latched into
  `D_800BB9B0`, 0x20→1/0x40→0 into `D_800BB9A8`); arg0==1 prints two
  status lines then `FntPrint(&D_800B854C, D_800BB9A8 ? &D_800B8590 :
  &D_800B8594, D_800BB858[D_800BB9AC])` — the cluster's ternary
  status-select idiom over a per-slot label array; arg0==2 →
  `McxCurrCtrl(0, D_800BB9A8, D_800BB9AC, 0)`; arg0==3 →
  `ovl_10_func_800B92AC(); return 0` — byte-exact twin structure of
  `800BA2A0`/`800BACBC`, baseline flags
- ovl_10_func_800BA2A0 (m, matched 2026-08-22) — mcard PDA-flush/control
  wrapper: arg0==0 sets `D_800BB9B4` from arg1 flags (0x20→1, 0x40→0);
  arg0==1 prints the flush-status lines (`FntPrint(&D_800B8598)` and
  `FntPrint(&D_800B85C4)` then `FntPrint(&D_800B85F0, D_800BB9B4 ?
  &D_800B81D8 : &D_800B81E4)` — SUPERIOR/INFERIOR ternary); arg0==2 →
  `McxFlashAcs(0, D_800BB9B4)` (returns its result); arg0==3 →
  `ovl_10_func_800B92AC(); return 0` — byte-exact twin structure of
  `ovl_10_func_800BACBC`, with adjacent status word `D_800BB9B4` played
  exactly as 800BACBC plays `D_800BB8A0`; baseline flags
- ovl_10_func_800BA394 (s) — mcard write-device editor, the largest member of
  the grid-display family and the only one whose `switch (arg0)` compiles to a
  jump table: cursor `D_800BB868` ranges over both a five-field header
  (`D_800BB86C[0..4]`, addressed as negative cursor values −5..−1) and the
  0xA0-byte payload `D_800BB9BC`, which is why its 0x1000/0x4000 arms are a
  nested switch rather than the family's two-line clamp; arg0==1 prints the
  header fields then the payload grid, 16 bytes to a row, bounded by
  `D_800BB86C[4]`; arg0==2 → `McxSetMem(0, D_800BB9BC, packed-address,
  D_800BB86C[4])`; arg0==3 → `ovl_10_func_800B92AC(); return 0`. Its table is
  `jtbl_800B86CC`; until 2026-08-22 the container had no rodata attribution
  mechanism, so compiling it as C could not link at all — see the note below
- ovl_10_func_800BAB10 (m, matched this session, baseline flags) — mcard
  status/transition controller, byte-exact from the first clean C draft;
  immediate link-order predecessor of 800BACBC. arg0==0 updates status words
  `D_800BB890`/`D_800BB894` from arg1 pad flags (0x20→1, 0x40→0; 0x10 →
  increments `D_800BB898`, 0x80 → increments `D_800BB89C`, each gated by the
  /15 date-predicate `ovl_10_func_800BB728` while below 0xFF / above 0;
  counters cleared on the off-path); arg0==1 prints four status lines from
  `D_800B86E0`/`D_800B870C`/`D_800B8738`/`D_800B876C`, with the cluster's
  `?:` status-select ternary over `D_800B8754`/`D_800B8760` for
  `D_800BB890`; arg0==2 → `McxShowTrans(0, D_800BB890, D_800BB894)` — the
  show-transition mirror of 800B956C's `McxHideTrans(0)`; arg0==3 →
  `ovl_10_func_800B92AC(); return 0` — the cluster twin skeleton;
  status words `D_800BB890`–`D_800BB89C` abut 800BACBC's `D_800BB8A0`,
  and its strings abut 800BACBC's `D_800B878C`/`D_800B87AC`.
- ovl_10_func_800BACBC (m, matched this session, baseline flags) — mcard
  status/LED control wrapper: arg0==1 prints a status line
  (`FntPrint(&D_800B878C)` then `FntPrint(&D_800B87AC,
  D_800BB8A0 ? &D_800B8430 : &D_800B8434)`); arg0==0 sets the D_800BB8A0
  status word from arg1 flags (0x20→1, 0x40→0); arg0==2 →
  `McxSetLED(0, D_800BB8A0)`; arg0==3 → `ovl_10_func_800B92AC(); return 0`
  — the same hide/status wrapper shape as `ovl_10_func_800B956C` (both
  call 800B92AC and return 0), and a direct second caller of that
  confirmed member; D_800BB8A0 sits in the same mcard-buffer data region
  as the cluster's D_800BB8F0/F4/FC; byte-exact clean C,
  baseline flags

---

## `exe` "collision.c" — 0x8001E334–0x8001EFA4 (confidence: high)

Floor/surface collision subsystem: walkmesh quads split into triangle
tests against a query point, hit recorded in globals.

Fingerprints:
- shared gp-rel cluster D_8005E4F0–D_8005E528 (query point, tolerances,
  cross products, hit flag, hit-triangle vertex pointers — semantic
  hypotheses annotated in include/globals_override.h);
- nested-function static-chain fingerprint: EAE4 materializes its frame base
  as `$v0 = $sp + 16` before all eight E878/E9F8 calls; E878 consumes incoming
  `$v0`, while E9F8 saves it and forwards it before sibling E878 calls. This
  proves the three contiguous functions came from one nested-function TU; the
  register-asm constructs in the separate E878/E9F8 files only emulate that
  incoming chain under the project's split source layout;
- internal call graph: E4C0 (driver) → E78C/EAE4/E38C/E7DC;
  EAE4 (poly iterator) → E878 ×4 + E9F8 ×4; E9F8 → E878 ×2;
  E38C → func_80038674 (external consumer).

Members (address order):
- SetVal8005E51C 0x8001E334 (m) — tolerance setter
- func_8001E340 (m) — sets each collision-cell's flag to 1 (grid at *arg0, cells 0x1C-stride from +0xC, flag at +0x18); tiny, touches no cluster globals
- func_8001E38C (m) — post-hit consumer, guards on D_8005E528
- func_8001E4C0 (s) — driver: clears flags, installs query pointer
- func_8001E6FC (s) — small; query pointer + D_8005E524
- func_8001E78C (m) — 2D proximity test; owns D_8005E520 (tolerance)
- func_8001E7DC (m) — 3D form of E78C, same D_8005E520 tolerance
- func_8001E878 (m) — nested point-in-triangle; split-file static-chain emulation
- func_8001E9F8 (m) — nested point-in-quad; saves/forwards the static chain
- func_8001EAE4 (m) — parent polygon-list iterator; nested declarations emit
  the eight static-chain setups; byte-matched clean C (2026-08-14)
- func_8001EFA4 (m) — no longer suspected collision.c member. See viewport.c group below.

References: notes/research/func_8001E878-dead-spill-allocation.md §9,
notes/research/func_8001E9F8.md,
notes/research/func_8001EAE4-v0-channel-delay-slot-fossil.md.

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

## gradient-interpolation cluster — 0x8001F278–0x8001FABC (confidence: low)

Candidate group in the unassigned gap between viewport/camera (ends 0x8001F24C)
and sound init (starts 0x8001FEA4). Evidence is internal call graph plus
address adjacency — no shared globals or register quirks found, so same-TU
membership remains unproven; the two callers share a stronger fingerprint
below.

Fingerprints:
- internal call graph: func_8001F774 → func_8001F278; func_8001F8A4 →
  func_8001F774; func_8001FA0C → func_8001F774; func_8001F664 →
  func_8001FAB4 (new 2026-08-21)
- address adjacency: callers/callee are contiguous; link order agrees
- shared caller idiom (new 2026-08-21): func_8001FA0C and func_8001F8A4 both
  consume the same GradientCmd struct (include/game_types.h — field_0 source
  u16*, signed field_4/field_8/field_A, u16 field_C..field_12 RECT) and both
  end with the byte-identical builder tail: `packet = func_8001E0B8(0, 0x44)`, `SetDrawLoad(packet, &rect)`, `func_8001F774(packet + 0x10, field_0, field_0 + 0x20, arg, field_8)`. func_8001FA0C matched clean C reproducing it
exactly; func_8001F8A4 confirmed matching with the same tail (2026-08-22).

Members (address order):
- func_8001F278 (m) — generic 3-element linear interpolation helper
  (out = (a-b)*t/len + b over 3 steps)
- func_8001F774 (m) — 16-step gradient interpolator: extracts 5-bit fields
  from two u16 inputs, interpolates via F278, packs 3×5-bit result into u16
  (bit 15 set when non-zero); no globals
- func_8001F8A4 (m, 2026-08-22) — gradient-progress counter update: clamps
  field_A/field_4 to non-negative, folds arg1 (clamped to field_8) into
  field_A per arg2 (1 = sign-directed incr/decr, else wrap-around clamp),
  then runs the same gradient-draw tail as func_8001FA0C but passes field_A
  as func_8001F774's step arg; byte-exact clean C, baseline flags
- func_8001FA0C (m, 2026-08-21) — gradient-draw builder: copies
  field_C..field_12 into a RECT, allocates a packet via func_8001E0B8(0, 0x44),
  SetDrawLoad(packet, &rect), then func_8001F774(packet + 0x10, field_0,
  field_0 + 0x20, arg1, field_8); byte-exact clean C, baseline flags
- func_8001F664 (m, 2026-08-21) — StoreImage RECT helper: writes a status
  struct (arg0), then calls func_8001FAB4, DrawSync(0), and two StoreImage
  calls of a 16×1 RECT at arg1 and arg1+0x20 with the UI y/lib offset added;
  membership uncertain(?) — role mismatches the gradient idiom, but it ends
  exactly where func_8001F774 begins (adjacent to two members) and its only
  callee is func_8001FAB4
- func_8001FAB4 (s) — stub returning 0; sole callee of func_8001F664;
  directly follows matched member func_8001FA0C in the link order (low
  confidence)

## sound-sequencer slot wrappers — 0x8001FAE8–0x8001FCDC (confidence: low)

Unassigned gap between the gradient-interpolation cluster (ends 0x8001FABC)
and the volume/pan-fade run (starts 0x8001FCE4), a contiguous run of small
functions whose matched edge links them into the SsSeq sound-control family.

Fingerprints:
- call graph (new 2026-08-21): func_8001FBBC → func_80020414; func_80020A94
  (confirmed sound-init member) is the only other caller of func_80020414, so
  both callers sit in the SsSeq stop/sequencer domain;
- func_8001FBBC, func_8001FBE4, func_8001FBF0, func_8001FCDC are
  consecutive in link order with no gap between them;
- no register quirks or gp-rel cluster found historically; new 2026-08-22: func_8001FBF0's TU
  owns D_8005E31C/D_8005E530 (gp_rel), func_8001FBE4's target reaches D_8005E530 through
  gp_rel too, and FBF0 forwards that value into func_800200E4 (D_8005E544–558 sound-request
  slots) — a setter→dispatch→request data flow inside the cluster. TU membership stays
  unproven (both TUs can emit a common .comm for D_8005E530); the relationship is data, not
  file.
- func_8001FB30 (m, 2026-08-22) calls func_800201C4 and the SsUt reverb
  family from inside this span, linking it to the score-table sequencer TU;
  its D_800492E0 table is an as-yet unowned data candidate for that TU.

Members (address order):
- func_8001FB30 (m, 2026-08-22) — reverb wrapper: calls
  func_800201C4(arg0, 0, arg3, arg3, arg1) then SsUtSetReverbType(
  D_800492E0[arg2*2]), SsUtReverbOn(), SsUtSetReverbDepth(
  D_800492E0[arg2*2+1], ...); sole reference to D_800492E0 reverb table
  (absolute, >8 bytes)
- func_8001FBBC (m, 2026-08-21) — wrapper: calls func_80020414(s16 arg0
  sign-extended, 0) and returns 0; no globals
- func_8001FBE4 (s) — setter for the shared D_8005E530 slot; its target writes
  it through gp_rel (matched bytes), and FBF0 forwards that value into the
  sound-request path
- func_8001FBF0 (m, 2026-08-22) — note/level dispatch, byte-exact clean C:
  clears D_80061F1C; 999→func_80020148(2), 1000→func_80020148(1), 0→
  SsUtAllKeyOff(0)+func_8001FF70()+func_800200E4(&D_80061F28,D_8005E530,0,0)+
  func_80020148(0)+D_8005E31C=0 when the slot is clear; otherwise
  D_80049296[arg0*2]/[arg0*2+1] byte pair → func_80020148/func_80020174(...,2)
  (D_80049296 is an absolute byte-pair table, adjacent to FB30's D_800492E0)
- func_8001FCDC (s) — role unknown

Adjacent confirmed sound-group callee: func_80020414 (m) — stop the
sequence in track slot (arg0, arg1) via SsSeqStop and mark it empty; sits
inside the sound-init/control span but reaches D_8006C088/D_8006BFC8
absolutely, so same-TU membership there is likewise unproven.
New (2026-08-21): func_800201C4 (m, 0x800201C4–0x8002029B) and func_8002029C
(m, 0x8002029C) are consecutive in link order with no gap, share the
D_8006C088/D_8006BFC8 score-table cluster, and use the identical
SsSeqSetVol((s16)(&D_8006BFC8)[arg0], (s16)argX, (s16)argX) idiom (voice-ID
load + explicit s16 casts), strengthening the score-table sequencer TU
hypothesis; both still reach the tables absolutely, so TU membership remains
unproven.

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
- func_8001B118 (m, 2026-08) — sprite flush: guards D_8005E2CC/D_8005E2D0, DrawOTag
  from the D_8005F2E8 base, ClearOTagR; env-toggle idiom shared with
  func_80011370 (conditional pointer increment at a base, then
  D_8005E3A4 = ptr != base) but a separate TU: reads D_8005E3A4/D_8005E3C0/
  D_8005E5E8 absolutely (all defined by func_80011370.c), while D_8005E2CC/
  D_8005E2D0 are defined here GP-relatively like func_8001B074.c

## pad/controller entry processing — 0x8001B2CC–0x8001B4E4 (confidence: medium)

Per-entry processing of the controller/pad state tables indexed by an id:
func_8001B3EC advances an entry pointer, func_8001B4E4 resets it.

Fingerprints:
- shared gp-rel cluster D_8005E4C0 / D_8005E4C4 / D_8005E4C8 / D_8005E4D0
  (s16/u16 count table at 0x8005E4C0, s32 pointer table at 0x8005E4C8) —
  reached gp-relatively by func_8001B2CC, func_8001B3EC, func_8001B4D0,
  func_8001B4E4
- func_8001B2CC (m, 2026-08-22) also reaches D_8005E4D0 and the absolute
  D_80049170 entry table (8-byte stride, u8 at +0, u32 at +4) via
  func_8001B4D0's call: D_8005E4C8[arg0] is compared against
  D_80049170[arg1].field_4 and D_8005E4D0[arg0] against field_0, tying the
  per-id stashes to that table
- internal call graph: func_8001B3EC → func_8001B4E4 (deactivate when
  entry byte is 0xFF), func_8001B3CC → func_8001B4E4 (per-id deactivate),
  func_8001B2CC → func_8001B4D0 (mark slot with entry word)
- both B3EC and B4E4 write struct_8005E870 field_36/field_37 (offsets
  0x36/0x37)
- address adjacency: B2CC–B4E4 is consecutive with no unrelated code between

Members (address order):
- func_8001B2CC (m) — per-id entry show: unless gated off (D_8006C844 &
  0x10000, GetVal8005E3EC()==0), the slot is already marked
  (D_8005E4C4[arg0]) or the entry byte/word match the stash
  (D_8005E4D0[arg0], D_8005E4C8[arg0]), calls func_8001B4D0 then marks the
  slot (D_8005E4C4[arg0]=1, D_8005E4D0[arg0]=field_0). Defines the gp-rel
  cluster (C4/C8/D0) and declares func_8001B4D0's prototype locally like
  func_8001B3CC/B3EC; reads the absolute D_80049170 entry table (8-byte
  rows: u8 field_0, u32 field_4) the family's per-id processing walks
- func_8001B3CC (m) — per-id deactivation pass-through: calls func_8001B4E4
  with its own argument untouched (leaves $a0 alone); smallest function in
  the entry family
- func_8001B3EC (m) — entry processing: reads D_8005E4C8[arg0] pointer, bumps
  D_8005E4C0[arg0] counter, compares counter against (byte at +2) >> 1; on
  overflow advances pointer by 3 and resets counter; calls B4E4 on 0xFF byte;
  sets D_8005E870 flags from byte bits
- func_8001B4D0 (s) — touches T_8005E4C8; likely same entry family
- func_8001B4E4 (m) — deactivation: zeroes D_8005E4C8[arg0] pointer and the
  u16 entries (D_8005E4C0/C4/D0) and D_8005E870 field_36/field_37

## 0x8001B530–0x8001BB88 object-setup cluster (confidence: low–medium)

Direct-call + adjacent-data cluster: func_8001B530 (m) initializes the
0x20-byte u16 objects D_80061E28/.E48/.E68 (memset + 0x1000 writes at 0/8/0x10)
and calls the two already-matched sibling helpers func_8001B9F8 (m) and
func_8001BA40 (m), which write fields of the adjacent D_80061DE8 object
(struct_80061DE8). Padding/stub members between them (func_8001B5DC, B6A0,
BA18, BA5C, BAC4, BB28, BB88) keep the same link-order run.
Members:
- func_8001B530 (m, 2026) — setup entry: GTE origin/screen, then the two
  helpers, then memset+init of the .E28/.E48/.E68 sibling objects
- func_8001B9F8 (m) — writes D_80061DE8 fields 0/4/8/0x18/0x1C
- func_8001BA40 (m) — writes D_80061DE8 fields 0xC/0x10/0x14/0x1C

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
- func_80017D9C (m) — wrapper, calls 80011F5C/80018B98/80011FD8; matched with the sibling's extern `func_80018B98` declaration and identical call shape
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
- func_8002238C (m) — wrapper pairing func_800223D4 with func_800224F0
- func_800223B0 (m) — wrapper pairing func_800223D4 with func_80022528
- func_800223D4 (m) — sprite-source grid callback driver
- func_800224F0 (s) — callback forwarding grid entries to func_80015EE8
- func_80022528 (s) — callback forwarding grid entries to func_80015E3C

## unknown group B — around 0x800225C4–0x80022F1C (confidence: medium)

Game-state/flags readers and CD-script readers over the D_8006C838 struct
array and the D_8005E5A8–E5CC state cluster.

Fingerprints:
- both members walk D_8006C838 through a `char *base = (char *)&D_8006C838`
  pointer variable (byte-verified idiom in both);
- func_80022738's target reaches D_8005E5CC and D_8005E5B4 gp-relatively,
  so the original TU declares both (ASPSX gp-rel rule — see the
  func_80016C08 entry); the same rule now also proves func_80022B20's TU
  declares D_8005E5CC (matched 2026-08-19: `addiu v1, gp, %gp_rel(D_8005E5CC)`
  for the &D_8005E5CC argument, while D_8005E3C0 stays absolute; the matching
  source ships a tentative definition of D_8005E5CC to reproduce it);
- SetVal8005E2BC and SetVal8005E334 are void-returning: func_80022738
  matches only with void prototypes (an implicit-int/s32 declaration adds a
  dead `$v0` call def that blocks the target's `$v0` scratch allocation);
- func_80022964's target reaches D_8005E5A8/B4/BC/C0/CC gp-relatively (TU
  declares all five) and func_800229F4's reaches D_8005E5A8/B0/CC
  gp-relatively — the same cluster the earlier members declare, now spanning
  the whole address range, and func_80022B98's reaches D_8005E5B0/B4/B8/CC/334
  gp-relatively (D_8005E334 is new to the cluster);
- func_80022964 and func_800229F4 both consume func_80022AF0's `$v0` as a
  full word with no 16-bit extension (`jal; addu a0, v0, zero`), pinning the
  caller-side prototype to an s32 return (per-TU declaration effect, byte-
  verified), and both call func_80014CBC with the same 6-word shape
  (`func_80022AF0()`, `D_8005E5A8 << 13`, 0x2000, base+0xD8, words, words);
- func_800225C4 (m, 2026-08-21) is the top-level state-machine dispatcher
  over the same +0xCC state byte: rodata table at D_80010358
  (0x80010358, absolute-addressed, not TU-owned) holds function pointers to
  the group's own members — idx 1 func_80022964, 2 func_800229F4, 3
  func_80022B20, 4 func_80022B98, 5 func_80022D70, 6 func_80022DF8 —
  selected by D_8006C838.field_CC (0 -> return 1, else call table[st]
  with &D_8006C838); reads D_8006C838 through the same
  struct_8006C838_view cast idiom as func_80022B98/22DF8, and the target's
  single loaded byte reused as branch test and table index pins the
  `if (st == 0) return 1; ...; fn = table[st]; return fn(s);` shape
  (byte-exact clean C, baseline flags); link-adjacent, sandwiched between
  GetVal8005E5B8 (0x800225B8) and confirmed member func_8002261C
  (0x8002261C). func_80022D70 is a fourth table-confirmed group member.

Members (address order):
- func_800225C4 (m) — state-machine dispatcher: return 1 when
  D_8006C838.field_CC==0, else call D_80010358[field_CC](&D_8006C838)
- func_8002261C (m) — queue worker over the +0xCC state byte (0 -> 1
  handshake, then a 5/6 re-queue path guarded by C4==-1); writes D_8005E5A8/AC
  and D_8005E5C4/C8; declares D_8005E5A8/AC/B4/C4/C8
- func_800226F0 (m, 2026-08-21) — reset of the same state cluster:
  zeroes D_8005E5C0, calls func_80022DF8, zeroes the D_8006C904 flag, calls
  SetVal8005E2BC/334, then writes D_8005E5B4=-rel 2 and D_8005E5C4=-rel -1
  (target reaches D_8005E5C0/B4/C4 gp-relatively, so the TU declares all three
  — a subset of the cluster func_80022964/22DF8/22738 declare); needs the same
  local void SetVal8005E2BC/334 prototypes as func_80022738 (implicit int adds
  a dead `$v0` call def that blocks `$v0` for the following constant store);
  link-adjacent between func_8002261C and func_80022738
- func_80022738 (m) — flag-slot state check/advance (byte at +0xCC, 4 -> 5)
- func_80022794 (?) — nine-arg query/scratch helper (s16 X/Y/W/H + scale
  progression into *arg6); sole parent in this gap is the new confirmed caller
  func_80022B20; address squarely inside the range — membership unverified, no
  gp-rel declaration observed on its own target
- func_80022B20 (m, 2026-08-19) — 9-arg query into D_8005E5CC via
  func_80022794 (TH, 0x1A/0xA4 bounds, 0x10B/0x3E size, arg7=0xC, arg8=1); on
  ==1 sets the D_8006C904 flag byte to 4; declares D_8005E5CC gp-relatively,
  reads D_8005E3C0 absolutely — the range's upper-boundary member
- func_80022B98 (m, 2026-08-20) — state-dispatch driver: a 0..13 jump-table
  switch on D_8005E5B4 after a func_80017BC8 query (0x1E/0xA8/0x107/0x3A
  bounds on the same D_8005E3C0->field_D8 text-draw path func_800229F4 uses);
  sets the +0xCC state byte and D_8005E5B8, then a guarded func_80022580
  (+0xC: 0x1A/0xA4/0x10B/0x3E) / func_80022EA4 tail. Same-TU evidence
  (byte-verified clean C): reaches D_8005E5B0/B4/B8/CC/334 gp-relatively (its
  TU declared all five — subset of the cluster func_80022964/229F4/22DF8/22738
  declare), walks D_8006C838 via the struct_8006C838_view cast idiom, and
  sits sandwiched in link order between confirmed members func_80022B20 and
  func_80022DF8 (reads D_8005E3C0 absolutely, as they do); gp-rel D_8005E334
  is a new cluster member
- func_80022DF8 (m) — reads the s32 flag word at D_8006C838+0xC (bit 27), OR/ANDs
  it, clears the +0xCC state byte (struct struct_8006C838_view in
  globals_override.h), then (de)queues a script/timer via func_8002261C; declares
  D_8005E5B4/BC/C0/C4/C8
- func_80022F1C (m) — u16 threshold bucketing at a large computed offset
- func_80022AF0 (m) — file-id lookup D_8005597C[D_8005E5AC clamped 0..4],
  s16 return without extension; declares D_8005E5AC
- func_80022964 (m) — CD script read: stages D_8005E5BC/B4/C0, ORs bit 27 into
  D_8006C838+0xC, calls func_80014CBC(func_80022AF0(), D_8005E5A8 << 13,
  0x2000, D_8006C838+0xD8, 0, 1), sets +0xCC byte to 2; declares
  D_8005E5A8/B4/BC/C0/CC
- func_800229F4 (m, 2026-08-19) — CD read into a D_8006C910-based buffer
  via the same func_80014CBC(func_80022AF0(), D_8005E5A8 << 13, 0x2000, &D_8006C910, ...)
  shape but flag words (0, 0); then drives the D_8005E3C0 struct and writes
  the buffer-12 byte (cb = s1==1 ? 4 : 3). Confirms the group: reaches
  D_8005E5A8/B0/CC gp-relatively (tentative defs reproduce it) while
  D_8005E3C0/D_8006C910/D_800A06D8/D_800977F8 stay absolute; byte-exact
  clean C with baseline flags (no per-file override)

The GetVal8005E5B4/GetVal8005E5B8 accessors are natural same-TU candidates
via the gp-rel declarations; membership unverified.

References: notes/retros/2026-08-06-func_80022738-retro.md,
notes/research/func_80022F1C-shift-fusion-and-address-legitimization.md.

## text-input install/fill state — around 0x80023100–0x800231E8 (confidence: low)

Reset / install / fill trio at the head of the D_8005E344..D_8005E360 text-input
state machine, immediately preceding the callback driver family. Evidence
(2026-08, func_800231AC matched):
- func_800231AC (0x800231AC) directly calls func_80023100 (0x80023100, its
  reset sibling) then func_80023A74, and tentatively defines the same gp-rel
  cluster D_8005E360/D_8005E348/D_8005E344 that func_80023A74.c (D_8005E360)
  and func_80023100.c (D_8005E344/D_8005E348) define — same cluster
  grid-cursor's confirmed func_80023DBC/func_80024030 and func_800239F8
  declare (ADR-0001 §2.4 gp-rel access = original TU declared it).
- func_80023100 (0x80023100) inits the state (D_8005E344=0, D_8005E348=1,
  D_8005E350..D_8005E35C cleared); func_80023100/80023130/80023170/800231AC/
  800231E8 are contiguous in link order, and func_800231AC → func_80023A74
  crosses the 0x80023A74 slot inside the menu/text-label span.
- func_80023130 (matched 2026-09) is the fuller twin: same install+fill
  shape as 80023170/800231AC (u16* arg0 → D_8005E360, → func_80023100,
  → func_80023A74) but sets three globals to 1 (D_8005E348, D_8005E35C,
  D_8005E344) and sits immediately after its reset sibling func_80023100 at
  0x80023130. Matching it required the twins' exact source idiom — pointer-
  typed D_8005E360/arg0 and locally declared callee prototypes — confirming
  the same TU idiom and the D_8005E35C member of the cluster.
- func_80023170 is a near-identical twin of func_800231AC: byte-identical
  compiled body differing only in D_8005E348 = 0 (vs 1), sharing the same
  call graph (→ func_80023100, func_80023A74), the same gp-rel trio, and a
  contiguous 0x3C-at-0x3C slot (each body is exactly 0x3C bytes, one right
  after the other) — replicates the phrase-by-duplication source shape.
- func_80023060 (m, 2026-08-22) — install/dispatch gater that immediately
  precedes func_80023100 in link order (0x80023060 is 0xA0 bytes, ending
  exactly at 0x80023100); structural twin of func_800231E8 — same
  func_80015114 font/geometry call (D_800A3FB0/3FB4), same state-gate then
  switch-map (4→clear,-1; 5→clear,+1; else 2 on its own u16 D_8005E338), and
  byte-identical call block; matched under the same -mno-split-addresses
  override (self-clobber D_8005E3C0/D_800A3FBx loads, see
  configs/flag_overrides.mk func_80023060). Ties the D_8005E338 cluster
  (driven by func_80023288/func_80023600) to this family's dispatch-tail
  idiom.
Members (address order):
- func_80023060 (m, 2026-08-22) — D_8005E338-gated dispatch tail: calls
  func_80015114 + func_80023288, then maps D_8005E338 (4→0,-1; 5→0,+1; else 2)
- func_80023100 (m) — state reset: zeroes/clears the D_8005E344..D_8005E35C
  cluster and marks it live (matches the pair below)
- func_80023130 (m, 2026-09) — install+fill twin 2: calls func_80023100,
  stores arg0 (buffer ptr) into D_8005E360, calls func_80023A74, then sets
  D_8005E348=1 / D_8005E35C=1 / D_8005E344=1
- func_80023170 (m, 2026-09) — install+fill twin 0: calls func_80023100,
  stores arg0 (buffer ptr) into D_8005E360, calls func_80023A74, then sets
  D_8005E348=0 / D_8005E344=1
- func_800231AC (m, 2026-08-28) — install+fill twin 1: calls func_80023100,
  stores arg0 (buffer ptr) into D_8005E360, calls func_80023A74, then sets
  D_8005E348=1 / D_8005E344=1 and returns 1
- func_800231E8 (m, 2026-10) — install/dispatch tail: gates on D_8005E344 and,
  when live, calls func_80015114 (font/geometry offsets D_800A3FB0/3FB4) and
  func_800239F8, then maps the resulting state back into D_8005E344
  (3→clear, -1; 4→clear, +1; else 2). Tentatively defines the same u16
  D_8005E344 cluster member as func_80023100.c/func_800239F8.c (gp-rel
  lhu/sw %gp_rel(D_8005E344)); matched under a -mno-split-addresses override
  (absolute D_800A3FBx halfword loads, see configs/flag_overrides.mk func_800231E8)

## callback driver family — 0x80023600–0x80023910 (confidence: medium)

Mode-driven callback family: func_80023600 selects one of six immediately-
adjacent callbacks by D_8005E338 (1 or 2) and the display command word at
GfxObj+8 (0x40 / 0x20 / else), then reports the outcome through the sound
hook func_8001FABC.

Fingerprints:
- internal call graph: func_80023600 takes the addresses of each member and
  dispatches through registers ($a1/$a2/$a3) — every callback is an indirect
  call target of the driver;
- all seven functions are consecutive in link order, with no unrelated code
  between them (0x80023600 ends exactly at func_800236EC;
  func_800237FC ends at func_80023910);
- shared gp-rel cluster D_8005E338/D_8005E340 with the D_8005E340 cursor
  pointer read via %gp_rel across the family and written by func_80023030;
- func_80023288 (m, 2026-08-20) — top-level driver over the same D_8005E338
  state: shares the SetVal8005E334/SetVal8005E2BC/func_8002261C(3, 0x3A9)
  queue-reset trio with func_800239F8/func_80024108, then branches on
  D_8005E338 (==3 -> func_80023910, ==1/==2 -> func_800248B0 with
  D_8005E33A-scaled coordinates) and ends by invoking func_8002348C + the
  family dispatcher func_80023600; tentatively defines gp-rel
  D_8005E338/D_8005E33A.

Members (address order):
- func_80023030 (m, 2026-08-21) — cluster anchor: writes D_8005E340 (= arg) and
  D_8005E338 (= 1), both gp-rel, after func_8002301C
- func_80023288 (m, 2026-08-20) — top-level driver: D_8005E338 state
  branch (==1/==2/==3) into func_800248B0 / func_80023910, then
  func_8002348C + func_80023600; defines gp-rel D_8005E338/D_8005E33A
- func_800233B4 (m, 2026-08-19) — level-guarded consumer of the same
  cluster: draws via D_8005E3C0->field_D8 text calls, branches on
  D_8005E338 >= 2 / >= 3, and draws D_8005E340->unk4 + 1 as a number
  (func_8001AAF4) exactly as func_80023910 reads D_8005E340->unk4;
  byte-exact clean C with baseline flags
- func_80023600 (m) — dispatcher: mode = D_8005E338 (1 or 2), command =
  D_8005E3A8->field +8 (0x40 / 0x20 / else)
- func_800236EC (s) — mode-1 callback for the cmd==0x40 path
- func_8002374C (s) — mode-1 callback for the cmd==0x20 path
- func_80023794 (s) — mode-1 callback for the default path (returns s16,
  stored to D_8005E33A)
- func_80023710 (s) — mode-2 callback for the cmd==0x40 path
- func_80023774 (s) — mode-2 callback for the cmd==0x20 path
- func_800237FC (s) — mode-2 callback for the default path
- func_80023910 (m, 2026-08-20) — family endpoint: gate entry after the
  func_80024108(0x3A7, ...) reset; same D_8005E3A8->field_8 dispatch
  (0x40 / 0x20 / else) into func_8001FABC (arg 0 / 1 / 5) and
  func_80022738, storing D_8005E340->unk4 to D_8005E33A; calls the sound
  hook with no prototype (implicit int), like func_80024030; byte-exact
  with baseline flags; 0xE8 bytes end exactly where func_800239F8 begins

## menu / text-label setup — around 0x800239F8–0x80023C2C (confidence: low)

Label/text region between the callback driver family (ends 0x80023910) and
grid-cursor.c (starts 0x80023DBC).
Fingerprints:
- func_80023A9C (m) fills the absolute u16 table D_800A0708 with a
  period-idiom naive indexed loop (0xFFD x16, entry 15 = 0xFFFF), then
  hands it to the immediately-adjacent stubs func_80023B5C /
  func_80023C2C (consecutive link order, both walk D_800A0708 by 2-byte
  units);
- func_80023A9C drives the same D_8005E3C0->field_D8 text-draw calls as
grid-cursor's confirmed func_80023D08 (func_80022580 on +0x68,
func_80017B3C on +0x64);
- func_800239F8 (m) is the sole caller of func_80023A9C; func_8002348C
also references D_800A0708 (lui v0,%hi / addiu s0,%lo base);
- func_800239F8 (m, 2026-08-20) — menu/text reset entry: zeroes the
  SetVal8005E334 + SetVal8005E2BC state bytes, queues via func_8002261C(3,
  0x3A8), calls func_80023A9C(D_8005E35C), then routes to func_80024030
  when the D_8005E344 gp-rel state is 2, else func_80024448/func_80023D08/
  func_80023DBC — tying func_80023A9C's TU to grid-cursor.c's reset chain;
  tentatively defines gp-rel D_8005E35C/D_8005E344/D_8005E356 (same
  D_8005E344 cluster that func_80024030/func_80023DBC declare).
Members:
- func_800239F8 (m, 2026-08-20) — menu/text reset entry: sole caller of
  func_80023A9C, then func_80024030 or func_80024448/func_80023D08/
  func_80023DBC; defines gp-rel D_8005E35C/D_8005E344/D_8005E356
- func_80023A9C (m) — fills the D_800A0708 label slate via the text-draw helpers
- func_80023A74 (m) — fills the D_8005E360 u16 buffer with 0xFFFF from +0x10
  backward (8 entries); consumes the pointer func_800231AC installs (sole
  caller + shared gp-rel D_8005E360, see text-input install/fill group)
- func_8002348C (m, 2026-08-28) — label-grid layout: same func_80022580 (+0x68) /
  func_80017B3C (+0x64) text-draw pair on D_8005E3C0->field_D8 as the confirmed
  members, builds 4 column-rows (0x2A0000..0x1E0000 bases, 0x400000 steps) into
  D_800A0708 through func_8001AA7C, then prints a 30-entry label set per row via
  func_8001AAF4; reaches D_800A0708 absolutely and defines no globals (no gp-rel
  TU-ownership signal, so membership here is fingerprint-only, not proof).

## "grid-cursor.c" — around 0x80023DBC–0x800243D0 (confidence: medium)

D-pad cursor movement on a 14-column grid (menu/keyboard screen?).
Fingerprints: func_800241EC (m) directly calls func_800243D0 (s) as its
default vertical-move handler (call graph + address adjacency, 0x800243D0
begins just past 0x800241EC's end); shared absolute-addressed parallel
table cluster D_80055994/D_800559BC (bounds byte-table bases) and
D_800559C4 (handler function pointers). func_80023DBC (m) is the sole
caller — its matched body drives the switch over the current input mode
and feeds D_8005E356 (cursor) / D_8005E358 (set) into func_800241EC and
func_800244FC. Handlers stored in D_800559C4 are unidentified — resolving
them would extend the group.
Members: func_80023DBC (m), func_800241EC (m), func_800243D0 (s).
Confirmed member 2026-08-19:
- func_80023D08 (m) — reads D_8005E358 (the same "set" flag
  func_80023DBC's switch feeds into func_800241EC / func_800244FC) and
  forwards it into text calls (func_80017A38, func_80017B3C,
  func_80022580 on D_8005E3C0->field_D8). New evidence to include it in
  the TU: literal link-order adjacency (func_80023D08 starts at 0x80023D08
  and its 0xB4 bytes end exactly where func_80023DBC begins) plus the
  gp-relative D_8005E358 access, for which this TU tentatively declares
  s16 D_8005E358 exactly as the func_80023DBC reconstruction does
  (ADR-0001 §2.4 — gp-rel access proves the original TU declared the
  global). Both consume the D_8005E3C0 draw-buffer descriptor.
- func_80024030 (m) — inside the group's span; gate after the
  func_80024108(0x3A6, ...) reset, then the same D_8005E3A8->field_8
  dispatch (0x40 / 0x20 / else) into func_8001FABC / func_80022738.
  Evidence: tentatively defines the same gp-rel D_8005E344/D_8005E354
  cluster that confirmed member func_80023DBC declares (gp-rel access,
  ADR-0001 §2.4) and shares the func_8001FABC outcome hook.

## sprite frame-index helpers — 0x80024408–0x800245C8 (confidence: medium)

Five consecutive matched helpers feeding the sprite render dispatch group
below. Same-TU evidence: adjacency with the 0x800245F4 wrapper group with no
unrelated code between; func_800244FC and func_800245C8 index
D_800559CC/D_800559D4, the same data run as the D_80055994/D_800559BC/
D_800559C4 grid-cursor tables noted above; func_80024448 calls func_800248B0,
a member of the dispatch group; func_80024448 and func_800244FC share the
same unsigned u16/14 frame-counter division idiom.

Members (address order): func_80024408 (m) — state-based offset select;
func_80024448 (m) — frame counter into func_800248B0;
func_800244FC (m) — frame-remainder dispatch through the D_800559CC pointer
table; func_80024578 (m) — per-state offset scaled by arg1; func_800245C8
(m) — D_800559D4 row lookup.

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
- func_800245F4–func_80024A10 (14 wrappers, 8× m + 6× s) — thin wrappers with
  sprite-header id constants (0x7–0x2B, 0x27 shared by four); all call func_80024A4C;
  func_8002462C (m) matched (id 0x27 — one of the four 0x27 wrappers, pinning
  that constant to a named member), func_80024664 (m) matched (id 0x27 — second
  of the four 0x27 wrappers, level 2), func_8002469C (m) matched (id 0x27 — third
  of the four 0x27 wrappers, level 1, frame 1 passthrough of $a0 with arg3 = $a1 sext,
  arg4 = $a2 sext on stack), func_800246D4 (m) matched (id 0x27 — fourth of the
  four 0x27 wrappers, level 3, completing the four-way level 0/2/1/3 run on the
  shared 0x27 id), func_800248E8 (m) matched (id 0x18),
  func_800248B0 (m) matched (id 0xB),
  func_80024924 (m) matched (id 0x1E), func_80024A10 (m) matched (id 0x2B)
- func_80024A4C (m) — core dispatcher: header-cache check + func_80015EE8 call

### mod-N frame counters interleaved inside the wrapper span

Not every span member is a wrapper: three functions maintain a GP-relative u8
frame-counter run (D_8005E5D0 then D_8005E5D1) via the same 0x88888889
magic-division idiom, with empty delay slots and no pre/post-reload
scheduling (the fingerprint this subgroup now pins with a per-TU
-fno-schedule-insns -fno-schedule-insns2 override). Shared-data + adjacency +
idiom cluster (same-TU evidence). Members:
- func_8002495C (m) — mod-60 frame counter on D_8005E5D1, pure (no call)
- func_8002470C (m) — mod-120 frame counter on D_8005E5D0, pure (no call);
  carries the same per-TU -fno-schedule-insns -fno-schedule-insns2 override
  as func_8002495C (second member confirming the subgroup's flag fact;
  baseline sched1 drifts its shared sentinel/-1 pseudo above the s16
  sign-extension, the override pins the li to its expand-time position)
- func_800249C0 (m) — mod-30 count on the same D_8005E5D1, then dispatches
  via func_80024A4C (bridges the counter into the sprite renderer; same
  gp-rel tentative-definition merge with func_8002495C; matches with DEFAULT
  flags — no -fno-schedule-insns override, unlike the pure counters)
- func_80024810 (m) — mod-30 of D_8005E5D0 (same 0x88888889 magic idiom), then
  dispatches via func_80024A4C with sprite-header id 0xD (bridging role, same
  shape as func_800249C0; gp-rel access to the shared D_8005E5D0 u8 confirms
  the tentative-definition merge with func_8002470C)
- func_80024860 (m) — mod-30 of D_8005E5D0 (same idiom), body byte-identical
  to func_80024810 except the sprite-header id constant 0xC, then dispatches
  via func_80024A4C (same bridging role and D_8005E5D0 gp-rel merge)
- func_80024770 (m) — mod-30 of D_8005E5D0 (same 0x88888889 idiom), body
  byte-identical to func_80024860 except the sprite-header id constant 0x29,
  then dispatches via func_80024A4C (same bridging role and D_8005E5D0 gp-rel
  merge; third member of the mod-30 quartet)
- func_800247C0 (m) — mod-30 of D_8005E5D0 (same idiom, byte-identical to
  func_80024770 except the sprite-header id constant 0x28), then dispatches
  via func_80024A4C (same bridging role and D_8005E5D0 gp-rel merge; fourth
  member of the mod-30 quartet, filling the 0x800247C0 gap between
  func_80024770 and func_80024810)

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
Members: func_80013B04 (m) — pad-state driver; func_80013CD0 (m) — per-pad
processing driver; func_80013F90 (m) — clears a per-port state object;
func_80013FC0 (m) — calls the decoded-input path; func_80014064 (m) —
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

## screen-space pixel/line/rect drawers — 0x80014E90–0x80014FAC (confidence: medium)

Three adjacent screen-space drawers with identical skeletons: each calls
func_80011F5C (packet-buffer getter, boot/main-loop TU) and exactly one
initializer from the GPU-primitive group that follows — a 1:1 pairing that
matches their argument shapes (evidence: call graph + address adjacency +
parallel structure; discovered while matching func_800136D4, their sole
caller).

Members (address order):
- func_80014E90 (m) — pixel/point drawer (x, y, color) via func_8001526C
  (TILE_1)
- func_80014F0C (m) — line drawer (x1, y1, x2, y2, color) via
  func_8001530C (LINE family, code 0x40)
- func_80014FAC (m) — gouraud rect drawer (four corner colors) via
  func_800153BC (POLY_G4)
- func_80015074 (m) — flat-colour quad (POLY_F4) drawer via
  func_800154CC (code 0x28/0x2A); same skeleton, matches the 1:1 pairing
- func_800151B4 (m) — semitransparent flat-colour quad drawer via
  func_80015644 (the POLY_F4 semitransparency wrapper), same skeleton
  (func_80011F5C + one initializer, identical halfword-to-signed
  extraction, same saved-register set), adds an 8th arg7 blend argument

Matched func_80015074 carries the shared fingerprint (func_80011F5C + one
initializer, identical halfword-to-signed extraction, same saved-register
set) that the trio above had, so it joins the drawer group. func_800151B4
now matches the same skeleton via func_80015644 (the demonstrated bridge to
func_800154CC), so it joins the drawer group too; func_80015114 (same
skeleton, TILE via func_80015594) is the remaining unexamined member. The
drawer entry and the GPU-primitive entry below remain separate lines but
func_800154CC and func_80015644 are the demonstrated bridges.

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
- func_80015B24–func_80015D6C (mixed) — entry lookup and dispatchers;
  func_80015BF0–func_80015D6C bridge func_800158E4 to the wrappers below
- func_80015DD4 (m) — thin func_80016C08 (entry-driver) wrapper and the
  driver's sole caller; shares the group's extern-only (absolute,
  non-gp-relative) D_8005E3C0 access and matches under baseline flags,
  corroborating ADR-0001's withdrawal of -mno-split-addresses
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
- func_80011C24 (m) — draw-sync / VSync cadence loop (waits on DrawSync, then per-frame Rand + scene update); toggles the double-buffer scene pointer D_8005E3C0 / D_8005E3B4 between bases at D_8005E5E8/D_8005E5D8 (+0x134, +8) and calls the D_8005E384() scene callback two ways. Reaches D_8005E384/88/8C/90/A0/A4/B4/C0 all GP-relative (must declare them as small data). Sole GP-relative accessor of D_8005E38C and D_8005E390 (owns them outright); shares D_8005E3A0 GP-relatively with func_80011EF0. Called at the bottom of the main loop every iteration (0x80011C14).
- func_80011DB0 (s), func_80011F5C (s), func_80011FD8 (s) — share D_8005E3C0
  and D_8005E3B4
- func_80011EF0 (m) — tiny 8-byte stub: saves the previous D_8005E39C into
  D_8005E394, clears D_8005E3A0, then stores its argument into D_8005E39C.
  Reaches D_8005E394/D_8005E39C/D_8005E3A0 GP-relatively, so it shares the
  cluster with func_80011C24 / the boot TU rather than touching the cluster
  absolutely from outside. Byte-verified 2026-08-21
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
- func_800121D4 (m), func_800128DC (s) — share D_8005E3C0. func_800121D4
  byte-matched 2026-08-12 using the exact field read set
  (D8/DC/E0/E4 + EC/F0/F4/F8 + 120/118/124) and ClearOTagR tail of the
  byte-exact func_800120C8 — shared-idiom fingerprint confirming the
  render-context family. func_800128DC is called from the main loop and
  from several switch cases

Render-context sub-family (evidence: the pool constants, 2026-08-11).
func_80012598 and func_8001231C are the only two functions in the binary that
reference all of 0x801BE1B0 / 0x801BE440 / 0x801C2440 — the graphics heap, the
big ordering table and the VRAM staging area — so they are the two carve
routines. The already-matched relatives that consume what they build are
func_800120C8 (GsSetWorkBase over field_12C, ClearOTagR), func_800128DC (memcpy
over field_130), func_8001205C, and func_80011370 (whose SetDefDrawEnv /
SetDefDispEnv calls fix the DRAWENV/DISPENV part of the field map). Still stubs
and sharing D_8005E3B0: func_8001202C, func_80012098. func_800121D4 is
now matched (shares the D_8005E3C0 *active-context* side of the family,
reading field_D8/DC/E0/E4 + EC/F0/F4/F8 + 120/118/124 exactly as
func_800120C8 does).
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

## game-state init and query — around 0x80012D30–0x80013438 (confidence: medium)

Game-state initialization and mode-dispatch query. Fingerprints:
func_800132B8 (m) defines `D_8005E294`, `D_8005E298`, `D_8005E2A0`,
`D_8005E3CC`, `D_8005E3CE`, `D_8005E3D0` as tentative definitions (GP-relative);
func_80013394 (m) defines the subset `D_8005E294`, `D_8005E3CC`, `D_8005E3CE`
and reads them GP-relatively. func_80012D30 (m) defines the same cluster
(those six plus `D_8005E28C`, `D_8005E29C`, `D_8005E3C8`), calls func_80013394,
SetVal8005E29C, SetVal8005E27C and GetFlag8005E274 directly, and sits at
0x80012D30 immediately below the group. SetVal8005E29C (at 0x80013438)
defines `D_8005E29C`, which func_80012D30 also defines, so it is the same TU.
func_8001328C (m) defines the same six-global cluster GP-relative and sits only
0x2C below func_800132B8, so it is the same TU.
func_80013400 (m, 2026-08) defines D_8005E294 and sits immediately below
func_80013394 at 0x80013394, so it is the same TU. It also settled two
boundary facts for the group: (1) the splat split at 0x80013430 was spurious —
"func_80013430" is the switch's shared return-0 epilogue (`jr ra; nop`), the
tail of a single 0x38-byte function, merged into func_80013400 in
configs/splat/exe.yaml + configs/symbols/exe.txt (src/func_80013430.c
deleted); this is the binary's only `j` onto another function start, and
gcc 2.95.2-psx has no sibling-call support, which is why the bytes cannot
come from two functions. (2) func_80013400's access is a plain switch that
GCC did not fold into its `xori/sltu/sll` trick — the fold needs a bare
`return 0` fall-through; a `return` inside each `case` keeps three separate
return blocks.
Shared gp-rel cluster is the same evidence class as the boot/main-loop TU;
five functions now agree on it. Note func_80012D30 reads D_8005E3A4/D_8005E3B4/
D_8005E3C0 *absolutely* (the boot/main-loop TU's cluster), confirming it is
not a member there.
func_8001316C (m, 2026-08) starts at exactly 0x8001316C, the end of
func_80012D30 (0x80012D30 + 0x43C), and composes the same full-screen
POLY_F4 + DR_MODE packet pair against the sibling buffer pair
D_8005E930/D_8005E960 (func_80012D30 uses D_8005E8E0/D_8005E910), indexed
by the same D_8005E3A4 and linked through D_8005E3C0 read absolutely. Same
SDK idiom cluster plus exact adjacency; no shared gp-rel cluster of its own. func_80011370 calls func_800132B8, so this is a different
TU. func_80013328 (m, 2026-08) defines the same shared six-global GP-relative
cluster (plus D_8005E28C, matching func_80012D30's set), uses the same
constant-through-reused-`t` idiom as func_8001328C, and calls SetVal8005E278 /
SetVal8005E27C directly, so it is a member of the game-state init cluster;
func_800132F0 remains a stub. GetFlag8005E274 and func_80012A68 are matched
leaf helpers in the same address span but with no cluster evidence, membership
unverified.

Members (address order):
- func_80012D30 (m) — render-context transition helper: game-state mode/counter
  driver that composes a per-frame full-screen POLY_F4 + DR_MODE packet pair
- func_8001316C (m) — full-screen POLY_F4 + DR_MODE packet pair into the
  D_8005E930/D_8005E960 buffer pair, quad 0x140×0xF0 filled from three packed
  u32 color args (>>12 each); immediate successor of func_80012D30
- func_800132B8 (m) — game-state initializer (sets mode, counters, sizes)
- func_8001328C (m) — game-state initializer, constant-argument twin of func_800132B8 (mode=1, counter limit 0x3C, resets counters)
- func_800132F0 (s)(?) — stub; intermediate
- func_80013328 (m, 2026-08) — game-state initializer: mode 3, clamps target
  D_8005E3CE to 0x1F (arg0+1 capped via local `t`), resets counters, sets
  D_8005E28C/D_8005E298, resets display via SetVal8005E278/SetVal8005E27C,
  D_8005E2A0=2, D_8005E3D0=0; matches func_8001328C's setter shape
- func_80013394 (m) — mode-dispatch getter (reads D_8005E294, returns predicate on D_8005E3CC/D_8005E3CE)
- func_80013400 (m, 2026-08-21) — mode-dispatch query: `switch (D_8005E294)` → 1 / 2 / 0; tail return-0 block was mis-split as "func_80013430", now merged
- SetVal8005E29C (m) — setter for D_8005E29C (shared with func_80012D30)

## Full-screen primitive setup — 0x800134C4–0x800139F8 (confidence: medium)

Display-transition and screen-drawing helpers. func_800134C4 calls the
adjacent func_80013668, then initializes a full-screen POLY_F4 and DR_MODE
packet pair for the active ordering table. Evidence is the direct internal
call plus address adjacency; no shared GP-relative cluster has been
established. func_800136D4 (matched 2026-08-15) touches no globals at all,
so no gp-rel evidence is possible for it — membership rests on adjacency
and shared screen-drawing domain only.

Members:
- func_800134C4 (m) — builds and links the full-screen POLY_F4/DR_MODE pair;
  see `notes/retros/2026-08-13-func_800134C4-retro.md`
- func_80013668 (m) — resets display/draw environments to 640×480
- func_800136D4 (m) (?) — draws a beveled UI panel (beige/wood palette:
  0xF8DBAF light edges, 0xBA8B47 shadow, 0xFDECD2 highlight, gouraud
  0xF4DFBD/0xF9CF8F fill) as 6 pixels + 8 lines + 1 rect through the
  0x80014E90 drawer trio, of which it is the sole caller; its own only
  caller is the stub func_80022580

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
func_80020E58 (m) — transfer setup/dispatcher; byte-exact clean C: calls
SsVabOpenHead (PSY-Q 2-arg prototype) and memcpy, materializes
C028/C068/BFA8 base pointers (same idiom as func_80020818), owns the rodata
jump table at 0xA24; func_800214FC (m) —
selects a D_80049370 span and starts a CD load operation; func_800215EC (m) —
writes the first three transfer-state words; func_80021604 (m) — initializes
transfer progress from adjacent D_80049370 entries; func_80021668 (m) —
advances the partial VAB transfer; func_800218C4 (m) — searches for STR/*.XA
CD audio files via CdSearchFile (4 filename pointers in D_80049A70, CdlFILE
buffer at D_8006C7D8); called from func_8001FE7C which is called by
func_80011370 (main loop); address adjacency (0x18C4 is 0x194 past previous
boundary); func_800218C4 uses all absolute addressing (no shared gp-rel
cluster with core members — likely a different TU or the boundary member).

References: src/func_800218C4.c, src/func_80020E58.c.

## SPU voice allocation and playback — around 0x800212A8–0x80021820 (confidence: medium)

Per-voice allocation, playback (SsUtKeyOnV) and release (SsUtKeyOffV) over the
24-voice group/LRU tables. Functionally distinct from the VAB-transfer group but
interleaved with it in link order (the VAB members sit between func_80021484 and
func_800217B0); the two share no globals, and the interleaving is the open
TU-boundary question (one combined sound TU vs two adjacent TUs).

Fingerprints:
- shared absolute 24-voice table pair D_8006C0C8 (per-voice group, 0–3) +
  D_8006C128 (per-voice LRU, 0x01000000 min-scan sentinel); written by
  212A8/21484, read by 21820, initialized by func_8001FF98 (sound reset);
- dedicated call graph: func_800212A8 → func_800217B0 (primary allocator) +
  func_80021820 (fallback 4-pass allocator); neither allocator has any other
  matched caller;
- producer/consumer on D_80049A10 (per-voice key-status): func_800212A8 writes
  it after playing, func_800217B0 reads it to score a voice's state delta.

Members (address order):
- func_800212A8 (m, 2026-08) — voice play: allocates a voice, sets its group
  from the D_800495CC per-sound table and LRU to the first VSync's return,
  plays SsUtKeyOnV with per-sound params (Rand() overrides for soundId 0x46/0x47),
  records the key status, returns the voice
- func_80021484 (m) — voice release: when a voice's key status is 0/3, clears its
  group/LRU and calls SsUtKeyOffV
- func_800217B0 (m) — primary allocator: scans [lo,hi) for a voice whose D_80049A10
  state changed by >= 2
- func_80021820 (m) — fallback 4-pass allocator: min-LRU voice per group 0–3

Adjacent func_800218BC is an empty function (no globals, no signal). func_8001FF98
(m) initializes the shared tables but is a broader sound reset in the sound-init
range, not a member here.

func_8001FABC (m) is the sole caller of func_800212A8 (call graph), passing
(soundId, 0, 0x17) and discarding the voice. It links in the unassigned gap
after the gradient-interpolation cluster (0x8001FABC), far from this range —
sound-playback role by call graph, non-adjacent by link order; TU membership
unproven.

## CD-music state flag family — 0x8002194C–0x80021CD8 (confidence: low)

Shared gp-rel `s16 D_8005E324` ("noise/music playing" flag): written by
func_80021B20 (=0, after SsSetSerialVol/SdStandby mute) and func_80021CD8
(=1, before Cd position control); read by func_8002194C as its entry gate.
All TUs tentatively define D_8005E324 and the D_8005E580/E584/E58C/E590
music-state cluster GP-relatively (func_80021B90 defines the full
D_8005E324..D_8005E59C span) and are address-contiguous in link order
(func_8002194C runs 0x8002194C–0x80021B20, immediately followed by
func_80021B20; then func_80021B64, func_80021B90, func_80021CD8 in-range). func_80021B20
is also a CD-loader callee (of func_80014CBC), so TU membership is
unconfirmed — the tentative defs merge via -fcommon regardless. Members:
- func_8002194C (m, 2026-08-21) — CD-music state-machine poll: gate on
  D_8005E324; picks a per-track step (D_8005E590 0..5) driving
  CdSync/CdPosToInt/CdControlF and SsSetSerialVol, decrementing D_8005E580;
  calls func_80021B20 (mute path) and func_80021CD8 (seek path)
- func_80021B20 (m) — mute/standby: if D_8005E324 != 0, silences serial
  output and CD, then clears the flag
- func_80021B64 (m, 2026-08-21) — state query: 0 / 2 / 1 by
  D_8005E324 value; called only from ovl_11 (800CE834, 800E58DC,
  800E6AB0, 800FFF7C, 8011F608)
- func_80021CD8 (m) — sets D_8005E324 = 1, seeks CD position via
  CdIntToPos/CdControl for a track from D_80049A80
- func_80021B90 (m, this session) — CD-audio track play: mutes serial and
  CdFlush, then seeks via CdControlB to the D_80049A80[arg0] entry, filling
  the D_8005E324..D_8005E59C CD state via D_8006C7D8/CdPosToInt

## sound volume/pan fade state — D_80061F08 cluster, 0x8001FCE4–0x8001FE6C (confidence: medium)

Contiguous no-gap run of six matched functions all touching the same
absolute-addressed 32-bit volume/fade state: D_80061F08 (flag at field_04,
position accumulator field_08, computed result field_0C, targets field_10/
field_14), plus the adjacent getters D_80061F0C and D_80061F1C. Shared
fixed-point domain (clamp/saturation constant 0x7F0000, division-based fade
timing). func_8001FE7C at 0x8001FE7C — immediately above and already a
sound-init member — calls the stereo setter func_80020A40, linking this run
to the sound-init group below; the run's func_8001FD10 also calls VAB-transfer
members func_80020E38/func_80020E58.

Members (address order):
- func_8001FCE4 (m) — initializes D_80061F08's six words: 0/0/0x7F0000/0/0x7F0000/1
- func_8001FD10 (m) — drive: if func_80020E38() != -1 calls func_80020E58, else
  sets field_14=1; when field_04 != 0 calls func_8001FD84
- func_8001FD74 (m) — returns D_80061F1C != 0 (Boolean getter)
- func_8001FD84 (m) — adds field_0C into field_08, clamps field_08 to [0,
  0x7F0000], clears field_04 at both saturations
- func_8001FE00 (m) — divides field_10 by arg0 into field_0C, sets field_04=1
- func_8001FE34 (m) — negates field_08, divides by arg0 into field_0C, sets
  field_04=2; matched 2026-08-21
- func_8001FE6C (m) — returns D_80061F0C (getter)

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
- func_8001FE7C (m) — sound/seq pre-init driver: calls func_80020A40 (stereo
  setter) then func_800218C4 (STR/*.XA search); address-adjacent to func_8001FEA4
  (ends at 0x8001FEA0, immediately before it) and calls a cluster member
- func_8001FEA4 (m) — sound reset: clears D_8005E538/D_8005E53C/D_8005E558,
  sets D_8005E55C=1, initializes SpuCommonAttr D_8006C368, calls SsInit /
  SsSetTableSize / SsSetTickMode / SsUtReverbOff / SpuSetCommonAttr
- func_800200E4 (m, 2026-08) — sound request: if D_8005E558 nonzero calls
  func_80020A94 (stop), stores the two request args plus 0x1010 into
  D_8005E548/D_8005E54C/D_8005E544, bumps D_8005E558, resets via func_8001FF98
- func_80020818 (m) — sound init: opens sequences, calls SsStart, sets
  D_8005E53C, configures stereo/mono from D_8005E55C
- func_80020790 / func_800207E4 (m)(s) — libsnd volume wrappers: call
  SsUtSetVVol (E4 with all three args; 90 with zeroed right/left); SDK idiom
  matches the group's libsnd fingerprint and both sit inside the group's
  address range (confidence: low — adjacency + shared SDK idiom)
- func_80020A14 (m) — mono setter: calls SsSetMono, clears D_8005E55C
  (matched 2026: mirror image of func_80020A40, shares the D_8005E55C GP-relative
  definition with this cluster; confirmed membership)
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
- func_80014BCC (m) — CD read retry driver: owns the cluster D_8005E3F0,
  D_8005E428, D_8005E430; loop guard `if (arg3 != -1)` wrapping the
  do-while CdControl(0xE,…) / VSync / CdRead / CdReadSync retry is the
  func_80014988 idiom
- func_80014CBC (m) — CD sector reader with retry: owns D_8005E3F0, D_8005E410,
  D_8005E428, D_8005E430, D_8005E2B4 (gp-rel, tentative defs merged via -fcommon
  with the func_80014854/80014988 cluster); reads D_80048B1C (stride 0x28, loc at
  0x24); calls func_80021B20 (arg0 only — callee ignores args, untouched a1/a2/a3
  remain incoming args), CdReadSync/CdRead/…; recursion on sync==-1; returns a
  u_char* into the caller's buffer (or NULL). Called by func_8001A018,
  func_80022964, func_800229F4 (far from the CD address range ⇒ TU membership
  unconfirmed; shares the gp-rel cluster ⇒ CD-family member by fingerprint).
  Matched 2026-08-14 at 117/117 under user-authorized hybrid asm (allowlisted
  embedded-asm): BLKmode struct stack parameters (arg4/arg5) remove the
  entry-block parameter loads, the arg1 home store rides an alias-opaque
  asm carrier, and dummy asm operands pin the remaining scheduler releases
  and allocno reference counts. Mechanism history:
  notes/research/func_80014CBC-allocno-priority-web-partition.md; closing
  retro: notes/retros/2026-08-14-func_80014CBC-retro.md; recipe for the
  class: notes/research/param-residence-playbook.md; deferred family
  experiment: notes/research/cd-family-module-merge-plan.md.

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
- ovl_11 D_8012D520 getter/compare trio — ovl_11_func_80118C6C (m, matched
  this session), ovl_11_func_801165C8 (m, now matched) and
  ovl_11_func_80115FC8 (m, matched this session) are the three ovl_11 readers
  of s32 D_8012D520 (all `lui %hi` + `lw %lo`); ovl_11_func_801165C8 is the
  boolean test `D_8012D520 != 0x1A` (xori 0x1A + sltu-vs-zero) and
  ovl_11_func_80115FC8 the same-shape test `D_8012D520 != 0x14`.
  D_8012D520 sits in the contiguous data block D_8012D51A/51C/520/524 that
  no other code references. Shared-global fingerprint only; data TU ownership
  unconfirmed.
- ovl_11 D_8012D520/D_8012D52C block bridge — 0x8011D084/0x8011D098/
  0x8011D0B4 setter/sum-copy/copy run over the orphan block's top two rows,
  in strict zero-gap link order (0x8011D084, 0x14 → 0x8011D098, 0x1C →
  0x8011D0B4, each starting exactly where the previous ends).
  ovl_11_func_8011D084 (m, matched this session) is the setter `D_8012D524 =
  arg0; D_8012D528 = arg1;` (leaf, two absolute `lui`+`sw %lo`), writing
  both rows from args; ovl_11_func_8011D098 (m, matched this session) is the
  3-arg sum-setter `D_8012D524 = arg0 + arg2; D_8012D528 = arg1 + arg2;`
  (two `addu` folds then the same two absolute `lui`+`sw %lo` stores, second
  in the `jr $ra` delay slot); ovl_11_func_8011D0B4 (m, matched this
  session) is the copy `D_8012D524 = D_8012D528` (absolute `lui`+`lw/%lo`
  from D_8012D528 into `sw %lo` D_8012D524). Together the first matched
  references to D_8012D524/D_8012D528, extending the previously-orphan
  D_8012D51A–524 block one row to 0x8012D528 and abutting the D_8012D52C
  busy-flag family's heavily-touched global one word above — a
  shared-global-cluster bridge between the D_8012D520 getter pair and the
  D_8012D52C reset-stub family, with the setter feeding what the adjacent
  copy consumes. Shared-global fingerprint only; data TU ownership
  unconfirmed.

## s16-pair state family — 0x800183B8 / 0x800183D0 (confidence: low)

func_800183B8 and ClearVal8005E49C are exactly address-adjacent
(func_800183B8's last word is 0x800183CC, ClearVal8005E49C begins at
0x800183D0, zero gap) and share the same contiguous 4-halfword gp-rel
cluster D_8005E498/D_8005E49A/D_8005E49C/D_8005E49E: func_800183B8 writes
all four (arg0->E498, arg1->E49A, clears E49C/E49E), ClearVal8005E49C is a
leaf that only performs the same clear pair (E49C=0; E49E=0). Shared idiom
and data ownership; both TUs tentatively define E49C/E49E. Members:
- func_800183B8 (m) — sets halfword pair from args and clears the following
  halfword pair; matched clean-C 2026-08-21 (4 tentative gp-rel defs)
- ClearVal8005E49C (m) — clears the same E49C/E49E pair (standalone src TU)

## table-slot CD-loader cluster — 0x80017BC8 / 0x800183E0 / 0x80019FC4–0x8001A11C / 0x8001AD6C (confidence: medium)

Slot-based table loading: a 16-bit "slot" selects a 0x1800-byte region read
from CD into D_8006C910 via func_80014CBC; per-slot state lives in a small
gp-rel cluster. Fingerprints:
- shared GP-relative cluster D_8005E440 (pending slot, u32), D_8005E45C
  (load-done flag), D_8005E460 (current slot, s16), D_8005E46C (buffer
  pointer), plus D_8005E468 (second slot marker, touched only by
  func_80019FC4) — every member reaches it GP-relatively, so the defining
  TU is among them (tentative definitions can still span TUs via -fcommon;
  TU membership unconfirmed).
- func_80019FC4 is address-adjacent: it ends at 0x8001A018 where
  func_8001A018 begins.
- func_800183E0 also reaches the u16 family's D_8005E444/D_8005E4A8
  GP-relatively, linking this cluster to the 0x8001A574 family's TU.
- func_8001A11C (in the heading's address range) is NOT a slot-loader
  member: it holds a private gp-rel cluster and shares E444/E4A8 with the
  u16-table family — see the u16 family section.
- internal call graph: func_8001AD6C → func_8001A018(slot, 1) →
  func_80019FC4(slot); func_800183E0 and func_8001ACBC also call
  func_8001A018.

Members (address order):
- func_80017BC8 (m) — thin 6-arg wrapper forwarding directly to func_800183E0
  (s16 stack args 4/5 sign-extended onto the outgoing frame); nearest
  address predecessor of func_800183E0 and its only direct caller — strong
  same-TU evidence
- func_800183E0 (s) — u16-table consumer over the loaded buffer
  (0xFFFF-sentinel scan); reaches D_8005E4B0, D_8005E4A8, D_8005E444,
  D_8005E45C, D_8005E46C GP-relatively; calls func_8001A018
- func_80019FC4 (s) — per-slot consumer: when D_8005E468 == slot and
  D_8005E46C is set, calls func_8001719C/func_80022008, re-stamps
  D_8005E468, clears D_8005E45C
- func_8001A018 (m) — CD slot loader: loads the slot's 0x1800-byte region
  into D_8006C910 via func_80014CBC; owns the D_8005E440/E45C/E460/E46C
  state; retry loop gated by arg1; sets D_8005E460 on success
- func_8001AD6C (m, 2026-08-21) — dispatcher: after a GetPairedTpage/func_80017C30
  guard, calls func_8001A018(slot, 1), then func_80019FC4(slot) if
  D_8005E460 == slot; matched clean C confirms the D_8005E460 gp-rel tentative
  definition (returns 1 when it consumed the slot, 0 otherwise)
- func_8001ADD8 (m) — plumb-through wrapper: 4 args straight into
  func_80019E80 with the a1 tpage reversed via GetPairedTpage(arg1);
  gap-free successor of func_8001AD6C (0x8001AD6C..0x8001AE34 is one
  contiguous run through func_8001AE34) and shares the GetPairedTpage
  reach with it, but touches none of the cluster's GP state — same-TU
  membership unconfirmed

## text-draw wrapper — func_8001AC10 0x8001AC10 (confidence: low)

Thin text-label wrapper in the zero-gap run immediately before the
CD-loader run (func_8001AC10 → func_8001ACA0 → func_8001ACBC → func_8001AD00
→ func_8001AD6C → func_8001ADD8, no gaps), but NOT a CD-loader member: it
reaches none of the D_8005E440/E45C/E460/E46C GP state and calls none of
GetPairedTpage / func_8001A018 / func_80019FC4 / func_80019E80. It is a
text-drawer built on the D_8005E450 save/restore idiom —
`func_80017A64(); func_80017A48(3); func_80022580(buf,0,0x1A,0xA4,0x10B,0x3E);
func_80017B3C(arg1,arg2,0x1E,0xA8); func_80017A48(saved);` — the identical
shape as func_80022B98 (unknown group B) and func_80017F88; all three are
callers (never definers) of the D_8005E450 getter/setter pair. Same-TU
membership unproven; boundary recorded so a later session does not absorb
it into either adjacent family on adjacency alone.

## u16 table-insertion / D_800749F4 dispatch family — 0x8001A574–0x8001AAF4 (confidence: medium)

Consumable/spellbook-style u16 table insertion and its dispatcher. Fingerprints:
- shared absolute-addressed cluster: D_80049078 (3-entry fn-pointer dispatch
  table, called by func_8001A574) and its adjacent D_80049084 (u16 string at
  +0x0C, used by func_8001A808), D_800749F4 (0xB8-stride object array
  scanned by the callees), D_8005F0F8 (u16 0xFFFF sentinel — the *split*
  address form `lui r,%hi` / `op %lo(r)`, implying a >-G8 declared size in the
  original TU; both func_8001A574 and func_8001A668 targets split it),
  D_8005E444/D_8005E4A8 (u16 table length/base, GP-relative in func_8001A574's
  TU, signalled via tentative definitions; also reached GP-relatively by
  func_800183E0 — see the table-slot CD-loader cluster).
- internal call graph: func_8001A574 → func_8001A668/8001A6FC/8001A790
  (dispatch, one s32 argument, return s32) → func_8001A808; both callees scan
  the same 0xB8-stride D_800749F4 array and return
  `(ptr - &D_8005F0F8) >> 1`.
- func_8001A668 and func_8001A6FC are near-identical except the scan's branch
  sense (bnez vs beqz) — classic source-level twin.

Members (address order):
- func_8001A11C (m, outside range at 0x8001A11C) — u16-table init: reads
  D_8005E444 length, fills a buffer via func_800191B4(0xFFB); on success
  advances D_8005E4A8 past a 0xFFFE sentinel, clears E4AC/E4A2, sets
  D_8005E4A0=3, E4B4=1, clears E4B8, calls func_80019600. Owns gp-rel
  cluster D_8005E4A0/E4A2/E4AC/E4B4/E4B8 (shared with func_8001A19C, see
  below); shares D_8005E444/D_8005E4A8 with func_80019030.
- func_8001A19C (m, outside range, zero-gap at 0x8001A19C — func_8001A11C's
  0x80 run ends exactly here) — u16-table drain: loops 3 (message, slot)
  pairs, calling func_800191B4, then func_8001945C; on hit sets
  D_8005E4A0/E4AC/E4A2/E4B4/E4B8/E4A4 (=3/0/0/1/0/0), advances D_8005E4A8
  past the 0xFFFE tag, stores the table's parallel slot word to D_8005E446
  and the drain count to D_8005E444. Tuple evidence: zero-gap adjacency
  with func_8001A11C + same func_800191B4/func_8001945C drain idiom + the
  shared GP cluster (defines D_8005E444/D_8005E4A8/D_8005E4A0/…/D_8005E446
  tentatively). Absolute-addressed tables D_80049068/D_80049070 live in the
  override header (incomplete arrays keep the split two-register form).
- func_8001A574 (s) — dispatcher/insert: arg0/3 → q,r; dispatch
  `D_80049078[r](q)`; scans the gap in
  `p_table = D_8005E4A8 + D_8005E444`; memmove/memcpy shift; sentinel
  D_8005F0F8 = 0xFFFF before/after
- func_8001A668 (s) — scan member (bnez); calls func_8001A808
- func_8001A6FC (s) — scan member (beqz); calls func_8001A808
- func_8001A790 (m) — third dispatch callee
- func_8001A808 (m) — per-entry helper called by 668/6FC; flag-gated
  strcat chain appended into D_80049084
- func_8001A870 (m), func_8001A8D0 (m), func_8001A970 (m), func_8001AA7C (m),
  func_8001AAB8 (m, 2026-08-21), func_8001AAF4 (m) — later members; A8D0/A970
  are clean scalar helpers (charset / number-to-string); func_8001AAF4 is the
  display driver: formats into the shared D_8005F0A8 digit buffer via
  func_8001A970, skips leading 0xFFD markers (same do-while idiom as
  func_8001A870), then draws via func_80017B3C.
- func_8001AA7C (m, 2026-08-21), func_8001AAB8 (m, 2026-08-21) — u16 copy
  twins, address-adjacent (0x8001AA7C ends exactly where 0x8001AAB8 begins)
  and byte-structural mirrors: same signed countdown do-while copy loop, same
  sll/addu/sll base-scale, differ only in stride/count (D_8004908C stride 0xC,
  6 elements vs D_800490BC stride 6, 3 elements). Both read absolutely
  addressed u16 tables immediately after the family's D_80049078/D_80049084
  cluster in the same data slide; func_8001AA7C is called by func_8002348C,
  the same caller that drives func_8001AAF4.

References:
- notes/research/func_8001A808-D80049084-address-split.md
  (declared >-G8 so the address splits; addiu half lands in the second jal's
  delay slot)
- notes/research/func_8001205C-declaration-shape-vs-address-form.md
  (-G8 size decides split vs macro form for D_8005F0F8)
- notes/retros/2026-08-10-func_8001A574-retro.md
  (indirect-call arity, declaration birth, sequential temp reuse, and final scheduler tie)

## func_8001A284 — member of the 0x8001A574 family TU (MATCHED 2026-08-15)

Dispatch-style switch on `arg0 & 0xFFF` (cases 10-34) returning a pointer or
value. TU evidence: calls func_8001A574 and func_8001A870 (same family's
callees), reaches the 0xB8-stride D_800749F8 array (family fingerprint) and
D_8005F0F8 (sentinel, split address form), and touches the
`&D_8006C838 + 0x8000` region at offsets 0x676C/0x19CA/0x19CE/0x6620/0x26DA
and `&D_8006C838 + 0x81F0` / `+ 0x7AB8` (0xB8/0xB4-stride scans). Owns
D_8005E490 GP-relatively (tentative definition in this file). Matched
byte-identically; the earlier parked analysis of case 15's exit structure
(goto into case 10, D_80071A00 <= -G8 override) was WRONG and its override
has been removed. What the bytes actually are:

- Case 15's inner dispatch is a NESTED SWITCH on the 0x676C halfword
  (cases 0/1/2, default result=0), not an if-chain. The balanced
  compare order in the target (==1 first, then <2, ==0, ==2) is GCC's
  small-switch dispatch fingerprint.
- Case 10 and the nested case 0 both return `&D_8006C838 + 0x51C8`
  (there is no D_80071A00 reference at all). Case 10 spells it inline;
  jump2's cross-jump equivalence rewrite (find_cross_jump's REG_EQUAL
  path) folds both copies to the same la-const, merges the arm into
  case 10's copy, and leaves case 10's expander HIGH orphaned — that is
  the "stray lui v0,0x8007" at 0x8001A2C0. See
  notes/research/func_8001A284-crossjump-equiv-orphan.md.
- Cases 22/23 share a named `neg1 = -1` sentinel local; case 22 sets it
  before the load (so it conflicts with the base in v0 and allocates
  v1), case 23 after (so it fills the load-delay slot).
- Case 33 carries a zero-instruction scheduling barrier (tracked debt,
  allowlisted): the target births the `addiu a1,gp,%gp_rel(D_8005E490)`
  argument before the base formation and every clean hoist spelling is
  CSE-folded back to the call site.
- The TU's .rodata is the 25-entry jump table plus a 4-byte zero pad at
  0x940; splat.yaml carries a `[0x940, rodata]` sub-split for the pad.
  Both lines (and the whole game-rodata block) are now derived by
  `tools/build/deriveRodataSplits.ts` (attribution iff the owner is
  compiled C; extent = the owner's .o .rodata size, which produces pad
  residues mechanically). The original hand edit by the autoloop —
  attributing 0x8DC while the function was still a stub — is exactly the
  inconsistent state the tool's check mode rejects.

## u16-text wrapper run — func_80019564 / func_800195F4 / func_80019600 (confidence: low)

Byte-adjacent trio headed by func_80019564, each ending exactly where the
next begins (0x80019564 → 0x800195F4 → 0x80019600, zero padding) and each
called solely by func_800183E0 (table-slot CD-loader cluster's consumer) —
an adjacency the call graph and link order agree on. func_80019564 is a
near-twin of func_80017B3C (both
`func_80011FD8(func_80018B98(arg0, func_80011F5C(0), arg1, x, y, 0x1000, <0|1>, 0,0,0,0))`),
but 0x80017B3C lives earlier (0x80017B3C), so the twin is a copied-wrapper
signal, not TU membership. The trio sits in the same no-gap run as the
D_8005F0C8 table-scan family, but does not reach D_8005F0C8 itself.

Members (address order):
- func_80019564 (m) — text wrapper: func_80011FD8(func_80018B98(arg0,
  func_80011F5C(0), arg1, (s16)arg2, (s16)arg3, 0x1000, 1, 0, 0, 0))
- func_800195F4 (m) — tiny matched callee of func_800183E0
- func_80019600 (m) — tiny matched callee of func_800183E0

## D_8005F0C8 table-scan family — func_8001929C / func_8001945C / func_800198E0 (confidence: medium)

Three self-recursive u16-table scanners that read the same 4096-pointer table
D_8005F0C8 (`[halfword & 0xFFF]`, absolute-addressed). Same-shape signature
`s32 (u16 *buf, u16 hay/needle, s16 limit)` (func_8001929C adds a 4th
`u16 *out` that receives the terminating count) and the same idiom cluster:
plain `u16 *` walking pointer, an `(entry & 0xF000) == 0x4000` / `& 0x4000`
command-bit check, a `u16` parameter whose entry zero-extension is the
assign_parms conversion, and a recursive count-armed scan. All three are
byte-exact. func_80017A08 (byte-exact 2026-08-21) is the table's WRITER:
`D_8005F0C8[(u16)(arg0 & 0xFFFF) clamped to 10] = arg1` (4-byte pointer
store, absolute-addressed like the readers) — it updates the low-numbered
entries (0..10) that the scanners walk through `[halfword & 0xFFF]`, so the
table's defining TU is among the trio-plus-writer, not the trio alone
(tentative/extern declaration split unconfirmed). func_8001945C and
func_8001929C also call
func_8001A284 (0x8001A574 family TU) and are both called by func_800183E0
(the table-slot CD-loader cluster, which calls func_8001929C twice) —
cross-group edges only, not membership.

func_800191B4 is the run's immediate address predecessor: it ends at
exactly 0x8001929C where func_8001929C begins (zero gap) and it calls
func_8001945C directly — a call-graph + zero-gap edge placing it in the
same no-gap run as the scanners. It never reaches D_8005F0C8 and never
calls func_8001A284, and its shape is different (u16* occurrence-search
that returns a table pointer, gated by a func_8001945C cumulative-index
limit), so it stays out of the "defining TU among the trio" claim rather
than weakening it.

Members (address order):
- func_80017A08 (m) — table writer/setter: stores a pointer into
  D_8005F0C8[sliced index clamped to 10]. Same `var_a0 = arg0; if (>= N)
  var_a0 = K; store` clamp idiom as the matched neighbor func_80017A48
  (both unreferenced library setters), and ends at exactly 0x80017A38 where
  func_80017A38 (the D_8005E2BA cursor-offset setter) begins — same
  contiguous no-gap run as the 0x80017A38/0x80017A48 setter block, while
  the D_8005F0C8 write puts it in the same-global cluster with the scanners
  below
- func_800191B4 (m) — occurrence-search at the run's head; calls
  func_8001945C, reaches no shared table (see run note above)
- func_8001929C (m) — count/terminator scan with out-count; recursive when
  `func_8001A284(*buf)` is nonzero, else on D_8005F0C8[*buf & 0xFFF]; calls
  func_8001A284 exactly like func_8001945C
- func_800193F0 (m) — run member; calls func_800191B4 then func_8001945C on
  the same buffer, returns the occurrence result (+2 when nonzero) and
  subtracts a masked scan count from D_8005E444; zero-gap on both sides
  (ends exactly where func_8001945C begins), so it sits in the same run as
  the scanners but reaches no shared table (see run note above)
- func_8001945C (m) — count/terminator scan; per-entry `func_8001A284(*buf)`
  with a D_8005F0C8 fallback, recursive on a nonzero result
- func_800198E0 (m) — same signature; additive scan without the 0xFFFF
  terminator; recurses directly on D_8005F0C8[...]

## func_800199F8 — width-measuring text wrapper (confidence: low)

Byte-exact (2026-08-17). A u16-text wrapper in the same shape as
func_80019564 (`func_80011FD8(func_80018B98(arg0, func_80011F5C(0), arg2,
temp, a4, a6, 0,0,0,0))`), but the x argument is computed as
`(s16)((arg3+arg5) - func_800198E0(arg2, arg6, arg7))` — it measures the
text's width via func_800198E0 before rendering. Touches no globals (no
gp-rel access, no tentative definitions), so no TU-ownership fingerprint.

Fingerprints:
- internal call graph + zero-gap address adjacency with func_800198E0:
  func_800198E0 ends at exactly 0x800199F8 and func_800199F8 begins there;
  func_800199F8 ends at exactly 0x80019AD0. Same contiguous no-gap run
  as the D_8005F0C8 family and the u16-text wrapper trio.
- sole width source is func_800198E0 (D_8005F0C8 family member).

Member: func_800199F8 (m).
Member: func_80019AD0 (m) — caller of func_800199F8; ends the same contiguous no-gap run.
  func_80019AD0 is byte-identical to func_80019610 (each a 0xA0-frame 9-arg text-width/
  sentinel-scan body; the only difference is the callee: func_800199F8 vs func_800197FC),
  and siblings func_800199F8/func_800197FC are the twin width-measuring wrappers — so the
  two caller stubs (func_80019AD0, func_80019610) and their two callees form one
  self-contained module group. func_80019610 begins exactly where func_800197FC ends.
Member: func_800197FC (m) — same width-measuring shape, but x is
  `(s16)(arg3 + ((arg5 - func_800198E0(...)) / 2))`; ends at exactly
  0x800198E0 where func_800198E0 begins (zero gap), and is itself
  called by func_80019610 (still a stub at 0x80019610, which ends
  exactly where func_800197FC begins). Same internal-callgraph +
  zero-gap adjacency fingerprints as func_800199F8.

Negative/twin note: identical wrapper shape to func_80019564 and
func_80017B3C, both of which live elsewhere — the copied-wrapper signal
says don't use shape for TU membership, only call graph + adjacency.

## D_8005E2BA cursor-offset family — func_80017A38 / func_80019030 / func_80019CBC (confidence: low)

Three functions whose TUs all tentatively define the same u16 `D_8005E2BA`
(reached GP-relatively in every matched member), a menu cursor/offset value:
`func_80017A38` is the setter, the other two are consumers. A file only gets
GP-relative access when it owns a tentative definition, so each member's TU
defines the symbol (tentative definitions can still span TUs via -fcommon;
TU membership unconfirmed — a common options/menu screen is plausible given
the cursor/index semantics, but nothing proves the TUs are one file).
Fingerprint: identical `u16 D_8005E2BA;` tentative definition in each member's
compiled TU, and `lh … %gp_rel(D_8005E2BA)` in the consumers.

Members (address order):
- func_80017A38 (m) — setter: writes `D_8005E2B8 = arg0; D_8005E2BA = arg1;`
  (cursor/scroller position pair)
- func_80019030 (m) — cursor-position consumer; reads D_8005E2BA and the
  D_8005E444/D_8005E4A8/D_8005E47A family to return an adjusted s16 position
- func_80019CBC (m) — menu line/row adjuster: increments/decrements `*arg2`
  clamped by `arg3`, and when unchanged calls func_80019E14 with a position
  derived from `(s16)D_8005E2BA + 0xC`; also reads the D_8005E3A8/D_8005E3C0
  graphics-display-object pointers (absolute addressing — not TU-owned)

## u16 text renderer core — func_80018B98 (and func_80019070) (confidence: medium)

The u16 command-stream renderer that the matched wrappers func_80019564 /
func_80017B3C / func_800199F8 / func_800197FC all call
(`func_80018B98(arg0, func_80011F5C(0), text, x, y, 0x1000, 0|1, 0,0,0)`), and
the sprite/TPAGE packets it builds are the SPRT model of the adjacent matched
func_80019070. func_80018B98 is conspicuously the only member of the text
module that does full token processing, but every family above is in its
reach: it tentatively defines D_8005E2B8/D_8005E2BA (the cursor-offset pair
that func_80017A38 sets and func_80019030/node-80019CBC consume), it walks
the D_8005E444/D_8005E446 event counter/flag pair (func_80017AE8 /
func_80017ACC / func_800195F4 / func_80019600 semantics), and it calls the
matched glyph lookup func_8001A284 and blit func_80019070.

Fingerprints:
- zero-gap run: func_80018B98 ends exactly where func_80019030 begins, and
  its own bloated tail borders func_80019070 (its direct callee at
  0x80018FAC).
- same-globals reach across the matched text family (D_8005E44C/E444/E446/
  E478/E47A/E47C/E47E/E480/E498 + D_8005E2B8/E2BA).
- signature corroborated by the byte-exact wrappers; frame map (10 args, arg8
  4-byte BLKmode struct) matches every caller.

Member: func_80018B98 (in progress — 257/292 clean C; residual is pure greg
  register assignment). Same residual class as func_80019070: block-0
  prologue allocation plus a hard-register rotation that two exhaustive
  source-space searches and 60+ measured experiments place outside the
  reachable clean-C domain. func_80019070's governed resolution was a
  narrowly allowlisted embedded-asm/register-asm hybrid
  (notes/research/func_80019070-prologue-allocation-and-arg2-truncation.md);
  func_80018B98 is expected to need the same exception category.

## fade/option-dim state machine — 0x8001328C–0x80013400 (confidence: medium)

Shared gp-rel cluster D_8005E294 / D_8005E298 / D_8005E2A0 / D_8005E3CC /
D_8005E3CE / D_8005E3D0, plus a peripheral D_8005E3C8 in the same short
run. func_80012D30 is the mode driver: D_8005E294 selects mode 1/2/3
(rising / waiting / falling), D_8005E3CC is the animation counter that
paces toward the target D_8005E3CE, D_8005E298 is a tick/step flag,
D_8005E2A0 a delta and D_8005E3D0 a boolean that gates a fast path
(`0xFF000 / D_8005E3CE`). All members *define* the six globals as
tentative definitions (GP-relative), the strongest same-TU signal; the
(short,short) pair D_8005E3CC/D_8005E3CE is adjacent in memory.

Members (address order):
- func_80012AB0 (s)(?) — adjacent; membership unproven, no cluster touches
- func_80012D30 (s) — mode driver; long switch over D_8005E294, paces
  D_8005E3CC toward D_8005E3CE, uses D_8005E298, D_8005E3D0, D_8005E2A0;
  also D_8005E3C8 before the pair
- func_8001316C (m) — full-screen POLY_F4/DR_MODE pair into D_8005E930/D_8005E960;
  same-TU evidence as func_80012D30 (exact successor, same idiom) — see the
  game-state init and query group above
- func_8001328C (s) — init: D_8005E294=1, D_8005E3CE=0x3C, D_8005E3CC=0,
  D_8005E298=0, D_8005E2A0=2, D_8005E3D0=0
- func_800132B8 (s) — init: D_8005E294=1, D_8005E3CE=(s16)arg0,
  D_8005E3CC=(s16)arg0-1, D_8005E298=0, D_8005E2A0=arg2,
  D_8005E3D0=(s16)arg1
- func_800132F0 (m, 2026-08-21) — init: D_8005E294=2, D_8005E3CC=0,
  D_8005E3CE=(s16)arg0+1, D_8005E298=0, D_8005E2A0=arg2,
  D_8005E3D0=(s16)arg1
- func_80013394 (s) — state query: booleans from D_8005E294/D_8005E3CC
  vs D_8005E3CE+offsets
- func_80013400 (s) — switch over D_8005E294

## `exe` sprite-load wrapper cluster — 0x800171CC–0x80017284 (confidence: low)

Three thin, skeletal-twin wrappers over the 1324-byte worker `func_80017300`,
followed by a fourth function that also reaches into the same wider data-loading
family. Confidence low: three of the four are still stubs, so same-TU
membership is unproven.

Fingerprints:
- internal call graph: `func_800171CC`, `func_80017200`, `func_80017240` all
  call `func_80017300` only; the worker calls nothing in the cluster.
- address adjacency: the three wrappers are contiguous with no gap
  (0x800171CC → 0x80017200 → 0x80017240), and the worker starts immediately
  after `func_80017284`.
- shared skeleton: the wrappers are identical thin frames differing only in the
  constant/tag and pass-through args they present to the worker
  (tag 1 / tag 0 / tag 2), the classic "parameterized worker + public facades"
  same-file shape.

Members (address order):
- func_8001719C (m) — small value helper (no callees, many external callers);
  not clearly part of this cluster
- func_800171CC (s) — wrapper: func_80017300(tag=1, zeros, 0)
- func_80017200 (m) — wrapper: func_80017300(tag=0, four s16 args pass-through) (matched 2026-08-21)
- func_80017240 (s) — wrapper: func_80017300(tag=2, four s16 args pass-through, same frame shape as func_80017200)
- func_80017284 (s) — distinct shape: func_80015AAC → func_80015B24 →
  func_8001782C with D_8005EA28 global; sibling, not a twin
- func_80017300 (m) — worker: RLE loader for 0xD-tagged compressed sprite/palette
  streams (writes via DrawSync/rect machinery)

## `ovl_08` menu/kanji state dispatcher — 0x800B8014–0x800B8400 (confidence: medium)

A small overlay that runs a state-machine menu/system initializer. The four
handlers share one dispatch table and one counter in the same overlay:
`D_800B7E24` (rodata, 3 function pointers) and `D_800B8500` (data segment
head, reads/written by all handlers). The matched dispatcher calls
`D_800B7E24[D_800B8500](&D_800B7E24)`.

Fingerprints:
- shared cluster globals: `D_800B8500` counter (incremented by func_800B8054
  and func_800B80FC, selected by the dispatcher), `D_800B8504`/`D_800B8508`
  (state arrays, used by func_800B8134) — all first words of the ovl_08 data
  segment.
- dispatch-table role: `D_800B7E24` (ovl_08 rodata, 3 handler pointers
  func_800B8054/800B80FC/800B8134) is consumed only by the dispatcher
  ovl_08_func_800B8014.
- kanji/menu init idiom: func_800B8054 opens the Kanji font
  (KanjiFntClose/KanjiFntOpen) and func_800B8134 renders via KanjiFntPrint,
  consistent with one menu subsystem file.

Members:
- ovl_08_func_800B8014 (m) — dispatcher: calls the table handler for state
  D_800B8500, passing the table address (matched 2026-08-22)
- ovl_08_func_800B8054 (s) — kanji-font init; increments D_800B8500
- ovl_08_func_800B80FC (s) — conditional state advance; increments D_800B8500
- ovl_08_func_800B8134 (m) — menu/kanji page renderer; walks the D_800B8508 {glyph, kanji-code} table (6-entry page at D_800B8504/6*6) via strength-reduced pointer, prints via KanjiFntPrint, handles pad rows 13–16 by OR-ing D_8006C838.unk10 and calling func_80011EF0 (matched 2026-08-22)
- ovl_08_func_800B8400 (m) — button/input-driven “PANDO=%d” menu counter: ticks D_800B8608 (8=+1 wrap 0 at 0xB, 2=-1 wrap 0xA), dispatches func_8001B2CC/8001B3CC on field_8 flags 0x40/0x80, prints via FntPrint

