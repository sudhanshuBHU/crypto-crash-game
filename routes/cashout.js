const express = require('express');
const router = express.Router();
const { cashOut } = require('../controllers/cashoutController');

router.post('/', cashOut);

module.exports = router;
