#include "common.h"
#include "game_types.h"
#include "psyq/stddef.h"
#include "psyq/libgte.h"


void ovl_19_func_800B847C (void);
void ovl_19_func_800B8544 (void);
s32 ovl_19_func_800B85F4 (void);

void ovl_19_func_800B843C(void) {
    (*(s32 *) ((u8 *) D_800BF4C0 + 0)) = 0;
    (*(s16 *) ((u8 *) D_800BF4C0 + 0x202)) = -1;
    (*(s16 *) ((u8 *) D_800BF4C0 + 0x204)) = -1;
    (*(s16 *) ((u8 *) D_800BF4C0 + 0xC)) = -1;
    ovl_19_func_800B847C();
    ovl_19_func_800B8544();
}
