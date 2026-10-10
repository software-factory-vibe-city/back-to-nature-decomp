#include "common.h"
#include "game_types.h"

extern s32 *D_80124FCC;
extern u32 D_8008F7F8;

s16 ovl_11_func_800DEEE0(Recon_ovl_11_func_800DEEE0_A0View *arg0);
void func_80015704(SpriteSourceData *out, SpriteDataHeader *header);
void func_80015868(Struct_800154CC *arg0, s16 arg1, s16 arg2, s16 arg3, s16 arg4);

s16 ovl_11_func_800DF228(Recon_ovl_11_func_800DEEE0_A0View *arg0) {
    s32 temp_v0;
    s32 var_s3;

    var_s3 = 0;
    temp_v0 = ovl_11_func_800DEEE0(arg0);
    switch (temp_v0) {
    case 0x160:
        (*(s16 *) ((u8 *) arg0 + 0)) = (s16) temp_v0;
        var_s3 = 1;
        break;
    case 0x161:
        (*(s16 *) ((u8 *) arg0 + 0)) = (s16) temp_v0;
        var_s3 = 2;
        break;
    case 0x162:
        (*(s16 *) ((u8 *) arg0 + 0)) = (s16) temp_v0;
        var_s3 = 2;
        break;
    }
    (*(s32 *) ((u8 *) arg0 + 0x34)) &= 0xFBFFFFFF;
    if ((*(u16 *) ((u8 *) arg0 + 0xB2)) != 0) {
        var_s3 = 4;
    }
    func_80015704((SpriteSourceData *) ((u8 *) arg0 + 0x78),
                  (SpriteDataHeader *) ((u8 *) &D_8008F7F8 + D_80124FCC[var_s3]));
    if (temp_v0 == 0x161) {
        (*(s32 *) ((u8 *) arg0 + 0x80)) = 0xCC8;
    }
    if ((*(u16 *) ((u8 *) arg0 + 0xAE)) != 0) {
        switch (temp_v0) {
        case 0x160:
            func_80015868((Struct_800154CC *) ((u8 *) arg0 + 0x78), 0, 0, 0, 3);
            break;
        case 0x161:
            func_80015868((Struct_800154CC *) ((u8 *) arg0 + 0x78), 0, 0, 0, 1);
            break;
        case 0x162:
            func_80015868((Struct_800154CC *) ((u8 *) arg0 + 0x78), 0, 0, 0, 1);
            break;
        }
        if ((*(u16 *) ((u8 *) arg0 + 0xB2)) != 0) {
            func_80015868((Struct_800154CC *) ((u8 *) arg0 + 0x78), 0, 0, 0x20, 0);
        }
    }
    return 0;
}
