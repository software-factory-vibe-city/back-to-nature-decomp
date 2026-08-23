/**
 * derive.ts — read the loop pass's requirement off the target's bytes.
 *
 * The whole derivation is one structural fact and one solve.
 *
 * The fact: `move_movables` and `strength_reduce` both emit with
 * `emit_insn_before (..., loop_start)`, each call landing immediately before
 * the loop, and they run in a fixed order — movables then giv inits, pass 1
 * then pass 2. So a preheader is a non-decreasing sequence of emission classes,
 * with whatever the source itself put there sitting at the front.
 *
 * The solve: each emitted unit admits some classes on its own evidence (an
 * address the loop only reads can be a movable; a register the loop steps by a
 * constant can be an induction init; a call argument can be neither), and the
 * non-decreasing constraint cuts that down. What survives is the requirement.
 *
 * Nothing here reads a candidate. That is the point: the requirement exists
 * before any source does, which is the standing every other pass's
 * requirement-deriver already has and `loop` did not.
 */

import type { MirBlock, MirInsn, MirProgram } from "../pipeline-reversal/types.js";
import {
  CLASS_NAMES,
  EmissionClass,
  type GroupRole,
  type LoopEmissionRequirement,
  type PreheaderGroup,
  type PreheaderRequirement,
} from "./types.js";

export { CLASS_NAMES, EmissionClass };

/** Loop headers: a block reached from a block at or after it. */
export function loopHeaders(program: MirProgram): number[] {
  return program.blocks
    .filter((block) => block.predecessors.some((predecessor) => predecessor >= block.index))
    .map((block) => block.index);
}

/**
 * The preheader of a loop header: the earlier block that reaches it.
 *
 * A header with several earlier predecessors has no single preheader, and the
 * emission-order argument does not apply to any of them — `loop.c` emits before
 * `loop_start`, which is one place. Those are skipped with a caveat rather than
 * guessed at.
 */
export function preheaderOf(program: MirProgram, header: number): number | undefined {
  const earlier = (program.blocks[header]?.predecessors ?? []).filter((predecessor) => predecessor < header);
  return earlier.length === 1 ? earlier[0] : undefined;
}

/** Blocks the loop body spans: the header through its furthest back-edge source. */
export function loopBody(program: MirProgram, header: number): MirBlock[] {
  const latch = Math.max(...(program.blocks[header]?.predecessors ?? [header]));
  return program.blocks.filter((block) => block.index >= header && block.index <= latch);
}

/**
 * Loop headers strictly inside one loop's body.
 *
 * The nesting relation is what makes the cascade route reachable, and it is
 * readable from the block graph alone — so it stands on a stub, like everything
 * else here.
 */
export function innerLoopsOf(program: MirProgram, header: number): number[] {
  const body = loopBody(program, header);
  if (body.length === 0) return [];
  const last = body[body.length - 1]!.index;
  return loopHeaders(program).filter((candidate) => {
    if (candidate === header) return false;
    if (candidate < header || candidate > last) return false;
    const latch = Math.max(...(program.blocks[candidate]?.predecessors ?? [candidate]));
    return latch <= last;
  });
}

function insnsOf(program: MirProgram, block: MirBlock): MirInsn[] {
  return block.insns
    .map((id) => program.insns.find((insn) => insn.id === id))
    .filter((insn): insn is MirInsn => insn !== undefined);
}

interface RegisterRole {
  read: boolean;
  written: boolean;
  /** Constant step, when every write in the loop is `addiu R,R,K` with one K. */
  step?: number;
}

/** How the loop body uses each register. */
export function registerRoles(program: MirProgram, header: number): Map<string, RegisterRole> {
  const roles = new Map<string, RegisterRole>();
  const role = (register: string): RegisterRole => {
    const existing = roles.get(register);
    if (existing) return existing;
    const created: RegisterRole = { read: false, written: false };
    roles.set(register, created);
    return created;
  };

  for (const block of loopBody(program, header)) {
    for (const insn of insnsOf(program, block)) {
      for (const use of insn.uses) role(use).read = true;
      for (const definition of insn.defs) {
        const entry = role(definition);
        entry.written = true;
        const stepped = insn.mnemonic === "addiu"
          && insn.defs.length === 1
          && insn.uses.length === 1
          && insn.uses[0] === definition;
        const immediate = stepped ? Number(insn.operands[insn.operands.length - 1]) : Number.NaN;
        if (stepped && Number.isFinite(immediate)) {
          /* Two different constant steps on one register is not an induction
             variable this model recognises; drop the step rather than pick one. */
          entry.step = entry.step === undefined || entry.step === immediate ? immediate : Number.NaN;
        } else {
          entry.step = Number.NaN;
        }
      }
    }
  }
  return roles;
}

const EFFECTFUL = (insn: MirInsn): boolean =>
  insn.isCall || insn.isStore || insn.isBranch || insn.isJump || insn.isLoad;

/**
 * Split a preheader into the units `loop.c` would have emitted.
 *
 * An address is two instructions and one decision — `move_movables` moves a
 * `%hi`/`%lo` pair as a forced unit, and `emit_iv_add_mult` emits one as a
 * unit too — so pairing them is not cosmetic: counted separately they would
 * appear to be two independently placed emissions.
 */
export function groupPreheader(program: MirProgram, block: MirBlock): MirInsn[][] {
  const insns = insnsOf(program, block);
  const groups: MirInsn[][] = [];
  for (let index = 0; index < insns.length; index++) {
    const insn = insns[index]!;
    const next = insns[index + 1];
    const isHigh = insn.mnemonic === "lui" && insn.defs.length === 1;
    const completes = next !== undefined
      && (next.mnemonic === "addiu" || next.mnemonic === "ori")
      && next.uses.length === 1
      && next.uses[0] === insn.defs[0]
      && (insn.symbol === undefined || next.symbol === undefined || insn.symbol === next.symbol);
    if (isHigh && completes) {
      groups.push([insn, next!]);
      index++;
      continue;
    }
    groups.push([insn]);
  }
  return groups;
}

function roleOf(group: MirInsn[], roles: Map<string, RegisterRole>): { role: GroupRole; step?: number } {
  if (group.some(EFFECTFUL)) return { role: "effectful" };
  const destination = group[group.length - 1]!.defs[0];
  if (destination === undefined) return { role: "effectful" };
  const usage = roles.get(destination);
  if (!usage?.read) return { role: "not-live-in-loop" };
  if (!usage.written) return { role: "invariant" };
  if (usage.step !== undefined && Number.isFinite(usage.step)) return { role: "induction-init", step: usage.step };
  return { role: "varying" };
}

function admissibleFor(role: GroupRole): EmissionClass[] {
  switch (role) {
    case "invariant":
      /* A loop-invariant value in the preheader is either something the source
         put there under a name, or something move_movables lifted. */
      return [EmissionClass.Source, EmissionClass.Pass1Movable, EmissionClass.Pass2Movable];
    case "induction-init":
      /* A basic induction variable's init is a source statement — loop.c does
         not emit those. A *reduced giv's* init is emitted by strength_reduce.
         The bytes cannot tell the two apart; the ordering constraint can. */
      return [EmissionClass.Source, EmissionClass.Pass1GivInit, EmissionClass.Pass2GivInit];
    default:
      return [EmissionClass.Source];
  }
}

/**
 * Keep the classes that take part in at least one non-decreasing assignment.
 *
 * Forward and backward reachability over the sequence, which is exact here and
 * avoids enumerating the product — a preheader of ten groups has up to 5^10
 * assignments and only the per-group survivors are wanted.
 */
function solveNonDecreasing(admissible: EmissionClass[][]): EmissionClass[][] {
  const count = admissible.length;
  if (count === 0) return [];

  /* forward[i] = classes at i reachable from a valid prefix */
  const forward: Set<EmissionClass>[] = [];
  for (let index = 0; index < count; index++) {
    const allowed = new Set<EmissionClass>();
    for (const candidate of admissible[index]!) {
      const ok = index === 0
        || [...forward[index - 1]!].some((previous) => previous <= candidate);
      if (ok) allowed.add(candidate);
    }
    forward.push(allowed);
  }

  /* backward: prune with the suffix as well, so a class that no valid tail can
     follow is dropped too. */
  const survivors: Set<EmissionClass>[] = forward.map((entry) => new Set(entry));
  for (let index = count - 2; index >= 0; index--) {
    for (const candidate of [...survivors[index]!]) {
      if (![...survivors[index + 1]!].some((next) => next >= candidate)) survivors[index]!.delete(candidate);
    }
  }
  /* One more forward sweep: dropping a class can invalidate a later one. */
  for (let index = 1; index < count; index++) {
    for (const candidate of [...survivors[index]!]) {
      if (![...survivors[index - 1]!].some((previous) => previous <= candidate)) survivors[index]!.delete(candidate);
    }
  }
  return survivors.map((entry) => [...entry].sort((left, right) => left - right));
}

export interface DeriveOptions {
  /** Address -> name, so a datum the lift could only render as an offset from
   *  the nearest symbol reads the same way the compiler's own RTL spells it. */
  nameOfAddress?: (address: number) => string | undefined;
}

export function deriveRequirement(
  program: MirProgram,
  functionName: string,
  options: DeriveOptions = {},
): LoopEmissionRequirement {
  const caveats: string[] = [];
  const preheaders: PreheaderRequirement[] = [];

  for (const header of loopHeaders(program)) {
    const preheaderIndex = preheaderOf(program, header);
    if (preheaderIndex === undefined) {
      caveats.push(
        `loop header ${header} has no single earlier predecessor, so no block is its preheader in ` +
        "loop.c's sense and the emission-order argument does not apply to it",
      );
      continue;
    }
    const block = program.blocks[preheaderIndex]!;
    const roles = registerRoles(program, header);
    const rawGroups = groupPreheader(program, block);

    const groups: PreheaderGroup[] = rawGroups.map((insns, index) => {
      const { role, step } = roleOf(insns, roles);
      const last = insns[insns.length - 1]!;
      const group: PreheaderGroup = {
        index,
        insns: insns.map((insn) => insn.id),
        text: insns.map((insn) => insn.text.trim()).join(" ; "),
        role,
        addressPair: insns.length === 2 && insns[0]!.mnemonic === "lui",
        admissible: admissibleFor(role),
        consistent: [],
      };
      if (insns[0]!.vram !== undefined) group.vram = insns[0]!.vram;
      if (last.defs[0] !== undefined) group.destination = last.defs[0];
      const carrier = insns.find((insn) => insn.symbol !== undefined);
      if (carrier?.symbol !== undefined) group.symbol = carrier.symbol;
      if (carrier?.symbolAddress !== undefined) {
        group.symbolAddress = carrier.symbolAddress;
        const better = options.nameOfAddress?.(carrier.symbolAddress);
        if (better !== undefined) group.symbol = better;
      }
      if (step !== undefined) group.step = step;
      return group;
    });

    const solved = solveNonDecreasing(groups.map((group) => group.admissible));
    groups.forEach((group, index) => { group.consistent = solved[index] ?? []; });

    const requirement: PreheaderRequirement = {
      block: preheaderIndex,
      header,
      innerLoops: innerLoopsOf(program, header),
      groups,
      unsatisfiable: groups.some((group) => group.consistent.length === 0),
    };
    if (block.vram !== undefined) requirement.vram = block.vram;
    preheaders.push(requirement);
  }

  caveats.push(
    "The order read here is the final machine order, which sched2 could in principle have " +
    "permuted after loop.c emitted it. psx_search_scheduler_state settles whether the " +
    "scheduler could have produced a different preheader order for this block.",
  );
  return { functionName, preheaders, caveats };
}

/* ---- how a pass-2 emission can have happened ----------------------------- */

/**
 * The routes by which a group can be a pass-2 emission.
 *
 * This enumeration is the half the model was missing, and its absence was not
 * a gap in coverage — it was a false dichotomy that closed a function for six
 * sessions. The reachability analysis behind a reading assumed a pass-2 movable
 * must have *existed in the outer loop through pass 1 and declined there*.
 * Under that assumption the arithmetic is decidable, and for a forced
 * `%hi`/`%lo` pair it decides against: `force_movables` sums both halves, the
 * product floors at 2x2, and no source spelling lowers it. The conclusion drawn
 * was that the target's group is not a `move_movables` emission at all.
 *
 * It is one. `scan_loop` never sees an insn a loop pass created — it skips
 * registers at or above `max_reg_before_loop`, and `loop_reg_used_before_p`
 * has no luid for the insn — so a value hoisted out of a NESTED loop by pass 1
 * is absent from the enclosing loop's pass-1 scan entirely and is an ordinary
 * fresh movable when pass 2 comes round. There is no product to clear at
 * pass-1-outer, because no test was ever run.
 */
export type Pass2RouteId = "pass1-decline" | "inner-cascade" | "induction";

export interface Pass2Route {
  id: Pass2RouteId;
  /** One line naming the mechanism. */
  summary: string;
  /** Target-side facts that open or close this route here. */
  evidence: string[];
  /** What the source has to do for it. */
  requirements: string[];
}

/**
 * Which routes are open for one group, on the target's own evidence.
 *
 * Target-side only: nothing here reads a candidate, so it stands on a bare
 * stub the same way the requirement does.
 */
export function pass2Routes(requirement: PreheaderRequirement, group: PreheaderGroup): Pass2Route[] {
  const routes: Pass2Route[] = [];

  routes.push({
    id: "pass1-decline",
    summary:
      "the value exists in this loop through pass 1, is a movable there, and pass 1 declines it — " +
      "then pass 2 sees a smaller loop (pass 1's own hoists have left it) and takes it.",
    evidence: group.addressPair
      ? [
        "This group is a standalone %hi/%lo pair. force_movables ties the halves together and sums " +
        "their savings and lifetimes into one decision, so the product floors at 2x2 = 4 — check that " +
        "against the bar psx_loop_trace prints before spending edits on this route.",
      ]
      : [],
    requirements: [
      "the value must be loop-invariant in this loop at pass 1 and lose the desirability test there;",
      "psx_loop_trace prints the product it had and the bar it had to clear.",
    ],
  });

  if (requirement.innerLoops.length > 0) {
    routes.push({
      id: "inner-cascade",
      summary:
        "the value is computed per-iteration inside the NESTED loop, pass 1 hoists it out of that " +
        "loop into this loop's body, and pass 2 of this loop re-hoists it into this preheader.",
      evidence: [
        `loop header ${requirement.header} contains nested loop${requirement.innerLoops.length === 1 ? "" : "s"} ` +
        `at header ${requirement.innerLoops.join(", ")}, so this route is open here.`,
        "No pass-1 decline story is needed and none should be looked for: scan_loop skips insns a loop " +
        "pass created (no luid for loop_reg_used_before_p, registers at or above max_reg_before_loop), " +
        "so pass 1 of THIS loop never evaluated it. A product floor is not an argument against this route.",
      ],
      requirements: [
        "the value must occur per-iteration in the inner loop, not once per outer iteration;",
        ...(group.addressPair
          ? [
            "the address must stay a standalone %hi/%lo pair inside the inner loop, which on MIPS means " +
            "a two-register-sum index (`base[i * k + j]`): a one-register index folds the %lo into the " +
            "load and there is no pair left to hoist;",
          ]
          : []),
        "the inner loop must actually be scanned — check psx_loop_trace for `phony`, which discards a " +
        "loop unscanned and silently converts this route back into the pass-1-decline one;",
        "the inner hoist must clear the INNER loop's bar, which is the only desirability test on this route.",
      ],
    });
  }

  routes.push({
    id: "induction",
    summary:
      "the value is not a movable at all but a reduced giv's initialisation, which " +
      "strength_reduce emits after every movable of its pass.",
    evidence: [],
    requirements: [
      "write the access as base + a value the loop steps by a constant, so the offset reduces to a " +
      "pseudo and the address becomes a giv of it;",
      "identical givs combine and their benefits sum, so an expression that declines as one occurrence " +
      "(mult 1, single-register add: benefit 4 - add_cost 4 = 0) can clear the bar as two.",
    ],
  });

  return routes;
}

/** Groups that no assignment lets pass 1 or the source produce. */
export function forcedPassTwo(requirement: PreheaderRequirement): PreheaderGroup[] {
  return requirement.groups.filter((group) =>
    group.consistent.length > 0
    && group.consistent.every((value) => value >= EmissionClass.Pass2Movable));
}
