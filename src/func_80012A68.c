#include "common.h"
#include "psyq/stddef.h"
#include "psyq/libgte.h"
#include "psyq/libgpu.h"

void func_80012A68(s32 arg0, s32 arg1, s32 arg2, s32 arg3, u8 arg4, u8 arg5, u8 arg6) {
    RECT rect;

    rect.x = (s16)arg0;
    rect.y = (s16)arg1;
    rect.w = (s16)arg2;
    rect.h = (s16)arg3;
    ClearImage(&rect, arg4, arg5, arg6);
    DrawSync(0);
}
