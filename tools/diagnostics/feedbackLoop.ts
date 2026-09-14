/**
 * feedbackLoop.ts — does a recovery make the next attempt a different question?
 *
 * A campaign that requeues a function after a sibling was solved, but shows it
 * exactly the evidence that failed it the first time, is not a fixed point. It
 * is the same experiment run twice, and more rounds of it converge on nothing.
 * The claim this measures is the one that separates the two: **publishing a
 * verified recovery changes what a dependent can do**.
 *
 * The experiment has four steps and each one is checked, not assumed:
 *
 *   1. the dependent is attempted and fails, with the reason recorded;
 *   2. a producer is recovered from the target's words and verified by the
 *      relocated-byte oracle;
 *   3. it is published to the recovered-artifact overlay, which moves the
 *      overlay's revision and so invalidates the donor index and the signature
 *      cache keyed on it;
 *   4. the dependent is attempted again and now succeeds.
 *
 * It runs **cold** by default, and that is the point rather than a detail. Warm,
 * the producer's donors and headers are already on disk and step 4 could be
 * explained by material that was there all along. Cold, the only thing that
 * changed between step 1 and step 4 is what this run recovered from the binary
 * — so the unlock is attributable to the feedback and to nothing else.
 *
 * The overlay is left as it was found: a measurement that permanently changes
 * the tree it measures cannot be repeated.
 *
 * Usage:
 *   npx tsx tools/diagnostics/feedbackLoop.ts
 *   npx tsx tools/diagnostics/feedbackLoop.ts <producer> <dependent>
 *   Options: --warm  --json
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ROOT } from "../agent/decompToolchain.js";
import { buildFamilyIndex, donorsFor } from "../agent/family-transfer/family-index.js";
import { transferFromDonor } from "../agent/family-transfer/transfer.js";
import { reconstructFunction } from "../agent/matching-reconstruction/engine.js";
import { resolveSignature } from "../agent/matching-reconstruction/callee-signature.js";
import { withContextMode, type ContextMode } from "../agent/matching-reconstruction/context-mode.js";
import { requireFunctionLocation } from "../lib/symbolIndex.js";
import {
  loadOverlay,
  overlayRevision,
  publishRecovered,
  retractRecovered,
} from "../agent/campaign/artifact-overlay.js";

/**
 * The default pair.
 *
 * `ovl_21_func_800BA670` is a ten-word function the constructor recovers from
 * the words alone. `ovl_11_func_800F4114` shares its shape in another
 * container and the constructor exhausts its whole domain on it without a
 * match — before the publication and after it, which is what makes the control
 * step meaningful: the transfer is the only thing that closes it. Cold, the
 * pair has no donor between them, so there is nothing to transfer from until
 * the first is published.
 */
const DEFAULT_PRODUCER = "ovl_21_func_800BA670";
const DEFAULT_DEPENDENT = "ovl_11_func_800F4114";

export interface FeedbackStep {
  step: string;
  detail: string;
  /** Whether this step showed what the experiment needs it to show. */
  held: boolean;
}

export interface FeedbackResult {
  contextMode: ContextMode;
  producer: string;
  dependent: string;
  revisionBefore: string;
  revisionAfter: string;
  donorsBefore: string[];
  donorsAfter: string[];
  dependentBefore: string;
  dependentAfter: string;
  producerSignatureBefore: string;
  producerSignatureAfter: string;
  steps: FeedbackStep[];
  /** True only when every step held. */
  demonstrated: boolean;
}

export function runFeedbackExperiment(
  producer = DEFAULT_PRODUCER,
  dependent = DEFAULT_DEPENDENT,
  mode: ContextMode = "cold",
): FeedbackResult {
  const preserved = loadOverlay();
  const container = requireFunctionLocation(producer).container;

  try {
    return withContextMode(mode, () => {
      retractRecovered();
      const steps: FeedbackStep[] = [];
      const revisionBefore = overlayRevision();

      const indexBefore = buildFamilyIndex({ tier: "flexible" });
      const donorsBefore = donorsFor(indexBefore, dependent).map((donor) => donor.functionName);
      const signatureBefore = describeSignature(producer, container);

      const before = reconstructFunction({ functionName: dependent, notify: () => {} });
      steps.push({
        step: "1. the dependent fails",
        detail: `${dependent}: ${before.state}${before.unresolved ? ` (${before.unresolved.category})` : ""}, ` +
          `${donorsBefore.length} donor(s) available`,
        held: before.state !== "exact-candidate" && donorsBefore.length === 0,
      });

      const recovered = reconstructFunction({ functionName: producer, notify: () => {} });
      steps.push({
        step: "2. the producer is recovered and verified",
        detail: `${producer}: ${recovered.state}` +
          (recovered.winner ? ` (${recovered.winner.id}, ${recovered.winner.matchedWords}/${recovered.winner.totalWords} words)` : ""),
        held: recovered.state === "exact-candidate",
      });
      if (!recovered.winner) {
        return finish(mode, producer, dependent, revisionBefore, overlayRevision(), donorsBefore, [],
          before.state, before.state, signatureBefore, signatureBefore, steps);
      }

      const publication = publishRecovered(producer, recovered.winner.source, "reconstruction");
      const revisionAfter = overlayRevision();
      steps.push({
        step: "3. publication moves the revision",
        detail: "refused" in publication
          ? publication.refused
          : `${revisionBefore} → ${revisionAfter}; the donor index and the signature cache are keyed on it`,
        held: !("refused" in publication) && revisionAfter !== revisionBefore,
      });

      const indexAfter = buildFamilyIndex({ tier: "flexible" });
      const donorsAfter = donorsFor(indexAfter, dependent).map((donor) => donor.functionName);
      const signatureAfter = describeSignature(producer, container);

      /* The dependent is asked again, by the route the new evidence opened:
       * a donor makes this a substitution, which is the cheaper route a
       * campaign would take. Reconstruction is retried too, so a result that
       * came from the constructor rather than the transfer is not miscredited. */
      const transfer = donorsAfter.includes(producer)
        ? transferFromDonor(dependent, producer, { tier: "flexible", limit: 12 })
        : undefined;
      const retried = reconstructFunction({ functionName: dependent, notify: () => {} });
      const after = transfer?.winner ? "exact-candidate (family transfer)" : retried.state;
      steps.push({
        step: "4. the dependent succeeds",
        detail: `${dependent}: ${after}` +
          (transfer?.winner ? ` via ${producer}, ${transfer.winner.id}` : ""),
        held: transfer?.winner !== undefined || retried.state === "exact-candidate",
      });
      steps.push({
        step: "control: the constructor alone still cannot",
        detail: `${dependent} reconstructed on its own: ${retried.state} — unchanged from step 1`,
        held: retried.state === before.state,
      });

      return finish(mode, producer, dependent, revisionBefore, revisionAfter, donorsBefore, donorsAfter,
        `${before.state}${before.unresolved ? ` (${before.unresolved.category})` : ""}`, after,
        signatureBefore, signatureAfter, steps);
    });
  } finally {
    /* Restore what was published before, so running the experiment is not a
     * change to the project's state. */
    retractRecovered();
    for (const entry of preserved.entries) {
      try {
        const source = readFileSync(join(ROOT, entry.sourcePath), "utf-8");
        withContextMode(entry.contextMode, () => publishRecovered(entry.functionName, source, entry.route));
      } catch { /* an entry whose file is gone cannot be restored */ }
    }
  }
}

function describeSignature(name: string, container: ReturnType<typeof requireFunctionLocation>["container"]): string {
  const signature = resolveSignature(name, undefined, container);
  if ("unknown" in signature) return "unknown";
  return `arity ${signature.arity}, ${signature.returnsValue ? "returns a value" : "void"} [${signature.source}]`;
}

function finish(
  contextMode: ContextMode,
  producer: string,
  dependent: string,
  revisionBefore: string,
  revisionAfter: string,
  donorsBefore: string[],
  donorsAfter: string[],
  dependentBefore: string,
  dependentAfter: string,
  producerSignatureBefore: string,
  producerSignatureAfter: string,
  steps: FeedbackStep[],
): FeedbackResult {
  return {
    contextMode,
    producer,
    dependent,
    revisionBefore,
    revisionAfter,
    donorsBefore,
    donorsAfter,
    dependentBefore,
    dependentAfter,
    producerSignatureBefore,
    producerSignatureAfter,
    steps,
    demonstrated: steps.every((step) => step.held),
  };
}

export function renderFeedback(result: FeedbackResult): string[] {
  const lines: string[] = [];
  lines.push(`feedback experiment (${result.contextMode} context): ${result.producer} → ${result.dependent}`);
  lines.push("");
  for (const step of result.steps) {
    lines.push(`  ${step.held ? "✓" : "✗"} ${step.step}`);
    lines.push(`      ${step.detail}`);
  }
  lines.push("");
  lines.push(`  donors for ${result.dependent}: [${result.donorsBefore.join(", ")}] → [${result.donorsAfter.join(", ")}]`);
  lines.push(`  ${result.producer}'s signature: ${result.producerSignatureBefore} → ${result.producerSignatureAfter}`);
  lines.push(`  overlay revision: ${result.revisionBefore} → ${result.revisionAfter}`);
  lines.push("");
  lines.push(result.demonstrated
    ? "The recovery was published and the dependent succeeded because of it. The loop closes."
    : "The loop did not close here; the failing step names what was missing.");
  return lines;
}

function main(): void {
  const args = process.argv.slice(2);
  const json = args.includes("--json");
  const mode: ContextMode = args.includes("--warm") ? "warm" : "cold";
  const positional = args.filter((argument) => !argument.startsWith("--"));
  const result = runFeedbackExperiment(
    positional[0] ?? DEFAULT_PRODUCER,
    positional[1] ?? DEFAULT_DEPENDENT,
    mode,
  );
  if (json) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }
  console.log(renderFeedback(result).join("\n"));
}

if (process.argv[1]?.endsWith("feedbackLoop.ts")) main();
