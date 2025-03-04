const express = require('express');
const router = express.Router();
const pool = require('../db'); // Import the database connection

// Get all invoices
router.get('/', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM invoices ORDER BY id ASC');
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching invoices:', error);
    res.status(500).json({ error: 'Error fetching invoices' });
  }
});

// Add a new invoice
router.post('/', async (req, res) => {
  const {
    name,
    type,
    date,
    time,
    status,
    amount,
    sender,
    department,
    uploaded_by,
    size,
    last_modified,
    content,
  } = req.body;

  try {
    const result = await pool.query(
      `INSERT INTO invoices (name, type, date, time, status, amount, sender, department, uploaded_by, size, last_modified, content)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
       RETURNING *`,
      [name, type, date, time, status, amount, sender, department, uploaded_by, size, last_modified, content]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error adding invoice:', error);
    res.status(500).json({ error: 'Error adding invoice' });
  }
});

// Update invoice status
router.put('/:id/status', async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  try {
    const result = await pool.query(
      'UPDATE invoices SET status = $1 WHERE id = $2 RETURNING *',
      [status, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Invoice not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating invoice status:', error);
    res.status(500).json({ error: 'Error updating invoice status' });
  }
});

// Download invoice content
router.get('/:id/download', async (req, res) => {
  const { id } = req.params;

  try {
    const result = await pool.query(
      'SELECT name, content, type FROM invoices WHERE id = $1',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Invoice not found' });
    }

    const invoice = result.rows[0];
    const content = invoice.content.split(',')[1]; // Remove data URL prefix
    const buffer = Buffer.from(content, 'base64');

    res.setHeader('Content-Disposition', `attachment; filename="${invoice.name}"`);
    res.setHeader('Content-Type', invoice.type);
    res.send(buffer);
  } catch (error) {
    console.error('Error downloading invoice:', error);
    res.status(500).json({ error: 'Error downloading invoice' });
  }
});

module.exports = router;
