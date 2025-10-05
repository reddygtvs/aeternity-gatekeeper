import { useEffect, useState, useRef } from 'react'
import { useSTT } from '../hooks/useSTT'
import { useTTS } from '../hooks/useTTS'
import { chat } from '../lib/openrouter'
import { SYSTEM_PROMPT, seedContext } from '../lib/bouncerPrompt'
import { shouldAccept } from '../lib/fsm'
import Badge from './Badge'
import { stylizeToDataURL } from '../lib/stylize'
import type { FormData, Message, Score } from '../types'

export default function Gatekeeper({ form }: { form: FormData }) {
  const { start: startSTT, stop: stopSTT } = useSTT()
  const { speak } = useTTS()
  const initialized = useRef(false)
  const sentInitialImage = useRef(false)

  const [messages, setMessages] = useState<Message[]>([
    { role: 'system', content: SYSTEM_PROMPT }
  ])
  const [turn, setTurn] = useState(0)
  const [score] = useState<Score>({ pitch: 0.5, riddle: 0.5, wit: 0.5, fit: 0.5 })
  const [accepted, setAccepted] = useState(false)
  const [badge, setBadge] = useState<any>(null)
  const [listening, setListening] = useState(false)
  const [userInput, setUserInput] = useState('')
  const [conversation, setConversation] = useState<Array<{role: string, text: string}>>([])
  const [analyzing, setAnalyzing] = useState(true)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!initialized.current) {
      initialized.current = true
      init()
    }
  }, [])

  async function init() {
    setAnalyzing(true)

    // Get website summary
    let siteInfo = ''
    if (form.site) {
      try {
        const url = form.site.startsWith('http') ? form.site : `https://${form.site}`
        const r = await fetch(import.meta.env.VITE_BACKEND_URL + '/api/analyze-website', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url })
        })
        const data = await r.json()
        siteInfo = data.title || data.description || form.about
      } catch (e) {
        console.error('Website analysis failed:', e)
        siteInfo = form.about
      }
    }

    setAnalyzing(false)

    // Build initial context
    const ctx = seedContext(form.name, form.site, siteInfo, [])

    // Send first message with image if available
    try {
      setLoading(true)

      const firstUserMessage: Message = form.photo
        ? {
            role: 'user',
            content: [
              { type: 'text', text: `Context: ${ctx}. Start the conversation.` },
              { type: 'image_url', image_url: { url: form.photo } }
            ]
          }
        : {
            role: 'user',
            content: `Context: ${ctx}. Start the conversation.`
          }

      sentInitialImage.current = !!form.photo

      const greeting = await chat([messages[0], firstUserMessage])

      setMessages([messages[0], firstUserMessage, { role: 'assistant', content: greeting }])
      setConversation([{ role: 'bouncer', text: greeting }])
      speak(greeting)
    } catch (e: any) {
      setConversation([{ role: 'bouncer', text: `Error: ${e.message}` }])
    } finally {
      setLoading(false)
    }
  }

  async function sendMessage() {
    if (!userInput.trim() || loading) return

    // Stop voice first
    if (listening) {
      stopSTT()
      setListening(false)
    }

    const text = userInput.trim()
    setUserInput('')

    // Add to conversation display
    setConversation(prev => [...prev, { role: 'user', text }])

    try {
      setLoading(true)

      // Build new message (always text-only after first)
      const userMessage: Message = { role: 'user', content: text }
      const newMessages = [...messages, userMessage]

      const reply = await chat(newMessages)

      setMessages([...newMessages, { role: 'assistant', content: reply }])
      setConversation(prev => [...prev, { role: 'bouncer', text: reply }])
      speak(reply)
      setTurn(prev => prev + 1)

      // Check acceptance
      if (turn >= 8 && shouldAccept(score, turn)) {
        setAccepted(true)
        const portrait = await stylizeToDataURL(form.photo || '', form.name)
        setBadge({ portrait, tagline: reply.split('\n')[0].slice(0, 64), score: 0.8 })
      }
    } catch (e: any) {
      setConversation(prev => [...prev, { role: 'bouncer', text: `Error: ${e.message}` }])
    } finally {
      setLoading(false)
    }
  }

  function toggleVoice() {
    if (listening) {
      stopSTT()
      setListening(false)
    } else {
      setListening(true)
      startSTT((text) => setUserInput(text))
    }
  }

  if (accepted && badge) {
    const verify = `${location.origin}/verify?name=${encodeURIComponent(form.name)}`
    return (
      <Badge
        name={form.name}
        tagline={badge.tagline}
        portrait={badge.portrait}
        verifyUrl={verify}
        score={badge.score}
      />
    )
  }

  if (analyzing) {
    return (
      <div className="p-4 border rounded-xl max-w-2xl">
        <div className="text-lg">Analyzing your info...</div>
      </div>
    )
  }

  return (
    <div className="p-4 border rounded-xl max-w-2xl">
      <div className="mb-4 space-y-2 max-h-96 overflow-y-auto">
        {conversation.map((msg, i) => (
          <div key={i} className={`p-2 rounded ${msg.role === 'bouncer' ? 'bg-gray-100' : 'bg-blue-50'}`}>
            <div className="text-sm font-bold">{msg.role === 'bouncer' ? 'Bouncer' : 'You'}</div>
            <div>{msg.text}</div>
          </div>
        ))}
        {loading && (
          <div className="p-2 rounded bg-gray-100">
            <div className="text-sm font-bold">Bouncer</div>
            <div className="opacity-50">Thinking...</div>
          </div>
        )}
      </div>

      <div className="flex gap-2 items-end">
        <textarea
          value={userInput}
          onChange={(e) => setUserInput(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), sendMessage())}
          placeholder="Type your response..."
          className="flex-1 min-h-20 max-h-40 resize-y"
          rows={3}
          disabled={loading}
        />
        <div className="flex flex-col gap-2">
          <button onClick={toggleVoice} className={listening ? 'bg-red-500' : ''} disabled={loading}>
            {listening ? '🔴 Stop' : '🎤 Voice'}
          </button>
          <button onClick={sendMessage} disabled={loading || !userInput.trim()}>
            Send
          </button>
        </div>
      </div>
    </div>
  )
}
