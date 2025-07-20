const express = require('express');
const router = express.Router();
const pool = require('../db/db');



router.get('/income', async (req, res) => {
  const { agent_id, date } = req.query;

  try {
    const result = await pool.query(
      `SELECT SUM(price) AS total_income
       FROM tickets
       WHERE agent_id = $1 AND DATE(issued_at) = $2`,
      [agent_id, date]
    );
    res.json({ total_income: result.rows[0].total_income || 0 });
  } catch (err) {
    console.error('Income fetch error:', err.message);
    res.status(500).json({ message: 'Error fetching income' });
  }
});
// GET /admin/tickets/search?q=20250702-g1 or card_number
router.get('/search', async (req, res) => {
  const q = req.query.q;

  try {
    const result = await pool.query(
      `SELECT * FROM tickets 
       WHERE card_number ILIKE $1 OR round_id ILIKE $1`,
      [`%${q}%`]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Search tickets error:', err.message);
    res.status(500).json({ message: 'Error searching tickets' });
  }
});
module.exports = router;