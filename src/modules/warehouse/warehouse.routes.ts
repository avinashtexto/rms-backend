import { Router } from 'express';
import { WarehouseController } from './warehouse.controller';
import { requireAuth } from '../../middleware/auth.middleware';
import { requirePermission } from '../../middleware/rbac.middleware';

const router = Router();

router.use(requireAuth as any);

router.get('/', requirePermission('warehouse:view') as any, WarehouseController.listWarehouses as any);
router.post('/', requirePermission('warehouse:manage') as any, WarehouseController.createWarehouse as any);
router.put('/:warehouseId', requirePermission('warehouse:manage') as any, WarehouseController.updateWarehouse as any);
router.delete('/:warehouseId', requirePermission('warehouse:manage') as any, WarehouseController.deleteWarehouse as any);

export default router;
