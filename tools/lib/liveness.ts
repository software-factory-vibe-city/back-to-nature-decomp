/**
 * liveness.ts — is a function referenced from anywhere the game actually runs?
 *
 * Liveness must be judged against raw images, not the residual call graph: once
 * a caller is decompiled its `.s` disappears and every `jal` it made disappears
 * with it, so a callee called only by matched code looks callerless.
 *
 * Deliverable 2 of plans/overlay-decompilation-enablement.md corrects the
 * defect that made this scan PS-X EXE-only. 93 PS-X EXE functions are called
 * exclusively from overlay members; judged against the EXE alone they are dead,
 * which both drops them from the progress denominator and — worse — sorts them
 * to the end of the work queue, exactly inverting their real priority.
 *
 * One module so `progress.ts` and `callGraph.ts` cannot drift apart on the rule.
 */

import { readFileSync } from "fs";
import { isValidRamAddress, jalTarget } from "./mips.js";
import { overlayReferencedExeAddresses, scanOverlayReferences } from "./overlayReferences.js";
import { loadPsxExeInfo } from "./psxExeInfo.js";

export interface Liveness {
  /** Every address referenced from any container. */
  referenced: Set<number>;
  /** Addresses referenced from within the PS-X EXE image. */
  fromExe: Set<number>;
  /** Addresses referenced from overlay members. Empty when no manifest exists. */
  fromOverlays: Set<number>;
  /** Human-readable statement of what the verdict was computed over. */
  basis: string;
  /** True when overlay evidence was available; false means EXE-only, stated as such. */
  overlaysIncluded: boolean;
  /** `jal`-shaped words rejected by the RAM-range check, across all containers. */
  rejectedJalWords: number;
}

let cached: Liveness | undefined;

/**
 * References from the PS-X EXE image itself: `jal` targets, range-checked, plus
 * every 32-bit word that could be a stored function pointer.
 */
function scanExe(): { referenced: Set<number>; rejected: number } {
  const exe = loadPsxExeInfo();
  const payload = readFileSync(exe.binaryPath);
  const referenced = new Set<number>();
  let rejected = 0;

  for (let offset = exe.payloadOffset; offset + 4 <= payload.length; offset += 4) {
    const word = payload.readUInt32LE(offset);
    const target = jalTarget(word, exe.loadAddr);
    if (target !== null) {
      if (isValidRamAddress(target)) referenced.add(target);
      else rejected++;
    }
    referenced.add(word);
  }

  return { referenced, rejected };
}

export function computeLiveness(): Liveness {
  if (cached) return cached;

  const exe = scanExe();
  const fromOverlays = overlayReferencedExeAddresses();
  const scan = scanOverlayReferences();
  const referenced = new Set(exe.referenced);
  for (const address of fromOverlays) referenced.add(address);

  const overlaysIncluded = scan !== null;
  const basis = overlaysIncluded
    ? `PS-X EXE image plus ${scan!.perMember.length} overlay code members ` +
      `(${fromOverlays.size} EXE addresses referenced from overlays)`
    : "PS-X EXE image only — no overlay manifest, so overlay-facing functions are understated as dead";

  cached = {
    referenced,
    fromExe: exe.referenced,
    fromOverlays,
    basis,
    overlaysIncluded,
    rejectedJalWords: exe.rejected + (scan?.totalRejectedJalWords ?? 0),
  };
  return cached;
}

/** Is this function address referenced from anywhere? */
export function isLive(liveness: Liveness, address: number): boolean {
  return liveness.referenced.has(address);
}

/** Referenced only from overlays — the engine-API set the old scan called dead. */
export function isOverlayOnlyReference(liveness: Liveness, address: number): boolean {
  return liveness.fromOverlays.has(address) && !liveness.fromExe.has(address);
}
