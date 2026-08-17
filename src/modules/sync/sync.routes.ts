import { Router } from 'express';
import { SyncController } from './sync.controller';
import { requireAuth } from '../../middleware/auth.middleware';
import { requirePermission } from '../../middleware/rbac.middleware';
import { enforceWarehouseScope } from '../../middleware/warehouse-scope.middleware';

const router = Router();

router.use(requireAuth as any);
router.use(enforceWarehouseScope as any);

router.post(
  '/operations',
  requirePermission('workflow:execute') as any,
  SyncController.syncOperations as any
);
router.post('/batch', requirePermission('workflow:execute') as any, SyncController.syncBatch as any);
router.get('/status/:deviceId', requirePermission('workflow:execute') as any, SyncController.getSyncStatus as any);
router.get('/devices', requirePermission('box:view') as any, SyncController.listDeviceSyncStatus as any);
router.get('/conflicts', requirePermission('box:manage') as any, SyncController.listConflicts as any);
router.put('/conflicts/:conflictId/resolve', requirePermission('box:manage') as any, SyncController.resolveConflict as any);

export default router;
