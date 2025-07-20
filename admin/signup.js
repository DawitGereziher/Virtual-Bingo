// routes/admin/signup.js
const express = require('express');
const bcrypt = require('bcrypt');
const pool = require('../db/db');
const router = express.Router();

router.post('/', async (req, res) => {
  const { username, password, full_name, role = 'admin' } = req.body;

  try {
    const hashedPassword = await bcrypt.hash(password, 10);

    await pool.query(
      `INSERT INTO users (username, password_hash, full_name, role)
       VALUES ($1, $2, $3, $4)`,
      [username, hashedPassword, full_name, role]
    );

    res.status(201).json({ message: 'Admin created successfully' });
  } catch (err) {
    console.error('Signup error:', err.message);
    res.status(500).json({ message: 'Error creating admin' });
  }
});

module.exports = router;
