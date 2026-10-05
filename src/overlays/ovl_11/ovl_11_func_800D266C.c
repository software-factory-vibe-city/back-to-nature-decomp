#include "common.h"

typedef struct {
    char pad_00[0x26];
    s16 field_26;
    char pad_28[0x34 - 0x28];
    s32 field_34;
} Ov11D266CFields;

/* Callee prototype as the original caller TU saw it: the trailing words are
 * plain words in the outgoing area. */
void ovl_11_func_800D05D0(s32 arg0, s32 arg1, s32 arg2, s32 arg3, s32 arg4);

void ovl_11_func_800D266C(Ov11D266CFields *arg0, u16 *arg1, s32 arg2) {
    char *base;
    s32 masked;

    masked = arg2 & 0xFFFF;
    if (*arg1 < 0x12C) {
        if (arg0->field_34 & 0x2000) {
            base = (char *)&D_8006C838;
            ovl_11_func_800D05D0((s32)arg0,
                                 *(s32 *)(base + 0x52C8),
                                 *(s32 *)(base + 0x52CC),
                                 *(s32 *)(base + 0x52D0),
                                 *(s32 *)(base + 0x52D4));
        }
        if (arg0->field_26 == masked) {
            *arg1 = *arg1 + 1;
        }
    } else {
        *arg1 = 0x12C;
    }
}
