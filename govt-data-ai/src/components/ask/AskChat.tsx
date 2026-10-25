'use client'

import Link from 'next/link'
import { FormEvent, useEffect, useRef, useState } from 'react'
import {
  ExternalLink,
  Send,
  Sparkles,
  RotateCcw,
  User,
} from 'lucide-react'
import { ask, SUGGESTED_PROMPTS } from '@/lib/ask'
import { ChatMessage } from '@/types/govt'

let idCounter = 0
function makeId(): string {
  return `m${Date.now()}-${idCounter++}`
}

export function AskChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [thinking, setThinking] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: 'smooth',
    })
  }, [messages, thinking])

  const send = (raw: string) => {
    const text = raw.trim()
    if (!text || thinking) return

    const userMsg: ChatMessage = {
      id: makeId(),
      role: 'user',
      text,
      time: Date.now(),
    }
    setMessages(prev => [...prev, userMsg])
    setInput('')
    setThinking(true)

    // simulate short "thinking" latency for a natural feel
    window.setTimeout(() => {
      const answer = ask(text)
      setMessages(prev => [
        ...prev,
        {
          id: makeId(),
          role: 'assistant',
          text: answer.text,
          answer,
          time: Date.now(),
        },
      ])
      setThinking(false)
    }, 450 + Math.random() * 500)
  }

  const onSubmit = (e: FormEvent) => {
    e.preventDefault()
    send(input)
  }

  const reset = () => {
    setMessages([])
    setInput('')
  }

  return (
    <div className="flex h-[70vh] min-h-[480px] flex-col overflow-hidden rounded-xl border border-ink-200 bg-surface shadow-card">
      <div className="flex items-center justify-between border-b border-ink-100 px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-md bg-govt text-white">
            <Sparkles className="h-4 w-4" aria-hidden />
          </span>
          <div>
            <p className="text-sm font-semibold text-ink-900">Data Assistant</p>
            <p className="text-[11px] text-ink-500">
              answers from the public-govt index · sources cited
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={reset}
          className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs text-ink-500 hover:bg-ink-100 hover:text-ink-800"
        >
          <RotateCcw className="h-3.5 w-3.5" aria-hidden />
          Clear
        </button>
      </div>

      <div
        ref={scrollRef}
        className="flex-1 space-y-4 overflow-y-auto px-4 py-4"
        aria-live="polite"
      >
        {messages.length === 0 && (
          <div className="animate-fade-up py-6 text-center">
            <Sparkles className="mx-auto h-8 w-8 text-saffron" aria-hidden />
            <p className="mt-3 text-sm font-medium text-ink-800">
              Ask anything about public government data
            </p>
            <p className="mx-auto mt-1 max-w-md text-xs leading-relaxed text-ink-500">
              Schemes, census & economy numbers, laws & RTI, tenders,
              helplines and budget documents — every answer cites an official
              source.
            </p>
            <div className="mt-5 flex flex-wrap justify-center gap-2">
              {SUGGESTED_PROMPTS.slice(0, 5).map(p => (
                <button
                  key={p}
                  type="button"
                  onClick={() => send(p)}
                  className="rounded-full border border-ink-200 bg-canvas px-3 py-1.5 text-xs text-ink-700 transition-colors hover:border-govt hover:bg-govt-soft hover:text-govt"
                >
                  {p}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map(msg => (
          <div
            key={msg.id}
            className={`flex gap-2.5 ${msg.role === 'user' ? 'justify-end' : ''}`}
          >
            {msg.role === 'assistant' && (
              <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-govt-soft text-govt">
                <Sparkles className="h-4 w-4" aria-hidden />
              </span>
            )}

            <div
              className={`max-w-[85%] rounded-xl px-3.5 py-2.5 text-sm leading-relaxed ${
                msg.role === 'user'
                  ? 'bg-govt text-white'
                  : 'border border-ink-200 bg-canvas text-ink-800'
              }`}
            >
              {msg.role === 'user' ? (
                <p className="whitespace-pre-wrap">{msg.text}</p>
              ) : (
                <>
                  <p className="whitespace-pre-wrap">{msg.text}</p>
                  {msg.answer?.related && msg.answer.related.length > 0 && (
                    <ul className="mt-3 space-y-1.5 border-t border-ink-200 pt-3">
                      {msg.answer.related.slice(0, 4).map(r => (
                        <li key={r.id}>
                          <Link
                            href={`/search?q=${encodeURIComponent(r.title)}`}
                            className="inline-flex items-center gap-1.5 text-xs font-medium text-govt hover:underline"
                          >
                            {r.title}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  )}
                  {msg.answer?.sourceUrl && (
                    <a
                      href={msg.answer.sourceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-3 flex items-center gap-1.5 border-t border-ink-200 pt-2.5 text-[11px] text-ink-500 hover:text-govt"
                    >
                      <ExternalLink className="h-3 w-3" aria-hidden />
                      Source: {msg.answer.source}
                      {msg.answer.asOf ? ` · ${msg.answer.asOf}` : ''}
                    </a>
                  )}
                </>
              )}
            </div>

            {msg.role === 'user' && (
              <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-ink-100 text-ink-500">
                <User className="h-4 w-4" aria-hidden />
              </span>
            )}
          </div>
        ))}

        {thinking && (
          <div className="flex gap-2.5">
            <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-govt-soft text-govt">
              <Sparkles className="h-4 w-4" aria-hidden />
            </span>
            <div className="rounded-xl border border-ink-200 bg-canvas px-4 py-3">
              <span className="inline-flex gap-1">
                <span className="h-1.5 w-1.5 animate-blink rounded-full bg-ink-400 [animation-delay:0ms]" />
                <span className="h-1.5 w-1.5 animate-blink rounded-full bg-ink-400 [animation-delay:200ms]" />
                <span className="h-1.5 w-1.5 animate-blink rounded-full bg-ink-400 [animation-delay:400ms]" />
              </span>
            </div>
          </div>
        )}
      </div>

      <form
        onSubmit={onSubmit}
        className="flex items-center gap-2 border-t border-ink-100 bg-surface px-3 py-3"
      >
        <input
          type="text"
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder="Ask a question…"
          aria-label="Ask a question"
          className="h-10 min-w-0 flex-1 rounded-lg border border-ink-200 bg-canvas px-3 text-sm text-ink-900 placeholder:text-ink-400 focus:border-govt focus:outline-none"
        />
        <button
          type="submit"
          disabled={!input.trim() || thinking}
          aria-label="Send message"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-govt text-white transition-colors hover:bg-govt-dark disabled:cursor-not-allowed disabled:bg-ink-300"
        >
          <Send className="h-4 w-4" aria-hidden />
        </button>
      </form>
    </div>
  )
}
