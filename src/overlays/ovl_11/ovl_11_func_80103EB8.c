#include "common.h"
#include "globals_override.h"

void func_80022580(u32 *arg0, s32 arg1, s32 arg2, s32 arg3, s16 arg4, s16 arg5);
void func_80017B3C(s32 arg0, s32 arg1, s32 arg2, s32 arg3);
s16 *func_8001A970(s32 arg0, s16 *arg1, s32 arg2);
void func_8001ABF0(u16 *dst, u16 *src);

void ovl_11_func_80103EB8(void) {
    s32 temp_s3;
    s32 temp_s3_2;

    temp_s3 = D_8005E3C0->field_D8;
    temp_s3_2 = temp_s3 + 0x58;
    func_80022580((u32 *)(temp_s3 + 0x5C), 0, 0xE3, 0x10, 0x47, 0x1E);
    func_80017B3C(temp_s3_2, (s32)((u8 *)D_800517C6 + D_80054BBC[1]), 0xE5, 0x12);
    func_8001ABF0(func_8001A970(D_8012CF20, D_8012CF30, 7),
                  (u16 *)((u8 *)D_800517C6 + 0x42 + D_80054BBC[1]));
    func_80017B3C(temp_s3_2, (s32)D_8012CF30, 0xE5, 0x20);
}
