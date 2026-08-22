	.file	1 "src/overlays/ovl_10/ovl_10_func_800BB728.c"

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
	.include "include/labels.inc"

 #NO_APP
	.text
	.align	2
	.globl	ovl_10_func_800BB728
	.ent	ovl_10_func_800BB728
ovl_10_func_800BB728:
	.frame	$sp,0,$31		# vars= 0, regs= 0/0, args= 0, extra= 0
	.mask	0x00000000,0
	.fmask	0x00000000,0
	move	$5,$4
	slt	$2,$5,81
	.set	noreorder
	.set	nomacro
	beq	$2,$0,$L3
	move	$6,$0
	.set	macro
	.set	reorder

	li	$2,1717960704			# 0x66660000
	ori	$2,$2,0x6667
	mult	$5,$2
	sra	$4,$5,31
	mfhi	$2
	#nop
	#nop
	sra	$2,$2,4
	subu	$2,$2,$4
	sll	$3,$2,2
	addu	$3,$3,$2
	sll	$3,$3,3
	addu	$2,$5,-1
	.set	noreorder
	.set	nomacro
	beq	$3,$2,$L6
	move	$2,$6
	.set	macro
	.set	reorder

	j	$L8
$L3:
	addu	$5,$5,-80
	li	$2,-2004353024			# 0x88880000
	ori	$2,$2,0x8889
	mult	$5,$2
	sra	$4,$5,31
	mfhi	$2
	#nop
	#nop
	addu	$2,$2,$5
	addu	$5,$5,-1
	sra	$2,$2,3
	subu	$2,$2,$4
	sll	$3,$2,4
	subu	$3,$3,$2
	.set	noreorder
	.set	nomacro
	bne	$3,$5,$L8
	move	$2,$6
	.set	macro
	.set	reorder

$L6:
	li	$6,1			# 0x1
	move	$2,$6
$L8:
	j	$31
	.end	ovl_10_func_800BB728
