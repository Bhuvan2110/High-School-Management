// app.js
// Express app setup — middlewares, routes, error handlers
// server.js imports this and starts listening

require('dotenv').config();
const express     = require('express');
const cors        = require('cors');
const helmet      = require('helmet');
const morgan      = require('morgan');
const cookieParser= require('cookie-parser');
const rateLimit   = require('express-rate-limit');

const authRoutes   = require('./routes/auth');
const healthRoutes = require('./routes/health');
const { errorHandler, notFoundHandler } = require('./middleware/errorHandler');

const app = express();

// ── Security headers (Helmet) ─────────────────────────────────
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc:  ["'self'"],
      styleSrc:   ["'self'", "'unsafe-inline'"],
      imgSrc:     ["'self'", 'data:'],
    },
  },
  crossOriginEmbedderPolicy: false,
}));

// ── CORS ──────────────────────────────────────────────────────
app.use(cors({
  origin:      process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',') : 'http://localhost:3000',
  credentials: true,      // allow cookies to be sent cross-origin
  methods:     ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// ── Global rate limiter ───────────────────────────────────────
const globalLimiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
  max:      parseInt(process.env.RATE_LIMIT_MAX)        || 100,
  message:  { success: false, message: 'Too many requests. Please slow down.' },
  standardHeaders: true,
  legacyHeaders:   false,
});
app.use(globalLimiter);

// ── Body parsers ──────────────────────────────────────────────
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser(process.env.COOKIE_SECRET));

// ── HTTP request logger ───────────────────────────────────────
if (process.env.NODE_ENV !== 'test') {
  app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));
}

// ── Trust proxy (for correct IP behind nginx/load balancer) ──
app.set('trust proxy', 1);

// ── Routes ────────────────────────────────────────────────────
app.use('/api/health', healthRoutes);
app.use('/api/auth',   authRoutes);

const adminRoutes   = require('./routes/admin');
const subjectRoutes = require('./routes/subjects');
const studentRoutes = require('./routes/students');

app.use('/api/admin',    adminRoutes);
app.use('/api/subjects', subjectRoutes);
app.use('/api/students', studentRoutes);

// ── 404 & Error handlers (must be last) ───────────────────────
app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;
