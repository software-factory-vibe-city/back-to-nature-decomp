/**
 * align.ts — how much of one token sequence appears, in order, in another.
 *
 * The corpus's second stage. Retrieval finds candidates by rare n-grams, which
 * is fast and approximate; the alignment is what turns a candidate into a
 * finding a reader can check. A cosine is not a finding — "14 of 17 shapes
 * align in order with `ovl_10_func_800B9D24` block 12–18" is one, and it can be
 * wrong in a way somebody can see.
 *
 * Longest common subsequence rather than edit distance, because the claim being
 * made is "this run of shapes occurs here too, in this order", and insertions
 * on either side are exactly what a slightly different loop body looks like.
 */

export interface Alignment {
  /** Length of the longest common subsequence. */
  common: number;
  /** `common / max(len(a), len(b))` — 1 when the sequences are identical. */
  ratio: number;
  /** Index pairs, in order. */
  pairs: Array<[number, number]>;
}

export function align(left: readonly string[], right: readonly string[]): Alignment {
  const rows = left.length;
  const columns = right.length;
  if (rows === 0 || columns === 0) return { common: 0, ratio: 0, pairs: [] };

  const table: Uint32Array[] = Array.from({ length: rows + 1 }, () => new Uint32Array(columns + 1));
  for (let i = rows - 1; i >= 0; i--) {
    for (let j = columns - 1; j >= 0; j--) {
      table[i]![j] = left[i] === right[j]
        ? table[i + 1]![j + 1]! + 1
        : Math.max(table[i + 1]![j]!, table[i]![j + 1]!);
    }
  }

  const pairs: Array<[number, number]> = [];
  let i = 0;
  let j = 0;
  while (i < rows && j < columns) {
    if (left[i] === right[j]) {
      pairs.push([i, j]);
      i++;
      j++;
    } else if (table[i + 1]![j]! >= table[i]![j + 1]!) i++;
    else j++;
  }
  const common = pairs.length;
  return { common, ratio: common / Math.max(rows, columns), pairs };
}

/**
 * Joined with a character no shape token contains, so two different token
 * sequences cannot collide into one n-gram: `["ab","c"]` and `["a","bc"]` are
 * different runs and must index differently.
 */
const SEPARATOR = "\u0001";

/**
 * The n-grams of a token sequence, as strings.
 *
 * Overlapping and ordered, so a shared run of `n` instructions produces a
 * shared token however it is embedded. `n` of 3 is the working size: shorter
 * matches every prologue, longer misses a loop body that differs by one
 * instruction.
 */
export function ngrams(tokens: readonly string[], n = 3): string[] {
  if (tokens.length < n) return tokens.length > 0 ? [tokens.join(SEPARATOR)] : [];
  const out: string[] = [];
  for (let index = 0; index + n <= tokens.length; index++) {
    out.push(tokens.slice(index, index + n).join(SEPARATOR));
  }
  return out;
}
