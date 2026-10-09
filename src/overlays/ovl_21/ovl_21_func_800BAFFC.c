#include "common.h"
#include "game_types.h"
#include "psyq/stddef.h"
#include "psyq/libgte.h"

s32 func_8001DFD4 (s32 *arg0, SVECTOR *arg1);
void func_80015BF0 (s32 arg0, SpriteSourceData *arg1, s16 arg2, s16 arg3);
void func_800248E8 (s32 arg0, s16 arg1, s16 arg2, s16 arg3);

void ovl_21_func_800BAFFC(SpriteSourceData *arg0, u16 *arg1) {
    s32 temp_s1;

    D_800BCD18[0] = arg1[0] + 0x96;
    D_800BCD18[1] = arg1[1] - 0x64;
    D_800BCD18[2] = arg1[2] - 0x96;
    temp_s1 = D_8005E3C0->field_120 + ((func_8001DFD4(D_800BCD20, (SVECTOR *) D_800BCD18) >> 2) * 4);
    func_80015BF0(temp_s1, arg0, *(s16 *) ((u8 *) D_800BCD20 + 0), *(s16 *) ((u8 *) D_800BCD20 + 4));
    if ((arg0 == ((UnkStruct800C0448 *) D_800C0448)[0].unk30) || (arg0 == ((UnkStruct800C0448 *) D_800C0448)[1].unk30) || (arg0 == ((UnkStruct800C0448 *) D_800C0448)[2].unk30) || (arg0 == ((UnkStruct800C0448 *) D_800C0448)[5].unk30)) {
        func_800248E8(temp_s1, *(s16 *) ((u8 *) D_800BCD20 + 0), *(s16 *) ((u8 *) D_800BCD20 + 4), 0);
    }
}
