#include "common.h"

typedef struct {
    char pad[0xE];
    s16 unkE;
} Unk0E;

s32 func_8001AF44(u32 arg0);
void func_800121D4(void);
void func_8001FBE4(s32 arg0, s32 arg1);
s32 func_8001FBBC(s16 arg0);
s32 func_80020B80(s32 arg0, s32 arg1);
void func_8001FBF0(s16 arg0, s16 arg1);
void func_8001FD10(void);
s32 func_8001FD74(void);

void ovl_11_func_800E3AA4(void) {
    s16 temp_s1;
    u8 temp_s3;
    u8 temp_s4;
    u8 temp_s5;
    u8 *far;
    env_struct_0x134 *env;
    env_struct_0x134 *env2;

    if (func_8001AF44(2U) == 1) {
        temp_s1 = ((struct struct_8006C838_800E3AA4 *)D_8006C838)->field_4438;
        far = (u8 *)&D_8007AFF0;
        if ((*(s32 *)(far + 0x2549C) != temp_s1) && (temp_s1 != -1)) {
            env = D_8005E5E8;
            temp_s3 = env->unk19;
            temp_s4 = env->unk1A;
            temp_s5 = env->unk1B;
            env->unk19 = 0;
            env->unk1A = 0;
            env->unk1B = 0;
            env2 = env + 1;
            env2->unk19 = 0;
            env2->unk1A = 0;
            env2->unk1B = 0;
            DrawSync(0);
            func_800121D4();
            func_8001FBE4(0, D_8005E3B0 + 0x4290);
            func_8001FBBC(0);
            func_80020B80(2, 0);
            *(s32 *)(far + 0x25498) = (s32)((Unk0E *)(*(u8 **)(far + 0x25388)))->unkE;
            func_8001FBF0(temp_s1, 0);
            *(s32 *)(far + 0x2549C) = (s32)temp_s1;
            ((struct struct_8006C838_800E3AA4 *)D_8006C838)->field_4438 = -1;
            do {
                func_8001FD10();
            } while (func_8001FD74() == 0);
            env = D_8005E5E8;
            env->unk19 = temp_s3;
            env->unk1A = temp_s4;
            env->unk1B = temp_s5;
            env++;
            env->unk19 = temp_s3;
            env->unk1A = temp_s4;
            env->unk1B = temp_s5;
        }
    } else {
        D_80070C70 = -1;
    }
}
