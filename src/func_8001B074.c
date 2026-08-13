#include "common.h"
#include "game_types.h"

extern void func_80012A14(void);
extern void func_8001719C(u8 *arg0);
extern void func_80015704(SpriteSourceData *out, SpriteDataHeader *header,
                          s32 arg2, s32 arg3);
extern void func_80015840(ObjectState *obj, s8 arg1);
extern unsigned long *ClearOTagR(unsigned long *ot, int n);

s32 D_8005E2CC;

void func_8001B074(void) {
    unsigned long *ot = (unsigned long *)&D_8005F2E8;
    SpriteSourceData *src;
    SpriteDataHeader *hdr;

    func_80012A14();
    hdr = (SpriteDataHeader *)&D_800605F0;
    func_8001719C((u8 *)(*(s32 *)((char *)hdr - 4) + (s32)hdr));
    src = (SpriteSourceData *)&D_8005F2B8;
    ((void (*)(SpriteSourceData *, SpriteDataHeader *))func_80015704)(src, hdr);
    ClearOTagR(ot, 0x20);
    ClearOTagR(ot + 0x20, 0x20);
    func_80015840((ObjectState *)src, 0);
    D_8005E2CC = 1;
}
