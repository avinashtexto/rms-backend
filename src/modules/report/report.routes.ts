import { Router } from 'express';
import { ReportController } from './report.controller';
import { requireAuth } from '../../middleware/auth.middleware';
import { requirePermission } from '../../middleware/rbac.middleware';

const router = Router();

router.use(requireAuth as any);

router.post('/generate', requirePermission('report:generate') as any, ReportController.generateReport as any);
router.get('/jobs/:jobId', requirePermission('report:view') as any, ReportController.getJobStatus as any);
router.get('/jobs/:jobId/download', requirePermission('report:view') as any, ReportController.downloadReport as any);
router.put('/jobs/:jobId', requirePermission('report:generate') as any, ReportController.updateReport as any);
router.delete('/jobs/:jobId', requirePermission('report:generate') as any, ReportController.deleteReport as any);
router.get('/', requirePermission('report:view') as any, ReportController.listReports as any);

export default router;
