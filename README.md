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
```
  - git clone https://github.com/sudhanshuBHU/crypto-crash-game.git
  - cd crypto-crash-game
  ```

2. **Install dependencies**  
  - ```npm install```

3. **Create `.env`**
```
  - PORT=3000
  - MONGO_URI=mongodb://localhost:27017/crypto_crash_sudhanshu
  - CRYPTO_API=https://api.coingecko.com/api/v3
```

**(make sure that MongoDB is running in the background)**

4. **Seed test data** - test profiles with some currencies
  - ``` node scripts/seed.js ```

5. **Run the server**
  - ``` npm run dev ```

6. **Open test client**  
   [http://localhost:3000/](http://localhost:3000/)

---

## 🔌 API Endpoints

- Get Prices
- GET http://localhost:3000/api/crypto/prices

`  {
    "BTC": 103576,
    "ETH": 2386.75
    }

`

## 🔁 WebSocket Events

🔔 Server → Client
- roundStart: { roundId, seed, startTime }
- multiplierUpdate: { multiplier }
- playerCashout: { playerId, roundId, multiplier, payoutUsd }
- roundCrash: { crashMultiplier }
- currentPrice: { price }
- playerCashout: { playerId, roundId, multiplier, payoutUsd }
- countdown: { seconds }
- roundEnd: { roundId }
- roundCrash: { roundId, crashMultiplier }


📤 Client → Server
- cashout: { playerId, roundId, multiplier }
- placeBet: { playerId, roundId, usdAmount, currency, socketId }

---

## 🎲 Provably Fair Crash Algorithm
Crash multiplier is generated using:
 - const hash = crypto.createHash('sha256').update(seed).digest('hex');
  - const intVal = parseInt(hash.slice(0, 8), 16);
  - const max = 10000;
  - const result = (intVal % max) / 100;
  - // Force a minimum of 1.00x and up to 100.00x
  - return Math.max(1.00, result < 1.01 ? 1.01 : result);

---

- Transparent
- Deterministic
- Verifiable from seed

--- 

- USD ↔ Crypto Conversion
- Uses real-time prices:
- USD → Crypto at bet time
- Crypto → USD at cashout time

### Example:
- $10 bet with BTC @ $60K = 0.00016667 BTC
- Cashout at 2x = 0.00033334 BTC, or $20

## 👤 Author

- **Name**: Sudhanshu Shekhar
- **Email**: sudhanshu.shekhar.bhu7@gmail.com
---

# Images for reference
1. Postman API test
![Postman Api test](public/images/postman.png "Postman api test")

2. Snapshot of DB - Game rounds
![DB Game rounds](public/images/gamerounds.png "gamerounds-DB")

3. Snapshot of DB - Transactions
![DB Transactions](public/images/transactions.png "transactions-DB")

4. Snapshot of DB - test players
![DB Test players](public/images/test%20players.png "test players-DB")

5. Snapshot of Home page
![UI home](public/images/home%201.png "UI Home")

6. Snapshot of Home page - logs
![UI Betting](public/images/home2.png "UI Home Betting")

7. Snapshot of multiple players are betting in the same round
![UI multiple players](public/images/home3.png "multiple players")

