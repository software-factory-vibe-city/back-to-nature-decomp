#include "common.h"
#include "game_types.h"
#include "psyq/stddef.h"
#include "psyq/libgte.h"
#include "psyq/libsnd.h"

void ovl_25_func_800B93E4 (void);
s32 func_80013394 (void);
s32 func_8001FE6C (void);
void func_8001FAE8 (s32 arg0);
s32 func_8001FBBC (s16 arg0);
s32 func_80020B80 (s32 arg0, s32 arg1);
void func_80011EF0 (s32 arg0);
void ovl_25_func_800BBA30 (s16 arg0, s16 arg1, s16 arg2);

void ovl_25_func_800B81F4(void) {
    s32 var_s0;
    u8 *base;

    ovl_25_func_800B93E4();
    var_s0 = func_80013394() == 1;
    if (func_8001FE6C() == 0) {
        var_s0 = (var_s0 + 1) & 0xFF;
    }
    if (var_s0 == 2) {
        if (D_800C030C != -1) {
            func_8001FAE8((s32) D_800C030C);
        }
        func_8001FBBC(0);
        func_80020B80(2, 0);
        func_80020B80(1, 0);
        base = (u8 *)D_8006C838;
        *(s32 *)(base + 0x448C) = 0xFF;
        func_80011EF0(6);
        *(s32 *)(base + 0xC) |= 0x80000;
        ovl_25_func_800BBA30(0, 0, 0);
    }
}
