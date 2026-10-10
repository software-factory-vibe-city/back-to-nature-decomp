#include "common.h"
#include "game_types.h"

void ovl_11_func_800FE640(void);
void ovl_11_func_800FE928(void);
void ovl_11_func_800FEA00(void);
void ovl_11_func_800FC320(void);

void ovl_11_func_800FC1AC(void) {
    s32 temp_v0;
    s32 temp_v0_2;

    func_80022580(D_8005E3C0->field_D8 + 0x70, 1, 0x10, 0x20, 0x120, 0xC0);
    func_80022580(D_8005E3C0->field_D8 + 0x6C, 1, 0x3C, 0x10, 0xC8, 0x20);
    ovl_11_func_800FE640();
    func_80017B3C(D_8005E3C0->field_D8 + 0x54, (s32) &D_8012CDC8, 0x3E, 0x1A);
    temp_v0 = *(s32 *) ((u8 *) D_8005E3A8 + 0);
    if (temp_v0 & 0x2000) {
        func_8001FABC(5);
        D_80127210 = 0;
        ovl_11_func_800FE928();
    } else if (temp_v0 & 0x8000) {
        func_8001FABC(5);
        D_80127210 = 0;
        ovl_11_func_800FEA00();
    }
    if ((*(s32 *) ((u8 *) D_8005E3A8 + 8)) & 0x860) {
        ovl_11_func_800FC320();
    }
    D_80127308[(s16) D_8012720E]();
    temp_v0_2 = D_80127212 + 1;
    D_80127212 = temp_v0_2;
    if ((s16) temp_v0_2 >= 0x78) {
        D_80127212 = 0;
    }
}
