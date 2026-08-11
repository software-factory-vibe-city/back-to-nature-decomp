#include "common.h"
#include "psyq/stddef.h"
#include "psyq/libgte.h"

s32 func_8001C1C0(SVECTOR *arg0) {
    s32 diff;
    SVECTOR diff_vec;
    SVECTOR normal;
    s16 *plane;
    SVECTOR *normal_ptr;
    s32 dot;

    diff = D_80061EC8[0] - arg0->vx;
    if (diff < 0) {
        diff += 0x7F;
    }
    diff_vec.vx = (s16)(diff >> 7);

    diff = D_80061EC8[1] - arg0->vy;
    if (diff < 0) {
        diff += 0x7F;
    }
    diff_vec.vy = (s16)(diff >> 7);

    diff = D_80061EC8[2] - arg0->vz;
    if (diff < 0) {
        diff += 0x7F;
    }
    diff_vec.vz = (s16)(diff >> 7);

    normal_ptr = &normal;
    VectorNormalSS(&diff_vec, normal_ptr);

    plane = D_80061EA8;

    dot = plane[0] * normal_ptr->vx;
    dot += plane[1] * normal_ptr->vy;
    dot += plane[2] * normal_ptr->vz;
    if (dot >= 0) {
        plane += 3;
        dot = plane[0] * normal_ptr->vx;
        dot += plane[1] * normal_ptr->vy;
        dot += plane[2] * normal_ptr->vz;
        if (dot >= 0) {
            plane += 3;
            dot = plane[0] * normal_ptr->vx;
            dot += plane[1] * normal_ptr->vy;
            dot += plane[2] * normal_ptr->vz;
            if (dot >= 0) {
                plane += 3;
                dot = plane[0] * normal_ptr->vx;
                dot += plane[1] * normal_ptr->vy;
                dot += plane[2] * normal_ptr->vz;
                return (u32)~dot >> 31;
            }
        }
    }

    return 0;
}