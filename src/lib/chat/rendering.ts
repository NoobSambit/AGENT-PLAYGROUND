import type { MessageRenderBlock, MessageRenderData } from '@/types/database'

const orderedListMarker = /^\d+\.\s+/
const unorderedListMarker = /^[-*]\s+/
const headingMarker = /^(#{1,3})\s+(.+)$/
const codeFenceMarker = /^```(\S+)?\s*$/

function collapseListSpacing(content: string): string {
  let next = content
  let previous = ''

  while (next !== previous) {
    previous = next
    next = next
      .replace(/(\n\d+\.\s[^\n]+)\n[ \t]*\n(?=\d+\.\s)/g, '$1\n')
      .replace(/(\n[-*]\s[^\n]+)\n[ \t]*\n(?=[-*]\s)/g, '$1\n')
  }

  return next
}

export function normalizeAssistantMarkdown(content: string): string {
  const normalized = content.replace(/\r\n/g, '\n').trim()
  if (!normalized) {
    return ''
  }

  return collapseListSpacing(
    normalized
      .replace(/\n{3,}/g, '\n\n')
      .replace(/[ \t]+\n/g, '\n')
  )
}

function isListContinuation(line: string): boolean {
  const trimmed = line.trim()
  if (!trimmed) {
    return false
  }

  return !headingMarker.test(trimmed)
    && !orderedListMarker.test(trimmed)
    && !unorderedListMarker.test(trimmed)
    && !trimmed.startsWith('> ')
    && !codeFenceMarker.test(trimmed)
}

function parseList(
  lines: string[],
  startIndex: number,
  listType: 'ordered_list' | 'unordered_list'
): { block: MessageRenderBlock; nextIndex: number } {
  const items: string[] = []
  const marker = listType === 'ordered_list' ? orderedListMarker : unorderedListMarker
  let index = startIndex
  let currentItem = ''

  while (index < lines.length) {
    const trimmed = lines[index].trim()

    if (!trimmed) {
      const nextTrimmed = lines[index + 1]?.trim() || ''
      if (marker.test(nextTrimmed)) {
        index += 1
        continue
      }
      break
    }

    if (marker.test(trimmed)) {
      if (currentItem) {
        items.push(currentItem.trim())
      }
      currentItem = trimmed.replace(marker, '').trim()
      index += 1
      continue
    }

    if (isListContinuation(trimmed) && currentItem) {
      currentItem = `${currentItem} ${trimmed}`.trim()
      index += 1
      continue
    }

    break
  }

  if (currentItem) {
    items.push(currentItem.trim())
  }

  return {
    block: {
      type: listType,
      items,
    },
    nextIndex: index,
  }
}

export function parseMessageBlocks(content: string): MessageRenderBlock[] {
  const normalized = normalizeAssistantMarkdown(content)
  if (!normalized) {
    return []
  }

  const lines = normalized.split('\n')
  const blocks: MessageRenderBlock[] = []
  let index = 0

  while (index < lines.length) {
    const trimmed = lines[index].trim()

    if (!trimmed) {
      index += 1
      continue
    }

    const fenceMatch = trimmed.match(codeFenceMarker)
    if (fenceMatch) {
      index += 1
      const codeLines: string[] = []
      while (index < lines.length && !lines[index].trim().startsWith('```')) {
        codeLines.push(lines[index])
        index += 1
      }
      if (index < lines.length) {
        index += 1
      }
      blocks.push({
        type: 'code',
        language: fenceMatch[1],
        code: codeLines.join('\n'),
      })
      continue
    }

    const headingMatch = trimmed.match(headingMarker)
    if (headingMatch) {
      blocks.push({
        type: 'heading',
        level: Math.min(headingMatch[1].length, 3) as 1 | 2 | 3,
        text: headingMatch[2].trim(),
      })
      index += 1
      continue
    }

    if (trimmed.startsWith('> ')) {
      const quoteLines: string[] = [trimmed.slice(2).trim()]
      index += 1
      while (index < lines.length && lines[index].trim().startsWith('> ')) {
        quoteLines.push(lines[index].trim().slice(2).trim())
        index += 1
      }
      blocks.push({ type: 'blockquote', text: quoteLines.join('\n') })
      continue
    }

    if (orderedListMarker.test(trimmed)) {
      const parsed = parseList(lines, index, 'ordered_list')
      blocks.push(parsed.block)
      index = parsed.nextIndex
      continue
    }

    if (unorderedListMarker.test(trimmed)) {
      const parsed = parseList(lines, index, 'unordered_list')
      blocks.push(parsed.block)
      index = parsed.nextIndex
      continue
    }

    const paragraphLines: string[] = [trimmed]
    index += 1

    while (index < lines.length) {
      const nextTrimmed = lines[index].trim()
      if (
        !nextTrimmed ||
        codeFenceMarker.test(nextTrimmed) ||
        headingMarker.test(nextTrimmed) ||
        nextTrimmed.startsWith('> ') ||
        orderedListMarker.test(nextTrimmed) ||
        unorderedListMarker.test(nextTrimmed)
      ) {
        break
      }

      paragraphLines.push(nextTrimmed)
      index += 1
    }

    blocks.push({
      type: 'paragraph',
      text: paragraphLines.join(' '),
    })
  }

  return blocks
}

export function buildMessageRenderData(content: string): MessageRenderData {
  return {
    version: 1,
    format: 'blocks-v1',
    sourceFormat: 'markdown-v1',
    blocks: parseMessageBlocks(content),
  }
}
