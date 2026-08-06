import {
  macroComponents,
  replaceMacroArgument,
  type MaterializationChoice,
  type NamedPartitionRuntime,
  type DerivedGrammar,
} from "./rewrite-catalog.js";
import {
  RegionOrderModel,
  RegionTooLargeError,
  loopCarriedDependencies,
  parseMemoryToken,
  regionDependencies,
  type RegionNodeView,
} from "./topological-orders.js";
import { webLookupId } from "./semantic-graph.js";
import type { WebView } from "./web-partitions.js";
import {
  RESIDUAL_SEARCH_SCHEMA_VERSION,
  type AdministrativeCopySite,
  type Coordinate,
  type MaterializationSite,
  type OrderRegion,
  type PartitionDomain,
  type ResidualDomain,
  type SemanticGraph,
  type SemanticNode,
  type SwitchFormSite,
} from "./types.js";

/**
 * The serialized domain is built entry by entry, so its structure has to fit
 * in memory even when its candidate count does not. Crossing this bound is a
 * `domain-too-large` result with an exact reason, never an exhausted process.
 */
export const MAX_DOMAIN_ENTRIES = 400_000;

export class DomainTooLargeError extends Error {
  constructor(readonly entries: number) {
    super(`the serialized domain needs more than ${entries} section/region entries to describe, ` +
      "beyond what can be enumerated; reduce the residual so the causal closure is smaller");
  }
}

export interface VariantRuntime {
  splitMask: number;
  updateMask: number;
  birthMask: number;
  /** Effective node ids after split/materialization, births removed, canonical order. */
  keptIds: string[];
  removedNodes: string[];
  addedNodes: string[];
  model: RegionOrderModel;
  count: bigint;
  cumulative: bigint;
}

export interface RegionRuntime {
  region: OrderRegion;
  nodeIds: string[];
  birthEligible: string[];
  variants: VariantRuntime[];
  size: bigint;
}

export interface PartitionRuntime {
  index: number;
  named: NamedPartitionRuntime;
  materializedSites: string[];
  /** Switch node ids spelled as an if/else-if chain in this section. */
  switchForms: string[];
  /** Rule 4.7 copy site ids active in this section. */
  administrativeCopies: string[];
  regions: RegionRuntime[];
  /** Component, materialization-def, copy-def, and adjusted-host statements for this section. */
  syntheticNodes: Map<string, SemanticNode>;
  size: bigint;
  offset: bigint;
}

export interface DomainRuntime {
  partitions: PartitionRuntime[];
  total: bigint;
  domain: ResidualDomain;
  /** Every admissible switch chain form, by switch node id. */
  switchFormSites: Map<string, SwitchFormSite>;
  caveats: string[];
}

/** Group name for one variable occurrence at one node under a partition. */
export function groupNameAt(
  view: WebView,
  named: NamedPartitionRuntime,
  nodeId: string,
  variable: string,
  side: "read" | "write",
): string {
  /* Rule 4.7: reads past an administrative copy resolve to the copy's web. */
  if (side === "read") {
    const redirect = named.readRedirects?.get(nodeId)?.get(variable);
    if (redirect) return named.groupOfWeb.get(redirect) ?? variable;
  }
  const lookup = webLookupId(nodeId);
  const webId = side === "write"
    ? view.defWebs.get(lookup)?.get(variable) ?? view.reaching.get(lookup)?.get(variable)
    : view.reaching.get(lookup)?.get(variable) ?? view.defWebs.get(lookup)?.get(variable);
  if (webId) return named.groupOfWeb.get(webId) ?? variable;
  /* Synthetic materialization variables resolve directly by their web id. */
  return named.groupOfWeb.get(`${variable}#0`) ?? variable;
}

function regionNodeView(
  graph: SemanticGraph,
  view: WebView,
  named: NamedPartitionRuntime,
  node: SemanticNode,
): RegionNodeView {
  const variableNames = new Set(graph.variables.map((variable) => variable.name));
  const lookup = webLookupId(node.id);
  const webAt = (variable: string) =>
    view.reaching.get(lookup)?.get(variable) ?? view.defWebs.get(lookup)?.get(variable);
  return {
    id: node.id,
    node,
    reads: new Set(node.reads.map((variable) => groupNameAt(view, named, node.id, variable, "read"))),
    writes: new Set(node.writes.map((variable) => groupNameAt(view, named, node.id, variable, "write"))),
    memoryReads: node.memoryReads.map((token) => parseMemoryToken(token, webAt, (name) => variableNames.has(name))),
    memoryWrites: node.memoryWrites.map((token) => parseMemoryToken(token, webAt, (name) => variableNames.has(name))),
  };
}

function firstGroupDef(
  view: WebView,
  named: NamedPartitionRuntime,
  graph: SemanticGraph,
  defNodeId: string,
  variable: string,
  syntheticPositions: Map<string, number>,
): boolean {
  const webId = view.defWebs.get(defNodeId)?.get(variable);
  if (!webId) return false;
  const group = named.groupOfWeb.get(webId);
  if (!group) return false;
  const orderIndex = new Map(graph.nodes.map((node, index) => [node.id, index]));
  let earliest: string | undefined;
  let earliestPosition = Number.MAX_SAFE_INTEGER;
  for (const [candidateWebId, candidateGroup] of named.groupOfWeb) {
    if (candidateGroup !== group) continue;
    const web = view.websById.get(candidateWebId) ?? named.syntheticWebsById?.get(candidateWebId);
    if (!web) return false;
    if (web.parameterEntry) return false;
    const first = web.defNodes[0];
    if (!first || first === "param-entry") return false;
    const position = orderIndex.get(first) ?? syntheticPositions.get(first) ?? Number.MAX_SAFE_INTEGER;
    if (position < earliestPosition) {
      earliestPosition = position;
      earliest = first;
    }
  }
  return earliest === defNodeId;
}

/** Assignment statement materializing one constant site into a temp variable. */
function materializationDef(site: MaterializationSite, matVariable: string, host: SemanticNode): SemanticNode {
  return {
    id: `mat:${site.siteId}`,
    kind: "assign",
    block: host.block,
    span: host.span,
    text: `${matVariable} = ${site.token};`,
    reads: [],
    writes: [matVariable],
    killingWrite: true,
    memoryReads: [],
    memoryWrites: [],
    movable: true,
    operator: "=",
    lhs: matVariable,
    rhs: site.token,
    evidence: [`Materialized constant ${site.token} for ${site.hostNodeId} argument ${site.argIndex} (rule 4.3).`],
  };
}

/** Administrative copy statement of one rule 4.7 site, floated in its region. */
function administrativeCopyDef(site: AdministrativeCopySite, anchor: SemanticNode): SemanticNode {
  return {
    id: `admin:${site.siteId}`,
    kind: "assign",
    block: anchor.block,
    span: anchor.span,
    text: `${site.freshVariable} = ${site.readVariable};`,
    reads: [site.readVariable],
    writes: [site.freshVariable],
    killingWrite: true,
    memoryReads: [],
    memoryWrites: [],
    movable: true,
    operator: "=",
    lhs: site.freshVariable,
    rhs: site.readVariable,
    evidence: [`Administrative copy of ${site.readVariable} for witness ${site.witnessRunId} phantom ${site.templateId} (rule 4.7).`],
  };
}

export function buildDomain(options: {
  graph: SemanticGraph;
  view: WebView;
  derived: DerivedGrammar;
}): DomainRuntime {
  const { graph, view, derived } = options;
  const nodeById = new Map(graph.nodes.map((node) => [node.id, node]));
  const variableNames = new Set(graph.variables.map((variable) => variable.name));
  const orderIndex = new Map(graph.nodes.map((node, index) => [node.id, index]));
  const caveats: string[] = [];

  /* Regions whose statements repeat, so the back edge is a dependence channel. */
  const loopBlocks = new Set(graph.blocks
    .filter((block) => block.kind === "loop-init" || block.kind === "loop-update" || block.kind === "loop-body")
    .map((block) => block.index));
  const enclosingLoopBlock = (index: number): boolean => {
    let current = graph.blocks[index];
    while (current) {
      if (loopBlocks.has(current.index)) return true;
      current = current.parent === undefined ? undefined : graph.blocks[current.parent];
    }
    return false;
  };
  const loopRegions = new Set(derived.regions.filter((region) => enclosingLoopBlock(region.block)).map((region) => region.id));

  /* Split components, expanded spellings, and moved header updates are all
   * mask-independent: the masks only choose between them. */
  const componentsOf = new Map<string, SemanticNode[]>();
  const componentById = new Map<string, SemanticNode>();
  for (const region of derived.regions) {
    for (const id of region.splittable) {
      const components = macroComponents(nodeById.get(id)!, variableNames, derived.registry);
      if (components) {
        componentsOf.set(id, components);
        for (const component of components) componentById.set(component.id, component);
      }
    }
    for (const id of region.movableUpdates) {
      /* A `for` header holds an expression; the body holds a statement. */
      const update = nodeById.get(id)!;
      componentById.set(`${id}::s`, { ...update, id: `${id}::s`, text: `${update.text};` });
    }
  }

  const partitions: PartitionRuntime[] = [];
  let offset = 0n;
  let partitionIndex = 0;
  let entries = 0;

  /* Each switch with an admissible chain form doubles the sections: the two
   * spellings reach the machine by different paths, and nothing else about a
   * section changes with the choice. */
  const switchSelections: string[][] = [];
  for (let mask = 0; mask < (1 << derived.switchForms.length); mask++) {
    switchSelections.push(derived.switchForms.filter((_site, index) => (mask & (1 << index)) !== 0).map((site) => site.nodeId));
  }

  for (const switchForms of switchSelections) {
  for (const materialization of derived.materializations) {
    /* Per-choice synthetic statements: defs, copies, and arg-adjusted hosts. */
    const syntheticNodes = new Map<string, SemanticNode>(componentById);
    const defsByHost = new Map<string, SemanticNode[]>();
    const syntheticPositions = new Map<string, number>();
    const matVariableOfSite = new Map<string, string>();
    materialization.sites.forEach((site, index) => {
      const matVariable = materialization.syntheticWebs[index]!.variable;
      matVariableOfSite.set(site.siteId, matVariable);
      const host = nodeById.get(site.hostNodeId) ?? componentById.get(site.hostNodeId);
      if (!host) throw new Error(`internal: materialization host ${site.hostNodeId} not found`);
      const adjustedBase = syntheticNodes.get(site.hostNodeId) ?? host;
      const adjusted: SemanticNode = {
        ...adjustedBase,
        text: replaceMacroArgument(adjustedBase.text, site.argIndex, matVariable),
        reads: [...new Set([...adjustedBase.reads, matVariable])].sort(),
      };
      syntheticNodes.set(site.hostNodeId, adjusted);
      const def = materializationDef(site, matVariable, host);
      syntheticNodes.set(def.id, def);
      const bucket = defsByHost.get(site.hostNodeId) || [];
      bucket.push(def);
      defsByHost.set(site.hostNodeId, bucket);
      const hostPosition = orderIndex.get(webLookupId(site.hostNodeId)) ?? 0;
      syntheticPositions.set(def.id, hostPosition - 0.5);
    });
    const copyDefsByRegion = new Map<string, SemanticNode[]>();
    for (const site of materialization.copySites) {
      const region = derived.regions.find((item) => item.id === site.regionId)!;
      const anchor = nodeById.get(region.nodeIds[0]!)!;
      const def = administrativeCopyDef(site, anchor);
      syntheticNodes.set(def.id, def);
      syntheticPositions.set(def.id, (orderIndex.get(anchor.id) ?? 0) - 0.25);
      const bucket = copyDefsByRegion.get(site.regionId) || [];
      bucket.push(def);
      copyDefsByRegion.set(site.regionId, bucket);
    }
    const syntheticWebsById = new Map(
      [...materialization.syntheticWebs, ...materialization.copyWebs].map((web) => [web.id, web]));

    for (const named of materialization.partitions) {
      const namedWithSynthetic: NamedPartitionRuntime = { ...named, syntheticWebsById };
      if (materialization.readRedirects.size > 0) namedWithSynthetic.readRedirects = materialization.readRedirects;
      const regions: RegionRuntime[] = [];
      for (const region of derived.regions) {
        const regionSites = materialization.sites.filter((site) => site.regionId === region.id);
        const regionCopies = copyDefsByRegion.get(region.id) ?? [];
        const variants: VariantRuntime[] = [];
        let cumulative = 0n;
        const masks: Array<{ splitMask: number; updateMask: number }> = [];
        for (let splitMask = 0; splitMask < (1 << region.splittable.length); splitMask++) {
          for (let updateMask = 0; updateMask < (1 << region.movableUpdates.length); updateMask++) {
            masks.push({ splitMask, updateMask });
          }
        }
        for (const { splitMask, updateMask } of masks) {
          const effective: SemanticNode[] = [];
          const addedNodes: string[] = [];
          for (const id of region.nodeIds) {
            const splitIndex = region.splittable.indexOf(id);
            if (splitIndex >= 0 && (splitMask & (1 << splitIndex)) !== 0) {
              for (const component of componentsOf.get(id) ?? []) {
                for (const def of defsByHost.get(component.id) ?? []) {
                  effective.push(def);
                  addedNodes.push(def.id);
                }
                effective.push(syntheticNodes.get(component.id) ?? component);
                addedNodes.push(component.id);
              }
            } else {
              for (const def of defsByHost.get(id) ?? []) {
                effective.push(def);
                addedNodes.push(def.id);
              }
              effective.push(syntheticNodes.get(id) ?? nodeById.get(id)!);
            }
          }
          /* A header update selected into the body joins this region's order. */
          region.movableUpdates.forEach((id, index) => {
            if ((updateMask & (1 << index)) === 0) return;
            const moved = syntheticNodes.get(`${id}::s`)!;
            effective.push(moved);
            addedNodes.push(moved.id);
          });
          for (const def of regionCopies) {
            effective.push(def);
            addedNodes.push(def.id);
          }
          /* Every selected site in this region must have its host present. */
          const effectiveIds = new Set(effective.map((node) => node.id));
          if (regionSites.some((site) => !effectiveIds.has(site.hostNodeId))) continue;

          let base: RegionOrderModel;
          try {
            const views = effective.map((node) => regionNodeView(graph, view, namedWithSynthetic, node));
            const edges = regionDependencies(views);
            /* Inside a loop the back edge is a second dependence channel. */
            if (loopRegions.has(region.id)) {
              const carried = loopCarriedDependencies(views, edges);
              for (const edge of carried) {
                edges.push(edge);
                const note = `region ${region.id}: loop-carried ${edge.kind} orders ${edge.from} before ${edge.to} beyond the intra-iteration edges`;
                if (!caveats.includes(note)) caveats.push(note);
              }
            }
            base = RegionOrderModel.fromDependencies(effective.map((node) => node.id), edges);
          } catch (error) {
            const skippable = splitMask !== 0 || updateMask !== 0 ||
              materialization.mask !== 0 || materialization.copySites.length !== 0;
            if (error instanceof RegionTooLargeError && skippable) {
              const dropped = `region ${region.id} mask (${materialization.mask}/${splitMask}) has ${effective.length} statements, beyond the exact bound; its forms are excluded from the serialized domain`;
              if (!caveats.includes(dropped)) caveats.push(dropped);
              continue;
            }
            throw error;
          }
          const positionOf = new Map(effective.map((node, position) => [node.id, position]));
          const eligible = region.birthEligible.filter((id) => {
            const node = nodeById.get(id)!;
            const position = positionOf.get(id);
            if (position === undefined || base.preds[position]! !== 0) return false;
            const group = groupNameAt(view, namedWithSynthetic, id, node.writes[0]!, "write");
            const groupRecord = named.groups.find((item) => item.name === group);
            if (!groupRecord || groupRecord.parameterName !== undefined) return false;
            return firstGroupDef(view, namedWithSynthetic, graph, id, node.writes[0]!, syntheticPositions);
          });
          const eligibleSet = new Set(eligible);
          for (let birthMask = 0; birthMask < (1 << region.birthEligible.length); birthMask++) {
            const removedNodes: string[] = [];
            let admissible = true;
            let removeMask = 0;
            for (let bit = 0; bit < region.birthEligible.length; bit++) {
              if ((birthMask & (1 << bit)) === 0) continue;
              const id = region.birthEligible[bit]!;
              if (!eligibleSet.has(id)) {
                admissible = false;
                break;
              }
              removeMask |= 1 << positionOf.get(id)!;
              removedNodes.push(id);
            }
            if (!admissible) continue;
            const projected = base.withRemoved(removeMask);
            const keptIds = projected.kept.map((position) => effective[position]!.id);
            const count = projected.model.count();
            variants.push({ splitMask, updateMask, birthMask, keptIds, removedNodes, addedNodes, model: projected.model, count, cumulative });
            cumulative += count;
            if (++entries > MAX_DOMAIN_ENTRIES) throw new DomainTooLargeError(MAX_DOMAIN_ENTRIES);
          }
        }
        regions.push({ region, nodeIds: region.nodeIds, birthEligible: region.birthEligible, variants, size: cumulative });
      }
      const size = regions.reduce((product, region) => product * region.size, 1n);
      partitions.push({
        index: partitionIndex++,
        named: namedWithSynthetic,
        materializedSites: materialization.sites.map((site) => site.siteId),
        switchForms,
        administrativeCopies: materialization.copySites.map((site) => site.siteId),
        regions,
        syntheticNodes,
        size,
        offset,
      });
      offset += size;
    }
  }
  }

  const domain: ResidualDomain = {
    schemaVersion: RESIDUAL_SEARCH_SCHEMA_VERSION,
    function: graph.function,
    partitionCount: partitions.length,
    partitionEnumerationComplete: derived.partitionComplete,
    partitions: partitions.map((partition): PartitionDomain => ({
      partitionIndex: partition.index,
      materializedSites: partition.materializedSites,
      ...(partition.switchForms.length > 0 ? { switchForms: partition.switchForms } : {}),
      ...(partition.administrativeCopies.length > 0 ? { administrativeCopies: partition.administrativeCopies } : {}),
      partition: {
        rgs: partition.named.rgs,
        groups: partition.named.groups,
        baseline: partition.named.baseline,
      },
      regions: partition.regions.map((region) => ({
        regionId: region.region.id,
        variants: region.variants.map((variant) => ({
          splitMask: variant.splitMask,
          updateMask: variant.updateMask,
          birthMask: variant.birthMask,
          removedNodes: variant.removedNodes,
          addedNodes: variant.addedNodes,
          orderCount: variant.count.toString(),
        })),
        size: region.size.toString(),
      })),
      size: partition.size.toString(),
    })),
    totalCandidates: offset.toString(),
    coordinateSchema: "globalRank = sectionOffset + mixedRadix(regions, digit = variantCumulative + orderRank); sections ordered by (switchFormMask, administrativeSelection, materializationMask, partition), variants by (splitMask, updateMask, birthMask)",
    caveats: [...(derived.tooLarge ? [derived.tooLarge] : []), ...caveats],
  };

  return {
    partitions,
    total: offset,
    domain,
    switchFormSites: new Map(derived.switchForms.map((site) => [site.nodeId, site])),
    caveats,
  };
}

export interface CandidatePlan {
  globalRank: bigint;
  coordinate: Coordinate;
  partition: PartitionRuntime;
  regionOrders: Map<string, string[]>;
  birthNodes: Set<string>;
  /** regionId -> header update node ids this coordinate moved into the body. */
  movedUpdates: Map<string, string[]>;
  /** Switch node id -> its chain form, for the switches this coordinate spells that way. */
  switchForms: Map<string, SwitchFormSite>;
  syntheticNodes: Map<string, SemanticNode>;
}

export function candidateAt(domain: DomainRuntime, globalRank: bigint): CandidatePlan {
  if (globalRank < 0n || globalRank >= domain.total) {
    throw new Error(`global rank ${globalRank} is outside the domain of ${domain.total}`);
  }
  let partition: PartitionRuntime | undefined;
  for (const entry of domain.partitions) {
    if (globalRank < entry.offset + entry.size) {
      partition = entry;
      break;
    }
  }
  if (!partition) throw new Error("internal: no partition covers the requested rank");
  let local = globalRank - partition.offset;

  const digits = new Array<bigint>(partition.regions.length).fill(0n);
  for (let index = partition.regions.length - 1; index >= 0; index--) {
    const size = partition.regions[index]!.size;
    digits[index] = local % size;
    local /= size;
  }

  const regionOrders = new Map<string, string[]>();
  const birthNodes = new Set<string>();
  const movedUpdates = new Map<string, string[]>();
  const regionChoices: Coordinate["regionChoices"] = [];
  for (let index = 0; index < partition.regions.length; index++) {
    const region = partition.regions[index]!;
    const digit = digits[index]!;
    let variant: VariantRuntime | undefined;
    for (let position = region.variants.length - 1; position >= 0; position--) {
      if (digit >= region.variants[position]!.cumulative) {
        variant = region.variants[position]!;
        break;
      }
    }
    if (!variant) throw new Error("internal: no region variant covers the digit");
    const orderRank = digit - variant.cumulative;
    const order = variant.model.unrank(orderRank);
    regionOrders.set(region.region.id, order.map((compressed) => variant!.keptIds[compressed]!));
    for (const removed of variant.removedNodes) birthNodes.add(removed);
    regionChoices.push({
      splitMask: variant.splitMask,
      updateMask: variant.updateMask,
      birthMask: variant.birthMask,
      orderRank: orderRank.toString(),
    });
    const moved = region.region.movableUpdates.filter((_id, index) => (variant.updateMask & (1 << index)) !== 0);
    if (moved.length > 0) movedUpdates.set(region.region.id, moved);
  }

  const coordinate: Coordinate = {
    partitionIndex: partition.index,
    materializedSites: partition.materializedSites,
    ...(partition.switchForms.length > 0 ? { switchForms: partition.switchForms } : {}),
    regionChoices,
  };
  if (partition.administrativeCopies.length > 0) coordinate.administrativeCopies = partition.administrativeCopies;
  return {
    globalRank,
    coordinate,
    partition,
    regionOrders,
    birthNodes,
    movedUpdates,
    switchForms: domain.switchFormSites,
    syntheticNodes: partition.syntheticNodes,
  };
}

export interface ShardSpec {
  index: number;
  count: number;
}

/** Number of candidates in shard `index` (1-based residue class rank % count == index-1). */
export function shardSize(total: bigint, shard: ShardSpec): bigint {
  const count = BigInt(shard.count);
  const residue = BigInt(shard.index - 1);
  if (total <= residue) return 0n;
  return (total - residue - 1n) / count + 1n;
}

/** The shard-local index'th global rank of a shard. */
export function shardRank(shard: ShardSpec, shardLocalIndex: bigint): bigint {
  return shardLocalIndex * BigInt(shard.count) + BigInt(shard.index - 1);
}
