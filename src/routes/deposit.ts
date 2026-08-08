import express, { Response } from 'express';
import { body, validationResult } from 'express-validator';
import { db } from '../config/database';
import { deposits, transactions, activities, notifications } from '../config/schema';
import { eq, desc } from 'drizzle-orm';
import { authenticate, AuthRequest } from '../middleware/auth';
import { generateReference, generateWalletAddress } from '../utils/helpers';
import { sendEmail, emailTemplates } from '../utils/email';

const router = express.Router();

// Get wallet addresses
router.get('/wallets', authenticate, async (req: AuthRequest, res) => {
  try {
    const wallets = [
      { currency: 'BTC', network: 'Bitcoin', address: process.env.WALLET_BTC },
      { currency: 'ETH', network: 'ERC20', address: process.env.WALLET_ETH },
      { currency: 'SOL', network: 'Solana', address: process.env.WALLET_SOL },
      { currency: 'USDT', network: 'ERC20', address: process.env.WALLET_USDT_ERC20 },
      { currency: 'USDC', network: 'ERC20', address: process.env.WALLET_USDC_ERC20 },
    ];

    res.json({
      success: true,
      data: wallets,
    });
  } catch (error) {
    console.error('Get wallets error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get wallet addresses',
    });
  }
});

// Create deposit request
router.post(
  '/',
  authenticate,
  [
    body('currency').notEmpty(),
    body('network').notEmpty(),
    body('amount').isNumeric(),
    body('txHash').optional(),
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

      const { currency, network, amount, txHash } = req.body;
      const userId = req.user!.id;

      // Check minimum deposit
      const minDeposit = parseFloat(process.env.MINIMUM_DEPOSIT || '100');
      if (parseFloat(amount) < minDeposit) {
        return res.status(400).json({
          success: false,
          message: `Minimum deposit is $${minDeposit}`,
        });
      }

      // Get wallet address
      const walletAddress = generateWalletAddress(currency, network);

      // Create transaction record
      const reference = generateReference('DEP');
      const [transaction] = await db.insert(transactions).values({
        userId,
        reference,
        type: 'deposit',
        amount: amount.toString(),
        currency,
        status: 'pending',
        description: `Deposit via ${currency} (${network})`,
        metadata: { txHash, network },
      }).returning();

      // Create deposit record
      const [deposit] = await db.insert(deposits).values({
        userId,
        transactionId: transaction.id,
        amount: amount.toString(),
        currency,
        network,
        walletAddress,
        txHash: txHash || null,
        status: 'pending',
      }).returning();

      // Create activity
      await db.insert(activities).values({
        userId,
        type: 'deposit',
        title: 'Deposit Requested',
        description: `Deposit of $${amount} ${currency} is pending confirmation`,
        status: 'pending',
      });

      // Create notification
      await db.insert(notifications).values({
        userId,
        title: 'Deposit Pending',
        message: `Your deposit of $${amount} ${currency} is being reviewed`,
        type: 'info',
      });

      // Send email
      await sendEmail({
        to: req.user!.email,
        ...emailTemplates.depositReceived(amount, currency),
      });

      res.status(201).json({
        success: true,
        message: 'Deposit request created successfully',
        data: {
          deposit,
          transaction,
          walletAddress,
        },
      });
    } catch (error) {
      console.error('Create deposit error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to create deposit request',
      });
    }
  }
);

// Get user's deposits
router.get('/', authenticate, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.id;

    const userDeposits = await db.query.deposits.findMany({
      where: eq(deposits.userId, userId),
      orderBy: [desc(deposits.createdAt)],
      with: {
        transaction: true,
      },
    });

    res.json({
      success: true,
      data: userDeposits,
    });
  } catch (error) {
    console.error('Get deposits error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get deposits',
    });
  }
});

// Get deposit by ID
router.get('/:id', authenticate, async (req: AuthRequest, res) => {
  try {
    const depositId = parseInt(req.params.id);
    const userId = req.user!.id;

    const deposit = await db.query.deposits.findFirst({
      where: eq(deposits.id, depositId),
      with: {
        transaction: true,
      },
    });

    if (!deposit || deposit.userId !== userId) {
      return res.status(404).json({
        success: false,
        message: 'Deposit not found',
      });
    }

    res.json({
      success: true,
      data: deposit,
    });
  } catch (error) {
    console.error('Get deposit error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get deposit',
    });
  }
});

export default router;
