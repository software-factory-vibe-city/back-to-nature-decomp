#include "common.h"
#include "game_types.h"

/* func_80015704 ignores its third and fourth parameters, so this caller
 * passes only the output object and the sprite-data header. */
void func_80015704();
void func_80015868(Struct_800154CC *arg0, s16 arg1, s16 arg2, s16 arg3,
                   s16 arg4);

/* Scan the ten 0x30-byte D_80129230 records for a free slot (field +0x14
 * == 0) and, on the first free one, initialise it from the sprite-data
 * header, hand it to the display helper, and install arg1 at +2 of the
 * 0x18-stride side table pointed to by D_80074838[0x5DD0]. */
void ovl_11_func_800E516C(SpriteDataHeader *arg0, s32 arg1) {
    Ovl11E5230Entry *var_a2;
    Ovl11E5230Entry *var_s0;
    u8 *var_s2;
    s32 var_a0;
    s32 var_a1;
    s32 var_s1;

    var_a2 = D_80129230;
    var_a1 = 0;
    var_s2 = D_80074838;
    var_s1 = 0;
    var_s0 = var_a2;
    var_a0 = 0;
loop_1:
    var_a1 += 1;
    if (((Ovl11E5230Entry *) ((u8 *) var_a2 + var_a0))->unk14 == 0) {
        func_80015704(var_s0, arg0);
        func_80015868((Struct_800154CC *) var_s0, D_80129410, D_80129412,
                      D_80129410, (s16) (s32) D_80129412);
        *(s16 *) ((u8 *) (var_s1 + *(s32 *) (var_s2 + 0x5DD0)) + 2) = arg1;
        return;
    }
    var_s1 += 0x18;
    var_s0 += 1;
    var_a0 += 0x30;
    if (var_a1 >= 0xA) {
        return;
    }
    goto loop_1;
}
