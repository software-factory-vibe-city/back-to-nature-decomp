#include "common.h"

typedef struct {
    /* 0x00 */ s16 field_0;
    /* 0x02 */ s16 field_2;
    /* 0x04 */ s32 count;
    /* 0x08 */ s16 *list;
} Ovl11KeyEntry;

extern Ovl11KeyEntry *D_801278D8[3];

s32 ovl_11_func_80107BE4(s32 arg0, s16 arg1, s16 arg2) {
    Ovl11KeyEntry *entry;
    Ovl11KeyEntry **it;
    s16 *list;
    u32 i;
    s32 j;

    it = D_801278D8;
    for (i = 0; i < 3; i++) {
        entry = it[i];
        if (entry->field_0 == arg1 && entry->field_2 == arg2) {
            j = 0;
            if (entry->count > 0) {
                do {
                    if (entry->list[j] == arg0) {
                        return 1;
                    }
                    j++;
                } while (j < entry->count);
            }
        }
    }
    return 0;
}
