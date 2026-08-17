import { Router } from 'express';
import { WarehouseController } from './warehouse.controller';
import { requireAuth } from '../../middleware/auth.middleware';
import { requirePermission } from '../../middleware/rbac.middleware';
import { blockForWarehouseManager } from '../../middleware/warehouse-scope.middleware';

const router = Router();

router.use(requireAuth as any);

router.get('/', requirePermission('warehouse:view') as any, WarehouseController.listWarehouses as any);
router.get('/:id', requirePermission('warehouse:view') as any, WarehouseController.getWarehouseById as any);
router.post('/', blockForWarehouseManager as any, requirePermission('warehouse:manage') as any, WarehouseController.createWarehouse as any);
router.put('/:id', blockForWarehouseManager as any, requirePermission('warehouse:manage') as any, WarehouseController.updateWarehouse as any);
router.delete('/:id', blockForWarehouseManager as any, requirePermission('warehouse:manage') as any, WarehouseController.deleteWarehouse as any);

export default router;
