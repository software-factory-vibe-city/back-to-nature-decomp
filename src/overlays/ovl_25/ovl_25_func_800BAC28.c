#include "common.h"
#include "game_types.h"
#include "psyq/stddef.h"
#include "psyq/libgte.h"

s16 func_8001C0D4(FuncC0D4Args *arg0, VECTOR *arg1, VECTOR *arg2);

void ovl_25_func_800BAC28(void) {
    char *far_base;
    VECTOR v0;
    VECTOR v1;

    far_base = (char *)&D_8007AFF0;
    v0.vx = *(s16 *)(far_base + 0x253AC) + *(s16 *)(far_base + 0x253B4);
    v0.vy = *(s16 *)(far_base + 0x253AE);
    v0.vz = *(s16 *)(far_base + 0x253B0) + *(s16 *)(far_base + 0x253B8);
    v1.vx = *(s16 *)(far_base + 0x253B4);
    v1.vy = *(s16 *)(far_base + 0x253B6);
    v1.vz = *(s16 *)(far_base + 0x253B8);
    func_8001C0D4((FuncC0D4Args *)&D_800C0454, &v0, &v1);
}
