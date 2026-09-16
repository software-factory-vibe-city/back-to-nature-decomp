#include "common.h"
#include "game_types.h"

extern UnkStruct80075BC4 D_80075BC4[6];

s32 ovl_11_func_801097F4(Ovl11Func801097F4Arg x) {
    s32 result;
    s32 i;
    UnkStruct80075BC4 *rec;
    UnkStruct80075BC4 **out;
    s16 sel;
    s32 r;
    s32 lo0;
    s32 hi0;
    s32 lo1;
    s32 hi1;

    result = 0;
    i = 0;
    rec = D_80075BC4;
    out = x.unk18;
    sel = x.unk10;
    r = x.unk14;
    lo0 = x.unk0 - r;
    hi0 = x.unk0 + r;
    lo1 = x.unk8 - r;
    hi1 = x.unk8 + r;
    do {
        if (rec->unk0 == 0x15B && sel == rec->unk30 && lo0 < rec->unk38 && rec->unk38 < hi0 && lo1 < rec->unk40 && rec->unk40 < hi1) {
            *out = rec;
            result = 1;
            break;
        }
        i++;
        rec++;
    } while (i < 6);
    return result;
}
