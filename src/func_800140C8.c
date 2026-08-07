#include "common.h"
#include "psyq/libpad.h"

s32 func_800140C8(s32 arg0) {
    PadPortPair ports;
    u8 *port;
    s32 result;

    ports = D_8005E2AC[0];
    port = (u8 *)&ports + arg0;
    result = 0;
    if (PadGetState(*port) == PadStateStable) {
        result = PadSetActAlign(*port, D_80048B14);
    }
    return result;
}
