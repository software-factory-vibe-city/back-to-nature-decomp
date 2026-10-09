#include "common.h"
#include "psyq/stddef.h"

void *ovl_11_func_800F213C(u16 *arg0, s32 arg1, u16 *arg2) {
    s32 a0;
    s32 s1;
    s32 s2;
    u16 v0;

    while (1) {
        s1 = 1;
        if (*arg0 == 0xFFFC) {
            arg0 += 1;
            if (*arg0 == 0xFFFB) {
                return NULL;
            }
            v0 = *arg0;
            return (void *) (arg1 + (v0 & 0xFFFC));
        }
        s2 = 0;
        arg0 += 1;
        for (;;) {
            a0 = func_8001AF44(*arg0 & 0x7FFF);
            if (*arg0 & 0x8000) {
                if (a0 != 0) {
                    a0 = 0;
                } else {
                    a0 = 1;
                }
            }
            if (a0 == 1) {
                arg0 += 1;
                v0 = *arg0;
                if (v0 != 0xFFFE) {
                    goto L17;
                }
                arg0 += 1;
                if (s2 != 0) {
                    goto L16;
                }
                v0 = *arg0;
                if (v0 == 0xFFFB) {
                    return NULL;
                }
                return (void *) (arg1 + (v0 & 0xFFFC));
            }
            arg0 += 1;
            v0 = *arg0;
            s2 = 1;
            if (v0 == 0xFFFE) {
                arg0 += 2;
                s1 = 0;
                v0 = *arg0;
            }
            if (v0 != 0xFFFB) {
                goto L17;
            }
        L16:
            arg0 += 1;
            s1 = 0;
        L17:
            if (s1 != 0) {
                continue;
            }
            break;
        }
    }
}
