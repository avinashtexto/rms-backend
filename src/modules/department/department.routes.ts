import { Router } from 'express';
import { DepartmentController } from './department.controller';
import { requireAuth } from '../../middleware/auth.middleware';
import { requirePermission } from '../../middleware/rbac.middleware';
import { blockForWarehouseManager } from '../../middleware/warehouse-scope.middleware';

const router = Router();

router.use(requireAuth as any);

router.get('/', requirePermission('department:view') as any, DepartmentController.listDepartments as any);
router.get('/:id', requirePermission('department:view') as any, DepartmentController.getDepartment as any);
router.post('/', blockForWarehouseManager as any, requirePermission('department:manage') as any, DepartmentController.createDepartment as any);
router.put('/:id', blockForWarehouseManager as any, requirePermission('department:manage') as any, DepartmentController.updateDepartment as any);
router.delete('/:id', blockForWarehouseManager as any, requirePermission('department:manage') as any, DepartmentController.deleteDepartment as any);

export default router;
