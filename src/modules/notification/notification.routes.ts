import { Router } from 'express';
import { NotificationController } from './notification.controller';
import { requireAuth } from '../../middleware/auth.middleware';

const router = Router();

router.use(requireAuth as any);

router.get('/', NotificationController.listNotifications as any);
router.put('/read-all', NotificationController.markAllAsRead as any);
router.put('/:notificationId/read', NotificationController.markAsRead as any);
router.delete('/:notificationId', NotificationController.deleteNotification as any);

export default router;
