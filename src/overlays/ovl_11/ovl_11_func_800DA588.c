#include "common.h"
#include "game_types.h"

extern s32 *D_80125528[];
extern u8 D_800957F8[];
extern SpriteSourceData D_80070400;

void func_80015704(SpriteSourceData *out, SpriteDataHeader *header);

void ovl_11_func_800DA588(s32 arg0) {
    SpriteSourceData *out;
    s32 n;
    s32 i;
    s32 off;

    n = *D_80125528[arg0];
    out = &D_80070400;
    if (n >= 0x2D) {
        n = 0x2C;
    }
    i = 0;
    if (n > 0) {
        do {
            off = i * 4;
            i += 1;
            off = (s32)((u8 *)D_80125528[arg0] + off);
            func_80015704(out, (SpriteDataHeader *)(((s32 *)off)[1] + (s32)D_800957F8));
            out += 1;
        } while (i < n);
    }
}
