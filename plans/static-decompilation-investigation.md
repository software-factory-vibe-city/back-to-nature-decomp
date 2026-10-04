# Static decompilation investigation

Status: investigation proposed; no pipeline changes implemented.

## Objective

Make initial function preparation faster and cheaper by handing the thinking
agent a dependable static-decompilation draft and a cogent evidence packet.

**Reliable assembly-to-C first, intelligent correction afterward.** The agent
should spend its effort fixing emitted code rather than reconstructing the
function, locating its inputs, and assembling its own context from scratch.

Keep the thinking agent open-ended. The packet is working material and
evidence, not a prescribed sequence of repairs or a restriction on replacing
an incorrect draft.

## Evidence from the overnight autoloop run

Session inspected:

```text
~/.pi/agent/sessions/--home-dave-Documents-code-btn-decompilation--/2026-10-04T07-32-28-677Z_01a105d4-1985-7664-8d15-efa4eed70e6f.jsonl
```

The session spans approximately nine hours, with 170 attempted functions,
167 successful model-facing finalizations, and 5,378 recorded assistant
responses. A further target was queued at the end without an assistant response.

### Initial preparation

- 2,680 tool calls occurred before the first detected target-source mutation:
  a median of 15 calls per function.
- Median time to that mutation was 54 seconds; the aggregate was approximately
  3 hours 8 minutes.
- Repeated work included reading the skill/profile, finding source and assembly
  paths, retrieving declarations and neighbours, and locating generated drafts.
- Total generated output was 3.92 million tokens, including 3.03 million
  provider-reported reasoning tokens.

These startup measurements are approximate boundaries, not a claim that all
that time is removable. They include useful type investigation, preparation of
other files or scratch candidates, and the draft-writing response.

### Draft generation

- Reconstruction ran on 160 targets: 81 `domain-exhausted` results and 79
  `unsupported-target` results; none reported an exact candidate.
- m2c ran on only 27 targets. Of the 79 reconstruction refusals, **55 never
  called m2c**.
- m2c repair ran on 14 targets, with 15 calls. Of 11 calls that attempted
  compilation, **9 reported compile errors**.

Absence of m2c does not always mean decompilation from scratch: partial
reconstruction candidates and matched neighbours also informed handwritten
source. The current skill prefers a reconstruction candidate over raw m2c,
which explains part of the pattern. Nevertheless, the fallback is inconsistent;
one sampled agent explicitly proposed m2c after a refusal and then proceeded
with handwritten reconstruction instead.

Simply invoking m2c more often is insufficient. Its context, emitted draft,
repair layer, and project integration need to form a dependable route.

## Agreed direction

Prefer improving the general-purpose static-decompilation path over growing a
catalogue of specialized reconstruction constructors or repair recipes.

For fresh functions, investigate making m2c a reliable baseline rather than an
inconsistently reached fallback. Preserve an existing clean-C attempt when
resuming. Generate experimental drafts outside live sources while assessing
and improving this path.

Improve the inputs available during decompilation:

- Independently witnessed callee signatures and relevant SDK definitions.
- Existing shared types and global declarations.
- Correct container placement, flags, assembly, and jump-table data.

Investigate systematic emission and integration failures, especially conflicting
declarations, unknown types, invalid dereferences, and inappropriate signature
repairs. Preserve uncertainty explicitly: a default or bounded signature is not
a witnessed fact. Making a draft compile does not prove its semantics or byte
identity.

Compile and measure the emitted candidate before handing it to the agent where
possible. If it cannot compile, provide the draft and concrete diagnostics
rather than silently presenting it as a usable seed.

### The preparation packet

Bring together:

1. Emitted C, or the existing attempt when resuming.
2. Original assembly and exact source/artifact paths.
3. Relevant declarations, type context, and evidence references.
4. Compiler errors or the measured residual.
5. Unresolved assumptions, prior measurements, and conditional closed claims.
6. A small number of relevant matched precedents where useful.

The agent remains free to repair, restructure, or replace the candidate. Avoid
making it repeat discovery already represented in the packet.

## Next investigation

1. Recover the raw and repaired drafts from the failed repair calls. Separate
   m2c control/data-flow recovery failures from missing or incorrect context and
   defects introduced by repair or integration.
2. Reproduce representative failures with frozen inputs. Prefer historical
   context where available: today's matched signatures and donors must not
   masquerade as information available at the original attempt.
3. Establish a baseline for direct m2c plus current repair, including compilation
   success, diagnostics, residuals, and preparation wall time. Keep failures in
   the denominator.
4. Improve the general path against those concrete failures, then evaluate the
   prepared packet with the same open-ended thinking agent.

Success means better initial candidates, fewer discovery round trips, and lower
end-to-end time/tokens without reducing matching or clean-source correctness.
A lower byte-difference count alone is not a quality metric; retain the staged
residual and authoritative final gate.

## Approaches considered and rejected

- A non-thinking clerical model followed by a thinking model: adds another
  handoff without addressing static-decompilation reliability.
- Restricting the thinking agent to rigid repair workflows: constrains the
  wrong component and can discourage necessary investigation or rewrites.
- An expanding domain-specific repair-recipe catalogue as the main solution:
  focus instead on a stronger general-purpose decompiler and better context.

## Adjacent optimizations, deferred

The run also exposed costs worth investigating separately:

- Startup triage batches typically took about 30 seconds, accumulating roughly
  84 minutes. In 168 outputs, the idiom corpus was regenerated because a source
  changed, usually the previous function. Its whole-corpus provenance includes
  every candidate source; investigate incremental per-function caching without
  weakening freshness checks.
- The controller repeats full finalization after the model-facing gate. The
  successful-gate-to-grouping intervals accumulated about 40 minutes. Any
  deduplication must first reconcile gate scope/policy semantics and retain
  authoritative verification of unchanged inputs.
- Post-match grouping turns accumulated about 44 minutes and 410,000 output
  tokens. Preserve grouping evidence, but investigate cheaper collection.

These timing categories overlap other totals and are observations from session
boundaries, not CPU profiles or guaranteed savings. The current priority is
reliable initial static decompilation and the packet, not cache optimization.

## Relevant implementation

- `.pi/extensions/psx-decomp/autoloop/loop.ts` and `prompts.ts`: orchestration
  and current startup instructions.
- `.pi/skills/psx-decompile-function/SKILL.md`: current seed priority/fallback.
- `tools/agent/m2cFunc.ts`: m2c invocation, container placement, and context.
- `tools/agent/repairM2c.ts`: repair and compile comparison.
- `tools/agent/campaign/bundle.ts`: existing prepared-bundle product to assess
  for reuse rather than building a competing packet format.
- `tools/agent/idiom-corpus/corpus.ts`: adjacent cache issue.

The inspection and discussion did not modify the pipeline, run autoloop, or
commit anything.
