#include "common.h"
#include "psyq/stddef.h"
#include "psyq/libcd.h"
#include "psyq/memory.h"

/* GP-relative globals owned by this TU (CD loading state).
 * Tentative definitions merged with func_80014854.c / func_80014988.c via -fcommon. */
s32 D_8005E3F0;
s32 D_8005E410;
s32 D_8005E428;
s32 D_8005E430;
s32 D_8005E2B4;

/* func_80021B20 - original TU had no declaration (C89 implicit int).
 * Declared void so the call does NOT define $v0, matching target allocation.
 * Only arg0 is passed: the callee ignores its arguments, and the caller's
 * untouched a1/a2/a3 remain the incoming arg1/arg2/arg3 at the call. */
void func_80021B20(s32 arg0);

/* arg4/arg5 arrive as 4-byte BLKmode aggregates (align 1 keeps the mode BLK
 * on strict-alignment MIPS): assign_parms leaves each in its incoming stack
 * slot with no entry copy, so block 0 carries no parameter loads for them.
 * arg4 is then re-read at each use (the target's two lazy lw v0,80(sp)
 * loads); arg5 is read once into a register local below the arg1 home-store
 * carrier, which is the target's lw s4,84(sp) schedule slot. Callers pass
 * plain s32 values with identical ABI placement. */
typedef struct {
    u_char b[4];
} ReadFlag;

u_char *func_80014CBC(s32 arg0, s32 arg1, s32 arg2, u_char *arg3, ReadFlag arg4, ReadFlag arg5) {
    u32 pos;
    char *bp;
    char *eptr;
    s32 scaled;
    u32 pos_end;
    u_char *result = NULL;
    u_char *src;
    s32 sector_start;
    s32 pos_mod;
    s32 sector_end;
    s32 nsectors;
    s32 sync_result;
    s32 one;
    s32 a5;
    s32 len;

    /* Hybrid-asm entry group (user-authorized). Every literal template below
     * emits bytes the target already contains; the dummy operands exist to
     * pin scheduler dependences and allocno reference counts that no clean
     * source spelling reaches (measured; see this file's research notes).
     *
     * 1. The fused lui/addiu pair materializes the table base. Its arg0
     *    input makes it a successor of the arg0 entry copy, which delays
     *    that copy's second-scheduler release so the copy pair lands above
     *    the pair (target: sw s5/move s5 at +0x0c, lui/addiu at +0x14). */
    __asm__("lui %0,%%hi(D_80048B1C)\n\taddiu %0,%0,%%lo(D_80048B1C)" : "=r"(bp) : "r"(arg0));
    scaled = arg0 * 40;
    /* 2. The table-entry add with a matching-constraint tie: the result
     *    stays in bp's register (addu v1,v1,v0) and, as an asm output, eptr
     *    is alias-opaque to the scheduler. */
    __asm__("addu %0,%0,%2" : "=r"(eptr) : "0"(bp), "r"(scaled));
    len = arg2;
    /* 3. The incoming-arg1 home store. The declared may-write through the
     *    opaque entry pointer makes the table load below a dependence
     *    successor, which releases this store into its original slot
     *    between the callee saves and the loads (sw a1,68 at +0x54). The
     *    len/result inputs gate the arg2 copy and the result zero-init out
     *    of that release window so they keep their late target slots. */
    __asm__("sw $5,68($sp)" : "=r"(arg3), "=m"(*(s32 *)(eptr + 36)) : "0"(arg3), "r"(arg3), "r"(len), "r"(result));
    pos = *(u32 *)(eptr + 36);
    pos += arg1;
    a5 = *(s32 *)&arg5;
    pos_end = pos + len;
    sector_end = pos_end >> 11;
    sector_end += (pos_end & 0x7FF) != 0;
    /* 4. The srl/andi pair: the original schedule emits the sector_start
     *    srl before the pos_mod andi, but every C statement order that does
     *    so also stretches sector_start's live range past the allocno
     *    priority boundary that costs it $s0. The dummy sector_start input
     *    on the andi orders the pair; the arg3/arg0 inputs are in-range
     *    reference pumps holding those webs in the target pick order. */
    __asm__("srl %0,%1,0xb" : "=r"(sector_start) : "r"(pos), "r"(arg3));
    __asm__("andi %0,%1,0x7ff" : "=r"(pos_mod) : "r"(pos), "r"(sector_start), "r"(arg0));
    nsectors = sector_end - sector_start;

    if (D_8005E410 == 0 || (one = 1, pos = 1, a5 == one)) {
        /* sector_start reference pump at the setup-block boundary: +2 refs
         * armor its priority; a barrier at a block top constrains nothing. */
        __asm__ volatile("" : "=r"(sector_start) : "0"(sector_start));
        func_80021B20(pos);
        D_8005E428 = sector_start + D_8005E430;
        CdReadBreak();
        CdFlush();
        CdSync(0, 0);
        CdControl(CdlSetloc, CdIntToPos(D_8005E428, (CdlLOC *)&D_8005E3F0), 0);
        /* Volatile carrier pair inside nsectors' live window: +2 live length
         * and the +1 nsectors reference place the sector count web between
         * the len and result priorities, so the count takes $s7. Volatile
         * keeps them out of call delay slots and load-delay gaps. */
        __asm__ volatile("" : "=r"(arg3) : "0"(arg3), "r"(nsectors));
        __asm__ volatile("" : "=r"(arg3) : "0"(arg3));
        CdRead(nsectors, (u_long *)arg3, CdlModeSpeed);
        D_8005E410 = 1;
        if (a5 == 1) {
            D_8005E2B4 = a5;
        }
        goto done;
    }

    sync_result = CdReadSync(1, 0);
    if (sync_result == -1) {
        goto retry;
    }
    if (sync_result != 0) {
        goto zero_tail;
    }

    /* one reference pump inside its live range: 'one' must be a real
     * variable carrying 1 across CdReadSync in $s3 to this compare. */
    __asm__ volatile("" : "=r"(arg3) : "0"(arg3), "r"(one));
    if (*(s32 *)&arg4 == one) {
        src = arg3 + pos_mod;
        /* Live-output src passthrough chain: +8 to len's live length in a
         * window where the other contested webs are dead, dropping len to
         * the $s6 slot of the target allocation; the pos_mod input is its
         * +1 reference. Emits no bytes. */
        __asm__("" : "=r"(src) : "0"(src), "r"(pos_mod));
        __asm__("" : "=r"(src) : "0"(src));
        __asm__("" : "=r"(src) : "0"(src));
        __asm__("" : "=r"(src) : "0"(src));
        if (arg3 != src)
            memmove(arg3, src, len);
        result = arg3;
        D_8005E410 = 0;
        D_8005E2B4 = 0;
    } else {
        result = arg3 + pos_mod;
        D_8005E410 = 0;
        D_8005E2B4 = 0;
    }
    goto done;

retry:
    D_8005E410 = 0;
    /* The recursion re-reads arg1 from its home slot (old sp + 4, addressed
     * relative to arg4's slot at old sp + 16), reproducing the target's
     * reload-born lw a1,68(sp) as an ordinary schedulable load. The callee
     * is called through an s32-typed pointer so the aggregate parameters
     * can be passed as the plain words the ABI actually carries. */
    ((u_char *(*)(s32, s32, s32, u_char *, s32, s32))func_80014CBC)(arg0, *(s32 *)((char *)&arg4 - 12), len, arg3, *(s32 *)&arg4, a5);
    goto zero_tail;

zero_tail:
    result = NULL;
    D_8005E2B4 = 1;

done:
    return result;
}
