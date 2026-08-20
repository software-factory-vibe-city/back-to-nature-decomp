#include "common.h"
#include "game_types.h"

s32 func_80013FC0(s32 arg0);
s32 func_80014250(s32 arg0);
void func_80014494(s32 arg0, s32 arg1, s32 arg2);
u8 GetFlag8005E274(void);

void func_80013CD0(void *arg0, s32 arg1) {
    Struct80013F90 *p = (Struct80013F90 *)arg0;
    s32 temp_a0_2;
    s32 temp_s0;
    s32 temp_v0;
    s32 temp_v1;
    s32 var_a0;
    s32 var_a0_2;
    s32 var_a1;
    s32 var_v1;
    s32 var_mask;
    u32 temp_18;
    u32 temp_2C;
    u32 temp_a0;
    u32 temp_v0_3;
    u32 temp_v0_4;
    u32 temp_v0_5;
    u32 temp_v0_6;
    u8 temp_v0_2;

    temp_s0 = arg1 & 0xFF;
    func_80014494(p->field_0x36, p->field_0x37, temp_s0);
    p->field_0x04 = ~func_80013FC0(temp_s0) & 0xFFFF;
    p->field_0x34 = func_80014250(temp_s0);

    if ((((D8006C838View *)&D_8006C838)->field_0C & 0x10000) && (arg0 == D_8005E3A8)) {
        if (p->field_0x04 & 0x800) {
            ((D8006C838View *)&D_8006C838)->field_1C->field_0 = 0x800;
        } else {
            temp_a0 = ((D8006C838View *)&D_8006C838)->field_1C->field_4;
            var_v1 = (temp_a0 >> 1) & 0x20;
            if (temp_a0 & 0x20) {
                var_v1 |= 0x40;
                var_mask = ~0x60;
            } else {
                var_mask = ~0x60;
            }
            temp_a0 &= var_mask;
            temp_a0 |= var_v1;
            p->field_0x04 = temp_a0;
            p->field_0x34 = 0;
        }
    }

    temp_v0 = p->field_0x0C;
    temp_v1 = p->field_0x04;
    temp_a0_2 = (temp_v0 ^ temp_v1) & temp_v1;
    p->field_0x08 = temp_a0_2;

    if (temp_v1 == temp_v0) {
        temp_v0_2 = GetFlag8005E274();
        var_a1 = 1;
        if ((u32)((temp_v0_2 - 2) & 0xFFFF) < 2U) {
            var_a1 = temp_v0_2;
        }
        temp_18 = (u32)((s32)p->field_0x18 / (s32)var_a1);
        var_a0 = (s32)p->field_0x1C / (s32)var_a1;
        if (var_a0 <= 0) {
            var_a0 = 1;
        }
        if (p->field_0x14 == 0) {
            p->field_0x00 = 0;
            temp_v0_3 = p->field_0x10 + 1;
            p->field_0x10 = temp_v0_3;
            if ((u32)temp_18 < temp_v0_3) {
                p->field_0x10 = 0U;
                p->field_0x14 = 1;
            }
        } else {
            temp_v0_4 = p->field_0x10 + 1;
            p->field_0x10 = temp_v0_4;
            if ((temp_v0_4 % (u32)var_a0) == 0) {
                p->field_0x00 = p->field_0x04;
            } else {
                p->field_0x00 = 0;
            }
        }
        temp_2C = (u32)((s32)p->field_0x2C / (s32)var_a1);
        var_a0_2 = (s32)p->field_0x30 / (s32)var_a1;
        if (var_a0_2 <= 0) {
            var_a0_2 = 1;
        }
        if (p->field_0x20 == 0) {
            p->field_0x24 = 0;
            temp_v0_5 = p->field_0x28 + 1;
            p->field_0x28 = temp_v0_5;
            if ((u32)temp_2C < temp_v0_5) {
                p->field_0x28 = 0U;
                p->field_0x20 = 1;
            }
        } else {
            temp_v0_6 = p->field_0x28 + 1;
            p->field_0x28 = temp_v0_6;
            if ((temp_v0_6 % (u32)var_a0_2) == 0) {
                p->field_0x24 = p->field_0x04;
            } else {
                p->field_0x24 = 0;
            }
        }
    } else {
        p->field_0x00 = temp_a0_2;
        p->field_0x24 = temp_a0_2;
        p->field_0x10 = 0U;
        p->field_0x14 = 0;
        p->field_0x28 = 0U;
        p->field_0x20 = 0;
    }
    p->field_0x0C = p->field_0x04;
}
