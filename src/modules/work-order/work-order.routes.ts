import { Router } from 'express';
import { WorkOrderController } from './work-order.controller';
import { requireAuth } from '../../middleware/auth.middleware';
import { enforceWarehouseScope } from '../../middleware/warehouse-scope.middleware';

const router = Router();
router.use(requireAuth as any);
router.use(enforceWarehouseScope as any);

router.get('/', WorkOrderController.list as any);
router.post('/', WorkOrderController.create as any);
router.patch('/:id/status', WorkOrderController.updateStatus as any);
router.delete('/:id', WorkOrderController.delete as any);

export default router;
