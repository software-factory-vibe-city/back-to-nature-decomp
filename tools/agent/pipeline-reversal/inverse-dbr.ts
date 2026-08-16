/**
 * g_dbr — undo delay-slot filling.
 *
 * `dbr_schedule` fills a slot in one of two ways, and each leaves a different
 * syntactic witness:
 *
 *  - own block: `fill_simple_delay_slots` scans backward from the instruction
 *    before the branch and takes the FIRST candidate with no resource conflict
 *    against everything it would move past. The preimage is therefore the
 *    EARLIEST position at which the instruction is conflict-free and every
 *    instruction after it is not — later positions were examined and rejected,
 *    which is a constraint the observed stream still carries.
 *
 *  - stolen from the target: `fill_slots_from_thread` copies the first
 *    instruction of the branch target into the slot and redirects the branch
 *    one instruction past it. The witness is exact and needs no model at all:
 *    the branch points at L+1 while L is a label, and the instruction at L is
 *    identical to the one in the slot.
 *
 * The resource model is the one in `resource.c`: registers plus a single
 * memory resource, where a *read* of memory is only marked by
 * `mark_referenced_resources` and a *write* only by `mark_set_resources`. That
 * asymmetry is why load-past-load is allowed and everything else touching
 * memory is not.
 */

import type { FiberSite, MirBlock, MirInsn, MirProgram } from "./types.js";

export interface SlotRestoration {
  branchId: number;
  slotId: number;
  /** Position inside the block body the slot instruction returned to. */
  position: number;
  origin: "own-block" | "forward-scan" | "stolen-from-target" | "moved-from-thread";
  /** Positions the model admits; one member means the preimage is a point. */
  fiber: number[];
  evidence: string[];
}

export interface DbrInverseResult {
  program: MirProgram;
  restorations: SlotRestoration[];
  /** Slot copies deleted because they duplicate the branch target. */
  duplicatesRemoved: Array<{ branchId: number; slotId: number; targetIndex: number }>;
  /** Places where the resource model could not explain the observed choice. */
  modelGaps: string[];
  sites: FiberSite[];
}

/**
 * `struct resources` from `resource.c`: hard registers plus ONE memory flag.
 *
 * The single flag is the whole subtlety. `mark_set_resources` raises it for a
 * memory destination and `mark_referenced_resources` for a memory source, and
 * `resource_conflicts_p` tests `res1->memory && res2->memory`. Reads therefore
 * conflict with writes in either direction, and two reads never meet because a
 * read is only ever marked on the "referenced" side, which is never compared
 * against itself.
 */
interface Resources {
  registers: Set<string>;
  memory: boolean;
}

const CALL_CLOBBERED = ["v0", "v1", "a0", "a1", "a2", "a3", "t0", "t1", "t2", "t3",
  "t4", "t5", "t6", "t7", "t8", "t9", "ra", "at"];

/**
 * `mark_set_resources`. `delayed` is GCC's `include_delayed_effects`: the
 * branch or call whose slot is being filled is marked with it OFF, so a call
 * being filled does not pre-clobber the caller-saved registers, which is
 * exactly why an argument set-up instruction can land in its slot.
 */
function setResources(insn: MirInsn, delayed: boolean): Resources {
  const registers = new Set(insn.defs);
  if (insn.isCall) {
    if (!delayed) {
      /* The pattern's own sets: the return register and the `ra` clobber. */
      registers.add("ra");
      return { registers, memory: false };
    }
    for (const register of CALL_CLOBBERED) registers.add(register);
    return { registers, memory: true };
  }
  return { registers, memory: insn.isStore };
}

/**
 * `mark_referenced_resources`.
 *
 * A call's own `(mem (symbol_ref))` operand is explicitly NOT a memory
 * reference — `case CALL:` in `resource.c` says so in as many words — so with
 * delayed effects off a call needs nothing but its address operand. That is why
 * a store can and does land in a call's delay slot. Only the delayed reading,
 * used for instructions the scan passes over, adds memory, the stack pointer
 * and the argument registers.
 */
function referencedResources(insn: MirInsn, delayed: boolean): Resources {
  const registers = new Set(insn.uses);
  if (insn.isCall) {
    if (!delayed) return { registers, memory: false };
    registers.add("sp");
    for (const register of ["a0", "a1", "a2", "a3"]) registers.add(register);
    return { registers, memory: true };
  }
  return { registers, memory: insn.isLoad };
}

/**
 * `eligible_for_delay` — the machine description's own filter.
 *
 * MIPS admits a delay-slot instruction only when its declared length is one
 * word. cc1 declares length 2 for a memory reference whose address is a bare
 * symbol, because at the time the attribute is read it cannot know that `-G`
 * will turn the reference into a single gp-relative word. So a gp-relative load
 * or store never enters a delay slot, however free of conflicts it looks — and
 * a model without this rule silently steals slots from the instruction that
 * really filled them.
 */
function fitsInDelaySlot(insn: MirInsn): boolean {
  if (insn.operands.some((operand) => /\(gp\)$/.test(operand))) return false;
  /* Integer division expands to a divide plus its zero-divisor trap. */
  if (/^(div|divu|rem|remu)$/.test(insn.mnemonic)) return false;
  return true;
}

function conflicts(left: Resources, right: Resources): boolean {
  if (left.memory && right.memory) return true;
  for (const register of left.registers) if (right.registers.has(register)) return true;
  return false;
}

function union(into: Resources, from: Resources): void {
  for (const register of from.registers) into.registers.add(register);
  into.memory ||= from.memory;
}

/**
 * Whether `trial` could be taken into the slot of `branch` when the
 * instructions in `tail` stay behind, in the order they appear.
 *
 * Mirrors the three tests in `fill_simple_delay_slots`: the trial must not
 * reference anything later instructions set, must not set anything they set,
 * and must not set anything they need.
 */
function eligible(trial: MirInsn, tail: MirInsn[], branch: MirInsn): { ok: boolean; reason: string } {
  if (trial.isBranch || trial.isJump || trial.isCall) return { ok: false, reason: "control transfer" };
  if (!fitsInDelaySlot(trial)) return { ok: false, reason: "declared length is more than one word" };
  const set: Resources = { registers: new Set<string>(), memory: false };
  const needed: Resources = { registers: new Set<string>(), memory: false };
  union(set, setResources(branch, false));
  union(needed, referencedResources(branch, false));
  /* The scan walks backward, so the accumulated resources are those of the
   * instructions between the trial and the branch. */
  for (let position = tail.length - 1; position >= 0; position--) {
    union(set, setResources(tail[position], true));
    union(needed, referencedResources(tail[position], true));
  }
  const trialSets = setResources(trial, true);
  const trialRefs = referencedResources(trial, true);
  if (conflicts(trialRefs, set)) return { ok: false, reason: "reads something a later instruction sets" };
  if (conflicts(trialSets, set)) return { ok: false, reason: "sets something a later instruction sets" };
  if (conflicts(trialSets, needed)) return { ok: false, reason: "sets something a later instruction needs" };
  return { ok: true, reason: "" };
}

/**
 * Whether the forward phase of `fill_simple_delay_slots` could have taken the
 * instruction that already follows the owner.
 *
 * The forward phase re-initializes its resource sets from the owner with
 * delayed effects INCLUDED, which is why so little survives past a call: the
 * call clobbers every caller-saved register and memory before the first trial
 * is even considered.
 */
function forwardEligible(slot: MirInsn, owner: MirInsn): boolean {
  if (slot.isBranch || slot.isJump || slot.isCall) return false;
  if (!fitsInDelaySlot(slot)) return false;
  const set = setResources(owner, true);
  const needed = referencedResources(owner, true);
  const slotSets = setResources(slot, true);
  const slotRefs = referencedResources(slot, true);
  if (conflicts(slotRefs, set)) return false;
  if (conflicts(slotSets, set)) return false;
  if (conflicts(slotSets, needed)) return false;
  /* `maybe_never && may_trap_p`: past a call the instruction may never run, so
   * a trapping one — every memory reference — is refused. */
  if (owner.isCall && (slot.isLoad || slot.isStore)) return false;
  return true;
}

/**
 * The successor block an eagerly-moved slot instruction came out of.
 *
 * `fill_eager_delay_slots` takes from whichever thread it judges more likely
 * and, when it owns that thread, deletes the instruction there. Only one
 * successor can be the source: the one that reads the value the instruction
 * produces. Preferring the fall-through on a tie matches which thread GCC walks
 * when the branch carries no prediction.
 */
function threadDestination(
  program: MirProgram,
  owner: MirInsn,
  slot: MirInsn,
  blockOfInsn: Map<number, number>,
): number | undefined {
  const ownerBlock = blockOfInsn.get(owner.id);
  if (ownerBlock === undefined) return undefined;
  const successors = program.blocks[ownerBlock]?.successors ?? [];
  if (successors.length === 0) return undefined;
  const byId = new Map(program.insns.map((insn) => [insn.id, insn]));
  const readsFirst = (blockIndex: number): boolean => {
    for (const id of program.blocks[blockIndex]?.insns ?? []) {
      const insn = byId.get(id);
      if (!insn) continue;
      if (slot.defs.some((register) => insn.uses.includes(register))) return true;
      if (slot.defs.some((register) => insn.defs.includes(register))) return false;
    }
    return false;
  };
  const readers = successors.filter(readsFirst);
  if (readers.length === 1) return readers[0];
  /* The fall-through is the block that follows in layout order. */
  const fallThrough = successors.find((index) => index === ownerBlock + 1);
  return fallThrough ?? readers[0] ?? successors[0];
}

export function inverseDbr(program: MirProgram): DbrInverseResult {
  const byId = new Map(program.insns.map((insn) => [insn.id, insn]));
  const leaders = new Set(program.blocks.map((block) => block.insns[0]).filter((id) => id !== undefined));
  const blockOfInsn = new Map<number, number>();
  for (const block of program.blocks) for (const id of block.insns) blockOfInsn.set(id, block.index);
  const threadMoves: Array<{ insn: MirInsn; destination: number }> = [];
  const restorations: SlotRestoration[] = [];
  const duplicatesRemoved: DbrInverseResult["duplicatesRemoved"] = [];
  const modelGaps: string[] = [];
  const sites: FiberSite[] = [];
  const order: MirInsn[] = [];
  const blocks: MirBlock[] = program.blocks.map((block) => ({ ...block, insns: [] }));
  const redirected = new Map<number, number>();
  const dropped = new Set<number>();

  for (const block of program.blocks) {
    const members = block.insns.map((id) => byId.get(id)!).filter(Boolean);
    /* Instructions already restored for this block; the backward scan for each
     * delay-slot owner runs over exactly this prefix, which is what makes a
     * block with several calls behave like several independent fills. */
    const body: MirInsn[] = [];
    /* `stop_search_p` halts the backward scan at any instruction that already
     * carries a delay-slot SEQUENCE, and calls are filled before jumps. So the
     * scan for one owner never reaches past the previous owner in the block. */
    let scanFloor = 0;

    for (let position = 0; position < members.length; position++) {
      const owner = members[position];
      const slot = members[position + 1];
      const owns = (owner.isBranch || owner.isJump || owner.isCall) &&
        slot !== undefined && slot.delaySlotOf === owner.id;
      if (!owns) {
        body.push(owner);
        continue;
      }
      position++;

      /* Copied from a thread: exact witness, no model needed.
       *
       * `fill_slots_from_thread` duplicates an instruction into the slot when
       * it does not own the thread it took it from, so the original survives
       * and the copy is textually identical to it. Two shapes appear, and the
       * only thing that separates them is whether the original is a block
       * leader:
       *
       *  - the original is a leader: the branch was redirected one instruction
       *    past it, so the preimage restores the target as well as deleting the
       *    copy;
       *  - the original is not a leader: it is the tail of the fall-through
       *    path, sitting just before the label, and the branch target never
       *    moved. Only the copy goes.
       */
      const target = owner.branchTargetIndex;
      const previous = target === undefined ? undefined : program.insns[target - 1];
      const duplicatesOriginal = previous !== undefined && previous.text === slot.text && previous.id !== slot.id;
      const takeDuplicate = (redirectTarget: boolean, detail: string) => {
        duplicatesRemoved.push({ branchId: owner.id, slotId: slot.id, targetIndex: target! - 1 });
        if (redirectTarget) redirected.set(owner.id, previous!.id);
        dropped.add(slot.id);
        restorations.push({
          branchId: owner.id,
          slotId: slot.id,
          position: -1,
          origin: "stolen-from-target",
          fiber: [-1],
          evidence: [detail],
        });
        body.push(owner);
        scanFloor = body.length;
      };

      /* A branch pointing one instruction PAST a label whose instruction the
       * slot duplicates has no other explanation: nothing else redirects a
       * branch. That witness is taken before any scan. */
      if (duplicatesOriginal && leaders.has(previous!.id)) {
        takeDuplicate(true, `branch targets one instruction past ${previous!.text}, which the slot duplicates`);
        continue;
      }

      /* Backward scan. If any instruction still in the body is conflict-free,
       * `fill_simple_delay_slots` would have taken THAT one, so the slot must
       * have come from a position after it — and the forward scan never ran. */
      const admissible: number[] = [];
      let latestEligibleBodyPosition = -1;
      for (let candidate = body.length; candidate >= scanFloor; candidate--) {
        if (candidate < body.length && eligible(body[candidate], body.slice(candidate + 1), owner).ok) {
          latestEligibleBodyPosition = candidate;
          break;
        }
        if (eligible(slot, body.slice(candidate), owner).ok) admissible.push(candidate);
      }
      const beforePositions = admissible
        .filter((candidate) => candidate > latestEligibleBodyPosition)
        .sort((left, right) => left - right);

      /* The forward phase can only ever take an instruction for a CALL_INSN.
       * Its eligibility test is guarded by `target == 0`, and `target` is set
       * to `JUMP_LABEL (insn)` for every jump — so for a branch the loop walks
       * forward, accumulates resources, and takes nothing. Modeling it as
       * available to branches quietly steals every eager thread fill. */
      const forwardScanApplies = owner.isCall;
      const forwardAdmissible = latestEligibleBodyPosition < 0 && forwardScanApplies &&
        forwardEligible(slot, owner);

      /* The other duplication shape — the original sitting just before the
       * label, with the branch target unchanged — looks exactly like an
       * own-block fill. It is only taken when nothing else explains the slot,
       * which mirrors dbr's own order: fill_simple_delay_slots runs to
       * exhaustion before fill_eager_delay_slots is reached at all. */
      if (duplicatesOriginal && latestEligibleBodyPosition < 0 && !forwardAdmissible) {
        takeDuplicate(false, `the slot duplicates ${previous!.text}, the instruction just before the branch target, and no scan admits it`);
        continue;
      }

      const evidence: string[] = [];
      const fiberMembers: FiberSite["members"] = [];
      if (forwardAdmissible) {
        fiberMembers.push({
          id: "after",
          summary: `left after ${owner.text}, taken by the forward scan`,
          sourceLever: [],
          evidence: ["the backward scan found no candidate, so fill_simple_delay_slots reached its forward phase"],
        });
      }
      for (const candidate of beforePositions) {
        fiberMembers.push({
          id: `position-${candidate}`,
          summary: `restored at body position ${candidate}`,
          sourceLever: [],
          evidence: [],
        });
      }

      /* The forward scan is the identity on the stream, so preferring it when
       * it is admissible reconstructs the least motion consistent with the
       * observation. */
      const origin: SlotRestoration["origin"] = forwardAdmissible ? "forward-scan" : "own-block";
      const restoredAt = forwardAdmissible
        ? body.length
        : (beforePositions.length > 0 ? beforePositions[0] : body.length);
      if (!forwardAdmissible && beforePositions.length === 0) {
        /* Nothing local explains the slot, so `fill_eager_delay_slots` took it
         * out of a thread and, owning that thread, moved rather than copied it.
         * The thread is the successor that reads what the instruction writes. */
        const destination = threadDestination(program, owner, slot, blockOfInsn);
        if (destination !== undefined) {
          threadMoves.push({ insn: slot, destination });
          restorations.push({
            branchId: owner.id,
            slotId: slot.id,
            position: -1,
            origin: "moved-from-thread",
            fiber: [-3],
            evidence: [`no scan admits the slot; block ${destination} reads ${slot.defs.join(",") || "its result"} first`],
          });
          body.push(owner);
          scanFloor = body.length;
          continue;
        }
        modelGaps.push(`${owner.text}: no conflict-free position for ${slot.text} in either direction`);
        evidence.push("the resource model admits no position");
      }

      restorations.push({
        branchId: owner.id,
        slotId: slot.id,
        position: restoredAt,
        origin,
        fiber: fiberMembers.map((member) => member.id === "after" ? -2 : Number(member.id.slice("position-".length))),
        evidence,
      });

      if (fiberMembers.length > 1) {
        sites.push({
          id: `dbr:${owner.id}`,
          stage: "mach",
          location: `block ${block.index}, delay slot of ${owner.text}`,
          kind: "delay-slot-origin",
          description: `${slot.text} has ${fiberMembers.length} pre-dbr origins consistent with the observed stream`,
          members: fiberMembers,
          affectedVram: slot.vram === undefined ? [] : [slot.vram],
          confidence: "reconstructed",
          evidence: ["dbr removes the instruction from its position, so the origin is constrained, never recorded"],
        });
      }

      slot.slotFiber = fiberMembers.length;
      if (forwardAdmissible) {
        body.push(owner);
        body.push(slot);
      } else {
        body.splice(restoredAt, 0, slot);
        body.push(owner);
      }
      scanFloor = body.length;
    }

    blocks[block.index].insns = body.map((insn) => insn.id);
  }

  /* Eagerly-moved instructions return to the head of the thread they came out
   * of, which is usually a block processed earlier or later than the branch's,
   * so the move is applied once every block body exists. */
  for (const move of threadMoves) {
    const destination = blocks[move.destination];
    if (!destination) continue;
    destination.insns.unshift(move.insn.id);
  }
  for (const block of blocks) {
    for (const id of block.insns) {
      const insn = byId.get(id);
      if (insn) order.push(insn);
    }
  }

  const survivors = order.filter((insn) => !dropped.has(insn.id));
  const positionOfId = new Map<number, number>();
  survivors.forEach((insn, index) => {
    insn.index = index;
    delete insn.delaySlotOf;
    positionOfId.set(insn.id, index);
  });
  for (const insn of survivors) {
    const target = redirected.get(insn.id);
    if (target !== undefined) insn.branchTargetIndex = positionOfId.get(target);
    else if (insn.branchTargetIndex !== undefined) {
      const targetId = program.insns[insn.branchTargetIndex]?.id;
      const mapped = targetId === undefined ? undefined : positionOfId.get(targetId);
      if (mapped === undefined) delete insn.branchTargetIndex;
      else insn.branchTargetIndex = mapped;
    }
  }
  for (const block of blocks) block.insns = block.insns.filter((id) => !dropped.has(id));

  return {
    program: {
      waypoint: "mach",
      functionName: program.functionName,
      insns: survivors,
      blocks,
      caveats: program.caveats.slice(),
    },
    restorations,
    duplicatesRemoved,
    modelGaps,
    sites,
  };
}
