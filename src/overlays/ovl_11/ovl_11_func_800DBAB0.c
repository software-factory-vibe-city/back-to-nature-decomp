#include "common.h"
#include "game_types.h"
#include "psyq/stddef.h"
#include "psyq/libgte.h"


void func_8001AF70 (u16 arg0, u16 arg1);
s32 ovl_11_func_80118C6C (void);
s32 func_8001AF44 (u32 arg0);
s32 ovl_11_func_800DBEF8 (s32 arg0);
s32 ovl_11_func_800DBE30 (s32 arg0);
s32 ovl_11_func_800E3A3C (void);
void ovl_11_func_800DBE9C (void);

void ovl_11_func_800DBAB0(void) {
    u8 *base;
    u8 *w;
    s16 temp_s0;

    base = (u8 *) D_8006C838;
    if (!((*(s32 *) (base + 0x10)) & 0x1000)) {
        temp_s0 = *(s16 *) (base + 0x7A78);
        (*(void **) (base + 0x30)) = (void *) (base + 0x7A78);
        if (temp_s0 == -1) {
            func_8001AF70(2U, 0U);
            if ((ovl_11_func_80118C6C() == 0) && ((*(s16 *) (base + 0x51EE)) == 0)) {
                (*(s32 *) (base + 0x5234)) = (s32) ((*(s32 *) (base + 0x5234)) & 0xFF7FFFFF);
            }
            w = (u8 *) D_8006C838;
            (*(s32 *) (w + 0x4450)) = (s32) ((*(s32 *) (w + 0x4450)) & ~0x1000);
            return;
        }
        if ((temp_s0 != 0) || (func_8001AF44(2U) != 0) || (ovl_11_func_800DBEF8(0) == 0)) {
            ovl_11_func_800DBE30((s32) temp_s0);
        }
    }
}
