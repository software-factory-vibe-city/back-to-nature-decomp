#include "common.h"

extern char *strcpy();
extern s32 D_80137680[];

void ovl_15_func_80137544(char *arg0, s32 arg1) {
    if ((u32)arg1 >= 4U) {
        arg1 = 0;
    }
    strcpy(arg0, (char *)D_80137680[arg1]);
}
