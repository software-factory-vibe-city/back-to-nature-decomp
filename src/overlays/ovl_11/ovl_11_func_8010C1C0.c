#include "common.h"

typedef struct {
    char pad_000[0x100];
    s32 field_100;
    s32 field_104;
    s32 field_108;
    s32 field_10C;
} StructC1C0;

void ovl_11_func_8010C1C0(StructC1C0 *arg0) {
    char *base;

    /* Two-stage base formation keeps +0x8000 as runtime ori/addu (matched idiom) */
    base = (char *)&D_8006C838;
    base += 0x8000;
    *(s32 *)(base + 0x12D4) = arg0->field_100;
    *(s32 *)(base + 0x12D8) = arg0->field_104;
    *(s32 *)(base + 0x12DC) = arg0->field_108;
    *(s32 *)(base + 0x12E0) = arg0->field_10C;
}
