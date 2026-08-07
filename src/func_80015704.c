#include "common.h"
#include "debughook.h"
#include "psyq/stddef.h"
#include "psyq/libgte.h"
#include "psyq/libgpu.h"

typedef struct {
    /* 0x00 */ u16 field_0;
    /* 0x02 */ u16 field_2;
    /* 0x04 */ u8  field_4;
    /* 0x05 */ u8  field_5;
    /* 0x06 */ u16 field_6;
    /* 0x08 */ s32 field_8;
    /* 0x0C */ u16 field_C;
    /* 0x0E */ u16 field_E;
    /* 0x10 */ u16 field_10;
    /* 0x12 */ u16 field_12;
    /* 0x14 */ s32 field_14;
    /* 0x18 */ s32 field_18;
    /* 0x1C */ s32 field_1C;
    /* 0x20 */ s32 field_20;
    /* 0x24 */ s32 field_24;
    /* 0x28 */ s32 field_28;
    /* 0x2C */ s32 field_2C;
} InitStruct;

typedef struct {
    /* 0x00 */ s32 field_0;
    /* 0x04 */ s32 field_4;
    /* 0x08 */ s32 field_8;
    /* 0x0C */ s32 field_C;
    /* 0x10 */ s32 field_10;
    /* 0x14 */ s32 field_14;
    /* 0x18 */ s32 field_18;
    /* 0x1C */ s32 field_1C;
    /* 0x20 */ s32 field_20;
} TableHeader;

void func_80015704(InitStruct *out, TableHeader *header, s32 arg2, s32 arg3) {
    s32 sp10;

    CAPTURE_RA(&sp10);

    /* Check if header pointer is 4-byte aligned */
    if ((s32)header != (((u32)header >> 2) << 2)) {
        FntPrint(D_800100A0);
        do {
        } while (func_800129E8() != 0);
    }

    /* Check tag value */
    if (header->field_0 != 0xE) {
        FntPrint(D_800100A0);
        do {
        } while (func_800129E8() != 0);
    }

    /* Initialize output struct */
    out->field_6 = 0;
    out->field_0 = 0;
    out->field_2 = 0;
    out->field_4 = 0;
    out->field_5 = 0;
    out->field_8 = 0x1000;
    out->field_C = 0;
    out->field_E = 0;
    out->field_10 = 0;
    out->field_12 = 0;
    out->field_14 = 0;
    out->field_18 = 0;
    out->field_1C = (s32)((char *)header + header->field_10);
    out->field_20 = (s32)((char *)header + header->field_14);
    out->field_24 = (s32)((char *)header + header->field_18);
    out->field_28 = (s32)((char *)header + header->field_1C);
    out->field_2C = (s32)((char *)header + header->field_20);
    func_80015880(out, header, 0);
}
