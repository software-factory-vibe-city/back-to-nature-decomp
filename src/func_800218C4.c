#include "common.h"
#include "psyq/stddef.h"
#include "psyq/libcd.h"

void func_800218C4(void) {
    s32 i;
    s32 t;
    void *ptr;

    for (i = 0; i < 4; i++) {
        t = i * 3;
        do {
            ptr = CdSearchFile(&D_8006C7D8 + (t << 1), (char *)D_80049A70[i]);
        } while (ptr == 0);
    }
}
