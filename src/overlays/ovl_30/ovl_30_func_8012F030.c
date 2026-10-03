#include "common.h"
#include "psyq/stddef.h"
#include "psyq/libgte.h"
#include "psyq/libgpu.h"

extern s32 D_8005E3B0;
extern RECT D_8013400C;

void ovl_30_func_8012F030(s32 arg0) {
    s32 tmp[2];
    u_long *src;
    CAPTURE_PREV_RET(phantom);

    src = (u_long *)(D_8005E3B0 + 0x4290);
    tmp[0] = phantom;
    if (arg0 == 0) {
        StoreImage(&D_8013400C, src);
    } else {
        LoadImage(&D_8013400C, src);
    }
    DrawSync(0);
}
