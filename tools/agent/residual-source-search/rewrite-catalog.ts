import { splitComponents, type MacroRegistry } from "./macro-forms.js";
import { buildFlow, classifySyntheticStatement, splitTopLevel, stripComments } from "./semantic-graph.js";
import { memoryEffectsConflict, parseMemoryToken, MAX_REGION_NODES } from "./topological-orders.js";
import { baselinePartition, enumeratePartitions, nameGroups, websCompatible, type WebView } from "./web-partitions.js";
import type { DiscoveredWitness } from "./witness.js";
import {
  RESIDUAL_GRAMMAR_SCHEMA_VERSION,
  RESIDUAL_SEARCH_SCHEMA_VERSION,
  type AdministrativeCopySite,
  type CausalClosure,
  type MaterializationSite,
  type OrderRegion,
  type ResidualGrammar,
  type SemanticGraph,
  type SemanticNode,
  type SuppressedRule,
  type ValueWeb,
  type WebGroup,
} from "./types.js";

export interface NamedPartitionRuntime {
  rgs: number[];
  baseline: boolean;
  groups: WebGroup[];
  /** webId -> rendered group name for every web (partitioned and frozen). */
  groupOfWeb: Map<string, string>;
  /** Synthetic materialization and copy webs of the active choice, by web id. */
  syntheticWebsById?: Map<string, ValueWeb>;
  /** nodeId -> variable -> copy web id for reads redirected past a rule 4.7 copy. */
  readRedirects?: Map<string, Map<string, string>>;
}

export interface MaterializationChoice {
  mask: number;
  sites: MaterializationSite[];
  syntheticWebs: ValueWeb[];
  /** Rule 4.7 copy sites active in this choice: at most one per witness phantom. */
  copySites: AdministrativeCopySite[];
  /** Synthetic webs of the active copies, parallel to copySites. */
  copyWebs: ValueWeb[];
  /** nodeId -> variable -> copy web id for reads redirected past a copy. */
  readRedirects: Map<string, Map<string, string>>;
  partitions: NamedPartitionRuntime[];
}

export interface DerivedGrammar {
  grammar: ResidualGrammar;
  partitionWebs: ValueWeb[];
  partitions: NamedPartitionRuntime[];
  regions: OrderRegion[];
  /** All rule 4.3 sites in canonical order; mask bit k selects sites[k]. */
  sites: MaterializationSite[];
  /** One entry per materialization mask, ascending; mask 0 is first. */
  materializations: MaterializationChoice[];
  partitionComplete: boolean;
  registry: MacroRegistry;
  /** Set when the exact engine cannot bound the domain; run must end domain-too-large. */
  tooLarge?: string;
}

export const GRAMMAR_ASSUMPTIONS = [
  "Distinct declared objects and distinct named fields of one object are assumed non-overlapping; programs relying on such aliasing are outside this grammar's equivalence guarantee.",
  "Pointer parameters are assumed not to alias named globals unless a shared identifier appears in both access paths.",
  "The input source is the accepted semantic anchor; no candidate may change observable behavior under these assumptions.",
  "No local variable is read before its first definition on any executed path.",
  "Declaration order, variable names, whitespace, and comments are canonicalized rather than searched.",
];

const SUPPRESSED_BASE: SuppressedRule[] = [
  {
    rule: "expression-materialization",
    reason: "schema 4 materializes only literal known-macro constant arguments whose values appear in mismatched target instructions; general pure-expression, common-subexpression, and result-reuse forms remain excluded",
    evidence: [],
  },
  {
    rule: "type-cast-representation",
    reason: "not implemented in grammar schema 4; fresh materialized temps use one canonical type and local type/cast forms are not searched",
    evidence: [],
  },
];

const MAX_MATERIALIZATION_SITES = 6;
const MAX_ADMIN_REGIONS_PER_PHANTOM = 4;

function canonicalFreshType(value: number): string {
  if (value >= 0 && value <= 255) return "u8";
  if (value >= 0 && value <= 65535) return "u16";
  return "u32";
}

/** Literal constant arguments of a known-macro node whose values the residual diff names. */
function constantArgSites(
  node: SemanticNode,
  regionId: string,
  immediates: Set<number>,
): MaterializationSite[] {
  if (node.kind !== "known-macro") return [];
  const call = stripComments(node.text).trim().match(/^[A-Za-z_]\w*\s*\(([\s\S]*)\)\s*;$/);
  if (!call) return [];
  const argTexts = splitTopLevel(call[1]!).map((argument) => argument.trim());
  const sites: MaterializationSite[] = [];
  argTexts.forEach((argument, argIndex) => {
    if (!/^(?:0x[0-9a-fA-F]+|\d+)$/.test(argument)) return;
    const value = Number(argument);
    if (!Number.isFinite(value) || value === 0 || !immediates.has(value)) return;
    sites.push({
      siteId: `${node.id}#a${argIndex}`,
      hostNodeId: node.id,
      argIndex,
      value,
      token: argument,
      regionId,
      freshType: canonicalFreshType(value),
    });
  });
  return sites;
}

/** Rebuild a macro-call statement with one argument replaced. */
export function replaceMacroArgument(text: string, argIndex: number, replacement: string): string {
  const stripped = stripComments(text).trim();
  const match = stripped.match(/^([A-Za-z_]\w*\s*\()([\s\S]*)(\)\s*;)$/);
  if (!match) throw new Error(`internal: cannot rewrite macro call ${text}`);
  const argTexts = splitTopLevel(match[2]!);
  if (argIndex >= argTexts.length) throw new Error(`internal: macro call has no argument ${argIndex}`);
  const leading = argTexts[argIndex]!.match(/^\s*/)?.[0] ?? "";
  argTexts[argIndex] = `${leading}${replacement}`;
  return `${match[1]}${argTexts.join(",")}${match[3]}`;
}

const MAX_SPLITTABLE_PER_REGION = 6;

/**
 * Component statements for a splittable composite macro node, or undefined.
 * Everything is derived from the verified definition text: the body must be a
 * comma list of registered component calls over the composite's own pure
 * arguments and literal constants, and every synthesized component statement
 * must itself classify as a movable known-macro node.
 */
export function macroComponents(
  node: SemanticNode,
  variables: Set<string>,
  registry: MacroRegistry,
): SemanticNode[] | undefined {
  if (node.kind !== "known-macro" || !node.macro) return undefined;
  const macro = registry.active.get(node.macro);
  if (!macro) return undefined;
  const call = stripComments(node.text).trim().match(/^[A-Za-z_]\w*\s*\(([\s\S]*)\)\s*;$/);
  if (!call) return undefined;
  const argTexts = splitTopLevel(call[1]!).map((argument) => argument.trim()).filter((argument) => argument.length > 0);
  const components = splitComponents(macro, argTexts, registry);
  if (!components) return undefined;
  const nodes: SemanticNode[] = [];
  for (let index = 0; index < components.length; index++) {
    const synthesized = classifySyntheticStatement(components[index]!.statement, variables, registry);
    if (synthesized.kind !== "known-macro" || !synthesized.movable) return undefined;
    nodes.push({
      ...synthesized,
      id: `${node.id}::c${index}`,
      block: node.block,
      span: node.span,
      evidence: [
        `Component ${index} of ${node.macro} from its verified ${macro.header} definition.`,
        ...synthesized.evidence,
      ],
    });
  }
  return nodes;
}

export interface DeriveGrammarOptions {
  graph: SemanticGraph;
  view: WebView;
  closure: CausalClosure;
  source: string;
  registry: MacroRegistry;
  /** Immediate values of mismatched target instructions; seeds rule 4.3 sites. */
  mismatchImmediates?: number[];
  /** Discovered SAT scheduler-constraint witness; activates rule 4.7 sites. */
  witness?: DiscoveredWitness;
  partitionCap?: number;
  maxBirthPerRegion?: number;
}

export function deriveGrammar(options: DeriveGrammarOptions): DerivedGrammar {
  const { graph, view, closure, source } = options;
  const flow = buildFlow(graph);
  const orderIndex = new Map(flow.order.map((id, index) => [id, index]));
  const nodeById = new Map(graph.nodes.map((node) => [node.id, node]));
  const closureNodes = new Set(closure.nodeIds);
  const closureWebs = new Set(closure.webIds);
  const caveats: string[] = [];
  let tooLarge: string | undefined;

  /* ---------------------------------------------------------------- */
  /* Partitioned webs: whole variables whose webs the closure touches. */
  /* ---------------------------------------------------------------- */

  const variableById = new Map(graph.variables.map((variable) => [variable.name, variable]));
  const websByVariable = new Map<string, ValueWeb[]>();
  for (const web of view.webs) {
    const bucket = websByVariable.get(web.variable) || [];
    bucket.push(web);
    websByVariable.set(web.variable, bucket);
  }

  const partitionVariables = new Set<string>();
  for (const [variable, webs] of websByVariable) {
    if (!webs.some((web) => closureWebs.has(web.id))) continue;
    const info = variableById.get(variable);
    if (!info || !info.supported || info.addressEscapes || !info.typeText) continue;
    if (info.kind === "local") {
      const declaration = info.declarationId ? nodeById.get(info.declarationId) : undefined;
      if (!declaration || declaration.block !== 0) {
        caveats.push(`${variable} is declared outside the entry block; its webs stay frozen.`);
        continue;
      }
      if (declaration.initializer !== undefined) {
        caveats.push(`${variable} is declared with an initializer; grammar schema 1 freezes its webs.`);
        continue;
      }
    }
    if (!webs.every((web) => web.renameable || web.parameterEntry)) continue;
    partitionVariables.add(variable);
  }

  const defPosition = (web: ValueWeb): number => {
    if (web.parameterEntry) {
      const parameter = graph.parameters.find((item) => item.name === web.variable);
      return -100 + (parameter?.index ?? 0);
    }
    return orderIndex.get(web.defNodes[0]!) ?? Number.MAX_SAFE_INTEGER;
  };
  const partitionWebs = view.webs
    .filter((web) => partitionVariables.has(web.variable))
    .sort((left, right) => defPosition(left) - defPosition(right) || left.id.localeCompare(right.id));

  /* Reserved names: everything that is not a local variable of this function,
     plus the names of variables whose webs are frozen. */
  const variableNames = new Set(graph.variables.map((variable) => variable.name));
  const reserved = new Set<string>([graph.function]);
  for (const match of stripComments(source).matchAll(/\b[A-Za-z_]\w*\b/g)) {
    if (!variableNames.has(match[0]!)) reserved.add(match[0]!);
  }
  for (const variable of graph.variables) {
    if (!partitionVariables.has(variable.name)) reserved.add(variable.name);
  }
  for (const parameter of graph.parameters) reserved.add(parameter.name);

  const frozenGroupOf = new Map<string, string>();
  for (const web of view.webs) {
    if (!partitionVariables.has(web.variable)) frozenGroupOf.set(web.id, web.variable);
  }

  /* Enumerate and canonically name every admissible partition of one web set.
     Reused per materialization mask; the baseline grouping is always first
     (constructed directly, so cap truncation can never lose it). */
  let droppedNaming = 0;
  const namePartitionSet = (webs: ValueWeb[]): NamedPartitionRuntime[] => {
    const enumeration = enumeratePartitions(webs, websCompatible, options.partitionCap ?? 20000);
    if (!enumeration.complete) {
      tooLarge = `admissible web partitions exceed the materialization cap (${options.partitionCap ?? 20000}); shard planning requires an explicit larger cap`;
    }
    /* Baseline always renders with the original (or canonical fresh) names. */
    const baselineRgs = baselinePartition(webs);
    const byVariable = new Map<string, WebGroup>();
    for (const web of webs) {
      let group = byVariable.get(web.variable);
      if (!group) {
        group = { name: web.variable, webIds: [], typeText: web.typeText };
        if (web.parameterEntry || graph.parameters.some((parameter) => parameter.name === web.variable)) {
          group.parameterName = web.variable;
        }
        byVariable.set(web.variable, group);
      }
      group.webIds.push(web.id);
    }
    const baselineGroups = [...byVariable.values()];
    const baselineGroupOfWeb = new Map(frozenGroupOf);
    for (const group of baselineGroups) {
      for (const webId of group.webIds) baselineGroupOfWeb.set(webId, group.name);
    }
    const result: NamedPartitionRuntime[] = [{
      rgs: baselineRgs,
      baseline: true,
      groups: baselineGroups,
      groupOfWeb: baselineGroupOfWeb,
    }];
    const baselineKey = baselineRgs.join(",");
    for (const partition of enumeration.partitions) {
      if (partition.rgs.join(",") === baselineKey) continue;
      const groups = nameGroups(partition.rgs, webs, reserved);
      if (!groups) {
        droppedNaming++;
        continue;
      }
      const groupOfWeb = new Map(frozenGroupOf);
      for (const group of groups) {
        for (const webId of group.webIds) groupOfWeb.set(webId, group.name);
      }
      result.push({
        rgs: partition.rgs,
        baseline: false,
        groups,
        groupOfWeb,
      });
    }
    return result;
  };

  const partitions = namePartitionSet(partitionWebs);

  /* ---------------------------------------------------------------- */
  /* Order regions: maximal runs of movable closure statements.        */
  /* ---------------------------------------------------------------- */

  const regions: OrderRegion[] = [];
  const frozenNodeIds = new Set(graph.nodes.map((node) => node.id));
  for (const block of graph.blocks) {
    let run: string[] = [];
    let regionIndex = 0;
    const flush = (): void => {
      if (run.length >= 1) {
        regions.push({ id: `r${block.index}-${regionIndex++}`, block: block.index, nodeIds: run, birthEligible: [], splittable: [], materializable: [] });
      }
      run = [];
    };
    for (let position = 0; position < block.nodeIds.length; position++) {
      const id = block.nodeIds[position]!;
      const node = nodeById.get(id)!;
      const reorderable = node.movable && closureNodes.has(id) &&
        (node.kind === "assign" || node.kind === "store" || node.kind === "known-macro");
      if (!reorderable) {
        flush();
        continue;
      }
      if (run.length > 0) {
        const previous = nodeById.get(run[run.length - 1]!)!;
        const between = source.slice(previous.span.end, node.span.start);
        if (/\/\*|\/\//.test(between)) {
          caveats.push(`Comment between statements ends region before ${id}; comments are never reordered.`);
          flush();
        }
      }
      run.push(id);
    }
    flush();
  }
  const keptRegions = regions.filter((region) => region.nodeIds.length >= 2 || regionHasBirthCandidate(region, options));
  for (const region of keptRegions) {
    for (const id of region.nodeIds) frozenNodeIds.delete(id);
    if (region.nodeIds.length > MAX_REGION_NODES) {
      tooLarge = `region ${region.id} has ${region.nodeIds.length} reorderable statements, beyond the exact-counting bound of ${MAX_REGION_NODES}`;
    }
  }

  /* Partition-independent birth pre-candidates and splittable composite macros. */
  const variableNamesForSplit = new Set(graph.variables.map((variable) => variable.name));
  for (const region of keptRegions) {
    region.birthEligible = region.nodeIds.filter((id) => isBirthPreCandidate(id, options));
    const cap = options.maxBirthPerRegion ?? 8;
    if (region.birthEligible.length > cap) {
      caveats.push(`Region ${region.id} has ${region.birthEligible.length} birth candidates; only the first ${cap} are enumerated and the domain is reported incomplete.`);
      region.birthEligible = region.birthEligible.slice(0, cap);
    }
    region.splittable = region.nodeIds.filter((id) =>
      macroComponents(nodeById.get(id)!, variableNamesForSplit, options.registry) !== undefined);
    if (region.splittable.length > MAX_SPLITTABLE_PER_REGION) {
      caveats.push(`Region ${region.id} has ${region.splittable.length} splittable macros; only the first ${MAX_SPLITTABLE_PER_REGION} are enumerated and the domain is reported incomplete.`);
      region.splittable = region.splittable.slice(0, MAX_SPLITTABLE_PER_REGION);
    }
  }

  /* Rule 4.3 sites: literal known-macro constant arguments (on region nodes
     and on split components) whose values the residual diff names. */
  const immediates = new Set((options.mismatchImmediates ?? []).filter((value) => value !== 0));
  let totalSites = 0;
  for (const region of keptRegions) {
    const sites: MaterializationSite[] = [];
    for (const id of region.nodeIds) {
      const node = nodeById.get(id)!;
      sites.push(...constantArgSites(node, region.id, immediates));
      if (region.splittable.includes(id)) {
        const components = macroComponents(node, variableNamesForSplit, options.registry) ?? [];
        for (const component of components) sites.push(...constantArgSites(component, region.id, immediates));
      }
    }
    region.materializable = sites;
    totalSites += sites.length;
  }
  if (totalSites > MAX_MATERIALIZATION_SITES) {
    let kept = 0;
    for (const region of keptRegions) {
      region.materializable = region.materializable.filter(() => kept++ < MAX_MATERIALIZATION_SITES);
    }
    caveats.push(`${totalSites} materialization sites were found; only the first ${MAX_MATERIALIZATION_SITES} are enumerated and the domain is reported incomplete.`);
  }

  /* ---------------------------------------------------------------- */
  /* Rule 4.7: administrative copy sites from a SAT witness.            */
  /* ---------------------------------------------------------------- */

  const witness = options.witness;
  const adminRefusals: string[] = [];
  const phantomSiteGroups: AdministrativeCopySite[][] = [];
  if (witness) {
    caveats.push(...witness.caveats);
    let phantomIndex = 0;
    for (const phantom of witness.phantoms) {
      if (phantom.refusal !== undefined || phantom.abiParameterIndex === undefined) {
        adminRefusals.push(`phantom ${phantom.templateId}: ${phantom.refusal ?? "no binding channel applied"}`);
        continue;
      }
      const parameter = graph.parameters[phantom.abiParameterIndex];
      if (!parameter) {
        adminRefusals.push(`phantom ${phantom.templateId}: the function has no parameter ${phantom.abiParameterIndex}`);
        continue;
      }
      const info = variableById.get(parameter.name);
      if (!info || !info.supported || info.addressEscapes || !info.typeText) {
        adminRefusals.push(`phantom ${phantom.templateId}: parameter ${parameter.name} is frozen (unsupported access, escaping address, or unknown type)`);
        continue;
      }
      const parameterWebs = websByVariable.get(parameter.name) ?? [];
      if (parameterWebs.length !== 1 || !parameterWebs[0]!.parameterEntry) {
        adminRefusals.push(`phantom ${phantom.templateId}: parameter ${parameter.name} is redefined, so a single copy point cannot cover its reads`);
        continue;
      }
      const web = parameterWebs[0]!;
      let freshVariable = `admin_${phantomIndex}`;
      while (reserved.has(freshVariable)) freshVariable = `${freshVariable}_`;
      const group: AdministrativeCopySite[] = [];
      for (const region of keptRegions) {
        if (region.block !== 0) continue;
        if (region.nodeIds.length + 1 > MAX_REGION_NODES) {
          caveats.push(`Region ${region.id} cannot host the ${phantom.templateId} copy within the exact-counting bound of ${MAX_REGION_NODES}.`);
          continue;
        }
        const touches = region.nodeIds.some((id) => {
          const node = nodeById.get(id)!;
          return node.reads.includes(parameter.name) || node.writes.includes(parameter.name);
        });
        if (touches) continue;
        const lastPosition = orderIndex.get(region.nodeIds[region.nodeIds.length - 1]!) ?? -1;
        const redirected = web.useNodes.filter((id) => (orderIndex.get(id) ?? -1) > lastPosition);
        if (redirected.length === 0) continue;
        const unrenameable = redirected.filter((id) => {
          const kind = nodeById.get(id)!.kind;
          return kind !== "assign" && kind !== "store" && kind !== "known-macro" && kind !== "if" && kind !== "return";
        });
        if (unrenameable.length > 0) {
          adminRefusals.push(`phantom ${phantom.templateId}: read(s) of ${parameter.name} at ${unrenameable.join(", ")} cannot be redirected (frozen construct)`);
          continue;
        }
        group.push({
          siteId: `${phantom.templateId}@${region.id}`,
          witnessRunId: witness.runId,
          templateId: phantom.templateId,
          readVariable: parameter.name,
          readWebId: web.id,
          freshVariable,
          freshType: info.typeText.replace(/\s+/g, " "),
          pointer: info.pointer,
          regionId: region.id,
          redirectedReadNodes: redirected,
          evidence: [
            ...phantom.evidence,
            `Region ${region.id} contains no access to ${parameter.name}; ${redirected.length} later read(s) redirect to the copy.`,
          ],
        });
      }
      if (group.length === 0) {
        adminRefusals.push(`phantom ${phantom.templateId}: no admissible copy region in the entry block`);
        continue;
      }
      if (group.length > MAX_ADMIN_REGIONS_PER_PHANTOM) {
        caveats.push(`Phantom ${phantom.templateId} has ${group.length} admissible regions; only the first ${MAX_ADMIN_REGIONS_PER_PHANTOM} are enumerated and the domain is reported incomplete.`);
        group.length = MAX_ADMIN_REGIONS_PER_PHANTOM;
      }
      phantomSiteGroups.push(group);
      phantomIndex++;
    }
  }
  const adminSites = phantomSiteGroups.flat();

  /* Copy selections: at most one region per phantom; no copies is first. */
  let adminSelections: AdministrativeCopySite[][] = [[]];
  for (const group of phantomSiteGroups) {
    const next: AdministrativeCopySite[][] = [];
    for (const selection of adminSelections) {
      next.push(selection);
      for (const site of group) next.push([...selection, site]);
    }
    adminSelections = next;
  }

  const nodesFromPosition = (regionId: string): string[] => {
    const region = keptRegions.find((item) => item.id === regionId)!;
    const start = orderIndex.get(region.nodeIds[0]!) ?? 0;
    return flow.order.filter((id) => (orderIndex.get(id) ?? -1) >= start);
  };

  /* Rules 4.3 + 4.7: one web universe and partition list per synthetic choice. */
  const sites = keptRegions.flatMap((region) => region.materializable);
  const regionById = new Map(keptRegions.map((region) => [region.id, region]));
  const materializations: MaterializationChoice[] = [];
  for (const adminSelection of adminSelections) {
    const copyWebs: ValueWeb[] = adminSelection.map((site) => ({
      id: `${site.freshVariable}#0`,
      variable: site.freshVariable,
      webIndex: 0,
      defNodes: [`admin:${site.siteId}`],
      useNodes: [...site.redirectedReadNodes],
      typeText: site.freshType,
      pointer: site.pointer,
      parameterEntry: false,
      liveAtNodes: nodesFromPosition(site.regionId),
      renameable: true,
      syntheticCopyOf: site.readWebId,
      evidence: [
        `Administrative copy of ${site.readVariable} demanded by witness ${site.witnessRunId} phantom ${site.templateId} (rule 4.7).`,
        `Conservative live range spans from region ${site.regionId} to the end of the function.`,
      ],
    }));
    const readRedirects = new Map<string, Map<string, string>>();
    adminSelection.forEach((site, index) => {
      for (const nodeId of site.redirectedReadNodes) {
        let bucket = readRedirects.get(nodeId);
        if (!bucket) {
          bucket = new Map();
          readRedirects.set(nodeId, bucket);
        }
        bucket.set(site.readVariable, copyWebs[index]!.id);
      }
    });
    for (let mask = 0; mask < (1 << sites.length); mask++) {
      const syntheticWebs: ValueWeb[] = [];
      const selected: MaterializationSite[] = [];
      for (let bit = 0; bit < sites.length; bit++) {
        if ((mask & (1 << bit)) === 0) continue;
        const site = sites[bit]!;
        selected.push(site);
        let name = `mat_${bit}`;
        while (reserved.has(name)) name = `${name}_`;
        syntheticWebs.push({
          id: `${name}#0`,
          variable: name,
          webIndex: 0,
          defNodes: [`mat:${site.siteId}`],
          useNodes: [site.hostNodeId],
          typeText: site.freshType,
          pointer: false,
          parameterEntry: false,
          liveAtNodes: [...regionById.get(site.regionId)!.nodeIds],
          renameable: true,
          syntheticConstant: site.value,
          evidence: [
            `Materializes literal ${site.token} of ${site.hostNodeId} argument ${site.argIndex} (rule 4.3).`,
            `Conservative live range spans region ${site.regionId}; merges require disjoint liveness and a representable type.`,
          ],
        });
      }
      materializations.push({
        mask,
        sites: selected,
        syntheticWebs,
        copySites: adminSelection,
        copyWebs,
        readRedirects,
        partitions: mask === 0 && adminSelection.length === 0
          ? partitions
          : namePartitionSet([...partitionWebs, ...syntheticWebs, ...copyWebs]),
      });
    }
  }
  if (droppedNaming > 0) caveats.push(`${droppedNaming} admissible partition(s) were dropped because no collision-free canonical naming exists.`);

  const suppressedRules = SUPPRESSED_BASE.map((rule) => ({ ...rule }));
  if (adminSites.length === 0) {
    suppressedRules.push({
      rule: "administrative-form",
      reason: witness === undefined
        ? "no SAT scheduler-constraint witness with phantom requirements exists for this function; rule 4.7 activates only on machine-derived compiler-state evidence"
        : `witness ${witness.runId} names phantom requirement(s) but none bind to an admissible copy site`,
      evidence: adminRefusals,
    });
  } else if (adminRefusals.length > 0) {
    caveats.push(`Rule 4.7 is active but ${adminRefusals.length} phantom binding(s) were refused: ${adminRefusals.join("; ")}`);
  }

  const grammar: ResidualGrammar = {
    schemaVersion: RESIDUAL_SEARCH_SCHEMA_VERSION,
    grammarSchemaVersion: RESIDUAL_GRAMMAR_SCHEMA_VERSION,
    function: graph.function,
    activeRules: [
      "web-partition", "statement-order", "declaration-birth", "known-macro-form", "expression-materialization",
      ...(adminSites.length > 0 ? ["administrative-form" as const] : []),
    ],
    suppressedRules,
    assumptions: [...GRAMMAR_ASSUMPTIONS],
    webs: view.webs,
    partitionWebIds: partitionWebs.map((web) => web.id),
    regions: keptRegions,
    frozenNodeIds: [...frozenNodeIds].sort((left, right) => (orderIndex.get(left) ?? 0) - (orderIndex.get(right) ?? 0)),
    caveats,
  };
  if (adminSites.length > 0) grammar.administrativeSites = adminSites;
  if (witness) {
    grammar.witness = {
      runId: witness.runId,
      directory: witness.directory,
      boundPhantoms: phantomSiteGroups.length,
      unboundPhantoms: witness.phantoms.length - phantomSiteGroups.length,
      sourceRequirements: witness.sourceRequirements,
    };
  }

  const result: DerivedGrammar = {
    grammar,
    partitionWebs,
    partitions,
    regions: keptRegions,
    sites,
    materializations,
    partitionComplete: tooLarge === undefined,
    registry: options.registry,
  };
  if (tooLarge) result.tooLarge = tooLarge;
  return result;
}

function regionHasBirthCandidate(region: OrderRegion, options: DeriveGrammarOptions): boolean {
  return region.nodeIds.some((id) => isBirthPreCandidate(id, options));
}

/**
 * Partition-independent declaration-birth admissibility (rule 4.5): a killing
 * entry-block scalar assignment whose pure right-hand side reads only
 * untouched parameter-entry values and whose memory reads cannot be disturbed
 * by any earlier effect. The per-partition first-definition and dependency
 * checks happen during domain construction.
 */
export function isBirthPreCandidate(nodeId: string, options: DeriveGrammarOptions): boolean {
  const { graph, view } = options;
  const node = graph.nodes.find((item) => item.id === nodeId);
  if (!node || node.kind !== "assign" || !node.killingWrite || !node.movable || node.block !== 0) return false;
  if (node.rhs === undefined || node.lhs === undefined) return false;
  const reaching = view.reaching.get(nodeId);
  for (const read of node.reads) {
    const webId = reaching?.get(read);
    const web = webId ? view.websById.get(webId) : undefined;
    if (!web || !web.parameterEntry) return false;
  }
  const defWeb = view.defWebs.get(nodeId)?.get(node.writes[0]!);
  if (!defWeb) return false;
  const web = view.websById.get(defWeb)!;
  if (web.defNodes[0] !== nodeId) return false;
  if (node.memoryReads.length > 0) {
    const flow = buildFlow(graph);
    const position = flow.order.indexOf(nodeId);
    const variableNames = new Set(graph.variables.map((variable) => variable.name));
    const webAt = (target: string) => (variable: string) =>
      view.reaching.get(target)?.get(variable) ?? view.defWebs.get(target)?.get(variable);
    const ownReads = node.memoryReads.map((token) => parseMemoryToken(token, webAt(nodeId), (name) => variableNames.has(name)));
    for (let index = 0; index < position; index++) {
      const earlier = graph.nodes.find((item) => item.id === flow.order[index]!)!;
      const writes = earlier.memoryWrites.map((token) => parseMemoryToken(token, webAt(earlier.id), (name) => variableNames.has(name)));
      if (writes.some((write) => ownReads.some((read) => memoryEffectsConflict(write, read)))) return false;
    }
  }
  return true;
}
