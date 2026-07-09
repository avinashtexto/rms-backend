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
router.get('/transfers/assigned', requirePermission('box:view') as any, CustodyMoveController.getAssignedTransfers as any);
router.put('/transfers/:id/complete', requirePermission('box:manage') as any, CustodyMoveController.completeTransfer as any);
router.get('/transfers/scan/:barcode', requirePermission('box:view') as any, CustodyMoveController.scanBox as any);
router.get('/transfers', requirePermission('box:view') as any, CustodyMoveController.listTransfers as any);

export default router;
