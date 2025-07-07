
const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const { authenticateToken, isFinanceRole } = require('../route/middleware/auth'); // Adjust path if needed

// Set up file storage
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = path.join(__dirname, '../uploads/invoices');
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

// Invoice status constants
const INVOICE_STATUS = {
  PENDING: 'PENDING',
  REVIEW_1: 'First Approve',
  REVIEW_2: 'Second Approve',
  REVIEW_3: 'Third Approve',
  PAID: 'Paid',
};

// Database mock (replace with actual database operations)
let invoices = [];

// Upload a single invoice
router.post('/api/invoices/upload', authenticateToken, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file uploaded' });
    }

    const { amount } = req.body;
    
    const newInvoice = {
      id: uuidv4(),
      name: req.file.originalname,
      type: req.file.mimetype,
      date: new Date().toISOString().split('T')[0],
      time: new Date().toLocaleTimeString(),
      status: INVOICE_STATUS.PENDING,
      amount: amount ? parseFloat(amount) : 0,
      sender: req.user.email,
      department: req.user.department,
      uploadedBy: req.user.email,
      size: (req.file.size / 1024).toFixed(2),
      lastModified: Date.now(),
      filePath: req.file.path
    };

    invoices.push(newInvoice);

    return res.status(201).json({
      success: true,
      invoice: {
        ...newInvoice,
        filePath: undefined // Don't expose the file path to the client
      }
    });
  } catch (error) {
    console.error('Error uploading invoice:', error);
    return res.status(500).json({ success: false, message: 'Error uploading invoice', error: error.message });
  }
});

// Upload multiple invoices
router.post('/api/invoices/upload/multiple', authenticateToken, upload.array('files'), async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ success: false, message: 'No files uploaded' });
    }

    let amounts = {};
    if (req.body.amounts) {
      try {
        amounts = JSON.parse(req.body.amounts);
      } catch (e) {
        return res.status(400).json({ success: false, message: 'Invalid amounts JSON' });
      }
    }

    const uploadedInvoices = req.files.map(file => {
      const amount = amounts[file.originalname] || 0;
      
      const newInvoice = {
        id: uuidv4(),
        name: file.originalname,
        type: file.mimetype,
        date: new Date().toISOString().split('T')[0],
        time: new Date().toLocaleTimeString(),
        status: INVOICE_STATUS.PENDING,
        amount: parseFloat(amount),
        sender: req.user.email,
        department: req.user.department,
        uploadedBy: req.user.email,
        size: (file.size / 1024).toFixed(2),
        lastModified: Date.now(),
        filePath: file.path
      };

      invoices.push(newInvoice);
      return {
        ...newInvoice,
        filePath: undefined // Don't expose the file path to the client
      };
    });

    return res.status(201).json({
      success: true,
      invoices: uploadedInvoices
    });
  } catch (error) {
    console.error('Error uploading multiple invoices:', error);
    return res.status(500).json({ success: false, message: 'Error uploading invoices', error: error.message });
  }
});

// Get all invoices visible to the user
router.get('/api/invoices', authenticateToken, async (req, res) => {
  try {
    // Pagination
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const startIndex = (page - 1) * limit;
    
    // Filtering
    let filteredInvoices = [...invoices];
    
    if (req.query.status) {
      filteredInvoices = filteredInvoices.filter(invoice => invoice.status === req.query.status);
    }
    
    if (req.query.department) {
      filteredInvoices = filteredInvoices.filter(invoice => invoice.department === req.query.department);
    }
    
    // Role-based filtering
    if (req.user.department === 'FINANCE') {
      switch (req.user.role) {
        case 'FINANCE_REVIEWER_1':
          filteredInvoices = filteredInvoices.filter(i => i.status === INVOICE_STATUS.PENDING);
          break;
        case 'FINANCE_REVIEWER_2':
          filteredInvoices = filteredInvoices.filter(i => i.status === INVOICE_STATUS.REVIEW_1);
          break;
        case 'FINANCE_REVIEWER_3':
          filteredInvoices = filteredInvoices.filter(i => i.status === INVOICE_STATUS.REVIEW_2);
          break;
        case 'FINANCE_REVIEWER_4':
          filteredInvoices = filteredInvoices.filter(i => i.status === INVOICE_STATUS.REVIEW_3);
          break;
        default:
          break;
      }
    } else {
      // For department users, show only invoices from their department
      filteredInvoices = filteredInvoices.filter(i => i.department === req.user.department);
    }
    
    const total = filteredInvoices.length;
    
    // Apply pagination
    const paginatedInvoices = filteredInvoices.slice(startIndex, startIndex + limit);
    
    // Remove filePath from response
    const sanitizedInvoices = paginatedInvoices.map(invoice => {
      const { filePath, ...rest } = invoice;
      return rest;
    });
    
    return res.status(200).json({
      invoices: sanitizedInvoices,
      pagination: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Error fetching invoices:', error);
    return res.status(500).json({ success: false, message: 'Error fetching invoices', error: error.message });
  }
});

// Get invoice by ID
router.get('/api/invoices/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const invoice = invoices.find(inv => inv.id === id);
    
    if (!invoice) {
      return res.status(404).json({ success: false, message: 'Invoice not found' });
    }
    
    // Check if user has access to this invoice
    const hasAccess = req.user.department === 'FINANCE' || invoice.department === req.user.department;
    
    if (!hasAccess) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }
    
    const { filePath, ...sanitizedInvoice } = invoice;
    
    return res.status(200).json({
      ...sanitizedInvoice,
      downloadUrl: `/api/invoices/${id}/download`
    });
  } catch (error) {
    console.error('Error fetching invoice:', error);
    return res.status(500).json({ success: false, message: 'Error fetching invoice', error: error.message });
  }
});

// Download invoice file
router.get('/api/invoices/:id/download', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const invoice = invoices.find(inv => inv.id === id);
    
    if (!invoice) {
      return res.status(404).json({ success: false, message: 'Invoice not found' });
    }
    
    // Check if user has access to this invoice
    const hasAccess = req.user.department === 'FINANCE' || invoice.department === req.user.department;
    
    if (!hasAccess) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }
    
    return res.download(invoice.filePath, invoice.name);
  } catch (error) {
    console.error('Error downloading invoice:', error);
    return res.status(500).json({ success: false, message: 'Error downloading invoice', error: error.message });
  }
});

// Update invoice status
router.patch('/api/invoices/:id/status', authenticateToken, isFinanceRole, async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    
    if (!Object.values(INVOICE_STATUS).includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid status' });
    }
    
    const invoiceIndex = invoices.findIndex(inv => inv.id === id);
    
    if (invoiceIndex === -1) {
      return res.status(404).json({ success: false, message: 'Invoice not found' });
    }
    
    let canUpdate = false;
    switch (req.user.role) {
      case 'FINANCE_REVIEWER_1':
        canUpdate = invoices[invoiceIndex].status === INVOICE_STATUS.PENDING && status === INVOICE_STATUS.REVIEW_1;
        break;
      case 'FINANCE_REVIEWER_2':
        canUpdate = invoices[invoiceIndex].status === INVOICE_STATUS.REVIEW_1 && status === INVOICE_STATUS.REVIEW_2;
        break;
      case 'FINANCE_REVIEWER_3':
        canUpdate = invoices[invoiceIndex].status === INVOICE_STATUS.REVIEW_2 && status === INVOICE_STATUS.REVIEW_3;
        break;
      case 'FINANCE_REVIEWER_4':
        canUpdate = invoices[invoiceIndex].status === INVOICE_STATUS.REVIEW_3 && status === INVOICE_STATUS.PAID;
        break;
      default:
        canUpdate = false;
    }
    
    if (!canUpdate) {
      return res.status(403).json({ 
        success: false, 
        message: 'You are not authorized to update this invoice to the requested status' 
      });
    }
    
    // Update the invoice status
    invoices[invoiceIndex].status = status;
    invoices[invoiceIndex].updatedAt = new Date().toISOString();
    
    return res.status(200).json({
      success: true,
      invoice: {
        id: invoices[invoiceIndex].id,
        status: invoices[invoiceIndex].status,
        updatedAt: invoices[invoiceIndex].updatedAt
      }
    });
  } catch (error) {
    console.error('Error updating invoice status:', error);
    return res.status(500).json({ success: false, message: 'Error updating invoice status', error: error.message });
  }
});

// Add a comment to an invoice
router.post('/api/invoices/:id/comments', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { comment } = req.body;
    
    if (!comment || comment.trim() === '') {
      return res.status(400).json({ success: false, message: 'Comment cannot be empty' });
    }
    
    const invoiceIndex = invoices.findIndex(inv => inv.id === id);
    
    if (invoiceIndex === -1) {
      return res.status(404).json({ success: false, message: 'Invoice not found' });
    }
    
    // Check if user has access to this invoice
    const hasAccess = req.user.department === 'FINANCE' || invoices[invoiceIndex].department === req.user.department;
    
    if (!hasAccess) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }
    
    // Initialize comments array if it doesn't exist
    if (!invoices[invoiceIndex].comments) {
      invoices[invoiceIndex].comments = [];
    }
    
    const newComment = {
      id: uuidv4(),
      text: comment,
      createdBy: req.user.email,
      createdAt: new Date().toISOString(),
      userRole: req.user.role
    };
    
    invoices[invoiceIndex].comments.push(newComment);
    
    return res.status(201).json({
      success: true,
      comment: newComment
    });
  } catch (error) {
    console.error('Error adding comment:', error);
    return res.status(500).json({ success: false, message: 'Error adding comment', error: error.message });
  }
});

// Get comments for an invoice
router.get('/api/invoices/:id/comments', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const invoice = invoices.find(inv => inv.id === id);
    
    if (!invoice) {
      return res.status(404).json({ success: false, message: 'Invoice not found' });
    }
    
    // Check if user has access to this invoice
    const hasAccess = req.user.department === 'FINANCE' || invoice.department === req.user.department;
    
    if (!hasAccess) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }
    
    const comments = invoice.comments || [];
    
    return res.status(200).json({
      success: true,
      comments
    });
  } catch (error) {
    console.error('Error fetching comments:', error);
    return res.status(500).json({ success: false, message: 'Error fetching comments', error: error.message });
  }
});

module.exports = router;