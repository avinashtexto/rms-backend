import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.middleware';
import { requirePermission } from '../../middleware/rbac.middleware';
import { UsersController } from './users.controller';

const router = Router();

router.use(requireAuth as any);

router.patch('/me', UsersController.updateMe as any);

router.get('/', requirePermission('user:manage') as any, UsersController.list as any);
router.post('/', requirePermission('user:manage') as any, UsersController.create as any);
router.get('/:id', requirePermission('user:manage') as any, UsersController.get as any);
router.patch('/:id', requirePermission('user:manage') as any, UsersController.update as any);
router.post(
  '/:id/reset-password',
  requirePermission('user:manage') as any,
  UsersController.resetPassword as any
);
router.put(
  '/:id/assignments',
  requirePermission('user:manage') as any,
  UsersController.updateAssignments as any
);

export default router;
