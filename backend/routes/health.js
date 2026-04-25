// routes/health.js
const express = require('express');
const router  = express.Router();
const { pool } = require('../config/db');

// GET /api/health
// Used by CI/CD and load balancers to verify the server is alive
router.get('/', async (req, res) => {
  try {
    await pool.execute('SELECT 1');
    res.json({
      success: true,
      status:  'ok',
      service: 'High School Management API',
      db:      'connected',
      time:    new Date().toISOString(),
      env:     process.env.NODE_ENV,
    });
  } catch {
    res.status(503).json({ success: false, status: 'db_error', db: 'disconnected' });
  }
});

module.exports = router;
