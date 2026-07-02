import {
  RETRIEVAL_LIMITS,
  type SourcePreviewLine,
} from '@/lib/shelves/retrieval/contracts'

export interface SlicedSource {
  readonly totalLines: number
  readonly lineStart: number
  readonly lineEnd: number
  readonly truncatedByLineLimit: boolean
  readonly lines: readonly SourcePreviewLine[]
}

/**
 * Pure, deterministic slice of already-fetched text. Clamps the requested
 * range to the file, caps the preview at `maxPreviewLines`, and truncates
 * individual lines at `maxLineLengthChars`. A null range previews the top of
 * the file.
 */
export function sliceSourceLines(
  text: string,
  lineStart: number | null,
  lineEnd: number | null,
  limits: {
    readonly maxPreviewLines: number
    readonly maxLineLengthChars: number
  } = RETRIEVAL_LIMITS
): SlicedSource {
  const allLines = text.split(/\r\n|\r|\n/)
  // A trailing newline produces one empty phantom entry; drop it.
  if (allLines.length > 1 && allLines[allLines.length - 1] === '') {
    allLines.pop()
  }
  const totalLines = allLines.length

  const requestedStart =
    lineStart !== null ? Math.min(Math.max(lineStart, 1), totalLines) : 1
  const requestedEnd =
    lineEnd !== null
      ? Math.min(Math.max(lineEnd, requestedStart), totalLines)
      : lineStart !== null
        ? requestedStart
        : totalLines

  const cappedEnd = Math.min(
    requestedEnd,
    requestedStart + limits.maxPreviewLines - 1
  )

  const lines: SourcePreviewLine[] = []
  for (let number = requestedStart; number <= cappedEnd; number++) {
    const raw = allLines[number - 1] ?? ''
    const truncated = raw.length > limits.maxLineLengthChars
    lines.push({
      number,
      text: truncated ? raw.slice(0, limits.maxLineLengthChars) : raw,
      truncated,
    })
  }

  return {
    totalLines,
    lineStart: requestedStart,
    lineEnd: cappedEnd,
    truncatedByLineLimit: cappedEnd < requestedEnd,
    lines,
  }
}
