import { describe, expect, it } from 'vitest'

import {
  MESSAGE_PREVIEW_CHARACTER_LIMIT,
  shouldShowMessageExpansion,
} from './message-preview'

describe('shouldShowMessageExpansion', () => {
  it('shows expansion only for long messages', () => {
    expect(shouldShowMessageExpansion('short response')).toBe(false)
    expect(
      shouldShowMessageExpansion(
        'x'.repeat(MESSAGE_PREVIEW_CHARACTER_LIMIT + 1)
      )
    ).toBe(true)
  })
})
