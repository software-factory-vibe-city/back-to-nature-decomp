#include "common.h"

typedef struct {
    /* 0x00 */ s16 x;
    /* 0x02 */ s16 y;
    /* 0x04 */ s16 z;
} Ovl11Func800BDE84Vec;

void *ovl_11_func_800BDE84(u8 *arg0, s16 *arg1) {
    u32 i;
    s32 off;
    u8 *p;
    u8 *ret;
    Ovl11Func800BDE84Vec lo;
    Ovl11Func800BDE84Vec hi;

    for (i = 0, ret = arg0 + 0x10, p = arg0, off = 0; i < 0x32;
         ret += 0x2C, p += 0x2C, i++, off += 0x2C) {
        if (*(u16 *)(arg0 + off + 0x10) & 0x4000) {
            lo = *(Ovl11Func800BDE84Vec *)(p + 0x1E);
            hi = *(Ovl11Func800BDE84Vec *)(p + 0x24);
            if (lo.x < arg1[0] && arg1[0] < hi.x &&
                lo.z < arg1[2] && arg1[2] < hi.z &&
                lo.y - 0x80 < arg1[1] && arg1[1] < hi.y + 0x78) {
                return ret;
            }
        }
    }
    return 0;
}
