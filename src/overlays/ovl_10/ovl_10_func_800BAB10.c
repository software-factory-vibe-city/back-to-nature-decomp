#include "common.h"

int FntPrint();
int McxShowTrans(int, int, int);
void ovl_10_func_800B92AC(void);
s32 ovl_10_func_800BB728(s32);

extern char D_800B86E0[];
extern char D_800B870C[];
extern char D_800B8738[];
extern char D_800B8754[];
extern char D_800B8760[];
extern char D_800B876C[];
extern s32 D_800BB890;
extern s32 D_800BB894;
extern s32 D_800BB898;
extern s32 D_800BB89C;

int ovl_10_func_800BAB10(int arg0, int arg1) {
    switch (arg0) {
    case 0:
        if (arg1 & 0x20) {
            D_800BB890 = 1;
        } else if (arg1 & 0x40) {
            D_800BB890 = 0;
        }
        if (arg1 & 0x10) {
            s32 v = D_800BB898 + 1;
            D_800BB898 = v;
            if (ovl_10_func_800BB728(v) != 0 && D_800BB894 < 0xFF) {
                D_800BB894++;
            }
        } else {
            D_800BB898 = 0;
            if (arg1 & 0x80) {
                s32 v = D_800BB89C + 1;
                D_800BB89C = v;
                if (ovl_10_func_800BB728(v) != 0 && D_800BB894 > 0) {
                    D_800BB894--;
                }
            } else {
                D_800BB89C = 0;
            }
        }
        return 0;
    case 1:
        FntPrint(&D_800B86E0);
        FntPrint(&D_800B870C);
        FntPrint(&D_800B8738, D_800BB890 != 0 ? &D_800B8754 : &D_800B8760);
        FntPrint(&D_800B876C, D_800BB894);
        return 0;
    case 2:
        return McxShowTrans(0, D_800BB890, D_800BB894);
    case 3:
        ovl_10_func_800B92AC();
        return 0;
    default:
        return 0;
    }
}
