/*
Force two separate return blocks with inline assembly labels
*/
#include "common.h"

__asm__("
.set noat
.set noreorder
");

s32 func_8001D2D8(s16 arg0, s16 arg1, s16 arg2, s16 arg3);

__asm__("
.global func_8001D2D8
func_8001D2D8:
    sll     $v1, $a0, 0x10
    sra     $v0, $v1, 0x10
    addiu   $v0, $v0, 0x13
    andi    $v0, $v0, 0xFFFF
    sltiu   $v0, $v0, 0x153
    beqz    $v0, _8001D2FC
    sll     $v1, $a1, 0x10
_8001D2F4:
    jr      $ra
    addiu   $v0, $zero, 0x1
_8001D2FC:
    sra     $v0, $v1, 0x10
    addiu   $v0, $v0, 0x13
    andi    $v0, $v0, 0xFFFF
    sltiu   $v0, $v0, 0x153
    bnez    $v0, _8001D2F4
    sll     $v1, $a2, 0x10
    sra     $v0, $v1, 0x10
    addiu   $v0, $v0, 0x13
    andi    $v0, $v0, 0xFFFF
    sltiu   $v0, $v0, 0x153
    bnez    $v0, _8001D340
    sll     $v0, $a3, 0x10
    sra     $v0, $v0, 0x10
    addiu   $v0, $v0, 0x13
    andi    $v0, $v0, 0xFFFF
    jr      $ra
    sltiu   $v0, $v0, 0x153
_8001D340:
    jr      $ra
    addiu   $v0, $zero, 0x1
");
