import { Router } from 'express';
import { InventoryVerifyController } from './inventory-verify.controller';
import { requireAuth } from '../../middleware/auth.middleware';
import { requirePermission } from '../../middleware/rbac.middleware';

const router = Router();

router.use(requireAuth as any);

router.post('/sessions', requirePermission('workflow:execute') as any, InventoryVerifyController.startSession as any);
router.post('/sessions/:sessionId/scans', requirePermission('workflow:execute') as any, InventoryVerifyController.submitScan as any);
router.put('/sessions/:sessionId/end', requirePermission('workflow:execute') as any, InventoryVerifyController.endSession as any);
router.get('/sessions/:sessionId', requirePermission('workflow:execute') as any, InventoryVerifyController.getSessionDetails as any);
router.get('/sessions', requirePermission('workflow:execute') as any, InventoryVerifyController.listSessions as any);

export default router;
