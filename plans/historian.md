# Historian and strategy case bank

Status: proposed; no implementation is authorized by this plan.

## Goal

Reduce repeated investigation by matching agents through a small, searchable
bank of historical cases: what failed, and what eventually produced a verified
match.

The historian works offline from existing conversation histories. The matching
agent receives concise, relevant precedents rather than another experimental
framework to operate. The bar is a reduction in the agent's decision burden,
not a more disciplined way for it to carry the same burden.

The initial implementation should use plain text, not a database. This plan does
not propose a reversible compiler, a new source-search grammar, model training,
or bytecode-similarity retrieval.

## Storage

```text
notes/research/history/
├── cases/
│   └── <function>.md
└── vocabularies/
    └── <topic>.md
```

### Cases: extremely short

The filename identifies the function. Each case contains only three fields:

```markdown
Taxonomy Tag: loop-induction

Failure Mode: Loop effects matched, but initialization order differed.

Eventual Solution: Replace the explicit recurrence with a named affine
expression computed from the loop index.
```

This is an illustrative format, not a newly reconstructed case. Multiple tags
may be assigned where useful.

The historian reconstructs the longer story to establish these statements, but
does not save the entire narrative into the case. Record a concrete failure and
a concrete successful change, not generic advice. Necessary prerequisites must
survive the compression: do not credit the last edit alone when success depended
on an earlier declaration, type, or structural correction.

### Vocabularies: longer explanations

Vocabulary files define the canonical tags and can contain:

- meanings and application guidance;
- distinctions from related tags;
- aliases;
- examples or links to cases;
- relevant compiler, platform, or SDK limitations.

Tags may describe function classifications, observed problems, or successful
strategies. Do not attempt to prescribe a complete hierarchy in advance.

## Historian task

Input:

- one selected, successfully decompiled function;
- the root of the project's conversation histories;
- the existing vocabularies and case bank;
- available source and verification artifacts needed to establish the outcome.

The question is: **How was this function solved?**

The historian should:

1. Find the successful attempt and its recorded verification, not merely a
   statement claiming success.
2. Trace the winning candidate's ancestry, including relevant earlier changes
   and attempts in other sessions.
3. Identify meaningful unsuccessful approaches and the successful transition.
4. Distinguish observed results from the original agent's explanations and the
   historian's own inferences.
5. Decide whether the result is worth retaining as a case.
6. Write the three-field case and reuse or extend the vocabulary as needed.

The task can legitimately end with **no useful case**. Do not invent a lesson
because a function was assigned to the historian.

Identical compiled outputs can help recognize repeated experiments, but retain
the distinction between their source forms: identical output now does not prove
identical behavior after subsequent edits. A bounded failed search establishes
failure in that domain and context, not impossibility for all clean C.

The historian must not manufacture missing source snapshots or causal evidence.
A verified before/after distinction is useful even when its compiler mechanism
remains uncertain.

## Evolving the taxonomy

The historian may create new taxonomy, but must first consult what exists.

Guidance:

1. Reuse an existing tag when its definition fits; match meaning rather than
   wording.
2. Do not force a case into an unsuitable category.
3. Add a tag only for a useful distinction. Explain what future retrieval
   question it helps answer and how it differs from nearby tags.
4. Describe evidence rather than asserting an unverified cause. For example,
   changing a recurrence into an affine expression is an observable edit;
   claiming that it repaired a particular optimizer mechanism needs evidence.
5. Prefer reusable concepts over function names, addresses, or game-specific
   labels, unless that specificity matters.
6. Let actual cases drive growth. One case can justify a tag, but do not invent
   a hierarchy of hypothetical sibling tags.
7. Define new tags, rather than adding unexplained names.

Later consolidation can use aliases so that terminology improves without
requiring every historical case to be rewritten immediately. Searches should
resolve those aliases.

## Selecting case functions

Do not reconstruct every function. Select by difficulty encountered during the
attempt, not apparent function complexity. Small straight-line functions can
contain valuable cases; complex-looking functions can match immediately.

### Stage 1: shortlist costly successful attempts

Start with functions that reached a verified, admissible match and show one or
more of:

- substantial time before the first match;
- several distinct failed source candidates;
- abandonment followed by a later successful revisit.

Five minutes is a possible initial time threshold, not a permanent rule. Count
investigation time before the match, rather than post-match integration or
verification delays. Account for inactivity where the record permits it.

Raw compiler-call counts are not sufficient: repeated spellings may compile
identically, and a cheap automated batch can evaluate many candidates without
corresponding agent effort.

Explicit byte matches blocked by source policy are not successful clean-source
cases. Unmatched attempts do not fit the initial format's "Eventual Solution"
field and are outside the first collection pass.

### Stage 2: retain informative cases

Keep a case when the history supports a concrete contrast:

> The agent was stuck with this construction or assumption. Changing this
> particular thing produced the match.

Reject cases where:

- the first meaningful reconstruction matched;
- the delay was mostly setup trouble or inactivity;
- the only correction was an ordinary typo;
- the evidence is insufficient to identify the successful change.

A proven causal explanation is not required; an evidenced successful transition
is sufficient.

### Avoid redundant collection

An additional case is valuable when it introduces a strategy, demonstrates it
in a different situation, clarifies its limitations, or supplies useful
independent confirmation. Do not retain many interchangeable trivial examples
merely because they exist.

Start with the **10–20 most expensive successfully matched functions**, allowing
the historian to discard uninformative ones. Use that initial collection to grow
the vocabulary before broadening selection.

## Retrieval tools

Two capabilities are sufficient initially:

1. **Retrieve known tags:** return canonical tags and short definitions, with
   access to longer vocabulary explanations.
2. **Search cases by known tags:** return the compact three-field records
   directly, rather than requiring a separate file read for every result.

Support alias resolution and report unknown tags explicitly. Exact query syntax
and multi-tag matching semantics remain implementation decisions.

Observable function classifications can eventually be supplied from existing
analysis, while historical problem and strategy tags come from the historian.
The matching agent should not have to maintain the taxonomy or adopt a new
experiment protocol.

Tags narrow the reading; cases supply the precedent. Sharing tags does not
prove that the same repair will work.

## Cross-game reuse

The bank may extend beyond this game, but portability belongs to individual
strategies, not the collection as a whole. Compiler-specific behavior depends
on compiler configuration; ABI and SDK idioms have their own scope; layouts and
global ownership may remain game specific.

Keep those limitations in vocabulary guidance rather than assuming a strategy
is universal. Target-only byte fingerprints and speculative instruction
normalization are not the retrieval basis: relevance concerns the unsuccessful
candidate and its mismatch, not merely resemblance between target functions.

## Initial validation

The first milestone is a small, coherent collection of genuinely informative
cases and usable vocabulary—not comprehensive history coverage.

Then assess whether retrieval reduces time, repeated unsuccessful approaches,
or model interactions on other functions. Do not count merely generating more
analysis as success. Comparisons should account for existing matched-source
retrieval, and avoid treating close family duplicates as evidence of broad
generalization. A later cross-game test should hold out an entire game.

## Background

The motivating session analysis is recorded in
[the session-analysis notes](../notes/research/session-analysis/README.md).
