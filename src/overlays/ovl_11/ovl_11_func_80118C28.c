#include "common.h"

/* Entry in the D_80128298 {s16, s16} pair table. */
typedef struct {
    /* 0x00 */ s16 field_0;
    /* 0x02 */ s16 field_2;
} Ovl11Pair80118C28;

extern Ovl11Pair80118C28 D_80128298[];

s32 ovl_11_func_80118C28(s16 id) {
    Ovl11Pair80118C28 *entry = D_80128298;
    u32 i;

    for (i = 0; i < 14U; i++) {
        if (entry->field_0 == id) {
            return entry->field_2;
        }
        entry++;
    }
    return 0;
}
