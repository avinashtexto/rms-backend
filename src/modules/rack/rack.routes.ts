import { Router } from 'express';
import { RackController } from './rack.controller';
import { requireAuth } from '../../middleware/auth.middleware';
import { requirePermission } from '../../middleware/rbac.middleware';

const router = Router();

router.use(requireAuth as any);

router.get('/', requirePermission('rack:view') as any, RackController.listRacks as any);
router.get('/:rackId', requirePermission('rack:view') as any, RackController.getRack as any);
router.post('/', requirePermission('rack:manage') as any, RackController.createRack as any);
router.put('/:rackId', requirePermission('rack:manage') as any, RackController.updateRack as any);
router.delete('/:rackId', requirePermission('rack:manage') as any, RackController.deleteRack as any);

export default router;
