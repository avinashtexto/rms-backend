import { Response, NextFunction } from 'express';
import { DashboardService } from './dashboard.service';
import { getDashboardMetricsQuerySchema } from './dashboard.validation';
import { AuthenticatedRequest } from '../auth/auth.types';

export class DashboardController {
  static async getDashboardMetrics(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const companyId = req.user!.companyId;
      const query = getDashboardMetricsQuerySchema.parse(req.query);
      console.log(`[Dashboard] Fetching metrics for companyId: ${companyId}`);
      const metrics = await DashboardService.getDashboardMetrics(companyId);
      console.log(`[Dashboard] Metrics fetched:`, metrics);
      res.status(200).json({ success: true, data: metrics });
    } catch (error) {
      next(error);
    }
  }

  static async getScanActivity(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const companyId = req.user!.companyId;
      const query = getDashboardMetricsQuerySchema.parse(req.query);
      console.log(`[Dashboard] Fetching scan activity for companyId: ${companyId}, days: ${query.days}`);
      const activity = await DashboardService.getScanActivity(companyId, query.days);
      console.log(`[Dashboard] Scan activity fetched:`, activity);
      res.status(200).json({ success: true, data: activity });
    } catch (error) {
      next(error);
    }
  }

  static async getRecentActivity(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const companyId = req.user!.companyId;
      const query = getDashboardMetricsQuerySchema.parse(req.query);
      console.log(`[Dashboard] Fetching recent activity for companyId: ${companyId}, limit: ${query.limit}`);
      const activity = await DashboardService.getRecentActivity(companyId, query.limit);
      console.log(`[Dashboard] Recent activity fetched:`, activity);
      res.status(200).json({ success: true, data: activity });
    } catch (error) {
      next(error);
    }
  }

  static async getDashboardData(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const companyId = req.user!.companyId;
      const query = getDashboardMetricsQuerySchema.parse(req.query);
      console.log(`[Dashboard] Fetching complete dashboard data for companyId: ${companyId}`);
      const [metrics, scanActivity, recentActivity] = await Promise.all([
        DashboardService.getDashboardMetrics(companyId),
        DashboardService.getScanActivity(companyId, query.days),
        DashboardService.getRecentActivity(companyId, query.limit)
      ]);
      console.log(`[Dashboard] Complete dashboard data fetched`);
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
}
