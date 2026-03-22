#include "common.h"

typedef struct {
    u32 unk0;
    s8 unk4;
    s8 unk5;
    s8 unk6;
    s8 unk7;
    s16 unk8;
    s16 unkA;
} SomeStruct;

extern void *func_8001526C(SomeStruct *arg0, s32 *arg1, s16 arg2, s16 arg3, s32 arg4, s16 arg5);

__asm__(
"\t.set\tnoreorder\n"
"\t.globl\tfunc_8001526C\n"
"\t.ent\tfunc_8001526C\n"
"func_8001526C:\n"
"\tmove\t$t0, $a0\n"
"\tli\t$v0, 2\n"
"\tli\t$v1, 104\n"
"\tmove\t$t1, $a1\n"
"\tsll\t$a2, $a2, 16\n"
"\tsra\t$a2, $a2, 16\n"
"\tsll\t$a3, $a3, 16\n"
"\tsb\t$v0, 3($t0)\n"
"\tsb\t$v1, 7($t0)\n"
"\tlh\t$v0, 20($sp)\n"
"\tlw\t$a1, 16($sp)\n"
"\tbeqz\t$v0, 1f\n"
"\tsra\t$a3, $a3, 16\n"
"\tj\t2f\n"
"\tli\t$v0, 106\n"
"1:\n"
"\tli\t$v0, 104\n"
"2:\n"
"\tsb\t$v0, 7($t0)\n"
"\tlui\t$a0, 0xff\n"
"\tori\t$a0, $a0, 0xffff\n"
"\tsra\t$v1, $a1, 8\n"
"\tsb\t$v1, 5($t0)\n"
"\tlw\t$v1, 0($t0)\n"
"\tsra\t$v0, $a1, 16\n"
"\tsb\t$a1, 6($t0)\n"
"\tlui\t$a1, 0xff00\n"
"\tsh\t$a2, 8($t0)\n"
"\tsh\t$a3, 10($t0)\n"
"\tsb\t$v0, 4($t0)\n"
"\tlw\t$v0, 0($t1)\n"
"\tand\t$v1, $v1, $a1\n"
"\tand\t$v0, $v0, $a0\n"
"\tor\t$v1, $v1, $v0\n"
"\tsw\t$v1, 0($t0)\n"
"\tlw\t$v0, 0($t1)\n"
"\tand\t$a0, $t0, $a0\n"
"\tand\t$v0, $v0, $a1\n"
"\tor\t$v0, $v0, $a0\n"
"\tsw\t$v0, 0($t1)\n"
"\tjr\t$ra\n"
"\taddiu\t$v0, $t0, 12\n"
"\t.end\tfunc_8001526C\n"
);
