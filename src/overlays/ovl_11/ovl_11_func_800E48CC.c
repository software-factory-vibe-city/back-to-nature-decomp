#include "common.h"
#include "game_types.h"

/* Minimal view of the 0x18-byte position record whose +8/+0xC/+0x10
 * halfwords are the box centre. Only the witnessed fields are named. */
typedef struct {
    char pad_0[8];
    u16 field_8;
    u16 pad_A;
    u16 field_C;
    u16 pad_E;
    u16 field_10;
} Recon_ovl_11_func_800E48CC_A0View;

/* ovl_11_func_800F5888 only reads its first two arguments (the third is
 * unused), so the call is a two-argument call. */
s32 ovl_11_func_800F5888(u16 *arg0, s32 *arg1);
void func_80016054(s32 arg0, s32 arg1, s32 arg2, s32 arg3, u8 arg4, s16 arg5,
                   s16 arg6, s32 arg7, s32 arg8, u16 arg9);
void func_800158E4(SpriteSourceData *src);

void ovl_11_func_800E48CC(Recon_ovl_11_func_800E48CC_A0View *arg0,
                          SpriteSourceData *arg1) {
    s32 sp28[4];
    u16 sp38[3];

    sp38[0] = arg0->field_8 + 0x96;
    sp38[1] = arg0->field_C - 0x64;
    sp38[2] = arg0->field_10 - 0x96;
    if (ovl_11_func_800F5888(sp38, sp28) != 0) {
        func_80016054(D_8005E3C0->field_120 + ((sp28[2] >> 2) * 4),
                      D_8005E3C0->field_118, (s32) arg1, (s32) arg1->field_4,
                      (u8) (s32) arg1->field_5, (s16) sp28[0],
                      (s16) sp28[1], arg1->field_8, 0, 0x40);
    }
    if (!(D_8006C844 & 0x08000000)) {
        func_800158E4(arg1);
    }
}
