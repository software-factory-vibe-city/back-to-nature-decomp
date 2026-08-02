import { readFileSync } from "fs";
import { join } from "path";
import { ROOT } from "../decompToolchain.js";

const LOCAL_REFERENCE = join(ROOT, "notes/scratch/gcc-2.95.2-reference/local-alloc.c");
const SCHED_REFERENCE = join(ROOT, "notes/scratch/gcc-2.95.2-reference/sched.c");

function replaceOnce(source: string, find: string, replacement: string, label: string): string {
  const first = source.indexOf(find);
  if (first < 0) throw new Error(`Compiler-oracle instrumentation anchor not found: ${label}`);
  if (source.indexOf(find, first + find.length) >= 0) {
    throw new Error(`Compiler-oracle instrumentation anchor is not unique: ${label}`);
  }
  return source.slice(0, first) + replacement + source.slice(first + find.length);
}

const LOCAL_HELPERS = String.raw`
/* Diagnostic-only PSX compiler oracle. Generated under build/; never used by
   the production compiler. The environment syntax is PSEUDO:HARD,... . */
static FILE *psx_oracle_local_file;
static int psx_oracle_local_initialized;
static int psx_oracle_current_block = -1;

static FILE *
psx_oracle_local_log ()
{
  const char *path;
  if (! psx_oracle_local_initialized)
    {
      psx_oracle_local_initialized = 1;
      path = getenv ("PSX_ORACLE_LOG");
      if (path && *path)
        psx_oracle_local_file = fopen (path, "a");
    }
  return psx_oracle_local_file;
}

static int
psx_oracle_qty_has_pseudo (qty, pseudo)
     int qty, pseudo;
{
  int regno;
  for (regno = qty_first_reg[qty]; regno >= 0; regno = reg_next_in_qty[regno])
    if (regno == pseudo)
      return 1;
  return 0;
}

static int
psx_oracle_forced_local_reg (qty)
     int qty;
{
  const char *p = getenv ("PSX_ORACLE_FORCE_LOCAL");
  int pseudo, hard, used;
  if (! p)
    return -1;
  while (*p)
    {
      used = 0;
      if (sscanf (p, "%d:%d%n", &pseudo, &hard, &used) == 2 && used > 0)
        {
          if (psx_oracle_qty_has_pseudo (qty, pseudo))
            return hard;
          p += used;
        }
      else
        p++;
      while (*p == ',' || *p == ' ' || *p == ';')
        p++;
    }
  return -1;
}

static int
psx_oracle_local_reg_forbidden (qty, hard)
     int qty, hard;
{
  const char *p = getenv ("PSX_ORACLE_FORBID_LOCAL");
  int pseudo, candidate, used;
  if (! p)
    return 0;
  while (*p)
    {
      used = 0;
      if (sscanf (p, "%d:%d%n", &pseudo, &candidate, &used) == 2 && used > 0)
        {
          if (candidate == hard && psx_oracle_qty_has_pseudo (qty, pseudo))
            return 1;
          p += used;
        }
      else
        p++;
      while (*p == ',' || *p == ' ' || *p == ';')
        p++;
    }
  return 0;
}

static void
psx_oracle_log_qty (event, qty, hard, born, dead, legal, suggested, forced)
     const char *event;
     int qty, hard, born, dead, legal, suggested, forced;
{
  FILE *f = psx_oracle_local_log ();
  int regno, first = 1;
  if (! f)
    return;
  fprintf (f, "{\"stage\":\"local\",\"event\":\"%s\",\"block\":%d,\"qty\":%d,\"hardRegister\":%d,\"born\":%d,\"dead\":%d,\"legal\":%d,\"suggested\":%d,\"forced\":%d,\"references\":%d,\"size\":%d,\"minClass\":%d,\"alternateClass\":%d,\"callsCrossed\":%d,\"members\":[",
           event, psx_oracle_current_block, qty, hard, born, dead, legal, suggested, forced,
           qty_n_refs[qty], qty_size[qty], (int) qty_min_class[qty],
           (int) qty_alternate_class[qty], qty_n_calls_crossed[qty]);
  for (regno = qty_first_reg[qty]; regno >= 0; regno = reg_next_in_qty[regno])
    {
      if (! first) fputc (',', f);
      fprintf (f, "%d", regno);
      first = 0;
    }
  fprintf (f, "]}\n");
  fflush (f);
}
`;

const SCHED_HELPERS = String.raw`
/* Diagnostic-only PSX compiler oracle. Relations use FINAL-BEFORE<FINAL-AFTER;
   sched1 is backward, so FINAL-AFTER wins a ready-list comparison. */
static FILE *psx_oracle_sched_file;
static int psx_oracle_sched_initialized;

static FILE *
psx_oracle_sched_log ()
{
  const char *path;
  if (! psx_oracle_sched_initialized)
    {
      psx_oracle_sched_initialized = 1;
      path = getenv ("PSX_ORACLE_LOG");
      if (path && *path)
        psx_oracle_sched_file = fopen (path, "a");
    }
  return psx_oracle_sched_file;
}

static int
psx_oracle_schedule_relation (xuid, yuid, beforep, afterp)
     int xuid, yuid, *beforep, *afterp;
{
  const char *p = getenv ("PSX_ORACLE_SCHEDULE_EDGES");
  int before, after, used;
  if (! p || reload_completed)
    return 0;
  while (*p)
    {
      used = 0;
      if (sscanf (p, "%d<%d%n", &before, &after, &used) == 2 && used > 0)
        {
          if ((xuid == before && yuid == after)
              || (xuid == after && yuid == before))
            {
              *beforep = before;
              *afterp = after;
              return xuid == after ? -1 : 1;
            }
          p += used;
        }
      else
        p++;
      while (*p == ',' || *p == ' ' || *p == ';')
        p++;
    }
  return 0;
}

static void
psx_oracle_log_schedule_override (xuid, yuid, before, after, result)
     int xuid, yuid, before, after, result;
{
  FILE *f = psx_oracle_sched_log ();
  if (! f)
    return;
  fprintf (f, "{\"stage\":\"sched\",\"event\":\"rank_override\",\"reload\":%d,\"xUid\":%d,\"yUid\":%d,\"beforeUid\":%d,\"afterUid\":%d,\"preferredUid\":%d}\n",
           reload_completed, xuid, yuid, before, after, result < 0 ? xuid : yuid);
  fflush (f);
}

static void
psx_oracle_log_schedule_select (block, clock, insn)
     int block, clock;
     rtx insn;
{
  FILE *f = psx_oracle_sched_log ();
  if (! f)
    return;
  fprintf (f, "{\"stage\":\"sched\",\"event\":\"select\",\"reload\":%d,\"block\":%d,\"clock\":%d,\"uid\":%d}\n",
           reload_completed, block, clock, INSN_UID (insn));
  fflush (f);
}

static void
psx_oracle_log_schedule_edge (block, before, after, injected)
     int block, before, after, injected;
{
  FILE *f = psx_oracle_sched_log ();
  if (! f)
    return;
  fprintf (f, "{\"stage\":\"sched\",\"event\":\"edge_inject\",\"reload\":%d,\"block\":%d,\"beforeUid\":%d,\"afterUid\":%d,\"legal\":%d}\n",
           reload_completed, block, before, after, injected);
  fflush (f);
}
`;

export function instrumentLocalAllocation(source = readFileSync(LOCAL_REFERENCE, "utf8")): string {
  let result = replaceOnce(
    source,
    "static void alloc_qty\t\tPROTO((int, enum machine_mode, int, int));\n",
    LOCAL_HELPERS + "\nstatic void alloc_qty\t\tPROTO((int, enum machine_mode, int, int));\n",
    "local helper insertion",
  );
  result = replaceOnce(
    result,
    "  qty_changes_size[qty] = REG_CHANGES_SIZE (regno);\n}",
    "  qty_changes_size[qty] = REG_CHANGES_SIZE (regno);\n  psx_oracle_log_qty (\"alloc_qty\", qty, -1, birth, -1, 1, 0, 0);\n}",
    "alloc_qty event",
  );
  result = replaceOnce(
    result,
    "  COPY_HARD_REG_SET (first_used, used);\n\n  if (just_try_suggested)",
    `  /* Counterfactual exclusions model hard-register occupancy that a
     different original-source lifetime would create at this decision.  */
  for (i = 0; i < FIRST_PSEUDO_REGISTER; i++)
    if (psx_oracle_local_reg_forbidden (qty, i))
      {
        SET_HARD_REG_BIT (used, i);
        psx_oracle_log_qty ("forbid", qty, i, born_index, dead_index,
                            1, just_try_suggested, 0);
      }

  COPY_HARD_REG_SET (first_used, used);

  if (just_try_suggested)`,
    "forbidden local candidates",
  );
  result = replaceOnce(
    result,
    "  /* If all registers are excluded, we can't do anything.  */\n  GO_IF_HARD_REG_SUBSET (reg_class_contents[(int) ALL_REGS], first_used, fail);",
    String.raw`  /* A forced assignment remains diagnostic: accept it only when the
     stock allocator's complete exclusion set says that it is legal.  */
  {
    int forced = psx_oracle_forced_local_reg (qty);
    if (forced >= 0)
      {
        int legal = forced < FIRST_PSEUDO_REGISTER
          && ! TEST_HARD_REG_BIT (first_used, forced)
          && HARD_REGNO_MODE_OK (forced, mode);
        int j, size1 = legal ? HARD_REGNO_NREGS (forced, mode) : 0;
        for (j = 1; legal && j < size1; j++)
          if (TEST_HARD_REG_BIT (used, forced + j))
            legal = 0;
        psx_oracle_log_qty (legal ? "force_accept" : "force_reject",
                            qty, forced, born_index, dead_index, legal,
                            just_try_suggested, 1);
        if (legal)
          {
            post_mark_life (forced, mode, 1, born_index, dead_index);
            return forced;
          }
      }
  }

  {
    FILE *oracle_f = psx_oracle_local_log ();
    if (oracle_f)
      {
        int oracle_i, oracle_first = 1;
        fprintf (oracle_f, "{\"stage\":\"local\",\"event\":\"find\",\"block\":%d,\"qty\":%d,\"born\":%d,\"dead\":%d,\"suggested\":%d,\"references\":%d,\"size\":%d,\"minClass\":%d,\"alternateClass\":%d,\"callsCrossed\":%d,\"available\":[",
                 psx_oracle_current_block, qty, born_index, dead_index, just_try_suggested,
                 qty_n_refs[qty], qty_size[qty], (int) qty_min_class[qty],
                 (int) qty_alternate_class[qty], qty_n_calls_crossed[qty]);
        for (oracle_i = 0; oracle_i < FIRST_PSEUDO_REGISTER; oracle_i++)
          {
#ifdef REG_ALLOC_ORDER
            int oracle_regno = reg_alloc_order[oracle_i];
#else
            int oracle_regno = oracle_i;
#endif
            if (! TEST_HARD_REG_BIT (first_used, oracle_regno)
                && HARD_REGNO_MODE_OK (oracle_regno, mode))
              {
                if (! oracle_first) fputc (',', oracle_f);
                fprintf (oracle_f, "%d", oracle_regno);
                oracle_first = 0;
              }
          }
        fprintf (oracle_f, "]}\n");
        fflush (oracle_f);
      }
  }

  /* If all registers are excluded, we can't do anything.  */
  GO_IF_HARD_REG_SUBSET (reg_class_contents[(int) ALL_REGS], first_used, fail);`,
    "forced local assignment",
  );
  result = replaceOnce(
    result,
    "  int no_conflict_combined_regno = -1;\n\n  /* Count the instructions in the basic block.  */",
    "  int no_conflict_combined_regno = -1;\n\n  psx_oracle_current_block = b;\n\n  /* Count the instructions in the basic block.  */",
    "local block identity",
  );
  result = replaceOnce(
    result,
    "\t      post_mark_life (regno, mode, 1, born_index, dead_index);\n\t      return regno;",
    "\t      post_mark_life (regno, mode, 1, born_index, dead_index);\n              psx_oracle_log_qty (\"choose\", qty, regno, born_index, dead_index, 1, just_try_suggested, 0);\n\t      return regno;",
    "ordinary local choice",
  );
  result = replaceOnce(
    result,
    "  for (q = 0; q < next_qty; q++)\n    if (qty_phys_reg[q] >= 0)",
    "  for (q = 0; q < next_qty; q++)\n    psx_oracle_log_qty (\"final\", q, qty_phys_reg[q], qty_birth[q], qty_death[q], qty_phys_reg[q] >= 0, 0, 0);\n\n  for (q = 0; q < next_qty; q++)\n    if (qty_phys_reg[q] >= 0)",
    "final quantity state",
  );
  result = replaceOnce(
    result,
    "\n    }\n  else\n    return 0;\n\n  return 1;",
    "\n      psx_oracle_log_qty (\"merge\", sqty, -1, qty_birth[sqty], -1, 1, may_save_copy, 0);\n    }\n  else\n    return 0;\n\n  return 1;",
    "quantity merge event",
  );
  return result;
}

export function instrumentScheduler(source = readFileSync(SCHED_REFERENCE, "utf8")): string {
  let result = replaceOnce(
    source,
    '#include "insn-attr.h"\n',
    '#include "insn-attr.h"\n' + SCHED_HELPERS,
    "scheduler helper insertion",
  );
  result = replaceOnce(
    result,
    "  n_insns = sched_analyze (head, tail);\n  if (n_insns == 0)\n    {\n      free_pending_lists ();\n      goto ret;\n    }\n\n  /* Allocate vector to hold insns to be rearranged (except those",
    `  n_insns = sched_analyze (head, tail);
  if (n_insns == 0)
    {
      free_pending_lists ();
      goto ret;
    }

  /* Inject diagnostic ordering dependencies after the stock DAG has been
     built but before priorities and reference counts are calculated.  */
  if (! reload_completed)
    {
      const char *oracle_edges = getenv ("PSX_ORACLE_SCHEDULE_EDGES");
      const char *oracle_p = oracle_edges;
      int oracle_before, oracle_after, oracle_used;
      while (oracle_p && *oracle_p)
        {
          rtx oracle_before_insn = 0, oracle_after_insn = 0, oracle_scan;
          oracle_used = 0;
          if (sscanf (oracle_p, "%d<%d%n", &oracle_before, &oracle_after,
                      &oracle_used) == 2 && oracle_used > 0)
            {
              for (oracle_scan = head; oracle_scan; oracle_scan = NEXT_INSN (oracle_scan))
                {
                  if (GET_RTX_CLASS (GET_CODE (oracle_scan)) == 'i')
                    {
                      if (INSN_UID (oracle_scan) == oracle_before)
                        oracle_before_insn = oracle_scan;
                      if (INSN_UID (oracle_scan) == oracle_after)
                        oracle_after_insn = oracle_scan;
                    }
                  if (oracle_scan == tail)
                    break;
                }
              if (oracle_before_insn && oracle_after_insn)
                {
                  add_dependence (oracle_after_insn, oracle_before_insn,
                                  REG_DEP_ANTI);
                  psx_oracle_log_schedule_edge (b, oracle_before,
                                                oracle_after, 1);
                }
              else
                psx_oracle_log_schedule_edge (b, oracle_before,
                                              oracle_after, 0);
              oracle_p += oracle_used;
            }
          else
            oracle_p++;
          while (*oracle_p == ',' || *oracle_p == ' ' || *oracle_p == ';')
            oracle_p++;
        }
    }

  /* Allocate vector to hold insns to be rearranged (except those`,
    "scheduler edge injection",
  );
  result = replaceOnce(
    result,
    "  int value;\n\n  /* Choose the instruction with the highest priority, if different.  */",
    `  int value;
  int oracle_before, oracle_after, oracle_value;

  oracle_value = psx_oracle_schedule_relation (INSN_UID (tmp2), INSN_UID (tmp),
                                                &oracle_before, &oracle_after);
  if (oracle_value)
    {
      psx_oracle_log_schedule_override (INSN_UID (tmp2), INSN_UID (tmp),
                                        oracle_before, oracle_after, oracle_value);
      return oracle_value;
    }

  /* Choose the instruction with the highest priority, if different.  */`,
    "scheduler comparator override",
  );
  result = replaceOnce(
    result,
    "      last_scheduled_insn = insn = ready[0];\n",
    "      last_scheduled_insn = insn = ready[0];\n      psx_oracle_log_schedule_select (b, clock, insn);\n",
    "scheduler selection event",
  );
  return result;
}

export function diagnosticDockerfile(): string {
  return `FROM ubuntu:focal as build\nENV DEBIAN_FRONTEND=noninteractive\nRUN apt-get update\nRUN apt-get install -y build-essential gcc gcc-multilib wget\nENV VERSION=2.95.2\nENV GNUPATH=gnu\nWORKDIR /work\nRUN wget https://ftp.gnu.org/\${GNUPATH}/gcc/gcc-\${VERSION}.tar.gz\nRUN tar xzf gcc-\${VERSION}.tar.gz\nWORKDIR /work/gcc-\${VERSION}/\nCOPY tools/vendor/old-gcc/patches /work/patches\nRUN sed -i -- 's/include <varargs.h>/include <stdarg.h>/g' **/*.c\nRUN patch -u -p1 include/obstack.h -i ../patches/obstack-\${VERSION}.h.patch\nRUN patch -u -p1 gcc/config/mips/mips.h -i ../patches/mips.patch\nRUN patch -su -p1 < ../patches/psx-2.91.patch\nCOPY build/compilerOracle/context/local-alloc.c /work/gcc-\${VERSION}/gcc/local-alloc.c\nCOPY build/compilerOracle/context/sched.c /work/gcc-\${VERSION}/gcc/sched.c\nRUN for dir in libiberty gcc; do cd /work/gcc-\${VERSION}/\${dir}; ./configure --target=mips-sony-psx --prefix=/opt/cross --with-endian-little --with-gnu-as --disable-gprof --disable-gdb --disable-werror --host=i386-pc-linux --build=i386-pc-linux; done\nRUN make -C libiberty/ CFLAGS=\"-std=gnu89 -m32 -static\"\nRUN make -C gcc/ --jobs $(nproc) cc1 CFLAGS=\"-std=gnu89 -m32 -static\"\nRUN mkdir /build && cp ./gcc/cc1 /build/\nFROM scratch AS export\nCOPY --from=build /build/cc1 .\n`;
}
