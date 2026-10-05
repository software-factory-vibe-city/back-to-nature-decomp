#include "common.h"

typedef struct {
    s16 unk0;
    s16 unk2;
    s32 unk4;
} Rec;

extern Rec D_80140F90[2][5];
extern u8 D_80142550[];

void ovl_15_func_80134724(void);

void ovl_15_func_8013468C(void) {
    s16 i;
    s16 j;

    ovl_15_func_80134724();
    for (i = 0; i < 2; i++) {
        for (j = 0; j < 5; j++) {
            D_80140F90[i][j].unk0 = -1;
            D_80140F90[i][j].unk2 = -1;
            D_80140F90[i][j].unk4 = 0;
        }
    }
    memset(D_80142550, 0, 0x398);
}
