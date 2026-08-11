#include "common.h"

s32 ratan2(s32, s32);                               /* extern */

s16 func_80014388(s32 arg0, s32 arg1) {
    u8 s1;
    u8 s0;
    s32 dx;
    s32 dy;
    s32 ax;
    s32 ay;
    s32 angle;
    s32 v;
    s32 c;

    s1 = arg0 & 0xFF;
    s0 = arg1 & 0xFF;
    if ((u32) (s1 - 0x5C) < 0x49U && s0 < 0xA5U) {
        if (s0 >= 0x5CU) {
            s1 = 0x80;
            s0 = 0x80;
        }
    }
    if (s1 == 0x80) {
        if (s0 == 0x80) {
            return -1;
        }
    }
    dx = s1 - 0x80;
    ax = dx < 0 ? -dx : dx;
    dy = s0 - 0x80;
    ay = dy < 0 ? -dy : dy;
    if (ay != 0) {
        if (ax != 0) {
            angle = ratan2(ax, ay) * 3;
            v = angle * 0x78;
            if (v < 0) {
                angle = (v + 0xFFF) >> 0xC;
            } else {
                angle = v >> 0xC;
            }
        } else {
            angle = 0;
        }
    } else {
        angle = 0x5A;
    }
    if (s1 >= 0x80) {
        if (s0 < 0x81) {
            goto done;
        } else {
            c = 0xB4;
        }
    } else {
        if (s0 < 0x81) {
            c = 0x168;
        } else {
            angle += 0xB4;
            goto done;
        }
    }
    angle = c - angle;
done: ;
    if (angle == 0x168) {
        angle = 0;
    }
    return (s16) angle;
}
