#include "common.h"
#include "psyq/stddef.h"
#include "psyq/libgte.h"
#include "scratchpad.h"

/*
 * Runs on the PlayStation scratchpad stack.
 *
 * The whole body executes with $sp pointing into the 1 KB of single-cycle
 * memory at 0x1F800000 — the D-cache the console exposes as directly addressed
 * RAM — instead of into main RAM, which the R3000A does not cache at all. The
 * caller's $sp is parked in the top word and restored on the way out:
 *
 *     addu t0,v0,zero ; sw sp,0(t0) ; addiu t0,t0,-4 ; addu sp,t0,zero
 *     ... body, and every callee's frame, on the scratchpad ...
 *     addiu sp,sp,4 ; lw sp,0(sp)
 *
 * No C construct moves $sp, so the original source can only have contained
 * inline assembly here; the six statements below are the reconstruction of the
 * macro it must have been. `sourcePolicy.allowStackPointerSwitch` classifies
 * this rather than allowlisting the function, because it is the right answer
 * for the construct and not a judgement about this function.
 *
 * The reasoning, the evidence that the stack depth was measured, and the
 * derivation of the macro form: notes/research/scratchpad-stack-switch.md
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
    slot = (u_long *)SCRATCHPAD_SP_SLOT;
    SP_TO_SCRATCH(slot);

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
    SP_FROM_SCRATCH();
    return D_8005E4E8;
}
