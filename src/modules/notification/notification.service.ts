import { prisma } from '../../lib/prisma';
import { ErrorCode } from '../../lib/error-codes';
import { AppError } from '../../middleware/error.middleware';

// Mobile clients (NotificationDto) require a non-null `priority` and an optional
// `actionUrl`. The Notification model stores neither, so we derive them from the
// notification `type`. Kept here so both fields stay consistent across endpoints.
const NOTIFICATION_PRIORITY: Record<string, string> = {
  DUPLICATE_SCAN: 'MEDIUM',
  WRONG_LOCATION: 'HIGH',
  WRONG_BOX: 'HIGH',
  INVENTORY_PENDING: 'HIGH',
  SYNC_FAILED: 'HIGH',
  LOW_BATTERY: 'LOW',
  GPS_DISABLED: 'MEDIUM'
};

function decorateNotification(n: {
  id: string;
  type: string;
  title: string;
  message: string;
  isRead: boolean;
  createdAt: Date;
}) {
  return {
    id: n.id,
    type: n.type,
    title: n.title,
    message: n.message,
    isRead: n.isRead,
    priority: NOTIFICATION_PRIORITY[n.type] ?? 'MEDIUM',
    createdAt: n.createdAt,
    actionUrl: null as string | null
  };
}

export class NotificationService {
  static async listNotifications(userId: string, companyId: string) {
    const list = await prisma.notification.findMany({
      where: { userId, companyId },
      orderBy: { createdAt: 'desc' }
    });
    return list.map(decorateNotification);
  }

  static async markAsRead(userId: string, notificationId: string) {
    const notif = await prisma.notification.findFirst({
      where: { id: notificationId, userId }
    });

    if (!notif) {
      const error: AppError = new Error('Notification not found');
      error.statusCode = 404;
      error.code = ErrorCode.NOT_FOUND;
      throw error;
    }

    return prisma.notification.update({
      where: { id: notificationId },
      data: { isRead: true }
    });
  }

  static async markAllAsRead(userId: string) {
    return prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true }
    });
  }

  static async deleteNotification(userId: string, notificationId: string) {
    const notif = await prisma.notification.findFirst({
      where: { id: notificationId, userId }
    });

    if (!notif) {
      const error: AppError = new Error('Notification not found');
      error.statusCode = 404;
      error.code = ErrorCode.NOT_FOUND;
      throw error;
    }

    await prisma.notification.delete({ where: { id: notificationId } });
    return { id: notificationId };
  }
}
