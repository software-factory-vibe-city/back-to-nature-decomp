#include "common.h"
#include "game_types.h"

extern u8 D_800BF87C[];

void ovl_23_func_800B937C(void) {
    s16 i;

    for (i = 0; i < 0x36; i++) {
        ((Ovl23D87CView *)D_800BF87C)->unk418[i].unk0 = 0x17000;
        ((Ovl23D87CView *)D_800BF87C)->unk418[i].unk4 = -1;
        if (i < 6) {
            ((Ovl23D87CView *)D_800BF87C)->unk418[i].unk4 = ((u16 *)&D_800BBA40)[i];
        }
    }
    ((Ovl23D87CView *)D_800BF87C)->unk5C8 = 6;
    for (i = 0; i < 0xC; i++) {
        ((Ovl23D87CView *)D_800BF87C)->unk5CC[i].unk0 = 0xFFFE5000;
        ((Ovl23D87CView *)D_800BF87C)->unk5CC[i].unk4 = -1;
        if (i < 6) {
            ((Ovl23D87CView *)D_800BF87C)->unk5CC[i].unk4 = ((u16 *)&D_800BBA40)[i];
        }
    }
    ((Ovl23D87CView *)D_800BF87C)->unk62C = 6;
}
