# 💥 Crypto Crash Game Backend

This is the backend implementation of **Crypto Crash**, a real-time multiplayer game where players bet in USD (converted to BTC or ETH) and try to cash out before the game crashes.

---

## 📦 Tech Stack

- **Node.js**, **Express.js**
- **MongoDB** (NoSQL)
- **Socket.IO** for real-time multiplayer
- **CoinGecko API** for live crypto prices

---

## ⚙️ Setup Instructions

1. **Clone the repo**  
git clone https://github.com/yourusername/crypto-crash.git
cd crypto-crash

2. **Install dependencies**  
npm install

3. **Create `.env`**
PORT=3000
MONGO_URI=mongodb://localhost:27017/crypto_crash
CRYPTO_API=https://api.coingecko.com/api/v3


4. **Seed test data**
node scripts/seed.js

5. **Run the server**
npm run dev


6. **Open test client**  
[http://localhost:3000/test-client.html](http://localhost:3000/test-client.html)

---

## 🔌 API Endpoints

### ✅ Place Bet
`POST /api/bets/place`
```json
{
"playerId": "PLAYER_ID",
"usdAmount": 10,
"currency": "BTC"
}

 Cash Out
POST /api/cashout
{
  "playerId": "PLAYER_ID",
  "roundId": "ROUND_ID",
  "currentMultiplier": 2.5
}
Get Prices
GET /api/crypto/prices

💼 Check Balance
GET /api/players/:id

🔁 WebSocket Events
🔔 Server → Client
roundStart: { roundId, seed }

multiplierUpdate: { multiplier }

roundCrash: { crashMultiplier }

playerCashout: { playerId, roundId, multiplier, payoutUsd }

📤 Client → Server
cashout: { playerId, roundId, multiplier }

🎲 Provably Fair Crash Algorithm
Crash multiplier is generated using:
const hash = sha256(seed); 
const crash = (parseInt(hash.slice(0, 8), 16) % 10000) / 100;

Transparent

Deterministic

Verifiable from seed

USD ↔ Crypto Conversion
Uses real-time prices:

USD → Crypto at bet time

Crypto → USD at cashout time

Example:

$10 bet with BTC @ $60K = 0.00016667 BTC

Cashout at 2x = 0.00033334 BTC, or $20