#include "common.h"
#include "game_types.h"
#include "globals_override.h"

void func_80024108(s32 arg0, s32 arg1);
s32 func_800226B0(void);
void func_80022738(void);

/* Pointee of D_8005E340: dword at +0 (masked with 0x5000), u16 at +4 (lhu). */
typedef struct {
    /* 0x0 */ s32 field_0;
    /* 0x4 */ u16 unk4;
} cursor_table_entry;

/* Pointee of D_8005E3A8 for the +0/+8 command-word dispatch. */
typedef struct {
    /* 0x0 */ s32 field_0;
    /* 0x4 */ char pad_4[0x4];
    /* 0x8 */ s32 field_8;
} command_word;

s16 D_8005E33A;
u16 D_8005E33C;
u16 D_8005E338;
cursor_table_entry *D_8005E340;

void func_80023910(void) {
    s32 temp_v1;
    command_word *gfx;

    func_80024108(0x3A7, D_8005E33C);
    if (func_800226B0() != 0) {
        gfx = (command_word *)D_8005E3A8;
        temp_v1 = gfx->field_8;
        if (temp_v1 == 0x40) {
            if (D_8005E33C == 0) {
                func_8001FABC(0);
                temp_v1 = 5;
                D_8005E338 = temp_v1;
                func_80022738();
                return;
            }
            goto block_5;
        }
        if (temp_v1 == 0x20) {
block_5:
            func_8001FABC(1);
            D_8005E33A = ((cursor_table_entry *)D_8005E340)->unk4;
            D_8005E338 = 2;
            func_80022738();
            return;
        }
        if (gfx->field_0 & 0x5000) {
            func_8001FABC(5);
            temp_v1 = D_8005E33C;
            temp_v1 += 1;
            temp_v1 &= 1;
            D_8005E33C = temp_v1;
        }
    }
}
