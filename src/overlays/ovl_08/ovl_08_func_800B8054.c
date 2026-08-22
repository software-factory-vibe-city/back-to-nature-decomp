#include "common.h"

/* Callees. common.h does not pull in functions.h or psyq headers; without
 * these declarations cc1 treats every call as an implicit-int call_value and
 * keeps a $v0 return web alive, corrupting allocation downstream. Real
 * signatures per vendored SDK (libgpu.h) and the callees' matched definitions. */
void func_8002206C(void);
void KanjiFntClose(void);
int KanjiFntOpen(int x, int y, int w, int h, int dx, int dy, int cx, int cy,
                 int isbg, int n);
void func_800132B8(s32 arg0, s32 arg1, s32 arg2);

void ovl_08_func_800B8054(void) {
    u8 *fnt;

    D_80070CC4 = 0;
    KanjiFntClose();
    KanjiFntOpen(8, 0, 0x140, 0xF0, 0x1C0, 0, 0x140, 0xFF, 0, 0xFF);
    func_800132B8(1, 0, 2);
    fnt = (u8 *)&D_8005E5E8[0];
    fnt[0x19] = 0x40;
    fnt[0x1A] = 0x40;
    fnt[0x1B] = 0x80;
    fnt += 0x134;
    fnt[0x19] = 0x40;
    fnt[0x1A] = 0x40;
    fnt[0x1B] = 0x80;
    func_8002206C();
    D_800B8500 += 1;
}
