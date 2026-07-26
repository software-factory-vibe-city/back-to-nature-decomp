/* func_8001AF44 — SOLVED clean (2026-07-25), 100% match, full build verified.
 *
 * Final source (now in src/func_8001AF44.c):
 *
 *   s32 func_8001AF44(u32 arg0) {
 *       struct struct_8006C838_flags *flags;
 *       u32 index;
 *       arg0 = arg0 & 0xFFFF;
 *       index = arg0 >> 5;
 *       flags = (struct struct_8006C838_flags *)&D_8006C838;
 *       return (flags->flags[index] >> (arg0 & 0x1F)) & 1;
 *   }
 *
 * with struct struct_8006C838_flags { char pad[0x38]; u32 flags[0x800]; }
 * added to include/globals_override.h.
 *
 * Mechanism (why the old candidate below stuck at 90.9%):
 * - Sticking point was one commutative operand order:
 *     target: addu v1,v1,v0 (base first)   ours: addu v1,v0,v1 (offset first)
 * - GCC 2.95.2's CSE pass canonicalizes commutative operands: at the end of
 *   fold_rtx, an operand whose quantity has a recorded CONSTANT_P equivalent
 *   (here the base reg's lo_sum address value) is placed SECOND
 *   ("place any constant second"). Source-level operand swaps are
 *   canonicalized away — this is why all operand-order perturbations failed.
 * - Escape: change the RTL web shape so the addu's destination is a FRESH
 *   compiler web born from a natural address expression instead of reusing
 *   the base user-variable. Writing the access as a struct-field array
 *   (f->words[idx], field at offset 0x38) makes expand keep the scaled-index
 *   plus inside the MEM address; the forced-out addu then keeps expand's
 *   base-first operand order and cse's constant-second rule does not fire
 *   on the surviving insn order. Statement order (index shift before base
 *   assignment) fixes the srl-before-lui schedule.
 * - Register-pinned legacy hack removed; no barrier needed.
 *
 * ---- old 90.9% candidate, kept for reference ----
 * Remaining diff was: ONE instruction, commutative operand order only.
 * Tried: swapping source operand order (canonicalized away), base-first
 * statements, fresh temp for sum, constant-fused base, pointer-index
 * arithmetic, index offset (+14). Each fix for operand order breaks
 * schedule/allocation elsewhere.
 *
 * #include "common.h"
 *
 * s32 func_8001AF44(u32 arg0) {
 *     u32 temp_v0;
 *     u32 *temp_v1;
 *
 *     arg0 = arg0 & 0xFFFF;
 *     temp_v0 = arg0 >> 5;
 *     temp_v1 = (u32 *)&D_8006C838;
 *     temp_v0 <<= 2;
 *     temp_v1 = (u32 *)((char *)temp_v1 + temp_v0);
 *     return (*(u32 *)((char *)temp_v1 + 0x38) >> (arg0 & 0x1F)) & 1;
 * }
 */
