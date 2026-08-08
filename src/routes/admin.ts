import express, { Response } from 'express';
import { body, validationResult } from 'express-validator';
import { db } from '../config/database';
import {
  users,
  portfolios,
  deposits,
  withdrawals,
  transactions,
  activities,
  notifications,
  adminActions,
  investmentGoals,
} from '../config/schema';
import { eq, desc, and } from 'drizzle-orm';
import { authenticate, requireAdmin, AuthRequest } from '../middleware/auth';
import { sendEmail, emailTemplates } from '../utils/email';
import { updateGoalProgress } from '../services/investmentService';

const router = express.Router();

// All admin routes require authentication and admin role
router.use(authenticate);
router.use(requireAdmin);

// Get dashboard stats
router.get('/stats', async (req, res) => {
  try {
    // Get all users count
    const allUsers = await db.query.users.findMany();
    const totalUsers = allUsers.filter(u => u.role === 'user').length;
    const totalAdmins = allUsers.filter(u => u.role === 'admin').length;

    // Get all portfolios
    const allPortfolios = await db.query.portfolios.findMany();
    const totalAum = allPortfolios.reduce((sum, p) => sum + parseFloat(p.currentValue.toString()), 0);
    const totalInvested = allPortfolios.reduce((sum, p) => sum + parseFloat(p.totalInvested.toString()), 0);
    const totalProfit = allPortfolios.reduce((sum, p) => sum + parseFloat(p.totalProfit.toString()), 0);

    // Get pending deposits
    const pendingDeposits = await db.query.deposits.findMany({
      where: eq(deposits.status, 'pending'),
    });

    // Get pending withdrawals
    const pendingWithdrawals = await db.query.withdrawals.findMany({
      where: eq(withdrawals.status, 'pending'),
    });

    // Get today's new users
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const newUsersToday = allUsers.filter(u => new Date(u.createdAt) >= today).length;

    res.json({
      success: true,
      data: {
        users: {
          total: totalUsers,
          admins: totalAdmins,
          newToday: newUsersToday,
        },
        portfolio: {
          totalAum,
          totalInvested,
          totalProfit,
          averageReturn: totalInvested > 0 ? ((totalProfit / totalInvested) * 100).toFixed(2) : 0,
        },
        pending: {
          deposits: pendingDeposits.length,
          withdrawals: pendingWithdrawals.length,
        },
      },
    });
  } catch (error) {
    console.error('Get admin stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get admin stats',
    });
  }
});

// Get all users
router.get('/users', async (req, res) => {
  try {
    const { search, limit = '50', offset = '0' } = req.query;

    let allUsers = await db.query.users.findMany({
      with: {
        portfolio: true,
      },
      orderBy: [desc(users.createdAt)],
    });

    // Filter out admins and search
    allUsers = allUsers.filter(u => u.role === 'user');
    
    if (search) {
      const searchLower = (search as string).toLowerCase();
      allUsers = allUsers.filter(u => 
        u.email.toLowerCase().includes(searchLower) ||
        u.username.toLowerCase().includes(searchLower) ||
        u.firstName.toLowerCase().includes(searchLower) ||
        u.lastName.toLowerCase().includes(searchLower)
      );
    }

    const total = allUsers.length;
    const paginatedUsers = allUsers.slice(
      parseInt(offset as string),
      parseInt(offset as string) + parseInt(limit as string)
    );

    // Remove password hashes from response
    const sanitizedUsers = paginatedUsers.map(user => ({
      ...user,
      passwordHash: '[REDACTED]',
      twoFactorSecret: user.twoFactorSecret ? '[REDACTED]' : null,
    }));

    res.json({
      success: true,
      data: {
        users: sanitizedUsers,
        total,
        limit: parseInt(limit as string),
        offset: parseInt(offset as string),
      },
    });
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get users',
    });
  }
});

// Get single user with full details
router.get('/users/:id', async (req, res) => {
  try {
    const userId = parseInt(req.params.id);

    const user = await db.query.users.findFirst({
      where: eq(users.id, userId),
      with: {
        portfolio: true,
      },
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    // Get user's deposits
    const userDeposits = await db.query.deposits.findMany({
      where: eq(deposits.userId, userId),
      orderBy: [desc(deposits.createdAt)],
    });

    // Get user's withdrawals
    const userWithdrawals = await db.query.withdrawals.findMany({
      where: eq(withdrawals.userId, userId),
      orderBy: [desc(withdrawals.createdAt)],
    });

    // Get user's transactions
    const userTransactions = await db.query.transactions.findMany({
      where: eq(transactions.userId, userId),
      orderBy: [desc(transactions.createdAt)],
      limit: 20,
    });

    // Get user's goals
    const userGoals = await db.query.investmentGoals.findMany({
      where: eq(investmentGoals.userId, userId),
      orderBy: [desc(investmentGoals.createdAt)],
    });

    res.json({
      success: true,
      data: {
        user: {
          ...user,
          passwordHash: '[REDACTED]',
          twoFactorSecret: user.twoFactorSecret ? '[REDACTED]' : null,
        },
        deposits: userDeposits,
        withdrawals: userWithdrawals,
        transactions: userTransactions,
        goals: userGoals,
      },
    });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get user',
    });
  }
});

// Update user balance
router.put(
  '/users/:id/balance',
  [
    body('amount').isNumeric(),
    body('type').isIn(['add', 'subtract', 'set']),
    body('reason').notEmpty(),
  ],
  async (req: AuthRequest, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Validation error',
          errors: errors.array(),
        });
      }

      const userId = parseInt(req.params.id);
      const { amount, type, reason } = req.body;
      const adminId = req.user!.id;

      // Get user and portfolio
      const user = await db.query.users.findFirst({
        where: eq(users.id, userId),
      });

      const portfolio = await db.query.portfolios.findFirst({
        where: eq(portfolios.userId, userId),
      });

      if (!user || !portfolio) {
        return res.status(404).json({
          success: false,
          message: 'User or portfolio not found',
        });
      }

      const currentValue = parseFloat(portfolio.currentValue.toString());
      const currentInvested = parseFloat(portfolio.totalInvested.toString());
      let newValue = currentValue;
      let newInvested = currentInvested;

      if (type === 'add') {
        newValue = currentValue + parseFloat(amount);
        newInvested = currentInvested + parseFloat(amount);
      } else if (type === 'subtract') {
        newValue = Math.max(0, currentValue - parseFloat(amount));
        newInvested = Math.max(0, currentInvested - parseFloat(amount));
      } else if (type === 'set') {
        const diff = parseFloat(amount) - currentValue;
        newValue = parseFloat(amount);
        newInvested = Math.max(0, currentInvested + diff);
      }

      const oldValue = portfolio.currentValue;

      // Update portfolio
      await db.update(portfolios)
        .set({
          currentValue: newValue.toFixed(8),
          totalInvested: newInvested.toFixed(8),
          updatedAt: new Date(),
        })
        .where(eq(portfolios.id, portfolio.id));

      // Create adjustment transaction
      await db.insert(transactions).values({
        userId,
        reference: `ADJ-${Date.now()}`,
        type: 'adjustment',
        amount: type === 'set' ? newValue.toString() : amount.toString(),
        currency: 'USD',
        status: 'completed',
        description: `Balance adjustment by admin: ${reason}`,
        metadata: { type, adminId, reason },
      });

      // Log admin action
      await db.insert(adminActions).values({
        adminId,
        action: 'balance_adjustment',
        targetUserId: userId,
        targetType: 'portfolio',
        targetId: portfolio.id,
        oldValue: { currentValue: oldValue },
        newValue: { currentValue: newValue.toFixed(8) },
        notes: reason,
        ipAddress: req.ip || 'unknown',
      });

      // Update goal progress
      await updateGoalProgress(userId);

      res.json({
        success: true,
        message: 'Balance updated successfully',
        data: {
          oldValue: oldValue.toString(),
          newValue: newValue.toFixed(8),
        },
      });
    } catch (error) {
      console.error('Update balance error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update balance',
      });
    }
  }
);

// Get pending deposits
router.get('/deposits/pending', async (req, res) => {
  try {
    const pendingDeposits = await db.query.deposits.findMany({
      where: eq(deposits.status, 'pending'),
      with: {
        user: true,
        transaction: true,
      },
      orderBy: [desc(deposits.createdAt)],
    });

    res.json({
      success: true,
      data: pendingDeposits,
    });
  } catch (error) {
    console.error('Get pending deposits error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get pending deposits',
    });
  }
});

// Approve deposit
router.put('/deposits/:id/approve', async (req: AuthRequest, res) => {
  try {
    const depositId = parseInt(req.params.id);
    const adminId = req.user!.id;

    const deposit = await db.query.deposits.findFirst({
      where: eq(deposits.id, depositId),
      with: {
        user: true,
        transaction: true,
      },
    });

    if (!deposit) {
      return res.status(404).json({
        success: false,
        message: 'Deposit not found',
      });
    }

    if (deposit.status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: `Deposit is already ${deposit.status}`,
      });
    }

    // Get user's portfolio
    const portfolio = await db.query.portfolios.findFirst({
      where: eq(portfolios.userId, deposit.userId),
    });

    if (!portfolio) {
      return res.status(404).json({
        success: false,
        message: 'User portfolio not found',
      });
    }

    const amount = parseFloat(deposit.amount.toString());
    const currentValue = parseFloat(portfolio.currentValue.toString());
    const currentInvested = parseFloat(portfolio.totalInvested.toString());

    // Update portfolio
    await db.update(portfolios)
      .set({
        currentValue: (currentValue + amount).toFixed(8),
        totalInvested: (currentInvested + amount).toFixed(8),
        updatedAt: new Date(),
      })
      .where(eq(portfolios.id, portfolio.id));

    // Update deposit
    await db.update(deposits)
      .set({
        status: 'completed',
        reviewedBy: adminId,
        reviewedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(deposits.id, depositId));

    // Update transaction
    await db.update(transactions)
      .set({
        status: 'completed',
        updatedAt: new Date(),
      })
      .where(eq(transactions.id, deposit.transactionId!));

    // Create activity
    await db.insert(activities).values({
      userId: deposit.userId,
      type: 'deposit',
      title: 'Deposit Confirmed',
      description: `Your deposit of $${amount} has been confirmed`,
      status: 'success',
    });

    // Create notification
    await db.insert(notifications).values({
      userId: deposit.userId,
      title: 'Deposit Confirmed',
      message: `Your deposit of $${amount} ${deposit.currency} has been confirmed and added to your portfolio`,
      type: 'success',
    });

    // Log admin action
    await db.insert(adminActions).values({
      adminId,
      action: 'deposit_approved',
      targetUserId: deposit.userId,
      targetType: 'deposit',
      targetId: depositId,
      newValue: { status: 'completed' },
      notes: 'Deposit approved by admin',
      ipAddress: req.ip || 'unknown',
    });

    // Update goal progress
    await updateGoalProgress(deposit.userId);

    // Send email
    await sendEmail({
      to: deposit.user.email,
      ...emailTemplates.depositConfirmed(amount.toString(), deposit.currency),
    });

    res.json({
      success: true,
      message: 'Deposit approved successfully',
    });
  } catch (error) {
    console.error('Approve deposit error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to approve deposit',
    });
  }
});

// Reject deposit
router.put('/deposits/:id/reject', async (req: AuthRequest, res) => {
  try {
    const depositId = parseInt(req.params.id);
    const { reason } = req.body;
    const adminId = req.user!.id;

    const deposit = await db.query.deposits.findFirst({
      where: eq(deposits.id, depositId),
      with: {
        user: true,
      },
    });

    if (!deposit) {
      return res.status(404).json({
        success: false,
        message: 'Deposit not found',
      });
    }

    // Update deposit
    await db.update(deposits)
      .set({
        status: 'rejected',
        adminNotes: reason,
        reviewedBy: adminId,
        reviewedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(deposits.id, depositId));

    // Update transaction
    await db.update(transactions)
      .set({
        status: 'failed',
        updatedAt: new Date(),
      })
      .where(eq(transactions.id, deposit.transactionId!));

    // Create notification
    await db.insert(notifications).values({
      userId: deposit.userId,
      title: 'Deposit Rejected',
      message: reason || 'Your deposit was rejected. Please contact support.',
      type: 'error',
    });

    // Log admin action
    await db.insert(adminActions).values({
      adminId,
      action: 'deposit_rejected',
      targetUserId: deposit.userId,
      targetType: 'deposit',
      targetId: depositId,
      newValue: { status: 'rejected', reason },
      notes: reason,
      ipAddress: req.ip || 'unknown',
    });

    res.json({
      success: true,
      message: 'Deposit rejected successfully',
    });
  } catch (error) {
    console.error('Reject deposit error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to reject deposit',
    });
  }
});

// Get pending withdrawals
router.get('/withdrawals/pending', async (req, res) => {
  try {
    const pendingWithdrawals = await db.query.withdrawals.findMany({
      where: eq(withdrawals.status, 'pending'),
      with: {
        user: true,
        transaction: true,
      },
      orderBy: [desc(withdrawals.createdAt)],
    });

    res.json({
      success: true,
      data: pendingWithdrawals,
    });
  } catch (error) {
    console.error('Get pending withdrawals error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get pending withdrawals',
    });
  }
});

// Approve withdrawal
router.put('/withdrawals/:id/approve', async (req: AuthRequest, res) => {
  try {
    const withdrawalId = parseInt(req.params.id);
    const adminId = req.user!.id;

    const withdrawal = await db.query.withdrawals.findFirst({
      where: eq(withdrawals.id, withdrawalId),
      with: {
        user: true,
        transaction: true,
      },
    });

    if (!withdrawal) {
      return res.status(404).json({
        success: false,
        message: 'Withdrawal not found',
      });
    }

    if (withdrawal.status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: `Withdrawal is already ${withdrawal.status}`,
      });
    }

    // Get user's portfolio
    const portfolio = await db.query.portfolios.findFirst({
      where: eq(portfolios.userId, withdrawal.userId),
    });

    if (!portfolio) {
      return res.status(404).json({
        success: false,
        message: 'User portfolio not found',
      });
    }

    const amount = parseFloat(withdrawal.amount.toString());
    const currentValue = parseFloat(portfolio.currentValue.toString());
    const currentInvested = parseFloat(portfolio.totalInvested.toString());

    // Check sufficient balance
    if (currentValue < amount) {
      return res.status(400).json({
        success: false,
        message: 'Insufficient user balance',
      });
    }

    // Update portfolio
    await db.update(portfolios)
      .set({
        currentValue: (currentValue - amount).toFixed(8),
        totalInvested: Math.max(0, currentInvested - amount).toFixed(8),
        updatedAt: new Date(),
      })
      .where(eq(portfolios.id, portfolio.id));

    // Update withdrawal
    await db.update(withdrawals)
      .set({
        status: 'completed',
        reviewedBy: adminId,
        reviewedAt: new Date(),
        processedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(withdrawals.id, withdrawalId));

    // Update transaction
    await db.update(transactions)
      .set({
        status: 'completed',
        updatedAt: new Date(),
      })
      .where(eq(transactions.id, withdrawal.transactionId!));

    // Create activity
    await db.insert(activities).values({
      userId: withdrawal.userId,
      type: 'withdrawal',
      title: 'Withdrawal Processed',
      description: `Your withdrawal of $${amount} has been processed`,
      status: 'success',
    });

    // Create notification
    await db.insert(notifications).values({
      userId: withdrawal.userId,
      title: 'Withdrawal Completed',
      message: `Your withdrawal of $${amount} ${withdrawal.currency} has been processed`,
      type: 'success',
    });

    // Log admin action
    await db.insert(adminActions).values({
      adminId,
      action: 'withdrawal_approved',
      targetUserId: withdrawal.userId,
      targetType: 'withdrawal',
      targetId: withdrawalId,
      newValue: { status: 'completed' },
      notes: 'Withdrawal approved by admin',
      ipAddress: req.ip || 'unknown',
    });

    // Update goal progress
    await updateGoalProgress(withdrawal.userId);

    // Send email
    await sendEmail({
      to: withdrawal.user.email,
      ...emailTemplates.withdrawalProcessed(
        amount.toString(),
        withdrawal.currency,
        withdrawal.txHash || undefined
      ),
    });

    res.json({
      success: true,
      message: 'Withdrawal approved and processed successfully',
    });
  } catch (error) {
    console.error('Approve withdrawal error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to approve withdrawal',
    });
  }
});

// Reject withdrawal
router.put('/withdrawals/:id/reject', async (req: AuthRequest, res) => {
  try {
    const withdrawalId = parseInt(req.params.id);
    const { reason } = req.body;
    const adminId = req.user!.id;

    const withdrawal = await db.query.withdrawals.findFirst({
      where: eq(withdrawals.id, withdrawalId),
      with: {
        user: true,
      },
    });

    if (!withdrawal) {
      return res.status(404).json({
        success: false,
        message: 'Withdrawal not found',
      });
    }

    // Update withdrawal
    await db.update(withdrawals)
      .set({
        status: 'rejected',
        adminNotes: reason,
        reviewedBy: adminId,
        reviewedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(withdrawals.id, withdrawalId));

    // Update transaction
    await db.update(transactions)
      .set({
        status: 'failed',
        updatedAt: new Date(),
      })
      .where(eq(transactions.id, withdrawal.transactionId!));

    // Create notification
    await db.insert(notifications).values({
      userId: withdrawal.userId,
      title: 'Withdrawal Rejected',
      message: reason || 'Your withdrawal was rejected. Please contact support.',
      type: 'error',
    });

    // Log admin action
    await db.insert(adminActions).values({
      adminId,
      action: 'withdrawal_rejected',
      targetUserId: withdrawal.userId,
      targetType: 'withdrawal',
      targetId: withdrawalId,
      newValue: { status: 'rejected', reason },
      notes: reason,
      ipAddress: req.ip || 'unknown',
    });

    res.json({
      success: true,
      message: 'Withdrawal rejected successfully',
    });
  } catch (error) {
    console.error('Reject withdrawal error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to reject withdrawal',
    });
  }
});

// Send custom notification to user
router.post(
  '/notifications',
  [
    body('userId').isNumeric(),
    body('title').notEmpty(),
    body('message').notEmpty(),
    body('type').isIn(['info', 'success', 'warning', 'error']),
  ],
  async (req: AuthRequest, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Validation error',
          errors: errors.array(),
        });
      }

      const { userId, title, message, type } = req.body;
      const adminId = req.user!.id;

      // Create notification
      const [notification] = await db.insert(notifications).values({
        userId: parseInt(userId),
        title,
        message,
        type,
      }).returning();

      // Log admin action
      await db.insert(adminActions).values({
        adminId,
        action: 'notification_sent',
        targetUserId: parseInt(userId),
        targetType: 'notification',
        targetId: notification.id,
        newValue: { title, message, type },
        ipAddress: req.ip || 'unknown',
      });

      res.json({
        success: true,
        message: 'Notification sent successfully',
        data: notification,
      });
    } catch (error) {
      console.error('Send notification error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to send notification',
      });
    }
  }
);

// Get admin action logs
router.get('/logs', async (req, res) => {
  try {
    const { limit = '50', offset = '0' } = req.query;

    const logs = await db.query.adminActions.findMany({
      with: {
        admin: true,
      },
      orderBy: [desc(adminActions.createdAt)],
      limit: parseInt(limit as string),
      offset: parseInt(offset as string),
    });

    res.json({
      success: true,
      data: logs,
    });
  } catch (error) {
    console.error('Get logs error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get logs',
    });
  }
});

export default router;
