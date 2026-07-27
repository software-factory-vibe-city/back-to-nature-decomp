/* Update animation state and frame timing. */

#include "common.h"
#include "game_types.h"

typedef struct {
    /* 0x00 */ s16 field_0;
    /* 0x02 */ u16 field_2;
} Struct_T;

typedef struct {
    /* 0x00 */ char pad_0[6];
    /* 0x06 */ u8 field_6;
    /* 0x07 */ u8 field_7;
} Struct_A;

void func_800158E4(Struct_S *arg0) {
    Struct_T *temp_t0;
    Struct_A *temp_a0;
    u16 temp_t1;
    u32 temp_v1;
    u16 temp_a1;
    u32 temp_a2;
    u32 temp_v0;
    u32 temp_v1_2;
    u32 temp_a0_2;
    s32 temp_table_limit;

    if (!(arg0->field_0 & 4)) {
        temp_t0 = (Struct_T *)(arg0->field_28 + (arg0->field_4 * sizeof(Struct_T)));
        temp_a0 = (Struct_A *)(arg0->field_2C + temp_t0->field_2 + (arg0->field_5 * 0xA));
        temp_t1 = arg0->field_2 & 0xFCFF;
        temp_v1 = arg0->field_6 + 1;
        arg0->field_2 = temp_t1;
        arg0->field_6 = temp_v1;
        if ((s16)temp_v1 >= (s32)(temp_a2 = (u32)(temp_a0->field_6 + 1) >> 1)) {
            arg0->field_6 = 0;
            temp_v0 = ++arg0->field_5;
            temp_a1 = temp_t1 | 0x100;
            do {
                temp_table_limit = temp_t0->field_0;
            } while (0);
            if ((s32)(temp_v0 & 0xFF) >= temp_table_limit) {
                arg0->field_2 = temp_a1;
                temp_v1_2 = temp_a0->field_7;
                if (!(temp_v1_2 & 0x80)) {
                    arg0->field_5 = temp_v1_2 & 0x7F;
                    arg0->field_2 = (temp_a1 & 0xFEFF) | 0x200;
                }
            }
            temp_v1_2 = temp_a0->field_7;
            temp_a0_2 = temp_v1_2 & 0xFF;
            if (temp_a0_2 != 0) {
                if (temp_a0_2 == 0xFF) {
                    arg0->field_6 = temp_a2;
                    arg0->field_5 = arg0->field_5 - 1;
                    arg0->field_2 = arg0->field_2 | 0x100;
                } else if (temp_v1_2 & 0x80) {
                    arg0->field_5 = temp_v1_2 & 0x7F;
                    arg0->field_2 = (arg0->field_2 & 0xFEFF) | 0x200;
                }
            }
        }
        D_8005E43C = 1;
    }
}
