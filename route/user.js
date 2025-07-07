
// users.js - User management API routes
const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const { pool } = require('../db');
const auth = require('../route/middleware/auth');

// Roles and departments constants (matching frontend)
const ROLES = {
  FINANCE_REVIEWER_1: 'FINANCE_REVIEWER_1',
  FINANCE_REVIEWER_2: 'FINANCE_REVIEWER_2',
  FINANCE_REVIEWER_3: 'FINANCE_REVIEWER_3',
  FINANCE_REVIEWER_4: 'FINANCE_REVIEWER_4',
  EXCOBERS_REVIEWER: 'EXCOBERS_REVIEWER',
  DEPARTMENT_USER: 'DEPARTMENT_USER',
};

const DEPARTMENTS = {
  FINANCE: 'FINANCE',
  IT: 'IT',
  HR: 'HR',
  OPERATIONS: 'OPERATIONS',
  GLOBALMARKET: 'GLOBALMARKET',
  MARKETTING: 'MARKETTING',
  LEGAL: 'LEGAL',
  COMPLIANCE: 'COMPLIANCE',
  EXCOBERS: 'EXCOBERS',
};

// Middleware to check if user is an admin (assuming Finance reviewers have admin privileges)
const isAdmin = async (req, res, next) => {
  try {
    // Get user details
    const userResult = await pool.query(
      'SELECT role FROM users WHERE id = $1',
      [req.user.id]
    );

    const user = userResult.rows[0];
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Check if user is a finance reviewer (admin)
    const isFinanceReviewer = user.role.startsWith('FINANCE_REVIEWER_');
    if (!isFinanceReviewer) {
      return res.status(403).json({ message: 'Not authorized to manage users' });
    }

    next();
  } catch (err) {
    console.error('Admin check error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
};

/**
 * @route   POST api/users
 * @desc    Add a new user
 * @access  Private/Admin
 */
router.post('/', auth, isAdmin, async (req, res) => {
  const { name, email, password, username, department, role } = req.body;

  // Validate request body
  if (!name || !email || !password || !username || !department || !role) {
    return res.status(400).json({ message: 'All fields are required' });
  }

  // Validate department and role
  if (!Object.values(DEPARTMENTS).includes(department)) {
    return res.status(400).json({ message: 'Invalid department' });
  }

  if (!Object.values(ROLES).includes(role)) {
    return res.status(400).json({ message: 'Invalid role' });
  }

  try {
    // Check if user exists
    const userExists = await pool.query(
      'SELECT id FROM users WHERE email = $1',
      [email]
    );

    if (userExists.rows.length > 0) {
      return res.status(400).json({ message: 'User already exists' });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Create user
    const userResult = await pool.query(
      `INSERT INTO users 
       (name, email, password, username, department, role, created_at, updated_at) 
       VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW()) 
       RETURNING id, name, email, username, department, role`,
      [name, email, hashedPassword, username, department, role]
    );

    const newUser = userResult.rows[0];
    res.status(201).json(newUser);
  } catch (err) {
    console.error('Add user error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
});

/**
 * @route   GET api/users
 * @desc    Get all users
 * @access  Private/Admin
 */
router.get('/', auth, isAdmin, async (req, res) => {
  try {
    const usersResult = await pool.query(
      'SELECT id, name, email, username, department, role, created_at, updated_at FROM users'
    );

    res.json(usersResult.rows);
  } catch (err) {
    console.error('Get users error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
});

/**
 * @route   GET api/users/:id
 * @desc    Get user by ID
 * @access  Private/Admin
 */
router.get('/:id', auth, isAdmin, async (req, res) => {
  try {
    const userResult = await pool.query(
      'SELECT id, name, email, username, department, role, created_at, updated_at FROM users WHERE id = $1',
      [req.params.id]
    );

    const user = userResult.rows[0];
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json(user);
  } catch (err) {
    console.error('Get user error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
});

/**
 * @route   PUT api/users/:id
 * @desc    Update user
 * @access  Private/Admin
 */
router.put('/:id', auth, isAdmin, async (req, res) => {
  const { name, email, username, department, role } = req.body;
  const userId = req.params.id;

  // Validate request body
  if (!name || !email || !username || !department || !role) {
    return res.status(400).json({ message: 'All fields are required' });
  }

  // Validate department and role
  if (!Object.values(DEPARTMENTS).includes(department)) {
    return res.status(400).json({ message: 'Invalid department' });
  }

  if (!Object.values(ROLES).includes(role)) {
    return res.status(400).json({ message: 'Invalid role' });
  }

  try {
    // Check if user exists
    const userExists = await pool.query(
      'SELECT id FROM users WHERE id = $1',
      [userId]
    );

    if (userExists.rows.length === 0) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Update user
    const userResult = await pool.query(
      `UPDATE users 
       SET name = $1, email = $2, username = $3, department = $4, role = $5, updated_at = NOW() 
       WHERE id = $6 
       RETURNING id, name, email, username, department, role`,
      [name, email, username, department, role, userId]
    );

    const updatedUser = userResult.rows[0];
    res.json(updatedUser);
  } catch (err) {
    console.error('Update user error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
});

/**
 * @route   PUT api/users/:id/password
 * @desc    Update user password
 * @access  Private/Admin
 */
router.put('/:id/password', auth, isAdmin, async (req, res) => {
  const { password } = req.body;
  const userId = req.params.id;

  // Validate request body
  if (!password) {
    return res.status(400).json({ message: 'Password is required' });
  }

  try {
    // Check if user exists
    const userExists = await pool.query(
      'SELECT id FROM users WHERE id = $1',
      [userId]
    );

    if (userExists.rows.length === 0) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Update password
    await pool.query(
      'UPDATE users SET password = $1, updated_at = NOW() WHERE id = $2',
      [hashedPassword, userId]
    );

    res.json({ message: 'Password updated successfully' });
  } catch (err) {
    console.error('Update password error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
});

/**
 * @route   DELETE api/users/:id
 * @desc    Delete user
 * @access  Private/Admin
 */
router.delete('/:id', auth, isAdmin, async (req, res) => {
  const userId = req.params.id;

  try {
    // Check if user exists
    const userExists = await pool.query(
      'SELECT id FROM users WHERE id = $1',
      [userId]
    );

    if (userExists.rows.length === 0) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Delete user
    await pool.query('DELETE FROM users WHERE id = $1', [userId]);

    res.json({ message: 'User deleted successfully' });
  } catch (err) {
    console.error('Delete user error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
});

/**
 * @route   GET api/users/constants
 * @desc    Get roles and departments constants
 * @access  Private
 */
router.get('/constants', auth, async (req, res) => {
  res.json({ ROLES, DEPARTMENTS });
});

module.exports = router;