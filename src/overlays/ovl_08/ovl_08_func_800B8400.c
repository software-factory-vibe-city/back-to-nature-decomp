#include "common.h"
#include "game_types.h"

void func_8001B2CC(s32 arg0, s32 arg1);
void func_8001B3CC(s32 arg0);
int FntPrint();

extern char D_800B8008[];
extern s32 D_800B8608;

/* Menu counter display: PANDO=%d. */
void ovl_08_func_800B8400(void) {
    if (((SomeStruct *)D_8005E3A8)->field_0x8 & 8) {
        D_800B8608 = D_800B8608 + 1;
        D_800B8608 = (D_800B8608 < 0xB) ? D_800B8608 : 0;
    }
    if (((SomeStruct *)D_8005E3A8)->field_0x8 & 2) {
        D_800B8608 = D_800B8608 - 1;
        D_800B8608 = (D_800B8608 >= 0) ? D_800B8608 : 0xA;
    }
    if (((SomeStruct *)D_8005E3A8)->field_0x8 & 0x40) {
        func_8001B2CC(0, D_800B8608);
    }
    if (((SomeStruct *)D_8005E3A8)->field_0x8 & 0x80) {
        func_8001B3CC(0);
    }
    FntPrint(D_800B8008, D_800B8608);
}
