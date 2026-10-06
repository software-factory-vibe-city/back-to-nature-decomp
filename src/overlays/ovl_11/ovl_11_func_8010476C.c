/* User-authorized address/register workaround: retain the genuine high
 * in V0 until its LOW16 consumer builds the loop-invariant base in T1.
 * Both nested scans and every store remain C; this does not establish the
 * original source used register declarations or embedded assembly. */
#include "common.h"

/* Clear three rows of six 14-byte records: first halfword is -1 and the
 * remaining six are zero. The two bases reach the same record array, with
 * pX addressing its last halfword. */
void ovl_11_func_8010476C(void) {
    s16 *pW;
    s16 *pX;
    register s16 *pBase asm("$9");
    register u32 high asm("$2");
    register s16 *base2 asm("$3");
    u32 rows;
    u32 n;
    u32 next;
    u32 rb;

    rows = 0;
    asm volatile("lui %0,%%hi(D_80074838)" : "=r"(high));
    asm volatile("addiu %0,%1,%%lo(D_80074838)" : "=r"(pBase) : "r"(high));
    base2 = (s16 *)&D_8006C838;
    base2 += 0x7291;
    do {
        n = 0;
        next = rows + 1;
        pX = (s16 *)(rows * 0x54 + (u32)base2);
        rb = rows * 0x54 + 0x6520;
        pW = (s16 *)(rb + (u32)pBase);
        do {
            pW[-5] = -1;
            pW[-4] = 0;
            pW[-3] = 0;
            pW[-2] = 0;
            pW[-1] = 0;
            pW[0] = 0;
            *pX = 0;
            pX += 7;
            n++;
            pW += 7;
        } while (n < 6U);
        rows = next;
    } while (rows < 3U);
}
