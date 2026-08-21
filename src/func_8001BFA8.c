#include "common.h"

void func_8001BFA8(void *arg0, void *arg1) {
    s32 n;

    *(void **) arg0 = (void *) arg1;
    n = *(s32 *) ((char *) arg1 + 8);
    if (n >= 2) {
        *(void **) ((char *) arg0 + 4) = (void *) ((char *) arg1 + ((n * 28) + 12));
    } else {
        *(void **) ((char *) arg0 + 4) = 0;
    }
}
