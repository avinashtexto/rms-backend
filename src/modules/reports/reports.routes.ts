import { Router } from 'express';
import { ReportsController } from './reports.controller';
import { requireAuth } from '../../middleware/auth.middleware';
import { requirePermission } from '../../middleware/rbac.middleware';

const router = Router();

router.use(requireAuth as any);

router.get('/summary', requirePermission('report:view') as any, ReportsController.summary as any);
router.get(
  '/operations-by-day',
  requirePermission('report:view') as any,
  ReportsController.operationsByDay as any
);
router.get(
  '/productivity',
  requirePermission('report:view') as any,
  ReportsController.productivity as any
);
router.get('/occupancy', requirePermission('report:view') as any, ReportsController.occupancy as any);
router.get(
  '/missing-files',
  requirePermission('report:view') as any,
  ReportsController.missingFiles as any
);
router.get(
  '/client-holdings',
  requirePermission('report:view') as any,
  ReportsController.clientHoldings as any
);
router.post('/export', requirePermission('report:view') as any, ReportsController.export as any);
router.get(
  '/export/:jobId',
  requirePermission('report:view') as any,
  ReportsController.exportStatus as any
);
router.get(
  '/export/:jobId/download',
  requirePermission('report:view') as any,
  ReportsController.downloadExport as any
);

export default router;
