#include "common.h"
#include "psyq/memory.h"

/* Tentative definitions for GP-relative access (target uses %gp_rel) */
u16 D_8005E444;
u16 *D_8005E4A8;

void func_8001A574(s32 arg0) {
    s32 quotient = arg0 / 3;
    s32 product;
    s32 offset;
    FuncPtr_80049078 *base;
    FuncPtr_80049078 *entry;
    u16 *p_table;
    u16 *p_gap;
    s32 fn_result;
    s32 gap_count;
    s32 byte_size;
    s32 sentinel;

    /* Clear sentinel. */
    D_8005F0F8[0] = 0xFFFF;

    offset = D_8005E444 * 2;
    base = D_80049078;
    product = quotient * 3;
    p_table = (u16 *)((unsigned char *)D_8005E4A8 + offset);
    product = arg0 - product;
    entry = &base[product];
    fn_result = (*entry)(quotient);

    /* Scan gap: count consecutive non-0xFFFF entries after first */
    gap_count = 0;
    if (*p_table != 0xFFFF) {
        sentinel = 0xFFFF;
        p_gap = p_table;
        do {
            gap_count++;
            p_gap++;
        } while (*p_gap != sentinel);
    }

    /* Shift data to fill the gap (length is the scanned gap count) */
    byte_size = fn_result * 2;
    memmove((unsigned char *)p_table + byte_size, (unsigned char *)p_table + 2, gap_count * 2);

    /* Copy sentinel into the gap */
    memcpy((unsigned char *)p_table, (unsigned char *)&D_8005F0F8[0], byte_size);

    /* Restore sentinel */
    D_8005F0F8[0] = 0xFFFF;
}
