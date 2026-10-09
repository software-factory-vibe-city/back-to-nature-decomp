#include "common.h"
#include "game_types.h"
#include "psyq/stddef.h"
#include "psyq/libgte.h"
#include "psyq/libgpu.h"
#include "psyq/libcd.h"
#include "psyq/libetc.h"
#include "psyq/memory.h"

typedef struct {
    u16 unk0;
    u16 unk2;
    u16 unk4;
    u16 unk6;
} M2C_ovl11_800D6944_Tex;

typedef struct {
    u16 unk0;
    u16 unk2;
    u8 pad[8];
} M2C_ovl11_800D6944_Ref;

void ovl_11_func_800D6944(SpriteSourceData *arg0, u16 *arg1, s16 arg2, s16 arg3, s16 arg4, s16 arg5, s16 arg6) {
    s32 sp10;
    M2C_ovl11_800D6944_Tex *temp_s0;
    s32 var_s3;
    M2C_ovl11_800D6944_Tex *temp_a3;
    u16 temp_t0;
    u16 temp_v0;
    M2C_ovl11_800D6944_Tex *temp_s0_2;
    M2C_ovl11_800D6944_Ref *var_s2;

    var_s2 = (M2C_ovl11_800D6944_Ref *)((u8 *)arg1 + ((arg2 * 0xC) - 0xC));
    var_s3 = arg2 - 1;
    sp10 = arg3;
    for (; var_s3 >= 0; var_s3--, var_s2 = (M2C_ovl11_800D6944_Ref *)((u8 *)var_s2 - 0xC)) {
        temp_s0 = (M2C_ovl11_800D6944_Tex *)arg0->field_1C;
        temp_a3 = temp_s0 + var_s2->unk0;
        temp_t0 = var_s2->unk2;
        temp_v0 = temp_a3->unk0;
        D_80128D80.x = temp_v0 + arg0->field_C;
        D_80128D80.y = temp_a3->unk2 + arg0->field_E;
        D_80128D80.w = temp_a3->unk4;
        temp_s0_2 = temp_s0 + temp_t0;
        D_80128D80.h = temp_a3->unk6;
        MoveImage((RECT *)&D_80128D80, sp10, arg4);
        D_80128D80.x = temp_s0_2->unk0 + arg0->field_10;
        D_80128D80.y = temp_s0_2->unk2 + arg0->field_12;
        D_80128D80.w = 0x10;
        D_80128D80.h = 1;
        MoveImage((RECT *)&D_80128D80, arg5, arg6);
    }
}
