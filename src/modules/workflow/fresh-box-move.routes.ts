import { Router } from 'express';
import { FreshBoxMoveController } from './fresh-box-move.controller';
import { requireAuth } from '../../middleware/auth.middleware';
import { requirePermission } from '../../middleware/rbac.middleware';

const router = Router();

router.use(requireAuth as any);

router.post('/sessions', requirePermission('workflow:execute') as any, FreshBoxMoveController.startSession as any);
router.post('/sessions/:sessionId/scans', requirePermission('workflow:execute') as any, FreshBoxMoveController.submitScan as any);
router.put('/sessions/:sessionId/end', requirePermission('workflow:execute') as any, FreshBoxMoveController.endSession as any);
router.get('/sessions/:sessionId', requirePermission('workflow:execute') as any, FreshBoxMoveController.getSessionDetails as any);
router.get('/sessions', requirePermission('workflow:execute') as any, FreshBoxMoveController.listSessions as any);

// Direct workflow endpoint for mobile API contract
router.post('/', requirePermission('workflow:execute') as any, FreshBoxMoveController.submitWorkflow as any);

export default router;
