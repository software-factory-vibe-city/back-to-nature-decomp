#include "common.h"

typedef struct {
    char pad[5];
    u8 field_5;
    s16 field_6;
} func_8001585C_struct;

void func_8001585C(void *arg0, s8 arg1) {
    ((func_8001585C_struct *)arg0)->field_5 = arg1;
    ((func_8001585C_struct *)arg0)->field_6 = 0;
}
