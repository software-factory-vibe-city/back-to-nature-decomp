#include "common.h"
#include "psyq/stddef.h"
#include "psyq/libetc.h"
#include "psyq/libsnd.h"

/* SpuGetAllKeysStatus is declared void in PSY-Q 4.7 libspu.h (not in this
 * include chain); its return is unused here. The value that is actually
 * stored and passed on is the FIRST VSync's return. */
extern void SpuGetAllKeysStatus(char *status);
extern s32 D_80049A10[3];

s32 func_800212A8(s32 soundId, s32 lo, s32 hi) {
    char status[24];
    s32 vsync;
    s32 voice;
    s32 frame;
    s16 *base;
    s16 group;
    s16 vabId;
    s16 prog;
    s16 tone;
    s16 note;
    s16 fine;
    s16 voll;
    s16 volr;

    vsync = VSync(-1);
    SpuGetAllKeysStatus(status);
    voice = func_800217B0(vsync, lo, hi, status);
    if (voice < 0) {
        voice = func_80021820(lo, hi);
    }
    base = D_800495CC + soundId * 7;
    group = base[1];
    (&D_8006C0C8)[voice] = group;
    frame = VSync(-1);
    (&D_8006C128)[voice] = frame;
    vabId = base[0];
    prog = base[2];
    tone = base[3];
    note = base[4];
    fine = base[5];
    voll = base[6];
    volr = base[6];
    if (soundId == 0x46) {
        note = (s16)(Rand(4) + 0x3C);
        voll = (s16)(Rand(0x1C) + 0x64);
        volr = (s16)(Rand(0x1C) + 0x64);
    }
    if (soundId == 0x47) {
        note = (s16)(Rand(9) + 0x38);
        voll = (s16)(Rand(0x1C) + 0x64);
        volr = (s16)(Rand(0x1C) + 0x64);
    }
    SsUtKeyOnV((s16)voice, vabId, prog, tone, note, fine, voll, volr);
    D_80049A10[voice] = vsync;
    return voice;
}
