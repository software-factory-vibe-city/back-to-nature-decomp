#include "common.h"

s32 ovl_11_func_800DBE9C(void);

typedef struct {
    char pad_0[0x30];
    s32 *field_30;
} D8006C838ViewBEF8;

s32 ovl_11_func_800DBEF8(void) {
    char *base;
    char *far_base;
    s32 *p;

    base = (char *)&D_8006C838;
    far_base = (char *)&D_8007AFF0;
    p = ((D8006C838ViewBEF8 *)base)->field_30;
    if (*(s16 *)((char *)p + 4) == *(s16 *)(far_base + 0x25476)) {
        return 0;
    }
    func_8001AF70(2, 0);
    *(s32 *)(base + 0x7A74) = 0;
    ovl_11_func_800DBE9C();
    return 1;
}
