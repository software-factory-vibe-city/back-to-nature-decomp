#include "common.h"
#include "game_types.h"
#include "psyq/stddef.h"
#include "psyq/libgte.h"


void func_80017A38 (s16 arg0, s16 arg1);
void func_80022580 (u32 *arg0, s32 arg1, s32 arg2, s32 arg3, s16 arg4, s16 arg5);
void func_80017B3C (s32 arg0, s32 arg1, s32 arg2, s32 arg3);
void func_80024A10 (s32 arg0, s16 arg1, s16 arg2, s16 arg3);
s16 *func_8001A970 (s32 arg0, s16 *arg1, s32 arg2);

extern u8 D_80051AF6[];
extern s16 D_800C5920;

void ovl_27_func_800B9124(void) {
    s32 temp_s2;
    u8 *base;

    temp_s2 = D_8005E3C0->field_D8 + 0x80;
    func_80017A38(0, 1);
    func_80022580((u32 *) (D_8005E3C0->field_D8 + 0x84), 1, 0x48, 0x38, 0xB0, 0x5A);
    func_80017B3C(temp_s2, (s32) ((u8 *) D_80051AF6 + *D_80054BBC), 0x4C, 0x3C);
    func_80017A38(0, 0);
    base = (u8 *) D_8006C838;
    func_80024A10(temp_s2, 0xAC, 0x48, *(s16 *) (base + 0x5246));
    D_800C5920 = 0x71;
    *(u16 *) func_8001A970((*(s16 *) (base + 0x5248)) + 1, (&D_800C5920 + 1), 2) = 0xFFFF;
    func_80017B3C(temp_s2, (s32) &D_800C5920, 0xBC, 0x48);
}
