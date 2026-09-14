/**
 * Recipe generators — small, natural C programs over bounded dimensions.
 *
 * The compiler and its source are available, and until now they have been used
 * only to *reject* guesses: write a candidate, compile it, compare. That is a
 * one-bit channel. Compiling deliberately chosen programs and indexing what
 * they produce turns the same compiler into training data — a lookup from a
 * shape of machine words back to a source construction that realizes it.
 *
 * What a recipe is, and is not. A recipe is a parameterized *source*
 * construction with the dimensions that change its code generation named as
 * parameters: which loop form, which result form, which widths, which
 * signedness. It is not a claim about the original program. Two recipes whose
 * outputs coincide are both kept, because identical final words do not prove
 * identical earlier compiler state, and the one that matters for the next
 * function may be the other one.
 *
 * The dimensions here are the ones the plan names, in the order it names them:
 * loop forms first, because the loop constructor is where the representation
 * work lands; then result forms, control forms and value widths.
 */

export interface RecipeParameters {
  [dimension: string]: string | number | boolean;
}

export interface Recipe {
  /** Stable identity: family plus its parameter values. */
  id: string;
  /** The construction this belongs to — `counted-loop`, `switch`, and so on. */
  family: string;
  parameters: RecipeParameters;
  /** The complete translation unit, ready for the production compiler. */
  source: string;
  /** The function the unit defines; its words are what gets indexed. */
  functionName: string;
  /** What a reader should take from a hit on this recipe. */
  note: string;
}

/** The prelude every generated unit shares: the project's own scalar types. */
const PRELUDE = [
  "typedef signed char s8;",
  "typedef unsigned char u8;",
  "typedef signed short s16;",
  "typedef unsigned short u16;",
  "typedef signed int s32;",
  "typedef unsigned int u32;",
  "",
].join("\n");

const unit = (body: string[]): string => `${PRELUDE}${body.join("\n")}\n`;

const identify = (family: string, parameters: RecipeParameters): string =>
  `${family}__${Object.entries(parameters).map(([key, value]) => `${key}-${value}`).join("_")}`;

/* ---- dimensions ------------------------------------------------------------- */

const WIDTHS = [
  { type: "s8", pointer: "s8 *" },
  { type: "u8", pointer: "u8 *" },
  { type: "s16", pointer: "s16 *" },
  { type: "u16", pointer: "u16 *" },
  { type: "s32", pointer: "s32 *" },
] as const;

/* ---- loop forms -------------------------------------------------------------- */

/**
 * The four loop forms one counted traversal can be written in.
 *
 * They are genuinely different source constructions, not spellings: an index
 * loop reloads the base and scales, a cursor loop advances a pointer, a
 * count-down loop compares against zero, and a do-while has no entry guard.
 * Which one the original used is visible in the emitted code, and this is the
 * table that reads it back.
 */
function countedLoops(): Recipe[] {
  const recipes: Recipe[] = [];
  for (const width of WIDTHS) {
    for (const form of ["index", "cursor", "countdown", "do-while"] as const) {
      const parameters: RecipeParameters = { form, element: width.type };
      const name = "recipe_counted";
      const body =
        form === "index" ? [
          `s32 ${name}(${width.pointer} data, s32 count) {`,
          "    s32 total = 0;",
          "    s32 i;",
          "    for (i = 0; i < count; i++) {",
          "        total += data[i];",
          "    }",
          "    return total;",
          "}",
        ] : form === "cursor" ? [
          `s32 ${name}(${width.pointer} data, s32 count) {`,
          "    s32 total = 0;",
          `    ${width.pointer}end = data + count;`,
          "    while (data < end) {",
          "        total += *data++;",
          "    }",
          "    return total;",
          "}",
        ] : form === "countdown" ? [
          `s32 ${name}(${width.pointer} data, s32 count) {`,
          "    s32 total = 0;",
          "    while (count-- > 0) {",
          "        total += *data++;",
          "    }",
          "    return total;",
          "}",
        ] : [
          `s32 ${name}(${width.pointer} data, s32 count) {`,
          "    s32 total = 0;",
          "    s32 i = 0;",
          "    do {",
          "        total += data[i];",
          "        i++;",
          "    } while (i < count);",
          "    return total;",
          "}",
        ];
      recipes.push({
        id: identify("counted-loop", parameters),
        family: "counted-loop",
        parameters,
        source: unit(body),
        functionName: name,
        note: `a counted accumulation written as a ${form} loop over ${width.type}`,
      });
    }
  }
  return recipes;
}

/**
 * Loops whose data is a global rather than a parameter.
 *
 * The distinction is not cosmetic: a parameter arrives in a register, while a
 * global's address is materialised by a `lui`/`addiu` pair and its base is a
 * scratch register. Every real accumulation over a fixed table has the second
 * shape, and a catalogue of only the first answers "no indexed construction
 * produces these words" for all of them.
 *
 * The down-counter forms are here for the same reason: `while (--n >= 0)`
 * compiles to a `bgez` against the counter, which no `i < n` loop produces.
 */
function globalLoops(): Recipe[] {
  const recipes: Recipe[] = [];
  for (const width of WIDTHS) {
    for (const form of ["index", "cursor", "countdown-signed"] as const) {
      const parameters: RecipeParameters = { form, element: width.type, storage: "global" };
      const name = "recipe_global_loop";
      const body = form === "index" ? [
        `extern ${width.type} table[];`,
        "",
        `s32 ${name}(s32 count) {`,
        "    s32 total = 0;",
        "    s32 i;",
        "    for (i = 0; i < count; i++) total += table[i];",
        "    return total;",
        "}",
      ] : form === "cursor" ? [
        `extern ${width.type} table[];`,
        "",
        `s32 ${name}(s32 count) {`,
        "    s32 total = 0;",
        `    ${width.pointer}p = table;`,
        "    while (count-- > 0) total += *p++;",
        "    return total;",
        "}",
      ] : [
        `extern ${width.type} table[];`,
        "",
        `s32 ${name}(s32 count) {`,
        "    s32 total = 0;",
        `    ${width.pointer}p = table;`,
        "    s32 remaining = count;",
        "    while (--remaining >= 0) total += *p++;",
        "    return total;",
        "}",
      ];
      recipes.push({
        id: identify("global-loop", parameters),
        family: "global-loop",
        parameters,
        source: unit(body),
        functionName: name,
        note: `an accumulation over a global ${width.type} table, written as a ${form} loop`,
      });
    }
  }
  return recipes;
}

/** A sentinel-terminated walk: the shape a table scan with a terminator has. */
function sentinelLoops(): Recipe[] {
  const recipes: Recipe[] = [];
  for (const sentinel of [-1, 0]) {
    for (const result of ["early-return", "break-flag"] as const) {
      const parameters: RecipeParameters = { sentinel, result };
      const name = "recipe_sentinel";
      const body = result === "early-return" ? [
        `s32 ${name}(s16 *table, s16 wanted) {`,
        "    s32 i;",
        `    for (i = 0; table[i] != ${sentinel}; i++) {`,
        "        if (table[i] == wanted) return i;",
        "    }",
        "    return -1;",
        "}",
      ] : [
        `s32 ${name}(s16 *table, s16 wanted) {`,
        "    s32 i;",
        "    s32 found = -1;",
        `    for (i = 0; table[i] != ${sentinel}; i++) {`,
        "        if (table[i] == wanted) { found = i; break; }",
        "    }",
        "    return found;",
        "}",
      ];
      recipes.push({
        id: identify("sentinel-loop", parameters),
        family: "sentinel-loop",
        parameters,
        source: unit(body),
        functionName: name,
        note: `a sentinel-terminated search ending on ${sentinel}, returning by ${result}`,
      });
    }
  }
  return recipes;
}

/** A fixed-stride record scan: the class the existing constructor covers. */
function recordScans(): Recipe[] {
  const recipes: Recipe[] = [];
  for (const stride of [4, 8, 16, 40]) {
    for (const columns of [1, 2]) {
      const parameters: RecipeParameters = { stride, columns };
      const name = "recipe_scan";
      const body = [
        "typedef struct {",
        `    s16 key[${columns}];`,
        `    char pad[${stride - 2 * columns}];`,
        "} Record;",
        "",
        `s32 ${name}(Record *records, s32 count, s16 wanted) {`,
        "    s32 i;",
        "    for (i = 0; i < count; i++) {",
        "        if (records[i].key[0] == wanted) return i;",
        "    }",
        "    return -1;",
        "}",
      ];
      recipes.push({
        id: identify("record-scan", parameters),
        family: "record-scan",
        parameters,
        source: unit(body),
        functionName: name,
        note: `a scan of ${stride}-byte records comparing the first of ${columns} key(s)`,
      });
    }
  }
  return recipes;
}

/* ---- control forms ------------------------------------------------------------ */

/** Dense dispatch: how many cases before the backend uses a jump table. */
function switchForms(): Recipe[] {
  const recipes: Recipe[] = [];
  for (const cases of [3, 5, 8, 12]) {
    for (const shape of ["switch", "if-chain"] as const) {
      const parameters: RecipeParameters = { cases, shape };
      const name = "recipe_dispatch";
      const arms: string[] = [];
      if (shape === "switch") {
        arms.push("    switch (selector) {");
        for (let index = 0; index < cases; index++) arms.push(`    case ${index}: return ${index * 7 + 1};`);
        arms.push("    default: return -1;");
        arms.push("    }");
      } else {
        for (let index = 0; index < cases; index++) arms.push(`    if (selector == ${index}) return ${index * 7 + 1};`);
        arms.push("    return -1;");
      }
      recipes.push({
        id: identify("dispatch", parameters),
        family: "dispatch",
        parameters,
        source: unit([`s32 ${name}(s32 selector) {`, ...arms, "}"]),
        functionName: name,
        note: `${cases} dense cases written as a ${shape}`,
      });
    }
  }
  return recipes;
}

/** Two arms that both end in the same work: the shared-tail question. */
function sharedTails(): Recipe[] {
  const recipes: Recipe[] = [];
  for (const form of ["shared", "duplicated"] as const) {
    const parameters: RecipeParameters = { form };
    const name = "recipe_tail";
    const body = form === "shared" ? [
      `s32 ${name}(s32 selector, s32 *out) {`,
      "    s32 value;",
      "    if (selector > 0) value = selector * 3;",
      "    else value = selector + 11;",
      "    *out = value;",
      "    return value;",
      "}",
    ] : [
      `s32 ${name}(s32 selector, s32 *out) {`,
      "    if (selector > 0) {",
      "        *out = selector * 3;",
      "        return selector * 3;",
      "    }",
      "    *out = selector + 11;",
      "    return selector + 11;",
      "}",
    ];
    recipes.push({
      id: identify("shared-tail", parameters),
      family: "shared-tail",
      parameters,
      source: unit(body),
      functionName: name,
      note: `two arms whose common work is ${form}`,
    });
  }
  return recipes;
}

/* ---- arithmetic the backend expands ------------------------------------------- */

/** Constant divisors: the magic-multiply and shift forms, by divisor. */
function divisions(): Recipe[] {
  const recipes: Recipe[] = [];
  for (const divisor of [2, 3, 5, 8, 10, 16, 100]) {
    for (const signedness of ["s32", "u32"] as const) {
      for (const operation of ["divide", "remainder"] as const) {
        const parameters: RecipeParameters = { divisor, signedness, operation };
        const name = "recipe_divide";
        const operator = operation === "divide" ? "/" : "%";
        recipes.push({
          id: identify("constant-divisor", parameters),
          family: "constant-divisor",
          parameters,
          source: unit([
            `${signedness} ${name}(${signedness} value) {`,
            `    return value ${operator} ${divisor};`,
            "}",
          ]),
          functionName: name,
          note: `${signedness} ${operation} by ${divisor}`,
        });
      }
    }
  }
  return recipes;
}

/** A variable divisor, which is where the trap packet comes from. */
function variableDivisions(): Recipe[] {
  const recipes: Recipe[] = [];
  for (const signedness of ["s32", "u32"] as const) {
    const parameters: RecipeParameters = { signedness };
    const name = "recipe_vardivide";
    recipes.push({
      id: identify("variable-divisor", parameters),
      family: "variable-divisor",
      parameters,
      source: unit([
        `${signedness} ${name}(${signedness} numerator, ${signedness} denominator) {`,
        "    return numerator / denominator;",
        "}",
      ]),
      functionName: name,
      note: `${signedness} division by a variable — emits the compiler's trap packet`,
    });
  }
  return recipes;
}

/** Constant multiplication: the shift-and-add expansions, by factor. */
function multiplications(): Recipe[] {
  const recipes: Recipe[] = [];
  for (const factor of [3, 5, 6, 7, 10, 12, 24, 40, 0xb0]) {
    const parameters: RecipeParameters = { factor };
    const name = "recipe_multiply";
    recipes.push({
      id: identify("constant-multiply", parameters),
      family: "constant-multiply",
      parameters,
      source: unit([`s32 ${name}(s32 value) {`, `    return value * ${factor};`, "}"]),
      functionName: name,
      note: `multiplication by ${factor}, as the backend expands it`,
    });
  }
  return recipes;
}

/* ---- aggregates --------------------------------------------------------------- */

/** Structure assignment by size: where the inline block move appears. */
function aggregateCopies(): Recipe[] {
  const recipes: Recipe[] = [];
  for (const bytes of [4, 8, 12, 16, 32, 64]) {
    for (const form of ["assign", "member-wise"] as const) {
      const parameters: RecipeParameters = { bytes, form };
      const name = "recipe_copy";
      const words = bytes / 4;
      const body = form === "assign" ? [
        `typedef struct { s32 word[${words}]; } Block;`,
        "",
        `void ${name}(Block *destination, Block *source) {`,
        "    *destination = *source;",
        "}",
      ] : [
        `typedef struct { s32 word[${words}]; } Block;`,
        "",
        `void ${name}(Block *destination, Block *source) {`,
        "    s32 i;",
        `    for (i = 0; i < ${words}; i++) destination->word[i] = source->word[i];`,
        "}",
      ];
      recipes.push({
        id: identify("aggregate-copy", parameters),
        family: "aggregate-copy",
        parameters,
        source: unit(body),
        functionName: name,
        note: `${bytes}-byte structure copy written as a ${form === "assign" ? "whole-object assignment" : "member-wise loop"}`,
      });
    }
  }
  return recipes;
}

/* ---- storage origins ------------------------------------------------------------ */

/**
 * Where an accessed object lives.
 *
 * The plan calls this out specifically: a standalone array, a member array,
 * and an embedded parent object produce different addressing, and the
 * difference is exactly the origin question the reconstruction has to answer.
 */
function origins(): Recipe[] {
  const recipes: Recipe[] = [];
  for (const origin of ["standalone", "member", "embedded"] as const) {
    const parameters: RecipeParameters = { origin };
    const name = "recipe_origin";
    const body = origin === "standalone" ? [
      "extern s16 table[];",
      "",
      `s16 ${name}(s32 index) { return table[index]; }`,
    ] : origin === "member" ? [
      "typedef struct { char pad[0x28]; s16 table[16]; } Holder;",
      "extern Holder holder;",
      "",
      `s16 ${name}(s32 index) { return holder.table[index]; }`,
    ] : [
      "typedef struct { s16 table[16]; } Inner;",
      "typedef struct { char pad[0x28]; Inner inner; } Outer;",
      "extern Outer outer;",
      "",
      `s16 ${name}(s32 index) { return outer.inner.table[index]; }`,
    ];
    recipes.push({
      id: identify("origin", parameters),
      family: "origin",
      parameters,
      source: unit(body),
      functionName: name,
      note: `a halfword table reached as a ${origin} object`,
    });
  }
  return recipes;
}

/* ---- the catalogue ------------------------------------------------------------- */

/**
 * Every recipe the atlas generates.
 *
 * Deliberately bounded. The plan's instruction is explicit: begin with the
 * division and copy packets and the loop and address forms actually seen, and
 * do not first grid every language construct. Growing this list is cheap; a
 * grid nobody queries is not.
 */
export function allRecipes(): Recipe[] {
  return [
    ...countedLoops(),
    ...globalLoops(),
    ...sentinelLoops(),
    ...recordScans(),
    ...switchForms(),
    ...sharedTails(),
    ...divisions(),
    ...variableDivisions(),
    ...multiplications(),
    ...aggregateCopies(),
    ...origins(),
  ];
}

/** The families, for a caller that wants to build or query a subset. */
export function recipeFamilies(): string[] {
  return [...new Set(allRecipes().map((recipe) => recipe.family))].sort();
}
