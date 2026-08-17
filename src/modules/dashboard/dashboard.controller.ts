import { Response, NextFunction } from 'express';
import { DashboardService } from './dashboard.service';
import { getDashboardMetricsQuerySchema } from './dashboard.validation';
import { AuthenticatedRequest } from '../auth/auth.types';

export class DashboardController {
  static async getDashboardMetrics(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const companyId = req.user!.companyId;
      const query = getDashboardMetricsQuerySchema.parse(req.query);
      const warehouseId = req.user?.warehouseId || (req.query.warehouseId as string | undefined);
      console.log(`[Dashboard] Fetching metrics for companyId: ${companyId}, warehouseId: ${warehouseId}`);
      const metrics = await DashboardService.getDashboardMetrics(companyId, warehouseId);
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
      const warehouseId = req.user?.warehouseId || (req.query.warehouseId as string | undefined);
      console.log(`[Dashboard] Fetching scan activity for companyId: ${companyId}, days: ${query.days}, warehouseId: ${warehouseId}`);
      const activity = await DashboardService.getScanActivity(companyId, query.days, warehouseId);
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
      const warehouseId = req.user?.warehouseId || (req.query.warehouseId as string | undefined);
      console.log(`[Dashboard] Fetching recent activity for companyId: ${companyId}, limit: ${query.limit}, warehouseId: ${warehouseId}`);
      const activity = await DashboardService.getRecentActivity(companyId, query.limit, warehouseId);
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
      const warehouseId = req.user?.warehouseId || (req.query.warehouseId as string | undefined);
      console.log(`[Dashboard] Fetching complete dashboard data for companyId: ${companyId}, warehouseId: ${warehouseId}`);
      const [metrics, scanActivity, recentActivity] = await Promise.all([
        DashboardService.getDashboardMetrics(companyId, warehouseId),
        DashboardService.getScanActivity(companyId, query.days, warehouseId),
        DashboardService.getRecentActivity(companyId, query.limit, warehouseId)
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

  static async getSuperAdminSummary(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      if (req.user!.roleName !== 'SUPER_ADMIN') {
        return res.status(403).json({
          success: false,
          error: { code: 'FORBIDDEN', message: 'Super Admin access required' }
        });
      }
      const summary = await DashboardService.getSuperAdminSummary();
      res.status(200).json({ success: true, data: summary });
    } catch (error) {
      next(error);
    }
  }
}
