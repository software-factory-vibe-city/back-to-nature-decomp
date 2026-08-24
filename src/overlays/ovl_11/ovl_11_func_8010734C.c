#include "common.h"

/* Object whose field at 0x0A is compared against arg0. */
typedef struct {
    /* 0x00 */ char pad_00[0x0A];
    /* 0x0A */ s16 field_A;
} Ovl11Inner;

/* Entry in the D_8012CF48 table (0x18 bytes each). */
typedef struct {
    /* 0x00 */ u16 field_0;
    /* 0x02 */ char pad_02[0x12];
    /* 0x14 */ Ovl11Inner *field_14;
} Ovl11Entry;

extern Ovl11Entry D_8012CF48[];

u16 ovl_11_func_8010734C(s32 id) {
    Ovl11Entry *entry = D_8012CF48;
    u32 i;

    for (i = 0; i < 10U; i++) {
        if (entry->field_14->field_A == id) {
            return entry->field_0;
        }
        entry++;
    }
    return 0;
}
