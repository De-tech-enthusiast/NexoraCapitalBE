import express, { Response } from 'express';
import { db } from '../config/database';
import { transactions } from '../config/schema';
import { eq, desc, and } from 'drizzle-orm';
import { authenticate, AuthRequest } from '../middleware/auth';

const router = express.Router();

// Get all transactions
router.get('/', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const { type, status, limit = '20', offset = '0' } = req.query;

    let conditions: any = eq(transactions.userId, userId);

    if (type) {
      conditions = and(conditions, eq(transactions.type, type as any));
    }

    if (status) {
      conditions = and(conditions, eq(transactions.status, status as any));
    }

    const userTransactions = await db.query.transactions.findMany({
      where: conditions,
      orderBy: [desc(transactions.createdAt)],
      limit: parseInt(limit as string),
      offset: parseInt(offset as string),
    });

    // Get total count
    const allTransactions = await db.query.transactions.findMany({
      where: eq(transactions.userId, userId),
    });

    res.json({
      success: true,
      data: {
        transactions: userTransactions,
        total: allTransactions.length,
        limit: parseInt(limit as string),
        offset: parseInt(offset as string),
      },
    });
  } catch (error) {
    console.error('Get transactions error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get transactions',
    });
  }
});

// Get transaction by ID
router.get('/:id', authenticate, async (req: AuthRequest, res) => {
  try {
    const transactionId = parseInt(req.params.id);
    const userId = req.user!.id;

    const transaction = await db.query.transactions.findFirst({
      where: eq(transactions.id, transactionId),
    });

    if (!transaction || transaction.userId !== userId) {
      return res.status(404).json({
        success: false,
        message: 'Transaction not found',
      });
    }

    res.json({
      success: true,
      data: transaction,
    });
  } catch (error) {
    console.error('Get transaction error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get transaction',
    });
  }
});

// Get transaction stats
router.get('/stats/summary', authenticate, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.id;

    const userTransactions = await db.query.transactions.findMany({
      where: eq(transactions.userId, userId),
    });

    const totalDeposits = userTransactions
      .filter(t => t.type === 'deposit' && t.status === 'completed')
      .reduce((sum, t) => sum + parseFloat(t.amount.toString()), 0);

    const totalWithdrawals = userTransactions
      .filter(t => t.type === 'withdrawal' && t.status === 'completed')
      .reduce((sum, t) => sum + parseFloat(t.amount.toString()), 0);

    const totalDividends = userTransactions
      .filter(t => t.type === 'dividend')
      .reduce((sum, t) => sum + parseFloat(t.amount.toString()), 0);

    res.json({
      success: true,
      data: {
        totalDeposits,
        totalWithdrawals,
        totalDividends,
        transactionCount: userTransactions.length,
      },
    });
  } catch (error) {
    console.error('Get transaction stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get transaction stats',
    });
  }
});

export default router;
