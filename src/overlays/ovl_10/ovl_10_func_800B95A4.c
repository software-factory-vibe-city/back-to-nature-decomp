#include "common.h"

int FntPrint();
int McxGetSerial(int, unsigned long *);

extern char D_800B822C[];
extern long D_800BB8FC;

int ovl_10_func_800B95A4(int arg0) {
    if (arg0 == 2) {
        return McxGetSerial(0, &D_800BB8FC);
    }
    FntPrint(&D_800B822C, D_800BB8FC);
    return 0;
}
