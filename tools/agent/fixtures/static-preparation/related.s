.set noat
.set noreorder
glabel fixture_caller
    addiu $sp, $sp, -24
    sw $ra, 16($sp)
    jal fixture_callee
    nop
    lw $ra, 16($sp)
    nop
    jr $ra
    addiu $sp, $sp, 24

glabel fixture_callee
    lhu $v0, 2($a0)
    jr $ra
    nop
