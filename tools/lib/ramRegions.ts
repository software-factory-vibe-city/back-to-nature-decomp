/**
 * ramRegions.ts — the game's RAM map, derived rather than declared.
 *
 * Deliverable 11 of plans/overlay-decompilation-enablement.md. Three region
 * classes matter and they are different in kind:
 *
 *   - The PS-X EXE's own image, whose sections the header and the split
 *     pipeline already place.
 *   - A shared mutable region between the end of that image and the first
 *     overlay slot, which no container owns in any file and which both bodies
 *     hammer — more reference sites than either body makes into its own image.
 *     Object pools, NPC records, save data, flags: the state overlay type
 *     recovery will actually live on.
 *   - Overlay slot space, holding whichever member is resident, its BSS above
 *     the member's extent, and the structure the EXE itself reaches into.
 *
 * Every boundary here comes from a measured fact — the EXE header, the derived
 * section layout, the solved overlay bases — so nothing is a constant. An
 * address that falls in no region is reported unclassified rather than
 * defaulted into the nearest one.
 */

import { RAM_END, RAM_START } from "./mips.js";
import { loadContainers, slotsOf, type Container } from "./container.js";
import { loadSectionLayout, loadPsxExeInfo } from "./psxExeInfo.js";

export interface RamRegion {
  name: string;
  start: number;
  end: number;
  /** Which container owns the bytes, when one does. */
  owner: string | null;
  /** Why this boundary is where it is. */
  evidence: string;
}

const hex = (value: number) => `0x${value.toString(16).toUpperCase().padStart(8, "0")}`;

/** The PS1's stack top, which BIOS sets and every PSY-Q title inherits. */
const STACK_TOP = 0x801ffff0;

export function buildRamMap(containers: Container[] = loadContainers()): RamRegion[] {
  const exe = loadPsxExeInfo();
  const layout = loadSectionLayout();
  const regions: RamRegion[] = [];

  const toVram = (rom: number) => rom - exe.payloadOffset + exe.loadAddr;

  regions.push({
    name: "kernel",
    start: RAM_START,
    end: exe.loadAddr,
    owner: null,
    evidence: `below the PS-X EXE's load address ${hex(exe.loadAddr)} from its header`,
  });

  if (layout) {
    const bounds: Array<[string, number, number]> = [
      ["exe.rodata", toVram(layout.rodataStart), toVram(layout.textStart)],
      ["exe.text", toVram(layout.textStart), toVram(layout.dataStart)],
      ["exe.data", toVram(layout.dataStart), toVram(layout.sdataStart)],
      ["exe.sdata", toVram(layout.sdataStart), toVram(layout.fileEnd)],
    ];
    for (const [name, start, end] of bounds) {
      if (end > start) {
        regions.push({ name, start, end, owner: "exe", evidence: "derived section layout (build/sectionLayout.json)" });
      }
    }
  } else {
    regions.push({
      name: "exe.image",
      start: exe.loadAddr,
      end: exe.loadAddr + exe.payloadSize,
      owner: "exe",
      evidence: "PS-X EXE header load address and payload size",
    });
  }

  const imageEnd = exe.loadAddr + exe.payloadSize;
  const slots = [...slotsOf(containers).entries()].sort((a, b) => a[0] - b[0]);

  /* Between the loaded image and the first slot sits the region both bodies
     mutate and neither declares. Its lower edge is the end of the EXE image;
     its upper edge is the lowest solved overlay base. */
  const firstSlot = slots[0]?.[0];
  if (firstSlot !== undefined && firstSlot > imageEnd) {
    regions.push({
      name: "shared-bss-heap",
      start: imageEnd,
      end: firstSlot,
      owner: null,
      evidence: `between the end of the PS-X EXE image (${hex(imageEnd)}) and the lowest solved overlay base (${hex(firstSlot)})`,
    });
  }

  slots.forEach(([base, members], index) => {
    const largest = Math.max(...members.map((m) => m.payloadSize));
    const nextBase = slots[index + 1]?.[0] ?? STACK_TOP;
    regions.push({
      name: `slot.${hex(base)}`,
      start: base,
      end: base + largest,
      owner: members.map((m) => m.id).join("|"),
      evidence:
        `${members.length} member(s) solved to this base; extent is the largest of them ` +
        `(${members.reduce((a, b) => (a.payloadSize >= b.payloadSize ? a : b)).id}, ${largest} bytes)`,
    });
    if (nextBase > base + largest) {
      regions.push({
        name: `slot.${hex(base)}.bss`,
        start: base + largest,
        end: nextBase,
        owner: members.map((m) => m.id).join("|"),
        evidence:
          "above every member's extent in this slot and below the next placed region: an overlay's BSS " +
          "is not in the member file, so it can only live here",
      });
    }
  });

  const lastEnd = regions[regions.length - 1]?.end ?? imageEnd;
  if (STACK_TOP > lastEnd) {
    regions.push({
      name: "high-buffer",
      start: lastEnd,
      end: STACK_TOP,
      owner: null,
      evidence: `between the last placed region and the BIOS stack top (${hex(STACK_TOP)})`,
    });
  }
  regions.push({
    name: "stack",
    start: STACK_TOP,
    end: RAM_END,
    owner: null,
    evidence: "BIOS stack top to the end of PS1 main RAM",
  });

  return regions.sort((a, b) => a.start - b.start);
}

/** The region an address falls in, or null — never the nearest one. */
export function regionOf(regions: readonly RamRegion[], address: number): RamRegion | null {
  return regions.find((region) => address >= region.start && address < region.end) ?? null;
}
