const express = require('express');
const router = express.Router();
const pool = require('../db/db');
const bcrypt = require('bcrypt');



// POST /admin/agents
router.post('/', async (req, res) => {
  const {
    agent_id,
    username,
    password,
    full_name,
    city,
    phone_number,
    address_detail,
    collateral
  } = req.body;

  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    await pool.query(
      `INSERT INTO agents (
        agent_id, username, password_hash,
        full_name, city, phone_number, address_detail, collateral
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        agent_id,
        username,
        hashedPassword,
        full_name,
        city,
        phone_number,
        address_detail,
        collateral
      ]
    );
    res.status(201).json({ message: '✅ Agent created successfully' });
  } catch (err) {
    console.error('Create agent error:', err.message);
    res.status(500).json({ message: 'Error creating agent' });
  }
});


// GET /admin/agents - Get all agents
router.get('/', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT agent_id, username, full_name, city, phone_number, address_detail, collateral
       FROM agents
       ORDER BY full_name ASC`
    )
    res.json(result.rows)
  } catch (err) {
    console.error('Fetch all agents error:', err.message)
    res.status(500).json({ message: 'Error fetching agents' })
  }
})



// PUT /admin/agents/:agentId
router.put('/:agentId', async (req, res) => {
  const {
    username,
    password,
    full_name,
    city,
    phone_number,
    address_detail,
    collateral
  } = req.body;

  try {
    if (password) {
      const hashedPassword = await bcrypt.hash(password, 10);
      await pool.query(
        `UPDATE agents
         SET username = $1, password = $2, full_name = $3, city = $4,
             phone_number = $5, address_detail = $6, collateral = $7
         WHERE agent_id = $8`,
        [
          username,
          hashedPassword,
          full_name,
          city,
          phone_number,
          address_detail,
          collateral,
          req.params.agentId
        ]
      );
    } else {
      await pool.query(
        `UPDATE agents
         SET username = $1, full_name = $2, city = $3,
             phone_number = $4, address_detail = $5, collateral = $6
         WHERE agent_id = $7`,
        [
          username,
          full_name,
          city,
          phone_number,
          address_detail,
          collateral,
          req.params.agentId
        ]
      );
    }

    res.json({ message: '✅ Agent updated successfully' });
  } catch (err) {
    console.error('Update agent error:', err.message);
    res.status(500).json({ message: 'Error updating agent' });
  }
});

// DELETE /admin/agents/:agentId
router.delete('/:agentId', async (req, res) => {
  try {
    await pool.query(`DELETE FROM agents WHERE agent_id = $1`, [req.params.agentId]);
    res.json({ message: 'Agent deleted' });
  } catch (err) {
    console.error('Delete agent error:', err.message);
    res.status(500).json({ message: 'Error deleting agent' });
  }
});

// GET /admin/agents/search?q=...
router.get('/search', async (req, res) => {
  const q = req.query.q;
  try {
    const result = await pool.query(
      `SELECT agent_id, username, full_name, city, phone_number, address_detail, collateral
       FROM agents 
       WHERE agent_id ILIKE $1 OR username ILIKE $1 OR full_name ILIKE $1`,
      [`%${q}%`]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Search agents error:', err.message);
    res.status(500).json({ message: 'Error searching agents' });
  }
});

module.exports = router;