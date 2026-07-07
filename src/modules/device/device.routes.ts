import { Router } from 'express';
import { DeviceController } from './device.controller';
import { requireAuth } from '../../middleware/auth.middleware';
import { requirePermission } from '../../middleware/rbac.middleware';

const router = Router();

router.use(requireAuth as any);

router.get('/', requirePermission('device:view') as any, DeviceController.listDevices as any);
router.post('/', requirePermission('device:manage') as any, DeviceController.registerDevice as any);
router.put('/:deviceId/approve', requirePermission('device:manage') as any, DeviceController.approveDevice as any);
router.put('/:deviceId/status', requirePermission('device:manage') as any, DeviceController.updateDeviceStatus as any);
router.put('/:deviceId/assign', requirePermission('device:manage') as any, DeviceController.assignDevice as any);

export default router;
