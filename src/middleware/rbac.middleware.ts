import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../modules/auth/auth.types';
import { ErrorCode } from '../lib/error-codes';
import { prisma } from '../lib/prisma';

/** Route-level keys mapped to canonical seeded permission keys. */
const PERMISSION_ALIASES: Record<string, string[]> = {
  'room:view': ['storage:view'],
  'room:manage': ['storage:manage'],
  'rack:view': ['storage:view'],
  'rack:manage': ['storage:manage'],
  'shelf:view': ['storage:view'],
  'shelf:manage': ['storage:manage'],
  'location:view': ['storage:view'],
  'location:manage': ['storage:manage'],
  'rack-template:view': ['storage:view', 'settings:view'],
  'rack-template:create': ['storage:manage', 'settings:view'],
  'rack-template:update': ['storage:manage', 'settings:view'],
  'rack-template:delete': ['storage:manage', 'settings:view'],
  'rack-template:clone': ['storage:manage', 'settings:view'],
  'rack-template:apply': ['storage:manage', 'settings:view'],
  'rack-template:preview': ['storage:view', 'settings:view'],
  'report:generate': ['report:view'],
};

function acceptedPermissionKeys(permissionKey: string): string[] {
  return [permissionKey, ...(PERMISSION_ALIASES[permissionKey] ?? [])];
}

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

      const permissionKeys = acceptedPermissionKeys(permissionKey);

      // Check if user's role has the requested permission (or an accepted alias)
      const hasPermission = await prisma.rolePermission.findFirst({
        where: {
          roleId: req.user.roleId,
          permission: {
            key: { in: permissionKeys }
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
