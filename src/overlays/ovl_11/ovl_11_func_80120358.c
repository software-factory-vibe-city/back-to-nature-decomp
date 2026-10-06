#include "common.h"

s32 func_80012A34(s32 arg0);

typedef struct {
    s32 unk0;
    s32 unk4;
    s32 unk8;
} Ovl11SelectArg;

s16 ovl_11_func_80120358(Ovl11SelectArg *arg0) {
    Ovl11D1285F4Entry *entry;
    s16 sel;
    u32 i;

    entry = D_801285F4;
    sel = D_80070D02;
    for (i = 0; i < 4; i++, entry++) {
        if (sel < entry->min) {
            continue;
        }
        if (entry->max < sel) {
            continue;
        }
        arg0->unk0 = func_80012A34(D_8012862C[arg0->unk8]) + 5;
        return *(s16 *)(arg0->unk8 * 2 + (u8 *)entry + 4);
    }
    return 0;
}
