/* De-superstition sweep candidate for func_8001E7DC — NOT matching.
 *
 * FULL TACTICS RECORD: notes/research/func_8001E7DC-allocator-preference-battle.md
 * (read that first; below is the summary of where the frontier is)
 *
 * PROGRESS (2026-07-25, deep allocator investigation):
 * The original candidate's failure mode (CSE folding the walk pointer into
 * indexed addressing on $4) is SOLVED: walk arg0 DIRECTLY. A plain
 * `a2 = arg0` copy is merged by cse1's make_regs_eqv into arg0's quantity,
 * after which every `a2++` records an (arg0 + k*4) value and cse substitutes
 * it into later load addresses (cascade kills copy + increments).
 * Walking arg0 itself makes its pseudo's sets self-referential, which cse
 * cannot value-number, so the walk survives. Result: instruction selection,
 * scheduling and delay-slot placement match the target EXACTLY.
 *
 * REMAINING DIFF (3 register renames only): whole function matches with
 * the walk/load-temp hard regs swapped:
 *   target:  move a2,a0 / lw a0,0(a1) / ... addiu a2,a2,4 ... slt a0,v1,t0
 *   ours:    (no move)   / lw a2,0(a1) / ... addiu a0,a0,4 ... slt a2,v1,t0
 *
 * Mechanism (verified against vendored gcc-2.95.2 local-alloc.c/global.c
 * and by compilerTrace experiments):
 * - The walk pseudo (81 = arg0) holds a hard_reg_copy_preference for $4
 *   from the entry copy (set 81 (reg 4)); global-alloc always honors it:
 *   81 -> $4, the move becomes $4,$4 and dies, load temp falls to $6.
 * - Pseudo refs and REG_LIVE_LENGTH are computed on the FINAL schedule, so
 *   they are invariant across source statement orders (verified: bound-first,
 *   swapped check-3 loads — same spans). Walk: 8 refs/26 insns -> priority
 *   3*8/26*10000 = 9230; load temp: 6 refs/13 -> 2*6/13*10000 = 9230.
 *   EXACT tie (24/26 == 12/13); tie-break is allocno number == pseudo
 *   creation order, so arg0's pseudo always wins and takes $4.
 * - For the target shape, the load temp must be allocated BEFORE the walk
 *   (it then takes $4 as first free reg: $2 conflicts, $3/$5 taken by
 *   winner-update from v1/arg1) and the walk's $4-pref is then neutralized
 *   by the winner-update (4 enters its hard_reg_conflicts) -> walk -> $6.
 * - Structural families that fail to reach that order:
 *   FORWARD (walk=arg0): load temp can never outrank 81 (refs/span fixed
 *     by the identical final schedule; tie always lost on allocno number).
 *   REVERSE (load temp=arg0, walk=copy `a2=arg0`): combine folds the copy
 *     chain (arg0's entry value dies at the copy), deleting the entry copy
 *     and giving the WALK pseudo the $4 copy-preference; walk then has
 *     priority 9600 > 9230 and takes $4 itself. Making arg0's entry value
 *     survive the copy is impossible: its only use is the copy (target's
 *     first load already clobbers $4 with the arg1 value).
 *   COPY+SEPARATE TEMP (old candidate): cse merge cascade (above).
 *
 * Update 2 (same day): the tie is BEATABLE — placing the increments before
 * the delta computation (`v1 = arg0[0]; arg0++; v1 = v1 - a0_val; arg1++;`
 * in both checks) shrinks the load temp's live-length 13 -> 9, priority
 * 13333 > 9230, so it is allocated BEFORE the walk. But then the walk's $4
 * preference poisons someone_prefers[load-temp], blocking $4 in pass-0.
 * Remaining step: give the load temp its OWN $4 preference (self-prefs
 * subtract from someone_prefers) via an expand_preferences dying-input
 * merge in check 3 — see section 6 of the research doc for the candidate
 * c3 shapes. The variant below is the plain forward one (tie state), NOT
 * the V2 state; reconstruct V2 from the doc if needed.
 */
#include "common.h"

extern s32 D_8005E520;

s32 func_8001E7DC(s32 *arg0, s32 *arg1) {
    s32 a0_val;
    s32 a3;
    s32 t0;
    s32 v1;
    s32 v0;

    a0_val = arg1[0];
    arg1++;
    v1 = arg0[0];
    v1 = v1 - a0_val;
    a3 = (D_8005E520 >> 1) + 0x258;
    t0 = -a3;
    arg0++;
    if (v1 < t0) {
        goto fail;
    }
    if (!(a3 < v1)) {
        goto check_y;
    }
fail:
    return 0;
check_y:
    a0_val = arg1[0];
    arg1++;
    v1 = arg0[0];
    v1 = v1 - a0_val;
    arg0++;
    if (v1 < t0) {
        goto fail;
    }
    if (a3 < v1) {
        goto fail;
    }
    v0 = arg0[0];
    v1 = arg1[0];
    v1 = v0 - v1;
    a0_val = (v1 < t0);
    if (a0_val) {
        goto fail;
    }
    if (a3 < v1) {
        goto fail;
    }
    return 1;
}
