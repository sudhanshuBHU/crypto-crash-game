const GameRound = require('../models/GameRound');
const { getCrashPoint } = require('../utils/crashPoint');
const crypto = require('crypto');
const { Server } = require('socket.io');

const Player = require('../models/Player');
const { convertUsdToCrypto, convertCryptoToUsd } = require('../utils/conversion');
const Transaction = require('../models/Transaction');

const { fetchPrices } = require('../services/priceService');

// let currentRound = null;
// let multiplierInterval = null;
let io = null;

function startGameLoop(httpServer) {
    io = new Server(httpServer, {
        cors: { origin: "*" }
    });

    io.on('connection', socket => {
        console.log(`New client connected with socket ID: ${socket.id}`);

        socket.on('cashout', async ({ playerId, socketId, roundId, multiplier }) => {
            try {
                // if (!currentRound || currentRound.roundId !== roundId || currentRound.ended) {
                //     return socket.emit('cashoutError', { error: 'Invalid or ended round' });
                // }

                const round = await GameRound.findOne({
                    roundId,
                    ended: false,
                    'bets.playerId': playerId,
                    'bets.cashedOut': false
                });

                // console.log('Round:', round);

                if (!round) {
                    return socket.emit('cashoutError', { error: 'No active bet to cash out' });
                }

                const bet = round.bets.find(b => b.playerId.toString() === playerId);
                if (!bet) {
                    return socket.emit('cashoutError', { error: 'Bet not found' });
                }

                // console.log('Bet:', bet);

                const payoutCrypto = bet.cryptoAmount * multiplier;
                const { usd: payoutUsd, price } = await convertCryptoToUsd(payoutCrypto, bet.currency);
                // console.log('Payout:', { payoutCrypto, payoutUsd, price });

                // Atomic wallet update
                const player = await Player.findByIdAndUpdate(
                    playerId,
                    { $inc: { [`wallet.${bet.currency}`]: payoutCrypto } },
                    { new: true }
                );

                // Atomic bet update
                await GameRound.updateOne(
                    {
                        roundId,
                        'bets.playerId': playerId,
                        'bets.cashedOut': false
                    },
                    {
                        $set: {
                            'bets.$.cashedOut': true,
                            'bets.$.cashoutMultiplier': multiplier,
                            'bets.$.payoutUsd': payoutUsd
                        }
                    }
                );

                // Record transaction
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

                io.to(socketId).emit('updateBalance', player.wallet);
                io.emit('playerCashout', {
                    playerId,
                    roundId,
                    multiplier,
                    payoutUsd,
                });

            } catch (err) {
                console.error('WebSocket cashout error:', err);
                socket.emit('cashoutError', { error: 'Internal server error' });
            }
        });
        socket.on('disconnect', () => {
            console.log('Client disconnected');
        });
        socket.on('getPlayerList', async ({ socketId }) => {
            try {
                const players = await Player.find({});
                const playerList = players.map(player => ({
                    id: player._id,
                    name: player.username,
                }));
                io.to(socketId).emit('playerList', { playerList });
            } catch (err) {
                console.error('Error fetching player list:', err);
                io.to(socketId).emit('playerListError', { error: 'Failed to fetch player list' });
            }
        });
        socket.on('selectPlayer', async ({ playerId, socketId }) => {
            try {
                const player = await Player.findById(playerId);
                if (!player) return io.to(socketId).emit('selectPlayerError', { error: 'Player not found' });
                io.to(socketId).emit('updateBalance', player.wallet);
            } catch (err) {
                console.error('Error selecting player:', err);
                io.to(socketId).emit('selectPlayerError', { error: 'Failed to select player' });
            }
        });
        socket.on('placeBet', async ({ playerId, socketId, usdAmount, currency, roundId }) => {

            // console.log('Placing bet:', { playerId, usdAmount, currency, roundId });

            if (!playerId || !usdAmount || !currency || usdAmount <= 0) {
                return io.to(socketId).emit('placeBetError', { error: 'Invalid input data' });
            }

            try {
                const player = await Player.findById(playerId);
                // console.log('Player:', player);

                if (!player) {
                    return io.to(socketId).emit('placeBetError', { error: 'Player not found' });
                }

                const round = await GameRound.findOne({ roundId });
                if (!round) {
                    return io.to(socketId).emit('placeBetError', { error: 'Round not found' });
                }

                const alreadyBet = round.bets.some(b => b.playerId.toString() === playerId);
                // console.log('Already Bet:', alreadyBet);
                
                if (alreadyBet) {
                    return io.to(socketId).emit('placeBetError', { error: 'Bet already placed for this round' });
                }

                const { cryptoAmount, price } = await convertUsdToCrypto(usdAmount, currency);
                // console.log('Crypto Amount:', cryptoAmount);
                // console.log('Price:', price);
                

                if (player.wallet[currency] < cryptoAmount) {
                    return io.to(socketId).emit('placeBetError', { error: 'Insufficient balance' });
                }

                // Atomic wallet deduction
                const updatedPlayer = await Player.findByIdAndUpdate(
                    playerId,
                    { $inc: { [`wallet.${currency}`]: -cryptoAmount } },
                    { new: true }
                );

                // Atomic push to round bets
                const updatedRound = await GameRound.findOneAndUpdate(
                    { roundId },
                    {
                        $push: {
                            bets: {
                                playerId,
                                usdAmount,
                                cryptoAmount,
                                currency,
                                cashedOut: false,
                                cashoutMultiplier: null,
                                payoutUsd: null
                            }
                        }
                    },
                    { new: true }
                );

                // console.log('Updated Round:', updatedRound);
                // console.log('Updated Player:', updatedPlayer);



                if (!updatedRound) {
                    return io.to(socketId).emit('placeBetError', { error: 'Round not found' });
                }

                // Transaction log
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

                io.to(socketId).emit('updateBalance', updatedPlayer.wallet);
                io.to(socketId).emit('betPlaced', {
                    roundId,
                    usdAmount,
                    cryptoAmount,
                    currency
                });

            } catch (error) {
                console.error('Error placing bet:', error);
                io.to(socketId).emit('placeBetError', { error: 'Internal server error' });
            }
        });

    });
    runGameLoop();
}

async function runGameLoop() {
    while (true) {
        const countdownSeconds = 10;

        const price = await fetchPrices();
        io.emit('currentPrice', { price });

        // Countdown before round starts
        for (let i = countdownSeconds; i > 0; i--) {
            io.emit('countdown', { seconds: i });
            await new Promise(resolve => setTimeout(resolve, 1000));
        }

        io.emit('currentPrice', { price });

        // Start the round and get the roundId back
        const roundId = await beginRound();

        io.emit('roundEnd', { roundId });

        await new Promise(resolve => setTimeout(resolve, 1000));
    }
}

async function beginRound() {
    const seed = crypto.randomBytes(16).toString('hex');
    const crashMultiplier = getCrashPoint(seed);
    const roundId = crypto.randomUUID();

    const newRound = new GameRound({
        roundId,
        startTime: new Date(),
        crashMultiplier,
        bets: [],
    });

    await newRound.save();

    io.emit('roundStart', {
        roundId,
        startTime: newRound.startTime,
        seed,
        crashMultiplier: "hidden",
    });

    const price = await fetchPrices();
    io.emit('currentPrice', { price });

    let multiplier = 1.0;
    const startTime = Date.now();
    const growthFactor = 0.6;

    return new Promise((resolve) => {
        const interval = setInterval(async () => {
            const timeElapsed = (Date.now() - startTime) / 1000;
            multiplier = +Math.exp(timeElapsed * growthFactor).toFixed(2);

            io.emit('multiplierUpdate', { multiplier });

            if (multiplier >= crashMultiplier) {
                clearInterval(interval);

                // Safely update only this round (by ID)
                await GameRound.updateOne(
                    { roundId },
                    { $set: { ended: true } }
                );

                io.emit('multiplierUpdate', { multiplier: crashMultiplier });
                io.emit('roundCrash', {
                    roundId,
                    crashMultiplier,
                });

                resolve(roundId);
            }
        }, 100);
    });
}

module.exports = { startGameLoop };
