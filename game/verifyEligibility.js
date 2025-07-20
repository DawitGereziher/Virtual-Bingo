// GET /agents/eligibility
const express = require('express');
const router = express.Router();
const pool = require('../db/db');
const verifyAgent = require('../middleware/verifyAgent');
const { getNextRoundInfo } = require('./bingoSocket');

router.get('/eligibility', verifyAgent, async (req, res) => {
  const agentId = req.agent.agentId;

  try {
    const nextRound = getNextRoundInfo();

    if (!nextRound) {
      return res.status(404).json({ error: 'No upcoming round found.' });
    }

    const { round_id } = nextRound;

    const result = await pool.query(
      `SELECT COALESCE(SUM(price), 0) AS round_total
       FROM tickets
       WHERE agent_id = $1 AND round_id = $2`,
      [agentId, round_id]
    );

    const roundTotal = parseFloat(result.rows[0].round_total || 0);

    if (roundTotal >= 215) {
      return res.json({ eligible: true, roundId: round_id });
    } else {
      return res.json({
        eligible: false,
        roundId: round_id,
        message: `You need to sell at least 215 ETB worth of tickets for round ${round_id}. Currently: ${roundTotal} ETB.`,
        currentTotal: roundTotal,
      });
    }

  } catch (err) {
    console.error('Eligibility check failed:', err.message);
    res.status(500).json({ error: 'Server error during eligibility check.' });
  }
});

module.exports = router;
