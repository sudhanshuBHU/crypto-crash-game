const express = require('express');
const router = express.Router();
const { fetchPrices } = require('../services/priceService');

router.get('/prices', async (req, res) => {
  try {
    const prices = await fetchPrices();
    res.json(prices);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch prices' });
  }
});

module.exports = router;
