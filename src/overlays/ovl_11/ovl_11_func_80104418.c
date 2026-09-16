#include "common.h"

extern s32 D_8012CF20;

void ovl_11_func_80104418(s16 arg0, s16 *arg1) {
    s32 old;
    s32 limit;
    s32 value;

    old = *arg1;
    limit = old + D_8012CF20 / 50;
    if (limit >= 100) {
        limit = 99;
    }
    if (limit < 0) {
        limit = 0;
    }
    value = old + arg0;
    if (value < 0) {
        if (old == 0) {
            *arg1 = limit;
        } else {
            *arg1 = 0;
        }
    } else if (limit < value) {
        if (old == limit) {
            *arg1 = 0;
        } else {
            *arg1 = limit;
        }
    } else {
        *arg1 = value;
    }

    D_8012CF20 += old * 50;
    D_8012CF20 -= *arg1 * 50;
}
