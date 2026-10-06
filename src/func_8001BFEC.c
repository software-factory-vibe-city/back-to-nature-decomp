#include "common.h"
#include "scratchpad.h"
#include "psyq/libgte.h"

void func_8001D6B8(void);
void func_8001C37C(const void *base, const void *elem);

s32 D_8005E2D4;
void *D_8005E4D8;

void func_8001BFEC(void **arg0) {
    s32 i;
    u_long *slot;

    D_8005E4D8 = *arg0;
    PushMatrix();
    if (D_8005E2D4 != 0) {
        SCRATCH_STACK_BEGIN(SCRATCH_STACK_SLOT);
        func_8001D6B8();
        SCRATCH_STACK_END();
    }
    i = 0;
    if (i < *(s32 *)((char *)D_8005E4D8 + 8)) {
        slot = SCRATCH_STACK_SLOT;
        do {
            SCRATCH_STACK_BEGIN(slot);
            func_8001C37C((char *)D_8005E4D8 + 0xC,
                         (char *)D_8005E4D8 + 0xC + i * 0x1C);
            SCRATCH_STACK_END();
        } while (++i < *(s32 *)((char *)D_8005E4D8 + 8));
    }
    PopMatrix();
}
