import { Router } from 'express';
import { GpsController } from './gps.controller';
import { requireAuth } from '../../middleware/auth.middleware';
import { requirePermission } from '../../middleware/rbac.middleware';

const router = Router();

router.use(requireAuth as any);

router.post('/track', requirePermission('gps:track') as any, GpsController.trackGps as any);
router.get('/users/:userId/current', requirePermission('gps:view') as any, GpsController.getLastKnownLocation as any);
router.get('/users/:userId/history', requirePermission('gps:view') as any, GpsController.getHistory as any);
router.get('/warehouses/:warehouseId/live', requirePermission('gps:view') as any, GpsController.getLiveWarehouseUsers as any);

export default router;
