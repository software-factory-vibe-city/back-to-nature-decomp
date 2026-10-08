#include "common.h"
#include "game_types.h"
#include "psyq/stddef.h"
#include "psyq/libgte.h"
#include "psyq/libgpu.h"

void ovl_11_func_800BD1BC(s32 arg0);
void func_80015704();
void func_80015894(SomeStruct *arg0, s32 arg1);

s32 ovl_11_func_80109310(s32 *arg0) {
    s32 *temp_s1;
    s32 var_a1;
    s32 var_s3;

    DrawSync(0);
    ClearOTagR((u32 *) D_8005E3C0->field_120, 0x800);
    if ((*(u16 *) ((u8 *) arg0 + 0)) == 0x107) {
        (*(s32 *) ((u8 *) arg0 + 0x34)) &= 0xFFFF7FFF;
        (*(s32 *) ((u8 *) arg0 + 0x34)) &= 0xFF7FFFFF;
        var_a1 = 1;
        var_s3 = 0x1420;
    } else {
        (*(s32 *) ((u8 *) arg0 + 0x34)) |= 0x808000;
        var_a1 = 0;
        var_s3 = 0x23C8;
    }
    ovl_11_func_800BD1BC(var_a1);
    temp_s1 = arg0 + 0x1E;
    func_80015704((SpriteSourceData *) temp_s1, (SpriteDataHeader *) &D_8007F7F8);
    func_80015894((SomeStruct *) temp_s1, (s32) ((void *) ((u8 *) &D_8007F7F8 + var_s3)));
    (*(s16 *) ((u8 *) arg0 + 0xE0)) = 0;
    (*(s16 *) ((u8 *) arg0 + 0xE2)) = 0x1ED;
    (*(s16 *) ((u8 *) arg0 + 0xE4)) = 0x3C0;
    (*(s16 *) ((u8 *) arg0 + 0xE6)) = 0x180;
    (*(s16 *) ((u8 *) arg0 + 0xE8)) = 0x10;
    (*(s16 *) ((u8 *) arg0 + 0xEA)) = 0x1ED;
    (*(s16 *) ((u8 *) arg0 + 0xEC)) = 0x3E0;
    (*(s16 *) ((u8 *) arg0 + 0xEE)) = 0x180;
    return 0;
}
