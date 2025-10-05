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
        model: OPENROUTER_MODEL,
        messages: [{
          role: 'user',
          content: [
            { type: 'text', text: 'Describe this person in detail for image generation: face shape, skin tone, hair (color, style, length), facial features (eyes, nose, mouth), body type, outfit (colors, materials, style, logos, specific items). Be extremely detailed and specific.' },
            { type: 'image_url', image_url: { url: imageDataUrl } }
          ]
        }],
        max_tokens: 300,
        reasoning: { exclude: true }
      })
    })
    const data = await r.json()
    let fullDescription = data.choices?.[0]?.message?.content || 'person in casual outfit'
    fullDescription = fullDescription.replace(/<think>[\s\S]*?<\/think>/gi, '').trim()

    // Also get short outfit description for conversation
    const outfitR = await fetch(OPENROUTER_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: OPENROUTER_MODEL,
        messages: [{
          role: 'user',
          content: [
            { type: 'text', text: 'Describe this person\'s outfit in 2-3 short phrases: colors, style, materials. Be concise.' },
            { type: 'image_url', image_url: { url: imageDataUrl } }
          ]
        }],
        max_tokens: 100,
        reasoning: { exclude: true }
      })
    })
    const outfitData = await outfitR.json()
    let outfitDescription = outfitData.choices?.[0]?.message?.content || 'casual outfit'
    outfitDescription = outfitDescription.replace(/<think>[\s\S]*?<\/think>/gi, '').trim()

    res.json({
      description: outfitDescription,
      fullDescription: fullDescription
    })
  } catch (e: any) {
    console.error(e)
    res.json({
      description: 'casual outfit',
      fullDescription: 'person in casual outfit'
    })
  }
})

// ---- Scrape website info (exhaustive + raw HTML) ----
app.post('/api/analyze-website', async (req, res) => {
  try {
    const { url } = req.body

    // Proper timeout implementation with AbortController
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 30000)

    const fetchRes = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      signal: controller.signal
    })

    clearTimeout(timeoutId)

    if (!fetchRes.ok) {
      return res.json({
        title: '',
        description: '',
        rawHtml: '',
        error: `site returned ${fetchRes.status}`
      })
    }

    const html = await fetchRes.text()

    // Extract metadata
    const title = html.match(/<title>(.*?)<\/title>/i)?.[1] || ''
    const description = html.match(/<meta name="description" content="(.*?)"/i)?.[1] || ''

    // Extract body HTML (keep structure for LLM)
    const bodyMatch = html.match(/<body[^>]*>([\s\S]*)<\/body>/i)
    let bodyHtml = bodyMatch ? bodyMatch[1] : html

    // Only remove scripts and styles (keep structure, links, classes)
    bodyHtml = bodyHtml.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    bodyHtml = bodyHtml.replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
    bodyHtml = bodyHtml.replace(/<!--[\s\S]*?-->/g, '')

    // Limit to 8000 chars of HTML (vision model can handle it)
    const rawHtml = bodyHtml.slice(0, 8000)

    // Extract text for summary
    const allText = bodyHtml
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 5000)

    // Use LLM to extract key details
    if (allText.length > 50) {
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
            content: `Extract key details from this website for roasting. List:
1. What they built/shipped (specific projects, apps, tools)
2. Their tech stack or skills
3. Any cringey buzzwords or claims
4. Anything notable

Website: ${title}
Content: ${allText}`
          }],
          max_tokens: 300,
          reasoning: { exclude: true }
        })
      })
      const summaryData = await summaryRes.json()
      let summary = summaryData.choices?.[0]?.message?.content || description || title
      summary = summary.replace(/<think>[\s\S]*?<\/think>/gi, '').trim()

      res.json({ title, description: summary, rawHtml })
    } else {
      res.json({ title, description, rawHtml })
    }
  } catch (e: any) {
    console.error('Website fetch error:', e.message)

    let errorMsg = 'site timed out'
    if (e.code === 'ENOTFOUND') errorMsg = 'site not found'
    else if (e.name === 'AbortError') errorMsg = 'site timed out'
    else if (e.code === 'ECONNREFUSED') errorMsg = 'connection refused'
    else if (!e.code && !e.name) errorMsg = e.message || 'unknown error'

    res.json({
      title: '',
      description: '',
      rawHtml: '',
      error: errorMsg
    })
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

// ---- Aeternity: payment verification ----
const NODE_URL = process.env.AE_NODE_URL || 'https://testnet.aeternity.io'
const EVENT_RECEIVER = process.env.EVENT_RECEIVER

// Simple in-memory payment verification (for hackathon)
const verifiedPayments = new Map()

app.post('/api/payment/verify', async (req, res) => {
  try {
    const { txHash, expectedAmountAE, payer } = req.body

    // Validate inputs
    if (!txHash || !expectedAmountAE || !payer) {
      return res.status(400).json({ error: 'Missing txHash, expectedAmountAE, or payer' })
    }

    // Check range
    if (expectedAmountAE < 0.001 || expectedAmountAE > 0.5) {
      return res.status(400).json({ error: 'Amount must be between 0.001 and 0.5 AE' })
    }

    // Check if already verified
    if (verifiedPayments.has(txHash)) {
      return res.json({ ok: true, txHash, amountAE: expectedAmountAE, alreadyVerified: true })
    }

    const sdk = new AeSdk({
      nodes: [{ name: 'testnet', instance: new Node(NODE_URL) }]
    })

    // Fetch transaction
    const tx = await sdk.api.getTransactionByHash(txHash)

    // Check it's a spend transaction
    if (tx.tx.type !== 'SpendTx') {
      return res.status(400).json({ error: 'Transaction is not a SpendTx' })
    }

    // Convert expected amount to aettos
    const expectedAettos = BigInt(Math.round(expectedAmountAE * 1e18))

    // Verify transaction details
    if (tx.tx.recipientId !== EVENT_RECEIVER) {
      return res.status(400).json({ error: 'Payment not sent to event receiver' })
    }

    if (BigInt(tx.tx.amount) !== expectedAettos) {
      return res.status(400).json({ error: `Amount mismatch. Expected ${expectedAmountAE} AE, got ${Number(tx.tx.amount) / 1e18} AE` })
    }

    if (tx.tx.senderId !== payer) {
      return res.status(400).json({ error: 'Sender does not match provided payer address' })
    }

    // Store verification
    verifiedPayments.set(txHash, { payer, amountAE: expectedAmountAE, ts: Date.now() })

    return res.json({ ok: true, txHash, amountAE: expectedAmountAE })
  } catch (e: any) {
    console.error('Payment verification error:', e)
    return res.status(500).json({ error: e.message })
  }
})

// ---- Generate badge with Nano Banana ----
app.post('/api/generate-badge', async (req, res) => {
  try {
    const { personDescription, amountAE, eventName } = req.body

    if (!process.env.GOOGLE_API_KEY) {
      return res.status(400).json({ error: 'Missing GOOGLE_API_KEY in environment' })
    }

    const prompt = `Create a stylized pixelated NFT badge in retro 8-bit pixel art style.

PERSON: ${personDescription}

DESIGN REQUIREMENTS:
- Pixel art / 8-bit retro game aesthetic (like CryptoPunks or early Nintendo characters)
- Square format, clean composition
- At the TOP: "${amountAE} AETERNITY" in bold pixelated text
- At the BOTTOM: "${eventName || 'FRONTIER TOWER'}" in stylized pixel font
- Center: The person as a recognizable pixel art character
- Color palette: vibrant but limited (8-16 colors max for authentic pixel art feel)
- Sharp edges, no anti-aliasing (true pixel art style)
- Background: solid color or simple geometric pattern
- Make it look like a collectible trading card or game character sprite

Style: retro pixel art, 8-bit, CryptoPunk aesthetic, sharp pixels, limited color palette`

    const imageGenUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image:generateContent`

    const r = await fetch(imageGenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': process.env.GOOGLE_API_KEY
      },
      body: JSON.stringify({
        contents: [{
          parts: [
            { text: prompt }
          ]
        }]
      })
    })

    const data = await r.json()

    if (!r.ok) {
      console.error('Imagen API error:', data)
      return res.status(500).json({ error: data.error?.message || 'Image generation failed' })
    }

    // Gemini returns inline data in candidates[0].content.parts[0].inlineData
    const inlineData = data.candidates?.[0]?.content?.parts?.[0]?.inlineData

    if (!inlineData || !inlineData.data) {
      console.error('No image data in response:', JSON.stringify(data, null, 2))
      return res.status(500).json({ error: 'No image returned from API' })
    }

    const imageDataUrl = `data:${inlineData.mimeType};base64,${inlineData.data}`

    return res.json({ badgeImage: imageDataUrl })
  } catch (e: any) {
    console.error('Badge generation error:', e)
    return res.status(500).json({ error: e.message })
  }
})

const PORT = process.env.PORT || 8787
app.listen(PORT, () => console.log(`Backend running on :${PORT}`))
