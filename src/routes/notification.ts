import express from 'express';
import { db } from '../config/database';
import { notifications, activities } from '../config/schema';
import { eq, desc, and } from 'drizzle-orm';
import { authenticate, AuthRequest } from '../middleware/auth';

const router = express.Router();

// Get notifications
router.get('/', authenticate, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.id;
    const { unread, limit = '20' } = req.query;

    let conditions = eq(notifications.userId, userId);

    if (unread === 'true') {
      conditions = and(conditions, eq(notifications.read, false)) as any;
    }

    const userNotifications = await db.query.notifications.findMany({
      where: conditions,
      orderBy: [desc(notifications.createdAt)],
      limit: parseInt(limit as string),
    });

    // Get unread count
    const unreadNotifications = await db.query.notifications.findMany({
      where: and(
        eq(notifications.userId, userId),
        eq(notifications.read, false)
      ),
    });

    res.json({
      success: true,
      data: {
        notifications: userNotifications,
        unreadCount: unreadNotifications.length,
      },
    });
  } catch (error) {
    console.error('Get notifications error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get notifications',
    });
  }
});

// Mark notification as read
router.put('/:id/read', authenticate, async (req: AuthRequest, res) => {
  try {
    const notificationId = parseInt(req.params.id);
    const userId = req.user!.id;

    const notification = await db.query.notifications.findFirst({
      where: eq(notifications.id, notificationId),
    });

    if (!notification || notification.userId !== userId) {
      return res.status(404).json({
        success: false,
        message: 'Notification not found',
      });
    }

    await db.update(notifications)
      .set({ read: true })
      .where(eq(notifications.id, notificationId));

    res.json({
      success: true,
      message: 'Notification marked as read',
    });
  } catch (error) {
    console.error('Mark notification read error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to mark notification as read',
    });
  }
});

// Mark all notifications as read
router.put('/read-all', authenticate, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.id;

    await db.update(notifications)
      .set({ read: true })
      .where(eq(notifications.userId, userId));

    res.json({
      success: true,
      message: 'All notifications marked as read',
    });
  } catch (error) {
    console.error('Mark all notifications read error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to mark notifications as read',
    });
  }
});

// Get activities
router.get('/activities', authenticate, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.id;
    const { limit = '20' } = req.query;

    const userActivities = await db.query.activities.findMany({
      where: eq(activities.userId, userId),
      orderBy: [desc(activities.createdAt)],
      limit: parseInt(limit as string),
    });

    res.json({
      success: true,
      data: userActivities,
    });
  } catch (error) {
    console.error('Get activities error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get activities',
    });
  }
});

export default router;
