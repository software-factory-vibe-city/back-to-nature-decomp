#include "common.h"

s32 ovl_11_func_800E3A94(void);

typedef struct {
    /* 0x0 */ u8 unk0;
    /* 0x1 */ u8 unk1;
    /* 0x2 */ u8 unk2;
    /* 0x3 */ u8 unk3;
} Ovl11Entry;

s32 ovl_11_func_800E9CE4(s16 arg0) {
    Ovl11Entry *p;

    p = (Ovl11Entry *)ovl_11_func_800E3A94();
    p->unk1 = ((Ovl11Entry *)D_80129560)[arg0].unk0;
    return 1;
}
