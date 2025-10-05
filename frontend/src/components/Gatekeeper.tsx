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
  const [paymentRequest, setPaymentRequest] = useState<{amount: number, payer: string, memo: string} | null>(null)
  const [txHash, setTxHash] = useState('')
  const [paymentStatus, setPaymentStatus] = useState('')
  const [personDescription, setPersonDescription] = useState('')

  useEffect(() => {
    if (!initialized.current) {
      initialized.current = true
      init()
    }
  }, [])

  async function init() {
    setAnalyzing(true)

    // Get detailed person description from photo
    if (form.photo) {
      try {
        const r = await fetch(import.meta.env.VITE_BACKEND_URL + '/api/analyze-image', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ imageDataUrl: form.photo })
        })
        const data = await r.json()
        setPersonDescription(data.fullDescription || 'person in casual outfit')
      } catch (e) {
        console.error('Image analysis failed:', e)
        setPersonDescription('person in casual outfit')
      }
    }

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
        siteInfo = data.description || data.title || form.about
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

      // Detect URLs in user message
      const urlMatch = text.match(/https?:\/\/[^\s]+/i)
      let enhancedContent = text

      if (urlMatch) {
        const url = urlMatch[0]
        try {
          const r = await fetch(import.meta.env.VITE_BACKEND_URL + '/api/analyze-website', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url })
          })
          const data = await r.json()

          if (data.error) {
            enhancedContent = `${text}\n\n[system: tried to fetch ${url} but ${data.error}]`
          } else if (data.rawHtml) {
            enhancedContent = `${text}\n\n[system: HTML from ${url}]\n<html>\n${data.rawHtml}\n</html>`
          }
        } catch (e) {
          enhancedContent = `${text}\n\n[system: couldn't fetch ${url}, site might be down]`
        }
      }

      // Build new message with enhanced content
      const userMessage: Message = { role: 'user', content: enhancedContent }
      const newMessages = [...messages, userMessage]

      const reply = await chat(newMessages)

      setMessages([...newMessages, { role: 'assistant', content: reply }])
      setConversation(prev => [...prev, { role: 'bouncer', text: reply }])
      speak(reply)
      setTurn(prev => prev + 1)

      // Check for payment tool call
      const toolMatch = reply.match(/\{\{DEBIT_TOKENS\s+amount_ae:\s*([0-9]*\.?[0-9]+),\s*payer:\s*"(ak_[^"]+)",\s*memo:\s*"([^"]+)"\s*\}\}/i)
      if (toolMatch) {
        const amount = parseFloat(toolMatch[1])
        const payer = toolMatch[2]
        const memo = toolMatch[3]
        setPaymentRequest({ amount, payer, memo })
      }

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

  async function verifyPayment() {
    if (!txHash.trim() || !paymentRequest) return

    try {
      setPaymentStatus('Verifying payment...')
      const r = await fetch(import.meta.env.VITE_BACKEND_URL + '/api/payment/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          txHash: txHash.trim(),
          expectedAmountAE: paymentRequest.amount,
          payer: paymentRequest.payer
        })
      })
      const data = await r.json()

      if (!r.ok || !data.ok) {
        setPaymentStatus(`Error: ${data.error || 'Payment verification failed'}`)
        return
      }

      setPaymentStatus('Payment verified! Generating your badge...')

      // Generate badge with Nano Banana
      const badgeR = await fetch(import.meta.env.VITE_BACKEND_URL + '/api/generate-badge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          personDescription: personDescription,
          amountAE: paymentRequest.amount,
          eventName: 'FRONTIER TOWER'
        })
      })
      const badgeData = await badgeR.json()

      if (!badgeR.ok) {
        setPaymentStatus(`Error: ${badgeData.error || 'Badge generation failed'}`)
        return
      }

      setPaymentStatus('Success! Badge generated.')
      setAccepted(true)
      setBadge({
        portrait: badgeData.badgeImage,
        tagline: `Paid ${paymentRequest.amount} AETERNITY`,
        score: 0.8
      })
    } catch (e: any) {
      setPaymentStatus(`Error: ${e.message}`)
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
          disabled={loading || !!paymentRequest}
        />
        <div className="flex flex-col gap-2">
          <button onClick={toggleVoice} className={listening ? 'bg-red-500' : ''} disabled={loading || !!paymentRequest}>
            {listening ? '🔴 Stop' : '🎤 Voice'}
          </button>
          <button onClick={sendMessage} disabled={loading || !userInput.trim() || !!paymentRequest}>
            Send
          </button>
        </div>
      </div>

      {paymentRequest && (
        <div className="mt-4 p-4 border rounded-xl bg-gray-50">
          <div className="text-lg font-bold mb-2">Payment Required</div>
          <div className="space-y-2 text-sm">
            <div><strong>Amount:</strong> {paymentRequest.amount} AE</div>
            <div><strong>Send to:</strong> <code className="bg-white p-1 rounded">{process.env.VITE_EVENT_RECEIVER || 'ak_2VvB4fFu2uvBwAu5EvxcWHFJHPcJWR3BVpPCLVpZWZfUbhDu2i'}</code></div>
            <div><strong>Memo:</strong> {paymentRequest.memo}</div>
            <div><strong>Your address:</strong> <code className="bg-white p-1 rounded">{paymentRequest.payer}</code></div>
          </div>

          <div className="mt-4">
            <label className="block text-sm font-bold mb-1">Transaction Hash (after payment):</label>
            <input
              type="text"
              value={txHash}
              onChange={(e) => setTxHash(e.target.value)}
              placeholder="th_..."
              className="w-full p-2 border rounded"
            />
            <button
              onClick={verifyPayment}
              disabled={!txHash.trim()}
              className="mt-2 w-full"
            >
              Verify Payment & Mint NFT
            </button>
          </div>

          {paymentStatus && (
            <div className="mt-2 p-2 bg-white rounded text-sm">
              {paymentStatus}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
