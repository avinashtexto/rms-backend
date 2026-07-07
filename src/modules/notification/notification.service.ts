import { prisma } from '../../lib/prisma';
import { ErrorCode } from '../../lib/error-codes';
import { AppError } from '../../middleware/error.middleware';

export class NotificationService {
  static async listNotifications(userId: string, companyId: string) {
    return prisma.notification.findMany({
      where: { userId, companyId },
      orderBy: { createdAt: 'desc' }
    });
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
}
