#include "common.h"
#include "game_types.h"

extern void func_800129F4(void);
extern void func_80015D1C(s32 arg0, s32 arg1, s32 arg2, SpriteSourceData *arg3,
                          s16 arg4, s16 arg5);
extern int DrawSync(int mode);
extern void DrawOTag(unsigned long *p);
extern unsigned long *ClearOTagR(unsigned long *ot, int n);
extern void *PutDispEnv(void *env);
extern void *PutDrawEnv(void *env);

/* GP-relative in target -> tentative definitions (this TU owns them). */
s32 D_8005E2CC;
s32 D_8005E2D0;

/* Absolute lui/lw in target -> extern only (defined in func_80011370.c). */
extern s32 D_8005E3A4;

void func_8001B118(void) {
    char *ot;
    char *page;
    char *sp18;
    char *sp1C;
    struct_8005E3C0 *env;
    struct_8005E3C0 *env_base;

    ot = (char *)&D_8005F2E8;
    if ((D_8005E2CC != 0) && (D_8005E2D0 != 1)) {
        D_8005E2D0 = 1;
        DrawSync(0);
        func_800129F4();
        DrawOTag((unsigned long *)(ot + (D_8005E3A4 << 7) + 0x7C));

        env_base = (struct_8005E3C0 *)&D_8005E5E8;
        env = env_base;
        if (D_8005E3C0 == env_base) {
            env = (struct_8005E3C0 *)((char *)env_base + 0x134);
        }
        D_8005E3C0 = env;
        D_8005E3A4 = (env != env_base);
        PutDispEnv((void *)((char *)env + 0x5C));
        PutDrawEnv((void *)D_8005E3C0);

        page = ot + (D_8005E3A4 << 7);
        sp18 = (D_8005E3A4 * 0x280) + 0x100 + ot;
        sp1C = (D_8005E3A4 * 0x180) + 0x600 + ot;
        ClearOTagR((unsigned long *)page, 0x20);
        func_80015D1C((s32)page, (s32)&sp18, (s32)&sp1C,
                      (SpriteSourceData *)&D_8005F2B8, 0xA0, 0x78);
        D_8005E2D0 = 0;
    }
}
