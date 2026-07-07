import { Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { AuthenticatedRequest } from '../modules/auth/auth.types';
import { ErrorCode } from '../lib/error-codes';
import { prisma } from '../lib/prisma';

const JWT_SECRET = process.env.JWT_SECRET || 'rms_super_secret_jwt_key_123';

export const requireAuth = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        error: {
          code: ErrorCode.UNAUTHORIZED,
          message: 'Access token required'
        }
      });
    }

    const token = authHeader.split(' ')[1];
    let decoded: any;
    
    try {
      decoded = jwt.verify(token, JWT_SECRET);
    } catch (err: any) {
      if (err.name === 'TokenExpiredError') {
        return res.status(401).json({
          success: false,
          error: {
            code: ErrorCode.TOKEN_EXPIRED,
            message: 'Access token has expired'
          }
        });
      }
      return res.status(401).json({
        success: false,
        error: {
          code: ErrorCode.INVALID_TOKEN,
          message: 'Invalid access token'
        }
      });
    }

    // Verify user exists and is active
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      include: { role: true }
    });

    if (!user || user.status !== 'ACTIVE') {
      return res.status(401).json({
        success: false,
        error: {
          code: ErrorCode.UNAUTHORIZED,
          message: 'User is suspended or deactivated'
        }
      });
    }

    req.user = {
      id: user.id,
      companyId: user.companyId,
      roleId: user.roleId,
      roleName: user.role.name
    };

    next();
  } catch (error) {
    next(error);
  }
};
