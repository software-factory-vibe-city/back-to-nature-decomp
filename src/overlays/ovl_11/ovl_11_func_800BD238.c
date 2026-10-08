#include "common.h"
#include "game_types.h"
#include "psyq/stddef.h"
#include "psyq/libgte.h"
#include "psyq/libgpu.h"
#include "psyq/memory.h"
#include "psyq/libcd.h"
#include "psyq/libetc.h"

void func_80014BCC(s32 arg0, s32 arg1, s32 arg2, s32 arg3, s32 arg4);

void ovl_11_func_800BD238(s32 arg0) {
    s32 *p;
    s32 temp_a1;
    s32 var_s1;
    char *base;
    char *state;

    base = (char *)&D_8007AFF0;
    state = base + 0x20000;
    if ((*(s16 *)(state + 0x5476) == 1) || (*(s16 *)(state + 0x5476) == 3)) {
        DrawSync(0);
        ClearOTagR((u_long *)D_8005E3C0->field_120, 0x800);
        var_s1 = 0xA20;
        p = &D_80122804[arg0];
        temp_a1 = p[0];
        func_80014BCC(0, temp_a1, p[1] - temp_a1, 0, D_8005E3B0 + 0x4290);
        if (arg0 != 0) {
            var_s1 = 0x838;
        }
        memcpy(base + 8, (void *)(D_8005E3B0 + 0x4290), var_s1);
        if (*(s16 *)(state + 0x5476) == 3) {
            func_80017200((u8 *)(D_8005E3B0 + 0x4290 + var_s1), -0x100, 0, 0, 0);
            return;
        }
        func_8001719C((u8 *)(D_8005E3B0 + 0x4290 + var_s1));
    }
}
