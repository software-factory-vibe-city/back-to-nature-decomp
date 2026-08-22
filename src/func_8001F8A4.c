#include "common.h"
#include "game_types.h"
#include "psyq/stddef.h"
#include "psyq/libgte.h"
#include "psyq/libgpu.h"

/* Game callees (signatures from include/functions.h; local declaration per
 * project convention). */
s32 func_8001E0B8(s32 arg0, s32 arg1);
void func_8001F774(u16 *arg0, u16 *arg1, u16 *arg2, s32 arg3, s32 arg4);

void func_8001F8A4(GradientCmd *arg0, s32 arg1, s32 arg2) {
    RECT rect;
    char *packet;
    char *src;
    s16 cur8;
    u16 cur8u;

    if (arg0->field_8 > 0) {
        if (arg0->field_A < 0) {
            arg0->field_A = 0;
        }
        if (arg0->field_4 < 0) {
            arg0->field_4 = 0;
        }
        cur8 = arg0->field_8;
        cur8u = (u16)arg0->field_8;
        if (cur8 < arg1) {
            arg1 = cur8;
        }
        if (arg2 == 1) {
            if (arg0->field_4 != 0) {
                arg0->field_A = (s16)((u16)arg0->field_A - arg1);
                if (arg0->field_A < 0) {
                    arg0->field_A = 0;
                    arg0->field_4 = 0;
                }
            } else {
                arg0->field_A = (s16)((u16)arg0->field_A + arg1);
                if (cur8 < arg0->field_A) {
                    arg0->field_A = cur8u;
                    arg0->field_4 = arg2;
                }
            }
        } else {
            s32 s = (u16)arg0->field_A + arg1;
            arg1 = s;
            arg0->field_A = (s16)s;
            if ((s16)s < cur8) {
            } else {
                arg0->field_A = s - cur8u;
            }
        }
        rect.x = arg0->field_C;
        rect.y = arg0->field_E;
        rect.w = arg0->field_10;
        rect.h = arg0->field_12;
        packet = (char *)func_8001E0B8(0, 0x44);
        SetDrawLoad((DR_LOAD *)packet, &rect);
        src = (char *)arg0->field_0;
        func_8001F774((u16 *)(packet + 0x10), (u16 *)src, (u16 *)(src + 0x20),
                      arg0->field_A, arg0->field_8);
    }
}
