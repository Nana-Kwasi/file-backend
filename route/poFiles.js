// const express = require('express');
// const router = express.Router();
// const pool = require('../db'); // Import the database connection
// const multer = require('multer');

// // Configure multer for file uploads
// const storage = multer.memoryStorage();
// const upload = multer({ storage });

// // Get all PO files
// router.get('/', async (req, res) => {
//   try {
//     const result = await pool.query('SELECT * FROM po_files ORDER BY id ASC');
//     res.json(result.rows);
//   } catch (error) {
//     console.error('Error fetching PO files:', error);
//     res.status(500).json({ error: 'Error fetching PO files' });
//   }
// });

// // Add a new PO file
// router.post('/', async (req, res) => {
//   const {
//     name,
//     type,
//     date,
//     time,
//     status,
//     sender,
//     username,
//     department,
//     uploaded_by,
//     size,
//     last_modified,
//     content,
//   } = req.body;

//   try {
//     const result = await pool.query(
//       `INSERT INTO po_files (name, type, date, time, status, sender, username, department, uploaded_by, size, last_modified, content)
//        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
//        RETURNING *`,
//       [name, type, date, time, status, sender, username, department, uploaded_by, size, last_modified, content]
//     );
//     res.status(201).json(result.rows[0]);
//   } catch (error) {
//     console.error('Error adding PO file:', error);
//     res.status(500).json({ error: 'Error adding PO file' });
//   }
// });

// // Update PO file status
// router.put('/:id/status', async (req, res) => {
//   const { id } = req.params;
//   const { status } = req.body;

//   try {
//     const result = await pool.query(
//       'UPDATE po_files SET status = $1 WHERE id = $2 RETURNING *',
//       [status, id]
//     );

//     if (result.rows.length === 0) {
//       return res.status(404).json({ error: 'PO file not found' });
//     }

//     res.json(result.rows[0]);
//   } catch (error) {
//     console.error('Error updating PO file status:', error);
//     res.status(500).json({ error: 'Error updating PO file status' });
//   }
// });

// // Upload signed PO file
// router.post('/:id/uploadSigned', upload.single('signedFile'), async (req, res) => {
//   const { id } = req.params;
//   const file = req.file;

//   if (!file) {
//     return res.status(400).json({ error: 'No file uploaded' });
//   }

//   try {
//     const signedContent = `data:${file.mimetype};base64,${file.buffer.toString('base64')}`;

//     const result = await pool.query(
//       `UPDATE po_files
//        SET
//          signed_content = $1,
//          signed_file_name = $2,
//          signed_file_type = $3,
//          status = 'SIGNED'
//        WHERE id = $4
//        RETURNING *`,
//       [signedContent, file.originalname, file.mimetype, id]
//     );

//     if (result.rows.length === 0) {
//       return res.status(404).json({ error: 'PO file not found' });
//     }

//     res.json(result.rows[0]);
//   } catch (error) {
//     console.error('Error uploading signed PO file:', error);
//     res.status(500).json({ error: 'Error uploading signed PO file' });
//   }
// });

// // Download PO file (original or signed)
// router.get('/:id/download', async (req, res) => {
//   const { id } = req.params;
//   const { signed } = req.query; // Pass ?signed=true to download signed file

//   try {
//     const result = await pool.query('SELECT * FROM po_files WHERE id = $1', [id]);

//     if (result.rows.length === 0) {
//       return res.status(404).json({ error: 'PO file not found' });
//     }

//     const file = result.rows[0];
//     const contentField = signed === 'true' ? 'signed_content' : 'content';
//     const fileNameField = signed === 'true' ? 'signed_file_name' : 'name';
//     const fileTypeField = signed === 'true' ? 'signed_file_type' : 'type';

//     const content = file[contentField];
//     const fileName = file[fileNameField];
//     const fileType = file[fileTypeField];

//     if (!content) {
//       return res.status(404).json({ error: 'File content not available' });
//     }

//     const base64Data = content.split(',')[1];
//     const buffer = Buffer.from(base64Data, 'base64');

//     res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
//     res.setHeader('Content-Type', fileType);
//     res.send(buffer);
//   } catch (error) {
//     console.error('Error downloading PO file:', error);
//     res.status(500).json({ error: 'Error downloading PO file' });
//   }
// });

// module.exports = router;

const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const { authenticateToken, isFinanceRole } = require('../route/middleware/auth');

// Set up file storage for PO files
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = path.join(__dirname, '../uploads/purchaseorders');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniquePrefix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniquePrefix + '-' + file.originalname);
  }
});

const upload = multer({ 
  storage: storage,
  limits: { fileSize: 50 * 1024 * 1024 } // 50MB limit
});

// PO status constants
const PO_STATUS = {
  PENDING: 'PENDING',
  APPROVED: 'APPROVED',
  SIGNED: 'SIGNED'
};

// Database mock (replace with actual database operations)
let poFiles = [];

// Upload a single PO file
router.post('/api/purchaseorders/upload', authenticateToken, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file uploaded' });
    }
    
    const newPO = {
      id: uuidv4(),
      name: req.file.originalname,
      type: req.file.mimetype,
      date: new Date().toISOString().split('T')[0],
      time: new Date().toLocaleTimeString(),
      status: PO_STATUS.PENDING,
      sender: req.user.email,
      username: req.user.username,
      department: req.user.department,
      uploadedBy: req.user.email,
      size: (req.file.size / 1024).toFixed(2),
      lastModified: Date.now(),
      filePath: req.file.path,
      signedFilePath: null
    };

    poFiles.push(newPO);

    return res.status(201).json({
      success: true,
      poFile: {
        ...newPO,
        filePath: undefined, // Don't expose the file path to the client
        signedFilePath: undefined
      }
    });
  } catch (error) {
    console.error('Error uploading PO file:', error);
    return res.status(500).json({ success: false, message: 'Error uploading PO file', error: error.message });
  }
});

// Upload multiple PO files
router.post('/api/purchaseorders/upload/multiple', authenticateToken, upload.array('files'), async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ success: false, message: 'No files uploaded' });
    }

    const uploadedPOFiles = req.files.map(file => {
      const newPO = {
        id: uuidv4(),
        name: file.originalname,
        type: file.mimetype,
        date: new Date().toISOString().split('T')[0],
        time: new Date().toLocaleTimeString(),
        status: PO_STATUS.PENDING,
        sender: req.user.email,
        username: req.user.username,
        department: req.user.department,
        uploadedBy: req.user.email,
        size: (file.size / 1024).toFixed(2),
        lastModified: Date.now(),
        filePath: file.path,
        signedFilePath: null
      };

      poFiles.push(newPO);
      return {
        ...newPO,
        filePath: undefined, // Don't expose the file path to the client
        signedFilePath: undefined
      };
    });

    return res.status(201).json({
      success: true,
      poFiles: uploadedPOFiles
    });
  } catch (error) {
    console.error('Error uploading multiple PO files:', error);
    return res.status(500).json({ success: false, message: 'Error uploading PO files', error: error.message });
  }
});

// Get all PO files visible to the user
router.get('/api/purchaseorders', authenticateToken, async (req, res) => {
  try {
    // Pagination
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const startIndex = (page - 1) * limit;
    
    // Filtering
    let filteredPOFiles = [...poFiles];
    
    if (req.query.status) {
      filteredPOFiles = filteredPOFiles.filter(file => file.status === req.query.status);
    }
    
    if (req.query.department) {
      filteredPOFiles = filteredPOFiles.filter(file => file.department === req.query.department);
    }
    
    // Role-based filtering
    if (req.user.department === 'FINANCE') {
      // Finance users can see all PO files
    } else {
      // For department users, show only PO files from their department
      filteredPOFiles = filteredPOFiles.filter(file => file.department === req.user.department);
    }
    
    const total = filteredPOFiles.length;
    
    // Apply pagination
    const paginatedPOFiles = filteredPOFiles.slice(startIndex, startIndex + limit);
    
    // Remove filePaths from response
    const sanitizedPOFiles = paginatedPOFiles.map(file => {
      const { filePath, signedFilePath, ...rest } = file;
      return {
        ...rest,
        hasSignedFile: !!signedFilePath
      };
    });
    
    return res.status(200).json({
      poFiles: sanitizedPOFiles,
      pagination: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Error fetching PO files:', error);
    return res.status(500).json({ success: false, message: 'Error fetching PO files', error: error.message });
  }
});

// Get PO file by ID
router.get('/api/purchaseorders/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const poFile = poFiles.find(file => file.id === id);
    
    if (!poFile) {
      return res.status(404).json({ success: false, message: 'PO file not found' });
    }
    
    // Check if user has access to this PO file
    const hasAccess = req.user.department === 'FINANCE' || poFile.department === req.user.department;
    
    if (!hasAccess) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }
    
    const { filePath, signedFilePath, ...sanitizedPOFile } = poFile;
    
    return res.status(200).json({
      ...sanitizedPOFile,
      downloadUrl: `/api/purchaseorders/${id}/download`,
      hasSignedFile: !!signedFilePath,
      signedDownloadUrl: signedFilePath ? `/api/purchaseorders/${id}/download/signed` : null
    });
  } catch (error) {
    console.error('Error fetching PO file:', error);
    return res.status(500).json({ success: false, message: 'Error fetching PO file', error: error.message });
  }
});

// Download original PO file
router.get('/api/purchaseorders/:id/download', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const poFile = poFiles.find(file => file.id === id);
    
    if (!poFile) {
      return res.status(404).json({ success: false, message: 'PO file not found' });
    }
    
    // Check if user has access to this PO file
    const hasAccess = req.user.department === 'FINANCE' || poFile.department === req.user.department;
    
    if (!hasAccess) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }
    
    return res.download(poFile.filePath, poFile.name);
  } catch (error) {
    console.error('Error downloading PO file:', error);
    return res.status(500).json({ success: false, message: 'Error downloading PO file', error: error.message });
  }
});

// Download signed PO file
router.get('/api/purchaseorders/:id/download/signed', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const poFile = poFiles.find(file => file.id === id);
    
    if (!poFile) {
      return res.status(404).json({ success: false, message: 'PO file not found' });
    }
    
    if (!poFile.signedFilePath) {
      return res.status(404).json({ success: false, message: 'Signed PO file not found' });
    }
    
    // Check if user has access to this PO file
    const hasAccess = req.user.department === 'FINANCE' || poFile.department === req.user.department;
    
    if (!hasAccess) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }
    
    // Extract filename or generate one for the signed file
    const signedFileName = poFile.signedFileName || `signed_${poFile.name}`;
    
    return res.download(poFile.signedFilePath, signedFileName);
  } catch (error) {
    console.error('Error downloading signed PO file:', error);
    return res.status(500).json({ success: false, message: 'Error downloading signed PO file', error: error.message });
  }
});

// Update PO file status (Approve)
router.patch('/api/purchaseorders/:id/approve', authenticateToken, isFinanceRole, async (req, res) => {
  try {
    const { id } = req.params;
    
    const poFileIndex = poFiles.findIndex(file => file.id === id);
    
    if (poFileIndex === -1) {
      return res.status(404).json({ success: false, message: 'PO file not found' });
    }
    
    // Only pending files can be approved
    if (poFiles[poFileIndex].status !== PO_STATUS.PENDING) {
      return res.status(400).json({ 
        success: false, 
        message: 'Only pending PO files can be approved' 
      });
    }
    
    // Update the PO file status
    poFiles[poFileIndex].status = PO_STATUS.APPROVED;
    poFiles[poFileIndex].approvedAt = new Date().toISOString();
    poFiles[poFileIndex].approvedBy = req.user.email;
    
    return res.status(200).json({
      success: true,
      poFile: {
        id: poFiles[poFileIndex].id,
        status: poFiles[poFileIndex].status,
        approvedAt: poFiles[poFileIndex].approvedAt,
        approvedBy: poFiles[poFileIndex].approvedBy
      }
    });
  } catch (error) {
    console.error('Error approving PO file:', error);
    return res.status(500).json({ success: false, message: 'Error approving PO file', error: error.message });
  }
});

// Upload signed PO file
router.post('/api/purchaseorders/:id/upload-signed', authenticateToken, upload.single('file'), async (req, res) => {
  try {
    const { id } = req.params;
    
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file uploaded' });
    }
    
    const poFileIndex = poFiles.findIndex(file => file.id === id);
    
    if (poFileIndex === -1) {
      return res.status(404).json({ success: false, message: 'PO file not found' });
    }
    
    // Check if the user has permission to upload a signed file
    const hasAccess = req.user.department === 'FINANCE';
    
    if (!hasAccess) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }
    
    // Update the PO file with signed file info
    poFiles[poFileIndex].status = PO_STATUS.SIGNED;
    poFiles[poFileIndex].signedAt = new Date().toISOString();
    poFiles[poFileIndex].signedBy = req.user.email;
    poFiles[poFileIndex].signedFilePath = req.file.path;
    poFiles[poFileIndex].signedFileName = req.file.originalname;
    poFiles[poFileIndex].signedFileType = req.file.mimetype;
    
    return res.status(200).json({
      success: true,
      poFile: {
        id: poFiles[poFileIndex].id,
        status: poFiles[poFileIndex].status,
        signedAt: poFiles[poFileIndex].signedAt,
        signedBy: poFiles[poFileIndex].signedBy,
        signedFileName: poFiles[poFileIndex].signedFileName
      }
    });
  } catch (error) {
    console.error('Error uploading signed PO file:', error);
    return res.status(500).json({ success: false, message: 'Error uploading signed PO file', error: error.message });
  }
});

module.exports = router;
