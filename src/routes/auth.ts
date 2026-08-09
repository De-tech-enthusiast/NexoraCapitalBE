import express, { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { body, validationResult } from 'express-validator';
import { db } from '../config/database';
import { users, portfolios, investmentGoals, activities, loginHistory, sessions } from '../config/schema';
import { eq } from 'drizzle-orm';
import { authenticate, AuthRequest } from '../middleware/auth';
import { sendEmail, emailTemplates } from '../utils/email';
import { addMonths, generateToken } from '../utils/helpers';

const router = express.Router();

// Register
router.post(
  '/register',
  [
    body('email').isEmail().normalizeEmail(),
    body('password').isLength({ min: 8 }),
    body('username').isLength({ min: 3 }),
    body('firstName').notEmpty(),
    body('lastName').notEmpty(),
    body('country').notEmpty(),
  ],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Validation error',
          errors: errors.array(),
        });
      }

      const { email, password, username, firstName, lastName, country } = req.body;

      // Check if user exists
      const existingUser = await db.query.users.findFirst({
        where: eq(users.email, email),
      });

      if (existingUser) {
        return res.status(400).json({
          success: false,
          message: 'Email already registered',
        });
      }

      // Check username
      const existingUsername = await db.query.users.findFirst({
        where: eq(users.username, username),
      });

      if (existingUsername) {
        return res.status(400).json({
          success: false,
          message: 'Username already taken',
        });
      }

      // Hash password
      const salt = await bcrypt.genSalt(10);
      const passwordHash = await bcrypt.hash(password, salt);

      // Create user
      const [newUser] = await db.insert(users).values({
        email,
        passwordHash,
        username,
        firstName,
        lastName,
        country,
        verificationStatus: 'pending',
        emailVerified: false,
      }).returning();

      // Create portfolio
      await db.insert(portfolios).values({
        userId: newUser.id,
        currentValue: '0',
        totalInvested: '0',
        totalProfit: '0',
      });

      // Create default investment goal
      await db.insert(investmentGoals).values({
        userId: newUser.id,
        name: 'Wealth Building 2024',
        targetAmount: '100000',
        currentAmount: '0',
        duration: 12,
        startDate: new Date(),
        endDate: addMonths(new Date(), 12),
        status: 'active',
      });

      // Create activity
      await db.insert(activities).values({
        userId: newUser.id,
        type: 'profile_updated',
        title: 'Account Created',
        description: 'Welcome to Nexora Capital! Your account has been created successfully.',
        status: 'success',
      });

      // Send welcome email
      await sendEmail({
        to: email,
        ...emailTemplates.welcome(firstName),
      });

      // Generate JWT
      const token = generateToken({
        userId: newUser.id,
        email: newUser.email,
        role: newUser.role,
      });

      res.status(201).json({
        success: true,
        message: 'Registration successful',
               data: {
          user: {
            id: newUser.id,
            email: newUser.email,
            username: newUser.username,
            firstName: newUser.firstName,
            lastName: newUser.lastName,
            country: newUser.country,
            preferredCurrency: newUser.preferredCurrency,
            role: newUser.role,
            verificationStatus: newUser.verificationStatus,
          },
          token,
        },
      });
    } catch (error) {
      console.error('Registration error:', error);
      res.status(500).json({
        success: false,
        message: 'Registration failed',
      });
    }
  }
);

// Login
router.post(
  '/login',
  [
    body('email').isEmail().normalizeEmail(),
    body('password').notEmpty(),
  ],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Validation error',
          errors: errors.array(),
        });
      }

      const { email, password, rememberMe } = req.body;

      // Find user
      const user = await db.query.users.findFirst({
        where: eq(users.email, email),
      });

      if (!user) {
        return res.status(401).json({
          success: false,
          message: 'Invalid credentials',
        });
      }

      // Verify password
      const isValidPassword = await bcrypt.compare(password, user.passwordHash);

      if (!isValidPassword) {
        // Log failed login
        await db.insert(loginHistory).values({
          userId: user.id,
          device: req.headers['user-agent'] || 'Unknown',
          browser: req.headers['user-agent'] || 'Unknown',
          location: req.ip || 'Unknown',
          ipAddress: req.ip || 'Unknown',
          status: 'failed',
        });

        return res.status(401).json({
          success: false,
          message: 'Invalid credentials',
        });
      }

      // Update last login
      await db.update(users)
        .set({ lastLoginAt: new Date() })
        .where(eq(users.id, user.id));

      // Log successful login
      await db.insert(loginHistory).values({
        userId: user.id,
        device: req.headers['user-agent'] || 'Unknown',
        browser: req.headers['user-agent'] || 'Unknown',
        location: req.ip || 'Unknown',
        ipAddress: req.ip || 'Unknown',
        status: 'success',
      });

      // Create session
      const expiresAt = rememberMe 
        ? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days
        : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

      await db.insert(sessions).values({
        userId: user.id,
        token: '', // Will be updated with JWT
        device: req.headers['user-agent'] || 'Unknown',
        browser: req.headers['user-agent'] || 'Unknown',
        location: req.ip || 'Unknown',
        ipAddress: req.ip || 'Unknown',
        current: true,
        expiresAt,
      });

      // Generate JWT
      const token = generateToken(
        { userId: user.id, email: user.email, role: user.role },
        rememberMe ? '30d' : '7d'
      );

      res.json({
  success: true,
  message: 'Login successful',
  data: {
    user: {
      id: user.id,
      email: user.email,
      username: user.username,
      firstName: user.firstName,
      lastName: user.lastName,
      country: user.country,
      preferredCurrency: user.preferredCurrency,
      role: user.role,
      verificationStatus: user.verificationStatus,
    },
    token,
  },
});
    } catch (error) {
      console.error('Login error:', error);
      res.status(500).json({
        success: false,
        message: 'Login failed',
      });
    }
  }
);

// Get current user
router.get('/me', authenticate, async (req: AuthRequest, res) => {
  try {
    const user = await db.query.users.findFirst({
      where: eq(users.id, req.user!.id),
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    res.json({
      success: true,
      data: {
        id: user.id,
        email: user.email,
        username: user.username,
        firstName: user.firstName,
        lastName: user.lastName,
        country: user.country,
        preferredCurrency: user.preferredCurrency,
        verificationStatus: user.verificationStatus,
        emailVerified: user.emailVerified,
        twoFactorEnabled: user.twoFactorEnabled,
        createdAt: user.createdAt,
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

// Logout
router.post('/logout', authenticate, async (req: AuthRequest, res) => {
  try {
    // Invalidate current session
    await db.update(sessions)
      .set({ current: false })
      .where(eq(sessions.userId, req.user!.id));

    res.json({
      success: true,
      message: 'Logout successful',
    });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({
      success: false,
      message: 'Logout failed',
    });
  }
});

export default router;
