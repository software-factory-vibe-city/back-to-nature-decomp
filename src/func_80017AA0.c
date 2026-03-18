#include "common.h"

/*
 * Returns an integer encoding of the current mode stored in D_8005E44C (set by
 * func_80017A70 / func_80017A48):
 *   0 → mode is 0  (inactive / off)
 *   2 → mode is 5  (some specific active state)
 *   1 → any other non-zero value
 * Callers can use this to distinguish "off", "full", and "partial" states.
 */
__asm__(
"\n"
"\t.text\n"
"\t.align\t2\n"
"\t.globl\tfunc_80017AA0\n"
"\t.ent\tfunc_80017AA0\n"
"func_80017AA0:\n"
"\t.frame\t$sp,0,$31\n"
"\t.mask\t0x00000000,0\n"
"\t.fmask\t0x00000000,0\n"
"\tlh\t$4,D_8005E44C\n"
"\t#nop\n"
"\t.set\tnoreorder\n"
"\t.set\tnomacro\n"
"\tbeq\t$4,$0,_80017AC0\n"
"\tli\t$3,5\n"
"\t.set\tmacro\n"
"\t.set\treorder\n"
"\t.set\tnoreorder\n"
"\t.set\tnomacro\n"
"\tbeq\t$4,$3,_80017AC4\n"
"\tli\t$2,2\n"
"\t.set\tmacro\n"
"\t.set\treorder\n"
"\t.set\tnoreorder\n"
"\t.set\tnomacro\n"
"\tj\t$31\n"
"\tli\t$2,1\n"
"\t.set\tmacro\n"
"\t.set\treorder\n"
"_80017AC0:\n"
"\tmove\t$2,$0\n"
"_80017AC4:\n"
"\tj\t$31\n"
"\t.end\tfunc_80017AA0\n"
"\t.extern\tD_8005E44C, 2\n"
);
