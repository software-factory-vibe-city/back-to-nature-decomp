#include "common.h"
#include "globals_override.h"

void func_80022580(u32 *arg0, s32 arg1, s32 arg2, s32 arg3, s16 arg4, s16 arg5);
void func_80017B3C(s32 arg0, s32 arg1, s32 arg2, s32 arg3);
void func_80024A10(s32 arg0, s16 arg1, s16 arg2, s16 arg3);
void func_8001AAF4(s16 arg0, s16 arg1, s32 arg2, s16 arg3, s16 arg4);

/* Pointee of D_8005E340: cursor table entry with a signed halfword at +2
   (lh in target) and an unsigned halfword at +4 (lhu in target). */
typedef struct {
    /* 0x0 */ char pad_0[0x2];
    /* 0x2 */ s16 unk2;
    /* 0x4 */ u16 unk4;
} cursor_entry;

u16 D_8005E338;
cursor_entry *D_8005E340;

void func_800233B4(void) {
    s32 base;
    s32 sum;

    base = D_8005E3C0->field_D8 + 0x64;
    func_80022580(D_8005E3C0->field_D8 + 0x68, 1, 0xAB, 0x20, 0x85, 0x12);
    sum = *D_80054BBC + (s32)&D_80053946;
    func_80017B3C(base, sum, 0xAD, 0x23);
    if (D_8005E338 >= 2) {
        func_80024A10(base, 0xFD, 0x23, D_8005E340->unk2);
    }
    if (D_8005E338 >= 3) {
        func_8001AAF4((s16)(D_8005E340->unk4 + 1), 2, base, 0x115, 0x23);
    }
}
