#include "common.h"
#include "psyq/libmcrd.h"
#include "psyq/memory.h"

void ovl_15_func_8013468C(void);

extern u8 D_8007BFF8[];
extern s8 D_80137584;
extern s8 D_80137585;
extern s8 D_80137586;
extern s8 D_80137587;
extern s8 D_80137588;
extern s16 D_8013758A;
extern s16 D_8013758C;
extern s16 D_8013758E;
extern s16 D_80137590;
extern s16 D_80137594[];
extern s16 D_80137598;
extern s16 D_8013759A;
extern u8 *D_801376D0;
extern u8 D_801376E0[];
extern u8 D_801377A0[];
extern s16 D_80137820[];
extern u8 *D_80137828;
extern u8 D_80137830[];

void ovl_15_func_8012E15C(void) {
    s32 sp10;
    s32 sp14;
    s32 var_v1;
    u16 fill;
    u8 *temp_s0;
    u8 *var_s1;
    u8 *var_s2;

    MemCardSync(0, &sp10, &sp14);
    var_s1 = D_801376E0;
    D_80137584 = 0;
    D_80137585 = 0;
    D_80137586 = 0;
    D_80137587 = 0;
    D_80137588 = 0;
    D_80137598 = 0;
    D_8013758A = 0;
    D_8013758C = 2;
    D_8013758E = 0;
    D_80137590 = 0;
    D_80137594[0] = 4;
    D_80137594[1] = 4;
    D_80137820[0] = 2;
    D_80137820[1] = 2;
    D_80137820[2] = 2;
    D_8013759A = 0;
    D_80137828 = D_8007BFF8;
    memset(D_801376E0, 0, 0x3C);
    memset(D_801376E0 + 0x3C, 0, 0x3C);
    memset(D_801376E0 + 0x78, 0, 0x3C);
    memset(D_80137830, 0, 0x9690);
    memset(D_801377A0, 0, 0x80);
    temp_s0 = D_80137830 + 0x280;
    ovl_15_func_8013468C();
    D_801376D0 = temp_s0;
    memset(temp_s0, 0, 0x6378);
    var_s2 = D_801376E0;
    fill = 0xFFFF;
    for (var_v1 = 2; var_v1 >= 0; var_v1--) {
        (*(u16 *) ((u8 *) var_s2 + 8)) = fill;
        (*(u16 *) ((u8 *) var_s2 + 0x18)) = fill;
        (*(u16 *) ((u8 *) var_s2 + 0x1A)) = fill;
        (*(u16 *) ((u8 *) var_s2 + 0x2A)) = fill;
        var_s2 += 0x3C;
    }
}
