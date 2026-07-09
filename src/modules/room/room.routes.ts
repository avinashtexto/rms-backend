import { Router } from 'express';
import { RoomController } from './room.controller';
import { requireAuth } from '../../middleware/auth.middleware';
import { requirePermission } from '../../middleware/rbac.middleware';

const router = Router();

router.use(requireAuth as any);

router.get('/', requirePermission('room:view') as any, RoomController.listRooms as any);
router.get('/:id', requirePermission('room:view') as any, RoomController.getRoom as any);
router.post('/', requirePermission('room:manage') as any, RoomController.createRoom as any);
router.put('/:id', requirePermission('room:manage') as any, RoomController.updateRoom as any);
router.delete('/:id', requirePermission('room:manage') as any, RoomController.deleteRoom as any);

export default router;
