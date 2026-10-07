#include "common.h"
#include "game_types.h"
#include "psyq/stddef.h"

/* Callee prototypes as this caller TU saw them. The served callee is
 * declared with a u8 second parameter: the target's argument narrowing is a
 * bare `andi a1,v1,0xFF`, not the `sll/sra` pair an s8 parameter emits. */
u8 *ovl_11_func_800EFF04(s32 arg0, s32 arg1, s32 *arg2);
void func_80015840(ObjectState *obj, u8 arg1);
void func_80015114(u32 *arg0, s16 arg1, s16 arg2, s16 arg3, s16 arg4, s32 arg5, s16 arg6);
void func_80015BF0(s32 arg0, SpriteSourceData *arg1, s16 arg2, s16 arg3);

s32 ovl_11_func_800EE528(s16 arg0, s16 arg1) {
    s32 temp_v1;
    u8 *temp_v0;

    if ((u32) (arg1 & 0xFFFF) >= 0xAU) {
        return 0;
    }
    temp_v0 = ovl_11_func_800EFF04(0x24, (s32) arg0, NULL);
    temp_v1 = D_80129560[arg1];
    if (temp_v0[4] != temp_v1) {
        func_80015840((ObjectState *) temp_v0, temp_v1 & 0xFF);
    }
    func_80015114((u32 *) (D_8005E3C0->field_D8 + 0x10), 0, 0, 0x140, 0xF0, 0, 0);
    func_80015BF0(D_8005E3C0->field_D8 + 8, (SpriteSourceData *) temp_v0, 0x50, 0x3C);
    return 1;
}
