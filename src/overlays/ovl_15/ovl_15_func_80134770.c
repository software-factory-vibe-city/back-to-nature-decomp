#include "common.h"
#include "psyq/strings.h"

/* PSX memory card file header; Title is the Shift-JIS save title. */
typedef struct {
    char Magic[2];
    char Type;
    char BlockEntry;
    char Title[64];
} McHeader;

typedef struct {
    s16 year;
    s16 season;
    s16 unk4;
    s16 unk6;
} SaveDate;

typedef struct {
    SaveDate date;
    char pad_8[0x2C];
    s32 field_34;
    s16 field_38;
    s16 field_3A;
} D_801376E0Entry;

extern char D_8012E014[];
extern char D_8012E038[];
extern char D_8012E040[];
extern char D_801376B0[];
extern D_801376E0Entry D_801376E0[];
extern McHeader D_80140F10;

s8 *ovl_15_func_80134890(s16 arg0, s8 *arg1, s16 arg2);
void ovl_15_func_801349C8(s16 arg0, char *arg1);

s8 *ovl_15_func_80134770(s16 arg0) {
    SaveDate d;
    D_801376E0Entry *entries;
    SaveDate *src;

    memset(D_80140F10.Title, 0, sizeof(D_80140F10.Title));
    entries = D_801376E0;
    src = &entries[arg0].date;
    d.season = src->season;
    d.unk6 = src->unk6;
    d.unk4 = src->unk4 + 1;
    d.year = src->year + 1;
    D_80140F10.Title[0] = 0;
    strcat(D_80140F10.Title, D_8012E014);
    ovl_15_func_80134890(arg0 + 1, (s8 *)D_801376B0, 1);
    strcat(D_80140F10.Title, D_801376B0);
    strcat(D_80140F10.Title, D_8012E038);
    ovl_15_func_80134890(d.year, (s8 *)D_801376B0, 2);
    strcat(D_80140F10.Title, D_801376B0);
    strcat(D_80140F10.Title, D_8012E040);
    ovl_15_func_801349C8(d.season, D_801376B0);
    return (s8 *)strcat(D_80140F10.Title, D_801376B0);
}
