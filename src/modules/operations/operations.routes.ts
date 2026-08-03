import { Router } from 'express';
import { OperationsController } from './operations.controller';
import { requireAuth } from '../../middleware/auth.middleware';
import { requirePermission } from '../../middleware/rbac.middleware';

const router = Router();

router.use(requireAuth as any);

router.get('/', requirePermission('report:view') as any, OperationsController.list as any);
router.get('/:id', requirePermission('report:view') as any, OperationsController.get as any);

export default router;
