#include "common.h"
#include "psyq/stddef.h"
#include "psyq/libgte.h"
#include "psyq/libgpu.h"
#include "psyq/libgs.h"
#include "psyq/libetc.h"
#include "psyq/kernel.h"
#include "psyq/libapi.h"
#include "psyq/libcd.h"
#include "psyq/libmcrd.h"
#include "psyq/libmcx.h"

/* Callees not in functions.h */
void func_8001FEA4(void);

/* func_80011EE8 is declared void in functions.h but all call sites pass
   an s32 argument (0 or 1). The callee body is empty and ignores it,
   but the caller must match the target argument setup. The return type is
   s32 because the target never allocates $v0 to a temporary born after this
   call — the call site carries a $v0 definition. */
s32 func_80011EE8(s32 arg0);

/* SDK callees declared in functions.h (not included to avoid type conflicts) */
void SetGfxOffset(s32 arg0, s32 arg1);
void SetGfxClip(s32 arg0, s32 arg1);
void SetVal8005E278(s32 arg0);
void ClearVal8005E2CC(void);

/* Game-specific callees (signatures from functions.h / target analysis) */
void func_80011270(void);
void func_80011C24(void);
void func_800120C8(void);
void func_80012298(s32 arg0);
void func_800128DC(s32 arg0, s32 arg1);
void func_80012A68(s32 arg0, s32 arg1, s32 arg2, s32 arg3, u8 arg4, u8 arg5, u8 arg6);
void func_800132B8(s32 arg0, s32 arg1, s32 arg2);
void func_800139FC(void);
void func_80013A24(void);
/* func_800145F0 ends with `addu $v0,$zero,$zero` before `jr $ra` — it
   returns 0, and the target's callers keep $v0 out of post-call temporaries. */
s32 func_800145F0(s32 arg0, s32 arg1, s32 arg2, s32 arg3);
void func_800147BC(void);
void func_80017A48(u32 arg0);
void func_80017A70(u32 arg0);
/* func_8001AFE0 overwrites $a0 before reading it and the target's call sites
   leave the delay slot empty — it takes no arguments. */
void func_8001AFE0(void);
void func_8001E160(void);
void func_8001EFA4(void);
void func_8001FCE4(void);
void func_8001FE00(s32 arg0);
void func_8001FE7C(void);
void func_80020818(void);
void func_80021DA8(void);
void func_80021FD0(void);

/* Globals accessed by this function */
/* D_80010098 / D_8001009C: the target loads these with the unsplit assembler
   macro (lui $a2,%hi / lw $a2,%lo($a2) — one register). That form needs a
   scalar declaration: at or below -G8 cc1 sets SYMBOL_REF_FLAG, so
   mips_check_split() leaves the address unsplit. A larger declaration clears
   the flag and cc1 splits the address across two registers instead, which no
   source shape or allocation can undo (local-alloc's combine_regs() only
   records register suggestions for reg-to-reg copies, so the HIGH temp can
   never be tied to $a2).
   These symbols sit 0x4E1DC from $gp, far outside the GP window;
   tools/build/fixSmallDataExterns.ts widens their `.extern` size so GNU as
   expands the macro absolutely instead of emitting an unlinkable
   R_MIPS_GPREL16. */
extern s32 D_80010098;
extern s32 D_8001009C;
s32 D_8005E27C;
s32 D_8005E284;
s32 D_8005E288;
s32 *D_8005E384;
s32 D_8005E388;
s32 D_8005E398;
u32 D_8005E39C;
s32 D_8005E3A4;
struct GfxObj *D_8005E3A8;
struct GfxObj *D_8005E3AC;
s32 *D_8005E3B4;
struct_8005E3C0 *D_8005E3C0;

/* D_8005E5D8 and D_8005E5E8 declared in globals_override.h as large arrays
   for absolute lui/lw addressing under -G8 */

/* Jump table for the main switch */
extern s32 jtbl_80010008[0x15];

/*
 * func_80011370 — game entry / main loop (557 target instructions)
 *
 * The function is the game's main entry: initialization followed by an
 * infinite loop with a 0x15-entry switch on D_8005E39C (game mode / scene).
 * Each case calls func_800145F0 (scene transition) and sets D_8005E384 (scene
 * data pointer); some also set D_8005E288 (one-shot flag) or D_80070CC0.
 * The D_8005E3B4 pointer toggles between D_8005E5D8 and D_8005E5D8 + 8.
 *
 * The switch tails are cross-jumped by the compiler into four shared blocks,
 * and which tail a case reaches is the primary evidence for its statement
 * list (0x8001198C / 0x80011B3C store D_8005E384 then clear D_8005E288;
 * 0x80011C04 stores D_80070CC0 and falls into 0x80011C10, which stores only
 * D_8005E384). Cases 2, 6, 14, 15, 19 and 20 reach a tail that does not clear
 * D_8005E288, so they must not end with that store.
 *
 * Byte-verified: `make check` matches the original payload. diffFunc reports
 * 551/557 masked and cannot escalate, because on the *target* side splat
 * renders three `j` and one `beqz` as label relocations and drops the %hi
 * relocation on two `lui`s; all six resolve to the same words after linking.
 */

void func_80011370(void) {
    char *env_base;
    char *buf;
    char *far_base;
    s32 *temp_s2;

    func_80011270();
    D_8005E3A8 = (struct GfxObj *)&D_8005E870;
    D_8005E3AC = (struct GfxObj *)((char *)&D_8005E870 + 0x38);
    D_8005E388 = 0;
    ResetCallback();
    CdInit();
    SetMem(2);
    VSync(3);
    VSync(3);
    VSync(3);
    VSync(3);
    VSync(3);
    VSync(3);
    VSync(3);
    VSync(3);
    VSync(3);
    VSync(3);
    func_80012A68(0, 0, 0x280, 0x1E0, 0, 0, 0);
    do {
    } while (DrawSync(1) != 0);
    func_8001FCE4();
    func_8001FEA4();
    SetVideoMode(0);
    ResetGraph(0);
    D_8005E39C = 0xD;
    func_800147BC();
    env_base = (char *)&D_8005E5E8;
    SetDefDrawEnv((DRAWENV *)env_base, 0, 0, 0x140, 0xF0);
    temp_s2 = (s32 *)(env_base + 0x134);
    SetDefDrawEnv((DRAWENV *)temp_s2, 0, 0xF0, 0x140, 0xF0);
    SetDefDispEnv((DISPENV *)(env_base + 0x5C), 0, 0xF0, 0x140, 0xF0);
    SetDefDispEnv((DISPENV *)(env_base + 0x190), 0, 0, 0x140, 0xF0);
    *(s16 *)(env_base + 0x8) = 0;
    *(s16 *)(env_base + 0xA) = 0;
    *(s16 *)(env_base + 0x13C) = 0;
    *(s16 *)(env_base + 0x13E) = 0xF0;
    *(s16 *)(env_base + 0x198) = 0;
    *(s16 *)(env_base + 0x64) = 0;
    *(s16 *)(env_base + 0x19A) = 0;
    *(s16 *)(env_base + 0x66) = 0;
    SetGraphDebug(0);
    VSync(3);
    VSync(3);
    InitGeom();
    SetGeomOffset(0, 0);
    SetGeomScreen(0x3E8);
    GsInitGraph(0x140, 0xF0, 0, 0, 0);
    GsDefDispBuff(0, 0, 0, 0);
    GsSetOffset(0, 0);
    GsSetDrawBuffOffset();
    GsInit3D();
    MemCardInit(0);
    MemCardStart();
    McxStartCom();
    func_800139FC();
    func_80013A24();
    func_80012A68(0, 0, 0x3FF, 0x1FF, 0xFF, 0xFF, 0xFF);
    VSyncCallback((void (*)(void))&D_80011334);
    buf = (char *)&D_8005E5D8;
    D_8005E3C0 = (struct_8005E3C0 *)temp_s2;
    D_8005E3A4 = (char *)temp_s2 != env_base;
    if (D_8005E3B4 == (s32 *)buf) {
        buf += 8;
    }
    D_8005E3B4 = (s32 *)buf;
    func_80012298(0);
    func_800120C8();
    func_8001EFA4();
    func_8001E160();
    func_80021DA8();
    func_8001FE7C();
    func_80020818();
    func_80017A48(3);
    func_80017A70(3);
    D_8005E398 = 0;

    while (1) {
        if (D_8005E398 == 1) {
            func_800128DC(1, 0);
        }
        func_80012298(0);
        if (D_8005E27C == 1) {
            func_80012A68(0, 0, 0x140, 0x1E0, 0, 0, 0);
        }
        SetGfxOffset(0x14, 7);
        SetGfxClip(0x14, 7);
        D_8005E284 = 1;

        if (D_8005E39C < 0x15) {
            switch (D_8005E39C) {
            case 0:
                func_80011EE8(1);
                func_800145F0(8, 9, D_80010098, D_80010098);
                D_8005E384 = &D_800B8014;
                D_8005E288 = 0;
                break;

            case 1:
                func_80011EE8(0);
                func_800145F0(0xA, 0xB, D_80010098, D_80010098);
                D_8005E288 = 0;
                D_8005E384 = &D_800B889C;
                break;

            case 2:
                if (D_8005E288 == 0) {
                    func_8001AFE0();
                    func_80011EE8(0);
                    func_800145F0(0xB, 0xC, D_80010098, D_80010098);
                    D_8005E288 = 1;
                    func_80021FD0();
                }
                D_8005E384 = &D_800BBC34;
                break;

            case 3:
                func_80012298(1);
                func_80011EE8(0);
                func_800145F0(0x11, 0x12, D_80010098, D_80010098);
                D_8005E384 = &D_800B7E38;
                D_8005E288 = 0;
                break;

            case 4:
                func_80011EE8(0);
                func_800145F0(0x13, 0x14, D_80010098, D_80010098);
                D_8005E384 = &D_800B7ED8;
                D_8005E288 = 0;
                break;

            case 5:
                func_80011EE8(0);
                func_800145F0(0x15, 0x16, D_80010098, D_80010098);
                D_8005E384 = &D_800B7E3C;
                D_8005E288 = 0;
                break;

            case 6:
                if (D_8005E288 == 0) {
                    func_80011EE8(0);
                    func_800145F0(0xB, 0xC, D_80010098, D_80010098);
                    D_8005E288 = 1;
                }
                SetVal8005E278(1);
                D_80070CC0 = 4;
                D_8005E384 = &D_800BBC34;
                break;

            case 7:
                func_80012298(1);
                func_800128DC(0, 1);
                func_80011EE8(0);
                func_800145F0(0xF, 0x10, D_8001009C, D_8001009C);
                D_80070CC4 = 0;
                D_8005E384 = &D_8012E2CC;
                break;

            case 8:
                func_80012298(1);
                func_800128DC(0, 1);
                func_80011EE8(0);
                func_800145F0(0xF, 0x10, D_8001009C, D_8001009C);
                D_80070CC4 = 0;
                D_8005E384 = &D_8012E520;
                break;

            case 10:
                func_80012298(1);
                func_800128DC(0, 1);
                func_80011EE8(0);
                func_800145F0(0xF, 0x10, D_8001009C, D_8001009C);
                D_80070CC4 = 0;
                D_8005E384 = &D_8012E7C8;
                break;

            case 11:
                func_80012298(1);
                func_80011EE8(0);
                func_800145F0(0x17, 0x18, D_80010098, D_80010098);
                D_8005E384 = &D_800B7EA4;
                D_8005E288 = 0;
                break;

            case 12:
                func_80011EE8(0);
                func_800145F0(0x19, 0x1A, D_80010098, D_80010098);
                D_8005E384 = &D_800B7EB4;
                D_8005E288 = 0;
                break;

            case 13:
                func_80011EE8(0);
                func_800145F0(0x1B, 0x1C, D_80010098, D_80010098);
                func_80021FD0();
                D_8005E384 = &D_800B7EEC;
                D_8005E288 = 0;
                break;

            case 14:
                if (D_8005E288 == 0) {
                    func_8001AFE0();
                    func_80011EE8(0);
                    func_800145F0(0xB, 0xC, D_80010098, D_80010098);
                    D_8005E288 = 1;
                }
                D_80070CC0 = 5;
                D_8005E384 = &D_800BBC34;
                break;

            case 15:
                if (D_8005E288 == 0) {
                    func_80011EE8(0);
                    func_800145F0(0xB, 0xC, D_8001009C, D_8001009C);
                    D_8005E288 = 1;
                }
                D_80070CC0 = 6;
                D_8005E384 = &D_800BBC34;
                break;

            case 16:
                func_80011EE8(0);
                func_800145F0(0x1C, 0x1D, D_80010098, D_80010098);
                func_80021FD0();
                D_8005E288 = 0;
                D_8005E384 = &D_800B7E24;
                break;

            case 17:
                if (D_8005E288 == 0) {
                    func_800145F0(0xB, 0xC, D_80010098, D_80010098);
                    D_8005E288 = 1;
                    ClearVal8005E2CC();
                }
                func_80012298(1);
                func_800128DC(0, 0);
                func_800145F0(0x1E, 0x1F, D_8001009C, D_8001009C);
                D_8005E384 = &D_8012F084;
                break;

            case 18:
                func_80011EE8(0);
                func_800145F0(0x1F, 0x20, D_80010098, D_80010098);
                func_80021FD0();
                D_8005E384 = &D_800B7FCC;
                D_8005E288 = 0;
                break;

            case 19:
                if (D_8005E288 == 0) {
                    func_80011EE8(0);
                    func_800145F0(0xB, 0xC, D_80010098, D_80010098);
                    D_8005E288 = 1;
                    D_80070CC0 = 4;
                } else {
                    func_8001FE00(0xA);
                    func_800132B8(0xA, 0, 2);
                    far_base = (char *)&D_8007AFF0;
                    *(s32 *)(far_base + 0x254A0) = 0;
                }
                D_8005E384 = &D_800BBC34;
                break;

            case 20:
                func_80011EE8(0);
                func_800145F0(0xB, 0xC, D_80010098, D_80010098);
                D_8005E288 = 1;
                func_80021FD0();
                D_80070CC0 = 7;
                D_8005E384 = &D_800BBC34;
                break;
            }
        }

        func_80011C24();
    }
}
