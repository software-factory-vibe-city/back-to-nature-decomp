#include "common.h"

__asm__(
"\n.set\tnoreorder\n"
".globl\tfunc_8001FD74\n"
".ent\tfunc_8001FD74\n"
"func_8001FD74:\n"
"\tlui\t$v1,%hi(D_80061F1C)\n"
"\tlw\t$v0,%lo(D_80061F1C)($v1)\n"
"\tjr\t$ra\n"
"\tsltu\t$v0,$zero,$v0\n"
".end\tfunc_8001FD74\n"
".set\treorder"
);
