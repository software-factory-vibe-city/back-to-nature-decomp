#include "common.h"
#include "game_types.h"
#include "psyq/stddef.h"
#include "psyq/libgte.h"

void func_8001AF70(u16 arg0, u16 arg1);

void ovl_11_func_800C12DC(void) {
    Ovl11Rec64D8View *rec;
    u16 temp_s0;
    u32 var_s1;

    var_s1 = 0;
    rec = (Ovl11Rec64D8View *) D_80074838;
    for (; var_s1 < 5U; var_s1++) {
        temp_s0 = (var_s1 + 0x26) & 0xFFFF;
        func_8001AF70(temp_s0, 0U);
        if ((((Ovl11Status44B8View *) D_8006C838)->field_44B8 == rec->recs[var_s1][0]) && (((Ovl11Status44B8View *) D_8006C838)->field_44BA == rec->recs[var_s1][1]) && (((Ovl11Status44B8View *) D_8006C838)->field_44BC == ((Ovl11Status44B8View *) D_8006C838)->field_E4DC[var_s1 * 6])) {
            func_8001AF70(0x2CU, 1U);
            func_8001AF70((var_s1 + 0x21) & 0xFFFF, 1U);
            func_8001AF70(temp_s0, 1U);
        }
    }
    if ((((Ovl11Status44B8View *) D_8006C838)->field_44B8 == ((Ovl11Status44B8View *) D_8006C838)->field_5488) && (((Ovl11Status44B8View *) D_8006C838)->field_44BA == ((Ovl11Status44B8View *) D_8006C838)->field_548A) && (((Ovl11Status44B8View *) D_8006C838)->field_44BC == ((Ovl11Status44B8View *) D_8006C838)->field_548C)) {
        func_8001AF70(0x2CU, 1U);
    }
}
