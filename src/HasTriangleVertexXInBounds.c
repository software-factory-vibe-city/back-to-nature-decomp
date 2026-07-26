#include "common.h"

#define X_RANGE_BIAS 19
#define X_PRECHECK_SIZE 419
#define X_BOUNDS_SIZE 339

/*
 * Return 1 if any projected triangle vertex has an X coordinate in
 * [-19, 319]. Each argument is a packed GTE SXY value (the SDK DVECTOR
 * layout), with signed X in the low half and signed Y in the high half.
 *
 * The preliminary pass tests the wider interval [-20, 398]. That interval
 * contains the final interval, so the pass is redundant to the observable
 * result, but it is retained to reproduce the original function.
 */
s32 HasTriangleVertexXInBounds(s32 sxy0, s32 sxy1, s32 sxy2) {
    s32 precheckX;
    s32 vertexX;

    precheckX = (s16)(sxy0 + 1);
    precheckX += X_RANGE_BIAS;
    if ((u16)precheckX < X_PRECHECK_SIZE) {
        goto CHECK_X_BOUNDS;
    }

    precheckX = (s16)(sxy1 + 1);
    precheckX += X_RANGE_BIAS;
    if ((u16)precheckX < X_PRECHECK_SIZE) {
        goto CHECK_X_BOUNDS;
    }

    precheckX = (s16)(sxy2 + 1);
    precheckX += X_RANGE_BIAS;
    if ((u16)precheckX < X_PRECHECK_SIZE) {
        goto CHECK_X_BOUNDS;
    }

    return 0;

CHECK_X_BOUNDS:
    vertexX = (s16)sxy0;
    if ((u16)(vertexX + X_RANGE_BIAS) < X_BOUNDS_SIZE) {
        return 1;
    }

    vertexX = (s16)sxy1;
    if ((u16)(vertexX + X_RANGE_BIAS) < X_BOUNDS_SIZE) {
        return 1;
    }

    vertexX = (s16)sxy2;
    return (u16)(vertexX + X_RANGE_BIAS) < X_BOUNDS_SIZE;
}
