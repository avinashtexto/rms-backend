import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.middleware';
import { requirePermission } from '../../middleware/rbac.middleware';
import { blockForWarehouseManager } from '../../middleware/warehouse-scope.middleware';
import { UsersController } from './users.controller';

const router = Router();

router.use(requireAuth as any);

router.patch('/me', UsersController.updateMe as any);

router.get('/', UsersController.list as any);
router.get('/:id', UsersController.get as any);

router.post('/', blockForWarehouseManager as any, requirePermission('user:manage') as any, UsersController.create as any);
router.patch('/:id', blockForWarehouseManager as any, requirePermission('user:manage') as any, UsersController.update as any);
router.post(
  '/:id/reset-password',
  blockForWarehouseManager as any,
  requirePermission('user:manage') as any,
  UsersController.resetPassword as any
);
router.put(
  '/:id/assignments',
  blockForWarehouseManager as any,
  requirePermission('user:manage') as any,
  UsersController.updateAssignments as any
);

export default router;
