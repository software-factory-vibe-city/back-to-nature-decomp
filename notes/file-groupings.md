# Suspected source-file groupings (ledger)

## `ovl_11` D_800B9920 four-state dispatch cluster — 0x800E3A3C–0x800E4330 (confidence: medium)

Evidence: `build/ovl_11/asm/data/1664.rodata.s` contains the four-entry
D_800B9920 handler table; the dispatcher and handlers share the D_8006C838
+0x7A74 selector (original handler assemblies, including 800E3DC8/800E4280).
The table links the dispatcher to this nearby handler run, but does not prove
its translation-unit boundaries.

- ovl_11_func_800E3A3C (m) — clears +0x522C/+0x5230, dispatches by the shared
  selector, clears flag 0x20 at +0x4450 and returns the selected handler result.
- ovl_11_func_800E3DC8 (s) — table handler that updates the shared selector.
- ovl_11_func_800E40CC (s) — second handler in the same original dispatch table.
- ovl_11_func_800E4280 (s) — table handler that resets the selector and returns 1.
- ovl_11_func_800E4330 (s) — table handler that writes selector 1 and returns 0.


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
| `ovl_11` | `Obj\GF_FARM.bin` | farm-object clear/update run 0x80121318–0x80121500 (medium); `D_80123754` setter/getter run 0x800D12A0–0x800D2160 (medium); text/sprite table-builder run 0x80116F4C–0x80117178 (medium); `D_80127428` shared-state cluster 0x801037DC–0x801040A8 (medium); `D_8012D52C` reset-stub family 0x80114184 / 0x8011A9CC–0x8011B6C0 (medium); by-value struct-slice run 0x8011D934 / 0x8011D98C / 0x8011D9B4 (StructD548 selector @0x5C, data @0x28/0x46) (medium) — freshly-matched gapless link head `ovl_11_func_8011D934` (0x8011D934+0x58 = 0x8011D98C; then +0x28 = 0x8011D9B4, +0x28 = 0x8011D9DC) takes the same by-value `StructD548` record (first 16 bytes ride $a0-$a3, remainder in the outgoing stack area) and counts the non-zero u32 words among its first `x.index` words, @0x5C selector — a third matched member of the same original-file family; pointer-getter run 0x800E48CC–0x800E5078 (medium); `D_80128D78`/`D_80128D7A` s16-pair global cluster 0x800D31EC–0x800D55F8 (low); member `ovl_11_func_800D3424` (matched, 0x44, this session) is the first matched reader of the shared u16-pair lookup table `D_80123AAC` (`D_80123AAC[arg0][arg1]` as a {u16,u16} cell, absolute `lui`+`addiu` base) and returns 0; its byte-exact twin `ovl_11_func_800DF3BC` (matched this session, 0x44, 16/16 same shape) reads the sibling {u16,u16} table `D_80123E70` in the same `0x80123xxx` data region with the same `[][4]`/`%lo` branchless 0x10/4-indexing idiom and returns 0, so both lookup leaves likely share the original source file; a third member `ovl_11_func_800E0F8C` (matched this session, 0x44, 16/16 same shape, also returns 0) reads the sibling {u16,u16} table `D_80123F58` in the same `0x80123xxx` region with the same `[][4]`/`%lo` branchless 0x10/4-indexing idiom — the family now spans three tables (`D_80123AAC`/`D_80123E70`/`D_80123F58`), widening the original-source-file hypothesis; a fourth member `ovl_11_func_800E2AAC` (matched this session, 0x44, 16/16 same shape, returns 0) reads the sibling {u16,u16} table `D_80124008` in the adjoining `0x801240xx` region with the same `[][4]`/`%lo` 0x10/4-indexing idiom, so the family now spans four tables (`D_80123AAC`/`D_80123E70`/`D_80123F58`/`D_80124008`); a fifth member `ovl_11_func_80109550` (matched this session, 0x44, byte-identical instruction stream, returns 0) reads the same {u16,u16} `[][4]`/`%lo` 0x10/4-indexed table `D_80127918` — placed in the `0x801279xx` data region (near the recorded `D_80127428` cluster) rather than the contiguous `0x80123xxx` quadruple, so same-source-file membership with the quadruple is weakened to (low) but the accessor-idiom family now spans five tables across two data regions; a sixth member `ovl_11_func_8010B898` (matched this session, 0x44, byte-identical instruction stream, returns 0) reads sibling {u16,u16} table `D_80127B38` in the same `0x80127xxx` region (just below `D_80127918`) with the same `[][4]`/`%lo` 0x10/4-indexing idiom, so the `0x80127xxx` sub-region now holds two accessor-idiom tables with (low) same-source-file likelihood; a seventh member `ovl_11_func_8010D20C` (matched this session, 0x44, byte-identical first run, returns 0) reads sibling {u16,u16} table `D_80127BA4` (just above `D_80127B38`) in the same `0x80127xxx` region with the same `[][4]`/`%lo` 0x10/4-indexing idiom, so the sub-region now holds three accessor-idiom tables (low) same-source-file likelihood; fresh member `ovl_11_func_80110E34` (matched this session, 0x64, byte-exact) is a field-fill accessor over a NEW table `D_80127EE0` just above `D_80127EC0` in the same `0x80127xxx` data body — 16-byte {s32,s32,s32,u16} entries indexed by `u16@0xAC` with the same absolute `lui`+`addiu %lo` base and sll-4 stride, filling the {u16@0x22, s32@0x38/0x3C/0x40} object fields and setting `u16@0x30=0x28` via a reused-s32-temp web (not a returning leaf like the {u16,u16} pair readers, so same-TU membership with them stays plausible but unproven, low); fresh member `ovl_11_func_80110CE8` (matched, 0xB8, byte-exact first draft) is the matching field-fill accessor over sibling table `D_80127E60` (0x60 below `D_80127EC0`, same 16-byte entries) — fills {s32@0/4/8} of its arg0 from `D_80127E60[(s16)(arg1/5)][0/1/2]` with the third word plus `(arg1%5)*600`, with special cases arg1==20→idx 4 and arg1==21→idx 5 (idx is s16, same div-by-5 magic indexing idiom, same absolute `lui`+`addiu %lo` base); it is the gapless link predecessor of `ovl_11_func_80110DA0` (0x80110CE8+0xB8=0x80110DA0), extending the run head to 0x80110CE8, so same-TU membership of the accessor pair is (medium); member `ovl_11_func_80110DA0` (matched, 0x88, byte-exact first draft) is the first matched reader of `D_80127EC0` itself — the 16-byte-entry table 0x20 below `D_80127EE0`, indexed `(s16)(arg1/5)` with the same absolute `lui`+`addiu %lo` base and sll-16/sra-12 stride, filling {s32@0/4/8} of its arg0 from the entry's first three words (word 0 plus `(arg1%5)*0x190`), a field-fill accessor like `ovl_11_func_80110E34`; it is the gapless link predecessor of `ovl_11_func_80110E28` (0x80110DA0+0x88=0x80110E28) and `ovl_11_func_80110E34` (+0xC=0x80110E34), so the three `0x80127Exx`-table accessors plus the 0xC clear leaf form one gapless link run over the same data body, and same-TU membership of the trio is (medium); member `ovl_11_func_800D3424`'s direct caller `ovl_11_func_800D2E6C` (0x800D2E6C, just below the run, still a stub) feeds it two `lhu` sprite values and writes both halfword results to a local pair; `D_8012DB10`/`D_8012DB14` s32-pair run 0x8011F0C4–0x8011F1D0 (medium); `D_801285xx` farm-state reset cluster (medium) — leaf `ovl_11_func_8011F52C` (matched this session, 0x48, byte-exact) initializes the contiguous `0x80128540–0x8012855A+` region (s16 `D_80128540`, s32-triple `D_80128544` @0/4/8, s16-triple `D_80128550` @0/2/4 with its @4 overlapping separate symbol `D_80128554`, s16 `D_80128556`, s16 `D_8012855A`); its gapless link successors `ovl_11_func_8011F574` (m, finalized, 0x48 at 0x8011F52C+0x48; calls the leaf, sets `D_80128540` = 1, transfers the work-area halfword `D_8006C838+0x8000+0x64D2` to `D_8012855A`, then clears that source field) and `ovl_11_func_8011F5BC` (starts exactly at 0x8011F574+0x48, reads `D_80128540`, calls 0x8011F608) form an unbroken reset run 0x8011F52C→0x8011F574→0x8011F5BC→0x8011F608; caller `ovl_11_func_8011F958` reads `D_8012855A`, and `ovl_11_func_8011F9EC`/`ovl_11_func_8011FB80` write/read `D_80128550`/`D_80128554`/`D_8012855C` — so the state cluster has a tight link-local read/write family, same-TU membership plausible but unproven; short-fold helper trio 0x800CE514–0x800CE53C (medium); 3-halfword vector setter/clear/copy family 0x800D72E8–0x800D740C (medium); `(u32)(arg0-C)<3U||arg0==E` s16 range-check predicate trio 0x800D7504 / 0x800D753C / 0x800D756C (all matched; 0x800D7504 adds a second equality; link-contiguous zero-gap run differ only in constants, same family as the short-fold helper trio) (low); `(1<<arg0)&0xFFFF` mask helper 0x80101B84, called by link-adjacent 0x80100FFC/0x80101B28 (low); `D_80071A00` byte-compare helper pool 0x800F19C8, poolmates 0x800CBDFC/0x8011D06C (low); `D_800719FE` s16-global cluster 0x800FDEDC/0x800FDFD8/0x80112160 (low); `D_8012D0xx` tiny-global cluster/state-probe run 0x80108104–0x8010AE64 (low); `D_80129194`–`D_801291A0` mirror-pair run 0x800DD8AC–0x800DDB64 (medium); `D_80129620` range-check predicate 0x800F5868, called by link-adjacent 0x800F5888 which reads `D_80129620`/`D_80129628` (medium); predicate helper 0x800FB3E4 (returns 0/1 for arg0 0 or 9), called by link-adjacent 0x800FB218/0x800FB290 which also call 0x800FB45C (medium); `D_80127208` set-once flag trio 0x800FB5FC/0x800FB608/0x800FB628 (medium); 7-halfword farm reset helper 0x800BFF50 (leaf; zeroes six halfwords, sets 0xC to 0x8000; sole caller link-adjacent 0x800BFEA4 iterates `D_80128820`[] stepping +0xE) (low); `D_8006C858` item-table accessor run 0x800D5750–0x800D6090 (medium) — head leaf `ovl_11_func_800D5750` (matched this session, first try EXACT, 0x54) classifies the flags halfword `u0.field_00` of `D_8006C858[arg0]` (0x4000→0, 0x8100→1, else 2) with the same s16-sign-extend *40-strided `ItemData` accessor idiom as sibling members 800D5868/800D589C/800D583C of the run; tail member `ovl_11_func_800D603C` (matched this session, 0x54, byte-exact; 0x800D603C+0x54 = 0x800D6090, exactly closing the recorded run) reads the same *40-strided table through the `D_8006C838`+0x20 pointer (same `D8006C838Lookup`-style view as matched run member `ovl_11_func_800D5C3C`), returning entry s16@+0x12 plus a +0xA bonus when `idx==0x97` and the `D_8006C838`+0x44F8 flag bit 0x400000 is set, with shared-`lui %hi` + per-use `addiu %lo` two-register address formation (`ovl_11_func_800D5C3C` keeps one full base register instead) (medium); fresh member `ovl_11_func_800D5CE4` (0x800D5CE4, matched 2026 — this session, 0x54, byte-exact first try; sits inside the recorded 0x800D5750–0x800D6090 window, link-predecessor-adjacent to matched siblings 800D5C3C/800D5C90) reads the same *40-strided table through the same `D8006C838Lookup` view of `D_8006C838` (`lw`@+0x20 then `lw`@+0x2C) — same s16-sign-extend accessor idiom, identical 16-shape window to its two neighbours — but returns entry u16@+0xE and, unlike the -1-returning siblings, returns 0 when the @+0x3 type byte is -1, so it shares the recorded run's original source file with them (medium); fresh member `ovl_11_func_800D5D9C` (0x800D5D9C, matched this session, 0x64, byte-exact; one gapless link run with its mask-bit twins 0x800D5D38/0x800D5E00 — same `D8006C838Lookup` view, same *0x28 stride and `field_28` `t*8` table, differing only in the u16@+6 probe mask 0x8000/0x2000/0x4000) — its twin 0x800D5E00 (same 2-u16 accessor, probe mask 0x4000) is now matched this session (byte-exact first try, 0x64) as an exact instruction-stream clone, confirming the twin family's same-TU membership is the two-u16-arg member of the same run: masked `andi`/`andi` args indexed as a typed 2D accessor `rows[a].arr[b]` over `field_20` (per-row s16 sub-array @+4), then probes bit 0x2000 of u16@+6 in the `field_28` 8-byte-record table via the `(x&0x2000)>u32z` `andi`+`sltu` spelling — joins the recorded run's same-TU hypothesis with the s16 accessor siblings (medium); fresh member `ovl_11_func_800D5F44` (0x800D5F44, matched this session, 0x64, byte-exact first try; inside the recorded 0x800D5750–0x800D6090 window, 0x44 after its twin 0x800D5E00 which ends exactly at 0x800D5F44) is the 0x800-mask member of the same two-u16 `rows[a].arr[b]` / `field_28` `t*8` twin family (masks now 0x800/0x8000/0x2000/0x4000 across 0x800D5F44/0x800D5D38/0x800D5D9C/0x800D5E00), an exact instruction-stream clone of the 0x800D5E00 member differing only in the u16@+6 probe mask — the twin family now spans four members (medium); fresh member `ovl_11_func_800D5E64` (0x800D5E64, matched this session, 0x70, byte-exact) is a fifth member of the same two-u16 `rows[a].arr[b]` / `field_28` `t*8` twin family — the gapless link successor of its 0x4000-mask twin 0x800D5E00 (0x800D5E00... 0x800D5E00+0x64 = 0x800D5E64) and gapless link predecessor of the 0x800-mask member 0x800D5F44 (0x800D5E64+0x70 = 0x800D5ED4, still a stub, then +0x70 = 0x800D5F44) — but a structural variant rather than a mask-only clone: same `D8006C838Lookup` view and *0x28 stride, probe mask 0xE000 = 0x8000|0x4000|0x2000 (the OR of the recorded family's three masks, i.e. the aggregate "any upper-flag" probe), and instead of the `andi`+`sltu` bool returns the `field_28` 8-byte-record u16@+0 when any flag is set, else -1 on the `bne`-inverted -1 test (fall-through returns -1) then -1 again when the aggregate mask is clear — the family's value-returning member, so the twin run 0x800D5D38→0x800D5E00→0x800D5E64→0x800D5F44 is now matched at every slot and the recorded 0x800D5750–0x800D6090 window's same-TU vote gains a fifth twin-family member (medium); fresh member `ovl_11_func_800D57A4` (0x800D57A4, matched this session, 0x6C, byte-exact first try; inside the recorded 0x800D5750–0x800D6090 window, between run members 0x800D5750 and 0x800D5810) classifies the s32 status word `D_8006C858[arg0].field_18` (bit 0x10000000→0, 0x20000000→1, 0x40000000→2, else 3) with the same s16-sign-extend *40-strided `ItemData` accessor idiom as the rest of the run, so it shares the run's original source file with them (medium); fresh member `ovl_11_func_800D5FA8` (0x800D5FA8, matched this session, 0x6C, byte-exact) — a pure switch-leaf writing the {s16,s16,s16} record (unk0=0x86 for 0x122/0x123/0x124 else masked arg; unk4=0), the exact gapless fill between the twin family's 0x800D5F44 (0x64, ends exactly at 0x800D5FA8) and the run's s16@+0x10 getter 0x800D6014 (starts exactly at 0x800D6014), so the window's matched members now sit at every 0x1C+ stride (medium) `D_80076220` 0x1D4-stride struct-array reset cluster — leaf 0x800C1BE0 zeroes u16@+0xA over 37 entries (matched 2026-11); 0x800C1C90 (matched 2026-11) walks all 37 entries by pointer increment clearing bit 0x10 of u16@+0x1E (only other direct writer); link-adjacent 0x800C1C08 clears 36 entries via callee 0x800C1C5C call +0xE0 call to 0x80107DD0, 0x800C1D68 shares the base; 0x800E549C (matched 2026-12) walks all 37 entries by the same pointer-increment countdown clearing bits 0x1800 of u16@+0x1E (0x2C leaf, byte-exact clone of the 0x800C1C90 idiom, different mask) (medium); `D_80129648` 0x22-stride cell-flag clear — leaves 0x800F69D0 (matched 2026, clears flag@+0x1E + u16@+0x20 of each of 0x47+1 cells) and 0x800F69FC (zeroes byte@+0x1E of each of 0x47+1 cells) are link-adjacent (0x800F69D0 ends exactly at 0x800F69FC) and are the two matched readers of `D_80129648`; 0x800F69FC called by 0x800F67E0/0x800FFF7C (low); struct-reset leaf run 0x80106DC0–0x80106EAF — leaf 0x80106DC0 zeroes an 0x18-byte struct and sets f2 to 4, called by link-adjacent 0x80106DE8/0x80106E38 (medium); `D_8012CF48` 10-entry 0x18-stride table accessor cluster 0x80106DE8–0x80107390 (low) — 0x80106DE8 clears all 10 entries via 0x80106DC0, 0x80106E38 finds the first free entry (u16@0) and inits (u16@0=1, u16@2, s32@0x14), 0x80106F20 and 0x8010726C share the base (0x8010726C dispatches per-entry on u16@0 and decrements u16@4, calling 0x80107044, and ends exactly where 0x8010734C begins), freshly-matched leaf `ovl_11_func_8010734C` (matched this session, 0x44) scans the 10 entries for the one whose pointer @0x14 has s16 field_A == arg0 and returns that entry's u16@0, else 0 — a `for`-loop rotated to a bottom-tested while with a counter/pointer pair, same shape as the recorded 0x8011760C leaf; same shared absolute-address base build (`lui`+`addiu` %lo) across the family; fresh member `ovl_11_func_80118C28` (matched this session, 0x44, byte-identical loop shape with 0x8010734C) is the first matched reader of the shared {s16,s16} pair table `D_80128298` (in the `0x801282xx` data region), same counter/pointer lookup-leaf idiom returning the paired value else 0; fresh member `ovl_11_func_8011DEBC` (matched this session, 0x48, byte-exact) reads the new halfword tables `D_801282E4`/`D_801282F0` in the same `0x801282xx` data sub-region with the same absolute `lui`+`addiu %lo` table-base idiom — a branchless two-table selector leaf (`arg1` selects E4 vs F0 as `u16` arrays indexed by `s16 arg0`), address-apart (0x8011DEBC) so same-TU membership unproven, but widens the `0x801282xx` accessor-family corpus to two matched leaves (low); `D_80126FE0/E4/E8/EC` menu-state reset cluster 0x800FAAAC–0x800FAC0C — leaf 0x800FAAAC (matched) resets the four-word cluster to 0,0,0,0xFF (init data 0,0,0,0xFF), direct caller 0x800FAAD4 guards on `D_80126FE0`, state machine 0x800FAC0C reads all four (medium); bit16@+0x34 flag-check leaf 0x800DF4F0 (0x2C; guards u16@0, returns (u32@+0x34 & 0x10000) < 1), called by 13 probes spanning its own run 0x800DE9C8–0x800DFB98 (matched 2026-11) (low); bit16@+0x34 flag-check leaf 0x800E109C (0x2C; guards u16@0, returns (u32@+0x34 & 0x10000) > 0 — inverted-polarity twin of the 0x800DF4F0 leaf, same instruction shape), called by 10 probes spanning its own run 0x800E05A8–0x800E15C8 (matched 2026-11) (low); bit13@+0x34 flag-write leaf pair ovl_11_func_80109068 / ovl_11_func_8010B49C — byte-identical 0x3C code (guards u16@0, tests bit 0x8000 of the s32@+0x34 flag word and ORs 0x800000 in when set, then returns 0; the writer form of the 0x800DF4F0/0x800E109C read-probe family on the same {u16@0, s32@0x34} object struct; both matched this session, baseline flags; the 0x8010B49C twin sits +0x2434 from 0x80109068 but still address-apart from the 0x800DEx read-probes, so same-TU membership unproven) (low); bit17@+0x34 flag-write leaf ovl_11_func_800CF2C8 (matched, 0x40; another writer-form member of the same {u16@0, s32@0x34} flag family — guards u16@0 against previously-unreferenced s16 global `D_80071A8A` (data region `D_80071Axx`, the `D_80071A00`/`D_800719FE` pool cluster) and AND-clears bit 0x20000 of the s32@+0x34 flag word when they differ; first matched reader of `D_80071A8A`; address-apart (0x800CF2C8) from all recorded family members, so same-TU membership unproven) (low); another writer-form member `ovl_11_func_80108D38` (matched this session, 0x4C, byte-exact first try) guards u16@0 (returns -1 when 0) and when engine global `D_80070CF8` lies outside half-open [6,21) writes u16@+0x2C = 0x12C and AND-clears bit 0x800 of the s32@+0x34 flag word, returns 0 — it is a third recorded reader of `D_80070CF8`, read unsigned (`lhu`) here vs the signed `lh` readers 0x80107B54/0x800D3D2C, same absolute `lui`+`addiu %lo` base; address-apart (0x80108D38), so same-TU membership unproven) (low); it now has a byte-identical twin `ovl_11_func_8010B218` (matched, 0x4C, the same 17-instruction stream — the whole 16-shape window aligned in order, identical toolchain), guarding the same {u16@0, u16@+0x2C, s32@+0x34} object struct and reading `D_80070CF8` unsigned the same way; address-apart (0x8010B218), so same-TU membership with the 0x80108D38 member is unproven but the writer-form family on this struct now spans two byte-identical leaves (low); bit8/bit19@+0x34 flag-read leaf `ovl_11_func_800CFAD0` (matched this session, 0x50) — a reader member of the same {u16@0, s32@0x34} flag family that does not guard u16@0 and never writes: returns 1 iff the s32@+0x34 flag word has bit 0x100 set while arg1≡2 mod 4 and bit 0x80000 is clear (the binary preserves a dead `(v&0x80000)==1` compare that is never true); it also carries the block-scope CAPTURE_PREV_RET dead `sw $v0,0($sp)` phantom-store quirk shared with ovl_11_func_8011D438/ovl_11_func_800D1CD0 (and the file-scope sibling ovl_11_func_800D0600), a per-TU v0-channel fossil family inside ovl_11; address-apart from the other recorded flag-family members, so same-TU membership unproven (low); `D_8012DB58` state-trio run 0x801209A8–0x80120A2C — three link-contiguous functions (0x801209A8, matched, zeroes `D_8012DB58` and sets `D_8007AFF0`+0x2548C/0x254A0; 0x801209D4, matched this session, guards the same far-buffer s32@+0x254A0 against 0x17 — the exact value 0x801209A8 writes there — then reads/writes `D_8012DB58` @+4 (s32) and @+8 (s32/u16) (`+8 += +4`, then `+4 -= 4`) and accumulates the low u16 of @+8 into the far-buffer u16@+0x253B6, a write shared with recorded +0x253AC halfword-block pair member 0x800DB978; 0x80120A2C reads it), sharing the `D_8012DBxx` data cluster (low); `D_8007AFF0` +0x253AC halfword-block pair 0x800DB904–0x800DB978 — leaf 0x800DB978 (matched this session) zeroes s16@+0x253AC/+0x253AE/+0x253B0/+0x253B4/+0x253B6/+0x253B8, link-adjacent 0x800DB904 (ends exactly at 0x800DB978) reads `lh`@+0x253AC; both build the same base `D_8007AFF0 + (0x253B6 >> 16) << 16` via one `lui`+`addu`, same accessor idiom (medium); s16 far-buffer probe 0x800C9D64 (matched this session) reads `lh`@+0x25476 of the same buffer with the same `lui`+`addu` base construction and folds the value ((v!=1)<<1, v==6?1:keep), so the s16 accessor family on `D_8007AFF0` now spans 0x253AC–0x25476; the family also carries an s32 range: leaf 0x800DB7F0 (matched this session — 0x800DB7F0) writes five s32 fields at +0x25394/+0x25398/+0x2539C/+0x253A0/+0x253A4 of the same buffer (values -0x2328, -0x1194, 0, -0x200, 0) with the same single-`lui`+`addu` far-base build, sitting immediately above the recorded s16 block 0x253AC (0x253A4 ends right below it, gap 8 = two more s32 words) (medium); its result is consumed via `jalr` by a link-contiguous dispatch-caller run 0x800C4A2C–0x800C55FC (0x800C4A2C/0x800C4B6C/0x800C4C94/0x800C4DE0/0x800C523C/0x800C541C read it, 0x800C55FC discards), all of which indirect-dispatch on the returned selector (low); stride-copy helper pair 0x800DD21C / 0x800DD248 (low) — word copy at 0x800DD21C (lw/sw +4, matched) and halfword copy at 0x800DD248 (lhu/sh +2, matched this session) are link-adjacent (0x800DD21C 0x2C ends exactly at 0x800DD248; 0x800DD248 0x2C ends exactly at 0x800DD274) and stay as an unbroken contiguous run, both the same do-while counted-copy loop (`bnez` guard on arg2, `sltu` on a `+1` counter) differing only in stride; both clean `void(void*,void*,u32)`-style helpers, no globals (low); `D_80070D38`/`D_80070D3A`/`D_80070D3E`/`D_80070D40` adjacent-u16 deduct-helper family 0x800F3950 / 0x800F3A18 / 0x800F3AC4 (matched this session) / 0x800F3BA0 — four byte-identical leaf helpers, each reads its u16 array global, compares against masked arg0, on pass subtracts it back and returns 1 else returns 0, one global per function across a contiguous u16-array cluster (medium); `D_80128BB0` 0x34-stride struct-array clear/setup run 0x800CBEF8–0x800CC0F8 (medium) — leaf 0x800CBF40 (matched this session) zeroes 4 s16 (0x0–0x6) + 7 s32 fields (0xC/0x14–0x1C/0x24–0x2C) of the 0x34-byte entry; both callers are link-adjacent neighbours in one unbroken run: 0x800CBEF8 (0x48, ends exactly at 0x800CBF40) loops the clear over 3 `D_80128BB0` entries stepping +0x34, 0x800CBF70 (0x188, starts at the leaf's end) initializes an entry's fields then conditionally rescales 0xC/0x14/0x18/0x1C; `D_80070CF8` s16 range-check predicate 0x80107B54 (leaf, matched this session; reads base-engine s16 `D_80070CF8` absolute, returns 1 when the value falls outside half-open [arg0,arg1), `lh`->`slt` probe shape), called by link-adjacent 0x80107604/0x8010775C immediately above it in one unbroken run, just before the `D_8012D0xx` state-probe run 0x80108104 (low); `D_80070CF2` switch-leaf pair (low) — freshly-matched `ovl_11_func_800D2E20` (this session, 0x4C, byte-exact first try) and `ovl_11_func_800F581C` (already matched) are functionally-identical switch leaves over the single s16 global `D_80070CF2`: `lh` the global, case chain on 1/2/3 with `case 0/default` falling first, each case `jr $ra`-returns a small power-of-two constant (1/2/4/8 vs 2/4/8/0x10); 16/16 same instruction shapes, identical toolchain, one switch-case macro family — so the two share a common original file with (low) confidence, and `D_80070CF2` joins the recorded `D_80070Cxx` base-engine region cluster; a no-frame leaf; both read via `lui`+`lh %lo` absolute without a base register build; 0x18-byte spawn-record fill/clear/dispatch run 0x800F4360–0x800F43CC (low) — head leaf 0x800F4360 (matched) fills s16@0/2, sets bit 0 of s16@4, copies a by-value `Vec3` into s32@8/C/10; middle 0x800F4390 clears the same record (zeroes 0/2/8/C/10, AND-clears bit 0 of @4, step +0x18); tail 0x800F43CC dispatch-switches on ids 0x64/0x65/0xE8/0x121–0x124 off the `D_8006C838`+0x8000+0x5DCC/0x5DD4 entity base and direct-calls the head leaf; entity-base slot reader `ovl_11_func_800F4CEC` (matched, this session) loads the same base's +0x5DD4 pointer into new global `D_80129630` and initializes its fields (u16@0=1, s32@8=-0x1388, s32@C=0, s32@10=0x8FC) with the same two-stage base idiom as matched siblings 0x800BFD04/0x8010C3C4; its link-contiguous immediate predecessor `ovl_11_func_800F4CAC` (matched, this session; 0x40 bytes, ends exactly at 0x800F4CEC) loads the same +0x5DD4 slot and stores p+0x18 into `D_80129630`, initializing the sub-struct at p+0x18 (u16@0=1, s32@8=-0x4B0, s32@C=0, s32@10=0xB54) through the offset pointer — same two-stage base idiom and shared EntityD5D4 type, so the pair forms one link-contiguous entity-slot init run (medium); freshly-matched `ovl_11_func_800F4B14` (matched this session, 0x48, byte-exact) reads the adjacent +0x5DA4 pointer slot of the same `D_8006C838`+0x8000 two-stage base (`lui`/`addiu` %lo then runtime `ori`0x8000+`addu`) and walks the 16-entry 0x18-stride array it points to, counting entries whose u16@4 lacks bit 0x4000 via the u16 countdown do-while (`while(n>=0)`) idiom of the 0x800FEB68/0x800FEAD4 family — so it joins the two recorded `D_8006C838`+0x8000 families on the same base (same-TU membership with the +0x5DD4 init pair plausible but unproven, address-apart by 0x198, low); its gapless link predecessor `ovl_11_func_800F4AC0` (matched this session, 0x54, byte-exact; 0x800F4AC0+0x54 = 0x800F4B14 exactly) reads the same +0x5DA4 pointer slot of the same two-stage base and walks the same 16-entry 0x18-stride array rewriting each u16@4 (AND-clears bit 0x4000 when arg0==1 else OR-sets it — the complement of the +0x800F4B14 count) via the same u16 countdown-reversed `for` family, so the +0x5DA4 slot now has two gapless link-contiguous readers and same-TU membership for the pair is plausible (low); freshly-matched `ovl_11_func_800F53BC` (this session, 0x48, byte-exact) is a global-free leaf whose sole caller `ovl_11_func_800F40A4` builds the same `D_8006C838`+0x8000 two-stage base with offsets +0x5D8C (a pointer array) and +0x5DD8 (a signed-halfword count table), 18 iterations, passing each pointer/count pair to 800F53BC, which walks the pointed-to 0x18-stride array updating u16@4 (bit 0x20 → OR-1, else bit 0x40 → AND-drops-bit-0) in a count-driven signed-`s16` loop — same base family and 0x18-stride walk idiom as 0x800F4B14 and adjacent 0x800F5700, so same-TU membership with its caller is plausible but unproven (low); `D_801273xx` reset cluster — leaf `ovl_11_func_800FEBF8` (matched this session) zeroes s32 `D_801273B0` + s16s `D_801273B4/B6/B8/BA/BC`, the other references are matched `ovl_11_func_800FFA28` which sets `D_801273D8`/`D_801273DA`, and freshly-matched `ovl_11_func_80102DC4` (0x80102DC4, 0x58, byte-exact) which consumes the u16 availability mask `D_801273EE` — per set bit of arg0@+8 it xors the bit out of the mask (returns 0 if the bit is already free, 1 after clearing all 12) — while its link-adjacent direct caller `ovl_11_func_80102BCC` reloads/stores the same `D_801273EE` between calls, so the cluster gains two matched members sharing one global (low); freshly-matched `ovl_11_func_800FEC2C` (0x800FEC2C, 0x8C, byte-exact) is the gapless link successor of reset leaf `ovl_11_func_800FEBF8` (0x800FEBF8+0x34 = 0x800FEC2C) and its direct callee, and is that flag's set/trigger member: it sets the same s32 `D_801273B0` to 1 and copies the s32 triple at `D_8012CEE8`+0/4/8 from `D_8006C838`+0x8000+0x64CC/D0/D4 via a packed-s32 struct copy (lwl/lwr + swl/swr), so the `D_801273B0` init/trigger pair is link-adjacent and shares the flag global, extending the recorded gapless run 0x800FEAD4→0x800FEB14→0x800FEB68→0x800FEBB0→0x800FEBF8→0x800FEC2C (medium); fresh reset leaf `ovl_11_func_800FFDCC` (matched this session, 0x98, byte-exact) is the first matched writer of the cluster's upper band — zeroes s32 `D_801273DC`, s32 `D_801273E0`, the s8 run `D_801273E4`–`D_801273EB` (`D_801273E6`=0xFF), the availability mask `D_801273EE`, s8 `D_801273EC`, s16 `D_801273F0` and s16 `D_80127424`, plus the 16-byte halfword table `D_8012CF00[8]` — with the same void reset-leaf idiom as `ovl_11_func_800FEBF8` and the same count-up-`for`→descending-`bgez` table-zero loop as `ovl_11_func_801037EC` (`D_8012CF10[7]`, 0x10 above `D_8012CF00` in the same `0x8012CFxx` region); its direct callers `ovl_11_func_800FFE64`/`ovl_11_func_800FFEF0` are link-adjacent at 0x800FFE64/0x800FFEF0 (low); a fresh matched member `ovl_11_func_80100F9C` (this session, 0x60, byte-exact) also writes the same availability mask `D_801273EE` (mirrors record u16@+4) from the shared 22-byte record table `D_80071318` — its first matched reference (absolute `lui`+`addiu %lo` base, same `(idx&0xFF)*22` stride as stub run `func_80100898`/`func_80100A8C`) — and copies the record's u16s from @+6 into `D_8012CF00` (the destination buffer matched reset leaf `ovl_11_func_800FFDCC` zeroes), so the mask global's matched family now stands 0x80100F9C (writer) / 0x80102DC4 (consumer) with all three globals in the 0x80100xxx band (low); fresh matched reader `ovl_11_func_801027D4` (0x801027D4, 0x70, byte-exact) scans `D_8012CF00[0..7]` for the u16 returned by the 6-byte record accessor `ovl_11_func_80102844(arg0,arg1)` and returns whether it found a match — the first matched reference tying the recorded `D_80071A90`/`D_80071AC0` record-table accessor to the `D_801273xx`/`D_8012CF00` availability band, so it joins both clusters' shared-data votes (low); `D_801287F4` counter-state cluster 0x800BC3AC–0x800BCD28 (low) — freshly-matched leaf `ovl_11_func_800BC3AC` stores 0 to `D_801287F4`, increments the counter at `D_8006C838`+0x4488, and clears `D_8007AFF0`+0x2548C (same far-buffer write as the recorded 0x801209A8); its link-contiguous follower 0x800BC3E0 (starts exactly where 0x800BC3AC ends) reads `D_801287F4` and switch-dispatches on it (`sltiu 0x10`, jtbl), 0x800BCD28 reads it too — a zero-by-writer / read-and-dispatch pair on one counter global; `D_80128DE8` s16-limit cluster (low) — leaf `ovl_11_func_800DAFD4` (matched this session) writes six s16 constants (0: -0x32C8, 2: 0, 4: 0x1194, 8: -0x1F40, A: 0x1B8, C: 0x9C4) into the shared data symbol `D_80128DE8` (two s16 triples, offsets 0/2/4 and 8/A/C), the other two users are `ovl_11_func_800DB054` (stub; clamps against the same fields), freshly-matched `ovl_11_func_800DB00C` (matched this session, 0x48, first try EXACT — copies two 6-byte source structs {u16@0,2,4} into the two triples, declaring the shared `Ovl11DE8` type exactly as the leaf's local typedef and reading `D_80128DE8` with the same absolute `lui`+`addiu` %lo base the leaf uses, so both access the cluster identically as an extern), and direct caller `ovl_11_func_801044E4` invokes it mid scene-init chain; `D_8007AFF0` far-buffer +0x25388 pointer-slot probe + first matched `D_80125F24` reader (low) — leaf `ovl_11_func_800C0F84` (matched this session, 0x3C) dereferences the pointer at `D_8007AFF0`+0x25388 (a new offset below the recorded 0x25394–0x25476 accessor span, same single-`lui`+`addu` far-base idiom), indexes the shared s16 table `D_80125F24` through an s16 at +2 of that pointer, and returns `D_80125F24[idx] == 0x1000`; it is the first matched reference to `D_80125F24`, whose only other references are stubs `ovl_11_func_800C2044`/`ovl_11_func_800C2678`, and its sole caller `ovl_11_func_800C0A4C` (reads the result) leads a link-contiguous unbroken run that ends exactly at 0x800C0F84; a fresh member `ovl_11_func_800DD1D0` (matched this session, 0x4C, byte-exact) dereferences the same pointer slot at `D_8007AFF0`+0x25388 with the same single-`lui`+`addu` far-base idiom and returns 0 when the two s16 fields at arg0+0/+2 both match the same two fields of the pointed-at reference, else 1 — read by callers `ovl_11_func_800C2B04`/`ovl_11_func_800C401C`/`ovl_11_func_800CA24C` as an equal-compare (bnez on the result) — so the +0x25388 pointer-slot reader family now spans two matched leaves (address-apart by ~0xD228, so same-TU membership unproven, low); `ovl_11_func_800DD1D0` is itself link-contiguous above the recorded stride-copy pair (0x800DD1D0+0x4C = 0x800DD21C) `D_80128E08` 0x30-stride farm-entry table cluster (medium) — unbroken link-contiguous run 0x800DC990–0x800DCE98 of users of the single shared table global: 0x800DC990 drives the 15-entry table stepping +0x30; 0x800DC9D4 (matched) finds a free entry via bit 0x8000 of its local `Ovl11FuncC9D4Entry` type (u16@+0x28); 0x800DCBDC (matched this session, halfword-vector setter, copies 3 u16 from its `arg1` struct into @+8/+A/+C) is the byte-identical-in-shape twin of its immediate link-follower 0x800DCC1C (matched this session; same instruction shape, writes @+0x20/0x22/0x24), both part of the same entry-init pair on the table; 0x800DCC5C builds a TransMatrix/RotMatrixZXY from the same @+8/A/C and @+0x20–0x24 halfword vectors and flags @+0x28; the run 0x800DC990→0x800DCA10→0x800DCA60→0x800DCBDC→0x800DCC1C→0x800DCC5C is gapless (each ends exactly where the next begins); `D_801231F4`/`D_801231F8`/`D_801232B4` shared u16/s32 state cluster (low) -- fresh leaf `ovl_11_func_800CD6F4` (0x800CD6F4, matched this session) guards bit 8 of arg0@+0x6C, zeroes `D_801231F8`, and stores u16 `D_801232B4[arg0 s16@+0x30]` into `D_801231F4`; its direct caller `func_800C401C` (`jal` at 0x800C427C and 0x800C42D4) itself writes/reads both `D_801231F4`/`D_801231F8`; other cluster users `func_800C6AFC` (reads both as u16), `func_800C99C8` (reads `D_801231F4` as u16), `ovl_11_func_800CB114`, `func_800CD9A0`, `func_800CE654`, `func_800C9424`, `func_800CA708`, `ovl_11_func_8011FFA8`; `D_801247E8` farm-item delta-table run 0x800E351C–0x800E39B8 (medium) — unbroken link-contiguous trio of users of the single 51-entry s32 delta table (0x801247E8–0x801248B4): leaf `ovl_11_func_800E3978` (matched this session; 0x40) returns `D_801247E8[(arg0-0x15F)+1] - D_801247E8[arg0-0x15F]` for arg0 in [0x15F,0x191); stub 0x800E36CC reads the same table as `D_801247E8[t1+1]-D_801247E8[t1]`; stub 0x800E351C reads words @0x0/0xC8 of it; each ends exactly where the next begins (0x800E351C+0x1B0=0x800E36CC, +0x2AC=0x800E3978, +0x40=0x800E39B8); the same `arg0-0x15F in [0,0x32)` range guard recurs at 0x800E5294/0x800E54F8 and inline in direct caller 0x800E3DC8 (low; same band, range-idiom only); `D_8007AFDA` 9-byte lookup leaf `ovl_11_func_8011760C` (matched this session, 0x40 — first matched reference to the byte global; scans `D_8007AFDA[0..8]` for the first byte == 2 and returns its index, else -1, a `for`-loop rotated to a bottom-tested while with the counter/pointer pair) sits at the tail of an unrecorded unbroken link-contiguous run whose head 0x80117370 (caller of the leaf) + 0x801173B8 (596 bytes forking to 0x8011764C/0x80117674/0x801176BC) end exactly at 0x8011760C, followed gaplessly by 0x8011764C; fresh member `ovl_11_func_8011764C` (matched this session, 0x28, byte-exact) — a void leaf that resets two engine globals to 0 via the matched exe setter pair (`func_800226D8` = `SetVal8005E334(0)` then `func_80017B18` = `SetVal8005E2BC(0)`), called twice by the run's head 0x801173B8 (low); `D_80121780` 8-entry dispatch-table run — leaf `ovl_11_func_800BBC34` (matched this session, 0x40; first matched reference to both the table and base-engine counter `D_80070CC0`, the same `D_80070Cxx` region as the recorded `D_80070CF8`/`D_80070D38/3A/40` clusters) reads `D_80070CC0`, scales by 4, and `jalr`s through `D_80121780[%hi/lo]`; its table members are entirely ovl_11 functions — the `D_801287F4` counter-state cluster leaves 0x800BC3AC/0x800BC3E0, 0x800C14A0, 0x800BCF20, and a 0x801048A0–0x80104EA8 run — so 0x800BBC34 is the indirect dispatch caller feeding the counter-state cluster (low); `/60` clamp-scaled helper pair 0x800CD534 / 0x800CD578 (both matched) — gapless link-contiguous pair (0x44 bytes each: 0x800CD534 ends exactly at 0x800CD578, which ends exactly at 0x800CD5BC), both tier-1 leaves with the single shared caller `ovl_11_func_800CCCC0`, and both spell the same `/60` magic-constant division idiom with complementary clamp bounds: `-((n/60)*2)-5` clamped at -0x80 (0x800CD534) and `(n/60)*7+0x32` clamped at +0x7F (0x800CD578) (low); `D_8006C838`+0x8000 entity-base 0x1D4-stride s16 reader — matched leaf `ovl_11_func_801075C0` (this session, 0x44) returns `(*(s16 *)((char *)&D_8006C838 + arg1-slot*0x1D4 + 0x8000 + 0x1A16) ^ lo) != 0`, built with the same two-stage base idiom (pure `lui`/`addiu` base then +0x8000 as runtime `ori`/`addu`) as the recorded `EntityD5D4` accessor pair 0x800F4CAC/0x800F4CEC and 0x800BFD04/0x8010C3C4; called by link-adjacent stub `ovl_11_func_80107528` (which dispatches arg0∈{0..4} and feeds it `hi = a1>>8, lo = a1&0xFF`); a second matched member joined this session — `ovl_11_func_8011FF0C` (matched this session, 0x68, 26/26, byte-exact first draft) reads the u16 at +0x19EC of the same `D_8006C838`+0x1D4-stride+0x8000 entity-base view and clamps it (writes `x+arg` when `x < 0xFFFF-arg`, else `0xFFFF`): the same two-stage `lui`/`addiu` base + runtime `ori`0x8000+`addu` idiom and 0x1D4 stride as matched `ovl_11_func_801075C0`, so the 0x1D4-stride entity-base family now spans two matched leaves; address-apart from the others by ~0x8894, so same-TU membership unproven (low) fresh leaf `ovl_11_func_800FEB68` (matched this session, 0x48, byte-exact) counts the 20 u16s at `D_8006C838`+0x81BC stepping +0xB8 whose value lies in [0x160,0x164) (`(x-0x160)<4u` `lhu`+`addiu`+`sltiu` range probe, countdown do-while `while(n>=0)`) — built with the same two-stage `D_8006C838` base (`lui`/`addiu` %lo then runtime `ori`+`addu` offset, offset > 0x7FFF) as, and byte-exact loop-shape twin of, matched `ovl_11_func_800FEAD4` (which reads `D_8006C838`+0x901C with the same u16 countdown-loop leaf idiom); the two sit in one gapless link run 0x800FEAD4→0x800FEB14→0x800FEB68→0x800FEBB0→0x800FEBF8, so same-TU membership with 0x800FEAD4 is likely (medium); freshly-matched `ovl_11_func_800FEB14` (this session, 0x54, byte-exact), the run's middle member, counts the 10 entries at `D_8006C838`+0x7AE8 stepping +0xB4 (u16@-0x34 nonzero AND u32@0 lacking bit 0x02000000) with the same `D_8006C838` base and u16 countdown do-while (`n=9; while(n>=0)`) leaf idiom, extending the same-TU family to the +0xB4-stride 10-entry band (medium); the next run member `ovl_11_func_800FEBB0` (matched this session, 0x48, byte-exact) is the byte-exact loop-shape twin of 0x800FEB68 — same two-stage `D_8006C838` base, same +0x81BC offset and +0xB8 stride, same `(x-bound)<range` probe and countdown do-while — counting the 20 u16s in the complementary band [0x164,0x166] (`(x-0x164)<3u`), so the pair likely partitions one table's value range from the same original file (medium); `D_8005181A` shared-data symbol leaf `ovl_11_func_8011DD48` (matched this session, 0x18, byte-exact first try) — tiny 5-arg struct-setter leaf (`D_8012D52C`-run member `ovl_11_func_8011BAFC` is a direct caller) reading `D_80054BC0[0]` and adding `(s32)&D_8005181A` with the same unsplit-self-clobber `la` address form as engine `func_8001A284` and the stub family 0x8011AA64/0x8011ADF4/0x8011AFB4/0x8011AC30 that all reference the `0x800518xx` data region (low); fresh member `ovl_11_func_8011CEE0` (matched this session, 0x30, byte-exact first draft) — tiny dst-forwarding leaf calling the engine u16-string copier `func_8001ABF0(dst, (u16*)(D_80054BC0[0] + (s32)&D_80051808))`, the second matched member of the `D_80054BC0[0]` + `&D_800518xx` shared-data-symbol idiom (new symbol `D_80051808` = `D_80051768`+0xA0, same `0x800518xx` region); its sole direct caller `ovl_11_func_8011CD2C` ends exactly at 0x8011CEE0 (0x1B4, zero-gap), `ovl_11_func_8011CC08` takes its address as a callback pointer, and it ends exactly at 0x8011CF10, so the link run 0x8011CD2C→0x8011CEE0→0x8011CF10 is unbroken — address-apart from the 8011DD48 member, so same-TU membership within the idiom family stays unproven (low); freshly-matched `ovl_11_func_8011DE70` (this session, 0x4C, byte-exact) is a global-free s16 range-check leaf (`(arg0-1)&0xFFFF < 0x19` gate, `(arg0-1)%5` else -1) and the gapless link predecessor of the recorded 0x801282xx accessor leaf `ovl_11_func_8011DEBC` (0x8011DE70+0x4C=0x8011DEBC), so the run now stands 0x8011DE70→0x8011DEBC→0x8011DF04→0x8011DF4C with three consecutive pure leaves (same-TU membership unproven, low); `ovl_11_func_8011DF04` (matched this session, 0x48, byte-exact) is a pure global-free s16-selector leaf (maps 0x7A/0x7B/0x7C/0x60 to 3/2/1/4 else 0 via an if-chain) and the gapless link successor of the recorded 0x801282xx accessor leaf `ovl_11_func_8011DEBC` (0x8011DEBC+0x48=0x8011DF04, +0x48=0x8011DF4C; freshly-matched `ovl_11_func_800EFD54` (this session, 0x4C, byte-exact) is the first matched reader of the shared 0x14-stride range-clamp table `D_80124A18` (reads s16@+8 and s32@+0xC of `D_80124A18[arg0]` and clamps `arg2` between them), the direct-callee of stub caller `ovl_11_func_800EFABC` and one of four read sites of the same table — 0x800EFABC/0x800EFC68/0x800EFD54/0x800EFF04 — which with the two in-between leaves 0x800EFDA0/0x800EFE34 form one gapless link run 0x800EFABC→0x800EFC68(0xEC)→0x800EFD54(0x4C)→0x800EFDA0(0x94)→0x800EFE34(0xD0)→0x800EFF04(0x98) ending exactly at 0x800EFF9C, the four read sites building the same absolute `lui`+`addiu %lo(D_80124A18)` base — same-TU membership plausible (low); the run's in-between leaf `ovl_11_func_800EFDA0` (matched this session, 0x94, byte-exact) is a global-free three-arg comparison-dispatch switch leaf (`sltiu arg2<5` + 5-entry jtbl_800B9F00 returning 0/1 per comparison arm through one shared result variable and a single return tail) — it builds no `D_80124A18` base and touches no global, so its run vote is adjacency only; new rodata evidence this session: its jtbl sits at rodata 0x20E0 contiguously between jtbl_800B9EE8 (rodata 0x20C8, owned by link-predecessor 800EFC68) and jtbl_800B9F18 (rodata 0x20F8, owned by link-successor 800EFE34), the three consecutive link-order functions' switch tables interleaved in one rodata run in text order, separated only by the 4-byte zero pad word D_800B9F14 (alignment, generic rodata, no TU emits it), and the compiled TU's `.rodata` extent (0x14) equals the original attribution extent exactly — the per-TU-contiguous-rodata signature voting the trio 800EFC68/800EFDA0/800EFE34 into one original source file (low); the trio's third member `ovl_11_func_800EFE34` (matched this session, 0xD0, byte-exact first draft, clean C baseline flags) is a global-free three-arg arithmetic-dispatch switch leaf (`sltiu arg2<6` + 6-entry jtbl_800B9F18; case 0..5 store/add/sub/mul/div/mod of arg1 into `*(s32*)arg0`, div/mod guarded on arg1==0, one shared return tail) and carries the same measured signature — its compiled TU's `.rodata` extent (0x18, exactly its 6 table words, rodata 0x20F8–0x2110 contiguous after 800EFDA0's extent + the 4-byte pad word) equals the original attribution extent exactly, so the per-TU-contiguous-rodata signature now stands measured on both switch members of the trio and the same-TU membership of 800EFC68/800EFDA0/800EFE34 is measured, not single-member hypothesized (medium); `D_800759E4` shared-object initializer run 0x80109310–0x8010946C (low) — fresh head `ovl_11_func_80109310` (m, this session, 0x10C, byte-exact) is the gapless link predecessor (0x80109310+0x10C=0x8010941C) of leaf `ovl_11_func_8010941C` and is called by stub `ovl_11_func_8010946C` on the same object, writing its s16 field run 0xE0–0xEE; leaf `ovl_11_func_8010941C` (matched this session, 0x50, byte-exact first try) is the gapless link predecessor (0x8010941C+0x50=0x8010946C) of stub `ovl_11_func_8010946C`, which `ovl_11_func_80108CD0` feeds `&D_800759E4` (that reader `lhu`s `D_800759E4`'s u16@0 and passes the object); 0x8010941C is the first matched direct writer of `D_800759E4`'s lower fields — per-sub-state arg (0 → u16@0x30=1, s32@0x38=-0x708, @0x3C=0, @0x40=0xC1C; 1 → @0x30=9, @0x38=0xE6, @0x40=-0x514) — called by 0x800E537C / func_800EC064 / func_800F3FF4 / 0x800E8250; the same object's s32@0x34 flags word is the recorded bit-17 flag family's field (func_800CF044 `lw`s `D_800759E4`+0x34 and masks 0x20000), so the run widens that family with a lower-field initializer (same-TU unproven); `D_80128CB4`–`D_80128CC8` shared-state cluster (low) — leaf `ovl_11_func_800C5048` (matched this session, 0x50, byte-exact) is the first matched writer of the contiguous cluster (s32 `D_80128CB4`/`D_80128CB8`/`D_80128CBC` + s16 `D_80128CC0`/`D_80128CC2`/`D_80128CC4`/`D_80128CC6`/`D_80128CC8`) from its six args (constants 0 and 0x28 plus four s16 and one s32), read by its address-adjacent gapless successor `ovl_11_func_800C5098` (starts exactly at 0x800C5048+0x50; reads `D_80128CB4`/`D_80128CB8`/`D_80128CC0`/`D_80128CC2`/`D_80128CC4`/`D_80128CC6`/`D_80128CC8` still as a stub) — a write/read pair on one cluster, and all three callers (0x800C4B6C/0x800C4C94/0x800C4DE0) lie inside the recorded dispatch-caller run 0x800C4A2C–0x800C55FC; `ovl_11_func_800E8BA0` (matched this session, 0x50, byte-exact) is the first matched reader of the shared s32 table `D_80129560` — whose only other users are an address-dense band of stubs (0x800E5A1C–0x800EExxx, incl. load-side 0x800E6834/0x800E686C) using the same absolute `lui`+`addiu %lo` base and s16-fused `sll16`/`sra14` index idiom — and reads the recorded `D_8006C838`+0x8000 two-stage entity base at the new slot offset +0x5DD0 (a 0x18-stride pool pointer initialized by exe `func_80021E60`'s `base2[0x5DD0>>2]` store), storing one entry's u16@+2 into `D_80129560[(s16)arg1]` (low); freshly-matched `ovl_11_func_800E8D00` (this session, 0x7C, byte-exact) is a second matched **writer** of the same `D_80129560` s32 table — selects one of four `D_8006C838` s16s (+0x524C/+0x524E vs +0x5252/+0x5254 by `(s16)arg1`, first-of-pair overridden by second when arg2 && first==0xA4) and stores it `D_80129560[(s16)arg0]` via the same s16-fused `sll16`/`sra16` index idiom, 0x160 above `ovl_11_func_800E8BA0` inside the recorded user band — same-table + band + idiom vote with the 800E8BA0 member (low); freshly-matched `ovl_11_func_800E89CC` (this session, 0x58, byte-exact) is a second matched reader of the same `D_8006C838`+0x8000 two-stage entity base at the same slot +0x5DD0 (the 0x18-stride pool pointer); it advances to `pool[arg0]` and OR-sets / AND-clears bit 0 of the entry's u16@+4 under a `(s32)arg1<<16` flag test — same two-stage base idiom and 0x18-stride pool entry as `ovl_11_func_800E8BA0` (14/20 instruction shapes align in order, identical toolchain), address-near it (0x800E89CC, 0x1D4 below the sibling), so same-TU membership with the +0x5DD0 sibling is plausible (low); fresh member `ovl_11_func_800E8960` (this session, 0x6C, byte-exact) is the gapless link predecessor of `ovl_11_func_800E89CC` (0x800E8960+0x6C = 0x800E89CC) and the writer/initializer member of the same +0x5DD0 0x18-stride pool object — same two-stage `D_8006C838`+0x8000 base at slot +0x5DD0, advances to `pool[arg0]`, stores the `D_8007AFF0` far-buffer halfword @+0x25476 into u16@0 (a second reader of that offset beside recorded probe 0x800C9D64, unsigned `lhu` here vs its signed `lh`), writes s32@0xC/@0x8/@0x10 from args, and OR-sets bit 0 of u16@+4 — the exact flag field 800E89CC reads — so link order plus the shared pool object vote with the +0x5DD0 family (low); freshly-matched `ovl_11_func_800F4FC8` (this session, 0x54, byte-exact) is a flag-guarded writer member of the same `D_8006C838`+0x8000 two-stage base family — reads the recorded +0x5DD4 entity-slot pointer, steps +0x18 to the next 0x18-stride pool entry, AND-clears bit 0 of its u16@4 (the same u16@4 the +0x5DA4 family 0x800F4AC0/0x800F4B14/0x800F53BC rewrites), AND-clears bit 0x02000000 of the `D_8006C838`+0x44F8 flag word (a clearing twin of reader 0x800D603C's bit-0x400000 test; 800FEB14 reads the same bit), and zeroes u8@+0xE650; address-near the 0x800F4AC0–0x800F4CEC +0x5DD4/+0x5DA4 slot band, so same-TU membership with the entity-slot pair 0x800F4CAC/0x800F4CEC is plausible (low); bit25@+0x34 flag-read leaf `ovl_11_func_800E2718` (matched this session, 0x54, byte-exact) — a read-probe member of the recorded {u16@0, s32@0x34} object-struct flag family: guards u16@0 and probes bit 0x02000000 of the s32@+0x34 flag word, returning -1 only when u16@0 is 0 and the bit is clear, otherwise on `u16@+0xB0` of the same struct returns 0x86/0x10A/0x109 by `t<3`/`t<0xA` — a bit-testing twin of the bit-16 probes 0x800DF4F0/0x800E109C and the bit-17 writer 0x800CF2C8 on the same object struct, adding the new field offset +0xB0; address-apart (0x800E2718) from the other family members, so same-TU membership unproven (low); freshly-matched `ovl_11_func_800C0EA4` (matched this session, 0x58, byte-exact) is a first-free-slot allocator over the shared 50-entry s32 array `D_80128A88` (-1 = free): gapless link successor (0x800C0DB4+0xF0=0x800C0EA4) of its sole caller `ovl_11_func_800C0DB4` (a stub switch-run that `lh`s the item id from record @+0xC before the call), and the second matched reference to `D_80128A88` alongside `ovl_11_func_800C0A28` (the “slot 0 free” probe `~D_80128A88 != 0`); both D_80128A88 references and the caller sit in one gapless link run with only stub functions between them, so same-TU membership among the three is plausible (low); freshly-matched `ovl_11_func_800F4B5C` (this session, 0x58, byte-exact) is a flag-guarded writer member of the recorded `D_8006C838` flag family — probes bit 2 of the shared +0x44F8 s32 flag word (elsewhere tested at bit 0x400000 by 0x800D603C and bit 0x02000000 by 0x800F4FC8/0x800FEB14) and, on pass, stores the range-capped ([0x51,0x56) signed s16) arg into the u16 at +0x44D6, a field no other matched function references; at 0x800F4B5C it sits inside the 0x800F4AC0–0x800F4FC8 entity-slot/flags band, immediately between matched 0x800F4B14 and the 0x800F4CAC/0x800F4CEC pair, so same-TU membership with the cluster is plausible (low); freshly-matched `ovl_11_func_800F5108` (this session, 0x58, byte-exact) is a fourth member of the ovl_11 CAPTURE_PREV_RET dead `sw $v0,0($sp)` phantom-store fossil family (same per-TU v0-channel quirk + `tmp[2]` frame as 0x800CFAD0/0x8011D438/0x800D1CD0) — a leaf that bit-dispatches on a u16 flags word (bits 0x2000/0x800/0x1000, in that order) returning one of its s16 args, whose direct caller `ovl_11_func_800F5160` sits in the same 0x800F4xxx–0x800F5xxx flag band and stores the result as a halfword; `D_80050B5C` 0x20-stride item-table lookup family (medium) — fresh leaf `ovl_11_func_80100A34` (0x80100A34, matched this session, 0x58, byte-exact first try) is the second matched reader of the shared table global after matched `ovl_11_func_801000D4` (returns the matched entry's u32 @+0, else sentinel 0x2206; the 801000D4 member returns 1/0), both the same `for (i = 0; D_80050B5C[i].id != 0xE2; i++)` scan idiom producing the identical reload-plus-two-const `0xE2` loop shape; 80100A34's return (used as an offset) is read by direct caller `ovl_11_func_80100898` (lhu-feeds the mask arg) in the same 0x80100xxx link band; `D_801284xx` keyed-lookup cluster (low) — fresh leaf `ovl_11_func_8011EE40` (matched this session, 0x58, byte-exact) is the first matched reader of the shared {u8,u8} byte-pair table `D_80128424` (0xFF-terminated; a `for (i = 0; D_80128424[i] != 0xFF; i += 2)` scan rotated to a bottom-tested while via the counter/pointer family, returning the paired byte else -1, arg sign-extended from caller's `lh`); it sits link-contiguous exactly after its sole direct caller `ovl_11_func_8011ECC4` (stub, 0x8011ECC4+0x17C = 0x8011EE40) and before `ovl_11_func_8011EE98`, and the caller feeds the returned value `sll`×3 to scale-walk the shared sibling table `D_801284AC` in the same `0x801284xx` data region — call edge plus link order plus a shared data cluster, same-TU membership plausible but unproven; `D_800A0494` 9-s16-slot-row table family (low) — matched leaf `ovl_11_func_800D6730` (this session, 0x5C, byte-exact first try) is the first matched reference to the shared table, a 32-row × 18-byte (9×s16, stride 0x12) grid it treats as `D_800A0494 + row*9`: it scans row `arg1` for the first zero slot, writes s16 `arg0` there and returns the slot index else -1, built with the same absolute `lui`+`addiu %lo` base; the init stub `func_800D6628` (address-apart 0x108) memsets rows 0–1 to 0 and fills rows 2–31 (`0x21C` from `+0x24`) with 0xFF, so 0 = empty slot and nonzero = occupied, and the allocator's caller `ovl_11_func_800D6A94` passes row ∈ {1,2} — rows 1 and 0 are the zero-init region while row 2 starts in the 0xFF region, so a second writer (stub `func_800D6F78`, also referencing the table) must clear slots back to 0; sibling stub `func_800F0A58` reads it too — a shared-table allocator/init family inside ovl_11, same-TU membership plausible but unproven; a fresh matched member `ovl_11_func_800D678C` (this session, 0x68, byte-exact) is the FIRST matched reference to `D_800A04B8` (0x800A04B8 = the shared grid at +0x24, i.e. the row-2-relative view, itself treated as a 0x1E-stride record table indexing `D_800A04B8[arg0]` = +arg0*0x10E, scanning 9 records stepping +0x1E and returning 1 unless some record's s16@+0x18 is != -1 && >= 0x3F0); its callers/references 800D666C/800D67F4/800D6A94/800D7144 (incl. direct caller `ovl_11_func_800D6A94`, the recorded allocator's caller) are still stubs — same absolute `lui`+`addiu %lo` base, so the shared-table family now has a second matched reader and the record table's own same-TU vote is (low); range-checked jump-table switch-leaf idiom (low) — freshly-matched `ovl_11_func_800D2950` (this session, 0x60, byte-exact) is a second matched user of the exact `(s32)((arg0<<0x10)+K)>>0x10` + `sltiu` + `jtbl` dispatch spelling of byte-exact member `ovl_11_func_800C3548` (identical toolchain, 13/16 shapes align), a 197-entry table (jtbl_800B8840) classifying s32 arg in [0xA1,0x164] into return constants (-0x14/-0x1E/-0x28/-0xA else 0); no globals, leaf, so its same-TU vote is idiom-only; `ovl_11_func_800D2D54` (matched this session, 0x64, byte-exact) joins that same family — a 197-entry jtbl_800B8B58 over the same [0xA1,0x165] code window (identical `sltiu`+`jtbl` dispatch shape) — as a writer member of the recorded {u16@0, s32@0x34} flag family (ORs bit 0x1000 / 0x80000000 into u32@+0x34), and enumerates exactly the shared key-code universe of matched `ovl_11_func_800D3BB0` (0x113/0x153/0x155/0x159/0x162/0x165 all appear in both case lists), so its same-TU vote with the 800D3BB0 key-code leaf is (low); `ovl_11_func_80111CC4` gapless-run leaf (low) — matched this session (0x64, byte-exact): a pure global-free s16 compare leaf (returns 0/1/2/3 classifying arg0 against arg1 and its [arg1, arg1+2) window; arg0∈{5,6}→0, arg0≥7∧arg0<arg1→1) called by its two gapless link predecessors `ovl_11_func_80111A60` (0x114, ends exactly at 0x80111B74) and `ovl_11_func_80111B74` (0x150, ends exactly at 0x80111CC4) — the run 0x801115A8→0x80111750→0x8011184C→0x80111944→0x80111A60→0x80111B74→0x80111CC4→0x80111D28 is unbroken, and call edge plus link order agree, so same-TU membership with the immediate-predecessor pair is plausible but unproven; a fresh matched member `ovl_11_func_8010B830` (this session, 0x64, byte-exact first draft) is a switch-form writer of the same `{u16@0, s32@0x34}` object-struct flag family — dispatches on u16@0 values 0x15E/0x15F into the s32@+0x34 flag word (0x15E → AND-clears bits 0x8000|0x800000 of it, 0x15F → ORs 0x808000) rather than the family's usual u16@0 guard, no-frame leaf returning 0 (low); fresh guard-form writer `ovl_11_func_80109310` (m, this session, 0x10C, byte-exact) guards u16@0 == 0x107 and applies the exact same 0x8000|0x800000 clear / 0x808000 set pair to the same s32@+0x34, sharing 0x8010B830's mask-pair idiom on the same object struct (address-apart, so same-TU unproven) (low); fresh member `ovl_11_func_800F4A58` (this session, 0x68, byte-exact first draft) is a flag-gated reader of the recorded `D_8006C838`+0x8000 two-stage base at the entity-slot pointer +0x5DD4 (the slot 0x800F4CAC/0x800F4CEC/0x800F4FC8 read): probes the +0xC flag word bit 0x08000000 (the sharing sibling of the recorded +0x44F8 flag word) and, on clear + bit 0x100 set in the pointed struct's u16@+4, decrements s32 `D_80129634` (the first matched reader of the `D_801296xx` region beside `D_80129630`) and masks bit 0x100 out of u16@+4 when the count had hit 0 — sits inside the 0x800F4AC0–0x800F4FC8 entity-slot band, so same-TU membership with the entity-slot pair is plausible (low); freshly-matched `ovl_11_func_800F501C` (this session, 0x70, byte-exact) is the first matched writer of SP_5D98: reads the +0x5D98 pool-slot (the 0x18-stride pool `exe func_80021E60` initializes via `base2[0x5D98>>2] = D_8004ED04+0x360`), indexes `(arg0*0x18)+0xF0` and writes s16@0xF2 (ID 0xE8/0x123) + bit 0 of u16@0xF4 — same two-stage base + 0x18-stride u16@+4 bitflag idiom as the +0x5DA4 (800F4AC0/800F4B14) and +0x5DD0 (800E8BA0/800E89CC/800E8960) slots, joining the recorded entity-slot band's same-TU vote (low); freshly-matched `ovl_11_func_800EDEB8` (this session, 0x84, byte-exact first draft) is the first matched reference to both `D_80076280` and `D_80071B00` — a no-frame leaf that adds s16/s32/s32 arg deltas (×2) to the s32 fields @+0/+4/+8 of a 0x1D4-stride table entry `D_80076280[arg0]`, with arg0==0x29 rerouted to base `D_80071B00`, returning 1; `D_80076280` sits 0x60 inside the recorded `D_80076220` 0x1D4-stride cluster's data span and uses the same 0x1D4 stride and s16-sign-extend-index accessor idiom as its matched reset members 0x800C1BE0/0x800C1C90/0x800E549C, so a shared data body / same-original-file vote with that cluster is plausible but the 0x60 offset is not entry-aligned and all link-adjacent neighbours (0x800EDD54/0x800EDF3C/0x800EE000) are still stubs — same-TU membership unproven (low); `D_80123A2C`/`D_80123A8C` /5 row-table sibling pair 0x800D29B0 / 0x800D2A88 (medium)
| `ovl_30` | `Obj\GF_swind.bin` | D_80134008/D_80134B0C init/read pair with 8012F084 and 8012FDEC as later users (low) |
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

## `ovl_11` D_800749F4 predicate-scan + its callee — 0x800CFAD0 / 0x800CFB20 (confidence: medium)

Evidence: zero-gap link-order adjacency that the call graph agrees with —
`ovl_11_func_800CFAD0` (0x800CFAD0, size 0x50) ends exactly where
`ovl_11_func_800CFB20` begins, and both of 800CFB20's call sites target that
predicate. 800CFB20 also walks the same absolute-addressed D_800749F4
20-entry 0xB8-stride record array as the accessor pair below, in lockstep with
the parallel 20-entry flag words at D_8006C838+0x81F0, plus a second
10-entry 0xB4-stride D_800742EC array. Adjacency + shared-global evidence; a
prior, not a proven TU boundary.

Members:
- ovl_11_func_800CFAD0 (m) — field 0x34 flag predicate on one D_800749F4-style
  record, gated by arg1 bits 0/1 and 0x80000 → 0x100/0x80000 combinations.
- ovl_11_func_800CFB20 (m, matched this session, byte-exact) — predicate run:
  returns 1 when 800CFAD0 accepts a D_800749F4 entry (flags at
  D_8006C838+0x81F0, arg0 bits 0/1) or a D_800742EC entry (arg0 bit 2), else 0.

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

## `ovl_11` D_800749F4 record consumer `ovl_11_func_800D0DCC` — 0x800D0DCC (confidence: medium)

Evidence: called by both predicate-run twin heads — `ovl_11_func_800DF9F0`
(800DF4F0 span) and `ovl_11_func_800E15C8` (800E109C span) — immediately
after their `ovl_11_func_800DF4F0`/`ovl_11_func_800E109C` guard and
`+0x34 & 2` lazy-init, passing the caller's record pointer straight through
as arg0. It reads `s16@+0x16`, `u16@+0xAE` and `u16@+0xB2` on that same
record — the +0x16/+0xAE fields the predicate-run members touch — and zero-gap
link-order adjacency places it inside the 0x800D0C34–0x800D0EA4
accessor/setter run (0x800D0DBC ends exactly at 0x800D0DCC; 0x800D0DCC ends
exactly at 0x800D0EA4). Same-object and caller-cluster evidence, not a proven
TU boundary.

Members:
- ovl_11_func_800D0DCC (m) — record-apply leaf: indexes D_80128D70 by
  `0x15 - u16@+0xB2`, stores 0xFFFF through `func_8001A970`'s returned
  pointer, then selects 0x6BD/0x6BE/0x6BF/0x6C2/0x6C3/0x6C4 from
  +0xAE/+0xB2/+0x16 and returns `func_8002261C(0, code)`.

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

## `ovl_11` 0xB0-object initializer pair — 0x800D3390 / 0x800D3404 (confidence: medium)

Evidence: exact link-order adjacency (0x800D3390 len 0x74 ends where
0x800D3404 begins) and a shared object: 800D3390 clears a 0xB0-byte
object and tags its leading halfwords, then calls 800D3404 with that same
pointer, which sets the object's leading s16. Both members touch only the
leading halfwords of the 0xB0-byte view, and the call edge agrees with the
link order.

Members:
- ovl_11_func_800D3390 (m, matched this session, byte-exact) — guards on
  `u16@+0`, `memset` 0xB0, stores s16@+0 and 0xFFFF@+4, hands the object
  to 800D3404, clears 0xA8/0xAA via 80107DD0; returns 0, or -1 if already
  initialised.
- ovl_11_func_800D3404 (s) — sets s16@+0 from arg1, then calls
  ovl_11_func_800D3574; returns 0.

## `ovl_11` +0x34 flag-to-constant map run — 0x800D3C04–0x800D3CE8 (confidence: high)

Evidence: four link-order-contiguous functions with no gaps (0x800D3C04
len 0x50, 0x800D3C54 len 0x50, 0x800D3CA4 len 0x44, 0x800D3CE8 len 0x44)
sharing one author idiom and one callee. Each reads `u32@+0x34 & 0x2000`
to pick a first argument, calls `func_80012A34`, then maps its return value
onto a small constant; they differ only in the two/three constants chosen.
The original instruction streams agree under constant substitution alone,
which is strong source-family evidence (adjacency + shared idiom + shared
callee all point the same way).

Members:
- ovl_11_func_800D3C04 (m) — flag → arg 3/8, result 8 / 1 / 9.
- ovl_11_func_800D3C54 (m) — flag → arg 3/8, result 11 / 1 / 12; same
  body as 800D3C04 with the two result constants changed.
- ovl_11_func_800D3CA4 (m) — flag → arg 2/7, result 0xA / 1.
- ovl_11_func_800D3CE8 (m) — flag → arg 2/7, result 0xD / 1.

## `ovl_11` ovl_11_func_800F6680-driven state-set run — 0x800F66F0–0x800F67E0 (confidence: medium)

Evidence: three link-order-contiguous functions with no gaps
(0x800F66F0 len 0x44, 0x800F6734 len 0x44, 0x800F6778 len 0x68) that all
open by calling `ovl_11_func_800F6680`, then write `D_80126E40` and issue a
short fixed sequence of `func_8001AF70` / `func_8001B2CC` / `func_800226D8` /
`func_80017B18` / `func_8002261C` calls. 0x800F6778 additionally ORs bit
0x20000 into `D_8006C838.field_0C`, the shared flag word reached by other
`D_8006C838` views. Adjacency plus the shared entry callee and shared global
cluster all point the same way.

Members:
- ovl_11_func_800F66F0 (m) — opens with `ovl_11_func_800F6680`, sets
  `D_80126E40 = 6`, then `func_8001AF70(0x71, 1)` / `func_8001B2CC(0, 2)`.
- ovl_11_func_800F6734 (m) — same prologue, sets `D_80126E40 = 7`, then
  `func_8001AF70(0x70, 1)` / `func_8001B2CC(0, 2)`.
- ovl_11_func_800F6778 (m, matched this session) — same prologue, ORs bit
  0x20000 into `D_8006C838.field_0C`, sets `D_80126E40 = 4`, then
  `func_800226D8(0)` / `func_80017B18(0)` / `func_8002261C(3, 0x37A)`.

## `ovl_11` s16 /30 HUD-argument run — 0x800FE640 / 0x800FE704 / 0x800FE780 (confidence: medium)

Evidence: link-order adjacency with no gaps (0x800FE640 len 0xC4 ends exactly at
0x800FE704 len 0x7C ends exactly at 0x800FE780, len 0x7C) plus an identical call
idiom: all three compute `(((s16)D_80127212) / 30) & 0xFF` and pass it as the 4th
argument of `func_80015EE8(D_8005E3C0->field_D8 + 0x68, &D_8012CE88, N, v, A, B)`.
The shared callee, shared globals (`D_80127212`, `D_8012CE88`, `D_8005E3C0`) and
shared /30 magic-constant sequence all point the same way.

Members:
- ovl_11_func_800FE640 (m) — two calls, sub-modes `0` / `2`, trailing args
  `0x20` / `0x18` and `0x108` / `0x18`.
- ovl_11_func_800FE704 (m) — sub-mode argument `1`, trailing args `0x120` / `0x30`.
- ovl_11_func_800FE780 (m) — sub-mode argument `3`,
  trailing args `0x120` / `0xC8`.

## `ovl_11` 0x38/0x3C state-switch run — 0x800C4F44 / 0x800C6E0C / 0x800C6E8C / 0x800C6F0C / 0x800C6F6C / 0x800C7270 / 0x800C8334 / 0x800C838C / 0x800C83FC / 0x800C846C / 0x800C8764 (confidence: medium)

Evidence: four functions in the same small 0x800C6E0C–0x800C72F4 link-order
run that read and write the same
recovered field layout and end in the same call idiom. The three earlier ones
take an a0 view with `u16@+0x38` and `u16@+0x3C`, switch on `+0x3C`, store an
s32 into an a1 view's 4-byte union at `+0`, then call
`func_80015840((u8*)arg0 + 0x260, arg1->unk0.unk0_b)`. The view typedefs
recovered from the already-matched `ovl_11_func_800C6F0C` fit the new function
unchanged, which is shared-type-cluster plus shared-idiom evidence.

Members:
- ovl_11_func_800C6E0C (m, matched this session) — switch on `+0x3C` over
  {1,2,4}: `+0x3C==2` → `+0x38 + 0xF`, `+0x3C==1` → `0x1B`,
  `+0x3C==4` → `+0x38 + 0x13`; then the shared tail call.
- ovl_11_func_800C6E8C (m, matched this session) — same switch shape over
  {1,2,4}: `+0x3C==1` → `0x29`, `+0x3C==2` → `+0x38 + 0x2A`,
  `+0x3C==4` → `+0x38 + 0x13`; same view typedefs and tail call, constants
  only.
- ovl_11_func_800C6F0C (m) — switch on `+0x3C` over {2,4}: stores
  `+0x38 + 0xAC`, rewrites `+0x3C = 2` in the case-4 arm; same tail call.
- ovl_11_func_800C6F6C (m, matched this session, byte-exact) — link-order
  neighbour sharing the run's exact a0/a1 view typedefs and tail call: switch
  on `+0x3C` over {1,2,4}: `+0x3C==1` → `0x36`, cases 2/4 → `+0x38 + 0x3B`,
  and the case-4 arm additionally calls `func_8001B2CC(0, 0)`; constants plus
  the extra call are all that differ.
- ovl_11_func_800C7270 (m, matched this session) — stores `+0x3C = arg1`,
  copies old `+0x3C` into `+0x3E`, sets bit 0x20000000 / clears bit 0x04000000
  of `+0x6C`, then calls `func_80015840((u8*)arg0 + 0x260, arg2 & 0xFF)` and
  conditionally `func_8001589C` on the same `+0x260` object; same `+0x38`/
  `+0x3C` field pair and the same `+0x260` call base, with additional witnessed
  fields `+0x1C` and `+0x265`.
- ovl_11_func_800C8334 (m, matched this session) — gates on the same a0
  object's `s16@+0x8A == 0x47`, else-branch calls `func_8002261C`; taken
  branch calls the run's `ovl_11_func_800C7270` with the group's `u16@+0x38`
  field as `arg0->unk38 + 0x17` and `arg3 = -2`, then `func_8001FABC(0x13)`;
  same `+0x38` field pair and a direct call into the run — shared-type plus
  call-edge evidence.
- ovl_11_func_800C838C (m) — reuses `Recon_ovl_11_func_800C8334_A0View`;
  gates on `ovl_11_func_800D756C(s16@+0x8A) != 0`, compares `u16@+0x38`
  against an a1 view's `s16@+0x8`, and calls the run's
  `ovl_11_func_800C7270` with `+0x38 + 0x17`, `arg3 = -2`; else-branch calls
  `func_8002261C(2, ...)` — same type plus call-edge evidence as 800C8334.
- ovl_11_func_800C83FC (m, matched this session) — near-identical clone of
  800C838C at the link-order-adjacent address, sharing that exact word shape:
  gates on `ovl_11_func_800D7504(s16@+0x8A) != 0` (the run-adjacent
  `0x800D7504/753C/756C` predicate trio's first member), compares `u16@+0x38`
  against an a1 view's `s16@+0x8`, and calls `ovl_11_func_800C7270` with
  `0x5B`, `+0x38 + 0x17`, `arg3 = -2`; else-branch calls
  `func_8002261C(2, 0x1A2)` — constants and the predicate callee differ,
  everything else including the `Recon_ovl_11_func_800C8334_A0View` type and
  the callee cluster is shared.
- ovl_11_func_800C846C (m, matched this session, byte-exact) — third clone in
  the link-order-adjacent 838C/83FC/846C run, sharing that exact word shape:
  gates on `ovl_11_func_800D753C(s16@+0x8A) != 0` (the predicate trio's second
  member), compares `u16@+0x38` against an a1 view's `s16@+0x8`, and calls
  `ovl_11_func_800C7270` with `0x59`, `+0x38 + 0x17`, `arg3 = -2`; else-branch
  calls `func_8002261C(2, 0x1A3)` — constants and the predicate callee differ,
  everything else including the `Recon_ovl_11_func_800C8334_A0View` type and
  the callee cluster is shared.
- ovl_11_func_800C8764 (m, matched this session, byte-exact) — fourth member of
  the `Recon_ovl_11_func_800C8334_A0View` sub-family: same `s16@+0x8A` /
  `u16@+0x38` view with the `+0x8A == 0` gate and `func_8002261C(2, 0x20A)` in
  the else-branch, plus the run's `ovl_11_func_800C7270(0x61, +0x38 + 0x17,
  -2)` and `func_8001FABC(9)` tail; additionally indexes `D_8006C858`
  (`ItemData`, +0x14 word == -1 or flags 0x9000). Sits in the same
  0x800C8764 link window ~0x288 above 800C846C, and the shared caller
  `ovl_11_func_800C7AC0` calls both 800C846C and 800C8764 — shared type plus
  two call edges.
- ovl_11_func_800C4F44 (m, matched this session, byte-exact) — same
  `Recon_ovl_11_func_800C7270_A0View` object, and the first member to witness
  its `s16@+0x84` element array and `u16@+0xF0` copy target: selects the
  element at `+0x84` (arg1 == 0) or `+arg2*6 + 0x90`, and if the s16 there is
  nonzero clears bit 0x18000000 of `+0x6C`, calls
  `ovl_11_func_800C7270(0x15, 0x47, arg3)`, copies the element onto `+0xF0`
  with `ovl_11_func_800D7348`, sets bit 0x8000 of `+0x6C`, then
  `func_8001FABC(7)` — shared-type plus direct call-edge into the run.

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

## `ovl_11` farm-object clear/update run — 0x801212C4–0x80121500 (confidence: medium)

Candidate same-TU family of `ovl_11` (`Obj\GF_FARM.bin`) around the
farm-object update/clear code at the overlay's tail. Evidence is an internal
call graph plus strict link-order adjacency plus a shared field-14 clear idiom;
same-TU membership is plausible but unproven (no shared gp-rel cluster or
register quirk observed yet).

Fingerprints:
- address adjacency: `ovl_11_func_801212C4` (0x54 bytes, exactly
  0x801212C4–0x80121318) is the run head and abuts `ovl_11_func_80121318`
  (0x44 bytes, ends 0x8012135C), which sits immediately before
  `ovl_11_func_8012135C` and `ovl_11_func_801213D8`
  (0x120 bytes, exactly 0x801213D8–0x801214F8), which is followed directly
  by `ovl_11_func_801214F8` (0x801214F8–0x80121500) — the whole run
  0x801212C4–0x80121500 is contiguous with no unrelated code between;
- internal call graph: the leaf `ovl_11_func_801214F8` is called by both of
  its neighbours — `ovl_11_func_80121318` (a `for` loop stepping a
  `D_8012DB90` 0x18-byte-stride struct array 0x18 times, calling it per
  entry) and `ovl_11_func_801213D8` (the farm-object update routine, which
  calls it on the `.L801214DC` no-spawn reset path to drop the entry's
  live pointer). The run head `ovl_11_func_801212C4` calls
  `ovl_11_func_801213D8` over the same `D_8012DB90` array (0x18-byte stride,
  countdown 0x18), so 801213D8 has callers on both sides of it in the run;
- shared struct + clear idiom: all four operate on the same 0x18-byte
  farm-object struct with a pointer field at +0x14; `ovl_11_func_801214F8` is
  the field-14 clear (single `sw $zero, 0x14(a0)`, leaf), the reset every
  caller uses to blank an entry.

Members (address order):
- ovl_11_func_801212C4 (m, matched this session) — guarded farm-array pass:
  while `!(D_8006C848 & 0x400)`, walk the `D_8012DB90` array at 0x18 stride
  (countdown 0x18) and call the update routine `ovl_11_func_801213D8` on
  each entry; typed with the same local `Struct_801213D8` view as 801213D8
- ovl_11_func_80121318 (m, matched this session) — clears the whole
  `D_8012DB90` farm array of 0x18-byte-stride entries by stepping a
  countdown from 0x18 and calling ovl_11_func_801214F8 on each entry
- ovl_11_func_8012135C (s) — role unknown; sits in the run between 80121318
  and 801213D8
- ovl_11_func_801213D8 (m, matched 2026-10-08) — farm-object update: while
  the sprite at +0x14 is set, frame = tick (+0x2) / 3. The tick advances
  unless bit 0x08000000 of `D_8006C844` is set. While the frame is below
  func_80015A18's animation length, the offset position (+0x4/+0x8/+0xC) is
  projected by ovl_11_func_800F5888 and the frame is drawn by func_80015EE8.
  Otherwise it calls ovl_11_func_801214F8 (field-14 clear). The record is
  typed locally as `Struct_801213D8`; 80121318 still walks the same array
  with byte arithmetic.
- ovl_11_func_801214F8 (m, matched 2026-11 — this session) — leaf field-14
  clear: `sw $zero, 0x14(a0)`; byte-exact clean C, baseline flags (no
  override)
- ovl_11_func_80121500 (s) — immediate link-order follower, next candidate
  member

---

## `ovl_11` 0x80106DC0 struct-reset leaf run — 0x80106DC0–0x80107043 (confidence: medium)

A 0x28-byte struct-reset leaf at the head of a contiguous five-function run
(0x80106DC0, size 40, ends 0x80106DE8; 0x80106DE8, size 80, ends 0x80106E38;
0x80106E38, size 120, ends 0x80106EB0; 0x80106EB0, size 0x70, ends 0x80106F20;
0x80106F20, size 0x124, ends 0x80107044 — zero gaps). Call graph and link order
agree: both immediate successors call the leaf. Same leaf-reset fingerprint as
the farm-object clear/update run (leaf 0x801214F8 called by both its
neighbours).
Members:
- ovl_11_func_80106DC0 (m, matched this session) — resets an 0x18-byte struct:
  zeroes f0/f4/fC/fE/f10 (s16) and f8/f14 (s32), sets f2 to 4; called by both
  successors
- ovl_11_func_80106DE8 (m, matched this session) — first of the two immediate
  successors: walks the 0x18-stride `D_8012CF48` table (10 entries, same table
  indexed by ovl_11_func_8010734C) calling the reset leaf on each, then calls
  ovl_11_func_800E54C8; confirms the documented caller edge
- ovl_11_func_80106E38 (m, matched this session) — second immediate successor:
  scans the same 0x18-stride `D_8012CF48` table for the first entry with
  `f0 == 0`, resets it via the leaf, then sets f0=1, f14=arg0, f2=arg0->unk8;
  the third zero-gap member of the run
- ovl_11_func_80106EB0 (m) — fourth zero-gap member: 0x2C-stride walk of 50
  entries calling ovl_11_func_80106E38 on each whose s16@+0x1A != 0x63; its
  call edge plus gapless link adjacency place it in this run
- ovl_11_func_80106F20 (m, matched this session) — fifth zero-gap member: scans
  the same 0x18-stride `D_8012CF48` table for the entry whose f14->fA == arg0,
  then switches on entry f0 (1/2/3/4) to set f0=1 or f0=2 with f2=arg1, or add 5
  to f4; shares the `D_8012CF48` table with 80106DE8/80106E38/8010734C, and its
  gapless adjacency extends the run to 0x80107044

---

## `ovl_11` `D_801290D8` 0x34-stride entry-table init/accessor cluster — 0x800DCE98, 0x800DCECC, 0x800DCF10 (confidence: low)

Leaf `ovl_11_func_800DCE98` (matched this session, 0x34, byte-exact) is the
table's entry-init leaf: `memset(arg0, 0, 0x34)` then `u16@+0x2C = 0x8000`
(free-entry bit). Both of its callers are its gapless link successors
(0x800DCE98+0x34 = 0x800DCECC, 0x800DCECC+0x44 = 0x800DCF10) and both walk the
same shared table global `D_801290D8`: 0x800DCECC calls the leaf 3 times
stepping +0x34; 0x800DCF10 reads `lhu`@+0x2C, tests bit 0x8000, re-inits via
the leaf, then AND-clears the bit (`andi 0x7FFF`, `sh`@+0x2C). Shared global
plus call edges plus link order agree. Members:
- ovl_11_func_800DCE98 (m, matched this session) — entry-init leaf (see the
  memset-clear idiom family above)
- ovl_11_func_800DCECC (s) — bulk re-init: calls the leaf over entries 0–2 of
  `D_801290D8` (+0x34 stride)
- ovl_11_func_800DCF10 (m, matched this session) — per-entry accessor:
  claims/refreshes entries by the @+0x2C free bit and initialises entry fields
  through `func_8001BFA8`; shares the same 3×0x34 walk and 0x8000 free bit

---

## `ovl_11` `D_80128E08` 0x30-stride entry-table walk — 0x800DC990 / 0x800DCA10 (confidence: low)

Bulk walk `ovl_11_func_800DC990` (matched this session, byte-exact) walks the
shared table global `D_80128E08` 15 times (count-down `i = 0xE .. 0`, `bgez`)
at +0x30 stride, calling `ovl_11_func_800DCA10` on each entry with the entry
pointer in `$a0`. Structurally the third twin of the two 0x34-stride clusters
(same `p = <table>; for i { call(p); p += stride; }` author idiom), but a
distinct global, stride and callee. Members:
- ovl_11_func_800DC990 (m, matched this session) — bulk walk over entries
  0–14 of `D_80128E08` (+0x30 stride)
- ovl_11_func_800DCA10 (s) — per-entry callee at 0x800DCA10, +0x80 after the
  walker; role unknown

---

## `ovl_11` `D_80128BB0` 0x34-stride init run — 0x800CBEF8 / 0x800CBF40 / 0x800CBF70 (confidence: medium)

Bulk initialiser `ovl_11_func_800CBEF8` (matched this session) walks the
shared global `D_80128BB0` three times at +0x34 stride, calling the field-clear
leaf `ovl_11_func_800CBF40` on each entry; `800CBF40` and `800CBF70` are its
gapless link successors (0x800CBEF8+0x48 = 0x800CBF40, +0x30 = 0x800CBF70), and
the same global is read again by `800CBF70` and by `800CCB90` (absolute
`lui`+`%lo`, non-GP). Shared global + call edge + link adjacency; the
`D_801290D8` cluster above is the structural twin (same 3×0x34 walk, different
table). Members:
- ovl_11_func_800CBEF8 (m, matched this session) — bulk init: `p = D_80128BB0;
  for i < 3 { clear(p); p += 0x34; }`, baseline flags
- ovl_11_func_800CBF40 (m) — field-clear leaf: zeroes eleven s16/s32 fields of
  the +0x34-stride entry
- ovl_11_func_800CBF70 (s) — reads `D_80128BB0`; role unknown
- ovl_11_func_800CCB90 (s) — reads `D_80128BB0`; role unknown

---

## `ovl_11` memset-clear struct-constructor idiom family — 0x800C1C5C, 0x800D3200, 0x800DF0F8, 0x800E0D0C, 0x800E2904, 0x8010B64C, 0x801092E0, 0x8010946C (confidence: low)

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
- ovl_11_func_8010946C (m, matched this session, byte-exact) — guarded 0xF0
  far-state initializer variant (same family/band idiom as 8010B778): returns
  -1 when u16@+0x00 != 0, else saves s32@+0x4/+0x8/+0xC/+0x10 and u16@+0x14
  across the memset and restores them, copies the packed 8 bytes at
  D_8006C838+0x44B8 to +0x1A, then calls ovl_11_func_80109310(this) and
  ovl_11_func_80107DD0(this+0xA8); caller ovl_11_func_80108CD0. Membership is
  idiom-based (shared packed-copy / 80107DD0 call cluster), not a TU claim
- ovl_11_func_800DCE98 (m, matched this session) — variant member over 0x34
  bytes: memset 0x34 then stores the free-entry bit as `u16`@+0x2C = 0x8000
  (`ori`, not a +0 s16 store); see the `D_801290D8` entry-table cluster above

---

## `ovl_11` D_800A0494 9-`s16`-row table cluster — 0x800D6628 / 0x800D666C / 0x800D6730 / 0x800D6F78 / 0x800F0A58 (confidence: medium)

Evidence: one shared data object, D_800A0494, addressed by five functions in
this container and by no others in any extracted bytes, with a consistent
structure across all five: a table of rows 0x12 bytes = 9 `s16` entries (32
rows total — 0x24 = 2 rows zeroed then 0x21C = 30 rows set to 0xFF by the
initializer). Row-walk structure is the common fingerprint, stronger than the
global alone, since the ordinary extern global is container-wide visible. Link
order ties four members (800D6628, 800D666C, 800D6730, 800D6F78) inside
0x800D66xx–0x800D70xx; 800F0A58 is far away, so adjacency is not claimed.
800D666C reaches the table through the far-buffer base (`D_8007AFF0`+0x254A4,
the same address as D_800A0494) rather than the symbol, and is the immediate
link successor of 800D6628 (0x44 bytes, ending exactly at 0x800D666C).
Members:
- ovl_11_func_800D6628 (m, matched this session) — table initializer:
  `memset(&D_800A0494, 0, 0x24); memset((char *)D_800A0494 + 0x24, 0xFF,
  0x21C);` — zero the first 2 rows, 0xFF the remaining 30
- ovl_11_func_800D6730 (m) — find-first-zero: `p = D_800A0494 + row * 9;`
  scans 9 `s16`, stores `value` at the first zero, returns its index or -1
- ovl_11_func_800D666C (m) — clear-record: `p = far_base + 0x254A4 + row*9`
  (far-buffer view of the row) scans the same 9 `s16`, and on a match zeroes
  the slot and `memset`s the paired 0x1E-byte record in the D_800A04B8 view
  0x24 above the row base; row index comes from ovl_11_func_800D5750
- ovl_11_func_800D6F78 (s) — dual-row scan: walks `i < 9` comparing
  `base + 2i` against `base + 0x12 + 2i` (adjacent rows), returns 0/1/-1
- ovl_11_func_800F0A58 (s) — scans the 9-`s16` row at `base` (second cursor
  `base + 0x12`) for a matching `s16`, returns the found index or -1

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
  stepping a coordinate by -8, calling `func_800245F4` per step);
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
- ovl_11_func_801170E4 (m, matched 2026-11 — this session) — rows/cells
  draw loop: for count from arg0, calls func_800245F4 per cell while
  stepping a coordinate by -8; called by the head right after the
  func_801170D8 field read; byte-exact clean C, baseline flags

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

## `ovl_11` CD asset-load init run — 0x800BD538–0x800BDA70 (confidence: medium)

Candidate same-TU run of `ovl_11` (`Obj\GF_FARM.bin`) sharing the asset-load
idiom `func_80014BCC(0, <ROM addr>, <size>, 0, D_8005E3B0+0x4290)` — the
engine CD-read retry driver loading a retail asset into the shared
`D_8005E3B0+0x4290` scratch buffer — and the adjacent main-RAM destination
globals `D_8007BFF8` / `D_801287F8` / `D_80128800`. `D_801287F8`
(globals_override.h) is the overlay pointer slot written by
`ovl_11_func_800BD938` this session.

Fingerprints:
- zero-gap link-order contiguity (map): 0x800BD538 (0x68) → 800BD5A0 (0x8)
  → 800BD5A8 (0xC0) → 800BD668 (0x40) → 800BD6A8 (0x234) → 800BD8DC (0x5C)
  → 800BD938 (0x9C) → 800BD9D4 (0x4C) → 800BDA20 (0x50) → 800BDA70
  (0x118), each starting exactly where the previous ends, one unbroken span
  with no unrelated code between;
- shared loader idiom: 800BD538/800BD668/800BD938/800BDA20 all call
  `func_80014BCC(0, <ROM addr>, <size>, 0, D_8005E3B0+0x4290)`; 800BD5A8
  (matched this session) calls it too, with the range taken from the
  `D_801227CC[arg0]` word pair instead of an inline ROM address;
- adjacent destination globals: the run writes/reads the consecutive
  main-RAM slots D_8007BFF8 (800BD8DC/800BD9D4), D_801287F8 (800BD938) and
  D_80128800 (800BD8DC).

Members (address order):
- ovl_11_func_800BD538 (s) — reloads 0x0380B000/0x5000 into +0x4290, copies
  0x540 to D_8009A3F8, then `func_8001719C(D_8005E3B0+0x5790)`
- ovl_11_func_800BD5A0 (m) — empty body (single return)
- ovl_11_func_800BD5A8 (m, matched this session, byte-exact) — per-index
  loader (see its own entry)
- ovl_11_func_800BD668 (m) — bare load 0x74800/0xA800 into +0x4290
- ovl_11_func_800BD6A8 (s) — role unknown
- ovl_11_func_800BD8DC (m) — stores arg0 to D_80128800 and loads the
  arg0-derived ROM region 0x3800 into D_8007BFF8
- ovl_11_func_800BD938 (m, matched this session) — loads 0x03D57800/0x800
  into +0x4290, stores the pointer to D_801287F8, and expands three 0xC0-word
  chunks from `D_80070EC2` +0/+0x180/-0x180
- ovl_11_func_800BD9D4 (m) — loads the arg0-derived ROM region 0x1800 into
  D_8007BFF8
- ovl_11_func_800BDA20 (m) — loads 0x03D51000/0x6800 into +0x4290, then
  `func_8001719C(D_8005E3B0+0x4290)`
- ovl_11_func_800BDA70 (m, matched this session, byte-exact) — same loader
  wrapper pair as 800BDA20 (`func_80014BCC` then `func_8001719C`), but its
  source base is the render-context cluster: it selects
  `D_8005E5E8[0/1].+0x124` on the `D_8005E3C0 == D_8005E5E8` test, loads
  0x7F000/9 sectors into that base, `memcpy`s 0x770 bytes to `D_8009CBF8`,
  then `func_8001719C(base+0x770)`. Shares the wrapper pair and zero-gap
  adjacency; the differing source/destination cluster keeps run confidence
  at medium.

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

## `ovl_11` timer-gated D_8006C838 count-dispatch run — 0x800FE928 / 0x800FEA00 / 0x800FEB14 / 0x800FEB68 / 0x800FEBB0 (confidence: medium)

Evidence: a direct caller/callee run inside a 0x1B0-byte link-order window
(splat offsets 0x46B08 `ovl_11_func_800FE928` len 0xD8, 0x46BE0
`ovl_11_func_800FEA00` len 0xD4, 0x46CB4 `ovl_11_func_800FEAD4` len 0x40,
0x46CF4 `ovl_11_func_800FEB14` len 0x54, 0x46D48 `ovl_11_func_800FEB68`
len 0x48, 0x46D90 `ovl_11_func_800FEBB0`). `ovl_11_func_800FEA00` calls all
three followers directly, one per countdown stage of the u16 `D_8012720E`, and
`ovl_11_func_800FE928` is its increment-direction twin immediately preceding
it: same `D_8012720E` stage machine over 2/3/4 in the mirrored order, same
three stage helpers, same `(s16)`-cast access form. The three callees are one
family of count-over-array loops reaching main RAM through the two-stage
`D_8006C838` base (`+0x7AE8`/stride 0xB4 in FEB14; `+0x81BC`/stride 0xB8 in
FEB68/FEBB0, differing only in the subtraction threshold). `800FEAD4`,
between them, is a different family (D_80075854 scan) and is not a member.

Members:
- ovl_11_func_800FE928 (m) — increments `D_8012720E` through stages 2/3/4,
  calling that stage's count helper; wraps to 0 at 8. Increment twin of
  800FEA00.
- ovl_11_func_800FEA00 (m, matched this session) — decrements `D_8012720E`
  through stages 4/3/2, calling that stage's count helper; wraps to 7 below 0.
- ovl_11_func_800FEB14 (m) — `D_8006C838+0x7AE8` count, 10 cells, stride 0xB4.
- ovl_11_func_800FEB68 (m) — `D_8006C838+0x81BC` count, 20 cells, stride 0xB8.
- ovl_11_func_800FEBB0 (m) — same array as FEB68, adjacent threshold.

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
  (0x100) → 0x8010CE80 (0xD8) → 0x8010CF58 (0xF4) → 0x8010D04C (0xA0) →
  0x8010D0EC (0x120) → 0x8010D20C (0x44) → 0x8010D250 (0xC4) → 0x8010D314;
  8010D04C and 8010D250 are gapless members (their initializer/handler roles
  and the shared func_80012A34 / ovl_11_func_8010CE80 callees corroborate the
  link run).
- call graph: 8010CB6C and 8010CD80 both call 8010CE80; the `D_800BAABC`
  handler entries (8010EB24, 8010ECC0, 8010EEE4, 8010F324, 8010F4CC) call
  8010CE80 back — a dispatcher/handler coupling. The first ten `D_800BAABC`
  entries (indices 0–4, 7, 6, 5, 8, 9) sit in a *gapless* link-order block
  0x8010E2C4–0x8010ECC0 (symbol addresses plus nonmatching sizes sum exactly),
  so TU membership is plausible for that block though still unproven; the
  remaining handlers are interleaved with unrelated functions. The head entry
  `ovl_11_func_8010E2C4` (`D_800BAABC[0]`, matched this session, byte-exact) is
also the thirty-ninth member of the keyframe-state handler family documented
below, tying the table's head to that idiom/table cluster.

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
- ovl_11_func_8010D04C (m, matched this session, byte-exact) — object
  initializer: memsets 0xF8, packs u16@+0x16=0x32 / s16@+0x30=1 / flag
  `s32@+0x34 |= 0x3C000000`, stores `func_80012A34(0x12C)` at s16@+0x2C and
  0xFFFF at u16@+0x4/+0xBA, copies the packed 8-byte word at
  `D_8006C838+0x44B8` to +0x1A (same smem idiom as ovl_11_func_80112904 /
  ovl_11_func_800E2968), then `ovl_11_func_80107DD0(this+0xA8)`; repeats the
  `{u16@+0x16, s16@+0x30, s32@+0x34}` far-state object layout and the
  `80107DD0/DE0(this+0xA8)` call idiom of the far-state gate bands, and its
  caller ovl_11_func_8010C6A0 also calls ovl_11_func_80110E34.
- ovl_11_func_8010D250 (m, matched this session, byte-exact) — gapless run
  continuation: handler-selection helper sharing the run's object layout
  (`s16@+0x26/+0x28/+0x2A/+0x2C/+0x30`) and both run callees — it takes `s1`
  from `D_80127CEC[func_80012A34(4)]` when `s16@+0x30 != 0x28` and
  `s16@+0x26 != 0xF`, promotes the staged `s16@+0xBE/0xC0/0xC2` triple into
  `+0x26/+0x28/+0x2A` when `s16@+0xBE != 0`, else calls
  `ovl_11_func_8010CE80(this, s1)`; called by run member 8010CD80.
- ovl_11_func_8010E434 (m, matched this session, byte-exact) — `D_800BAABC[2]`
  handler inside the gapless block: two-state update of the shared s16@+0x28
  field (state 0 → 1 sets flag 0x800 in s32@+0x34; state -1 clears it) and
  otherwise calls `ovl_11_func_800D04D4(this, D_80127D5C, &this->+0x28, -1,
  &s16@+0x2A)` to advance the +0x2A counter; same sparse-switch
  `case 1: default:` decision tree, object view and 800D04D4 call as the
  gapless-run sibling ovl_11_func_800D4624 (different handler table).

---

## `ovl_11` D_800BAA84 handler run — 0x8010DA04–0x8010DE68 (confidence: medium-low)

Evidence: the three `D_800BAA84` function-pointer table entries named in the
object-mode dispatch run above (`8010DD38`/`8010DA04`/`8010DDC8`) are gapless in
link order and the band closes with `8010DE68`: 0x8010DA04 (0x334) → 0x8010DD38
(0x90) → 0x8010DDC8 (0xA0) → 0x8010DE68 (0x45C), each starting exactly where the
previous ends. Gapless link order shared by vtable siblings is same-TU evidence.
`8010DD38` also repeats the `{u16@+0x16, s16@+0x30, s32@+0x34}` object layout and
the `ovl_11_func_80107DE0(this + 0xA8, ...)` call idiom of the far-state gate
bands, but sits ~0x1FD0 bytes past them, so the link run — not the shared idiom —
is the TU signal claimed here.
Members (link order):
- ovl_11_func_8010DA04 (s, 0x334) — `D_800BAA84` handler; bytes not yet recovered.
- ovl_11_func_8010DD38 (m, matched this session, byte-exact) — `D_800BAA84`
  handler: `u16@+0x16 -= 3` clamped to [0, 0xFF], clears 0x800 of `s32@+0x34`,
  then `ovl_11_func_80107DE0(this + 0xA8, 0x24, 0x1E)`; returns -1 when
  `s16@+0x30 == 0x28`.
- ovl_11_func_8010DDC8 (m, matched this session, byte-exact) — `D_800BAA84`
  handler: bobs the `D_8006C838+0x5200` u16 by ±2 into `u16@+0x22`, queues
  `func_8002261C(0, D_80127D04[u16@+0xAC])`, clears bit 0x400 of the
  `D_8006C838+0x5234` flag word, returns -1.
- ovl_11_func_8010DE68 (s, 0x45C) — gapless tail; only marks the band boundary.

---

## `ovl_11` 0x801075C0 gapless run (button/state guards) — 0x801075C0–0x80107B54 (confidence: medium)

Gapless link-order run 0x801075C0 (0x44) → 0x80107604 (0x158) → 0x8010775C
(0xB0) → 0x8010780C (0x7C) → 0x80107888 (0x2CC = 716), each starting exactly
where the previous ends and the last ending exactly at 0x80107B54, the head of
the documented keyed-table lookup run below (so the two entries are one
contiguous band). Call graph and link order agree: the shared caller
ovl_11_func_80107528 calls four of the five members, and the sole caller of
ovl_11_func_8010780C is its zero-gap successor ovl_11_func_80107888. Both
0x8010780C and 0x80107888 call `func_8001AF44` and touch the same main-binary
`D_8006C838` +0x44BA/+0x44BC state s16 pair (`D_80070CF2`/`D_80070CF4`).
Members (address order):
- ovl_11_func_801075C0 (s) — shared caller's first callee, gapless run head
- ovl_11_func_80107604 (s) — second gapless member
- ovl_11_func_8010775C (m, matched this session) — third gapless member;
  9-case jump-table dispatch on arg0 (0–8) selecting an (a0, a1) pair, then
  tail-calls the 0x80107B54 lookup leaf; default returns 0
- ovl_11_func_8010780C (m, matched this session) — state guard leaf: reads the
  +0x44BA/+0x44BC s16 pair (D_80070CF2 == 3 && D_80070CF4 == 0x17) through
  the shared `base = (char *)&D_8006C838` idiom, then gates two
  `func_8001AF44` flag tests (0x1B, and `(arg0 + 0x21) & 0xFFFF`); returns 0
  or 1. Carries the CAPTURE_PREV_RET dead-$v0 fossil (same family as the
  documented v0-channel ovl_11 leaves 800D1CD0/800D0600/800D12A0 and
  800DD45C; see notes/research/func_8001EAE4-v0-channel-delay-slot-fossil.md)
- ovl_11_func_80107888 (s) — sole caller of 0x8010780C and its zero-gap
  successor; run tail, ends at 0x80107B54; also calls `func_8001AF44`

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
- ovl_11_func_80107B84 (m, matched this session) — calls
  `ovl_11_func_80107BE4` (passes arg0 through, uses its result) and
  `ovl_11_func_800C1224`; reads the `D_8006C838` buffer at +0x44BA/+0x44BC
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
  `D_8012D084` (ovl_11_func_8010AE64) and `D_8012D080`
  (ovl_11_func_80109E04, an absolute-`lui`+`%lo` pointer);
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
- ovl_11_func_80108470 (m) — guarded setter of D_8012D050[2]'s s16
  value/state pair (+8/+A), returning whether it wrote; shares those fields
  with ovl_11_func_801084E0/8010876C (shared-global evidence: original
  `build/ovl_11/asm/nonmatchings/ovl_11_func_80108470/ovl_11_func_80108470.s`),
  and is called by its gapless predecessor ovl_11_func_801082F8 (call graph
  and link-order evidence).
- ovl_11_func_80108B8C (m) — reads the same D_8012D050[2] pair (+8/+A):
  when field_2 is 2 and field_0-600 is in 0..8, promotes the corresponding
  D_8006C838+E7A2 byte cell from 1 to 2. This links the buffer cluster to
  the separately documented E7A2 state-handler run by shared storage, not
  adjacency; byte-exact indexed-member C under baseline flags.
- ovl_11_func_8010860C (m, matched this session) — mode-decode probe over
  `((GfxObj *)D_8005E3A8)->field_8 & 0xF020`: mode 0 returns, mode 0x20 sets
  D_8012D044 = 6 and calls func_80022738, modes 0x1000/0x8000/0x2000/0x4000
  select 0/2/1/3, any other value reuses D_8012D040, then a changed value
  writes D_8012D040, calls func_80022738 and sets D_8012D044 = 2; shares the
  D_8012D040/D_8012D044 cluster pair and the func_80022738 caller with the
  run, and sits gaplessly immediately before its mode-idiom sibling
  ovl_11_func_801086CC (same `field_8 & 0xF020` decode and D_8012D040
  writer); byte-exact clean C, baseline flags
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
- ovl_11_func_80108828 (m, this session) — leaf probe indexing the same
  D_8012D050 buffer with the cluster counter D_8012D040 and passing
  `D_8012D050[D_8012D040].field_0` (+0 s16) to func_8002261C(3, ...); the
  cluster's only site tying the D_8012D040 state global to the D_8012D050
  buffer base (as a runtime index, not an address-taken base), and a second
  func_8002261C(3, ...) caller alongside ovl_11_func_80108738; byte-exact
  clean C, baseline flags
- ovl_11_func_80108864 (m, this session) — leaf state-probe writing four s16
  fields (0/2/4/6) of D_8012D060 based on a value loaded through the
  D_8007AFF0+0x25388 pointer chain; shares the D_8012D060 global with
  ovl_11_func_80108930; byte-exact clean C
- ovl_11_func_801088E4 (m, this session) — leaf clear/call: writes
  D_8012D068 = 0 and D_8012D06C = -1, then calls ovl_11_func_800BD9D4 with
  `D_8012D050[D_8012D040].field_2` (+2 s16); a second writer of the
  D_8012D068/D_8012D06C pair alongside ovl_11_func_80108930 and the run's
  second D_8012D040-indexed D_8012D050 reader alongside ovl_11_func_80108828;
  called by the run's shared caller ovl_11_func_80107F58; byte-exact clean C
- ovl_11_func_80108930 (m, this session) — leaf state-probe/sequencer: derives a
  block index from the D_8012D068 counter (signed `>>4` minus `(D_8012D068/48)*3`),
  stores it to D_8012D06C when it differs, then calls func_80017200 with
  `D_8007BFF8 + (index << 0xB)` and the four s16 fields of D_8012D060, and
  increments D_8012D068; the D_8012D068/D_8012D06C pair's second site alongside
  writer/resetter ovl_11_func_801088E4 and the D_8012D060 reader alongside
  ovl_11_func_80108864/ovl_11_func_801089DC; byte-exact clean C, baseline flags
- ovl_11_func_80109E04 (m, this session) — guard/probe leaf: returns -1 unless
  the u16 at arg0+0 is nonzero and the cluster pointer D_8012D080 is set,
  otherwise forwards arg0 plus D_8012D080's +0x38/+0x3C/+0x40/+0x44 words to
  ovl_11_func_800D05D0 and returns 0; only confirmed reader of D_8012D080;
  byte-exact clean C, baseline flags

---

## `ovl_11` far-state gate run — 0x80109A70–0x80109C24 (confidence: medium)

Gapless link-order run 0x80109A70 (0x118) → 0x80109B88 (0x9C) →
0x80109C24 (0xE4), each starting exactly where the previous ends, and
corroborated by a shared call/data fingerprint (link order and call graph
agree): every member reads the far-state halfword
`*(s16 *)((char *)&D_8007AFF0 + 0x25476)` and calls `func_8001FABC`. The run
head also calls `ovl_11_func_800D05D0`, the callee the D_8012D0xx state-probe
run's members 0x80109D08/0x80109E04 share, so the gapless chain bridges into
that documented cluster. Members (address order):
- ovl_11_func_80109A70 (s) — run head; two far-state reads; calls
  func_80012A34/ovl_11_func_800C1224/ovl_11_func_80109188
- ovl_11_func_80109B88 (m, matched this session) — far-state gate: returns -1
  when u16@+0==0, calls func_8001FABC(0x1A) when `D_8007AFF0+0x25476` equals
  s16@+0x30, decrements u16@+0x16 by 10 clamped at 0, then
  ovl_11_func_80107DE0(this+0xA8, 0x1F, 0x1E); byte-exact clean C, baseline
  flags
- ovl_11_func_80109C24 (s) — run tail; one far-state read; calls
  ovl_11_func_80109974 and func_8001FABC

---

## `ovl_11` 0x582F8 far-state/reset band — 0x80110118 → 0x80110E28 (confidence: medium-low)

Same-TU candidate band of `ovl_11` (`Obj\GF_FARM.bin`): matched
`ovl_11_func_80110118` sits at the head of the unbroken link run that opens at
0x582F8 and continues through 0x80110188 / 0x8011031C / 0x801103E8 /
0x80110494 / 0x80110520 / 0x80110544 / 0x801105C8 / 0x80110658 / 0x80110790 /
0x80110838 / 0x80110890 / 0x801108F8 / 0x80110944 / 0x80110CE8 /
0x80110DA0 / 0x80110E28 / 0x80110E34, and it ties that run to two documented
idioms at once:
- the far-state halfword gate `*(s16 *)((char *)&D_8007AFF0 + 0x25476) ==
  s16@+0x30` built through the `char *far_base` two-stage split — the same
  spelling as the far-state gate run's `ovl_11_func_80109B88`; the run also
  contains the documented far-state reader `ovl_11_func_80110494`, so the two
  accessor families sit inside one link run;
- the object reset view {u16@+0xB6, s32@+0xDC} cleared to 0, shared with
  matched `ovl_11_func_80110E28` (0x59008) in the same run.
Members:
- ovl_11_func_80110118 (m, this session) — far-state reset leaf: forwards
  u16@+0xB6 to ovl_11_func_800F3BCC, calls func_8001FABC(0x13) /
  func_8001AF70(7, 1) when the far-state halfword equals s16@+0x30, then clears
  u16@+0xB6 and s32@+0xDC and returns 1; byte-exact clean C, baseline flags
- ovl_11_func_801103E8 (m, matched this session) — run member immediately
  before the state-key probe run head: its end 0x801103E8+0xAC = 0x80110494 is
  the zero-gap start of `ovl_11_func_80110494`; reads the
  {u16@+0x22, s32@+0x38/0x3C/0x40} record shape (the view the index/5
  table-copy record trio above records for `ovl_11_func_80110E34`, the band's
  tail), selecting the `ovl_11_func_800D7EF8` / `ovl_11_func_8011E090` handler
  by arg1, feeding the record's +0x38/+0x40 components through the
  `ovl_11_func_800D0408(u16@+0x22, ...)` component writer, then dispatching
  through the selected handler and `ovl_11_func_800D8320`

---

## `ovl_11` 0x8010B64C gapless run (0xF0 far-state initializer band) — 0x8010B64C–0x8010B898 (confidence: medium-low)

Candidate same-TU family of `ovl_11` (`Obj\GF_FARM.bin`). Evidence:
- zero-gap link-order contiguity (original ovl_11 functions.csv): 0x8010B64C
  (0x30) → 0x8010B67C (0xFC) → 0x8010B778 (0xB8) → 0x8010B830 (0x68) →
  0x8010B898 (0x44), each starting exactly where the previous ends; the
  gapless region continues through 0x8010B8DC/0x8010B994;
- caller/callee adjacency: 0x8010B778 calls `ovl_11_func_8010B830`, its
  immediate zero-gap successor (link order and the call graph agree); 0x8010B830
  is also called by 0x8010B264 outside the band;
- shared idiom cluster: 0x8010B64C is a 0xF0 memset-clear constructor (member
  of the memset-clear idiom family above) and 0x8010B778 repeats the far-state
  object layout {u16@+0x00, u16@+0x16, s16@+0x30} with the 0xFFFF@+0x4 fill
  and the `ovl_11_func_80107DD0(this+0xA8)` call idiom of the far-state gate
  run above and the object-mode dispatch run.
Members (link order):
- ovl_11_func_8010B64C (m) — 0xF0 memset-clear constructor (see the
  memset-clear idiom family entry; sole caller 0x800E8760)
- ovl_11_func_8010B67C (s, 0xFC) — calls 0x800BD238 / func_80015704 /
  func_80015868; no witnessed shared data with the band, listed only to mark
  the gapless chain
- ovl_11_func_8010B778 (m, matched this session, byte-exact) — guarded 0xF0
  far-state object initializer: returns -1 when u16@+0x00 != 0, else memsets
  0xF0, fills u16@+0x00 = arg1, u16@+0x04 = 0xFFFF, s16@+0x16 = 0xA,
  s16@+0x30 = 3, s32@+0x38 = 0x1CC, s32@+0x3C = 0, s32@+0x40 = 0x258, copies
  the packed 8 bytes at D_8006C838+0x44B8 to +0x1A, then
  ovl_11_func_8010B830(this) and ovl_11_func_80107DD0(this+0xA8), returns 0
- ovl_11_func_8010B830 (s, 0x68) — immediate zero-gap successor of 0x8010B778
  and its callee; also called by 0x8010B264 outside the band
- ovl_11_func_8010B898 (s, 0x44) — gapless tail; no witnessed shared data
  (marks the band boundary)

---

## `ovl_11` D_800BA9E4 / D_800BAA34 dual-table dispatcher — 0x8010B57C (confidence: medium)

Candidate same-TU family of `ovl_11` (`Obj\GF_FARM.bin`). Evidence:
- call-graph adjacency inside the recorded 0x8010B64C gapless chain: two of its
  zero-gap members call this dispatcher — `ovl_11_func_8010B8DC` (once) and
  `ovl_11_func_8010B994` (twice, alongside `func_80012A34` and
  `ovl_11_func_800D12A0`).
- zero-gap link order (original ovl_11 functions.csv): 0x8010B57C (0xD0) ends
  exactly where the recorded 0x8010B64C run head begins, so the chain extends
  one function earlier; the chain then stays zero-gap through 0x8010B8DC and
  0x8010B994 into the third far-state gate run's head 0x8010BA84.
- shared data-table cluster: the dispatcher's two parallel rodata tables,
  `D_800BA9E4` (function pointers) and `D_800BAA34` (presence flags), sit
  adjacent in `2A28.rodata.s`, and the `D_800BA9E4` entries are the members of
  the recorded third far-state gate run (0x8010BA84–0x8010BCE8) plus
  `ovl_11_func_8010B994` — the same dispatcher/handler coupling class used for
  the D_800BAA84 / D_800BAABC object-mode dispatch run.

- ovl_11_func_8010B57C (m, matched this session, byte-exact) — dual-table
  dispatcher: when `s32@+0x34 & 0x400` is clear, calls the `s32 (*)(u16 *)`
  handler at `D_800BA9E4[arg1]` (arg1 forced to 0x11 when `+0x34 & 0x01000000`),
  then if `D_800BAA34[arg1]` is set and the result is not -1, records the
  selection at s16@+0x26 and clears s16@+0x28/+0x2A/+0x2C before
  `ovl_11_func_800D0408(4, this+0x24, 0)`; returns -1 when `+0x34 & 0x400`.

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
- middle s32 globals `D_80128B54` / `D_80128B58` (main RAM 0x80128B54 /
  0x80128B58, between `D_80128B50` and `D_80128B5C`): B58 written by
  `ovl_11_func_800C0D9C` (from `$a0`, a 1-arg init pair with B50 in one
  0x18 leaf); B54 and B58 both cleared by `ovl_11_func_800C09D0`, whose
  0xC8-byte `memset(&D_80128A88, -1, ...)` stops exactly at B50 — the
  B50/B54/B58/B5C run sits in 16 consecutive bytes of one data run, and
  09D0's single reset of the `D_80128A88` array plus that run ties the two
  clusters to one TU;
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
- ovl_11_func_800C087C (m, matched this session) — clears `D_80128B5C`, then
  offsets an index by the `D_8006C838` s16 fields 0x44C0/0x44C2 (`*0x3C`
  stride) and calls `ovl_11_func_800C0D9C`; byte-exact clean C, baseline flags
- ovl_11_func_800C08E8 (s) — leaf clear: `D_80128B5C = 0`
- ovl_11_func_800C090C (s) — leaf clear: `D_80128B50 = 0`
- ovl_11_func_800C09D0 (m, matched this session) — input-state reset:
  `memset(&D_80128A88, -1, 0xC8)`, then clears `D_80128B50/B54/B58` and
  `D_8006C838` fields 0xD0/0xD4; the run's `D_80128A88`↔B5x bridge; byte-exact
  clean C, baseline flags
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
- **third reader**: 800C141C (matched this session) loads `&D_80122F0C`
  (`lui %hi`+`addiu %lo`) as the base of an `lh` that reads entry field @4 of
  the `D_80122F0C[ret-1]` record; the same `{s16,s16,s16}` stride-6 view as the
  two leaves.

Members (address order):
- ovl_11_func_800C1224 (m, matched this session) — leaf lookup: returns
  index+1 of the `D_80122F0C[i]` entry whose s16@0 == arg0 and s16@2 ==
  arg1, else 0
- ovl_11_func_800C1280 (m, matched this session) — twin leaf lookup over 18
  entries (`sltiu 0x12`), byte-exact
- ovl_11_func_800C12DC (s) — no D_80122F0C reference; sits in the run
- ovl_11_func_800C141C (m, matched this session) — range-gated reader: calls
  `ovl_11_func_800C1224` on the shared `+0x44BA/+0x44BC` s16 pair, then returns
  field @4 of `D_80122F0C[ret-1]` when it is not -1

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
- ovl_11_func_800DDA60 (m, matched this session) — cell B middle (0xEC):
  mirror of 800DD904; byte-exact clean C, baseline flags; reads D_8012919C and
  D_801291A0, writes/clears D_801291A0, and witnesses the shared D_80128E08
  entry's +0x12 field as s16 (the A-cell middle's mirror field is +0x14)
- ovl_11_func_800DDB4C (m, matched this session) — cell B tail probe: leaf
  `return D_801291A0 == 2;`

---

## `ovl_11` D_801291A8 pointer-pair run — 0x800DDC64 / 0x800DDD18 (confidence: medium)

Candidate same-TU family of `ovl_11` (`Obj\GF_FARM.bin`): two gapless
neighbours operating on the same two-pointer file-scope global.

Fingerprints:
- **shared global `D_801291A8`** (main RAM 0x801291A8, two 4-byte pointer
  slots at +0/+4 viewed as `u32[2]`, absolute `lui`+`%lo`, `-G0` no gp-rel):
  written by `ovl_11_func_800DDC64` (clears both slots, then fills them from
  the shared 0x30-stride `D_80128E08` table indexed by bit 0 of an entry's
  0x28 halfword) and read/bit-modified by `ovl_11_func_800DDD18` (clears bit
  0x1000 on one slot's entry +0x28, sets it on the other).
- **zero-gap link adjacency**: 0x800DDC64 (0xB4) ends exactly at 0x800DDD18
  (0x9C) — the map places them back to back with no unrelated code between.
- **data adjacency**: `D_801291A8` immediately follows `D_801291A0`, the high
  member of the D_80129194–D_801291A0 mirror-pair run above, so the pair is
  the next file-scope data object after that run's globals.

Members:
- ovl_11_func_800DDC64 (m) — pointer-pair setter: clears `D_801291A8` then
  stores up to two `D_80128E08` entries into the slot selected by entry bit
  0; stops after a qualifying bit-0 entry. The natural for-loop and reused
  flag variable are byte-exact with baseline flags. The compiler generates
  the apparent peeled/nested back-edge shape; it does not require nested
  source loops. A shared byte-storage declaration now reconciles the existing
  partial entry views (all six matched clients retain their exact bytes).
- ovl_11_func_800DDD18 (m, matched this session) — pointer-pair modifier: if
  `D_801291A8[0]` is nonzero, calls `func_8001AF44(0x72)` and, on `== 1`,
  clears bit 0x1000 on `D_801291A8[1]`'s 0x28 halfword and sets it on
  `D_801291A8[0]`'s (reversed when not 1); byte-exact clean C, baseline flags

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
  after `D_80127428`) also cleared by `ovl_11_func_801037EC` and read by
  trailer `ovl_11_func_801040A8` — the only two sites — the two are
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
- ovl_11_func_80103830 (m, matched this session) — calls
  ovl_11_func_801037EC, then sets `D_80127428 = 1` and calls func_8001FABC(3).
  Consumes the cluster's 0x8012CFxx data as the buffer producer: reads the
  +0xE514 select, copies six halfwords from the +0xE522 rows table into
  `D_8012CF10` (the inverse of 80103B24's copy), and loads `D_8012CF20` from
  +0x5224; the run's setter
- ovl_11_func_801038E4 (s) — leaf reader of D_80127428
- ovl_11_func_80103964 (s) — reads/writes D_80127428 at 8 sites; the run's
  mutator
- ovl_11_func_80103B24 (m) — leaf reader of D_80127428; updates the
  D_8006C838 work area and copies six D_8012CF10 halfwords. Its byte-exact
  source requires `-fno-cse-skip-blocks` to preserve distinct sign-guarded
  read-modify-write arms on the same field. Matched cluster members
  ovl_11_func_801037EC and ovl_11_func_80104394 remain byte-exact when
  compiled with that flag; no same-group flag contradiction was observed.
- ovl_11_func_801040A8 (m) — trailer reader of D_80127428 and D_8012742C
  (the sibling global's only other site); selects a 0xD6/0x22/0xC4 value from
  D_80127428 and passes `D_8005E3C0->field_D8 + 0x54` plus a D_8012742C-derived
  s16 offset to func_800248B0; the run's state-indexed dispatch

Widening (2026-09-14, byte-exact match of `ovl_11_func_80104394`): the run's
buffer consumer is now matched. `ovl_11_func_80104394` (m, 0x80104394, 0x84,
leaf) reads the exact `D_8012CF10[0..5]` window that member `ovl_11_func_801037EC`
clears, and both of its callers — `ovl_11_func_80103C00` (0x80103C00) and
`ovl_11_func_80103D44` (0x80103D44, two call sites) — are link-contiguous
members of this cluster's zero-gap span. `ovl_11_func_80104394` itself sits
address-apart (0x80104394, past the run trailer 0x801040A8) and touches none
of D_80127428/2C, so its TU membership with the cluster is supported by the
caller adjacency + shared 6-halfword buffer but unproven. Additional tie: the
matched `ovl_11_func_80103770` (m, 0x6C, gapless predecessor of the run head
0x801037DC) is this function's idiom twin — identical `+0xE514` select (default
2 when the halfword == 3) and `base + 0xE522 + sel * 0x54` table walk with 6
s16 at +0xE stride — summing (returns sum == 0) where 80104394 compares
(returns all-equal). Both now match with indexed member access rather than
precomputed pointer arithmetic. The sum consumer uses the same six-iteration
count-up loop over `rows[sel][i][0]`, with an unsigned selector after the
signed +0xE514 check (27/27 words, fully finalized). This corroborates the
shared large-offset table idiom without proving the original TU boundary.

Widening (2026-10-05, byte-exact match of `ovl_11_func_80103830`): the run's
setter is now matched, and it is a third, cleaner witness to the same
table-address idiom. It reads the +0xE514 select and copies six halfwords from
the +0xE522 rows table into `D_8012CF10` — the exact inverse of 80103B24's
D_8012CF10→rows copy — and reads `D_8012CF20` from +0x5224. Byte-exact only
when the large-offset address is spelled as indexed member access
(`v->rows[sel][cnt][0]`); a precomputed `char *` base plus pointer arithmetic
compiles the same semantics but emits the wrong `addu` grouping and order.

Widening (2026-09-15, byte-exact match of `ovl_11_func_801047FC`): the record
region's initializer is now matched. `ovl_11_func_801047FC` (m, 0x801047FC,
0x9C, void leaf) zero-gaps after finalized `ovl_11_func_8010476C` and is
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

Widening (finalized `ovl_11_func_8010476C`, 0x90): original 801044E4
also calls this immediately preceding initializer at 8010464C. It clears
three rows of six 14-byte records beginning at work-area +0xE516, directly
after the +0xE514 selector. Each first halfword becomes -1 and six others
become zero. Its second base, +0xE522, aliases the same record's final
halfword (+0xC); it is not a separate parallel table. The shared caller,
gapless 8010476C→801047FC link order and adjacent data boundary support
the existing initializer/consumer family, without proving its original TU.

Widening (byte-exact match of `ovl_11_func_800EF870`): the address-apart
single-record resetter (m, 0x4C, void leaf) independently indexes the same
`recs[arg0][0/1/2/4/5]` member array at +0xE4D8. It sets fields +0/+8/+A
to -1, as 801047FC does, and also clears +2/+4. The initializer's bound 5,
record stride 0xC and shared fields corroborate this data-region family.
The indexed-member spelling reproduces the target's two base copies
without assembly (19/19 words, fully finalized); TU co-membership remains
unproven from a shared global alone.

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

Widening (byte-exact match of `ovl_11_func_80103714`): the run's flag arm is
now matched. `ovl_11_func_80103714` (m, 0x80103714, 0x5C, void leaf) sits
zero-gap two slots before the run head — its immediate follower is matched
`ovl_11_func_80103770`, itself the run head's gapless predecessor — and shares
the cluster's two fingerprints: the D_8006C838 work area (`|= 0x40000` at
+0xC and `|= 0x2000` at +0x5234, the field 80103B24 updates) and the
`func_8001FABC(3)` call cluster setter 80103830 makes. Role: zeroes the
file-scope `D_801273E4` (new site in the 0x801273xx region) before setting
those work-area bits and running the hook + `func_800226F0`; TU membership
with the D_80127428 run itself remains unproven (touches neither D_80127428
nor D_8012742C). Declaration tie: byte-exact only when that shared
`func_8001FABC` call is left without a prototype (implicit int); the dead
`$v0` call def keeps `$v0` live and sends the second bit-set to `$v1`.

Widening (byte-exact match of `ovl_11_func_80103EB8`): the run's panel
emitter is now matched. `ovl_11_func_80103EB8` (m, 0x80103EB8, 0xD4, void)
sits zero-gap between `ovl_11_func_80103D44` (ends 0x80103EB8) and
`ovl_11_func_80103F8C` (begins 0x80103F8C), both inside the documented run
span, and `ovl_11_func_80103964` (m) — the run's mutator — calls it
unconditionally as its first action, then the zero-gap successor 80103F8C
and trailer 801040A8. It adds a new site in the cluster's `0x8012CFxx`
region: `D_8012CF30` (12-halfword scratch buffer, absolute `lui`/`%lo`),
filled by `func_8001A970` and passed to `func_80017B3C` — the same buffer
`ovl_11_func_80103F8C` uses — and reads `D_8012CF20`. It also materializes a
new exe table base `D_800517C6` indexed by `D_80054BBC[1]`. Role: draws the
panel through `func_80022580` + two `func_80017B3C` calls and formats the
scratch text via `func_8001A970` / `func_8001ABF0`.

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
- ovl_11_func_800CD624 (m, matched this session) — same-run direct caller of
  0x800CD4E4; a `char *base = (char *)&D_80071A00` + `base - 0x51C8` sub-base
  leaf that maps the tier result (or 0 when -1) into ovl_11_func_800C087C and
  copies the D_8006C838 u16 at +0x44CA to +0x51F4 — joins the D_80071A00 pool
  sub-base idiom

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
- ovl_11_func_800E2968 (m, matched this session) — initializes one 0xB4-byte
  entry (memset 0xB4, `sh` at 0x0/0x16/0xB0, packed 8-byte copy of
  `D_8006C838+0x44B8` to 0x1A then a zeroing `sh` at 0x1A, calls 0x800E2A30 /
  0x80107DD0); the packed-word copy and the 0x80107DD0(this+0xA8) callee are
  the same idiom as the 0x8010D04C / 0x8010B778 / 0x80112904 cluster
- ovl_11_func_800E20B8 (m, matched this session) — counts how many of the 10
  `D_800742EC` 0xB4-stride entries have a non-zero u16 at 0x0 (the same field
  the initializer `sh`s), returns the count; leaf, no callers in the overlay
- ovl_11_func_800E1F9C (m, matched this session) — the owner: allocates a
  D_800742EC entry (arg2==1, by index arg1 or 0x800D0CD8) or scans a second
  0xB4-stride array at `D_80075FE4` (3 records), then initializes the chosen
  entry via 0x800E2968; shares `D_80075FE4` with ovl_11_func_800D2160
- ovl_11_func_800E2A30 (m, matched this session) — reads the 0xB4-struct's
  state u16 at +0 via ovl_11_func_800E2718, mirrors a 0x109/0x10A result back
  to it, and passes its embedded SpriteSourceData at +0x78 to func_80015704;
  one 0xB4-byte struct type shared with 0x800E2968 (its caller)
- ovl_11_func_800D0CD8 (m, matched 2026-09-15) — find-first-free entry over
  the same array: scans up to 5/10 (D_80070D0A-selected) records for
  `u16@+0 == 0 && !(u32@+0x34 & 0x02000000)`, returns the entry pointer or
  NULL; same accessor role for D_800742EC that 0x800D0C34 plays for
  D_800749F4
- ovl_11_func_800E21E4 (s) — state machine over one 0xB4-byte entry: calls
  0x800E2934 (index lookup), 0x800E2A30 and 0x800E2BE8 (state update) on the
  same struct; zero-gap link predecessor of 0x800E2654 (ends exactly at
  0x2A834)
- ovl_11_func_800E2654 (m, matched this session) — clamps/randomizes the
  three-word sub-record embedded at +0x38 of the same 0xB4 struct (copies
  field +4 through; re-rolls fields +0/+8 into their sign-dependent ranges via
  func_80012A34, returns whether either changed); sole caller 0x800E21E4
  passes `s0+0x38`, and it is zero-gap link-adjacent to 0x800E2718

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
- ovl_11_func_8010C330 (m, matched this session) — claim iterator: scans
  cells 0..98 (bound 0x63) for the first free low u16, writes the id there,
  calls 0x8010C550 with it, then stores the 0x8010C668 occupancy count into
  `D_80070D3C`; returns 1 on claim, 0 when the table is full. Verified source
  is a natural `for (i=0; i<0x63; i++)` over `Cell4 *` with the shared local
  `Cell4`/`D_80075854[]` declarations, confirming the private cell-array tie
- ovl_11_func_8010C3C4 (m) — leaf countdown clear of every cell's u16@0
  (0x62→0 inclusive, 99 cells), then zeroes s16 at `D_8006C838`+0x99E4
- ovl_11_func_8010C3F8 (m) — sibling clear/set: gates on bit 0 of the
  u16 at `D_8006C838`+0x91A8, walks all 99 cells (0x62→0) incrementing each
  live cell's u16@2 then calling `ovl_11_func_8010C5A0` /
  `ovl_11_func_8010C5DC`, clears the flag bit, and stores `ovl_11_func_8010C668()`
  into s16 `D_8006C838`+0x99E4; shares the private `Cell4` array,
  link-immediate successor of 0x8010C3C4 and link-immediate predecessor of
  0x8010C4B0 (same +0x91A8 flag halfword)
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
- ovl_11_func_8010C5DC (m, matched this session) — leaf tick/retry helper on
  a cell: when u16@2 >= 0x1E, computes `(func_80012A34(0x64) −
  0x8010C668()) / 25`, unconditionally resets u16@2 to 0x14, then calls
  0x8010C330(0xA3) that many times; shares the private `Cell4` type, is the
  gapless link predecessor of 0x8010C668 (0x8010C5DC+0x8C = 0x8010C668) and
  the gapless successor of 0x8010C5A0 (0x8010C5A0+0x3C = 0x8010C5DC)
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
  earlier; now matched and fully finalized with the established entry-v0
  exception), both leaves fold a two-index compare to {0,1,2} and both
  open with the dead `sw $v0, 0($sp)` hard-`$v0` capture, and both callers
  (800D1CFC here, 800D062C there) seed `$v0 = $sp + 0x10` before every call
  — the v0-channel/static-chain fossil shared cluster, same family signature
  as func_8001E878/E9F8/EAE4 (see notes/research/
  func_8001EAE4-v0-channel-delay-slot-fossil.md).
- proven same-TU pair (2026-10-08): ovl_11_func_800D1CD0 is a GNU nested
  function *defined inside* ovl_11_func_800D1CFC. The parent only byte-matches
  with that definition, and the definition reproduces the leaf's dead
  `sw $v0, 0($sp)` as GCC's static-chain spill without any capture construct.
  The same holds for 800D0600 inside 800D062C (scratch match, not integrated).
  See notes/research/ovl_11_func_800D1CFC-nested-function-cse-not-expected.md.

Members (address order):
- ovl_11_func_800D12A0 (m, matched this session) — run head; s16 setter into
  D_8006C838+0x99E6 (flags/state array) via a large-offset split (base+0x8000,
  disp 0x19E6), local-pointer materialization; baseline flags; does not touch
  D_80123754 — role confirmed, shares the run's other data-tie class
- ovl_11_func_800D12B8 (s) — writes D_80123754 at three sites
- ovl_11_func_800D1960 (m, matched this session) — leaf setter:
  `D_80123754 = arg0` (single `sh`, delay-slot scheduled); byte-exact clean C,
  baseline flags; confirmed member of the shared-global cluster
- ovl_11_func_800D196C (s) — sandwiched, does not touch the global; calls
  the adjacent ovl_11_func_800D1C18 (0x800D1A30)
- ovl_11_func_800D1C18 (m, matched this session, byte-exact) — does not touch
  the global; scans a u16 table at D_801232D4 with index
  `(arg2 + arg1*9)*8 + arg0*288` against a `func_80012A34(0x65)` threshold;
  called by the adjacent ovl_11_func_800D196C
- ovl_11_func_800D1CD0 (m) — rank-compare leaf, nested function of
  800D1CFC and defined inside it in ovl_11_func_800D1CFC.c (its own file
  defines nothing); byte-identical to ovl_11_func_800D0600; does not touch
  the global
- ovl_11_func_800D1CFC (m, matched 2026-10-08) — reads D_80123754 (`lh`), the
  run's getter; parent of nested 800D1CD0, seeds $v0 with $sp+0x10 before
  each call
- ovl_11_func_800D1E1C (s) — does not touch the global
- ovl_11_func_800D1EB8 (s) — run tail, does not touch the global

---

## `ovl_11` D_80123A2C/D_80123A8C /5 row-table sibling pair — 0x800D29B0 / 0x800D2A88 (confidence: medium)

Candidate same-TU sibling pair in the middle of `ovl_11` (`Obj\GF_FARM.bin`),
just past the D_80123754 setter/getter run (0x800D12A0–0x800D2160; one
unexamined function between). Evidence is a shared data body plus shared
idiom and zero-gap adjacency:

Fingerprints:
- both write the same 0x44-byte output object: `sw` +0x38/+0x3C/+0x40,
  `sh` +0x22, `sh` +0x30, nothing else touched;
- both index 16-byte rows with the /5 division magic (0x66666667,
  `mult`/`mfhi`/`sra 1`/`subu` sign fix, sll-16/sra-12 stride, remainder
  re-sign-extended);
- their tables are contiguous in splat data 69960.data.s: D_80123A2C
  (6 × 16-byte rows, 0x60) ends exactly where D_80123A8C (4 × 16-byte rows,
  0x40) begins;
- zero-gap link order: 0x800D29B0 (0xD8) + 0xB8 = 0x800D2A88, which ends at
  0x800D2B40 (ovl_11_func_800D2B40, 0x214 — itself called by
  ovl_11_func_800D12B8, a D_80123754-run member).

Cross-container twin: ovl_11_func_800D2A88 is byte-identical to
ovl_15_func_80132A8C (46/46 words; only the table symbol and addresses
differ, D_801375D8), so this original source is compiled into both overlays
with overlay-local tables. The same /5 row-lookup idiom appears, without the
call, in ovl_11_func_80110DA0 (table D_80127EC0; recorded under the
0x80110CE8–0x80110DA0 pair).

ovl_15 same-TU extension (confidence: medium): the ovl_15 half is itself a
gapless pair. ovl_15_func_80132B44 (0xD8, matched) begins exactly where
ovl_15_func_80132A8C (0xB8) ends (0x80132A8C + 0xB8 = 0x80132B44), and is the
construction twin of ovl_11_func_800D29B0: same `{w0, w1, w2 + r·600}` copy to
0x38/0x3C/0x40, `u16@0x22 = (idx&1)?1:3`, `u16@0x30 = 5`, return 5 (table
D_801375F8). Their tables are contiguous in splat data — D_801375D8 (2×16-byte
rows, 0x20) ends exactly where D_801375F8 (6×16-byte rows, 0x60) begins — the
same zero-gap table relation the ovl_11 pair shows. Corroborated same-TU
membership for the ovl_15 pair.

Members (address order):
- ovl_11_func_800D29B0 (s) — D_80123A2C lookup: {w0, w1, w2 + r·600} to
  +0x38/+0x3C/+0x40, +0x22 = 3 (normal and arg1 == −1 paths) or 1 (arg1 ==
  −2), +0x30 = 5; arg1 == −1/−2 map to table rows 4/5; no call.
- ovl_11_func_800D2A88 (m, matched this session, byte-exact) — D_80123A8C
  lookup: {w0 + r·0x190, w1, w2} to +0x38/+0x3C/+0x40, +0x22 =
  func_80012A34(4), +0x30 = 4; twin of ovl_15_func_80132A8C.

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
- ovl_11_func_800D3C04 (m, matched this session) — state-code helper sibling
  of 800D3CA4/800D3CE8: seeds its call arg with 3, raises it to 8 when the
  struct field at +0x34 has 0x2000, calls `func_80012A34`, then maps the
  result 0→8, 1→9, else→1; its only caller is the shared dispatch function
  `ovl_11_func_800D3468`, the tie that places it in this run
- ovl_11_func_800D3FEC (s) — reads D_80128D78 (`lhu`), subtracts it from a
  struct field +0xAC and clamps non-negative
- ovl_11_func_800D55F8 (s) — reads D_80128D7A (`lhu`) into struct field +0x22;
  calls ovl_11_func_800D12B8

---

## `ovl_11` D_800B8EC0 state-dispatch table run — 0x800D3048 / 0x800D3104 (confidence: medium)

Two absolute-addressed (-G0) tables in `build/ovl_11/asm/data/104C.rodata.s`
tie these adjacent functions together. `D_800B8EC0` is a 21-word table of
per-state handlers (index 5 null; entries include 800D3FEC, 800D55F8, 800D539C)
and `D_800B8E6C` is a parallel 21-word table with only indices 5–7 populated
(800D4030 / 800D3FEC / 800D4028). Shared fingerprint: both functions read the
struct state id from +0x26 and index a table by it, dispatch a word from the
table as a function pointer on the same object, and test the +0x34 flag 0x800.
Zero-gap link-order contiguity: 0x800D3048 (0xBC) ends exactly where 0x800D3104
begins. The D_800B8EC0 handlers overlap the D_80128D78 cluster above, whose
dispatch caller ovl_11_func_800D3468 drives this run.

- ovl_11_func_800D3048 (s) — per-state update: calls ovl_11_func_800D3574,
  dispatches `D_800B8EC0[+0x26]` as a function pointer (skipped when +0x34 has
  0x800), then bumps +0x2C and calls ovl_11_func_800D3468.
- ovl_11_func_800D3104 (m) — state-entry wrapper: pre-checks `D_800B8E6C[arg1]`,
  sets +0x26 = arg1, zeroes +0x28/+0x2A/+0x2C, and runs the `D_800B8EC0[arg1]`
  handler, then re-inits the +0x48 vector via ovl_11_func_800D0408(4, ...).

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

Widening (2026-10-06, byte-exact match of `ovl_11_func_800C79F8`): that
function references the main-RAM global `D_80128CF0` (0x80128CF0, the s32
immediately after this run's `D_80128CEC`) and derefs the same
`D_8007AFF0+0x25388` far-buffer pointer slot as `ovl_11_func_800CE2EC`; it is
link-order contiguous with its successor `ovl_11_func_800C7AC0`
(0x800C79F8 + 0xC8). Adjacent-global plus shared-deref data tie; TU
membership unproven.

- ovl_11_func_800C79F8 (m, matched this session, 0xC8, byte-exact) —
  far-buffer pointer publication leaf: passes the 3-halfword view of its
  argument to `ovl_11_func_800BDE84`, stores the returned
  `D_8007AFF0+0x25388` far-buffer pointer into `D_80128CF0` (first project
  reference to that global), and returns a 4-case code (0x26/0x2A/0x2B/0x2C)
  from the pointer's +2 halfword

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

## `ovl_11` func_80015704 two-argument caller set — 0x800BD168 / 0x800CCFF8 / 0x800CDE3C / 0x800CE5FC (confidence: low)

Candidate same-TU callers of the sprite-source loader `func_80015704`.
Membership rests on a shared caller-side idiom: each TU declares the engine
loader locally as a **two-argument** prototype (`SpriteSourceData *out,
SpriteDataHeader *header`) rather than using the generated four-argument
declaration, and materialises exactly `$a0`/`$a1`, `$a1` being a live value
from the preceding record-table lookup. `ovl_11_func_800CE5FC` also reads the
D_80070CF2 state s16 (the mask-switch run's switch global). Link order does
not bind the members (different regions), so this witnesses a shared loader
idiom, not proven TU membership.

Members:
- ovl_11_func_800BD168 (m) — sprite-source init: `func_80015704(D_80071C60,
  header[1])` then `func_80015894(D_80071C60, header[1] + 0xBE08)`
- ovl_11_func_800CCFF8 (m, matched this session, byte-exact) — sprite-source
  init on the `+0x260` object: `func_80015704(obj + 0x260, &D_8007BFF8)` then
  `func_80015894(obj + 0x260, D_801231FC[obj->unk3C - 0x3B] + &D_8007BFF8)`,
  then `func_80015840(obj + 0x260, 0)`; reuses the `+0x3C` u16 a0 view and
  `+0x260` call base of the 0x800C6E0C switch run and the same
  `func_80015704` → `func_80015894` two-argument pair as 800BD168.
- ovl_11_func_800CDE3C (m, matched this session, byte-exact) — copies 3 words
  from `arg0+0x100..0x108` into 10 stride-0x10 records at `arg0+0x120..`, then
  calls `func_80015704(arg0 + 0x2D4 + 0x34*i, D_80124FCC+0x18->unk4 + &D_8009A3F8)`
  for i in 0..4. Its `$a1` is the same `D_80124FE4[1] + (s32)&D_8009A3F8`
  expression as the already-documented sibling ovl_11_func_800E2A30, and the
  two also share the D_8009A3F8 base, witnessing a shared sprite-data base
  cluster in addition to the two-argument loader idiom.
- ovl_11_func_800CE5FC (m, matched this session) — guard leaf: zeroes the
  D_80123154 flag, and when D_80070CF2 == 3 calls `ovl_11_func_800D688C(0x187)`
  and, if non-NULL, sets the flag and calls `func_80015704(&D_80128D00, r)`

---

## `ovl_11` sprite-position initializer/draw cluster — 0x800CDE3C–0x800CE210 (confidence: medium)

Candidate same-TU cluster supported by paired initializer/driver layouts,
shared draw-helper calls, and corroborating link order; the original TU
boundaries remain unresolved.

Fingerprints:
- `800CDE3C` / `800CDEEC` share the object's +0x120 position array with
  stride 0x10; `800CDF4C` / `800CDFAC` share the +0x1C0 position array
  with stride 0x10 and ten animation/frame pairs at +0x3D4 with stride 4.
- Both drivers call `800CE0F0`, respectively with mode 0 and mode 1; the
  verified helper consumes the corresponding position view and selects
  embedded sprite-source state or the indexed animation/frame pairs.
- The map places `800CDE3C` → `800CDEEC` → `800CDF4C` → `800CDFAC` →
  `800CE034` → `800CE0F0` in zero-gap order. Intervening `800CE034` is
  already recorded in the D_801281F0 pair-table cluster and is not added
  here on adjacency alone.

Members (address order):
- ovl_11_func_800CDE3C (m) — initializes ten position records and five embedded sprite sources.
- ovl_11_func_800CDEEC (s) — five-position draw driver using `800CE0F0` mode 0.
- ovl_11_func_800CDF4C (m) — initializes ten indexed positions and animation/frame pairs.
- ovl_11_func_800CDFAC (m) — ten-position draw driver using mode 1, skipping animation value 5.
- ovl_11_func_800CE0F0 (m) — projects/draws a position with embedded or shared sprite-source state.

Evidence: matched initializer/helper C in `src/overlays/ovl_11/`; original
`800CDEEC` / `800CDFAC` listings under `build/ovl_11/asm/nonmatchings/`;
`build/ovl_11/ovl_11.map`.

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
- internal call graph: the leaf `ovl_11_func_800E4B58` is called by four of
  its neighbours — `ovl_11_func_800E4AEC`, `ovl_11_func_800E4B6C`,
  `ovl_11_func_800E4C30` (twice, subtracting two consecutive getter results),
  `ovl_11_func_800E4D08` — and `ovl_11_func_800E4C30` also calls its own
  neighbour `ovl_11_func_800E4C84`; a packed cluster whose members call each
  other, not the engine.
- shared idiom: `ovl_11_func_800E4AEC` and `ovl_11_func_800E4D08` both scan an
  array of s16 words testing the 0x3C00 bit, an idiom local to this run;
  `ovl_11_func_800E4C84` is the same scan over the same `base+4` array with the
  predicate inverted to the 0x4000 bit, and `ovl_11_func_800E4BA4` scans the
  same `base+4` s16 array on the 0x8000 bit — three predicates over one array.

Members (address order, matched in bold):
- ovl_11_func_800E48CC (s) — run head
- ovl_11_func_800E499C (s)
- **ovl_11_func_800E4AEC (m, matched this session)** — scans the s16 array at
  `base+4` for the first entry whose 0x3C00 bit is clear, then returns
  `getter(base, index-2)` or 0 when no entry is found
- **ovl_11_func_800E4B58 (m, matched this session)** — shared getter leaf,
  byte-exact clean C: `return *(s32 *)(arg0 + arg1*4 + 0x34);` — a
  base-pointer plus 4-byte-stride index plus fixed 0x34 offset; baseline
  flags. Called by 800E4AEC / 800E4B6C / 800E4C30 / 800E4D08 (whose `sw $v0`
  sites and `subu`-of-two-calls pattern consume it)
- ovl_11_func_800E4B6C (s) — feeds the getter `base + (s16)a0[2]*4 + 0x38`
  in `$a0`, passes its own incoming index through untouched in `$a1`
- **ovl_11_func_800E4BA4 (m, matched this session)** — scans the same `base+4`
  s16 array for the 0x8000 bit and, for each set entry, calls
  `func_80017240` with `ovl_11_func_800E4B6C(base, i)` and the pair of adjacent
  s16 globals D_80129410/D_80129412
- ovl_11_func_800E4C30 (s) — `getter(base, i+1) - getter(base, i)`;
  also calls 800E4C84
- **ovl_11_func_800E4C84 (m, matched this session)** — the 0x4000-bit twin of
  800E4AEC: scans the s16 array at `base+4` for the first entry whose 0x4000
  bit is set and returns `index-2`; on no match calls `SystemError(0x4E,
  D_8006C868->unk2)` — the same `D_8006C868->unk2` read as `ovl_11_func_800E3D88`
- **ovl_11_func_800E4D08 (m)** — loop calling 800E4B58, storing results into
  the `D_801291C0` s32 array, guarded by a 0x3C00 bit in an s16 word; shares
  that global cluster with its tail neighbour `ovl_11_func_800E4DAC`, which
  also reads `&D_801291C0`
- ovl_11_func_800E4DAC (s) — run tail (0x2CC)

---

## `ovl_11` 0x800E4568–0x800E48CC `ovl_11_func_800F5888` box-fixup caller run (confidence: medium)

Candidate same-TU family of `ovl_11` (`Obj\GF_FARM.bin`) — a zero-gap
link-order run whose members all feed the GTE/bounds hit-test leaf
`ovl_11_func_800F5888` a local three-halfword box built by the identical
`+0x96 / -0x64 / -0x96` fixup from three consecutive `u16` fields, then scale
the result's third word by `D_8005E3C0->field_120`.

Fingerprints:
- zero-gap link-order contiguity (map): 0x800E4568 (0xA0) → 0x800E4608
  (0xA0) → 0x800E46A8 (0x224) → 0x800E48CC (0xD0) → 0x800E499C (the
  documented pointer-getter run head);
- shared callee + idiom: `ovl_11_func_800E4608`, `ovl_11_func_800E46A8` and
  `ovl_11_func_800E48CC` each build the box (`$sp+0x38` / `$sp+0x20` / `$sp+0x10`)
  from three `lhu` fields with the same `+0x96`/`-0x64`/`-0x96` constants, call
  `ovl_11_func_800F5888`, and then index `D_8005E3C0->field_120` by
  `(hit_word >> 2) * 4`;
- call graph agrees: `ovl_11_func_800E4568` calls both `ovl_11_func_800E4608`
  and `ovl_11_func_800E48CC`.

Members (address order, matched in bold):
- ovl_11_func_800E4568 (s) — walks the D_80129230 0x30-byte records and calls
  the box tester for each flagged work-area entity (see the D_80129230 entry);
  also the run's call-graph hub
- ovl_11_func_800E4608 (s) — fixed-coordinate box test against
  `D_8006C838`+0x4478/+0x447C/+0x4480; forwards the hit to 800E559C
- ovl_11_func_800E46A8 (s) — object-relative box test from `s1+0x60..0x68`,
  the run's largest member
- **ovl_11_func_800E48CC (m, matched this session)** — record-relative box test
  from u16@+8/+0xC/+0x10; submits through `func_80016054` and advances the
  sprite via `func_800158E4` when `D_8006C844` bit 0x08000000 is clear; also
  the documented pointer-getter run head

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
- extended chain: newly matched `ovl_11_func_800F4240` (0x68) ends exactly at
  the documented nearby caller `ovl_11_func_800F42A8` (0xB8), which ends
  exactly at the run head `ovl_11_func_800F4360` — so the zero-gap chain now
  reaches 0x800F4240; it also touches the same record offset set (s16@2 plus
  the flag word @4, tested through an `ori 1`/`and` bits-set check), a
  low-confidence struct-shape kin;
- chain extension: newly matched `ovl_11_func_800F413C` (0x104) ends exactly
  at 0x800F4240, so the zero-gap link run now reaches 0x800F413C and its
  closest kin `ovl_11_func_800F4240` is a byte-exact pair member: both call
  the same D_80070CF2 switch leaf `ovl_11_func_800F581C`, both re-test the
  s16@2 / u16@4 view fields through the same `ori 0x81` + `and` bits-set
  guard, and both emit the state constants 0x13A/0x13B/0x13C from s16@2
  values 0x40/0x3A/0x3E;
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
- ovl_11_func_800F413C (m, matched this session, 0x104 byte-exact) — zero-gap
  link predecessor of 0x800F4240 and its closest kin: calls the same
  D_80070CF2 switch leaf `ovl_11_func_800F581C`, re-tests the s16@2 / u16@4
  field pair through the same `ori 0x81` + `and` bits-set guard, and maps the
  s16@2 state 0x40/0x3A/0x3E to 0x13A/0x13B/0x13C against the D_80070CF2
  values 2/3 (0x13A shared with 0x800F4240); second parameter is an out-record
  whose s16@0 receives s16@2 and s16@4 receives 1, so the family's record
  offset set is touched by both flags and a state slot
- ovl_11_func_800F4240 (m, matched this session) — zero-gap link predecessor
  of the documented nearby caller 0x800F42A8: calls the D_80070CF2 switch leaf
  `ovl_11_func_800F581C` and returns either 0, the s16@2 field, or 0x13A after
  the flag-word/@2 checks; struct-shape kin of the record family (low)
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
- ovl_11_func_800F43CC (m, matched this session) — spawn-record dispatch switch on ids 0x64/0x65/
  0xE8/0x122–0x124: computes the target from the `D_8006C838`+0x8000 entity
  base and calls the run-head leaf 0x800F4360; itself called by
  0x800CC7CC/0x800E21E4/0x800C580C/0x8011C298/0x8010B05C; its 0x64 path reads
  the `+0x8000+0x5DD4` entity-pointer slot through the same two-stage base
  idiom as the matched `ovl_11_func_800F4CEC` (same slot, same `*(T **)(base +
  0x5DD4)` read), a shared entity-base-slot fingerprint

---

## `ovl_11` D_80129230 0x30-byte record cluster — 0x800E4568 / 0x800E516C / 0x800E5230 (confidence: medium)

Candidate same-TU family of `ovl_11` (`Obj\GF_FARM.bin`) sharing the
absolute-addressed global `D_80129230` — an array of 10 records with a
0x30-byte stride and an s32 at +0x14.

Fingerprints:
- shared-global cluster: all three walk `D_80129230` with a 0x30 byte stride;
  800E516C and 800E5230 touch the same s32@+0x14 while 800E4568 steps the
  record base;
- link-order adjacency: `ovl_11_func_800E516C` (0xC4) ends exactly at
  `ovl_11_func_800E5230` (0x800E5230) — one unbroken run;
- shared work-area idiom: all three (and 800E8960/800E8BA0) reach the entity
  pool through `D_8006C838`+0x8000 (`base2[0x5DD0>>2]`); 800E516C reaches the
  same +0x5DD0 slot directly from `D_80074838`;
- shared display-bounds globals: 800E516C reads the ovl_11 halfwords
  `D_80129410` / `D_80129412` (declared together in `globals_override.h` by
  this session) through the same five-argument helper call shape also used by
  ovl_11_func_800E4BA4 — a shared-global link, though 800E4BA4's per-file
  `-fno-rerun-loop-opt` override leaves it outside this cluster's TU claim.

Members (address order):
- ovl_11_func_800E4568 (s) — walks the 10 records, tests bit 0 of the u16@+4
  of each work-area entity and calls 800E48CC for each set record
- ovl_11_func_800E516C (m, matched this session) — walks the 10 records,
  dispatches on the s32@+0x14 (zero = free) through func_80015704 /
  func_80015868, then installs arg1 at +2 of a 0x18-stride side table
- ovl_11_func_800E5230 (m, matched this session) — reset leaf: clears the
  s32@+0x14 of all 10 records, then clears the work-area entity via
  ovl_11_func_800F4390 and sets a state halfword

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

## `ovl_11` D_800711C4 progress-record accessor cluster — 0x800F3BCC–0x800F3EF0 (confidence: medium)

Candidate same-TU family of `ovl_11` (`Obj\GF_FARM.bin`) sharing the main-EXE
progress-counter record `D_800711C4` (absolute `lui`+`%lo`, defining TU
extern): the u16 counter array plus its s32 accumulator at `+0x34`. The
dominant idiom is `ovl_11_func_800F3C9C(arg0 & 0xFFFF)` used as an array index,
and each member reads or writes the same `+0x34` accumulator. Members form a
near-gapless link run 0x800F3BCC → 0x800F3C9C → (0x800F3D40) → 0x800F3D88 →
0x800F3E00 → 0x800F3E44 → 0x800F3EF0, and the run's internal call graph agrees:
0x800F3BCC, 0x800F3E00 and 0x800F3E44 all call the index mapper 0x800F3C9C,
their link predecessor. (0x800F3D40 sits inside the run but belongs to the
separate D_8006C838 flag-byte group.)
ovl_11_func_800F3E44 reaches the same record from its pending-half base
`D_800712C0` (= `D_800711C4 + 0xFC`): the u16 at `D_800712C0+0x00` and the
array at `+0x02` are the record's pending counter and entries at 0x7E/0x7F, and
`D_800712C0+0x34` is the pending s32 accumulator at 0x130 that
ovl_11_func_800F3EF0 folds into the main `+0x34`.

Members (address order):
- ovl_11_func_800F3BCC (m, matched this session, 0xD0 byte-exact) —
  register-one-counter: increments the clamped u16 at `D_80070D14`, folds
  `ovl_11_func_800D603C(arg0)`'s result into the s32 at `D_800711C4+0x34`,
  then `idx = ovl_11_func_800F3C9C(arg0 & 0xFFFF)` and increments
  `D_800711C4[idx]` with a 999 clamp, returning 1 (0 when idx == -1). Keeps
  `u16 *base = D_800711C4;` live in `$s1` across the two callees and reaches
  `D_80070D14` as `base - 0x24C6` plus byte `0x44DC` — the same
  base-pointer-in-register idiom as ovl_11_func_800F3E00
- ovl_11_func_800F3C9C (m) — the cluster's index mapper: u16 id → small table
  index (0x41–0x4F → id-0x41, several id sets → 0xF..0x15), -1 otherwise
- ovl_11_func_800F3D88 (s) — reset leaf: clears the `D_800711C4+0x34`
  accumulator via `ovl_11_func_800F2354` and stores 0 there when
  `func_8001AF44(0xA0) != 1`
- ovl_11_func_800F3E00 (m, matched this session, 0x44 byte-exact) — record
  lookup: `idx = ovl_11_func_800F3C9C(arg0 & 0xFFFF); return idx == -1 ? -1 :
  D_800711C4[idx];` (u16 element); clean C, baseline flags
- ovl_11_func_800F3E44 (m, matched this session, 0xAC byte-exact) — pending-half
  fold: while `D_800712C0[0] < 0x1E`, folds `ovl_11_func_800D603C(arg0 & 0xFFFF)`
  into the s32 at `D_800712C0+0x34`, bumps the counter, then increments the
  pending entry selected by `ovl_11_func_800F3C9C(arg0 & 0xFFFF)`; returns 1
  when the counter is full
- ovl_11_func_800F3EF0 (m) — fold-update: when entry 0x7E is non-zero, adds the
  25 pending entries (0x7F..0x97) into the counters (0..0x18) with a 999 clamp,
  clears the pending entries, and folds the s32 at `+0x130` into `+0x34`.
  Byte-exact and fully finalized in the parked-function campaign with three
  explicitly user-authorized register-variable workarounds; no flag override.
  The counter/pending layout agrees with the adjacent E44 producer and the
  original C580C caller at 0x800C5C4C. These remain storage/call relationships,
  not proof of a translation-unit boundary.

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
`D_80070D04`. Inside the run, `ovl_11_func_80100A8C` and link follower
`ovl_11_func_80100F9C` both index the same 0x16-stride `D_80071318` record
(mask `u16@+4`, eight-value `u16@+6` array), a shared file-scope global
reader cluster independent of the `D_80070D04` probe.

Members (address order):
- ovl_11_func_80100A8C (m, matched this session, byte-exact) — direct caller of
  both 0x80100E68 and 0x80100EB8; 0x16-stride `D_80071318` record reader
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
- ovl_11_func_800CD624 (m, matched this session) — tier-select leaf over the
  pool: passes `&D_80071A00` to the same-run tier lookup 0x800CD4E4, maps -1 to
  0, copies the `base - 0x51C8` (= `D_8006C838`) u16 at +0x44CA to +0x51F4, and
  calls 0x800C087C with the result; same sub-base idiom as 0x800CD3C4 /
  0x800D63C4
- ovl_11_func_8011D06C (m, matched earlier) — leaf: `return D_80071A5C >= arg0;`
  `>=`-guard on the pool's middle sibling


## `ovl_11` D_800719FE s16-global cluster — 0x800FDE98–0x800FDFD8 / 0x80112160 (near trio: medium; 80112160: medium)

Candidate same-TU family of `ovl_11` (`Obj\GF_FARM.bin`) sharing a single
file-scope s16 global. Same shared-global fingerprint as the documented
D_80071A00 pool: main-RAM file-scope global absent from the generated
`globals.h`, read by short leaf helpers. The near members are tightly bound:
`ovl_11_func_800FDEDC` (0x800FDEDC, matched) loads the global, branches on
`(D_800719FE - arg0) < 5`, and forms the addresses of both
`ovl_11_func_800FDFA8` and `ovl_11_func_800FDFD8` directly, selecting one as
a function pointer per loop iteration — a code-level binding, not just
adjacency. Link order is a zero-gap run 0x800FDE98 (0x44) → 0x800FDEDC
(0xCC) → 0x800FDFA8 (0x30) → 0x800FDFD8. Third member `ovl_11_func_80112160` (0x80112160) is a
state-transition dispatcher over the same global, read through the
`&D_8006C838` view at +0x51C6; it is bound into the same work area by
writing that view's +0x44D0/+0x44D2 mode halfwords and +0x44F8 status word
and by calling `ovl_11_func_80111F10` (the tail of the 0x80111D94–0x80111F10
reset run documented below). Spread between the near trio and the far
dispatcher is large, so same-family for 80112160 remains plausible rather
than established.

Members (address order):
- ovl_11_func_800FDE98 (m, matched 2026-11) — short s16-table lookup leaf:
  clamps arg0 to <5 (else 4), indexes `.data` s16 table `D_80127370`
  (absent from `globals.h`, extern + absolute addressing) and tail-calls
  the consumer below with the looked-up value; ends at 0x800FDEDC, gapless
  before the consumer, so it extends the run and binds to the same TU;
  byte-exact clean C, baseline flags
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
- ovl_11_func_80112160 (m, matched 2026-11) — state-transition
  dispatcher over the same global: arg0==0 returns `D_800719FE != 0`,
  arg0==1 returns the raw s16, arg0==2 reads the +0x51C6 selector and for
  the 0x13F/0x140/0x141 states writes the +0x44D0/+0x44D2/+0x44F8 fields,
  calls `ovl_11_func_80111F10` and clears the selector; byte-exact clean C,
  baseline flags

Widening (byte-exact match of `ovl_11_func_80111E38`, 2026-10-03): the
cluster's first known writer is now matched — `ovl_11_func_80111E38`
resets `D_800719FE` to 0 (via its `&D_8006C838` base, +0x51C6) and sits in
the gapless link run 0x80111D94–0x80111F10 with `ovl_11_func_80111EE0`
(see the D_80070D10 reset-run entry below).

Widening (byte-exact match of `ovl_11_func_800FDFF4`, 2026-11): the run's
gapless successor at 0x800FDFF4 (`ovl_11_func_800FDFD8` + 0x1C) is matched
and repeats the cluster's signature lookup shape — clamp arg0 to <5 else 4,
then index a `.data` table (`D_8012737C`, 12 bytes into the same byte block
as `D_80127370`; absent from `globals.h`, extern + absolute addressing) —
before calling `func_80015EE8(D_8005E3C0->field_D8 + 0x68, &D_8012CEB8, ...)`,
the same text-draw path its own gapless successor `ovl_11_func_800FE068`
(0x800FE068) uses. Membership rests on the zero-gap link order plus the
shared clamp/lookup idiom; it does not read `D_800719FE`.

Widening (byte-exact match of `ovl_11_func_800FE068`, 2026-11): the run's
gapless successor at 0x800FE068 is matched. Role: three-iteration
threshold-table text-draw caller — it walks the `D_80127214` halfword table
(entries 1..3; the table is already documented on `ovl_11_func_800FE3A0`)
through a `u16 *`, calling `func_80015EE8(D_8005E3C0->field_D8 + 0x68,
&D_8012CEB8, ...)` on each threshold met. Per-TU flag evidence bounds its
membership: its byte-exact source requires `-fno-strength-reduce` (baseline
strength-reduces `p[var_a2 + 1]` into a preheader walker the target does not
carry), while the link-adjacent 800FDFF4/800FE704/800FE86C matches need no
override — so the zero-gap link order does **not** place 0x800FE068 in their
TU. The only matched ovl_11 site carrying the same override is
`ovl_11_func_800F8224`, so the shared flag fingerprint is consistent with a
0x800FE068 / 0x800F8224 TU (low; per-TU overrides are common in this
container, so a shared flag alone is not proof).

Widening (byte-exact match of `ovl_11_func_800FE704`, 2026-11): the
same text-draw path continues further down the link run as a gapless pair,
0x800FE704 -> 0x800FE780 (both 0x7C, each ending exactly where the next
begins). Both call `func_80015EE8(D_8005E3C0->field_D8 + 0x68,
&D_8012CE88, ...)` and both derive arg3 as `((s16)D_80127212) / 30 &
0xFF` from the same file-scope u16 `D_80127212` (absolute addressing,
absent from `globals.h`); they differ only in literal arg2 (1 vs 3) and
stack arg5 (0x30 vs 0xC8). Membership rests on the shared call path plus
the `D_8012CE..` byte block shared with 800FDFF4's `D_8012CEB8`, not on
`D_800719FE`. `ovl_11_func_800FE704` matched 2026-11; gapless follower
`ovl_11_func_800FE780` is the same idiom and remains a stub.

Widening (byte-exact match of `ovl_11_func_800FE86C`, 2026-11): the gapless
link run above continues through `ovl_11_func_800FE7FC` (0x800FE7FC, 0x70
bytes, a one-line wrapper forwarding `(arg0, 5, arg1, arg2)`) into
`ovl_11_func_800FE86C` (0x800FE86C, 0xBC bytes), so 0x800FE704 -> 0x800FE780
-> 0x800FE7FC -> 0x800FE86C is four consecutive entries with no gap.
`ovl_11_func_800FE86C` is a count-up loop over `arg0` iterations that issues
`func_80015EE8(D_8005E3C0->field_D8 + 0x68, ((s32)&D_8012CE88), (u8)arg1, 0,
arg2, arg3)` and steps `arg2` by -8 each pass; it shares the call path,
`D_8005E3C0` and `D_8012CE88` with 800FE704/800FE780 but not the
`D_80127212` /30 argument. Membership rests on the shared call path plus the
gapless link order.

Widening (byte-exact match of `ovl_11_func_800FD194`, 2026-11): the same
text-draw path also reaches far below the run at 0x800FD194, a 0x88-byte
two-call leaf that issues `func_80015EE8(D_8005E3C0->field_D8 + 0x68,
&D_8012CE28, D_80127358[arg0], 0, 0xBA, 0x14)` and then
`func_80017B3C(D_8005E3C0->field_D8 + 0x54, *D_80054BBC + (s32)&D_80053604,
0xD2, 0x1A)`. It shares the call path and the `D_8012CE..` file-scope byte
block with 800FDFF4/800FE704 (D_8012CE28 is 0x60 before 800FE704's
D_8012CE88), and its indexed `.data` byte table `D_80127358` lies 0x18 before
800FDFF4's `D_80127370`/`D_8012737C` in the same block. Membership rests on
the shared call path plus those two shared byte blocks, not on `D_800719FE`;
there is no link adjacency (it sits 0xD04 above the run start).

Widening (byte-exact match of `ovl_11_func_800FC544`, 2026-11): the same
text-draw path reaches further up at 0x800FC544 (0xB0 bytes), a two-call leaf
that issues `func_80015EE8(D_8005E3C0->field_D8 + 0x68, D_8012CDF8 + arg0*0x30,
arg1 & 0xFF, 0, t, arg4)` and `func_80017B3C(D_8005E3C0->field_D8 + 0x54,
arg2, (s16)(t + 0x18), (s16)(arg4 + 4))` with `s16 t = arg3` — the identical
call pair `ovl_11_func_800FD194` uses. It also indexes a second file-scope
overlay byte block `D_8012CDF8` (stride 0x30, absent from `globals.h`, extern +
absolute addressing) that it shares with the documented `D_8012A028` cluster
members `ovl_11_func_800FC358` and `ovl_11_func_800FD3CC` (and with stubs
`ovl_11_func_800FBE88` / `ovl_11_func_800FC7F0`). Membership rests on the shared
text-draw call path plus `D_8012CDF8`; it reads neither `D_800719FE` nor the
`D_8012A028` buffer, so its non-member listing in the `D_8012A028` entry stands —
that cluster's `ovl_11_func_800FC5F4` / `ovl_11_func_800FC6A4` call it as a draw
leaf (the buffer set is disjoint, the call set is not).

Widening (byte-exact match of `ovl_11_func_800FC7F0`, 2026-11): the same
stride-0x30 `D_8012CDF8` draw path's next member at 0x800FC7F0 (0xD8 bytes) is
the near-exact word-shape sibling of `ovl_11_func_800FC544` — same
`func_80015EE8(D_8005E3C0->field_D8 + 0x68, D_8012CDF8 + arg*0x30, ...)` /
`func_80017B3C(D_8005E3C0->field_D8 + 0x54, ...)` call pair and same
`D_8005E3C0` / `D_8012CDF8` globals — and additionally calls
`ovl_11_func_800FE834`. Membership rests on the shared text-draw call path plus
`D_8012CDF8`, making 800FC544/800FC7F0 a corroborated sibling pair.

Widening (byte-exact match of `ovl_11_func_800FC754`, 2026-11): the gapless link
predecessor of that draw leaf (0x800FC754 + 0x9C = 0x800FC7F0) is matched as a
caller of `ovl_11_func_800FC7F0`: it walks the 4-entry stride-0xC `.data` table
`D_80127234` (record type `Ovl11D80127234Entry` now in `globals_override.h`)
and draws each nonzero entry. Membership rests on the zero-gap link order plus
the call edge, which agree; it shares `D_80127234` with the unmatched writer
stub `ovl_11_func_800FB908` (fields +0x00/+0x04/+0x09).

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
- ovl_11_func_80111D94 (m, matched this session) — run head: on
  `func_8001AF44(8) == 1`, interpolates the `D_80127F68`/`D_80127F74` pair
  via `func_8001F278` into a 3-s32 buffer, truncates it to 3 halfwords and
  feeds `ovl_11_func_800DCBDC`, then bumps file-scope s32 `D_8012D0EC` (or
  deactivates flag 8 via `func_8001AF70`); byte-exact clean C, baseline flags
- ovl_11_func_80111E38 (m, matched 2026-10-03) — reset: zeroes
  D_80070D10/D_80070D12/D_800719FE through one `&D_8006C838` base
  (+0x44D8/+0x44DA/+0x51C6) and returns the base; calls 80111EF0
- ovl_11_func_80111E68 (m, matched 2026-10-03) — same-base writer: stores
  arg0 to +0x51C6 (`D_800719FE`) and a range-derived mode (0/2/4) to
  +0x44DA (`D_80070D12`), then sets flag 0x37 via `func_8001AF70`
- ovl_11_func_80111EE0 (m) — sets `D_80070D10 = 3` (leaf)
- ovl_11_func_80111EF0 (s) — trampoline to `ovl_11_func_80111F10`
- ovl_11_func_80111F10 (s) — role unknown

---

## `ovl_11` s16 dispatch-map run — 0x80111750–0x80111944 (confidence: medium)

Candidate same-TU family of `ovl_11`: address-adjacent leaf `s16`->`s32`
selectors — each a `switch` with no callees and no file-scope data. The
membership fingerprint is a shared case-key set: 80111750 and 80111944
dispatch on exactly {0x8B, 0x8C, 0x8D, 0x91, 0x92, 0x93, 0xE3, 0xE7, 0xE8}
plus the 0x122–0x124 range, differing only in the constants returned and the
case order; 8011184C sits between them with the same leaf-switch shape.

Members (address order):
- ovl_11_func_80111750 (m, matched) — shared-key-set `s16` switch map
- ovl_11_func_8011184C (m, matched) — biased-channel `s16` switch map
- ovl_11_func_80111944 (m, matched this session, 0x11C bytes) — shared-key-set
  `s16` switch map

---

## `ovl_11` D_80127F60 s16-table lookup helper — 0x80111D28 (confidence: medium)

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
  tables (D_80127F50, D_80127F68) suggest a compact data+helper cluster.
- ovl_11_func_80111D48 (m, matched this session) — link-adjacent successor
  whose 0x20 bytes begin exactly at 0x80111D48: builds a 3-halfword local from
  table `D_80127F68` at 4-byte stride (`lhu` at +0/+4/+8), zeroes file-scope
  s32 `D_8012D0EC` (absolute addressing), and calls `ovl_11_func_800DCBDC(0,
  local)`; byte-exact clean C, baseline flags. The successorship binds the
  `D_80127F68` table and 80111D28 into this one TU cluster, and `D_8012D0EC`
  is the same file-scope flag referenced by predecessor 80111D94 (matched
  below).
- ovl_11_func_80111D94 (m, matched this session) — link-adjacent successor
  of 80111D48 (0x4C bytes, ends exactly at 0x80111D94): reuses the same
  `D_80127F68` table (read at 4-byte stride by `func_8001F278`) and the same
  file-scope s32 `D_8012D0EC`, and calls the same `ovl_11_func_800DCBDC(0,
  local)`, confirming the shared `D_80127F68`/`D_8012D0EC` cluster
  fingerprint; byte-exact clean C, baseline flags.

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

## `ovl_11` 800FB218/800FB290 4-argument irregular-switch pair — 0x800FB218–0x800FB290 (confidence: medium)

Evidence: zero-gap link order (`ovl_11_func_800FB218`, 0x78 bytes, ends
exactly at 0x800FB290) plus a shared author idiom cluster: both keep the
incoming four-slot ABI shape with an unused second argument (arg0/arg2 are
`SwapStruct_B45C *`, arg1/arg3 scalars), both call `ovl_11_func_800FB3E4`,
`ovl_11_func_800D5810` and the swap helper `ovl_11_func_800FB45C`, both use
the irregular switch with a nested `case 1` fallthrough, and both declare the
same local `SwapStruct_B45C` {s16; s16; s16} typedef. Adjacency + call graph +
idiom agreement; TU membership between the two is well supported, while the
wider 0x800FBxxx region (0x800FB3E4 predicate, 0x800FB404, 0x800FB45C) stays a
prior.

Members:
- ovl_11_func_800FB218 (m) — type/state gate: `800FB3E4` dispatch with a
  nested `case 1`, swapping arg0/arg2 through `800FB45C` and returning 0 on
  the accepting path, else 1.
- ovl_11_func_800FB290 (m, matched this session, byte-exact) — two-stage
  sibling: runs the same `800FB3E4`/`800D5810` gate on (arg0,arg3) then
  (arg2,arg1), adds the `800D583C` / `field_4 < 2` check in each stage, and
  swaps through `800FB45C` returning 0, else 1.
  Corroboration (this session): the pair is called from the D_80126FE0
  state-machine direct callee `ovl_11_func_800FB120` (byte-exact), which uses
  the same local `SwapStruct_B45C` typedef — call-graph agreement for the
  pair's shared-TU reading.

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
  0x8011A9CC (0x10) → 0x8011A9DC (0x68) → 0x8011AA44 (0x10) → 0x8011AA54
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
- ovl_11_func_8011A9DC (m, matched this session) — non-leaf flag-writer member of the zero-gap run between 8011A9CC and 8011AA44 (its measured 0x68 size corrects the run list above): initialises the s32/s32/s16/s16 record at `D_8012D538` (pointer fields from `D_80054BC0[0] + (s32)&D_8005182A`, the second at -0x10) via a helper call, then clears the family flag `D_8012D52C = 0; return 1;` — same shared-data-symbol idiom as the recorded `D_8005181A` leaf `ovl_11_func_8011DD48`
- ovl_11_func_8011B210 (m, matched this session) — non-leaf initialiser at 0x8011B210, a zero-gap run member between 8011AFB4 and 8011B2B0: calls the run helper `ovl_11_func_8011D400`, writes the 0x60-byte `D_8012D548` record (s8 at 0x3C/0x3D/0x5A/0x5B, s16 at 0x28/0x2A/0x46/0x48/0x5C) and its two pointer fields from `D_80054BC0[0] + (s32)&D_80051AA8` (second +0xA), then clears the family flag `D_8012D52C = 0; return 1;` — same `D_80054BC0[0] + (s32)&global` pointer idiom as the A9DC member, tying the `D_8012D548` record to this run
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
- ovl_11_func_80115F80 (m, matched this session) — calls it and re-reads the
  selected entry's `D_8006C838 + 0x7AE8` word, returns `(word & 0x40) != 0`;
  clean C reuses the sibling's `base = (char *)&D_8006C838; base += 0x7AE8`
  idiom and its 0x2D-word (0xB4-byte) stride, confirming the shared cluster

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
- ovl_11_func_800FB0C4 (m, matched this session) — state-machine direct callee
  at 0x800FB0C4: queues `func_8002261C(3, ...)` (0x3E8-biased via
  `ovl_11_func_800D60D4` when the entry s16@0 is 0xA4), then on
  `func_800226A4() == 2` writes the cluster head `D_80126FE0 = 1` and calls
  `func_80022738`; shares the D_80126FE0 write + func_8002261C/226A4 guard
  idiom with 0x800FAAD4 and 0x801014A4 (shared-global + idiom evidence)
- ovl_11_func_800FB120 (m, matched this session, byte-exact) — state-machine
  direct callee (caller 800FAC0C reads the result): resolves two indices
  through 800FB4B0's 6-byte table and dispatches to 800FB218 (one side's
  field_0 == 0), 800FB290 (field_0 unequal) or 800FB394 (equal); declares the
  same local `SwapStruct_B45C` {s16; s16; s16} typedef as the 800FB218/290
  pair, so it call-graph- and idiom-links this state cluster to that pair
  (same-TU, address-apart so low)

---

## `ovl_11` D_8012A028 formatted-number text-buffer cluster — 0x800FC358–0x800FE558 (confidence: medium)

Candidate same-TU family of `ovl_11` (`Obj\GF_FARM.bin`) sharing the overlay
s16 scratch buffer `D_8012A028` as the number/string staging area for text
rows. Evidence is a shared-global cluster plus a shared format/draw idiom; the
buffer is overlay data (0x8012A028, 16 halfwords) and is declared locally as
`extern s16 D_8012A028;` (not in `globals.h`), absolute-addressed (`lui`+`%lo`,
no gp-rel in this container). The nine sites below are the only references to
`D_8012A028` outside the data segment.

Fingerprints:
- shared buffer `D_8012A028` (0x8012A028): every member passes it as the
destination to exe helper `func_8001A970` (the number formatter), writes the
`0xFFFF` halfword terminator at the returned cursor (`ori $v1,$zero,0xFFFF;
sh $v1,0($v0)`), then draws the buffer with `func_80017B3C` at
`D_8005E3C0->field_D8 + 0x54`; some members also seed `0xFFD`/`0x90`/`0x71`
marker halfwords directly;
- link-order spread 0x800FC358–0x800FE558, non-gapless (interleaved
non-members 0x800FC320, 0x800FC544, 0x800FD33C, 0x800FE54C), so the tie is the
shared-global/idiom cluster, not adjacency.

Members (address order):
- ovl_11_func_800FC358 (s) — multi-row display builder; calls
  `func_80015EE8` / `ovl_11_func_800FE7FC` / `func_80017B3C`, formats
  `D_8012CDE6` into `D_8012A028` via `func_8001A970`
- ovl_11_func_800FC5F4 (s) — formats `D_80127264+2` into `D_8012A028`
  (`func_8001A970`, 3 digits + `0xFFFF` terminator), draws via
  `ovl_11_func_800FC544`
- ovl_11_func_800FC6A4 (m, matched this session, byte-exact) — same shape over the stride-4 `D_80127220` table
  (2 digits, `0xFFFF` terminator), draws via `ovl_11_func_800FC544`; the
  table's `{u8,u8,s16}` stride-4 record type (`Ovl11D80127220Entry`) is now in
  `globals_override.h`
- ovl_11_func_800FCAF4 (m, matched this session) — clamps its s16 argument to
  999, formats 3 digits into `D_8012A028`, writes the `0xFFFF` terminator,
  draws at `D_8005E3C0->field_D8+0x54` via `func_80017B3C`
- ovl_11_func_800FD21C (s) — seeds `D_8012A028` halfwords (0x90@0, 0xFFD@2,
  0x71@8, 0@0x10, 0x26@0x12, 0x24@0x14, `0xFFD` fill at +0x1C) and runs two
  `func_8001A970` transports
- ovl_11_func_800FD3CC (s) — row builder: formats object field `+0xB4` into
  `D_8012A028` via `func_8001A970`, calls `ovl_11_func_800FC7F0` /
  `ovl_11_func_800FE558`
- ovl_11_func_800FD5E8 (s) — string/table draw over `D_80054BBC` /
  `D_80053636`; writes `0xFFD` into `D_8012A028+2` and draws via
  `func_80017B3C`
- ovl_11_func_800FE3A0 (s) — reads the `D_80127214` halfword table and
  transports a computed s16 into `D_8012A028` via `func_8001A970`
- ovl_11_func_800FE558 (s) — formats 0xE digits into `D_8012A028`, writes the
  `0xFFFF` terminator, scans the buffer for `0xFFD`, draws at
  `D_8005E3C0->field_D8+0x54` via `func_80017B3C`

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
- the arg0 object view {u16@0x24, s16@0x2A, s16@0x30, u16@0x7A} now has a
  second matched reader in `ovl_11_func_800D04D4` (which reads the
  {s16@0x24, s16@0x30, u16@0x7A} subset and the same far-state gate, but
  not +0x2A); the remaining callers (`ovl_11_func_8010F80C`,
  `ovl_11_func_8010FBC4`) are stubs. The view is an overlay-wide data tie at
  this confidence, not evidence of shared link order.

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
BA18, BA5C, BAC4, BB28, BB88) keep the same link-order run. The run's tail
reaches a further adjacent object: func_8001BB88 (m) reads the GTE rotation
matrix into D_80061E88, the next global past the D_80061DE8 object, matching
the same adjacent-data fingerprint as the .E28/.E48/.E68 siblings.
Members:
- func_8001B530 (m, 2026) — setup entry: GTE origin/screen, then the two
  helpers, then memset+init of the .E28/.E48/.E68 sibling objects
- func_8001B9F8 (m) — writes D_80061DE8 fields 0/4/8/0x18/0x1C
- func_8001BA40 (m) — writes D_80061DE8 fields 0xC/0x10/0x14/0x1C
- func_8001BB88 (m, 2026-10) — gte_ReadRotMatrix into the adjacent
  D_80061E88 object (single SDK GTE read idiom)

## projected primitive clipping — 0x8001BFEC–0x8001D348 (confidence: medium)

GTE-projected triangle/quad rendering and screen-X rejection. Fingerprints:
func_8001C37C directly calls both adjacent bounds helpers four times each;
both helpers consume packed GTE SXY words loaded from primitive X/Y pairs and
test the signed low-half X coordinate against the same screen interval.
The preceding func_8001BFEC ends exactly at 0x8001C0D4. Both use
PushMatrix/PopMatrix, call func_8001D6B8 and func_8001C37C, and pass the
primitive origin at descriptor+0xC together with a 0x1C-stride entry. Both
use the independently classified scratchpad-stack switching idiom; this is
shared rendering machinery plus adjacency, not a proven TU boundary.
Members: func_8001BFEC (m) — batch driver: publishes D_8005E4D8, optionally
runs func_8001D6B8 under the D_8005E2D4 guard, and renders each primitive on
the scratchpad stack; its counter-based entry guard yields the original
saved-register allocation. func_8001C0D4 (m) — GTE camera/view driver
(PushMatrix/PopMatrix), caller of func_8001C1C0 and func_8001C37C, plus
func_8001D348/func_8001D6B8; func_8001C1C0 (m) — camera-to-point direction via
VectorNormalSS tested against 4 planes, read by sole caller func_8001C0D4
(address-adjacent, shares the GTE vector idiom; owns D_80061EC8 camera +
D_80061EA8 plane coefficients); func_8001C37C (s) — projected primitive
renderer/caller; HasTriangleVertexXInBounds (m) — three-vertex X bounds
helper; func_8001D2D8 (?) — four-vertex X bounds helper. func_8001D348 is
the first following function and may mark the next TU; membership unverified.

## u16 string library — 0x80017D9C–0x80017F88 (confidence: medium)

Library-like family of 0xFFFF-terminated u16 string routines. Earlier members
were recorded as unreferenced, but 80017F30 has two original calls from
ovl_11_func_80104EC8, at 801050CC and 80105180. Reachability therefore does
not support the earlier claim that this entire interval was pulled in unused.

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
- func_80017F30 (m, 0x58) — three-buffer comparison: advances when the first
  element matches either other buffer, returns zero at its FFFF terminator,
  otherwise compares first versus second. Gapless after 17EE4, with the same
  u16/sentinel idiom. Two user-authorized raw/carry bindings preserve its
  required copy; those bindings are not original-TU evidence.

References: notes/research/func_80017E34-shared-web-global-allocno.md
(apply the shared-variable shape to func_80017EA0 when decompiling it),
notes/retros/2026-08-28-func_80017E34-retro.md.

## unknown group A — 0x8001DFD4–0x8001E26C (confidence: low)

Address-adjacent block preceding collision.c; none of its functions touch
the collision cluster (checked 2026-07-31), so the file boundary likely
falls between func_8001E26C and SetVal8005E51C. No positive grouping
evidence yet — recorded to mark the boundary question.
Adjacency/call update (2026-10-07): func_8001DFD4 (0x78) ends exactly where
func_8001E04C begins, and func_8001E04C calls it (`jal` at 0x8001E070), so
the boundary question now begins at 0x8001DFD4. The callee is the
cross-container GTE helper also called from ovl_11/ovl_25, so this
constrains where the boundary can fall without proving same-TU membership.
Members (address order): func_8001DFD4 (m) — GTE rtps point transform:
projects an SVECTOR, writes the unpacked x/y pair to arg0, returns OTZ>>2
(0 when the flag is negative), baseline flags; func_8001E04C (s),
func_8001E088 (s), func_8001E0B8 (m), func_8001E158 (m), func_8001E160 (m),
func_8001E26C (s).

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
- func_8001202C (s), func_80012098 (s), func_8001231C (m) — share D_8005E3B0
- func_80012598 (m) — graphics-heap carve and double-buffer/ordering-table
  init over D_8005E5E8[2]; owns D_8005E3B0/B8/BC gp-relatively. Its second
  loop is the same source as func_8001E160 in another TU (see "unknown
  group A"). notes/research/func_80012598.md
- func_8001231C (m) — the second-configuration twin of func_80012598: same
  0x40 frame, same memset(0x801BE1B0, 0, 0x3EE50) carve, and a first loop with
  an identical 21-web store partition. Differs only in the 0x801F7000 /
  0x2EE0 constants and in calling func_8001E160 where func_80012598 inlines it.
  Byte-exact and fully finalized in the parked-function campaign, retaining
  the historical allocation-forcing implementation under the user's explicit
  source-policy authorization. This is not a claim that the original source
  pinned registers. Recipe: notes/research/func_8001231C.md; authorization and
  verification: notes/techniques-for-solving-parked-functions.md.
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
- ovl_11 by-value struct-slice run — 0x8011D890 / 0x8011D934 / 0x8011D98C /
  0x8011D9B4 / 0x8011D9DC, zero-gap link run (0x8011D890 0xA4 → 0x8011D934
  0x58 → 0x8011D98C 0x28 → 0x8011D9B4 0x28 → 0x8011D9DC 0xF8).
  The D934/D98C/D9B4 members take the same 0x60-byte struct by value (StructD548; s16 selector at 0x5C, first
  16 bytes ride $a0-$a3 and are spilled to sp+0..0xC, the rest placed in
  the outgoing stack area), the by-value record behind the zero-init
  D_8012D548 global which abuts the documented D_8012D524/D_8012D52C
  cluster one row up:
  - ovl_11_func_8011D890 (m) — adjacent scan leaf with a 0x64-byte by-value
    view: selector at 0x5C and extra mode word at 0x60. Scans up to nine
    wrapped positions forward/backward and returns the first nonzero word's
    position. Fully finalized with one explicitly user-authorized mode-register
    workaround, no flag change. Original calls at 8011D804 and 8011B66C
    witness clients D734/B2B0. This is a related prefix layout, not a claim
    that its larger argument type is identical to StructD548.
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
- ovl_11 80114604-hub zero-gap link successor — ovl_11_func_801152BC (m,
  matched this session) is a small economy leaf that begins exactly where its
  sole caller ovl_11_func_80114604 (stub, above) ends (0x80114604 + 0xCB8 →
  0x801152BC, no unrelated code between), reads s16 +0x8/+0xA of its arg, and
  forwards `-(unkA*unk8)` plus `2,unk8` to the counter leaves 0x800F2354 /
  0x800F397C — the first is a callee of 0x80114604 too. Ties the 80114604 hub
  (already the stub caller of the D_8012D548 by-value run and the D_8012D520
  bridge above) to a matched link-successor. Link order + shared callee; data
  TU ownership unconfirmed.
- ovl_11 counter-leaf forwarding twin — ovl_11_func_80115C60 (m, matched
  this session) is byte-identical to ovl_11_func_801152BC (above) except its
  second callee: same s16 +0x8/+0xA view, same `-(unkA*unk8)` first argument
  to 0x800F2354, and `2,unk8` forwarded to counter-leaf 0x800F3AF0 in place of
  0x800F397C. Ties 80115C60 to the 801152BC idiom/struct cluster across the
  0x5D49C/0x5DE40 link gap; zero-gap successor 0x80115CAC is a stub. Shared
  idiom + struct layout; data TU ownership unconfirmed.
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
- ovl_11 nested static-chain pair — 0x800F5108 / 0x800F5160, zero-gap
  link run (0x800F5108 0x58 ends exactly at 0x800F5160). ovl_11_func_800F5160
  (m, matched this session, 0xB0, byte-exact) declares ovl_11_func_800F5108
  block-locally (`auto ... __asm__`) and materializes `$v0 = $sp + 16`
  before its single `jal` — the same nested-function static-chain seam as
  the EAE4/E878/E9F8 and 0x8011D438/0x8011D474 families — while the
  callee 0x800F5108 carries the matching CAPTURE_PREV_RET incoming-`$v0`
  capture. Zero-gap link order + call edge + static-chain seam agree, so
  the pair shares one original nested-function TU (medium).
- ovl_11 6-byte struct-copy helper run — 0x800F7E38 / 0x800F8404 /
  0x800F8480 / 0x800F84D4 (confidence: low): the orchestrator
  ovl_11_func_800F7E38 (stub) calls three link-adjacent leaf helpers that
  form a zero-gap run 0x800F8404 (0x24) → 0x800F8428 → 0x800F8480 (0x54) →
  0x800F84D4 (0x1c) → 0x800F84F0: ovl_11_func_800F8404 (m, matched this
  session — leaf 0/1/2 clamp-ish utility, region-shared, called seven times), ovl_11_func_800F8428 (m, matched this session — the run's accumulate-and-clamp helper sitting between 8404 and 8480: adds the halfword at +0x4 of its two argument objects, stores the sum back at +0x4 of arg1, and on a sum of 100 or more clamps arg1's +0x4 field to 99 while moving the excess onto arg0, otherwise calls the clear helper 0x800D5740 — same offset-0x4 halfword as the run's operands and the same 0x800D5740 callee the orchestrator 0x800F7E38 invokes directly; its caller 0x800F8188 also calls 8404), ovl_11_func_800F8480 (m, matched
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
  spans two matched sites across two link regions (low). The same widening holds
  for the run's accumulate-and-clamp shape: freshly-matched
  `ovl_11_func_800FB404` (this session, byte-exact, 22/22 words) is byte-identical
  to the run's 0x800F8428 — same +0x4 halfword accumulate, same 100-clamp with
  excess moved to arg0, same 0x800D5740 callee — and likewise lives in the
  0x800FBxxx region (at 0x800FB404, beside the 0x800FB3E4 predicate and the
  0x800FB45C swap site). Same-TU membership with 0x800F84xx unproven (low).
- ovl_11_func_800F8188 (m, matched this session, byte-exact; link-adjacent to
  0x800F8224 in the same 0x800F81xx/0x800F84xx region) — the run's
  caller/dispatcher: it takes the 0x800F8404 level result, and when that
  level is 2 (or the 0x800D583C type is 2) re-tests the type and otherwise
  invokes the run's accumulate helper 0x800F8428 on the same two object
  pointers, confirming the 0x800F8404→0x800F8428 call pair recorded above.
  Call-graph + same-region agreement only; TU membership unconfirmed (low).
- ovl_11_func_800F8224 (m, matched this session, byte-exact, 0xD8) — the
  region's 6-byte-record compaction helper and a zero-gap link member of the
  gapless 0x800F8188 (ends 0x800F8224) → 0x800F8224 (0x800F8224–0x800F82FC) →
  0x800F82FC (ends 0x800F8404) → 0x800F8404 run: it scans the same
  {s16; s16; s16} records (its own local `CopyStruct` typedef, same unaligned-4
  + halfword block-move copy as the 0x800F8480/0x800F84D4 helpers), moving the
  next non-empty record into an empty slot and clearing the source with
  memset(6); called by the unmatched orchestrator 0x800F7AA0 (jal at
  0x800F7CF8). Shares the region's struct-copy idiom and zero-gap link order;
  TU membership with the 0x800F84xx run unconfirmed (low).

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

Member: func_800199F8 (m) — right-aligned width/render wrapper; its final
  80011F5C work-base result is consumed by 80019AD0. Restoring that scalar
  return leaves all 54 original words unchanged.
Member: func_80019AD0 (m, 0x1EC, byte-exact, finalized) — caller of
  func_800199F8; ends the same contiguous no-gap run. The exact family transfer
  from 80019610 changes only that call target, including the natural aggregate
  copy, marker scan and incoming signed-halfword y update.
  func_80019AD0 is byte-identical to func_80019610 (each a 0xA0-frame 9-arg text-width/
  sentinel-scan body; the only difference is the callee: func_800199F8 vs func_800197FC),
  and siblings func_800199F8/func_800197FC are the twin width-measuring wrappers — so the
  two callers (func_80019AD0, func_80019610) and their two callees form one
  self-contained module group. func_80019610 ends exactly where func_800197FC begins.
Member: func_80019610 (m, 0x1EC, byte-exact, finalized) — scans an 82-byte
  aggregate copy of a 41-halfword text window, replaces the 0xFFFE break
  marker by 0xFFFF, stops on 0xFFFF, and calls 800197FC once per row while
  advancing its signed-halfword y parameter by the incoming row step.
  The shared aggregate/scan and exact call-target-only twin strengthen this
  local family relation, not TU membership from shape alone.
Member: func_800197FC (m) — same width-measuring shape, but x is
  `(s16)(arg3 + ((arg5 - func_800198E0(...)) / 2))`; ends at exactly
  0x800198E0 where func_800198E0 begins (zero gap), and is itself
  called by matched func_80019610 (0x80019610, which ends
  exactly where func_800197FC begins). The caller consumes its final
  func_80011F5C(0) work-base result; restoring that scalar return preserves
  all 57 words. Same internal-callgraph + zero-gap adjacency fingerprints
  as func_800199F8.

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
TU): 800BE2C4, 800C580C, 800C69B8, 800C74AC, 800CBD78, 800CC7CC,
800CCF58, 800D12B8, 800D196C, 800E93CC. 800D736C is now matched (byte-exact
clean C, baseline flags) and confirmed to use the run's exact accessor idiom
— exactly two D_8006C858 references (lui/%lo pair), the same
`*40 = (idx*4 + idx) << 3` multiply chain, and the lhu flags read with
bit-test dispatch — but sits ~0x12DC above the run tail 0x800D6090 with no
adjacency, so it stays a scattered sibling; its zero-gap adjacency instead
ties it to the vector-setter run ending at 0x800D7348 (see that entry).
800C8764 left this scattered list this session: its
`Recon_ovl_11_func_800C8334_A0View` gate and the run call edge place it in the
0x38/0x3C state-switch run above.

---
## `ovl_11` D_8006C838 +0x8000 split-base gapless run — 0x800CF748 / 0x800CF848 / 0x800CF95C / 0x800CFA48 (confidence: medium)

Gapless link-order run: 0x800CF748 (0x100) ends exactly at 0x800CF848
(0x114), which ends exactly at 0x800CF95C (0xEC), which ends exactly at
0x800CFA48 (0x88). All four share the callee pair
`ovl_11_func_800CE744(_, -1)` and `func_80012A34` plus the three-word output
object at +0x38/+0x3C/+0x40; the two lower members also consume the adjacent
D_80123920/D_80123940 record block (800CF748 reads D_80123920, 800CF848
walks D_80123940, which begins where D_80123920 ends), and the two lower
members read the same 0x800A0466 s16 cell through different bases
(800CF748 as D_8007AFF0+0x25476, 800CF848 as D_8009AFF0+0x5476). The upper
three touch the main-binary D_8006C838 flags/state buffer and reach their
large-offset
cell through the cluster's +0x8000 two-stage split. 800CFA48 is already a
member of the D_8006C838 flags/state-buffer cluster above (data tie only);
this run supplies the link-order adjacency that cluster lacked, so
membership is asserted here for the four run members.
Members (address order):
- ovl_11_func_800CF748 (m, matched this session, byte-exact) — head: switches
  on the D_8007AFF0 +0x25476 s16, copies the D_80123920 block's 0x1F half
  (offset 0) or 0x1B half (offset 0x10) into a stack local, then fills the
  shared +0x38/+0x3C/+0x40 output object and the +0x22 u16 with
  `func_80012A34(2) ? 0 : 3`.
- ovl_11_func_800CF848 (m, matched this session, byte-exact) — head: walks
  the six-entry D_80123940 24-byte record block, gated on the shared
  0x800A0466 s16 (D_8009AFF0+0x5476) and the D_8006C838 +0x8000 +0x19D8
  cell, then calls `ovl_11_func_800CE744(entry, -1)`, writes the returned
  record's +0x38/+0x3C/+0x40 words, and sets the +0x22 u16 from
  `func_80012A34(2) ? 0 : 2`.
- ovl_11_func_800CF95C (m, matched this session, byte-exact) — sibling leaf:
  gates on the +0xE4C8 s16 (via the +0x8000 split), on `func_80012A34(0x32)`
  and on the +0x44BA s16, calls `ovl_11_func_800CE744(arg1 == 1 ? 0x156 :
  0x157, -1)`, fills +0x38/+0x3C/+0x40 from a 16-byte by-value argument homed
  to $a0-$a3 ($0x0-$0xC), and writes the +0x22 u16 from the +0x5200 cell
  (arg1 == 1) or from `func_80012A34(2) ? 0 : 3`.
- ovl_11_func_800CFA48 (m) — tail: listed in the flags/state-buffer cluster
  above; gapless successor of 0x800CF95C, shares `func_80012A34` and the
  +0xE4C8 cell.

---
## `ovl_11` D_8006C838 flags/state-buffer cluster — 0x800BCF28 / 0x800BFD04 / 0x800CBE14 / 0x800CD3C4 / 0x800D12A0 / 0x8010C4B0 / 0x800F00AC / 0x800F2354 / 0x8010C1C0 / 0x800E953C / 0x800E63C8 / 0x800E7954 / 0x800DE76C / 0x800DE46C / 0x800EFA1C (confidence: low)

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
- ovl_11_func_80111A60 (m, matched this session) — reads the s16 at +0x44BA
  (the `D_80070CF2` alias) and the +0x44C0/+0x44C2 pair through one
  `&D_8006C838` struct base (`struct_8006C838_button`), computes
  `(field_44C0 - arg)*0x3C + field_44C2` into the file-scope s32 `D_8012D0E8`
  (clamped at 0x71), and forwards `&D_8012D088`/`&D_8012D0A8` to
  `func_8001F664`; the same +0x44C0/+0x44C2 `*0x3C` position pair as
  ovl_11_func_800E99EC and ovl_11_func_800C087C; byte-exact clean C, baseline
  flags
- ovl_11_func_800D12A0 (m) — s16 setter at +0x99E6 via the +0x8000 split
  (already documented as the D_80123754 run head)
- ovl_11_func_8010C1C0 (m, this session) — copies four s32 fields from arg0
  (+0x100/+0x104/+0x108/+0x10C) into the contiguous span +0x92D4..+0x92E0 of
  the same buffer via the same +0x8000 two-stage split (base+0x8000, disp
  +0x12D4..+0x12E0); leaf, byte-exact clean C, baseline flags; link-immediate
  predecessor of stub 0x8010C1FC, two stubs before the D_80075854 run head
  0x8010C330
- ovl_11_func_8010C4B0 (m) — sets bit 0 of the u16 at +0x91A8; link-immediate
  successor of matching 0x8010C3F8, which tests/clears the same bit through
  the shared `u16 *p = (u16 *)D_8006C838; p[0x48D4]` access form
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
- ovl_11_func_800E7954 (m, matched this session) — s16 mode setter: zeroes the
  s32 at +0x448C, then writes the mode word at `D_8007AFF0`+0x254A0 (0x12-0x16,
  0x1F) and, for mode 5, sets bit 0x400 of the sibling +0x5234 word (the same
  cell as 0x800E953C/0x800E63C8), while mode 1 zeroes six bytes at
  +0x19..+0x1B of both 0x134-stride `D_8005E5E8` elements; fixes
  `&D_8006C838` in a struct-view cast so cc1 keeps one `lui %hi(D_8006C838)`
  fragment across the switch and re-splices `%lo` in the mode-5 arm — the same
  shared-base idiom as 0x800E63C8; leaf, byte-exact clean C, baseline flags;
  link-sits in the 0x800E5A1C–0x800EExxx accessor band
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
  0x800F00AC/0x800F2508. Separately matched 800DDDBC shifts three pairs
  upward through the four-slot +49C4..+49E0 history and clears the first pair;
  its two current words are exactly these +49C4/+49C8 accumulators. This is a
  corroborated storage/layout link, not evidence for placing that distant
  function in this run's original TU. Its split-address assembly/register
  bindings are explicitly authorized matching workarounds.
- ovl_11_func_800F2724 (m, matched this session) — dialog/record-advance leaf:
  reads the s8 sentinel at +0x49E6; when it is not -1, calls 0x80022738 then
  func_8002261C(s8@+0x49E6, s16@+0x49E4), and on a 0 result sets the ovl_11 data
  global D_80126C94 = 1 if s16@+0x49E4 == 0x19B, memmoves 0x4C bytes from
  +0x49E8 to +0x49E4, and stores -1 at +0x4A32, returning 1 (0 otherwise); 0x8C,
  byte-exact clean C, baseline flags; fixes `&D_8006C838` in the cluster's
  shared `base = (char *)&D_8006C838` pointer (one `lui` + `addiu %lo`, all
  accesses constant-displacement), and its +0x49E6 byte sentinel / +0x4A32 byte
  store sit in the same buffer region as sibling 0x800F2508's +0x49E6/+0x4A36
  fields, in the same 0x800F2xxx link band as 0x800F2354/0x800F2508
- ovl_11_func_800F27B0 (m, byte-exact, finalized) — appends a halfword / signed
  byte / day-byte entry to the 20-entry stride-4 queue at +0x49E4. The -1
  byte-at-2 empty marker and 0x4C-byte memmove span independently corroborate
  the queue shared with 800F2724; when full it shifts entries toward the head
  and writes the last entry at +0x4A30. The original alias D_8007121C is
  D_8006C838+0x49E4. Reads the s16 day at +0x44BC. Gapless link successor of
  800F2724 and predecessor of 800F2880; caller edges from 800F2538/800F2620
  reinforce this local queue run, without proving an original TU boundary.
- ovl_11_func_800F2880 (m, 0x9C, finalized) — removes an indexed entry from
  either queue (D_8007121C at +49E4 or adjacent D_8007126C at +4A34), shifts
  following entries with SDK memmove and clears the final entry's kind/value/day
  fields. Shared 20-entry stride-four layout and -1 kind marker corroborate the
  F2724/F27B0 queue family; gapless after F27B0. Three register bindings are
  explicitly user-authorized workarounds, not original-TU evidence.
- ovl_11_func_800F45A4 (m, matched this session, byte-exact) — loads the +0x8000+0x5DB4 entity slot and
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
- ovl_11_func_800BFEA4 (m, matched this session) — the caller of the
  7-halfword reset helper 0x800BFF50: walks the 0xE-stride 40-entry object
  array `D_80128820` (u8 base, countdown from 0x27) calling it on each entry,
  then points `D_80128A80` at `D_80125E88`; 0x54, byte-exact clean C, baseline
  flags; second matched reference to `D_80128A80` (after 0x800BFF00) and its
  0x80128xxx data-region sibling, and the zero-gap-adjacent neighbour sitting
  0x58 before 0x800BFF50 in link order
- ovl_11_func_800BFE3C (m, matched this session) — writes the +0x8000
  work-area s32 at +0x6768 via the cluster's two-stage split from the result
  of `ovl_11_func_800C0010(1, &D_80128A80[idx * 3])`; third matched
  `D_80128A80` reference and the zero-gap link-order predecessor (0x68) of
  matched 0x800BFEA4
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
- ovl_11_func_800DE76C (m, matched this session) — flag-bit set/clear leaf:
  tests the +0x44BA/+0x44BC s16 pair through ovl_11_func_800C1224, then sets
  or clears bit 0 of the s32 at +0x4450, via the cluster's shared
  `base = (u8 *)&D_8006C838` idiom; proves the symbol-map names
  D_80070C88 / D_80070CF2 / D_80070CF4 are aliases of +0x4450 / +0x44BA /
  +0x44BC (tying the ovl_11 button-check leaves 0x800F1BD0 / 0x800CE5FC /
  0x800D2E20 / 0x800F581C to the buffer) and shares callee 0x800C1224 with
  member 0x80107B84
- ovl_11_func_800DE46C (m, matched this session) — gated state-set leaf:
  if func_8001AF44(0x49) is set, copies the u16 at +0x44CA onto +0x51F4,
  ORs bit 2 into the s32 at +0x4450, then calls ovl_11_func_800C087C(0x168)
  and func_8001AF70(0x49, 0); byte-exact clean C, baseline flags. Same
  `base = (char *)&D_8006C838` shared-base idiom and the same +0x4450 flag
  word as member 0x800DE76C (proves the `D_80070C88` alias) and the same
  +0x44CA → +0x51F4 copy pair as ovl_11_func_800CD624's sub-base form
  (`&D_80071A00` - 0x51C8), tying `D_80070D02` to +0x44CA and `D_80071A2C`
  (map name `D_80071A22`+0xA) to +0x51F4
- ovl_11_func_800CFA48 (m, matched this session) — gated bit-set leaf: after
  two `ovl_11_func_800D3230` probes, reads the s16 at +0xE4C8 via the
  cluster's +0x8000 two-stage split (base+0x8000, disp +0x64C8; same cell as
  member 0x800BFD04), gates on the +0x44BA s16 (the +0x44BA/+0x44BC pair) and
  on `func_80012A34(0xA)`, then ORs 0x800000 into the s32 at +0x44F8 (new
  offset); byte-exact clean C, baseline flags
- ovl_11_func_800EFA1C (m, matched this session) — progress-gate leaf: reads
  the u8 at +0xE642 (new offset) through the cluster's +0x8000 two-stage split
  (base+0x8000, disp +0x6642) and gates it on `func_8001AF44(0xC9)` and
  `func_8001AF44(0x20)`; byte-exact clean C, baseline flags
- ovl_11_func_800C3F6C (m, matched this session, byte-exact) — message-dispatch
  leaf: when arg1->s16@+2 == 0, `func_8001AF44(0xA0) != 1` and the s16 at
  +0x52C6 (the `D_80071AFE` alias proved by member 0x800E63C8) equals
  arg0->s16@+0x2E, it calls member 0x800F3D88 — its **sole** caller, which in
  turn reads and zeroes the s32 at +0x49C0 (via its `p = base + 0x498C` u16
  pointer, `p + 0x1A`) that this leaf selects on — then
  `func_8002261C(1, 0x72B/0x72C/0x72D)` by that pre-call value (0 / <0x2710 /
  else); same `base = (u8 *)&D_8006C838` shared-base idiom
## `ovl_11` 0x800E6AB0–0x800E6DFC var/return state run (confidence: low)

Zero-gap link-order run of six ovl_11 functions sitting between the
+0x5234/+0x51FE flag-byte accessor band and the D_8006C838 accessor band. Three
members share the same register-variable return idiom — `s32 var = 0;` then an
if/else-if chain, then `return var;` — and each sign-extends a small-integer
argument. Member 0x800E6B18 calls the run's own 0x800E6BDC, 0x800E6CAC and
0x800E6D2C, so call graph and link order agree on the run. Member roles:
- ovl_11_func_800E6AB0 (m) — CD-music guard: returns 1 early on `D_8006C904`,
  else `func_80021B90(arg0)` or `func_80021B64()` sets `var_s0`.
- ovl_11_func_800E6B18 (m, byte-exact this session) — state-slot dispatcher:
  reads the same D_8007AFF0 +0x2549C state s32 as 800E6BDC/801047FC through the
  run's `far_base` split-address idiom, then reinitialises via 800E6BDC
  (arg2 == 1) / 800E6CAC (arg2 == -1) and 800E6D2C(1, 0x30, 1, 0).
- ovl_11_func_800E6BDC (m, matched this session) — sound-state reinit: gates
  on the D_8007AFF0 +0x25388 far-buffer pointer and the +0x2549C state value,
  then `func_80020818()` + `func_8001FB30()`.
- ovl_11_func_800E6CAC (m, matched this session) — state toggle: `arg1 == 0`
  → `func_8001FE34(arg0 ? arg0 : 10)`; else `func_8001FE6C() == 0 || arg1 == 2`
  → `func_8001FBBC(0)` and return 1; otherwise return 0.
- ovl_11_func_800E6D2C (m, matched this session, byte-exact) — mode
  dispatcher: on `arg2 != 0` calls the run's D_8006C838 sibling 0x800E63C8
  (4-argument form — the target clears a2 and a3 before the jal, so the
  caller TU declares the full interface), then dispatches through
  func_800132B8 / func_800132F0 selected by `arg0 & 1`, else returns
  `func_80013394() == 1`; s16-argument sign-extension as the run.
- ovl_11_func_800E6DFC (m, matched this session, byte-exact) — `D_8006C904`
  flag check → `func_8001AF70(3, 1)` / `func_8001AF70(3, 0)` then state call
  `ovl_11_func_800EAF5C(var_s0)`; same `var = 0; if/else-if; return var`
  idiom and s16-argument sign-extension as the run.

Widening (2026-10-06, byte-exact match of `ovl_11_func_800E6BDC`): the run's
remaining unmatched member is now a matched role with the same audio/state
call cluster as 800E6AB0/800E6CAC and the same s16-argument gate; it reads the
`D_8007AFF0` far-buffer pointer slot +0x25388 and state s32 +0x2549C shared with
`ovl_11_func_801047FC`, which keeps the run's shared-global
fingerprint but still does not prove TU membership.

## `ovl_11` D_8006C838 +0x7A78 halfword-record table — 0x800DBB94 / 0x800DBF60 / 0x800DBE9C (confidence: low)

Scans and a shift over the same main-binary 5-entry record table — absolute
`lui %hi(D_8006C838)` + `%lo` base, element offset 0x3D3C (byte 0x7A78), stride
6 s16 (0xC bytes), first s16 is a -1 empty sentinel; same strength-reduced
pointer walk. Shared idiom + shared-global fingerprint; the shift member
ovl_11_func_800DBE9C is address-adjacent (0x3E8 below 0x800DBB94 in the
0x800DBAB0–0x800DC0A0 record-family band) and callee-linked (its callers
ovl_11_func_800DBE30/ovl_11_func_800DBEF8 are both called by the band head
ovl_11_func_800DBAB0, now matched, which also reads lh 0x7A78; func_800DBD78
calls ovl_11_func_800DBB94) — shared-global + adjacency + call edges, TU
membership still unproven.
Members:
- ovl_11_func_800DBAB0 (m, matched this session, 0xE4, byte-exact) — the band
  head/selector: guards the D_8006C838+0x10 bit 0x1000, reads the table's
  first s16 at 0x7A78 as the -1 sentinel, publishes the +0x7A78 record base
  at D_8006C838+0x30, drives both reset/gate callers
  ovl_11_func_800DBE30/800DBEF8, then clears the D_8006C838+0x5234 and +0x4450
  flag words — the same per-use `%lo` tail-rematerialization of the D_8006C838
  base from a shared `%hi` (second `&D_8006C838` view) as ovl_11_func_800DBE9C
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
- ovl_11_func_800DBEF8 (m, matched this session, 0x68, byte-exact first try,
  baseline flags) — the reset/gate caller of the shift writer: returns 0 when
  the far state halfword (`D_8007AFF0+0x25476`) equals the s16@0x4 of the
  pointer held at D_8006C838+0x30; otherwise clears the D_8006C838+0x7A74 word
  (the word immediately before the +0x7A78 table), calls ovl_11_func_800DBE9C,
  returns 1 — adds a matched member to the 0x800DBAB0 band and a second call
  edge into the shift writer
- ovl_11_func_800DBE30 (m, matched this session, 0x6C, byte-exact) — the
  sibling reset/gate caller: dispatches `(*D_800B94AC[arg0])(&D_800B94AC[arg0])`,
  on a `!= 1` result calls `func_8001AF70(2, 1)` and returns 0, else calls
  `func_8001AF70(2, 0)`, clears D_800742AC (0x800742AC, the +0x7A74 word of
  D_8006C838 as an absolute symbol), calls ovl_11_func_800DBE9C and returns 1 —
  same `func_8001AF70(2,0/1)` + shift-writer + clear-the-+0x7A74-word shape as
  ovl_11_func_800DBEF8, immediate link-order predecessor of it
- ovl_11_func_800F13D8 (m) — returns 1 when a record's first halfword is zero
  and its second equals the u16 argument. Its apparent `D_800742B0` base is
  this same embedded table; shared data-family evidence, not proof of one TU
  across the separated link regions.
- ovl_11_func_800F12D0 (m, matched this session, 0x84, byte-exact) — the
  record-slot *writer* for this table: calls the slot accessor
  ovl_11_func_800DBC04 (which delegates to ovl_11_func_800DBD78 over the
  +0x7A78 table) and fills the returned slot's u16@+2 with `arg0 & 0xFFFF`,
  u16@+6 with arg1 and u16@+4 with the far state halfword `D_8007AFF0+0x25476`
  — the same far halfword 800DBEF8 reads; returns 0 after filling, else 1 when
  `D_80070C88 & 1` and the low halfword is < 0x12C, or when the slot is null.
  Shared caller `ovl_11_func_800F1078` with the 0x800F13D8/0x800F144C pair.
- ovl_11_func_800F1354 (m, matched this session, 0x84, byte-exact first try) —
  byte-twin of ovl_11_func_800F12D0 (immediate link successor: 0x800F12D0 + 0x84
  = 0x800F1354), identical instruction stream but calls the slot accessor
  ovl_11_func_800DBC28 instead of 800DBC04. The two accessors are themselves
  twins differing only in constants passed to ovl_11_func_800DBD78 — 800DBC04
  = (arg0,1,0), 800DBC28 = (arg0,0,1) — so the pair is a same-table writer
  couple selecting one of two DBD78 modes.
- ovl_11_func_800DBD78 (m, matched this session, 0xB8, byte-exact) — the
  slot allocator over this table: returns NULL early when arg1 == 1 and
  ovl_11_func_800DBB94(arg0) == arg1 (in-group call edge to 800DBB94);
  otherwise scans the first 1 record, or 5 when arg2 == 1, for a -1 tag;
  on a hit clears the tag and the five payload halfwords (countdown bgez
  loop) and returns the record address, else NULL. Confirms the table
  semantics byte-exactly; same shared-`%hi` base + dual-pointer 0x7A7A/0x7A78
  walk + hoisted -1 sentinel idiom as the searchers, in the 0x800DBAB0 band;
  the 800DBBE0/800DBC04/800DBC28 accessors all delegate to it
## `ovl_11` D_80127F88–D_80127FE8 constant-table cluster — 0x80112318 / 0x801123AC / 0x80112A84 / 0x80113A20 (confidence: medium)

One contiguous rodata region in ovl_11 (short tables plus one pointer table),
each slice read by a distinct function inside the unbroken link run
0x80112284–0x80113A20 — a shared-data-cluster tie, not a call edge. All four
slices are currently NON_MATCHING data; the readers below are their only
referencers in the binary.
- ovl_11_func_80112284 (m, matched this session, 0x94, byte-exact) — reads the
  contiguous preceding slice D_80127F80 as a 4-entry s16 table in the same
  advancing-pointer loop shape as 0x80112318/0x801123AC, calling
  ovl_11_func_800F3E00 on each entry; establishes the run's start as a table
  reader tied to the same rodata region
- ovl_11_func_80112318 (m, matched this session, 0x94, byte-exact) — reads
  slice D_80127F88 as an s16 table base in a 4-entry loop, clears bit 0x8 of
  s32 global D_800719F8
- ovl_11_func_801123AC (m, matched this session, 0x94, byte-exact) — byte-twin
  of 0x80112318 (same 0x94 shape; link-contiguous, 0x80112318 ends exactly at
  it), reads slice D_80127F90, masks D_800719F8 by ~0x11
- ovl_11_func_80112A84 (m, matched this session) — reads the 5-entry pointer
  table D_80127FD4 (middle slice) indexed by the s16 at D_8006C838+0xE776 via
  the +0x8000 two-stage split (the D_8006C838 reader idiom of cluster member
  0x8010C4B0); sole caller is link-separate 0x800FB908
- ovl_11_func_80113A20 (s) — reads slice D_80127FE8 as a 0x10-stride table base
  (`lh D_8012D110`, `sll ,4`, `addu`) and also touches D_80128128 / D_80128088

## `ovl_11` D_800719F8 bit-flag family — 0x80112284 / 0x80112318 / 0x801123AC / 0x8011256C (confidence: medium)

Members share the absolute `lui %hi(D_800719F8)` + retained `addiu %lo` base
register and the same bit-clear (mask and) / bit-set (ori via `0x0($base)`) idiom
on the single s32 flag, and all sit inside the unbroken link run
0x80112284–0x80113A20 already recorded for the D_80127F88 table cluster.
- ovl_11_func_80112284 (m, matched this session) — clears bit 0x4, then
  re-sets it only when all four D_80127F80 entries map >= 0x65 through
  ovl_11_func_800F3E00 (the same callee 0x80112440/0x80112494 use)
- ovl_11_func_80112318 (m, matched this session) — 4-entry loop over
  D_80127F88, clears bit 0x8 via the shared &D_800719F8 base register
- ovl_11_func_801123AC (m, matched this session, 0x94, byte-exact) — reads
  slice D_80127F90 via the shared `base = &D_800719F8` spelling, clears ~0x11
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

## `ovl_19` shared arg-record setters and slot-programmer run — 0x800BAC40–0x800BAC9C (confidence: medium)

- ovl_19_func_800BAC40 (m, matched via automatic reconstruction, byte-exact) —
  stores three s32 args into s16 fields +2/+4/+6 of its pointer argument.
- ovl_19_func_800BAC50 (m, matched via automatic reconstruction, byte-exact) —
  same record shape, fields +2/+4 only; gapless with the previous function.
- ovl_19_func_800BAC5C (m) — thin wrapper: `ovl_19_func_800BAC9C(0)`.
- ovl_19_func_800BAC7C (m) — thin wrapper: `ovl_19_func_800BAC9C(1)`.
- ovl_19_func_800BAC9C (m, matched this session, byte-exact) — installs the
  arg0-selected set/clear callback into the overlay-local D_800BD07C slot, then
  applies it to the u16 slots of D_800BF570 (3 steps, stride 0x40) and
  D_800BF4E8 (2 steps, stride 0x48); shared callee of the two wrappers.
- Evidence: identical argument-record layout (shared Ovl19Func800BAC40Arg view
  in include/game_types.h) for the first pair, and a gapless link run —
  0x800BAC40 (0x10) → 0x800BAC50 (0xC) → 0x800BAC5C (0x20) → 0x800BAC7C (0x20)
  → 0x800BAC9C (0xB4) → 0x800BAD50 — whose last two wrappers both sit in the
  documented hub 800B89C8's callee set and whose worker touches the same
  overlay-local 3F54.data.s state region (D_800BF570 is already witnessed in the
  clamp-table run's 800BADF8).

## `ovl_23` shared arg-record setters — 0x800BB0C8 / 0x800BB0D8 (confidence: medium)

- ovl_23_func_800BB0C8 (m, matched via automatic reconstruction, byte-exact) —
  stores three s32 args into s16 fields +4/+6/+8 of its pointer argument.
- ovl_23_func_800BB0D8 (m, matched via automatic reconstruction, byte-exact) —
  byte-for-byte the same body over the same record shape (shared
  Ovl23Func800BB0C8Arg view), gapless with the previous function.

## `ovl_23` D_800BFA90/D_800BF8BC array-pair walkers — 0x800BB0E8 / 0x800BB150 (confidence: medium)

Evidence: both are no-argument functions that walk the same two arrays from one
shared base — `D_800BFA90` and its sibling `D_800BFA90 - 0x1D4` (= `D_800BF8BC`)
— six times, advancing 0x44 and 0x50 bytes per step from the same base-register
preheader; they differ only in the per-slot helper they call. Gapless link order
agrees (0x800BB0E8 + 0x68 = 0x800BB150).

- ovl_23_func_800BB0E8 (m, byte-exact this session) — 6x `func_80015814(slot, 4)`
  (set bits) over both arrays.
- ovl_23_func_800BB150 (m, byte-exact this session) — same walker, 6x
  `func_80015828(slot, 4)` (clear bits); gapless successor.

## `ovl_23` ObjectState reset/handoff leaf — 0x800BB1B8 (confidence: low)

- ovl_23_func_800BB1B8 (m, byte-exact this session) — resets the ovl_23
  ObjectState at `D_800BFC30` via `func_80015840(obj, 5)`, then dispatches
  `func_80015EE8(D_8005E3C0->field_D8 + 4, &D_800BFC30,
  state[4], state[5], 0, 0)` through a base biased by -0x3B4. Gapless
  link-order predecessor of the display-setup run below: 0x800BB1B8 (0x5C)
  ends exactly at 0x800BB214, the run's first member.
- Cross-container note: byte-shape twin of matched `ovl_17_func_800BAF50`
  (D_800BDA74/4) and `ovl_19_func_800BAD50` (D_800BF660/9); that twin
  relation is not TU-membership evidence — only the link adjacency is.

## `ovl_23` D_800BF87C dispatch-index cluster — 0x800B7EA4–0x800B87F8 (confidence: medium)

Evidence: the state dispatcher `ovl_23_func_800B7F00`'s gapless link-order
predecessor `ovl_23_func_800B7EA4` (the ovl_23 code-segment head) dispatches
`((void (*)(s32 *))D_800BB9E4[D_80070CC4])(&D_800BB9E4)`, the same
`base[index](base)` idiom over the adjacent sibling table `D_800BB9F8`
(D_800BB9E4 + 0x14 = D_800BB9F8). Three further ovl_23 functions touch the
state index `D_800BF87C` (s16): `ovl_23_func_800B8084` reads it,
`ovl_23_func_800B850C` stores 1 to it, and `ovl_23_func_800B87F8` takes its
address three times. `ovl_23_func_800B8084` additionally dispatches through
`D_800BB9F8` indexed by that value (`base[D_800BF87C](base)`). All four sit in
one contiguous link-order span running from the code-segment head through
0x800B87F8 (0x800B7EA4 +0x5C = 0x800B7F00, … 0x800B8084 +0x48 = 0x800B80CC, …
0x800B850C, … 0x800B87F8), so the shared tables and the link order agree.

Members (link order):
- ovl_23_func_800B7EA4 (m, byte-exact this session) — `func_80017A64()` saved,
  `func_80017A48(3)`, then `((void (*)(s32 *))D_800BB9E4[D_80070CC4])(&D_800BB9E4)`.
- ovl_23_func_800B8084 (m, byte-exact this session) — `func_800225C4()` then
  `((void (*)(s32 *))D_800BB9F8[D_800BF87C])(D_800BB9F8)`, a no-arg table
  dispatch stub.
- ovl_23_func_800B850C (s) — two calls then sets `D_800BF87C = 1`.
- ovl_23_func_800B87F8 (s) — larger state routine; loads the address of
  `D_800BF87C`.

## `ovl_23` D_8006C838+0x448C counter pair — 0x800B80CC / 0x800B8104 (confidence: medium)

Evidence: gapless link order — `ovl_23_func_800B80CC` is 0x38 bytes and ends
at 0x800B8104, the start of `ovl_23_func_800B8104`. Both take a local
`s32 *base = (s32 *)&D_8006C838;` and touch the same word at +0x448C, and both
belong to the state block read/written by the 0x800B9454/0x800B94D0 pair
(`800B8104` reads the s16 `D_800BFC90`). The cluster sits inside the
D_800BF87C dispatch-index span but neither member touches D_800BF87C.

Members (link order):
- ovl_23_func_800B80CC (m, byte-exact) — calls `func_80013328(10)` and
  `func_8001FE34(10)`, then `base[0x448C>>2] += 1`, returns it.
- ovl_23_func_800B8104 (m, byte-exact this session) — `func_80013394`/
  `func_8001FE6C` state guard, then `base[0x448C>>2] = 0xFF` and
  `base[0xC>>2] |= 0x80000` around `func_80011EF0(6)`.

## `ovl_23` D_800BF87C record init/append run — 0x800B937C–0x800B94D0 (confidence: medium)

Evidence: gapless link order — 0x800B937C + 0xD8 = 0x800B9454 and
0x800B9454 + 0x7C = 0x800B94D0 (consecutive functions in the ovl_23 code
segment). All three write the same 8-byte-record arrays (`{s32,s16,s16}`)
inside the `D_800BF87C` aggregate: `ovl_23_func_800B937C` fills both arrays,
and the append pair shares the identical append idiom `if (cursor >= N)
cursor = 0;` then store the record and increment the cursor, where N equals
the array length. The call graph agrees — `ovl_23_func_800B823C` calls
`ovl_23_func_800B937C` (recorded above). This extends the D_800BF87C cluster
above and shows that symbol is a large record (the dispatch-index s16 sits at
offset 0), not only a scalar index.

Members (link order):
- ovl_23_func_800B937C (m, byte-exact this session) — initialises the
  54-entry +0x418 and 12-entry +0x5CC `(s32, s16, s16)` arrays (first six +0x4
  halves from `D_800BBA40`) and sets both cursors to 6.
- ovl_23_func_800B9454 (m, byte-exact this session) — 54-entry array at
  `D_800BF87C`+0x418, cursor at +0x5C8, bound 0x36 (`(s32, s16, s16)`).
- ovl_23_func_800B94D0 (m, byte-exact this session) — same routine, 12-entry
  array at +0x5CC, cursor at +0x62C, bound 0xC (`(s32, s16, s16)`).

## `ovl_23` D_800BF87C +0x16 unique-draw fill — 0x800B97E0 (confidence: low)

Evidence: `D_800BF892` lies at `D_800BF87C` + 0x16 (0x800BF892 − 0x800BF87C =
0x16), inside the large `D_800BF87C` aggregate whose +0x418/+0x5CC record
arrays, +0x5C8/+0x62C cursors and +0x3B2/+0x39C fields are recorded above. The
function is also gapless between two `D_800BF87C` consumers in link order —
`ovl_23_func_800B954C` (0x172C, ends 0x800B97E0) walks the aggregate from +0x3B4,
and `ovl_23_func_800B989C` (0x800B989C) reads +0x3B2/+0x39C — so the aggregate
address and the link order agree. The run continues gapless past
`ovl_23_func_800B989C` into `ovl_23_func_800B9A00` (0x800B9A00, 0x118, ends
0x800B9B18) and on to `ovl_23_func_800B9B18`: `ovl_23_func_800B9A00` reads the
same aggregate's +0x39C/+0x3A0 s16 fields. The call graph adds nothing (the only
call is the exe `Rand`), so this is address plus adjacency, one fingerprint only.

Members (link order):
- ovl_23_func_800B97E0 (m, byte-exact this session) — fills the six u16 at
  `D_800BF892` (`D_800BF87C` +0x16) with values drawn uniquely from 0..9.
- ovl_23_func_800B9A00 (m, byte-exact this session) — clamps the pointer
  argument's s32 at +0xC around the target `(D_800BF87C.unk39C + 0x77) << 12`
  by `(D_800BF87C.unk3A0 << 12) / 10` steps, using the shared
  `ovl_23_func_800BB0D8` record setter.

## `ovl_23` D_800BF87C screen-record init run — 0x800B823C–0x800B8354 (confidence: medium)

Evidence: gapless link order and the call graph agree over the same
`D_800BF87C` aggregate. `ovl_23_func_800B823C` (0x800B823C, ends 0x800B8290)
clears `D_800BF87C`+0x4/+0x8/+0xC, writes +0x414 = -1, +0x10 = 0x40000 and
+0x14 = 0, then calls `ovl_23_func_800B8290` and `ovl_23_func_800B8354`;
`ovl_23_func_800B8290` writes the 0x44-stride record array at `D_800BF87C`+0x204,
the same aggregate/stride read by the matched `ovl_23_func_800BA1E0` at +0x210;
and `ovl_23_func_800B8354` continues over `D_800BF87C` records (base +0x24/+0x26/
+0x28/+0x2A/+0x2C and +0xA0/+0x140 fields) and also calls the exe selector
`func_80012A34`. The three are one contiguous span, so aggregate, adjacency and
call edge corroborate the same TU.

Members (link order):
- ovl_23_func_800B823C (s) — clears the `D_800BF87C` header, then calls
  800B8290, 800B8354 and 800B937C.
- ovl_23_func_800B8290 (m, byte-exact this session) — fills six 0x44-stride
  records at `D_800BF87C`+0x204 from `D_800BBA7C`, tagging each with
  `D_800BBA88[func_80012A34(4)]`.
- ovl_23_func_800B8354 (s) — `D_800BF87C` record/field initialiser; calls
  `func_80012A34`.

## `ovl_23` display-setup state-handler run — 0x800BB214–0x800BB758 (confidence: medium)

Evidence: the dispatcher `ovl_23_func_800B7F00` (s) selects on the state byte
`D_800BBA3C` via `jtbl_800B7E24` and, from consecutive jump-table branches,
calls `ovl_23_func_800BB214`, `ovl_23_func_800BB488`,
`ovl_23_func_800BB534` and `ovl_23_func_800BB758`. Those four are one gapless
link-order run (0x33F4 +0x274 = 0x3668, +0xAC = 0x3714, +0x224 = 0x3938,
+0x48 = 0x3980), so the call graph and the link order agree — the same
fingerprint recorded for the `ovl_17` display-setup run. The three leading
handlers share the display-setup idiom `DrawSync` → `ClearOTagR` →
`func_80014CBC` → `func_8001719C` (800BB214 additionally `func_80015704`) and
the run closes with the per-overlay audio-setup leaf, mirroring the ovl_17
run's 800BA504.

Members (link order):
- ovl_23_func_800BB214 (s) — display-setup state: DrawSync/ClearOTagR plus
  func_80014CBC/1719C/15704
- ovl_23_func_800BB488 (m, byte-exact this session) — same display-setup
  idiom confirmed: DrawSync(0) /
  ClearOTagR(D_8005E3C0->field_120, 0x800), then `func_80014CBC(0, 0, 0x2000,
  D_8005E3B0 + 0x4290, 1, 1)` followed by the zero-return poll
  `func_80014CBC(..., 1, 0) == 0`, then `func_8001719C(D_8005E3B0 + 0x4290)`
- ovl_23_func_800BB534 (s) — same display-setup idiom
- ovl_23_func_800BB758 (m, matched via automatic reconstruction, byte-exact) —
  audio-setup leaf: `func_80020B80(2,0)`, `func_80020B80(1,0)`,
  `func_8001FBF0(0x3E7,0)`, `func_8001FBF0(0x12,1)`

Cross-container note: the audio-setup call sequence is a twin of
`ovl_17_func_800BA504` (0x15), `ovl_19_func_800BBCCC` (0xF),
`ovl_21_func_800BBA3C` (0x12) and `ovl_30_func_8012F3D4` (0x3E7); as recorded
at those entries, that twin relation is not TU-membership evidence — here only
the dispatcher call graph and the gapless link run are.

## `ovl_23` D_8006C838 record-field setter pair — 0x800BB7A0 / 0x800BB800 (confidence: medium)

Evidence: the two functions are gapless in link order (0x3980 and 0x39E0, each
0x60) and close the ovl_23 code segment — `ovl_23_func_800BB800` ends 0x3A40,
where the overlay's data begins. Both are leaves with the same `void f(s16)`
signature and the same record addressing `(char *)&D_8006C838 + arg0 * 0x1D4 +
0x8000`, and they write adjacent halfword fields of the same record: 0x19EA and
0x19EC. The call graph agrees — `ovl_23_func_800B87F8` calls `800BB7A0` twelve
times in one run and then `800BB800` three times, so the pair is one caller's
adjacent-field accessors. Both are saturating bounded-increment setters (cap
0xFF / 0xFFFF) with a `slti`/`sltu` guard and the store in the return delay
slot.

Members (link order):
- ovl_23_func_800BB7A0 (m) — 0x19EA: `if (field < 0xEB) field += 0x14; else field = 0xFF;`
- ovl_23_func_800BB800 (m, byte-exact this session) — 0x19EC: `if (field <= 0xFE0A) field += 0x1F4; else field = 0xFFFF;`

Cross-container note: the pair is a twin of the ovl_17 pair
`ovl_17_func_800BB394` (0x19EA) / `ovl_17_func_800BB3F4` (0x19EC) at 0x3574 /
0x35D4, byte-identical except for the container's addresses. As with the
audio-setup twin note above, that relation is not TU-membership evidence; here
only the gapless link run and the shared caller are.

## `ovl_23` 2D vector math helper run — 0x800BA1E0–0x800BA368 (confidence: medium)

Evidence: gapless link order in ovl_23 — `ovl_23_func_800BA1E0` (0x98, ends
0x800BA278), `ovl_23_func_800BA278` (0x94, ends 0x800BA30C),
`ovl_23_func_800BA30C` (0x5C, ends 0x800BA368), then this function (0x4C, ends
0x800BA3B4). The call graph agrees: `ovl_23_func_800BA1E0` calls
`ovl_23_func_800BA368` and forwards its result straight to
`ovl_23_func_800BA278`. The two helpers share the s16 (dx, dy) argument style —
`ovl_23_func_800BA30C` squares the deltas and takes `SquareRoot0`, this function
takes `ratan2` and scales to degrees.

Members (link order):
- ovl_23_func_800BA1E0 (m, byte-exact this session) — reads the s16
  selector from a pointer record and indexes the `D_800BF87C` 0x44-stride
  record array at +0x210, computes two `>>12` differences, calls this
  function then passes the result to 800BA278
- ovl_23_func_800BA278 (s) — 0x2D-wide threshold chain mapping an angle to
  small indices 0–7
- ovl_23_func_800BA30C (s) — distance helper: sum of squared s16 deltas through
  `SquareRoot0`
- ovl_23_func_800BA368 (m, byte-exact this session) — angle helper:
  `ratan2(arg0, arg1)`, negative-result wrap by `+0x1000`, then
  `* 0x168 / 0x1000` to degrees

## `ovl_23` D_800BF87C/D_800BBAB4 threshold-selector leaf — 0x800BA3B4 (confidence: medium)

Evidence: gapless link order on both sides in ovl_23 — `ovl_23_func_800BA368`
(0x4C, ends 0x800BA3B4) is the immediate predecessor and `ovl_23_func_800BA494`
(0xE0) the immediate successor of this 0xE0-byte function (splat
`[0x2594, c, ovl_23_func_800BA3B4]`). It reads the same `D_800BF87C` aggregate
as the runs above — a record selected with stride 0x50 and its u16 pair at
+0x30/+0x32, plus s16 thresholds at +0x3A4/+0x3A6/+0x3A8/+0x3AA — and indexes the
s16 `D_800BBAB4` table (row stride 5) through the shared exe selector
`func_80012A34`, the same aggregate + `func_80012A34` pairing recorded for the
screen-record init run. Aggregate, adjacency and call edge agree.

Members (link order):
- ovl_23_func_800BA3B4 (m, byte-exact this session) — s16 pair; computes a signed
  halfword difference from the `D_800BF87C` record selected by arg1, maps it
  through a four-threshold chain to an index 0-3 (else 4), then compares the
  `D_800BBAB4[arg0*5 + index]` halfword against `func_80012A34(0x64)`.

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

## `ovl_11` GTE transform + bounds-gate pair — 0x800F5868 / 0x800F5888 (confidence: medium)

Candidate same-TU pair in `ovl_11` (`Obj\GF_FARM.bin`) sitting gaplessly
immediately before the documented dispatch run (0x800F5944–0x800F6578): a
screen-bounds check and the GTE point-transform caller that uses it.

Fingerprints:
- **address adjacency:** `ovl_11_func_800F5868` (0x20 bytes at 0x800F5868)
  ends exactly at `ovl_11_func_800F5888` (0xBC bytes at 0x800F5888), which
  ends exactly at the dispatch-run head 0x800F5944 — gapless link order;
- **call edge:** `ovl_11_func_800F5888` calls `ovl_11_func_800F5868` to gate
  its transformed (x, y);
- **function-private data:** `D_80129620` (s32[2], transform out) and
  `D_80129628` (s16[4], GTE in) are referenced only by
  `ovl_11_func_800F5888` across the whole build tree (every container's asm
  and all src) — likely static scratch of the original TU;
- **cross-link to the adjacent run:** `ovl_11_func_800F5BC0`, the shared
  engine callee of the documented dispatch run, is a caller of
  `ovl_11_func_800F5888` (functions.csv);
- **callee signature:** `ovl_11_func_800F5888` calls `func_8001DFD4` with the
  two-argument `(s32 *, s16 *)` shape (rtps point transform) also used by the
  matched `ovl_25_func_800BA758` — a cross-container exe-helper idiom, not a
  TU fact.

Members (link order):
- ovl_11_func_800F5868 (m) — screen-bounds check: 1 iff (arg0+0x31) < 0x1A3
  and (arg1+0x31) < 0x153, else 0
- ovl_11_func_800F5888 (m, byte-exact this session) — transform + gate:
  seeds D_80129620 with 0x5DC/0x5DC, copies arg0's first three u16s into
  D_80129628, calls func_8001DFD4; if the result is > 0 and the bounds gate
  passes, stores {x, y, result} into arg1 and returns 1, else 0

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
- **shared signature pattern:** the four matched targets
  (`ovl_11_func_800F64F8`, `ovl_11_func_800F6218`, `ovl_11_func_800F6578`,
  and `ovl_11_func_800F6118`) share the same
  `s32(s32 arg0, s32 *arg1, s32 *arg2)` switch-return-id idiom.

Members (link order):
- ovl_11_func_800F5944 (s) — dispatch head: reads struct id via `lh` at +0xA,
  switches through jtbl_800BA33C, loads target address into $s1, and calls
  ovl_11_func_800F5BC0 with arg codes 1/0xA and the stack-copy path;
  writes back D_8006C838+0x5DD8/0x5DD4/0x5DCC through the callee
- ovl_11_func_800F5BC0 (s) — shared engine callee: takes a callback in $a2
  and calls it with struct-field arguments; invoked by the dispatch head for
  multiple arg codes
- ovl_11_func_800F6118 (m, this session) — dispatch target case 0: leaf
  switch-return-id mapper, selects a byte field 0x0–0x4 of the 5-byte
  `D_80126E18` record indexed by `D_80070CF2` for ids 0x83/0x57/0x64/0x65/
  0xE8/0x122–0x124
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

- **address adjacency:** `ovl_11_func_80112440` (0x54 bytes) ends exactly at
  the `ovl_11_func_80112494` stub, leading the zero-gap run into
  `ovl_11_func_801124E8` (0x84 bytes), which ends exactly at
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
- ovl_11_func_80112440 (m, this session) — file-status flag routine: clears
  bit 0 off `D_800719F8`, then sets it back when
  `ovl_11_func_800F3E00(0x5D) >= 0x33`; the address of the flag word stays
  live across the callee in `$s0`
- ovl_11_func_80112494 (s) — link-adjacent stub inside the run
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

The stubs before the proven run (`ovl_11_func_801123AC`, 80112318, 80112160)
and the `ovl_11_func_8011266C` stub inside the run may extend it; membership is
not yet evidenced. 80112284 is now matched and evidenced into the D_800719F8
bit-flag family above (it uses the direct `base = &D_800719F8` spelling rather
than this group's far anchor arithmetic, so it is not placed here).

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
- ovl_11_func_800F1AE0 (m, matched this session, 0x48, byte-exact) — masked
  caller-side tie to the anchor: `arg0 & 0x3FF` then `func_8001AF44(mask +
  0xFB)`; returns 0 when that equals 1, otherwise returns whether
  `ovl_11_func_800F13D8(mask) == 0`
- ovl_11_func_800F1954 (m, matched this session, 0x74, byte-exact) — same
  masked `func_8001AF44` caller idiom as its link-run sibling: `arg0 & 0x3FF`
  then `func_8001AF44(mask + 0xC8) == 1`, then `(arg0 >> 10) & 0x3FF` then
  `func_8001AF44(mask + 0xC8) == 0`; returns 1 otherwise. It ends exactly at
  0x800F19C8, inside the 0x800F1878–0x800F1AE0 gapless link run that carries
  0x800F1AE0, and both bind the shared callee with the same `0x3FF` mask plus
  constant-offset idiom.
- ovl_11_func_800F1878 (m, this session, 0xDC, byte-exact) — first member of
  that same 0x800F1878–0x800F1AE0 gapless run and the matched caller of
  `ovl_11_func_800F1E44`: fills three `0x3FF`-masked 10-bit fields, then
  applies the `func_8001AF44(mask + 0xFB)` predicate as 0x800F1AE0 does, with
  `one == 1` selecting `!= arg1` over `!= 0`.

## `ovl_11` 0x800F144C–0x800F1744 gapless link run, shared caller 0x800F1078 (confidence: low)

Evidence: one unbroken link-order run — `ovl_11_func_800F144C` (0x8C, ends
0x800F14D8), `ovl_11_func_800F14D8` (0x68), `ovl_11_func_800F1540` (0x74),
`ovl_11_func_800F15B4` (0xC4, ends 0x800F1678), `ovl_11_func_800F1678` (0xCC,
ends 0x800F1744) — and the call graph agrees on a shared caller:
`ovl_11_func_800F1078` is the sole caller of both `ovl_11_func_800F15B4`
(`jal` at 0x800F11D0) and the already-recorded `ovl_11_func_800F144C` (`jal`
at 0x800F1194). The now-matched 0x800F14D8 shares 0x800F144C's masked
halfword arguments, 0x1F sentinels, clamped window and wrapped scan predicate;
its sole caller is also 0x800F1078. This supports the sibling relationship,
not a definitive TU boundary. 0x800F1540 / 0x800F1678 remain unmatched.

Members:
- ovl_11_func_800F15B4 (m, matched this session, 0xC4, byte-exact) — masked
  sentinel-window predicate over `ovl_11_func_800EEBF4(arg0) & 0xFF`
  (arg2/arg3 `0xFF` sentinels; result inverted by the 0x400 bit of the stack
  argument); call edge into the matched 0x800EEBF4 run.
- ovl_11_func_800F144C (m) — see the record-halfword sibling pair entry above.
- ovl_11_func_800F14D8 (m, 0x68, byte-exact) — returns 1 for a 0x1F
  sentinel or when the clamped, inclusive window contains the signed halfword
  at arg2+4; wraps values >=31 by subtracting 29.

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

Run boundary: the next gapless link successor is `ovl_11_func_800DB0E4`
(0x800DB0E4, 0x5C, starts exactly where 800DB054 ends; matched byte-exact in
this session). It is NOT a member — it touches no D_80128DE8 field, clearing
0xB4 bytes at `D_800A03AC` and then setting eight halfwords to 0xFFFF at a
0x16 stride from `D_8007AFF0 + 0x253C0`. So the D_80128DE8 grouping ends at
0x800DB0E4; continuation of the run past that point is adjacency only.

## `ovl_11` 8×0x16 D_800A03B0 record-array init/find/copy/clear run — 0x800DB0E4–0x800DB2AC (confidence: medium)

Evidence: a shared 0x16-stride record object plus a gapless link run of three
complementary roles. `ovl_11_func_800DB0E4` memsets exactly 0xB4 bytes at
`D_800A03AC` = a 4-byte prefix plus eight 0x16-stride records at `D_800A03B0`
(0x4 + 8*0x16 = 0xB4); `ovl_11_func_800DB140` and matched
`ovl_11_func_800DB23C` both read a record's first halfword and clear/copy
0x16 bytes of that same record type. Link order 0x800DB0E4 (0x5C) →
0x800DB140 (0xFC) → 0x800DB23C (0x70) → 0x800DB2AC (0xA8) is gapless.
The same shape appears in ovl_25 (`ovl_25_func_800BB4B4`/`800BB580`) and as a
`D_8007AFF0 + 0x253C0` far-buffer mirror in 800DB0E4 — cross-container twin
and mirror relations, not TU evidence here.

Members (link order):
- ovl_11_func_800DB0E4 (m, byte-exact) — initializer: `memset(&D_800A03AC, 0,
  0xB4)` then eight 0xFFFF halfwords at `D_8007AFF0 + 0x253C0`, stride 0x16.
- ovl_11_func_800DB140 (m, matched this session, byte-exact) — find a
  record whose first halfword equals the arg's first halfword, then copy the
  arg's trailing halfwords into the first 0xFFFF record.
- ovl_11_func_800DB23C (m, matched this session, byte-exact) — find a record
  whose first halfword equals the sign-extended s16 arg and clear it
  (`memset(record, 0, 0x16)`, then `record->first = 0xFFFF`).
- ovl_11_func_800DB2AC (m, matched, byte-exact) — caller side: when its
  arg's `unk2` is 0xF and the +0xE4C8 u16 (read through the D_8006C838
  cluster's +0x8000 two-stage split) is 1..2, it returns without doing
  anything; otherwise it iterates the eight 0x12-stride `+0x8A8` records of
  that same arg struct, skipping 0xFFFF, and calls `ovl_11_func_800DB140` on
  each; touches no `D_800A03B0` byte itself.

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

## `ovl_11` gapless link run head at 0x800EFF9C — 0x800EFF9C / 0x800F002C / 0x800F00AC / 0x800F00E4 / 0x800F021C (confidence: low)

One unbroken ovl_11 link-order run: 0x800EFF9C (0x90, ends exactly at
0x800F002C) → 0x800F002C (0x80, ends exactly at 0x800F00AC) → 0x800F00AC
(0x38, ends exactly at 0x800F00E4) → 0x800F00E4 (0x138) → 0x800F021C (0xAC).
The trailing pair is the documented exclusion-set entry above; 0x800F00AC is
the `D_8006C838` +0x498C u16-sum leaf. 0x800F002C was the missing zero-gap
predecessor linking 0x800EFF9C to 0x800F00AC, so the matched head now closes
the run at both ends. 0x800EFF9C reads the struct_80076220 record (shared
`D_8006C838` + 0x8000 + 0x19EA split), the other run members touch none, so
the run itself remains link-order adjacency only.

- ovl_11_func_800EFF9C (m, matched this session, 0x90, byte-exact) — run head:
  max scan over indices 1..0x24 of the 0x1D4-stride struct_80076220 record,
  reads s16@+0x2 (`p + 0x8000 + 0x19EA`), skips entries where
  `ovl_11_func_800C3548(i) == 1`, returns the largest value; zero-gap
  predecessor of 0x800F002C.
- ovl_11_func_800F002C (m, matched this session, 0x80, byte-exact) — engine
  flag-guard leaf: early `func_8001AF44(0x1B) == 1` returns -1, else a 0..4
  `for` loop tests `func_8001AF44((u32)(i + 0x1C) << 16 >> 16) == 1` and
  returns the index, falling out to -1; touches no globals. Shares the
  `func_8001AF44` flag-test idiom of the ovl_11 leaves; zero-gap predecessor
  of 0x800F00AC.

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
- **scattered second witness of that callee pair**: 0x800E9B68 (far from the
  run) repeats the initializer→callee shape — it clears the record, sets
  unk1E, calls 80107DD0(&record + 0xE0) and initialises the 0xE4 table. This
  is a data + idiom tie, not link-order adjacency, so it adds a member to the
  record family without proving the run's TU.

Members (address order):
- ovl_11_func_800C1BA0 (s) — calls 800C1CBC and 800F0C70
- ovl_11_func_800C1BE0 (m) — zeroes u16 unkA of all 37 D_80076220 entries
- ovl_11_func_800C1C08 (s) — calls 800C1C5C, 80107DD0, 800F0C70
- ovl_11_func_800C1C5C (m, matched this session) — record initializer:
  `memset(arg0, 0, 0x1D4)` then s16@0 = −1; also a member of the
  memset-clear struct-constructor idiom family above
- ovl_11_func_800C1C90 (m) — clears bit 0x10 of u16 unk1E in all 37 entries
- ovl_11_func_800C1CBC (m, matched this session) — free-slot allocator:
  walks the 37 entries by 0x1D4, and at the first s16@0 == −1 calls
  800C1C5C, writes arg0 to s16@0, sets unk1E bit 0x8000, calls
  80107DD0(&record+0xE0), then branches on 800C3548(index) to store 0 or
  0x32 into unk2; confirms the run's shared record type and the 800C1C5C →
  80107DD0 callee pair (same s16 call-cast idiom as the run members)
- ovl_11_func_800C1D68 (s) — calls 800C3548, func_80012A34, func_8001AF70
- ovl_11_func_800E9620 (m, matched this session, 0x104, byte-exact) —
  record-flag driver: when `arg0 == 0x2A` recurses once per index 1..0x24,
  otherwise for `arg0 > 0` and `arg1 < 0x25` indexes `&D_80076220 + arg0`
  and clears u16 unk1E bits 0x1800 (unless `arg1 == 2`) and 0x100 (when
  `arg1 != 0`); returns 1/0. Non-adjacent data + field tie to the record
  family: identical `&D_80076220 + arg0` record index and the same u16
  unk1E 800C1C90/800E9B68 touch; its link-order neighbours
  800E95FC/800E9724 do not reach the array, so this is data-only evidence.
- ovl_11_func_800E9B68 (m, matched this session, 0xCC, byte-exact) —
  per-record initializer: sets unk2C/unk2E = 0x36, zeroes the record's
  halfword fields, sets unk1E to `(unk1E | 0x8000) & 0x9E48`, calls
  `80107DD0(&record + 0xE0)`, then writes 0/0/0x36/0x36 to the 30 entries of
  the 0xE4 table; returns 1. Non-adjacent member of the same record family
  (not in the 0x800C1Bxx run) — data tie plus the run-head
  initializer→80107DD0(`&record + 0xE0`) callee pair.
- ovl_11_func_800F227C (m, 0xD8, finalized) — non-adjacent consumer of
  the same 30-entry +0xE4 table: scans all 37 records (stride 0x1D4),
  selects the first signed threshold >= arg0, writes its index to +0x22,
  clears +0xC and copies entry +2/+4/+6 into record +0xE/+0x2C/+0x2E.
  Arg0 == 0x168 skips the sweep. Original 800C06B0 calls it at 800C07C4.
  This adds a table-layout/data dependency, not evidence that the distant
  selector belongs to the 800C1Bxx translation unit.

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

## `ovl_11` 0x8011FD2C–0x8011FF74 link-order run — paired drivers and halfword writers (confidence: low)

Zero-gap link-order run in `ovl_11` whose matched member calls the matched
writer two entries later, so the run is the tightest TU-membership evidence
for this cluster yet (the struct_80076220 tie above is a data tie only):

- link order: `ovl_11_func_8011FD2C` → `ovl_11_func_8011FD7C` (ends
  0x8011FDCC) → `ovl_11_func_8011FDCC` → `ovl_11_func_8011FEA0` →
  `ovl_11_func_8011FF0C`, every symbol start equal to the previous end;
  the next writer in this address band is `ovl_11_func_8011FF74`;
- internal call edge: `ovl_11_func_8011FD7C` calls `ovl_11_func_8011FF0C`
  (the matched u16@+4 increment/limit writer of the 37-entry, 0x1D4-stride
  `D_80076220` array) once per index 0..0x24 — this is the loop driver that
  applies 8011FF0C to all 37 entries;
- shared s16 argument idiom: both consume s16 parameters through the
  `sll 16` / `sra 16` sign-extension pair.

Members:
- ovl_11_func_8011FD2C (m, matched this session, 0x50, byte-exact) — loop
  driver of FEA0: hoists a sign-extended s16 copy of arg0, then calls
  `ovl_11_func_8011FEA0((s16)i, v)` for i in 0..0x24. Its 0x50 body is the
  same instruction template as FD7C's, differing only in the callee symbol,
  confirming the paired-driver shape of this run (register/argument idiom
  shared with its link-order twin, not copied source).
- ovl_11_func_8011FD7C (m, matched this session, 0x50, byte-exact) — loop
  driver: hoists a sign-extended s16 copy of arg0, then calls
  `ovl_11_func_8011FF0C((s16)i, v)` for i in 0..0x24.
- ovl_11_func_8011FF0C (m) — per-entry writer of the u16@+4 field (recorded
  under the struct_80076220 cluster above).
- ovl_11_func_8011FEA0 (m, parked recovery) — per-entry +0x2 halfword
  increment/limit writer: indexes `D_8006C838+0x99EA` (= `D_80076220+2`)
  by the same 0x1D4 stride, compares a signed read with `255 - arg1`, then
  stores the unsigned read plus arg1 or 255. Its 0x6C extent ends exactly
  at sibling 8011FF0C, which writes +0x4 through the same split base.
  Original caller 8011FD2C at 8011FD50 applies it to all 37 entries, mirroring
  the documented FD7C/FF0C driver/writer edge. These are original-word
  adjacency and data/call ties; the recovery's local register bindings are
  not evidence that the original used register variables.
- ovl_11_func_8011FF74 (m, parked recovery) — pointer-based halfword@+0x16
  increment/limit writer, the same signed-comparison/unsigned-sum operation
  as FEA0 but without record-index arithmetic. Original FDCC calls it at
  8011FE14 over `D_800742EC` records (0xB4 stride), and at 8011FE58 over
  `D_800749F4` records (0xB8 stride). The matched body needs no flag override;
  its user-authorized local bindings are not original-TU evidence.
- ovl_11_func_8011FDCC (m, matched) — loop driver of FF74: walks the
  `D_800742EC` 0xB4-stride array and the `D_800749F4` 0xB8-stride array,
  with counts 5/10 and 10/20 selected by the work-area halfwords +0x44D2
  and +0x44D0 (the same `D_8006C838` view as 800D0BC8). Shares the run's
  sign-extended s16-copy argument idiom; no flag override.

---

## `ovl_11` 3×s32 vector-record pair + adjacent frame-step helper — 0x800D03B4–0x800D04D4 (confidence: medium; the 0x800D04D4 tail is adjacency-only)

Two link-contiguous leaf functions operating on the identical 12-byte record
(three s32 components at 0/4/8), followed by a function run the symbol map
keeps zero-gap-contiguous with them:

- `Struct_800D03B4` (field_0/4/8, local typedef in the matched source) and the
  type 0x800D0408 writes (`Recon800D0408A1View`, game_types.h) are the same
  layout — same component offsets, same component width;
- link-order adjacency: `ovl_11_func_800D03B4` (0x54) ends exactly at
  `ovl_11_func_800D0408` (0x94), which ends exactly at stub
  `ovl_11_func_800D049C` (0x38), which ends exactly at
  `ovl_11_func_800D04D4` (0xFC), which ends exactly at
  `ovl_11_func_800D05D0` — so the pair's unbroken run continues through the
  stub into the newly matched 0x800D04D4;
- 0x800D04D4 shares no record layout and no call edge with the pair, so its
  membership is carried by that zero-gap adjacency alone (hence the tail's
  lower confidence), plus a separate data tie noted in the 0x80110494 group
  above;
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
- ovl_11_func_800D049C (s) — 0x38-byte stub bridging the pair to the helper
- ovl_11_func_800D04D4 (m, newly matched) — frame-step helper: indexes a
  3-s16 keyframe record by s16@+0x28 and arg3, copies its first field to
  obj s16@+0x24, and advances the keyframe index once the frame counter
  reaches the record's second field, returning 1 on its −1 terminator
- ovl_11_func_800D05D0 (m) — gapless link successor; vector-component setter

---

## `ovl_11` `D_800B96BC` dispatch-table run — 0x800E2C64–0x800E2E98 (confidence: medium)

The rodata table `D_800B96BC` (build/ovl_11/asm/data/1664.rodata.s) holds
function pointers to `ovl_11_func_800E2C64`, `ovl_11_func_800E2D3C`,
`ovl_11_func_800E2E4C` and `ovl_11_func_800E2E98`; the four are also
consecutive in the symbol map (configs/symbols/ovl_11.txt), i.e. one unbroken
link-order run — a shared-table cluster and address adjacency that agree.

Members (address order):
- ovl_11_func_800E2C64 (m, matched this session, byte-exact) — dispatch entry:
  gates `u16@+0x0` against 0 and 0x109, then on
  `s16@+0x30 == *(s16 *)(&D_8007AFF0 + 0x25476)` calls `func_8001FABC(0x18)`,
  latches `D_8006C838`+0x52C8/0x52CC/0x52D0/0x52D4 into `s32@+0x58..+0x64`, ORs
  0x2000 / clears 0x4000 in `s32@+0x34`, clamps `u16@+0x16 -= 10` at 0 and calls
  `ovl_11_func_80107DE0(this + 0xA8, 0x24, 0x2D)`; same far-state gate and
  `0x24, 0x2D` clamp constants as ovl_11_func_800DF51C / 800E10C8 in the
  800DF4F0 / 800E109C predicate-caller runs
- ovl_11_func_800E2D3C (m, matched this session, byte-exact) — second dispatch
  entry: repeats 800E2C64's 0/0x109 gate, far-state
  `s16@+0x30 == *(s16 *)(&D_8007AFF0 + 0x25476)` call to `func_8001FABC(0x18)`,
  and `u16@+0x16 -= 10` clamp at 0 with the same `0x24, 0x2D`
  `ovl_11_func_80107DE0(this + 0xA8, ...)` tail, but interposes the shared
  padded-vector pipeline: `ovl_11_func_800D0408(D_8006C838+0x5200, &sp18,
  0x7D0)`, adds `s32@+0x38/+0x3C/+0x40` into `sp18`, calls
  `ovl_11_func_800D05D0(this, sp18)`, then copies `D_8006C838+0x5200` into
  `u16@+0x22`; returns 0
- ovl_11_func_800E2E4C (m, matched this session) — guards a struct's u16@0
  against 0/0x109, then clears u16@0xAE and calls ovl_11_func_800D049C
- ovl_11_func_800E2E98 (m) — trivial `return 0;`

## `ovl_11` D_800B970C / D_800B96BC consumer chain — 0x800E276C / 0x800E2AF0 / 0x800E2824 (confidence: medium)

Candidate same-TU chain in `ovl_11`: zero-gap link-order adjacency over a
shared dispatch-table global. `ovl_11_func_800E276C` (0xB8 bytes at
0x800E276C) ends exactly at `ovl_11_func_800E2824` (0xE0 at 0x800E2824,
matched byte-exact this session), which ends exactly at 0x800E2904. An
overlay-wide asm census finds `D_800B970C` referenced by exactly these two
functions, and no other function references `D_800B96BC` except 800E2824,
which consumes both tables — so the shared-global and adjacency fingerprints
agree.

Members (address order):
- ovl_11_func_800E276C (s) — reads the struct's u16@+0x26 as an index into the
  `D_800B970C` s32 table, NULL-gates the slot and calls through it; also
  conditionally calls 0x800E2A30 / 0x800E2AF0 on the same object
- ovl_11_func_800E2824 (m, matched this session, byte-exact) — dispatch
  consumer: indexes the `D_800B96BC` function-pointer table by an s32 id,
  NULL-gates and calls the slot with the id's object, then when the separate
  `D_800B970C` slot is non-NULL and the call did not return -1 latches the id
  into s16@+0x26 and zeroes s16@+0x28/+0x2A/+0x2C before calling
  ovl_11_func_800D0408(4, this+0x48, 0)
- ovl_11_func_800E2AF0 (m, matched this session, byte-exact) — the intermediate
  state-picker between the two: called by 800E276C on the same object, it
  selects a handler id (0xE/0xF/0x10/0x12/0x13) from `u16@+0xAE`/`u16@+0x0` and
  the `D_80070CF8`-window + `func_80012A34` switch, then calls the dispatch
  consumer 800E2824 with that id; shares the `s16@+0x26` / `s32@+0x34` object
  view with the family. Its tie is the verified call between the two existing
  members, not a direct reference to either dispatch table.

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
- ovl_11_func_80113B80 (m, matched this session, 0xBC, byte-exact, void) —
  populates the D_8012D110 record (+0x8/+0xA) from
  the `D_8006C838`+0x52C6 state, writes the 400*x results into the
  `D_8006C838`+0x52C8/0x52CC/0x52D0 scratch words, then conditionally calls the
  callee.
- ovl_11_func_80113C3C (m, matched this session, 0x94, byte-exact, void) —
  gated by the record's s16 at +0x0: clears bit 0x1000 of the word at
  `D_800A00D4`, zeroes `D_800A00EA`, stores the two 400*x products at
  `D_800A00E8`/`D_800A00EC` (the latter doubled as the function's residual
  `$v0`), and copies +0x8/+0xA back into +0x4/+0x6.

## `ovl_11` work-area +0x52C8/+0x52D0 producer/predicate family (confidence: low)

A data-only relation, not original-TU evidence: both matched functions use
`D_8006C838`'s absolute base and touch the same two work-area offsets, but
with different widths and far-apart addresses.

- ovl_11_func_80113B80 (m) — the producer documented above writes full
  words at +0x52C8 and +0x52D0 from the D_8012D110 halfword pair, using
  `400*x - 1800` and `2000 - 400*(y+2)` respectively.
- ovl_11_func_800E74AC (m, parked recovery) — rectangular-distance predicate
  over signed low halfwords at those offsets: returns 1 only when
  `abs(field_C8 - arg2) < (s16)arg0` and
  `abs(field_D0 - arg3) < (s16)arg1`. The original words preserve two
  separate absolute-value guards and a common final comparison. The
  recovery's explicit register roles and arithmetic fragments are not
  evidence that the original author used bindings or assembly.

## `ovl_11` D_80129560 s32-table accessor family — 0x800E5A1C–0x800EE528 + 0x800EC490 (confidence: medium)

Candidate same-TU family of `ovl_11` (`Obj\GF_FARM.bin`): eighteen matched
functions sharing the one ovl_11-private 0x50-byte s32 table
`D_80129560` (`globals_override.h`), each guarded-indexing it with
`s16`-scaled slots.

Fingerprints:
- **shared private global:** `D_80129560` is defined in ovl_11 data and has
  these accessors container-wide — readers 800E6914 (bit-gated
  `arg0`-selects which of `arg2`/`arg3` resolve through the table),
  800E69B8 (passes `D_80129560[arg2]` as `ovl_11_func_800EFABC`'s third arg),
  800E5A1C (loads `D_80129560[(s16)arg1]` as the limit, compares
  `D_80129560[(s16)arg0]`/2 — or `(s16)arg0`/2 when `arg2 == 0` — against it),
  800ED760 (`arg2 != 0` resolves the scan target through the table),
  800EB79C (`arg2 != 0` resolves the record index through the table),
  800E5C60 (`arg2 != 0` resolves the slot through the table, else raw
  `(s16)arg0`; forwarded to `ovl_11_func_800EFF04` as its second arg),
  800E8DC8 (three-slot snapshot read of the `arg2`/`(s16)arg1`/`arg3` slots),
  800E9CE4 (byte-slot reader: `lbu` of the low byte of
  `D_80129560[(s16)arg0]` through a 4-byte-strided element cast) — and
  writers 800E78E4 (stores the exe `func_80012A34`/`Rand` result into the slot),
  800E8BA0 (stores the `D_8006C838`+0x5DB4 entity's u16@+2 into the
  slot), 800E8D00 (stores `D_8006C838`+0x524C/0x524E state), 800EC490
  (800E5A1C also increments `D_80129560[(s16)arg1]`), 800E7CCC
  (conditionally reads `D_80129560[(s16)arg2]` and -1-guard-writes the slot);
- **contiguous accessor run:** the members 800E6834, 800E686C, 800E6914, 800E69B8,
  800E69F8 form a zero-gap link-order run (0x800E6834 onward, entries at 0x800E6834/686C/
  6914/69B8/69F8), four of them proved load-side users of the table and the fifth
  (800E686C) recorded as the same by `globals_override.h` — positive adjacency
  evidence among family members, which the scattered 0x800E5A1C/800EB79C/
  800EC490/800ED760 sites do not supply;
- **head-of-band zero-gap run:** the four lowest-address members confirmed
  from this family are link-order contiguous with no unrelated code between
  them: `ovl_11_func_800E5A1C` (0xC0) ends exactly at `ovl_11_func_800E5ADC`
  (0xA8), which ends exactly at `ovl_11_func_800E5B84` (0xDC), which ends
  exactly at `ovl_11_func_800E5C60` (0xA0). All four are now matched, so the
  adjacency is fully positive across the run rather than interposed by a stub;
  a real link-order cluster rather than a scattered data-only tie;
- **what the tie is not:** beyond the head run the members are scattered over
  ~0x6E4C of text; member-to-member call edges were a single stub edge
  (800E8DC8 calls 800E5C60) until 800E5ADC was matched (800E5ADC calls
  800E5C60); with 800E8DC8 now also matched, both edges are
  matched-to-matched; 800EC490 has no callers anywhere in the link (an exported
  entry).

Members:
- ovl_11_func_800EDF3C (m, parked recovery) — optional signed-halfword
  slot resolution through `D_80129560` at stride 4; returns a predicate
  using selectors 0xB/0x14, `func_8001AF44(0x129/0x25)`, the day halfword
  `D_80070CF2`, and byte `D_8006C838+0xE647 == 255`. Original consumers
  include EB85C at EB8B0, EC52C at ECA18 and ED7E0 at ED8D8. The shared
  table/address idiom joins this accessor family, not a proven TU; the
  recovery's address-prefix assembly and bindings are not original-source
  evidence.
- ovl_11_func_800E6834 (m, matched 2026-11 — this session, 0x38, byte-exact) —
  compare-forward leaf: `return ovl_11_func_800EFDA0(D_80129560[(s16)arg0],
  arg3, arg2)` — loads the s16-scaled slot with the same `sll 16`/`sra 14`
  fused index as the sibling readers, then tail-calls the shared three-arg
  compare leaf (mode `arg2`); lowest-address member of the contiguous run
  above and immediate link-order predecessor of the load-side user 800E686C.
- ovl_11_func_800E5A1C (m, matched 2026-09 — this session, 0xC0, byte-exact) —
  compare-then-increment probe: sets the returned flag when
  `D_80129560[(s16)arg0] / 2 < limit` (arg2 != 0) or `(s16)arg0 / 2 < limit`
  (arg2 == 0) with `limit = D_80129560[(s16)arg1]`, then increments
  `D_80129560[(s16)arg1]` unless `arg3 != 0 && (D_8006C844 & 0x8000000)`;
  lowest-address member of the family, at the head of the recorded
  0x800E5A1C–0x800EExxx accessor band and immediate link-order predecessor of
  800E5ADC (zero gap), same absolute `lui`+`addiu %lo` base
  and s16-fused index idiom as the sibling accessors.
- ovl_11_func_800E6914 (m) — three-slot compare leaf: `D_80129560[arg1]` vs
  bit-selected `D_80129560[arg2]`/`[arg3]`, returns the in-range test.
- ovl_11_func_800E69B8 (m) — forwards `D_80129560[arg2]` into
  `ovl_11_func_800EFABC`.
- ovl_11_func_800E69F8 (m, matched 2026-11 — this session, 0x58, byte-exact) —
  guarded-slot forwarder: `ptr = &D_80129560[(s16)arg0]` built with the family's
  fused `sll 16`/`sra 14` index, then forwards `ptr` and a conditionally
  table-resolved value (`D_80129560[arg2]` when `arg1 != 0`, the raw `arg2`
  otherwise) into `ovl_11_func_800EFE34`; returns 1. Zero-gap link-order
  successor of 800E69B8 (0x40), extending the contiguous run above.
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
- ovl_11_func_800E9CE4 (m, matched 2026-11 — this session, 0x44, byte-exact) —
  byte-slot copy leaf: `p = ovl_11_func_800E3A94(); p->u8@+1 =
  ((u8-stride-4 element *)D_80129560)[(s16)arg0].u8@+0; return 1;`. Same
  `s16`-scaled `lui`+`addiu %lo` base and index*4 idiom as the sibling
  readers, but the slot is consumed one byte wide rather than as an s32;
  one of the two family members that consume the `D_801291B4` value the
  zero-arg accessor 800E3A94 returns (with 800E9C34), and it sits inside the
  band.
- ovl_11_func_800E9C34 (m, matched 2026-11 — this session, 0xB0, byte-exact) —
  guarded-slot producer: takes the 0x10-byte record the `ovl_11_func_800E3A94`
  cursor (`D_801291B4`, based on the `D_8006E910` 0xCE-record array) points at,
  uses its `u8@+2` when it is not 0xFF, and otherwise scans that array for the
  cursor's index (0 on a full scan); both arms write
  `D_80129560[(s16)arg0] = byte` / `index + 1` through the family's s16-scaled
  `lui`+`addiu %lo` base and return 1. Zero-gap link-order predecessor of
  800E9CE4 (0x800E9C34 + 0xB0) and the second family member consuming the
  `ovl_11_func_800E3A94` cursor, inside the 0x800E5A1C–0x800EExxx band; also
  the first family tie to the `D_8006E910` record array.
- ovl_11_func_800E78E4 (m, matched 2026-11 — this session, 0x70, byte-exact) —
  guarded-slot random writer: `temp = func_80012A34(arg0 & 0xFFFF)` (exe
  `Rand`), then if `arg1 != -1` stores `D_80129560[(s16)arg1] = temp` via the
  sibling `lui`+`addiu %lo` base (the s16 index materialised once and scaled by
  2), and forwards to the shared three-arg compare leaf
  `ovl_11_func_800EFDA0(temp, arg3, arg2)`; same `!= -1` guard-write and
  compare-forward shape as 800EC490/800E6834, inside the accessor band.
- ovl_11_func_800E9778 (m, matched 2026-11 — this session, 0xC0, byte-exact) —
  three-slot snapshot write: selects a 0xC-byte record from the `D_80076280`
  0x1D4-stride table (special base `D_80071B00` when `arg0 == 0x29`, bounds
  `(u32)(arg0-1) < 0x24` otherwise, else returns 0), then for each of three
  args, if `!= -1`, writes `D_80129560[arg] = record.field` (fields +4/+0/+8);
  returns 1. Same guarded multi-slot write idiom and return-1 shape as
  `800EC490`; sits in the same 0x800E5A1C–0x800EExxx accessor band.
- ovl_11_func_800E9838 (m, matched 2026-11 — this session, 0xDC, byte-exact) —
  fixed-source snapshot writer: when `arg0`'s low half is non-zero remaps the
  three slots to `arg1`/`arg1+1`/`arg1+2` (returning 0 if `arg1 == -1`), then
  for each slot guarded by `!= -1 && < 0x14` writes
  `D_80129560[arg] = *(s16 *)(D_8007AFF0 + 0x253B6/0x253B4/0x253B8)`; returns
  1. Same guarded multi-slot write idiom as 800E9778/800EC490 and that
  function's zero-gap link-order successor (0x800E9778 + 0xC0), snapshotting
  the same relative +0x253B6/+0x253B4/+0x253B8 halfword block 800E9778 reads
  from its selected record — a new accessor-family tie to the `D_8007AFF0`
  far-base halfword-state block.
- ovl_11_func_800E99EC (m, matched 2026-11 — this session, 0x110, byte-exact) —
  conditional-slot position leaf: `arg3 & 1`/`arg3 & 2` select the low half of
  `D_80129560[arg0]`/`[arg1]` (raw s16 args otherwise), then either calls
  `ovl_11_func_800C08E8((t0 * 0x3C) + a3)` when `arg2 != 0`, or gates on the
  `D_8006C838` +0x44C0 field (`< 6`, remapping +0x18) and calls the same leaf
  with the `*0x3C` offset against the +0x44C0/+0x44C2 pair; returns 1 when the
  difference is non-negative, 0 otherwise. Same `lui`+`addiu %lo` absolute base,
  `s16`-fused 4-byte index and conditional table-resolve as the sibling readers
  (800E5C60/800E8550), inside the accessor band; zero-gap link-order predecessor
  of the matched `ovl_11_func_800E9AFC` (0x800E99EC + 0x110) and the only family
  member whose table slots feed a `*0x3C` position calculation rather than a
  record write/compare.
- ovl_11_func_800E7CCC (m, matched 2026-11 — this session, 0x80, byte-exact) —
  guarded-slot forwarder/writer: `arg3 != 0` resolves `D_80129560[arg2]` (raw
  `arg2` otherwise), forwards `(selected, (s16)arg0)` to the two-arg accessor
  `ovl_11_func_800F2354`, truncates the result to s16, and when `arg1 != -1`
  writes it to `D_80129560[(s16)arg1]`; returns `result == 0`. Same
  `lui`+`addiu %lo` absolute base, `s16`-fused index and `!= -1` guard-write
  shape as 800E78E4/800EC490, and the same conditional table-resolve as
  800E69F8/800EB79C, inside the accessor band.
- ovl_11_func_800E5C60 (m, matched this session, 0xA0, byte-exact) —
  conditional-slot resolver: when `arg0 != 0x2C`, resolves
  `D_80129560[arg0]` (raw `(s16)arg0` when `arg2 == 0`) and calls
  `ovl_11_func_800EFF04(0x25, resolved, NULL)`, setting bit `0x800` of the
  resolved record's first halfword when `arg1 == 0` and clearing it otherwise;
  the `arg0 == 0x2C` arm calls `ovl_11_func_800CF36C(0)`; returns 1. Both callers
  are now matched (800E5ADC, 800E8DC8); both call it as
  `800E5C60((s16)arg0, 0, 0)` and then store three s32s at the
  0x22 record's +0/+4/+8 (800E5ADC's values from its own args, record base
  `D_80077600 + arg0*0xF8` for `arg0 < 0x32`; 800E8DC8's read through the
  table). It sits at the far end of the head-of-band zero-gap run
  (800E5A1C → 800E5ADC → 800E5B84 → 800E5C60).
- ovl_11_func_800E5ADC (m, matched this session, 0xA8, byte-exact) —
  conditional 0x22-record field writer: when `arg0 < 0x32` calls
  `ovl_11_func_800E5C60((s16)arg0, 0, 0)` and resolves the record base through
  `ovl_11_func_800EFF04(0x22, (s16)arg0, NULL)`, otherwise uses the static
  `D_80077600 + arg0*0xF8`; writes the three incoming s32s to record +0/+4/+8
  (in source order +0, +8, +4) and returns 1. Zero-gap link-order successor of
  family member 800E5A1C and predecessor of 800E5B84; the caller that
  supplies the matched member-to-member edge into 800E5C60 and a second
  recovered variant of the shared caller shape (it passes a cleared 4th
  argument to 800E5C60, where 800E8DC8 passes 3).
- ovl_11_func_800E5B84 (m, matched this session, 0xDC, byte-exact) —
  conditional flag-clear leaf: resolves the 0x24 record through
  `ovl_11_func_800EFF04(0x24, (s16)arg0, NULL)`, then when `arg3 == 0`, the
  record's `u8@+4` equals `(s16)arg1` and its `u16@+2` carries 0x100/0x200,
  clears bit 0x100000 of the `D_8006C838`+0x5234 flag word and returns 1 (0
  otherwise); the `arg3 != 0` arm forwards through `func_80015840`/
  `func_8001585C` and returns 1. Zero-gap link-order successor of 800E5ADC and
  predecessor of 800E5C60; same `ovl_11_func_800EFF04` resolver idiom as those
  two and a further +0x5234 flag-word consumer (cf. 800E953C, 800E63C8).
- ovl_11_func_800E8DC8 (m, matched this session, 0xB0, byte-exact) — three-slot
  snapshot writer: after `ovl_11_func_800E5C60((s16)arg0, 0, 0, 0)`, resolves
  the 0x22 record via `ovl_11_func_800EFF04` and stores `D_80129560[arg2]`/
  `D_80129560[(s16)arg1]`/`D_80129560[arg3]` at its +0/+4/+8; returns 1. Same
  snapshot-write idiom as 800E9778 and the same 0x22-record caller shape as
  800E5ADC (both call 800E5C60 with a cleared 4th argument), inside the
  accessor band.
- ovl_11_func_800E8550 (m, matched this session, 0xC4, byte-exact) —
  conditional-slot consumer plus formatted-number staging: `arg0 != 0` resolves
  `D_80129560[arg2]` (raw `arg2` otherwise), formats the value into the s16
  buffer `D_801295B0` (the 0x16 bytes immediately after the 0x50-byte s32 table,
  now in `globals_override.h`) via `func_8001A970(…, 0xA)`, stores the `-1`
  halfword terminator, then walks the buffer while `0xFFD` blank markers
  continue (signed `lh`) and forwards `arg1 & 0xFFFF` plus the cursor to
  `func_80017A08`; returns 1. Same `lui`+`addiu %lo` absolute base and
  conditional table-resolve shape as 800ED760/800E7CCC, inside the accessor
  band; the `D_801295B0` staging buffer is the second `func_8001A970` + `0xFFD`
  scan site (idiom sibling of the D_8012A028 cluster, different buffer and draw
  call).
- ovl_11_func_800EE528 (m, matched this session, 0xDC, byte-exact) —
  0x24-record load-and-compare: rejects `(u32)(arg1 & 0xFFFF) >= 0xA`, resolves
  the 0x24 record through `ovl_11_func_800EFF04(0x24, (s16)arg0, NULL)`, then
  reads `D_80129560[(s16)arg1]` with the family's s16-scaled 4-byte index and,
  when the record's `u8@+4` differs, calls `func_80015840(record, slot & 0xFF)`;
  draws through `func_80015114`/`func_80015BF0` and returns 1. Same
  `ovl_11_func_800EFF04(0x24, …)` record-resolver idiom as 800E5B84 and the same
  slot-read shape as the sibling readers; extends the accessor band's high end
  (0x800EE528, beyond the previously recorded 0x800ED760).

## `ovl_11` D_80076280/D_80076300 record-selector run — 0x800E9778 / 0x800EDEB8 / 0x800E7C2C / 0x800E4428 (confidence: low)

Data-family tie: `ovl_11_func_800E9778`, `ovl_11_func_800EDEB8`,
`ovl_11_func_800E7C2C` and `ovl_11_func_800E4428` are the only functions
container-wide carrying the same
record-selector construction — an `arg0 == 0x29` test selecting a special base
(`D_80071B00` for the first two, `D_80071CCC` here), otherwise the identical
`(a<<3 - a)<<2 + a)<<2 + a)<<2` multiply chain for the 0x1D4 byte stride
against a `D_80076280`-family base (`D_80076300` = `D_80076280` + 0x80 for
800E7C2C) — with distinct effects on the selected record. No link-order
adjacency (~0x2740/0x3000 apart), so per ledger convention this is a
shared-global tie, not a TU tie. The first two members also belong to the
D_80129560 accessor family above; 800E7C2C is the member whose record
inspection instead drives the `ovl_11_func_80107DD0`/`DE0` initializer pair
(see the 0x1D4-stride initializer run).

Members:
- ovl_11_func_800E9778 (m) — snapshot: record selector + three -1-guarded
  `D_80129560[arg] = record.field` writes, bounds-checked, returns 1/0.
- ovl_11_func_800EDEB8 (m) — delta: same record selector, no bounds check,
  adds `arg*2` into record fields +4/+0/+8, returns 1.
- ovl_11_func_800E7C2C (m, matched 2026-11 — this session, 0xA0, byte-exact) —
  guard: same selector, no bounds check; if s16@+0 == -1 calls
  `80107DE0(record, arg1, 0x1E)` and returns 0, else if s16@+2 == 0 calls
  `80107DD0(record)` and returns 1, else returns 0.
- ovl_11_func_800E4428 (m, matched this session, 0xAC, byte-exact) — delta: no
  `arg0 == 0x29` special case and no argument at all; the selector is the s16
  getter `ovl_11_func_800EEBB8()` (called up to three times, rejected when -2
  or -1), and the guard also gates on `D_8006C844 & 0x400000`; copies
  halfwords +0/+4/+8 of the selected D_80076280 record to the
  `D_8007AFF0+0x253B4/+0x253B6/+0x253B8` block. Ties this record table to the
  D_8007AFF0 +0x253AC halfword-state run above (the first cross-cluster link
  between those two shared-global clusters; still a shared-global tie, not a
  TU tie).

A further function shares the record geometry without the selector: `ovl_11_func_800EB79C`
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

## `ovl_11` D_80071AC0/D_80070D42 record-table consumer run — 0x801027D4–0x80102B6C (confidence: medium)

Evidence: a gapless link run 0x80101B9C–0x80102DC4 in which the
D_80071AC0/D_80070D42 6-byte-stride accessor `ovl_11_func_80102844` sits two
functions before `ovl_11_func_8010289C`, and the table consumer
`ovl_11_func_80102A64`'s immediate link predecessor `ovl_11_func_80102A10` is
its only direct caller — call graph and link order agree. `8010289C` also
calls its run successors `80102B6C`/`80102BCC`, and run members
`80102368`/`801024D8` call the same engine helper `func_8001F250` that bounds
`80102A64`'s first scan. This connects the accessor and a consumer in one
source-file hypothesis; the D_8006C838+0x51E6/+0x450A/+0x5288 table shape is
shared with the separate 0x80100EB8 run (different link region).

Members (address order):
- ovl_11_func_80102844 (m) — D_80071AC0/D_80070D42 stride-6 accessor.
- ovl_11_func_80102A10 (m, matched this session, byte-exact) — immediate link
  predecessor; sole caller of 80102A64: walks the 8-entry `D_8012CF00` u16
  table and calls 80102A64 on each nonzero entry (the same `D_8012CF00`
  table read by run-start `ovl_11_func_801027D4`).
- ovl_11_func_80102A64 (m, matched this session, byte-exact) — counter-decrement
  consumer of the D_80071AC0 and D_8006C838+0x450A 6-byte record tables.

## `ovl_11` D_8012CF00 8-entry table id-map run — 0x80102E1C–0x801033D4 (confidence: medium)

Candidate same-TU run of `ovl_11` (`Obj\GF_FARM.bin`) built around the
8-entry `D_8012CF00` u16 table and the raw id set 0x181–0x184. Evidence
produced by matching `ovl_11_func_801032BC` this session:

- **zero-gap link-order contiguity:** `ovl_11_func_80102E1C` (0xF8, ends
  0x80102F14) → `ovl_11_func_80102F14` (0x2D0, ends 0x801031E4) →
  `ovl_11_func_801031E4` (0xD8, ends 0x801032BC) → `ovl_11_func_801032BC`
  (0x118, ends 0x801033D4); each starts exactly where the previous ends;
- **call graph agrees with link order:** run head `80102E1C` has a single
  `jal`, to its link successor's successor `801031E4`; `80102F14` has a
  single `jal`, to its link successor `801032BC`. Both call sites read
  `D_8012CF00` and pass a table entry as the id;
- **shared global cluster:** `D_8012CF00` (8 u16 entries) is read by
  `80102E1C`, `80102F14` and `801031E4`; `801031E4` also reads the
  `D_80127404` key list indexed `idx*4`;
- **shared id-map + scan idiom:** `801031E4` and `801032BC` both map ids
  0x181–0x184 to small constants and scan an 8-entry u16 table for a
  match — the same decision shape over the same id set, adjacent in link
  order;
- **adjacency to a documented run:** `801032BC` ends exactly at 0x801033D4,
  the head of the high-confidence D_801273DC handler-table run; that run is a
  different global cluster (`D_801273DC`), so this is adjacency only and is
  not claimed as membership here.

Members (address order):
- ovl_11_func_80102E1C (s) — run head; reads the 8-entry `D_8012CF00` table;
  its only call is its link successor's successor `801031E4`.
- ovl_11_func_80102F14 (s) — reads `D_8012CF00`; walks the table and calls its
  link successor `801032BC` with the shared object and a stack u16, testing
  the 1/2 result codes.
- ovl_11_func_801031E4 (s, parked attempt preserved) — maps 0x181–0x184 to
  indices 0–3; scans the `D_8012CF00` entries against the
  `D_80127404[idx*4]` key list; returns 1 on a hit, 2 otherwise.
- ovl_11_func_801032BC (m, matched this session, byte-exact) — maps the same
  0x181–0x184 ids (plus 0x88–0x90 and 0xE3–0xE5) to constants; scans an
  8-entry {u16, s8} table through arg0+0x1C, accumulating the signed byte into
  *arg2; returns 1/2 on the same nonzero-entry test as 801031E4.

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
- ovl_11_func_800BD5A8 (m, matched this session, byte-exact) — per-index
  loader: indexes `D_80125528[arg0]` for the record length and
  `D_801227CC[arg0]` for the CD range, loads that range into the
  `D_8005E3B0+0x4290` scratch buffer via `func_80014BCC`, then memcpy's it
  into the `D_800957F8` blob base and calls `800DA588`.
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

## `ovl_11` D_8006C838 +0xDD8C pool-walk pair — 0x800F40A4 / 0x800F508C (confidence: medium)

Fingerprints:
- shared parallel-array cluster: both walk the pointer array at
  `D_8006C838 + 0xDD8C` (0x8007A5C4) and the s16 array at `D_8006C838 + 0xDDD8`
  (0x8007A610) in lockstep over 19 (0x12+1) entries, loading one s16 and one
  pointer per cell;
- shared address idiom: both form the two cursors through the
  `base = (char *)&D_8006C838` local (unfolded `lui`+`%lo` base, then an
  `ori`+`addu` large-offset add for +0xDD8C/+0xDDD8 — the offsets exceed the
  16-bit `addiu` range) — the same absolute-addressed D_8006C838 view the
  0x800F4994 pool run and 0x8010780C state guard use;
- what the tie is not: link adjacency is absent (0x800F4E84 sits between the
  two), so membership rests on the shared private array cluster + idiom alone.

Members:
- ovl_11_func_800F40A4 (m) — walk head: walks the 19 cells and calls
  `ovl_11_func_800F53BC(*p2, *p1)`, then tails `ovl_11_func_800F4AC0(0)`;
- ovl_11_func_800F508C (m, matched this session, 0x7C, byte-exact) — same walk
  threading its s16 arg0: calls `ovl_11_func_800F5160(arg0, *p2, *p1)` and
  returns (no tail call). The two differ only in the per-entry leaf and the
  arg0 pass-through.

## `ovl_11` D_80075AD4 0xF0-byte record access cluster — 0x800CF314 / 0x800C580C / 0x8010C1FC / 0x8010B1C4 (confidence: medium)

- shared-global fingerprint: D_80075AD4 is the record base reached absolutely
  by 0x800C580C (passed as arg0), by 0x8010C1FC (fields +0x22, +0x78) and by
  0x8010B1C4 (u16@+0x0 zero-test, passed as arg0 to the initializer);
  0x800CF314 writes the same record through its interior view anchors
  D_80075AEA (+0x18/+0x1A) and D_80075B0C (+0/+4/+8, base minus 0xA/−8).
- record extent: D_80075BC4 follows D_80075AD4 by exactly 0xF0, the same 0xF0
  struct size the memset-clear family records for 0x8010B64C / 0x801092E0 — so
  this is the 0xF0-byte record that precedes the D_80075BC4 0xB0-stride table
  (see the D_80075BC4 entry below; ownership still unconfirmed). The 0xF0 size
  is now independently witnessed from the writer side: 0x8010B1C4's callee
  0x8010B778 memsets exactly 0xF0 bytes at this record base.
- initializer tie (call graph): 0x8010B1C4 is the cluster's gate entry — it
  calls ovl_11_func_8010B778 (&D_80075AD4, arg0), the 0xF0 far-state
  initializer of the 0x8010B64C gapless band, and returns the record base,
  tying this record cluster to that band through the call graph.
- link adjacency (weak): 0x800CF308 sits immediately before 0x800CF314 in the
  0x800CFxxx run, whose joins are exact at splat offsets — 0x800CF314 (0x58)
  ends at 0x800CF36C and 0x800CF36C (0xBC) ends at 0x800CF428, bridging this
  cluster to the D_80123758 item-table cluster through the matched 800CF36C
  (which references D_80075BC4, neither cluster's global); 0x8010B1C4 is the
  zero-gap tail of the 0x8010B0E8 (0xB0) →
  0x8010B198 (0x2C) → 0x8010B1C4 (0x54) chain, which ends at 0x8010B218
  (0x42C gap before the 0x8010B64C band); callers/siblings are container-local,
  so no cross-container tie.

Members:
- ovl_11_func_800CF314 (m, matched this session, byte-exact) — record fill:
  copies an arg1 u16 pair into the record's +0x18/+0x1A and an arg2 s32 triple
  into +0x38/+0x3C/+0x40, then calls ovl_11_func_80107DD0(arg0 + 0xA8).
- ovl_11_func_800C580C (s) — caller: passes &D_80075AD4 as arg0 (arg1/arg2 are
  s1+0xFC / s1+0x100).
- ovl_11_func_8010C1FC (s) — same record base D_80075AD4, fields +0x22 and +0x78.
- ovl_11_func_8010B1C4 (m, matched this session, 0x54, byte-exact) — gate
  entry: when arg0 is 0x15E/0x15F and u16@+0x0 == 0, calls
  ovl_11_func_8010B778(&D_80075AD4, arg0) (the band's 0xF0 record
  initializer) and returns &D_80075AD4, else returns NULL; sole witnessed
  caller 0x800CE744.
- ovl_11_func_800C7650 (m, matched this session, byte-exact) — flag-dispatch
  leaf on the D_80128C54/D_80128C4C pair that passes &D_80075AD4 as arg0 to
  the D_800BA9E4 dispatcher ovl_11_func_8010B57C when the flag's 0x200 bit is
  set, bridging this record cluster to the pair cluster below.

## `ovl_11` D_800759E4 0xF0-byte record gate/initializer pair — 0x80108CD0 / 0x8010946C (confidence: medium)

Evidence: D_800759E4 is the 0xF0-byte record immediately preceding the
D_80075AD4 cluster — D_800759E4 + 0xF0 == D_80075AD4, the same stride its own
initializer memsets — so the two are one contiguous 0xF0-stride record band
(and share a TU). The handling side is a parallel pair:
- initializer tie (call graph): 0x80108CD0 is the gate entry — it guards arg0
  in {0x106, 0x107} and u16@+0x0 == 0, calls
  ovl_11_func_8010946C(&D_800759E4, arg0) (the guarded 0xF0 far-state
  initializer of the memset-clear family), and returns &D_800759E4.
- structural twin: 0x80108CD0 is the exact machine shape of 0x8010B1C4, the
  D_80075AD4 gate entry; the two differ only in base global, guard range
  (0x106/0x107 vs 0x15E/0x15F) and callee, so each record has its own
  gate/initializer pair.

Members:
- ovl_11_func_80108CD0 (m, matched this session, byte-exact) — D_800759E4 gate
  entry: range/zero guard, calls ovl_11_func_8010946C and returns
  &D_800759E4, else NULL.
- ovl_11_func_8010946C (m) — D_800759E4 0xF0 far-state initializer.
- ovl_11_func_8010941C (m) — writes D_800759E4 +0x30/+0x38/+0x3C/+0x40 per
  sub-state argument, the writer-side twin of 0x800CF314's +0x38/+0x3C/+0x40
  writes on the D_80075AD4 record.

## `ovl_11` D_80128C4C / D_80128C54 state-pair cluster — 0x800C4DE0–0x800CD0F4 (confidence: medium)

- shared-global fingerprint: two adjacent main-RAM s32 globals, D_80128C4C
  (0x80128C4C) and D_80128C54 (0x80128C54), reached absolutely (`lui`+`%lo`)
  by every site in this band; D_80128C54 is a bit-field of state flags and
  D_80128C4C is the dispatched object pointer.
- writers: 0x800C7878, 0x800C9C60, 0x800CA708 and 0x800CB114 store both halves;
  the other members load one or both.
- span/order: every site lies inside the contiguous 0x800C4DE0–0x800CD0F4
  ovl_11 band, and the four writers intersperse the readers, the same
  read/write-threading fingerprint as the D_80128B50/D_80128B5C run.

Members:
- ovl_11_func_800C7650 (m, matched this session, byte-exact) — flag-dispatch
  leaf: on `D_80128C54 & 0x206`, calls `ovl_11_func_800DF010(D_80128C4C, 0)`
  for 0x2/0x4 and `ovl_11_func_8010B57C(&D_80075AD4, 0)` for 0x200.
- ovl_11_func_800C7878 (s) — reads then writes both halves.
- ovl_11_func_800C9C60 (s) — writes both halves.
- ovl_11_func_800CA708 (s) — reads, then writes both halves.
- ovl_11_func_800CB114 (s) — writes both halves repeatedly.
- ovl_11_func_800C4DE0 / 800C523C / 800C541C / 800C580C / 800C8FA8 /
  800C907C / 800CB850 / 800CD0F4 (s) — readers of one or both halves.
- ovl_11_func_800C8D24 (s) — reads D_80128C54 only.

## `ovl_11` D_80123758 0x18-byte item-record table cluster — 0x800CF258 / 0x800CF428 (confidence: medium)

- shared-global fingerprint: D_80123758 is an ovl_11 data table of 17 records
  with byte stride 0x18, read by both 0x800CF258 and 0x800CF428. Record layout
  witnessed across the two: s16 id @0x0, s16 @0x2, u16 mask @0x4, s32 @0x8,
  s32 @0xC.
- shared callee: both open by calling ovl_11_func_800D2E20 and sign-extend its
  result to s16 before using it as the record mask (0x800CF264 / 0x800CF480).
- both records are only ever declared extern (split `lui`/`%lo` absolute form),
  never defined by this TU; the table is ovl_11 data.

Members:
- ovl_11_func_800CF258 (m, matched this session, byte-exact) — id lookup:
  scans the 17 records for the one whose s16 id @0x0 equals arg0 and returns
  `(mask & record.mask@0x4) != 0`, else 0.
- ovl_11_func_800CF428 (s) — table walker: additionally reads the record's
  s16 @0x2 (compared against D_8009AFF0+0x5476) and s32 @0x8/0xC (copied to
  a new object), so it shares the same record type.

## `ovl_11` D_80075BC4 record-table consumers — 0x801097F4 / 0x801098B0 / 0x800CF36C (confidence: low)

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
  0x800D2240, 0x800D2F48, 0x801097F4); 801097F4 and 800CF36C are now both
  matched, and 800CF36C sits in the 0x800CF044–0x800D506C caller run of the
  0xB0 memset-clearer 800D3200 (whose head 800CF044 is also a consumer), so
  data TU ownership is unconfirmed with that run the leading candidate.
- shared-global fingerprint (D_8012D080): the caller passes &D_8012D080 as
  the scan's out pointer and clears it to 0 when the scan fails, so
  801098B0 is now a confirmed writer of the absolute-addressed pointer cell
  that 80109E04 reads (D_8012D080) — tying the record-table consumer run to
  the ovl_11 D_8012D040/D_8012D050/D_8012D060 cluster at 0x8012D0xx.

Members:
- ovl_11_func_801097F4 (m, matched this session, byte-exact) — leaf: scans
  six 0xB0-byte records at D_80075BC4 for tag 0x15B, the arg's s16 selector
  at +0x30, and a ±radius window over the s32 coordinates at +0x38/+0x40;
  stores the first full match's pointer through the arg's out pointer and
  returns 1/0.
- ovl_11_func_801098B0 (m, byte-exact clean C, baseline flags) — run tail:
  sole caller of 801097F4; builds the by-value record from a source record
  with the same D_80075BC4 field shape (u16 tag@+0x00, s16 selector@+0x30,
  s32 flags@+0x34, s32 coords@+0x38/+0x3C/+0x40/+0x44) plus an extra s16
  radius source@+0xAC, gated on tag != 0 and flags & 0x8000; passes
  &D_8012D080 as the out pointer and clears it on scan failure.
- ovl_11_func_800CF36C (m, matched this session, byte-exact) — conditional
  batch clearer: for each of the six 0xB0 records, calls
  ovl_11_func_800D3200 (the 0xB0 memset-clearer of the idiom family) when
  (s32@+0x34 & 0x20000 == 0 or arg0) and (u16 tag@+0x0 & 0x15B == 0 or the
  global D_8006C838+0x44F8 bit 0x01000000 is set); the tag test covers the
  same +0x00 field the scan above equality-matches, and callers pass arg0
  0/1 (800BC3E0, 800C0A4C, 800E499C, 800E5C60).
- ovl_11_func_800D2F48 (m, matched this session, byte-exact) — first-free-slot
  allocator over the same six 0xB0 records: scans D_80075BC4 for tag 0,
  initialises the slot through 800D3390, then stamps the shared unaligned
  D_8006C838+0x44B8 pair and D_8007AFF0+0x25476 halfword and dispatches tag
  0x157/0x15B through 800D3104.

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

## `ovl_11` D_8007AFF0 +0x253AC halfword-state consumer/writer run — 0x800DB674 / 0x800DB78C / 0x800DB7F0 / 0x800DB904 / 0x800DB978 (confidence: medium)

Evidence: gapless link adjacency closing a contiguous small-function run
(`splat` offsets: 0x23854 = 0x800DB674 is 0x118 and ends exactly at 0x2396C =
0x800DB78C; 0x2396C = 0x800DB78C is 0x64 and ends exactly at 0x800DB7F0;
0x800DB7F0 is 0x34 and ends exactly at 0x800DB824; 0x800DB904 is 0x74 and ends
exactly at 0x800DB978) plus a shared far-buffer global cluster — all three
build the same single-`lui`+`addu` `D_8007AFF0+0x20000` far base and touch the
+0x253AC/+0x253AE/+0x253B0/+0x253B4/+0x253B6/+0x253B8 halfword state block.
The run is the `ovl_11` counterpart of the `ovl_21` writer+consumer run
(800BB0F8 / 800BB250 / 800BB2B4) recorded above: `ovl_11_func_800DB7F0` is a
near-twin of `ovl_21_func_800BB0F8`, `ovl_11_func_800DB78C` is a byte-identical
source twin of `ovl_21_func_800BB250` (same forwarding to
`func_8001B9F8`/`func_8001BA40`, same six-halfword read set), and
`ovl_11_func_800DB904` is the byte-identical twin of `ovl_21_func_800BB2B4`
(same far-base read, same two `VECTOR`s forwarded to `func_8001C0D4`; the only
difference is the descriptor symbol it passes — ovl_11's `D_80128818` for
ovl_21's `D_800C0DD8`). Cross-overlay twin relations are not membership
evidence; here the run's own membership rests on the adjacency + shared cluster.
`ovl_11_func_800DB674` heads the run (0x800DB674 is 0x118, ending exactly at
0x800DB78C); it is a GTE matrix builder that writes the +0x253AC/+0x253AE/
+0x253B0 halfwords through the same far base and reads +0x25394/+0x25398/
+0x253A0/+0x253B6, the `ovl_11` counterpart of `ovl_19_func_800BB358` and a
byte-identical source twin of `ovl_21_func_800BB138`.

Members (link order):
- ovl_11_func_800DB674 (m, matched this session, byte-exact) — run head;
  `m0 = GsIDMATRIX; m1 = GsIDMATRIX;` + `PushMatrix` / `RotMatrix` /
  `SetRotMatrix` / `SetTransMatrix` / `RotTrans` / `PopMatrix` GTE matrix
  builder, writing the +0x253AC/+0x253AE/+0x253B0 halfwords via the far base.
- ovl_11_func_800DB78C (m, matched this session, byte-exact) — reads the
  +0x253AC/+0x253AE/+0x253B0/+0x253B4/+0x253B6/+0x253B8 halfwords via the far
  base and forwards them to `func_8001B9F8` (sum-of-pairs, 4 args) and
  `func_8001BA40` (3 args); byte-identical source twin of `ovl_21_func_800BB250`.
- ovl_11_func_800DB7F0 (m) — gapless link successor; near-twin of
  `ovl_21_func_800BB0F8`/`ovl_19_func_800BB318` reset leaf (same far base, same
  +0x25394..+0x253A4 s32 block).
- ovl_11_func_800DB904 (m, matched this session, byte-exact) — consumer in the
  run (0x800DB904 is 0x74, ending exactly at 0x800DB978); reads the same six
  +0x253AC..+0x253B8 halfwords through the same far base, builds two `VECTOR`s
  (pair sums for x/z, raw for y) and forwards them with `&D_80128818` to
  `func_8001C0D4`; byte-identical source twin of `ovl_21_func_800BB2B4`.
- ovl_11_func_800DB978 (m) — later member of the same run; zeroes exactly the
  six +0x253AC..+0x253B8 halfwords through the same far base.

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

## `ovl_30` D_80134008/D_80134B0C init/read pair — 0x8012EFEC / 0x8012F000 (confidence: medium for the pair, low for 0x8012F084 and 0x8012FDEC)

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
- **data-cluster + link adjacency (low):** `ovl_30_func_8012F030` ends exactly
  at `ovl_30_func_8012F084`, inside the same gapless link run, and references
  the overlay-local `D_8013400C`, four bytes past the group's `D_80134008`;
  it touches neither of the pair's globals, so its membership rests on the
  data cluster and the run, not on the init/read tie.
- **shared overlay-local global + caller/link adjacency (low):**
  `ovl_30_func_8012FDEC` (0x7C bytes at 0x8012FDEC, matched byte-exact this
  session) reads/increments/resets `D_80134B14`, eight bytes past the group's
  `D_80134B0C`; its gapless link predecessor `ovl_30_func_8012F454` (0x998
  bytes, ending exactly at 0x8012FDEC, stub) is its only caller and also
  references `D_80134B14` (state-0 initialiser and debug read), so call graph
  and link order agree. It touches neither D_80134008 nor D_80134B0C.

Members (link order):
- ovl_30_func_8012EFEC (m) — void init leaf: zeroes D_80134008 and
  D_80134B0C; no callers or callees recorded in the call graph
- ovl_30_func_8012F000 (m) — read-and-conditionally-clear of D_80134B0C,
  returning the value read
- ovl_30_func_8012F030 (m, matched byte-exact) — branches on its s32 arg to
  StoreImage/LoadImage `&D_8013400C` from `D_8005E3B0+0x4290`, then
  DrawSync(0)
- ovl_30_func_8012F084 (s) — main consumer of both globals (data-family
  member only)
- ovl_30_func_8012FDEC (m, matched byte-exact this session) — L2/R2 repeat-
  delay counter for D_80134B14: +1 and wrap-to-zero on bit 0x2000 of
  `D_8005E3A8->field_0x0`, -1 with zero-to-0x100 on bit 0x8000; caller
  ovl_30_func_8012F454 shares the counter (data-family member only)

## `ovl_30` mirror sibling pair — 0x8012F3D4 / 0x8012F410 (confidence: medium)

Two call-sequence leaves in `ovl_30` (`Obj\GF_swind.bin`):

- **gapless link adjacency:** `ovl_30_func_8012F3D4` (0x3C bytes at
  0x8012F3D4, matched) ends exactly at `ovl_30_func_8012F410` (0x3C bytes at
  0x8012F410, matched byte-exact this session) — one unbroken link run;
- **identical call shape, one differing constant:** both emit the same
  three-call sequence `func_80020B80(2, 0)`, `func_80020B80(1, 0)`,
  `func_8001FBF0(<k>, 0)` — 8012F3D4 uses 0x3E7, 8012F410 uses 0x3E8;
- **what the tie is not:** the next link neighbours (`ovl_30_func_8012F44C`,
  empty leaf; `ovl_30_func_8012F454`, stub) share no call shape with the pair.

Members (link order):
- ovl_30_func_8012F3D4 (m) — call-sequence leaf, constant 0x3E7
- ovl_30_func_8012F410 (m) — call-sequence leaf, constant 0x3E8

## `ovl_30` size-selected field writer with its caller and neighbour — 0x80133454 / 0x80133974 / 0x80133A8C (confidence: medium)

A record-field update cluster in `ovl_30` (`Obj\GF_swind.bin`):

- **gapless link adjacency:** `ovl_30_func_80133454` (0x520 bytes at
  0x80133454) ends exactly at `ovl_30_func_80133974` (0x118 bytes at
  0x80133974, matched byte-exact this session), which ends exactly at
  `ovl_30_func_80133A8C` (0x4E4 bytes at 0x80133A8C) — one unbroken link run;
- **direct call edge:** 80133454 calls 80133974 from its input-handling tail
  (0x80133914 and 0x8013393C), both times with `arg0 = lw record+0x0`,
  `arg1 = lbu record+0xC`, `arg2 = lw record+0x8`, `arg3 = lh record+0x4`,
  and `arg4` (a delta) on the stack — 80133974 is the shared
  size/signedness-selected field writer for the record at
  `base + D_80134014*20`;
- **shared overlay-local data cluster:** 80133454 and 80133A8C both reference
  D_8012EFB0/D_8012EFB8/D_8012EFD0/D_8012EFD4/D_8012EFD8/D_8012EFE8,
  D_80134014 (0xC past this ledger's D_80134008), D_80134B10 (4 past
  D_80134B0C) and D_8005E3A8, and both call KanjiFntPrint and func_8001FABC;
- **what the tie is not:** 80133974 touches no global and makes no call, so
  its membership rests on the call edge and the link run, not on the data
  cluster.

Members (link order):
- ovl_30_func_80133454 (s) — walks the 20-byte record array by
  `D_80134014`, dispatches on the +0xC size byte to KanjiFntPrint, and in its
  input tail calls 80133974 to add a delta to the current record's field
- ovl_30_func_80133974 (m, matched byte-exact this session) — leaf: selects a
  1/2/4-byte load from `arg0` by `arg1` and a sign/zero mode by `arg3`, adds
  `arg4` (stack), clamps against `arg2`/`arg3`, and stores back with the same
  width; no globals or calls
- ovl_30_func_80133A8C (s) — same global cluster as 80133454, also a
  KanjiFntPrint / func_8001FABC caller (data-family member only)

## `ovl_11` D_801273D8/D_801273DA init/reset pair — 0x800FFA28 / 0x800FFA40 (confidence: medium)

- **gapless link adjacency:** `ovl_11_func_800FFA28` (0x18 bytes at 0x47C08)
  ends exactly at `ovl_11_func_800FFA40` (0x24 bytes at 0x47C20) — one
  unbroken link run, both members matched byte-exact;
- **adjacent-band predecessor chain (new evidence):** the pair head sits at
  the end of one unbroken 0x800FF8C8–0x800FFA40 link band —
  `ovl_11_func_800FF8C8` (0xA4, ends exactly at 0x800FF96C) →
  `ovl_11_func_800FF96C` (0xBC, matched, ends exactly at 0x800FFA28) → the pair
  — the middle member touches none of the `D_801273xx` region, so its band tie
  is link adjacency alone.
  800FF8C8 is a `D_801273B0` handler (0x21 → advances to 0x20 on
  `func_800226A4() == 2`) whose sibling state word `D_801273B0` is the
  init/trigger word of matched `ovl_11_func_800FEBF8`/`ovl_11_func_800FEC2C`,
  and whose event tail (`func_800226D8(0)` / `func_80017B18(0)` /
  `func_8002261C(3, 0x3B3)`) is the `D_801273Exx` run's handler idiom; it does
  not itself touch `D_801273D8`/`D_801273DA`, so the tie to the pair is link
  adjacency plus the shared `D_801273xx` state region and handler idiom;
- **shared globals with complementary roles:** 800FFA28 is the init leaf —
  zeroes `D_801273D8` and sets `D_801273DA = 0xFF`; 800FFA40 calls 800FFA28
  then clears `D_801273DA` back to 0 (init + reset of the same flag pair);
- **sole referencers:** no other function in `src/` touches
  `D_801273D8`/`D_801273DA`; 800FFA40's one call edge is to 800FFA28, and the
  caller (`ovl_11_func_800C7AC0` state machine) ignores the return value.

Members (link order):
- ovl_11_func_800FF8C8 (m, matched this session, byte-exact) — adjacent-band
  predecessor: `D_801273B0` state machine (0x21 branch queues
  `func_8002261C(3, arg1 + 0x37E)` or `(3, arg0 + 0x37B)`, then on
  `func_800226A4() == 2` calls `func_80022738()` and advances `D_801273B0` to
  0x20; the 0x20 state calls `func_800226D8(0)` / `func_80017B18(0)` /
  `func_8002261C(3, 0x3B3)`) — role tied to the pair by gapless link band and
  the shared `D_801273xx` handler idiom, not by `D_801273D8`/`D_801273DA`
- ovl_11_func_800FF27C (m, matched this session, byte-exact) — second
  `D_801273B0` state handler sharing 800FF8C8's event tail: 0x11 branch queues
  `func_8002261C(3, arg1 + (arg0 * 5 + 0x367))`, then on
  `func_800226A4() == 2` calls `func_80022738()` and advances `D_801273B0` to
  0x10; the 0x10 state calls `func_800226D8(0)` / `func_80017B18(0)` /
  `func_8002261C(3, 0x3B2)`. Same handler idiom as 800FF8C8 with adjacent state
  constants (0x11↔0x10 against 0x21↔0x20), the same callee cluster
  (`func_8002261C`/`func_800226A4`/`func_80022738`/`func_800226D8`/
  `func_80017B18`) and the same `D_801273B0` base-reuse codegen; membership
  rests on the shared handler/idiom fingerprint and the shared state-word
  cluster, not on link adjacency
- ovl_11_func_800FF96C (m, matched this session, byte-exact) — middle band
  member: reads the three work-area s16 flags at `D_8006C838`+0x8000+
  +0x64CE/+0x64D0/+0x64D2 via two-stage `base += 0x8000` bases and dispatches
  each to a setter pair (`func_80013AEC(1/0)`; `func_80020A40`/`func_80020A14`;
  `ovl_11_func_800FB608`/`ovl_11_func_800FB628`); touches no `D_801273xx`
  global, so its membership here is the gapless band alone
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
- ovl_17_func_800B90F8 (m, 0x60, byte-exact, finalized) — initializes the
  90 stride-8 entries at +0x2D8/+0x2DC and sets their +0x5A8 cursor to 6.
  Every word becomes -0x20000; the halfword is -1 except the first six,
  which receive `0x4D + 0x1A*i`. Its signed-halfword count-up loop and
  indexed members naturally produce the original's fixed-point induction
  sequence. This corroborates the gapless initializer/append pair; shared
  storage still does not prove TU co-membership.
- ovl_17_func_800B9158 (m, byte-exact, finalized) — appends an s32 and s16
  to the separate 90-entry stride-8 array at D_800BD848+0x2D8/+0x2DC,
  wrapping its signed halfword cursor at +0x5A8. Gapless predecessor
  800B90F8 initializes these exact fields and the cursor, independently
  establishing a local initializer/writer pair within this broad data
  cluster. The evidence-gated -fno-cse-skip-blocks flag preserves the
  original's different operand orders at the two address calculations;
  four matched regional witnesses have unchanged text under it. Neither
  the flag nor today's source files establishes a TU boundary.
- ovl_17_func_800B9F10 (m) — leaf predicate: returns
  `(s16)arg1 < record[arg0].s16@+0x2A` over the D_800BD848 record area.
- ovl_17_func_800B9F44 (m) — leaf predicate twin of 800B9F10: returns
  `record[arg0].s16@+0x36 >= 0x51`; same `base = D_800BD848; scaled = arg0 * 0x50;`
  idiom and shape set as 800B9F10 (10 of 13 shapes align in order).
- ovl_17_func_800B9E94 (m, 2026-10-04) — cross-record predicate over the same
  0x50-stride area (s32@+0x38): returns 1 when some record other than arg0 has
  `record[i].s32@+0x38 - record[arg0].s32@+0x38` within [0, 0x59FFF]. Called
  via hub member ovl_17_func_800B9CE4; gapless link-order neighbour of 800B9F10
  (`+0x7C`), so the link run and the call graph agree.
- ovl_17_func_800B9CE4 (m, 2026-10-07) — caller hub over the same 0x50-stride
  area: selects ovl_17_func_800B9DB8/800B9DE0 by function pointer on
  `record[work.s16@+0x2BC].s32@+0x38 < work.s16@+0x2D2 << 12`, indexing both
  records through `base = D_800BD848` + 0x50 stride, invokes the chosen wrapper on
  `record[arg0].s16@+0x42`, then calls the matched 800B9E94 and
  ovl_17_func_800B9E0C on `record[arg0].s16@+0x44`. Shares the 0x50-stride and
  s32@+0x38 field with 800B9E94/800B986C and sits in the gapless link-order run
  800B9C48 → 800B9CAC → 800B9CE4 → 800B9DB8, whose tail is the Rand-wrapper
  trio it dispatches; this is the call edge binding 800B9E94 to the cluster.
- ovl_17_func_800B9C48 (m) — leaf getter over the first D_800BD848 record:
  s16 fields at +0x8/+0xA/+0xC; returns `(u16)field8 + field8 * (arg0 +
  fieldA) * fieldC / 25500`. Link-adjacent (`+0x64`) to 800B9CAC and the
  D_800BD848 cluster entry point.
- ovl_17_func_800B9CAC (m, 2026-10-03) — countdown walk of 6 D_800BD848
  records (0x50 stride): bumps each s16@+0x2A by 5 when it is < 0xFF; same
  `base = D_800BD848` + 0x50-stride record idiom as 800B9F10/800B9F44.
- ovl_17_func_800B986C (m, 2026-10-07) — 0x50-stride walk of 6 D_800BD848
  records clamping s32@+0x38 to 0x940000, plus a record lookup at
  work.s16@+0x2BC; calls the matched D_800BD848 work-area neighbour
  ovl_17_func_800BB094, and sole caller ovl_17_func_800B8898 (which calls
  800B9C48/800B9CAC/800B9594/800B9324) reads its result. Same
  `base = D_800BD848` + 0x50-stride and s32@+0x38 field as 800B9E94; gapless
  link-order run 800B9784 → 800B986C → 800B9940.
- ovl_17_func_800B9594 (m, 2026-10-05) — countdown walk of 6 D_800BD848
  records (0x50 stride): decays each s16@+0x2E toward s16@+0x2C by
  `(rec[0x2E] - rec[0x2C]) * 0xFF / ((rec[0x2A] + 1) * work.s16@+0x14)` and
  clamps to s16@+0x2C; same `base = D_800BD848` + 0x50-stride countdown idiom
  as 800B9CAC.
- ovl_17_func_800BAFDC (m, 2026-11-01) — countdown walk of 6 D_800BD870
  records (0x50 stride): calls ovl_17_func_800BAFAC(base); same
  `base = D_800BD870` + 0x50-stride countdown idiom as 800B9CAC and the
  still-unmatched twin ovl_17_func_800B8534 (interleaved 0xF0/0x50 walk,
  calls 800BAC24).
- ovl_17_func_800BB050 (m, 2026-11-01) — byte-identical shape to 800BAFDC
  (16/16 instruction shapes, identical toolchain): countdown walk of 6
  D_800BD870 records (0x50 stride), calls ovl_17_func_800BB020(base).
- ovl_17_func_800B9324 (s) — caller hub: twice calls 800B9F10 with record
  halfword fields around calls to 800B9CE4/800B9F44/800B9F78.
- func_800B8470 (s) — counter reset that walks the same records from
  D_800BD870 with the 0x50 stride (5 records, per-record func_800BAC24 call).

Additional adjacency: the gapless link-order run `ovl_17_func_800BAEF0`
(0x60) → `ovl_17_func_800BAF50` (0x5C) → matched `ovl_17_func_800BAFAC`
(0x30); 800BAEF0 and 800BAF50 both address the D_800BD848 work area (at
+0x28C/+0x290 and +0x230/+0x231 via the +0x22C alias `D_800BDA74`) and all
three call `func_80015840(ObjectState *, s8)`.

- ovl_17_func_800BAF50 (m, 2026-10-03) — D_800BD848 work-area sprite setup:
  `func_80015840(&D_800BDA74, 4)` then
  `func_80015EE8(D_8005E3C0->field_D8 + 4, &D_800BDA74, work[0x230],
  work[0x231], 0, 0)`; link-adjacent to 800BAEF0/800BAFAC, same
  func_80015840 callee.

## `ovl_17` Rand(100) percentage-roll wrapper trio + predicate — 0x800B9DB8–0x800B9E34 (confidence: medium)

Evidence: call graph and link order agree. `ovl_17_func_800B9DB8`,
`ovl_17_func_800B9DE0`, `ovl_17_func_800B9E0C` and `ovl_17_func_800B9E34`
form one gapless link-order run (9DB8 + 0x28 = 9DE0, + 0x2C = 9E0C,
+ 0x28 = 9E34), and each of the three wrappers is a direct caller of the
predicate. The predicate is the run's only caller of the exe `Rand`
(func_80012A34) and passes it 0x64.

Members (link order):
- ovl_17_func_800B9DB8 (m) — s16 wrapper: `ovl_17_func_800B9E34(arg0 + 1)`.
- ovl_17_func_800B9DE0 (m) — s16 wrapper: `ovl_17_func_800B9E34(0x7F - arg0)`.
- ovl_17_func_800B9E0C (m) — s16 wrapper: `ovl_17_func_800B9E34(arg0 + 1)`.
- ovl_17_func_800B9E34 (m, 2026-10-03) — leaf percentage predicate:
  `func_80012A34(0x64) < (u16)((arg0 * 100) / 127)`.

## `ovl_17` D_800BB524 display-setup state-handler run — 0x800B9FA8–0x800BA54C (confidence: medium)

Evidence: the dispatcher `ovl_17_func_800B7E78` (s) selects on the state byte
`D_800BB524` and, from consecutive jump-table branches, calls
`ovl_17_func_800B9FA8`, `ovl_17_func_800BA21C`, `ovl_17_func_800BA2C8` and
`ovl_17_func_800BA504`, then on its terminal state calls
`ovl_17_func_800BA54C`. Those five members are one gapless link-order run
(9FA8 + 0x274 = BA21C, + 0xAC = BA2C8, + 0x23C = BA504, + 0x48 = BA54C), so
the call graph and the link order agree. The recovered handlers share the
display-setup idiom `DrawSync` → `ClearOTagR` → `func_80014CBC` →
`func_8001719C` → `func_80015704`.

Members (link order):
- ovl_17_func_800B9FA8 (s) — display-setup state: DrawSync/ClearOTagR plus
  func_80014CBC/1719C/15704
- ovl_17_func_800BA21C (m, matched 2026-06-11) — same display-setup idiom,
  confirmed: DrawSync(0) / ClearOTagR(D_8005E3C0->field_120,0x800), then
  func_80014CBC over D_8005E3B0+0x4290 with a zero-return poll, func_8001719C
- ovl_17_func_800BA2C8 (s) — same display-setup idiom, plus D_800BD74C/
  D_800BD750 stores
- ovl_17_func_800BA504 (m) — audio-setup leaf: func_80020B80(2,0),
  func_80020B80(1,0), func_8001FBF0(0x3E7,0), func_8001FBF0(0x15,1)
- ovl_17_func_800BA54C (s) — D_800BD848 record-area initialiser (calls
  800BA630/800BA698/800BA704/800BB0C4)

Cross-container note: 800BA504's leading three calls are the same sequence the
`ovl_30` mirror pair 8012F3D4/8012F410 emit; that twin relation is not
TU-membership evidence here.

## `ovl_28` D_800B9626/D_800B9628/D_800BAB0C state-cluster run — 0x800B92F0 / 0x800B9328 / 0x800B935C (confidence: medium)

Evidence: one gapless link-order run over one ovl_28 state cluster —
`ovl_28_func_800B92F0` (0x38) ends exactly at `ovl_28_func_800B9328` (0x34,
matched this session, byte-exact), which ends exactly at the matched
`ovl_28_func_800B935C` — and all three touch the same globals:
`D_800B9626` (state halfword), the four-halfword record `D_800B9628`, and
`D_800BAB0C`. The two initialisers are construction twins: 0x800B92F0's
original is 0x800B9328's with the constant 1 instead of 2 and
`D_800BAB0C = 0xFF` instead of 0, sharing the identical
`D_800B9626 = N; D_800BAB0C = X; record stores` source order (a
declaration-order fingerprint: the BAB0C address `lui` precedes the D_800B9628
`lui` in both). 0x800B9074 also reads/writes all three globals but sits
0x27C earlier in link order — data-family member only.

Members (link order):
- ovl_28_func_800B92F0 (m) — twin initialiser: `D_800B9626 = 1`,
  `D_800BAB0C = 0xFF`, record = (a0, a1, 0x50, 0x50)
- ovl_28_func_800B9328 (m, matched this session) — initialiser:
  `D_800B9626 = 2`, `D_800BAB0C = 0`, record = (a0, a1, 0x50, 0x50)
- ovl_28_func_800B935C (m) — predicate: returns `D_800B9626 == 0`

## `ovl_27` D_800C4A14/D_800C4A1C state-handler cluster — 0x800B845C–0x800B92E4 (confidence: low)

Evidence: `ovl_27_func_800B8E28` (matched this session, byte-exact) is a
state transition: it calls the hub `ovl_27_func_800B92E4`, resets
`D_800C4A1C = 0`, installs `ovl_27_func_800B8E5C` as the
`D_800C4A14` handler and returns that pointer — and `D_800C4A14`'s data
initializer is `ovl_27_func_800B8E28` itself, so the slot is a self-starting
function-pointer state machine shared across the neighborhood. `ovl_27_func_800B8E5C`
(matched this session) confirms the slot is a handler chain: it advances
`D_800C4A14` to `ovl_27_func_800B8EA0` at `D_800C4A1C == 0x1E`. The call graph
is a star: `ovl_27_func_800B92E4` (itself a driver over five siblings) is
called by nine functions in one gapless link-order run, 0x800B845C–0x800B90DC.
The original asm of every function in that run plus `800B7F2C`, `800B7F7C` and
`800B9FF4` touches `D_800C4A14` and/or `D_800C4A1C`.

Members (link order):
- ovl_27_func_800B7F2C (s, matched this session) — state-block reset wrapper:
  calls the initializer `ovl_27_func_800B7F7C`, then clears `D_800C4A1C` and
  zeroes `D_800C4A18`/`D_800C4A24`/`D_800C4A26`/`D_800C4A28`, re-setting
  `D_800C4A1A = 1`; it shares the whole halfword state block with 800B7F7C
- ovl_27_func_800B7F7C (s, matched this session) — state-block initializer:
  `D_800C4A1C = 0`, `D_800C4A1A = 1`, zeroes `D_800C4A2C`–`D_800C4A36`, then
  `D_800C4A38 = -0xA0`, `D_800C4A3A = 0x30`, `D_800C4A3C = 0x140`; the last
  two are the fields read by handlers `800B8EA0`/`800B8EF8`, confirming the
  cluster's halfword state lives beside `D_800C4A14`/`D_800C4A1C`
- ovl_27_func_800B8E28 (s, matched this session) — handler transition:
  hub call, `D_800C4A1C = 0`, `D_800C4A14 = ovl_27_func_800B8E5C`, returns it
- ovl_27_func_800B8E5C (s, matched this session) — timer stage: hub call, then
  `D_800C4A14 = ovl_27_func_800B8EA0` once `D_800C4A1C >= 0x1E`, confirming the
  slot chains handlers in this run
- ovl_27_func_800B8EA0 (m) — next `D_800C4A14` handler installed by 800B8E5C;
  its asm installs `ovl_27_func_800B8EF8` once `D_800C4A38 >= 0`
- ovl_27_func_800B8EF8 (m, matched this session, byte-exact) — next handler in
  the chain: hub call, `ovl_27_func_800B93B4(0)`, `ovl_27_func_800B9368(D_800C4A3A)`,
  then advances `D_800C4A14` to `ovl_27_func_800B8F58` once `D_800C4A3A <= 0`
- ovl_27_func_800B8F58 (m, matched this session, byte-exact) — next handler in
  the chain: hub call, `ovl_27_func_800B93B4(0)`, `ovl_27_func_800B9368(0)`,
  `ovl_27_func_800B9400(D_800C4A3C)`, then decrements `D_800C4A3C` by 2 and
  zeroes `D_800C4A1C` and advances `D_800C4A14` to `ovl_27_func_800B8FC8` once
  `D_800C4A3C <= 0`
- ovl_27_func_800B8FC8 (m, matched this session, byte-exact) — the handler
  800B8F58 advances to: hub call, `ovl_27_func_800B93B4(0)`,
  `ovl_27_func_800B9368(0)`, `ovl_27_func_800B9400(0)` while
  `D_800C4A1C % 30 < 0xF`, then advances `D_800C4A14` to
  `ovl_27_func_800B9064` once `D_800C4A1C >= 0x5A`
- ovl_27_func_800B9064 (m, matched this session, byte-exact) — final member of
  the run: hub call, `ovl_27_func_800B93B4(0)`, `ovl_27_func_800B9368(0)`,
  `ovl_27_func_800B9400(D_800C4A3C)`, then retreats `D_800C4A3C` by 2 and
  installs `ovl_27_func_800B90DC` as the `D_800C4A14` handler once
  `D_800C4A3C <= -HWD0`; it is the only member gated on the libgs `HWD0`
  register rather than a state halfword
- ovl_27_func_800B92E4 (m) — shared driver hub; nine callers in the run

Nine members matched; the rest of the cluster is read off original asm
and the call graph, hence low confidence until more of the run is decompiled.

Calved in by call graph and shared state, outside the gapless run:
- ovl_27_func_800B8D28 (m, matched this session, byte-exact) — 0x800B8D28,
  inside the run's address extent but not a hub caller: reads the
  `D_800C4A26`/`D_800C4A1A` halfwords that `ovl_27_func_800B7F2C` initialises
  (and that `800B9FF4` reads), clearing `D_8006C838`+0x4450 and +0x4488 and
  seeding four s16 `D_8006C838` cells via `func_80012A34(0xFFFF)`. It touches
  neither `D_800C4A14`/`D_800C4A1C` nor the hub, so it is calved in by the
  shared halfword state block, not by the handler chain.
- ovl_27_func_800B9FF4 (m, matched this session, byte-exact) — 0x800B9FF4,
  between the run and the 0x800BA4C4 display-setup run: selects the
  `func_80015F80` argument pair `D_800C4A1C % 30 < 0xF` → 0x64/0x68 and
  `D_800C4A1A == 0` → 0x9B/0xB3, then draws `field_D8+0x88` with `&D_800C4BD0`.
  Shares the cluster's `D_800C4A1C`/`D_800C4A1A` halfword state block and the
  exact `D_800C4A1C % 30 < 0xF` predicate already recorded for 800B8FC8.
- ovl_27_func_800BA130 (m, matched this session, byte-exact) — sprite-draw
  leaf: `func_80022580(field_D8+4, 1, 0x10, 0x10, 0x78, 0x14)` then
  `func_80017B3C(field_D8, data, 0x14, 0x14)`, where `data` is the s16-indexed
  table `D_800C4A50` offset by `*D_80054BBC` and `&D_8005175C`. Called four
  times by the run-opening member `ovl_27_func_800B845C` (0x800B845C), and
  `D_800C4A50` sits 0x3C past `D_800C4A14`, abutting the cluster's halfword
  state block. It is not part of the 0x800B845C–0x800B92E4 gapless run (it
  sits at 0x800BA130, link-adjacent to 800BA0EC/800BA1CC), so membership
  stays low confidence.

Not a member of this cluster: `ovl_27_func_800B8C6C` (0x800B8C6C, matched this
session, byte-exact) sits inside the 0x800B845C–0x800B92E4 run but touches
neither `D_800C4A14`/`D_800C4A1C` nor the hub `ovl_27_func_800B92E4`; it is a
`D_8006C838` counter leaf (below), so the run is not uniform. The entry's
membership is unchanged — this only narrows its address extent.

Second non-member, gapless between `800B90DC` and `800B9224`: `ovl_27_func_800B9124`
(0x800B9124, matched this session, byte-exact) — sprite-draw leaf: reads the
`D_8006C838` halfwords at +0x5246/+0x5248 through a local
`base = (u8 *)&D_8006C838`, formats the `D_800C5920` scratch string, and draws
the `D_80051AF6 + *D_80054BBC` table via `func_80022580`/`func_80017B3C` — the
same ovl_27 sprite-draw idiom recorded for `ovl_27_func_800BA130`, so its TU
membership sits with that idiom set, not the D_800C4A14 handler cluster.

## `ovl_27` parallel slot-array effect family — 0x800B998C–0x800B9EEC (confidence: medium)

Evidence: shared gp-rel cluster + shared idiom + link adjacency. Six sibling
functions carry one body template — increment a per-slot halfword counter,
`func_80015BF0(D_8005E3C0->field_D8 + ..., slot_buffer, a, b)`, then once the
counter reaches 0x5A call `func_80012A34(0xA)`/`func_80015840(slot_buffer, r)`
to redraw. Each sibling owns one counter and one buffer of a parallel array
pair: counters `D_800C4A2C`+2i (i=0..5), buffers `D_800C4A80`+0x30i. The
counter span 0x4A2C–0x4A36 is exactly the range zeroed by
`ovl_27_func_800B7F7C` of the D_800C4A1C state-block cluster above, so the
family indexes the same file-scope halfword state block. Link order is
gapless 0x800B998C→0x800B9A8C→0x800B9B98→0x800B9C84 and
0x800B9CB4→0x800B9DBC→0x800B9EEC; 0x800B998C starts where the 0x540 hub
`ovl_27_func_800B944C` ends, and 0x800B9EEC ends where the already-recorded
`ovl_27_func_800B9FF4` begins.

Members (link order):
- ovl_27_func_800B998C (m, matched this session, byte-exact) — slot 0: mod-1800
  counter `D_800C4A2C`, buffer `D_800C4A80`, redraw every `>= 0x5A`
- ovl_27_func_800B9A8C (m, matched this session, byte-exact) — slot 1: mod-1800
  counter `D_800C4A2E`, buffer `D_800C4AB0`, single draw, redraw every `>= 0x3C`
  with `func_80012A34(9) + 10` clamped to a minimum of 10 (slot-1 prediction confirmed)
- ovl_27_func_800B9B98 (s) — slot 2: counter `D_800C4A30`, buffer `D_800C4AE0`
- ovl_27_func_800B9C84 (s) — wrapper hub: calls 800B9CB4, then 800B9DBC, then
  800B9EEC in one sequence; lives inside the run as the family's orchestrator
- ovl_27_func_800B9CB4 (m, byte-exact) — slot 3: counter `D_800C4A32`,
  buffer `D_800C4B10`; issues three `func_80015BF0` draws, hoisting
  `D_8005E3C0->field_D8 + 0x8C` into one local shared by all three calls (the
  multi-draw slots' shared idiom; slot 0's single draw inlines it)
- ovl_27_func_800B9DBC (s) — slot 4: counter `D_800C4A34`, buffer `D_800C4B40`;
  issues five `func_80015BF0` draws
- ovl_27_func_800B9EEC (m, matched this session, byte-exact) — slot 5: counter
  `D_800C4A36`, buffer `D_800C4B70`, redraw every `>= 0x1E`; issues three
  `func_80015BF0` draws with `D_8005E3C0->field_D8 + 0x8C` hoisted into one
  local shared by all three (same multi-draw shared idiom as slot 3)

## `D_8006C838` one-shot counter leaf, shared across ovl_17/23/25/27 (confidence: medium)

Four byte-exact leaves with one body template: `func_8001FE34(10)` then
`base = (s32 *)&D_8006C838; v = base[off >> 2] + 1; base[off >> 2] = v;
return v;`. Each overlay carries its own displacement and its own pre-call,
which is the signature of one original source compiled per overlay rather than
a single TU:
- ovl_17_func_800B8078 (m) — `func_80013328(10)`, off 0x448C
- ovl_23_func_800B80CC (m) — `func_80013328(10)`, off 0x448C
- ovl_25_func_800B81B4 (m) — `ovl_25_func_800B93E4()`, `func_80013328(10)`, off 0x448C
- ovl_27_func_800B8C6C (m, matched this session) — `func_800132F0(10, 0, 2)`, off 0x4488
- ovl_27_func_800B8CAC (m, this session) — guarded sibling of 800B8C6C (its
  immediate link-order successor, same off 0x4488 and same body template): runs
  the increment only when `func_80013394() == 1` and `func_8001FE6C() == 0`,
  after `func_8001FBBC(0)`/`func_80020818()`/`func_80020B80(2, 0)`
Any of the three matched ovl_17/23/25 members is a donor template for the
offset-0x4488/0x448C variant.

## `ovl_27` D_800C4A18 display-setup state-handler run — 0x800BA4C4–0x800BA914 (confidence: medium)

Evidence: the dispatcher `ovl_27_func_800B823C` (s, 0x800B823C–0x800B845C;
selects on the s16 state `D_800C4A18` via `jtbl_800B7E24`) calls all nine
handlers of this run from consecutive jump-table branches, and they form one
gapless link-order run (0x50+0x64+0x44+0x64+0x130+0x60+0x5C+0x8+0x100 =
ends 0x800BA914), so the call graph and the link order agree. The run shares
the display-setup idiom `DrawSync` → `ClearOTagR` → `func_80014CBC` →
`func_8001719C` and the address cluster `D_8005E3B0 + 0x4290` / `D_8005E3C0` /
`D_8007AFF4`; it is the ovl_27 twin of the ovl_17 (0x800B9FA8–0x800BA504) and
ovl_23 (0x800BB214–0x800BB758) display-setup runs, whose closing audio-setup
leaf carries the same `func_8001FBF0` call shape.

Members (link order):
- ovl_27_func_800BA4C4 (m, matched this session) — audio-setup leaf:
  `func_8001FBE4(0, D_8005E3B0+0x4290)` then `func_8001FBF0` 0 / 0x3E8 / 0x1A
- ovl_27_func_800BA514 (m, matched this session, byte-exact) — display-setup:
  DrawSync/ClearOTagR + `func_80014CBC(0,0x2A800,0x49000,D_8007AFF4,1,1)`
- ovl_27_func_800BA578 (m) — same call as 800BA514 but leaf, tail `!= 0`
- ovl_27_func_800BA5BC (s) — display-setup: DrawSync/ClearOTagR +
  `func_80014CBC(0,0x25000,0x5800,D_8005E3B0+0x4290,1,1)`
- ovl_27_func_800BA620 (s) — `func_80014CBC` + `func_8001719C(D_8005E3B0+0x566C)`
  + record copy from D_8005E3B0+0x4290
- ovl_27_func_800BA750 (m, matched this session) — display-setup:
  DrawSync/ClearOTagR + `func_80014CBC(0,0,0x2000,D_8005E3B0+0x4290,1,1)`
- ovl_27_func_800BA7B0 (m, matched this session) — guarded display-setup:
  `func_80014CBC(0,0,0x2000,D_8005E3B0+0x4290,1,0)`, on nonzero
  `func_8001719C(D_8005E3B0+0x4290)` and return 1, else return 0
- ovl_27_func_800BA80C (s) — 8-byte leaf; role unknown
- ovl_27_func_800BA814 (m, matched this session, byte-exact) — closing member,
  page-loader leaf: clamps the `D_8006C838` +0x18 selector into 0..3, `memcpy`s
  0x1000 bytes from `D_800C4A60[idx].field_4` to `D_8006C838`+0x1C(+6), then
  stores `D_800C4A60[idx].field_0` back at +0x18 and returns 1. `D_800C4A60` is
  the run's four-record `{s32 id; void *page;}` table at 0x800C4A60 (ids
  1/3/0/2, pages D_800C09F8/D_800C19F8/D_800C29F8/D_800C39F8), sitting
  immediately past `D_800C4A50`; it shares the run's link-order slot but not
  the DrawSync/ClearOTagR idiom

Not a member: `ovl_27_func_800BA230` ends exactly at 0x800BA4C4 but is called
by `ovl_27_func_800B80B0`, not by the dispatcher. Its link-order predecessor
`ovl_27_func_800BA1CC` (0x800BA1CC–0x800BA230, matched this session,
byte-exact) shares the display-setup idiom `DrawSync` → `ClearOTagR` →
`func_80014CBC(0,0x2000,0x23000,D_8005E3B0+0x4290,1,1)` and the
`D_8005E3B0+0x4290` / `D_8005E3C0` address cluster, but is called by
`ovl_27_func_800B7FE8`, not by the dispatcher.

## `ovl_27` 6-byte-record leaf run — 0x800BAA34 / 0x800BABD4 / 0x800BAC14 (confidence: low)

Evidence: a gapless link-order run ending at the ovl_27 data segment —
0x800BAA34 (0x1A0) → 0x800BABD4 (0x40) → 0x800BAC14 (0x4C) → 0x2E40 data.
`ovl_27_func_800BAC14` (matched this session, byte-exact) is a leaf copying
five 6-byte records (`s32`+`s16`) from overlay data `D_800BCFF0` to
`D_8006C838 + 0x468A`, with a count-up `u32` loop (`sltiu`/`bnez`, stride-6
pointer bump). Matched run neighbour `ovl_27_func_800BABD4` forms its
`D_8006C838` base the same two-stage way (base symbol, then a separate offset
add), and unmatched `ovl_27_func_800BAA34` carries the same count-up
`sltiu`/`bnez` stride-6 loop form (original asm, including a bound-0x5 loop).

Members (link order):
- ovl_27_func_800BAA34 (s) — leaf: multi-loop 6-byte-stride field initialiser over `D_80071A00`
- ovl_27_func_800BABD4 (m) — `D_8006C838 + 0xE4CC` s16 field writer, calls `func_80020A40`
- ovl_27_func_800BAC14 (m, matched this session) — leaf: 5×6-byte record copy `D_800BCFF0` → `D_8006C838 + 0x468A`

## `ovl_11` D_8012720C guard/set pair — 0x800FBE4C / 0x800FC320 (confidence: low)

Evidence: both functions write the same overlay-local flag `D_8012720C`
(`globals_override.h`) and both call `func_800132F0(10, 0, 2)` with the same
three constants — a shared global plus an identical constant-argument callee,
the same call-init-then-set idiom recorded for the D_80128420 cluster. They
are address-apart (0x800FBE4C vs 0x800FC320, ~0x4D4), so gapless link
adjacency does not cover them. `ovl_11_func_800FC320` (this session,
byte-exact) additionally calls `func_8001FABC(3)`, exactly as the matched
D_80128420 members 0x8011EC54/0x8011EC84 do.

Members (link order):
- ovl_11_func_800FBE4C (s) — first-time guard: if `D_8012720C == 0` set it to 1
  and call `func_800132F0(10, 0, 2)`, else return `D_8012720C`
- ovl_11_func_800FC320 (m, matched this session) — void: `func_8001FABC(3)`,
  `func_800132F0(10, 0, 2)`, `D_8012720C = 5`

## `ovl_28` D_800B9630 record-table run — 0x800B895C / 0x800B8994 / 0x800B8A20 / 0x800B8AA8 (confidence: medium)

Evidence: one gapless link-order run — `ovl_28_func_800B895C` (0x38) ends
at `ovl_28_func_800B8994` (0x8C), which ends at `ovl_28_func_800B8A20` (0x88),
which ends at `ovl_28_func_800B8AA8` — and all four walk the same 20-record
(0xC stride) `D_800B9630` table. `ovl_28_func_800B895C` and
`ovl_28_func_800B8994` additionally read the same SDK global `VWD0` and each
write `VWD0 << 12` into a record's s32@+0x8; `800B8A20` reads the adjacent
`D_800B9720` (end of the table) as a call argument.

Members (link order):
- ovl_28_func_800B895C (m, matched this session) — initialiser: fills all 20
  records with (s32@+0 = 0, s16@+4 = 0, s32@+8 = `VWD0 << 12`)
- ovl_28_func_800B8994 (s) — allocator: finds the first record with
  unk0 == 0, writes (1, arg0, `VWD0 << 12`) there, or returns if full
- ovl_28_func_800B8A20 (s) — walker: for records with unk0 == 1, feeds
  unk8 and unk4 into `func_80015EE8`
- ovl_28_func_800B8AA8 (m, matched this session) — updater: for records with
  unk0 == 1, subtracts `D_800B93B4` from unk8 and clears unk0 when the result
  underflows below `-0xE000`

Only two members are matched; the rest are read off original asm, hence medium
confidence. `ovl_28_func_800B8AA8`'s read of `D_800B93B4` places the record-table
run in the same TU as the `D_800B93B4` setup/consumer pair `ovl_28_func_800B8414`
(writes 0x800) and `ovl_28_func_800B8478` (divides 0x10000 by it).

## `ovl_28` D_8005E3B0+0x4290 display-setup run — 0x800B8B0C / 0x800B8B70 / 0x800B8C94 / 0x800B8CE4 / 0x800B8D48 (confidence: medium)

Evidence: one gapless link-order run — `ovl_28_func_800B8B0C` (0x64) ends at
`ovl_28_func_800B8B70` (0x124), which ends at `ovl_28_func_800B8C94` (0x50),
which ends at `ovl_28_func_800B8CE4` (0x64), which ends at
`ovl_28_func_800B8D48` (0x154) — and all five share the display-setup idiom
`func_8003B3E0`/`func_8003B8CC` (DrawSync/ClearOTagR) → `func_80014CBC` →
`func_8001719C` over the `D_8005E3B0 + 0x4290` primitive buffer, plus the
`func_80015704`/`func_80015840` record-handoff pair. It is the ovl_28 twin of
the ovl_27 0x800BA4C4–0x800BA914 display-setup run (and of the ovl_17/ovl_23
runs). `ovl_28_func_800B8E9C` ends exactly at 0x800B9074 but is not a member:
it builds POLY_FT4 primitives via `func_80011F5C`/`func_80011FD8`.

Members (link order):
- ovl_28_func_800B8B0C (s) — display-setup: DrawSync(0)/ClearOTagR +
  `func_80014CBC(0,0x3D77000,0x6000,D_8005E3B0+0x4290,1,1)`
- ovl_28_func_800B8B70 (s) — display-setup: same call with tail arg 0 +
  `func_8001719C(D_8005E3B0+0x4900)` + record copy from D_8005E3B0+0x4290
- ovl_28_func_800B8C94 (m, matched this session, byte-exact) — audio-setup
  leaf: `func_8001FBE4(0, D_8005E3B0+0x4290)` then `func_8001FBF0` 0 / 0x3E8 / 0x23
- ovl_28_func_800B8CE4 (m, matched this session, byte-exact) — display-setup:
  DrawSync(0)/ClearOTagR(D_8005E3C0->field_120,0x800) +
  `func_80014CBC(0,0x2000,0x23000,D_8005E3B0+0x4290,1,1)`
- ovl_28_func_800B8D48 (s) — display-setup: same call with tail arg 0 +
  `func_8001719C(D_8005E3B0+0x4FAC)` + record copy from D_8005E3B0+0x4290,
  tail `func_80015840` 31

The audio leaf and ovl_28_func_800B8CE4 are matched; the rest are read off
original asm, hence medium confidence.

## `ovl_21` display-setup state-handler run — 0x800BB328–0x800BBA3C (confidence: medium)

Evidence: the dispatcher `ovl_21_func_800B7E98` (s) selects on the state byte
`D_800BCBB8` through `jtbl_800B7E24` and, from consecutive jump-table branches,
calls `ovl_21_func_800BB328`, `ovl_21_func_800BB59C`, `ovl_21_func_800BB648`,
`ovl_21_func_800BB8B8` and `ovl_21_func_800BBA3C`. Those five are one gapless
link-order run (0xBB328 + 0x274 = 0xBB59C, + 0xAC = 0xBB648, + 0x270 = 0xBB8B8,
+ 0x184 = 0xBBA3C, ending exactly where the ovl_21 data section begins), so the
call graph and the link order agree — the same fingerprint as the documented
`ovl_17` (0x800B9FA8–0x800BA54C) and `ovl_23` (0x800BB214–0x800BB758)
display-setup runs. The leading handlers share the display-setup idiom
`DrawSync` → `ClearOTagR` → `func_80014CBC` → `func_8001719C` (800BB328/
800BB648 additionally `func_80015704`) and the run closes with the per-overlay
audio-setup leaf, mirroring the ovl_17 run's 800BA504.

Members (link order):
- ovl_21_func_800BB328 (s) — display-setup state: DrawSync/ClearOTagR plus
  func_80014CBC/1719C/15704
- ovl_21_func_800BB59C (m, matched this session, byte-exact) — second state
  handler, same idiom confirmed: DrawSync(0) /
  ClearOTagR(D_8005E3C0->field_120, 0x800), then `func_80014CBC(0, 0, 0x2000,
  D_8005E3B0 + 0x4290, 1, 1)` followed by the zero-return poll
  `func_80014CBC(..., 1, 0) == 0`, then `func_8001719C(D_8005E3B0 + 0x4290)`.
- ovl_21_func_800BB648 (s) — same display-setup idiom with the repeated
  `func_80015704` tail
- ovl_21_func_800BB8B8 (s) — same run's non-display handler: reads the
  `D_8007AFF0` far base, block-copies 0xBD0 bytes to `D_8009F78C` and calls
  func_80014BCC/1719C (also a member of the D_8007AFF0 entry above)
- ovl_21_func_800BBA3C (m, matched, byte-exact) — audio-setup leaf:
  `func_80020B80(2,0)`, `func_80020B80(1,0)`, `func_8001FBF0(0x3E7,0)`,
  `func_8001FBF0(0x12,1)`

Cross-container note: `ovl_21_func_800BB59C` is the same-slot (0xAC, second)
twin of the now-matched `ovl_17_func_800BA21C` and `ovl_23_func_800BB488`
(byte-exact); as recorded at the
audio-setup twin notes, that relation is not itself TU-membership evidence —
here only the dispatcher call graph and the gapless link run are.

## `ovl_21` D_8007AFF0 far-buffer state writer + GTE reader — 0x800BB0F8 / 0x800BB138 / 0x800BB250 / 0x800BB2B4 (confidence: medium)

Evidence: gapless link adjacency (0x800BB0F8 is 0x40 and ends exactly at
0x800BB138) plus a shared far-buffer global cluster: `ovl_21_func_800BB0F8`
writes the `D_8007AFF0` far-buffer s32 block at +0x25394/+0x25398/+0x2539C/
+0x253A0/+0x253A4 and clears the halfwords +0x253B4/+0x253B6/+0x253B8, and its
link successor `ovl_21_func_800BB138` builds the same `D_8007AFF0+0x20000`
far base (same `lui`+`addu` idiom) and reads +0x25394 and +0x253A0 as the
rotation/translation inputs to `RotMatrix`/`SetRotMatrix`/`RotTrans`. A third
`ovl_21` function, `ovl_21_func_800BB8B8` (0x800BB8B8), also reads the
`D_8007AFF0` base (three `lw %lo(D_8007AFF0)` uses, one at +0xBD0 and one at
+0x2000) and copies a 0xBD0-byte block out of it to `D_8009F78C`, and its
gapless successor `ovl_21_func_800BBA3C` (0x800BBA3C, the last code function
before the ovl_21 data section) closes the same contiguous code run, so the tie
is adjacency + write/read of the shared cluster. A fourth `ovl_21` function,
`ovl_21_func_800BB250` (0x800BB250), sits inside that same 0x800BB0F8–0x800BB8B8
run and reads the identical `D_8007AFF0+0x20000` far base (same `lui`+`addu`
idiom), taking the +0x253AC/+0x253AE/+0x253B0/+0x253B4/+0x253B6/+0x253B8
halfwords written/cleared by `ovl_21_func_800BB0F8` and forwarding them to the
GTE helpers `func_8001B9F8`/`func_8001BA40`, so it joins by the shared cluster
and the run. A fifth `ovl_21` function, `ovl_21_func_800BB2B4` (0x800BB2B4),
is the gapless link successor of `ovl_21_func_800BB250` (0x3430 + 0x64 =
0x3494) and repeats the same far-base read of the identical
+0x253AC..+0x253B8 halfword state block, forwarding the same two derived
vectors to `func_8001C0D4` together with `&D_800C0DD8` (an `ovl_21` data
descriptor), so it joins by adjacency and the shared cluster. Cross-container note: `ovl_21_func_800BB0F8` is
byte-identical to matched `ovl_19_func_800BB318` and a near-twin of matched
`ovl_11_func_800DB7F0` (same far base, same s32 block), so the same reset code
was copied into several overlays; that twin relation is not TU-membership
evidence here.

Members (link order):
- ovl_21_func_800BB0F8 (m, matched this session, byte-exact) — leaf initialiser:
  stores -0x2328/-0x1194/0/-0x200/0 into the `D_8007AFF0` +0x25394..+0x253A4 s32
  block and zeroes the +0x253B4/+0x253B6/+0x253B8 halfwords.
- ovl_21_func_800BB138 (m, matched this session, byte-exact) — link successor;
  builds a GTE matrix from `GsIDMATRIX` and the writer's +0x253A0/+0x25394 state
  fields, calls the PSY-Q GTE helpers, and stores the transformed result back
  into the same far-buffer +0x253AC/+0x253AE/+0x253B0 halfword block.
- ovl_21_func_800BB8B8 (s) — reads the `D_8007AFF0` base and block-copies 0xBD0
  bytes of it to `D_8009F78C` (word or unaligned lwl/lwr variants by alignment),
  then calls `func_8001BFA8`/`func_8001E340`/`func_8001E334`; also reads
  `D_800BC894`/`D_8005E3B0` and calls `func_80014BCC`/`func_8001719C`.
- ovl_21_func_800BB250 (m, matched this session, byte-exact) — reads the
  `D_8007AFF0` +0x253AC/+0x253AE/+0x253B0/+0x253B4/+0x253B6/+0x253B8 halfword
  state block via the same far base and passes it to `func_8001B9F8`
  (sum-of-pairs, 4 args) and `func_8001BA40` (3 args).
- ovl_21_func_800BB2B4 (m, matched this session, byte-exact) — gapless link
  successor of 800BB250; reads the `D_8007AFF0` +0x253AC/+0x253AE/+0x253B0/
  +0x253B4/+0x253B6/+0x253B8 halfword state via the same far base, builds two
  `VECTOR`s (pair sums for x/z, raw for y) and passes them with
  `&D_800C0DD8` to `func_8001C0D4`.
- ovl_21_func_800BBA3C (m, matched this session, byte-exact) — gapless link
  successor of 800BB8B8 (0x184, ends exactly at 0x3C1C) and terminal code
  function; per-overlay setup leaf that calls `func_80020B80(2,0)`,
  `func_80020B80(1,0)`, `func_8001FBF0(0x3E7,0)`, `func_8001FBF0(0x12,1)`. Its
  call pair is a cross-container twin of `ovl_17_func_800BA504` (0x15),
  `ovl_19_func_800BBCCC` (0xF) and `ovl_30_func_8012F3D4`; that twin relation is
  not TU-membership evidence, only the adjacency is.

## `ovl_21` D_800C0448 state-pair writer run — 0x800B9538–0x800B9644 (confidence: medium)

Evidence: gapless link adjacency (0x800B9538 ends at 0x800B9590, which ends
exactly at 0x800B95EC, which ends exactly at 0x800B9644) plus a shared
two-halfword state object `D_800C0448`.
`ovl_21_func_800B9538` and `ovl_21_func_800B9590` both write `D_800C0448[0] = 5`
behind the same `func_800226A4() == 2 && func_800225B8() == 1` guard, and
`ovl_21_func_800B95EC` clears `D_800C0448[0]` and increments `D_800C0448[1]`.
All three call `ovl_21_func_800BA4C0` and share the 0x18 frame with the
`lw $ra; nop; jr $ra; addiu $sp` epilogue. `D_800C0448` is referenced by many
other `ovl_21` functions in the 0x800B80xx–0x800BBxxx run, so this trio is a
contiguous sub-cluster of a larger `ovl_21` TU.

Members (link order):
- ovl_21_func_800B9538 (m, matched) — guarded `D_800C0448[0] = 5` / `= 0xF`
  writer; calls `func_800226A4`, `func_800225B8`, `ovl_21_func_800BA4C0`.
- ovl_21_func_800B9590 (s) — same guard writes `D_800C0448[0] = 5` after
  `func_8002261C(4, 0x18)`; calls `ovl_21_func_800BA4C0`.
- ovl_21_func_800B95EC (m, matched this session, byte-exact) — after
  `ovl_21_func_800BA4C0` and `func_80013394() == 1`, calls
  `func_800132B8(10, 0, 2)`, then clears `D_800C0448[0]` and increments
  `D_800C0448[1]`; the `lhu` increment needs the unsigned declaration.
- ovl_21_func_800B9644 (m, matched this session, byte-exact) — link
  successor of 800B95EC; reads `D_800C0448` +0x118/+0x220 into
  `ovl_21_func_800BAB28` after `ovl_21_func_800BA4C0`, then copies a u16
  within the `D_8006C838` +0x8000 sub-block and increments its +0x448C word;
  membership rests on adjacency and the shared `D_800C0448` global.
- ovl_21_func_800B9798 (m, matched this session, byte-exact) — leaf that
  writes a halfword at record offset 0x18 into three consecutive
  `D_800C0448` records starting at index `arg0*3`; membership rests on the
  shared global, not on adjacency (it is not link-adjacent to the trio).
- ovl_21_func_800B8A80 (m, matched this session, byte-exact) — calls
  `ovl_21_func_800BA4C0`, fills record offset 0x18 of six consecutive
  `D_800C0448` records (indices 5..0) and, behind `func_800226A4() == 5`,
  advances `D_800C0448 + 0x988` and writes `D_800C0448[0] = 7`; membership
  rests on the shared global and the `ovl_21_func_800BA4C0` call, not on
  adjacency (it sits at 0x800B8A80).
- ovl_21_func_800B8654 (m, matched this session, byte-exact) — same
  `func_800226A4() == 2 && func_800225B8() == 1` guard writing
  `D_800C0448[0]` (`= 2`/`= 1`), preceded by `ovl_21_func_800BA4C0()` then
  `func_8002261C(4, 0x18)` and sharing the 0x18 `$s0/$ra` frame; membership
  rests on the shared global + identical guard idiom, not on adjacency (it
  sits at 0x800B8654, well before the trio).
- ovl_21_func_800BA7F0 (m, matched this session, byte-exact) — leaf that
  reads the 32-bit word at record offset 0x14 of three consecutive
  `D_800C0448` records starting at index `arg0*3` and returns how many equal
  1; membership rests on the shared global, not on adjacency.
- ovl_21_func_800BA944 (m, 0xB4, byte-exact, finalized) — chooses a random
  index from the three records whose +0x14 word is zero, or returns -1.
  A signed-halfword count and direct `base[i].unk14` access let the compiler
  create the fixed-point-looking counter naturally (45/45 words), with no
  simulated pos/step locals or flag override. This resolves the historical
  preheader blocker: the exhaustive searches were conditioned on source
  forms with the wrong counter/constant origins, not on every clean-C form.
  The legacy imported call at 0x80012A34 is matched Rand, returning u32.
- ovl_21_func_800B9844 (m, matched this session, byte-exact) — leaf; outer
  loop over six `D_800C0448` records (stride 0x108), inner loop bounded by
  the halfword at `D_800C0448 + 0x64A` over a 0x4C sub-stride, reading a
  32-bit word at record offset 0x34 and counting entries equal to 1;
  near-twin of `ovl_21_func_800BA7F0` (same `sel/pos/step` fixed-point
  counter idiom); membership rests on the shared global and idiom, not on
  adjacency.
- ovl_21_func_800B98CC (m, byte-exact, finalized) — stores and returns a
  0/1 range predicate using s16@argument+2 and u16@argument+0x1C.
  Caller 800B8B3C passes a D_800C0448 record's +0x10 sub-view, establishing
  reads at record +0x12/+0x2C and an s32 write at +0x28. This caller-derived
  data tie, plus gapless adjacency after 800B9844, supports membership.
  The target's two store-and-return tails support the evidence-gated
  -fno-schedule-insns override; the adjacent matched 800B9844's assembled
  text is unchanged under that flag. Neither fact establishes a TU boundary
  or licenses applying the flag to the whole cluster.
- ovl_21_func_800BA868 (s) / ovl_21_func_800BA944 (m) — gapless
  link neighbours (0x800BA868 ends at 0x800BA944) that are near-twins of
  `ovl_21_func_800BA7F0`: both fill a 3-entry `s16 buf[4]` with the indices
  of `D_800C0448[arg0*3 + k].unk14` entries equal to 0 using the same
  `sel/pos/step` 16.16 fixed-point match counter (pos initial 0x10000, step
  0x10000), then return `buf[func_80012A34(sel & 0xFFFF)]` or -1. 800BA944
  is the simple form; 800BA868 adds an `arg0 & 1` record offset and a
  per-iteration anomaly guard. The preheader of 800BA868 shows the original
  emission order `bound-copy, base, index, p, pos, bp, step` that 800BA944's
  target also has; membership rests on the shared global + idiom + adjacency.
- ovl_21_func_800B93F0 (m, byte-exact, finalized) — SpuGetKeyStatus
  state-handler: `ovl_21_func_800BA4C0`, then, behind the signed halfword at
  `D_800C0448 + 0x988 > 0`, advances that counter (u16 read / s16 write),
  masks `D_800BCC60[*(s16 *)(D_800C0448 + 0x986)]` into SpuGetKeyStatus, and
  either resets via `func_80022738` + `func_800132F0(0xA, 0, 2)` +
  `D_800C0448[0] = 0xD` or, at zero, calls `func_800226A4`/`func_8001FABC(0x44)`
  and stores the result at `D_800C0448 + 0x986`. Membership rests on the
  shared `D_800C0448` global, the `ovl_21_func_800BA4C0` call, and gapless
  link adjacency (0x800B92C8 + 0x128 = 0x800B93F0, + 0xE4 = 0x800B94D4).
  Reveals `D_800BCC60` as a second shared ovl_21 global.
- ovl_21_func_800BAF70 (m, matched this session, byte-exact) — ObjectState
  reset/handoff leaf: `func_80015840(&D_800C0AFC, 0)` then
  `func_80015EE8(D_8005E3C0->field_D8 + 4, &D_800C0AFC, base[0x6B8],
  base[0x6B9], (s16)(HWD0 / 2), (s16)(VWD0 / 2))` with the base biased by
  `D_800C0AFC - 0x6B4`; membership rests on the shared `D_800C0448` cluster
  (the bias lands on `D_800C0448`), not on adjacency. Cross-container note:
  byte-shape twin of matched `ovl_17_func_800BAF50`, `ovl_19_func_800BAD50`
  and `ovl_23_func_800BB1B8`; that twin relation is not TU-membership
  evidence.
- ovl_21_func_800BAFFC (m, matched this session, byte-exact) — projection
  leaf over the `D_800C0448` cluster: builds `D_800BCD18` from a caller
  halfword triple, projects it through `func_8001DFD4` into `D_800BCD20`,
  and tests `arg0` against the 32-bit pointer at record offset 0x30 of
  records 0/1/2/5 before the `func_800248E8` call; membership rests on the
  shared `D_800C0448` global, not on adjacency.
- ovl_21_func_800BAEA0 (m, matched this session, byte-exact) — ObjectState
  state-handler: when the signed halfword at +4 differs from the byte at
  +0x20, calls `func_80015840(obj + 0x1C, byte@+4)`, then projects through
  `ovl_21_func_800BAFFC(obj + 0x1C, obj + 0xC)`. Membership rests on that
  BAFFC call — the `obj + 0x1C` it forwards is the pointer BAFFC compares
  against `D_800C0448` record +0x30 — and on the `func_80015840`/ObjectState
  idiom shared with `ovl_21_func_800BAF70`, not on adjacency (it sits at
  0x800BAEA0, before both).
- ovl_21_func_800BAE20 (m, matched this session, byte-exact) — ObjectState
  state-handler sibling of `ovl_21_func_800BAEA0`: derives an index from the
  signed halfword at +0x8 and the selector at +0x2 (values 9/6 adjust it),
  compares it against the byte at +0x4 of the SpriteSourceData pointed to by
  +0x20, calls `func_80015840(that pointer, index)` when they differ, then
  projects through `ovl_21_func_800BAFFC(that pointer, obj + 0xA)`.
  Membership rests on the `func_80015840`/`ovl_21_func_800BAFFC` callee pair
  and the same ObjectState/SpriteSourceData idiom as its gapless predecessor
  `ovl_21_func_800BAEA0` (0x800BAE20 + 0x80 = 0x800BAEA0), the call graph
  and link order agreeing.
- ovl_21_func_800BAEEC (m, matched this session, byte-exact) — gapless link
  successor of `ovl_21_func_800BAEA0` (0x800BAEA0 + 0x4C = 0x800BAEEC); same
  `func_80015840` reset-then-project idiom: behind the byte at `D_800C0448 +
  0x688` (the `D_800C0ACC + 4` object state byte) it calls
  `func_80015840(obj + 0x684, 0xE)` when it differs, then passes a 3-halfword
  `s16 vec[3]` built from `D_800BCC48[arg0]` (fields +0/+2, middle constant
  -0x1F4) to `ovl_21_func_800BAFFC(obj + 0x684, vec, &D_800BCC48[arg0])`.
  Membership rests on that callee pair, the shared `D_800C0448` cluster and
  the gapless adjacency to `ovl_21_func_800BAEA0`.
- ovl_21_func_800BA510 (m, matched this session, byte-exact) — walks the
  `D_800C0448` record table over the six-record outer loop (0x108 stride),
  calling `ovl_21_func_800BAE20` on each record's +0x10 object-state sub-view
  (`D_800C0458`, a distinct named overlay symbol) and, behind `rec->unk18 ==
  2` and the `SpriteSourceData` at `rec->unk30` having `field_2 & 0x100`,
  projecting the record's +0x1A/+0x1C/+0x1E halfword vector through
  `func_80015840` / `ovl_21_func_800BAFFC` with the fixed `D_800C0458 +
  0x6D4` (the `D_800C0B2C` label). Membership rests on the shared global,
  that callee pair, and `ovl_21_func_800BA4C0`'s dispatch.
- ovl_21_func_800BA5D0 (m, matched this session, byte-exact) — walks the
  `D_800C0448` record table over the six-record outer loop (0x108 stride),
  stepping three +0x34 sub-records (0x4C stride) per record and calling
  `ovl_21_func_800BAEA0` for each non-zero entry. Membership rests on the
  shared global plus a dispatch/adjacency tie: `ovl_21_func_800BA4C0` calls
  `ovl_21_func_800BA510`, `ovl_21_func_800BA5D0`, `ovl_21_func_800BA670` in
  order, and those three are gapless link neighbours (0x800BA510 + 0xC0 =
  0x800BA5D0, + 0xA0 = 0x800BA670).

Fingerprints:
- `D_800C0AFC` is a further ovl_21 data base at `D_800C0448 + 0x6B4`; the
  reset/handoff leaf biases its `D_800C0AFC` base by -0x6B4 (landing on
  `D_800C0448`) and reads the byte pair at +0x6B8/+0x6B9 of that bias — the
  same addresses as `D_800C0AFC + 4/+5`.
- `D_800C0458` is the record's object-state sub-view base at `D_800C0448 +
  0x10`, a distinct overlay data symbol addressed with `lui` + `%lo` in the
  target; `D_800C0B2C` is the same object at `D_800C0458 + 0x6D4`, and the
  record carries a halfword vector at +0x1A/+0x1C/+0x1E (`ovl_21_func_
  800BA510`).
- shared global cluster: `D_800C0448` is the base of a record table of
  0x108-byte elements — the state pair at 0x00/0x02 (written by the trio
  above), a 32-bit word at 0x14 (read by `ovl_21_func_800BA7F0`), a
  halfword at 0x18 (written by `ovl_21_func_800B9798` /
  `ovl_21_func_800B8A80`), a 32-bit pointer at 0x30 (compared against its
  argument by `ovl_21_func_800BAFFC`, which `ovl_21_func_800BAEA0` feeds
  `record + 0x1C`) and a 32-bit word at
  0x34 stepped by 0x4C within a record (read by `ovl_21_func_800B9844` and
  walked by `ovl_21_func_800BA5D0`),
  three records per 0x318-byte group (`func_800B9A20` walks the table at a
  0x318 stride). Beyond the record table, `D_800C0448 + 0x986` (s16 index)
  and `+ 0x988` (s16/u16 counter) form a state pair used by
  `ovl_21_func_800B93F0` and its unmatched SpuGetKeyStatus near-twins
  `ovl_21_func_800B9178` / `ovl_21_func_800B92C8`; those same handlers index
  the shared `D_800BCC60` voice-bit table. The trio's declaration only
  witnessed the leading halfwords.
- `D_800BCC60` — ovl_21 u32 table of 25 voice-bit masks (0x1..0x800000, then
  0) indexed by the `D_800C0448 + 0x986` halfword and passed to
  `SpuGetKeyStatus`; referenced by the 0x800B9178/0x800B92C8/0x800B93F0
  handler run.
- `D_800BCC48` — ovl_21 table of six 4-byte {u16,u16} pairs indexed by
  `arg0*4`; read by `ovl_21_func_800BAEEC` and `ovl_21_func_800B836C`, so it
  is a further shared ovl_21 data table.

## `ovl_21` D_8006C838 +0x8000 per-entity field writer+reader — 0x800BAB28 / 0x800BABF8 (confidence: medium)

Evidence: shared global D_8006C838 with identical `arg0 * 0x1D4` stride
computation (the `sll 3; subu; sll 2; addu; sll 2; addu; sll 2; addu`
sequence), both accessing adjacent per-record fields at +0x19EA (s16) and
+0x19EC (u16) relative to the +0x8000 base, the same special-case entity ID
tests (7, 9, 0x14), and gapless link adjacency (0x800BAB28 + 0xD0 =
0x800BABF8). BAB28 writes both fields with clamping (u16: +0x1F4 capped at
0xFE0A; s16: +0x14 capped at 0xEB); BABF8 reads the u16 at +0x19EC via
`SquareRoot0` for the special IDs, or returns the s16 at +0x19EA with
identical clamping for other IDs. The functions are complementary
writer/reader of the same per-entity record fields, confirming same-TU
origin.

Members (link order):
- ovl_21_func_800BAB28 (s) — per-entity field writer: clamps and stores the
  u16 at +0x19EC (for id 7/9/20, capped at 0xFE0A after +0x1F4) or the s16
  at +0x19EA (for other ids, capped at 0xFF after +0x14).
- ovl_21_func_800BABF8 (m, matched this session, byte-exact) — per-entity
  field reader: `SquareRoot0` of the u16 at +0x19EC (for id 7/9/20) or
  returns the s16 at +0x19EA clamped (capped at 0xFF after +0x14, for other
  ids).

## `ovl_21` per-entity id-dispatch readers — 0x800BACB0 / 0x800BAD18 (confidence: medium)

Evidence: gapless link adjacency (800BABF8 ends at 0x800BACB0; 0x800BACB0 +
0x68 = 0x800BAD18), a shared s16-id contract — both take the sign-extending
`sll 16; sra 16` prologue and map one entity id to a constant, and the calling
run in `ovl_21_func_800B836C` invokes 800BABF8, 800BACB0 and 800BAD18 in
immediate succession with the same `s0 + 0x10` id, then stores the BAD18
result. This run is link-contiguous with the D_8006C838 per-entity group
above and is likely the same original TU.

Members (link order):
- ovl_21_func_800BACB0 (m) — id-to-value reader: 0x10/0x22 → `D_800BCC20`,
  7/9/0x14/0x16 → `D_800BCC1E`, else `D_800BCC1C` (all s16).
- ovl_21_func_800BAD18 (m, matched this session, byte-exact) — id-to-record
  reader: maps ids 5/6/7/9/11/16/19/20/21/22/25/34 to 0x30-stride object
  records `D_800C0B5C`…`D_800C0D9C`, defaulting to `D_800C0B5C`.

Fingerprints:
- new ovl_21 data cluster `D_800C0B5C`…`D_800C0D9C`: 13 object records at a
  0x30 stride, each 12 words of zeros in the data asm, keyed by the entity id
  at the read call site.

## `ovl_25` D_800BCBD8 dispatch-table cluster — 0x800B7EB4–0x800B81F4 (confidence: medium)

Candidate same-TU cluster around the callback table `D_800BCBD8` (ovl_25 data
asm, 5× function pointers). Evidence is address adjacency, a shared dispatch
counter at `D_8006C838`+0x448C, and the shared base-pointer idiom `(s32 *)&D_8006C838`.

The sibling pattern in `ovl_21` (`ovl_21_func_800B7E3C` dispatching through
`D_800BCB58` via `D_80070CC4`) supports this as a recurring overlay structure.

Fingerprints:
- address adjacency: `ovl_25_func_800B7EB4` (0x88, ends 0x800B7F3C) sits
  immediately before `ovl_25_func_800B7F3C`, and the five callbacks listed in
  `D_800BCBD8` form a contiguous address run through `ovl_25_func_800B81F4`;
- shared dispatch counter: `ovl_25_func_800B7EB4` reads the dispatch index
  at `D_8006C838`+0x448C, which `ovl_25_func_800B81B4` increments and stores
  back — the counter controls which callback is selected;
- shared base-pointer idiom: `ovl_25_func_800B7EB4`, `ovl_25_func_800B81B4`
  and `ovl_25_func_800B81F4` use a local `(s32 *)&D_8006C838` / `(u8 *)D_8006C838`
  pointer to access the dispatch-counter field.
- sibling pattern: `ovl_21_func_800B7E3C` compiles to the same dispatch
  shape (save `$s0`, emit `func_80017A48(3)`, load index, load table,
  swap in delay slot, `func_80017A48($s0)`); `ovl_21`'s index comes from the
  global `D_80070CC4` rather than from `D_8006C838`.

Members (link order):
- ovl_25_func_800B7EB4 (m, matched this session, byte-exact) — state
  dispatcher; reads dispatch counter from `(s32 *)&D_8006C838[0x448C >> 2]`,
  looks up `D_800BCBD8[idx]`, and calls the selected handler with the table
  base as its argument.
- ovl_25_func_800B7F3C (s) — callback; contract: one of five table entries.
- ovl_25_func_800B80A4 (s) — callback; contract: one of five table entries.
- ovl_25_func_800B813C (s) — callback; contract: one of five table entries.
- ovl_25_func_800B81B4 (m, matched this session, byte-exact) — callback;
  calls `ovl_25_func_800B93E4`, then increments and stores the dispatch
  counter `base[0x448C >> 2]` and returns the new value.
- ovl_25_func_800B81F4 (m, matched this session, byte-exact) — callback;
  closes BGM/SE state when the dispatch counter is 2: reads `D_800C030C`
  (ovl_25 s16, now declared in `globals_override.h`) and calls `func_8001FAE8`
  with it, then stores 0xFF to `base[0x448C]`, sets bit 0x80000 at `base[0xC]`
  and calls `func_80011EF0(6)` / `ovl_25_func_800BBA30`.

## `ovl_25` D_800BFE44/D_800BFE46 state-writer run — 0x800BA7F0–0x800BA908 (confidence: medium)

Candidate same-TU run of `ovl_25` around the s16 flag at `D_800BFE46`
(= `D_800BFE44` + 0x2). Evidence is gapless link adjacency plus a shared
write-only global cluster plus a shared state-probe call pair; no gp-rel
cluster observed (the global is `extern` and reached absolutely, so it is not
TU-owned).

Fingerprints:
- address adjacency: `ovl_25_func_800BA7F0` (0x28, ends 0x800BA818) sits
  immediately before `ovl_25_func_800BA818` (0x40, ends 0x800BA858), which is
  followed directly by `ovl_25_func_800BA858` (0xB0, ends 0x800BA908), which is
  followed directly by `ovl_25_func_800BA908` (0x9C) — contiguous, no
  unrelated code between;
- shared s16 flag: all four write `D_800BFE46` — `ovl_25_func_800BA7F0` the
  constant 1, `ovl_25_func_800BA818` the value 2 (via a variable),
  `ovl_25_func_800BA858` the constant 3 (as `sh`, 0x2(`$s0`), where
  `$s0 = D_800BFE44`), and `ovl_25_func_800BA908` the constants 4/0 selected by
  `func_800225B8() == 1` (also `sh`, 0x2(`$s0`));
- shared state-probe pair: `ovl_25_func_800BA818`, `ovl_25_func_800BA858` and
  `ovl_25_func_800BA908` all call `func_8002261C(4, 0x31)` /
  `func_8002261C(4, 0x32)` / `func_8002261C(4, 0x33)` then `func_800226A4()`
  (the `D_8005E5B4` getter) and test the result `== 2` before writing the flag;
  `ovl_25_func_800BA7F0` does not (it calls `ovl_25_func_800B8478`).

Members (link order):
- ovl_25_func_800BA7F0 (s) — calls `ovl_25_func_800B8478`, then
  unconditionally stores 1 to `D_800BFE46`
- ovl_25_func_800BA818 (m, matched this session, byte-exact) — issues the
  `func_8002261C(4, 0x31)` state request, reads `func_800226A4()`, and stores
  the value 2 to `D_800BFE46` only when the read equals 2
- ovl_25_func_800BA858 (m, matched this session, byte-exact) — far-buffer/field
  updater; on its `... == 2` probe path sets `D_800BFE46` to 3 and writes
  `D_800BCD21`/`D_800BCD48`
- ovl_25_func_800BA908 (m, matched this session, byte-exact) — run terminator;
  far-buffer `+0x253B4` halfword updater; on its `func_800226A4() == 2` probe
  path selects `D_800BFE46` = 4/0 by `func_800225B8() == 1`, otherwise clamps
  the halfword down by 0x21

## `ovl_25` D_800C024C object-state base run — 0x800BA40C–0x800BA5BC (confidence: medium)

Candidate same-TU run of `ovl_25` around the extern object-state base
`D_800C024C`. Evidence is gapless link adjacency plus a shared absolute base
built with `lui/addiu %hi/%lo(D_800C024C)` and passed as the first argument to
the `func_80015828`/`func_80015840` helper pair; `D_800C024C` is
`extern`/absolute, so it is not TU-owned (no gp-rel cluster observed).

Fingerprints:
- address adjacency: `ovl_25_func_800BA40C` (0x124, ends 0x800BA530) sits
  immediately before `ovl_25_func_800BA530` (0x8C, ends 0x800BA5BC), which is
  followed directly by `ovl_25_func_800BA5BC` (0x19C) — contiguous, no
  unrelated code between;
- shared absolute base: `ovl_25_func_800BA40C` and `ovl_25_func_800BA530` both
  build `%hi/%lo(D_800C024C)` into `$s0` and pass `&D_800C024C` as arg0 to the
  adjacent helpers `func_80015828`/`func_80015840`;
- cross-reference: `ovl_25_func_800BA40C` and `ovl_25_func_800BA5BC` also build
  the same `%hi/%lo(D_800C0334)` base, so the run terminator is retained.

Members (link order):
- ovl_25_func_800BA40C (s) — record/state initialiser; clears a series of
  `D_800C024C` (+0x00/+0x30/+0x60/+0x90) and `D_800C013C`/`D_800C0334` records
  via repeated `func_80015828(base, 4)` calls
- ovl_25_func_800BA530 (m, matched this session, byte-exact) — resets
  `D_800C024C` via `func_80015840(&D_800C024C, 0)`, then reads its
  `ObjectState` fields +4/+5 and the `HWD0`/`VWD0` halfwords and passes them to
  `func_80015EE8`
- ovl_25_func_800BA5BC (s) — far-buffer/record setup; shares the `D_800C0334`
  base reference with `ovl_25_func_800BA40C`

## `ovl_25` GTE-transform record pair — 0x800BA5BC–0x800BA7F0 (confidence: medium)

Candidate same-TU pair of `ovl_25` around two adjacent 8-byte overlay-local
records, `D_800BCD58`/`D_800BCDC4` and `D_800BCD60`/`D_800BCDCC`. Evidence is
gapless link adjacency plus an identical helper sequence: both copy four u16
halves from their second argument into the output record, call the GTE
perspective-transform wrapper `func_8001DFD4(record, buffer)`, and pass the
result through the renderer `func_80015BF0`.

Fingerprints:
- address adjacency: `ovl_25_func_800BA5BC` (0x19C, ends exactly 0x800BA758)
  is followed directly by `ovl_25_func_800BA758` (0x98, ends exactly
  0x800BA7F0), which is followed directly by `ovl_25_func_800BA7F0` —
  contiguous, no unrelated code between;
- shared helper sequence: both call `func_8001DFD4(record, buffer)` and then
  `func_80015BF0(D_8005E3C0->field_120 + offset, arg0, record[0], record[2])`,
  the offset being the transformed result rounded down to a 4-byte boundary;
- shared overlay-local record region: `ovl_25_func_800BA5BC` writes
  `D_800BCDC4` and reads `D_800BCD58`, while `ovl_25_func_800BA758` writes
  `D_800BCDCC` and reads `D_800BCD60` — two adjacent 8-byte records in the same
  gapless overlay-local data run (`D_800BCD58` + 8 = `D_800BCD60`;
  `D_800BCDC4` + 8 = `D_800BCDCC`). The symbols differ, so this ties the data
  region and the code idiom, not a single symbol.

Members (link order):
- ovl_25_func_800BA5BC (s) — record setup; pre-biases the copied halves by
  -0x96/-0x64 before the transform
- ovl_25_func_800BA758 (m, matched this session, byte-exact) — same transform
  with no bias; copies the four halves raw and adds 0x400 to the transformed
  result before the 4-byte round

## `ovl_25` D_800BCC10 far-buffer consumer extension — 0x800BA9A4–0x800BAAAC (confidence: medium)

Extension of the `D_800BFE44`/`D_800BFE46` state cluster above: the same s16
flag is written further along the run, and the run's tail is tied back to the
overlay-local data table `D_800BCC10` that feeds it. Evidence is gapless link
adjacency plus a shared overlay-local data symbol; the `D_8007AFF0+0x20000` far
base is not itself TU evidence (the same reset code appears in `ovl_11`,
`ovl_19`, `ovl_21`).

Fingerprints:
- address adjacency: `ovl_25_func_800BA9A4` (0x50, ends 0x800BA9F4) sits
  immediately before `ovl_25_func_800BA9F4` (0x68, ends exactly 0x800BAA5C),
  which is followed directly by `ovl_25_func_800BAA5C` (0x50) — contiguous;
- shared s16 flag: `ovl_25_func_800BA9A4` stores 5 to `D_800BFE46` and
  `ovl_25_func_800BA9F4` stores 6 through the same `%lo(D_800BFE46)` address,
  extending the writer run;
- shared overlay-local table `D_800BCC10`: `ovl_25_func_800BAA5C` reads its
  first two u16, while `ovl_25_func_800B83A0` and `ovl_25_func_800B8478` stream
  6 records of 8 bytes from `D_800BCC10` (and `D_800BCC70`) into the
  `D_800BFE44`-based stride-0x78 records; `D_800BCC10` is the data symbol
  immediately following the `D_800BCBF8` function-pointer table whose last
  entry is `ovl_25_func_800BA9F4`;
- shared two-loop streaming quirk: `ovl_25_func_800B8478` and
  `ovl_25_func_800B83A0` both stream `D_800BCC10` then `D_800BCC70` into the
  stride-0x78 `D_800BFE44` records with the constant 0x32000 held in `$a1` and
  a separate source pointer per loop (`$a2`, then `$a1`); the two originals
  agree instruction-for-instruction on that preheader allocation, a shared
  register-variable/idiom quirk on top of the shared data symbol;
- gapless link adjacency of the sibling pair: `ovl_25_func_800B83A0` (0xD8)
  ends exactly at 0x800B8478, where `ovl_25_func_800B8478` (0xC4) begins, so
  the shared streaming idiom and the shared `D_800BCC10`/`D_800BCC70` reads
  also sit in one contiguous link run; `ovl_25_func_800B8340` (0x60) ends
  exactly at 0x800B83A0, extending that run one function earlier;
- shared absolute `D_800BFE44` base and callee: `ovl_25_func_800B8340` builds
  `%hi/%lo(D_800BFE44)` and calls `ovl_25_func_800B83A0`, the run's streaming
  initialiser; `ovl_25_func_800B82B4` (0x8C) ends exactly at 0x800B8340, builds
  the same `%hi/%lo(D_800BFE44)` into `$s0`, seeds the `D_800BFE44` halfword
  fields at +0x4CE..+0x4E4 (and +0/+2), and calls `ovl_25_func_800B8340` —
  extending the contiguous run one function earlier;
- shared far-buffer field region: both `ovl_25_func_800BAA5C` and
  `ovl_25_func_800BA9F4` write the `D_8007AFF0+0x20000` work-area halfword at
  +0x53B4 (= +0x253B4 absolute);
- continued adjacency + shared far-buffer state block: `ovl_25_func_800BAA5C`
  (0x50) ends exactly at 0x800BAAAC, where `ovl_25_func_800BAAAC` (0x118) begins,
  and the successor reads the writer's +0x25394/+0x25398/+0x253A0 state fields
  and stores the transformed result back into the same +0x253AC/+0x253AE/
  +0x253B0 halfword block.

Members (link order):
- ovl_25_func_800BA9A4 (s) — probes `func_8002261C(4,0x34)`/`func_800226A4()`
  and stores 5 to `D_800BFE46` when the read equals 2
- ovl_25_func_800BA9F4 (m, matched this session, byte-exact) — on the `func_80013394() == 1` path calls
  `ovl_25_func_800B83A0`, writes -0x140 to the `D_8007AFF0`+0x253B4 halfword,
  and stores 6 to `D_800BFE46`
- ovl_25_func_800BAA5C (m, matched this session, byte-exact) — leaf; reads u16
  `D_800BCC10[0]`/`[2]` and writes the `D_8007AFF0+0x20000` work-area fields
  +0x5394..+0x53A4 and the +0x53B4/+0x53B8 halfwords
- ovl_25_func_800BAAAC (m, matched this session, byte-exact) — gapless link
  successor of 800BAA5C; `m0 = GsIDMATRIX; m1 = GsIDMATRIX;` + `PushMatrix` /
  `RotMatrix` / `SetRotMatrix` / `SetTransMatrix` / `RotTrans` / `PopMatrix`
  GTE matrix builder, reading the writer's +0x253A0/+0x25394 state fields and
  storing +0x253AC/+0x253AE/+0x253B0 via the same far base (cross-container twin
  of ovl_11_func_800DB674 / ovl_19_func_800BB358 / ovl_21_func_800BB138; the twin
  relation is not itself TU evidence, the adjacency and shared cluster are)
- ovl_25_func_800B8478 (m, matched, byte-exact) — 6+2 record initialiser;
  streams `D_800BCC10` (6×8 bytes) and `D_800BCC70` (2×8 bytes) into the
  stride-0x78 `D_800BFE44` records, setting index +0x10, flag +0x12, and the
  0x32000 word at +0x1C; sibling idiom of `ovl_25_func_800B83A0`
- ovl_25_func_800B82B4 (m, matched this session, byte-exact) — run head;
  clears `D_800BFE44`+0/+2, seeds parameter halfwords +0x4CE..+0x4E4, and
  calls `ovl_25_func_800B8340`
- ovl_25_func_800B8340 (m, matched, byte-exact) — second in the run; clears and
  seeds `D_800BFE44` fields at +0x3D0/+0x4C8, then calls
  `ovl_25_func_800B83A0`

## `ovl_25` D_800BCBEC/D_800BCBF8 two-level state-dispatch tables — 0x800B853C–0x800B8728 (confidence: medium)

Two overlay-local function-pointer tables indexed by the two low halfwords of
`D_800BFE44`; `ovl_25_func_800B853C` is the head of the `D_800BCBEC` run and
also the dispatcher that reads `D_800BCBF8`.

Fingerprints:
- overlay-local 3-entry table `D_800BCBEC` = [`ovl_25_func_800B853C`,
  `ovl_25_func_800B860C`, `ovl_25_func_800B8728`] (`build/ovl_25/asm/data/3D20.data.s`),
  indexed by `D_800BFE44`+0 and dispatched by `ovl_25_func_800B813C`, a member
  of the recorded `D_800BCBD8` cluster; `ovl_25_func_800B853C` itself writes
  `D_800BFE44`+0 = 1, so it selects its own table entry;
- overlay-local 6-entry table `D_800BCBF8` = [`ovl_25_func_800BA7F0`,
  `ovl_25_func_800BA818`, `ovl_25_func_800BA858`, `ovl_25_func_800BA908`,
  `ovl_25_func_800BA9A4`, `ovl_25_func_800BA9F4`] (same data file, immediately
  after `D_800BCBEC`), indexed by `D_800BFE44`+2 (`D_800BFE46`) and dispatched
  by `ovl_25_func_800B853C`; its entries are exactly the recorded
  `D_800BFE44`/`D_800BFE46` state-writer run;
- gapless link-order run of the `D_800BCBEC` members: `ovl_25_func_800B853C`
  (0xD0, ends exactly 0x800B860C) → `ovl_25_func_800B860C` (0x11C, ends
  exactly 0x800B8728) → `ovl_25_func_800B8728` (0x120);
- shared far-buffer/flag write cluster: `ovl_25_func_800B860C` writes the
  `D_8007AFF0`+0x253B4/0x253B6/0x253B8 halfword block and the
  `D_800BCD21`/`D_800BCD48` pair, exactly the cluster `ovl_25_func_800BA858`
  (a `D_800BCBF8` entry dispatched from this same table) writes — the outer
  `D_800BCBEC` handler and the inner `D_800BCBF8` writer run share the state.

Members (link order):
- ovl_25_func_800B853C (m, matched this session, byte-exact) — `D_800BCBEC[0]`;
  when `D_800BFE44`+2 == 6 and `func_80013394() == 1` clears the flag and
  sets the +0 selector, otherwise dispatches `D_800BCBF8[flag]` and applies
  the `(u16)x - (((x+1)/10000)*10000 - 1)` timer-modulo to `D_800BFE44`+0xC
- ovl_25_func_800B860C (m, matched this session, byte-exact) — `D_800BCBEC[1]`;
  per-frame `D_800BFE44`+0x4CC counter, zero-guarded setup at 0 and trip at
  0x3C; on trip resets `D_800BFE44`+0xC, expands the +0x20/+0x24 halfwords
  into the `D_8007AFF0`+0x253B4/0x253B6/0x253B8 block, and writes
  `D_800BCD21`/`D_800BCD48`
- ovl_25_func_800B8728 (s) — `D_800BCBEC[2]`; same divide-by-10000 timer-modulo
  on `D_800BFE44`+0xC

## `ovl_25` display-setup state-handler run — 0x800BAC9C–0x800BAFCC (confidence: medium)

Evidence: the state dispatcher `ovl_25_func_800B7F3C` selects on the byte
`D_800BCD20` via `jtbl_800B7E24` and calls, from consecutive jump-table
branches, `ovl_25_func_800BAC9C`, `ovl_25_func_800BAF20` and
`ovl_25_func_800BAFCC`; those three are also one gapless link-order run
(0x284 + 0xAC + 0x2EC, 0x800BAC9C..0x800BAFCC), so the call graph and the link
order agree — the same fingerprint recorded for the ovl_17/ovl_23/ovl_27
display-setup runs. All three share the display-setup idiom `DrawSync` →
`ClearOTagR(D_8005E3C0->field_120, 0x800)` → `func_80014CBC` poll →
`func_8001719C`, and the `D_8005E3B0 + 0x4290` / `D_8005E3C0` address
cluster; each streams a different sector count into the same buffer. The run
continues gapless one more dispatched function, `ovl_25_func_800BB2B8`,
which shares the `D_8005E3B0 + 0x4290` buffer and `func_8001719C` but not
`ClearOTagR`, and the same dispatcher also calls the later
`ovl_25_func_800BB46C`/`800BB4B4`/`800BB510` handlers.

Members (link order):
- ovl_25_func_800BAC9C (s) — display-setup: `DrawSync`/`ClearOTagR` +
  `func_80014CBC(0, 0, 0x5800, D_8005E3B0+0x4290, 1, 1)` poll; copies the
  streamed region into `D_800BCDD4`/`D_800977F8`/`D_800C021C`, then
  `func_80015704`/`func_80015840`
- ovl_25_func_800BAF20 (m, matched this session, byte-exact) — display-setup:
  `func_80014CBC(0, 0, 0x2000, D_8005E3B0+0x4290, 1, 1)` followed by the
  zero-return poll `func_80014CBC(..., 1, 0) == 0`, then
  `func_8001719C(D_8005E3B0 + 0x4290)`
- ovl_25_func_800BAFCC (s) — display-setup:
  `func_80014CBC(0x1A, 0, 0x124D0, D_8005E3B0+0x4290, 1, 1)` poll and
  `func_8001719C(D_8005E3B0 + 0x5F18)`, then copies into `D_800BE1B4`

## `ovl_25` s16-struct predicate run — 0x800B9758–0x800B97E4 (confidence: low)

Evidence is gapless link adjacency plus a shared overlay-local data-table
region; no symbol is shared between the members, so this is the weakest kind of
tie and is recorded only as a candidate same-TU run.

Fingerprints:
- address adjacency: `ovl_25_func_800B9758` (0x24, ends 0x800B977C) sits
  immediately before `ovl_25_func_800B977C` (0x68, ends 0x800B97E4), which is
  followed directly by `ovl_25_func_800B97E4` — contiguous, no unrelated code
  between;
- shared overlay-local table region: `ovl_25_func_800B977C` reads the s16 table
  `D_800BCCA0` (= 0x800BCCA0, stride-5 halfwords indexed by a struct field),
  which lies in the same gapless overlay-local data run as the `D_800BCC10` /
  `D_800BCC70` tables above (`D_800BCC10` + 0x90 = `D_800BCCA0`); the two
  functions reference different symbols, so this ties the data region, not the
  symbol;
- shared a0-struct idiom: both matched members take a pointer to an
  overlay-local struct whose field is an s16 (`+0x2` for `ovl_25_func_800B9758`,
  `+0x0` for `ovl_25_func_800B977C`) and return an s32 boolean.

Members (link order):
- ovl_25_func_800B9758 (m) — returns 0 when the `+0x2` field is 7 or 4, else 1
- ovl_25_func_800B977C (m, matched this session, byte-exact) — `func_80012A34(0x80)`
  then returns `result < D_800BCCA0[5*(field-1) + arg1] ^ 1`
- ovl_25_func_800B97E4 (s) — unclassified

## `ovl_25` fixed-point threshold-lookup run — 0x800B9A10–0x800B9A84 (confidence: low)

Evidence is gapless link adjacency plus a shared overlay-local s16 data region;
the two members reference different symbols, so this ties the data region and
the code idiom, not a symbol.

Fingerprints:
- address adjacency: `ovl_25_func_800B9A10` (0x74, ends 0x800B9A84) sits
  immediately before `ovl_25_func_800B9A84` (0x7C, ends 0x800B9B00), and the run
  is entered directly by `ovl_25_func_800B97E4` (ends 0x800B9A10);
- shared overlay-local s16 data region: `ovl_25_func_800B9A10` reads the
  contiguous halfwords `D_800BCC98`/`D_800BCC9A`/`D_800BCC9C`/`D_800BCC9E`,
  and `ovl_25_func_800B9A84` reads `D_800BCC90`/`D_800BCC92`/`D_800BCC94`/
  `D_800BCC96` — one halfword run `D_800BCC90`..0x800BCC9E abutting the
  `D_800BCCA0` table of the s16-struct predicate run above;
- shared code idiom: both start with `bgez`/`addiu 0xFFF`/`sll`/`sra 16` and
  select by the same threshold cascade (0x28, 0x1E, 0x14), 9A10 returning on
  `>= 0x14` and 9A84 adding a `>= 0xA` case.

Members (link order):
- ovl_25_func_800B9A10 (m, matched this session, byte-exact) — leaf fixed-point
  convert `x = (arg0 << 4) >> 16`, then returns
  `D_800BCC98`/`9A`/`9C`/`9E` by `x >= 0x28`/`0x1E`/`0x14`
- ovl_25_func_800B9A84 (m, matched this session, byte-exact) — same convert, one
  extra `>= 0xA` case; returns `D_800BCC90`/`92`/`94` by `x >= 0x28`/`0x1E`/`0x14`,
  `D_800BCC96` by `x >= 0xA`, else 0

## `ovl_28` D_8006C838+0x4488 counter run — 0x800B7F30 / 0x800B7F80 / 0x800B7FD4 / 0x800B8124 / 0x800B8304 / 0x800B8344 / 0x800B83C0 (confidence: medium)

Evidence: one gapless link-order run (0x800B7F30 +0x50 -> 0x800B7F80
+0x54 -> 0x800B7FD4 +0x150 -> 0x800B8124 +0x1E0 -> 0x800B8304 +0x40 ->
0x800B8344 +0x7C -> 0x800B83C0, with no unrelated code between) in which the
first six functions build the same absolute base `lui/addiu %hi/%lo(D_8006C838)`
and touch the same s32 word at +0x4488 (= `D_80070CC0`, 0x8006C838+0x4488),
the first six with the identical load / `+1` / store increment; the
run-final `ovl_28_func_800B83C0` shares the base and the +0x4488 word but
clears it instead of incrementing, and reads the two-stage
`D_8006C838+0x8000` base. At the time of writing no other
`ovl_28` function reaching the +0x4488 word was found; the code-segment head
`ovl_28_func_800B7E24` was later matched and does read it (see the
code-segment-head dispatch entry below), so the tie is adjacency plus a shared
read-modify-write/read-once word. Cross-container note: the
byte-shape of `ovl_28_func_800B8304` matches matched `ovl_27_func_800B8C6C`
16/16 (same counter idiom over the same +0x4488 word); that twin relation is
not TU-membership evidence here.

Members (link order):
- ovl_28_func_800B7F30 (m, matched this session, byte-exact) — calls
  `func_800132F0`/`func_800226F0` and
  `ovl_28_func_800B7E80`/`ovl_28_func_800B8B0C`, then increments the counter
  and returns the new value
- ovl_28_func_800B7F80 (s) — calls `func_80013394`; on its `result == 1`
  branch increments the counter and clears `D_800B961C`
- ovl_28_func_800B7FD4 (s) — calls `func_8001FB30`/`func_8001FD10`/
  `func_8001FD74`/`func_8001FE00`/`func_8001FE6C`/`func_80020818` and three
  `ovl_28` siblings, then increments the counter
- ovl_28_func_800B8124 (s) — multi-branch dispatcher over `func_800132B8`/
  `func_800132F0`/`func_80013394`/`func_80015114`/`func_80015EE8`; increments
  the counter on one path
- ovl_28_func_800B8304 (m, matched this session, byte-exact) — calls
  `func_800132F0(10, 0, 2)` and `func_8001FE34(10)`, then increments the
  counter and returns the new value
- ovl_28_func_800B8344 (s) — calls `func_80013394`/`func_8001FBBC`/
  `func_8001FE6C`/`func_80020818`/`func_80020B80`, then increments the counter
- ovl_28_func_800B83C0 (m, matched this session, byte-exact) — run terminator:
  clears the +0x4488 word with a plain zero store (no increment) and gates on
  a u16 at `D_8006C838+0x8000+0x67A0` against 10, calling
  `func_80011EF0(0xD)` on `>= 10` and `func_80011EF0(0x14)` otherwise

Two members are matched; the rest are read off original asm, hence medium
confidence.

## `ovl_28` D_800B95F8 handler-pointer table run — 0x800B7F30 … 0x800B83C0 / 0x800B8414 / 0x800B8478 / 0x800B865C (confidence: medium)

Evidence: the data word run at `D_800B95F8`
(build/ovl_28/asm/data/154C.data.s) is one contiguous pointer table — slots
0..6 (0x800B95F8..0x800B9613) are exactly the seven functions of the
D_8006C838+0x4488 counter run (0x800B7F30, 0x800B7F80, 0x800B7FD4,
0x800B8124, 0x800B8304, 0x800B8344, 0x800B83C0), and the next two words are
the individually labelled slots `D_800B9614` (initialised to
`ovl_28_func_800B8414` itself) and `D_800B9618` (`ovl_28_func_800B865C`).
`ovl_28_func_800B8414` (matched this session, byte-exact) overwrites slot 7
with `ovl_28_func_800B8478`, and also calls the record-table initialiser
`ovl_28_func_800B895C` and writes `D_800B93B4` (read by
`ovl_28_func_800B8AA8`), so the table, the counter run and the record-table
run are one TU by link-order adjacency plus the shared `D_800B93B4`
setup/consumer pair.

Members (slot order):
- ovl_28_func_800B7F30 / 800B7F80 / 800B7FD4 / 800B8124 / 800B8304 /
  800B8344 / 800B83C0 — slots 0..6, the counter run above
- ovl_28_func_800B8414 (m, matched this session, byte-exact) — slot 7 setup:
  calls `ovl_28_func_800B895C`, resets the `D_800B93AE`/`B0`/`B2`/`B4`/`B8`/`BC`
  state cluster (`D_800B93B4 = 0x800`), and installs `ovl_28_func_800B8478`
  into slot `D_800B9614`
- ovl_28_func_800B8478 (s) — slot 7 successor installed by 800B8414
- ovl_28_func_800B865C (m, matched this session, byte-exact) — slot 8
  setup: installs `ovl_28_func_800B86D8` into `D_800B9618`, resets the
  `D_800B93C0`/`C4`/`C6`/`C8`/`CA`/`CE` halfword/word cluster, and gates on
  the same `D_8006C838+0x8000+0x67A0` u16 against 10 that the counter-run
  terminator `ovl_28_func_800B83C0` reads, storing it (or 10) to `D_800B93CC`

## `ovl_28` code-segment-head dispatch cluster — 0x800B7E24 / 0x800B7E80 (confidence: medium)

Evidence: the ovl_28 code-segment head `ovl_28_func_800B7E24` (0x800B7E24,
0x5C) dispatches `((void (*)(s32 *))D_800B95F8[D_80070CC0])(&D_800B95F8)` —
the same `base[index](base)` idiom as the ovl_23 code-segment head, over the
ovl_28 sibling table `D_800B95F8` (the only `ovl_28` reference to that rodata
table). It reads the state word `D_80070CC0` (= `D_8006C838+0x4488`) that the
counter run above read-modify-writes, which ties it to that run; and it is
gaplessly adjacent in link order to it (0x800B7E24 +0x5C = 0x800B7E80, then
0x800B7E80 +0xB0 = 0x800B7F30, the counter run's head).

Members (link order):
- ovl_28_func_800B7E24 (m, byte-exact this session) — code-segment head:
  `func_80017A64()` saved, `func_80017A48(3)`, then
  `((void (*)(s32 *))D_800B95F8[D_80070CC0])(&D_800B95F8)`, then
  `func_80017A48(saved)`.
- ovl_28_func_800B7E80 (m, matched this session, byte-exact) — initialiser:
  installs `ovl_28_func_800B8414` into `D_800B9614` and
  `ovl_28_func_800B865C` into `D_800B9618`, and zeroes the
  `D_800B961C`/`D_800B9620`/`D_800B9624` state words plus the
  `D_800B93AE`/`B0`/`B2`/`B8`/`BC` and `D_800B93C0`/`C4`/`C6`/`C8`/`CA`/`CC`/`CE`
  clusters. Its gapless successor is the counter run head `ovl_28_func_800B7F30`.

Cross-container note: byte-shape twins `ovl_19_func_800B7ED8`,
`ovl_21_func_800B7E3C`, `ovl_23_func_800B7EA4` carry the same
`base[index](base)` head idiom; that twin relation is not TU-membership
evidence — only the shared state word and the link adjacency are.

## `ovl_15` D_8013759E/A0/A2/A4 adjacent-u16 state run — 0x80133808–0x80134724 (confidence: medium)

Evidence: one link-order run (0x5A20–0x693C) in which eight functions read and
write the same four adjacent u16 globals `D_8013759E` / `D_801375A0` /
`D_801375A2` / `D_801375A4` (stride 2, contiguous in the ovl_15 data segment at
0x97B6). Read widths alternate `lh`/`lhu` and the writes are in-place `sh`, so
the fields are signed update counters rather than a flag set. No function
outside the run references any of the four. Non-referencing functions
(`ovl_15_func_80134134`, `ovl_15_func_80134444`, `ovl_15_func_80134450`,
`ovl_15_func_8013468C`) are interleaved, so the tie is the shared-global
cluster, not adjacency. The run terminates at the initialiser
`ovl_15_func_80134724`, which zeroes all four and then memsets the 0x1568-byte
buffer `D_80140FE0` — the only reference to that buffer anywhere in ovl_15.

Members (link order):
- ovl_15_func_80133808 (s) — engine-state update; reads `D_8013759E` and writes
  it back (`lhu`/`sh`), calling `func_80022580`/`func_80017B3C`
- ovl_15_func_80133B28 (s) — reads and rewrites `D_801375A2`; calls
  `func_8001AC10`, `ovl_15_func_801344E8`, `func_8001FABC`
- ovl_15_func_80133F4C (m, matched this session, byte-exact) — leaf free-slot
  allocator: `lh` of `D_8013759E` into a local before the scan and `sh` of it plus
  `lhu`/`sh` of `D_801375A4`; scans and fills a row of the shared 2x5 record table
  `D_80140F90` (same table `ovl_15_func_8013468C` fills and `ovl_15_func_801340B8`
  reads), corroborating the shared-global tie
- ovl_15_func_80134000 (m, matched this session, byte-exact) — free-slot
  deallocator: scans the same shared 2x5 table `D_80140F90` row selected by
  `idx = (arg0 != (s32)&D_800742EC)` as `ovl_15_func_80133F4C`/`801340B8`,
  invalidates the found `D_8013759E`/arg1 record (`-1`/`-1`/0) and `lhu`/`sh`
  decrements `D_801375A4` — the inverse of `ovl_15_func_80133F4C`'s fill/`+= 1`
- ovl_15_func_801340B8 (m, matched this session, byte-exact) — leaf; `lh` of
  `D_8013759E` plus a read of the 0x28-stride table `D_80140F90`, which sits
  0x50 bytes below this run's terminating memset buffer `D_80140FE0`
- ovl_15_func_801342A0 (s) — `lh` of `D_8013759E`; calls `ovl_15_func_80134134`,
  `func_8001A970`, `ovl_15_func_80134444`
- ovl_15_func_801344E8 (s) — `lh` of `D_8013759E`, called from `ovl_15_func_80133B28`
- ovl_15_func_8013468C (m, matched this session, byte-exact) — gapless link
  predecessor of `ovl_15_func_80134724` and calls it; fills the 2x5 record table
  `D_80140F90` (0x50 bytes) that `ovl_15_func_801340B8` reads, then memsets the
  0x398-byte `D_80142550` buffer
- ovl_15_func_80134724 (m, matched this session, byte-exact) — zeroes
  `D_8013759E`/`A0`/`A2`/`A4` and memsets `D_80140FE0` to 0 (0x1568 bytes)

## `ovl_15` D_800742EC/D_801376D0 dual-base slot machinery — 0x801320A8 / 0x80133538 / 0x801335F8 (confidence: medium for the 0x80133538/0x801335F8 pair, low for 0x801320A8)

Evidence: the same two record bases select this run. `ovl_15_func_801320A8`
loads `&D_800742EC` and `D_801376D0` and calls `ovl_15_func_80133538` four times
— `(&D_800742EC, 0/1)` and `(D_801376D0, 0/1)` — to count slots. The gapless
successor of `ovl_15_func_80133538` (0x5750+0xC0 = 0x5810 = 0x801335F8) makes
the identical selection `(v1 == 0) ? &D_800742EC : D_801376D0` and then walks
the shared 2x5 table `D_80140F90`. That table is the tie to the D_8013759E/A0/A2/A4
run above, whose members `ovl_15_func_80133F4C`/`ovl_15_func_80134000` use the
same `idx = (arg0 != (s32)&D_800742EC)` base selection on `D_80140F90`, so the
shared global pair is the cluster tie and the 0x80133538–0x801335F8 boundary is
exact link adjacency.

Members (link order):
- ovl_15_func_801320A8 (s) — caller: selects both bases and calls the counter
  four times, then aggregates the returned counts against the `D_801376D0` run's
  thresholds
- ovl_15_func_80133538 (m, matched this session, byte-exact) — leaf slot counter:
  mode 0 walks 10 records at stride 0xB4 (`u16@0x0`, `u32@0x34 & 0x02000000`),
  mode 1 walks 20 records at stride 0xB8 (`u16@0x708`, `u16@0x7BA`), returning
  the match count
- ovl_15_func_801335F8 (s) — gapless successor (ends exactly at 0x80133808, the
  D_8013759E run head); same two-base selection, walks `D_80140F90`

## `ovl_15` number-text formatter pair — 0x80136C70 / 0x8013703C (confidence: medium)

Evidence: gapless link adjacency agreeing with the call graph. `ovl_15_func_80136C70`
(0x3CC bytes at 0x80136C70) ends exactly where `ovl_15_func_8013703C` begins, and it
is 8013703C's sole caller (two call sites). Both wrap the exe-side number/text helpers
`func_8001A970` / `func_8001ABF0` and build the source pointer with the same
`D_80054BBC[0] + (s32)<array>` idiom (`D_80054BBC` is also read by the 0x8012EE84–
0x801328C4 prologue cluster and by func_8001A284/func_80024108/func_80023D08 in the
exe; the array operand differs per function and is weak evidence on its own).

Members (link order):
- ovl_15_func_80136C70 (s) — number-field renderer; the only caller of 8013703C
- ovl_15_func_8013703C (m, matched this session, byte-exact) — leaf: formats arg0 into
  `arg1` via `func_8001A970`, then copies `D_80054BBC[0] + {0x12|0x18|0x1E|0x24} +
  &D_8005175C` with `func_8001ABF0`

## `ovl_15` D_80053350/func_8001AC10 shared-prologue cluster — 0x8012EE84–0x801328C4 (confidence: medium)

Evidence: a link-order run of ten functions that all open with the same
text-draw call idiom: `func_8001AC10(D_8005E3C0->field_D8 + 0x18,
D_8005E3C0->field_D8 + 0x14, D_80054BBC[0] + (s32)<updater array>)` — a
`lui/addiu` of an updater array (undeclared in `globals.h`; undefined sym in
`build/ovl_15/undefined_syms_auto.txt`) plus the s32 value `D_80054BBC[0]`,
reading `D_8005E3C0->field_D8` (0xD8) once. The updater array is not one symbol:
seven members use `D_80053350`, `ovl_15_func_8012EE84` uses `D_80052FFA`,
`ovl_15_func_8012F078` uses `D_8005306A`, and `ovl_15_func_8012F0E8` uses `D_800530C8`, `ovl_15_func_8012F86C` uses
`D_800531B8`, `ovl_15_func_8012F990` uses `D_80053506`,
`ovl_15_func_8012FA00` uses `D_8005321A`, `ovl_15_func_8012FA70` uses
`D_80053294`, `ovl_15_func_8012FFD8` uses `D_80052F4E`,
`ovl_15_func_80130A94` uses `D_800532FE`, `ovl_15_func_80130BBC` and
`ovl_15_func_80131B5C` use `D_800523AC`, `ovl_15_func_80130DDC` uses `D_8005341E`,
`ovl_15_func_8012F8DC` uses `D_8005346A`, and
`ovl_15_func_80130E4C` uses `D_800533F6`, `ovl_15_func_80131F5C` uses
`D_8005204A`, `ovl_15_func_8013237C` uses `D_80052150`, `ovl_15_func_80132408` uses
`D_80052178`, `ovl_15_func_80132494` uses `D_800521F6`,
`ovl_15_func_80132520` uses `D_80052280`, `ovl_15_func_801325AC` uses
`D_8005230A`, and
`ovl_15_func_80130EBC` also uses `D_80052F4E` (shared with `ovl_15_func_8012FFD8`); none is referenced by
any function outside the run, so the tie is the shared-global/idiom cluster,
not a single symbol or adjacency (the run is not gapless: non-member functions appear
between cluster members in link order; `ovl_15_func_80131BCC`, `ovl_15_func_80131CDC`,
and `func_80131ED8` are members with variant bodies that sit among the gaps).

Members (link order):
- ovl_15_func_8012EE84 (m, matched this session, byte-exact) — shared text-draw
  prologue with the `D_80052FFA` updater array; then
  `D_80137584 = ovl_15_func_80137228(2, 0x16)` and `D_80137588 = 1` (void; the
  `$v0`=1 is the store value, not a returned one — the `s32` caller reads nothing)
- ovl_15_func_8012F078 (m, matched this session, byte-exact) — shared text-draw
  prologue with the `D_8005306A` updater array; then `ret =
  ovl_15_func_80137228(5, 0)`, `D_80137584 = ret` (s8; the value is returned,
  unlike the void siblings), and `D_80137584 = 0` when `D_8013759A >= 0x5B`
- ovl_15_func_8012F0E8 (m, matched this session, byte-exact) — shared text-draw
  prologue with the `D_800530C8` updater array; then `ret =
  ovl_15_func_80137228(6, 0)`, `D_80137584 = ret` (s8; the value is returned),
  and `D_80137584 = 0` when `D_8013759A >= 0x5B` — same body as
  `ovl_15_func_8012F078` with only the updater array and the immediate `0x5`→`0x6`
  changed, and contiguous with it in link order (both 0x70 bytes)
- ovl_15_func_8012F86C (m, matched this session, byte-exact) — shared text-draw
  prologue with the `D_800531B8` updater array; then `ret =
  ovl_15_func_80137228(14, 0)`, `D_80137584 = ret` (s8; the value is returned),
  and `D_80137584 = 0` when `D_8013759A >= 0x5B` — same body as
  `ovl_15_func_8012F078`/`ovl_15_func_8012F0E8` with only the updater array and
  the immediate changed, and contiguous in link order after
  `ovl_15_func_8012F0E8` (both 0x70 bytes)
- ovl_15_func_8012F8DC (m, matched this session, byte-exact) — shared text-draw
  prologue with the `D_8005346A` updater array; then, when `D_8013759A >= 2`,
  `ovl_15_func_80136558(D_8013758C, D_8013758E)` dispatches to `D_80137584` =
  0x13 (0) / 0x11 (0xB) / 0x15 (4) else 0x10 (void) — a variant body, gapless
  in link order between `ovl_15_func_8012F86C` (0x70, ends exactly at its
  0x8012F8DC) and `ovl_15_func_8012F990` (0xB4)
- ovl_15_func_8012F990 (m, matched this session, byte-exact) — shared text-draw
  prologue with the `D_80053506` updater array; then `ret =
  ovl_15_func_80137228(0x10, 0)`, `D_80137584 = ret` (s8; the value is
  returned), and `D_80137584 = 0` when `D_8013759A >= 0x5B` — same body as
  `ovl_15_func_8012F078`/`ovl_15_func_8012F0E8`/`ovl_15_func_8012F86C` with only
  the updater array and the immediate changed
- ovl_15_func_8012FA00 (m, matched this session, byte-exact) — shared text-draw
  prologue with the `D_8005321A` updater array; then `ret =
  ovl_15_func_80137228(0x11, 0)`, `D_80137584 = ret` (s8; the value is
  returned), and `D_80137584 = 0` when `D_8013759A >= 0x5B` — same body as
  `ovl_15_func_8012F078`/`ovl_15_func_8012F0E8`/`ovl_15_func_8012F86C`/
  `ovl_15_func_8012F990` with only the updater array and the immediate changed
- ovl_15_func_8012FA70 (m, matched this session, byte-exact) — shared text-draw
  prologue with the `D_80053294` updater array; then `ret =
  ovl_15_func_80137228(0x12, 0)`, `D_80137584 = ret` (s8; the value is
  returned), and `D_80137584 = 0` when `D_8013759A >= 0x5B` — same body as
  `ovl_15_func_8012FA00` with only the updater array and the immediate
  `0x11`→`0x12` changed, and contiguous in link order after it (both 0x70 bytes)
- ovl_15_func_8012FFD8 (m, matched this session, byte-exact) — shared text-draw
  prologue with the `D_80052F4E` updater array; then `ret =
  ovl_15_func_80137228(0x15, 0)`, `D_80137584 = ret` (s8; the value is
  returned), and `D_80137584 = 0` when `D_8013759A >= 0x5B` — same body as
  `ovl_15_func_8012FA70` with only the updater array and the immediate
  `0x12`→`0x15` changed, and contiguous in link order after it (both 0x70 bytes)
- ovl_15_func_801305D4 (m, matched this session, byte-exact) — shared text-draw
  prologue with the `D_80052FFA` updater array; then
  `D_80137584 = ovl_15_func_80137228(2, 0x11)` and `D_80137588 = 1`
- ovl_15_func_801307D8 (m, matched this session, byte-exact) — shared text-draw
  prologue with the `D_8005306A` updater array; then `ret =
  ovl_15_func_80137228(5, 0)`, `D_80137584 = ret` (s8; the value is returned),
  and `D_80137584 = 0` when `D_8013759A >= 0x5B` — exact body duplicate of
  `ovl_15_func_8012F078` (same updater array and immediate), just further along
  the link-order run
- ovl_15_func_80130848 (m, matched this session, byte-exact) — shared text-draw
  prologue with the `D_800530C8` updater array; then `ret =
  ovl_15_func_80137228(6, 0)`, `D_80137584 = ret` (s8; the value is returned),
  and `D_80137584 = 0` when `D_8013759A >= 0x5B` — exact body duplicate of
  `ovl_15_func_8012F0E8` (same updater array and immediate), and contiguous in
  link order after `ovl_15_func_801307D8` (both 0x70 bytes)
- ovl_15_func_80130A94 (m, matched this session, byte-exact) — shared text-draw
  prologue with the `D_800532FE` updater array; then `ret =
  ovl_15_func_80137228(8, 0)`, `D_80137584 = ret` (s8; the value is returned),
  and `D_80137584 = 0` when `D_8013759A >= 0x5B` — same body as
  `ovl_15_func_8012F078`/`ovl_15_func_8012F0E8`/`ovl_15_func_8012F86C` with only
  the updater array and the immediate changed (0x70 bytes)
- ovl_15_func_80130BBC (m, matched this session, byte-exact) — shared text-draw
  prologue with the `D_800523AC` updater array (a new cluster symbol); then `ret
  = ovl_15_func_80137228(0xA, 0)`, `D_80137584 = ret` (s8; the value is
  returned), and `D_80137584 = 0` when `D_8013759A >= 0x5B` — same body as
  `ovl_15_func_8012F078`/`ovl_15_func_8012F0E8`/`ovl_15_func_8012F86C` with only
  the updater array and the immediate changed, sitting in link order between
  `ovl_15_func_80130A94` and `ovl_15_func_80130C2C` (0x70 bytes)
- ovl_15_func_80130C2C (m, matched this session, byte-exact) — shared text-draw
  prologue; then `ovl_15_func_80137544((s32)D_80140EC0, D_8013758E)` and
  `D_80137584 = 12` (void; the `$v0`=12 is the store value, not a returned one)
- ovl_15_func_80130C8C (s) — shared prologue; then `lh` of `D_8013758C`/
  `D_8013758E` passed to `ovl_15_func_801367F8`, switch on `jtbl_8012DF44`
- ovl_15_func_80130D3C (m, matched this session, byte-exact) — shared text-draw
  prologue with the `D_80053350` updater array; variant body: calls
  `ovl_15_func_80135B68`, sets `D_80137584 = 0xE` on `-1` return, otherwise
  checks `D_801376E0[D_8013758E].field_34 != 0x14` to assign `D_80137584 = 0xE`
  or `0x13` (void; writes `D_80137584` as side-effect, not return value)
- ovl_15_func_80130DDC (m, matched this session, byte-exact) — shared text-draw
  prologue with the `D_8005341E` updater array; then `ret =
  ovl_15_func_80137228(0xE, 0)`, `D_80137584 = ret` (s8; the value is returned),
  and `D_80137584 = 0` when `D_8013759A >= 0x5B` — same body as
  `ovl_15_func_8012F078`/`ovl_15_func_8012F0E8`/`ovl_15_func_8012F86C` with only
  the updater array and the immediate changed
- ovl_15_func_80130E4C (m, matched this session, byte-exact) — shared text-draw
  prologue with the `D_800533F6` updater array; then `ret =
  ovl_15_func_80137228(15, 0)`, `D_80137584 = ret` (s8; the value is returned),
  and `D_80137584 = 0` when `D_8013759A >= 0x5B` — same body as
  `ovl_15_func_80130DDC` with only the updater array and the immediate
  `0xE`→`0xF` changed, and contiguous in link order after it (both 0x70 bytes)
- ovl_15_func_80130EBC (m, matched this session, byte-exact) — shared text-draw
  prologue with the `D_80052F4E` updater array (shared with
  `ovl_15_func_8012FFD8`); then `ret = ovl_15_func_80137228(0x10, 0)`,
  `D_80137584 = ret` (s8; the value is returned), and `D_80137584 = 0` when
  `D_8013759A >= 0x5B` — exact body duplicate of `ovl_15_func_8012F990` except
  for the updater array, and contiguous in link order after
  `ovl_15_func_80130E4C` (both 0x70 bytes)
- ovl_15_func_801315B0 (m, matched this session, byte-exact) — shared text-draw
  prologue with the `D_80052FFA` updater array; then
  `D_80137584 = ovl_15_func_80137228(2, 0x1F)` and `D_80137588 = 1` (void;
  `$v0`=1 is the store value, not a returned one — same body as
  `ovl_15_func_8012EE84` with only the immediate `0x16`→`0x1F` changed)
- ovl_15_func_80131778 (m, matched this session, byte-exact) — shared text-draw
  prologue with the `D_8005306A` updater array; then `ret =
  ovl_15_func_80137228(5, 0)`, `D_80137584 = ret` (s8; the value is returned),
  and `D_80137584 = 0` when `D_8013759A >= 0x5B` — exact body duplicate of
  `ovl_15_func_8012F078` (same updater array and immediate), sitting in link
  order between `ovl_15_func_801315B0` and `ovl_15_func_801317E8` (0x70 bytes)
- ovl_15_func_801317E8 (m, matched this session, byte-exact) — shared text-draw
  prologue with the `D_800530C8` updater array; then `ret =
  ovl_15_func_80137228(6, 0)`, `D_80137584 = ret` (s8; the value is returned),
  and `D_80137584 = 0` when `D_8013759A >= 0x5B` — exact body duplicate of
  `ovl_15_func_8012F0E8`/`ovl_15_func_80130848` (same updater array and
  immediate), contiguous in link order after `ovl_15_func_80131778` and before
  `ovl_15_func_80131BCC` (0x70 bytes)
- ovl_15_func_80131A34 (m, matched this session, byte-exact) — shared text-draw
  prologue with the `D_800532FE` updater array; then `ret =
  ovl_15_func_80137228(8, 0)`, `D_80137584 = ret` (s8; the value is returned),
  and `D_80137584 = 0` when `D_8013759A >= 0x5B` — exact body duplicate of
  `ovl_15_func_80130A94` (same updater array and immediate), sitting in link
  order between `ovl_15_func_801317E8` and `ovl_15_func_80131BCC` (0x70 bytes)
- ovl_15_func_80131B5C (m, matched this session, byte-exact) — shared text-draw
  prologue with the `D_800523AC` updater array (shared with
  `ovl_15_func_80130BBC`); then `ret = ovl_15_func_80137228(0xA, 0)`,
  `D_80137584 = ret` (s8; the value is returned), and `D_80137584 = 0` when
  `D_8013759A >= 0x5B` — exact body duplicate of `ovl_15_func_80130BBC` (same
  updater array and immediate), contiguous in link order after
  `ovl_15_func_80131AA4` and immediately before `ovl_15_func_80131BCC`
  (0x70 bytes)
- ovl_15_func_80131BCC (m, matched this session, byte-exact) — exact body
  duplicate of `ovl_15_func_80130C2C`: same text-draw prologue, then
  `ovl_15_func_80137544((s32)D_80140EC0, D_8013758E)` and `D_80137584 = 12`
  (void; `$v0`=12 is the store value, not a returned one)
- ovl_15_func_80131C2C (s) — shared prologue (text base `D_80053350`)
- ovl_15_func_80131CDC (m) — shared text-draw prologue with the `D_80053350` updater array; variant body using `ovl_15_func_80135B68` guard and `D_801376E0[D_8013758E].field_34` check (struct array, stride 0x3C) instead of the `ovl_15_func_80137228` pattern; calls `ovl_15_func_80135A78` in the else branch; sets `D_80137584` to 0xE or 0x10 (void; `$v0` holds the store value at return)
- ovl_15_func_80131D88 (m, matched this session, byte-exact) — shared text-draw
  prologue with the `D_8005341E` updater array (shared with
  `ovl_15_func_80130DDC`); then `ret = ovl_15_func_80137228(0xE, 0)`,
  `D_80137584 = ret` (s8; the value is returned), and `D_80137584 = 0` when
  `D_8013759A >= 0x5B` — exact body duplicate of `ovl_15_func_80130DDC` (same
  updater array and immediate), sitting in link order between
  `ovl_15_func_80131CDC` and `func_80131ED8` (0x70 bytes)
- ovl_15_func_80131DF8 (m, matched this session, byte-exact) — shared text-draw
  prologue with the `D_800533F6` updater array (shared with
  `ovl_15_func_80130E4C`); then `ret = ovl_15_func_80137228(15, 0)`,
  `D_80137584 = ret` (s8; the value is returned), and `D_80137584 = 0` when
  `D_8013759A >= 0x5B` — exact body duplicate of `ovl_15_func_80130E4C` (same
  updater array and immediate), contiguous in link order after
  `ovl_15_func_80131D88` (0x70 bytes)
- ovl_15_func_80131E68 (m, matched this session, byte-exact) — shared text-draw
  prologue with the `D_80052F4E` updater array (shared with
  `ovl_15_func_8012FFD8` and `ovl_15_func_80130EBC`); then `ret =
  ovl_15_func_80137228(0x1E, 0)`, `D_80137584 = ret` (s8; the value is
  returned), and `D_80137584 = 0` when `D_8013759A >= 0x5B` — exact body
  duplicate of `ovl_15_func_8012FFD8` (same updater array, immediate `0x15`→`0x1E`),
  contiguous in link order after `ovl_15_func_80131DF8` and immediately before
  `func_80131ED8` (0x70 bytes)
- ovl_15_func_80131ED8 (m, matched this session, byte-exact) — shared
  text-draw prologue with the `D_80053350` updater array; then a
  `bcmp(D_801376D0 + 0x225C, D_8006C838, 8)` guard sets `D_80137584` to 0x11,
  else calls `ovl_15_func_8013468C()` and sets 0x12
- ovl_15_func_80131F5C (m, matched this session, byte-exact) — shared
  text-draw prologue with the `D_8005204A` updater array; then `ret =
  ovl_15_func_80137228(0x11, 9)`, `D_80137584 = ret` (s8; the value is
  returned), and on `D_8013759A >= 0x5B` both `D_80137584` and the return are
  set to 9; contiguous in link order after `func_80131ED8` (0x74 bytes)
- ovl_15_func_8013237C (m, matched this session, byte-exact) — shared text-draw
  prologue with the `D_80052150` updater array (new cluster symbol; not used by
  any function outside the run); then `D_80137584 = ovl_15_func_80137228(0x15,
  0x12)` (void), `D_80137584 = 0x12` when `D_8013759A >= 0x5B`, and a distinct
  tail absent from the other members: re-reads `D_80137584` and calls
  `ovl_15_func_80134724()` when it is not `0x15`; sits in the link-order stretch
  after the interleaved `ovl_15_func_80131F5C`/`func_80131ED8` block and before
  `ovl_15_func_801328C4` (non-members `ovl_15_func_80131FD0`/`8013203C`/`801320A8`
  are interleaved, so the tie is not adjacency)
- ovl_15_func_80132408 (m, matched this session, byte-exact) — shared text-draw
  prologue with the `D_80052178` updater array (new cluster symbol; not used by
  any function outside the run); then `D_80137584 = ovl_15_func_80137228(0x16,
  0x12)` (void), `D_80137584 = 0x12` when `D_8013759A >= 0x5B`, and the same
  distinct tail as `ovl_15_func_8013237C`: re-reads `D_80137584` and calls
  `ovl_15_func_80134724()` when it is not `0x16` — body-identical duplicate of
  `ovl_15_func_8013237C` with only the updater array and the immediate `0x15`→`0x16`
  changed, gapless in link order after `ovl_15_func_8013237C` and immediately
  before `ovl_15_func_80132494`, all 0x8C bytes
- ovl_15_func_80132494 (m, matched this session, byte-exact) — shared text-draw
  prologue with the `D_800521F6` updater array (new cluster symbol; not used by
  any function outside the run); then `D_80137584 = ovl_15_func_80137228(0x17,
  0x12)` (void), `D_80137584 = 0x12` when `D_8013759A >= 0x5B`, and the same
  distinct tail as `ovl_15_func_8013237C`/`ovl_15_func_80132408`: re-reads
  `D_80137584` and calls `ovl_15_func_80134724()` when it is not `0x17` —
  body-identical duplicate with only the updater array and the immediate
  `0x16`→`0x17` changed, gapless in link order after `ovl_15_func_80132408`
  (0x8C bytes)
- ovl_15_func_80132520 (m, matched this session, byte-exact) — shared text-draw
  prologue with the `D_80052280` updater array (new cluster symbol; not used by
  any function outside the run); then `D_80137584 = ovl_15_func_80137228(0x18,
  0x12)` (void), `D_80137584 = 0x12` when `D_8013759A >= 0x5B`, and the same
  distinct tail as `ovl_15_func_8013237C`/`ovl_15_func_80132408`/
  `ovl_15_func_80132494`: re-reads `D_80137584` and calls
  `ovl_15_func_80134724()` when it is not `0x18` — body-identical duplicate with
  only the updater array and the immediate `0x17`→`0x18` changed, gapless in
  link order after `ovl_15_func_80132494` (0x8C bytes)
- ovl_15_func_801325AC (m, matched this session, byte-exact) — shared text-draw
  prologue with the `D_8005230A` updater array (new cluster symbol; not used by
  any function outside the run); then `D_80137584 = ovl_15_func_80137228(0x19,
  0x12)` (void), `D_80137584 = 0x12` when `D_8013759A >= 0x5B`, and the same
  distinct tail as `ovl_15_func_8013237C`/`ovl_15_func_80132408`/
  `ovl_15_func_80132494`/`ovl_15_func_80132520`: re-reads `D_80137584` and calls
  `ovl_15_func_80134724()` when it is not `0x19` — body-identical duplicate with
  only the updater array and the immediate `0x18`→`0x19` changed, gapless in
  link order after `ovl_15_func_80132520` (0x8C bytes)
- ovl_15_func_801328C4 (m, matched this session, byte-exact) — shared text-draw
  prologue with the `D_80053506` updater array (shared with
  `ovl_15_func_8012F990`); then `ret = ovl_15_func_80137228(0x1C, 0)`,
  `D_80137584 = ret` (s8; the value is returned), and `D_80137584 = 0` when
  `D_8013759A >= 0x5B` — same body as `ovl_15_func_8012F990` with only the
  immediate `0x10`→`0x1C` changed; sits beyond the interleaved non-members
  `ovl_15_func_80131C2C`/`ovl_15_func_80131CDC`/`ovl_15_func_80131D88`/
  `ovl_15_func_80131DF8`/`ovl_15_func_80131E68`/`func_80131ED8` (0x70 bytes)

## `ovl_25` leaf run — 0x800BB970–0x800BBA7C (confidence: medium)

Candidate same-TU run of `ovl_25` at file offsets 0x3B50–0x3D20. Evidence is a
gapless link run whose call graph agrees with it, a shared leaf-prologue idiom,
and a shared-global cluster at the head of the run.

Fingerprints:
- address adjacency: `ovl_25_func_800BB970` (0x60, ends 0x3BB0) sits immediately
  before `ovl_25_func_800BB9D0` (0x60, ends 0x3C10), which sits immediately
  before `ovl_25_func_800BBA30` (0x4C, ends 0x3C5C), which is followed directly
  by `ovl_25_func_800BBA7C` (0xC4, ends 0x3D20, then the overlay data segment) —
  contiguous, no unrelated code between;
- shared-global cluster: `ovl_25_func_800BB970` and `ovl_25_func_800BB9D0` both
  address `D_8006C838`, both scale the sign-extended s16 argument by exactly
  0x1D4 with the identical `sll/subu/sll/addu/sll/addu/sll` chain, both add an
  identical `ori $zero,0x8000` base offset, and both touch adjacent halfwords
  of the same 0x1D4-stride record (`+0x8000+0x19EA` vs `+0x8000+0x19EC`);
- call graph agrees with link order: `ovl_25_func_800BBA7C` issues
  `jal ovl_25_func_800BBA30` (at 0x3C9C), and the callee immediately precedes
  the caller;
- shared leaf-prologue idiom: `ovl_25_func_800BB9D0` and `ovl_25_func_800BBA30`
  both open with `sll $a0,16` / `sra $a0,16` (a sign-extended s16 first
  argument) followed by a `lui/addiu` absolute global base, and both are leaves
  terminating in `jr $ra`.

Non-evidence for the tail: `ovl_25_func_800BBA30` writes `D_8005E5E8` (a cross-container
render-context global reached absolutely from shared RAM, judge it not
TU-owned), and `ovl_25_func_800BBA7C` uses `D_800BCD50`/`52`/`AC`/`B8`. The body
of `ovl_25_func_800BBA30` matches matched `ovl_11_func_800DC114` 13 of 13
instruction shapes; that cross-container twin relation is not TU-membership
evidence here.

Members (link order):
- ovl_25_func_800BB970 (m, matched this session, byte-exact) — leaf; indexes the
  same 0x1D4-stride `D_8006C838` record with the sign-extended s16 argument and
  updates the s16 at +0x8000+0x19EA to +0x14 while it is < 0xEB, otherwise 0xFF
- ovl_25_func_800BB9D0 (s) — leaf; indexes `D_8006C838` with the s16 argument,
  reads the u16 at +0x19EC, returns the value +0x1F4 when it is ≤ 0xFE0A and
  else writes and returns 0xFFFF
- ovl_25_func_800BBA30 (m, matched this session, byte-exact) — leaf; stores the
  three s16 arguments as bytes at +0x19/+0x1A/+0x1B of both 0x134-stride
  `D_8005E5E8` render contexts and sets `unk18` = 1 in each
- ovl_25_func_800BBA7C (s) — calls `func_8001F278` over `D_800BCDAC`/
  `D_800BCDB8`, feeds three s16 sampled from the returned record to
  `ovl_25_func_800BBA30`, then advances the `D_800BCD52` counter and raises the
  `D_800BCD50` flag once it reaches 0x200

## `ovl_25` 8×0x16 record-array initializer/consumers — 0x800BB4B4 / 0x800BB580 / 0x800BB874 (confidence: medium)

Candidate same-TU grouping of `ovl_25`. Evidence is a shared object plus a
gapless link run.

Fingerprints:
- shared object, init/consumers: `ovl_25_func_800BB4B4` memsets exactly 0xB4
  bytes at `D_800A03AC`, which is the 4-byte prefix at `D_800A03AC` plus the
  eight 0x16-stride records beginning at `D_800A03B0` (`D_800A03AC + 4`;
  0x4 + 8*0x16 = 0xB4). `ovl_25_func_800BB580` walks exactly that array —
  `D_800A03B0`, eight entries, 0x16 stride — and dispatches each record by its
  first halfword against 0xFFFF and the `D_8006C838` flag. Same object, so the
  two are the initializer and the consumer of one record type.
- shared object, find-or-insert consumer: `ovl_25_func_800BB874` also walks
  `D_800A03B0` as eight 0x16-stride records — it scans for a matching first
  halfword over 8 entries, and on a miss scans again for the first 0xFFFF
  entry, `memset`s it 0x16 and copies nine halfwords into it (dest 0/2/8/4/6/
  0xE/0x10/0x12/0x14 from src 0/2/4/6/8/0xA/0xC/0xE/0x10). Same array, so it is
  a third accessor of the one record type.
- gapless link run: `ovl_25_func_800BB46C` (ends exactly at 0x800BB4B4) →
  `ovl_25_func_800BB4B4` (0x5C, ends exactly 0x800BB510) →
  `ovl_25_func_800BB510` (0x70, ends exactly 0x800BB580) →
  `ovl_25_func_800BB580`; contiguous, no unrelated code between.
- far-buffer mirror: `ovl_25_func_800BB4B4` sets eight 0xFFFF halfwords at
  `D_8007AFF0 + 0x253C0` at the same 0x16 stride, the same shape as the
  `D_800A03B0` array, tying it to the `D_8007AFF0` +0x253xx far-buffer field
  region already recorded for ovl_25 (`ovl_25_func_800BA9F4` writes
  +0x253B4).

Non-evidence: `ovl_25_func_800BB4B4` is byte-identical to matched
`ovl_11_func_800DB0E4`, and `ovl_25_func_800BB874` is structure-identical to
matched `ovl_11_func_800DB140`; those cross-container twin relations are not
TU-membership evidence here. `ovl_25_func_800BB46C` (calls `func_80020B80`/`func_8001FBF0`)
shares no global with the pair; its inclusion rests on address adjacency only.
`ovl_25_func_800BB510` (`$a0+0x8A8`, 0x12 stride) also shares no global, but it
calls `ovl_25_func_800BB874`, so its call edge corroborates the adjacency.

Members (link order):
- ovl_25_func_800BB4B4 (m, matched this session, byte-exact) — initializer:
  `memset(&D_800A03AC, 0, 0xB4)` then eight `0xFFFF` halfwords at
  `D_8007AFF0 + 0x253C0`, stride 0x16.
- ovl_25_func_800BB580 (s) — consumer of the `D_800A03B0` records (8 entries,
  0x16 stride): per record `lhu` first halfword, skips 0xFFFF, dispatches on
  the `D_8006C838` +0xC flag to `ovl_25_func_800BB628` or
  `ovl_25_func_800BB788`.
- ovl_25_func_800BB510 (m, matched this session, byte-exact) — walks eight
  9-halfword records (0x12 stride) at `$a0+0x8A8`, calling
  `ovl_25_func_800BB874` for each whose first halfword is not 0xFFFF: the source
  record type that member copies into the `D_800A03B0` slots.
- ovl_25_func_800BB874 (m, matched this session, byte-exact) — find-or-insert
  over the same `D_800A03B0` records (8 entries, 0x16 stride): returns on a
  matching first halfword, else fills the first 0xFFFF record via
  `memset(.., 0, 0x16)` plus the halfword remap above.

## `ovl_19` clamp-table lookup run — 0x800BAD50–0x800BADF8 (confidence: low)

- ovl_19_func_800BAD50 (m, matched this session, byte-exact) — resets the ovl_19
  ObjectState at `D_800BF660` via `func_80015840(obj, 9)`, then dispatches
  `func_80015EE8(D_8005E3C0->field_D8 + 4, &D_800BF660, state[4], state[5], 0, 0)`;
  same shape as matched `ovl_17_func_800BAF50` (different ObjectState symbol/argument).
- ovl_19_func_800BADAC (m, matched this session, byte-exact) — leaf; sign-extends
  its s16 argument, clamps it to [0,19] (negative → 0, `>= 20` → 19), and
  returns `D_800BCFF8[idx]` (a 20-entry s32 table in the overlay data segment).
- Evidence: gapless link order — `ovl_19_func_800BAD50` (0x5C, ends 0x800BADAC)
  precedes this function (0x4C, ends 0x800BADF8), which is followed directly by
  `ovl_19_func_800BADF8` (0x1B4); and an adjacent referenced-data region —
  `D_800BCFF8` (used here) is immediately followed by `D_800BD048`, used by
  `ovl_19_func_800BADF8`; all three labels are in the one `3F54.data.s` blob.
- Weakness: the run shares no global across all three members
  (`ovl_19_func_800BAD50` uses `D_800BF660`, `ovl_19_func_800BADF8` uses
  `D_800BD048`/`D_800BD080`/`D_800BF570`), so this is an adjacency-and-data
  argument only, not a shared-cluster proof.

## `ovl_19` nested-callee pair — 0x800BB08C / 0x800BB108 (confidence: high)

- ovl_19_func_800BB08C (m, matched this session, byte-exact) — `D_800BF660`
  ObjectState reset/handoff leaf: `func_80015840`/`func_8001585C` on the object,
  then `func_80015EE8(D_8005E3C0->field_D8 + 0x14, &D_800BF660, state[0x1A4], state[0x1A5], 0, 0)`.
- ovl_19_func_800BB108 (s) — parent driver; calls 800BB08C repeatedly with
  (a0,a1) = (1,0),(4,0),(5,0),(7,0),(1,1),(7,1).
- Evidence (TU quirk, strong): 800BB08C is an **auto (nested) function** of
  800BB108 — the parent sets `$v0 = $sp + 0x18` immediately before every call and
  the child stores incoming `$v0` (this target's `STATIC_CHAIN_REGNUM`) to its
  frame; same fingerprint as the `func_8001EAE4`/`func_8001E878` pair. Nested
  functions are defined inside their parent, so both are one original TU.
- Evidence (adjacency + shared cluster): 800BB08C (0x7C) ends exactly at
  0x800BB108; both address `D_800BF660` / `D_8005E3C0->field_D8`; 800BB08C is the
  `+0x14` sibling of `ovl_19_func_800BAD50` and a byte-shape twin of
  `ovl_17_func_800BAF50` / `ovl_23_func_800BB1B8`.

## `ovl_19` D_8007AFF0 far-buffer state reader run — 0x800BB358–0x800BB4D4 (confidence: medium)

Evidence: gapless link run — `ovl_19_func_800BB318` (0x40, ends 0x800BB358) →
`ovl_19_func_800BB358` (0x118, ends 0x800BB470) → `ovl_19_func_800BB470` (0x64,
ends 0x800BB4D4) → `ovl_19_func_800BB4D4`; all four build the same
`D_8007AFF0+0x20000` far base with the one-`lui`+`addu` idiom and read the same
halfword/word state block, which is the shared-cluster proof. Cross-container
note: `ovl_19_func_800BB318` is byte-identical to the recorded `ovl_21` writer
`ovl_21_func_800BB0F8`, and `ovl_19_func_800BB470` is a byte-identical source
twin of `ovl_21_func_800BB250` / `ovl_11_func_800DB78C`, so the same code family
was copied into several overlays; that twin relation is not itself
TU-membership evidence, but the shared offsets here are the same cluster.

Members (link order):
- ovl_19_func_800BB318 (m, matched) — leaf reset; stores the `D_8007AFF0`
  +0x25394..+0x253A4 s32 block and clears +0x253B4/+0x253B6/+0x253B8.
- ovl_19_func_800BB358 (m, matched, byte-exact) — GTE matrix reader on the same
  far base; reads +0x25394/+0x25398/+0x253A0/+0x253AC/+0x253AE/+0x253B0/+0x253B6
  and calls `PushMatrix`/`SetRotMatrix`/`SetTransMatrix`/`RotMatrix`/`RotTrans`/
  `PopMatrix`. Byte-identical source twin of `ovl_11_func_800DB674` and
  `ovl_21_func_800BB138` (same code family copied across overlays).
- ovl_19_func_800BB470 (m, byte-exact) — reads the +0x253AC/+0x253AE/+0x253B0/
  +0x253B4/+0x253B6/+0x253B8 halfwords via the same far base and passes them to
  `func_8001B9F8` (sum-of-pairs, 4 args) and `func_8001BA40` (3 args).
- ovl_19_func_800BB4D4 (m, byte-exact) — gapless successor; same far base and
  same six halfwords, calls `func_8001C0D4` with the `D_800BF700`
  `FuncC0D4Args` descriptor.

## `ovl_19` D_800BCEE4 display-setup state-handler run — 0x800BB5D4–0x800BBD14 (confidence: medium)

Evidence: the dispatcher `ovl_19_func_800B7F34` (s) selects on the state byte
`D_800BCEE4` via `jtbl_800B7E24` and, from consecutive jump-table branches, calls
`ovl_19_func_800BB5D4`, `ovl_19_func_800BB848`, `ovl_19_func_800BB8F4`,
`ovl_19_func_800BBB48` and `ovl_19_func_800BBCCC`. Those five members are one
gapless link-order run (BB5D4 + 0x274 = BB848, + 0xAC = BB8F4, + 0x254 = BBB48,
+ 0x184 = BBCCC, + 0x48 = BBD14), so the call graph and the link order agree —
the same fingerprint recorded for the ovl_17/ovl_23/ovl_27 display-setup runs.
The leading handlers share the display-setup idiom `DrawSync` → `ClearOTagR` →
`func_80014CBC` over `D_8005E3B0 + 0x4290` → `func_8001719C`, and the run closes
with the per-overlay audio-setup leaf, mirroring ovl_17_func_800BA504.

Members (link order):
- ovl_19_func_800BB5D4 (s) — display-setup state: DrawSync/ClearOTagR plus
  func_80014CBC/1719C/15704
- ovl_19_func_800BB848 (m, matched this session, byte-exact) — same idiom,
  confirmed: DrawSync(0) / ClearOTagR(D_8005E3C0->field_120,0x800), then
  func_80014CBC(0,0,0x2000,D_8005E3B0+0x4290,1,1) followed by the zero-return
  poll, then func_8001719C(D_8005E3B0+0x4290)
- ovl_19_func_800BB8F4 (s) — same display-setup idiom, plus four func_80015704
  calls
- ovl_19_func_800BBB48 (s) — same idiom via func_80014BCC / func_8001719C,
  plus record copies
- ovl_19_func_800BBCCC (m) — audio-setup leaf: func_80020B80(2,0),
  func_80020B80(1,0), func_8001FBF0 x2

## `ovl_11` D_8006C838 +0x8000 work-area halfword run — 0x801128B4 / 0x80112904 / 0x801129A0 (confidence: medium)

- **gapless link adjacency:** `ovl_11_func_801128B4` (0x50 bytes at 0x801128B4)
  ends exactly at `ovl_11_func_80112904` (0x9C bytes at 0x80112904), which ends
  exactly at `ovl_11_func_801129A0` (0x4C bytes at 0x801129A0), which ends
  exactly at `ovl_11_func_801129EC` — consecutive functions.csv rows,
  all four now matched byte-exact; the caller's register bindings are an
  explicitly user-authorized workaround, not original-source evidence;
- **identical base idiom:** all three fix `char *base = (char *)&D_8006C838` and
  reach the large-offset work area through a second pointer
  (`base2 = base + 0x8000`, the `ori 0x8000` + `addu` split), the D_8006C838
  reader fingerprint of this container;
- **adjacent offsets in one region:** the bodies touch neighbouring
  halfwords of the same block — 801128B4 memsets the +0x676C region (0x34 bytes
  from D_80074838+0x676C) and writes -1 to +0x6776, 80112904 reads the packed
  word at +0x44B8 and writes +0x676C/+0x6776/+0x6778, while 801129A0 reads
  +0x44BA/+0x44BC and writes +0x5BDC/+0x5BDE/+0x6770 (0x6770 sits between
  801128B4/80112904's 0x676C and 0x6776), so all three address one D_8006C838
  work-area TU.

Members (link order):
- ovl_11_func_801128B4 (m, matched this session) — void reset routine: memsets the
  +0x676C region then writes -1 to the +0x6776 mode halfword and calls
  `func_8001AF70(0x1B, 1)`
- ovl_11_func_80112904 (m) — 5-way selector: stores the argument at +0x6778,
  sets the +0x6776 mode and clears +0x676C, then copies the packed word at
  +0x44B8 to +0x6796
- ovl_11_func_801129A0 (m, matched this session) — void leaf: copies the two
  engine halfwords at +0x44BA/+0x44BC into the +0x5BDC/+0x5BDE slots, calls
  `func_8001AF70(0x4E, 0)`, then clears the +0x6770 halfword

## `ovl_11` CD-load wrapper run — 0x800BD374 / 0x800BD3C4 (confidence: low)

Candidate same-TU pair of `ovl_11` (`Obj\GF_FARM.bin`). Evidence is gapless
link-order adjacency plus a shared CD-load call idiom, not a shared private
data cluster (the two members index different main-RAM tables).

Fingerprints:
- zero-gap link-order contiguity (map): `ovl_11_func_800BD1BC` (0x7C, ends
  0x800BD238) → `ovl_11_func_800BD238` → `ovl_11_func_800BD358` →
  `ovl_11_func_800BD368` → `ovl_11_func_800BD374` (0x50, ends 0x800BD3C4) →
  `ovl_11_func_800BD3C4` (0xC4, ends 0x800BD488) → `ovl_11_func_800BD488`
  (0xB0, ends 0x800BD538), each starting exactly where the previous ends (the
  run extends back through 0x800BD1BC);
- identical `func_80014BCC`/`func_80014CBC` wrapper shape: both select a
  stride-0x10 record from an absolute main-RAM table (`lw a1,0(v1)`,
  `lw a2,4(v1)`, `subu a2,a2,a1`) and pass that word difference as the third
  CD-load argument — 800BD374 calls `func_80014CBC` with the 6th arg, 800BD3C4
  calls the adjacent `func_80014BCC`;
- same idiom cluster as the already-matched `ovl_11` CD-load wrappers
  `ovl_11_func_800BD668` / `800BD8DC` / `800BD9D4` / `800BDA20`, which all call
  `func_80014BCC` with a plain argument list; the broader 0x800BCF54–0x800BDA70
  span holds many more `func_80014BCC`/`80014CBC` call sites, so the run is not
  one TU and only the proven adjacency is claimed here;
- the same-run pair `ovl_11_func_800BDA20` / `ovl_11_func_800BD538` both read
  the main-RAM global `D_8005E3B0` and pass `D_8005E3B0 + 0x4290` as the CD-load
  fifth argument, then call `func_8001719C` on the same base object — a shared
  private data cluster, not merely a shared idiom.

Members (link order):
- ovl_11_func_800BD1BC (m, matched this session, byte-exact) — same
  record-difference CD-load wrapper shape as 800BD374/800BD3C4 over the
  `D_801227F8` pair table: `func_80014BCC(0, p[0], p[1]-p[0], 0,
  D_8005E3B0 + 0x4290)` then `memcpy(&D_8007F7F8, D_8005E3B0 + 0x4290,
  p[1]-p[0])`, re-confirming the `D_8005E3B0 + 0x4290` shared cluster and
  extending the run's gapless link-order span back to 0x800BD1BC.
- ovl_11_func_800BD238 (m) — zero-gap link successor of 800BD1BC; same
  `D_8005E3B0 + 0x4290` CD-load wrapper over the sibling pair table
  `D_80122804` (immediately follows 800BD1BC's `D_801227F8`), guarded by the
  `D_8007AFF0 + 0x20000 + 0x5476` state word. Confirms the shared cluster tie.
- ovl_11_func_800BD374 (m, matched this session, byte-exact) — s32 wrapper:
  indexes the `D_801217A8` stride-0x10 table by arg0 and calls
  `func_80014CBC(0, record[0], record[1]-record[0], (u8 *)D_8007AFF0, 1, arg1)`,
  returning the result tested non-zero.
- ovl_11_func_800BD3C4 (s) — same table-difference CD-load wrapper (indexes
  `D_801227B0`, `D_80124FCC`) calling `func_80014BCC`; role not yet
  reconstructed beyond the shared shape.
- ovl_11_func_800BD488 (m, matched this session, byte-exact) — same
  table-difference CD-load wrapper as 800BD1BC/800BD3C4 over the `D_8012279C`
  pair table and the `D_80124FCC` pointer table (shared with 800BD3C4):
  `func_80014BCC(0, p[0], p[1]-p[0], 0, D_8005E3B0 + 0x4290)`,
  `memcpy(&D_80098BF8, D_8005E3B0 + 0x4290, n)`, then
  `func_8001719C(D_8005E3B0 + n + 0x4290)`; between 800BD3C4 and 800BD538.
- ovl_11_func_800BD538 (m, matched this session, byte-exact) — zero-gap link
  successor of 800BD488 (which follows 800BD3C4) and `D_8005E3B0` twin of
  800BDA20: `func_80014BCC(0, 0x380B000, 0x5000, 0, D_8005E3B0 + 0x4290)`,
  `ovl_11_func_800DD21C(&D_8009A3F8, D_8005E3B0 + 0x4290, 0x540)`, then
  `func_8001719C(D_8005E3B0 + 0x5790)`. Confirms the shared-global tie, not
  just the wrapper idiom.

---

## `ovl_11` D_801273DC handler-table run — 0x801033D4–0x801035C0 (confidence: high)

Candidate same-TU family of `ovl_11` (`Obj\GF_FARM.bin`): a generated run of
per-case event handlers sharing one file-scope main-RAM function-pointer global.

Fingerprints:
- shared main-RAM global `D_801273DC` (absolute `lui`+`%lo` in every site, no
  gp-rel in this container): written with the address of `ovl_11_func_80103714`
  by four members of this run and by `ovl_11_func_8010289C` (multiple sites);
  cleared to 0 (with the whole `D_801273Exx` state block) by
  `ovl_11_func_800FFDCC`, so the reset/init tie also reaches the state cluster;
- zero-gap link-order contiguity: `ovl_11_func_801033D4` (0x50, ends 0x80103424)
  → `ovl_11_func_80103424` (0x5C, ends 0x80103480) → `ovl_11_func_80103480`
  (0x50, ends 0x801034D0) → `ovl_11_func_801034D0` (0x78, ends 0x80103548) →
  `ovl_11_func_80103548` (0x78, ends 0x801035C0) → helper
  `ovl_11_func_801035C0`; each starts exactly where the previous ends;
- one handler template shared verbatim across the run: guard on
  `func_80013394()`, then `func_8002261C(3, 0x3C0 + case)`, then
  `func_800226A4() == 2`, then store `D_801273DC = ovl_11_func_80103714` — the
  case index increments 0x3C0/0x3C1/0x3C2/0x3C3/0x3C4 with the members in
  address order, a dispatch-table signature no coincidence explains;
- a remote member outside the contiguous run, `ovl_11_func_80100128`
  (0x80100128), carries the same `func_8002261C(3, case)` +
  `func_800226A4() == 2` + `D_801273DC` store template at case 0x3B6, without
  the `func_80013394()` guard, and is the only site that can store
  `ovl_11_func_80100194` (selected over `ovl_11_func_80103714` by
  `(s16)func_800225B8() == 1`), extending the template below the run's case
  range;
- `ovl_11_func_80100194` (0x80100194) extends the template at case 0x3B7:
  `func_8002261C(3, 0x3B7)` + `func_800226A4()` stored in a register that stays
  live across `func_800225B8()` + three-way `(s16)func_800225B8()` selection
  storing `ovl_11_func_8010021C` (==1), `ovl_11_func_80100FFC` (==2), else
  `ovl_11_func_80103714` into `D_801273DC` — it is a handler entry point (stored
  by `ovl_11_func_80100128`) that itself re-installs one of three handlers;
- a second such remote member, `ovl_11_func_801022E8` (0x801022E8), carries the
  `func_8002261C(3, case)` + `func_800226A4() == 2` template at case 0x3BF —
  a third distinct case value after 0x3B6 and the 0x3C0–0x3C4 series — and is
  the only site that stores `D_801273DC = ovl_11_func_8010289C`, a second
  symbol written into this global; its other arm writes `D_801273E4 = 3`,
  bridging the two `D_801273Exx` handler entries.

Members (address order):
- ovl_11_func_80100128 (m, matched this session) — remote case 0x3B6 handler;
  no `func_80013394()` guard; stores `ovl_11_func_80100194` when
  `(s16)func_800225B8() == 1`, else `ovl_11_func_80103714`
- ovl_11_func_80100194 (m, matched this session) — case 0x3B7 handler;
  three-way `(s16)func_800225B8()` dispatch storing `ovl_11_func_8010021C`,
  `ovl_11_func_80100FFC`, or `ovl_11_func_80103714` into `D_801273DC`
- ovl_11_func_801022E8 (m, matched this session) — remote case 0x3BF handler;
  `(s16)func_800225B8() == 1` arm calls `func_800132F0(0xA, 0, 2)` then stores
  `D_801273DC = ovl_11_func_8010289C`, else arm stores `D_801273E4 = 3`
- ovl_11_func_801033D4 (m, matched this session) — case 0x3C0 handler; sets
  `D_801273DC = ovl_11_func_80103714`, no helper call
- ovl_11_func_80103424 (s) — case 0x3C1 handler; same store, calls helper
- ovl_11_func_80103480 (m, matched this session) — case 0x3C2 handler; same store, no helper call
- ovl_11_func_801034D0 (s) — case 0x3C3 handler; same store, gated helper call
- ovl_11_func_80103548 (s) — case 0x3C4 handler; same store, gated helper call
- ovl_11_func_801035C0 (s) — shared helper called by the 0x3C1/0x3C3/0x3C4 arms

---

## `ovl_11` D_801273E4/D_801273F4 state-block handler — 0x801014A4 / 0x80102268 (confidence: low)

Members tied to the `D_801273Exx` state block by shared globals and to
`ovl_11`'s event-handler idiom by their call shape rather than by link
adjacency (0x801014A4 sits immediately before `ovl_11_func_801014F8` at
0x801014F8, nowhere near 0x801033D4 run).

- **link-order contiguity:** `ovl_11_func_80102268` (0x80, ends 0x801022E8)
  → `ovl_11_func_801022E8` (0x80, ends 0x80102368) — the two state-block
  handlers are gaplessly adjacent, unlike 0x801014A4;

- **shared global cluster:** writes `D_801273E4 = 3`, a member of the
  `D_801273Exx` block that `ovl_11_func_800FFDCC` clears (the same reset tie
  already recorded for the `D_801273DC` run above); its load uses the u16
  array `D_801273F4[(s8)arg0]`, a symbol referenced by no other function;
- **shared handler idiom:** `func_8002261C(3, ...)` then `func_800226A4() == 2`
  then a `D_801273Exx` store — the D_801273DC run's template, here without
  the `func_80013394()` guard and storing `D_801273E4` instead.

Members (address order):
- ovl_11_func_801014A4 (m, matched this session) — reads `D_801273F4[(s8)arg0]`,
  calls `func_8002261C(3, value)`, sets `D_801273E4 = 3` when
  `func_800226A4() == 2`
- ovl_11_func_80102268 (m, matched this session) — resolves
  `ovl_11_func_80102844((s8)arg1, (s8)arg0)` to a 3×s16 record, takes its first
  halfword (0xA4 branch adds `ovl_11_func_800D60D4(record) + 0x3E8`), calls
  `func_8002261C(3, value)`, sets `D_801273E4 = 3` when `func_800226A4() == 2`
- ovl_11_func_801022E8 (m, matched this session) — gapless follower of
  `ovl_11_func_80102268`; calls `func_8002261C(3, 0x3BF)`, then when
  `func_800226A4() == 2`: if `(s16)func_800225B8() == 1` calls
  `func_800132F0(0xA, 0, 2)` and stores `D_801273DC = ovl_11_func_8010289C`,
  else sets `D_801273E4 = 3`

---

## `ovl_11` D_801273DC state-block init/installer run — 0x800FFDCC / 0x800FFE64 / 0x800FFEF0 (confidence: high)

Candidate same-TU run tied to the `D_801273Exx` main-RAM state block and the
`D_801273DC` handler pointer already documented by the D_801273DC handler-table
run (this file). Evidence is gapless link-order adjacency plus complementary
roles on that shared state block, with the case number corroborating the
dispatch tie.

Fingerprints:
- **gapless link adjacency:** `ovl_11_func_800FFDCC` (0x98 bytes at
  0x800FFDCC) ends exactly at `ovl_11_func_800FFE64` (0x8C bytes at
  0x800FFE64), which in turn ends exactly at `ovl_11_func_800FFEF0` (0x8C
  bytes at 0x800FFEF0) — a zero-gap three-function run;
- **shared `D_801273Exx` state block, complementary roles:** 800FFDCC is the
  block's reset leaf — it zeroes `D_801273DC` along with the whole
  `D_801273Exx` block; its gapless followers 800FFE64 and 800FFEF0 re-seed
  members of that same block (`D_801273E4 = 1`, `D_801273E5 = 0` in 800FFE64;
  `D_801273E4 = 1`, `D_801273E5 = 1` in 800FFEF0);
- **handler install:** 800FFE64 is the only site that stores
  `D_801273DC = ovl_11_func_80100128`; 80100128 is the case-0x3B6 handler of
  the D_801273DC handler-table run, and 800FFE64's own event call is
  `func_8002261C(3, 0x3B5)`, the case immediately below 0x3B6 — an
  adjacent-case dispatch tie, not just a coincident store. 800FFEF0 stores
  `D_801273DC = ovl_11_func_8010021C`, the three-way handler that the case-0x3B7
  entry `ovl_11_func_80100194` installs — the same install template one link
  slot later;
- **shared call cluster:** 800FFE64 and 800FFEF0 are byte-template twins —
  both OR bit 0x20000 into `D_8006C838.field_0C` (the work-area bit seen in the
  0x800F66F0 state-set run), call the run's reset leaf `ovl_11_func_800FFDCC`
  at entry, call `ovl_11_func_800F69D0`, and close with the identical event tail
  `func_8001FABC(3)` / `ovl_11_func_800F77A8(-1)` / `func_800226D8(0)` /
  `func_80017B18(0)` / `func_8002261C(3, 0x3B5)`; they differ only in the two
  `D_801273Exx` stores and the installed handler pointer.

Members (link order):
- ovl_11_func_800FFDCC (m) — reset leaf for the `D_801273Exx` state block:
  zeroes `D_801273DC`, `D_801273E4`/`D_801273E5` and the rest of the block
- ovl_11_func_800FFE64 (m, matched this session, byte-exact) — case-0x3B5
  installer: calls 800FFDCC, sets `D_801273E4 = 1` / `D_801273E5 = 0`,
  stores handler `ovl_11_func_80100128` into `D_801273DC`, then the shared
  event tail ending `func_8002261C(3, 0x3B5)`
- ovl_11_func_800FFEF0 (m, matched this session, byte-exact) — twin installer
  one link slot later: same entry calls and shared event tail, sets
  `D_801273E4 = 1` / `D_801273E5 = 1`, stores handler
  `ovl_11_func_8010021C` into `D_801273DC`

---

## `ovl_11` D_8005E3B0+0x4290 CD-load wrapper pair — 0x800F71DC / 0x800F7230 (confidence: medium)

Candidate same-TU pair of `ovl_11` (`Obj\GF_FARM.bin`). Evidence is zero-gap
link-order contiguity plus a shared CD-load source buffer and destination
constant pair, not a shared private data cluster.

Fingerprints:
- zero-gap link-order contiguity (map): `ovl_11_func_800F71DC` (0x54, ends
  0x800F7230) → `ovl_11_func_800F7230` (0x578); each starts exactly where the
  previous ends;
- shared main-RAM CD-load source buffer `D_8005E3B0 + 0x4290`: both load
  `lw $a3, %lo(D_8005E3B0)` then place `addiu $a3, $a3, 0x4290` in the jal
  delay slot of `func_80014CBC`, passing it as the third CD-load argument;
- same CD-load destination constants `0x3C19000` / `0x28000` with a scaled
  index: 800F71DC uses `((arg0 << 16) >> 5) + 0x3C19000`, `0x28000`; 800F7230
  uses `((arg0 << 16 >> 16) << 11) + 0x3C19000`, `0x28000`.

Members (link order):
- ovl_11_func_800F71DC (m, matched this session, byte-exact) — void CD-load
  wrapper: `func_80014CBC(0, ((arg0 << 16) >> 5) + 0x3C19000, 0x28000,
  (u8 *)D_8005E3B0 + 0x4290, 1, 1)`.
- ovl_11_func_800F7230 (s) — larger CD-load + state machine: same call head,
  then result-gated handling of a case index against `D_80126F74` /
  `D_80126E30` state tables; role not yet reconstructed.

---

## `ovl_11` D_80126F7C/80/84/88 menu-state run — 0x800F9D3C–0x800F9FF4 (confidence: medium)

Candidate same-TU run of `ovl_11` (`Obj\GF_FARM.bin`) built from zero-gap
link-order contiguity plus a shared four-word file-scope state cluster at
0x80126F7C–0x80126F88. Same shared-global + link-adjacency fingerprint class as
the documented `D_80126FE0/E4/E8/EC` and `D_8012DB10` runs; absolute-addressed
main-RAM globals (no gp-rel in this container), so the referencing TU only
*declares* the cluster extern.

Fingerprints:
- shared cluster `D_80126F7C` / `D_80126F80` / `D_80126F84` / `D_80126F88`
  (main RAM 0x80126F7C–0x80126F88, s32 words) plus the sibling s16
  `D_80070CF0` / `D_80070CF4` pair: `ovl_11_func_800F9D3C` resets 0x7C/0x84/0x88;
  `ovl_11_func_800F9D5C` writes 0x7C/0x84/0x88 and reads s16 `D_80070CF4`;
  `ovl_11_func_800F9DB0` and `ovl_11_func_800F9E4C`/`800F9F58`/`800F9FF4` all
  address the same words, so the cluster is not a one-function private cell.
- zero-gap link order: `ovl_11_func_800F9D3C` (0x20, ends 0x800F9D5C) →
  `ovl_11_func_800F9D5C` (0x54, ends 0x800F9DB0) → `ovl_11_func_800F9DB0` (0x9C)
  → `ovl_11_func_800F9E4C` (0x10C) → `ovl_11_func_800F9F58` (0x9C) →
  `ovl_11_func_800F9FF4`, each starting exactly where the previous ends.
- shared helper-call set across the run: `func_8001FABC(3)`,
  `ovl_11_func_800F6640`, and `func_800226B0` / `func_80022738`; shared constants
  `D_8005E3A8` / `D_8005E3C0` files kept alongside the state cluster.

Members (address order):
- ovl_11_func_800F9D3C (m) — leaf reset stub: zeroes the three s32 words
  0x7C/0x84/0x88; tail of the run head.
- ovl_11_func_800F9D5C (m, matched this session) — set-up stub called from
  0x800C7AC0: calls 800F9D3C, stores 800F6648() into 0x80126F88, calls
  800F6638, `func_8001FABC(3)`, sets 0x80126F7C = 1, then copies the s16
  `D_80070CF4` into 0x80126F84.
- ovl_11_func_800F9DB0 (s) — next run member; reads 0x80126F7C and drives the
  0x40000 packet path plus func_800226A4/226F0/17A48.
- ovl_11_func_800F9E4C (s) — reads 0x80126F7C/0x88 and `D_80070CF0`, calls
  `ovl_11_func_800F6640` and `func_8001FABC`; adjacent run member.
- ovl_11_func_800F9F58 (m) — gated input handler: mask 0x50 clears
  D_80126F80; mask 0x20 reads D_80126F88 and sets D_80126F7C = 2, sharing
  the run's state words and 800F6640/8001FABC/80022738 helper calls.
- ovl_11_func_800F9FF4 (s) — reads the same cluster and additionally walks
  `D_8006C838`.

---

## `ovl_11` `D_800719F8` clear/set-then-test run — 0x80112440 / 0x80112494 (confidence: medium)

Two constant-for-constant twins in `ovl_11`, immediately adjacent in link order.
Both declare the same global `D_800719F8` (s32, absolute `lui`+`%lo`) and both
call the same SDK helper `ovl_11_func_800F3E00(u16)`, clearing one flag bit of
the global, testing the helper's result against 0x33, and re-setting the bit.
The only differences are the bit (`1` vs `2`), the helper argument (`0x5D` vs
`0x5F`) and a schedule difference in where the reload of the global lands
(delay slot vs after the branch), which is why the second needed its own source
rather than a byte-identical copy. Shared global + shared callee + zero-gap
address adjacency.

Members:
- ovl_11_func_80112440 (m) — `base = &D_800719F8; *base &= ~1;`
  `if (ovl_11_func_800F3E00(0x5D) >= 0x33) *base |= 1;`
- ovl_11_func_80112494 (m, matched this session) — same shape with bit `2`
  (`*base &= ~2`, `*base |= 2`) and argument `0x5F`.

---

## `ovl_11` 0x80110790 shared-helper leaf run — 0x80110790–0x80110944 (confidence: medium)

A gapless four-function run whose members all call the same leaf at the tail:
0x80110790 (size 0xA8, ends 0x80110838) → 0x80110838 (0x58, ends 0x80110890)
→ 0x80110890 (0x68, ends 0x801108F8) → 0x801108F8 (0x4C, ends 0x80110944),
zero gaps (splat order 0x58970/0x58A18/0x58A70/0x58AD8). The call graph agrees:
0x80110790, 0x80110838 and 0x80110890 all call 0x801108F8, and 0x801108F8 is
the only callee they share. 0x80110790, 0x80110838 and the leaf also read one
object through a shared view: the leaf reads an s16 at +0x0, 0x80110790 reads a
u16 at +0x0, 0x80110838 a u16 at +0x2, and each forwards its own arg0 straight
to the leaf.
Members (address order):
- ovl_11_func_80110790 (m, matched this session) — run head: calls 0x801108F8,
  returns 0 when the helper returns 0, otherwise 1 only when the u16 at +0x0
  is outside both [0x31,0x36) and [0x178,0x17A) and the u8 at +0x4 equals the
  s16-at-+0x3 type map reached through the D_8006C838 +0x20/+0x2C pointer
  slots (the D_8006C858/D_8006C860 aliases); 0 otherwise.
- ovl_11_func_80110838 (m, matched this session) — guard/return leaf: calls
  0x801108F8, returns 0 when its result is 0, otherwise returns 1 when the
  u16 at +0x2 is 0x168 or 0x16A and 0 elsewhere.
- ovl_11_func_80110890 (m, matched this session) — middle run member; calls
  the same 0x801108F8 helper with its own arg0, returning 1 when the u16 at
  +0x2 is 0x168, 0x169, 0x16A or 0x16B and 0 elsewhere.
- ovl_11_func_801108F8 (m) — run-tail shared leaf: reads the s16 at +0x0 and
  calls ovl_11_func_800D5868, then returns the XOR-with-0x36 test.

## `ovl_11` func_8001EF98 flag-reader run — 0x800BF3D0–0x800BF4AC (confidence: medium)

A gapless three-function run, sizes from `configs/splat/ovl_11.yaml`: 0x800BF3D0
(0x24, ends 0x800BF3F4) → 0x800BF3F4 (0x5C, ends 0x800BF450) → 0x800BF450
(0x5C, ends 0x800BF4AC), zero gaps. The call graph agrees: all three call the
same engine pointer-getter `func_8001EF98` and then read a flag word out of the
returned object, and no other `ovl_11` function calls it. That single shared
callee plus strict link-order adjacency is source-family evidence; same-TU
membership remains a prior (the callee is engine API, not proof by itself).
Members (address order):
- ovl_11_func_800BF3D0 (m) — gets the object, returns `unk0 >> 7` (one flag).
- ovl_11_func_800BF3F4 (m) — gets the object, maps flags 4→2, 0x40→3, 2→bool.
- ovl_11_func_800BF450 (m, 0x5C, finalized) — gets the object, caches its
  pointer and low flag halfword into D_80128808/D_8012880C, tests 0x2000.
  A user-authorized two-instruction tail preserves the original dead v1=8000
  write; the a0 low-word cache value is produced by a plain named local (no
  register pin). This workaround does not establish original handwritten
  source or strengthen the TU prior.
  All three consumers agree on the pointer-getter interface, but its own
  declaration remains independently unwitnessed.

---

## `ovl_11` `D_8006C838+0xE7A2` per-id byte-cell state-handler run — 0x80117370–0x801176BC (confidence: medium)

A gapless six-function run in `configs/splat/ovl_11.yaml` immediately before
the documented `D_8012D7A8` run: 0x80117370 (0x48, ends 0x801173B8) →
0x801173B8 (0x254, ends 0x8011760C) → 0x8011760C (0x40) → 0x8011764C
(0x28) → 0x80117674 (0x48) → 0x801176BC (0xA0, ends 0x8011775C).
Fingerprints: the 9-entry byte-cell cluster at `D_8006C838+0xE7A2` (=
`D_8007AFDA`) is read by matched 0x8011760C and written by matched
0x801176BC (index 0..8, cell values 1/2/3); run head 0x80117370 sets the
state global `D_8012D794 = 1` and seeds the companion state word `D_8012D798`
from 0x8011760C, and 0x801173B8 is a jump-table (`jtbl_800BB198`) dispatcher
over `D_8012D794` that passes `D_8012D798` as the argument to the matching
handler (call graph: 0x801173B8 calls 0x8011764C, 0x80117674 and 0x801176BC).
The run stops at 0x8011775C, which references `D_8012D7A8` and not
`D_8012D794`/`D_8012D798`.
Members (address order):
- ovl_11_func_80117370 (m) — run head: `D_8012D794 = 1`, `D_8012D798 =
  ovl_11_func_8011760C()`, `D_8012D52C = 0`, `ovl_11_func_80118B84(0,-1,0)`.
- ovl_11_func_801173B8 (s) — jump-table dispatcher over `D_8012D794`;
  dispatches to the four members with `D_8012D798`, sets `D_8012D52C`.
- ovl_11_func_8011760C (m) — scans the `+0xE7A2` 9-cell cluster
  (`D_8007AFDA`) and returns the first index whose cell is 2, else -1.
- ovl_11_func_8011764C (m) — resets two engine sub-states via
  `func_800226D8(0)` / `func_80017B18(0)`.
- ovl_11_func_80117674 (s) — on `func_800226A4() == 5`, calls
  `ovl_11_func_80118B84(record+0x28, 0x83, 0x48)`.
- ovl_11_func_801176BC (m, matched this session) — per-id state handler:
  maps `D_8012D798` through the 10-entry u16 item-id table `D_8012824C`
  (0x8012824C; its only user in `ovl_11`) via `ovl_11_func_800D6014`, keeps
  the id when `D_8006C838+0x5224` allows, writes cell 3 at `+0xE7A2+id`, and
  sets engine flag `id + 0x67` via `func_8001AF70`.

Extension (shared cluster, no adjacency): matched `ovl_11_func_80108B8C`
reads D_8012D050[2]'s signed fields at +8/+A. When the state is 2 and
field_0-600 is in 0..8, it promotes the indexed `+0xE7A2` cell from 1 to 2,
a third reader/writer of this family. An indexed member of an access view
produces the original base-first address addition exactly; a cached byte
pointer did not. This is shared-object evidence, not a new TU-boundary claim.

---

## `ovl_11` `D_8012D7A8` s16-table accessor run — 0x8011775C–0x80117F14 (confidence: medium)

A gapless four-function run in `configs/splat/ovl_11.yaml`: 0x8011775C
(0x2E4, ends 0x80117A40) → 0x80117A40 (0x174, ends 0x80117BB4) →
0x80117BB4 (0x360, ends 0x80117F14) → 0x80117F14 (0x5C, ends 0x80117F70),
with no unrelated code between. All four target dasm files reference the same
external s16 table at 0x8012D7A8 — a shared absolute global cluster — and the
call graph agrees (`80117BB4` calls `80117F14`). The run stops at 0x80117F70,
which does not reference the table.
Members (address order):
- ovl_11_func_8011775C (s) — reads D_8012D7A8; role unknown.
- ovl_11_func_80117A40 (s) — reads D_8012D7A8; role unknown.
- ovl_11_func_80117BB4 (s) — reads D_8012D7A8 and calls 80117F14; role unknown.
- ovl_11_func_80117F14 (m, matched this session) — clamps arg0 to 0..4, calls
  func_80022738, then returns func_8002261C(2, D_8012D7A8[arg0]).

---

## `ovl_11` D_8006C838+0x8000 work-area +0x64C8 halfword pair — 0x800BFCA4 / 0x800BFD04 (confidence: medium)

Pair of `ovl_11` functions sharing one work-area halfword and the container's
`D_8006C838+0x8000` base fingerprint.

Fingerprints:
- zero-gap link adjacency (map): `ovl_11_func_800BFCA4` (0x60, ends exactly
  0x800BFD04) → `ovl_11_func_800BFD04` (0x18, ends 0x800BFD1C);
- shared object offset: both form `char *base = (char *)&D_8006C838;
  base += 0x8000;` (the `ori 0x8000` + `addu` split) and address the same
  halfword at `base + 0x64C8` — 800BFCA4 reads it (`lhu`) and feeds it to
  `func_8001AF70`, 800BFD04 writes it (`sh`);
- call graph: 800BFCA4 is called by `ovl_11_func_800BFB28` (0x800BFB28),
  which also forms the same `base + 0x8000` work-area base;
- idiom: 800BFCA4 shares the `for (i = 0; i < N; i++)
  func_8001AF70((u16)(i + K), 0); func_8001AF70((u16)(v + K), 1);` template
  with matched `ovl_11_func_800C11C4` (same shape, bound 4 and K = 0x17), so
  it is also a template-family member of that group.

Members (link order):
- ovl_11_func_800BFCA4 (m, matched this session, byte-exact) — clears flag ids
  0x12–0x16 via `func_8001AF70(..., 0)`, then sets flag 1 on
  `(u16)(work[+0x64C8] + 0x12)`.
- ovl_11_func_800BFD04 (m) — paired writer: stores its s16 argument into the
  same work halfword at `+0x64C8`.

Extension (shared object, no link adjacency): `ovl_11_func_800C056C`
(m, matched this session, byte-exact) reads the same `base + 0x64C8` work
halfword through the identical `base += 0x8000` two-stage spelling and, on the
same `D_8006C838` object, also gates on the `+0xC & 0x08000000` and `+0x8 & 7`
fields. Its second halfword field, `D_8007AFF0 + 0x253B8`, is the far-buffer
slot of the `+0x253xx` region documented for `ovl_11_func_800DB904` /
`ovl_11_func_800DB978`; the shared-object offsets, not a contiguous run, are the
tie, so membership is weaker than the adjacent pair above.
- ovl_11_func_800C056C (m, matched this session, byte-exact) — guarded
  read-modify-write: when `+0x64C8` is 3 or 4 and `(+0x8 & 7) == 3`, subtracts
  `func_80012A34(0x64) - 0x32` from the `D_8007AFF0 + 0x253B8` halfword.

---

## `ovl_17` D_8006C838+0x8000 work-area 0x1D4-stride record pair — 0x800BB394 / 0x800BB3F4 (confidence: medium)

Evidence: zero-gap link-order adjacency plus a shared D_8006C838 large-offset
fingerprint. `ovl_17_func_800BB394` (0x60, ends exactly 0x800BB3F4) →
`ovl_17_func_800BB3F4` (0x60). Both sign-extend an s16 arg0, scale it by
0x1D4 (`sll`/`subu` plus two `sll`+`addu` steps), add `(char *)&D_8006C838`,
form the work-area base with the `ori 0x8000` + `addu` split (0x8000 cannot
fold into an `addiu` displacement), and address one u16 halfword at
base+0x19EA (800BB394) / +0x19EC (800BB3F4) in the same
read/compare/increment-or-cap leaf shape with the store in the `jr $ra` delay
slot. The stride and offset match the cross-container idiom twins
`ovl_11_func_8011FF0C` / `ovl_11_func_8011FEA0`; that cross-container relation
is not by itself membership evidence, but the same-container adjacency and
shared work-area fingerprint here are.
Members (link order):
- ovl_17_func_800BB394 (m, matched this session, byte-exact) — leaf: if the s16
  at +0x19EA is < 0xEB then add 0x14 (via an unsigned reload) else store 0xFF.
- ovl_17_func_800BB3F4 (s) — idiom twin, unmatched: `lhu` at +0x19EC, if
  0xFE0A < value store -1 else add 0x1F4.

Cross-container note: `ovl_19_func_800BBD14` (m, matched this session,
byte-exact) is a byte-identical shape twin of `ovl_17_func_800BB394` — same
s16 sign-extend, same 0x1D4 stride, same `(char *)&D_8006C838` + `ori 0x8000`
work-area split, same +0x19EA halfword, same `< 0xEB then +0x14 else 0xFF`
leaf with the store in the `jr $ra` delay slot. That twin relation is not
TU-membership evidence for either container; only the ovl_17 same-container
link adjacency above is.

## `ovl_23` D_8006C838+0x8000 work-area 0x1D4-stride record pair — 0x800BB7A0 / 0x800BB800 (confidence: medium)

Evidence: zero-gap link-order adjacency plus the same D_8006C838 large-offset
fingerprint as the ovl_17 pair above. `ovl_23_func_800BB7A0` (0x60, ends
exactly 0x800BB800) → `ovl_23_func_800BB800` (0x60). Both sign-extend an s16
arg0, scale it by 0x1D4 (`sll`/`subu` plus two `sll`+`addu` steps), add
`(char *)&D_8006C838`, form the work-area base with the `ori 0x8000` + `addu`
split, and address one u16 halfword at base+0x19EA (800BB7A0) / +0x19EC
(800BB800) in the same read/compare/increment-or-cap leaf shape with the
store in the `jr $ra` delay slot. Members (link order):
- ovl_23_func_800BB7A0 (m, matched this session, byte-exact) — leaf: if the s16
  at +0x19EA is < 0xEB then add 0x14 (via an unsigned reload) else store 0xFF.
- ovl_23_func_800BB800 (s) — idiom twin, unmatched: `lhu` at +0x19EC, if
  0xFE0A < value store -1 else add 0x1F4.

Cross-container note: `ovl_23_func_800BB7A0` is a third byte-identical shape
twin of `ovl_17_func_800BB394` and `ovl_19_func_800BBD14` (same four-shape
leaf body and +0x19EA halfword); as with that pair the cross-container
relation is not itself TU-membership evidence, but the same-container
zero-gap adjacency above is. The 0x1D4-stride leaf now appears in all three
containers at the same relative slot before its +0x19EC twin.

## `ovl_11` 0x800FA4F4 dispatch-wrapper run + shared `800FA950` map helper — 0x800FA4F4–0x800FA600 (confidence: medium)

Evidence: zero-gap link-order over the whole span — `ovl_11_func_800FA4F4`
(0x64, ends exactly 0x800FA558) → `ovl_11_func_800FA558`/`800FA590`/`800FA5C8`
(each 0x38, gapless, ending exactly at 0x800FA600) → `ovl_11_func_800FA600`.
The run head and the three wrappers share the same `(s32, s16, s16)` argument
shape, and the run's two non-wrapper members share a direct callee:
`ovl_11_func_800FA4F4` and `ovl_11_func_800FA600` both `jal`
`ovl_11_func_800FA950`. Members (link order):
- ovl_11_func_800FA4F4 (m, matched 2026-11, byte-exact) — run head: calls
  800FA950 to fill two adjacent s16 locals at sp+0x10/0x12, then
  func_800248B0(arg0, l0+0xC, l1+0x9).
- ovl_11_func_800FA558 (m) — wrapper: `800FA600(0, arg0, arg1, arg2)`.
- ovl_11_func_800FA590 (m) — wrapper: `800FA600(1, arg0, arg1, arg2)`.
- ovl_11_func_800FA5C8 (m) — wrapper: `800FA600(2, arg0, arg1, arg2)`.
- ovl_11_func_800FA600 (m, matched 2026-10, byte-exact) — run tail: reads the
  overlay-private 4-byte `D_80126FD4` table (u8 state / u8 sub-state / u16
  offset) and calls func_80015840, func_8001585C, ovl_11_func_800FA950,
  func_80015EE8. `D_80126FD4` sits directly after `D_80126F8C` in the same
  ovl_11 data subsegment (both bitfield-scan tables), a same-container data
  cluster tying this run's tail to the 0x800FA31C table group.
- ovl_11_func_800FA950 (m) — shared s16 range-map helper: two `%7`/`/7`
  formulas written through two s16 pointers.

---

## `ovl_11` D_80129FF0 argument-buffer cluster — 0x800FA6CC–0x800FA9B8 (confidence: medium)

Evidence: the absolute global `D_80129FF0` (24-byte scratch span) is referenced
by `ovl_11_func_800FA6CC`, `ovl_11_func_800FA87C` and `ovl_11_func_800FA9B8`,
three members of the gapless 0x800FA4F4 link-order run, and by no other function
in it. `ovl_11_func_800FA87C` repeats `ovl_11_func_800FA4F4`'s idiom — call the
shared `ovl_11_func_800FA950` to fill two adjacent s16 locals at sp+0x10/0x12,
then pass both on — and is zero-gap adjacent to that helper (0x800FA87C + 0xD4 =
0x800FA950). Members (link order):
- ovl_11_func_800FA6CC (m, matched this session, byte-exact) — number-field
  panel draw: opens the buffer by writing 0xFFFF through the u16 pointer
  returned by func_8001A970(arg1+1, D_80129FF0, 2), draws the exe table base
  `(u8 *)D_80051B9A + *D_80054BBC` at func_80017B3C(arg0, p, 0x39, 0x34), clamps
  arg2 to 0..3, then draws `D_80129FF0` at columns 0x8E/0x9E. The identical
  opening write as ovl_11_func_800FA87C is a second shared-buffer witness
  inside this cluster.
- ovl_11_func_800FA87C (m, matched this session, byte-exact) — writes 0xFFFF
  through the u16 pointer returned by func_8001A970(arg1+1, D_80129FF0, 2),
  fills sp+0x10/0x12 via ovl_11_func_800FA950, picks a sound id from arg3 and
  the caller-saved temp, then calls func_80017A48 and func_80017B3C(arg0,
  D_80129FF0, l0, l1).
- ovl_11_func_800FA9B8 (s) — references D_80129FF0; role unknown.

---

## `ovl_11` 0x800FA7D4 grid-scan leaf, gapless predecessor of `800FA87C` (confidence: medium)

Evidence: zero-gap link-order adjacency with a matching direct call edge —
`ovl_11_func_800FA7D4` (0xA8, 0x800FA7D4–0x800FA87C) ends exactly at
`ovl_11_func_800FA87C`, which it `jal`s; its own predecessor
`ovl_11_func_800FA6CC` (0x108) ends exactly at 0x800FA7D4, and the three sit in
the same gapless 0x800FA4F4–0x800FA9B8 run. The `(arg1 + i) % 7` row
computation is the same idiom as the run's shared `ovl_11_func_800FA950`
helper.

- ovl_11_func_800FA7D4 (m, matched this session, byte-exact) — grid scan:
  for `i` in 0..29 calls `ovl_11_func_800FA87C(arg0, i, arg1, flag)`, where
  `flag` is 2, overridden to `(arg1+i)%7 == 6` when that residue is nonzero.

---

## `ovl_15` D_801376D0/D_80137AB0 scratch-buffer run — 0x80134C48–0x80135AE0 (confidence: medium)

A gapless four-function run in `configs/splat/ovl_15.yaml`, every member
writing the pointer `D_801376D0 = (u8 *)D_80137AB0`: 0x80134C48 (0x738, ends
exactly 0x80135380) → 0x80135380 (0x67C, ends exactly 0x801359FC) →
0x801359FC (0x7C, ends exactly 0x80135A78) → 0x80135A78 (0x68, ends
0x80135AE0 = next unrelated subsegment). The shared absolute global pair is the
cluster tie and the run is zero-gap. The two tail members additionally share an
identical prologue (the same `lui $v1,%hi(D_801376D0)` / `lui
$v0,%hi(D_80137AB0)` / `addiu` / `sw $v0,%lo(D_801376D0)($v1)` sequence) and
mirror 201-iteration memmove loops on the same buffer, which is what the run's
tail adjacency adds to the global tie.
Members (link order):
- ovl_15_func_80134C48 (s) — sets `D_801376D0 = D_80137AB0`, then repeatedly
  reads the pointer back; calls `memset`; role otherwise unknown.
- ovl_15_func_80135380 (s) — sets `D_801376D0 = D_80137AB0` and is the
  heaviest reader/writer of the pointer; role unknown.
- ovl_15_func_801359FC (m, matched this session, byte-exact) — mirrored sibling: writes the pointer, then 201×
  `memmove(p + 0x80, p + 0x7F, size)` with `size` decreasing by 0x80; afterwards
  `func_80012A34(0x100)` and `D_80137830[0x7FFE] = (u8)result`.
- ovl_15_func_80135A78 (m, matched this session, byte-exact) — writes the
  pointer, then 201× `memmove(p + 0x7F, p + 0x80, size)` from `size = 0x6441`
  decreasing by 0x7F (the mirror of 801359FC).

---

## `ovl_15` D_80137830/D_80137A30 checksum writer/verifier pair — 0x80135AE0 / 0x80135B68 (confidence: medium)

A gapless two-function run in `configs/splat/ovl_15.yaml`: `ovl_15_func_80135AE0`
at 0x7CF8 (0x88 bytes, ends exactly at 0x80135B68) is immediately followed by
`ovl_15_func_80135B68` at 0x7D80 (0xB8 bytes, ends exactly at 0x80135C20). Both
reference exactly the same absolute global pair — `D_80137830` (3 references
each) and `D_80137A30` (2 references each) — and no other member of the
preceding D_801376D0 run does; the run boundary at 0x80135AE0 is where that
shared pair changes. The two are the write and verify halves of one checksum:
80135AE0 stores the per-0x80-byte-block XOR at `D_80137830[off+0x7F]`, the
block-sum at `D_80137A30[0x38]`, and the `D_80137A30` checksum at
`D_80137830[0x27F]`; 80135B68 recomputes the same three values and compares them
(returning -1/0). They also share one inner-loop XOR idiom — both emit
`xor $dst, $byte, $acc` — which in this toolchain is produced only by a `u8`
accumulator. Both now-matched sources use the same count-up nested indexing
`D_80137830[i * 0x80 + j]`, with i=5..255 and j=0..126; the writer uses
j's post-loop value for the checksum slot. This independently corroborates
the shared source idiom rather than merely the emitted XOR. `ovl_15_func_80135C20` (next in link order) is not a member: it
references `D_80137598`, not this pair.

Members (link order):
- ovl_15_func_80135AE0 (m, 0x88, byte-exact) — checksum writer: fills
  each of blocks 5..255's 0x7F-byte checksum slots and the two summary bytes
  in `D_80137A30`/`D_80137830`.
- ovl_15_func_80135B68 (m, matched this session, byte-exact) — checksum
  verifier: returns 0 when all three stored checksums match, else -1.

---

## `ovl_15` MemCard save-file SDK cluster — 0x80135C20 … 0x801367F8 (confidence: medium)

A gapless link-order run of eight functions in `configs/splat/ovl_15.yaml`
(`[0x7E38]`–`[0x8A10]`). Every member references the halfword
`D_80137598` and calls `MemCardSync`, each with a different PSY-Q card
operation. Five of the eight (`80135FF0`, `80136288`, `80136558`,
`80136660`, `801367F8`) also share the filename buffer `D_80140EC0` and call
`ovl_15_func_80137544`, the filename builder the text-draw pair uses; the
shared callee alone does not tie the two groups together — the `D_80137598`
run boundary is what does. The run starts at `80135C20` (its link-order
predecessor `80135B68` references neither `D_80137598` nor `D_80140EC0`) and
ends at `801367F8` (its successor `80136990` references neither).

Members (link order):
- ovl_15_func_80135C20 (s) — `MemCardAccept` + `MemCardSync`; `D_80137598`.
- ovl_15_func_80135E9C (s) — `MemCardExist` + `MemCardSync`; `D_80137598`.
- ovl_15_func_80135FF0 (s) — `MemCardGetDirentry` + `MemCardSync`; `D_80140EC0`.
- ovl_15_func_80136288 (s) — `MemCardReadFile` + `MemCardSync`; `D_80140EC0`.
- ovl_15_func_80136470 (s) — `MemCardFormat` + `MemCardSync`; `D_80137598`.
- ovl_15_func_80136558 (m, matched this session, byte-exact) — `MemCardCreateFile(chan, D_80140EC0, 4)` retry loop guarded by `D_80137598 < 7`; returns 0/2/4/0xB; `ovl_15_func_80137544` builds the name.
- ovl_15_func_80136660 (s) — `MemCardWriteFile` + `MemCardSync`; `D_80140EC0`.
- ovl_15_func_801367F8 (s) — `MemCardReadFile` + `MemCardSync`; `D_80140EC0`.

---

## `ovl_11` 0x800F5700 entry-lookup callers — 0x800F5698 / 0x800F5700 / 0x800F45A4 (confidence: medium)

The `Ovl11Func5700Entry` lookup `ovl_11_func_800F5700` (segment `[0x3D8E0]`)
finds the first 0x18-byte entry whose `u16@+0x2` matches an s16 key and returns
the entry pointer or 0.
Its immediate link-order predecessor `ovl_11_func_800F5698` (`[0x3D878]`, 0x68
bytes, ends exactly at 0x800F5700) is a same-TU caller: it forwards the s16 key
and passes its own `arg1`/`arg2` straight through as the table and count, then
sets/clears bit 0 of the returned entry's `u16@+0x4`. A third overlay function,
`ovl_11_func_800F45A4` (`[0x3C784]`, separate segment), uses the same
call-lookup-then-bit idiom on its own table `D_8006C838`, so the bit-toggle
pattern is the shared fingerprint rather than the segment adjacency alone.

Members (link order):
- ovl_11_func_800F45A4 (m, matched this session, byte-exact) — sibling caller: looks up entry 0xD of
  `D_8006C838`, then sets/clears bit 0 of `u16@+0x4` under `arg1 == 1`.
- ovl_11_func_800F5698 (m, matched this session, byte-exact) — lookup caller:
  `800F5700((s16)arg0, arg1, arg2)`, then `arg3 & arg4` sets bit 0 of
  `u16@+0x4`, else clears it.
- ovl_11_func_800F5700 (m) — shared lookup: scans `arg2` entries of the 0x18-byte
  table for `u16@+0x2 == (s16)arg0`, returns `&entry` or 0.

---

## `ovl_19` D_800BF4D0 overlay-local s16-state consumer cluster — 0x800B89C8 … 0x800BA834 (confidence: medium)

Evidence: seven `ovl_19` functions build the absolute base
`lui/addiu %hi/%lo(D_800BF4D0)` (0x800BF4D0, a 16-byte label that begins a larger
overlay-local s16 state array in `3F54.data.s`; the `D_800BF4C0` label
immediately precedes it and `D_800BF4E0` follows). The symbol lives in the
overlay's own data segment, so sharing it is same-TU private-data evidence, not
shared-RAM noise. The call graph agrees inside the cluster:
`ovl_19_func_800B89C8` calls `800B95D4`/`800B998C`/`800BA770`,
`ovl_19_func_800B998C` calls `800B9AB0`, `ovl_19_func_800BA770` calls
`800BA834`, and `ovl_19_func_800B95D4` calls `800BA2D4` and consumes its
return value. A further member addresses the same array through the
`D_800BF4E0` label (`D_800BF4C0` + 0x20), which the compiler materialises on
its own and against which it folds the neighbouring `D_800BF4E0[-0xD]` access —
the same overlay-local-symbol-folding fingerprint the `D_800BF560` member shows.

Members (link order):
- ovl_19_func_800B843C (m, matched this session, byte-exact) — gapless
  link-order predecessor of `800B847C`; initial state resetter for the same
  overlay-local `D_800BF4C0` array: zeroes `s32@+0x0`, sets `s16@+0xC`,
  `s16@+0x202` and `s16@+0x204` to -1 (the `+0x200`/`+0x202` fields later
  written by `800B8E88`/`800B93B0`), then calls cluster members `800B847C`
  and `800B8544`.
- ovl_19_func_800B847C (m, matched this session, byte-exact) — gapless
  link-order predecessor of `800B8544`; initialises the two `D_800BF4C0`
  records at +0x10/+0x58 (stride 0x48), copying 8-byte records from the
  overlay-local `D_800BCEFC` source table and indexing the overlay-local
  `D_800BCEE8` u16 table by `D_800BF4C0[4] + 1`; calls `800B85F4`.
- ovl_19_func_800B8544 (m, matched this session, byte-exact) — leaf
  overlay-local-array writer: copies three 8-byte records from `D_800BCF0C`
  into `D_800BF4C0 + 0xA0` (stride 0x40) and sets `D_800BF4C0[0x73]` from
  the overlay-local `D_800BCEF0` table indexed by `D_800BF4C0[4]*2 + val%2`
  (`val` = sign-extended `u16@D_8006C838+0xE61C`); gapless link-order
  predecessor of `800B85F4` (0x800B8544 + 0xB0 = 0x800B85F4).
- ovl_19_func_800B85F4 (m, matched this session, byte-exact) — reads the
  `D_800BF4C8` s16 (`D_800BF4C0` + 0x8, same overlay-local array) and an
  overlay-data u16 table, passes the entry through `func_80012A34` (shared
  callee with `800BA2D4`); its link-order neighbour and caller
  `ovl_19_func_800B847C` initialises the `D_800BF4C0` records.
- ovl_19_func_800B89C8 (s, 0x2AC) — cluster hub; also reads `D_800BF4C0` and
  calls `800B95D4`/`800B998C`/`800BA25C`/`800BA770`/`800BAC5C`/`800BAC7C`.
- ovl_19_func_800B8DE8 (m, matched this session, byte-exact) — gapless
  link-order neighbour on the same overlay-local s16 array through the
  `D_800BF4E0` label (`D_800BF4C0` + 0x20): zeroes/+0xBE/-0x64 seeds the
  `+0x20`/`+0x48` records, then fills the `Ovl19Func800BAC40Arg` command records
  at `+0x80`/`+0xC0` via `800BAC50` and at `+0x20`/`+0x58` via `800BAC40`, and
  sets `D_800BF4C0[3]` (= `D_800BF4E0[-0xD]`) to 1; calls cluster member
  `800B843C`.
- ovl_19_func_800B8E88 (m, matched this session, byte-exact) — same overlay-local
  s16 state array via the `D_800BF560` label (`D_800BF4C0` + 0xA0, inside the same
  `3F54.data.s` blob): `func_8002261C(4, 9)` then, when `func_800226A4() == 2`,
  fills the `+0xA0`/`+0xE0` records through `800BAC50` and the `+0x10`/`+0x58`
  records through `800BAC40`, writing `s16@+0x202` (the captured prior-call `$v0`)
  and `s16@+0x6`; shares the `func_8002261C(4, …)` / `func_800226A4() == 2`
  state-handler shape with `800B93B0` and the `Ovl19Func800BAC40Arg` command
  setters with `800BA25C`.
- ovl_19_func_800B8F38 (m, byte-exact) — same overlay-local s16 state array
  through the `D_800BF560` label (`D_800BF4C0` + 0xA0): a per-call `s32` counter in
  the same `3F54.data.s` blob (`D_800BD074`, absolute-addressed, incremented every
  call and reset to 0 on the handler arm) gates a `% 30` branch that writes
  `s16@+0x202` from `func_8001FABC(0x3A)`; the `func_8002261C(4, 0xA)` /
  `func_800226A4() == 2` handler then fills the `+0xA0`/`+0xE0` records through
  `800BAC50` and the `+0x10`/`+0x58` records through `800BAC40`, storing three more
  `func_8001FABC` returns at `s16@+0x202`, then writes `s16@+0xE` (index 7) and
  `s16@+0x6` (index 3); shares the handler shape and callee set with
  `800B8E88`/`800B9050`. Sits in the gapless run `800B8E88` (ends 0x800B8F38) →
  `800B8F38` (0x118, ends 0x800B9050) → `800B9050`.
- ovl_19_func_800B9050 (m, matched this session, byte-exact) — gapless link-order
  successor of `800B8F38` (0x800B8F38 + 0x118 = 0x800B9050) and same overlay-local
  `D_800BF4C0` state array: `func_8002261C(4, 0xB)`, then when `s16@+0x12` (index 9)
  is 4 and `s16@+0x16` (index 11) is < 2 fills the `+0x10` record through
  `800BAC40`; when `func_800226A4() == 2` fills the `+0xA0`/`+0xE0` records through
  `800BAC50` and the `+0x10`/`+0x58` records through `800BAC40`, then writes
  `s16@+0xE` (index 7) and `s16@+0x6` (index 3); shares the `func_8002261C(4, …)` /
  `func_800226A4() == 2` handler shape with `800B8E88`/`800B93B0` and its callee set
  (`func_8002261C`/`func_800226A4`, two `BAC50`, two `BAC40`) with `800B8F38`.
- ovl_19_func_800B93B0 (m, matched this session, byte-exact) — `D_800BF4C0`
  state writer: `func_8002261C(4, 0xE)` then, when `func_800226A4() == 2`,
  clears `s16@+0x6` and, per `func_800225B8()` result 1/2, clears `s16@+0x200`
  and sets `s16@+0x4` to 3 or to that result.
- ovl_19_func_800B95D4 (s, 0x3B8) — cluster's large reader/driver on the
  `D_800BF4D0` base; calls `800BA2D4` (reads its result), `800BA33C`,
  `800BA468`, `800BA5B4`, `800BA73C`, `800BA750`, `800BAC40`.
- ovl_19_func_800B998C (s, 0x124) — reads the base then calls the
  `800B9AB0`/`800B9DC8`/`800B9DD0`/`800B9E14`/… writer chain.
- ovl_19_func_800B9AB0 (s, 0x318) — second base reader; calls
  `800BA0A0`/`800BA564`/`800BA5B4`/`800BA65C`/`800BAC40`.
- ovl_19_func_800BA25C (m, matched this session, byte-exact) — predicate
  dispatcher on the `D_800BF4C0` base: reads the record `s16@+0x12` of the
  `+0x10` and `+0x58` records and, on the two arms, fills the shared
  `Ovl19Func800BAC40Arg` command fields via `800BAC40`; returns 0/1/-1. Called
  by the hub `800B89C8` and by `800B9288`.
- ovl_19_func_800BA2D4 (m, matched this session, byte-exact) — leaf predicate:
  reads the `+0x8` and `+0x50` s16 of the record, returns `(a <= b)` (or
  `func_80012A34(2) != 0` when they are equal), inverting it when
  `func_80012A34(100) >= 0x5B`; the result is consumed by `800B95D4`.
- ovl_19_func_800BA468 (m, matched this session, byte-exact) — same
  overlay-local `D_800BF4C0` array: `800BA564` distance versus `s16@+0x174`,
  then `800BA628` angle minus `s16@+0x4 << 10`, normalised by `+0x1000`, and
  bracket-tested against the `+0x172`-derived 360ths; returns 0/1. Called by
  cluster member `800B95D4`, calls `800BA564`/`800BA628`, and shares the
  `800BA628` + `<<10`/`+0x1000` idiom (same `s16@+0x4` field) with `800BA5B4`.
- ovl_19_func_800BA5B4 (m, matched this session, byte-exact) — angle-band
  classifier: `ovl_19_func_800BA628` result minus `s16@+0x4 << 10`, normalised
  by `+0x1000` when negative, then `sltiu` band tests returning 1/2/3/0; called
  by cluster members `800B95D4`/`800B9AB0`, and shares the `800BA628` +
  `<<10`/`+0x1000` idiom (same `s16@+0x4` field) with `800BA468`.
- ovl_19_func_800BA770 (s, 0xC4) — reads the base and calls
  `800BA834`/`800BAB4C`/`800BAFAC`.
- ovl_19_func_800BA834 (s, 0x318) — base reader; resets an ObjectState via
  `func_80015840`/`8001585C`/`80015868` and calls `800BADF8`.

---

## `ovl_11` `ovl_11_func_800DF4F0` predicate-caller run — 0x800DE9C8–0x800DFB98 (confidence: medium)

Evidence: the overlay-local leaf `ovl_11_func_800DF4F0` (0x800DF4F0, 44 bytes)
has 12 callers, all inside `ovl_11` and all inside the link-order run
0x800DE9C8–0x800DFB98 (`800DE9C8`, `800DEB00`, `800DEF30`, `800DF128`,
`800DF51C`, `800DF5AC`, `800DF614`, `800DF6A8`, `800DF72C`, `800DF84C`,
`800DF9F0`, `800DFB98`), with the callee itself sitting inside that run. A
12-way single-callee fan-in confined to one contiguous link-order span is
same-TU caller-cluster evidence. Two further matched callers (`800DEEE0`,
`800E0AFC`) use the same predicate but sit earlier in the overlay.
Members (link order):
- ovl_11_func_800DF4F0 (m) — shared predicate: returns 0 when `u16@+0x0 == 0`,
  else `(s32@+0x34 & 0x10000) < 1`.
- ovl_11_func_800DE9C8 (s, 0x138), 800DEB00 (s, 0x3E0), 800DEF30 (s, 0xE0),
  800DF128 (s, 0x100), 800DF51C (m, 0x90), 800DF614 (m, 0x94),
  800DF72C (s, 0x120), 800DF84C (s, 0x1A4), 800DF9F0 (s, 0x8C) —
  callers; the common guard is
  `if (ovl_11_func_800DF4F0(arg0) == 0) return -1;`.
- ovl_11_func_800DFB98 (m, 0xA4, matched this session, byte-exact) — caller;
  guard then the `ovl_11_func_800D05D0` view consumer: adds
  `s32@+0x38/+0x3C/+0x40` into a 4-word vector seeded by
  `ovl_11_func_800D0408(*(u16 *)(D_8006C838+0x5200), ..., 0x320)`, then
  stores `D_8006C838+0x5200` into `u16@+0x22`; same body idiom as 8010BC54.
- ovl_11_func_800DF6A8 (m, matched this session, byte-exact) — caller;
  guard then lazy-init flag `s32@+0x34 & 4` (call `800D049C`, then OR 4 in),
  then `ovl_11_func_800D12A0(9)` when `s16@+0x30 == *(s16 *)(&D_8007AFF0 +
  0x25476)`; also a reader of the far state halfword accessor family.
- ovl_11_func_800DF5AC (m, matched this session, byte-exact) — guard then
  `u16@+0x16 -= 10` clamped at 0, then `ovl_11_func_80107DE0(this + 0xA8,
  0x1F, 0x1E)`; caller-side role of the predicate run.
- ovl_11_func_800DF51C (m, byte-exact) — guard then `u16@+0x16 -= 10`
  clamped at 0, then `ovl_11_func_80107DE0(this + 0xA8, 0x24, 0x2D)`, then
  `ovl_11_func_800D12A0(0xA)` when `s16@+0x30 == *(s16 *)(&D_8007AFF0 +
  0x25476)`; shares the clamp and far-state idioms of 800DF5AC/800DF6A8.
- ovl_11_func_800DF614 (m, byte-exact) — guard then `u16@+0xAE` latch
  (`== 0` → -1, else clear), `func_80015868(this + 0x78, 0, 0, 0, 0)`,
  `ovl_11_func_800D049C(this)`, then `ovl_11_func_800D12A0(9)` when
  `s16@+0x30 == *(s16 *)(&D_8007AFF0 + 0x25476)`; the 9-constant twin of
  ovl_11_func_800DF6A8's far-state gate and a reader of the same far-state
  halfword accessor family.

## `ovl_11` `D_800B957C`/`D_800B95CC` two-table handler dispatcher — 0x800DF010 (confidence: medium)

Evidence: `ovl_11_func_800DF010` is a zero-gap member of the confirmed
`ovl_11_func_800DF4F0` predicate-caller span — its predecessor
`ovl_11_func_800DEF30` (0xE0) ends exactly at 0x800DF010 and the target (0xE8)
ends exactly at `ovl_11_func_800DF0F8` — and it is that span's dispatcher: the
first 20-word function-pointer table `D_800B957C` (0x800B957C,
`1664.rodata.s`) holds span members
`800DF51C`/`800DF5AC`/`800DF614`/`800DF6A8`/`800DF72C`/`800DF84C`/`800DF9F0`/
`800DFA7C`/`800DFB3C`/`800DFB98`; the adjacent 20-word table `D_800B95CC`
(0x800B95CC, same rodata file) holds the 0x800DFC44+ handler run. It shares the
span's object layout (`s16@+0x26` handler id, `s16@+0x28/+0x2A/+0x2C`,
`s32@+0x34` flag 0x800) and the `ovl_11_func_800D0408(4, this + 0x48, 0)`
call idiom.
- ovl_11_func_800DF010 (m, matched this session, byte-exact) — table-driven
  dispatcher: when `D_800B957C[arg1]` is set calls it unless
  `s16@+0x26 == arg1 && (s32@+0x34 & 0x800)` (then -1); when `D_800B95CC[arg1]`
  is set and the result ≠ -1 records the selection (0x26/0x28/0x2A/0x2C) and
  calls `ovl_11_func_800D0408`; stores -1 at `s16@+0xB6`.
- ovl_11_func_800DFA7C (m, matched this session, byte-exact) — `D_800B957C`
  table handler: gates `s16@+0x30 == *(s16 *)(&D_8007AFF0 + 0x25476)` and
  `func_80012A34(0xC8) < s16@+0x16`, then shares 800DFB3C's work-area latch
  (`D_8006C838`+0x52C8/+0x52CC/+0x52D0/+0x52D4 → `s32@+0x58..+0x64`, OR
  0x2000 into `s32@+0x34`) and calls `ovl_11_func_800DF010(this, 0x12)`;
  zero-gap link successor of 800DF9F0 and predecessor of 800DFB3C.
- ovl_11_func_800DFB3C (m, matched this session, byte-exact) — `D_800B957C`
  table handler (id 0x12): latches the `D_8006C838`+0x52C8/0x52CC/0x52D0/0x52D4
  work area into `s32@+0x58..+0x64`, ORs 0x2000 into `s32@+0x34`, then calls
  `ovl_11_func_800DF010(this, 0x12)`; zero-gap link predecessor of the run's
  800DFB98, so the rodata-table membership and link adjacency agree.

## `ovl_11` `D_800B961C`/`D_800B966C` two-table handler dispatcher — 0x800E0C24 (confidence: medium)

Evidence: `ovl_11_func_800E0C24` is a second table-driven dispatcher of the
same authoring shape and object layout as `ovl_11_func_800DF010` (identical
`s16@+0x26/+0x28/+0x2A/+0x2C`, `s32@+0x34` flag 0x800, `s16@+0xB6`, and the
`ovl_11_func_800D0408(4, this + 0x48, 0)` call), but over the next pair of
20-word ovl_11 function-pointer tables in `1664.rodata.s`: `D_800B961C`
(0x800B961C, holding 800E10C8/800E1158/800E15C8/800E1254/800E1404/800E11C0/
800E12D8/800E1654/800E1714/800E1770/800E1804) and `D_800B966C` (0x800B966C,
holding 800E180C/800E18C4/800E1974/800E1A3C/800E1B38/800E1BF0/800E1CA8/
800E1D48/800E1DA8). `D_800B966C` is read by exactly one other ovl_11 function,
`ovl_11_func_800E0B40`, which is this target's zero-gap link predecessor
(0x800E0B40 + 0xE4 = 0x800E0C24); table membership and link adjacency agree.
The `D_800B961C` table's handlers are the callers of the
`ovl_11_func_800E109C` predicate run below, tying the pair to that span.

Members (link order):
- ovl_11_func_800E0B40 (s) — gate on `u16@+0x0`, far-state halfword compare,
  then dispatch `D_800B966C[this->unk26]` with the object; zero-gap link
  predecessor of the target.
- ovl_11_func_800E0C24 (m, matched this session, byte-exact) — dispatcher:
  calls `D_800B961C[arg1]` unless `s16@+0x26 == arg1 && (s32@+0x34 & 0x800)`
  (then -1); when `D_800B966C[arg1]` is set and the result != -1 records the
  selection and calls `ovl_11_func_800D0408`; stores -1 at `s16@+0xB6`.
- ovl_11_func_800E1654 (m, matched this session, byte-exact) — `D_800B961C`
  table handler (id 0x12): the guarded twin of ovl_11_func_800E1714 on this
  dispatcher — `s16@+0x30 == *(s16 *)(&D_8007AFF0 + 0x25476)` gate, then
  `func_80012A34(0xC8) < s16@+0x16`, the same
  `D_8006C838`+0x52C8/0x52CC/0x52D0/0x52D4 work-area latch into
  `s32@+0x58..+0x64` and OR 0x2000 into `s32@+0x34`, then
  `ovl_11_func_800E0C24(this, 0x12)` (the 0x800DFA7C/800DFB3C relationship
  replayed on the 800E0C24 run); zero-gap link predecessor of
  ovl_11_func_800E1714 (0x800E1654 + 0xC0).
- ovl_11_func_800E1714 (m, matched this session, byte-exact) — `D_800B961C`
  table handler (id 0x12): the structural twin of ovl_11_func_800DFB3C on
  this dispatcher (same `D_8006C838`+0x52C8/0x52CC/0x52D0/0x52D4 work-area
  latch into `s32@+0x58..+0x64` and OR 0x2000 into `s32@+0x34`), differing
  only in the callee `ovl_11_func_800E0C24(this, 0x12)`, which ties the
  work-area idiom to the 800E0C24 run.

## `ovl_11` `ovl_11_func_800E109C` predicate-caller run — 0x800E05A8–0x800E15C8 (confidence: medium)

Evidence: the overlay-local leaf `ovl_11_func_800E109C` (0x800E109C, 44 bytes)
is byte-structurally the twin of `ovl_11_func_800DF4F0` (same `u16@+0x0 == 0`
guard and same `s32@+0x34 & 0x10000` test) but sits ~0x1B00 bytes later and has
its own single-callee fan-in: 9 recorded callers (`800E05A8`, `800E06E0`,
`800E0D3C`, `800E10C8`, `800E1158`, `800E11C0`, `800E1254`, `800E1404`,
`800E15C8`) plus `800E0AFC`, all inside `ovl_11` and all inside the contiguous
link-order run 0x800E05A8–0x800E15C8, with the callee itself inside that run.
That is the same caller-cluster signature the 800DF4F0 run shows, so it is a
second predicate-caller TU span rather than part of the first.
Members (link order):
- ovl_11_func_800E109C (m) — shared predicate: returns 0 when `u16@+0x0 == 0`,
  else `(s32@+0x34 & 0x10000) > 0` (twin of ovl_11_func_800DF4F0).
- ovl_11_func_800E0AFC (m) — earlier caller: guard then `u16@+0xB0 < 14` →
  `0x164` / `0x165`.
- ovl_11_func_800E05A8 (s), 800E06E0 (s), 800E0D3C (s), 800E10C8 (m,
  byte-exact), 800E1404 (s), 800E15C8 (s) — callers; the common guard is
  `if (ovl_11_func_800E109C(arg0) == 0) return -1;`.
- ovl_11_func_800E11C0 (m, byte-exact, matched this session) — guard then
  `u16@+0xAE` latch (`== 0` → -1, else clear), `func_80015868(this + 0x78, 0,
  0, 0, 0)`, `ovl_11_func_800D049C(this)`, then `ovl_11_func_800D12A0(0xB)`
  when `s16@+0x30 == *(s16 *)(&D_8007AFF0 + 0x25476)`; the 0xB-constant twin
  of ovl_11_func_800DF614 (same body, different predicate callee), mirroring
  the documented 800DF4F0/800E109C predicate twin and tying the 800E109C run
  to the 800DF4F0 run's caller-cluster signature.
- ovl_11_func_800E1254 (m, matched this session, byte-exact) — guard then
  lazy-init flag `s32@+0x34 & 4` (call `800D049C`, then OR 4 in), then
  `ovl_11_func_800D12A0(0xB)` when `s16@+0x30 == *(s16 *)(&D_8007AFF0 +
  0x25476)`; structural twin of ovl_11_func_800DF6A8 on the 800E109C
  predicate (same body, differs only in the predicate callee and the 9→0xB
  constant), mirroring the 800E109C/800DF4F0 twin.
- ovl_11_func_800E1158 (m, matched this session, byte-exact) — guard then
  `u16@+0x16 -= 1` clamped at 0, then `ovl_11_func_80107DE0(this + 0xA8,
  0x1F, 0x2D)`; structural twin of ovl_11_func_800DF5AC on the 800E109C
  predicate.
- ovl_11_func_800E10C8 (m, byte-exact) — guard then `u16@+0x16 -= 10`
  clamped at 0, then `ovl_11_func_80107DE0(this + 0xA8, 0x24, 0x2D)`, then
  `ovl_11_func_800D12A0(0xC)` when `s16@+0x30 == *(s16 *)(&D_8007AFF0 +
  0x25476)`; structural twin of ovl_11_func_800DF51C on the 800E109C
  predicate, and a reader of the far state halfword accessor family.
- ovl_11_func_800E0FD0 (m, matched this session, byte-exact) — link-order-only
  member: zero-gap predecessor of the predicate leaf (0x800E0FD0 + 0xCC =
  0x800E109C); shares the `s16@+0x26` / `s32@+0x34` object view and the
  `ovl_11_func_800E0C24` handler-dispatcher callee with this span. It does
  not call 800E109C, so this is link-adjacency evidence, not caller-cluster
  membership.

## `ovl_11` third far-state gate run — 0x8010BA84–0x8010BCE8 (confidence: medium)

A third link-order band carrying the far-state gate idiom recorded for the
0x800DE9C8–0x800DFB98 and 0x800E05A8–0x800E15C8 runs. The band is one zero-gap
five-function run (0x8010BA84 + 0x94 = 0x8010BB18 + 0x90 = 0x8010BBA8 + 0xAC =
0x8010BC54 + 0x94 = 0x8010BCE8 + 0x84 = 0x8010BD6C), and four of the five
independently repeat `s16@+0x30 == *(s16 *)(&D_8007AFF0 + 0x25476)`. Two
continue the lazy-init flag `s32@+0x34 & 4` /
`ovl_11_func_80107DE0(this + 0xA8, ...)` idiom with the consecutive
`ovl_11_func_800D12A0` constants `0xD` / `0xE` (the 800DF4F0 run uses 9 / 0xA,
the 800E109C run 0xB / 0xC), and the run shares the
`{u16@0, s16@0x30, s32@0x34}` object layout, so the band is the same source
pattern rather than one coincidental accessor.

Members (link order):
- ovl_11_func_8010BA84 (m, matched this session, byte-exact) — inlined predicate
  `u16@+0x0 == 0`, clamp `u16@+0x16 -= 10` at 0, then
  `ovl_11_func_80107DE0(this + 0xA8, 0x1F, 0x1E)` and
  `ovl_11_func_800D12A0(0xE)` on the far-state gate; the run's first member,
  zero-gap to 0x8010BB18, and the `0x1F, 0x1E` clamp sibling of
  ovl_11_func_800DF5AC.
- ovl_11_func_8010BB18 (m, matched this session, byte-exact, baseline flags) —
  inlined predicate `u16@+0x0 == 0`, lazy-init flag `s32@+0x34 & 4`
  (`ovl_11_func_80107DE0(this + 0xA8, 0x25, 0x2D)`), then
  `ovl_11_func_800D12A0(0xD)` on the far-state gate; returns -1; structural
  twin of ovl_11_func_800DF6A8 with the 800DF4F0 predicate inlined.
- ovl_11_func_8010BBA8 (m, 0xAC) — same `u16@+0x0` guard and far-state gate;
  dispatches `func_8002261C(2, 0x258)` / `(2, 0x259)` on the `D_80075AEA`
  threshold (s16 < 9 → 0x258, s16 >= 0xC9 → 0x259, else 0x258), then
  `ovl_11_func_800D12A0(0xD)`. Returns -1 in all paths.
- ovl_11_func_8010BC54 (m, 0x94) — view consumer over `s32@+0x38/+0x3C/+0x40`
  and `D_8006C838+0x5200`; no far-state gate of its own. Verified transfer from
  800E1770 with the shared padded vector interface and the same user-authorized
  selector binding; no new evidence enlarges this TU span.
- ovl_11_func_8010BCE8 (m, byte-exact) — clamps `u16@+0x16 -= 10` at 0, then
  `ovl_11_func_80107DE0(this + 0xA8, 0x24, 0x2D)` and
  `ovl_11_func_800D12A0(0xE)` on the far-state gate; twin of
  ovl_11_func_800DF5AC.
- ovl_11_func_8010BD6C (m, byte-exact this session) — fifth and last member of
  the zero-gap run by link order, but it does **not** carry the band's far-state
  gate; it is a state-switch family handler (recorded as that family's
  thirty-seventh member below). So only four of the five run members share the
  far-state gate fingerprint, and the `0x8010BCE8 + 0x84 = 0x8010BD6C`
  adjacency is the run's only link between the gate run and the state-switch
  family.

## `ovl_11` record-tag update run — 0x800DA3AC–0x800DA518 (confidence: medium)

Four functions in an unbroken link-order run that all mutate the same 8-byte
record (`u16@+0x0`, `u16@+0x2`, `u8@+0x4`, `u8@+0x5`, `u16@+0x6`) behind an
`ovl_11` tag test and a `func_80012A34` guard. The shared record layout is the
strongest fingerprint: `800DA49C` writes the exact `+0x4`/`+0x5`/`+0x6`
byte/halfword fields that `800DA518` reads and writes, and no function sits
between them. `800DA588` starts at the end of the run but uses the unrelated
`D_80125528` record, so the span ends at `800DA518`.
Members (link order):
- ovl_11_func_800DA3AC (m, byte-exact) — `D_80070CF2` selects a 0x40/0x80 mask
  (0 otherwise); tag range 0x167–0x169 + `func_80012A34(mask)` guard sets tag
  0x40 and field 0x167 on an `Ovl11D124Entry` view.
- ovl_11_func_800DA454 (m) — tag 0x3F guard → `func_80012A34`, set tag 0x175.
- ovl_11_func_800DA49C (m, matched this session, byte-exact) — tag != 0x36 +
  `ovl_11_func_800D5868(tag) == 1` + `func_80012A34` guard resets the record:
  tag 0x168/0x168, fields `+0x4 = +0x5 = 0`, `+0x6 = 0`.
- ovl_11_func_800DA518 (m, matched this session, byte-exact) — tag 0x36 +
  nonzero `u8@+0x4` + `func_80012A34` guard → refresh `+0x4` from
  `ovl_11_func_800D5C90(0x36)`, clear `+0x5`, OR `0x8000` into `+0x6`.

## `ovl_11` Ovl11D124Entry 8-byte table cluster — D_80071DFC 25x45 / D_80074124 7x7 (confidence: low)

Evidence: one shared 8-byte record type (`s16@0`, `s16@0x2`, `u8@0x4`,
`u8@0x5`, `s16@0x6`) reached absolutely by three container functions, and the
two tables' rows are exactly the record stride (`D_80071DFC` 25x45, row
0x168 = 45*8; `D_80074124` 7x7, row 0x38 = 7*8). The type now lives in
`globals_override.h` as `Ovl11D124Entry`. The three members are address-apart
in link order, so the shared table type is the clustering evidence and TU
membership is not confirmed by adjacency. The table cluster is tied to the
record-tag update run above: `ovl_11_func_800D8FC8` calls `800DA454`, and
`ovl_11_func_800D9064` walks the same 25x45 table applying all three run
members (`800DA49C`, `800DA518`, `800DA454`) to every entry.
Members:
- ovl_11_func_800D8FC8 (m, matched this session, byte-exact) — walks all 25x45
  `D_80071DFC` entries and calls `ovl_11_func_800DA454(entry, arg0 == 0 ?
  0x20 : 0x10)` on each.
- ovl_11_func_800D9064 (m, byte-exact) — walks all 25x45 `D_80071DFC` entries
  and applies the `800DA49C`/`800DA518`/`800DA454` tag-update trio to each.
- ovl_11_func_800DAF60 (m, byte-exact) — bounds-checked pointer into
  `D_80071DFC` (or the `D_80074124` 7x7 table when arg0 != 0).
- ovl_11_func_800D7B24 (m, byte-exact) — initializes every `D_80074124` entry
  (two 0x167 halfwords, two zero bytes, one zero halfword).
- ovl_11_func_800D8320 (m, matched this session, byte-exact) — consumes an
  entry via `ovl_11_func_800DAF60` (tag 0x168/0x16A, `+0x0 == 0x36`,
  `+0x4 != 0`), then dispatches through `D_80123DFC[arg0]`.

## `ovl_11` D_80123DFC two-entry callback-table cluster — 0x80123DFC (confidence: low)

Evidence: `build/ovl_11/asm/data/69960.data.s` emits `D_80123DFC` as a
2-word table of `ovl_11_func_800D759C` / `ovl_11_func_8011E1E8`, and four
container functions reach that table absolutely and call one entry. Both
table entries end `jr $ra; addiu $v0,1` (they return s32); the shared table is
global data rather than a proven TU-private static, so membership stays low
confidence.
Members:
- ovl_11_func_800D8320 (m, matched this session, byte-exact) — record-state
  gate then `D_80123DFC[arg0](arg1, arg2, var_a2)`.
- ovl_11_func_800DACD4 (s) — indexes the same table, keyed by arg2.
- ovl_11_func_800D88D0 (s) — reaches the same table.
- ovl_11_func_800DA638 (s) — reaches the same table.

## `ovl_11` D_8006C838+0x5488 state-trio run — 0x800FA31C–0x800FA410 (confidence: medium)

Evidence: zero-gap link-order adjacency (`ovl_11_func_800FA31C` len 0x84 ends
0x800FA3A0; `ovl_11_func_800FA3A0` len 0x70 ends 0x800FA410) and a shared
state cluster — all three address the `D_80126F8C` table (800FA31C walks it,
800FA410 reads it beside `D_80126F80`) and the latter two take the
`(view *)&D_8006C838` base and read the same `s16` trio at `+0x5488`,
`+0x548A`, `+0x548C`. The nearby caller `ovl_11_func_800FA1CC` calls
`ovl_11_func_800FA31C`, `ovl_11_func_800FA3A0` and the selector wrapper
`ovl_11_func_800FA5C8`, tying the run into one call cluster.

Members (link order):
- ovl_11_func_800FA31C (m, matched this session, byte-exact) — scans all 18
  `D_80126F8C` entries for `u8@+0 == arg1`, calling
  `ovl_11_func_800FA590(arg0, u8@+1, arg2)`.
- ovl_11_func_800FA3A0 (m, matched this session, byte-exact) — guard on
  `D_8006C838+0x5492 != -1` then `+0x5488 == arg1 && +0x548A == arg2`, then
  `ovl_11_func_800FA5C8(arg0, +0x548C, arg3)`.
- ovl_11_func_800FA410 (m, matched this session, byte-exact) — link successor;
  scans the same 18-entry `D_80126F8C` table (`lh` of `s16@+2` on a
  `unk0`/`unk1` match) beside `D_80126F80`, then tests the same `+0x5488`/
  `+0x548A`/`+0x548C` trio; called by `ovl_11_func_800F9E4C`.

## `ovl_11` D_8006C838+0x8000 work-area run — 0x801128B4–0x80112C98 (confidence: medium)

Evidence: link-order adjacency across an unbroken run plus a shared global
cluster. Every member addresses the same work area as `(char *)&D_8006C838
+ 0x8000` and reads/writes halfwords in the narrow window `+0x676C`–`+0x677C`;
matched clean-C members independently demonstrate this addressing mechanism;
801129EC now also matches with explicitly authorized register bindings, which
do not establish its original spelling. The caller edge `ovl_11_func_801129EC ->
ovl_11_func_80112C28` and `ovl_11_func_801129EC -> ovl_11_func_80112C98`
tie the interval together (801129EC issues both `jal`s).

Members (link order; addresses are contiguous 0x801128B4, 0x80112904,
0x801129A0, 0x801129EC, 0x80112A84, 0x80112AB4, 0x80112B60, 0x80112C28,
0x80112C98):
- ovl_11_func_801128B4 (m) — zeros `+0x676C` (0x34 bytes) then `+0x6776 = -1`
  and `func_8001AF70(0x1B, 1)`.
- ovl_11_func_80112904 (m) — writes `+0x6778`, sets the `+0x6776` selector
  from an s16, clears `+0x676C`, copies a packed word from `+0x44B8`.
- ovl_11_func_801129EC (m, 0x98) — when flag 41 is set, reads the signed
  selector at +E778 and forms a stride-1D4 D_80076220 record pointer; passes it
  to 80112C28/80112AB4/80112C98, then calls 80112B60 with D_8007A3F0 when
  flag 4F is set. Uses three user-authorized register bindings; this confirms
  the existing caller/global-cluster link without extending the TU span.
- ovl_11_func_80112A84 (m) — same work area read as `s16*`:
  `p[0x73BB]` = `+0xE776` = base+0x8000+0x6776, indexes `D_80127FD4[5]`.
- ovl_11_func_80112AB4 (m, matched this session, byte-exact) — on
  `func_8001AF44(0x4F) != 1`, saturating increment of `+0x6774` below
  `0x1E`, else on `func_8001AF44(0x4E) == 1` increments `+0x6770`, else on
  `arg0->+0x4 > 0xFDE7` calls `func_8001AF70(0x4E, 1)`. Same
  `(char *)&D_8006C838 + 0x8000` two-stage base spelling as the run.
- ovl_11_func_80112B60 (m, matched this session, byte-exact) — under
  `+0x676E < 0x12D`, three `func_8001AF70(*, 0)` reset calls, increments
  `+0x676E` below `0x12C`, then selects `+0x677C = 2`/`1` and calls
  `func_8001AF70(0x52/0x51, 1)`, else `func_8001AF70(0x50, 1)`. Same
  `(s32)&D_8006C838; base = (unsigned char *)(value + 0x8000)` two-stage base
  spelling as the run.
- ovl_11_func_80112C28 (m, matched this session, byte-exact) — on
  `func_8001AF44(0x4B) == 0` increments `+0x677A`, else clears it; then
  `func_8001AF70(0x4B, 0)` and `func_8001AF70(0x4C, 0)`.
- ovl_11_func_80112C98 (m, matched this session, byte-exact) — guarded by
  `arg0->+0x4 < 0x3A99`; on `func_8001AF44(0x2B) == 0` issues
  `func_8001AF70(0x4D, 1)`/`func_8001AF70(0xAF, 1)`, then increments
  `+0x6772` up to 3. Same `(char *)&D_8006C838 + 0x8000` two-stage base
  spelling as the run.

## `ovl_11` D_80129618/D_8012961C private state pair — 0x800F0E00 / 0x800F0F50 / 0x800F0FB0 / 0x800F19E0 (confidence: medium)

Shared-private-cluster tie in `ovl_11` (`Obj\GF_FARM.bin`) around the adjacent
file-scope `.word` pair `D_80129618` (0x80129618, list count) and `D_8012961C`
(0x8012961C, state code), both emitted as s32 in the overlay's own data blob
(`69960.data.s`, next symbols to each other). Only these four functions
reference either word anywhere in the container, so the cluster is private to
this candidate TU rather than an engine global. The same absolute-addressed
(-G0) overlay, so a shared private global is the data tie. Reinforced by
zero-gap link-order contiguity: `ovl_11_func_800F0E00` (0x150) ends exactly at
0x800F0F50, which (0x60) ends exactly at 0x800F0FB0, which (0x88) ends exactly
at 0x800F1038; `ovl_11_func_800F19E0` reads the same word from the later
gapless 0x800F1878–0x800F1AE0 run. The engine s16 `D_80070CF8` read by
0x800F0FB0 is not a tie — that one is shared across the whole overlay — and
0x800F0FB0's `lw` of it differs from the `lh`/`lhu` the other ovl_11 readers
use, a declaration-width question, not a membership one.

Members (address order):
- ovl_11_func_800F0E00 (s) — resets the 0xE10-byte buffer at `D_8006F5F0`,
  copies arg0's block into it, recounts the `0xFFFF`-terminated u16 list into
  `D_80129618`, then clears `D_8012961C` on every exit path.
- ovl_11_func_800F0F50 (s) — returns 1 early when the `D_8006C838`+0x10 word
  has bit 0x800; otherwise, when `D_8012961C` is set, calls
  `ovl_11_func_800F1078(record+0x2DB8, D_80129618)`, then clears
  `D_8012961C` and returns 1.
- ovl_11_func_800F0FB0 (m, matched this session, 0x88, byte-exact first try)
  — state setter: stores arg0 into `D_8012961C` when it is 1 or
  `func_8001AF44(2) == 0`; then, when the engine `D_80070CF8 == 6` and
  `ovl_11_func_800C0A28() != 0` and `D_8012961C != 8`, clears the state word.
- ovl_11_func_800F19E0 (s) — state-code dispatcher: when arg0 equals
  `D_8012961C` and arg0 is in 2..8, jumps through `jtbl_800B9F68`; the
  0..1 and out-of-range paths return 1/0.

## `ovl_11` D_800A0728 ObjectState reset/handoff run — 0x800F6F7C / 0x800F7010 / 0x800F8A3C (confidence: medium)

Shared-cluster plus shared-idiom tie in `ovl_11` (`Obj\GF_FARM.bin`). Each
member is a thin wrapper around the engine's cached object state at
`D_800A0728`: it calls `func_80015840(&D_800A0728, id)`, then
`func_8001585C(&D_800A0728, sub)`, then hands the object to the state-message
dispatcher with its two bytes at +0x4/+0x5 as the middle arguments. Members
differ only in the reset constants, the message callee (`func_80015F80` vs
`func_80015EE8`), and the trailing arguments. The object is addressed
absolutely (extern-only, `-G0`/`lui+%lo`), and zero-gap link-order contiguity
ties the first two: `ovl_11_func_800F6F7C` (0x94) ends exactly at 0x800F7010,
where `ovl_11_func_800F7010` begins. The preceding `ovl_11_func_800F6F40` ends
exactly at 0x800F6F7C but shares no `D_800A0728` reference, so it is an
adjacency boundary only, not a member. `ovl_11_func_800F8A3C` joins by the
same shared object and the identical three-call idiom (run twice in one body),
not by adjacency.

Members (address order):
- ovl_11_func_800F6F7C (m, matched this session, byte-exact) — reset
  `func_80015840(&D_800A0728, 0xB)` / `func_8001585C(&D_800A0728, 0)`, then
  `func_80015F80(arg0, &D_800A0728, u8@+4, u8@+5, arg1, arg2, 0x1000, 0, 0)`.
- ovl_11_func_800F7010 (m, already matched) — reset
  `func_80015840(&D_800A0728, 11)` / `func_8001585C(&D_800A0728, 2)`, then
  `func_80015EE8(arg0, &D_800A0728, u8@+4, u8@+5, arg1, arg2)`.
- ovl_11_func_800F8A3C (m, matched this session, byte-exact) — the same
  reset/handoff sequence run twice (ids 0xD then 0xC, message args 0x7D/0x90
  then 0x115/0x90, sub id from `D_80126E50`), then cycles `D_80126E52` and
  wraps `D_80126E50` modulo 4.

## `ovl_11` D_80124A18 range-entry accessor band — 0x800EFABC–0x800EFF9C (confidence: medium)

Shared-global cluster plus zero-gap link-order contiguity in `ovl_11`
(`Obj\GF_FARM.bin`). Every member dereferences the same absolute-addressed
`D_80124A18` table of 0x14-byte records (`Ovl11RangeEntry`,
`include/globals_override.h`), whose type was completed this session with the
low fields: `u8 *field_0` (data), `u8 field_4` (tag), `s16 field_6` (stride
count) at +0x00/+0x04/+0x06, alongside the already-recorded s16@+0x08,
s32@+0x0C and s32@+0x10. The run is link-order contiguous with no unrelated
code between members: `ovl_11_func_800EFABC` (0x1AC) ends exactly at
0x800EFC68, which (0xEC) ends exactly at 0x800EFD54, and the chain continues
through 0x800EFDA0 (0x94), 0x800EFE34 (0xD0), 0x800EFF04 (0x98) and
0x800EFF9C (0x90). Call graph agrees: `ovl_11_func_800EFABC` calls both
0x800EFF04 and 0x800EFD54; `ovl_11_func_800EFC68` calls 0x800EFF04.

Members (address order):
- ovl_11_func_800EFABC (s) — resolves a record via 0x800EFF04, then combines
  its value with `s32@+0x10` (OR when arg1 set, clear otherwise), or falls
  back to 0x800EFE34 then clamps with 0x800EFD54.
- ovl_11_func_800EFC68 (s) — resolves a record via 0x800EFF04 and switches on
  the returned tag (0..5, `jtbl_800B9EE8`), gated by `s32@+0x10`.
- ovl_11_func_800EFD54 (m) — clamps an s32 into `[s16@+0x08, s32@+0x0C]` of
  the record.
- ovl_11_func_800EFF04 (m, matched this session, byte-exact) — returns
  `field_0` advanced by `field_6 * arg1` (or plain `field_0` when the count is
  zero), writes `field_4` to `*arg2`, and spins on `func_800129E8` while the
  result is null.
- ovl_11_func_800EFDA0 (s) / ovl_11_func_800EFE34 (s) / ovl_11_func_800EFF9C (s)
  — link-order neighbours of the run; 0x800EFE34 is called by 0x800EFABC.

## `ovl_15` D_80137828 buffer-pointer cluster — 0x8012E15C / 0x8012FAE0 / 0x80137300 (confidence: medium)

Evidence: one shared absolute global pointer. The overlay initialiser
`ovl_15_func_8012E15C` stores `D_80137828 = (u8 *)D_8007BFF8` (`lui/addiu`
of `D_8007BFF8` then `sw $v0,%lo(D_80137828)`), and `ovl_15_func_8012FAE0`
(three `lw`) and `ovl_15_func_80137300` (one `lw`) read the pointer back as a
buffer base. The three are not link-adjacent (0x8012E15C, 0x8012FAE0,
0x80137300), so the tie is the shared global, the same pattern as the
`D_801376D0`/`D_80137AB0` run above. `D_80137828` sits immediately above the
short array `D_80137820`, which the same initialiser clears.

Members (address order):
- ovl_15_func_8012E15C (s) — overlay initialiser: sets
  `D_80137828 = (u8 *)D_8007BFF8`, clears adjacent `D_80137820` and the
  `D_80137584`–`D_8013759A` state words, memsets several buffers, then calls
  `ovl_15_func_8013468C`.
- ovl_15_func_8012FAE0 (s) — reads `D_80137828` as a buffer base.
- ovl_15_func_80137300 (m, verified byte-exact this session) — `DrawSync(0)`,
  `ClearOTagR(D_8005E3C0->field_120, 0x800)`, then polls
  `func_80014CBC(0x10, 0, 0x900, D_80137828, 1, 0)` until non-zero and returns
  it — a CD/streamed-load completion loop.

## `ovl_11` D_8007AF80 interpolation-state pair — 0x800BFF74–0x800C0010 (confidence: medium)

Evidence: one shared absolute-addressed global `D_8007AF80`, declared
`extern u8 D_8007AF80[]` in both TUs (it is absent from `include/globals.h`),
and indexed as an `s32` array with the same layout in both: p[0..2] a
3-vector, p[3..5] its per-tick delta, p[6] an elapsed counter, p[7] the
count/target limit. Zero-gap link-order contiguity corroborates the tie:
ovl_11_func_800BFF74 is 0x9C and ends exactly at 0x800C0010 where
ovl_11_func_800C0010 begins, and the call graph agrees (0x800BFE3C calls
0x800C0010; 0x800BFEA4 sits 0x58 before the pair in link order).

Members (address order):
- ovl_11_func_800BFF74 (m, matched this session, byte-exact) — per-tick
  stepper: if p[0]+p[1]+p[2] != 0 it calls `func_8001316C(p[0], p[1], p[2])`,
  then while the counter p[6] is below the limit p[7] increments p[6] and
  adds the delta p[3..5] to the vector p[0..2].
- ovl_11_func_800C0010 (m, already matched) — initialiser for the same state:
  sets p[6] = 0, p[7] = arg0 and p[3..5] = (v[i] - p[i]) / arg0 for target
  vector `v`, returning p[5].

## `ovl_11` D_801285xx table-lookup run — 0x8011F9EC–0x80120358 (confidence: medium)

Evidence: three functions in one contiguous 0x8011F9EC–0x80120358 link run
read the same absolute-addressed s16 table region (`D_80128550`/`D_80128554`/
`D_8012855C`/`D_80128580`; `D_801285F4` sits 0x74 on from `D_80128580`, then
`D_8012862C`) and all call the exe selector `func_80012A34`. The data symbols
are private to this run — `D_80128550`/`D_80128554`/`D_8012855C`/`D_80128580`
have no reference outside 0x8011F9EC/0x8011FB80, and `D_801285F4`/
`D_8012862C` only in 0x80120358 — so the shared region is a same-TU data
cluster rather than a cross-group object. Link order is contiguous from
0x8011F9EC through unmatched 0x8011FD2C–0x8011FFA8 (0x8011FFA8 also calls
`func_80012A34`) to the new match at 0x80120358, so adjacency and call graph
agree on the run.

Members (address order):
- ovl_11_func_8011F9EC (s) — scans two 6-entry s16 tables at `D_80071A70`
  (stride 2, -1 sentinel) and reads `D_80128550`/`D_8012855C`/`D_80128580`;
  calls `func_80012A34(2)`.
- ovl_11_func_8011FB80 (s) — maps an s16 argument through the `D_80128580`
  table indexed via `D_80128554`/`D_8012855C`, special-casing values 3/4;
  calls `func_80012A34(2)`.
- ovl_11_func_80120358 (m, verified byte-exact this session) — 4-entry
  0xE-stride min/max range scan at `D_801285F4`: on a hit stores
  `func_80012A34(D_8012862C[obj->+8]) + 5` and returns the entry's s16 value,
  else 0.

---

## `ovl_11` 0x800CCC5C–0x800CCFF8 gapless caller run — 0x800CCC5C / 0x800CCCC0 / 0x800CCF14 / 0x800CCF58 / 0x800CCFF8 (confidence: low)

Unbroken link-order run in `ovl_11` (`Obj\GF_FARM.bin`): 0x800CCC5C (0x64) →
0x800CCCC0 (0x254) → 0x800CCF14 (0x44) → 0x800CCF58 (0xA0) → 0x800CCFF8
(0x74) → 0x800CD08C, each starting exactly where the previous ends
(`configs/splat/ovl_11.yaml`). The three middle functions are already
documented members of unrelated candidate clusters (the D_80071A00 pool, the
`/60` clamp-pair caller set, the scattered D_8006C858 siblings), so this
adjacency is the only tie among them and stays low confidence; a matched
member filling the run is new.

Members (address order):
- ovl_11_func_800CCC5C (m) — D_80071A00 pool leaf copy/mirror (see that entry)
- ovl_11_func_800CCCC0 (s) — caller of the `/60` clamp-scaled leaf pair
- ovl_11_func_800CCF14 (m, verified byte-exact this session) — clamp-guarded
  clear: `ovl_11_func_800D72E8(arg0, -1)` on the 3-halfword vector at +0; when
  it reports zero, clears the matching D_800A0494 row record via
  `ovl_11_func_800D666C` and zeroes the vector via `ovl_11_func_800D7328` —
  a single call site coupling the 3-halfword vector family (0x800D72E8 run)
  to the D_800A0494 row-table clear
- ovl_11_func_800CCF58 (s) — scattered D_8006C858 sibling
- ovl_11_func_800CCFF8 (m) — func_80015704 two-argument caller set

---

## `ovl_11` D_80123E54/D_80123E56 state-pair run — 0x800DDB64 / 0x800DDBA0 (confidence: medium)

Candidate same-TU pair of `ovl_11` (`Obj\GF_FARM.bin`): two adjacent functions
that both drive the same s16 state pair and hand the result to the same
packet writer.

Fingerprints:
- **gapless link-order adjacency**: `configs/splat/ovl_11.yaml` lists
  0x800DDB64 (0x3C) then 0x800DDBA0 (0xC4), the second starting exactly where
  the first ends. The pair also sits directly after the documented
  D_80129194–D_801291A0 mirror-pair run that terminates at 0x800DDB64.
- **shared global cluster**: `D_80123E54` (s16, mode/flag) and `D_80123E56`
  (s16, index) are touched by both members and by no other matched source in
  the container (grep over `src/`). Both correct them as `s16`; both are
  `extern` here (absolute `lui`+`%lo`, never gp-relative), so the defining TU
  is elsewhere.
- **shared callee / idiom**: both members call `ovl_11_func_800DC114`
  (the 0x19/0x1A/0x1B two-record packet write) as the last effect before
  updating the pair; `ovl_11_func_800DDBA0` additionally interpolates through
  `func_8001F278` into a 3-word stack buffer, the same engine call shape as
  `ovl_11_func_80111D94`.

Members (address order):
- ovl_11_func_800DDB64 (m) — initializer: zeroes `D_80123E54`, sets
  `D_80123E56 = 0x1FF`, then calls `ovl_11_func_800DC114(0, 0xA5, 0xD5)`.
- ovl_11_func_800DDBA0 (m, verified byte-exact this session) — cyclic
  updater: interpolates `D_80123E56` through `func_8001F278` and writes the
  three results via `ovl_11_func_800DC114`, then increments (clamp to 0x1FF
  with `D_80123E54 = 1`) or decrements (underflow to 0 with `D_80123E54 = 0`)
  the pair.


## ovl_11 D_8006C838+44D2 status readers (confidence: low)

- ovl_11_func_800D0BC8 (m): checks u16 fields at 44D0/44D2 for selectors
  1/3, then reads the signed halfword at 99C8 + selector * 4.
- ovl_11_func_800D0CD8 (m): the same 44D2 field selects a five- versus
  ten-record scan at 7AB4, stride B4.

The shared typed field and nearby addresses support a data-access link, not a
proved translation-unit boundary. Original calls from D0F20 and F4618 to D0BC8
establish clients only. D0BC8 is now byte-exact using independent global member
expressions; no per-file flag inference follows from this reconstruction.


## ovl_11 D_8006C838+99D2 s16 lookup consumers (confidence: low)

- ovl_11_func_800F4618 (m, byte-exact this session): loops i=2..3 reading the
  s16 at D_8006C838+0x99D2+(i-2)*4, gates each on `!= 1` (else 0), and calls
  ovl_11_func_800F501C(i-2, ovl_11_func_800D0BC8(i)==1, value).
- ovl_11_func_800D09E0 (s): its `arg0 != 1` branch forms the same base
  D_8006C838+0x99D2 and reads `lh 0(s2)` inside an i=2..3 stride-4 scan.

Shared global address and loop/lookup idiom within one container (verified
target words); a data-access/idiom link, not a proved TU boundary.


## ovl_11 8010E644 / 80111030 lookup caller link (confidence: low)

- ovl_11_func_8010E644 (s): original jal at 8010E650 calls 80111030.
- ovl_11_func_80111030 (m): selectors 8/9/10 choose u16 fields AE/B0/B2,
  then a signed /52 quotient indexes the s16 lookup at D_8006C838+99DA;
  returns twice that value, or 24 for another selector.

The explicit call is a dependency, not evidence of shared TU membership.
80111030 is now byte-exact with a directly indexed global member; this also
refutes the older unqualified scheduling-impossibility claim while preserving
its actual frozen-byte-pointer search bounds. No flag change was required.


## ovl_11 E3DC8 / E5524 byte-decoder caller link (confidence: low)

- ovl_11_func_800E3DC8 (s): original jal at 800E401C calls E5524.
- ovl_11_func_800E5524 (m): input byte zero supplies a delimiter; each of
  arg2 encoded records emits either one byte or a repeated-byte/count packet.
  The ordinary outer for-loop and inner countdown are byte-exact under the
  baseline flags, with no register pins or flag override.

This records the independently observed client dependency, not a new TU
boundary. The allocation-only parked residual disappeared when the outer
count was expressed as a natural for-continuation instead of a manual
branch-specific next-count variable.

## ovl_11 D6730 / D678C / D67F4 nine-slot checks (confidence: low)

- ovl_11_func_800D6730 (m) scans nine halfwords in a selected row of
  D_800A0494 and assigns the first zero slot.
- ovl_11_func_800D678C (m) scans nine 0x1E-byte D_800A04B8 records in a
  selected row and checks the signed halfword at +0x18 against -1 / 0x3F0.
- ovl_11_func_800D67F4 (m) scans that same nine-record row for each of eight
  categories i*8, checking the first halfword and +0x18 against 0x3F0.
  It is byte-exact as plain C with no register binding or flag change.

The original functions are adjacent and use nine-slot rows; the shared
D_800A04B8 layout links D678C and D67F4 directly. D6730 accesses a different
parallel table, so this is a helper/layout cluster, not proof of a shared TU.


## ovl_11 padded-vector view consumers (confidence: low)

The original words of 800E1770 and 8010BC54 share the same two calls,
D0408 then D05D0, vector-component additions from object +38/+3C/+40,
and final selector copy from D_8006C838+5200 to object +22. Matched DFB98
uses the same body after its predicate guard. Their call setup passes a
four-word aggregate, with D05D0 consuming only its first three components;
shared Ovl11PaddedVec3 leaves the remaining bytes explicitly unused. This
corroborates an operation/layout family, not a common TU across distant bands.
- ovl_11_func_800E1770 (m, 0x94) — component addition and selector copy;
  full-finalized with one user-authorized selector register binding.
- ovl_11_func_8010BC54 (m, 0x94) — verified original-word twin in the
  documented third far-state gate run; transferred the same audited interface
  and user-authorized selector binding.
- ovl_11_func_800DFB98 (m, 0xA4) — predicate-guarded sibling.
- ovl_11_func_800D05D0 (m, 0x30) — writes components to +58/+5C/+60 and
  updates flag word +34; shared padded interface preserves all original words.


## ovl_11 numeric-row display helper (confidence: low; dependency only)

Original ovl_11_func_800F787C calls 800F8B4C at 800F79B8. The helper
formats D_80126E4A+1 and a signed argument divided by eight into the shared
12-halfword D_80129FD8 scratch buffer, adds FFFF terminators and displays
those strings at x=28/42, y=6E, with a table-selected separator at x=35.
The direct caller edge corroborates a rendering dependency, not a source-file
boundary or a common TU across the intervening link addresses.
- ovl_11_func_800F787C (s) — recorded original caller.
- ovl_11_func_800F8B4C (m, 0xD0) — finalized numeric/separator row helper;
  four inline address/setup instructions and scoped register bindings are
  explicitly user-authorized matching workarounds, not original-TU evidence.
- ovl_11_func_800F8C1C (m, matched this session, byte-exact, 0xDC) — the
  same caller's panel/string sibling: zero-gap link successor of 800F8B4C
  (0x800F8B4C + 0xD0 = 0x800F8C1C) and called immediately before it by
  0x800F787C (jal 800F8C1C at 0x800F79AC, jal 800F8B4C at 0x800F79B8) on the
  same live object (`D_8005E3C0->field_D8 + 0x64` is 800F8C1C's arg1 and
  800F8B4C's arg0), and it draws through the same text helper func_80017B3C
  (plus three func_80022580 boxes). Membership rests on zero-gap adjacency
  plus the shared caller/callee, not on a shared overlay global (low). It
  calls ovl_11_func_800F8A3C but reads no D_800A0728, so it is not a member
  of that object's reset/handoff group above.


## ovl_11 D_8012D110 state-buffer initializer/consumer family (confidence: low)

Storage/dependency evidence, not an original-TU claim: the initializer and
two independently matched readers use the same absolute state buffer.

- ovl_11_func_80112D10 (m, finalized, 0x98) — clears ten bytes at +0xC,
  the 10x10x10 byte grid at +0x16, the initial halfword and word at +0x400.
  Original callers: 800BCD28 at 800BCEA8, 801044E4 at 8010468C, and
  80113818 at 80113954. The shared 801044E4 caller also runs the nearby
  8010476C/801047FC resetters, but this distant address is not in their
  gapless link-order pair.
- ovl_11_func_80113B80 (m) — reads +8/+A coordinates, updates work-area
  positions when func_8001AF44(0x44) succeeds, and conditionally calls
  80113C3C.
- ovl_11_func_80113C3C (m) — guarded by the buffer's initial halfword;
  transforms the same +8/+A coordinates into far work-area fields and
  copies them into buffer +4/+6.

The first-halfword initializer/guard tie and common coordinate consumers
support one state family; they do not prove shared translation-unit ownership.


## ovl_11 D_80127328 six-entry masked helper-dispatch family (confidence: low)

- ovl_11_func_800FC8C8 (m, finalized, 0xD0) — scans six 8-byte entries
  of D_80127328. Each entry's word mask is tested against work-area +0x44F8;
  enabled entries pass their +4 byte to matched func_80015EE8 with the
  D_8005E3C0->field_D8+0x68 context and D_8012CE88 buffer. The last two
  helper arguments start at 0x8C/0xC0; the former advances only for enabled
  entries via a high-half running value.
- Original 800FC358 calls this helper at 800FC4DC. This is a corroborated
  caller/dispatch dependency, not proof of shared TU ownership.

The table stride, mask word and index byte establish a shared record layout.
The single S6 matching constraint in the recovered source is a user-authorized
workaround, not evidence of the original author's register declarations.


## `ovl_11` s16 range-map / store-view run — 0x8011DD48–0x8011DF4C (confidence: high)

Zero-gap link-order run of six `ovl_11` functions, no unrelated code between
them: 8011DD48 (0x48) → 8011DD90 (0xE0) → 8011DE70 (0x4C) → 8011DEBC (0x48)
→ 8011DF04 (0x48) → 8011DF4C. The middle member calls the two that follow it
in link order, and the two nearest share the container's `(x - 1) & 0xFFFF`
gate plus `(x - 1) % 5` range-map idiom. Together with the shared
`D_8006C838` store-view fields this supports one source file.

Fingerprints:
- **direct call edges inside the run:** 8011DD90 calls 8011DEBC and 8011DF04,
  its immediate link-order successors (through the matched 8011DE70);
- **shared range-map idiom:** 8011DD90 and 8011DE70 both gate
  `(u32)((x - 1) & 0xFFFF) < 0x19` and both form `(x - 1) % 5` (DD90 also
  forms `(x - 1) / 5`); 8011DE70 is the same `%5` leaf the run's caller shape
  implies, differing only in its fixed store instead of the +0x524C read;
- **shared store-view layout:** 8011DD90 reads the `D_8006C838` s16 pair at
  +0x524C/+0x5252 and the u16 at +0x5208 indexed by `(x - 1) / 5`; the same
  +0x524C/+0x5252 pair is written by the distant `ovl_11_func_800E8D00`, so
  the view is container-wide rather than run-private.

Members:
- ovl_11_func_8011DD48 (m) — record field setter: writes arg0 +0x0/+0xA,
  conditionally +0x8, and when arg2 == 0 sets +0x4 from
  `D_80054BC0[0] + (s32)&D_8005181A`; adjacency only, no shared idiom.
- ovl_11_func_8011DD90 (m, matched this session, 0xE0, byte-exact) —
  store-view range-map: gates the `D_8006C838` s16 at +0x524C to 1..25,
  derives `/5` and `%5`, maps the +0x5252 selector through 8011DF04, then
  tests the u16 at +0x5208 + 2*((x-1)/5) against 8011DEBC's lookup; returns
  0-5.
- ovl_11_func_8011DE70 (m) — same s16 range gate and `(arg0 - 1) % 5`,
  returning -1 out of range; idiom sibling of 8011DD90's remainder.
- ovl_11_func_8011DEBC (m) — selector lookup: returns
  `D_801282E4[arg0]` when `(arg1 << 0x10) == 0`, else `D_801282F0[arg0]`.
- ovl_11_func_8011DF04 (m) — s32 selector map: 0x7A→3, 0x7B→2, 0x7C→1,
  0x60→4, else 0.
- ovl_11_func_8011DF4C (s) — run tail, stub.

---

## `ovl_11` keyframe-state handler triple — 0x800E0028 / 0x800E00E0 / 0x800E0180 (confidence: high)

Three zero-gap link-order neighbours with byte-for-byte identical structure,
differing only in the table pointer each passes to the shared callee. The
splat map has 0x800E0028 (0xB8) ending exactly at 0x800E00E0 (0xA0), which ends
exactly at 0x800E0180 (0xA0); a gap follows to 0x800E0280.

Fingerprints:
- **identical state-switch idiom:** each loads `lh` s16@+0x28, does
  `beqz`(0) / `bgtz` / `beq`(−1), and uses the same `case 1: default:` decision
  tree; state 0 stores +0x28 = 1, state −1 sets the loop variable 1 and clears
  flag `0x800` at s32@+0x34, and every other value passes
  `(&obj->+0x2A)` as the call's stack argument;
- **shared direct callee:** all three call `ovl_11_func_800D04D4`
  (already grouped as the keyframe/frame-step helper) with the same argument
  shape `(obj, table, &obj->+0x28, -1, &obj->+0x2A)`;
- **adjacent table cluster:** each passes a distinct adjacent table —
  800E0028 → `D_80123F3C`, 800E00E0 → `D_80123F48`, 800E0180 →
  `D_80123F50` — consecutive entries in `build/ovl_11/asm/data/69960.data.s`
  (0x80123F3C / 0x80123F48 / 0x80123F50);
- **shared state-object view:** the `{s16@0x28, s16@0x2A, s32@0x34}` view is
  the same object whose `+0x28/+0x2A/+0x2C` are zeroed by
  `ovl_11_func_800D3104`, tying the triple to the state-dispatch machine.

Members (address order):
- ovl_11_func_800E0028 (m, byte-exact) — start handler: state 0 sets +0x28 = 1 *and* sets
  flag 0x800 at +0x34; state −1 sets +0x2C = 0x12C and clears the flag; else
  steps table `D_80123F3C`.
- ovl_11_func_800E00E0 (m, matched this session) — clear handler: state 0 sets
  +0x28 = 1; state −1 clears flag 0x800 at +0x34; else steps table
  `D_80123F48`.
- ovl_11_func_800E0180 (m) — third twin of the same shape; else steps table
  `D_80123F50`.

Fourth family member, link-order-distant (confidence: medium).
`ovl_11_func_800E1CA8` (0x800E1CA8, ~0x1C00 bytes later, link-adjacent to the
`D_800B966C` dispatch handlers 800E1BF0/800E1D48) carries the byte-identical
state-switch idiom and the same
`ovl_11_func_800D04D4(obj, table, &obj->+0x28, -1, &obj->+0x2A)` call shape as
the triple, and its table `D_80124000` is content-identical to 800E00E0's
`D_80123F48` (`0x00000003, 0x0000FFFF`) and sits in the same
`69960.data.s` handler-table cluster (0x80123F3C–0x80124000). Same authored
family, but the basis is the shared idiom and table cluster, not link adjacency.
- ovl_11_func_800E1CA8 (m, matched this session, byte-exact) — family state
  handler: state 0 sets +0x28 = 1; state −1 sets the loop variable 1 and clears
  flag 0x800 at s32@+0x34; else steps table `D_80124000`.

Fifth family member, link-order-distant (confidence: medium).
`ovl_11_func_800D4624` (0x800D4624, ~0xBA00 bytes earlier in the same overlay)
carries the identical state-switch idiom (`beqz`(0) / `bgtz` / `beq`(−1) and
`case 1: default:`) and the same
`ovl_11_func_800D04D4(obj, table, &obj->+0x28, -1, &obj->+0x2A)` call shape; its
table `D_80123BF8` (`0x00050004, 0x002D0005, 0x00050006, 0x0000FFFF`) sits in
the same `69960.data.s` handler-table region. Same authored family, but the
basis is the shared idiom and table cluster, not link adjacency.
- ovl_11_func_800D4624 (m, matched this session, byte-exact) — family state
  handler: state 0 sets +0x28 = 1 *and* sets flag 0x800 at s32@+0x34;
  state −1 calls `ovl_11_func_800D3200(obj)` and returns 1; else steps table
  `D_80123BF8`.

Sixth family member, link-order-distant (confidence: medium).
`ovl_11_func_800DFCFC` (0x800DFCFC, ~0x5D00 bytes after 0x800D4624) carries the
identical state-switch idiom (`beqz`(0) / `bgtz` / `beq`(−1) and
`case 1: default:`) and the same
`ovl_11_func_800D04D4(obj, table, &obj->+0x28, -1, &obj->+0x2A)` call shape; its
table `D_80123F08` (`0x000A0000, 0x000A0005, 0x00000002, 0x0000FFFF`) sits in
the same `69960.data.s` handler-table region (immediately before
`D_80123F00`). Same authored family, but the basis is the shared idiom and
table cluster, not link adjacency.
- ovl_11_func_800DFCFC (m, matched this session, byte-exact) — family state
  handler: state 0 sets +0x28 = 1 *and* sets flag 0x800 at s32@+0x34; state −1
  sets the loop variable 1 and clears flag 0x800 at s32@+0x34; else steps table
  `D_80123F08`.

Seventh family member, link-order-distant (confidence: medium).
`ovl_11_func_800E18C4` (0x800E18C4) carries the identical state-switch idiom
(`beqz`(0) / `bgtz` / `beq`(−1) and `case 1: default:`) and the same
`ovl_11_func_800D04D4(obj, table, &obj->+0x28, -1, &obj->+0x2A)` call shape; its
table `D_80123FC0` (`0x000A0000, 0x000A0005, 0x00000002, 0x0000FFFF`) is
content-identical to 800DFCFC's `D_80123F08` and sits in the same
`69960.data.s` handler-table region. The same function is also a member of the
`D_800B966C` ovl_11 function-pointer table documented above, so this membership
has both the idiom/table-cluster basis and named table membership.
- ovl_11_func_800E18C4 (m, matched this session, byte-exact) — family state
  handler: state 0 sets +0x28 = 1 *and* sets flag 0x800 at s32@+0x34; state −1
  sets the loop variable 1 and clears flag 0x800 at s32@+0x34; else steps table
  `D_80123FC0`.

Eighth family member, link-order-distant (confidence: medium).
`ovl_11_func_80109F7C` (0x80109F7C, ~0x28000 bytes after 0x800E18C4) carries the
identical state-switch idiom (`beqz`(0) / `bgtz` / `beq`(−1) and
`case 1: default:`) and the same
`ovl_11_func_800D04D4(obj, table, &obj->+0x28, -1, &obj->+0x2A)` call shape; its
table `D_80127A80` (`0x000A0000, 0x000A0007, 0x00000002, 0x0000FFFF`) differs
from 800DFCFC's `D_80123F08` / 800E18C4's `D_80123FC0`
(`0x000A0000, 0x000A0005, …`) only in the second word and sits in the separate
0x80127Axx 4-word handler-table band of `69960.data.s` (neighbour of the
`D_80127A78` `{0x001E0000, 0x0000FFFF}` table), so the basis is the shared idiom
and table shape, not the 0x80123xxx cluster.
- ovl_11_func_80109F7C (m, matched this session, byte-exact) — family state
  handler: state 0 sets +0x28 = 1 *and* sets flag 0x800 at s32@+0x34; state −1
  sets the loop variable 1 and clears flag 0x800 at s32@+0x34; else steps table
  `D_80127A80`.

Ninth family member, link-order-distant (confidence: medium).
`ovl_11_func_8010BE24` (0x8010BE24) is the byte-structural twin of its
link-order neighbour `ovl_11_func_800E18C4` (identical state-switch idiom and
identical `ovl_11_func_800D04D4(obj, table, &obj->+0x28, -1, &obj->+0x2A)` call
shape; its own words differ only in the table symbol). Its table `D_80127B90`
(`0x000A0000, 0x00000002, 0x0000FFFF`) sits in the same 0x80127Axx–0x80127Bxx
handler-table band of `69960.data.s` as the eighth member's `D_80127A80`
(0x110 bytes apart, between `D_80127B88` and `D_80127B9C`), so the basis is the
shared idiom and table cluster, not link adjacency.
- ovl_11_func_8010BE24 (m, matched this session, byte-exact) — family state
  handler: state 0 sets +0x28 = 1 *and* sets flag 0x800 at s32@+0x34; state −1
  sets the loop variable 1 and clears flag 0x800 at s32@+0x34; else steps table
  `D_80127B90`.

Tenth family member, link-order-adjacent to a named member (confidence: high).
`ovl_11_func_8010E4E4` (0x8010E4E4) is the immediate gapless successor of the
documented `D_800BAABC[2]` handler `ovl_11_func_8010E434` (0x800E434 + 0xB0 =
0x800E4E4; both splat entries are 0xB0, no intervening function) and carries the
byte-identical state-switch idiom (`beqz`(0) / `bgtz` / `beq`(−1) and
`case 1: default:`) and the same
`ovl_11_func_800D04D4(obj, table, &obj->+0x28, -1, &obj->+0x2A)` call shape; its
table `D_80127D68` (`0x000F0003, 0x0000FFFF`) is the next entry in
`build/ovl_11/asm/data/69960.data.s` after 8010E434's `D_80127D5C`
(`0x000F0002, 0x001E000D, 0x0000FFFF`; ends at 0x80127D68), so membership rests
on both code and table adjacency, unlike the link-order-distant members above.
- ovl_11_func_8010E4E4 (m, matched this session, byte-exact) — family state
  handler: state 0 sets +0x28 = 1 *and* sets flag 0x800 at s32@+0x34; state −1
  sets the loop variable 1 and clears flag 0x800 at s32@+0x34; else steps table
  `D_80127D68`.

Eleventh family member, link-order-adjacent to the tenth (confidence: high).
`ovl_11_func_8010E594` (0x8010E594) is the immediate gapless successor of
`ovl_11_func_8010E4E4` (0x8010E4E4 + 0xB0 = 0x8010E594; both splat entries are
0xB0) and carries the byte-identical state-switch idiom (`beqz`(0) / `bgtz` /
`beq`(−1) and `case 1: default:`) and the same
`ovl_11_func_800D04D4(obj, table, &obj->+0x28, -1, &obj->+0x2A)` call shape; its
table `D_80127D70` (`0x000F000C, 0x0000FFFF`) is the next entry in
`build/ovl_11/asm/data/69960.data.s` after 8010E4E4's `D_80127D68` (ends at
0x80127D70), so membership rests on both code and table adjacency.
- ovl_11_func_8010E594 (m, matched this session, byte-exact) — family state
  handler: state 0 sets +0x28 = 1 *and* sets flag 0x800 at s32@+0x34; state −1
  sets the loop variable 1 and clears flag 0x800 at s32@+0x34; else steps table
  `D_80127D70`.

Twelfth family member, link-order-distant (confidence: medium).
`ovl_11_func_800D41A4` (0x800D41A4) carries the byte-identical state-switch
idiom (`beqz`(0) / `bgtz` / `beq`(−1) and `case 1: default:`) and the same
`ovl_11_func_800D04D4(obj, table, &obj->+0x28, -1, &obj->+0x2A)` call shape; its
table `D_80123BCC` (`0x001E0000, 0x0000FFFF`) sits in the 0x80123xxx
handler-table region of `69960.data.s` (between `D_80123BD4` and `D_80123BF8`)
and is content-identical to 80109F7C's neighbour `D_80127A78`, so the basis is
the shared idiom and table shape, not link adjacency.
- ovl_11_func_800D41A4 (m, matched this session, byte-exact) — family state
  handler: state 0 sets +0x28 = 1 *and* sets flag 0x800 at s32@+0x34; state −1
  sets the loop variable 1, sets +0x2C = 0x12C, and clears flag 0x800 at
  s32@+0x34; else steps table `D_80123BCC`.

Thirteenth family member, link-order-adjacent to the fifth (confidence: high).
`ovl_11_func_800D46CC` (0x800D46CC) is the immediate gapless successor of
`ovl_11_func_800D4624` (0x800D4624 + 0xA8 = 0x800D46CC; both splat entries are
terminated by no intervening function) and carries the byte-identical
state-switch idiom (`beqz`(0) / `bgtz` / `beq`(−1) and `case 1: default:`) and
the same `ovl_11_func_800D04D4(obj, table, &obj->+0x28, -1, &obj->+0x2A)` call
shape; its table `D_80123C08` (`0x00780007, 0x000F0000, 0x0000FFFF`) is the next
entry in `build/ovl_11/asm/data/69960.data.s` immediately after 800D4624's
`D_80123BF8` (`0x00050004, 0x002D0005, 0x00050006, 0x0000FFFF`; ends at
0x80123C08), so membership rests on both code and table adjacency.
- ovl_11_func_800D46CC (m, matched this session, byte-exact) — family state
  handler: state 0 sets +0x28 = 1 *and* sets flag 0x800 at s32@+0x34; state −1
  sets the loop variable 1, sets +0x2C = 0x12C, and clears flag 0x800 at
  s32@+0x34; else steps table `D_80123C08`.

Fourteenth family member, link-order-adjacent to the thirteenth (confidence:
high). `ovl_11_func_800D4784` (0x800D4784) is the immediate gapless successor
of `ovl_11_func_800D46CC` (0x800D46CC + 0xB8 = 0x800D4784; both splat entries
are 0xB8) and carries the byte-identical state-switch idiom (`beqz`(0) /
`bgtz` / `beq`(−1) and `case 1: default:`) and the same
`ovl_11_func_800D04D4(obj, table, &obj->+0x28, -1, &obj->+0x2A)` call shape; its
table `D_80123C14` (`0x003C0008, 0x000F0000, 0x0000FFFF`) is the next entry in
`build/ovl_11/asm/data/69960.data.s` immediately after 800D46CC's
`D_80123C08` (`0x00780007, 0x000F0000, 0x0000FFFF`; ends at 0x80123C14), so
membership rests on both code and table adjacency.
- ovl_11_func_800D4784 (m, matched this session, byte-exact) — family state
  handler: state 0 sets +0x28 = 1 *and* sets flag 0x800 at s32@+0x34; state −1
  sets the loop variable 1, sets +0x2C = 0x12C, and clears flag 0x800 at
  s32@+0x34; else steps table `D_80123C14`.

Fifteenth family member, link-order-adjacent to the fourteenth (confidence:
high). `ovl_11_func_800D483C` (0x800D483C) is the immediate gapless successor
of `ovl_11_func_800D4784` (splat `configs/splat/ovl_11.yaml`: 0x1C964 →
0x1CA1C = 0xB8, and 0x1CA1C + 0xB8 = the next entry 0x800D48F4) and carries the
byte-identical state-switch idiom (`beqz`(0) / `bgtz` / `beq`(−1) and
`case 1: default:`) and the same
`ovl_11_func_800D04D4(obj, table, &obj->+0x28, -1, &obj->+0x2A)` call shape; its
table `D_80123C20` (`0x00780009, 0x000F0000, 0x0000FFFF`) is the next entry in
`build/ovl_11/asm/data/69960.data.s` immediately after 800D4784's `D_80123C14`
(`0x003C0008, 0x000F0000, 0x0000FFFF`; ends at 0x80123C20), so membership rests
on both code and table adjacency.
- ovl_11_func_800D483C (m, matched this session, byte-exact) — family state
  handler: state 0 sets +0x28 = 1 *and* sets flag 0x800 at s32@+0x34; state −1
  sets the loop variable 1, sets +0x2C = 0x12C, and clears flag 0x800 at
  s32@+0x34; else steps table `D_80123C20`.

Sixteenth family member, link-order-adjacent to the fifteenth (confidence:
high). `ovl_11_func_800D48F4` (0x800D48F4) is the immediate gapless successor
of `ovl_11_func_800D483C` (splat `configs/splat/ovl_11.yaml`: 0x1CA1C →
0x1CAD4 = 0xB8, and 0x1CAD4 + 0xB8 = the next entry 0x800D49AC) and carries the
byte-identical state-switch idiom (`beqz`(0) / `bgtz` / `beq`(−1) and
`case 1: default:`) and the same
`ovl_11_func_800D04D4(obj, table, &obj->+0x28, -1, &obj->+0x2A)` call shape; its
table `D_80123C2C` (`0x003C000A, 0x000F0000, 0x0000FFFF`) is the next entry in
`build/ovl_11/asm/data/69960.data.s` immediately after 800D483C's `D_80123C20`
(`0x00780009, 0x000F0000, 0x0000FFFF`; ends at 0x80123C2C), so membership rests
on both code and table adjacency.
- ovl_11_func_800D48F4 (m, matched this session, byte-exact) — family state
  handler: state 0 sets +0x28 = 1 *and* sets flag 0x800 at s32@+0x34; state −1
  sets the loop variable 1, sets +0x2C = 0x12C, and clears flag 0x800 at
  s32@+0x34; else steps table `D_80123C2C`.

Seventeenth family member, link-order-adjacent to the sixteenth (confidence:
high). `ovl_11_func_800D49AC` (0x800D49AC) is the immediate gapless successor
of `ovl_11_func_800D48F4` (splat `configs/splat/ovl_11.yaml`: 0x1CAD4 →
0x1CB8C = 0xB8, and 0x1CB8C + 0xB8 = the next entry) and carries the
byte-identical state-switch idiom (`beqz`(0) / `bgtz` / `beq`(−1) and
`case 1: default:`) and the same
`ovl_11_func_800D04D4(obj, table, &obj->+0x28, -1, &obj->+0x2A)` call shape; its
table `D_80123C38` (`0x0078000B, 0x000F0000, 0x0000FFFF`) is the next entry in
`build/ovl_11/asm/data/69960.data.s` immediately after 800D48F4's `D_80123C2C`
(`0x003C000A, 0x000F0000, 0x0000FFFF`; ends at 0x80123C38), so membership rests
on both code and table adjacency.
- ovl_11_func_800D49AC (m, matched this session, byte-exact) — family state
  handler: state 0 sets +0x28 = 1 *and* sets flag 0x800 at s32@+0x34; state −1
  sets the loop variable 1, sets +0x2C = 0x12C, and clears flag 0x800 at
  s32@+0x34; else steps table `D_80123C38`.

Eighteenth family member, link-order-adjacent to the seventeenth (confidence:
high). `ovl_11_func_800D4A64` (0x800D4A64) is the immediate gapless successor
of `ovl_11_func_800D49AC` (splat `configs/splat/ovl_11.yaml`: 0x1CB8C →
0x1CC44 = 0xB8) and carries the byte-identical state-switch idiom (`beqz`(0) /
`bgtz` / `beq`(−1) and `case 1: default:`) and the same
`ovl_11_func_800D04D4(obj, table, &obj->+0x28, -1, &obj->+0x2A)` call shape; its
table `D_80123C44` (`0x0078000C, 0x000F0000, 0x0000FFFF`) is the next entry in
`build/ovl_11/asm/data/69960.data.s` immediately after 800D49AC's `D_80123C38`
(`0x0078000B, 0x000F0000, 0x0000FFFF`; ends at 0x80123C44), so membership rests
on both code and table adjacency.
- ovl_11_func_800D4A64 (m, matched this session, byte-exact) — family state
  handler: state 0 sets +0x28 = 1 *and* sets flag 0x800 at s32@+0x34; state −1
  sets the loop variable 1, sets +0x2C = 0x12C, and clears flag 0x800 at
  s32@+0x34; else steps table `D_80123C44`.

Nineteenth family member, link-order-distant (confidence: medium).
`ovl_11_func_800D4DE8` (0x800D4DE8) carries the byte-identical state-switch
idiom (`beqz`(0) / `bgtz` / `beq`(−1) and `case 1: default:`) and the same
`ovl_11_func_800D04D4(obj, table, &obj->+0x28, -1, &obj->+0x2A)` call shape; its
table `D_80123C7C` (`0x0078000F, 0x000F0000, 0x0000FFFF`) sits in the same
0x80123Cxx handler-table band of `69960.data.s` as the fifth-to-eighteenth
members and its low word `0x...0F` continues the `0x...0B` / `0x...0C` sequence
of 800D49AC's `D_80123C38` / 800D4A64's `D_80123C44` (with `D_80123C50` /
`D_80123C60` / `D_80123C70` in between), so the basis is the shared idiom and
table cluster; its own gapless link predecessor 0x800D4D1C is now documented as
the forty-fifth member, so code adjacency holds as well.
- ovl_11_func_800D4DE8 (m, matched this session, byte-exact) — family state
  handler: state 0 sets +0x28 = 1 *and* sets flag 0x800 at s32@+0x34; state −1
  sets the loop variable 1, sets +0x2C = 0x12C, and clears flag 0x800 at
  s32@+0x34; else steps table `D_80123C7C`.

Twentieth family member, named-table member and link-order-adjacent to the
sixth (confidence: high). `ovl_11_func_800DFC44` (0x800DFC44) is the immediate
gapless predecessor of the documented sixth member `ovl_11_func_800DFCFC`
(splat `configs/splat/ovl_11.yaml`: 0x27E24 → 0x27EDC = 0xB8), is entry 0 of
the 20-word `D_800B95CC` function-pointer table in
`build/ovl_11/asm/data/1664.rodata.s` (the table documented as holding the
0x800DFC44+ handler run for dispatcher `ovl_11_func_800DF010`), and carries the
byte-identical state-switch idiom (`beqz`(0) / `bgtz` / `beq`(−1) and
`case 1: default:`) and the same
`ovl_11_func_800D04D4(obj, table, &obj->+0x28, -1, &obj->+0x2A)` call shape; its
table `D_80123F00` (`0x001E0000, 0x0000FFFF`) is the entry immediately before
800DFCFC's `D_80123F08` in `build/ovl_11/asm/data/69960.data.s`, so membership
rests on named table membership and both code and table adjacency.
- ovl_11_func_800DFC44 (m, matched this session, byte-exact) — family state
  handler: state 0 sets +0x28 = 1 *and* sets flag 0x800 at s32@+0x34; state −1
  sets the loop variable 1, sets +0x2C = 0x12C, and clears flag 0x800 at
  s32@+0x34; else steps table `D_80123F00`.

Twenty-first family member, link-order-adjacent to the first (confidence:
high). `ovl_11_func_800DFF70` (0x800DFF70) is the immediate gapless predecessor
of the documented first triple member `ovl_11_func_800E0028` (splat
`configs/splat/ovl_11.yaml`: 0x28150 → 0x28208 = 0xB8, and 0x28208 is the
`ovl_11_func_800E0028` entry) and carries the byte-identical state-switch idiom
(`beqz`(0) / `bgtz` / `beq`(−1) and `case 1: default:`) and the same
`ovl_11_func_800D04D4(obj, table, &obj->+0x28, -1, &obj->+0x2A)` call shape; its
table `D_80123F30` (`0x001E0007, 0x00000000, 0x0000FFFF`) is the entry
immediately before 800E0028's `D_80123F3C` in
`build/ovl_11/asm/data/69960.data.s`, so membership rests on both code and
adjacency. Its `case 1: default:` shape is byte-identical to the stub
triple-member 800E0028 (state 0 also sets flag 0x800; state −1 also sets
+0x2C = 0x12C) and to the twelfth member `ovl_11_func_800D41A4`, from which the
family transfer substituted only the table symbol.
- ovl_11_func_800DFF70 (m, matched this session, byte-exact) — family state
  handler: state 0 sets +0x28 = 1 *and* sets flag 0x800 at s32@+0x34; state −1
  sets the loop variable 1, sets +0x2C = 0x12C, and clears flag 0x800 at
  s32@+0x34; else steps table `D_80123F30`.

Twenty-second family member, named-table member and link-order-adjacent to the
seventh (confidence: high). `ovl_11_func_800E180C` (0x800E180C) is the
immediate gapless predecessor of the documented seventh member
`ovl_11_func_800E18C4` (splat `configs/splat/ovl_11.yaml`: 0x299EC →
0x29AA4 = 0xB8, and 0x29AA4 is the `ovl_11_func_800E18C4` entry), is entry 0
of the 20-word `D_800B966C` function-pointer table in
`build/ovl_11/asm/data/1664.rodata.s` (the table documented above as read by
dispatcher `ovl_11_func_800E0B40`), and carries the byte-identical state-switch
idiom (`beqz`(0) / `bgtz` / `beq`(−1) and `case 1: default:`) and the same
`ovl_11_func_800D04D4(obj, table, &obj->+0x28, -1, &obj->+0x2A)` call shape; its
table `D_80123FB8` (`0x001E0000, 0x0000FFFF`) is the entry immediately before
800E18C4's `D_80123FC0` in `build/ovl_11/asm/data/69960.data.s`, so membership
rests on named table membership and both code and table adjacency. Its
`case 1: default:` shape is byte-identical to the thirteenth member
`ovl_11_func_800D46CC` (state 0 also sets flag 0x800; state −1 also sets
+0x2C = 0x12C), from which only the table symbol differs.
- ovl_11_func_800E180C (m, matched this session, byte-exact) — family state
  handler: state 0 sets +0x28 = 1 *and* sets flag 0x800 at s32@+0x34; state −1
  sets the loop variable 1, sets +0x2C = 0x12C, and clears flag 0x800 at
  s32@+0x34; else steps table `D_80123FB8`.

Twenty-third family member, named-table member and link-order-adjacent to both
of its table neighbours (confidence: high). `ovl_11_func_800E1B38` (0x800E1B38)
carries the byte-identical state-switch idiom (`beqz`(0) / `bgtz` / `beq`(−1)
and `case 1: default:`) and the same
`ovl_11_func_800D04D4(obj, table, &obj->+0x28, -1, &obj->+0x2A)` call shape; it
is entry 4 of the same 20-word `D_800B966C` function-pointer table in
`build/ovl_11/asm/data/1664.rodata.s` (the table documented above as read by
dispatcher `ovl_11_func_800E0B40`), and its table `D_80123FE8`
(`0x001E0000, 0x00000000, 0x0000FFFF`) sits in the 0x80123Fxx handler-table band
of `build/ovl_11/asm/data/69960.data.s` (between `D_80123FDC` and
`D_80123FF4`). Splat `configs/splat/ovl_11.yaml` shows it link-adjacent on both
sides to table neighbours `ovl_11_func_800E1A3C` (0x29C1C + 0xFC = 0x29D18) and
`ovl_11_func_800E1BF0` (0x29D18 + 0xB8 = 0x29DD0), so membership rests on named
table membership and link adjacency. Its `case 1: default:` shape is
byte-identical to the twenty-first member `ovl_11_func_800DFF70` (state 0 also
sets flag 0x800; state −1 also sets +0x2C = 0x12C).
- ovl_11_func_800E1B38 (m, matched this session, byte-exact) — family state
  handler: state 0 sets +0x28 = 1 *and* sets flag 0x800 at s32@+0x34; state −1
  sets the loop variable 1, sets +0x2C = 0x12C, and clears flag 0x800 at
  s32@+0x34; else steps table `D_80123FE8`.

Twenty-fourth family member, named-table member and link-order-adjacent on
both sides (confidence: high). `ovl_11_func_800E1BF0` (0x800E1BF0) carries the
byte-identical state-switch idiom (`beqz`(0) / `bgtz` / `beq`(−1) and
`case 1: default:`) and the same
`ovl_11_func_800D04D4(obj, table, &obj->+0x28, -1, &obj->+0x2A)` call shape; it
is entry 5 (repeated at entries 6, 8, 9, 10) of the 20-word `D_800B966C`
function-pointer table in `build/ovl_11/asm/data/1664.rodata.s` (the table
read by dispatcher `ovl_11_func_800E0B40`), and its table `D_80123FF4`
(`0x001E0000, 0x00000000, 0x0000FFFF`, content-identical to 800E1B38's
`D_80123FE8`) is the gapless successor of that table in
`build/ovl_11/asm/data/69960.data.s`. Splat `configs/splat/ovl_11.yaml` shows
it gapless between `ovl_11_func_800E1B38` (0x29D18 + 0xB8 = 0x29DD0) and
`ovl_11_func_800E1CA8` (0x29DD0 + 0xB8 = 0x29E88), so membership rests on named
table membership and code and table adjacency.
- ovl_11_func_800E1BF0 (m, matched this session, byte-exact) — family state
  handler: state 0 sets +0x28 = 1 *and* sets flag 0x800 at s32@+0x34; state −1
  sets the loop variable 1, sets +0x2C = 0x12C, and clears flag 0x800 at
  s32@+0x34; else steps table `D_80123FF4`.

Twenty-fifth family member, link-order-adjacent to a same-idiom successor
(confidence: high). `ovl_11_func_800E2EA0` (0x800E2EA0) carries the
byte-identical state-switch idiom (`beqz`(0) / `bgtz` / `beq`(−1) and
`case 1: default:`) and the same
`ovl_11_func_800D04D4(obj, table, &obj->+0x28, -1, &obj->+0x2A)` call shape; its
table `D_80124078` (`0x001E0000, 0x0000FFFF`) is content-identical to
800E1B38's `D_80123FE8` / 800E1BF0's `D_80123FF4` and sits in the 0x80124xxx
continuation of the 69960.data.s handler-table band, as the gapless successor
of the `D_80124008` block. Its link predecessor `ovl_11_func_800E2E98`
(0x800E2E98, 8-byte `return 0`) is not a family member, but its gapless
successor `ovl_11_func_800E2F58` (0x800E2EA0 + 0xB8 = 0x800E2F58; splat
`configs/splat/ovl_11.yaml`) carries the same state-switch idiom, so membership
rests on the shared idiom and table shape plus successor adjacency.
- ovl_11_func_800E2EA0 (m, matched this session, byte-exact) — family state
  handler: state 0 sets +0x28 = 1 *and* sets flag 0x800 at s32@+0x34; state −1
  sets the loop variable 1, sets +0x2C = 0x12C, and clears flag 0x800 at
  s32@+0x34; else steps table `D_80124078`.
- ovl_11_func_800E2F58 (m, matched this session, byte-exact) — gapless successor
  of 800E2EA0 in the same family and the same `case 1: default:` state-switch
  idiom, but its default path selects one of the adjacent handler tables
  `D_80124090` (u16@0 == 0x10A) / `D_80124080` (otherwise) as
  `ovl_11_func_800D04D4`'s table argument; state 0 sets +0x28 = 1 and flag
  0x800 at s32@+0x34, state −1 sets the loop variable 1 and clears the flag
  (no +0x2C store).

Twenty-sixth family member, link-order-distant from the documented members
(confidence: medium). `ovl_11_func_800E3464` (0x800E3464) carries the
byte-identical state-switch idiom (`beqz`(0) / `bgtz` / `beq`(−1) and
`case 1: default:`) and the same
`ovl_11_func_800D04D4(obj, table, &obj->+0x28, -1, &obj->+0x2A)` call shape; its
table `D_801240D0` (`0x001E0006, 0x0000FFFF`) sits in the 0x801240xx continuation
of the 69960.data.s handler-table band and is content-shape-identical to the
twenty-fifth member's `D_80124078` (`0x001E0000, 0x0000FFFF`; 0x58 bytes earlier).
Its `case 1: default:` shape is byte-identical to the twelfth member
`ovl_11_func_800D41A4` and the twenty-first member `ovl_11_func_800DFF70`
(state 0 also sets flag 0x800; state −1 also sets +0x2C = 0x12C). Its splat
`configs/splat/ovl_11.yaml` neighbours are the non-member stubs
`ovl_11_func_800E33E8` (gapless predecessor, 0x2B5C8 → 0x2B644 = 0x7C) and
`ovl_11_func_800E351C` (gapless successor, 0x2B644 + 0xB8 = 0x2B6FC), so
membership rests on the shared idiom and table cluster, not link adjacency.
- ovl_11_func_800E3464 (m, matched this session, byte-exact) — family state
  handler: state 0 sets +0x28 = 1 *and* sets flag 0x800 at s32@+0x34; state −1
  sets the loop variable 1, sets +0x2C = 0x12C, and clears flag 0x800 at
  s32@+0x34; else steps table `D_801240D0`.

Twenty-seventh family member, link-order-adjacent to the eighth (confidence:
high). `ovl_11_func_80109EC4` (0x80109EC4) is the immediate gapless predecessor
of the documented eighth member `ovl_11_func_80109F7C` (splat
`configs/splat/ovl_11.yaml`: 0x520A4 → 0x5215C = 0xB8, and 0x5215C is the
`ovl_11_func_80109F7C` entry) and carries the byte-identical state-switch idiom
(`beqz`(0) / `bgtz` / `beq`(−1) and `case 1: default:`) and the same
`ovl_11_func_800D04D4(obj, table, &obj->+0x28, -1, &obj->+0x2A)` call shape; its
table `D_80127A78` (`0x001E0000, 0x0000FFFF`; content-identical to the twelfth
member's `D_80123BCC`) is the entry immediately before
`ovl_11_func_80109F7C`'s `D_80127A80` in `build/ovl_11/asm/data/69960.data.s`,
so membership rests on both code and table adjacency. Its `case 1: default:`
shape is byte-identical to the twelfth member `ovl_11_func_800D41A4` and the
twenty-third `ovl_11_func_800E1B38` (state 0 also sets flag 0x800; state −1 also
sets +0x2C = 0x12C), from which only the table symbol differs.
- ovl_11_func_80109EC4 (m, matched this session, byte-exact) — family state
  handler: state 0 sets +0x28 = 1 *and* sets flag 0x800 at s32@+0x34; state −1
  sets the loop variable 1, sets +0x2C = 0x12C, and clears flag 0x800 at
  s32@+0x34; else steps table `D_80127A78`.

Twenty-eighth family member, link-order-adjacent to the eighth and to an
undocumented same-idiom successor (confidence: high).
`ovl_11_func_8010A02C` (0x8010A02C) is the immediate gapless successor of the
documented eighth member `ovl_11_func_80109F7C` (splat
`configs/splat/ovl_11.yaml`: 0x5215C → 0x5220C, and 0x5220C + 0xB8 = 0x522C4 is
the entry of `ovl_11_func_8010A0E4`) and carries the byte-identical state-switch
idiom (`beqz`(0) / `bgtz` / `beq`(−1) and `case 1: default:`) and the same
`ovl_11_func_800D04D4(obj, table, &obj->+0x28, -1, &obj->+0x2A)` call shape; its
table `D_80127A90` (`0x000A0007, 0x000A0000, 0x0000FFFF`) is the entry
immediately after `ovl_11_func_80109F7C`'s `D_80127A80` in
`build/ovl_11/asm/data/69960.data.s`, and its gapless successor's table
`D_80127A9C` immediately follows `D_80127A90`, so membership rests on both code
and table adjacency. Its words differ from the twenty-seventh member
`ovl_11_func_80109EC4` only in the table symbol.
- ovl_11_func_8010A02C (m, matched this session, byte-exact) — family state
  handler: state 0 sets +0x28 = 1 *and* sets flag 0x800 at s32@+0x34; state −1
  sets the loop variable 1, sets +0x2C = 0x12C, and clears flag 0x800 at
  s32@+0x34; else steps table `D_80127A90`.

Twenty-ninth family member, link-order-adjacent to the twenty-eighth
(confidence: high). `ovl_11_func_8010A0E4` (0x8010A0E4) is the immediate gapless
successor of `ovl_11_func_8010A02C` (splat `configs/splat/ovl_11.yaml`: 0x5220C +
0xB8 = 0x522C4 = 0x8010A0E4) and carries the byte-identical state-switch idiom
(`beqz`(0) / `bgtz` / `beq`(−1) and `case 1: default:`) and the same
`ovl_11_func_800D04D4(obj, table, &obj->+0x28, -1, &obj->+0x2A)` call shape; its
table `D_80127A9C` (`0x005A0005, 0x0000FFFF`) immediately follows 8010A02C's
`D_80127A90` in `build/ovl_11/asm/data/69960.data.s`, so membership rests on both
code and table adjacency. Its `case 1: default:` shape is byte-identical to the
twelfth member `ovl_11_func_800D41A4` (state 0 also sets flag 0x800; state −1
also sets +0x2C = 0x12C), from which only the table symbol differs.
- ovl_11_func_8010A0E4 (m, byte-exact this session) — family state handler:
  state 0 sets +0x28 = 1 *and* sets flag 0x800 at s32@+0x34; state −1 sets the
  loop variable 1, sets +0x2C = 0x12C, and clears flag 0x800 at s32@+0x34; else
  steps table `D_80127A9C`.

Thirtieth family member, link-order-adjacent to the twenty-ninth
(confidence: high). `ovl_11_func_8010A19C` (0x8010A19C) is the immediate gapless
successor of `ovl_11_func_8010A0E4` (splat `configs/splat/ovl_11.yaml`:
0x522C4 + 0xB8 = 0x5237C = 0x8010A19C) and carries the byte-identical
state-switch idiom (`beqz`(0) / `bgtz` / `beq`(−1) and `case 1: default:`) and
the same `ovl_11_func_800D04D4(obj, table, &obj->+0x28, -1, &obj->+0x2A)` call
shape; its table `D_80127AA4` (`0x000A0006, 0x0000FFFF`) immediately follows
8010A0E4's `D_80127A9C` in `build/ovl_11/asm/data/69960.data.s`, so membership
rests on both code and table adjacency. Its words differ from the twenty-ninth
member only in the table symbol.
- ovl_11_func_8010A19C (m, byte-exact this session) — family state handler:
  state 0 sets +0x28 = 1 *and* sets flag 0x800 at s32@+0x34; state −1 sets the
  loop variable 1, sets +0x2C = 0x12C, and clears flag 0x800 at s32@+0x34; else
  steps table `D_80127AA4`.

Thirty-first family member, link-order-adjacent to the thirtieth
(confidence: high). `ovl_11_func_8010A254` (0x8010A254) is the immediate gapless
successor of `ovl_11_func_8010A19C` (splat `configs/splat/ovl_11.yaml`:
0x5237C + 0xB8 = 0x52434 = 0x8010A254) and carries the byte-identical
state-switch idiom (`beqz`(0) / `bgtz` / `beq`(−1) and `case 1: default:`) and
the same `ovl_11_func_800D04D4(obj, table, &obj->+0x28, -1, &obj->+0x2A)` call
shape; its table `D_80127AAC` (`0x003C0011, 0x0000FFFF`) immediately follows
8010A19C's `D_80127AA4` in `build/ovl_11/asm/data/69960.data.s`, so membership
rests on both code and table adjacency. Its `case 1: default:` shape is
byte-identical to the twelfth member `ovl_11_func_800D41A4` and the
twenty-seventh `ovl_11_func_80109EC4` (state 0 also sets flag 0x800; state −1
also sets +0x2C = 0x12C), from which only the table symbol differs.
- ovl_11_func_8010A254 (m, matched this session, byte-exact) — family state
  handler: state 0 sets +0x28 = 1 *and* sets flag 0x800 at s32@+0x34; state −1
  sets the loop variable 1, sets +0x2C = 0x12C, and clears flag 0x800 at
  s32@+0x34; else steps table `D_80127AAC`.

Thirty-second family member, link-order-adjacent to the thirty-first
(confidence: high). `ovl_11_func_8010A30C` (0x8010A30C) is the immediate gapless
successor of `ovl_11_func_8010A254` (splat `configs/splat/ovl_11.yaml`:
0x52434 + 0xB8 = 0x524EC = 0x8010A30C) and carries the byte-identical
state-switch idiom (`beqz`(0) / `bgtz` / `beq`(−1) and `case 1: default:`) and
the same `ovl_11_func_800D04D4(obj, table, &obj->+0x28, -1, &obj->+0x2A)` call
shape; its table `D_80127AB4` (`0x000A0007, 0x003C0008, 0x0000FFFF`) immediately
follows 8010A254's `D_80127AAC` (`0x003C0011, 0x0000FFFF`, ends at 0x80127AB4)
in `build/ovl_11/asm/data/69960.data.s`, so membership rests on both code and
table adjacency. Its words differ from the thirty-first member only in the table
symbol.
- ovl_11_func_8010A30C (m, matched this session, byte-exact) — family state
  handler: state 0 sets +0x28 = 1 *and* sets flag 0x800 at s32@+0x34; state −1
  sets the loop variable 1, sets +0x2C = 0x12C, and clears flag 0x800 at
  s32@+0x34; else steps table `D_80127AB4`.

Thirty-third family member, link-order-adjacent to the thirty-second
(confidence: high). `ovl_11_func_8010A3C4` (0x8010A3C4) is the immediate gapless
successor of `ovl_11_func_8010A30C` (splat `configs/splat/ovl_11.yaml`:
0x524EC + 0xB8 = 0x525A4 = 0x8010A3C4) and carries the byte-identical
state-switch idiom (`beqz`(0) / `bgtz` / `beq`(−1) and `case 1: default:`) and
the same `ovl_11_func_800D04D4(obj, table, &obj->+0x28, -1, &obj->+0x2A)` call
shape; its table `D_80127AC0` (`0x001E0009, 0x005A000A, 0x001E0009,
0x0000FFFF`) immediately follows 8010A30C's `D_80127AB4` (ends at 0x80127AC0)
in `build/ovl_11/asm/data/69960.data.s`, so membership rests on both code and
table adjacency. Its function words differ from the thirty-second member only
in the table symbol; its table carries three value pairs
(`0x001E0009, 0x005A000A, 0x001E0009`) before the `0x0000FFFF` terminator.
- ovl_11_func_8010A3C4 (m, byte-exact this session) — family state handler:
  state 0 sets +0x28 = 1 *and* sets flag 0x800 at s32@+0x34; state −1 sets the
  loop variable 1, sets +0x2C = 0x12C, and clears flag 0x800 at s32@+0x34; else
  steps table `D_80127AC0`.

Thirty-fourth family member, link-order-distant from the documented members
(confidence: medium). `ovl_11_func_8010ABAC` (0x8010ABAC) carries the
byte-identical state-switch idiom (`beqz`(0) / `bgtz` / `beq`(−1) and
`case 1: default:`) and the same
`ovl_11_func_800D04D4(obj, table, &obj->+0x28, -1, &obj->+0x2A)` call shape; its
table `D_80127AFC` (`0x001E0007, 0x005A000E, 0x001E0007, 0x0000FFFF`)
immediately follows `ovl_11_func_8010A850`'s `D_80127AE8` (0x14 bytes, ending at
0x80127AFC) in `build/ovl_11/asm/data/69960.data.s`. Its function words differ
from the twenty-ninth member `ovl_11_func_8010A0E4` only in the table symbol,
and its gapless link-order predecessor is `ovl_11_func_8010A850`
(`configs/splat/ovl_11.yaml`: 0x52A30 + 0x35C = 0x52D8C = 0x8010ABAC), a larger
handler that shares the same `{s16@0x28, s16@0x2A, s16@0x2C, s32@+0x34,
u16@0x7A}` state-object view and the same `ovl_11_func_800D04D4` callee but not
the 0xB8 idiom, so membership rests on the shared idiom and table cluster, not on
adjacency to a documented member.
- ovl_11_func_8010ABAC (m, matched this session, byte-exact) — family state
  handler: state 0 sets +0x28 = 1 *and* sets flag 0x800 at s32@+0x34; state −1
  sets the loop variable 1, sets +0x2C = 0x12C, and clears flag 0x800 at
  s32@+0x34; else steps table `D_80127AFC`.

Thirty-fifth family member, link-order-adjacent to the thirty-fourth
(confidence: high). `ovl_11_func_8010AC64` (0x8010AC64) is the immediate gapless
successor of `ovl_11_func_8010ABAC` (splat `configs/splat/ovl_11.yaml`:
0x52D8C + 0xB8 = 0x52E44 = 0x8010AC64) and carries the byte-identical
state-switch idiom (`beqz`(0) / `bgtz` / `beq`(−1) and `case 1: default:`) and
the same `ovl_11_func_800D04D4(obj, table, &obj->+0x28, -1, &obj->+0x2A)` call
shape; its table `D_80127B0C` (`0x001E0000, 0x005A000C, 0x001E0000, 0x0000FFFF`)
immediately follows 8010ABAC's `D_80127AFC` (ends at 0x80127B0C) in
`build/ovl_11/asm/data/69960.data.s`, so membership rests on both code and table
adjacency. Its function words differ from the twenty-ninth member
`ovl_11_func_8010A0E4` only in the table symbol; `D_80127B0C` is declared
`extern u8` in `include/globals_override.h` alongside the other 0x80127Axx/
0x80127Bxx handler-table bases.
- ovl_11_func_8010AC64 (m, matched this session, byte-exact) — family state
  handler: state 0 sets +0x28 = 1 *and* sets flag 0x800 at s32@+0x34; state −1
  sets the loop variable 1, sets +0x2C = 0x12C, and clears flag 0x800 at
  s32@+0x34; else steps table `D_80127B0C`.

Thirty-sixth family member, link-order-adjacent to the thirty-fifth
(confidence: high). `ovl_11_func_8010AD1C` (0x8010AD1C) is the immediate gapless
successor of `ovl_11_func_8010AC64` (splat `configs/splat/ovl_11.yaml`: 0x52E44 +
0xB8 = 0x52EFC = 0x8010AD1C) and carries the byte-identical state-switch idiom
(`beqz`(0) / `bgtz` / `beq`(−1) and `case 1: default:`) and the same
`ovl_11_func_800D04D4(obj, table, &obj->+0x28, -1, &obj->+0x2A)` call shape; its
function words differ from the thirty-fifth member `ovl_11_func_8010AC64` only in
the table symbol, and its table `D_80127B1C` (`0x001E0007, 0x005A000D,
0x001E0007, 0x0000FFFF`) immediately follows 8010AC64's `D_80127B0C` (ends at
0x80127B1C) in `build/ovl_11/asm/data/69960.data.s`, so membership rests on both
code and table adjacency. `D_80127B1C` is declared `extern u8` in
`include/globals_override.h` alongside the other 0x80127Axx/0x80127Bxx
handler-table bases.
- ovl_11_func_8010AD1C (m, byte-exact this session) — family state handler:
  state 0 sets +0x28 = 1 *and* sets flag 0x800 at s32@+0x34; state −1 sets the
  loop variable 1, sets +0x2C = 0x12C, and clears flag 0x800 at s32@+0x34; else
  steps table `D_80127B1C`.

Thirty-seventh family member, link-order-distant from the documented members
(confidence: medium). `ovl_11_func_8010BD6C` (0x8010BD6C) carries the
byte-identical state-switch idiom (`beqz`(0) / `bgtz` / `beq`(−1) and
`case 1: default:`) and the same
`ovl_11_func_800D04D4(obj, table, &obj->+0x28, -1, &obj->+0x2A)` call shape; its
function words are byte-identical to the thirtieth member `ovl_11_func_8010A19C`
(state 0 sets +0x28 = 1 and flag 0x800 at s32@+0x34; state −1 sets the loop
variable 1, sets +0x2C = 0x12C, and clears flag 0x800 at s32@+0x34), differing
only in the table symbol, and its table `D_80127B88` (`0x001E0000, 0x0000FFFF`)
immediately follows `D_80127B38` (ends at 0x80127B88) in the 0x80127Bxx
handler-table band of `build/ovl_11/asm/data/69960.data.s`. Its gapless
link-order predecessor is `ovl_11_func_8010BCE8` (splat
`configs/splat/ovl_11.yaml`: 0x53EC8 + 0x84 = 0x53F4C = 0x8010BD6C), a far-state
gate member rather than a state-switch sibling, so membership rests on the
shared idiom and table cluster, not adjacency to a documented member. The
`{s32@0x34, u16@0x7A}` object view is the family's shared state object.
- ovl_11_func_8010BD6C (m, byte-exact this session) — family state handler:
  state 0 sets +0x28 = 1 *and* sets flag 0x800 at s32@+0x34; state −1 sets the
  loop variable 1, sets +0x2C = 0x12C, and clears flag 0x800 at s32@+0x34; else
  steps table `D_80127B88`.

Thirty-eighth family member, link-order-adjacent to the ninth (confidence:
high). `ovl_11_func_8010BED4` (0x8010BED4) is the immediate gapless successor of
`ovl_11_func_8010BE24` (splat `configs/splat/ovl_11.yaml`: 0x54004 + 0xB0 =
0x540B4 = 0x8010BED4) and carries the byte-identical state-switch idiom
(`beqz`(0) / `bgtz` / `beq`(−1) and `case 1: default:`) and the same
`ovl_11_func_800D04D4(obj, table, &obj->+0x28, -1, &obj->+0x2A)` call shape; its
function words are byte-identical to the thirty-seventh member
`ovl_11_func_8010BD6C` (state 0 sets +0x28 = 1 and flag 0x800 at s32@+0x34;
state −1 sets the loop variable 1, sets +0x2C = 0x12C, and clears flag 0x800 at
s32@+0x34), differing only in the table symbol, and its table `D_80127B9C`
(`0x000A0000, 0x0000FFFF`) immediately follows the ninth member 8010BE24's
`D_80127B90` (ends at 0x80127B9C) in `build/ovl_11/asm/data/69960.data.s`, so
membership rests on both code and table adjacency.
- ovl_11_func_8010BED4 (m, byte-exact this session) — family state handler:
  state 0 sets +0x28 = 1 *and* sets flag 0x800 at s32@+0x34; state −1 sets the
  loop variable 1, sets +0x2C = 0x12C, and clears flag 0x800 at s32@+0x34; else
  steps table `D_80127B9C`.

Thirty-ninth family member, link-order-distant from the documented members
(confidence: medium). `ovl_11_func_8010E2C4` (0x8010E2C4) carries the
byte-identical state-switch idiom (`beqz`(0) / `bgtz` / `beq`(−1) and
`case 1: default:`) and the same
`ovl_11_func_800D04D4(obj, table, &obj->+0x28, -1, &obj->+0x2A)` call shape; its
function words are byte-identical to the twenty-ninth member
`ovl_11_func_8010A0E4` (state 0 sets +0x28 = 1 and flag 0x800 at s32@+0x34;
state −1 sets the loop variable 1, sets +0x2C = 0x12C, and clears flag 0x800 at
s32@+0x34), differing only in the table symbol, and its table `D_80127D48`
(`0x001E0000, 0x0000FFFF`) sits in `build/ovl_11/asm/data/69960.data.s`, so
membership rests on the shared idiom and table shape, not link adjacency to a
documented member. The same function is `D_800BAABC[0]` of the object-mode
dispatch table documented above, so membership also has named-table support.
- ovl_11_func_8010E2C4 (m, byte-exact this session) — family state handler:
  state 0 sets +0x28 = 1 *and* sets flag 0x800 at s32@+0x34; state −1 sets the
  loop variable 1, sets +0x2C = 0x12C, and clears flag 0x800 at s32@+0x34; else
  steps table `D_80127D48`.

Fortieth family member, link-order-adjacent to the thirty-ninth on one side and
named-table-adjacent on the other (confidence: high). `ovl_11_func_8010E37C`
(0x8010E37C) is the immediate gapless successor of the thirty-ninth member
`ovl_11_func_8010E2C4` (splat `configs/splat/ovl_11.yaml`: 0x564A4 → 0x5655C =
0xB8) and the immediate gapless predecessor of `ovl_11_func_8010E434`
(0x5655C → 0x56614 = 0xB8), the `D_800BAABC[2]` handler documented above. Its
function words are byte-identical to the twenty-ninth member
`ovl_11_func_8010A0E4` and the thirty-ninth `ovl_11_func_8010E2C4` — same
`beqz`(0) / `bgtz` / `beq`(−1) `case 1: default:` tree and same
`ovl_11_func_800D04D4(obj, table, &obj->+0x28, -1, &obj->+0x2A)` call shape —
differing only in the table symbol and labels. Its table `D_80127D50`
(`0x001E000D, 0x000F000E, 0x0000FFFF`) is the entry immediately after the
thirty-ninth's `D_80127D48` and immediately before 8010E434's `D_80127D5C` in
`build/ovl_11/asm/data/69960.data.s`, so membership rests on both code and
table adjacency on either side.
- ovl_11_func_8010E37C (m, byte-exact this session) — family state handler:
  state 0 sets +0x28 = 1 *and* sets flag 0x800 at s32@+0x34; state −1 sets the
  loop variable 1, sets +0x2C = 0x12C, and clears flag 0x800 at s32@+0x34; else
  steps table `D_80127D50`.

Forty-first family member, link-order-distant from the documented members
(confidence: medium). `ovl_11_func_8010EA6C` (0x8010EA6C) carries the
byte-identical state-switch idiom (`beqz`(0) / `bgtz` / `beq`(−1) and
`case 1: default:`) and the same
`ovl_11_func_800D04D4(obj, table, &obj->+0x28, -1, &obj->+0x2A)` call shape; its
function words are byte-identical to the thirtieth member
`ovl_11_func_8010A19C` (state 0 sets +0x28 = 1 and flag 0x800 at s32@+0x34;
state −1 sets the loop variable 1, sets +0x2C = 0x12C, and clears flag 0x800 at
s32@+0x34), differing only in the table symbol, and its table `D_80127D88`
(`0x001E000B, 0x0000FFFF`) sits in the 0x80127Dxx handler-table band of
`build/ovl_11/asm/data/69960.data.s` (between `D_80127D78` and `D_80127D90`).
Its gapless link-order successor `ovl_11_func_8010EB24` (0x8010EB24, 0x19C) is
a larger, different state machine, not a 0xB8 switch sibling, so membership
rests on the shared idiom and byte-identical words, not link adjacency. The
`{s16@0x28, s16@0x2A, s16@0x2C, s32@0x34, u16@0x7A}` object view is the
family's shared state object. `D_80127D88` is declared `extern u8` in
`include/globals_override.h` alongside the other 0x80127xxx handler-table bases.
- ovl_11_func_8010EA6C (m, byte-exact this session) — family state handler:
  state 0 sets +0x28 = 1 *and* sets flag 0x800 at s32@+0x34; state −1 sets the
  loop variable 1, sets +0x2C = 0x12C, and clears flag 0x800 at s32@+0x34; else
  steps table `D_80127D88`.

Forty-second family member, named-table member and link-order-adjacent to the
sixth (confidence: high). `ovl_11_func_800DFDAC` (0x800DFDAC) is the immediate
gapless successor of the sixth member `ovl_11_func_800DFCFC` (splat
`configs/splat/ovl_11.yaml`: 0x27EDC → 0x27F8C = 0xB0) and carries the
byte-identical state-switch idiom (`beqz`(0) / `bgtz` / `beq` against its
non-zero sentinel) and the same
`ovl_11_func_800D04D4(obj, table, &obj->+0x28, -1, &obj->+0x2A)` call shape; its
table `D_80123F18` (`0x000A0005, 0x000A0000, 0x0000FFFF`) is the entry
immediately after 800DFCFC's `D_80123F08` in
`build/ovl_11/asm/data/69960.data.s` (D_80123F08 ends at 0x80123F18), so
membership rests on named table membership and both code and table adjacency.
This member is the family's **state-4 variant**: unlike the −1 sentinel the
other members compare against, its state test is `case 4`, its `case 4` branch
sets the loop variable 1, sets +0x2C = 0x12C and clears flag 0x800 at
s32@+0x34, and the call-success path stores 4 (not −1) back to +0x28.
- ovl_11_func_800DFDAC (m, byte-exact this session) — family state handler:
  state 0 sets +0x28 = 1 *and* sets flag 0x800 at s32@+0x34; state 4 sets the
  loop variable 1, sets +0x2C = 0x12C, and clears flag 0x800 at s32@+0x34; else
  steps table `D_80123F18`.

Forty-third family member, named-table member and link-order-adjacent to the
seventh on one side and a same-idiom successor on the other (confidence: high).
`ovl_11_func_800E1974` (0x800E1974) carries the family's state-switch idiom
(against its non-zero sentinel 4) and the same
`ovl_11_func_800D04D4(obj, table, &obj->+0x28, -1, &obj->+0x2A)` call shape; it
is entry 2 of the 20-word `D_800B966C` function-pointer table in
`build/ovl_11/asm/data/1664.rodata.s` (the table read by dispatcher
`ovl_11_func_800E0B40`), and its table `D_80123FD0`
(`0x000A0005, 0x000A0000, 0x0000FFFF`) is the gapless successor of the seventh
member 800E18C4's `D_80123FC0` (`0x000A0000, 0x000A0005, 0x00000002,
0x0000FFFF`) in `build/ovl_11/asm/data/69960.data.s`. Splat
`configs/splat/ovl_11.yaml` shows it gapless between 800E18C4 (0x29AA4 + 0xB0 =
0x29B54) and `ovl_11_func_800E1A3C` (0x29B54 + 0xC8 = 0x29C1C), so membership
rests on named table membership and both code and table adjacency. This member
is the family's second **state-4 variant**, like the forty-second
`ovl_11_func_800DFDAC`.
- ovl_11_func_800E1974 (m, byte-exact this session) — family state handler:
  state 0 sets +0x28 = 1 *and* sets flag 0x800 at s32@+0x34; state 4 sets the
  loop variable 1, sets +0x2C = 0x12C, and clears flag 0x800 at s32@+0x34; else
  steps table `D_80123FD0`.

Forty-fourth family member, link-order-adjacent to the fifth (confidence:
high). `ovl_11_func_800D4558` (0x800D4558) is the immediate gapless predecessor
of the fifth member `ovl_11_func_800D4624` (splat `configs/splat/ovl_11.yaml`:
0x1C738 → 0x1C804 = 0xCC, and 0x1C804 is the `ovl_11_func_800D4624` entry) and
carries the byte-identical state-switch idiom (`beqz`(0) / `bgtz` / `beq`(−1)
and `case 1: default:`) and the same
`ovl_11_func_800D04D4(obj, table, &obj->+0x28, -1, &obj->+0x2A)` call shape; its
table `D_80123BEC` (`0x000F0000, 0x002D0001, 0x0000FFFF`) is the entry
immediately before 800D4624's `D_80123BF8` in
`build/ovl_11/asm/data/69960.data.s` (D_80123BEC ends at 0x80123BF8), so
membership rests on both code and table adjacency. Unlike the fifth member, its
call-success path additionally tests +0x28 for 2 and, when equal, calls
`ovl_11_func_800D0408(unk22, &obj->+0x48, 0xC)`, so it also shares the
container-wide object view whose +0x48 `Recon800D0408A1View` that helper takes.
- ovl_11_func_800D4558 (m, byte-exact this session) — family state handler:
  state 0 sets +0x28 = 1 *and* sets flag 0x800 at s32@+0x34; state −1 calls
  `ovl_11_func_800D3200(obj)` and returns 1; else steps table `D_80123BEC` and,
  on a zero return with +0x28 == 2, calls
  `ovl_11_func_800D0408(obj->unk22, &obj->unk48, 0xC)`.

Forty-fifth family member, link-order-adjacent to the nineteenth (confidence:
high). `ovl_11_func_800D4D1C` (0x800D4D1C) is the immediate gapless predecessor
of the documented nineteenth member `ovl_11_func_800D4DE8` (splat
`configs/splat/ovl_11.yaml`: 0x1CEFC + 0xCC = 0x1CFC8 = the `ovl_11_func_800D4DE8`
entry) and carries the byte-identical state-switch idiom (`beqz`(0) / `bgtz` /
`beq`(−1) and `case 1: default:`) and the same
`ovl_11_func_800D04D4(obj, table, &obj->+0x28, -1, &obj->+0x2A)` call shape; its
table `D_80123C70` (`0x0000000D, 0x012C000D, 0x0000FFFF`) is the entry
immediately before 800D4DE8's `D_80123C7C` in
`build/ovl_11/asm/data/69960.data.s` (D_80123C70 ends at 0x80123C7C), so
membership rests on both code and table adjacency. Its call-success path
tests +0x28 for 2 and, when equal, calls
`ovl_11_func_800D0408(obj->unk22, &obj->unk48, 0x3C)`, sharing the
container-wide object view whose +0x48 `Recon800D0408A1View` that helper takes,
and it uses the `ovl_11_func_800D3200(obj)` state −1 arm (like the fifth and
forty-fourth members).
- ovl_11_func_800D4D1C (m, matched this session, byte-exact) — family state
  handler: state 0 sets +0x28 = 1 *and* sets flag 0x800 at s32@+0x34; state −1
  calls `ovl_11_func_800D3200(obj)` and returns 1; else steps table
  `D_80123C70` and, on a zero return with +0x28 == 2, calls
  `ovl_11_func_800D0408(obj->unk22, &obj->unk48, 0x3C)`.

Forty-sixth family member, link-order-adjacent to the twenty-fifth and its
state-4 table-selector sibling (confidence: high). `ovl_11_func_800E3020`
(0x800E3020) is the immediate gapless successor of the documented twenty-fifth
member `ovl_11_func_800E2F58` (splat `configs/splat/ovl_11.yaml`: 0x2B138 →
0x2B200, where 0x2B200 is the `ovl_11_func_800E3020` entry) and the immediate
gapless predecessor of `ovl_11_func_800E30FC` (0x2B200 → 0x2B2DC = 0xDC). It
carries the family state-switch idiom against its non-zero sentinel 4 (like the
forty-second member `ovl_11_func_800DFDAC` and the forty-third
`ovl_11_func_800E1974`) and the same
`ovl_11_func_800D04D4(obj, table, &obj->+0x28, -1, &obj->+0x2A)` call shape; as
in the twenty-fifth member it selects its table argument from two adjacent
handler tables by `u16@0 == 0x10A` — `D_801240A8` (`0x000A0000, 0x0000FFFF`)
when equal, else `D_8012409C` (`0x000A0005, 0x000A0000, 0x0000FFFF`; the two are
the entries immediately after the twenty-fifth member's `D_80124080`/`D_80124090`
in `build/ovl_11/asm/data/69960.data.s`, ending at 0x801240B0), so membership
rests on both code and table adjacency.
- ovl_11_func_800E3020 (m, matched this session, byte-exact) — family state
  handler: state 0 sets +0x28 = 1 *and* sets flag 0x800 at s32@+0x34; state 4
  sets the loop variable 1, sets +0x2C = 0x12C, and clears flag 0x800 at
  s32@+0x34; else selects `D_801240A8`/`D_8012409C` by `u16@0 == 0x10A` and
  steps it, storing 4 back to +0x28 on call success.

Forty-seventh family member, link-order-adjacent to the eighteenth
(confidence: high). `ovl_11_func_800D4B1C` (0x800D4B1C) is the immediate gapless
successor of the eighteenth member `ovl_11_func_800D4A64` (splat
`configs/splat/ovl_11.yaml`: 0x1CC44 → 0x1CCFC = the `ovl_11_func_800D4B1C`
entry) and carries the byte-identical state-switch idiom (`beqz`(0) / `bgtz` /
`beq`(−1) and `case 1: default:`) and the same
`ovl_11_func_800D04D4(obj, table, &obj->+0x28, -1, &obj->+0x2A)` call shape; its
table `D_80123C50` (`0x0000000D, 0x005A000D, 0x012C000D, 0x0000FFFF`) is the
entry immediately after 800D4A64's `D_80123C44` (`0x0078000C, 0x000F0000,
0x0000FFFF`; ends at 0x80123C50) in `build/ovl_11/asm/data/69960.data.s`, so
membership rests on both code and table adjacency. Its call-success path is the
family's three-way variant: +0x28 == 2 calls
`ovl_11_func_800D0408(obj->unk22, &obj->unk48, 0x3C)` and subtracts 0x10 from
the +0x48 `Recon800D0408A1View`'s unk4 (s32@+0x4C), +0x28 == 3 calls
`ovl_11_func_800D0408(...)` alone, and it uses the `ovl_11_func_800D3200(obj)`
state −1 arm (like the fifth, forty-fourth and forty-fifth members).
- ovl_11_func_800D4B1C (m, byte-exact this session) — family state handler:
  state 0 sets +0x28 = 1 *and* sets flag 0x800 at s32@+0x34; state −1 calls
  `ovl_11_func_800D3200(obj)` and returns 1; else steps table `D_80123C50` and,
  on a zero return, calls `ovl_11_func_800D0408(obj->unk22, &obj->unk48, 0x3C)`
  for +0x28 == 2 or 3, decrementing the view's unk4 by 0x10 in the 2 case.

Forty-eighth family member, link-order-adjacent to the forty-seventh and the
forty-fifth (confidence: high). `ovl_11_func_800D4C1C` (0x800D4C1C) is the
immediate gapless successor of the documented forty-seventh member
`ovl_11_func_800D4B1C` and the immediate gapless predecessor of the documented
forty-fifth `ovl_11_func_800D4D1C` (splat `configs/splat/ovl_11.yaml`: 0x1CCFC
→ 0x1CDFC = the `ovl_11_func_800D4C1C` entry, and 0x1CDFC → 0x1CEFC = the
`ovl_11_func_800D4D1C` entry), and it carries the byte-identical state-switch
idiom (`beqz`(0) / `bgtz` / `beq`(−1) and `case 1: default:`) and the same
`ovl_11_func_800D04D4(obj, table, &obj->+0x28, -1, &obj->+0x2A)` call shape; its
table `D_80123C60` (`0x0000000E, 0x005A000E, 0x012C000E, 0x0000FFFF`) is the
entry immediately after 800D4B1C's `D_80123C50` and immediately before
800D4D1C's `D_80123C70` in `build/ovl_11/asm/data/69960.data.s`, so membership
rests on both code and table adjacency. Its call-success path is the family's
three-way variant (identical to the forty-seventh member): +0x28 == 2 calls
`ovl_11_func_800D0408(obj->unk22, &obj->unk48, 0x3C)` and subtracts 0x10 from
the +0x48 `Recon800D0408A1View`'s unk4 (s32@+0x4C), +0x28 == 3 calls
`ovl_11_func_800D0408(...)` alone, and it uses the `ovl_11_func_800D3200(obj)`
state −1 arm (like the fifth, forty-fourth and forty-fifth members).
- ovl_11_func_800D4C1C (m, byte-exact this session) — family state handler:
  state 0 sets +0x28 = 1 *and* sets flag 0x800 at s32@+0x34; state −1 calls
  `ovl_11_func_800D3200(obj)` and returns 1; else steps table `D_80123C60` and,
  on a zero return, calls `ovl_11_func_800D0408(obj->unk22, &obj->unk48, 0x3C)`
  for +0x28 == 2 or 3, decrementing the view's unk4 by 0x10 in the 2 case.

Forty-ninth family member, link-order-adjacent to the twenty-sixth through one
non-member (confidence: high). `ovl_11_func_800E32E4` (0x800E32E4) carries the
byte-identical state-switch idiom (`beqz`(0) / `bgtz` / `beq`(−1) and
`case 1: default:`) and the same
`ovl_11_func_800D04D4(obj, table, &obj->+0x28, -1, &obj->+0x2A)` call shape; its
table `D_801240C8` (`0x00000003, 0x0000FFFF`; content-identical to the fourth
member's `D_80124000` and 800E00E0's `D_80123F48`) sits in the 69960.data.s
handler-table band immediately after `D_801240BC` and immediately before the
twenty-sixth member `ovl_11_func_800E3464`'s `D_801240D0`, so membership rests on
the shared idiom and table cluster plus link adjacency. Splat
`configs/splat/ovl_11.yaml` shows it gapless between the non-member
`ovl_11_func_800E3200` (predecessor, 0x2B3E0 + 0xE4 = 0x2B4C4) and the
non-member `ovl_11_func_800E33E8` (successor, 0x2B4C4 + 0x104 = 0x2B5C8, which
in turn gaplessly precedes `ovl_11_func_800E3464`). Its state 0 is a family
variant: it first compares `*(s16 *)((char *)&D_8007AFF0 + 0x25476)` with
obj->unk30 and, when equal, dispatches on u16@0 == 0x109/0x10A to
`func_8001FABC(0x17)` / `func_8001FABC(0x1B)`, then sets +0x28 = 1 and flag
0x800 (no +0x2C store); state −1 sets the loop variable 1 and clears flag 0x800.
- ovl_11_func_800E32E4 (m, matched this session, byte-exact) — family state
  handler: state 0 clears through the `D_8007AFF0`+0x25476 / unk30 gate, calls
  `func_8001FABC` for u16@0 == 0x109/0x10A, then sets +0x28 = 1 *and* flag 0x800
  at s32@+0x34; state −1 sets the loop variable 1 and clears flag 0x800; else
  steps table `D_801240C8`.

---

## `ovl_11` spawn/flag-object run — 0x800C009C–0x800C056C (confidence: medium)

Candidate same-TU family of `ovl_11`. Evidence: zero-gap link-order
contiguity (`build/ovl_11/functions.csv`): 0x800C009C (0x214) → 0x800C02B0
(0x9C) → 0x800C034C (0x100) → 0x800C044C (0x120) → 0x800C056C (0x8C) →
0x800C05F8 — each begins exactly where the previous ends. The run shares one
stride-0xE spawn object read through its u16 flag word at +0xC, and the exe
`Rand` selector `func_80012A34`. Call-graph links: 800C02B0 → 800C009C;
800C044C and 800C009C → 800C034C; 800C056C → `func_80012A34`.

Members:
- ovl_11_func_800C009C (s) — reads the +0xC `0x4000`/`0x1000` flag pair and
  calls 800C034C.
- ovl_11_func_800C02B0 (s) — calls 800C009C.
- ovl_11_func_800C034C (m, matched this session, byte-exact) — spawn-object
  initializer: branches on +0xC bits `0x4000`/`0x1000` to pick ranges, writes
  random s16 fields +0/+2/+8 and clears +0xA.
- ovl_11_func_800C044C (m, matched this session, byte-exact) — spawn-object
  driver: derives a mode-local offset from arg0 (valid 1..4, offset arg0-3 for
  arg0>=2 else arg0-1) and walks the 40-entry stride-0xE array at `D_80128820`,
  writing each element's +0x4 s16 and OR-ing its +0xC flag word
  (0x4000/0x2000/0x1000/0x3000) before calling 800C034C per element; also
  points `D_80128A80` at `D_80125EB8` and initializes `D_80128A50` via
  `func_80015704(&D_80128A50, &D_800977F8)`. Shares the `D_80128820` 0xE-stride
  object array and the `D_80128A80` pointer slot with matched 0x800BFEA4 /
  0x800BFF00 (see the D_8006C838 flags/state-buffer cluster), a fingerprint
  that a common sprite/spawn TU also fits, though link contiguity alone leaves
  the original TU boundary unproven.
- ovl_11_func_800C056C (m) — guards `D_8006C838` +0xC bit `0x08000000` and
  calls `func_80012A34(0x64)`.

---

## `ovl_11` stride-0x2C bounding-box record run — 0x800BDCE8 / 0x800BDE84 (confidence: medium)

Candidate same-TU pair of `ovl_11`. Evidence: shared stride-0x2C record-scan
idiom — both gate on a u16 flag word at +0x10 (800BDE84 tests bit 0x4000;
800BDCE8 tests the 0x6008 mask and reads the sibling u16 at +0x12) and copy
the same 12-byte box from +0x1E/+0x22/+0x24/+0x28 into a stack local with the
identical 4+2+4+2 unaligned word/halfword sequence, comparing it against the
same three s16 caller coordinates; both advance a pointer to the +0x10
sub-record by 0x2C per iteration. Corroborated by zero-gap link-order
contiguity (`configs/symbols/ovl_11.txt`): 0x800BDCE8 (0x19C) ends exactly at
0x800BDE84 (0x114).

Members (address order):
- ovl_11_func_800BDCE8 (s) — record scanner: same +0x10/+0x12 flag pair and
  +0x1E/+0x24 box, advances the +0x10 pointer by 0x2C, calls
  `ovl_11_func_800F0FB0` and touches `D_8006C838` +0x51FE.
- ovl_11_func_800BDE84 (m, matched this session, byte-exact) — leaf
  bounding-box probe: returns the +0x10 sub-record (`NULL` if none of the 0x32
  entries matches) whose flag bit 0x4000 is set and whose +0x1E/+0x24 min/max
  box brackets `arg1`, y-axis biased by −0x80/+0x78.

Run context (not asserted members): gapless predecessor ovl_11_func_800BDCE0
(m, 8-byte `return -1` leaf) and successor ovl_11_func_800BDF98 (s, large
argument-forwarding body calling 800D7EF8/800BE6E4) bound the run.

## `ovl_11` sprite-draw variant run — 0x8011D0C8 / 0x8011D10C / 0x8011D150 (confidence: medium)

Zero-gap link order 0x8011D0C8 (0x44) → 0x8011D10C (0x44) → 0x8011D150 (0x114)
(`configs/symbols/ovl_11.txt`), the call graph agreeing: both earlier members
are four-argument forwarders that call 0x8011D150, passing their variant
selector `0`/`1` as the first argument.

Members (address order):
- ovl_11_func_8011D0C8 (m) — forwarder `8011D150(0, arg0..arg3)`.
- ovl_11_func_8011D10C (m) — sibling forwarder `8011D150(1, arg0..arg3)`.
- ovl_11_func_8011D150 (m, matched this session, byte-exact) — shared body:
  picks the table base `D_800517E0` (variant 0) or `D_800517EE` (variant 1),
  draws with `D_80054BC0[0] + base` through `func_80019E14`/`func_80017A38`/
  `func_80017B3C`, then a `func_800136D4` box sized by the variant.

The two bases extend the ovl_11 `D_80054BC0[0] + (s32)&D_80051xxx/518xx`
pointer-base cluster (ovl_11_func_8011A9DC, 8011B210, 8011DD48, 8011CEE0,
8011CF10). Zero-gap link order + caller/callee edges + shared pointer idiom.

## `ovl_27` D_8006C838 work-area init/menu run — 0x800B8C6C–0x800B8D28 and 0x800BA914–0x800BAC14 (confidence: medium)

Evidence: shared `D_8006C838` work-area base cluster — the +0x4488 counter
shared by 800B8C6C/800B8CAC; 800B8D28 reads +0x4450/+0xC/+0x1C and calls
800BA914(3); 800BA914 reaches the +0x20/+0x2C pools through the
`D_80071DFC - 0x55C4` alias of the same base; 800BABD4 writes
+0x8000+0x64CC; 800BAC14 copies into +0x468A. Corroborated by zero-gap
link-order contiguity (`configs/splat/ovl_27.yaml`): 0x800BA914 (0x120) ends
exactly at 0x800BAA34 (0x1A0) → 0x800BABD4 (0x40) → 0x800BAC14 (0x4C) → the
0x2E40 data block, and 0x800B8C6C (0x40) → 0x800B8CAC (0x7C) → 0x800B8D28
(0x100). The 800B8D28 → 800BA914 call edge agrees with address order. This is
a prior, not a proven TU boundary.

Members (address order):
- ovl_27_func_800B8C6C (m) — increments `D_8006C838+0x4488`, calls
  func_800132F0/func_8001FE34.
- ovl_27_func_800B8CAC (m) — menu branch; advances the same +0x4488 counter
  after func_80020818/func_80020B80.
- ovl_27_func_800B8D28 (m) — menu state handler; clears +0x4450 flags, calls
  800BA914(3), resets +0x4488, dispatches func_80011EF0.
- ovl_27_func_800BA914 (m, matched this session, byte-exact) — fills 0x19
  records of 0x168-byte entries at `D_80071DFC` from the selected
  D_800BAC60/BB52C/BBDF8/BC6C4 sprite table, resolving each through the
  D_8006C838 palette pools.
- ovl_27_func_800BAA34 (s) — undecoded neighbour between 800BA914 and
  800BABD4.
- ovl_27_func_800BABD4 (m) — writes the 0x64CC..0x64D2 s16 quarter at
  `D_8006C838+0x8000`.
- ovl_27_func_800BAC14 (m) — copies `D_800BCFF0` into `D_8006C838+0x468A`.

Run context (not asserted members): ovl_27_func_800B9124 (m, HUD text via
D_8006C838+0x5246/0x5248) and ovl_27_func_800BA814 (m, D_800C4A60-backed
copy) also touch the D_8006C838 work area but sit outside these gapless runs.

## `ovl_11` stack-box record-scan pair — 0x800BF1D0 / 0x800BF2F4 (confidence: medium)

Candidate same-TU pair of `ovl_11`. Evidence: zero-gap link-order contiguity
(`configs/splat/ovl_11.yaml`): 0x800BF1D0 starts at 0x73B0 and is 0x124 long,
ending exactly at 0x74D4 = 0x800BF2F4; the two are immediate link-order
neighbours. Both build a local `s32 box[N]` bounds array, take its address into
a `s32 *bp` pointer (`bp = box;`), and bracket a scanned record's s32 fields
with `bp[k] < v && v < bp[k+1]`, using the same 0x96 (150) half-range; both are
leaves, so no call edge corroborates the tie.

Members (address order):
- ovl_11_func_800BF1D0 (m, matched this session, 0x124, byte-exact) — range
  scan over the 37-entry 0x1D4-stride `D_80076220` array: brackets the 3-s32
  box at record +0x30 (or +0x60 when unk1E bit 0x1000 holds) against a 6-word
  stack box over arg0[0]/arg0[2]/arg0[1], gated by unk1E bits
  0x1000→0x800 / 0x100; returns the first matching record else 0.
- ovl_11_func_800BF2F4 (m, 0xDC) — sibling bounding-box probe: same `bp = box`
  stack-box idiom over arg0[0]/arg0[2] with the 0x96 half-range, scanning a
  0xC5-entry 0x18-stride record array reached through the
  `D_8006C838+0x8000+0x5D8C` pointer slot; returns the record's u16@+2.
