#include "common.h"

typedef struct {
    /* 0x00 */ char pad_00[4];
    /* 0x04 */ u16 field_04;
    /* 0x06 */ char pad_06[0x18 - 0x06];
} PoolEntry4FC8; /* 0x18 */

typedef struct {
    /* 0x00 */ char pad_00[0x44F8];
    /* 0x44F8 */ s32 field_44F8;
    /* 0x44FC */ char pad_44FC[0xDDD4 - 0x44FC];
    /* 0xDDD4 */ PoolEntry4FC8 *field_DDD4;
    /* 0xDDD8 */ char pad_DDD8[0xE650 - 0xDDD8];
    /* 0xE650 */ u8 field_E650;
} D8006C838View4FC8;

void ovl_11_func_800F4FC8(void) {
    D8006C838View4FC8 *base = (D8006C838View4FC8 *)&D_8006C838;

    if (base->field_44F8 & 0x02000000) {
        PoolEntry4FC8 *entry = base->field_DDD4;

        base->field_44F8 &= 0xFDFFFFFF;
        entry += 1;
        entry->field_04 &= 0xFFFE;
        base->field_E650 = 0;
    }
}
