import { db } from '../config/database';
import { portfolios, investmentGoals, portfolioPerformance, transactions, activities, notifications, deposits } from '../config/schema';
import { eq, and } from 'drizzle-orm';
import { generateReference } from '../utils/helpers';

const DAILY_RETURN_PERCENTAGE = parseFloat(process.env.DAILY_RETURN_PERCENTAGE || '0.5');

export const calculateDailyReturns = async () => {
  console.log(`[${new Date().toISOString()}] Starting daily return calculation...`);
  
  try {
    // Get all active portfolios with investment
    const allPortfolios = await db.query.portfolios.findMany({
      where: (portfolios, { gt }) => gt(portfolios.totalInvested, '0'),
      with: {
        user: true,
      },
    });

    console.log(`Found ${allPortfolios.length} portfolios with investment`);

    for (const portfolio of allPortfolios) {
      try {
        // Calculate daily profit
        const currentValue = parseFloat(portfolio.currentValue.toString());
        const dailyReturn = currentValue * (DAILY_RETURN_PERCENTAGE / 100);
        const newValue = currentValue + dailyReturn;
        const totalInvested = parseFloat(portfolio.totalInvested.toString());
        const newProfit = newValue - totalInvested;
        const newProfitPercentage = totalInvested > 0 ? (newProfit / totalInvested) * 100 : 0;

        // Update portfolio
        await db.update(portfolios)
          .set({
            currentValue: newValue.toFixed(8),
            totalProfit: newProfit.toFixed(8),
            profitPercentage: newProfitPercentage.toFixed(2),
            lastCalculatedAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(portfolios.id, portfolio.id));

        // Record performance
        await db.insert(portfolioPerformance).values({
          userId: portfolio.userId,
          date: new Date(),
          value: newValue.toFixed(8),
          invested: totalInvested.toFixed(8),
          profit: dailyReturn.toFixed(8),
        });

        // Create dividend transaction record
        await db.insert(transactions).values({
          userId: portfolio.userId,
          reference: generateReference('DIV'),
          type: 'dividend',
          amount: dailyReturn.toFixed(8),
          currency: 'USD',
          status: 'completed',
          description: `Daily return (${DAILY_RETURN_PERCENTAGE}%)`,
        });

        // Create activity
        await db.insert(activities).values({
          userId: portfolio.userId,
          type: 'deposit',
          title: 'Daily Return Credited',
          description: `$${dailyReturn.toFixed(2)} has been added to your portfolio from daily returns`,
          status: 'success',
        });

        // Check goal progress
        await updateGoalProgress(portfolio.userId);

        console.log(`✓ Portfolio ${portfolio.id}: +$${dailyReturn.toFixed(2)}`);
      } catch (error) {
        console.error(`Error processing portfolio ${portfolio.id}:`, error);
      }
    }

    console.log(`[${new Date().toISOString()}] Daily return calculation completed`);
  } catch (error) {
    console.error('Error in calculateDailyReturns:', error);
    throw error;
  }
};

export const updateGoalProgress = async (userId: number) => {
  try {
    // Get user's portfolio
    const portfolio = await db.query.portfolios.findFirst({
      where: eq(portfolios.userId, userId),
    });

    if (!portfolio) return;

    // Get active goals
    const goals = await db.query.investmentGoals.findMany({
      where: and(
        eq(investmentGoals.userId, userId),
        eq(investmentGoals.status, 'active')
      ),
    });

    for (const goal of goals) {
      const currentValue = parseFloat(portfolio.currentValue.toString());
      const targetAmount = parseFloat(goal.targetAmount.toString());
      const progress = targetAmount > 0 ? (currentValue / targetAmount) * 100 : 0;

      // Check if goal is completed
      let status = goal.status;
      if (progress >= 100) {
        status = 'completed';
        
        // Send goal completed notification
        await db.insert(notifications).values({
          userId,
          title: '🎉 Goal Completed!',
          message: `Congratulations! You've reached your goal: ${goal.name}`,
          type: 'success',
        });

        // Create activity
        await db.insert(activities).values({
          userId,
          type: 'goal_completed',
          title: 'Investment Goal Completed',
          description: `You've successfully reached your goal: ${goal.name}`,
          status: 'success',
        });
      }

      // Update goal
      await db.update(investmentGoals)
        .set({
          currentAmount: Math.min(currentValue, targetAmount).toFixed(8),
          progress: progress.toFixed(2),
          status,
          updatedAt: new Date(),
        })
        .where(eq(investmentGoals.id, goal.id));

      // Check for milestones (25%, 50%, 75%)
      const milestones = [25, 50, 75];
      const oldProgress = parseFloat((goal.progress ?? '0').toString());
      
      for (const milestone of milestones) {
        if (oldProgress < milestone && progress >= milestone) {
          await db.insert(notifications).values({
            userId,
            title: '🎯 Goal Milestone!',
            message: `You've reached ${milestone}% of your goal: ${goal.name}`,
            type: 'success',
          });
        }
      }
    }
  } catch (error) {
    console.error('Error updating goal progress:', error);
  }
};

export const canWithdraw = async (userId: number): Promise<{ eligible: boolean; reason?: string; daysUntil?: number; progress?: number }> => {
  try {
    // Get user's portfolio and goals
    const portfolio = await db.query.portfolios.findFirst({
      where: eq(portfolios.userId, userId),
    });

    const goal = await db.query.investmentGoals.findFirst({
      where: and(
        eq(investmentGoals.userId, userId),
        eq(investmentGoals.status, 'active')
      ),
    });

    if (!portfolio || parseFloat(portfolio.totalInvested.toString()) === 0) {
      return { eligible: false, reason: 'No active investment found' };
    }

    const minDays = parseInt(process.env.WITHDRAWAL_MIN_DAYS || '180');
    const firstDeposit = await db.query.deposits.findFirst({
      where: eq(deposits.userId, userId),
      orderBy: (deposits, { asc }) => [asc(deposits.createdAt)],
    });

    let daysInvested = 0;
    if (firstDeposit) {
      daysInvested = Math.floor((Date.now() - new Date(firstDeposit.createdAt).getTime()) / (1000 * 60 * 60 * 24));
    }

    const daysUntil = Math.max(0, minDays - daysInvested);
    
    let progress = 0;
    if (goal) {
      progress = parseFloat((goal.progress ?? '0').toString());
    }

    // Check if 100% goal progress OR minimum days reached
    const goalMet = progress >= 100;
    const timeMet = daysInvested >= minDays;

    if (!goalMet && !timeMet) {
      return {
        eligible: false,
        reason: `Withdrawal available when you reach 100% goal progress OR after ${minDays} days of investment`,
        daysUntil,
        progress,
      };
    }

    return { eligible: true, progress, daysUntil: 0 };
  } catch (error) {
    console.error('Error checking withdrawal eligibility:', error);
    return { eligible: false, reason: 'Unable to check eligibility' };
  }
};
