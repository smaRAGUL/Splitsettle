const express = require('express');
const rateLimit = require('express-rate-limit');
const authController = require('../controllers/authController');
const verifyToken = require('../middleware/auth');

const router = express.Router();

// Stricter rate limit on auth endpoints to prevent brute force
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // 20 attempts
  message: { message: 'Too many login or registration attempts. Please try again after 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false
});

router.post('/register', authLimiter, authController.register);
router.post('/login', authLimiter, authController.login);
router.get('/me', verifyToken, authController.getMe);

module.exports = router;

