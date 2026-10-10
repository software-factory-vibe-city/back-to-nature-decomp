#include "common.h"
#include "game_types.h"
#include "psyq/stddef.h"
#include "psyq/libgte.h"

typedef struct {
    char pad_000[0x5246];
    s16 field_5246;
    s16 field_5248;
} Ovl11View800F0C70;

void ovl_11_func_800F0C70(void) {
    u32 i;
    Ovl11Rec80124E00 *src;
    struct_80076220 *rec;
    s16 idx;
    struct_80076220 *tab;
    s16 sentinel;

    for (i = 0; i < 7U; i++) {
        char *q = (char *)D_8006C838 + i * 0xF8;
        *(u16 *)(q + 0x8000 + 0x5EC4) = D_80124DE4[i].unk0;
        *(u16 *)(q + 0x8000 + 0x5EC6) = D_80124DE4[i].unk2 - 1;
    }
    for (i = 0; i < 5U; i++) {
        rec = &D_80076220 + D_80124E00[i].unk0;
        rec->unk24 = D_80124E00[i].unk2;
        rec->unk26 = D_80124E00[i].unk4;
    }
    for (i = 0; i < 5U; i++) {
        src = D_80124E1E + i;
        rec = &D_80076220 + src->unk0;
        if (((Ovl11View800F0C70 *)D_8006C838)->field_5246 == rec->unk24 &&
            ((Ovl11View800F0C70 *)D_8006C838)->field_5248 == rec->unk26) {
            rec->unk24 = src->unk2;
            rec->unk26 = src->unk4;
        }
    }
    sentinel = -1;
    tab = &D_80076220;
    src = D_80124E3C;
loop_10:
    idx = src->unk0;
    if (idx != sentinel) {
        rec = (struct_80076220 *)(idx * 0x1D4 + (u32)tab);
        rec->unk24 = src->unk2;
        rec->unk26 = src->unk4;
        src++;
        goto loop_10;
    }
}
