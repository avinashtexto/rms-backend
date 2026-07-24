import { Router } from 'express';
import { RefileController } from './refile.controller';
import { requireAuth } from '../../middleware/auth.middleware';
import { requirePermission } from '../../middleware/rbac.middleware';

const router = Router();

router.use(requireAuth as any);

router.post('/scans', requirePermission('workflow:execute') as any, RefileController.submitScan as any);
router.get('/scans', requirePermission('workflow:execute') as any, RefileController.listRefileScans as any);

export default router;
