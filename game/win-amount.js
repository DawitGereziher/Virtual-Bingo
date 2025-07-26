const express = require('express');
const router = express.Router();
const pool = require('../db/db'); // adjust path as needed
const verifyAgent = require('../middleware/verifyAgent');

router.get('/win-amount', verifyAgent, async (req, res) => {
  const agentId = req.agent.agentId;
  const { roundId } = req.query;

  if (!roundId) {
    return res.status(400).json({ error: 'Missing roundId in query' });
  }

  try {
    const result = await pool.query(
      `SELECT COALESCE(SUM(price), 0) as total_sales
       FROM tickets
       WHERE agent_id = $1 AND round_id = $2`,
      [agentId, roundId]
    );

    const totalSales = parseFloat(result.rows[0].total_sales || 0);
    const winAmount = totalSales * 0.7;

    res.json({ winAmount, totalSales });
  } catch (err) {
    console.error('Error getting win amount:', err);
    res.status(500).json({ error: 'Server error calculating win amount' });
  }
});

module.exports = router;
