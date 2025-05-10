
const mongoose = require('mongoose');
const Player = require('../models/Player');

const players = [
  {
    username: 'satoshi',
    wallet: { BTC: 0.61, ETH: 4.5 },
  },
  {
    username: 'vitalik',
    wallet: { BTC: 0.5, ETH: 1.7 },
  },
  {
    username: 'nakamoto',
    wallet: { BTC: 0.025, ETH: 2.2 },
  },
];

async function seed() {
  try {
    await mongoose.connect("mongodb://localhost:27017/crypto_crash_sudhanshu");
    console.log('MongoDB connected');
  } catch (err) {
    console.log("MongoDB connection error:", err.message);
    console.error(err);
    process.exit(1);
  }
  try {
    await Player.deleteMany({});
    const created = await Player.insertMany(players);
    console.log('✅ Seeded players:', created.map(p => ({
      username: p.username,
      id: p._id,
      wallet: p.wallet,
    })));
    process.exit();
  } catch (err) {
    console.error('❌ Error seeding players:', err);
    process.exit(1);
  }
}

seed();
