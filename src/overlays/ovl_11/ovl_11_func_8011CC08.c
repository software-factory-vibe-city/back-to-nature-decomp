#include "common.h"
#include "game_types.h"
#include "psyq/stddef.h"
#include "psyq/libgte.h"


s16 *func_8001A970 (s32 arg0, s16 *arg1, s32 arg2);
void func_800136D4 (u32 *arg0, s16 arg1, s16 arg2, s16 arg3, s16 arg4);
void func_80017B3C (s32 arg0, s32 arg1, s32 arg2, s32 arg3);
void ovl_11_func_8011CEE0 (u16 *dst);
void ovl_11_func_8011CF10 (u16 *dst);

extern s32 D_80071A5C;
extern s32 D_80071A60;
extern s16 D_8012D608;

void ovl_11_func_8011CC08(s32 arg0) {
    s16 var_s3;
    s16 var_s5;
    s32 temp_s0;
    s32 temp_s2;
    s32 var_a0;
    s32 var_s6;
    s16 var_s7;
    void (*var_s4)(u16 *);

    if (arg0 != 0) {
        var_a0 = D_80071A60;
        var_s6 = 0x76;
        var_s4 = ovl_11_func_8011CF10;
        var_s3 = 0xBB;
        var_s5 = 0x77;
        var_s7 = 0x22;
    } else {
        var_a0 = D_80071A5C;
        var_s6 = 0x6A;
        var_s4 = ovl_11_func_8011CEE0;
        var_s3 = 0xE3;
        var_s5 = 0x4F;
        var_s7 = 0x22;
    }
    temp_s0 = D_8005E3C0->field_D8 + 0x40;
    var_s4(func_8001A970(var_a0, &D_8012D608, 8));
    func_800136D4((u32 *) (D_8005E3C0->field_D8 + 0x44), var_s3, 0x10, var_s5, var_s7);
    temp_s2 = var_s3 | 4;
    func_80017B3C(temp_s0, (s32) ((void *) ((u8 *) D_8005175C + (*D_80054BC0 + var_s6))), temp_s2, 0x14);
    func_80017B3C(temp_s0, (s32) &D_8012D608, temp_s2, var_s7);
}
