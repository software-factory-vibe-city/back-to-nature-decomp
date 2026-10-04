# Extraction, annotation and limitations

Companion to [the findings](README.md). The CSV is a census of dispatches in the
two supplied logs, not a census of all project functions or all historical
attempts on these functions.

## Inputs and citation convention

Both files are under:

```text
~/.pi/agent/sessions/--home-dave-Documents-code-btn-decompilation--/
```

| Label | Filename | JSONL records | Bytes |
|---|---|---:|---:|
| S1 | `2026-10-03T20-23-15-805Z_01a1036f-6a5d-7202-b5ce-034cef59c181.jsonl` | 6,861 | 18,497,948 |
| S2 | `2026-10-04T07-32-28-677Z_01a105d4-1985-7664-8d15-efa4eed70e6f.jsonl` | 12,356 | 36,155,266 |

SHA-256 values, full local paths and recorded UTC endpoints are in
[provenance.json](provenance.json). `S2:L12132` means line 12,132 of that JSONL.
Tool calls and tool results are separate records. The CSV also retains the entry
IDs for first-exact observations and successful native finalizations.

Historical outcomes and edits come from the logs. Structural classification is a
**new read-only annotation of the original target bytes** using the existing
machine-IR library. No historical candidate was recompiled and no current source
file's match state was used to decide a historical outcome.

Temporary TypeScript extraction/review helpers and transcripts were kept in
`/tmp/btn-session-analysis/`; they are scratch material, not a repository tool or
a required durable input. The retained census, input hashes, line references and
rules below define the analysis. No executable or generated binary was added to
the repository.

## 1. Episode boundaries

Parse each JSONL record and preserve its one-based physical line number. Join
`message.content` text blocks for identifying user/control messages.

A target assignment is a user-role message matching:

```text
^/skill:psx-decompile-function Target: (\w+)
```

The next such assignment closes the current episode. There are **99 and 171**
assignments, respectively, with no repeated function identity within or across
these two files. Names include their overlay prefix; addresses alone are not IDs.

A user-role message starting with:

```text
<function> is byte-exact and has passed
```

starts post-match documentation. Everything from that message onward is excluded
from the episode's work window. “Keep going” messages remain within the current
attempt; neither continuation in these logs is counted as a new function.

The work endpoint is:

1. the first result for this function from `psx_finalize_function` whose
   `details.pass === true` and `details.mode === "match"`; otherwise
2. the last record before documentation, the next target, or EOF.

This endpoint can include brief administrative records immediately following an
unsuccessful worker's last response. It never includes another target's work.

S2:L12356 assigns `ovl_25_func_800B7EB4` and is EOF. It has zero assistant messages
and is marked **not_started**, not a zero-second match or an unsuccessful attempt.

The records' outer ISO `timestamp` fields define elapsed time. The nested numeric
message timestamp can describe an earlier point in response generation and is
not interchangeable with it.

## 2. Metrics

### Work-window time

```text
work_seconds = endpoint.timestamp - assignment.timestamp
```

Count all assistant messages, tool calls and native `psx_residual_objective`
requests within that window. These are **episode-attributed counts**: one native
residual request in S1 also checks a callee after a signature change. That is work
spent on the caller's attempt, not a separate attempt.

There are **6,702 assistant messages, 8,635 tool requests, and 829 native residual
requests** in the 269 started work windows. Tool requests are not compiler runs:
some only read files, one request may compile thousands of variants, some calls
measure unchanged source, and shells can launch additional diagnostics.

No arbitrary idle cutoff or winsorization was applied. The largest adjacent-record
gap inside the measured windows is **158.467 seconds**, ending in a shell result
(S1:L6127). Of the **17 gaps exceeding 60 seconds**, eleven end in tool results
and six in assistant messages; all six assistant cases are in `800B9844`'s S2
episode. These observations do not measure CPU time or rule out provider/network
waiting. They provide no basis for treating long tool runs as human idle time.

The session envelopes total about **825.78 minutes**, versus **692.04 measured
work minutes**. The difference includes documentation, controller/handoff work
and startup; it is not labelled “idle.” The 6-hour-28-minute gap between sessions
is outside both envelopes and all function timings.

### First explicit byte-exact observation

Match tool-call IDs to result records. Require the measured function to be the
assigned target. Recognized positive observations are:

- an `EXACT` candidate row from `psx_residual_objective`;
- `STATE: exact-candidate` from reconstruction;
- `<function>: exact-candidate-found` from residual-source-space search;
- a `VERDICT: MATCH` result from a shell command invoking `diffFunc.ts` for this
  target;
- `details.diff.exact === true` from finalization, even if another gate fails.

Take the earliest qualifying result's timestamp. Plain equal-looking word counts,
agent claims, masked flag-probe scores and “cc1 exact” without object confirmation
are not sufficient. Reads of old reports are not new positive measurements.

This measures the **first recognized explicit candidate success**, not necessarily
the compiler invocation where a search internally first found it. A batch report
arrives after the batch. Scratch-source success can precede installation. A flag-
conditional match can still fail policy. The corresponding finalization/outcome
columns must therefore be retained.

### Aggregation

- Include only `started=true` rows for effort statistics.
- Median: middle value, or mean of the middle two for even N.
- P90: sorted value at one-based rank `ceil(0.9 * N)`.
- Thresholds: strictly greater than 300 or 600 seconds.
- First-exact medians: exclude rows with no observed exact result; state that
  denominator explicitly rather than imputing success times.
- Percentages and minutes in prose are rounded; the CSV retains seconds.

The successful-finalize latency observation is call-record to result-record time,
not the sum of individual compiler subprocess durations. It is reported separately
and is **not subtracted** from the work metric.

## 3. Outcomes, including the awkward cases

| Outcome | Count | Evidence rule |
|---|---:|---|
| `finalize_pass` | 261 | Explicit native passing result for this target |
| `exact_policy_blocked` | 3 | Exact bytes observed; flag-policy gate rejected |
| `exact_scope_blocked` | 2 | Exact bytes observed; native scope gate rejected |
| `no_exact_observed` | 3 | Work occurred, but no qualifying exact verdict |
| `not_started` | 1 | Terminal target dispatch only |

Exceptional outcomes:

| Function | Evidence |
|---|---|
| `ovl_21_func_800B98CC` | S1:L932 EXACT; L935 flag-policy rejection |
| `ovl_11_func_8011F574` | S1:L2435 shell MATCH; L2451 flag-policy rejection |
| `ovl_17_func_800B9158` | S2:L1463 shell MATCH; L1475 source-policy rejection; L1477 repeats MATCH |
| `ovl_11_func_800DE76C` | S1:L6739 EXACT; L6741 scope failure; L6768 controller success/documentation prompt |
| `ovl_11_func_800BF3F4` | S1:L6822 EXACT; L6824 and L6855 scope failures; log ends during follow-up |
| `ovl_11_func_800BF450` | S1:L6687 unresolved/park report, no byte-exact result |
| `ovl_17_func_800B90F8` | S2:L1204 unresolved/park report, no byte-exact result |
| `ovl_15_func_80135AE0` | S2:L11840 mismatch gate; L11873 unresolved report |

`800DE76C` is deliberately not flattened into an unqualified failure or success:
the last native gate fails scope, while a subsequent controller prompt reports
success. `controller_success_prompt_line` preserves that second observation.
Thus there are **261 explicit native passes** and **262 success/documentation
prompts**, not contradictory counts of the same event. No unseen controller gate
is reconstructed from the prompt.

“Unmatched” is a historical observation within these windows. It is not proof of
impossibility, nor a statement about today's source or future work. The three
flag-conditional successes are likewise not proofs that a flag is necessary or
that the original translation unit used it.

## 4. Target-side structural annotation

Call the existing read-only `buildMachineIr(functionName)` entry point for each
named target. It reads the configured original container bytes and builds the
CFG with branch delay slots attached to their predecessor. This does not invoke
the compiler or regenerate source. The relevant reader file hashes and checkout
identity are recorded in provenance.

Persist:

- instruction-word count, including delay slots and NOPs;
- CFG block and conditional-branch-block counts;
- `jal` / `jalr` instruction count;
- natural-loop count and a nested-loop flag;
- SHA-256 of the function's decoded words reserialized little-endian.

The three broad classes are:

```text
if natural_loops > 0:       loop
else if conditional > 0:   acyclic_branch
else:                      straight_line
```

Acyclic functions divide into one versus multiple conditional branches.
Non-nested loops divide according to whether conditional-branch count exceeds
natural-loop count. Every loop in this sample has a single latch, making this a
usable “additional branch control” split. It does not say that every additional
branch is inside the loop body, nor classify the semantic purpose of a loop.

### Nesting annotation caveat

The checked-in natural-loop helper's reverse predecessor walk starts from all
latches, including a latch that is also its own header. Expanding predecessors
from such a header admits preheader/outer blocks into a single-block loop. Raw
reported nesting depths can consequently be misleading.

For this analysis only, loop membership was reconstructed from the same witnessed
headers/latches with the standard boundary condition:

```text
body = {header} union latches
worklist = latches excluding header
while worklist is nonempty:
    visit predecessors not already in body
    add each new predecessor to body and worklist
```

Because `header` is already in `body`, traversal never expands through it.
“Nesting” requires **strict containment of one corrected body set in another**.
The production helper was not changed. Corrected nested cases were inspected:
`800BA630` and `800B9844` each have two nested loops; `80135AE0` has two nested
loops and a separate following loop, not a three-deep nest.

No irreducible cycle or resolved jump-table dispatch was reported in these
started targets. There is one opaque SSA-operation case (`ovl_27_func_800BAC14`:
`lwl/lwr/swl/swr` unaligned transfers); it does not obscure branch edges or loop
membership. This analysis therefore does not establish anything about large
switch dispatchers, irreducible graphs or unmodelled indirect control flow.

## 5. What is manual rather than mechanically inferred

The broad/subshape columns cover every target mechanically. The semantic and
compiler-mechanism descriptions in the long-case table were assigned by reading
historical source edits, measurements and terminal results, with target assembly
as a cross-check. They are **case studies**, not an exhaustive root-cause labelling
of all 269 attempts.

The main report distinguishes:

- **observed:** timing, explicit match/gate outcomes, a specific edit followed by
  a specific residual or exact verdict;
- **interpretation:** induction representation, assignment-join shape, context
  inconsistency as explanations for those changes;
- **unproven session claims:** an exception is necessary, all C has been exhausted,
  a flag identifies the original TU, or a matching declaration uniquely identifies
  the original signature.

Do not turn the third category into established findings merely because an agent
wrote it confidently at the end of a long attempt.

## 6. Limits on generalization

1. This is worklist-selected, small-function data, with related functions and
   donor reuse. Attempts are not independent random samples.
2. A dispatch's “fresh” label does not prove there was no prior historical work;
   timings measure these windows, not a function's lifetime effort.
3. All assistant messages within the measured windows identify the same worker
   model, `deepseek-v4-1-flash`. Model-change records around dispatches are not a
   within-sample model comparison.
4. S2's harder/larger loop mix, evolving context, donor availability, caches and
   variable response latency confound structural comparisons.
5. The nested sample is three. No confidence interval, causal speedup, formal
   survival estimate or universal ranking is warranted.
6. Many candidate batches and shell loops are visible. **829 native residual
   calls is not 829 unique experiments**, and no reliable all-compiles total is
   asserted.
7. Original machine topology is the basis of classification. An original C loop
   that was optimized away or unrolled is not counted as a machine loop here.

The useful output is a ranked set of hypotheses about *which constructions* merit
closer study, with a denominator and auditable case evidence—not a claim that all
loop work should be sent to one solver.

## Validation performed

Rechecked both input hashes, all 270 assignment boundaries, elapsed-time
calculations, first-exact entry IDs and 261 native passing results against the
JSONL. Independently cross-checked all 270 function-byte hashes and instruction
counts against the original disassembly files. Census totals, local document
links and Markdown fence balance passed. No build/match gate was rerun: this was
a documentation-only investigation, not a source change.
