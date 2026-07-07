import { Router } from 'express';
import { SyncController } from './sync.controller';
import { requireAuth } from '../../middleware/auth.middleware';
import { requirePermission } from '../../middleware/rbac.middleware';

const router = Router();

router.use(requireAuth as any);

router.post('/batch', requirePermission('scan:workflow') as any, SyncController.syncBatch as any);
router.get('/status/:deviceId', requirePermission('scan:workflow') as any, SyncController.getSyncStatus as any);
router.get('/conflicts', requirePermission('box:manage') as any, SyncController.listConflicts as any);
router.put('/conflicts/:conflictId/resolve', requirePermission('box:manage') as any, SyncController.resolveConflict as any);

export default router;
