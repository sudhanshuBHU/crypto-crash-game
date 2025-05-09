const Player = require('../models/Player');
const GameRound = require('../models/GameRound');
const Transaction = require('../models/Transaction');
const { convertUsdToCrypto } = require('../utils/conversion');
const crypto = require('crypto');

exports.placeBet = async (req, res) => {
  const { playerId, usdAmount, currency } = req.body;

  if (!playerId || !usdAmount || !currency) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  if (usdAmount <= 0) {
    return res.status(400).json({ error: 'USD amount must be positive' });
  }

  try {
    const player = await Player.findById(playerId);
    if (!player) return res.status(404).json({ error: 'Player not found' });

    const { cryptoAmount, price } = await convertUsdToCrypto(usdAmount, currency);

    if (player.wallet[currency] < cryptoAmount) {
      return res.status(400).json({ error: 'Insufficient crypto balance' });
    }

    // Deduct crypto from wallet
    player.wallet[currency] -= cryptoAmount;
    await player.save();

    // Get or create current round (simplified for demo)
    let round = await GameRound.findOne({ ended: false });
    if (!round) {
      round = new GameRound({
        roundId: crypto.randomUUID(),
        startTime: new Date(),
        bets: [],
      });
    }

    // Add player's bet
    round.bets.push({
      playerId,
      usdAmount,
      cryptoAmount,
      currency,
    });

    await round.save();

    // Record transaction
    const tx = new Transaction({
      playerId,
      usdAmount,
      cryptoAmount,
      currency,
      type: 'bet',
      transactionHash: crypto.randomBytes(8).toString('hex'),
      priceAtTime: price,
    });

    await tx.save();

    res.json({
      message: 'Bet placed successfully',
      roundId: round.roundId,
      cryptoAmount,
      priceAtTime: price,
    });
  } catch (err) {
    console.error('Bet error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};
