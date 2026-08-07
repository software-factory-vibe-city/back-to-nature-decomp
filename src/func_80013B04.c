#include "common.h"
#include "psyq/libpad.h"
#include "game_types.h"

/*
 * The nesting is load-bearing and is not a style choice. `port << 3`,
 * `port + 1` and `&ports + port` are invariant with respect to the inner
 * retry loop, so they belong in its preheader, which is where the target
 * keeps them ($s2, $s6, and the $s5 + $s1 pointer, computed between the two
 * loop headers). Flattening this into one loop with `continue` makes them
 * vary, and no amount of source rearrangement recovers the position.
 */

void func_80013F90(Struct80013F90 *arg0);
s32 func_800140C8(s32 arg0);
void func_80013CD0(void *arg0, s32 arg1);

void func_80013B04(void) {
    PadPortPair ports;
    s32 port;
    s32 retry;
    u32 state;

    ports = D_8005E2AC[0];
    for (port = 0; port < 2; port++) {
        retry = 1;
        do {
            state = PadGetState(((u8 *)&ports)[port]);
            if (state < 7) {
                switch (state) {
                case 0:
                case 1:
                    if (!(D_8006C844 & 0x10000)) {
                        D_8005E3E8[port] = 0;
                        D_8005E2A4[port] = 1;
                        func_80013F90((Struct80013F90 *)((char *)&D_8005E870 + (((port << 3) - port) << 3)));
                        retry = 0;
                        continue;
                    }
                    break;
                case 4:
                case 5:
                    func_80013F90((Struct80013F90 *)((char *)&D_8005E870 + (((port << 3) - port) << 3)));
                    retry = 0;
                    continue;
                case 6:
                    if (D_8005E2A4[port] == 1) {
                        D_8005E3E8[port] = PadInfoMode(((u8 *)&ports)[port], 2, 0);
                        if (func_800140C8(port) != 0) {
                            D_8005E2A4[port] = 0;
                            func_80013F90((Struct80013F90 *)((char *)&D_8005E870 + (((port << 3) - port) << 3)));
                            continue;
                        }
                    }
                    break;
                }
            }
            func_80013CD0((char *)&D_8005E870 + (((port << 3) - port) << 3), port & 0xFF);
            retry = 0;
        } while (retry == 1);
    }
}
