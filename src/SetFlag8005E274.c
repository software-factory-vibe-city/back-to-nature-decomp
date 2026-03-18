#include "common.h"

extern u8 D_8005E274;

/* Setter for D_8005E274 - see GetFlag8005E274 for getter */
void SetFlag8005E274(u8 arg0) {
    D_8005E274 = arg0;
}
