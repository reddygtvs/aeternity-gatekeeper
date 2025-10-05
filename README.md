# Aeternity Gatekeeper

A Berlin-style bouncer chatbot that tests guests through conversation, analyzes their photo and website, then mints a soulbound NFT badge on the Aeternity blockchain.

Built for the Aeternity hackathon.

## Features

- Voice conversation with AI bouncer (Web Speech API)
- Photo capture and analysis
- Website scraping and summarization
- Text-to-speech bouncer responses
- Soulbound NFT minting on Aeternity testnet
- QR code verification

## Tech Stack

**Frontend:** React 18, Vite, TypeScript
**Backend:** Node.js, Express, TypeScript
**AI:** Qwen3-VL-235B-A22B via OpenRouter
**Blockchain:** Aeternity Sophia smart contract
**Speech:** Web Speech API (recognition + synthesis)

## Setup

### 1. Deploy Sophia contract first

1. Get testnet AE from https://faucet.aepps.com
2. Go to https://studio.aepps.com
3. Upload `/contracts/AdmitGatekeeper.aes`
4. Deploy to testnet with your admin wallet address
5. Copy the deployed contract address

### 2. Install dependencies

```bash
# Frontend
cd frontend
npm install

# Backend
cd backend
npm install
```

### 3. Configure environment

**Backend (.env)**
```bash
cd backend
cp .env.example .env
```

Required variables:
- `OPENROUTER_API_KEY` - Get from https://openrouter.ai
- `AE_PRIVATE_KEY` - Aeternity wallet private key (same wallet used to deploy contract)
- `AE_NODE_URL` - https://testnet.aeternity.io
- `AE_CONTRACT_ID` - Deployed contract address from step 1
- `PORT` - 8787

**Frontend (.env)**
```bash
cd frontend
cp .env.example .env
```

Set `VITE_BACKEND_URL=http://localhost:8787`

### 4. Run servers

**Terminal 1 - Backend:**
```bash
cd backend
npm run dev
```

**Terminal 2 - Frontend:**
```bash
cd frontend
npm run dev
```

Visit http://localhost:5173

## Project Structure

```
/
├── frontend/
│   ├── src/
│   │   ├── components/    # React components
│   │   ├── hooks/        # useSTT, useTTS
│   │   └── lib/          # API clients, utilities
│   └── package.json
├── backend/
│   ├── server.ts         # Express API
│   └── package.json
└── contracts/
    └── AdmitGatekeeper.aes  # Sophia contract
```

## API Endpoints

**POST /api/analyze-image** - Analyzes photo with vision model
**POST /api/analyze-website** - Scrapes and summarizes website
**POST /api/chat** - Sends messages to bouncer AI
**POST /api/mint** - Mints soulbound NFT on Aeternity

## How It Works

1. User enters name, website URL, and takes a photo
2. Backend scrapes website and analyzes photo
3. AI bouncer starts conversation using context
4. User responds via text or voice input
5. After 8-10 turns, bouncer decides acceptance
6. Soulbound NFT badge minted on Aeternity testnet
7. QR code generated for on-chain verification

## Troubleshooting

**Voice not working?**
- Requires HTTPS or localhost
- Check browser permissions for microphone
- Chrome/Edge recommended (best Web Speech API support)

**OpenRouter errors?**
- Check API key is valid
- Verify you have credits (model costs ~$0.003 per conversation)
- Rate limit: slow down requests if hitting 429

**Aeternity mint fails?**
- Ensure wallet has testnet AE (use faucet)
- Verify `AE_CONTRACT_ID` is set correctly
- Check node URL is `https://testnet.aeternity.io`

## License

MIT
