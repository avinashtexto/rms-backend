import { Response, NextFunction } from 'express';
import { AuthService } from './auth.service';
import { loginSchema, refreshSchema, deviceBindSchema } from './auth.validation';
import { AuthenticatedRequest } from './auth.types';

export class AuthController {
  static async login(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const data = loginSchema.parse(req.body);
      const result = await AuthService.login(data.email, data.password);
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
