'use client'

import type { ReactNode } from 'react'
import { buildMessageRenderData } from '@/lib/chat/rendering'
import type { MessageRenderBlock } from '@/types/database'

interface ChatMessageContentProps {
  content: string
  blocks?: MessageRenderBlock[]
  variant?: 'user' | 'assistant'
}

function renderInline(text: string): ReactNode[] {
  const nodes: ReactNode[] = []
  const pattern = /(`[^`]+`|\*\*[^*]+\*\*|\*[^*]+\*|__[^_]+__|_[^_]+_)/g
  let lastIndex = 0

  for (const match of text.matchAll(pattern)) {
    const token = match[0]
    const start = match.index ?? 0

    if (start > lastIndex) {
      nodes.push(text.slice(lastIndex, start))
    }

    if ((token.startsWith('**') && token.endsWith('**')) || (token.startsWith('__') && token.endsWith('__'))) {
      nodes.push(<strong key={`${start}-strong`}>{token.slice(2, -2)}</strong>)
    } else if ((token.startsWith('*') && token.endsWith('*')) || (token.startsWith('_') && token.endsWith('_'))) {
      nodes.push(<em key={`${start}-em`}>{token.slice(1, -1)}</em>)
    } else if (token.startsWith('`') && token.endsWith('`')) {
      nodes.push(<code key={`${start}-code`}>{token.slice(1, -1)}</code>)
    } else {
      nodes.push(token)
    }

    lastIndex = start + token.length
  }

  if (lastIndex < text.length) {
    nodes.push(text.slice(lastIndex))
  }

  return nodes
}

export function ChatMessageContent({
  content,
  blocks,
  variant = 'assistant',
}: ChatMessageContentProps) {
  if (variant === 'user') {
    return <p className="text-sm leading-7 whitespace-pre-wrap break-words">{content}</p>
  }

  const renderBlocks = blocks ?? buildMessageRenderData(content).blocks

  if (renderBlocks.length === 0) {
    return <p className="text-sm leading-7 whitespace-pre-wrap break-words">{content}</p>
  }

  return (
    <div className="chat-message-content text-sm text-inherit">
      {renderBlocks.map((block, index) => {
        if (block.type === 'heading') {
          const headingClassName =
            block.level === 1
              ? 'text-base font-semibold tracking-tight'
              : block.level === 2
                ? 'text-sm font-semibold tracking-tight'
                : 'text-sm font-medium'

          const HeadingTag = block.level === 1 ? 'h1' : block.level === 2 ? 'h2' : 'h3'

          return (
            <HeadingTag key={`heading-${index}`} className={headingClassName}>
              {renderInline(block.text)}
            </HeadingTag>
          )
        }

        if (block.type === 'blockquote') {
          return (
            <blockquote
              key={`quote-${index}`}
              className="border-l-2 border-current/20 pl-4 text-inherit/80 italic whitespace-pre-wrap"
            >
              {renderInline(block.text)}
            </blockquote>
          )
        }

        if (block.type === 'unordered_list') {
          return (
            <ul key={`ul-${index}`} className="list-disc space-y-1 pl-5">
              {block.items.map((item, itemIndex) => (
                <li key={`ul-item-${index}-${itemIndex}`}>{renderInline(item)}</li>
              ))}
            </ul>
          )
        }

        if (block.type === 'ordered_list') {
          return (
            <ol key={`ol-${index}`} className="list-decimal space-y-1 pl-5">
              {block.items.map((item, itemIndex) => (
                <li key={`ol-item-${index}-${itemIndex}`}>{renderInline(item)}</li>
              ))}
            </ol>
          )
        }

        if (block.type === 'code') {
          return (
            <div
              key={`code-${index}`}
              className="overflow-hidden rounded-md border border-white/10 bg-black/25"
            >
              {block.language ? (
                <div className="border-b border-white/10 px-3 py-2 text-[11px] uppercase tracking-[0.24em] text-inherit/50">
                  {block.language}
                </div>
              ) : null}
              <pre className="overflow-x-auto px-3 py-3 text-[13px] leading-6">
                <code>{block.code}</code>
              </pre>
            </div>
          )
        }

        return (
          <p key={`paragraph-${index}`} className="leading-7 whitespace-pre-wrap break-words">
            {renderInline(block.text)}
          </p>
        )
      })}
    </div>
  )
}
