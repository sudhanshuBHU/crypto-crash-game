const GameRound = require('../models/GameRound');
const { getCrashPoint } = require('../utils/crashPoint');
const crypto = require('crypto');
const { Server } = require('socket.io');

const Player = require('../models/Player');
const { convertUsdToCrypto } = require('../utils/conversion');
const Transaction = require('../models/Transaction');

const { fetchPrices } = require('../services/priceService');

let currentRound = null;
let multiplierInterval = null;
let io = null;

function startGameLoop(httpServer) {
    io = new Server(httpServer, {
        cors: { origin: "*" }
    });

    io.on('connection', socket => {
        console.log(`New client connected with socket ID: ${socket.id}`);
        socket.on('cashout', async ({ playerId, roundId, multiplier }) => {
            try {
                if (!currentRound || currentRound.roundId !== roundId || currentRound.ended) {
                    return socket.emit('cashoutError', { error: 'Invalid or ended round' });
                }

                const bet = currentRound.bets.find(
                    (b) => b.playerId.toString() === playerId && !b.cashedOut
                );
                if (!bet) {
                    return socket.emit('cashoutError', { error: 'No active bet to cash out' });
                }

                const payoutCrypto = bet.cryptoAmount * multiplier;
                const { usd: payoutUsd, price } = await convertCryptoToUsd(payoutCrypto, bet.currency);

                const player = await Player.findById(playerId);
                player.wallet[bet.currency] += payoutCrypto;
                await player.save();

                bet.cashedOut = true;
                bet.cashoutMultiplier = multiplier;
                bet.payoutUsd = payoutUsd;
                await currentRound.save();

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
        socket.on('placeBet', async ({ playerId, socketId, usdAmount, currency, roundId }) => { // playerId is _id of player model
            // console.log('Placing bet:', { playerId, usdAmount, currency, roundId });
            if (!playerId || !usdAmount || !currency) {
                io.to(socketId).emit('placeBetError', { error: 'Missing required fields' });
                return;
            }
            if (usdAmount <= 0) {
                io.to(socketId).emit('placeBetError', { error: 'USD amount must be positive' });
                return;
            }
            try {
                const player = await Player.findById(playerId);
                // console.log('Player:', player);
                
                if (!player){
                    io.to(socketId).emit('placeBetError', { error: 'Player not found' });
                    return;
                }
                const { cryptoAmount, price } = await convertUsdToCrypto(usdAmount, currency);
                // console.log('Crypto Amount:', cryptoAmount);
                // console.log('Price:', price);
                
                if (player.wallet[currency] < cryptoAmount) {
                    io.to(socketId).emit('placeBetError', { error: 'Insufficient crypto balance' });
                    return;
                }
                player.wallet[currency] -= cryptoAmount;
                await player.save();

                let round = await GameRound.findOne({ roundId });
                if(!round){
                    io.to(socketId).emit('placeBetError', { error: 'Round not found' });
                    return;
                }

                round.bets.push({
                    playerId,
                    usdAmount,
                    cryptoAmount,
                    currency
                });

                await round.save();

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

                io.to(socketId).emit('updateBalance', player.wallet);
                io.to(socketId).emit('betPlaced', { roundId, usdAmount, cryptoAmount, currency });


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
        // 5 second countdown before starting a new round
        for (let i = countdownSeconds; i > 0; i--) {
            io.emit('countdown', { seconds: i });
            await new Promise(resolve => setTimeout(resolve, 1000));
        }

        io.emit('currentPrice', { price });
        await beginRound();
        io.emit('roundEnd', { roundId: currentRound.roundId });
        currentRound = null; // Reset current round

        await new Promise(resolve => setTimeout(resolve, 1000));
    }
}

async function beginRound() {
    const seed = crypto.randomBytes(16).toString('hex');
    const crashMultiplier = getCrashPoint(seed);

    currentRound = new GameRound({
        roundId: crypto.randomUUID(),
        startTime: new Date(),
        crashMultiplier,
        bets: [],
    });

    await currentRound.save();

    io.emit('roundStart', {
        roundId: currentRound.roundId,
        startTime: currentRound.startTime,
        seed,
        crashMultiplier: "hidden",
    });
    io.emit('currentPrice', { price: await fetchPrices() });

    let multiplier = 1.0;
    let startTime = Date.now();
    const growthFactor = 1;

    return new Promise(resolve => {
        multiplierInterval = setInterval(async () => {
            const timeElapsed = Math.max((Date.now() - startTime) / 1000, 0);
            multiplier = +(Math.exp(timeElapsed * growthFactor)).toFixed(2);

            io.emit('multiplierUpdate', { multiplier });

            if (multiplier >= crashMultiplier) {
                clearInterval(multiplierInterval);
                currentRound.ended = true;
                await currentRound.save();

                io.emit('multiplierUpdate', { multiplier: crashMultiplier });

                io.emit('roundCrash', {
                    roundId: currentRound.roundId,
                    crashMultiplier,
                });

                resolve(); // signal that round is done
            }
        }, 100);
    });
}

// async function beginRound() {
//     const seed = crypto.randomBytes(16).toString('hex');
//     const crashMultiplier = getCrashPoint(seed);

//     currentRound = new GameRound({
//         roundId: crypto.randomUUID(),
//         startTime: new Date(),
//         crashMultiplier,
//         bets: [],
//     });

//     await currentRound.save();

//     io.emit('roundStart', {
//         roundId: currentRound.roundId,
//         startTime: currentRound.startTime,
//         seed,
//         crashMultiplier: "hidden",
//     });

//     let multiplier = 1.0;
//     let startTime = Date.now();
//     const growthFactor = 0.07; // Adjust growth factor

//     multiplierInterval = setInterval(async () => {
//         const timeElapsed = Math.max((Date.now() - startTime) / 1000, 0); // Ensure non-negative time in seconds
//         multiplier = +(Math.exp(timeElapsed * growthFactor)).toFixed(2); // Exponential growth formula

//         io.emit('multiplierUpdate', { multiplier });

//         if (multiplier >= crashMultiplier) {
//             clearInterval(multiplierInterval);
//             currentRound.ended = true;
//             await currentRound.save();

//             io.emit('roundCrash', {
//                 roundId: currentRound.roundId,
//                 crashMultiplier,
//             });
//         }
//     }, 100); // update every 100ms
// }


module.exports = { startGameLoop };
