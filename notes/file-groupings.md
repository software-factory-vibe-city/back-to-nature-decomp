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
| `ovl_11` | `Obj\GF_FARM.bin` | farm-object clear/update run 0x80121318–0x80121500 (medium); `D_80123754` setter/getter run 0x800D12A0–0x800D2160 (medium); text/sprite table-builder run 0x80116F4C–0x80117178 (medium); `D_80127428` shared-state cluster 0x801037DC–0x801040A8 (medium); `D_8012D52C` reset-stub family 0x80114184 / 0x8011A9CC–0x8011B6C0 (medium); by-value struct-slice run 0x8011D934 / 0x8011D98C / 0x8011D9B4 (StructD548 selector @0x5C, data @0x28/0x46) (medium) — freshly-matched gapless link head `ovl_11_func_8011D934` (0x8011D934+0x58 = 0x8011D98C; then +0x28 = 0x8011D9B4, +0x28 = 0x8011D9DC) takes the same by-value `StructD548` record (first 16 bytes ride $a0-$a3, remainder in the outgoing stack area) and counts the non-zero u32 words among its first `x.index` words, @0x5C selector — a third matched member of the same original-file family; pointer-getter run 0x800E48CC–0x800E5078 (medium); `D_80128D78`/`D_80128D7A` s16-pair global cluster 0x800D31EC–0x800D55F8 (low); member `ovl_11_func_800D3424` (matched, 0x44, this session) is the first matched reader of the shared u16-pair lookup table `D_80123AAC` (`D_80123AAC[arg0][arg1]` as a {u16,u16} cell, absolute `lui`+`addiu` base) and returns 0; its byte-exact twin `ovl_11_func_800DF3BC` (matched this session, 0x44, 16/16 same shape) reads the sibling {u16,u16} table `D_80123E70` in the same `0x80123xxx` data region with the same `[][4]`/`%lo` branchless 0x10/4-indexing idiom and returns 0, so both lookup leaves likely share the original source file; a third member `ovl_11_func_800E0F8C` (matched this session, 0x44, 16/16 same shape, also returns 0) reads the sibling {u16,u16} table `D_80123F58` in the same `0x80123xxx` region with the same `[][4]`/`%lo` branchless 0x10/4-indexing idiom — the family now spans three tables (`D_80123AAC`/`D_80123E70`/`D_80123F58`), widening the original-source-file hypothesis; a fourth member `ovl_11_func_800E2AAC` (matched this session, 0x44, 16/16 same shape, returns 0) reads the sibling {u16,u16} table `D_80124008` in the adjoining `0x801240xx` region with the same `[][4]`/`%lo` 0x10/4-indexing idiom, so the family now spans four tables (`D_80123AAC`/`D_80123E70`/`D_80123F58`/`D_80124008`); a fifth member `ovl_11_func_80109550` (matched this session, 0x44, byte-identical instruction stream, returns 0) reads the same {u16,u16} `[][4]`/`%lo` 0x10/4-indexed table `D_80127918` — placed in the `0x801279xx` data region (near the recorded `D_80127428` cluster) rather than the contiguous `0x80123xxx` quadruple, so same-source-file membership with the quadruple is weakened to (low) but the accessor-idiom family now spans five tables across two data regions; a sixth member `ovl_11_func_8010B898` (matched this session, 0x44, byte-identical instruction stream, returns 0) reads sibling {u16,u16} table `D_80127B38` in the same `0x80127xxx` region (just below `D_80127918`) with the same `[][4]`/`%lo` 0x10/4-indexing idiom, so the `0x80127xxx` sub-region now holds two accessor-idiom tables with (low) same-source-file likelihood; a seventh member `ovl_11_func_8010D20C` (matched this session, 0x44, byte-identical first run, returns 0) reads sibling {u16,u16} table `D_80127BA4` (just above `D_80127B38`) in the same `0x80127xxx` region with the same `[][4]`/`%lo` 0x10/4-indexing idiom, so the sub-region now holds three accessor-idiom tables (low) same-source-file likelihood; fresh member `ovl_11_func_80110E34` (matched this session, 0x64, byte-exact) is a field-fill accessor over a NEW table `D_80127EE0` just above `D_80127EC0` in the same `0x80127xxx` data body — 16-byte {s32,s32,s32,u16} entries indexed by `u16@0xAC` with the same absolute `lui`+`addiu %lo` base and sll-4 stride, filling the {u16@0x22, s32@0x38/0x3C/0x40} object fields and setting `u16@0x30=0x28` via a reused-s32-temp web (not a returning leaf like the {u16,u16} pair readers, so same-TU membership with them stays plausible but unproven, low); fresh member `ovl_11_func_80110CE8` (matched, 0xB8, byte-exact first draft) is the matching field-fill accessor over sibling table `D_80127E60` (0x60 below `D_80127EC0`, same 16-byte entries) — fills {s32@0/4/8} of its arg0 from `D_80127E60[(s16)(arg1/5)][0/1/2]` with the third word plus `(arg1%5)*600`, with special cases arg1==20→idx 4 and arg1==21→idx 5 (idx is s16, same div-by-5 magic indexing idiom, same absolute `lui`+`addiu %lo` base); it is the gapless link predecessor of `ovl_11_func_80110DA0` (0x80110CE8+0xB8=0x80110DA0), extending the run head to 0x80110CE8, so same-TU membership of the accessor pair is (medium); member `ovl_11_func_80110DA0` (matched, 0x88, byte-exact first draft) is the first matched reader of `D_80127EC0` itself — the 16-byte-entry table 0x20 below `D_80127EE0`, indexed `(s16)(arg1/5)` with the same absolute `lui`+`addiu %lo` base and sll-16/sra-12 stride, filling {s32@0/4/8} of its arg0 from the entry's first three words (word 0 plus `(arg1%5)*0x190`), a field-fill accessor like `ovl_11_func_80110E34`; it is the gapless link predecessor of `ovl_11_func_80110E28` (0x80110DA0+0x88=0x80110E28) and `ovl_11_func_80110E34` (+0xC=0x80110E34), so the three `0x80127Exx`-table accessors plus the 0xC clear leaf form one gapless link run over the same data body, and same-TU membership of the trio is (medium); member `ovl_11_func_800D3424`'s direct caller `ovl_11_func_800D2E6C` (0x800D2E6C, just below the run, still a stub) feeds it two `lhu` sprite values and writes both halfword results to a local pair; `D_8012DB10`/`D_8012DB14` s32-pair run 0x8011F0C4–0x8011F1D0 (medium); `D_801285xx` farm-state reset cluster (medium) — leaf `ovl_11_func_8011F52C` (matched this session, 0x48, byte-exact) initializes the contiguous `0x80128540–0x8012855A+` region (s16 `D_80128540`, s32-triple `D_80128544` @0/4/8, s16-triple `D_80128550` @0/2/4 with its @4 overlapping separate symbol `D_80128554`, s16 `D_80128556`, s16 `D_8012855A`); its gapless link successors `ovl_11_func_8011F574` (0x8011F52C+0x48, calls the leaf then rewrites `D_80128540`/`D_8012855A`) and `ovl_11_func_8011F5BC` (starts exactly at 0x8011F574+0x48, reads `D_80128540`, calls 0x8011F608) form an unbroken reset run 0x8011F52C→0x8011F574→0x8011F5BC→0x8011F608; caller `ovl_11_func_8011F958` reads `D_8012855A`, and `ovl_11_func_8011F9EC`/`ovl_11_func_8011FB80` write/read `D_80128550`/`D_80128554`/`D_8012855C` — so the state cluster has a tight link-local read/write family, same-TU membership plausible but unproven; short-fold helper trio 0x800CE514–0x800CE53C (medium); 3-halfword vector setter/clear/copy family 0x800D72E8–0x800D740C (medium); `(u32)(arg0-C)<3U||arg0==E` s16 range-check predicate trio 0x800D7504 / 0x800D753C / 0x800D756C (all matched; 0x800D7504 adds a second equality; link-contiguous zero-gap run differ only in constants, same family as the short-fold helper trio) (low); `(1<<arg0)&0xFFFF` mask helper 0x80101B84, called by link-adjacent 0x80100FFC/0x80101B28 (low); `D_80071A00` byte-compare helper pool 0x800F19C8, poolmates 0x800CBDFC/0x8011D06C (low); `D_800719FE` s16-global cluster 0x800FDEDC/0x800FDFD8/0x80112160 (low); `D_8012D0xx` tiny-global cluster/state-probe run 0x80108104–0x8010AE64 (low); `D_80129194`–`D_801291A0` mirror-pair run 0x800DD8AC–0x800DDB64 (medium); `D_80129620` range-check predicate 0x800F5868, called by link-adjacent 0x800F5888 which reads `D_80129620`/`D_80129628` (medium); predicate helper 0x800FB3E4 (returns 0/1 for arg0 0 or 9), called by link-adjacent 0x800FB218/0x800FB290 which also call 0x800FB45C (medium); `D_80127208` set-once flag trio 0x800FB5FC/0x800FB608/0x800FB628 (medium); 7-halfword farm reset helper 0x800BFF50 (leaf; zeroes six halfwords, sets 0xC to 0x8000; sole caller link-adjacent 0x800BFEA4 iterates `D_80128820`[] stepping +0xE) (low); `D_8006C858` item-table accessor run 0x800D5750–0x800D6090 (medium) — head leaf `ovl_11_func_800D5750` (matched this session, first try EXACT, 0x54) classifies the flags halfword `u0.field_00` of `D_8006C858[arg0]` (0x4000→0, 0x8100→1, else 2) with the same s16-sign-extend *40-strided `ItemData` accessor idiom as sibling members 800D5868/800D589C/800D583C of the run; tail member `ovl_11_func_800D603C` (matched this session, 0x54, byte-exact; 0x800D603C+0x54 = 0x800D6090, exactly closing the recorded run) reads the same *40-strided table through the `D_8006C838`+0x20 pointer (same `D8006C838Lookup`-style view as matched run member `ovl_11_func_800D5C3C`), returning entry s16@+0x12 plus a +0xA bonus when `idx==0x97` and the `D_8006C838`+0x44F8 flag bit 0x400000 is set, with shared-`lui %hi` + per-use `addiu %lo` two-register address formation (`ovl_11_func_800D5C3C` keeps one full base register instead) (medium); fresh member `ovl_11_func_800D5CE4` (0x800D5CE4, matched 2026 — this session, 0x54, byte-exact first try; sits inside the recorded 0x800D5750–0x800D6090 window, link-predecessor-adjacent to matched siblings 800D5C3C/800D5C90) reads the same *40-strided table through the same `D8006C838Lookup` view of `D_8006C838` (`lw`@+0x20 then `lw`@+0x2C) — same s16-sign-extend accessor idiom, identical 16-shape window to its two neighbours — but returns entry u16@+0xE and, unlike the -1-returning siblings, returns 0 when the @+0x3 type byte is -1, so it shares the recorded run's original source file with them (medium); fresh member `ovl_11_func_800D5D9C` (0x800D5D9C, matched this session, 0x64, byte-exact; one gapless link run with its mask-bit twins 0x800D5D38/0x800D5E00 — same `D8006C838Lookup` view, same *0x28 stride and `field_28` `t*8` table, differing only in the u16@+6 probe mask 0x8000/0x2000/0x4000) — its twin 0x800D5E00 (same 2-u16 accessor, probe mask 0x4000) is now matched this session (byte-exact first try, 0x64) as an exact instruction-stream clone, confirming the twin family's same-TU membership is the two-u16-arg member of the same run: masked `andi`/`andi` args indexed as a typed 2D accessor `rows[a].arr[b]` over `field_20` (per-row s16 sub-array @+4), then probes bit 0x2000 of u16@+6 in the `field_28` 8-byte-record table via the `(x&0x2000)>u32z` `andi`+`sltu` spelling — joins the recorded run's same-TU hypothesis with the s16 accessor siblings (medium); fresh member `ovl_11_func_800D5F44` (0x800D5F44, matched this session, 0x64, byte-exact first try; inside the recorded 0x800D5750–0x800D6090 window, 0x44 after its twin 0x800D5E00 which ends exactly at 0x800D5F44) is the 0x800-mask member of the same two-u16 `rows[a].arr[b]` / `field_28` `t*8` twin family (masks now 0x800/0x8000/0x2000/0x4000 across 0x800D5F44/0x800D5D38/0x800D5D9C/0x800D5E00), an exact instruction-stream clone of the 0x800D5E00 member differing only in the u16@+6 probe mask — the twin family now spans four members (medium); fresh member `ovl_11_func_800D5E64` (0x800D5E64, matched this session, 0x70, byte-exact) is a fifth member of the same two-u16 `rows[a].arr[b]` / `field_28` `t*8` twin family — the gapless link successor of its 0x4000-mask twin 0x800D5E00 (0x800D5E00... 0x800D5E00+0x64 = 0x800D5E64) and gapless link predecessor of the 0x800-mask member 0x800D5F44 (0x800D5E64+0x70 = 0x800D5ED4, still a stub, then +0x70 = 0x800D5F44) — but a structural variant rather than a mask-only clone: same `D8006C838Lookup` view and *0x28 stride, probe mask 0xE000 = 0x8000|0x4000|0x2000 (the OR of the recorded family's three masks, i.e. the aggregate "any upper-flag" probe), and instead of the `andi`+`sltu` bool returns the `field_28` 8-byte-record u16@+0 when any flag is set, else -1 on the `bne`-inverted -1 test (fall-through returns -1) then -1 again when the aggregate mask is clear — the family's value-returning member, so the twin run 0x800D5D38→0x800D5E00→0x800D5E64→0x800D5F44 is now matched at every slot and the recorded 0x800D5750–0x800D6090 window's same-TU vote gains a fifth twin-family member (medium); fresh member `ovl_11_func_800D57A4` (0x800D57A4, matched this session, 0x6C, byte-exact first try; inside the recorded 0x800D5750–0x800D6090 window, between run members 0x800D5750 and 0x800D5810) classifies the s32 status word `D_8006C858[arg0].field_18` (bit 0x10000000→0, 0x20000000→1, 0x40000000→2, else 3) with the same s16-sign-extend *40-strided `ItemData` accessor idiom as the rest of the run, so it shares the run's original source file with them (medium); fresh member `ovl_11_func_800D5FA8` (0x800D5FA8, matched this session, 0x6C, byte-exact) — a pure switch-leaf writing the {s16,s16,s16} record (unk0=0x86 for 0x122/0x123/0x124 else masked arg; unk4=0), the exact gapless fill between the twin family's 0x800D5F44 (0x64, ends exactly at 0x800D5FA8) and the run's s16@+0x10 getter 0x800D6014 (starts exactly at 0x800D6014), so the window's matched members now sit at every 0x1C+ stride (medium) `D_80076220` 0x1D4-stride struct-array reset cluster — leaf 0x800C1BE0 zeroes u16@+0xA over 37 entries (matched 2026-11); 0x800C1C90 (matched 2026-11) walks all 37 entries by pointer increment clearing bit 0x10 of u16@+0x1E (only other direct writer); link-adjacent 0x800C1C08 clears 36 entries via callee 0x800C1C5C call +0xE0 call to 0x80107DD0, 0x800C1D68 shares the base; 0x800E549C (matched 2026-12) walks all 37 entries by the same pointer-increment countdown clearing bits 0x1800 of u16@+0x1E (0x2C leaf, byte-exact clone of the 0x800C1C90 idiom, different mask) (medium); `D_80129648` 0x22-stride cell-flag clear — leaves 0x800F69D0 (matched 2026, clears flag@+0x1E + u16@+0x20 of each of 0x47+1 cells) and 0x800F69FC (zeroes byte@+0x1E of each of 0x47+1 cells) are link-adjacent (0x800F69D0 ends exactly at 0x800F69FC) and are the two matched readers of `D_80129648`; 0x800F69FC called by 0x800F67E0/0x800FFF7C (low); struct-reset leaf run 0x80106DC0–0x80106EAF — leaf 0x80106DC0 zeroes an 0x18-byte struct and sets f2 to 4, called by link-adjacent 0x80106DE8/0x80106E38 (medium); `D_8012CF48` 10-entry 0x18-stride table accessor cluster 0x80106DE8–0x80107390 (low) — 0x80106DE8 clears all 10 entries via 0x80106DC0, 0x80106E38 finds the first free entry (u16@0) and inits (u16@0=1, u16@2, s32@0x14), 0x80106F20 and 0x8010726C share the base (0x8010726C dispatches per-entry on u16@0 and decrements u16@4, calling 0x80107044, and ends exactly where 0x8010734C begins), freshly-matched leaf `ovl_11_func_8010734C` (matched this session, 0x44) scans the 10 entries for the one whose pointer @0x14 has s16 field_A == arg0 and returns that entry's u16@0, else 0 — a `for`-loop rotated to a bottom-tested while with a counter/pointer pair, same shape as the recorded 0x8011760C leaf; same shared absolute-address base build (`lui`+`addiu` %lo) across the family; fresh member `ovl_11_func_80118C28` (matched this session, 0x44, byte-identical loop shape with 0x8010734C) is the first matched reader of the shared {s16,s16} pair table `D_80128298` (in the `0x801282xx` data region), same counter/pointer lookup-leaf idiom returning the paired value else 0; fresh member `ovl_11_func_8011DEBC` (matched this session, 0x48, byte-exact) reads the new halfword tables `D_801282E4`/`D_801282F0` in the same `0x801282xx` data sub-region with the same absolute `lui`+`addiu %lo` table-base idiom — a branchless two-table selector leaf (`arg1` selects E4 vs F0 as `u16` arrays indexed by `s16 arg0`), address-apart (0x8011DEBC) so same-TU membership unproven, but widens the `0x801282xx` accessor-family corpus to two matched leaves (low); `D_80126FE0/E4/E8/EC` menu-state reset cluster 0x800FAAAC–0x800FAC0C — leaf 0x800FAAAC (matched) resets the four-word cluster to 0,0,0,0xFF (init data 0,0,0,0xFF), direct caller 0x800FAAD4 guards on `D_80126FE0`, state machine 0x800FAC0C reads all four (medium); bit16@+0x34 flag-check leaf 0x800DF4F0 (0x2C; guards u16@0, returns (u32@+0x34 & 0x10000) < 1), called by 13 probes spanning its own run 0x800DE9C8–0x800DFB98 (matched 2026-11) (low); bit16@+0x34 flag-check leaf 0x800E109C (0x2C; guards u16@0, returns (u32@+0x34 & 0x10000) > 0 — inverted-polarity twin of the 0x800DF4F0 leaf, same instruction shape), called by 10 probes spanning its own run 0x800E05A8–0x800E15C8 (matched 2026-11) (low); bit13@+0x34 flag-write leaf pair ovl_11_func_80109068 / ovl_11_func_8010B49C — byte-identical 0x3C code (guards u16@0, tests bit 0x8000 of the s32@+0x34 flag word and ORs 0x800000 in when set, then returns 0; the writer form of the 0x800DF4F0/0x800E109C read-probe family on the same {u16@0, s32@0x34} object struct; both matched this session, baseline flags; the 0x8010B49C twin sits +0x2434 from 0x80109068 but still address-apart from the 0x800DEx read-probes, so same-TU membership unproven) (low); bit17@+0x34 flag-write leaf ovl_11_func_800CF2C8 (matched, 0x40; another writer-form member of the same {u16@0, s32@0x34} flag family — guards u16@0 against previously-unreferenced s16 global `D_80071A8A` (data region `D_80071Axx`, the `D_80071A00`/`D_800719FE` pool cluster) and AND-clears bit 0x20000 of the s32@+0x34 flag word when they differ; first matched reader of `D_80071A8A`; address-apart (0x800CF2C8) from all recorded family members, so same-TU membership unproven) (low); another writer-form member `ovl_11_func_80108D38` (matched this session, 0x4C, byte-exact first try) guards u16@0 (returns -1 when 0) and when engine global `D_80070CF8` lies outside half-open [6,21) writes u16@+0x2C = 0x12C and AND-clears bit 0x800 of the s32@+0x34 flag word, returns 0 — it is a third recorded reader of `D_80070CF8`, read unsigned (`lhu`) here vs the signed `lh` readers 0x80107B54/0x800D3D2C, same absolute `lui`+`addiu %lo` base; address-apart (0x80108D38), so same-TU membership unproven) (low); it now has a byte-identical twin `ovl_11_func_8010B218` (matched, 0x4C, the same 17-instruction stream — the whole 16-shape window aligned in order, identical toolchain), guarding the same {u16@0, u16@+0x2C, s32@+0x34} object struct and reading `D_80070CF8` unsigned the same way; address-apart (0x8010B218), so same-TU membership with the 0x80108D38 member is unproven but the writer-form family on this struct now spans two byte-identical leaves (low); bit8/bit19@+0x34 flag-read leaf `ovl_11_func_800CFAD0` (matched this session, 0x50) — a reader member of the same {u16@0, s32@0x34} flag family that does not guard u16@0 and never writes: returns 1 iff the s32@+0x34 flag word has bit 0x100 set while arg1≡2 mod 4 and bit 0x80000 is clear (the binary preserves a dead `(v&0x80000)==1` compare that is never true); it also carries the block-scope CAPTURE_PREV_RET dead `sw $v0,0($sp)` phantom-store quirk shared with ovl_11_func_8011D438/ovl_11_func_800D1CD0 (and the file-scope sibling ovl_11_func_800D0600), a per-TU v0-channel fossil family inside ovl_11; address-apart from the other recorded flag-family members, so same-TU membership unproven (low); `D_8012DB58` state-trio run 0x801209A8–0x80120A2C — three link-contiguous functions (0x801209A8, matched, zeroes `D_8012DB58` and sets `D_8007AFF0`+0x2548C/0x254A0; 0x801209D4, matched this session, guards the same far-buffer s32@+0x254A0 against 0x17 — the exact value 0x801209A8 writes there — then reads/writes `D_8012DB58` @+4 (s32) and @+8 (s32/u16) (`+8 += +4`, then `+4 -= 4`) and accumulates the low u16 of @+8 into the far-buffer u16@+0x253B6, a write shared with recorded +0x253AC halfword-block pair member 0x800DB978; 0x80120A2C reads it), sharing the `D_8012DBxx` data cluster (low); `D_8007AFF0` +0x253AC halfword-block pair 0x800DB904–0x800DB978 — leaf 0x800DB978 (matched this session) zeroes s16@+0x253AC/+0x253AE/+0x253B0/+0x253B4/+0x253B6/+0x253B8, link-adjacent 0x800DB904 (ends exactly at 0x800DB978) reads `lh`@+0x253AC; both build the same base `D_8007AFF0 + (0x253B6 >> 16) << 16` via one `lui`+`addu`, same accessor idiom (medium); s16 far-buffer probe 0x800C9D64 (matched this session) reads `lh`@+0x25476 of the same buffer with the same `lui`+`addu` base construction and folds the value ((v!=1)<<1, v==6?1:keep), so the s16 accessor family on `D_8007AFF0` now spans 0x253AC–0x25476; the family also carries an s32 range: leaf 0x800DB7F0 (matched this session — 0x800DB7F0) writes five s32 fields at +0x25394/+0x25398/+0x2539C/+0x253A0/+0x253A4 of the same buffer (values -0x2328, -0x1194, 0, -0x200, 0) with the same single-`lui`+`addu` far-base build, sitting immediately above the recorded s16 block 0x253AC (0x253A4 ends right below it, gap 8 = two more s32 words) (medium); its result is consumed via `jalr` by a link-contiguous dispatch-caller run 0x800C4A2C–0x800C55FC (0x800C4A2C/0x800C4B6C/0x800C4C94/0x800C4DE0/0x800C523C/0x800C541C read it, 0x800C55FC discards), all of which indirect-dispatch on the returned selector (low); stride-copy helper pair 0x800DD21C / 0x800DD248 (low) — word copy at 0x800DD21C (lw/sw +4, matched) and halfword copy at 0x800DD248 (lhu/sh +2, matched this session) are link-adjacent (0x800DD21C 0x2C ends exactly at 0x800DD248; 0x800DD248 0x2C ends exactly at 0x800DD274) and stay as an unbroken contiguous run, both the same do-while counted-copy loop (`bnez` guard on arg2, `sltu` on a `+1` counter) differing only in stride; both clean `void(void*,void*,u32)`-style helpers, no globals (low); `D_80070D38`/`D_80070D3A`/`D_80070D3E`/`D_80070D40` adjacent-u16 deduct-helper family 0x800F3950 / 0x800F3A18 / 0x800F3AC4 (matched this session) / 0x800F3BA0 — four byte-identical leaf helpers, each reads its u16 array global, compares against masked arg0, on pass subtracts it back and returns 1 else returns 0, one global per function across a contiguous u16-array cluster (medium); `D_80128BB0` 0x34-stride struct-array clear/setup run 0x800CBEF8–0x800CC0F8 (medium) — leaf 0x800CBF40 (matched this session) zeroes 4 s16 (0x0–0x6) + 7 s32 fields (0xC/0x14–0x1C/0x24–0x2C) of the 0x34-byte entry; both callers are link-adjacent neighbours in one unbroken run: 0x800CBEF8 (0x48, ends exactly at 0x800CBF40) loops the clear over 3 `D_80128BB0` entries stepping +0x34, 0x800CBF70 (0x188, starts at the leaf's end) initializes an entry's fields then conditionally rescales 0xC/0x14/0x18/0x1C; `D_80070CF8` s16 range-check predicate 0x80107B54 (leaf, matched this session; reads base-engine s16 `D_80070CF8` absolute, returns 1 when the value falls outside half-open [arg0,arg1), `lh`->`slt` probe shape), called by link-adjacent 0x80107604/0x8010775C immediately above it in one unbroken run, just before the `D_8012D0xx` state-probe run 0x80108104 (low); `D_80070CF2` switch-leaf pair (low) — freshly-matched `ovl_11_func_800D2E20` (this session, 0x4C, byte-exact first try) and `ovl_11_func_800F581C` (already matched) are functionally-identical switch leaves over the single s16 global `D_80070CF2`: `lh` the global, case chain on 1/2/3 with `case 0/default` falling first, each case `jr $ra`-returns a small power-of-two constant (1/2/4/8 vs 2/4/8/0x10); 16/16 same instruction shapes, identical toolchain, one switch-case macro family — so the two share a common original file with (low) confidence, and `D_80070CF2` joins the recorded `D_80070Cxx` base-engine region cluster; a no-frame leaf; both read via `lui`+`lh %lo` absolute without a base register build; 0x18-byte spawn-record fill/clear/dispatch run 0x800F4360–0x800F43CC (low) — head leaf 0x800F4360 (matched) fills s16@0/2, sets bit 0 of s16@4, copies a by-value `Vec3` into s32@8/C/10; middle 0x800F4390 clears the same record (zeroes 0/2/8/C/10, AND-clears bit 0 of @4, step +0x18); tail 0x800F43CC dispatch-switches on ids 0x64/0x65/0xE8/0x121–0x124 off the `D_8006C838`+0x8000+0x5DCC/0x5DD4 entity base and direct-calls the head leaf; entity-base slot reader `ovl_11_func_800F4CEC` (matched, this session) loads the same base's +0x5DD4 pointer into new global `D_80129630` and initializes its fields (u16@0=1, s32@8=-0x1388, s32@C=0, s32@10=0x8FC) with the same two-stage base idiom as matched siblings 0x800BFD04/0x8010C3C4; its link-contiguous immediate predecessor `ovl_11_func_800F4CAC` (matched, this session; 0x40 bytes, ends exactly at 0x800F4CEC) loads the same +0x5DD4 slot and stores p+0x18 into `D_80129630`, initializing the sub-struct at p+0x18 (u16@0=1, s32@8=-0x4B0, s32@C=0, s32@10=0xB54) through the offset pointer — same two-stage base idiom and shared EntityD5D4 type, so the pair forms one link-contiguous entity-slot init run (medium); freshly-matched `ovl_11_func_800F4B14` (matched this session, 0x48, byte-exact) reads the adjacent +0x5DA4 pointer slot of the same `D_8006C838`+0x8000 two-stage base (`lui`/`addiu` %lo then runtime `ori`0x8000+`addu`) and walks the 16-entry 0x18-stride array it points to, counting entries whose u16@4 lacks bit 0x4000 via the u16 countdown do-while (`while(n>=0)`) idiom of the 0x800FEB68/0x800FEAD4 family — so it joins the two recorded `D_8006C838`+0x8000 families on the same base (same-TU membership with the +0x5DD4 init pair plausible but unproven, address-apart by 0x198, low); its gapless link predecessor `ovl_11_func_800F4AC0` (matched this session, 0x54, byte-exact; 0x800F4AC0+0x54 = 0x800F4B14 exactly) reads the same +0x5DA4 pointer slot of the same two-stage base and walks the same 16-entry 0x18-stride array rewriting each u16@4 (AND-clears bit 0x4000 when arg0==1 else OR-sets it — the complement of the +0x800F4B14 count) via the same u16 countdown-reversed `for` family, so the +0x5DA4 slot now has two gapless link-contiguous readers and same-TU membership for the pair is plausible (low); freshly-matched `ovl_11_func_800F53BC` (this session, 0x48, byte-exact) is a global-free leaf whose sole caller `ovl_11_func_800F40A4` builds the same `D_8006C838`+0x8000 two-stage base with offsets +0x5D8C (a pointer array) and +0x5DD8 (a signed-halfword count table), 18 iterations, passing each pointer/count pair to 800F53BC, which walks the pointed-to 0x18-stride array updating u16@4 (bit 0x20 → OR-1, else bit 0x40 → AND-drops-bit-0) in a count-driven signed-`s16` loop — same base family and 0x18-stride walk idiom as 0x800F4B14 and adjacent 0x800F5700, so same-TU membership with its caller is plausible but unproven (low); `D_801273xx` reset cluster — leaf `ovl_11_func_800FEBF8` (matched this session) zeroes s32 `D_801273B0` + s16s `D_801273B4/B6/B8/BA/BC`, the other references are matched `ovl_11_func_800FFA28` which sets `D_801273D8`/`D_801273DA`, and freshly-matched `ovl_11_func_80102DC4` (0x80102DC4, 0x58, byte-exact) which consumes the u16 availability mask `D_801273EE` — per set bit of arg0@+8 it xors the bit out of the mask (returns 0 if the bit is already free, 1 after clearing all 12) — while its link-adjacent direct caller `ovl_11_func_80102BCC` reloads/stores the same `D_801273EE` between calls, so the cluster gains two matched members sharing one global (low); fresh reset leaf `ovl_11_func_800FFDCC` (matched this session, 0x98, byte-exact) is the first matched writer of the cluster's upper band — zeroes s32 `D_801273DC`, s32 `D_801273E0`, the s8 run `D_801273E4`–`D_801273EB` (`D_801273E6`=0xFF), the availability mask `D_801273EE`, s8 `D_801273EC`, s16 `D_801273F0` and s16 `D_80127424`, plus the 16-byte halfword table `D_8012CF00[8]` — with the same void reset-leaf idiom as `ovl_11_func_800FEBF8` and the same count-up-`for`→descending-`bgez` table-zero loop as `ovl_11_func_801037EC` (`D_8012CF10[7]`, 0x10 above `D_8012CF00` in the same `0x8012CFxx` region); its direct callers `ovl_11_func_800FFE64`/`ovl_11_func_800FFEF0` are link-adjacent at 0x800FFE64/0x800FFEF0 (low); a fresh matched member `ovl_11_func_80100F9C` (this session, 0x60, byte-exact) also writes the same availability mask `D_801273EE` (mirrors record u16@+4) from the shared 22-byte record table `D_80071318` — its first matched reference (absolute `lui`+`addiu %lo` base, same `(idx&0xFF)*22` stride as stub run `func_80100898`/`func_80100A8C`) — and copies the record's u16s from @+6 into `D_8012CF00` (the destination buffer matched reset leaf `ovl_11_func_800FFDCC` zeroes), so the mask global's matched family now stands 0x80100F9C (writer) / 0x80102DC4 (consumer) with all three globals in the 0x80100xxx band (low); `D_801287F4` counter-state cluster 0x800BC3AC–0x800BCD28 (low) — freshly-matched leaf `ovl_11_func_800BC3AC` stores 0 to `D_801287F4`, increments the counter at `D_8006C838`+0x4488, and clears `D_8007AFF0`+0x2548C (same far-buffer write as the recorded 0x801209A8); its link-contiguous follower 0x800BC3E0 (starts exactly where 0x800BC3AC ends) reads `D_801287F4` and switch-dispatches on it (`sltiu 0x10`, jtbl), 0x800BCD28 reads it too — a zero-by-writer / read-and-dispatch pair on one counter global; `D_80128DE8` s16-limit cluster (low) — leaf `ovl_11_func_800DAFD4` (matched this session) writes six s16 constants (0: -0x32C8, 2: 0, 4: 0x1194, 8: -0x1F40, A: 0x1B8, C: 0x9C4) into the shared data symbol `D_80128DE8` (two s16 triples, offsets 0/2/4 and 8/A/C), the other two users are `ovl_11_func_800DB054` (stub; clamps against the same fields), freshly-matched `ovl_11_func_800DB00C` (matched this session, 0x48, first try EXACT — copies two 6-byte source structs {u16@0,2,4} into the two triples, declaring the shared `Ovl11DE8` type exactly as the leaf's local typedef and reading `D_80128DE8` with the same absolute `lui`+`addiu` %lo base the leaf uses, so both access the cluster identically as an extern), and direct caller `ovl_11_func_801044E4` invokes it mid scene-init chain; `D_8007AFF0` far-buffer +0x25388 pointer-slot probe + first matched `D_80125F24` reader (low) — leaf `ovl_11_func_800C0F84` (matched this session, 0x3C) dereferences the pointer at `D_8007AFF0`+0x25388 (a new offset below the recorded 0x25394–0x25476 accessor span, same single-`lui`+`addu` far-base idiom), indexes the shared s16 table `D_80125F24` through an s16 at +2 of that pointer, and returns `D_80125F24[idx] == 0x1000`; it is the first matched reference to `D_80125F24`, whose only other references are stubs `ovl_11_func_800C2044`/`ovl_11_func_800C2678`, and its sole caller `ovl_11_func_800C0A4C` (reads the result) leads a link-contiguous unbroken run that ends exactly at 0x800C0F84; a fresh member `ovl_11_func_800DD1D0` (matched this session, 0x4C, byte-exact) dereferences the same pointer slot at `D_8007AFF0`+0x25388 with the same single-`lui`+`addu` far-base idiom and returns 0 when the two s16 fields at arg0+0/+2 both match the same two fields of the pointed-at reference, else 1 — read by callers `ovl_11_func_800C2B04`/`ovl_11_func_800C401C`/`ovl_11_func_800CA24C` as an equal-compare (bnez on the result) — so the +0x25388 pointer-slot reader family now spans two matched leaves (address-apart by ~0xD228, so same-TU membership unproven, low); `ovl_11_func_800DD1D0` is itself link-contiguous above the recorded stride-copy pair (0x800DD1D0+0x4C = 0x800DD21C) `D_80128E08` 0x30-stride farm-entry table cluster (medium) — unbroken link-contiguous run 0x800DC990–0x800DCE98 of users of the single shared table global: 0x800DC990 drives the 15-entry table stepping +0x30; 0x800DC9D4 (matched) finds a free entry via bit 0x8000 of its local `Ovl11FuncC9D4Entry` type (u16@+0x28); 0x800DCBDC (matched this session, halfword-vector setter, copies 3 u16 from its `arg1` struct into @+8/+A/+C) is the byte-identical-in-shape twin of its immediate link-follower 0x800DCC1C (matched this session; same instruction shape, writes @+0x20/0x22/0x24), both part of the same entry-init pair on the table; 0x800DCC5C builds a TransMatrix/RotMatrixZXY from the same @+8/A/C and @+0x20–0x24 halfword vectors and flags @+0x28; the run 0x800DC990→0x800DCA10→0x800DCA60→0x800DCBDC→0x800DCC1C→0x800DCC5C is gapless (each ends exactly where the next begins); `D_801231F4`/`D_801231F8`/`D_801232B4` shared u16/s32 state cluster (low) -- fresh leaf `ovl_11_func_800CD6F4` (0x800CD6F4, matched this session) guards bit 8 of arg0@+0x6C, zeroes `D_801231F8`, and stores u16 `D_801232B4[arg0 s16@+0x30]` into `D_801231F4`; its direct caller `func_800C401C` (`jal` at 0x800C427C and 0x800C42D4) itself writes/reads both `D_801231F4`/`D_801231F8`; other cluster users `func_800C6AFC` (reads both as u16), `func_800C99C8` (reads `D_801231F4` as u16), `ovl_11_func_800CB114`, `func_800CD9A0`, `func_800CE654`, `func_800C9424`, `func_800CA708`, `ovl_11_func_8011FFA8`; `D_801247E8` farm-item delta-table run 0x800E351C–0x800E39B8 (medium) — unbroken link-contiguous trio of users of the single 51-entry s32 delta table (0x801247E8–0x801248B4): leaf `ovl_11_func_800E3978` (matched this session; 0x40) returns `D_801247E8[(arg0-0x15F)+1] - D_801247E8[arg0-0x15F]` for arg0 in [0x15F,0x191); stub 0x800E36CC reads the same table as `D_801247E8[t1+1]-D_801247E8[t1]`; stub 0x800E351C reads words @0x0/0xC8 of it; each ends exactly where the next begins (0x800E351C+0x1B0=0x800E36CC, +0x2AC=0x800E3978, +0x40=0x800E39B8); the same `arg0-0x15F in [0,0x32)` range guard recurs at 0x800E5294/0x800E54F8 and inline in direct caller 0x800E3DC8 (low; same band, range-idiom only); `D_8007AFDA` 9-byte lookup leaf `ovl_11_func_8011760C` (matched this session, 0x40 — first matched reference to the byte global; scans `D_8007AFDA[0..8]` for the first byte == 2 and returns its index, else -1, a `for`-loop rotated to a bottom-tested while with the counter/pointer pair) sits at the tail of an unrecorded unbroken link-contiguous run whose head 0x80117370 (caller of the leaf) + 0x801173B8 (596 bytes forking to 0x8011764C/0x80117674/0x801176BC) end exactly at 0x8011760C, followed gaplessly by 0x8011764C; fresh member `ovl_11_func_8011764C` (matched this session, 0x28, byte-exact) — a void leaf that resets two engine globals to 0 via the matched exe setter pair (`func_800226D8` = `SetVal8005E334(0)` then `func_80017B18` = `SetVal8005E2BC(0)`), called twice by the run's head 0x801173B8 (low); `D_80121780` 8-entry dispatch-table run — leaf `ovl_11_func_800BBC34` (matched this session, 0x40; first matched reference to both the table and base-engine counter `D_80070CC0`, the same `D_80070Cxx` region as the recorded `D_80070CF8`/`D_80070D38/3A/40` clusters) reads `D_80070CC0`, scales by 4, and `jalr`s through `D_80121780[%hi/lo]`; its table members are entirely ovl_11 functions — the `D_801287F4` counter-state cluster leaves 0x800BC3AC/0x800BC3E0, 0x800C14A0, 0x800BCF20, and a 0x801048A0–0x80104EA8 run — so 0x800BBC34 is the indirect dispatch caller feeding the counter-state cluster (low); `/60` clamp-scaled helper pair 0x800CD534 / 0x800CD578 (both matched) — gapless link-contiguous pair (0x44 bytes each: 0x800CD534 ends exactly at 0x800CD578, which ends exactly at 0x800CD5BC), both tier-1 leaves with the single shared caller `ovl_11_func_800CCCC0`, and both spell the same `/60` magic-constant division idiom with complementary clamp bounds: `-((n/60)*2)-5` clamped at -0x80 (0x800CD534) and `(n/60)*7+0x32` clamped at +0x7F (0x800CD578) (low); `D_8006C838`+0x8000 entity-base 0x1D4-stride s16 reader — matched leaf `ovl_11_func_801075C0` (this session, 0x44) returns `(*(s16 *)((char *)&D_8006C838 + arg1-slot*0x1D4 + 0x8000 + 0x1A16) ^ lo) != 0`, built with the same two-stage base idiom (pure `lui`/`addiu` base then +0x8000 as runtime `ori`/`addu`) as the recorded `EntityD5D4` accessor pair 0x800F4CAC/0x800F4CEC and 0x800BFD04/0x8010C3C4; called by link-adjacent stub `ovl_11_func_80107528` (which dispatches arg0∈{0..4} and feeds it `hi = a1>>8, lo = a1&0xFF`); a second matched member joined this session — `ovl_11_func_8011FF0C` (matched this session, 0x68, 26/26, byte-exact first draft) reads the u16 at +0x19EC of the same `D_8006C838`+0x1D4-stride+0x8000 entity-base view and clamps it (writes `x+arg` when `x < 0xFFFF-arg`, else `0xFFFF`): the same two-stage `lui`/`addiu` base + runtime `ori`0x8000+`addu` idiom and 0x1D4 stride as matched `ovl_11_func_801075C0`, so the 0x1D4-stride entity-base family now spans two matched leaves; address-apart from the others by ~0x8894, so same-TU membership unproven (low) fresh leaf `ovl_11_func_800FEB68` (matched this session, 0x48, byte-exact) counts the 20 u16s at `D_8006C838`+0x81BC stepping +0xB8 whose value lies in [0x160,0x164) (`(x-0x160)<4u` `lhu`+`addiu`+`sltiu` range probe, countdown do-while `while(n>=0)`) — built with the same two-stage `D_8006C838` base (`lui`/`addiu` %lo then runtime `ori`+`addu` offset, offset > 0x7FFF) as, and byte-exact loop-shape twin of, matched `ovl_11_func_800FEAD4` (which reads `D_8006C838`+0x901C with the same u16 countdown-loop leaf idiom); the two sit in one gapless link run 0x800FEAD4→0x800FEB14→0x800FEB68→0x800FEBB0→0x800FEBF8, so same-TU membership with 0x800FEAD4 is likely (medium); freshly-matched `ovl_11_func_800FEB14` (this session, 0x54, byte-exact), the run's middle member, counts the 10 entries at `D_8006C838`+0x7AE8 stepping +0xB4 (u16@-0x34 nonzero AND u32@0 lacking bit 0x02000000) with the same `D_8006C838` base and u16 countdown do-while (`n=9; while(n>=0)`) leaf idiom, extending the same-TU family to the +0xB4-stride 10-entry band (medium); the next run member `ovl_11_func_800FEBB0` (matched this session, 0x48, byte-exact) is the byte-exact loop-shape twin of 0x800FEB68 — same two-stage `D_8006C838` base, same +0x81BC offset and +0xB8 stride, same `(x-bound)<range` probe and countdown do-while — counting the 20 u16s in the complementary band [0x164,0x166] (`(x-0x164)<3u`), so the pair likely partitions one table's value range from the same original file (medium); `D_8005181A` shared-data symbol leaf `ovl_11_func_8011DD48` (matched this session, 0x18, byte-exact first try) — tiny 5-arg struct-setter leaf (`D_8012D52C`-run member `ovl_11_func_8011BAFC` is a direct caller) reading `D_80054BC0[0]` and adding `(s32)&D_8005181A` with the same unsplit-self-clobber `la` address form as engine `func_8001A284` and the stub family 0x8011AA64/0x8011ADF4/0x8011AFB4/0x8011AC30 that all reference the `0x800518xx` data region (low); fresh member `ovl_11_func_8011CEE0` (matched this session, 0x30, byte-exact first draft) — tiny dst-forwarding leaf calling the engine u16-string copier `func_8001ABF0(dst, (u16*)(D_80054BC0[0] + (s32)&D_80051808))`, the second matched member of the `D_80054BC0[0]` + `&D_800518xx` shared-data-symbol idiom (new symbol `D_80051808` = `D_80051768`+0xA0, same `0x800518xx` region); its sole direct caller `ovl_11_func_8011CD2C` ends exactly at 0x8011CEE0 (0x1B4, zero-gap), `ovl_11_func_8011CC08` takes its address as a callback pointer, and it ends exactly at 0x8011CF10, so the link run 0x8011CD2C→0x8011CEE0→0x8011CF10 is unbroken — address-apart from the 8011DD48 member, so same-TU membership within the idiom family stays unproven (low); freshly-matched `ovl_11_func_8011DE70` (this session, 0x4C, byte-exact) is a global-free s16 range-check leaf (`(arg0-1)&0xFFFF < 0x19` gate, `(arg0-1)%5` else -1) and the gapless link predecessor of the recorded 0x801282xx accessor leaf `ovl_11_func_8011DEBC` (0x8011DE70+0x4C=0x8011DEBC), so the run now stands 0x8011DE70→0x8011DEBC→0x8011DF04→0x8011DF4C with three consecutive pure leaves (same-TU membership unproven, low); `ovl_11_func_8011DF04` (matched this session, 0x48, byte-exact) is a pure global-free s16-selector leaf (maps 0x7A/0x7B/0x7C/0x60 to 3/2/1/4 else 0 via an if-chain) and the gapless link successor of the recorded 0x801282xx accessor leaf `ovl_11_func_8011DEBC` (0x8011DEBC+0x48=0x8011DF04, +0x48=0x8011DF4C; freshly-matched `ovl_11_func_800EFD54` (this session, 0x4C, byte-exact) is the first matched reader of the shared 0x14-stride range-clamp table `D_80124A18` (reads s16@+8 and s32@+0xC of `D_80124A18[arg0]` and clamps `arg2` between them), the direct-callee of stub caller `ovl_11_func_800EFABC` and one of four read sites of the same table — 0x800EFABC/0x800EFC68/0x800EFD54/0x800EFF04 — which with the two in-between leaves 0x800EFDA0/0x800EFE34 form one gapless link run 0x800EFABC→0x800EFC68(0xEC)→0x800EFD54(0x4C)→0x800EFDA0(0x94)→0x800EFE34(0xD0)→0x800EFF04(0x98) ending exactly at 0x800EFF9C, the four read sites building the same absolute `lui`+`addiu %lo(D_80124A18)` base — same-TU membership plausible (low); the run's in-between leaf `ovl_11_func_800EFDA0` (matched this session, 0x94, byte-exact) is a global-free three-arg comparison-dispatch switch leaf (`sltiu arg2<5` + 5-entry jtbl_800B9F00 returning 0/1 per comparison arm through one shared result variable and a single return tail) — it builds no `D_80124A18` base and touches no global, so its run vote is adjacency only; new rodata evidence this session: its jtbl sits at rodata 0x20E0 contiguously between jtbl_800B9EE8 (rodata 0x20C8, owned by link-predecessor 800EFC68) and jtbl_800B9F18 (rodata 0x20F8, owned by link-successor 800EFE34), the three consecutive link-order functions' switch tables interleaved in one rodata run in text order, separated only by the 4-byte zero pad word D_800B9F14 (alignment, generic rodata, no TU emits it), and the compiled TU's `.rodata` extent (0x14) equals the original attribution extent exactly — the per-TU-contiguous-rodata signature voting the trio 800EFC68/800EFDA0/800EFE34 into one original source file (low); the trio's third member `ovl_11_func_800EFE34` (matched this session, 0xD0, byte-exact first draft, clean C baseline flags) is a global-free three-arg arithmetic-dispatch switch leaf (`sltiu arg2<6` + 6-entry jtbl_800B9F18; case 0..5 store/add/sub/mul/div/mod of arg1 into `*(s32*)arg0`, div/mod guarded on arg1==0, one shared return tail) and carries the same measured signature — its compiled TU's `.rodata` extent (0x18, exactly its 6 table words, rodata 0x20F8–0x2110 contiguous after 800EFDA0's extent + the 4-byte pad word) equals the original attribution extent exactly, so the per-TU-contiguous-rodata signature now stands measured on both switch members of the trio and the same-TU membership of 800EFC68/800EFDA0/800EFE34 is measured, not single-member hypothesized (medium); `D_800759E4` shared-object initializer run 0x8010941C–0x8010946C (low) — leaf `ovl_11_func_8010941C` (matched this session, 0x50, byte-exact first try) is the gapless link predecessor (0x8010941C+0x50=0x8010946C) of stub `ovl_11_func_8010946C`, which `ovl_11_func_80108CD0` feeds `&D_800759E4` (that reader `lhu`s `D_800759E4`'s u16@0 and passes the object); 0x8010941C is the first matched direct writer of `D_800759E4`'s lower fields — per-sub-state arg (0 → u16@0x30=1, s32@0x38=-0x708, @0x3C=0, @0x40=0xC1C; 1 → @0x30=9, @0x38=0xE6, @0x40=-0x514) — called by 0x800E537C / func_800EC064 / func_800F3FF4 / 0x800E8250; the same object's s32@0x34 flags word is the recorded bit-17 flag family's field (func_800CF044 `lw`s `D_800759E4`+0x34 and masks 0x20000), so the run widens that family with a lower-field initializer (same-TU unproven); `D_80128CB4`–`D_80128CC8` shared-state cluster (low) — leaf `ovl_11_func_800C5048` (matched this session, 0x50, byte-exact) is the first matched writer of the contiguous cluster (s32 `D_80128CB4`/`D_80128CB8`/`D_80128CBC` + s16 `D_80128CC0`/`D_80128CC2`/`D_80128CC4`/`D_80128CC6`/`D_80128CC8`) from its six args (constants 0 and 0x28 plus four s16 and one s32), read by its address-adjacent gapless successor `ovl_11_func_800C5098` (starts exactly at 0x800C5048+0x50; reads `D_80128CB4`/`D_80128CB8`/`D_80128CC0`/`D_80128CC2`/`D_80128CC4`/`D_80128CC6`/`D_80128CC8` still as a stub) — a write/read pair on one cluster, and all three callers (0x800C4B6C/0x800C4C94/0x800C4DE0) lie inside the recorded dispatch-caller run 0x800C4A2C–0x800C55FC; `ovl_11_func_800E8BA0` (matched this session, 0x50, byte-exact) is the first matched reader of the shared s32 table `D_80129560` — whose only other users are an address-dense band of stubs (0x800E5A1C–0x800EExxx, incl. load-side 0x800E6834/0x800E686C) using the same absolute `lui`+`addiu %lo` base and s16-fused `sll16`/`sra14` index idiom — and reads the recorded `D_8006C838`+0x8000 two-stage entity base at the new slot offset +0x5DD0 (a 0x18-stride pool pointer initialized by exe `func_80021E60`'s `base2[0x5DD0>>2]` store), storing one entry's u16@+2 into `D_80129560[(s16)arg1]` (low); freshly-matched `ovl_11_func_800E8D00` (this session, 0x7C, byte-exact) is a second matched **writer** of the same `D_80129560` s32 table — selects one of four `D_8006C838` s16s (+0x524C/+0x524E vs +0x5252/+0x5254 by `(s16)arg1`, first-of-pair overridden by second when arg2 && first==0xA4) and stores it `D_80129560[(s16)arg0]` via the same s16-fused `sll16`/`sra16` index idiom, 0x160 above `ovl_11_func_800E8BA0` inside the recorded user band — same-table + band + idiom vote with the 800E8BA0 member (low); freshly-matched `ovl_11_func_800E89CC` (this session, 0x58, byte-exact) is a second matched reader of the same `D_8006C838`+0x8000 two-stage entity base at the same slot +0x5DD0 (the 0x18-stride pool pointer); it advances to `pool[arg0]` and OR-sets / AND-clears bit 0 of the entry's u16@+4 under a `(s32)arg1<<16` flag test — same two-stage base idiom and 0x18-stride pool entry as `ovl_11_func_800E8BA0` (14/20 instruction shapes align in order, identical toolchain), address-near it (0x800E89CC, 0x1D4 below the sibling), so same-TU membership with the +0x5DD0 sibling is plausible (low); fresh member `ovl_11_func_800E8960` (this session, 0x6C, byte-exact) is the gapless link predecessor of `ovl_11_func_800E89CC` (0x800E8960+0x6C = 0x800E89CC) and the writer/initializer member of the same +0x5DD0 0x18-stride pool object — same two-stage `D_8006C838`+0x8000 base at slot +0x5DD0, advances to `pool[arg0]`, stores the `D_8007AFF0` far-buffer halfword @+0x25476 into u16@0 (a second reader of that offset beside recorded probe 0x800C9D64, unsigned `lhu` here vs its signed `lh`), writes s32@0xC/@0x8/@0x10 from args, and OR-sets bit 0 of u16@+4 — the exact flag field 800E89CC reads — so link order plus the shared pool object vote with the +0x5DD0 family (low); freshly-matched `ovl_11_func_800F4FC8` (this session, 0x54, byte-exact) is a flag-guarded writer member of the same `D_8006C838`+0x8000 two-stage base family — reads the recorded +0x5DD4 entity-slot pointer, steps +0x18 to the next 0x18-stride pool entry, AND-clears bit 0 of its u16@4 (the same u16@4 the +0x5DA4 family 0x800F4AC0/0x800F4B14/0x800F53BC rewrites), AND-clears bit 0x02000000 of the `D_8006C838`+0x44F8 flag word (a clearing twin of reader 0x800D603C's bit-0x400000 test; 800FEB14 reads the same bit), and zeroes u8@+0xE650; address-near the 0x800F4AC0–0x800F4CEC +0x5DD4/+0x5DA4 slot band, so same-TU membership with the entity-slot pair 0x800F4CAC/0x800F4CEC is plausible (low); bit25@+0x34 flag-read leaf `ovl_11_func_800E2718` (matched this session, 0x54, byte-exact) — a read-probe member of the recorded {u16@0, s32@0x34} object-struct flag family: guards u16@0 and probes bit 0x02000000 of the s32@+0x34 flag word, returning -1 only when u16@0 is 0 and the bit is clear, otherwise on `u16@+0xB0` of the same struct returns 0x86/0x10A/0x109 by `t<3`/`t<0xA` — a bit-testing twin of the bit-16 probes 0x800DF4F0/0x800E109C and the bit-17 writer 0x800CF2C8 on the same object struct, adding the new field offset +0xB0; address-apart (0x800E2718) from the other family members, so same-TU membership unproven (low); freshly-matched `ovl_11_func_800C0EA4` (matched this session, 0x58, byte-exact) is a first-free-slot allocator over the shared 50-entry s32 array `D_80128A88` (-1 = free): gapless link successor (0x800C0DB4+0xF0=0x800C0EA4) of its sole caller `ovl_11_func_800C0DB4` (a stub switch-run that `lh`s the item id from record @+0xC before the call), and the second matched reference to `D_80128A88` alongside `ovl_11_func_800C0A28` (the “slot 0 free” probe `~D_80128A88 != 0`); both D_80128A88 references and the caller sit in one gapless link run with only stub functions between them, so same-TU membership among the three is plausible (low); freshly-matched `ovl_11_func_800F4B5C` (this session, 0x58, byte-exact) is a flag-guarded writer member of the recorded `D_8006C838` flag family — probes bit 2 of the shared +0x44F8 s32 flag word (elsewhere tested at bit 0x400000 by 0x800D603C and bit 0x02000000 by 0x800F4FC8/0x800FEB14) and, on pass, stores the range-capped ([0x51,0x56) signed s16) arg into the u16 at +0x44D6, a field no other matched function references; at 0x800F4B5C it sits inside the 0x800F4AC0–0x800F4FC8 entity-slot/flags band, immediately between matched 0x800F4B14 and the 0x800F4CAC/0x800F4CEC pair, so same-TU membership with the cluster is plausible (low); freshly-matched `ovl_11_func_800F5108` (this session, 0x58, byte-exact) is a fourth member of the ovl_11 CAPTURE_PREV_RET dead `sw $v0,0($sp)` phantom-store fossil family (same per-TU v0-channel quirk + `tmp[2]` frame as 0x800CFAD0/0x8011D438/0x800D1CD0) — a leaf that bit-dispatches on a u16 flags word (bits 0x2000/0x800/0x1000, in that order) returning one of its s16 args, whose direct caller `ovl_11_func_800F5160` sits in the same 0x800F4xxx–0x800F5xxx flag band and stores the result as a halfword; `D_80050B5C` 0x20-stride item-table lookup family (medium) — fresh leaf `ovl_11_func_80100A34` (0x80100A34, matched this session, 0x58, byte-exact first try) is the second matched reader of the shared table global after matched `ovl_11_func_801000D4` (returns the matched entry's u32 @+0, else sentinel 0x2206; the 801000D4 member returns 1/0), both the same `for (i = 0; D_80050B5C[i].id != 0xE2; i++)` scan idiom producing the identical reload-plus-two-const `0xE2` loop shape; 80100A34's return (used as an offset) is read by direct caller `ovl_11_func_80100898` (lhu-feeds the mask arg) in the same 0x80100xxx link band; `D_801284xx` keyed-lookup cluster (low) — fresh leaf `ovl_11_func_8011EE40` (matched this session, 0x58, byte-exact) is the first matched reader of the shared {u8,u8} byte-pair table `D_80128424` (0xFF-terminated; a `for (i = 0; D_80128424[i] != 0xFF; i += 2)` scan rotated to a bottom-tested while via the counter/pointer family, returning the paired byte else -1, arg sign-extended from caller's `lh`); it sits link-contiguous exactly after its sole direct caller `ovl_11_func_8011ECC4` (stub, 0x8011ECC4+0x17C = 0x8011EE40) and before `ovl_11_func_8011EE98`, and the caller feeds the returned value `sll`×3 to scale-walk the shared sibling table `D_801284AC` in the same `0x801284xx` data region — call edge plus link order plus a shared data cluster, same-TU membership plausible but unproven; `D_800A0494` 9-s16-slot-row table family (low) — matched leaf `ovl_11_func_800D6730` (this session, 0x5C, byte-exact first try) is the first matched reference to the shared table, a 32-row × 18-byte (9×s16, stride 0x12) grid it treats as `D_800A0494 + row*9`: it scans row `arg1` for the first zero slot, writes s16 `arg0` there and returns the slot index else -1, built with the same absolute `lui`+`addiu %lo` base; the init stub `func_800D6628` (address-apart 0x108) memsets rows 0–1 to 0 and fills rows 2–31 (`0x21C` from `+0x24`) with 0xFF, so 0 = empty slot and nonzero = occupied, and the allocator's caller `ovl_11_func_800D6A94` passes row ∈ {1,2} — rows 1 and 0 are the zero-init region while row 2 starts in the 0xFF region, so a second writer (stub `func_800D6F78`, also referencing the table) must clear slots back to 0; sibling stub `func_800F0A58` reads it too — a shared-table allocator/init family inside ovl_11, same-TU membership plausible but unproven; a fresh matched member `ovl_11_func_800D678C` (this session, 0x68, byte-exact) is the FIRST matched reference to `D_800A04B8` (0x800A04B8 = the shared grid at +0x24, i.e. the row-2-relative view, itself treated as a 0x1E-stride record table indexing `D_800A04B8[arg0]` = +arg0*0x10E, scanning 9 records stepping +0x1E and returning 1 unless some record's s16@+0x18 is != -1 && >= 0x3F0); its callers/references 800D666C/800D67F4/800D6A94/800D7144 (incl. direct caller `ovl_11_func_800D6A94`, the recorded allocator's caller) are still stubs — same absolute `lui`+`addiu %lo` base, so the shared-table family now has a second matched reader and the record table's own same-TU vote is (low); range-checked jump-table switch-leaf idiom (low) — freshly-matched `ovl_11_func_800D2950` (this session, 0x60, byte-exact) is a second matched user of the exact `(s32)((arg0<<0x10)+K)>>0x10` + `sltiu` + `jtbl` dispatch spelling of byte-exact member `ovl_11_func_800C3548` (identical toolchain, 13/16 shapes align), a 197-entry table (jtbl_800B8840) classifying s32 arg in [0xA1,0x164] into return constants (-0x14/-0x1E/-0x28/-0xA else 0); no globals, leaf, so its same-TU vote is idiom-only; `ovl_11_func_800D2D54` (matched this session, 0x64, byte-exact) joins that same family — a 197-entry jtbl_800B8B58 over the same [0xA1,0x165] code window (identical `sltiu`+`jtbl` dispatch shape) — as a writer member of the recorded {u16@0, s32@0x34} flag family (ORs bit 0x1000 / 0x80000000 into u32@+0x34), and enumerates exactly the shared key-code universe of matched `ovl_11_func_800D3BB0` (0x113/0x153/0x155/0x159/0x162/0x165 all appear in both case lists), so its same-TU vote with the 800D3BB0 key-code leaf is (low); `ovl_11_func_80111CC4` gapless-run leaf (low) — matched this session (0x64, byte-exact): a pure global-free s16 compare leaf (returns 0/1/2/3 classifying arg0 against arg1 and its [arg1, arg1+2) window; arg0∈{5,6}→0, arg0≥7∧arg0<arg1→1) called by its two gapless link predecessors `ovl_11_func_80111A60` (0x114, ends exactly at 0x80111B74) and `ovl_11_func_80111B74` (0x150, ends exactly at 0x80111CC4) — the run 0x801115A8→0x80111750→0x8011184C→0x80111944→0x80111A60→0x80111B74→0x80111CC4→0x80111D28 is unbroken, and call edge plus link order agree, so same-TU membership with the immediate-predecessor pair is plausible but unproven; a fresh matched member `ovl_11_func_8010B830` (this session, 0x64, byte-exact first draft) is a switch-form writer of the same `{u16@0, s32@0x34}` object-struct flag family — dispatches on u16@0 values 0x15E/0x15F into the s32@+0x34 flag word (0x15E → AND-clears bits 0x8000|0x800000 of it, 0x15F → ORs 0x808000) rather than the family's usual u16@0 guard, no-frame leaf returning 0 (low); fresh member `ovl_11_func_800F4A58` (this session, 0x68, byte-exact first draft) is a flag-gated reader of the recorded `D_8006C838`+0x8000 two-stage base at the entity-slot pointer +0x5DD4 (the slot 0x800F4CAC/0x800F4CEC/0x800F4FC8 read): probes the +0xC flag word bit 0x08000000 (the sharing sibling of the recorded +0x44F8 flag word) and, on clear + bit 0x100 set in the pointed struct's u16@+4, decrements s32 `D_80129634` (the first matched reader of the `D_801296xx` region beside `D_80129630`) and masks bit 0x100 out of u16@+4 when the count had hit 0 — sits inside the 0x800F4AC0–0x800F4FC8 entity-slot band, so same-TU membership with the entity-slot pair is plausible (low); freshly-matched `ovl_11_func_800F501C` (this session, 0x70, byte-exact) is the first matched writer of SP_5D98: reads the +0x5D98 pool-slot (the 0x18-stride pool `exe func_80021E60` initializes via `base2[0x5D98>>2] = D_8004ED04+0x360`), indexes `(arg0*0x18)+0xF0` and writes s16@0xF2 (ID 0xE8/0x123) + bit 0 of u16@0xF4 — same two-stage base + 0x18-stride u16@+4 bitflag idiom as the +0x5DA4 (800F4AC0/800F4B14) and +0x5DD0 (800E8BA0/800E89CC/800E8960) slots, joining the recorded entity-slot band's same-TU vote (low); freshly-matched `ovl_11_func_800EDEB8` (this session, 0x84, byte-exact first draft) is the first matched reference to both `D_80076280` and `D_80071B00` — a no-frame leaf that adds s16/s32/s32 arg deltas (×2) to the s32 fields @+0/+4/+8 of a 0x1D4-stride table entry `D_80076280[arg0]`, with arg0==0x29 rerouted to base `D_80071B00`, returning 1; `D_80076280` sits 0x60 inside the recorded `D_80076220` 0x1D4-stride cluster's data span and uses the same 0x1D4 stride and s16-sign-extend-index accessor idiom as its matched reset members 0x800C1BE0/0x800C1C90/0x800E549C, so a shared data body / same-original-file vote with that cluster is plausible but the 0x60 offset is not entry-aligned and all link-adjacent neighbours (0x800EDD54/0x800EDF3C/0x800EE000) are still stubs — same-TU membership unproven (low)
| `ovl_30` | `Obj\GF_swind.bin` | D_80134008/D_80134B0C init/read pair with 8012F084 as third user (low) |
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

## `ovl_11` s16 range-map helper pair — 0x800CB020–0x800CB110 (confidence: medium)

Evidence: link-order adjacency (0x800CB020 ends at 0x800CB0B0 where the next
function starts) plus a shared caller: `ovl_11_func_800C72F8` calls
`ovl_11_func_800CB0B0` at 0x800C7338 and `ovl_11_func_800CB020` at 0x800C7344
back to back. Both are leaf `s16(s16)` value-mapping helpers with the same
author idiom cluster — `andi+sltiu` u16 range guards, the 0x66666667 signed
`/5` strength reduction, and per-return sll/sra tails with delay-slot hoisting.
The 800CB020 reconstruction was settled by inheriting 800CB0B0's spelling
(positive-form second range check, no shared return tail), confirming the
idiom kinship.

Members:
- ovl_11_func_800CB020 (m) — maps an s16 through a /5 range dispatch:
  0x01–0x19 → `(s16)((t*0x14+0x48) + (arg0 - (t*5+1)))` with t=(arg0-1)/5;
  0x1A–0x1D → `(arg0-0x1A)*4+0xB6`; else 0.
- ovl_11_func_800CB0B0 (m) — sibling range map: 0x01–0x19 → (arg0-1)/5;
  0x1A–0x1D → (s16)(arg0-26); else 0.

## `ovl_11` D_800749F4 record-array accessor pair — 0x800D0C34 / 0x800D0D7C (confidence: low)

Evidence: both walk the same absolute-addressed D_800749F4 record array with
the same 0xB8 stride (20 entries), as a complementary accessor pair — one
finds the first free entry, the other maps a pointer back to its index —
plus shared callers (ovl_11_func_800DE8A4, 800DF72C, 800E047C, 800E12D8 call
both) and ovl_11 link-order adjacency with only two small functions between.
The same array is also scanned by the exe container's 0x8001A574 dispatch
family (see that entry), so D_800749F4 is a cross-container shared object;
same-TU membership here rests on the pair roles, not on the global alone.

Members:
- ovl_11_func_800D0C34 (m) — find-first-free entry: scans up to 10/20
  (D_80070D08-selected) records for `u16@+0 == 0 && !(u32@+0x34 &
  0x02000000)`, returns the record pointer or NULL.
- ovl_11_func_800D0D7C (m) — index-of-pointer: returns the record's array
  index (0..19) or -1.

## `ovl_11` two-table field-lookup siblings — 0x800D5ABC–0x800D5BBC (confidence: medium)

Evidence: three adjacent 0x80-byte functions access the pointer members at
`D_8006C838 + 0x20` and `+0x24`, use the same 0x28/0xB0 record strides,
16-bit narrowing steps and -1 sentinel, and differ in the final halfword
field offset (0xAA, 0xAC, 0xAE). Their original instruction streams agree
under local-label relocation and that field substitution. This is strong
source-family evidence; original translation-unit membership remains a prior.

Members:
- ovl_11_func_800D5ABC (m) — reads field 0xAA; sibling-derived C integrated and verified across all containers.
- ovl_11_func_800D5B3C (m) — reads field 0xAC.
- ovl_11_func_800D5BBC (m) — reads field 0xAE.

The static-first strategy investigation and candidate verification are recorded
in `plans/static-first-matching-decompilation.md`.

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

## `ovl_11` 0x80106DC0 struct-reset leaf run — 0x80106DC0–0x80106EAF (confidence: medium)

A 0x28-byte struct-reset leaf at the head of a contiguous three-function run
(0x80106DC0, size 40, ends 0x80106DE8; 0x80106DE8, size 80, ends 0x80106E38;
0x80106E38, size 120, ends 0x80106EAF — zero gaps). Call graph and link order
agree: both immediate successors call the leaf. Same leaf-reset fingerprint as
the farm-object clear/update run (leaf 0x801214F8 called by both its
neighbours).
Members:
- ovl_11_func_80106DC0 (m, matched this session) — resets an 0x18-byte struct:
  zeroes f0/f4/fC/fE/f10 (s16) and f8/f14 (s32), sets f2 to 4; called by both
  successors

---

## `ovl_11` `D_801290D8` 0x34-stride entry-table init/accessor cluster — 0x800DCE98, 0x800DCECC, 0x800DCF10 (confidence: low)

Leaf `ovl_11_func_800DCE98` (matched this session, 0x34, byte-exact) is the
table's entry-init leaf: `memset(arg0, 0, 0x34)` then `u16@+0x2C = 0x8000`
(free-entry bit). Both of its callers are its gapless link successors
(0x800DCE98+0x34 = 0x800DCECC, 0x800DCECC+0x44 = 0x800DCF10) and both walk the
same shared table global `D_801290D8`: 0x800DCECC calls the leaf 3 times
stepping +0x34; 0x800DCF10 reads `lhu`@+0x2C, tests bit 0x8000, re-inits via
the leaf, then AND-clears the bit (`andi 0x7FFF`, `sh`@+0x2C). Shared global
plus call edges plus link order agree; members not yet matched.
Members:
- ovl_11_func_800DCE98 (m, matched this session) — entry-init leaf (see the
  memset-clear idiom family above)
- ovl_11_func_800DCECC (s) — bulk re-init: calls the leaf over entries 0–2 of
  `D_801290D8` (+0x34 stride)
- ovl_11_func_800DCF10 (s) — per-entry accessor: claims/refreshes entries by
  the @+0x2C free bit and initialises entry fields through `func_8001BFA8`

---

## `ovl_11` memset-clear struct-constructor idiom family — 0x800C1C5C, 0x800D3200, 0x800DF0F8, 0x800E0D0C, 0x800E2904, 0x8010B64C, 0x801092E0 (confidence: low)

Shared author idiom, recorded as an idiom prior rather than a confirmed TU:
`memset(arg0, 0, N); *(s16 *)arg0 = 0;` — clear a caller-provided struct then
zero its first s16 field. Six instances in the matched corpus, all in
`ovl_11`, and the 12-word machine shape is identical apart from the size
immediate — a family transfer from one member solved the next. No other tie:
struct sizes differ (0xB0/0xB8/0xB8/0xB4/0xF0, so possibly different types,
though two members share 0xB8), address span is ~0x38000 with no adjacency,
and the caller sets are disjoint (0x8010B64C's single caller is 0x800E8760).
Members:
- ovl_11_func_800C1C5C (m, matched this session) — same construction over
  0x1D4 bytes with store value −1 (`memset(arg0, 0, 0x1D4); *(s16 *)arg0 =
  -1;`); the 0x1D4 size ties it to `sizeof(struct_80076220)` (see the
  struct_80076220 record run below), unlike the other members' sizes
- ovl_11_func_800D3200 (m) — clears an 0xB0-byte struct (memset 0xB0, sh 0 at
  +0); called by nine functions in the 0x800CF044–0x800D506C run
- ovl_11_func_800DF0F8 (m) — same construction over 0xB8 bytes
- ovl_11_func_800E0D0C (m) — same construction over 0xB8 bytes; sits between
  800DF0F8 and 800E2904 in the ovl_11 link order
- ovl_11_func_800E2904 (m) — same construction over 0xB4 bytes
- ovl_11_func_8010B64C (m, matched this session) — same construction over 0xF0
  bytes; sole caller ovl_11_func_800E8760
- ovl_11_func_801092E0 (m, matched this session) — same construction over 0xF0
  bytes, byte-identical to 8010B64C in all 12 words including the 0xF0
  immediate (a duplicated helper, likely its own TU copy); no direct caller
  found in any extracted bytes — dispatched indirectly or dead
- ovl_11_func_800DCE98 (m, matched this session) — variant member over 0x34
  bytes: memset 0x34 then stores the free-entry bit as `u16`@+0x2C = 0x8000
  (`ori`, not a +0 s16 store); see the `D_801290D8` entry-table cluster above

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

## `ovl_11` {u16,u16} local-pair counter run — 0x800BF8B8–0x800BFC20+ (confidence: low)

Candidate same-TU run of three gapless link-order functions sharing one
4-byte {u16,u16} struct passed by address, seeded from the same `D_8006C838`
+0x44BA/+0x44BC halfword pair. The leaf `ovl_11_func_800BFADC` (matched
this session, 0x4C, byte-exact first try) advances the pair: increments the
s16@+2 field while the signed guard `< 0x1E` holds, else zeroes it and
increments s16@+0 while `< 4`, else zeroes both — a two-field loop counter;
callers read the pair back (`lh`/`lhu`) after the call, so the updater
drives state through an address, not a return value.

Fingerprints:
- zero-gap link-order contiguity (map): 0x800BF8B8 (0x224) → 0x800BFADC
  (0x4C) → 0x800BFB28 (0xF8) → 0x800BFC20, each starting exactly where the
  previous ends, one unbroken span with no unrelated code between;
- shared struct + idiom: both callers build the same 4-byte stack pair
  {u16@0,u16@2} from `lhu D_8006C838+0x44BA` / `+0x44BC`, pass its address
  to the leaf updater, and also share leaf `ovl_11_func_800BFC20`;
- same-updater role: `ovl_11_func_800BF8B8` and `ovl_11_func_800BFB28`
  each call `ovl_11_func_800BFADC` on their local pair.

Members (address order):
- ovl_11_func_800BF8B8 (s) — head: seeds the pair from D_8006C838+0x44BA/BC,
  calls the updater, then dispatches on the pair fields (s16 compares vs
  D_8006C838+0x548A/0x548C)
- ovl_11_func_800BFADC (m, matched this session) — leaf two-field loop
  counter updater on the {u16@2-first, u16@0} pair; byte-exact clean C,
  baseline flags (no override)
- ovl_11_func_800BFB28 (s) — follower: same seeding + updater call, rewrites
  D_8006C838+0x64C8 via +0x8000 split base, shares the 0x800BFC20 leaf
- ovl_11_func_800BFC20 (s) — shared leaf called by both head and follower

---

## `ovl_11` D_80075854 4-byte-cell scan helper twin — 0x8010C668 / 0x8011F4F4 + 0x800FEAD4 (confidence: low)

Candidate same-family of `ovl_11` (`Obj\GF_FARM.bin`): a byte-identical
leaf helper scanning the same main-RAM u16-table global `D_80075854`, seen
in three copies. The functions are instruction-for-instruction twins — same
bound `0x62` (99 iterations), same `+=4`-byte cell step, same `lhu` zero
probe of each cell's low u16, same countdown latch (`v1--` then `bgez`, count
of nonzero cells into `$a1`), same `jr $ra` with `addu $v0,$a1,$zero`.

Evidence:
- `ovl_11_func_8010C668` (already matched) and `ovl_11_func_8011F4F4`
  (matched this session) — same instruction stream; only the link address
differs. GCC does not emit one function twice, so this is a helper copied
into two TUs, not one shared function called twice.
- `ovl_11_func_800FEAD4` (matched this session) is the third copy: same leaf
  countdown, but it reaches the `D_80075854` array through the alias
  `D_8006C838 + 0x901C` (two-stage base split `lui %hi`+`addiu %lo`, `ori
  0x901C`, `addu`) instead of declaring `D_80075854` directly — extending the
  `D_8006C838` flags/state-buffer cluster's recorded +0x8000 split-base idiom
  family (see the D_8006C838 entry) to a +0x901C member.
- The wider `D_80075854` reader set (14 functions in `ovl_11`) clusters at
  0x8010C330–0x8010C668 with stragglers 0x800CE96C and now 0x800FEAD4;
  0x8011F4F4 sits apart
  in the 0x8011F4xx span, so the copies are not link-adjacent — the
distance argues for several TUs that each carry a copy of the same helper
rather than one TU containing them.

Role (low confidence, listed only to mark the family): scan-table leaf that
counts how many of the first 99 `D_80075854` cells have a nonzero low u16;
no callers matched yet in this container (reads only `D_80075854`, with the
0x800FEAD4 copy reaching it via the `D_8006C838` two-stage base).

---

## `ovl_11` object-mode dispatch run — 0x8010CB6C–0x8010CE80 (confidence: medium)

Candidate same-TU family of `ovl_11` around the two function-pointer
dispatch tables `D_800BAA84` (sparse, 14 slots, entries `8010DD38`/`8010DA04`/
`8010DDC8`) and `D_800BAABC` (dense, 14 slots, entries 0x8010E2C4–0x8010F4CC),
both sitting adjacent in the same rodata dlabel run (2A28.rodata.s, after the
`D_800BAA34` table).

Evidence:
- shared data-table cluster: `ovl_11_func_8010CE80` (matched this session)
  reads both tables (`D_800BAA84[arg1]` handler call, `D_800BAABC[arg1]`
  presence test); `ovl_11_func_8010CD80` reads `D_800BAABC` (functions.csv).
- zero-gap link-order contiguity (map): 0x8010CB6C (0x214) → 0x8010CD80
  (0x100) → 0x8010CE80 (0xD8) → 0x8010CF58.
- call graph: 8010CB6C and 8010CD80 both call 8010CE80; the `D_800BAABC`
  handler entries (8010EB24, 8010ECC0, 8010EEE4, 8010F324, 8010F4CC) call
  8010CE80 back — a dispatcher/handler coupling. The handlers are
  link-order interleaved with unrelated functions, so their TU membership
  is not claimed here.

- ovl_11_func_8010CB6C (s) — caller of 8010CE80 (×2) and engine helpers;
  head of the gapless run
- ovl_11_func_8010CD80 (s) — reads `D_800BAABC`, calls 8010CE80 and
  8010D250
- ovl_11_func_8010CE80 (m, matched this session) — object-mode dispatcher:
  if `D_800BAA84[arg1]` is set, calls the mode handler (`s32 (*)(void*)`)
  unless the object already selected `arg1` with flag 0x800; when the
  `D_800BAABC[arg1]` handler exists and the result ≠ -1, records the
  selection (u16@0x26) and clears u16@0x28/0x2A/0x2C and flag 0x800 of
  u16@0xB8. Clean C, baseline flags (no override); the -1-guard merge shape
  (`unk26==arg1 && (unk34&0x800)` ternary-style single call site) was the
  byte-exact spelling
- ovl_11_func_8010CF58 (s) — adjacent tail, no shared data with the run
  (listed only to mark the link-order boundary)

---

## `ovl_11` keyed-table lookup run — 0x80107B54–0x80107BE4 (confidence: low)

Candidate same-TU family of `ovl_11` (`Obj\GF_FARM.bin`) at the tail of the
gapless 0x80107B54–0x80108104 map run whose other end is the D_8012D0xx
cluster head below. Evidence is zero-gap link-order adjacency plus a
caller/callee pair the call graph confirms; as elsewhere in this
absolute-addressed (-G0) overlay the data tie is a shared-private-cluster
tie, not the ASPSX definer/declarer rule.

Fingerprints:
- zero-gap link-order contiguity (map): 0x80107B54 (0x30) → 0x80107B84
  (0x60) → 0x80107BE4 (0x9C), each starting exactly where the previous
  ends; the span continues gapless through 0x80107C80 … 0x80107F58 into the
  0x80108104 head run of the D_8012D0xx section, whose member
  ovl_11_func_80107F38 writes `D_8012D044`;
- caller/callee adjacency: `ovl_11_func_80107B84` is `ovl_11_func_80107BE4`'s
  only caller and sits immediately before it;
- private data cluster: `D_801278D8` (3-entry pointer table, splat data
  `69960.data.s`, next symbol `D_801278E4`) and the records it points to
  (`D_80127890`/`D_80127898`/`D_801278A8`/`D_801278CC`, each a
  {s16,s16,s32 count,s16* list} entry with its s16 list in the same blob)
  are referenced only by `ovl_11_func_80107BE4` in the whole container.

Members (address order):
- ovl_11_func_80107B54 (m) — run head; range-check leaf on the engine s16
  `D_80070CF8` (returns 0 inside the range, 1 outside)
- ovl_11_func_80107B84 (s) — calls `ovl_11_func_80107BE4` (uses its result)
  and `ovl_11_func_800C1224`; reads the `D_8006C838` flags/state buffer
- ovl_11_func_80107BE4 (m, matched this session) — keyed-table lookup leaf:
  walks the 3-entry pointer table `D_801278D8`, matches the {s16,s16} key
  pair and positive count, then scans the entry's s16 list for arg0
  (return 1 on hit, 0 after all three entries); sole user of the
  `D_80127890`–`D_801278E4` records

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
  ovl_11_func_80108104); `D_8012D044` set-once (1-if-0) by
  ovl_11_func_80107F38 at 0x80107F38, immediately before the head run;
  same state-flag role as the head writer, absolute-`lui`+`%lo` only; `D_8012D050` (buffer/array base, address-taken by
  ovl_11_func_801081A0 and ovl_11_func_801084E0); `D_8012D052` (u16 field at
  +2 of that base, read by ovl_11_func_80108214); `D_8012D060`/`D_8012D068`/
  `D_8012D06C` (ovl_11_func_80108930), `D_8012D070` (ovl_11_func_8010A47C),
  `D_8012D084` (ovl_11_func_8010AE64);
- link-order contiguity of the head run (map): 0x80108104 (0x14) → 0x80108118
  → 0x801081A0 → 0x80108214 (0x18) → 0x8010822C, each starting where the
  previous ends; the cluster users span 0x80108104–0x8010AE64.

Members (address order, matched so far):
- ovl_11_func_80107F38 (m, matched this session) — set-once flag on
  D_8012D044 (1 if 0); shares the cluster global with the head writer
  ovl_11_func_80108104, which clears it to 0 across the boundary
- ovl_11_func_80108104 (m) — clears D_8012D040 and D_8012D044 to 0; cluster's
  confirmed writer at the run head
- ovl_11_func_80108214 (m, matched this session) — leaf probe reading u16
  D_8012D052, returns (D_8012D052 - 0x10) < 2; byte-exact clean C, baseline
  flags; the run's only confirmed reader of the +2 field
- ovl_11_func_8010822C (m, matched this session) — guarded setter writing
  D_8012D050[0] at +0/+2 (field_0/field_2): field_0 from D_801278E4[arg1]
  (+1 when arg0 > 0) or the constants 0x270/0x275, field_2 = state 4–8
  selected by arg0; first confirmed writer of the +2 field that
  ovl_11_func_80108214 probes, closing the writer/reader pair; shares the
  D_8012D050 base with ovl_11_func_801081A0, ovl_11_func_801084E0 and
  ovl_11_func_801082B0; also reads the 4-entry s16 table D_801278E4
  (0x801278E4); byte-exact clean C, baseline flags
- ovl_11_func_801082B0 (m, matched this session) — leaf setter writing the
  D_8012D050 buffer at +4/+6/+C/+E (s16 fields): maps a short pair to
  `base+4 = grid*30+col+0x277`, `base+6 = 0`, `base+C = grid*30+col+0x2EF`,
  `base+E = 1`; shares the D_8012D050 base with ovl_11_func_801081A0
  (+0/+2/+4/+6/+8/+A) and ovl_11_func_801084E0 (+8/+A); byte-exact clean C,
  baseline flags
- ovl_11_func_80108738 (m, matched this session) — three-call sequencer:
  status = ovl_11_func_8010876C(); func_80022738(); return
  func_8002261C(3, status); sits gaplessly immediately before its callee
  8010876C in link order and shares the caller ovl_11_func_80107F58 with
  cluster members 80108104/80108214/80108864; byte-exact clean C, baseline
  flags
- ovl_11_func_8010876C (m, matched this session) — signal-field dispatch leaf
  over the same D_8012D050 buffer (reads u16 @+0xA as the case index and s16
  @+8 in one arm; same +8/+A field pair as ovl_11_func_801084E0), 16-entry
  jtbl returning status codes; byte-exact clean C, baseline flags
- ovl_11_func_80108864 (m, this session) — leaf state-probe writing four s16
  fields (0/2/4/6) of D_8012D060 based on a value loaded through the
  D_8007AFF0+0x25388 pointer chain; shares the D_8012D060 global with
  ovl_11_func_80108930; byte-exact clean C

---

## `ovl_11` D_80128B50 / D_80128B5C input-state run — 0x800C0688–0x800C0EFC (confidence: medium)

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
- zero-gap link-order contiguity (map): 0x800C0688 (0x28) → 0x800C06B0
  (0x174) → 0x800C0824 (0x10) → 0x800C0834 (0x48) → 0x800C087C (0x6C) →
  0x800C08E8 (0x24) → 0x800C090C → 0x800C09D0 → 0x800C0A28 (0x18) →
  0x800C0A40 (0xC) → 0x800C0A4C (0x350) → 0x800C0D9C (0x18) →
  0x800C0DB4 (0xF0) → 0x800C0EA4 (0x58) → 0x800C0EFC (0x88) — each starts
  exactly where the previous ends, the whole span 0x800C0688–0x800C0EFC
  contiguous with no unrelated code between; the `D_80128B50` sites run out
  to the 0x800C0D9C writer, and the span now extends through the
  `D_80128A88` cluster (below) to the 0x800C0EFC remover;
- shared 50×s32 global `D_80128A88` (main RAM 0x80128A88, absolute
  `lui`+`%lo`, entry 0 = selected id, 1..49 = -1-terminated id slots):
  probed by `ovl_11_func_800C0A28` (`~arr[0] != 0`), written by
  `ovl_11_func_800C0EA4` (first `-1` slot wins, entry 0 or scan 1..0x31),
  and consumed by `ovl_11_func_800C0EFC` (removes the selected id: shifts
  entries 1..49 down one, re-terminates entry 49 with `-1`);
- callback table `D_800B7F54` (ovl_11 rodata, 10× fn-pointer, ends at the
  `jtbl_800B7F7C` label): indexed by `D_80128A88[0]` and called indirectly
  by `ovl_11_func_800C0EFC` (`sll`×4 + `jalr`); members are ovl_11
  0x800DDDB4.. handlers, one matched as plain `s32 f(void)`;
- shared s16 global `D_8006C908` (absolute `lui`+`sh`): cleared to 0 by
  `ovl_11_func_800C0EFC` when the removal fires;
- call-graph links inside the span (map): `ovl_11_func_800C0688` →
  `ovl_11_func_800C0A4C` + `ovl_11_func_800C0EFC`;
  `ovl_11_func_800C0DB4` → `ovl_11_func_800C0EA4`.

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
- ovl_11_func_800C0688 (m) — two-call dispatcher: runs
  `ovl_11_func_800C0A4C` then `ovl_11_func_800C0EFC`; sits immediately
  before 0x800C06B0 in link order
- ovl_11_func_800C0DB4 (s) — button-state reader (D_80070CF0–CFA `lh`s)
  that calls `ovl_11_func_800C0EA4` to register the id it selects
- ovl_11_func_800C0EA4 (m) — id registrar: `D_80128A88` entry 0, else the
  first `-1` slot among entries 1..0x31
- ovl_11_func_800C0EFC (m, matched this session) — id remover: when
  `D_800B7F54[D_80128A88[0]]()` returns nonzero, clears `D_8006C908`,
  shifts the id table down one slot and re-terminates entry 49 with `-1`;
  byte-exact clean C, baseline flags

---

## `ovl_11` D_80122F0C 3×s16 lookup-table run — 0x800C1224–0x800C141C (confidence: medium)

Candidate same-TU family of `ovl_11` (`Obj\GF_FARM.bin`): one unbroken
link run whose members reference the single shared 6-byte {s16,s16,s16}
table `D_80122F0C` (stride 6, offsets 0/2/4) built with the same absolute
`lui`+`addiu %lo` base.

Fingerprints:
- **gapless contiguous run**: 0x800C1224 (0x5C, ends exactly at 0x800C1280)
  → 0x800C1280 (0x5C, ends exactly at 0x800C12DC) → 0x800C12DC (0x140, ends
exactly at 0x800C141C) → 0x800C141C.
- **byte-exact twin leaves**: `ovl_11_func_800C1224` and `ovl_11_func_800C1280`
  (both matched — 800C1280 this session) are the same counter/pointer lookup
  leaf (s16-sign-extend args, `lh`@0/`lh`@2 inner compare, `return i+1`/0) over
  the same table — identical instruction stream except the loop bound
  (`slti 0xE` signed 14 vs `sltiu 0x12` unsigned 18) and compare form — and
  800C1280's byte-exact C is the 800C1224 template with the counter `u32` and
  the bound 18 (`arg0 == D_80122F0C[i].unk0 && arg1 == D_80122F0C[i].unk2`,
  `UnkStruct800C1280` {s16,s16,s16}), confirming the run's shared-TU family.
- **third reader**: 800C141C (stub) loads `&D_80122F0C`
  (`lui %hi`+`addiu %lo`) and passes it as a call argument.

Members (address order):
- ovl_11_func_800C1224 (m, matched this session) — leaf lookup: returns
  index+1 of the `D_80122F0C[i]` entry whose s16@0 == arg0 and s16@2 ==
  arg1, else 0
- ovl_11_func_800C1280 (m, matched this session) — twin leaf lookup over 18
  entries (`sltiu 0x12`), byte-exact
- ovl_11_func_800C12DC (s) — no D_80122F0C reference; sits in the run
- ovl_11_func_800C141C (s) — passes `&D_80122F0C` to a callee

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
- ovl_11_func_800DD8AC (m, matched this session) — cell A head (0x58): clears
  D_80129198, writes D_80129194; walks the shared 0x30-stride D_80128E08 array
  (same base as ovl_11_func_800DC9D4/800DCBDC/800DCC1C), clearing the matched
  entry's unk10/12/14 fields and recording its pointer; byte-exact clean C,
  baseline flags
- ovl_11_func_800DD904 (s) — cell A middle (0xEC): reads D_80129194 and
  D_80129198, writes/clears D_80129198
- ovl_11_func_800DD9F0 (m, matched) — cell A tail probe: leaf
  `return D_80129198 == 2;`
- ovl_11_func_800DDA08 (m, matched this session) — cell B head (0x58):
  mirror of 800DD8AC; clears D_801291A0, writes D_8012919C; byte-exact
  clean C, baseline flags, same 0x30-stride D_80128E08 scan as cell A head
  differing only in bit mask (0x20 vs 0x40) — confirms the mirror-cell hypothesis
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
- ovl_11_func_801037EC (m, matched this session) — clears D_80127428 and
  D_8012742C to 0 plus the `D_8012CF10`/`D_8012CF1C`/`D_8012CF24` data group
  (s16[0..5] clear loop + two singleton zeroes; first matched reference to the
  `0x8012CFxx` region below the `D_8012CF48` table); the run's reset
- ovl_11_func_80103830 (s) — calls ovl_11_func_801037EC, then sets
  `D_80127428 = 1` and calls func_8001FABC(3); the run's setter
- ovl_11_func_801038E4 (s) — leaf reader of D_80127428
- ovl_11_func_80103964 (s) — reads/writes D_80127428 at 8 sites; the run's
  mutator
- ovl_11_func_80103B24 (m) — leaf reader of D_80127428; updates the
  D_8006C838 work area and copies six D_8012CF10 halfwords. Its byte-exact
  source requires `-fno-cse-skip-blocks` to preserve distinct sign-guarded
  read-modify-write arms on the same field. Matched cluster members
  ovl_11_func_801037EC and ovl_11_func_80104394 remain byte-exact when
  compiled with that flag; no same-group flag contradiction was observed.
- ovl_11_func_801040A8 (s) — trailer reader of D_80127428

Widening (2026-09-14, byte-exact match of `ovl_11_func_80104394`): the run's
buffer consumer is now matched. `ovl_11_func_80104394` (m, 0x80104394, 0x84,
leaf) reads the exact `D_8012CF10[0..5]` window that member `ovl_11_func_801037EC`
clears, and both of its callers — `ovl_11_func_80103C00` (0x80103C00) and
`ovl_11_func_80103D44` (0x80103D44, two call sites) — are link-contiguous
members of this cluster's zero-gap span. `ovl_11_func_80104394` itself sits
address-apart (0x80104394, past the run trailer 0x801040A8) and touches none
of D_80127428/2C, so its TU membership with the cluster is supported by the
caller adjacency + shared 6-halfword buffer but unproven. Additional tie: the
parked stub `ovl_11_func_80103770` (0x6C, gapless predecessor of the run head
0x801037DC) is this function's idiom twin — identical `+0xE514` select (default
2 when the halfword == 3) and `base + 0xE522 + sel * 0x54` table walk with 6
s16 at +0xE stride — summing (returns sum == 0) where 80104394 compares
(returns all-equal). Its non-matching C and the byte-exact 80104394 spelling
are the two witnesses for how this author forms that large-offset table
address (indexed member access, not precomputed pointer arithmetic).

Widening (2026-09-15, byte-exact match of `ovl_11_func_801047FC`): the record
region's initializer is now matched. `ovl_11_func_801047FC` (m, 0x801047FC,
0x9C, void leaf) zero-gaps after parked stub `ovl_11_func_8010476C` and is
called only by `ovl_11_func_801044E4` (s, immediately link-preceding). Same
D_8006C838 shared-global-cluster fingerprint: absolute-addressed
`(View *)&D_8006C838` view with the identical `ori 0x8000 + addu` large-offset
formation as 80104394, plus one far store through the
`char *far_base = (char *)&D_8007AFF0` idiom (s32 at +0x2549C). Data-boundary
tie: it writes the five 0xC-stride s16 records at +0xE4D8 (fields +0/+8/+A set
to -1) — the table ends exactly at +0xE514, the select halfword 80104394 reads
and 80103770 walks — an initializer/consumer tie on one data region, so it
extends this TU family past the 0xE514 boundary; membership in the
D_80127428 run itself remains unproven (touches none of D_80127428/2C).

Widening (byte-exact match of `ovl_11_func_80104418`): the run's accumulator
mutator is now matched. `ovl_11_func_80104418` (m, 0x80104418, 0xCC, void leaf)
is called only by `ovl_11_func_80103C00` — the same link-contiguous cluster
member that also calls matched member `ovl_11_func_80104394` — and it
read-modify-writes `D_8012CF20` (s32, absolute `lui`+`%lo`, main RAM), a new
site in the `0x8012CFxx` region this cluster already ties to via
`ovl_11_func_801037EC`'s clear and `ovl_11_func_80104394`'s read. Role: a
rate-limited s16 setter — it clamps `*arg1 + arg0` against a limit derived
from `old + D_8012CF20 / 50` (clamped 0..99), stores one of `0` / `limit` /
`new` into `*arg1` (wrap-at-endpoint semantics on both sides), then transfers
the accumulator by 50 per unit of change (`D_8012CF20 += old*50; -= *arg1*50`).
It sits zero-gap between matched member `ovl_11_func_80104394` (ends
0x80104418) and parked stub `ovl_11_func_801044E4`; TU membership with the
D_80127428 run itself remains unproven (touches none of D_80127428/2C).

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

## `ovl_11` tier-lookup leaf + `/60` clamp run — 0x800CD4E4–0x800CD670 (confidence: low)

Unbroken link-contiguous run 0x800CD45C→0x800CD4E4→0x800CD534→0x800CD578→
0x800CD5BC→0x800CD624→0x800CD670 (each ends exactly where the next begins).
Head 0x800CD4E4 is a global-free tier-return leaf whose sole caller,
0x800CD624, sits in the same run 0xF0 later (a same-run call edge) — but
0x800CD624 is a different caller than the recorded `/60` clamp-scaled pair
0x800CD534/0x800CD578 (whose caller is 0x800CCCC0), so same-TU membership
with the pair is unproven.
Members:
- ovl_11_func_800CD4E4 (m, matched this session, 0x50, byte-exact) — reads
  s16 at arg0+0x16 and maps thresholds 0x32/0x46/0x50/0x64 to 0/0x78/0xF0/0x168
- ovl_11_func_800CD534 / 0x800CD578 (m) — recorded `/60` clamp-scaled leaves
- ovl_11_func_800CD5BC (m, matched this session, 0x68, byte-exact) — the run's
  gapless tail: a global-free leaf guarding u16@+0x36 bit 8, then a magic-constant
  `/5` divide index into the `D_80071A00`-object u16 array @+0x40 and a saturating
  `+=arg1` write (clamped at 0xFFFF) through the same subscript — shares the
  magic-constant-division leaf idiom with the pair but its callers are the
  dispatch-caller run 0x800C4A2C–0x800C55FC / 0x800C580C, not 0x800CCCC0, so
  same-TU membership stays unproven (low)
- ovl_11_func_800CD624 (s) — same-run direct caller of 0x800CD4E4

---

## `ovl_11` D_800742EC 0xB4-struct-array scan/count/init run — 0x800D0CD8, 0x800E20B8, 0x800E2934 / 0x800E2968 (confidence: low)

Zero-gap link-order adjacency (0x800E2934, 0x30 bytes, ends exactly at
0x800E2968) over the same 0xB4-byte struct array whose base global is
`D_800742EC` (absolute-addressed main-RAM array, also walked by main-binary
`func_8001A790` at +0xB4 stride). 0x800E2934 scans the array for the index of
a given struct pointer and returns it or -1 (index value living in the `beq`
delay slot); 0x800E2968 immediately follows and initializes one such 0xB4-byte
struct (`memset 0xB4`, field writes at 0x0/0x1A/0xB0). A shared caller
`ovl_11_func_800E1F9C` invokes both back-to-back on the same struct pointer
(`jal 800E2934` then `jal 800E2968` with `a0 = s0`), consistent with one
owner allocating an array entry by index then initializing it. The same
0xB4-stride family is link-adjacent to that owner: `ovl_11_func_800E1F9C`
(0x11c) ends exactly at `ovl_11_func_800E20B8` (0x38), which ends exactly at
`ovl_11_func_800E20F0`.
0x800D0CD8 (matched 2026-09-15) joins the same array family: it is the
find-first-free scan over the same `D_800742EC` 0xB4-stride array (5/10
entries selected by `D_80070D0A`), shares the caller `ovl_11_func_800E1F9C`
with 0x800E2934/0x800E2968, and its source is the same find-first-free
construction as 0x800D0C34's (`u16@+0 == 0 && !(u32@+0x34 & 0x02000000)`) —
zero-gap link-adjacent to that D_800749F4 accessor. Idiom-template kinship
plus the shared array and caller, not adjacency, put it in this group.
Members:
- ovl_11_func_800E2934 (m, matched this session) — array index lookup: returns
  the 0-based index of `arg0` within the `D_800742EC` 0xB4-stride array, or
  -1 after 10 entries
- ovl_11_func_800E2968 (s) — initializes one 0xB4-byte entry (memset 0xB4,
  `sh` at 0x0/0x16/0xB0, bits at 0x1A–0x21, calls 0x800E2A30 / 0x80107DD0)
- ovl_11_func_800E20B8 (m, matched this session) — counts how many of the 10
  `D_800742EC` 0xB4-stride entries have a non-zero u16 at 0x0 (the same field
  the initializer `sh`s), returns the count; leaf, no callers in the overlay
- ovl_11_func_800D0CD8 (m, matched 2026-09-15) — find-first-free entry over
  the same array: scans up to 5/10 (D_80070D0A-selected) records for
  `u16@+0 == 0 && !(u32@+0x34 & 0x02000000)`, returns the entry pointer or
  NULL; same accessor role for D_800742EC that 0x800D0C34 plays for
  D_800749F4

---

## `ovl_11` D_8006C838 flag-byte writer/reader pair — 0x800D0EA4 / 0x800D0ED0 (confidence: medium)

Zero-gap link-order adjacency (0x800D0EA4, 0x2C bytes, ends exactly at
0x800D0ED0) and a shared rare codegen idiom argue one TU. Both take the same
`arg1 == 1` predicate over the same two byte flags at `D_8006C838 + 0x4AC0` /
`+ 0x4AD6`, index them by the same runtime `arg0`, and compile to the same
per-arm two-step address formation: `lui %hi(D_8006C838)` hoisted into the
branch delay slot, per-arm `addiu %lo(D_8006C838)` + `addu v0,v0,a0`
(base-first), constant as the `sb`/`lbu` displacement. The base-first
`addu v0,v0,a0` with a runtime index is unusual for this toolchain (CSE
reverses it unless the base is materialized in two steps); the pair shares it.
The writer was matched this session (clean C, baseline flags).
Members:
- ovl_11_func_800D0EA4 (m, matched this session) — writer: stores 1 at the
  selected flag byte
- ovl_11_func_800D0ED0 (m, matched this session, 0x50 byte-exact) — reader:
  returns `flag != 0` for the selected byte, with the same base-first
  `addu v0,v0,a0` two-step address formation and shared-`return 0` tail
- ovl_11_func_800F3D40 (m, matched this session, 0x48 byte-exact) — clears
  both byte arrays in one leaf: countdown do-while zeroes the 22 bytes
  [0x4AC0,0x4AD6) from array A and the 10 bytes [0x4AD6,0x4AE0) from array B,
  each as an independent `lui %hi(D_8006C838)`/`addiu %lo`/`addiu offset`
  preheader; carries per-TU `-fno-gcse` (probe matrix 18/18 vs baseline 3/18 —
  without it gcse/cse2 collapse the two offsets or merge the shared high
  halves, provably unreachable from any clean C spelling)

---

## `ovl_11` D_80075854 4-byte-cell-array run — 0x8010C330–0x8010C668 (confidence: medium)

Candidate same-TU family of `ovl_11` (`Obj\GF_FARM.bin`) sharing the private
`D_80075854` cell array (4-byte cells, low s16 live, undefined symbol at
0x80075854, no other TU references it). Evidence is a shared global cluster
plus zero-gap link-order contiguity (0x8010C330 → 0x8010C3C4 → 0x8010C3F8),
and the caller `ovl_11_func_800CE96C` also indexes the array. The far
offset `D_8006C838 + 0x99E4` store uses the same `base+0x8000` ori/addu
split as matched sibling `ovl_11_func_800D12A0` (0x99E6, previous section).

Members (address order):
- ovl_11_func_8010C330 (s) — read-iterator over the array: lhu + addiu +4
  stride, count 0x63, guards on `D_80070D3C`
- ovl_11_func_8010C3C4 (m) — leaf countdown clear of every cell's u16@0
  (0x62→0 inclusive, 99 cells), then zeroes s16 at `D_8006C838`+0x99E4
- ovl_11_func_8010C3F8 (s) — sibling clear/set writing u16@+2 per cell
  (same 0x62 count), calls `ovl_11_func_8010C5A0`, also touches
  `D_8006C838`; link-immediate successor of 0x8010C3C4
- ovl_11_func_8010C550 (m, matched this session) — leaf switch writing a
  cell's u16@2 from the id (0xA1→0x14, 0xA2→0xA, 0xA3→0), the exact
  inverse of grader 0x8010C5A0's (u16@2→u16@0: <10→0xA3, <20→0xA2,
  else→0xA1); shares the private `Cell4` type, direct callee of
  0x8010C330 (which stores the id at u16@0 then calls it), and is the
  gapless link predecessor of 0x8010C5A0 (0x8010C550+0x50 = 0x8010C5A0)
- ovl_11_func_8010C5A0 (m, matched this session) — leaf grader rewriting a
  cell's u16@0 (0xA3 / 0xA2 / 0xA1) from its u16@2 (< 10 / < 20 / else,
  unsigned); shares the `Cell4` type, sole caller 0x8010C3F8 (which
  increments the cell's u16@2 then calls it), sibling 0x8010C5DC called
  right after
- ovl_11_func_8010C668 (m, matched this session) — read-and-count iterator:
  lhu u16@0 of each cell, same hand-written 0x62→0 countdown (99 cells),
  counts nonzero cells, returns the count; shares the private `Cell4`
  struct/countdown idiom with 0x8010C3C4, called by 0x8010C330 / 0x8010C3F8

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
- register-capture quirk crossing the run boundary: ovl_11_func_800D1CD0
  (matched, this session) is byte-identical to ovl_11_func_800D0600 (~0xC80
  earlier; parked), both leaves fold a two-index compare to {0,1,2} and both
  open with the dead `sw $v0, 0($sp)` hard-`$v0` capture, and both callers
  (800D1CFC here, 800D062C there) seed `$v0 = $sp + 0x10` before every call
  — the v0-channel/static-chain fossil shared cluster, same family signature
  as func_8001E878/E9F8/EAE4 (see notes/research/
  func_8001EAE4-v0-channel-delay-slot-fossil.md).

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
- ovl_11_func_800D1CD0 (m, matched this session) — v0-channel rank-compare
  leaf; byte-identical to the parked ovl_11_func_800D0600; does not touch the
  global (CAPTURE_PREV_RET clean C)
- ovl_11_func_800D1CFC (s) — reads D_80123754 (`lh`), the run's getter;
  caller of 800D1CD0, seeds $v0 with $sp+0x10 before each call
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
- ovl_11_func_800D3D2C (m, matched this session) — state-code helper: returns
  0x13 when engine s16 `D_80070CF8` < 7 or struct field +0xAC <= 0, else 0x14
  (reads `lh` at +0xAC — same object struct field as cluster mate 800D3FEC);
  called by the dispatch function `ovl_11_func_800D3468`, which dispatches on
  the struct's id field (+0) and also calls ovl_11_func_800D3C04/3CA4/3C54/3CE8
  then ovl_11_func_800D3104 — a shared dispatch-caller ties this run together;
  also reads `D_80070CF8`, the same absolute-addressed engine s16 as
  ovl_11_func_80107B54 (weak, engine-owned global)
- ovl_11_func_800D3FEC (s) — reads D_80128D78 (`lhu`), subtracts it from a
  struct field +0xAC and clamps non-negative
- ovl_11_func_800D55F8 (s) — reads D_80128D7A (`lhu`) into struct field +0x22;
  calls ovl_11_func_800D12B8

---

## `ovl_11` D_80128CD0 coord-set run — 0x800CE210–0x800CE37C (confidence: medium)

Candidate same-TU family of `ovl_11` (`Obj\GF_FARM.bin`) sharing the adjacent
main-RAM globals `D_80128CD0` / `D_80128CE0` / `D_80128CEC` (0x80128CD0,
0x80128CE0, 0x80128CEC).

Fingerprints:
- caller/callee + shared global cluster: `ovl_11_func_800CE210` calls
  `ovl_11_func_800CE2EC` with `$a0 = &D_80128CD0`; the callee fills fields
  +0/+4/+8 of that struct from the 3-entry s16-pair table `D_801232BC` (its
  only referencing function in the container, a private table), and the caller
  then keeps updating `D_80128CD0` (+0 −= 0x226, +4, +8) and `D_80128CE0`
  and clears `D_80128CEC`;
- zero-gap link-order contiguity (map): 0x800CE210 (0xDC) → 0x800CE2EC
  (0x90) → 0x800CE37C, each starting exactly where the previous ends; the
  successor `ovl_11_func_800CE37C` likewise touches `D_80128CEC`.

Members (address order):
- ovl_11_func_800CE210 (s) — init/update of the D_80128CD0/D_80128CE0 state
  pair and the D_80128CEC flag; calls 0x800CE2EC to (re)fill the D_80128CD0
  coordinate triple
- ovl_11_func_800CE2EC (m, matched this session) — leaf selector: switch on
  the state u16 behind the `D_8007AFF0+0x25388` pointer (+4 field, cases
  0x50–0x5B) picks row 0/1/2 of table `D_801232BC`, writes `{row.f0, 0,
  row.f1}` to `D_80128CD0` +0/+4/+8 and returns `row.f1`
- ovl_11_func_800CE37C (s) — larger setup body over `D_80128CEC` and
  `D_8006C838`; link successor of the run

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

## `ovl_11` 3-halfword vector setter/clear/copy family — 0x800D72E8–0x800D740C (confidence: medium)

Candidate same-TU family of `ovl_11` (`Obj\GF_FARM.bin`): four tiny functions
over one 6-byte struct of three u16 fields at +0/+2/+4, in a strict zero-gap
link-order run. Same shared-idiom + zero-gap fingerprint class as the
documented short-fold helper trio / s16-pair setter pair.

Fingerprints:
- shared 6-byte struct idiom: `ovl_11_func_800D7328` clears fields +0/+2/+4
  to 0 (`sh $zero` ×3); `ovl_11_func_800D7338` stores three incoming u16
  args to +0/+2/+4 (`sh $a1/$a2/$a3`); `ovl_11_func_800D7348` copies three
  u16 from src to dst (`lhu`+`sh` ×3) — one 3-halfword vector handled three
  ways, clear / set-from-args / copy;
- zero-gap link-order contiguity (map): 0x800D72E8 (0x40) → 0x800D7328
  (0x10) → 0x800D7338 (0x10) → 0x800D7348 (0x24) → 0x800D736C (0xA0), each
  starting exactly where the previous ends, the span 0x800D72E8–0x800D740C
  contiguous with no unrelated code between;
- call-graph tie: `ovl_11_func_800CBB9C` and `ovl_11_func_800CB6C8` call
  `ovl_11_func_800D7328` then `ovl_11_func_800D7348` back-to-back on the
  same pointer (`addu $a0, $s1`) — a reset-then-copy-in pattern on one
  vector, consistent with all three helpers living in one file.

Members (address order):
- ovl_11_func_800D72E8 (m, matched this session) — s16 accumulator clamp:
  `s32 f(arg0, s16 arg1)` reads field +4 as u16 (`lhu`), adds the sign-extended
  arg1, writes the sum back, and returns 1 when the `(s16)` sum equals 0 else
  0, storing -1 back to field +4 when the sum is negative; clean C baseline
  flags, byte-exact; the run's clamp member
- ovl_11_func_800D7328 (s) — leaf clear: all three u16 fields to 0
  (`sh $zero` ×3, delay-slot third store)
- ovl_11_func_800D7338 (s) — leaf setter: three u16 fields from three args
  (`sh $a1/$a2/$a3`, delay-slot third store)
- ovl_11_func_800D7348 (m, matched this session) — leaf copy: three u16
  from src to dst (`dst[i]=src[i]` for i 0..2, `lhu`+`sh` ×3, final store in
  the jr delay slot); byte-exact clean C `void f(u16 *dst, u16 *src)`,
  baseline flags; the run's copy member
- ovl_11_func_800D736C (m, matched this session) — item-table status
  classifier: `s32 f(s16 *arg0)` reads index `*(s16*)arg0`, tests
  `D_8006C858[h].u0.flags` (lhu) bits 0x400/0x1800/0x40/0x100 → 4/3/1/0, then
  `h ∈ {0x65,0x3F,0x3A,0x3E,0x64}` → 5, else 2; byte-exact clean C, baseline
  flags. Its idiom belongs to the D_8006C858 accessor cluster (see that
  entry), not the 3-halfword vector idiom of this run — it joins the run on
  zero-gap adjacency alone, so if one TU holds the whole 0x800D72E8–0x800D740C
  span, that file mixes vector helpers with an item-table accessor.

---

## `ovl_11` s16 range-check predicate trio — 0x800D7504 / 0x800D753C / 0x800D756C (confidence: low)

Candidate same-TU family of `ovl_11` (`Obj\GF_FARM.bin`): three zero-gap
link-contiguous range-check predicates, byte twins except for constants (the
head carries a second equality check). Same shared-idiom fingerprint class as
the documented short-fold helper trio (s16 sign-extend `sll`/`sra` + folded
`addiu`/`sltiu` range probe).

Fingerprints:
- shared idiom: all three are `s32 f(s16 arg0)` returning 1 when
  `(u32)(arg0 - C) < 3U || arg0 == E` else 0, with 0x800D7504 adding a second
  equality (`|| arg0 == E2`) — identical instruction shapes (`sll`/`sra`
  sign-extend, `addiu -C`, `sltiu 3`, `bnez` on the probe,
  `addiu E`/`bne` equality, twin `jr` returns of 1/0), differing only in the
  constants (0x122/0xE8/0x125 at 0x800D7504, 0x8B/0xE3 at 0x800D753C,
  0x91/0xE7 at 0x800D756C);
- zero-gap link-order contiguity (map): 0x800D7504 (0x38) → 0x800D753C
  (0x30) → 0x800D756C (0x30), each starting exactly where the previous ends,
  one unbroken run ending at 0x800D759C with no unrelated code between;
- 0x800D7504's ids 0xE8/0x122–0x124 overlap the id set (0x64/0x65/0xE8/0x121–
  0x124) the documented spawn-record dispatch tail 0x800F43CC switches on
  (low-confidence cross-link).

Members (address order, all matched, baseline flags):
- ovl_11_func_800D7504 (m, matched this session) — `(u32)(arg0 - 0x122) < 3U
  || arg0 == 0xE8 || arg0 == 0x125`; the run's head, matched via the pair's
  idiom extended by one equality
- ovl_11_func_800D753C (m) — `(u32)(arg0 - 0x8B) < 3U || arg0 == 0xE3`
  (`sll`/`sra`/`addiu`/`sltiu`/`bnez`/`bne` shape)
- ovl_11_func_800D756C (m, matched 2026) — `(u32)(arg0 - 0x91) < 3U
  || arg0 == 0xE7`, byte twin of 0x800D753C; the run's third member

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

## `ovl_11` 0x18-byte spawn-record fill/clear/dispatch run — 0x800F4360–0x800F43CC (confidence: low)

Candidate same-TU family of `ovl_11` (`Obj\GF_FARM.bin`) — three
link-contiguous functions that are complementary writers of one 0x18-byte
record (s16@0, s16@2, bit-0 flag s16@4, s32@8, s32@C, s32@10), with the run
tail dispatching into the run head.

Fingerprints:
- link-order adjacency: `ovl_11_func_800F4360` (0x30) ends exactly at
  `ovl_11_func_800F4390` (0x3C) ends exactly at `ovl_11_func_800F43CC` —
  one unbroken contiguous run (map 0x800f4360/0x800f4390/0x800f43cc);
- call graph agrees: run tail `ovl_11_func_800F43CC` direct-calls the run
  head `ovl_11_func_800F4360`; `ovl_11_func_800F4390` is
  independently called by `ovl_11_func_800F42A8` (nearby) and 0x800E5230;
- struct-shape kinship: the two leaves touch the identical offset set —
  `ovl_11_func_800F4360` fills 0/2/8/C/10 and `ori`s bit 0 of @4,
  `ovl_11_func_800F4390` zeroes 0/2/8/C/10 and `andi`s bit 0 of @4,
  stepping +0x18 over an array — set vs clear of the same flag word by the
  record's two writers;
- `ovl_11_func_800F43CC` selects a target record within
  `D_8006C838`+0x8000+0x5DCC/0x5DD4 (main-RAM entity pool; absolute-addressed
  `lui`+`%lo` like the D_8006C838 flag/state cluster), reading a by-value
  3-word vector from its own args and an s16 selector from 0x3C($sp).

Members (address order):
- ovl_11_func_800F4360 (m, matched this session) — spawn-record fill leaf:
  s16@0/2 from args, bit 0 of s16@4 set (`lhu`/`ori 1`/`sh`), by-value
  `Vec3` copied into s32@8/C/10; sole caller the run tail 0x800F43CC; the
  by-value-`Vec3` + flag-OR struct write matches the matched 0x800D05D0
  idiom family
- ovl_11_func_800F4390 (m, matched this session) — spawn-record clear leaf: loops the 0x18-byte
  record zeroing 0/2/8/C/10 and AND-clearing bit 0 of @4; called by
  0x800F42A8/0x800E5230; count-up loop reversed by check_dbra_loop (latch
  at body head, stride addiu in the tail delay slot); record stride 0x18
  confirms the 0x18-byte family size
- ovl_11_func_800F43CC (s) — spawn-record dispatch switch on ids 0x64/0x65/
  0xE8/0x121–0x124: computes the target from the `D_8006C838`+0x8000 entity
  base and calls the run-head leaf 0x800F4360; itself called by
  0x800CC7CC/0x800E21E4/0x800C580C/0x8011C298/0x8010B05C

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
  C, baseline flags; adjacent-sibling writer of the cluster's other global.
  Widening (2026-10-03): its clear counterpart `ovl_11_func_80111E38`
  (zeroes D_80070D10/D_80070D12/D_800719FE) is matched and link-adjacent
  (one function between, zero-gap run) — see the D_80070D10/D_800719FE
  reset-run entry, which upgrades this tie from far-sibling to same-run.

---

## `ovl_11` D_80070D38/3A/3E/40 adjacent-u16 counter-leaves — 0x800F3898 / 0x800F3950 / 0x800F397C / 0x800F3A18 / 0x800F3A44 / 0x800F3AC4 / 0x800F3AF0 / 0x800F3BA0 (confidence: low)

Candidate same-TU family of `ovl_11` (`Obj\GF_FARM.bin`): Four matched leaf helpers with **numerically byte-identical bodies** (decrement-counter
family) plus three increment+clamp leaves sharing the same global cluster (one per
written global, D_80070D38, D_80070D3A, D_80070D3E and D_80070D40, built from the
same switch+clamp construction). The four
decr helpers differ only in which adjacent file-scope global they decrement — the
identical-body fingerprint class proven by the short-fold helper trio / reset-stub
family. They touch the globals immediately above the documented D_80070D0E cluster
in the same main-RAM data run (0x80070D0E, 0x80070D10, 0x80070D38, 0x80070D3A,
0x80070D3E, 0x80070D40).
All are extern-referenced with absolute `lui`+`%lo` (defining TU elsewhere);
function addresses span ~0x250 in total, not link-order adjacent, so same-TU is
plausible rather than established — though all eight members now form a
gapless link run 0x800F3898–0x800F3BA0 (see members). The four
decr helpers differ only in which adjacent file-scope global they decrement — the
identical-body fingerprint class proven by the short-fold helper trio / reset-stub
family. They touch the globals immediately above the documented D_80070D0E cluster
in the same main-RAM data run (0x80070D0E, 0x80070D10, 0x80070D38, 0x80070D3A,
0x80070D3E, 0x80070D40).
All are extern-referenced with absolute `lui`+`%lo` (defining TU elsewhere);
function addresses span ~0x250 in total, not link-order adjacent, so same-TU is
plausible rather than established.

Fingerprints:
- **identical-body quadruplets over adjacent globals**: `ovl_11_func_800F3950`
  (matched this session), `ovl_11_func_800F3A18` (matched earlier),
  `ovl_11_func_800F3AC4` (matched this session) and `ovl_11_func_800F3BA0`
  (matched earlier) compile to the same 0x2C-byte body — `lui`+`lhu` the
  global, `sltu` against masked arg0, branch into the decrement-and-`sh` path
  (`return 1`), fall to `return 0` — differing only in the `%lo` global
  displacement;
- **shared increment+clamp idiom**: `ovl_11_func_800F3898`,
  `ovl_11_func_800F397C`, `ovl_11_func_800F3A44` and `ovl_11_func_800F3AF0` are
  structural twins — `u16 *p = &global;` switch on arg0 with case bodies over
  the global and the default through `*p`, then a `v = *p; if (v > 999) v =
  999; *p = v;` clamp tail compiling to the same
  `sltiu`/conditional-register-select/`sh`-in-delay-slot tail;
- **gapless run**: 0x800F3898 (0xB8) ends exactly at 0x800F3950 (0x2C), which
  ends exactly at 0x800F397C (0x9C), which
  ends exactly at 0x800F3A18 (0x2C), which ends exactly at 0x800F3A44 (0x80),
  which ends exactly at 0x800F3AC4 (0x2C), which ends exactly at 0x800F3AF0
  (0xB0), which ends exactly at 0x800F3BA0 (0x2C) — the address-adjacency
  fingerprint holding across all seven members;
- **adjacent file-scope globals** `D_80070D38` (0x80070D38), `D_80070D3A`
  (0x80070D3A), `D_80070D3E` (0x80070D3E) and `D_80070D40` (0x80070D40),
  sitting immediately above `D_80070D10` in the already-documented D_80070D0E
  data region — the adjacent-file-scope vars fingerprint extending that
  cluster's run;
- shared semantics: each decrement helper is `if (current >= arg0)
  { current -= arg0; return 1; } return 0;` over a scalar u16 counter;
  the increment+clamp leaf `ovl_11_func_800F3A44` writes to the same global
  `D_80070D3E` through a switch dispatch (increment on case 0/default,
  add-arg1 on case 1) then clamps to 999; likewise `ovl_11_func_800F3AF0`
  writes to the same global `D_80070D40` that `ovl_11_func_800F3BA0`
  decrements (case 1 +=10, case 0 ++, case 2 +=arg1, default ++ through `*p`,
  then clamp to 999), so each of the run's counters D_80070D38, D_80070D3A,
  D_80070D3E and D_80070D40 now has both its decrement helper and its
  increment+clamp leaf in the family.

Members (address order):
- ovl_11_func_800F3898 (m, matched this session) — increment+clamp leaf over
  D_80070D38 (the same global 800F3950 decrements): switch on arg0 (0,1→++,
  2→+=6, 3→+=arg1, default→++ through `*p`), then clamp to 999; 0xB8 bytes, no
  calls, no frame; sits directly before 0x800F3950, extending the gapless run
  to 0x800F3898–0x800F3BA0 across all eight members
- ovl_11_func_800F3950 (m, matched this session) — decrement-counter helper
  over D_80070D38: `current = D_80070D38; if (current < arg0) return 0;
  D_80070D38 = current - arg0; return 1;` (8 words, `lui`/`lhu`/`andi`/
  `sltu`/`bnez`/`subu`/`sh`/`li`, no calls, no frame); byte-exact clean C,
  baseline flags; the run's first counter, at 0x800F3950
- ovl_11_func_800F3A18 (m, matched earlier) — decrement-counter helper over
  D_80070D3A; byte-identical body to the triplet
- ovl_11_func_800F397C (m, matched this session) — increment+clamp leaf over
  D_80070D3A (the same global 800F3A18 decrements): switch on arg0 (0,1→++,
  2→+=arg1, default→++ through `*p`), then clamp to 999 through the `p` pointer;
  0x9C bytes, no calls, no frame; sits directly between 0x800F3950 and
  0x800F3A18 in the gapless run
- ovl_11_func_800F3BA0 (m, matched earlier) — decrement-counter helper over
  D_80070D40; byte-identical body to the quadruplet, the run's other counter
- ovl_11_func_800F3AC4 (m, matched this session) — decrement-counter helper
  over D_80070D3E; byte-identical body to the quadruplet, the fourth member
- ovl_11_func_800F3AF0 (m, matched this session) — increment+clamp leaf over
  D_80070D40 (the same global 800F3BA0 decrements): switch on arg0 (0→++,
  1→+=10, 2→+=arg1, default→++ through `*p`), then clamp to 999; 0xB0 bytes,
  no calls, no frame; sits directly between 0x800F3AC4 and 0x800F3BA0,
  completing the run's address order
- ovl_11_func_800F3A44 (m, matched this session) — increment+clamp leaf over
  D_80070D3E (the same global 800F3AC4 decrements): switch on arg0 (0→++,
  1→+=arg1, default→++ through `*p`), then clamp to 999; 0x80 bytes, no calls,
  no frame; sits between 0x800F3A18 and 0x800F3AC4 in address order

---

## `ovl_11` D_80070D04 button-byte bit-test run — 0x80100A8C–0x80100FFC (confidence: low)

Candidate same-TU family of `ovl_11` (`Obj\GF_FARM.bin`): the link-contiguous
run whose members read the base-engine byte `D_80070D04`. Function addresses
form an unbroken gapless run — 0x80100A8C (0xC4) ends exactly at 0x80100B50
(0x318) which ends exactly at 0x80100E68 (0x50) which ends exactly at
0x80100EB8 (0xE4) which ends exactly at 0x80100F9C (0x60) which ends exactly
at 0x80100FFC (0x4A8) — and both direct callers of `ovl_11_func_80100E68`
(0x80100A8C, 0x80100B50) are the run's immediate link predecessors, so call
graph and link order agree. `ovl_11_func_80100E68` and its immediate link
successor `ovl_11_func_80100FFC` both `lbu D_80070D04` through the same
absolute `lui`+`lbu %lo` base and test bits of that byte (`and`/`andi` +
`beqz`/`bnez`), the same button-state probe idiom, widening the recorded
`D_80070D0E`/`D_80070D38/3A/40` cluster's data region reader family to
`D_80070D04`.

Members (address order):
- ovl_11_func_80100A8C (s) — direct caller of 0x80100E68
- ovl_11_func_80100B50 (s) — direct caller of 0x80100E68
- ovl_11_func_80100E68 (m, matched this session, 0x50, byte-exact) — button-bit
  probe leaf: `if (arg0 < 0x80) return (D_80070D04 & arg0) != 0; return
  (D_80070D04 & 0x80) != 0;` spelled as explicit 1/0 branches; no frame, no
  calls; baseline flags
- ovl_11_func_80100EB8 (s) — link follower
- ovl_11_func_80100F9C (s) — link follower
- ovl_11_func_80100FFC (s, 0x4A8) — link successor that reads `lbu D_80070D04`
  with the same absolute `lui`+`lbu %lo` idiom and probes a bit of it

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
- ovl_11_func_800CCC5C (m, matched this session) — leaf copy/mirror: copies the
  unaligned word at the `D_8007AFF0`+0x25388 far-buffer pointer slot into
  `D_80071A00`+0xFC, and when the pool's s16 at +0x8A is 0x106/0x107 mirrors it
  to +0x4012 (same single-`lui`+`addu` far-base idiom as the +0x25388 slot
  reader pair 0x800C0F84 / 0x800DD1D0 — a third matched deref of that slot)
- ovl_11_func_800F19C8 (m, matched this session) — leaf byte-compare helper:
  `return D_80071A22 == (arg0 & 0xFF);` (6 words, `andi` + `lh` + `sltu` mount,
  no branches); byte-exact clean C, baseline flags; run's only confirmed
  D_80071A22 reference; caller is link-adjacent ovl_11_func_800F19E0
- ovl_11_func_800CD3C4 (m, matched this session) — multi-cell evaluation leaf:
  sums guards over three pool cells (`lh` +0x12, `lhu` +0x36, and a second
  `& 0x200` mask-and-test of s32 `D_80071A6C`, joining 0x800CBDFC as a reader
  of that word), halves the score when bit 0x200 is set, and zeroes it on the
  `lhu` +0x36 bit-3 test; also forms two far sub-bases from the same
  `char *base = (char *)&D_80071A00` idiom as 0x800CCC5C — base+0x2E38 (=
  `D_80074838`, s16 at +0x64C8 = 0x8007AD00, the cell the mask-switch run reads
  as D_8006C838+0xE4C8) and base-0x51C8 (= `D_8006C838`, u16 at +0x44C0 =
  0x80070CF8, beside the D_80070CF2/D_80070CF6 switch globals); see the
  D_8006C838 cluster entry
- ovl_11_func_800D63C4 (m, matched this session) — dual-gauge clamp leaf over
  the pool: adds a sign-extended s8 arg to u16 +0x14 (clamp 0..0xFF, result
  also stored to s16 +0x12, which 0x800CD3C4 reads) and a second s8 arg to u16
  +0x16 (clamp 0..0x64); increments the u16 counter at `D_8006C838`+0x4A84
  (0x800712BC) through the same `base - 0x51C8` sub-base as 0x800CD3C4; 0xC4,
  byte-exact clean C, baseline flags; zero-gap link order between 0x800D6380
  (which calls cluster member 0x800F2354) and 0x800D6488
- ovl_11_func_8011D06C (m, matched earlier) — leaf: `return D_80071A5C >= arg0;`
  `>=`-guard on the pool's middle sibling


## `ovl_11` D_800719FE s16-global cluster — 0x800FDEDC–0x800FDFD8 / 0x80112160 (near trio: medium; 80112160: low)

Candidate same-TU family of `ovl_11` (`Obj\GF_FARM.bin`) sharing a single
file-scope s16 global. Same shared-global fingerprint as the documented
D_80071A00 pool: main-RAM file-scope global absent from the generated
`globals.h`, read by short leaf helpers. The near members are tightly bound:
`ovl_11_func_800FDEDC` (0x800FDEDC, matched) loads the global, branches on
`(D_800719FE - arg0) < 5`, and forms the addresses of both
`ovl_11_func_800FDFA8` and `ovl_11_func_800FDFD8` directly, selecting one as
a function pointer per loop iteration — a code-level binding, not just
adjacency. Link order is a zero-gap run 0x800FDEDC (0xCC) → 0x800FDFA8
(0x30) → 0x800FDFD8. Third member `ovl_11_func_80112160` (0x80112160) is a
state probe switching on arg0 to return `D_800719FE != 0` (arg0==0) or the
s16 value itself (arg0==1) — same global, same file-scope state. Spread
between the near trio and the far probe is large, so same-family for
80112160 is plausible rather than established.

Members (address order):
- ovl_11_func_800FDEDC (m, matched) — 0xCC-byte consumer run: `lh
  D_800719FE`, branches on `D_800719FE - arg0 < 5` to pick one of the two
  helpers below as a callee, loops it over a 5-entry window and negates the
  result when the FDFD8 branch was taken; byte-exact clean C, baseline flags
- ovl_11_func_800FDFA8 (m) — comparator delegate: forwards arg0 to
  `ovl_11_func_800E6EE0(arg0, 0, 2, 0)`; does not touch the global itself,
  bound to the TU only by the address taken in 800FDEDC
- ovl_11_func_800FDFD8 (m) — leaf equality helper: `return D_800719FE ==
  arg0;` (7 words, `lh` + `sll/sra` sign-extend + `xor` + `sltiu`, no
  branches); byte-exact clean C, baseline flags; the cluster's only pure
  getter
- ovl_11_func_80112160 (s) — state probe over the same global, returns
  `D_800719FE != 0` on arg0==0 and the raw s16 on arg0==1

Widening (byte-exact match of `ovl_11_func_80111E38`, 2026-10-03): the
cluster's first known writer is now matched — `ovl_11_func_80111E38`
resets `D_800719FE` to 0 (via its `&D_8006C838` base, +0x51C6) and sits in
the gapless link run 0x80111D94–0x80111F10 with `ovl_11_func_80111EE0`
(see the D_80070D10 reset-run entry below).

---

## `ovl_11` D_80070D10/D_800719FE reset run — 0x80111D94–0x80111F10 (confidence: medium)

Candidate same-TU family of `ovl_11` (`Obj\GF_FARM.bin`): a fully gapless
link run (0x80111D94 +0xA4 → 0x80111E38 +0x30 → 0x80111E68 +0x78 →
0x80111EE0 +0x10 → 0x80111EF0 +0x20 → 0x80111F10, each ending exactly
where the next begins) holding a setter/clear pair over the same s16
`D_80070D10` plus a same-run call edge.

Fingerprints:
- setter/clear pair over one s16: `ovl_11_func_80111EE0` (m) sets
  `D_80070D10 = 3`; `ovl_11_func_80111E38` (m) clears it (and its +2
  sibling and `D_800719FE`) — the same file-scope-global fingerprint as
  the documented D_80070D0E cluster, here with both directions in one run;
- same-run call edge: `ovl_11_func_80111E38` calls `ovl_11_func_80111EF0`
  (0xB8 ahead, two members away in the run), which tail-calls
  `ovl_11_func_80111F10` — call graph and link order agree;
- shared caller: `ovl_11_func_80111E38`'s sole caller is parked stub
  `ovl_11_func_801044E4`, which also solely calls matched
  `ovl_11_func_801047FC`; both callees touch the `D_8006C838` work area
  (80111E38 clears +0x44D8/+0x44DA/+0x51C6 through one `&D_8006C838` base
  and returns that base), extending that shared-caller family.

Members (address order):
- ovl_11_func_80111D94 (s) — gapless run predecessor, role unknown
- ovl_11_func_80111E38 (m, matched 2026-10-03) — reset: zeroes
  D_80070D10/D_80070D12/D_800719FE through one `&D_8006C838` base
  (+0x44D8/+0x44DA/+0x51C6) and returns the base; calls 80111EF0
- ovl_11_func_80111E68 (s) — role unknown
- ovl_11_func_80111EE0 (m) — sets `D_80070D10 = 3` (leaf)
- ovl_11_func_80111EF0 (s) — trampoline to `ovl_11_func_80111F10`
- ovl_11_func_80111F10 (s) — role unknown

---

## `ovl_11` D_80127F60 s16-table lookup helper — 0x80111D28 (confidence: low)

Candidate same-TU family of `ovl_11` (`Obj\GF_FARM.bin`): one short leaf
helper reading a file-scope s16 table absent from the generated `globals.h`, via
extern + absolute addressing. Same short-leaf-over-file-scope-s16 fingerprint
as the documented D_800719FE cluster (whose matched member
`ovl_11_func_800FDFD8` is an `lh` + `sll/sra` sign-extend leaf).

Members (address order):
- ovl_11_func_80111D28 (m, matched this session) — 8-byte pure getter:
  `return D_80127F60[arg0];` over a 4-entry s16 `.data` table at 0x80127F60
  ({0x12, 0x13, 0x12, 0x11}); `s16` param sign-extended via `sll16/sra15`;
  byte-exact clean C, baseline flags. Called by link-adjacent stubs
  `ovl_11_func_80111A60` (0x80111A60) and `ovl_11_func_80111B74`
  (0x80111B74), which `lh` their arg0 — so the helper re-sign-extends a
  value the callers already sign-extended. Adjacent ovl_11 `.data` s16
  tables (D_80127F50, D_80127F68) suggest a compact data+helper cluster;
  no matched sibling yet to bind the TU more tightly.

---

## `ovl_11` D_80127208 set-once flag trio — 0x800FB5FC / 0x800FB608 / 0x800FB628 (confidence: medium)

Candidate same-TU family of `ovl_11` (`Obj\GF_FARM.bin`): three address-adjacent
leaf functions sharing one file-scope s32 flag `D_80127208`.

Fingerprints:
- **address adjacency.** `ovl_11_func_800FB5FC` (0xC bytes, ends 0x800FB608)
  sits immediately before `ovl_11_func_800FB608` (0x20 bytes, ends 0x800FB628)
  which sits immediately before `ovl_11_func_800FB628` (0x20 bytes) — a
  contiguous link-order run, no gaps.
- **same shared global.** All three functions reference only `D_80127208`; one
  clears it, one sets it once, one clears it conditionally. A shared main-RAM
  s32 flag absent from `globals.h` is the same file-scope-state fingerprint
  documented for the D_80071A00 / D_800719FE clusters. All three reach it with
  the same absolute-addressing pattern (`lui`/`lw`/`sw %lo`), i.e. an `extern`
  declaration rather than a defining TU.

Members (address order):
- ovl_11_func_800FB5FC (s) — leaf clear: `D_80127208 = 0` (3 words)
- ovl_11_func_800FB608 (m, matched this session) — leaf set-once guard: if
  `D_80127208 == 0` then `D_80127208 = 1` (8 words, `lw`/branch/`sw`, no
  calls, no frame); byte-exact clean C, baseline flags
- ovl_11_func_800FB628 (m, matched this session) — leaf conditional clear: if
  `D_80127208 != 0` then `D_80127208 = 0` (8 words, `lw`/`beqz`/`sw`, no
  calls, no frame); byte-exact clean C, baseline flags

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
  in the overlay, same-family plausible but not link-adjacent;
- the run-head writer `ovl_11_func_800EE604` and the sandwiched members
  `ovl_11_func_800EE7BC`/`800EE944`/`800EEAB8`/`800EEBC8` also touch the
  s32 table `D_80129560` (main RAM 0x80129560, 0x50 bytes, ends 0x16
  bytes below `D_801295C6`) — one file-scope data region, two globals —
  which strengthens the same-TU read of the run.

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
- ovl_11_func_800EEBC8 (m, matched this session) — table reset:
  `memset(D_80129560, 0, 0x50); return 1;` (callers discard the value);
  does not touch `D_801295C6`, kept in the run by link adjacency

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

## `ovl_11` D_8006C838 +0x7AE8 0xB4-stride flag-pair — 0x80115F38 / 0x80115F80 (confidence: medium)

Zero-gap link-order adjacency (ovl_11_func_80115F38 is 0x48 bytes, ends exactly
at 0x80115F80 where ovl_11_func_80115F80 begins) plus a shared global cluster
argue one TU. Both index the same 10-entry 0xB4-stride u32-flag array at
`D_8006C838 + 0x7AE8` with the same two-stage `lui %hi`+`addiu %lo` base, and
0x80115F80 calls 0x80115F38 directly (jal at 0x80115F88) then re-derives the
same array element, so the pair partitions one flag word's bits: 0x80115F38
selects an entry by bit 0x20000, 0x80115F80 probes bit 0x40 of the same entry.
Members:
- ovl_11_func_80115F38 (m, matched this session) — scans the 10 entries at
  `D_8006C838 + 0x7AE8` stepping +0xB4, returns the last index whose u32 flag
  word has bit 0x20000 set, else -1 (s16 result; the 0x20000 mask materializes
  as a preheader `lui` before the address build)
- ovl_11_func_80115F80 (s) — calls it and re-reads the selected entry's
  +0x7AE8 word, returns `(word & 0x40) != 0`

---

## `ovl_11` D_80126FE0/E4/E8/EC menu-state reset cluster — 0x800FAAAC–0x800FAC0C (confidence: medium)

Candidate same-TU run of `ovl_11` (`Obj\GF_FARM.bin`) sharing a four-word
file-scope state cluster at 0x80126FE0–0x80126FEC, all absolute-addressed
(`lui`+`%lo`, no gp-rel in this container). Same shared-global + direct-caller +
link-adjacency fingerprint class as the documented `D_8012D52C` / `D_80123754`
runs.

Fingerprints:
- shared cluster `D_80126FE0` / `D_80126FE4` / `D_80126FE8` / `D_80126FEC`
  (main RAM 0x80126FE0/0xE4/0xE8/0xEC, initialised data words 0,0,0,0xFF):
  read/written across a tightly contiguous text span — `ovl_11_func_800FAAAC`
  resets all four to 0,0,0,0xFF; direct caller `ovl_11_func_800FAAD4` guards
  on `D_80126FE0` and sets it to 1; `ovl_11_func_800FAB18` reads it; the big
  state machine `ovl_11_func_800FAC0C` (adjacent, 0x4B8 long) reads all four;
  wider readers in 0x800F7230–0x800F9FF4 (`D_80126FE0/E4/E8/EC` span). A
  container-wide farm-menu state/selection flag pair — itself not a TU
  fingerprint on its own, but the tight 0x800FAAAC–0x800FAC0C adjacency plus
  the direct call edge narrows it to one region.

Members (address order):
- ovl_11_func_800FAAAC (m, matched this session) — leaf reset stub: writes
  `D_80126FE0 = 0; D_80126FE4 = 0; D_80126FE8 = 0; D_80126FEC = 0xFF;`
  byte-identical (10/10 words), baseline flags; the reset head of the cluster
- ovl_11_func_800FB4B0 (m, matched this session) — the state machine
  `ovl_11_func_800FAC0C`'s direct callee (jal at 0x800FADE8 and 0x800FAE60,
  feeding it `D_80126FE4` as the index); table-address leaf returning a
  pointer into the 6-byte-entry `D_80071A84`/`D_80071A8A` table region
  (`&table[x]` for x≥9, `&D_80071A8A + 6x` for 1≤x<9, plus the x==0/x==9
  endpoints), called so the state machine can read the entry s16@0 — same
  direct-callee family as state-machine callees 0x800FB0C4/0x800FB120/0x800FB510,
  call-edge evidence for same-TU, address-apart so unproven (low)

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
- ovl_11_func_8011F0D8 (m, matched this session) — guard-then-clamp confirm of the
  documented role: reads `D_8012DB10` as a first-entry guard, stores 1 to it, and
  writes a clamped (0..9) value to `D_8012DB14`; byte-exact clean C (s32 `a0`
  clamped with the `bgez`/`slti 0xA` pair), baseline flags
- func_8011F114 (s) — heavier reader/writer of both words (0xBC bytes)

---

## `ovl_11` 0x80110494 state-key probe run — 0x80110494–0x80110544 (confidence: low)

Candidate same-TU run of `ovl_11` (`Obj\GF_FARM.bin`) tied by a call edge that
the link order independently agrees on.

Fingerprints:
- zero-gap link run with a direct call edge: `ovl_11_func_80110494` (0x8C) ends
  exactly at 0x80110520 where its sole matched caller `ovl_11_func_80110520`
  begins, and the caller ends exactly at 0x80110544 (stub successor); the caller
  calls the leaf with constants `(arg0, 5, 0)` and reads the s32 result;
- the leaf is the third matched reader of the `D_8007AFF0` far-buffer halfword
  @+0x25476 (recorded accessor family 0x800C9D64 / 0x800E8960, same single-`lui`
  +`addu` far-base idiom), address-apart from both, so it widens that family
  without changing its (low) same-TU vote;
- the arg0 object view {u16@0x24, s16@0x2A, s16@0x30, u16@0x7A} has no other
  matched reader yet — the other callers (`ovl_11_func_8010F80C`,
  `ovl_11_func_8010FBC4`) are stubs.

Members (address order):
- ovl_11_func_80110494 (m, matched this session) — state-key probe leaf: guards
  u16@0x24 against arg1 (resetting @0x24/@0x2A on mismatch), else clamps the
  @0x2A counter against arg2 and gates return 1 on `@0x30 == far+0x25476 &&
  (@0x7A & 0x300) == 0`; byte-exact clean C, baseline flags
- ovl_11_func_80110520 (m) — gapless link successor and direct caller; maps the
  leaf's result to 0/1 via `sltu`; shares the link run
- ovl_11_func_80110544 (s) — 0x84-byte stub continuing the run (no grouping
  evidence of its own yet)

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
- func_80023710 (m) — mode-2 callback for the cmd==0x40 path
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

- ovl_11 0x80115FE0→0x801164F8 caller/leaf run — zero-gap link order
  (ovl_11_func_80115FE0 (s), 0x518 bytes, ends 0x801164F4; next function
  ovl_11_func_801164F8 starts at 0x801164F8 with no unrelated code between)
  and the call graph agree: the head `jal`s the leaf at 0x80116320 and feeds
  its u16 return straight to func_8002261C(2, result), then advances the
  documented D_8012D520 state machine via ovl_11_func_8011D084(0x18, 0x1A)
  — the same 0x1A id the D_8012D520 reader quartet's
  ovl_11_func_801165C8 tests for, tying the run to that neighbourhood.
  - ovl_11_func_80115FE0 (s) — state-machine dispatch step: big 0xA8-frame
    handler that picks ids for ovl_11_func_8011D084 and calls the leaf below
    to obtain one of them
  - ovl_11_func_801164F8 (m, matched 2026-11) — leaf tier id: reads
    D_8006C838+0x51DA/51DC/51DE, buckets ratio*100/den and level into
    row/col, returns table D_80128214[row][col] (sole reader of that 5×4
    u16 table — private data, no shared global with the caller)
  Evidence class: link-order adjacency + caller relation only (the leaf is a
  private-table reader with no shared gp-rel/absolute global); confidence
  low.

- func_80021DA8 (m) — buffer/address initializer: clears D_8006C838 and
  D_8007AFF0, calls func_80021E60(0), computes 2048-byte-aligned addresses
  from D_8001009C - D_80010098, stores results in D_8007AFF0[0..1].
  Evidence for func_80021E60 neighborhood: address-adjacent (func_80021DA8
  ends at 0x80021E60 where func_80021E60 begins), direct caller.
  No shared gp-rel cluster verified yet; TU membership unconfirmed.
- func_80021E60's pool-carving table neighborhood (19-entry pointer/count
  parallel arrays over 0x18-byte elements) — func_80021DA8 is a confirmed
  caller and address predecessor; shared gp-rel globals unverified.
- ovl_11 D_8012D520 getter/compare quartet — ovl_11_func_80118C6C (m, matched
  this session), ovl_11_func_801165C8 (m, now matched),
  ovl_11_func_80115FC8 (m, matched this session) and
  ovl_11_func_801189C8 (m, matched this session) are the four ovl_11 readers
  of s32 D_8012D520 (all `lui %hi` + `lw %lo`); ovl_11_func_801165C8 is the
  boolean test `D_8012D520 != 0x1A` (xori 0x1A + sltu-vs-zero) and
  ovl_11_func_80115FC8 the same-shape test `D_8012D520 != 0x14`.
  ovl_11_func_801189C8 additionally reads D_8012D52C in the same body and is
  the dispatcher over the ovl_11 case-handler tables D_800BB228[8] /
  D_800BB248[26] / D_800BB2C0[27] — indexed by D_8012D520 and D_8012D52C
  respectively, returning "handled" 1/0 for the caller
  ovl_11_func_800C162C — and its table entries are largely the D_8012D52C
  reset-stub family members above (e.g. 8011A708–8011A998, 8011AA44,
  8011AA54, 8011B6B4, 80114184/80114194), tying the reader trio, the
  busy-flag writers and the handler run together as one state-machine
  neighbourhood.
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
- ovl_11 0x80118C28 run — zero-gap link order 0x80118C28 (0x44) →
  0x80118C6C (0x10) → 0x80118C7C (0x34) → 0x80118CB0 (0x34) → 0x80118CE4,
  each starting exactly where the previous ends.  Reader/writer pair on the
  orphan-block global inside one run: ovl_11_func_80118C6C (m) is the getter
  `return D_8012D520` and ovl_11_func_80118CB0 (m, this session) is the
  reset `D_8012D520 = 0; D_8012D524 = 0; D_8012D52C = 0; D_8012D540 = 1;
  D_80128210 = 1; return 1;`, its D_8012D520/D_8012D524/D_8012D52C/D_8012D540
  writes all in the documented D_8012D51A–548 data-cluster web. The remaining
  members 0x80118C28 / 0x80118C7C / 0x80118CE4 are stubs. Zero-gap link order
  + shared-global fingerprint; data TU ownership unconfirmed.
- ovl_11 by-value struct-slice run — 0x8011D934 / 0x8011D98C /
  0x8011D9B4 / 0x8011D9DC, zero-gap link run (0x8011D934 0x58 → 0x8011D98C
  0x28 → 0x8011D9B4 0x28 → 0x8011D9DC 0xF8). The first three all take the
  same 0x60-byte struct by value (StructD548; s16 selector at 0x5C, first
  16 bytes ride $a0-$a3 and are spilled to sp+0..0xC, the rest placed in
  the outgoing stack area), the by-value record behind the zero-init
  D_8012D548 global which abuts the documented D_8012D524/D_8012D52C
  cluster one row up:
  - ovl_11_func_8011D98C (m, matched this session) — leaf, returns
    `x.data[x.index]` with the s16 table base at 0x28.
  - ovl_11_func_8011D9B4 (m) — leaf, byte-identical to ovl_11_func_8011D98C
    except the s16 table base at 0x46; sibling, same struct/Accessor idiom.
  - ovl_11_func_8011D934 (s) — leaf, reads the same selector at 0x5C plus
    the spilled word at sp+0 (the caller-passed first struct word) and folds
    arg1/arg2; same by-value record.
  - ovl_11_func_8011D9DC (s) — run tail, different shape (reads statics via
    $s0 + 0x51E6/0x524C); link-order follower only.
  Call-graph agreement via the shared by-value parameter ABI + zero-gap
  link order; callers (0x80114604 etc.) are stubs, so data TU ownership
  unconfirmed. StructD548 is shared-typed in include/game_types.h.
- ovl_11 v0-channel/static-chain fossil run — 0x8011D400 / 0x8011D438 /
  0x8011D474, zero-gap link run (0x8011D400 0x38 → 0x8011D438 0x3C →
  0x8011D474 0x2C0, each ending exactly where the next starts; the caller
  starts exactly at the callee's end). ovl_11_func_8011D438 (m, matched
  this session) is a 10-scan byte-probe leaf that opens with the family's
  dead `sw $v0, 0($sp)` hard-$v0 capture (CAPTURE_PREV_RET + tmp[2], the
  exact fossil signature of func_8001E878/E9F8/EAE4 and the ovl_11
  800D1CD0/800D0600 leaves); its link-contiguous sole caller
  ovl_11_func_8011D474 (s) materializes `$v0 = $sp + 0x18` before the
  `jal` — the family's nested-function static-chain seeding — then
  dispatch-loops off the result. A third, higher-address member cluster of
  ovl_11's documented v0-channel fossil (previous: 0x800D12A0–0x800D2160);
  head 0x8011D400 (s) is link-order predecessor only. Call-graph agreement
  (caller contiguous after callee) + register-capture quirk; TU ownership
  unconfirmed (parent stubs).
- ovl_11 6-byte struct-copy helper run — 0x800F7E38 / 0x800F8404 /
  0x800F8480 / 0x800F84D4 (confidence: low): the orchestrator
  ovl_11_func_800F7E38 (stub) calls three link-adjacent leaf helpers that
  form a zero-gap run 0x800F8404 (0x24) → 0x800F8428 → 0x800F8480 (0x54) →
  0x800F84D4 (0x1c) → 0x800F84F0: ovl_11_func_800F8404 (m, matched this
  session — leaf 0/1/2 clamp-ish utility, region-shared, called seven times), ovl_11_func_800F8480 (m, matched
  this session — the run's swap helper, swapping two 6-byte {s16; s16; s16} objects through one 8-byte stack temp
  with the same unaligned-4 + halfword block-move idiom as its gapless successor 0x800F84D4; declared the same
  local `CopyStruct` typedef; called by 0x800F7E38/0x800F7FAC), and ovl_11_func_800F84D4 (m, matched
  this session) — the run's short struct copier, copying a 6-byte
  {s16; s16; s16} object from $a0 to $a1 as one unaligned 4-byte chunk plus
  a halfword (block move, align 2). Caller/callee share the same struct
  layout on the same live objects: 0x800F7E38 reads offset 0x0 as s16 and
  offsets 0x4 of the very pointers it passes as arg0/arg1 as s16 right after
  the call. Call-graph + zero-gap link-order agreement only; no shared
  gp-rel globals verified; TU membership unconfirmed. Now widening: freshly-matched
  `ovl_11_func_800FB45C` (this session, byte-exact, 21/21 shapes) is a second
  member of the same 6-byte {s16;s16;s16} swap-helper family — its whole
  instruction stream is byte-identical to the run's swap helper 0x800F8480 —
  but it lives address-apart at 0x800FB45C, in the `0x800FBxxx` region beside
  the recorded D_80127208 trio (0x800FB5FC/0x800FB608/0x800FB628) and the
  predicate helper 0x800FB3E4, and is called (per the recorded summary) by the
  same link-adjacent 0x800FB218/0x800FB290 that call 0x800FB3E4; same-TU
  membership with the 0x800F84xx run unproven, but the swap-shape family now
  spans two matched sites across two link regions (low).

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
- func_800171CC (m) — wrapper: func_80017300(tag=1, zeros, 0)
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

## `ovl_11` D_8006C858 item-table accessor run — 0x800D5750–0x800D6090 (confidence: medium)

Candidate same-TU family of `ovl_11` (`Obj\GF_FARM.bin`) sharing the
main-binary item-table pointer `D_8006C858` (absolute `lui`+`%lo` in every
site — the overlay only declares it extern, so it is never GP-relative).
Same shared-global-cluster fingerprint as the documented D_80128810 run, here
round a table of 0x28-byte `ItemData` records indexed by the identical
`*40 = (idx*4 + idx) << 3` multiply chain (`sll 2; addu; sll 3`) in every
site. Our ovl_11_func_800D6014 is the run's s16-at-+0x10 getter.

Fingerprints:
- shared global pointer `D_8006C858` → ItemData[] (40-byte stride); every
  access is `lw %lo(D_8006C858)` then the same three-instruction index
  multiply, so the whole cluster shares one field-layout type;
- address adjacency: nine of the 21 total ovl_11 D_8006C858 accessors sit in
  this 0x800D5750–0x800D6090 window as two zero-gap runs
  (0x800D5750–0x800D5960, seven members; 0x800D6014 + 0x800D6090 — the
  intervening 0x800D603C does not touch the table);
- each run member references D_8006C858 exactly twice (the lui/%lo pair).

Members (address order):
- ovl_11_func_800D5750 (s) — s16 index flag test: bit 0x4000 → 2, else
  (flags & 0x8100) != 0 → 1, else 0
- ovl_11_func_800D57A4 (m, matched this session) — s16 index status dispatch at +0x18: bits
  0x10000000 / 0x20000000 / 0x40000000 → 0/1/2/3
- ovl_11_func_800D5810 (s) — s16 index, returns `(s32 at +0x18) < 0`
- ovl_11_func_800D583C (s) — s16 index, returns type byte at +0x2
- ovl_11_func_800D5868 (m, matched this session) — s16 index, returns `(flags & 0x40) != 0`; reads the offset-0x00 word *signed* (lh), the same access 800D5750/800D589C/800D58D0 use and the opposite view from the lhu readers named in the ItemData struct comment
- ovl_11_func_800D589C (m, matched this session) — s16 index, returns `(flags & 0x8100) != 0` via the same `(m & 0x8100) > zero` bool-idiom as 800D5868
- ovl_11_func_800D58D0 (m, matched this session) — s16 index; flags & 0x800 →
  dispatches the action sub-struct at +0x1C (fn ptr +0 called as (s8, s8, s16, s32),
  s8 at +4/+5, s16 at +6; first arg = arg0's s8 at +2 on the 0x800 path, else the
  sub-struct's s8 at +4), else -1; reads the flags word *unsigned* (lhu); byte-exact
  clean C, baseline flags, through the shared ItemData override — confirms the
  predicted 0x1C sub-struct layout, and its arg0 record ({s16@+0, byte@+2}, the byte
  here read signed) is the same arg shape the 800D5B3C/800D5BBC members read
- ovl_11_func_800D5B3C (m, matched this session) — two-level item table lookup
  through the `D_8006C838`+0x20/+0x24 pointer slots: reads s16 index from arg0+0,
  looks up ItemData field_0E via the +0x20 slot (= D_8006C858), uses that as a
  secondary index plus arg0+2 to index a 0xB0-stride table via the +0x24 slot,
  returns u16 at +0xAC; shares the 0xB0 stride and field_0E access with parked
  neighbour 0x800D5ABC; byte-exact clean C, baseline flags
- ovl_11_func_800D5BBC (m, matched this session) — sibling of 800D5B3C: same
  `D8006C838Lookup` view, same two-level lookup through +0x20/+0x24 pointer
  slots with the same 0x28 and 0xB0 strides, same secondary index computation
  (s16(temp_a0*5) + u16(arg0+2) then sign-extended), returns u16 at +0xAE
  instead of +0xAC — a sibling field of the same 0xB0-stride table; byte-exact
  clean C, baseline flags
- ovl_11_func_800D5C3C (m, matched this session) — s16 index; reads the item
  table through the `D_8006C838`+0x20 pointer slot (same 0x28-stride *40
  `ItemData` multiply chain), maps the signed byte at +0x3 through a 0x10-stride
  table at `D_8006C838`+0x2C (lhu at +0x2), returns -1 on the -1 type byte;
  base is a `D_8006C838` field access, not the `D_8006C858` symbol (the +0x20
  slot aliases `D_8006C858`), so same window + idiom, different base form
- ovl_11_func_800D5C90 (m, matched this session) — byte-exact-in-shape, link-contiguous
  twin of 800D5C3C (0x800D5C90 = 0x800D5C3C+0x54); same s16 index through the
  `D_8006C838`+0x20 pointer slot, same 0x28-stride *40 multiply chain and signed
  byte@+0x3 type map through the `D_8006C838`+0x2C 0x10-stride table, differing only
  in the return load: signed `lh` at +0x4 (vs lhu at +0x2), returns -1 on the -1 type
  byte; so the 0x800D5C3C/0x800D5C90 pair reads two halfword fields of the same
  0x10-stride sub-struct (+0x2 u16 / +0x4 s16) off one shared base
- ovl_11_func_800D6014 (m, matched this session) — u16 index, returns s16 at
  +0x10; leaf, byte-exact clean C, baseline flags; the run's +0x10 getter
- ovl_11_func_800D6090 (m, matched this session) — u16 index; masked `andi` index then the same *40 multiply chain; `(flags & 0x8100) == 0x8000` and `(s8 type ^ 1) != 0` → 1, else 0; leaf, byte-exact clean C, baseline flags
- ovl_11_func_800D61D8 (m, matched this session, 0x54, first try EXACT) — s16 index through the `D_8006C838`+0x20 pointer slot, same 0x28-stride *40 multiply chain and signed byte@+0x3 type map through the `D_8006C838`+0x2C 0x10-stride table, returning the u16 at +0x0 (a new offset in the sub-struct; the recorded 800D5C3C/800D5C90 pair reads +0x2/+0x4), returns -1 on the -1 type byte like 800D5C3C/800D5C90 (not the 0-returning 800D5CE4 variant); sits 0x148 above the run tail 0x800D6090, sharing the `D8006C838Lookup` view and instruction window, so it joins the same-source-file hypothesis (low/medium)
- ovl_11_func_800D5ED4 (m, matched this session, 0x70, byte-exact) — the sixth member of the two-u16 `rows[a].arr[b]` / `field_28` `t*8` twin family, gapless between 0x800D5E64 (ends exactly here) and the 0x800-mask member 0x800D5F44 (starts exactly at 0x800D5ED4+0x70): same `D8006C838Lookup` view, same *0x28 stride, aggregate probe mask 0xE000 (= 0x8000|0x4000|0x2000, the same aggregate probe as 0x800D5E64), but returns the `field_28` 8-byte-record u16@+2 (0x800D5E64 returns the u16@+0), and its -1 on both the `bne`-inverted -1 test and the clear-mask path — so the family's value-returning members now read two different sub-fields and the twin run 0x800D5D38→0x800D5D9C→0x800D5E00→0x800D5E64→0x800D5ED4→0x800D5F44 is matched at every slot
- ovl_11_func_800D57A4 (m, matched this session) — s16 index status dispatch at +0x18: bits
  0x10000000 / 0x20000000 / 0x40000000 → 0/1/2/3

Scattered siblings sharing D_8006C858 (broader cluster, not confirmed same
TU): 800BE2C4, 800C580C, 800C69B8, 800C74AC, 800C8764, 800CBD78, 800CC7CC,
800CCF58, 800D12B8, 800D196C, 800E93CC. 800D736C is now matched (byte-exact
clean C, baseline flags) and confirmed to use the run's exact accessor idiom
— exactly two D_8006C858 references (lui/%lo pair), the same
`*40 = (idx*4 + idx) << 3` multiply chain, and the lhu flags read with
bit-test dispatch — but sits ~0x12DC above the run tail 0x800D6090 with no
adjacency, so it stays a scattered sibling; its zero-gap adjacency instead
ties it to the vector-setter run ending at 0x800D7348 (see that entry).

---
## `ovl_11` D_8006C838 flags/state-buffer cluster — 0x800BCF28 / 0x800BFD04 / 0x800CBE14 / 0x800CD3C4 / 0x800D12A0 / 0x8010C4B0 / 0x800F00AC / 0x800F2354 / 0x8010C1C0 / 0x800E953C / 0x800E63C8 (confidence: low)

Scattered ovl_11 functions (gap of ~0xE00 to ~0x40000 between addresses —
a data tie, not link-order adjacency) touching the main-binary flags/state
array D_8006C838 (base-binary owners func_80013CD0 / func_80022DF8 / the
D_8006C838 reset run in the main segment). Same shared-global-cluster
fingerprint as the documented D_80128D78/D_80128D7A and D_8006C858 entries;
the base is `lui %hi(D_8006C838)`+`%lo` absolute in every site (extern in
the overlay, never GP-relative), and the large-offset writers use the same
+0x8000 two-stage base split. Access width and offset per member:

- ovl_11_func_800BCF28 (m, matched this session) — clears bits 26/27 of the
  s32 word at +0xC (the field func_80022DF8 sets/clears in the main binary)
  and sets bit 6 of the u16 at +0x51FE; leaf, byte-exact clean C, baseline
  flags
- ovl_11_func_800BFD04 (m) — s16 setter at +0xE4C8 via the +0x8000 split
  (base+0x8000, disp +0x64C8)
- ovl_11_func_800CBE14 (m) — swaps u16 pair at +0x5800/+0x5802
- ovl_11_func_800CD3C4 (m, matched this session) — evaluation leaf: masks bit
  0x200 of the u16 at +0x44C0 (= 0x80070CF8) into a running score (via sub-base
  base-0x51C8 formed from `&D_80071A00`; see the D_80071A00 pool cluster
  entry), and gates a second read at `D_80074838`+0x64C8 (= 0x8007AD00, the
  cell 0x800F1CC4 reaches as +0xE4C8); its +0x8000-relative region ties it to
  the D_80071A00 pool cluster as well
- ovl_11_func_800D12A0 (m) — s16 setter at +0x99E6 via the +0x8000 split
  (already documented as the D_80123754 run head)
- ovl_11_func_8010C1C0 (m, this session) — copies four s32 fields from arg0
  (+0x100/+0x104/+0x108/+0x10C) into the contiguous span +0x92D4..+0x92E0 of
  the same buffer via the same +0x8000 two-stage split (base+0x8000, disp
  +0x12D4..+0x12E0); leaf, byte-exact clean C, baseline flags; link-immediate
  predecessor of stub 0x8010C1FC, two stubs before the D_80075854 run head
  0x8010C330
- ovl_11_func_8010C4B0 (m) — sets bit 0 of the u16 at +0x91A8
- ovl_11_func_800C9D38 (m, matched 2026 — this session) — clears bit 30 of the
  s32 word at +0x5234 and zeroes the three s32 counters at +0x52D8/+0x52DC/+0x52E0;
  leaf, byte-exact clean C, baseline flags; offsets sit ~0x36 past sibling
  0x800BCF28's +0x51FE u16 in the same state buffer; called by link-adjacent
  0x800BCD28 / 0x800CCCC0
- ovl_11_func_800E953C (m, matched this session) — bit get/set leaf on the
  same two cells the siblings touch: arg0 selects test vs modify, arg1 sets vs
  clears, arg3 picks the cell pair — s32 at +0x5234 / u16 at +0x51FE. Proves
  the symbol-map names `D_80071A6C` and `D_80071A36` are aliases of
  `D_8006C838`+0x5234 and +0x51FE respectively (the compiler reached the same
  cells through absolute lui/%lo symbols in one half of the dispatch and
  through the base-relative +0x5234/+0x51FE forms in the other), tying those
  two D_80071Axx symbols into this cluster; link-sits in the 0x800E5A1C–
  0x800EExxx accessor band between D_8006C858-member 0x800E93CC and
  0x800E95FC
- ovl_11_func_800E63C8 (m, matched this session) — flag set/clear leaf on the
  sibling cells: arg0 picks mask path vs set path — s32 at +0xC cleared of
  0x400000 and s32 at +0x5234 cleared of 0x08000400 vs s32 at +0x5234 set of
  0x00800000 — then an s16 read at +0x52C6 gates u16 at +0x51FE (|= 0x8 vs
  &= 0xFFF7), and arg1 == 0 clears bit 1 of the +0x5234 word; proves
  `D_80071AFE` is an alias of `D_8006C838`+0x52C6 (the base-relative lh hits
  the cell the symbol map names D_80071AFE, joining the +0x5234/+0x51FE alias
  proof of 0x800E953C); fixes `&D_8006C838` in per-arm `char *base` variables
  that cc1 splices `%lo` into — the same shared-base idiom as 0x800F2354;
  link-sits in the 0x800E5A1C–0x800EExxx accessor band (callers 0x800E5294 /
  0x800E537C / 0x800E60A0 / 0x800E648C / 0x800E6D2C)
- ovl_11_func_800F2508 (m, matched this session) — stride-4 clear leaf: stores
  -1 into 20 byte fields at +0x49E6 / +0x4A36 (byte read/write class shared with
  the documented 0x800D0EA4 / 0x800D0ED0 flag-byte pair near +0x4AC0) and zeroes
  the s32 at +0x44FC; 0x30 leaf, byte-exact clean C, baseline flags; link-adjacent
  (ends exactly at) 0x800F2538, which iterates the same 20-entry stride-4 table of
  byte@2 == -1 sentinel entries
- ovl_11_func_800F00AC (m, matched this session) — sums 25 u16 at +0x498C (count
  0x18 loop reversed to a countdown latch, `lhu`/`addiu +2`) and adds the s16 at
  +0x44DC; 0x38 leaf, byte-exact clean C, baseline flags; read offsets sit in the
  same buffer region as sibling 0x800F2508's +0x44FC / +0x49E6 / +0x4A36 fields;
  fixes `&D_8006C838` in a local `char *base` for the loop and reaches the
  post-loop s16 through a struct-view cast on `&D_8006C838`, so cc1 keeps one `lui
  %hi(D_8006C838)` fragment live across the loop and re-splices `%lo` after — the
  same shared-base idiom as 0x800F2508
- ovl_11_func_800F2354 (m, matched this session) — accumulator counter leaf:
  clamps the s32 at +0x5224 (0x1489 words) into 0..0x98967F, adds its delta to
  the s32 pos/neg totals at +0x49C4/+0x49C8, returns 0/1/2; 0xAC, byte-exact
  clean C, baseline flags; fix-and-carry offsets sit in the same buffer region
  as siblings 0x800F2508 (+0x44FC/+0x49E6/+0x4A36) and 0x800F00AC (+0x498C),
  and it fixes `&D_8006C838` in a shared `base` pointer with per-arm pointer
  variables that cc1 splices `%lo` into — the same shared-base idiom as
  0x800F00AC/0x800F2508
- ovl_11_func_800F45A4 (s) — loads the +0x8000+0x5DB4 entity slot and
  calls ovl_11_func_800F5700 to find a matching entry, then OR/AND flips bit 0
  of the result's u16 at +0x4; one of the two readers of the same slot
- ovl_11_func_800F5698 (s) — the other +0x5DB4 reader: gate on an arg3
  mask, linear scan through the same call, then the same u16@+4 bit-0 flip;
  zero-gap link-order predecessor of ovl_11_func_800F5700
- ovl_11_func_800F5700 (m, matched this session) — the shared search helper
  both callers use: linear scan of the 0x18-stride struct array for u16@+2 ==
  s16 arg0, returns the matching entry pointer else 0 (leaf, 0x40, byte-exact
  clean C `arg1[i].unk2 == arg0; return &arg1[i];`, baseline flags); its caller
  ovl_11_func_800F5698 is its zero-gap link-order predecessor, and the +0x5DB4
  slot it searches is the sibling of the documented +0x5DCC/+0x5DD4 slots in
  the 800F4360–800F43CC spawn-record run — same entity-base family (low)
- ovl_11_func_800BFF00 (m, matched this session, 0x50, byte-exact) — leaf that
  copies three s32 words (offsets 0/4/8) from the struct pointed at by global
  `D_80128A80` into the same buffer at +0x6748/+0x674C/+0x6750 and zeroes the
  six s32s +0x6754..+0x6768, via the same +0x8000 two-stage split (base+0x8000,
  disp +0x6748..); baseline flags; fits the cluster's existing +0x8000 split
  family, sits ~0x1FC from member 0x800BFD04 in the same link region and just
  before the recorded 7-halfword reset helper 0x800BFF50 (whose caller
  0x800BFEA4 is link-adjacent); first matched reference to `D_80128A80`
  (0x80128xxx data region, beside the `D_801285xx`/`D_80128BB0`/`D_80128DE8`
  reset clusters)
- ovl_11_func_800D63C4 (m, matched this session) — dual-gauge clamp leaf:
  adds a sign-extended s8 arg to the u16 gauge at `D_80071A00`+0x14 (clamp
  0..0xFF, mirrored to +0x12) and a second s8 arg to the u16 gauge at +0x16
  (clamp 0..0x64), then increments the u16 counter at +0x4A84 (0x800712BC, a
  new offset sitting between the +0x49xx accumulator fields and the +0x4AC0
  flag-byte pair) on every gauge-0 update; forms the counter sub-base as
  `base - 0x51C8` from `&D_80071A00`, the same sub-base idiom as 0x800CD3C4
  (see the D_80071A00 pool cluster entry); 0xC4, byte-exact clean C, baseline
  flags; zero-gap link order between 0x800D6380 (which calls cluster member
  0x800F2354) and 0x800D6488
## `ovl_11` D_8006C838 +0x7A78 halfword-record table — 0x800DBB94 / 0x800DBF60 / 0x800DBE9C (confidence: low)

Scans and a shift over the same main-binary 5-entry record table — absolute
`lui %hi(D_8006C838)` + `%lo` base, element offset 0x3D3C (byte 0x7A78), stride
6 s16 (0xC bytes), first s16 is a -1 empty sentinel; same strength-reduced
pointer walk. Shared idiom + shared-global fingerprint; the shift member
ovl_11_func_800DBE9C is address-adjacent (0x3E8 below 0x800DBB94 in the
0x800DBAB0–0x800DC0A0 record-family band) and callee-linked (its callers
ovl_11_func_800DBE30/ovl_11_func_800DBEF8 are both called by func_800DBAB0,
which also reads lh 0x7A78; func_800DBD78 calls ovl_11_func_800DBB94) —
shared-global + adjacency + call edges, TU membership still unproven.
Members:
- ovl_11_func_800DBB94 (m, matched this session, 0x4C, byte-exact first try,
  baseline flags) — search over the table: `p[0x3D3C + i * 6] != -1 &&
  p[0x3D3C + i * 6] == arg0` for i = 0..4 → return 1, else 0; arg0 is the value
  being looked up
- ovl_11_func_800DBF60 (m, already matched) — the simpler sibling: `p[0x3D3C + i * 6]
  != -1` for i = 1..4 → return 1, else 0 — 800DBB94 is the same scan made
  parameterized; identical toolchain, 8/9 shapes align in order
- ovl_11_func_800DBE9C (m, matched this session, 0x5C, byte-exact) — the
  shift/clear writer: copies record[i+1] → record[i] for i = 0..3 (12-byte
  unaligned struct copies) and stores the -1 sentinel into record[4]'s first
  halfword — the same -1 the searchers test; uses the shared-`%hi` +
  per-use `addiu %lo` tail-rematerialization idiom noted in the recorded
  `D_8006C858` run members, here with the terminator store spelled as a view-struct
  member
- ovl_11_func_800F13D8 (m) — returns 1 when a record's first halfword is zero
  and its second equals the u16 argument. Its apparent `D_800742B0` base is
  this same embedded table; shared data-family evidence, not proof of one TU
  across the separated link regions.
## `ovl_11` D_80127F88–D_80127FE8 constant-table cluster — 0x80112318 / 0x801123AC / 0x80112A84 / 0x80113A20 (confidence: medium)

One contiguous rodata region in ovl_11 (short tables plus one pointer table),
each slice read by a distinct function inside the unbroken link run
0x80112284–0x80113A20 — a shared-data-cluster tie, not a call edge. All four
slices are currently NON_MATCHING data; the readers below are their only
referencers in the binary.
- ovl_11_func_80112318 (s) — reads slice D_80127F88 as an s16 table base in a
  4-entry loop, AND-masks s32 global D_800719F8 by ~0x9
- ovl_11_func_801123AC (s) — byte-twin of 0x80112318 (same 0x94 shape; link-
  contiguous, 0x80112318 ends exactly at it), reads slice D_80127F90, masks
  D_800719F8 by ~0x11
- ovl_11_func_80112A84 (m, matched this session) — reads the 5-entry pointer
  table D_80127FD4 (middle slice) indexed by the s16 at D_8006C838+0xE776 via
  the +0x8000 two-stage split (the D_8006C838 reader idiom of cluster member
  0x8010C4B0); sole caller is link-separate 0x800FB908
- ovl_11_func_80113A20 (s) — reads slice D_80127FE8 as a 0x10-stride table base
  (`lh D_8012D110`, `sll ,4`, `addu`) and also touches D_80128128 / D_80128088

## `ovl_11` D_800719F8 bit-flag family — 0x80112318 / 0x801123AC / 0x8011256C (confidence: medium)

Members share the absolute `lui %hi(D_800719F8)` + retained `addiu %lo` base
register and the same bit-clear (mask and) / bit-set (ori via `0x0($base)`) idiom
on the single s32 flag, and all sit inside the unbroken link run
0x80112284–0x80113A20 already recorded for the D_80127F88 table cluster.
- ovl_11_func_80112318 (s) — 4-entry loop over D_80127F88, clears ~0x9
- ovl_11_func_801123AC (s) — byte-twin over D_80127F90, clears ~0x11
- ovl_11_func_8011256C (m, matched this session, 0x70, byte-exact) — clears
  bit 0x100 of D_800719F8, then unless flag at D_80070D30 (reached as
  `&D_800719F8 - 0xCC8`, one shared base register — a declaration-order tie
  which makes the -0xCC8 sibling part of the same data region) has bit
  0x200000 scans the 37-entry D_80076220 array (step +0x1D4) and sets bit
  0x100 when an entry's u16@0x4 exceeds 0xC350

## `ovl_11` table-search helper + gapless caller — 0x800C2884 / 0x800C28CC (confidence: low)

- ovl_11_func_800C2884 (m, matched this session, 0x48, byte-exact) — count/items
  table-search leaf `s32 func(s16 key, u32 *table)`: table[0] is the word count,
  items follow as words; returns the first index whose word == key, else -1
  (unsigned `sltu` loop count, key sign-extended from s16, reuses the `$a0`/`$a1`
  params so no saved registers).
- ovl_11_func_800C28CC (stub) — its sole caller, and 0x800C2884+0x48 = 0x800C28CC,
  so caller starts exactly where the helper ends (gapless link pair); invokes the
  helper with two shared tables `D_8009CBF8` and `D_8008F7F8` (both absolute
  `lui`+`addiu` %lo), feeding `(s16)`-sign-extended keys from an `lh`.

## `ovl_11` D_80129184 caller/callee pair — 0x800DD45C / 0x800DD4D8 (confidence: high)

Candidate same-TU pair in `ovl_11` (`Obj\GF_FARM.bin`): the function that
writes `D_80129184` sits hard-contiguous before and is called by the one that
reads it — the same shared-global + direct-call + zero-gap link-adjacency
fingerprint proven by the D_80123754 / D_8012D52C documented runs.

Fingerprints:
- **zero-gap link adjacency:** map confirms `ovl_11_func_800DD45C` (0x7C bytes
  at 0x800DD45C) ends exactly at `ovl_11_func_800DD4D8` (0xD8 bytes at
  0x800DD4D8);
- **shared global D_80129184:** 800DD45C writes it (`sw $a2, %lo(D_80129184)`),
  800DD4D8 reads it (`lw %lo`) and conditionally re-writes it (`sw %lo`) — the
  glocal mediates their data flow;
- **direct call:** 800DD4D8 calls 800DD45C (`jal ovl_11_func_800DD45C`) in two
  switch cases (arg2 = 2 and arg2 = 3); triage confirms the caller reads the
  callee's return value (`$v0`, checked against callers of the caller);
- **D_80129178 block adjacency:** the same `lui`+`%lo` base register reaches
  `D_80129178` (800DD4D8 only) and `D_80129184` (both), a two-word data block
  that no other ovl_11 code references.

Members (address order):
- ovl_11_func_800DD45C (m, matched this session, 0x7C, byte-exact) — the
  shared-global setter: increments a struct's halfword counter, tests it
  against a maximum, either returns 0 or (on overflow) writes `D_80129184 = arg2`,
  sets two flags and returns 1; uses the CAPTURE_PREV_RET dead-$v0 fossil (same
  as the documented v0-channel ovl_11 leaves 800D1CD0/800D0600/800D12A0)
- ovl_11_func_800DD4D8 (s) — the caller: dispatches on the callee's return
  value in a switch, then either calls func_8001AF44(7) or calls back into
  the callee with new arguments; sole caller of 0x800DD45C; its other global
  write is the `D_80129184 = 1` store at 0x800DD53C.

## `exe` byte-triple setter twins — 0x8001BF74 / 0x8001BF88 (confidence: medium)

- func_8001BF74 (m, matched via automatic reconstruction, byte-exact) — stores
  three s32 args into consecutive gp-relative bytes D_8005E2DC/DD/DE.
- func_8001BF88 (m, matched via automatic reconstruction, byte-exact) — the
  identical shape over the next byte triple D_8005E2E0/E1/E2.
- Evidence: adjacent addresses (0x14 apart, gapless), identical structure over
  adjacent data, shared small-data cluster — classic same-TU setter pair.

## `ovl_19` shared arg-record setters — 0x800BAC40 / 0x800BAC50 (confidence: medium)

- ovl_19_func_800BAC40 (m, matched via automatic reconstruction, byte-exact) —
  stores three s32 args into s16 fields +2/+4/+6 of its pointer argument.
- ovl_19_func_800BAC50 (m, matched via automatic reconstruction, byte-exact) —
  same record shape, fields +2/+4 only; gapless with the previous function.
- Evidence: identical argument-record layout (shared Ovl19Func800BAC40Arg view
  in include/game_types.h), adjacent gapless addresses.

## `ovl_23` shared arg-record setters — 0x800BB0C8 / 0x800BB0D8 (confidence: medium)

- ovl_23_func_800BB0C8 (m, matched via automatic reconstruction, byte-exact) —
  stores three s32 args into s16 fields +4/+6/+8 of its pointer argument.
- ovl_23_func_800BB0D8 (m, matched via automatic reconstruction, byte-exact) —
  byte-for-byte the same body over the same record shape (shared
  Ovl23Func800BB0C8Arg view), gapless with the previous function.

## `ovl_11` mask-switch leaf run — 0x800F1BD0 / 0x800F1C48 / 0x800F1CC4 (confidence: low)

Candidate same-TU run in `ovl_11` (`Obj\GF_FARM.bin`): gapless
link-contiguous switch-on-global mask-selector leaves. Already-matched
`ovl_11_func_800F1BD0` (the existing `D_80070CF2` leaf) is the immediate link
predecessor of `ovl_11_func_800F1C48`, which is in turn the immediate link
predecessor of the newly matched `ovl_11_func_800F1CC4`.

Fingerprints:
- **address adjacency:** `ovl_11_func_800F1BD0` (0x78 bytes at 0x800F1BD0)
  ends exactly at `ovl_11_func_800F1C48` (0x7C bytes at 0x800F1C48) —
  gapless link-contiguous pair;
- **shared idiom:** both read a single s16 global (`D_80070CF2` / `D_80070CF6`),
  switch on its value, assign a power-of-two mask to a local, then return
  `(mask & arg0) != 0` — 12/16 instruction shapes align in order
  (identical toolchain);
- **adjacent globals:** `D_80070CF2` and `D_80070CF6` sit adjacently in the
  D_80070Cxx base-engine region, already recorded as a shared-data cluster
  by the existing `D_80070CF2` switch-leaf pair entry;
- **rodata adjacency:** each leaf owns the jump table immediately following
  its predecessor's — `ovl_11_func_800F1C48`'s table ends at 0x2184 and
  `ovl_11_func_800F1CC4`'s (`jtbl_800B9FA8`) starts at 0x2188, gapless but
  for the 4-byte alignment pad word.

The third member weakens the adjacent-globals fingerprint: its switch global
is the s16 at `D_8006C838+0xE4C8` (0x8007AD00), outside the D_80070Cxx
region, and it alone carries an early all-masks-set guard
(`arg0 & 0xC3800 == 0xC3800` → return 1). Membership rests on the gapless
link run and the shared idiom (13/16 shapes align in order with
`ovl_11_func_800F1C48`), not on a shared global cluster.

Members (link order):
- ovl_11_func_800F1BD0 (m) — 4-case mask-switch over D_80070CF2
  (masks 0x40000000 / 0x20000000 / 0x10000000 / 0x08000000)
- ovl_11_func_800F1C48 (m) — 7-case sibling over D_80070CF6
  (masks 0x4000000 / 0x2000000 / 0x1000000 / 0x800000 / 0x400000 /
  0x200000 / 0x100000)
- ovl_11_func_800F1CC4 (m) — 5-case sibling over the s16 at
  D_8006C838+0xE4C8 (masks 0x80000 / 0x2000 / 0x40000 / 0x1000 / 0x800),
  plus the 0xC3800 all-set early-return guard

## `ovl_11` dispatch + 7-callback leaf run — 0x800F5944–0x800F6578 (confidence: high)

Candidate same-TU family of `ovl_11` (`Obj\GF_FARM.bin`) threaded through a
jump-table dispatch (`ovl_11_func_800F5944`, 0x27C) that selects one of seven
leaf callbacks and passes it as `$a2` to a shared engine callee
(`ovl_11_func_800F5BC0`). All seven targets are loaded as function pointers
from a single jump table (`jtbl_800BA33C`).

Fingerprints:
- **jump table:** `ovl_11_func_800F5944` reads a dispatch id from
  `struct.field_0xA` and jumps through `jtbl_800BA33C` to one of seven
  `lui+addiu`+`j` sequences that load a target address into `$s1`;
  each target is then passed as the callback argument to
  `ovl_11_func_800F5BC0`;
- **shared callee:** `ovl_11_func_800F5BC0` receives the callback pointer in
  `$a2` and is called 3+ times per dispatch invocation (for arg codes 1, 0xA,
  and the stack-copy path);
- **address adjacency:** the dispatch head (0x800F5944), the shared callee
  (0x800F5BC0), and all seven targets (0x800F5D04–0x800F6578) occupy a
  contiguous 0xE34-byte run with no gaps;
- **shared signature pattern:** the three matched targets
  (`ovl_11_func_800F64F8`, `ovl_11_func_800F6218`, and
  `ovl_11_func_800F6578`) share the same
  `s32(s32 arg0, s32 *arg1, s32 *arg2)` switch-return-id idiom.

Members (link order):
- ovl_11_func_800F5944 (s) — dispatch head: reads struct id via `lh` at +0xA,
  switches through jtbl_800BA33C, loads target address into $s1, and calls
  ovl_11_func_800F5BC0 with arg codes 1/0xA and the stack-copy path;
  writes back D_8006C838+0x5DD8/0x5DD4/0x5DCC through the callee
- ovl_11_func_800F5BC0 (s) — shared engine callee: takes a callback in $a2
  and calls it with struct-field arguments; invoked by the dispatch head for
  multiple arg codes
- ovl_11_func_800F6118 (s) — dispatch target case 0
- ovl_11_func_800F64F8 (m, this session) — dispatch target case 1: leaf
  switch-return-id mapper, maps id 0x64/0x65/0xE8/0x122–0x124 to return
  codes 0x19/0x1A/0x1E/0x1D
- ovl_11_func_800F5D04 (s) — dispatch target case 2
- ovl_11_func_800F62D8 (s) — dispatch target case 3; also reads D_80070D0E
  (listed in the D_80070D0E cluster)
- ovl_11_func_800F6218 (m, this session) — dispatch target case 4: leaf
  switch-return-id mapper, maps id 0x64/0x65/0x68/0x69/0xE8/0x122–0x124 to
  return codes 2/3/4/7/6/5
- ovl_11_func_800F5EE0 (s) — dispatch target case 5
- ovl_11_func_800F6578 (m, already matched) — dispatch target case 6: leaf
  switch-return-id mapper, maps id 0x64→0x11/0x65→0x13

## `ovl_11` D_800719F8 flag-word status group — 0x801124E8–0x801126C8 (confidence: medium)

Candidate same-TU group of `ovl_11` (`Obj\GF_FARM.bin`) built around the
`D_800719F8` flag word. Evidence produced by matching the members across
this region's sessions:

- **address adjacency:** `ovl_11_func_801124E8` (0x84 bytes) ends exactly at
  `ovl_11_func_8011256C`, which (0x70 bytes) ends exactly at
  `ovl_11_func_801125DC`, which (0x90 bytes) ends exactly at the
  `ovl_11_func_8011266C` stub (0x5C), which ends exactly at
  `ovl_11_func_801126C8` (0xB4) — a contiguous zero-gap link-order run; all
  matched members are leaf void functions;
- **shared global cluster:** all take no arguments and operate on the
  `D_800719F8` flag word, reading status data as far pointer offsets from it;
- **shared idiom:** all spell the far access as `base = &D_800719F8;` plus
  `(u8 *)base - <const>` anchor arithmetic (801124E8, 801125DC and 801126C8
  share the identical `-0x51C0` anchor constant, 8011256C uses `-0xCC8`
  for `D_80070D30`) — the same anchor-construction fingerprint, not a
  direct-global spelling;
- **shared data region:** 801124E8, 801125DC and 801126C8 all read the
  halfword cluster at `anchor+0x44C4`–`anchor+0x44F8` (the
  `D_80070D06`/`08`/`0A`/`0C` file-status flags, the `D_80070D30` word and
  neighbours), anchoring them to one data region.

Members (link order):
- ovl_11_func_801124E8 (m, this session) — file-status flag routine: clears
  0xE0 off `D_800719F8`, sets 0x20 while the `D_80070D30` 0x800 bit is
  clear, then branches on the `D_80071A1E` state halfword (0: set 0x40 and
  return; 2: return) and the `D_800719FC` x halfword (>0: return), falling
  through to set 0x80
- ovl_11_func_8011256C (m, already matched) — companion flag routine: clears
  0x100 off `D_800719F8` and re-sets it from the `D_80070D30` 0x200000 bit
  and a 37-entry scan of `D_80076220` u16 fields
- ovl_11_func_801125DC (m, this session) — file-status flag routine: clears
  0x3E00 off `D_800719F8`, then sets the first matching bit of
  0x200/0x400/0x800/0x1000 from the `D_80070D0A`/`06`/`08` halfwords (with a
  `D_80070D06 == 1` tie-break) via the shared `-0x51C0` anchor, falling
  through to set 0x2000 and store it only when `D_80070D0C` is clear
- ovl_11_func_801126C8 (m, this session) — file-status flag routine: clears
  0x38000 off `D_800719F8` via the shared `-0x51C0` anchor, then sets
  0x10000 when `D_80070D0A` is set and the `D_80070D30` 0x100000 bit is
  clear; otherwise gates on `D_80070D08` and the `D_80070D30` 0x100000 bit
  and sets 0x8000/0x20000 from the `D_80070D30` 0x100/0x200 bits

The stubs immediately before the group (`ovl_11_func_80112494`, 80112440,
801123AC, 80112318, 80112284, 80112160) and the `ovl_11_func_8011266C` stub
inside the run may extend it; membership is not yet evidenced.

## `ovl_11` record-halfword match sibling pair — 0x800F13D8 / 0x800F144C (confidence: low)

Two link-adjacent (zero gap: 0x800F13D8 ends at 0x800F144C exactly) leaf
helpers that answer the same kind of question over a two-halfword record
`{first, second}` from opposite sides, and no shared caller explains the
adjacency: 0x800F144C's only caller is `ovl_11_func_800F1078` (`jal` at
0x800F1194, link-earlier), while 0x800F13D8's caller is `ovl_11_func_800F1AE0`
(link-later). Shared author idiom, witnessed by both matched sources: a
`found`-flag `for` + `break` loop returning 1/0 with the result kept in `$t0`
through the `jr $ra; addu $v0,$t0,$zero` epilogue — 0x800F144C's byte-exact
source needed exactly this `for`/`break` spelling (the goto/while respelling
left a 7-word temp/result register swap), matching the already-matched
`ovl_11_func_800F13D8` shape. Predicates are complementary: 0x800F13D8 tests
`record[0]==0 && record[1]==arg0`; 0x800F144C's zero-length path tests
`record[0]==arg0 && record[1]==0`. 0x800F144C takes the record by pointer
parameter rather than reading `D_8006C838`, so no shared-global tie yet; TU
membership unproven.

Members:
- ovl_11_func_800F13D8 (m, matched earlier) — sentinel-row lookup over the
  `D_8006C838` record table: returns 1 when a record's first halfword is zero
  and its second equals the u16 argument
- ovl_11_func_800F144C (m, matched this session, 0x8C, byte-exact) —
  parameterized window matcher over a caller-supplied two-halfword record:
  returns 1 immediately for arg0==0x1F or arg1==0x1F; clamps arg1 to 0x18;
  zero-length path is the exact-match test above, otherwise scans
  `arg0..arg0+arg1-1` mod 0x18 for the record's first halfword

## `ovl_11` 0x800C9888–0x800C99C8 shared-caller link run (confidence: low)

Evidence: one unbroken link-order run — `ovl_11_func_800C9888` (0xB0, ends
0x800C9938), `ovl_11_func_800C9938` (0x90, ends 0x800C99C8),
`ovl_11_func_800C99C8` — and the call graph agrees: 0x800C99C8 is the sole
caller of both 0x800C9888 and 0x800C9938 (its other callees 0x800CBE14 and
0x800C70CC sit outside the band). No shared globals: 0x800C9888 is a pure
leaf dispatch with no memory traffic, so this is adjacency + call-edge only
and the entry for the D_801230B0/D0/F0 pair-table run above already carries
0x800C9938/0x800C99C8 with its own low-confidence tie.

Members:
- ovl_11_func_800C9888 (m, matched this session, 0xB0, byte-exact) — leaf
  u16 event-code dispatcher: switch over arg0 (0x1000/0x3000→2, 0x2000/0x6000→3,
  0x8000/0x9000→1, 0x4000/0xC000→0), default passes arg1 (u16) through; no
  loads, stores or calls.
- ovl_11_func_800C9938 (m) and ovl_11_func_800C99C8 (stub) — see the
  D_801230B0/D0/F0 pair-table selector run entry above.

## `ovl_11` D_801230B0/D0/F0 {s16,s16} pair-table selector run — 0x800C9938 / 0x800CB114 (confidence: low)

Evidence: `ovl_11_func_800C9938` (matched, byte-exact clean C, 0x90) is the
first matched reader of the contiguous 0x20-apart {s16,s16} pair tables
`D_801230B0`/`D_801230D0`/`D_801230F0` (0x80123xxx data body) — absolute
`lui`+`addiu %lo` base, selection by arg0 `u16@+0x3C` (==2 → B0+0x10,
==4 → D0) then arg0 flags bit 0x100 of s32@+0x6C (→ D0 when mode==2 else F0),
in-place pointer advance by `u16@+0x38 * 4`, two signed `lh` cell reads.
Stub `ovl_11_func_800CB114` (0x3CC) is a second reader of `D_801230B0` with
the same absolute base idiom and `lh` pair loads (index `(unk38*2)+s16@+0x3C`),
so the table family has one matched and one stub reader in the same
0x800C9xxx–0x800CBxxx link band. Both touch the shared object flags word
s32@+0x6C (matched leaf `ovl_11_func_800CD6F4` tests bit 8 of the same field),
and this function's link-adjacent caller 0x800C99C8 reads `D_801231F4` as u16 —
tying the band to the recorded `D_801231F4`/`D_801231F8`/`D_801232B4` cluster,
whose entry already lists 800CB114 and 800C99C8 as users. Address-apart
(0x800C9938 vs 0x800CB114, ~0x17DC) so same-TU membership stays unproven (low).

Members:
- ovl_11_func_800C9938 (m, matched this session, 0x90, byte-exact) —
  three-table {s16,s16} cell selector leaf: accumulates the selected cell's
  two halves into arg0 s32@+0x110/@+0x118 and returns the second.
- ovl_11_func_800CB114 (stub) — second reader of `D_801230B0`, same absolute
  `lui`+`addiu %lo` base and `lh` pair-load idiom, 0x3CC.

## `ovl_11` D_80128DE8 bounds-struct init/copy/clamp run — 0x800DAFD4–0x800DB054 (confidence: medium)

Evidence: three contiguous link-order functions (0x800DAFD4 ends 0x800DB00C,
which ends 0x800DB054, which ends 0x800DB0E4 — one unbroken run) whose only
shared state is the 0xE-byte s16 struct `D_80128DE8`, with complementary
roles: writer, copier, consumer. `ovl_11_func_800DAFD4` and
`ovl_11_func_800DB00C` are matched byte-exact and each carry the same local
`Ovl11DE8` typedef + `extern` idiom; `ovl_11_func_800DB054` (matched this
session, byte-exact) reads all six populated fields as clamp bounds against
an arg struct — the consumer side of the same object. Shared-global cluster +
address adjacency + role complementarity; no call edges between them, so
same-TU membership stays medium rather than proven.

Members:
- ovl_11_func_800DAFD4 (m) — resets the six bound halfwords to constants
  (-0x32C8/0x1194/-0x1F40/0/0x1B8/0x9C4).
- ovl_11_func_800DB00C (m) — copies two arg structs' {unk0,unk2,unk4} triples
  into D_80128DE8 +0x0 and +0x8.
- ovl_11_func_800DB054 (m, matched this session) — clamps arg0->unk0/unk4
  into [D_80128DE8.unk0..unk8] / [unk4..unkC] with four min/max halfword
  clamps (leaf, 0x90, void).

## `ovl_11` D_8006C838 table-scan caller + exclusion-set leaf — 0x800F00E4 / 0x800F021C (confidence: low)

- ovl_11_func_800F00E4 (stub) — sole caller (two `jal` sites): nested s16-table
  scans over two sub-tables inside `D_8006C838` (sub-bases +0x78EE and +0x55C6,
  both absolute `lui`+`%lo`, same shared-buffer fingerprint as the D_8006C838
  cluster) counting entries whose halfword is NOT in the exclusion set below,
  then scales the count ×25.
- ovl_11_func_800F021C (m, matched this session, 0xAC, byte-exact) — the
  exclusion-set membership leaf `s32 func(s16)`: returns 0 for the 18 values
  0x3A–0x40 and 0x16C–0x175 (one 18-term `||` chain, constants in `$v0`),
  else 1; touches no globals. 0x800F00E4+0x138 = 0x800F021C, so the helper
  starts exactly where its only caller ends (gapless link pair; call graph and
  link order agree — same-TU hint only).

## `ovl_11` struct_80076220 record-init/clear run — 0x800C1BA0–0x800C1D68 (confidence: medium)

Candidate same-TU family of `ovl_11` (`Obj\GF_FARM.bin`): one gapless
link-order run whose matched members all operate on the 0x1D4-byte record of
the 37-entry absolute-addressed array `D_80076220`.

Fingerprints:
- **gapless contiguous run**: 0x800C1BA0 (0x40, ends exactly at 0x800C1BE0)
  → 0x800C1BE0 (0x28, ends exactly at 0x800C1C08) → 0x800C1C08 (0x54, ends
  exactly at 0x800C1C5C) → 0x800C1C5C (0x34, ends exactly at 0x800C1C90) →
  0x800C1C90 (0x2C, ends exactly at 0x800C1CBC) → 0x800C1CBC (0xAC, ends
  exactly at 0x800C1D68) → 0x800C1D68 (0x22C, ends exactly at 0x800C1F94).
- **shared record type**: `ovl_11_func_800C1C5C` memsets exactly 0x1D4 bytes
  (`sizeof(struct_80076220)`) then writes s16@0 = −1 — a whole-record
  initializer; `ovl_11_func_800C1BE0` and `ovl_11_func_800C1C90` walk the
  same array by the same 0x1D4 stride (37 entries), clearing unkA and
  unk1E bit 0x10 respectively. Three members of one run on one record type.
- **shared callee pattern**: 800C1C08 and 800C1CBC each call 800C1C5C then
  80107DD0 (the run's heads pair the initializer with the same callee).

Members (address order):
- ovl_11_func_800C1BA0 (s) — calls 800C1CBC and 800F0C70
- ovl_11_func_800C1BE0 (m) — zeroes u16 unkA of all 37 D_80076220 entries
- ovl_11_func_800C1C08 (s) — calls 800C1C5C, 80107DD0, 800F0C70
- ovl_11_func_800C1C5C (m, matched this session) — record initializer:
  `memset(arg0, 0, 0x1D4)` then s16@0 = −1; also a member of the
  memset-clear struct-constructor idiom family above
- ovl_11_func_800C1C90 (m) — clears bit 0x10 of u16 unk1E in all 37 entries
- ovl_11_func_800C1CBC (s) — calls 800C1C5C, 80107DD0, 800C3548
- ovl_11_func_800C1D68 (s) — calls 800C3548, func_80012A34, func_8001AF70

---

## `ovl_11` struct_80076220 u16@+4 reader/writer cluster — 0x800F02C8 / 0x8011256C / 0x8011FF0C / 0x800C3CCC (confidence: low)

Four ovl_11 functions reaching the same field of the 37-entry 0x1D4-stride
absolute-addressed array `D_80076220`: the unsigned halfword at entry +0x4
(entry offset 4 of `struct_80076220`), addressed through the shared two-stage
split `p = (char *)&D_8006C838 + idx * 0x1D4; *(u16 *)(p + 0x8000 + 0x19EC)`
(`D_8006C838 + 0x8000 + 0x19EC` = `D_80076220 + 0x4`). Same shared-global
cluster fingerprint as the documented D_8006C838 entry — the base is absolute
in every site (extern in the overlay, never GP-relative), and the three
addresses are far apart (0x800F02C8 vs 0x8011256C vs 0x8011FF0C), so this is
a data tie, not link-order adjacency; TU membership unproven.

Members:
- ovl_11_func_800F02C8 (m, matched this session, 0x90, byte-exact) — argmax
  scan: indexes the array by the five s16 values at `D_80124DD8`..+0x8 (first
  project reference to that data region), tracks the largest entry whose
  u16@+4 >= 0x1F4, returns its index else -1; shares the exact `+0x8000
  +0x19EC` split spelling with 8011FF0C (identical toolchain, same container)
- ovl_11_func_8011256C (m) — scans all 37 entries and sets the D_800719F8 bit
  0x100 when u16@+4 > 0xC350 (recorded under the D_800719F8 bit-flag family;
  the scan reaches this same field via `&D_80076220` + pointer walk)
- ovl_11_func_8011FF0C (m) — increment/limit writer of the same u16@+4 field
  for one entry (`arg0 * 0x1D4` stride, same split form)
- ovl_11_func_800C3CCC (m, matched this session) — guarded countdown sweep:
  when the s16 behind the far pointer `*(s32 **)((char *)&D_8007AFF0 +
  0x25388)` reads 0x13, decrements the u16s at +0x2 and +0x4 of all 37
  entries (clamping each at 0, the +0x2 one via a signed-16 view — first
  recorded reference to u16@+2), walking `&D_80076220` by 0x1D4; also
  increments `D_8006C838 + 0x5238` while it is < 0xF; same data tie as the
  other members (0x800C3CCC is far from all three), TU membership unproven

---

## `ovl_11` 3×s32 vector-record pair — 0x800D03B4 / 0x800D0408 (confidence: medium)

Two link-contiguous leaf functions operating on the identical 12-byte record
(three s32 components at 0/4/8):

- `Struct_800D03B4` (field_0/4/8, local typedef in the matched source) and the
  type 0x800D0408 writes (`Recon800D0408A1View`, game_types.h) are the same
  layout — same component offsets, same component width;
- link-order adjacency: `ovl_11_func_800D03B4` (0x54) ends exactly at
  `ovl_11_func_800D0408` (0x94); the map places them one unbroken run, with
  stub `ovl_11_func_800D049C` continuing it;
- semantic kinship: 0x800D03B4 is the record's component-wise add/clear
  writer, 0x800D0408 its component-select writer (s16 selector, zeroes the
  record then stores ±arg2 into one component, and clears all three for the
  all-zero selector 4).

Members (address order):
- ovl_11_func_800D03B4 (m) — vector-record add: adds arg1's three components
  into arg0's, optionally re-clearing arg1
- ovl_11_func_800D0408 (m, matched this session) — vector-record component
  select: zeroes the record, switch on s16 arg0 (−2..4) stores ±arg2 into
  component 0/4/8 or clears the whole record, returning −arg2 on the negative
  paths
## `ovl_11` D_8012D110 record feed/clear caller/callee pair — 0x80113B80 / 0x80113C3C (confidence: medium)

Candidate same-TU pair in `ovl_11`: zero-gap link adjacency + direct call + a
shared global that mediates their data flow — the same fingerprint as the
documented D_80129184 caller/callee pair.

Fingerprints:
- **zero-gap link adjacency:** `ovl_11_func_80113B80` (0xBC bytes) ends exactly
  at `ovl_11_func_80113C3C` (0x94 bytes at 0x80113C3C, matched this session,
  byte-exact);
- **direct call, sole caller:** 80113B80 calls 80113C3C once, conditionally
  (after a `func_8001AF70` round-trip gates on the record's +0x8/+0xA values);
  the callee's return value is unused by the caller and its early path sets no
  `$v0` (void);
- **shared global D_8012D110:** the caller reads +0x8/+0xA as s16, computes the
  `400 * x` strength-reduced products, and stores results into
  `D_8006C838`+0x52C8/0x52CC/0x52D0; the callee then reads +0x0 as a gate,
  multiplies the same +0x8/+0xA fields by 400, writes results into
  `&D_8007AFF0 + 0x250E4..0x250FC` (the `D_800A00D4..D_800A00EC` block, reached
  via the two-stage `base + 0x20000` split), and copies +0x8/+0xA back into
  +0x4/+0x6 — complementary populate/clear roles over one record;
- the wider `D_8012D110` block has readers scattered across ovl_11
  (0x80112EC4–0x80113818, 0x80113A20, 0x800DBFEC), so the global alone is not a
  TU tie; and the callee's output block `D_800A00CC+0x8..0x20` has separate
  direct readers at 0x800DBFEC / 0x80104CB8 — data-family ties only.

Members:
- ovl_11_func_80113B80 (s) — populates the D_8012D110 record (+0x8/+0xA) from
  the `D_8006C838`+0x52C6 state, writes the 400*x results into the
  `D_8006C838`+0x52C8/0x52CC/0x52D0 scratch words, then conditionally calls the
  callee.
- ovl_11_func_80113C3C (m, matched this session, 0x94, byte-exact, void) —
  gated by the record's s16 at +0x0: clears bit 0x1000 of the word at
  `D_800A00D4`, zeroes `D_800A00EA`, stores the two 400*x products at
  `D_800A00E8`/`D_800A00EC` (the latter doubled as the function's residual
  `$v0`), and copies +0x8/+0xA back into +0x4/+0x6.

## `ovl_11` D_80129560 s32-table accessor family — 0x800E5A1C–0x800ED760 + 0x800EC490 (confidence: low)

Candidate same-TU family of `ovl_11` (`Obj\GF_FARM.bin`): eight matched functions
sharing the one ovl_11-private 0x50-byte s32 table `D_80129560`
(`globals_override.h`), each guarded-indexing it with `s16`-scaled slots.

Fingerprints:
- **shared private global:** `D_80129560` is defined in ovl_11 data and has
  exactly these eight accessors container-wide — readers 800E6914 (bit-gated
  `arg0`-selects which of `arg2`/`arg3` resolve through the table),
  800E69B8 (passes `D_80129560[arg2]` as `ovl_11_func_800EFABC`'s third arg),
  800E5A1C (loads `D_80129560[(s16)arg1]` as the limit, compares
  `D_80129560[(s16)arg0]`/2 — or `(s16)arg0`/2 when `arg2 == 0` — against it),
  800ED760 (`arg2 != 0` resolves the scan target through the table),
  800EB79C (`arg2 != 0` resolves the record index through the table) — and
  writers 800E8BA0 (stores the `D_8006C838`+0x5DB4 entity's u16@+2 into the
  slot), 800E8D00 (stores `D_8006C838`+0x524C/0x524E state), 800EC490
  (800E5A1C also increments `D_80129560[(s16)arg1]`);
- **what the tie is not:** the members are scattered over ~0x6E4C of text with
  no call edges among them (800EC490 has no callers anywhere in the link —
  an exported entry), so per the ledger convention the global alone is a
  data-family tie, not a TU tie.

Members:
- ovl_11_func_800E5A1C (m, matched 2026-09 — this session, 0xC0, byte-exact) —
  compare-then-increment probe: sets the returned flag when
  `D_80129560[(s16)arg0] / 2 < limit` (arg2 != 0) or `(s16)arg0 / 2 < limit`
  (arg2 == 0) with `limit = D_80129560[(s16)arg1]`, then increments
  `D_80129560[(s16)arg1]` unless `arg3 != 0 && (D_8006C844 & 0x8000000)`;
  lowest-address member of the family, at the head of the recorded
  0x800E5A1C–0x800EExxx accessor band, same absolute `lui`+`addiu %lo` base
  and s16-fused index idiom as the sibling accessors.
- ovl_11_func_800E6914 (m) — three-slot compare leaf: `D_80129560[arg1]` vs
  bit-selected `D_80129560[arg2]`/`[arg3]`, returns the in-range test.
- ovl_11_func_800E69B8 (m) — forwards `D_80129560[arg2]` into
  `ovl_11_func_800EFABC`.
- ovl_11_func_800E8BA0 (m) — writer: `D_80129560[arg1] = entity->u16@+2`.
- ovl_11_func_800E8D00 (m) — writer: stores the store-view s16 pair into slots.
- ovl_11_func_800EB79C (m, matched 2026-09 — this session, 0xC0, byte-exact) —
  record flag-field setter: index = `D_80129560[(s16)arg0]` when `arg2 != 0`,
  the raw `(s16)arg0` otherwise; then in the 0x1D4-stride record space off
  `D_8006C838` (field u16 @ +0x9A08 + index*0x1D4) clears the halfword to its
  0x3FFF payload and re-sets 0x8000 (`arg1 == 0`) / 0x4000 (`arg1 == 2`) via a
  case-0/1/2 switch; returns 1. Reader-side counterpart of the writer members:
  the table slot it consumes is what `800E8BA0`/`800E8D00`/`800E9778` fill.
- ovl_11_func_800EC490 (m, matched 2026-11 — this session, 0x9C, byte-exact) —
  four-slot default restore: for each of four args, if `!= -1`, writes
  `D_80129560[arg] = D_80070D06/08/0A/0C` (four adjacent engine-rodata u16s,
  read nowhere else in ovl_11 except `D_80070D06` at 800CD0C0); returns 1.
  Sits zero-gap between `ovl_11_func_800EC354` (0x13C, stub) and
  `ovl_11_func_800EC52C` (0xF7C, stub) — adjacency uncorroborated while both
  neighbours are unmatched, recorded here as position only.
- ovl_11_func_800ED760 (m) — writer-side probe: resolves scan target through
  the table when `arg2 != 0`, then scans `D_80070C72[5]`.
- ovl_11_func_800E9778 (m, matched 2026-11 — this session, 0xC0, byte-exact) —
  three-slot snapshot write: selects a 0xC-byte record from the `D_80076280`
  0x1D4-stride table (special base `D_80071B00` when `arg0 == 0x29`, bounds
  `(u32)(arg0-1) < 0x24` otherwise, else returns 0), then for each of three
  args, if `!= -1`, writes `D_80129560[arg] = record.field` (fields +4/+0/+8);
  returns 1. Same guarded multi-slot write idiom and return-1 shape as
  `800EC490`; sits in the same 0x800E5A1C–0x800EExxx accessor band.

## `ovl_11` D_80076280 record-selector pair — 0x800E9778 / 0x800EDEB8 (confidence: low)

Data-family tie: `ovl_11_func_800E9778` and `ovl_11_func_800EDEB8` are the only
two functions container-wide touching the `D_80076280` record table, and their
original instruction streams share the same record-selector construction —
`0x29` test selecting base `D_80071B00`, otherwise the identical
`(a<<3 - a)<<2 + a)<<2 + a)<<2` multiply chain for the 0x1D4 byte stride —
with complementary effects on the selected record (copy fields out to
`D_80129560` slots vs add `2*arg` deltas into the fields). No link-order
adjacency (~0x2740 apart), so per ledger convention this is a shared-global
tie, not a TU tie. Both members also belong to the D_80129560 accessor family
above.

Members:
- ovl_11_func_800E9778 (m) — snapshot: record selector + three -1-guarded
  `D_80129560[arg] = record.field` writes, bounds-checked, returns 1/0.
- ovl_11_func_800EDEB8 (m) — delta: same record selector, no bounds check,
  adds `arg*2` into record fields +4/+0/+8, returns 1.

A third function shares the record geometry without the selector: `ovl_11_func_800EB79C`
(m) runs the identical `((v<<3 - v)<<2 + v)<<2 + v)<<2` multiply chain for the
0x1D4 byte stride against base `D_8006C838 + 0x9A08` (= `D_80076280` − 0x40),
read-modify-writing the u16 flag halfword there (0x3FFF payload, 0x8000/0x4000
status bits). Recorded as same-geometry evidence tying the D_80129560 accessor
family to this record table; whether its field is a -0x40 sub-table view or
field +0x194 of the preceding slot is unresolved while the record layout is.

## `ovl_11` D_80071A90/D_80071AC0 3×s16 record-table compaction cluster — 0x800C9D98–0x800CAE64 (confidence: medium)

Evidence: `D_80071AC0` is `D_80071A90 + 0x30` (two adjacent 8-entry tables of
6-byte, three-s16 records), and the cluster's functions all operate on that
record shape: the adjacent caller pair `800C9D98`/`800C9DC0` passes each table
with count 8 to `ovl_11_func_800CADBC`, which sits immediately before its
other caller `ovl_11_func_800CAE64` (link-order adjacency, and `800CAE64`
calls `800CADBC` three times around its own record save/zero/rotate idiom).
The compaction body's loop shapes also align with exe `func_8001AE34`'s scan
loop (idiom-precedent hit), and `func_8001AE34` scans `D_80071A90` with the
same 6-byte entry shape — cross-container, so it witnesses the shared object,
not TU membership. `ovl_11_func_80102844` (far link order, separate-TU prior)
is a pure 6-byte-stride accessor over `D_80071AC0`/`D_80070D42` and is listed
as same-object only. Note: `globals.h` still types `D_80071A90` as `s32[3]`
and `D_80071AC0` is only declared ad-hoc; the record-table reading is now
witnessed by three functions.

Members:
- ovl_11_func_800CADBC (m) — table compaction: moves each later non-empty
  3×s16 record into the first empty slot of one table and zeroes its source.
- ovl_11_func_800CAE64 — record remove/rotate: saves a record to the stack,
  zeroes it, compacts via `800CADBC`, and moves the tail record into the hole.
- ovl_11_func_800C9D98 (m) — compacts `D_80071AC0` (count 8).
- ovl_11_func_800C9DC0 (m) — compacts `D_80071A90` (count 8).

Same object, outside the suspected TU:
- ovl_11_func_80102844 (m) — accessor: `(arg1*6)+&D_80071AC0`, or into
  `D_80070D42` for a second table.
- exe func_8001AE34 (m) — scans `D_80071A84`/`D_80071A90`/`D_80070EC2` for an
  entry whose first s16 is in [0x15,0x1A); shares the entry shape and the
  compaction-loop idiom, cross-container.

## `ovl_11` D_80125528/D_80126254 record-table + D_800957F8 blob cluster (confidence: low)

Evidence: a shared global cluster — `D_80125528` (per-index pointer table),
`D_80126254` (per-index s16 key-list table) and the `D_800957F8` blob base —
is operated on by four functions, two of which are directly linked
(`ovl_11_func_800BD5A8` calls `ovl_11_func_800DA588` after filling its entry
from the same tables). `ovl_11_func_800D688C` (m) is the lookup accessor:
given an s16 key it resolves the index through the `D_8007AFF0+0x25388`
header field, compares it against the `D_80126254[idx]` s16 list, and returns
the matching `D_80125528[idx]` entry offset by `D_800957F8` — the read side of
the record system `800BD5A8`/`800DA588` populate. Members are link-order far
apart (0x800BD5A8, 0x800D688C, 0x800DA588, 0x801110CC) and the tables are
container data, so this witnesses a shared data system, not proven TU
membership.

Members:
- ovl_11_func_800D688C (m, matched this session) — key lookup: maps an s16
  key through `D_80126254[idx]` to an entry of `D_80125528[idx]`, returning
  the entry word offset by `D_800957F8`, or NULL.
- ovl_11_func_800BD5A8 — per-index loader: memcpy's the `D_80125528[idx]`
  record out of the `D_800957F8` blob, then calls `800DA588`.
- ovl_11_func_800DA588 — iterates a `D_80125528` entry's records against
  `D_80070400`, called from `800BD5A8`.
- ovl_11_func_801110CC — reads the `D_80125528` table (role not yet
  reconstructed).

## `ovl_11` D_801281F0 {s16,s16} pair-table accessor cluster — 0x800BF4B4 / 0x800CE034 / 0x80113310 (confidence: low)

Candidate same-TU family of `ovl_11` (`Obj\GF_FARM.bin`) sharing the
ovl_11-private 0x80128xxx pair table `D_801281F0`: 4-byte-stride {s16,s16}
records (an alternate +0x10 segment exists), indexed by a struct's `u16@+0x38
* 4` and read as an `lh`/`lhu` halfword pair at +0/+2.

Fingerprints:
- shared private global: `D_801281F0` has exactly these three referencing
  functions container-wide, all with the absolute `lui`+`addiu %lo` base and
  the same `unk38 << 2` index into halfword pairs;
- shared struct view: `800CE034` and `80113310` read the identical arg0 view
  (`u16@0x38`, `s32@0x100/0x104/0x108`) and both add cell[0] to the +0x100
  component and cell[1] to the +0x108 component;
- what the tie is not: the members are scattered over ~0x73E5C of text
  (0x800BF4B4 → 0x80113310) with no call edges among them, so per the ledger
  convention this is a data-family tie, not proven TU membership (two of the
  three members are still stubs).

Members:
- ovl_11_func_800BF4B4 (s) — collision-ish probe: reads a cell pair from
  `D_801281F0[arg<<2]`, forms {x+dx, y, z+dz} records on the stack and calls
  `ovl_11_func_8011E090` twice on them
- ovl_11_func_800CE034 (m, matched this session, 0xBC, byte-exact) — cell
  applier: copies arg0's s32@0x100/0x104/0x108 into arg1, selects the table
  segment (+0x10 when arg2==2), then adds cell[0] to the first component and
  cell[1] to the third (dividing each by 2 when arg2==4)
- ovl_11_func_80113310 (s) — same struct view and table read as 800CE034
  (no +0x10 select), passing the summed pair to `ovl_11_func_801136D0`

## `ovl_11` D_8006C838 pool-entry run — 0x800F4994 / 0x800F4A58 / 0x800F4FC8 (confidence: medium for the pair, low for 0x800F4FC8)

Fingerprints:
- shared private global: `D_80129634` is referenced container-wide by exactly
  `ovl_11_func_800F4994` (stores 3) and `ovl_11_func_800F4A58` (decrements to
  0 as a guard), both with the absolute `lui`+`sw`/`lw` form;
- shared struct view: all three view `D_8006C838` as a giant struct whose
  +0xDDD4 field is the pool-entry pointer (absolute 0x8007A60C), each with a
  per-file local view typedef — `field_DDD4` has no other referencing
  functions in the container;
- link-order adjacency for the pair: `ovl_11_func_800F4994` (0xBC) ends at
  0x800F4A50 and `ovl_11_func_800F4A58` (0x48) follows immediately (an
  8-byte function at 0x800F4A50 between them);
- what the tie is not: `ovl_11_func_800F4FC8` sits ~0x570 bytes later in link
  order (0x800F4E84 between), so its membership rests on the shared
  `field_DDD4` data view alone; and the container-wide
  `far_base = &D_8007AFF0` idiom is not part of this tie — none of the three
  uses it.

Members:
- ovl_11_func_800F4994 (m, matched this session, 0xBC, byte-exact) — bounds
  gate: requires the far state halfword (D_8007AFF0+0x25476) to equal the
  pool entry's s16@0, tests a position's three components against the entry's
  limits at +0xC/8/0x10 (±20/±200/±200), then sets `D_80129634 = 3` and
  returns the entry pointer.
- ovl_11_func_800F4A58 (m) — flag timer: when the pool entry's flag word bit
  8 is set and `D_80129634` has not counted down to 0, clears the bit and
  decrements `D_80129634`.
- ovl_11_func_800F4FC8 (m) — pool advance: on a flag in the view's +0x44F8
  word, steps the pool entry pointer forward and clears the entry's low flag.
## `ovl_11` D_80075BC4 record-table scan caller/callee pair — 0x801097F4 / 0x801098B0 (confidence: low)

- call-graph adjacency for the pair: `ovl_11_func_801097F4` (0xBC) ends at
  0x801098B0 and its sole caller `ovl_11_func_801098B0` starts exactly there
  (link order and the call graph agree); the caller's `jal` reads the
  callee's result (`beq $v0, 1`).
- shared by-value record ABI: the callee takes a struct by value (first 16
  bytes ride `$a0`-`$a3` and are homed to sp+0..0xC on entry, tail fields on
  the stack — s16 selector at 0x10, s32 radius at 0x14, out pointer at
  0x18), and the caller materializes exactly those stack slots from another
  record's fields at +0x30..0x44 before the call. Same homing idiom family
  as the 0x8011D934 by-value run, but a different record type.
- shared-global fingerprint: D_80075BC4 is referenced by eight container
  functions (0x800BEB28, 0x800CE96C, 0x800CEBC8, 0x800CF044, 0x800CF36C,
  0x800D2240, 0x800D2F48, 0x801097F4); only the last is matched, so data TU
  ownership is unconfirmed.

Members:
- ovl_11_func_801097F4 (m, matched this session, byte-exact) — leaf: scans
  six 0xB0-byte records at D_80075BC4 for tag 0x15B, the arg's s16 selector
  at +0x30, and a ±radius window over the s32 coordinates at +0x38/+0x40;
  stores the first full match's pointer through the arg's out pointer and
  returns 1/0.
- ovl_11_func_801098B0 (s) — run tail: sole caller, builds the by-value
  record (selector from a source record's s16@+0x30, radius from +0x38, out
  pointer = &D_8012D080) and dispatches on the scan result.

## `ovl_11` D_8007AFF0 +0x253B4/+0x253B8 pair-consumer pair — 0x800D92FC–0x800D93C8 (confidence: low)

Evidence: gapless link adjacency (0x800D92FC is 0xCC and ends exactly at
0x800D93C8) with an agreeing call edge — 0x800D93C8 direct-calls
0x800D92FC (`jal` at 0x800D940C) — plus a shared far-buffer global cluster:
0x800D92FC reads `s16`@+0x253B4/+0x253B8 of `D_8007AFF0` with the same
single-`lui`+`addu` far-base build as the recorded +0x253AC halfword-block
pair member `ovl_11_func_800DB978` (matched), which zeroes exactly those two
fields. So the +0x253AC halfword family gains a matched consumer of two of
its six cleared halfwords. Address-apart from that family, so same-TU
membership between the two runs is unproven; the pair's own membership rests
on adjacency + call edge only (low).

Members:
- ovl_11_func_800D92FC (m, matched this session, byte-exact) — two-pass
  leaf: per pass reads the shared halfword pair, computes
  `(v ± 0xE10 + 0x1130) / 400` clamped to [0,0x2D] and
  `(v ± 0xE10 - 0x640) / -400` clamped to [0,0x19], and stores the two
  results as the s32 pair at `arg0[2*i]`/`arg0[2*i+1]`.
- ovl_11_func_800D93C8 (s) — link successor and sole caller; consumes the
  written pair.

## `ovl_11` index/5 table-copy record trio — 0x800D29B0 / 0x80110CE8 / 0x80110E34 (confidence: low)

Shared-idiom cluster, not a same-TU claim: `ovl_11_func_800D29B0` (matched,
byte-exact, this session) is a near-verbatim construction twin of matched
`ovl_11_func_80110CE8` — identical s16 `x/idx/j` spelling, signed div-by-5 via
the magic 0x66666667 with the same special-case chain (extreme inputs map to
idx 4/5 with j=0), the same per-index 3-word table copy with `j*600` added to
the third word, and the same instruction shapes throughout. `800D29B0` also
writes the exact record field shape (`u16@0x22`, `u16@0x30`, s32
`0x38/0x3C/0x40`) that matched `ovl_11_func_80110E34` writes, suggesting one
record type serving both. No shared global, and `800D29B0` is address-apart
from the 0x80110xxx pair, so same-TU membership is unproven — this is
author-idiom and record-shape evidence only; the proven `80110CE8` spelling is
the idiom dictionary for solving the other two's relatives.

Members:
- ovl_11_func_800D29B0 (m, matched this session, byte-exact) — leaf: maps an
  s16 arg (-1/-2 or x/5, x%5) and copies `D_80123A2C[idx][0..2]` (+`j*600` on
  the third) into a record's 0x38/0x3C/0x40, sets `u16@0x22 = (idx&1)?1:3` and
  `u16@0x30 = 5`, returns 5.
- ovl_11_func_80110CE8 (m) — same construction against `D_80127E60` (special
  cases 20/21), copying into `dst[0..2]`; the idiom donor for the trio.
- ovl_11_func_80110E34 (m) — refreshes the same record shape's 0x38/0x3C/0x40
  from `D_80127EE0[unkAC]` and sets `u16@0x30 = 0x28`, `u16@0x22`.

## `ovl_30` D_80134008/D_80134B0C init/read pair — 0x8012EFEC / 0x8012F000 (confidence: medium for the pair, low for 0x8012F084)

First grouping candidate in `ovl_30` (`Obj\GF_swind.bin`), over two
overlay-local globals (0x80134xxx data region):

- **gapless link adjacency:** `ovl_30_func_8012EFEC` (0x14 bytes at
  0x8012EFEC) ends exactly at `ovl_30_func_8012F000` (0x20 bytes at
  0x8012F000) — one unbroken link run, both members matched byte-exact;
- **shared global with complementary roles:** 8012EFEC zeroes both
  `D_80134008` and `D_80134B0C` (an init/reset leaf, no call edges recorded —
  likely an exported entry); 8012F000 reads `D_80134B0C` and conditionally
  re-zeroes it — the init/consumer pair the other ledgers record as the
  same fingerprint class;
- **what the tie is not:** `ovl_30_func_8012F084` (0x350, stub) is the only
  other referencer of the pair (reads/writes both globals across its body)
  but sits 0x84 past the pair, so its membership rests on the shared-global
  data tie alone.

Members (link order):
- ovl_30_func_8012EFEC (m) — void init leaf: zeroes D_80134008 and
  D_80134B0C; no callers or callees recorded in the call graph
- ovl_30_func_8012F000 (m) — read-and-conditionally-clear of D_80134B0C,
  returning the value read
- ovl_30_func_8012F084 (s) — main consumer of both globals (data-family
  member only)

## `ovl_11` D_801273D8/D_801273DA init/reset pair — 0x800FFA28 / 0x800FFA40 (confidence: medium)

- **gapless link adjacency:** `ovl_11_func_800FFA28` (0x18 bytes at 0x47C08)
  ends exactly at `ovl_11_func_800FFA40` (0x24 bytes at 0x47C20) — one
  unbroken link run, both members matched byte-exact;
- **shared globals with complementary roles:** 800FFA28 is the init leaf —
  zeroes `D_801273D8` and sets `D_801273DA = 0xFF`; 800FFA40 calls 800FFA28
  then clears `D_801273DA` back to 0 (init + reset of the same flag pair);
- **sole referencers:** no other function in `src/` touches
  `D_801273D8`/`D_801273DA`; 800FFA40's one call edge is to 800FFA28, and the
  caller (`ovl_11_func_800C7AC0` state machine) ignores the return value.

Members (link order):
- ovl_11_func_800FFA28 (m) — void init leaf: `D_801273D8 = 0`,
  `D_801273DA = 0xFF`
- ovl_11_func_800FFA40 (m) — void reset: calls 800FFA28, then
  `D_801273DA = 0`

## `ovl_11` D_80128420/D_80128422 init/set cluster — 0x8011E574 / 0x8011E588 / 0x8011EC54 / 0x8011EC84 (confidence: medium for the pair, low for 0x8011EC54 and 0x8011EC84)

Same fingerprint class as the D_801273D8/D_801273DA entry above: an
overlay-local {s16,s16} flag pair with an init leaf and callers that reset
one member after calling it.

- **gapless link adjacency:** `ovl_11_func_8011E574` (0x14 bytes at 0x66754)
  ends exactly at `ovl_11_func_8011E588` (0x28 bytes at 0x66768) — one
  unbroken link run, both members matched byte-exact;
- **shared globals with complementary roles:** 8011E574 is the init leaf —
  zeroes `D_80128420` and `D_80128422`, no callers or callees of its own;
  8011E588 calls it then sets `D_80128420 = 1` (init + set of the same
  pair); its caller `ovl_11_func_800C8BA8` ignores `$v0` after the call;
- **third member by shared tie only:** `ovl_11_func_8011EC84` (0x40 at
  0x66E64, matched) calls 8011E574 then sets `D_80128420 = 6` — same
  call-init-then-set idiom, but 0x6D4 past the pair, so adjacency does not
  cover it. `D_80128424` (the 0x8C-byte table at 0x80128428 read by
  8011EE40) is a separate object, not part of this pair.
- **fourth member by adjacency + shared set/callee idiom:**
  `ovl_11_func_8011EC54` (0x30 at 0x66E34, matched) ends exactly at
  0x66E64 where 8011EC84 begins — a gapless link run onto a cluster
  member; it sets `D_80128420 = 8` and calls the same
  `func_80022738` / `func_8001FABC(3)` pair as 8011EC84 (though it does
  not call the 8011E574 init leaf). Its sole caller
  `ovl_11_func_8011EA0C` ignores `$v0` after the call, matching 8011E588's
  caller behaviour; it calls 8011EC54 only after first storing 6 into
  `D_80128420` itself.

Members (link order):
- ovl_11_func_8011E574 (m) — void init leaf: `D_80128420 = 0`,
  `D_80128422 = 0`
- ovl_11_func_8011E588 (m) — void: calls 8011E574, then `D_80128420 = 1`
- ovl_11_func_8011EC54 (m) — sets `D_80128420 = 8` after calling
  func_80022738 and func_8001FABC(3); caller ignores $v0
- ovl_11_func_8011EC84 (m) — calls 8011E574, sets `D_80128420 = 6`, then
  calls 8011EE98 with D_80070CF2

## `ovl_11` func_8001ABF0 text-copy wrapper twin pair — 0x8011CEE0 / 0x8011CF10 (confidence: medium)

- **gapless link adjacency:** `ovl_11_func_8011CEE0` (0x30 bytes at 0x0650C0)
  ends exactly at `ovl_11_func_8011CF10` (0x30 bytes at 0x0650F0) — one
  unbroken link run, consecutive functions.csv rows, both matched byte-exact;
- **identical bodies modulo one symbol:** the two originals carry the same
  binary hash; every word agrees except the second `%hi/%lo` pair, which
  names `D_80051808` in one and `D_8005180C` in the other — adjacent
  4-byte-apart entries, plausibly one u16 table;
- **shared callee and global cluster:** both are leaves whose sole edge is
  `func_8001ABF0(dst, (u16 *)(D_80054BC0[0] + (s32)&D_800518xx))` (exe-side
  u16 copy helper, see the u16-text TU entries);
- **shared callers:** `ovl_11_func_8011CC08` references both
  (`ovl_11_func_8011D474` calls both back to back), and
  `ovl_11_func_8011CD2C` calls 8011CEE0 directly.

Members (link order):
- ovl_11_func_8011CEE0 (m) — void leaf wrapper: copies the u16 string at
  `D_80054BC0[0] + &D_80051808` via func_8001ABF0
- ovl_11_func_8011CF10 (m) — twin wrapper over `D_80054BC0[0] +
  &D_8005180C`

## `ovl_17` D_800BD848 0x50-stride record area + caller hub (confidence: low)

Evidence: shared data cluster and call graph. `ovl_17_func_800B9F10` (m,
matched 2026-10-03) indexes the `D_800BD848` work area as 0x50-byte records
with an s16 field at +0x2A; `D_800BD870` is the same records aliased at
+0x28, and `func_800B8470` (s) walks it with the identical 0x50 stride for
5 records. The global itself is referenced by most of the overlay, so it is
weak TU evidence on its own; the group's binding evidence is the call graph:
800B9F10's sole caller is `ovl_17_func_800B9324`, which also calls
800B9CE4, 800B9F44 and 800B9F78 in one branch sequence.

Members:
- ovl_17_func_800B9F10 (m) — leaf predicate: returns
  `(s16)arg1 < record[arg0].s16@+0x2A` over the D_800BD848 record area.
- ovl_17_func_800B9324 (s) — caller hub: twice calls 800B9F10 with record
  halfword fields around calls to 800B9CE4/800B9F44/800B9F78.
- func_800B8470 (s) — counter reset that walks the same records from
  D_800BD870 with the 0x50 stride (5 records, per-record func_800BAC24 call).
