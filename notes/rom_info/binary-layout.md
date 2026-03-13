# Binary Layout Analysis

Generated from `build/functions.csv`
GP value: 0x8005E274
GP-relative range: 0x80056274 to 0x80066273

## Summary

| Metric | Value |
|--------|-------|
| Total entries in CSV | 735 |
| Contiguous regions | 19 |
| Code regions | 9 (0x37F58 = 229,208 bytes) |
| Data regions | 10 (0x168A8 = 92,328 bytes) |
| Address range | 0x80010000 to 0x8005E800 |

## Contiguous Regions

| # | Type | Start | End | Size | Entries | Notes |
|---|------|-------|-----|------|---------|-------|
| 1 | data | 0x80010000 | 0x80011270 | 0x1270 (4,720) | 1 | data |
| 2 | code | 0x80011270 | 0x800371D8 | 0x25F68 (155,496) | 451 |  |
| 3 | data | 0x800371D8 | 0x8003727C | 0xA4 (164) | 1 | data |
| 4 | code | 0x8003727C | 0x80041AB4 | 0xA838 (43,064) | 121 |  |
| 5 | data | 0x80041AB4 | 0x80041B7C | 0xC8 (200) | 1 | data |
| 6 | code | 0x80041B7C | 0x800425C4 | 0xA48 (2,632) | 18 |  |
| 7 | data | 0x800425C4 | 0x800425DC | 0x18 (24) | 1 | data |
| 8 | code | 0x800425DC | 0x80048190 | 0x5BB4 (23,476) | 81 |  |
| 9 | data | 0x80048190 | 0x80057DB8 | 0xFC28 (64,552) | 4 | data (partially GP-relative) |
| 10 | code | 0x80057DB8 | 0x80058268 | 0x4B0 (1,200) | 13 |  |
| 11 | data | 0x80058268 | 0x8005845C | 0x1F4 (500) | 4 | sdata (GP-relative) |
| 12 | code | 0x8005845C | 0x80058688 | 0x22C (556) | 5 |  |
| 13 | data | 0x80058688 | 0x80058C60 | 0x5D8 (1,496) | 1 | sdata (GP-relative) |
| 14 | code | 0x80058C60 | 0x800592DC | 0x67C (1,660) | 4 |  |
| 15 | data | 0x800592DC | 0x80059B04 | 0x828 (2,088) | 3 | sdata (GP-relative) |
| 16 | code | 0x80059B04 | 0x80059CB4 | 0x1B0 (432) | 3 |  |
| 17 | data | 0x80059CB4 | 0x8005D124 | 0x3470 (13,424) | 14 | sdata (GP-relative) |
| 18 | code | 0x8005D124 | 0x8005D3D8 | 0x2B4 (692) | 8 |  |
| 19 | data | 0x8005D3D8 | 0x8005E800 | 0x1428 (5,160) | 1 | sdata (GP-relative) |

## Data Regions Detail

Each data region listed with its individual entries, to help identify section types.

### Data Region 1: 0x80010000 - 0x80011270 (0x1270) — data

| Address | Size | Name |
|---------|------|------|
| 0x80010000 | 0x1270 | T_80010000 |

### Data Region 2: 0x800371D8 - 0x8003727C (0xA4) — data

| Address | Size | Name |
|---------|------|------|
| 0x800371D8 | 0xA4 | T_800371D8 |

### Data Region 3: 0x80041AB4 - 0x80041B7C (0xC8) — data

| Address | Size | Name |
|---------|------|------|
| 0x80041AB4 | 0xC8 | T_80041AB4 |

### Data Region 4: 0x800425C4 - 0x800425DC (0x18) — data

| Address | Size | Name |
|---------|------|------|
| 0x800425C4 | 0x18 | T_800425C4 |

### Data Region 5: 0x80048190 - 0x80057DB8 (0xFC28) — data (partially GP-relative)

| Address | Size | Name |
|---------|------|------|
| 0x80048190 | 0x6660 | T_80048190 |
| 0x8004E7F0 | 0x28 | T_8004E7F0 |
| 0x8004E818 | 0x28 | T_8004E818 |
| 0x8004E840 | 0x9578 | T_8004E840 |

### Data Region 6: 0x80058268 - 0x8005845C (0x1F4) — sdata (GP-relative)

| Address | Size | Name |
|---------|------|------|
| 0x80058268 | 0x58 | T_80058268 |
| 0x800582C0 | 0xA0 | T_800582C0 |
| 0x80058360 | 0xA4 | T_80058360 |
| 0x80058404 | 0x58 | T_80058404 |

### Data Region 7: 0x80058688 - 0x80058C60 (0x5D8) — sdata (GP-relative)

| Address | Size | Name |
|---------|------|------|
| 0x80058688 | 0x5D8 | T_80058688 |

### Data Region 8: 0x800592DC - 0x80059B04 (0x828) — sdata (GP-relative)

| Address | Size | Name |
|---------|------|------|
| 0x800592DC | 0x22C | T_800592DC |
| 0x80059508 | 0x2BC | T_80059508 |
| 0x800597C4 | 0x340 | T_800597C4 |

### Data Region 9: 0x80059CB4 - 0x8005D124 (0x3470) — sdata (GP-relative)

| Address | Size | Name |
|---------|------|------|
| 0x80059CB4 | 0x2E54 | T_80059CB4 |
| 0x8005CB08 | 0x60 | T_8005CB08 |
| 0x8005CB68 | 0x60 | T_8005CB68 |
| 0x8005CBC8 | 0x60 | T_8005CBC8 |
| 0x8005CC28 | 0xB0 | T_8005CC28 |
| 0x8005CCD8 | 0x5C | T_8005CCD8 |
| 0x8005CD34 | 0x58 | T_8005CD34 |
| 0x8005CD8C | 0xA4 | T_8005CD8C |
| 0x8005CE30 | 0xA0 | T_8005CE30 |
| 0x8005CED0 | 0x58 | T_8005CED0 |
| 0x8005CF28 | 0x98 | T_8005CF28 |
| 0x8005CFC0 | 0x94 | T_8005CFC0 |
| 0x8005D054 | 0x90 | T_8005D054 |
| 0x8005D0E4 | 0x40 | T_8005D0E4 |

### Data Region 10: 0x8005D3D8 - 0x8005E800 (0x1428) — sdata (GP-relative)

| Address | Size | Name |
|---------|------|------|
| 0x8005D3D8 | 0x1428 | T_8005D3D8 |
