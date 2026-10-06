/* User-authorized matching workaround: retain the entry walker in $a0,
 * birth its address before the inner-loop invariants, and preserve the three
 * commutative address operand orders. Both scans and field updates remain C;
 * these constraints do not establish how the original source was written. */
#include "common.h"

void ovl_11_func_800F227C(s16 arg0) {
    struct_80076220 *rec;
    register struct_80076220_entry *en asm("$4");
    u8 *b1;
    u16 *b2;
    u16 *b3;
    u8 *p1;
    u16 *p2;
    u16 *p3;
    s16 temp;
    s32 i;
    s32 j;

    if (arg0 != 0x168) {
        rec = &D_80076220;
        for (j = 0; j < 37; j++, rec++) {
            asm volatile("addiu %0,%1,0xE4" : "=r"(en) : "r"(rec));
            for (i = 0; i < 30; i++, en++) {
                temp = en->unk0;
                if (temp < arg0) {
                    continue;
                }
                if (arg0 < temp) {
                    rec->unk22 = (i < 0) ? 0 : i;
                } else {
                    rec->unk22 = i;
                }
                rec->unkC = 0;
                b1 = (u8 *)rec + 0xE6;
                asm("addu %0,%1,%2" : "=r"(p1) : "r"(b1), "r"((u32)rec->unk22 * 8));
                rec->unkE = *p1;
                b2 = (u16 *)((u8 *)rec + 0xE8);
                asm("addu %0,%1,%2" : "=r"(p2) : "r"(b2), "r"((u32)rec->unk22 * 8));
                rec->unk2C = *p2;
                b3 = (u16 *)((u8 *)rec + 0xEA);
                asm("addu %0,%1,%2" : "=r"(p3) : "r"(b3), "r"((u32)rec->unk22 * 8));
                rec->unk2E = *p3;
                break;
            }
        }
    }
}