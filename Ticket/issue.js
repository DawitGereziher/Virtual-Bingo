// routes/tickets.js
const express = require('express');
const router = express.Router();
const pool = require('../db/db'); // PostgreSQL pool
const { v4: uuidv4 } = require('uuid');
const verifyAgent = require('../middleware/verifyAgent');
const { getNextRoundInfo } = require('../game/bingoSocket'); // import round info

// POST /tickets/issue
router.post('/issue', verifyAgent, async (req, res) => {
  const { cardNumber, price } = req.body;

 const agentId = req.agent.agentId; 

  if (!agentId || !cardNumber || !price) {
    return res.status(400).json({ error: 'Missing required fields.' });
  }

  try {
    // Get next round from game engine (live)
    const round = getNextRoundInfo();

    if (!round) {
      return res.status(500).json({ error: 'No upcoming round available.' });
    }

    const {
      round_id,
      pattern,
      round_start_time
    } = round;

    // Insert ticket
    const result = await pool.query(`
      INSERT INTO tickets (
        ticket_id,
        agent_id,
        round_id,
        pattern,
        round_started_at,
        card_number,
        price
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `, [
      uuidv4(),         // ticket_id
      agentId,
      round_id,
      pattern,
      round_start_time,
      cardNumber,
      price
    ]);

    const ticket = result.rows[0];

    res.status(201).json({ ticket });

  } catch (err) {
    console.error('🎟️ Ticket issuing failed:', err.message);
    if (err.code === '23505') {
      res.status(409).json({ error: 'Card number already exists.' });
    } else {
      res.status(500).json({ error: 'Server error' });
    }
  }
});

// routes/tickets.js
router.post('/verify', verifyAgent, async (req, res) => {
  const { roundId, cardNumber } = req.body;

  try {
    const result = await pool.query(
      `SELECT * FROM tickets WHERE round_id = $1 AND card_number = $2`,
      [roundId, cardNumber]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: '❌ No ticket found for this card and round' });
    }

    res.json({ message: '✅ Ticket is valid', ticket: result.rows[0] });
  } catch (err) {
    console.error('Ticket verify error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
});


// DELETE /tickets/cancel
router.delete('/cancel', verifyAgent, async (req, res) => {
  const { cardNumber } = req.body;
  const agentId = req.agent.agentId;

  if (!cardNumber) {
    return res.status(400).json({ error: 'Card number is required.' });
  }

  try {
    const round = getNextRoundInfo();
    if (!round) {
      return res.status(400).json({ error: 'No upcoming round available for cancellation.' });
    }

    const { round_id } = round;

    // Delete the ticket for this agent and round before it starts
    const result = await pool.query(`
      DELETE FROM tickets 
      WHERE card_number = $1 AND round_id = $2 AND agent_id = $3
      RETURNING *
    `, [cardNumber, round_id, agentId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Ticket not found or cannot be cancelled.' });
    }

    res.json({ message: '✅ Ticket successfully cancelled.', cancelledTicket: result.rows[0] });
  } catch (err) {
    console.error('❌ Ticket cancellation failed:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});


router.get('/income', verifyAgent, async (req, res) => {
  const { date } = req.query;
  const agentId = req.agent.agentId;

  try {
    const result = await pool.query(
      `SELECT SUM(price) AS total_income
       FROM tickets
       WHERE agent_id = $1 AND DATE(issued_at) = $2`,
      [agentId, date]
    );
    res.json({ total_income: result.rows[0].total_income || 0 });
  } catch (err) {
    console.error('Income fetch error:', err.message);
    res.status(500).json({ message: 'Error fetching income' });
  }
});


module.exports = router;
