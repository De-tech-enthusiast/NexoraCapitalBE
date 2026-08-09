import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { db } from '../config/database';
import { users } from '../config/schema';
import { eq } from 'drizzle-orm';

export interface AuthRequest extends Request {
  user?: {
    id: number;
    email: string;
    role: string;
    firstName: string;
    lastName: string;
  };
}

export const authenticate = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Access denied. No token provided.',
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as any;

    // Get user from database
    const user = await db.query.users.findFirst({
      where: eq(users.id, decoded.userId),
    });

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'User not found.',
      });
    }
    console.log("AUTH USER:", {
  id: user.id,
  email: user.email,
  role: user.role,
});

    req.user = {
      id: user.id,
      email: user.email,
      role: user.role,
      firstName: user.firstName,
      lastName: user.lastName,
    };

    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: 'Invalid token.',
    });
  }
};

export const requireAdmin = (req: AuthRequest, res: Response, next: NextFunction) => {
  if (req.user?.role !== 'admin') {
    return res.status(403).json({
      success: false,
      message: 'Access denied. Admin privileges required.',
    });
  }
  next();
};
