#include "common.h"

/* Game callees (signatures from include/functions.h; local declaration per
 * project convention). */
s32 func_8001AE34(void);
s16 *func_8001A870(s32 arg0, s16 *arg1, s32 arg2);
void func_8001A574(s32 arg0);

/* Tentative definition: the target reaches D_8005E490 via $gp, so this
 * translation unit owns the symbol. */
s16 D_8005E490;

s32 func_8001A284(s32 arg0) {
    s32 result = 0;
    s32 value;
    s32 neg1;
    unsigned char *dst;

    switch (arg0 & 0xFFF) {
    case 10:
        result = (s32)((unsigned char *)&D_8006C838 + 0x51C8);
        break;
    case 11:
        result = (s32)&D_80075AD8;
        break;
    case 12:
        result = (s32)&D_800759E8;
        break;
    case 13:
        result = (s32)&D_80070D18;
        break;
    case 14:
        result = (s32)&D_8007AFBC;
        break;
    case 15: {
        unsigned char *base;

        /* Two-stage base formation keeps the +0x8000 materialized at
         * runtime (lui/addiu/ori/addu) instead of folding it into the load
         * offset; same idiom as matched sibling func_80021E60. */
        value = (s32)&D_8006C838;
        base = (unsigned char *)(value + 0x8000);
        switch (*(u16 *)(base + 0x676C)) {
        case 0:
            result = (s32)((unsigned char *)&D_8006C838 + 0x51C8);
            break;
        case 1:
            result = D_80054BC0[0] + (s32)&D_8005175C;
            break;
        case 2:
            result = D_80054BC0[0] + (s32)&D_80051768;
            break;
        default:
            result = 0;
            break;
        }
        break;
    }
    case 16:
        result = (s32)func_8001A870(func_8001AE34(), &D_8005E490, 4);
        break;
    case 17:
        result = (s32)func_8001A870(D_800712C0, &D_8005E490, 4);
        break;
    case 18:
        result = (s32)func_8001A870(D_80070D3A, &D_8005E490, 4);
        break;
    case 19:
        result = (s32)func_8001A870(D_80070D38, &D_8005E490, 4);
        break;
    case 20:
        result = (s32)func_8001A870(D_80070D40, &D_8005E490, 4);
        break;
    case 21:
        result = (s32)func_8001A870(D_80070D3E, &D_8005E490, 4);
        break;
    case 22: {
        unsigned char *base;
        base = (unsigned char *)&D_8006C838;
        base += 0x8000;
        neg1 = -1;
        value = *(s16 *)(base + 0x19CA);
        goto check_neg1;
    }
    case 23: {
        unsigned char *base;
        base = (unsigned char *)&D_8006C838;
        base += 0x8000;
        value = *(s16 *)(base + 0x19CE);
        neg1 = -1;
    }
    check_neg1:
        if (value != neg1) {
            result = (s32)&D_800749F8 + value * 0xB8;
        }
        break;
    case 24: {
        unsigned char *base;
        base = (unsigned char *)&D_8006C838;
        base += 0x8000;
        result = *(s32 *)(base + 0x6620);
        break;
    }
    case 25:
    case 26: {
        unsigned char *flags;
        dst = (unsigned char *)&D_800749F8;
        flags = (unsigned char *)&D_8006C838;
        flags += 0x81F0;
        value = 0;
        while (value < 20) {
            if (*(s32 *)flags & 0x400) {
                result = (s32)dst;
            }
            dst += 0xB8;
            value++;
            flags += 0xB8;
        }
        break;
    }
    case 33: {
        unsigned char *base;
        s16 *dest;
        dest = &D_8005E490;
        /* Scheduling barrier (tracked debt): the target emits the
         * `addiu a1,gp,%gp_rel(D_8005E490)` argument materialization
         * BEFORE the D_8006C838 base formation; the compiler ties the two
         * on priority and places the addiu after the `addu` by original
         * RTL position. Every hoisted-statement spelling is folded back to
         * the call site by CSE, so no clean statement order reaches the
         * target order. The barrier keeps dest's early birth live without
         * emitting an instruction. */
        __asm__ volatile("" : "=r"(dest) : "0"(dest));
        base = (unsigned char *)&D_8006C838;
        base += 0x8000;
        result = (s32)func_8001A870(*(s16 *)(base + 0x26DA) + 1, dest, 4);
        break;
    }
    case 27:
        func_8001A574(0);
        result = (s32)D_8005F0F8;
        break;
    case 28:
        func_8001A574(1);
        result = (s32)D_8005F0F8;
        break;
    case 29:
        func_8001A574(2);
        result = (s32)D_8005F0F8;
        break;
    case 30:
        func_8001A574(3);
        result = (s32)D_8005F0F8;
        break;
    case 31:
        func_8001A574(4);
        result = (s32)D_8005F0F8;
        break;
    case 32:
        func_8001A574(5);
        result = (s32)D_8005F0F8;
        break;
    case 34: {
        unsigned char *f;
        unsigned char *flags;
        s32 mask;

        mask = 0x20000;
        f = (unsigned char *)&D_8006C838;
        flags = f + 0x7AB8;
        value = 0;
        while (value < 10) {
            if (*(s32 *)(flags + 0x30) & mask) {
                result = (s32)flags;
            }
            value++;
            flags += 0xB4;
        }
        break;
    }
    default:
        result = 0;
        break;
    }
    return result;
}
