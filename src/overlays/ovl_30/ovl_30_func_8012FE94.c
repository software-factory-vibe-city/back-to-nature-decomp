#include "common.h"
#include "game_types.h"
#include "psyq/stddef.h"

void FntLoad(int tx, int ty);

int FntOpen(int x, int y, int w, int h, int isbg, int n);

void SetDumpFnt(int id);

void func_800183B8(s32 arg0, s32 arg1);

void ovl_30_func_8012FE94(void) {
    s32 callRet4;
    FntLoad(0x2C0, 0x100);
    callRet4 = FntOpen(0x18, 0, 0x100, 0xC8, 0, 0x200);
    SetDumpFnt(callRet4);
    func_800183B8(0x18, 0x18);
}
