const { fetchPrices } = require('../services/priceService');

const convertUsdToCrypto = async (usd, currency) => {
  const prices = await fetchPrices();
  if (!prices[currency]) throw new Error(`Unsupported currency: ${currency}`);

  const cryptoAmount = usd / prices[currency];
  return { cryptoAmount, price: prices[currency] };
};

const convertCryptoToUsd = async (cryptoAmount, currency) => {
  const prices = await fetchPrices();
  
  if (!prices[currency]) throw new Error(`Unsupported currency: ${currency}`);

  const usd = cryptoAmount * prices[currency];
  return { usd, price: prices[currency] };
};

module.exports = { convertUsdToCrypto, convertCryptoToUsd };
