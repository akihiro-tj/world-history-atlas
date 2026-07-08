export type ByteRange = { offset?: number; length?: number; suffix?: number };

export type ResolvedByteRange = { start: number; end: number };

export function resolveByteRange(
  range: ByteRange | undefined,
  size: number,
): ResolvedByteRange | undefined {
  if (range === undefined) return undefined;

  if (range.suffix !== undefined) {
    const start = Math.max(size - range.suffix, 0);
    return { start, end: size - 1 };
  }

  const start = range.offset ?? 0;
  const end =
    range.length !== undefined
      ? Math.min(start + range.length - 1, size - 1)
      : size - 1;
  return { start, end };
}

export function buildContentRangeHeader(
  range: ResolvedByteRange,
  size: number,
): string {
  return `bytes ${range.start}-${range.end}/${size}`;
}

export function byteRangeLength(range: ResolvedByteRange): number {
  return range.end - range.start + 1;
}
