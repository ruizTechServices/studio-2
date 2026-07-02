import { describe, expect, it } from 'vitest'

import { sliceSourceLines } from '@/lib/shelves/retrieval/line-slicer'

const tenLines = Array.from({ length: 10 }, (_, index) => `line ${index + 1}`).join('\n')

describe('sliceSourceLines', () => {
  it('slices an explicit line range with 1-based numbering', () => {
    const slice = sliceSourceLines(tenLines, 3, 5)
    expect(slice.totalLines).toBe(10)
    expect(slice.lineStart).toBe(3)
    expect(slice.lineEnd).toBe(5)
    expect(slice.truncatedByLineLimit).toBe(false)
    expect(slice.lines.map((line) => line.text)).toEqual(['line 3', 'line 4', 'line 5'])
    expect(slice.lines[0].number).toBe(3)
  })

  it('previews the top of the file when no range is stored', () => {
    const slice = sliceSourceLines(tenLines, null, null)
    expect(slice.lineStart).toBe(1)
    expect(slice.lineEnd).toBe(10)
    expect(slice.lines).toHaveLength(10)
  })

  it('caps the preview at maxPreviewLines and flags the truncation', () => {
    const big = Array.from({ length: 500 }, (_, index) => `l${index + 1}`).join('\n')
    const slice = sliceSourceLines(big, 1, 500)
    expect(slice.lines).toHaveLength(200)
    expect(slice.lineEnd).toBe(200)
    expect(slice.truncatedByLineLimit).toBe(true)
  })

  it('clamps out-of-range requests to the file bounds', () => {
    const slice = sliceSourceLines(tenLines, 8, 99)
    expect(slice.lineStart).toBe(8)
    expect(slice.lineEnd).toBe(10)
    expect(slice.lines).toHaveLength(3)
  })

  it('truncates over-long lines and flags them', () => {
    const slice = sliceSourceLines('x'.repeat(600), 1, 1)
    expect(slice.lines[0].truncated).toBe(true)
    expect(slice.lines[0].text).toHaveLength(500)
  })

  it('handles CRLF endings and trailing newlines', () => {
    const slice = sliceSourceLines('a\r\nb\r\nc\r\n', null, null)
    expect(slice.totalLines).toBe(3)
    expect(slice.lines.map((line) => line.text)).toEqual(['a', 'b', 'c'])
  })

  it('handles an empty file', () => {
    const slice = sliceSourceLines('', null, null)
    expect(slice.totalLines).toBe(1)
    expect(slice.lines).toEqual([{ number: 1, text: '', truncated: false }])
  })
})
