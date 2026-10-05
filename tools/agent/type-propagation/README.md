# Original-code type propagation

This is the bounded inference layer used by `prepareFunction`, not the ranked
worklist graph. It never edits live source or publishes declarations.

## Pipeline

- `graph.ts`: container-qualified original spans, direct/tail/incoming edges,
  address-taking selection hints, witnessed callback data, recursive expansion.
  Missing assembly is decoded from original bytes (`assembly.ts`).
- `summary.ts`: CFG/SSA entry word slots, unread holes, post-delay-slot arguments,
  incoming/outgoing stack words, returns, phis and exact-width memory relations.
  Calls, opaque writes and potentially aliasing stores break memory proofs.
- `seeds.ts`: SDK declarations, or AST-inspected defining C recompiled and checked
  by the relocated-byte oracle. Generated signatures are never witnesses.
- `c-types.ts`: pinned tree-sitter type/declarator inspection, lexical-scope-aware
  parameter reads, public/private type identity, and fixed-scalar field layout.
  No regex C declaration parser or source-body repair.
- `solve.ts`: deterministic SCC ordering and a finite monotone fact worklist.
  Argument/result edges transport requirements in both directions. Phis transport
  requirements backward, not a union masquerading as a forward universal meet.
  Exact store/load relations transport facts; zero-offset copies share SSA values.
- `inferenceInput`: partial word slots and dependency-complete type carriers for
  native m2c, not fabricated complete prototypes. Read source parameters retain
  their independently verified representation; unused source parameters do not
  establish source arity. Audited signatures remain intact in the report.

Facts carry a seed plus parent-fact/relation references, rather than ever-growing
witness strings. Type-use requirements do not equate all source representations:
casts and separate storage views can reconcile otherwise incompatible uses.
Conflicts retain both witnesses. Constants are polymorphic uses, not shared C
variables. Named public types share declaration identity across callers; private
same-spelled types do not.

An open indirect target set retains per-target conditional facts. A universal
contract meet requires independent compatible contracts for every target and no
unknown remainder. The m2c patch also prevents an open callback parameter from
inheriting one supplied member's *whole* signature. Cosmetic cast unification must
not undo this boundary. An ignored result does not establish `void`.

## Bounds and limits

Defaults (overrides may only reduce them): 96 functions, 65,536 original
instructions, 32 indirect targets, 256 shared-storage dependencies, 200,000
propagation steps, and 1,000,000 original instructions in the incoming-edge index.
Reports preserve frontier, unsupported effects, inputs and consumed work.
Convergence and graph coverage are distinct. Verified leaf contracts stop
irrelevant downstream expansion, without deleting their original edges.

The relation domain is **word-sized**. Wide/by-value/hidden-return ABI forms are
named unsupported rather than guessed. Tail register arguments are recorded;
tail result/stack forwarding is unsupported. Variable/interior-address expressions
are not type equality. Shared storage selects relevant dependencies, but does not
prove an inter-function store/load lifetime. Unaligned/opaque effects remain
visible and block the affected proof. Table membership does not prove index
bounds, immutability, or closure of an externally supplied callback parameter.
Native related-function inference remains bounded to the selected assembly and
four passes; the separate graph solver records its own convergence.

## Artifacts and use

Normal preparation/resume remains unchanged: existing clean C stays primary.
Explicit fresh alternatives use `prepareFunction(name, { alternative: true })`.
The isolated `inferenceView` supports held-out roots/intermediates, a permitted
seed list, missing-leaf controls and disabled graph transfers. Held-out function
declarations are removed from all projected scopes, including generated headers.
No held-out body reaches m2c.

A preparation writes `type-graph.json`, `propagation.json`, `inference.json`,
selected original assembly/data, context, unchanged raw stdout, mechanical wrapper,
compiler/oracle output and the small linked handoff under `build/preparation/`.
Original container bytes/data, seed dependencies, tool sources, vendor patches and
toolchain inputs participate in existing preparation freshness.

```sh
npx tsx tools/diagnostics/typePropagationAcceptance.ts --freeze
npx tsx tools/diagnostics/typePropagationAcceptance.ts --run
npx tsx --test tools/agent/type-propagation.test.ts \
  tools/agent/static-preparation-regressions.test.ts \
  tools/agent/declaration-context.test.ts tools/agent/machine-ir/*.test.ts
make check-all
```

`--freeze` refuses to overwrite an existing freeze. All four reference roots must
byte-match first. Expected facts and permitted contracts are frozen before fresh
alternatives and missing-leaf controls. An older version-1 freeze can contain the
inherited implicit `signed`/`unsigned int` slot-projection bug. Compatibility is
accepted only when the *entire historical digest* still agrees, including unchanged
signature spelling and source/header hash; it is explicitly listed in the report.
The freeze and expected facts are never silently rewritten.

## Delivery state

The multi-hop fixture changes actual raw m2c calls/returns and compiles to exact
relocated forwarding words. AST scope, SCC/reverse flow, open/heterogeneous targets,
stack delay slots, budgets and original five-entry callback-table tests pass.

**The plan's primary acceptance gate is not yet complete.** Open-target isolation
removes erroneous caller-side narrowing in `func_800223D4`, but its ignored callback
result remains unknown. Its fresh raw draft and dependent `func_8002238C` draft
therefore do not compile. Earlier compiling drafts acquired a member-specific
signature and introduced extra narrowing; they are not acceptance evidence.
`ovl_25_func_800BAC28` and `ovl_25_func_800B81B4` compile with the expected controlled
provenance, but mismatch bytes. The reported `ovl_25_func_800B7EB4` reproduction also
remains noncompiling. See the plan's delivery record and generated acceptance report
for the full cohort, smoke results, coverage and remaining frontier.

No candidate has been integrated/finalized. The next bounded capability is justified
partial callable/result representations across open dispatch boundaries (or a proof
of original target-set closure), not a default return type, blanket signature
unification, source rewrite or fabricated uniform callback table.
