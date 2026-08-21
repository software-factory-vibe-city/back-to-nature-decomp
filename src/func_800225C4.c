#include "common.h"

/* Table of script/state entry points dispatched by the state byte at
 * D_8006C838.field_CC (rodata at 0x80010358, not owned by this TU). */
extern s32 (*D_80010358[])(void *);

s32 func_800225C4(void) {
    struct struct_8006C838_view *s;
    s32 st;
    s32 (*fn)(void *);

    s = (struct struct_8006C838_view *)&D_8006C838;
    st = s->field_CC;
    if (st == 0) {
        return 1;
    }
    fn = D_80010358[st];
    return fn(s);
}
