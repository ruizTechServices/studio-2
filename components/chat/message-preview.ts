export const MESSAGE_PREVIEW_CHARACTER_LIMIT = 320

export function shouldShowMessageExpansion(content: string): boolean {
  return content.length > MESSAGE_PREVIEW_CHARACTER_LIMIT
}
