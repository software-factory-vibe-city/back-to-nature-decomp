#include "common.h"
#include "game_types.h"

typedef struct {
    char pad[4];
    s32 unk4;
} M2C_D80124FCC_inner;

typedef struct {
    char pad[0x18];
    M2C_D80124FCC_inner *unk18;
} M2C_D80124FCC;

extern s32 D_8009A3F8;
extern M2C_D80124FCC D_80124FCC;

void func_80015704(SpriteSourceData *out, SpriteDataHeader *header);

s32 ovl_11_func_800CDE3C(u8 *arg0) {
    s32 temp_s2;
    u32 var_s1;
    u8 *var_a1;
    u8 *var_s0;
    u8 *var_s3;

    var_s1 = 0;
    var_a1 = arg0 + 0x128;
    do {
        (*(s32 *) ((u8 *) var_a1 + -8)) = (s32) (*(s32 *) ((u8 *) arg0 + 0x100));
        (*(s32 *) ((u8 *) var_a1 + -4)) = (s32) (*(s32 *) ((u8 *) arg0 + 0x104));
        var_s1 += 1;
        (*(s32 *) ((u8 *) var_a1 + 0)) = (s32) (*(s32 *) ((u8 *) arg0 + 0x108));
        var_a1 += 0x10;
    } while (var_s1 < 0xAU);
    var_s1 = 0;
    var_s3 = (u8 *) &D_8009A3F8;
    (*(s16 *) ((u8 *) arg0 + 0x32)) = 0;
    var_s0 = arg0 + 0x2D4;
    temp_s2 = D_80124FCC.unk18->unk4;
    do {
        func_80015704((SpriteSourceData *) var_s0, (SpriteDataHeader *) (temp_s2 + (s32) var_s3));
        var_s1 += 1;
        var_s0 += 0x34;
    } while (var_s1 < 5U);
    return 0;
}
