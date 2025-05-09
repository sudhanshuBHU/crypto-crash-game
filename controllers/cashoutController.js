const Player = require('../models/Player');
const GameRound = require('../models/GameRound');
const Transaction = require('../models/Transaction');
const { convertCryptoToUsd } = require('../utils/conversion');
const crypto = require('crypto');

exports.cashOut = async (req, res) => {
  const { playerId, roundId, currentMultiplier } = req.body;

  if (!playerId || !roundId || !currentMultiplier) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  try {
    const round = await GameRound.findOne({ roundId });
    if (!round || round.ended) {
      return res.status(400).json({ error: 'Round not active or already ended' });
    }

    const bet = round.bets.find(
      (b) => b.playerId.toString() === playerId && !b.cashedOut
    );

    if (!bet) {
      return res.status(400).json({ error: 'No active bet found or already cashed out' });
    }

    // Calculate payout
    const payoutCrypto = bet.cryptoAmount * currentMultiplier;
    const { usd: payoutUsd, price } = await convertCryptoToUsd(payoutCrypto, bet.currency);

    // Update player balance
    const player = await Player.findById(playerId);
    player.wallet[bet.currency] += payoutCrypto;
    await player.save();

    // Update bet in round
    bet.cashedOut = true;
    bet.cashoutMultiplier = currentMultiplier;
    bet.payoutUsd = payoutUsd;
    await round.save();

    // Log transaction
    const tx = new Transaction({
      playerId,
      usdAmount: payoutUsd,
      cryptoAmount: payoutCrypto,
      currency: bet.currency,
      type: 'cashout',
      transactionHash: crypto.randomBytes(8).toString('hex'),
      priceAtTime: price,
    });

    await tx.save();

    res.json({
      message: 'Cashout successful',
      payoutCrypto,
      payoutUsd,
      priceAtTime: price,
    });
  } catch (err) {
    console.error('Cashout error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};
