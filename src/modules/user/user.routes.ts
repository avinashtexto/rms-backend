import { Router } from 'express';
import { UserController } from './user.controller';
import { requireAuth } from '../../middleware/auth.middleware';
import { requirePermission } from '../../middleware/rbac.middleware';

const router = Router();

router.use(requireAuth as any);

router.get('/', requirePermission('user:view') as any, UserController.listUsers as any);
router.get('/:userId', requirePermission('user:view') as any, UserController.getUserById as any);
router.post('/', requirePermission('user:manage') as any, UserController.createUser as any);
router.put('/:userId', requirePermission('user:manage') as any, UserController.updateUser as any);
router.delete('/:userId', requirePermission('user:manage') as any, UserController.deactivateUser as any);
router.post('/:userId/reset-password', requirePermission('user:manage') as any, UserController.resetPassword as any);

export default router;
