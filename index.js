require('dotenv').config();
const express = require('express');
const connectDB = require('./config/db');
const app = express();
const cryptoRoutes = require('./routes/crypto');
const http = require('http');
const { startGameLoop } = require('./services/gameLoop');
const server = http.createServer(app);

const path = require('path');
app.use(express.static(path.join(__dirname, 'public')));


connectDB();

app.use(express.json());
app.use('/api/crypto', cryptoRoutes); // fetch prices


startGameLoop(server);

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'test-client.html'));
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
