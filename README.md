# Æternity Gatekeeper — Hackathon Pack

> Single‑page kiosk (React + Vite) that play‑acts a Berlin‑style doorman, roasts lightly for ~2 minutes, then grants entry. Uses **Qwen3‑235B (free via OpenRouter)** for dialog, **in‑browser STT** (Web Speech API or Whisper WebGPU fallback), **browser TTS**, and a **Sophia contract** to mint a **non‑transferable Admit NFT** on æternity testnet (QR shows on‑chain proof).

---

## Setup Instructions

### 1. Install Dependencies

#### Frontend
```bash
cd frontend
npm install
```

#### Backend
```bash
cd backend
npm install
```

### 2. Configure Environment Variables

#### Backend (`/backend/.env`)
Copy `.env.example` to `.env` and fill in:

```bash
cp .env.example .env
```

**Required API keys:**
- `OPENROUTER_API_KEY` - Get from https://openrouter.ai/
- `AE_PRIVATE_KEY` - Your Æternity wallet private key (testnet)
- `AE_CONTRACT_ID` - Contract address after deploying `AdmitGatekeeper.aes`
- `AE_NODE_URL` - Default: `https://testnet.aeternity.io`

#### Frontend (`/frontend/.env`)
Copy `.env.example` to `.env`:

```bash
cp .env.example .env
```

Default: `VITE_BACKEND_URL=http://localhost:8787`

### 3. Deploy Sophia Contract

1. Use [ÆStudio](https://studio.aepps.com/) or the Æternity SDK to deploy `/contracts/AdmitGatekeeper.aes`
2. Initialize with your admin wallet address
3. Copy the contract address to `AE_CONTRACT_ID` in backend `.env`

### 4. Run the Application

#### Start Backend (Terminal 1)
```bash
cd backend
npm run dev
```

#### Start Frontend (Terminal 2)
```bash
cd frontend
npm run dev
```

Visit http://localhost:5173

---

## API Keys You Need

### 1. OpenRouter API Key (Required)
- **Purpose:** Powers the AI bouncer conversation using Qwen3-235B (free tier)
- **Get it:** https://openrouter.ai/
- **Cost:** Free tier available
- **Add to:** `backend/.env` as `OPENROUTER_API_KEY`

### 2. Æternity Testnet Wallet (Required)
- **Purpose:** Deploy contract and mint soulbound NFTs
- **Get testnet AE:** https://faucet.aepps.com/
- **Add to:** `backend/.env` as `AE_PRIVATE_KEY`

### 3. Nano Banana API (Optional)
- **Purpose:** Enhanced portrait stylization (if you have access)
- **Default:** Uses local canvas-based stylization
- **Only needed if:** You want AI-generated stylized portraits

---

## Tech Stack

- **Frontend:** React 18 + Vite + TypeScript
- **Backend:** Node.js + Express + TypeScript
- **LLM:** Qwen3-235B-A22B (free via OpenRouter)
- **STT:** Web Speech API (primary) + Whisper.js (fallback)
- **TTS:** Web Speech Synthesis API
- **Blockchain:** Æternity Sophia smart contract (testnet)
- **QR Code:** qrcode library

---

## Project Structure

```
/ae-gatekeeper
  /frontend
    /src
      /components      # React components
      /hooks          # Custom hooks (STT, TTS)
      /lib            # Utilities (AI, styling, QR)
      App.tsx
      main.tsx
  /backend
    server.ts         # Express API
    .env.example
  /contracts
    AdmitGatekeeper.aes  # Sophia smart contract
```

---

## Features

✅ Voice conversation with AI bouncer
✅ Browser-based speech recognition (Web Speech + Whisper fallback)
✅ Text-to-speech responses
✅ Photo capture via webcam
✅ Stylized portrait generation
✅ Soulbound NFT minting on Æternity
✅ QR code for on-chain verification
✅ Printable badge

---

## Troubleshooting

- **STT not working on iOS?** Use the Whisper fallback (automatically triggered)
- **Qwen returns 429?** You're hitting rate limits; slow down requests
- **Æternity mint fails?** Check:
  - `AE_CONTRACT_ID` is set correctly
  - Your wallet has testnet AE (use faucet)
  - Node URL is correct: `https://testnet.aeternity.io`

---

## License

MIT
