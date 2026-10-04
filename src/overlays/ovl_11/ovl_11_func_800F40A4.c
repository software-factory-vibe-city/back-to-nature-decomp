#include "common.h"

typedef struct {
    u16 field_0;
    u16 field_2;
    u16 field_4;
    char pad_06[0x12];
} Entry_800F53BC;

void ovl_11_func_800F53BC(s16 arg0, Entry_800F53BC *arg1);
void ovl_11_func_800F4AC0(s32 arg0);

void ovl_11_func_800F40A4(void) {
    char *base;
    Entry_800F53BC **p1;
    s16 *p2;
    s32 n;

    base = (char *)&D_8006C838;
    p1 = (Entry_800F53BC **)(base + 0xDD8C);
    p2 = (s16 *)(base + 0xDDD8);
    for (n = 0; n < 19; n++) {
        ovl_11_func_800F53BC(*p2, *p1);
        p1++;
        p2++;
    }
    ovl_11_func_800F4AC0(0);
}
