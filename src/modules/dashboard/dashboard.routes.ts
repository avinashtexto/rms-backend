import { Router } from 'express';
import { DashboardController } from './dashboard.controller';
import { requireAuth } from '../../middleware/auth.middleware';
import { requirePermission } from '../../middleware/rbac.middleware';

const router = Router();

router.use(requireAuth as any);

router.get('/metrics', requirePermission('dashboard:view') as any, DashboardController.getDashboardMetrics as any);
router.get('/scan-activity', requirePermission('dashboard:view') as any, DashboardController.getScanActivity as any);
router.get('/recent-activity', requirePermission('dashboard:view') as any, DashboardController.getRecentActivity as any);
router.get('/', requirePermission('dashboard:view') as any, DashboardController.getDashboardData as any);

export default router;
