#include "common.h"
#include "game_types.h"

extern Ovl23D87CView D_800BF87C;

void ovl_23_func_800B94D0(s32 arg0, s16 arg1, s16 arg2) {
    if (D_800BF87C.unk62C >= 0xC) {
        D_800BF87C.unk62C = 0;
    }
    D_800BF87C.unk5CC[D_800BF87C.unk62C].unk0 = arg0;
    D_800BF87C.unk5CC[D_800BF87C.unk62C].unk4 = arg1;
    D_800BF87C.unk5CC[D_800BF87C.unk62C].unk6 = arg2;
    D_800BF87C.unk62C++;
}
