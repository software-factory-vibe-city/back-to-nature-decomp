#include "common.h"
#include "game_types.h"
#include "psyq/stddef.h"
#include "psyq/libgte.h"
#include "psyq/libgpu.h"


u_long *ClearOTagR (u_long *ot, int n);
int DrawSync (int mode);
void ovl_28_func_800B7E80 (void);
void func_800132F0 (s32 arg0, s32 arg1, s32 arg2);
void ovl_28_func_800B8B0C (void);
void func_800226F0 (void);
s32 func_80022DF8 (void);
void SetVal8005E2BC (s32 arg0);
void SetVal8005E334 (s32 arg0);

void ovl_28_func_800B7F30(void) {
    s32 *base;

    ovl_28_func_800B7E80();
    func_800132F0(0, 0, 2);
    ovl_28_func_800B8B0C();
    func_800226F0();
    base = (s32 *)&D_8006C838;
    base[0x1122] = base[0x1122] + 1;
}
