#include "common.h"

int FntPrint(const char *fmt, ...);
int FntFlush(int id);
int DrawSync(int mode);
int McxSync(int func, long *time, long *param);
void ovl_10_func_800B9060(void);
int ovl_10_func_800B9108(int, int);

/* ovl_10 memory-card data, absolute-addressed (owned by the ovl_10 data file) */
extern char D_800B7E48[];
extern char D_800B7E50[];
extern char D_800B7EE8[];
extern char D_800B7F10[];
extern char *D_800BBB3C[];
extern s32 D_800BB7BC;
extern s32 D_800BB7C0;
extern char D_800BBAFC[];

/* card-record source buffers, absolute-addressed */
extern char D_800B7E58[];
extern char D_800B7E6C[];
extern char D_800B7E80[];
extern char D_800B7E94[];
extern char D_800B7EC4[];

typedef struct __attribute__((packed)) {
    s32 unk0;
    s32 unk4;
    s32 unk8;
    s32 unkC;
    s8 unk10;
    s8 unk11;
} McCardRec18;

typedef struct __attribute__((packed)) {
    s32 unk0;
    s32 unk4;
    s32 unk8;
    s32 unkC;
    s8 unk10;
    s8 unk11;
    s8 unk12;
} McCardRec19;

typedef struct __attribute__((packed)) {
    s32 unk0;
    s32 unk4;
    s32 unk8;
    s8 unkC;
    s8 unkD;
    s8 unkE;
} McCardRec15;

typedef struct __attribute__((packed)) {
    s32 unk0;
    s32 unk4;
    s32 unk8;
    s32 unkC;
    s32 unk10;
    s32 unk14;
    s32 unk18;
    s8 unk1C;
    s8 unk1D;
} McCardRec30;

typedef struct __attribute__((packed)) {
    s32 unk0;
    s32 unk4;
    s32 unk8;
    s32 unkC;
    s32 unk10;
    s32 unk14;
    s32 unk18;
    s32 unk1C;
    s8 unk20;
} McCardRec33;

void ovl_10_func_800B8C14(void) {
    s32 sp10;
    s32 sp14;
    s32 i;
    s32 ret;

    for (i = 0; i < 15; i++) {
        D_800BBB3C[i] = D_800B7E40;
    }
    D_800BBB3C[D_800BB7BC] = D_800B7E48;
    ovl_10_func_800B9060();
    FntFlush(-1);
    DrawSync(0);
    FntPrint(D_800B7E50);
    switch (ret = McxSync(1, (long *)&sp10, (long *)&sp14)) {
    case 0:
        *(McCardRec18 *)&D_800BBAFC = *(McCardRec18 *)&D_800B7E58;
        break;
    case 1:
        switch (sp14) {
        case 0:
            *(McCardRec18 *)&D_800BBAFC = *(McCardRec18 *)&D_800B7E6C;
            break;
        case 1:
            *(McCardRec19 *)&D_800BBAFC = *(McCardRec19 *)&D_800B7E80;
            break;
        case 2:
            *(McCardRec15 *)&D_800BBAFC = *(McCardRec15 *)&D_800B7E94;
            break;
        case 3:
            if (sp10 == 0xB) {
                *(McCardRec30 *)&D_800BBAFC = *(McCardRec30 *)&D_800B7EA4;
            } else {
                *(McCardRec33 *)&D_800BBAFC = *(McCardRec33 *)&D_800B7EC4;
            }
            break;
        }
        break;
    }
    ovl_10_func_800B9108(1, 0);
    FntPrint(D_800B7EE8);
    if (D_800BB7BC == D_800BB7C0) {
        ovl_10_func_800B9108(3, 0);
    } else {
        FntPrint((const char *)&D_800B7EEC);
    }
    FntPrint(D_800B7F10, &D_800BBAFC);
}
