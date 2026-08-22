#include "common.h"
#include "game_types.h"
#include "psyq/stddef.h"
#include "psyq/libgte.h"
#include "psyq/libgpu.h"

/* Game callees (signatures from include/functions.h; local declaration per
 * project convention). */
s32 func_8001E0B8(s32 arg0, s32 arg1);
void func_8001F774(u16 *arg0, u16 *arg1, u16 *arg2, s32 arg3, s32 arg4);

void func_8001FA0C(GradientCmd *arg0, s32 arg1) {
    RECT rect;
    char *packet;
    char *src;

    rect.x = arg0->field_C;
    rect.y = arg0->field_E;
    rect.w = arg0->field_10;
    rect.h = arg0->field_12;
    packet = (char *)func_8001E0B8(0, 0x44);
    SetDrawLoad((DR_LOAD *)packet, &rect);
    src = (char *)arg0->field_0;
    func_8001F774((u16 *)(packet + 0x10), (u16 *)src, (u16 *)(src + 0x20),
                  arg1, arg0->field_8);
}
