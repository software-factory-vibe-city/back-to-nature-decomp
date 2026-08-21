#include "common.h"

/* func_8001FBBC - stop the song sequence in track slot (arg0, 0) and return 0.
 *
 * Thin wrapper over func_80020414: the outgoing slot index is the sign-extended
 * s16 argument, the sub-slot is 0, and the caller's voice is reported to have
 * been stopped by returning 0 like func_80020414 does.
 */

s32 func_8001FBBC(s16 arg0) {
    func_80020414(arg0, 0);
    return 0;
}
