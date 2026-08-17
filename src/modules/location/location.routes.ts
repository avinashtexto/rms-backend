import { Router } from 'express';
import { LocationController } from './location.controller';
import { requireAuth } from '../../middleware/auth.middleware';
import { requirePermission } from '../../middleware/rbac.middleware';
import { enforceWarehouseScope } from '../../middleware/warehouse-scope.middleware';

const router = Router();

router.use(requireAuth as any);
router.use(enforceWarehouseScope as any);

router.get('/', requirePermission('location:view') as any, LocationController.listLocations as any);
router.post('/bulk-generate', requirePermission('location:manage') as any, LocationController.bulkGenerate as any);
router.post('/bulk-action', requirePermission('location:manage') as any, LocationController.bulkAction as any);
router.post('/bulk-import', requirePermission('location:manage') as any, LocationController.bulkImport as any);
router.get('/:locationId', requirePermission('location:view') as any, LocationController.getLocation as any);
router.post('/', requirePermission('location:manage') as any, LocationController.createLocation as any);
router.put('/:locationId', requirePermission('location:manage') as any, LocationController.updateLocation as any);
router.delete('/:locationId', requirePermission('location:manage') as any, LocationController.deleteLocation as any);

export default router;
