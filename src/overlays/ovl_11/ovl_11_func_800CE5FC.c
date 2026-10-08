#include "common.h"
#include "game_types.h"

extern s32 D_80123154;
extern s16 D_80070CF2;

/* Callee prototypes as the original caller TU saw them. */
void func_80015704(SpriteSourceData *out, SpriteDataHeader *header);
s32 ovl_11_func_800D688C(s16 arg0);

void ovl_11_func_800CE5FC(void) {
    s32 header;

    D_80123154 = 0;
    if (D_80070CF2 == 3) {
        header = ovl_11_func_800D688C(0x187);
        if (header != 0) {
            D_80123154 = 1;
            func_80015704(&D_80128D00, (SpriteDataHeader *)header);
        }
    }
}
