#include "common.h"
#include "game_types.h"

extern void func_80015704(SpriteSourceData *out, SpriteDataHeader *header);

/* D_8005E330 — this TU owns it (GP-relative in target). */
s32 D_8005E330;

/* Callback prototype: 5 arguments (4 register + 1 stack at 0x10($sp)). */
typedef void (*SpriteCallback)(s32, SpriteSourceData *, s16, s32, s32);

void func_800223D4(s32 arg0, SpriteCallback callback) {
    SpriteCallback cb;
    s32 temp_s3;
    s32 temp_a3;
    u32 temp_v1;
    s32 var_a1;
    s32 var_s0;
    s32 var_s2;

    func_80015704((SpriteSourceData *)&D_800A0728,
                  (SpriteDataHeader *)&D_800977F8);

    temp_v1 = (u32)D_8005E330 + 1;
    temp_s3 = (temp_v1 >> 2) - ((temp_v1 / 96) * 0x18);
    D_8005E330 = (s32)temp_v1;
    var_s2 = 0;
    cb = callback;
    var_a1 = 0;

    do {
        var_s0 = -0xC;
        temp_a3 = var_a1 - temp_s3;
        do {
            var_s2++;
            var_s2 = var_s2 & 3;
            cb(arg0,
               (SpriteSourceData *)&D_800A0728,
               D_80055974[var_s2],
               var_s0 - temp_s3,
               temp_a3);
            var_s0 += 0x18;
        } while (var_s0 < 0x158);
        var_a1 += 0x18;
    } while ((u32)var_a1 < 0x108);
}
