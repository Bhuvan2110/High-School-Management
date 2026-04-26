// routes/health.js
const express = require('express');
const router  = express.Router();
const { pool } = require('../config/db');

// GET /api/health
router.get('/', async (req, res) => {
  try {
    await pool.execute('SELECT 1');
    res.json({ success: true, status: 'ok', service: 'High School Management API', db: 'connected', time: new Date().toISOString(), env: process.env.NODE_ENV });
  } catch {
    res.status(503).json({ success: false, status: 'db_error', db: 'disconnected' });
  }
});

// GET /api/health/registration-data  — public, used by login/register page
router.get('/registration-data', async (req, res) => {
  try {
    const { pool } = require('../config/db');
    const [[classes], [sections], [subjects]] = await Promise.all([
      pool.execute('SELECT id, class_name FROM classes ORDER BY class_name'),
      pool.execute(`SELECT s.id, s.section_name, s.class_id, c.class_name
                   FROM sections s JOIN classes c ON c.id=s.class_id ORDER BY c.class_name, s.section_name`),
      pool.execute('SELECT id, subject_name FROM subjects WHERE is_active=TRUE ORDER BY subject_name'),
    ]);
    res.json({ success: true, data: { classes, sections, subjects } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
