/**
 * The family index — every configured function grouped by the shape of its
 * original words, and the donor question answered from it.
 *
 * A *family* is a set of functions with one shape. A family is *useful* when
 * at least one member is matched with clean C: that member is a donor, and the
 * rest are targets a transfer can attempt. A family with no matched member is
 * still worth recording — solving one representative makes the whole family
 * replayable, which is the difference between "one function solved" and "a
 * capability delivered".
 *
 * Both tiers are indexed. The strict tier finds members that differ only in
 * which symbols they name; the flexible tier additionally finds members that
 * differ in offsets, strides and bounds, which is the case the investigation's
 * one successful transfer belongs to.
 *
 * The index is a target-side artifact: it reads container images, splat
 * configs and symbol tables to build shapes, and consults `src/` only to ask
 * the separate question of which members are *matched*. That separation is
 * what lets a held-out evaluation use the index without leaking known C.
 */

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { ROOT } from "../decompToolchain.js";
import { loadContainers, type Container } from "../../lib/container.js";
import { loadFunctionSpans } from "../../lib/symbolIndex.js";
import { excludedReason, type Exclusion } from "../idiom-corpus/corpus.js";
import { contextMode, warmContextAllowed } from "../matching-reconstruction/context-mode.js";
import { overlayRevision, overlaySourceFor } from "../campaign/artifact-overlay.js";
import { decodeFunctionWords, signatureOf, symbolResolverFor, type FamilySignature, type SignatureTier } from "./signature.js";

/** Why a function cannot act as a donor. Reported, never silent. */
export type DonorExclusion = Exclusion | "stub" | "unreadable";

export interface FamilyMember {
  functionName: string;
  containerId: string;
  vram: number;
  sizeBytes: number;
  /** Absolute path to this member's C source, when it has one. */
  sourcePath?: string;
  /** Present exactly when the member cannot donate. */
  excluded?: DonorExclusion;
}

export interface Family {
  shape: string;
  tier: SignatureTier;
  words: number;
  members: FamilyMember[];
  /** Members whose C is clean, matched source — the possible donors. */
  donors: string[];
  /** Members still handed to the assembler — the possible targets. */
  targets: string[];
}

export interface FamilyIndex {
  tier: SignatureTier;
  families: Family[];
  /** Signature per function, so a transfer need not re-derive it. */
  signatures: Map<string, FamilySignature>;
  /** Functions whose words could not be decoded at all. */
  skipped: Array<{ functionName: string; reason: string }>;
}

/* ---- membership ----------------------------------------------------------- */

/**
 * Where a function's source lives and whether it can donate.
 *
 * A source that still hands the function to the assembler teaches nothing
 * about C, and one containing embedded assembly or a pinned register teaches
 * the wrong thing — the same exclusions the idiom corpus applies, reused so
 * the two cannot drift apart.
 */
function classifySource(functionName: string, container: Container): { sourcePath?: string; excluded?: DonorExclusion } {
  /* A verified recovery published this run is a donor too, and it is the reason
   * a campaign's second round differs from its first. It is checked before
   * `src/` because it is checked at all: `src/` holds nothing for a function
   * that was a stub when the run began, so a consumer that only reads `src/`
   * can never see what the run itself recovered.
   *
   * It is also the one recovered artifact a *cold* run may read: the overlay
   * only holds what this project's own machinery derived from the target, and
   * `overlaySourceFor` withholds warm-derived entries from a cold reader, so
   * nothing anybody hand-wrote arrives through here. */
  const published = overlaySourceFor(functionName);
  if (published) {
    const publishedReason = excludedReason(published.text);
    if (!publishedReason) return { sourcePath: published.path };
  }

  /* Cold mode withholds recovered game C, and a donor is precisely that. The
   * *families* still form — they are word shapes, a target-side fact — so the
   * cold measurement still says "this function has eleven siblings", which is
   * the useful part of the retrieval even with nothing to transfer. */
  if (!warmContextAllowed()) return { excluded: "no-source" };
  const path = join(ROOT, container.paths.srcDir, `${functionName}.c`);
  if (!existsSync(path)) return { excluded: "no-source" };
  let text: string;
  try {
    text = readFileSync(path, "utf-8");
  } catch {
    return { sourcePath: path, excluded: "unreadable" };
  }
  const reason = excludedReason(text);
  if (reason) return { sourcePath: path, excluded: reason };
  return { sourcePath: path };
}

/* ---- building ------------------------------------------------------------- */

export interface BuildFamilyOptions {
  tier?: SignatureTier;
  /** Restrict to these containers; every configured container by default. */
  containers?: Container[];
  /** Skip these functions entirely — the one being worked, typically. */
  exclude?: string[];
  /** Only families with at least this many members are kept. */
  minimumMembers?: number;
  /** Functions shorter than this many words are too generic to be a family. */
  minimumWords?: number;
  onProgress?: ((done: number, total: number) => void) | undefined;
}

/**
 * The index for one configuration, built once per process.
 *
 * Building it decodes and signs every configured function — a few seconds.
 * That is nothing once and far too much per query, and a tool that asks "who
 * could donate to this function" several times in one run was paying it each
 * time. The key covers every option that changes the result.
 */
const indexCache = new Map<string, FamilyIndex>();

export function buildFamilyIndex(options: BuildFamilyOptions = {}): FamilyIndex {
  const cacheKey = JSON.stringify({
    contextMode: contextMode(),
    /* The overlay's revision, so a publication invalidates this index rather
     * than being outlived by it. A campaign asks for the index once per round;
     * without this, round two answers with round one's donors. */
    overlay: overlayRevision(),
    tier: options.tier ?? "flexible",
    containers: options.containers?.map((container) => container.id) ?? null,
    exclude: options.exclude ?? null,
    minimumMembers: options.minimumMembers ?? null,
    minimumWords: options.minimumWords ?? null,
  });
  const cached = indexCache.get(cacheKey);
  if (cached) return cached;
  const built = computeFamilyIndex(options);
  indexCache.set(cacheKey, built);
  return built;
}

/**
 * Build the family index over every configured function span.
 *
 * Very short functions are dropped: a four-word wrapper's shape is shared by
 * hundreds of unrelated functions, and a "family" of those is a fact about the
 * calling convention rather than about any source idiom.
 */
function computeFamilyIndex(options: BuildFamilyOptions): FamilyIndex {
  const tier = options.tier ?? "flexible";
  const minimumMembers = options.minimumMembers ?? 2;
  const minimumWords = options.minimumWords ?? 8;
  const skip = new Set(options.exclude ?? []);
  const containers = options.containers ?? loadContainers();

  const signatures = new Map<string, FamilySignature>();
  const byShape = new Map<string, FamilyMember[]>();
  const skipped: FamilyIndex["skipped"] = [];

  const spans = containers.flatMap((container) =>
    loadFunctionSpans(container).map((span) => ({ container, span })));

  spans.forEach(({ container, span }, index) => {
    options.onProgress?.(index, spans.length);
    if (skip.has(span.name)) return;
    let decoded;
    try {
      decoded = decodeFunctionWords(span.name);
    } catch (error) {
      skipped.push({ functionName: span.name, reason: error instanceof Error ? error.message : String(error) });
      return;
    }
    if (decoded.insns.length < minimumWords) return;
    const signature = signatureOf(span.name, container.id, decoded.insns, tier, symbolResolverFor(container));
    signatures.set(span.name, signature);
    const member: FamilyMember = {
      functionName: span.name,
      containerId: container.id,
      vram: decoded.vram,
      sizeBytes: decoded.sizeBytes,
      ...classifySource(span.name, container),
    };
    byShape.set(signature.shape, [...(byShape.get(signature.shape) ?? []), member]);
  });

  const families: Family[] = [];
  for (const [shape, members] of byShape) {
    if (members.length < minimumMembers) continue;
    const words = signatures.get(members[0]!.functionName)?.words ?? 0;
    families.push({
      shape,
      tier,
      words,
      members: members.sort((left, right) => left.functionName.localeCompare(right.functionName)),
      donors: members.filter((member) => !member.excluded).map((member) => member.functionName),
      targets: members.filter((member) => member.excluded === "include-asm" || member.excluded === "no-source")
        .map((member) => member.functionName),
    });
  }
  families.sort((left, right) => right.members.length - left.members.length || left.shape.localeCompare(right.shape));

  return { tier, families, signatures, skipped };
}

/** The family one function belongs to, if the index holds one. */
export function familyOf(index: FamilyIndex, functionName: string): Family | undefined {
  const signature = index.signatures.get(functionName);
  if (!signature) return undefined;
  return index.families.find((family) => family.shape === signature.shape);
}

/**
 * Donors for one target, best first.
 *
 * Ordering is by container proximity then by name: a donor in the same
 * container shares the target's flag column and small-data threshold, so its C
 * is the hypothesis least likely to need a build difference explained. A
 * cross-container donor is still permitted — the plan allows it as a tested
 * hypothesis — and the difference is carried on the result rather than
 * assumed away.
 */
export function donorsFor(index: FamilyIndex, target: string): FamilyMember[] {
  const family = familyOf(index, target);
  if (!family) return [];
  const targetMember = family.members.find((member) => member.functionName === target);
  return family.members
    .filter((member) => member.functionName !== target && !member.excluded)
    .sort((left, right) => {
      const leftSame = left.containerId === targetMember?.containerId ? 0 : 1;
      const rightSame = right.containerId === targetMember?.containerId ? 0 : 1;
      return leftSame - rightSame || left.functionName.localeCompare(right.functionName);
    });
}
