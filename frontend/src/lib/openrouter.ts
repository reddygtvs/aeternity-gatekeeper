import type { Message } from '../types'

export async function chat(messages: Message[]) {
  const r = await fetch(import.meta.env.VITE_BACKEND_URL + '/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages, temperature: 0.7, max_tokens: 10000 })
  })
  const data = await r.json()

  if (data.error) {
    throw new Error(data.error.message || 'API request failed')
  }

  const text = data.choices?.[0]?.message?.content || ''

  if (!text) {
    throw new Error('Empty response from API')
  }

  return text
}
