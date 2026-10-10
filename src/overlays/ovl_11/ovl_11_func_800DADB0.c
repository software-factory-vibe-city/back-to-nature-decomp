#include "common.h"
#include "game_types.h"

typedef struct {
    char pad_0000[0x44D4];
    u16 field_44D4;
    char pad_44D6[0x78EC - 0x44D6];
    Ovl11D124Entry table[1];
} D8006C838SearchView;

s32 func_80012A34(s32 arg0);

s32 ovl_11_func_800DADB0(s16 *arg0, s16 *arg1, s32 arg2, Ovl11D124Entry *arg3, s32 arg4) {
    D8006C838SearchView *view;
    Ovl11D124Entry *base;
    s32 count;
    s32 width;
    s32 start;
    s32 matches;
    s32 i;

    if (arg2 != 0) {
        width = 0x2D;
        count = 0x465;
        base = &D_80071DFC[0][0];
    } else {
        view = (D8006C838SearchView *)D_8006C838;
        width = 7;
        if (view->field_44D4 == 0) {
            return 0;
        }
        count = 0x31;
        base = view->table;
    }

    start = func_80012A34(count);
    i = start;
    matches = 0;
    do {
        if (((arg4 & 1) || ((u16)arg3->unk0 == (u16)base[i].unk0)) &&
            ((arg4 & 2) || ((u16)arg3->unk2 == (u16)base[i].unk2)) &&
            ((arg4 & 4) || (arg3->unk4 == base[i].unk4))) {
            *arg0 = i % width;
            *arg1 = i / width;
            matches++;
            if ((arg4 & 8) == 0) {
                return matches;
            }
        }
        if (++i >= count) {
            i = 0;
        }
    } while (i != start);
    return matches;
}
