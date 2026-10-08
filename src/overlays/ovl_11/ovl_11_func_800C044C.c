#include "common.h"
#include "game_types.h"

extern u8 D_80128820;
extern s32 D_80125EB8;
extern SpriteSourceData D_80128A50;
extern s32 *D_80128A80;

void ovl_11_func_800BFF00(void);
void func_80015704();
void ovl_11_func_800C034C(u8 *arg0);

void ovl_11_func_800C044C(s16 arg0) {
    s16 temp_a0;
    s32 temp;
    s32 var_s3;
    s32 temp_a0_2;
    u16 temp_v1;
    u32 var_s1;
    u8 *var_s0;

    temp_a0 = arg0;
    temp = temp_a0 - 1;
    if ((u32) (temp & 0xFFFF) < 4U) {
        temp_a0 = temp;
        var_s3 = temp_a0 - 2;
        if (temp_a0 < 2) {
            var_s3 = temp_a0;
        }
        D_80128A80 = &D_80125EB8;
        ovl_11_func_800BFF00();
        func_80015704(&D_80128A50, (SpriteDataHeader *) &D_800977F8);
        var_s0 = &D_80128820;
        var_s1 = 0;
        do {
            (*(s16 *) ((u8 *) var_s0 + 4)) = (s16) (var_s3 + 0x19);
            if (temp_a0 == 1) {
                temp_v1 = (*(u16 *) ((u8 *) var_s0 + 0xC)) | 0x4000;
                (*(u16 *) ((u8 *) var_s0 + 0xC)) = temp_v1;
                if (!(var_s1 & 3)) {
                    (*(u16 *) ((u8 *) var_s0 + 0xC)) = (u16) (temp_v1 | 0x2000);
                }
                if (!(var_s1 & 7)) {
                    (*(s16 *) ((u8 *) var_s0 + 4)) = 0;
                }
            }
            if (temp_a0 == 3) {
                temp_a0_2 = (*(u16 *) ((u8 *) var_s0 + 0xC)) | 0x4000;
                (*(u16 *) ((u8 *) var_s0 + 0xC)) = (u16) (temp_a0_2 | 0x1000);
                if (!(var_s1 & 1)) {
                    (*(u16 *) ((u8 *) var_s0 + 0xC)) = (u16) (temp_a0_2 | 0x3000);
                }
            }
            ovl_11_func_800C034C(var_s0);
            var_s1 += 1;
            var_s0 += 0xE;
        } while (var_s1 < 0x28U);
    }
}
