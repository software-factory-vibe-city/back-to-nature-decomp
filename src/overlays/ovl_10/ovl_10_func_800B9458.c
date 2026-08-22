#include "common.h"

int FntPrint();
int McxGetApl(int, long *);

extern char D_800B8194[];
extern long D_800BB8F0;

int ovl_10_func_800B9458(int arg0) {
    if (arg0 == 2) {
        return McxGetApl(0, &D_800BB8F0);
    }
    FntPrint(&D_800B8194, D_800BB8F0);
    return 0;
}
