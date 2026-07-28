import type { TargetScheduleAnalysis } from "../target-schedule/types.js";
import { sha256, stableJson } from "../variant-lab/artifacts.js";
import type { ExactSourceEdit } from "../variant-lab/types.js";
import { classifyStatement } from "./source-model.js";
import {
  SOURCE_SHAPE_SYNTHESIS_SCHEMA_VERSION,
  type DeriveOptions,
  type SourceDeclaration,
  type SourceModel,
  type SourceRoleBinding,
  type SourceStatement,
  type SynthesizedAlternative,
  type SynthesisPlan,
  type SynthesisRecipe,
} from "./types.js";

interface ShapeNode {
  id: string;
  text: string;
  reads: string[];
  writes: string[];
  memoryReads: string[];
  memoryWrites: string[];
  originalOrder: number;
  targetRank: number;
  statementIds: string[];
}

interface ShapeConfiguration {
  id: string;
  nodes: ShapeNode[];
  declarations: string[];
  extraEdits: ExactSourceEdit[];
  recipeIds: string[];
  evidence: string[];
}

function immediateValues(text: string): number[] {
  return [...text.matchAll(/\b0x[0-9a-f]+\b|\b\d+\b/gi)].map((match) => Number(match[0]));
}

function mismatchIndexes(analysis: TargetScheduleAnalysis): number[] {
  const count = Math.max(analysis.target.length, analysis.candidate.length);
  return Array.from({ length: count }, (_unused, index) => index)
    .filter((index) => analysis.target[index]?.canonical !== analysis.candidate[index]?.canonical);
}

function targetIndexesForStatement(statement: SourceStatement, analysis: TargetScheduleAnalysis): number[] {
  const mismatches = new Set(mismatchIndexes(analysis));
  const text = statement.text;
  const values = new Set(immediateValues(text));
  const result = new Set<number>();
  for (const instruction of analysis.target) {
    if (!mismatches.has(instruction.index)) continue;
    const canonicalValues = immediateValues(instruction.canonical);
    if (canonicalValues.some((value) => values.has(value))) result.add(instruction.index);
  }
  if (/\bsetSprt\s*\(/.test(text)) {
    for (const instruction of analysis.target) {
      if (mismatches.has(instruction.index) && instruction.mnemonic === "li" && [4, 100].some((value) => immediateValues(instruction.canonical).includes(value))) {
        result.add(instruction.index);
      }
    }
  }
  if (/\(s16\)\s*\w+/.test(text)) {
    for (const instruction of analysis.target) {
      if (mismatches.has(instruction.index) && ["sll", "sra"].includes(instruction.mnemonic)) result.add(instruction.index);
    }
  }
  const assignment = statement.kind === "assignment" ? statement : undefined;
  if (assignment?.rhs && analysis.target.some((instruction) => mismatches.has(instruction.index) && instruction.mnemonic === "lw")) {
    const stackParameter = assignment.reads.find((name) => /^arg\d+$/.test(name) && Number(name.slice(3)) >= 4);
    if (stackParameter) {
      for (const instruction of analysis.target) {
        if (mismatches.has(instruction.index) && instruction.mnemonic === "lw") result.add(instruction.index);
      }
    }
  }
  return [...result].sort((left, right) => left - right);
}

export function bindSourceRoles(model: SourceModel, analysis: TargetScheduleAnalysis): SourceRoleBinding[] {
  const roles: SourceRoleBinding[] = [];
  for (const statement of model.prologueStatements) {
    const targetIndexes = targetIndexesForStatement(statement, analysis);
    if (targetIndexes.length === 0) continue;
    const correspondence = analysis.correspondence.filter((item) => targetIndexes.includes(item.targetIndex));
    roles.push({
      id: `role-${statement.id}`,
      role: statement.kind === "known-macro" ? statement.macro || statement.id : statement.lhs || statement.id,
      targetIndexes,
      candidateIndexes: correspondence.flatMap((item) => item.candidateIndex === undefined ? [] : [item.candidateIndex]),
      statementIds: [statement.id],
      sourceNames: [...new Set([...statement.reads, ...statement.writes])].sort(),
      confidence: correspondence.every((item) => item.confidence === "exact") ? "exact" : "reconstructed",
      evidence: [
        `Source statement ${statement.id} contains operation/constant evidence for target indexes ${targetIndexes.join(", ")}.`,
        ...statement.evidence,
      ],
    });
  }

  const pointer = model.parameters.find((parameter) => parameter.pointer && analysis.target.some((instruction) =>
    mismatchIndexes(analysis).includes(instruction.index) && instruction.mnemonic === "move"
  ));
  if (pointer) {
    const indexes = analysis.target.filter((instruction) => mismatchIndexes(analysis).includes(instruction.index) && instruction.mnemonic === "move").map((instruction) => instruction.index);
    roles.push({
      id: `role-${pointer.id}`,
      role: "pointer-argument-copy",
      targetIndexes: indexes,
      candidateIndexes: analysis.correspondence.filter((item) => indexes.includes(item.targetIndex)).flatMap((item) => item.candidateIndex === undefined ? [] : [item.candidateIndex]),
      statementIds: [],
      sourceNames: [pointer.name],
      confidence: "reconstructed",
      evidence: [`${pointer.name} is the first pointer parameter and the mismatch window contains an argument-register move.`],
    });
  }

  return roles.sort((left, right) => Math.min(...left.targetIndexes) - Math.min(...right.targetIndexes) || left.id.localeCompare(right.id));
}

function intersects(left: string[], right: string[]): boolean {
  const values = new Set(left);
  return right.some((value) => values.has(value));
}

function memoryConflict(left: ShapeNode, right: ShapeNode): boolean {
  const touches = (values: string[]) => values.includes("*unknown*") || values.includes("*memory*");
  if ((left.memoryReads.length === 0 && left.memoryWrites.length === 0) || (right.memoryReads.length === 0 && right.memoryWrites.length === 0)) return false;
  if (touches([...left.memoryReads, ...left.memoryWrites]) || touches([...right.memoryReads, ...right.memoryWrites])) return true;
  return intersects(left.memoryWrites, [...right.memoryReads, ...right.memoryWrites]) || intersects(right.memoryWrites, left.memoryReads);
}

function conflict(left: ShapeNode, right: ShapeNode): boolean {
  return intersects(left.writes, [...right.reads, ...right.writes]) || intersects(right.writes, left.reads) || memoryConflict(left, right);
}

function targetRank(text: string): number {
  if (/\bsetSprt\s*\(|\bsetlen\s*\(|\bsynth_sprt_len\s*=/.test(text)) return 10;
  if (/\bsetcode\s*\(|\bsynth_sprt_code\s*=/.test(text)) return 20;
  if (/\bsynth_prim_ptr\s*=/.test(text)) return 30;
  if (/0x[fF]{4}|65535/.test(text)) return 40;
  if (/\(s16\)/.test(text)) return 50;
  if (/0x[fF](?![0-9a-fA-F])|&\s*15\b/.test(text)) return 70;
  if (/0x[fF]0|240\b/.test(text)) return 80;
  if (/\barg8\b/.test(text)) return 90;
  return 100;
}

function nodeFromStatement(statement: SourceStatement, order: number): ShapeNode {
  return {
    id: statement.id,
    text: statement.text.trim(),
    reads: statement.reads,
    writes: statement.writes,
    memoryReads: statement.memoryReads,
    memoryWrites: statement.memoryWrites,
    originalOrder: order,
    targetRank: targetRank(statement.text),
    statementIds: [statement.id],
  };
}

function syntheticNode(id: string, text: string, order: number, statementIds: string[]): ShapeNode {
  const statement = classifyStatement(text, id, { start: 0, end: text.length, lineStart: 1, lineEnd: 1 });
  if (!statement.movable) throw new Error(`internal synthesized statement is not safely movable: ${text}`);
  return {
    ...nodeFromStatement(statement, order),
    statementIds,
  };
}

function topologicalOrders(nodes: ShapeNode[], limit: number): ShapeNode[][] {
  const predecessors = new Map<string, Set<string>>(nodes.map((node) => [node.id, new Set<string>()]));
  for (let left = 0; left < nodes.length; left++) {
    for (let right = left + 1; right < nodes.length; right++) {
      if (conflict(nodes[left]!, nodes[right]!)) predecessors.get(nodes[right]!.id)!.add(nodes[left]!.id);
    }
  }
  const results: ShapeNode[][] = [];
  const visit = (remaining: ShapeNode[], selected: ShapeNode[]): void => {
    if (results.length >= limit) return;
    if (remaining.length === 0) {
      results.push(selected);
      return;
    }
    const selectedIds = new Set(selected.map((node) => node.id));
    const ready = remaining.filter((node) => [...predecessors.get(node.id)!].every((id) => selectedIds.has(id)))
      .sort((left, right) => left.targetRank - right.targetRank || left.originalOrder - right.originalOrder || left.id.localeCompare(right.id));
    for (const node of ready) {
      visit(remaining.filter((candidate) => candidate.id !== node.id), [...selected, node]);
      if (results.length >= limit) break;
    }
  };
  visit(nodes, []);
  return results;
}

function pureInitializerCandidates(model: SourceModel): Array<{ declaration: SourceDeclaration; assignment: SourceStatement }> {
  const parameterNames = new Set(model.parameters.map((parameter) => parameter.name));
  const declarationByName = new Map(model.declarations.map((item) => [item.name, item]));
  const result: Array<{ declaration: SourceDeclaration; assignment: SourceStatement }> = [];
  for (let index = 0; index < model.prologueStatements.length; index++) {
    const statement = model.prologueStatements[index]!;
    if (statement.kind !== "assignment" || statement.operator !== "=" || !statement.lhs || statement.rhs === undefined) continue;
    const declaration = declarationByName.get(statement.lhs);
    if (!declaration || declaration.initializer !== undefined) continue;
    if (!statement.reads.every((name) => parameterNames.has(name))) continue;
    const earlierWrites = new Set(model.prologueStatements.slice(0, index).flatMap((item) => item.writes));
    if (statement.reads.some((name) => earlierWrites.has(name))) continue;
    result.push({ declaration, assignment: statement });
  }
  return result;
}

function subsets<T>(values: T[], enabled: boolean): T[][] {
  if (!enabled || values.length === 0) return [[]];
  const result: T[][] = [];
  const total = 1 << Math.min(values.length, 8);
  for (let mask = 0; mask < total; mask++) result.push(values.filter((_value, index) => Boolean(mask & (1 << index))));
  return result;
}

function uniqueName(source: string, base: string): string {
  let candidate = base;
  let suffix = 2;
  while (new RegExp(`\\b${candidate}\\b`).test(source)) candidate = `${base}_${suffix++}`;
  return candidate;
}

function replaceDeclaration(declaration: SourceDeclaration, initializer: string): string {
  return `${declaration.typeText} ${declaration.name} = ${initializer};`;
}

function statementRegionText(source: string, model: SourceModel): string {
  if (!model.prologueRegion) return "";
  return source.slice(model.prologueRegion.start, model.prologueRegion.end);
}

function declarationRegionText(source: string, model: SourceModel): string {
  if (!model.declarationRegion) return "";
  return source.slice(model.declarationRegion.start, model.declarationRegion.end);
}

function configurations(options: DeriveOptions, model: SourceModel, recipes: SynthesisRecipe[]): ShapeConfiguration[] {
  if (!model.prologueRegion || !model.declarationRegion) return [];
  const initializers = pureInitializerCandidates(model);
  const headerStatement = model.prologueStatements.find((statement) => statement.macro === "setSprt");
  const headerForms = ["macro", ...(options.maxDepth >= 2 && headerStatement ? ["expanded"] : []), ...(options.maxDepth >= 3 && headerStatement ? ["named"] : [])];
  const pointerParameter = options.maxDepth >= 3
    ? model.parameters.find((parameter) => parameter.pointer && new RegExp(`\\baddPrim\\s*\\(\\s*${parameter.name}\\s*,`).test(options.source))
    : undefined;
  const pointerForms = pointerParameter ? [false, true] : [false];
  const result: ShapeConfiguration[] = [];

  for (const initializerSet of subsets(initializers, options.maxDepth >= 2)) {
    for (const headerForm of headerForms) {
      for (const pointerAlias of pointerForms) {
        const initializerByStatement = new Map(initializerSet.map((item) => [item.assignment.id, item]));
        const declarationInitializers = new Map(initializerSet.map((item) => [item.declaration.id, item.assignment.rhs!]));
        const declarationTexts = model.declarations.map((item) => declarationInitializers.has(item.id)
          ? replaceDeclaration(item, declarationInitializers.get(item.id)!)
          : item.text.trim());
        const nodes: ShapeNode[] = [];
        const recipeIds = ["recipe-statement-order"];
        const evidence = ["Every emitted order is a topological order of conservative scalar and fixed-field dependencies."];
        let syntheticOrder = 0;
        let headerPointer = "out";

        if (headerForm === "named") {
          const lengthName = uniqueName(options.source, "synth_sprt_len");
          const codeName = uniqueName(options.source, "synth_sprt_code");
          declarationTexts.push(`u8 ${lengthName};`, `u8 ${codeName};`);
          recipeIds.push("recipe-header-named-constants");
          evidence.push("The named header form preserves setSprt's configured length/code values and field writes.");
          for (const statement of model.prologueStatements) {
            if (statement.id === headerStatement?.id) {
              nodes.push(
                syntheticNode("synth-header-length-value", `${lengthName} = 4;`, syntheticOrder++, [statement.id]),
                syntheticNode("synth-header-code-value", `${codeName} = 0x64;`, syntheticOrder++, [statement.id]),
                syntheticNode("synth-header-length-store", `setlen(${headerPointer}, ${lengthName});`, syntheticOrder++, [statement.id]),
                syntheticNode("synth-header-code-store", `setcode(${headerPointer}, ${codeName});`, syntheticOrder++, [statement.id]),
              );
            } else if (!initializerByStatement.has(statement.id)) nodes.push(nodeFromStatement(statement, syntheticOrder++));
          }
        } else if (headerForm === "expanded") {
          recipeIds.push("recipe-header-expansion");
          evidence.push("The expanded header form is the configured setSprt macro's two field writes with identical constants.");
          for (const statement of model.prologueStatements) {
            if (statement.id === headerStatement?.id) {
              nodes.push(
                syntheticNode("synth-header-length-store", `setlen(${headerPointer}, 4);`, syntheticOrder++, [statement.id]),
                syntheticNode("synth-header-code-store", `setcode(${headerPointer}, 0x64);`, syntheticOrder++, [statement.id]),
              );
            } else if (!initializerByStatement.has(statement.id)) nodes.push(nodeFromStatement(statement, syntheticOrder++));
          }
        } else {
          for (const statement of model.prologueStatements) {
            if (!initializerByStatement.has(statement.id)) nodes.push(nodeFromStatement(statement, syntheticOrder++));
          }
        }

        if (initializerSet.length > 0) {
          recipeIds.push("recipe-declaration-initializer");
          evidence.push(`Moved first pure parameter-derived assignments into C89 declarations: ${initializerSet.map((item) => item.declaration.name).join(", ")}.`);
        }

        const extraEdits: ExactSourceEdit[] = [];
        if (pointerAlias && pointerParameter) {
          const alias = uniqueName(options.source, "synth_prim_ptr");
          declarationTexts.push(`${pointerParameter.typeText} ${alias};`);
          nodes.push(syntheticNode("synth-pointer-alias", `${alias} = ${pointerParameter.name};`, syntheticOrder++, []));
          const callNeedle = `addPrim(${pointerParameter.name},`;
          const occurrences = options.source.split(callNeedle).length - 1;
          if (occurrences > 0) extraEdits.push({ find: callNeedle, replace: `addPrim(${alias},`, occurrences });
          recipeIds.push("recipe-parameter-local-copy");
          evidence.push(`Introduced one typed local copy of pointer parameter ${pointerParameter.name} and redirected its addPrim uses.`);
        }

        const distinctRecipeIds = [...new Set(recipeIds)];
        if (distinctRecipeIds.length > options.maxDepth) continue;
        result.push({
          id: `cfg-init-${initializerSet.map((item) => item.declaration.name).join("-") || "none"}-header-${headerForm}-ptr-${pointerAlias ? "alias" : "direct"}`,
          nodes,
          declarations: declarationTexts,
          extraEdits,
          recipeIds: distinctRecipeIds,
          evidence,
        });
      }
    }
  }

  const familyRecipes: SynthesisRecipe[] = [
    {
      id: "recipe-statement-order",
      mechanisms: ["statement-birth-order"],
      expectedPass: "sched",
      expectedEffect: "change block-local birth/LUID order only among source operations proven independent",
      requirementIds: options.analysis.requirements.filter((item) => item.stage === "sched" || item.stage === "sched2").map((item) => item.id),
      statementIds: model.prologueStatements.map((item) => item.id),
      edits: [],
      safety: "proven-local",
      evidence: ["Topological enumeration preserves every conservative scalar and fixed-field dependency."],
    },
    {
      id: "recipe-declaration-initializer",
      mechanisms: ["constant-birth-site", "statement-birth-order"],
      expectedPass: "rtl",
      expectedEffect: "move a pure parameter-derived first definition to its C89 declaration",
      requirementIds: options.analysis.requirements.flatMap((item) => item.interventions.filter((intervention) => ["birth-order", "luid-order", "lifetime-endpoint"].includes(intervention.kind)).length > 0 ? [item.id] : []),
      statementIds: initializers.map((item) => item.assignment.id),
      edits: [],
      safety: "proven-local",
      evidence: ["Only assignments reading unmodified parameters with no call or volatile token are eligible."],
    },
    {
      id: "recipe-header-expansion",
      mechanisms: ["statement-birth-order", "constant-birth-site"],
      expectedPass: "rtl",
      expectedEffect: "expose setSprt length and code stores as independent configured macro operations",
      requirementIds: options.analysis.requirements.filter((item) => item.targetIndexes.some((index) => [4, 100].some((value) => immediateValues(options.analysis.target[index]?.canonical || "").includes(value)))).map((item) => item.id),
      statementIds: headerStatement ? [headerStatement.id] : [],
      edits: [],
      safety: "proven-known-macro",
      evidence: ["Configured libgpu.h defines setSprt as setlen(...,4), setcode(...,0x64)."],
    },
    {
      id: "recipe-header-named-constants",
      mechanisms: ["constant-birth-site", "fresh-vs-reused-web"],
      expectedPass: "rtl",
      expectedEffect: "give sprite length and code constants explicit C89 local birth sites",
      requirementIds: options.analysis.requirements.filter((item) => item.interventions.some((intervention) => ["birth-order", "luid-order", "priority-relation"].includes(intervention.kind))).map((item) => item.id),
      statementIds: headerStatement ? [headerStatement.id] : [],
      edits: [],
      safety: "proven-known-macro",
      evidence: ["Named u8 values preserve the constants accepted by setlen and setcode."],
    },
    {
      id: "recipe-parameter-local-copy",
      mechanisms: ["fresh-vs-reused-web", "single-vs-multi-set"],
      expectedPass: "rtl",
      expectedEffect: "create an explicit typed pointer-argument web with a selectable source birth site",
      requirementIds: options.analysis.requirements.filter((item) => item.interventions.some((intervention) => ["birth-eligibility", "birth-order", "priority-relation", "luid-order"].includes(intervention.kind))).map((item) => item.id),
      statementIds: [],
      edits: [],
      safety: "proven-local",
      evidence: ["The generated local has the exact parameter type and replaces only configured addPrim argument uses."],
    },
  ];
  recipes.push(...familyRecipes.filter((recipe) => result.some((configuration) => configuration.recipeIds.includes(recipe.id))));
  return result;
}

function renderStatements(order: ShapeNode[]): string {
  return order.map((node) => node.text.trim()).join("\n    ");
}

function renderDeclarations(declarations: string[]): string {
  return declarations.map((text) => text.trim()).join("\n    ");
}

export function deriveSynthesisPlan(options: DeriveOptions, model: SourceModel): SynthesisPlan {
  const roles = bindSourceRoles(model, options.analysis);
  const recipes: SynthesisRecipe[] = [];
  const suppressed: SynthesisPlan["suppressed"] = [];
  const preserveTargetRanges = options.analysis.preservationRanges.filter((range) => range.exact).map((range) => [range.start, range.end] as [number, number]);

  if (!model.prologueRegion || !model.declarationRegion || model.prologueStatements.length < 2) {
    suppressed.push({
      kind: "source-model",
      reason: "No contiguous safe top-level prologue with at least two statements was modeled.",
      evidence: model.caveats,
    });
  }

  const basePrologue = statementRegionText(options.source, model);
  const baseDeclarations = declarationRegionText(options.source, model);
  const alternatives: SynthesizedAlternative[] = [];
  const seen = new Set<string>();
  const configs = configurations(options, model, recipes);
  const perConfiguration = Math.max(1, Math.ceil(options.maxVariants / Math.max(1, configs.length)));

  for (const configuration of configs) {
    for (const order of topologicalOrders(configuration.nodes, perConfiguration)) {
      if (alternatives.length >= options.maxVariants - 1) break;
      const replacementDeclarations = renderDeclarations(configuration.declarations);
      const replacementPrologue = renderStatements(order);
      const edits: ExactSourceEdit[] = [];
      if (replacementDeclarations !== baseDeclarations) edits.push({ find: baseDeclarations, replace: replacementDeclarations, occurrences: 1 });
      if (replacementPrologue !== basePrologue) edits.push({ find: basePrologue, replace: replacementPrologue, occurrences: 1 });
      edits.push(...configuration.extraEdits);
      if (edits.length === 0) continue;
      const key = sha256(stableJson(edits));
      if (seen.has(key)) continue;
      seen.add(key);
      const recipeIds = [...new Set(configuration.recipeIds)];
      alternatives.push({
        id: `shape-${String(alternatives.length + 1).padStart(4, "0")}`,
        expectedEffect: `${configuration.id}: test source order ${order.map((node) => node.id).join(" -> ")}`,
        invariants: [
          "all scalar dependencies retain their original relative order",
          "known primitive header writes retain the same final values",
          "the function signature, control flow, and post-prologue operations are unchanged",
        ],
        naturalPriority: order.reduce((score, node, index) => score + Math.abs(index * 10 - node.targetRank), 0) + recipeIds.length,
        edits,
        recipeIds,
        statementOrder: order.map((node) => node.id),
      });
    }
    if (alternatives.length >= options.maxVariants - 1) break;
  }

  if (alternatives.length === 0 && suppressed.length === 0) {
    suppressed.push({
      kind: "recipe-catalog",
      reason: "Every derived shape was source-equivalent to the baseline.",
      evidence: ["No non-empty exact edit survived deterministic deduplication."],
    });
  }

  return {
    schemaVersion: SOURCE_SHAPE_SYNTHESIS_SCHEMA_VERSION,
    function: options.functionName,
    sourcePath: options.sourcePath,
    sourceHash: model.sourceHash,
    analysisPath: options.analysisPath,
    analysisHash: sha256(stableJson(options.analysis)),
    maxVariants: options.maxVariants,
    maxDepth: options.maxDepth,
    preserveTargetRanges,
    roles,
    recipes,
    alternatives,
    suppressed,
    caveats: [
      ...model.caveats,
      "The MVP synthesizer models only the contiguous top-level prologue before the first control-flow or protected barrier boundary.",
      "Generated combinations are finite topological source orders plus proof-oriented initializer, known-macro, and typed pointer-copy forms.",
      "Target correspondence guides recipe relevance; it is not a claim about original source variable names.",
    ],
  };
}

export function sourceShapeSpec(plan: SynthesisPlan, hasEmptyMemoryBarriers: boolean): Record<string, unknown> {
  return {
    schemaVersion: 1,
    function: plan.function,
    baseSourcePath: plan.sourcePath,
    analysisPath: plan.analysisPath,
    maxVariants: Math.max(1, plan.alternatives.length + 1),
    dimensions: [{
      id: "synthesized-prologue-shape",
      mechanism: "statement-birth-order",
      expectedPass: "sched",
      invariants: [
        "the generated source preserves conservative scalar and fixed-field dependencies",
        "all edits are generated from the recorded synthesis plan",
      ],
      alternatives: [
        { id: "base", useBase: true, expectedEffect: "reference source shape", invariants: [] },
        ...plan.alternatives.map((alternative) => ({
          id: alternative.id,
          expectedEffect: alternative.expectedEffect,
          invariants: alternative.invariants,
          naturalPriority: alternative.naturalPriority,
          edits: alternative.edits,
        })),
      ],
    }],
    constraints: {
      preserveTargetRanges: plan.preserveTargetRanges,
      preserveOpcodeStream: false,
      forbidInstructionCountGrowth: true,
      preserveExistingEmptyMemoryBarriers: hasEmptyMemoryBarriers,
      incompatibleAlternatives: [],
      requiredAlternatives: [],
    },
    traceAllPreprocessed: false,
    assembleUniqueDbr: false,
  };
}
