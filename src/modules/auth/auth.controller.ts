import { Response, NextFunction } from 'express';
import { AuthService } from './auth.service';
import { loginSchema, refreshSchema, deviceBindSchema } from './auth.validation';
import { AuthenticatedRequest } from './auth.types';

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

      // Check if this is a mobile login and enforce device validation
      const isMobile = req.originalUrl.includes('/mobile/');
      if (isMobile) {
        // For mobile roles, device information is required
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
      
      // Restrict admin login on mobile endpoints
      if (isMobile && (result.user.role === 'SUPER_ADMIN' || result.user.role === 'COMPANY_ADMIN')) {
        return res.status(403).json({
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: 'Administrators must log in via the web admin panel.'
          }
        });
      }

      // Restrict non-admin login on admin endpoints
      const isAdmin = req.originalUrl.includes('/admin/');
      if (isAdmin && (result.user.role !== 'SUPER_ADMIN' && result.user.role !== 'COMPANY_ADMIN')) {
        return res.status(403).json({
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: 'Admin roles only.'
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
      await AuthService.logout(data.refreshToken);
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
      const result = await AuthService.me(req.user.id);
      res.status(200).json({
        success: true,
        data: result
      });
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
