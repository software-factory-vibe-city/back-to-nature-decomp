#include "common.h"
#include "game_types.h"

extern s32 *D_80124FE4;
extern s32 D_8009A3F8;

void func_80015704(SpriteSourceData *out, SpriteDataHeader *header);
s32 ovl_11_func_800E2718(void *arg0);

s32 ovl_11_func_800E2A30(s16 *arg0) {
    s32 temp_v0;
    s32 index;
    s32 var_v0;

    temp_v0 = ovl_11_func_800E2718(arg0);
    index = 1;
    if (temp_v0 != 0x109) {
        if (temp_v0 != 0x10A) {
            return -1;
        }
        *arg0 = temp_v0;
    } else {
        *arg0 = temp_v0;
        index = 2;
    }
    func_80015704((SpriteSourceData *)((char *)arg0 + 0x78),
                  (SpriteDataHeader *)(D_80124FE4[index] + (s32)&D_8009A3F8));
    var_v0 = 0;
    return var_v0;
}
