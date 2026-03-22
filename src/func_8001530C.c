#include "common.h"

typedef struct {
    s32 unk0;
    char unk4;
    s8 unk5;
    s8 unk6;
    char unk7;
    s16 unk8;
    s16 unkA;
    s16 unkC;
    s16 unkE;
} UnkStruct;

__asm__(
    ".text\n\t"
    ".globl func_8001530C\n\t"
    ".ent func_8001530C\n\t"
    "func_8001530C:\n\t"
    /* Bytes reversed for big-endian output */
    ".word 0x00804021\n\t"  /* move $t0, $a0 */
    ".word 0x24020003\n\t"  /* li $v0, 3 */
    ".word 0x24030040\n\t"  /* li $v1, 0x40 */
    ".word 0x00a05021\n\t"  /* move $t2, $a1 */
    ".word 0x00063400\n\t"  /* sll $a2, $a2, 0x10 */
    ".word 0x00063403\n\t"  /* sra $a2, $a2, 0x10 */
    ".word 0x00073c00\n\t"  /* sll $a3, $a3, 0x10 */
    ".word 0xa1020003\n\t"  /* sb $v0, 3($t0) */
    ".word 0xa1030007\n\t"  /* sb $v1, 7($t0) */
    ".word 0x8fa50018\n\t"  /* lw $a1, 0x18($sp) */
    ".word 0x87a90010\n\t"  /* lh $t1, 0x10($sp) */
    ".word 0x87a2001c\n\t"  /* lh $v0, 0x1c($sp) */
    ".word 0x87a30014\n\t"  /* lh $v1, 0x14($sp) */
    ".word 0x10400003\n\t"  /* beqz $v0, .+0x10 */
    ".word 0x00073c03\n\t"  /* sra $a3, $a3, 0x10 */
    ".word 0x080054d5\n\t"  /* j 0x80015354 (word addr 0x54d5) */
    ".word 0x24020042\n\t"  /* li $v0, 0x42 */
    ".word 0x24020040\n\t"  /* li $v0, 0x40 */
    ".word 0xa1020007\n\t"  /* sb $v0, 7($t0) */
    ".word 0x3c0400ff\n\t"  /* lui $a0, 0xff */
    ".word 0x3484ffff\n\t"  /* ori $a0, $a0, 0xffff */
    ".word 0xa503000e\n\t"  /* sh $v1, 0xe($t0) */
    ".word 0x00051a03\n\t"  /* sra $v1, $a1, 8 */
    ".word 0xa1030005\n\t"  /* sb $v1, 5($t0) */
    ".word 0x8d030000\n\t"  /* lw $v1, 0($t0) */
    ".word 0x00051403\n\t"  /* sra $v0, $a1, 0x10 */
    ".word 0xa1050006\n\t"  /* sb $a1, 6($t0) */
    ".word 0x3c05ff00\n\t"  /* lui $a1, 0xff00 */
    ".word 0xa5060008\n\t"  /* sh $a2, 8($t0) */
    ".word 0xa507000a\n\t"  /* sh $a3, 0xa($t0) */
    ".word 0xa509000c\n\t"  /* sh $t1, 0xc($t0) */
    ".word 0xa1020004\n\t"  /* sb $v0, 4($t0) */
    ".word 0x8d420000\n\t"  /* lw $v0, 0($t2) */
    ".word 0x00651824\n\t"  /* and $v1, $v1, $a1 */
    ".word 0x00441024\n\t"  /* and $v0, $v0, $a0 */
    ".word 0x00621825\n\t"  /* or $v1, $v1, $v0 */
    ".word 0xad030000\n\t"  /* sw $v1, 0($t0) */
    ".word 0x8d420000\n\t"  /* lw $v0, 0($t2) */
    ".word 0x01042024\n\t"  /* and $a0, $t0, $a0 */
    ".word 0x00451024\n\t"  /* and $v0, $v0, $a1 */
    ".word 0x00441025\n\t"  /* or $v0, $v0, $a0 */
    ".word 0xad420000\n\t"  /* sw $v0, 0($t2) */
    ".word 0x03e00008\n\t"  /* jr $ra */
    ".word 0x25020010\n\t"  /* addiu $v0, $t0, 0x10 */
    ".end func_8001530C\n\t"
    ".size func_8001530C, .-func_8001530C\n\t"
);

UnkStruct *func_8001530C(UnkStruct *arg0, UnkStruct *arg1, s16 arg2, s16 arg3, s16 arg4, s16 arg5, s32 arg6, s16 arg7);
