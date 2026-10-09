#include "common.h"
#include "game_types.h"

typedef struct {
    char pad_0000[0x44D4];
    u16 field_44D4;
    char pad_44D6[0x78EC - 0x44D6];
    Ovl11D124Entry table[1];
} D8006C838SearchView;

s32 func_80012A34(s32 arg0);
s32 ovl_11_func_80110790(Ovl11D124Entry *arg0);
s32 ovl_11_func_80110838(Ovl11D124Entry *arg0);
s32 ovl_11_func_80110890(Ovl11D124Entry *arg0);

s32 ovl_11_func_80110658(s16 *arg0, s16 *arg1, s32 arg2, s32 arg3, s32 arg4) {
    D8006C838SearchView *view;
    Ovl11D124Entry *base;
    s32 count;
    s32 width;
    s32 (*check)(Ovl11D124Entry *);
    s32 i;
    s32 start;

    if (arg2 != 0) {
        base = &D_80071DFC[0][0];
        count = 0x465;
        width = 0x2D;
    } else {
        view = (D8006C838SearchView *)D_8006C838;
        if (view->field_44D4 == 0) {
            return 1;
        }
        base = view->table;
        count = 0x31;
        width = 7;
    }

    if (arg3 != 0) {
        check = ovl_11_func_80110790;
    } else if (arg4 != 0) {
        check = ovl_11_func_80110838;
    } else {
        check = ovl_11_func_80110890;
    }

    i = func_80012A34(count);
    start = i;
    do {
        if (check(base + i) != 0) {
            *arg0 = i % width;
            *arg1 = i / width;
            return 0;
        }
        if (++i >= count) {
            i = 0;
        }
    } while (i != start);
    return 1;
}
