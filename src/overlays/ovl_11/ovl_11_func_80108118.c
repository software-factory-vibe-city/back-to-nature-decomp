#include "common.h"
#include "game_types.h"
#include "psyq/stddef.h"
#include "psyq/libgte.h"


s32 ovl_11_func_801081A0 (s16 arg0, s16 arg1);
void ovl_11_func_8010822C (s16 arg0, s16 arg1);
void ovl_11_func_801082B0 (s16 x, s16 y);
void ovl_11_func_801082F8 (s16 arg0, s16 arg1, s16 arg2, s16 arg3);
s32 ovl_11_func_80108470 (s16 arg0, s16 arg1);
s32 ovl_11_func_80108594 (s16 arg0, s32 arg1);
s32 ovl_11_func_801084E0 (void);

void ovl_11_func_80108118(void) {
    char *base;

    base = (char *)D_8006C838;
    if (ovl_11_func_801081A0(*(s16 *) (base + 0xE4C8), (*(s16 *) (base + 0x44C0))) != 1) {
        ovl_11_func_8010822C(*(s16 *) (base + 0xE4CA), *(s16 *) (base + 0x44BA));
        ovl_11_func_801082B0(*(s16 *) (base + 0x44BA), *(s16 *) (base + 0x44BC));
        ovl_11_func_801082F8(*(s16 *) (base + 0x44B8), *(s16 *) (base + 0x44BA), *(s16 *) (base + 0x44BC), *(s16 *) (base + 0x44BE));
    }
}
