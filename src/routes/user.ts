import express, { Response } from 'express';
import { body, validationResult } from 'express-validator';
import bcrypt from 'bcryptjs';
import { db } from '../config/database';
import { users, activities, loginHistory, sessions } from '../config/schema';
import { eq } from 'drizzle-orm';
import { authenticate, AuthRequest } from '../middleware/auth';

const router = express.Router();

// Update profile
router.put(
  '/profile',
  authenticate,
  [
    body('firstName').optional().notEmpty(),
    body('lastName').optional().notEmpty(),
    body('country').optional().notEmpty(),
    body('preferredCurrency').optional().notEmpty(),
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

      const { firstName, lastName, country, preferredCurrency } = req.body;

      const updateData: any = {};
      if (firstName) updateData.firstName = firstName;
      if (lastName) updateData.lastName = lastName;
      if (country) updateData.country = country;
      if (preferredCurrency) updateData.preferredCurrency = preferredCurrency;
      updateData.updatedAt = new Date();

      const [updatedUser] = await db.update(users)
        .set(updateData)
        .where(eq(users.id, req.user!.id))
        .returning();

      // Create activity
      await db.insert(activities).values({
        userId: req.user!.id,
        type: 'profile_updated',
        title: 'Profile Updated',
        description: 'Your profile information has been updated',
        status: 'success',
      });

      res.json({
        success: true,
        message: 'Profile updated successfully',
        data: {
          id: updatedUser.id,
          email: updatedUser.email,
          username: updatedUser.username,
          firstName: updatedUser.firstName,
          lastName: updatedUser.lastName,
          country: updatedUser.country,
          preferredCurrency: updatedUser.preferredCurrency,
        },
      });
    } catch (error) {
      console.error('Update profile error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update profile',
      });
    }
  }
);

// Change password
router.put(
  '/password',
  authenticate,
  [
    body('currentPassword').notEmpty(),
    body('newPassword').isLength({ min: 8 }),
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

      const { currentPassword, newPassword } = req.body;

      // Get user
      const user = await db.query.users.findFirst({
        where: eq(users.id, req.user!.id),
      });

      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found',
        });
      }

      // Verify current password
      const isValidPassword = await bcrypt.compare(currentPassword, user.passwordHash);

      if (!isValidPassword) {
        return res.status(401).json({
          success: false,
          message: 'Current password is incorrect',
        });
      }

      // Hash new password
      const salt = await bcrypt.genSalt(10);
      const newPasswordHash = await bcrypt.hash(newPassword, salt);

      // Update password
      await db.update(users)
        .set({
          passwordHash: newPasswordHash,
          updatedAt: new Date(),
        })
        .where(eq(users.id, req.user!.id));

      // Create activity
      await db.insert(activities).values({
        userId: req.user!.id,
        type: 'security_updated',
        title: 'Password Changed',
        description: 'Your password has been changed successfully',
        status: 'success',
      });

      res.json({
        success: true,
        message: 'Password changed successfully',
      });
    } catch (error) {
      console.error('Change password error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to change password',
      });
    }
  }
);

// Get login history
router.get('/login-history', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const history = await db.query.loginHistory.findMany({
      where: eq(loginHistory.userId, req.user!.id),
      orderBy: (loginHistory, { desc }) => [desc(loginHistory.createdAt)],
      limit: 20,
    });

    res.json({
      success: true,
      data: history,
    });
  } catch (error) {
    console.error('Get login history error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get login history',
    });
  }
});

// Get active sessions
router.get('/sessions', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const userSessions = await db.query.sessions.findMany({
      where: eq(sessions.userId, req.user!.id),
      orderBy: (sessions, { desc }) => [desc(sessions.lastActiveAt)],
    });

    res.json({
      success: true,
      data: userSessions,
    });
  } catch (error) {
    console.error('Get sessions error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get sessions',
    });
  }
});

export default router;
