// routes/auth.js
const express = require('express');
const router = express.Router();
const pool = require('../db/db'); 
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
require('dotenv').config();

router.post('/login', async (req, res) => {
  const { agentId, username, password } = req.body;

  try {
    const result = await pool.query(
      'SELECT * FROM agents WHERE agent_id = $1 AND username = $2',
      [agentId, username]
    );

    const agent = result.rows[0];
    if (!agent) return res.status(401).json({ message: 'Invalid credentials' });

    const validPassword = await bcrypt.compare(password, agent.password_hash);
    if (!validPassword) return res.status(401).json({ message: 'Invalid credentials' });

    const token = jwt.sign(
      { agentId: agent.agent_id, username: agent.username },
      process.env.JWT_SECRET,
      { expiresIn: '5h' }
    );

    res.json({ token, agent: { agentId: agent.agent_id, username: agent.username } });
  } catch (err) {
    console.error('Login error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
