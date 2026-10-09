#include "common.h"
#include "psyq/strings.h"

extern u8 D_8012E040[];
extern u8 D_8012E044[];
extern u8 D_801376C8[];

s8 *ovl_15_func_80134890(s16 arg0, s8 *arg1, s16 arg2) {
    s16 q;

    *arg1 = 0;
    D_801376C8[0] = 0;
    if (arg2 != 1) {
        if (((arg0 / 10) << 16) == 0) {
            strcat((char *)D_801376C8, (char *)D_8012E040);
        } else {
            strcat((char *)D_801376C8, (char *)D_8012E044);
            D_801376C8[1] = D_801376C8[1] + arg0 / 10;
        }
        strcat((char *)arg1, (char *)D_801376C8);
    }
    D_801376C8[0] = 0;
    strcat((char *)D_801376C8, (char *)D_8012E044);
    q = arg0 / 10;
    D_801376C8[1] = D_801376C8[1] + (arg0 - q * 10);
    return (s8 *)strcat((char *)arg1, (char *)D_801376C8);
}
