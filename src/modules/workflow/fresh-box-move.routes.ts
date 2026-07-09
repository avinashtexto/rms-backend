import { Router } from 'express';
import { FreshBoxMoveController } from './fresh-box-move.controller';
import { requireAuth } from '../../middleware/auth.middleware';
import { requirePermission } from '../../middleware/rbac.middleware';

const router = Router();

router.use(requireAuth as any);

router.post('/sessions', requirePermission('scan:workflow') as any, FreshBoxMoveController.startSession as any);
router.post('/sessions/:sessionId/scans', requirePermission('scan:workflow') as any, FreshBoxMoveController.submitScan as any);
router.put('/sessions/:sessionId/end', requirePermission('scan:workflow') as any, FreshBoxMoveController.endSession as any);
router.get('/sessions/:sessionId', requirePermission('scan:workflow') as any, FreshBoxMoveController.getSessionDetails as any);
router.get('/sessions', requirePermission('scan:workflow') as any, FreshBoxMoveController.listSessions as any);

export default router;
