	.file	1 "src/overlays/ovl_11/ovl_11_func_800CF36C.c"

 # -G value = 0, Cpu = r3000, ISA = 1
 # GNU C version 2.95.2 19991024 (release) (mips-sony-psx) compiled by GNU C version 9.4.0.
 # options passed:  -O2 -G0 -mips1 -mcpu=r3000 -funsigned-char -fpeephole
 # -ffunction-cse -fpcc-struct-return -fcommon -fverbose-asm -msoft-float
 # -mgas -fgnu-linker
 # options enabled:  -fdefer-pop -fomit-frame-pointer -fcse-follow-jumps
 # -fcse-skip-blocks -fexpensive-optimizations -fthread-jumps
 # -fstrength-reduce -fpeephole -fforce-mem -ffunction-cse -finline
 # -fkeep-static-consts -fcaller-saves -fpcc-struct-return -fdelayed-branch
 # -fgcse -frerun-cse-after-loop -frerun-loop-opt -fschedule-insns
 # -fschedule-insns2 -fcommon -fverbose-asm -fgnu-linker -fregmove
 # -foptimize-register-move -fargument-alias -fident -msplit-addresses
 # -mgas -msoft-float -mcpu=r3000 -mips1

gcc2_compiled.:
__gnu_compiled_c:
 #APP
	.include "include/macro.inc"

 #NO_APP
	.text
	.align	2
	.globl	ovl_11_func_800CF36C
	.ent	ovl_11_func_800CF36C
ovl_11_func_800CF36C:
	.frame	$sp,48,$31		# vars= 0, regs= 7/0, args= 16, extra= 0
	.mask	0x803f0000,-8
	.fmask	0x00000000,0
	subu	$sp,$sp,48
	sw	$21,36($sp)
	move	$21,$4
	lui	$2,%hi(D_80075BC4) # high
	sw	$16,16($sp)
	addiu	$16,$2,%lo(D_80075BC4) # low
	sw	$20,32($sp)
	li	$20,131072			# 0x20000
	lui	$2,%hi(D_8006C838) # high
	sw	$19,28($sp)
	addiu	$19,$2,%lo(D_8006C838) # low
	sw	$17,20($sp)
	li	$17,5			# 0x5
	sw	$18,24($sp)
	li	$18,16777216			# 0x1000000
	sw	$31,40($sp)
$L9:
	lw	$2,52($16)
	#nop
	and	$2,$2,$20
	beq	$2,$0,$L7
	beq	$21,$0,$L6
$L7:
	lhu	$2,0($16)
	#nop
	andi	$2,$2,0x15b
	beq	$2,$0,$L8
	lw	$2,17656($19)
	#nop
	and	$2,$2,$18
	bne	$2,$0,$L6
$L8:
	.set	noreorder
	.set	nomacro
	jal	ovl_11_func_800D3200
	move	$4,$16
	.set	macro
	.set	reorder

$L6:
	addu	$17,$17,-1
	.set	noreorder
	.set	nomacro
	bgez	$17,$L9
	addu	$16,$16,176
	.set	macro
	.set	reorder

	lw	$31,40($sp)
	lw	$21,36($sp)
	lw	$20,32($sp)
	lw	$19,28($sp)
	lw	$18,24($sp)
	lw	$17,20($sp)
	lw	$16,16($sp)
	#nop
	.set	noreorder
	.set	nomacro
	j	$31
	addu	$sp,$sp,48
	.set	macro
	.set	reorder

	.end	ovl_11_func_800CF36C
