#include "common.h"
#include "psyq/memory.h"

/* Tentative definitions — this TU owns these GP-relative globals
 * (every one of them is accessed via %gp_rel in the target). */
s32 D_8005E538;
s32 D_8005E540;
s32 D_8005E544;
s32 D_8005E548;
s32 D_8005E54C;
s32 D_8005E554;
s32 D_8005E560;
s32 D_8005E57C;

/* Call-site declarations evidenced from the target bytes.
 * SsVabOpenHead matches the PSY-Q libsnd.h two-argument prototype
 * `short SsVabOpenHead(unsigned char*, short)`: the target's a2 (D_8005E544)
 * is the D_8006BF28 store value, not a call argument.  func_80021604 is void
 * (its definition TU declares void); the delay-slot `sw v0,0(v1)` after the
 * call stores head (still in v0), not a return value. */
s32 func_80014988(s32, s32, s32, s32, s32);
void func_800214FC(s16);
void func_800215EC(s32, s32, s32);
void func_80021604(s32);
s32 func_80021668(void);
s32 SsVabOpenHead(s32, s32);
s32 SsVabTransCompleted(s32);

s32 func_80020E58(void) {
    s32 value;

    switch (D_8005E538) {
    case 0x28:
    {
        s32 len;

        len = D_80049370[(&D_8006BF48)[D_8005E554] + 2] -
              D_80049370[(&D_8006BF48)[D_8005E554]];

        (&D_8006C048)[D_8005E560] =
            D_80049370[(&D_8006BF48)[D_8005E554] + 1];
        D_8005E57C = len;
        memcpy((void *)D_8005E548, (void *)D_8005E54C, len);
        D_8005E538 = 0;
        {
            s32 *c028 = &D_8006C028;
            s32 *c068 = &D_8006C068;
            s32 *ba8 = &D_8006BFA8;

            c028[D_8005E560] = D_8005E548;
            c068[D_8005E560] = ba8[(&D_8006BF88)[D_8005E554]];
        }
        D_8005E548 += D_80049370[(&D_8006BF48)[D_8005E554] + 2] -
                      D_80049370[(&D_8006BF48)[D_8005E554]];
        D_8005E560 += 1;
        D_8005E554 += 1;
        break;
    }
    case 0xA:
    {
        s32 head;

        memcpy((void *)D_8005E548, (void *)D_8005E54C,
               D_80049370[(&D_8006BF48)[D_8005E554] + 1] -
                   D_80049370[(&D_8006BF48)[D_8005E554]]);
        (&D_8006BF28)[D_8005E540] = D_8005E544;
        head = SsVabOpenHead(D_8005E548, -1);
        (&D_8006BFA8)[D_8005E540] = head;
        func_80021604(head);
        D_8005E538 = 0x3C;
        break;
    }
    case 0x14:
        SsVabTransCompleted(1);
        D_8005E538 = 0;
        (&D_8006BFE8)[D_8005E540] = D_8005E548;
        D_8005E548 += D_80049370[(&D_8006BF48)[D_8005E554] + 1] -
                      D_80049370[(&D_8006BF48)[D_8005E554]];
        (&D_8006C008)[D_8005E540] = D_8005E548;
        D_8005E540 += 1;
        D_8005E554 += 1;
        break;
    case 0x0:
        func_800214FC(*(s16 *)(&D_8006BF48 + D_8005E554));
        break;
    case 0x1E:
        value = (&D_8006BF48)[D_8005E554];

        if (func_80014988(9, D_80049370[value],
                          D_80049370[value + 1] - D_80049370[value],
                          D_8005E54C, 0) == 1) {
            D_8005E538 = 0xA;
            func_800215EC(value, D_8005E54C, 0x2D000);
        }
        break;
    case 0x32:
        value = (&D_8006BF48)[D_8005E554];

        if (func_80014988(9, D_80049370[value],
                          D_80049370[value + 2] - D_80049370[value],
                          D_8005E54C, 0) == 1) {
            D_8005E538 = 0x28;
        }
        break;
    case 0x3C:
        if (func_80021668() != 0) {
            D_8005E538 = 0x14;
            D_8005E544 += D_80049370[(&D_8006BF48)[D_8005E554] + 2] -
                          D_80049370[(&D_8006BF48)[D_8005E554] + 1];
        }
        break;
    default:
        break;
    }
    return (&D_8006BF48)[D_8005E554];
}
