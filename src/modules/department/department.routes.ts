import { Router } from 'express';
import { DepartmentController } from './department.controller';
import { requireAuth } from '../../middleware/auth.middleware';
import { requirePermission } from '../../middleware/rbac.middleware';

const router = Router();

router.use(requireAuth as any);

router.get('/', requirePermission('department:view') as any, DepartmentController.listDepartments as any);
router.get('/:id', requirePermission('department:view') as any, DepartmentController.getDepartment as any);
router.post('/', requirePermission('department:manage') as any, DepartmentController.createDepartment as any);
router.put('/:id', requirePermission('department:manage') as any, DepartmentController.updateDepartment as any);
router.delete('/:id', requirePermission('department:manage') as any, DepartmentController.deleteDepartment as any);

export default router;
