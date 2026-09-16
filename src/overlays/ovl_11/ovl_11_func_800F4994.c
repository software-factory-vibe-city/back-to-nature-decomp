#include "common.h"

typedef struct {
    /* 0x00 */ s16 field_00;
    /* 0x02 */ char pad_02[0x08 - 0x02];
    /* 0x08 */ s32 field_08;
    /* 0x0C */ s32 field_0C;
    /* 0x10 */ s32 field_10;
} BoundsEntry4994; /* 0x14 */

typedef struct {
    /* 0x00 */ s32 field_00;
    /* 0x04 */ s32 field_04;
    /* 0x08 */ s32 field_08;
} BoundsArgs4994;

typedef struct {
    /* 0x00 */ char pad_00[0xDDD4];
    /* 0xDDD4 */ BoundsEntry4994 *field_DDD4;
} D8006C838View4994;

extern s32 D_80129634;

BoundsEntry4994 *ovl_11_func_800F4994(BoundsArgs4994 *arg0) {
    D8006C838View4994 *base = (D8006C838View4994 *)&D_8006C838;
    BoundsEntry4994 *entry;
    char *far_base;
    s16 cur;

    entry = base->field_DDD4;
    far_base = (char *)&D_8007AFF0;
    cur = *(s16 *)(far_base + 0x25476);
    if (cur == entry->field_00) {
        if (entry->field_0C - 20 < arg0->field_04 && arg0->field_04 < entry->field_0C + 20) {
            if (entry->field_08 - 200 < arg0->field_00 && arg0->field_00 < entry->field_08 + 200) {
                if (entry->field_10 - 200 < arg0->field_08 && arg0->field_08 < entry->field_10 + 200) {
                    D_80129634 = 3;
                    return entry;
                }
            }
        }
    }
    return 0;
}
