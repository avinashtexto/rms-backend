import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../modules/auth/auth.types';
import { ErrorCode } from '../lib/error-codes';
import { prisma } from '../lib/prisma';

export const requirePermission = (permissionKey: string) => {
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: {
            code: ErrorCode.UNAUTHORIZED,
            message: 'Authentication required'
          }
        });
      }

      // SUPER_ADMIN has access to all actions
      if (req.user.roleName === 'SUPER_ADMIN') {
        return next();
      }

      // Check if user's role has the requested permission
      const hasPermission = await prisma.rolePermission.findFirst({
        where: {
          roleId: req.user.roleId,
          permission: {
            key: permissionKey
          }
        }
      });

      if (!hasPermission) {
        return res.status(403).json({
          success: false,
          error: {
            code: ErrorCode.FORBIDDEN,
            message: `Forbidden: requires permission '${permissionKey}'`
          }
        });
      }

      next();
    } catch (error) {
      next(error);
    }
  };
};
