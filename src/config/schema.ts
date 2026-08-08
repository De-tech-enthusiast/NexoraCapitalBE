import { 
  pgTable, 
  serial, 
  varchar, 
  text, 
  timestamp, 
  integer, 
  boolean, 
  decimal,
  jsonb,
  pgEnum
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// Enums
export const userRoleEnum = pgEnum('user_role', ['user', 'admin']);
export const verificationStatusEnum = pgEnum('verification_status', ['pending', 'verified', 'rejected']);
export const transactionTypeEnum = pgEnum('transaction_type', ['deposit', 'withdrawal', 'dividend', 'fee', 'adjustment']);
export const transactionStatusEnum = pgEnum('transaction_status', ['pending', 'completed', 'failed', 'cancelled']);
export const depositStatusEnum = pgEnum('deposit_status', ['pending', 'confirming', 'completed', 'rejected']);
export const withdrawalStatusEnum = pgEnum('withdrawal_status', ['pending', 'approved', 'processing', 'completed', 'rejected']);
export const notificationTypeEnum = pgEnum('notification_type', ['info', 'success', 'warning', 'error']);
export const activityTypeEnum = pgEnum('activity_type', ['deposit', 'withdrawal', 'goal_created', 'goal_updated', 'goal_completed', 'profile_updated', 'security_updated']);

// Users Table
export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  username: varchar('username', { length: 50 }).notNull().unique(),
  firstName: varchar('first_name', { length: 100 }).notNull(),
  lastName: varchar('last_name', { length: 100 }).notNull(),
  country: varchar('country', { length: 100 }),
  preferredCurrency: varchar('preferred_currency', { length: 10 }).default('USD'),
  role: userRoleEnum('role').default('user').notNull(),
  verificationStatus: verificationStatusEnum('verification_status').default('pending'),
  emailVerified: boolean('email_verified').default(false),
  twoFactorEnabled: boolean('two_factor_enabled').default(false),
  twoFactorSecret: text('two_factor_secret'),
  lastLoginAt: timestamp('last_login_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Portfolios Table
export const portfolios = pgTable('portfolios', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').references(() => users.id).notNull().unique(),
  currentValue: decimal('current_value', { precision: 18, scale: 8 }).default('0').notNull(),
  totalInvested: decimal('total_invested', { precision: 18, scale: 8 }).default('0').notNull(),
  totalProfit: decimal('total_profit', { precision: 18, scale: 8 }).default('0').notNull(),
  profitPercentage: decimal('profit_percentage', { precision: 5, scale: 2 }).default('0'),
  lastCalculatedAt: timestamp('last_calculated_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Investment Goals Table
export const investmentGoals = pgTable('investment_goals', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').references(() => users.id).notNull(),
  name: varchar('name', { length: 255 }).notNull(),
  targetAmount: decimal('target_amount', { precision: 18, scale: 8 }).notNull(),
  currentAmount: decimal('current_amount', { precision: 18, scale: 8 }).default('0').notNull(),
  duration: integer('duration').notNull(), // in months
  startDate: timestamp('start_date').notNull(),
  endDate: timestamp('end_date').notNull(),
  status: varchar('status', { length: 20 }).default('active'), // active, completed, cancelled
  progress: decimal('progress', { precision: 5, scale: 2 }).default('0'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Transactions Table
export const transactions = pgTable('transactions', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').references(() => users.id).notNull(),
  reference: varchar('reference', { length: 100 }).notNull().unique(),
  type: transactionTypeEnum('type').notNull(),
  amount: decimal('amount', { precision: 18, scale: 8 }).notNull(),
  currency: varchar('currency', { length: 10 }).notNull(),
  status: transactionStatusEnum('status').default('pending').notNull(),
  description: text('description'),
  metadata: jsonb('metadata'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Deposits Table
export const deposits = pgTable('deposits', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').references(() => users.id).notNull(),
  transactionId: integer('transaction_id').references(() => transactions.id),
  amount: decimal('amount', { precision: 18, scale: 8 }).notNull(),
  currency: varchar('currency', { length: 10 }).notNull(),
  network: varchar('network', { length: 50 }).notNull(),
  walletAddress: text('wallet_address').notNull(),
  txHash: text('tx_hash'),
  status: depositStatusEnum('status').default('pending').notNull(),
  adminNotes: text('admin_notes'),
  reviewedBy: integer('reviewed_by').references(() => users.id),
  reviewedAt: timestamp('reviewed_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Withdrawals Table
export const withdrawals = pgTable('withdrawals', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').references(() => users.id).notNull(),
  transactionId: integer('transaction_id').references(() => transactions.id),
  amount: decimal('amount', { precision: 18, scale: 8 }).notNull(),
  currency: varchar('currency', { length: 10 }).notNull(),
  network: varchar('network', { length: 50 }).notNull(),
  destinationAddress: text('destination_address').notNull(),
  txHash: text('tx_hash'),
  fee: decimal('fee', { precision: 18, scale: 8 }).default('0'),
  status: withdrawalStatusEnum('status').default('pending').notNull(),
  adminNotes: text('admin_notes'),
  reviewedBy: integer('reviewed_by').references(() => users.id),
  reviewedAt: timestamp('reviewed_at'),
  processedAt: timestamp('processed_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Portfolio Performance History
export const portfolioPerformance = pgTable('portfolio_performance', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').references(() => users.id).notNull(),
  date: timestamp('date').notNull(),
  value: decimal('value', { precision: 18, scale: 8 }).notNull(),
  invested: decimal('invested', { precision: 18, scale: 8 }).notNull(),
  profit: decimal('profit', { precision: 18, scale: 8 }).default('0'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Notifications Table
export const notifications = pgTable('notifications', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').references(() => users.id).notNull(),
  title: varchar('title', { length: 255 }).notNull(),
  message: text('message').notNull(),
  type: notificationTypeEnum('type').default('info').notNull(),
  read: boolean('read').default(false),
  actionUrl: varchar('action_url', { length: 255 }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Activities Table
export const activities = pgTable('activities', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').references(() => users.id).notNull(),
  type: activityTypeEnum('type').notNull(),
  title: varchar('title', { length: 255 }).notNull(),
  description: text('description').notNull(),
  status: varchar('status', { length: 20 }), // success, pending, error
  metadata: jsonb('metadata'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Sessions Table (for tracking active sessions)
export const sessions = pgTable('sessions', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').references(() => users.id).notNull(),
  token: text('token').notNull(),
  device: varchar('device', { length: 255 }),
  browser: varchar('browser', { length: 255 }),
  location: varchar('location', { length: 255 }),
  ipAddress: varchar('ip_address', { length: 45 }),
  current: boolean('current').default(false),
  lastActiveAt: timestamp('last_active_at').defaultNow(),
  expiresAt: timestamp('expires_at').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Login History
export const loginHistory = pgTable('login_history', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').references(() => users.id).notNull(),
  device: varchar('device', { length: 255 }),
  browser: varchar('browser', { length: 255 }),
  location: varchar('location', { length: 255 }),
  ipAddress: varchar('ip_address', { length: 45 }),
  status: varchar('status', { length: 20 }).notNull(), // success, failed
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Admin Actions Log
export const adminActions = pgTable('admin_actions', {
  id: serial('id').primaryKey(),
  adminId: integer('admin_id').references(() => users.id).notNull(),
  action: varchar('action', { length: 100 }).notNull(),
  targetUserId: integer('target_user_id').references(() => users.id),
  targetType: varchar('target_type', { length: 50 }), // deposit, withdrawal, user, etc.
  targetId: integer('target_id'),
  oldValue: jsonb('old_value'),
  newValue: jsonb('new_value'),
  notes: text('notes'),
  ipAddress: varchar('ip_address', { length: 45 }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// ============================================
// RELATIONS (required for db.query with{} joins)
// ============================================

export const usersRelations = relations(users, ({ one, many }) => ({
  portfolio: one(portfolios, {
    fields: [users.id],
    references: [portfolios.userId],
  }),
  goals: many(investmentGoals),
  transactions: many(transactions),
  deposits: many(deposits),
  withdrawals: many(withdrawals),
  notifications: many(notifications),
  activities: many(activities),
  sessions: many(sessions),
  loginHistory: many(loginHistory),
}));

export const portfoliosRelations = relations(portfolios, ({ one }) => ({
  user: one(users, {
    fields: [portfolios.userId],
    references: [users.id],
  }),
}));

export const investmentGoalsRelations = relations(investmentGoals, ({ one }) => ({
  user: one(users, {
    fields: [investmentGoals.userId],
    references: [users.id],
  }),
}));

export const transactionsRelations = relations(transactions, ({ one }) => ({
  user: one(users, {
    fields: [transactions.userId],
    references: [users.id],
  }),
}));

export const depositsRelations = relations(deposits, ({ one }) => ({
  user: one(users, {
    fields: [deposits.userId],
    references: [users.id],
  }),
  transaction: one(transactions, {
    fields: [deposits.transactionId],
    references: [transactions.id],
  }),
}));

export const withdrawalsRelations = relations(withdrawals, ({ one }) => ({
  user: one(users, {
    fields: [withdrawals.userId],
    references: [users.id],
  }),
  transaction: one(transactions, {
    fields: [withdrawals.transactionId],
    references: [transactions.id],
  }),
}));

export const notificationsRelations = relations(notifications, ({ one }) => ({
  user: one(users, {
    fields: [notifications.userId],
    references: [users.id],
  }),
}));

export const activitiesRelations = relations(activities, ({ one }) => ({
  user: one(users, {
    fields: [activities.userId],
    references: [users.id],
  }),
}));

export const sessionsRelations = relations(sessions, ({ one }) => ({
  user: one(users, {
    fields: [sessions.userId],
    references: [users.id],
  }),
}));

export const loginHistoryRelations = relations(loginHistory, ({ one }) => ({
  user: one(users, {
    fields: [loginHistory.userId],
    references: [users.id],
  }),
}));

export const adminActionsRelations = relations(adminActions, ({ one }) => ({
  admin: one(users, {
    fields: [adminActions.adminId],
    references: [users.id],
  }),
}));
