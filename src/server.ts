import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';
import rateLimit from 'express-rate-limit';
import cron from 'node-cron';

// Load environment variables
dotenv.config();

// Import routes
import authRoutes from './routes/auth';
import userRoutes from './routes/user';
import portfolioRoutes from './routes/portfolio';
import depositRoutes from './routes/deposit';
import withdrawalRoutes from './routes/withdrawal';
import transactionRoutes from './routes/transaction';
import notificationRoutes from './routes/notification';
import adminRoutes from './routes/admin';

// Import services
import { calculateDailyReturns } from './services/investmentService';

const app = express();
app.get("/", (_req, res) => {
  res.json({
    status: "OK",
    message: "Nexora Capital API is running",
  });
});
const PORT = process.env.PORT || 5000;

// Security middleware
app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true,
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.',
});
app.use(limiter);

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Logging
app.use(morgan('dev'));

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/portfolio', portfolioRoutes);
app.use('/api/deposits', depositRoutes);
app.use('/api/withdrawals', withdrawalRoutes);
app.use('/api/transactions', transactionRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/admin', adminRoutes);

// Error handling middleware
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Error:', err);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Internal server error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found',
  });
});

// Schedule daily return calculation.
// Runs at 16:00 (4:00 PM) West African Time. WAT has no DST, so we pin
// the cron job to the Africa/Lagos timezone to be safe.
cron.schedule(
  '0 16 * * *',
  async () => {
    console.log('Running daily return calculation (0.5%)...');
    try {
      await calculateDailyReturns();
      console.log('Daily returns calculated successfully');
    } catch (error) {
      console.error('Error calculating daily returns:', error);
    }
  },
  { timezone: 'Africa/Lagos' }
);

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
});
