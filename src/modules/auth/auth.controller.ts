import { Response, NextFunction } from 'express';
import { AuthService } from './auth.service';
import {
  loginSchema,
  refreshSchema,
  deviceBindSchema,
  switchWarehouseSchema,
  switchBranchSchema,
  switchCompanySchema
} from './auth.validation';
import { AuthenticatedRequest } from './auth.types';
import { ADMIN_PANEL_ROLES } from './auth.constants';

export class AuthController {
  static async login(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const data = loginSchema.parse(req.body);
      const email = data.email || data.username;
      if (!email) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Email or username is required'
          }
        });
      }

      const isMobile = req.originalUrl.includes('/mobile/');
      if (isMobile) {
        if (!data.device) {
          return res.status(400).json({
            success: false,
            error: {
              code: 'VALIDATION_ERROR',
              message: 'Device information is required for mobile login'
            }
          });
        }
      }

      const result = await AuthService.login(email, data.password, data.device);
      
      if (isMobile && (result.user.role === 'SUPER_ADMIN' || result.user.role === 'COMPANY_ADMIN')) {
        return res.status(403).json({
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: 'Administrators must log in via the web admin panel.'
          }
        });
      }

      const isAdmin = req.originalUrl.includes('/admin/');
      if (isAdmin && !ADMIN_PANEL_ROLES.includes(result.user.role as (typeof ADMIN_PANEL_ROLES)[number])) {
        return res.status(403).json({
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: 'Admin panel access is not allowed for this role.'
          }
        });
      }

      res.status(200).json({
        success: true,
        data: result
      });
    } catch (error) {
      next(error);
    }
  }

  static async refresh(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const data = refreshSchema.parse(req.body);
      const result = await AuthService.refresh(data.refreshToken);
      res.status(200).json({
        success: true,
        data: result
      });
    } catch (error) {
      next(error);
    }
  }

  static async logout(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const data = refreshSchema.parse(req.body);
      await AuthService.logout(data.refreshToken, req.user?.id);
      res.status(200).json({
        success: true,
        data: { message: 'Logged out successfully' }
      });
    } catch (error) {
      next(error);
    }
  }

  static async me(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: 'Not logged in'
          }
        });
      }

      const session = {
        companyId: req.user.companyId,
        branchId: req.user.branchId ?? null,
        warehouseId: req.user.warehouseId ?? null
      };

      const result = await AuthService.me(req.user.id, session);
      res.status(200).json({
        success: true,
        data: result
      });
    } catch (error) {
      next(error);
    }
  }

  static async permissions(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: 'Not logged in'
          }
        });
      }
      const result = await AuthService.getPermissions(req.user.id, req.user.roleId);
      res.status(200).json({
        success: true,
        data: result
      });
    } catch (error) {
      next(error);
    }
  }

  static async switchWarehouse(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'Not logged in' }
        });
      }
      const data = switchWarehouseSchema.parse(req.body);
      const result = await AuthService.switchWarehouse(req.user.id, data.warehouseId, {
        companyId: req.user.companyId,
        branchId: req.user.branchId ?? null,
        warehouseId: req.user.warehouseId ?? null
      });
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  static async switchBranch(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'Not logged in' }
        });
      }
      const data = switchBranchSchema.parse(req.body);
      const result = await AuthService.switchBranch(req.user.id, data.branchId, {
        companyId: req.user.companyId,
        branchId: req.user.branchId ?? null,
        warehouseId: req.user.warehouseId ?? null
      });
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  static async switchCompany(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'Not logged in' }
        });
      }
      const data = switchCompanySchema.parse(req.body);
      const result = await AuthService.switchCompany(req.user.id, data.companyId, {
        companyId: req.user.companyId,
        branchId: req.user.branchId ?? null,
        warehouseId: req.user.warehouseId ?? null
      });
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  static async deviceBind(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: 'Not logged in'
          }
        });
      }
      const data = deviceBindSchema.parse(req.body);
      const result = await AuthService.deviceBind(
        req.user.id,
        req.user.companyId,
        data.serialNumber,
        data.model
      );
      res.status(200).json({
        success: true,
        data: result
      });
    } catch (error) {
      next(error);
    }
  }
}
