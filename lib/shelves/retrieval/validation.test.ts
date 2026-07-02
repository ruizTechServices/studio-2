import { describe, expect, it } from 'vitest'

import {
  isValidAssetId,
  isValidCommitSha,
  isValidRepositoryPath,
  isValidRetrievalPointer,
} from '@/lib/shelves/retrieval/validation'

const validPointer = {
  id: '123e4567-e89b-42d3-a456-426614174010',
  sourceOwner: 'owner',
  sourceRepository: 'repository',
  sourceCommitSha: 'a'.repeat(40),
  relativePath: 'components/brand/brand-logo.tsx',
  lineStart: 9,
  lineEnd: 53,
  symbolName: 'BrandLogo',
}

describe('isValidCommitSha', () => {
  it('accepts a 40-hex lowercase sha', () => {
    expect(isValidCommitSha('88c4af34b2818b85166bf01f8ddd92926ded6b9a')).toBe(true)
  })

  it.each([
    ['main'],
    ['88c4af3'],
    ['A'.repeat(40)],
    ['g'.repeat(40)],
    ['a'.repeat(39)],
    ['a'.repeat(41)],
    [null],
    [42],
  ])('rejects %s', (value) => {
    expect(isValidCommitSha(value)).toBe(false)
  })
})

describe('isValidRepositoryPath', () => {
  it('accepts normalized repository-relative paths', () => {
    expect(isValidRepositoryPath('lib/utils.ts')).toBe(true)
    expect(isValidRepositoryPath('a/b/c/d.tsx')).toBe(true)
    expect(isValidRepositoryPath('README.md')).toBe(true)
  })

  it.each([
    ['/absolute/path.ts'],
    ['a\\b.ts'],
    ['../escape.ts'],
    ['a/../b.ts'],
    ['a/./b.ts'],
    ['a//b.ts'],
    ['trailing/'],
    [''],
    ['a'.repeat(513)],
    ['bad\u0000name.ts'],
    ['bad\nname.ts'],
    [null],
  ])('rejects hostile or malformed path %j', (value) => {
    expect(isValidRepositoryPath(value)).toBe(false)
  })
})

describe('isValidRetrievalPointer', () => {
  it('accepts a valid pointer', () => {
    expect(isValidRetrievalPointer(validPointer)).toBe(true)
  })

  it('accepts a pointer without a line range', () => {
    expect(
      isValidRetrievalPointer({ ...validPointer, lineStart: null, lineEnd: null })
    ).toBe(true)
  })

  it.each([
    ['id', 'not-a-uuid'],
    ['sourceOwner', 'Bad_Owner!'],
    ['sourceOwner', ''],
    ['sourceRepository', 'has space'],
    ['sourceCommitSha', 'main'],
    ['relativePath', '../etc/passwd'],
    ['lineStart', 0],
    ['lineEnd', 8],
    ['lineStart', null],
    ['symbolName', ''],
  ])('rejects a pointer with invalid %s', (field, value) => {
    expect(isValidRetrievalPointer({ ...validPointer, [field]: value })).toBe(false)
  })

  it('rejects non-objects', () => {
    expect(isValidRetrievalPointer(null)).toBe(false)
    expect(isValidRetrievalPointer([])).toBe(false)
    expect(isValidRetrievalPointer('pointer')).toBe(false)
  })
})

describe('isValidAssetId', () => {
  it('accepts uuids and rejects everything else', () => {
    expect(isValidAssetId(validPointer.id)).toBe(true)
    expect(isValidAssetId('123')).toBe(false)
    expect(isValidAssetId(undefined)).toBe(false)
  })
})
