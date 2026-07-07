import { Router } from 'express';
import { CustodyMoveController } from './custody-move.controller';
import { requireAuth } from '../../middleware/auth.middleware';
import { requirePermission } from '../../middleware/rbac.middleware';

const router = Router();

router.use(requireAuth as any);

router.post('/segregate', requirePermission('box:manage') as any, CustodyMoveController.segregateBox as any);
router.post('/merge', requirePermission('box:manage') as any, CustodyMoveController.mergeBoxes as any);
router.post('/transfers', requirePermission('box:manage') as any, CustodyMoveController.initiateTransfer as any);
router.put('/transfers/:transferId/accept', requirePermission('box:manage') as any, CustodyMoveController.acceptTransfer as any);

export default router;
