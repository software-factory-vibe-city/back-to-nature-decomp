#include "common.h"

u16 D_8005E446;

/* Triggers/starts the event tracked by D_8005E446: transitions the flag from
 * 0 (idle) to 1 (started).  If the flag is already non-zero (already started
 * or in another state) this is a no-op, preventing double-starts. */
void func_80017ACC(void) {
    if (D_8005E446 == 0) {
        D_8005E446 = 1;
    }
}
