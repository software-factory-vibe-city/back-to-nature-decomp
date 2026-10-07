#include "common.h"
#include "game_types.h"
#include "psyq/stddef.h"

typedef struct {
    /* 0x00 */ char pad_00[0x26];
    /* 0x26 */ s16 unk26;
    /* 0x28 */ s16 unk28;
    /* 0x2A */ s16 unk2A;
    /* 0x2C */ s16 unk2C;
    /* 0x2E */ char pad_2E[0x34 - 0x2E];
    /* 0x34 */ s32 unk34;
    /* 0x38 */ char pad_38[0xB6 - 0x38];
    /* 0xB6 */ s16 unkB6;
} Struct_800DF010;

s32 ovl_11_func_800DF010(Struct_800DF010 *arg0, s32 arg1);
s32 ovl_11_func_8010B57C(u16 *arg0, s32 arg1);

extern Struct_800DF010 *D_80128C4C;
extern s32 D_80128C54;

void ovl_11_func_800C7650(void) {
    u32 temp_v1;

    temp_v1 = D_80128C54 & 0x206;
    switch (temp_v1) {                              /* irregular */
    case 0x4:
        /* fallthrough */
    case 0x2:
        if (D_80128C4C != NULL) {
            ovl_11_func_800DF010(D_80128C4C, 0);
            return;
        }
        return;
    case 0x200:
        if (D_80128C4C != NULL) {
            ovl_11_func_8010B57C(&D_80075AD4, 0);
        }
        break;
    }
}
