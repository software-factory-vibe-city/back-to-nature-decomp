#include "common.h"
#include "game_types.h"

u16 D_8005E344;
s32 D_8005E348;
u16 D_8005E34E;
s32 D_8005E350;
s16 D_8005E354;
u16 D_8005E356;
s16 D_8005E358;
u16 *D_8005E360;

void func_8001FABC(s16 arg0);
s32 func_800226B0(void);
void func_80022738(void);
s32 func_800241EC(s32 arg0, s32 arg1, u32 arg2);
s32 func_800244FC(s32 arg0, s32 arg1);

void func_80023DBC(void) {
    SomeStruct *gfx;
    s16 var_s1;
    u16 temp_s0;
    s32 temp_v0;

    var_s1 = -1;
    if ((D_8005E344 != 2) && (func_800226B0() != 0)) {
        gfx = (SomeStruct *)D_8005E3A8;
        switch ((u32)gfx->field_0x8) {
        case 0x800:
            var_s1 = 2;
            if ((D_8005E34E != 0) && (D_8005E350 != 0)) {
                var_s1 = 0;
                func_80022738();
                D_8005E354 = 0;
                D_8005E344 = 2;
            }
            break;
        case 0x20:
            var_s1 = 1;
            if (D_8005E34E != 0) {
                D_8005E34E -= 1;
                D_8005E360[D_8005E34E] = 0xFFFF;
            } else {
                var_s1 = 2;
                if (D_8005E348 == 1) {
                    var_s1 = 1;
                    func_80022738();
                    D_8005E344 = 3;
                }
            }
            break;
        case 0x40: {
            s16 d0;
            u16 cursor;
            d0 = (s16)D_8005E356;
            cursor = D_8005E356;
            if (d0 != 0xD) {
                if (d0 == 0x53) {
                    var_s1 = 2;
                    if ((D_8005E34E != 0) && (D_8005E350 != 0)) {
                        var_s1 = 0;
                        func_80022738();
                        D_8005E354 = 0;
                        D_8005E360[D_8005E34E + 1] = 0xFFFF;
                        D_8005E344 = 2;
                    }
                } else {
                    var_s1 = 0;
                    if ((u16)D_8005E34E < 8U) {
                        if ((s16)cursor == 0x1B) {
                            D_8005E360[D_8005E34E] = 0xFFD;
                        } else {
                            D_8005E360[D_8005E34E] = func_800244FC((s32)(*(volatile u16 *)&D_8005E356), (s32)D_8005E358);
                            D_8005E350 = 1;
                        }
                        D_8005E34E += 1;
                    }
                }
            } else {
            case 0x5:
            case 0xA:
                D_8005E358 = ((u16)D_8005E358 + 1) & 1;
                var_s1 = 5;
            }
            break;
        }
        default:
            temp_s0 = D_8005E356;
            temp_v0 = func_800241EC((s32)temp_s0, *(u16 *)D_8005E3A8, (u32)D_8005E358);
            D_8005E356 = temp_v0;
            if (temp_s0 != (s16)temp_v0) {
                var_s1 = 5;
            }
            break;
        }
        if (var_s1 >= 0) {
            func_8001FABC(var_s1);
        }
    }
}
