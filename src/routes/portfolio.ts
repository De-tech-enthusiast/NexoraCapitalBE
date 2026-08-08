import express from 'express';
import { db } from '../config/database';
import { portfolios, investmentGoals, portfolioPerformance, transactions } from '../config/schema';
import { eq, and, gte, lte, desc } from 'drizzle-orm';
import { authenticate, AuthRequest } from '../middleware/auth';

const router = express.Router();

// Get dashboard data
router.get('/dashboard', authenticate, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.id;

    // Get portfolio
    const portfolio = await db.query.portfolios.findFirst({
      where: eq(portfolios.userId, userId),
    });

    // Get active goal
    const goal = await db.query.investmentGoals.findFirst({
      where: and(
        eq(investmentGoals.userId, userId),
        eq(investmentGoals.status, 'active')
      ),
    });

    // Get recent transactions
    const recentTransactions = await db.query.transactions.findMany({
      where: eq(transactions.userId, userId),
      orderBy: [desc(transactions.createdAt)],
      limit: 5,
    });

    // Get performance data (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const performance = await db.query.portfolioPerformance.findMany({
      where: and(
        eq(portfolioPerformance.userId, userId),
        gte(portfolioPerformance.date, thirtyDaysAgo)
      ),
      orderBy: [desc(portfolioPerformance.date)],
      limit: 30,
    });

    res.json({
      success: true,
      data: {
        portfolio: portfolio || {
          currentValue: '0',
          totalInvested: '0',
          totalProfit: '0',
          profitPercentage: '0',
        },
        goal,
        recentTransactions,
        performance: performance.reverse(),
      },
    });
  } catch (error) {
    console.error('Get dashboard error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get dashboard data',
    });
  }
});

// Get portfolio details
router.get('/', authenticate, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.id;

    const portfolio = await db.query.portfolios.findFirst({
      where: eq(portfolios.userId, userId),
    });

    if (!portfolio) {
      return res.status(404).json({
        success: false,
        message: 'Portfolio not found',
      });
    }

    res.json({
      success: true,
      data: portfolio,
    });
  } catch (error) {
    console.error('Get portfolio error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get portfolio',
    });
  }
});

// Get performance history
router.get('/performance', authenticate, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.id;
    const { from, to } = req.query;

    let conditions = eq(portfolioPerformance.userId, userId);

    if (from && to) {
      conditions = and(
        conditions,
        gte(portfolioPerformance.date, new Date(from as string)),
        lte(portfolioPerformance.date, new Date(to as string))
      ) as any;
    }

    const performance = await db.query.portfolioPerformance.findMany({
      where: conditions,
      orderBy: [desc(portfolioPerformance.date)],
    });

    res.json({
      success: true,
      data: performance,
    });
  } catch (error) {
    console.error('Get performance error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get performance data',
    });
  }
});

// Get investment goal
router.get('/goal', authenticate, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.id;

    const goal = await db.query.investmentGoals.findFirst({
      where: and(
        eq(investmentGoals.userId, userId),
        eq(investmentGoals.status, 'active')
      ),
    });

    if (!goal) {
      return res.status(404).json({
        success: false,
        message: 'No active goal found',
      });
    }

    res.json({
      success: true,
      data: goal,
    });
  } catch (error) {
    console.error('Get goal error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get investment goal',
    });
  }
});

// Update/create investment goal
router.post('/goal', authenticate, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.id;
    const { name, targetAmount, duration } = req.body;

    // Check if user has portfolio with investment
    const portfolio = await db.query.portfolios.findFirst({
      where: eq(portfolios.userId, userId),
    });

    // Deactivate existing goals
    await db.update(investmentGoals)
      .set({ status: 'cancelled' })
      .where(eq(investmentGoals.userId, userId));

    // Create new goal
    const startDate = new Date();
    const endDate = new Date();
    endDate.setMonth(endDate.getMonth() + parseInt(duration));

    const [newGoal] = await db.insert(investmentGoals).values({
      userId,
      name,
      targetAmount: targetAmount.toString(),
      currentAmount: portfolio?.currentValue || '0',
      duration: parseInt(duration),
      startDate,
      endDate,
      status: 'active',
      progress: '0',
    }).returning();

    res.json({
      success: true,
      message: 'Investment goal created successfully',
      data: newGoal,
    });
  } catch (error) {
    console.error('Create goal error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create investment goal',
    });
  }
});

export default router;
