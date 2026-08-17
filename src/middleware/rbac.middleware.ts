import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../modules/auth/auth.types';
import { ErrorCode } from '../lib/error-codes';
import { prisma } from '../lib/prisma';

/** Route-level keys mapped to canonical seeded permission keys. */
const PERMISSION_ALIASES: Record<string, string[]> = {
  'room:view': ['storage:view', 'warehouse:view'],
  'room:manage': ['storage:manage', 'warehouse:manage'],
  'rack:view': ['storage:view', 'warehouse:view'],
  'rack:manage': ['storage:manage', 'warehouse:manage'],
  'shelf:view': ['storage:view', 'warehouse:view'],
  'shelf:manage': ['storage:manage', 'warehouse:manage'],
  'location:view': ['storage:view', 'warehouse:view'],
  'location:manage': ['storage:manage', 'warehouse:manage'],
  'rack-template:view': ['storage:view', 'settings:view', 'warehouse:view'],
  'rack-template:create': ['storage:manage', 'settings:view', 'warehouse:manage'],
  'rack-template:update': ['storage:manage', 'settings:view', 'warehouse:manage'],
  'rack-template:delete': ['storage:manage', 'settings:view', 'warehouse:manage'],
  'rack-template:clone': ['storage:manage', 'settings:view', 'warehouse:manage'],
  'rack-template:apply': ['storage:manage', 'storage:view', 'settings:view', 'warehouse:manage'],
  'rack-template:preview': ['storage:view', 'settings:view', 'warehouse:view'],
  'report:generate': ['report:view'],
};

function acceptedPermissionKeys(permissionKey: string | string[]): string[] {
  const keys = Array.isArray(permissionKey) ? permissionKey : [permissionKey];
  return Array.from(new Set(keys.flatMap((k) => [k, ...(PERMISSION_ALIASES[k] ?? [])])));
}

export const requirePermission = (permissionKey: string | string[]) => {
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
