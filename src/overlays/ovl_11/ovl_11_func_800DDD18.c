#include "common.h"

s32 func_8001AF44(u32 arg0);

typedef struct {
    /* 0x00 */ u8 pad[0x28];
    /* 0x28 */ u16 unk28;
} Ovl11FuncDDD18Entry;

void ovl_11_func_800DDD18(void) {
    if (D_801291A8[0] != 0) {
        if (func_8001AF44(0x72) == 1) {
            ((Ovl11FuncDDD18Entry *)D_801291A8[1])->unk28 &= 0xEFFF;
            ((Ovl11FuncDDD18Entry *)D_801291A8[0])->unk28 |= 0x1000;
        } else {
            ((Ovl11FuncDDD18Entry *)D_801291A8[0])->unk28 &= 0xEFFF;
            ((Ovl11FuncDDD18Entry *)D_801291A8[1])->unk28 |= 0x1000;
        }
    }
}
