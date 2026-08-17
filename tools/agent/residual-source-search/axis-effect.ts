import { canonicalContext, canonicalSourceHash } from "./canonicalize.js";
import { candidateAt, type DomainRuntime } from "./enumerate.js";
import { renderCandidate } from "./render.js";
import type { AxisEffect, SemanticGraph } from "./types.js";
import type { WebView } from "./web-partitions.js";

/**
 * How many coordinates one axis may spend proving it does something. An axis
 * that changes the candidate at all changes it within the first few digits in
 * every case measured; the bound exists so a wide axis cannot make derivation
 * cost more than the search it is pricing.
 */
const MAX_SAMPLES_PER_AXIS = 12;

/** Total renders across all axes, so a domain with many regions stays cheap. */
const MAX_TOTAL_SAMPLES = 400;

/**
 * Evenly spaced digit values, always including 0 and the last, so a sampled
 * axis is probed across its range rather than only at its low end.
 */
function digitSamples(size: bigint, budget: number): bigint[] {
  if (size <= 1n) return [0n];
  const count = size < BigInt(budget) ? Number(size) : budget;
  const values: bigint[] = [];
  for (let index = 0; index < count; index++) {
    values.push((BigInt(index) * (size - 1n)) / BigInt(count - 1 || 1));
  }
  return [...new Set(values.map((value) => value.toString()))].map((value) => BigInt(value));
}

/**
 * Does each axis the domain counts actually change the candidate it renders?
 *
 * A domain is a mixed-radix odometer, and its size is the product of the
 * radices. That product is only a count of programs if every digit moves the
 * program. A digit that renders the same source at every value is an axis the
 * search will still visit, evaluate, deduplicate, and report as covered — and
 * it multiplies the projected cost by its radix while adding nothing. Worse,
 * it reads as a searched axis afterwards: "exhausted over 15 web partitions"
 * is a true sentence about an odometer and a false one about the program.
 *
 * So each axis is held against the baseline coordinate with every other digit
 * fixed, and the distinct canonical sources it produces are counted. One means
 * inert. Rendering is span replacement over a string, so this costs no
 * compilation and runs before the estimate that would otherwise misprice the
 * run.
 *
 * A sampled axis that comes back inert is reported as inert *over the sampled
 * digits*, never as a proof about the whole radix; the sample size travels with
 * the finding.
 */
export function measureAxisEffects(options: {
  source: string;
  graph: SemanticGraph;
  view: WebView;
  domain: DomainRuntime;
  /** Overridden by tests to observe which ranks each axis probes. */
  hashAt?: (rank: bigint) => string;
}): { axes: AxisEffect[]; caveats: string[] } {
  const { source, graph, view, domain } = options;
  const axes: AxisEffect[] = [];
  const caveats: string[] = [];
  let budget = MAX_TOTAL_SAMPLES;

  const context = options.hashAt ? undefined : canonicalContext(graph, source);
  const hashAt = options.hashAt ?? ((rank: bigint): string =>
    canonicalSourceHash(renderCandidate(source, graph, view, candidateAt(domain, rank)), context!));

  const baseSection = domain.partitions[0];
  if (!baseSection) return { axes, caveats };

  /* ---------------------------------------------------------------- */
  /* The section axis: partition, materialization, chain form, copies. */
  /* ---------------------------------------------------------------- */

  if (domain.partitions.length > 1) {
    const sampled = domain.partitions.length <= MAX_SAMPLES_PER_AXIS
      ? domain.partitions
      : digitSamples(BigInt(domain.partitions.length), MAX_SAMPLES_PER_AXIS)
        .map((index) => domain.partitions[Number(index)]!);
    const hashes = new Set<string>();
    for (const section of sampled) {
      if (budget <= 0) break;
      budget--;
      /* Offset is the section's own baseline: every region digit zero, so the
       * only thing that varies between these ranks is the section itself. */
      hashes.add(hashAt(section.offset));
    }
    axes.push({
      id: "section",
      kind: "section",
      radix: domain.partitions.length.toString(),
      sampled: sampled.length,
      distinct: hashes.size,
      inert: hashes.size <= 1,
      detail: `${domain.partitions.length} section(s) over web partition, materialization, chain form, and rule 4.7 copies`,
    });
  }

  /* ---------------------------------------------------------------- */
  /* Region axes, inside the baseline section.                         */
  /* ---------------------------------------------------------------- */

  const regions = baseSection.regions;
  for (let index = 0; index < regions.length; index++) {
    const region = regions[index]!;
    if (region.size <= 1n) continue;
    /* Place value: this digit steps by the product of the radices below it. */
    let place = 1n;
    for (let below = index + 1; below < regions.length; below++) place *= regions[below]!.size;

    const hashes = new Set<string>();
    const samples = digitSamples(region.size, MAX_SAMPLES_PER_AXIS);
    let taken = 0;
    for (const digit of samples) {
      if (budget <= 0) break;
      budget--;
      taken++;
      hashes.add(hashAt(baseSection.offset + place * digit));
    }
    axes.push({
      id: `region:${region.region.id}`,
      kind: "region",
      radix: region.size.toString(),
      sampled: taken,
      distinct: hashes.size,
      inert: hashes.size <= 1,
      detail: `${region.nodeIds.length} statement(s) in block ${region.region.block}`,
    });
  }

  /* ---------------------------------------------------------------- */
  /* What the caller has to be told.                                   */
  /* ---------------------------------------------------------------- */

  const inert = axes.filter((axis) => axis.inert);
  for (const axis of inert) {
    const exhaustive = BigInt(axis.sampled) >= BigInt(axis.radix);
    caveats.push(
      `Axis ${axis.id} has radix ${axis.radix} but rendered one source across ` +
      `${axis.sampled} ${exhaustive ? "value(s), which is all of them" : "sampled value(s)"}: ` +
      (exhaustive
        ? "it is inert. The domain counts it and the search will visit it, so the candidate total and the " +
          `projected cost are inflated by ${axis.radix}x with no program behind it.`
        : "no sampled value changed the program. Treat the axis as unmeasured rather than searched until a " +
          "value is found that does change it."),
    );
  }
  if (budget <= 0) {
    caveats.push(
      `The axis-effect probe stopped at its ${MAX_TOTAL_SAMPLES}-render bound; axes after the ones reported ` +
      "were not measured and are neither confirmed effective nor inert.",
    );
  }
  return { axes, caveats };
}
