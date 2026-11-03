require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { pool, checkDatabase } = require('./config/db');

const authRoutes = require('./routes/auth');
const groupRoutes = require('./routes/groups');
const expenseRoutes = require('./routes/expenses');
const settlementRoutes = require('./routes/settlements');

const app = express();
const PORT = Number(process.env.PORT || 5000);
const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:8080';

// 1. Security middleware
app.disable('x-powered-by');
app.use(helmet());

// CORS configuration restricted to frontend client URL (default http://localhost:8080)
const allowedOrigins = [
  CLIENT_URL,
  'http://localhost:8080',
  'http://127.0.0.1:8080'
];

app.use(cors({
  origin: (origin, callback) => {
    // allow requests with no origin (like mobile apps, curl, Postman)
    if (!origin || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    return callback(new Error('CORS policy: Not allowed by Access-Control-Allow-Origin'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Body parser
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// General rate limiter
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many requests. Please try again later.' }
});
app.use(generalLimiter);

// 2. Welcome & Health check endpoints
app.get('/', (req, res) => {
  res.status(200).json({
    service: 'SplitSettle Backend API',
    status: 'running',
    frontendUrl: CLIENT_URL,
    healthCheck: '/api/health',
    apiRoot: '/api'
  });
});

app.get('/api', (req, res) => {
  res.status(200).json({
    service: 'SplitSettle REST API',
    status: 'online',
    health: '/api/health',
    endpoints: [
      '/api/auth/register',
      '/api/auth/login',
      '/api/auth/me',
      '/api/groups',
      '/api/expenses',
      '/api/settlements'
    ]
  });
});

app.get('/api/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    service: 'SplitSettle API',
    timestamp: new Date().toISOString()
  });
});

// 3. API Routes
app.use('/api/auth', authRoutes);
app.use('/api/groups', groupRoutes);
app.use('/api/expenses', expenseRoutes);
app.use('/api/settlements', settlementRoutes);

// 4. 404 Handler
app.use((req, res) => {
  res.status(404).json({ message: `Route not found: ${req.method} ${req.originalUrl}` });
});

// 5. Global Error Handler
app.use((err, req, res, next) => {
  console.error('Unhandled server error:', err);
  const status = err.status || err.statusCode || 500;
  res.status(status).json({
    message: err.message || 'Internal Server Error'
  });
});

// 6. Start server with DB check
if (process.env.NODE_ENV !== 'test') {
  checkDatabase()
    .then(() => {
      console.log('✓ Successfully connected to MySQL database.');
      const server = app.listen(PORT, () => {
        console.log(`✓ SplitSettle backend listening at http://localhost:${PORT}`);
      });

      const gracefulShutdown = async () => {
        console.log('\nShutting down server gracefully...');
        server.close(async () => {
          await pool.end();
          console.log('MySQL connection pool closed.');
          process.exit(0);
        });
      };

      process.on('SIGINT', gracefulShutdown);
      process.on('SIGTERM', gracefulShutdown);
    })
    .catch((err) => {
      console.warn('⚠️ Warning: Initial MySQL check failed:', err.message);
      console.warn('Starting server anyway so HTTP routes can respond...');
      const server = app.listen(PORT, () => {
        console.log(`✓ SplitSettle backend listening at http://localhost:${PORT}`);
      });
    });
}

module.exports = app;

