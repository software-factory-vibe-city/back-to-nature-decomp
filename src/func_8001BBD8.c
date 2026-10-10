#include "common.h"
#include "include_asm.h"

INCLUDE_ASM("build/asm/nonmatchings/func_8001BBD8", func_8001BBD8);


/* PARKED by /auto_decompilation_loop on 2026-10-10T15:39:21.638Z.
 * Reason: asm-needs-human-approval.
 * Escalation reached: deepseek-v4-1-flash.
 * The best non-matching attempt is preserved verbatim below, disabled.
 * Findings and the decision needed: notes/human-needed-approvals/func_8001BBD8.md
 */

#if 0
/* Best non-matching attempt, preserved for the next session. */
#include "common.h"
#include "psyq/stddef.h"
#include "psyq/libgte.h"
#include "psyq/inline_c.h"

#undef gte_rtir
#define gte_rtir() __asm__ volatile("nop; nop; rtir12")

#undef gte_rtv0tr
#define gte_rtv0tr() __asm__ volatile("nop; nop; rtv0tr")

extern MATRIX mtx_alias __asm__("D_80061E88");

void func_8001BBD8(MATRIX *arg0) {
    gte_SetRotMatrix(&mtx_alias);
    gte_ldclmv(&arg0->m[0][0]);
    gte_rtir();
    gte_stclmv(&mtx_alias.m[0][0]);
    gte_ldclmv(&arg0->m[0][1]);
    gte_rtir();
    gte_stclmv(&mtx_alias.m[0][1]);
    gte_ldclmv(&arg0->m[0][2]);
    gte_rtir();
    gte_stclmv(&mtx_alias.m[0][2]);
    gte_SetTransMatrix(&mtx_alias);
    gte_ldlv0(&arg0->t[0]);
    gte_rtv0tr();
    gte_stlvl(&mtx_alias.t[0]);
    gte_SetRotMatrix(&mtx_alias);
    gte_SetTransMatrix(&mtx_alias);
}
#endif
