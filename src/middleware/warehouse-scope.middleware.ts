import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../modules/auth/auth.types';
import { ErrorCode } from '../lib/error-codes';
import { prisma } from '../lib/prisma';
import { RoleName } from '@prisma/client';

/**
 * Middleware that strictly enforces warehouse isolation at the request level.
 * - SUPER_ADMIN: Unrestricted access.
 * - COMPANY_ADMIN: Company-wide access.
 * - WAREHOUSE_MANAGER (and operational roles):
 *   1. Resolves and validates the user's active assigned warehouse.
 *   2. Rejects request with 403 if no warehouse is assigned.
 *   3. Enforces req.user.warehouseId on queries and mutations.
 *   4. Rejects any attempt to specify a different warehouseId in query/body/params.
 */
export const enforceWarehouseScope = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
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

    const isGlobalOrCompanyAdmin =
      req.user.roleName === RoleName.SUPER_ADMIN ||
      req.user.roleName === RoleName.COMPANY_ADMIN;

    if (isGlobalOrCompanyAdmin) {
      return next();
    }

    // Resolve assigned warehouse for operational / warehouse roles
    let assignedWarehouseId = req.user.warehouseId;

    if (!assignedWarehouseId) {
      const assignment = await prisma.userWarehouseAssignment.findFirst({
        where: { userId: req.user.id, warehouse: { isActive: true } },
        include: { warehouse: true }
      });

      if (!assignment || !assignment.warehouse) {
        return res.status(403).json({
          success: false,
          error: {
            code: ErrorCode.FORBIDDEN,
            message: 'No warehouse has been assigned to your account. Please contact the administrator.'
          }
        });
      }

      assignedWarehouseId = assignment.warehouseId;
      req.user.warehouseId = assignedWarehouseId;
    }

    // Verify assigned warehouse is still active
    const warehouse = await prisma.warehouse.findFirst({
      where: {
        id: assignedWarehouseId,
        companyId: req.user.companyId,
        isActive: true
      }
    });

    if (!warehouse) {
      return res.status(403).json({
        success: false,
        error: {
          code: ErrorCode.FORBIDDEN,
          message: 'Assigned warehouse is inactive or access denied.'
        }
      });
    }

    // Check if client tried to spoof/request a different warehouseId in query/body/params
    const requestedWarehouseId =
      (req.query.warehouseId as string | undefined) ||
      (req.body?.warehouseId as string | undefined) ||
      (req.params?.warehouseId as string | undefined);

    if (requestedWarehouseId && requestedWarehouseId !== assignedWarehouseId) {
      return res.status(403).json({
        success: false,
        error: {
          code: ErrorCode.FORBIDDEN,
          message: "You don't have access to this warehouse."
        }
      });
    }

    // Lock query/body warehouseId to the verified assigned warehouse
    if (req.query) {
      req.query.warehouseId = assignedWarehouseId;
    }
    if (req.body && typeof req.body === 'object' && !Array.isArray(req.body)) {
      if ('warehouseId' in req.body) {
        req.body.warehouseId = assignedWarehouseId;
      }
    }

    next();
  } catch (error) {
    next(error);
  }
};

/**
 * Middleware that blocks Warehouse Managers from accessing Super Admin / Global masters.
 */
export const blockForWarehouseManager = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      error: {
        code: ErrorCode.UNAUTHORIZED,
        message: 'Authentication required'
      }
    });
  }

  if (
    req.user.roleName === RoleName.WAREHOUSE_MANAGER ||
    req.user.roleName === RoleName.SUPERVISOR ||
    req.user.roleName === RoleName.OPERATOR ||
    req.user.roleName === RoleName.VIEWER
  ) {
    return res.status(403).json({
      success: false,
      error: {
        code: ErrorCode.FORBIDDEN,
        message: 'Access denied. This module is restricted to system administrators.'
      }
    });
  }

  next();
};
