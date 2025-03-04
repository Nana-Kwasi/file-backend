const express = require('express');
const router = express.Router();
const pool = require('../db'); // Import the database connection
const multer = require('multer');

// Configure multer for file uploads
const storage = multer.memoryStorage();
const upload = multer({ storage });

// Get all PO files
router.get('/', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM po_files ORDER BY id ASC');
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching PO files:', error);
    res.status(500).json({ error: 'Error fetching PO files' });
  }
});

// Add a new PO file
router.post('/', async (req, res) => {
  const {
    name,
    type,
    date,
    time,
    status,
    sender,
    username,
    department,
    uploaded_by,
    size,
    last_modified,
    content,
  } = req.body;

  try {
    const result = await pool.query(
      `INSERT INTO po_files (name, type, date, time, status, sender, username, department, uploaded_by, size, last_modified, content)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
       RETURNING *`,
      [name, type, date, time, status, sender, username, department, uploaded_by, size, last_modified, content]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error adding PO file:', error);
    res.status(500).json({ error: 'Error adding PO file' });
  }
});

// Update PO file status
router.put('/:id/status', async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  try {
    const result = await pool.query(
      'UPDATE po_files SET status = $1 WHERE id = $2 RETURNING *',
      [status, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'PO file not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating PO file status:', error);
    res.status(500).json({ error: 'Error updating PO file status' });
  }
});

// Upload signed PO file
router.post('/:id/uploadSigned', upload.single('signedFile'), async (req, res) => {
  const { id } = req.params;
  const file = req.file;

  if (!file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }

  try {
    const signedContent = `data:${file.mimetype};base64,${file.buffer.toString('base64')}`;

    const result = await pool.query(
      `UPDATE po_files
       SET
         signed_content = $1,
         signed_file_name = $2,
         signed_file_type = $3,
         status = 'SIGNED'
       WHERE id = $4
       RETURNING *`,
      [signedContent, file.originalname, file.mimetype, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'PO file not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error uploading signed PO file:', error);
    res.status(500).json({ error: 'Error uploading signed PO file' });
  }
});

// Download PO file (original or signed)
router.get('/:id/download', async (req, res) => {
  const { id } = req.params;
  const { signed } = req.query; // Pass ?signed=true to download signed file

  try {
    const result = await pool.query('SELECT * FROM po_files WHERE id = $1', [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'PO file not found' });
    }

    const file = result.rows[0];
    const contentField = signed === 'true' ? 'signed_content' : 'content';
    const fileNameField = signed === 'true' ? 'signed_file_name' : 'name';
    const fileTypeField = signed === 'true' ? 'signed_file_type' : 'type';

    const content = file[contentField];
    const fileName = file[fileNameField];
    const fileType = file[fileTypeField];

    if (!content) {
      return res.status(404).json({ error: 'File content not available' });
    }

    const base64Data = content.split(',')[1];
    const buffer = Buffer.from(base64Data, 'base64');

    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.setHeader('Content-Type', fileType);
    res.send(buffer);
  } catch (error) {
    console.error('Error downloading PO file:', error);
    res.status(500).json({ error: 'Error downloading PO file' });
  }
});

module.exports = router;
