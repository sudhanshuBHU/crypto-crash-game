require('dotenv').config();
const express = require('express');
const connectDB = require('./config/db');
const app = express();
const cryptoRoutes = require('./routes/crypto');
const betRoutes = require('./routes/bet');
const cashoutRoutes = require('./routes/cashout');
const http = require('http');
const { startGameLoop } = require('./services/gameLoop');
const server = http.createServer(app);

const path = require('path');
app.use(express.static(path.join(__dirname, 'public')));


connectDB();

app.use(express.json());
app.use('/api/bets', betRoutes);
app.use('/api/crypto', cryptoRoutes); // fetch prices
app.use('/api/cashout', cashoutRoutes);


startGameLoop(server);

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'test-client.html'));
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));


// ... routes and websocket setup to be added here

// const { fetchPrices } = require('./services/priceServices');
// (async () => {
//   try {
//     const prices = await fetchPrices();
//     console.log('Initial prices:', prices);
//   } catch (err) {
//     console.error('Error fetching initial prices:', err.message);
//   }
// })();

// app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
