#include "common.h"

s16 D_8005E44C;

/*
 * Sets D_8005E44C (a mode/state s16) by looking up arg0 in the table D_80049050.
 * arg0 is clamped to 2 if it is >= 3 (i.e. out-of-range values are treated as
 * index 2 — the last valid entry).  The table holds s16 values; the selected
 * entry is stored into D_8005E44C via a GP-relative half-word store.
 */
__asm__(
    "\n"
    "\t.set\tnoreorder\n"
    "\t.globl\tfunc_80017A70\n"
    "\t.ent\tfunc_80017A70\n"
    "func_80017A70:\n"
    "\tsltiu\t$v0,$a0,3\n"
    "\tbnez\t$v0,.L80017A80\n"
    "\t\tlui\t$v0,%hi(D_80049050)\n"
    "\tli\t$a0,1\n"
    ".L80017A80:\n"
    "\taddiu\t$v0,$v0,%lo(D_80049050)\n"
    "\tsll\t$v1,$a0,1\n"
    "\taddu\t$v1,$v1,$v0\n"
    "\tlhu\t$a0,0($v1)\n"
    "\tnop\n"
    "\tsh\t$a0,%gp_rel(D_8005E44C)($gp)\n"
    "\tjr\t$ra\n"
    "\t\tnop\n"
    "\t.end\tfunc_80017A70\n"
);
