# Nexora Capital Backend

Premium digital asset investment platform backend built with Node.js, Express, and PostgreSQL.

## Features

- ✅ JWT Authentication
- ✅ Email/SMS 2FA ready
- ✅ Portfolio Management
- ✅ Investment Goals tracking
- ✅ Deposit/Withdrawal system with admin approval
- ✅ Automatic 2% daily returns calculation
- ✅ Admin dashboard with full control
- ✅ Activity logging
- ✅ Notification system
- ✅ Email notifications

## Tech Stack

- **Runtime**: Node.js
- **Framework**: Express.js
- **Database**: PostgreSQL
- **ORM**: Drizzle ORM
- **Authentication**: JWT
- **Email**: Nodemailer (Ethereal for dev, SMTP for prod)
- **Scheduling**: node-cron

## Fixed Wallet Addresses (Client Provided)

- **Bitcoin**: `bc1q8waqj9qurtpu07q0v826qr60n7jyxw247q8xes`
- **Ethereum**: `0x5D1Dea66d22BdA4Bd0C8737CC236A76334326056`
- **Solana**: `HjWcM41m6aYwZVAESCFrk1EAhqHP6MV9h5pRRtnCmT5m`
- **USDT ERC20**: `0x5d1dea66d22bda4bd0c8737cc236a76334326056`
- **USDC ERC20**: `0x5D1Dea66d22BdA4Bd0C8737CC236A76334326056`

## Investment Settings

- **Daily Return**: 2% automatic
- **Minimum Deposit**: $100
- **Minimum Withdrawal**: $100
- **Withdrawal Fee**: 0.5%
- **Withdrawal Requirements**: 
  - 100% goal progress reached, OR
  - 180 days (6 months) since first deposit

## Quick Start

### 1. Install Dependencies

```bash
cd backend
npm install
```

### 2. Setup Environment Variables

```bash
cp .env.example .env
# Edit .env with your database credentials
```

### 3. Setup Database

Make sure PostgreSQL is running, then:

```bash
# Generate migration
npm run db:generate

# Run migration
npm run db:migrate

# Seed with admin and demo user
npm run seed
```

### 4. Run Development Server

```bash
npm run dev
```

Server will start on `http://localhost:5000`

## Default Accounts

### Admin Account
- **Email**: admin@nexora.com
- **Password**: admin123
- **Access**: Full admin dashboard at `/api/admin/*`

### Demo User Account
- **Email**: eben@nexora.com
- **Password**: password
- **Portfolio**: $46,500 (started with $42,000 deposit)

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login
- `GET /api/auth/me` - Get current user
- `POST /api/auth/logout` - Logout

### User
- `PUT /api/users/profile` - Update profile
- `PUT /api/users/password` - Change password
- `GET /api/users/login-history` - Get login history
- `GET /api/users/sessions` - Get active sessions

### Portfolio
- `GET /api/portfolio/dashboard` - Get dashboard data
- `GET /api/portfolio` - Get portfolio details
- `GET /api/portfolio/performance` - Get performance history
- `GET /api/portfolio/goal` - Get investment goal
- `POST /api/portfolio/goal` - Create/update goal

### Deposits
- `GET /api/deposits/wallets` - Get wallet addresses
- `POST /api/deposits` - Create deposit request
- `GET /api/deposits` - Get user's deposits
- `GET /api/deposits/:id` - Get deposit by ID

### Withdrawals
- `GET /api/withdrawals/eligibility` - Check withdrawal eligibility
- `POST /api/withdrawals` - Create withdrawal request
- `GET /api/withdrawals` - Get user's withdrawals
- `GET /api/withdrawals/:id` - Get withdrawal by ID

### Transactions
- `GET /api/transactions` - Get all transactions
- `GET /api/transactions/:id` - Get transaction by ID
- `GET /api/transactions/stats/summary` - Get transaction stats

### Notifications
- `GET /api/notifications` - Get notifications
- `PUT /api/notifications/:id/read` - Mark as read
- `PUT /api/notifications/read-all` - Mark all as read
- `GET /api/notifications/activities` - Get activities

### Admin (Requires admin role)
- `GET /api/admin/stats` - Get admin dashboard stats
- `GET /api/admin/users` - List all users
- `GET /api/admin/users/:id` - Get user details
- `PUT /api/admin/users/:id/balance` - Update user balance
- `GET /api/admin/deposits/pending` - Get pending deposits
- `PUT /api/admin/deposits/:id/approve` - Approve deposit
- `PUT /api/admin/deposits/:id/reject` - Reject deposit
- `GET /api/admin/withdrawals/pending` - Get pending withdrawals
- `PUT /api/admin/withdrawals/:id/approve` - Approve withdrawal
- `PUT /api/admin/withdrawals/:id/reject` - Reject withdrawal
- `POST /api/admin/notifications` - Send notification to user
- `GET /api/admin/logs` - Get admin action logs

## Daily Returns Cron Job

The system automatically calculates and applies 2% daily returns at midnight (00:00) server time. This is handled by a cron job defined in `src/server.ts`.

## Database Schema

See `src/config/schema.ts` for complete database schema definition.

Main tables:
- `users` - User accounts
- `portfolios` - User portfolios
- `investment_goals` - Investment goals
- `transactions` - All transactions
- `deposits` - Deposit records
- `withdrawals` - Withdrawal records
- `portfolio_performance` - Daily performance history
- `notifications` - User notifications
- `activities` - User activities
- `sessions` - Active sessions
- `login_history` - Login history
- `admin_actions` - Admin action audit log

## Deployment

### Railway (Recommended)

1. Create Railway account
2. Create new project
3. Add PostgreSQL database
4. Deploy from GitHub
5. Set environment variables in Railway dashboard

### Environment Variables for Production

```env
NODE_ENV=production
PORT=5000
DATABASE_URL=postgresql://...
JWT_SECRET=your-strong-secret-key
JWT_EXPIRES_IN=7d
FRONTEND_URL=https://yourdomain.com

# Email (SMTP)
SMTP_HOST=smtp.sendgrid.net
SMTP_PORT=587
SMTP_USER=apikey
SMTP_PASS=your-sendgrid-api-key

# Wallet Addresses
WALLET_BTC=bc1q8waqj9qurtpu07q0v826qr60n7jyxw247q8xes
WALLET_ETH=0x5D1Dea66d22BdA4Bd0C8737CC236A76334326056
WALLET_SOL=HjWcM41m6aYwZVAESCFrk1EAhqHP6MV9h5pRRtnCmT5m
WALLET_USDT_ERC20=0x5d1dea66d22bda4bd0c8737cc236a76334326056
WALLET_USDC_ERC20=0x5D1Dea66d22BdA4Bd0C8737CC236A76334326056

# Investment Settings
DAILY_RETURN_PERCENTAGE=2
MINIMUM_DEPOSIT=100
MINIMUM_WITHDRAWAL=100
WITHDRAWAL_FEE_PERCENTAGE=0.5
WITHDRAWAL_MIN_GOAL_PROGRESS=100
WITHDRAWAL_MIN_DAYS=180

# Admin
ADMIN_EMAIL=admin@nexora.com
ADMIN_PASSWORD=admin123
```

## License

Private - Nexora Capital
# NexoraCapitalBE
