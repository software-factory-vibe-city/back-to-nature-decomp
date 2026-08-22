#include "common.h"
#include "game_types.h"

/* PSY-Q Kanji font helpers. */
int KanjiFntPrint();
int KanjiFntFlush(int id);

/* Game callees. */
void func_80011EF0(s32 arg0);
s32 func_80013394(void);

/* Data owned by other translation units in this overlay (rodata). */
extern s32 D_800B7F84;
extern s32 D_800B7FA8;
extern s32 D_800B7FC8;
extern s32 D_800B7FDC;
extern s32 D_800B7FE0;
extern s32 D_800B7FE4;
extern s32 D_800B7FE8;
extern s32 D_800B8504;

/* D_8006C838 view: s32 flag word at offset 0x10. */
typedef struct {
    char pad_000[0x10];
    s32 field_10;
} D8006C838Flag10View;

void ovl_08_func_800B8134(void) {
    SomeStruct *ctrl;
    s32 q;
    s32 cur;

    KanjiFntPrint(&D_800B7F84);
    KanjiFntPrint(&D_800B7FA8);

    q = D_800B8504 / 6;
    cur = q * 6;

    while (cur < (D_800B8504 / 6) * 6 + 6) {
        if ((u32)cur < 0x20U) {
            KanjiFntPrint(&D_800B7FC8,
                          (cur == D_800B8504) ? &D_800B7FDC : &D_800B7FE0, cur,
                          D_800B8508[cur].field_4);
        } else {
            KanjiFntPrint(&D_800B7FE4);
        }
        cur += 1;
    }

    KanjiFntPrint(&D_800B7FE8);

    if (func_80013394() != 0) {
        ctrl = (SomeStruct *)D_8005E3A8;
        if (ctrl->field_0x0 & 0x1000) {
            D_800B8504 -= 1;
            if (D_800B8504 < 0) {
                D_800B8504 = 0x1F;
            }
        } else if (ctrl->field_0x0 & 0x4000) {
            D_800B8504 += 1;
            if ((u32)D_800B8504 >= 0x20U) {
                D_800B8504 = 0;
            }
        } else if (ctrl->field_0x0 & 0x8000) {
            D_800B8504 -= 6;
            if (D_800B8504 < 0) {
                D_800B8504 = 0;
            }
        } else if (ctrl->field_0x0 & 0x2000) {
            D_800B8504 += 6;
            if ((u32)D_800B8504 >= 0x20U) {
                D_800B8504 = 0x1F;
            }
        } else if (ctrl->field_0x8 & 0x20) {
            s32 sel = D_800B8508[D_800B8504].field_0;
            if (sel != -1) {
                func_80011EF0(sel);
                switch (D_800B8504) {
                case 13:
                    ((D8006C838Flag10View *)&D_8006C838)->field_10 |= 0x80000;
                    break;
                case 14:
                    ((D8006C838Flag10View *)&D_8006C838)->field_10 |= 0x40000;
                    break;
                case 15:
                    ((D8006C838Flag10View *)&D_8006C838)->field_10 |= 0x20000;
                    break;
                case 16:
                    ((D8006C838Flag10View *)&D_8006C838)->field_10 |= 0x10000;
                    break;
                }
            }
        }
        KanjiFntFlush(-1);
    }
}
