#include "common.h"
#include "psyq/stddef.h"
#include "psyq/libgte.h"
#include "psyq/libgpu.h"

s32 func_8001FAB4(void);

typedef struct {
    s32 unk0;
    s16 unk4;
    s16 unk6;
    s16 unk8;
    s16 unkA;
    s16 unkC;
    s16 unkE;
    s16 unk10;
    s16 unk12;
} Func8001F664_Data;

void func_8001F664(Func8001F664_Data *arg0, u_long *arg1, s16 arg2, s32 arg3, s32 arg4, s32 arg5, s32 arg6, s32 arg7, s32 arg8) {
    RECT rect;
    s32 s5;

    arg0->unk0 = (u_long)arg1;
    arg0->unk4 = -2;
    arg0->unk8 = arg2;
    arg0->unk6 = 0;
    arg0->unkA = 0;
    s5 = func_8001FAB4();
    DrawSync(0);
    rect.x = arg3;
    rect.w = 0x10;
    rect.h = 1;
    rect.y = arg4 + s5;
    StoreImage(&rect, arg1);
    DrawSync(0);
    rect.x = arg5;
    rect.y = arg6 + s5;
    rect.w = 0x10;
    rect.h = 1;
    StoreImage(&rect, arg1 + 8);
    DrawSync(0);
    arg0->unkC = (s16)arg7;
    arg0->unkE = (s16)(arg8 + s5);
    arg0->unk10 = 0x10;
    arg0->unk12 = 1;
}
