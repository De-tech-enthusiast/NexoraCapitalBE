import express, { Response } from 'express';
import { body, validationResult } from 'express-validator';
import { db } from '../config/database';
import { withdrawals, transactions, activities, notifications, portfolios } from '../config/schema';
import { eq, desc } from 'drizzle-orm';
import { authenticate, AuthRequest } from '../middleware/auth';
import { generateReference } from '../utils/helpers';
import { sendEmail, emailTemplates } from '../utils/email';
import { canWithdraw } from '../services/investmentService';

const router = express.Router();

// Check withdrawal eligibility
router.get('/eligibility', authenticate, async (req: AuthRequest, res) => {
  try {
    const eligibility = await canWithdraw(req.user!.id);

    res.json({
      success: true,
      data: eligibility,
    });
  } catch (error) {
    console.error('Check eligibility error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to check eligibility',
    });
  }
});

// Create withdrawal request
router.post(
  '/',
  authenticate,
  [
    body('amount').isNumeric(),
    body('currency').notEmpty(),
    body('network').notEmpty(),
    body('destinationAddress').notEmpty(),
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

      const { amount, currency, network, destinationAddress } = req.body;
      const userId = req.user!.id;

      // Check eligibility
      const eligibility = await canWithdraw(userId);
      if (!eligibility.eligible) {
        return res.status(400).json({
          success: false,
          message: eligibility.reason,
          data: eligibility,
        });
      }

      // Check minimum withdrawal
      const minWithdrawal = parseFloat(process.env.MINIMUM_WITHDRAWAL || '100');
      if (parseFloat(amount) < minWithdrawal) {
        return res.status(400).json({
          success: false,
          message: `Minimum withdrawal is $${minWithdrawal}`,
        });
      }

      // Check if user has sufficient balance
      const portfolio = await db.query.portfolios.findFirst({
        where: eq(portfolios.userId, userId),
      });

      if (!portfolio || parseFloat(portfolio.currentValue.toString()) < parseFloat(amount)) {
        return res.status(400).json({
          success: false,
          message: 'Insufficient balance',
        });
      }

      // Calculate fee
      const feePercentage = parseFloat(process.env.WITHDRAWAL_FEE_PERCENTAGE || '0.5');
      const fee = parseFloat(amount) * (feePercentage / 100);
      const receiveAmount = parseFloat(amount) - fee;

      // Create transaction record
      const reference = generateReference('WDR');
      const [transaction] = await db.insert(transactions).values({
        userId,
        reference,
        type: 'withdrawal',
        amount: amount.toString(),
        currency,
        status: 'pending',
        description: `Withdrawal to ${destinationAddress.slice(0, 8)}...`,
        metadata: { network, destinationAddress, fee: fee.toString() },
      }).returning();

      // Create withdrawal record
      const [withdrawal] = await db.insert(withdrawals).values({
        userId,
        transactionId: transaction.id,
        amount: amount.toString(),
        currency,
        network,
        destinationAddress,
        fee: fee.toString(),
        status: 'pending',
      }).returning();

      // Create activity
      await db.insert(activities).values({
        userId,
        type: 'withdrawal',
        title: 'Withdrawal Requested',
        description: `Withdrawal of $${amount} ${currency} is pending approval`,
        status: 'pending',
      });

      // Create notification
      await db.insert(notifications).values({
        userId,
        title: 'Withdrawal Pending',
        message: `Your withdrawal request of $${amount} ${currency} is being reviewed`,
        type: 'info',
      });

      // Send email
      await sendEmail({
        to: req.user!.email,
        ...emailTemplates.withdrawalRequested(amount, currency),
      });

      res.status(201).json({
        success: true,
        message: 'Withdrawal request created successfully',
        data: {
          withdrawal,
          transaction,
          fee: fee.toString(),
          receiveAmount: receiveAmount.toString(),
        },
      });
    } catch (error) {
      console.error('Create withdrawal error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to create withdrawal request',
      });
    }
  }
);

// Get user's withdrawals
router.get('/', authenticate, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.id;

    const userWithdrawals = await db.query.withdrawals.findMany({
      where: eq(withdrawals.userId, userId),
      orderBy: [desc(withdrawals.createdAt)],
      with: {
        transaction: true,
      },
    });

    res.json({
      success: true,
      data: userWithdrawals,
    });
  } catch (error) {
    console.error('Get withdrawals error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get withdrawals',
    });
  }
});

// Get withdrawal by ID
router.get('/:id', authenticate, async (req: AuthRequest, res) => {
  try {
    const withdrawalId = parseInt(req.params.id);
    const userId = req.user!.id;

    const withdrawal = await db.query.withdrawals.findFirst({
      where: eq(withdrawals.id, withdrawalId),
      with: {
        transaction: true,
      },
    });

    if (!withdrawal || withdrawal.userId !== userId) {
      return res.status(404).json({
        success: false,
        message: 'Withdrawal not found',
      });
    }

    res.json({
      success: true,
      data: withdrawal,
    });
  } catch (error) {
    console.error('Get withdrawal error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get withdrawal',
    });
  }
});

export default router;
