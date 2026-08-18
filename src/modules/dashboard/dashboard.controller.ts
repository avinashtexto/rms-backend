import { Response, NextFunction } from 'express';
import { DashboardService } from './dashboard.service';
import { getDashboardMetricsQuerySchema } from './dashboard.validation';
import { AuthenticatedRequest } from '../auth/auth.types';

export class DashboardController {
  static async getDashboardMetrics(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const query = getDashboardMetricsQuerySchema.parse(req.query);
      const scope = await DashboardService.resolveScopeAndValidate(req.user!, query);
      const metrics = await DashboardService.getDashboardMetrics(scope);
      res.status(200).json({ success: true, data: metrics });
    } catch (error) {
      next(error);
    }
  }

  static async getScanActivity(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const query = getDashboardMetricsQuerySchema.parse(req.query);
      const scope = await DashboardService.resolveScopeAndValidate(req.user!, query);
      const activity = await DashboardService.getScanActivity(scope);
      res.status(200).json({ success: true, data: activity });
    } catch (error) {
      next(error);
    }
  }

  static async getRecentActivity(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const query = getDashboardMetricsQuerySchema.parse(req.query);
      const scope = await DashboardService.resolveScopeAndValidate(req.user!, query);
      const activity = await DashboardService.getRecentActivity(scope, query.limit);
      res.status(200).json({ success: true, data: activity });
    } catch (error) {
      next(error);
    }
  }

  static async getDashboardData(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const query = getDashboardMetricsQuerySchema.parse(req.query);
      const scope = await DashboardService.resolveScopeAndValidate(req.user!, query);
      const [metrics, scanActivity, recentActivity] = await Promise.all([
        DashboardService.getDashboardMetrics(scope),
        DashboardService.getScanActivity(scope),
        DashboardService.getRecentActivity(scope, query.limit)
      ]);
      res.status(200).json({
        success: true,
        data: {
          metrics,
          scanActivity,
          recentActivity
        }
      });
    } catch (error) {
      next(error);
    }
  }

  static async getSuperAdminSummary(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const roleName = req.user?.roleName;
      if (roleName !== 'SUPER_ADMIN') {
        return res.status(403).json({
          success: false,
          error: { code: 'FORBIDDEN', message: 'Super Admin access required' }
        });
      }
      const query = getDashboardMetricsQuerySchema.parse(req.query);
      const scope = await DashboardService.resolveScopeAndValidate(req.user!, query);
      const summary = await DashboardService.getSuperAdminSummary(scope);
      res.status(200).json({ success: true, data: summary });
    } catch (error) {
      next(error);
    }
  }
}
