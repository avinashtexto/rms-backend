import { Router } from 'express';
import { UserController } from './user.controller';
import { requireAuth } from '../../middleware/auth.middleware';
import { requirePermission } from '../../middleware/rbac.middleware';
import { blockForWarehouseManager } from '../../middleware/warehouse-scope.middleware';

const router = Router();

router.use(requireAuth as any);

// Read-only user listing for assignments & work orders
router.get('/', UserController.listUsers as any);
router.get('/:id', UserController.getUserById as any);

// Administrative mutations strictly blocked for Warehouse Manager
router.post('/', blockForWarehouseManager as any, requirePermission('user:manage') as any, UserController.createUser as any);
router.put('/:id', blockForWarehouseManager as any, requirePermission('user:manage') as any, UserController.updateUser as any);
router.patch('/:id/deactivate', blockForWarehouseManager as any, requirePermission('user:manage') as any, UserController.deactivateUser as any);
router.delete('/:id', blockForWarehouseManager as any, requirePermission('user:manage') as any, UserController.deleteUser as any);
router.post('/:id/reset-password', blockForWarehouseManager as any, requirePermission('user:manage') as any, UserController.resetPassword as any);

export default router;
