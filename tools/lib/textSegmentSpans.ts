export interface SegmentSpan {
  start: number;
  end: number;
}

/** Build half-open spans from consecutive, distinct segment starts. */
export function buildSegmentSpans(segmentRoms: Iterable<number>): SegmentSpan[] {
  const starts = [...new Set(segmentRoms)].sort((a, b) => a - b);
  const spans: SegmentSpan[] = [];

  for (let i = 0; i + 1 < starts.length; i++) {
    spans.push({ start: starts[i], end: starts[i + 1] });
  }

  return spans;
}

/** Segment starts remain valid boundaries; only interior addresses are covered. */
export function isStrictlyInsideSegmentSpan(
  rom: number,
  spans: readonly SegmentSpan[]
): boolean {
  return spans.some((span) => span.start < rom && rom < span.end);
}
