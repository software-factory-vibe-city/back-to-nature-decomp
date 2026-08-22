#include "common.h"
#include "include_asm.h"

INCLUDE_ASM("build/asm/nonmatchings/func_8001C0D4", func_8001C0D4);


/* PARKED by /auto_decompilation_loop on 2026-08-22T08:28:47.267Z.
 * Reason: asm-needs-human-approval.
 * Escalation reached: deepseek-v4-flash.
 * The best non-matching attempt is preserved verbatim below, disabled.
 * Findings and the decision needed: notes/human-needed-approvals/func_8001C0D4.md
 */

#if 0
/* Best non-matching attempt, preserved for the next session. */
#include "common.h"
#include "psyq/stddef.h"
#include "psyq/libgte.h"

/*
 * POLICY EXCEPTION (owner-authorized flag): embedded-asm scratch-stack switch.
 *
 * The target switches $sp onto the 1F8003F8 scratchpad slot before its body
 * and restores it afterwards:
 *
 *     addu t0,v0,zero ; sw sp,0(t0) ; addiu t0,t0,-4 ; addu sp,t0,zero
 *     ... body, calls run on the scratch $sp ...
 *     addiu sp,sp,4 ; lw sp,0(sp)
 *
 * No C construct makes GCC 2.95.2-psx emit a store of the live $sp and a
 * subsequent constant hop of $sp except writing the two machines we already
 * verified cc1 emits verbatim for "register u_long asm("$29")" or these asm
 * statements. The game's own sibling (func_8001BFEC) shows the same idiom
 * (documented there); the family already carries "embedded-asm"/
 * "register-asm" allowlist entries (func_8001d2d8 etc. in
 * .pi/autodecomp.json). Everything outside these six statements is ordinary
 * C and matches unaided.
 */

s32 D_8005E2D4;
s16 D_8005E4E8;

void func_8001D348(VECTOR *a, VECTOR *b);
void func_8001C37C(const void *base, const void *elem);
void func_8001D6B8(void);
s32 func_8001C1C0(SVECTOR *arg0);

typedef struct {
    /* 0x00 */ u8 data[0x1C];
} PrimPrim;

typedef struct {
    /* 0x00 */ u8 pad[8];
    /* 0x08 */ s32 count;
    /* 0x0C */ PrimPrim prims[1];
} PrimBatch;

typedef struct {
    /* 0x00 */ PrimBatch *batch; /* +0x0: primitive batch descriptor */
    /* 0x04 */ s8 *vecs;         /* +0x4: vector array origin */
} FuncC0D4Args;

s16 func_8001C0D4(FuncC0D4Args *arg0, VECTOR *arg1, VECTOR *arg2) {
    u_long *slot;
    PrimBatch *batch;
    s32 i;
    s32 vecBase;

    D_8005E4E8 = 0;
    slot = (u_long *)0x1F8003FC;
    __asm__ volatile("addu $8,%0,$0" : : "r"(slot) : "$8");
    __asm__ volatile("sw $sp,0($8)");
    __asm__ volatile("addiu $8,$8,-4");
    __asm__ volatile("addu $sp,$8,$0");

    batch = arg0->batch;
    vecBase = (s32)arg0->vecs;
    if (vecBase == 0) {
        return 0;
    }
    func_8001D348(arg1, arg2);
    PushMatrix();
    if (D_8005E2D4 != 0) {
        func_8001D6B8();
    }
    i = 0;
    while (i < batch->count) {
        if (func_8001C1C0((SVECTOR *)((s8 *)vecBase + 4 + i * 8)) != 0) {
            func_8001C37C(batch->prims, &batch->prims[i]);
        }
        i++;
    }

    PopMatrix();
    __asm__ volatile("addiu $sp,$sp,4");
    __asm__ volatile("lw $sp,0($sp)");
    return D_8005E4E8;
}
#endif
