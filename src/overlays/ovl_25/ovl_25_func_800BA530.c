#include "common.h"
#include "game_types.h"
#include "psyq/stddef.h"
#include "psyq/libgte.h"


void func_80015840 (ObjectState *obj, s8 arg1);
void func_80015EE8 (s32 arg0, s32 arg1, s32 arg2, s32 arg3, s16 arg4, s16 arg5);
s32 func_80011F5C (s32 arg0);
void func_80011FD8 (s32 arg0);

extern ObjectState D_800C024C;

void ovl_25_func_800BA530(void) {
    ObjectState *temp_s0;

    func_80015840(&D_800C024C, 0);
    temp_s0 = &D_800C024C - 0x81;
    func_80015EE8(D_8005E3C0->field_D8 + 4, (s32) &D_800C024C, (s32) (*(u8 *) ((u8 *) temp_s0 + 0x40C)), (s32) (*(u8 *) ((u8 *) temp_s0 + 0x40D)), (s16) ((s32) ((HWD0 + ((u32) HWD0 >> 0x1F)) << 0xF) >> 0x10), (s16) ((s32) ((VWD0 + ((u32) VWD0 >> 0x1F)) << 0xF) >> 0x10));
}
