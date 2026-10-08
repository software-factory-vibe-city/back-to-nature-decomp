#include "common.h"
#include "game_types.h"
#include "psyq/stddef.h"
#include "psyq/libgte.h"
#include "psyq/libgpu.h"

typedef struct {
    s32 unk0;
    s16 unk4;
    s16 unk6;
    s16 unk8;
    s16 unkA;
    s16 unkC;
    s16 unkE;
    s16 unk10;
    s16 unk12;
} M2C_8c6b5beb4326_Func8001F664_Data;

s16 ovl_11_func_80111D28(s16 arg0);
s32 ovl_11_func_80111CC4(s16 arg0, s16 arg1);
void func_8001F664(M2C_8c6b5beb4326_Func8001F664_Data *arg0, u_long *arg1, s16 arg2, s32 arg3, s32 arg4, s32 arg5, s32 arg6, s32 arg7, s32 arg8);

extern M2C_8c6b5beb4326_Func8001F664_Data D_8012D088;
extern u_long D_8012D0A8;
extern s32 D_8012D0E8;

#define BUTTON ((struct struct_8006C838_button *)D_8006C838)

void ovl_11_func_80111A60(void) {
    s16 temp_v0;
    s16 var_a2;
    s32 temp_v0_2;
    s32 temp_v1;
    s32 var_v0;

    D_8012D0E8 = 0;
    temp_v0 = ovl_11_func_80111D28(BUTTON->field_44BA);
    temp_v0_2 = ovl_11_func_80111CC4(BUTTON->field_44C0, temp_v0);
    if (temp_v0_2 != 2) {
        if (temp_v0_2 < 3) {
            var_a2 = 0x71;
            if (temp_v0_2 < 0) {
                goto Lneg;
            }
            var_v0 = 0xDF;
            goto Ldone;
        }
        if (temp_v0_2 == 3) {
            goto Lr3;
        }
        var_v0 = 0;
        var_a2 = 0;
        goto Ldone;
    }
    temp_v1 = ((BUTTON->field_44C0 - temp_v0) * 0x3C) + BUTTON->field_44C2;
    D_8012D0E8 = temp_v1;
    if (temp_v1 >= 0x71) {
        D_8012D0E8 = 0x71;
    }
    var_a2 = 0x71;
    var_v0 = 0xDF;
    goto Ldone;
Lr3:
    var_a2 = 0x20;
    var_v0 = 0xDE;
    goto Ldone;
Lneg:
    var_v0 = 0;
    var_a2 = 0;
Ldone:
    func_8001F664(&D_8012D088, &D_8012D0A8, var_a2, 0x140, var_v0, 0x140, var_v0 - 1, 0x140, 0xDC);
}
