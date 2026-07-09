import { Router } from 'express';
import { ReasonCodeController } from './reasonCode.controller';
import { requireAuth } from '../../middleware/auth.middleware';
import { requirePermission } from '../../middleware/rbac.middleware';

const router = Router();

router.use(requireAuth as any);

router.get('/', requirePermission('reason_code:view') as any, ReasonCodeController.listReasonCodes as any);
router.get('/:reasonCodeId', requirePermission('reason_code:view') as any, ReasonCodeController.getReasonCode as any);
router.post('/', requirePermission('reason_code:manage') as any, ReasonCodeController.createReasonCode as any);
router.put('/:reasonCodeId', requirePermission('reason_code:manage') as any, ReasonCodeController.updateReasonCode as any);
router.delete('/:reasonCodeId', requirePermission('reason_code:manage') as any, ReasonCodeController.deleteReasonCode as any);

export default router;
