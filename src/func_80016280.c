#include "common.h"
#include "psyq/stddef.h"
#include "psyq/libgte.h"
#include "psyq/libgpu.h"

typedef struct {
    s16 field_00;
    u16 field_02;
} Group;

typedef struct {
    u16 field_00;
    s16 field_02;
    s16 field_04;
    s16 field_06;
    s16 field_08;
} Header;

typedef struct {
    u16 field_00;
    u16 field_02;
    u16 field_04;
    u16 field_06;
    u8 field_08;
    u8 pad_09;
    u16 pad_0A;
} Entry;

typedef struct {
    u16 field_00;
    u16 field_02;
    s16 field_04;
    s16 field_06;
} Vertex;

typedef struct {
    u16 field_00;
    u16 field_02;
    u16 field_04;
    u16 field_06;
    u16 field_08;
    u16 field_0A;
    u16 field_0C;
    u16 field_0E;
    s16 field_10;
    u16 field_12;
    u32 padding_14;
    u32 padding_18;
    Vertex *field_1C;
    Group *field_20;
    u8 *field_24;
    Group *field_28;
    u8 *field_2C;
    s32 field_30;
} SourceData;

/*
 * ASSEMBLY EXCEPTION (project-owner approved): only the compiler-coupled
 * entry/guard region is expressed with extended asm. The complete rendering
 * loop remains active C. The fixed-register outputs hand the target ABI state
 * directly to that C loop without duplicating or disabling it.
 */
void func_80016280(u_long *arg0, SPRT **arg1, DR_MODE **arg2, SourceData *arg3,
                   u8 arg4, u8 arg5, s16 arg6, s16 arg7) {
    RECT rect;
    Entry *ent;
    Vertex *uv0;
    Vertex *uv1;
    s16 u;
    s16 w;
    s16 h;
    s32 v;
    u8 tp;
    s32 clutX;
    u32 clutY;
    s32 clutAdd;
    register u_long *ot __asm__("$17");
    register SPRT **sprtpp __asm__("$9");
    register DR_MODE **modepp __asm__("$16");
    register DR_MODE **modeIn __asm__("$6");
    register SourceData *src __asm__("$11");
    register u32 arg4Reg __asm__("$2");
    register s32 i __asm__("$14");
    register s16 xArg __asm__("$22");
    register s16 yArg __asm__("$21");
    register s16 hx __asm__("$20");
    register s16 hy __asm__("$19");

    modeIn = arg2;
    __asm__(
        "addu %0,$4,$zero\n\t"
        "addu %1,$5,$zero"
        : "=r"(ot), "=r"(sprtpp));
    __asm__(
        "lbu %0,56($sp)\n\t"
        "addu %1,$7,$zero"
        : "=r"(arg4Reg), "=r"(src)
        :
        : "$16");
    __asm__ volatile(
        ".set noreorder\n\t"
        ".set nomacro\n\t"
        "lw $3,40($11)\n\t"
        "lw $4,44($11)\n\t"
        "lh $22,64($sp)\n\t"
        "lh $21,68($sp)\n\t"
        "sll $2,$2,2\n\t"
        "addu $3,$3,$2\n\t"
        "lhu $5,2($3)\n\t"
        "lbu $3,60($sp)\n\t"
        "addu $4,$4,$5\n\t"
        "sll $2,$3,2\n\t"
        "addu $2,$2,$3\n\t"
        "sll $2,$2,1\n\t"
        "addu $7,$4,$2\n\t"
        "lhu $3,0($7)\n\t"
        "ori $2,$zero,0xfffd\n\t"
        "sltu $2,$2,$3\n\t"
        "bnez $2,.Lfunc_80016280_hybrid_epilogue\n\t"
        "addu $16,$6,$zero\n\t"
        "addu $2,$3,$zero\n\t"
        "sll $2,$2,2\n\t"
        "lw $3,32($11)\n\t"
        "lw $5,36($11)\n\t"
        "lh $20,2($7)\n\t"
        "lh $19,4($7)\n\t"
        "addu $3,$3,$2\n\t"
        "lhu $6,2($3)\n\t"
        "lh $4,0($3)\n\t"
        "addu $8,$5,$6\n\t"
        "sll $2,$4,1\n\t"
        "addu $2,$2,$4\n\t"
        "sll $2,$2,2\n\t"
        "addiu $2,$2,-12\n\t"
        "addiu $14,$4,-1\n\t"
        /* Encoding the branch directly prevents maspsx from inserting a
         * spurious nop between this branch and its target delay slot. */
        ".word 0x05c0009f\n\t"
        "addu $8,$8,$2\n\t"
        ".set macro"
        : "+r"(arg4Reg)
        : "r"(modeIn), "r"(src)
        : "$3", "$4", "$5", "$7", "$8", "$14", "$16",
          "$19", "$20", "$21", "$22", "memory");
    __asm__ volatile(""
        : "=r"(modepp), "=r"(ent), "=r"(i),
          "=r"(xArg), "=r"(yArg), "=r"(hx), "=r"(hy));

    do {
        uv0 = &src->field_1C[ent->field_00];
        u = (uv0->field_00 + src->field_0C) & 0x3F;
        w = uv0->field_04;
        h = uv0->field_06;
        uv1 = &src->field_1C[ent->field_02];
        v = (uv0->field_02 + src->field_0E) & 0xFF;
        tp = ent->field_08 >> 7;
        if (tp) {
            u *= 2;
            w *= 2;
        } else {
            u *= 4;
            w *= 4;
        }
        setSprt(*sprtpp);
        *(u_long *)&(*sprtpp)->r0 = 0x64808080;
        setSemiTrans(*sprtpp, (src->field_02 & 0x20) || ((ent->field_08 >> 4) & 1));
        setShadeTex(*sprtpp, 0);
        (*sprtpp)->x0 = ent->field_04 + (xArg + hx);
        (*sprtpp)->y0 = ent->field_06 + (yArg + hy);
        (*sprtpp)->w = w;
        (*sprtpp)->h = h;
        (*sprtpp)->u0 = u;
        (*sprtpp)->v0 = v;
        clutY = uv1->field_02;
        clutAdd = src->field_12;
        clutY += clutAdd;
        clutX = (s16)uv1->field_00;
        clutAdd = src->field_10;
        clutX += clutAdd;
        (*sprtpp)->clut = getClut(clutX, clutY);
        addPrim(ot, *sprtpp);
        (*sprtpp)++;
        setDrawTPage(*modepp, 1, 1,
                     ((tp & 0x3) << 7)
                     | ((((s16)uv0->field_02 + (s16)src->field_0E) & 0x100) >> 4)
                     | ((((s16)uv0->field_00 + (s16)src->field_0C) & 0x3C0) >> 6)
                     | ((((s16)uv0->field_02 + (s16)src->field_0E) & 0x200) << 2));
        addPrim(ot, *modepp);
        (*modepp)++;
        ent--;
        i--;
    } while (i >= 0);

    __asm__ volatile(".Lfunc_80016280_hybrid_epilogue:");
}
