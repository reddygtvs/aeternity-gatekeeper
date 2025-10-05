import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import fetch from 'node-fetch'
import { AeSdk, Node, MemoryAccount } from '@aeternity/aepp-sdk'

const app = express()
app.use(cors())
app.use(express.json({ limit: '10mb' }))

// ---- OpenRouter proxy (vision model) ----
const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions'
const OPENROUTER_MODEL = 'qwen/qwen3-vl-235b-a22b-instruct'

// ---- Analyze image with vision model ----
app.post('/api/analyze-image', async (req, res) => {
  try {
    const { imageDataUrl } = req.body
    const r = await fetch(OPENROUTER_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'google/gemini-2.0-flash-exp:free',
        messages: [{
          role: 'user',
          content: [
            { type: 'text', text: 'Describe this person\'s outfit in 2-3 short phrases: colors, style, materials. Be concise.' },
            { type: 'image_url', image_url: { url: imageDataUrl } }
          ]
        }],
        max_tokens: 100
      })
    })
    const data = await r.json()
    res.json({ description: data.choices?.[0]?.message?.content || 'casual outfit' })
  } catch (e: any) {
    console.error(e)
    res.json({ description: 'casual outfit' })
  }
})

// ---- Scrape website info ----
app.post('/api/analyze-website', async (req, res) => {
  try {
    const { url } = req.body
    const html = await fetch(url).then(r => r.text())

    // Extract metadata
    const title = html.match(/<title>(.*?)<\/title>/i)?.[1] || ''
    const description = html.match(/<meta name="description" content="(.*?)"/i)?.[1] || ''

    // Extract text content from common elements
    const bodyMatch = html.match(/<body[^>]*>([\s\S]*)<\/body>/i)
    let bodyHtml = bodyMatch ? bodyMatch[1] : html

    // Remove script and style tags
    bodyHtml = bodyHtml.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    bodyHtml = bodyHtml.replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')

    // Extract text from headings and paragraphs
    const headings = [...bodyHtml.matchAll(/<h[1-6][^>]*>(.*?)<\/h[1-6]>/gi)]
      .map(m => m[1].replace(/<[^>]+>/g, '').trim())
      .filter(Boolean)

    const paragraphs = [...bodyHtml.matchAll(/<p[^>]*>(.*?)<\/p>/gi)]
      .map(m => m[1].replace(/<[^>]+>/g, '').trim())
      .filter(Boolean)

    // Combine content (limit to first 2000 chars to avoid token limits)
    const contentPreview = [...headings.slice(0, 5), ...paragraphs.slice(0, 10)]
      .join(' ')
      .slice(0, 2000)

    // Use LLM to summarize the website content
    if (contentPreview.length > 50) {
      const summaryRes = await fetch(OPENROUTER_URL, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: OPENROUTER_MODEL,
          messages: [{
            role: 'user',
            content: `Summarize what this person/company does in 1-2 sentences based on their website:\n\nTitle: ${title}\n\nContent: ${contentPreview}`
          }],
          max_tokens: 150,
          reasoning: { exclude: true }
        })
      })
      const summaryData = await summaryRes.json()
      let summary = summaryData.choices?.[0]?.message?.content || description || title

      // Strip any remaining <think> tags
      summary = summary.replace(/<think>[\s\S]*?<\/think>/gi, '').trim()

      res.json({ title, description: summary })
    } else {
      res.json({ title, description })
    }
  } catch (e: any) {
    console.error(e)
    res.json({ title: '', description: '' })
  }
})

app.post('/api/chat', async (req, res) => {
  try {
    const { messages, temperature = 0.7, max_tokens = 800 } = req.body

    console.log('🔹 Chat request:', messages.length, 'messages')

    const startTime = Date.now()
    const r = await fetch(OPENROUTER_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: OPENROUTER_MODEL,
        messages,
        temperature,
        max_tokens,
        reasoning: {
          exclude: true
        }
      })
    })
    const data = await r.json()
    const responseTime = Date.now() - startTime

    // Strip <think>...</think> tags from response
    if (data.choices?.[0]?.message?.content) {
      let content = data.choices[0].message.content
      // Remove all <think>...</think> blocks (including multiline)
      content = content.replace(/<think>[\s\S]*?<\/think>/gi, '').trim()
      data.choices[0].message.content = content

      console.log(`✅ Response (${responseTime}ms):`, content.slice(0, 100) + '...')
    }

    res.json(data)
  } catch (e: any) {
    console.error('❌ Chat error:', e.message)
    res.status(500).json({ error: e.message })
  }
})

// ---- Aeternity: mint Admit (testnet) ----
const NODE_URL = process.env.AE_NODE_URL || 'https://testnet.aeternity.io'
const CONTRACT_ID = process.env.AE_CONTRACT_ID // deploy once, set here

app.post('/api/mint', async (req, res) => {
  try {
    const { ownerAddress, handleHash, score, cardUri } = req.body

    if (!process.env.AE_PRIVATE_KEY) {
      return res.status(400).json({ error: 'Missing AE_PRIVATE_KEY in environment' })
    }

    if (!CONTRACT_ID) {
      return res.status(400).json({ error: 'Missing AE_CONTRACT_ID in environment' })
    }

    const sdk = new AeSdk({
      nodes: [{ name: 'testnet', instance: new Node(NODE_URL) }],
      accounts: [new MemoryAccount(process.env.AE_PRIVATE_KEY)]
    })

    const contract = await sdk.getContractInstance({
      contractAddress: CONTRACT_ID
    })

    const { decodedResult } = await contract.call(
      'mint_admit',
      [ownerAddress, handleHash, score, cardUri]
    )

    return res.json({ tokenId: decodedResult })
  } catch (e: any) {
    console.error(e)
    return res.status(500).json({ error: e.message })
  }
})

const PORT = process.env.PORT || 8787
app.listen(PORT, () => console.log(`Backend running on :${PORT}`))
