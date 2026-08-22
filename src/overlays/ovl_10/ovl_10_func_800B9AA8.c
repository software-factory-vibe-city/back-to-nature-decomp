#include "common.h"

int FntPrint();
int McxExecFlag(int, int, int);
long MemCardAccept(long);
long MemCardSync(long, long *, long *);
void ovl_10_func_800B92AC(void);
s32 ovl_10_func_800BB728(s32);

typedef struct {
    s32 unk0;
    s32 unk4;
    s32 unk8;
    s32 unkC;
    s32 unk10;
    s32 unk14;
    s32 unk18;
    s8 unk1C;
    s8 unk1D;
} __attribute__((packed)) McSaveData;

extern char D_800B8374[];
extern char D_800B83AC[];
extern char D_800B83E4[];
extern char D_800B8410[];
extern char D_800B8430[];
extern char D_800B8434[];
extern McSaveData D_800B8438;
extern McSaveData D_800BBAFC;
extern s32 D_800BB834;
extern s32 D_800BB838;
extern s32 D_800BB83C;
extern s32 D_800BB840;

int ovl_10_func_800B9AA8(s32 arg0, s32 arg1) {
    long cmds;
    long result;

    switch (arg0) {
    case 0:
        if (arg1 & 0x20) {
            D_800BB838 = 1;
        } else if (arg1 & 0x40) {
            D_800BB838 = 0;
        }
        if (arg1 & 0x10) {
            s32 v = D_800BB83C + 1;
            D_800BB83C = v;
            if (ovl_10_func_800BB728(v) != 0 && D_800BB834 < 0xF) {
                D_800BB834++;
            }
        } else {
            D_800BB83C = 0;
            if (arg1 & 0x80) {
                s32 v = D_800BB840 + 1;
                D_800BB840 = v;
                if (ovl_10_func_800BB728(v) != 0) {
                    if (D_800BB834 >= 2) {
                        D_800BB834--;
                    }
                }
            } else {
                D_800BB840 = 0;
            }
        }
        return 0;
    case 1:
        FntPrint(D_800B8374);
        FntPrint(D_800B83AC);
        FntPrint(D_800B83E4, D_800BB834);
        FntPrint(D_800B8410, D_800BB838 ? D_800B8430 : D_800B8434);
        return 0;
    case 2:
        MemCardAccept(0);
        MemCardSync(0, &cmds, &result);
        if ((u32)(result - 1) < 2U) {
            D_800BBAFC = D_800B8438;
            return -1;
        }
        return McxExecFlag(0, D_800BB834, D_800BB838);
    case 3:
        ovl_10_func_800B92AC();
        /* fallthrough */
    default:
        return 0;
    }
}
