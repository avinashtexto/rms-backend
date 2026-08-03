import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.middleware';
import { requirePermission } from '../../middleware/rbac.middleware';
import { DevicesManagementController } from './users.controller';

const router = Router();

router.use(requireAuth as any);

router.get('/', requirePermission('user:manage') as any, DevicesManagementController.list as any);
router.get('/:id', requirePermission('user:manage') as any, DevicesManagementController.get as any);
router.patch('/:id', requirePermission('user:manage') as any, DevicesManagementController.update as any);

export default router;
