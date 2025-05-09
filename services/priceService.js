const axios = require('axios');

let cache = {};
let lastFetch = 0;
const CACHE_DURATION = 10000; // 10 seconds

const fetchPrices = async () => {
  const now = Date.now();
  if (now - lastFetch < CACHE_DURATION && cache) {
    // console.log('Using cached prices:', cache);    
    return cache;
  }

  try {
    const res = await axios.get(
      `${process.env.CRYPTO_API}/simple/price`,
      {
        params: {
          ids: 'bitcoin,ethereum',
          vs_currencies: 'usd',
        },
      }
    );
    const prices = {
      BTC: res.data.bitcoin.usd,
      ETH: res.data.ethereum.usd,
    };

    cache = prices;
    lastFetch = now;
    // console.log('Fetched new prices:', prices);
    return prices;
  } catch (err) {
    console.error('Error fetching crypto prices:', err.message);
    return cache;
  }
};

module.exports = { fetchPrices };
