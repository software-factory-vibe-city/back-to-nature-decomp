#include "common.h"

u16 D_8005E444;
u16 D_8005E446;

/* Commits/ends the event tracked by D_8005E446: if the flag is 1 (started) or
 * 3 (another active state), clears the flag back to 0 (idle) and increments
 * the D_8005E444 completion counter.  This pairs with func_80017ACC which sets
 * the flag to 1 to begin the event. */
void func_80017AE8(void) {
    if ((D_8005E446 == 1) || (D_8005E446 == 3)) {
        D_8005E446 = 0;
        D_8005E444 += 1;
    }
}
