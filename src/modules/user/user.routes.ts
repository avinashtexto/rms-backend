import { Router } from 'express';
import { UserController } from './user.controller';
import { requireAuth } from '../../middleware/auth.middleware';
import { requirePermission } from '../../middleware/rbac.middleware';
import { blockForWarehouseManager } from '../../middleware/warehouse-scope.middleware';

const router = Router();

router.use(requireAuth as any);
router.use(blockForWarehouseManager as any);

router.get('/', requirePermission('user:view') as any, UserController.listUsers as any);
router.get('/:id', requirePermission('user:view') as any, UserController.getUserById as any);
router.post('/', requirePermission('user:manage') as any, UserController.createUser as any);
router.put('/:id', requirePermission('user:manage') as any, UserController.updateUser as any);
router.patch('/:id/deactivate', requirePermission('user:manage') as any, UserController.deactivateUser as any);
router.delete('/:id', requirePermission('user:manage') as any, UserController.deleteUser as any);
router.post('/:id/reset-password', requirePermission('user:manage') as any, UserController.resetPassword as any);

export default router;
