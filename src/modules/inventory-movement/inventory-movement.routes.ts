import { Router } from 'express';
import { InventoryMovementController } from './inventory-movement.controller';
import { requireAuth } from '../../middleware/auth.middleware';
import { enforceWarehouseScope } from '../../middleware/warehouse-scope.middleware';

const router = Router();
router.use(requireAuth as any);
router.use(enforceWarehouseScope as any);

router.get('/history', InventoryMovementController.listHistory as any);
router.post('/record', InventoryMovementController.recordMovement as any);

export default router;
