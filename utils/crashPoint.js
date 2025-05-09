const crypto = require('crypto');

// Example: deterministic crash point generator
function getCrashPoint(seed) {
  const hash = crypto.createHash('sha256').update(seed).digest('hex');
  const intVal = parseInt(hash.slice(0, 8), 16);
  const max = 10000;
  const result = (intVal % max) / 100;

  // Force a minimum of 1.00x and up to 100.00x
  return Math.max(1.00, result < 1.01 ? 1.01 : result);
}

module.exports = { getCrashPoint };
