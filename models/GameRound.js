const mongoose = require('mongoose');

const betSchema = new mongoose.Schema({
  playerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Player' },
  usdAmount: Number,
  cryptoAmount: Number,
  currency: String,
  cashedOut: { type: Boolean, default: false },
  cashoutMultiplier: Number,
  payoutUsd: Number,
});

const gameRoundSchema = new mongoose.Schema({
  roundId: { type: String, unique: true },
  startTime: Date,
  crashMultiplier: Number,
  bets: [betSchema],
  ended: { type: Boolean, default: false },
});

module.exports = mongoose.model('GameRound', gameRoundSchema);
