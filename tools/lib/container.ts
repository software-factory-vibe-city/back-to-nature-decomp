/**
 * container.ts — one binary the project builds, whatever kind it is.
 *
 * Deliverable 4 of plans/overlay-decompilation-enablement.md. Everything under
 * `tools/lib/` used to assume one binary, one address space and one symbol map.
 * A PS-X EXE has a header that supplies its load address and section layout; an
 * overlay member is a raw sector blob whose base is supplied externally by the
 * Deliverable 3 solver. This module is the seam: it answers "where are this
 * container's bytes, symbols, assembly and objects" so that no tool has to know
 * which kind it is holding.
 *
 * The PS-X EXE is container `exe` and nothing about it changes. Paths are
 * resolved with a fallback to the pre-container layout, so moving a file into
 * the per-container layout is a move, not a code change.
 */

import { existsSync } from "fs";
import { join } from "path";
import { ROOT, exeBasename, loadPsxExeInfo } from "./psxExeInfo.js";
import { codeMembers, loadManifest, memberBinPath, type ManifestMember } from "./overlayManifest.js";

export type ContainerKind = "exe" | "overlay";

export const EXE_CONTAINER_ID = "exe";

export interface ContainerPaths {
  /** splat config for this container. */
  splat: string;
  /** `NAME = 0xADDR;` table splat reads and writes for this container. */
  symbolAddrs: string;
  /** Where splat writes this container's disassembly. */
  asmDir: string;
  /** Where this container's C sources live. */
  srcDir: string;
  /** Where this container's compiled objects land. */
  objDir: string;
  /** Generated linker script. */
  ldScript: string;
  builtElf: string;
  builtBin: string;
  /** splat's generated undefined-symbol tables. */
  undefinedFuncs: string;
  undefinedSyms: string;
  /** Where the disassembler's per-container artifacts land. */
  disasmDir: string;
  /** spimdisasm's function table, from the `--disasm-unknown` pass. */
  functionsCsv: string;
  /**
   * spimdisasm's function table from the pass *without* `--disasm-unknown`.
   *
   * The second pass is mandatory, not incidental. With `--disasm-unknown`
   * spimdisasm invents multi-kilobyte phantom functions inside data regions,
   * which breaks boundary inference — and overlay members are roughly half
   * data by volume, so the failure is worse there than in the EXE.
   */
  layoutCsv: string;
  /** Per-function assembly dump, the disassembler's complete record. */
  functionsDir: string;
  /** Derived section boundaries for this container. */
  sectionLayout: string;
  /** Address -> name table handed to the disassembler. */
  disasmSymbolAddrs: string;
}

export interface Container {
  id: string;
  kind: ContainerKind;
  /** splat's `basename` for this container. */
  basename: string;
  /** The original bytes this container's build must reproduce. */
  targetPath: string;
  /** Byte offset into `targetPath` at which the loaded image begins. */
  payloadOffset: number;
  payloadSize: number;
  /** Address of `targetPath[payloadOffset]`. */
  loadAddr: number;
  /** `$gp` base. Zero for overlays: they carry no gp-relative addressing. */
  gpValue: number;
  paths: ContainerPaths;
  /** Overlays only: the archive member this container is. */
  member?: ManifestMember;
}

/** First existing path, else the last one — so a move is a move, not a code change. */
function preferred(...candidates: string[]): string {
  for (const candidate of candidates.slice(0, -1)) {
    if (existsSync(join(ROOT, candidate))) return candidate;
  }
  return candidates[candidates.length - 1]!;
}

function exeContainer(): Container {
  const info = loadPsxExeInfo();
  /* splat's own `basename` for this project. Never a literal — the executable's
     name is a fact about one game. */
  const basename = exeBasename();
  return {
    id: EXE_CONTAINER_ID,
    kind: "exe",
    basename,
    targetPath: info.binaryPath.startsWith(ROOT) ? info.binaryPath.slice(ROOT.length + 1) : info.binaryPath,
    payloadOffset: info.payloadOffset,
    payloadSize: info.payloadSize,
    loadAddr: info.loadAddr,
    gpValue: info.gpValue,
    paths: {
      splat: preferred("configs/splat/exe.yaml", "configs/splat.yaml"),
      symbolAddrs: preferred("configs/symbols/exe.txt", "configs/symbol_addrs.txt"),
      asmDir: "build/asm",
      srcDir: "src",
      objDir: "build/src",
      ldScript: `build/${basename}.ld`,
      builtElf: `build/${basename}.elf`,
      builtBin: `build/${basename}.bin`,
      undefinedFuncs: "build/undefined_funcs_auto.txt",
      undefinedSyms: "build/undefined_syms_auto.txt",
      disasmDir: "build",
      functionsCsv: "build/functions.csv",
      layoutCsv: "build/without-unknown/functions.csv",
      functionsDir: "build/functions",
      sectionLayout: "build/sectionLayout.json",
      disasmSymbolAddrs: "build/disassembler_symbol_addrs.txt",
    },
  };
}

function overlayContainer(member: ManifestMember): Container | null {
  if (member.base?.verdict !== "resolved" || member.base.base === null) return null;
  return {
    id: member.id,
    kind: "overlay",
    basename: member.id,
    /* An overlay's target is its extracted member bytes, which is why
       Deliverable 1's acceptance requires reproducible extraction. */
    targetPath: memberBinPath(member).slice(ROOT.length + 1),
    payloadOffset: member.base.loadOffset,
    payloadSize: member.size - member.base.loadOffset,
    loadAddr: member.base.base + member.base.loadOffset,
    /* `gp_value` is meaningless for an overlay: it defines no small data and
       emits no gp-relative access. Deliverable 12 confirms this before any C
       is written against it. */
    gpValue: 0,
    paths: {
      splat: `configs/splat/${member.id}.yaml`,
      symbolAddrs: `configs/symbols/${member.id}.txt`,
      asmDir: `build/${member.id}/asm`,
      srcDir: `src/overlays/${member.id}`,
      objDir: `build/src/overlays/${member.id}`,
      ldScript: `build/${member.id}/${member.id}.ld`,
      builtElf: `build/${member.id}/${member.id}.elf`,
      builtBin: `build/${member.id}/${member.id}.bin`,
      undefinedFuncs: `build/${member.id}/undefined_funcs_auto.txt`,
      undefinedSyms: `build/${member.id}/undefined_syms_auto.txt`,
      disasmDir: `build/${member.id}`,
      functionsCsv: `build/${member.id}/functions.csv`,
      layoutCsv: `build/${member.id}/without-unknown/functions.csv`,
      functionsDir: `build/${member.id}/functions`,
      sectionLayout: `build/${member.id}/sectionLayout.json`,
      disasmSymbolAddrs: `build/${member.id}/disassembler_symbol_addrs.txt`,
    },
    member,
  };
}

let cache: Container[] | undefined;

/**
 * Every container the project builds: `exe` first, then one per code member
 * whose base is solved. A member whose base is `undetermined` is deliberately
 * absent — it is work to finish, not a container to build on a guessed base.
 */
export function loadContainers(): Container[] {
  if (cache) return cache;
  const containers = [exeContainer()];
  const manifest = loadManifest();
  if (manifest) {
    for (const member of codeMembers(manifest)) {
      const container = overlayContainer(member);
      if (container) containers.push(container);
    }
  }
  cache = containers;
  return containers;
}

/** Members classified as code whose base is not solved — reported, never skipped silently. */
export function unresolvedCodeMembers(): ManifestMember[] {
  const manifest = loadManifest();
  if (!manifest) return [];
  return codeMembers(manifest).filter((m) => m.base?.verdict !== "resolved");
}

export function loadContainer(id: string): Container | null {
  return loadContainers().find((container) => container.id === id) ?? null;
}

export function requireContainer(id: string): Container {
  const container = loadContainer(id);
  if (!container) {
    const known = loadContainers().map((c) => c.id).join(", ");
    throw new Error(`Unknown container ${JSON.stringify(id)}. Known containers: ${known}`);
  }
  return container;
}

export function exeContainerOf(containers = loadContainers()): Container {
  return containers.find((c) => c.kind === "exe")!;
}

/** Absolute path for one of a container's paths. */
export function containerPath(container: Container, key: keyof ContainerPaths): string {
  return join(ROOT, container.paths[key]);
}

export function containerTargetPath(container: Container): string {
  return join(ROOT, container.targetPath);
}

/** File offset of an address inside this container's image. */
export function vramToRom(container: Container, vram: number): number {
  return vram - container.loadAddr + container.payloadOffset;
}

export function romToVram(container: Container, rom: number): number {
  return rom - container.payloadOffset + container.loadAddr;
}

export function containsVram(container: Container, vram: number): boolean {
  return vram >= container.loadAddr && vram < container.loadAddr + container.payloadSize;
}

/**
 * Containers whose image covers this address.
 *
 * Deliberately plural. Overlays that share a slot occupy the same addresses and
 * are never resident together, so an address alone does not identify a
 * container — that is exactly the ambiguity Deliverable 5 keys symbols against
 * and Deliverable 13 keys the work queue against.
 */
export function containersCovering(vram: number, containers = loadContainers()): Container[] {
  return containers.filter((container) => containsVram(container, vram));
}

/** Overlay containers grouped by load address: one group per RAM slot. */
export function slotsOf(containers = loadContainers()): Map<number, Container[]> {
  const slots = new Map<number, Container[]>();
  for (const container of containers) {
    if (container.kind !== "overlay") continue;
    slots.set(container.loadAddr, [...(slots.get(container.loadAddr) ?? []), container]);
  }
  return slots;
}

/**
 * The prefix every symbol this container defines carries.
 *
 * Overlays that share a RAM slot hold different functions at the same address,
 * so `func_800B7E24` alone names several different functions. Prefixing with
 * the container id makes `(container, vram)` expressible as one token, which is
 * what lets every tool that is keyed by symbol name stay correct without
 * knowing containers exist. The PS-X EXE keeps its bare names.
 */
export function symbolPrefix(container: Container): string {
  return container.kind === "exe" ? "" : `${container.id}_`;
}

/** The container id encoded in a symbol name, when one is. */
export function containerOfSymbol(name: string, containers = loadContainers()): Container | null {
  for (const container of containers) {
    if (container.kind === "exe") continue;
    if (name.startsWith(`${container.id}_`)) return container;
  }
  return null;
}

/** The default symbol name for a function at an address in a container. */
export function defaultFunctionName(container: Container, vram: number): string {
  return `${symbolPrefix(container)}func_${vram.toString(16).toUpperCase().padStart(8, "0")}`;
}

/** Reset the module cache. Tests and long-lived processes need this after a re-split. */
export function resetContainerCache(): void {
  cache = undefined;
}
