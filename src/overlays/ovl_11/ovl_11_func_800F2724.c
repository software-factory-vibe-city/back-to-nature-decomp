#include "common.h"
#include "game_types.h"
#include "psyq/memory.h"

void func_80022738(void);
s32 func_8002261C(s32 arg0, s32 arg1);

extern s32 D_80126C94;

s32 ovl_11_func_800F2724(void) {
    char *base;

    base = (char *)D_8006C838;
    if (*(s8 *)(base + 0x49E6) != -1) {
        func_80022738();
        if (func_8002261C((s32)(*(s8 *)(base + 0x49E6)), (s32)(*(s16 *)(base + 0x49E4))) == 0) {
            if ((*(s16 *)(base + 0x49E4)) == 0x19B) {
                D_80126C94 = 1;
            }
            memmove((u8 *)(base + 0x49E4), (u8 *)(base + 0x49E8), 0x4C);
            (*(s8 *)(base + 0x4A32)) = -1;
        }
        return 1;
    }
    return 0;
}
