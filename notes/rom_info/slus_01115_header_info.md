# SLUS_011.15 PSX EXE Header Analysis

**Source:** `./extracted/iso/slus_011.15`
**File size:** 323584 bytes (0x0004F000)

## Header Fields

| Offset | Field | Raw Value | Notes |
|--------|-------|-----------|-------|
| 0x00 | Magic | `PS-X EXE` | |
| 0x10 | initial_pc | `0x80011278` | Entry point |
| 0x14 | initial_gp | `0x00000000` | **Zero — must discover from code** |
| 0x18 | text_addr | `0x80010000` | RAM load address |
| 0x1C | text_size | `0x0004E800` | 321536 bytes |
| 0x20 | data_addr | `0x00000000` | Zero |
| 0x24 | data_size | `0x00000000` | Zero |
| 0x28 | bss_addr | `0x00000000` | Zero |
| 0x2C | bss_size | `0x00000000` | Zero |
| 0x30 | sp_base | `0x801FFFF0` | Initial stack pointer |
| 0x34 | sp_offset | `0x00000000` | Zero |

## Derived Values

| Value | Result |
|-------|--------|
| Payload offset in file | `0x00000800` (2048 bytes) |
| Load region | `0x80010000` — `0x8005E800` |
| Entry offset from load | `0x00001278` (4728 bytes into payload) |

## Reserved Region (0x38–0x4B)

```
00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00
```

## Marker Region (0x4C–0x7FF)

ASCII content found:
```
Sony Computer Entertainment Inc. for North America area
```

## GP Discovery Needed

The header `initial_gp` is zero. The GP value must be discovered from the startup code.

**Next steps:**
1. Examine the entry point at `0x80011278` for `lui $gp, 0xXXXX` / `addiu $gp, $gp, 0xXXXX`
2. Scan all code for GP-relative load/store instructions (`lw/sw reg, offset($gp)`)
3. The GP typically points 0x7FF0 bytes into .sdata, so `GP = sdata_start + 0x7FF0`
