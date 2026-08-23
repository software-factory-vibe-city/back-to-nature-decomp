#include "common.h"
#include "psyq/stddef.h"
#include "psyq/libgte.h"
#include "psyq/libgpu.h"
#include "psyq/libetc.h"

/* The four environment structures are fields of one local so they pack at
   4-alignment (DRAWENV 0x5C, DISPENV 0x14), matching the target frame
   offsets 0x18/0x74/0x88/0xE4.  As four separate locals GCC 2.95 would
   8-align each BLKmode address-taken slot to BIGGEST_ALIGNMENT (8). */
typedef struct {
    DRAWENV draw0;
    DISPENV disp0;
    DRAWENV draw1;
    DISPENV disp1;
} EnvSet;

/* Callees not declared in functions.h, declared locally. */
void func_80013B04(void);
void func_80011EF0(s32 arg0);
/* ovl_10_func_800B8A5C is matched as void(void), but this call site passes
   &D_800BBB7C which the callee ignores; declared with an argument here so
   the call site emits the address load. */
void ovl_10_func_800B8A5C(char *arg0);
void ovl_10_func_800B8C14(void);

extern s32 D_800BB7C4;
extern char D_800BBB7C[];

s32 ovl_10_func_800B889C(void) {
    EnvSet env;
    DRAWENV *cur = 0;

    D_800BBA4C[0] = 1;
    D_800BBA4C[1] = 4;
    D_800BBA4C[2] = 1;
    D_800BBA4C[3] = 0;
    D_800BBA4C[4] = 0xD;
    D_800BBA4C[5] = 0x80;

    SetDefDrawEnv(&env.draw0, 0, 0, 0x280, 0xF0);
    SetDefDrawEnv(&env.draw1, 0, 0xF0, 0x280, 0xF0);
    SetDefDispEnv(&env.disp0, 0, 0xF0, 0x280, 0xF0);
    SetDefDispEnv(&env.disp1, 0, 0, 0x280, 0xF0);
    FntLoad(0x3C0, 0);
    SetDumpFnt(FntOpen(4, 0x14, 0x270, 0xF0, 0, 0x400));

    env.draw0.isbg = 1;
    env.draw1.isbg = 1;
    env.draw0.r0 = 0x3C;
    env.draw0.g0 = 0x78;
    env.draw0.b0 = 0x78;
    env.draw1.r0 = 0x3C;
    env.draw1.g0 = 0x78;
    env.draw1.b0 = 0x78;
    SetDispMask(1);
    VSync(0);

    if (D_800BB7C4 == 0) {
        do {
            cur = (cur == &env.draw0) ? &env.draw1 : &env.draw0;
            func_80013B04();
            ovl_10_func_800B8A5C(D_800BBB7C);
            ovl_10_func_800B8C14();
            FntFlush(-1);
            DrawSync(0);
            VSync(0);
            PutDispEnv((DISPENV *)((char *)cur + 0x5C));
            PutDrawEnv(cur);
        } while (D_800BB7C4 == 0);
    }

    func_80011EF0(0);
    return 0;
}
